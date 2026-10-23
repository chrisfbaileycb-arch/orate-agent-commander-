import React, { useEffect, useRef, useState } from "react";
import { CONSORTIUM_PHASES } from "../lib/router";

interface Props {
  activePhaseIdx?: number;
  onSelectNode?: (phase: typeof CONSORTIUM_PHASES[0]) => void;
  onTabSwitch?: (tab: "runtime" | "concepts" | "source") => void;
}

interface NodeData {
  id: string;
  company: string;
  engine: string;
  duty: string;
  short: string;
  advantage: string;
  color: string;
  accentBg: string;
  accentBorder: string;
  x: number;
  y: number;
  phaseNum: number;
  tokens: string;
  latency: string;
  outputArtifact: string;
  payloadSummary: string;
}

export default function SovereignMindMap({
  activePhaseIdx = 2,
  onSelectNode,
  onTabSwitch,
}: Props) {
  const [selectedPhase, setSelectedPhase] = useState<number>(activePhaseIdx);
  const [currentRunningPhase, setCurrentRunningPhase] = useState<number>(activePhaseIdx);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([
    "[Google Gemini 3.8 Flash] 15-question interactive voice inquest completed (38,400 tokens ingested).",
    "[AWS Bedrock / Kiro] Cloud isolation blueprints, Docker container spec, and relational schemas generated.",
    "[Anthropic Claude Sonnet 5] Deterministic React 18 AST compilation verified without hallucinated imports.",
  ]);

  const simulationRef = useRef<NodeJS.Timeout | null>(null);

  const nodes: NodeData[] = [
    {
      id: "google",
      company: "Google",
      engine: "Gemini 3.8 / 3.7 Flash",
      duty: "PHASE 1: DISCOVERY & MULTIMODAL INGEST",
      short: "15-Q Inquest Transcripts & Context",
      advantage: "Massive 2M token context window absorbs enterprise requirements, voice audio transcripts, and design docs without truncation.",
      color: "#35e0ff",
      accentBg: "bg-cyan-950/70",
      accentBorder: "border-cyan-400",
      x: 18,
      y: 24,
      phaseNum: 1,
      tokens: "38.4k in / 4.1k out",
      latency: "140ms TTFT",
      outputArtifact: "spec/inquest-transcript.json",
      payloadSummary: "15 answered questions, architectural constraints, business requirements",
    },
    {
      id: "aws",
      company: "AWS",
      engine: "Bedrock / Kiro Engine",
      duty: "PHASE 2: ARCHITECTURE & CLOUD SPECS",
      short: "IAM, Schemas, Cloud Isolation",
      advantage: "Spec-driven systems engineering. Generates deployment blueprints (Docker, ECS, Lambda), relational DB schemas, and cloud isolation boundaries.",
      color: "#f59e0b",
      accentBg: "bg-amber-950/70",
      accentBorder: "border-amber-400",
      x: 50,
      y: 20,
      phaseNum: 2,
      tokens: "12.8k in / 8.5k out",
      latency: "280ms TTFT",
      outputArtifact: "infra/cloud-spec.aws.json",
      payloadSummary: "PostgreSQL schemas, Dockerfile, IAM security policy, VPC network rules",
    },
    {
      id: "anthropic",
      company: "Anthropic",
      engine: "Claude Sonnet 5 / Claude Code",
      duty: "PHASE 3: CORE IMPLEMENTATION & TSX",
      short: "Deterministic TSX & State Machines",
      advantage: "Industry benchmark for deterministic frontend and component code, zero-hallucination styling, and strict TypeScript compilation.",
      color: "#a855f7",
      accentBg: "bg-purple-950/70",
      accentBorder: "border-purple-400",
      x: 82,
      y: 24,
      phaseNum: 3,
      tokens: "24.1k in / 16.2k out",
      latency: "310ms TTFT",
      outputArtifact: "src/App.tsx (652 LOC)",
      payloadSummary: "Tailwind UI layout, responsive reactive state, production component tree",
    },
    {
      id: "microsoft",
      company: "Microsoft",
      engine: "Copilot & Azure AI Foundry",
      duty: "PHASE 4: ENTERPRISE AUDIT & ZERO-TRUST",
      short: "Zero-Trust Scan, PRs & Unit Tests",
      advantage: "Enterprise compliance gatekeeper. Reviews code against enterprise patterns, verifies 0 CVE vulnerabilities, provisions GitHub PRs, and asserts unit tests.",
      color: "#10b981",
      accentBg: "bg-emerald-950/70",
      accentBorder: "border-emerald-400",
      x: 70,
      y: 72,
      phaseNum: 4,
      tokens: "18.2k in / 5.4k out",
      latency: "220ms TTFT",
      outputArtifact: "audit/zero-trust-report.json",
      payloadSummary: "24 passing unit tests, AST sanity verification, GitHub automated PR",
    },
    {
      id: "xai",
      company: "xAI",
      engine: "Grok Edge Intelligence",
      duty: "PHASE 5: REAL-TIME CONTEXT & CONTRACTS",
      short: "Live API Contracts & Edge Radar",
      advantage: "Edge intelligence radar. Validates external API endpoints, dependency version freshness, and live web contracts to prevent stale library churn.",
      color: "#ec4899",
      accentBg: "bg-pink-950/70",
      accentBorder: "border-pink-400",
      x: 30,
      y: 72,
      phaseNum: 5,
      tokens: "8.6k in / 2.9k out",
      latency: "190ms TTFT",
      outputArtifact: "contracts/edge-contracts.json",
      payloadSummary: "Live OpenAPI contract validation, zero deprecated packages verified",
    },
  ];

  const handoffs = [
    {
      from: nodes[0],
      to: nodes[1],
      label: "Discovery Inquest -> AWS Cloud Blueprint",
      d: "M 180 80 Q 250 50 330 75",
    },
    {
      from: nodes[1],
      to: nodes[2],
      label: "AWS Blueprint -> Claude Component AST",
      d: "M 420 80 Q 480 60 550 80",
    },
    {
      from: nodes[2],
      to: nodes[3],
      label: "Claude TSX -> Microsoft Enterprise Audit",
      d: "M 590 120 Q 560 210 510 250",
    },
    {
      from: nodes[3],
      to: nodes[4],
      label: "Zero-Trust Scan -> xAI Live Edge Radar",
      d: "M 470 270 Q 350 290 230 270",
    },
    {
      from: nodes[4],
      to: nodes[0],
      label: "Edge Validation -> Final Manufactured Binary",
      d: "M 190 240 Q 140 180 160 110",
    },
  ];

  const handleStepNext = () => {
    setCurrentRunningPhase((prev) => {
      const next = (prev + 1) % nodes.length;
      setSelectedPhase(next);
      const node = nodes[next];
      setLogs((l) => [
        `[${node.company} ${node.engine}] Handoff complete -> ${node.duty} (${node.outputArtifact})`,
        ...l.slice(0, 5),
      ]);
      return next;
    });
  };

  const toggleSimulation = () => {
    if (isSimulating) {
      if (simulationRef.current) clearInterval(simulationRef.current);
      setIsSimulating(false);
    } else {
      setIsSimulating(true);
      simulationRef.current = setInterval(() => {
        setCurrentRunningPhase((prev) => {
          const next = (prev + 1) % nodes.length;
          setSelectedPhase(next);
          const node = nodes[next];
          setLogs((l) => [
            `[${node.company} ${node.engine}] Handoff executed: ${node.outputArtifact} generated with ${node.latency}`,
            ...l.slice(0, 5),
          ]);
          return next;
        });
      }, 3200);
    }
  };

  useEffect(() => {
    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current);
    };
  }, []);

  const activeNode = nodes[selectedPhase] || nodes[0];

  return (
    <div className="relative h-full w-full select-none overflow-hidden rounded-2xl border border-seam/90 bg-abyss/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl flex flex-col justify-between">
      {/* Top Header & Sovereign Pipeline Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-seam/80 pb-3 font-mono-hud text-[10px]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
          </span>
          <span className="font-extrabold tracking-wider text-pearl text-xs">
            US SOVEREIGN CONSORTIUM // ORCHESTRATION MIND MAP
          </span>
          <span className="rounded bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 text-cyan-300 font-bold hidden sm:inline">
            DOMESTIC PIPELINE ONLY
          </span>
        </div>

        {/* Pipeline Runner Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSimulation}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 font-bold transition-all ${
              isSimulating
                ? "border-amber-400/60 bg-amber-950/70 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse"
                : "border-cyan-400/60 bg-cyan-950/70 text-cyan-300 shadow-[0_0_12px_rgba(53,224,255,0.2)] hover:bg-cyan-900/50"
            }`}
          >
            <span>{isSimulating ? "⏸ PAUSE SIMULATION" : "▶ RUN CONSORTIUM SYNTHESIS"}</span>
          </button>

          <button
            onClick={handleStepNext}
            className="rounded-lg border border-seam bg-depth px-2.5 py-1 text-pearl hover:border-forge-cyan hover:text-cyan-300 font-bold transition-all"
            title="Step to next pipeline phase"
          >
            STEP ➔
          </button>
        </div>
      </div>

      {/* SVG Canvas for Connectors & Photon Packets */}
      <div className="relative my-2 flex-1 min-h-[300px]">
        <svg
          viewBox="0 0 720 340"
          className="absolute inset-0 h-full w-full pointer-events-none"
        >
          <defs>
            <linearGradient id="gradPath1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#35e0ff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="gradPath2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="gradPath3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="gradPath4" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="gradPath5" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#35e0ff" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Handoff Paths with Animated Dash and Photon Packets */}
          {handoffs.map((h, i) => (
            <g key={i}>
              <path
                d={h.d}
                fill="none"
                stroke={`url(#gradPath${i + 1})`}
                strokeWidth="2.5"
                strokeDasharray="5,5"
                className="opacity-80"
              />
              {/* Traveling Photon Energy Packet */}
              <circle
                r="5"
                fill="#ffffff"
                className="drop-shadow-[0_0_10px_rgba(255,255,255,1)]"
              >
                <animateMotion
                  path={h.d}
                  dur={`${2.2 + i * 0.3}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </svg>

        {/* 5 Consortium Nodes Positioned on Canvas */}
        <div className="relative h-full w-full">
          {nodes.map((n, i) => {
            const isCurrentlyExecuting = i === currentRunningPhase;
            const isSelected = i === selectedPhase;

            return (
              <div
                key={n.id}
                onClick={() => {
                  setSelectedPhase(i);
                  if (onSelectNode) onSelectNode(CONSORTIUM_PHASES[i]);
                }}
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 ${
                  isCurrentlyExecuting
                    ? "scale-105 z-30"
                    : isSelected
                    ? "scale-102 z-20"
                    : "hover:scale-102 z-10 opacity-85 hover:opacity-100"
                }`}
              >
                <div
                  className={`flex flex-col gap-1 rounded-xl border p-3 shadow-2xl backdrop-blur-md transition-all ${
                    isCurrentlyExecuting
                      ? `${n.accentBorder} ${n.accentBg} shadow-[0_0_24px_rgba(53,224,255,0.45)] ring-2 ring-cyan-400/50`
                      : isSelected
                      ? `${n.accentBorder} bg-depth/95 shadow-[0_0_18px_rgba(255,255,255,0.15)]`
                      : "border-seam/80 bg-depth/80"
                  } w-[165px] sm:w-[195px]`}
                >
                  <div className="flex items-center justify-between text-[8px] font-mono-hud font-bold">
                    <span
                      style={{ color: n.color }}
                      className="flex items-center gap-1 uppercase tracking-wider"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isCurrentlyExecuting ? "animate-ping" : ""
                        }`}
                        style={{ backgroundColor: n.color }}
                      />
                      PHASE {n.phaseNum}
                    </span>
                    <span className="text-forge-dim text-[7.5px]">
                      {isCurrentlyExecuting ? "EXECUTING" : isSelected ? "INSPECTED" : "VERIFIED"}
                    </span>
                  </div>

                  <div className="font-extrabold text-[12px] text-pearl tracking-wide">
                    {n.company}
                  </div>
                  <div className="text-[10px] font-mono-hud font-bold truncate" style={{ color: n.color }}>
                    {n.engine}
                  </div>
                  <div className="text-[9px] font-mono-hud text-forge-dim/90 truncate">
                    {n.short}
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-seam/40 pt-1 text-[8px] font-mono-hud text-forge-dim">
                    <span>{n.tokens}</span>
                    <span className="text-cyan-300 font-bold">{n.latency}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Node Deep Dive Inspector & Live Streaming Ticker */}
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        {/* Deep Dive on Selected Tech Engine */}
        <div className="md:col-span-2 rounded-xl border border-seam/80 bg-depth/90 p-3 font-mono-hud text-[10px] shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-seam/40 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: activeNode.color }}
              />
              <span className="font-extrabold text-pearl text-[11px]">
                {activeNode.duty}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="rounded bg-abyss border border-seam px-2 py-0.5 text-forge-dim">
                Output: <strong className="text-cyan-300">{activeNode.outputArtifact}</strong>
              </span>
              <span className="rounded bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-emerald-300 font-bold">
                FEDRAMP HIGH
              </span>
            </div>
          </div>

          <p className="text-forge-dim leading-relaxed text-[10px] mb-2">
            <strong className="text-pearl">Engine Advantage: </strong>
            {activeNode.advantage}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-abyss/80 p-2 text-[9px] text-gray-300">
            <div>
              <span className="text-forge-gold font-bold">Handoff Payload: </span>
              {activeNode.payloadSummary}
            </div>
            <div className="text-cyan-300 font-bold">
              Latency: {activeNode.latency}
            </div>
          </div>
        </div>

        {/* Live Consortium Telemetry Stream Ticker */}
        <div className="rounded-xl border border-seam/80 bg-abyss/90 p-3 font-mono-hud text-[9px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-seam/40 pb-1.5 mb-1.5 text-forge-dim font-bold">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                CONSORTIUM TELEMETRY
              </span>
              <span>LIVE 60FPS</span>
            </div>
            <div className="space-y-1 text-forge-dim leading-tight">
              {logs.slice(0, 3).map((log, idx) => (
                <div key={idx} className="truncate">
                  <span className="text-cyan-400">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-seam/40 flex items-center justify-between text-[8.5px]">
            <span className="text-forge-dim">Consortium Quorum: 5/5 Pass</span>
            <span className="text-emerald-400 font-bold">100% Deterministic</span>
          </div>
        </div>
      </div>
    </div>
  );
}
