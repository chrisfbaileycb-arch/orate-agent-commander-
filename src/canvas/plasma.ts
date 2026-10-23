/** ---------- Pearlescent Plasma Sanctum (2D canvas emulation of the GLSL core) ----------
 * Layered simplex-style drift particles, thin-film iridescence bands, mouse spring,
 * and a bloom core. Runs on a shared canvas behind the entire app.
 */

interface Particle {
  x: number;
  y: number;
  z: number; // depth 0..1
  vx: number;
  vy: number;
}

export interface PlasmaHandle {
  destroy: () => void;
}

export function createPlasma(canvas: HTMLCanvasElement): PlasmaHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { destroy: () => undefined };

  let width = 0;
  let height = 0;
  let raf = 0;
  let time = 0;

  const particles: Particle[] = [];
  const PARTICLE_COUNT = 90;

  const mouse = { x: 0.5, y: 0.42, sx: 0.5, sy: 0.42 }; // spring toward target

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const onMouse = (ev: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (ev.clientX - rect.left) / Math.max(1, rect.width);
    mouse.y = (ev.clientY - rect.top) / Math.max(1, rect.height);
  };
  window.addEventListener("mousemove", onMouse);

  // Seed particles
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      z: Math.random(),
      vx: (Math.random() - 0.5) * 0.0006,
      vy: (Math.random() - 0.5) * 0.0006,
    });
  }

  // Iridescent color pick: thin-film approximation cycling cyan → pearl → gold
  const iridescence = (t: number, alpha: number): string => {
    const band = (Math.sin(t) + 1) / 2; // 0..1
    const r = Math.round(53 + band * (242 - 53));
    const g = Math.round(224 + band * (193 - 224));
    const b = Math.round(255 - band * (255 - 78));
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const draw = () => {
    time += 0.008;
    // Spring the mouse
    mouse.sx += (mouse.x - mouse.sx) * 0.045;
    mouse.sy += (mouse.y - mouse.sy) * 0.045;

    ctx.clearRect(0, 0, width, height);

    const cx = width * mouse.sx;
    const cy = height * mouse.sy;

    // Deep core bloom
    const coreR = Math.min(width, height) * (0.16 + Math.sin(time * 1.4) * 0.012);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    core.addColorStop(0, "rgba(234,246,255,0.22)");
    core.addColorStop(0.35, iridescence(time, 0.14));
    core.addColorStop(1, "rgba(53,224,255,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    // Halo ring
    ctx.strokeStyle = iridescence(time * 0.7, 0.10);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 1.35 + Math.sin(time * 2.1) * 6, 0, Math.PI * 2);
    ctx.stroke();

    // Particles
    for (const p of particles) {
      // Drift
      p.x += p.vx;
      p.y += p.vy;

      // Gentle noise-like wobble
      const wobble = Math.sin(time * (1 + p.z) + p.x * 8) * 0.0004;
      p.x += wobble;
      p.y += Math.cos(time * (1 + p.z) + p.y * 8) * 0.0003;

      // Mouse spring attraction (subtle)
      const dx = mouse.sx - p.x;
      const dy = mouse.sy - p.y;
      p.vx += dx * 0.000012 * (0.4 + p.z);
      p.vy += dy * 0.000012 * (0.4 + p.z);

      // Damping + wrap
      p.vx *= 0.9995;
      p.vy *= 0.9995;
      if (p.x < -0.05) p.x = 1.05;
      if (p.x > 1.05) p.x = -0.05;
      if (p.y < -0.05) p.y = 1.05;
      if (p.y > 1.05) p.y = -0.05;

      const px = p.x * width;
      const py = p.y * height;
      const pr = 0.6 + p.z * 2.1;
      const alpha = 0.05 + p.z * 0.16;
      ctx.fillStyle = iridescence(time * 1.3 + p.z * 2.2, alpha);
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Thin-film sheen band
    const bandY = (Math.sin(time * 0.5) * 0.5 + 0.5) * height;
    const band = ctx.createLinearGradient(0, bandY - 90, 0, bandY + 90);
    band.addColorStop(0, "rgba(53,224,255,0)");
    band.addColorStop(0.5, iridescence(time * 0.9, 0.05));
    band.addColorStop(1, "rgba(242,193,78,0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, bandY - 90, width, 180);

    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    },
  };
}
