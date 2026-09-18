import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Lock, Shield, PhoneCall } from 'lucide-react';
import {
  UserAccount,
  Friend,
  Conversation,
  Message,
  CallState,
  RealtimeMessage,
} from './types';
import { StorageService } from './services/storage';
import { ApiService } from './services/apiService';
import { peerService, createSimulatedVideoStream, getHighQualityMediaStream } from './services/peerService';
import { SoundEffects } from './services/sound';
import { pushService } from './services/pushService';

// Components
import { AuthModal } from './components/AuthModal';
import { ChatListScreen } from './components/ChatListScreen';
import { ChatScreen } from './components/ChatScreen';
import { ProfileModal } from './components/ProfileModal';
import { QRCodeModal } from './components/QRCodeModal';
import { FriendsModal } from './components/FriendsModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { VideoCallModal } from './components/VideoCallModal';
import { AppLockOverlay } from './components/AppLockOverlay';
import { ForgotPasscodeModal } from './components/ForgotPasscodeModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { MessageDeleteModal } from './components/MessageDeleteModal';
import { IncomingNotificationBanner, InAppNotification } from './components/IncomingNotificationBanner';
import { InstallPWAModal } from './components/InstallPWAModal';
import { WhispyModal } from './components/WhispyModal';

export default function App() {
  // App initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Authentication & Current User
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(false);

  // Navigation & Active Chat
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [inAppNotification, setInAppNotification] = useState<InAppNotification | null>(null);

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [qrModalInitialTab, setQrModalInitialTab] = useState<'my-code' | 'scan'>('my-code');
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showForgotPasscodeModal, setShowForgotPasscodeModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showWhispyModal, setShowWhispyModal] = useState(false);
  const [inspectedFriendForProfile, setInspectedFriendForProfile] = useState<Friend | null>(null);

  // Message Delete Modal
  const [selectedMessageForDelete, setSelectedMessageForDelete] = useState<Message | null>(null);
  const [showMessageDeleteModal, setShowMessageDeleteModal] = useState(false);

  // Peer & Realtime state
  const [peerReady, setPeerReady] = useState(false);
  const [peerId, setPeerId] = useState<string>('');

  // Video Call State
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    isIncoming: false,
    callerId: '',
    callerName: '',
    calleeId: '',
    isVideo: true,
    isMuted: false,
    isVideoEnabled: true,
    callStatus: 'idle',
  });

  const callStateRef = useRef<CallState>(callState);
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const activeMediaCallRef = useRef<any>(null);
  const [messagesVersion, setMessagesVersion] = useState(0);
  const [typingUsers, setTypingUsers] = useState<{
    [conversationId: string]: { userId: string; userName: string; timestamp: number };
  }>({});

  // 1. Initial Load & Setup
  useEffect(() => {
    StorageService.init();
    StorageService.syncAllAccountsFromServer().catch(() => {});
    const storedUser = StorageService.getCurrentUser();

    if (storedUser) {
      setCurrentUser(storedUser);
      if (storedUser.isAppLocked) {
        setIsAppLocked(true);
      }
      loadUserData(storedUser.id);
      pushService.autoSubscribeIfGranted(storedUser.id).catch(() => {});
    } else {
      setShowAuthModal(true);
    }

    // Deep link inspection from PWA launch or Push Notification click
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const chatParam = searchParams.get('chat');
      const callParam = searchParams.get('call');
      const callerNameParam = searchParams.get('callerName');
      const autoAnswer = searchParams.get('autoAnswer');

      if (chatParam) {
        setActiveConversationId(chatParam);
      }

      if (callParam && storedUser) {
        setCallState({
          isActive: true,
          isIncoming: true,
          callerId: callParam,
          callerName: callerNameParam || callParam,
          calleeId: storedUser.id,
          calleeName: storedUser.displayName,
          isVideo: true,
          isMuted: false,
          isVideoEnabled: true,
          callStatus: 'ringing',
        });
        if (autoAnswer === 'true') {
          setTimeout(() => {
            acceptIncomingCall(true);
          }, 600);
        }
      }
    } catch {}

    // Listen for Service Worker Notification click events (Background Push Wake-up)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NOTIFICATION_CLICKED') {
          const { action, data } = event.data;
          if (data?.conversationId) {
            setActiveConversationId(data.conversationId);
          }
          if (action === 'answer' && data?.callerId && storedUser) {
            setCallState({
              isActive: true,
              isIncoming: true,
              callerId: data.callerId,
              callerName: data.callerName || data.callerId,
              calleeId: storedUser.id,
              calleeName: storedUser.displayName,
              isVideo: true,
              isMuted: false,
              isVideoEnabled: true,
              callStatus: 'ringing',
            });
            setTimeout(() => {
              acceptIncomingCall(true);
            }, 300);
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    // Splash timeout
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
      setIsInitialized(true);
    }, 1200);

    return () => clearTimeout(splashTimer);
  }, []);

  // Flashing tab title for incoming call awareness on laptop/desktop
  useEffect(() => {
    if (
      callState.isActive &&
      callState.isIncoming &&
      (callState.callStatus === 'ringing' || callState.callStatus === 'calling')
    ) {
      const originalTitle = document.title;
      const callerName = callState.callerName || 'Someone';
      let toggle = false;
      const interval = setInterval(() => {
        document.title = toggle ? `🔔 Incoming Call: ${callerName}...` : `📞 Whisprr Calling...`;
        toggle = !toggle;
      }, 800);
      return () => {
        clearInterval(interval);
        document.title = 'Whisprr';
      };
    }
  }, [callState.isActive, callState.isIncoming, callState.callStatus, callState.callerName]);

  // Sync across open browser tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (currentUser && e.key && e.key.startsWith('whisprr_')) {
        loadUserData(currentUser.id);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser]);

  // 2. Load User Data (Conversations, Friends & Friend Requests)
  const loadUserData = (userId: string) => {
    const cleanId = userId.toLowerCase();
    const userFriends = StorageService.getFriends(cleanId);
    const userConvs = StorageService.getConversations(cleanId);
    const incomingReqs = StorageService.getIncomingFriendRequests(cleanId);

    setFriends(userFriends);
    setConversations(userConvs);
    setPendingRequestsCount(incomingReqs.length);

    // Sync remote data in background
    StorageService.syncUserDataFromServer(cleanId).then(() => {
      setFriends(StorageService.getFriends(cleanId));
      setConversations(StorageService.getConversations(cleanId));
      setPendingRequestsCount(StorageService.getIncomingFriendRequests(cleanId).length);
      setMessagesVersion((v) => v + 1);
    }).catch(() => {});
  };

  // 3. Connect to PeerJS when User changes
  useEffect(() => {
    if (currentUser) {
      peerService.initialize(currentUser);

      const checkPeerTimer = setInterval(() => {
        const id = peerService.getPeerId();
        if (id) {
          setPeerId(id);
          setPeerReady(peerService.getIsReady());
        }
      }, 500);

      // Listen for incoming messages and events
      const unsubscribeMsg = peerService.onMessage(handleRealtimeMessage);

      // Listen for incoming WebRTC calls via PeerJS
      const unsubscribeCall = peerService.onIncomingCall(handleIncomingMediaCall);

      // Listen for native WebRTC remote streams (fires when other device starts transmitting camera)
      const unsubscribeRemoteStream = peerService.onRemoteStream((remoteStreamObj: MediaStream) => {
        SoundEffects.stopRing();
        SoundEffects.playCallConnected();
        setRemoteStream(remoteStreamObj);
        setCallState((prev) => ({
          ...prev,
          callStatus: 'connected',
          connectedAt: prev.connectedAt || Date.now(),
        }));
      });

      return () => {
        clearInterval(checkPeerTimer);
        unsubscribeMsg();
        unsubscribeCall();
        unsubscribeRemoteStream();
      };
    } else {
      peerService.destroy();
      setPeerReady(false);
      setPeerId('');
    }
  }, [currentUser]);

  // Active conversation real-time sync loop (guarantees both sent and received messages are seen instantly)
  useEffect(() => {
    if (!currentUser || !activeConversationId) return;

    let isMounted = true;
    const syncActiveChat = async () => {
      try {
        const remoteMsgs = await ApiService.getMessages(activeConversationId);
        if (isMounted && remoteMsgs && Array.isArray(remoteMsgs) && remoteMsgs.length > 0) {
          const localMsgs = StorageService.getMessages(activeConversationId);
          const msgMap = new Map<string, Message>();
          localMsgs.forEach((m) => msgMap.set(m.id, m));
          remoteMsgs.forEach((m) => msgMap.set(m.id, m));
          const merged = Array.from(msgMap.values()).sort((a, b) => a.timestamp - b.timestamp);

          if (merged.length !== localMsgs.length || JSON.stringify(merged) !== JSON.stringify(localMsgs)) {
            StorageService.saveMessages(activeConversationId, merged);
            setMessagesVersion((v) => v + 1);
          }
        }
      } catch {}
    };

    // Immediate sync
    syncActiveChat();

    // Fast polling while active in chat
    const interval = setInterval(syncActiveChat, 1200);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser, activeConversationId]);

  // 4. Handle Realtime Message Events
  const handleRealtimeMessage = (msg: RealtimeMessage) => {
    if (!currentUser) return;

    switch (msg.type) {
      case 'CHAT_MESSAGE': {
        const incomingMsg = msg.payload as Message;
        if (!incomingMsg) return;

        const isSelf = msg.senderId.toLowerCase() === currentUser.id.toLowerCase();

        // Save incoming/sent message directly to storage
        StorageService.addMessage(incomingMsg.conversationId, incomingMsg);

        // Update conversation in current user's list
        const currentConvs = StorageService.getConversations(currentUser.id);
        let targetConv = currentConvs.find((c) => c.id === incomingMsg.conversationId);

        if (targetConv) {
          targetConv.lastMessage = incomingMsg;
          if (activeConversationId !== targetConv.id && !isSelf) {
            targetConv.unreadCount = (targetConv.unreadCount || 0) + 1;
          }
          StorageService.saveOrUpdateConversation(currentUser.id, targetConv);
        } else {
          // New conversation from sender
          const senderAcc = StorageService.lookupUserInDirectory(msg.senderId);
          const newConv: Conversation = {
            id: incomingMsg.conversationId,
            isGroup: false,
            name: msg.senderName || senderAcc?.displayName || msg.senderId,
            avatarUrl: msg.senderAvatar || senderAcc?.avatarUrl,
            participantIds: [currentUser.id.toLowerCase(), msg.senderId.toLowerCase()],
            createdAt: Date.now(),
            lastMessage: incomingMsg,
            unreadCount: (activeConversationId === incomingMsg.conversationId || isSelf) ? 0 : 1,
          };
          StorageService.saveOrUpdateConversation(currentUser.id, newConv);
        }

        loadUserData(currentUser.id);
        setMessagesVersion((v) => v + 1);

        if (!isSelf) {
          SoundEffects.playReceive();

          // Clear typing indicator for this conversation upon message arrival
          setTypingUsers((prev) => {
            if (!prev[incomingMsg.conversationId]) return prev;
            const next = { ...prev };
            delete next[incomingMsg.conversationId];
            return next;
          });

          // Show banner notification if not viewing this active chat
          if (activeConversationId !== incomingMsg.conversationId) {
            setInAppNotification({
              id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              type: 'message',
              title: 'New Message',
              senderId: msg.senderId,
              senderName: msg.senderName || msg.senderId,
              senderAvatar: msg.senderAvatar,
              messageText: incomingMsg.text || (incomingMsg.mediaUrl ? '📷 Sent a photo' : 'Sent a message'),
              conversationId: incomingMsg.conversationId,
              timestamp: Date.now(),
            });
          }
        }
        break;
      }

      case 'TYPING_START':
      case 'TYPING': {
        const convId = msg.conversationId || msg.payload?.conversationId;
        const isSelf = msg.senderId.toLowerCase() === currentUser.id.toLowerCase();
        if (convId && !isSelf) {
          setTypingUsers((prev) => ({
            ...prev,
            [convId]: {
              userId: msg.senderId,
              userName: msg.senderName || msg.senderId,
              timestamp: Date.now(),
            },
          }));
        }
        break;
      }

      case 'TYPING_STOP': {
        const convId = msg.conversationId || msg.payload?.conversationId;
        if (convId) {
          setTypingUsers((prev) => {
            if (!prev[convId]) return prev;
            const next = { ...prev };
            delete next[convId];
            return next;
          });
        }
        break;
      }

      case 'FRIEND_REQUEST_SENT': {
        if (msg.recipientId?.toLowerCase() === currentUser.id.toLowerCase()) {
          loadUserData(currentUser.id);
          SoundEffects.playReceive();
          setInAppNotification({
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            type: 'friend_request',
            title: 'Friend Request',
            senderId: msg.senderId,
            senderName: msg.senderName || msg.senderId,
            senderAvatar: msg.senderAvatar,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'FRIEND_REQUEST_ACCEPTED': {
        if (msg.recipientId?.toLowerCase() === currentUser.id.toLowerCase()) {
          loadUserData(currentUser.id);
          SoundEffects.playSend();
        }
        break;
      }

      case 'DELETE_MESSAGE': {
        const { conversationId, messageId } = msg.payload || {};
        if (conversationId && messageId) {
          StorageService.deleteMessage(conversationId, messageId);
          loadUserData(currentUser.id);
          SoundEffects.playPop();
        }
        break;
      }

      case 'VIEW_ONCE_BURNED': {
        const { conversationId, messageId, viewerId } = msg.payload || {};
        if (conversationId && messageId) {
          StorageService.burnViewOnceMessage(conversationId, messageId, viewerId);
          loadUserData(currentUser.id);
          setMessagesVersion((v) => v + 1);
        }
        break;
      }

      case 'CALL_INVITE': {
        const cleanRecipient = (msg.recipientId || '').toLowerCase().replace(/^whisprr_/, '').trim();
        const currentCleanId = (currentUser.id || '').toLowerCase().replace(/^whisprr_/, '').trim();
        const currentCleanAcc = (currentUser.accountId || '').toLowerCase().replace(/^whisprr_/, '').trim();

        if (cleanRecipient === currentCleanId || (currentCleanAcc && cleanRecipient === currentCleanAcc)) {
          SoundEffects.stopRing();
          SoundEffects.playRing();
          const callerName = msg.senderName || msg.senderId;
          setCallState({
            isActive: true,
            isIncoming: true,
            callerId: msg.senderId,
            callerName,
            callerAvatar: msg.senderAvatar,
            calleeId: currentUser.id,
            calleeName: currentUser.displayName,
            isVideo: msg.payload?.isVideo ?? true,
            isMuted: false,
            isVideoEnabled: true,
            callStatus: 'ringing',
          });

          // In-app Notification Banner Toast with quick actions
          setInAppNotification({
            id: `call_${Date.now()}_${msg.senderId}`,
            type: 'call',
            title: 'Incoming Video Call',
            senderId: msg.senderId,
            senderName: callerName,
            senderAvatar: msg.senderAvatar,
            isVideoCall: msg.payload?.isVideo ?? true,
            timestamp: Date.now(),
          });

          // Show browser desktop notification on laptop
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const notif = new Notification(`📞 Incoming Call from ${callerName}`, {
                body: 'Incoming HD Video Call - Click to answer on Whisprr',
                icon: msg.senderAvatar || '/icons/icon.svg',
                tag: 'incoming-call',
                requireInteraction: true,
              });
              notif.onclick = () => {
                window.focus();
                notif.close();
              };
            } catch {}
          }
        }
        break;
      }

      case 'CALL_ACCEPT': {
        const cleanRecipient = (msg.recipientId || '').toLowerCase().replace(/^whisprr_/, '').trim();
        const currentCleanId = (currentUser.id || '').toLowerCase().replace(/^whisprr_/, '').trim();
        const currentCleanAcc = (currentUser.accountId || '').toLowerCase().replace(/^whisprr_/, '').trim();
        const currentCall = callStateRef.current;

        if (
          cleanRecipient === currentCleanId ||
          (currentCleanAcc && cleanRecipient === currentCleanAcc) ||
          (currentCall.isActive && !currentCall.isIncoming)
        ) {
          SoundEffects.stopRing();
          SoundEffects.playCallConnected();
          setCallState((prev) => ({
            ...prev,
            callStatus: 'connected',
            connectedAt: prev.connectedAt || Date.now(),
          }));
        }
        break;
      }

      case 'CALL_REJECT': {
        const cleanRecipient = (msg.recipientId || '').toLowerCase().replace(/^whisprr_/, '');
        const currentClean = currentUser.id.toLowerCase().replace(/^whisprr_/, '');
        const currentCall = callStateRef.current;

        if (cleanRecipient === currentClean || (currentCall.isActive && !currentCall.isIncoming)) {
          SoundEffects.stopRing();
          SoundEffects.playCallEnd();
          setInAppNotification((prev) => (prev?.type === 'call' ? null : prev));
          if (localStream) {
            try {
              localStream.getTracks().forEach((track) => track.stop());
            } catch {}
            setLocalStream(null);
          }
          if (remoteStream) {
            try {
              remoteStream.getTracks().forEach((track) => track.stop());
            } catch {}
            setRemoteStream(null);
          }
          setCallState((prev) => ({
            ...prev,
            callStatus: 'rejected',
          }));
          setTimeout(() => {
            endCurrentCall(false);
          }, 2000);
        }
        break;
      }

      case 'CALL_END': {
        const cleanRecipient = (msg.recipientId || '').toLowerCase().replace(/^whisprr_/, '');
        const currentClean = currentUser.id.toLowerCase().replace(/^whisprr_/, '');
        const currentCall = callStateRef.current;

        if (cleanRecipient === currentClean || currentCall.isActive) {
          SoundEffects.stopRing();
          SoundEffects.playCallEnd();
          setInAppNotification((prev) => (prev?.type === 'call' ? null : prev));
          if (localStream) {
            try {
              localStream.getTracks().forEach((track) => track.stop());
            } catch {}
            setLocalStream(null);
          }
          if (remoteStream) {
            try {
              remoteStream.getTracks().forEach((track) => track.stop());
            } catch {}
            setRemoteStream(null);
          }
          setCallState((prev) => ({
            ...prev,
            callStatus: 'ended',
          }));
          setTimeout(() => {
            endCurrentCall(false);
          }, 1500);
        }
        break;
      }

      case 'USER_STATUS': {
        const { userId, status } = msg.payload || {};
        if (userId && status) {
          setFriends((prev) =>
            prev.map((f) => (f.id.toLowerCase() === userId.toLowerCase() ? { ...f, status } : f))
          );
        }
        break;
      }
    }
  };

  // 5. Handle Incoming WebRTC Call
  const handleIncomingMediaCall = (mediaConnection: any) => {
    activeMediaCallRef.current = mediaConnection;

    const callerId = (mediaConnection.metadata?.callerId || mediaConnection.peer || '').replace(/^whisprr_/, '');
    const callerName = mediaConnection.metadata?.callerName || callerId;
    const callerAvatar = mediaConnection.metadata?.callerAvatar;
    const isVideo = mediaConnection.metadata?.isVideo ?? true;

    // Immediately trigger incoming ringtone on called device
    SoundEffects.stopRing();
    SoundEffects.playRing();

    // Show incoming call interface
    setCallState({
      isActive: true,
      isIncoming: true,
      callerId,
      callerName,
      callerAvatar,
      calleeId: currentUser?.id || '',
      calleeName: currentUser?.displayName || '',
      isVideo,
      isMuted: false,
      isVideoEnabled: true,
      callStatus: 'ringing',
    });

    // Also trigger instant in-app banner
    setInAppNotification({
      id: `call_${Date.now()}_${callerId}`,
      type: 'call',
      title: 'Incoming Video Call',
      senderId: callerId,
      senderName: callerName,
      senderAvatar: callerAvatar,
      isVideoCall: isVideo,
      timestamp: Date.now(),
    });

    mediaConnection.on('stream', (remoteStreamObj: MediaStream) => {
      SoundEffects.stopRing();
      SoundEffects.playCallConnected();
      setRemoteStream(remoteStreamObj);
      setCallState((prev) => ({
        ...prev,
        callStatus: 'connected',
        connectedAt: Date.now(),
      }));
    });

    mediaConnection.on('close', () => {
      if (callStateRef.current.callStatus !== 'connected') {
        endCurrentCall(false);
      }
    });

    mediaConnection.on('error', (err: any) => {
      console.warn('PeerJS incoming error (ignored for native WebRTC):', err);
    });
  };

  // 6. User Auth Success Handler
  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setShowAuthModal(false);
    loadUserData(user.id);
    if (user.isAppLocked) {
      setIsAppLocked(true);
    }
    SoundEffects.playSend();
  };

  // 7. Messaging actions (Bilateral multi-account synchronization)
  const handleSendMessage = (text: string, mediaUrl?: string, isViewOnce?: boolean) => {
    if (!currentUser || !activeConversationId) return;

    const currentConv = conversations.find((c) => c.id === activeConversationId);
    if (!currentConv) return;

    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      text: text.trim(),
      mediaUrl: mediaUrl,
      mediaType: mediaUrl ? 'image' : 'none',
      isViewOnce: isViewOnce || false,
      isViewed: false,
      timestamp: Date.now(),
      readBy: [currentUser.id],
    };

    // Save and deliver bilaterally
    let otherParticipantId = '';
    if (currentConv.isGroup) {
      StorageService.deliverGroupMessage(currentUser, currentConv, newMessage);
    } else {
      otherParticipantId = currentConv.participantIds.find(
        (id) => id.toLowerCase() !== currentUser.id.toLowerCase()
      ) || '';
      StorageService.deliverDirectMessage(currentUser, otherParticipantId, activeConversationId, newMessage);
    }

    loadUserData(currentUser.id);
    setMessagesVersion((v) => v + 1);
    SoundEffects.playSend();

    // Broadcast message across real-time mesh to recipient tabs/peers
    peerService.broadcastMessage({
      type: 'CHAT_MESSAGE',
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      recipientId: otherParticipantId || undefined,
      conversationId: activeConversationId,
      payload: newMessage,
      timestamp: Date.now(),
    });
  };

  // Burn / Destroy View-Once image after viewing
  const handleBurnViewOnce = (messageId: string) => {
    if (!currentUser || !activeConversationId) return;

    StorageService.burnViewOnceMessage(activeConversationId, messageId, currentUser.id);
    loadUserData(currentUser.id);
    setMessagesVersion((v) => v + 1);

    // Broadcast burn event across real-time mesh
    peerService.broadcastMessage({
      type: 'VIEW_ONCE_BURNED',
      senderId: currentUser.id,
      conversationId: activeConversationId,
      payload: {
        conversationId: activeConversationId,
        messageId,
        viewerId: currentUser.id,
      },
      timestamp: Date.now(),
    });
  };

  // Broadcast typing signal via PeerJS/real-time mesh
  const handleSendTypingSignal = (isTyping: boolean) => {
    if (!currentUser || !activeConversationId) return;

    const currentConv =
      conversations.find((c) => c.id === activeConversationId) ||
      StorageService.getConversationById(currentUser.id, activeConversationId);

    let otherParticipantId = '';
    if (currentConv && !currentConv.isGroup && currentConv.participantIds) {
      otherParticipantId =
        currentConv.participantIds.find(
          (id) => id.toLowerCase() !== currentUser.id.toLowerCase()
        ) || '';
    }

    peerService.broadcastMessage({
      type: isTyping ? 'TYPING_START' : 'TYPING_STOP',
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      recipientId: otherParticipantId || undefined,
      conversationId: activeConversationId,
      payload: {
        isTyping,
        conversationId: activeConversationId,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
      },
      timestamp: Date.now(),
    });
  };

  // 8. Delete Message Action
  const handleDeleteForEveryone = (messageId: string) => {
    if (!currentUser || !activeConversationId) return;

    StorageService.deleteMessage(activeConversationId, messageId);
    loadUserData(currentUser.id);
    setMessagesVersion((v) => v + 1);
    SoundEffects.playPop();

    // Broadcast delete event
    peerService.broadcastMessage({
      type: 'DELETE_MESSAGE',
      senderId: currentUser.id,
      conversationId: activeConversationId,
      payload: { conversationId: activeConversationId, messageId },
      timestamp: Date.now(),
    });
  };

  const handleDeleteForMe = (messageId: string) => {
    if (!currentUser || !activeConversationId) return;

    const messages = StorageService.getMessages(activeConversationId);
    const updated = messages.map((m) => {
      if (m.id === messageId) {
        return { ...m, isDeletedForMe: true };
      }
      return m;
    });
    StorageService.saveMessages(activeConversationId, updated);
    loadUserData(currentUser.id);
    setMessagesVersion((v) => v + 1);
    SoundEffects.playPop();
  };

  // 9. Video Call Triggering & Controls
  const startVideoCall = async (targetPeerId: string, targetName: string) => {
    if (!currentUser) return;

    const cleanTargetId = (targetPeerId || '').toLowerCase().replace(/^whisprr_/, '').trim();
    if (!cleanTargetId) return;

    SoundEffects.stopRing();
    SoundEffects.playRing();

    setCallState({
      isActive: true,
      isIncoming: false,
      callerId: currentUser.id,
      callerName: currentUser.displayName,
      callerAvatar: currentUser.avatarUrl,
      calleeId: cleanTargetId,
      calleeName: targetName,
      isVideo: true,
      isMuted: false,
      isVideoEnabled: true,
      callStatus: 'calling',
    });

    // Send FAST immediate signal alert so laptop starts ringing instantly!
    peerService.broadcastMessage({
      type: 'CALL_INVITE',
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatarUrl,
      recipientId: cleanTargetId,
      payload: { isVideo: true, earlyAlert: true },
      timestamp: Date.now(),
    });

    let stream: MediaStream;
    try {
      stream = await getHighQualityMediaStream(true);
    } catch (err) {
      console.warn('Camera/Microphone physical device fallback:', err);
      stream = createSimulatedVideoStream(currentUser.displayName, currentUser.avatarUrl);
    }

    setLocalStream(stream);

    // 1. Native WebRTC Call with HD tracks and SDP offer sent via CALL_INVITE
    try {
      await peerService.startNativeCall(cleanTargetId, stream);
    } catch (e) {
      console.warn('Native start call error:', e);
    }

    // 2. PeerJS secondary fallback
    const mediaCall = peerService.callPeer(cleanTargetId, stream);
    if (mediaCall) {
      activeMediaCallRef.current = mediaCall;
      mediaCall.on('stream', (remoteStreamObj: MediaStream) => {
        SoundEffects.stopRing();
        SoundEffects.playCallConnected();
        setRemoteStream(remoteStreamObj);
        setCallState((prev) => ({
          ...prev,
          callStatus: 'connected',
          connectedAt: Date.now(),
        }));
      });
      mediaCall.on('close', () => {
        if (callStateRef.current.callStatus !== 'connected') {
          endCurrentCall(false);
        }
      });
      mediaCall.on('error', (err: any) => {
        console.warn('PeerJS outgoing error (ignored for native WebRTC):', err);
      });
    }
  };

  const acceptIncomingCall = async (withVideo: boolean) => {
    SoundEffects.stopRing();
    SoundEffects.playCallConnected();

    let stream: MediaStream;
    try {
      stream = await getHighQualityMediaStream(withVideo);
    } catch (e) {
      console.warn('Could not get local stream for answer, using simulated:', e);
      stream = createSimulatedVideoStream(currentUser?.displayName || 'User', currentUser?.avatarUrl);
    }

    setLocalStream(stream);

    if (callState.callerId) {
      // 1. Native WebRTC answer with HD tracks and SDP answer sent via CALL_ACCEPT
      try {
        await peerService.answerNativeCall(callState.callerId, stream);
      } catch (err) {
        console.warn('Native answer call error:', err);
      }
    }

    // 2. PeerJS fallback answer
    if (activeMediaCallRef.current) {
      try {
        activeMediaCallRef.current.answer(stream);
      } catch (err) {
        console.warn('Error answering media call:', err);
      }
    }

    setCallState((prev) => ({
      ...prev,
      callStatus: 'connected',
      connectedAt: Date.now(),
      isVideoEnabled: withVideo,
    }));
  };

  const rejectIncomingCall = () => {
    SoundEffects.stopRing();
    SoundEffects.playCallEnd();

    if (currentUser && callState.callerId) {
      peerService.broadcastMessage({
        type: 'CALL_REJECT',
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        recipientId: callState.callerId,
        payload: {},
        timestamp: Date.now(),
      });
    }

    peerService.endCall(false);

    if (activeMediaCallRef.current) {
      try {
        activeMediaCallRef.current.close();
      } catch {}
      activeMediaCallRef.current = null;
    }

    endCurrentCall(false);
  };

  const endCurrentCall = (notifyPeer: boolean = true) => {
    SoundEffects.stopRing();
    if (notifyPeer && currentUser) {
      const targetId = callState.isIncoming ? callState.callerId : callState.calleeId;
      if (targetId) {
        peerService.broadcastMessage({
          type: 'CALL_END',
          senderId: currentUser.id,
          senderName: currentUser.displayName,
          recipientId: targetId,
          payload: {},
          timestamp: Date.now(),
        });
      }
    }

    peerService.endCall(notifyPeer);

    if (activeMediaCallRef.current) {
      try {
        activeMediaCallRef.current.close();
      } catch {}
      activeMediaCallRef.current = null;
    }

    if (localStream) {
      try {
        localStream.getTracks().forEach((track) => track.stop());
      } catch {}
      setLocalStream(null);
    }

    if (remoteStream) {
      try {
        remoteStream.getTracks().forEach((track) => track.stop());
      } catch {}
      setRemoteStream(null);
    }

    setInAppNotification((prev) => (prev?.type === 'call' ? null : prev));

    setCallState({
      isActive: false,
      isIncoming: false,
      callerId: '',
      callerName: '',
      calleeId: '',
      isVideo: true,
      isMuted: false,
      isVideoEnabled: true,
      callStatus: 'idle',
    });
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setCallState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setCallState((prev) => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }));
  };

  // 10. Start chat with a friend
  const handleStartChatWithFriend = (friend: Friend) => {
    if (!currentUser) return;
    const conv = StorageService.getOrCreateDirectConversation(currentUser.id, friend);
    loadUserData(currentUser.id);
    setActiveConversationId(conv.id);
  };

  // 11. Handle QR Code Scan result (Add friend by ID)
  const handleScanResult = async (scannedAccountId: string) => {
    if (!currentUser) return;
    const cleanId = scannedAccountId.trim().toLowerCase();

    if (cleanId === currentUser.id.toLowerCase()) {
      alert("That's your own Account ID!");
      return;
    }

    let found = StorageService.lookupUserInDirectory(cleanId);
    if (!found) {
      try {
        const remoteAcc = await ApiService.getAccount(cleanId);
        if (remoteAcc) {
          StorageService.updateGlobalDirectory(remoteAcc);
          found = remoteAcc;
        }
      } catch {}
    }

    const newFriend: Friend = {
      id: cleanId,
      displayName: found?.displayName || cleanId.charAt(0).toUpperCase() + cleanId.slice(1),
      avatarUrl: found?.avatarUrl || undefined,
      aboutStatus: found?.aboutStatus || 'Connected via Whisprr',
      addedAt: Date.now(),
      status: 'online',
    };

    StorageService.addFriend(currentUser.id, newFriend);
    loadUserData(currentUser.id);
    handleStartChatWithFriend(newFriend);
  };

  // Active conversation object
  const activeConversation = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId) ||
      (currentUser ? StorageService.getConversationById(currentUser.id, activeConversationId) : null) || {
        id: activeConversationId,
        isGroup: false,
        name: 'Direct Chat',
        participantIds: [],
        createdAt: Date.now(),
        unreadCount: 0,
      }
    : null;

  // Active conversation messages
  const activeMessages = useMemo(() => {
    return activeConversationId ? StorageService.getMessages(activeConversationId) : [];
  }, [activeConversationId, messagesVersion, conversations]);

  return (
    <div
      id="whisprr-app-root"
      className="w-full h-screen bg-[#07090e] flex items-center justify-center p-0 sm:p-4 selection:bg-pink-500/30 selection:text-pink-200"
    >
      {/* 440px Compact Mobile App Container Frame */}
      <div className="w-full max-w-[440px] h-full sm:h-[94vh] sm:max-h-[880px] bg-[#090b11] sm:border sm:border-pink-500/20 sm:rounded-[36px] shadow-2xl overflow-hidden relative flex flex-col backdrop-blur-3xl">
        {/* Splash Screen */}
        <AnimatePresence>
          {showSplash && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 z-50 bg-[#07090e] flex flex-col items-center justify-center text-center p-6"
            >
              <div className="relative mb-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 p-[2px] shadow-2xl shadow-pink-500/25 animate-pulse">
                  <div className="w-full h-full bg-[#0a0d16] rounded-3xl flex items-center justify-center">
                    <Sparkles className="w-9 h-9 text-pink-400" />
                  </div>
                </div>
              </div>

              <h1 className="text-3xl font-bold font-display tracking-tight bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
                Whisprr.
              </h1>
              <p className="text-xs text-slate-400 mt-2 font-medium tracking-wide">
                Decentralized Private Messaging & Video
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Screen Routing: Chat List vs Active Chat */}
        {currentUser && !activeConversationId && (
          <ChatListScreen
            currentUser={currentUser}
            conversations={conversations}
            friends={friends}
            pendingRequestsCount={pendingRequestsCount}
            onSelectConversation={(conv) => {
              setActiveConversationId(conv.id);
              // Clear unread badge
              if (conv.unreadCount) {
                conv.unreadCount = 0;
                StorageService.saveOrUpdateConversation(currentUser.id, conv);
                loadUserData(currentUser.id);
              }
            }}
            onOpenProfile={() => setShowProfileModal(true)}
            onOpenQRCode={() => {
              setQrModalInitialTab('my-code');
              setShowQRCodeModal(true);
            }}
            onOpenFriends={() => setShowFriendsModal(true)}
            onOpenCreateGroup={() => setShowCreateGroupModal(true)}
            onOpenInstall={() => setShowInstallModal(true)}
            onOpenWhispy={() => setShowWhispyModal(true)}
            onLockApp={() => setIsAppLocked(true)}
            onLogout={() => setShowLogoutModal(true)}
            onStartVideoCall={(targetPeerId, targetName) => {
              startVideoCall(targetPeerId, targetName);
            }}
            peerConnected={peerReady}
            peerId={peerId}
          />
        )}

        {currentUser && activeConversation && (
          <ChatScreen
            conversation={{
              ...activeConversation,
              messages: activeMessages,
            }}
            currentUser={currentUser}
            onBack={() => setActiveConversationId(null)}
            onSendMessage={handleSendMessage}
            onDeleteMessage={(msg) => {
              setSelectedMessageForDelete(msg);
              setShowMessageDeleteModal(true);
            }}
            onStartVideoCall={(targetPeerId, targetName) => {
              startVideoCall(targetPeerId, targetName);
            }}
            peerConnected={peerReady}
            friendsList={friends}
            onOpenProfile={() => setShowProfileModal(true)}
            typingUser={activeConversationId ? typingUsers[activeConversationId] : null}
            onTyping={handleSendTypingSignal}
            onBurnViewOnce={handleBurnViewOnce}
            onOpenWhispy={() => setShowWhispyModal(true)}
          />
        )}

        {/* App Lock Screen Overlay */}
        {currentUser && (
          <AppLockOverlay
            currentUser={currentUser}
            isLocked={isAppLocked}
            onUnlock={() => setIsAppLocked(false)}
            onForgotPasscode={() => setShowForgotPasscodeModal(true)}
          />
        )}

        {/* Authentication Modal */}
        {showAuthModal && (
          <AuthModal onLoginSuccess={handleLoginSuccess} />
        )}

        {/* Profile Settings Modal */}
        {currentUser && showProfileModal && (
          <ProfileModal
            user={currentUser}
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            onOpenInstall={() => setShowInstallModal(true)}
            onUpdateUser={(updated) => {
              setCurrentUser(updated);
              loadUserData(updated.id);
            }}
          />
        )}

        {/* QR Code Modal (My Code / Scan) */}
        {currentUser && showQRCodeModal && (
          <QRCodeModal
            currentUser={currentUser}
            isOpen={showQRCodeModal}
            initialTab={qrModalInitialTab}
            onClose={() => setShowQRCodeModal(false)}
            onScanResult={handleScanResult}
          />
        )}

        {/* Friends & Contacts Management Modal */}
        {currentUser && showFriendsModal && (
          <FriendsModal
            currentUser={currentUser}
            friends={friends}
            isOpen={showFriendsModal}
            onClose={() => {
              setShowFriendsModal(false);
              setInspectedFriendForProfile(null);
            }}
            onStartChat={handleStartChatWithFriend}
            onStartCall={(friend) => {
              startVideoCall(friend.id, friend.displayName);
            }}
            onAddFriendSuccess={(newFriend) => {
              loadUserData(currentUser.id);
            }}
            onRemoveFriend={(friendId) => {
              StorageService.removeFriend(currentUser.id, friendId);
              loadUserData(currentUser.id);
            }}
            onOpenQRScanner={() => {
              setQrModalInitialTab('scan');
              setShowQRCodeModal(true);
            }}
            selectedFriendForProfile={inspectedFriendForProfile}
          />
        )}

        {/* Create Group Chat Modal */}
        {currentUser && showCreateGroupModal && (
          <CreateGroupModal
            currentUser={currentUser}
            friends={friends}
            isOpen={showCreateGroupModal}
            onClose={() => setShowCreateGroupModal(false)}
            onGroupCreated={(newGroup) => {
              loadUserData(currentUser.id);
              setActiveConversationId(newGroup.id);
            }}
          />
        )}

        {/* Video Call Modal (Incoming / Active / Connected) */}
        {currentUser && (
          <VideoCallModal
            currentUser={currentUser}
            callState={callState}
            onAcceptCall={acceptIncomingCall}
            onRejectCall={rejectIncomingCall}
            onEndCall={() => endCurrentCall(true)}
            localStream={localStream}
            remoteStream={remoteStream}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
          />
        )}

        {/* Message Delete Modal */}
        <MessageDeleteModal
          message={selectedMessageForDelete}
          isOpen={showMessageDeleteModal}
          onClose={() => {
            setShowMessageDeleteModal(false);
            setSelectedMessageForDelete(null);
          }}
          onDeleteForEveryone={handleDeleteForEveryone}
          onDeleteForMe={handleDeleteForMe}
          isOwnMessage={selectedMessageForDelete?.senderId === currentUser?.id}
        />

        {/* Forgot Passcode Recovery Modal */}
        <ForgotPasscodeModal
          isOpen={showForgotPasscodeModal}
          onClose={() => setShowForgotPasscodeModal(false)}
          defaultAccountId={currentUser?.id}
          onSuccess={(updated) => {
            setCurrentUser(updated);
            setIsAppLocked(false);
            loadUserData(updated.id);
          }}
        />

        {/* Logout Confirmation Modal */}
        {currentUser && (
          <LogoutConfirmModal
            isOpen={showLogoutModal}
            onClose={() => setShowLogoutModal(false)}
            userName={currentUser.displayName}
            onConfirm={() => {
              StorageService.setCurrentUserId(null);
              setCurrentUser(null);
              setActiveConversationId(null);
              setShowAuthModal(true);
            }}
          />
        )}

        {/* PWA Install / Add to Home Screen Modal */}
        <InstallPWAModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
        />

        {/* Whispy AI Assistant Modal */}
        {currentUser && (
          <WhispyModal
            isOpen={showWhispyModal}
            onClose={() => setShowWhispyModal(false)}
            currentUser={currentUser}
          />
        )}

        {/* In-app Notification Banner Toast */}
        <IncomingNotificationBanner
          notification={inAppNotification}
          onDismiss={() => setInAppNotification(null)}
          onOpenChat={(convId) => {
            setActiveConversationId(convId);
            setInAppNotification(null);
          }}
          onOpenRequests={() => {
            setShowFriendsModal(true);
            setInAppNotification(null);
          }}
          onAcceptCall={() => {
            setInAppNotification(null);
            acceptIncomingCall(true);
          }}
          onDeclineCall={() => {
            setInAppNotification(null);
            rejectIncomingCall();
          }}
        />
      </div>
    </div>
  );
}
