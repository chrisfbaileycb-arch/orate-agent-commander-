# Environment Variables (ORATOR.AI)

Real keys are **never** committed or stored in the browser. Copy this template into a local `.env`
(ignored by git) if you want live multi-model routing; without keys the forge runs in deterministic
demo mode with full template generation, audit, and ZIP delivery.

```bash
# Unified multi-model router (recommended): https://openrouter.ai/keys
OPENROUTER_API_KEY=

# Direct provider fallbacks (optional)
OPENAI_API_KEY=
GEMINI_API_KEY=
```

Legacy Python server (optional): reads the same variable names via `os.getenv` at startup.

## Rules

1. Keys live only in the platform's **Settings → Environment** (sandbox) or your local `.env`.
2. Never paste keys into chat, source files, or the browser UI — the app redacts credential-shaped
   strings at every input boundary as defense-in-depth.
3. In production, set keys with `freebuff-deploy env set` (never in the repo).
