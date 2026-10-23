/**
 * ORATOR VOICE AND AUDIO REACTIVITY SPECIFICATION & STATE MODELS
 *
 * Formal state models for:
 * 1. Orb Interaction States
 * 2. Normalized Audio Reactivity Signal
 * 3. Provider-neutral OratorVoiceService
 */

export type OrbInteractionState =
  | "IDLE"
  | "USER_APPROACH"
  | "LISTENING"
  | "USER_SPEAKING"
  | "PROCESSING"
  | "ORATOR_PREPARING"
  | "ORATOR_SPEAKING"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "SETTLING";

export interface AudioSignal {
  /** Overall normalized amplitude (0..1) */
  amplitude: number;
  /** Root Mean Square smoothed audio energy (0..1) */
  rms: number;
  /** Sub-bass & low frequency energy [0-250Hz] (0..1) */
  low: number;
  /** Vocal fundamental & formant energy [250-3000Hz] (0..1) */
  mid: number;
  /** Vocal sibilance & harmonic energy [3000-8000Hz] (0..1) */
  high: number;
  /** True when vocal energy exceeds adaptive noise gate threshold */
  isSpeechActive: boolean;
  /** True when energy falls below silence floor */
  isSilence: boolean;
  /** Instantaneous attack impulse (0..1) */
  attack: number;
  /** Normalized composite scalar safe for WebGL shader uniforms (0..1) */
  normalizedEnergy: number;
  /** Frequency spectrum array (64 bands, 0..1 normalized) */
  spectrum: Float32Array;
}

export type OratorPlaybackState =
  | "IDLE"
  | "PREPARING"
  | "BUFFERING"
  | "SPEAKING"
  | "PAUSED"
  | "INTERRUPTED"
  | "COMPLETED"
  | "FAILED";

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  /** Optional signal for user cancellation */
  signal?: AbortSignal;
}

export interface OratorVoiceCapabilities {
  supportsStreaming: boolean;
  supportsAnalyzableAudio: boolean;
  supportsInterruption: boolean;
  isFallback: boolean;
  providerName: string;
}

export type PlaybackStateListener = (state: OratorPlaybackState) => void;

/**
 * Provider-Neutral Orator Voice Service Interface
 *
 * Implements a single, permanent Orator identity. Changing the underlying
 * voice engine/provider (e.g. ElevenLabs, Google Cloud TTS, local neural runtime)
 * will never alter this contract.
 */
export interface OratorVoiceService {
  readonly capabilities: OratorVoiceCapabilities;
  getState(): OratorPlaybackState;
  subscribe(listener: PlaybackStateListener): () => void;
  speak(text: string, options?: SpeakOptions): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  getAudioNode(): AudioNode | null;
  getAudioContext(): AudioContext | null;
}
