/**
 * CORTEX Bottom Telemetry Stacks
 * 1. Multi-layered Stream Graph (Cumulative token throughput by phase / agent)
 * 2. Cognitive Radar Chart (6-axis reasoning polygon)
 * 3. Token Cost Accumulation Curve ($/token, session cost tracker)
 * 4. Latency Slider Matrix & Speed Controls
 * 5. Raw Event Stream Terminal Log
 */

import { useState, useMemo } from "react";
import type {
  CortexMetrics,
  CortexAgent,
  CortexStreamEvent,
} from "../../lib/cortex/types";

interface Props {
  metrics: CortexMetrics;
  agents: CortexAgent[];
  events: CortexStreamEvent[];
  speed: number;
  onSpeedChange: (speed: number) => void;
  onTriggerChaos: () => void;
  onTriggerLoop: () => void;
  onTriggerConsensus: () => void;
}

export default function CortexBottomStream({
  metrics,
  agents,
  events,
  speed,
  onSpeedChange,
  onTriggerChaos,
  onTriggerLoop,
  onTriggerConsensus,
}: Props) {
  const [activeTab, setActiveTab] = useState<"stream" | "radar" | "cost" | "terminal">("stream");

  // Cognitive dimensions for the 6-axis radar chart
  const radarDimensions = useMemo(() => {
    return [
      { name: "Reasoning Depth", val: 88, max: 100 },
      { name: "Determinism", val: 94, max: 100 },
      { name: "Context Density", val: metrics.contextLoadPct, max: 100 },
      { name: "Security Rigor", val: 98, max: 100 },
      { name: "Inference Velocity", val: Math.min(100, metrics.tokPerSec * 1.4), max: 100 },
      { name: "Syntactic Coherence", val: Math.min(100, metrics.consensusScore * 100), max: 100 },
    ];
  }, [metrics.contextLoadPct, metrics.tokPerSec, metrics.consensusScore]);

  // Compute Radar polygon points
  const radarPolygonPoints = useMemo(() => {
    const cx = 90;
    const cy = 80;
    const rMax = 55;
    const n = radarDimensions.length;

    return radarDimensions
      .map((dim, i) => {
        const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
        const r = (dim.val / dim.max) * rMax;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [radarDimensions]);

  // Multi-layered cumulative stream graph data simulation points
  const streamGraphPaths = useMemo(() => {
    const pointsCount = 20;
    const w = 480;
    const h = 100;

    // Generate stacked wave areas for 3 layers: Parse/Plan, Synthesis, Verification
    const layer1: number[] = [];
    const layer2: number[] = [];
    const layer3: number[] = [];

    for (let i = 0; i < pointsCount; i++) {
      const t = i / (pointsCount - 1);
      const val1 = 15 + Math.sin(t * 4) * 8 + (i * 1.5);
      const val2 = 25 + Math.cos(t * 3) * 12 + (i * 2.2);
      const val3 = 20 + Math.sin(t * 5 + 1) * 10 + (i * 1.8);
      layer1.push(val1);
      layer2.push(val1 + val2);
      layer3.push(val1 + val2 + val3);
    }

    const toSvgPath = (topValues: number[], bottomValues?: number[]) => {
      let d = `M 0,${h - (topValues[0] / 120) * h} `;
      for (let i = 1; i < pointsCount; i++) {
        const x = (w / (pointsCount - 1)) * i;
        const y = h - (topValues[i] / 120) * h;
        d += `L ${x.toFixed(1)},${y.toFixed(1)} `;
      }
      if (bottomValues) {
        for (let i = pointsCount - 1; i >= 0; i--) {
          const x = (w / (pointsCount - 1)) * i;
          const y = h - (bottomValues[i] / 120) * h;
          d += `L ${x.toFixed(1)},${y.toFixed(1)} `;
        }
      } else {
        d += `L ${w},${h} L 0,${h} `;
      }
      d += "Z";
      return d;
    };

    return {
      layer1Path: toSvgPath(layer1),
      layer2Path: toSvgPath(layer2, layer1),
      layer3Path: toSvgPath(layer3, layer2),
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-seam/90 bg-hull/80 p-3.5 backdrop-blur-md">
      {/* Top Bar with Tab Navigation and Fast Simulation Triggers */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-seam/60 pb-2">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 font-mono-hud text-[10px]">
          <button
            onClick={() => setActiveTab("stream")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              activeTab === "stream"
                ? "bg-forge-cyan/20 text-forge-cyan font-bold border border-forge-cyan/40"
                : "text-forge-dim hover:text-pearl"
            }`}
          >
            ⚡ TOKEN THROUGHPUT STREAM
          </button>
          <button
            onClick={() => setActiveTab("radar")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              activeTab === "radar"
                ? "bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40"
                : "text-forge-dim hover:text-pearl"
            }`}
          >
            ✦ COGNITIVE RADAR
          </button>
          <button
            onClick={() => setActiveTab("cost")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              activeTab === "cost"
                ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40"
                : "text-forge-dim hover:text-pearl"
            }`}
          >
            $ ACCUMULATED COST
          </button>
          <button
            onClick={() => setActiveTab("terminal")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              activeTab === "terminal"
                ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40"
                : "text-forge-dim hover:text-pearl"
            }`}
          >
            &gt;_ EVENT TERMINAL ({events.length})
          </button>
        </div>

        {/* Speed Factor Controller & Interactive Invariant Triggers */}
        <div className="flex items-center gap-2 font-mono-hud text-[10px]">
          <div className="flex items-center gap-1 rounded-lg border border-seam bg-abyss px-2 py-0.5 text-forge-dim">
            <span>SPEED:</span>
            {[0.5, 1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-1 rounded ${
                  speed === s ? "bg-forge-cyan text-abyss font-bold" : "hover:text-pearl"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Quick Triggers */}
          <button
            onClick={onTriggerLoop}
            className="rounded border border-amber-500/50 bg-amber-950/40 px-2 py-1 text-amber-300 hover:bg-amber-900/50 transition-colors"
            title="Force a confidence drop & loop-back to planner"
          >
            ⚡ LOOP GATE
          </button>
          <button
            onClick={onTriggerChaos}
            className="rounded border border-cyan-500/50 bg-cyan-950/40 px-2 py-1 text-cyan-300 hover:bg-cyan-900/50 transition-colors"
            title="Inject an on-the-fly tool execution"
          >
            ⚙ TOOL INJECT
          </button>
          <button
            onClick={onTriggerConsensus}
            className="rounded border border-emerald-500/50 bg-emerald-950/40 px-2 py-1 text-emerald-300 hover:bg-emerald-900/50 transition-colors"
            title="Force immediate multi-agent consensus convergence"
          >
            ✓ CONVERGE
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="h-40 w-full overflow-hidden">
        {/* Tab 1: Multi-layered Token Stream Graph */}
        {activeTab === "stream" && (
          <div className="grid h-full grid-cols-1 md:grid-cols-4 gap-3 items-center">
            <div className="md:col-span-3 h-full relative rounded-lg border border-seam/60 bg-abyss p-2 overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between text-[9px] font-mono-hud text-forge-dim">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-forge-cyan animate-pulse" />
                  <span className="font-bold text-pearl uppercase">THROUGHPUT STREAMGRAPH // CONCURRENT ORCHESTRATOR &amp; CODER FLOW</span>
                </span>
                <span className="text-cyan-300 font-bold">CONCURRENT FLOW: 142 TOK/S</span>
              </div>
              <svg viewBox="0 0 480 100" preserveAspectRatio="none" className="h-28 w-full">
                <defs>
                  <linearGradient id="gradGemini" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#35e0ff" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#35e0ff" stopOpacity="0.08" />
                  </linearGradient>
                  <linearGradient id="gradClaude" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.08" />
                  </linearGradient>
                  <linearGradient id="gradGate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                <path d={streamGraphPaths.layer3Path} fill="url(#gradGate)" />
                <path d={streamGraphPaths.layer2Path} fill="url(#gradClaude)" />
                <path d={streamGraphPaths.layer1Path} fill="url(#gradGemini)" />
              </svg>
              <div className="flex flex-wrap items-center gap-4 text-[8.5px] font-mono-hud text-forge-dim">
                <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-forge-cyan" /> STREAM 1: GEMINI INGEST (84 tok/s)
                </span>
                <span className="flex items-center gap-1.5 text-purple-300 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-purple-400" /> STREAM 2: CLAUDE GENERATE (58 tok/s)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> CONSENSUS VERIFICATION (PASS)
                </span>
              </div>
            </div>

            {/* Quick Metrics Pillar */}
            <div className="flex h-full flex-col justify-around rounded-lg border border-seam/60 bg-abyss p-2.5 font-mono-hud">
              <div>
                <div className="text-[8px] text-forge-dim tracking-wider uppercase">DUAL ORCHESTRATION</div>
                <div className="text-[10px] font-bold text-forge-cyan truncate">
                  Sonnet 5 + Gemini 3.8
                </div>
              </div>
              <div>
                <div className="text-[8px] text-forge-dim tracking-wider uppercase">ACTIVE INFERENCE COST</div>
                <div className="text-sm font-bold text-forge-gold">
                  $0.00748
                </div>
              </div>
              <div>
                <div className="text-[8px] text-forge-dim tracking-wider uppercase">TOTAL TOKEN STREAM</div>
                <div className="text-[11px] font-semibold text-pearl">
                  22,600 Tokens Synced
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Cognitive Radar Chart */}
        {activeTab === "radar" && (
          <div className="flex h-full items-center justify-around rounded-lg border border-seam/60 bg-abyss px-4">
            <svg width="220" height="150" viewBox="0 0 180 160" className="overflow-visible">
              {/* Radar circular spider webs */}
              {[0.25, 0.5, 0.75, 1.0].map((scale, sIdx) => {
                const r = 55 * scale;
                const points = radarDimensions
                  .map((_, i) => {
                    const angle = (Math.PI * 2 / radarDimensions.length) * i - Math.PI / 2;
                    return `${(90 + r * Math.cos(angle)).toFixed(1)},${(80 + r * Math.sin(angle)).toFixed(1)}`;
                  })
                  .join(" ");
                return (
                  <polygon
                    key={sIdx}
                    points={points}
                    fill="none"
                    stroke="#1e3a5f"
                    strokeWidth="0.8"
                    strokeDasharray={scale === 1.0 ? "none" : "2,2"}
                  />
                );
              })}

              {/* Spider radial axes */}
              {radarDimensions.map((_, i) => {
                const angle = (Math.PI * 2 / radarDimensions.length) * i - Math.PI / 2;
                return (
                  <line
                    key={i}
                    x1="90"
                    y1="80"
                    x2={(90 + 55 * Math.cos(angle)).toFixed(1)}
                    y2={(80 + 55 * Math.sin(angle)).toFixed(1)}
                    stroke="#1e3a5f"
                    strokeWidth="0.8"
                  />
                );
              })}

              {/* Data Polygon */}
              <polygon
                points={radarPolygonPoints}
                fill="rgba(168, 85, 247, 0.25)"
                stroke="#c084fc"
                strokeWidth="1.8"
              />
            </svg>

            {/* Dimension Breakdown List */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono-hud text-[9px]">
              {radarDimensions.map((dim, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-forge-dim">{dim.name}:</span>
                  <span className="font-bold text-pearl">{dim.val.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Token Cost Accumulation Curve */}
        {activeTab === "cost" && (
          <div className="flex h-full flex-col justify-between rounded-lg border border-seam/60 bg-abyss p-3 font-mono-hud">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-forge-dim">TOKEN INFERENCE COST ACCUMULATION</span>
              <span className="text-amber-400 font-bold">RATE: $0.0020 / 1K TOKENS</span>
            </div>

            <div className="flex items-center justify-around py-2">
              <div className="text-center">
                <div className="text-[9px] text-forge-dim">SESSION ELAPSED COST</div>
                <div className="text-xl font-bold text-amber-400">${metrics.estimatedCostUsd.toFixed(5)}</div>
              </div>
              <div className="h-10 w-px bg-seam" />
              <div className="text-center">
                <div className="text-[9px] text-forge-dim">BUDGET CEILING</div>
                <div className="text-xl font-bold text-pearl">$0.25000</div>
              </div>
              <div className="h-10 w-px bg-seam" />
              <div className="text-center">
                <div className="text-[9px] text-forge-dim">CEILING UTILIZATION</div>
                <div className="text-xl font-bold text-emerald-400">
                  {((metrics.estimatedCostUsd / 0.25) * 100).toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Cost Progress Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-seam/60">
              <div
                style={{ width: `${Math.min(100, (metrics.estimatedCostUsd / 0.25) * 100)}%` }}
                className="h-full bg-gradient-to-r from-cyan-400 via-amber-400 to-emerald-400 transition-all duration-300"
              />
            </div>
          </div>
        )}

        {/* Tab 4: Live Event Stream Terminal */}
        {activeTab === "terminal" && (
          <div className="h-full overflow-y-auto rounded-lg border border-seam/60 bg-abyss p-2.5 font-mono-hud text-[9px] space-y-1">
            {events.length === 0 ? (
              <div className="text-forge-dim">Listening for operational stream events...</div>
            ) : (
              events.map((evt, idx) => (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-forge-dim shrink-0">
                    [{new Date(evt.timestamp).toISOString().slice(14, 23)}]
                  </span>
                  <span
                    className={`font-bold shrink-0 ${
                      evt.type === "onConsensus"
                        ? "text-emerald-400"
                        : evt.type === "onToolCall"
                        ? "text-amber-400"
                        : evt.type === "onReasoningStep"
                        ? "text-cyan-400"
                        : "text-purple-400"
                    }`}
                  >
                    {evt.type}
                  </span>
                  <span className="text-forge-pearl/80 truncate">
                    {JSON.stringify(evt.payload)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
