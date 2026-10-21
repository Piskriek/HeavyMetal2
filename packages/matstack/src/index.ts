/**
 * @hm/matstack (plan 41): layered materials, the Pxd factory's presets.
 *
 * A material is a base surface, two paint colours, an age and up to six layers; a layer is a surface placed by a mask.
 * Every level is plain JSON with slider schemas, so the bench, the Studio and an agent edit it the same way.
 *
 * Pure and deterministic (constitution 2): no DOM, clock or randomness. Tiles and noise come in through two small
 * interfaces, so the package needs no textures. The renderer's shader (apps/web/src/play/layered-material.ts) evaluates
 * the same formulas per pixel; this file is the reference, and its tests are the oracle both are held to.
 *
 * Conventions:
 *  - lengths in metres, angles in degrees, colours '#rrggbb' sRGB in specs and linear RGB in Channels;
 *  - a part's object space is y-up with its origin at the machine's foot, so `pos[1]` is the height above the ground;
 *  - `uv` is the part's metric box UV (one unit per metre), the same attribute the kit builder writes;
 *  - `layers` run bottom to top (the UI lists them top first).
 */

import { EDGE_BAND, MAX_LAYERS, MAX_MASK_INPUTS } from './constants';
import { EDGE_LINES, lineDistance, type MaskMesh } from './mask-mesh';
export { EDGE_BAND, MAX_LAYERS, MAX_MASK_INPUTS, MAX_RAMP_STOPS } from './constants';
export * from './mask-mesh';
export * from './shelf';

// ------------------------------------------------------------------ specs

export type V3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];

/** Paint references a surface can use as its colour: the material's first and second paint. */
export const PAINT_REFS = ['paint1', 'paint2'] as const;
export type PaintRef = (typeof PAINT_REFS)[number];
/** '#rrggbb' (sRGB), or a paint reference. */
export type ColourRef = string;

export interface RampStop {
  /** Where on the tile's grey value (0 to 1) this colour sits. */
  readonly at: number;
  readonly colour: string;
}

export interface TileUse {
  /** A tile the TileSource knows (a texgraph preset or vault cartridge id). Unknown tiles read as flat. */
  readonly tile: string;
  /** Metres per repeat. */
  readonly scale: number;
  /** Height = 0.5 + (tile height - 0.5) * bump: 0 is flat, 1 the tile's full relief. */
  readonly bump: number;
  /** Roughness += roughVar * (tile roughness - 0.5) * 2. */
  readonly roughVar: number;
}

/** One look's channels (plan 41 section 4.2). Optional sections are off when absent. */
export interface SurfaceSpec {
  readonly name: string;
  readonly colour: ColourRef;
  /** A gradient map over the tile's grey value; when present (2 stops or more) it replaces `colour`. */
  readonly ramp?: readonly RampStop[];
  readonly metal: number;
  readonly rough: number;
  /** Specular level for non-metals, 0 to 1 (0.5 is the usual 4% reflectance). */
  readonly specular: number;
  /** The main tile. `colourVar` scales the colour by 1 + colourVar * (grey - 0.5) * 2 (not with a ramp). */
  readonly tile?: TileUse & { readonly colourVar: number };
  /** A second, small tile for fine relief and roughness (casting pits, orange peel). */
  readonly detail?: TileUse;
  /** A clear coat: enamel, oil film, sealant. */
  readonly coat?: { readonly amount: number; readonly rough: number };
  /** Micro-fibre sheen: dust, moss, regolith. */
  readonly fuzz?: { readonly amount: number; readonly colour: string };
  /** Brushed metal. The axis is the base surface's only (a material has one brush direction). */
  readonly aniso?: { readonly amount: number; readonly axis: 'u' | 'v' };
  /** Thin-film interference: heat tint, oil sheen. Thickness in nanometres. */
  readonly film?: { readonly amount: number; readonly thickness: number };
  /** Emission: colour times intensity. */
  readonly emit?: { readonly colour: string; readonly intensity: number };
}

export const NOISE_KINDS = ['clouds', 'cells', 'speckle', 'scratches'] as const;
export type NoiseKind = (typeof NOISE_KINDS)[number];

