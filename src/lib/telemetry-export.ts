import type { AirlockSphereState } from "../components/cortex/CortexTorus3D";
import type {
  AuditChainVerification,
  LiveMissionPayload,
} from "./commander-engine-adapter";
import { stripClientSecrets } from "./commander-engine-adapter";
import type { DesignExploration } from "./exploration-types";
import type { SessionApi } from "./session";
import type {
  AuditResult,
  ScarcityTelemetry,
  TelemetryErrorEntry,
} from "./types";

export type FailureStage =
  | "session_entitlement"
  | "airlock_step"
  | "checklist_verifier"
  | "sentinel_gate"
  | "tenant_budget"
  | "audit_ledger"
  | "blueprint_audit";

export interface TelemetryFailureDiagnosis extends TelemetryErrorEntry {
  id: string;
  task: string;
  failedTask: string;
  whereItFailed: string;
  stage: FailureStage;
  severity: "warning" | "error" | "critical";
  reason: string;
  reasonWhyItFailed: string;
  recommendedCorrection: string;
  recommendedCorrections: string[];
  timestamp: string;
}

export interface OratorTelemetryExport {
  schemaVersion: "1.0.0";
  exportedAt: string;
  telemetry: ScarcityTelemetry & {
    errors: TelemetryErrorEntry[];
  };
  errors: TelemetryErrorEntry[];
  sessionUsage: {
    clientId: string;
    status: string;
    sessionsUsed: number;
    freeSessions: number;
    remainingFreeSessions: number;
    isChartered: boolean;
    canForge: boolean;
    startedAtISO: string;
    sessionDurationSeconds: number;
    inquestAnswersCount: number;
    ingestAttachmentsCount: number;
    explorationsCompleted: number;
    remainingExplorations: number;
  };
  forgeActivity: {
    capacityPct: number;
    activeBuilds: number;
    maxBuilds: number;
    slotsRemaining: number;
    missionId: string | null;
    missionTitle: string | null;
    missionStatus: string | null;
    sphereState: AirlockSphereState;
    isDemoSimulation: boolean;
    sseConnected: boolean;
    currentStep: {
      id: string;
      index: number;
      totalSteps: number;
      title: string;
      status: string;
      riskTier: string;
      attempt: number;
      attemptBudget: number;
      leaseId: string | null;
      operatorPatch: string | null;
    } | null;
    tenant: {
      id: string;
      name: string;
      creditsRemaining: number;
      status: string;
      burnRatePerMin: number;
      burnRatePerHour: number;
      tokensSaved: number;
      errorVelocityPerMin: number;
    } | null;
    auditChain: {
      verified: boolean;
      depth: number;
      headHash: string;
      brokenAt?: number;
      reason?: string;
    };
  };
  diagnostics: {
    overallHealth: "healthy" | "attention_required" | "critical_failure";
    failureCount: number;
    failures: TelemetryFailureDiagnosis[];
    nextRunActionPlan: string[];
  };
}

export interface BuildTelemetryExportInput {
  session?: SessionApi | null;
  telemetry?: ScarcityTelemetry | null;
  explorations?: DesignExploration[];
  remainingExplorations?: number;
  mission?: LiveMissionPayload | null;
  auditChain?: AuditChainVerification | null;
  blueprintAudit?: AuditResult | null;
  sphereState?: AirlockSphereState;
  isDemoSimulation?: boolean;
  sseConnected?: boolean;
  nowMs?: number;
}

function makeDiagnosis(params: {
  id: string;
  whereItFailed: string;
  stage: FailureStage;
  severity: "warning" | "error" | "critical";
  reasonWhyItFailed: string;
  recommendedCorrections: string[];
  timestamp: string;
}): TelemetryFailureDiagnosis {
  const primaryCorrection =
    params.recommendedCorrections[0] ??
    "Inspect the step directive and mechanical verifier logs before re-running.";
  return {
    id: params.id,
    task: params.whereItFailed,
    failedTask: params.whereItFailed,
    whereItFailed: params.whereItFailed,
    stage: params.stage,
    severity: params.severity,
    reason: params.reasonWhyItFailed,
    reasonWhyItFailed: params.reasonWhyItFailed,
    recommendedCorrection: primaryCorrection,
    recommendedCorrections: params.recommendedCorrections,
    timestamp: params.timestamp,
  };
}

