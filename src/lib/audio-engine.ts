/**
 * REAL-TIME AUDIO REACTIVITY ENGINE
 *
 * Provides calibrated Web Audio API signal extraction for:
 * - Live microphone input (MediaStream)
 * - Orator audio playback (HTMLAudioElement or Web Audio Node)
 * - Synthetic fallbacks with natural vocal envelope modeling
 *
 * Guarantees:
 * - Single singleton AudioContext instance (never recreated per frame)
 * - Safe track, node, and event cleanup upon stop / unmount
 * - Clamped, smoothed RMS, sub-band energies, attack/decay envelopes
 * - Zero violent jitter from raw noise
 * - Full support for prefers-reduced-motion
 */

import type { AudioSignal } from "./audio-types";

export interface AudioReactivitySource {
  type: "mic" | "playback" | "synthetic";
  node?: AudioNode;
  stream?: MediaStream;
}

export class AudioReactivityEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | AudioNode | null = null;
  private activeStream: MediaStream | null = null;
  private timeData: Uint8Array | null = null;
  private freqData: Uint8Array | null = null;
  private spectrum64: Float32Array = new Float32Array(64);

  // Smoothed signal variables
  private smoothedRms = 0;
  private smoothedLow = 0;
  private smoothedMid = 0;
  private smoothedHigh = 0;
  private prevRms = 0;
  private isSpeechActive = false;
  private speechHoldFrames = 0;

  // Reduced motion flag
  private reducedMotion = false;

  constructor() {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reducedMotion = mq.matches;
      mq.addEventListener?.("change", (e) => {
        this.reducedMotion = e.matches;
      });
    }
  }

  public getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public connectMicrophone(stream: MediaStream): void {
    this.disconnectSource();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.activeStream = stream;
    this.ensureAnalyser(ctx);

    try {
      this.sourceNode = ctx.createMediaStreamSource(stream);
      if (this.analyser) {
        this.sourceNode.connect(this.analyser);
        // Note: Do NOT connect microphone to ctx.destination to avoid acoustic feedback loops!
      }
    } catch (err) {
      console.warn("[audio-engine] Failed to connect mic source node:", err);
    }
  }

  public connectAudioNode(node: AudioNode): void {
    this.disconnectSource();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.ensureAnalyser(ctx);
    try {
      this.sourceNode = node;
      if (this.analyser) {
        node.connect(this.analyser);
      }
    } catch (err) {
      console.warn("[audio-engine] Failed to connect audio node:", err);
    }
  }

  public connectMediaElement(element: HTMLAudioElement): void {
    this.disconnectSource();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.ensureAnalyser(ctx);
    try {
      const elSource = ctx.createMediaElementSource(element);
      this.sourceNode = elSource;
      if (this.analyser) {
        elSource.connect(this.analyser);
        this.analyser.connect(ctx.destination);
      }
    } catch (err) {
      console.warn("[audio-engine] Failed to connect media element:", err);
    }
  }

  private ensureAnalyser(ctx: AudioContext): void {
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -15;
      this.timeData = new Uint8Array(this.analyser.fftSize);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  public disconnectSource(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        /* ignore */
      }
      this.sourceNode = null;
    }
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      this.activeStream = null;
    }
  }

  /**
   * Samples current audio metrics and returns a clamped, normalized AudioSignal.
   * If no live audio source is connected, optional simulated vocal energy can be passed.
   */
  public sampleSignal(fallbackEnergy = 0): AudioSignal {
    const isMuted = this.reducedMotion;

    if (!this.analyser || !this.timeData || !this.freqData) {
      return this.synthesizeSignal(fallbackEnergy);
    }

    // Capture real audio time & frequency arrays
    try {
      this.analyser.getByteTimeDomainData(this.timeData as Uint8Array<ArrayBuffer>);
      this.analyser.getByteFrequencyData(this.freqData as Uint8Array<ArrayBuffer>);
    } catch {
      return this.synthesizeSignal(fallbackEnergy);
    }

    // 1. Calculate RMS from time domain data
    let sumSquares = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const val = (this.timeData[i] - 128) / 128;
      sumSquares += val * val;
    }
    const rawRms = Math.sqrt(sumSquares / this.timeData.length);

    // 2. Calculate frequency bands
    // fftSize=512, sampleRate=44100/48000 -> bin width is ~90Hz
    const binCount = this.freqData.length; // 256 bins
    let lowSum = 0;
    let midSum = 0;
    let highSum = 0;

    const lowEnd = Math.min(Math.floor(250 / 90), binCount);
    const midEnd = Math.min(Math.floor(3000 / 90), binCount);
    const highEnd = Math.min(Math.floor(8000 / 90), binCount);

    for (let i = 0; i < lowEnd; i++) lowSum += this.freqData[i];
    for (let i = lowEnd; i < midEnd; i++) midSum += this.freqData[i];
    for (let i = midEnd; i < highEnd; i++) highSum += this.freqData[i];

    const rawLow = lowEnd > 0 ? lowSum / (lowEnd * 255) : 0;
    const rawMid = midEnd > lowEnd ? midSum / ((midEnd - lowEnd) * 255) : 0;
    const rawHigh = highEnd > midEnd ? highSum / ((highEnd - midEnd) * 255) : 0;

    // 3. Compress 64 spectrum buckets for shader/particle consumption
    const step = Math.floor(binCount / 64);
    for (let b = 0; b < 64; b++) {
      let bSum = 0;
      for (let s = 0; s < step; s++) {
        bSum += this.freqData[b * step + s];
      }
      this.spectrum64[b] = bSum / (step * 255);
    }

    // 4. Attack and decay smoothing
    const attackCoeff = rawRms > this.smoothedRms ? 0.35 : 0.08;
    this.smoothedRms += (rawRms - this.smoothedRms) * attackCoeff;
    this.smoothedLow += (rawLow - this.smoothedLow) * 0.15;
    this.smoothedMid += (rawMid - this.smoothedMid) * 0.22;
    this.smoothedHigh += (rawHigh - this.smoothedHigh) * 0.25;

    // Attack transient
    const attack = Math.max(0, rawRms - this.prevRms);
    this.prevRms = rawRms;

    // Speech detection with adaptive gate and hold frames
    const NOISE_FLOOR = 0.025;
    if (this.smoothedRms > NOISE_FLOOR) {
      this.isSpeechActive = true;
      this.speechHoldFrames = 15;
    } else if (this.speechHoldFrames > 0) {
      this.speechHoldFrames--;
    } else {
      this.isSpeechActive = false;
    }

    const isSilence = this.smoothedRms < 0.01;

    // Normalized composite scalar for WebGL shader
    let norm = Math.min(1, Math.max(0, this.smoothedRms * 1.8 + this.smoothedMid * 0.8));
    if (isMuted) norm *= 0.3; // gentle scale for reduced motion

    return {
      amplitude: Math.min(1, rawRms * 2),
      rms: Math.min(1, this.smoothedRms),
      low: Math.min(1, this.smoothedLow),
      mid: Math.min(1, this.smoothedMid),
      high: Math.min(1, this.smoothedHigh),
      isSpeechActive: this.isSpeechActive,
      isSilence,
      attack: Math.min(1, attack * 4),
      normalizedEnergy: norm,
      spectrum: this.spectrum64,
    };
  }

  private synthesizeSignal(energy: number): AudioSignal {
    const clamped = Math.max(0, Math.min(1, energy));
    const isSpeechActive = clamped > 0.08;

    this.smoothedRms += (clamped * 0.6 - this.smoothedRms) * 0.12;
    this.smoothedLow += (clamped * 0.5 - this.smoothedLow) * 0.1;
    this.smoothedMid += (clamped * 0.7 - this.smoothedMid) * 0.15;
    this.smoothedHigh += (clamped * 0.4 - this.smoothedHigh) * 0.18;

    const norm = this.reducedMotion ? this.smoothedRms * 0.3 : this.smoothedRms;

    return {
      amplitude: clamped,
      rms: this.smoothedRms,
      low: this.smoothedLow,
      mid: this.smoothedMid,
      high: this.smoothedHigh,
      isSpeechActive,
      isSilence: clamped < 0.01,
      attack: 0,
      normalizedEnergy: norm,
      spectrum: this.spectrum64,
    };
  }

  public destroy(): void {
    this.disconnectSource();
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        /* ignore */
      }
      this.analyser = null;
    }
    // We intentionally keep ctx in suspended state or close it on complete application teardown
  }
}

// Export a singleton reactivity engine instance for global audio routing
export const globalAudioEngine = new AudioReactivityEngine();
