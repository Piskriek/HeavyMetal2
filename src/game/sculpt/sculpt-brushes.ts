/**
 * NewSculpt — the brushes. Each one is a function of (mesh, hits, params) with no other state, so a
 * test can stamp a plane and measure the dent or paint.
 *
 *   raise / lower   push along one direction: the brush area's average normal, world up, or the view
 *   inflate         push each vertex along its own normal (puffs a rock, thins a ridge when inverted)
 *   smooth          pull each vertex toward the mean of its neighbours (Ctrl held = smooth, always)
 *   flatten         pull toward the plane through the brush area (a terrace, a pad for a prop)
 *   pinch           slide toward the brush centre along the surface (a crease); inverted = magnify
 *   noise           seeded per-vertex displacement along the normal (rock, scree)
 *   grab            drag the area with the pointer (handled by the tool: it needs the stroke's origin)
 *   paint           textured island surface or flat vertex color; inverted = back toward generated look
 *
 * Falloff is flat inside `hardness` of the radius, then a smoothstep to zero at the rim. Every amount
 * scales with the radius, so a big brush on a mountain and a small one on a boulder feel the same.
 */
import * as THREE from 'three';
import type { BrushHit, SculptMesh } from './sculpt-mesh';
import { SURFACE_MOSSY_ROCK } from '../surface/surface-table';

export type SculptToolId = 'raise' | 'lower' | 'inflate' | 'smooth' | 'flatten' | 'pinch' | 'noise' | 'grab' | 'paint';
export type SculptDirection = 'normal' | 'up' | 'view';
export type PaintMode = 'surface' | 'color';

export interface SculptToolInfo {
  readonly id: SculptToolId;
  readonly name: string;
  readonly key: string;
  readonly blurb: string;
}

export const SCULPT_TOOLS: readonly SculptToolInfo[] = Object.freeze([
  { id: 'raise', name: 'Raise', key: '1', blurb: 'Push the surface out (Shift: in).' },
  { id: 'lower', name: 'Lower', key: '2', blurb: 'Push the surface in (Shift: out).' },
  { id: 'inflate', name: 'Inflate', key: '3', blurb: 'Each vertex along its own normal: puff a boulder.' },
  { id: 'smooth', name: 'Smooth', key: '4', blurb: 'Relax toward the neighbours. Hold Ctrl with any tool.' },
  { id: 'flatten', name: 'Flatten', key: '5', blurb: 'A terrace: pull toward the brush plane.' },
  { id: 'pinch', name: 'Pinch', key: '6', blurb: 'Slide toward the centre: a crease. Shift: spread.' },
  { id: 'noise', name: 'Noise', key: '7', blurb: 'Seeded bumps along the normal: rock, scree.' },
  { id: 'grab', name: 'Grab', key: '8', blurb: 'Drag the area with the pointer.' },
  { id: 'paint', name: 'Paint', key: '9', blurb: 'Island surface texture or vertex color. Shift: erase back to base.' },
]);

export interface BrushParams {
  tool: SculptToolId;
  /** World units. */
  radius: number;
  /** 0‥1. */
  strength: number;
  /** 0‥1: how much of the radius is at full strength. */
  hardness: number;
  invert: boolean;
  direction: SculptDirection;
  /** Linear RGB 0‥1 for the flat color paint tool. */
  color: [number, number, number];
  /** Island surface mode: 'surface' (textured island tiles) or 'color' (flat vertex color). */
  paintMode: PaintMode;
  /** Surface ID from island surface table (e.g. SURFACE_MOSSY_ROCK = 21, SURFACE_GRANITE = 20, etc.). */
  surfaceId: number;
  seed: number;
}

export const DEFAULT_BRUSH: BrushParams = {
  tool: 'raise',
  radius: 400,
  strength: 0.5,
  hardness: 0.3,
  invert: false,
  direction: 'normal',
  color: [0.55, 0.45, 0.35],
  paintMode: 'surface',
  surfaceId: SURFACE_MOSSY_ROCK,
  seed: 1,
};

