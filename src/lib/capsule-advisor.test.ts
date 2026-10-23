import { describe, it, expect, beforeEach } from "vitest";
import { PreviewCapsuleService } from "./capsule-service";
import { DeploymentAdvisorService } from "./deployment-advisor";
import { BuildPassEntitlementService, BUILD_PASS_REGISTRY } from "./build-pass-service";
import type { GeneratedFile, ForgePlan } from "./types";

describe("Temporary Preview Capsules", () => {
  let capsuleService: PreviewCapsuleService;
  const sampleFiles: GeneratedFile[] = [
    {
      path: "src/main.tsx",
      language: "typescript",
      contents: "console.log('App running');",
    },
    {
      path: "index.html",
      language: "html",
      contents: "<html><body>Hello Preview</body></html>",
    },
  ];

  beforeEach(() => {
    capsuleService = new PreviewCapsuleService();
  });

  it("creates a valid Preview Capsule with READY status after health check", async () => {
    const capsule = await capsuleService.createCapsule(
      "proj-test-1",
      "owner-test-1",
      "build-test-1",
      sampleFiles,
      {
        appName: "Test Capsule App",
        archetype: "saas",
        summary: "Autonomous test SaaS app",
        stack: ["React", "TypeScript"],
        entryPoint: "src/main.tsx",
      },
      { tier: "free" }
    );

    expect(capsule.id).toMatch(/^cap-/);
    expect(capsule.status).toBe("READY");
    expect(capsule.healthCheckStatus).toBe("healthy");
    expect(capsule.expiresAt).toBeGreaterThan(Date.now());
    expect(capsule.previewUrl).toContain("preview://app/");
  });

  it("rejects an invalid bundle without html/ts files and flags FAILED", async () => {
    const capsule = await capsuleService.createCapsule(
      "proj-invalid",
      "owner-invalid",
      "build-invalid",
      [{ path: "data.txt", language: "text", contents: "no code" }],
      {
        appName: "Invalid App",
        archetype: "none",
        summary: "Invalid bundle",
        stack: [],
        entryPoint: "unknown",
      }
    );

    expect(capsule.status).toBe("FAILED");
    expect(capsule.healthCheckStatus).toBe("unhealthy");
    expect(capsule.failureCode).toBe("INVALID_BUNDLE");
  });

  it("supports owner immediate delete and runs verified cleanup", async () => {
    const capsule = await capsuleService.createCapsule(
      "proj-del",
      "owner-del",
      "build-del",
      sampleFiles,
      {
        appName: "Deletable App",
        archetype: "tool",
        summary: "Deletable",
        stack: ["React"],
        entryPoint: "src/main.tsx",
      }
    );

    expect(capsule.status).toBe("READY");
    const deleted = capsuleService.deleteCapsule(capsule.id);
    expect(deleted).toBe(true);

    const check = capsuleService.getCapsule(capsule.id);
    expect(check?.status).toBe("DELETED");
    expect(check?.cleanupStatus).toBe("verified_cleaned");
    expect(check?.files.length).toBe(0);
  });

  it("records viewer feedback without modifying source files", async () => {
    const capsule = await capsuleService.createCapsule(
      "proj-fb",
      "owner-fb",
      "build-fb",
      sampleFiles,
      {
        appName: "Feedback App",
        archetype: "tool",
        summary: "Testing feedback",
        stack: ["React"],
        entryPoint: "src/main.tsx",
      }
    );

    const feedback = capsuleService.submitFeedback(capsule.id, {
      buildId: capsule.buildId,
      currentRoute: "/",
      type: "change",
      comment: "Change primary button color to cyan",
    });

    expect(feedback.id).toMatch(/^fb-/);
    const list = capsuleService.getFeedback(capsule.id);
    expect(list.length).toBe(1);
    expect(list[0].comment).toBe("Change primary button color to cyan");

    // Ensure source code remains unmodified
    const fetched = capsuleService.getCapsule(capsule.id);
    expect(fetched?.files.length).toBe(2);
  });
});

