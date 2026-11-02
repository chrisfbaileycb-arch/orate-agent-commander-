# Agent Commander & Orator.AI — Complete Agent Platform Supervision Manual

This manual provides step-by-step instructions to **connect**, **hook up**, **render**, and **supervise** any autonomous coding agent or multi-agent build platform (Claude Code, Cursor, Windsurf, Cline, LangGraph, OpenAI Agents SDK, or custom worker swarms) using the **Orator // Agent Commander** supervisory control plane.

---

## 1. System Architecture & Supervision Model

Agent Commander sits above subordinate worker agents as an enforceable airlock. It **never trusts a worker's self-reported `"Task complete"` message**. Instead, every agent platform build is governed by four mechanical guarantees:

1. **Step-Gated Airlock (`src/commander/airlock.ts`)**:
   - The operator holds the macro mission blueprint. Subordinate workers can only see the single currently released step.
   - Pulling a directive issues a time-bounded **Lease (`lse_...`)** and a cryptographic **Nonce (`nce_...`)**.
2. **Perimeter Sentinel & Native PreToolUse Guard (`src/commander/sentinel.ts`, `src/commander/guard/`)**:
   - Inspects shell commands, SQL statements, HTTP egress, and filesystem writes before execution.
   - Returns `CLEARED` (allow), `STAGED` (pause mission and require operator authorization), or `DENIED` (block immediately and inject a Deductive Anchor redirect patch).
