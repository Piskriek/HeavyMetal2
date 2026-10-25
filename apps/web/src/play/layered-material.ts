/**
 * Layered materials in the renderer (plan 41 section 4.5). A kit part named `mat:<id>` (a shelf preset, @hm/matstack)
 * draws at the rank the stage and the Graphics tier allow:
 *  - rank 0: the material flattened per face (flattenMesh) into vertex colours, roughness and metalness: one plain
 *    material, no textures (Low, and stages 0b to 1);
 *  - rank 1: a MeshStandardMaterial that evaluates the layers per pixel: masks from the geometry's edge and crease lines
 *    (aEdge, aCavity), the height above the machine's foot and the facing, and the shared noise atlas; surfaces from their
 *    tiles and ramps;
 *  - rank 2: the same on a MeshPhysicalMaterial when a surface uses a specular level, coat, fuzz, thin film or brushing.
 * The GLSL mirrors @hm/matstack's reference formulas line for line; the mask view (msMaskView) writes one layer's weight
 * straight to the pixel, which is both the bench's mask view and the test that holds the two together.
 *
 * Geometry meets it through kitLayering (kit-build's layering hook: edge lines once per part shape, then rank 0's
 * flatten where the part stands). Presets are uniforms; the program is keyed by rank, layer count and features only, so
 * the whole shelf shares a handful of programs. A name that does not resolve draws a neutral fallback at once and warns
 * (never an invisible part).
 */
import * as THREE from 'three';
import { TILE_LIBRARY, evaluateGraph, type TexGraph } from '@hm/texgraph';
import { VAULT_BY_ID } from '@hm/vault';
import {
  CHANNEL_GROUPS,
  EDGE_BAND,
  FLAT_TILE,
  MAX_LAYERS,
  MAX_MASK_INPUTS,
  features,
  flattenMesh,
  hexToLinear,
  maskAttributes,
  rampAt,
  resolveColour,
  specOfName,
  CUSTOM_PREFIX,
  seedOffset,
  type ChannelGroup,
  type LayerSpec,
  type MaskInput,
  type MaskMesh,
  type MaterialSpec,
  type NoiseKind,
  type NoiseSource,
  type SurfaceSpec,
  type TileSource,
} from '@hm/matstack';

export type MatRank = 0 | 1 | 2;

export const MAT_PREFIX = 'mat:';
export const isLayeredName = (name: string): boolean => name.startsWith(MAT_PREFIX) || name.startsWith(CUSTOM_PREFIX);

/** A reflection to draw with where the scene has none (the planet): the map and how strong. */
export interface LayeredEnv {
  readonly map: THREE.Texture;
  readonly intensity: number;
}

/** What a layered material carries for kitLayering. */
interface LayeredInfo {
  readonly spec: MaterialSpec;
  readonly rank: MatRank;
}

// ------------------------------------------------------------------ the noise atlas

const NOISE_SIZE = 256;
/** Channel order of the atlas: clouds, cells, speckle, scratches (matstack's NOISE_KINDS). */
const NOISE_INDEX: Readonly<Record<NoiseKind, number>> = { clouds: 0, cells: 1, speckle: 2, scratches: 3 };

/** The four noises as texgraph graphs (height output), all periodic on the tile. */
const NOISE_GRAPHS: readonly TexGraph[] = [
  { id: 'ms-clouds', name: 'Clouds', nodes: [{ id: 'n', type: 'noise', scale: 4, octaves: 5, gain: 0.5, seed: 11 }], out: { height: 'n' } },
  {
    id: 'ms-cells', name: 'Cells',
    nodes: [{ id: 'c', type: 'cellular', scale: 7, jitter: 0.9, mode: 'f1', seed: 23 }, { id: 'i', type: 'invert', in: 'c' }],
    out: { height: 'i' },
  },
  // fine blobs, not single texels: thresholded masks would glitter
  { id: 'ms-speckle', name: 'Speckle', nodes: [{ id: 'g', type: 'noise', scale: 32, octaves: 2, gain: 0.45, seed: 37 }], out: { height: 'g' } },
  {
    id: 'ms-scratches', name: 'Scratches',
    nodes: [
      { id: 's', type: 'stripes', count: 23, softness: 0.08, vertical: false, tilt: 5 },
      { id: 'f', type: 'noise', scale: 3, octaves: 2, gain: 0.5, seed: 43 },
      { id: 'w', type: 'warp', in: 's', warp: 'f', amount: 0.04 },
      { id: 'n', type: 'noise', scale: 6, octaves: 2, gain: 0.5, seed: 41 },
      { id: 'm', type: 'blend', a: 'w', b: 'n', mode: 'multiply', amount: 1 },
      { id: 'l', type: 'levels', in: 'm', inLow: 0.35, inHigh: 0.9, gamma: 1, outLow: 0, outHigh: 1 },
    ],
    out: { height: 'l' },
  },
];

