import React, { useState, useEffect, useRef, useCallback } from "react";
import type { SessionApi } from "../lib/session";
import type { ScarcityTelemetry } from "../lib/types";
import type { DesignExploration } from "../lib/exploration-types";
import CortexTorus3D, { type AirlockSphereState } from "./cortex/CortexTorus3D";
import LivingBuildTree from "./LivingBuildTree";
import SlideOverAppViewport from "./SlideOverAppViewport";
import { orate, hush, listen, listeningSupported, type ListenHandle } from "../lib/voice";
import {
  deriveProvenanceBadge,
  isMutatingVoiceCommand,
  useCommanderEngine,
} from "../lib/commander-engine-adapter";

interface Props {
  session: SessionApi;
  telemetry: ScarcityTelemetry;
  explorations: DesignExploration[];
  remainingExplorations: number;
  onBeginExploration: () => void;
  onOpenSandbox: (exploration: DesignExploration) => void;
  onMoveToBuild: (exploration: DesignExploration) => void;
  onBook: () => void;
  onOpenBuildPasses: () => void;
  onOpenCortex?: () => void;
}

const SPHERE_STATE_META: Record<
  AirlockSphereState,
  {
    badge: string;
    description: string;
    dotClass: string;
    borderClass: string;
    bgClass: string;
    textClass: string;
    footerBorderClass: string;
  }
> = {
  idle: {
    badge: "IDLE · CYAN READY",
    description: "No active lease or unallocated milestone",
    dotClass: "bg-cyan-400",
    borderClass: "border-cyan-400/80",
    bgClass: "bg-cyan-950/70",
    textClass: "text-cyan-100",
    footerBorderClass: "border-cyan-500/60",
  },
  running: {
    badge: "RUNNING · BLUE PULSE",
    description: "Active valid lease issued to worker",
    dotClass: "bg-blue-400 animate-ping",
    borderClass: "border-blue-400/80",
    bgClass: "bg-blue-950/70",
    textClass: "text-blue-100",
    footerBorderClass: "border-blue-500/70",
  },
  staged: {
    badge: "STAGED · AMBER GATE",
    description: "Sentinel intercepted action; pending operator gate",
    dotClass: "bg-amber-400 animate-pulse",
    borderClass: "border-amber-400/90",
    bgClass: "bg-amber-950/80",
    textClass: "text-amber-100",
    footerBorderClass: "border-amber-500/80",
  },
  verified: {
    badge: "VERIFIED · GREEN FLASH (EXIT 0)",
    description: "Step mechanically verified by exit code 0",
    dotClass: "bg-emerald-400 animate-ping",
    borderClass: "border-emerald-400/90",
    bgClass: "bg-emerald-950/80",
    textClass: "text-emerald-100",
    footerBorderClass: "border-emerald-500/80",
  },
  quarantined: {
    badge: "QUARANTINED · GLITCH RED",
    description: "Attempts exhausted, budget breached, or violation detected",
    dotClass: "bg-rose-500 animate-ping",
    borderClass: "border-rose-500/90",
    bgClass: "bg-rose-950/85",
    textClass: "text-rose-100",
    footerBorderClass: "border-rose-500/90",
  },
};

