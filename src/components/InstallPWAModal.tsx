import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Smartphone, Share, PlusSquare, X, Check, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallPWAModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallPWAModal: React.FC<InstallPWAModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode (PWA installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstalledSuccess(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalledSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      }
      setDeferredPrompt(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="pwa-install-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        className="w-full max-w-sm bg-[#0e111a] border border-pink-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl text-slate-100 relative overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 p-[1.5px] shadow-lg shadow-pink-500/20">
              <div className="w-full h-full bg-[#0d1017] rounded-2xl flex items-center justify-center text-pink-400">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold font-display leading-tight">Install Whisprr App</h3>
              <p className="text-[10px] text-slate-400 font-mono">Progressive Web App</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 relative z-10 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
            <img
              src="/icons/icon.svg"
              alt="Whisprr App Icon"
              className="w-12 h-12 rounded-2xl shadow-md border border-pink-500/20"
            />
            <div className="flex-1">
              <p className="text-xs font-bold text-white">Whisprr - Private Messenger</p>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                Full-screen native experience, instant camera access, and offline capability.
              </p>
            </div>
          </div>

          {installedSuccess || isInstalled ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-300">Whisprr is Installed!</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Launch Whisprr directly from your home screen. Enable background mesh to ring incoming calls even when closed.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { pushService } = await import('../services/pushService');
                    const storedUser = JSON.parse(localStorage.getItem('whisprr_current_user') || '{}');
                    if (storedUser?.id) {
                      const ok = await pushService.subscribeUser(storedUser.id);
                      if (ok) {
                        alert('Background mesh notifications enabled! Calls will ring even when app is closed.');
                      } else {
                        alert('Please grant notification permission in your browser prompt.');
                      }
                    }
                  } catch {}
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs shadow-md shadow-pink-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>🔔 Enable Background Calls & Ringing</span>
              </button>
            </div>
          ) : isIOS ? (
            /* iOS Safari Instructions */
            <div className="p-3.5 rounded-2xl bg-pink-500/5 border border-pink-500/20 space-y-3">
              <div className="flex items-center gap-2 text-pink-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <span>How to Add on iPhone / iPad</span>
              </div>
              <ol className="space-y-2.5 text-[11px] text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-[9px]">
                    1
                  </span>
                  <span>
                    Tap the <strong>Share</strong> button <Share className="inline w-3 h-3 text-cyan-400 mx-0.5" /> at the bottom or top of Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-[9px]">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong>"Add to Home Screen"</strong> <PlusSquare className="inline w-3 h-3 text-pink-400 mx-0.5" />.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-[9px]">
                    3
                  </span>
                  <span>
                    Tap <strong>"Add"</strong> in the top right corner to install Whisprr.
                  </span>
                </li>
              </ol>
            </div>
          ) : deferredPrompt ? (
            /* Direct Chrome / Android / Desktop Install Button */
            <button
              onClick={handleInstallClick}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-500 hover:from-pink-400 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>Install to Home Screen</span>
            </button>
          ) : (
            /* Browser instructions when beforeinstallprompt is suppressed or handled natively */
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Add to Home Screen</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Open your browser's options menu (the <strong>three dots ⋮</strong> in Chrome or Edge) and select <strong>"Install Whisprr"</strong> or <strong>"Add to Home screen"</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
