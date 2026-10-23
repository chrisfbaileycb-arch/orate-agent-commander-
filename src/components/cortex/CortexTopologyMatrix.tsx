/**
 * CORTEX Topology Matrix
 * Complete Cyberpunk-Grade Telemetry & Reasoning Visualizer for The Orator.
 * WebGL 3D Toroidal State Machine, 60fps Signal Oscilloscope,
 * Entropy Spectrum, Multi-Layered Stream Graph, and Cognitive Radar.
 */

import { useState } from "react";
import { useCortexStream } from "../../lib/cortex/useCortexStream";
import type { CortexReasoningStep } from "../../lib/cortex/types";
import CortexRibbon from "./CortexRibbon";
import CortexTorus3D from "./CortexTorus3D";
import CortexOscilloscope from "./CortexOscilloscope";
import CortexEntropyChart from "./CortexEntropyChart";
import CortexBottomStream from "./CortexBottomStream";

interface Props {
  onClose?: () => void;
  isModal?: boolean;
}

export default function CortexTopologyMatrix({ onClose, isModal = false }: Props) {
  const {
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
  } = useCortexStream();

  const [selectedStep, setSelectedStep] = useState<CortexReasoningStep | null>(null);

  const containerClasses = isModal
    ? "fixed inset-0 z-50 flex flex-col bg-abyss/95 backdrop-blur-xl p-3 sm:p-5 overflow-y-auto"
    : "relative flex flex-col gap-4 w-full my-4";

  return (
    <div className={containerClasses}>
      {/* Background Matrix Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-forge-cyan/5 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 h-96 w-96 rounded-full bg-purple-600/5 blur-3xl" />
        <div className="absolute top-1/2 right-1/3 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col gap-3.5 max-w-[1540px] mx-auto w-full">
        {/* Top Header / Modal Close & Ribbon */}
        {isModal && onClose && (
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 font-mono-hud text-xs text-forge-cyan">
              <span className="h-2 w-2 rounded-full bg-forge-cyan animate-ping" />
              <span>CORTEX TELEMETRY SYSTEM ACTIVE // SECURE ORCHESTRATION</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-seam bg-depth px-3 py-1 font-mono-hud text-xs text-pearl hover:border-forge-cyan transition-colors"
            >
              ✕ EXIT MATRIX
            </button>
          </div>
        )}

        {/* 1. TOP AGENTIC RIBBON */}
        <CortexRibbon
          phase={phase}
          scenario={scenario}
          agents={scenario.agents}
          activeToolCall={toolCalls[0]}
          isPlaying={isPlaying}
          audioMuted={audioMuted}
          audioVolume={audioVolume}
          onTogglePlay={togglePlay}
          onToggleMute={toggleMute}
          onChangeVolume={changeVolume}
          onSelectScenario={selectScenario}
          onReset={resetSimulation}
          onInjectPrompt={injectPrompt}
        />

        {/* 2. MAIN VIEWPORT GRID: 3D Torus (Center/Left) + Telemetry Stacks (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
          {/* Center 3D Interactive Torus Reasoning Manifold (7 Cols on LG) */}
          <div className="lg:col-span-7 h-[420px] sm:h-[480px] lg:h-[520px]">
            <CortexTorus3D
              phase={phase}
              consensusScore={metrics.consensusScore}
              contextLoadPct={metrics.contextLoadPct}
              tokPerSec={metrics.tokPerSec}
              reasoningSteps={reasoningSteps}
              onSelectStep={(step) => setSelectedStep(step)}
            />
          </div>

          {/* Right Real-Time Telemetry Panels (5 Cols on LG) */}
          <div className="lg:col-span-5 flex flex-col gap-3.5 justify-between">
            {/* Oscillating Signal Waveform Monitors */}
            <CortexOscilloscope metrics={metrics} />

            {/* Confidence Histogram & Token Entropy Bar Chart */}
            <CortexEntropyChart
              metrics={metrics}
              agents={scenario.agents}
              reasoningSteps={reasoningSteps}
            />
          </div>
        </div>

        {/* 3. BOTTOM TELEMETRY STACKS */}
        <CortexBottomStream
          metrics={metrics}
          agents={scenario.agents}
          events={recentEvents}
          speed={speed}
          onSpeedChange={changeSpeed}
          onTriggerChaos={() => triggerToolCall()}
          onTriggerLoop={triggerLoopBack}
          onTriggerConsensus={triggerConsensus}
        />
      </div>

      {/* Selected 3D Annotation Step Detail Modal */}
      {selectedStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl border border-forge-cyan bg-depth p-6 shadow-glow font-mono-hud">
            <div className="flex items-center justify-between border-b border-seam pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    selectedStep.loopBack ? "bg-forge-alert" : "bg-forge-cyan"
                  }`}
                />
                <span className="text-xs font-bold uppercase text-pearl">
                  STEP PIN DETAIL: {selectedStep.phase}
                </span>
              </div>
              <button
                onClick={() => setSelectedStep(null)}
                className="text-forge-dim hover:text-pearl text-sm"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <span className="text-forge-dim text-[10px] uppercase block">AGENT ARBITER</span>
                <span className="font-semibold text-forge-cyan text-sm">{selectedStep.agentName}</span>
              </div>
              <div>
                <span className="text-forge-dim text-[10px] uppercase block">INVARIANT FOCUS</span>
                <span className="font-bold text-pearl text-sm">{selectedStep.title}</span>
              </div>
              <div>
                <span className="text-forge-dim text-[10px] uppercase block">DELIBERATION DETAIL</span>
                <p className="rounded-lg border border-seam bg-abyss p-3 text-forge-dim leading-relaxed text-xs">
                  {selectedStep.detail}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="rounded border border-seam bg-abyss p-2">
                  <span className="text-forge-dim block text-[9px]">CONFIDENCE SCORE</span>
                  <span className="font-bold text-emerald-400">
                    {(selectedStep.confidence * 100).toFixed(1)}% (Threshold: 85%)
                  </span>
                </div>
                <div className="rounded border border-seam bg-abyss p-2">
                  <span className="text-forge-dim block text-[9px]">TOKENS CONSUMED</span>
                  <span className="font-bold text-forge-gold">+{selectedStep.tokenCount} tok</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStep(null)}
                className="rounded-lg bg-forge-cyan px-4 py-1.5 text-xs font-bold text-abyss hover:bg-forge-cyan/90"
              >
                CLOSE INSPECTOR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
