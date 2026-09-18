import React from 'react';
import { motion } from 'motion/react';
import { Trash2, Users, User, X, AlertTriangle } from 'lucide-react';
import { Message } from '../types';

interface MessageDeleteModalProps {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteForEveryone: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  isOwnMessage: boolean;
}

export const MessageDeleteModal: React.FC<MessageDeleteModalProps> = ({
  message,
  isOpen,
  onClose,
  onDeleteForEveryone,
  onDeleteForMe,
  isOwnMessage,
}) => {
  if (!isOpen || !message) return null;

  return (
    <div
      id="delete-message-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xs bg-[#0e111a]/95 border border-rose-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl text-slate-100 relative"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold font-display">Delete Message</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 mb-4">
          <p className="text-[11px] text-slate-400 line-clamp-2 italic">
            "{message.text || (message.mediaUrl ? '📸 [Photo]' : '')}"
          </p>
        </div>

        <p className="text-xs text-slate-300 mb-4">
          How would you like to delete this message?
        </p>

        <div className="space-y-2">
          {isOwnMessage && (
            <button
              type="button"
              onClick={() => {
                onDeleteForEveryone(message.id);
                onClose();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Delete for Everyone</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onDeleteForMe(message.id);
              onClose();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <User className="w-4 h-4" />
            <span>Delete for Me Only</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};
