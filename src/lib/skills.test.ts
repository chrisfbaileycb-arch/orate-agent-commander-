import { describe, expect, it } from "vitest";
import { SKILL_CODEX, skillsForPhase, skillJournalLine } from "./skills";

describe("backend skill codex", () => {
  it("ships a non-empty codex with well-formed playbooks", () => {
    expect(SKILL_CODEX.length).toBeGreaterThanOrEqual(10);
    for (const s of SKILL_CODEX) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(["database", "api", "cloud", "discipline"]).toContain(s.domain);
      expect(s.doctrine.length).toBeGreaterThan(0);
      expect(s.rules.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("seats schema playbooks on schema phases", () => {
    const ids = skillsForPhase("schema").map((s) => s.id);
    expect(ids).toContain("prisma-schema");
    expect(ids).toContain("postgres-doctrine");
  });

  it("seats backend + API discipline on backend phases", () => {
    const ids = skillsForPhase("backend").map((s) => s.id);
    expect(ids).toContain("prisma-client");
    expect(ids).toContain("api-gateway");
  });

  it("seats cloud doctrine on deployment phases", () => {
    const ids = skillsForPhase("deploy").map((s) => s.id);
    expect(ids).toContain("cloud-doctrine");
  });

  it("falls back cleanly for unknown phase keywords", () => {
    expect(Array.isArray(skillsForPhase("genesis"))).toBe(true);
  });

  it("produces a journal line without crashing", () => {
    expect(skillJournalLine(SKILL_CODEX[0])).toContain("codex ·");
  });
});
