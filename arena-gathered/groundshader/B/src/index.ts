/**
 * Desolate-planet ground: six procedurally generated ground materials in a
 * texture array, blended per vertex, sampled triplanar + height-blended, and
 * drawn through a six step "resolution ladder" that only ever changes uniforms.
 *
 * Stage 1 is the same ground as stage 6: chunky world-aligned texels, a few
 * colour levels and flat diffuse light (a 1990s console), stage 6 is the full
 * normal-mapped, roughness-correct, triplanar, de-tiled version.
 *
 * No DOM, no Date, no Math.random: everything comes from a seeded integer hash.
 */

import * as THREE from 'three';

/* -------------------------------------------------------------------------- */
/* constants                                                                   */
/* -------------------------------------------------------------------------- */

export const MATERIALS = ['rock', 'scree', 'gravel', 'dust', 'cracked', 'redsoil'] as const;
export type MaterialName = (typeof MATERIALS)[number];

/** Metres of ground one tile covers, per material (MATERIALS order). */
const METRES: readonly number[] = [6, 3, 2, 4, 8, 2.5];

/** Peak-to-trough relief of each tile's height channel, in metres. */
const RELIEF: readonly number[] = [0.12, 0.17, 0.05, 0.018, 0.05, 0.04];

/** Mean linear albedo each tile is balanced to (keeps the family readable). */
const TARGET: readonly (readonly [number, number, number])[] = [
  [0.105, 0.1, 0.092], // rock     grey-brown stone
  [0.118, 0.112, 0.101], // scree    loose grey-brown stones
  [0.15, 0.138, 0.118], // gravel   warm grey pebbles
  [0.455, 0.408, 0.33], // dust     pale sand powder (the lightest)
  [0.3, 0.256, 0.186], // cracked  light tan mud plates
  [0.168, 0.063, 0.036], // redsoil  iron red
];

const VALID_SIZES: readonly number[] = [64, 128, 256, 512];
const TAU = Math.PI * 2;

/* -------------------------------------------------------------------------- */
/* small maths                                                                 */
/* -------------------------------------------------------------------------- */

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function clamp(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x;
}
function mixf(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
/** Works with e0 > e1 too (reversed ramp). */
function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/* -------------------------------------------------------------------------- */
/* seeded hash + periodic noise (every field below is 1x1 periodic in uv)      */
/* -------------------------------------------------------------------------- */

function hashInt(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
const INV32 = 1 / 4294967296;
function hashF(x: number, y: number, s: number): number {
  return hashInt(x, y, s) * INV32;
}

/** Value noise on a torus: lattice indices wrap at `p`, so the tile is seamless. */
function vnoise(x: number, y: number, p: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  let x0 = xi % p;
  if (x0 < 0) x0 += p;
  let y0 = yi % p;
  if (y0 < 0) y0 += p;
  const x1 = x0 + 1 >= p ? 0 : x0 + 1;
  const y1 = y0 + 1 >= p ? 0 : y0 + 1;
  const a = hashF(x0, y0, s);
  const b = hashF(x1, y0, s);
  const c = hashF(x0, y1, s);
  const d = hashF(x1, y1, s);
  const ab = a + (b - a) * u;
  const cd = c + (d - c) * u;
  return ab + (cd - ab) * v;
}

/** Fractal value noise over uv in [0,1): base period `p` cells, `oct` octaves. */
function fbm(x: number, y: number, p: number, oct: number, s: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    const pp = p * f;
    sum += amp * vnoise(x * pp, y * pp, pp, s + i * 1013);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/* Worley / cellular noise, also on a torus. Results land in these scratch
 * globals (distances in cell units) to keep the generator allocation free. */
let wF1 = 0;
let wF2 = 0;
let wId = 0;
function worley(x: number, y: number, cells: number, s: number): void {
  const px = x * cells;
  const py = y * cells;
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  let f1 = 1e9;
  let f2 = 1e9;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    const gy = cy + j;
    let my = gy % cells;
    if (my < 0) my += cells;
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i;
      let mx = gx % cells;
      if (mx < 0) mx += cells;
      const h = hashInt(mx, my, s);
      const jx = (h & 1023) * (1 / 1024);
      const jy = ((h >>> 10) & 1023) * (1 / 1024);
      const dx = gx + 0.15 + jx * 0.7 - px;
      const dy = gy + 0.15 + jy * 0.7 - py;
      const d = dx * dx + dy * dy;
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = h;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  wF1 = Math.sqrt(f1);
  wF2 = Math.sqrt(f2);
  wId = id;
}

/* -------------------------------------------------------------------------- */
/* colour transfer (table driven: Math.pow per texel is far too slow)          */
/* -------------------------------------------------------------------------- */

const LIN2SRGB = new Uint8Array(1025);
for (let i = 0; i <= 1024; i++) {
  const c = i / 1024;
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  LIN2SRGB[i] = Math.round(clamp01(s) * 255);
}
const SRGB2LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB2LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function encode(c: number): number {
  const i = c <= 0 ? 0 : c >= 1 ? 1024 : (c * 1024 + 0.5) | 0;
  return LIN2SRGB[i]!;
}

/* -------------------------------------------------------------------------- */
/* the six materials: linear colour + height + roughness fields                */
/* -------------------------------------------------------------------------- */

interface Field {
  col: Float32Array; // rgb, linear
  h: Float32Array; // 0..1
  r: Float32Array; // roughness 0..1
}

function makeField(n: number): Field {
  return { col: new Float32Array(n * n * 3), h: new Float32Array(n * n), r: new Float32Array(n * n) };
}

function put(f: Field, i: number, r: number, g: number, b: number, h: number, rough: number): void {
  f.col[i * 3] = r;
  f.col[i * 3 + 1] = g;
  f.col[i * 3 + 2] = b;
  f.h[i] = clamp01(h);
  f.r[i] = clamp01(rough);
}

/** rock: layered strata, fracture cracks, a few smoother crest faces. */
function genRock(n: number, s: number, f: Field): void {
  const inv = 1 / n;
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) * inv;
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) * inv;
      const wu = u + 0.07 * (vnoise(u * 3, v * 3, 3, s + 11) - 0.5);
      const wv = v + 0.07 * (vnoise(u * 3 + 1.9, v * 3 + 0.6, 3, s + 23) - 0.5);
      const base = fbm(wu, wv, 3, 3, s + 31);
      const strata = 0.5 + 0.5 * Math.sin(TAU * (6 * wv + 2 * wu) + 2.5 * base);
      const band = strata * strata;
      worley(wu, wv, 5, s + 41);
      const crack = smoothstep(0.015, 0.11, wF2 - wF1); // 0 inside a fracture
      const grain = vnoise(u * 24, v * 24, 24, s + 51);
      const h = 0.34 + 0.3 * base + 0.2 * band + 0.08 * grain - 0.5 * (1 - crack);
      const face = smoothstep(0.55, 0.9, band); // polished bedding plane
      const lit = 0.62 + 0.78 * (0.45 * base + 0.35 * band + 0.2 * grain);
      const dark = 0.3 + 0.7 * crack;
      const warm = 1 + 0.16 * band;
      put(
        f,
        y * n + x,
        0.112 * lit * dark * warm,
        0.106 * lit * dark,
        0.098 * lit * dark * (1 - 0.12 * band),
        h,
        0.8 - 0.32 * face + 0.1 * (grain - 0.5),
      );
    }
  }
}

