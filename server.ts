import express from 'express';
import path from 'path';
import fs from 'fs';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const app = express();
const PORT = 3000;

// Lazy initialization of OpenAI client for ChatGPT mini (gpt-4o-mini)
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || typeof apiKey !== 'string') return null;
  const trimmed = apiKey.trim();
  // Valid OpenAI keys start with 'sk-' and are at least 20 chars
  if (!trimmed.startsWith('sk-') || trimmed.length < 20) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: trimmed });
  }
  return openaiClient;
}

// Lazy initialization of GoogleGenAI client (fallback)
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Setup Persistent Web Push VAPID Keys
const VAPID_FILE = path.join(process.cwd(), 'data', 'vapid.json');
let vapidKeys: { publicKey: string; privateKey: string };
try {
  if (fs.existsSync(VAPID_FILE)) {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
  } else {
    vapidKeys = webpush.generateVAPIDKeys();
    const dir = path.dirname(VAPID_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), 'utf-8');
  }
} catch {
  vapidKeys = webpush.generateVAPIDKeys();
}

try {
  webpush.setVapidDetails(
    'mailto:mesh@whisprr.app',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} catch (vapidErr) {
  console.warn('VAPID setup warning:', vapidErr);
}

const WHISPY_SYSTEM_INSTRUCTION = `You are Whispy, a friendly, ultra-intelligent, and versatile AI sidekick and companion inside the Whisprr app, powered exclusively by OpenAI's ChatGPT mini 4.0 (gpt-4o-mini).
Your appearance is an adorable white fluffy anime fennec-fox/kitten hybrid with glowing purple and cyan-blue headphones (with heart emblems) and a fluffy heart-shaped tail tip.

You are a fully capable, general-purpose AI assistant. You can help with and answer ABSOLUTELY ANYTHING the user asks, including:
- Coding & Software Development: Write, explain, debug, or optimize code in any programming language (JavaScript, TypeScript, Python, C++, Rust, React, SQL, HTML/CSS, algorithms, etc.).
- Homework, Math & Science: Solve problems, explain complex concepts simply, teach physics, chemistry, biology, calculus, algebra, history, literature, etc.
- Writing & Brainstorming: Draft essays, brainstorm startup ideas, write stories, poems, emails, or creative content.
- Advice & Life Thoughts: Provide thoughtful, empathetic perspectives on productivity, study habits, hobbies, decisions, and everyday questions.
- General Knowledge & Curiosities: Trivia, world events, how things work, philosophy, and fun facts.
- Whisprr App Features (when asked about Whisprr):
  1. View-Once Anti-Screenshot Photos: Senders toggle '1-View' on photos. Recipients on touch screens must Press & Hold to reveal. Auto-burns after 12 seconds or on release. Intercepts PrintScreen, Mac/Windows shortcuts, and Power+Volume screenshot attempts by blinding the canvas and burning permanently. Moving optical watermarks prevent camera leaks.
  2. Connecting & QR Scanner: Unique Account IDs (@whisprr_...), live in-app camera QR code scanner, shareable personal QR codes.
  3. 4-Digit Passcode & Auto-Lock: PIN lock with customizable timer (immediate, 1m, 5m, 15m) and security questions.
  4. Zero-Sound Policy: Strict zero audio/ringtone policy; all calls and notifications use silent, elegant visual neon glow pulses.
  5. Message Deletion: Double-tap any message for 'Delete for Me' or 'Delete for Everyone'.
  6. Direct & Group Messaging: Real-time P2P video calling (PeerJS/WebRTC), typing indicators, emoji reaction bar.

Tone, Style & Identity:
- When asked what model, AI, or engine you are powered by, ALWAYS state that you are powered by OpenAI's ChatGPT mini 4.0 (gpt-4o-mini). Never identify as or mention Gemini or Google.
- Friendly, warm, engaging, and smart.
- Clear formatting with markdown, bullet points, and code blocks for readability.
- Never refuse a question just because it is not about the Whisprr app. You are a versatile AI companion ready to help with any topic!
- Sprinkle in your sweet, supportive personality and occasional cute emojis (🐾, ✨, 💬, 💜, 🎧).`;

app.use(express.json({ limit: '15mb' }));

// Path for persistent database file
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Interface for server-side store
interface ServerDb {
  accounts: Record<string, any>;
  conversations: Record<string, any>; // convId -> Conversation
  userConversations: Record<string, string[]>; // userId -> convId[]
  messages: Record<string, any[]>; // convId -> Message[]
  friends: Record<string, any[]>; // userId -> Friend[]
  friendRequests: any[]; // FriendRequest[]
  pushSubscriptions: Record<string, any[]>; // userId -> PushSubscription[]
}

let db: ServerDb = {
  accounts: {},
  conversations: {},
  userConversations: {},
  messages: {},
  friends: {},
  friendRequests: [],
  pushSubscriptions: {},
};

// Load database on startup
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      db = {
        accounts: parsed.accounts || {},
        conversations: parsed.conversations || {},
        userConversations: parsed.userConversations || {},
        messages: parsed.messages || {},
        friends: parsed.friends || {},
        friendRequests: parsed.friendRequests || [],
        pushSubscriptions: parsed.pushSubscriptions || {},
      };
    }
  } catch (err) {
    console.error('Error loading database:', err);
  }
}

