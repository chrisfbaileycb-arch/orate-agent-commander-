import type { IncomingHttpHeaders } from "node:http";
import { BYOK_HEADER, isPlausibleGeminiKey } from "../lib/byok.js";

/**
 * Where the server gets the key for a visitor-facing studio request. Beta: from the visitor, and only from the visitor.
 * The operator's own GEMINI_API_KEY is never used on a visitor's behalf, so a stranger cannot spend it.
 *
 * When the product goes public and the key setup changes, this is the function to change.
 */
export function resolveStudioKey(headers: IncomingHttpHeaders): string | undefined {
  const raw = headers[BYOK_HEADER];
  // A repeated header arrives joined with ", ", which fails the shape check, so only a single clean value is accepted.
  const value = typeof raw === "string" ? raw.trim() : undefined;
  return isPlausibleGeminiKey(value) ? value : undefined;
}

/** Removes the key, and anything shaped like a Google key, from text that is about to be logged or returned. */
export function scrubKey(text: string, key?: string): string {
  const withoutKey = key ? text.split(key).join("[key]") : text;
  return withoutKey.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[key]");
}

/** Why a studio request fell back to a demo result. */
export type StudioReason = "no_key" | "key_rejected" | "quota_exceeded" | "model_error";

export function classifyModelFailure(err: unknown): Exclude<StudioReason, "no_key"> {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 429) return "quota_exceeded";
  if (status === 401 || status === 403) return "key_rejected";
  if (status === 400 && /api key/i.test(String((err as { message?: unknown }).message ?? ""))) return "key_rejected";
  return "model_error";
}

/** Plain-language copy for the demo result. It must never read as though a model ran. */
export const DEMO_COPY: Record<StudioReason, string> = {
  no_key: "Demo output. No Gemini key was supplied, so no model ran.",
  key_rejected: "Demo output. Google rejected the key that was supplied, so no model ran.",
  quota_exceeded: "Demo output. The key that was supplied is over its quota, so no model ran.",
  model_error: "Demo output. The model call failed, so no model ran.",
};
