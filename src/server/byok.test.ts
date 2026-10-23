import { describe, expect, it } from "vitest";
import { DEMO_COPY, classifyModelFailure, resolveStudioKey, scrubKey, type StudioReason } from "./byok";

const KEY = "visitor-key-0123456789abcdefghijklmn";

describe("resolveStudioKey", () => {
  it("takes a single clean key from the header", () => {
    expect(resolveStudioKey({ "x-gemini-key": KEY })).toBe(KEY);
    expect(resolveStudioKey({ "x-gemini-key": `  ${KEY}\t` })).toBe(KEY);
  });

  it("returns nothing when the header is missing", () => {
    expect(resolveStudioKey({})).toBeUndefined();
    expect(resolveStudioKey({ "x-gemini-key": undefined })).toBeUndefined();
  });

  it("does not look anywhere else for a key", () => {
    expect(resolveStudioKey({ authorization: `Bearer ${KEY}`, cookie: `key=${KEY}`, "x-api-key": KEY, "x-goog-api-key": KEY })).toBeUndefined();
  });

  it.each([
    ["too short", "short"],
    ["too long", "k".repeat(201)],
    ["two keys joined, as Node joins a repeated header", `${KEY}, ${KEY}`],
    ["a space inside", "abcdefghij klmnopqrstuvwxyz"],
    ["a header-injection attempt", `${KEY}\r\nx-evil: 1`],
  ])("refuses a key that is %s", (_why, value) => {
    expect(resolveStudioKey({ "x-gemini-key": value })).toBeUndefined();
  });

  it("refuses an array value", () => {
    expect(resolveStudioKey({ "x-gemini-key": [KEY, KEY] as unknown as string })).toBeUndefined();
  });
});

describe("scrubKey", () => {
  it("removes the exact key wherever it appears", () => {
    const out = scrubKey(`bad key ${KEY} for ${KEY}`, KEY);
    expect(out).not.toContain(KEY);
    expect(out).toBe("bad key [key] for [key]");
  });

  it("removes anything shaped like a Google key, even one it was not told about", () => {
    const stray = ["AIza", "SyA-bcdefghijklmnopqrstuvwxyz_0123456"].join("");
    expect(scrubKey(`upstream said ${stray}`)).toBe("upstream said [key]");
  });

  it("leaves other text alone, and tolerates no key", () => {
    expect(scrubKey("quota exceeded")).toBe("quota exceeded");
    expect(scrubKey("quota exceeded", undefined)).toBe("quota exceeded");
  });
});

describe("classifyModelFailure", () => {
  it.each([
    [{ status: 429, message: "slow down" }, "quota_exceeded"],
    [{ status: 401, message: "no" }, "key_rejected"],
    [{ status: 403, message: "no" }, "key_rejected"],
    [{ status: 400, message: "API key not valid. Please pass a valid API key." }, "key_rejected"],
    [{ status: 400, message: "Invalid JSON payload" }, "model_error"],
    [{ status: 500, message: "boom" }, "model_error"],
    [new Error("ECONNRESET"), "model_error"],
    [new Error("timed out"), "model_error"],
    [null, "model_error"],
    [undefined, "model_error"],
    ["a string", "model_error"],
  ])("%j is %s", (err, expected) => {
    expect(classifyModelFailure(err)).toBe(expected);
  });
});

describe("DEMO_COPY", () => {
  const reasons: StudioReason[] = ["no_key", "key_rejected", "quota_exceeded", "model_error"];

  it.each(reasons)("%s has copy that says no model ran", (reason) => {
    expect(DEMO_COPY[reason]).toMatch(/^Demo output\./);
    expect(DEMO_COPY[reason]).toMatch(/no model ran/);
  });

  it("never claims anything was verified", () => {
    for (const reason of reasons) expect(DEMO_COPY[reason]).not.toMatch(/verified|confidence|conf:/i);
  });
});