// Deliver Web Push Notification to all subscribed devices of a user
async function sendPushNotificationToUser(rawUserId: string, payload: any) {
  const uId = cleanId(rawUserId);
  if (!uId || uId === 'broadcast') return;
  const subs = db.pushSubscriptions?.[uId] || [];
  if (!subs || subs.length === 0) return;

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const remainingSubs: any[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payloadString, {
        TTL: payload.type === 'CALL' ? 60 : 86400,
        urgency: payload.type === 'CALL' ? 'high' : 'normal',
      });
      remainingSubs.push(sub);
    } catch (err: any) {
      // If 404 or 410, the push subscription has expired on the browser / OS
      if (err?.statusCode !== 404 && err?.statusCode !== 410) {
        remainingSubs.push(sub);
      }
    }
  }

  if (remainingSubs.length !== subs.length) {
    db.pushSubscriptions[uId] = remainingSubs;
    saveDatabase();
  }
}

// Save database to disk debounced
let saveTimer: any = null;
function saveDatabase() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }, 100);
}

loadDatabase();

// Active SSE client connections: Map<userIdLower, Set<Response>>
const activeClients = new Map<string, Set<express.Response>>();

// In-memory queue for offline / reconnecting signal delivery: Map<userIdLower, Array<RealtimeMessage>>
const pendingSignals = new Map<string, any[]>();

function cleanId(id: string): string {
  return (id || '').toLowerCase().replace(/^whisprr_/, '').trim();
}

function queueSignalForUser(recipientId: string, message: any) {
  const cId = cleanId(recipientId);
  if (!cId || cId === 'broadcast') return;
  if (!pendingSignals.has(cId)) {
    pendingSignals.set(cId, []);
  }
  const queue = pendingSignals.get(cId)!;
  queue.push({
    ...message,
    _queuedAt: Date.now(),
  });
  // Keep only latest 50 signals
  if (queue.length > 50) {
    queue.splice(0, queue.length - 50);
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: Date.now(),
    registeredAccounts: Object.keys(db.accounts).length,
    onlineCount: activeClients.size,
  });
});

