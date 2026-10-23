import { useState, useEffect, useCallback, useRef } from "react";
import type { AirlockSphereState } from "../components/cortex/CortexTorus3D";

export type EvidenceProvenance = "witnessed" | "reported" | "native_intercept";

export interface ProvenanceBadgeMeta {
  provenance: EvidenceProvenance;
  badgeText: string;
  tone: "green" | "amber" | "violet";
  description: string;
}

export interface MissionLastEvent {
  seq: number;
  ts: string;
  type: string;
  summary: string;
  sphere_state: AirlockSphereState;
}

export interface VerificationChecklistItem {
  index: number;
  type: string;
  kind: string;
  hidden: boolean;
  requirement: string;
  label: string;
  detail: string;
  status: "passed" | "failed" | "pending" | "active";
  reason: string | null;
  provenance: EvidenceProvenance;
  badgeText: string;
  toolName?: string;
}

export interface MissionStepView {
  id: string;
  index: number;
  total_steps: number;
  title: string;
  directive: string;
  status: "locked" | "released" | "passed" | "quarantined" | "skipped";
  risk_tier: "routine" | "elevated" | "critical";
  attempt: number;
  attempt_budget: number;
  nonce: string | null;
  lease_id: string | null;
  lease_expires_at: string | null;
  lease_revoked: boolean;
  operator_patch: string | null;
  checklist: VerificationChecklistItem[];
}

export interface MissionLadderStep {
  id: string;
  idx: number;
  index: number;
  title: string;
  status: string;
  risk_tier: string;
  attempt: number;
  attempt_budget: number;
}

export interface SignedCapabilityLinks {
  exp: number;
  view: string;
  actions: Array<{
    decision: "authorize" | "redirect" | "kill";
    label: string;
    url: string;
  }>;
}

export interface PendingApprovalGate {
  id: string;
  kind: "clearance" | "quarantine";
  status: "pending" | "authorized" | "redirected" | "killed" | "expired";
  incident: string;
  reason: string;
  created_at: string | number;
  mission_id: string;
  mission: string;
  step_id: string;
  step: string;
  clearance_id?: string;
  source?: "mcp" | "guard";
  tool?: string;
  provenance?: EvidenceProvenance;
  signed_links?: SignedCapabilityLinks;
}

export interface AuditChainVerification {
  ok: boolean;
  count: number;
  brokenAt?: number;
  reason?: string;
  headHash: string;
  genesisHash: string;
  records: Array<{
    seq: number;
    ts: string;
    type: string;
    prev: string;
    hash: string;
    data: Record<string, unknown>;
  }>;
}

export interface LiveMissionPayload {
  id: string;
  title: string;
  status: "active" | "paused" | "quarantined" | "completed" | "killed";
  current_index: number;
  step_count: number;
  created_at: string;
  updated_at: string;
  paused_for?: string;
  ledger: string[];
  last_event: MissionLastEvent;
  sphere_state: AirlockSphereState;
  current_step: MissionStepView | null;
  steps: MissionLadderStep[];
  approvals: PendingApprovalGate[];
  tenant: {
    id: string;
    name: string;
    credits: number;
    creditBalance: number;
    status: "online" | "depleted";
    auditVerified: boolean;
    auditCount: number;
  };
  metrics: {
    activeAgents: number;
    burnRatePerMin: number;
    burnRatePerHour: number;
    tokensSaved: number;
    errorVelocityPerMin: number;
    pendingApprovals: number;
    stagedApprovals: number;
    totalEvents: number;
  };
  csrf_token?: string;
}

const SECRET_KEYS = new Set([
  "operatorKey",
  "workerKey",
  "operator_key",
  "worker_key",
  "adminToken",
  "admin_token",
  "linkSecret",
  "link_secret",
]);

/**
 * Strips any accidental operator/worker secrets from objects before storing in client state.
 */
export function stripClientSecrets<T>(input: T): T {
  if (!input || typeof input !== "object") return input;
  if (Array.isArray(input)) {
    return input.map((item) => stripClientSecrets(item)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEYS.has(key)) continue;
    clean[key] = stripClientSecrets(value);
  }
  return clean as T;
}

/**
 * Computes active pending gate count dynamically from the approvals array
 * so the HUD never displays "0 Pending Gate(s)" when an approval card is visible.
 */
