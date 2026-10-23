import React, { useState, useEffect, useMemo } from "react";
import { parseAppIntent } from "../lib/dynamic-intent-compiler";

export interface BuildNode {
  id: string;
  company: string;
  engine: string;
  phaseTitle: string;
  dutySummary: string;
  status: "idle" | "generating" | "complete";
  color: string;
  borderColor: string;
  accentBg: string;
  badges: string[];
  artifact: string;
  tokens: string;
  latency: string;
  logDetail: string;
}

interface Props {
  activePrompt: string;
  onLaunchApp: () => void;
  onActiveAgentChange?: (agentName: string, isGenerating: boolean) => void;
  isComplete: boolean;
  setIsComplete: (val: boolean) => void;
}

export default function LivingBuildTree({
  activePrompt,
  onLaunchApp,
  onActiveAgentChange,
  isComplete,
  setIsComplete,
}: Props) {
  const [currentRunningIndex, setCurrentRunningIndex] = useState<number>(0);

  // Dynamic Intent Parser: adapts node titles, duties, badges, and artifacts to user prompt!
  const intent = useMemo(() => parseAppIntent(activePrompt), [activePrompt]);

  const [nodes, setNodes] = useState<BuildNode[]>([]);

  // Update nodes dynamically whenever active prompt intent changes
  useEffect(() => {
    setNodes([
      {
        id: "node-1-gemini",
        company: "Google Gemini",
        engine: "Gemini 3.8 Flash",
        phaseTitle: intent.gemini.title,
        dutySummary: intent.gemini.duty,
        status: isComplete ? "complete" : "generating",
        color: "#35e0ff",
        borderColor: "border-cyan-400",
        accentBg: "bg-cyan-950/70",
        badges: intent.gemini.badges,
        artifact: intent.gemini.artifact,
        tokens: "38.4k Tokens Ingested",
        latency: "140ms TTFT",
        logDetail: intent.gemini.log,
      },
      {
        id: "node-2-aws",
        company: "AWS Bedrock / Kiro",
        engine: "Bedrock Kiro Engine",
        phaseTitle: intent.aws.title,
        dutySummary: intent.aws.duty,
        status: isComplete ? "complete" : "idle",
        color: "#f59e0b",
        borderColor: "border-amber-400",
        accentBg: "bg-amber-950/70",
        badges: intent.aws.badges,
        artifact: intent.aws.artifact,
        tokens: "12.8k Tokens Synthesized",
        latency: "280ms TTFT",
        logDetail: intent.aws.log,
      },
      {
        id: "node-3-claude",
        company: "Anthropic Claude",
        engine: "Claude Sonnet 5",
        phaseTitle: intent.claude.title,
        dutySummary: intent.claude.duty,
        status: isComplete ? "complete" : "idle",
        color: "#a855f7",
        borderColor: "border-purple-400",
        accentBg: "bg-purple-950/70",
        badges: intent.claude.badges,
        artifact: intent.claude.artifact,
        tokens: "24.1k Code Generated",
        latency: "310ms TTFT",
        logDetail: intent.claude.log,
      },
      {
        id: "node-4-azure",
        company: "Microsoft Azure / Copilot",
        engine: "Azure AI Foundry & Copilot",
        phaseTitle: intent.azure.title,
        dutySummary: intent.azure.duty,
        status: isComplete ? "complete" : "idle",
        color: "#10b981",
        borderColor: "border-emerald-400",
        accentBg: "bg-emerald-950/70",
        badges: intent.azure.badges,
        artifact: intent.azure.artifact,
        tokens: "18.2k Invariant Checks",
        latency: "220ms TTFT",
        logDetail: intent.azure.log,
      },
    ]);
  }, [intent, isComplete]);

  // Progressive downward build simulation
  useEffect(() => {
    if (isComplete) {
      setNodes((prev) => prev.map((n) => ({ ...n, status: "complete" })));
      if (onActiveAgentChange) onActiveAgentChange("US Sovereign Consortium", false);
      return;
    }

    const interval = setInterval(() => {
      setCurrentRunningIndex((idx) => {
        if (idx < 3) {
          const nextIdx = idx + 1;
          setNodes((prev) =>
            prev.map((n, i) => {
              if (i < nextIdx) return { ...n, status: "complete" };
              if (i === nextIdx) return { ...n, status: "generating" };
              return { ...n, status: "idle" };
            })
          );
          if (onActiveAgentChange && nodes[nextIdx]) {
            onActiveAgentChange(nodes[nextIdx].company, true);
          }
          return nextIdx;
        } else {
          // All 4 nodes complete!
          setNodes((prev) => prev.map((n) => ({ ...n, status: "complete" })));
          setIsComplete(true);
          if (onActiveAgentChange) onActiveAgentChange("Verified & Sealed", false);
          return idx;
        }
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [isComplete, nodes.length, onActiveAgentChange, setIsComplete]);

  const handleReRun = () => {
    setIsComplete(false);
    setCurrentRunningIndex(0);
    setNodes((prev) =>
      prev.map((n, i) => ({
        ...n,
        status: i === 0 ? "generating" : "idle",
      }))
    );
    if (onActiveAgentChange && nodes[0]) {
      onActiveAgentChange(nodes[0].company, true);
    }
  };

  return (
    <div className="relative flex h-full flex-col min-h-0 overflow-hidden rounded-xl border border-seam/90 bg-[#070914]/90 backdrop-blur-xl shadow-2xl">
      {/* Top Header of the Living Build Tree */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-seam/80 px-4 py-3 bg-[#0a0d1e]/95 font-mono-hud text-[10px]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isComplete ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isComplete ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          <span className="font-extrabold text-pearl tracking-wider text-[11px]">
            THE LIVING BUILD TREE // BIG TECH ORCHESTRATION WEAVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 text-cyan-300 font-bold hidden sm:inline">
            US SOVEREIGN CONSORTIUM
          </span>
          <button
            onClick={handleReRun}
            className="rounded border border-seam bg-depth px-2.5 py-1 text-[9.5px] font-bold text-forge-dim hover:text-cyan-300 hover:border-cyan-400 transition"
          >
            ↻ RE-RUN PIPELINE
          </button>
        </div>
      </div>

      {/* Dynamic Growing Downward Tree Canvas */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
        {/* Active Prompt Ingest Context Banner */}
        <div className="rounded-xl border border-seam/70 bg-[#050816] p-3 font-mono-hud text-[10px] text-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <span className="text-forge-gold font-bold shrink-0">TARGET APPLICATION:</span>
            <span className="text-pearl truncate italic font-bold">"{intent.conceptTitle}"</span>
          </div>
          <span className="text-emerald-400 font-bold shrink-0 ml-2">
            {isComplete ? "✓ COMPILED & AUDITED" : "• SYNTHESIZING…"}
          </span>
        </div>

        {/* The 4 Downward Progressive Nodes */}
        <div className="relative pl-6 sm:pl-8 space-y-4">
          {/* Vertical Downward Tree Connector Line with Glowing Gradient */}
          <div className="absolute left-3.5 sm:left-4 top-4 bottom-8 w-0.5 bg-gradient-to-b from-cyan-400 via-amber-400 to-emerald-400 opacity-60" />

          {nodes.map((node, idx) => {
            const isGenerating = node.status === "generating";
            const isDone = node.status === "complete";
            const isIdle = node.status === "idle";

            return (
              <div
                key={node.id}
                className={`relative transition-all duration-500 ${
                  isIdle ? "opacity-40" : "opacity-100"
                }`}
              >
                {/* Node Anchor Marker on Tree Trunk */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-3.5 h-4 w-4 rounded-full border-2 bg-abyss flex items-center justify-center transition-all ${
                    isDone
                      ? "border-emerald-400 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                      : isGenerating
                      ? "border-amber-400 text-amber-300 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.6)]"
                      : "border-seam text-forge-dim"
                  }`}
                >
                  <span className="text-[8px] font-bold">
                    {isDone ? "✓" : idx + 1}
                  </span>
                </div>

                {/* Node Card */}
                <div
                  className={`rounded-xl border p-3 sm:p-3.5 shadow-xl backdrop-blur-md transition-all ${
                    isGenerating
                      ? `${node.borderColor} ${node.accentBg} ring-2 ring-amber-400/50 shadow-[0_0_24px_rgba(245,158,11,0.3)]`
                      : isDone
                      ? "border-seam/90 bg-[#060b18]/90"
                      : "border-seam/40 bg-[#040812]/50"
                  }`}
                >
                  {/* Node Header */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 font-mono-hud text-[9px] border-b border-seam/40 pb-1.5 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-extrabold text-[12px] text-pearl tracking-wide"
                        style={{ color: isDone ? "#eaf6ff" : node.color }}
                      >
                        {node.company}
                      </span>
                      <span className="text-forge-dim">({node.engine})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-forge-dim">{node.tokens}</span>
                      <span
                        className={`rounded px-2 py-0.5 font-bold uppercase text-[8.5px] border ${
                          isDone
                            ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
                            : isGenerating
                            ? "bg-amber-950/80 border-amber-500/50 text-amber-300 animate-pulse"
                            : "bg-depth/70 border-seam text-forge-dim"
                        }`}
                      >
                        {isDone ? "● COMPLETE" : isGenerating ? "⚡ GENERATING…" : "QUEUED"}
                      </span>
                    </div>
                  </div>

                  {/* Title & Duty */}
                  <div className="text-[11px] font-bold text-pearl mb-1">
                    {node.phaseTitle}
                  </div>
                  <p className="text-[10px] text-forge-dim leading-relaxed mb-2.5">
                    {node.dutySummary}
                  </p>

                  {/* Live Log Details */}
                  <div className="rounded bg-[#02050c] border border-seam/60 p-2 font-mono text-[9px] text-gray-300 mb-2.5 flex items-center justify-between">
                    <div className="truncate">
                      <span className="text-cyan-400 font-bold">&gt;</span> {node.logDetail}
                    </div>
                    <span className="text-forge-dim shrink-0 ml-2">{node.latency}</span>
                  </div>

                  {/* Tool Badges Attached to this Node */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[8px] font-mono-hud text-forge-dim mr-1">ATTACHED TOOLS:</span>
                    {node.badges.map((b) => (
                      <span
                        key={b}
                        className="rounded border border-seam/80 bg-depth/80 px-2 py-0.5 font-mono-hud text-[8.5px] text-pearl/80"
                      >
                        {b}
                      </span>
                    ))}
                    <span className="ml-auto text-[8.5px] font-mono-hud text-cyan-300">
                      Artifact: {node.artifact}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* THE TERMINAL COMPLETION CARD (UNDER PHASE 4: MICROSOFT AZURE VERIFICATION) */}
        {/* ========================================================================= */}
        <div className="pt-2">
          {isComplete ? (
            <button
              id="launch-app-btn"
              onClick={onLaunchApp}
              className="w-full mt-4 py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-400/50 text-emerald-300 font-mono text-sm tracking-wider uppercase hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-pulse"
            >
              <span>★ APPLICATION FORGED &amp; VERIFIED · CLICK TO LAUNCH ★</span>
            </button>
          ) : (
            <div className="w-full mt-4 py-3.5 px-6 rounded-xl border border-seam/40 bg-[#050812]/50 text-forge-dim font-mono text-xs tracking-wider uppercase flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span>SYNTHESIZING &amp; AUDITING · AWAITING AZURE TEST VERIFICATION</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
