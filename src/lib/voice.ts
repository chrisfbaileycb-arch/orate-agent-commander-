/**
 * ORATOR VOICE ENGINE — the Orator speaks, listens, and resonates.
 *
 * 1. SPEAK   : Web Speech Synthesis (SpeechSynthesisUtterance). The Orator's
 *              voice is a low, measured alto tuned for the HUD aesthetic.
 *              No network calls — the browser's local TTS voices.
 * 2. LISTEN  : Web Speech Recognition (webkitSpeechRecognition). Voice input
 *              for inquest answers, with graceful fallback when unsupported.
 * 3. RESONATE: WebAudio-synthesized forge sounds (no asset files): orb strikes,
 *              phase execution, completions, and a low ambient drone that
 *              responds to build energy.
 *
 * All features degrade silently on unsupported browsers. Nothing is uploaded:
 * recognition and synthesis are browser-local, and audio is synthesized live.
 */

// ---------------------------------------------------------------- SPEAK

let voice: SpeechSynthesisVoice | null = null;
let voicePicked = false;

function pickVoice(): SpeechSynthesisVoice | null {
  if (voicePicked) return voice;
  voicePicked = true;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer a measured English alto: female voices first, en-US/en-GB, medium depth.
  const preferred = [
    "Samantha", "Serena", "Karen", "Moira", "Tessa", "Fiona",
    "Microsoft Aria", "Microsoft Sonia", "Google UK English Female",
  ];
  for (const name of preferred) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return (voice = v);
  }
  return (voice =
    voices.find((v) => v.lang.startsWith("en")) ?? voices[0] ?? null);
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  // Voices load asynchronously in some browsers.
  window.speechSynthesis.onvoiceschanged = () => {
    voicePicked = false;
    pickVoice();
  };
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

import { oratorVoice } from "./voice-service";
import { globalAudioEngine } from "./audio-engine";

export { oratorVoice };
export { globalAudioEngine };

/**
 * Speak a line as the Orator. Routes through the provider-neutral OratorVoiceService.
 * Resolves when speech completes, pauses, or is interrupted.
 */
export async function orate(text: string, opts?: { rate?: number; pitch?: number; volume?: number }): Promise<void> {
  if (!speechOn || !text) return;
  return oratorVoice.speak(text, opts);
}

/** Cancel any in-flight speech (e.g. on route change or user interruption). */
export function hush() {
  oratorVoice.stop();
}

// ---------------------------------------------------------------- LISTEN

type RecAlternative = { transcript: string };
type RecResult = ArrayLike<RecAlternative> & { isFinal: boolean };
type RecEvent = { results: ArrayLike<RecResult> & { length: number } };

type AnyRec = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: RecEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
};

function recognitionCtor(): AnyRec | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as AnyRec | null;
}

export function listeningSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface ListenHandle {
  stop: () => void;
}

export interface ListenOptions {
  onPartial?: (partial: string) => void;
  onStream?: (stream: MediaStream) => void;
  onWord?: (word: string) => void;
}

/**
 * Start voice capture with real microphone audio stream extraction for the Web Audio analyzer.
 * Returns the final transcript and guarantees full track and recognizer cleanup.
 */
export async function listen(
  onPartialOrOpts?: ((partial: string) => void) | ListenOptions
): Promise<{ text: string; handle: ListenHandle }> {
  const opts: ListenOptions =
    typeof onPartialOrOpts === "function" ? { onPartial: onPartialOrOpts } : onPartialOrOpts ?? {};

  const Ctor = recognitionCtor();
  if (!Ctor) throw new Error("Speech recognition unsupported");

  // Attempt to acquire real MediaStream for Web Audio API frequency/waveform analysis
  let micStream: MediaStream | null = null;
  if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (micStream) {
        globalAudioEngine.connectMicrophone(micStream);
        opts.onStream?.(micStream);
      }
    } catch (err) {
      // If user denies mic or device busy, speech recognition might still run (or fail gracefully)
      console.warn("[voice] getUserMedia stream unavailable:", err);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      let finalText = "";
      let lastPartialWordCount = 0;

      const cleanup = () => {
        globalAudioEngine.disconnectSource();
        if (micStream) {
          micStream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {
              /* ignore */
            }
          });
          micStream = null;
        }
      };

      const handle: ListenHandle = {
        stop: () => {
          try {
            rec.stop();
          } catch {
            /* noop */
          }
          cleanup();
        },
      };

      rec.onresult = (ev) => {
        let interim = "";
        let accumulatedFinal = "";
        for (let i = 0; i < ev.results.length; i++) {
          const r = ev.results[i];
          const alt = r[0];
          if (r.isFinal) accumulatedFinal += (alt?.transcript ?? "") + " ";
          else interim += alt?.transcript ?? "";
        }
        finalText = accumulatedFinal;
        const currentTranscript = (accumulatedFinal + interim).trim();
        if (currentTranscript && opts.onPartial) {
          opts.onPartial(currentTranscript);
          // Check for new word arrival to trigger ripple
          const words = currentTranscript.split(/\s+/).filter(Boolean);
          if (words.length > lastPartialWordCount) {
            lastPartialWordCount = words.length;
            opts.onWord?.(words[words.length - 1]);
          }
        }
      };

      rec.onend = () => {
        cleanup();
        resolve({ text: finalText.trim(), handle });
      };

      rec.onerror = (ev) => {
        cleanup();
        if (ev?.error === "no-speech" || ev?.error === "aborted") {
          resolve({ text: finalText.trim(), handle });
        } else {
          reject(new Error(ev?.error ?? "speech recognition error"));
        }
      };

      rec.start();
    } catch (e) {
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
      }
      globalAudioEngine.disconnectSource();
      reject(e instanceof Error ? e : new Error("recognition failed"));
    }
  });
}

