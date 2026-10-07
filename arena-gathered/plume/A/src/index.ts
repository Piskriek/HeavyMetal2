import * as THREE from 'three';

export type PlumeMode = 'cubes' | 'splats' | 'dither' | 'off';
export const PLUME_MODES: readonly PlumeMode[] = ['cubes', 'splats', 'dither', 'off'] as const;
export const METRIC_COLOURS: { readonly pxd: string; readonly vtx: string; readonly lx: string; readonly aq: string; readonly all: string } = {
  pxd: '#ff3d8a',
  vtx: '#7cff4d',
  lx: '#ffc13d',
  aq: '#3dc8ff',
  all: '#b46bff',
};

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
export interface PixelState { p: [number, number, number]; size: number; life: number; toWave: boolean }
/** The CPU twin of the vertex shader: where pixel i of an emitter is at time t. Same formulas, same constant names as the GLSL (keep them side by side). */
export function pixelAt(e: Required<EmitterSpec>, i: number, t: number, env: PlumeEnv): PixelState {
  if (t <= e.startAt) return { p: [e.at[0], e.at[1], e.at[2]], size: 0, life: 0, toWave: false };
  return env.waveR >= 0 && env.waveR <= 1e6 && i % 4 === 0 ? wavePixel(e, i, t, env) : risePixel(e, i, t, env);
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
export function createPlume(o?: { mode?: PlumeMode; density?: number; maxPixels?: number; markAlpha?: number }): Plume {
  return new PlumeImpl(o);
}

type RequiredEmitter = Required<EmitterSpec>;
type UniformMap = Record<string, THREE.IUniform>;
type EmitterRec = { id: number; spec: RequiredEmitter };

const MAX_EMITTERS = 64;
const GOLDEN = 0.6180339887498949;
const START_FADE = 1.5;
const WAVE_RANGE = 60.0;
const DEFAULTS = { count: 160, height: 6.5, spread: 2.6, life: 3.1, size: 0.14, startAt: 0 } as const;

const QUAD_POS = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
const QUAD_INDEX = [0, 1, 2, 0, 2, 3];
const CUBE_POS = new Float32Array([
  -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,
   1,-1,-1, -1,-1,-1, -1,1,-1, 1,1,-1,
  -1,-1,-1, -1,-1,1, -1,1,1, -1,1,-1,
   1,-1,1, 1,-1,-1, 1,1,-1, 1,1,1,
  -1,1,1, 1,1,1, 1,1,-1, -1,1,-1,
  -1,-1,-1, 1,-1,-1, 1,-1,1, -1,-1,1,
]);
const CUBE_NRM = new Float32Array([
   0,0,1, 0,0,1, 0,0,1, 0,0,1,
   0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
  -1,0,0, -1,0,0, -1,0,0, -1,0,0,
   1,0,0, 1,0,0, 1,0,0, 1,0,0,
   0,1,0, 0,1,0, 0,1,0, 0,1,0,
   0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
]);
const CUBE_INDEX = [
  0,1,2, 0,2,3, 4,5,6, 4,6,7, 8,9,10, 8,10,11,
  12,13,14, 12,14,15, 16,17,18, 16,18,19, 20,21,22, 20,22,23,
];

function clamp(x: number, a: number, b: number): number { return Math.min(b, Math.max(a, x)); }
function fract(x: number): number { return x - Math.floor(x); }
function hash01(i: number, salt: number): number { return fract(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453123); }
function hashSigned(i: number, salt: number): number { return hash01(i, salt) * 2 - 1; }
function easeOutCubic(x: number): number { const k = 1 - clamp(x, 0, 1); return 1 - k * k * k; }
function smooth01(a: number, b: number, x: number): number { const t = clamp((x - a) / Math.max(1e-6, b - a), 0, 1); return t * t * (3 - 2 * t); }
function normalizeGround(x: number, z: number): [number, number] { const d = Math.hypot(x, z); return d < 1e-6 ? [1, 0] : [x / d, z / d]; }
function fadeIn(e: RequiredEmitter, t: number): number { return t <= e.startAt ? 0 : clamp((t - e.startAt) / START_FADE, 0, 1); }
function life01(e: RequiredEmitter, i: number, t: number): number { return fract(Math.max(0, t - e.startAt) / e.life + fract((i + 1) * GOLDEN)); }
function parseColour(hex: string): [number, number, number] { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }
function req(e: EmitterSpec): RequiredEmitter {
  return {
    at: e.at,
    colour: e.colour,
    count: e.count ?? DEFAULTS.count,
    height: e.height ?? DEFAULTS.height,
    spread: e.spread ?? DEFAULTS.spread,
    life: e.life ?? DEFAULTS.life,
    size: e.size ?? DEFAULTS.size,
    startAt: e.startAt ?? DEFAULTS.startAt,
  };
}

function risePixel(e: RequiredEmitter, i: number, t: number, env: PlumeEnv): PixelState {
  const life = life01(e, i, t);
  const up = easeOutCubic(life);
  const fi = fadeIn(e, t);
  const angleBase = hash01(i, 0.31) * Math.PI * 2;
  const turns = 1.3 + hash01(i, 1.73) * 1.7;
  const angle = angleBase + up * turns * Math.PI * 2 + t * (0.25 + hash01(i, 2.41) * 0.35);
  const radial = e.spread * (0.08 + 0.92 * up) * (0.22 + 0.78 * hash01(i, 3.11));
  const drift = env.windSpeed * env.windResponse * life * life * 0.9;
  const endShrink = 1 - smooth01(0.78, 1, life);
  const startBright = 1.08 - life * 0.12;
  return {
    p: [
      e.at[0] + Math.cos(angle) * radial + env.wind[0] * drift,
      e.at[1] + e.height * up,
      e.at[2] + Math.sin(angle) * radial + env.wind[1] * drift,
    ],
    size: e.size * fi * endShrink * startBright,
    life,
    toWave: false,
  };
}

function wavePixel(e: RequiredEmitter, i: number, t: number, env: PlumeEnv): PixelState {
  const life = life01(e, i, t);
  const fi = fadeIn(e, t);
  const dx = e.at[0] - env.waveCentre[0];
  const dz = e.at[2] - env.waveCentre[2];
  const front = Math.max(Math.hypot(dx, dz), env.waveR);
  const lane = Math.floor(i / 4);
  const phase = fract((lane + 1) * GOLDEN + hash01(i, 7.1) * 0.15);
  const travel = clamp(front / WAVE_RANGE, 0, 1);
  const progress = clamp((life - phase * 0.35) / (0.62 + 0.18 * hash01(i, 8.3)), 0, 1) * travel;
  const dir = normalizeGround(hashSigned(i, 9.1), hashSigned(i, 10.7));
  const targetR = Math.min(front, WAVE_RANGE);
  return {
    p: [
      e.at[0] + dir[0] * targetR * progress,
      e.at[1] + 0.4 + Math.sin(progress * Math.PI) * (0.5 + hash01(i, 11.9) * 0.7),
      e.at[2] + dir[1] * targetR * progress,
    ],
    size: e.size * fi * (1 - progress * 0.85),
    life,
    toWave: true,
  };
}

function makeEmitterTexture(): THREE.DataTexture {
  const data = new Float32Array(MAX_EMITTERS * 16);
  const tex = new THREE.DataTexture(data, 4, MAX_EMITTERS, THREE.RGBAFormat, THREE.FloatType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function baseUniforms(tex: THREE.DataTexture, markAlpha: number): UniformMap {
  return {
    uTime: { value: 0 },
    uViewportHeight: { value: 720 },
    uWind: { value: new THREE.Vector2(1, 0) },
    uWindSpeed: { value: 0 },
    uWindResponse: { value: 1 },
    uWaveCentre: { value: new THREE.Vector3(0, 0, 0) },
    uWaveR: { value: -1 },
    uMark: { value: markAlpha },
    uEmitterTex: { value: tex },
  };
}

const SHARED = `
precision highp float;
precision highp sampler2D;
uniform float uTime;
uniform float uViewportHeight;
uniform vec2 uWind;
uniform float uWindSpeed;
uniform float uWindResponse;
uniform vec3 uWaveCentre;
uniform float uWaveR;
uniform sampler2D uEmitterTex;
flat out vec3 vColor;
out float vSize;
out float vLife;
out vec2 vQuad;
flat out float vToWave;
const float GOLDEN = 0.6180339887498949;
const float START_FADE = 1.5;
const float WAVE_RANGE = 60.0;
float hash01(float i, float salt) { return fract(sin(i * 12.9898 + salt * 78.233) * 43758.5453123); }
float easeOutCubic(float x) { float k = 1.0 - clamp(x, 0.0, 1.0); return 1.0 - k * k * k; }
float smooth01(float a, float b, float x) { float t = clamp((x - a) / max(0.000001, b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec4 fetchEmitter(float slot, int row) { return texelFetch(uEmitterTex, ivec2(row, int(slot)), 0); }
mat3 rot3(vec3 a) {
  vec3 s = sin(a), c = cos(a);
  mat3 rx = mat3(1,0,0, 0,c.x,-s.x, 0,s.x,c.x);
  mat3 ry = mat3(c.y,0,s.y, 0,1,0, -s.y,0,c.y);
  mat3 rz = mat3(c.z,-s.z,0, s.z,c.z,0, 0,0,1);
  return rz * ry * rx;
}
void computePixel(float slot, float pixelIndex, out vec3 p, out float size, out float life, out vec3 color, out float toWave) {
  vec4 a = fetchEmitter(slot, 0);
  vec4 b = fetchEmitter(slot, 1);
  vec4 c = fetchEmitter(slot, 2);
  vec4 d = fetchEmitter(slot, 3);
  vec3 at = a.xyz;
  color = b.xyz;
  float height = c.x;
  float spread = c.y;
  float lifeSec = c.z;
  float baseSize = c.w;
  float startAt = d.x;

  if (uTime <= startAt) {
    p = at;
    size = 0.0;
    life = 0.0;
    toWave = 0.0;
    return;
  }

  float localT = max(0.0, uTime - startAt);
  life = fract(localT / lifeSec + fract((pixelIndex + 1.0) * GOLDEN));
  float fi = clamp((uTime - startAt) / START_FADE, 0.0, 1.0);
  bool racer = (uWaveR >= 0.0 && uWaveR <= 1000000.0 && mod(pixelIndex, 4.0) < 0.5);
  toWave = racer ? 1.0 : 0.0;

  if (racer) {
    float dx = at.x - uWaveCentre.x;
    float dz = at.z - uWaveCentre.z;
    float front = max(length(vec2(dx, dz)), uWaveR);
    float lane = floor(pixelIndex / 4.0);
    float phase = fract((lane + 1.0) * GOLDEN + hash01(pixelIndex, 7.1) * 0.15);
    float travel = clamp(front / WAVE_RANGE, 0.0, 1.0);
    float progress = clamp((life - phase * 0.35) / (0.62 + 0.18 * hash01(pixelIndex, 8.3)), 0.0, 1.0) * travel;
    vec2 dir = vec2(hash01(pixelIndex, 9.1) * 2.0 - 1.0, hash01(pixelIndex, 10.7) * 2.0 - 1.0);
    float dl = length(dir);
    dir = dl < 0.0001 ? vec2(1.0, 0.0) : dir / dl;
    float targetR = min(front, WAVE_RANGE);
    p = vec3(
      at.x + dir.x * targetR * progress,
      at.y + 0.4 + sin(progress * 3.14159265) * (0.5 + hash01(pixelIndex, 11.9) * 0.7),
      at.z + dir.y * targetR * progress
    );
    size = baseSize * fi * (1.0 - progress * 0.85);
    return;
  }

  float up = easeOutCubic(life);
  float angleBase = hash01(pixelIndex, 0.31) * 6.2831853;
  float turns = 1.3 + hash01(pixelIndex, 1.73) * 1.7;
  float angle = angleBase + up * turns * 6.2831853 + uTime * (0.25 + hash01(pixelIndex, 2.41) * 0.35);
  float radial = spread * (0.08 + 0.92 * up) * (0.22 + 0.78 * hash01(pixelIndex, 3.11));
  float drift = uWindSpeed * uWindResponse * life * life * 0.9;
  p = vec3(
    at.x + cos(angle) * radial + uWind.x * drift,
    at.y + height * up,
    at.z + sin(angle) * radial + uWind.y * drift
  );
  float endShrink = 1.0 - smooth01(0.78, 1.0, life);
  float startBright = 1.08 - life * 0.12;
  size = baseSize * fi * endShrink * startBright;
}
`;

function bayerGLSL(): string {
  return `float bayer4(vec2 p){ ivec2 q=ivec2(mod(floor(p),4.0)); int i=q.x+q.y*4; float[16] m=float[16](0.0,8.0,2.0,10.0,12.0,4.0,14.0,6.0,3.0,11.0,1.0,9.0,15.0,7.0,13.0,5.0); return (m[i]+0.5)/16.0; }`;
}

function cubeMaterial(tex: THREE.DataTexture, markAlpha: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: baseUniforms(tex, markAlpha),
    glslVersion: THREE.GLSL3,
    vertexShader: `${SHARED}
in vec3 position;
in vec3 normal;
in float iEmitter;
in float iPixel;
out vec3 vNormal;
void main() {
  vec3 p; float size; float life; vec3 color; float toWave;
  computePixel(iEmitter, iPixel, p, size, life, color, toWave);
  mat3 r = rot3(vec3(iPixel*0.17+uTime*0.9, iPixel*0.11+uTime*0.7, iPixel*0.07+uTime*1.1));
  vec3 local = r * (position * (0.5 * size));
  vNormal = normalize(r * normal);
  vColor = color * (1.0 + (1.0 - life) * 0.18);
  vSize = size;
  vLife = life;
  vQuad = position.xy;
  vToWave = toWave;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p + local, 1.0);
}`,
    fragmentShader: `precision highp float;
uniform float uMark;
in vec3 vNormal;
flat in vec3 vColor;
in float vLife;
flat in float vToWave;
out vec4 outColor;
${bayerGLSL()}
void main() {
  float lit = max(0.7, 0.7 + max(0.0, dot(normalize(vNormal), normalize(vec3(0.35,0.9,0.25)))) * 0.45);
  if (vToWave > 0.5) {
    float fade = 1.0 - smoothstep(0.65, 1.0, vLife);
    if (fade < bayer4(gl_FragCoord.xy)) discard;
  }
  outColor = vec4(vColor * lit, uMark);
  #include <colorspace_fragment>
}`,
    blending: THREE.NoBlending,
    depthTest: true,
    depthWrite: true,
    transparent: false,
  });
}

function splatMaterial(tex: THREE.DataTexture, markAlpha: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: baseUniforms(tex, markAlpha),
    glslVersion: THREE.GLSL3,
    vertexShader: `${SHARED}
in vec3 position;
in float iEmitter;
in float iPixel;
void main() {
  vec3 p; float size; float life; vec3 color; float toWave;
  computePixel(iEmitter, iPixel, p, size, life, color, toWave);
  vec3 right = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
  vec3 up = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);
  vec2 q = position.xy;
  vec3 world = p + (right * q.x + up * q.y) * (size * 0.5);
  vColor = color * (1.0 + (1.0 - life) * 0.22);
  vSize = size;
  vLife = life;
  vQuad = q;
  vToWave = toWave;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}`,
    fragmentShader: `precision highp float;
uniform float uMark;
in vec2 vQuad;
flat in vec3 vColor;
in float vLife;
flat in float vToWave;
out vec4 outColor;
${bayerGLSL()}
void main() {
  float cover = exp(-dot(vQuad, vQuad) * 2.6);
  if (cover < 0.08) discard;
  if (vToWave > 0.5) {
    float fade = 1.0 - smoothstep(0.55, 1.0, vLife);
    if (fade < bayer4(gl_FragCoord.xy)) discard;
  }
  outColor = vec4(vColor * cover, uMark);
  #include <colorspace_fragment>
}`,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.ZeroFactor,
    depthTest: true,
    depthWrite: false,
    transparent: true,
  });
}