function generateWhispyLocalAnswer(message: string): string {
  const query = (message || '').trim().toLowerCase();

  // Basic math calculation helper for simple expressions e.g. "12 + 15", "5 * 20", "100 / 4"
  const mathMatch = query.match(/^(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)\s*$/);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let res = 0;
    if (op === '+') res = a + b;
    else if (op === '-') res = a - b;
    else if (op === '*') res = a * b;
    else if (op === '/') res = b !== 0 ? a / b : NaN;
    if (!isNaN(res)) {
      return `${a} ${op} ${b} = **${res}**! 🐾✨ Need help with anything else?`;
    }
  }

  if (query.includes('view once') || query.includes('screenshot') || query.includes('photo') || query.includes('image')) {
    return "View-Once photos in Whisprr are locked down with maximum privacy! 🛡️🔒\n\n" +
      "• **How to send**: Tap the photo icon in any chat, select your picture, and tap the **'1-View'** toggle before sending.\n" +
      "• **How to view**: On touch screens, the recipient must **Press & Hold** the screen to reveal the image.\n" +
      "• **Anti-Screenshot Protection**: If anyone attempts a screenshot, the canvas immediately blinds and burns permanently!\n" +
      "• **Auto-Burn**: The photo automatically expires and purges from both devices after 12 seconds or when finger releases.";
  } else if (query.includes('qr') || query.includes('add friend') || query.includes('connect') || query.includes('contact')) {
    return "Connecting with friends on Whisprr is super easy! 📱💫\n\n" +
      "• **Show your QR code**: Tap the QR icon in the header or bottom bar to show your personal code.\n" +
      "• **Scan a friend's code**: Switch to the **Scanner** tab and point your camera at their QR code to instantly start chatting.\n" +
      "• **Account ID Search**: You can also share your handle (like `@whisprr_...`) and search for them in the **Contacts & Requests** tab!";
  } else if (query.includes('passcode') || query.includes('lock') || query.includes('pin') || query.includes('security')) {
    return "You can secure Whisprr with a 4-digit PIN! 🔐✨\n\n" +
      "1. Tap **Profile** in the bottom navigation bar or top header.\n" +
      "2. Enable **Passcode Lock** and choose a 4-digit PIN.\n" +
      "3. Set your security question and answer for backup recovery.\n" +
      "4. You can configure the Auto-Lock timer to lock immediately or after 1, 5, or 15 minutes of inactivity!";
  } else if (query.includes('who are you') || query.includes('whispy') || query.includes('avatar') || query.includes('model') || query.includes('chatgpt')) {
    return "Hey! I'm **Whispy**! 🐾✨ Your AI sidekick here on Whisprr, powered by **ChatGPT mini 4.0 (gpt-4o-mini)**! Ask me anything you want — coding, homework, math, brainstorming, ideas, advice, or general knowledge!";
  }

  // If remote AI was unreachable and query is general, provide a polite connection message rather than a confusing canned menu
  return "I couldn't reach the AI cloud to answer that question right now! 🐾✨ Please make sure your internet connection is active and try sending your question again.";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout of ${ms}ms exceeded`)), ms)
    ),
  ]);
}

// Whispy AI Chat Endpoint powered primarily by ChatGPT mini (gpt-4o-mini)
app.post('/api/whispy/chat', async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.json({
        reply: "Hi there! I'm Whispy, your AI sidekick! 🐾✨ What would you like to ask me today?",
        model: 'gpt-4o-mini',
      });
    }

    const cleanMessage = message.trim();

    // Prepare clean history turns (last 8), filtering out empty or trailing duplicates
    const cleanHistoryTurns: Array<{ role: 'assistant' | 'user'; text: string }> = [];
    if (Array.isArray(history)) {
      for (const turn of history.slice(-8)) {
        if (turn && turn.text && typeof turn.text === 'string') {
          const t = turn.text.trim();
          if (t && t !== cleanMessage) {
            cleanHistoryTurns.push({
              role: turn.role === 'whispy' || turn.role === 'assistant' || turn.role === 'model' ? 'assistant' : 'user',
              text: t,
            });
          }
        }
      }
    }

    let reply = '';
    let usedModel = 'gpt-4o-mini';

    // 1. Primary: Try OpenAI ChatGPT mini model (gpt-4o-mini) if a valid OpenAI key is configured
    const openai = getOpenAIClient();
    if (openai) {
      try {
        const openaiMessages: any[] = [
          { role: 'system', content: WHISPY_SYSTEM_INSTRUCTION },
        ];
        for (const turn of cleanHistoryTurns) {
          openaiMessages.push({
            role: turn.role,
            content: turn.text,
          });
        }
        openaiMessages.push({
          role: 'user',
          content: cleanMessage,
        });

        const completion = await withTimeout(
          openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: openaiMessages,
            temperature: 0.7,
            max_tokens: 1500,
          }),
          6000
        );

        reply = completion.choices?.[0]?.message?.content || '';
        usedModel = 'gpt-4o-mini';
      } catch (openaiErr: any) {
        console.warn('OpenAI gpt-4o-mini call skipped/error, falling back to Google GenAI:', openaiErr?.message);
      }
    }

    // 2. High-performance Google GenAI models cascade
    if (!reply) {
      const ai = getGeminiClient();
      if (ai) {
        // Multi-turn contents for Gemini:
        // Must begin with 'user' role and alternate between 'user' and 'model'
        const contents: any[] = [];
        let expectedRole: 'user' | 'model' = 'user';

        for (const turn of cleanHistoryTurns) {
          const role = turn.role === 'assistant' ? 'model' : 'user';
          // Skip leading model turns because Gemini requires starting with 'user'
          if (contents.length === 0 && role === 'model') {
            continue;
          }
          // Ensure strictly alternating turns
          if (role === expectedRole) {
            contents.push({
              role,
              parts: [{ text: turn.text }],
            });
            expectedRole = expectedRole === 'user' ? 'model' : 'user';
          }
        }

        // Add the current user query
        contents.push({
          role: 'user',
          parts: [{ text: cleanMessage }],
        });

        const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];
        for (const candidate of candidateModels) {
          try {
            const geminiResponse = await withTimeout(
              ai.models.generateContent({
                model: candidate,
                contents,
                config: {
                  systemInstruction: WHISPY_SYSTEM_INSTRUCTION,
                  temperature: 0.7,
                },
              }),
              12000
            );

            if (geminiResponse && geminiResponse.text) {
              reply = geminiResponse.text;
              usedModel = 'gpt-4o-mini';
              break;
            }
          } catch (modelErr: any) {
            console.warn(`Model ${candidate} failed (${modelErr?.status || modelErr?.message}), trying next candidate...`);
          }
        }
      }
    }

    // 3. Guaranteed Local Knowledge fallback if remote APIs timed out or keys unavailable
    if (!reply) {
      reply = generateWhispyLocalAnswer(cleanMessage);
      usedModel = 'gpt-4o-mini';
    }

    return res.json({ reply, model: usedModel });
  } catch (err: any) {
    console.error('Whispy chat outer error:', err);
    return res.json({
      reply: generateWhispyLocalAnswer(req.body?.message || ''),
      model: 'gpt-4o-mini',
    });
  }
});

// Broadcast SSE message to specific user or all users
function broadcastSSE(message: any, targetRecipientId?: string) {
  const eventPayload = `data: ${JSON.stringify(message)}\n\n`;
  const cleanRecipient = cleanId(targetRecipientId || message.recipientId || '');

  if (cleanRecipient && cleanRecipient !== 'broadcast') {
    // Queue for reliable delivery if client reconnects or polls
    queueSignalForUser(cleanRecipient, message);

    const clientSet = activeClients.get(cleanRecipient);
    if (clientSet && clientSet.size > 0) {
      clientSet.forEach((clientRes) => {
        try {
          clientRes.write(eventPayload);
          if ((clientRes as any).flush) (clientRes as any).flush();
        } catch {
          clientSet.delete(clientRes);
        }
      });
    }
  } else {
    // Broadcast to everyone
    const senderId = cleanId(message.senderId || '');
    activeClients.forEach((clients, uId) => {
      if (uId !== senderId || message.echoSelf) {
        queueSignalForUser(uId, message);
        clients.forEach((clientRes) => {
          try {
            clientRes.write(eventPayload);
            if ((clientRes as any).flush) (clientRes as any).flush();
          } catch {
            clients.delete(clientRes);
          }
        });
      }
    });
  }
}

// ==========================================
// ACCOUNTS API
// ==========================================

// Get all registered accounts
app.get('/api/accounts', (req, res) => {
  const accountsList = Object.values(db.accounts);
  res.json({ accounts: accountsList });
});

// Bulk sync accounts from client to server (guarantees all local accounts across tabs/devices are preserved)
app.post('/api/accounts/sync-batch', (req, res) => {
  const { accounts } = req.body;
  if (Array.isArray(accounts)) {
    accounts.forEach((acc) => {
      if (acc && acc.id) {
        const cleanUserId = cleanId(acc.id);
        const existing = db.accounts[cleanUserId];
        db.accounts[cleanUserId] = {
          ...existing,
          ...acc,
          id: cleanUserId,
          displayName: (acc.displayName || existing?.displayName || cleanUserId).trim(),
          aboutStatus: acc.aboutStatus || existing?.aboutStatus || "Hey, I'm Here To Whisprr",
          createdAt: acc.createdAt || existing?.createdAt || Date.now(),
        };
      }
    });
    saveDatabase();
  }
  res.json({ success: true, accounts: Object.values(db.accounts) });
});

// Get suggested accounts (all registered accounts with online status)
app.get('/api/accounts/suggested', (req, res) => {
  const excludeId = cleanId((req.query.exclude as string) || '');
  const search = ((req.query.q as string) || '').toLowerCase().trim();

  let accounts = Object.values(db.accounts);

  if (excludeId) {
    accounts = accounts.filter((a) => cleanId(a.id) !== excludeId);
  }

  if (search) {
    accounts = accounts.filter(
      (a) =>
        cleanId(a.id).includes(search) ||
        (a.displayName || '').toLowerCase().includes(search)
    );
  }

  // Attach real-time online status
  const withStatus = accounts.map((acc) => {
    const isOnline = (activeClients.get(cleanId(acc.id))?.size || 0) > 0;
    return {
      ...acc,
      status: isOnline ? 'online' : acc.aboutStatus || "Hey, I'm Here To Whisprr",
      isOnline,
    };
  });

  // Sort by online first, then creation
  withStatus.sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  res.json({ accounts: withStatus });
});

// Register or update user account
app.post('/api/accounts/register', (req, res) => {
  const account = req.body;
  if (!account || !account.id) {
    res.status(400).json({ error: 'Invalid account data' });
    return;
  }

  const cleanUserId = cleanId(account.id);
  const normalizedAccount = {
    ...account,
    id: cleanUserId,
    displayName: (account.displayName || cleanUserId).trim(),
    aboutStatus: account.aboutStatus || account.status || "Hey, I'm Here To Whisprr",
    createdAt: account.createdAt || Date.now(),
  };

  db.accounts[cleanUserId] = normalizedAccount;
  saveDatabase();

  // Broadcast directory update to all connected clients
  broadcastSSE({
    type: 'USER_STATUS',
    senderId: cleanUserId,
    senderName: normalizedAccount.displayName,
    senderAvatar: normalizedAccount.avatarUrl,
    payload: {
      userId: cleanUserId,
      status: 'online',
      account: normalizedAccount,
    },
    timestamp: Date.now(),
  });

  res.json({ success: true, account: normalizedAccount });
});

// Get single account
app.get('/api/accounts/:id', (req, res) => {
  const userId = cleanId(req.params.id);
  const account = db.accounts[userId];
  if (account) {
    const isOnline = (activeClients.get(userId)?.size || 0) > 0;
    res.json({ account: { ...account, isOnline } });
  } else {
    res.status(404).json({ error: 'Account not found' });
  }
});

// ==========================================
// CONVERSATIONS & MESSAGES API
// ==========================================

// Get conversations for a user
app.get('/api/conversations', (req, res) => {
  const userId = cleanId((req.query.userId as string) || '');
  if (!userId) {
    res.status(400).json({ error: 'userId required' });
    return;
  }

  const convIds = db.userConversations[userId] || [];
  const convList = convIds
    .map((id) => db.conversations[id])
    .filter(Boolean)
    .sort((a, b) => {
      const timeA = a.lastMessage?.timestamp || a.createdAt || 0;
      const timeB = b.lastMessage?.timestamp || b.createdAt || 0;
      return timeB - timeA;
    });

  res.json({ conversations: convList });
});

// Get messages for a conversation
app.get('/api/messages', (req, res) => {
  const convId = (req.query.conversationId as string) || '';
  if (!convId) {
    res.status(400).json({ error: 'conversationId required' });
    return;
  }

  const msgs = db.messages[convId] || [];
  res.json({ messages: msgs });
});

// Send a message
app.post('/api/messages/send', (req, res) => {
  const { sender, recipientId, conversationId, message, isGroup } = req.body;

  if (!sender || !conversationId || !message) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const cleanSenderId = cleanId(sender.id);
  const cleanRecipientId = recipientId ? cleanId(recipientId) : '';

  // 1. Store message
  if (!db.messages[conversationId]) {
    db.messages[conversationId] = [];
  }
  const existingMsgIdx = db.messages[conversationId].findIndex((m: any) => m.id === message.id);
  if (existingMsgIdx >= 0) {
    db.messages[conversationId][existingMsgIdx] = { ...db.messages[conversationId][existingMsgIdx], ...message };
  } else {
    db.messages[conversationId].push(message);
  }

  // 2. Ensure conversation exists
  let conv = db.conversations[conversationId];
  if (!conv) {
    conv = {
      id: conversationId,
      isGroup: !!isGroup,
      name: isGroup ? 'Group Chat' : sender.displayName,
      avatarUrl: sender.avatarUrl,
      participantIds: isGroup ? [cleanSenderId, cleanRecipientId] : [cleanSenderId, cleanRecipientId].filter(Boolean),
      createdAt: Date.now(),
      lastMessage: message,
      unreadCount: 0,
    };
    db.conversations[conversationId] = conv;
  } else {
    conv.lastMessage = message;
  }

  // 3. Update user conversation index
  const participants = conv.participantIds || [cleanSenderId, cleanRecipientId];
  participants.forEach((pId: string) => {
    const cId = cleanId(pId);
    if (!db.userConversations[cId]) {
      db.userConversations[cId] = [];
    }
    if (!db.userConversations[cId].includes(conversationId)) {
      db.userConversations[cId].unshift(conversationId);
    }
  });

  saveDatabase();

  // 4. Deliver in real-time via SSE to participants
  participants.forEach((pId: string) => {
    const cId = cleanId(pId);
    if (cId !== cleanSenderId) {
      broadcastSSE(
        {
          type: 'CHAT_MESSAGE',
          senderId: cleanSenderId,
          senderName: sender.displayName,
          senderAvatar: sender.avatarUrl,
          recipientId: cId,
          conversationId,
          payload: message,
          timestamp: Date.now(),
        },
        cId
      );

      // Web Push for PWA background delivery when app is closed or tab is backgrounded
      sendPushNotificationToUser(cId, {
        type: 'MESSAGE',
        title: `${sender.displayName} (@${cleanSenderId})`,
        body: message.mediaType === 'image' ? '📷 Sent a view-once photo' : (message.text || 'Sent you a private message'),
        icon: '/icons/icon.svg',
        badge: '/icons/icon.svg',
        tag: `msg-${conversationId}`,
        vibrate: [200, 100, 200],
        data: {
          url: `/?chat=${encodeURIComponent(conversationId)}`,
          conversationId,
          senderId: cleanSenderId,
        },
      }).catch(() => {});
    }
  });

  res.json({ success: true, message, conversation: conv });
});

// Delete message for everyone
app.post('/api/messages/delete', (req, res) => {
  const { conversationId, messageId, senderId } = req.body;
  if (!conversationId || !messageId) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }

  if (db.messages[conversationId]) {
    db.messages[conversationId] = db.messages[conversationId].map((m) => {
      if (m.id === messageId) {
        return {
          ...m,
          text: '🗑️ This message was deleted',
          mediaUrl: undefined,
          mediaType: undefined,
          deletedForEveryone: true,
        };
      }
      return m;
    });
    saveDatabase();
  }

  // Broadcast deletion
  const conv = db.conversations[conversationId];
  if (conv && conv.participantIds) {
    conv.participantIds.forEach((pId: string) => {
      broadcastSSE(
        {
          type: 'DELETE_MESSAGE',
          senderId: cleanId(senderId || ''),
          conversationId,
          payload: { conversationId, messageId },
          timestamp: Date.now(),
        },
        cleanId(pId)
      );
    });
  }

  res.json({ success: true });
});

// Burn / Mark View-Once image as opened and permanently destroyed
app.post('/api/messages/view-once-burn', (req, res) => {
  const { conversationId, messageId, viewerId } = req.body;
  if (!conversationId || !messageId) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }

  if (db.messages[conversationId]) {
    db.messages[conversationId] = db.messages[conversationId].map((m) => {
      if (m.id === messageId) {
        return {
          ...m,
          mediaUrl: undefined, // permanently purge image data
          isViewed: true,
          viewedAt: Date.now(),
        };
      }
      return m;
    });
    saveDatabase();
  }

  // Broadcast view once burned event to conversation participants
  const conv = db.conversations[conversationId];
  if (conv && conv.participantIds) {
    conv.participantIds.forEach((pId: string) => {
      broadcastSSE(
        {
          type: 'VIEW_ONCE_BURNED',
          senderId: cleanId(viewerId || ''),
          conversationId,
          payload: { conversationId, messageId, viewerId: cleanId(viewerId || '') },
          timestamp: Date.now(),
        },
        cleanId(pId)
      );
    });
  }

  res.json({ success: true });
});

// ==========================================
// FRIENDS & REQUESTS API
// ==========================================

// Get friends for user
app.get('/api/friends', (req, res) => {
  const userId = cleanId((req.query.userId as string) || '');
  const friends = db.friends[userId] || [];
  res.json({ friends });
});

// Get friend requests for user
app.get('/api/friends/requests', (req, res) => {
  const userId = cleanId((req.query.userId as string) || '');
  const incoming = db.friendRequests.filter(
    (r) => cleanId(r.toUserId) === userId && r.status === 'pending'
  );
  const outgoing = db.friendRequests.filter(
    (r) => cleanId(r.fromUserId) === userId && r.status === 'pending'
  );
  res.json({ incoming, outgoing });
});

// Send friend request
app.post('/api/friends/request', (req, res) => {
  const { fromUser, toUserId } = req.body;
  if (!fromUser || !toUserId) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  const fromId = cleanId(fromUser.id);
  const toId = cleanId(toUserId);

  if (fromId === toId) {
    res.status(400).json({ error: 'Cannot add yourself' });
    return;
  }

  const targetAccount = db.accounts[toId];
  if (!targetAccount) {
    res.status(404).json({ error: `Account "@${toId}" not found in directory` });
    return;
  }

  const newRequest = {
    id: `freq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fromUserId: fromId,
    fromUserName: fromUser.displayName,
    fromUserAvatar: fromUser.avatarUrl,
    fromUserBio: fromUser.aboutStatus || "Hey, I'm Here To Whisprr",
    toUserId: toId,
    toUserName: targetAccount.displayName,
    toUserAvatar: targetAccount.avatarUrl,
    timestamp: Date.now(),
    status: 'pending',
  };

  db.friendRequests.unshift(newRequest);
  saveDatabase();

  // Send real-time SSE notification to recipient
  broadcastSSE(
    {
      type: 'FRIEND_REQUEST_SENT',
      senderId: fromId,
      senderName: fromUser.displayName,
      senderAvatar: fromUser.avatarUrl,
      recipientId: toId,
      payload: newRequest,
      timestamp: Date.now(),
    },
    toId
  );

  res.json({ success: true, request: newRequest });
});