/**
 * Recommendation engine for checklist verifier types.
 */
function recommendForVerifierType(type: string, requirement: string): string[] {
  const normalized = type.toLowerCase();
  if (normalized.includes("witness_file")) {
    return [
      `Ensure the target file referenced in "${requirement}" exists under COMMANDER_WITNESS_ROOT and meets the minimum byte size and substring requirements.`,
      "Verify the worker wrote the file to disk before calling submit_proof rather than only printing file contents to stdout.",
    ];
  }
  if (normalized.includes("witness")) {
    return [
      `Run the witnessed command locally first to confirm it exits 0 and that its executable is listed in COMMANDER_WITNESS_ALLOW.`,
      "Ensure no background child processes hold stdout/stderr pipes open past the witness timeout.",
    ];
  }
  if (normalized.includes("nonce")) {
    return [
      "Read the active step nonce (nce_…) from the latest pull_directive response and echo it verbatim in the worker stdout payload.",
      "Do not reuse stdout captured from an earlier attempt; each rejected proof rotates the step nonce.",
    ];
  }
  if (normalized.includes("diff_clean")) {
    return [
      "Keep the git diff within the step's allowed path glob and max_files ceiling, and strip any credential literals before submitting proof.",
      "Split broad multi-directory refactors into smaller step-gated milestones.",
    ];
  }
  if (normalized.includes("stdout")) {
    return [
      `Confirm the test or build runner output includes the required pattern (${requirement}) on stdout.`,
      "Capture both stdout and test summary lines when constructing the submit_proof evidence payload.",
    ];
  }
  return [
    "Fix the underlying command failure so the process exits with code 0 before invoking submit_proof.",
    "Inspect stderr from the failed run and use an Operator Redirect patch if the step directive needs a safer approach.",
  ];
}

/**
 * Analyzes session state, live mission steps, checklist items, pending approvals,
 * tenant credit balance, and audit chain integrity to identify where failures occurred,
 * why they occurred, and concrete corrective actions for the next run.
 */
