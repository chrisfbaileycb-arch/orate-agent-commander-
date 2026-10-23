import { useEffect, useRef, useState } from "react";
import type { ScarcityTelemetry } from "./types";

/** ---------- Ambient scarcity alert loop ---------- */

export interface ScarcityAlert {
  id: number;
  message: string;
}

const MESSAGES = [
  "FORGE CAPACITY NEARING FULL — slot holds expire in minutes",
  "A charter client just claimed a build slot",
  "Velvet rope queue is moving — 1 slot released",
  "Peak forging window detected — capacity re-routed",
];

export function useScarcityAlerts(enabled: boolean): ScarcityAlert[] {
  const [alerts, setAlerts] = useState<ScarcityAlert[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      const id = ++idRef.current;
      setAlerts((a) => [...a.slice(-2), { id, message: msg }]);
      setTimeout(() => {
        if (!alive) return;
        setAlerts((a) => a.filter((x) => x.id !== id));
      }, 6000);
      timer = setTimeout(loop, 14000 + Math.random() * 10000);
    };
    let timer = setTimeout(loop, 8000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [enabled]);

  return alerts;
}

/** ---------- Deterministic-ish capacity telemetry ---------- */

export function computeTelemetry(sessionCount: number): ScarcityTelemetry {
  const maxBuilds = 10;
  const now = new Date();
  const hourWave = Math.sin((now.getHours() + now.getMinutes() / 60) * (Math.PI / 12));
  const activeBuilds = Math.min(maxBuilds, 6 + Math.round(hourWave * 2) + (sessionCount % 2));
  const capacityPct = Math.round((activeBuilds / maxBuilds) * 100);
  return {
    capacityPct,
    activeBuilds,
    maxBuilds,
    slotsRemaining: Math.max(0, maxBuilds - activeBuilds),
  };
}