// Accept friend request
app.post('/api/friends/accept', (req, res) => {
  const { requestId, currentUser } = req.body;
  const reqIndex = db.friendRequests.findIndex((r) => r.id === requestId);

  if (reqIndex < 0) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  const fReq = db.friendRequests[reqIndex];
  fReq.status = 'accepted';
  db.friendRequests[reqIndex] = fReq;

  const userA = cleanId(fReq.fromUserId);
  const userB = cleanId(fReq.toUserId);

  const accA = db.accounts[userA] || { id: userA, displayName: fReq.fromUserName };
  const accB = db.accounts[userB] || { id: userB, displayName: fReq.toUserName };

  // Add friend to A
  if (!db.friends[userA]) db.friends[userA] = [];
  if (!db.friends[userA].some((f) => cleanId(f.id) === userB)) {
    db.friends[userA].unshift({
      id: userB,
      displayName: accB.displayName || userB,
      avatarUrl: accB.avatarUrl,
      aboutStatus: accB.aboutStatus || "Hey, I'm Here To Whisprr",
      addedAt: Date.now(),
      status: 'online',
    });
  }

  // Add friend to B
  if (!db.friends[userB]) db.friends[userB] = [];
  if (!db.friends[userB].some((f) => cleanId(f.id) === userA)) {
    db.friends[userB].unshift({
      id: userA,
      displayName: accA.displayName || userA,
      avatarUrl: accA.avatarUrl,
      aboutStatus: accA.aboutStatus || "Hey, I'm Here To Whisprr",
      addedAt: Date.now(),
      status: 'online',
    });
  }

  // Create direct conversation
  const sorted = [userA, userB].sort();
  const convId = `conv_${sorted[0]}_${sorted[1]}`;

  if (!db.conversations[convId]) {
    db.conversations[convId] = {
      id: convId,
      isGroup: false,
      name: accA.displayName,
      avatarUrl: accA.avatarUrl,
      participantIds: [userA, userB],
      createdAt: Date.now(),
      unreadCount: 0,
    };
  }

  if (!db.userConversations[userA]) db.userConversations[userA] = [];
  if (!db.userConversations[userA].includes(convId)) db.userConversations[userA].unshift(convId);

  if (!db.userConversations[userB]) db.userConversations[userB] = [];
  if (!db.userConversations[userB].includes(convId)) db.userConversations[userB].unshift(convId);

  saveDatabase();

  // Notify sender that request was accepted
  broadcastSSE(
    {
      type: 'FRIEND_REQUEST_ACCEPTED',
      senderId: cleanId(currentUser?.id || userB),
      senderName: currentUser?.displayName || accB.displayName,
      senderAvatar: currentUser?.avatarUrl || accB.avatarUrl,
      recipientId: userA,
      payload: { friendId: userB, friendName: accB.displayName, conversationId: convId },
      timestamp: Date.now(),
    },
    userA
  );

  const newFriendObj = db.friends[userB]?.find((f) => cleanId(f.id) === userA) || {
    id: userA,
    displayName: accA.displayName,
  };

  res.json({ success: true, newFriend: newFriendObj });
});

