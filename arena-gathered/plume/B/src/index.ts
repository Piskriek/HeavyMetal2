import * as THREE from 'three';

/* ------------------------------------------------------------------------------------------------
 * Pixel plumes: every pixel's motion is a pure function of (emitter, pixel index, time, environment).
 * The same formulas live twice: `pixelAt` (CPU twin, used by tests and the game) and `pixelCore`
 * (GLSL, in the vertex shaders). The constants below are shared: the GLSL declarations are generated
 * from this very object, so the names and values cannot drift apart.
 * ---------------------------------------------------------------------------------------------- */

export type PlumeMode = 'cubes' | 'splats' | 'dither' | 'off';
export const PLUME_MODES: readonly PlumeMode[] = ['cubes', 'splats', 'dither', 'off'];
export const METRIC_COLOURS: {
  readonly pxd: string;
  readonly vtx: string;
  readonly lx: string;
  readonly aq: string;
  readonly all: string;
} = { pxd: '#ff3d8a', vtx: '#7cff4d', lx: '#ffc13d', aq: '#3dc8ff', all: '#b46bff' };

export interface EmitterSpec {
  at: [number, number, number];
  colour: string;
  count?: number;
  height?: number;
  spread?: number;
  life?: number;
  size?: number;
  startAt?: number;
}
export interface PlumeEnv {
  wind: [number, number];
  windSpeed: number;
  windResponse: number;
  waveCentre: [number, number, number];
  waveR: number;
}
export interface PixelState {
  p: [number, number, number];
  size: number;
  life: number;
  toWave: boolean;
}
export interface Plume {
  readonly object: THREE.Object3D;
  readonly mode: PlumeMode;
  setMode(mode: PlumeMode): void;
  setDensity(d: number): void;
  setWind(dirX: number, dirZ: number, speed: number): void;
  setWindResponse(k: number): void;
  setWave(centre: [number, number, number], radius: number): void;
  setViewport(heightPx: number): void;
  add(e: EmitterSpec): number;
  remove(id: number): void;
  update(t: number): void;
  stats(): { mode: PlumeMode; emitters: number; pixels: number; drawCalls: number; triangles: number };
  dispose(): void;
}

/** Most emitters one plume object holds (their parameters live in a uniform array, 3 vec4 each). */
export const MAX_EMITTERS = 64;

/* ---- shared constants (JS and GLSL) ---- */
const K = {
  PHI: 0.6180339887498949, // golden-ratio phase step of the pixel index
  TAU: 6.283185307179586,
  RISE_POW: 2, // rise = 1 - (1-u)^RISE_POW : ease-out
  HEIGHT_MIN: 0.92, // per-cycle height variation
  HEIGHT_VAR: 0.16,
  RAD_MIN: 0.8, // radius at the top = spread/2 * (RAD_MIN + RAD_VAR*r)
  RAD_VAR: 0.4,
  SWIRL_MIN: 0.5, // turns of spiral over one life
  SWIRL_VAR: 0.6,
  WIND_DRIFT: 0.1, // downwind drift = speed * response * WIND_DRIFT * age^2
  FADE_IN: 1.5, // seconds for a starting machine to fade in
  SIZE_NEW: 0.45, // a new pixel is this fraction of its size...
  GROW_END: 0.2, // ...and reaches full size at this life fraction
  SHRINK_START: 0.65, // shrinks to nothing between here and the end of life
  SIZE_MIN: 0.7,
  SIZE_VAR: 0.6,
  WAVE_DONE: 1e6, // waveR above this: the wave is finished, no racers
  WAVE_RAMP: 3, // metres of wave beyond the vent over which racers take over
  WAVE_FAN: 1.2, // angular scatter (rad) of racers from a vent away from the wave centre
  WAVE_FAN_NEAR: 0.5,
  WAVE_FAN_FAR: 6,
  RACER_EVERY: 4, // every fourth pixel races
  ARC_BASE: 0.6, // racer arc height = min(ARC_BASE + ARC_K*distance, ARC_MAX)
  ARC_K: 0.05,
  ARC_MAX: 3.5,
  DISSOLVE_START: 0.6, // racers dissolve (dithered) from here to the end of their flight
  BOOST: 0.35, // new pixels are this much brighter...
  BOOST_END: 0.35, // ...fading out by this life fraction
  SHADE_MIN: 0.7, // cube faces are never darker than this
  SHADE_FLAT: 0.85, // flat shade of point sprites
  TUMBLE: 2.2, // rad/s of cube tumbling
  SPLAT_SCALE: 1.6, // splat quad edge relative to the pixel edge
  SPLAT_MIN_PX: 2.5, // a splat quad is never smaller than this many target pixels
  MAX_POINT_PX: 64,
} as const;

