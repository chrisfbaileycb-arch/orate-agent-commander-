/**
 * ============================================================================
 * THE ORATOR — 3D ROTATING NEURAL SPHERE (LIVE AIRLOCK LIFECYCLE BOUND)
 * ============================================================================
 *
 * Implements the 3D Rotating Neural Sphere with strict live Airlock lifecycle binding:
 * - 3,000 active particles orbiting in 7 logarithmic spiral arms
 * - Airlock Lifecycle Color & Shader States:
 *   * "idle"        -> IDLE (Cyan): No active lease or unallocated milestone
 *   * "running"     -> RUNNING (Blue pulse): Active valid lease issued to worker
 *   * "staged"      -> STAGED (Amber): Sentinel intercepted an action; pending operator gate
 *   * "verified"    -> VERIFIED (Green flash): Step mechanically verified by exit code 0
 *   * "quarantined" -> QUARANTINED (Glitch Red): Attempts exhausted, budget breached, or violation detected
 * - Accessibility: prefers-reduced-motion freezes orbital velocity into a calm ambient glow
 */

import React, { useEffect, useRef, useState } from "react";
import type { CortexPhase, CortexReasoningStep } from "../../lib/cortex/types";
import { globalAudioEngine } from "../../lib/audio-engine";

export type AirlockSphereState = "idle" | "running" | "staged" | "verified" | "quarantined";

interface Props {
  phase?: CortexPhase;
  consensusScore?: number;
  contextLoadPct?: number;
  tokPerSec?: number;
  reasoningSteps?: CortexReasoningStep[];
  onSelectStep?: (step: CortexReasoningStep) => void;
  isOratorSpeaking?: boolean;
  isUserSpeaking?: boolean;
  currentQuestionPrompt?: string;
  currentQuestionIndex?: number;
  totalQuestions?: number;
  isInquestComplete?: boolean;
  shockwaveTrigger?: number;
  cleanMode?: boolean;
  hideBorders?: boolean;
  /** Live Airlock lifecycle state controlling sphere shaders & pulse */
  airlockState?: AirlockSphereState;
}

interface ProjectedPin {
  label: string;
  sub: string;
  tag: string;
  screenX: number;
  screenY: number;
  visible: boolean;
  colorScheme: "cyan" | "blue" | "amber" | "magenta" | "emerald" | "red";
}

// ============================================================================
// Ultra-Fast 2D Perlin / Simplex Noise Generator (Deterministic & Zero Allocation)
// ============================================================================
const PERM = new Uint8Array(512);
const P_BASE = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69,
  142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219,
  203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
  74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230,
  220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209,
  76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198,
  173, 186, 3, 64, 52, 217, 220, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85,
  212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152,
  2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110,
  79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144,
  12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106,
  157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67,
  29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];
for (let i = 0; i < 256; i++) {
  PERM[i] = P_BASE[i];
  PERM[256 + i] = P_BASE[i];
}

function perlin2D(x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

  const A = PERM[X] + Y;
  const B = PERM[X + 1] + Y;

  const grad = (hash: number, gx: number, gy: number) => {
    const h = hash & 3;
    const uVal = h < 2 ? gx : gy;
    const vVal = h < 2 ? gy : gx;
    return ((h & 1) === 0 ? uVal : -uVal) + ((h & 2) === 0 ? vVal : -vVal);
  };

  const a1 = grad(PERM[A], xf, yf);
  const a2 = grad(PERM[B], xf - 1, yf);
  const b1 = grad(PERM[A + 1], xf, yf - 1);
  const b2 = grad(PERM[B + 1], xf - 1, yf - 1);

  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const x1 = lerp(a1, a2, u);
  const x2 = lerp(b1, b2, u);
  return (lerp(x1, x2, v) + 1) * 0.5;
}

interface ParticleData {
  angle: number;
  radius: number;
  armIndex: number;
  baseAngle: number;
  speed: number;
  size: number;
  alpha: number;
  noiseOffset: number;
  hue: number;
  sat: number;
  bri: number;
  hasGlow: boolean;
  x: number;
  y: number;
}

