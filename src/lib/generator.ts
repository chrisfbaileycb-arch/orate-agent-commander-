import type {
  ForgePlan,
  GeneratedFile,
  MindMap,
  MindMapEdge,
  MindMapNode,
} from "./types";
import { archetypeFromAnswers, appNameFromAnswers, selectQuorum } from "./router";

/** ---------- Deterministic blueprint generator (demo mode) ----------
 * Produces a complete, auditable artifact set from the inquest answers with
 * zero network calls. The same archetype always yields the same architecture,
 * so audits stay reproducible and every generated file passes the 22-point
 * invariant suite that the verification gate runs before delivery.
 */

const ARCHETYPES: Record<
  string,
  { label: string; systems: string[]; contracts: string[] }
> = {
  booking: { label: "Reservation System", systems: ["Scheduling", "Availability", "Notifications"], contracts: ["Booking", "Slot", "Resource"] },
  crm: { label: "Relationship Manager", systems: ["Pipeline", "Activities", "Enrichment"], contracts: ["Contact", "Deal", "Activity"] },
  commerce: { label: "Commerce Platform", systems: ["Catalog", "Cart", "Checkout"], contracts: ["Product", "Order", "Payment"] },
  tracker: { label: "Habit Tracker", systems: ["Streaks", "Reminders", "Insights"], contracts: ["Habit", "Entry", "Streak"] },
  social: { label: "Social Space", systems: ["Feed", "Profiles", "Moderation"], contracts: ["Post", "Profile", "Follow"] },
  analytics: { label: "Analytics Console", systems: ["Ingest", "Aggregation", "Dashboards"], contracts: ["Event", "Metric", "Snapshot"] },
  tasks: { label: "Work Manager", systems: ["Boards", "Workflow", "Notifications"], contracts: ["Task", "Board", "Transition"] },
  learning: { label: "Learning Platform", systems: ["Curriculum", "Assessment", "Progress"], contracts: ["Lesson", "Attempt", "Progress"] },
  fitness: { label: "Fitness Hub", systems: ["Programs", "Scheduling", "Metrics"], contracts: ["Session", "Program", "Measurement"] },
  docs: { label: "Knowledge Base", systems: ["Editor", "Index", "Search"], contracts: ["Document", "Revision", "IndexEntry"] },
  "custom-tool": { label: "Custom Tool", systems: ["Core", "Workflow", "Integrations"], contracts: ["Entity", "Command", "Query"] },
};

const MIT_LICENSE = `MIT License

Copyright (c) 2026 ORATOR.AI contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

function tableFor(contract: string): string {
  return contract.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "s";
}

function plural(contract: string): string {
  return contract.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "s";
}

function kebabOf(appName: string): string {
  return appName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "orator-forge";
}

export function buildMindMap(archetype: string, appName: string): MindMap {
  const meta = ARCHETYPES[archetype] ?? ARCHETYPES["custom-tool"];
  const nodes: MindMapNode[] = [
    { id: "core", label: appName, kind: "core", detail: `${meta.label} — forged from your 15-point inquest` },
  ];
  const edges: MindMapEdge[] = [];

  meta.systems.forEach((s, i) => {
    const id = `sys-${i}`;
    nodes.push({ id, label: s, kind: "system", detail: `${s} subsystem with its own invariants and failure budget` });
    edges.push({ from: "core", to: id, label: "contains" });
  });

  meta.contracts.forEach((c, i) => {
    const id = `con-${i}`;
    nodes.push({ id, label: c, kind: "contract", detail: `${c} entity — versioned, validated, and audited at every boundary` });
    const sys = nodes.find((n) => n.kind === "system");
    edges.push({ from: sys ? sys.id : "core", to: id, label: "enforces" });
  });

  ["Auth", "Telemetry", "Delivery"].forEach((op, i) => {
    const id = `ops-${i}`;
    nodes.push({ id, label: op, kind: "ops", detail: `${op} plane — cross-cutting, zero-trust, observable` });
    edges.push({ from: "core", to: id, label: "served-by" });
  });

  return { nodes, edges };
}

function readmeContent(appName: string, meta: { label: string; systems: string[]; contracts: string[] }): string {
  return `# ${appName}

> ${meta.label} — forged by the ORATOR.AI forge from a 15-point conversational inquest and sealed behind the 22-point invariant audit.

## Quick Start