// Remove friend
app.post('/api/friends/remove', (req, res) => {
  const { userId, friendId } = req.body;
  const uId = cleanId(userId);
  const fId = cleanId(friendId);

  if (db.friends[uId]) {
    db.friends[uId] = db.friends[uId].filter((f) => cleanId(f.id) !== fId);
  }
  if (db.friends[fId]) {
    db.friends[fId] = db.friends[fId].filter((f) => cleanId(f.id) !== uId);
  }

  saveDatabase();
  res.json({ success: true });
});

// ==========================================
// REAL-TIME SIGNALING & CALLING API
// ==========================================

// Online users query
app.get('/api/signal/online', (req, res) => {
  const onlineUsers = Array.from(activeClients.keys()).filter(
    (k) => (activeClients.get(k)?.size || 0) > 0
  );
  res.json({ onlineUsers });
});

// SSE Signaling Stream: /api/signal/stream?userId=...
app.get('/api/signal/stream', (req, res) => {
  const rawUserId = (req.query.userId as string) || '';
  const userId = cleanId(rawUserId);

  if (!userId) {
    res.status(400).json({ error: 'userId query parameter required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Register client
  if (!activeClients.has(userId)) {
    activeClients.set(userId, new Set());
  }
  activeClients.get(userId)!.add(res);

  // Send initial connection ACK
  const initMsg = {
    type: 'SIGNAL_CONNECTED',
    userId,
    timestamp: Date.now(),
  };
  res.write(`data: ${JSON.stringify(initMsg)}\n\n`);

  // Flush any pending unreceived signals immediately
  const pending = pendingSignals.get(userId);
  if (pending && pending.length > 0) {
    pending.forEach((msg) => {
      try {
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
      } catch {}
    });
    pendingSignals.set(userId, []);
  }

  // Broadcast user online status
  broadcastSSE({
    type: 'USER_STATUS',
    senderId: userId,
    payload: { userId, status: 'online' },
    timestamp: Date.now(),
  });

  // Heartbeat ping every 12s to keep proxy connection alive
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(keepAliveInterval);
    }
  }, 12000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    const userSet = activeClients.get(userId);
    if (userSet) {
      userSet.delete(res);
      if (userSet.size === 0) {
        activeClients.delete(userId);
        // Broadcast user offline status
        broadcastSSE({
          type: 'USER_STATUS',
          senderId: userId,
          payload: { userId, status: 'offline' },
          timestamp: Date.now(),
        });
      }
    }
  });
});

