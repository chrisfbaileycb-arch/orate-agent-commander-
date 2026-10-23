/**
 * CORTEX Top Agentic Ribbon & Tool Call Timeline
 * Displays phase transitions (parse -> plan -> draft -> eval -> retry),
 * active agent nodes, audio controls, scenario switcher, and play/pause controls.
 */

import { useState } from "react";
import type {
  CortexAgent,
  CortexPhase,
  CortexScenario,
  CortexScenarioId,
  CortexToolCall,
} from "../../lib/cortex/types";
import { SCENARIOS } from "../../lib/cortex/simulator";

interface Props {
  phase: CortexPhase;
  scenario: CortexScenario;
  agents: CortexAgent[];
  activeToolCall?: CortexToolCall;
  isPlaying: boolean;
  audioMuted: boolean;
  audioVolume: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onChangeVolume: (vol: number) => void;
  onSelectScenario: (id: CortexScenarioId) => void;
  onReset: () => void;
  onInjectPrompt: (prompt: string) => void;
}

export default function CortexRibbon({
  phase,
  scenario,
  agents,
  activeToolCall,
  isPlaying,
  audioMuted,
  audioVolume,
  onTogglePlay,
  onToggleMute,
  onChangeVolume,
  onSelectScenario,
  onReset,
  onInjectPrompt,
}: Props) {
  const [promptInput, setPromptInput] = useState("");
  const [showInjectModal, setShowInjectModal] = useState(false);

  const phases: CortexPhase[] = ["parse", "plan", "draft", "eval", "retry"];

  const handleInjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    onInjectPrompt(promptInput.trim());
    setPromptInput("");
    setShowInjectModal(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-seam/90 bg-hull/90 p-3 backdrop-blur-md">
      {/* Top Header Row: System Identity, Scenario Switcher, Master Playback & Audio */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-seam/60 pb-2.5">
        {/* Identity & Scenario Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forge-cyan opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-forge-cyan" />
            </span>
            <div className="leading-none">
              <div className="font-mono-hud text-[13px] font-bold tracking-widest text-pearl">
                CORTEX<span className="text-forge-cyan">.TOPOLOGY</span>
              </div>
              <div className="text-[9px] font-mono-hud text-forge-dim tracking-wider">
                ORATOR REASONING MATRIX
              </div>
            </div>
          </div>

          <div className="h-5 w-px bg-seam" />

          {/* Scenario Selector Dropdown */}
          <div className="flex items-center gap-1.5 font-mono-hud text-[10px]">
            <span className="text-forge-dim">SCENARIO:</span>
            <select
              value={scenario.id}
              onChange={(e) => onSelectScenario(e.target.value as CortexScenarioId)}
              className="rounded-lg border border-seam bg-abyss px-2.5 py-1 text-pearl focus:border-forge-cyan focus:outline-none"
            >
              {Object.values(SCENARIOS).map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Controls: Play/Pause, Audio Synth, Manual Prompt Inject */}
        <div className="flex items-center gap-2 font-mono-hud text-[10px]">
          {/* Audio Synthesizer Controls */}
          <div className="flex items-center gap-1.5 rounded-lg border border-seam bg-abyss px-2 py-1">
            <button
              onClick={onToggleMute}
              className={`font-mono-hud text-[10px] font-bold transition-colors ${
                audioMuted ? "text-forge-alert" : "text-emerald-400"
              }`}
              title="Toggle Web Audio Synths"
            >
              {audioMuted ? "🔇 MUTED" : "🔊 SYNTH ON"}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioMuted ? 0 : audioVolume}
              onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
              className="h-1.5 w-12 accent-forge-cyan cursor-pointer"
              title="Synth volume"
            />
          </div>

          {/* Prompt Injector */}
          <button
            onClick={() => setShowInjectModal(true)}
            className="rounded-lg border border-forge-cyan/40 bg-forge-cyan/10 px-2.5 py-1 text-forge-cyan hover:bg-forge-cyan/20 transition-colors"
          >
            + INJECT INTENT
          </button>

          {/* Play/Pause */}
          <button
            onClick={onTogglePlay}
            className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
              isPlaying
                ? "border border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {isPlaying ? "❚❚ PAUSE" : "▶ RUN"}
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            className="rounded-lg border border-seam bg-depth px-2 py-1 text-forge-dim hover:text-pearl transition-colors"
          >
            ↺ RESET
          </button>
        </div>
      </div>

      {/* Middle Row: Phase Transitions Ribbon & Active Tool Call Timeline */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Phase Timeline Pipeline */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {phases.map((p, idx) => {
            const isActive = phase === p;
            const isPassed = phases.indexOf(phase) > idx;

            let badgeStyle = "border-seam bg-abyss text-forge-dim";
            if (isActive) {
              if (p === "retry") {
                badgeStyle = "border-forge-alert bg-forge-alert/20 text-forge-alert font-bold shadow-glow";
              } else if (p === "eval") {
                badgeStyle = "border-purple-400 bg-purple-950/40 text-purple-300 font-bold shadow-glow";
              } else {
                badgeStyle = "border-forge-cyan bg-cyan-950/40 text-forge-cyan font-bold shadow-glow";
              }
            } else if (isPassed) {
              badgeStyle = "border-emerald-600/40 bg-emerald-950/20 text-emerald-400";
            }

            return (
              <div key={p} className="flex items-center">
                <div
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 font-mono-hud text-[10px] tracking-wider uppercase transition-all duration-200 ${badgeStyle}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-current animate-ping" : isPassed ? "bg-emerald-400" : "bg-forge-dim"
                    }`}
                  />
                  <span>{p}</span>
                </div>
                {idx < phases.length - 1 && (
                  <span className="mx-1 text-seam font-mono-hud text-[11px]">─►</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Live Active Tool Call Ticker */}
        {activeToolCall && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-1 font-mono-hud text-[10px] text-amber-300 animate-pulse-soft">
            <span className="font-bold">⚙ TOOL:</span>
            <span className="text-pearl">{activeToolCall.toolName}</span>
            <span className="text-forge-dim">({activeToolCall.latencyMs}ms)</span>
          </div>
        )}
      </div>

      {/* Bottom Row: Active Agents Cluster Badges */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="font-mono-hud text-[9px] text-forge-dim uppercase tracking-wider">
          ACTIVE AGENT NODES:
        </span>
        {agents.map((ag) => {
          const isStreaming = ag.status === "streaming";
          const isDeliberating = ag.status === "deliberating";

          return (
            <div
              key={ag.id}
              className={`flex items-center gap-2 rounded-md border border-seam bg-abyss/80 px-2 py-0.5 font-mono-hud text-[9px] ${
                isStreaming ? "border-forge-cyan/50 text-forge-cyan" : "text-forge-dim"
              }`}
            >
              <span
                style={{ backgroundColor: ag.color }}
                className={`h-1.5 w-1.5 rounded-full ${isStreaming ? "animate-ping" : ""}`}
              />
              <span className="font-semibold text-pearl">{ag.name}</span>
              <span className="opacity-70 text-[8px] uppercase">[{ag.status}]</span>
              <span className="text-forge-cyan">{(ag.confidence * 100).toFixed(0)}%</span>
            </div>
          );
        })}
      </div>

      {/* Manual Prompt Inject Modal */}
      {showInjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-forge-cyan/50 bg-depth p-5 shadow-glow">
            <div className="flex items-center justify-between border-b border-seam pb-3 font-mono-hud">
              <span className="text-xs font-bold text-forge-cyan">INJECT USER INTENT TELEMETRY</span>
              <button
                onClick={() => setShowInjectModal(false)}
                className="text-forge-dim hover:text-pearl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleInjectSubmit} className="pt-4 space-y-3 font-mono-hud text-[11px]">
              <div>
                <label className="text-forge-dim block mb-1">PROMPT SPECIFICATION / TASK:</label>
                <textarea
                  rows={3}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="e.g., Synthesize real-time WebSocket protocol with JWT authentication and fallback buffer..."
                  className="w-full rounded-lg border border-seam bg-abyss p-2.5 text-pearl focus:border-forge-cyan focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInjectModal(false)}
                  className="rounded-lg border border-seam px-3 py-1.5 text-forge-dim hover:text-pearl"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-forge-cyan px-4 py-1.5 font-bold text-abyss hover:bg-forge-cyan/90 shadow-glow"
                >
                  DISPATCH TO MATRIX
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
