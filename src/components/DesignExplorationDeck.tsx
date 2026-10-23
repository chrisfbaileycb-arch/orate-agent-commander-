import type { DesignExploration } from "../lib/exploration-types";

interface Props {
  explorations: DesignExploration[];
  remainingExplorations: number;
  onOpenSandbox: (exploration: DesignExploration) => void;
  onMoveToBuild: (exploration: DesignExploration) => void;
  onStartNewExploration: () => void;
}

export default function DesignExplorationDeck({
  explorations,
  remainingExplorations,
  onOpenSandbox,
  onMoveToBuild,
  onStartNewExploration,
}: Props) {
  return (
    <div className="rounded-xl border border-seam bg-depth/60 p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-seam pb-3">
        <div>
          <div className="font-mono-hud text-[10px] tracking-[0.2em] text-forge-cyan">
            ORATOR DESIGN STUDIO // SAVED EXPLORATIONS
          </div>
          <h3 className="font-display text-base font-semibold text-pearl">
            Compare Ideas & Interactive Concept Sandboxes
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono-hud text-[11px] text-forge-dim">
            {remainingExplorations > 0 ? (
              <>
                <span className="font-bold text-forge-cyan">{remainingExplorations}</span> of 3 Design Explorations Available
              </>
            ) : (
              <span className="text-forge-gold">All 3 Design Explorations Completed</span>
            )}
          </span>

          {remainingExplorations > 0 && (
            <button
              type="button"
              onClick={onStartNewExploration}
              className="btn-forge btn-primary px-4 py-2 text-[10.5px]"
            >
              + EXPLORE NEW DIRECTION
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {explorations.map((exp, idx) => {
          const brief = exp.conceptBrief;
          return (
            <div
              key={exp.id}
              className="flex flex-col justify-between rounded-lg border border-seam bg-abyss/60 p-4 transition-all hover:border-forge-cyan/60"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono-hud text-[9px] font-bold text-forge-cyan">
                    EXPLORATION {idx + 1} OF 3
                  </span>
                  <span className="rounded bg-seam/60 px-1.5 py-0.5 font-mono-hud text-[8.5px] text-forge-dim">
                    {exp.revisionsCount > 0 ? `${exp.revisionsCount} REVISION` : "CONCEPT READY"}
                  </span>
                </div>

                <h4 className="mt-2 font-display text-sm font-semibold text-pearl">
                  {brief.appName}
                </h4>
                <p className="mt-1 text-[11px] text-forge-dim line-clamp-2">
                  {brief.problemSolved}
                </p>

                <div className="mt-3 text-[10.5px] text-pearl/80">
                  <span className="text-forge-dim">Target User:</span> {brief.targetCustomer}
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-seam/60 pt-3">
                <button
                  type="button"
                  onClick={() => onOpenSandbox(exp)}
                  className="btn-forge btn-ghost w-full py-1.5 text-[10px]"
                >
                  OPEN CONCEPT SANDBOX
                </button>
                <button
                  type="button"
                  onClick={() => onMoveToBuild(exp)}
                  className="btn-forge btn-gold w-full py-1.5 text-[10px]"
                >
                  BUILD THIS APP →
                </button>
              </div>
            </div>
          );
        })}

        {/* Empty exploration placeholders up to 3 */}
        {Array.from({ length: Math.max(0, 3 - explorations.length) }).map((_, i) => (
          <div
            key={`placeholder-${i}`}
            className="flex flex-col items-center justify-center rounded-lg border border-dashed border-seam/60 bg-abyss/20 p-6 text-center"
          >
            <span className="font-mono-hud text-xs text-forge-dim">✦</span>
            <div className="mt-2 font-mono-hud text-[10px] text-forge-dim">
              AVAILABLE DESIGN EXPLORATION
            </div>
            <p className="mt-1 text-[10.5px] text-forge-dim/70">
              Use Orator to test an alternative workflow, compare a new idea, or refine a business direction.
            </p>
            <button
              type="button"
              onClick={onStartNewExploration}
              className="btn-forge btn-ghost mt-4 px-3 py-1 text-[9.5px]"
            >
              START EXPLORATION
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