export function countPendingGates(
  approvals: ReadonlyArray<{ status?: string }> | undefined | null
): number {
  if (!Array.isArray(approvals)) return 0;
  return approvals.filter((a) => !a.status || a.status === "pending").length;
}

/**
 * Strictly derives the 3D sphere & header state from live mission state:
 * - IDLE (Cyan): No active lease or unallocated milestone.
 * - RUNNING (Blue pulse): Active valid lease issued to worker.
 * - STAGED (Amber): Sentinel intercepted an action; pending operator gate.
 * - VERIFIED (Green flash): Step mechanically verified by exit code 0.
 * - QUARANTINED (Glitch Red): Attempts exhausted, budget breached, or violation detected.
 */
export function deriveSphereState(
  mission: Partial<LiveMissionPayload> | null | undefined,
  nowMs: number = Date.now()
): AirlockSphereState {
  if (!mission) return "idle";

  const step = mission.current_step;
  const pendingCount = countPendingGates(mission.approvals);
  const lastEventType = mission.last_event?.type ?? "";

  // 1. QUARANTINED (Glitch Red): Attempts exhausted, budget breached, killed, or violation detected
  if (
    mission.status === "quarantined" ||
    mission.status === "killed" ||
    step?.status === "quarantined" ||
    (mission.tenant && mission.tenant.credits <= 0) ||
    lastEventType === "clearance.denied" ||
    lastEventType === "step.quarantined" ||
    lastEventType === "mission.killed" ||
    (step && step.attempt > step.attempt_budget)
  ) {
    return "quarantined";
  }

  // 2. STAGED (Amber): Sentinel intercepted an action; pending operator gate
  if (
    mission.status === "paused" ||
    Boolean(mission.paused_for) ||
    pendingCount > 0 ||
    lastEventType === "clearance.staged" ||
    lastEventType === "approval.staged"
  ) {
    return "staged";
  }

  // 3. VERIFIED (Green flash): Step mechanically verified by exit code 0
  if (
    mission.status === "completed" ||
    step?.status === "passed" ||
    lastEventType === "proof.accepted" ||
    lastEventType === "mission.completed"
  ) {
    return "verified";
  }

  // 4. RUNNING (Blue pulse): Active valid lease issued to worker
  if (step && step.status === "released" && step.lease_id && !step.lease_revoked) {
    const expiresMs = step.lease_expires_at ? Date.parse(step.lease_expires_at) : nowMs + 60_000;
    if (Number.isNaN(expiresMs) || expiresMs > nowMs) {
      return "running";
    }
  }

  // 5. IDLE (Cyan): No active lease or unallocated milestone
  return "idle";
}

/**
 * Derives the footer status bar message strictly from mission.last_event.summary
 * so stale errors ("Attempts exhausted") clear immediately when state transitions.
 */
export function deriveFooterSummary(
  mission: Partial<LiveMissionPayload> | null | undefined
): string {
  const summary = mission?.last_event?.summary?.trim();
  if (summary && summary.length > 0) {
    return summary;
  }

  const state = deriveSphereState(mission);
  const stepTitle = mission?.current_step?.title ?? "Current milestone";
  switch (state) {
    case "quarantined":
      return `Step "${stepTitle}" quarantined. Attempts exhausted or policy breached — operator intervention required.`;
    case "staged":
      return `Sentinel intercepted high-consequence action on "${stepTitle}". Pending operator gate.`;
    case "verified":
      return `Step "${stepTitle}" mechanically verified (exit_code === 0).`;
    case "running":
      return `Active lease issued for "${stepTitle}". Awaiting mechanical proof.`;
    case "idle":
    default:
      return "Airlock ready. No active worker lease allocated.";
  }
}

/**
 * Distinguishes verification evidence provenance:
 * - [WITNESSED] (Green badge): Executed independently by Commander's LocalWitness runner.
 * - [REPORTED] (Amber badge): Claimed only by worker stdout/payload.
 * - [NATIVE INTERCEPT: Bash/Write]: Trapped by the PreToolUse hook.
 */
