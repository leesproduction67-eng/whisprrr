import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  PhoneCall,
  SwitchCamera,
  Sparkles,
  Shield,
  Maximize2,
} from 'lucide-react';
import { CallState, UserAccount } from '../types';
import { sounds } from '../services/sound';
import { Avatar } from './Avatar';

interface VideoCallModalProps {
  currentUser: UserAccount;
  callState: CallState;
  onAcceptCall: (withVideo: boolean) => void;
  onRejectCall: () => void;
  onEndCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onFlipCamera?: () => void;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  callState,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  localStream,
  remoteStream,
  onToggleMute,
  onToggleVideo,
  onFlipCamera,
}) => {
  const [duration, setDuration] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false);

  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  // Guarantee calling audio & ringtones stop instantly when answering, declining, cutting, or closing call
  useEffect(() => {
    if (
      callState.callStatus === 'connected' ||
      callState.callStatus === 'rejected' ||
      callState.callStatus === 'ended' ||
      !callState.isActive
    ) {
      sounds.stopRingtone();
    }
    return () => {
      sounds.stopRingtone();
    };
  }, [callState.callStatus, callState.isActive]);

  // Call timer
  useEffect(() => {
    let timer: any = null;
    if (callState.callStatus === 'connected') {
      const startTime = callState.connectedAt || Date.now();
      setDuration(Math.floor((Date.now() - startTime) / 1000));
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState.callStatus, callState.connectedAt]);

  // Robust stream binding to HTML5 video elements
  useEffect(() => {
    const mainStream = isSwapped ? localStream : remoteStream;
    const pipStream = isSwapped ? remoteStream : localStream;

    if (mainVideoRef.current && mainStream) {
      if (mainVideoRef.current.srcObject !== mainStream) {
        mainVideoRef.current.srcObject = mainStream;
      }
      mainVideoRef.current.play().catch((err) => {
        console.warn('Main video autoplay prevented:', err);
      });
    }

    if (pipVideoRef.current && pipStream) {
      if (pipVideoRef.current.srcObject !== pipStream) {
        pipVideoRef.current.srcObject = pipStream;
      }
      pipVideoRef.current.play().catch((err) => {
        console.warn('PiP video autoplay prevented:', err);
      });
    }
  }, [localStream, remoteStream, isSwapped, callState.callStatus]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!callState.isActive) return null;

  // 1. Incoming Call Dialog View
  if (callState.isIncoming && (callState.callStatus === 'ringing' || callState.callStatus === 'calling')) {
    return (
      <div id="incoming-call-overlay" className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm bg-[#0e111a]/95 border border-pink-500/30 rounded-3xl p-6 shadow-2xl text-slate-100 text-center relative overflow-hidden"
        >
          {/* Animated pulsing rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 rounded-full bg-pink-500/10 animate-ping opacity-30" />
            <div className="w-72 h-72 rounded-full bg-purple-500/10 animate-pulse-slow opacity-40" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative inline-block mb-4">
              <Avatar
                name={callState.callerName}
                url={callState.callerAvatar}
                size="2xl"
                className="border-4 border-pink-500/60 shadow-xl shadow-pink-500/30 mx-auto"
              />
              <span className="absolute bottom-0 right-1 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center border-2 border-[#0e111a]">
                <Video className="w-3.5 h-3.5 text-white" />
              </span>
            </div>

            <h3 className="text-xl font-bold font-display text-white mb-1">
              {callState.callerName}
            </h3>
            <p className="text-xs text-pink-400 font-mono mb-4">@{callState.callerId}</p>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-semibold mb-8 animate-pulse">
              <PhoneCall className="w-3.5 h-3.5 animate-bounce" />
              <span>Incoming HD Video Call...</span>
            </div>

            {/* Accept / Decline actions */}
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => {
                  sounds.stopRingtone();
                  onRejectCall();
                }}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-rose-500/20 group-hover:bg-rose-500/30 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20 transition-all group-active:scale-90">
                  <PhoneOff className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium text-slate-400">Decline</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.stopRingtone();
                  onAcceptCall(true);
                }}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 group-hover:from-emerald-400 group-hover:to-cyan-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/30 transition-all group-active:scale-90">
                  <Video className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-emerald-400">Accept HD</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. Active / Calling / Connected / Declined Video Call View
  const targetName = callState.isIncoming ? callState.callerName : callState.calleeName || callState.calleeId;
  const targetAvatar = callState.isIncoming ? callState.callerAvatar : callState.calleeAvatar;

  const currentMainStream = isSwapped ? localStream : remoteStream;
  const currentPipStream = isSwapped ? remoteStream : localStream;

  const hasMainVideo = currentMainStream && currentMainStream.getVideoTracks().some((t) => t.enabled);
  const hasPipVideo = currentPipStream && currentPipStream.getVideoTracks().some((t) => t.enabled);

  return (
    <div id="active-call-overlay" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 backdrop-blur-2xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full h-full max-w-md bg-[#0a0d14] relative flex flex-col justify-between overflow-hidden shadow-2xl border border-white/10"
      >
        {/* Main Fullscreen Video Area */}
        <div className="absolute inset-0 bg-[#080a10] flex items-center justify-center overflow-hidden">
          {callState.callStatus === 'rejected' ? (
            <div className="flex flex-col items-center text-center p-6 animate-fadeIn">
              <div className="w-24 h-24 rounded-full bg-rose-500/10 border-2 border-rose-500/40 flex items-center justify-center text-rose-400 mb-4 shadow-xl shadow-rose-500/20">
                <PhoneOff className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold font-display text-white">{targetName}</h2>
              <p className="text-sm font-semibold text-rose-400 mt-1">Call Declined</p>
              <p className="text-xs text-slate-400 mt-2 max-w-[220px]">
                The user was unavailable or declined the call.
              </p>
            </div>
          ) : callState.callStatus === 'ended' ? (
            <div className="flex flex-col items-center text-center p-6 animate-fadeIn">
              <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 mb-4">
                <PhoneOff className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold font-display text-white">{targetName}</h2>
              <p className="text-sm font-semibold text-slate-300 mt-1">Call Ended</p>
            </div>
          ) : (
            <>
              {/* Always keep main video element mounted to ensure audio and immediate video feed */}
              <video
                ref={mainVideoRef}
                autoPlay
                playsInline
                muted={isSwapped} // Mute if showing local stream in main view
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  hasMainVideo ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                } ${isSwapped ? 'scale-x-[-1]' : ''}`}
              />

              {/* Avatar placeholder if main video is not active / still connecting */}
              {!hasMainVideo && (
                <div className="flex flex-col items-center text-center p-6 z-10">
                  <div className="relative mb-4">
                    <Avatar
                      name={targetName}
                      url={targetAvatar}
                      size="2xl"
                      className="border-4 border-cyan-500/40 shadow-2xl shadow-cyan-500/20 mx-auto"
                    />
                    {callState.callStatus === 'calling' && (
                      <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-40" />
                    )}
                  </div>
                  <h2 className="text-xl font-bold font-display text-white">{targetName}</h2>
                  <p className="text-xs text-cyan-400 font-mono mt-0.5">
                    {callState.callStatus === 'calling'
                      ? 'Calling HD peer...'
                      : callState.callStatus === 'connected'
                      ? 'HD Connected'
                      : 'Establishing P2P link...'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Top Header Bar */}
        <div className="relative z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white text-xs">
              <Sparkles className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">{targetName}</p>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    callState.callStatus === 'connected'
                      ? 'bg-emerald-400 animate-pulse'
                      : callState.callStatus === 'rejected'
                      ? 'bg-rose-400'
                      : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span className="text-[10px] text-slate-300 font-mono font-medium">
                  {callState.callStatus === 'connected'
                    ? formatTime(duration)
                    : callState.callStatus === 'calling'
                    ? 'Calling...'
                    : callState.callStatus === 'rejected'
                    ? 'Call Declined'
                    : callState.callStatus === 'ended'
                    ? 'Call Ended'
                    : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/10 text-[10px] text-slate-300 flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>HD 1080p Encrypted</span>
            </span>
          </div>
        </div>

        {/* Picture-in-Picture (PiP) Corner Window - Live Simultaneous Camera */}
        <div
          onClick={() => setIsSwapped(!isSwapped)}
          className="absolute top-20 right-4 z-20 w-28 h-40 bg-black/80 rounded-2xl border-2 border-white/25 shadow-2xl overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all group"
          title="Tap to swap main and mini video"
        >
          <video
            ref={pipVideoRef}
            autoPlay
            playsInline
            muted={!isSwapped} // Mute when showing local stream in PiP
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              hasPipVideo ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
            } ${!isSwapped ? 'scale-x-[-1]' : ''}`}
          />

          {!hasPipVideo && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-2 text-center">
              <VideoOff className="w-5 h-5 text-slate-500 mb-1" />
              <span className="text-[9px]">Camera Off</span>
            </div>
          )}

          <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[8px] text-white flex items-center gap-1">
            <Maximize2 className="w-2 h-2 opacity-70 group-hover:opacity-100" />
            <span>{isSwapped ? 'Peer' : 'You'}</span>
          </div>
        </div>

        {/* Floating Call Controls at Bottom */}
        <div className="relative z-20 p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-4 bg-white/[0.08] backdrop-blur-xl p-2.5 rounded-full border border-white/15 shadow-2xl">
            {/* Mute Button */}
            <button
              type="button"
              onClick={onToggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                callState.isMuted
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-slate-100'
              }`}
              title={callState.isMuted ? 'Unmute' : 'Mute'}
            >
              {callState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Toggle Button */}
            <button
              type="button"
              onClick={onToggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                !callState.isVideoEnabled
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-slate-100'
              }`}
              title={callState.isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {callState.isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* Flip Camera */}
            {onFlipCamera && (
              <button
                type="button"
                onClick={onFlipCamera}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-slate-100 flex items-center justify-center transition-all cursor-pointer"
                title="Flip Camera"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}

            {/* Hang Up Button */}
            <button
              type="button"
              onClick={() => {
                sounds.stopRingtone();
                onEndCall();
              }}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 transition-all cursor-pointer active:scale-95 ml-2"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
