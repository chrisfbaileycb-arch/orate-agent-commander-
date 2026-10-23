# ORATOR.AI // THE AUTONOMOUS SOFTWARE FORGE

> **A closed-loop digital manufacturing appliance.** Converse with the Orator through a
> 15-question inquest, direct a 16-expert mixture-of-experts quorum through the forge phases,
> and receive a production-shaped software blueprint — but only after the 22-point invariant
> audit opens the gate. The dossier then previews in a jailed sandbox and seals into a
> deterministic ZIP before the hour turns.

Runs fully client-side in deterministic demo mode. Optional live multi-model routing is
server-side only — keys never reach the browser.

Every forged blueprint ships a complete, auditable scaffold: `README.md`, `SPEC.md`
(ground truth), `openapi.json`, `schema.sql` + `seed.sql`, `contracts.py`, `auth.py`,
`server/routes.py`, a themed `client/`, pytest + Playwright test harnesses, `run.sh`,
multi-stage `Dockerfile` + `docker-compose.yml`, and an MIT `LICENSE`. All server/API
timestamps are strict ISO-8601 UTC.

---

## The Experience

1. **Orb of the Orator** — a WebGL iridescent plasma sphere presides over the sanctum: swirling
   cyan/pearl/gold bands, fresnel rim glow, orbital HUD rings, and a breathing bloom halo.
   Interaction is the special event: the orb wakes on approach, ripples where you touch,
   surges with every forge phase, and answers a strike with a wake line. Ambient pearlescent
   plasma drifts behind every screen.
2. **The 15-Question Inquest with the Orator** — the primary event. The orb stays
   front-and-center while it conducts the conversation in speech bubbles: speak, type, tap
   quick chips, attach documents/files/images (video uploads are blocked), or connect a
   repository in read-only mode (no push, no write, no remote mutation) for contextual
   ingestion. The orb pulses through five phases (Genesis → Architecture → Backend →
   Interface → Operations) and acknowledges every answer before asking the next.
3. **Build Director Deck** — *you* direct the build: approve each phase, let auto-run take the
   watch, or redirect experts mid-run (`⟲ REDIRECT` reassigns the phase to another quorum
   member). Every decision is journaled to the live build log, and a mini orb pulses with the
   phase energy.
4. **Final Verification Gate** — after the forge finishes, the real 22-probe invariant engine
   (the same suite as `audit_engine.py`, ported to TS) evaluates the in-memory generated
   scaffold **plus** the live client source before anything renders. Each probe genuinely
   inspects artifacts — README/SPEC depth, OpenAPI 3.1, SQL DDL (tables/indexes/FKs),
   layered structure, API route wiring, error resilience, constant-time auth, SQL-injection
   and hardcoded-secret scans, zero-disk guarantee, branding tokens, meta tags, Playwright
   harness, Docker + compose packaging, ISO-8601 time handling, license, privacy, seeds,
   and test modules (pytest and Vitest layouts both recognized). The gate can and will
   hold if a probe fails; a complete blueprint clears 22/22 with a 100% composite.
5. **Interactive Mind Map** — radial graph of your systems and contracts with photon energy
   packets in transit and hover tooltips per node.