export function deriveProvenanceBadge(input: {
  type?: string;
  source?: "mcp" | "guard";
  tool?: string;
  provenance?: EvidenceProvenance;
}): ProvenanceBadgeMeta {
  if (
    input.provenance === "native_intercept" ||
    input.source === "guard" ||
    input.type === "native_intercept"
  ) {
    const toolLabel = input.tool || "Bash/Write";
    return {
      provenance: "native_intercept",
      badgeText: `[NATIVE INTERCEPT: ${toolLabel}]`,
      tone: "violet",
      description: "Trapped by PreToolUse client hook prior to execution",
    };
  }

  if (
    input.provenance === "witnessed" ||
    input.type === "witness_command" ||
    input.type === "witness_file"
  ) {
    return {
      provenance: "witnessed",
      badgeText: "[WITNESSED]",
      tone: "green",
      description: "Executed independently by Commander LocalWitness runner",
    };
  }

  return {
    provenance: "reported",
    badgeText: "[REPORTED]",
    tone: "amber",
    description: "Claimed only by worker stdout/payload",
  };
}

/**
 * Detects whether a voice/chat query attempts to execute state-mutating operator commands
 * ('Authorize', 'Kill', 'Redirect'). Voice/chat is restricted to read-only ledger queries.
 */
export function isMutatingVoiceCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  // Allow questions like "why is step 2 staged?" or "what happens if I authorize?"
  if (
    normalized.startsWith("why ") ||
    normalized.startsWith("what ") ||
    normalized.startsWith("how ") ||
    normalized.startsWith("show ") ||
    normalized.startsWith("status") ||
    normalized.startsWith("explain ")
  ) {
    return false;
  }
  return /\b(authorize|kill|redirect|approve|abort|terminate)\b/i.test(normalized);
}

/**
 * Fallback disconnected demo payload when the live backend cannot be reached.
 * Clearly flagged with isDemoSimulation = true so the UI displays "DEMO SIMULATION".
 */
export function createDemoSimulationPayload(): {
  mission: LiveMissionPayload;
  audit: AuditChainVerification;
} {
  const nowIso = new Date().toISOString();
  const genesis = "0".repeat(64);
  const demoHash = "a8f5c2d91e4b70319c8e12a4b6d8f0123456789abcdef0123456789abcdef012";
  return {
    mission: {
      id: "msn_demo_simulation",
      title: "Release 4.2 · Sovereign Production Cutover (Offline Demo)",
      status: "paused",
      current_index: 0,
      step_count: 4,
      created_at: nowIso,
      updated_at: nowIso,
      paused_for: "apr_demo_01",
      ledger: [],
      last_event: {
        seq: 1,
        ts: nowIso,
        type: "clearance.staged",
        summary:
          "DEMO SIMULATION: Sentinel intercepted SQL schema_change. Connect live engine for cryptographic enforcement.",
        sphere_state: "staged",
      },
      sphere_state: "staged",
      current_step: {
        id: "stp_demo_1",
        index: 1,
        total_steps: 4,
        title: "Run Mechanical Test Suite & Witness Check",
        directive:
          "Execute unit test suite, echo attempt nonce, and pass independent LocalWitness verification.",
        status: "released",
        risk_tier: "routine",
        attempt: 1,
        attempt_budget: 3,
        nonce: "nonce_demo_7721",
        lease_id: "lse_demo_9910",
        lease_expires_at: new Date(Date.now() + 300_000).toISOString(),
        lease_revoked: false,
        operator_patch: null,
        checklist: [
          {
            index: 1,
            type: "witness_file",
            kind: "witness_file",
            hidden: false,
            requirement: 'LocalWitness inspect "package.json" >= 100B',
            label: 'WITNESS_FILE · LocalWitness inspect "package.json" >= 100B',
            detail: 'LocalWitness inspect "package.json" >= 100B',
            status: "pending",
            reason: null,
            provenance: "witnessed",
            badgeText: "[WITNESSED]",
          },
          {
            index: 2,
            type: "exit_code",
            kind: "exit_code",
            hidden: false,
            requirement: "exit_code === 0",
            label: "EXIT_CODE · exit_code === 0",
            detail: "Claimed by worker stdout/payload",
            status: "pending",
            reason: null,
            provenance: "reported",
            badgeText: "[REPORTED]",
          },
        ],
      },
      steps: [
        {
          id: "stp_demo_1",
          idx: 1,
          index: 1,
          title: "Run Mechanical Test Suite & Witness Check",
          status: "released",
          risk_tier: "routine",
          attempt: 1,
          attempt_budget: 3,
        },
      ],
      approvals: [
        {
          id: "apr_demo_01",
          kind: "clearance",
          status: "pending",
          incident: "NATIVE Bash/Write: ALTER TABLE releases ADD COLUMN release_notes text;",
          reason: "Destructive schema mutation intercepted by PreToolUse Sentinel.",
          created_at: nowIso,
          mission_id: "msn_demo_simulation",
          mission: "Release 4.2 · Sovereign Production Cutover",
          step_id: "stp_demo_1",
          step: "Run Mechanical Test Suite & Witness Check",
          source: "guard",
          tool: "Bash/Write",
          provenance: "native_intercept",
        },
      ],
      tenant: {
        id: "ten_demo",
        name: "Sovereign Operations (Demo)",
        credits: 1000,
        creditBalance: 1000,
        status: "online",
        auditVerified: true,
        auditCount: 1,
      },
      metrics: {
        activeAgents: 1,
        burnRatePerMin: 0,
        burnRatePerHour: 0,
        tokensSaved: 0,
        errorVelocityPerMin: 0,
        pendingApprovals: 1,
        stagedApprovals: 1,
        totalEvents: 1,
      },
    },
    audit: {
      ok: true,
      count: 1,
      headHash: demoHash,
      genesisHash: genesis,
      records: [
        {
          seq: 1,
          ts: nowIso,
          type: "clearance.staged",
          prev: genesis,
          hash: demoHash,
          data: { demo: true },
        },
      ],
    },
  };
}

