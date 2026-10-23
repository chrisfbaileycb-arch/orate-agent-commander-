import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BYOK_HEADER, clearGeminiKey, getGeminiKey, isPlausibleGeminiKey, setGeminiKey, subscribeGeminiKey, withGeminiKey } from "./byok";

const KEY = "AIza-test-key-0123456789abcdefghij";

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

describe("isPlausibleGeminiKey", () => {
  it.each([KEY, "x".repeat(20), "x".repeat(200), "AIzaSyA-bcdefghijklmnopqrstuvwxyz_01234567"])("accepts %s", (k) => {
    expect(isPlausibleGeminiKey(k)).toBe(true);
  });

  it.each([
    ["too short", "x".repeat(19)],
    ["too long", "x".repeat(201)],
    ["empty", ""],
    ["a space inside", "abcdefghij klmnopqrstuvwxyz"],
    ["a newline (header injection)", "abcdefghijklmnopqrstu\r\nx-evil: 1"],
    ["a tab", "abcdefghijklmnopqrst\tuvw"],
    ["a control character", "abcdefghijklmnopqrstu\u0007"],
    ["non-ASCII", "abcdefghijklmnopqrstuü"],
    ["leading space", " abcdefghijklmnopqrstu"],
  ])("rejects a key with %s", (_why, k) => {
    expect(isPlausibleGeminiKey(k)).toBe(false);
  });

  it.each([undefined, null, 5, {}, ["x".repeat(30)]])("rejects a non-string (%j)", (v) => {
    expect(isPlausibleGeminiKey(v)).toBe(false);
  });
});

describe("the browser's copy of the key", () => {
  let storage: ReturnType<typeof fakeStorage>;
  let target: EventTarget;

  beforeEach(() => {
    storage = fakeStorage();
    target = new EventTarget();
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("window", target);
    clearGeminiKey();
  });
  afterEach(() => {
    clearGeminiKey();
    vi.unstubAllGlobals();
  });

  it("starts with no key, so requests carry no header", () => {
    expect(getGeminiKey()).toBeUndefined();
    expect(withGeminiKey({ "Content-Type": "application/json" })).toEqual({ "Content-Type": "application/json" });
    expect(withGeminiKey()).toEqual({});
  });

  it("stores a good key in the tab's session storage and sends it in the header", () => {
    expect(setGeminiKey(`  ${KEY}  `)).toBe(true); // surrounding whitespace from a paste is trimmed
    expect(getGeminiKey()).toBe(KEY);
    expect([...storage.raw.values()]).toEqual([KEY]);
    expect(withGeminiKey({ a: "b" })).toEqual({ a: "b", [BYOK_HEADER]: KEY });
  });

  it("never touches localStorage, which would outlive the tab", () => {
    const local = fakeStorage();
    vi.stubGlobal("localStorage", local);
    setGeminiKey(KEY);
    expect(local.raw.size).toBe(0);
  });

  it("refuses text that could not be a key and stores nothing", () => {
    expect(setGeminiKey("nope")).toBe(false);
    expect(setGeminiKey("abcdefghij klmnopqrstuvwxyz")).toBe(false);
    expect(getGeminiKey()).toBeUndefined();
    expect(storage.raw.size).toBe(0);
  });

  it("forgets the key everywhere", () => {
    setGeminiKey(KEY);
    clearGeminiKey();
    expect(getGeminiKey()).toBeUndefined();
    expect(storage.raw.size).toBe(0);
    expect(withGeminiKey()).toEqual({});
  });

  it("ignores a stored value that is not a plausible key", () => {
    storage.setItem("orator.byok.gemini", "tampered value with spaces");
    expect(getGeminiKey()).toBeUndefined();
  });

  it("keeps working for the page's lifetime when storage is blocked", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(setGeminiKey(KEY)).toBe(true);
    expect(getGeminiKey()).toBe(KEY);
    clearGeminiKey();
    expect(getGeminiKey()).toBeUndefined();
  });

  it("tells subscribers when the key is set or forgotten, and stops when they unsubscribe", () => {
    const onChange = vi.fn();
    const off = subscribeGeminiKey(onChange);
    setGeminiKey(KEY);
    clearGeminiKey();
    expect(onChange).toHaveBeenCalledTimes(2);
    off();
    setGeminiKey(KEY);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
