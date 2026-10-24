import express, { type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { createApp } from "./src/commander/app.js";
import { defaultPolicy, loadConfig } from "./src/commander/config.js";
import { CommanderError } from "./src/commander/errors.js";
import { computeMetrics } from "./src/commander/metrics.js";
import { buildMcpServer } from "./src/commander/mcp.js";
import {
  ANCHOR,
  VOICE_PROFILE,
  actionRedirectPatch,
  say,
  speak,
  voiceViolations,
} from "./src/commander/persona.js";
import { Sentinel } from "./src/commander/sentinel.js";
import { GENESIS } from "./src/commander/store.js";
import { withDeadline } from "./src/commander/util.js";
import { runVerifiers } from "./src/commander/verifiers.js";
import {
  ActionRequestSchema,
  EvidenceSchema,
  StepDefSchema,
  isWitnessSpec,
  type ActionRequest,
  type Principal,
  type StepDef,
  type VerifierSpec,
} from "./src/commander/types.js";
import type { Decision } from "./src/commander/approvals.js";
import {
  AttemptLimiter,
  CockpitSessions,
  RateLimiter,
  authorizeRequest,
  bodyCapFor,
  handleSessionRequest,
  loadSecurityConfig,
  type Denied,
} from "./src/server/security.js";
import { DEMO_COPY, classifyModelFailure, resolveStudioKey, scrubKey, type StudioReason } from "./src/server/byok.js";

dotenv.config();

const app = express();

function envPort(raw: string | undefined): number {
  if (!raw?.trim()) return 3000;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`PORT must be an integer from 0 to 65535, got "${raw}"`);
  return n;
}

const PORT = envPort(process.env.PORT);
// The preview and container platforms need 0.0.0.0. The network position is NOT the control: every route is behind the
// security gate below, and nothing is reachable without a credential.
const HOST = process.env.HOST?.trim() || "0.0.0.0";

// The body parsers are registered after the security gate (see below), so a request that is refused is never parsed.

// Initialize Google GenAI with recommended telemetry header
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// The client above carries the operator's own key and serves operator-only features. The open studio routes never use it:
// in the beta a visitor brings their own key (src/server/byok.ts), so a stranger cannot spend the operator's.
const STUDIO_MODEL_TIMEOUT_MS = 20_000;
const studioAi = (apiKey: string) => new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });

// One setting for every Gemini call the server makes, the studio routes and the engine's reasoning gate alike.
const DEFAULT_GEMINI_MODEL = process.env.COMMANDER_GEMINI_MODEL?.trim() || "gemini-3.8-flash";

/* -------------------------------------------------------------------------- */
/* SECURITY: SESSIONS, LIMITS, REQUEST CONTEXT (see src/server/security.ts)   */
/* -------------------------------------------------------------------------- */

const security = loadSecurityConfig(process.env);
const cockpitSessions = new CockpitSessions({ ttlMs: security.sessionTtlMs, max: security.maxSessions });
const unlockLimiter = new AttemptLimiter(8, 10 * 60_000);
const studioPerClient = new RateLimiter(security.studioRpm, 60_000);
const studioGlobal = new RateLimiter(security.studioGlobalRpm, 60_000);
const MAX_SSE_CLIENTS = 25;

/**
 * Carries the CSRF token of the session that made the current request, so the payload builders can include it for that
 * client alone. Broadcast payloads are built in an empty context and therefore never contain one.
 */
const requestContext = new AsyncLocalStorage<{ csrf?: string }>();

const trustProxyHops = Number(process.env.COMMANDER_TRUST_PROXY);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) app.set("trust proxy", trustProxyHops);
app.disable("x-powered-by");

// Load COMMANDER_SOUL.md specification
const COMMANDER_SOUL_PATH = path.resolve(process.cwd(), "COMMANDER_SOUL.md");
const COMMANDER_SOUL_SPEC = fs.existsSync(COMMANDER_SOUL_PATH)
  ? fs.readFileSync(COMMANDER_SOUL_PATH, "utf8")
  : `Commander is not an assistant. It is a supervisory control plane, an auditor, and a Director of Operations.
Direct, clipped, articulate. Short declaratives. Orders, not requests.
Never apologize. Only mechanical proof moves a step.`;

/** Enforce COMMANDER_SOUL.md voice invariants on any generated dialogue text */
function enforceCommanderVoice(raw: string): string {
  const stripped = raw
    .replace(/!/g, ".")
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const enforced = speak(stripped);
  return enforced || ANCHOR;
}

/* -------------------------------------------------------------------------- */
/* AGENT COMMANDER CONTROL PLANE INITIALIZATION (AIRLOCK + SENTINEL + WITNESS)*/
/* -------------------------------------------------------------------------- */

const baseConfig = loadConfig({
  ...process.env,
  COMMANDER_PUBLIC_URL: process.env.COMMANDER_PUBLIC_URL || `http://localhost:${PORT}`,
  PORT: String(PORT),
  HOST,
});

/**
 * Independent witnessing. By default the witness can INSPECT FILES under the working directory and can run NOTHING (the
 * executable allowlist is empty), which is enough for the demo mission's file check. Letting it run commands executes
 * code on this machine against a workspace the worker controls, so that is opt-in: set COMMANDER_WITNESS_MODE=local with
 * COMMANDER_WITNESS_ROOT, COMMANDER_WITNESS_ALLOW and COMMANDER_WITNESS_TENANTS. COMMANDER_WITNESS_MODE=off disables it.
 */
const INSPECT_ONLY_WITNESS = {
  mode: "local" as const,
  root: process.cwd(),
  allow: [] as string[],
  path: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
  tenants: "*" as const,
  concurrency: 2,
};

const commanderConfig = {
  ...baseConfig,
  adminToken: security.adminToken,
  geminiApiKey: geminiApiKey || undefined,
  geminiModel: DEFAULT_GEMINI_MODEL,
  policy: {
    ...defaultPolicy(),
    egress_allowlist: ["registry.example.com", "api.github.com", "*.npmjs.org"],
  },
  witness: process.env.COMMANDER_WITNESS_MODE?.trim() ? baseConfig.witness : INSPECT_ONLY_WITNESS,
};
const witnessAvailable = commanderConfig.witness.mode === "local";
const witnessCanRunCommands = witnessAvailable && commanderConfig.witness.allow.length > 0;

const commander = createApp({ config: commanderConfig });
const standaloneSentinel = new Sentinel(commanderConfig.policy, commander.clock);

// Bootstrap default tenant, operator principal, worker principal, and initial mission
const bootstrapTenant = commander.auth.createTenant("Sovereign Operations", 1000);
const defaultTenantId = bootstrapTenant.tenant.id;
const defaultOperatorKey = bootstrapTenant.operatorKey;
const defaultOperatorPrincipal = commander.auth.authenticate(`Bearer ${defaultOperatorKey}`);

const bootstrapWorker = commander.auth.issueKey(defaultTenantId, "worker", "claude-code-worker-01");
const defaultWorkerKey = bootstrapWorker.key;
const defaultWorkerPrincipal = commander.auth.authenticate(`Bearer ${defaultWorkerKey}`);

const DEFAULT_MISSION_DEF = {
  title: "Release 4.2 · Sovereign Production Cutover",
  steps: [
    {
      title: witnessAvailable ? "Run Mechanical Test Suite & Witness Verification" : "Run Mechanical Test Suite",
      directive:
        "Execute full unit and integration test suite. Report real exit_code 0, raw test counts in stdout, echo the active attempt nonce" +
        (witnessAvailable ? ", and pass independent LocalWitness inspection of package.json." : "."),
      risk_tier: "routine" as const,
      max_attempts: 3,
      require_nonce: true,
      proof: [
        // Only when a witness exists: a mission that asks for one where none is available is rejected at open.
        ...(witnessAvailable
          ? [
              {
                type: "witness_file" as const,
                path: "package.json",
                min_bytes: 50,
                regex: "orator-ai-forge",
                flags: "",
              },
            ]
          : []),
        { type: "exit_code" as const, expected: 0 },
        { type: "regex" as const, target: "stdout", pattern: "\\d+ passed", flags: "", must_match: true },
        { type: "nonce_present" as const },
      ],
    },
    {
      title: "Emit Signed Release Manifest",
      directive:
        "Write manifest.json for release 4.2.0 with SHA-256 artifact checksum and submit it in artifacts.",
      risk_tier: "routine" as const,
      max_attempts: 3,
      require_nonce: false,
      proof: [
        { type: "exit_code" as const, expected: 0 },
        { type: "artifact_present" as const, name: "manifest.json", min_bytes: 16 },
        {
          type: "json_schema" as const,
          target: "artifact:manifest.json",
          schema: {
            type: "object",
            required: ["version", "checksum"],
            additionalProperties: false,
            properties: {
              version: { type: "string", pattern: "^4\\.2\\.\\d+$" },
              checksum: { type: "string", minLength: 8 },
            },
          },
        },
        {
          type: "regex" as const,
          target: "artifact:manifest.json",
          pattern: '"version"\\s*:\\s*"4\\.2\\.\\d+"',
          flags: "",
          must_match: true,
          hidden: true,
        },
      ],
    },
    {
      title: "Apply Zero-Downtime Schema Migration",
      directive:
        "Add release_notes column to releases table inside policy bounds, then submit migration diff and exit_code 0.",
      risk_tier: "elevated" as const,
      max_attempts: 3,
      require_nonce: false,
      proof: [
        { type: "exit_code" as const, expected: 0 },
        { type: "regex" as const, target: "stdout", pattern: "migration applied", flags: "i", must_match: true },
      ],
    },
    {
      title: "Verify Production Ingress Cutover",
      directive:
        "Validate production health telemetry JSON output and confirm zero error rate with exit_code 0.",
      risk_tier: "critical" as const,
      max_attempts: 3,
      require_nonce: false,
      proof: [
        { type: "exit_code" as const, expected: 0 },
        { type: "json_valid" as const, target: "stdout" },
      ],
    },
  ],
};

