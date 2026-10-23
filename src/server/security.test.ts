import { describe, expect, it } from "vitest";
import {
  AttemptLimiter,
  COCKPIT_COOKIE,
  COMPROMISED_SECRETS,
  CockpitSessions,
  RateLimiter,
  authorizeRequest,
  bearerToken,
  bodyCapFor,
  buildSessionCookie,
  classifyRoute,
  constantTimeEqual,
  handleSessionRequest,
  isLoopbackPeer,
  loadSecurityConfig,
  parseCookies,
  type SecurityConfig,
} from "./security";

class Clock {
  t = 1_700_000_000_000;
  now = (): number => this.t;
  advance(ms: number): void {
    this.t += ms;
  }
}

const ADMIN = "a".repeat(32);
const COCKPIT = "c".repeat(32);

const setup = (env: Record<string, string> = {}, clock = new Clock()) => {
  const config: SecurityConfig = loadSecurityConfig({ COMMANDER_ADMIN_TOKEN: ADMIN, COMMANDER_COCKPIT_TOKEN: COCKPIT, ...env });
  const sessions = new CockpitSessions({ ttlMs: config.sessionTtlMs, max: config.maxSessions, now: clock.now });
  const limiter = new AttemptLimiter(8, 600_000, clock.now);
  return { config, sessions, limiter, clock };
};

const cookieFor = (id: string): string => `${COCKPIT_COOKIE}=${id}`;

// =================================================================================================
describe("classifyRoute: every route is classified, and unknown ones are strict", () => {
  it.each([
    ["GET", "/healthz"],
    ["GET", "/"],
    ["GET", "/assets/index-abc.js"],
    ["GET", "/a/apr_AbC-123"],
    ["POST", "/a/apr_AbC-123/decide"],
    ["GET", "/api/cockpit/session"],
    ["POST", "/api/cockpit/session"],
    ["DELETE", "/api/cockpit/session"],
  ])("%s %s is public", (method, p) => {
    expect(classifyRoute(method, p)).toBe("public");
  });

  it.each([
    ["GET", "/api/gemini/status"],
    ["POST", "/api/gemini/explore"],
    ["POST", "/api/gemini/cortex-deliberate"],
  ])("%s %s is an open, rate-limited studio route", (method, p) => {
    expect(classifyRoute(method, p)).toBe("studio");
  });

  it("makes the studio exemption specific to the method as well as the path", () => {
    expect(classifyRoute("GET", "/api/gemini/explore")).toBe("cockpit");
    expect(classifyRoute("POST", "/api/gemini/status")).toBe("cockpit");
    expect(classifyRoute("PUT", "/api/gemini/explore")).toBe("cockpit");
  });

  it.each([
    ["GET", "/v1/missions"],
    ["GET", "/v1/missions/active"],
    ["GET", "/v1/events"],
    ["GET", "/v1/audit/verify"],
    ["POST", "/v1/sentinel/scan"],
    ["POST", "/v1/verifiers/verify"],
    ["GET", "/api/commander/overview"],
    ["POST", "/api/commander/reset"],
    ["POST", "/api/commander/decision"],
    ["POST", "/api/orator/chat"],
    ["POST", "/api/commander/chat"],
    ["POST", "/api/gemini/generate"],
  ])("%s %s needs an unlocked cockpit session", (method, p) => {
    expect(classifyRoute(method, p)).toBe("cockpit");
  });

  it("treats a route nobody has classified yet as cockpit-only, so new routes start protected", () => {
    expect(classifyRoute("GET", "/v1/anything-added-later")).toBe("cockpit");
    expect(classifyRoute("POST", "/api/not-written-yet")).toBe("cockpit");
    expect(classifyRoute("GET", "/v1")).toBe("cockpit");
    expect(classifyRoute("GET", "/api")).toBe("cockpit");
  });

  it.each([
    ["POST", "/v1/operator/missions"],
    ["GET", "/v1/operator/overview"],
    ["POST", "/v1/operator/keys"],
    ["DELETE", "/v1/operator/keys/key_1"],
    ["POST", "/v1/operator/approvals/apr_1/decision"],
    ["POST", "/v1/mcp"],
    ["POST", "/v1/guard/clearance"],
  ])("%s %s needs a real key", (method, p) => {
    expect(classifyRoute(method, p)).toBe("bearer");
  });

  it.each([
    ["POST", "/v1/admin/tenants"],
    ["POST", "/v1/admin/tenants/ten_1/credits"],
    ["GET", "/v1/admin/audit/verify"],
    ["GET", "/v1/admin"],
  ])("%s %s needs the admin token", (method, p) => {
    expect(classifyRoute(method, p)).toBe("admin");
  });

  describe("cannot be talked around with spelling tricks", () => {
    it.each([
      ["/V1/ADMIN/tenants", "admin"],
      ["//v1/admin/tenants", "admin"],
      ["/v1//admin//tenants", "admin"],
      ["/v1/admin/tenants/", "admin"],
      ["/a/../v1/admin/tenants", "admin"],
      ["/a/x/../../v1/admin/tenants", "admin"],
      ["/./v1/admin/tenants", "admin"],
      ["/%76%31/admin/tenants", "admin"],
      ["/v1/%61dmin/tenants", "admin"],
      ["/v1/admin%2Ftenants", "admin"],
      ["/V1/Operator/keys", "bearer"],
      ["/v1/%6Fperator/keys", "bearer"],
      ["/v1/mcp/", "bearer"],
      ["/api/%63ommander/reset", "cockpit"],
      ["/API/COMMANDER/RESET", "cockpit"],
      ["/a/x/../../api/commander/reset", "cockpit"],
      ["/a/apr_1/../../v1/missions", "cockpit"],
    ])("%s is %s, not public", (p, expected) => {
      expect(classifyRoute("POST", p)).toBe(expected);
    });

    it("refuses to treat an undecodable path as public", () => {
      expect(classifyRoute("GET", "/v1/%zz")).not.toBe("public");
      expect(classifyRoute("GET", "/%zz")).not.toBe("public");
    });

    it("does not let the signed-link exemption swallow other paths", () => {
      expect(classifyRoute("GET", "/a/x/y")).toBe("public"); // no route exists; serves the SPA shell
      expect(classifyRoute("GET", "/a/apr_1/decide/extra/../../../../v1/missions")).toBe("cockpit");
    });
  });
});

