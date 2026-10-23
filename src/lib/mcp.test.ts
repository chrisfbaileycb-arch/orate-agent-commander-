import { describe, expect, it } from "vitest";
import {
  MCP_BENCH,
  MCP_CATEGORY_LABELS,
  mcpForPhase,
  mcpJournalLine,
  type McpCategory,
} from "./mcp";

describe("MCP tool bench catalog", () => {
  it("ships a non-empty, well-formed bench", () => {
    expect(MCP_BENCH.length).toBeGreaterThanOrEqual(20);
    for (const s of MCP_BENCH) {
      expect(["stdio", "http"]).toContain(s.transport);
      expect(["api-key", "oauth", "none"]).toContain(s.auth);
      expect(["official", "verified", "community"]).toContain(s.tier);
      expect(s.serves.length).toBeGreaterThan(0);
      expect(s.connect.length).toBeGreaterThan(0);
      expect(MCP_CATEGORY_LABELS[s.category]).toBeTruthy();
    }
  });

  it("connector snippets contain placeholders, never real-looking credentials", () => {
    for (const s of MCP_BENCH) {
      expect(s.connect).not.toMatch(/sk_live_[A-Za-z0-9]{16,}/);
      expect(s.connect).not.toMatch(/ghp_[A-Za-z0-9]{20,}/);
      expect(s.connect).not.toMatch(/AIza[A-Za-z0-9_-]{20,}/);
    }
  });

  it("covers every category with a label", () => {
    const used = new Set<McpCategory>();
    for (const s of MCP_BENCH) used.add(s.category);
    for (const cat of used) {
      expect(MCP_CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });

  it("seats databases on schema phases and integrations on backend phases", () => {
    const schemaIds = mcpForPhase("schema").map((s) => s.id);
    expect(schemaIds).toContain("supabase");
    expect(schemaIds).toContain("neon");

    const backendIds = mcpForPhase("backend").map((s) => s.id);
    expect(backendIds).toContain("stripe");
  });

  it("never returns an empty bench for any forge phase", () => {
    for (const phase of ["genesis", "schema", "backend", "frontend", "review", "deploy"]) {
      expect(mcpForPhase(phase).length).toBeGreaterThan(0);
    }
  });

  it("produces a journal line naming transport", () => {
    expect(mcpJournalLine(MCP_BENCH[0])).toMatch(/mcp · .+ seated \[(stdio|http)\]/);
  });
});