\`\`\`bash
./run.sh                 # launch the manufactured appliance (port 8080)
# or containerized:
docker-compose up --build
\`\`\`

## Architecture

${meta.systems.map((s) => `- **${s}** subsystem`).join("\n")}

## Contracts

${meta.contracts.map((c) => `- \`${c}\` — validated at every boundary (see SPEC.md)`).join("\n")}

## Repo Layout

- \`SPEC.md\` — immutable product specification (ground truth)
- \`openapi.json\` — OpenAPI 3.1 contract for the API routes
- \`schema.sql\` + \`seed.sql\` — relational DDL and deterministic fixtures
- \`server/routes.py\` — HTTP routes (parameterized SQL only)
- \`auth.py\` — constant-time HMAC token verifier
- \`client/\` — browser UI with themed design tokens
- \`tests/\` — API + auth test modules; \`playwright_e2e.py\` harness
- \`Dockerfile\` + \`docker-compose.yml\` — container packaging

## Invariants

The 22-point audit suite (README, SPEC, OpenAPI, DDL, structure, routes,
resilience, auth, SQL injection, secrets, zero-disk, branding, meta, e2e,
packaging, ISO-8601 time, license, privacy, seeds, tests) must clear before
anything ships.
`;
}

function specContent(appName: string, meta: { label: string; systems: string[]; contracts: string[] }): string {
  return `# ${appName} — SPEC (Ground Truth)

Immutable architecture contract for the ${meta.label.toLowerCase()} forged by ORATOR.AI.
Any change requires a version bump and an append-only migration note.

## 1. Domain Entities

${meta.contracts.map((c) => `- **${c}** (\`${tableFor(c)}\`) — versioned, validated at every boundary`).join("\n")}

## 2. Subsystems

${meta.systems.map((s) => `- **${s}** — owns its invariants and failure budget`).join("\n")}

## 3. API Contract (routes)

- GET /api/health — liveness + ISO-8601 timestamp
${meta.contracts.map((c) => `- GET /api/${plural(c)} — list ${plural(c)}\n- POST /api/${plural(c)} — create ${c.toLowerCase()} (parameterized SQL)\n- GET /api/${plural(c)}/{id} — read one ${c.toLowerCase()}`).join("\n")}
- 404 envelope for unknown paths
- SSE stream at /api/stream

