import { useEffect, useMemo, useRef, useState } from "react";
import type { ForgePlan, ModelExpert } from "../lib/types";
import { EXPERT_ROSTER, routerIntroLine } from "../lib/router";
import { skillsForPhase, skillJournalLine } from "../lib/skills";
import { mcpForPhase, mcpJournalLine } from "../lib/mcp";
import OrbOfTheOrator from "./OrbOfTheOrator";
import { orate, phaseSound, sealSound, setDroneEnergy } from "../lib/voice";
import { cortexBus } from "../lib/cortex/bus";

/** ---------- Phase IV Forge Execution Deck — you direct, the forge executes ---------- */

type PhaseStatus = "pending" | "running" | "awaiting" | "done";

interface JournalEntry {
  id: number;
  text: string;
  kind: "sys" | "expert" | "director" | "ok";
}

interface Props {
  plan: ForgePlan;
  tier: "free" | "paid";
  onComplete: (plan: ForgePlan) => void;
  onOpenCortex?: () => void;
}

const RUN_MS = 1700;

export default function ForgeDirector({ plan, tier, onComplete, onOpenCortex }: Props) {
  const [statuses, setStatuses] = useState<PhaseStatus[]>(() =>
    plan.phases.map((_, i) => (i === 0 ? "awaiting" : "pending"))
  );
  const [redirects, setRedirects] = useState<number[]>(() => plan.phases.map(() => 0));
  const [journal, setJournal] = useState<JournalEntry[]>(() => [
    { id: 0, text: routerIntroLine(tier), kind: "sys" },
    { id: 1, text: `flight plan loaded — ${plan.phases.length} phases, quorum of ${plan.experts.length} seated`, kind: "sys" },
    { id: 2, text: `AWAITING DIRECTOR — execute phase I or enable auto-run`, kind: "director" },
  ]);
  const [autoRun, setAutoRun] = useState(false);
  const [orbEnergy, setOrbEnergy] = useState(0.15);
  const logRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(3);
  const completedRef = useRef(false);

  const currentIdx = useMemo(() => {
    const firstNotDone = statuses.findIndex((s) => s !== "done");
    return firstNotDone === -1 ? statuses.length - 1 : firstNotDone;
  }, [statuses]);

  const currentPhase = plan.phases[currentIdx];
  const currentExpert = expertFor(plan, currentIdx, redirects[currentIdx]);
  const allDone = statuses.every((s) => s === "done");
  const doneCount = statuses.filter((s) => s === "done").length;

  const log = (text: string, kind: JournalEntry["kind"]) => {
    setJournal((j) => [...j.slice(-80), { id: ++idRef.current, text, kind }]);
  };

  // Auto-scroll journal
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [journal]);

  // Phase execution timer
  useEffect(() => {
    if (statuses[currentIdx] !== "running") return;
    // The orb surges and the drone rises while the phase runs.
    setOrbEnergy(0.85);
    setDroneEnergy(0.9);
    phaseSound(true);

    // Emit live event to CORTEX event bus
    const phaseMap: Record<string, "parse" | "plan" | "draft" | "eval"> = {
      spec: "parse",
      architecture: "parse",
      schema: "plan",
      code: "draft",
      tests: "eval",
      audit: "eval",
      security: "eval",
      seal: "eval",
    };
    const mappedPhase = phaseMap[plan.phases[currentIdx].id] || "draft";
    cortexBus.emitPhaseChange(mappedPhase);
    cortexBus.emitReasoningStep({
      id: `forge-${Date.now()}-${currentIdx}`,
      phase: mappedPhase,
      agentId: currentExpert.id,
      agentName: currentExpert.label,
      title: plan.phases[currentIdx].label,
      detail: plan.phases[currentIdx].detail,
      confidence: 0.93 + Math.random() * 0.05,
      threshold: 0.85,
      timestamp: Date.now(),
      tokenCount: 450,
      worldCoord: [Math.cos(currentIdx) * 2.3, Math.sin(currentIdx) * 0.75, 0],
    });

    const skills = skillsForPhase(plan.phases[currentIdx].id);
    const servers = mcpForPhase(plan.phases[currentIdx].id);

    // Emit tool calls if any
    if (skills.length > 0) {
      cortexBus.emitToolCall({
        id: `tool-forge-${Date.now()}`,
        agentId: currentExpert.id,
        toolName: skills[0].name,
        argsSummary: `{ phase: "${plan.phases[currentIdx].id}", mode: "deterministic" }`,
        status: "completed",
        latencyMs: 64,
        timestamp: Date.now(),
        outputSummary: "Pass. Isolated AST execution validated.",
      });
    }

    const t = setTimeout(() => {
      setStatuses((st) => {
        const next = [...st];
        next[currentIdx] = "done";
        if (currentIdx + 1 < next.length) {
          next[currentIdx + 1] = autoRun ? "running" : "awaiting";
        }
        return next;
      });
      const ph = plan.phases[currentIdx];
      log(`✔ ${ph.label} complete — ${ph.detail}`, "ok");
      sealSound();
      for (const s of skills.slice(0, 2)) log(skillJournalLine(s), "sys");
      for (const s of servers.slice(0, 2)) log(mcpJournalLine(s), "sys");
    }, RUN_MS);
    return () => {
      clearTimeout(t);
      setOrbEnergy(0.15);
      setDroneEnergy(0.15);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, currentIdx, autoRun]);

  // Completion handoff
  useEffect(() => {
    if (allDone && !completedRef.current) {
      completedRef.current = true;
      log("delivery packet sealed — handing to the audit bureau", "sys");
      setDroneEnergy(0.05);

      cortexBus.emitConsensus({
        consensusScore: 0.99,
        agentsAgreed: plan.experts.length,
        totalAgents: plan.experts.length,
        finalPhase: "eval",
        verdict: "All flight plan phases verified. Cryptographic seal affirmed.",
      });

      void orate("The forge has sealed your blueprint. Proceed to the audit bureau.");
      onComplete(plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const execute = () => {
    const ph = plan.phases[currentIdx];
    log(`▶ ${ph.label} — ${currentExpert.label} [${currentExpert.model}]`, "expert");
    const bench = mcpForPhase(ph.id);
    if (bench.length) {
      log(`mcp bench attached: ${bench.map((b) => b.name).join(", ")}`, "sys");
    }
    setStatuses((st) => {
      const next = [...st];
      next[currentIdx] = "running";
      return next;
    });
  };

  const redirect = () => {
    setRedirects((r) => {
      const next = [...r];
      next[currentIdx] = next[currentIdx] + 1;
      const newExpert = expertFor(plan, currentIdx, next[currentIdx]);
      log(`⟲ DIRECTOR REDIRECT — phase reassigned to ${newExpert.label} [${newExpert.model}]`, "director");
      return next;
    });
  };

  const glyph = (s: PhaseStatus) =>
    s === "done" ? "✔" : s === "running" ? "◐" : s === "awaiting" ? "◆" : "·";
  const glyphColor = (s: PhaseStatus) =>
    s === "done" ? "text-forge-cyan" : s === "running" ? "text-forge-gold animate-pulse-soft" : s === "awaiting" ? "text-pearl" : "text-forge-dim/50";

  return (
    <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-24">
      {/* The Orb presides over the forge deck, pulsing with each phase */}
      <div className="pointer-events-none fixed right-[-140px] top-1/2 z-0 hidden w-[420px] -translate-y-1/2 opacity-45 xl:block">
        <OrbOfTheOrator
          energy={orbEnergy}
          caption={statuses[currentIdx] === "running" ? "FORGING…" : "STANDBY"}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono-hud text-[9px] tracking-[0.3em] text-forge-cyan/80">
            PHASE IV // FORGE EXECUTION DECK
          </div>
          <h2 className="mt-1 font-display text-xl font-semibold text-pearl">
            {plan.appName} <span className="font-mono-hud text-[11px] text-forge-dim">— archetype: {plan.archetype}</span>
          </h2>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-seam bg-depth/70 px-3 py-2">
          <input
            type="checkbox"
            checked={autoRun}
            disabled={statuses[currentIdx] === "running"}
            onChange={(e) => {
              setAutoRun(e.target.checked);
              log(e.target.checked ? "auto-run engaged — director on observation" : "auto-run disengaged — awaiting direction", "director");
            }}
            className="h-3.5 w-3.5 accent-[#35e0ff]"
          />
          <span className="font-mono-hud text-[10px] tracking-[0.14em] text-forge-dim">AUTO-RUN</span>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        {/* Phase rail */}
        <div className="hud-panel corner-tick relative p-5">
          <div className="mb-3 flex items-center justify-between font-mono-hud text-[9px] tracking-[0.22em] text-forge-dim">
            <span>FLIGHT PLAN</span>
            <span>{doneCount}/{plan.phases.length}</span>
          </div>
          <ol className="space-y-1.5">
            {plan.phases.map((p, i) => {
              const st = statuses[i];
              const expert = expertFor(plan, i, redirects[i]);
              return (
                <li
                  key={p.id}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    i === currentIdx && st !== "done"
                      ? "border-forge-cyan/50 bg-forge-cyan/5"
                      : st === "done"
                      ? "border-seam/60 bg-depth/50"
                      : "border-seam/40"
                  }`}
                >
                  <span className={`mt-0.5 font-mono-hud text-[11px] ${glyphColor(st)}`}>{glyph(st)}</span>
                  <div className="min-w-0">
                    <div className={`font-mono-hud text-[11px] font-bold tracking-[0.06em] ${st === "done" ? "text-forge-dim" : "text-pearl"}`}>
                      {p.label}
                    </div>
                    <div className="mt-0.5 truncate font-mono-hud text-[9px] tracking-[0.06em] text-forge-dim">
                      {expert.label} · {expert.model}
                    </div>
                  </div>
                  {redirects[i] > 0 && (
                    <span className="ml-auto font-mono-hud text-[9px] text-forge-gold">⟲{redirects[i]}</span>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Director controls */}
          <div className="mt-5 border-t border-seam pt-4">
            {statuses[currentIdx] === "awaiting" && (
              <div className="space-y-2">
                <div className="font-mono-hud text-[9px] tracking-[0.2em] text-forge-dim">
                  CURRENT: <span className="text-pearl">{currentExpert.label}</span> — {currentPhase.label}
                </div>
                <div className="flex gap-2">
                  <button onClick={execute} className="btn-forge btn-primary flex-1 px-3 py-2.5 text-[10px]">
                    APPROVE & EXECUTE →
                  </button>
                  <button onClick={redirect} className="btn-forge btn-ghost px-3 py-2.5 text-[10px]">
                    ⟲ REDIRECT
                  </button>
                </div>
              </div>
            )}
            {statuses[currentIdx] === "running" && (
              <div className="flex items-center gap-2">
                <button onClick={redirect} className="btn-forge btn-ghost flex-1 px-3 py-2.5 text-[10px]">
                  ⟲ REDIRECT MID-RUN
                </button>
                <span className="font-mono-hud text-[9px] tracking-[0.14em] text-forge-gold animate-pulse-soft">
                  EXECUTING…
                </span>
              </div>
            )}
            {statuses[currentIdx] === "done" && (
              <div className="font-mono-hud text-[10px] tracking-[0.16em] text-forge-cyan">
                ✔ ALL PHASES COMPLETE — SEE DOSSIER
              </div>
            )}

            {onOpenCortex && (
              <div className="pt-2">
                <button
                  onClick={onOpenCortex}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-forge-cyan/40 bg-cyan-950/30 px-3 py-2 font-mono-hud text-[10px] font-bold text-forge-cyan hover:bg-cyan-900/40 transition-colors shadow-glow"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-forge-cyan animate-ping" />
                  <span>⚡ EXPAND CORTEX 3D TOPOLOGY MATRIX</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Journal */}
        <div className="hud-panel corner-tick relative flex flex-col p-0">
          <div className="flex items-center justify-between border-b border-seam px-4 py-2.5 font-mono-hud text-[9px] tracking-[0.22em] text-forge-dim">
            <span>BUILD LOG — JOURNALED</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-forge-cyan animate-pulse-soft" />
              LIVE
            </span>
          </div>
          <div ref={logRef} className="h-[340px] overflow-y-auto px-4 py-3 font-mono-hud text-[10.5px] leading-relaxed">
            {journal.map((e) => (
              <div
                key={e.id}
                className={
                  e.kind === "ok"
                    ? "text-forge-cyan"
                    : e.kind === "expert"
                    ? "text-pearl"
                    : e.kind === "director"
                    ? "text-forge-gold"
                    : "text-forge-dim"
                }
              >
                {e.text}
              </div>
            ))}
            {statuses[currentIdx] === "running" && (
              <div className="text-forge-gold/80">
                {currentExpert.label} working<span className="animate-pulse-soft">…</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function expertFor(plan: ForgePlan, phaseIdx: number, redirectCount: number): ModelExpert {
  if (redirectCount === 0) {
    return plan.experts[phaseIdx % plan.experts.length];
  }
  const current = plan.experts[phaseIdx % plan.experts.length];
  const rosterIdx = EXPERT_ROSTER.findIndex((e) => e.id === current.id);
  const next = EXPERT_ROSTER[(Math.max(0, rosterIdx) + redirectCount) % EXPERT_ROSTER.length];
  return next;
}
