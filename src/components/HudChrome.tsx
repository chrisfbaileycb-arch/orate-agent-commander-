import type { ScarcityAlert } from "../lib/telemetry";
import type { ScarcityTelemetry } from "../lib/types";
import VoiceConduit from "./VoiceConduit";

interface Props {
  telemetry: ScarcityTelemetry;
  alerts: ScarcityAlert[];
  remainingFree: number;
  isChartered: boolean;
  onBook: () => void;
  onBench: () => void;
  onOpenCortex?: () => void;
  onOpenBuildPasses?: () => void;
}

/**
 * Top Header & Metric Strip
 * - Brand Mark: ORATOR.AI with glowing teal sub-label SOFTWARE FORGE / AUTONOMOUS CONSENSUS SYNTHESIS
 * - Status telemetry pill strip:
 *   - FORGE CAPACITY: 92%
 *   - ACTIVE CELLS: 5 / 16
 *   - MODES: CORTEX MATRIX | MCP BENCH | VOICE ON | DESIGN EXPLORATIONS 3/6
 *   - PROVENANCE: CLAUDE SONNET 5 (ENGINEERING) + GEMINI 3.8 FLASH (SYNTHESIS)
 */
export default function HudChrome({
  telemetry,
  alerts,
  remainingFree,
  isChartered,
  onBook,
  onBench,
  onOpenCortex,
  onOpenBuildPasses,
}: Props) {
  return (
    <>
      <header className="shrink-0 h-14 border-b border-seam/80 bg-abyss/95 backdrop-blur-xl relative z-40">
        {/* Main Header Strip */}
        <div className="mx-auto flex h-full max-w-[1720px] items-center justify-between gap-3 px-3 sm:px-6">
          {/* Brand Mark with Glowing Teal Sub-label */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 32 32" className="shrink-0 drop-shadow-[0_0_8px_rgba(53,224,255,0.7)]">
                <circle cx="16" cy="16" r="13" fill="none" stroke="#35e0ff" strokeWidth="2" opacity="0.9" />
                <circle cx="16" cy="16" r="5" fill="#f2c14e" />
                <circle cx="16" cy="16" r="1.5" fill="#ffffff" />
              </svg>
              <div className="absolute -inset-1 rounded-full bg-forge-cyan/20 blur-sm pointer-events-none" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5 font-mono-hud text-[14px] font-extrabold tracking-[0.2em] text-pearl">
                ORATOR<span className="text-forge-cyan drop-shadow-[0_0_10px_rgba(53,224,255,0.8)]">.AI</span>
              </div>
              <div className="font-mono-hud text-[8.5px] sm:text-[9px] font-bold tracking-[0.24em] text-cyan-300 drop-shadow-[0_0_8px_rgba(53,224,255,0.6)] uppercase">
                SOFTWARE FORGE <span className="text-forge-dim/60 font-normal">/</span> AUTONOMOUS CONSENSUS SYNTHESIS
              </div>
            </div>
          </div>

          {/* Status Telemetry Pill Strip (Desktop / Widescreen) */}
          <div className="hidden xl:flex items-center gap-2 overflow-x-auto py-1 text-[10px] font-mono-hud">
            {/* Forge Capacity */}
            <div className="flex items-center gap-1.5 rounded-full border border-forge-cyan/40 bg-depth/90 px-3 py-1 text-pearl shadow-[0_0_12px_rgba(53,224,255,0.15)]">
              <span className="h-1.5 w-1.5 rounded-full bg-forge-cyan animate-pulse" />
              <span className="text-forge-dim">FORGE CAPACITY:</span>
              <span className="font-bold text-cyan-300">92%</span>
            </div>

            {/* Active Cells */}
            <div className="flex items-center gap-1.5 rounded-full border border-seam/80 bg-depth/80 px-3 py-1 text-pearl">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="text-forge-dim">ACTIVE CELLS:</span>
              <span className="font-bold text-amber-300">5 / 16</span>
            </div>

            {/* Modes */}
            <div className="flex items-center gap-1.5 rounded-full border border-seam/80 bg-depth/80 px-3 py-1 text-pearl">
              <span className="text-forge-dim">MODES:</span>
              <span className="text-forge-cyan font-semibold">CORTEX MATRIX</span>
              <span className="text-forge-dim/50">|</span>
              <span className="text-purple-300 font-semibold">MCP BENCH</span>
              <span className="text-forge-dim/50">|</span>
              <span className="text-emerald-400 font-semibold">VOICE ON</span>
              <span className="text-forge-dim/50">|</span>
              <span className="text-amber-300 font-semibold">DESIGN EXPLORATIONS 3/6</span>
            </div>

            {/* Provenance */}
            <div className="flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-950/30 px-3 py-1 text-pearl shadow-[0_0_10px_rgba(168,85,247,0.15)]">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span className="text-forge-dim">PROVENANCE:</span>
              <span className="font-semibold text-purple-300">CLAUDE SONNET 5 (ENGINEERING)</span>
              <span className="text-forge-dim/60">+</span>
              <span className="font-semibold text-cyan-300">GEMINI 3.8 FLASH (SYNTHESIS)</span>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex items-center gap-2">
            {onOpenCortex && (
              <button
                onClick={onOpenCortex}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-forge-cyan/50 bg-cyan-950/40 px-2.5 py-1.5 font-mono-hud text-[10px] font-bold text-forge-cyan shadow-[0_0_12px_rgba(53,224,255,0.25)] hover:bg-cyan-900/50 hover:border-forge-cyan transition-all"
                title="Launch CORTEX Topology Matrix Telemetry Visualizer"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-forge-cyan animate-ping" />
                <span>CORTEX MATRIX</span>
              </button>
            )}
            <button
              onClick={onBench}
              className="btn-forge btn-ghost px-2.5 py-1.5 text-[10px]"
              title="MCP Tool Server Bench"
            >
              ⚙ MCP BENCH
            </button>
            <VoiceConduit />
            {onOpenBuildPasses && (
              <button
                onClick={onOpenBuildPasses}
                className="hidden md:flex btn-forge btn-gold px-2.5 py-1.5 text-[10px]"
                title="Build Passes"
              >
                ✦ PASSES
              </button>
            )}
            <button
              onClick={onBook}
              className="btn-forge btn-ghost px-2.5 py-1.5 text-[10px]"
              title="Book production consultation slot"
            >
              BOOK
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Pill Strip Secondary Row */}
        <div className="flex xl:hidden items-center justify-between gap-2 overflow-x-auto border-t border-seam/60 bg-depth/95 px-3 py-1 text-[9.5px] font-mono-hud text-forge-dim">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-forge-cyan animate-pulse" />
            <span>CAPACITY: <span className="text-cyan-300 font-bold">92%</span></span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span>CELLS: <span className="text-amber-300 font-bold">5/16</span></span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-forge-cyan">
            <span>CORTEX | MCP | VOICE | EXP 3/6</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-purple-300">
            <span>SONNET 5 + GEMINI 3.8</span>
          </div>
        </div>
      </header>

      {/* Scarcity alerts */}
      <div className="pointer-events-none fixed bottom-24 right-4 z-40 flex w-[min(88vw,340px)] flex-col gap-2">
        {alerts.map((a) => (
          <div
            key={a.id}
            className="hud-panel animate-drift-up border-l-2 border-l-forge-gold px-3.5 py-2.5 font-mono-hud text-[10px] leading-relaxed tracking-[0.08em] text-forge-gold/90 shadow-2xl"
          >
            ⚠ {a.message}
          </div>
        ))}
      </div>
    </>
  );
}