function ditherMaterial(tex: THREE.DataTexture, markAlpha: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: baseUniforms(tex, markAlpha),
    glslVersion: THREE.GLSL3,
    vertexShader: `${SHARED}
in float iEmitter;
in float iPixel;
void main() {
  vec3 p; float size; float life; vec3 color; float toWave;
  computePixel(iEmitter, iPixel, p, size, life, color, toWave);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.0, size * max(1.0, uViewportHeight / max(0.0001, -mv.z)));
  vColor = color * (1.0 + (1.0 - life) * 0.15);
  vSize = size;
  vLife = life;
  vQuad = vec2(0.0);
  vToWave = toWave;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision highp float;
uniform float uMark;
flat in vec3 vColor;
in float vSize;
in float vLife;
flat in float vToWave;
out vec4 outColor;
${bayerGLSL()}
void main() {
  vec2 uv = gl_PointCoord;
  if (max(abs(uv.x - 0.5), abs(uv.y - 0.5)) > 0.5) discard;
  float fade = vToWave > 0.5 ? 1.0 - smoothstep(0.55, 1.0, vLife) : clamp(vSize / 0.02, 0.0, 1.0);
  if (fade < bayer4(gl_FragCoord.xy)) discard;
  outColor = vec4(vColor, uMark);
  #include <colorspace_fragment>
}`,
    blending: THREE.NoBlending,
    depthTest: true,
    depthWrite: false,
    transparent: false,
  });
}

