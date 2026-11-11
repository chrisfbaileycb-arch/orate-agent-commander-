import React, { useState } from "react";
import {
  downloadSessionTelemetryJson,
  type OratorTelemetryExport,
} from "../lib/telemetry-export";

interface Props {
  telemetryExport: OratorTelemetryExport;
  onClose: () => void;
}

export default function TelemetryExportModal({ telemetryExport, onClose }: Props) {
  const [downloadedFilename, setDownloadedFilename] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleDownload = () => {
    const file = downloadSessionTelemetryJson(telemetryExport);
    setDownloadedFilename(file);
  };

  const handleCopyJson = async () => {
    try {
      const text = JSON.stringify(telemetryExport, null, 2);
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
    }
  };

  const { sessionUsage, forgeActivity, diagnostics } = telemetryExport;

  const healthTone =
    diagnostics.overallHealth === "healthy"
      ? "border-emerald-500/70 bg-emerald-950/50 text-emerald-100"
      : diagnostics.overallHealth === "critical_failure"
      ? "border-rose-500/80 bg-rose-950/60 text-rose-100"
      : "border-amber-500/70 bg-amber-950/50 text-amber-100";

  return (
    <div
      data-testid="telemetry-export-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="telemetry-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-[#090e18] text-slate-100 shadow-2xl overflow-hidden font-mono-hud text-xs">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4 shrink-0">
          <div>
            <div className="text-xs font-mono text-cyan-300 uppercase tracking-wider">
              ORATOR.AI · SESSION TELEMETRY & FAILURE DIAGNOSTICS REPORT
            </div>
            <h2 id="telemetry-export-title" className="text-base sm:text-lg font-bold text-white mt-0.5">
              Export Usage Telemetry & Next-Run Corrective Action Plan
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="modal-download-telemetry-json-btn"
              onClick={handleDownload}
              className="rounded-xl border border-cyan-400 bg-cyan-950/90 hover:bg-cyan-900 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-cyan-100 transition"
            >
              ⬇ Download JSON
            </button>
            <button
              type="button"
              data-testid="modal-copy-telemetry-json-btn"
              onClick={() => void handleCopyJson()}
              className="rounded-xl border border-slate-700 bg-[#05080f] hover:border-cyan-400 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 transition"
            >
              {copied ? "✓ Copied JSON" : "Copy JSON"}
            </button>
            <button
              type="button"
              data-testid="close-telemetry-modal-btn"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-[#05080f] hover:border-rose-400 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition"
            >
              Close ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
          {downloadedFilename && (
            <div
              role="status"
              data-testid="telemetry-download-confirmation"
              className="rounded-xl border border-emerald-500/70 bg-emerald-950/60 px-4 py-2.5 text-xs text-emerald-100 flex items-center justify-between"
            >
              <span>
                ✓ Exported session telemetry and diagnostics to{" "}
                <strong className="font-mono">{downloadedFilename}</strong>
              </span>
              <span className="font-mono text-emerald-300">{telemetryExport.exportedAt}</span>
            </div>
          )}

          {/* Top Summary Metrics: Session Usage + Forge Activity */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
            <div className="rounded-xl border border-slate-800 bg-[#05080f] p-3">
              <div className="text-xs text-slate-300">Sessions Used</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {sessionUsage.sessionsUsed} / {sessionUsage.freeSessions} Free (
                {sessionUsage.remainingFreeSessions} left)
              </div>
              <div className="text-xs text-cyan-300 mt-0.5">
                Client: {sessionUsage.clientId.slice(0, 10)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#05080f] p-3">
              <div className="text-xs text-slate-300">Forge Activity & Capacity</div>
              <div className="text-sm font-bold text-cyan-200 mt-0.5">
                {forgeActivity.capacityPct}% ({forgeActivity.activeBuilds}/
                {forgeActivity.maxBuilds} active)
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                Explorations: {sessionUsage.explorationsCompleted} completed
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#05080f] p-3">
              <div className="text-xs text-slate-300">Airlock & Audit Chain</div>
              <div className="text-sm font-bold text-white uppercase mt-0.5">
                {forgeActivity.sphereState} · Depth {forgeActivity.auditChain.depth}
              </div>
              <div className="text-xs text-emerald-300 mt-0.5">
                SHA-256 Verified: {String(forgeActivity.auditChain.verified)}
              </div>
            </div>

            <div className={`rounded-xl border p-3 ${healthTone}`}>
              <div className="text-xs opacity-90">Diagnostic Health</div>
              <div className="text-sm font-bold uppercase mt-0.5">
                {diagnostics.overallHealth.replace(/_/g, " ")}
              </div>
              <div className="text-xs mt-0.5">
                {diagnostics.failureCount} failure/gate item(s) detected
              </div>
            </div>
          </div>

          {/* Telemetry Errors Array: Failed Tasks, Reasons & Recommended Corrections */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">
                Telemetry Errors Array (<code className="text-cyan-300">telemetry.errors</code>): Failed Tasks, Reasons &amp; Recommended Corrections
              </h3>
              <span className="text-xs font-mono text-slate-300 tabular-nums">
                {telemetryExport.errors.length} error(s) recorded
              </span>
            </div>

            {telemetryExport.errors.length === 0 ? (
              <div
                data-testid="telemetry-no-failures"
                className="rounded-xl border border-emerald-500/50 bg-emerald-950/25 p-4 text-xs text-emerald-100 space-y-1"
              >
                <div className="font-bold">
                  ✓ Zero active failures or blocked gates detected in the current session (`errors: []`).
                </div>
                <p className="text-slate-200">
                  All released airlock verifiers, tenant credit balances, and SHA-256 audit records
                  are currently passing. See the Next-Run Recommendations below for maintaining
                  deterministic builds.
                </p>
              </div>
            ) : (
              <div className="space-y-3" data-testid="telemetry-failures-list">
                {telemetryExport.errors.map((errItem, index) => {
                  const diagItem = diagnostics.failures[index];
                  const extraCorrections =
                    errItem.recommendedCorrections ?? diagItem?.recommendedCorrections ?? [];
                  return (
                    <div
                      key={errItem.id || `err_${index}`}
                      data-testid="telemetry-error-entry"
                      className="rounded-xl border border-slate-800 bg-[#05080f] p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-rose-200">
                          FAILED TASK:{" "}
                          <span className="text-white">
                            {errItem.failedTask || errItem.task}
                          </span>
                        </div>
                        <span className="text-xs font-mono uppercase text-amber-300">
                          {(errItem.stage || "session_error").replace(/_/g, " ")} ·{" "}
                          {errItem.severity || "error"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-200 leading-relaxed">
                        <strong className="text-amber-200">FAILURE REASON: </strong>
                        {errItem.reason}
                      </div>

                      <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-2.5 text-xs text-emerald-100">
                        <strong className="text-emerald-300">RECOMMENDED CORRECTION: </strong>
                        <span>{errItem.recommendedCorrection}</span>
                      </div>

                      {extraCorrections.length > 1 && (
                        <div className="space-y-1 pt-1 border-t border-slate-800/80">
                          <div className="text-xs font-bold text-emerald-300">
                            ADDITIONAL CORRECTIVE STEPS FOR NEXT RUN:
                          </div>
                          <ul className="space-y-1 text-xs text-slate-200">
                            {extraCorrections.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold shrink-0">→</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prioritized Next-Run Action Plan */}
          <div className="rounded-xl border border-slate-800 bg-[#05080f] p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Consolidated Next-Run Action Plan
            </div>
            <ul className="space-y-1.5 text-xs text-slate-200">
              {diagnostics.nextRunActionPlan.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono font-bold text-cyan-300 tabular-nums shrink-0">
                    0{idx + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Toggleable Raw JSON Preview */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowRawJson((v) => !v)}
              className="text-xs font-bold text-cyan-300 hover:text-white transition"
            >
              {showRawJson ? "▾ Hide Raw Export JSON Preview" : "▸ Preview Raw Export JSON Payload"}
            </button>
            {showRawJson && (
              <pre
                data-testid="telemetry-raw-json-preview"
                className="overflow-x-auto rounded-xl border border-slate-800 bg-[#020408] p-4 text-xs font-mono text-cyan-100 max-h-72 leading-relaxed"
              >
                <code>{JSON.stringify(telemetryExport, null, 2)}</code>
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
