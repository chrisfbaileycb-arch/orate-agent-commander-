import React, { useEffect, useRef } from "react";
import type { IngestItem } from "../lib/types";

interface ConversationDockProps {
  draft: string;
  onDraftChange: (text: string) => void;
  onSubmit: (text: string) => void;
  disabled: boolean;
  busy: boolean;
  maxLength: number;
  placeholder?: string;
  suggestions?: string[];
  micState: "idle" | "listening";
  micPartial: string;
  onStartListen: () => void;
  onCancelListen: () => void;
  micSupported: boolean;
  showTranscript: boolean;
  onToggleTranscript: () => void;
  repoOpen: boolean;
  onToggleRepo: () => void;
  repoUrl: string;
  onRepoUrlChange: (url: string) => void;
  onConnectRepo: () => void;
  onTriggerFileAttach: () => void;
  lastError: string | null;
  onRetry: () => void;
}

export function ConversationDock({
  draft,
  onDraftChange,
  onSubmit,
  disabled,
  busy,
  maxLength,
  placeholder = "Your answer…",
  suggestions = [],
  micState,
  micPartial,
  onStartListen,
  onCancelListen,
  micSupported,
  showTranscript,
  onToggleTranscript,
  repoOpen,
  onToggleRepo,
  repoUrl,
  onRepoUrlChange,
  onConnectRepo,
  onTriggerFileAttach,
  lastError,
  onRetry,
}: ConversationDockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  // Auto-resize textarea height up to 160px then scroll
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, 44), 160);
    el.style.height = `${nextHeight}px`;
  }, [draft, micPartial, micState]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (repoOpen) onToggleRepo();
      if (showTranscript) onToggleTranscript();
      if (micState === "listening") onCancelListen();
      return;
    }

    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Shift+Enter creates a new line naturally
        return;
      }
      if (isComposingRef.current) {
        // Prevent submission during IME composition
        return;
      }
      e.preventDefault();
      if (!disabled && !busy) {
        const textToSubmit = micState === "listening" && micPartial ? micPartial : draft;
        onSubmit(textToSubmit);
      }
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
  };

  const charsRemaining = maxLength - draft.length;
  const isNearLimit = charsRemaining <= Math.max(50, Math.floor(maxLength * 0.15));

  return (
    <nav
      aria-label="Inquest conversational dock"
      className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-3 sm:bottom-6 sm:px-6 safe-area-pb pointer-events-auto"
    >
      <div className="w-full sm:w-[94%] md:w-[84%] lg:w-[68%] max-w-4xl flex flex-col items-center">
        {/* Quick-select chips float just above the dock */}
        {suggestions.length > 0 && !busy && micState !== "listening" && (
          <div
            role="group"
            aria-label="Suggested quick answers"
            className="mb-2 flex flex-wrap justify-center gap-1.5 max-h-20 overflow-y-auto px-2"
          >
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSubmit(s)}
                className="rounded-full border border-seam/80 bg-depth/70 backdrop-blur-md px-3.5 py-1.5 font-mono-hud text-[10px] text-forge-dim transition-all hover:border-forge-cyan/60 hover:text-pearl hover:bg-depth/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forge-cyan"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Read-only repo connect overlay panel */}
        {repoOpen && (
          <div className="mb-2 w-full rounded-2xl border border-forge-gold/40 bg-depth/95 p-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-1.5 flex items-center justify-between font-mono-hud text-[10px] tracking-wider text-forge-gold">
              <span>READ-ONLY REPOSITORY INGEST</span>
              <button
                type="button"
                onClick={onToggleRepo}
                className="text-forge-dim hover:text-pearl focus:outline-none"
                aria-label="Close repository panel"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={repoUrl}
                onChange={(e) => onRepoUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onConnectRepo();
                  if (e.key === "Escape") onToggleRepo();
                }}
                placeholder="https://github.com/owner/repo or git@github.com:owner/repo.git"
                className="input-forge !border-seam/70 !py-2 font-mono-hud text-[11px] text-pearl flex-1"
                autoFocus
              />
              <button
                type="button"
                onClick={onConnectRepo}
                className="btn-forge btn-primary shrink-0 px-4 py-2 text-[10px]"
              >
                INGEST (RO)
              </button>
            </div>
          </div>
        )}

        {/* Recoverable Submission Error Banner */}
        {lastError && (
          <div
            role="alert"
            className="mb-2 flex w-full items-center justify-between rounded-xl border border-forge-alert/50 bg-forge-alert/15 px-4 py-2 font-mono-hud text-[11px] text-forge-alert shadow-lg backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden>⚠</span>
              <span>{lastError}</span>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="ml-3 shrink-0 rounded border border-forge-alert/60 px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors hover:bg-forge-alert/20"
            >
              Retry
            </button>
          </div>
        )}

        {/* Live Interim Speech Transcription Pill */}
        {micState === "listening" && (
          <div
            aria-live="polite"
            className="mb-2 w-full rounded-xl border border-forge-gold/60 bg-depth/90 px-4 py-2.5 shadow-xl backdrop-blur-xl animate-fade-in"
          >
            <div className="flex items-center justify-between mb-1 font-mono-hud text-[10px] tracking-wider text-forge-gold">
              <span className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-forge-gold animate-ping" />
                LISTENING TO YOUR VOICE…
              </span>
              <button
                type="button"
                onClick={onCancelListen}
                className="text-[10px] uppercase text-forge-dim hover:text-forge-alert transition-colors"
                aria-label="Cancel voice listening"
              >
                Cancel
              </button>
            </div>
            <p className="font-mono text-[13px] text-pearl italic min-h-[1.3rem] break-words">
              {micPartial ? (
                <>
                  <span className="text-forge-gold">{micPartial}</span>
                  <span className="animate-pulse ml-0.5">|</span>
                </>
              ) : (
                <span className="text-forge-dim/60">Speak now — the Orator is attuned to your voice…</span>
              )}
            </p>
          </div>
        )}

        {/* Main Conversation Dock Card */}
        <div className="relative w-full rounded-3xl border border-seam/80 bg-depth/85 p-2 sm:p-2.5 shadow-[0_16px_48px_rgba(2,4,10,0.85)] backdrop-blur-2xl transition-all">
          <div className="flex items-end gap-2">
            {/* Primary Action: Microphone Button */}
            {micSupported ? (
              <button
                type="button"
                onClick={micState === "listening" ? onCancelListen : onStartListen}
                disabled={disabled || busy}
                aria-label={micState === "listening" ? "Stop microphone" : "Answer with your voice"}
                title={micState === "listening" ? "Click to stop listening" : "Answer with your voice"}
                className={`btn-forge shrink-0 rounded-2xl px-3.5 py-3 sm:px-4 text-[11px] font-semibold transition-all ${
                  micState === "listening"
                    ? "bg-forge-gold text-abyss shadow-[0_0_16px_rgba(230,175,46,0.6)]"
                    : "btn-gold hover:scale-[1.02] active:scale-95"
                }`}
              >
                {micState === "listening" ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-abyss animate-pulse" />
                    <span>STOP</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden>🎙</span>
                    <span className="hidden sm:inline">SPEAK</span>
                  </span>
                )}
              </button>
            ) : (
              <span
                aria-label="Microphone unsupported in this browser"
                className="shrink-0 rounded-2xl border border-seam/60 bg-depth/40 px-2.5 py-3 font-mono-hud text-[9px] text-forge-dim/50"
              >
                NO MIC
              </span>
            )}

            {/* Multiline Response Field */}
            <div className="relative min-w-0 flex-1">
              <label htmlFor="inquest-response-input" className="sr-only">
                Your Answer to the Orator
              </label>
              <textarea
                id="inquest-response-input"
                ref={textareaRef}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder={
                  micState === "listening"
                    ? "Orator listening… you may also type your answer here."
                    : placeholder
                }
                disabled={disabled || busy}
                maxLength={maxLength}
                rows={1}
                aria-describedby="char-count"
                className="w-full resize-none border-0 bg-transparent px-2.5 py-2 font-mono text-[13px] sm:text-[14px] leading-relaxed text-pearl outline-none placeholder:text-forge-dim/55 focus:ring-0 max-h-40 overflow-y-auto"
              />
            </div>

            {/* Prominent Send Control */}
            <button
              type="button"
              onClick={() => onSubmit(draft)}
              disabled={disabled || busy || !draft.trim()}
              aria-label="Submit answer to the Orator"
              title="Submit answer (Enter)"
              className={`btn-forge shrink-0 rounded-2xl px-4 py-3 text-[11px] font-semibold transition-all ${
                draft.trim() && !disabled && !busy
                  ? "btn-primary hover:scale-[1.02] active:scale-95 shadow-[0_0_12px_rgba(53,224,255,0.35)]"
                  : "opacity-40 cursor-not-allowed bg-depth/50 text-forge-dim border border-seam/60"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>SEND</span>
                <span aria-hidden className="hidden sm:inline text-[9px] opacity-75 font-mono">↵</span>
              </span>
            </button>
          </div>

          {/* Dock Footer: Secondary Actions & Metadata */}
          <div className="mt-1.5 flex items-center justify-between border-t border-seam/40 pt-1.5 px-2 font-mono-hud text-[10px]">
            {/* Secondary Utilities: Repository, Attachment, Transcript */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleTranscript}
                aria-label="Toggle full conversation transcript"
                title="Conversation transcript"
                className={`rounded-lg px-2 py-1 transition-colors ${
                  showTranscript
                    ? "bg-forge-cyan/20 text-forge-cyan"
                    : "text-forge-dim hover:text-forge-cyan"
                }`}
              >
                <span className="flex items-center gap-1">
                  <span aria-hidden>☰</span>
                  <span className="hidden sm:inline">TRANSCRIPT</span>
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleRepo}
                aria-label="Connect repository (read-only)"
                title="Connect repository — read-only, no push or write"
                className={`rounded-lg px-2 py-1 transition-colors ${
                  repoOpen
                    ? "bg-forge-gold/20 text-forge-gold"
                    : "text-forge-dim hover:text-forge-gold"
                }`}
              >
                <span className="flex items-center gap-1">
                  <span aria-hidden>🔗</span>
                  <span className="hidden sm:inline">REPO (RO)</span>
                </span>
              </button>

              <button
                type="button"
                onClick={onTriggerFileAttach}
                aria-label="Attach documents, code, or images (video blocked)"
                title="Attach files (video blocked)"
                className="rounded-lg px-2 py-1 text-forge-dim transition-colors hover:text-forge-cyan"
              >
                <span className="flex items-center gap-1">
                  <span aria-hidden>📎</span>
                  <span className="hidden sm:inline">ATTACH</span>
                </span>
              </button>
            </div>

            {/* Keyboard Hint & Character Count Indicator */}
            <div id="char-count" className="flex items-center gap-3">
              <span className="hidden md:inline text-forge-dim/60 text-[9px]">
                Enter to send · Shift+Enter for newline
              </span>
              <span
                className={`text-[9.5px] tabular-nums ${
                  isNearLimit ? "text-forge-alert font-bold" : "text-forge-dim/60"
                }`}
              >
                {charsRemaining} left
              </span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