type AirlockSphereState = "idle" | "running" | "staged" | "verified" | "quarantined";

interface MissionLastEvent {
  seq: number;
  ts: string;
  type: string;
  summary: string;
  sphere_state: AirlockSphereState;
}

const missionLastEvents = new Map<string, MissionLastEvent>();
const sseClients = new Set<Response>();

let activeMissionId = commander.airlock.openMission(defaultOperatorPrincipal, DEFAULT_MISSION_DEF).id;

// Release step 1 directive and stage an initial PreToolUse guard intercept so the HUD cockpit
// immediately has a live step, witnessed + reported checklist, and a native intercept gate ready
const bootDirective = commander.airlock.getDirective(defaultWorkerPrincipal, activeMissionId);
if (bootDirective.state === "DIRECTIVE") {
  void commander.airlock
    .requestGuardClearance(defaultWorkerPrincipal, activeMissionId, {
      tool: "Bash/Write",
      action: {
        kind: "sql",
        payload: "ALTER TABLE releases ADD COLUMN release_notes text;",
        intent: "schema_change",
      },
    })
    .then((c) => {
      recordMissionEvent(activeMissionId, "clearance.staged", c.message, "staged");
    });
}

function describeRequirementText(spec: VerifierSpec): string {
  switch (spec.type) {
    case "exit_code":
      return `exit_code === ${spec.expected}`;
    case "json_valid":
      return `${spec.target} valid JSON`;
    case "json_schema":
      return `${spec.target} matches JSON schema`;
    case "regex":
      return `${spec.target} ${spec.must_match ? "matches" : "excludes"} /${spec.pattern}/${spec.flags}`;
    case "artifact_present":
      return `artifact "${spec.name}" >= ${spec.min_bytes}B`;
    case "artifact_hash":
      return `artifact "${spec.name}" sha256 == ${spec.sha256.slice(0, 10)}…`;
    case "nonce_present":
      return `attempt nonce echoed verbatim`;
    case "diff_policy":
      return `diff "${spec.artifact}" within policy`;
    case "witness_command":
      return `LocalWitness exec: ${spec.argv.join(" ")}`;
    case "witness_file":
      return `LocalWitness file: ${spec.path} (>=${spec.min_bytes}B)`;
  }
}

function computeMissionSphereState(missionId: string): AirlockSphereState {
  const rawMission = commander.store.state.missions[missionId];
  if (!rawMission) return "idle";

  const currentStepRaw = rawMission.steps[rawMission.current];
  const pendingForMission = commander.approvals
    .list(defaultTenantId, "pending")
    .filter((a) => a.missionId === missionId);
  const tenantRec = commander.store.state.tenants[defaultTenantId];
  const lastEvt = missionLastEvents.get(missionId);

  if (
    rawMission.status === "quarantined" ||
    rawMission.status === "killed" ||
    currentStepRaw?.status === "quarantined" ||
    (tenantRec && tenantRec.credits <= 0) ||
    lastEvt?.type === "clearance.denied"
  ) {
    return "quarantined";
  }

  if (rawMission.status === "paused" || Boolean(rawMission.pausedFor) || pendingForMission.length > 0) {
    return "staged";
  }

  if (
    rawMission.status === "completed" ||
    currentStepRaw?.status === "passed" ||
    lastEvt?.type === "proof.accepted"
  ) {
    return "verified";
  }

  const now = commander.clock();
  if (
    currentStepRaw &&
    currentStepRaw.status === "released" &&
    currentStepRaw.lease &&
    !currentStepRaw.lease.revoked &&
    currentStepRaw.lease.expiresAt > now
  ) {
    return "running";
  }

  return "idle";
}

function summarizeAuditEvent(
  eventType: string,
  missionId: string,
  fallbackSummary?: string
): string {
  if (fallbackSummary && fallbackSummary.trim().length > 0) {
    return fallbackSummary.trim();
  }
  const rawMission = commander.store.state.missions[missionId];
  const step = rawMission?.steps[rawMission.current];
  const stepIdx = (step?.index ?? 0) + 1;
  const stepTotal = rawMission?.steps.length ?? 4;
  const stepTitle = step?.def.title ?? "Current Step";

  switch (eventType) {
    case "mission.opened":
      return `Airlock ready. Mission "${rawMission?.title ?? "Release 4.2"}" initialized — no active worker lease.`;
    case "directive.issued":
      return `Step ${stepIdx} of ${stepTotal} (${stepTitle}) running. Active worker lease issued — awaiting mechanical proof.`;
    case "clearance.staged":
    case "approval.staged":
      return `Action staged on Step ${stepIdx} (${stepTitle}). Pending operator Authorize, Redirect, or Kill.`;
    case "clearance.allowed":
      return `Action cleared by Sentinel on Step ${stepIdx}. Worker lease active.`;
    case "clearance.denied":
      return `Action denied by Perimeter Sentinel. Policy boundary enforced.`;
    case "proof.accepted":
      return `Step ${stepIdx} mechanically verified (exit_code === 0). Step sealed in ledger.`;
    case "proof.rejected":
      return `Proof rejected on Step ${stepIdx}. Mechanical check failed — corrective patch attached.`;
    case "step.quarantined":
      return `Attempts exhausted on Step ${stepIdx} (${stepTitle}). Step quarantined — operator intervention required.`;
    case "approval.decided":
      return `Operator gate decided on Step ${stepIdx}. Mission state synchronized.`;
    case "operator.redirect":
      return `${ANCHOR} Step ${stepIdx} directive patched by operator.`;
    case "mission.killed":
      return `Mission terminated by operator. All worker leases revoked.`;
    case "mission.completed":
      return `All mission steps mechanically verified (exit_code === 0). Mission complete.`;
    default:
      return `Airlock state synchronized (${eventType}).`;
  }
}

/**
 * The HUD, its event log and the live stream belong to the cockpit's own sandbox tenant. A mission that belongs to any
 * other tenant is that tenant's alone: it never moves the cockpit's pointer and is never broadcast into its stream.
 */
function isCockpitMission(missionId: string): boolean {
  const m = Object.hasOwn(commander.store.state.missions, missionId) ? commander.store.state.missions[missionId] : undefined;
  return m?.tenantId === defaultTenantId;
}

function recordMissionEvent(
  missionId: string,
  type: string,
  explicitSummary?: string,
  explicitSphereState?: AirlockSphereState
): MissionLastEvent | undefined {
  if (!isCockpitMission(missionId)) return undefined;
  const latestAudit = commander.store.tenantAudit(defaultTenantId, 1)[0];
  const seq = latestAudit?.seq ?? 1;
  const ts = latestAudit?.ts ?? new Date(commander.clock()).toISOString();
  const prevEvt = missionLastEvents.get(missionId);
  // Provisionally store type so computeMissionSphereState sees the latest event type
  missionLastEvents.set(missionId, {
    seq,
    ts,
    type,
    summary: explicitSummary || prevEvt?.summary || "",
    sphere_state: explicitSphereState ?? "idle",
  });
  const sphereState = explicitSphereState ?? computeMissionSphereState(missionId);
  const summary = summarizeAuditEvent(type, missionId, explicitSummary);
  const evt: MissionLastEvent = {
    seq,
    ts,
    type,
    summary,
    sphere_state: sphereState,
  };
  missionLastEvents.set(missionId, evt);
  broadcastSse(type, missionId);
  return evt;
}

function buildAuditVerificationPayload(tenantId: string = defaultTenantId) {
  const verdict = commander.store.verify({ tenantId, full: true });
  const records = commander.store.tenantAudit(tenantId, 15).map((r) => ({
    seq: r.seq,
    ts: r.ts,
    type: r.type,
    prev: r.prev,
    hash: r.hash,
    data: r.data,
  }));
  const headHash = records[0]?.hash ?? GENESIS;
  return {
    ok: verdict.ok,
    count: verdict.ok ? verdict.count : 0,
    brokenAt: !verdict.ok ? verdict.brokenAt : undefined,
    reason: !verdict.ok ? verdict.reason : undefined,
    headHash,
    genesisHash: GENESIS,
    records,
  };
}

