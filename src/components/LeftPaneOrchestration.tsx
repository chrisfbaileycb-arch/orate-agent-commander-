import React, { useState, useEffect, useRef } from "react";
import CortexTorus3D from "./cortex/CortexTorus3D";
import type { CortexReasoningStep } from "../lib/cortex/types";
import { INQUEST_QUESTIONS } from "../lib/inquest";
import { orate, hush, listen, listeningSupported, type ListenHandle } from "../lib/voice";

interface Props {
  activeAgentName?: string;
  isAgentGenerating?: boolean;
  onAnswerSubmit?: (questionId: string, answer: string) => void;
  onInquestComplete?: () => void;
  onOpenCortex?: () => void;
}

export default function LeftPaneOrchestration({
  activeAgentName = "Claude Sonnet 5",
  isAgentGenerating = false,
  onAnswerSubmit,
  onInquestComplete,
  onOpenCortex,
}: Props) {
  // Current active question index (0 to 14 -> Question 1 to 15)
  // Default to question 3 (Question 04 of 15) to showcase:
  // "What is your primary persistence model: local SQLite or multi-tenant cloud?"
  const [currentQIndex, setCurrentQIndex] = useState(3);
  const [answers, setAnswers] = useState<Record<string, string>>({
    q1: "Print app with micro fighting and certificate generator",
    q2: "Duel champions and tournament organizers printing victory certificates",
    q3: "Playable 2D retro sword combat and instant 300 DPI parchment print export",
  });
  const [inputValue, setInputValue] = useState("");
  const [isOratorSpeaking, setIsOratorSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [shockwaveTrigger, setShockwaveTrigger] = useState(0);
  const [isInquestComplete, setIsInquestComplete] = useState(false);
  const [waveHeights, setWaveHeights] = useState<number[]>([12, 18, 26, 14, 22, 16, 20]);

  const listenHandleRef = useRef<ListenHandle | null>(null);

  // Custom prompt override for Question 4 per prompt directive
  const currentQ = INQUEST_QUESTIONS[currentQIndex] || INQUEST_QUESTIONS[0];
  const activePromptText =
    currentQIndex === 3
      ? "What is your primary persistence model: local SQLite or multi-tenant cloud?"
      : currentQ.prompt;

  const answeredCount = Object.keys(answers).length;

  // Waveform animation reactive to Orator speech, user speech & deliberation
  useEffect(() => {
    const isPulsing = isOratorSpeaking || isUserSpeaking || isAgentGenerating;
    const interval = setInterval(() => {
      if (isPulsing) {
        setWaveHeights([
          Math.floor(8 + Math.random() * 24),
          Math.floor(12 + Math.random() * 26),
          Math.floor(16 + Math.random() * 28),
          Math.floor(10 + Math.random() * 24),
          Math.floor(14 + Math.random() * 26),
          Math.floor(8 + Math.random() * 20),
          Math.floor(12 + Math.random() * 22),
        ]);
      } else {
        setWaveHeights([8, 12, 16, 12, 14, 10, 8]);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isOratorSpeaking, isUserSpeaking, isAgentGenerating]);

  // Read current question when user taps Listen
  const speakCurrentQuestion = async () => {
    if (isOratorSpeaking) {
      hush();
      setIsOratorSpeaking(false);
      return;
    }

    try {
      setIsOratorSpeaking(true);
      await orate(activePromptText);
    } catch {
      // Speech ended or cancelled
    } finally {
      setIsOratorSpeaking(false);
    }
  };

  // Toggle user voice listening
  const toggleUserListening = async () => {
    if (isUserSpeaking) {
      if (listenHandleRef.current) {
        listenHandleRef.current.stop();
        listenHandleRef.current = null;
      }
      setIsUserSpeaking(false);
      return;
    }

    if (!listeningSupported()) {
      // Fallback: simulate voice input
      setIsUserSpeaking(true);
      setTimeout(() => {
        setIsUserSpeaking(false);
        handleSaveAnswer("Multi-tenant PostgreSQL on AWS RDS with schema isolation");
      }, 2500);
      return;
    }

    try {
      setIsUserSpeaking(true);
      const result = await listen({
        onPartial: (partial) => {
          setInputValue(partial);
        },
      });
      listenHandleRef.current = result.handle;
      if (result.text) {
        handleSaveAnswer(result.text);
      }
    } catch {
      // fallback
    } finally {
      setIsUserSpeaking(false);
    }
  };

  // Handle answering & shockwave pulse
  const handleSaveAnswer = (val: string) => {
    if (!val.trim()) return;
    const cleanAnswer = val.trim();
    const updated = { ...answers, [currentQ.id]: cleanAnswer };
    setAnswers(updated);
    if (onAnswerSubmit) onAnswerSubmit(currentQ.id, cleanAnswer);
    setInputValue("");

    // Trigger bright shockwave pulse on Torus
    setShockwaveTrigger((prev) => prev + 1);

    // If reaching Question 15 (last question)
    if (currentQIndex >= INQUEST_QUESTIONS.length - 1) {
      handleCompleteInquest();
    } else {
      setCurrentQIndex((prev) => prev + 1);
    }
  };

  // Question 15 completion sequence
  const handleCompleteInquest = async () => {
    setIsInquestComplete(true);
    try {
      setIsOratorSpeaking(true);
      await orate("Requirements converged. Generating architectural blueprints.");
    } catch {
      // ignore
    } finally {
      setIsOratorSpeaking(false);
    }

    if (onInquestComplete) {
      onInquestComplete();
    }
  };

  const handleNext = () => {
    if (currentQIndex < INQUEST_QUESTIONS.length - 1) {
      setShockwaveTrigger((prev) => prev + 1);
      setCurrentQIndex((prev) => prev + 1);
      setInputValue(answers[INQUEST_QUESTIONS[currentQIndex + 1]?.id] || "");
    } else {
      handleCompleteInquest();
    }
  };

  const handlePrev = () => {
    if (currentQIndex > 0) {
      setCurrentQIndex((prev) => prev - 1);
      setInputValue(answers[INQUEST_QUESTIONS[currentQIndex - 1]?.id] || "");
    }
  };

  const reasoningSteps: CortexReasoningStep[] = [
    {
      id: "step-claude",
      agentId: "claude-sonnet-5",
      agentName: activeAgentName || "Claude Sonnet 5",
      phase: "draft",
      title: "Consensus Synthesis",
      detail: `Synthesizing invariants for ${currentQ.phase.toLowerCase()} specification`,
      confidence: 0.96,
      threshold: 0.85,
      timestamp: Date.now(),
      tokenCount: 4800,
    },
    {
      id: "step-gemini",
      agentId: "gemini-3.8-flash",
      agentName: "Gemini 3.8 Flash",
      phase: "parse",
      title: "15-Question Discovery Ingest",
      detail: "Multimodal ingestion of domain requirements & constraint ledger",
      confidence: 0.98,
      threshold: 0.85,
      timestamp: Date.now() - 2000,
      tokenCount: 38400,
    },
  ];

  return (
    <div className="flex h-full flex-col gap-2.5 min-h-0 overflow-hidden">
      {/* ============ TOP: 3D AUDIO-MORPHING TORUS RADIATOR ============ */}
      <section className="relative flex-[5] min-h-[210px] overflow-hidden rounded-xl border border-seam/80 bg-abyss/90 flex flex-col shadow-xl">
        <div className="relative flex-1 min-h-0 w-full">
          <CortexTorus3D
            phase={isAgentGenerating ? "draft" : "parse"}
            consensusScore={0.96}
            contextLoadPct={isAgentGenerating ? 88 : 74}
            tokPerSec={isAgentGenerating ? 440 : 280}
            reasoningSteps={reasoningSteps}
            isOratorSpeaking={isOratorSpeaking}
            isUserSpeaking={isUserSpeaking}
            currentQuestionPrompt={activePromptText}
            currentQuestionIndex={currentQIndex + 1}
            totalQuestions={15}
            isInquestComplete={isInquestComplete}
            shockwaveTrigger={shockwaveTrigger}
          />
        </div>
      </section>

      {/* ============ BOTTOM: 15-QUESTION DISCOVERY & AUDIO WAVEFORMS ============ */}
      <section className="relative flex-[6] min-h-[250px] overflow-hidden rounded-xl border border-seam/80 bg-abyss/95 flex flex-col p-3 shadow-xl">
        {/* Header Strip with Question Progress */}
        <div className="shrink-0 flex items-center justify-between border-b border-seam/70 pb-2 mb-2 font-mono-hud text-[10px]">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-[8.5px] font-bold border ${
                isInquestComplete
                  ? "bg-emerald-950/80 border-emerald-400/50 text-emerald-300"
                  : "bg-cyan-950/80 border-cyan-400/40 text-cyan-300"
              }`}
            >
              {isInquestComplete ? "BLUEPRINT READY" : currentQ.phase}
            </span>
            <span className="font-extrabold text-pearl">
              QUESTION {currentQIndex + 1} OF 15
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] text-forge-dim">
              <strong className="text-emerald-400">{answeredCount}</strong> / 15 ANSWERED
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                disabled={currentQIndex === 0}
                className="h-5 w-5 rounded border border-seam bg-depth text-gray-400 hover:text-white disabled:opacity-30 flex items-center justify-center text-[10px]"
                title="Previous Question"
              >
                ‹
              </button>
              <button
                onClick={handleNext}
                disabled={currentQIndex === INQUEST_QUESTIONS.length - 1}
                className="h-5 w-5 rounded border border-seam bg-depth text-gray-400 hover:text-white disabled:opacity-30 flex items-center justify-center text-[10px]"
                title="Next Question"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* Audio Waveforms & Question Prompt */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
          <div>
            {/* Waveform Bar & Voice Readout Control */}
            <div className="flex items-center justify-between bg-[#040812] border border-seam/70 rounded-lg p-2 mb-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={speakCurrentQuestion}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[9.5px] font-bold transition ${
                    isOratorSpeaking
                      ? "bg-amber-400 text-black shadow-[0_0_14px_rgba(245,158,11,0.8)] animate-pulse"
                      : "bg-[#0b1626] border border-seam text-gray-300 hover:text-cyan-300"
                  }`}
                  title="Orator Voice Readout"
                >
                  <span>{isOratorSpeaking ? "🔊 ORATOR SPEAKING…" : "🎙 ORATOR SPEAK"}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleUserListening}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[9.5px] font-bold transition ${
                    isUserSpeaking
                      ? "bg-pink-500 text-white shadow-[0_0_14px_rgba(236,72,153,0.8)] animate-pulse"
                      : "bg-[#0b1626] border border-seam text-gray-300 hover:text-pink-300"
                  }`}
                  title="Speak Response ([SPEAK])"
                >
                  <span>{isUserSpeaking ? "MIC ACTIVE (SPEAK)" : "MIC RESPONSE"}</span>
                </button>

                {/* Animated Waveform Bars */}
                <div className="flex items-end gap-0.5 h-4 ml-1">
                  {waveHeights.map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h}px` }}
                      className={`w-1 rounded-full transition-all duration-100 ${
                        isOratorSpeaking
                          ? "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]"
                          : isUserSpeaking
                          ? "bg-pink-400 shadow-[0_0_6px_rgba(236,72,153,0.8)]"
                          : isAgentGenerating
                          ? "bg-cyan-400 shadow-[0_0_6px_rgba(53,224,255,0.8)]"
                          : "bg-cyan-500/40"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <span className="font-mono text-[8.5px] text-forge-dim hidden sm:inline">
                {isOratorSpeaking
                  ? "ACOUSTIC MORPHING"
                  : isUserSpeaking
                  ? "INWARD RIPPLE"
                  : "BREATHING DRIFT"}
              </span>
            </div>

            {/* The Question Prompt */}
            <h3 className="font-display text-sm sm:text-base font-bold text-pearl leading-snug mb-1">
              {activePromptText}
            </h3>
            <p className="font-mono text-[10px] text-forge-dim leading-relaxed mb-2.5">
              {currentQ.hint}
            </p>

            {/* Quick Answer Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {currentQIndex === 3 ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue("Multi-tenant PostgreSQL on AWS RDS with schema isolation");
                      handleSaveAnswer("Multi-tenant PostgreSQL on AWS RDS with schema isolation");
                    }}
                    className="rounded border border-cyan-500/50 bg-cyan-950/70 px-2 py-0.5 font-mono text-[9px] text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/60 transition"
                  >
                    + Multi-tenant PostgreSQL (AWS RDS)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue("Local SQLite with edge sync replication");
                      handleSaveAnswer("Local SQLite with edge sync replication");
                    }}
                    className="rounded border border-amber-500/50 bg-amber-950/70 px-2 py-0.5 font-mono text-[9px] text-amber-300 hover:border-amber-400 hover:bg-amber-900/60 transition"
                  >
                    + Local SQLite with edge sync
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue("Hybrid: Cloud Postgres for orders + SQLite for cache");
                      handleSaveAnswer("Hybrid: Cloud Postgres for orders + SQLite for cache");
                    }}
                    className="rounded border border-purple-500/50 bg-purple-950/70 px-2 py-0.5 font-mono text-[9px] text-purple-300 hover:border-purple-400 hover:bg-purple-900/60 transition"
                  >
                    + Hybrid Cloud + Local Cache
                  </button>
                </>
              ) : currentQ.suggestions && currentQ.suggestions.length > 0 ? (
                currentQ.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setInputValue(s);
                      handleSaveAnswer(s);
                    }}
                    className="rounded border border-seam/80 bg-depth/90 px-2 py-0.5 font-mono text-[9px] text-cyan-300 hover:border-cyan-400 hover:bg-cyan-950/60 transition"
                  >
                    + {s}
                  </button>
                ))
              ) : null}
            </div>
          </div>

          {/* Answer Input & Submission Form */}
          <div className="pt-2 border-t border-seam/50">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveAnswer(inputValue);
                }}
                placeholder={answers[currentQ.id] || currentQ.placeholder}
                className="flex-1 bg-[#040810] border border-seam/80 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-pearl placeholder:text-gray-600 outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => handleSaveAnswer(inputValue)}
                className="btn-forge btn-primary px-3 py-1.5 text-[10px] font-bold shrink-0"
              >
                RECORD ↵
              </button>
            </div>

            {answers[currentQ.id] && (
              <div className="mt-1.5 font-mono text-[8.5px] text-emerald-400 truncate">
                ✓ Recorded: "{answers[currentQ.id]}"
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