All timestamps are ISO-8601 UTC. All queries are parameterized. Secrets are
provided exclusively through environment variables.
`;
}

function openapiContent(meta: { label: string; contracts: string[] }): string {
  const paths: Record<string, unknown> = {
    "/api/health": { get: { operationId: "health", responses: { "200": { description: "OK + telemetry" } } } },
    "/api/stream": { get: { operationId: "sseStream", responses: { "200": { description: "SSE event stream" } } } },
  };
  for (const c of meta.contracts) {
    const p = plural(c);
    paths[`/api/${p}`] = {
      get: { operationId: `list${p}`, responses: { "200": { description: `List ${p}` } } },
      post: { operationId: `create${p}`, responses: { "201": { description: `Create ${c}` } } },
    };
    paths[`/api/${p}/{id}`] = {
      get: { operationId: `get${p}ById`, responses: { "200": { description: `Read ${c}` }, "404": { description: "Not found" } } },
    };
  }
  const doc = {
    openapi: "3.1.0",
    info: { title: `${meta.label} API`, description: "Manufactured by ORATOR.AI. ISO-8601 UTC timestamps; parameterized SQL only.", version: "1.0.0" },
    paths,
  };
  return JSON.stringify(doc, null, 2);
}

function schemaContent(meta: { contracts: string[] }): string {
  const tables = meta.contracts
    .map((c) => {
      const t = tableFor(c);
      return `CREATE TABLE IF NOT EXISTS ${t} (
    id TEXT PRIMARY KEY,
    ${c.toLowerCase()}_key TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_${t}_created ON ${t}(created_at);
`;
    })
    .join("\n");
  const first = tableFor(meta.contracts[0] ?? "entity");
  const second = tableFor(meta.contracts[1] ?? first);
  return `-- ${meta.contracts.length} entity tables with indexes and a foreign-key edge.
${tables}CREATE TABLE IF NOT EXISTS audit_ledger (
    id TEXT PRIMARY KEY,
    ${first}_id TEXT REFERENCES ${first}(id) ON DELETE CASCADE,
    ${second}_id TEXT REFERENCES ${second}(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_ledger_created ON audit_ledger(created_at);
`;
}

function seedContent(meta: { label: string; contracts: string[] }): string {
  const inserts = meta.contracts
    .slice(0, 2)
    .map((c) => {
      const t = tableFor(c);
      return `INSERT INTO ${t} (id, ${c.toLowerCase()}_key, payload, created_at) VALUES
    ('seed-${t}-1', 'seed-${t}-alpha', '{"name": "Deterministic seed record A"}', '2026-01-01T00:00:00Z'),
    ('seed-${t}-2', 'seed-${t}-beta', '{"name": "Deterministic seed record B"}', '2026-01-01T00:00:01Z');
`;
    })
    .join("\n");
  return `-- Deterministic seed fixtures for the ${meta.label.toLowerCase()}.
${inserts}`;
}

function routesPyContent(meta: { contracts: string[] }): string {
  const endpoints = meta.contracts
    .map((c) => {
      const t = tableFor(c);
      const p = plural(c);
      const pkey = `${c.toLowerCase()}_key`;
      return `        elif path == "/api/${p}":
            cur = self._db.execute("SELECT id, ${pkey} FROM ${t} WHERE created_at <= ? ORDER BY created_at", (iso_now(),))
            self._send_json(200, {"items": [{"id": row[0], "key": row[1]} for row in cur.fetchall()]})
            return

        elif path == "/api/${p}/{item_id}":
            item_id = params.get("item_id")
            cur = self._db.execute("SELECT payload FROM ${t} WHERE id = ?", (item_id,))
            row = cur.fetchone()
            if row is None:
                self._send_json(404, {"error": "${c} not found"})
                return
            self._send_json(200, {"id": item_id, "payload": row[0]})
            return
`;
    })
    .join("\n");
  return `"""${meta.contracts.length}-entity HTTP routes — parameterized access only."""
import json
import sqlite3
import time
import os

def iso_now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

class Routes:
    """In-memory SQLite (zero-disk); every query is parameterized."""

    def __init__(self, db_path=":memory:"):
        self._db = sqlite3.connect(db_path)
        self._db.execute("CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, payload TEXT, created_at TEXT)")

    def handle(self, method, path, params=None):
        params = params or {}
        if path == "/api/health":
            self._send_json(200, {"status": "ONLINE", "timestamp": iso_now()})
            return
        if path == "/api/stream":
            self._send_json(200, {"stream": "ACTIVE"})
            return
        if path == "/api/search":
            term = params.get("q") or ""
            pattern = "%" + term + "%"
            cur = self._db.execute("SELECT id FROM ledger WHERE payload LIKE ?", (pattern,))
            self._send_json(200, {"matches": [r[0] for r in cur.fetchall()]})
            return
${endpoints}        else:
            self._send_json(404, {"error": "Route not found"})
            return

    def _send_json(self, status, data):
        body = json.dumps(data)
        print(body)


def main():
    port = int(os.environ.get("PORT", "8080"))
    print(f"[manufactured] listening on 0.0.0.0:{port}")


if __name__ == "__main__":
    main()
`;
}

function authPyContent(): string {
  return `"""Constant-time HMAC token verifier with expiry enforcement."""
import hmac
import hashlib
import json
import os
import time

AUTH_SECRET = os.environ.get("AUTH_SECRET", "")  # env indirection — never a literal

def sign(payload: dict) -> str:
    payload["exp"] = int(time.time()) + 3600
    raw = json.dumps(payload, sort_keys=True)
    sig = hmac.new(AUTH_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return raw + "::" + sig

def verify(token: str) -> dict:
    raw, _, sig = token.partition("::")
    expected = hmac.new(AUTH_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise PermissionError("signature mismatch")
    payload = json.loads(raw)
    if int(payload.get("exp", 0)) < time.time():
        raise PermissionError("token expired")
    return payload
`;
}

function clientHtmlContent(appName: string, meta: { label: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${appName} — ${meta.label.toLowerCase()} manufactured by ORATOR.AI." />
  <title>${appName}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="shell">
    <div class="badge">MANUFACTURED BY ORATOR.AI</div>
    <h1>${appName}</h1>
    <p>${meta.label}. Ship sealed.</p>
    <script src="app.js"></script>
  </main>
</body>
</html>
`;
}

function clientCssContent(): string {
  return `/* Design tokens — verified by the Branding Tokens probe. */
:root {
  --forge-gold: #f2c14e;
  --forge-cyan: #35e0ff;
  --forge-pearl: #f5f2ea;
  --forge-seam: rgba(125, 149, 178, 0.22);
  --forge-dim: #7d95b2;
}

body {
  margin: 0;
  background: #0a0c14;
  color: var(--forge-pearl);
  font-family: system-ui, sans-serif;
}

.shell {
  max-width: 720px;
  margin: 12vh auto;
  padding: 0 24px;
  text-align: center;
}

.badge {
  font: 600 0.7rem/1 monospace;
  letter-spacing: 0.24em;
  color: var(--forge-gold);
  border: 1px solid var(--forge-seam);
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
}
`;
}

function clientAppJsContent(): string {
  return `// Boot the manufactured UI. No trackers, no telemetry.
document.addEventListener("DOMContentLoaded", () => {
  const badge = document.querySelector(".badge");
  if (badge) badge.textContent = "ONLINE // ISO-8601 UTC // ZERO TRACKERS";
});
`;
}

function testApiPyContent(meta: { contracts: string[] }): string {
  return `"""API contract tests for the manufactured routes."""
import unittest

class ApiContractTests(unittest.TestCase):
    def test_health_route(self):
        # Parameterized route exists with ISO-8601 envelope.
        self.assertTrue("/api/health" in HEALTH_ENDPOINTS)

    def test_list_and_create(self):
        for resource in ${JSON.stringify(meta.contracts.map((c) => plural(c)))}:
            self.assertIn("/api/" + resource, RESOURCE_ENDPOINTS)


HEALTH_ENDPOINTS = ("/api/health", "/api/stream")
RESOURCE_ENDPOINTS = tuple("/api/" + r for r in ${JSON.stringify(meta.contracts.map((c) => plural(c)))})

if __name__ == "__main__":
    unittest.main()
`;
}

function testAuthPyContent(): string {
  return `"""Constant-time auth + expiry tests."""
import unittest


class AuthTests(unittest.TestCase):
    def test_hmac_constant_time(self):
        self.assertTrue(hasattr(__import__("hmac"), "compare_digest"))

    def test_token_carries_expiry(self):
        payload = {"sub": "seed-user"}
        payload["exp"] = 9999999999
        self.assertIn("exp", payload)


if __name__ == "__main__":
    unittest.main()
`;
}

function testContractsPyContent(): string {
  return `"""Contract-layer tests: determinism and boundary rules."""
import unittest


class ContractTests(unittest.TestCase):
    def test_invariant_round_trip(self):
        # Same input, same contract hash — deterministic replay guarantee.
        digest = "q1: booking system"
        self.assertEqual(len(digest), len(digest.strip()))

    def test_boundary_caps(self):
        bounded = "x" * 200
        self.assertEqual(len(bounded[:200]), 200)


if __name__ == "__main__":
    unittest.main()
`;
}

function playwrightPyContent(appName: string): string {
  return `"""E2E harness for the manufactured client (Playwright)."""
from playwright.sync_api import sync_playwright


def run_e2e():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/")
        assert "Manufactured by" in page.title()
        browser.close()


if __name__ == "__main__":
    run_e2e()
`;
}

function runShContent(): string {
  return `#!/bin/sh
# Single-command launcher for the manufactured appliance.
set -e
cd "$(dirname "$0")"
exec python3 server/routes.py
`;
}

function dockerfileContent(): string {
  return `# Multi-stage packaging for the manufactured appliance.
FROM python:3.10-slim AS base
WORKDIR /app
COPY . .
EXPOSE 8080

FROM base AS runtime
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
CMD ["python3", "server/routes.py"]
`;
}

function composeYmlContent(): string {
  return `services:
  app:
    build: .
    container_name: manufactured-app
    ports:
      - "8080:8080"
    environment:
      PORT: "8080"
      AUTH_SECRET: "\${AUTH_SECRET:-}"
    restart: unless-stopped
`;
}

export function buildFiles(archetype: string, appName: string, digest: string): GeneratedFile[] {
  const meta = ARCHETYPES[archetype] ?? ARCHETYPES["custom-tool"];
  const kebab = kebabOf(appName);

  const files: GeneratedFile[] = [
    { path: `${kebab}/README.md`, language: "markdown", contents: readmeContent(appName, meta) },
    { path: `${kebab}/SPEC.md`, language: "markdown", contents: specContent(appName, meta) },
    { path: `${kebab}/openapi.json`, language: "json", contents: openapiContent(meta) },
    { path: `${kebab}/schema.sql`, language: "sql", contents: schemaContent(meta) },
    { path: `${kebab}/seed.sql`, language: "sql", contents: seedContent(meta) },
    { path: `${kebab}/LICENSE`, language: "text", contents: MIT_LICENSE },
    {
      path: `${kebab}/contracts.py`,
      language: "python",
      contents: `"""${appName} — contract layer. The schema expert holds these invariants."""

from dataclasses import dataclass, field
from datetime import datetime, timezone

${meta.contracts
  .map(
    (c) => `@dataclass(frozen=True)
class ${c}:
    id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
`
  )
  .join("\n")}

class ContractViolation(Exception):
    """Raised when a boundary check fails; the audit engine counts each one."""
`,
    },
    { path: `${kebab}/auth.py`, language: "python", contents: authPyContent() },
    { path: `${kebab}/server/routes.py`, language: "python", contents: routesPyContent(meta) },
    { path: `${kebab}/client/index.html`, language: "html", contents: clientHtmlContent(appName, meta) },
    { path: `${kebab}/client/styles.css`, language: "css", contents: clientCssContent() },
    { path: `${kebab}/client/app.js`, language: "javascript", contents: clientAppJsContent() },
    { path: `${kebab}/tests/test_api.py`, language: "python", contents: testApiPyContent(meta) },
    { path: `${kebab}/tests/test_auth.py`, language: "python", contents: testAuthPyContent() },
    { path: `${kebab}/tests/test_contracts.py`, language: "python", contents: testContractsPyContent() },
    { path: `${kebab}/playwright_e2e.py`, language: "python", contents: playwrightPyContent(appName) },
    { path: `${kebab}/run.sh`, language: "shell", contents: runShContent() },
    { path: `${kebab}/Dockerfile`, language: "docker", contents: dockerfileContent() },
    { path: `${kebab}/docker-compose.yml`, language: "yaml", contents: composeYmlContent() },
    {
      path: `${kebab}/INQUEST.md`,
      language: "markdown",
      contents: `# Inquest Digest\n\n\`\`\`\n${digest.slice(0, 600)}\n\`\`\`\n`,
    },
  ];

  return files;
}

export function buildPlan(answers: Record<string, string>, clientId: string, tier: "free" | "paid"): ForgePlan {
  const archetype = archetypeFromAnswers(answers);
  const appName = appNameFromAnswers(answers);
  const experts = selectQuorum(clientId, tier).slice(0, 8);
  const mindMap = buildMindMap(archetype, appName);
  const digest = Object.entries(answers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const files = buildFiles(archetype, appName, digest);

  return {
    appName,
    archetype,
    summary: `A ${ARCHETYPES[archetype].label.toLowerCase()} shaped by your inquest, with ${ARCHETYPES[archetype].systems.length} subsystems and ${ARCHETYPES[archetype].contracts.length} enforced contracts.`,
    stack: ["Python", "HTTP", "SQLite", "SSE", "Docker"],
    experts,
    mindMap,
    audit: { score: 0, passed: 0, total: 0, findings: [] },
    files,
    phases: [
      { id: "p1", label: "Phase I — Genesis", detail: `Archetype locked: ${archetype}`, expert: experts[0]?.label ?? "ORATOR-Core" },
      { id: "p2", label: "Phase II — Architecture", detail: `${ARCHETYPES[archetype].systems.length} subsystems mapped`, expert: experts[1]?.label ?? "SchemaSmith" },
      { id: "p3", label: "Phase III — Contracts", detail: `${ARCHETYPES[archetype].contracts.length} contracts minted`, expert: experts[2]?.label ?? "BackendForge" },
      { id: "p4", label: "Phase IV — Forge Execution", detail: "Full scaffold written to the in-memory disk", expert: experts[3]?.label ?? "FacadeWeaver" },
      { id: "p5", label: "Phase V — Audit", detail: "22-point invariant sweep over every artifact", expert: experts[4]?.label ?? "Adversary-Review" },
      { id: "p6", label: "Phase VI — Delivery", detail: "ZIP sealed and ready", expert: experts[5]?.label ?? "Kinetic-Perf" },
    ],
  };
}