function fillInstanceArrays(counts: readonly number[]): { emitters: Float32Array; pixels: Float32Array } {
  const total = counts.reduce((a, b) => a + b, 0);
  const emitters = new Float32Array(total);
  const pixels = new Float32Array(total);
  let k = 0;
  for (let slot = 0; slot < counts.length; slot += 1) {
    const n = counts[slot] ?? 0;
    for (let i = 0; i < n; i += 1) {
      emitters[k] = slot;
      pixels[k] = i;
      k += 1;
    }
  }
  return { emitters, pixels };
}

function makeCubeGeometry(total: number, counts: readonly number[]): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(CUBE_POS, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(CUBE_NRM, 3));
  g.setIndex(CUBE_INDEX);
  const a = fillInstanceArrays(counts);
  g.setAttribute('iEmitter', new THREE.InstancedBufferAttribute(a.emitters, 1));
  g.setAttribute('iPixel', new THREE.InstancedBufferAttribute(a.pixels, 1));
  g.instanceCount = total;
  return g;
}

function makeSplatGeometry(total: number, counts: readonly number[]): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(QUAD_POS, 3));
  g.setIndex(QUAD_INDEX);
  const a = fillInstanceArrays(counts);
  g.setAttribute('iEmitter', new THREE.InstancedBufferAttribute(a.emitters, 1));
  g.setAttribute('iPixel', new THREE.InstancedBufferAttribute(a.pixels, 1));
  g.instanceCount = total;
  return g;
}