const {
  PHI, TAU, RISE_POW, HEIGHT_MIN, HEIGHT_VAR, RAD_MIN, RAD_VAR, SWIRL_MIN, SWIRL_VAR, WIND_DRIFT, FADE_IN,
  SIZE_NEW, GROW_END, SHRINK_START, SIZE_MIN, SIZE_VAR, WAVE_DONE, WAVE_RAMP, WAVE_FAN, WAVE_FAN_NEAR,
  WAVE_FAN_FAR, RACER_EVERY, ARC_BASE, ARC_K, ARC_MAX,
} = K;

/* ---- hashing (identical in JS and GLSL; 32-bit integer math, exact) ---- */
const GOLD32 = 0x9e3779b1;

function hash32(v: number): number {
  let x = v >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x;
}
const rnd01 = (h: number): number => (h & 0xffffff) / 16777216;

/** Six uniform randoms for one pixel in one life cycle `k`. */
function randoms(seed: number, k: number): [number, number, number, number, number, number] {
  const h1 = hash32(seed + Math.imul(k, GOLD32));
  const h2 = hash32(h1 ^ 0x68e31da4);
  const h3 = hash32(h2 + 0x2545f491);
  const h4 = hash32(h3 ^ 0x9e3779b9);
  const h5 = hash32(h4 + 0x85ebca6b);
  const h6 = hash32(h5 ^ 0xc2b2ae35);
  return [rnd01(h1), rnd01(h2), rnd01(h3), rnd01(h4), rnd01(h5), rnd01(h6)];
}

function emitterSeed(at: readonly [number, number, number]): number {
  let h = 0x811c9dc5;
  for (const v of at) h = hash32(h ^ (Math.round(v * 64) | 0));
  return h;
}
/** The 24-bit per-pixel seed stored in the instance attribute (exact in a float32). */
function pixelSeed(emitter: number, i: number): number {
  return hash32(Math.imul(i, GOLD32) + emitter) & 0xffffff;
}

const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fract = (x: number): number => x - Math.floor(x);
const mix = (a: number, b: number, t: number): number => a * (1 - t) + b * t;

/* ------------------------------------------------------------------------------------------------
 * CPU twin of the vertex shader. Keep it side by side with `pixelCore` below.
 * ---------------------------------------------------------------------------------------------- */