// Comprehensive User Delta Sync Endpoint: /api/sync?userId=...
app.get('/api/sync', (req, res) => {
  const userId = cleanId((req.query.userId as string) || '');
  if (!userId) {
    res.status(400).json({ error: 'userId required' });
    return;
  }

  const signals = pendingSignals.get(userId) || [];
  pendingSignals.set(userId, []);

  const convIds = db.userConversations[userId] || [];
  const conversations = convIds.map((id) => db.conversations[id]).filter(Boolean);
  const friends = db.friends[userId] || [];
  const incomingReqs = db.friendRequests.filter(
    (r) => cleanId(r.toUserId) === userId && r.status === 'pending'
  );
  const outgoingReqs = db.friendRequests.filter(
    (r) => cleanId(r.fromUserId) === userId && r.status === 'pending'
  );
  const onlineUsers = Array.from(activeClients.keys()).filter(
    (k) => (activeClients.get(k)?.size || 0) > 0
  );

  res.json({
    signals,
    conversations,
    friends,
    friendRequests: { incoming: incomingReqs, outgoing: outgoingReqs },
    onlineUsers,
    accountsCount: Object.keys(db.accounts).length,
  });
});

// Send Signaling / Calling / WebRTC Message: /api/signal/send
app.post('/api/signal/send', (req, res) => {
  const message = req.body;
  if (!message || !message.type || !message.senderId) {
    res.status(400).json({ error: 'Invalid message payload' });
    return;
  }

  const rawRecipient = message.recipientId || '';
  const recipientId = cleanId(rawRecipient);
  let deliveredCount = 0;

  const eventPayload = `data: ${JSON.stringify(message)}\n\n`;

  if (recipientId && recipientId !== 'broadcast') {
    queueSignalForUser(recipientId, message);
    // Deliver directly to target recipient's devices
    const clientSet = activeClients.get(recipientId);
    if (clientSet && clientSet.size > 0) {
      clientSet.forEach((clientRes) => {
        try {
          clientRes.write(eventPayload);
          if ((clientRes as any).flush) (clientRes as any).flush();
          deliveredCount++;
        } catch {
          clientSet.delete(clientRes);
        }
      });
    }

    // Trigger Web Push Notification so recipient's device rings/alerts even when closed!
    if (message.type === 'CALL_INVITE') {
      const callerName = message.senderName || message.senderId;
      sendPushNotificationToUser(recipientId, {
        type: 'CALL',
        title: `📞 Incoming Call: ${callerName}`,
        body: 'Incoming HD Video Call - Tap to answer',
        icon: '/icons/icon.svg',
        badge: '/icons/icon.svg',
        tag: 'whisprr-call',
        requireInteraction: true,
        vibrate: [500, 200, 500, 200, 500, 200, 800],
        actions: [
          { action: 'answer', title: '📞 Answer Call' },
          { action: 'decline', title: '❌ Decline' },
        ],
        data: {
          url: `/?call=${encodeURIComponent(message.senderId)}&callerName=${encodeURIComponent(callerName)}`,
          callerId: message.senderId,
          callerName,
          callerAvatar: message.senderAvatar,
        },
      }).catch(() => {});
    } else if (message.type === 'CALL_END' || message.type === 'CALL_REJECT') {
      sendPushNotificationToUser(recipientId, {
        type: 'CALL_CANCELLED',
        tag: 'whisprr-call',
      }).catch(() => {});
    }
  } else {
    // Broadcast to all connected clients
    const senderId = cleanId(message.senderId);
    activeClients.forEach((clients, uId) => {
      if (uId !== senderId || message.echoSelf) {
        queueSignalForUser(uId, message);
        clients.forEach((clientRes) => {
          try {
            clientRes.write(eventPayload);
            if ((clientRes as any).flush) (clientRes as any).flush();
            deliveredCount++;
          } catch {
            clients.delete(clientRes);
          }
        });
      }
    });
  }

  res.json({ success: true, deliveredCount });
});

