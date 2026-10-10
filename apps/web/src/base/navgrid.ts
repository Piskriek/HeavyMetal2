/**
 * The ground the Monster Mash mobs path on (@hm/mobsim's Nav), from the base's structures.
 *
 * Mobs walk the ground level (k = 0). What stands there blocks them:
 *  - walls and other wall-like edges;
 *  - shut doors and airlocks;
 *  - pillars and fixtures (at their free placement);
 *  - heavy machines.
 * Doorways (a doorframe, an open door or airlock) leave their 1.4 m opening clear.
 *
 * Each footprint is a rectangle in its structure's frame, rasterised onto a world-aligned grid. A cell is blocked when
 * the rectangle overlaps its square. A turned wall comes out as a staircase of cells, and @hm/navpath promises nothing
 * when two blocked cells touch only at a corner. So every such diagonal pinch is closed by blocking one more cell: a
 * thin wall at any angle stays a wall.
 */
import type { Nav } from '@hm/mobsim';
import * as S from '@hm/structure';

const EDGE_HALF = 0.125;
const DOOR_FROM = 1.3, DOOR_TO = 2.7;
/** Fixture footprints (width along x, depth along z), as in @hm/structure. */
const FIXTURE: Readonly<Partial<Record<S.Kind, readonly [number, number]>>> = { bin: [1.2, 0.9], bench: [2.4, 1.2], repeater: [1.6, 1.6], lifeSupport: [1.1, 0.7], weaponBench: [2.4, 1.2] };
const WALLS: ReadonlySet<S.Kind> = new Set<S.Kind>(['wall', 'windowWall', 'halfWall', 'railing', 'airlock', 'door', 'doorframe']);

/** A rectangle in a structure's (u, v) frame: centre, half sizes and its u axis (unit). */
interface Rect { readonly cu: number; readonly cv: number; readonly hu: number; readonly hv: number; readonly au: number; readonly av: number }

function rects(p: S.Piece): Rect[] {
  const C = S.CELL;
  if (WALLS.has(p.kind)) {
    const gap = p.kind === 'doorframe' || ((p.kind === 'door' || p.kind === 'airlock') && p.open === true);
    const spans: [number, number][] = gap ? [[0, DOOR_FROM], [DOOR_TO, C]] : [[0, C]];
    return spans.map(([a, b]) => (p.r === 0
      ? { cu: p.i * C + (a + b) / 2, cv: p.j * C, hu: (b - a) / 2, hv: EDGE_HALF, au: 1, av: 0 }
      : { cu: p.i * C, cv: p.j * C + (a + b) / 2, hu: EDGE_HALF, hv: (b - a) / 2, au: 1, av: 0 }));
  }
  if (p.kind === 'pillar') return [{ cu: p.i * C, cv: p.j * C, hu: 0.2, hv: 0.2, au: 1, av: 0 }];
  if (p.kind === 'hardpoint') return [{ cu: (p.i + 1) * C, cv: (p.j + 1) * C, hu: 1.7, hv: 1.7, au: 1, av: 0 }];
  const size = FIXTURE[p.kind];
  if (size) {
    const t = ((p.deg ?? p.r * 90) * Math.PI) / 180;
    return [{ cu: (p.i + 0.5) * C + (p.dx ?? 0) / 100, cv: (p.j + 0.5) * C + (p.dz ?? 0) / 100, hu: size[0] / 2, hv: size[1] / 2, au: Math.cos(t), av: Math.sin(t) }];
  }
  return [];
}

/** The mobs' Nav for a square of side 2 * radius around `center`, `cell` metres a cell. */
export function navFor(base: S.Base, center: { readonly x: number; readonly z: number }, radius = 32, cell = 0.25): Nav {
  const w = Math.ceil((2 * radius) / cell), h = w, originX = center.x - radius, originZ = center.z - radius;
  const cells = new Uint8Array(w * h);
  const byId = new Map(base.structures.map((s) => [s.id, s] as const));
  for (const p of base.pieces) {
    const st = byId.get(p.s);
    if (!st || p.k !== 0) continue;
    const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    for (const r of rects(p)) {
      // the rectangle in world space: centre, and its two axes turned by the structure's yaw
      const x = st.x + r.cu * c - r.cv * s, z = st.z + r.cu * s + r.cv * c;
      const ax = [r.au * c - r.av * s, r.au * s + r.av * c] as const, az = [-ax[1], ax[0]] as const;
      const ex = r.hu * Math.abs(ax[0]) + r.hv * Math.abs(az[0]), ez = r.hu * Math.abs(ax[1]) + r.hv * Math.abs(az[1]);
      const g0 = Math.max(0, Math.floor((x - ex - originX) / cell)), g1 = Math.min(w - 1, Math.floor((x + ex - originX) / cell));
      const k0 = Math.max(0, Math.floor((z - ez - originZ) / cell)), k1 = Math.min(h - 1, Math.floor((z + ez - originZ) / cell));
      for (let gx = g0; gx <= g1; gx++) for (let gz = k0; gz <= k1; gz++) {
        const cx = originX + (gx + 0.5) * cell - x, cz = originZ + (gz + 0.5) * cell - z, half = cell / 2;
        // separating axes: the grid's x and z, then the rectangle's two axes (touching does not block)
        if (Math.abs(cx) >= half + ex - 1e-9 || Math.abs(cz) >= half + ez - 1e-9) continue;
        const pa = Math.abs(cx * ax[0] + cz * ax[1]), ra = half * (Math.abs(ax[0]) + Math.abs(ax[1]));
        const pb = Math.abs(cx * az[0] + cz * az[1]), rb = half * (Math.abs(az[0]) + Math.abs(az[1]));
        if (pa >= r.hu + ra - 1e-9 || pb >= r.hv + rb - 1e-9) continue;
        cells[gz * w + gx] = 1;
      }
    }
  }
  // close diagonal pinches, so a staircase of cells is still a wall to the path finder
  for (let changed = true; changed;) {
    changed = false;
    for (let gx = 0; gx + 1 < w; gx++) for (let gz = 0; gz + 1 < h; gz++) {
      const a = cells[gz * w + gx], b = cells[gz * w + gx + 1], c = cells[(gz + 1) * w + gx], d = cells[(gz + 1) * w + gx + 1];
      if ((a && d && !b && !c) || (b && c && !a && !d)) { cells[gz * w + gx + (a ? 1 : 0)] = 1; changed = true; }
    }
  }
  return { originX, originZ, cell, grid: { w, h, blocked: (x, y) => cells[y * w + x] === 1 } };
}
