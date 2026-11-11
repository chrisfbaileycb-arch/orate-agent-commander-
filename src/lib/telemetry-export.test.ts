import { describe, expect, it } from "vitest";
import {
  buildSessionTelemetryExport,
  diagnoseSessionFailures,
} from "./telemetry-export";
import type { LiveMissionPayload } from "./commander-engine-adapter";

const makeMission = (overrides: Partial<LiveMissionPayload> = {}): LiveMissionPayload => ({
  id: "msn_telemetry_1",
  title: "Release 4.2 · Sovereign Production Cutover",
  status: "active",
  current_index: 0,
  step_count: 2,
  created_at: "2026-11-10T10:00:00.000Z",
  updated_at: "2026-11-10T10:05:00.000Z",
  ledger: [],
  last_event: {
    seq: 4,
    ts: "2026-11-10T10:05:00.000Z",
    type: "directive.issued",
    summary: "Directive issued. Lease active.",
    sphere_state: "running",
  },
  sphere_state: "running",
  current_step: {
    id: "stp_1",
    index: 1,
    total_steps: 2,
    title: "Verify workspace manifest & pass unit suite",
    directive: "Run suite and echo nonce.",
    status: "released",
    risk_tier: "routine",
    attempt: 1,
    attempt_budget: 3,
    nonce: "nce_123",
    lease_id: "lse_123",
    lease_expires_at: "2026-11-10T10:15:00.000Z",
    lease_revoked: false,
    operator_patch: null,
    checklist: [
      {
        index: 1,
        type: "exit_code",
        kind: "exit_code",
        hidden: false,
        requirement: "exit_code === 0",
        label: "REPORTED · exit_code === 0",
        detail: "Process must exit 0",
        status: "passed",
        reason: null,
        provenance: "reported",
        badgeText: "[REPORTED]",
      },
    ],
  },
  steps: [
    {
      id: "stp_1",
      idx: 1,
      index: 1,
      title: "Verify workspace manifest & pass unit suite",
      status: "released",
      risk_tier: "routine",
      attempt: 1,
      attempt_budget: 3,
    },
  ],
  approvals: [],
  tenant: {
    id: "ten_1",
    name: "Sovereign Ops",
    credits: 990,
    creditBalance: 990,
    status: "online",
    auditVerified: true,
    auditCount: 8,
  },
  metrics: {
    activeAgents: 1,
    burnRatePerMin: 2,
    burnRatePerHour: 120,
    tokensSaved: 4200,
    errorVelocityPerMin: 0,
    pendingApprovals: 0,
    stagedApprovals: 0,
    totalEvents: 8,
  },
  ...overrides,
});