// =================================================================================================
describe("loadSecurityConfig: no default secrets", () => {
  it("leaves the admin surface disabled and generates a fresh cockpit token when nothing is configured", () => {
    const a = loadSecurityConfig({});
    const b = loadSecurityConfig({});
    expect(a.adminToken).toBeUndefined();
    expect(a.cockpitTokenGenerated).toBe(true);
    expect(a.cockpitToken.length).toBeGreaterThanOrEqual(24);
    expect(a.cockpitToken).not.toBe(b.cockpitToken);
  });

  it("allows the local convenience session only for a generated token outside production", () => {
    expect(loadSecurityConfig({}).autoLocalSession).toBe(true);
    expect(loadSecurityConfig({ NODE_ENV: "development" }).autoLocalSession).toBe(true);
    expect(loadSecurityConfig({ NODE_ENV: "production" }).autoLocalSession).toBe(false);
    expect(loadSecurityConfig({ COMMANDER_COCKPIT_TOKEN: COCKPIT }).autoLocalSession).toBe(false);
  });

  it("uses a configured token as given, trimmed", () => {
    const c = loadSecurityConfig({ COMMANDER_COCKPIT_TOKEN: `  ${COCKPIT}  `, COMMANDER_ADMIN_TOKEN: ADMIN });
    expect(c.cockpitToken).toBe(COCKPIT);
    expect(c.cockpitTokenGenerated).toBe(false);
    expect(c.adminToken).toBe(ADMIN);
  });

  it("treats blank values as unset, so a copied .env.example boots", () => {
    const c = loadSecurityConfig({ COMMANDER_ADMIN_TOKEN: "", COMMANDER_COCKPIT_TOKEN: "   ", COMMANDER_STUDIO_RPM: "", COMMANDER_SESSION_HOURS: "" });
    expect(c.adminToken).toBeUndefined();
    expect(c.cockpitTokenGenerated).toBe(true);
    expect(c.studioRpm).toBe(60);
  });

  it("refuses short secrets", () => {
    expect(() => loadSecurityConfig({ COMMANDER_ADMIN_TOKEN: "change-me" })).toThrowError(/COMMANDER_ADMIN_TOKEN must be at least 16/);
    expect(() => loadSecurityConfig({ COMMANDER_COCKPIT_TOKEN: "short" })).toThrowError(/COMMANDER_COCKPIT_TOKEN must be at least 16/);
  });

  it("refuses the admin token that was published in this repository, wherever it is used", () => {
    expect(COMPROMISED_SECRETS.has("commander-sovereign-admin-token-2026")).toBe(true);
    expect(() => loadSecurityConfig({ COMMANDER_ADMIN_TOKEN: "commander-sovereign-admin-token-2026" })).toThrowError(/published in a public repository/);
    expect(() => loadSecurityConfig({ COMMANDER_COCKPIT_TOKEN: "commander-sovereign-admin-token-2026" })).toThrowError(/published in a public repository/);
  });

  it("bounds the rate limits and session lifetime", () => {
    expect(loadSecurityConfig({ COMMANDER_STUDIO_RPM: "5", COMMANDER_SESSION_HOURS: "2" })).toMatchObject({ studioRpm: 5, sessionTtlMs: 2 * 3_600_000 });
    for (const bad of ["0", "-1", "1.5", "many", "10001"]) {
      expect(() => loadSecurityConfig({ COMMANDER_STUDIO_RPM: bad }), bad).toThrowError(/COMMANDER_STUDIO_RPM must be an integer/);
    }
    expect(() => loadSecurityConfig({ COMMANDER_SESSION_HOURS: "500" })).toThrowError(/COMMANDER_SESSION_HOURS/);
  });
});

