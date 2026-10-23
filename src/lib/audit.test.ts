import { describe, expect, it } from "vitest";
import { runAudit } from "./audit";
import { buildPlan } from "./generator";
import type { ForgePlan } from "./types";

function samplePlan(): ForgePlan {
  const answers: Record<string, string> = {
    q1: "A booking system for a boutique climbing gym",
    q2: "Front-desk staff and members, on phones mostly",
    q3: "A member books a class in under 30 seconds",
    q4: "members, classes, bookings, payments, waitlists",
    q5: "Admins manage everything; members see only their bookings",
    q6: "No double-booking a full class; payments always logged",
    q7: "Postgres",
    q8: "Stripe for payments, SendGrid for confirmations",
    q9: "Show a retry banner and email admin after 3 failures",
    q10: "Weekly grid of classes with instant booking",
    q11: "Calm, premium, high-contrast",
    q12: "Mobile-first",
    q13: "Bookings per class, no-show rate, peak hours",
    q14: "Recurring memberships with auto-billing",
    q15: "No paid tools; must run offline at the gym",
  };
  return buildPlan(answers, "test-client-0001", "free");
}

describe("real 22-point invariant audit (verification gate input)", () => {
  it("produces exactly 22 findings with sequential ids", () => {
    const audit = runAudit(samplePlan());
    expect(audit.findings).toHaveLength(22);
    expect(audit.total).toBe(22);
    audit.findings.forEach((f, i) => expect(f.id).toBe(i + 1));
  });

  it("clears every probe against a complete blueprint (no fails, no skips)", () => {
    const audit = runAudit(samplePlan());
    const failed = audit.findings.filter((f) => f.status === "fail");
    const skipped = audit.findings.filter((f) => f.status === "pass-advisory");
    expect(failed).toHaveLength(0);
    expect(skipped).toHaveLength(0);
    expect(audit.passed).toBe(22);
  });

  it("composite score is 100 for the full scaffold", () => {
    const audit = runAudit(samplePlan());
    expect(audit.score).toBe(100);
  });

  it("genuinely inspects blueprint artifacts", () => {
    const plan = samplePlan();
    // All required scaffolding ships in the blueprint.
    const paths = plan.files.map((f) => f.path);
    for (const name of [
      "README.md",
      "SPEC.md",
      "openapi.json",
      "schema.sql",
      "seed.sql",
      "LICENSE",
      "auth.py",
      "Dockerfile",
      "docker-compose.yml",
      "run.sh",
      "playwright_e2e.py",
    ]) {
      expect(paths.some((p) => p.endsWith("/" + name))).toBe(true);
    }
    const audit = runAudit(plan);
    const titles = audit.findings.map((f) => f.title);
    // Representative real probes evaluate real content.
    expect(titles).toContain("Zero-Disk Invariant");
    expect(titles).toContain("Hardcoded Secret Scan");
    expect(titles).toContain("SQL Injection Immunity");
    expect(titles).toContain("Branding Tokens");
    expect(titles).toContain("ISO-8601 Time Handling");
  });

  it("fails loudly when scaffolding is removed (gate can hold)", () => {
    const plan = samplePlan();
    plan.files = plan.files.filter((f) => !f.path.endsWith("/schema.sql") && !f.path.endsWith("/SPEC.md"));
    const audit = runAudit(plan);
    expect(audit.findings.filter((f) => f.status === "fail").length).toBeGreaterThan(0);
    expect(audit.score).toBeLessThan(100);
  });
});