/** scree: angular fist- to head-sized stones over grit, high relief. */
function genScree(n: number, s: number, f: Field): void {
  const inv = 1 / n;
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) * inv;
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) * inv;
      const wu = u + 0.03 * (vnoise(u * 4, v * 4, 4, s + 7) - 0.5);
      const wv = v + 0.03 * (vnoise(u * 4 + 0.7, v * 4 + 2.1, 4, s + 9) - 0.5);
      worley(wu, wv, 11, s + 13);
      const bigD = wF1;
      const bigE = wF2 - wF1;
      const bigId = wId;
      worley(wu + 0.31, wv + 0.07, 23, s + 17);
      const smD = wF1;
      const smId = wId;
      const grit = fbm(u, v, 20, 2, s + 19);
      const rad = 0.3 + 0.16 * (((bigId >>> 7) & 255) / 255);
      const facet = smoothstep(0, 0.07, bigE); // sharp break between stones
      const hBig = smoothstep(rad, rad * 0.3, bigD) * (0.72 + 0.28 * facet);
      const hSm = smoothstep(0.4, 0.1, smD);
      const h = 0.1 + 0.14 * grit + 0.62 * hBig + 0.26 * hSm * (1 - 0.7 * hBig);
      const tone = 0.74 + 0.54 * (((bigId >>> 3) & 255) / 255);
      const toneSm = 0.78 + 0.44 * (((smId >>> 11) & 255) / 255);
      const stone = clamp01(hBig * 1.3);
      const stoneSm = clamp01(hSm * 1.1) * (1 - stone);
      let lit = mixf(0.72 + 0.5 * grit, tone, stone);
      lit = mixf(lit, toneSm, stoneSm * 0.8);
      lit *= 0.82 + 0.3 * facet;
      const warm = 1 + 0.1 * (1 - stone);
      put(
        f,
        y * n + x,
        0.126 * lit * warm,
        0.12 * lit,
        0.108 * lit * (1 - 0.06 * (1 - stone)),
        h,
        0.9 - 0.3 * stone + 0.08 * (grit - 0.5),
      );
    }
  }
}

