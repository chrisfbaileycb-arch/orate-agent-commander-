import { useState } from "react";
import { MCP_BENCH, MCP_CATEGORY_LABELS, type McpCategory, type McpServer } from "../lib/mcp";
import Modal from "./Modal";

/**
 * MCP TOOL BENCH — browsable catalog of the backend MCP servers the forge
 * seats per phase, distilled from the AgenticSkills MCP directory.
 */

const TIER_STYLE: Record<McpServer["tier"], string> = {
  official: "text-forge-cyan border-forge-cyan/40",
  verified: "text-forge-gold border-forge-gold/40",
  community: "text-forge-dim border-seam",
};

const CATEGORIES = Object.keys(MCP_CATEGORY_LABELS) as McpCategory[];

export default function McpBenchModal({ onClose }: { onClose: () => void }) {
  const [cat, setCat] = useState<McpCategory | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const servers = cat === "all" ? MCP_BENCH : MCP_BENCH.filter((s) => s.category === cat);

  return (
    <Modal
      title="MCP TOOL BENCH"
      subtitle="Model Context Protocol servers the forge seats for backend work — distilled from the AgenticSkills MCP directory (200+ servers audited). Official and verified servers only for critical paths."
      onClose={onClose}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setCat("all")}
          className={`rounded-full border px-3 py-1 font-mono-hud text-[9px] tracking-[0.12em] transition-colors ${
            cat === "all" ? "border-forge-cyan/60 text-pearl" : "border-seam text-forge-dim hover:text-pearl"
          }`}
        >
          ALL · {MCP_BENCH.length}
        </button>
        {CATEGORIES.map((c) => {
          const n = MCP_BENCH.filter((s) => s.category === c).length;
          if (n === 0) return null;
          return (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-3 py-1 font-mono-hud text-[9px] tracking-[0.12em] transition-colors ${
                cat === c ? "border-forge-cyan/60 text-pearl" : "border-seam text-forge-dim hover:text-pearl"
              }`}
            >
              {MCP_CATEGORY_LABELS[c].toUpperCase()} · {n}
            </button>
          );
        })}
      </div>

      <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
        {servers.map((s) => (
          <article key={s.id} className="rounded-lg border border-seam bg-depth/60 p-3">
            <button
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-hud text-[12px] font-bold tracking-[0.08em] text-pearl">{s.name}</span>
                  <span className={`rounded border px-1.5 py-0.5 font-mono-hud text-[8px] tracking-[0.14em] ${TIER_STYLE[s.tier]}`}>
                    {s.tier.toUpperCase()}
                  </span>
                  <span className="font-mono-hud text-[9px] text-forge-dim">
                    {s.transport} · {s.auth}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-forge-dim">{s.desc}</p>
                <div className="mt-1 font-mono-hud text-[8.5px] tracking-[0.14em] text-forge-cyan/70">
                  SERVES: {s.serves.join(" · ").toUpperCase()}
                </div>
              </div>
              <span className="mt-0.5 font-mono-hud text-[10px] text-forge-dim">{expanded === s.id ? "▾" : "▸"}</span>
            </button>

            {expanded === s.id && (
              <div className="mt-2.5 border-t border-seam pt-2.5">
                <div className="font-mono-hud text-[8.5px] tracking-[0.16em] text-forge-dim">
                  MCP.JSON CONNECT SNIPPET
                </div>
                <pre className="mt-1 overflow-x-auto rounded border border-seam bg-abyss/80 p-2 font-mono-hud text-[9.5px] leading-relaxed text-forge-cyan/90">
                  {s.connect}
                </pre>
                <div className="mt-1 font-mono-hud text-[8.5px] text-forge-dim/70">
                  VENDOR: {s.vendor} — keys belong in your platform env, never in the browser.
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </Modal>
  );
}
