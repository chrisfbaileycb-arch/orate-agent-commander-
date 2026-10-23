/**
 * CORTEX Topology Matrix - Event Bus & Stream Dispatcher
 * Allows The Orator's model runner, local inference, or test harnesses to pipe operational states.
 */

import type {
  CortexPhase,
  CortexReasoningStep,
  CortexToolCall,
  CortexTokenPulse,
  CortexMetrics,
  CortexStreamEvent,
} from "./types";
import { cortexAudio } from "./audio";

type CortexEventListener = (event: CortexStreamEvent) => void;

class CortexEventBus {
  private listeners: Set<CortexEventListener> = new Set();
  private history: CortexStreamEvent[] = [];
  private readonly maxHistory = 100;

  public subscribe(listener: CortexEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(event: CortexStreamEvent) {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("Cortex listener error:", err);
      }
    });
  }

  public getRecentEvents(): CortexStreamEvent[] {
    return [...this.history];
  }

  public clearHistory() {
    this.history = [];
  }

  /* ---------- High-level helper dispatchers ---------- */

  public emitToken(pulse: CortexTokenPulse) {
    this.emit({
      type: "onToken",
      payload: pulse,
      timestamp: Date.now(),
    });
    cortexAudio.playTokenBlip(pulse.tokenText.length, pulse.confidence);
  }

  public emitReasoningStep(step: CortexReasoningStep) {
    this.emit({
      type: "onReasoningStep",
      payload: step,
      timestamp: Date.now(),
    });

    if (step.loopBack) {
      cortexAudio.playLoopWarning();
    } else {
      cortexAudio.playStepTransition(step.phase, step.confidence);
    }
  }

  public emitToolCall(toolCall: CortexToolCall) {
    this.emit({
      type: "onToolCall",
      payload: toolCall,
      timestamp: Date.now(),
    });
    cortexAudio.playToolCall();
  }

  public emitConsensus(payload: {
    consensusScore: number;
    agentsAgreed: number;
    totalAgents: number;
    finalPhase: CortexPhase;
    verdict: string;
  }) {
    this.emit({
      type: "onConsensus",
      payload,
      timestamp: Date.now(),
    });
    cortexAudio.playConsensusChime();
  }

  public emitPhaseChange(phase: CortexPhase) {
    this.emit({
      type: "onPhaseChange",
      payload: { phase },
      timestamp: Date.now(),
    });
  }

  public emitMetricsUpdate(metrics: Partial<CortexMetrics>) {
    this.emit({
      type: "onMetricsUpdate",
      payload: metrics,
      timestamp: Date.now(),
    });
  }

  public emitReset() {
    this.emit({
      type: "onReset",
      payload: {},
      timestamp: Date.now(),
    });
  }
}

export const cortexBus = new CortexEventBus();
