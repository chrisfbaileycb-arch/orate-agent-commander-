/**
 * Agent Platform Supervision Manual & Configuration Generator
 *
 * Pure functions and structured workflow definitions for connecting, hooking up,
 * rendering, and supervising any external coding agent or multi-agent build platform
 * (Claude Code, Cursor, Windsurf, Cline, LangGraph, OpenAI Agents SDK, or custom HTTP workers)
 * through the Orator // Agent Commander control plane.
 */

export type AgentPlatformId =
  | "claude-code"
  | "cursor-windsurf"
  | "custom-http-swarm"
  | "docker-witness";

export interface ManualConfigParams {
  serverUrl: string;
  missionId: string;
  workerTokenPlaceholder: string;
  workspacePath: string;
}

export interface WorkflowStage {
  number: string;
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  verificationOutcome: string;
  commands: Array<{
    label: string;
    description: string;
    snippet: string;
  }>;
  checkpoints: string[];
}

const COVER_PAGE_STORAGE_KEY = "orator.cover_page.default_open";

export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "http://localhost:3000";
  return trimmed;
}

export function buildClaudeCodeSettingsJson(params: ManualConfigParams): string {
  const url = normalizeServerUrl(params.serverUrl);
  const mission = params.missionId.trim() || "msn_active_cutover";
  const token = params.workerTokenPlaceholder.trim() || "cmd_live_YOUR_WORKER_TOKEN";
  const workspace = (params.workspacePath.trim() || "/abs/path/to/repo").replace(/\/+$/, "");
  const hookPath = `${workspace}/dist/guard/claude-hook.js`;

  return JSON.stringify(
    {
      env: {
        COMMANDER_URL: url,
        COMMANDER_KEY: token,
        COMMANDER_MISSION: mission,
      },
      mcpServers: {
        "agent-commander": {
          type: "http",
          url: `${url}/v1/mcp`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash|Write|Edit|MultiEdit|NotebookEdit",
            hooks: [
              {
                type: "command",
                command: `node "${hookPath}" || exit 2`,
                timeout: 30,
              },
            ],
          },
        ],
      },
    },
    null,
    2
  );
}