function makePointGeometry(counts: readonly number[]): THREE.BufferGeometry {
  const total = counts.reduce((a, b) => a + b, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3));
  const a = fillInstanceArrays(counts);
  g.setAttribute('iEmitter', new THREE.BufferAttribute(a.emitters, 1));
  g.setAttribute('iPixel', new THREE.BufferAttribute(a.pixels, 1));
  return g;
}

class PlumeImpl implements Plume {
  readonly object: THREE.Object3D = new THREE.Group();
  private readonly emitterTex = makeEmitterTexture();
  private readonly materials: Record<'cubes' | 'splats' | 'dither', THREE.ShaderMaterial>;
  private readonly emitters = new Map<number, EmitterRec>();
  private readonly order: number[] = [];
  private cubeMesh: THREE.Mesh;
  private splatMesh: THREE.Mesh;
  private pointMesh: THREE.Points;
  private nextId = 1;
  private activePixels = 0;
  private _mode: PlumeMode;
  private density: number;
  private readonly maxPixels: number;

  constructor(o?: { mode?: PlumeMode; density?: number; maxPixels?: number; markAlpha?: number }) {
    this._mode = o?.mode ?? 'cubes';
    this.density = clamp(o?.density ?? 1, 0.1, 4);
    this.maxPixels = Math.max(1, Math.floor(o?.maxPixels ?? 16384));
    const markAlpha = o?.markAlpha ?? 0.5;

    this.materials = {
      cubes: cubeMaterial(this.emitterTex, markAlpha),
      splats: splatMaterial(this.emitterTex, markAlpha),
      dither: ditherMaterial(this.emitterTex, markAlpha),
    };

    this.cubeMesh = new THREE.Mesh(makeCubeGeometry(0, []), this.materials.cubes);
    this.splatMesh = new THREE.Mesh(makeSplatGeometry(0, []), this.materials.splats);
    this.pointMesh = new THREE.Points(makePointGeometry([]), this.materials.dither);

    this.cubeMesh.frustumCulled = false;
    this.splatMesh.frustumCulled = false;
    this.pointMesh.frustumCulled = false;

    this.setWind(1, 0, 0);
    this.setWindResponse(1);
    this.setWave([0, 0, 0], -1);
    this.setViewport(720);
    this.refreshVisible();
    this.rebuildGeometry();
  }

