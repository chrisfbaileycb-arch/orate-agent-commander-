import React, { useState, useEffect, useRef } from "react";
import CortexTorus3D from "./cortex/CortexTorus3D";
import type { CortexPhase, CortexReasoningStep } from "../lib/cortex/types";
import { CONSORTIUM_PHASES } from "../lib/router";

interface Props {
  onOpenCortex?: () => void;
}

export default function OrchestrationMind({ onOpenCortex }: Props) {
  const [activePhaseIdx, setActivePhaseIdx] = useState<number>(2); // Default to Claude (Phase 3)
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const simulationRef = useRef<NodeJS.Timeout | null>(null);

  // Sample reasoning steps for Torus HUD badges
  const sampleSteps: CortexReasoningStep[] = [
    {
      id: "step-1",
      agentId: "claude-sonnet-5",
      agentName: "Claude Sonnet 5",
      phase: "draft",
      title: "Core Implementation",
      detail: "Synthesizing deterministic React 18 POS component AST",
      confidence: 0.94,
      threshold: 0.85,
      timestamp: Date.now() - 4000,
      tokenCount: 4200,
    },
    {
      id: "step-2",
      agentId: "gemini-3.8-flash",
      agentName: "Gemini 3.8 Flash",
      phase: "parse",
      title: "Multimodal Ingestion",
      detail: "Multimodal ingest of 15-question user constraints and specs",
      confidence: 0.98,
      threshold: 0.85,
      timestamp: Date.now() - 2000,
      tokenCount: 1200,
    },
  ];

  const nodes = [
    {
      id: "google",
      company: "Google Gemini",
      engine: "Gemini 3.8 Flash",
      role: "Architecture & Ingest",
      sub: "15-Q Discovery Transcripts",
      color: "#35e0ff",
      accentBg: "bg-cyan-950/70",
      accentBorder: "border-cyan-400",
      x: 18,
      y: 28,
      phaseNum: 1,
    },
    {
      id: "aws",
      company: "AWS Bedrock",
      engine: "Bedrock / Kiro",
      role: "Cloud Spec & Schema",
      sub: "IAM, Schemas, Isolation",
      color: "#f59e0b",
      accentBg: "bg-amber-950/70",
      accentBorder: "border-amber-400",
      x: 50,
      y: 18,
      phaseNum: 2,
    },
    {
      id: "anthropic",
      company: "Anthropic Claude",
      engine: "Claude Sonnet 5",
      role: "TypeScript/JSX Synthesis",
      sub: "Deterministic React AST",
      color: "#a855f7",
      accentBg: "bg-purple-950/70",
      accentBorder: "border-purple-400",
      x: 82,
      y: 28,
      phaseNum: 3,
    },
    {
      id: "microsoft",
      company: "Microsoft Azure",
      engine: "Copilot & Foundry",
      role: "Security Audit & Tests",
      sub: "Zero-Trust Scan (0 CVE)",
      color: "#10b981",
      accentBg: "bg-emerald-950/70",
      accentBorder: "border-emerald-400",
      x: 68,
      y: 74,
      phaseNum: 4,
    },
    {
      id: "xai",
      company: "xAI Grok",
      engine: "Grok Edge Radar",
      role: "Live API Contracts",
      sub: "Edge Web Intelligence",
      color: "#ec4899",
      accentBg: "bg-pink-950/70",
      accentBorder: "border-pink-400",
      x: 32,
      y: 74,
      phaseNum: 5,
    },
  ];

  // Cyan and amber glowing pulse connectors between the consortium engines
  const connectors = [
    { from: 0, to: 1, d: "M 110 50 Q 180 20 250 35", grad: "grad1" },
    { from: 1, to: 2, d: "M 290 35 Q 360 20 430 50", grad: "grad2" },
    { from: 2, to: 3, d: "M 440 70 Q 420 120 370 145", grad: "grad3" },
    { from: 3, to: 4, d: "M 340 155 Q 270 170 200 155", grad: "grad4" },
    { from: 4, to: 0, d: "M 170 145 Q 120 110 100 70", grad: "grad5" },
  ];

  // Auto-advance simulation loop
  useEffect(() => {
    if (isSimulating) {
      simulationRef.current = setInterval(() => {
        setActivePhaseIdx((prev) => (prev + 1) % nodes.length);
      }, 3400);
    }
    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current);
    };
  }, [isSimulating, nodes.length]);

  const handleStep = () => {
    setActivePhaseIdx((prev) => (prev + 1) % nodes.length);
  };

  const activeNode = nodes[activePhaseIdx] || nodes[2];

  return (
    <div className="flex h-full flex-col gap-2.5 min-h-0 overflow-hidden">
      {/* ============ TOP: 3D THREE.JS TORUS RADIATOR ============ */}
      <section className="relative flex-[5] min-h-[200px] overflow-hidden rounded-xl border border-seam/80 bg-abyss/90 flex flex-col shadow-xl">
        {/* Torus Card Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-seam/70 px-3 py-1.5 bg-abyss/95 font-mono-hud text-[9.5px]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-extrabold text-pearl tracking-wider">
              3D CORTEX REASONING RADIATOR
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-cyan-950/80 border border-cyan-400/40 px-2 py-0.5 text-cyan-300 font-bold text-[8.5px]">
              CONF 0.96
            </span>
            <span className="text-forge-dim text-[8.5px] hidden sm:inline">
              380 TOK/S
            </span>
          </div>
        </div>

        {/* 3D Canvas Area */}
        <div className="relative flex-1 min-h-0 w-full">
          <CortexTorus3D
            phase="draft"
            consensusScore={0.96}
            contextLoadPct={78}
            tokPerSec={380}
            reasoningSteps={sampleSteps}
          />
        </div>
      </section>

      {/* ============ BOTTOM: DYNAMIC MIND MAP NODE GRAPH ============ */}
      <section className="relative flex-[6] min-h-[240px] overflow-hidden rounded-xl border border-seam/80 bg-abyss/95 flex flex-col p-2.5 shadow-xl">
        {/* Mind Map Header with Pipeline Stepper Controls */}
        <div className="shrink-0 flex items-center justify-between border-b border-seam/70 pb-2 mb-1.5 font-mono-hud text-[9.5px]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-extrabold text-pearl tracking-wider">
              US SOVEREIGN CONSORTIUM // ORCHESTRATION MIND
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsSimulating((v) => !v)}
              className={`rounded px-2 py-0.5 font-bold transition-all text-[9px] border ${
                isSimulating
                  ? "border-amber-400/60 bg-amber-950/60 text-amber-300"
                  : "border-seam bg-depth text-forge-dim hover:text-pearl"
              }`}
            >
              {isSimulating ? "⏸ PAUSE" : "▶ RUN"}
            </button>
            <button
              onClick={handleStep}
              className="rounded border border-seam bg-depth px-2 py-0.5 font-bold text-cyan-300 hover:border-cyan-400 transition-all text-[9px]"
            >
              STEP ➔
            </button>
          </div>
        </div>

        {/* SVG Canvas with Glowing Cyan and Amber Pulse Lines */}
        <div className="relative flex-1 min-h-0 w-full select-none">
          <svg
            viewBox="0 0 540 200"
            className="absolute inset-0 h-full w-full pointer-events-none"
          >
            <defs>
              {/* Cyan & Amber Glowing Linear Gradients */}
              <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#35e0ff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="grad2" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="grad3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="grad4" x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="grad5" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#35e0ff" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* Glowing Pulse Lines */}
            {connectors.map((c, i) => (
              <g key={i}>
                <path
                  d={c.d}
                  fill="none"
                  stroke={`url(#${c.grad})`}
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  className="opacity-75"
                />
                {/* Moving Photon Energy Packet */}
                <circle
                  r="3.5"
                  fill="#ffffff"
                  className="drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                >
                  <animateMotion
                    path={c.d}
                    dur={`${2.0 + i * 0.4}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            ))}
          </svg>

          {/* 5 Consortium Nodes Over Graph */}
          <div className="relative h-full w-full">
            {nodes.map((n, i) => {
              const isCurrent = i === activePhaseIdx;
              return (
                <div
                  key={n.id}
                  onClick={() => setActivePhaseIdx(i)}
                  style={{ left: `${n.x}%`, top: `${n.y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 ${
                    isCurrent ? "scale-105 z-20" : "hover:scale-102 z-10 opacity-80 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`flex flex-col gap-0.5 rounded-lg border p-1.5 shadow-lg backdrop-blur-md transition-all ${
                      isCurrent
                        ? `${n.accentBorder} ${n.accentBg} shadow-[0_0_18px_rgba(53,224,255,0.45)] ring-1 ring-cyan-400/50`
                        : "border-seam/80 bg-depth/90"
                    } w-[100px] sm:w-[115px]`}
                  >
                    <div className="flex items-center justify-between text-[7.5px] font-mono-hud font-bold">
                      <span
                        style={{ color: n.color }}
                        className="flex items-center gap-1 uppercase"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isCurrent ? "animate-ping" : ""
                          }`}
                          style={{ backgroundColor: n.color }}
                        />
                        PHASE {n.phaseNum}
                      </span>
                      <span className="text-forge-dim text-[7px]">
                        {isCurrent ? "ACTIVE" : "QUEUED"}
                      </span>
                    </div>

                    <div className="font-extrabold text-[9.5px] text-pearl truncate">
                      {n.company}
                    </div>
                    <div className="text-[8px] font-mono-hud font-bold truncate" style={{ color: n.color }}>
                      {n.role}
                    </div>
                    <div className="text-[7.5px] text-forge-dim truncate">
                      {n.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Node Lineage Ticker Strip */}
        <div className="shrink-0 mt-1 rounded border border-seam/70 bg-depth/80 px-2.5 py-1.5 font-mono-hud text-[9px] flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeNode.color }} />
            <span className="font-bold text-pearl truncate">
              {activeNode.company}:
            </span>
            <span className="text-forge-dim truncate">
              {activeNode.sub}
            </span>
          </div>
          <span className="text-cyan-300 font-bold shrink-0 ml-2">
            100% DETERMINISTIC
          </span>
        </div>
      </section>
    </div>
  );
}
