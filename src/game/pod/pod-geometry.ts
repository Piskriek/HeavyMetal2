/**
 * Hoop-Pod geometry (docs/HOOP_POD.md §Geometry, §LOD, §Garage bake).
 *
 * Three shape families only — six hoop rims, one low-poly inner ball, two domed hubcaps — merged
 * into ONE BufferGeometry per LOD. Per-vertex attributes:
 *   aPart    = (type, x0): 0 inner ball / hubcaps (level gyro pose), 1 hoop wall, 2 hoop crown
 *              (both hoop types take the shell roll); x0 = hoop's lateral centre (differential)
 *   aBakeUv  = garage bake (u, v) on hoop crowns, 0 elsewhere — see `bakeUvForPoint`
 *
 * LODs, chosen per racer in screen space by the fleet (`selectPodLodBand`):
 *   hero ≈3k (garage) · standard ≈2k (near) · lite ≈1k (mid) · far ≈170 (distant: crowns only,
 *   8 segments, no walls or inner faces — nothing you could resolve at that size)
 *
 * Game convention (gyro-ball.ts): +X right, +Y up, +Z backward — a mesh faces −Z. The pod is
 * authored facing +Z and rotated π about Y once at build time. All bake maths below are in the
 * AUTHORED frame; `authoredFromLocal` converts a post-build local point back.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAP_THETA } from '../gyro-ball';
import { CABIN_LATERAL, HUB_CENTER, HUB_RADIUS_UV, REGION, type Region } from './pod-atlas';

/** Slot 0.64 m wide (hoop 3/4 inner edges at ±0.32) so the 2× porthole reads in full. */
export const HOOP_X = [-0.86, -0.64, -0.42, 0.42, 0.64, 0.86] as const;
export const HOOP_W = 0.2;
export const HOOP_T = 0.15;
export const CABIN_R = 0.8;
export const HUB_X = 0.975;
export const HUB_R = 0.4;
const HUB_DOME = 0.12;
const TAU = Math.PI * 2;

export type PodLod = 'far' | 'lite' | 'standard' | 'hero';
export interface PodLodSpec {
  readonly seg: number; readonly band: number; readonly cabW: number; readonly cabH: number;
  readonly hubSeg: number; readonly hubPts: number; readonly walls: boolean;
}
export const POD_LODS: Readonly<Record<PodLod, PodLodSpec>> = {
  far: { seg: 8, band: 2, cabW: 8, cabH: 4, hubSeg: 6, hubPts: 2, walls: false },
  lite: { seg: 14, band: 3, cabW: 12, cabH: 6, hubSeg: 12, hubPts: 3, walls: true },
  standard: { seg: 18, band: 5, cabW: 16, cabH: 8, hubSeg: 16, hubPts: 4, walls: true },
  hero: { seg: 22, band: 7, cabW: 20, cabH: 10, hubSeg: 18, hubPts: 5, walls: true },
};

/* -------------------------------------------------------------------------- */
/* Screen-space LOD selection (pure)                                           */
/* -------------------------------------------------------------------------- */

/** 0 near (standard), 1 mid (lite), 2 far (≈170 tris). */
export type PodLodBand = 0 | 1 | 2;
/** Projected radius in CSS pixels at which a pod earns band 0 / band 1. */
export const POD_LOD_PIXELS: readonly [number, number] = [56, 16];
/** Ratio a pod must cross beyond a threshold before it switches band (no popping at the edge). */
export const POD_LOD_HYSTERESIS = 1.18;

/** Projected radius, px, of a sphere of `radius` at `distance` for a vertical FOV (degrees). */
export function projectedRadiusPx(radius: number, distance: number, fovDeg: number, viewportHeight: number): number {
  const d = Math.max(1e-3, distance);
  return (radius / (d * Math.tan((fovDeg * Math.PI) / 360))) * (viewportHeight / 2);
}

export function selectPodLodBand(pixelRadius: number, current: PodLodBand | -1): PodLodBand {
  const pr = Number.isFinite(pixelRadius) ? pixelRadius : 0;
  const [t0, t1] = POD_LOD_PIXELS;
  if (current < 0) return pr >= t0 ? 0 : pr >= t1 ? 1 : 2;
  const up = [t0, t1];
  let band: number = current;
  while (band > 0 && pr >= up[band - 1] * POD_LOD_HYSTERESIS) band--;
  while (band < 2 && pr < up[band] / POD_LOD_HYSTERESIS) band++;
  return band as PodLodBand;
}

