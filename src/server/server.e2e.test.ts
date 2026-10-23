import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import nodeHttp from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The real server.ts, started as a subprocess and attacked over HTTP. These are the exact holes the first version had:
 * anonymous operator authority, open /v1/admin, a command-running witness reachable by anyone, a hardcoded admin token,
 * unauthenticated Gemini and ledger routes, and a CSRF token broadcast to every client.
 */

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const ADMIN = "a".repeat(32);
const COCKPIT = "c".repeat(32);
const OLD_DEFAULT_ADMIN_TOKEN = "commander-sovereign-admin-token-2026";

// ---- harness ----------------------------------------------------------------------------------

async function freePort(): Promise<number> {
  const s = net.createServer();
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  const { port } = s.address() as net.AddressInfo;
  await new Promise<void>((resolve) => s.close(() => resolve()));
  return port;
}

interface Srv {
  url: string;
  port: number;
  log: () => string;
  stop: () => Promise<void>;
}

type EnvOverrides = Record<string, string | undefined>;

function childEnv(port: number, overrides: EnvOverrides): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    PORT: String(port),
    HOST: "127.0.0.1",
    COMMANDER_ADMIN_TOKEN: ADMIN,
    COMMANDER_COCKPIT_TOKEN: COCKPIT,
    ...overrides,
  };
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  return env as NodeJS.ProcessEnv;
}

const running: Srv[] = [];

async function startServer(overrides: EnvOverrides = {}): Promise<Srv> {
  const port = await freePort();
  const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], { cwd: ROOT, env: childEnv(port, overrides), stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout!.on("data", (c: Buffer) => (out += c));
  child.stderr!.on("data", (c: Buffer) => (out += c));

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start\n${out}`)), 90_000);
    const poll = setInterval(() => {
      if (out.includes("[WITNESS]")) {
        // The last line of the startup banner, so every startup assertion below can read the log without racing it.
        clearTimeout(timer);
        clearInterval(poll);
        resolve();
      }
    }, 50);
    child.on("exit", (code) => {
      clearTimeout(timer);
      clearInterval(poll);
      reject(new Error(`server exited early (${code})\n${out}`));
    });
  });

  const srv: Srv = {
    url: `http://127.0.0.1:${port}`,
    port,
    log: () => out,
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill("SIGKILL");
      }),
  };
  running.push(srv);
  return srv;
}

/** Starts a server that is expected to REFUSE to start, and returns why. */
function startExpectingFailure(overrides: EnvOverrides): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    void freePort().then((port) => {
      const child: ChildProcess = spawn(process.execPath, ["--import", "tsx", "server.ts"], { cwd: ROOT, env: childEnv(port, overrides), stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout!.on("data", (c: Buffer) => (out += c));
      child.stderr!.on("data", (c: Buffer) => (out += c));
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`expected the server to refuse to start, but it kept running\n${out}`));
      }, 60_000);
      child.on("exit", (code) => {
        clearTimeout(timer);
        resolve({ code, output: out });
      });
    });
  });
}

afterAll(async () => {
  await Promise.all(running.map((s) => s.stop()));
});

interface Res {
  status: number;
  json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  text: string;
  headers: Headers;
}

interface Opts {
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
  cookie?: string;
  csrf?: string;
  bearer?: string;
}

async function http(srv: Srv, method: string, p: string, o: Opts = {}): Promise<Res> {
  const headers: Record<string, string> = { ...o.headers };
  if (o.cookie) headers.cookie = o.cookie;
  if (o.csrf) headers["x-csrf-token"] = o.csrf;
  if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
  let body: string | undefined = o.rawBody;
  if (o.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(o.body);
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(srv.url + p, { method, headers, body });
  const text = await res.text();
  let json: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text, headers: res.headers };
}

interface RawOpts {
  host?: string;
  headers?: Record<string, string>;
}

/**
 * An HTTP request with an exact request-target and Host header. fetch would normalize "/a/../v1" to "/v1" and silently
 * ignore a Host override, so it cannot send either of the things these tests need to.
 */
function rawRequest(srv: Srv, method: string, target: string, o: RawOpts = {}): Promise<{ status: number; json: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  return new Promise((resolve, reject) => {
    const extra = Object.entries(o.headers ?? {}).map(([k, v]) => `${k}: ${v}\r\n`).join("");
    const sock = net.connect(srv.port, "127.0.0.1", () => {
      sock.write(`${method} ${target} HTTP/1.1\r\nHost: ${o.host ?? `127.0.0.1:${srv.port}`}\r\n${extra}Content-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}`);
    });
    let buf = "";
    sock.on("data", (d) => (buf += d.toString("latin1")));
    sock.on("end", () => {
      let json: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
      try {
        json = JSON.parse(buf.slice(buf.indexOf("\r\n\r\n") + 4));
      } catch {
        /* not json */
      }
      resolve({ status: Number(/^HTTP\/1\.1 (\d{3})/.exec(buf)?.[1] ?? 0), json });
    });
    sock.on("error", reject);
  });
}

