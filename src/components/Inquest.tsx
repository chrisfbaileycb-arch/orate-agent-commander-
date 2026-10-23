import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { INQUEST_QUESTIONS, phaseOf } from "../lib/inquest";
import { sanitizeAnswer, INPUT_LIMITS } from "../lib/security";
import { listen, listeningSupported, orate, hush, strikeSound } from "../lib/voice";
import type { IngestItem, IngestKind } from "../lib/types";
import OrbOfTheOrator from "./OrbOfTheOrator";
import { ConversationDock } from "./ConversationDock";
import { useAudioReactivity } from "../lib/useAudioReactivity";
import type { OrbInteractionState } from "../lib/audio-types";
import { oratorVoice } from "../lib/voice-service";

/**
 * THE INQUEST — a stage, not a form.
 * The Orator Orb commands the visual field; its voice is projected beneath it
 * in clean type with a speaking pulse. You answer from an enlarged, accessible
 * floating conversation dock — typing, chips, files (never video), a read-only repo,
 * or your voice, which is the natural, primary mode: tap the mic or strike the orb to speak.
 * Past exchanges fade out translucent above the orb; a slide-out sheet keeps
 * the full transcript one tap away.
 */

interface Props {
  answers: Record<string, string>;
  ingest: IngestItem[];
  onAnswer: (questionId: string, value: string) => void;
  onIngest: (item: IngestItem) => void;
  onComplete: () => void;
  onExit: () => void;
}

type Tone = "orator" | "user" | "attach" | "sys";
interface HistoryEntry {
  id: number;
  tone: Tone;
  text: string;
  sub?: string;
}

const ACKS = [
  "Sealed into the brief.",
  "The quorum notes that.",
  "Understood — writing it into the contract.",
  "Captured. The shape is sharpening.",
  "Good. The forge adapts.",
  "Noted with precision.",
  "Into the ledger it goes.",
  "The architects are listening.",
  "That refines the invariant set.",
  "Sealed. Moving the needle forward.",
  "The schema expert appreciates that.",
  "Locked into the build brief.",
  "Understood — the operations team concurs.",
  "V2 headroom noted.",
  "The final constraint is honored.",
];

const BLOCKED_VIDEO = /\.(mp4|mov|webm|mkv|avi|m4v|wmv|flv|3gp|mpeg|mpg)$/i;

