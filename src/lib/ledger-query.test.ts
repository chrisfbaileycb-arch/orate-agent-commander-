import { describe, expect, it } from "vitest";
import { LEDGER_QUERY_UNREACHABLE, ledgerQueryOutcome } from "./ledger-query";

describe("ledgerQueryOutcome", () => {
  it("shows the ledger's own answer when it answered", () => {
    expect(ledgerQueryOutcome(200, { reply: "  Step 1 of 4 is released.  " })).toEqual({ ok: true, text: "Step 1 of 4 is released." });
  });

  it.each([
    [401, /Cockpit locked/],
    [403, /rejected that request.*Reload/],
    [413, /too long/],
    [429, /Too many requests/],
    [500, /failed \(HTTP 500\)/],
    [502, /failed \(HTTP 502\)/],
  ])("reports HTTP %i as a failure, in words that say so", (status, expected) => {
    const out = ledgerQueryOutcome(status, { error: "whatever the body says", reply: "a stray reply must not be shown as an answer" });
    expect(out.ok).toBe(false);
    expect(out.text).toMatch(expected);
    expect(out.text).not.toContain("stray reply");
  });

  it("never presents a query that did not run as a completed one", () => {
    for (const status of [0, 400, 401, 403, 404, 413, 429, 500, 503]) {
      expect(ledgerQueryOutcome(status, null).text, String(status)).not.toMatch(/complete|standing by/i);
    }
    expect(LEDGER_QUERY_UNREACHABLE).not.toMatch(/complete|standing by/i);
  });

  it.each([null, undefined, {}, { reply: "" }, { reply: "   " }, { reply: 5 }, "a string", []])("treats a success with no usable reply (%j) as no answer", (data) => {
    expect(ledgerQueryOutcome(200, data)).toEqual({ ok: false, text: "The ledger returned no answer." });
  });

  it("says plainly when the request never reached the server", () => {
    expect(LEDGER_QUERY_UNREACHABLE).toMatch(/could not be sent/);
  });
});