// =================================================================================================
describe("primitives", () => {
  it("constantTimeEqual compares values of any length without throwing", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
    expect(constantTimeEqual("", "x")).toBe(false);
  });

  it("parseCookies reads pairs, ignores junk, keeps the first of a duplicate, and cannot be used for prototype tricks", () => {
    expect(parseCookies(`a=1; ${COCKPIT_COOKIE}=xyz; b=two=parts`)).toMatchObject({ a: "1", [COCKPIT_COOKIE]: "xyz", b: "two=parts" });
    expect(parseCookies("a=1; a=2").a).toBe("1");
    expect(parseCookies("novalue; =x; ;")).toEqual({});
    expect(parseCookies(undefined)).toEqual({});
    const c = parseCookies("__proto__=polluted; constructor=x");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(c)).toBeNull();
  });

  it("bearerToken accepts only a well-formed Bearer header", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("bearer abc123")).toBe("abc123");
    expect(bearerToken("Bearer   abc123  ")).toBe("abc123");
    for (const bad of [undefined, "", "Bearer", "Bearer ", "Basic abc", "Bearer a b", "abc123", "Token abc"]) {
      expect(bearerToken(bad), String(bad)).toBeUndefined();
    }
  });

  it("bodyCapFor caps the routes that spend model quota", () => {
    expect(bodyCapFor("/api/gemini/explore")).toBe(128 * 1024);
    expect(bodyCapFor("/api/gemini/cortex-deliberate")).toBe(128 * 1024);
    expect(bodyCapFor("/api/gemini/generate")).toBe(64 * 1024);
    expect(bodyCapFor("/api/orator/chat")).toBe(64 * 1024);
    expect(bodyCapFor("/api/commander/chat")).toBe(64 * 1024);
    expect(bodyCapFor("/API/GEMINI/GENERATE")).toBe(64 * 1024);
    expect(bodyCapFor("/v1/missions")).toBeUndefined();
  });
});