export default function Landing(_props: Props) {
  const [currentAct, setCurrentAct] = useState<"audience" | "weave" | "reveal">("audience");

  // Live Engine Adapter connected to GET /v1/missions/:id, GET /v1/audit/verify, and SSE /v1/events
  const {
    mission,
    audit,
    sphereState,
    footerSummary,
    pendingGateCount,
    activeApprovals,
    isDemoSimulation,
    sseConnected,
    isBusy,
    cockpitLocked,
    unlockError,
    unlockCockpit,
    executeDecision,
    triggerLifecycleAction,
  } = useCommanderEngine();

  const [unlockToken, setUnlockToken] = useState("");
  const [redirectNote, setRedirectNote] = useState("");
  const [showRedirectInput, setShowRedirectInput] = useState(false);
  const [ledgerReply, setLedgerReply] = useState<string | null>(null);
  const [isOratorThinking, setIsOratorThinking] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [activePrompt, setActivePrompt] = useState<string>(
    "Release 4.2 · Sovereign Production Cutover"
  );
  const [isAppDrawerOpen, setIsAppDrawerOpen] = useState<boolean>(false);

  // Vocal & Shockwave state (preserved microphone visualizer)
  const [isOratorSpeaking, setIsOratorSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [shockwaveTrigger, setShockwaveTrigger] = useState(0);
  const [waveHeights, setWaveHeights] = useState<number[]>([12, 20, 28, 16, 24, 18, 14]);

  // Weave orchestration state
  const [isTreeComplete, setIsTreeComplete] = useState(false);
  const [, setActiveAgentName] = useState("Google Gemini");
  const [isAgentGenerating, setIsAgentGenerating] = useState(true);

  const listenHandleRef = useRef<ListenHandle | null>(null);
  const hasSpokenInitialRef = useRef(false);

  // Clear any transient ledger reply whenever mission.last_event changes so the footer
  // strictly reflects mission.last_event.summary and never shows stale errors
  useEffect(() => {
    setLedgerReply(null);
  }, [mission?.last_event?.seq, mission?.last_event?.type, mission?.last_event?.summary]);

  const speakCommanderLine = useCallback(async (line: string | null) => {
    if (!line) return;
    try {
      hush();
      setIsOratorSpeaking(true);
      await orate(line);
    } catch {
      // Browser autoplay restriction before first gesture
    } finally {
      setIsOratorSpeaking(false);
    }
  }, []);

  // Speak Commander opening status on arrival
  useEffect(() => {
    let unmounted = false;

    const playGreeting = async () => {
      await new Promise((r) => setTimeout(r, 600));
      if (unmounted || hasSpokenInitialRef.current) return;
      hasSpokenInitialRef.current = true;
      try {
        setIsOratorSpeaking(true);
        await orate(footerSummary);
      } catch {
        // Fallback if gesture required
      } finally {
        if (!unmounted) setIsOratorSpeaking(false);
      }
    };

    void playGreeting();

    const handleGesture = () => {
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
      if (!hasSpokenInitialRef.current) {
        hasSpokenInitialRef.current = true;
        void playGreeting();
      }
    };

    window.addEventListener("pointerdown", handleGesture);
    window.addEventListener("keydown", handleGesture);

    return () => {
      unmounted = true;
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
    };
  }, [footerSummary]);

  // Microphone visualizer waveform animation (preserved intact)
  useEffect(() => {
    const isPulsing =
      isOratorSpeaking || isUserSpeaking || (currentAct === "weave" && isAgentGenerating);
    const interval = setInterval(() => {
      if (isPulsing) {
        setWaveHeights([
          Math.floor(8 + Math.random() * 24),
          Math.floor(14 + Math.random() * 26),
          Math.floor(18 + Math.random() * 28),
          Math.floor(12 + Math.random() * 24),
          Math.floor(16 + Math.random() * 26),
          Math.floor(10 + Math.random() * 22),
          Math.floor(14 + Math.random() * 24),
        ]);
      } else {
        setWaveHeights([8, 12, 16, 12, 14, 10, 8]);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isOratorSpeaking, isUserSpeaking, currentAct, isAgentGenerating]);

  // Live speech-to-text microphone handler (read-only ledger queries)
  const toggleUserListening = async () => {
    if (isUserSpeaking) {
      if (listenHandleRef.current) {
        listenHandleRef.current.stop();
        listenHandleRef.current = null;
      }
      setIsUserSpeaking(false);
      return;
    }

    if (!listeningSupported()) {
      setIsUserSpeaking(true);
      const simulatedText = "Status report on current step and SHA-256 audit chain depth.";
      setInputValue(simulatedText);
      setTimeout(() => {
        setIsUserSpeaking(false);
      }, 1500);
      return;
    }

    try {
      setIsUserSpeaking(true);
      const result = await listen({
        onPartial: (partialText) => {
          setInputValue(partialText);
        },
      });
      listenHandleRef.current = result.handle;
      if (result.text) {
        setInputValue(result.text);
      }
    } catch (err) {
      console.warn("[Commander] Speech recognition exception:", err);
    } finally {
      setIsUserSpeaking(false);
    }
  };

  // =========================================================================
  // ONE-TAP OPERATOR DECISIONS (Signed single-use link or CSRF-protected click)
  // =========================================================================
  const handleDecision = async (decision: "authorize" | "redirect" | "kill") => {
    if (isBusy) return;
    if (decision === "redirect" && !showRedirectInput && !redirectNote.trim()) {
      setShowRedirectInput(true);
      return;
    }

    setShockwaveTrigger((v) => v + 1);
    const primaryApproval = activeApprovals[0] ?? null;
    const note =
      decision === "redirect"
        ? redirectNote.trim() ||
          "Wrap migration inside an online shadow table swap with zero lock timeout."
        : undefined;

    const spoken = await executeDecision(decision, primaryApproval, note);
    setShowRedirectInput(false);
    setRedirectNote("");
    await speakCommanderLine(spoken);
  };

  // =========================================================================
  // LIVE ENGINE LIFECYCLE CONTROLS
  // =========================================================================
  const handleLifecycleAction = async (
    action:
      | "idle"
      | "running"
      | "staged"
      | "native_intercept"
      | "verified"
      | "failed_proof"
      | "quarantined"
  ) => {
    if (isBusy) return;
    setShockwaveTrigger((v) => v + 1);
    const spoken = await triggerLifecycleAction(action);
    await speakCommanderLine(spoken);
  };

  // =========================================================================
  // READ-ONLY LEDGER QUERY DIALOGUE ENGINE (COMMANDER_SOUL.MD)
  // =========================================================================
  const sendLedgerQuery = async (overrideText?: string) => {
    const textToSend = (overrideText ?? inputValue).trim();
    if (!textToSend) return;

    if (listenHandleRef.current) {
      listenHandleRef.current.stop();
      listenHandleRef.current = null;
      setIsUserSpeaking(false);
    }

    setInputValue("");
    setActivePrompt(textToSend);

    // Client-side guard: block Authorize / Kill / Redirect in voice or chat input
    if (isMutatingVoiceCommand(textToSend)) {
      const securityNotice =
        "Voice and chat channels are restricted to read-only ledger queries. Execute Authorize, Redirect, or Kill exclusively via signed single-use capability links or CSRF-protected cockpit controls.";
      setLedgerReply(securityNotice);
      await speakCommanderLine(securityNotice);
      return;
    }

    setShockwaveTrigger((v) => v + 1);
    setIsOratorThinking(true);

    try {
      const response = await fetch("/api/orator/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: textToSend,
        }),
      });

      const data = await response.json();
      const commanderReply =
        (response.status === 401 ? "Cockpit locked. Unlock the live cockpit to query the ledger." : undefined) ||
        data?.reply ||
        "Ledger query complete. Only mechanical proof advances the step-gated airlock.";

      setIsOratorThinking(false);
      setLedgerReply(commanderReply);
      await speakCommanderLine(commanderReply);
    } catch {
      setIsOratorThinking(false);
      const fallback =
        "Ledger query channel standing by. Refer to live mission telemetry above.";
      setLedgerReply(fallback);
      await speakCommanderLine(fallback);
    }
  };

  const sphereMeta = SPHERE_STATE_META[sphereState];
  const currentStep = mission?.current_step ?? null;
  const pendingApproval = activeApprovals[0] ?? null;
  const activeGateBadge = pendingApproval
    ? deriveProvenanceBadge({
        source: pendingApproval.source,
        tool: pendingApproval.tool,
        provenance: pendingApproval.provenance,
      })
    : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07070a] text-white flex flex-col justify-between p-2.5 sm:p-4 select-none font-mono-hud text-xs">
      {/* Top Bar: Identity + Live Engine / Demo Badge + Strict Airlock Lifecycle Pill */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="text-xs tracking-[0.2em] font-bold text-white uppercase">
            ORATOR · AGENT COMMANDER COCKPIT
          </div>

          {/* Connection / Simulation Badge */}
          {isDemoSimulation ? (
            <span
              data-testid="demo-simulation-badge"
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-950/90 px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase text-amber-100"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              DEMO SIMULATION
            </span>
          ) : (
            <span
              data-testid="live-engine-badge"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/70 bg-emerald-950/70 px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase text-emerald-100"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  sseConnected ? "bg-emerald-400 animate-pulse" : "bg-cyan-400"
                }`}
              />
              {sseConnected ? "LIVE ENGINE · SSE" : "LIVE ENGINE · HTTP"}
            </span>
          )}

          {/* Operator unlock: visitors see the labelled demo, an operator unlocks the live cockpit */}
          {cockpitLocked && (
            <form
              data-testid="cockpit-unlock-form"
              className="inline-flex flex-wrap items-center gap-1.5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await unlockCockpit(unlockToken.trim())) setUnlockToken("");
              }}
            >
              <input
                data-testid="cockpit-unlock-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={unlockToken}
                onChange={(e) => setUnlockToken(e.target.value)}
                placeholder="Operator unlock token"
                aria-label="Operator unlock token"
                className="w-44 rounded-md border border-slate-600 bg-slate-950 px-2 py-0.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={unlockToken.trim().length === 0}
                className="rounded-md border border-cyan-500/70 bg-cyan-950/70 px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase text-cyan-100 disabled:opacity-40"
              >
                Unlock live cockpit
              </button>
              {unlockError && (
                <span role="alert" className="text-xs text-red-300">
                  {unlockError}
                </span>
              )}
            </form>
          )}

          {/* Header Status Pill Strictly Bound to Live Mission State */}
          <span
            data-testid="header-status-pill"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase ${sphereMeta.borderClass} ${sphereMeta.bgClass} ${sphereMeta.textClass}`}
          >
            <span className={`h-2 w-2 rounded-full ${sphereMeta.dotClass}`} />
            {sphereMeta.badge}
          </span>
        </div>

        {/* Live Engine State Transitions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleLifecycleAction("idle")}
            disabled={isBusy}
            className={`px-2.5 py-1 rounded border text-xs font-bold tracking-wider uppercase transition ${
              sphereState === "idle"
                ? "border-cyan-400 bg-cyan-950/80 text-cyan-100"
                : "border-slate-700 bg-[#090e18] text-slate-200 hover:border-cyan-400 hover:text-white"
            }`}
            title="Reset mission to IDLE (Cyan) with no active lease"
          >
            Idle (Cyan)
          </button>
          <button
            type="button"
            onClick={() => void handleLifecycleAction("running")}
            disabled={isBusy}
            className={`px-2.5 py-1 rounded border text-xs font-bold tracking-wider uppercase transition ${
              sphereState === "running"
                ? "border-blue-400 bg-blue-950/80 text-blue-100"
                : "border-slate-700 bg-[#090e18] text-slate-200 hover:border-blue-400 hover:text-white"
            }`}
            title="Issue active worker lease (RUNNING · Blue Pulse)"
          >
            Run Lease (Blue)
          </button>
          <button
            type="button"
            onClick={() => void handleLifecycleAction("native_intercept")}
            disabled={isBusy}
            className={`px-2.5 py-1 rounded border text-xs font-bold tracking-wider uppercase transition ${
              sphereState === "staged"
                ? "border-amber-400 bg-amber-950/80 text-amber-100"
                : "border-slate-700 bg-[#090e18] text-slate-200 hover:border-amber-400 hover:text-white"
            }`}
            title="Stage PreToolUse Hook Intercept (STAGED · Amber)"
          >
            Stage Gate (Amber)
          </button>
          <button
            type="button"
            onClick={() => void handleLifecycleAction("verified")}
            disabled={isBusy}
            className={`px-2.5 py-1 rounded border text-xs font-bold tracking-wider uppercase transition ${
              sphereState === "verified"
                ? "border-emerald-400 bg-emerald-950/80 text-emerald-100"
                : "border-slate-700 bg-[#090e18] text-slate-200 hover:border-emerald-400 hover:text-white"
            }`}
            title="Run LocalWitness & mechanical verifiers with exit_code 0 (VERIFIED · Green Flash)"
          >
            Verify (Exit 0)
          </button>
          <button
            type="button"
            onClick={() => void handleLifecycleAction("quarantined")}
            disabled={isBusy}
            className={`px-2.5 py-1 rounded border text-xs font-bold tracking-wider uppercase transition ${
              sphereState === "quarantined"
                ? "border-rose-500 bg-rose-950/85 text-rose-100"
                : "border-slate-700 bg-[#090e18] text-slate-200 hover:border-rose-400 hover:text-white"
            }`}
            title="Exhaust attempt budget / quarantine step (QUARANTINED · Glitch Red)"
          >
            Quarantine (Red)
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* ACT I: 3D NEURAL SPHERE + AGENT COMMANDER HUD COCKPIT                     */}
      {/* ========================================================================= */}
      {currentAct === "audience" && (
        <div className="relative flex-1 w-full max-w-[1440px] mx-auto flex flex-col justify-between py-1 min-h-0 gap-2">
          {/* 3D Rotating Neural Sphere Strictly Bound to Live Mission State */}
          <div className="relative w-full h-[26vh] sm:h-[30vh] flex items-center justify-center shrink-0">
            <CortexTorus3D
              cleanMode={true}
              hideBorders={true}
              airlockState={sphereState}
              isOratorSpeaking={isOratorSpeaking}
              isUserSpeaking={isUserSpeaking}
              currentQuestionPrompt={
                currentStep
                  ? `STEP ${currentStep.index}/${currentStep.total_steps}: ${currentStep.title}`
                  : "AIRLOCK READY · NO ACTIVE LEASE"
              }
              currentQuestionIndex={currentStep?.index ?? 1}
              totalQuestions={currentStep?.total_steps ?? 4}
              shockwaveTrigger={shockwaveTrigger}
            />
          </div>

          {/* =================================================================== */}
          {/* AGENT COMMANDER HUD COCKPIT                                         */}
          {/* =================================================================== */}
          <div className="w-full flex-1 min-h-0 flex flex-col justify-end gap-2 z-20">
            {/* 3-Column Tactical Cockpit Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
              {/* COLUMN 1 (4 cols): CURRENT STEP & MISSION LADDER */}
              <section className="lg:col-span-4 bg-[#090e18]/95 border border-slate-700/90 rounded-xl p-3 flex flex-col justify-between min-h-0">
                <div className="space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                  <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5">
                    <span className="text-xs font-bold tracking-wider uppercase text-cyan-200">
                      Current Mission Step
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-300 truncate max-w-[190px]">
                      {mission?.title ?? "Synchronizing mission..."}
                    </span>
                  </div>

                  {currentStep ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-slate-300 tabular-nums">
                            Step {currentStep.index} of {currentStep.total_steps} · Risk{" "}
                            <span className="text-amber-200 font-bold">
                              {currentStep.risk_tier}
                            </span>
                          </div>
                          <h2 className="text-sm font-bold text-white leading-snug">
                            {currentStep.title}
                          </h2>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-block rounded border border-cyan-500/60 bg-cyan-950/60 px-2 py-0.5 text-xs font-bold uppercase text-cyan-100 tabular-nums">
                            {currentStep.status}
                          </span>
                          <div className="text-xs text-slate-300 tabular-nums mt-0.5">
                            Attempt {currentStep.attempt} / {currentStep.attempt_budget}
                          </div>
                        </div>
                      </div>

                      <div className="border-l-2 border-cyan-400 pl-2.5 py-1.5 text-xs text-slate-100 font-mono leading-relaxed bg-[#040810]/90 rounded-r">
                        {currentStep.directive}
                      </div>

                      {currentStep.operator_patch && (
                        <div className="border-l-2 border-amber-400 pl-2.5 py-1.5 text-xs text-amber-100 font-mono bg-amber-950/50 rounded-r">
                          <span className="font-bold uppercase text-amber-200">
                            Operator Redirect Patch:{" "}
                          </span>
                          {currentStep.operator_patch}
                        </div>
                      )}

                      {/* Mission Step Progression Bar */}
                      <div className="pt-1 space-y-1">
                        <div className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
                          Airlock Step Sequence
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(mission?.steps ?? []).map((s) => {
                            const isCurrent = s.id === currentStep.id;
                            const statusColor =
                              s.status === "passed"
                                ? "text-emerald-100 border-emerald-400/70 bg-emerald-950/40"
                                : s.status === "quarantined" || s.status === "killed"
                                ? "text-rose-100 border-rose-500/80 bg-rose-950/50"
                                : isCurrent
                                ? "text-cyan-100 border-cyan-400/90 bg-cyan-950/50"
                                : "text-slate-300 border-slate-700";
                            return (
                              <div
                                key={s.id}
                                className={`rounded border px-2 py-1 text-xs flex items-center justify-between gap-1 tabular-nums ${statusColor}`}
                              >
                                <span className="truncate font-medium">
                                  {s.idx}. {s.title}
                                </span>
                                <span className="uppercase text-xs font-bold shrink-0">
                                  {s.status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-200 py-4">
                      No active step allocated. Click Idle or Run Lease to initialize.
                    </div>
                  )}
                </div>

                {/* Step Metadata Footer */}
                <div className="pt-2 border-t border-slate-700/70 flex items-center justify-between text-xs text-slate-300 tabular-nums">
                  <span>
                    NONCE: <strong className="text-white">{currentStep?.nonce ?? "NONE"}</strong>
                  </span>
                  <span>
                    LEASE:{" "}
                    <strong className="text-white">
                      {currentStep?.lease_id && !currentStep.lease_revoked
                        ? currentStep.lease_id.slice(0, 12)
                        : "UNALLOCATED"}
                    </strong>
                  </span>
                </div>
              </section>

              {/* COLUMN 2 (5 cols): OBSERVED VS REPORTED VERIFICATION CARD & ONE-TAP GATES */}
              <section className="lg:col-span-5 bg-[#090e18]/95 border border-slate-700/90 rounded-xl p-3 flex flex-col justify-between min-h-0 gap-2">
                {/* Mechanical Verifier Checklist with Evidence Provenance Badges */}
                <div className="space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                  <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-700/70 pb-1.5">
                    <span className="text-xs font-bold tracking-wider uppercase text-cyan-200">
                      Verification Provenance & Checklist
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleLifecycleAction("verified")}
                        disabled={isBusy}
                        className="px-2 py-0.5 rounded border border-emerald-400/80 bg-emerald-950/60 text-xs font-bold text-emerald-100 hover:bg-emerald-900/80 transition"
                      >
                        Run Proof (Exit 0)
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleLifecycleAction("failed_proof")}
                        disabled={isBusy}
                        className="px-2 py-0.5 rounded border border-rose-400/80 bg-rose-950/50 text-xs font-bold text-rose-100 hover:bg-rose-900/70 transition"
                      >
                        Sim Fail (Exit 1)
                      </button>
                    </div>
                  </div>

                  {/* Provenance Legend Strip */}
                  <div className="flex flex-wrap items-center gap-1.5 py-0.5 text-xs">
                    <span className="rounded border border-emerald-400/80 bg-emerald-950/70 px-1.5 py-0.5 font-bold text-emerald-100">
                      [WITNESSED] LocalWitness
                    </span>
                    <span className="rounded border border-amber-400/80 bg-amber-950/70 px-1.5 py-0.5 font-bold text-amber-100">
                      [REPORTED] Worker Claim
                    </span>
                    <span className="rounded border border-violet-400/80 bg-violet-950/70 px-1.5 py-0.5 font-bold text-violet-100">
                      [NATIVE INTERCEPT: Bash/Write]
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800 border border-slate-700/80 rounded-lg bg-[#040810]/90">
                    {(currentStep?.checklist ?? []).map((item) => {
                      const provMeta = deriveProvenanceBadge({
                        type: item.type,
                        provenance: item.provenance,
                      });
                      const provStyle =
                        provMeta.tone === "green"
                          ? "border-emerald-400/80 bg-emerald-950/70 text-emerald-100"
                          : provMeta.tone === "violet"
                          ? "border-violet-400/80 bg-violet-950/70 text-violet-100"
                          : "border-amber-400/80 bg-amber-950/70 text-amber-100";

                      const statusStyle =
                        item.status === "passed"
                          ? "text-emerald-100 bg-emerald-950/80 border-emerald-400/80"
                          : item.status === "failed"
                          ? "text-rose-100 bg-rose-950/80 border-rose-400/80"
                          : "text-slate-200 bg-slate-900/90 border-slate-600";

                      return (
                        <div
                          key={item.index}
                          className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded border px-1.5 py-0.5 text-xs font-bold shrink-0 ${provStyle}`}
                                title={provMeta.description}
                              >
                                {item.badgeText || provMeta.badgeText}
                              </span>
                              <span className="font-bold text-white truncate">
                                {item.index}. {item.requirement}
                              </span>
                            </div>
                            <div className="text-xs text-slate-300 truncate mt-0.5">
                              {item.detail}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded border px-2 py-0.5 text-xs font-bold uppercase tabular-nums ${statusStyle}`}
                          >
                            {item.status === "passed"
                              ? "EXIT 0 · PASS"
                              : item.status === "failed"
                              ? "FAILED"
                              : "PENDING"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Staged / Quarantined Action Card + Dynamic Pending Gate Count + One-Tap Controls */}
                <div className="border-t border-slate-700/80 pt-2 space-y-2 shrink-0">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold uppercase tracking-wider text-amber-200 flex items-center gap-1.5 truncate">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          pendingApproval
                            ? pendingApproval.kind === "quarantine"
                              ? "bg-rose-500 animate-ping"
                              : "bg-amber-400 animate-pulse"
                            : "bg-cyan-400"
                        }`}
                      />
                      {pendingApproval
                        ? `${pendingApproval.kind.toUpperCase()} GATE · #${pendingApproval.id.slice(
                            0,
                            8
                          )}`
                        : "AIRLOCK OPERATOR GATE"}
                    </span>

                    {/* Dynamically Computed Pending Gate Counter */}
                    <span
                      data-testid="pending-gate-counter"
                      className={`rounded border px-2 py-0.5 text-xs font-bold tabular-nums shrink-0 ${
                        pendingGateCount > 0
                          ? "border-amber-400 bg-amber-950/80 text-amber-100"
                          : "border-slate-700 bg-slate-900 text-slate-200"
                      }`}
                    >
                      {pendingGateCount} Pending Gate(s)
                    </span>
                  </div>

                  <div className="text-xs text-slate-100 bg-[#040810]/95 border border-slate-700/80 rounded-lg px-2.5 py-2 font-mono leading-snug space-y-1">
                    {pendingApproval ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeGateBadge && (
                            <span
                              className={`rounded border px-1.5 py-0.5 text-xs font-bold ${
                                activeGateBadge.tone === "violet"
                                  ? "border-violet-400/80 bg-violet-950/80 text-violet-100"
                                  : "border-amber-400/80 bg-amber-950/80 text-amber-100"
                              }`}
                            >
                              {activeGateBadge.badgeText}
                            </span>
                          )}
                          <span className="text-amber-200 font-bold">
                            {pendingApproval.incident}
                          </span>
                        </div>
                        <div className="text-slate-200">{pendingApproval.reason}</div>
                      </>
                    ) : (
                      <span>
                        No pending gate queued. Use signed single-use capability links or
                        CSRF-protected buttons below to intervene on the active mission step.
                      </span>
                    )}
                  </div>

                  {showRedirectInput && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={redirectNote}
                        onChange={(e) => setRedirectNote(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void handleDecision("redirect");
                          }
                        }}
                        placeholder="Enter operator redirect instruction to inject into step directive..."
                        className="flex-1 bg-[#040810] border border-amber-400 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder:text-slate-400 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleDecision("redirect")}
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg bg-amber-400 text-black font-bold text-xs uppercase"
                      >
                        Apply Patch
                      </button>
                    </div>
                  )}

                  {/* One-Tap Authorize / Redirect / Kill Buttons (Signed Capability / CSRF Protected) */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDecision("authorize")}
                      disabled={isBusy}
                      className="rounded-lg border border-emerald-400/80 bg-emerald-950/75 hover:bg-emerald-900/90 text-emerald-100 py-2 px-3 text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                    >
                      <span>✓</span>
                      <span>Authorize</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDecision("redirect")}
                      disabled={isBusy}
                      className="rounded-lg border border-amber-400/80 bg-amber-950/75 hover:bg-amber-900/90 text-amber-100 py-2 px-3 text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                    >
                      <span>↻</span>
                      <span>Redirect</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDecision("kill")}
                      disabled={isBusy}
                      className="rounded-lg border border-rose-500/90 bg-rose-950/75 hover:bg-rose-900/90 text-rose-100 py-2 px-3 text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                    >
                      <span>✕</span>
                      <span>Kill</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* COLUMN 3 (3 cols): TENANT STATUS & CRYPTOGRAPHIC AUDIT VERIFICATION (/v1/audit/verify) */}
              <section className="lg:col-span-3 bg-[#090e18]/95 border border-slate-700/90 rounded-xl p-3 flex flex-col justify-between min-h-0 gap-2">
                <div className="space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                  <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5">
                    <span className="text-xs font-bold tracking-wider uppercase text-cyan-200">
                      Tenant & Audit Ledger
                    </span>
                    <span
                      className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${
                        mission?.tenant.status === "depleted"
                          ? "border-rose-400 text-rose-100 bg-rose-950/60"
                          : "border-emerald-400 text-emerald-100 bg-emerald-950/60"
                      }`}
                    >
                      {mission?.tenant.status ?? "online"}
                    </span>
                  </div>

                  {/* Tenant Telemetry Metrics (tabular-nums, >=12px high contrast) */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs tabular-nums">
                    <div className="bg-[#040810]/90 border border-slate-700/80 rounded-lg p-2">
                      <div className="text-xs uppercase text-slate-300">Tenant</div>
                      <div className="font-bold text-white truncate">
                        {mission?.tenant.name ?? "Sovereign Ops"}
                      </div>
                    </div>
                    <div className="bg-[#040810]/90 border border-slate-700/80 rounded-lg p-2">
                      <div className="text-xs uppercase text-slate-300">Credit Balance</div>
                      <div className="font-bold text-cyan-200">
                        {mission?.tenant.creditBalance ?? 1000} CR
                      </div>
                    </div>
                    <div className="bg-[#040810]/90 border border-slate-700/80 rounded-lg p-2">
                      <div className="text-xs uppercase text-slate-300">Burn Rate</div>
                      <div className="font-bold text-white">
                        {mission?.metrics.burnRatePerMin ?? 0}/m ·{" "}
                        {mission?.metrics.burnRatePerHour ?? 0}/h
                      </div>
                    </div>
                    <div className="bg-[#040810]/90 border border-slate-700/80 rounded-lg p-2">
                      <div className="text-xs uppercase text-slate-300">Tokens Pruned</div>
                      <div className="font-bold text-emerald-200">
                        {(mission?.metrics.tokensSaved ?? 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic SHA-256 Audit Verification Bound to GET /v1/audit/verify */}
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="uppercase tracking-wider text-slate-300 font-semibold">
                        /v1/audit/verify
                      </span>
                      <span
                        data-testid="audit-verify-badge"
                        className={`font-bold tabular-nums px-1.5 py-0.5 rounded border ${
                          audit?.ok !== false
                            ? "border-emerald-400/80 bg-emerald-950/60 text-emerald-100"
                            : "border-rose-500 bg-rose-950/80 text-rose-100"
                        }`}
                      >
                        {audit?.ok !== false ? "OK: TRUE" : "OK: FALSE"} · DEPTH{" "}
                        {audit?.count ?? 0}
                      </span>
                    </div>

                    <div className="rounded bg-[#040810]/90 border border-slate-700/70 px-2 py-1 text-xs font-mono tabular-nums text-slate-200 truncate">
                      HEAD: <span className="text-cyan-200">{audit?.headHash?.slice(0, 16) ?? "0000000000000000"}…</span>
                    </div>

                    <div className="space-y-1 text-xs font-mono tabular-nums">
                      {(audit?.records ?? []).slice(0, 4).map((entry) => (
                        <div
                          key={entry.seq}
                          className="flex items-center justify-between gap-1 rounded bg-[#040810]/90 border border-slate-800 px-2 py-1"
                        >
                          <span className="text-cyan-100 truncate">
                            #{entry.seq} {entry.type}
                          </span>
                          <span className="text-slate-300 shrink-0">
                            {entry.hash.slice(0, 10)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Secondary Action to Re-seed or View Pipeline Weave */}
                <div className="pt-1.5 border-t border-slate-700/70 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => void handleLifecycleAction("native_intercept")}
                    className="text-slate-300 hover:text-white font-semibold transition"
                  >
                    Re-stage Gate
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentAct("weave")}
                    className="text-cyan-200 hover:text-white font-bold tracking-wider uppercase transition"
                  >
                    Pipeline Weave ➔
                  </button>
                </div>
              </section>
            </div>

            {/* ================================================================= */}
            {/* FOOTER STATUS BANNER (Strictly derived from mission.last_event.summary) */}
            {/* + READ-ONLY VOICE/CHAT LEDGER QUERY DOCK                          */}
            {/* ================================================================= */}
            <footer
              className={`w-full bg-[#090e18]/95 border rounded-xl px-3 py-2 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 shrink-0 ${sphereMeta.footerBorderClass}`}
            >
              {/* Live Mission Last Event Summary (Clears stale errors immediately on transition) */}
              <div className="flex items-center gap-2 min-w-0 lg:max-w-[48%]">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${sphereMeta.dotClass}`} />
                <div
                  data-testid="footer-status-summary"
                  className="truncate text-xs font-mono text-white"
                  title={footerSummary}
                >
                  <span className="text-cyan-300 font-bold mr-1.5 uppercase">
                    [{mission?.last_event?.type ?? sphereState}]:
                  </span>
                  {isOratorThinking
                    ? "Querying cryptographic ledger..."
                    : ledgerReply ?? footerSummary}
                </div>
              </div>

              {/* Microphone Visualizer ([SPEAK] button + 7-bar waveform) + Read-Only Ledger Query Input */}
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={toggleUserListening}
                  className={`btn-forge shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    isUserSpeaking
                      ? "bg-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.8)]"
                      : "bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:scale-[1.02] shadow-[0_0_14px_rgba(245,158,11,0.35)]"
                  }`}
                  title="Voice Ledger Query (Read-Only)"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex items-end gap-0.5 h-3.5">
                      {waveHeights.map((h, i) => (
                        <span
                          key={i}
                          style={{ height: `${h * 0.7}px` }}
                          className={`w-0.5 rounded-full transition-all duration-100 ${
                            isUserSpeaking ? "bg-white" : "bg-black"
                          }`}
                        />
                      ))}
                    </span>
                    <span>{isUserSpeaking ? "LISTENING…" : "SPEAK"}</span>
                  </span>
                </button>

                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void sendLedgerQuery();
                  }}
                  placeholder={
                    isUserSpeaking
                      ? "Transcribing read-only ledger query..."
                      : "Query ledger (read-only): e.g. 'Status report', 'Why is step 1 staged?', 'Verify audit chain'..."
                  }
                  className="flex-1 bg-[#040810] border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-xs text-white placeholder:text-slate-400 outline-none focus:border-cyan-400"
                />

                <button
                  type="button"
                  onClick={() => void sendLedgerQuery()}
                  disabled={isOratorThinking || (!inputValue.trim() && !isUserSpeaking)}
                  className="btn-forge btn-primary px-3.5 py-1.5 text-xs font-bold shrink-0 rounded-xl disabled:opacity-50"
                >
                  QUERY LEDGER ↵
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACT II: THE BIG TECH WEAVE (PROGRESSIVE BUILD TREE)                       */}
      {/* ========================================================================= */}
      {currentAct === "weave" && (
        <div className="relative flex-1 w-full grid grid-cols-12 h-full gap-4 overflow-hidden animate-in fade-in duration-700 pt-2">
          <div className="col-span-12 lg:col-span-5 h-full min-h-0 flex flex-col justify-between rounded-2xl border border-slate-700 bg-[#090e18]/90 p-4 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2 text-xs">
              <span className="text-cyan-200 font-bold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                COMMANDER DELIBERATION CHAMBER
              </span>
              <button
                type="button"
                onClick={() => setCurrentAct("audience")}
                className="text-slate-200 hover:text-white text-xs font-bold"
              >
                ← Back to HUD Cockpit
              </button>
            </div>

            <div className="relative flex-1 min-h-[220px]">
              <CortexTorus3D
                cleanMode={true}
                hideBorders={true}
                airlockState={sphereState}
                isOratorSpeaking={isOratorSpeaking}
                currentQuestionPrompt={activePrompt}
                currentQuestionIndex={4}
                totalQuestions={4}
                isInquestComplete={true}
              />
            </div>

            <div className="rounded-xl border border-slate-700 bg-[#040810] p-3 text-xs font-mono text-slate-100">
              <div className="text-xs text-amber-300 uppercase font-bold mb-1">
                ACTIVE DIRECTIVE:
              </div>
              <p className="line-clamp-2 italic">"{activePrompt}"</p>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 h-full min-h-0 overflow-hidden">
            <LivingBuildTree
              activePrompt={activePrompt}
              onLaunchApp={() => setIsAppDrawerOpen(true)}
              onActiveAgentChange={(agent, generating) => {
                setActiveAgentName(agent);
                setIsAgentGenerating(generating);
              }}
              isComplete={isTreeComplete}
              setIsComplete={setIsTreeComplete}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACT III: THE REVEAL (INTERACTIVE SLIDE-OVER LAUNCHPAD)                     */}
      {/* ========================================================================= */}
      <SlideOverAppViewport
        isOpen={isAppDrawerOpen}
        activePrompt={activePrompt}
        onClose={() => setIsAppDrawerOpen(false)}
      />
    </div>
  );
}
