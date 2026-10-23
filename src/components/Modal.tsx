import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/** ---------- Shared modal shell with ESC handling and HUD framing ---------- */

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, subtitle, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-abyss/85 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="hud-panel corner-tick relative z-10 w-full max-w-lg animate-drift-up p-6"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 font-mono-hud text-xs text-forge-dim transition-colors hover:text-forge-cyan"
        >
          ✕ ESC
        </button>
        <h2 className="font-mono-hud text-sm font-bold tracking-[0.2em] text-forge-cyan text-glow-cyan">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1.5 font-mono-hud text-[11px] leading-relaxed tracking-[0.06em] text-forge-dim">
            {subtitle}
          </p>
        )}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