// =================================================================================================
describe("CockpitSessions", () => {
  it("issues unguessable ids and validates them until they expire", () => {
    const clock = new Clock();
    const s = new CockpitSessions({ ttlMs: 1000, max: 10, now: clock.now });
    const a = s.create();
    const b = s.create();
    expect(a.id).not.toBe(b.id);
    expect(a.id.length).toBeGreaterThanOrEqual(43);
    expect(s.validate(a.id)).toMatchObject({ id: a.id, csrf: a.csrf });
    clock.advance(999);
    expect(s.validate(a.id)).toBeDefined();
    clock.advance(1);
    expect(s.validate(a.id)).toBeUndefined();
    expect(s.size).toBe(1); // the expired one is dropped on first sight
  });

  it("rejects missing, unknown and malformed ids", () => {
    const s = new CockpitSessions({ ttlMs: 1000, max: 10 });
    for (const id of [undefined, "", "nope", "__proto__", "constructor", "../x"]) expect(s.validate(id), String(id)).toBeUndefined();
  });

  it("binds each CSRF token to its own session, and to this process", () => {
    const one = new CockpitSessions({ ttlMs: 1000, max: 10 });
    const a = one.create();
    const b = one.create();
    expect(a.csrf).not.toBe(b.csrf);
    expect(one.csrfFor(a.id)).toBe(a.csrf);
    const other = new CockpitSessions({ ttlMs: 1000, max: 10 });
    expect(other.csrfFor(a.id)).not.toBe(a.csrf);
  });

  it("revokes, and evicts the oldest when full", () => {
    const s = new CockpitSessions({ ttlMs: 60_000, max: 3 });
    const [a, b, c, d] = [s.create(), s.create(), s.create(), s.create()];
    expect(s.size).toBe(3);
    expect(s.validate(a!.id)).toBeUndefined(); // oldest went
    expect(s.validate(d!.id)).toBeDefined();
    s.revoke(b!.id);
    expect(s.validate(b!.id)).toBeUndefined();
    expect(s.validate(c!.id)).toBeDefined();
  });

  it("reads the session from a cookie header", () => {
    const s = new CockpitSessions({ ttlMs: 1000, max: 10 });
    const a = s.create();
    expect(s.fromCookie(`theme=dark; ${cookieFor(a.id)}`)?.id).toBe(a.id);
    expect(s.fromCookie("theme=dark")).toBeUndefined();
    expect(s.fromCookie(undefined)).toBeUndefined();
  });
});