3. **Mechanical Proof Auditor & Independent LocalWitness (`src/commander/verifiers.ts`, `src/commander/witness.ts`)**:
   - Evaluates 8 deterministic verifiers (`exit_code`, `stdout_contains`, `stdout_regex`, `json_schema`, `artifact_sha256`, `nonce_echo`, `diff_clean`, and `witness` / `witness_file` / `witness_json`).
   - Distinguishes **`[WITNESSED]`** evidence (independently executed or inspected on disk by Commander's `LocalWitness`) from **`[REPORTED]`** evidence (claimed by worker stdout/payload) and **`[NATIVE INTERCEPT: Bash/Write]`** (trapped by the local hook before tool execution).
4. **Tamper-Evident SHA-256 Audit Ledger (`src/commander/store.ts`)**:
   - Every tenant creation, key mint, directive lease, staged gate, operator decision, and proof verification is hash-chained (`prev` → `hash`) per tenant and verifiable at `GET /v1/audit/verify`.

---

## 2. Step-by-Step Workflow: Connect, Hook Up, Render, and Supervise

### Step 1: Boot & Unlock the Control Plane

1. **Install dependencies and build the standalone native guard bundle**:
   ```bash
   npm install
   npm run build:guard
   ```
   This compiles `dist/guard/claude-hook.js` as a zero-dependency Node.js bundle that uses only Node built-ins (`node:*`).

2. **Configure environment variables (optional for local dev, required for production)**:
   ```bash
   # Platform admin token (16+ chars) to enable /v1/admin/* tenant provisioning
   export COMMANDER_ADMIN_TOKEN=$(openssl rand -hex 24)

   # Operator unlock token (16+ chars) for the web HUD cockpit
   export COMMANDER_COCKPIT_TOKEN=$(openssl rand -hex 24)

   # HMAC secret (16+ chars) for single-use mobile approval links (/a/:id/decide)
   export COMMANDER_LINK_SECRET=$(openssl rand -hex 32)

   # Optional: Enable independent command witnessing on a trusted workspace
   export COMMANDER_WITNESS_MODE=local
   export COMMANDER_WITNESS_ROOT=$(pwd)
   export COMMANDER_WITNESS_ALLOW=npm,node,git
   ```

3. **Start the server on port 3000**:
   ```bash
   npm run dev
   ```
   - In local development (when `COMMANDER_COCKPIT_TOKEN` is not set and you browse from `http://localhost:3000`), the cockpit unlocks automatically.
   - In production or remote previews, copy the generated `[COCKPIT] Unlock token` from the startup log and paste it into the **Operator unlock** control in the top bar.

---

### Step 2: Provision a Tenant & Mint Scoped Keys

Commander enforces strict role separation between the **Platform Admin**, the **Operator (`cmd_op_...`)**, and the **Subordinate Worker (`cmd_live_...`)**.

1. **Create a tenant (as Platform Admin)**:
   ```bash
   curl -s -X POST http://localhost:3000/v1/admin/tenants \
     -H "Authorization: Bearer $COMMANDER_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name": "acme-production-forge", "credits": 2500}'
   ```
   Save the returned `operatorKey` (`cmd_op_...`) and `tenant.id` (`ten_...`).

2. **Mint a Worker Key (as Operator)**:
   ```bash
   export OP_KEY="cmd_op_..."

   curl -s -X POST http://localhost:3000/v1/operator/keys \
     -H "Authorization: Bearer $OP_KEY" \
     -H "Content-Type: application/json" \
     -d '{"label": "claude-code-worker-01", "role": "worker"}'
   ```
   Save the returned `secret` (`cmd_live_...`). This worker key can pull directives, request clearance, and submit proof, but **cannot** view future steps, approve its own staged gates, or alter the mission blueprint.

3. **Open a Step-Gated Mission (as Operator)**:
   ```bash
   curl -s -X POST http://localhost:3000/v1/operator/missions \
     -H "Authorization: Bearer $OP_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Release 4.2 · Sovereign Production Cutover",
       "steps": [
         {
           "title": "Verify workspace manifest & pass unit suite",
           "directive": "Run the test suite, echo the step nonce, and ensure package.json is intact.",
           "risk_tier": "routine",
           "max_attempts": 3,
           "lease_seconds": 600,
           "checks": [
             { "type": "exit_code", "equals": 0 },
             { "type": "stdout_contains", "needle": "passed" },
             { "type": "nonce_echo" },
             { "type": "witness_file", "path": "package.json", "min_bytes": 100, "contains": "\"name\"" }
           ]
         },
         {
           "title": "Execute zero-downtime schema migration",
           "directive": "Apply the additive migration without dropping columns or tables.",
           "risk_tier": "critical",
           "max_attempts": 2,
           "lease_seconds": 600,
           "checks": [
             { "type": "exit_code", "equals": 0 },
             { "type": "diff_clean", "max_files": 10 }
           ]
         }
       ]
     }'
   ```
   Save the returned mission `id` (`msn_...`).

---

### Step 3: Hook Up Your Agent Platform

Choose your agent platform below to wire both **MCP supervision** and **native tool interception**.

#### Option A: Claude Code (MCP Server + Native `PreToolUse` Hook)

Claude Code supports both the Commander MCP server and the native `PreToolUse` hook so that native `Bash`, `Write`, `Edit`, `MultiEdit`, and `NotebookEdit` calls cannot bypass the Perimeter Sentinel.

1. **Generate the exact `.claude/settings.json` snippet**:
   ```bash
   node dist/guard/claude-hook.js --print-settings \
     --url http://localhost:3000 \
     --mission msn_YOUR_MISSION_ID
   ```
2. **Add the MCP server and `PreToolUse` hook to `.claude/settings.json`**:
   ```json
   {
     "env": {
       "COMMANDER_URL": "http://localhost:3000",
       "COMMANDER_KEY": "cmd_live_YOUR_WORKER_KEY",
       "COMMANDER_MISSION": "msn_YOUR_MISSION_ID"
     },
     "mcpServers": {
       "agent-commander": {
         "type": "http",
         "url": "http://localhost:3000/v1/mcp",
         "headers": {
           "Authorization": "Bearer cmd_live_YOUR_WORKER_KEY"
         }
       }
     },
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash|Write|Edit|MultiEdit|NotebookEdit",
           "hooks": [
             {
               "type": "command",
               "command": "node \"/ABSOLUTE/PATH/TO/dist/guard/claude-hook.js\" || exit 2",
               "timeout": 30
             }
           ]
         }
       ]
     }
   }
   ```
   **Why `|| exit 2` is mandatory**: Claude Code only blocks a native tool call when a hook exits with code `2`. Wrapping the command with `|| exit 2` guarantees that even if Node crashes or the hook file is missing, the guard **fails closed**.

#### Option B: Cursor / Windsurf / Cline (`.cursor/mcp.json`)

Add Agent Commander to `.cursor/mcp.json` (or your IDE's MCP settings):

```json
{
  "mcpServers": {
    "agent-commander": {
      "type": "http",
      "url": "http://localhost:3000/v1/mcp",
      "headers": {
        "Authorization": "Bearer cmd_live_YOUR_WORKER_KEY"
      }
    }
  }
}
```

Instruct the agent in `.cursorrules` or your system prompt:
> "Before executing any task, call `pull_directive` with `mission_id`. Before running any destructive or elevated shell, SQL, or file operation, call `request_clearance`. To advance to the next milestone, call `submit_proof` with `exit_code`, `stdout` (including the step `nonce`), and `diff`."

#### Option C: Custom Agent Swarms / LangGraph / OpenAI Agents SDK (HTTP / REST)

Any runtime can interact with Commander over standard HTTP using the worker bearer key (`cmd_live_...`):

1. **Pull the current directive & lease (`POST /v1/mcp` or cockpit lifecycle)**:
   Call MCP tool `pull_directive` with `{ "mission_id": "msn_..." }`. Commander returns the active `step_id`, `lease_id`, `nonce`, `directive`, and visible `checks`.
2. **Request pre-execution tool clearance (`POST /v1/guard/clearance`)**:
   ```bash
   curl -s -X POST http://localhost:3000/v1/guard/clearance \
     -H "Authorization: Bearer $WORKER_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "mission_id": "msn_YOUR_MISSION_ID",
       "tool": "Bash",
       "action": {
         "kind": "shell",
         "command": "npm test",
         "intent": "Run unit test suite"
       }
     }'
   ```
   - `status: "CLEARED"` → Proceed immediately.
   - `status: "STAGED"` → Execution is paused. Wait for the operator to click **Authorize** in the HUD cockpit (or via the signed link `/a/:id/decide`), then re-request clearance to consume the single-use authorization token.
   - `status: "DENIED"` → Abort the action and follow the returned `message` redirect patch.
3. **Submit mechanical proof (`submit_proof` tool via `/v1/mcp`)**:
   Submit `{ mission_id, lease_id, evidence: { exit_code: 0, stdout: "... nce_...", files_changed: 2, diff: "..." } }`.

---

### Step 4: Render & Supervise Live Builds in the HUD Cockpit

Open `http://localhost:3000` in your browser to render the **Orator // Agent Commander HUD Cockpit**:

1. **Live 3D Neural Sphere & Header Status Pill**:
   Connected directly to `GET /v1/missions/:id` and the real-time SSE stream (`GET /v1/events`):
   - **IDLE (`Cyan`)**: No active lease or unallocated milestone.
   - **RUNNING (`Blue Pulse`)**: Active valid lease issued to a subordinate worker.
   - **STAGED (`Amber Gate`)**: Sentinel or `PreToolUse` hook intercepted an action; pending operator decision.
   - **VERIFIED (`Green Flash · Exit 0`)**: All mechanical verifiers and `LocalWitness` checks passed.
   - **QUARANTINED (`Glitch Red`)**: Attempt budget exhausted, credit balance depleted, or security violation detected.

2. **Observed vs. Reported Provenance Badges (Center Column)**:
   - **`[WITNESSED]` (Emerald)**: Executed or inspected directly on disk by Commander's `LocalWitness` runner (`witness`, `witness_file`, `witness_json`). Cannot be forged by worker stdout.
   - **`[REPORTED]` (Amber)**: Claimed by worker payload (`exit_code`, `stdout_contains`, `stdout_regex`, `nonce_echo`).
   - **`[NATIVE INTERCEPT: Bash/Write]` (Violet)**: Trapped directly by the `PreToolUse` hook before the native tool could run.

3. **One-Tap Operator Intervention (`Authorize` / `Redirect` / `Kill`)**:
   - **Authorize (`✓`)**: Grants a single-use clearance pass (for staged gates) or resets the attempt budget and issues a fresh lease (for quarantined steps).
   - **Redirect (`↻`)**: Appends your custom engineering instruction behind the **Deductive Anchor** (`Stop. The previous approach is closed...`) directly into the step directive.
   - **Kill (`✕`)**: Immediately revokes all active leases and permanently terminates the mission.

4. **Cryptographic Audit Verification (Right Column & `GET /v1/audit/verify`)**:
   - Displays live `OK: TRUE` status, SHA-256 chain depth (`DEPTH N`), current `HEAD` hash, and the latest hash-chained records.

5. **Read-Only Voice & Chat Ledger Query Dock (Bottom Bar)**:
   - Ask questions via microphone (`SPEAK`) or text input (`"Status report"`, `"Why is step 1 staged?"`, `"Verify audit chain"`).
   - **Security invariant**: Voice and chat inputs are strictly read-only and cannot trigger `Authorize`, `Redirect`, or `Kill`.

---

### Step 5: Using the Manual as the Application Cover Page

The interactive **Supervision Manual & Cover Page** is built directly into the application front-end:
- Click **`📖 Manual & Cover Page`** in the top navigation bar at any time to switch between the **Cover Page Manual**, the **Live HUD Cockpit**, and the **Pipeline Weave**.
- Toggle **"Use as Default Cover Page on Launch"** inside the Cover Page header if you want operators and visitors to land on the step-by-step Supervision Manual first before entering the live 3D HUD Cockpit.
- Use the interactive **Live Config & Hook Generator** on the Cover Page to customize your Server URL, Mission ID, and Worker Key and copy ready-to-paste configurations for Claude Code, Cursor, or custom HTTP workers.