/** gravel: small pebbles packed into dusty soil, warm grey. */
function genGravel(n: number, s: number, f: Field): void {
  const inv = 1 / n;
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) * inv;
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) * inv;
      const wu = u + 0.025 * (vnoise(u * 5, v * 5, 5, s + 3) - 0.5);
      const wv = v + 0.025 * (vnoise(u * 5 + 2.8, v * 5 + 1.3, 5, s + 5) - 0.5);
      worley(wu, wv, 19, s + 21);
      const d = wF1;
      const id = wId;
      const edge = wF2 - wF1;
      const soil = fbm(u, v, 12, 3, s + 29);
      const rad = 0.26 + 0.17 * ((id & 255) / 255);
      const peb = smoothstep(rad, rad * 0.25, d) * smoothstep(0, 0.05, edge);
      const dustFill = smoothstep(0.55, 0.15, peb);
      const h = 0.24 + 0.2 * soil + 0.52 * peb;
      const tone = 0.7 + 0.62 * (((id >>> 9) & 255) / 255);
      const lit = mixf(0.8 + 0.45 * soil, tone, clamp01(peb * 1.25));
      const warm = 1 + 0.1 * dustFill;
      put(
        f,
        y * n + x,
        0.158 * lit * warm,
        0.146 * lit,
        0.124 * lit * (1 - 0.08 * dustFill),
        h,
        0.88 - 0.26 * peb,
      );
    }
  }
}

/** dust: fine pale powder, soft wind ripples, the lightest material. */
function genDust(n: number, s: number, f: Field): void {
  const inv = 1 / n;
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) * inv;
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) * inv;
      const wu = u + 0.11 * (vnoise(u * 2, v * 2, 2, s + 3) - 0.5);
      const wv = v + 0.11 * (vnoise(u * 2 + 0.8, v * 2 + 1.7, 2, s + 5) - 0.5);
      const drift = fbm(wu, wv, 3, 2, s + 7);
      const rip = 0.5 + 0.5 * Math.sin(TAU * (3 * wu + 2 * wv) + 5.0 * drift);
      const rip2 = 0.5 + 0.5 * Math.sin(TAU * (9 * wu + 5 * wv) + 3.0 * drift);
      const fine = fbm(u, v, 16, 3, s + 9);
      const h = 0.3 + 0.3 * rip + 0.14 * rip2 + 0.2 * fine;
      const lit = 0.9 + 0.14 * (rip - 0.5) + 0.1 * (rip2 - 0.5) + 0.16 * (fine - 0.5) + 0.1 * (drift - 0.5);
      put(f, y * n + x, 0.455 * lit, 0.408 * lit, 0.33 * lit * (1 - 0.05 * rip), h, 0.95 - 0.05 * fine);
    }
  }
}

/** cracked: a dried mud flat broken into light tan polygons by dark cracks. */
function genCracked(n: number, s: number, f: Field): void {
  const inv = 1 / n;
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) * inv;
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) * inv;
      const wu = u + 0.05 * (vnoise(u * 3, v * 3, 3, s + 2) - 0.5);
      const wv = v + 0.05 * (vnoise(u * 3 + 1.1, v * 3 + 2.6, 3, s + 4) - 0.5);
      worley(wu, wv, 9, s + 6);
      const d1 = wF1;
      const e1 = wF2 - wF1;
      const id = wId;
      const width = 0.03 + 0.03 * ((id & 63) / 63);
      const crack = smoothstep(width * 0.25, width + 0.06, e1); // 0 in the crack
      worley(wu + 0.21, wv + 0.56, 21, s + 8);
      const crack2 = smoothstep(0.025, 0.12, wF2 - wF1);
      const all = Math.min(crack, 0.4 + 0.6 * crack2);
      const grain = fbm(u, v, 18, 2, s + 10);
      const curl = smoothstep(0.55, 0.05, d1); // plates sag in the middle
      const h = 0.62 - 0.16 * curl + 0.1 * grain - 0.8 * (1 - all);
      const plate = 0.88 + 0.26 * (((id >>> 13) & 255) / 255);
      const lit = plate * (0.9 + 0.2 * grain) * (0.18 + 0.82 * all) * (1 - 0.1 * curl);
      put(
        f,
        y * n + x,
        0.33 * lit,
        0.282 * lit,
        0.205 * lit * (1 - 0.06 * (1 - all)),
        h,
        0.82 + 0.14 * (1 - all) + 0.04 * (grain - 0.5),
      );
    }
  }
}