// ---------------------------------------------------------------- RESONATE

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let speechOn = true;

export function setSpeechEnabled(on: boolean) {
  speechOn = on;
  if (!on) hush();
}

export function isSpeechEnabled(): boolean {
  return speechOn;
}

function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx && master ? { ctx, master } : null;
  } catch {
    return null;
  }
}

export function audioSupported(): boolean {
  return audio() !== null;
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

export function isMuted(): boolean {
  return muted;
}

/** Deep crystal strike when the orb is touched. */
export function strikeSound(strength = 1) {
  const a = audio();
  if (!a || muted) return;
  const { ctx: c, master: m } = a;
  const now = c.currentTime;
  // Bell partials
  const partials: Array<[number, number, number]> = [
    [196.0, 0.5, 0.30], // G3
    [392.0, 0.4, 0.22], // G4
    [587.3, 0.3, 0.14], // D5
    [784.0, 0.25, 0.09], // G5
  ];
  for (const [freq, dur, gain] of partials) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * (0.98 + Math.random() * 0.04);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain * strength, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur * (0.8 + strength * 0.4));
    osc.connect(g).connect(m);
    osc.start(now);
    osc.stop(now + dur * 1.4);
  }
}

/** Rising plasma swell when a phase executes. */
export function phaseSound(up = true) {
  const a = audio();
  if (!a || muted) return;
  const { ctx: c, master: m } = a;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = up ? 320 : 520;
  filt.Q.value = 1.6;
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(up ? 110 : 440, now);
  osc.frequency.exponentialRampToValueAtTime(up ? 440 : 110, now + 0.55);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.14, now + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
  osc.connect(filt).connect(g).connect(m);
  osc.start(now);
  osc.stop(now + 0.7);
}

/** Completion chime — the forge seals a phase. */
export function sealSound() {
  const a = audio();
  if (!a || muted) return;
  const { ctx: c, master: m } = a;
  const now = c.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
  notes.forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    const t = now + i * 0.09;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(g).connect(m);
    osc.start(t);
    osc.stop(t + 0.7);
  });
}

// Ambient drone — started on first user gesture, follows build energy.
let drone: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;

export function startDrone() {
  const a = audio();
  if (!a || drone) return;
  const { ctx: c, master: m } = a;
  const osc = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = 55; // A1
  osc2.type = "sine";
  osc2.frequency.value = 82.5; // fifth, detuned
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 4;
  lfo.connect(lfoGain).connect(osc2.frequency);
  gain.gain.value = 0.0;
  osc.connect(gain).connect(m);
  osc2.connect(gain);
  osc.start();
  osc2.start();
  lfo.start();
  drone = { osc, osc2, gain, lfo };
}

/** 0..1 energy raises the drone's presence. */
export function setDroneEnergy(energy: number) {
  if (!drone || !ctx) return;
  const target = muted ? 0 : 0.015 + Math.min(1, Math.max(0, energy)) * 0.05;
  drone.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
}

export function stopDrone() {
  if (!drone) return;
  try {
    drone.gain.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.2);
    drone.osc.stop(ctx ? ctx.currentTime + 0.5 : 0);
    drone.osc2.stop(ctx ? ctx.currentTime + 0.5 : 0);
    drone.lfo.stop(ctx ? ctx.currentTime + 0.5 : 0);
  } catch { /* noop */ }
  drone = null;
}