export function pixelAt(e: Required<EmitterSpec>, i: number, t: number, env: PlumeEnv): PixelState {
  const seed = pixelSeed(emitterSeed(e.at), i);
  const ph = fract(i * PHI);
  const x = t / e.life + ph;
  const k = Math.floor(x);
  const u = x - k;
  const [r1, r2, r3, r4, r5, r6] = randoms(seed, Math.max(k, 0));

  // the pour
  const rise = 1 - Math.pow(1 - u, RISE_POW);
  const py = e.at[1] + e.height * rise * (HEIGHT_MIN + HEIGHT_VAR * r5);
  const rad = 0.5 * e.spread * (RAD_MIN + RAD_VAR * r1) * u;
  const th = TAU * r2 + TAU * (SWIRL_MIN + SWIRL_VAR * r3) * u;
  const age = u * e.life;
  const drift = env.windSpeed * env.windResponse * WIND_DRIFT * age * age;
  const plumeX = e.at[0] + rad * Math.cos(th) + env.wind[0] * drift;
  const plumeZ = e.at[2] + rad * Math.sin(th) + env.wind[1] * drift;

  // the racers of a resolution wave
  let wk = 0;
  let racerX = plumeX;
  let racerY = py;
  let racerZ = plumeZ;
  if (i % RACER_EVERY === 0 && env.waveR >= 0 && env.waveR < WAVE_DONE) {
    const wx = e.at[0] - env.waveCentre[0];
    const wz = e.at[2] - env.waveCentre[2];
    const dist = Math.hypot(wx, wz);
    wk = smooth(0, WAVE_RAMP, env.waveR - dist);
    if (wk > 0) {
      const bx = dist > 1e-4 ? wx / dist : 1;
      const bz = dist > 1e-4 ? wz / dist : 0;
      const fan = mix(TAU, WAVE_FAN, smooth(WAVE_FAN_NEAR, WAVE_FAN_FAR, dist));
      const a = (r2 - 0.5) * fan;
      const dx = bx * Math.cos(a) - bz * Math.sin(a);
      const dz = bx * Math.sin(a) + bz * Math.cos(a);
      const b = wx * dx + wz * dz;
      const s = Math.max(-b + Math.sqrt(Math.max(b * b - (dist * dist - env.waveR * env.waveR), 0)), 0);
      const run = 1 - (1 - u) * (1 - u);
      const arc = Math.min(ARC_BASE + ARC_K * s, ARC_MAX) * (0.7 + 0.6 * r6);
      racerX = e.at[0] + dx * s * run;
      racerY = e.at[1] + arc * 4 * u * (1 - u);
      racerZ = e.at[2] + dz * s * run;
    }
  }

  const fade = clamp((t - e.startAt) / FADE_IN, 0, 1);
  const grow = SIZE_NEW + (1 - SIZE_NEW) * smooth(0, GROW_END, u);
  const shrink = 1 - smooth(SHRINK_START, 1, u);
  const size = e.size * (SIZE_MIN + SIZE_VAR * r4) * grow * fade * mix(shrink, 1, wk);

  return {
    p: [mix(plumeX, racerX, wk), mix(py, racerY, wk), mix(plumeZ, racerZ, wk)],
    size,
    life: u,
    toWave: wk > 0,
  };
}

/* ------------------------------------------------------------------------------------------------
 * GLSL
 * ---------------------------------------------------------------------------------------------- */
const glslConstants = (): string =>
  Object.entries(K)
    .map(([name, v]) => `const float ${name} = ${Number.isInteger(v) ? v.toFixed(1) : String(v)};`)
    .join('\n');