let noiseBytes: Uint8Array | null = null;
/** The atlas as RGBA bytes, built once: the GPU texture and the CPU sampler read the same bytes. */
function noiseAtlas(): Uint8Array {
  if (noiseBytes) return noiseBytes;
  const out = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4);
  NOISE_GRAPHS.forEach((g, ch) => {
    const h = evaluateGraph(g, { size: NOISE_SIZE }).height;
    for (let i = 0; i < NOISE_SIZE * NOISE_SIZE; i++) out[i * 4 + ch] = Math.round(255 * Math.min(1, Math.max(0, h?.[i] ?? 0.5)));
  });
  noiseBytes = out;
  return out;
}

let noiseTexture: THREE.DataTexture | null = null;
function noiseTex(): THREE.DataTexture {
  if (noiseTexture) return noiseTexture;
  const t = new THREE.DataTexture(noiseAtlas(), NOISE_SIZE, NOISE_SIZE, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  noiseTexture = t;
  return t;
}

/** Bilinear, wrapping, on bytes laid out RGBA: what a texture fetch at full resolution returns. */
function bilinear(bytes: Uint8Array, size: number, channel: number, u: number, v: number): number {
  const x = (u - Math.floor(u)) * size - 0.5, y = (v - Math.floor(v)) * size - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (xi: number, yi: number): number => {
    const xx = ((xi % size) + size) % size, yy = ((yi % size) + size) % size;
    return bytes[(yy * size + xx) * 4 + channel]! / 255;
  };
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
  return a + (b - a) * fy;
}

/** The atlas for the CPU (rank 0's flatten, the tests). */
export const cpuNoise: NoiseSource = { sample: (kind, u, v) => bilinear(noiseAtlas(), NOISE_SIZE, NOISE_INDEX[kind], u, v) };

// ------------------------------------------------------------------ tiles

/** Tile graphs by id: the tile library first (TICKET-41: the 20 tiles the shelf names), then the vault's cartridges on top. */
const TILE_GRAPHS = new Map<string, TexGraph>([
  ...Object.entries(TILE_LIBRARY),
  ...[...VAULT_BY_ID].map(([id, c]): [string, TexGraph] => [id, c.graph]),
]);

/** Adds tile graphs (the tile library); later registrations replace earlier ones of the same id. */
export function registerTileGraphs(graphs: Readonly<Record<string, TexGraph>>): void {
  for (const [id, g] of Object.entries(graphs)) TILE_GRAPHS.set(id, g);
  tileCache.clear();
}

const tileCache = new Map<string, Uint8Array | null>();
/** A tile as RGBA bytes (R grey, G height, B roughness), or null when no graph has this id. */
function tileBytes(id: string, size: number): Uint8Array | null {
  const key = `${id}|${size}`;
  if (tileCache.has(key)) return tileCache.get(key)!;
  const g = TILE_GRAPHS.get(id);
  let out: Uint8Array | null = null;
  if (g) {
    const t = evaluateGraph(g, { size });
    out = new Uint8Array(size * size * 4);
    const b = (x: number): number => Math.round(255 * Math.min(1, Math.max(0, x)));
    for (let i = 0; i < size * size; i++) {
      const grey = t.albedo ? 0.2126 * t.albedo[i * 3]! + 0.7152 * t.albedo[i * 3 + 1]! + 0.0722 * t.albedo[i * 3 + 2]! : 0.5;
      out[i * 4] = b(grey);
      out[i * 4 + 1] = b(t.height?.[i] ?? 0.5);
      out[i * 4 + 2] = b(t.roughness?.[i] ?? 0.5);
      out[i * 4 + 3] = 255;
    }
  }
  tileCache.set(key, out);
  return out;
}

const CPU_TILE = 128;
/** Tiles for the CPU, at the size rank 1 draws them. Unknown ids read flat, as the matstack contract says. */
export const cpuTiles: TileSource = {
  sample(tile, u, v) {
    const bytes = tileBytes(tile, CPU_TILE);
    if (!bytes) return FLAT_TILE;
    return { grey: bilinear(bytes, CPU_TILE, 0, u, v), height: bilinear(bytes, CPU_TILE, 1, u, v), rough: bilinear(bytes, CPU_TILE, 2, u, v) };
  },
};

/** The tiles a material uses, as one array texture, and each id's layer (ids with no graph are left out: flat). */
function tileArray(ids: readonly string[], size: number): { readonly texture: THREE.DataArrayTexture | null; readonly layer: ReadonlyMap<string, number> } {
  const known = ids.filter((id) => tileBytes(id, size));
  if (known.length === 0) return { texture: null, layer: new Map() };
  const data = new Uint8Array(size * size * 4 * known.length);
  known.forEach((id, i) => data.set(tileBytes(id, size)!, i * size * size * 4));
  const t = new THREE.DataArrayTexture(data, size, size, known.length);
  t.format = THREE.RGBAFormat;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return { texture: t, layer: new Map(known.map((id, i) => [id, i])) };
}

// ------------------------------------------------------------------ packing a spec into uniforms

/** Vec4s per surface: colour+metal, rough/spec/tile/scale, bump/roughVar/colourVar/ramp, detail, coat/fuzz/aniso, fuzz colour+film, emit+thickness. */
const SURF_VEC = 7;
/** Vec4s per mask input: (kind, blend, opacity, invert), (params). */
const INPUT_VEC = 2;
const RAMP_W = 256;
const INPUT_KIND: Readonly<Record<MaskInput['kind'], number>> = { all: 0, edge: 1, cavity: 2, up: 3, down: 4, ground: 5, noise: 6, streaks: 7 };
const BLEND_INDEX = { normal: 0, add: 1, subtract: 2, multiply: 3, max: 4, min: 5 } as const;
const WRITE_BIT: Readonly<Record<ChannelGroup, number>> = Object.fromEntries(CHANNEL_GROUPS.map((g, i) => [g, 1 << i])) as Record<ChannelGroup, number>;

interface Packed {
  readonly surf: Float32Array;
  readonly inputs: Float32Array;
  readonly masks: Float32Array;
  readonly layers: Float32Array;
  readonly ramps: THREE.DataTexture;
  readonly tiles: THREE.DataArrayTexture | null;
  readonly count: number;
}

const srgbByte = (linear: number): number => {
  const c = Math.min(1, Math.max(0, linear));
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
};

function inputParams(i: MaskInput): readonly [number, number, number, number] {
  switch (i.kind) {
    case 'all': return [0, 0, 0, 0];
    case 'edge':
    case 'cavity': return [i.width, 0, 0, 0];
    case 'up':
    case 'down': return [i.angle, i.soft, 0, 0];
    case 'ground': return [i.height, i.soft, 0, 0];
    case 'noise': { const o = seedOffset(i.seed); return [NOISE_INDEX[i.noise], i.scale, o[0], o[1]]; }
    case 'streaks': { const o = seedOffset(i.seed); return [i.scale, i.stretch, o[0], o[1]]; }
  }
}

function pack(spec: MaterialSpec, rank: MatRank): Packed {
  const layers: readonly LayerSpec[] = spec.layers.slice(0, MAX_LAYERS).filter((l) => l.visible);
  const surfaces: readonly SurfaceSpec[] = [spec.base, ...layers.map((l) => l.surface)];
  const tileIds = [...new Set(surfaces.flatMap((s) => [s.tile?.tile, s.detail?.tile].filter((x): x is string => !!x)))];
  const tiles = tileArray(tileIds, rank === 2 ? 256 : 128);
  const surf = new Float32Array(surfaces.length * SURF_VEC * 4);
  const ramp = new Uint8Array(RAMP_W * surfaces.length * 4);
  surfaces.forEach((s, si) => {
    const c = resolveColour(s.colour, spec.paint);
    const tl = s.tile ? tiles.layer.get(s.tile.tile) ?? -1 : -1;
    const dl = s.detail ? tiles.layer.get(s.detail.tile) ?? -1 : -1;
    const hasRamp = (s.ramp?.length ?? 0) >= 2;
    const fz = s.fuzz ? hexToLinear(s.fuzz.colour) : [0, 0, 0];
    const em = s.emit ? hexToLinear(s.emit.colour) : [0, 0, 0];
    const ei = s.emit ? Math.max(0, s.emit.intensity) : 0;
    const v = [
      c[0], c[1], c[2], s.metal,
      s.rough, s.specular, tl, s.tile?.scale ?? 1,
      s.tile?.bump ?? 0, s.tile?.roughVar ?? 0, s.tile?.colourVar ?? 0, hasRamp ? 1 : 0,
      dl, s.detail?.scale ?? 1, s.detail?.bump ?? 0, s.detail?.roughVar ?? 0,
      s.coat?.amount ?? 0, s.coat?.rough ?? 0.1, s.fuzz?.amount ?? 0, s.aniso?.amount ?? 0,
      fz[0]!, fz[1]!, fz[2]!, s.film?.amount ?? 0,
      em[0]! * ei, em[1]! * ei, em[2]! * ei, s.film?.thickness ?? 400,
    ];
    surf.set(v, si * SURF_VEC * 4);
    if (hasRamp) {
      for (let x = 0; x < RAMP_W; x++) {
        const col = rampAt(s.ramp!, (x + 0.5) / RAMP_W);
        const at = (si * RAMP_W + x) * 4;
        ramp[at] = srgbByte(col[0]); ramp[at + 1] = srgbByte(col[1]); ramp[at + 2] = srgbByte(col[2]); ramp[at + 3] = 255;
      }
    }
  });
  const n = Math.max(1, layers.length);
  const inputs = new Float32Array(n * MAX_MASK_INPUTS * INPUT_VEC * 4);
  const masks = new Float32Array(n * 4);
  const lay = new Float32Array(n * 4);
  layers.forEach((l, li) => {
    const ins = l.mask.inputs.slice(0, MAX_MASK_INPUTS);
    ins.forEach((inp, ii) => {
      const at = (li * MAX_MASK_INPUTS + ii) * INPUT_VEC * 4;
      inputs.set([INPUT_KIND[inp.kind], BLEND_INDEX[inp.blend], inp.opacity, inp.invert ? 1 : 0, ...inputParams(inp)], at);
    });
    masks.set([l.mask.balance, l.mask.contrast, l.mask.invert ? 1 : 0, ins.length], li * 4);
    lay.set([l.opacity, l.heightBlend, l.weathering ? 1 : 0, l.writes.reduce((bits, w) => bits | WRITE_BIT[w], 0)], li * 4);
  });
  const rampTex = new THREE.DataTexture(ramp, RAMP_W, surfaces.length, THREE.RGBAFormat);
  rampTex.colorSpace = THREE.SRGBColorSpace;
  rampTex.minFilter = rampTex.magFilter = THREE.LinearFilter;
  rampTex.wrapS = rampTex.wrapT = THREE.ClampToEdgeWrapping;
  rampTex.generateMipmaps = false;
  rampTex.needsUpdate = true;
  return { surf, inputs, masks, layers: lay, ramps: rampTex, tiles: tiles.texture, count: layers.length };
}

// ------------------------------------------------------------------ GLSL

const VERT_PARS = /* glsl */ `
attribute vec4 aEdge;
attribute vec4 aCavity;
varying vec4 vMsEdge;
varying vec4 vMsCav;
varying vec3 vMsPos;
varying vec3 vMsNormal;
varying vec2 vMsUv;
`;
const VERT_MAIN = /* glsl */ `
vMsEdge = aEdge;
vMsCav = aCavity;
vMsPos = position;
vMsNormal = normal;
vMsUv = uv;
`;

/** The fragment functions: matstack's inputValue, blendInput, levels, maskAt, surfaceAt, layerWeight and materialAt. */
const FRAG_PARS = /* glsl */ `
#define MS_FAR 1000.0
#define MS_SURF (MS_LAYERS + 1)
uniform sampler2D msNoise;
uniform sampler2D msRamps;
#if MS_TILES
uniform highp sampler2DArray msTiles;
#endif
uniform vec4 msSurf[MS_SURF * ${SURF_VEC}];
uniform vec4 msIn[MS_LAYERS_N * ${MAX_MASK_INPUTS * INPUT_VEC}];
uniform vec4 msMask[MS_LAYERS_N];
uniform vec4 msLayer[MS_LAYERS_N];
uniform float msAge;
uniform float msBump;
uniform int msMaskView;
varying vec4 vMsEdge;
varying vec4 vMsCav;
varying vec3 vMsPos;
varying vec3 vMsNormal;
varying vec2 vMsUv;
float msViewValue = 0.0;

struct MsCh { vec3 colour; float metal; float rough; float spec; float height; float coat; float coatRough; float fuzz; vec3 fuzzColour; float aniso; float film; float filmThick; vec3 emit; };

float msSmooth(float e0, float e1, float x) { float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float msLine(vec4 d) { vec4 f = mix(vec4(MS_FAR), d, step(0.0, d)); return min(min(f.x, f.y), min(f.z, f.w)); }
float msNoiseAt(int kind, vec2 uv) { vec4 n = texture2D(msNoise, uv); return kind == 0 ? n.r : kind == 1 ? n.g : kind == 2 ? n.b : n.a; }

float msInput(int kind, vec4 p) {
  if (kind == 0) return 1.0;
  if (kind == 1 || kind == 2) {
    float w = clamp(p.x, 0.0005, ${EDGE_BAND.toFixed(4)});
    return 1.0 - msSmooth(0.0, w, kind == 1 ? msLine(vMsEdge) : msLine(vMsCav));
  }
  vec3 n = normalize(vMsNormal);
  if (kind == 3 || kind == 4) {
    float th = degrees(acos(clamp(kind == 3 ? n.y : -n.y, -1.0, 1.0)));
    float s = max(0.5, p.y);
    return 1.0 - msSmooth(p.x - s, p.x + s, th);
  }
  if (kind == 5) { float s = max(0.005, p.y); return 1.0 - msSmooth(p.x - s, p.x + s, vMsPos.y); }
  if (kind == 6) return clamp(msNoiseAt(int(p.x + 0.5), vMsUv / max(0.001, p.y) + p.zw), 0.0, 1.0);
  float L = length(n.xz);
  if (L < 0.001) return 0.0;
  vec2 t = vec2(n.z, -n.x) / L;
  float sc = max(0.001, p.x);
  vec2 uv = vec2(dot(vMsPos.xz, t) / sc, vMsPos.y / (sc * max(1.0, p.y))) + p.zw;
  return clamp(msNoiseAt(0, uv), 0.0, 1.0) * L;
}

float msBlend(int mode, float acc, float v, float o) {
  float r;
  if (mode == 0) r = mix(acc, v, o);
  else if (mode == 1) r = acc + o * v;
  else if (mode == 2) r = acc - o * v;
  else if (mode == 3) r = acc * mix(1.0, v, o);
  else if (mode == 4) r = max(acc, o * v);
  else r = min(acc, mix(1.0, v, o));
  return clamp(r, 0.0, 1.0);
}

float msMaskOf(int l) {
  vec4 m = msMask[l];
  int count = int(m.w + 0.5);
  float acc = 0.0;
  for (int i = 0; i < ${MAX_MASK_INPUTS}; i++) {
    if (i >= count) break;
    vec4 a = msIn[(l * ${MAX_MASK_INPUTS} + i) * ${INPUT_VEC}];
    vec4 p = msIn[(l * ${MAX_MASK_INPUTS} + i) * ${INPUT_VEC} + 1];
    float raw = msInput(int(a.x + 0.5), p);
    acc = msBlend(int(a.y + 0.5), acc, a.w > 0.5 ? 1.0 - raw : raw, clamp(a.z, 0.0, 1.0));
  }
  float c = 0.5 - m.x * 0.5;
  float h = max(0.01, (1.0 - m.y) * 0.5);
  // where the mask changes faster than a pixel can show (fine noise far away), the threshold widens to filter instead of
  // glittering; up close (fwidth small) this is matstack's levels exactly
  h = max(h, fwidth(acc) * 0.75);
  float v = clamp((acc - c) / (2.0 * h) + 0.5, 0.0, 1.0);
  return m.z > 0.5 ? 1.0 - v : v;
}

MsCh msSurface(int s) {
  vec4 a = msSurf[s * ${SURF_VEC}];
  vec4 b = msSurf[s * ${SURF_VEC} + 1];
  vec4 c = msSurf[s * ${SURF_VEC} + 2];
  vec4 d = msSurf[s * ${SURF_VEC} + 3];
  vec4 e = msSurf[s * ${SURF_VEC} + 4];
  vec4 f = msSurf[s * ${SURF_VEC} + 5];
  vec4 g = msSurf[s * ${SURF_VEC} + 6];
  vec3 t = vec3(0.5);
  bool tiled = b.z >= 0.0;
#if MS_TILES
  if (tiled) t = texture(msTiles, vec3(vMsUv / max(b.w, 0.001), b.z)).rgb;
#endif
  MsCh o;
  if (c.w > 0.5) o.colour = texture2D(msRamps, vec2(t.r, (float(s) + 0.5) / float(MS_SURF))).rgb;
  else o.colour = clamp(a.rgb * (tiled ? 1.0 + c.z * (t.r - 0.5) * 2.0 : 1.0), 0.0, 1.0);
  float rough = b.x + (tiled ? c.y * (t.b - 0.5) * 2.0 : 0.0);
  float height = 0.5 + (tiled ? (t.g - 0.5) * c.x : 0.0);
#if MS_TILES
  if (d.x >= 0.0) {
    vec3 dt = texture(msTiles, vec3(vMsUv / max(d.y, 0.001), d.x)).rgb;
    rough += d.w * (dt.b - 0.5) * 2.0;
    height += (dt.g - 0.5) * d.z;
  }
#endif
  o.metal = clamp(a.w, 0.0, 1.0);
  o.rough = clamp(rough, 0.0, 1.0);
  o.spec = clamp(b.y, 0.0, 1.0);
  o.height = clamp(height, 0.0, 1.0);
  o.coat = clamp(e.x, 0.0, 1.0);
  o.coatRough = clamp(e.y, 0.0, 1.0);
  o.fuzz = clamp(e.z, 0.0, 1.0);
  o.aniso = clamp(e.w, 0.0, 1.0);
  o.fuzzColour = f.rgb;
  o.film = clamp(f.w, 0.0, 1.0);
  o.emit = g.rgb;
  o.filmThick = g.w;
  return o;
}

float msWeight(int l, float height) {
  vec4 L = msLayer[l];
  float o = clamp(L.x, 0.0, 1.0);
  if (o <= 0.0) return 0.0;
  float m = msMaskOf(l);
  float hb = clamp(L.y, 0.0, 1.0);
  if (hb > 0.0) m = clamp((m - 0.5) * (1.0 + 4.0 * hb) + (height - 0.5) * 2.0 * hb + 0.5, 0.0, 1.0);
  if (L.z > 0.5) {
    float a = clamp(msAge, 0.0, 1.0);
    m = a <= 0.0 ? 0.0 : clamp((m + a - 1.0) / a, 0.0, 1.0);
  }
  return m * o;
}

MsCh msEval() {
  MsCh o = msSurface(0);
#if MS_LAYERS > 0
  for (int l = 0; l < MS_LAYERS; l++) {
    MsCh s = msSurface(l + 1);
    float w = msWeight(l, s.height);
    if (msMaskView == l) msViewValue = w;
    if (w <= 0.0) continue;
    int bits = int(msLayer[l].w + 0.5);
    if ((bits & 1) != 0) o.colour = mix(o.colour, s.colour, w);
    if ((bits & 2) != 0) o.metal = mix(o.metal, s.metal, w);
    if ((bits & 4) != 0) o.rough = mix(o.rough, s.rough, w);
    if ((bits & 8) != 0) o.spec = mix(o.spec, s.spec, w);
    if ((bits & 16) != 0) o.height = mix(o.height, s.height, w);
    if ((bits & 32) != 0) { o.coat = mix(o.coat, s.coat, w); o.coatRough = mix(o.coatRough, s.coatRough, w); }
    if ((bits & 64) != 0) { o.fuzz = mix(o.fuzz, s.fuzz, w); o.fuzzColour = mix(o.fuzzColour, s.fuzzColour, w); }
    if ((bits & 128) != 0) o.aniso = mix(o.aniso, s.aniso, w);
    if ((bits & 256) != 0) { o.film = mix(o.film, s.film, w); o.filmThick = mix(o.filmThick, s.filmThick, w); }
    if ((bits & 512) != 0) o.emit = mix(o.emit, s.emit, w);
  }
#endif
  return o;
}

// three's perturbNormalArb (bumpmap_pars_fragment), under its own name: the height is computed, not a texture
vec3 msPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

const RANK0_VERT_PARS = /* glsl */ `
attribute vec2 aRM;
varying vec2 vMsRM;
`;

const swap = (src: string, find: string, add: string): string => {
  if (!src.includes(find)) throw new Error(`layered material: shader has no ${find}`);
  return src.replace(find, `${find}\n${add}`);
};

// ------------------------------------------------------------------ materials

const cache = new Map<string, THREE.Material>();
const warned = new Set<string>();

/** A neutral stand-in for a name that does not resolve: drawn at once, never an invisible part. */
function fallback(name: string): THREE.Material {
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`layered material: ${name} does not resolve; drawing a neutral stand-in`);
  }
  const key = 'fallback';
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color: '#8a8f94', roughness: 0.62, metalness: 0.15 });
  m.name = 'matstack:fallback';
  cache.set(key, m);
  return m;
}

/** The rank-0 material: vertex colours, with roughness and metalness per vertex (aRM). */
function flatMaterial(spec: MaterialSpec): THREE.Material {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 });
  m.userData.matstack = { spec, rank: 0 } satisfies LayeredInfo;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = swap(shader.vertexShader, '#include <common>', RANK0_VERT_PARS);
    shader.vertexShader = swap(shader.vertexShader, '#include <begin_vertex>', 'vMsRM = aRM;');
    shader.fragmentShader = swap(shader.fragmentShader, '#include <common>', 'varying vec2 vMsRM;');
    shader.fragmentShader = swap(shader.fragmentShader, '#include <roughnessmap_fragment>', 'roughnessFactor = vMsRM.x;');
    shader.fragmentShader = swap(shader.fragmentShader, '#include <metalnessmap_fragment>', 'metalnessFactor = vMsRM.y;');
  };
  m.customProgramCacheKey = () => 'matstack0';
  return m;
}

/** Whether rank 2 needs the physical model (a specular level, coat, fuzz, film or brushing anywhere). */
function needsPhysical(spec: MaterialSpec): boolean {
  const f = features(spec);
  const surfaces = [spec.base, ...spec.layers.filter((l) => l.visible).map((l) => l.surface)];
  return f.coat || f.fuzz || f.film || f.aniso || surfaces.some((s) => Math.abs(s.specular - 0.5) > 1e-3);
}

/** The per-pixel material for rank 1 (standard) or 2 (physical where needed). */
function layeredShaderMaterial(spec: MaterialSpec, rank: 1 | 2): THREE.Material {
  const p = pack(spec, rank);
  const f = features(spec);
  const physical = rank === 2 && needsPhysical(spec);
  const m = physical ? new THREE.MeshPhysicalMaterial({ roughness: 1, metalness: 1 }) : new THREE.MeshStandardMaterial({ roughness: 1, metalness: 1 });
  if (physical) {
    const pm = m as THREE.MeshPhysicalMaterial;
    if (f.coat) pm.clearcoat = 1;
    if (f.fuzz) { pm.sheen = 1; pm.sheenColor = new THREE.Color(1, 1, 1); pm.sheenRoughness = 0.8; }
    if (f.film) { pm.iridescence = 1; pm.iridescenceThicknessRange = [100, 1200]; }
    if (f.aniso) { pm.anisotropy = 1; pm.anisotropyRotation = spec.base.aniso?.axis === 'v' ? Math.PI / 2 : 0; }
  }
  const uniforms = {
    msNoise: { value: noiseTex() },
    msRamps: { value: p.ramps },
    msTiles: { value: p.tiles },
    msSurf: { value: p.surf },
    msIn: { value: p.inputs },
    msMask: { value: p.masks },
    msLayer: { value: p.layers },
    msAge: { value: spec.age },
    msBump: { value: 1.0 },
    msMaskView: { value: -1 },
  };
  m.userData.matstack = { spec, rank } satisfies LayeredInfo;
  m.userData.msUniforms = uniforms;
  m.defines = { MS_LAYERS: p.count, MS_LAYERS_N: Math.max(1, p.count), MS_TILES: p.tiles ? 1 : 0 };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = swap(shader.vertexShader, '#include <common>', VERT_PARS);
    shader.vertexShader = swap(shader.vertexShader, '#include <begin_vertex>', VERT_MAIN);
    let fs = shader.fragmentShader;
    fs = swap(fs, '#include <common>', FRAG_PARS);
    fs = swap(fs, '#include <color_fragment>', 'MsCh msC = msEval();\ndiffuseColor.rgb = msC.colour;');
    fs = swap(fs, '#include <roughnessmap_fragment>', 'roughnessFactor = msC.rough;');
    fs = swap(fs, '#include <metalnessmap_fragment>', 'metalnessFactor = msC.metal;');
    fs = swap(fs, '#include <normal_fragment_maps>', 'normal = msPerturb(-vViewPosition, normal, vec2(dFdx(msC.height), dFdy(msC.height)) * msBump, faceDirection);');
    fs = swap(fs, '#include <emissivemap_fragment>', 'totalEmissiveRadiance += msC.emit;');
    if (physical) {
      // the physical model's own inputs, per pixel: specular level, coat, fuzz, film and brushing
      const chunk = THREE.ShaderChunk.lights_physical_fragment
        .replace('float specularIntensityFactor = specularIntensity;', 'float specularIntensityFactor = specularIntensity * msC.spec * 2.0;')
        .replace('vec2 anisotropyV = anisotropyVector;', 'vec2 anisotropyV = anisotropyVector * msC.aniso;');
      fs = fs.replace('#include <lights_physical_fragment>', `${chunk}
#ifdef USE_CLEARCOAT
  material.clearcoat = msC.coat;
  material.clearcoatRoughness = min(max(msC.coatRough, 0.0525) + geometryRoughness, 1.0);
#endif
#ifdef USE_SHEEN
  material.sheenColor = msC.fuzzColour * msC.fuzz;
#endif
#ifdef USE_IRIDESCENCE
  material.iridescence = msC.film;
  material.iridescenceThickness = msC.filmThick;
#endif`);
    }
    fs = swap(fs, '#include <dithering_fragment>', 'if (msMaskView >= 0) gl_FragColor = vec4(vec3(msViewValue), 1.0);');
    shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => `matstack${rank}|${physical ? 'p' : 's'}|L${p.count}|t${p.tiles ? 1 : 0}`;
  return m;
}