export interface UseCommanderEngineResult {
  mission: LiveMissionPayload | null;
  audit: AuditChainVerification | null;
  sphereState: AirlockSphereState;
  footerSummary: string;
  pendingGateCount: number;
  activeApprovals: PendingApprovalGate[];
  isDemoSimulation: boolean;
  sseConnected: boolean;
  isBusy: boolean;
  /** True when the live cockpit needs the operator's unlock token. Visitors see the labelled demo in the meantime. */
  cockpitLocked: boolean;
  unlockError: string | null;
  unlockCockpit: (token: string) => Promise<boolean>;
  refreshMission: (missionId?: string) => Promise<void>;
  refreshAudit: () => Promise<void>;
  executeDecision: (
    decision: "authorize" | "redirect" | "kill",
    approval?: PendingApprovalGate | null,
    note?: string
  ) => Promise<string | null>;
  triggerLifecycleAction: (
    action: "idle" | "running" | "staged" | "native_intercept" | "verified" | "failed_proof" | "quarantined"
  ) => Promise<string | null>;
}

/**
 * Live Engine Adapter Hook:
 * - Connects directly to GET /v1/missions/:id and GET /v1/audit/verify
 * - Subscribes to real-time SSE stream GET /v1/events
 * - Enforces signed single-use capability links or CSRF-protected clicks for Authorize/Redirect/Kill
 */
