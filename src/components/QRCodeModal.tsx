import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { QrCode, Camera, Upload, Copy, Check, X, Sparkles, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { UserAccount } from '../types';

interface QRCodeModalProps {
  currentUser: UserAccount;
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (accountId: string) => void;
  initialTab?: 'my-code' | 'scan';
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onScanResult,
  initialTab = 'my-code',
}) => {
  const [tab, setTab] = useState<'my-code' | 'scan'>(initialTab);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestAnimationRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Generate QR code data URL for user's account ID
  useEffect(() => {
    if (isOpen && currentUser) {
      const qrContent = `whisprr:${currentUser.id}`;
      QRCode.toDataURL(qrContent, {
        width: 320,
        margin: 2,
        color: {
          dark: '#080a11',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR gen error:', err));
    }
  }, [isOpen, currentUser]);

  // Handle Camera scanning
  useEffect(() => {
    if (isOpen && tab === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, tab]);

  const startCamera = async () => {
    setScanError(null);
    setIsScanningActive(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setScanError('Camera not supported by browser. Try uploading a QR image.');
        setIsScanningActive(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationRef.current = requestAnimationFrame(scanVideoFrame);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setScanError('Camera permission denied or busy. You can upload an image containing a QR code instead.');
      setIsScanningActive(false);
    }
  };

  const stopCamera = () => {
    if (requestAnimationRef.current) {
      cancelAnimationFrame(requestAnimationRef.current);
      requestAnimationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanningActive(false);
  };

  const scanVideoFrame = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          processQrString(code.data);
          return;
        }
      }
    }

    if (isOpen && tab === 'scan') {
      requestAnimationRef.current = requestAnimationFrame(scanVideoFrame);
    }
  };

  const processQrString = (rawText: string) => {
    let cleanId = rawText.trim();
    if (cleanId.startsWith('whisprr:')) {
      cleanId = cleanId.replace('whisprr:', '');
    }

    if (cleanId) {
      stopCamera();
      onScanResult(cleanId);
      onClose();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);
          if (code && code.data) {
            processQrString(code.data);
          } else {
            setScanError('No QR code found in this image. Please check the image and try again.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const copyId = () => {
    navigator.clipboard.writeText(currentUser.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div id="qr-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-[#0e111a]/95 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl relative text-slate-100 overflow-hidden"
      >
        {/* Glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display leading-none">
                {tab === 'my-code' ? 'My Whisprr QR' : 'Scan Contact QR'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {tab === 'my-code' ? 'Share your ID instantly' : 'Point camera or upload image'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white/[0.04] p-1 rounded-xl border border-white/5 mb-5">
          <button
            type="button"
            onClick={() => setTab('my-code')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              tab === 'my-code'
                ? 'bg-gradient-to-r from-pink-500/25 to-purple-500/25 text-pink-300 border border-pink-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            My Code
          </button>
          <button
            type="button"
            onClick={() => setTab('scan')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              tab === 'scan'
                ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Scan QR
          </button>
        </div>

        {tab === 'my-code' ? (
          <div className="flex flex-col items-center text-center">
            {/* User badge preview */}
            <div className="flex items-center gap-2 mb-3 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/5">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.displayName}
                className="w-5 h-5 rounded-full object-cover"
              />
              <span className="text-xs font-medium text-slate-200">{currentUser.displayName}</span>
              <span className="text-[10px] text-pink-400 font-mono">@{currentUser.id}</span>
            </div>

            {/* QR Card */}
            <div className="p-3.5 bg-white rounded-2xl shadow-xl shadow-pink-500/10 mb-4 border border-white/20 relative group">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Whisprr QR"
                  className="w-52 h-52 object-contain rounded-lg"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-slate-700">
                  <Sparkles className="w-6 h-6 animate-spin" />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="w-full space-y-2">
              <button
                type="button"
                onClick={copyId}
                className="w-full py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                <span>{copied ? 'Account ID Copied!' : `Copy ID: @${currentUser.id}`}</span>
              </button>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`whisprr_qr_${currentUser.id}.png`}
                  className="block w-full py-2 rounded-xl text-center text-[11px] font-medium text-pink-400 hover:text-pink-300 hover:underline"
                >
                  Save QR Image
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Viewfinder / Video box */}
            <div className="w-full aspect-square max-w-[240px] bg-black/60 rounded-2xl border border-cyan-500/30 relative overflow-hidden flex items-center justify-center mb-4">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder overlay */}
              <div className="absolute inset-4 border-2 border-cyan-400/70 rounded-xl pointer-events-none animate-pulse-slow">
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />
                {/* scanning laser beam */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-bounce" />
              </div>
            </div>

            {scanError && (
              <div className="w-full p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-[11px] flex items-start gap-2 mb-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-cyan-400 mt-0.5" />
                <span>{scanError}</span>
              </div>
            )}

            {/* Upload fallback button */}
            <div className="w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload QR Image from Device</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
