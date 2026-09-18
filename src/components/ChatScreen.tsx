import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Video,
  Send,
  Image as ImageIcon,
  Smile,
  MoreVertical,
  Trash2,
  Lock,
  Check,
  CheckCheck,
  X,
  Shield,
  Search,
  Flame,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { Conversation, Message, UserAccount, Friend } from '../types';
import { Avatar } from './Avatar';
import { SoundEffects } from '../services/sound';
import { ViewOnceModal } from './ViewOnceModal';

interface ChatScreenProps {
  conversation: Conversation;
  currentUser: UserAccount;
  onBack: () => void;
  onSendMessage: (text: string, mediaUrl?: string, isViewOnce?: boolean) => void;
  onDeleteMessage: (message: Message) => void;
  onStartVideoCall: (targetPeerId: string, targetName: string) => void;
  peerConnected: boolean;
  friendsList: Friend[];
  onOpenProfile: () => void;
  typingUser?: { userId: string; userName: string; timestamp: number } | null;
  onTyping?: (isTyping: boolean) => void;
  onBurnViewOnce?: (messageId: string) => void;
  onOpenWhispy?: () => void;
}

const QUICK_EMOJIS = ['❤️', '✨', '🔥', '😂', '👍', '🤫', '🌙', '🎉'];

