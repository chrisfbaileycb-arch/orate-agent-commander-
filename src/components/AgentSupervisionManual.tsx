import React, { useMemo, useState } from "react";
import type { AirlockSphereState } from "./cortex/CortexTorus3D";
import {
  buildClaudeCodeSettingsJson,
  buildCursorMcpJson,
  buildCustomSwarmHttpLoopSnippet,
  buildDockerWitnessEnvSnippet,
  buildMissionBlueprintJson,
  buildStepByStepWorkflows,
  getDefaultCoverPageOpen,
  setDefaultCoverPageOpen,
  type AgentPlatformId,
} from "../lib/supervision-manual";

interface Props {
  activeMissionId: string;
  activeMissionTitle: string;
  sphereState: AirlockSphereState;
  auditCount: number;
  auditVerified: boolean;
  pendingGateCount: number;
  isDemoSimulation: boolean;
  onEnterCockpit: () => void;
  onEnterWeave: () => void;
  onTriggerLifecycle?: (
    action: "idle" | "running" | "staged" | "native_intercept" | "verified" | "quarantined"
  ) => void;
}

const PLATFORM_TABS: Array<{
  id: AgentPlatformId;
  label: string;
  subtitle: string;
  configPath: string;
}> = [
  {
    id: "claude-code",
    label: "Claude Code (MCP + PreToolUse Hook)",
    subtitle: "Full MCP supervision plus native Bash/Write/Edit interception that fails closed on exit code 2.",
    configPath: ".claude/settings.json",
  },
  {
    id: "cursor-windsurf",
    label: "Cursor / Windsurf / Cline",
    subtitle: "Streamable HTTP MCP connection for step-gated directives, clearances, and mechanical proof.",
    configPath: ".cursor/mcp.json",
  },
  {
    id: "custom-http-swarm",
    label: "Custom Agent Swarms & SDKs (HTTP)",
    subtitle: "LangGraph, OpenAI Agents SDK, CrewAI, or custom worker loops over standard HTTP.",
    configPath: "worker-loop.sh",
  },
  {
    id: "docker-witness",
    label: "LocalWitness & Container Runner",
    subtitle: "Independent disk and command verification executed by Commander on a trusted workspace.",
    configPath: ".env + mission.json",
  },
];

const LIFECYCLE_REFERENCE: Array<{
  state: AirlockSphereState;
  name: string;
  visual: string;
  triggerCondition: string;
  operatorAction: string;
  toneClass: string;
}> = [
  {
    state: "idle",
    name: "IDLE",
    visual: "Cyan Ambient Sphere",
    triggerCondition: "Mission opened; no active worker lease allocated to the current step.",
    operatorAction: "Wait for subordinate worker to call pull_directive or click Run Lease.",
    toneClass: "border-cyan-500/50 bg-cyan-950/30 text-cyan-100",
  },
  {
    state: "running",
    name: "RUNNING",
    visual: "Fast Blue Pulse",
    triggerCondition: "Valid time-bounded lease (lse_…) and cryptographic nonce (nce_…) issued to worker.",
    operatorAction: "Monitor checklist progress; worker executes within step perimeter.",
    toneClass: "border-blue-500/50 bg-blue-950/30 text-blue-100",
  },
  {
    state: "staged",
    name: "STAGED",
    visual: "Amber Gate Hold",
    triggerCondition: "Perimeter Sentinel or PreToolUse hook intercepted an elevated/critical action.",
    operatorAction: "Inspect provenance badge and click Authorize, Redirect, or Kill.",
    toneClass: "border-amber-500/60 bg-amber-950/30 text-amber-100",
  },
  {
    state: "verified",
    name: "VERIFIED",
    visual: "Emerald Flash (Exit 0)",
    triggerCondition: "All mechanical verifiers and independent LocalWitness checks passed with exit_code === 0.",
    operatorAction: "Step seals into the macro ledger; Step N+1 unlocks automatically.",
    toneClass: "border-emerald-500/60 bg-emerald-950/30 text-emerald-100",
  },
  {
    state: "quarantined",
    name: "QUARANTINED",
    visual: "Glitch Red Lockout",
    triggerCondition: "Attempt budget exhausted, tenant credits depleted, or policy violation detected.",
    operatorAction: "Inject a Deductive Anchor redirect patch to re-open budget, or Kill mission.",
    toneClass: "border-rose-500/60 bg-rose-950/30 text-rose-100",
  },
];

