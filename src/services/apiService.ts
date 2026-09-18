import { UserAccount, Friend, Conversation, Message, FriendRequest } from '../types';

export class ApiService {
  // Accounts
  public static async registerAccount(account: UserAccount): Promise<UserAccount | null> {
    try {
      const res = await fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.account || account;
    } catch {
      return null;
    }
  }

  public static async getSuggestedAccounts(excludeUserId?: string, search?: string): Promise<UserAccount[]> {
    try {
      const params = new URLSearchParams();
      if (excludeUserId) params.set('exclude', excludeUserId);
      if (search) params.set('q', search);

      const res = await fetch(`/api/accounts/suggested?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.accounts || [];
    } catch {
      return [];
    }
  }

  public static async getAllAccounts(): Promise<UserAccount[]> {
    try {
      const res = await fetch('/api/accounts');
      if (!res.ok) return [];
      const data = await res.json();
      return data.accounts || [];
    } catch {
      return [];
    }
  }

  public static async getAccount(userId: string): Promise<UserAccount | null> {
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(userId)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.account || null;
    } catch {
      return null;
    }
  }

  // Conversations
  public static async getConversations(userId: string): Promise<Conversation[]> {
    try {
      const res = await fetch(`/api/conversations?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.conversations || [];
    } catch {
      return [];
    }
  }

  // Messages
  public static async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const res = await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.messages || [];
    } catch {
      return [];
    }
  }

  public static async sendMessage(params: {
    sender: UserAccount;
    recipientId?: string;
    conversationId: string;
    message: Message;
    isGroup?: boolean;
  }): Promise<boolean> {
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async deleteMessage(conversationId: string, messageId: string, senderId: string): Promise<boolean> {
    try {
      const res = await fetch('/api/messages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, messageId, senderId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async burnViewOnceMessage(conversationId: string, messageId: string, viewerId: string): Promise<boolean> {
    try {
      const res = await fetch('/api/messages/view-once-burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, messageId, viewerId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Friends & Requests
  public static async getFriends(userId: string): Promise<Friend[]> {
    try {
      const res = await fetch(`/api/friends?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.friends || [];
    } catch {
      return [];
    }
  }

  public static async getFriendRequests(userId: string): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> {
    try {
      const res = await fetch(`/api/friends/requests?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return { incoming: [], outgoing: [] };
      const data = await res.json();
      return { incoming: data.incoming || [], outgoing: data.outgoing || [] };
    } catch {
      return { incoming: [], outgoing: [] };
    }
  }

  public static async sendFriendRequest(fromUser: UserAccount, toUserId: string): Promise<{ success: boolean; request?: FriendRequest; error?: string }> {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUser, toUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to send request' };
      }
      return { success: true, request: data.request };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  public static async acceptFriendRequest(requestId: string, currentUser: UserAccount): Promise<{ success: boolean; newFriend?: Friend; error?: string }> {
    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, currentUser }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to accept request' };
      }
      return { success: true, newFriend: data.newFriend };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  public static async removeFriend(userId: string, friendId: string): Promise<boolean> {
    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, friendId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Batch sync local accounts to server & receive full global list
  public static async syncBatchAccounts(accounts: UserAccount[]): Promise<UserAccount[]> {
    try {
      const res = await fetch('/api/accounts/sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.accounts || [];
    } catch {
      return [];
    }
  }

  // Periodic delta sync for signals, conversations, friends, and requests
  public static async syncUserDelta(userId: string): Promise<{
    signals?: any[];
    conversations?: Conversation[];
    friends?: Friend[];
    friendRequests?: { incoming: FriendRequest[]; outgoing: FriendRequest[] };
    onlineUsers?: string[];
    accountsCount?: number;
  } | null> {
    try {
      const res = await fetch(`/api/sync?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  public static async getOnlineUsers(): Promise<string[]> {
    try {
      const res = await fetch('/api/signal/online');
      if (!res.ok) return [];
      const data = await res.json();
      return data.onlineUsers || [];
    } catch {
      return [];
    }
  }

  // Whispy AI Chat
  public static async askWhispy(message: string, history: Array<{ role: string; text: string }>): Promise<string> {
    try {
      const res = await fetch('/api/whispy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.reply) {
          return data.reply;
        }
      }
    } catch (networkErr) {
      console.warn('Network error talking to Whispy endpoint:', networkErr);
    }

    return "Hey! I'm Whispy, your little AI sidekick! 🐾✨ I'm right here with you. What would you like to explore, code, or solve together today?";
  }
}
