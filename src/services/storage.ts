import { UserAccount, Friend, Conversation, Message, FriendRequest } from '../types';
import { ApiService } from './apiService';

const STORAGE_KEYS = {
  CURRENT_USER_ID: 'whisprr_current_user_id',
  ACCOUNTS: 'whisprr_accounts',
  FRIENDS_PREFIX: 'whisprr_friends_',
  CONVERSATIONS_PREFIX: 'whisprr_convs_',
  MESSAGES_PREFIX: 'whisprr_messages_',
  GLOBAL_USERS: 'whisprr_directory',
  FRIEND_REQUESTS: 'whisprr_friend_requests',
};

export const DEFAULT_USER_BIO = "Hey, I'm Here To Whisprr";

export class StorageService {
  public static init() {
    // Sync all accounts from server on startup
    this.syncAllAccountsFromServer();
  }

  // Account management
  public static getAllAccounts(): UserAccount[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static getAccountById(id: string): UserAccount | null {
    if (!id) return null;
    const cleanId = id.trim().toLowerCase();
    const accounts = this.getAllAccounts();
    return accounts.find((a) => a.id.toLowerCase() === cleanId) || null;
  }

  public static saveAccount(account: UserAccount) {
    const accounts = this.getAllAccounts();
    const cleanId = account.id.trim().toLowerCase();
    const normalizedAccount: UserAccount = {
      ...account,
      id: cleanId,
      aboutStatus: account.aboutStatus || account.status || DEFAULT_USER_BIO,
    };
    const index = accounts.findIndex((a) => a.id.toLowerCase() === cleanId);
    if (index >= 0) {
      accounts[index] = normalizedAccount;
    } else {
      accounts.push(normalizedAccount);
    }
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    this.updateGlobalDirectory(normalizedAccount);

    // Register on server database
    ApiService.registerAccount(normalizedAccount).catch(() => {});
  }

  // Search registered accounts across local and server
  public static searchRegisteredAccounts(query: string, currentUserId: string): UserAccount[] {
    const q = query.trim().toLowerCase();
    const accounts = this.getAllAccounts();
    const cleanCurrentId = (currentUserId || '').toLowerCase();
    if (!q) {
      return accounts.filter((a) => a.id.toLowerCase() !== cleanCurrentId);
    }
    return accounts.filter(
      (a) =>
        a.id.toLowerCase() !== cleanCurrentId &&
        (a.id.toLowerCase().includes(q) || a.displayName.toLowerCase().includes(q))
    );
  }

  // Global public directory to resolve friend lookups by Account ID
  public static updateGlobalDirectory(user: UserAccount) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GLOBAL_USERS);
      const directory: Record<string, Partial<UserAccount>> = raw ? JSON.parse(raw) : {};
      directory[user.id.toLowerCase()] = {
        id: user.id.toLowerCase(),
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        aboutStatus: user.aboutStatus || DEFAULT_USER_BIO,
        themeAccent: user.themeAccent,
        customStatusEmoji: user.customStatusEmoji,
      };
      localStorage.setItem(STORAGE_KEYS.GLOBAL_USERS, JSON.stringify(directory));
    } catch (e) {
      console.error(e);
    }
  }

  public static lookupUserInDirectory(id: string): Partial<UserAccount> | null {
    if (!id) return null;
    const cleanId = id.trim().toLowerCase();
    const acc = this.getAccountById(cleanId);
    if (acc) {
      return {
        id: acc.id,
        displayName: acc.displayName,
        avatarUrl: acc.avatarUrl,
        aboutStatus: acc.aboutStatus || DEFAULT_USER_BIO,
        themeAccent: acc.themeAccent,
        customStatusEmoji: acc.customStatusEmoji,
      };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GLOBAL_USERS);
      const directory: Record<string, Partial<UserAccount>> = raw ? JSON.parse(raw) : {};
      const found = directory[cleanId];
      if (found) return found;
      return null;
    } catch {
      return null;
    }
  }

  public static getCurrentUserId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    } catch {
      return null;
    }
  }

  public static setCurrentUserId(id: string | null) {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    }
  }

  public static getCurrentUser(): UserAccount | null {
    const id = this.getCurrentUserId();
    if (!id) return null;
    return this.getAccountById(id);
  }

  // ==========================================
  // FRIEND REQUESTS
  // ==========================================
  public static getAllFriendRequests(): FriendRequest[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FRIEND_REQUESTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static saveAllFriendRequests(requests: FriendRequest[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.FRIEND_REQUESTS, JSON.stringify(requests));
    } catch (e) {
      console.error('Failed to save friend requests:', e);
    }
  }

  public static getIncomingFriendRequests(userId: string): FriendRequest[] {
    const cleanId = userId.toLowerCase();
    return this.getAllFriendRequests().filter(
      (r) => r.toUserId.toLowerCase() === cleanId && r.status === 'pending'
    );
  }

  public static getOutgoingFriendRequests(userId: string): FriendRequest[] {
    const cleanId = userId.toLowerCase();
    return this.getAllFriendRequests().filter(
      (r) => r.fromUserId.toLowerCase() === cleanId && r.status === 'pending'
    );
  }

  public static getFriendshipStatus(
    userId1: string,
    userId2: string
  ): 'none' | 'friends' | 'request_sent' | 'request_received' {
    const cleanId1 = userId1.toLowerCase();
    const cleanId2 = userId2.toLowerCase();
    if (cleanId1 === cleanId2) return 'none';

    // Check if already friends
    const friends = this.getFriends(cleanId1);
    if (friends.some((f) => f.id.toLowerCase() === cleanId2)) {
      return 'friends';
    }

    // Check pending requests
    const allRequests = this.getAllFriendRequests();
    const sentReq = allRequests.find(
      (r) =>
        r.fromUserId.toLowerCase() === cleanId1 &&
        r.toUserId.toLowerCase() === cleanId2 &&
        r.status === 'pending'
    );
    if (sentReq) return 'request_sent';

    const receivedReq = allRequests.find(
      (r) =>
        r.fromUserId.toLowerCase() === cleanId2 &&
        r.toUserId.toLowerCase() === cleanId1 &&
        r.status === 'pending'
    );
    if (receivedReq) return 'request_received';

    return 'none';
  }

  public static sendFriendRequest(
    fromUser: UserAccount,
    toUserId: string
  ): { success: boolean; error?: string; request?: FriendRequest; newFriend?: Friend } {
    const fromId = fromUser.id.toLowerCase();
    const toId = toUserId.trim().toLowerCase();

    if (!toId) {
      return { success: false, error: 'Please enter a valid Account ID.' };
    }

    if (fromId === toId) {
      return { success: false, error: 'You cannot send a friend request to yourself.' };
    }

    const targetAccount = this.getAccountById(toId) || this.lookupUserInDirectory(toId);
    if (!targetAccount) {
      return {
        success: false,
        error: `No account registered with ID "@${toId}". Please check the spelling.`,
      };
    }

    const currentStatus = this.getFriendshipStatus(fromId, toId);
    if (currentStatus === 'friends') {
      return { success: false, error: 'You are already friends with this user.' };
    }
    if (currentStatus === 'request_sent') {
      return { success: false, error: 'Friend request already sent and pending.' };
    }
    if (currentStatus === 'request_received') {
      const receivedReq = this.getAllFriendRequests().find(
        (r) =>
          r.fromUserId.toLowerCase() === toId &&
          r.toUserId.toLowerCase() === fromId &&
          r.status === 'pending'
      );
      if (receivedReq) {
        return this.acceptFriendRequest(receivedReq.id, fromUser);
      }
    }

    const newRequest: FriendRequest = {
      id: `freq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fromUserId: fromUser.id,
      fromUserName: fromUser.displayName,
      fromUserAvatar: fromUser.avatarUrl,
      fromUserBio: fromUser.aboutStatus || DEFAULT_USER_BIO,
      toUserId: targetAccount.id || toId,
      toUserName: targetAccount.displayName,
      toUserAvatar: targetAccount.avatarUrl,
      timestamp: Date.now(),
      status: 'pending',
    };

    const allRequests = this.getAllFriendRequests();
    allRequests.unshift(newRequest);
    this.saveAllFriendRequests(allRequests);

    // Sync to server backend
    ApiService.sendFriendRequest(fromUser, toId).catch(() => {});

    return { success: true, request: newRequest };
  }

  public static acceptFriendRequest(
    requestId: string,
    currentUser: UserAccount
  ): { success: boolean; newFriend?: Friend; request?: FriendRequest; error?: string } {
    const allRequests = this.getAllFriendRequests();
    const reqIndex = allRequests.findIndex((r) => r.id === requestId);
    if (reqIndex < 0) {
      return { success: false, error: 'Friend request not found.' };
    }

    const req = allRequests[reqIndex];
    req.status = 'accepted';
    allRequests[reqIndex] = req;
    this.saveAllFriendRequests(allRequests);

    const otherUserId =
      req.fromUserId.toLowerCase() === currentUser.id.toLowerCase()
        ? req.toUserId
        : req.fromUserId;
    const otherAccount = this.getAccountById(otherUserId) || this.lookupUserInDirectory(otherUserId);

    // 1. Add other user as friend to current user
    const friendForCurrent: Friend = {
      id: otherAccount?.id || otherUserId,
      displayName: otherAccount?.displayName || req.fromUserName || otherUserId,
      avatarUrl: otherAccount?.avatarUrl || req.fromUserAvatar,
      aboutStatus: otherAccount?.aboutStatus || req.fromUserBio || DEFAULT_USER_BIO,
      addedAt: Date.now(),
      status: 'online',
      customStatusEmoji: otherAccount?.customStatusEmoji || '✨',
    };
    this.addFriend(currentUser.id, friendForCurrent);

    // 2. Add current user as friend to other user (bilateral)
    const friendForOther: Friend = {
      id: currentUser.id,
      displayName: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl,
      aboutStatus: currentUser.aboutStatus || DEFAULT_USER_BIO,
      addedAt: Date.now(),
      status: 'online',
      customStatusEmoji: currentUser.customStatusEmoji || '✨',
    };
    this.addFriend(otherUserId, friendForOther);

    // 3. Establish direct conversation for both
    this.getOrCreateDirectConversation(currentUser.id, friendForCurrent);
    this.getOrCreateDirectConversation(otherUserId, friendForOther);

    // Sync to server
    ApiService.acceptFriendRequest(requestId, currentUser).catch(() => {});

    return { success: true, newFriend: friendForCurrent, request: req };
  }

  public static declineFriendRequest(requestId: string, currentUserId: string): boolean {
    const allRequests = this.getAllFriendRequests();
    const reqIndex = allRequests.findIndex((r) => r.id === requestId);
    if (reqIndex >= 0) {
      allRequests.splice(reqIndex, 1);
      this.saveAllFriendRequests(allRequests);
      return true;
    }
    return false;
  }

  public static cancelFriendRequest(requestId: string, fromUserId: string): boolean {
    const allRequests = this.getAllFriendRequests();
    const reqIndex = allRequests.findIndex(
      (r) => r.id === requestId && r.fromUserId.toLowerCase() === fromUserId.toLowerCase()
    );
    if (reqIndex >= 0) {
      allRequests.splice(reqIndex, 1);
      this.saveAllFriendRequests(allRequests);
      return true;
    }
    return false;
  }

  // ==========================================
  // FRIENDS MANAGEMENT
  // ==========================================
  public static getFriends(userId: string): Friend[] {
    try {
      const key = `${STORAGE_KEYS.FRIENDS_PREFIX}${userId.toLowerCase()}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static saveFriends(userId: string, friends: Friend[]) {
    try {
      const key = `${STORAGE_KEYS.FRIENDS_PREFIX}${userId.toLowerCase()}`;
      localStorage.setItem(key, JSON.stringify(friends));
    } catch (e) {
      console.error('Failed to save friends:', e);
    }
  }

  public static addFriend(userId: string, friend: Friend): boolean {
    const friends = this.getFriends(userId);
    if (friends.some((f) => f.id.toLowerCase() === friend.id.toLowerCase())) {
      return false;
    }
    friends.unshift(friend);
    this.saveFriends(userId, friends);
    return true;
  }

  public static removeFriend(userId: string, friendId: string) {
    const friends = this.getFriends(userId);
    const updated = friends.filter((f) => f.id.toLowerCase() !== friendId.toLowerCase());
    this.saveFriends(userId, updated);
    ApiService.removeFriend(userId, friendId).catch(() => {});
  }

  // ==========================================
  // CONVERSATIONS & BILATERAL MESSAGING
  // ==========================================
  public static getConversations(userId: string): Conversation[] {
    try {
      const key = `${STORAGE_KEYS.CONVERSATIONS_PREFIX}${userId.toLowerCase()}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static saveConversations(userId: string, conversations: Conversation[]) {
    try {
      const key = `${STORAGE_KEYS.CONVERSATIONS_PREFIX}${userId.toLowerCase()}`;
      localStorage.setItem(key, JSON.stringify(conversations));
    } catch (e) {
      console.error('Failed to save conversations:', e);
    }
  }

  public static getConversationById(userId: string, convId: string): Conversation | null {
    const convs = this.getConversations(userId);
    return convs.find((c) => c.id === convId) || null;
  }

  public static getOrCreateDirectConversation(userId: string, targetFriend: Friend): Conversation {
    const cleanUser = userId.toLowerCase();
    const cleanTarget = targetFriend.id.toLowerCase();
    const sortedIds = [cleanUser, cleanTarget].sort();
    const convId = `conv_${sortedIds[0]}_${sortedIds[1]}`;

    // Ensure for current user
    const convs = this.getConversations(cleanUser);
    let conv = convs.find((c) => c.id === convId);

    if (!conv) {
      conv = {
        id: convId,
        isGroup: false,
        name: targetFriend.displayName,
        avatarUrl: targetFriend.avatarUrl,
        participantIds: [cleanUser, cleanTarget],
        createdAt: Date.now(),
        unreadCount: 0,
      };
      convs.unshift(conv);
      this.saveConversations(cleanUser, convs);
    }

    // Also ensure conversation exists in recipient's conversation list
    const recipientUser = this.getAccountById(cleanUser);
    if (recipientUser) {
      const targetConvs = this.getConversations(cleanTarget);
      if (!targetConvs.some((c) => c.id === convId)) {
        targetConvs.unshift({
          id: convId,
          isGroup: false,
          name: recipientUser.displayName,
          avatarUrl: recipientUser.avatarUrl,
          participantIds: [cleanUser, cleanTarget],
          createdAt: Date.now(),
          unreadCount: 0,
        });
        this.saveConversations(cleanTarget, targetConvs);
      }
    }

    return conv;
  }

  public static saveOrUpdateConversation(userId: string, conversation: Conversation) {
    const cleanUserId = userId.toLowerCase();
    const convs = this.getConversations(cleanUserId);
    const index = convs.findIndex((c) => c.id === conversation.id);
    if (index >= 0) {
      convs[index] = conversation;
    } else {
      convs.unshift(conversation);
    }
    convs.sort((a, b) => {
      const timeA = a.lastMessage?.timestamp || a.createdAt;
      const timeB = b.lastMessage?.timestamp || b.createdAt;
      return timeB - timeA;
    });
    this.saveConversations(cleanUserId, convs);
  }

  // Bilateral delivery of message to both sender, recipient, and server
  public static deliverDirectMessage(
    sender: UserAccount,
    recipientId: string,
    convId: string,
    message: Message
  ) {
    const cleanSenderId = sender.id.toLowerCase();
    const cleanRecipientId = recipientId.toLowerCase();

    // 1. Save message to conversation messages
    this.addMessage(convId, message);

    // 2. Update sender's conversation
    const senderConvs = this.getConversations(cleanSenderId);
    let senderConv = senderConvs.find((c) => c.id === convId);
    if (senderConv) {
      senderConv.lastMessage = message;
      this.saveOrUpdateConversation(cleanSenderId, senderConv);
    } else {
      const recipientAcc = this.getAccountById(cleanRecipientId) || this.lookupUserInDirectory(cleanRecipientId);
      const newSenderConv: Conversation = {
        id: convId,
        isGroup: false,
        name: recipientAcc?.displayName || cleanRecipientId,
        avatarUrl: recipientAcc?.avatarUrl,
        participantIds: [cleanSenderId, cleanRecipientId],
        createdAt: Date.now(),
        lastMessage: message,
        unreadCount: 0,
      };
      this.saveOrUpdateConversation(cleanSenderId, newSenderConv);
    }

    // 3. Update recipient's conversation list
    const recipientConvs = this.getConversations(cleanRecipientId);
    let recipientConv = recipientConvs.find((c) => c.id === convId);
    if (recipientConv) {
      recipientConv.lastMessage = message;
      recipientConv.unreadCount = (recipientConv.unreadCount || 0) + 1;
      this.saveOrUpdateConversation(cleanRecipientId, recipientConv);
    } else {
      const newRecipientConv: Conversation = {
        id: convId,
        isGroup: false,
        name: sender.displayName,
        avatarUrl: sender.avatarUrl,
        participantIds: [cleanSenderId, cleanRecipientId],
        createdAt: Date.now(),
        lastMessage: message,
        unreadCount: 1,
      };
      this.saveOrUpdateConversation(cleanRecipientId, newRecipientConv);
    }

    // 4. Send to server backend for persistent storage & real-time delivery
    ApiService.sendMessage({
      sender,
      recipientId: cleanRecipientId,
      conversationId: convId,
      message,
      isGroup: false,
    }).catch(() => {});
  }

  // Delivery of group message
  public static deliverGroupMessage(
    sender: UserAccount,
    groupConv: Conversation,
    message: Message
  ) {
    this.addMessage(groupConv.id, message);

    const participants = groupConv.participantIds || [];
    participants.forEach((participantId) => {
      const cleanParticipant = participantId.toLowerCase();
      const userConvs = this.getConversations(cleanParticipant);
      let conv = userConvs.find((c) => c.id === groupConv.id);
      if (conv) {
        conv.lastMessage = message;
        if (cleanParticipant !== sender.id.toLowerCase()) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }
        this.saveOrUpdateConversation(cleanParticipant, conv);
      } else {
        const newConv: Conversation = {
          ...groupConv,
          lastMessage: message,
          unreadCount: cleanParticipant !== sender.id.toLowerCase() ? 1 : 0,
        };
        this.saveOrUpdateConversation(cleanParticipant, newConv);
      }
    });

    ApiService.sendMessage({
      sender,
      conversationId: groupConv.id,
      message,
      isGroup: true,
    }).catch(() => {});
  }

  // ==========================================
  // MESSAGES
  // ==========================================
  public static getMessages(convId: string): Message[] {
    try {
      const key = `${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static saveMessages(convId: string, messages: Message[]) {
    try {
      const key = `${STORAGE_KEYS.MESSAGES_PREFIX}${convId}`;
      localStorage.setItem(key, JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save messages:', e);
    }
  }

  public static addMessage(convId: string, message: Message) {
    const messages = this.getMessages(convId);
    const existingIndex = messages.findIndex((m) => m.id === message.id);
    if (existingIndex >= 0) {
      messages[existingIndex] = { ...messages[existingIndex], ...message };
    } else {
      messages.push(message);
    }
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    this.saveMessages(convId, messages);
  }

  public static deleteMessage(convId: string, messageId: string, senderId: string = '') {
    const messages = this.getMessages(convId);
    const updated = messages.map((m) => {
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
    this.saveMessages(convId, updated);
    ApiService.deleteMessage(convId, messageId, senderId).catch(() => {});
  }

  public static burnViewOnceMessage(convId: string, messageId: string, viewerId: string = '') {
    const messages = this.getMessages(convId);
    const updated = messages.map((m) => {
      if (m.id === messageId) {
        return {
          ...m,
          mediaUrl: undefined, // permanently destroyed
          isViewed: true,
          viewedAt: Date.now(),
        };
      }
      return m;
    });
    this.saveMessages(convId, updated);
    ApiService.burnViewOnceMessage(convId, messageId, viewerId).catch(() => {});
  }

  // Sync all registered accounts bidirectionally between local storage and server
  public static async syncAllAccountsFromServer(): Promise<UserAccount[]> {
    try {
      const localAccounts = this.getAllAccounts();
      if (localAccounts.length > 0) {
        // Send our local accounts so the server remembers them
        await ApiService.syncBatchAccounts(localAccounts);
      }
      // Fetch full set from server
      const serverAccounts = await ApiService.getAllAccounts();
      if (serverAccounts && serverAccounts.length > 0) {
        const map = new Map<string, UserAccount>();
        localAccounts.forEach((a) => map.set(a.id.toLowerCase(), a));
        serverAccounts.forEach((a) => map.set(a.id.toLowerCase(), a));
        const merged = Array.from(map.values());
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(merged));
        return merged;
      }
    } catch {}
    return this.getAllAccounts();
  }

  // Fetch full conversation sync from server
  public static async syncUserDataFromServer(userId: string) {
    try {
      const cleanUser = userId.toLowerCase();
      const [remoteFriends, reqs, remoteConvs] = await Promise.all([
        ApiService.getFriends(cleanUser),
        ApiService.getFriendRequests(cleanUser),
        ApiService.getConversations(cleanUser),
      ]);

      if (remoteFriends && remoteFriends.length > 0) {
        const localFriends = this.getFriends(cleanUser);
        const map = new Map<string, Friend>();
        localFriends.forEach((f) => map.set(f.id.toLowerCase(), f));
        remoteFriends.forEach((f) => map.set(f.id.toLowerCase(), f));
        this.saveFriends(cleanUser, Array.from(map.values()));
      }

      if (reqs && (reqs.incoming.length > 0 || reqs.outgoing.length > 0)) {
        const allLocal = this.getAllFriendRequests();
        const map = new Map<string, FriendRequest>();
        allLocal.forEach((r) => map.set(r.id, r));
        reqs.incoming.forEach((r) => map.set(r.id, r));
        reqs.outgoing.forEach((r) => map.set(r.id, r));
        this.saveAllFriendRequests(Array.from(map.values()));
      }

      if (remoteConvs && remoteConvs.length > 0) {
        const localConvs = this.getConversations(cleanUser);
        const map = new Map<string, Conversation>();
        localConvs.forEach((c) => map.set(c.id, c));
        remoteConvs.forEach((c) => map.set(c.id, c));
        this.saveConversations(cleanUser, Array.from(map.values()));

        // Also sync messages for each conversation
        for (const conv of remoteConvs) {
          try {
            const remoteMsgs = await ApiService.getMessages(conv.id);
            if (remoteMsgs && remoteMsgs.length > 0) {
              const localMsgs = this.getMessages(conv.id);
              const msgMap = new Map<string, Message>();
              localMsgs.forEach((m) => msgMap.set(m.id, m));
              remoteMsgs.forEach((m) => msgMap.set(m.id, m));
              const mergedMsgs = Array.from(msgMap.values()).sort((a, b) => a.timestamp - b.timestamp);
              this.saveMessages(conv.id, mergedMsgs);
            }
          } catch {}
        }
      }
    } catch {}
  }
}