function buildLiveMissionPayload(missionId: string = activeMissionId) {
  const rawMission =
    commander.store.state.missions[missionId] ??
    commander.store.state.missions[activeMissionId];
  const resolvedId = rawMission?.id ?? missionId;
  const missionViewData = rawMission
    ? commander.airlock.getMission(defaultOperatorPrincipal, resolvedId)
    : null;
  const currentStepRaw = rawMission ? rawMission.steps[rawMission.current] : undefined;

  // Active pending approvals dynamically filtered for this tenant
  const pendingApprovals = commander.approvals
    .list(defaultTenantId, "pending")
    .map((a) => {
      const m = commander.store.state.missions[a.missionId];
      const s = m?.steps.find((st) => st.id === a.stepId);
      const clearance = a.clearanceId ? commander.store.state.clearances[a.clearanceId] : undefined;
      const source = clearance?.source ?? (a.incident.startsWith("NATIVE ") ? "guard" : "mcp");
      const toolMatch = /^NATIVE\s+([^:]+):/i.exec(a.incident);
      const tool = toolMatch?.[1] ?? (source === "guard" ? "Bash/Write" : undefined);
      const signedLinks = commander.approvals.links(a.id);

      return {
        id: a.id,
        kind: a.kind,
        status: a.status,
        incident: a.incident,
        reason: a.reason,
        created_at: a.createdAt,
        mission_id: a.missionId,
        mission: m?.title ?? "Mission",
        step_id: a.stepId,
        step: s?.def.title ?? "Step",
        clearance_id: a.clearanceId,
        source,
        tool,
        provenance: source === "guard" ? ("native_intercept" as const) : ("reported" as const),
        signed_links: signedLinks,
        voice: VOICE_PROFILE,
      };
    });

  // Build mechanical checklist for the current step with explicit [WITNESSED] vs [REPORTED] provenance
  const lastAttempt = currentStepRaw?.attempts.at(-1);
  const checklist = currentStepRaw
    ? currentStepRaw.def.proof.map((spec, idx) => {
        const lastResult = lastAttempt?.results[idx];
        const witnessed = isWitnessSpec(spec);
        const kindLabel = spec.hidden ? "hidden_invariant" : spec.type;
        const reqText = spec.hidden
          ? "Hidden mechanical invariant (undisclosed to worker)"
          : describeRequirementText(spec);
        const provenance = witnessed ? ("witnessed" as const) : ("reported" as const);
        const badgeText = witnessed ? "[WITNESSED]" : "[REPORTED]";
        return {
          index: idx + 1,
          type: kindLabel,
          kind: kindLabel,
          hidden: Boolean(spec.hidden),
          requirement: reqText,
          label: `${kindLabel.toUpperCase()} · ${reqText}`,
          detail: lastResult?.reason ?? reqText,
          status: lastResult ? (lastResult.ok ? ("passed" as const) : ("failed" as const)) : ("pending" as const),
          reason: lastResult?.reason ?? null,
          provenance,
          badgeText,
        };
      })
    : [];

  const sphereState = computeMissionSphereState(resolvedId);
  const latestAudit = commander.store.tenantAudit(defaultTenantId, 1)[0];
  const lastEvent: MissionLastEvent = missionLastEvents.get(resolvedId) ?? {
    seq: latestAudit?.seq ?? 1,
    ts: latestAudit?.ts ?? new Date(commander.clock()).toISOString(),
    type: latestAudit?.type ?? "mission.opened",
    summary: summarizeAuditEvent(latestAudit?.type ?? "mission.opened", resolvedId),
    sphere_state: sphereState,
  };
  lastEvent.sphere_state = sphereState;

  const tenantRec = commander.store.state.tenants[defaultTenantId];
  const rawMetrics = computeMetrics(commander.store, defaultTenantId, commander.clock());
  const auditVerification = commander.store.verify({ tenantId: defaultTenantId, full: true });

  return {
    id: resolvedId,
    title: rawMission?.title ?? "Release 4.2 · Sovereign Production Cutover",
    status: rawMission?.status ?? "active",
    current_index: rawMission?.current ?? 0,
    step_count: rawMission?.steps.length ?? 0,
    created_at: rawMission?.createdAt ?? new Date(commander.clock()).toISOString(),
    updated_at: rawMission?.updatedAt ?? new Date(commander.clock()).toISOString(),
    paused_for: rawMission?.pausedFor,
    ledger: rawMission?.manifests ?? [],
    last_event: lastEvent,
    sphere_state: sphereState,
    current_step: currentStepRaw
      ? {
          id: currentStepRaw.id,
          index: currentStepRaw.index + 1,
          total_steps: rawMission!.steps.length,
          title: currentStepRaw.def.title,
          directive: currentStepRaw.operatorPatch
            ? `${currentStepRaw.def.directive}\n\nOPERATOR REDIRECT: ${say.redirected(currentStepRaw.operatorPatch)}`
            : currentStepRaw.def.directive,
          status: currentStepRaw.status,
          risk_tier: currentStepRaw.def.risk_tier,
          attempt: Math.min(currentStepRaw.attempts.length + 1, currentStepRaw.attemptBudget),
          attempt_budget: currentStepRaw.attemptBudget,
          nonce: currentStepRaw.nonce ?? null,
          lease_id: currentStepRaw.lease?.id ?? null,
          lease_expires_at:
            currentStepRaw.lease && !currentStepRaw.lease.revoked
              ? new Date(currentStepRaw.lease.expiresAt).toISOString()
              : null,
          lease_revoked: currentStepRaw.lease?.revoked ?? false,
          operator_patch: currentStepRaw.operatorPatch ?? null,
          checklist,
        }
      : null,
    steps: (rawMission?.steps ?? []).map((st, idx) => ({
      id: st.id,
      idx: idx + 1,
      index: idx + 1,
      title: st.def.title,
      status: st.status,
      risk_tier: st.def.risk_tier,
      attempt: st.attempts.length,
      attempt_budget: st.attemptBudget,
    })),
    approvals: pendingApprovals,
    // Secrets (operatorKey, workerKey) are strictly omitted from client payloads
    tenant: {
      id: defaultTenantId,
      name: tenantRec?.name ?? "Sovereign Operations",
      credits: tenantRec?.credits ?? 0,
      creditBalance: tenantRec?.credits ?? 0,
      status: (tenantRec?.credits ?? 0) > 0 ? ("online" as const) : ("depleted" as const),
      auditVerified: auditVerification.ok,
      auditCount: auditVerification.ok ? auditVerification.count : 0,
    },
    metrics: {
      ...rawMetrics,
      burnRatePerMin: rawMetrics.spend.creditsLastMinute,
      burnRatePerHour: rawMetrics.spend.creditsLastHour,
      tokensSaved: rawMetrics.spend.tokensSaved,
      errorVelocityPerMin: rawMetrics.errorVelocity.perMinute,
      pendingApprovals: pendingApprovals.length,
      stagedApprovals: pendingApprovals.length,
      totalEvents: auditVerification.ok ? auditVerification.count : 0,
    },
    mission_view: missionViewData,
    csrf_token: requestContext.getStore()?.csrf,
  };
}

function buildCockpitSnapshot() {
  const liveMission = buildLiveMissionPayload(activeMissionId);
  const auditVerify = buildAuditVerificationPayload(defaultTenantId);
  const allApprovals = commander.approvals.list(defaultTenantId).slice(0, 10);

  return {
    sphereState: liveMission.sphere_state,
    tenant: liveMission.tenant,
    metrics: liveMission.metrics,
    mission: liveMission,
    approvals: liveMission.approvals,
    recentApprovals: allApprovals,
    audit: {
      valid: auditVerify.ok,
      entries: auditVerify.count,
      tail: auditVerify.records.map((r) => ({
        seq: r.seq,
        ts: r.ts,
        type: r.type,
        kind: r.type,
        data: r.data,
        hash: r.hash.slice(0, 12),
      })),
    },
    persona: {
      anchor: ANCHOR,
      name: "COMMANDER_SOUL",
      voiceProfile: VOICE_PROFILE,
    },
    csrf_token: requestContext.getStore()?.csrf,
  };
}

