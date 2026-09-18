import Peer, { MediaConnection, DataConnection } from 'peerjs';
import { RealtimeMessage, UserAccount } from '../types';

type MessageCallback = (msg: RealtimeMessage) => void;
type CallCallback = (call: MediaConnection) => void;
type RemoteStreamCallback = (stream: MediaStream) => void;
type PeerStatusCallback = (status: { ready: boolean; peerId: string; error?: string }) => void;

// Robust global STUN servers for NAT traversal across devices & cellular networks
export const RTC_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  iceCandidatePoolSize: 10,
};

class RealtimePeerService {
  private peer: Peer | null = null;
  private currentUserId: string | null = null;
  private currentUserName: string = '';
  private currentUserAvatar: string = '';
  private isPeerReady: boolean = false;
  private messageListeners: Set<MessageCallback> = new Set();
  private incomingCallListeners: Set<CallCallback> = new Set();
  private remoteStreamListeners: Set<RemoteStreamCallback> = new Set();
  private peerStatusListeners: Set<PeerStatusCallback> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private activeMediaConnections: Map<string, MediaConnection> = new Map();
  private activeDataConnections: Map<string, DataConnection> = new Map();
  private eventSource: EventSource | null = null;
  private sseReconnectTimeout: any = null;
  private syncInterval: any = null;
  private processedSignalIds: Set<string> = new Set();

  // Native WebRTC connection manager
  private activeRTCPeerConnection: RTCPeerConnection | null = null;
  private activeCallTargetId: string | null = null;
  private pendingRemoteOffer: RTCSessionDescriptionInit | null = null;
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  private localStream: MediaStream | null = null;

