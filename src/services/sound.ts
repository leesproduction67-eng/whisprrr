// Sound Engine - Web Audio API Synthesizer with Ringtone & Audio Notifications

class SoundEngine {
  private ctx: AudioContext | null = null;
  private ringInterval: any = null;
  private isMuted: boolean = false;
  private activeOscillators: OscillatorNode[] = [];

  constructor() {
    // Check saved mute preference, default to unmuted so calls and messages ring
    try {
      const saved = localStorage.getItem('whisprr_sound_muted');
      this.isMuted = saved === 'true';
    } catch {
      this.isMuted = false;
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('whisprr_sound_muted', muted ? 'true' : 'false');
    } catch {}
    if (muted) {
      this.stopRingtone();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  // Incoming Call Repeating Ringtone
  public startRingtone() {
    if (this.isMuted) return;
    this.stopRingtone();

    const playOneRingCycle = () => {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      // Pulse 1
      this.playTone(587.33, 0.28, 'sine', 0.18, 0);
      this.playTone(783.99, 0.28, 'sine', 0.14, 0);

      // Pulse 2 (short pause between pulses)
      this.playTone(587.33, 0.35, 'sine', 0.18, 0.35);
      this.playTone(783.99, 0.35, 'sine', 0.14, 0.35);

      // Mobile vibration pattern if supported
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([400, 200, 400, 200, 800]);
        } catch {}
      }
    };

    // Play first ring immediately
    playOneRingCycle();

    // Repeat every 2.4 seconds
    this.ringInterval = setInterval(() => {
      playOneRingCycle();
    }, 2400);
  }

  public stopRingtone() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    // Stop all active oscillators
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscillators = [];

    // Cancel mobile vibration
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }

  // Call Connected Chime (rising harmonic tone)
  public playCallConnected() {
    if (this.isMuted) return;
    this.stopRingtone();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.playTone(523.25, 0.15, 'sine', 0.15, 0);
    this.playTone(659.25, 0.25, 'sine', 0.18, 0.12);
  }

  // Call Ended Chime (falling soft tone)
  public playCallEnded() {
    if (this.isMuted) return;
    this.stopRingtone();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.playTone(440, 0.18, 'sine', 0.15, 0);
    this.playTone(329.63, 0.28, 'sine', 0.14, 0.14);
  }

  // Incoming Message Chime
  public playMessageReceived() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.playTone(880, 0.12, 'sine', 0.12, 0);
    this.playTone(1174.66, 0.22, 'sine', 0.16, 0.08);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([120, 60, 120]);
      } catch {}
    }
  }

  // Sent Message Chime
  public playMessageSent() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.playTone(987.77, 0.08, 'sine', 0.08, 0);
  }

  // Message Delete Pop
  public playDelete() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.playTone(300, 0.09, 'triangle', 0.1, 0);
  }

  // Helper tone player using Web Audio gain envelope
  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    maxGain: number = 0.15,
    delaySeconds: number = 0
  ) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delaySeconds);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + delaySeconds);
      gain.gain.exponentialRampToValueAtTime(maxGain, ctx.currentTime + delaySeconds + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delaySeconds + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delaySeconds);
      osc.stop(ctx.currentTime + delaySeconds + duration + 0.05);

      this.activeOscillators.push(osc);
      osc.onended = () => {
        const idx = this.activeOscillators.indexOf(osc);
        if (idx !== -1) {
          this.activeOscillators.splice(idx, 1);
        }
      };
    } catch {}
  }

  // Static aliases
  public static playSend() {
    sounds.playMessageSent();
  }
  public static playReceive() {
    sounds.playMessageReceived();
  }
  public static playPop() {
    sounds.playMessageSent();
  }
  public static playRing() {
    sounds.startRingtone();
  }
  public static stopRing() {
    sounds.stopRingtone();
  }
  public static stopAllCallAudio() {
    sounds.stopRingtone();
  }
  public static playCallConnected() {
    sounds.playCallConnected();
  }
  public static playCallEnd() {
    sounds.playCallEnded();
  }
}

export const SoundEffects = SoundEngine;
export const sounds = new SoundEngine();