  get mode(): PlumeMode { return this._mode; }

  setMode(mode: PlumeMode): void {
    this._mode = mode;
    this.refreshVisible();
  }

  setDensity(d: number): void {
    this.density = clamp(d, 0.1, 4);
    this.rebuildGeometry();
  }

  setWind(dirX: number, dirZ: number, speed: number): void {
    const dir = normalizeGround(dirX, dirZ);
    for (const m of Object.values(this.materials)) {
      (m.uniforms.uWind.value as THREE.Vector2).set(dir[0], dir[1]);
      m.uniforms.uWindSpeed.value = speed;
    }
  }

  setWindResponse(k: number): void {
    for (const m of Object.values(this.materials)) m.uniforms.uWindResponse.value = clamp(k, 0, 2);
  }

  setWave(centre: [number, number, number], radius: number): void {
    for (const m of Object.values(this.materials)) {
      (m.uniforms.uWaveCentre.value as THREE.Vector3).set(centre[0], centre[1], centre[2]);
      m.uniforms.uWaveR.value = radius;
    }
  }

  setViewport(heightPx: number): void {
    for (const m of Object.values(this.materials)) m.uniforms.uViewportHeight.value = Math.max(1, heightPx);
  }

  add(e: EmitterSpec): number {
    if (this.order.length >= MAX_EMITTERS) throw new Error(`max ${MAX_EMITTERS} emitters`);
    const id = this.nextId;
    this.nextId += 1;
    this.emitters.set(id, { id, spec: req(e) });
    this.order.push(id);
    this.syncEmitterTexture();
    this.rebuildGeometry();
    return id;
  }

