export type AccentColor = 'pink' | 'cyan' | 'purple' | 'emerald';

export interface UserAccount {
  id: string; // unique account ID e.g. "vesper_99"
  accountId?: string; // alias for id
  displayName: string;
  passcode: string;
  email?: string;
  phone?: string;
  avatarUrl?: string; // empty string or url/base64
  aboutStatus?: string;
  status?: string; // alias for aboutStatus
  createdAt: number;
  themeAccent?: AccentColor;
  customStatusEmoji?: string;
  isAppLocked?: boolean;
  appLockEnabled?: boolean; // alias for isAppLocked
  appLockPasscode?: string;
  autoLockMinutes?: number;
}

export interface Friend {
  id: string; // matches account ID
  accountId?: string; // alias
  displayName: string;
  avatarUrl?: string;
  aboutStatus?: string;
  statusText?: string;
  addedAt: number;
  isFavorite?: boolean;
  status?: 'online' | 'away' | 'offline';
  lastSeen?: number;
  customStatusEmoji?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  text?: string;
  mediaUrl?: string; // base64 or image URL
  mediaType?: 'image' | 'video' | 'none';
  isViewOnce?: boolean;
  isViewed?: boolean;
  viewedAt?: number;
  timestamp: number;
  readBy?: string[];
  status?: 'sent' | 'delivered' | 'read';
  deletedForEveryone?: boolean;
  isDeletedForMe?: boolean;
  deletedForMe?: boolean;
}

export interface Conversation {
  id: string;
  isGroup: boolean;
  name?: string;
  title?: string; // alias
  avatarUrl?: string;
  description?: string;
  participantIds?: string[];
  participants?: string[]; // alias
  adminIds?: string[];
  createdAt: number;
  lastMessage?: Message;
  unreadCount?: number;
  messages?: Message[];
}

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connected'
  | 'ended'
  | 'rejected'
  | 'busy'
  | 'failed';

export interface CallState {
  isActive: boolean;
  isIncoming: boolean;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  calleeId: string;
  calleeName?: string;
  calleeAvatar?: string;
  isVideo: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  connectedAt?: number;
  callStatus: CallStatus;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  fromUserBio?: string;
  toUserId: string;
  toUserName?: string;
  toUserAvatar?: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'declined';
}

export type RealtimePayloadType =
  | 'CHAT_MESSAGE'
  | 'DELETE_MESSAGE'
  | 'VIEW_ONCE_OPENED'
  | 'VIEW_ONCE_BURNED'
  | 'TYPING'
  | 'TYPING_START'
  | 'TYPING_STOP'
  | 'USER_STATUS'
  | 'CALL_INVITE'
  | 'CALL_ACCEPT'
  | 'CALL_REJECT'
  | 'CALL_END'
  | 'WEBRTC_OFFER'
  | 'WEBRTC_ANSWER'
  | 'WEBRTC_ICE'
  | 'SYNC_STATE'
  | 'GROUP_CREATED'
  | 'FRIEND_REQUEST_SENT'
  | 'FRIEND_REQUEST_ACCEPTED'
  | 'FRIEND_REQUEST_DECLINED';

export interface RealtimeMessage {
  type: RealtimePayloadType;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  recipientId?: string; // target user or 'broadcast'
  conversationId?: string;
  payload: any;
  timestamp: number;
}
