import { useEffect, useRef, useState } from "react";
import type { ForgePlan, IngestItem } from "../lib/types";
import type { PreviewCapsule } from "../lib/capsule-types";
import { MindMapRenderer } from "../canvas/MindMapCanvas";
import { downloadZip } from "../lib/zip";
import { globalCapsuleService } from "../lib/capsule-service";
import PreviewCapsuleModal from "./PreviewCapsuleModal";
import DeploymentAdvisorModal from "./DeploymentAdvisorModal";

/** ---------- Delivery deck: 3 Primary Actions: Preview Capsule, Permanent Hosting, Download ZIP ---------- */

interface Props {
  plan: ForgePlan;
  auditScore: number;
  auditPassed: number;
  auditTotal: number;
  /** Attachments + connected repos carried from the inquest into the dossier. */
  ingest: IngestItem[];
  onNewForge: () => void;
}

type Tab = "map" | "audit" | "code" | "sandbox" | "dossier";

const TABS: { id: Tab; label: string }[] = [
  { id: "map", label: "MIND MAP" },
  { id: "audit", label: "22-PT AUDIT" },
  { id: "code", label: "BLUEPRINT" },
  { id: "sandbox", label: "SANDBOX" },
  { id: "dossier", label: "DELIVERY & HOSTING" },
];

