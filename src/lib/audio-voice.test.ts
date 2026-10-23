import { describe, it, expect, beforeEach, vi } from "vitest";
import { AudioReactivityEngine } from "./audio-engine";
import { DevelopmentFallbackSpeechService } from "./voice-service";

describe("AudioReactivityEngine", () => {
  let engine: AudioReactivityEngine;

  beforeEach(() => {
    engine = new AudioReactivityEngine();
  });

  it("produces valid clamped AudioSignal during idle/fallback", () => {
    const signal = engine.sampleSignal(0.3);
    expect(signal.normalizedEnergy).toBeGreaterThanOrEqual(0);
    expect(signal.normalizedEnergy).toBeLessThanOrEqual(1);
    expect(signal.low).toBeGreaterThanOrEqual(0);
    expect(signal.low).toBeLessThanOrEqual(1);
    expect(signal.mid).toBeGreaterThanOrEqual(0);
    expect(signal.mid).toBeLessThanOrEqual(1);
    expect(signal.high).toBeGreaterThanOrEqual(0);
    expect(signal.high).toBeLessThanOrEqual(1);
    expect(signal.spectrum.length).toBe(64);
  });

  it("handles source disconnect safely without errors", () => {
    expect(() => engine.disconnectSource()).not.toThrow();
  });
});

describe("OratorVoiceService and Fallback", () => {
  it("honors honest fallback labeling without claiming permanent voice", () => {
    const service = new DevelopmentFallbackSpeechService();
    expect(service.capabilities.supportsAnalyzableAudio).toBe(false);
    expect(service.capabilities.isFallback).toBe(true);
    expect(service.getState()).toBe("IDLE");
  });

  it("supports state subscription and notifies listeners", () => {
    const service = new DevelopmentFallbackSpeechService();
    const states: string[] = [];
    const unsub = service.subscribe((s) => states.push(s));

    service.stop();
    expect(service.getState()).toBe("IDLE");
    unsub();
  });
});