export function diagnoseSessionFailures(
  input: BuildTelemetryExportInput
): TelemetryFailureDiagnosis[] {
  const failures: TelemetryFailureDiagnosis[] = [];
  const mission = input.mission;
  const currentStep = mission?.current_step ?? null;
  const auditChain = input.auditChain;
  const nowIso = new Date(input.nowMs ?? Date.now()).toISOString();

  // Include any pre-recorded task errors attached directly to input.telemetry.errors
  for (const existing of input.telemetry?.errors ?? []) {
    const corrections =
      Array.isArray(existing.recommendedCorrections) &&
      existing.recommendedCorrections.length > 0
        ? existing.recommendedCorrections
        : [existing.recommendedCorrection || "Review task logs and retry with adjusted parameters."];
    const taskLabel =
      existing.failedTask || existing.task || existing.whereItFailed || "Session Task";
    failures.push({
      id: existing.id || `diag_custom_${failures.length + 1}`,
      task: taskLabel,
      failedTask: taskLabel,
      whereItFailed: existing.whereItFailed || taskLabel,
      stage: (existing.stage as FailureStage) || "airlock_step",
      severity: existing.severity || "error",
      reason: existing.reason,
      reasonWhyItFailed: existing.reason,
      recommendedCorrection: existing.recommendedCorrection || corrections[0]!,
      recommendedCorrections: corrections,
      timestamp: existing.timestamp || nowIso,
    });
  }

  // 1. Session allowance / payment gate check
  if (
    input.session &&
    (input.session.session.status === "payment_required" || !input.session.canForge)
  ) {
    failures.push(
      makeDiagnosis({
        id: "diag_session_allowance_exhausted",
        whereItFailed: "Orator Session Entitlement & Build Pass Gate",
        stage: "session_entitlement",
        severity: "warning",
        reasonWhyItFailed: `Free session allowance exhausted (${input.session.session.sessionsUsed} of ${input.session.session.freeSessions} used) and no active Build Pass is attached to client ${input.session.session.clientId}.`,
        recommendedCorrections: [
          "Activate a Single, Builder, or Studio Build Pass in the Passes modal to unlock additional full blueprint builds.",
          "Alternatively, reset or export existing Design Explorations before starting a new inquest.",
        ],
        timestamp: nowIso,
      })
    );
  }

  // 2. Mission-level killed or quarantined status
  if (mission?.status === "killed") {
    failures.push(
      makeDiagnosis({
        id: `diag_mission_killed_${mission.id}`,
        whereItFailed: `Mission "${mission.title}" (${mission.id}) — Global Airlock Lifecycle`,
        stage: "airlock_step",
        severity: "critical",
        reasonWhyItFailed:
          mission.last_event?.summary ||
          "Mission was permanently terminated by an operator Kill intervention.",
        recommendedCorrections: [
          "Open a new mission via POST /v1/operator/missions or click Idle (Cyan) in the HUD Cockpit to re-seed the mission.",
          "Review the last staged clearance or quarantined step in the audit ledger and tighten the step directive before re-running.",
        ],
        timestamp: mission.last_event?.ts || nowIso,
      })
    );
  } else if (
    mission?.status === "quarantined" ||
    input.sphereState === "quarantined" ||
    currentStep?.status === "quarantined"
  ) {
    const stepLabel = currentStep
      ? `Step ${currentStep.index}/${currentStep.total_steps} ("${currentStep.title}")`
      : `Mission "${mission?.title ?? "Active Mission"}"`;
    failures.push(
      makeDiagnosis({
        id: `diag_step_quarantined_${currentStep?.id ?? "mission"}`,
        whereItFailed: `${stepLabel} — Airlock Attempt Budget & Quarantine Gate`,
        stage: "airlock_step",
        severity: "critical",
        reasonWhyItFailed:
          mission?.last_event?.summary ||
          `Worker exhausted the step attempt budget (${currentStep?.attempt ?? 3}/${
            currentStep?.attempt_budget ?? 3
          } attempts) without passing all mechanical verifiers.`,
        recommendedCorrections: [
          "Use the Redirect button in the HUD Cockpit to inject a Deductive Anchor instruction (e.g., 'Wrap migration inside an online shadow table swap') and grant a fresh attempt budget.",
          "If this step is part of a dependency graph (depends_on) and non-essential, use POST /v1/operator/missions/:id/intervene with action: 'skip' and step_id to skip the branch while keeping independent work running.",
          "Verify that the worker echoes the latest rotated nonce (nce_…) and satisfies all [WITNESSED] disk checks before re-submitting proof.",
        ],
        timestamp: mission?.last_event?.ts || nowIso,
      })
    );
  }

  // 3. Individual step ladder quarantined steps (e.g., branch-local quarantine in graph missions)
  for (const ladderStep of mission?.steps ?? []) {
    if (
      ladderStep.status === "quarantined" &&
      ladderStep.id !== currentStep?.id
    ) {
      failures.push(
        makeDiagnosis({
          id: `diag_branch_quarantined_${ladderStep.id}`,
          whereItFailed: `Mission Graph Step ${ladderStep.index} ("${ladderStep.title}", id: ${ladderStep.id})`,
          stage: "airlock_step",
          severity: "error",
          reasonWhyItFailed: `Branch step exhausted its attempt budget (${ladderStep.attempt}/${ladderStep.attempt_budget}) and is holding dependent downstream steps in blocked_by state.`,
          recommendedCorrections: [
            `Authorize or Redirect the pending quarantine approval for step "${ladderStep.title}" to queue it for repair with a fresh attempt budget.`,
            "Keep independent ready branches running while repairing the quarantined prerequisite.",
          ],
          timestamp: nowIso,
        })
      );
    }
  }

  // 4. Failed checklist verifiers on the current step
  for (const item of currentStep?.checklist ?? []) {
    if (item.status === "failed") {
      failures.push(
        makeDiagnosis({
          id: `diag_checklist_item_${currentStep?.id ?? "step"}_${item.index}`,
          whereItFailed: `Step ${currentStep?.index ?? 1} ("${
            currentStep?.title ?? "Current Step"
          }") — Verifier #${item.index} ${item.badgeText} ${item.requirement}`,
          stage: "checklist_verifier",
          severity: "error",
          reasonWhyItFailed:
            item.reason ||
            `Mechanical verifier "${item.requirement}" (${item.provenance.toUpperCase()}) failed validation: ${item.detail}.`,
          recommendedCorrections: recommendForVerifierType(
            item.type || item.kind,
            item.requirement
          ),
          timestamp: nowIso,
        })
      );
    }
  }

  // 5. Pending or rejected Sentinel / PreToolUse guard approvals
  for (const approval of mission?.approvals ?? []) {
    if (approval.status === "pending" || approval.status === "killed") {
      const sourceLabel =
        approval.source === "guard"
          ? `PreToolUse Native Guard (${approval.tool ?? "Bash/Write"})`
          : "Perimeter Sentinel";
      failures.push(
        makeDiagnosis({
          id: `diag_approval_gate_${approval.id}`,
          whereItFailed: `${sourceLabel} — ${approval.kind.toUpperCase()} Gate (#${approval.id.slice(
            0,
            8
          )}) on "${approval.step}"`,
          stage: "sentinel_gate",
          severity: approval.kind === "quarantine" ? "critical" : "warning",
          reasonWhyItFailed: `${approval.incident}: ${approval.reason}`,
          recommendedCorrections:
            approval.kind === "clearance"
              ? [
                  "Replace destructive commands (e.g., DROP COLUMN, TRUNCATE, rm -rf) with additive, reversible operations that pass Sentinel rules automatically.",
                  "If the elevated/critical operation is intentional, click Authorize in the HUD Cockpit (or use the signed single-use /a/:id/decide link) to mint a one-time clearance pass for the active lease.",
                ]
              : [
                  "Supply an explicit Operator Redirect note in the HUD Cockpit so the subordinate worker abandons the failing approach on its next attempt.",
                ],
          timestamp: String(approval.created_at || nowIso),
        })
      );
    }
  }

  // 6. Tenant credit depletion or high error velocity
  if (mission?.tenant && (mission.tenant.status === "depleted" || mission.tenant.credits <= 0)) {
    failures.push(
      makeDiagnosis({
        id: `diag_tenant_credits_depleted_${mission.tenant.id}`,
        whereItFailed: `Tenant "${mission.tenant.name}" (${mission.tenant.id}) — SaaS Credit Meter`,
        stage: "tenant_budget",
        severity: "critical",
        reasonWhyItFailed: `Tenant credit balance is depleted (${mission.tenant.credits} CR remaining). All directive leases, clearances, and proof audits are suspended.`,
        recommendedCorrections: [
          "Top up tenant credits via POST /v1/admin/tenants/:id/credits with your COMMANDER_ADMIN_TOKEN.",
          "Enable the Just-In-Time Markdown Pruner and loop-detection Sentinel rules to reduce token and credit burn on repetitive worker retries.",
        ],
        timestamp: nowIso,
      })
    );
  }

  // 7. Cryptographic SHA-256 Audit Chain Verification
  if (auditChain && auditChain.ok === false) {
    failures.push(
      makeDiagnosis({
        id: "diag_audit_chain_broken",
        whereItFailed: `Cryptographic Audit Ledger (/v1/audit/verify) at sequence #${
          auditChain.brokenAt ?? "unknown"
        }`,
        stage: "audit_ledger",
        severity: "critical",
        reasonWhyItFailed:
          auditChain.reason ||
          "SHA-256 hash chain verification failed: a record's prev pointer or digest does not match the preceding entry.",
        recommendedCorrections: [
          "Inspect the persisted state file under COMMANDER_DATA_DIR for manual edits or truncated writes.",
          "Re-initialize a clean tenant ledger and avoid mutating store records outside store.audit().",
        ],
        timestamp: nowIso,
      })
    );
  }

  // 8. 22-Point Blueprint Invariant Audit failures (if a ForgePlan was audited)
  if (input.blueprintAudit) {
    for (const finding of input.blueprintAudit.findings) {
      if (finding.status === "fail") {
        failures.push(
          makeDiagnosis({
            id: `diag_blueprint_probe_${finding.id}`,
            whereItFailed: `22-Point Verification Gate — Probe #${finding.id}: ${finding.title}`,
            stage: "blueprint_audit",
            severity: "error",
            reasonWhyItFailed: finding.detail,
            recommendedCorrections: [
              `Resolve invariant probe "${finding.title}" in the generated scaffold before sealing the deliverable ZIP.`,
            ],
            timestamp: nowIso,
          })
        );
      }
    }
  }

  return failures;
}