describe("limiters", () => {
  it("AttemptLimiter blocks after the limit, reports how long to wait, and frees the client afterwards", () => {
    const clock = new Clock();
    const l = new AttemptLimiter(3, 60_000, clock.now);
    for (let i = 0; i < 3; i++) {
      expect(l.retryAfterSec("ip")).toBe(0);
      l.recordFailure("ip");
      clock.advance(1000);
    }
    expect(l.retryAfterSec("ip")).toBeGreaterThan(0);
    expect(l.retryAfterSec("other")).toBe(0);
    clock.advance(60_000);
    expect(l.retryAfterSec("ip")).toBe(0);
  });

  it("AttemptLimiter.reset clears a client, and its memory is bounded", () => {
    const l = new AttemptLimiter(1, 60_000, Date.now, 3);
    l.recordFailure("a");
    expect(l.retryAfterSec("a")).toBeGreaterThan(0);
    l.reset("a");
    expect(l.retryAfterSec("a")).toBe(0);
    for (const k of ["k1", "k2", "k3", "k4"]) l.recordFailure(k);
    expect(l.retryAfterSec("k1")).toBe(0); // evicted
    expect(l.retryAfterSec("k4")).toBeGreaterThan(0);
  });

  it("RateLimiter allows `max` per window per key", () => {
    const clock = new Clock();
    const l = new RateLimiter(2, 1000, clock.now);
    expect(l.allow("a")).toEqual({ ok: true });
    expect(l.allow("a")).toEqual({ ok: true });
    const third = l.allow("a");
    expect(third.ok).toBe(false);
    expect(third.ok === false && third.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(l.allow("b")).toEqual({ ok: true });
    clock.advance(1001);
    expect(l.allow("a")).toEqual({ ok: true });
  });

  it("RateLimiter does not credit a client for requests it made while blocked", () => {
    const clock = new Clock();
    const l = new RateLimiter(1, 1000, clock.now);
    l.allow("a");
    for (let i = 0; i < 50; i++) {
      clock.advance(10);
      expect(l.allow("a").ok).toBe(false);
    }
    clock.advance(600);
    expect(l.allow("a").ok).toBe(true);
  });
});

// =================================================================================================
describe("authorizeRequest", () => {
  const req = (method: string, path: string, headers: Record<string, string> = {}) => ({ method, path, headers });

  it("lets public and studio routes through without a credential", () => {
    const { config, sessions } = setup();
    for (const [m, p] of [["GET", "/healthz"], ["GET", "/"], ["POST", "/a/apr_1/decide"], ["POST", "/api/gemini/explore"]] as const) {
      expect(authorizeRequest(req(m, p), { config, sessions }), `${m} ${p}`).toMatchObject({ ok: true });
    }
  });

  describe("admin", () => {
    it("is disabled outright when no admin token is configured, whatever is presented", () => {
      const { config, sessions } = setup({ COMMANDER_ADMIN_TOKEN: "" });
      expect(config.adminToken).toBeUndefined();
      for (const auth of [undefined, "Bearer anything", `Bearer ${COCKPIT}`]) {
        const r = authorizeRequest(req("POST", "/v1/admin/tenants", auth ? { authorization: auth } : {}), { config, sessions });
        expect(r, String(auth)).toMatchObject({ ok: false, status: 404 });
      }
    });

    it("requires exactly the admin token", () => {
      const { config, sessions } = setup();
      const call = (auth?: string) => authorizeRequest(req("POST", "/v1/admin/tenants", auth ? { authorization: auth } : {}), { config, sessions });
      expect(call()).toMatchObject({ ok: false, status: 401, code: "UNAUTHENTICATED" });
      expect(call("Bearer wrong-token-value")).toMatchObject({ ok: false, status: 403, code: "FORBIDDEN" });
      expect(call(`Bearer ${COCKPIT}`)).toMatchObject({ ok: false, status: 403 }); // the cockpit token is not an admin credential
      expect(call(`Bearer ${ADMIN}`)).toMatchObject({ ok: true, via: "admin" });
    });

    it("is not opened by a cockpit session", () => {
      const { config, sessions } = setup();
      const s = sessions.create();
      expect(authorizeRequest(req("GET", "/v1/admin/audit/verify", { cookie: cookieFor(s.id) }), { config, sessions })).toMatchObject({ ok: false });
    });

    it("stays closed to every spelling of the path", () => {
      const { config, sessions } = setup();
      for (const p of ["/V1/ADMIN/tenants", "//v1/admin/tenants", "/v1/admin/tenants/", "/a/../v1/admin/tenants", "/%76%31/admin/tenants", "/v1/admin%2Ftenants"]) {
        expect(authorizeRequest(req("POST", p), { config, sessions }), p).toMatchObject({ ok: false });
      }
    });
  });

  describe("bearer routes", () => {
    it("require a Bearer credential, which the caller then checks against the key store", () => {
      const { config, sessions } = setup();
      expect(authorizeRequest(req("POST", "/v1/operator/missions"), { config, sessions })).toMatchObject({ ok: false, status: 401 });
      expect(authorizeRequest(req("POST", "/v1/mcp", { authorization: "Basic abc" }), { config, sessions })).toMatchObject({ ok: false, status: 401 });
      expect(authorizeRequest(req("POST", "/v1/guard/clearance", { authorization: "Bearer cmd_live_x" }), { config, sessions })).toEqual({
        ok: true,
        via: "bearer",
        authorization: "Bearer cmd_live_x",
      });
    });

    it("are not opened by a cockpit session or by the admin token", () => {
      const { config, sessions } = setup();
      const s = sessions.create();
      expect(authorizeRequest(req("POST", "/v1/operator/keys", { cookie: cookieFor(s.id), "x-csrf-token": s.csrf }), { config, sessions })).toMatchObject({ ok: false, status: 401 });
    });
  });

  describe("cockpit routes", () => {
    it("require an unlocked session", () => {
      const { config, sessions } = setup();
      expect(authorizeRequest(req("GET", "/v1/missions"), { config, sessions })).toMatchObject({ ok: false, status: 401 });
      expect(authorizeRequest(req("GET", "/v1/missions", { cookie: cookieFor("forged") }), { config, sessions })).toMatchObject({ ok: false, status: 401 });
      const s = sessions.create();
      expect(authorizeRequest(req("GET", "/v1/missions", { cookie: cookieFor(s.id) }), { config, sessions })).toMatchObject({ ok: true, via: "cockpit", sessionId: s.id, csrf: s.csrf });
    });

    it("are not opened by a bearer header, including the admin token", () => {
      const { config, sessions } = setup();
      for (const auth of [`Bearer ${ADMIN}`, `Bearer ${COCKPIT}`, "Bearer cmd_op_whatever"]) {
        expect(authorizeRequest(req("GET", "/v1/missions", { authorization: auth }), { config, sessions }), auth).toMatchObject({ ok: false, status: 401 });
      }
    });

    it("require the session's own CSRF token on anything that changes state", () => {
      const { config, sessions } = setup();
      const mine = sessions.create();
      const theirs = sessions.create();
      const call = (method: string, csrf?: string) =>
        authorizeRequest(req(method, "/api/commander/reset", { cookie: cookieFor(mine.id), ...(csrf ? { "x-csrf-token": csrf } : {}) }), { config, sessions });
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(call(method), method).toMatchObject({ ok: false, status: 403, code: "FORBIDDEN" });
        expect(call(method, "guess"), method).toMatchObject({ ok: false, status: 403 });
        expect(call(method, theirs.csrf), method).toMatchObject({ ok: false, status: 403 }); // another session's token
        expect(call(method, mine.csrf), method).toMatchObject({ ok: true });
      }
      expect(call("GET")).toMatchObject({ ok: true }); // reads need no CSRF token
    });

    it("stop working when the session expires", () => {
      const clock = new Clock();
      const { config, sessions } = setup({ COMMANDER_SESSION_HOURS: "1" }, clock);
      const s = sessions.create();
      expect(authorizeRequest(req("GET", "/v1/events", { cookie: cookieFor(s.id) }), { config, sessions })).toMatchObject({ ok: true });
      clock.advance(3_600_001);
      expect(authorizeRequest(req("GET", "/v1/events", { cookie: cookieFor(s.id) }), { config, sessions })).toMatchObject({ ok: false, status: 401 });
    });

    it("cover routes added later", () => {
      const { config, sessions } = setup();
      expect(authorizeRequest(req("POST", "/api/brand-new-route"), { config, sessions })).toMatchObject({ ok: false, status: 401 });
    });
  });
});

