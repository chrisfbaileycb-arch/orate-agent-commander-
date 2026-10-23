/**
 * CORTEX Oscillating Signal Monitors
 * 60fps HTML5 Canvas dual/multi-trace sine/cosine oscillators rendering continuous wave activity:
 * 1. ATTENTION (Cyan)
 * 2. ENTROPY (Amber)
 * 3. BANDWIDTH (Violet)
 */

import { useEffect, useRef, useState } from "react";
import type { CortexMetrics } from "../../lib/cortex/types";

interface Props {
  metrics: CortexMetrics;
}

export default function CortexOscilloscope({ metrics }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTrace, setSelectedTrace] = useState<"all" | "attention" | "entropy" | "bandwidth">("all");

  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    // History buffers for the 3 traces (160 points each)
    const pointsCount = 160;
    const traceAttention: number[] = new Array(pointsCount).fill(50);
    const traceEntropy: number[] = new Array(pointsCount).fill(40);
    const traceBandwidth: number[] = new Array(pointsCount).fill(65);

    const render = () => {
      animId = requestAnimationFrame(render);
      time += 0.045;

      const w = canvas.width;
      const h = canvas.height;
      const cur = metricsRef.current;

      // Sine / cosine continuous wave equations reacting to metrics
      const attentionVal =
        52 +
        Math.sin(time * 3.2) * 22 +
        Math.cos(time * 1.4) * 12 +
        (cur.attentionSpike > 0.5 ? Math.sin(time * 7) * 8 : 0);

      const entropyVal =
        42 +
        Math.cos(time * 2.4 + 1.2) * 18 +
        Math.sin(time * 4.8) * 10 +
        (cur.tokenEntropy * 15);

      const bandwidthVal =
        60 +
        Math.sin(time * 2.8 + 2.1) * 24 +
        Math.cos(time * 5.1) * 8 +
        ((cur.tokPerSec / 120) * 10);

      traceAttention.shift();
      traceAttention.push(Math.max(8, Math.min(92, attentionVal)));

      traceEntropy.shift();
      traceEntropy.push(Math.max(8, Math.min(92, entropyVal)));

      traceBandwidth.shift();
      traceBandwidth.push(Math.max(8, Math.min(92, bandwidthVal)));

      // Clear with phosphor persistence fade
      ctx.fillStyle = "rgba(4, 9, 18, 0.28)";
      ctx.fillRect(0, 0, w, h);

      // Cybernetic Grid
      ctx.strokeStyle = "rgba(22, 40, 63, 0.45)";
      ctx.lineWidth = 1;

      const gridCols = 8;
      const gridRows = 4;
      for (let x = 0; x <= gridCols; x++) {
        const gx = (w / gridCols) * x;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let y = 0; y <= gridRows; y++) {
        const gy = (h / gridRows) * y;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Draw Trace function
      const drawTrace = (data: number[], color: string, glow: string, lineWidth: number = 1.8) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.shadowColor = glow;
        ctx.shadowBlur = 8;
        ctx.lineWidth = lineWidth;

        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = (w / (data.length - 1)) * i;
          const val = data[i];
          const y = h - (val / 100) * (h - 16) - 8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Leading phosphor spark
        const lastX = w;
        const lastY = h - (data[data.length - 1] / 100) * (h - 16) - 8;
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(lastX - 2, lastY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      };

      if (selectedTrace === "all" || selectedTrace === "attention") {
        drawTrace(traceAttention, "#35e0ff", "rgba(53, 224, 255, 0.85)", 2.0);
      }
      if (selectedTrace === "all" || selectedTrace === "entropy") {
        drawTrace(traceEntropy, "#f59e0b", "rgba(245, 158, 11, 0.85)", 1.8);
      }
      if (selectedTrace === "all" || selectedTrace === "bandwidth") {
        drawTrace(traceBandwidth, "#a855f7", "rgba(168, 85, 247, 0.85)", 1.8);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [selectedTrace]);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-seam/90 bg-hull/90 p-3 backdrop-blur-md shadow-xl">
      {/* Header & Trace selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-ping rounded-full bg-forge-cyan" />
          <span className="font-mono-hud text-[11px] font-bold tracking-wider text-pearl">
            OSCILLATING SIGNAL MONITORS
          </span>
          <span className="text-[9px] font-mono-hud text-cyan-300/70">[60 FPS DUAL-TRACE]</span>
        </div>
        <div className="flex items-center gap-1 font-mono-hud text-[9px]">
          {(["all", "attention", "entropy", "bandwidth"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSelectedTrace(mode)}
              className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
                selectedTrace === mode
                  ? "bg-forge-cyan/20 text-forge-cyan font-bold border border-forge-cyan/40"
                  : "text-forge-dim hover:text-pearl"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* 60fps Canvas Display */}
      <div className="relative h-28 w-full overflow-hidden rounded-lg border border-seam/70 bg-abyss">
        <canvas
          ref={canvasRef}
          width={440}
          height={112}
          className="h-full w-full object-cover"
        />

        {/* Live Trace Signal Readouts */}
        <div className="pointer-events-none absolute bottom-1.5 left-2 right-2 flex items-center justify-between font-mono-hud text-[9px] bg-abyss/60 px-2 py-0.5 rounded backdrop-blur-sm">
          <span className="flex items-center gap-1 text-forge-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-forge-cyan animate-pulse" />
            ATTENTION: <span className="font-bold">64.2%</span>
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            ENTROPY: <span className="font-bold">0.428</span>
          </span>
          <span className="flex items-center gap-1 text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            BANDWIDTH: <span className="font-bold">118 tok/s</span>
          </span>
        </div>
      </div>
    </div>
  );
}