export function falloff(dist: number, radius: number, hardness: number): number {
  const t = dist / radius;
  if (t >= 1) return 0;
  const h = Math.max(0, Math.min(0.99, hardness));
  if (t <= h) return 1;
  const u = (t - h) / (1 - h);
  return 1 - u * u * (3 - 2 * u);
}

export interface StampInput {
  readonly mesh: SculptMesh;
  /** Brush centre, world. */
  readonly centre: THREE.Vector3;
  /** Camera look direction, world (into the scene). */
  readonly viewDir: THREE.Vector3;
  readonly params: BrushParams;
  readonly hits: readonly BrushHit[];
}

const UP = new THREE.Vector3(0, 1, 0);
const tA = new THREE.Vector3();
const tB = new THREE.Vector3();
const tC = new THREE.Vector3();
const tN = new THREE.Vector3();

const hash01 = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** Weighted average world normal over the hits (unit), falling back to up. */
export function averageNormal(mesh: SculptMesh, hits: readonly BrushHit[], params: BrushParams, out: THREE.Vector3): THREE.Vector3 {
  out.set(0, 0, 0);
  for (const h of hits) out.addScaledVector(mesh.groupNormalWorld(h.group, tA), falloff(h.dist, params.radius, params.hardness));
  return out.lengthSq() > 1e-12 ? out.normalize() : out.copy(UP);
}

/**
 * One stamp of a tool other than grab. Returns the groups it moved (for the normal recompute).
 * The mesh's matrices must be current (`mesh.syncMatrices()`).
 */
