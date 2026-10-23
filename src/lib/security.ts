/**
 * Security layer — practices adapted from the ECC agent-skills catalog
 * (security-review, coding-standards, frontend-patterns).
 *
 * Rules enforced here:
 *  1. Secrets live only in environment variables, never in source or localStorage.
 *  2. Every user-supplied string is validated and length-capped at the boundary.
 *  3. Anything resembling a credential is redacted before display or persistence.
 */

/** Upper bounds for inquest answers — validated at the input boundary. */
export const INPUT_LIMITS = {
  short: 200,
  long: 600,
} as const;

const KEY_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9_-]{16,}/g, // OpenAI / OpenRouter style
  /\bsk-or-[a-zA-Z0-9_-]{8,}/g, // OpenRouter prefixed
  /\bAIza[A-Za-z0-9_-]{20,}/g, // Google API keys
  /\bghp_[A-Za-z0-9]{20,}/g, // GitHub tokens
  /\beyJ[A-Za-z0-9_-]{20,}/g, // JWTs
];

function redactMatches(text: string, patterns: RegExp[]): string {
  return patterns.reduce((acc, rx) => acc.replace(rx, "[REDACTED]"), text);
}

/** Redact anything credential-shaped before it is displayed or stored. */
export function redactSecrets(text: string): string {
  return redactMatches(text, KEY_PATTERNS);
}

/** Validate + cap a user answer; rejects control characters. */
export function sanitizeAnswer(raw: string, limit: number = INPUT_LIMITS.long): string {
  const stripped = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return redactSecrets(stripped.trim().slice(0, limit));
}

/** Validate a booking slot ISO string (server-independent shape check). */
export function isValidSlotISO(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

/** Fail-fast env check for optional live AI routing (never logs values). */
export function assertLiveRouterEnv(): { ok: boolean; missing: string[] } {
  const required = ["GEMINI_API_KEY"];
  const missing = required.filter((k) => !import.meta.env[`VITE_${k}`] && k === "GEMINI_API_KEY");
  return { ok: missing.length === 0, missing };
}
