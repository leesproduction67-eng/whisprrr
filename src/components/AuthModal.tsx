import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, User, Sparkles, Shield, KeyRound, ArrowRight, Eye, EyeOff, UserPlus, LogIn, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { UserAccount, AccentColor } from '../types';
import { StorageService, DEFAULT_USER_BIO } from '../services/storage';
import { ApiService } from '../services/apiService';
import { Avatar } from './Avatar';

interface AuthModalProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Form states
  const [accountId, setAccountId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [aboutStatus, setAboutStatus] = useState<string>(DEFAULT_USER_BIO);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [themeAccent, setThemeAccent] = useState<AccentColor>('pink');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [existingAccounts, setExistingAccounts] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync accounts from storage and server
  useEffect(() => {
    const loadAccounts = async () => {
      const local = StorageService.getAllAccounts();
      setExistingAccounts(local);
      try {
        const synced = await StorageService.syncAllAccountsFromServer();
        if (synced && synced.length > 0) {
          setExistingAccounts(synced);
        }
      } catch {}
    };
    loadAccounts();
  }, [mode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Avatar image must be smaller than 2MB');
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const cleanId = accountId.trim().toLowerCase();
    if (!cleanId) {
      setErrorMsg('Please enter your Account ID');
      setIsLoading(false);
      return;
    }

    let account = StorageService.getAccountById(cleanId);
    if (!account) {
      // Check server directory
      account = await ApiService.getAccount(cleanId);
      if (account) {
        StorageService.saveAccount(account);
      }
    }

    if (!account) {
      setErrorMsg(`No account found for ID "${cleanId}". Please register a new account.`);
      setIsLoading(false);
      return;
    }

    if (account.passcode && account.passcode !== passcode) {
      setErrorMsg('Incorrect passcode. Please check your credentials.');
      setIsLoading(false);
      return;
    }

    StorageService.setCurrentUserId(account.id);
    setIsLoading(false);
    onLoginSuccess(account);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const cleanId = accountId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanId || cleanId.length < 3) {
      setErrorMsg('Account ID must be at least 3 characters');
      setIsLoading(false);
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(cleanId)) {
      setErrorMsg('Account ID can only contain letters, numbers, underscores, and dashes');
      setIsLoading(false);
      return;
    }

    const cleanName = displayName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter a display name');
      setIsLoading(false);
      return;
    }

    if (!passcode || passcode.length < 4) {
      setErrorMsg('Passcode must be at least 4 digits');
      setIsLoading(false);
      return;
    }

    // Check if ID already taken locally or on server
    const existing = StorageService.getAccountById(cleanId) || (await ApiService.getAccount(cleanId));
    if (existing) {
      setErrorMsg('This Account ID is already taken. Please choose another.');
      setIsLoading(false);
      return;
    }

    const newAccount: UserAccount = {
      id: cleanId,
      displayName: cleanName,
      passcode,
      avatarUrl: avatarUrl.trim() || undefined,
      aboutStatus: aboutStatus.trim() || DEFAULT_USER_BIO,
      status: aboutStatus.trim() || DEFAULT_USER_BIO,
      createdAt: Date.now(),
      themeAccent,
      customStatusEmoji: '✨',
    };

    StorageService.saveAccount(newAccount);
    await ApiService.registerAccount(newAccount);
    StorageService.setCurrentUserId(newAccount.id);
    setIsLoading(false);
    onLoginSuccess(newAccount);
  };

  return (
    <div id="auth-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#0f121d]/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden text-slate-100"
      >
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Logo and Header */}
        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 to-cyan-400 p-[1px] shadow-lg mb-3">
            <div className="w-full h-full bg-[#0d101b] rounded-2xl flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-pink-400 animate-pulse" />
            </div>
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
            Whisprr.
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Private, decentralized mobile messaging & video calls
          </p>
        </div>

        {/* Switcher Tabs */}
        <div className="flex bg-white/[0.04] p-1 rounded-2xl border border-white/5 mb-6">
          <button
            id="tab-login"
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Log In
          </button>
          <button
            id="tab-register"
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            New Account
          </button>
        </div>

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs flex items-center gap-2"
          >
            <Shield className="w-4 h-4 shrink-0 text-pink-400" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Account ID
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="input-login-id"
                  type="text"
                  placeholder="e.g. your_handle"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30 transition-all font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Passcode
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="input-login-passcode"
                  type={showPasscode ? 'text' : 'password'}
                  placeholder="Enter passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30 transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span>{isLoading ? 'Connecting...' : 'Unlock Whisprr'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {existingAccounts.length > 0 && (
              <div className="pt-3 border-t border-white/5">
                <p className="text-[11px] text-slate-400 font-medium mb-2">Registered Accounts (Tap to fill):</p>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {existingAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setAccountId(acc.id);
                        if (acc.passcode) {
                          setPasscode(acc.passcode);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/40 text-xs text-slate-200 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Avatar name={acc.displayName} url={acc.avatarUrl} size="sm" />
                      <div className="text-left">
                        <p className="font-semibold text-white leading-tight text-xs">{acc.displayName}</p>
                        <p className="text-[9px] text-pink-400 font-mono">@{acc.id}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5 max-h-[62vh] overflow-y-auto pr-1 custom-scrollbar">
            {/* Avatar Preview & Upload */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <Avatar
                name={displayName || 'User'}
                url={avatarUrl}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/40 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 text-pink-400" />
                    <span>Upload Photo</span>
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 text-rose-400 hover:text-rose-300 cursor-pointer transition-all"
                      title="Clear photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {avatarUrl ? 'Custom photo chosen' : 'Optional • Default initials will be used'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Account ID <span className="text-slate-500">(Unique Handle)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-400 font-mono text-sm">
                  @
                </span>
                <input
                  id="input-reg-id"
                  type="text"
                  placeholder="vesper_99"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 pl-8 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="input-reg-name"
                  type="text"
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Passcode <span className="text-slate-500">(Minimum 4 digits)</span>
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="input-reg-passcode"
                  type={showPasscode ? 'text' : 'password'}
                  placeholder="e.g. 1234"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 pl-10 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                About / Status
              </label>
              <input
                id="input-reg-about"
                type="text"
                placeholder={DEFAULT_USER_BIO}
                value={aboutStatus}
                onChange={(e) => setAboutStatus(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Accent Theme
              </label>
              <div className="flex gap-2.5">
                {[
                  { key: 'pink', name: 'Pink Cyber', color: 'bg-pink-500' },
                  { key: 'cyan', name: 'Cyan Glow', color: 'bg-cyan-500' },
                  { key: 'purple', name: 'Purple Night', color: 'bg-purple-500' },
                  { key: 'emerald', name: 'Emerald Matrix', color: 'bg-emerald-500' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setThemeAccent(item.key as AccentColor)}
                    className={`flex-1 py-1.5 rounded-xl border flex items-center justify-center gap-1 text-[11px] font-medium transition-all cursor-pointer ${
                      themeAccent === item.key
                        ? 'border-white/40 bg-white/10 text-white'
                        : 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span>{item.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              id="btn-submit-register"
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span>{isLoading ? 'Creating...' : 'Create Whisprr Account'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