/* -------------------------------------------------------------------------- */
/* Garage bake mapping (pure)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The garage paints an equirect sphere (sphere-decal-baker.ts): u wraps the rolling circumference,
 * v = 1 at the +X axle, and everything within CAP_THETA of an axle sits under a cap. On the pod the
 * paintable latitude |lat| ≤ π/2 − CAP_THETA is TILED across the three crowns of each side, in
 * angular proportion (a 4.7% stretch), so the slot and the hoop gaps hide nothing that was painted.
 */
export const PAINT_LAT_MAX = Math.PI / 2 - CAP_THETA;
const SIDE_X0 = HOOP_X.filter((x) => x > 0);
const SPAN = SIDE_X0.map((x0) => Math.asin(Math.min(1, x0 + HOOP_W / 2)) - Math.asin(x0 - HOOP_W / 2));
const CUM = SPAN.map((_, i) => SPAN.slice(0, i).reduce((a, b) => a + b, 0));
const LAT_SCALE = PAINT_LAT_MAX / SPAN.reduce((a, b) => a + b, 0);

/** Lateral centre of the hoop nearest to an authored lateral coordinate. */
export function hoopForLateral(lateral: number): number {
  let best: number = HOOP_X[0];
  for (const x0 of HOOP_X) if (Math.abs(x0 - lateral) < Math.abs(best - lateral)) best = x0;
  return best;
}

/** Garage v for an authored lateral coordinate on hoop `x0`. */
export function bakeV(lateral: number, x0: number): number {
  const k = SIDE_X0.indexOf(Math.abs(x0) as (typeof SIDE_X0)[number]);
  if (k < 0) return 0.5;
  const xa = Math.abs(x0) - HOOP_W / 2;
  const x = Math.min(xa + HOOP_W, Math.max(xa, Math.abs(lateral)));
  const t = Math.min(SPAN[k], Math.max(0, Math.asin(Math.min(1, x)) - Math.asin(xa)));
  return 0.5 + (Math.sign(x0) * LAT_SCALE * (CUM[k] + t)) / Math.PI;
}

/** Authored-frame point on a hoop → the garage bake texel (u, v) that is painted there. */
export function bakeUvForPoint(x: number, y: number, z: number): { u: number; v: number } {
  const u = (((Math.atan2(z, y) / TAU) % 1) + 1) % 1;
  return { u, v: bakeV(x, hoopForLateral(x)) };
}

/** Post-build local point (faces −Z) → authored frame (faces +Z). */
export const authoredFromLocal = (p: THREE.Vector3) => new THREE.Vector3(-p.x, p.y, -p.z);

/* -------------------------------------------------------------------------- */
/* Build                                                                       */
/* -------------------------------------------------------------------------- */

const rad = (x: number) => Math.sqrt(Math.max(0.0001, 1 - x * x));
type Pt = readonly [number, number];

function lathe(pts: readonly Pt[], seg: number, side: 1 | -1 = 1) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.rotateZ(side === 1 ? -Math.PI / 2 : Math.PI / 2); // lathe axis Y → ±X (the roll axis)
  return g;
}
function remapUV(g: THREE.BufferGeometry, fn: (u: number, v: number, p: THREE.Vector3) => [number, number]) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < uv.count; i++) {
    p.fromBufferAttribute(pos, i);
    const [u, v] = fn(uv.getX(i), uv.getY(i), p);
    uv.setXY(i, u, v);
  }
  return g;
}
const inRegion = (r: Region, u: number, v: number, pad = 0.04): [number, number] => [
  r.u0 + (r.u1 - r.u0) * (pad + (1 - 2 * pad) * u),
  r.v0 + (r.v1 - r.v0) * (pad + (1 - 2 * pad) * v),
];
function tag(g: THREE.BufferGeometry, type: 0 | 1 | 2, x0: number, bake?: (u: number, p: THREE.Vector3) => [number, number]) {
  const n = g.getAttribute('position').count;
  const part = new Float32Array(n * 2);
  const bakeUv = new Float32Array(n * 2);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    part[i * 2] = type;
    part[i * 2 + 1] = x0;
    if (bake) {
      p.fromBufferAttribute(pos, i);
      const [u, v] = bake(uv.getX(i), p);
      bakeUv[i * 2] = u;
      bakeUv[i * 2 + 1] = v;
    }
  }
  g.setAttribute('aPart', new THREE.BufferAttribute(part, 2));
  g.setAttribute('aBakeUv', new THREE.BufferAttribute(bakeUv, 2));
  return g;
}

export interface PodGeometry {
  readonly geometry: THREE.BufferGeometry;
  readonly triangles: number;
  /** Unit-scale distance from centre to the contact hoops' crown. */
  readonly rideHeight: number;
}