  remove(id: number): void {
    if (!this.emitters.delete(id)) return;
    const i = this.order.indexOf(id);
    if (i >= 0) this.order.splice(i, 1);
    this.syncEmitterTexture();
    this.rebuildGeometry();
  }

  update(t: number): void {
    for (const m of Object.values(this.materials)) m.uniforms.uTime.value = t;
  }

  stats(): { mode: PlumeMode; emitters: number; pixels: number; drawCalls: number; triangles: number } {
    const pixels = this._mode === 'off' ? 0 : this.activePixels;
    return {
      mode: this._mode,
      emitters: this.emitters.size,
      pixels,
      drawCalls: this._mode === 'off' || pixels === 0 ? 0 : 1,
      triangles: this._mode === 'cubes' ? pixels * 12 : this._mode === 'splats' ? pixels * 2 : 0,
    };
  }

  dispose(): void {
    this.cubeMesh.geometry.dispose();
    this.splatMesh.geometry.dispose();
    this.pointMesh.geometry.dispose();
    for (const m of Object.values(this.materials)) m.dispose();
    this.emitterTex.dispose();
    this.object.clear();
  }

  private syncEmitterTexture(): void {
    const data = this.emitterTex.image.data;
    if (!(data instanceof Float32Array)) throw new Error('emitter texture storage missing');
    data.fill(0);
    for (let slot = 0; slot < this.order.length; slot += 1) {
      const id = this.order[slot];
      if (id === undefined) continue;
      const rec = this.emitters.get(id);
      if (!rec) continue;
      const e = rec.spec;
      const c = parseColour(e.colour);
      const o = slot * 16;
      data[o + 0] = e.at[0]; data[o + 1] = e.at[1]; data[o + 2] = e.at[2];
      data[o + 4] = c[0]; data[o + 5] = c[1]; data[o + 6] = c[2];
      data[o + 8] = e.height; data[o + 9] = e.spread; data[o + 10] = e.life; data[o + 11] = e.size;
      data[o + 12] = e.startAt;
    }
    this.emitterTex.needsUpdate = true;
  }