export const BLEND_MODES = ['normal', 'add', 'subtract', 'multiply', 'max', 'min'] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

interface InputBase {
  readonly blend: BlendMode;
  readonly opacity: number;
  /** Inverts this input's value before it is blended. */
  readonly invert: boolean;
}

/** One input of a mask (plan 41 section 4.3). */
export type MaskInput =
  | (InputBase & { readonly kind: 'all' })
  /** Within `width` metres of a sharp convex edge (edge) or a concave crease (cavity); at most EDGE_BAND. */
  | (InputBase & { readonly kind: 'edge' | 'cavity'; readonly width: number })
  /** Faces turned up (or down) within `angle` degrees of straight up (down), fading over `soft` degrees. */
  | (InputBase & { readonly kind: 'up' | 'down'; readonly angle: number; readonly soft: number })
  /** Below `height` metres above the machine's foot, fading over `soft` metres. */
  | (InputBase & { readonly kind: 'ground'; readonly height: number; readonly soft: number })
  /** A noise sampled on the box UV, one repeat per `scale` metres, shifted by `seed`. */
  | (InputBase & { readonly kind: 'noise'; readonly noise: NoiseKind; readonly scale: number; readonly seed: number })
  /** Clouds stretched `stretch` times along gravity on side faces: runs and leaks. Zero on flat tops and bottoms. */
  | (InputBase & { readonly kind: 'streaks'; readonly scale: number; readonly stretch: number; readonly seed: number });

export type MaskInputKind = MaskInput['kind'];

export interface MaskSpec {
  readonly name: string;
  /** Folded in order from 0 (1 to MAX_MASK_INPUTS of them). */
  readonly inputs: readonly MaskInput[];
  /** -1 to 1: more of the mask shows as it rises. */
  readonly balance: number;
  /** 0 to 1: 1 is a hard threshold. */
  readonly contrast: number;
  readonly invert: boolean;
}

export const CHANNEL_GROUPS = ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'fuzz', 'aniso', 'film', 'emit'] as const;
export type ChannelGroup = (typeof CHANNEL_GROUPS)[number];

export interface LayerSpec {
  readonly name: string;
  readonly surface: SurfaceSpec;
  readonly mask: MaskSpec;
  readonly opacity: number;
  /** The channels this layer writes; the rest show through from below. */
  readonly writes: readonly ChannelGroup[];
  /** 0 to 1: how much the layer's own tile height steers its edge (rust grows from the pits first). */
  readonly heightBlend: number;
  /** Weathering layers grow with the material's age. */
  readonly weathering: boolean;
  /** The eye toggle. */
  readonly visible: boolean;
}

export interface MaterialSpec {
  readonly name: string;
  readonly base: SurfaceSpec;
  readonly paint: readonly [string, string];
  /** Bottom to top, at most MAX_LAYERS. */
  readonly layers: readonly LayerSpec[];
  /** 0 pristine to 1 fully weathered: weathering layers spread from where their mask is strongest. */
  readonly age: number;
}


// ---------------------------------------------------------------- sources

/** A tile's value at a point, each 0 to 1. */
export interface TileSample {
  readonly grey: number;
  readonly height: number;
  readonly rough: number;
}

/** Tiles by id, sampled with wrapping at (u, v) in repeats. Returns FLAT_TILE for an unknown id. */
export interface TileSource {
  sample(tile: string, u: number, v: number): TileSample;
}

/** The shared noise atlas, sampled with wrapping at (u, v) in repeats; 0 to 1. */
export interface NoiseSource {
  sample(kind: NoiseKind, u: number, v: number): number;
}

export const FLAT_TILE: TileSample = { grey: 0.5, height: 0.5, rough: 0.5 };

/** What a mask can read at one point of a part. */
export interface SamplePoint {
  /** The part's metric box UV. */
  readonly uv: readonly [number, number];
  /** Object space, metres; y is the height above the machine's foot. */
  readonly pos: V3;
  /** Object-space unit normal, y up. */
  readonly normal: V3;
  /** Distance to the nearest sharp convex edge in metres, EDGE_BAND or more when none is near. */
  readonly edge: number;
  /** Distance to the nearest concave crease in metres, EDGE_BAND or more when none is near. */
  readonly cavity: number;
}

