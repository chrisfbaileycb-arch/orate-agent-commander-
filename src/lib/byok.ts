/**
 * Beta key setup: bring your own key.
 *
 * Nobody's key ships with the product. A visitor supplies their own Gemini key, it lives in this tab only
 * (sessionStorage: gone when the tab closes), and it travels to the server in a header on the few open "studio" requests
 * that call a model. The server uses it for that one call and neither stores nor logs it.
 *
 * When the product goes public and the key setup changes, change this file (where the browser gets a key) and
 * resolveStudioKey() in src/server/byok.ts (where the server gets one). Nothing else depends on where the key comes from.
 *
 * Shared by the browser and the server, so it has no dependencies.
 */

export const BYOK_HEADER = "x-gemini-key";

/** Visible ASCII, 20-200 characters: rules out whitespace, control characters and header-injection tricks. */
const PLAUSIBLE = /^[\x21-\x7e]{20,200}$/;

/** A shape check only. Whether Google accepts the key is Google's answer to give. */
export const isPlausibleGeminiKey = (value: unknown): value is string => typeof value === "string" && PLAUSIBLE.test(value);

/* ---- the browser's copy ----------------------------------------------------------------------------------------- */

const STORAGE_KEY = "orator.byok.gemini";
const CHANGE_EVENT = "orator:byok-change";

// Used when sessionStorage is unavailable (blocked, or a private window), so the key still works for this page's lifetime.
let memoryKey: string | undefined;

function readStorage(): string | undefined {
  try {
    return (typeof sessionStorage === "undefined" ? undefined : sessionStorage.getItem(STORAGE_KEY)) ?? undefined;
  } catch {
    return undefined;
  }
}

function announce(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getGeminiKey(): string | undefined {
  const key = readStorage() ?? memoryKey;
  return isPlausibleGeminiKey(key) ? key : undefined;
}

/** Returns false, and stores nothing, if the text could not be a key. */
export function setGeminiKey(raw: string): boolean {
  const key = raw.trim();
  if (!isPlausibleGeminiKey(key)) return false;
  memoryKey = key;
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* held in memory only */
  }
  announce();
  return true;
}

export function clearGeminiKey(): void {
  memoryKey = undefined;
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing stored */
  }
  announce();
}

/** Adds the key header to a request's headers when the visitor has supplied a key. */
export function withGeminiKey(headers: Record<string, string> = {}): Record<string, string> {
  const key = getGeminiKey();
  return key ? { ...headers, [BYOK_HEADER]: key } : headers;
}

/** For useSyncExternalStore. */
export function subscribeGeminiKey(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