  private scaledCounts(): number[] {
    const raw = this.order.map((id) => {
      const rec = this.emitters.get(id);
      return Math.max(0, Math.round((rec?.spec.count ?? 0) * this.density));
    });
    const total = raw.reduce((a, b) => a + b, 0);
    if (total <= this.maxPixels) return raw;

    const scale = this.maxPixels / Math.max(1, total);
    const out = raw.map((n) => Math.floor(n * scale));
    let used = out.reduce((a, b) => a + b, 0);
    const rest = raw.map((n, i) => ({ i, frac: n * scale - (out[i] ?? 0) })).sort((a, b) => b.frac - a.frac || a.i - b.i);

    for (let k = 0; k < rest.length && used < this.maxPixels; k += 1) {
      const idx = rest[k]?.i;
      if (idx === undefined) continue;
      out[idx] = (out[idx] ?? 0) + 1;
      used += 1;
    }
    return out;
  }

  private rebuildGeometry(): void {
    const counts = this.scaledCounts();
    const total = counts.reduce((a, b) => a + b, 0);
    this.activePixels = total;

    this.cubeMesh.geometry.dispose();
    this.splatMesh.geometry.dispose();
    this.pointMesh.geometry.dispose();

    this.cubeMesh.geometry = makeCubeGeometry(total, counts);
    this.splatMesh.geometry = makeSplatGeometry(total, counts);
    this.pointMesh.geometry = makePointGeometry(counts);

    this.refreshVisible();
  }

  private refreshVisible(): void {
    this.object.clear();
    if (this._mode === 'cubes') this.object.add(this.cubeMesh);
    if (this._mode === 'splats') this.object.add(this.splatMesh);
    if (this._mode === 'dither') this.object.add(this.pointMesh);
  }
}
