import { describe, expect, it } from "vitest";
import {
  INQUEST_PHASES,
  INQUEST_QUESTIONS,
  phaseOf,
  ringProgress,
  summarizeInquest,
} from "./inquest";

describe("inquest catalog", () => {
  it("has exactly 15 questions with sequential q1..q15 ids", () => {
    expect(INQUEST_QUESTIONS).toHaveLength(15);
    INQUEST_QUESTIONS.forEach((q, i) => {
      expect(q.id).toBe(`q${i + 1}`);
      expect(q.prompt.length).toBeGreaterThan(0);
      expect(q.placeholder.length).toBeGreaterThan(0);
    });
  });

  it("covers the five phases with three questions each", () => {
    expect(INQUEST_PHASES).toEqual([
      "GENESIS",
      "ARCHITECTURE",
      "BACKEND",
      "INTERFACE",
      "OPERATIONS",
    ]);
    const byPhase = new Map<string, number>();
    for (const q of INQUEST_QUESTIONS) {
      byPhase.set(q.phase, (byPhase.get(q.phase) ?? 0) + 1);
    }
    for (const phase of INQUEST_PHASES) {
      expect(byPhase.get(phase)).toBe(3);
    }
  });

  it("maps indices to their phase", () => {
    expect(phaseOf(0)).toBe("GENESIS");
    expect(phaseOf(3)).toBe("ARCHITECTURE");
    expect(phaseOf(14)).toBe("OPERATIONS");
    // Out-of-range indices clamp instead of throwing.
    expect(phaseOf(99)).toBe("OPERATIONS");
  });

  it("bounds ring progress to 0..1", () => {
    expect(ringProgress(0, 15)).toBe(0);
    expect(ringProgress(15, 15)).toBe(1);
    expect(ringProgress(-3, 15)).toBe(0);
    expect(ringProgress(50, 15)).toBe(1);
  });

  it("summarizes answers deterministically", () => {
    const out = summarizeInquest([
      { questionId: "q1", value: "A booking system" },
      { questionId: "q2", value: "Front-desk staff" },
    ]);
    expect(out).toContain("What software are we forging today?");
    expect(out).toContain("→ A booking system");
    expect(out).toContain("→ Front-desk staff");
  });
});
