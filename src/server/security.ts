import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";

/**
 * Request authorization for the ORATOR cockpit server.
 *
 * DENY BY DEFAULT. Every /v1/* and /api/* route is classified below, and anything that is not explicitly listed falls
 * into the strict "cockpit" class, so a route added later is protected before anyone remembers to review it.
 *
 *   public   health check, static assets, signed one-tap approval links (/a/:id, authenticated by their HMAC)
 *   studio   visitor-facing generation routes: open, but rate limited and size capped
 *   cockpit  the operator's own surface (mission data, the lifecycle controls, chat over the ledger): needs an unlocked
 *            cockpit session, and a per-session CSRF token on anything that changes state
 *   bearer   the engine API for external agents and operators (/v1/operator, /v1/mcp, /v1/guard): needs a real key
 *   admin    tenant provisioning (/v1/admin): needs COMMANDER_ADMIN_TOKEN; disabled when it is not set
 *
 * There is no anonymous fallback to a default operator, and no default secret. When no cockpit token is configured a
 * random one is generated for this run and printed once to the server log.
 */

export const COCKPIT_COOKIE = "cmd_cockpit";
export const CSRF_HEADER = "x-csrf-token";

/** Secrets that were published in a public repository. They are refused outright, whatever else is configured. */
export const COMPROMISED_SECRETS: ReadonlySet<string> = new Set(["commander-sovereign-admin-token-2026"]);

type Headers = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);
const header = (headers: Headers, name: string): string | undefined => first(headers[name]);

// ---- configuration ----------------------------------------------------------------------------

export interface SecurityConfig {
  /** Undefined means the admin surface is disabled. There is no default. */
  adminToken?: string;
  /** What an operator types to unlock the cockpit. Generated per run when not configured. */
  cockpitToken: string;
  cockpitTokenGenerated: boolean;
  /** A generated token plus a loopback client in a non-production run may open a session without typing it. */
  autoLocalSession: boolean;
  sessionTtlMs: number;
  maxSessions: number;
  /** Requests per minute for each visitor, and across all visitors, on the open studio routes. */
  studioRpm: number;
  studioGlobalRpm: number;
}

export type Env = Record<string, string | undefined>;

function secret(name: string, value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (COMPROMISED_SECRETS.has(v)) {
    throw new Error(`${name} is a value that was published in a public repository and can no longer be used. Generate a new one with: openssl rand -hex 32`);
  }
  if (v.length < 16) throw new Error(`${name} must be at least 16 characters. Generate one with: openssl rand -hex 32`);
  return v;
}

