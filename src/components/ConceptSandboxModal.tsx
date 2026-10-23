import { useState } from "react";
import type { DesignExploration } from "../lib/exploration-types";

interface Props {
  exploration: DesignExploration;
  onClose: () => void;
  onRefineDirection: () => void;
  onMoveToCompleteBuild: (exploration: DesignExploration) => void;
}

export default function ConceptSandboxModal({
  exploration,
  onClose,
  onRefineDirection,
  onMoveToCompleteBuild,
}: Props) {
  const [activeTab, setActiveTab] = useState<"sandbox" | "brief" | "disclosures">("sandbox");
  const brief = exploration.conceptBrief;
  const sandbox = exploration.sandbox;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-seam bg-depth shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-seam px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 items-center justify-center">
              <span className="h-2.5 w-2.5 rounded-full bg-forge-cyan animate-pulse-soft" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono-hud text-[10px] tracking-[0.2em] text-forge-cyan">
                  ORATOR DESIGN STUDIO // PRIVATE CONCEPT SANDBOX
                </span>
                <span className="rounded bg-seam/60 px-2 py-0.5 font-mono-hud text-[9px] text-forge-gold">
                  EVALUATION ONLY
                </span>
              </div>
              <h3 className="font-display text-base font-semibold text-pearl">
                {brief.appName} — Concept Direction
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-forge-dim hover:text-pearl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Clear boundary notice */}
        <div className="border-b border-forge-gold/20 bg-forge-gold/5 px-6 py-2.5 text-[11px] leading-relaxed text-forge-gold/90">
          <strong>Private Concept Sandbox:</strong> This is a private, temporary environment for evaluating design, workflow, and user experience. It is not a published application or permanent deployment.
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-seam bg-depth px-6 pt-2">
          {[
            { id: "sandbox", label: "INTERACTIVE SANDBOX" },
            { id: "brief", label: "CONCEPT BRIEF & SCREENS" },
            { id: "disclosures", label: "SIMULATED BEHAVIORS & SCOPE" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as "sandbox" | "brief" | "disclosures")}
              className={`border-b-2 px-4 py-2 font-mono-hud text-[10px] tracking-widest transition-colors ${
                activeTab === t.id
                  ? "border-forge-cyan text-forge-cyan font-bold"
                  : "border-transparent text-forge-dim hover:text-pearl"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "sandbox" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-forge-dim">
                <span>Private In-Memory Evaluation Sandbox</span>
                <span className="font-mono-hud text-[10px] text-forge-cyan">
                  {exploration.modelRoutingDecision.providerModelAlias}
                </span>
              </div>

              {/* Jailed sandbox iframe */}
              <div className="relative h-[380px] w-full overflow-hidden rounded-lg border border-seam bg-abyss">
                <iframe
                  title="Orator Private Concept Sandbox"
                  sandbox="allow-scripts allow-forms"
                  srcDoc={sandbox.sandboxHtmlSrcDoc}
                  className="h-full w-full border-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={onRefineDirection}
                  className="btn-forge btn-ghost px-4 py-2 text-[10.5px]"
                >
                  ✎ REFINE THIS DIRECTION
                </button>
                <button
                  type="button"
                  onClick={() => onMoveToCompleteBuild(exploration)}
                  className="btn-forge btn-gold px-6 py-2.5 text-[11px]"
                >
                  MOVE TO COMPLETE ORATOR BUILD →
                </button>
              </div>
            </div>
          )}

          {activeTab === "brief" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-seam bg-abyss/60 p-4">
                <div className="font-mono-hud text-[10px] tracking-wider text-forge-cyan">
                  PROBLEM SOLVED & PRIMARY OUTCOME
                </div>
                <p className="mt-1 text-xs text-pearl leading-relaxed">{brief.problemSolved}</p>
                <div className="mt-2 text-[11px] text-forge-dim">
                  <span className="font-bold text-pearl">Primary User Journey:</span> {brief.primaryWorkflow}
                </div>
              </div>

              <div>
                <div className="font-mono-hud text-[10px] tracking-wider text-forge-gold mb-2">
                  PROPOSED APPLICATION SCREENS
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {brief.proposedScreens.map((s) => (
                    <div key={s.id} className="rounded-lg border border-seam bg-abyss/40 p-3">
                      <div className="font-mono-hud text-[11px] font-bold text-pearl">{s.name}</div>
                      <p className="mt-1 text-[11px] text-forge-dim">{s.purpose}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.keyControls.map((c) => (
                          <span key={c} className="rounded bg-depth px-2 py-0.5 font-mono-hud text-[9px] text-forge-cyan">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-seam bg-abyss/40 p-3.5">
                  <div className="font-mono-hud text-[10px] text-forge-cyan">FIRST VERSION SCOPE</div>
                  <ul className="mt-1.5 list-inside list-disc text-xs text-forge-dim space-y-1">
                    {brief.firstVersionScope.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-seam bg-abyss/40 p-3.5">
                  <div className="font-mono-hud text-[10px] text-forge-dim">DEFERRED TO V2</div>
                  <ul className="mt-1.5 list-inside list-disc text-xs text-forge-dim space-y-1">
                    {brief.deferredScope.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === "disclosures" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-seam bg-abyss/60 p-4">
                <div className="font-mono-hud text-[10px] tracking-wider text-forge-gold">
                  DISCLOSED DEMONSTRATION BEHAVIORS
                </div>
                <p className="mt-1 text-xs text-forge-dim">
                  In order to evaluate layout and user journey safely in this concept sandbox, the following behaviors are simulated:
                </p>
                <ul className="mt-2 list-inside list-disc text-xs text-pearl space-y-1.5">
                  {sandbox.disclosedMockedBehaviors.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-seam bg-abyss/60 p-4">
                <div className="font-mono-hud text-[10px] tracking-wider text-forge-cyan">
                  WHAT IS INCLUDED IN A COMPLETE ORATOR BUILD
                </div>
                <p className="mt-1 text-xs text-forge-dim">
                  When you move this exploration into a Complete Orator Build, Orator executes the full closed-loop manufacturing pipeline:
                </p>
                <ul className="mt-2 list-inside list-disc text-xs text-pearl space-y-1.5">
                  {brief.completeBuildDeliverablesSummary.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