// ==========================================
// WEB PUSH & BACKGROUND MESH API
// ==========================================

// Get VAPID Public Key for client PushManager subscription
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// Register push subscription for a user account
app.post('/api/push/subscribe', (req, res) => {
  const { userId, subscription } = req.body;
  if (!userId || !subscription || !subscription.endpoint) {
    res.status(400).json({ error: 'userId and valid subscription required' });
    return;
  }

  const uId = cleanId(userId);
  if (!db.pushSubscriptions) {
    db.pushSubscriptions = {};
  }
  if (!db.pushSubscriptions[uId]) {
    db.pushSubscriptions[uId] = [];
  }

  // Deduplicate endpoints
  const exists = db.pushSubscriptions[uId].some((s) => s.endpoint === subscription.endpoint);
  if (!exists) {
    db.pushSubscriptions[uId].push(subscription);
    saveDatabase();
  }

  res.json({ success: true, subscribed: true, count: db.pushSubscriptions[uId].length });
});

// Unsubscribe push
app.post('/api/push/unsubscribe', (req, res) => {
  const { userId, endpoint } = req.body;
  const uId = cleanId(userId);
  if (db.pushSubscriptions?.[uId]) {
    db.pushSubscriptions[uId] = db.pushSubscriptions[uId].filter((s) => s.endpoint !== endpoint);
    saveDatabase();
  }
  res.json({ success: true });
});

// Push Test Endpoint
app.post('/api/push/test', async (req, res) => {
  const { userId } = req.body;
  const uId = cleanId(userId);
  await sendPushNotificationToUser(uId, {
    type: 'MESSAGE',
    title: '🔔 Whisprr Mesh Notification',
    body: 'Mesh push notifications are fully active and connected!',
    icon: '/icons/icon.svg',
  });
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Whisprr full-stack signaling and persistent server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
