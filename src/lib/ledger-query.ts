export interface LedgerQueryOutcome {
  /** True only when the ledger actually answered. */
  ok: boolean;
  /** What the operator is shown and, if voice is on, hears. */
  text: string;
}

/**
 * Turns the chat route's HTTP result into what the operator sees. A query that did not run is reported as one that did
 * not run: there is no "Ledger query complete" for a request the server refused.
 */
export function ledgerQueryOutcome(status: number, data: unknown): LedgerQueryOutcome {
  const reply = typeof (data as { reply?: unknown } | null)?.reply === "string" ? (data as { reply: string }).reply.trim() : "";

  if (status >= 200 && status < 300) {
    return reply ? { ok: true, text: reply } : { ok: false, text: "The ledger returned no answer." };
  }
  if (status === 401) return { ok: false, text: "Cockpit locked. Unlock the live cockpit to query the ledger." };
  if (status === 403) return { ok: false, text: "The cockpit rejected that request. Reload the page and unlock it again." };
  if (status === 413) return { ok: false, text: "That question is too long. Shorten it and ask again." };
  if (status === 429) return { ok: false, text: "Too many requests. Wait a moment and ask again." };
  return { ok: false, text: `The ledger query failed (HTTP ${status}). No answer was produced.` };
}

/** What to show when the request could not be sent at all. */
export const LEDGER_QUERY_UNREACHABLE = "The ledger query could not be sent. Check the connection and try again.";