const VERT_CORE = /* glsl */ `
uniform float uTime;
uniform vec2 uWind;
uniform float uWindSpeed;
uniform float uWindResponse;
uniform vec3 uWaveC;
uniform float uWaveR;
uniform float uViewportH;
uniform vec4 uEm[${MAX_EMITTERS * 3}];
${glslConstants()}
const uint GOLD32 = 0x9e3779b1u;

uint hash32(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
float rnd01(uint h) { return float(h & 0xFFFFFFu) / 16777216.0; }

struct Px { vec3 pos; vec3 col; float size; float u; float cover; float age; vec3 ra; vec3 rb; };

// GLSL twin of pixelAt() -- same formulas, same constant names.
Px pixelCore(vec3 pix) {
  int s = int(pix.x + 0.5) * 3;
  vec4 A = uEm[s];
  vec4 B = uEm[s + 1];
  vec4 C = uEm[s + 2];
  vec3 at = A.xyz;
  float height = A.w;
  float spread = B.w;
  float life = C.x;
  float size0 = C.y;
  float startAt = C.z;

  float i = pix.y;
  uint seed = uint(pix.z);
  float ph = fract(i * PHI);
  float x = uTime / life + ph;
  float k = floor(x);
  float u = x - k;
  uint h1 = hash32(seed + uint(max(k, 0.0)) * GOLD32);
  uint h2 = hash32(h1 ^ 0x68e31da4u);
  uint h3 = hash32(h2 + 0x2545f491u);
  uint h4 = hash32(h3 ^ 0x9e3779b9u);
  uint h5 = hash32(h4 + 0x85ebca6bu);
  uint h6 = hash32(h5 ^ 0xc2b2ae35u);
  float r1 = rnd01(h1); float r2 = rnd01(h2); float r3 = rnd01(h3);
  float r4 = rnd01(h4); float r5 = rnd01(h5); float r6 = rnd01(h6);

  // the pour
  float rise = 1.0 - pow(1.0 - u, RISE_POW);
  float py = at.y + height * rise * (HEIGHT_MIN + HEIGHT_VAR * r5);
  float rad = 0.5 * spread * (RAD_MIN + RAD_VAR * r1) * u;
  float th = TAU * r2 + TAU * (SWIRL_MIN + SWIRL_VAR * r3) * u;
  float age = u * life;
  float drift = uWindSpeed * uWindResponse * WIND_DRIFT * age * age;
  vec3 plume = vec3(at.x + rad * cos(th) + uWind.x * drift, py, at.z + rad * sin(th) + uWind.y * drift);

  // the racers of a resolution wave
  float wk = 0.0;
  vec3 racer = plume;
  if (mod(i, RACER_EVERY) < 0.5 && uWaveR >= 0.0 && uWaveR < WAVE_DONE) {
    vec2 w = at.xz - uWaveC.xz;
    float dist = length(w);
    wk = smoothstep(0.0, WAVE_RAMP, uWaveR - dist);
    if (wk > 0.0) {
      vec2 base = dist > 1e-4 ? w / dist : vec2(1.0, 0.0);
      float fan = mix(TAU, WAVE_FAN, smoothstep(WAVE_FAN_NEAR, WAVE_FAN_FAR, dist));
      float a = (r2 - 0.5) * fan;
      vec2 d = vec2(base.x * cos(a) - base.y * sin(a), base.x * sin(a) + base.y * cos(a));
      float b = dot(w, d);
      float s2 = max(-b + sqrt(max(b * b - (dist * dist - uWaveR * uWaveR), 0.0)), 0.0);
      float run = 1.0 - (1.0 - u) * (1.0 - u);
      float arc = min(ARC_BASE + ARC_K * s2, ARC_MAX) * (0.7 + 0.6 * r6);
      racer = vec3(at.x + d.x * s2 * run, at.y + arc * 4.0 * u * (1.0 - u), at.z + d.y * s2 * run);
    }
  }

  float fade = clamp((uTime - startAt) / FADE_IN, 0.0, 1.0);
  float grow = SIZE_NEW + (1.0 - SIZE_NEW) * smoothstep(0.0, GROW_END, u);
  float shrink = 1.0 - smoothstep(SHRINK_START, 1.0, u);

  Px o;
  o.pos = mix(plume, racer, wk);
  o.size = size0 * (SIZE_MIN + SIZE_VAR * r4) * grow * fade * mix(shrink, 1.0, wk);
  o.u = u;
  o.age = age;
  o.cover = mix(1.0, 1.0 - smoothstep(DISSOLVE_START, 1.0, u), wk);
  o.col = B.rgb * (1.0 + BOOST * (1.0 - smoothstep(0.0, BOOST_END, u)));
  o.ra = vec3(r1, r2, r3);
  o.rb = vec3(r4, r5, r6);
  return o;
}
`;

const FRAG_COMMON = /* glsl */ `
uniform float uMark;
// 4x4 Bayer threshold in (0,1)
float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(floor(p), 4.0));
  int a = q.x ^ q.y;
  int b = ((a & 1) << 3) | ((q.y & 1) << 2) | (a & 2) | ((q.y >> 1) & 1);
  return (float(b) + 0.5) / 16.0;
}
`;

