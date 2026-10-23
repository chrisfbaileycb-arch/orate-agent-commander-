/**
 * React hook for consuming real-time audio reactivity and driving the Orator Orb.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { globalAudioEngine } from "./audio-engine";
import type { AudioSignal, OrbInteractionState } from "./audio-types";
import { oratorVoice } from "./voice-service";

export interface UseAudioReactivityOptions {
  state?: OrbInteractionState;
  onInterimWord?: () => void;
}

export function useAudioReactivity({ state = "IDLE" }: UseAudioReactivityOptions = {}) {
  const [signal, setSignal] = useState<AudioSignal>(() => globalAudioEngine.sampleSignal(0));
  const rafRef = useRef<number>(0);
  const isListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const simulatedEnergyRef = useRef<number>(0);

  // Sync state to internal refs
  useEffect(() => {
    isListeningRef.current = state === "LISTENING" || state === "USER_SPEAKING";
    isSpeakingRef.current = state === "ORATOR_SPEAKING";

    // Set baseline target energy for non-microphone states
    switch (state) {
      case "IDLE":
        simulatedEnergyRef.current = 0.15;
        break;
      case "USER_APPROACH":
        simulatedEnergyRef.current = 0.35;
        break;
      case "PROCESSING":
        simulatedEnergyRef.current = 0.65;
        break;
      case "ORATOR_PREPARING":
        simulatedEnergyRef.current = 0.45;
        break;
      case "ORATOR_SPEAKING":
        simulatedEnergyRef.current = 0.75;
        break;
      case "SUCCESS":
        simulatedEnergyRef.current = 0.9;
        break;
      case "WARNING":
        simulatedEnergyRef.current = 0.6;
        break;
      case "ERROR":
        simulatedEnergyRef.current = 0.4;
        break;
      case "SETTLING":
        simulatedEnergyRef.current = 0.25;
        break;
      default:
        simulatedEnergyRef.current = 0.2;
    }
  }, [state]);

  // Subscribe to Orator Voice Service playback changes
  useEffect(() => {
    const unsub = oratorVoice.subscribe((playbackState) => {
      if (playbackState === "SPEAKING") {
        isSpeakingRef.current = true;
      } else {
        isSpeakingRef.current = false;
      }
    });
    return unsub;
  }, []);

  // RAF sampling loop
  useEffect(() => {
    let active = true;

    const tick = () => {
      if (!active) return;

      let fallback = simulatedEnergyRef.current;
      if (isSpeakingRef.current) {
        // Natural speech modulation rhythm for TTS fallback
        const now = performance.now() * 0.005;
        const breath = (Math.sin(now * 2.4) + Math.sin(now * 4.1) * 0.5) * 0.2;
        fallback = Math.max(0.2, Math.min(1.0, 0.65 + breath));
      }

      const currentSignal = globalAudioEngine.sampleSignal(fallback);
      setSignal(currentSignal);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const connectMicrophoneStream = useCallback((stream: MediaStream) => {
    globalAudioEngine.connectMicrophone(stream);
  }, []);

  const disconnectMicrophoneStream = useCallback(() => {
    globalAudioEngine.disconnectSource();
  }, []);

  return {
    signal,
    connectMicrophoneStream,
    disconnectMicrophoneStream,
  };
}