/** Everything a point of a material draws with. Colours are linear RGB. */
export interface Channels {
  readonly colour: RGB;
  readonly metal: number;
  readonly rough: number;
  readonly specular: number;
  /** 0 to 1, 0.5 is the surface; the renderer bumps from its derivatives. */
  readonly height: number;
  readonly coat: number;
  readonly coatRough: number;
  readonly fuzz: number;
  readonly fuzzColour: RGB;
  readonly aniso: number;
  readonly film: number;
  readonly filmThickness: number;
  /** Colour times intensity. */
  readonly emit: RGB;
}

// ------------------------------------------------------------------ maths (GLSL's, exactly)

export const clamp01 = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x);
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const fract = (x: number): number => x - Math.floor(x);

/** GLSL smoothstep. Callers keep e1 > e0. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** The sRGB transfer function, to linear (three.js's SRGBToLinear). */
export function srgbToLinear(c: number): number {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const isHex = (s: string): boolean => HEX_RE.test(s);

/** '#rrggbb' to linear RGB; anything else reads as mid grey (#808080). */
export function hexToLinear(hex: string): RGB {
  const h = isHex(hex) ? hex : '#808080';
  const n = parseInt(h.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}

/** A colour reference resolved against the material's paint. */
export function resolveColour(ref: ColourRef, paint: readonly [string, string]): RGB {
  if (ref === 'paint1') return hexToLinear(paint[0]);
  if (ref === 'paint2') return hexToLinear(paint[1]);
  return hexToLinear(ref);
}

/** A seed as a UV shift: (fract(seed * 0.618034), fract(seed * 0.414214)). */
export function seedOffset(seed: number): readonly [number, number] {
  return [fract(seed * 0.618034), fract(seed * 0.414214)];
}

/** The ramp's colour at x, interpolated in linear RGB between the stops either side (stops sorted by `at`). */
export function rampAt(stops: readonly RampStop[], x: number): RGB {
  const s = [...stops].sort((a, b) => a.at - b.at);
  const first = s[0];
  if (!first) return hexToLinear('#808080');
  if (x <= first.at) return hexToLinear(first.colour);
  for (let i = 1; i < s.length; i += 1) {
    const b = s[i]!;
    if (x <= b.at) {
      const a = s[i - 1]!;
      const t = b.at > a.at ? (x - a.at) / (b.at - a.at) : 1;
      const ca = hexToLinear(a.colour), cb = hexToLinear(b.colour);
      return [mix(ca[0], cb[0], t), mix(ca[1], cb[1], t), mix(ca[2], cb[2], t)];
    }
  }
  return hexToLinear(s[s.length - 1]!.colour);
}

// ------------------------------------------------------------------ masks

const DEG = 180 / Math.PI;
const MIN_SOFT_DEG = 0.5;
const MIN_SOFT_M = 0.005;
const MIN_WIDTH = 0.0005;

/**
 * One input's raw value at a point (before its invert and opacity):
 *  - all: 1;
 *  - edge / cavity: 1 - smoothstep(0, w, distance), w = clamp(width, 0.0005, EDGE_BAND);
 *  - up / down: 1 - smoothstep(angle - s, angle + s, theta), theta = acos(±normal.y) in degrees, s = max(soft, 0.5);
 *  - ground: 1 - smoothstep(height - s, height + s, pos.y), s = max(soft, 0.005);
 *  - noise: sample(kind, uv / scale + seedOffset(seed));
 *  - streaks: on side faces, the horizontal tangent t = (n.z, -n.x) / L with L = |normal.xz|, then
 *    clouds(u = (pos.x * t.x + pos.z * t.y) / scale, v = pos.y / (scale * stretch)) + seedOffset(seed), times L;
 *    0 when L < 0.001.
 */
export function inputValue(input: MaskInput, p: SamplePoint, noise: NoiseSource): number {
  switch (input.kind) {
    case 'all':
      return 1;
    case 'edge':
    case 'cavity': {
      const w = Math.min(EDGE_BAND, Math.max(MIN_WIDTH, input.width));
      return 1 - smoothstep(0, w, input.kind === 'edge' ? p.edge : p.cavity);
    }
    case 'up':
    case 'down': {
      const ny = input.kind === 'up' ? p.normal[1] : -p.normal[1];
      const theta = Math.acos(Math.max(-1, Math.min(1, ny))) * DEG;
      const s = Math.max(MIN_SOFT_DEG, input.soft);
      return 1 - smoothstep(input.angle - s, input.angle + s, theta);
    }
    case 'ground': {
      const s = Math.max(MIN_SOFT_M, input.soft);
      return 1 - smoothstep(input.height - s, input.height + s, p.pos[1]);
    }
    case 'noise': {
      const o = seedOffset(input.seed);
      const sc = Math.max(1e-3, input.scale);
      return clamp01(noise.sample(input.noise, p.uv[0] / sc + o[0], p.uv[1] / sc + o[1]));
    }
    case 'streaks': {
      const L = Math.hypot(p.normal[0], p.normal[2]);
      if (L < 1e-3) return 0;
      const tx = p.normal[2] / L, tz = -p.normal[0] / L;
      const o = seedOffset(input.seed);
      const sc = Math.max(1e-3, input.scale);
      const u = (p.pos[0] * tx + p.pos[2] * tz) / sc + o[0];
      const v = p.pos[1] / (sc * Math.max(1, input.stretch)) + o[1];
      return clamp01(noise.sample('clouds', u, v)) * L;
    }
  }
}

/**
 * Blends one input's value v (after its invert) into the running mask with opacity o, then clamps to 0..1:
 * normal mix(acc, v, o); add acc + o v; subtract acc - o v; multiply acc * mix(1, v, o); max max(acc, o v);
 * min min(acc, mix(1, v, o)).
 */
export function blendInput(mode: BlendMode, acc: number, v: number, o: number): number {
  switch (mode) {
    case 'normal': return clamp01(mix(acc, v, o));
    case 'add': return clamp01(acc + o * v);
    case 'subtract': return clamp01(acc - o * v);
    case 'multiply': return clamp01(acc * mix(1, v, o));
    case 'max': return clamp01(Math.max(acc, o * v));
    case 'min': return clamp01(Math.min(acc, mix(1, v, o)));
  }
}

/**
 * Balance and contrast: centre c = 0.5 - balance / 2, half width h = max(0.01, (1 - contrast) / 2),
 * m = clamp01((acc - c) / (2 h) + 0.5). Balance 0 and contrast 0 leave the mask as it is.
 */
export function levels(acc: number, balance: number, contrast: number): number {
  const c = 0.5 - balance * 0.5;
  const h = Math.max(0.01, (1 - contrast) * 0.5);
  return clamp01((acc - c) / (2 * h) + 0.5);
}

/** The mask at a point: the inputs folded from 0 in order, then levels, then the mask's invert. */
export function maskAt(mask: MaskSpec, p: SamplePoint, noise: NoiseSource): number {
  let acc = 0;
  for (const input of mask.inputs.slice(0, MAX_MASK_INPUTS)) {
    const raw = inputValue(input, p, noise);
    acc = blendInput(input.blend, acc, input.invert ? 1 - raw : raw, clamp01(input.opacity));
  }
  const m = levels(acc, mask.balance, mask.contrast);
  return mask.invert ? 1 - m : m;
}

// ------------------------------------------------------------------ surfaces

const sampleTile = (tiles: TileSource, use: TileUse, uv: readonly [number, number]): TileSample => {
  const sc = Math.max(1e-3, use.scale);
  return tiles.sample(use.tile, uv[0] / sc, uv[1] / sc);
};

/**
 * A surface's channels at a point:
 *  - t = the main tile at uv / scale (FLAT_TILE without one);
 *  - colour: the ramp at t.grey when it has 2 stops or more; else the colour reference, times
 *    1 + colourVar * (t.grey - 0.5) * 2 when there is a tile, clamped to 0..1;
 *  - roughness: rough + roughVar * (t.rough - 0.5) * 2, plus the detail tile's own term;
 *  - height: 0.5 + (t.height - 0.5) * bump, plus (detail height - 0.5) * detail bump; both clamped to 0..1;
 *  - the optional sections, or their off values (coat roughness 0.1, film thickness 400 nm, black fuzz and emission).
 */
export function surfaceAt(s: SurfaceSpec, p: SamplePoint, paint: readonly [string, string], tiles: TileSource): Channels {
  const t = s.tile ? sampleTile(tiles, s.tile, p.uv) : FLAT_TILE;
  let colour: RGB;
  if (s.ramp && s.ramp.length >= 2) {
    colour = rampAt(s.ramp, t.grey);
  } else {
    const c = resolveColour(s.colour, paint);
    const k = s.tile ? 1 + s.tile.colourVar * (t.grey - 0.5) * 2 : 1;
    colour = [clamp01(c[0] * k), clamp01(c[1] * k), clamp01(c[2] * k)];
  }
  let rough = s.rough + (s.tile ? s.tile.roughVar * (t.rough - 0.5) * 2 : 0);
  let height = 0.5 + (s.tile ? (t.height - 0.5) * s.tile.bump : 0);
  if (s.detail) {
    const d = sampleTile(tiles, s.detail, p.uv);
    rough += s.detail.roughVar * (d.rough - 0.5) * 2;
    height += (d.height - 0.5) * s.detail.bump;
  }
  const emit = s.emit ? hexToLinear(s.emit.colour) : ([0, 0, 0] as const);
  const ei = s.emit ? Math.max(0, s.emit.intensity) : 0;
  return {
    colour,
    metal: clamp01(s.metal),
    rough: clamp01(rough),
    specular: clamp01(s.specular),
    height: clamp01(height),
    coat: clamp01(s.coat?.amount ?? 0),
    coatRough: clamp01(s.coat?.rough ?? 0.1),
    fuzz: clamp01(s.fuzz?.amount ?? 0),
    fuzzColour: s.fuzz ? hexToLinear(s.fuzz.colour) : [0, 0, 0],
    aniso: clamp01(s.aniso?.amount ?? 0),
    film: clamp01(s.film?.amount ?? 0),
    filmThickness: s.film?.thickness ?? 400,
    emit: [emit[0] * ei, emit[1] * ei, emit[2] * ei],
  };
}

// ------------------------------------------------------------------ layers and materials

/**
 * A layer's weight at a point, given its own surface's height there:
 *  1. m = the mask;
 *  2. height blend hb > 0: m = clamp01((m - 0.5) * (1 + 4 hb) + (height - 0.5) * 2 hb + 0.5);
 *  3. weathering: m = age <= 0 ? 0 : clamp01((m + age - 1) / age), so it spreads from the strongest mask as age rises;
 *  4. times opacity; 0 when hidden.
 */
export function layerWeight(layer: LayerSpec, surfaceHeight: number, p: SamplePoint, age: number, noise: NoiseSource): number {
  if (!layer.visible) return 0;
  const o = clamp01(layer.opacity);
  if (o <= 0) return 0;
  let m = maskAt(layer.mask, p, noise);
  const hb = clamp01(layer.heightBlend);
  if (hb > 0) m = clamp01((m - 0.5) * (1 + 4 * hb) + (surfaceHeight - 0.5) * 2 * hb + 0.5);
  if (layer.weathering) {
    const a = clamp01(age);
    m = a <= 0 ? 0 : clamp01((m + a - 1) / a);
  }
  return m * o;
}

const mix3 = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** `below` with a layer's surface mixed over it by weight w, in the channel groups the layer writes. */
export function blendChannels(below: Channels, over: Channels, w: number, writes: readonly ChannelGroup[]): Channels {
  if (w <= 0) return below;
  const has = (g: ChannelGroup): boolean => writes.includes(g);
  return {
    colour: has('colour') ? mix3(below.colour, over.colour, w) : below.colour,
    metal: has('metal') ? mix(below.metal, over.metal, w) : below.metal,
    rough: has('rough') ? mix(below.rough, over.rough, w) : below.rough,
    specular: has('specular') ? mix(below.specular, over.specular, w) : below.specular,
    height: has('height') ? mix(below.height, over.height, w) : below.height,
    coat: has('coat') ? mix(below.coat, over.coat, w) : below.coat,
    coatRough: has('coat') ? mix(below.coatRough, over.coatRough, w) : below.coatRough,
    fuzz: has('fuzz') ? mix(below.fuzz, over.fuzz, w) : below.fuzz,
    fuzzColour: has('fuzz') ? mix3(below.fuzzColour, over.fuzzColour, w) : below.fuzzColour,
    aniso: has('aniso') ? mix(below.aniso, over.aniso, w) : below.aniso,
    film: has('film') ? mix(below.film, over.film, w) : below.film,
    filmThickness: has('film') ? mix(below.filmThickness, over.filmThickness, w) : below.filmThickness,
    emit: has('emit') ? mix3(below.emit, over.emit, w) : below.emit,
  };
}

/** The material at a point: the base surface, then each layer bottom to top. */
export function materialAt(m: MaterialSpec, p: SamplePoint, tiles: TileSource, noise: NoiseSource): Channels {
  let out = surfaceAt(m.base, p, m.paint, tiles);
  for (const layer of m.layers.slice(0, MAX_LAYERS)) {
    if (!layer.visible) continue;
    const s = surfaceAt(layer.surface, p, m.paint, tiles);
    out = blendChannels(out, s, layerWeight(layer, s.height, p, m.age, noise), layer.writes);
  }
  return out;
}

/**
 * The material evaluated at each of the given points. Colour is linear RGB, 3 per point. Rank 0 uses it through
 * `flattenMesh`; dense meshes flatten per vertex, faceted ones per face.
 */
export function flatten(
  m: MaterialSpec,
  points: readonly SamplePoint[],
  tiles: TileSource,
  noise: NoiseSource,
): { readonly colour: Float32Array; readonly rough: Float32Array; readonly metal: Float32Array } {
  const colour = new Float32Array(points.length * 3);
  const rough = new Float32Array(points.length);
  const metal = new Float32Array(points.length);
  points.forEach((p, i) => {
    const c = materialAt(m, p, tiles, noise);
    colour[i * 3] = c.colour[0];
    colour[i * 3 + 1] = c.colour[1];
    colour[i * 3 + 2] = c.colour[2];
    rough[i] = c.rough;
    metal[i] = c.metal;
  });
  return { colour, rough, metal };
}

/** Barycentric weights of the 10 interior points of a sixth grid: where a face is sampled to flatten it. */
const FACE_SAMPLES: readonly (readonly [number, number, number])[] = (() => {
  const out: [number, number, number][] = [];
  for (let i = 1; i <= 4; i++) for (let j = 1; i + j <= 5; j++) out.push([i / 6, j / 6, (6 - i - j) / 6]);
  return out;
})();

/** The point at barycentric weights w of triangle (a, b, c) of a mask mesh, with every attribute interpolated. */
export function meshPoint(mesh: MaskMesh, a: number, b: number, c: number, w: readonly [number, number, number]): SamplePoint {
  const lerp = (arr: ArrayLike<number>, stride: number, k: number): number =>
    arr[a * stride + k]! * w[0] + arr[b * stride + k]! * w[1] + arr[c * stride + k]! * w[2];
  const lines = (arr: Float32Array): number[] => Array.from({ length: EDGE_LINES }, (_, k) => lerp(arr, EDGE_LINES, k));
  const n: [number, number, number] = [lerp(mesh.normals, 3, 0), lerp(mesh.normals, 3, 1), lerp(mesh.normals, 3, 2)];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return {
    uv: [lerp(mesh.uvs, 2, 0), lerp(mesh.uvs, 2, 1)],
    pos: [lerp(mesh.positions, 3, 0), lerp(mesh.positions, 3, 1), lerp(mesh.positions, 3, 2)],
    normal: [n[0] / l, n[1] / l, n[2] / l],
    edge: lineDistance(lines(mesh.edge)),
    cavity: lineDistance(lines(mesh.cavity)),
  };
}

/**
 * Rank 0 for a whole mask mesh (plan 41 section 4.5), as colour (linear RGB), roughness and metal per vertex:
 *  - 'lines' meshes: one flat value per face, the mean of the material at 10 interior points. Every corner of a faceted
 *    part sits on an edge, so per-vertex values would read as all wear; per face, a big panel reads clean and a thin
 *    chamfer reads worn, as a crisp bevel (the stage 0b and 1 look);
 *  - 'curvature' meshes: per vertex.
 */
export function flattenMesh(
  m: MaterialSpec,
  mesh: MaskMesh,
  tiles: TileSource,
  noise: NoiseSource,
): { readonly colour: Float32Array; readonly rough: Float32Array; readonly metal: Float32Array } {
  const count = mesh.positions.length / 3;
  if (mesh.kind === 'curvature') {
    const points = Array.from({ length: count }, (_, i) => meshPoint(mesh, i, i, i, [1, 0, 0]));
    return flatten(m, points, tiles, noise);
  }
  const colour = new Float32Array(count * 3), rough = new Float32Array(count), metal = new Float32Array(count);
  for (let t = 0; t + 2 < mesh.indices.length; t += 3) {
    const a = mesh.indices[t]!, b = mesh.indices[t + 1]!, c = mesh.indices[t + 2]!;
    let r = 0, g = 0, bl = 0, ro = 0, me = 0;
    for (const w of FACE_SAMPLES) {
      const ch = materialAt(m, meshPoint(mesh, a, b, c, w), tiles, noise);
      r += ch.colour[0]; g += ch.colour[1]; bl += ch.colour[2]; ro += ch.rough; me += ch.metal;
    }
    const k = 1 / FACE_SAMPLES.length;
    for (const v of [a, b, c]) {
      colour[v * 3] = r * k; colour[v * 3 + 1] = g * k; colour[v * 3 + 2] = bl * k;
      rough[v] = ro * k; metal[v] = me * k;
    }
  }
  return { colour, rough, metal };
}

// ------------------------------------------------------------------ shader features

/** What a material needs from the shader: the program cache key's parts. Hidden layers do not count. */
export interface MaterialFeatures {
  readonly layers: number;
  readonly tiles: boolean;
  readonly detail: boolean;
  readonly ramp: boolean;
  readonly coat: boolean;
  readonly fuzz: boolean;
  readonly aniso: boolean;
  readonly film: boolean;
  readonly emit: boolean;
}

export function features(m: MaterialSpec): MaterialFeatures {
  const layers = m.layers.slice(0, MAX_LAYERS).filter((l) => l.visible);
  const surfaces = [m.base, ...layers.map((l) => l.surface)];
  const any = (f: (s: SurfaceSpec) => boolean): boolean => surfaces.some(f);
  return {
    layers: layers.length,
    tiles: any((s) => !!s.tile),
    detail: any((s) => !!s.detail),
    ramp: any((s) => (s.ramp?.length ?? 0) >= 2),
    coat: any((s) => (s.coat?.amount ?? 0) > 0),
    fuzz: any((s) => (s.fuzz?.amount ?? 0) > 0),
    aniso: any((s) => (s.aniso?.amount ?? 0) > 0),
    film: any((s) => (s.film?.amount ?? 0) > 0),
    emit: any((s) => (s.emit?.intensity ?? 0) > 0),
  };
}

/** The features as a short stable key, for the shader's program cache: 'L3 t d r c f a i e'. */
export function featureKey(f: MaterialFeatures): string {
  const flags: [boolean, string][] = [[f.tiles, 't'], [f.detail, 'd'], [f.ramp, 'r'], [f.coat, 'c'], [f.fuzz, 'f'], [f.aniso, 'a'], [f.film, 'i'], [f.emit, 'e']];
  return [`L${f.layers}`, ...flags.filter(([on]) => on).map(([, k]) => k)].join(' ');
}