const CUBES_VERT = /* glsl */ `
${VERT_CORE}
attribute vec3 aPix;
varying vec3 vColor;
varying float vCover;

vec3 rotAxis(vec3 v, vec3 a, float ang) {
  float c = cos(ang); float s = sin(ang);
  return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c);
}

void main() {
  Px p = pixelCore(aPix);
  vec3 axis = normalize(vec3(p.ra.y, p.rb.x, p.rb.z) - 0.5 + vec3(0.001, 0.002, 0.003));
  float ang = TAU * p.ra.x + p.age * TUMBLE * (0.6 + 0.8 * p.ra.z);
  vec3 local = rotAxis(position, axis, ang) * p.size;
  vec3 n = normalize(mat3(modelMatrix) * rotAxis(normal, axis, ang));
  float lit = dot(n, normalize(vec3(0.45, 0.8, 0.35)));
  float shade = SHADE_MIN + (1.0 - SHADE_MIN) * (0.5 + 0.5 * lit);
  vColor = p.col * shade;
  vCover = p.cover;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p.pos + local, 1.0);
}
`;

const CUBES_FRAG = /* glsl */ `
${FRAG_COMMON}
varying vec3 vColor;
varying float vCover;
void main() {
  if (vCover <= bayer4(gl_FragCoord.xy)) discard;
  gl_FragColor = vec4(vColor, uMark);
  #include <colorspace_fragment>
}
`;

const SPLATS_VERT = /* glsl */ `
${VERT_CORE}
attribute vec3 aPix;
varying vec3 vColor;
varying float vCover;
varying float vGain;
varying vec2 vUv;

void main() {
  Px p = pixelCore(aPix);
  vec4 mv = modelViewMatrix * vec4(p.pos, 1.0);
  vec4 cp = projectionMatrix * mv;
  float perPx = 2.0 * cp.w / (projectionMatrix[1][1] * uViewportH); // metres per target pixel here
  float want = p.size * SPLAT_SCALE;
  float edge = max(want, perPx * SPLAT_MIN_PX);
  vGain = want / edge;
  vUv = position.xy;
  vColor = p.col;
  vCover = p.cover;
  if (p.size <= 0.0 || cp.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  mv.xy += position.xy * 0.5 * edge;
  gl_Position = projectionMatrix * mv;
}
`;

const SPLATS_FRAG = /* glsl */ `
${FRAG_COMMON}
varying vec3 vColor;
varying float vCover;
varying float vGain;
varying vec2 vUv;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 >= 1.0) discard;
  float f = 1.0 - r2;
  float a = f * f * vGain;
  if (a < 0.04 || vCover <= bayer4(gl_FragCoord.xy)) discard;
  gl_FragColor = vec4(vColor * a, uMark);
  #include <colorspace_fragment>
}
`;

const DITHER_VERT = /* glsl */ `
${VERT_CORE}
varying vec3 vColor;
varying float vCover;

void main() {
  Px p = pixelCore(position);
  vec4 cp = projectionMatrix * modelViewMatrix * vec4(p.pos, 1.0);
  float ps = p.size * projectionMatrix[1][1] * uViewportH * 0.5 / cp.w; // edge in target pixels
  vColor = p.col * SHADE_FLAT;
  vCover = p.cover * min(ps, 1.0);
  gl_PointSize = ps < 1.0 ? 1.0 : min(floor(ps + 0.5), MAX_POINT_PX);
  gl_Position = p.size <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : cp;
}
`;

const DITHER_FRAG = CUBES_FRAG;

/* ------------------------------------------------------------------------------------------------
 * The plume object
 * ---------------------------------------------------------------------------------------------- */
interface Emitter {
  id: number;
  spec: Required<EmitterSpec>;
  seed: number;
}

const finiteOr = (v: number | undefined, d: number, lo: number, hi: number): number =>
  v !== undefined && Number.isFinite(v) ? clamp(v, lo, hi) : d;

