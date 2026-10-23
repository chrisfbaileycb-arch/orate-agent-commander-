import { useState } from "react";
import { setMuted, speechSupported, setSpeechEnabled, isSpeechEnabled } from "../lib/voice";

/**
 * VOICE CONDUIT — persistent voice control chip.
 * One toggle governs the Orator's spoken voice + the forge's synthesized
 * resonance. Everything is generated locally — no uploads, no assets.
 */
export default function VoiceConduit() {
  const [on, setOn] = useState(() => isSpeechEnabled());

  const toggle = () => {
    const next = !on;
    setOn(next);
    setSpeechEnabled(next);
    setMuted(!next); // mute WebAudio resonance when voice is off
  };

  if (!speechSupported()) {
    return (
      <span className="hidden rounded-md border border-seam px-2.5 py-1 font-mono-hud text-[10px] tracking-[0.12em] text-forge-dim/50 md:block">
        VOICE UNSUPPORTED
      </span>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={on ? "Mute the Orator" : "Unmute the Orator"}
      className="btn-forge btn-ghost px-3 py-1.5 text-[10px]"
      title="Orator voice & forge resonance (local TTS + WebAudio)"
    >
      {on ? "🔊 VOICE ON" : "🔇 VOICE OFF"}
    </button>
  );
}