export function applyStamp(input: StampInput): Set<number> {
  const { mesh, centre, params, hits } = input;
  const touched = new Set<number>();
  if (!hits.length) return touched;
  const sign = params.invert ? -1 : 1;
  const r = params.radius;
  const w = (h: BrushHit) => falloff(h.dist, r, params.hardness);

  switch (params.tool) {
    case 'raise':
    case 'lower': {
      const dir = params.direction === 'up' ? tN.copy(UP)
        : params.direction === 'view' ? tN.copy(input.viewDir).negate().normalize()
          : averageNormal(mesh, hits, params, tN);
      const amount = params.strength * r * 0.06 * (params.tool === 'lower' ? -sign : sign);
      for (const h of hits) {
        mesh.groupWorld(h.group, tA).addScaledVector(dir, amount * w(h));
        mesh.setGroupWorld(h.group, tA);
        touched.add(h.group);
      }
      break;
    }
    case 'inflate': {
      const amount = params.strength * r * 0.05 * sign;
      for (const h of hits) {
        mesh.groupNormalWorld(h.group, tB);
        mesh.groupWorld(h.group, tA).addScaledVector(tB, amount * w(h));
        mesh.setGroupWorld(h.group, tA);
        touched.add(h.group);
      }
      break;
    }
    case 'smooth': {
      // Targets first, from the untouched positions, so the order of the hits does not matter.
      const targets: { g: number; x: number; y: number; z: number; t: number }[] = [];
      for (const h of hits) {
        const nb = mesh.neighboursOf(h.group);
        if (!nb.length) continue;
        let x = 0, y = 0, z = 0;
        for (const n of nb) { mesh.groupLocal(n, tA); x += tA.x; y += tA.y; z += tA.z; }
        targets.push({ g: h.group, x: x / nb.length, y: y / nb.length, z: z / nb.length, t: Math.min(1, params.strength * w(h)) * 0.6 });
      }
      for (const { g, x, y, z, t } of targets) {
        mesh.groupLocal(g, tA);
        mesh.setGroupLocal(g, tA.x + (x - tA.x) * t, tA.y + (y - tA.y) * t, tA.z + (z - tA.z) * t);
        touched.add(g);
      }
      break;
    }
    case 'flatten': {
      const n = averageNormal(mesh, hits, params, tN);
      // Weighted centroid of the area: the terrace's height.
      tC.set(0, 0, 0);
      let total = 0;
      for (const h of hits) { const k = w(h); tC.addScaledVector(mesh.groupWorld(h.group, tA), k); total += k; }
      if (total <= 0) break;
      tC.multiplyScalar(1 / total);
      for (const h of hits) {
        mesh.groupWorld(h.group, tA);
        const sd = tB.copy(tA).sub(tC).dot(n);
        tA.addScaledVector(n, -sd * Math.min(1, params.strength * w(h)) * 0.6);
        mesh.setGroupWorld(h.group, tA);
        touched.add(h.group);
      }
      break;
    }
    case 'pinch': {
      const n = averageNormal(mesh, hits, params, tN);
      for (const h of hits) {
        mesh.groupWorld(h.group, tA);
        tB.copy(centre).sub(tA);
        tB.addScaledVector(n, -tB.dot(n));
        tA.addScaledVector(tB, params.strength * w(h) * 0.15 * sign);
        mesh.setGroupWorld(h.group, tA);
        touched.add(h.group);
      }
      break;
    }
    case 'noise': {
      const amount = params.strength * r * 0.05;
      for (const h of hits) {
        const k = (hash01(h.group * 31 + params.seed * 7.13) * 2 - 1) * amount * w(h) * sign;
        mesh.groupNormalWorld(h.group, tB);
        mesh.groupWorld(h.group, tA).addScaledVector(tB, k);
        mesh.setGroupWorld(h.group, tA);
        touched.add(h.group);
      }
      break;
    }
    case 'paint': {
      const isCustomColor = Math.abs(params.color[0] - 0.55) > 0.01 || Math.abs(params.color[1] - 0.45) > 0.01 || Math.abs(params.color[2] - 0.35) > 0.01;
      const isColorTarget = params.paintMode === 'color' || isCustomColor || (mesh.hasColor && !mesh.hasSurface);
      if (!isColorTarget && params.paintMode === 'surface') {
        const surfaceId = params.surfaceId ?? SURFACE_MOSSY_ROCK;
        for (const h of hits) {
          const t = Math.min(1.0, params.strength * w(h) * 0.5);
          if (params.invert) {
            mesh.unpaintSurfaceGroup(h.group, t);
          } else {
            mesh.paintSurfaceGroup(h.group, surfaceId, t);
          }
        }
      } else {
        const [cr, cg, cb] = params.color;
        for (const h of hits) {
          const t = Math.min(0.5, params.strength * w(h));
          if (params.invert) mesh.unpaintGroup(h.group, t); else mesh.paintGroup(h.group, cr, cg, cb, t);
        }
      }
      break;
    }
    case 'grab':
      break;
  }
  return touched;
}

/** A grab stroke's captured vertices: where each started, and how much of the drag it takes. */
export interface GrabCapture {
  readonly mesh: SculptMesh;
  readonly group: number;
  readonly weight: number;
  readonly start: THREE.Vector3;
}

export function captureGrab(mesh: SculptMesh, hits: readonly BrushHit[], params: BrushParams): GrabCapture[] {
  return hits.map((h) => ({ mesh, group: h.group, weight: falloff(h.dist, params.radius, params.hardness) * params.strength, start: mesh.groupWorld(h.group, new THREE.Vector3()) }));
}

/** Moves every captured group to `start + delta · weight`; returns the touched groups per mesh. */
export function applyGrab(captured: readonly GrabCapture[], delta: THREE.Vector3): Map<SculptMesh, Set<number>> {
  const touched = new Map<SculptMesh, Set<number>>();
  for (const c of captured) {
    tA.copy(c.start).addScaledVector(delta, c.weight);
    c.mesh.setGroupWorld(c.group, tA);
    let set = touched.get(c.mesh);
    if (!set) { set = new Set(); touched.set(c.mesh, set); }
    set.add(c.group);
  }
  return touched;
}

/** The tool a keypress selects (the digits in `SCULPT_TOOLS`). */
export const toolForKey = (key: string): SculptToolId | undefined => SCULPT_TOOLS.find((t) => t.key === key)?.id;
