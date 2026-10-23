import { describe, expect, it } from "vitest";
import {
  INPUT_LIMITS,
  isValidSlotISO,
  redactSecrets,
  sanitizeAnswer,
} from "./security";

describe("sanitizeAnswer — inquest input boundary", () => {
  it("trims whitespace", () => {
    expect(sanitizeAnswer("   booking system   ")).toBe("booking system");
  });

  it("strips control characters", () => {
    expect(sanitizeAnswer("line1\u0007\u001Fline2")).toBe("line1line2");
  });

  it("caps long answers at 600 chars", () => {
    const value = "a".repeat(900);
    expect(sanitizeAnswer(value, INPUT_LIMITS.long)).toHaveLength(600);
  });

  it("caps short answers at 200 chars", () => {
    const value = "a".repeat(300);
    expect(sanitizeAnswer(value, INPUT_LIMITS.short)).toHaveLength(200);
  });

  it("rejects empty after trimming", () => {
    expect(sanitizeAnswer("   ")).toBe("");
  });

  it("redacts embedded credentials before persisting", () => {
    const dirty = "use key sk-abcdefghijklmnopqrstuvwxyz123 for prod";
    expect(sanitizeAnswer(dirty)).toContain("[REDACTED]");
    expect(sanitizeAnswer(dirty)).not.toContain("sk-abcdefghijklmno");
  });
});

describe("redactSecrets — dossier hygiene", () => {
  const cases: [string, string][] = [
    ["OPENROUTER sk-or-v1-abcdefghij123456 key", "OPENROUTER [REDACTED] key"],
    ["google AIzaSyBgs2xYzVhUzVhUzVhUzVhUzVhUzVhUzVhUZ", "google [REDACTED]"],
    ["token ghp_abcdefghijklmnopqrstuvwxyz1234567890 ok", "token [REDACTED] ok"],
    ["jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.signatureExtra", "jwt [REDACTED].signatureExtra"],
    ["multi eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0", "multi [REDACTED].[REDACTED]"],
  ];

  it.each(cases)("redacts %s", (input, expected) => {
    expect(redactSecrets(input)).toBe(expected);
  });

  it("leaves plain prose untouched", () => {
    expect(redactSecrets("members book classes in under 30 seconds")).toContain("members");
  });
});

describe("isValidSlotISO", () => {
  it("accepts a real slot timestamp", () => {
    expect(isValidSlotISO("2026-09-08T15:30")).toBe(true);
  });

  it("rejects malformed strings", () => {
    expect(isValidSlotISO("tomorrow afternoon")).toBe(false);
    expect(isValidSlotISO("2026-13-01T99:99")).toBe(false);
    expect(isValidSlotISO("2026-09-08")).toBe(false);
  });
});