/**
 * Builds the complete, secret-scrubbed session telemetry and failure diagnostics export payload.
 */
export function buildSessionTelemetryExport(
  input: BuildTelemetryExportInput
): OratorTelemetryExport {
  const nowMs = input.nowMs ?? Date.now();
  const exportedAt = new Date(nowMs).toISOString();

  const sessionState = input.session?.session;
  const startedAtMs = sessionState?.startedAt ?? nowMs;
  const durationSeconds = Math.max(0, Math.round((nowMs - startedAtMs) / 1000));
  const explorationsCount = input.explorations?.length ?? 0;
  const remainingExplorations = input.remainingExplorations ?? Math.max(0, 3 - explorationsCount);

  const mission = input.mission ?? null;
  const currentStep = mission?.current_step ?? null;
  const sphereState: AirlockSphereState =
    input.sphereState ?? mission?.sphere_state ?? "idle";

  const failures = diagnoseSessionFailures(input);
  const errors: TelemetryErrorEntry[] = failures.map((f) => ({
    id: f.id,
    task: f.task,
    failedTask: f.failedTask,
    whereItFailed: f.whereItFailed,
    reason: f.reason,
    recommendedCorrection: f.recommendedCorrection,
    recommendedCorrections: f.recommendedCorrections,
    stage: f.stage,
    severity: f.severity,
    timestamp: f.timestamp,
  }));

  const hasCritical = failures.some((f) => f.severity === "critical");
  const overallHealth: "healthy" | "attention_required" | "critical_failure" =
    failures.length === 0
      ? "healthy"
      : hasCritical
      ? "critical_failure"
      : "attention_required";

  // Deduplicate top recommended corrections into a prioritized Next-Run Action Plan
  const seenRecommendations = new Set<string>();
  const nextRunActionPlan: string[] = [];
  for (const failure of failures) {
    for (const rec of failure.recommendedCorrections) {
      if (!seenRecommendations.has(rec)) {
        seenRecommendations.add(rec);
        nextRunActionPlan.push(rec);
      }
    }
  }

  if (nextRunActionPlan.length === 0) {
    nextRunActionPlan.push(
      "All active airlock steps, mechanical verifiers, and SHA-256 audit records passed validation.",
      "For multi-agent builds, enable Supervision Protocol v1 (POST /v1/operator/missions/:id/protocol) and define explicit step dependencies (id + depends_on) to isolate branch failures.",
      "Keep COMMANDER_WITNESS_MODE=local enabled on trusted workspaces so file and test checks remain independently [WITNESSED]."
    );
  }

  const capacityPct = input.telemetry?.capacityPct ?? 90;
  const activeBuilds = input.telemetry?.activeBuilds ?? 1;
  const maxBuilds = input.telemetry?.maxBuilds ?? 10;
  const slotsRemaining = input.telemetry?.slotsRemaining ?? 9;

  const rawExport: OratorTelemetryExport = {
    schemaVersion: "1.0.0",
    exportedAt,
    telemetry: {
      capacityPct,
      activeBuilds,
      maxBuilds,
      slotsRemaining,
      errors,
    },
    errors,
    sessionUsage: {
      clientId: sessionState?.clientId ?? "anonymous-operator",
      status: sessionState?.status ?? "landing",
      sessionsUsed: sessionState?.sessionsUsed ?? 0,
      freeSessions: sessionState?.freeSessions ?? 3,
      remainingFreeSessions: input.session?.remainingFree ?? 3,
      isChartered: input.session?.isChartered ?? false,
      canForge: input.session?.canForge ?? true,
      startedAtISO: new Date(startedAtMs).toISOString(),
      sessionDurationSeconds: durationSeconds,
      inquestAnswersCount: Object.keys(sessionState?.answers ?? {}).length,
      ingestAttachmentsCount: sessionState?.ingest?.length ?? 0,
      explorationsCompleted: explorationsCount,
      remainingExplorations,
    },
    forgeActivity: {
      capacityPct,
      activeBuilds,
      maxBuilds,
      slotsRemaining,
      missionId: mission?.id ?? null,
      missionTitle: mission?.title ?? null,
      missionStatus: mission?.status ?? null,
      sphereState,
      isDemoSimulation: input.isDemoSimulation ?? false,
      sseConnected: input.sseConnected ?? false,
      currentStep: currentStep
        ? {
            id: currentStep.id,
            index: currentStep.index,
            totalSteps: currentStep.total_steps,
            title: currentStep.title,
            status: currentStep.status,
            riskTier: currentStep.risk_tier,
            attempt: currentStep.attempt,
            attemptBudget: currentStep.attempt_budget,
            leaseId: currentStep.lease_id,
            operatorPatch: currentStep.operator_patch,
          }
        : null,
      tenant: mission?.tenant
        ? {
            id: mission.tenant.id,
            name: mission.tenant.name,
            creditsRemaining: mission.tenant.creditBalance ?? mission.tenant.credits,
            status: mission.tenant.status,
            burnRatePerMin: mission.metrics?.burnRatePerMin ?? 0,
            burnRatePerHour: mission.metrics?.burnRatePerHour ?? 0,
            tokensSaved: mission.metrics?.tokensSaved ?? 0,
            errorVelocityPerMin: mission.metrics?.errorVelocityPerMin ?? 0,
          }
        : null,
      auditChain: {
        verified: input.auditChain?.ok ?? mission?.tenant?.auditVerified ?? true,
        depth: input.auditChain?.count ?? mission?.tenant?.auditCount ?? 0,
        headHash:
          input.auditChain?.headHash ??
          "0000000000000000000000000000000000000000000000000000000000000000",
        ...(input.auditChain?.brokenAt !== undefined
          ? { brokenAt: input.auditChain.brokenAt }
          : {}),
        ...(input.auditChain?.reason !== undefined
          ? { reason: input.auditChain.reason }
          : {}),
      },
    },
    diagnostics: {
      overallHealth,
      failureCount: failures.length,
      failures,
      nextRunActionPlan,
    },
  };

  return stripClientSecrets(rawExport);
}

/**
 * Triggers a browser download of the telemetry export JSON file.
 */
export function downloadSessionTelemetryJson(
  payload: OratorTelemetryExport,
  customFilename?: string
): string {
  const safeClient = payload.sessionUsage.clientId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "session";
  const compactTime = payload.exportedAt.replace(/[:.]/g, "-");
  const filename = customFilename || `orator-telemetry-${safeClient}-${compactTime}.json`;
  const serialized = JSON.stringify(payload, null, 2);

  if (typeof document !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined") {
    const blob = new Blob([serialized], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return filename;
}