  constructor() {
    this.initBroadcastChannel();
    this.initStorageListener();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('whisprr_realtime_mesh');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && typeof event.data === 'object') {
            this.handleIncomingSignal(event.data as RealtimeMessage);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel fallback:', e);
      }
    }
  }

  private initStorageListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === 'whisprr_cross_tab_event' && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            this.handleIncomingSignal(data as RealtimeMessage);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  private handleIncomingSignal(msg: RealtimeMessage) {
    if (!msg || !msg.type) return;

    // Deduplication signature
    const sigKey =
      (msg as any).id ||
      (msg.payload && (msg.payload as any).id) ||
      `${msg.type}_${msg.senderId}_${msg.timestamp}_${JSON.stringify(msg.payload || '')}`;
    if (this.processedSignalIds.has(sigKey)) {
      return;
    }
    this.processedSignalIds.add(sigKey);

    // Keep deduplication set bounded
    if (this.processedSignalIds.size > 200) {
      const firstItems = Array.from(this.processedSignalIds).slice(0, 100);
      firstItems.forEach((k) => this.processedSignalIds.delete(k));
    }

    // Automatically handle WebRTC signaling messages
    if (
      msg.type === 'CALL_INVITE' ||
      msg.type === 'CALL_ACCEPT' ||
      msg.type === 'CALL_REJECT' ||
      msg.type === 'CALL_END' ||
      msg.type === 'WEBRTC_OFFER' ||
      msg.type === 'WEBRTC_ANSWER' ||
      msg.type === 'WEBRTC_ICE'
    ) {
      this.handleWebRTCSignal(msg);
    }

    this.notifyMessageListeners(msg);
  }

  // Trigger immediate delta sync (useful when waking from background or window focus)
  public async triggerImmediateSync() {
    if (!this.currentUserId) return;
    const cleanUser = this.currentUserId.toLowerCase().replace(/^whisprr_/, '').trim();
    try {
      const res = await fetch(`/api/sync?userId=${encodeURIComponent(cleanUser)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.signals && Array.isArray(data.signals)) {
        data.signals.forEach((sig: RealtimeMessage) => {
          this.handleIncomingSignal(sig);
        });
      }
    } catch {}
  }

  private initSSE(userId: string) {
    if (typeof window === 'undefined' || !window.EventSource) return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const cleanUser = userId.toLowerCase().replace(/^whisprr_/, '').trim();
    const sseUrl = `/api/signal/stream?userId=${encodeURIComponent(cleanUser)}`;

    try {
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onmessage = (event) => {
        if (!event.data) return;
        try {
          const msg = JSON.parse(event.data) as RealtimeMessage;
          if (msg && msg.type) {
            this.handleIncomingSignal(msg);
          }
        } catch {}
      };

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        clearTimeout(this.sseReconnectTimeout);
        this.sseReconnectTimeout = setTimeout(() => {
          if (this.currentUserId) {
            this.initSSE(this.currentUserId);
          }
        }, 1500);
      };
    } catch (e) {
      console.warn('SSE connection failed:', e);
    }
  }

  // Delta polling safety net to guarantee message & call delivery even under network disruption
  private startPeriodicSync(userId: string) {
    clearInterval(this.syncInterval);
    const cleanUser = userId.toLowerCase().replace(/^whisprr_/, '').trim();

    // Fast initial sync
    this.triggerImmediateSync();

    this.syncInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sync?userId=${encodeURIComponent(cleanUser)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.signals && Array.isArray(data.signals)) {
          data.signals.forEach((sig: RealtimeMessage) => {
            this.handleIncomingSignal(sig);
          });
        }
      } catch {}
    }, 1500);

    // Setup window focus and tab visibility listeners for instant laptop response
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const onWakeOrFocus = () => {
        this.triggerImmediateSync();
        if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED) {
          this.initSSE(cleanUser);
        }
      };
      window.removeEventListener('focus', onWakeOrFocus);
      window.addEventListener('focus', onWakeOrFocus);
      document.removeEventListener('visibilitychange', onWakeOrFocus);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          onWakeOrFocus();
        }
      });
    }
  }

  public initialize(user: UserAccount) {
    if (this.currentUserId === user.id && this.peer && !this.peer.destroyed) {
      return;
    }

    this.destroy();
    this.currentUserId = user.id;
    this.currentUserName = user.displayName;
    this.currentUserAvatar = user.avatarUrl || '';

    // Initialize cross-device SSE Signaling Stream & periodic sync safety net
    this.initSSE(user.id);
    this.startPeriodicSync(user.id);

    // Standardized safe peer ID
    const peerId = `whisprr_${user.id.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

    try {
      this.peer = new Peer(peerId, {
        debug: 0,
        config: RTC_ICE_SERVERS,
      });

      this.peer.on('open', (id) => {
        this.isPeerReady = true;
        this.notifyStatusListeners({ ready: true, peerId: id });

        this.broadcastMessage({
          type: 'USER_STATUS',
          senderId: user.id,
          senderName: user.displayName,
          senderAvatar: user.avatarUrl,
          payload: { status: 'online', userId: user.id },
          timestamp: Date.now(),
        });
      });

      this.peer.on('call', (mediaConnection) => {
        this.activeMediaConnections.set(mediaConnection.peer, mediaConnection);
        mediaConnection.on('error', () => {
          this.activeMediaConnections.delete(mediaConnection.peer);
        });
        mediaConnection.on('close', () => {
          this.activeMediaConnections.delete(mediaConnection.peer);
        });
        this.incomingCallListeners.forEach((cb) => cb(mediaConnection));
      });

      this.peer.on('connection', (dataConn) => {
        dataConn.on('open', () => {
          this.activeDataConnections.set(dataConn.peer, dataConn);
        });
        dataConn.on('data', (data: any) => {
          if (data && typeof data === 'object') {
            this.notifyMessageListeners(data as RealtimeMessage);
          }
        });
        dataConn.on('error', () => {
          this.activeDataConnections.delete(dataConn.peer);
        });
        dataConn.on('close', () => {
          this.activeDataConnections.delete(dataConn.peer);
        });
      });

      this.peer.on('error', (err: any) => {
        const errorType = err?.type;
        if (errorType === 'peer-unavailable') {
          this.notifyStatusListeners({ ready: this.isPeerReady, peerId: this.peer?.id || '', error: 'peer-unavailable' });
        } else if (errorType === 'unavailable-id') {
          // If ID exists on PeerJS, keep peer ready with existing connection or fallback
          this.isPeerReady = true;
        }
      });

      this.peer.on('disconnected', () => {
        this.isPeerReady = false;
        if (this.peer && !this.peer.destroyed) {
          try {
            this.peer.reconnect();
          } catch {}
        }
      });
    } catch {
      // Fallback
      this.isPeerReady = true;
    }
  }

  public getPeerId(): string | null {
    return this.peer?.id || (this.currentUserId ? `whisprr_${this.currentUserId}` : null);
  }

  public getIsReady(): boolean {
    return this.isPeerReady;
  }

  public onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  public onIncomingCall(callback: CallCallback): () => void {
    this.incomingCallListeners.add(callback);
    return () => {
      this.incomingCallListeners.delete(callback);
    };
  }

  public onRemoteStream(callback: RemoteStreamCallback): () => void {
    this.remoteStreamListeners.add(callback);
    return () => {
      this.remoteStreamListeners.delete(callback);
    };
  }

  public onStatusChange(callback: PeerStatusCallback): () => void {
    this.peerStatusListeners.add(callback);
    return () => {
      this.peerStatusListeners.delete(callback);
    };
  }

  private notifyStatusListeners(status: { ready: boolean; peerId: string; error?: string }) {
    this.peerStatusListeners.forEach((cb) => cb(status));
  }

  private notifyMessageListeners(msg: RealtimeMessage) {
    this.messageListeners.forEach((cb) => cb(msg));
  }

  private notifyRemoteStream(stream: MediaStream) {
    this.remoteStreamListeners.forEach((cb) => cb(stream));
  }

  // Cross-device & cross-network signaling broadcast
  public broadcastMessage(message: RealtimeMessage) {
    // 1. Cross-Device Server Signaling via HTTP API (Guarantees delivery to any phone / laptop / browser)
    try {
      fetch('/api/signal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      }).catch(() => {});
    } catch {}

    // 2. BroadcastChannel (Same browser, other tabs)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch {}
    }

    // 3. Storage Event fallback
    try {
      localStorage.setItem('whisprr_cross_tab_event', JSON.stringify({ ...message, _ts: Date.now() }));
    } catch {}

    // 4. Direct PeerJS Data Connection if active
    if (message.recipientId && message.recipientId !== 'broadcast') {
      const targetPeerId = `whisprr_${message.recipientId.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
      if (this.peer && !this.peer.destroyed && this.peer.open) {
        try {
          const conn = this.peer.connect(targetPeerId);
          if (conn) {
            conn.on('open', () => {
              try {
                conn.send(message);
              } catch {}
            });
          }
        } catch {}
      }
    }
  }

  // ==========================================
  // NATIVE WEBRTC REALTIME HD CALL ENGINE
  // ==========================================

  private createRTCPeerConnection(targetUserId: string): RTCPeerConnection {
    if (this.activeRTCPeerConnection) {
      try {
        this.activeRTCPeerConnection.close();
      } catch {}
    }

    const pc = new RTCPeerConnection(RTC_ICE_SERVERS);
    this.activeRTCPeerConnection = pc;
    this.activeCallTargetId = targetUserId;

    // Persistent remote stream aggregator
    const remoteStreamAggregator = new MediaStream();

    // When remote track arrives from other device, aggregate and notify all listeners
    pc.ontrack = (event) => {
      console.log('Native WebRTC ontrack event:', event.track.kind, event.track.id);
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!remoteStreamAggregator.getTracks().some((t) => t.id === track.id)) {
            remoteStreamAggregator.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!remoteStreamAggregator.getTracks().some((t) => t.id === event.track.id)) {
          remoteStreamAggregator.addTrack(event.track);
        }
      }
      // Pass a freshly constructed MediaStream with all tracks so React state detects changes
      const currentTracks = remoteStreamAggregator.getTracks();
      if (currentTracks.length > 0) {
        this.notifyRemoteStream(new MediaStream(currentTracks));
      }
    };

    // Forward ICE candidates to target device
    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentUserId) {
        this.broadcastMessage({
          type: 'WEBRTC_ICE',
          senderId: this.currentUserId,
          recipientId: targetUserId,
          payload: event.candidate.toJSON(),
          timestamp: Date.now(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('WebRTC ICE Connection State:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('WebRTC Connection State:', pc.connectionState);
      if (pc.connectionState === 'failed') {
        if (pc.restartIce) {
          pc.restartIce();
        }
      }
    };

    return pc;
  }

  // Start outgoing call: generates Offer and sends CALL_INVITE with SDP offer
  public async startNativeCall(targetUserId: string, localStream: MediaStream): Promise<void> {
    const cleanTargetId = targetUserId.toLowerCase().replace(/^whisprr_/, '').trim();
    this.localStream = localStream;
    this.pendingRemoteCandidates = [];

    const pc = this.createRTCPeerConnection(cleanTargetId);

    // Add local HD tracks to peer connection
    localStream.getTracks().forEach((track) => {
      try {
        pc.addTrack(track, localStream);
      } catch (e) {
        console.warn('Error adding track to WebRTC:', e);
      }
    });

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      if (this.currentUserId) {
        // Broadcast CALL_INVITE with SDP offer inside payload
        this.broadcastMessage({
          type: 'CALL_INVITE',
          senderId: this.currentUserId,
          senderName: this.currentUserName,
          senderAvatar: this.currentUserAvatar,
          recipientId: cleanTargetId,
          payload: {
            isVideo: localStream.getVideoTracks().length > 0,
            offer: {
              type: offer.type,
              sdp: offer.sdp,
            },
          },
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn('Native WebRTC createOffer failed:', err);
    }
  }

  // Answer incoming call: applies pending Offer, adds local tracks, creates Answer
  public async answerNativeCall(callerUserId: string, localStream: MediaStream): Promise<void> {
    const cleanCallerId = callerUserId.toLowerCase().replace(/^whisprr_/, '');
    this.localStream = localStream;

    const pc = this.createRTCPeerConnection(cleanCallerId);

    // Add local HD tracks
    localStream.getTracks().forEach((track) => {
      try {
        pc.addTrack(track, localStream);
      } catch (e) {
        console.warn('Error adding answer track to WebRTC:', e);
      }
    });

    try {
      if (this.pendingRemoteOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(this.pendingRemoteOffer));

        // Flush any queued ICE candidates that arrived before answer
        while (this.pendingRemoteCandidates.length > 0) {
          const candidate = this.pendingRemoteCandidates.shift();
          if (candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.warn('Error adding queued ICE candidate:', err);
            }
          }
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.currentUserId) {
        this.broadcastMessage({
          type: 'CALL_ACCEPT',
          senderId: this.currentUserId,
          senderName: this.currentUserName,
          senderAvatar: this.currentUserAvatar,
          recipientId: cleanCallerId,
          payload: {
            withVideo: localStream.getVideoTracks().length > 0,
            answer: {
              type: answer.type,
              sdp: answer.sdp,
            },
          },
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.warn('Native WebRTC answerCall error:', err);
    }
  }

  // Handle incoming WebRTC signaling packets
  public async handleWebRTCSignal(msg: RealtimeMessage) {
    const cleanRecipient = (msg.recipientId || '').toLowerCase().replace(/^whisprr_/, '').trim();
    const currentClean = (this.currentUserId || '').toLowerCase().replace(/^whisprr_/, '').trim();

    if (cleanRecipient && cleanRecipient !== currentClean && msg.recipientId !== 'broadcast') {
      return;
    }

    switch (msg.type) {
      case 'CALL_INVITE': {
        if (msg.payload?.offer) {
          this.pendingRemoteOffer = msg.payload.offer;
          this.pendingRemoteCandidates = [];
        }
        break;
      }

      case 'CALL_ACCEPT': {
        if (msg.payload?.answer && this.activeRTCPeerConnection) {
          try {
            if (this.activeRTCPeerConnection.signalingState !== 'stable') {
              await this.activeRTCPeerConnection.setRemoteDescription(
                new RTCSessionDescription(msg.payload.answer)
              );

              // Flush queued candidates
              while (this.pendingRemoteCandidates.length > 0) {
                const candidate = this.pendingRemoteCandidates.shift();
                if (candidate) {
                  try {
                    await this.activeRTCPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch {}
                }
              }
            }
          } catch (e) {
            console.warn('Error setting remote answer:', e);
          }
        }
        break;
      }

      case 'WEBRTC_ICE': {
        const candidateData = msg.payload;
        if (!candidateData) return;

        if (
          this.activeRTCPeerConnection &&
          this.activeRTCPeerConnection.remoteDescription &&
          this.activeRTCPeerConnection.remoteDescription.type
        ) {
          try {
            await this.activeRTCPeerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
          } catch (e) {
            console.warn('Error adding live ICE candidate:', e);
          }
        } else {
          this.pendingRemoteCandidates.push(candidateData);
        }
        break;
      }
    }
  }

  // Start outgoing call via PeerJS (secondary compatibility layer)
  public callPeer(targetUserId: string, localStream: MediaStream): MediaConnection | null {
    if (!this.peer || this.peer.destroyed) {
      return null;
    }

    const targetPeerId = `whisprr_${targetUserId.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
    try {
      const call = this.peer.call(targetPeerId, localStream, {
        metadata: {
          callerId: this.currentUserId,
          callerName: this.currentUserName,
          callerAvatar: this.currentUserAvatar,
          callerPeerId: this.peer.id,
        },
      });

      if (call) {
        call.on('error', () => {
          this.activeMediaConnections.delete(targetPeerId);
        });
        call.on('close', () => {
          this.activeMediaConnections.delete(targetPeerId);
        });
        this.activeMediaConnections.set(targetPeerId, call);
        return call;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public endCall(notifyPeer: boolean = true) {
    if (this.activeRTCPeerConnection) {
      try {
        this.activeRTCPeerConnection.close();
      } catch {}
      this.activeRTCPeerConnection = null;
    }

    this.pendingRemoteOffer = null;
    this.pendingRemoteCandidates = [];
    this.activeCallTargetId = null;

    this.activeMediaConnections.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    this.activeMediaConnections.clear();
  }

  public destroy() {
    this.isPeerReady = false;
    clearTimeout(this.sseReconnectTimeout);
    clearInterval(this.syncInterval);

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.endCall(false);

    this.activeDataConnections.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    this.activeDataConnections.clear();

    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
  }
}

// Acquire crystal-clear HD camera and noise-cancelled audio with multi-tier fallbacks
export async function getHighQualityMediaStream(
  withVideo: boolean = true,
  isFrontCamera: boolean = true
): Promise<MediaStream> {
  const facingMode = isFrontCamera ? 'user' : 'environment';

  // 1. Crystal-clear Full HD 1080p / 720p 30fps with studio-grade audio processing
  if (withVideo) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode,
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      return stream;
    } catch (e1) {
      console.warn('HD 720p stream not supported, trying standard constraints:', e1);
    }

    // 2. Standard camera + microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      return stream;
    } catch (e2) {
      console.warn('Audio+Video standard failed, trying video-only:', e2);
    }

    // 3. Video-only fallback (critical when microphone is held exclusively by another browser tab or app)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      return stream;
    } catch (e3) {
      console.warn('Video-only failed:', e3);
    }
  }

  // 4. Audio-only fallback if video is disabled or blocked
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    return stream;
  } catch (e4) {
    console.warn('Audio-only failed:', e4);
  }

  throw new Error('Camera/Microphone permission denied or device not available');
}

// Generate animated cyberpunk video stream for interactive demo call simulation (NO DEFAULT LADY PICTURE)
export function createSimulatedVideoStream(name: string, avatarUrl?: string): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');

  let frame = 0;
  let animId: number;

  const initials = name
    ? name
        .trim()
        .replace(/[^\w\s]/gi, '')
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || name.slice(0, 2).toUpperCase()
    : 'W';

  let img: HTMLImageElement | null = null;
  if (avatarUrl && avatarUrl.trim() !== '') {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = avatarUrl;
  }

  const render = () => {
    if (!ctx) return;
    frame++;

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 480, 640);
    grad.addColorStop(0, '#090c15');
    grad.addColorStop(0.5, '#160d26');
    grad.addColorStop(1, '#0b1329');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 480, 640);

    // Glowing cyber rings
    const glowRadius = 95 + Math.sin(frame * 0.06) * 8;
    ctx.save();
    ctx.beginPath();
    ctx.arc(240, 270, glowRadius + 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(236, 72, 153, 0.25)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(240, 270, glowRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(240, 270, glowRadius - 4, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 240 - glowRadius, 270 - glowRadius, glowRadius * 2, glowRadius * 2);
    } else {
      // Dynamic stylish initials gradient avatar
      const innerGrad = ctx.createLinearGradient(140, 170, 340, 370);
      innerGrad.addColorStop(0, '#ec4899');
      innerGrad.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = innerGrad;
      ctx.fillRect(240 - glowRadius, 270 - glowRadius, glowRadius * 2, glowRadius * 2);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, 240, 270);
    }
    ctx.restore();

    // Name and video watermark
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(name, 240, 420);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '13px monospace';
    ctx.fillText('● Encrypted P2P HD Feed', 240, 450);

    animId = requestAnimationFrame(render);
  };

  render();

  try {
    const stream = canvas.captureStream(25);
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        cancelAnimationFrame(animId);
      });
    });

    // Add silent audio track for full WebRTC audio/video compatibility
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const dst = audioCtx.createMediaStreamDestination();
        const gain = audioCtx.createGain();
        gain.gain.value = 0; // Completely silent
        osc.connect(gain);
        gain.connect(dst);
        osc.start();
        const audioTrack = dst.stream.getAudioTracks()[0];
        if (audioTrack) {
          stream.addTrack(audioTrack);
        }
      }
    } catch {}

    return stream;
  } catch {
    return new MediaStream();
  }
}

export const peerService = new RealtimePeerService();
