import React, { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, Mail, Shield, Check, X, ArrowRight, Smartphone, Sparkles, RefreshCw } from 'lucide-react';
import { StorageService } from '../services/storage';
import { UserAccount } from '../types';

interface ForgotPasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedAccount: UserAccount) => void;
  defaultAccountId?: string;
}

export const ForgotPasscodeModal: React.FC<ForgotPasscodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultAccountId = '',
}) => {
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('email');
  const [contactValue, setContactValue] = useState('');
  const [simulatedCode, setSimulatedCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [matchedAccount, setMatchedAccount] = useState<UserAccount | null>(null);

  if (!isOpen) return null;

  const handleRequestCode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanId = accountId.trim().toLowerCase();
    const account = StorageService.getAccountById(cleanId);
    if (!account) {
      setErrorMsg(`No Whisprr account found with ID "${cleanId}"`);
      return;
    }

    if (!contactValue.trim()) {
      setErrorMsg(`Please enter your ${contactMethod}`);
      return;
    }

    setMatchedAccount(account);

    // Generate random 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSimulatedCode(code);
    setStep('verify');
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (inputCode.trim() === simulatedCode) {
      setStep('reset');
    } else {
      setErrorMsg('Invalid verification code. Please check the 6-digit code provided.');
    }
  };

  const handleResetPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newPasscode || newPasscode.length < 4) {
      setErrorMsg('New passcode must be at least 4 digits');
      return;
    }

    if (!matchedAccount) return;

    const updated: UserAccount = {
      ...matchedAccount,
      passcode: newPasscode,
      appLockPasscode: newPasscode,
      email: contactMethod === 'email' ? contactValue : matchedAccount.email,
      phone: contactMethod === 'phone' ? contactValue : matchedAccount.phone,
    };

    StorageService.saveAccount(updated);
    onSuccess(updated);
    onClose();
  };

  return (
    <div
      id="forgot-passcode-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-[#0e111a]/95 border border-pink-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl text-slate-100 relative"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/30">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-display leading-none">Passcode Recovery</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {step === 'request' ? 'Verify Account & Identity' : step === 'verify' ? 'Enter 6-Digit Code' : 'Set New Passcode'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={handleRequestCode} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Your Account ID
              </label>
              <input
                type="text"
                placeholder="e.g. vesper_99"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Recovery Method
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContactMethod('email')}
                  className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    contactMethod === 'email'
                      ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                      : 'bg-white/[0.02] border-white/5 text-slate-400'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContactMethod('phone')}
                  className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    contactMethod === 'phone'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'bg-white/[0.02] border-white/5 text-slate-400'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Phone SMS</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {contactMethod === 'email' ? 'Recovery Email Address' : 'Recovery Mobile Number'}
              </label>
              <input
                type={contactMethod === 'email' ? 'email' : 'tel'}
                placeholder={contactMethod === 'email' ? 'you@whisprr.net' : '+1 (555) 019-2834'}
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-pink-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all mt-2"
            >
              <span>Send Verification Code</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            {/* Simulated verification banner */}
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span className="text-[11px] font-bold">Simulated Notification</span>
              </div>
              <p className="text-[11px] text-slate-300">
                A verification code was sent to <span className="font-semibold text-white">{contactValue}</span>:
              </p>
              <p className="text-base font-mono font-bold tracking-widest text-cyan-300 mt-1 text-center bg-black/40 py-1.5 rounded-lg border border-cyan-500/20">
                {simulatedCode}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Enter 6-Digit Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="••••••"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-sm text-center font-mono tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Verify Code</span>
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPasscode} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New Passcode <span className="text-slate-500">(4+ digits)</span>
              </label>
              <input
                type="password"
                placeholder="Enter new passcode"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 font-mono"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save New Passcode & Login</span>
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
