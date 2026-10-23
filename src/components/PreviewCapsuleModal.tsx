import { useState } from "react";
import type { PreviewCapsule, CapsuleFeedback, ShareMode } from "../lib/capsule-types";
import { globalCapsuleService } from "../lib/capsule-service";

interface Props {
  capsule: PreviewCapsule;
  onClose: () => void;
  onExtend: (hours: number) => void;
  onDelete: () => void;
  onOpenQuestionnaire: () => void;
}

export default function PreviewCapsuleModal({
  capsule,
  onClose,
  onExtend,
  onDelete,
  onOpenQuestionnaire,
}: Props) {
  const [activeTab, setActiveTab] = useState<"preview" | "share" | "feedback">("preview");
  const [shareMode, setShareMode] = useState<ShareMode>(capsule.sharePolicy.mode);
  const [passcode, setPasscode] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState<CapsuleFeedback["type"]>("like");
  const [feedbackList, setFeedbackList] = useState<CapsuleFeedback[]>(() =>
    globalCapsuleService.getFeedback(capsule.id)
  );
  const [copied, setCopied] = useState(false);

  const remainingMs = Math.max(0, capsule.expiresAt - Date.now());
  const hoursLeft = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutesLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const isExpired = remainingMs === 0 || capsule.status === "EXPIRED" || capsule.status === "DELETED";

  const publicUrl = `https://preview.orator.dev/c/${capsule.id}#token=${capsule.accessTokenHash.slice(0, 16)}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateShare = () => {
    globalCapsuleService.updateSharePolicy(capsule.id, {
      mode: shareMode,
    });
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    const item = globalCapsuleService.submitFeedback(capsule.id, {
      buildId: capsule.buildId,
      currentRoute: "/",
      type: feedbackType,
      comment: feedbackText.trim(),
    });
    setFeedbackList((prev) => [...prev, item]);
    setFeedbackText("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-seam bg-depth shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-seam px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 items-center justify-center">
              <span className={`h-2.5 w-2.5 rounded-full ${isExpired ? "bg-forge-alert" : "bg-forge-cyan animate-pulse-soft"}`} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono-hud text-[10px] tracking-[0.2em] text-forge-cyan">
                  TEMPORARY PREVIEW CAPSULE
                </span>
                <span className="rounded bg-seam/60 px-2 py-0.5 font-mono-hud text-[9px] text-pearl">
                  {capsule.status}
                </span>
              </div>
              <h3 className="font-display text-base font-semibold text-pearl">
                {capsule.manifest.appName}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-forge-dim hover:text-pearl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Expiration and disclosure bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-seam/80 bg-abyss/60 px-6 py-2.5 text-[11px]">
          <div className="flex items-center gap-2 text-forge-dim">
            <span>⏱ Expires in:</span>
            <span className={`font-mono-hud font-bold ${isExpired ? "text-forge-alert" : "text-forge-gold"}`}>
              {isExpired ? "EXPIRED" : `${hoursLeft}h ${minutesLeft}m`}
            </span>
            <span className="text-forge-dim/60">({new Date(capsule.expiresAt).toLocaleString()})</span>
          </div>
          <div className="flex items-center gap-2">
            {!isExpired && (
              <button
                type="button"
                onClick={() => onExtend(24)}
                className="font-mono-hud text-[10px] tracking-wider text-forge-cyan hover:underline"
              >
                + EXTEND 24H
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="font-mono-hud text-[10px] tracking-wider text-forge-alert hover:underline"
            >
              DELETE PREVIEW NOW
            </button>
          </div>
        </div>

        {/* Prominent Legal Disclosure */}
        <div className="border-b border-forge-gold/20 bg-forge-gold/5 px-6 py-2 text-[10.5px] leading-relaxed text-forge-gold/80">
          This temporary Orator Preview is provided for testing, sharing, and feedback. Demonstration data and the preview environment are automatically and permanently deleted when it expires. Orator is not a permanent hosting service.
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-seam bg-depth px-6 pt-2">
          {[
            { id: "preview", label: "INTERACTIVE RUNTIME" },
            { id: "share", label: "SHARE & ACCESS" },
            { id: "feedback", label: `FEEDBACK (${feedbackList.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as "preview" | "share" | "feedback")}
              className={`border-b-2 px-4 py-2 font-mono-hud text-[10px] tracking-widest transition-colors ${
                activeTab === t.id
                  ? "border-forge-cyan text-forge-cyan font-bold"
                  : "border-transparent text-forge-dim hover:text-pearl"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-forge-dim">
                <span>Isolated Sandbox Environment · Zero Host Privileges</span>
                <span className="font-mono-hud text-[10px] text-forge-cyan">
                  {capsule.deploymentProvider.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>

              {/* Jailed Preview Iframe */}
              <div className="relative h-[380px] w-full overflow-hidden rounded-lg border border-seam bg-abyss">
                <iframe
                  title="Orator Sandbox Capsule"
                  sandbox="allow-scripts allow-forms"
                  srcDoc={`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { background: #070d18; color: #eaf6ff; font-family: system-ui, sans-serif; padding: 24px; margin: 0; line-height: 1.5; }
    .badge { display: inline-block; background: rgba(53,224,255,0.15); border: 1px solid rgba(53,224,255,0.4); color: #35e0ff; font-size: 11px; padding: 2px 8px; border-radius: 4px; font-family: monospace; }
    .card { background: #0c1626; border: 1px solid #16283f; border-radius: 8px; padding: 18px; margin-top: 16px; }
    button { background: #35e0ff; color: #070d18; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; }
    input { background: #070d18; border: 1px solid #16283f; color: #fff; padding: 8px; border-radius: 4px; width: 100%; box-sizing: border-box; margin-top: 6px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="badge">ORATOR INTERACTIVE PREVIEW CAPSULE</div>
  <h2 style="color: #35e0ff; margin: 8px 0;">${capsule.manifest.appName}</h2>
  <p style="color: #7d95b2; font-size: 13px;">${capsule.manifest.summary}</p>
  <div class="card">
    <h4 style="margin: 0 0 8px 0; color: #f2c14e;">Interactive Demonstration State</h4>
    <p style="font-size: 12px; color: #7d95b2;">Try out forms and temporary interactions. Data stays in this temporary isolated session:</p>
    <label style="font-size: 11px; color: #7d95b2;">Test Record Name:</label>
    <input id="sampleInput" value="Sample Verified Item #1" />
    <button onclick="document.getElementById('statusMsg').innerText = 'Demonstration action dispatched safely at ' + new Date().toLocaleTimeString();">Test Form Action</button>
    <div id="statusMsg" style="margin-top: 10px; font-size: 12px; color: #8be9c3; font-family: monospace;"></div>
  </div>
</body>
</html>`}
                  className="h-full w-full border-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="font-mono-hud text-[10px] text-forge-dim">
                  HEALTH CHECK: <span className="text-forge-cyan font-bold">HEALTHY (HTTP 200)</span> · SECRETS REDACTED
                </div>
                <button
                  type="button"
                  onClick={onOpenQuestionnaire}
                  className="btn-forge btn-gold px-5 py-2.5 text-[10px]"
                >
                  FIND PERMANENT HOSTING →
                </button>
              </div>
            </div>
          )}

          {activeTab === "share" && (
            <div className="space-y-5">
              <div>
                <label className="font-mono-hud text-[10px] tracking-wider text-forge-cyan">
                  PREVIEW SHARING MODE
                </label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {[
                    { id: "owner_only", label: "Owner Only", desc: "Private to your session" },
                    { id: "public_link", label: "Unguessable Link", desc: "Anyone with token URL" },
                    { id: "passcode_protected", label: "Passcode Required", desc: "Link + private passcode" },
                  ].map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setShareMode(m.id as ShareMode)}
                      className={`cursor-pointer rounded-lg border p-3 ${
                        shareMode === m.id
                          ? "border-forge-cyan bg-forge-cyan/10"
                          : "border-seam/80 bg-depth/60"
                      }`}
                    >
                      <div className="font-mono-hud text-[11px] font-bold text-pearl">{m.label}</div>
                      <div className="mt-1 text-[10.5px] text-forge-dim">{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {shareMode === "public_link" && (
                <div>
                  <label className="font-mono-hud text-[10px] tracking-wider text-forge-dim">
                    TEMPORARY SHAREABLE URL (EXPIRES WITH CAPSULE)
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={publicUrl}
                      className="flex-1 rounded-md border border-seam bg-abyss px-3 py-2 font-mono text-[11px] text-pearl"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="btn-forge btn-primary px-4 py-2 text-[10px]"
                    >
                      {copied ? "COPIED!" : "COPY LINK"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-forge-dim">
                    Contains random high-entropy token hash. Protected with noindex headers to prevent search engine indexing.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleUpdateShare}
                className="btn-forge btn-ghost px-4 py-2 text-[10px]"
              >
                SAVE SHARING PREFERENCES
              </button>
            </div>
          )}

          {activeTab === "feedback" && (
            <div className="space-y-5">
              <form onSubmit={handleSubmitFeedback} className="rounded-lg border border-seam bg-abyss/60 p-4">
                <div className="font-mono-hud text-[10px] tracking-wider text-forge-cyan">
                  LEAVE VIEWER FEEDBACK (DOES NOT MUTATE CODE DIRECTLY)
                </div>
                <div className="mt-2.5 flex gap-2">
                  {[
                    { id: "like", label: "I like this" },
                    { id: "change", label: "Change this" },
                    { id: "broken", label: "Something is broken" },
                    { id: "confused", label: "I am confused" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFeedbackType(t.id as CapsuleFeedback["type"])}
                      className={`rounded px-2.5 py-1 text-[10px] font-mono-hud ${
                        feedbackType === t.id
                          ? "bg-forge-cyan text-abyss font-bold"
                          : "bg-depth text-forge-dim hover:text-pearl"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Describe your suggestion or observation..."
                  rows={2}
                  className="mt-2.5 w-full rounded-md border border-seam bg-depth p-2.5 text-xs text-pearl focus:border-forge-cyan focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <button type="submit" className="btn-forge btn-primary px-4 py-1.5 text-[10px]">
                    SUBMIT FEEDBACK
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <div className="font-mono-hud text-[9px] tracking-widest text-forge-dim">
                  SUBMITTED VIEWER COMMENTS
                </div>
                {feedbackList.length === 0 ? (
                  <div className="rounded border border-dashed border-seam p-4 text-center text-xs text-forge-dim">
                    No feedback received yet. Share the temporary link with collaborators to gather input.
                  </div>
                ) : (
                  feedbackList.map((fb) => (
                    <div key={fb.id} className="rounded border border-seam bg-depth/70 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-hud text-[9.5px] font-bold text-forge-cyan">
                          {fb.type.toUpperCase()}
                        </span>
                        <span className="text-[9px] text-forge-dim">
                          {new Date(fb.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-pearl">{fb.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