function build(lod: PodLod): PodGeometry {
  const L = POD_LODS[lod];
  const parts: THREE.BufferGeometry[] = [];
  let ride = 0;

  HOOP_X.forEach((x0, i) => {
    const accent = i === 1 || i === 4;
    const xa = x0 - HOOP_W / 2;
    const xb = x0 + HOOP_W / 2;
    const prof: Pt[] = [];
    for (let k = 0; k < L.band; k++) {
      const t = k / (L.band - 1);
      const x = xa + t * HOOP_W;
      // Far LOD: one flat crown, lifted so its ride height matches the curved crowns (≤2%).
      const lift = L.band === 2 ? 0.012 : Math.sin(Math.PI * t) * 0.046;
      prof.push([rad(x) - 0.03 + lift, x]);
    }
    if (i === 2 || i === 3) ride = Math.max(ride, ...prof.map((p) => p[0]));
    const rowV0 = accent ? REGION.bandAccent.v0 : REGION.bandMain.v0;
    const sideReg = accent ? REGION.sideAccent : REGION.sideMain;

    // Crown: lathe u runs 0→1 around X; bake u = lathe u + ¼ (continuous — the array texture wraps).
    const crown = remapUV(lathe(prof, L.seg), (u, v) => [u, rowV0 + 0.125 * (0.03 + 0.94 * v)]);
    parts.push(tag(crown, 2, x0, (latheU, p) => [latheU + 0.25, bakeV(p.x, x0)]));
    if (!L.walls) return;
    const walls = [
      remapUV(lathe([[rad(xa) - HOOP_T, xa], [prof[0][0], xa]], L.seg), (u, v) => inRegion(sideReg, u, v)),
      remapUV(lathe([[prof[prof.length - 1][0], xb], [rad(xb) - HOOP_T, xb]], L.seg), (u, v) => inRegion(sideReg, u, v)),
      remapUV(lathe([[rad(xb) - HOOP_T, xb], [rad(xa) - HOOP_T, xa]], L.seg), (u, v) => inRegion(REGION.inner, u, v)),
    ];
    const merged = mergeGeometries(walls);
    walls.forEach((g) => g.dispose());
    if (merged) parts.push(tag(merged, 1, x0));
  });

  // Inner ball: poles on ±X so the strip seen through the slot is the low-distortion equator.
  const cab = new THREE.SphereGeometry(CABIN_R, L.cabW, L.cabH, -Math.PI / 2);
  cab.rotateZ(-Math.PI / 2);
  remapUV(cab, (u, _v, p) => {
    const t = THREE.MathUtils.clamp(p.x / CABIN_LATERAL, -1, 1);
    return [u, REGION.cabin.v0 + 0.25 * (0.5 + t * 0.48)];
  });
  parts.push(tag(cab, 0, 0));

  // Hubcaps: planar UV per side so an emblem reads the right way round from each side.
  for (const s of [1, -1] as const) {
    const pts: [number, number][] = [];
    for (let k = 0; k < L.hubPts; k++) {
      const t = k / (L.hubPts - 1);
      pts.push([HUB_R * Math.cos((t * Math.PI) / 2) + 0.0005, HUB_DOME * Math.sin((t * Math.PI) / 2)]);
    }
    pts[pts.length - 1][0] = 0.0005;
    const dome = lathe(pts, L.hubSeg, s);
    dome.translate(s * HUB_X, 0, 0);
    remapUV(dome, (_u, _v, p) => [
      HUB_CENTER.u + ((s === 1 ? -p.z : p.z) / HUB_R) * HUB_RADIUS_UV * 0.98,
      HUB_CENTER.v + (-p.y / HUB_R) * HUB_RADIUS_UV * 0.98,
    ]);
    parts.push(tag(dome, 0, 0));
  }

  const geometry = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  if (!geometry) throw new Error('Hoop-Pod geometry could not be merged.');
  // Face −Z (game convention). A rigid rotation keeps every UV/decal orientation intact; the
  // differential weight follows the flipped lateral axis. aBakeUv stays in the authored frame.
  geometry.rotateY(Math.PI);
  const part = geometry.getAttribute('aPart') as THREE.BufferAttribute;
  for (let i = 0; i < part.count; i++) part.setY(i, -part.getY(i));
  geometry.computeBoundingSphere();
  const index = geometry.getIndex();
  const triangles = (index ? index.count : geometry.getAttribute('position').count) / 3;
  return { geometry, triangles, rideHeight: ride };
}

const cache = new Map<PodLod, PodGeometry>();
/** Cached per LOD. The fleet clones (sharing vertex data) to attach its instanced attributes. */
export function podGeometry(lod: PodLod): PodGeometry {
  let hit = cache.get(lod);
  if (!hit) {
    hit = build(lod);
    cache.set(lod, hit);
  }
  return hit;
}

export function disposePodGeometryCache(): void {
  cache.forEach((g) => g.geometry.dispose());
  cache.clear();
}
