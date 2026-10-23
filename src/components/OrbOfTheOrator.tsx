import { useEffect, useRef, useState } from "react";
import { createOrb, type OrbHandle } from "../canvas/orb";
import { strikeSound, setDroneEnergy } from "../lib/voice";
import type { AudioSignal } from "../lib/audio-types";

/**
 * ORB OF THE ORATOR — the centerpiece.
 *
 * Reference (the "Oracle" clip): a huge iridescent orb dominating the frame,
 * centered, with orbital rings, a glowing caption ("LISTENING...") beneath it,
 * and pill action buttons flanking it. Ours keeps that scale and theater — but
 * the interaction is the event: the orb wakes when you approach, ripples where
 * you touch, and surges with every build phase. Striking it answers back.
 */

interface Props {
  /** 0..1 sustained dialogue energy — swirl speed, gold bloom, wake state. */
  energy?: number;
  /** Live audio reactivity signal from microphone or Orator speech */
  audioSignal?: AudioSignal;
  /** Counter or flag that triggers a restrained word shockwave ripple */
  wordPulseCount?: number;
  /** Caption under the orb (e.g. "LISTENING…", "FORGING…"). */
  caption?: string;
  /** Sub-caption line. */
  sub?: string;
  /** Fired on pointer-down when the user strikes the orb. */
  onStrike?: () => void;
  className?: string;
  /** When false, strikes pulse the orb but suppress the floating wake-line captions. */
  showWakeLine?: boolean;
}

const WAKE_LINES = [
  "THE ORB SEES YOU",
  "PLASMA RISING — SAY THE WORD",
  "SIXTEEN EXPERTS HOLD THEIR BREATH",
  "THE FORGE ANSWERS",
];

export default function OrbOfTheOrator({
  energy = 0,
  audioSignal,
  wordPulseCount = 0,
  caption,
  sub,
  onStrike,
  className = "",
  showWakeLine = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<OrbHandle | null>(null);
  const strikeRef = useRef(onStrike);
  strikeRef.current = onStrike;

  const [strikes, setStrikes] = useState(0);
  const [wakeLine, setWakeLine] = useState<string | null>(null);
  const wakeTimer = useRef<number | null>(null);
  const wakeOn = showWakeLine;

  useEffect(() => {
    if (!canvasRef.current) return;
    const orb = createOrb(canvasRef.current);
    orbRef.current = orb;
    return () => {
      orb.destroy();
      orbRef.current = null;
    };
  }, []);

  // Audio reactivity signal feeds directly into WebGL shader uniforms
  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    if (audioSignal) {
      orb.setAudioSignal({
        low: audioSignal.low,
        mid: audioSignal.mid,
        high: audioSignal.high,
        energy: Math.max(energy, audioSignal.normalizedEnergy),
      });
    } else if (energy > 0) {
      orb.pulse(Math.min(1, energy));
    }
  }, [audioSignal, energy]);

  // Trigger surface word ripple on new interim speech tokens
  useEffect(() => {
    if (wordPulseCount > 0) {
      orbRef.current?.triggerWordRipple();
    }
  }, [wordPulseCount]);

  // Strike = the special event: flash, wake line, crystal chime, escalate energy.
  const strike = () => {
    const next = strikes + 1;
    setStrikes(next);
    orbRef.current?.pulse(0.8);
    strikeSound(Math.min(1, 0.6 + next * 0.15));
    if (wakeOn) {
      setWakeLine(WAKE_LINES[(next - 1) % WAKE_LINES.length]);
      if (wakeTimer.current !== null) window.clearTimeout(wakeTimer.current);
      wakeTimer.current = window.setTimeout(() => setWakeLine(null), 3200);
    }
    setDroneEnergy(Math.min(1, 0.2 + next * 0.15));
    onStrike?.();
  };

  useEffect(() => {
    return () => {
      if (wakeTimer.current !== null) window.clearTimeout(wakeTimer.current);
    };
  }, []);

  const totalEnergy = Math.min(1, energy + strikes * 0.18);

  return (
    <div className={`relative select-none ${className}`}>
      {/* Bloom halo behind the orb */}
      <div
        aria-hidden
        className="orb-halo pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full"
      />

      {/* Orbital HUD rings — flat ellipses sweeping around the sphere */}
      <div
        aria-hidden
        className="orb-ring pointer-events-none absolute left-1/2 top-1/2 h-[104%] w-[104%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-seam/60"
      />
      <div
        aria-hidden
        className="orb-ring-slow pointer-events-none absolute left-1/2 top-1/2 h-[118%] w-[96%] -translate-x-1/2 -translate-y-1/2 rounded-[100%] border border-forge-cyan/15"
      />

      {/* The orb itself */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={strike}
          aria-label="The Orb of the Orator — strike to wake the forge"
          role="img"
          className="orb-canvas relative aspect-square w-full cursor-pointer rounded-full"
        />
        {strikes > 0 && (
          <div key={strikes} aria-hidden className="orb-strike-flash" />
        )}
      </div>

      {/* Wake line / Caption — positioned cleanly outside the orb container so the sphere is 100% unobstructed */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-8 text-center">
        {wakeLine ? (
          <div
            key={wakeLine}
            className="animate-drift-up font-mono-hud text-[12px] font-bold tracking-[0.5em] text-forge-gold text-glow-gold"
          >
            {wakeLine}
          </div>
        ) : caption ? (
          <div className="font-mono-hud text-[12px] font-bold tracking-[0.5em] text-pearl text-glow-soft">
            {caption}
          </div>
        ) : null}
        {sub && !wakeLine && (
          <div className="mt-1 font-mono-hud text-[9px] tracking-[0.3em] text-forge-dim">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
