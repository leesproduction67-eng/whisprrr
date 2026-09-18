// PWA Web Push & Background Mesh Service

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class PushNotificationService {
  private static instance: PushNotificationService | null = null;
  private isSubscribed: boolean = false;
  private currentUserId: string | null = null;

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  public isPushSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  public async getVapidPublicKey(): Promise<string | null> {
    try {
      const res = await fetch('/api/push/vapid-public-key');
      if (!res.ok) return null;
      const data = await res.json();
      return data.publicKey || null;
    } catch (err) {
      console.warn('Failed to fetch VAPID public key:', err);
      return null;
    }
  }

  public async subscribeUser(userId: string): Promise<boolean> {
    if (!this.isPushSupported()) {
      console.warn('Web Push is not supported in this environment');
      return false;
    }

    this.currentUserId = userId;

    try {
      // 1. Request notification permission if not already granted
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        console.warn('Notification permission not granted:', permission);
        return false;
      }

      // 2. Fetch VAPID public key
      const publicKey = await this.getVapidPublicKey();
      if (!publicKey) {
        console.warn('VAPID public key unavailable from server');
        return false;
      }

      // 3. Get active service worker registration
      const reg = await navigator.serviceWorker.ready;

      // 4. Subscribe with PushManager
      const existingSub = await reg.pushManager.getSubscription();
      let sub = existingSub;

      if (!sub) {
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      // 5. Send subscription to server
      const cleanUserId = userId.toLowerCase().replace(/^whisprr_/, '');
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: cleanUserId,
          subscription: sub.toJSON(),
        }),
      });

      if (response.ok) {
        this.isSubscribed = true;
        try {
          localStorage.setItem('whisprr_push_subscribed', 'true');
        } catch {}

        // 6. Register periodic background sync if supported by browser
        if ('periodicSync' in reg) {
          try {
            await (reg as any).periodicSync.register('whisprr-mesh-sync', {
              minInterval: 12 * 60 * 60 * 1000,
            });
          } catch (e) {
            console.debug('Periodic sync not permitted:', e);
          }
        }

        return true;
      }
    } catch (err) {
      console.error('Error during push notification subscription:', err);
    }

    return false;
  }

  // Automatic subscription check on startup if already granted
  public async autoSubscribeIfGranted(userId: string) {
    if (!this.isPushSupported()) return;
    if (Notification.permission === 'granted') {
      await this.subscribeUser(userId);
    }
  }

  public isStandalonePWA(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  }
}

export const pushService = PushNotificationService.getInstance();
