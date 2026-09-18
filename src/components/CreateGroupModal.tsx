import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Users, Check, X, Sparkles, Shield, Upload, Trash2, Camera } from 'lucide-react';
import { Conversation, Friend, UserAccount } from '../types';
import { StorageService } from '../services/storage';
import { Avatar } from './Avatar';

interface CreateGroupModalProps {
  currentUser: UserAccount;
  friends: Friend[];
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (newGroup: Conversation) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  currentUser,
  friends,
  isOpen,
  onClose,
  onGroupCreated,
}) => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Image must be smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setAvatarUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleFriend = (friendId: string) => {
    if (selectedFriendIds.includes(friendId)) {
      setSelectedFriendIds(selectedFriendIds.filter((id) => id !== friendId));
    } else {
      setSelectedFriendIds([...selectedFriendIds, friendId]);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = groupName.trim();
    if (!name) {
      setErrorMsg('Please enter a group name');
      return;
    }

    if (selectedFriendIds.length === 0) {
      setErrorMsg('Please select at least 1 friend to add to the group');
      return;
    }

    const newGroupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const allParticipants = [currentUser.id, ...selectedFriendIds];

    const newGroup: Conversation = {
      id: newGroupId,
      isGroup: true,
      name,
      avatarUrl: avatarUrl.trim() || undefined,
      description: description.trim() || 'Whisprr Group Chat',
      participantIds: allParticipants,
      adminIds: [currentUser.id],
      createdAt: Date.now(),
      unreadCount: 0,
    };

    StorageService.saveOrUpdateConversation(currentUser.id, newGroup);
    onGroupCreated(newGroup);
    onClose();
  };

  return (
    <div id="create-group-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#0e111a]/95 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl relative text-slate-100 flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display leading-tight">Create Group Chat</h2>
              <p className="text-[11px] text-slate-400">Collaborate with multiple peers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4 overflow-y-auto pr-1 custom-scrollbar">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Group Name
            </label>
            <input
              type="text"
              placeholder="e.g. Cyber Squad 🌌"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Group Icon
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/10">
              <Avatar
                name={groupName || 'Group'}
                url={avatarUrl}
                size="md"
                isGroup
              />
              <div className="flex-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Upload Icon</span>
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 cursor-pointer transition-all"
                    title="Clear icon"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="What is this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Select Members ({selectedFriendIds.length} selected)
              </label>
            </div>

            {friends.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center bg-white/[0.02] rounded-xl border border-white/5">
                No contacts available. Add friends first to create a group.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                {friends.map((friend) => {
                  const isSelected = selectedFriendIds.includes(friend.id);
                  return (
                    <div
                      key={friend.id}
                      onClick={() => toggleFriend(friend.id)}
                      className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                          : 'bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={friend.displayName}
                          url={friend.avatarUrl}
                          size="sm"
                        />
                        <div>
                          <p className="text-xs font-semibold">{friend.displayName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">@{friend.id}</p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                            : 'border-white/20 bg-white/5'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={friends.length === 0}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all mt-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create Whisprr Group</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
};
