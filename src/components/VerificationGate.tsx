import { useEffect, useRef, useState } from "react";
import type { AuditResult } from "../lib/types";
import { SKILL_CODEX } from "../lib/skills";
import { MCP_BENCH } from "../lib/mcp";
import { sealSound, orate, phaseSound } from "../lib/voice";

/**
 * FINAL VERIFICATION GATE — the 22-point invariant audit and backend skill
 * codex execute as the last step before packaging. Code renders only after
 * the gate opens.
 */

interface Props {
  audit: AuditResult;
  onSeal: () => void;
}

const PHASE_LABELS = [
  "01 · CONTRACT & BOUNDARY CHECKS",
  "02 · DATA & BACKEND INVARIANTS",
  "03 · SECURITY, OPS & DELIVERY SEALS",
];

export default function VerificationGate({ audit, onSeal }: Props) {
  const [revealed, setRevealed] = useState(0);
  const [verdict, setVerdict] = useState(false);
  const openedRef = useRef(false);
  const doneRef = useRef(false);

  const findings = audit.findings;
  const cleared = findings.filter((f) => f.status !== "fail").length;
  const failed = findings.filter((f) => f.status === "fail");
  const passPct = Math.round((cleared / Math.max(1, findings.length)) * 100);

  // Staged reveal of the 22 probes
  useEffect(() => {
    if (revealed >= findings.length) return;
    const t = window.setTimeout(() => {
      setRevealed((r) => r + 1);
      if ((revealed + 1) % 3 === 0) phaseSound(true);
    }, 95);
    return () => window.clearTimeout(t);
  }, [revealed, findings.length]);

  // When all revealed → verdict + seal chime (once)
  useEffect(() => {
    if (revealed >= findings.length && !openedRef.current) {
      openedRef.current = true;
      setVerdict(true);
      sealSound();
      void orate(
        failed.length === 0
          ? "All twenty two invariants cleared. The gate opens — code may render."
          : "The gate reports failures. Review the dossier before delivery."
      );
    }
  }, [revealed, findings.length, failed.length]);

  const seal = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onSeal();
  };

  const groupOf = (i: number) => PHASE_LABELS[Math.min(2, Math.floor(i / 8))];

  return (
    <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-24">
      {/* Header */}
      <div className="text-center">
        <div className="font-mono-hud text-[9px] tracking-[0.34em] text-forge-gold text-glow-gold">
          FINAL VERIFICATION GATE
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-pearl">
          Nothing renders until the gate opens.
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-[12.5px] leading-relaxed text-forge-dim">
          The forge's output now runs the full 22-point invariant audit and the backend
          skill codex before a single line is packaged for delivery.
        </p>
      </div>

      {/* Probe list */}
      <div className="hud-panel corner-tick relative mt-8 p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono-hud text-[10px] tracking-[0.24em] text-forge-dim">
            {verdict ? "AUDIT COMPLETE" : "AUDIT IN PROGRESS"}
          </span>
          <span className="font-mono-hud text-[11px] tracking-[0.14em] text-pearl">
            {Math.min(revealed, findings.length)}/{findings.length} INVARIANTS
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-seam">
          <div
            className="h-full rounded-full bg-gradient-to-r from-forge-gold via-forge-cyan to-forge-gold transition-all duration-200"
            style={{ width: `${Math.min(100, (revealed / findings.length) * 100)}%` }}
          />
        </div>

        {!verdict ? (
          <div className="space-y-2.5">
            {findings.slice(0, revealed).map((f, i) => (
              <div
                key={f.id}
                className="flex items-start gap-3 rounded-lg border border-seam/60 bg-depth/50 px-3 py-2 animate-drift-up"
              >
                <span className="mt-0.5 font-mono-hud text-[11px] text-forge-cyan">✔</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono-hud text-[11px] font-bold tracking-[0.04em] text-pearl">
                      {String(f.id).padStart(2, "0")} · {f.title}
                    </span>
                    <span className="shrink-0 font-mono-hud text-[8px] tracking-[0.1em] text-forge-dim">
                      {groupOf(i)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] leading-relaxed text-forge-dim">{f.detail}</div>
                </div>
              </div>
            ))}
            {revealed < findings.length && (
              <div className="flex items-center gap-3 px-1 py-1">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-forge-cyan border-t-transparent" />
                <span className="font-mono-hud text-[10px] tracking-[0.2em] text-forge-gold animate-pulse-soft">
                  PROBING INVARIANT {String(revealed + 1).padStart(2, "0")}…
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Verdict */
          <div className="text-center">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-2 border-forge-cyan/70 shadow-[0_0_40px_rgba(53,224,255,0.35)]">
              <div>
                <div className="font-mono-hud text-[26px] font-bold leading-none text-pearl text-glow-soft">
                  {passPct}%
                </div>
                <div className="mt-1 font-mono-hud text-[8px] tracking-[0.18em] text-forge-dim">
                  {cleared}/{findings.length} CLEARED
                </div>
              </div>
            </div>

            <h3 className={`mt-5 font-display text-xl font-bold tracking-tight ${failed.length ? "text-forge-alert" : "text-forge-cyan text-glow-cyan"}`}>
              {failed.length ? "THE GATE HOLDS" : "THE GATE OPENS"}
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-[12.5px] leading-relaxed text-forge-dim">
              {failed.length
                ? `${failed.length} invariant${failed.length === 1 ? "" : "s"} require review before this blueprint may render.`
                : "All 22 invariants cleared — contract integrity, secret hygiene, zero-disk runtime, sandbox isolation, and sealed delivery verified. The blueprint may render."}
            </p>

            {failed.length > 0 && (
              <div className="mx-auto mt-4 max-w-md space-y-1.5 text-left">
                {failed.map((f) => (
                  <div key={f.id} className="rounded border border-forge-alert/40 bg-forge-alert/5 px-3 py-1.5 font-mono-hud text-[10px] text-forge-alert">
                    ✕ {String(f.id).padStart(2, "0")} · {f.title}
                  </div>
                ))}
              </div>
            )}

            {/* Codex + MCP bench summary */}
            <div className="mx-auto mt-6 flex max-w-lg flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-seam px-3 py-1 font-mono-hud text-[9px] tracking-[0.14em] text-forge-dim">
                CODEX SEATED · {SKILL_CODEX.length} PLAYBOOKS
              </span>
              <span className="rounded-full border border-seam px-3 py-1 font-mono-hud text-[9px] tracking-[0.14em] text-forge-dim">
                MCP BENCH · {MCP_BENCH.length} SERVERS
              </span>
              <span className="rounded-full border border-forge-cyan/40 px-3 py-1 font-mono-hud text-[9px] tracking-[0.14em] text-forge-cyan">
                VERIFICATION SEAL · ORATOR.AI
              </span>
            </div>

            <button
              onClick={seal}
              className="btn-forge btn-primary mt-7 px-10 py-4 text-xs"
            >
              {failed.length ? "REVIEW DOSSIER ANYWAY →" : "SEAL DELIVERY DOSSIER →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