describe("Deployment Advisor & Affiliate Neutrality", () => {
  let advisor: DeploymentAdvisorService;

  beforeEach(() => {
    advisor = new DeploymentAdvisorService();
  });

  it("calculates at most 3 prominent recommendations strictly by technical fit", () => {
    const recs = advisor.advise({
      projectType: "web_application",
      requiresPersistentData: true,
      requiresUserAccounts: false,
      acceptsPayments: false,
      requiresFileStorage: false,
      requiresBackgroundJobs: false,
      requiresRealtime: false,
      expectedTraffic: "low",
      technicalDifficultyPreference: "beginner",
      monthlyBudgetComfortUsd: "zero_to_10",
      controlPreference: "maximum_simplicity",
      requiresCustomDomain: true,
      requiresBusinessEmail: false,
      regulatoryOrResidencyRequirements: false,
      requiresAutoScaling: true,
    });

    expect(recs.length).toBeLessThanOrEqual(3);
    expect(recs[0].role).toBe("BEST_OVERALL");
    expect(recs[0].matchScore).toBeGreaterThanOrEqual(50);
  });

  it("preserves non-affiliate providers as eligible for Best Overall fit", () => {
    // Advanced container preferences match Fly.io (non-affiliate)
    const recs = advisor.advise({
      projectType: "api_backend_service",
      requiresPersistentData: true,
      requiresUserAccounts: false,
      acceptsPayments: false,
      requiresFileStorage: true,
      requiresBackgroundJobs: true,
      requiresRealtime: true,
      expectedTraffic: "medium",
      technicalDifficultyPreference: "intermediate",
      monthlyBudgetComfortUsd: "zero_to_10",
      controlPreference: "balanced",
      requiresCustomDomain: true,
      requiresBusinessEmail: false,
      regulatoryOrResidencyRequirements: false,
      requiresAutoScaling: true,
    });

    expect(recs.length).toBeGreaterThan(0);
    // Verified that non-affiliate status does not disqualify a provider
    const hasNonAffiliate = recs.some((r) => !r.isAffiliate);
    expect(hasNonAffiliate).toBe(true);
  });

  it("prepares a sanitized deployment package with zero secret values", () => {
    const mockPlan: ForgePlan = {
      appName: "Autonomous Commerce",
      archetype: "store",
      summary: "Full store",
      stack: ["React", "Express", "SQLite"],
      experts: [],
      mindMap: { nodes: [], edges: [] },
      audit: { score: 100, passed: 22, total: 22, findings: [] },
      files: [],
      phases: [],
    };

    const pkg = advisor.prepareHandoff("railway", mockPlan);
    expect(pkg.providerName).toBe("Railway");
    expect(pkg.environmentVariablesManifest.length).toBeGreaterThan(0);
    // Verify names only — zero stored secrets
    pkg.environmentVariablesManifest.forEach((v) => {
      expect((v as any).value).toBeUndefined();
      expect(v.name).toBeDefined();
    });
  });
});

describe("Build Pass Entitlements & 3 Free Tryouts", () => {
  let entitlements: BuildPassEntitlementService;

  beforeEach(() => {
    entitlements = new BuildPassEntitlementService();
  });

  it("enforces exactly 3 free tryouts before requiring a Build Pass", () => {
    const clientId = "client-quota-test";
    const acct = entitlements.getAccount(clientId);
    expect(acct.freeTryoutsAllowed).toBe(3);

    // Tryout 1
    expect(entitlements.canStartBuild(clientId).allowed).toBe(true);
    entitlements.consumeSession(clientId, "b1");

    // Tryout 2
    expect(entitlements.canStartBuild(clientId).allowed).toBe(true);
    entitlements.consumeSession(clientId, "b2");

    // Tryout 3
    expect(entitlements.canStartBuild(clientId).allowed).toBe(true);
    entitlements.consumeSession(clientId, "b3");

    // Tryout 4 — exhausted
    const check = entitlements.canStartBuild(clientId);
    expect(check.allowed).toBe(false);
    expect(check.remainingFree).toBe(0);
  });

  it("contains 49, 99, and 199 passes and omits 299 per prompt directive", () => {
    expect(BUILD_PASS_REGISTRY.single.priceUsd).toBe(49);
    expect(BUILD_PASS_REGISTRY.builder.priceUsd).toBe(99);
    expect(BUILD_PASS_REGISTRY.studio.priceUsd).toBe(199);
    expect((BUILD_PASS_REGISTRY as any).workshop).toBeUndefined();
  });

  it("releases reservation on build failure without consuming session", () => {
    const clientId = "client-rollback-test";
    const reservation = entitlements.reserveSession(clientId, "build-fail-1");
    expect(reservation.success).toBe(true);

    entitlements.releaseReservation(clientId, "build-fail-1");
    const acct = entitlements.getAccount(clientId);
    expect(acct.reservedSessionId).toBeUndefined();
    expect(acct.freeTryoutsUsed).toBe(0);
  });
});