export default function Inquest({ answers, ingest, onAnswer, onIngest, onComplete, onExit }: Props) {
  const doneCount = Object.keys(answers).length;
  const current = useMemo(
    () => (doneCount < INQUEST_QUESTIONS.length ? INQUEST_QUESTIONS[doneCount] : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doneCount, answers]
  );

  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"awaiting" | "thinking" | "sealing">("awaiting");
  const [ack, setAck] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [micState, setMicState] = useState<"idle" | "listening">("idle");
  const [micPartial, setMicPartial] = useState("");
  const [lastSubmissionError, setLastSubmissionError] = useState<string | null>(null);
  const [failedSubmissionText, setFailedSubmissionText] = useState<string | null>(null);
  const [wordRippleCount, setWordRippleCount] = useState(0);

  const [warn, setWarn] = useState<{ text: string; id: number } | null>(null);
  const [note, setNote] = useState<{ text: string; id: number } | null>(null);
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [showSheet, setShowSheet] = useState(false);

  // Derive explicit Orb interaction state model
  const orbInteractionState: OrbInteractionState = useMemo(() => {
    if (warn) return "WARNING";
    if (mode === "sealing") return "SUCCESS";
    if (mode === "thinking") return "PROCESSING";
    if (speaking) return "ORATOR_SPEAKING";
    if (micState === "listening") {
      return micPartial.trim().length > 0 ? "USER_SPEAKING" : "LISTENING";
    }
    return "IDLE";
  }, [warn, mode, speaking, micState, micPartial]);

  // Real-time audio reactivity hook
  const { signal: audioSignal } = useAudioReactivity({
    state: orbInteractionState,
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const seed: HistoryEntry[] = [
      {
        id: 0,
        tone: "orator",
        text: "I am the Orator. Fifteen questions stand between your intent and a forged blueprint.",
      },
    ];
    let id = 1;
    for (const item of ingest) {
      seed.push({ id: id++, tone: "attach", text: ingestLabel(item), sub: item.meta });
    }
    for (let i = 0; i < doneCount; i++) {
      const q = INQUEST_QUESTIONS[i];
      seed.push({ id: id++, tone: "orator", text: q.prompt, sub: q.phase });
      const val = answers[q.id] ?? "";
      seed.push({ id: id++, tone: "user", text: val });
    }
    return seed;
  });
  const histId = useRef(history.length);
  const lastUserText = useMemo(() => {
    const last = [...history].reverse().find((h) => h.tone === "user");
    return last?.text ?? null;
  }, [history]);

  const timers = useRef<number[]>([]);
  const sealingRef = useRef(false);
  const spokeFirst = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeListenHandleRef = useRef<{ stop: () => void } | null>(null);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const pushHist = (tone: Tone, text: string, sub?: string) =>
    setHistory((h) => [...h, { id: histId.current++, tone, text, sub }]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      if (activeListenHandleRef.current) {
        activeListenHandleRef.current.stop();
      }
      hush();
    };
  }, []);

  // Auto-scroll history sheet
  useEffect(() => {
    if (chatBottomRef.current && showSheet) chatBottomRef.current.scrollTop = chatBottomRef.current.scrollHeight;
  }, [history, showSheet]);

  // When a new question arrives, the Orator speaks it aloud
  const qid = current?.id ?? null;
  useEffect(() => {
    if (!current) return;
    if (!spokeFirst.current) {
      spokeFirst.current = true;
      return; // resume/seed: no auto oration on arrival
    }
    setSpeaking(true);
    void orate(`${current.prompt} ${current.hint ?? ""}`).then(() => {
      later(280, () => setSpeaking(false));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qid]);

  const limitOf = (qid: string) => {
    const i = INQUEST_QUESTIONS.findIndex((x) => x.id === qid);
    return i % 5 === 0 ? INPUT_LIMITS.short : INPUT_LIMITS.long;
  };

  const flashWarn = (text: string) => setWarn({ text, id: Date.now() });
  const flashNote = (text: string) => setNote({ text, id: Date.now() });

  useEffect(() => {
    if (!warn) return;
    const t = window.setTimeout(() => setWarn(null), 3600);
    return () => window.clearTimeout(t);
  }, [warn]);
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 3800);
    return () => window.clearTimeout(t);
  }, [note]);

  // Submission handler with draft preservation and error recovery
  const send = (raw: string) => {
    const q = current;
    if (!q || mode !== "awaiting" || sealingRef.current) return;

    if (!raw.trim()) {
      flashWarn("THE ORATOR REQUIRES AN ANSWER — EVEN A FRAGMENT WILL DO");
      return;
    }

    const value = sanitizeAnswer(raw, limitOf(q.id));
    if (!value) {
      setLastSubmissionError("Input contained prohibited characters or was completely filtered");
      setFailedSubmissionText(raw);
      flashWarn("THE ORATOR REQUIRES A VALID ANSWER");
      return;
    }

    try {
      // Clear error states on accepted submission
      setLastSubmissionError(null);
      setFailedSubmissionText(null);
      setDraft("");
      setMicPartial("");
      setAck(ACKS[Math.min(doneCount, ACKS.length - 1)]);
      setMode("thinking");
      pushHist("user", value);
      strikeSound(0.55);

      onAnswer(q.id, value);

      if (doneCount >= INQUEST_QUESTIONS.length - 1) {
        // Fifteenth answer — seal the inquest
        const t1 = window.setTimeout(() => {
          setAck("All fifteen answers sealed.");
          pushHist("sys", "ALL FIFTEEN ANSWERS SEALED — CONVENING THE QUORUM…");
        }, 700);
        timers.current.push(t1);
        const t2 = window.setTimeout(() => {
          setAck(null);
          setMode("sealing");
        }, 1350);
        timers.current.push(t2);
        const t3 = window.setTimeout(() => {
          if (!sealingRef.current) {
            sealingRef.current = true;
            onComplete();
          }
        }, 2500);
        timers.current.push(t3);
        return;
      }

      timers.current.push(
        window.setTimeout(() => {
          setAck(null);
          setMode("awaiting");
        }, 720)
      );
    } catch (err) {
      // Submission failure: preserve draft and display recoverable error
      setDraft(raw);
      setFailedSubmissionText(raw);
      setLastSubmissionError(err instanceof Error ? err.message : "Failed to record answer");
      setMode("awaiting");
    }
  };

  const retryLastSubmission = () => {
    if (failedSubmissionText) {
      send(failedSubmissionText);
    }
  };

  // ---- Voice: the primary mode ----
  const startListen = useCallback(() => {
    if (micState === "listening" || mode !== "awaiting") return;
    setMicPartial("");
    setMicState("listening");

    // Cancel any active Orator speech when the user starts speaking
    hush();
    setSpeaking(false);

    listen({
      onPartial: (partial) => {
        setMicPartial(partial);
      },
      onWord: () => {
        // Trigger subtle wave shockwave across the orb
        setWordRippleCount((c) => c + 1);
      },
    })
      .then(({ text, handle }) => {
        activeListenHandleRef.current = null;
        setMicState("idle");
        setMicPartial("");
        if (text) {
          send(text);
        }
      })
      .catch((err) => {
        activeListenHandleRef.current = null;
        setMicState("idle");
        setMicPartial("");
        flashWarn("Microphone unavailable or permission denied — you can type comfortably below.");
      });
  }, [micState, mode]);

  const cancelListen = useCallback(() => {
    if (activeListenHandleRef.current) {
      activeListenHandleRef.current.stop();
      activeListenHandleRef.current = null;
    }
    setMicState("idle");
    setMicPartial("");
  }, []);

  // ---- Attachments (documents, code, images — video explicitly blocked) ----
  const onFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const blocked = files.filter((f) => f.type.startsWith("video/") || BLOCKED_VIDEO.test(f.name));
    if (blocked.length > 0) {
      flashWarn("VIDEO UPLOADS ARE BLOCKED — DOCUMENTS, CODE FILES, AND IMAGES ONLY");
      return;
    }
    files.forEach((f) => {
      const kind: IngestKind = f.type.startsWith("image/")
        ? "image"
        : f.name.match(/\.(py|ts|tsx|js|jsx|sql|html|css|json|md|txt)$/i)
        ? "code"
        : "document";
      const item: IngestItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        name: f.name.slice(0, 120),
        meta: `${formatBytes(f.size)} · queued for read-only contextual analysis`,
        addedAt: Date.now(),
      };
      onIngest(item);
      pushHist("attach", ingestLabel(item), item.meta);
    });
    flashNote(`ATTACHED ${files.length} FILE${files.length === 1 ? "" : "S"} — VIDEO BLOCKED · READ-ONLY CONTEXT`);
    strikeSound(0.35);
  };

  // ---- Connect repository (READ-ONLY ingest) ----
  const connectRepo = () => {
    const url = repoUrl.trim();
    const ok = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/i.test(url) && url.length >= 8 && !/\s/.test(url);
    if (!ok) {
      flashWarn("ENTER A VALID GIT URL — e.g. https://github.com/owner/repo");
      return;
    }
    const item: IngestItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "repo",
      name: url.replace(/^https?:\/\//, "").replace(/\.git$/i, "").slice(0, 160),
      meta: "READ-ONLY INGEST — no push, no write, no remote mutation. Context only.",
      addedAt: Date.now(),
    };
    onIngest(item);
    pushHist("attach", ingestLabel(item), item.meta);
    flashNote("REPOSITORY CONNECTED (READ-ONLY) — CONTEXT ONLY");
    setRepoUrl("");
    setRepoOpen(false);
    strikeSound(0.35);
  };

  const verseId = qid ?? "sealed";
  const busy = mode !== "awaiting";
  const questionLimit = limitOf(current?.id ?? "q1");

  return (
    <div className="relative mx-auto flex min-h-screen w-full flex-col px-4 pb-64 pt-20 sm:px-6">
      {/* Celestial light emanating outward from the orb */}
      <div aria-hidden className="sanctum-aureole pointer-events-none fixed inset-0" />

      {/* Progress whisper */}
      <div className="relative z-10 mb-2 text-center font-mono-hud text-[9px] tracking-[0.3em] text-forge-dim/80">
        {current ? `${phaseOf(doneCount)} · QUESTION ${String(doneCount + 1).padStart(2, "0")} / 15` : "INQUEST SEALED"}
        <span className="mx-2 text-seam">|</span>
        {doneCount} ANSWERED
      </div>

      {/* Stage */}
      <div className="relative z-10 flex flex-1 flex-col items-center">
        {/* Translucent echo of the last exchange — history fades above the orb */}
        {lastUserText && !busy && current && (
          <div className="pointer-events-none mb-1 max-w-xl truncate text-center text-[11.5px] italic leading-relaxed text-forge-dim/45">
            ↳ you: {lastUserText}
          </div>
        )}

        {/* The Orator commands the field */}
        <OrbOfTheOrator
          className="mx-auto w-[min(70vw,480px)]"
          audioSignal={audioSignal}
          wordPulseCount={wordRippleCount}
          onStrike={() => {
            if (listeningSupported()) {
              if (micState === "listening") cancelListen();
              else startListen();
            }
          }}
          showWakeLine={false}
        />

        {/* Voice projection — clean, high-contrast, beneath the orb */}
        <div className="mt-4 min-h-[6.5rem] w-full max-w-3xl text-center sm:min-h-[7.5rem]">
          {mode === "sealing" ? (
            <div key="seal" className="orb-verse">
              <div className="speak-bars mx-auto mb-4 h-5">
                <span /><span /><span /><span /><span />
              </div>
              <div className="font-mono-hud text-[10px] tracking-[0.4em] text-forge-gold text-glow-gold">
                INQUEST SEALED
              </div>
              <h2 className="mt-3 font-display text-2xl font-semibold leading-snug text-pearl">
                The quorum convenes. The forge awakens.
              </h2>
            </div>
          ) : current ? (
            <div key={verseId} className="orb-verse">
              {/* Speaking pulse sits with the question */}
              <div className="mb-2.5 flex items-center justify-center gap-3">
                {speaking || mode === "thinking" ? (
                  <span className="speak-bars h-3.5" aria-label="The Orator is speaking">
                    <span /><span /><span /><span /><span />
                  </span>
                ) : (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-forge-cyan animate-pulse-soft" />
                )}
              </div>
              <h2 className="mx-auto max-w-2xl font-display text-[22px] font-semibold leading-snug tracking-tight text-pearl sm:text-[30px]">
                {current.prompt}
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-forge-dim">
                {current.hint}
              </p>
              {ack && mode === "thinking" && (
                <p key={ack} className="verse-ack mt-2 text-[12px] italic text-forge-cyan/70">
                  {ack}
                </p>
              )}
            </div>
          ) : (
            /* Answers complete — brief convergence beat before the seal */
            <div key="final" className="orb-verse">
              <div className="mb-3 flex items-center justify-center gap-3">
                <span className="speak-bars h-3.5" aria-label="The Orator is converging">
                  <span /><span /><span /><span /><span />
                </span>
              </div>
              <h2 className="mx-auto max-w-xl font-display text-[20px] font-semibold leading-snug tracking-tight text-pearl sm:text-[26px]">
                The Orator weighs your fifteenth answer…
              </h2>
              {ack && <p className="verse-ack mt-2 text-[12px] italic text-forge-cyan/70">{ack}</p>}
            </div>
          )}
        </div>
      </div>

      {/* ============ Floating response dock ============ */}
      <ConversationDock
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={send}
        disabled={!current || busy}
        busy={busy}
        maxLength={questionLimit}
        placeholder={current?.placeholder ?? "The inquest is complete."}
        suggestions={current?.suggestions ?? []}
        micState={micState}
        micPartial={micPartial}
        onStartListen={startListen}
        onCancelListen={cancelListen}
        micSupported={listeningSupported()}
        showTranscript={showSheet}
        onToggleTranscript={() => setShowSheet((s) => !s)}
        repoOpen={repoOpen}
        onToggleRepo={() => setRepoOpen((r) => !r)}
        repoUrl={repoUrl}
        onRepoUrlChange={setRepoUrl}
        onConnectRepo={connectRepo}
        onTriggerFileAttach={() => fileRef.current?.click()}
        lastError={lastSubmissionError}
        onRetry={retryLastSubmission}
      />

      {/* Warnings / confirmations */}
      <div className="fixed bottom-1 left-0 right-0 z-20 flex justify-center pointer-events-none">
        {warn && (
          <span
            key={warn.id}
            role="alert"
            className="animate-drift-up rounded-full border border-forge-alert/40 bg-forge-alert/15 px-3.5 py-1 font-mono-hud text-[10px] tracking-[0.08em] text-forge-alert shadow-lg backdrop-blur-md"
          >
            ⚠ {warn.text}
          </span>
        )}
        {note && !warn && (
          <span
            key={note.id}
            className="animate-drift-up rounded-full border border-forge-cyan/30 bg-forge-cyan/10 px-3.5 py-1 font-mono-hud text-[10px] tracking-[0.08em] text-forge-cyan/90 shadow-lg backdrop-blur-md"
          >
            ✓ {note.text}
          </span>
        )}
      </div>

      {/* ============ Optional transcript sheet ============ */}
      {showSheet && (
        <aside
          aria-label="Inquest conversation transcript"
          className="fixed bottom-36 right-4 top-20 z-40 w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-seam/70 bg-abyss/90 shadow-[0_18px_60px_rgba(3,6,12,0.85)] backdrop-blur-2xl flex flex-col"
        >
          <div className="flex items-center justify-between border-b border-seam/70 px-4 py-3 bg-depth/50">
            <span className="font-mono-hud text-[10px] tracking-[0.22em] text-pearl font-semibold">
              INQUEST TRANSCRIPT
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono-hud text-[9px] text-forge-cyan/80">{doneCount}/15</span>
              <button
                type="button"
                onClick={() => setShowSheet(false)}
                className="text-forge-dim hover:text-pearl transition-colors"
                aria-label="Close transcript"
              >
                ✕
              </button>
            </div>
          </div>
          <div ref={chatBottomRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {history.map((h) => (
              <div key={h.id}>
                {h.tone === "attach" ? (
                  <div className="rounded-lg border border-forge-gold/30 bg-forge-gold/10 px-3 py-2">
                    <div className="font-mono-hud text-[10px] font-bold text-forge-gold">{h.text}</div>
                    {h.sub && <div className="text-[9px] text-forge-dim mt-0.5">{h.sub}</div>}
                  </div>
                ) : h.tone === "sys" ? (
                  <div className="text-center font-mono-hud text-[8.5px] tracking-[0.14em] text-forge-dim py-1">
                    {h.text}
                  </div>
                ) : h.tone === "orator" ? (
                  <div className="border-l-2 border-forge-cyan/50 pl-3 py-0.5">
                    <div className="text-[11px] leading-snug text-pearl/90">{h.text}</div>
                    {h.sub && <div className="mt-0.5 font-mono-hud text-[8.5px] tracking-[0.18em] text-forge-dim/70">{h.sub}</div>}
                  </div>
                ) : (
                  <div className="text-right text-[11.5px] italic leading-snug text-forge-cyan/90 pl-6">
                    {h.text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Exit */}
      <button
        type="button"
        onClick={onExit}
        className="fixed bottom-3 left-3 z-30 font-mono-hud text-[9px] tracking-[0.18em] text-forge-dim/70 transition-colors hover:text-forge-alert"
        title="Abandon inquest"
      >
        ✕ ABANDON
      </button>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".txt,.md,.json,.csv,.pdf,.doc,.docx,image/*,text/*,.py,.ts,.tsx,.js,.jsx,.sql,.html,.css"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Bubble/note label for a persisted context item. */
function ingestLabel(item: IngestItem): string {
  const prefix =
    item.kind === "repo"
      ? "🔗 REPOSITORY"
      : item.kind === "image"
      ? "IMAGE"
      : item.kind === "code"
      ? "CODE FILE"
      : "DOCUMENT";
  return `${prefix} · ${item.name}`;
}
