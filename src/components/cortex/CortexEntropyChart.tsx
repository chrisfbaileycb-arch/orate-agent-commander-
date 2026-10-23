/**
 * CORTEX Confidence Distribution & Entropy
 * - 4-column probability histogram (values 0.92, 0.78, 0.85, 0.96)
 * - Radial metric ring / circular gauge showing "CYCLE INTEGRITY: 98.4%"
 * - Quorum Health & Cost Ledger:
 *     - Active Quorum: Claude Sonnet 5 + Gemini 3.8 Flash
 *     - Live Token Tracker: Input: 18.4k | Output: 4.2k | Cost: $0.00748
 */

import { useMemo } from "react";
import type { CortexAgent, CortexMetrics, CortexReasoningStep } from "../../lib/cortex/types";

interface Props {
  metrics: CortexMetrics;
  agents: CortexAgent[];
  reasoningSteps: CortexReasoningStep[];
}

export default function CortexEntropyChart({ metrics, agents, reasoningSteps }: Props) {
  // 4-column probability histogram with values: 0.92, 0.78, 0.85, 0.96
  const histogramCols = useMemo(() => {
    return [
      { label: "P(1) SYNTAX", val: 0.92, barPct: 92, color: "from-cyan-500 to-cyan-400", border: "border-cyan-400" },
      { label: "P(2) SCHEMA", val: 0.78, barPct: 78, color: "from-amber-500 to-amber-400", border: "border-amber-400" },
      { label: "P(3) INVARIANT", val: 0.85, barPct: 85, color: "from-purple-500 to-purple-400", border: "border-purple-400" },
      { label: "P(4) CONSENSUS", val: 0.96, barPct: 96, color: "from-emerald-500 to-emerald-400", border: "border-emerald-400" },
    ];
  }, []);

  // Cycle integrity circular gauge: 98.4%
  const integrityPct = 98.4;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (integrityPct / 100) * circumference;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-seam/90 bg-hull/90 p-3 backdrop-blur-md shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-seam/60 pb-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono-hud text-[11px] font-bold tracking-wider text-pearl">
            CONFIDENCE DISTRIBUTION & ENTROPY
          </span>
        </div>
        <span className="font-mono-hud text-[9.5px] text-forge-dim">
          ENTROPY: <span className="text-forge-cyan font-bold">0.412</span>
        </span>
      </div>

      {/* Grid: 4-Column Probability Histogram (Left) & Radial Metric Ring (Right) */}
      <div className="grid grid-cols-12 gap-2.5 items-center">
        {/* 4-Column Probability Histogram (8 Cols) */}
        <div className="col-span-8 flex flex-col justify-between rounded-lg border border-seam/70 bg-abyss p-2.5">
          <div className="flex items-center justify-between text-[8.5px] font-mono-hud tracking-wider text-forge-dim mb-1">
            <span>4-COLUMN PROBABILITY HISTOGRAM</span>
            <span className="text-cyan-300">THRESHOLD &gt;= 0.85</span>
          </div>

          <div className="flex h-20 items-end gap-2 pt-1">
            {histogramCols.map((col, idx) => (
              <div key={idx} className="flex flex-1 flex-col items-center gap-1 h-full justify-end">
                <span className="font-mono-hud text-[9px] font-bold text-pearl tabular-nums">
                  {col.val.toFixed(2)}
                </span>
                <div
                  style={{ height: `${col.barPct}%` }}
                  className={`w-full rounded-t bg-gradient-to-t ${col.color} opacity-90 shadow-[0_0_8px_rgba(53,224,255,0.25)] transition-all duration-300`}
                />
                <span className="font-mono-hud text-[7px] text-forge-dim truncate max-w-full">
                  {col.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Radial Metric Ring / Circular Gauge: CYCLE INTEGRITY 98.4% (4 Cols) */}
        <div className="col-span-4 flex flex-col items-center justify-center rounded-lg border border-seam/70 bg-abyss p-2 text-center">
          <div className="relative flex items-center justify-center">
            <svg width="78" height="78" className="rotate-[-90deg]">
              <circle
                cx="39"
                cy="39"
                r={radius}
                className="stroke-seam/60"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="39"
                cy="39"
                r={radius}
                stroke="#10b981"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-700 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-mono-hud">
              <span className="text-[12px] font-extrabold text-pearl">{integrityPct}%</span>
            </div>
          </div>
          <div className="mt-1 font-mono-hud text-[8px] font-bold tracking-wider text-emerald-400 uppercase">
            CYCLE INTEGRITY: 98.4%
          </div>
        </div>
      </div>

      {/* Quorum Health & Cost Ledger */}
      <div className="rounded-lg border border-seam/80 bg-abyss/90 p-2 font-mono-hud text-[9.5px]">
        <div className="flex items-center justify-between border-b border-seam/50 pb-1 text-forge-dim text-[8.5px]">
          <span className="font-bold text-pearl flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-forge-gold animate-pulse" />
            QUORUM HEALTH & COST LEDGER
          </span>
          <span className="text-emerald-400">STATUS: CONVERGED</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5">
          {/* Active Quorum */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] text-forge-dim uppercase tracking-wider">ACTIVE QUORUM</span>
            <div className="flex items-center gap-1.5 font-semibold text-pearl">
              <span className="rounded bg-purple-950/80 border border-purple-500/40 px-1 py-0.5 text-purple-300 text-[8.5px]">
                Claude Sonnet 5
              </span>
              <span className="text-forge-dim">+</span>
              <span className="rounded bg-cyan-950/80 border border-cyan-500/40 px-1 py-0.5 text-cyan-300 text-[8.5px]">
                Gemini 3.8 Flash
              </span>
            </div>
          </div>

          {/* Live Token Tracker */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] text-forge-dim uppercase tracking-wider">LIVE TOKEN TRACKER</span>
            <div className="flex items-center gap-2 text-[9px] text-forge-pearl">
              <span>Input: <span className="font-bold text-cyan-300">18.4k</span></span>
              <span className="text-seam">|</span>
              <span>Output: <span className="font-bold text-purple-300">4.2k</span></span>
              <span className="text-seam">|</span>
              <span>Cost: <span className="font-bold text-amber-300">$0.00748</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
