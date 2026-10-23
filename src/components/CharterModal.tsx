import { useState } from "react";
import Modal from "./Modal";
import { CHARTER_PRICE_USD } from "../lib/session";

/** ---------- $99 Charter modal (demo gate — no real payment is processed) ---------- */

interface Props {
  sessionsUsed: number;
  onAccept: () => void;
  onClose: () => void;
}

export default function CharterModal({ sessionsUsed, onAccept, onClose }: Props) {
  const [ack, setAck] = useState(false);

  return (
    <Modal
      title="CHARTER ACCESS // $99"
      subtitle={`Your ${sessionsUsed} practice build${sessionsUsed === 1 ? "" : "s"} are spent. A charter unlocks unlimited forge sessions, priority quorum (paid-tier experts), and executive delivery.`}
      onClose={onClose}
    >
      <div className="space-y-2.5">
        {[
          ["UNLIMITED SESSIONS", "Forge as many blueprints as you can direct."],
          ["HIGH-REASONING QUORUM", "Paid-tier experts lead every phase."],
          ["EXECUTIVE DELIVERY", "Signed ZIP + full 22-point audit dossier."],
        ].map(([t, d]) => (
          <div key={t} className="flex items-start gap-3 rounded-lg border border-seam/70 bg-depth/60 px-3.5 py-2.5">
            <span className="mt-0.5 text-forge-gold">✦</span>
            <div>
              <div className="font-mono-hud text-[10px] font-bold tracking-[0.16em] text-pearl">{t}</div>
              <div className="mt-0.5 text-[11px] text-forge-dim">{d}</div>
            </div>
          </div>
        ))}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#f2c14e]"
        />
        <span className="font-mono-hud text-[10px] leading-relaxed tracking-[0.06em] text-forge-dim">
          I understand this demo appliance does not process real payments — accepting marks the
          session as chartered for evaluation. No card is charged.
        </span>
      </label>

      <button
        onClick={onAccept}
        disabled={!ack}
        className="btn-forge btn-gold mt-5 w-full px-4 py-3 text-[11px]"
      >
        ACCEPT CHARTER — ${CHARTER_PRICE_USD}
      </button>
    </Modal>
  );
}
