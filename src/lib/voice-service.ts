/**
 * ORATOR VOICE SERVICE IMPLEMENTATION
 *
 * Provides a provider-neutral voice abstraction conforming to OratorVoiceService.
 *
 * Current driver:
 * - DevelopmentFallbackSpeechService: wraps window.speechSynthesis honestly,
 *   annotated with explicit capability metadata.
 *
 * Future permanent voice drivers:
 * - StreamingServerVoiceService: server-side proxy streaming Opus/PCM via Web Audio API.
 *   Will plug directly into this architecture without touching Inquest.tsx or Orb components.
 */

import type {
  OratorVoiceService,
  OratorPlaybackState,
  OratorVoiceCapabilities,
  PlaybackStateListener,
  SpeakOptions,
} from "./audio-types";
import { globalAudioEngine } from "./audio-engine";

export class DevelopmentFallbackSpeechService implements OratorVoiceService {
  private currentState: OratorPlaybackState = "IDLE";
  private listeners: Set<PlaybackStateListener> = new Set();
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private voicePicked = false;
  private abortController: AbortController | null = null;

  public readonly capabilities: OratorVoiceCapabilities = {
    supportsStreaming: false,
    supportsAnalyzableAudio: false, // Honest declaration: browser speech synthesis does not expose an AudioNode in Web Audio
    supportsInterruption: true,
    isFallback: true,
    providerName: "Browser SpeechSynthesis (Development Fallback)",
  };

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.voicePicked = false;
        this.resolveVoice();
      };
    }
  }

  private resolveVoice(): SpeechSynthesisVoice | null {
    if (this.voicePicked) return this.voice;
    this.voicePicked = true;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const preferred = [
      "Samantha",
      "Serena",
      "Karen",
      "Moira",
      "Tessa",
      "Fiona",
      "Microsoft Aria",
      "Microsoft Sonia",
      "Google UK English Female",
    ];
    for (const name of preferred) {
      const v = voices.find((x) => x.name.includes(name));
      if (v) return (this.voice = v);
    }
    return (this.voice = voices.find((v) => v.lang.startsWith("en")) ?? voices[0] ?? null);
  }

  public getState(): OratorPlaybackState {
    return this.currentState;
  }

  public subscribe(listener: PlaybackStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(state: OratorPlaybackState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.listeners.forEach((l) => l(state));
  }

  public speak(text: string, options?: SpeakOptions): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) {
        this.setState("IDLE");
        return resolve();
      }

      this.stop(); // Stop any active speech

      this.setState("PREPARING");
      this.abortController = new AbortController();

      if (options?.signal) {
        options.signal.addEventListener("abort", () => {
          this.stop();
          resolve();
        });
      }

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;
        const v = this.resolveVoice();
        if (v) utterance.voice = v;

        utterance.rate = options?.rate ?? 0.95;
        utterance.pitch = options?.pitch ?? 0.85;
        utterance.volume = options?.volume ?? 0.9;

        utterance.onstart = () => {
          this.setState("SPEAKING");
        };

        utterance.onpause = () => {
          this.setState("PAUSED");
        };

        utterance.onresume = () => {
          this.setState("SPEAKING");
        };

        utterance.onend = () => {
          this.currentUtterance = null;
          this.setState("COMPLETED");
          setTimeout(() => {
            if (this.currentState === "COMPLETED") this.setState("IDLE");
          }, 300);
          resolve();
        };

        utterance.onerror = (ev) => {
          this.currentUtterance = null;
          if (ev.error === "canceled" || ev.error === "interrupted") {
            this.setState("INTERRUPTED");
          } else {
            this.setState("FAILED");
          }
          setTimeout(() => {
            if (this.currentState === "FAILED" || this.currentState === "INTERRUPTED") {
              this.setState("IDLE");
            }
          }, 300);
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("[OratorVoiceService] Speech failed:", err);
        this.setState("FAILED");
        this.setState("IDLE");
        resolve();
      }
    });
  }

  public pause(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window && this.currentState === "SPEAKING") {
      try {
        window.speechSynthesis.pause();
        this.setState("PAUSED");
      } catch {
        /* ignore */
      }
    }
  }

  public resume(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window && this.currentState === "PAUSED") {
      try {
        window.speechSynthesis.resume();
        this.setState("SPEAKING");
      } catch {
        /* ignore */
      }
    }
  }

  public stop(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    if (this.currentState === "SPEAKING" || this.currentState === "BUFFERING" || this.currentState === "PREPARING") {
      this.setState("INTERRUPTED");
      setTimeout(() => this.setState("IDLE"), 200);
    } else {
      this.setState("IDLE");
    }
    this.currentUtterance = null;
  }

  public getAudioNode(): AudioNode | null {
    // Development fallback uses system speech synthesis and cannot expose a Web Audio node
    return null;
  }

  public getAudioContext(): AudioContext | null {
    return globalAudioEngine.getAudioContext();
  }
}

// Export single Orator voice service instance
export const oratorVoice: OratorVoiceService = new DevelopmentFallbackSpeechService();
