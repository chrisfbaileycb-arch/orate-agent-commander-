import React, { useState, useSyncExternalStore } from "react";
import { clearGeminiKey, getGeminiKey, setGeminiKey, subscribeGeminiKey } from "../lib/byok";

/**
 * Beta key setup: bring your own Gemini key. Nobody's key ships with the product; a tester pastes theirs here and the open
 * studio requests carry it (see src/lib/byok.ts). Without one, those requests return clearly labelled demo results.
 * When the product goes public and the key setup changes, this component and src/lib/byok.ts are what change.
 */
export default function ByokKeyControl() {
  const hasKey = useSyncExternalStore(
    subscribeGeminiKey,
    () => Boolean(getGeminiKey()),
    () => false,
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (hasKey) {
    return (
      <div data-testid="byok-active" className="inline-flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/70 bg-emerald-950/70 px-2.5 py-1 font-bold text-emerald-100">
          <span aria-hidden="true">✓</span> Your Gemini key is in use (this tab only)
        </span>
        <button
          type="button"
          onClick={() => {
            clearGeminiKey();
            setError(null);
          }}
          className="rounded-md border border-slate-500 bg-slate-900 px-2.5 py-1 font-bold text-slate-100 hover:border-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          Forget key
        </button>
      </div>
    );
  }

  return (
    <form
      data-testid="byok-form"
      className="inline-flex flex-wrap items-center gap-2 text-sm"
      aria-live="polite"
      onSubmit={(e) => {
        e.preventDefault();
        if (setGeminiKey(draft)) {
          setDraft("");
          setError(null);
        } else {
          setError("That doesn't look like a Gemini API key.");
        }
      }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/70 bg-amber-950/70 px-2.5 py-1 font-bold text-amber-100">
        <span aria-hidden="true">!</span> Demo mode: no live model
      </span>
      <input
        data-testid="byok-input"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste your Gemini API key"
        aria-label="Your Gemini API key"
        className="w-56 rounded-md border border-slate-500 bg-slate-950 px-2 py-1 text-slate-100 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      />
      <button
        type="submit"
        disabled={draft.trim().length === 0}
        className="rounded-md border border-cyan-500/70 bg-cyan-950/70 px-2.5 py-1 font-bold text-cyan-100 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        Use my key
      </button>
      {error && (
        <span role="alert" className="text-red-300">
          {error}
        </span>
      )}
      <details className="basis-full text-slate-300">
        <summary className="cursor-pointer text-slate-200">Why do I need a key?</summary>
        <p className="mt-1 max-w-xl leading-relaxed">
          This beta doesn't ship a key. Paste your own to use live models. It stays in this browser tab (gone when you close it), is sent to this server only
          to make your request, and is never stored or logged. Use a restricted key with a low quota. You can make one at{" "}
          <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            aistudio.google.com/apikey
          </a>
          .
        </p>
      </details>
    </form>
  );
}