// =================================================================================================
describe("isLoopbackPeer", () => {
  const peer = (remoteAddress: string | undefined, headers: Record<string, string>) => ({ remoteAddress, headers });

  it.each([
    ["127.0.0.1", { host: "localhost:3000" }],
    ["::1", { host: "127.0.0.1:3000" }],
    ["::ffff:127.0.0.1", { host: "[::1]:3000" }],
    ["127.0.0.1", { host: "LOCALHOST" }],
  ])("accepts a browser on this machine: %s %j", (addr, headers) => {
    expect(isLoopbackPeer(peer(addr, headers))).toBe(true);
  });

  it.each([
    ["10.0.0.5", { host: "localhost:3000" }, "not a loopback socket"],
    ["127.0.0.1", { host: "evil.example:3000" }, "DNS rebinding: a loopback socket but a foreign Host"],
    ["127.0.0.1", { host: "localhost.evil.example" }, "look-alike host"],
    ["127.0.0.1", { host: "localhost:3000", "x-forwarded-for": "203.0.113.9" }, "behind a proxy"],
    ["127.0.0.1", { host: "localhost:3000", forwarded: "for=203.0.113.9" }, "behind a proxy (Forwarded)"],
    ["127.0.0.1", { host: "localhost:3000", "x-real-ip": "203.0.113.9" }, "behind a proxy (X-Real-IP)"],
    ["127.0.0.1", { host: "localhost:3000", via: "1.1 proxy" }, "behind a proxy (Via)"],
    ["127.0.0.1", {}, "no Host header"],
    [undefined, { host: "localhost" }, "unknown peer"],
  ])("rejects %s %j (%s)", (addr, headers, _why) => {
    expect(isLoopbackPeer(peer(addr, headers))).toBe(false);
  });
});

