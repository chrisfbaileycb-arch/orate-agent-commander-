import { useState } from "react";
import Modal from "./Modal";
import { BUILD_PASS_REGISTRY } from "../lib/build-pass-service";

/** ---------- Executive Build Pass Modal (Flat Fee / No $20/mo metered trap) ---------- */

interface Props {
  clientId: string;
  explorationsCompleted: number;
  onGrantPass: (tierId: "single" | "builder" | "studio") => void;
  onClose: () => void;
}

export default function BuildPassModal({
  clientId,
  explorationsCompleted,
  onGrantPass,
  onClose,
}: Props) {
  const [selectedTier, setSelectedTier] = useState<"executive" | "retainer" | "sprint">("executive");
  const [showEconomicsManifesto, setShowEconomicsManifesto] = useState(false);
  const [ack, setAck] = useState(false);

  const displayTiers = [
    BUILD_PASS_REGISTRY.executive,
    BUILD_PASS_REGISTRY.retainer,
    BUILD_PASS_REGISTRY.sprint,
  ];

  const handleSelect = (tierId: "executive" | "retainer" | "sprint") => {
    setSelectedTier(tierId);
  };

  const handleConfirm = () => {
    const mapped = selectedTier === "retainer" ? "studio" : selectedTier === "sprint" ? "builder" : "single";
    onGrantPass(mapped);
  };

  return (
    <Modal
      title="US SOVEREIGN EXECUTIVE BUILD PASS"
      subtitle="Discovery & Architecture Specs are Always Free. Execute & Export via flat-fee sovereign manufacturing."
      onClose={onClose}
    >
      {/* Why Flat-Fee Per App Banner */}
      <div className="rounded-xl border border-forge-cyan/40 bg-cyan-950/30 p-3 mb-4 font-mono-hud text-[11px] leading-relaxed">
        <div className="flex items-center justify-between">
          <span className="font-bold text-pearl flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-forge-cyan animate-pulse" />
            ECONOMIC VERDICT: PER-APP FLAT UNLOCK (NOT $20/MO)
          </span>
          <button
            type="button"
            onClick={() => setShowEconomicsManifesto(!showEconomicsManifesto)}
            className="text-[10px] text-cyan-300 underline hover:text-pearl"
          >
            {showEconomicsManifesto ? "Hide Economic Thesis ▲" : "Read The Economic Thesis ▼"}
          </button>
        </div>

        {showEconomicsManifesto && (
          <div className="mt-3 space-y-2.5 pt-2.5 border-t border-cyan-500/30 text-[10px] text-gray-300">
            <div>
              <span className="font-bold text-amber-300">1. The "Penny-Pinching" Mindset:</span> $20/month subscribers expect infinite revisions for pocket change. When multi-agent generation hits token limits or fails a compile, they churn.
            </div>
            <div>
              <span className="font-bold text-amber-300">2. Hidden Compute Burn:</span> Running Claude Sonnet 5, Gemini 3.8 Flash, and Azure enterprise checks across multi-agent loops costs $2.00 to $5.00 in pure raw token compute per build. A $20/month flat fee leaves zero margin on active power users.
            </div>
            <div>
              <span className="font-bold text-amber-300">3. High-Value Agency Positioning:</span> A founder paying an agency $10,000 for an internal tool views a $20 tool as fragile toy software. At $149 flat per completed build, ORATOR commands serious enterprise respect with guaranteed delivery.
            </div>
            <div>
              <span className="font-bold text-cyan-300">4. The Separation of Gates:</span> Discovery (15-question voice inquest, 3-4 concept mockups, AWS blueprints) is <strong className="text-emerald-400">100% Free</strong>. Execution & Full Code Export is a single flat fee.
            </div>
          </div>
        )}
      </div>

      {/* Tier Selector */}
      <div className="space-y-3">
        {displayTiers.map((tier) => {
          const isSelected = selectedTier === tier.id;
          return (
            <div
              key={tier.id}
              onClick={() => handleSelect(tier.id as "executive" | "retainer" | "sprint")}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                isSelected
                  ? "border-forge-cyan bg-cyan-950/40 shadow-[0_0_20px_rgba(53,224,255,0.2)]"
                  : "border-seam/80 bg-depth/60 hover:border-seam hover:bg-depth/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? "bg-forge-cyan animate-pulse" : "bg-forge-dim"}`} />
                  <span className="font-mono-hud text-[12px] font-bold tracking-[0.14em] text-pearl">
                    {tier.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-depth/90 border border-seam px-2 py-0.5 font-mono-hud text-[8.5px] tracking-widest text-forge-gold">
                    {tier.badge}
                  </span>
                  <span className="font-mono-hud text-base font-extrabold text-cyan-300">
                    ${tier.priceUsd}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-forge-dim/90 pl-5 leading-relaxed">{tier.description}</p>
            </div>
          );
        })}
      </div>

      {/* Direct Deliverables Guarantee */}
      <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3 font-mono-hud text-[11px] leading-relaxed text-emerald-300">
        <span className="font-bold text-pearl">Direct Deliverables Unlocked:</span>
        <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
          <span className="rounded border border-emerald-500/50 bg-emerald-950/60 px-2 py-0.5">✓ Live Interactive Iframe Runtime</span>
          <span className="rounded border border-purple-500/50 bg-purple-950/60 px-2 py-0.5 text-purple-300">✓ Push to GitHub (Automated PR)</span>
          <span className="rounded border border-amber-500/50 bg-amber-950/60 px-2 py-0.5 text-amber-300">✓ Download Full Source ZIP</span>
          <span className="rounded border border-cyan-500/50 bg-cyan-950/60 px-2 py-0.5 text-cyan-300">✓ Sovereign Provenance Certification</span>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#35e0ff]"
        />
        <span className="font-mono-hud text-[10px] leading-relaxed text-forge-dim">
          Evaluation Mode: Check this box to instantly unlock a verified Executive Build Pass without charging a live credit card.
        </span>
      </label>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!ack}
        className="btn-forge btn-primary mt-5 w-full px-4 py-3.5 text-xs font-bold shadow-[0_0_18px_rgba(53,224,255,0.35)]"
      >
        UNLOCK {BUILD_PASS_REGISTRY[selectedTier]?.name.toUpperCase()} (${BUILD_PASS_REGISTRY[selectedTier]?.priceUsd})
      </button>
    </Modal>
  );
}
