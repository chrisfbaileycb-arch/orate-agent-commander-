import type { MindMap } from "../lib/types";

/** ---------- Mind-map canvas: radial graph with photon energy packets ---------- */

interface LayoutNode {
  id: string;
  label: string;
  kind: string;
  detail: string;
  x: number;
  y: number;
  r: number;
}

const KIND_COLORS: Record<string, string> = {
  core: "#f2c14e",
  system: "#35e0ff",
  module: "#35e0ff",
  contract: "#8be9c3",
  ops: "#7d95b2",
};

const PHOTON_SPEED = 0.008;

export class MindMapRenderer {
  private ctx: CanvasRenderingContext2D;
  private nodes: LayoutNode[] = [];
  private edges: { from: LayoutNode; to: LayoutNode; label: string }[] = [];
  private photons: { edge: number; t: number; speed: number }[] = [];
  private raf = 0;
  private hoverId: string | null = null;
  private time = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");
    this.ctx = ctx;
    canvas.addEventListener("mousemove", this.onMove);
    canvas.addEventListener("mouseleave", this.onLeave);
  }

  setData(map: MindMap): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    const cx = width / 2;
    const cy = height / 2;
    this.nodes = map.nodes.map((n) => ({ ...n, x: cx, y: cy, r: n.kind === "core" ? 34 : 15 }));
    const byId = new Map(this.nodes.map((n) => [n.id, n]));
    this.edges = map.edges
      .map((e) => {
        const from = byId.get(e.from);
        const to = byId.get(e.to);
        return from && to ? { from, to, label: e.label } : null;
      })
      .filter((e): e is { from: LayoutNode; to: LayoutNode; label: string } => e !== null);

    // Radial layout: core center, systems at r1, contracts/ops at r2.
    const r1 = Math.min(width, height) * 0.26;
    const r2 = Math.min(width, height) * 0.42;
    let sysIdx = 0;
    let outerIdx = 0;
    const sysCount = this.nodes.filter((n) => n.kind === "system").length;
    const outerCount = this.nodes.filter((n) => n.kind !== "system" && n.kind !== "core").length;
    for (const n of this.nodes) {
      if (n.kind === "core") continue;
      if (n.kind === "system") {
        const a = (sysIdx / Math.max(1, sysCount)) * Math.PI * 2 - Math.PI / 2;
        n.x = cx + Math.cos(a) * r1;
        n.y = cy + Math.sin(a) * r1;
        sysIdx++;
      } else {
        const a = (outerIdx / Math.max(1, outerCount)) * Math.PI * 2 - Math.PI / 2 + 0.35;
        n.x = cx + Math.cos(a) * r2;
        n.y = cy + Math.sin(a) * r2;
        outerIdx++;
      }
    }

    this.photons = this.edges.map((_, i) => ({
      edge: i,
      t: Math.random(),
      speed: PHOTON_SPEED * (0.6 + Math.random() * 0.9),
    }));
  }

  start(): void {
    const loop = () => {
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("mousemove", this.onMove);
    this.canvas.removeEventListener("mouseleave", this.onLeave);
  }

  private onMove = (ev: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    this.hoverId = null;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < n.r + 8) {
        this.hoverId = n.id;
        break;
      }
    }
    this.canvas.style.cursor = this.hoverId ? "pointer" : "default";
  };

  private onLeave = () => {
    this.hoverId = null;
  };

  getTooltip(): { label: string; detail: string } | null {
    const n = this.nodes.find((x) => x.id === this.hoverId);
    return n ? { label: n.label, detail: n.detail } : null;
  }

  private draw(): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (this.canvas.width !== width * devicePixelRatio) {
      this.canvas.width = width * devicePixelRatio;
      this.canvas.height = height * devicePixelRatio;
    }
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    this.time += 1;

    // Edges
    ctx.lineWidth = 1;
    for (const e of this.edges) {
      const grad = ctx.createLinearGradient(e.from.x, e.from.y, e.to.x, e.to.y);
      grad.addColorStop(0, "rgba(242,193,78,0.35)");
      grad.addColorStop(1, "rgba(53,224,255,0.35)");
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(e.from.x, e.from.y);
      ctx.lineTo(e.to.x, e.to.y);
      ctx.stroke();
    }

    // Photons
    for (const p of this.photons) {
      const e = this.edges[p.edge];
      if (!e) continue;
      p.t += p.speed;
      if (p.t > 1) p.t = 0;
      const x = e.from.x + (e.to.x - e.from.x) * p.t;
      const y = e.from.y + (e.to.y - e.from.y) * p.t;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 7);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.4, "rgba(53,224,255,0.6)");
      glow.addColorStop(1, "rgba(53,224,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nodes
    for (const n of this.nodes) {
      const hovered = n.id === this.hoverId;
      const pulse = 1 + Math.sin(this.time * 0.03 + n.x * 0.01) * 0.04;
      const r = n.r * pulse * (hovered ? 1.15 : 1);
      const color = KIND_COLORS[n.kind] ?? "#7d95b2";

      if (n.kind === "core") {
        const halo = ctx.createRadialGradient(n.x, n.y, r * 0.4, n.x, n.y, r * 2.4);
        halo.addColorStop(0, "rgba(242,193,78,0.5)");
        halo.addColorStop(1, "rgba(242,193,78,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = n.kind === "core" ? color : "rgba(7,13,24,0.92)";
      ctx.strokeStyle = color;
      ctx.lineWidth = hovered ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (n.kind !== "core") {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      // Label
      ctx.font = `${n.kind === "core" ? "600 13px" : "500 11px"} "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = hovered ? "#ffffff" : "rgba(234,246,255,0.82)";
      ctx.fillText(n.label, n.x, n.y + r + 6);
    }
  }
}
