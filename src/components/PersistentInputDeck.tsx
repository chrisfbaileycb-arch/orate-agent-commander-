import React, { useState, useEffect, useRef } from "react";
import { orate, hush } from "../lib/voice";
import { cortexBus } from "../lib/cortex/bus";

interface Props {
  onCommandSubmit?: (cmd: string) => void;
  onOpenTranscript?: () => void;
  onOpenRepo?: () => void;
  onAttachFile?: () => void;
}

export default function PersistentInputDeck({
  onCommandSubmit,
  onOpenTranscript,
  onOpenRepo,
  onAttachFile,
}: Props) {
  const [inputVal, setInputVal] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([
    "ORATOR: The Orator is listening. Welcome to the Orator Design Studio.",
    "QUORUM: Consensus converged for Sonnet 5 + Gemini 3.8 Flash pipeline.",
  ]);
  const [waveHeights, setWaveHeights] = useState<number[]>([12, 18, 24, 16, 20]);
  const recognitionRef = useRef<any>(null);

  // Audio waveform animation when listening
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => {
      setWaveHeights([
        Math.floor(8 + Math.random() * 20),
        Math.floor(10 + Math.random() * 22),
        Math.floor(14 + Math.random() * 20),
        Math.floor(10 + Math.random() * 22),
        Math.floor(8 + Math.random() * 18),
      ]);
    }, 120);
    return () => clearInterval(interval);
  }, [isListening]);

  // Setup Web Speech API if supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join("");
        setInputVal(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleSpeak = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch {
          setIsListening(true);
        }
      } else {
        // Fallback simulation of voice
        setIsListening(true);
        setInputVal("Build multi-tenant POS order bridge with Gemini ingestion and Claude logic");
        setTimeout(() => setIsListening(false), 2000);
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputVal.trim();
    if (!clean) return;

    // Emit live pulse event to CORTEX Bus
    cortexBus.emit({
      type: "onToken",
      timestamp: Date.now(),
      payload: { token: clean.slice(0, 20) },
    });

    cortexBus.emit({
      type: "onReasoningStep",
      timestamp: Date.now(),
      payload: {
        step: {
          id: `step-${Date.now()}`,
          phase: "synthesis",
          agentName: "Dual-Engine Consensus",
          title: "Synthesizing Architecture",
          detail: clean,
          confidence: 0.95,
          tokenCount: 180,
          loopBack: false,
          worldCoord: [0, 2.5, 0],
        },
      },
    });

    setTranscriptHistory((prev) => [
      ...prev,
      `USER: ${clean}`,
      `ORATOR: Executing synthesis invariant for: "${clean}"`,
    ]);

    void orate(`Acknowledged. Synthesizing consensus for: ${clean.slice(0, 50)}`);

    if (onCommandSubmit) {
      onCommandSubmit(clean);
    }

    setInputVal("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <nav
      aria-label="Persistent Input Deck"
      className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 sm:px-6 pointer-events-auto"
    >
      <div className="w-full max-w-4xl flex flex-col items-center">
        {/* Repo Overlay Panel */}
        {repoOpen && (
          <div className="mb-2 w-full rounded-2xl border border-forge-gold/40 bg-depth/95 p-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-1.5 flex items-center justify-between font-mono-hud text-[10px] tracking-wider text-forge-gold">
              <span>READ-ONLY REPOSITORY INGEST (#REPO 20)</span>
              <button
                type="button"
                onClick={() => setRepoOpen(false)}
                className="text-forge-dim hover:text-pearl"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/chrisfbaileycb-arch/orator-sept-7-848"
                className="input-forge !border-seam/70 !py-2 font-mono-hud text-[11px] text-pearl flex-1"
              />
              <button
                type="button"
                onClick={() => {
                  setRepoOpen(false);
                  setTranscriptHistory((prev) => [
                    ...prev,
                    `SYSTEM: Attached repository: ${repoUrl || "chrisfbaileycb-arch/orator-sept-7-848"} (20 files)`,
                  ]);
                }}
                className="btn-forge btn-gold shrink-0 px-4 py-2 text-[10px]"
              >
                ATTACH (RO)
              </button>
            </div>
          </div>
        )}

        {/* Transcript Overlay Panel */}
        {transcriptOpen && (
          <div className="mb-2 w-full rounded-2xl border border-forge-cyan/40 bg-depth/95 p-3.5 shadow-2xl backdrop-blur-xl max-h-48 overflow-y-auto">
            <div className="mb-2 flex items-center justify-between font-mono-hud text-[10px] tracking-wider text-forge-cyan border-b border-seam/60 pb-1.5">
              <span>#TRANSCRIPT // LIVE CONVERSATION STREAM</span>
              <button
                type="button"
                onClick={() => setTranscriptOpen(false)}
                className="text-forge-dim hover:text-pearl"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5 font-mono text-[10.5px]">
              {transcriptHistory.map((line, idx) => (
                <div key={idx} className="text-gray-300">
                  <span className="text-forge-cyan">&gt;</span> {line}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Dock Bar Container */}
        <div className="relative w-full rounded-2xl border border-seam/90 bg-depth/90 p-2 sm:p-2.5 shadow-[0_16px_48px_rgba(2,4,10,0.9)] backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            {/* Amber [SPEAK] Button with Waveform Audio Indicator */}
            <button
              type="button"
              onClick={toggleSpeak}
              className={`btn-forge shrink-0 rounded-xl px-3.5 py-2.5 text-[11px] font-bold transition-all ${
                isListening
                  ? "bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.6)]"
                  : "bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:scale-[1.02] shadow-[0_0_14px_rgba(245,158,11,0.35)]"
              }`}
              title="Voice Conduit Speak Control"
            >
              <span className="flex items-center gap-2">
                {/* Audio Waveform Indicator */}
                <span className="flex items-end gap-0.5 h-4">
                  {waveHeights.map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${isListening ? h : 8 + i * 2}px` }}
                      className={`w-0.5 rounded-full transition-all duration-100 ${
                        isListening ? "bg-black" : "bg-black/75"
                      }`}
                    />
                  ))}
                </span>
                <span>{isListening ? "LISTENING…" : "SPEAK"}</span>
              </span>
            </button>

            {/* Command Input Box */}
            <div className="relative flex-1">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Build multi-tenant POS order bridge with Gemini ingestion and Claude logic"
                className="w-full bg-abyss/80 border border-seam/80 rounded-xl px-3.5 py-2 font-mono text-[12px] sm:text-[13px] text-pearl placeholder:text-forge-dim/50 outline-none focus:border-forge-cyan focus:shadow-[0_0_12px_rgba(53,224,255,0.2)]"
              />
            </div>

            {/* Execute / Send Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="btn-forge shrink-0 rounded-xl px-4 py-2 text-[11px] font-bold bg-gradient-to-r from-cyan-500 to-cyan-400 text-black hover:scale-[1.02] shadow-[0_0_14px_rgba(53,224,255,0.3)]"
            >
              <span>SEND ↵</span>
            </button>
          </div>

          {/* Action Tags: #TRANSCRIPT, #REPO (20), #ATTACH */}
          <div className="mt-2 flex items-center justify-between border-t border-seam/40 pt-1.5 px-2 font-mono-hud text-[10px]">
            <div className="flex items-center gap-2">
              {/* #TRANSCRIPT */}
              <button
                type="button"
                onClick={() => {
                  setTranscriptOpen((v) => !v);
                  if (onOpenTranscript) onOpenTranscript();
                }}
                className={`rounded-lg px-2 py-0.5 font-bold transition-colors ${
                  transcriptOpen
                    ? "bg-forge-cyan/20 text-cyan-300 border border-cyan-400/50"
                    : "text-forge-dim hover:text-cyan-300"
                }`}
              >
                #TRANSCRIPT
              </button>

              {/* #REPO (20) */}
              <button
                type="button"
                onClick={() => {
                  setRepoOpen((v) => !v);
                  if (onOpenRepo) onOpenRepo();
                }}
                className={`rounded-lg px-2 py-0.5 font-bold transition-colors ${
                  repoOpen
                    ? "bg-amber-500/20 text-amber-300 border border-amber-400/50"
                    : "text-forge-dim hover:text-amber-300"
                }`}
              >
                #REPO (20)
              </button>

              {/* #ATTACH */}
              <button
                type="button"
                onClick={() => {
                  if (onAttachFile) onAttachFile();
                  setTranscriptHistory((prev) => [
                    ...prev,
                    "SYSTEM: Attached specification doc: POS_INVARIANTS.md",
                  ]);
                }}
                className="rounded-lg px-2 py-0.5 font-bold text-forge-dim hover:text-purple-300 transition-colors"
              >
                #ATTACH
              </button>
            </div>

            <div className="hidden sm:block text-[9px] text-forge-dim">
              ORATOR.AI AUTONOMOUS CONSENSUS SYNTHESIS
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