function bounded(name: string, value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer from ${min} to ${max}, got "${value}"`);
  return n;
}

export function loadSecurityConfig(env: Env): SecurityConfig {
  const configured = secret("COMMANDER_COCKPIT_TOKEN", env.COMMANDER_COCKPIT_TOKEN);
  const cockpitToken = configured ?? randomBytes(24).toString("base64url");
  const generated = configured === undefined;
  return {
    adminToken: secret("COMMANDER_ADMIN_TOKEN", env.COMMANDER_ADMIN_TOKEN),
    cockpitToken,
    cockpitTokenGenerated: generated,
    // Convenience for `npm run dev` on your own machine only. An explicit token is always required, and so is production.
    autoLocalSession: generated && env.NODE_ENV !== "production",
    sessionTtlMs: bounded("COMMANDER_SESSION_HOURS", env.COMMANDER_SESSION_HOURS, 12, 1, 168) * 3_600_000,
    maxSessions: 200,
    studioRpm: bounded("COMMANDER_STUDIO_RPM", env.COMMANDER_STUDIO_RPM, 60, 1, 10_000),
    studioGlobalRpm: bounded("COMMANDER_STUDIO_GLOBAL_RPM", env.COMMANDER_STUDIO_GLOBAL_RPM, 600, 1, 100_000),
  };
}

// ---- small primitives -------------------------------------------------------------------------

/** Compares through a fixed-length digest, so neither the value nor its length leaks through timing. */
export function constantTimeEqual(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}

export function parseCookies(headerValue: string | undefined): Record<string, string> {
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  if (!headerValue) return out;
  for (const part of headerValue.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    if (key && !(key in out)) out[key] = part.slice(eq + 1).trim();
  }
  return out;
}

export function bearerToken(authorization: string | undefined): string | undefined {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
  return m?.[1];
}

// ---- route classification ---------------------------------------------------------------------

export type RouteClass = "public" | "studio" | "cockpit" | "bearer" | "admin";

/** When a path could be read two ways, the stricter reading wins. */
const STRICTNESS: Record<RouteClass, number> = { public: 0, studio: 1, cockpit: 2, bearer: 3, admin: 4 };

const STUDIO_ROUTES: ReadonlySet<string> = new Set(["GET /api/gemini/status", "POST /api/gemini/explore", "POST /api/gemini/cortex-deliberate"]);

function classifyNormalized(method: string, p: string): RouteClass {
  if (p === "/healthz") return "public";
  if (p === "/api/cockpit/session") return "public";
  if (/^\/a\/[a-z0-9_-]+(?:\/decide)?$/.test(p)) return "public";
  if (p === "/v1/admin" || p.startsWith("/v1/admin/")) return "admin";
  for (const prefix of ["/v1/operator", "/v1/mcp", "/v1/guard"]) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return "bearer";
  }
  if (STUDIO_ROUTES.has(`${method} ${p}`)) return "studio";
  if (p === "/v1" || p.startsWith("/v1/") || p === "/api" || p.startsWith("/api/")) return "cockpit";
  return "public";
}

/** Case, repeated slashes, dot segments and percent-encoding must not be a way around the table. */
function variants(raw: string): { paths: string[]; undecodable: boolean } {
  const candidates = [raw];
  let undecodable = false;
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    undecodable = true;
  }
  const paths = new Set<string>();
  for (const c of candidates) {
    const flat = c.replace(/\/{2,}/g, "/");
    paths.add(flat.toLowerCase());
    const resolved = path.posix.normalize(flat).toLowerCase();
    paths.add(resolved.length > 1 ? resolved.replace(/\/$/, "") : resolved);
    paths.add(flat.length > 1 ? flat.toLowerCase().replace(/\/$/, "") : flat);
  }
  return { paths: [...paths], undecodable };
}

export function classifyRoute(method: string, rawPath: string): RouteClass {
  const m = method.toUpperCase();
  const { paths, undecodable } = variants(rawPath);
  let strictest: RouteClass = undecodable ? "cockpit" : "public";
  for (const p of paths) {
    const c = classifyNormalized(m, p);
    if (STRICTNESS[c] > STRICTNESS[strictest]) strictest = c;
  }
  return strictest;
}

// ---- cockpit sessions -------------------------------------------------------------------------

export interface CockpitSession {
  id: string;
  csrf: string;
  expiresAt: number;
}

export class CockpitSessions {
  private readonly sessions = new Map<string, number>();
  private readonly secret = randomBytes(32);

  constructor(private readonly opts: { ttlMs: number; max: number; now?: () => number }) {}

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  /** The CSRF token is derived from the session id, so it is bound to exactly one session and never shared or broadcast. */
  csrfFor(id: string): string {
    return createHmac("sha256", this.secret).update(id).digest("base64url");
  }

  create(): CockpitSession {
    const now = this.now();
    for (const [id, exp] of this.sessions) if (exp <= now) this.sessions.delete(id);
    while (this.sessions.size >= this.opts.max) {
      const oldest = this.sessions.keys().next().value;
      if (oldest === undefined) break;
      this.sessions.delete(oldest);
    }
    const id = randomBytes(32).toString("base64url");
    const expiresAt = now + this.opts.ttlMs;
    this.sessions.set(id, expiresAt);
    return { id, csrf: this.csrfFor(id), expiresAt };
  }

  validate(id: string | undefined): CockpitSession | undefined {
    if (!id) return undefined;
    const expiresAt = this.sessions.get(id);
    if (expiresAt === undefined) return undefined;
    if (expiresAt <= this.now()) {
      this.sessions.delete(id);
      return undefined;
    }
    return { id, csrf: this.csrfFor(id), expiresAt };
  }

  fromCookie(cookieHeader: string | undefined): CockpitSession | undefined {
    return this.validate(parseCookies(cookieHeader)[COCKPIT_COOKIE]);
  }

  revoke(id: string): void {
    this.sessions.delete(id);
  }

  get size(): number {
    return this.sessions.size;
  }
}

/**
 * Cross-site frames (AI Studio previews the app inside one) do not receive SameSite=Strict/Lax cookies, so over HTTPS the
 * cookie is SameSite=None; Secure; Partitioned. That gives up the browser's built-in CSRF defence, which is replaced by
 * the per-session CSRF header required on every state-changing request. Plain HTTP (local development) stays Lax.
 */
export function buildSessionCookie(id: string, opts: { secure: boolean; maxAgeSec: number }): string {
  const attrs = [`${COCKPIT_COOKIE}=${id}`, "Path=/", "HttpOnly", `Max-Age=${opts.maxAgeSec}`];
  attrs.push(...(opts.secure ? ["SameSite=None", "Secure", "Partitioned"] : ["SameSite=Lax"]));
  return attrs.join("; ");
}

export function buildClearedCookie(secure: boolean): string {
  return buildSessionCookie("", { secure, maxAgeSec: 0 });
}

// ---- rate limiting ----------------------------------------------------------------------------

/** Blocks a client after too many failed unlock attempts inside a window. */
export class AttemptLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 5000,
  ) {}

  private recent(key: string): number[] {
    const cutoff = this.now() - this.windowMs;
    const list = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length === 0) this.failures.delete(key);
    else this.failures.set(key, list);
    return list;
  }

  /** Seconds the client must wait before trying again, or 0 if it may proceed. */
  retryAfterSec(key: string): number {
    const list = this.recent(key);
    if (list.length < this.max) return 0;
    return Math.max(1, Math.ceil((list[0]! + this.windowMs - this.now()) / 1000));
  }

  recordFailure(key: string): void {
    const list = this.recent(key);
    list.push(this.now());
    this.failures.delete(key);
    this.failures.set(key, list);
    while (this.failures.size > this.maxKeys) {
      const oldest = this.failures.keys().next().value;
      if (oldest === undefined) break;
      this.failures.delete(oldest);
    }
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}

/** At most `max` requests per key per window. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 5000,
  ) {}

  allow(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
    const now = this.now();
    const cutoff = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length >= this.max) {
      this.hits.delete(key);
      this.hits.set(key, list);
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((list[0]! + this.windowMs - now) / 1000)) };
    }
    list.push(now);
    this.hits.delete(key);
    this.hits.set(key, list);
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
    return { ok: true };
  }
}

// ---- the gate ---------------------------------------------------------------------------------

export interface AuthRequest {
  method: string;
  /** The raw request path, without the query string. */
  path: string;
  headers: Headers;
}

export interface Allowed {
  ok: true;
  via: RouteClass;
  /** Set for cockpit requests. */
  sessionId?: string;
  csrf?: string;
  /** The raw Authorization header for bearer requests. The caller authenticates it against the key store. */
  authorization?: string;
}

export interface Denied {
  ok: false;
  status: number;
  code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";
  message: string;
}

const STATE_CHANGING: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function authorizeRequest(req: AuthRequest, deps: { config: SecurityConfig; sessions: CockpitSessions }): Allowed | Denied {
  const method = req.method.toUpperCase();
  const cls = classifyRoute(method, req.path);

  switch (cls) {
    case "public":
    case "studio":
      return { ok: true, via: cls };

    case "admin": {
      if (!deps.config.adminToken) return { ok: false, status: 404, code: "NOT_FOUND", message: "Not found." };
      const token = bearerToken(header(req.headers, "authorization"));
      if (!token) return { ok: false, status: 401, code: "UNAUTHENTICATED", message: "Admin credential required." };
      if (!constantTimeEqual(token, deps.config.adminToken)) return { ok: false, status: 403, code: "FORBIDDEN", message: "Admin credential rejected." };
      return { ok: true, via: "admin" };
    }

    case "bearer": {
      const authorization = header(req.headers, "authorization");
      if (!bearerToken(authorization)) return { ok: false, status: 401, code: "UNAUTHENTICATED", message: "Credential required." };
      return { ok: true, via: "bearer", authorization };
    }

    case "cockpit": {
      const session = deps.sessions.fromCookie(header(req.headers, "cookie"));
      if (!session) return { ok: false, status: 401, code: "UNAUTHENTICATED", message: "Cockpit session required. Unlock the cockpit first." };
      if (STATE_CHANGING.has(method)) {
        const sent = header(req.headers, CSRF_HEADER);
        if (!sent || !constantTimeEqual(sent, session.csrf)) {
          return { ok: false, status: 403, code: "FORBIDDEN", message: "CSRF token missing or invalid." };
        }
      }
      return { ok: true, via: "cockpit", sessionId: session.id, csrf: session.csrf };
    }
  }
}

// ---- the unlock endpoint ----------------------------------------------------------------------

const LOOPBACK_ADDRESSES: ReadonlySet<string> = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);
const FORWARDING_HEADERS = ["x-forwarded-for", "x-forwarded-host", "forwarded", "x-real-ip", "via"] as const;

/**
 * True only for a browser on this machine talking to this machine directly: the socket is loopback, the Host header is a
 * loopback name (which defeats DNS rebinding), and no proxy has added forwarding headers.
 */
export function isLoopbackPeer(peer: { remoteAddress?: string; headers: Headers }): boolean {
  if (!peer.remoteAddress || !LOOPBACK_ADDRESSES.has(peer.remoteAddress)) return false;
  const host = (header(peer.headers, "host") ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!LOOPBACK_HOSTS.has(host)) return false;
  return FORWARDING_HEADERS.every((h) => header(peer.headers, h) === undefined);
}

export interface SessionRequest {
  method: string;
  body: unknown;
  headers: Headers;
  /** The client address used to count failed attempts. */
  clientKey: string;
  remoteAddress?: string;
  secureTransport: boolean;
}

export interface SessionResponse {
  status: number;
  body: Record<string, unknown>;
  setCookie?: string;
  retryAfterSec?: number;
}

export function handleSessionRequest(
  req: SessionRequest,
  deps: { config: SecurityConfig; sessions: CockpitSessions; limiter: AttemptLimiter },
): SessionResponse {
  const method = req.method.toUpperCase();
  const current = deps.sessions.fromCookie(header(req.headers, "cookie"));
  const autoAvailable = deps.config.autoLocalSession && isLoopbackPeer({ remoteAddress: req.remoteAddress, headers: req.headers });

  if (method === "GET") {
    if (current) return { status: 200, body: { authenticated: true, unlock_required: false, csrf_token: current.csrf } };
    return { status: 200, body: { authenticated: false, unlock_required: !autoAvailable, auto_available: autoAvailable } };
  }

  if (method === "DELETE") {
    if (current) deps.sessions.revoke(current.id);
    return { status: 200, body: { authenticated: false }, setCookie: buildClearedCookie(req.secureTransport) };
  }

  if (method !== "POST") return { status: 405, body: { error: "NOT_FOUND", message: "Method not allowed." } };

  const wait = deps.limiter.retryAfterSec(req.clientKey);
  if (wait > 0) {
    return { status: 429, body: { error: "THROTTLED", message: "Too many failed unlock attempts. Wait before trying again.", retry_after: wait }, retryAfterSec: wait };
  }

  const supplied = typeof (req.body as { token?: unknown } | null)?.token === "string" ? (req.body as { token: string }).token.slice(0, 256) : undefined;
  const granted = supplied === undefined ? autoAvailable : constantTimeEqual(supplied, deps.config.cockpitToken);
  if (!granted) {
    deps.limiter.recordFailure(req.clientKey);
    return { status: 401, body: { error: "UNAUTHENTICATED", message: "Unlock token rejected." } };
  }

  deps.limiter.reset(req.clientKey);
  const session = deps.sessions.create();
  return {
    status: 200,
    body: { authenticated: true, unlock_required: false, csrf_token: session.csrf },
    setCookie: buildSessionCookie(session.id, { secure: req.secureTransport, maxAgeSec: Math.floor(deps.config.sessionTtlMs / 1000) }),
  };
}

// ---- request size caps ------------------------------------------------------------------------

/** Byte caps for the routes that spend model quota. Anything larger is refused before it reaches the model. */
export function bodyCapFor(rawPath: string): number | undefined {
  const p = rawPath.toLowerCase();
  if (p.startsWith("/api/gemini/explore") || p.startsWith("/api/gemini/cortex-deliberate")) return 128 * 1024;
  if (p.startsWith("/api/gemini/") || p.startsWith("/api/orator/") || p.startsWith("/api/commander/chat")) return 64 * 1024;
  return undefined;
}