/** redsoil: iron rich rust-red soil with small dark stones. */
function genRedSoil(n: number, s: number, f: Field): void {
  const inv = 1 / n;
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) * inv;
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) * inv;
      const wu = u + 0.06 * (vnoise(u * 3, v * 3, 3, s + 1) - 0.5);
      const wv = v + 0.06 * (vnoise(u * 3 + 2.2, v * 3 + 0.9, 3, s + 2) - 0.5);
      const soil = fbm(wu, wv, 5, 3, s + 12);
      const grit = fbm(u, v, 22, 2, s + 14);
      worley(wu, wv, 16, s + 16);
      const d = wF1;
      const id = wId;
      const rad = 0.2 + 0.14 * ((id & 255) / 255);
      const stone = smoothstep(rad, rad * 0.3, d);
      const h = 0.26 + 0.3 * soil + 0.14 * grit + 0.36 * stone;
      const lit = 0.78 + 0.46 * (0.62 * soil + 0.38 * grit);
      const grey = 0.34 + 0.4 * (((id >>> 5) & 255) / 255);
      const k = clamp01(stone * 1.15);
      const r = mixf(0.185 * lit, 0.1 * grey, k);
      const g = mixf(0.069 * lit, 0.088 * grey, k);
      const b = mixf(0.04 * lit, 0.082 * grey, k);
      put(f, y * n + x, r, g, b, h, 0.92 - 0.26 * stone + 0.06 * (grit - 0.5));
    }
  }
}

const GENERATORS: readonly ((n: number, s: number, f: Field) => void)[] = [
  genRock,
  genScree,
  genGravel,
  genDust,
  genCracked,
  genRedSoil,
];

/* -------------------------------------------------------------------------- */
/* texture building                                                            */
/* -------------------------------------------------------------------------- */

export interface GroundTextures {
  /** Six layers in MATERIALS order: rgb = albedo (sRGB), a = height 0..1. */
  albedoHeight: THREE.DataArrayTexture;
  /** Six layers: rgb = tangent-space normal (0.5, 0.5, 1 is flat), a = roughness 0..1. */
  normalRough: THREE.DataArrayTexture;
  /** How many metres of ground one tile covers, per material. */
  metres: readonly number[];
  size: number;
}

/** Builds the tiles (size: 64, 128, 256 or 512 px). Deterministic for a seed. */
export function makeGroundTextures(o: { size: number; seed: number }): GroundTextures {
  const n = o.size | 0;
  if (!VALID_SIZES.includes(n)) {
    throw new RangeError(`makeGroundTextures: size must be one of ${VALID_SIZES.join(', ')}, got ${o.size}`);
  }
  const seed = Math.imul(o.seed | 0, 0x9e3779b1) | 0;
  const px = n * n;
  const ah = new Uint8Array(px * 4 * MATERIALS.length);
  const nr = new Uint8Array(px * 4 * MATERIALS.length);
  const field = makeField(n);

  for (let layer = 0; layer < MATERIALS.length; layer++) {
    const gen = GENERATORS[layer]!;
    gen(n, (seed ^ Math.imul(layer + 1, 0x7feb352d)) | 0, field);

    // balance the mean linear albedo so every material keeps its identity
    const col = field.col;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let i = 0; i < px; i++) {
      sr += col[i * 3]!;
      sg += col[i * 3 + 1]!;
      sb += col[i * 3 + 2]!;
    }
    const t = TARGET[layer]!;
    const kr = t[0] / Math.max(sr / px, 1e-6);
    const kg = t[1] / Math.max(sg / px, 1e-6);
    const kb = t[2] / Math.max(sb / px, 1e-6);

    const base = layer * px * 4;
    const h = field.h;
    const rg = field.r;
    for (let i = 0; i < px; i++) {
      const o4 = base + i * 4;
      ah[o4] = encode(col[i * 3]! * kr);
      ah[o4 + 1] = encode(col[i * 3 + 1]! * kg);
      ah[o4 + 2] = encode(col[i * 3 + 2]! * kb);
      ah[o4 + 3] = (h[i]! * 255 + 0.5) | 0;
    }

    // normals from the (wrapping) height field, scaled by the tile's real relief
    const metresPerTexel = METRES[layer]! / n;
    const k = RELIEF[layer]! / (2 * metresPerTexel);
    for (let y = 0; y < n; y++) {
      const ym = ((y - 1 + n) % n) * n;
      const yp = ((y + 1) % n) * n;
      const yc = y * n;
      for (let x = 0; x < n; x++) {
        const xm = (x - 1 + n) % n;
        const xp = (x + 1) % n;
        const dx = (h[yc + xp]! - h[yc + xm]!) * k;
        const dy = (h[yp + x]! - h[ym + x]!) * k;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const o4 = base + (yc + x) * 4;
        nr[o4] = ((-dx / len) * 0.5 + 0.5) * 255 + 0.5;
        nr[o4 + 1] = ((-dy / len) * 0.5 + 0.5) * 255 + 0.5;
        nr[o4 + 2] = ((1 / len) * 0.5 + 0.5) * 255 + 0.5;
        nr[o4 + 3] = (rg[yc + x]! * 255 + 0.5) | 0;
      }
    }
  }

  const albedoHeight = new THREE.DataArrayTexture(ah, n, n, MATERIALS.length);
  albedoHeight.format = THREE.RGBAFormat;
  albedoHeight.type = THREE.UnsignedByteType;
  albedoHeight.colorSpace = THREE.SRGBColorSpace;
  const normalRough = new THREE.DataArrayTexture(nr, n, n, MATERIALS.length);
  normalRough.format = THREE.RGBAFormat;
  normalRough.type = THREE.UnsignedByteType;
  normalRough.colorSpace = THREE.NoColorSpace;

  for (const t of [albedoHeight, normalRough]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
  }

  return { albedoHeight, normalRough, metres: METRES.slice(), size: n };
}

