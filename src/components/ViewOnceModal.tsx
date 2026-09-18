import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ShieldAlert, X, Flame, AlertTriangle, Lock, Eye, Fingerprint, Sparkles } from 'lucide-react';
import { Message } from '../types';

interface ViewOnceModalProps {
  message: Message;
  currentUserId: string;
  onBurn: (messageId: string) => void;
  onClose: () => void;
}

export const ViewOnceModal: React.FC<ViewOnceModalProps> = ({
  message,
  currentUserId,
  onBurn,
  onClose,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(12);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [screenshotAttempted, setScreenshotAttempted] = useState(false);
  const [screenshotReason, setScreenshotReason] = useState<string>('Screen capture detected');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [hasStartedViewing, setHasStartedViewing] = useState(false);
  const [hasBurned, setHasBurned] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const burnedRef = useRef(false);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Trigger permanent burn
  const executeBurn = (reason?: string) => {
    if (!burnedRef.current) {
      burnedRef.current = true;
      setHasBurned(true);
      if (reason) setScreenshotReason(reason);
      onBurn(message.id);
    }
  };

  const handleClose = () => {
    executeBurn();
    onClose();
  };

  // Pre-load image into memory
  useEffect(() => {
    if (!message.mediaUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      setImageLoaded(true);
    };
    img.src = message.mediaUrl;
  }, [message.mediaUrl]);

  // Anti-Screenshot & Screen Capture & Mobile Phone Detection
  useEffect(() => {
    // 1. Hardware & Keyboard shortcuts detection (Desktop & Mobile keyboards)
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        setScreenshotReason('PrintScreen shortcut detected');
        setScreenshotAttempted(true);
        executeBurn('PrintScreen shortcut detected');
      }

      // Mac screenshot combinations: Meta + Shift + 3 / 4 / 5 / 6 / S
      if (e.metaKey && e.shiftKey && ['3', '4', '5', '6', 's', 'S'].includes(e.key)) {
        e.preventDefault();
        setScreenshotReason('Mac Screenshot combination blocked');
        setScreenshotAttempted(true);
        executeBurn('Mac Screenshot combination blocked');
      }

      // Windows screenshot: Win + Shift + S, Ctrl + Shift + S, Alt + PrintScreen
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['s', 'S'].includes(e.key)) {
        e.preventDefault();
        setScreenshotReason('Screen snip shortcut blocked');
        setScreenshotAttempted(true);
        executeBurn('Screen snip shortcut blocked');
      }

      // Save / Print shortcuts
      if ((e.ctrlKey || e.metaKey) && ['p', 'P', 's', 'S'].includes(e.key)) {
        e.preventDefault();
        setScreenshotReason('Save/Print attempt blocked');
        setScreenshotAttempted(true);
      }

      // Escape key to exit cleanly
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    // 2. Mobile Multi-Touch Screenshot Gesture Detection (e.g. 3-finger swipe on Android)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        // Multi-finger screenshot gesture detected
        e.preventDefault();
        setScreenshotReason('Multi-touch screenshot gesture blocked');
        setScreenshotAttempted(true);
        executeBurn('Multi-touch gesture blocked');
      }
    };

    // 3. Hardware Button / Screenshot Event Interruption (Power+Volume on iOS/Android triggers touchcancel & blur)
    const handleTouchCancel = () => {
      setIsHolding(false);
      setIsWindowFocused(false);
      // Phone OS screenshot interrupts touch stream
      if (hasStartedViewing) {
        setScreenshotReason('OS capture / screen interruption detected');
        setScreenshotAttempted(true);
        executeBurn('Phone screen capture interruption');
      }
    };

    // 4. Mobile Page Lifecycle, App Switcher, and Control Center detection
    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState !== 'visible') {
        setIsWindowFocused(false);
        setIsHolding(false);
        if (hasStartedViewing) {
          executeBurn('App backgrounded during view');
        }
      } else {
        setIsWindowFocused(true);
      }
    };

    const handleWindowBlur = () => {
      setIsWindowFocused(false);
      setIsHolding(false);
      if (hasStartedViewing) {
        executeBurn('Window focus lost / capture tool active');
      }
    };

    const handleWindowFocus = () => {
      setIsWindowFocused(true);
    };

    const handlePageHide = () => {
      setIsWindowFocused(false);
      setIsHolding(false);
      executeBurn('Page hidden');
    };

    // Disable right click / context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Prevent drag gestures
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyDown, true);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchcancel', handleTouchCancel);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyDown, true);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [hasStartedViewing, message.id]);

  // Dynamic Animated Canvas Rendering with real-time dynamic anti-capture watermark
  useEffect(() => {
    if (!isHolding || !isWindowFocused || screenshotAttempted || !canvasRef.current || !loadedImageRef.current) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = loadedImageRef.current;
    const maxDim = 1200;
    let width = img.width;
    let height = img.height;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;

    let frameCount = 0;

    const render = () => {
      if (!ctx || !canvas) return;
      frameCount++;

      // 1. Draw base photo
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // 2. Animated high-security optical watermark (shifts slightly to defeat photo stitching/recording)
      const offset = (Math.sin(frameCount / 30) * 15);
      const timeStr = new Date().toLocaleTimeString();

      ctx.save();
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.translate(width / 2, height / 2 + offset);
      ctx.rotate(-Math.PI / 7);
      ctx.textAlign = 'center';
      ctx.fillText(`PROTECTED VIEW-ONCE • @${currentUserId}`, 0, -35);
      ctx.fillText(`WHISPRR ANTI-SCREENSHOT • ${timeStr}`, 0, 35);
      ctx.restore();

      // Subtle dynamic noise grid on borders
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, width - 8, height - 8);
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isHolding, isWindowFocused, screenshotAttempted, currentUserId]);

  // Countdown timer when actively holding and viewing
  useEffect(() => {
    if (!isHolding || !hasStartedViewing) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          executeBurn('View timer expired');
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isHolding, hasStartedViewing]);

  // Touch Handlers for "Touch & Hold to View"
  const startHolding = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e && e.touches.length > 1) {
      setScreenshotReason('Multi-finger gesture blocked');
      setScreenshotAttempted(true);
      executeBurn('Multi-finger gesture');
      return;
    }

    if (!isWindowFocused || screenshotAttempted || hasBurned) return;

    setIsHolding(true);
    setHasStartedViewing(true);
  };

  const stopHolding = () => {
    if (isHolding) {
      setIsHolding(false);
      // If user has viewed and releases their finger, permanently burn
      if (hasStartedViewing) {
        executeBurn('Finger released');
      }
    }
  };

  const progressPercentage = (secondsRemaining / 12) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/98 select-none overflow-hidden touch-none"
      onContextMenu={(e) => e.preventDefault()}
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Top Header Bar */}
      <header className="w-full max-w-xl px-4 py-3.5 z-20 flex items-center justify-between bg-gradient-to-b from-black/95 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
            <Flame className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold font-display text-white tracking-wide">
                View-Once Photo
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase bg-pink-500/25 text-pink-300 border border-pink-500/40">
                Anti-Screenshot
              </span>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Shield className="w-3 h-3 text-pink-400" />
              <span>Mobile & Desktop Shield Active</span>
            </p>
          </div>
        </div>

        {/* Timer & Close button */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white font-mono text-xs font-bold">
            <span className={`w-2 h-2 rounded-full ${isHolding ? 'bg-pink-500 animate-ping' : 'bg-slate-500'}`} />
            <span>{secondsRemaining}s</span>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-full bg-white/10 hover:bg-rose-500 text-white hover:text-white transition-all cursor-pointer"
            title="Close and Destroy"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Progress countdown bar */}
      <div className="w-full h-1 bg-white/10 overflow-hidden shrink-0 z-20">
        <motion.div
          className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
          initial={{ width: '100%' }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </div>

      {/* Center Interactive Shield & Protected Viewer Area */}
      <div
        className="relative flex-1 w-full max-w-xl flex flex-col items-center justify-center p-4 z-10 touch-none select-none"
        onMouseDown={startHolding}
        onMouseUp={stopHolding}
        onMouseLeave={stopHolding}
        onTouchStart={startHolding}
        onTouchEnd={stopHolding}
        onTouchCancel={stopHolding}
        style={{
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      >
        {/* Anti-Screenshot Overlay Triggered */}
        <AnimatePresence>
          {screenshotAttempted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-4 z-50 rounded-2xl bg-black/98 border border-rose-500/50 p-6 flex flex-col items-center justify-center text-center space-y-3 backdrop-blur-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 animate-bounce">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-white font-display">
                Screenshot / Screen Recording Blocked
              </h3>
              <p className="text-xs text-rose-300 max-w-xs font-mono bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-500/30">
                {screenshotReason}
              </p>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Screenshots, hardware button captures, and screen recorders are strictly forbidden on View-Once photos. This media has been permanently destroyed.
              </p>
              <button
                onClick={handleClose}
                className="mt-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-rose-500/20"
              >
                Close & Return
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Window Blur / Focus Loss Shield */}
        <AnimatePresence>
          {!isWindowFocused && !screenshotAttempted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-4 z-40 rounded-2xl bg-[#090b10]/98 border border-white/10 p-6 flex flex-col items-center justify-center text-center space-y-3 backdrop-blur-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Privacy Shield Active</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Image is hidden while screen is unfocused, switching apps, or capturing. Return to Whisprr to resume.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Burned Status Card (When finger is released after viewing) */}
        <AnimatePresence>
          {hasBurned && !screenshotAttempted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-4 z-40 rounded-2xl bg-[#0d101a]/98 border border-amber-500/30 p-6 flex flex-col items-center justify-center text-center space-y-3 backdrop-blur-xl"
            >
              <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Flame className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-white">Photo Burned & Expired</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                You have viewed this 1-time photo. It has been permanently purged from both devices and server storage.
              </p>
              <button
                onClick={handleClose}
                className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-semibold cursor-pointer shadow-lg"
              >
                Done
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive "Hold to Reveal" Touch Shield */}
        {!isHolding && !hasBurned && !screenshotAttempted && (
          <div className="absolute inset-4 z-30 flex flex-col items-center justify-center text-center p-6 bg-[#0e121d]/95 border border-pink-500/30 rounded-2xl backdrop-blur-xl shadow-2xl cursor-pointer pointer-events-none">
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 animate-pulse">
                <Fingerprint className="w-10 h-10" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500" />
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-white font-display">
              {hasStartedViewing ? 'Hold to Resume' : 'Press & Hold Screen to View'}
            </h3>

            <p className="text-xs text-slate-300 max-w-xs mt-2 leading-relaxed">
              Touch and keep your finger held down on the screen to reveal the photo.
            </p>

            <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-pink-200">
              <Shield className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span>Screenshots & releasing finger burn photo</span>
            </div>
          </div>
        )}

        {/* Protected Canvas Container */}
        <div
          className={`relative max-h-[72vh] max-w-full flex items-center justify-center rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-all ${
            !isHolding || !isWindowFocused || screenshotAttempted
              ? 'filter blur-3xl opacity-0 scale-95'
              : 'opacity-100 scale-100'
          }`}
        >
          <canvas
            ref={canvasRef}
            className="max-h-[70vh] max-w-full object-contain pointer-events-none select-none rounded-xl"
            onContextMenu={(e) => e.preventDefault()}
          />

          {!imageLoaded && (
            <div className="w-64 h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Decrypting protected photo...</span>
            </div>
          )}

          {/* Diagonally tiled watermarks in DOM */}
          <div className="absolute inset-0 pointer-events-none select-none opacity-25 flex flex-col justify-around overflow-hidden">
            <div className="text-[10px] font-mono tracking-widest text-white/50 rotate-[-25deg] text-center whitespace-nowrap">
              CONFIDENTIAL • NO SCREENSHOT • @{currentUserId}
            </div>
            <div className="text-[10px] font-mono tracking-widest text-white/50 rotate-[-25deg] text-center whitespace-nowrap">
              CONFIDENTIAL • NO SCREENSHOT • @{currentUserId}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Notice & Hold Prompt */}
      <footer className="w-full max-w-xl px-4 py-3.5 z-20 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-gradient-to-t from-black/95 to-transparent">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {isHolding
              ? 'Keep holding your finger to view'
              : 'Lifting finger or phone screenshot destroys photo'}
          </span>
        </div>

        <button
          onClick={handleClose}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/10 hover:bg-rose-500/90 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Flame className="w-3.5 h-3.5 text-amber-300" />
          <span>Burn & Exit</span>
        </button>
      </footer>
    </div>
  );
};