/** A material spec at a rank, with a reflection of its own where the scene has none (cached by the spec's JSON and the reflection). */
export function materialForSpec(spec: MaterialSpec, rank: MatRank, env?: LayeredEnv): THREE.Material {
  const key = `${rank}|${env ? `${env.map.uuid}@${env.intensity}` : '-'}|${JSON.stringify(spec)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = rank === 0 ? flatMaterial(spec) : layeredShaderMaterial(spec, rank);
  m.name = `matstack:${spec.name}`;
  if (env) {
    const sm = m as THREE.MeshStandardMaterial;
    sm.envMap = env.map;
    sm.envMapIntensity = env.intensity;
  }
  cache.set(key, m);
  return m;
}

/** The material for a `mat:<id>` (shelf) or `matc:<code>` (a player's own) name at a rank, a neutral stand-in when it does not resolve, or null for any other name. */
export function layeredMaterial(name: string, rank: MatRank, env?: LayeredEnv): THREE.Material | null {
  if (!isLayeredName(name)) return null;
  const spec = specOfName(name);
  return spec ? materialForSpec(spec, rank, env) : fallback(name);
}

/** Drops the materials made for a reflection that is going away (a closed preview), so the cache does not keep them. */
export function releaseLayeredEnv(env: LayeredEnv): void {
  const tag = `|${env.map.uuid}@`;
  for (const [key, m] of cache) {
    if (!key.includes(tag)) continue;
    m.dispose();
    cache.delete(key);
  }
}

/** Builds the shared noise atlas now (about 0.2 s), so the first layered material never builds it mid-play. */
export function warmLayeredMaterials(): void {
  noiseAtlas();
  noiseTex();
}

/** Shows one layer's weight in black and white (the bench's mask view), or the material again with -1. */
export function setMaskView(material: THREE.Material, layer: number): void {
  const u = material.userData.msUniforms as { msMaskView: { value: number } } | undefined;
  if (u) u.msMaskView.value = layer;
}

// ------------------------------------------------------------------ geometry

const floats = (a: THREE.BufferAttribute): Float32Array => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return out;
};
const indicesOf = (g: THREE.BufferGeometry): Uint32Array => {
  const index = g.getIndex();
  const count = (g.getAttribute('position') as THREE.BufferAttribute).count;
  return index ? Uint32Array.from(index.array as ArrayLike<number>) : Uint32Array.from({ length: count }, (_, i) => i);
};

/** Mask templates by part shape (kit-build's key): parts are placed rigidly, so their edge distances never change. */
const templates = new Map<string, THREE.BufferGeometry>();
const MAX_TEMPLATES = 1024;

/**
 * The local step of kit-build's layering hook: a geometry about to wear a layered material, in its part's own frame,
 * gets its edge and crease lines (aEdge, aCavity; 'lines' meshes get their own vertices per triangle). Computed once per
 * part shape and cloned after; the given geometry is disposed. Any other material: the geometry as it is.
 */
function localLayering(g: THREE.BufferGeometry, material: THREE.Material, key: string): THREE.BufferGeometry {
  if (!material.userData.matstack) return g;
  const hit = templates.get(key);
  if (hit) {
    g.dispose();
    return hit.clone();
  }
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const mm = maskAttributes({ positions: floats(pos), indices: indicesOf(g), ...(nor ? { normals: floats(nor) } : {}), ...(uv ? { uvs: floats(uv) } : {}) });
  const t = new THREE.BufferGeometry();
  t.setAttribute('position', new THREE.BufferAttribute(mm.positions, 3));
  t.setAttribute('normal', new THREE.BufferAttribute(mm.normals, 3));
  t.setAttribute('uv', new THREE.BufferAttribute(mm.uvs, 2));
  t.setAttribute('aEdge', new THREE.BufferAttribute(mm.edge, 4));
  t.setAttribute('aCavity', new THREE.BufferAttribute(mm.cavity, 4));
  t.setIndex(new THREE.BufferAttribute(mm.indices, 1));
  t.userData.maskKind = mm.kind;
  if (templates.size >= MAX_TEMPLATES) {
    const oldest = templates.keys().next().value as string;
    templates.get(oldest)?.dispose();
    templates.delete(oldest);
  }
  templates.set(key, t);
  g.dispose();
  return t.clone();
}

/**
 * The placed step: at rank 0 the material is flattened per face, where the part stands (its height above the foot and
 * its facing count), into vertex colours and aRM, and the edge lines go (rank 0 draws no layers). Ranks 1 and 2, and
 * other materials: the geometry as it is.
 */
function placedLayering(g: THREE.BufferGeometry, material: THREE.Material): THREE.BufferGeometry {
  const info = material.userData.matstack as LayeredInfo | undefined;
  if (!info || info.rank !== 0) return g;
  const attr = (n: string): Float32Array => floats(g.getAttribute(n) as THREE.BufferAttribute);
  const mesh: MaskMesh = {
    kind: (g.userData.maskKind as MaskMesh['kind'] | undefined) ?? 'lines',
    positions: attr('position'),
    normals: attr('normal'),
    uvs: attr('uv'),
    indices: indicesOf(g),
    slots: [],
    edge: attr('aEdge'),
    cavity: attr('aCavity'),
  };
  const f = flattenMesh(info.spec, mesh, cpuTiles, cpuNoise);
  const rm = new Float32Array(f.rough.length * 2);
  for (let i = 0; i < f.rough.length; i++) { rm[i * 2] = f.rough[i]!; rm[i * 2 + 1] = f.metal[i]!; }
  g.setAttribute('color', new THREE.BufferAttribute(f.colour, 3));
  g.setAttribute('aRM', new THREE.BufferAttribute(rm, 2));
  g.deleteAttribute('aEdge');
  g.deleteAttribute('aCavity');
  return g;
}

/** kit-build's `layering` option for layered materials (`mat:` names). */
export const kitLayering = { local: localLayering, placed: placedLayering } as const;
