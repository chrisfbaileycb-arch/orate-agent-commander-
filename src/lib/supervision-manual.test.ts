import { describe, expect, it } from "vitest";
import {
  buildClaudeCodeSettingsJson,
  buildCursorMcpJson,
  buildCustomSwarmHttpLoopSnippet,
  buildDockerWitnessEnvSnippet,
  buildMissionBlueprintJson,
  buildStepByStepWorkflows,
  normalizeServerUrl,
} from "./supervision-manual";

describe("Supervision Manual & Platform Config Generators", () => {
  const defaultParams = {
    serverUrl: "http://localhost:3000/",
    missionId: "msn_cutover_42",
    workerTokenPlaceholder: "cmd_live_worker_demo_token",
    workspacePath: "/work/repo/",
  };

  it("normalizes trailing slashes and empty server URLs", () => {
    expect(normalizeServerUrl("http://localhost:3000///")).toBe("http://localhost:3000");
    expect(normalizeServerUrl("   ")).toBe("http://localhost:3000");
  });

  it("builds valid Claude Code .claude/settings.json with MCP server and fail-closed PreToolUse hook", () => {
    const raw = buildClaudeCodeSettingsJson(defaultParams);
    const parsed = JSON.parse(raw);

    expect(parsed.env).toEqual({
      COMMANDER_URL: "http://localhost:3000",
      COMMANDER_KEY: "cmd_live_worker_demo_token",
      COMMANDER_MISSION: "msn_cutover_42",
    });
    expect(parsed.mcpServers["agent-commander"].url).toBe("http://localhost:3000/v1/mcp");
    expect(parsed.mcpServers["agent-commander"].headers.Authorization).toBe(
      "Bearer cmd_live_worker_demo_token"
    );

    const preToolUse = parsed.hooks.PreToolUse[0];
    expect(preToolUse.matcher).toBe("Bash|Write|Edit|MultiEdit|NotebookEdit");
    expect(preToolUse.hooks[0].command).toBe(
      'node "/work/repo/dist/guard/claude-hook.js" || exit 2'
    );
  });

  it("builds valid Cursor / Windsurf .cursor/mcp.json configuration", () => {
    const raw = buildCursorMcpJson(defaultParams);
    const parsed = JSON.parse(raw);

    expect(parsed.mcpServers["agent-commander"]).toEqual({
      type: "http",
      url: "http://localhost:3000/v1/mcp",
      headers: {
        Authorization: "Bearer cmd_live_worker_demo_token",
      },
    });
  });

  it("builds custom HTTP swarm clearance and verification snippets", () => {
    const snippet = buildCustomSwarmHttpLoopSnippet(defaultParams);
    expect(snippet).toContain("http://localhost:3000/v1/guard/clearance");
    expect(snippet).toContain("http://localhost:3000/v1/verifiers/verify");
    expect(snippet).toContain("msn_cutover_42");
  });

  it("builds LocalWitness environment configuration and mission blueprint JSON", () => {
    const envText = buildDockerWitnessEnvSnippet(defaultParams);
    expect(envText).toContain("COMMANDER_WITNESS_MODE=local");
    expect(envText).toContain("COMMANDER_WITNESS_ROOT=/work/repo");

    const blueprint = JSON.parse(buildMissionBlueprintJson());
    expect(blueprint.steps).toHaveLength(2);
    expect(blueprint.steps[0].checks.some((c: { type: string }) => c.type === "witness_file")).toBe(
      true
    );
  });

  it("provides all 5 ordered step-by-step supervision workflow stages", () => {
    const stages = buildStepByStepWorkflows(defaultParams);
    expect(stages).toHaveLength(5);
    expect(stages.map((s) => s.number)).toEqual(["01", "02", "03", "04", "05"]);
    for (const stage of stages) {
      expect(stage.commands.length).toBeGreaterThan(0);
      expect(stage.checkpoints.length).toBeGreaterThan(0);
    }
  });
});