// =================================================================================================
describe("handleSessionRequest: the unlock endpoint", () => {
  const local = { host: "localhost:3000" };
  const call = (
    deps: ReturnType<typeof setup>,
    method: string,
    over: { body?: unknown; headers?: Record<string, string>; remoteAddress?: string; secure?: boolean; clientKey?: string } = {},
  ) =>
    handleSessionRequest(
      {
        method,
        body: over.body,
        headers: over.headers ?? {},
        clientKey: over.clientKey ?? "client-1",
        remoteAddress: over.remoteAddress ?? "203.0.113.7",
        secureTransport: over.secure ?? false,
      },
      deps,
    );

  it("reports a locked cockpit to a remote visitor", () => {
    const deps = setup();
    expect(call(deps, "GET")).toEqual({ status: 200, body: { authenticated: false, unlock_required: true, auto_available: false } });
  });

  describe("the local convenience session", () => {
    const dev = () => setup({ COMMANDER_COCKPIT_TOKEN: "" });

    it("is offered to a browser on this machine when the token was generated", () => {
      const deps = dev();
      expect(call(deps, "GET", { remoteAddress: "127.0.0.1", headers: local }).body).toMatchObject({ unlock_required: false, auto_available: true });
      const granted = call(deps, "POST", { remoteAddress: "127.0.0.1", headers: local, body: {} });
      expect(granted.status).toBe(200);
      expect(granted.setCookie).toContain(COCKPIT_COOKIE);
    });

    it.each([
      ["a remote peer", { remoteAddress: "203.0.113.7", headers: local }],
      ["a rebinding Host", { remoteAddress: "127.0.0.1", headers: { host: "evil.example" } }],
      ["a proxied request", { remoteAddress: "127.0.0.1", headers: { ...local, "x-forwarded-for": "203.0.113.7" } }],
    ])("is refused for %s", (_name, over) => {
      const deps = dev();
      expect(call(deps, "GET", over).body).toMatchObject({ unlock_required: true, auto_available: false });
      expect(call(deps, "POST", { ...over, body: {} }).status).toBe(401);
    });

    it("is never offered in production, or when an explicit token is configured", () => {
      for (const deps of [setup({ COMMANDER_COCKPIT_TOKEN: "", NODE_ENV: "production" }), setup()]) {
        expect(call(deps, "GET", { remoteAddress: "127.0.0.1", headers: local }).body).toMatchObject({ unlock_required: true });
        expect(call(deps, "POST", { remoteAddress: "127.0.0.1", headers: local, body: {} }).status).toBe(401);
      }
    });

    it("does not apply when a (wrong) token is supplied", () => {
      const deps = dev();
      expect(call(deps, "POST", { remoteAddress: "127.0.0.1", headers: local, body: { token: "nope" } }).status).toBe(401);
    });
  });

  describe("unlocking with the token", () => {
    it("opens a session, sets a hardened cookie, and returns the session's CSRF token", () => {
      const deps = setup();
      const r = call(deps, "POST", { body: { token: COCKPIT } });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ authenticated: true, unlock_required: false });
      expect(typeof r.body.csrf_token).toBe("string");
      expect(r.setCookie).toMatch(/HttpOnly/);
      expect(r.setCookie).toContain("Path=/");
      expect(r.setCookie).toContain(`Max-Age=${12 * 3600}`);
      expect(r.setCookie).not.toContain("Secure");
      expect(r.setCookie).toContain("SameSite=Lax");
    });

    it("uses SameSite=None; Secure; Partitioned over HTTPS so the cookie works inside a cross-site preview frame", () => {
      const deps = setup();
      const r = call(deps, "POST", { body: { token: COCKPIT }, secure: true });
      expect(r.setCookie).toContain("SameSite=None");
      expect(r.setCookie).toContain("Secure");
      expect(r.setCookie).toContain("Partitioned");
      expect(r.setCookie).toContain("HttpOnly");
    });

    it("recognises the session afterwards, with the same CSRF token", () => {
      const deps = setup();
      const granted = call(deps, "POST", { body: { token: COCKPIT } });
      const id = /cmd_cockpit=([^;]+)/.exec(granted.setCookie!)![1]!;
      const again = call(deps, "GET", { headers: { cookie: cookieFor(id) } });
      expect(again.body).toEqual({ authenticated: true, unlock_required: false, csrf_token: granted.body.csrf_token });
    });

    it("rejects a wrong or missing token, and never leaks which part was wrong", () => {
      const deps = setup();
      for (const body of [{ token: "nope" }, { token: "" }, { token: COCKPIT.slice(0, -1) }, { token: `${COCKPIT}x` }, {}, undefined, null, "string", { token: 123 }, { token: { $ne: "" } }, { token: [COCKPIT] }]) {
        const r = call(deps, "POST", { body, clientKey: `k-${JSON.stringify(body)}` });
        expect(r.status, JSON.stringify(body)).toBe(401);
        expect(r.setCookie).toBeUndefined();
        expect(JSON.stringify(r.body)).not.toContain(COCKPIT);
      }
    });

    it("tolerates an enormous token without a crash or a match", () => {
      const deps = setup();
      expect(call(deps, "POST", { body: { token: "x".repeat(1_000_000) } }).status).toBe(401);
      expect(call(deps, "POST", { body: { token: `${COCKPIT}${"x".repeat(1000)}` } }).status).toBe(401);
    });
  });

  describe("guessing", () => {
    it("locks a client out after repeated failures, even for the right token, until the window passes", () => {
      const clock = new Clock();
      const deps = setup({}, clock);
      for (let i = 0; i < 8; i++) expect(call(deps, "POST", { body: { token: `wrong-${i}` } }).status).toBe(401);
      const blocked = call(deps, "POST", { body: { token: COCKPIT } });
      expect(blocked.status).toBe(429);
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
      expect(blocked.setCookie).toBeUndefined();
      expect(call(deps, "POST", { body: { token: COCKPIT }, clientKey: "someone-else" }).status).toBe(200);
      clock.advance(600_001);
      expect(call(deps, "POST", { body: { token: COCKPIT } }).status).toBe(200);
    });

    it("forgives earlier failures after a success", () => {
      const deps = setup();
      for (let i = 0; i < 7; i++) call(deps, "POST", { body: { token: "wrong" } });
      expect(call(deps, "POST", { body: { token: COCKPIT } }).status).toBe(200);
      for (let i = 0; i < 7; i++) expect(call(deps, "POST", { body: { token: "wrong" } }).status).toBe(401);
    });
  });

  it("logs out: revokes the session and clears the cookie", () => {
    const deps = setup();
    const granted = call(deps, "POST", { body: { token: COCKPIT } });
    const id = /cmd_cockpit=([^;]+)/.exec(granted.setCookie!)![1]!;
    const r = call(deps, "DELETE", { headers: { cookie: cookieFor(id) } });
    expect(r.status).toBe(200);
    expect(r.setCookie).toContain("Max-Age=0");
    expect(deps.sessions.validate(id)).toBeUndefined();
  });

  it("allows only GET, POST and DELETE", () => {
    const deps = setup();
    for (const m of ["PUT", "PATCH", "OPTIONS"]) expect(call(deps, m).status, m).toBe(405);
  });
});

describe("buildSessionCookie", () => {
  it("is HttpOnly in both modes, and never carries a Domain that would widen its reach", () => {
    for (const secure of [true, false]) {
      const c = buildSessionCookie("abc", { secure, maxAgeSec: 60 });
      expect(c).toMatch(/^cmd_cockpit=abc; Path=\/; HttpOnly; Max-Age=60; SameSite=/);
      expect(c).not.toMatch(/Domain=/i);
    }
  });
});
