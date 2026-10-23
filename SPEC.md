# ORATOR.AI — Product Specification (Ground Truth)

> Immutable architecture contract for the Orator Autonomous Software Forge.
> The 15-question conversational inquest, 16-expert MoE rotation, and the
> 22-point invariant audit all trace back to this document. Changes here
> require an explicit version bump and an append-only migration note.

## 1. Product Core

ORATOR.AI is an autonomous software forge: a conversational director (the
Orator) that interviews a builder through a 15-question inquest, routes the
answers through a deterministic mixture-of-experts quorum, manufactures an
in-memory blueprint, runs a 22-point invariant audit, and delivers a sealed
ZIP dossier — without ever touching the host filesystem.

### Entities

| Entity | Purpose | Invariants |
| --- | --- | --- |
| `ForgeSession` | A single builder run | One active status; answers sealed on the 15th question |
| `InquestAnswer` | One question/response pair | Keyed by `q1..q15`; sanitized and redacted at the boundary |
| `IngestItem` | Attachment or connected repo | Document/image/code only — video is refused; repos are read-only |
| `Blueprint` | The manufactured artifact set | Deterministic replay from identical answers |
| `AuditFinding` | One of the 22 probe verdicts | PASSED / FAILED / SKIPPED with score and evidence detail |
| `BookingSlot` | Charter booking record | ISO-8601 validated at intake |

## 2. Runtime Architecture

- **Client layer** (`src/`, `client/`) — React/Vite experience: the orb stage,
  the conversational inquest dock, the forge director deck, the verification
  gate, and the delivery dossier.
- **Server layer** (`server.py`, `server/routes.py`) — HTTP + SSE engine;
  env-keyed multi-model router; in-memory manufacturing with zero disk writes.
- **Database layer** (`schema.sql`) — relational DDL with foreign keys and
  indexes; deterministic seed fixtures in `seed.sql`.
- **Audit layer** (`audit_engine.py`, `src/lib/audit.ts`) — the 22-probe
  invariant suite runs over the in-memory file map before anything renders.

### API Contract (routes)

The appliance exposes the following documented routes:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness + telemetry snapshot |
| GET | `/api/state` | Session + allowance state |
| GET | `/api/models` | Configured model roster |
| GET | `/api/knowledge` | Skill-codex repositories |
| GET | `/api/stream` | SSE rotation telemetry stream |
| POST | `/api/upload-intake` | Attachment/repo ingest (documents, images, code) |
| POST | `/api/interrogate` | Anti-slop evaluation of a proposal |
| POST | `/api/audit` | Run the 22-point audit over the latest manufactured files |
| POST | `/api/manufacture-sim` | Deterministic package manufacturing + audit |
| GET | `/api/stream-manufacture` | SSE forge pipeline (8 skills) |
| POST | `/api/download-zip` | Sealed ZIP delivery |
| POST | `/api/mark-paid` | Charter activation |

Every response carries an ISO-8601 UTC `timestamp`. All mutations are
idempotent; all SQL is parameterized; all secrets come from environment
variables and never appear in artifacts.

## 3. Security Boundary

- Secrets live only in server environment variables (`OPENROUTER_API_KEY`,
  `OPENAI_API_KEY`, `GEMINI_API_KEY`) — never in source, browser bundles, or
  localStorage.
- Credential-shaped strings are redacted at every input boundary before
  display or persistence.
- Repo connects are strictly read-only: no push, write, or remote mutation
  capability is offered or implemented.
- Video uploads are explicitly refused at the intake boundary.

## 4. Delivery & Operations

Single-command run via `start_orchestrator.sh` (or `bun run dev` for the
client), container packaging via the multi-stage `Dockerfile` and
`docker-compose.yml`. The forge itself is zero-disk: artifacts are sealed
in-memory and delivered as a checksummed ZIP.