6. **Backend Skill Codex** — a ranked backend playbook library (Prisma schema craft,
   type-safe data access, Postgres doctrine, API gateway discipline, domain modeling, TDD,
   triage, architecture improvement, cloud deployment, observability) distilled from the
   [best-skills](https://github.com/chrisfbaileycb-arch/best-skills) Top-100 rankings and seated
   at the exact forge phase it serves (`src/lib/skills.ts`).
7. **MCP Tool Bench** — a curated catalog of Model Context Protocol servers for backend work
   (GitHub, Playwright, Context7, Supabase, Neon, AWS/GCP/Azure/Cloudflare, E2B/Riza sandboxes,
   Auth0, Snyk, Stripe, Sentry, Pipedream, Zapier…), distilled from the
   [AgenticSkills MCP directory](https://agenticskills.io/mcp) with trust tiers, transports, and
   ready-to-paste `mcp.json` connect snippets (`src/lib/mcp.ts`). Servers are seated per phase
   and reported in the build log.
8. **Voice & Resonance** — the Orator speaks and listens: local speech synthesis reads inquest
   questions and announces the sealed blueprint, speech recognition accepts spoken answers
   (🎙 SAY IT), and a WebAudio engine synthesizes the forge's voice — crystal orb strikes,
   rising phase swells, completion chimes, and an ambient drone that follows build energy.
   All audio is generated in-browser; no assets, no uploads.
9. **Velvet Rope Execution** — live `FORGE CAPACITY` telemetry, intermittent scarcity alerts,
   appointment-slot booking, and the $99 charter gate after 3 practice builds.

## Security Model (adapted from the ECC agent-skills catalog)

- **No hardcoded secrets.** A repo-wide scan confirms zero key literals; the legacy Python
  router reads `OPENAI_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` via `os.getenv`.
- **Keys stay out of the browser.** The React app has no secret surface; live routing keys would
  belong exclusively to a server-side process or platform environment (see
  [docs/ENV_SETUP.md](docs/ENV_SETUP.md)). `.env*` files are git-ignored.
- **Input validation at the boundary.** Every inquest answer is sanitized (`src/lib/security.ts`):
  control characters stripped, length-capped (200/600 chars), normalized.
- **Credential redaction.** Anything shaped like `sk-…`, `sk-or-…`, `AIza…`, `ghp_…`, or a JWT is
  redacted to `[REDACTED]` before display or persistence — defense-in-depth against paste leaks.
- **Jailed preview.** The blueprint sandbox renders with `sandbox=""` (no scripts, no host
  access) and `srcDoc`, so generated code can never reach the parent page.
- **Deterministic ZIP** built in-memory (STORE method, fixed timestamps) — reproducible,
  checksum-friendly, zero-disk until you click download.

## Repository Structure

```
├── index.html                  # App shell, fonts, favicon
├── src/
│   ├── App.tsx                 # Session state machine + deck routing + modals
│   ├── main.tsx                # React entrypoint
│   ├── index.css               # Deep Abyss theme, HUD panels, forge buttons
│   ├── canvas/
│   │   ├── orb.ts             # WebGL orb engine (iridescent plasma sphere)
│   │   ├── plasma.ts          # Pearlescent plasma sanctum engine
│   │   └── MindMapCanvas.ts    # Mind map renderer (photons, hit-testing)
│   ├── components/
│   │   ├── Landing.tsx         # Inquest-focal hero + quality-gate pipeline
│   │   ├── OrbOfTheOrator.tsx  # The WebGL orb centerpiece (strike interaction)
│   │   ├── McpBenchModal.tsx   # MCP tool bench catalog modal
│   │   ├── VoiceConduit.tsx    # Voice/resonance toggle chip
│   │   ├── Inquest.tsx         # Conversational 15-question inquest (chat)
│   │   ├── VerificationGate.tsx # Final 22-point audit gate before delivery
│   │   ├── ForgeDirector.tsx   # Build director deck (approve/redirect/auto-run)
│   │   ├── Deliverables.tsx    # Mind map, audit, blueprint, sandbox, ZIP
│   │   ├── HudChrome.tsx       # Capacity telemetry + scarcity toasts
│   │   ├── BookingModal.tsx    # Velvet rope appointment slots
│   │   ├── CharterModal.tsx    # $99 charter (demo gate)
│   │   └── Modal.tsx           # Shared modal shell
│   └── lib/
│       ├── security.ts         # ECC-informed hardening layer
│       ├── session.ts          # Allowance, charter, booking state
│       ├── inquest.ts          # 15-question catalog
│       ├── router.ts           # 16-expert MoE roster + rotation
│       ├── skills.ts           # Backend skill codex (best-skills Top-100 distillation)
│       ├── mcp.ts              # MCP tool bench (AgenticSkills directory distillation)
│       ├── voice.ts            # Speech synthesis, recognition, WebAudio forge sounds
│       ├── generator.ts        # Deterministic blueprint generator
│       ├── audit.ts            # 22-point audit suite
│       ├── telemetry.ts        # Capacity + scarcity loop
│       └── zip.ts              # In-browser ZIP packer
├── model_router.py             # Legacy Python router (os.getenv keys only)
├── server.py                   # Legacy ephemeral server (optional)
└── docs/ENV_SETUP.md           # Key management guide
```

## Quick Start

```bash
npm install        # or: bun install
npm run dev        # vite dev server on 0.0.0.0:$PORT (default 8080)
npm run build      # typecheck + static build to dist/
```

## Live Routing (Optional)

The demo forge is fully deterministic. To attach real model routing later, run a small
server-side worker holding `OPENROUTER_API_KEY` (recommended unified router — one key, hundreds
of models) and stream completions into the Director deck. See [docs/ENV_SETUP.md](docs/ENV_SETUP.md).

---

*Practice builds are local evaluations. The charter gate is a demo flow — no real payments are
processed. Verified with the [ECC](https://github.com/affaan-m/ECC) security-review and
coding-standards skills.*
