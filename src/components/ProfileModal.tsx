import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  User,
  Camera,
  Upload,
  Lock,
  Check,
  X,
  Shield,
  Trash2,
  Smartphone,
  Download,
} from 'lucide-react';
import { UserAccount } from '../types';
import { Avatar } from './Avatar';
import { StorageService, DEFAULT_USER_BIO } from '../services/storage';

interface ProfileModalProps {
  user: UserAccount;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser: (updatedUser: UserAccount) => void;
  onOpenInstall?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdateUser,
  onOpenInstall,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [status, setStatus] = useState(user.aboutStatus || user.status || DEFAULT_USER_BIO);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [newPasscode, setNewPasscode] = useState('');
  const [appLockEnabled, setAppLockEnabled] = useState(user.isAppLocked ?? user.appLockEnabled ?? false);
  const [appLockPasscode, setAppLockPasscode] = useState(user.appLockPasscode || user.passcode);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const myId = user.id || user.accountId || '';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2MB');
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    const updatedUser: UserAccount = {
      ...user,
      id: myId,
      accountId: myId,
      displayName: displayName.trim(),
      aboutStatus: status.trim(),
      status: status.trim(),
      avatarUrl: avatarUrl.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      passcode: newPasscode.trim() ? newPasscode.trim() : user.passcode,
      isAppLocked: appLockEnabled,
      appLockEnabled,
      appLockPasscode: appLockPasscode.trim() ? appLockPasscode.trim() : user.passcode,
    };

    StorageService.saveAccount(updatedUser);
    onUpdateUser(updatedUser);

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div
      id="profile-settings-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-[#0e111a]/95 border border-pink-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl text-slate-100 relative max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/30">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-display leading-none">Personal Profile</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">ID: @{myId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 my-3 p-1 bg-white/[0.03] rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'profile'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'security'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>App Lock & PIN</span>
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar">
          {activeTab === 'profile' ? (
            <>
              {/* Profile Preview Card */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 flex items-center gap-3.5">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <Avatar
                    name={displayName || 'User'}
                    url={avatarUrl}
                    size="xl"
                    status="online"
                    showChangeOverlay
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-lg border border-black/40">
                    <Camera className="w-3 h-3" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-white truncate">
                      {displayName || 'Your Name'}
                    </h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 shrink-0">
                      You
                    </span>
                  </div>
                  <p className="text-[11px] text-pink-300/80 font-mono truncate">
                    @{myId}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5 italic">
                    "{status || DEFAULT_USER_BIO}"
                  </p>
                </div>
              </div>

              {/* Upload photo trigger & clear photo */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-pink-400" />
                  <span>Profile Photo</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/30 text-xs font-medium text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-pink-400" />
                    <span>Upload Custom Photo</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-medium text-rose-300 flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Clear custom photo and use initials"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Use Initials</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  {avatarUrl ? 'Custom photo is active' : 'No photo uploaded • Initial fallback active'}
                </p>
              </div>

              {/* Editable Fields */}
              <div className="space-y-3">
                {onOpenInstall && (
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-pink-500/15 via-purple-500/10 to-cyan-500/15 border border-pink-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-300 flex items-center justify-center shrink-0 border border-pink-500/30">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white leading-tight">Install Whisprr App</p>
                        <p className="text-[10px] text-slate-400">Add to Home Screen for full-screen PWA</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenInstall();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white text-xs font-bold shrink-0 shadow-md shadow-pink-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Install</span>
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    About / Status Message
                  </label>
                  <input
                    type="text"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    placeholder="e.g. Whisprring quietly 🌙"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="recovery@email.com"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-1.5 px-2.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555-0199"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-1.5 px-2.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Security Tab */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                {/* App Lock Switch */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center border border-pink-500/20">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">App Lock Protection</p>
                      <p className="text-[10px] text-slate-400">Require passcode on launch & lock</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appLockEnabled}
                      onChange={(e) => setAppLockEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
                  </label>
                </div>

                {appLockEnabled && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      App Lock PIN / Passcode
                    </label>
                    <input
                      type="password"
                      value={appLockPasscode}
                      onChange={(e) => setAppLockPasscode(e.target.value)}
                      placeholder="Passcode to unlock"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono tracking-widest"
                    />
                  </div>
                )}

                {/* Background Mesh Push Notifications */}
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">Always-Connected Background Mesh</p>
                      <p className="text-[10px] text-slate-400">Receive calls and messages even when Whisprr is closed</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { pushService } = await import('../services/pushService');
                          const success = await pushService.subscribeUser(myId);
                          if (success) {
                            alert('Always-Connected Mesh enabled! Your device will receive background calls and messages.');
                          } else {
                            alert('Please allow notification permissions in your browser to enable background ringing.');
                          }
                        } catch {
                          alert('Push notifications could not be enabled.');
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>🔔 Enable Mesh Notifications</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch('/api/push/test', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: myId }),
                          });
                          alert('Test push sent! Check your device notifications.');
                        } catch {}
                      }}
                      className="py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 text-xs font-medium transition-all cursor-pointer"
                    >
                      Test Push
                    </button>
                  </div>
                </div>

                {/* Change Account Passcode */}
                <div className="pt-3 border-t border-white/5">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Change Whisprr Account Passcode
                  </label>
                  <input
                    type="password"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Account ID: <span className="font-mono text-pink-300">@{myId}</span>
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Save Button */}
          <div className="pt-2 border-t border-white/5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-slate-300 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savedSuccess}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-pink-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
