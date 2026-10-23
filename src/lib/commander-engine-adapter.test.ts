import { describe, it, expect } from "vitest";
import {
  countPendingGates,
  deriveFooterSummary,
  deriveProvenanceBadge,
  deriveSphereState,
  isMutatingVoiceCommand,
  stripClientSecrets,
  type LiveMissionPayload,
} from "./commander-engine-adapter";

describe("Commander Engine Adapter — Live State Machine & Security Invariants", () => {
  it("maps IDLE (Cyan) when no active lease is issued or milestone is locked", () => {
    const state = deriveSphereState({
      status: "active",
      approvals: [],
      current_step: {
        id: "stp_1",
        index: 1,
        total_steps: 4,
        title: "Step 1",
        directive: "Run suite",
        status: "locked",
        risk_tier: "routine",
        attempt: 1,
        attempt_budget: 3,
        nonce: null,
        lease_id: null,
        lease_expires_at: null,
        lease_revoked: false,
        operator_patch: null,
        checklist: [],
      },
    });
    expect(state).toBe("idle");
  });

  it("maps RUNNING (Blue pulse) when an active valid lease is issued to worker", () => {
    const now = Date.now();
    const state = deriveSphereState(
      {
        status: "active",
        approvals: [],
        last_event: {
          seq: 2,
          ts: new Date(now).toISOString(),
          type: "directive.issued",
          summary: "Directive issued. Lease active.",
          sphere_state: "running",
        },
        current_step: {
          id: "stp_1",
          index: 1,
          total_steps: 4,
          title: "Step 1",
          directive: "Run suite",
          status: "released",
          risk_tier: "routine",
          attempt: 1,
          attempt_budget: 3,
          nonce: "n1",
          lease_id: "lse_active",
          lease_expires_at: new Date(now + 120_000).toISOString(),
          lease_revoked: false,
          operator_patch: null,
          checklist: [],
        },
      },
      now
    );
    expect(state).toBe("running");
  });

  it("maps STAGED (Amber) when Sentinel intercepts an action and a pending gate exists", () => {
    const state = deriveSphereState({
      status: "paused",
      paused_for: "apr_1",
      approvals: [
        {
          id: "apr_1",
          kind: "clearance",
          status: "pending",
          incident: "SQL schema_change",
          reason: "Destructive DDL",
          created_at: new Date().toISOString(),
          mission_id: "msn_1",
          mission: "Cutover",
          step_id: "stp_1",
          step: "Step 1",
        },
      ],
    });
    expect(state).toBe("staged");
  });

  it("maps VERIFIED (Green flash) when step is mechanically verified by exit code 0", () => {
    const state = deriveSphereState({
      status: "active",
      approvals: [],
      last_event: {
        seq: 5,
        ts: new Date().toISOString(),
        type: "proof.accepted",
        summary: "Proof accepted (exit_code === 0). Step sealed.",
        sphere_state: "verified",
      },
    });
    expect(state).toBe("verified");
  });

  it("maps QUARANTINED (Glitch Red) when attempts are exhausted, budget is breached, or violation is detected", () => {
    expect(
      deriveSphereState({
        status: "quarantined",
        approvals: [],
      })
    ).toBe("quarantined");

    expect(
      deriveSphereState({
        status: "active",
        tenant: {
          id: "t1",
          name: "Acme",
          credits: 0,
          creditBalance: 0,
          status: "depleted",
          auditVerified: true,
          auditCount: 4,
        },
      })
    ).toBe("quarantined");
  });

  it("clears stale error text ('Attempts exhausted') immediately when mission.last_event.summary transitions to running or staged", () => {
    const quarantinedMission: Partial<LiveMissionPayload> = {
      status: "quarantined",
      last_event: {
        seq: 4,
        ts: new Date().toISOString(),
        type: "step.quarantined",
        summary: "Attempts exhausted. Step quarantined. Operator decision required.",
        sphere_state: "quarantined",
      },
    };
    expect(deriveFooterSummary(quarantinedMission)).toContain("Attempts exhausted");

    const runningMission: Partial<LiveMissionPayload> = {
      status: "active",
      last_event: {
        seq: 5,
        ts: new Date().toISOString(),
        type: "directive.issued",
        summary: "Directive issued. Attempt 1 of 3. Execute exactly. Return mechanical proof.",
        sphere_state: "running",
      },
    };
    expect(deriveFooterSummary(runningMission)).toBe(
      "Directive issued. Attempt 1 of 3. Execute exactly. Return mechanical proof."
    );
    expect(deriveFooterSummary(runningMission)).not.toContain("Attempts exhausted");
  });

  it("computes pending gate count dynamically so it never returns 0 when a pending approval is active", () => {
    expect(countPendingGates([])).toBe(0);
    expect(
      countPendingGates([
        { status: "pending" },
        { status: "authorized" },
        { status: "pending" },
      ])
    ).toBe(2);
  });

  it("distinguishes [WITNESSED], [REPORTED], and [NATIVE INTERCEPT: Bash/Write] provenance badges", () => {
    const witnessed = deriveProvenanceBadge({ type: "witness_command" });
    expect(witnessed.badgeText).toBe("[WITNESSED]");
    expect(witnessed.tone).toBe("green");

    const witnessedFile = deriveProvenanceBadge({ type: "witness_file" });
    expect(witnessedFile.badgeText).toBe("[WITNESSED]");
    expect(witnessedFile.tone).toBe("green");

    const reported = deriveProvenanceBadge({ type: "exit_code" });
    expect(reported.badgeText).toBe("[REPORTED]");
    expect(reported.tone).toBe("amber");

    const nativeIntercept = deriveProvenanceBadge({
      source: "guard",
      tool: "Bash/Write",
    });
    expect(nativeIntercept.badgeText).toBe("[NATIVE INTERCEPT: Bash/Write]");
    expect(nativeIntercept.tone).toBe("violet");
  });

  it("strips hardcoded or accidental operator/worker secrets from client payloads", () => {
    const raw = {
      tenant: {
        id: "ten_1",
        name: "Sovereign",
        operatorKey: "cmd_op_SECRET",
        workerKey: "cmd_live_SECRET",
      },
      adminToken: "top_secret",
    };
    const cleaned = stripClientSecrets(raw) as Record<string, any>;
    expect(cleaned.tenant.id).toBe("ten_1");
    expect(cleaned.tenant.operatorKey).toBeUndefined();
    expect(cleaned.tenant.workerKey).toBeUndefined();
    expect(cleaned.adminToken).toBeUndefined();
  });

  it("restricts voice/chat from executing Authorize/Kill/Redirect while allowing read-only ledger queries", () => {
    expect(isMutatingVoiceCommand("Authorize this step now")).toBe(true);
    expect(isMutatingVoiceCommand("Kill mission immediately")).toBe(true);
    expect(isMutatingVoiceCommand("Redirect worker to skip migration")).toBe(true);
    expect(isMutatingVoiceCommand("Status report on current step")).toBe(false);
    expect(isMutatingVoiceCommand("Why is step 1 staged?")).toBe(false);
    expect(isMutatingVoiceCommand("Show audit chain depth")).toBe(false);
  });
});