export function buildCursorMcpJson(params: ManualConfigParams): string {
  const url = normalizeServerUrl(params.serverUrl);
  const token = params.workerTokenPlaceholder.trim() || "cmd_live_YOUR_WORKER_TOKEN";

  return JSON.stringify(
    {
      mcpServers: {
        "agent-commander": {
          type: "http",
          url: `${url}/v1/mcp`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2
  );
}

export function buildCustomSwarmHttpLoopSnippet(params: ManualConfigParams): string {
  const url = normalizeServerUrl(params.serverUrl);
  const mission = params.missionId.trim() || "msn_active_cutover";
  const token = params.workerTokenPlaceholder.trim() || "cmd_live_YOUR_WORKER_TOKEN";

  return [
    `# 1. Request pre-execution clearance from Perimeter Sentinel (/v1/guard/clearance)`,
    `curl -s -X POST ${url}/v1/guard/clearance \\`,
    `  -H "Authorization: Bearer ${token}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{`,
    `    "mission_id": "${mission}",`,
    `    "tool": "Bash",`,
    `    "action": {`,
    `      "kind": "shell",`,
    `      "command": "npm test",`,
    `      "intent": "Run unit test suite for current milestone"`,
    `    }`,
    `  }'`,
    ``,
    `# 2. Verify mechanical proof against step verifiers (/v1/verifiers/verify)`,
    `curl -s -X POST ${url}/v1/verifiers/verify \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{`,
    `    "evidence": {`,
    `      "exit_code": 0,`,
    `      "stdout": "All suites passed (exit 0)",`,
    `      "files_changed": 2`,
    `    }`,
    `  }'`,
  ].join("\n");
}

export function buildDockerWitnessEnvSnippet(params: ManualConfigParams): string {
  const workspace = (params.workspacePath.trim() || "/app/applet").replace(/\/+$/, "");
  return [
    `# Independent LocalWitness & Control Plane Environment (.env)`,
    `PORT=3000`,
    `HOST=0.0.0.0`,
    `COMMANDER_ADMIN_TOKEN=generate_32_byte_hex_admin_token_here`,
    `COMMANDER_COCKPIT_TOKEN=generate_32_byte_hex_cockpit_token_here`,
    `COMMANDER_LINK_SECRET=generate_32_byte_hex_hmac_link_token_here`,
    `COMMANDER_WITNESS_MODE=local`,
    `COMMANDER_WITNESS_ROOT=${workspace}`,
    `COMMANDER_WITNESS_ALLOW=npm,node,git`,
  ].join("\n");
}

export function buildMissionBlueprintJson(): string {
  return JSON.stringify(
    {
      title: "Release 4.2 · Sovereign Production Cutover",
      steps: [
        {
          title: "Verify workspace manifest & pass unit suite",
          directive:
            "Run the repository test suite, echo the step nonce in stdout, and ensure package.json is intact on disk.",
          risk_tier: "routine",
          max_attempts: 3,
          lease_seconds: 600,
          checks: [
            { type: "exit_code", equals: 0 },
            { type: "stdout_contains", needle: "passed" },
            { type: "nonce_echo" },
            {
              type: "witness_file",
              path: "package.json",
              min_bytes: 100,
              contains: '"name"',
            },
          ],
        },
        {
          title: "Execute zero-downtime schema migration",
          directive:
            "Apply additive SQL migrations only. Any destructive DDL is intercepted and staged for operator review.",
          risk_tier: "critical",
          max_attempts: 2,
          lease_seconds: 600,
          checks: [
            { type: "exit_code", equals: 0 },
            { type: "diff_clean", max_files: 10 },
          ],
        },
      ],
    },
    null,
    2
  );
}

export function buildStepByStepWorkflows(params: ManualConfigParams): WorkflowStage[] {
  const url = normalizeServerUrl(params.serverUrl);
  const mission = params.missionId.trim() || "msn_active_cutover";
  const token = params.workerTokenPlaceholder.trim() || "cmd_live_YOUR_WORKER_TOKEN";

  return [
    {
      number: "01",
      id: "connect-control-plane",
      title: "01. Boot & Unlock the Control Plane",
      subtitle: "Initialize Express + Vite, compile the standalone guard bundle, and authenticate your cockpit session.",
      summary:
        "Agent Commander places a deny-by-default security gate in front of every route. Start the control plane, compile the zero-dependency PreToolUse hook bundle, and unlock the operator session.",
      verificationOutcome: "GET /healthz returns 200 OK and GET /api/cockpit/session reports authenticated: true.",
      commands: [
        {
          label: "Install & compile standalone guard hook",
          description: "Builds dist/guard/claude-hook.js using only Node built-ins (node:*) so any repo can run it without node_modules.",
          snippet: `npm install\nnpm run build:guard`,
        },
        {
          label: "Start the Orator // Agent Commander server",
          description: "Boots Express + Vite on port 3000 and prints the per-run cockpit unlock token.",
          snippet: `export COMMANDER_ADMIN_TOKEN=$(openssl rand -hex 24)\nexport COMMANDER_COCKPIT_TOKEN=$(openssl rand -hex 24)\nexport COMMANDER_LINK_SECRET=$(openssl rand -hex 32)\nnpm run dev`,
        },
      ],
      checkpoints: [
        "dist/guard/claude-hook.js exists as a single self-contained file.",
        "Startup log displays [ORATOR // AGENT COMMANDER] Server running on http://0.0.0.0:3000.",
        "Cockpit session is unlocked (automatic on localhost in dev, or via Operator unlock token).",
      ],
    },
    {
      number: "02",
      id: "provision-tenant-keys",
      title: "02. Provision Tenant & Mint Scoped Credentials",
      subtitle: "Enforce cryptographic separation between Operator authority (cmd_op_…) and Worker execution (cmd_live_…).",
      summary:
        "Operators own the macro mission blueprint and approval gates. Subordinate agents receive a scoped worker credential that can only pull the current step directive, request clearance, and submit proof.",
      verificationOutcome: "Tenant created with initial credit balance; operator and worker keys stored as SHA-256 hashes.",
      commands: [
        {
          label: "Create an isolated tenant (Platform Admin)",
          description: "Provisions a tenant ledger and returns the operator key (cmd_op_...) once.",
          snippet: `curl -s -X POST ${url}/v1/admin/tenants \\\n  -H "Authorization: Bearer $COMMANDER_ADMIN_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "sovereign-prod-forge", "credits": 2500}'`,
        },
        {
          label: "Mint a subordinate worker key (Operator)",
          description: "Issues a worker credential (cmd_live_...) bound to the tenant.",
          snippet: `curl -s -X POST ${url}/v1/operator/keys \\\n  -H "Authorization: Bearer $OP_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"label": "agent-worker-01", "role": "worker"}'`,
        },
      ],
      checkpoints: [
        "Operator key (cmd_op_...) is kept private by the supervisor.",
        "Worker key (cmd_live_...) is handed to Claude Code, Cursor, or the worker swarm.",
        "Audit ledger records tenant.created and key.issued events.",
      ],
    },
    {
      number: "03",
      id: "hook-up-agent-platform",
      title: "03. Hook Up Agent Platform & Native PreToolUse Guard",
      subtitle: "Wire MCP Streamable HTTP (/v1/mcp) and trap native Bash/Write/Edit tool calls before execution.",
      summary:
        "Connect your agent platform over HTTP MCP so it pulls one step at a time, and install the PreToolUse hook with '|| exit 2' so native shell commands and file writes fail closed unless cleared by the Sentinel.",
      verificationOutcome: "Agent connects to /v1/mcp; destructive or critical commands exit with code 2 or pause in STAGED state.",
      commands: [
        {
          label: "Print exact Claude Code hook settings",
          description: "Outputs the ready-to-paste JSON block pointing to your local claude-hook.js binary.",
          snippet: `node dist/guard/claude-hook.js --print-settings \\\n  --url ${url} \\\n  --mission ${mission}`,
        },
        {
          label: "Verify fail-closed guard behavior locally",
          description: "Simulates a PreToolUse Bash call; destructive commands exit 2 with Commander's redirect on stderr.",
          snippet: `echo '{"session_id":"s1","cwd":"/work","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' \\\n  | COMMANDER_GUARD_LOCAL=1 node dist/guard/claude-hook.js`,
        },
      ],
      checkpoints: [
        "MCP server 'agent-commander' points to /v1/mcp with Authorization: Bearer cmd_live_...",
        "PreToolUse matcher covers Bash|Write|Edit|MultiEdit|NotebookEdit.",
        "Hook command ends with '|| exit 2' so any unexpected crash blocks the tool call.",
      ],
    },
    {
      number: "04",
      id: "open-mission-and-lease",
      title: "04. Open Step-Gated Mission & Issue Worker Lease",
      subtitle: "Define mechanical verifiers, hidden checks, nonces, and LocalWitness disk inspections.",
      summary:
        "Post the multi-step mission blueprint to /v1/operator/missions. When the worker pulls the current directive, Commander issues an active lease and transitions the 3D neural sphere to RUNNING (Blue Pulse).",
      verificationOutcome: "Mission opens at Step 1; pulling directive issues lease lse_... and nonce nce_...",
      commands: [
        {
          label: "Open a step-gated mission (Operator)",
          description: "Creates a mission with both worker-reported checks and independent LocalWitness file verification.",
          snippet: `curl -s -X POST ${url}/v1/operator/missions \\\n  -H "Authorization: Bearer $OP_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d @mission.json`,
        },
        {
          label: "Worker requests clearance or pulls directive",
          description: "Validates an action against the active step lease and risk tier.",
          snippet: `curl -s -X POST ${url}/v1/guard/clearance \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"mission_id":"${mission}","tool":"Bash","action":{"kind":"shell","command":"psql $PROD_DB -c \\"ALTER TABLE ledger DROP COLUMN legacy_sig;\\"","intent":"schema_change"}}'`,
        },
      ],
      checkpoints: [
        "Step 1 is released while Step 2+ remain locked and invisible to the worker.",
        "Each step combines [REPORTED] checks (exit_code, nonce_echo) with [WITNESSED] checks (witness_file).",
        "Risky SQL/shell actions automatically pause the mission and stage an approval gate.",
      ],
    },
    {
      number: "05",
      id: "render-supervise-audit",
      title: "05. Render Cockpit, Intervene & Verify SHA-256 Ledger",
      subtitle: "Supervise live state via SSE (/v1/events), execute One-Tap Authorize/Redirect/Kill, and verify the hash chain.",
      summary:
        "Monitor the 3D neural sphere and 3-column HUD cockpit in real time. Inspect provenance badges, approve or redirect staged actions with a single tap, and cryptographically audit the tenant's event chain.",
      verificationOutcome: "Step advances only on exit_code === 0; GET /v1/audit/verify confirms ok: true across all records.",
      commands: [
        {
          label: "Stream live mission & gate events via SSE",
          description: "Subscribes to real-time state transitions (IDLE, RUNNING, STAGED, VERIFIED, QUARANTINED).",
          snippet: `curl -N -H "Cookie: cmd_cockpit=$SESSION_COOKIE" ${url}/v1/events`,
        },
        {
          label: "Verify cryptographic SHA-256 audit chain",
          description: "Recomputes every record's SHA-256 digest from GENESIS (64 zeros) to the current headHash.",
          snippet: `curl -s -H "Cookie: cmd_cockpit=$SESSION_COOKIE" ${url}/v1/audit/verify | jq .`,
        },
      ],
      checkpoints: [
        "3D Neural Sphere reflects live mission state (Cyan Idle, Blue Running, Amber Staged, Green Verified, Red Quarantined).",
        "Footer status bar strictly reflects mission.last_event.summary and clears prior errors immediately.",
        "Voice and chat queries remain strictly read-only; Authorize, Redirect, and Kill require CSRF or signed /a/:id/decide links.",
      ],
    },
  ];
}

export function getDefaultCoverPageOpen(): boolean {
  try {
    if (typeof localStorage === "undefined") return true;
    const stored = localStorage.getItem(COVER_PAGE_STORAGE_KEY);
    if (stored === null) return true;
    return stored === "1";
  } catch {
    return true;
  }
}

export function setDefaultCoverPageOpen(open: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(COVER_PAGE_STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Ignore storage errors in restricted environments
  }
}