describe("Session Telemetry & Failure Diagnostics Export", () => {
  it("exports session counts, forge activity, and healthy status when no failures exist", () => {
    const exported = buildSessionTelemetryExport({
      mission: makeMission(),
      telemetry: { capacityPct: 90, activeBuilds: 9, maxBuilds: 10, slotsRemaining: 1 },
      explorations: [],
      remainingExplorations: 3,
      sphereState: "running",
      sseConnected: true,
      nowMs: Date.parse("2026-11-10T10:10:00.000Z"),
    });

    expect(exported.schemaVersion).toBe("1.0.0");
    expect(exported.forgeActivity.missionId).toBe("msn_telemetry_1");
    expect(exported.forgeActivity.tenant?.tokensSaved).toBe(4200);
    expect(exported.diagnostics.overallHealth).toBe("healthy");
    expect(exported.diagnostics.failureCount).toBe(0);
    expect(exported.diagnostics.nextRunActionPlan.length).toBeGreaterThan(0);
  });

  it("identifies where a step failed, why it failed, and recommends next-run corrections for failed verifiers and staged gates", () => {
    const failingMission = makeMission({
      status: "quarantined",
      sphere_state: "quarantined",
      last_event: {
        seq: 9,
        ts: "2026-11-10T10:09:00.000Z",
        type: "step.quarantined",
        summary: "Attempts exhausted (3/3). Step quarantined.",
        sphere_state: "quarantined",
      },
      current_step: {
        id: "stp_1",
        index: 1,
        total_steps: 2,
        title: "Verify workspace manifest & pass unit suite",
        directive: "Run suite and echo nonce.",
        status: "quarantined",
        risk_tier: "routine",
        attempt: 3,
        attempt_budget: 3,
        nonce: "nce_999",
        lease_id: null,
        lease_expires_at: null,
        lease_revoked: true,
        operator_patch: null,
        checklist: [
          {
            index: 1,
            type: "witness_file",
            kind: "witness_file",
            hidden: false,
            requirement: 'LocalWitness inspect "package.json" >= 100B',
            label: "WITNESS_FILE · package.json",
            detail: "File missing or smaller than 100 bytes",
            status: "failed",
            reason: "File package.json did not match minimum size requirement",
            provenance: "witnessed",
            badgeText: "[WITNESSED]",
          },
          {
            index: 2,
            type: "nonce_echo",
            kind: "nonce_echo",
            hidden: false,
            requirement: "Echo active step nonce in stdout",
            label: "REPORTED · nonce_echo",
            detail: "Stdout did not contain rotated nonce nce_999",
            status: "failed",
            reason: "Replay detected: worker stdout lacked current nonce nce_999",
            provenance: "reported",
            badgeText: "[REPORTED]",
          },
        ],
      },
      approvals: [
        {
          id: "apr_sql_drop",
          kind: "clearance",
          status: "pending",
          incident: "SQL schema_change (DROP COLUMN)",
          reason: "Destructive DDL statement intercepted by PreToolUse hook",
          created_at: "2026-11-10T10:08:00.000Z",
          mission_id: "msn_telemetry_1",
          mission: "Release 4.2",
          step_id: "stp_1",
          step: "Verify workspace manifest & pass unit suite",
          source: "guard",
          tool: "Bash/Write",
          provenance: "native_intercept",
        },
      ],
    });

    const exported = buildSessionTelemetryExport({
      mission: failingMission,
      sphereState: "quarantined",
    });

    expect(exported.diagnostics.overallHealth).toBe("critical_failure");
    expect(exported.diagnostics.failureCount).toBe(4);
    expect(exported.errors).toHaveLength(4);
    expect(exported.telemetry.errors).toHaveLength(4);

    // Every entry in errors tracks the failed task, specific failure reason, and recommendedCorrection
    for (const err of exported.errors) {
      expect(typeof err.task).toBe("string");
      expect(err.task.length).toBeGreaterThan(0);
      expect(err.failedTask).toBe(err.task);
      expect(typeof err.reason).toBe("string");
      expect(err.reason.length).toBeGreaterThan(0);
      expect(typeof err.recommendedCorrection).toBe("string");
      expect(err.recommendedCorrection.length).toBeGreaterThan(0);
    }

    // 1. Quarantine diagnosis
    const quarantineDiag = exported.diagnostics.failures.find(
      (f) => f.stage === "airlock_step"
    );
    expect(quarantineDiag?.whereItFailed).toContain("Step 1/2");
    expect(quarantineDiag?.failedTask).toContain("Step 1/2");
    expect(quarantineDiag?.reason).toContain("Attempts exhausted");
    expect(quarantineDiag?.reasonWhyItFailed).toContain("Attempts exhausted");
    expect(quarantineDiag?.recommendedCorrection).toContain("Redirect");
    expect(quarantineDiag?.recommendedCorrections.join(" ")).toContain("Redirect");

    // 2. Witness file verifier failure diagnosis
    const witnessDiag = exported.diagnostics.failures.find((f) =>
      f.whereItFailed.includes("[WITNESSED]")
    );
    expect(witnessDiag?.reason).toContain("minimum size requirement");
    expect(witnessDiag?.recommendedCorrections.join(" ")).toContain("COMMANDER_WITNESS_ROOT");

    // 3. Nonce verifier failure diagnosis
    const nonceDiag = exported.diagnostics.failures.find((f) =>
      f.whereItFailed.includes("Echo active step nonce")
    );
    expect(nonceDiag?.reason).toContain("nce_999");
    expect(nonceDiag?.recommendedCorrections.join(" ")).toContain("pull_directive");

    // 4. Staged PreToolUse guard gate diagnosis
    const gateDiag = exported.diagnostics.failures.find((f) => f.stage === "sentinel_gate");
    expect(gateDiag?.whereItFailed).toContain("PreToolUse Native Guard");
    expect(gateDiag?.reason).toContain("Destructive DDL");
    expect(gateDiag?.recommendedCorrections.join(" ")).toContain("reversible operations");
  });

  it("incorporates pre-recorded telemetry.errors into the exported errors array and diagnostics", () => {
    const exported = buildSessionTelemetryExport({
      mission: makeMission(),
      telemetry: {
        capacityPct: 88,
        activeBuilds: 4,
        maxBuilds: 8,
        slotsRemaining: 4,
        errors: [
          {
            id: "custom_err_1",
            task: "Step 2/2: Compile bundle & verify artifact checksum",
            failedTask: "Step 2/2: Compile bundle & verify artifact checksum",
            reason: "TypeScript compilation exited with code 2 on missing import",
            recommendedCorrection:
              "Run npm run lint locally and ensure all imported modules exist before submitting evidence.",
          },
        ],
      },
    });

    expect(exported.errors).toHaveLength(1);
    expect(exported.telemetry.errors).toHaveLength(1);
    expect(exported.errors[0].task).toBe("Step 2/2: Compile bundle & verify artifact checksum");
    expect(exported.errors[0].failedTask).toBe(
      "Step 2/2: Compile bundle & verify artifact checksum"
    );
    expect(exported.errors[0].reason).toBe(
      "TypeScript compilation exited with code 2 on missing import"
    );
    expect(exported.errors[0].recommendedCorrection).toContain("Run npm run lint locally");
  });

  it("diagnoses depleted tenant credits and broken SHA-256 audit chains", () => {
    const mission = makeMission({
      tenant: {
        id: "ten_depleted",
        name: "Depleted Corp",
        credits: 0,
        creditBalance: 0,
        status: "depleted",
        auditVerified: false,
        auditCount: 5,
      },
    });

    const failures = diagnoseSessionFailures({
      mission,
      auditChain: {
        ok: false,
        count: 5,
        brokenAt: 3,
        reason: "Hash mismatch at seq 3",
        headHash: "abc",
        genesisHash: "0".repeat(64),
        records: [],
      },
    });

    expect(failures.some((f) => f.stage === "tenant_budget")).toBe(true);
    expect(failures.some((f) => f.stage === "audit_ledger")).toBe(true);
  });
});
