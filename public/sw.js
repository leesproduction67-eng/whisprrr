const CACHE_NAME = 'whisprr-pwa-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
];

// 1. Install & Cache Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate & Purge Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Network-First / Cache Fallback for Assets (Bypass API and SSE)
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// 4. Web Push Notification Handling (Always-Connected Mesh even when App is closed)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      type: 'MESSAGE',
      title: 'Whisprr Mesh Notification',
      body: event.data.text(),
    };
  }

  // If a call was cancelled / answered elsewhere, dismiss ringing notification
  if (payload.type === 'CALL_CANCELLED') {
    event.waitUntil(
      self.registration.getNotifications({ tag: 'whisprr-call' }).then((notifications) => {
        notifications.forEach((n) => n.close());
      })
    );
    return;
  }

  // Incoming Call Notification (High-Priority with Action Buttons & Persistent Ring)
  if (payload.type === 'CALL') {
    const options = {
      body: payload.body || 'Incoming HD Video Call - Tap to answer',
      icon: payload.icon || '/icons/icon.svg',
      badge: payload.badge || '/icons/icon.svg',
      tag: 'whisprr-call',
      renotify: true,
      requireInteraction: true,
      vibrate: payload.vibrate || [500, 200, 500, 200, 500, 200, 800],
      actions: [
        { action: 'answer', title: '📞 Answer Call' },
        { action: 'decline', title: '❌ Decline' },
      ],
      data: payload.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(payload.title || '📞 Whisprr Incoming Call', options)
    );
    return;
  }

  // Standard Incoming Chat Message or Friend Request Notification
  const options = {
    body: payload.body || 'New private message',
    icon: payload.icon || '/icons/icon.svg',
    badge: payload.badge || '/icons/icon.svg',
    tag: payload.tag || `whisprr-msg-${Date.now()}`,
    vibrate: payload.vibrate || [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open Chat' },
    ],
    data: payload.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Whisprr Message', options)
  );
});

// 5. Notification Click Handling (Answer Call or Open Conversation)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const action = event.action;

  // If user tapped Decline on an incoming call
  if (action === 'decline') {
    if (notificationData.callerId) {
      event.waitUntil(
        fetch('/api/signal/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'CALL_REJECT',
            senderId: 'user',
            recipientId: notificationData.callerId,
            timestamp: Date.now(),
          }),
        }).catch(() => {})
      );
    }
    return;
  }

  // If user tapped Answer or clicked the notification body
  let targetUrl = notificationData.url || '/';
  if (action === 'answer' && notificationData.callerId) {
    targetUrl = `/?call=${encodeURIComponent(notificationData.callerId)}&callerName=${encodeURIComponent(notificationData.callerName || '')}&autoAnswer=true`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing open Whisprr window if present
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            action,
            data: notificationData,
          });
          return client.focus();
        }
      }
      // Otherwise launch new window directly into the call or chat
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 6. Periodic Background Sync for Continuous Mesh Synchronization
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'whisprr-mesh-sync') {
    event.waitUntil(
      fetch('/api/accounts')
        .then(() => {})
        .catch(() => {})
    );
  }
});