export default function AgentSupervisionManual({
  activeMissionId,
  activeMissionTitle,
  sphereState,
  auditCount,
  auditVerified,
  pendingGateCount,
  isDemoSimulation,
  onEnterCockpit,
  onEnterWeave,
  onTriggerLifecycle,
}: Props) {
  const defaultOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost:3000";

  const [serverUrl, setServerUrl] = useState(defaultOrigin);
  const [missionIdInput, setMissionIdInput] = useState(activeMissionId || "msn_active_cutover");
  const [workerTokenInput, setWorkerTokenInput] = useState("cmd_live_worker_01_replace_me");
  const [workspacePathInput, setWorkspacePathInput] = useState("/app/applet");
  const [selectedPlatform, setSelectedPlatform] = useState<AgentPlatformId>("claude-code");
  const [activeStageIndex, setActiveStageIndex] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDefaultCover, setIsDefaultCover] = useState<boolean>(() => getDefaultCoverPageOpen());

  const configParams = useMemo(
    () => ({
      serverUrl,
      missionId: missionIdInput || activeMissionId || "msn_active_cutover",
      workerTokenPlaceholder: workerTokenInput,
      workspacePath: workspacePathInput,
    }),
    [serverUrl, missionIdInput, activeMissionId, workerTokenInput, workspacePathInput]
  );

  const workflows = useMemo(() => buildStepByStepWorkflows(configParams), [configParams]);
  const activeStage = workflows[activeStageIndex] ?? workflows[0]!;

  const platformConfigText = useMemo(() => {
    switch (selectedPlatform) {
      case "claude-code":
        return buildClaudeCodeSettingsJson(configParams);
      case "cursor-windsurf":
        return buildCursorMcpJson(configParams);
      case "custom-http-swarm":
        return buildCustomSwarmHttpLoopSnippet(configParams);
      case "docker-witness":
        return `${buildDockerWitnessEnvSnippet(configParams)}\n\n# --- mission.json ---\n${buildMissionBlueprintJson()}`;
    }
  }, [selectedPlatform, configParams]);

  const copyText = async (id: string, text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1800);
    } catch {
      setCopiedId(id);
    }
  };

  const toggleDefaultCover = () => {
    const next = !isDefaultCover;
    setIsDefaultCover(next);
    setDefaultCoverPageOpen(next);
  };

  const activePlatformMeta =
    PLATFORM_TABS.find((t) => t.id === selectedPlatform) ?? PLATFORM_TABS[0]!;

  return (
    <div
      data-testid="agent-supervision-manual"
      className="flex-1 min-h-0 w-full overflow-y-auto bg-[#07070a]/95 text-slate-100 px-3 py-4 sm:px-6 sm:py-6 scrollbar-thin"
    >
      <div className="mx-auto max-w-[1380px] space-y-8 pb-12">
        {/* ================================================================= */}
        {/* COVER PAGE HERO SECTION                                           */}
        {/* ================================================================= */}
        <section className="rounded-2xl border border-slate-800 bg-[#0b101b]/95 p-5 sm:p-8 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-300 font-mono tabular-nums">
                <span>ORATOR.AI · AGENT COMMANDER FIELD MANUAL</span>
                <span aria-hidden="true">·</span>
                <span>STEP-GATED AIRLOCK SUPERVISION</span>
                <span aria-hidden="true">·</span>
                <span>
                  {isDemoSimulation ? "DEMO SIMULATION" : "LIVE CONTROL PLANE CONNECTED"}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
                Connect, Hook Up, Render, and Supervise Any Agent Platform Build
              </h1>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl">
                Agent Commander sits above subordinate coding agents (Claude Code, Cursor, Windsurf,
                LangGraph, or custom swarms) as a deterministic airlock. Workers never see the macro
                task ledger, risky native tool calls are intercepted before execution, and no step
                advances without verified mechanical proof.
              </p>

              {/* Live Telemetry Summary Line (Unboxed clean metadata per design constitution) */}
              <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 font-mono tabular-nums">
                <span>
                  Active Mission: <strong className="text-white">{activeMissionTitle}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Airlock State: <strong className="text-cyan-300 uppercase">{sphereState}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Pending Gates: <strong className="text-amber-300">{pendingGateCount}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  SHA-256 Chain:{" "}
                  <strong className={auditVerified ? "text-emerald-300" : "text-rose-300"}>
                    {auditVerified ? "VERIFIED" : "UNVERIFIED"} ({auditCount} records)
                  </strong>
                </span>
              </div>
            </div>

            {/* Cover Page Primary Actions */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 lg:min-w-[250px]">
              <button
                type="button"
                data-testid="enter-live-cockpit-btn"
                onClick={onEnterCockpit}
                className="rounded-xl border border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-cyan-100 transition text-center shadow-[0_0_20px_rgba(53,224,255,0.2)]"
              >
                Open Live 3D HUD Cockpit ➔
              </button>

              <button
                type="button"
                onClick={onEnterWeave}
                className="rounded-xl border border-slate-700 bg-[#070b12] hover:border-cyan-400/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-white transition text-center"
              >
                Inspect Pipeline Weave
              </button>

              <button
                type="button"
                data-testid="toggle-default-cover-btn"
                onClick={toggleDefaultCover}
                className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition text-center ${
                  isDefaultCover
                    ? "border-emerald-500/80 bg-emerald-950/60 text-emerald-100"
                    : "border-slate-700 bg-[#070b12] text-slate-300 hover:text-white"
                }`}
              >
                {isDefaultCover
                  ? "✓ Set as Default Cover Page on Launch"
                  : "Use Manual as Default Cover Page"}
              </button>
            </div>
          </div>

          {/* 4-Pillar Architectural Guarantees */}
          <div className="mt-6 pt-6 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-[#070b12]/90 p-4 space-y-1.5">
              <div className="text-xs font-mono text-cyan-300 font-bold">
                01. Step-Gated Airlock
              </div>
              <div className="text-sm font-bold text-white">One Lease, One Milestone</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Workers only receive the current released step, a time-bounded lease (
                <code className="text-cyan-200">lse_…</code>), and a per-attempt nonce (
                <code className="text-cyan-200">nce_…</code>). Future steps stay locked.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#070b12]/90 p-4 space-y-1.5">
              <div className="text-xs font-mono text-amber-300 font-bold">
                02. Native PreToolUse Guard
              </div>
              <div className="text-sm font-bold text-white">Fail-Closed Interception</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Hooks <code className="text-amber-200">Bash</code>,{" "}
                <code className="text-amber-200">Write</code>, and{" "}
                <code className="text-amber-200">Edit</code> before execution. Destructive actions
                exit with code <code className="text-amber-200">2</code> or stage an operator gate.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#070b12]/90 p-4 space-y-1.5">
              <div className="text-xs font-mono text-emerald-300 font-bold">
                03. LocalWitness Auditor
              </div>
              <div className="text-sm font-bold text-white">Observed vs. Reported Proof</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Visibly separates <code className="text-emerald-200">[WITNESSED]</code> checks run
                independently on disk by Commander from{" "}
                <code className="text-amber-200">[REPORTED]</code> worker stdout claims.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#070b12]/90 p-4 space-y-1.5">
              <div className="text-xs font-mono text-purple-300 font-bold">
                04. Cryptographic Ledger
              </div>
              <div className="text-sm font-bold text-white">SHA-256 Chain & Signed Gates</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Every event is hash-chained in <code className="text-purple-200">store.ts</code>.
                Approvals require CSRF-protected cockpit clicks or single-use HMAC links.
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* STEP-BY-STEP WORKFLOWS (5 ORDERED OPERATIONAL STAGES)             */}
        {/* ================================================================= */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Step-by-Step Supervision Workflows
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Follow these five sequential stages to connect an external agent, wire the fail-closed
                guard, open a mission, and supervise execution in the HUD cockpit.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-300 tabular-nums">
              Stage {activeStageIndex + 1} of {workflows.length}
            </div>
          </div>

          {/* Interactive Stage Selector Bar */}
          <div
            role="tablist"
            aria-label="Supervision workflow stages"
            className="grid grid-cols-1 sm:grid-cols-5 gap-2"
          >
            {workflows.map((stage, idx) => {
              const isSelected = idx === activeStageIndex;
              return (
                <button
                  key={stage.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-testid={`workflow-stage-tab-${stage.number}`}
                  onClick={() => setActiveStageIndex(idx)}
                  className={`rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/50 text-white shadow-[0_0_15px_rgba(53,224,255,0.15)]"
                      : "border-slate-800 bg-[#0b101b]/80 text-slate-300 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-mono font-bold text-cyan-300 tabular-nums">
                    STAGE {stage.number}
                  </div>
                  <div className="text-xs font-bold mt-1 line-clamp-2">
                    {stage.title.replace(/^\d+\.\s*/, "")}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Workflow Stage Detail Panel */}
          <div
            data-testid="workflow-stage-detail"
            className="rounded-2xl border border-slate-800 bg-[#0b101b]/95 p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">{activeStage.title}</h3>
                <p className="text-xs sm:text-sm text-cyan-200">{activeStage.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={activeStageIndex === 0}
                  onClick={() => setActiveStageIndex((i) => Math.max(0, i - 1))}
                  className="rounded-lg border border-slate-700 bg-[#070b12] px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-cyan-400 disabled:opacity-40"
                >
                  ← Previous Step
                </button>
                <button
                  type="button"
                  disabled={activeStageIndex === workflows.length - 1}
                  onClick={() =>
                    setActiveStageIndex((i) => Math.min(workflows.length - 1, i + 1))
                  }
                  className="rounded-lg border border-cyan-500/70 bg-cyan-950/60 px-3 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-900 disabled:opacity-40"
                >
                  Next Step →
                </button>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {activeStage.summary}
            </p>

            {/* Stage Commands */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeStage.commands.map((cmd, cIdx) => {
                const copyKey = `stage-${activeStage.number}-cmd-${cIdx}`;
                return (
                  <div
                    key={copyKey}
                    className="rounded-xl border border-slate-800 bg-[#05080f] p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">{cmd.label}</span>
                        <button
                          type="button"
                          onClick={() => void copyText(copyKey, cmd.snippet)}
                          className="rounded border border-slate-700 bg-slate-900 hover:border-cyan-400 px-2.5 py-1 text-xs font-mono font-bold text-cyan-200 transition"
                        >
                          {copiedId === copyKey ? "✓ Copied" : "Copy Snippet"}
                        </button>
                      </div>
                      <p className="text-xs text-slate-300">{cmd.description}</p>
                    </div>

                    <pre className="overflow-x-auto rounded-lg border border-slate-800/90 bg-[#020408] p-3 text-xs font-mono text-cyan-100 leading-relaxed">
                      <code>{cmd.snippet}</code>
                    </pre>
                  </div>
                );
              })}
            </div>

            {/* Stage Verification Checkpoints & Expected Outcome */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
              <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#070b12] p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Operator Verification Checkpoints
                </div>
                <ul className="space-y-1.5 text-xs text-slate-200">
                  {activeStage.checkpoints.map((cp, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span>{cp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#070b12] p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Mechanical Gate Outcome
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-mono">
                    {activeStage.verificationOutcome}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={onEnterCockpit}
                    className="rounded-lg border border-cyan-500/70 bg-cyan-950/70 hover:bg-cyan-900 px-3 py-1.5 text-xs font-bold text-cyan-100 transition"
                  >
                    View in Live HUD Cockpit ➔
                  </button>
                  {onTriggerLifecycle && activeStage.number === "04" && (
                    <button
                      type="button"
                      onClick={() => {
                        onTriggerLifecycle("running");
                        onEnterCockpit();
                      }}
                      className="rounded-lg border border-blue-400/80 bg-blue-950/70 hover:bg-blue-900 px-3 py-1.5 text-xs font-bold text-blue-100 transition"
                    >
                      Issue Live Lease & Open Cockpit
                    </button>
                  )}
                  {onTriggerLifecycle && activeStage.number === "05" && (
                    <button
                      type="button"
                      onClick={() => {
                        onTriggerLifecycle("verified");
                        onEnterCockpit();
                      }}
                      className="rounded-lg border border-emerald-400/80 bg-emerald-950/70 hover:bg-emerald-900 px-3 py-1.5 text-xs font-bold text-emerald-100 transition"
                    >
                      Run Proof (Exit 0) & Open Cockpit
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* INTERACTIVE PLATFORM CONNECTION & HOOK GENERATOR                  */}
        {/* ================================================================= */}
        <section className="rounded-2xl border border-slate-800 bg-[#0b101b]/95 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Interactive Platform Hook & MCP Config Generator
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Customize your control plane URL, active mission ID, and worker token below to
                generate ready-to-paste configurations for any agent platform.
              </p>
            </div>
            <button
              type="button"
              data-testid="copy-platform-config-btn"
              onClick={() => void copyText("platform-config", platformConfigText)}
              className="rounded-xl border border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-100 transition shrink-0"
            >
              {copiedId === "platform-config"
                ? "✓ Copied Configuration"
                : `Copy ${activePlatformMeta.configPath}`}
            </button>
          </div>

          {/* Generator Parameter Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="space-y-1 text-xs">
              <span className="font-semibold text-slate-300">Commander Server URL</span>
              <input
                type="text"
                data-testid="manual-server-url-input"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#05080f] px-3 py-2 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-xs">
              <span className="font-semibold text-slate-300">Target Mission ID</span>
              <input
                type="text"
                data-testid="manual-mission-id-input"
                value={missionIdInput}
                onChange={(e) => setMissionIdInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#05080f] px-3 py-2 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-xs">
              <span className="font-semibold text-slate-300">Worker Bearer Credential</span>
              <input
                type="text"
                data-testid="manual-worker-token-input"
                value={workerTokenInput}
                onChange={(e) => setWorkerTokenInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#05080f] px-3 py-2 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-xs">
              <span className="font-semibold text-slate-300">Local Workspace Root</span>
              <input
                type="text"
                data-testid="manual-workspace-path-input"
                value={workspacePathInput}
                onChange={(e) => setWorkspacePathInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#05080f] px-3 py-2 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>
          </div>

          {/* Platform Selector Segmented Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {PLATFORM_TABS.map((tab) => {
              const active = tab.id === selectedPlatform;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`platform-tab-${tab.id}`}
                  onClick={() => setSelectedPlatform(tab.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-cyan-400 bg-cyan-950/60 text-white"
                      : "border-slate-800 bg-[#070b12] text-slate-300 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold">{tab.label}</div>
                  <div className="text-xs text-cyan-300 font-mono mt-0.5">{tab.configPath}</div>
                </button>
              );
            })}
          </div>

          {/* Generated Platform Config Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>{activePlatformMeta.subtitle}</span>
              <span className="font-mono text-cyan-300">{activePlatformMeta.configPath}</span>
            </div>
            <pre
              data-testid="generated-platform-config"
              className="overflow-x-auto rounded-xl border border-slate-800 bg-[#03060c] p-4 text-xs font-mono text-cyan-100 leading-relaxed max-h-[360px]"
            >
              <code>{platformConfigText}</code>
            </pre>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 3D SPHERE LIFECYCLE & PROVENANCE BADGE FIELD REFERENCE            */}
        {/* ================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 5-State Airlock Sphere Lifecycle Table */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0b101b]/95 p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base sm:text-lg font-bold text-white">
                3D Neural Sphere & HUD Lifecycle Mapping
              </h2>
              <p className="text-xs text-slate-300">
                The 3D neural sphere, top status pill, and footer banner bind directly to live
                mission state via <code className="text-cyan-200">GET /v1/missions/:id</code> and{" "}
                <code className="text-cyan-200">GET /v1/events</code>.
              </p>
            </div>

            <div className="space-y-2.5">
              {LIFECYCLE_REFERENCE.map((item) => (
                <div
                  key={item.state}
                  className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${item.toneClass}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold">
                      <span>{item.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.visual}</span>
                      {sphereState === item.state && (
                        <span className="underline text-white ml-1">(ACTIVE NOW)</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-200">{item.triggerCondition}</div>
                    <div className="text-xs text-slate-300">
                      <strong>Supervisor Action:</strong> {item.operatorAction}
                    </div>
                  </div>

                  {onTriggerLifecycle && (
                    <button
                      type="button"
                      onClick={() => {
                        onTriggerLifecycle(
                          item.state === "staged" ? "native_intercept" : item.state
                        );
                        onEnterCockpit();
                      }}
                      className="rounded-lg border border-current/40 bg-black/40 hover:bg-black/70 px-3 py-1.5 text-xs font-mono font-bold uppercase shrink-0 transition"
                    >
                      Test {item.name} in HUD ➔
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Provenance & Security Hardening Reference */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#0b101b]/95 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Verification Provenance & Security Invariants
                </h2>
                <p className="text-xs text-slate-300">
                  How to read the HUD verification checklist and enforce operator-only authority.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/25 p-3 space-y-1">
                  <div className="font-mono font-bold text-emerald-200">
                    [WITNESSED] · Independent LocalWitness Runner
                  </div>
                  <p className="text-slate-200 leading-relaxed">
                    Executed or inspected directly on disk by Commander (
                    <code className="text-emerald-200">witness</code>,{" "}
                    <code className="text-emerald-200">witness_file</code>,{" "}
                    <code className="text-emerald-200">witness_json</code>). Subordinate workers
                    cannot spoof witnessed checks via stdout.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/50 bg-amber-950/25 p-3 space-y-1">
                  <div className="font-mono font-bold text-amber-200">
                    [REPORTED] · Worker Evidence Payload
                  </div>
                  <p className="text-slate-200 leading-relaxed">
                    Evaluated against evidence submitted by the worker (
                    <code className="text-amber-200">exit_code</code>,{" "}
                    <code className="text-amber-200">stdout_contains</code>,{" "}
                    <code className="text-amber-200">nonce_echo</code>,{" "}
                    <code className="text-amber-200">diff_clean</code>). Always pair with a
                    per-attempt nonce or witnessed file check.
                  </p>
                </div>

                <div className="rounded-xl border border-violet-500/50 bg-violet-950/25 p-3 space-y-1">
                  <div className="font-mono font-bold text-violet-200">
                    [NATIVE INTERCEPT: Bash/Write] · PreToolUse Hook
                  </div>
                  <p className="text-slate-200 leading-relaxed">
                    Trapped locally by <code className="text-violet-200">claude-hook.js</code>{" "}
                    before the native tool call could execute. Requires a single-use operator
                    authorization bound to the exact step, lease, and normalized command.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#070b12] p-4 space-y-2 text-xs">
              <div className="font-bold uppercase tracking-wider text-cyan-200">
                Read-Only Voice/Chat & Signed Action Links
              </div>
              <p className="text-slate-300 leading-relaxed">
                Voice (<code className="text-white">SPEAK</code>) and chat inputs query the mission
                and audit ledger in the <code className="text-white">COMMANDER_SOUL.md</code>{" "}
                persona but are strictly blocked from mutating mission state. State-changing actions
                (<code className="text-emerald-300">Authorize</code>,{" "}
                <code className="text-amber-300">Redirect</code>,{" "}
                <code className="text-rose-300">Kill</code>) require a per-session{" "}
                <code className="text-cyan-200">x-csrf-token</code> or a single-use HMAC link at{" "}
                <code className="text-cyan-200">POST /a/:id/decide</code>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