export default function CortexTorus3D({
  isOratorSpeaking = false,
  isUserSpeaking = false,
  currentQuestionPrompt = "Step-Gated Airlock Ready",
  currentQuestionIndex = 1,
  totalQuestions = 4,
  isInquestComplete = false,
  shockwaveTrigger = 0,
  hideBorders = false,
  airlockState,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [projectedPin, setProjectedPin] = useState<ProjectedPin | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  const reducedMotionRef = useRef<boolean>(prefersReducedMotion);
  const tiltRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  // Acoustic & Airlock dynamic parameters
  const shockwaveRadiusRef = useRef<number>(0);
  const shockwaveStrengthRef = useRef<number>(0);
  const greenFlashBoostRef = useRef<number>(0);
  const speechSmoothingRef = useRef<number>(0);
  const userSmoothingRef = useRef<number>(0);
  const airlockStateRef = useRef<AirlockSphereState | undefined>(airlockState);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const prev = airlockStateRef.current;
    airlockStateRef.current = airlockState;
    if (airlockState && airlockState !== prev && !reducedMotionRef.current) {
      shockwaveRadiusRef.current = 12;
      shockwaveStrengthRef.current = 1.0;
      if (airlockState === "verified") {
        greenFlashBoostRef.current = 1.0;
      }
    }
  }, [airlockState]);

  useEffect(() => {
    if (shockwaveTrigger > 0 && !reducedMotionRef.current) {
      shockwaveRadiusRef.current = 10;
      shockwaveStrengthRef.current = 1.0;
      if (airlockStateRef.current === "verified") {
        greenFlashBoostRef.current = 1.0;
      }
    }
  }, [shockwaveTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = container.clientWidth || 600);
    let height = (canvas.height = container.clientHeight || 500);

    const PARTICLE_COUNT = 3000;
    const SPIRAL_ARMS = 7;
    const BASE_ROTATION_SPEED = 0.0008;
    const BASE_PARTICLE_SIZE = 2;
    const TRAIL_FADE_ALPHA = 0.08;

    let time = 0;
    let particles: ParticleData[] = [];

    const initParticles = () => {
      particles = [];
      const maxRadius = Math.min(width, height) * 0.38;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const armIndex = Math.floor(Math.random() * SPIRAL_ARMS);
        const radius = 10 + Math.random() * (maxRadius - 10);
        const baseAngle = ((Math.PI * 2) / SPIRAL_ARMS) * armIndex;
        const speed = 0.02 - (radius / maxRadius) * 0.015;
        const size = BASE_PARTICLE_SIZE * (0.5 + Math.random());
        const alpha = 1.0 - (radius / maxRadius) * 0.7;
        const noiseOffset = Math.random() * 1000;

        const hueBase = (armIndex * 360) / SPIRAL_ARMS;
        const hueVar = (radius / maxRadius) * 60 - 30;
        const hue = (hueBase + hueVar + 360) % 360;

        particles.push({
          angle,
          radius,
          armIndex,
          baseAngle,
          speed,
          size,
          alpha,
          noiseOffset,
          hue,
          sat: 100,
          bri: 90,
          hasGlow: Math.random() < 0.1,
          x: width / 2,
          y: height / 2,
        });
      }
    };

    const handleResize = () => {
      if (!container || !canvas) return;
      width = canvas.width = container.clientWidth || 600;
      height = canvas.height = container.clientHeight || 500;
      initParticles();
    };

    window.addEventListener("resize", handleResize);
    initParticles();

    const handleMouseMove = (e: MouseEvent) => {
      if (reducedMotionRef.current) return;
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      tiltRef.current.targetX = nx * 30;
      tiltRef.current.targetY = ny * 20;
    };

    const handleMouseLeave = () => {
      tiltRef.current.targetX = 0;
      tiltRef.current.targetY = 0;
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    ctx.fillStyle = "#07070a";
    ctx.fillRect(0, 0, width, height);

    const render = () => {
      const isReduced = reducedMotionRef.current;
      time += isReduced ? 0 : 1;

      const effectiveState: AirlockSphereState =
        airlockStateRef.current ?? (isInquestComplete ? "verified" : "idle");

      const targetSpeech = isOratorSpeaking && !isReduced ? 1.0 : 0.0;
      speechSmoothingRef.current += (targetSpeech - speechSmoothingRef.current) * 0.12;

      const targetUser = isUserSpeaking && !isReduced ? 1.0 : 0.0;
      userSmoothingRef.current += (targetUser - userSmoothingRef.current) * 0.12;

      if (greenFlashBoostRef.current > 0.01 && !isReduced) {
        greenFlashBoostRef.current *= 0.96;
      } else {
        greenFlashBoostRef.current = 0;
      }

      const audioSample = globalAudioEngine.sampleSignal(isOratorSpeaking ? 0.6 : 0.1);
      const audioRms = isReduced ? 0 : audioSample.rms;

      tiltRef.current.x += (tiltRef.current.targetX - tiltRef.current.x) * 0.06;
      tiltRef.current.y += (tiltRef.current.targetY - tiltRef.current.y) * 0.06;

      ctx.fillStyle = isReduced ? "#07070a" : `rgba(7, 7, 10, ${TRAIL_FADE_ALPHA})`;
      ctx.fillRect(0, 0, width, height);

      // Glitch Red displacement when quarantined (and reduced motion is off)
      const glitchOffsetX =
        effectiveState === "quarantined" && !isReduced && time % 7 < 2
          ? (Math.sin(time * 1.9) * 9)
          : 0;

      const cx = width / 2 + tiltRef.current.x + glitchOffsetX;
      const cy = height / 2 + tiltRef.current.y;

      // Determine Airlock lifecycle kinematics & palette
      let stateTargetHue = 188; // IDLE (Cyan)
      let stateSpeedMult = 1.0;
      let statePulseAmp = 6;
      let statePulseFreq = 0.03;
      let shockwaveRgb = "53, 224, 255";

      if (effectiveState === "running") {
        // RUNNING (Blue pulse): Active valid lease issued to worker
        stateTargetHue = 216;
        stateSpeedMult = 2.35 + Math.sin(time * 0.22) * 0.45;
        statePulseAmp = 15;
        statePulseFreq = 0.24;
        shockwaveRgb = "59, 130, 246";
      } else if (effectiveState === "staged") {
        // STAGED (Amber): Sentinel intercepted an action; pending operator gate
        stateTargetHue = 38;
        stateSpeedMult = 1.15;
        statePulseAmp = 10;
        statePulseFreq = 0.11;
        shockwaveRgb = "245, 158, 11";
      } else if (effectiveState === "verified") {
        // VERIFIED (Green flash): Step mechanically verified by exit code 0
        stateTargetHue = 148;
        stateSpeedMult = 1.45 + greenFlashBoostRef.current * 1.2;
        statePulseAmp = 9 + greenFlashBoostRef.current * 14;
        statePulseFreq = 0.14;
        shockwaveRgb = "16, 185, 129";
      } else if (effectiveState === "quarantined") {
        // QUARANTINED (Glitch Red): Attempts exhausted, budget breached, or violation detected
        stateTargetHue = 358;
        stateSpeedMult = 0.65;
        statePulseAmp = 14;
        statePulseFreq = 0.28;
        shockwaveRgb = "239, 68, 68";
      }

      if (isReduced) {
        // Calm static ambient glow for prefers-reduced-motion
        const ambientRadius = Math.min(width, height) * 0.36;
        const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, ambientRadius);
        grad.addColorStop(0, `hsla(${stateTargetHue}, 90%, 78%, 0.48)`);
        grad.addColorStop(0.5, `hsla(${stateTargetHue}, 85%, 55%, 0.22)`);
        grad.addColorStop(1, `hsla(${stateTargetHue}, 80%, 40%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, ambientRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `hsla(${stateTargetHue}, 90%, 72%, 0.45)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, ambientRadius * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Shockwave propagation
        if (shockwaveStrengthRef.current > 0.01) {
          shockwaveRadiusRef.current += effectiveState === "verified" ? 9 : 7;
          shockwaveStrengthRef.current *= 0.94;

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, shockwaveRadiusRef.current, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${shockwaveRgb}, ${shockwaveStrengthRef.current * 0.75})`;
          ctx.lineWidth = effectiveState === "verified" ? 4 : 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, shockwaveRadiusRef.current * 0.82, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${shockwaveStrengthRef.current * 0.4})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        // Continuous fast blue pulse wave when active step is running
        if (effectiveState === "running") {
          const pulseRingRadius = ((time * 4.5) % (Math.min(width, height) * 0.38)) + 16;
          const pulseAlpha =
            Math.max(0, 1 - pulseRingRadius / (Math.min(width, height) * 0.38)) * 0.35;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, pulseRingRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(59, 130, 246, ${pulseAlpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        // Glitch Red horizontal scanline tear when quarantined
        if (effectiveState === "quarantined" && time % 5 === 0) {
          ctx.save();
          const bandY = cy + Math.sin(time * 1.3) * (height * 0.25);
          ctx.fillStyle = "rgba(239, 68, 68, 0.16)";
          ctx.fillRect(cx - width * 0.28, bandY, width * 0.56, 3);
          ctx.restore();
        }

        const speedMultiplier =
          stateSpeedMult + speechSmoothingRef.current * 1.1 - userSmoothingRef.current * 0.3;
        const rotationSpeed =
          (BASE_ROTATION_SPEED + speechSmoothingRef.current * 0.0018) * speedMultiplier;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          p.angle += p.speed * speedMultiplier + rotationSpeed;

          const noiseVal = perlin2D(p.noiseOffset + time * 0.02, p.armIndex * 10);
          const perturbation = (noiseVal - 0.5) * 12;

          const audioRadialBoost = speechSmoothingRef.current * (audioRms * 32);
          const absorptionInward = userSmoothingRef.current * (p.radius * 0.25);
          const breath = Math.sin(time * statePulseFreq + p.noiseOffset * 0.15) * statePulseAmp;

          const effectiveRadius = Math.max(
            4,
            p.radius + breath + perturbation + audioRadialBoost - absorptionInward
          );

          const spiralAngle = p.angle + p.baseAngle + effectiveRadius * 0.009;
          const glitchParticleX =
            effectiveState === "quarantined" && i % 23 === 0 && time % 4 === 0
              ? (noiseVal - 0.5) * 26
              : 0;

          p.x = cx + Math.cos(spiralAngle) * effectiveRadius + glitchParticleX;
          p.y = cy + Math.sin(spiralAngle) * effectiveRadius;

          const armSpread = (p.armIndex - 3) * 6;
          let particleHue = (stateTargetHue + armSpread + 360) % 360;
          let particleSat = 95;
          let particleBri =
            effectiveState === "running"
              ? 72 + Math.sin(time * 0.25 + p.angle * 2) * 26
              : effectiveState === "verified"
              ? Math.min(
                  100,
                  80 + greenFlashBoostRef.current * 20 + Math.sin(time * 0.1 + p.angle) * 15
                )
              : 64 + Math.sin(time * 0.06 + p.angle) * 28;

          if (speechSmoothingRef.current > 0.1) {
            particleBri = Math.min(100, particleBri + speechSmoothingRef.current * 25);
          }

          if (userSmoothingRef.current > 0.1) {
            particleHue = (particleHue * 0.5 + 310 * 0.5 + 360) % 360;
            particleBri = Math.min(100, particleBri + 18);
          }

          if (shockwaveStrengthRef.current > 0.05) {
            const distToWave = Math.abs(effectiveRadius - shockwaveRadiusRef.current);
            if (distToWave < 35) {
              particleBri = 100;
              particleSat = effectiveState === "verified" ? 85 : 45;
            }
          }

          ctx.fillStyle = `hsla(${particleHue}, ${particleSat}%, ${particleBri}%, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          if (p.hasGlow) {
            ctx.fillStyle = `hsla(${particleHue}, ${Math.max(20, particleSat - 25)}%, 90%, ${
              p.alpha * 0.28
            })`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Central Glowing Concentric Energy Core
        const corePulseFreq = effectiveState === "running" ? 0.26 : 0.06;
        const corePulseAmp = effectiveState === "running" ? 24 : 16;
        const corePulse =
          Math.sin(time * corePulseFreq) * corePulseAmp +
          speechSmoothingRef.current * 16 +
          greenFlashBoostRef.current * 22;
        const baseCenterSize = Math.max(30, 52 + corePulse);

        const coreHue = stateTargetHue;
        for (let k = 0; k < 3; k++) {
          const ringSize = baseCenterSize * (2.8 - k * 0.6);
          const ringAlpha =
            (0.14 - k * 0.038) *
            (1.0 + speechSmoothingRef.current * 0.5 + greenFlashBoostRef.current * 0.6);

          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringSize);
          grad.addColorStop(0, `hsla(${coreHue}, 100%, 82%, ${ringAlpha})`);
          grad.addColorStop(0.6, `hsla(${coreHue}, 100%, 60%, ${ringAlpha * 0.5})`);
          grad.addColorStop(1, `hsla(${coreHue}, 100%, 50%, 0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, ringSize, 0, Math.PI * 2);
          ctx.fill();
        }

        // Inner Luminous Core
        ctx.fillStyle = `hsla(${coreHue}, 85%, 95%, 0.9)`;
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          8 + Math.sin(time * (effectiveState === "running" ? 0.24 : 0.08)) * 3.5,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      const pinVisible = Boolean(currentQuestionPrompt && currentQuestionPrompt.length > 0);
      const stateTagMap: Record<AirlockSphereState, string> = {
        idle: "IDLE · CYAN READY",
        running: "RUNNING · ACTIVE LEASE",
        staged: "STAGED · PENDING GATE",
        verified: "VERIFIED · EXIT 0",
        quarantined: "QUARANTINED · GLITCH RED",
      };
      const stateColorMap: Record<AirlockSphereState, ProjectedPin["colorScheme"]> = {
        idle: "cyan",
        running: "blue",
        staged: "amber",
        verified: "emerald",
        quarantined: "red",
      };

      setProjectedPin({
        label: `STEP ${String(currentQuestionIndex).padStart(2, "0")}/${String(
          totalQuestions
        ).padStart(2, "0")}`,
        sub: currentQuestionPrompt,
        tag: stateTagMap[effectiveState],
        screenX: cx,
        screenY: cy - 14,
        visible: pinVisible,
        colorScheme: stateColorMap[effectiveState],
      });

      if (!isReduced) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [
    isOratorSpeaking,
    isUserSpeaking,
    isInquestComplete,
    currentQuestionPrompt,
    currentQuestionIndex,
    totalQuestions,
    prefersReducedMotion,
    airlockState,
  ]);

  const effectiveState: AirlockSphereState =
    airlockState ?? (isInquestComplete ? "verified" : "idle");

  return (
    <div
      className={`relative h-full w-full select-none overflow-hidden ${
        hideBorders
          ? "bg-transparent"
          : "rounded-2xl border border-seam/90 bg-[#07070a] shadow-2xl"
      }`}
    >
      {/* Container holding the 3D Particle Vortex Orb Canvas */}
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing">
        <canvas ref={canvasRef} className="w-full h-full block orb-canvas-motion" />
      </div>

      {/* Accessibility: prefers-reduced-motion calm ambient glow fallback */}
      <div
        aria-hidden="true"
        className={`orb-ambient-fallback absolute inset-0 ${
          effectiveState === "quarantined"
            ? "bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.28)_0%,transparent_65%)]"
            : effectiveState === "staged"
            ? "bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.28)_0%,transparent_65%)]"
            : effectiveState === "verified"
            ? "bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.28)_0%,transparent_65%)]"
            : effectiveState === "running"
            ? "bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.28)_0%,transparent_65%)]"
            : "bg-[radial-gradient(circle_at_center,rgba(53,224,255,0.25)_0%,transparent_65%)]"
        }`}
      />

      {/* Top Status HUD Banner (Minimum 12px high-contrast typography) */}
      {projectedPin && projectedPin.visible && (
        <div className="pointer-events-none absolute top-2 inset-x-0 mx-auto z-30 flex justify-center px-3">
          <div
            className={`flex max-w-2xl items-center justify-between gap-3 rounded-xl border px-3.5 py-1.5 backdrop-blur-xl shadow-2xl transition-all duration-300 ${
              projectedPin.colorScheme === "amber"
                ? "border-amber-400/90 bg-amber-950/90 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                : projectedPin.colorScheme === "red"
                ? "border-red-500/90 bg-red-950/90 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                : projectedPin.colorScheme === "emerald"
                ? "border-emerald-400/90 bg-emerald-950/90 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                : projectedPin.colorScheme === "blue"
                ? "border-blue-400/90 bg-blue-950/90 text-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                : "border-cyan-400/80 bg-cyan-950/90 text-cyan-100 shadow-[0_0_16px_rgba(53,224,255,0.3)]"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="flex items-center gap-1.5 text-xs font-mono-hud font-bold tracking-wider uppercase shrink-0">
                {projectedPin.tag}
              </span>
              <span aria-hidden="true" className="opacity-70">
                ·
              </span>
              <span className="text-xs font-mono text-white truncate">
                {projectedPin.sub}
              </span>
            </div>

            <div className="shrink-0 font-bold text-xs text-white tracking-wider font-mono-hud bg-black/60 border border-white/20 px-2 py-0.5 rounded tabular-nums">
              {projectedPin.label}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