function broadcastSse(eventType: string, missionId: string = activeMissionId) {
  if (sseClients.size === 0 || !isCockpitMission(missionId)) return;
  // Built in an EMPTY request context: this payload goes to every connected client, so it must carry no session's CSRF token.
  const payload = requestContext.run({}, () =>
    JSON.stringify({
      type: eventType,
      ts: new Date(commander.clock()).toISOString(),
      missionId,
      mission: buildLiveMissionPayload(missionId),
      audit: buildAuditVerificationPayload(defaultTenantId),
    })
  );
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* SECURITY GATE: deny by default (the route table is in src/server/security.ts) */
/* -------------------------------------------------------------------------- */

interface RequestLocals {
  principal?: Principal;
  cockpit?: boolean;
}

/**
 * The principal behind this request, and it must hold the role the route needs. A bearer route uses the authenticated
 * key. A cockpit route acts as the cockpit's own sandbox tenant. There is no anonymous fallback.
 */
function resolvePrincipal(req: Request, role: "operator" | "worker" = "operator"): Principal {
  const locals = (req.res?.locals ?? {}) as RequestLocals;
  const principal = locals.principal ?? (locals.cockpit ? (role === "operator" ? defaultOperatorPrincipal : defaultWorkerPrincipal) : undefined);
  if (!principal) throw new CommanderError("UNAUTHENTICATED", say.unauthenticated());
  // A worker key must never reach an operator route (approving its own staged actions, minting keys) or the reverse.
  commander.auth.requireRole(principal, role);
  return principal;
}

/** The gate already enforced the session's CSRF token on every state-changing cockpit request; this asserts the request came through it. */
function verifyCockpitCsrf(req: Request): void {
  if (!(req.res?.locals as RequestLocals | undefined)?.cockpit) {
    throw new CommanderError("FORBIDDEN", say.forbidden());
  }
}

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (/^\/(?:v1|api)(?:\/|$)/i.test(req.path)) res.setHeader("Cache-Control", "no-store");
  next();
});

const clientKeyOf = (req: Request): string => req.ip || req.socket.remoteAddress || "unknown";

function sendDenied(res: Response, d: Denied) {
  res.status(d.status).json({ error: d.code, message: d.message });
}

app.use((req, res, next) => {
  const decision = authorizeRequest(
    { method: req.method, path: req.path, headers: req.headers },
    { config: security, sessions: cockpitSessions },
  );
  if (!decision.ok) return sendDenied(res, decision);

  const cap = bodyCapFor(req.path);
  if (cap !== undefined && Number(req.headers["content-length"] ?? 0) > cap) {
    return void res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: `Request body exceeds ${cap} bytes.` });
  }

  switch (decision.via) {
    case "bearer":
      try {
        res.locals.principal = commander.auth.authenticate(decision.authorization!);
      } catch (err) {
        return handleCommanderError(err, res);
      }
      return next();
    case "studio": {
      const mine = studioPerClient.allow(clientKeyOf(req));
      const all = studioGlobal.allow("*");
      const blocked = !mine.ok ? mine : !all.ok ? all : undefined;
      if (blocked) {
        res.setHeader("Retry-After", String(blocked.retryAfterSec));
        return void res
          .status(429)
          .json({ error: "THROTTLED", message: "Rate limit reached. Try again shortly.", retry_after: blocked.retryAfterSec });
      }
      return next();
    }
    case "cockpit":
      res.locals.cockpit = true;
      return requestContext.run({ csrf: decision.csrf }, next);
    default:
      return next();
  }
});

// Parsed only after the gate, so a refused request costs nothing.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// A malformed body is a 400 in the engine's error shape, never a stack trace.
app.use((err: unknown, _req: Request, res: Response, next: (e?: unknown) => void) => {
  const status = (err as { status?: number } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return void res.status(status).json({ error: "INVALID", message: "Malformed request body." });
  }
  next(err);
});

// Chunked bodies carry no Content-Length, so the size cap is enforced again on what was actually parsed.
app.use((req, res, next) => {
  const cap = bodyCapFor(req.path);
  if (cap !== undefined && req.body && JSON.stringify(req.body).length > cap) {
    return void res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: `Request body exceeds ${cap} bytes.` });
  }
  next();
});

// Unlock / status / logout for the operator cockpit.
app.all("/api/cockpit/session", (req, res) => {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]!.trim().toLowerCase();
  const out = handleSessionRequest(
    {
      method: req.method,
      body: req.body,
      headers: req.headers,
      clientKey: clientKeyOf(req),
      remoteAddress: req.socket.remoteAddress,
      secureTransport: req.secure || forwardedProto === "https",
    },
    { config: security, sessions: cockpitSessions, limiter: unlockLimiter },
  );
  if (out.setCookie) res.setHeader("Set-Cookie", out.setCookie);
  if (out.retryAfterSec) res.setHeader("Retry-After", String(out.retryAfterSec));
  res.status(out.status).json(out.body);
});

function handleCommanderError(err: unknown, res: Response) {
  if (err instanceof CommanderError) {
    return res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(err.details ?? {}),
    });
  }
  console.error("[COMMANDER] Fault:", err);
  return res.status(500).json({
    error: "FAULT",
    message: "Internal fault. Request not processed.",
  });
}

/* -------------------------------------------------------------------------- */
/* AGENT COMMANDER V1 ROUTES (LIVE MISSIONS, SSE EVENTS, AUDIT, AIRLOCK)      */
/* -------------------------------------------------------------------------- */

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "orator-agent-commander", model: DEFAULT_GEMINI_MODEL });
});

