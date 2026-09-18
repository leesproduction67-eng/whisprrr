import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserPlus,
  Search,
  QrCode,
  MessageSquare,
  Video,
  Trash2,
  X,
  Check,
  Shield,
  Copy,
  Clock,
  UserCheck,
  Send,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Friend, UserAccount, FriendRequest } from '../types';
import { StorageService, DEFAULT_USER_BIO } from '../services/storage';
import { ApiService } from '../services/apiService';
import { Avatar } from './Avatar';
import { peerService } from '../services/peerService';
import { SoundEffects } from '../services/sound';

interface FriendsModalProps {
  currentUser: UserAccount;
  friends: Friend[];
  isOpen: boolean;
  onClose: () => void;
  onStartChat: (friend: Friend) => void;
  onStartCall: (friend: Friend) => void;
  onAddFriendSuccess: (newFriend: Friend) => void;
  onRemoveFriend: (friendId: string) => void;
  onOpenQRScanner: () => void;
  selectedFriendForProfile?: Friend | null;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  currentUser,
  friends,
  isOpen,
  onClose,
  onStartChat,
  onStartCall,
  onAddFriendSuccess,
  onRemoveFriend,
  onOpenQRScanner,
  selectedFriendForProfile: initialSelectedFriend,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'search' | 'requests'>('list');
  const [searchFilter, setSearchFilter] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserAccount[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [inspectFriend, setInspectFriend] = useState<Friend | null>(initialSelectedFriend || null);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Friend Requests state
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadRequests();
      setStatusMessage(null);
      fetchSuggested(userSearchQuery);
    }
  }, [isOpen, currentUser.id]);

  const fetchSuggested = async (query: string = '') => {
    // 1. Instant local results
    const localResults = StorageService.searchRegisteredAccounts(query, currentUser.id);
    setSearchResults(localResults);

    // 2. Fetch global suggested accounts from server
    try {
      const serverAccounts = await ApiService.getSuggestedAccounts(currentUser.id, query);
      if (serverAccounts && serverAccounts.length > 0) {
        // Merge accounts
        const map = new Map<string, UserAccount>();
        localResults.forEach((a) => map.set(a.id.toLowerCase(), a));
        serverAccounts.forEach((a) => map.set(a.id.toLowerCase(), a));
        setSearchResults(Array.from(map.values()));
      }
    } catch {}
  };

  const loadRequests = async () => {
    setIncomingRequests(StorageService.getIncomingFriendRequests(currentUser.id));
    setOutgoingRequests(StorageService.getOutgoingFriendRequests(currentUser.id));
    try {
      const remoteReqs = await ApiService.getFriendRequests(currentUser.id);
      if (remoteReqs) {
        if (remoteReqs.incoming.length > 0) setIncomingRequests(remoteReqs.incoming);
        if (remoteReqs.outgoing.length > 0) setOutgoingRequests(remoteReqs.outgoing);
      }
    } catch {}
  };

  if (!isOpen) return null;

  const filteredFriends = friends.filter(
    (f) =>
      f.displayName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleSearchUsers = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStatusMessage(null);
    const query = userSearchQuery.trim();
    setHasSearched(!!query);
    fetchSuggested(query);
  };

  const handleSendFriendRequest = (targetAccount: UserAccount) => {
    setStatusMessage(null);
    const result = StorageService.sendFriendRequest(currentUser, targetAccount.id);

    if (result.success && result.request) {
      if (result.newFriend) {
        // Auto-accepted (bilateral)
        onAddFriendSuccess(result.newFriend);
        setStatusMessage({ type: 'success', text: `You and @${targetAccount.id} are now connected!` });
        SoundEffects.playSend();
      } else {
        setStatusMessage({ type: 'success', text: `Friend request sent to @${targetAccount.id}` });
        SoundEffects.playSend();
        // Broadcast friend request event
        peerService.broadcastMessage({
          type: 'FRIEND_REQUEST_SENT',
          senderId: currentUser.id,
          senderName: currentUser.displayName,
          senderAvatar: currentUser.avatarUrl,
          recipientId: targetAccount.id,
          payload: result.request,
          timestamp: Date.now(),
        });
      }
      loadRequests();
    } else {
      setStatusMessage({ type: 'error', text: result.error || 'Failed to send friend request.' });
    }
  };

  const handleAcceptRequest = (req: FriendRequest) => {
    setStatusMessage(null);
    const result = StorageService.acceptFriendRequest(req.id, currentUser);
    if (result.success && result.newFriend) {
      onAddFriendSuccess(result.newFriend);
      loadRequests();
      SoundEffects.playSend();
      setStatusMessage({ type: 'success', text: `Accepted request from @${result.newFriend.id}!` });

      // Broadcast acceptance
      peerService.broadcastMessage({
        type: 'FRIEND_REQUEST_ACCEPTED',
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatarUrl,
        recipientId: req.fromUserId,
        payload: { friendId: currentUser.id, friendName: currentUser.displayName },
        timestamp: Date.now(),
      });
    }
  };

  const handleDeclineRequest = (reqId: string) => {
    StorageService.declineFriendRequest(reqId, currentUser.id);
    loadRequests();
    SoundEffects.playPop();
  };

  const handleCancelRequest = (reqId: string) => {
    StorageService.cancelFriendRequest(reqId, currentUser.id);
    loadRequests();
    SoundEffects.playPop();
  };

  const copyFriendId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="friends-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#0e111a]/95 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl relative text-slate-100 flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display leading-tight">
                {inspectFriend ? 'Contact Profile' : 'Whisprr Friends'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {friends.length} {friends.length === 1 ? 'contact' : 'contacts'} • ID: @{currentUser.id}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (inspectFriend) setInspectFriend(null);
              else onClose();
            }}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Toast/Alert */}
        {statusMessage && (
          <div
            className={`mb-3 p-2.5 rounded-xl text-xs flex items-center gap-2 shrink-0 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="flex-1">{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="p-0.5 hover:text-white text-slate-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Inspect Friend View */}
        {inspectFriend ? (
          <div className="flex flex-col items-center text-center py-2 overflow-y-auto custom-scrollbar">
            <div className="relative mb-3">
              <Avatar
                name={inspectFriend.displayName}
                url={inspectFriend.avatarUrl}
                size="xl"
                status="online"
              />
            </div>

            <h3 className="text-lg font-bold text-white font-display flex items-center gap-1.5">
              <span>{inspectFriend.displayName}</span>
              {inspectFriend.customStatusEmoji && <span>{inspectFriend.customStatusEmoji}</span>}
            </h3>

            <button
              onClick={() => copyFriendId(inspectFriend.id)}
              className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-xs text-pink-400 font-mono transition-colors cursor-pointer"
            >
              <span>@{inspectFriend.id}</span>
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
            </button>

            {/* Status box */}
            <div className="w-full mt-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                About & Status
              </p>
              <p className="text-xs text-slate-200 leading-relaxed">
                {inspectFriend.aboutStatus || DEFAULT_USER_BIO}
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="grid grid-cols-2 gap-3 w-full mt-5">
              <button
                type="button"
                onClick={() => {
                  onStartChat(inspectFriend);
                  onClose();
                }}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-pink-500/20 cursor-pointer transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send Chat</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onStartCall(inspectFriend);
                  onClose();
                }}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 cursor-pointer transition-all"
              >
                <Video className="w-4 h-4" />
                <span>Video Call</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (confirm(`Remove @${inspectFriend.id} from your contacts?`)) {
                  onRemoveFriend(inspectFriend.id);
                  setInspectFriend(null);
                }
              }}
              className="mt-4 text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 p-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Contact</span>
            </button>
          </div>
        ) : (
          <>
            {/* 3 Main Tabs */}
            <div className="flex bg-white/[0.04] p-1 rounded-2xl border border-white/5 mb-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list');
                  setStatusMessage(null);
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'list'
                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Contacts ({friends.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('search');
                  setStatusMessage(null);
                  fetchSuggested(userSearchQuery);
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'search'
                    ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Find Users</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('requests');
                  setStatusMessage(null);
                  loadRequests();
                }}
                className={`relative flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'requests'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Requests</span>
                {incomingRequests.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {incomingRequests.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: Contacts List */}
            {activeTab === 'list' && (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="relative mb-3 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter your contacts..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/40"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {filteredFriends.length === 0 ? (
                    <div className="text-center py-8 px-4 text-slate-400">
                      <p className="text-xs">No contacts match your query.</p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('search')}
                        className="mt-3 text-xs text-pink-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Find & add registered users</span>
                      </button>
                    </div>
                  ) : (
                    filteredFriends.map((friend) => (
                      <div
                        key={friend.id}
                        onClick={() => setInspectFriend(friend)}
                        className="p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 flex items-center justify-between gap-3 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            name={friend.displayName}
                            url={friend.avatarUrl}
                            size="md"
                            status="online"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-white truncate">
                                {friend.displayName}
                              </span>
                              {friend.customStatusEmoji && (
                                <span className="text-xs">{friend.customStatusEmoji}</span>
                              )}
                            </div>
                            <p className="text-[10px] text-pink-400 font-mono">@{friend.id}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[170px]">
                              {friend.aboutStatus || DEFAULT_USER_BIO}
                            </p>
                          </div>
                        </div>

                        {/* Quick Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartChat(friend);
                              onClose();
                            }}
                            className="p-2 rounded-xl bg-white/[0.04] hover:bg-pink-500/20 text-slate-300 hover:text-pink-300 border border-white/5 transition-colors cursor-pointer"
                            title="Chat"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartCall(friend);
                              onClose();
                            }}
                            className="p-2 rounded-xl bg-white/[0.04] hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/5 transition-colors cursor-pointer"
                            title="Video Call"
                          >
                            <Video className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Find & Add Users */}
            {activeTab === 'search' && (
              <div className="flex flex-col flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {/* QR Scanner trigger */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenQRScanner();
                  }}
                  className="w-full p-3 rounded-2xl bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-cyan-500/15 border border-pink-500/30 hover:border-pink-500/50 flex items-center justify-between cursor-pointer transition-all mb-4 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-105 transition-transform">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Scan Friend's QR Code</p>
                      <p className="text-[10px] text-slate-400">Add directly using camera or image file</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-pink-400" />
                </button>

                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Search Registered Accounts
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Search Form */}
                <form onSubmit={handleSearchUsers} className="mb-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by username or ID..."
                        value={userSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setUserSearchQuery(val);
                          setHasSearched(!!val.trim());
                          fetchSuggested(val);
                        }}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3.5 py-2 bg-pink-500 hover:bg-pink-400 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-md shadow-pink-500/20"
                    >
                      Search
                    </button>
                  </div>
                </form>

                {/* Results Section */}
                <div className="space-y-2.5">
                  {hasSearched && searchResults.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 space-y-1">
                      <p className="text-xs font-semibold text-slate-300">No registered account found</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        No user exists matching "{userSearchQuery}". Make sure your friend has registered an account and verify their exact Account ID.
                      </p>
                    </div>
                  ) : (
                    searchResults.map((account) => {
                      const friendshipStatus = StorageService.getFriendshipStatus(currentUser.id, account.id);

                      return (
                        <div
                          key={account.id}
                          className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              name={account.displayName}
                              url={account.avatarUrl}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {account.displayName}
                              </p>
                              <p className="text-[10px] text-pink-400 font-mono">@{account.id}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                {account.aboutStatus || DEFAULT_USER_BIO}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {friendshipStatus === 'friends' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const friendObj = friends.find((f) => f.id === account.id) || {
                                    id: account.id,
                                    displayName: account.displayName,
                                    avatarUrl: account.avatarUrl,
                                    aboutStatus: account.aboutStatus,
                                    addedAt: Date.now(),
                                  };
                                  onStartChat(friendObj);
                                  onClose();
                                }}
                                className="py-1.5 px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-emerald-500/30 transition-all"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Message</span>
                              </button>
                            ) : friendshipStatus === 'request_sent' ? (
                              <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                                <Clock className="w-3 h-3 animate-pulse" />
                                <span>Requested</span>
                              </div>
                            ) : friendshipStatus === 'request_received' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const incoming = incomingRequests.find(
                                    (r) => r.fromUserId.toLowerCase() === account.id.toLowerCase()
                                  );
                                  if (incoming) handleAcceptRequest(incoming);
                                }}
                                className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Accept</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSendFriendRequest(account)}
                                className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                              >
                                <Send className="w-3 h-3" />
                                <span>Add Friend</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Friend Requests (Incoming & Outgoing) */}
            {activeTab === 'requests' && (
              <div className="flex flex-col flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                {/* Incoming Requests */}
                <div>
                  <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-pink-400" />
                    <span>Incoming Requests ({incomingRequests.length})</span>
                  </h3>

                  {incomingRequests.length === 0 ? (
                    <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs">
                      No incoming friend requests.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {incomingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              name={req.fromUserName || req.fromUserId}
                              url={req.fromUserAvatar}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {req.fromUserName}
                              </p>
                              <p className="text-[10px] text-pink-400 font-mono">@{req.fromUserId}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[130px]">
                                {req.fromUserBio || DEFAULT_USER_BIO}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAcceptRequest(req)}
                              className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 cursor-pointer transition-all"
                              title="Accept Request"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclineRequest(req.id)}
                              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 cursor-pointer transition-all"
                              title="Decline Request"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sent / Outgoing Requests */}
                <div>
                  <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Sent Requests ({outgoingRequests.length})</span>
                  </h3>

                  {outgoingRequests.length === 0 ? (
                    <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs">
                      No pending sent requests.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {outgoingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              name={req.toUserName || req.toUserId}
                              url={req.toUserAvatar}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {req.toUserName || `@${req.toUserId}`}
                              </p>
                              <p className="text-[10px] text-cyan-400 font-mono">@{req.toUserId}</p>
                              <p className="text-[10px] text-amber-300/80">Pending approval</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCancelRequest(req.id)}
                            className="py-1 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-300 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};