export const ChatScreen: React.FC<ChatScreenProps> = ({
  conversation,
  currentUser,
  onBack,
  onSendMessage,
  onDeleteMessage,
  onStartVideoCall,
  peerConnected,
  friendsList,
  onOpenProfile,
  typingUser,
  onTyping,
  onBurnViewOnce,
  onOpenWhispy,
}) => {
  const [inputText, setInputText] = useState('');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isViewOnceMode, setIsViewOnceMode] = useState(false);
  const [activeViewOnceMsg, setActiveViewOnceMsg] = useState<Message | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<string | null>(null);
  const [isTypingActive, setIsTypingActive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<{ [key: string]: number }>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastRef = useRef<number>(0);

  const isGroup = conversation.isGroup;
  const myId = currentUser.id || currentUser.accountId || '';
  const myCleanId = (currentUser.id || '').toLowerCase().replace(/^whisprr_/, '').trim();
  const myCleanAcc = (currentUser.accountId || '').toLowerCase().replace(/^whisprr_/, '').trim();

  // Resiliently extract participants from participantIds, participants array, or conversation ID
  const rawParts = ((conversation.participantIds || conversation.participants || []) as string[]).filter(Boolean);
  const extractedFromId = conversation.id.startsWith('conv_')
    ? conversation.id.replace(/^conv_/, '').split('_').filter(Boolean)
    : [];
  const allCandidateParts = Array.from(new Set([...rawParts, ...extractedFromId]));
  const participants = allCandidateParts.map((p) => (p || '').replace(/^whisprr_/, '').trim()).filter(Boolean);

  // Find recipient friend if direct chat
  const recipientFriend = !isGroup
    ? friendsList.find((f) => {
        const fid = (f.id || '').toLowerCase().replace(/^whisprr_/, '').trim();
        const facc = (f.accountId || '').toLowerCase().replace(/^whisprr_/, '').trim();
        return participants.some((p) => {
          const cp = p.toLowerCase();
          return cp === fid || cp === facc;
        });
      }) || friendsList.find((f) => f.displayName === conversation.name)
    : null;

  // Track incoming typing indicator freshness
  useEffect(() => {
    if (!typingUser) {
      setIsTypingActive(false);
      return;
    }

    const elapsed = Date.now() - (typingUser.timestamp || 0);
    if (elapsed < 3500) {
      setIsTypingActive(true);
      const timer = setTimeout(() => {
        setIsTypingActive(false);
      }, 3500 - elapsed);
      return () => clearTimeout(timer);
    } else {
      setIsTypingActive(false);
    }
  }, [typingUser]);

  // Clean up typing broadcast on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onTyping?.(false);
    };
  }, []);

  const headerTitle = isGroup
    ? conversation.name || conversation.title || 'Group Chat'
    : recipientFriend?.displayName || conversation.name || conversation.title || 'Direct Chat';

  const headerAvatar = isGroup
    ? conversation.avatarUrl
    : recipientFriend?.avatarUrl || conversation.avatarUrl;

  const headerStatus = isGroup
    ? `${participants.length} members`
    : recipientFriend?.status || (peerConnected ? 'Active now' : 'End-to-End Encrypted');

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !mediaPreview) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping?.(false);
    lastBroadcastRef.current = 0;

    onSendMessage(inputText.trim(), mediaPreview || undefined, isViewOnceMode && !!mediaPreview);
    setInputText('');
    setMediaPreview(null);
    setIsViewOnceMode(false);
    setShowEmojiPicker(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    const now = Date.now();
    if (val.trim().length > 0) {
      // Throttle broadcast of TYPING_START
      if (now - lastBroadcastRef.current > 1500) {
        onTyping?.(true);
        lastBroadcastRef.current = now;
      }

      // Reset inactivity timeout (sends TYPING_STOP after 2500ms of inactivity)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
        lastBroadcastRef.current = 0;
      }, 2500);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onTyping?.(false);
      lastBroadcastRef.current = 0;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setMediaPreview(event.target.result);
        setIsViewOnceMode(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Double-tap handler for message deletion
  const handleMessageTap = (msg: Message) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[msg.id] || 0;
    if (now - lastTap < 320) {
      // Double tap detected!
      SoundEffects.playPop();
      onDeleteMessage(msg);
      lastTapRef.current[msg.id] = 0;
    } else {
      lastTapRef.current[msg.id] = now;
    }
  };

  const messagesList = conversation.messages || [];
  const filteredMessages = messagesList.filter((m) => {
    if (m.deletedForMe || m.isDeletedForMe) return false;
    if (!searchQuery) return true;
    return m.text?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div id="chat-screen" className="flex flex-col h-full bg-[#090b11] text-slate-100 relative">
      {/* Chat Header */}
      <header className="px-4 py-3 bg-[#0e111a]/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onBack}
            className="p-2 -ml-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
            onClick={() => setShowDetails(!showDetails)}
          >
            <Avatar
              name={headerTitle}
              url={headerAvatar}
              size="md"
              status={isGroup ? undefined : peerConnected ? 'online' : 'away'}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-white truncate font-display group-hover:text-pink-300 transition-colors">
                  {headerTitle}
                </h2>
                {isGroup && (
                  <span className="px-1.5 py-0.2 rounded-full bg-pink-500/20 text-[9px] font-bold text-pink-300 border border-pink-500/30">
                    GRP
                  </span>
                )}
              </div>
              {isTypingActive ? (
                <div className="text-[11px] text-pink-400 font-medium flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="animate-pulse">
                    {isGroup ? `${typingUser?.userName || 'Someone'} is typing...` : 'typing...'}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                  {headerStatus}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Video Call button (Only direct chats) */}
          {!isGroup && (
            <button
              onClick={() => {
                const targetPeer =
                  participants.find((p) => {
                    const cp = p.toLowerCase();
                    return cp !== myCleanId && cp !== myCleanAcc;
                  }) ||
                  recipientFriend?.id ||
                  recipientFriend?.accountId;
                if (targetPeer) {
                  onStartVideoCall(targetPeer, headerTitle);
                }
              }}
              className="p-2 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/20 active:scale-95 transition-all cursor-pointer"
              title="Start Video Call"
            >
              <Video className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              showSearch
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                : 'bg-white/[0.03] text-slate-400 hover:text-white border-white/5'
            }`}
            title="Search Messages"
          >
            <Search className="w-4 h-4" />
          </button>

          {onOpenWhispy && (
            <button
              onClick={onOpenWhispy}
              className="p-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/25 active:scale-95 transition-all cursor-pointer relative group"
              title="Ask Whispy AI"
            >
              <div className="w-5 h-5 rounded-lg overflow-hidden border border-pink-400/50">
                <img src="/whispy.jpg" alt="Whispy" className="w-full h-full object-cover" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#090b11] animate-pulse" />
            </button>
          )}

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/5 transition-all cursor-pointer"
            title="Chat info"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* In-Chat Search Bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-[#0a0d14] border-b border-white/5 flex items-center gap-2 overflow-hidden"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this conversation..."
              autoFocus
              className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Details Dropdown Popover */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 left-4 right-4 z-30 p-4 rounded-2xl bg-[#0e121d]/95 backdrop-blur-2xl border border-pink-500/20 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-display text-white">Conversation Info</span>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <Avatar name={headerTitle} url={headerAvatar} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{headerTitle}</p>
                {!isGroup && recipientFriend && (
                  <p className="text-[11px] font-mono text-pink-300">@{recipientFriend.id || recipientFriend.accountId}</p>
                )}
                <p className="text-xs text-slate-400 italic truncate mt-0.5">
                  "{isGroup ? `${participants.length} connected participants` : recipientFriend?.status || recipientFriend?.aboutStatus || 'No status'}"
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-slate-300 text-[11px] flex items-center gap-2">
              <Shield className="w-4 h-4 text-pink-400 shrink-0" />
              <span>Double-tap any message at any time to delete it for yourself or everyone.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Encryption banner */}
        <div className="flex justify-center my-2">
          <div className="px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 text-[10px] text-slate-400 flex items-center gap-1.5 shadow-sm">
            <Lock className="w-3 h-3 text-pink-400" />
            <span>Messages are encrypted & synced peer-to-peer</span>
          </div>
        </div>

        {filteredMessages.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mx-auto">
              <Smile className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold font-display text-white">No messages yet</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Say hello to start the conversation! Double-tap any message to delete.
            </p>
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const isOwn =
              (msg.senderId || '').trim().toLowerCase() === (myId || '').trim().toLowerCase();
            const isDeletedForEveryone = msg.deletedForEveryone;

            return (
              <motion.div
                key={msg.id || index}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.15 }}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} group select-none`}
                onDoubleClick={() => !isDeletedForEveryone && onDeleteMessage(msg)}
                onClick={() => !isDeletedForEveryone && handleMessageTap(msg)}
              >
                {/* Sender badge for received messages */}
                {!isOwn && (
                  <span className="text-[10px] font-semibold text-pink-300/90 mb-1 ml-1.5 flex items-center gap-1">
                    {msg.senderName || `@${msg.senderId}`}
                  </span>
                )}

                <div
                  className={`max-w-[82%] sm:max-w-[75%] rounded-2xl p-3 shadow-md relative transition-all cursor-pointer active:scale-[0.99] ${
                    isDeletedForEveryone
                      ? 'bg-white/[0.02] border border-white/5 text-slate-500 italic text-xs'
                      : isOwn
                      ? 'bg-gradient-to-br from-pink-500 via-pink-600 to-purple-600 text-white rounded-br-xs shadow-pink-500/20'
                      : 'bg-[#141824] border border-white/10 text-slate-100 rounded-bl-xs shadow-black/40'
                  }`}
                >
                  {isDeletedForEveryone ? (
                    <div className="flex items-center gap-1.5 py-0.5 text-[11px]">
                      <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>This message was deleted</span>
                    </div>
                  ) : (
                    <>
                      {/* View-Once Photo Rendering */}
                      {msg.isViewOnce ? (
                        <div className="mb-1.5">
                          {msg.isViewed || !msg.mediaUrl ? (
                            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-black/30 border border-white/5 text-slate-300">
                              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 font-mono font-bold text-xs shrink-0">
                                <EyeOff className="w-4 h-4 text-slate-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-200">View-Once Photo</p>
                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span>Opened • Expired</span>
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isOwn) {
                                  setToastNotice('You sent this photo as View-Once. The recipient can open it once.');
                                  setTimeout(() => setToastNotice(null), 3000);
                                } else {
                                  setActiveViewOnceMsg(msg);
                                }
                              }}
                              className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                isOwn
                                  ? 'bg-pink-500/20 border-pink-400/30 hover:bg-pink-500/30 text-white'
                                  : 'bg-gradient-to-r from-pink-500/25 via-purple-500/20 to-pink-500/15 border-pink-400/40 hover:border-pink-300 text-white hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-pink-500/10'
                              }`}
                            >
                              <div className="relative w-8 h-8 rounded-full bg-pink-500/30 border border-pink-400/50 flex items-center justify-center text-pink-200 font-mono font-bold text-xs shrink-0">
                                <span>1</span>
                                {!isOwn && (
                                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pink-400 animate-ping" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white">
                                    {isOwn ? 'View-Once Photo' : '1 Photo • Tap to View'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase bg-pink-500/40 text-pink-100">
                                    Protected
                                  </span>
                                </div>
                                <p className="text-[10px] text-pink-200/80 flex items-center gap-1 mt-0.5">
                                  <Shield className="w-3 h-3 text-pink-300 shrink-0" />
                                  <span>
                                    {isOwn ? 'Sent • 1 view allowed' : 'Anti-screenshot enabled • Self-destructs'}
                                  </span>
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Standard Media Image */
                        msg.mediaUrl && (
                          <div
                            className="mb-2 rounded-xl overflow-hidden cursor-pointer border border-black/20 max-w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhotoModal(msg.mediaUrl || null);
                            }}
                          >
                            <img
                              src={msg.mediaUrl}
                              alt="Shared photo"
                              className="max-h-60 w-full object-cover hover:opacity-95 transition-opacity"
                            />
                          </div>
                        )
                      )}

                      {/* Text */}
                      {msg.text && (
                        <p className="text-xs sm:text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      )}

                      {/* Timestamp and ticks */}
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                          isOwn ? 'text-pink-100/75' : 'text-slate-400'
                        }`}
                      >
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isOwn && (
                          <span>
                            {msg.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-pink-200" />
                            )}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Double tap hint on hover */}
                {!isDeletedForEveryone && (
                  <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 px-1">
                    Double-tap to delete
                  </span>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emojis Bar */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 bg-[#0c0f17] border-t border-white/5 flex items-center justify-between gap-1 overflow-x-auto"
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setInputText((prev) => prev + emoji);
                  SoundEffects.playPop();
                }}
                className="w-8 h-8 rounded-xl bg-white/[0.03] hover:bg-pink-500/20 text-base flex items-center justify-center transition-all cursor-pointer active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview before sending */}
      {mediaPreview && (
        <div className="p-3 bg-[#0d101a] border-t border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-pink-500/40 shrink-0">
              <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setMediaPreview(null);
                  setIsViewOnceMode(false);
                }}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white hover:bg-rose-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200">Photo attached</p>
              <p className="text-[11px] text-slate-400 truncate">
                {isViewOnceMode
                  ? 'View Once enabled • Anti-screenshot active'
                  : 'Standard image • Can be viewed anytime'}
              </p>
            </div>
          </div>

          {/* View-Once Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setIsViewOnceMode(!isViewOnceMode)}
            className={`px-3 py-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              isViewOnceMode
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 border-pink-400 text-white shadow-lg shadow-pink-500/25 scale-105'
                : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border-white/10'
            }`}
            title="Toggle 1-Time View (Anti-Screenshot Protection)"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs ${
                isViewOnceMode
                  ? 'bg-white text-pink-600 shadow-sm'
                  : 'bg-white/10 text-slate-300 border border-white/20'
              }`}
            >
              1
            </div>
            <span className="text-xs font-semibold">
              {isViewOnceMode ? '1-View ON' : 'Set 1-View'}
            </span>
          </button>
        </div>
      )}

      {/* Toast Notice */}
      <AnimatePresence>
        {toastNotice && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-16 left-4 right-4 z-40 p-3 rounded-xl bg-[#121624]/95 border border-pink-500/40 text-white text-xs shadow-2xl flex items-center gap-2.5 backdrop-blur-md"
          >
            <Shield className="w-4 h-4 text-pink-400 shrink-0" />
            <span className="flex-1">{toastNotice}</span>
            <button
              onClick={() => setToastNotice(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Message Input Form */}
      <footer className="p-3 bg-[#0e111a]/95 backdrop-blur-xl border-t border-white/5 shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* File Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-pink-300 border border-white/5 transition-all cursor-pointer shrink-0"
            title="Attach Image"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
              showEmojiPicker
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border-white/5'
            }`}
            title="Quick Reactions"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={isViewOnceMode ? 'Add a whisper with View-Once photo...' : 'Type a whisper...'}
            className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() && !mediaPreview}
            className="p-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-pink-500/20 transition-all cursor-pointer shrink-0"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>

      {/* Fullscreen Photo Lightbox Modal (For regular photos) */}
      {selectedPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setSelectedPhotoModal(null)}
        >
          <div className="relative max-w-lg max-h-[85vh]">
            <img
              src={selectedPhotoModal}
              alt="Expanded"
              className="max-h-[80vh] w-auto rounded-2xl border border-white/10 shadow-2xl object-contain"
            />
            <button
              onClick={() => setSelectedPhotoModal(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-pink-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Protected View-Once Lightbox with Anti-Screenshot Security */}
      {activeViewOnceMsg && (
        <ViewOnceModal
          message={activeViewOnceMsg}
          currentUserId={myId}
          onBurn={(msgId) => {
            onBurnViewOnce?.(msgId);
            setActiveViewOnceMsg(null);
          }}
          onClose={() => setActiveViewOnceMsg(null)}
        />
      )}
    </div>
  );
};
