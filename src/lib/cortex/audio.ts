/**
 * CORTEX Audio Synthesizer
 * Cyberpunk-grade organic Web Audio API tone generator.
 * Modulated by incoming message length, token bursts, and reasoning step completion.
 */

class CortexAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private volume: number = 0.22;

  private initContext() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Audio not supported or blocked
    }
  }

  public unlock() {
    this.initContext();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Modulated micro-chirp for token arrival.
   * Frequency varies gently around 500-1200Hz based on token length and confidence.
   */
  public playTokenBlip(tokenLength: number, confidence: number = 0.8) {
    if (this.isMuted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      // Modulate frequency: base ~640Hz + token variance
      const freq = 580 + (tokenLength % 12) * 45 + confidence * 150;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.04);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.05);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Multi-oscillator step completion chime.
   * Modulated by phase type & confidence score.
   */
  public playStepTransition(phase: string, confidence: number) {
    if (this.isMuted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime;
      const baseFreqs: Record<string, number[]> = {
        parse: [330, 495],       // E4, B4
        plan: [392, 587.3],      // G4, D5
        draft: [440, 659.25],    // A4, E5
        eval: [523.25, 783.99],  // C5, G5
        retry: [311.13, 466.16], // Eb4, Bb4
      };

      const freqs = baseFreqs[phase] || [440, 660];
      const duration = 0.28;

      freqs.forEach((freq, i) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = i === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq * (0.95 + confidence * 0.1), t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + duration);
      });
    } catch {
      // Safe fallback
    }
  }

  /**
   * Tool call alert: crisp dual-tone chirp.
   */
  public playToolCall() {
    if (this.isMuted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(920, t);
      osc.frequency.exponentialRampToValueAtTime(1480, t + 0.08);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

      // Lowpass filter for smooth cyberpunk character
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, t);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.1);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Amber alert modulation for loop-back or confidence deficit.
   */
  public playLoopWarning() {
    if (this.isMuted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      // Descending warning sweep
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.22);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1200, t);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.26);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Radiant crystalline harmonic chord on multi-agent consensus convergence.
   */
  public playConsensusChime() {
    if (this.isMuted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;

    try {
      const t = this.ctx.currentTime;
      // Hyper-chromatic harmonic chord: Cmaj9/E (E4, G4, B4, D5, G5)
      const chord = [329.63, 392.0, 493.88, 587.33, 783.99];
      const duration = 0.95;

      chord.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + idx * 0.03);

        const startTime = t + idx * 0.03;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.08, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
      });
    } catch {
      // Safe fallback
    }
  }
}

export const cortexAudio = new CortexAudioEngine();
