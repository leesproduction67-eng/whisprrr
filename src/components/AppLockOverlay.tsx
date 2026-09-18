import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, KeyRound, Shield, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { UserAccount } from '../types';

interface AppLockOverlayProps {
  currentUser: UserAccount;
  isLocked: boolean;
  onUnlock: () => void;
  onForgotPasscode: () => void;
}

export const AppLockOverlay: React.FC<AppLockOverlayProps> = ({
  currentUser,
  isLocked,
  onUnlock,
  onForgotPasscode,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  if (!isLocked) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = currentUser.appLockPasscode || currentUser.passcode;
    if (pin === correctPin) {
      setError(null);
      setPin('');
      onUnlock();
    } else {
      setError('Incorrect passcode');
    }
  };

  return (
    <div
      id="app-lock-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07090e]/95 backdrop-blur-2xl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xs bg-[#0e111a] border border-pink-500/30 rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden"
      >
        <div className="w-14 h-14 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>

        <h2 className="text-lg font-bold font-display text-white mb-1">Whisprr is Locked</h2>
        <p className="text-xs text-slate-400 mb-5">
          Enter passcode for <span className="text-pink-300 font-semibold">{currentUser.displayName}</span>
        </p>

        {error && (
          <div className="mb-4 p-2 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs flex items-center justify-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPin ? 'text' : 'password'}
              placeholder="Enter passcode"
              value={pin}
              autoFocus
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-sm text-center tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
          >
            <span>Unlock Whisprr</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <button
          type="button"
          onClick={onForgotPasscode}
          className="mt-4 text-[11px] text-slate-400 hover:text-pink-300 transition-colors"
        >
          Forgot passcode?
        </button>
      </motion.div>
    </div>
  );
};