/** Mean albedo of one material's tile, linear 0..1 (for tests and tuning). */
export function meanAlbedo(tex: GroundTextures, material: number): [number, number, number] {
  const m = material | 0;
  if (m < 0 || m >= MATERIALS.length) throw new RangeError(`meanAlbedo: material ${material} out of range`);
  const n = tex.size;
  const px = n * n;
  const d = tex.albedoHeight.image.data as Uint8Array;
  const base = m * px * 4;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < px; i++) {
    const o = base + i * 4;
    r += SRGB2LIN[d[o]!]!;
    g += SRGB2LIN[d[o + 1]!]!;
    b += SRGB2LIN[d[o + 2]!]!;
  }
  return [r / px, g / px, b / px];
}

/** Index of a material by name (-1 if unknown). */
export function materialIndex(name: string): number {
  return MATERIALS.indexOf(name as MaterialName);
}

/** Frees both array textures. */
export function disposeGroundTextures(tex: GroundTextures): void {
  tex.albedoHeight.dispose();
  tex.normalRough.dispose();
}

/* -------------------------------------------------------------------------- */
/* the resolution ladder                                                       */
/* -------------------------------------------------------------------------- */

/** How a stage draws the ground. */
export interface GroundStage {
  texelsPerMetre: number;
  nearest: boolean;
  normalStrength: number;
  levels: number;
  specular: number;
  triplanar: boolean;
}

export const STAGE_MIN = 1;
export const STAGE_MAX = 6;

const TPM: readonly number[] = [6, 12, 24, 44, 80, 140];
const NRM: readonly number[] = [0.25, 0.42, 0.62, 0.8, 0.92, 1];
const SPC: readonly number[] = [0, 0.12, 0.38, 0.62, 0.85, 1];

function stageT(stage: number): number {
  const s = Number.isFinite(stage) ? stage : STAGE_MIN;
  return clamp(s <= 0 ? STAGE_MIN : s, STAGE_MIN, STAGE_MAX);
}

/** Interpolate the per-stage anchors (`geo` for the resolution: doubling-ish). */
function anchor(a: readonly number[], t: number, geo: boolean): number {
  const x = t - 1;
  const i = Math.min(Math.floor(x), a.length - 2);
  const f = x - i;
  const p = a[i]!;
  const q = a[i + 1]!;
  if (geo && p > 0 && q > 0) return p * Math.pow(q / p, f);
  return p + (q - p) * f;
}

export function stageLook(stage: number): GroundStage {
  const t = stageT(stage);
  let levels: number;
  if (t <= 2) levels = mixf(12, 24, clamp01(t - 1));
  else if (t < 3) levels = mixf(24, 48, t - 2);
  else levels = 0;
  return {
    texelsPerMetre: anchor(TPM, t, true),
    nearest: t < 2.5,
    normalStrength: anchor(NRM, t, false),
    levels,
    specular: anchor(SPC, t, false),
    triplanar: t >= 2.5,
  };
}

/* -------------------------------------------------------------------------- */
/* shaders                                                                     */
/* -------------------------------------------------------------------------- */