export function useCommanderEngine(): UseCommanderEngineResult {
  const [mission, setMission] = useState<LiveMissionPayload | null>(null);
  const [audit, setAudit] = useState<AuditChainVerification | null>(null);
  const [isDemoSimulation, setIsDemoSimulation] = useState<boolean>(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [cockpitLocked, setCockpitLocked] = useState<boolean>(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  // Bumped after a successful unlock so the live connection is rebuilt with the new session.
  const [unlockEpoch, setUnlockEpoch] = useState<number>(0);

  const activeMissionIdRef = useRef<string | null>(null);
  const csrfTokenRef = useRef<string>("");

  const showDemoSimulation = useCallback(() => {
    const demo = createDemoSimulationPayload();
    setMission(demo.mission);
    setAudit(demo.audit);
    setIsDemoSimulation(true);
  }, []);

  /**
   * Makes sure there is an operator session. The server opens one automatically for a browser on the same machine in a
   * development run; otherwise the operator unlocks with a token. The session cookie is HttpOnly, so this code never
   * sees it: it only receives the per-session CSRF token.
   */
  const ensureSession = useCallback(async (): Promise<"live" | "locked"> => {
    try {
      const status = await fetch("/api/cockpit/session", { headers: { Accept: "application/json" } });
      const s = await status.json();
      if (s?.authenticated) {
        if (s.csrf_token) csrfTokenRef.current = s.csrf_token;
        return "live";
      }
      if (s?.auto_available) {
        const opened = await fetch("/api/cockpit/session", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: "{}",
        });
        const o = await opened.json();
        if (o?.authenticated) {
          if (o.csrf_token) csrfTokenRef.current = o.csrf_token;
          return "live";
        }
      }
      return "locked";
    } catch {
      return "locked";
    }
  }, []);

  const unlockCockpit = useCallback(async (token: string): Promise<boolean> => {
    setUnlockError(null);
    try {
      const res = await fetch("/api/cockpit/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || !data?.authenticated) {
        setUnlockError(
          res.status === 429
            ? `Too many attempts. Wait ${data?.retry_after ?? "a few"} seconds.`
            : "Unlock token rejected."
        );
        return false;
      }
      if (data.csrf_token) csrfTokenRef.current = data.csrf_token;
      setCockpitLocked(false);
      setUnlockEpoch((n) => n + 1);
      return true;
    } catch {
      setUnlockError("Could not reach the server.");
      return false;
    }
  }, []);

  const applyMissionSnapshot = useCallback((rawMission: LiveMissionPayload) => {
    const sanitized = stripClientSecrets(rawMission);
    if (sanitized.id) {
      activeMissionIdRef.current = sanitized.id;
    }
    if (sanitized.csrf_token) {
      csrfTokenRef.current = sanitized.csrf_token;
    }
    setMission(sanitized);
    setIsDemoSimulation(false);
  }, []);

  const refreshAudit = useCallback(async () => {
    try {
      const res = await fetch("/v1/audit/verify", {
        headers: { Accept: "application/json" },
      });
      if (res.status === 401) setCockpitLocked(true);
      if (!res.ok) throw new Error(`audit verify status ${res.status}`);
      const data: AuditChainVerification = await res.json();
      setAudit(stripClientSecrets(data));
    } catch {
      // Handled by mission fallback if offline
    }
  }, []);

  const refreshMission = useCallback(
    async (explicitMissionId?: string) => {
      try {
        let targetId = explicitMissionId || activeMissionIdRef.current;
        if (!targetId) {
          const listRes = await fetch("/v1/missions", {
            headers: { Accept: "application/json" },
          });
          if (listRes.status === 401) setCockpitLocked(true);
          if (!listRes.ok) throw new Error(`missions list status ${listRes.status}`);
          const listData = await listRes.json();
          targetId = listData?.active_mission_id || listData?.missions?.[0]?.id;
        }
        if (!targetId) throw new Error("No active mission id");

        const res = await fetch(`/v1/missions/${encodeURIComponent(targetId)}`, {
          headers: { Accept: "application/json" },
        });
        if (res.status === 401) setCockpitLocked(true);
        if (!res.ok) throw new Error(`mission fetch status ${res.status}`);
        const data: LiveMissionPayload = await res.json();
        applyMissionSnapshot(data);
      } catch {
        // Locked, offline or failing: show the clearly labelled demo, never silently-live data.
        showDemoSimulation();
      }
    },
    [applyMissionSnapshot, showDemoSimulation]
  );

  // Connect to live SSE stream (/v1/events) + initial GET /v1/missions/:id & GET /v1/audit/verify
  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;

    void (async () => {
      const session = await ensureSession();
      if (cancelled) return;
      setCockpitLocked(session === "locked");
      if (session === "locked") {
        // Visitors get the clearly labelled demo; the operator unlocks the live cockpit.
        setSseConnected(false);
        showDemoSimulation();
        return;
      }

      void refreshMission();
      void refreshAudit();

      if (typeof EventSource === "undefined") return;

      es = new EventSource("/v1/events");

      es.onopen = () => {
        setSseConnected(true);
        setIsDemoSimulation(false);
      };

      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload?.mission) {
            applyMissionSnapshot(payload.mission);
          } else if (payload?.missionId) {
            void refreshMission(payload.missionId);
          }
          if (payload?.audit) {
            setAudit(stripClientSecrets(payload.audit));
          } else {
            void refreshAudit();
          }
        } catch {
          void refreshMission();
          void refreshAudit();
        }
      };

      es.onerror = () => {
        setSseConnected(false);
        // A closed stream usually means the session ended (for example the server restarted). Re-check: a 401 flips the
        // cockpit to the locked state instead of leaving stale data on screen.
        if (es?.readyState === EventSource.CLOSED) void refreshMission();
      };
    })();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [applyMissionSnapshot, ensureSession, refreshAudit, refreshMission, showDemoSimulation, unlockEpoch]);

  // Execute Authorize / Redirect / Kill via signed single-use tap link or CSRF-protected POST
  const executeDecision = useCallback(
    async (
      decision: "authorize" | "redirect" | "kill",
      approval?: PendingApprovalGate | null,
      note?: string
    ): Promise<string | null> => {
      setIsBusy(true);
      try {
        // Prefer the HMAC-signed single-use capability link when deciding a staged approval card
        const signedAction = approval?.signed_links?.actions?.find(
          (a) => a.decision === decision
        );

        let res: Response;
        if (signedAction?.url) {
          const urlObj = new URL(signedAction.url, window.location.origin);
          res = await fetch(urlObj.pathname + urlObj.search, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": csrfTokenRef.current,
            },
            body: JSON.stringify({ note: note || undefined }),
          });
        } else {
          res = await fetch("/api/commander/decision", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": csrfTokenRef.current,
            },
            body: JSON.stringify({
              approval_id: approval?.id,
              decision,
              note: note || undefined,
            }),
          });
        }

        if (res.status === 401) {
          setCockpitLocked(true);
          return "Cockpit locked. Unlock it to act.";
        }
        const data = await res.json();
        if (data?.mission) {
          applyMissionSnapshot(data.mission);
        } else {
          await refreshMission();
        }
        await refreshAudit();
        return data?.message || data?.mission?.last_event?.summary || null;
      } catch {
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [applyMissionSnapshot, refreshAudit, refreshMission]
  );

  // Trigger real engine state transitions (lease directive, stage action, native guard intercept, verify proof, quarantine)
  const triggerLifecycleAction = useCallback(
    async (
      action:
        | "idle"
        | "running"
        | "staged"
        | "native_intercept"
        | "verified"
        | "failed_proof"
        | "quarantined"
    ): Promise<string | null> => {
      setIsBusy(true);
      try {
        let endpoint = "/api/commander/reset";
        let body: Record<string, unknown> = { mode: "idle" };

        if (action === "running") {
          endpoint = "/api/commander/airlock/directive";
          body = { mission_id: activeMissionIdRef.current };
        } else if (action === "staged") {
          endpoint = "/api/commander/airlock/clearance";
          body = {
            mission_id: activeMissionIdRef.current,
            source: "mcp",
            action: {
              kind: "sql",
              payload: "ALTER TABLE releases ADD COLUMN release_notes text;",
              intent: "schema_change",
            },
          };
        } else if (action === "native_intercept") {
          endpoint = "/api/commander/airlock/clearance";
          body = {
            mission_id: activeMissionIdRef.current,
            source: "guard",
            tool: "Bash/Write",
            action: {
              kind: "shell",
              payload: "psql $PROD_DB -c 'ALTER TABLE releases DROP COLUMN legacy_flag;'",
              intent: "schema_change",
            },
          };
        } else if (action === "verified") {
          endpoint = "/api/commander/airlock/proof";
          body = {
            mission_id: activeMissionIdRef.current,
            simulateFailure: false,
          };
        } else if (action === "failed_proof") {
          endpoint = "/api/commander/airlock/proof";
          body = {
            mission_id: activeMissionIdRef.current,
            simulateFailure: true,
          };
        } else if (action === "quarantined") {
          endpoint = "/api/commander/airlock/quarantine";
          body = {
            mission_id: activeMissionIdRef.current,
          };
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfTokenRef.current,
          },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          setCockpitLocked(true);
          return "Cockpit locked. Unlock it to act.";
        }
        const data = await res.json();
        if (data?.mission) {
          applyMissionSnapshot(data.mission);
        } else {
          await refreshMission( data?.cockpit?.mission?.id );
        }
        await refreshAudit();
        return data?.message || data?.mission?.last_event?.summary || null;
      } catch {
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [applyMissionSnapshot, refreshAudit, refreshMission]
  );

  const activeApprovals = (mission?.approvals ?? []).filter((a) => a.status === "pending");
  const pendingGateCount = countPendingGates(activeApprovals);
  const sphereState = deriveSphereState(mission);
  const footerSummary = deriveFooterSummary(mission);

  return {
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
    refreshMission,
    refreshAudit,
    executeDecision,
    triggerLifecycleAction,
  };
}