const rawStatus = async (srv: Srv, method: string, target: string): Promise<number> => (await rawRequest(srv, method, target)).status;

interface Unlocked {
  cookie: string;
  csrf: string;
  setCookie: string;
}

async function unlock(srv: Srv, token = COCKPIT, headers: Record<string, string> = {}): Promise<Unlocked> {
  const res = await http(srv, "POST", "/api/cockpit/session", { body: { token }, headers });
  expect(res.status, res.text).toBe(200);
  const setCookie = res.headers.getSetCookie()[0]!;
  return { cookie: setCookie.split(";")[0]!, csrf: res.json.csrf_token as string, setCookie };
}

function sseReader(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  return {
    async next(ms = 15_000): Promise<string> {
      const end = Date.now() + ms;
      for (;;) {
        let i = buf.indexOf("\n\n");
        while (i >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (line) return line.slice(6);
          i = buf.indexOf("\n\n");
        }
        const left = end - Date.now();
        if (left <= 0) throw new Error("timed out waiting for an event");
        const r = await Promise.race([reader.read(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timed out waiting for an event")), left))]);
        if (r.done) throw new Error("the stream ended");
        buf += dec.decode(r.value, { stream: true });
      }
    },
    close: () => reader.cancel().catch(() => undefined),
  };
}

async function mcpClient(srv: Srv, key: string): Promise<Client> {
  const client = new Client({ name: "e2e", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${srv.url}/v1/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
  return client;
}

const structured = (r: unknown): any => (r as { structuredContent: unknown }).structuredContent; // eslint-disable-line @typescript-eslint/no-explicit-any

async function newTenant(srv: Srv, credits = 1000) {
  const t = await http(srv, "POST", "/v1/admin/tenants", { bearer: ADMIN, body: { name: "e2e", credits } });
  expect(t.status, t.text).toBe(201);
  const op = t.json.operator_key as string;
  const w = await http(srv, "POST", "/v1/operator/keys", { bearer: op, body: { label: "worker" } });
  expect(w.status, w.text).toBe(201);
  return { id: t.json.tenant_id as string, op, worker: w.json.key as string };
}

// ---- servers ----------------------------------------------------------------------------------

let main: Srv; // production, tokens configured, inspect-only witness
let limited: Srv; // tiny studio rate limit
let brute: Srv; // for the unlock lockout (its limiter state must not leak into other tests)
let noWitness: Srv; // witness switched off
let dev: Srv; // development run, generated token, local convenience session
let generated: Srv; // production run with a generated token
let linked: Srv; // delivers its signed approval links to a local webhook

/** Stands in for the phone or chat relay that receives approval cards. */
interface Card {
  actions: { label: string; url: string }[];
  commander: { approval_id: string };
}
const cards: Card[] = [];
let hook: nodeHttp.Server;

beforeAll(async () => {
  hook = nodeHttp.createServer((req, res) => {
    let body = "";
    req.on("data", (c: Buffer) => (body += c));
    req.on("end", () => {
      try {
        cards.push(JSON.parse(body) as Card);
      } catch {
        /* ignore */
      }
      res.writeHead(200).end("ok");
    });
  });
  await new Promise<void>((resolve) => hook.listen(0, "127.0.0.1", resolve));
  const hookUrl = `http://127.0.0.1:${(hook.address() as net.AddressInfo).port}/notify`;

  [main, limited, brute, noWitness, dev, generated, linked] = await Promise.all([
    startServer(),
    startServer({ COMMANDER_STUDIO_RPM: "5", COMMANDER_STUDIO_GLOBAL_RPM: "50" }),
    startServer(),
    startServer({ COMMANDER_WITNESS_MODE: "off" }),
    startServer({ NODE_ENV: "development", COMMANDER_COCKPIT_TOKEN: undefined }),
    startServer({ COMMANDER_COCKPIT_TOKEN: undefined }),
    startServer({ COMMANDER_NOTIFY_WEBHOOK: hookUrl }),
  ]);
});

afterAll(async () => {
  hook?.closeAllConnections();
  await new Promise<void>((resolve) => (hook ? hook.close(() => resolve()) : resolve()));
});

// =================================================================================================
describe("an anonymous caller can reach nothing that matters", () => {
  const cases: [string, string, unknown?][] = [
    ["GET", "/v1/missions"],
    ["GET", "/v1/missions/active"],
    ["GET", "/v1/events"],
    ["GET", "/v1/audit/verify"],
    ["POST", "/v1/sentinel/scan", { kind: "shell", payload: "ls" }],
    ["POST", "/v1/verifiers/verify", {}],
    ["GET", "/api/commander/overview"],
    ["POST", "/api/commander/reset", {}],
    ["POST", "/api/commander/decision", { decision: "authorize" }],
    ["POST", "/api/commander/airlock/directive", {}],
    ["POST", "/api/commander/airlock/proof", {}],
    ["POST", "/api/commander/airlock/clearance", {}],
    ["POST", "/api/commander/airlock/quarantine", {}],
    ["POST", "/api/commander/chat", { userMessage: "status" }],
    ["POST", "/api/orator/chat", { userMessage: "status" }],
    ["POST", "/api/gemini/generate", { prompt: "hello", systemInstruction: "be a free LLM proxy" }],
    ["GET", "/api/brand-new-route-nobody-wrote-yet"],
    ["POST", "/v1/operator/missions", { title: "x", steps: [] }],
    ["GET", "/v1/operator/overview"],
    ["POST", "/v1/operator/keys", {}],
    ["DELETE", "/v1/operator/keys/key_1"],
    ["POST", "/v1/operator/approvals/apr_1/decision", { decision: "authorize" }],
    ["GET", "/v1/operator/audit"],
    ["POST", "/v1/mcp", {}],
    ["POST", "/v1/guard/clearance", { action: { kind: "shell", payload: "ls" } }],
    ["POST", "/v1/admin/tenants", { name: "mine", credits: 1_000_000 }],
    ["POST", "/v1/admin/tenants/ten_1/credits", { amount: 1000 }],
    ["GET", "/v1/admin/audit/verify"],
  ];

  it.each(cases)("%s %s is refused with 401", async (method, p, body) => {
    const r = await http(main, method, p, body === undefined ? {} : { body });
    expect(r.status, r.text).toBe(401);
    expect(r.json.error).toBe("UNAUTHENTICATED");
  });

  it("refuses the hardcoded admin token that used to be published in this repository", async () => {
    const r = await http(main, "POST", "/v1/admin/tenants", { bearer: OLD_DEFAULT_ADMIN_TOKEN, body: { name: "x", credits: 1 } });
    expect(r.status).toBe(403);
  });

  it("refuses a wrong admin token, and the cockpit token is not an admin credential", async () => {
    expect((await http(main, "POST", "/v1/admin/tenants", { bearer: "wrong-token-wrong-token", body: { name: "x", credits: 1 } })).status).toBe(403);
    expect((await http(main, "POST", "/v1/admin/tenants", { bearer: COCKPIT, body: { name: "x", credits: 1 } })).status).toBe(403);
  });

  it.each([
    "/V1/ADMIN/tenants",
    "//v1/admin/tenants",
    "/v1//admin//tenants",
    "/v1/admin/tenants/",
    "/a/../v1/admin/tenants",
    "/%76%31/admin/tenants",
    "/v1/%61dmin/tenants",
    "/V1/Operator/keys",
    "/API/COMMANDER/RESET",
    "/a/x/../../api/commander/reset",
  ])("cannot be talked around with the spelling %s", async (target) => {
    expect(await rawStatus(main, "POST", target)).toBe(401);
  });

  it("still serves what must stay public", async () => {
    expect((await http(main, "GET", "/healthz")).status).toBe(200);
    expect((await http(main, "GET", "/a/apr_x?exp=1&sig=bad")).status).toBe(403); // a signed link, refused by its signature
    const s = await http(main, "GET", "/api/cockpit/session");
    expect(s.json).toEqual({ authenticated: false, unlock_required: true, auto_available: false });
  });

  it("does not advertise the framework, and keeps data out of caches", async () => {
    expect((await http(main, "GET", "/healthz")).headers.get("x-powered-by")).toBeNull();
    expect((await http(main, "GET", "/healthz")).headers.get("x-content-type-options")).toBe("nosniff");
    expect((await http(main, "GET", "/v1/missions")).headers.get("cache-control")).toBe("no-store");
  });

  it("answers a malformed body with a clean 400, not a stack trace", async () => {
    const s = await unlock(main);
    const r = await http(main, "POST", "/api/commander/reset", { rawBody: "{ not json", cookie: s.cookie, csrf: s.csrf });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ error: "INVALID", message: "Malformed request body." });
    expect(r.text).not.toMatch(/at .*\.(js|ts):\d+/);
  });
});

// =================================================================================================
describe("unlocking the operator cockpit", () => {
  it("rejects a wrong token without leaking anything", async () => {
    const r = await http(main, "POST", "/api/cockpit/session", { body: { token: "nope" } });
    expect(r.status).toBe(401);
    expect(r.headers.getSetCookie()).toEqual([]);
    expect(r.text).not.toContain(COCKPIT);
  });

  it("opens a session with the right token and hands over a hardened cookie and the session's CSRF token", async () => {
    const s = await unlock(main);
    expect(s.cookie).toMatch(/^cmd_cockpit=[A-Za-z0-9_-]{40,}$/);
    expect(s.setCookie).toMatch(/HttpOnly/);
    expect(s.setCookie).toMatch(/SameSite=Lax/);
    expect(s.setCookie).not.toMatch(/Secure/);
    expect(s.csrf.length).toBeGreaterThan(20);
    const status = await http(main, "GET", "/api/cockpit/session", { cookie: s.cookie });
    expect(status.json).toEqual({ authenticated: true, unlock_required: false, csrf_token: s.csrf });
  });

  it("uses a cookie that works inside a cross-site preview frame when served over HTTPS", async () => {
    const s = await unlock(main, COCKPIT, { "x-forwarded-proto": "https" });
    expect(s.setCookie).toMatch(/SameSite=None/);
    expect(s.setCookie).toMatch(/Secure/);
    expect(s.setCookie).toMatch(/Partitioned/);
    expect(s.setCookie).toMatch(/HttpOnly/);
  });

  it("opens the operator's own surface, and nothing beyond it", async () => {
    const s = await unlock(main);
    const missions = await http(main, "GET", "/v1/missions", { cookie: s.cookie });
    expect(missions.status).toBe(200);
    expect(missions.json.active_mission_id).toBeTruthy();

    const mission = await http(main, "GET", "/v1/missions/active", { cookie: s.cookie });
    expect(mission.status).toBe(200);
    expect(mission.json.csrf_token).toBe(s.csrf);
    expect(mission.json.current_step.title).toMatch(/Mechanical Test Suite/);

    const overview = await http(main, "GET", "/api/commander/overview", { cookie: s.cookie });
    expect(overview.status).toBe(200);
    expect((await http(main, "GET", "/v1/audit/verify", { cookie: s.cookie })).json.ok).toBe(true);

    // The cockpit session is not an engine credential or an admin credential, even with the CSRF token attached.
    for (const [method, p] of [["GET", "/v1/operator/overview"], ["POST", "/v1/operator/keys"], ["POST", "/v1/admin/tenants"], ["POST", "/v1/mcp"]] as const) {
      const r = await http(main, method, p, { cookie: s.cookie, csrf: s.csrf, ...(method === "GET" ? {} : { body: {} }) });
      expect(r.status, `${method} ${p}`).toBe(401);
    }
  });

  it("requires the session's own CSRF token on every state-changing request", async () => {
    const mine = await unlock(main);
    const theirs = await unlock(main);
    const reset = (csrf?: string) => http(main, "POST", "/api/commander/reset", { cookie: mine.cookie, csrf, body: { mode: "idle" } });
    expect((await reset()).status).toBe(403);
    expect((await reset("guess")).status).toBe(403);
    expect((await reset(theirs.csrf)).status).toBe(403); // another session's token
    expect((await reset(mine.csrf)).status).toBe(200);
  });

  it("ends the session on logout", async () => {
    const s = await unlock(main);
    expect((await http(main, "GET", "/v1/missions", { cookie: s.cookie })).status).toBe(200);
    const out = await http(main, "DELETE", "/api/cockpit/session", { cookie: s.cookie });
    expect(out.status).toBe(200);
    expect(out.headers.getSetCookie()[0]).toMatch(/Max-Age=0/);
    expect((await http(main, "GET", "/v1/missions", { cookie: s.cookie })).status).toBe(401);
  });

  it("locks a client out after repeated wrong guesses, even for the right token", async () => {
    for (let i = 0; i < 8; i++) expect((await http(brute, "POST", "/api/cockpit/session", { body: { token: `wrong-${i}` } })).status).toBe(401);
    const blocked = await http(brute, "POST", "/api/cockpit/session", { body: { token: COCKPIT } });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(blocked.headers.getSetCookie()).toEqual([]);
  });
});

// =================================================================================================
describe("the live event stream", () => {
  it("gives each client its own CSRF token and never broadcasts one", async () => {
    const a = await unlock(main);
    const b = await unlock(main);

    const stream = await fetch(`${main.url}/v1/events`, { headers: { cookie: a.cookie } });
    expect(stream.status).toBe(200);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    const sse = sseReader(stream);
    try {
      const snapshot = await sse.next();
      expect(JSON.parse(snapshot).type).toBe("mission.snapshot");
      expect(snapshot).toContain(a.csrf); // that client's own token, in its own snapshot

      // Another operator session causes a broadcast to every connected client.
      expect((await http(main, "POST", "/api/commander/reset", { cookie: b.cookie, csrf: b.csrf, body: { mode: "idle" } })).status).toBe(200);
      const broadcast = await sse.next();
      expect(broadcast).not.toContain("csrf_token");
      expect(broadcast).not.toContain(a.csrf);
      expect(broadcast).not.toContain(b.csrf);
    } finally {
      await sse.close();
    }
  });

  it("refuses an anonymous subscriber", async () => {
    const res = await fetch(`${main.url}/v1/events`);
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });
});

// =================================================================================================
describe("roles are enforced by the server, not assumed", () => {
  it("lets an operator key use the operator API", async () => {
    const t = await newTenant(main);
    expect((await http(main, "GET", "/v1/operator/overview", { bearer: t.op })).status).toBe(200);
    expect((await http(main, "GET", "/v1/operator/audit", { bearer: t.op })).status).toBe(200);
    expect((await http(main, "GET", "/v1/operator/audit/verify", { bearer: t.op })).json.ok).toBe(true);
  });

  it("keeps a WORKER key out of every operator route (it must not approve its own actions or mint keys)", async () => {
    const t = await newTenant(main);
    const attempts: [string, string, unknown?][] = [
      ["GET", "/v1/operator/overview"],
      ["GET", "/v1/operator/missions"],
      ["POST", "/v1/operator/missions", { title: "x", steps: [{ title: "s", directive: "d", proof: [{ type: "exit_code" }] }] }],
      ["POST", "/v1/operator/keys", {}],
      ["DELETE", "/v1/operator/keys/key_1"],
      ["GET", "/v1/operator/approvals"],
      ["POST", "/v1/operator/approvals/apr_1/decision", { decision: "authorize" }],
      ["GET", "/v1/operator/audit"],
      ["GET", "/v1/operator/audit/verify"],
    ];
    for (const [method, p, body] of attempts) {
      const r = await http(main, method, p, { bearer: t.worker, ...(body === undefined ? {} : { body }) });
      expect(r.status, `${method} ${p}: ${r.text}`).toBe(403);
      expect(r.json.error).toBe("FORBIDDEN");
    }
  });

  it("keeps an operator key out of the worker routes", async () => {
    const t = await newTenant(main);
    expect((await http(main, "POST", "/v1/guard/clearance", { bearer: t.op, body: { action: { kind: "shell", payload: "ls" } } })).status).toBe(403);
    expect((await http(main, "POST", "/v1/mcp", { bearer: t.op, body: {} })).status).toBe(403);
  });

  it("rejects a credential that is not a key at all", async () => {
    for (const bearer of ["cmd_op_not-a-real-key-0000000000", "garbage"]) {
      expect((await http(main, "GET", "/v1/operator/overview", { bearer })).status, bearer).toBe(401);
    }
  });

  it("isolates tenants from each other and from the cockpit's sandbox mission", async () => {
    const a = await newTenant(main);
    const b = await newTenant(main);
    const mission = await http(main, "POST", "/v1/operator/missions", {
      bearer: a.op,
      body: { title: "Private", steps: [{ title: "s", directive: "secret directive", proof: [{ type: "exit_code" }] }] },
    });
    expect(mission.status, mission.text).toBe(201);
    expect((await http(main, "GET", `/v1/operator/missions/${mission.json.id}`, { bearer: b.op })).status).toBe(404);
    expect((await http(main, "GET", "/v1/operator/missions", { bearer: b.op })).json.missions).toEqual([]);
    const sandbox = (await http(main, "GET", "/v1/missions", { cookie: (await unlock(main)).cookie })).json.active_mission_id as string;
    expect((await http(main, "GET", `/v1/operator/missions/${sandbox}`, { bearer: b.op })).status).toBe(404);
  });
});

// =================================================================================================
describe("one tenant's activity never disturbs the cockpit or another tenant", () => {
  const ONE_STEP = { title: "TENANT-SECRET-TITLE", steps: [{ title: "s", directive: "d", proof: [{ type: "exit_code" }] }] };
  const STAGED_ACTION = (pod: string) => ({ kind: "shell", payload: `kubectl delete pod ${pod}` });

  /** Reads every frame that arrives until the stream goes quiet. */
  async function drain(sse: ReturnType<typeof sseReader>): Promise<string[]> {
    const frames: string[] = [];
    for (;;) {
      try {
        frames.push(await sse.next(1500));
      } catch {
        return frames;
      }
    }
  }

  async function cockpitWatching() {
    const cockpit = await unlock(linked);
    const mission = await http(linked, "GET", "/v1/missions/active", { cookie: cockpit.cookie });
    expect(mission.status, mission.text).toBe(200);
    const stream = await fetch(`${linked.url}/v1/events`, { headers: { cookie: cockpit.cookie } });
    expect(stream.status).toBe(200);
    const sse = sseReader(stream);
    await sse.next(); // the snapshot
    return { cockpit, activeId: mission.json.id as string, sse };
  }

  async function waitForCard(approvalId: string): Promise<Card> {
    const card = await vi.waitFor(() => {
      const c = cards.find((x) => x.commander.approval_id === approvalId);
      if (!c) throw new Error("no approval card delivered yet");
      return c;
    }, { timeout: 10_000, interval: 50 });
    return card;
  }

  it("opening a mission as a tenant leaves the cockpit's mission alone, even while the cockpit is watching", async () => {
    const { cockpit, activeId, sse } = await cockpitWatching();
    try {
      const t = await newTenant(linked);
      const opened = await http(linked, "POST", "/v1/operator/missions", { bearer: t.op, body: ONE_STEP });
      expect(opened.status, opened.text).toBe(201);

      const after = await http(linked, "GET", "/v1/missions/active", { cookie: cockpit.cookie });
      expect(after.status, after.text).toBe(200);
      expect(after.json.id).toBe(activeId);
      expect((await http(linked, "GET", "/v1/missions", { cookie: cockpit.cookie })).json.active_mission_id).toBe(activeId);

      // Whatever the cockpit's stream carries next, the tenant's mission is not in it.
      expect((await http(linked, "POST", "/api/commander/reset", { cookie: cockpit.cookie, csrf: cockpit.csrf, body: {} })).status).toBe(200);
      const frames = await drain(sse);
      expect(frames.length).toBeGreaterThan(0);
      for (const f of frames) {
        expect(f).not.toContain("TENANT-SECRET-TITLE");
        expect(f).not.toContain(opened.json.id);
      }
    } finally {
      await sse.close();
    }
  });

  it("a tenant can drive a full approval cycle while the cockpit is watching, by operator route and by signed link", async () => {
    const { sse } = await cockpitWatching();
    try {
      const t = await newTenant(linked);
      const opened = await http(linked, "POST", "/v1/operator/missions", { bearer: t.op, body: ONE_STEP });
      expect(opened.status, opened.text).toBe(201);
      const missionId = opened.json.id as string;

      const worker = await mcpClient(linked, t.worker);
      try {
        structured(await worker.callTool({ name: "commander_get_directive", arguments: { mission_id: missionId } }));
      } finally {
        await worker.close();
      }
      const stage = (pod: string) => http(linked, "POST", "/v1/guard/clearance", { bearer: t.worker, body: { mission_id: missionId, action: STAGED_ACTION(pod) } });
      const pending = async () => ((await http(linked, "GET", "/v1/operator/approvals?status=pending", { bearer: t.op })).json.approvals as { id: string }[]);

      // 1. The operator decides through the API.
      const first = await stage("web-1");
      expect(first.status, first.text).toBe(200);
      expect(first.json.verdict).toBe("STAGED");
      const [a1] = await pending();
      const decided = await http(linked, "POST", `/v1/operator/approvals/${a1!.id}/decision`, { bearer: t.op, body: { decision: "authorize" } });
      expect(decided.status, decided.text).toBe(200);
      expect(decided.json.status).toBe("authorized");

      // 2. The operator decides through the signed link a phone would tap. It carries its own authority and no cookie.
      const second = await stage("web-2");
      expect(second.json.verdict).toBe("STAGED");
      const [a2] = await pending();
      const card = await waitForCard(a2!.id);
      const authorize = new URL(card.actions.find((a) => a.label === "Authorize")!.url);
      const viaLink = await http(linked, "POST", authorize.pathname + authorize.search);
      expect(viaLink.status, viaLink.text).toBe(200);
      expect(viaLink.json).toMatchObject({ ok: true, status: "authorized" });
      expect(viaLink.json.mission, "the cockpit payload exists only for the sandbox tenant").toBeUndefined();

      // A link is single use.
      expect((await http(linked, "POST", authorize.pathname + authorize.search)).status).toBe(409);

      // 3. The operator ends the mission.
      const killed = await http(linked, "POST", `/v1/operator/missions/${missionId}/intervene`, { bearer: t.op, body: { action: "kill", reason: "done" } });
      expect(killed.status, killed.text).toBe(200);
      expect(killed.json.status).toBe("killed");

      // The cockpit's own stream carried none of it.
      for (const f of await drain(sse)) expect(f).not.toContain(missionId);
    } finally {
      await sse.close();
    }
  });

  it("does not let a signed link for one approval decide another, or work with a forged signature", async () => {
    const t = await newTenant(linked);
    const opened = await http(linked, "POST", "/v1/operator/missions", { bearer: t.op, body: ONE_STEP });
    const worker = await mcpClient(linked, t.worker);
    try {
      structured(await worker.callTool({ name: "commander_get_directive", arguments: { mission_id: opened.json.id } }));
    } finally {
      await worker.close();
    }
    expect((await http(linked, "POST", "/v1/guard/clearance", { bearer: t.worker, body: { mission_id: opened.json.id, action: STAGED_ACTION("web-9") } })).json.verdict).toBe("STAGED");
    const [a] = ((await http(linked, "GET", "/v1/operator/approvals?status=pending", { bearer: t.op })).json.approvals as { id: string }[]);
    const card = await waitForCard(a!.id);
    const real = new URL(card.actions.find((x) => x.label === "Authorize")!.url);

    const forged = new URL(real);
    forged.searchParams.set("sig", "0".repeat(64));
    expect((await http(linked, "POST", forged.pathname + forged.search)).status).toBe(403);

    const swapped = new URL(real);
    swapped.searchParams.set("d", "kill"); // a signature for "authorize" is not one for "kill"
    expect((await http(linked, "POST", swapped.pathname + swapped.search)).status).toBe(403);

    const other = `/a/apr_someoneElses/decide${real.search}`; // right signature, wrong approval
    expect((await http(linked, "POST", other)).status).toBe(403);

    expect(((await http(linked, "GET", "/v1/operator/approvals?status=pending", { bearer: t.op })).json.approvals as unknown[]).length).toBe(1); // still undecided
  });
});

// =================================================================================================
describe("the independent witness cannot run code unless you explicitly allow it", () => {
  const canaryDir = mkdtempSync(path.join(tmpdir(), "orator-canary-"));
  const canary = path.join(canaryDir, "pwned.txt");
  afterAll(() => rmSync(canaryDir, { recursive: true, force: true }));

  const exploit = {
    title: "Witness exploit",
    steps: [
      {
        title: "Run my command",
        directive: "Do it.",
        proof: [{ type: "exit_code" }, { type: "witness_command", argv: ["node", "-e", `require('fs').writeFileSync(${JSON.stringify(canary)}, 'pwned')`] }],
      },
    ],
  };

  it("an authenticated operator can define the check, but the command never runs", async () => {
    const t = await newTenant(main);
    const opened = await http(main, "POST", "/v1/operator/missions", { bearer: t.op, body: exploit });
    expect(opened.status, opened.text).toBe(201);

    const worker = await mcpClient(main, t.worker);
    try {
      const d = structured(await worker.callTool({ name: "commander_get_directive", arguments: { mission_id: opened.json.id } }));
      const proof = structured(
        await worker.callTool({ name: "commander_submit_proof", arguments: { mission_id: opened.json.id, lease_id: d.lease_id, evidence: { exit_code: 0 } } }),
      );
      expect(proof.verdict).toBe("REJECTED");
      expect(proof.patch).toMatch(/allowlist/);
    } finally {
      await worker.close();
    }
    expect(existsSync(canary), "the witness command must not have executed").toBe(false);
  });

  it("is rejected outright when the witness is switched off", async () => {
    const t = await newTenant(noWitness);
    const r = await http(noWitness, "POST", "/v1/operator/missions", { bearer: t.op, body: exploit });
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/not enabled on this deployment/);
  });

  it("keeps the demo mission's independent file check when inspect-only, and drops it cleanly when off", async () => {
    const witnessed = async (srv: Srv) => {
      const s = await unlock(srv);
      const m = await http(srv, "GET", "/v1/missions/active", { cookie: s.cookie });
      expect(m.status).toBe(200);
      return m.json.current_step.checklist.map((c: { provenance: string }) => c.provenance) as string[];
    };
    expect(await witnessed(main)).toContain("witnessed");
    expect(await witnessed(noWitness)).not.toContain("witnessed");
  });

  it("announces what the witness can do at startup", () => {
    expect(main.log()).toMatch(/\[WITNESS\] Inspect-only/);
    expect(noWitness.log()).toMatch(/\[WITNESS\] Off/);
  });
});

// =================================================================================================
describe("the visitor-facing studio routes", () => {
  it("are open, but rate limited", async () => {
    const statuses: number[] = [];
    let last: Res | undefined;
    for (let i = 0; i < 7; i++) {
      last = await http(limited, "POST", "/api/gemini/explore", { body: { answers: { q: `a${i}` } } });
      statuses.push(last.status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses.slice(5)).toEqual([429, 429]);
    expect(last!.json.error).toBe("THROTTLED");
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("refuse oversized requests before they reach the model", async () => {
    const big = JSON.stringify({ answers: { text: "x".repeat(200 * 1024) } });
    const r = await http(main, "POST", "/api/gemini/explore", { rawBody: big });
    expect(r.status).toBe(413);
    const s = await unlock(main);
    const gen = await http(main, "POST", "/api/gemini/generate", { cookie: s.cookie, csrf: s.csrf, rawBody: JSON.stringify({ prompt: "x".repeat(100 * 1024) }) });
    expect(gen.status).toBe(413);
  });

  it("keep the raw model proxy behind the operator session", async () => {
    expect((await http(main, "POST", "/api/gemini/generate", { body: { prompt: "hi" } })).status).toBe(401);
    const s = await unlock(main);
    const ok = await http(main, "POST", "/api/gemini/generate", { cookie: s.cookie, csrf: s.csrf, body: { prompt: "status" } });
    expect(ok.status).toBe(200);
    expect(ok.json.simulated).toBe(true); // no Gemini key in the test environment, so nothing is spent
  });
});

// =================================================================================================
describe("documented settings take effect", () => {
  it("COMMANDER_GEMINI_MODEL sets the model the server uses, and the default is unchanged without it", async () => {
    const custom = await startServer({ COMMANDER_GEMINI_MODEL: "my-test-model" });
    expect((await http(custom, "GET", "/healthz")).json.model).toBe("my-test-model");
    expect((await http(main, "GET", "/healthz")).json.model).toBe("gemini-3.8-flash");
  });

  it("a blank value counts as unset, so a copied .env.example boots", async () => {
    const blank = await startServer({
      COMMANDER_GEMINI_MODEL: "",
      COMMANDER_LINK_SECRET: "",
      COMMANDER_PUBLIC_URL: "",
      COMMANDER_SESSION_HOURS: "",
      COMMANDER_STUDIO_RPM: "",
      COMMANDER_STUDIO_GLOBAL_RPM: "",
      COMMANDER_TRUST_PROXY: "",
      COMMANDER_WITNESS_MODE: "",
      COMMANDER_NOTIFY_WEBHOOK: "",
      HOST: "",
      GEMINI_API_KEY: "",
    });
    expect((await http(blank, "GET", "/healthz")).json.model).toBe("gemini-3.8-flash");
  });
});

// =================================================================================================
describe("startup refuses unsafe configuration", () => {
  it("will not start with the admin token that was published in the repository", async () => {
    const r = await startExpectingFailure({ COMMANDER_ADMIN_TOKEN: OLD_DEFAULT_ADMIN_TOKEN });
    expect(r.code).not.toBe(0);
    expect(r.output).toMatch(/published in a public repository/);
  });

  it("will not start with a short secret or a bad port", async () => {
    const short = await startExpectingFailure({ COMMANDER_COCKPIT_TOKEN: "short" });
    expect(short.code).not.toBe(0);
    expect(short.output).toMatch(/at least 16 characters/);
    const port = await startExpectingFailure({ PORT: "not-a-port" });
    expect(port.code).not.toBe(0);
    expect(port.output).toMatch(/PORT must be an integer/);
  });

  it("disables /v1/admin entirely when no admin token is set", async () => {
    const srv = await startServer({ COMMANDER_ADMIN_TOKEN: undefined });
    expect(srv.log()).toMatch(/\[ADMIN\] COMMANDER_ADMIN_TOKEN is not set: \/v1\/admin is disabled/);
    for (const bearer of [undefined, ADMIN, OLD_DEFAULT_ADMIN_TOKEN, COCKPIT]) {
      const r = await http(srv, "POST", "/v1/admin/tenants", { bearer, body: { name: "x", credits: 1 } });
      expect(r.status, String(bearer)).toBe(404);
    }
  });
});

// =================================================================================================
describe("when no unlock token is configured", () => {
  it("generates one per run and prints it once; it works, and the old default does not", async () => {
    const token = /Unlock token for this run: (\S+)/.exec(generated.log())?.[1];
    expect(token, generated.log()).toBeTruthy();
    expect(token!.length).toBeGreaterThanOrEqual(24);
    expect((await http(generated, "POST", "/api/cockpit/session", { body: { token: OLD_DEFAULT_ADMIN_TOKEN } })).status).toBe(401);
    const s = await unlock(generated, token!);
    expect((await http(generated, "GET", "/v1/missions", { cookie: s.cookie })).status).toBe(200);
  });

  it("does not open itself to a local browser in a production run", async () => {
    expect((await http(generated, "GET", "/api/cockpit/session")).json).toMatchObject({ unlock_required: true, auto_available: false });
    expect((await http(generated, "POST", "/api/cockpit/session", { body: {} })).status).toBe(401);
  });

  it("opens itself to a browser on the same machine in a development run, and only to one", async () => {
    expect((await http(dev, "GET", "/api/cockpit/session")).json).toMatchObject({ unlock_required: false, auto_available: true });
    const opened = await http(dev, "POST", "/api/cockpit/session", { body: {} });
    expect(opened.status).toBe(200);
    const cookie = opened.headers.getSetCookie()[0]!.split(";")[0]!;
    expect((await http(dev, "GET", "/v1/missions", { cookie })).status).toBe(200);

    // Through a proxy, or with a foreign Host header (DNS rebinding), the convenience session is not offered.
    const variants: [string, RawOpts][] = [
      ["through a proxy", { headers: { "x-forwarded-for": "203.0.113.9" } }],
      ["with a foreign Host header", { host: "evil.example" }],
    ];
    for (const [why, o] of variants) {
      const status = await rawRequest(dev, "GET", "/api/cockpit/session", o);
      expect(status.json, why).toMatchObject({ unlock_required: true, auto_available: false });
      expect((await rawRequest(dev, "POST", "/api/cockpit/session", o)).status, why).toBe(401);
    }
  });
});
