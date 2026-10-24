import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * config.test.ts keeps .env.example in step with the engine's config.ts. The server and its security module read
 * environment variables of their own, and an undocumented one is a setting nobody can find, so the same guard applies.
 */

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const example = read("../../.env.example");

// Inherited from the shell, not settings.
const NOT_SETTINGS = new Set(["PATH", "HOME"]);

describe.each([
  ["server.ts", "../../server.ts"],
  ["src/server/security.ts", "./security.ts"],
])("%s", (_name, rel) => {
  const names = [...new Set([...read(rel).matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]!))].filter((n) => !NOT_SETTINGS.has(n));

  it("reads at least one setting, so this check cannot pass by matching nothing", () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(names)("documents %s in .env.example", (name) => {
    expect(example).toMatch(new RegExp(`^${name}=`, "m"));
  });
});

describe(".env.example", () => {
  it("ships no real-looking secret", () => {
    for (const line of example.split("\n")) {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (!m) continue;
      if (/(KEY|TOKEN|SECRET)$/.test(m[1]!)) expect(["", "change-me"], m[1]).toContain(m[2]);
    }
  });
});