const VERT = /* glsl */ `
attribute vec3 matA;   // rock, scree, gravel
attribute vec3 matB;   // dust, cracked, redsoil
attribute float aShade; // baked shadow / AO, defaults to 1 when the geometry has none

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vMatA;
varying vec3 vMatB;
varying float vShade;

#include <common>
#include <fog_pars_vertex>

void main() {
  vMatA = matA;
  vMatB = matB;
  vShade = aShade;

  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  vWorldPos = worldPosition.xyz;
  vWorldNormal = normalize( mat3( modelMatrix ) * normal );

  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;

#include <common>
#include <fog_pars_fragment>
#include <tonemapping_pars_fragment>

uniform sampler2DArray uAlbedoHeight;
uniform sampler2DArray uNormalRough;
uniform float uMetres[6];
uniform float uTileSize;
uniform float uTexelsPerMetre;
uniform float uNearest;
uniform float uNormalStrength;
uniform float uLevels;
uniform float uSpecular;
uniform float uTriplanar;
uniform float uDetile;
uniform float uMacro;
uniform float uHeightBlend;
uniform vec3 uSunDir;
uniform vec3 uSunColour;
uniform vec3 uSkyColour;
uniform vec3 uGroundColour;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vMatA;
varying vec3 vMatB;
varying float vShade;

float gHash12( vec2 p ) {
  vec3 p3 = fract( vec3( p.x, p.y, p.x ) * 0.1031 );
  p3 += dot( p3, vec3( p3.y, p3.z, p3.x ) + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}

float gNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  float a = gHash12( i );
  float b = gHash12( i + vec2( 1.0, 0.0 ) );
  float c = gHash12( i + vec2( 0.0, 1.0 ) );
  float d = gHash12( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

vec2 gRot( vec2 p, float a ) {
  float s = sin( a );
  float c = cos( a );
  return vec2( c * p.x - s * p.y, s * p.x + c * p.y );
}

// stage resolution: snap the uv onto the stage's texel grid (hard texels)
vec2 gStageUV( vec2 uv, float texelsTile ) {
  vec2 snapped = ( floor( uv * texelsTile ) + 0.5 ) / texelsTile;
  return mix( uv, snapped, uNearest );
}

// one projection = exactly two texture fetches, explicit gradients so the mip
// stays correct through snapped uvs and through dynamic branches
void gFetch( float layer, vec2 uv, vec2 ddx, vec2 ddy, float texelsTile, out vec4 ah, out vec4 nr ) {
  vec3 c = vec3( gStageUV( uv, texelsTile ), layer );
  ah = textureGrad( uAlbedoHeight, c, ddx, ddy );
  nr = textureGrad( uNormalRough, c, ddx, ddy );
}

void gSampleMaterial(
  float layer, float metres, vec3 wp, vec3 dwx, vec3 dwy,
  float wTop, float wSide, float sideIsZ, float detileMask,
  out vec3 albedo, out float height, out vec3 nOffset, out float rough
) {
  float inv = 1.0 / metres;
  float texelsTile = clamp( metres * uTexelsPerMetre, 4.0, uTileSize );
  float grad = max( 1.0, uTileSize / texelsTile ); // low stages read a coarser mip

  albedo = vec3( 0.0 );
  height = 0.0;
  rough = 0.0;
  nOffset = vec3( 0.0 );

  // --- top-down projection (always taken) ---------------------------------
  vec2 uvT = vec2( wp.x, wp.z ) * inv;
  vec2 dxT = vec2( dwx.x, dwx.z ) * inv * grad;
  vec2 dyT = vec2( dwy.x, dwy.z ) * inv * grad;
  vec4 ah, nr;
  gFetch( layer, uvT, dxT, dyT, texelsTile, ah, nr );

  // --- break the repeat with a rotated, scaled second read ----------------
  if ( uDetile > 0.002 ) {
    vec4 ah2, nr2;
    gFetch( layer, gRot( uvT, 2.399 ) * 0.73 + vec2( 0.37, 0.19 ),
            gRot( dxT, 2.399 ) * 0.73, gRot( dyT, 2.399 ) * 0.73, texelsTile, ah2, nr2 );
    float k = detileMask * uDetile;
    ah = mix( ah, ah2, k );
    nr = mix( nr, nr2, k );
  }

  vec3 nT = nr.xyz * 2.0 - 1.0;
  albedo += ah.rgb * wTop;
  height += ah.a * wTop;
  rough += nr.a * wTop;
  nOffset += vec3( nT.x, 0.0, nT.y ) * wTop;

  // --- the dominant side plane, only where the ground is steep ------------
  if ( wSide > 0.02 ) {
    vec2 uvS = mix( vec2( wp.z, wp.y ), vec2( wp.x, wp.y ), sideIsZ ) * inv;
    vec2 dxS = mix( vec2( dwx.z, dwx.y ), vec2( dwx.x, dwx.y ), sideIsZ ) * inv * grad;
    vec2 dyS = mix( vec2( dwy.z, dwy.y ), vec2( dwy.x, dwy.y ), sideIsZ ) * inv * grad;
    vec4 ahS, nrS;
    gFetch( layer, uvS, dxS, dyS, texelsTile, ahS, nrS );
    vec3 nS = nrS.xyz * 2.0 - 1.0;
    albedo += ahS.rgb * wSide;
    height += ahS.a * wSide;
    rough += nrS.a * wSide;
    nOffset += mix( vec3( 0.0, nS.y, nS.x ), vec3( nS.x, nS.y, 0.0 ), sideIsZ ) * wSide;
  }
}

void main() {
  vec3 wp = vWorldPos;
  vec3 dwx = dFdx( wp );
  vec3 dwy = dFdy( wp );
  vec3 gN = normalize( vWorldNormal );

  // ---- per-vertex weights: keep the two strongest, drop anything tiny ----
  float w[ 6 ];
  w[ 0 ] = vMatA.x; w[ 1 ] = vMatA.y; w[ 2 ] = vMatA.z;
  w[ 3 ] = vMatB.x; w[ 4 ] = vMatB.y; w[ 5 ] = vMatB.z;

  int i0 = 0;
  float w0 = -1.0;
  for ( int i = 0; i < 6; i ++ ) {
    if ( w[ i ] > w0 ) { w0 = w[ i ]; i0 = i; }
  }
  int i1 = -1;
  float w1 = 0.02;
  for ( int i = 0; i < 6; i ++ ) {
    if ( i != i0 && w[ i ] > w1 ) { w1 = w[ i ]; i1 = i; }
  }
  w0 = max( w0, 0.0 );
  w1 = i1 >= 0 ? w1 : 0.0;
  float wSum = max( w0 + w1, 1e-4 );
  w0 /= wSum;
  w1 /= wSum;

  // ---- triplanar: top plane plus the dominant side plane -----------------
  vec3 an = abs( gN );
  vec3 bw = an * an;
  bw *= bw;
  bw /= max( bw.x + bw.y + bw.z, 1e-5 );
  float top = mix( 1.0, bw.y, uTriplanar );
  float side = clamp( 1.0 - top, 0.0, 1.0 );
  if ( side < 0.02 ) { top = 1.0; side = 0.0; }
  float sideIsZ = step( an.x, an.z );

  float detileMask = smoothstep( 0.3, 0.7, gNoise( vec2( wp.x, wp.z ) * 0.085 + 11.3 ) );

  vec3 a0, n0;
  float h0, r0;
  gSampleMaterial( float( i0 ), uMetres[ i0 ], wp, dwx, dwy, top, side, sideIsZ, detileMask, a0, h0, n0, r0 );

  vec3 albedo = a0;
  vec3 nOff = n0;
  float rough = r0;

  // ---- height blend: stones poke through dust, dust settles between them --
  if ( i1 >= 0 ) {
    vec3 a1, n1;
    float h1, r1;
    gSampleMaterial( float( i1 ), uMetres[ i1 ], wp, dwx, dwy, top, side, sideIsZ, detileMask, a1, h1, n1, r1 );
    float b0 = w0 + h0 * uHeightBlend;
    float b1 = w1 + h1 * uHeightBlend;
    float hi = max( b0, b1 );
    float depth = 0.25;
    float k0 = max( b0 - ( hi - depth ), 0.0 );
    float k1 = max( b1 - ( hi - depth ), 0.0 );
    float ks = max( k0 + k1, 1e-4 );
    k0 /= ks;
    k1 /= ks;
    albedo = a0 * k0 + a1 * k1;
    nOff = n0 * k0 + n1 * k1;
    rough = r0 * k0 + r1 * k1;
  }

  // ---- slow macro variation so nothing repeats at 30 m -------------------
  float macro = gNoise( vec2( wp.x, wp.z ) * 0.037 ) * 0.65 + gNoise( vec2( wp.x, wp.z ) * 0.0115 + 5.7 ) * 0.35;
  albedo *= mix( 1.0, 0.78 + 0.46 * macro, uMacro );

  vec3 N = normalize( gN + nOff * ( uNormalStrength * 1.6 ) );
  rough = clamp( rough, 0.04, 1.0 );

  // ---- light: sun + hemisphere, GGX-ish specular by stage ----------------
  vec3 L = normalize( uSunDir );
  vec3 V = normalize( cameraPosition - wp );
  float shade = clamp( vShade, 0.0, 1.0 );
  float ndl = max( dot( N, L ), 0.0 );
  float ndlGeo = max( dot( gN, L ), 0.0 );
  float sunVis = shade * min( 1.0, ndlGeo * 6.0 );

  vec3 colour = albedo * uSunColour * ndl * sunVis;
  float hemi = 0.5 + 0.5 * N.y;
  colour += albedo * mix( uGroundColour, uSkyColour, hemi );

  if ( uSpecular > 0.001 ) {
    vec3 H = normalize( L + V );
    float a = max( rough * rough, 0.015 );
    float a2 = a * a;
    float ndh = max( dot( N, H ), 0.0 );
    float den = ndh * ndh * ( a2 - 1.0 ) + 1.0;
    float D = a2 / ( PI * den * den );
    float vdh = max( dot( V, H ), 0.0 );
    float F = 0.04 + 0.96 * pow( 1.0 - vdh, 5.0 );
    float ndv = max( dot( N, V ), 1e-3 );
    float kv = a * 0.5;
    float G = ( ndl / ( ndl * ( 1.0 - kv ) + kv ) ) * ( ndv / ( ndv * ( 1.0 - kv ) + kv ) );
    float spec = min( D * F * G / ( 4.0 * ndv ), 6.0 );
    colour += uSunColour * spec * ndl * sunVis * uSpecular;
  }

  // ---- posterise (stage 1 and 2 only), in display gamma ------------------
  if ( uLevels > 0.5 ) {
    vec3 g = pow( max( colour, vec3( 0.0 ) ), vec3( 0.4545 ) );
    g = floor( g * uLevels + 0.5 ) / uLevels;
    colour = pow( g, vec3( 2.2 ) );
  }

  gl_FragColor = vec4( colour, 1.0 );

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/* -------------------------------------------------------------------------- */
/* material                                                                    */
/* -------------------------------------------------------------------------- */

/** Extra, stage driven uniforms that are not part of the public GroundStage. */
function stageExtras(stage: number): { nearest: number; triplanar: number; detile: number; macro: number; heightBlend: number } {
  const t = stageT(stage);
  const ramp = smoothstep(2, 3, t);
  return {
    nearest: 1 - ramp,
    triplanar: ramp,
    detile: 0.5 * smoothstep(2.2, 3.6, t),
    macro: 0.55 + 0.45 * smoothstep(1, 4, t),
    heightBlend: 0.45 + 0.5 * smoothstep(1, 5, t),
  };
}

function setU(m: THREE.ShaderMaterial, name: string, value: number): void {
  const u = m.uniforms[name];
  if (u !== undefined) u.value = value;
}

export function createGroundMaterial(
  tex: GroundTextures,
  o: {
    stage: number;
    sunDir: THREE.Vector3;
    sunColour?: THREE.Color;
    skyColour?: THREE.Color;
    groundColour?: THREE.Color;
  },
): THREE.ShaderMaterial {
  const look = stageLook(o.stage);
  const extra = stageExtras(o.stage);

  const uniforms: { [name: string]: THREE.IUniform } = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib['fog'] ?? {}),
    uAlbedoHeight: { value: tex.albedoHeight },
    uNormalRough: { value: tex.normalRough },
    uMetres: { value: new Float32Array(tex.metres) },
    uTileSize: { value: tex.size },
    uTexelsPerMetre: { value: look.texelsPerMetre },
    uNearest: { value: extra.nearest },
    uNormalStrength: { value: look.normalStrength },
    uLevels: { value: look.levels },
    uSpecular: { value: look.specular },
    uTriplanar: { value: extra.triplanar },
    uDetile: { value: extra.detile },
    uMacro: { value: extra.macro },
    uHeightBlend: { value: extra.heightBlend },
    uSunDir: { value: o.sunDir.clone().normalize() },
    uSunColour: { value: (o.sunColour ?? new THREE.Color(1.0, 0.86, 0.68)).clone() },
    uSkyColour: { value: (o.skyColour ?? new THREE.Color(0.17, 0.2, 0.3)).clone() },
    uGroundColour: { value: (o.groundColour ?? new THREE.Color(0.1, 0.075, 0.06)).clone() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    lights: false,
    fog: true,
    side: THREE.FrontSide,
  });
  material.name = 'GroundMaterial';
  // geometry without these attributes still draws: plain rock, fully lit.
  // three feeds these to gl.vertexAttrib*fv when a buffer is missing.
  const attrDefaults = material.defaultAttributeValues as unknown as Record<string, readonly number[]>;
  attrDefaults['matA'] = [1, 0, 0];
  attrDefaults['matB'] = [0, 0, 0];
  attrDefaults['aShade'] = [1];
  material.userData['stage'] = stageT(o.stage);
  return material;
}

/** Moves the material to a stage (uniforms only: the same program, no recompile). */
export function setStage(m: THREE.ShaderMaterial, stage: number): void {
  const look = stageLook(stage);
  const extra = stageExtras(stage);
  setU(m, 'uTexelsPerMetre', look.texelsPerMetre);
  setU(m, 'uNearest', extra.nearest);
  setU(m, 'uNormalStrength', look.normalStrength);
  setU(m, 'uLevels', look.levels);
  setU(m, 'uSpecular', look.specular);
  setU(m, 'uTriplanar', extra.triplanar);
  setU(m, 'uDetile', extra.detile);
  setU(m, 'uMacro', extra.macro);
  setU(m, 'uHeightBlend', extra.heightBlend);
  m.userData['stage'] = stageT(stage);
}

/** The stage a material is currently on. */
export function getStage(m: THREE.ShaderMaterial): number {
  const s = m.userData['stage'];
  return typeof s === 'number' ? s : STAGE_MIN;
}

/** Updates the sun / ambient uniforms (also uniforms only). */
export function setSun(
  m: THREE.ShaderMaterial,
  sunDir: THREE.Vector3,
  sunColour?: THREE.Color,
  skyColour?: THREE.Color,
  groundColour?: THREE.Color,
): void {
  const dir = m.uniforms['uSunDir'];
  if (dir !== undefined) (dir.value as THREE.Vector3).copy(sunDir).normalize();
  const pairs: readonly (readonly [string, THREE.Color | undefined])[] = [
    ['uSunColour', sunColour],
    ['uSkyColour', skyColour],
    ['uGroundColour', groundColour],
  ];
  for (const [name, col] of pairs) {
    if (col === undefined) continue;
    const u = m.uniforms[name];
    if (u !== undefined) (u.value as THREE.Color).copy(col);
  }
}
