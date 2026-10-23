/**
 * CORTEX Topology Matrix - React Stream Hook
 * Unifies event stream, metrics, audio, and simulation state.
 */

import { useState, useEffect, useCallback } from "react";
import type {
  CortexPhase,
  CortexReasoningStep,
  CortexToolCall,
  CortexMetrics,
  CortexScenario,
  CortexScenarioId,
  CortexStreamEvent,
} from "./types";
import { cortexBus } from "./bus";
import { cortexSimulator, SCENARIOS } from "./simulator";
import { cortexAudio } from "./audio";

export function useCortexStream() {
  const [scenario, setScenario] = useState<CortexScenario>(() => cortexSimulator.getScenario());
  const [phase, setPhase] = useState<CortexPhase>("parse");
  const [isPlaying, setIsPlaying] = useState<boolean>(() => cortexSimulator.isPlaying());
  const [speed, setSpeed] = useState<number>(() => cortexSimulator.getSpeed());
  const [audioMuted, setAudioMuted] = useState<boolean>(() => cortexAudio.getMuted());
  const [audioVolume, setAudioVolume] = useState<number>(() => cortexAudio.getVolume());

  const [reasoningSteps, setReasoningSteps] = useState<CortexReasoningStep[]>([]);
  const [toolCalls, setToolCalls] = useState<CortexToolCall[]>([]);
  const [recentEvents, setRecentEvents] = useState<CortexStreamEvent[]>([]);

  const [metrics, setMetrics] = useState<CortexMetrics>({
    tokPerSec: 54,
    totalTokens: 3840,
    contextLoadPct: 34,
    latencyMs: 32,
    attentionSpike: 0.12,
    tokenEntropy: 0.38,
    consensusScore: 0.94,
    loopCount: 0,
    evalPassed: false,
    activeAgentCount: 5,
    totalAgents: 5,
    estimatedCostUsd: 0.00768,
    provider: "Google Gemini Project (gemini-3.8-flash, Primary Engine)",
    modelName: "gemini-3.8-flash",
    temperature: 0.2,
    perplexity: 1.18,
  });

  // Verify server-side Gemini Project connectivity on mount
  useEffect(() => {
    if (typeof fetch !== "undefined") {
      fetch("/api/gemini/status")
        .then((res) => res.json())
        .then((data) => {
          if (data?.defaultProvider) {
            setMetrics((prev) => ({
              ...prev,
              provider: `${data.defaultProvider} (${data.defaultModel})`,
              modelName: data.defaultModel,
            }));
          }
        })
        .catch(() => {});
    }
  }, []);

  // Subscribe to Cortex Event Bus
  useEffect(() => {
    const unsubscribe = cortexBus.subscribe((event) => {
      setRecentEvents((prev) => [event, ...prev.slice(0, 40)]);

      switch (event.type) {
        case "onPhaseChange":
          setPhase(event.payload.phase);
          break;
        case "onReasoningStep":
          setReasoningSteps((prev) => [event.payload, ...prev.slice(0, 15)]);
          break;
        case "onToolCall":
          setToolCalls((prev) => [event.payload, ...prev.slice(0, 10)]);
          break;
        case "onConsensus":
          setMetrics((prev) => ({
            ...prev,
            consensusScore: event.payload.consensusScore,
            evalPassed: true,
          }));
          break;
        case "onMetricsUpdate":
          setMetrics((prev) => ({
            ...prev,
            ...event.payload,
          }));
          break;
        case "onReset":
          setReasoningSteps([]);
          setToolCalls([]);
          setRecentEvents([]);
          setMetrics((prev) => ({
            ...prev,
            totalTokens: 1200,
            estimatedCostUsd: 0.0024,
            loopCount: 0,
            evalPassed: false,
          }));
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Controls
  const togglePlay = useCallback(() => {
    if (cortexSimulator.isPlaying()) {
      cortexSimulator.pause();
      setIsPlaying(false);
    } else {
      cortexSimulator.play();
      setIsPlaying(true);
    }
  }, []);

  const changeSpeed = useCallback((newSpeed: number) => {
    cortexSimulator.setSpeed(newSpeed);
    setSpeed(newSpeed);
  }, []);

  const selectScenario = useCallback((id: CortexScenarioId) => {
    cortexSimulator.setScenario(id);
    setScenario(SCENARIOS[id]);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !audioMuted;
    cortexAudio.setMuted(next);
    setAudioMuted(next);
  }, [audioMuted]);

  const changeVolume = useCallback((val: number) => {
    cortexAudio.setVolume(val);
    setAudioVolume(val);
  }, []);

  const resetSimulation = useCallback(() => {
    cortexSimulator.reset();
    setIsPlaying(true);
  }, []);

  const triggerLoopBack = useCallback(() => {
    cortexSimulator.triggerLoopBack();
  }, []);

  const triggerToolCall = useCallback((name?: string) => {
    cortexSimulator.triggerToolCall(name);
  }, []);

  const triggerConsensus = useCallback(() => {
    cortexSimulator.triggerConsensus();
  }, []);

  const injectPrompt = useCallback((prompt: string) => {
    cortexSimulator.injectPrompt(prompt);
  }, []);

  return {
    scenario,
    phase,
    isPlaying,
    speed,
    audioMuted,
    audioVolume,
    reasoningSteps,
    toolCalls,
    recentEvents,
    metrics,
    togglePlay,
    changeSpeed,
    selectScenario,
    toggleMute,
    changeVolume,
    resetSimulation,
    triggerLoopBack,
    triggerToolCall,
    triggerConsensus,
    injectPrompt,
  };
}
