import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, UserPlus, X, ArrowRight, Shield, PhoneCall, PhoneOff, Video } from 'lucide-react';
import { Avatar } from './Avatar';

export interface InAppNotification {
  id: string;
  type: 'message' | 'friend_request' | 'info' | 'call';
  title: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  messageText?: string;
  conversationId?: string;
  isVideoCall?: boolean;
  timestamp: number;
}

interface IncomingNotificationBannerProps {
  notification: InAppNotification | null;
  onDismiss: () => void;
  onOpenChat: (convId: string) => void;
  onOpenRequests: () => void;
  onAcceptCall?: () => void;
  onDeclineCall?: () => void;
}

export const IncomingNotificationBanner: React.FC<IncomingNotificationBannerProps> = ({
  notification,
  onDismiss,
  onOpenChat,
  onOpenRequests,
  onAcceptCall,
  onDeclineCall,
}) => {
  useEffect(() => {
    if (!notification) return;
    // Keep call notification alive longer (25s) so the user has time to answer
    const autoDismissTime = notification.type === 'call' ? 25000 : 6000;
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissTime);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const isCall = notification.type === 'call';

  return (
    <AnimatePresence>
      <div
        id="incoming-notification-toast"
        className="fixed top-4 inset-x-0 z-[100] flex justify-center px-4 pointer-events-none"
      >
        <motion.div
          initial={{ opacity: 0, y: -25, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`w-full max-w-sm ${
            isCall
              ? 'bg-[#150f24]/98 border-pink-500/60 shadow-pink-500/30'
              : 'bg-[#121624]/95 border-pink-500/30 shadow-pink-500/10'
          } border rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl pointer-events-auto flex items-center justify-between gap-3 text-slate-100 relative overflow-hidden`}
        >
          {/* Subtle glow accent */}
          <div
            className={`absolute top-0 left-0 bottom-0 w-1.5 ${
              isCall ? 'bg-gradient-to-b from-pink-500 via-purple-500 to-emerald-400' : 'bg-gradient-to-b from-pink-500 to-cyan-400'
            }`}
          />

          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <Avatar
                name={notification.senderName || notification.senderId}
                url={notification.senderAvatar}
                size="md"
              />
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${
                  isCall ? 'bg-emerald-500 animate-pulse' : 'bg-pink-500'
                } flex items-center justify-center text-white border border-[#121624]`}
              >
                {isCall ? (
                  <PhoneCall className="w-2.5 h-2.5" />
                ) : notification.type === 'friend_request' ? (
                  <UserPlus className="w-2.5 h-2.5" />
                ) : (
                  <MessageSquare className="w-2.5 h-2.5" />
                )}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white truncate">
                  {notification.senderName}
                </span>
                <span className="text-[10px] text-pink-400 font-mono">@{notification.senderId}</span>
              </div>
              <p
                className={`text-[11px] truncate mt-0.5 font-medium ${
                  isCall ? 'text-pink-300 animate-pulse' : 'text-slate-300'
                }`}
              >
                {isCall
                  ? '📞 Incoming HD Video Call...'
                  : notification.type === 'friend_request'
                  ? 'Sent you a friend request'
                  : notification.messageText || 'Sent a new message'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isCall ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeclineCall) onDeclineCall();
                    onDismiss();
                  }}
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors"
                  title="Decline Call"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onAcceptCall) onAcceptCall();
                    onDismiss();
                  }}
                  className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-emerald-500/30 animate-pulse"
                  title="Accept Call"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Answer</span>
                </button>
              </>
            ) : notification.type === 'friend_request' ? (
              <button
                type="button"
                onClick={() => {
                  onDismiss();
                  onOpenRequests();
                }}
                className="py-1.5 px-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-md shadow-pink-500/20"
              >
                <span>View</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onDismiss();
                  if (notification.conversationId) {
                    onOpenChat(notification.conversationId);
                  }
                }}
                className="py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-pink-500/20"
              >
                <span>Open</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            {!isCall && (
              <button
                type="button"
                onClick={onDismiss}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
