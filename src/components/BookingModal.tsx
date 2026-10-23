import { useMemo, useState } from "react";
import Modal from "./Modal";
import { isValidSlotISO } from "../lib/security";

/** ---------- Velvet Rope appointment-slot booking ---------- */

interface Props {
  slotsRemaining: number;
  onBook: (slotISO: string) => void;
  onClose: () => void;
}

function nextSlots(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  while (out.length < count) {
    // Offer working hours only (08:00–20:00), skip to next day otherwise
    if (d.getHours() >= 8 && d.getHours() < 20) {
      out.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:00`
      );
    }
    d.setHours(d.getHours() + 1);
  }
  return out;
}

export default function BookingModal({ slotsRemaining, onBook, onClose }: Props) {
  const slots = useMemo(() => nextSlots(6), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    if (!selected || !isValidSlotISO(selected)) {
      setError("Select a valid slot before sealing the appointment.");
      return;
    }
    onBook(selected);
  };

  return (
    <Modal
      title="VELVET ROPE // APPOINTMENT"
      subtitle={`The forge accepts ${slotsRemaining} concurrent build${slotsRemaining === 1 ? "" : "s"}. Reserve a slot and your inquest is executed at the top of the hour, exclusively.`}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slots.map((s) => {
          const active = selected === s;
          return (
            <button
              key={s}
              onClick={() => {
                setSelected(s);
                setError(null);
              }}
              className={`rounded-lg border px-3 py-2.5 font-mono-hud text-[11px] tracking-[0.08em] transition-all ${
                active
                  ? "border-forge-gold bg-forge-gold/10 text-forge-gold shadow-goldglow"
                  : "border-seam text-forge-dim hover:border-forge-cyan/50 hover:text-pearl"
              }`}
            >
              {s.replace("T", " · ")}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-3 font-mono-hud text-[10px] tracking-[0.08em] text-forge-alert">⚠ {error}</p>
      )}

      <button
        onClick={confirm}
        disabled={!selected}
        className="btn-forge btn-gold mt-5 w-full px-4 py-3 text-[11px]"
      >
        SEAL APPOINTMENT ✦
      </button>
      <p className="mt-3 text-center font-mono-hud text-[9px] tracking-[0.14em] text-forge-dim">
        SLOTS ARE HELD FOR 15 MINUTES PAST THE HOUR
      </p>
    </Modal>
  );
}
