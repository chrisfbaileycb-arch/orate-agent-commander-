/**
 * ORB OF THE ORATOR — a WebGL iridescent sphere inspired by the reference
 * (Delphi Labs "Oracle"): a large, centered, luminous pearl-orb with swirling
 * cyan/pearl/gold plasma bands, fresnel rim glow, and a breathing bloom.
 *
 * Interaction is the special event:
 *  - IDLE     : slow majestic rotation, gentle breath
 *  - AWAKE    : pointer proximity lights the surface; the plasma rises
 *  - DIALOGUE : forge phases pump energy through `pulse()`; the user can
 *               disturb the plasma with the pointer and the orb answers
 */

export type OrbState = "idle" | "awake" | "dialogue";

export interface OrbSignalInput {
  low?: number;
  mid?: number;
  high?: number;
  amplitude?: number;
  energy?: number;
  isSpeechActive?: boolean;
}

export interface OrbHandle {
  destroy: () => void;
  /** Push an external energy impulse (0..1) — driven by forge phases or strikes. */
  pulse: (amount: number) => void;
  /** Update live audio metrics from the audio reactivity engine */
  setAudioSignal: (signal: OrbSignalInput) => void;
  /** Trigger a restrained ripple upon receiving an interim word */
  triggerWordRipple: () => void;
}

const VERT = `
attribute vec3 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
varying vec3 vNormal;
varying vec3 vPos;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vPos = world.xyz;
  vNormal = normalize(mat3(uModel) * aPos);
  gl_Position = uProj * uView * world;
}
`;

const FRAG = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vPos;

uniform float uTime;
uniform float uEnergy;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uWordRipple;
uniform vec3  uPointer;
uniform float uPointerOn;
uniform vec3  uCam;

float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i);
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(uCam - vPos);

  // Domain-warped fbm swirl across the sphere surface - mid frequencies modulate surface turbulence
  vec3 p = n * (2.4 + uMid * 0.4);
  float t = uTime * (0.10 + uEnergy * 0.35 + uLow * 0.20);
  vec3 warp = vec3(
    fbm(p + vec3(0.0, t, 0.0)),
    fbm(p + vec3(5.2, t * 1.3, 1.3)),
    fbm(p + vec3(1.7, 9.2, t * 0.8))
  );
  float swirl = fbm(p * 1.6 + warp * 1.8 + vec3(0.0, 0.0, t * 2.0));

  // Iridescent banding: deep violet -> cyan -> pearl -> gold
  float band = swirl * 1.35 + uTime * 0.04;
  vec3 deep  = vec3(0.13, 0.09, 0.27);
  vec3 cyan  = vec3(0.21, 0.88, 1.00);
  vec3 pearl = vec3(0.92, 0.95, 1.00);
  vec3 gold  = vec3(0.95, 0.76, 0.31);

  vec3 col = mix(deep, cyan, smoothstep(0.15, 0.55, band));
  col = mix(col, pearl, smoothstep(0.55, 0.80, band));
  col = mix(col, gold, smoothstep(0.80, 0.95, band) * (0.30 + uEnergy * 0.55 + uMid * 0.35));

  // Word ripple shockwave ring traveling across the orb surface
  if (uWordRipple > 0.001) {
    float waveDist = length(vPos.xy);
    float ring = sin(waveDist * 16.0 - (1.0 - uWordRipple) * 12.0);
    float wave = smoothstep(0.7, 1.0, ring) * uWordRipple;
    col += wave * vec3(0.4, 0.95, 1.0) * 0.75;
  }

  // Pointer touch: a soft luminous ripple where the user disturbs the plasma
  if (uPointerOn > 0.001) {
    float d = max(dot(n, normalize(uPointer)), 0.0);
    float touch = pow(d, 24.0) * uPointerOn;
    col += touch * vec3(0.85, 0.95, 1.0) * 0.9;
  }

  // Fresnel rim — pearlescent edge glow, high frequencies intensify edge shimmer
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 2.6 - uHigh * 0.6);
  col += fres * mix(vec3(0.25, 0.65, 0.90), vec3(0.95, 0.80, 0.50), (uEnergy + uHigh) * 0.5) * (0.9 + uHigh * 0.4);

  // Soft top-light for form
  float diff = max(dot(n, normalize(vec3(0.3, 0.8, 0.5))), 0.0);
  col *= 0.55 + 0.45 * diff;

  // Energy breathing: low frequencies add deep body glow
  col *= 0.85 + 0.30 * uEnergy + uLow * 0.25;

  // Deep-space tone mapping
  col = col / (col + vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}