export function createPlume(o: { mode?: PlumeMode; density?: number; maxPixels?: number; markAlpha?: number } = {}): Plume {
  const maxPixels = Math.max(1, Math.floor(o.maxPixels ?? 16384));
  let mode: PlumeMode = o.mode !== undefined && PLUME_MODES.includes(o.mode) ? o.mode : 'cubes';
  let density = finiteOr(o.density, 1, 0.1, 4);
  const mark = o.markAlpha ?? 0.5;

  const emData: THREE.Vector4[] = [];
  for (let n = 0; n < MAX_EMITTERS * 3; n++) emData.push(new THREE.Vector4());
  const uTime = { value: 0 };
  const uWind = { value: new THREE.Vector2(1, 0) };
  const uWindSpeed = { value: 0 };
  const uWindResponse = { value: 1 };
  const uWaveC = { value: new THREE.Vector3() };
  const uWaveR = { value: -1 };
  const uViewportH = { value: 360 };
  const uniforms: Record<string, THREE.IUniform> = {
    uTime,
    uWind,
    uWindSpeed,
    uWindResponse,
    uWaveC,
    uWaveR,
    uViewportH,
    uMark: { value: mark },
    uEm: { value: emData },
  };

  // one material per mode, built once. The alpha channel is never blended.
  const cubeMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: CUBES_VERT,
    fragmentShader: CUBES_FRAG,
    blending: THREE.NoBlending,
    transparent: false,
    depthTest: true,
    depthWrite: true,
  });
  const splatMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SPLATS_VERT,
    fragmentShader: SPLATS_FRAG,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.ZeroFactor,
    depthTest: true,
    depthWrite: false,
  });
  const ditherMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: DITHER_VERT,
    fragmentShader: DITHER_FRAG,
    blending: THREE.NoBlending,
    transparent: false,
    depthTest: true,
    depthWrite: false,
  });

  // per-instance attribute: (emitter slot, pixel index, seed), one buffer shared by every mode
  const pix = new Float32Array(maxPixels * 3);
  const aCubes = new THREE.InstancedBufferAttribute(pix, 3);
  const aSplats = new THREE.InstancedBufferAttribute(pix, 3);
  const aPoints = new THREE.BufferAttribute(pix, 3);

  const box = new THREE.BoxGeometry(1, 1, 1); // 12 triangles
  const cubeGeo = new THREE.InstancedBufferGeometry();
  cubeGeo.setIndex(box.index);
  cubeGeo.setAttribute('position', box.getAttribute('position'));
  cubeGeo.setAttribute('normal', box.getAttribute('normal'));
  cubeGeo.setAttribute('aPix', aCubes);
  cubeGeo.instanceCount = 0;

  const splatGeo = new THREE.InstancedBufferGeometry(); // 2 triangles
  splatGeo.setIndex([0, 1, 2, 0, 2, 3]);
  splatGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  splatGeo.setAttribute('aPix', aSplats);
  splatGeo.instanceCount = 0;

  const pointGeo = new THREE.BufferGeometry(); // the shader reads (slot, index, seed) from `position`
  pointGeo.setAttribute('position', aPoints);
  pointGeo.setDrawRange(0, 0);

  const cubes = new THREE.Mesh(cubeGeo, cubeMat);
  const splats = new THREE.Mesh(splatGeo, splatMat);
  const sprites = new THREE.Points(pointGeo, ditherMat);
  cubes.name = 'plume-cubes';
  splats.name = 'plume-splats';
  sprites.name = 'plume-dither';
  for (const m of [cubes, splats, sprites]) {
    m.frustumCulled = false; // positions are computed in the shader
    m.visible = false;
  }
  splats.renderOrder = 1;
  const root = new THREE.Group();
  root.name = 'plume';
  root.add(cubes, splats, sprites);

  const emitters: Emitter[] = [];
  let nextId = 1;
  let total = 0;
  const tmpColour = new THREE.Color();

  function applyVisibility(): void {
    const on = mode !== 'off' && total > 0;
    cubes.visible = on && mode === 'cubes';
    splats.visible = on && mode === 'splats';
    sprites.visible = on && mode === 'dither';
  }

  /** Rewrites the instance attribute and the emitter table. Rare events only (add/remove/density). */
  function rebuild(): void {
    let raw = 0;
    for (const em of emitters) raw += em.spec.count * density;
    const scale = raw > maxPixels ? maxPixels / raw : 1;
    let w = 0;
    let n = 0;
    for (let s = 0; s < emitters.length; s++) {
      const em = emitters[s];
      if (!em) continue;
      let cnt = Math.floor(em.spec.count * density * scale + 1e-6);
      if (n + cnt > maxPixels) cnt = maxPixels - n;
      for (let j = 0; j < cnt; j++) {
        pix[w] = s;
        pix[w + 1] = j;
        pix[w + 2] = pixelSeed(em.seed, j);
        w += 3;
      }
      n += cnt;
      const a = emData[3 * s];
      const b = emData[3 * s + 1];
      const c = emData[3 * s + 2];
      if (a && b && c) {
        const sp = em.spec;
        tmpColour.set(sp.colour); // sRGB hex -> linear working space
        a.set(sp.at[0], sp.at[1], sp.at[2], sp.height);
        b.set(tmpColour.r, tmpColour.g, tmpColour.b, sp.spread);
        c.set(sp.life, sp.size, sp.startAt, 0);
      }
    }
    total = n;
    cubeGeo.instanceCount = n;
    splatGeo.instanceCount = n;
    pointGeo.setDrawRange(0, n);
    if (n > 0) {
      for (const at of [aCubes, aSplats, aPoints]) {
        at.clearUpdateRanges();
        at.addUpdateRange(0, n * 3);
        at.needsUpdate = true;
      }
    }
    applyVisibility();
  }

  applyVisibility();

  return {
    object: root,
    get mode(): PlumeMode {
      return mode;
    },
    setMode(m: PlumeMode): void {
      if (!PLUME_MODES.includes(m)) return;
      mode = m;
      applyVisibility();
    },
    setDensity(d: number): void {
      density = finiteOr(d, density, 0.1, 4);
      rebuild();
    },
    setWind(dirX: number, dirZ: number, speed: number): void {
      const len = Math.hypot(dirX, dirZ);
      if (len > 1e-9) uWind.value.set(dirX / len, dirZ / len);
      uWindSpeed.value = Number.isFinite(speed) ? speed : 0;
    },
    setWindResponse(k: number): void {
      uWindResponse.value = finiteOr(k, 1, 0, 2);
    },
    setWave(centre: [number, number, number], radius: number): void {
      uWaveC.value.set(centre[0], centre[1], centre[2]);
      uWaveR.value = radius;
    },
    setViewport(heightPx: number): void {
      uViewportH.value = Math.max(1, heightPx);
    },
    add(e: EmitterSpec): number {
      if (emitters.length >= MAX_EMITTERS) throw new RangeError(`a plume holds at most ${MAX_EMITTERS} emitters`);
      const spec: Required<EmitterSpec> = {
        at: [e.at[0], e.at[1], e.at[2]],
        colour: e.colour,
        count: Math.floor(finiteOr(e.count, 160, 0, maxPixels)),
        height: finiteOr(e.height, 6.5, 0.01, 1000),
        spread: finiteOr(e.spread, 2.6, 0, 1000),
        life: finiteOr(e.life, 3.1, 0.1, 600),
        size: finiteOr(e.size, 0.14, 0.001, 100),
        startAt: finiteOr(e.startAt, 0, -1e9, 1e9),
      };
      const id = nextId++;
      emitters.push({ id, spec, seed: emitterSeed(spec.at) });
      rebuild();
      return id;
    },
    remove(id: number): void {
      const at = emitters.findIndex((em) => em.id === id);
      if (at < 0) return;
      emitters.splice(at, 1);
      rebuild();
    },
    update(t: number): void {
      uTime.value = t;
    },
    stats() {
      const on = mode !== 'off' && total > 0;
      return {
        mode,
        emitters: emitters.length,
        pixels: on ? total : 0,
        drawCalls: on ? 1 : 0,
        triangles: !on ? 0 : mode === 'cubes' ? total * 12 : mode === 'splats' ? total * 2 : 0,
      };
    },
    dispose(): void {
      root.removeFromParent();
      cubeGeo.dispose();
      splatGeo.dispose();
      pointGeo.dispose();
      box.dispose();
      cubeMat.dispose();
      splatMat.dispose();
      ditherMat.dispose();
      emitters.length = 0;
      total = 0;
      applyVisibility();
    },
  };
}