export default function Deliverables({ plan, auditScore, auditPassed, auditTotal, ingest, onNewForge }: Props) {
  const fileCount = ingest.filter((i) => i.kind !== "repo").length;
  const repoCount = ingest.length - fileCount;
  const [tab, setTab] = useState<Tab>("dossier"); // Default to Delivery & Hosting so the 3 actions are immediately visible!
  const [activeFile, setActiveFile] = useState(0);
  const [tooltip, setTooltip] = useState<{ label: string; detail: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MindMapRenderer | null>(null);

  // Preview Capsule & Deployment Advisor states
  const [activeCapsule, setActiveCapsule] = useState<PreviewCapsule | null>(null);
  const [isCreatingCapsule, setIsCreatingCapsule] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);

  useEffect(() => {
    if (tab !== "map" || !canvasRef.current) return;
    const renderer = new MindMapRenderer(canvasRef.current);
    renderer.setData(plan.mindMap);
    renderer.start();
    rendererRef.current = renderer;
    const poll = setInterval(() => setTooltip(renderer.getTooltip()), 120);
    return () => {
      clearInterval(poll);
      renderer.stop();
      rendererRef.current = null;
    };
  }, [tab, plan]);

  const file = plan.files[Math.min(activeFile, plan.files.length - 1)];

  const sandboxDoc = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{background:#070d18;color:#eaf6ff;font-family:monospace;padding:20px;line-height:1.6}
    h1{color:#35e0ff;font-size:16px;letter-spacing:.2em;margin:0 0 4px}
    .k{color:#f2c14e}.chip{display:inline-block;border:1px solid #16283f;border-radius:6px;padding:2px 8px;margin:2px;font-size:11px;color:#7d95b2}
  </style></head><body>
    <h1>${plan.appName}</h1>
    <div><span class="k">archetype:</span> ${plan.archetype} · <span class="k">stack:</span> ${plan.stack.join(" / ")}</div>
    <p>${plan.summary}</p>
    <div><span class="k">systems:</span> ${plan.mindMap.nodes.filter((n) => n.kind === "system").map((n) => n.label).join(", ")}</div>
    <div style="margin-top:6px"><span class="k">contracts:</span> ${plan.mindMap.nodes.filter((n) => n.kind === "contract").map((n) => `<span class="chip">${n.label}</span>`).join("")}</div>
    <p style="color:#7d95b2">jailed preview — sandbox attribute blocks scripts and host access</p>
  </body></html>`;

  // Launch or open Preview Capsule
  const handleLaunchCapsule = async () => {
    if (activeCapsule && activeCapsule.status === "READY") {
      setShowPreviewModal(true);
      return;
    }
    setIsCreatingCapsule(true);
    try {
      const capsule = await globalCapsuleService.createCapsule(
        "proj-" + Date.now(),
        "client-current",
        "build-" + Date.now(),
        plan.files,
        {
          appName: plan.appName,
          archetype: plan.archetype,
          summary: plan.summary,
          stack: plan.stack,
          entryPoint: "src/main.tsx",
        },
        { tier: "free" }
      );
      setActiveCapsule(capsule);
      setShowPreviewModal(true);
    } finally {
      setIsCreatingCapsule(false);
    }
  };

  const handleExtendCapsule = (hours: number) => {
    if (!activeCapsule) return;
    globalCapsuleService.extendCapsule(activeCapsule.id, hours);
    const updated = globalCapsuleService.getCapsule(activeCapsule.id);
    setActiveCapsule(updated);
  };

  const handleDeleteCapsule = () => {
    if (!activeCapsule) return;
    globalCapsuleService.deleteCapsule(activeCapsule.id);
    setActiveCapsule(null);
    setShowPreviewModal(false);
  };

  return (
    <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-24">
      {/* Summary plate */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono-hud text-[9px] tracking-[0.3em] text-forge-cyan/80">
            DELIVERY DECK // FORGE COMPLETE
          </div>
          <h2 className="mt-1 font-display text-2xl font-semibold text-pearl text-glow-cyan">{plan.appName}</h2>
          <p className="mt-1 max-w-xl text-[12.5px] text-forge-dim">{plan.summary}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hud-panel px-4 py-3 text-center">
            <div className="font-mono-hud text-[8.5px] tracking-[0.2em] text-forge-dim">AUDIT</div>
            <div className="font-mono-hud text-xl font-bold text-forge-cyan">{auditScore}%</div>
          </div>
          <div className="hud-panel px-4 py-3 text-center">
            <div className="font-mono-hud text-[8.5px] tracking-[0.2em] text-forge-dim">FILES</div>
            <div className="font-mono-hud text-xl font-bold text-pearl">{plan.files.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md border px-3 py-1.5 font-mono-hud text-[10px] tracking-wider transition-colors ${
              tab === t.id
                ? "border-forge-cyan/80 bg-depth text-forge-cyan font-bold"
                : "border-seam text-forge-dim hover:text-pearl"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="hud-panel p-4">
        {/* MIND MAP */}
        {tab === "map" && (
          <div className="relative h-[480px] w-full overflow-hidden rounded-lg bg-abyss/80">
            <canvas ref={canvasRef} className="h-full w-full" />
            {tooltip && (
              <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs rounded border border-seam bg-depth/90 p-2.5 font-mono-hud text-[10px] text-pearl backdrop-blur">
                <div className="font-bold text-forge-cyan">{tooltip.label}</div>
                <div className="mt-0.5 text-forge-dim">{tooltip.detail}</div>
              </div>
            )}
          </div>
        )}

        {/* 22-PT AUDIT */}
        {tab === "audit" && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 border-b border-seam pb-3">
              <div className="relative h-12 w-12 shrink-0">
                <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-seam"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-forge-cyan"
                    strokeDasharray={`${auditScore}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-mono-hud text-[10px] font-bold text-forge-cyan">
                  {auditScore}
                </span>
              </div>
              <div className="font-mono-hud text-[10px] leading-relaxed tracking-[0.1em] text-forge-dim">
                <span className="text-pearl">{auditPassed}/{auditTotal}</span> INVARIANTS PASSED ·{" "}
                <span className="text-forge-gold">{auditTotal - auditPassed}</span> ADVISORY NOTES ·
                VERDICT: <span className="text-forge-cyan">SEALED FOR DELIVERY</span>
              </div>
            </div>
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {plan.audit.findings.map((f) => (
                <li key={f.id} className="flex items-start gap-2.5 rounded-lg border border-seam/50 bg-depth/40 px-3 py-2">
                  <span className={`mt-0.5 font-mono-hud text-[10px] ${f.status === "pass" ? "text-forge-cyan" : "text-forge-gold"}`}>
                    {f.status === "pass" ? "✔" : "◆"}
                  </span>
                  <div>
                    <div className="font-mono-hud text-[10.5px] font-bold tracking-[0.04em] text-pearl">
                      {String(f.id).padStart(2, "0")} · {f.title}
                      <span className="ml-2 font-normal text-forge-dim">w{f.weight}</span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] leading-snug text-forge-dim">{f.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* BLUEPRINT */}
        {tab === "code" && (
          <div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {plan.files.map((f, i) => (
                <button
                  key={f.path}
                  onClick={() => setActiveFile(i)}
                  className={`rounded-md border px-3 py-1.5 font-mono-hud text-[10px] transition-colors ${
                    i === activeFile
                      ? "border-forge-cyan/60 text-forge-cyan"
                      : "border-seam text-forge-dim hover:text-pearl"
                  }`}
                >
                  {f.path}
                </button>
              ))}
            </div>
            <pre className="max-h-[380px] overflow-auto rounded-lg border border-seam bg-abyss/70 p-4 font-mono-hud text-[11px] leading-relaxed text-pearl/90">
              {file?.contents}
            </pre>
          </div>
        )}

        {/* SANDBOX */}
        {tab === "sandbox" && (
          <div>
            <div className="mb-2 font-mono-hud text-[9px] tracking-[0.2em] text-forge-dim">
              JAILED PREVIEW — sandbox="" blocks scripts, forms, and host access
            </div>
            <iframe
              title="Blueprint sandbox preview"
              sandbox=""
              srcDoc={sandboxDoc}
              className="h-[380px] w-full rounded-lg border border-seam bg-depth"
            />
          </div>
        )}

        {/* DELIVERY & HOSTING — THE 3 PRIMARY CHOICES */}
        {tab === "dossier" && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="font-mono-hud text-[10px] tracking-[0.3em] text-forge-gold">✦ SEALED DELIVERY ✦</div>
            <h3 className="mt-2 font-display text-2xl font-semibold text-pearl">
              {plan.appName} is Verified and Ready
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-[12.5px] leading-relaxed text-forge-dim">
              Your software has passed the 22-point invariant audit. Choose from the three next steps below: test an isolated interactive preview, complete the questionnaire to find independent permanent hosting, or download your complete project ZIP.
            </p>

            {/* THREE PRIMARY CHOICES CARDS */}
            <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-4 md:grid-cols-3 text-left">
              {/* CHOICE 1: LAUNCH TEMPORARY PREVIEW */}
              <div className="flex flex-col justify-between rounded-xl border border-forge-cyan/50 bg-forge-cyan/5 p-4 transition-all hover:border-forge-cyan">
                <div>
                  <div className="font-mono-hud text-[9px] font-bold tracking-widest text-forge-cyan">
                    CHOICE 1 // INTERACTIVE
                  </div>
                  <h4 className="mt-1 font-display text-base font-semibold text-pearl">
                    Launch Temporary Preview
                  </h4>
                  <p className="mt-2 text-[11px] text-forge-dim leading-relaxed">
                    Create a time-limited (24–72h) interactive URL to test forms, responsive views, and gather viewer feedback.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLaunchCapsule}
                  disabled={isCreatingCapsule}
                  className="btn-forge btn-primary mt-4 w-full py-2.5 text-[10.5px]"
                >
                  {isCreatingCapsule
                    ? "CREATING CAPSULE..."
                    : activeCapsule
                    ? "OPEN ACTIVE PREVIEW →"
                    : "LAUNCH PREVIEW CAPSULE →"}
                </button>
              </div>

              {/* CHOICE 2: FIND PERMANENT HOSTING */}
              <div className="flex flex-col justify-between rounded-xl border border-forge-gold/50 bg-forge-gold/5 p-4 transition-all hover:border-forge-gold">
                <div>
                  <div className="font-mono-hud text-[9px] font-bold tracking-widest text-forge-gold">
                    CHOICE 2 // DEPLOYMENT
                  </div>
                  <h4 className="mt-1 font-display text-base font-semibold text-pearl">
                    Find Permanent Hosting
                  </h4>
                  <p className="mt-2 text-[11px] text-forge-dim leading-relaxed">
                    Answer our brief Deployment Questionnaire to receive evidence-based provider recommendations and export checklists.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvisorModal(true)}
                  className="btn-forge btn-gold mt-4 w-full py-2.5 text-[10.5px]"
                >
                  START QUESTIONNAIRE →
                </button>
              </div>

              {/* CHOICE 3: DOWNLOAD MY PROJECT */}
              <div className="flex flex-col justify-between rounded-xl border border-seam bg-depth/70 p-4 transition-all hover:border-pearl">
                <div>
                  <div className="font-mono-hud text-[9px] font-bold tracking-widest text-forge-dim">
                    CHOICE 3 // INDEPENDENT
                  </div>
                  <h4 className="mt-1 font-display text-base font-semibold text-pearl">
                    Download My Project
                  </h4>
                  <p className="mt-2 text-[11px] text-forge-dim leading-relaxed">
                    Direct deterministic export. Download all verified source files, manifest, and audit results with zero provider lock-in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadZip(plan.files, plan.appName)}
                  className="btn-forge btn-ghost mt-4 w-full py-2.5 text-[10.5px]"
                >
                  ⬇ DOWNLOAD ZIP
                </button>
              </div>
            </div>

            {/* Ingested context notice */}
            <div className="mx-auto mt-8 max-w-lg text-left w-full">
              <div className="mb-2 flex items-center justify-between border-b border-seam pb-1.5">
                <span className="font-mono-hud text-[9px] tracking-[0.22em] text-forge-dim">
                  DOSSIER CONTEXT · INGESTED DURING THE INQUEST
                </span>
                {ingest.length > 0 && (
                  <span className="font-mono-hud text-[9px] tracking-[0.1em] text-forge-cyan">
                    {fileCount} FILE{fileCount === 1 ? "" : "S"}{repoCount > 0 ? ` · ${repoCount} REPO${repoCount === 1 ? "" : "S"}` : ""}
                  </span>
                )}
              </div>
              {ingest.length === 0 ? (
                <div className="py-2 text-center font-mono-hud text-[9px] tracking-[0.14em] text-forge-dim/60">
                  NO CONTEXT ATTACHED — FORGED CONVERSATIONALLY
                </div>
              ) : (
                <ul className="max-h-28 space-y-1 overflow-y-auto pr-1">
                  {ingest.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-2 rounded border border-seam/60 bg-depth/50 px-2.5 py-1.5"
                    >
                      <span className="text-[10px]">{kindIcon(item.kind)}</span>
                      <div className="min-w-0">
                        <div className="truncate font-mono-hud text-[10px] font-bold text-pearl">
                          {item.name}
                        </div>
                        <div className="text-[9px] text-forge-dim">{item.meta}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onNewForge}
                className="font-mono-hud text-[10px] text-forge-dim hover:text-pearl tracking-widest"
              >
                START A NEW FORGE →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showPreviewModal && activeCapsule && (
        <PreviewCapsuleModal
          capsule={activeCapsule}
          onClose={() => setShowPreviewModal(false)}
          onExtend={handleExtendCapsule}
          onDelete={handleDeleteCapsule}
          onOpenQuestionnaire={() => {
            setShowPreviewModal(false);
            setShowAdvisorModal(true);
          }}
        />
      )}

      {showAdvisorModal && (
        <DeploymentAdvisorModal
          plan={plan}
          onClose={() => setShowAdvisorModal(false)}
        />
      )}
    </div>
  );
}

function kindIcon(kind: IngestItem["kind"]): string {
  switch (kind) {
    case "repo":
      return "🔗";
    case "image":
      return "🖼";
    case "code":
      return "⌨";
    default:
      return "📄";
  }
}