// Live SSE Event Stream (/v1/events)
app.get("/v1/events", (req, res) => {
  if (sseClients.size >= MAX_SSE_CLIENTS) {
    return void res.status(429).json({ error: "THROTTLED", message: "Too many live connections. Close one and retry." });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  sseClients.add(res);

  const initialPayload = JSON.stringify({
    type: "mission.snapshot",
    ts: new Date(commander.clock()).toISOString(),
    missionId: activeMissionId,
    mission: buildLiveMissionPayload(activeMissionId),
    audit: buildAuditVerificationPayload(defaultTenantId),
  });
  res.write(`data: ${initialPayload}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Live Missions Endpoints (/v1/missions and /v1/missions/:id)
app.get("/v1/missions", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    res.json({
      active_mission_id: activeMissionId,
      missions: commander.airlock.listMissions(principal),
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.get("/v1/missions/:id", (req, res) => {
  try {
    const requestedId = req.params.id === "active" ? activeMissionId : req.params.id!;
    if (!Object.hasOwn(commander.store.state.missions, requestedId)) {
      throw new CommanderError("NOT_FOUND", say.notFound());
    }
    res.json(buildLiveMissionPayload(requestedId));
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// Cryptographic Audit Verification Endpoint (/v1/audit/verify)
app.get("/v1/audit/verify", (_req, res) => {
  try {
    res.json(buildAuditVerificationPayload(defaultTenantId));
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// Signed single-use approval capability links (/a/:id and /a/:id/decide)
app.get("/a/:id", (req, res) => {
  try {
    const id = req.params.id!;
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? "");
    if (!commander.approvals.signer.verify(id, "view", exp, sig, commander.clock())) {
      throw new CommanderError("FORBIDDEN", say.forbidden());
    }
    const a = commander.approvals.byId(id);
    const mission = commander.store.state.missions[a.missionId];
    const stepTitle = mission?.steps.find((s) => s.id === a.stepId)?.def.title ?? "";
    res.json({
      id: a.id,
      status: a.status,
      mission: mission?.title ?? "",
      step: stepTitle,
      incident: a.incident,
      reason: a.reason,
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.post("/a/:id/decide", (req, res) => {
  try {
    const id = req.params.id!;
    const decision = z.enum(["authorize", "redirect", "kill"]).parse(req.query.d);
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? "");
    if (!commander.approvals.signer.verify(id, decision, exp, sig, commander.clock())) {
      throw new CommanderError("FORBIDDEN", say.forbidden());
    }
    const note = typeof req.body?.note === "string" ? req.body.note : undefined;
    const a = commander.approvals.byId(id);
    // decideApproval enforces single-use (throws CONFLICT if status !== 'pending')
    const decided = commander.airlock.decideApproval(a.tenantId, id, decision, note, "link");

    // Re-issue directive lease if a quarantined step was re-opened
    // Only the cockpit's own sandbox tenant can be re-leased here; an approval from another tenant is decided and left alone.
    const m = commander.store.state.missions[a.missionId];
    if (m && a.tenantId === defaultTenantId && m.status === "active" && decision !== "kill") {
      const s = m.steps[m.current];
      if (s && !s.lease) {
        commander.airlock.getDirective(defaultWorkerPrincipal, a.missionId);
      }
    }

    const voiceMessage =
      decision === "authorize"
        ? say.authorized()
        : decision === "redirect"
        ? say.redirected(note || "Re-plan approach and satisfy mechanical verifiers.")
        : say.killed();

    recordMissionEvent(
      a.missionId,
      "approval.decided",
      voiceMessage,
      decision === "kill" ? "quarantined" : "running"
    );

    res.json({
      ok: true,
      status: decided.status,
      message: voiceMessage,
      // The cockpit payload exists only for the sandbox tenant; building it for another tenant's mission would fail after the decision had already committed.
      mission: isCockpitMission(a.missionId) ? buildLiveMissionPayload(a.missionId) : undefined,
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// Admin routes
app.get("/v1/admin/audit/verify", (_req, res) => {
  try {
    res.json(commander.store.verify({ full: true }));
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.post("/v1/admin/tenants", (req, res) => {
  try {
    const body = z.object({ name: z.string().min(1).max(100), credits: z.number().min(0).max(1e9) }).parse(req.body);
    const { tenant, operatorKey } = commander.auth.createTenant(body.name, body.credits);
    res.status(201).json({ tenant_id: tenant.id, name: tenant.name, credits: tenant.credits, operator_key: operatorKey });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.post("/v1/admin/tenants/:id/credits", (req, res) => {
  try {
    const body = z.object({ amount: z.number().positive().max(1e9) }).parse(req.body);
    res.json({ balance: commander.auth.topUp(req.params.id!, body.amount) });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// Guard clearance endpoint (PreToolUse Native Intercept)
app.post("/v1/guard/clearance", async (req, res) => {
  try {
    const principal = resolvePrincipal(req, "worker");
    const body = z
      .object({
        mission_id: z.string().min(1).max(64).default(activeMissionId),
        tool: z.string().min(1).max(40).optional(),
        action: ActionRequestSchema,
      })
      .parse(req.body);
    const result = await commander.airlock.requestGuardClearance(principal, body.mission_id, {
      action: body.action,
      tool: body.tool,
    });
    recordMissionEvent(
      body.mission_id,
      result.verdict === "STAGED"
        ? "clearance.staged"
        : result.verdict === "DENIED"
        ? "clearance.denied"
        : "clearance.allowed",
      result.message
    );
    res.json(result);
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// MCP StreamableHTTP endpoint
app.post("/v1/mcp", async (req, res) => {
  try {
    const principal = resolvePrincipal(req, "worker");
    const server = buildMcpServer(principal, commander.airlock);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    broadcastSse("mcp.request", activeMissionId);
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// Operator V1 routes
app.get("/v1/operator/overview", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    const t = principal.tenantId;
    const approvals = commander.approvals.list(t, "pending").map((a) => {
      const mission = commander.store.state.missions[a.missionId];
      return {
        id: a.id,
        kind: a.kind,
        incident: a.incident,
        reason: a.reason,
        created_at: a.createdAt,
        mission: mission?.title,
        step: mission?.steps.find((s) => s.id === a.stepId)?.def.title,
      };
    });
    res.json({
      metrics: computeMetrics(commander.store, t, commander.clock()),
      approvals,
      missions: commander.airlock.listMissions(principal).slice(0, 20),
      audit: commander.store.tenantAudit(t, 25).map((r) => ({ seq: r.seq, ts: r.ts, type: r.type, data: r.data })),
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.get("/v1/operator/missions", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    res.json({ missions: commander.airlock.listMissions(principal) });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.post("/v1/operator/missions", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    const created = commander.airlock.openMission(principal, req.body);
    // Only the cockpit's own sandbox tenant moves the cockpit's pointer. Another tenant's mission is theirs alone.
    if (principal.tenantId === defaultTenantId) {
      activeMissionId = created.id;
      recordMissionEvent(activeMissionId, "mission.opened", undefined, "idle");
    }
    res.status(201).json(created);
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.get("/v1/operator/missions/:id", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    res.json(commander.airlock.getMission(principal, req.params.id!));
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.post("/v1/operator/missions/:id/intervene", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    const body = z.object({ action: z.enum(["kill", "skip"]), reason: z.string().min(1).max(300) }).parse(req.body);
    const updated = commander.airlock.intervene(principal, req.params.id!, body);
    recordMissionEvent(
      req.params.id!,
      body.action === "kill" ? "mission.killed" : "step.skipped",
      body.action === "kill" ? say.killed() : `Step skipped by operator: ${body.reason}`
    );
    res.json(updated);
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.get("/v1/operator/approvals", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    const statusParam = typeof req.query.status === "string" ? req.query.status : undefined;
    const parsed = statusParam
      ? z.enum(["pending", "authorized", "redirected", "killed"]).parse(statusParam)
      : undefined;
    res.json({ approvals: commander.approvals.list(principal.tenantId, parsed) });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.post("/v1/operator/approvals/:id/decision", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    const body = z
      .object({
        decision: z.enum(["authorize", "redirect", "kill"]),
        note: z.string().max(400).optional(),
      })
      .parse(req.body);
    const decided = commander.airlock.decideApproval(
      principal.tenantId,
      req.params.id!,
      body.decision,
      body.note,
      "operator"
    );
    recordMissionEvent(
      decided.missionId,
      "approval.decided",
      body.decision === "authorize"
        ? say.authorized()
        : body.decision === "redirect"
        ? say.redirected(body.note || "Operator redirect.")
        : say.killed()
    );
    res.json(decided);
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.get("/v1/operator/audit", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
    res.json({ records: commander.store.tenantAudit(principal.tenantId, limit) });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.get("/v1/operator/audit/verify", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    res.json(commander.store.verify({ tenantId: principal.tenantId }));
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.post("/v1/operator/keys", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    const body = z.object({ label: z.string().max(80).optional() }).parse(req.body ?? {});
    const { record, key } = commander.auth.issueKey(principal.tenantId, "worker", body.label);
    res.status(201).json({ key_id: record.id, role: record.role, key });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

app.delete("/v1/operator/keys/:id", (req, res) => {
  try {
    const principal = resolvePrincipal(req, "operator");
    commander.auth.revokeKey(principal.tenantId, req.params.id!);
    res.json({ revoked: req.params.id });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

/* -------------------------------------------------------------------------- */
/* DIRECT COCKPIT API ENDPOINTS (AIRLOCK STATE MACHINE, SENTINEL, VERIFIERS)  */
/* -------------------------------------------------------------------------- */

// 1. Full Cockpit Snapshot
app.get("/api/commander/overview", (_req, res) => {
  try {
    res.json(buildCockpitSnapshot());
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// 2. Pull / Release Directive in Airlock
app.post("/api/commander/airlock/directive", (req, res) => {
  try {
    verifyCockpitCsrf(req);
    const missionId = req.body?.mission_id || activeMissionId;
    let rawMission = commander.store.state.missions[missionId];
    if (!rawMission || rawMission.status === "completed" || rawMission.status === "killed") {
      const created = commander.airlock.openMission(defaultOperatorPrincipal, DEFAULT_MISSION_DEF);
      activeMissionId = created.id;
      rawMission = commander.store.state.missions[activeMissionId]!;
    } else if (rawMission.status === "paused" || rawMission.status === "quarantined") {
      if (rawMission.pausedFor) {
        const pending = commander.store.state.approvals[rawMission.pausedFor];
        if (pending && pending.status === "pending") {
          commander.airlock.decideApproval(defaultTenantId, pending.id, "authorize", "Resumed by operator.", "operator");
        }
      }
      rawMission.status = "active";
      rawMission.pausedFor = undefined;
      const curStep = rawMission.steps[rawMission.current];
      if (curStep && curStep.status === "quarantined") {
        curStep.status = "released";
        curStep.attemptBudget += curStep.def.max_attempts;
      }
    }
    const directive = commander.airlock.getDirective(defaultWorkerPrincipal, rawMission.id);
    recordMissionEvent(rawMission.id, "directive.issued", directive.message, "running");

    res.json({
      directive,
      message: directive.message,
      mission: buildLiveMissionPayload(rawMission.id),
      cockpit: buildCockpitSnapshot(),
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// 3. Submit Mechanical Proof to Airlock & Verifiers (including LocalWitness)
app.post("/api/commander/airlock/proof", async (req, res) => {
  try {
    verifyCockpitCsrf(req);
    const missionId = req.body?.mission_id || activeMissionId;
    let rawMission = commander.store.state.missions[missionId];
    if (!rawMission || rawMission.status === "completed" || rawMission.status === "killed") {
      const created = commander.airlock.openMission(defaultOperatorPrincipal, DEFAULT_MISSION_DEF);
      activeMissionId = created.id;
      rawMission = commander.store.state.missions[activeMissionId]!;
    }

    // If mission is paused or quarantined, resume before verifying proof
    if (rawMission.status === "paused" || rawMission.status === "quarantined") {
      if (rawMission.pausedFor) {
        const pending = commander.store.state.approvals[rawMission.pausedFor];
        if (pending && pending.status === "pending") {
          commander.airlock.decideApproval(defaultTenantId, pending.id, "authorize", "Operator direct verification.", "operator");
        }
      }
      rawMission.status = "active";
      rawMission.pausedFor = undefined;
      const curStep = rawMission.steps[rawMission.current];
      if (curStep && curStep.status === "quarantined") {
        curStep.status = "released";
        curStep.attemptBudget += curStep.def.max_attempts;
      }
    }

    const currentStep = rawMission.steps[rawMission.current];
    if (currentStep && (currentStep.status === "locked" || !currentStep.lease || currentStep.lease.revoked)) {
      commander.airlock.getDirective(defaultWorkerPrincipal, rawMission.id);
    }

    const leaseId = req.body?.lease_id || rawMission.steps[rawMission.current]?.lease?.id || "";
    const stepIdx = rawMission.current;
    const stepNonce = rawMission.steps[stepIdx]?.nonce;

    let evidence = req.body?.evidence;
    if (!evidence) {
      if (req.body?.preset === "fail" || req.body?.simulateFailure === true) {
        evidence = {
          exit_code: 1,
          stdout: `Test suite failed at ${Date.now()}: 2 assertions broken`,
          claim: "All checks completed.",
        };
      } else {
        if (stepIdx === 0) {
          evidence = {
            exit_code: 0,
            stdout: `654 passed, 0 failed\nverified-nonce: ${stepNonce ?? "nonce_ok"}`,
          };
        } else if (stepIdx === 1) {
          evidence = {
            exit_code: 0,
            stdout: "manifest emitted",
            artifacts: {
              "manifest.json": JSON.stringify({ version: "4.2.0", checksum: "sha256_9f86d081884c7d659a2feaa0c55ad015" }),
            },
          };
        } else if (stepIdx === 2) {
          evidence = {
            exit_code: 0,
            stdout: "DDL migration applied cleanly to releases table",
          };
        } else {
          evidence = {
            exit_code: 0,
            stdout: JSON.stringify({ status: "healthy", errorRate: 0, version: "4.2.0" }),
          };
        }
      }
    }

    const result = await commander.airlock.submitProof(defaultWorkerPrincipal, rawMission.id, {
      lease_id: leaseId,
      evidence,
    });

    if (result.verdict === "PASSED") {
      recordMissionEvent(rawMission.id, "proof.accepted", result.message, "verified");
    } else if (result.verdict === "QUARANTINED") {
      recordMissionEvent(rawMission.id, "step.quarantined", result.message, "quarantined");
    } else {
      recordMissionEvent(rawMission.id, "proof.rejected", result.message, "running");
    }

    res.json({
      proof: {
        ...result,
        status: result.verdict === "PASSED" ? "passed" : "failed",
      },
      message: result.message,
      mission: buildLiveMissionPayload(rawMission.id),
      cockpit: buildCockpitSnapshot(),
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// 4. Request Action Clearance through Sentinel & Airlock (supports MCP or Native Guard Intercept)
app.post("/api/commander/airlock/clearance", async (req, res) => {
  try {
    verifyCockpitCsrf(req);
    const missionId = req.body?.mission_id || activeMissionId;
    let rawMission = commander.store.state.missions[missionId];
    if (!rawMission || rawMission.status === "completed" || rawMission.status === "killed") {
      const created = commander.airlock.openMission(defaultOperatorPrincipal, DEFAULT_MISSION_DEF);
      activeMissionId = created.id;
      rawMission = commander.store.state.missions[activeMissionId]!;
    } else if (rawMission.status === "paused" || rawMission.status === "quarantined") {
      if (rawMission.pausedFor) {
        const pending = commander.store.state.approvals[rawMission.pausedFor];
        if (pending && pending.status === "pending") {
          commander.airlock.decideApproval(defaultTenantId, pending.id, "authorize", "Proceeding to next clearance evaluation.", "operator");
        }
      }
      rawMission.status = "active";
      rawMission.pausedFor = undefined;
      const curStep = rawMission.steps[rawMission.current];
      if (curStep && curStep.status === "quarantined") {
        curStep.status = "released";
        curStep.attemptBudget += curStep.def.max_attempts;
      }
    }

    const currentStep = rawMission.steps[rawMission.current];
    if (currentStep && (currentStep.status === "locked" || !currentStep.lease || currentStep.lease.revoked)) {
      commander.airlock.getDirective(defaultWorkerPrincipal, rawMission.id);
    }

    const leaseId = req.body?.lease_id || rawMission.steps[rawMission.current]?.lease?.id || "";
    const action: ActionRequest = req.body?.action
      ? ActionRequestSchema.parse(req.body.action)
      : {
          kind: "sql",
          payload: "ALTER TABLE releases ADD COLUMN release_notes text;",
          intent: req.body?.category || "schema_change",
        };

    const isGuard = req.body?.source === "guard" || Boolean(req.body?.tool);
    const result = isGuard
      ? await commander.airlock.requestGuardClearance(defaultWorkerPrincipal, rawMission.id, {
          action,
          tool: req.body?.tool || "Bash/Write",
        })
      : await commander.airlock.requestClearance(defaultWorkerPrincipal, rawMission.id, {
          lease_id: leaseId,
          action,
        });

    recordMissionEvent(
      rawMission.id,
      result.verdict === "STAGED"
        ? "clearance.staged"
        : result.verdict === "DENIED"
        ? "clearance.denied"
        : "clearance.allowed",
      result.message,
      result.verdict === "STAGED"
        ? "staged"
        : result.verdict === "DENIED"
        ? "quarantined"
        : "running"
    );

    res.json({
      clearance: result,
      message: result.message,
      mission: buildLiveMissionPayload(rawMission.id),
      cockpit: buildCockpitSnapshot(),
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// 5. Trigger Quarantine / Block directly for testing or step containment
app.post("/api/commander/airlock/quarantine", async (req, res) => {
  try {
    verifyCockpitCsrf(req);
    const missionId = req.body?.mission_id || activeMissionId;
    const rawMission = commander.store.state.missions[missionId];
    if (!rawMission) throw new CommanderError("NOT_FOUND", say.notFound());

    if (rawMission.status === "paused" && rawMission.pausedFor) {
      const pending = commander.store.state.approvals[rawMission.pausedFor];
      if (pending && pending.status === "pending") {
        commander.airlock.decideApproval(defaultTenantId, pending.id, "authorize", "Proceeding to verification check.", "operator");
      }
    }

    const step = rawMission.steps[rawMission.current];
    if (!step) throw new CommanderError("CONFLICT", say.conflict("No active step."));

    if (step.status === "locked" || !step.lease || step.lease.revoked) {
      commander.airlock.getDirective(defaultWorkerPrincipal, missionId);
    }

    let lastProof;
    let safety = 10;
    while (rawMission.status === "active" && step.status === "released" && safety-- > 0) {
      lastProof = await commander.airlock.submitProof(defaultWorkerPrincipal, missionId, {
        lease_id: step.lease!.id,
        evidence: {
          exit_code: 1,
          stdout: `FATAL: mechanical invariant check failed (${Date.now()}-${safety})`,
          claim: "Worker claims success despite exit 1",
        },
      });
      if (lastProof.verdict === "QUARANTINED") break;
    }

    recordMissionEvent(missionId, "step.quarantined", say.quarantined(), "quarantined");

    res.json({
      proof: lastProof,
      message: say.quarantined(),
      mission: buildLiveMissionPayload(missionId),
      cockpit: buildCockpitSnapshot(),
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// 6. One-Tap Operator Decision (Authorize / Redirect / Kill) — CSRF protected
app.post("/api/commander/decision", (req, res) => {
  try {
    verifyCockpitCsrf(req);
    const body = z
      .object({
        approval_id: z.string().optional(),
        decision: z.enum(["authorize", "redirect", "kill"]),
        note: z.string().max(400).optional(),
      })
      .parse(req.body);

    const pendingList = commander.approvals.list(defaultTenantId, "pending");
    const targetApprovalId = body.approval_id || pendingList[0]?.id;

    let voiceMessage = "";
    let decidedApproval = null;

    if (targetApprovalId) {
      decidedApproval = commander.airlock.decideApproval(
        defaultTenantId,
        targetApprovalId,
        body.decision as Decision,
        body.note,
        "operator"
      );
      voiceMessage =
        body.decision === "authorize"
          ? say.authorized()
          : body.decision === "redirect"
          ? say.redirected(body.note || "Re-plan approach and satisfy mechanical verifiers.")
          : say.killed();

      const m = commander.store.state.missions[activeMissionId];
      if (m && m.status === "active" && body.decision !== "kill") {
        const s = m.steps[m.current];
        if (s && !s.lease) {
          commander.airlock.getDirective(defaultWorkerPrincipal, activeMissionId);
        }
      }
    } else {
      const m = commander.store.state.missions[activeMissionId];
      if (!m) throw new CommanderError("NOT_FOUND", say.notFound());

      if (body.decision === "kill") {
        commander.airlock.intervene(defaultOperatorPrincipal, m.id, {
          action: "kill",
          reason: body.note || "Terminated by operator from HUD cockpit.",
        });
        voiceMessage = say.killed();
      } else if (body.decision === "redirect") {
        const step = m.steps[m.current];
        const cleanNote = body.note?.trim() || "Re-route execution and verify exit code 0.";
        if (step) {
          step.operatorPatch = cleanNote;
          if (m.status === "quarantined" || m.status === "paused") {
            m.status = "active";
            m.pausedFor = undefined;
            step.status = "released";
            step.attemptBudget += step.def.max_attempts;
          }
          commander.store.audit(defaultTenantId, "operator.redirect", {
            missionId: m.id,
            stepId: step.id,
            note: cleanNote,
          });
          commander.store.touch();
          if (!step.lease || step.lease.revoked) {
            commander.airlock.getDirective(defaultWorkerPrincipal, m.id);
          }
        }
        voiceMessage = say.redirected(cleanNote);
      } else {
        const step = m.steps[m.current];
        if (step && (m.status === "quarantined" || m.status === "paused")) {
          m.status = "active";
          m.pausedFor = undefined;
          step.status = "released";
          step.attemptBudget += step.def.max_attempts;
        }
        commander.airlock.getDirective(defaultWorkerPrincipal, m.id);
        voiceMessage = say.authorized();
      }
    }

    recordMissionEvent(
      activeMissionId,
      body.decision === "redirect" ? "operator.redirect" : "approval.decided",
      voiceMessage,
      body.decision === "kill" ? "quarantined" : "running"
    );

    res.json({
      ok: true,
      decision: body.decision,
      approval: decidedApproval,
      message: voiceMessage,
      voice: VOICE_PROFILE,
      mission: buildLiveMissionPayload(activeMissionId),
      cockpit: buildCockpitSnapshot(),
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// 7. Reset / Re-open Mission in Airlock
app.post("/api/commander/reset", async (req, res) => {
  try {
    verifyCockpitCsrf(req);
    const mode = req.body?.mode as "idle" | "running" | "staged" | undefined;
    const stageInitial = Boolean(req.body?.stageInitial) || mode === "staged";
    const created = commander.airlock.openMission(defaultOperatorPrincipal, DEFAULT_MISSION_DEF);
    activeMissionId = created.id;

    let message = "Airlock ready. No active worker lease allocated.";
    let targetSphere: AirlockSphereState = "idle";

    if (mode === "running" || stageInitial) {
      const d = commander.airlock.getDirective(defaultWorkerPrincipal, activeMissionId);
      message = d.message;
      targetSphere = "running";
      if (stageInitial && d.state === "DIRECTIVE") {
        const c = await commander.airlock.requestGuardClearance(defaultWorkerPrincipal, activeMissionId, {
          tool: "Bash/Write",
          action: {
            kind: "sql",
            payload: "ALTER TABLE releases ADD COLUMN release_notes text;",
            intent: "schema_change",
          },
        });
        message = c.message;
        targetSphere = "staged";
      }
    }

    recordMissionEvent(
      activeMissionId,
      stageInitial ? "clearance.staged" : mode === "running" ? "directive.issued" : "mission.opened",
      message,
      targetSphere
    );

    res.json({
      ok: true,
      message,
      mission: buildLiveMissionPayload(activeMissionId),
      cockpit: buildCockpitSnapshot(),
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// 8. Standalone Sentinel Check Endpoint
app.post(["/api/commander/sentinel/check", "/v1/sentinel/scan"], (req, res) => {
  try {
    const raw = req.body?.action ?? req.body ?? {};
    const normalized = raw.kind
      ? raw
      : {
          kind: "shell",
          payload:
            typeof raw?.args?.cmd === "string"
              ? raw.args.cmd
              : typeof raw?.payload === "string"
              ? raw.payload
              : JSON.stringify(raw?.args ?? raw),
          intent: raw?.intent ?? raw?.category,
          target: raw?.target,
        };
    const action = ActionRequestSchema.parse(normalized);
    const decision = standaloneSentinel.scan(action);
    const findings = decision.findings.map((f) => ({ rule: f.rule, verdict: f.verdict, reason: f.reason }));
    const message =
      decision.verdict === "allow"
        ? say.cleared()
        : decision.verdict === "deny"
        ? say.denied()
        : say.staged();
    res.json({
      verdict: decision.verdict.toUpperCase(),
      actionHash: decision.actionHash,
      findings,
      message,
      patch: decision.verdict === "deny" ? actionRedirectPatch(findings) : undefined,
      voice: VOICE_PROFILE,
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

// 9. Standalone Mechanical Verifiers Endpoint
app.post(["/api/commander/verifiers/run", "/v1/verifiers/verify"], (req, res) => {
  try {
    const rawMission = commander.store.state.missions[activeMissionId];
    const currentStep = rawMission?.steps[rawMission.current];
    const stepDef: StepDef = req.body?.step
      ? StepDefSchema.parse(req.body.step)
      : currentStep?.def ?? DEFAULT_MISSION_DEF.steps[0]!;
    const evidence = EvidenceSchema.parse(req.body?.evidence ?? { exit_code: 0, stdout: "654 passed" });
    const nonce = req.body?.nonce ?? currentStep?.nonce;

    const results = runVerifiers(stepDef, {
      evidence,
      nonce,
      policy: commanderConfig.policy,
    });
    const passed = results.every((r) => r.ok);

    res.json({
      verdict: passed ? "PASSED" : "REJECTED",
      message: passed ? say.accepted() : say.rejected(results.filter((r) => !r.ok).length, 1, stepDef.max_attempts),
      results,
      voice: VOICE_PROFILE,
    });
  } catch (err) {
    handleCommanderError(err, res);
  }
});

/* -------------------------------------------------------------------------- */
/* API ROUTES: GEMINI PROJECT INTEGRATION & COMMANDER_SOUL DIALOGUE ENGINE    */
/* -------------------------------------------------------------------------- */

app.get("/api/gemini/status", (req, res) => {
  res.json({
    status: "online",
    defaultProvider: "Google Gemini Project (Primary Route)",
    defaultModel: DEFAULT_GEMINI_MODEL,
    // Beta: each visitor brings their own key. This says whether THIS request carried one (a shape check, not Google's verdict).
    keyMode: "bring-your-own",
    hasApiKey: Boolean(resolveStudioKey(req.headers)),
    persona: "COMMANDER_SOUL",
    voiceProfile: VOICE_PROFILE,
    capabilities: [
      "step-gated-airlock",
      "perimeter-sentinel",
      "mechanical-verifiers",
      "local-witness-runner",
      "commander-soul-persona",
    ],
    timestamp: Date.now(),
  });
});

app.post("/api/gemini/generate", async (req, res) => {
  const { prompt, systemInstruction } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing required prompt parameter" });
  }

  try {
    if (!geminiApiKey) {
      return res.json({
        text: enforceCommanderVoice(
          `Directive issued for "${prompt.slice(0, 40)}". Execute exactly. Return mechanical proof.`
        ),
        model: DEFAULT_GEMINI_MODEL,
        simulated: true,
      });
    }

    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          systemInstruction ||
          `${COMMANDER_SOUL_SPEC}\n\nSpeak strictly as Agent Commander. Short declaratives. Orders, not requests. Never apologize.`,
      },
    });

    return res.json({
      text: enforceCommanderVoice(response.text || ""),
      model: DEFAULT_GEMINI_MODEL,
      usage: response.usageMetadata || null,
      simulated: false,
    });
  } catch (error: any) {
    console.error("Gemini Generation Error:", scrubKey(String(error?.message ?? error), geminiApiKey));
    return res.status(500).json({
      error: scrubKey(String(error?.message ?? "Internal error calling Gemini API"), geminiApiKey),
      model: DEFAULT_GEMINI_MODEL,
    });
  }
});

// Read-Only Ledger Query Dialogue Engine wired to COMMANDER_SOUL.md Persona
// Security Hardening: Voice/chat inputs are strictly restricted to querying the ledger;
// Authorize, Redirect, and Kill cannot be triggered from voice or chat.
app.post(["/api/orator/chat", "/api/commander/chat"], async (req, res) => {
  const { messages, userMessage, message, input, systemPrompt } = req.body ?? {};
  const userText = String(
    userMessage || message || input || (Array.isArray(messages) && messages[messages.length - 1]?.text) || ""
  ).trim();

  if (!userText && (!Array.isArray(messages) || messages.length === 0)) {
    return res.status(400).json({ error: "No messages or input provided" });
  }

  const liveMission = buildLiveMissionPayload(activeMissionId);
  const auditVerify = buildAuditVerificationPayload(defaultTenantId);
  const currentStepTitle = liveMission.current_step?.title ?? "Step 1";
  const currentStepStatus = liveMission.current_step?.status ?? "released";
  const pendingApprovalCount = liveMission.approvals.length;

  // Security Gate: Block state-mutating operator commands on voice/chat channel
  const lower = userText.toLowerCase();
  const isReadOnlyQuestion =
    lower.startsWith("why ") ||
    lower.startsWith("what ") ||
    lower.startsWith("how ") ||
    lower.startsWith("show ") ||
    lower.startsWith("status") ||
    lower.startsWith("explain ");

  if (!isReadOnlyQuestion && /\b(authorize|kill|redirect|approve|abort|terminate)\b/i.test(lower)) {
    const blockedReply = enforceCommanderVoice(
      "Voice and chat channels are restricted to read-only ledger queries. Execute Authorize, Redirect, or Kill exclusively via signed single-use capability links or CSRF-protected cockpit controls."
    );
    return res.json({
      reply: blockedReply,
      voice: VOICE_PROFILE,
      readOnlyEnforced: true,
      model: DEFAULT_GEMINI_MODEL,
      simulated: !geminiApiKey,
    });
  }

  const commanderSystemInstruction = `${COMMANDER_SOUL_SPEC}

LIVE CONTROL PLANE TELEMETRY (READ-ONLY LEDGER QUERY):
- Tenant: ${liveMission.tenant.name} (${liveMission.tenant.credits} credits remaining)
- Mission: ${liveMission.title} [status: ${liveMission.status}]
- Current Step: ${currentStepTitle} [status: ${currentStepStatus}, attempt ${liveMission.current_step?.attempt ?? 1} of ${liveMission.current_step?.attempt_budget ?? 3}]
- Pending Staged Gates: ${pendingApprovalCount}
- Audit Chain Verified: ${auditVerify.ok} (depth: ${auditVerify.count} entries)
- Sphere State: ${liveMission.sphere_state.toUpperCase()}

STRICT OUTPUT RULES:
1. You are Agent Commander, a supervisory control plane, auditor, and Director of Operations.
2. This channel is strictly read-only for querying the mission and audit ledger. Never claim to execute Authorize, Redirect, or Kill from chat.
3. Direct, clipped, articulate. Short declaratives (2-3 sentences maximum).
4. Never say "sorry", "my bad", "my mistake", "I apologize", "forgive me", "unfortunately", or any variant.
5. No exclamation marks. No emojis. No hedging adverbs.`;

  try {
    if (!geminiApiKey) {
      let reply = `Ledger query acknowledged. Step "${currentStepTitle}" is ${currentStepStatus} with ${pendingApprovalCount} pending gate(s) and SHA-256 chain depth ${auditVerify.count} (verified: ${auditVerify.ok}).`;

      if (lower.includes("audit") || lower.includes("chain") || lower.includes("hash")) {
        reply = `SHA-256 audit chain verified: ${auditVerify.ok}. Chain depth stands at ${auditVerify.count} records anchored to head ${auditVerify.headHash.slice(0, 12)}.`;
      } else if (lower.includes("status") || lower.includes("step") || lower.includes("report") || lower.includes("why")) {
        reply = `Mission "${liveMission.title}" is ${liveMission.status}. Step "${currentStepTitle}" is ${currentStepStatus} with ${pendingApprovalCount} pending gate(s). ${liveMission.last_event.summary}`;
      }

      const cleanReply = enforceCommanderVoice(reply);
      return res.json({
        reply: cleanReply,
        voice: VOICE_PROFILE,
        violationsFixed: voiceViolations(reply),
        model: DEFAULT_GEMINI_MODEL,
        simulated: true,
      });
    }

    const conversationHistory = Array.isArray(messages)
      ? messages
          .map((m: any) => `${m.role === "user" ? "Operator" : "Commander"}: ${m.text}`)
          .join("\n")
      : `Operator: ${userText}`;

    const promptPayload = `Control Plane Read-Only Ledger Query:
${conversationHistory}
Operator: ${userText}

Reply strictly as Agent Commander following COMMANDER_SOUL.md. Use 2-3 clipped declarative sentences. Zero apologies. Zero padding. Zero exclamation marks.`;

    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: promptPayload,
      config: {
        systemInstruction: systemPrompt || commanderSystemInstruction,
        temperature: 0.2,
      },
    });

    const rawReply =
      response.text?.trim() ||
      `Ledger query complete. Step "${currentStepTitle}" awaits mechanical verification.`;
    const cleanReply = enforceCommanderVoice(rawReply);

    return res.json({
      reply: cleanReply,
      voice: VOICE_PROFILE,
      violationsFixed: voiceViolations(rawReply),
      model: DEFAULT_GEMINI_MODEL,
      usage: response.usageMetadata || null,
      simulated: false,
    });
  } catch (error: any) {
    console.error("Commander Chat Error:", error?.message || error);
    const fallback = enforceCommanderVoice(
      `Step "${currentStepTitle}" remains under airlock enforcement. SHA-256 chain depth is ${auditVerify.count}.`
    );
    return res.json({
      reply: fallback,
      voice: VOICE_PROFILE,
      model: DEFAULT_GEMINI_MODEL,
      simulated: true,
    });
  }
});

// 3. CORTEX Step Deliberation (Real Agentic Telemetry Stream)
app.post("/api/gemini/cortex-deliberate", async (req, res) => {
  const { taskPrompt, phase = "draft", agentName = "Agent Commander" } = req.body ?? {};
  // A demo result says so. It never claims a model ran when none did.
  const demo = (reason: StudioReason) =>
    res.json({
      simulated: true,
      reason,
      title: `${agentName}: ${phase} gate (demo)`,
      detail: DEMO_COPY[reason],
      confidence: 0,
      tokenCount: 0,
      model: null,
      provider: "Demo: no live model ran",
    });

  const key = resolveStudioKey(req.headers);
  if (!key) return demo("no_key");

  try {
    const call = studioAi(key).models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: `Task: "${taskPrompt || "Enforce step-gated airlock invariants"}".
Phase: ${phase}.
Agent: ${agentName}.
Respond with a concise, single-sentence technical step title and a 1-sentence validation detail in the clipped voice of Agent Commander.`,
      config: {
        systemInstruction: `${COMMANDER_SOUL_SPEC}\nReturn concise engineering audit decisions.`,
        temperature: 0.2,
        abortSignal: AbortSignal.timeout(STUDIO_MODEL_TIMEOUT_MS),
      },
    });
    const response = await withDeadline(call, STUDIO_MODEL_TIMEOUT_MS);

    const text = response.text || "";
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const title = lines[0]
      ? lines[0].replace(/^#+\s*|^Title:\s*/i, "").slice(0, 80)
      : `${agentName}: ${phase} evaluation`;
    const detail = lines[1]
      ? lines[1].replace(/^Detail:\s*/i, "").slice(0, 140)
      : text.slice(0, 140);

    const confidence = 0.92 + Math.random() * 0.07;

    return res.json({
      simulated: false,
      title: enforceCommanderVoice(title),
      detail: enforceCommanderVoice(detail),
      confidence,
      tokenCount: response.usageMetadata?.totalTokenCount || 240,
      model: DEFAULT_GEMINI_MODEL,
      provider: "Google Gemini Project (Active)",
    });
  } catch (error: any) {
    console.error("Cortex Deliberation Error:", scrubKey(String(error?.message ?? error), key));
    return demo(classifyModelFailure(error));
  }
});

// 4. Design Exploration Brief Generation
// Only the fields the client reads, and only with the right shape: the model's output is not trusted to add others.
const ExploreReply = z.object({
  conceptName: z.string().max(120),
  summary: z.string().max(600),
  strengths: z.array(z.string().max(200)).max(6).default([]),
});

app.post("/api/gemini/explore", async (req, res) => {
  const { answers, ingest } = req.body ?? {};
  // No canned concept: when no model ran the client keeps its own deterministic brief instead of showing someone else's.
  const demo = (reason: StudioReason) => res.json({ simulated: true, reason, model: null });

  const key = resolveStudioKey(req.headers);
  if (!key) return demo("no_key");

  try {
    const call = studioAi(key).models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: `User Inquest Answers: ${JSON.stringify(answers || {})}. User Ingest: ${JSON.stringify(ingest || {})}.
Produce a JSON object with:
"conceptName": string (concise name),
"summary": string (2 clipped declarative sentences in the COMMANDER_SOUL voice),
"strengths": array of 3 short key technical strengths.`,
      config: {
        responseMimeType: "application/json",
        abortSignal: AbortSignal.timeout(STUDIO_MODEL_TIMEOUT_MS),
      },
    });
    const response = await withDeadline(call, STUDIO_MODEL_TIMEOUT_MS);

    const reply = ExploreReply.safeParse(JSON.parse(response.text || "{}"));
    if (!reply.success) return demo("model_error");
    return res.json({ ...reply.data, simulated: false, model: DEFAULT_GEMINI_MODEL });
  } catch (error: any) {
    console.error("Exploration Gen Error:", scrubKey(String(error?.message ?? error), key));
    return demo(classifyModelFailure(error));
  }
});

/* -------------------------------------------------------------------------- */
/* VITE DEV / PRODUCTION MIDDLEWARE                                           */
/* -------------------------------------------------------------------------- */

async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true, host: HOST, port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[ORATOR // AGENT COMMANDER] Server running on http://${HOST}:${PORT}`);
    console.log(`[ORATOR // AGENT COMMANDER] Airlock, Sentinel & Verifier routes mounted (/v1/* & /api/commander/*), all behind the security gate`);
    if (security.cockpitTokenGenerated) {
      console.log(`[COCKPIT] Unlock token for this run: ${security.cockpitToken}`);
      console.log(`[COCKPIT] It changes on every restart. Set COMMANDER_COCKPIT_TOKEN (16+ characters) to keep one.`);
      if (security.autoLocalSession) {
        console.log(`[COCKPIT] A browser on this machine (http://localhost:${PORT}) is unlocked automatically.`);
      }
    } else {
      console.log(`[COCKPIT] Unlock token loaded from COMMANDER_COCKPIT_TOKEN.`);
    }
    console.log(
      security.adminToken
        ? `[ADMIN] /v1/admin is enabled (COMMANDER_ADMIN_TOKEN).`
        : `[ADMIN] COMMANDER_ADMIN_TOKEN is not set: /v1/admin is disabled.`
    );
    console.log(
      !witnessAvailable
        ? `[WITNESS] Off.`
        : witnessCanRunCommands
        ? `[WITNESS] ENABLED and may run: ${commanderConfig.witness.allow.join(", ")} (workspace ${commanderConfig.witness.root}). This executes code on this machine; use it only where you trust the workspace.`
        : `[WITNESS] Inspect-only: it can read files under the workspace and cannot run commands.`
    );
  });
}

startServer();
