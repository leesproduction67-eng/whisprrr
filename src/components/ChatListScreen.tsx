import React, { useState } from 'react';
import {
  QrCode,
  UserPlus,
  Users,
  Lock,
  LogOut,
  Search,
  MessageSquarePlus,
  Video,
  Sparkles,
  Shield,
  Circle,
  ChevronRight,
  User,
  Settings,
  Smartphone,
  Download,
} from 'lucide-react';
import { Conversation, Friend, UserAccount } from '../types';
import { Avatar } from './Avatar';

interface ChatListScreenProps {
  currentUser: UserAccount;
  conversations: Conversation[];
  friends: Friend[];
  pendingRequestsCount?: number;
  onSelectConversation: (conv: Conversation) => void;
  onOpenProfile: () => void;
  onOpenQRCode: () => void;
  onOpenFriends: () => void;
  onOpenCreateGroup: () => void;
  onOpenInstall?: () => void;
  onOpenWhispy: () => void;
  onLockApp: () => void;
  onLogout: () => void;
  onStartVideoCall: (targetPeerId: string, targetName: string) => void;
  peerConnected: boolean;
  peerId: string;
}

export const ChatListScreen: React.FC<ChatListScreenProps> = ({
  currentUser,
  conversations,
  friends,
  pendingRequestsCount = 0,
  onSelectConversation,
  onOpenProfile,
  onOpenQRCode,
  onOpenFriends,
  onOpenCreateGroup,
  onOpenInstall,
  onOpenWhispy,
  onLockApp,
  onLogout,
  onStartVideoCall,
  peerConnected,
  peerId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const myId = currentUser.id || currentUser.accountId || '';

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const convName = (c.name || c.title || '').toLowerCase();
    const lastText = (c.lastMessage?.text || '').toLowerCase();
    const participantsList = (c.participantIds || c.participants || []).map((p) => p.toLowerCase());
    return (
      convName.includes(q) ||
      lastText.includes(q) ||
      participantsList.some((p) => p.includes(q))
    );
  });

  return (
    <div id="chat-list-screen" className="flex flex-col h-full bg-[#090b11] text-slate-100">
      {/* Top Header Card with User Profile */}
      <header className="p-4 bg-[#0e111a]/95 backdrop-blur-xl border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between gap-3 mb-3">
          {/* User profile area */}
          <div
            onClick={onOpenProfile}
            className="flex items-center gap-3 min-w-0 p-1.5 -m-1.5 rounded-2xl hover:bg-white/[0.04] transition-all cursor-pointer group flex-1"
          >
            <div className="relative">
              <Avatar
                name={currentUser.displayName}
                url={currentUser.avatarUrl}
                size="lg"
                status="online"
                showChangeOverlay
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-white truncate font-display group-hover:text-pink-300 transition-colors">
                  {currentUser.displayName}
                </h1>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/25 font-mono">
                  ID: @{myId}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate italic">
                "{currentUser.aboutStatus || currentUser.status || 'Whisprring privately ✨'}"
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenWhispy}
              className="relative p-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/25 border border-pink-500/30 transition-all cursor-pointer group shadow-sm"
              title="Whispy AI Assistant"
            >
              <div className="w-5 h-5 rounded-lg overflow-hidden border border-pink-400/50">
                <img src="/whispy.jpg" alt="Whispy" className="w-full h-full object-cover" />
              </div>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#090b11] animate-pulse" />
            </button>

            {onOpenInstall && (
              <button
                onClick={onOpenInstall}
                className="p-2 rounded-xl bg-pink-500/10 hover:bg-pink-500/25 text-pink-400 hover:text-pink-300 border border-pink-500/30 transition-all cursor-pointer shadow-sm"
                title="Install Whisprr / Add to Home Screen"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onOpenQRCode}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-pink-500/20 text-slate-300 hover:text-pink-300 border border-white/5 transition-all cursor-pointer"
              title="My QR Code & Scanner"
            >
              <QrCode className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenFriends}
              className="relative p-2 rounded-xl bg-white/[0.04] hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/5 transition-all cursor-pointer"
              title="Friends & Requests"
            >
              <UserPlus className="w-4 h-4" />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenCreateGroup}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-white/5 transition-all cursor-pointer"
              title="Create Group Chat"
            >
              <Users className="w-4 h-4" />
            </button>

            <button
              onClick={onLockApp}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-pink-500/20 text-slate-400 hover:text-pink-300 border border-white/5 transition-all cursor-pointer"
              title="Lock Whisprr"
            >
              <Lock className="w-4 h-4" />
            </button>

            <button
              onClick={onLogout}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/5 transition-all cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-time Status Ribbon */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                peerConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300">
              {peerConnected ? 'Peer Mesh Active' : 'Connecting Mesh...'}
            </span>
          </div>
          <span className="font-mono text-[10px] text-pink-300/80 truncate max-w-[140px]">
            {peerId || `@${myId}`}
          </span>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-2.5 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations, friends, or groups..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5">
        {/* Pinned Whispy AI Companion Card */}
        <div
          onClick={onOpenWhispy}
          className="p-3 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-cyan-500/5 hover:from-pink-500/20 hover:to-purple-500/15 border border-pink-500/25 hover:border-pink-500/40 transition-all cursor-pointer group relative overflow-hidden shadow-lg shadow-pink-500/5 mb-2"
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-pink-500/50 shadow-md shadow-pink-500/25 bg-slate-900 group-hover:scale-105 transition-transform">
                <img
                  src="/whispy.jpg"
                  alt="Whispy"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#090b11] animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h4 className="text-sm font-bold text-white font-display group-hover:text-pink-300 transition-colors truncate flex items-center gap-1">
                    Whispy
                    <Sparkles className="w-3.5 h-3.5 text-pink-400 fill-pink-400 inline shrink-0" />
                  </h4>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/30 shrink-0">
                    AI Assistant
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium shrink-0">
                  Always Online
                </span>
              </div>
              <p className="text-xs text-slate-300 group-hover:text-slate-200 transition-colors truncate">
                Ask anything — coding, homework, ideas, advice & Whisprr! 💬🐾
              </p>
            </div>
          </div>
        </div>

        {filteredConversations.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="w-16 h-16 rounded-3xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mx-auto mb-4">
              <MessageSquarePlus className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold font-display text-white mb-1">
              Welcome to Whisprr.
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mb-6">
              Connect with friends by Account ID, show your QR code, or create a group to start chatting and video calling.
            </p>

            <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
              <button
                onClick={onOpenFriends}
                className="p-3 rounded-2xl bg-white/[0.04] hover:bg-pink-500/15 border border-white/5 hover:border-pink-500/30 text-xs font-semibold text-pink-300 flex flex-col items-center gap-1.5 transition-all cursor-pointer"
              >
                <UserPlus className="w-5 h-5 text-pink-400" />
                <span>Add Friend</span>
              </button>

              <button
                onClick={onOpenQRCode}
                className="p-3 rounded-2xl bg-white/[0.04] hover:bg-cyan-500/15 border border-white/5 hover:border-cyan-500/30 text-xs font-semibold text-cyan-300 flex flex-col items-center gap-1.5 transition-all cursor-pointer"
              >
                <QrCode className="w-5 h-5 text-cyan-400" />
                <span>Show QR Code</span>
              </button>
            </div>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isGroup = conv.isGroup;
            const rawParts = ((conv.participantIds || conv.participants || []) as string[]).filter(Boolean);
            const extractedFromId = conv.id.startsWith('conv_')
              ? conv.id.replace(/^conv_/, '').split('_').filter(Boolean)
              : [];
            const allCandidateParts = Array.from(new Set([...rawParts, ...extractedFromId]));
            const participants = allCandidateParts.map((p) => (p || '').replace(/^whisprr_/, '').trim()).filter(Boolean);

            const myCleanId = (currentUser.id || '').toLowerCase().replace(/^whisprr_/, '').trim();
            const myCleanAcc = (currentUser.accountId || '').toLowerCase().replace(/^whisprr_/, '').trim();

            const recipientFriend = !isGroup
              ? friends.find((f) => {
                  const fid = (f.id || '').toLowerCase().replace(/^whisprr_/, '').trim();
                  const facc = (f.accountId || '').toLowerCase().replace(/^whisprr_/, '').trim();
                  return participants.some((p) => {
                    const cp = p.toLowerCase();
                    return cp === fid || cp === facc;
                  });
                }) || friends.find((f) => f.displayName === conv.name)
              : null;

            const displayName = isGroup
              ? conv.name || conv.title || 'Group Chat'
              : recipientFriend?.displayName || conv.name || conv.title || 'Direct Chat';

            const avatarUrl = isGroup
              ? conv.avatarUrl
              : recipientFriend?.avatarUrl || conv.avatarUrl;

            const lastMsgText = conv.lastMessage
              ? (conv.lastMessage.deletedForEveryone || conv.lastMessage.isDeletedForMe)
                ? 'Message was deleted'
                : conv.lastMessage.mediaUrl
                ? '📸 Photo'
                : conv.lastMessage.text
              : 'No messages yet';

            const lastMsgTime = conv.lastMessage
              ? new Date(conv.lastMessage.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className="p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-pink-500/30 transition-all cursor-pointer flex items-center gap-3 group select-none active:scale-[0.99]"
              >
                <Avatar
                  name={displayName}
                  url={avatarUrl}
                  size="md"
                  status={isGroup ? undefined : 'online'}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate font-display group-hover:text-pink-300 transition-colors">
                        {displayName}
                      </h4>
                      {isGroup && (
                        <span className="px-1.5 py-0.2 rounded-full bg-pink-500/20 text-[9px] font-bold text-pink-300 border border-pink-500/30 shrink-0">
                          GRP
                        </span>
                      )}
                    </div>
                    {lastMsgTime && (
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {lastMsgTime}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] text-slate-400 truncate flex-1">
                      {lastMsgText}
                    </p>

                    {conv.unreadCount && conv.unreadCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-bold min-w-[18px] text-center shadow-sm shadow-pink-500/30 shrink-0">
                        {conv.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Direct video call quick button */}
                {!isGroup && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetPeer =
                        participants.find((p) => {
                          const cp = p.toLowerCase();
                          return cp !== myCleanId && cp !== myCleanAcc;
                        }) ||
                        recipientFriend?.id ||
                        recipientFriend?.accountId;
                      if (targetPeer) {
                        onStartVideoCall(targetPeer, displayName);
                      }
                    }}
                    className="p-2 rounded-xl bg-white/[0.02] hover:bg-pink-500/20 text-slate-400 hover:text-pink-300 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                    title="Call"
                  >
                    <Video className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Quick Action */}
      <div className="p-3 bg-[#0e111a]/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around shrink-0">
        <button
          onClick={onOpenFriends}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-pink-300 transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Contacts</span>
        </button>

        <button
          onClick={onOpenQRCode}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span>My QR</span>
        </button>

        {/* Center Whispy Assistant Button */}
        <button
          onClick={onOpenWhispy}
          className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-pink-400 hover:text-pink-300 transition-colors cursor-pointer group -mt-2"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-pink-400 shadow-md shadow-pink-500/30 group-hover:scale-110 transition-transform bg-slate-900">
              <img src="/whispy.jpg" alt="Whispy" className="w-full h-full object-cover" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#090b11] animate-pulse" />
          </div>
          <span className="flex items-center gap-0.5 text-[10px]">
            Whispy
            <Sparkles className="w-2.5 h-2.5 text-pink-400 fill-pink-400 inline" />
          </span>
        </button>

        <button
          onClick={onOpenCreateGroup}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-purple-300 transition-colors cursor-pointer"
        >
          <Users className="w-4 h-4" />
          <span>New Group</span>
        </button>

        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
};