`;

function sphereGeometry(lat: number, lon: number): { verts: Float32Array; indices: Uint16Array } {
  const verts: number[] = [];
  for (let la = 0; la <= lat; la++) {
    const theta = (la / lat) * Math.PI;
    for (let lo = 0; lo <= lon; lo++) {
      const phi = (lo / lon) * Math.PI * 2;
      verts.push(
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi),
      );
    }
  }
  const indices: number[] = [];
  for (let la = 0; la < lat; la++) {
    for (let lo = 0; lo < lon; lo++) {
      const a = la * (lon + 1) + lo;
      const b = a + 1;
      const c = a + lon + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { verts: new Float32Array(verts), indices: new Uint16Array(indices) };
}

/** 4x4 column-major helpers (tiny, only what the orb needs). */
function perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0,
  ]);
}

/** model = scale * tiltX(a) * rotY(b) */
function orbModel(scale: number, tilt: number, spinY: number): Float32Array {
  const ca = Math.cos(tilt), sa = Math.sin(tilt);
  const cb = Math.cos(spinY), sb = Math.sin(spinY);
  // rotY * v then tiltX * that
  // rotY: [cb,0,-sb; 0,1,0; sb,0,cb]
  // tiltX: [1,0,0; 0,ca,-sa; 0,sa,ca]
  // R = tiltX * rotY (column-major math below)
  const r00 = cb,      r01 = 0,   r02 = -sb;
  const r10 = sa * sb, r11 = ca,  r12 = sa * cb;
  const r20 = ca * sb, r21 = -sa, r22 = ca * cb;
  return new Float32Array([
    r00 * scale, r10 * scale, r20 * scale, 0,
    r01 * scale, r11 * scale, r21 * scale, 0,
    r02 * scale, r12 * scale, r22 * scale, 0,
    0, 0, 0, 1,
  ]);
}

export function createOrb(canvas: HTMLCanvasElement): OrbHandle {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
  const dead: OrbHandle = {
    destroy: () => undefined,
    pulse: () => undefined,
    setAudioSignal: () => undefined,
    triggerWordRipple: () => undefined,
  };
  if (!gl) return dead;

  const compile = (type: number, src: string): WebGLShader | null => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("[orb] shader:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return dead;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("[orb] link:", gl.getProgramInfoLog(prog));
    return dead;
  }
  gl.useProgram(prog);

  const { verts, indices } = sphereGeometry(48, 72);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);

  const U = {
    proj: gl.getUniformLocation(prog, "uProj"),
    view: gl.getUniformLocation(prog, "uView"),
    model: gl.getUniformLocation(prog, "uModel"),
    time: gl.getUniformLocation(prog, "uTime"),
    energy: gl.getUniformLocation(prog, "uEnergy"),
    low: gl.getUniformLocation(prog, "uLow"),
    mid: gl.getUniformLocation(prog, "uMid"),
    high: gl.getUniformLocation(prog, "uHigh"),
    wordRipple: gl.getUniformLocation(prog, "uWordRipple"),
    pointer: gl.getUniformLocation(prog, "uPointer"),
    pointerOn: gl.getUniformLocation(prog, "uPointerOn"),
    cam: gl.getUniformLocation(prog, "uCam"),
  };

  const camZ = 3.0;
  const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -camZ, 1]);

  let width = 1;
  let height = 1;
  let raf = 0;
  let time = 0;
  let energy = 0;
  let energyTarget = 0;
  let pulseEnergy = 0;
  let wordRipple = 0;
  let audioLow = 0;
  let audioMid = 0;
  let audioHigh = 0;
  let audioLowTarget = 0;
  let audioMidTarget = 0;
  let audioHighTarget = 0;
  let aspect = 1;
  let proj = perspective(0.9, 1, 0.1, 100);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * devicePixelRatio);
    canvas.height = Math.round(height * devicePixelRatio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = width / height;
    proj = perspective(0.9, aspect, 0.1, 100);
  };
  resize();
  window.addEventListener("resize", resize);

  // Pointer interaction: ray direction in view space, un-spun for a stable touch point.
  const pointerDir = [0, 0, 1];
  const pointer = { on: 0, targetOn: 0, x: 0, y: 0 };

  const onPointer = (ev: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    pointer.targetOn = 1;
  };
  const onLeave = () => {
    pointer.targetOn = 0;
  };
  canvas.addEventListener("pointermove", onPointer);
  canvas.addEventListener("pointerdown", onPointer);
  canvas.addEventListener("pointerleave", onLeave);

  const draw = () => {
    time += 0.016;
    energy += (energyTarget - energy) * 0.04;
    pulseEnergy *= 0.94;
    if (wordRipple > 0.001) wordRipple *= 0.92;
    else wordRipple = 0;

    // Smooth audio reactivity targets
    audioLow += (audioLowTarget - audioLow) * 0.15;
    audioMid += (audioMidTarget - audioMid) * 0.22;
    audioHigh += (audioHighTarget - audioHigh) * 0.25;

    pointer.on += (pointer.targetOn - pointer.on) * 0.08;

    // Spin the touch direction opposite the model rotation for a stable hotspot.
    const spinY = time * (0.18 + audioLow * 0.08);
    const cb = Math.cos(-spinY);
    const sb = Math.sin(-spinY);
    const vx = pointer.x * 0.9;
    const vy = pointer.y * 0.9;
    const vz = -1;
    const len = Math.hypot(vx, vy, vz) || 1;
    pointerDir[0] = (vx / len) * cb - (vz / len) * sb;
    pointerDir[1] = vy / len;
    pointerDir[2] = (vx / len) * sb + (vz / len) * cb;

    const breath = 1 + Math.sin(time * 0.9) * 0.012 + energy * 0.05 + pulseEnergy * 0.12 + audioLow * 0.08;
    const model = orbModel(breath, 0.35, spinY);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.uniformMatrix4fv(U.proj, false, proj);
    gl.uniformMatrix4fv(U.view, false, view);
    gl.uniformMatrix4fv(U.model, false, model);
    gl.uniform1f(U.time, time);
    gl.uniform1f(U.energy, Math.min(1, energy + pulseEnergy));
    gl.uniform1f(U.low, audioLow);
    gl.uniform1f(U.mid, audioMid);
    gl.uniform1f(U.high, audioHigh);
    gl.uniform1f(U.wordRipple, wordRipple);
    gl.uniform3f(U.pointer, pointerDir[0], pointerDir[1], pointerDir[2]);
    gl.uniform1f(U.pointerOn, pointer.on);
    gl.uniform3f(U.cam, 0, 0, camZ);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ibo);
      gl.deleteProgram(prog);
    },
    pulse: (amount: number) => {
      pulseEnergy = Math.min(1, pulseEnergy + Math.max(0, amount));
    },
    setAudioSignal: (sig: OrbSignalInput) => {
      if (sig.low !== undefined) audioLowTarget = Math.min(1, Math.max(0, sig.low));
      if (sig.mid !== undefined) audioMidTarget = Math.min(1, Math.max(0, sig.mid));
      if (sig.high !== undefined) audioHighTarget = Math.min(1, Math.max(0, sig.high));
      if (sig.energy !== undefined) energyTarget = Math.min(1, Math.max(0, sig.energy));
    },
    triggerWordRipple: () => {
      wordRipple = 1.0;
    },
  };
}
