/**
 * Moon-base structural kit: foundation, wall, pillar, floor, ramp, airlock.
 * Everything is procedural, merged to one mesh per material, deterministic.
 *
 * Frame: 4 m cells, 3 m storeys, y up. A cell piece's origin is its cell corner,
 * floor top is y = 0. Every part stays inside its 4 x 4 cell so neighbours tile.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface LabMaterials {
  gunmetal: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  hazard: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  concrete: THREE.MeshStandardMaterial;
}

export interface Box {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Piece {
  group: THREE.Group;
  colliders: Box[];
  lamps: THREE.Mesh[];
}

export interface PieceOptions {
  /** 0-1 chunky flat-shaded low poly, 6 full detail. Default 6. */
  stage?: number;
}

export interface FoundationOptions extends PieceOptions {
  /** Levelling skirt depth below the slab, 0..3 m. Default 1. */
  skirt?: number;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** Diagonal yellow/black hazard stripes as a DataTexture (no canvas / DOM). */
function hazardTexture(): THREE.DataTexture {
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const on = (x + y) % n < n / 2;
      const i = (y * n + x) * 4;
      data[i] = on ? 244 : 26;
      data[i + 1] = on ? 190 : 27;
      data[i + 2] = on ? 8 : 30;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.repeat.set(4, 4); // geometry UVs are in metres: one stripe pair every 0.25 m
  t.needsUpdate = true;
  return t;
}

export function createMaterials(): LabMaterials {
  return {
    gunmetal: new THREE.MeshStandardMaterial({ name: 'gunmetal', color: 0x646b75, metalness: 0.55, roughness: 0.42 }),
    darkSteel: new THREE.MeshStandardMaterial({ name: 'darkSteel', color: 0x2b2f35, metalness: 0.55, roughness: 0.5 }),
    paint: new THREE.MeshStandardMaterial({ name: 'paint', color: 0xdde1e4, metalness: 0.1, roughness: 0.55 }),
    copper: new THREE.MeshStandardMaterial({ name: 'copper', color: 0xb8733a, metalness: 0.8, roughness: 0.35 }),
    rubber: new THREE.MeshStandardMaterial({ name: 'rubber', color: 0x17181a, metalness: 0, roughness: 0.92 }),
    hazard: new THREE.MeshStandardMaterial({ name: 'hazard', color: 0xffffff, map: hazardTexture(), metalness: 0.1, roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({
      name: 'glass',
      color: 0x8fd0f0,
      metalness: 0,
      roughness: 0.06,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
    concrete: new THREE.MeshStandardMaterial({ name: 'concrete', color: 0x8d8a84, metalness: 0, roughness: 0.95 }),
  };
}

const flatCache = new WeakMap<LabMaterials, LabMaterials>();

/** Stage 0-1 uses flat-shaded copies so the chunky silhouette reads as low poly. */
function flatMaterials(m: LabMaterials): LabMaterials {
  const hit = flatCache.get(m);
  if (hit) return hit;
  const flat = <T extends THREE.MeshStandardMaterial>(x: T): T => {
    const c = x.clone();
    c.flatShading = true;
    c.needsUpdate = true;
    return c;
  };
  const out: LabMaterials = {
    gunmetal: flat(m.gunmetal),
    darkSteel: flat(m.darkSteel),
    paint: flat(m.paint),
    copper: flat(m.copper),
    rubber: flat(m.rubber),
    hazard: flat(m.hazard),
    glass: flat(m.glass),
    concrete: flat(m.concrete),
  };
  flatCache.set(m, out);
  return out;
}

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------

type V3 = readonly [number, number, number];
type P2 = readonly [number, number];
type MapFn = (u: number, v: number, a: number) => V3;

interface ExtrudeOpts {
  top?: boolean;
  bottom?: boolean;
  smooth?: boolean;
}

const at = <T>(a: readonly T[], i: number): T => {
  const v = a[((i % a.length) + a.length) % a.length];
  if (v === undefined) throw new Error('empty array');
  return v;
};

/** poly in (x,z), extruded along y */
const mapY: MapFn = (u, v, a) => [u, a, v];
/** poly in (x,y), extruded along z */
const mapZ: MapFn = (u, v, a) => [u, v, a];
/** poly in (z,y), extruded along x */
const mapX: MapFn = (u, v, a) => [a, v, u];

const SIDES = [1, -1] as const;

function circle(cx: number, cy: number, r: number, seg: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/** Rounded rectangle, CCW. seg = 1 gives a plain chamfer. 4 * (seg + 1) points. */
function rrect(cx: number, cy: number, w: number, h: number, r: number, seg: number): P2[] {
  const hw = w / 2;
  const hh = h / 2;
  const rr = Math.min(r, hw, hh);
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [cx + hw - rr, cy - hh + rr, -90],
    [cx + hw - rr, cy + hh - rr, 0],
    [cx - hw + rr, cy + hh - rr, 90],
    [cx - hw + rr, cy - hh + rr, 180],
  ];
  const out: P2[] = [];
  for (const [ox, oy, a0] of corners) {
    for (let k = 0; k <= seg; k++) {
      const a = ((a0 + (90 * k) / seg) * Math.PI) / 180;
      out.push([ox + Math.cos(a) * rr, oy + Math.sin(a) * rr]);
    }
  }
  return out;
}

function rect4(x0: number, z0: number, x1: number, z1: number): P2[] {
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

/** Rectangle rotated by `ang`, spanning l0..l1 along its axis and w across. */
function rotRect(cx: number, cy: number, ang: number, l0: number, l1: number, w: number): P2[] {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const nx = -dy;
  const ny = dx;
  const p = (l: number, t: number): P2 => [cx + dx * l + nx * t, cy + dy * l + ny * t];
  return [p(l0, -w / 2), p(l1, -w / 2), p(l1, w / 2), p(l0, w / 2)];
}

const SLOPE = 0.75; // ramp rise per metre of run
/** Parallelogram in (z,y) following the ramp slope: y = SLOPE*z + yo .. + h */
function para(z0: number, z1: number, yo: number, h: number): P2[] {
  return [
    [z0, SLOPE * z0 + yo],
    [z1, SLOPE * z1 + yo],
    [z1, SLOPE * z1 + yo + h],
    [z0, SLOPE * z0 + yo + h],
  ];
}

const clampNum = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);

// ---------------------------------------------------------------------------
// Mesher: accumulates flat or smooth triangles, UVs projected in metres
// ---------------------------------------------------------------------------

class Mesher {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];

  get tris(): number {
    return this.pos.length / 9;
  }

  truncate(tris: number): void {
    const t = Math.min(tris, this.tris);
    this.pos.length = t * 9;
    this.nor.length = t * 9;
    this.uv.length = t * 6;
  }

  private push(p: V3, n: V3, fx: number, fy: number, fz: number): void {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    const ax = Math.abs(fx);
    const ay = Math.abs(fy);
    const az = Math.abs(fz);
    if (ay >= ax && ay >= az) this.uv.push(p[0], p[2]);
    else if (ax >= az) this.uv.push(p[2], p[1]);
    else this.uv.push(p[0], p[1]);
  }

  /** Emit a triangle, winding it so the geometric normal agrees with the vertex normals. */
  private emit(a: V3, b: V3, c: V3, na: V3, nb: V3, nc: V3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-10) return;
    nx /= len;
    ny /= len;
    nz /= len;
    const dot = nx * (na[0] + nb[0] + nc[0]) + ny * (na[1] + nb[1] + nc[1]) + nz * (na[2] + nb[2] + nc[2]);
    if (dot < 0) {
      this.push(a, na, -nx, -ny, -nz);
      this.push(c, nc, -nx, -ny, -nz);
      this.push(b, nb, -nx, -ny, -nz);
    } else {
      this.push(a, na, nx, ny, nz);
      this.push(b, nb, nx, ny, nz);
      this.push(c, nc, nx, ny, nz);
    }
  }

  /** Flat triangle facing away from `ref` (or toward it when `inward`). */
  flat(a: V3, b: V3, c: V3, ref: V3, inward = false): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-10) return;
    nx /= len;
    ny /= len;
    nz /= len;
    const d =
      nx * ((a[0] + b[0] + c[0]) / 3 - ref[0]) +
      ny * ((a[1] + b[1] + c[1]) / 3 - ref[1]) +
      nz * ((a[2] + b[2] + c[2]) / 3 - ref[2]);
    const s = (inward ? -d : d) < 0 ? -1 : 1;
    const n: V3 = [nx * s, ny * s, nz * s];
    this.emit(a, b, c, n, n, n);
  }

  quad(a: V3, b: V3, c: V3, d: V3, ref: V3, inward = false): void {
    this.flat(a, b, c, ref, inward);
    this.flat(a, c, d, ref, inward);
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const r: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], r);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], r);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], r);
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], r);
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], r);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], r);
  }

  /** Four vertical walls of a rectangle (no caps), facing out or in. */
  shell(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, inward: boolean): void {
    const r: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], r, inward);
    this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], r, inward);
    this.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], r, inward);
    this.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], r, inward);
  }

  /** Rectangular frustum: base rect at y0, top rect inset by `inset` at y1. */
  frustum(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y0: number,
    y1: number,
    inset: number,
    o: { top?: boolean; bottom?: boolean } = {},
  ): void {
    const r: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const a: V3 = [x0, y0, z0];
    const b: V3 = [x1, y0, z0];
    const c: V3 = [x1, y0, z1];
    const d: V3 = [x0, y0, z1];
    const e: V3 = [x0 + inset, y1, z0 + inset];
    const f: V3 = [x1 - inset, y1, z0 + inset];
    const g: V3 = [x1 - inset, y1, z1 - inset];
    const h: V3 = [x0 + inset, y1, z1 - inset];
    this.quad(a, b, f, e, r);
    this.quad(b, c, g, f, r);
    this.quad(c, d, h, g, r);
    this.quad(d, a, e, h, r);
    if (o.top === true) this.quad(e, f, g, h, r);
    if (o.bottom === true) this.quad(a, b, c, d, r);
  }

  /** Flat upward-facing rectangular ring at height y between an outer and inner rect. */
  rectRing(
    ox0: number,
    oz0: number,
    ox1: number,
    oz1: number,
    ix0: number,
    iz0: number,
    ix1: number,
    iz1: number,
    y: number,
  ): void {
    const r: V3 = [(ox0 + ox1) / 2, y - 1, (oz0 + oz1) / 2];
    const o1: V3 = [ox0, y, oz0];
    const o2: V3 = [ox1, y, oz0];
    const o3: V3 = [ox1, y, oz1];
    const o4: V3 = [ox0, y, oz1];
    const i1: V3 = [ix0, y, iz0];
    const i2: V3 = [ix1, y, iz0];
    const i3: V3 = [ix1, y, iz1];
    const i4: V3 = [ix0, y, iz1];
    this.quad(o1, o2, i2, i1, r);
    this.quad(o2, o3, i3, i2, r);
    this.quad(o3, o4, i4, i3, r);
    this.quad(o4, o1, i1, i4, r);
  }

  /** Side walls of a closed 2D contour extruded between a0 and a1. */
  private sides(poly: readonly P2[], a0: number, a1: number, map: MapFn, inward: boolean, smooth: boolean): void {
    const n = poly.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const p = at(poly, i);
      const q = at(poly, i + 1);
      area += p[0] * q[1] - q[0] * p[1];
    }
    const s = (area >= 0 ? 1 : -1) * (inward ? -1 : 1);
    const en: P2[] = [];
    for (let i = 0; i < n; i++) {
      const p = at(poly, i);
      const q = at(poly, i + 1);
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const l = Math.hypot(dx, dy) || 1;
      en.push([(s * dy) / l, (-s * dx) / l]);
    }
    const o = map(0, 0, 0);
    const dir = (v: P2): V3 => {
      const m = map(v[0], v[1], 0);
      return [m[0] - o[0], m[1] - o[1], m[2] - o[2]];
    };
    const vn = (cur: P2, other: P2): V3 => {
      if (smooth && cur[0] * other[0] + cur[1] * other[1] > 0.8) {
        const sx = cur[0] + other[0];
        const sy = cur[1] + other[1];
        const l = Math.hypot(sx, sy) || 1;
        return dir([sx / l, sy / l]);
      }
      return dir(cur);
    };
    for (let i = 0; i < n; i++) {
      const p = at(poly, i);
      const q = at(poly, i + 1);
      const cur = at(en, i);
      const np = vn(cur, at(en, i - 1));
      const nq = vn(cur, at(en, i + 1));
      const p0 = map(p[0], p[1], a0);
      const p1 = map(q[0], q[1], a0);
      const p2 = map(q[0], q[1], a1);
      const p3 = map(p[0], p[1], a1);
      this.emit(p0, p1, p2, np, nq, nq);
      this.emit(p0, p2, p3, np, nq, np);
    }
  }

  /** Extrude a CONVEX polygon. */
  extrude(poly: readonly P2[], a0: number, a1: number, map: MapFn, o: ExtrudeOpts = {}): void {
    const n = poly.length;
    if (n < 3) return;
    let cx = 0;
    let cy = 0;
    for (const p of poly) {
      cx += p[0];
      cy += p[1];
    }
    cx /= n;
    cy /= n;
    const ref = map(cx, cy, (a0 + a1) / 2);
    const first = at(poly, 0);
    const cap = (a: number): void => {
      const f = map(first[0], first[1], a);
      for (let i = 1; i < n - 1; i++) {
        const p = at(poly, i);
        const q = at(poly, i + 1);
        this.flat(f, map(p[0], p[1], a), map(q[0], q[1], a), ref);
      }
    };
    if (o.top !== false) cap(a1);
    if (o.bottom !== false) cap(a0);
    this.sides(poly, a0, a1, map, false, o.smooth === true);
  }

  /** Extrude a ring between two same-length convex contours. */
  ring(outer: readonly P2[], inner: readonly P2[], a0: number, a1: number, map: MapFn, o: ExtrudeOpts = {}): void {
    const n = outer.length;
    if (n < 3 || inner.length !== n) return;
    const smooth = o.smooth === true;
    this.sides(outer, a0, a1, map, false, smooth);
    this.sides(inner, a0, a1, map, true, smooth);
    let cx = 0;
    let cy = 0;
    for (const p of outer) {
      cx += p[0];
      cy += p[1];
    }
    const ref = map(cx / n, cy / n, (a0 + a1) / 2);
    const cap = (a: number): void => {
      for (let i = 0; i < n; i++) {
        const p = at(outer, i);
        const q = at(outer, i + 1);
        const pi = at(inner, i);
        const qi = at(inner, i + 1);
        this.quad(map(p[0], p[1], a), map(q[0], q[1], a), map(qi[0], qi[1], a), map(pi[0], pi[1], a), ref);
      }
    };
    if (o.top !== false) cap(a1);
    if (o.bottom !== false) cap(a0);
  }

  prismY(poly: readonly P2[], y0: number, y1: number, o?: ExtrudeOpts): void {
    this.extrude(poly, y0, y1, mapY, o);
  }
  prismZ(poly: readonly P2[], z0: number, z1: number, o?: ExtrudeOpts): void {
    this.extrude(poly, z0, z1, mapZ, o);
  }
  prismX(poly: readonly P2[], x0: number, x1: number, o?: ExtrudeOpts): void {
    this.extrude(poly, x0, x1, mapX, o);
  }

  /** Hex bolt head sitting on a surface point, pointing along `dir` of `axis`; base is embedded. */
  bolt(axis: 'x' | 'y' | 'z', px: number, py: number, pz: number, dir: 1 | -1, r: number, h: number, emb = 0.01): void {
    const o: ExtrudeOpts = { bottom: false };
    if (axis === 'y') this.prismY(circle(px, pz, r, 6), py - dir * emb, py + dir * h, o);
    else if (axis === 'z') this.prismZ(circle(px, py, r, 6), pz - dir * emb, pz + dir * h, o);
    else this.prismX(circle(pz, py, r, 6), px - dir * emb, px + dir * h, o);
  }

  /**
   * Open trough: two polylines (outer / inner, same length) swept between a0 and a1.
   * `c` is the centre of curvature: outer faces point away from it, inner faces toward it.
   */
  channel(outer: readonly P2[], inner: readonly P2[], a0: number, a1: number, map: MapFn, c: P2): void {
    const n = outer.length;
    if (n < 2 || inner.length !== n) return;
    const am = (a0 + a1) / 2;
    const ref = map(c[0], c[1], am);
    const pt = (p: P2, a: number): V3 => map(p[0], p[1], a);
    for (let i = 0; i + 1 < n; i++) {
      const o0 = at(outer, i);
      const o1 = at(outer, i + 1);
      const i0 = at(inner, i);
      const i1 = at(inner, i + 1);
      this.quad(pt(o0, a0), pt(o1, a0), pt(o1, a1), pt(o0, a1), ref);
      this.quad(pt(i0, a0), pt(i1, a0), pt(i1, a1), pt(i0, a1), ref, true);
      this.quad(pt(o0, a0), pt(o1, a0), pt(i1, a0), pt(i0, a0), ref);
      this.quad(pt(o0, a1), pt(o1, a1), pt(i1, a1), pt(i0, a1), ref);
    }
    const lip = (k: number, nb: number): void => {
      const o = at(outer, k);
      const i = at(inner, k);
      const p = at(outer, nb);
      const q = at(inner, nb);
      const r = map((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, am);
      this.quad(pt(o, a0), pt(i, a0), pt(i, a1), pt(o, a1), r);
    };
    lip(0, 1);
    lip(n - 1, n - 2);
  }

  /** Rectangular prism between two centre-line points; section is `side` (horizontal) x vertical. */
  skewBox(p0: V3, p1: V3, side: V3, hw: number, y0: number, y1: number): void {
    const cr = (p: V3, s: number, y: number): V3 => [p[0] + side[0] * hw * s, p[1] + y, p[2] + side[2] * hw * s];
    const a0 = cr(p0, -1, y0);
    const b0 = cr(p0, 1, y0);
    const c0 = cr(p0, 1, y1);
    const d0 = cr(p0, -1, y1);
    const a1 = cr(p1, -1, y0);
    const b1 = cr(p1, 1, y0);
    const c1 = cr(p1, 1, y1);
    const d1 = cr(p1, -1, y1);
    const ref: V3 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + (y0 + y1) / 2, (p0[2] + p1[2]) / 2];
    this.quad(a0, b0, b1, a1, ref);
    this.quad(d0, d1, c1, c0, ref);
    this.quad(a0, a1, d1, d0, ref);
    this.quad(b0, c0, c1, b1, ref);
    this.quad(a0, d0, c0, b0, ref);
    this.quad(a1, b1, c1, d1, ref);
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    const merged = mergeGeometries([g], false);
    const out = merged ?? g;
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  }
}

// ---------------------------------------------------------------------------
// Build context: per-material meshers, stage flags, triangle-budget guard
// ---------------------------------------------------------------------------

const STAGE1_LIMIT = 380; // hard budget 400
const STAGE6_LIMIT = 3900; // hard budget 4000

class Build {
  readonly group = new THREE.Group();
  readonly colliders: Box[] = [];
  readonly st: number;
  readonly chunky: boolean;
  readonly mats: LabMaterials;
  readonly lamp = new Mesher();
  private readonly lampMat: THREE.MeshStandardMaterial;
  private readonly limit: number;
  private readonly layers = new Map<THREE.Material, Mesher>();
  private readonly all: Mesher[] = [];

  constructor(m: LabMaterials, stage: number | undefined, name: string) {
    this.st = Math.round(clampNum(stage ?? 6, 0, 6));
    this.chunky = this.st <= 1;
    this.mats = this.chunky ? flatMaterials(m) : m;
    this.limit = this.chunky ? STAGE1_LIMIT : STAGE6_LIMIT;
    this.group.name = name;
    this.all.push(this.lamp);
    this.lampMat = new THREE.MeshStandardMaterial({
      name: 'statusLamp',
      color: 0x1d3a26,
      emissive: new THREE.Color(0x35ff7a),
      emissiveIntensity: 1.6,
      metalness: 0,
      roughness: 0.35,
      flatShading: this.chunky,
    });
  }

  /** Mesher for a material (merged into one mesh per material). */
  L(mat: THREE.Material): Mesher {
    let ms = this.layers.get(mat);
    if (!ms) {
      ms = new Mesher();
      this.layers.set(mat, ms);
      this.all.push(ms);
    }
    return ms;
  }

  total(): number {
    let t = 0;
    for (const m of this.all) t += m.tris;
    return t;
  }

  /** Run optional detail; if it would break the triangle budget it is rolled back. */
  optional(fn: () => void): boolean {
    const snap = new Map<Mesher, number>();
    for (const m of this.all) snap.set(m, m.tris);
    fn();
    if (this.total() <= this.limit) return true;
    for (const m of this.all) m.truncate(snap.get(m) ?? 0);
    return false;
  }

  col(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    this.colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1] });
  }

  finish(): Piece {
    for (const [mat, ms] of this.layers) {
      if (ms.tris === 0) continue;
      const mesh = new THREE.Mesh(ms.geometry(), mat);
      mesh.name = mat.name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    const lamps: THREE.Mesh[] = [];
    if (this.lamp.tris > 0) {
      const mesh = new THREE.Mesh(this.lamp.geometry(), this.lampMat);
      mesh.name = 'statusLamp';
      this.group.add(mesh);
      lamps.push(mesh);
    }
    return { group: this.group, colliders: this.colliders, lamps };
  }
}

export function triangles(p: Piece): number {
  let n = 0;
  p.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const g = o.geometry as THREE.BufferGeometry;
      if (g.index) n += g.index.count / 3;
      else {
        const pos = g.getAttribute('position');
        n += pos ? pos.count / 3 : 0;
      }
    }
  });
  return n;
}

// ---------------------------------------------------------------------------
// FOUNDATION
// ---------------------------------------------------------------------------

export function foundation(m: LabMaterials, opts: FoundationOptions = {}): Piece {
  const b = new Build(m, opts.stage, 'foundation');
  const skirt = clampNum(opts.skirt ?? 1, 0, 3);
  const cm = b.L(b.mats.concrete);
  const hz = b.L(b.mats.hazard);
  const ds = b.L(b.mats.darkSteel);
  const gm = b.L(b.mats.gunmetal);

  // Slab: 4 x 4, top y = 0, 0.5 thick. Chamfered top edge is the hazard band.
  const CH = 0.12; // chamfer run
  const FL = 0.2; // flat hazard border
  const inner = CH + FL;
  cm.box(0, -0.5, 0, 4, -CH, 4);
  cm.box(inner, -CH, inner, 4 - inner, 0, 4 - inner);
  hz.frustum(0, 0, 4, 4, -CH, 0, CH);
  hz.rectRing(CH, CH, 4 - CH, 4 - CH, inner, inner, 4 - inner, 4 - inner, 0);

  b.col(0, -0.5, 0, 4, 0, 4);

  // Levelling skirt, kept inside the 4 x 4 footprint (ribs flush with the slab sides).
  if (skirt > 0.04) {
    const yb = -(0.5 + skirt);
    const yt = -0.48; // tucks 2 cm into the slab
    ds.box(0.04, yb, 0.04, 3.96, yt, 0.12);
    ds.box(0.04, yb, 3.88, 3.96, yt, 3.96);
    ds.box(0.04, yb, 0.12, 0.12, yt, 3.88);
    ds.box(3.88, yb, 0.12, 3.96, yt, 3.88);
    for (const [cx, cz] of [
      [0, 0],
      [3.88, 0],
      [0, 3.88],
      [3.88, 3.88],
    ] as const) {
      ds.box(cx, yb, cz, cx + 0.12, yt, cz + 0.12);
    }
    // bottom rim bars
    ds.box(0.12, yb, 0, 3.88, yb + 0.1, 0.14);
    ds.box(0.12, yb, 3.86, 3.88, yb + 0.1, 4);
    ds.box(0, yb, 0.14, 0.14, yb + 0.1, 3.86);
    ds.box(3.86, yb, 0.14, 4, yb + 0.1, 3.86);

    b.col(0, yb, 0, 4, -0.5, 0.12);
    b.col(0, yb, 3.88, 4, -0.5, 4);
    b.col(0, yb, 0.12, 0.12, -0.5, 3.88);
    b.col(3.88, yb, 0.12, 4, -0.5, 3.88);

    // ribs (outward, flush with the cell edge)
    if (skirt >= 0.2) {
      b.optional(() => {
        const rb = yb + 0.1;
        const ribs: number[] = [];
        if (b.chunky) ribs.push(0.8, 2, 3.2);
        else for (let k = 1; k <= 14; k++) ribs.push(0.125 + 0.25 * k);
        const hw = b.chunky ? 0.15 : 0.035;
        for (const c of ribs) {
          ds.box(c - hw, rb, 0, c + hw, yt, 0.04);
          ds.box(c - hw, rb, 3.96, c + hw, yt, 4);
          ds.box(0, rb, c - hw, 0.04, yt, c + hw);
          ds.box(3.96, rb, c - hw, 4, yt, c + hw);
        }
      });
    }
  }

  if (b.st >= 2) {
    // plate texture lines on the slab top
    b.optional(() => {
      for (const v of [4 / 3, 8 / 3]) {
        ds.box(v - 0.012, -0.01, inner, v + 0.012, 0.006, 4 - inner);
        ds.box(inner, -0.01, v - 0.012, 4 - inner, 0.006, v + 0.012);
      }
    });
  }

  if (b.st >= 3) {
    // anchor bolts: base plate + washer + hex nut at each corner (tops stay below y = 0.05)
    b.optional(() => {
      for (const cx of [0.33, 3.67]) {
        for (const cz of [0.33, 3.67]) {
          gm.box(cx - 0.17, -0.005, cz - 0.17, cx + 0.17, 0.015, cz + 0.17);
          gm.prismY(circle(cx, cz, 0.1, 12), 0.01, 0.025, { bottom: false });
          gm.prismY(circle(cx, cz, 0.07, 6), 0.02, 0.045, { bottom: false });
        }
      }
    });
  }

  if (b.st >= 4) {
    // bolt row along the hazard border
    b.optional(() => {
      const c = CH + FL / 2;
      for (let k = 0; k < 7; k++) {
        const t = 0.8 + 0.4 * k;
        ds.bolt('y', t, 0, c, 1, 0.03, 0.02);
        ds.bolt('y', t, 0, 4 - c, 1, 0.03, 0.02);
        ds.bolt('y', c, 0, t, 1, 0.03, 0.02);
        ds.bolt('y', 4 - c, 0, t, 1, 0.03, 0.02);
      }
    });
  }

  return b.finish();
}

// ---------------------------------------------------------------------------
// WALL (also the frame for the airlock)
// ---------------------------------------------------------------------------

const WZ = 0.125; // half thickness of frame members
const BZ = 0.085; // half thickness of the panel body
const PZ = 0.1; // half thickness of embossed plates
const FOOT = 0.25; // top of the hazard foot strip
const RAIL0 = 2.82; // underside of the top rail

const FOOT_PROFILE: readonly P2[] = [
  [-WZ, 0],
  [WZ, 0],
  [WZ, FOOT - 0.035],
  [0.09, FOOT],
  [-0.09, FOOT],
  [-WZ, FOOT - 0.035],
];
const RAIL_PROFILE: readonly P2[] = [
  [-WZ, RAIL0],
  [WZ, RAIL0],
  [WZ, 3 - 0.035],
  [0.09, 3],
  [-0.09, 3],
  [-WZ, 3 - 0.035],
];

const STILE_BOLT_Y = [0.55, 1.05, 1.55, 2.05, 2.55] as const;

/** Framed panel segments between stiles; returns the stile centres. */
function wallFrame(b: Build, spans: ReadonlyArray<readonly [number, number]>): number[] {
  const pa = b.L(b.mats.paint);
  const gm = b.L(b.mats.gunmetal);
  const ds = b.L(b.mats.darkSteel);
  const hz = b.L(b.mats.hazard);
  const sw = b.chunky ? 0.24 : 0.14;
  const allStiles: number[] = [];

  for (const [xa, xb] of spans) {
    const len = xb - xa;
    const n = Math.max(1, Math.round(len / (b.chunky ? 2 : 1)));
    pa.box(xa, FOOT, -BZ, xb, RAIL0, BZ);
    if (b.chunky) hz.box(xa, 0, -WZ, xb, FOOT, WZ);
    else hz.prismX(FOOT_PROFILE, xa, xb);

    const cs: number[] = [xa + sw / 2, xb - sw / 2];
    for (let k = 1; k < n; k++) cs.push(xa + (len * k) / n);
    cs.sort((p, q) => p - q);
    for (const c of cs) {
      if (b.st >= 3) gm.prismY(rrect(c, 0, sw, 2 * WZ, 0.03, 1), FOOT, RAIL0);
      else gm.box(c - sw / 2, FOOT, -WZ, c + sw / 2, RAIL0, WZ);
    }
    allStiles.push(...cs);

    if (b.st >= 2) {
      b.optional(() => {
        for (let i = 0; i + 1 < cs.length; i++) {
          const ia = at(cs, i) + sw / 2;
          const ib = at(cs, i + 1) - sw / 2;
          const w = ib - ia;
          if (w < 0.2) continue;
          const cx = (ia + ib) / 2;
          // kick plate
          ds.box(ia, FOOT, -PZ, ib, 0.6, PZ);
          // panel seams (dark bars sitting in the gaps between plates)
          ds.box(ia, 0.61, -(BZ + 0.005), ib, 0.67, BZ + 0.005);
          ds.box(ia, 1.47, -(BZ + 0.005), ib, 1.53, BZ + 0.005);
          // embossed plates
          pa.prismZ(rrect(cx, (0.68 + 1.46) / 2, w - 0.12, 1.46 - 0.68, 0.035, 1), -PZ, PZ);
          pa.prismZ(rrect(cx, (1.54 + 2.74) / 2, w - 0.12, 2.74 - 1.54, 0.035, 1), -PZ, PZ);
        }
      });
    }
  }

  if (b.st >= 3) {
    b.optional(() => {
      for (const c of allStiles) {
        for (const y of STILE_BOLT_Y) {
          for (const s of SIDES) ds.bolt('z', c, y, s * WZ, s, 0.028, 0.02);
        }
      }
    });
  }
  return allStiles;
}

function topRail(b: Build, x0: number, x1: number): void {
  const gm = b.L(b.mats.gunmetal);
  const ds = b.L(b.mats.darkSteel);
  if (b.chunky) gm.box(x0, RAIL0, -WZ, x1, 3, WZ);
  else gm.prismX(RAIL_PROFILE, x0, x1);
  if (b.st >= 3) {
    b.optional(() => {
      for (let k = 0; k < 8; k++) {
        for (const s of SIDES) ds.bolt('z', 0.25 + 0.5 * k, 2.91, s * WZ, s, 0.028, 0.02);
      }
    });
  }
}

export function wall(m: LabMaterials, opts: PieceOptions = {}): Piece {
  const b = new Build(m, opts.stage, 'wall');
  const ds = b.L(b.mats.darkSteel);
  const cu = b.L(b.mats.copper);
  const stiles = wallFrame(b, [[0, 4]]);
  topRail(b, 0, 4);

  if (b.st >= 5) {
    // copper conduit along the +z face under the top rail, clamped at every stile
    b.optional(() => {
      cu.prismX(circle(0.15, 2.66, 0.03, 8), 0.14, 3.86);
      for (const c of stiles) ds.prismX(circle(0.15, 2.66, 0.042, 8), c - 0.025, c + 0.025);
    });
  }

  b.col(0, 0, -WZ, 4, 3, WZ);
  return b.finish();
}

// ---------------------------------------------------------------------------
// PILLAR
// ---------------------------------------------------------------------------

export function pillar(m: LabMaterials, opts: PieceOptions = {}): Piece {
  const b = new Build(m, opts.stage, 'pillar');
  const pa = b.L(b.mats.paint);
  const gm = b.L(b.mats.gunmetal);
  const ds = b.L(b.mats.darkSteel);
  const hz = b.L(b.mats.hazard);
  const cu = b.L(b.mats.copper);

  // base plate, box column, top cap (cap top sits 3 cm under the deck above)
  gm.prismY(rrect(0, 0, 0.7, 0.7, 0.08, 1), 0, 0.05);
  pa.prismY(rrect(0, 0, 0.4, 0.4, 0.06, 1), 0.05, 2.91);
  gm.prismY(rrect(0, 0, 0.56, 0.56, 0.07, 1), 2.91, 2.97);
  // hazard band at 1 m
  hz.prismY(rrect(0, 0, 0.412, 0.412, 0.07, 1), 0.9, 1.1, { top: false, bottom: false });

  // four gussets
  const gt = b.chunky ? 0.08 : 0.05;
  const gp = (sg: number): P2[] => [
    [sg * 0.19, 0.04],
    [sg * 0.34, 0.04],
    [sg * 0.34, 0.07],
    [sg * 0.19, 0.45],
  ];
  for (const sg of SIDES) {
    gm.prismZ(gp(sg), -gt, gt);
    gm.prismX(gp(sg), -gt, gt);
  }

  if (b.st >= 2) {
    b.optional(() => {
      // vertical weld seams down the middle of each face
      ds.box(0.196, 0.2, -0.007, 0.206, 2.8, 0.007);
      ds.box(-0.206, 0.2, -0.007, -0.196, 2.8, 0.007);
      ds.box(-0.007, 0.2, 0.196, 0.007, 2.8, 0.206);
      ds.box(-0.007, 0.2, -0.206, 0.007, 2.8, -0.196);
      // collar seams
      for (const y of [0.45, 1.6, 2.2]) {
        ds.prismY(rrect(0, 0, 0.41, 0.41, 0.07, 1), y, y + 0.025, { top: false, bottom: false });
      }
    });
  }

  if (b.st >= 3) {
    b.optional(() => {
      for (const sx of SIDES) {
        for (const sz of SIDES) ds.bolt('y', sx * 0.27, 0.05, sz * 0.27, 1, 0.035, 0.035);
      }
      for (const y of [0.62, 2.5]) {
        for (const o of [-0.09, 0.09]) {
          for (const s of SIDES) ds.bolt('x', s * 0.2, y, o, s, 0.028, 0.02);
          ds.bolt('z', o, y, -0.2, -1, 0.028, 0.02);
        }
      }
    });
  }

  if (b.st >= 5) {
    b.optional(() => {
      cu.prismY(circle(0, 0.215, 0.02, 8), 0.12, 2.88);
      for (const y of [0.6, 1.3, 2.0, 2.6]) ds.prismY(circle(0, 0.215, 0.032, 8), y, y + 0.05);
    });
  }

  b.col(-0.2, 0, -0.2, 0.2, 3, 0.2);
  b.col(-0.35, 0, -0.35, 0.35, 0.05, 0.35);
  return b.finish();
}

// ---------------------------------------------------------------------------
// FLOOR
// ---------------------------------------------------------------------------

export function floor(m: LabMaterials, opts: PieceOptions = {}): Piece {
  const b = new Build(m, opts.stage, 'floor');
  const gm = b.L(b.mats.gunmetal);
  const pa = b.L(b.mats.paint);
  const ds = b.L(b.mats.darkSteel);

  // perimeter beam ring (y -0.3 .. -0.05)
  const outer = b.chunky ? rect4(0.02, 0.02, 3.98, 3.98) : rrect(2, 2, 3.96, 3.96, 0.06, 1);
  const innerRing = b.chunky ? rect4(0.18, 0.18, 3.82, 3.82) : rrect(2, 2, 3.64, 3.64, 0.03, 1);
  gm.ring(outer, innerRing, -0.3, -0.05, mapY);

  // chamfered edge lip, standing 2 cm proud of the deck
  gm.frustum(0.02, 0.02, 3.98, 3.98, -0.05, 0.02, 0.06);
  gm.rectRing(0.08, 0.08, 3.92, 3.92, 0.18, 0.18, 3.82, 3.82, 0.02);
  gm.shell(0.18, 0.18, 3.82, 3.82, 0, 0.02, true);

  // deck plate, top at y = 0
  pa.box(0.1, -0.14, 0.1, 3.9, 0, 3.9);

  b.col(0, -0.3, 0, 4, 0, 4);

  if (b.st >= 2) {
    // underside joists (visible from below) + plate seams on top
    b.optional(() => {
      for (let k = 1; k <= 7; k++) ds.box(0.18, -0.27, 0.5 * k - 0.03, 3.82, -0.14, 0.5 * k + 0.03);
      for (const x of [1, 2, 3]) ds.box(x - 0.025, -0.25, 0.18, x + 0.025, -0.14, 3.82);
    });
    b.optional(() => {
      for (const v of [1, 2, 3]) {
        ds.box(v - 0.012, -0.01, 0.18, v + 0.012, 0.006, 3.82);
        ds.box(0.18, -0.01, v - 0.012, 3.82, 0.006, v + 0.012);
      }
    });
  }

  if (b.st >= 3) {
    // kick plates on the beam sides (flush with the cell edge)
    b.optional(() => {
      const segs: ReadonlyArray<readonly [number, number]> = [
        [0.12, 1.3],
        [1.4, 2.6],
        [2.7, 3.88],
      ];
      for (const [a, c] of segs) {
        ds.box(a, -0.27, 0, c, -0.08, 0.03);
        ds.box(a, -0.27, 3.97, c, -0.08, 4);
        ds.box(0, -0.27, a, 0.03, -0.08, c);
        ds.box(3.97, -0.27, a, 4, -0.08, c);
      }
    });
  }

  if (b.st >= 4) {
    // bolt rows beside the seams
    b.optional(() => {
      for (const v of [1, 2, 3]) {
        for (let k = 0; k < 4; k++) {
          const t = 0.5 + k;
          for (const o of [-0.07, 0.07]) {
            gm.bolt('y', v + o, 0, t, 1, 0.03, 0.014);
            gm.bolt('y', t, 0, v + o, 1, 0.03, 0.014);
          }
        }
      }
    });
    // bolt row along the lip
    b.optional(() => {
      for (let k = 0; k < 7; k++) {
        const t = 0.5 + 0.5 * k;
        ds.bolt('y', t, 0.02, 0.13, 1, 0.028, 0.012);
        ds.bolt('y', t, 0.02, 3.87, 1, 0.028, 0.012);
        ds.bolt('y', 0.13, 0.02, t, 1, 0.028, 0.012);
        ds.bolt('y', 3.87, 0.02, t, 1, 0.028, 0.012);
      }
    });
  }

  return b.finish();
}

// ---------------------------------------------------------------------------
// RAMP
// ---------------------------------------------------------------------------

/** Mirror an x interval for the right-hand side of the ramp. */
const sideX = (right: boolean, x0: number, x1: number): [number, number] => (right ? [4 - x1, 4 - x0] : [x0, x1]);

export function ramp(m: LabMaterials, opts: PieceOptions = {}): Piece {
  const b = new Build(m, opts.stage, 'ramp');
  const ds = b.L(b.mats.darkSteel);
  const gm = b.L(b.mats.gunmetal);
  const hz = b.L(b.mats.hazard);
  const pa = b.L(b.mats.paint);
  const t = b.chunky ? 0.2 : 0.12; // deck thickness

  // deck wedge: top y = 0.75 z, underside tapers to the ground
  const deck: P2[] = [
    [0, 0],
    [4, 3],
    [4, 3 - t],
    [t / SLOPE, 0],
  ];
  ds.prismX(deck, 0.06, 3.94);

  // hazard nosing at both ends of the deck
  const nose = b.chunky ? 0.1 : 0.06;
  hz.prismX(para(0, 0.32, 0, nose), 0.22, 3.78);
  hz.prismX(para(3.68, 4, 0, nose), 0.22, 3.78);

  // side stringers, posts and handrails (both sides)
  const web: P2[] = [
    [0, 0],
    [0, 0.06],
    [4, 3.06],
    [4, 2.5],
    [0.5 / SLOPE, 0],
  ];
  const postZ = b.chunky ? [0.15, 2, 3.85] : [0.15, 1.1, 2.05, 3, 3.85];
  const pw = b.chunky ? 0.05 : 0.03; // post half width
  for (const right of [false, true]) {
    if (b.chunky) {
      const [x0, x1] = sideX(right, 0, 0.22);
      gm.prismX(web, x0, x1);
    } else {
      const [w0, w1] = sideX(right, 0, 0.06);
      gm.prismX(web, w0, w1);
      const [f0, f1] = sideX(right, 0, 0.22);
      gm.prismX(para(0, 4, 0, 0.06), f0, f1); // top flange
      const [g0, g1] = sideX(right, 0, 0.18);
      gm.prismX(para(0.7, 4, -0.5, 0.05), g0, g1); // bottom flange
    }
    const [px0, px1] = sideX(right, 0.11 - pw, 0.11 + pw);
    for (const z of postZ) pa.box(px0, SLOPE * z + 0.02, z - 0.03, px1, SLOPE * z + 1, z + 0.03);
    const [r0, r1] = sideX(right, 0.075, 0.145);
    pa.prismX(para(0.15, 3.85, 0.97, 0.06), r0, r1);
  }

  // colliders: stepped boxes follow the slope; rails bump at handrail height
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const z0 = (4 * i) / steps;
    const z1 = (4 * (i + 1)) / steps;
    b.col(0, 0, z0, 4, SLOPE * ((z0 + z1) / 2), z1);
  }
  for (let i = 0; i < 6; i++) {
    const z0 = (4 * i) / 6;
    const z1 = (4 * (i + 1)) / 6;
    const top = SLOPE * z1 + 1;
    b.col(0, 0, z0, 0.14, top, z1);
    b.col(3.86, 0, z0, 4, top, z1);
  }

  if (b.st >= 2) {
    // mid rails, kick plates, underside cross members
    b.optional(() => {
      for (const right of [false, true]) {
        const [a0, a1] = sideX(right, 0.09, 0.13);
        pa.prismX(para(0.15, 3.85, 0.5, 0.04), a0, a1);
        const [k0, k1] = sideX(right, 0.095, 0.125);
        pa.prismX(para(0.1, 3.9, 0.06, 0.12), k0, k1);
      }
      for (const zc of [1, 2, 3]) {
        const yb = SLOPE * zc - t - 0.2;
        const cross: P2[] = [
          [zc - 0.04, SLOPE * (zc - 0.04) - t],
          [zc + 0.04, SLOPE * (zc + 0.04) - t],
          [zc + 0.04, yb],
          [zc - 0.04, yb],
        ];
        ds.prismX(cross, 0.06, 3.94);
      }
    });
  }

  if (b.st >= 3) {
    // grated deck: cross bars + load bars over the dark deck plate, with joint straps
    b.optional(() => {
      const straps = [1.36, 2.64];
      for (let k = 0; k < 27; k++) {
        const zc = 0.4 + 0.12 * k;
        if (straps.some((s) => Math.abs(zc - s) < 0.09)) continue;
        gm.prismX(para(zc - 0.025, zc + 0.025, -0.004, 0.058), 0.22, 3.78);
      }
      for (let k = 0; k < 7; k++) {
        const x = 0.5 + 0.5 * k;
        gm.prismX(para(0.34, 3.66, -0.004, 0.07), x - 0.015, x + 0.015);
      }
      for (const s of straps) gm.prismX(para(s - 0.05, s + 0.05, -0.004, 0.074), 0.22, 3.78);
    });
  }

  if (b.st >= 4) {
    // bolt rows on straps and along the stringer top flanges
    b.optional(() => {
      for (const s of [1.36, 2.64]) {
        for (let k = 0; k < 9; k++) ds.prismY(circle(0.4 + 0.4 * k, s, 0.03, 6), SLOPE * s + 0.03, SLOPE * s + 0.085, { bottom: false });
      }
    });
    b.optional(() => {
      for (let k = 0; k < 7; k++) {
        const z = 0.5 + 0.5 * k;
        for (const x of [0.18, 3.82]) {
          ds.prismY(circle(x, z, 0.025, 6), SLOPE * z + 0.02, SLOPE * z + 0.072, { bottom: false });
        }
      }
    });
  }

  return b.finish();
}

// ---------------------------------------------------------------------------
// AIRLOCK
// ---------------------------------------------------------------------------

export function airlock(m: LabMaterials, opts: PieceOptions = {}): Piece {
  const b = new Build(m, opts.stage, 'airlock');
  const { st, chunky } = b;
  const pa = b.L(b.mats.paint);
  const gm = b.L(b.mats.gunmetal);
  const ds = b.L(b.mats.darkSteel);
  const hz = b.L(b.mats.hazard);
  const gl = b.L(b.mats.glass);
  const seg = st >= 6 ? 4 : st >= 3 ? 3 : st >= 2 ? 2 : 1;
  const smooth = st >= 3;
  const sz = st >= 2 ? PZ : BZ; // wall panel surface

  wallFrame(b, [
    [0, 1.1],
    [2.9, 4],
  ]);
  topRail(b, 0, 4);

  // door bay: dark backing, lintel panel, hazard header
  ds.box(1.1, 0, -0.07, 2.9, 2.64, 0.07);
  pa.box(1.1, 2.64, -BZ, 2.9, RAIL0, BZ);
  hz.box(1.2, 2.64, -0.105, 2.8, 2.78, 0.105);

  // thick round-cornered frame and the shut pressure door (1.4 x 2.3, sill 0.14)
  const outer = rrect(2, 1.32, 1.8, 2.64, 0.22, seg);
  const inner = rrect(2, 1.29, 1.4, 2.3, 0.14, seg);
  gm.ring(outer, inner, -0.15, 0.15, mapZ, { smooth });
  ds.prismZ(inner, -0.09, 0.09, { smooth });

  // status lamp (own mesh so the game can drive it)
  b.optional(() => {
    for (const s of SIDES) {
      if (chunky) {
        b.lamp.box(3.35, 2.05, Math.min(s * 0.08, s * 0.15), 3.55, 2.25, Math.max(s * 0.08, s * 0.15));
      } else {
        gm.prismZ(circle(3.45, 2.15, 0.1, 8), s * (sz - 0.01), s * (sz + 0.03), { bottom: false });
        b.lamp.prismZ(circle(3.45, 2.15, 0.07, 12), s * (sz + 0.02), s * (sz + 0.06), { bottom: false, smooth: true });
      }
    }
  });

  // hand wheel on the door
  b.optional(() => {
    for (const s of SIDES) {
      if (chunky) {
        gm.prismZ(circle(2, 0.98, 0.2, 8), s * 0.085, s * 0.16, { bottom: false });
      } else {
        pa.ring(circle(2, 0.98, 0.2, 12), circle(2, 0.98, 0.165, 12), s * 0.15, s * 0.18, mapZ, { smooth: true });
        pa.prismZ(circle(2, 0.98, 0.05, 8), s * 0.105, s * 0.18, { bottom: false });
        for (let k = 0; k < 3; k++) {
          const a = ((90 + 120 * k) * Math.PI) / 180;
          pa.prismZ(rotRect(2, 0.98, a, 0, 0.19, 0.03), s * 0.15, s * 0.175);
        }
      }
    }
  });

  // gauge on the wall beside the door
  b.optional(() => {
    const cx = 3.45;
    const cy = 1.05;
    for (const s of SIDES) {
      if (chunky) {
        gm.prismZ(circle(cx, cy, 0.19, 8), s * (BZ - 0.01), s * (BZ + 0.05), { bottom: false });
        continue;
      }
      const z0 = s * (sz - 0.005);
      gm.ring(circle(cx, cy, 0.19, 12), circle(cx, cy, 0.15, 12), z0, s * (sz + 0.05), mapZ, { smooth: true, bottom: false });
      ds.prismZ(circle(cx, cy, 0.15, 12), z0, s * (sz + 0.02), { bottom: false, smooth: true });
      gl.prismZ(circle(cx, cy, 0.15, 12), s * (sz + 0.02), s * (sz + 0.03), { bottom: false, smooth: true });
      for (let k = 0; k < 5; k++) {
        const a = ((210 - 60 * k) * Math.PI) / 180;
        pa.prismZ(rotRect(cx, cy, a, 0.1, 0.135, 0.012), s * (sz + 0.015), s * (sz + 0.022), { bottom: false });
      }
      const na = (65 * Math.PI) / 180;
      pa.prismZ(rotRect(cx, cy, na, -0.02, 0.11, 0.014), s * (sz + 0.028), s * (sz + 0.036), { bottom: false });
    }
  });

  if (st >= 2) {
    // raised door panel and porthole
    b.optional(() => {
      for (const s of SIDES) {
        gm.prismZ(rrect(2, 1.29, 1.1, 1.9, 0.1, seg), s * 0.085, s * 0.11, { bottom: false, smooth });
      }
    });
    b.optional(() => {
      gm.ring(circle(2, 1.85, 0.2, 12), circle(2, 1.85, 0.15, 12), -0.14, 0.14, mapZ, { smooth: true });
      for (const s of SIDES) {
        ds.prismZ(circle(2, 1.85, 0.15, 12), s * 0.105, s * 0.118, { bottom: false });
        gl.prismZ(circle(2, 1.85, 0.15, 12), s * 0.118, s * 0.126, { bottom: false, smooth: true });
      }
    });
  }

  if (st >= 3) {
    // bolts round the frame
    b.optional(() => {
      for (const s of SIDES) {
        for (const y of [0.3, 0.9, 1.7, 2.3]) {
          ds.bolt('z', 1.2, y, s * 0.15, s, 0.03, 0.02);
          ds.bolt('z', 2.8, y, s * 0.15, s, 0.03, 0.02);
        }
        for (const x of [1.5, 2, 2.5]) ds.bolt('z', x, 2.54, s * 0.15, s, 0.03, 0.02);
      }
    });
  }

  if (st >= 5) {
    // hinge barrels
    b.optional(() => {
      for (const s of SIDES) {
        for (const y of [0.5, 1.3, 2.1]) gm.prismY(circle(1.2, s * 0.17, 0.04, 8), y - 0.11, y + 0.11);
      }
    });
  }

  // colliders: wall either side, lintel above; the doorway stays clear
  b.col(0, 0, -WZ, 1.3, 3, WZ);
  b.col(2.7, 0, -WZ, 4, 3, WZ);
  b.col(1.3, 2.44, -WZ, 2.7, 3, WZ);
  return b.finish();
}

// ---------------------------------------------------------------------------
// ROOF SET: pitched / low roof, hip and valley corners, ridge cap, gable
// ---------------------------------------------------------------------------
// A roof cell sits on the walls of the storey below: its low eave is at y = 0 and
// the sheet sinks 0.05 m into the wall tops. Everything stays inside x 0..4, and the
// roofs never go more than 0.3 m past the eave line (gutter + fascia).

const ROOF_SLOPE = 0.75; // 3 m rise over a 4 m run = 36.9 degrees

/** Parallelogram in (z,y) following slope s: lower edge y = s z + yo, thickness h (vertical). */
function paraS(s: number, z0: number, z1: number, yo: number, h: number): P2[] {
  return [
    [z0, s * z0 + yo],
    [z1, s * z1 + yo],
    [z1, s * z1 + yo + h],
    [z0, s * z0 + yo + h],
  ];
}

/** Orthonormal roof frame rising along +z: u = x, v = normal to the roof, a = distance up-slope. */
function slopeMapZ(s: number): MapFn {
  const th = Math.atan(s);
  const sn = Math.sin(th);
  const cs = Math.cos(th);
  return (u, v, a) => [u, a * sn + v * cs, a * cs - v * sn];
}

/** Orthonormal roof frame rising along +x: u = z, v = normal to the roof, a = distance up-slope. */
function slopeMapX(s: number): MapFn {
  const th = Math.atan(s);
  const sn = Math.sin(th);
  const cs = Math.cos(th);
  return (u, v, a) => [a * cs - v * sn, a * sn + v * cs, u];
}

/** Standing-seam cross-section (sinks into the sheet). */
function seamPoly(c: number, chunky: boolean): P2[] {
  return chunky
    ? [
        [c - 0.1, -0.03],
        [c + 0.1, -0.03],
        [c + 0.06, 0.1],
        [c - 0.06, 0.1],
      ]
    : [
        [c - 0.035, -0.012],
        [c + 0.035, -0.012],
        [c + 0.018, 0.045],
        [c - 0.018, 0.045],
      ];
}

const SEAMS_FINE: readonly number[] = [0.06, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 3.94];
const SEAMS_CHUNKY: readonly number[] = [0.8, 2, 3.2];

/** Lower half circle polyline (n segments) from angle 180 to 360 degrees. */
function arc(cu: number, cy: number, r: number, n: number): P2[] {
  const out: P2[] = [];
  for (let k = 0; k <= n; k++) {
    const a = Math.PI + (k / n) * Math.PI;
    out.push([cu + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

interface CapStation {
  readonly l: V3;
  readonly a: V3;
  readonly r: V3;
}

/**
 * Folded cap plate lying on a two-faced roof: `a` is the fold line, `l` / `r` the leg edges,
 * all given as points on the roof surface. The plate sits `lift` above and `sink` below it.
 */
function capStrip(ms: Mesher, st: readonly CapStation[], lift: number, sink: number): void {
  const up = (p: V3, d: number): V3 => [p[0], p[1] + d, p[2]];
  for (let i = 0; i + 1 < st.length; i++) {
    const p = at(st, i);
    const q = at(st, i + 1);
    const mid: V3 = [(p.a[0] + q.a[0]) / 2, (p.a[1] + q.a[1]) / 2, (p.a[2] + q.a[2]) / 2];
    const above: V3 = [mid[0], mid[1] + 5, mid[2]];
    const below: V3 = [mid[0], mid[1] - 5, mid[2]];
    const faces: ReadonlyArray<readonly [V3, V3, V3, V3]> = [
      [p.l, q.l, q.a, p.a],
      [p.a, q.a, q.r, p.r],
    ];
    for (const [f0, f1, f2, f3] of faces) {
      ms.quad(up(f0, lift), up(f1, lift), up(f2, lift), up(f3, lift), below);
      ms.quad(up(f0, -sink), up(f1, -sink), up(f2, -sink), up(f3, -sink), above);
    }
    ms.quad(up(p.l, lift), up(q.l, lift), up(q.l, -sink), up(p.l, -sink), mid);
    ms.quad(up(p.r, lift), up(q.r, lift), up(q.r, -sink), up(p.r, -sink), mid);
  }
}

/** Four stations along a diagonal fold: pointed at both cell corners, full width in between. */
function capStations(d0: number, f: (u: number, d: number) => CapStation): CapStation[] {
  const e = (d0 + 0.01) / 4;
  return [f(0, 0), f(e, d0), f(1 - e, d0), f(1, 0)];
}

/** Fascia board (0.15 m) on a low eave plus a half-round gutter hung off its face. */
function eave(
  b: Build,
  dir: 'x' | 'z',
  fa0: number,
  fa1: number,
  ga0: number,
  ga1: number,
  off: number,
  trim: number,
): void {
  const pa = b.L(b.mats.paint);
  const gm = b.L(b.mats.gunmetal);
  const ds = b.L(b.mats.darkSteel);
  const fw = b.chunky ? 0.08 : off;
  const y0 = -0.15 + trim;
  const y1 = 0.025 - trim;
  if (dir === 'x') pa.box(fa0, y0, -fw, fa1, y1, 0.02);
  else pa.box(-fw, y0, fa0, 0.02, y1, fa1);

  const R = b.chunky ? 0.1 : 0.09;
  const cu = -fw + 0.015 - R; // back of the gutter sinks 1.5 cm into the fascia
  const cy = -0.02;
  if (b.chunky) {
    const poly = arc(cu, cy, R, 4);
    if (dir === 'x') gm.prismX(poly, ga0, ga1);
    else gm.prismZ(poly, ga0, ga1);
  } else {
    gm.channel(arc(cu, cy, R, 6), arc(cu, cy, R - 0.012, 6), ga0, ga1, dir === 'x' ? mapX : mapZ, [cu, cy]);
  }

  if (b.st >= 3) {
    b.optional(() => {
      const start = Math.max(fa0, 0) + 0.3;
      for (let p = start; p < fa1 - 0.2; p += 0.5) {
        if (dir === 'x') ds.bolt('z', p, -0.12, -fw, -1, 0.018, 0.012, 0.01);
        else ds.bolt('x', -fw, -0.12, p, -1, 0.018, 0.012, 0.01);
      }
    });
  }
}

function pitched(m: LabMaterials, stage: number | undefined, rise: number, name: string): Piece {
  const b = new Build(m, stage, name);
  const ds = b.L(b.mats.darkSteel);
  const gm = b.L(b.mats.gunmetal);
  const hz = b.L(b.mats.hazard);
  const s = rise / 4;
  const cs = Math.cos(Math.atan(s));
  const L = 4 / cs; // sheet length up the slope
  const t = b.chunky ? 0.12 : 0.05;

  // steel sheet: top surface y = s z, vertical thickness t, sinks into the wall tops below
  ds.prismX(paraS(s, 0, 4, -t, t), 0, 4);

  // standing seams running downhill, stopping short of the ridge cap zone
  const sm = slopeMapZ(s);
  const a0 = b.chunky ? 0.35 : 0.06;
  const a1 = L - (b.chunky ? 0.45 : 0.32);
  for (const c of b.chunky ? SEAMS_CHUNKY : SEAMS_FINE) gm.extrude(seamPoly(c, b.chunky), a0, a1, sm);

  // underside: purlin resting on the eave line (sinks into the wall top) + purlins hung under the sheet
  const us = (z: number): number => s * z - t;
  const wz1 = b.chunky ? 0.4 : 0.3;
  const wyb = b.chunky ? -0.12 : -0.05;
  ds.prismX(
    [
      [0.05, wyb],
      [wz1, wyb],
      [wz1, us(wz1) + 0.01],
      [0.05, us(0.05) + 0.01],
    ],
    0.01,
    3.99,
  );
  const mids = b.chunky ? [2] : [1.3, 2.4, 3.5];
  const hw = b.chunky ? 0.12 : 0.07;
  for (const zc of mids) ds.prismX(paraS(s, zc - hw, zc + hw, -t - 0.14, 0.15), 0.01, 3.99);

  // fascia + gutter along the low eave
  eave(b, 'x', 0.012, 3.988, 0, 4, 0.06, 0);

  if (b.st >= 3) {
    // hazard-striped walking strips between the seams at the eave
    b.optional(() => {
      for (let i = 0; i + 1 < SEAMS_FINE.length; i++) {
        hz.prismX(paraS(s, 0.07, 0.33, -0.006, 0.018), at(SEAMS_FINE, i) + 0.04, at(SEAMS_FINE, i + 1) - 0.04);
      }
    });
  }
  if (b.st >= 4) {
    // sheet lap line between the seams
    b.optional(() => {
      for (let i = 0; i + 1 < SEAMS_FINE.length; i++) {
        gm.prismX(paraS(s, 1.96, 2.04, -0.006, 0.016), at(SEAMS_FINE, i) + 0.04, at(SEAMS_FINE, i + 1) - 0.04);
      }
    });
  }

  for (let i = 0; i < 4; i++) b.col(0, 0, i, 4, s * (i + 0.5), i + 1);
  return b.finish();
}

export function pitchedRoof(m: LabMaterials, opts: PieceOptions = {}): Piece {
  return pitched(m, opts.stage, 3, 'pitchedRoof');
}

export function lowRoof(m: LabMaterials, opts: PieceOptions = {}): Piece {
  return pitched(m, opts.stage, 1.5, 'lowRoof');
}

/** Two-faced folded slab over the cell: top y = h(x,z) (a hip or a valley), vertical thickness t. */
function cornerSlab(ms: Mesher, h: (x: number, z: number) => number, t: number): void {
  const pt = (p: P2, d: number): V3 => [p[0], h(p[0], p[1]) + d, p[1]];
  const O: P2 = [0, 0];
  const X: P2 = [4, 0];
  const Z: P2 = [0, 4];
  const D: P2 = [4, 4];
  const tris: ReadonlyArray<readonly [P2, P2, P2]> = [
    [O, X, D],
    [O, D, Z],
  ];
  for (const [p, q, r] of tris) {
    const a = pt(p, 0);
    const bb = pt(q, 0);
    const c = pt(r, 0);
    const cx = (a[0] + bb[0] + c[0]) / 3;
    const cy = (a[1] + bb[1] + c[1]) / 3;
    const cz = (a[2] + bb[2] + c[2]) / 3;
    ms.flat(a, bb, c, [cx, cy - 5, cz]);
    ms.flat(pt(p, -t), pt(q, -t), pt(r, -t), [cx, cy - t + 5, cz]);
  }
  const edges: ReadonlyArray<readonly [P2, P2]> = [
    [O, X],
    [X, D],
    [D, Z],
    [Z, O],
  ];
  for (const [p, q] of edges) ms.quad(pt(p, 0), pt(q, 0), pt(q, -t), pt(p, -t), [2, 0, 2]);
}

export function roofOuterCorner(m: LabMaterials, opts: PieceOptions = {}): Piece {
  const b = new Build(m, opts.stage, 'roofOuterCorner');
  const ds = b.L(b.mats.darkSteel);
  const gm = b.L(b.mats.gunmetal);
  const pa = b.L(b.mats.paint);
  const t = b.chunky ? 0.12 : 0.05;
  const cs = Math.cos(Math.atan(ROOF_SLOPE));

  // surface y = 3 min(x,z) / 4: faces rise from the eaves along z = 0 and x = 0
  cornerSlab(ds, (x, z) => ROOF_SLOPE * Math.min(x, z), t);

  // seams run downhill on each face and stop clear of the hip cap
  const smA = slopeMapZ(ROOF_SLOPE);
  const smB = slopeMapX(ROOF_SLOPE);
  const a0 = b.chunky ? 0.35 : 0.06;
  const minLen = b.chunky ? 0.9 : 0.3;
  for (const c of b.chunky ? SEAMS_CHUNKY : SEAMS_FINE) {
    const a1 = (c - (b.chunky ? 0.6 : 0.42)) / cs;
    if (a1 - a0 < minLen) continue;
    const poly = seamPoly(c, b.chunky);
    gm.extrude(poly, a0, a1, smA);
    gm.extrude(poly, a0, a1, smB);
  }

  // hip cap along the diagonal (0,0,0) -> (4,3,4)
  const d0 = b.chunky ? 0.2 : 0.15;
  const lift = b.chunky ? 0.06 : 0.035;
  const stations = capStations(d0, (u, d) => ({
    a: [4 * u, 3 * u, 4 * u],
    l: [4 * u + d, 3 * u - ROOF_SLOPE * d, 4 * u - d],
    r: [4 * u - d, 3 * u - ROOF_SLOPE * d, 4 * u + d],
  }));
  capStrip(pa, stations, lift, b.chunky ? 0.02 : 0.005);

  if (b.st >= 3) {
    b.optional(() => {
      for (let k = 2; k <= 8; k++) {
        const u = k / 10;
        for (const sg of SIDES) {
          const d = 0.09;
          ds.bolt('y', 4 * u + sg * d, 3 * u - ROOF_SLOPE * d + lift, 4 * u - sg * d, 1, 0.028, 0.02, 0.035);
        }
      }
    });
  }

  // both low eaves: fascia + gutter, meeting in a downpipe outlet at the corner
  eave(b, 'x', -0.06, 3.988, 0, 4, 0.06, 0);
  eave(b, 'z', 0, 3.988, 0, 4, 0.05, 0.005);
  const lo = b.chunky ? -0.265 : -0.225;
  ds.box(lo, b.chunky ? -0.12 : -0.11, lo, 0.012, -0.03, 0.012);
  if (!b.chunky) ds.prismY(circle(-0.11, -0.11, 0.04, 8), -0.3, -0.1);

  for (let k = 0; k < 4; k++) {
    const top = ROOF_SLOPE * (k + 0.5);
    b.col(k, 0, k, 4, top, k + 1);
    if (k < 3) b.col(k, 0, k + 1, k + 1, top, 4);
  }
  return b.finish();
}

export function roofInnerCorner(m: LabMaterials, opts: PieceOptions = {}): Piece {
  const b = new Build(m, opts.stage, 'roofInnerCorner');
  const ds = b.L(b.mats.darkSteel);
  const gm = b.L(b.mats.gunmetal);
  const cu = b.L(b.mats.copper);
  const t = b.chunky ? 0.12 : 0.05;
  const cs = Math.cos(Math.atan(ROOF_SLOPE));
  const len = 4 / cs;

  // surface y = 3 max(x,z) / 4: two faces rise from the low point to the high edges x = 4 and z = 4
  cornerSlab(ds, (x, z) => ROOF_SLOPE * Math.max(x, z), t);

  const smA = slopeMapZ(ROOF_SLOPE);
  const smB = slopeMapX(ROOF_SLOPE);
  const minLen = b.chunky ? 0.9 : 0.3;
  for (const c of b.chunky ? SEAMS_CHUNKY : SEAMS_FINE) {
    const a0 = (c + (b.chunky ? 0.6 : 0.42)) / cs;
    const a1 = len - (b.chunky ? 0.45 : 0.32);
    if (a1 - a0 < minLen) continue;
    const poly = seamPoly(c, b.chunky);
    gm.extrude(poly, a0, a1, smA);
    gm.extrude(poly, a0, a1, smB);
  }

  // copper valley gutter flashing along the diagonal, with raised edge lips
  const d0 = b.chunky ? 0.2 : 0.15;
  const lift = b.chunky ? 0.05 : 0.03;
  const stations = capStations(d0, (u, d) => ({
    a: [4 * u, 3 * u, 4 * u],
    l: [4 * u - d, 3 * u + ROOF_SLOPE * d, 4 * u + d],
    r: [4 * u + d, 3 * u + ROOF_SLOPE * d, 4 * u - d],
  }));
  capStrip(cu, stations, lift, b.chunky ? 0.02 : 0.005);

  const lipAlong = (p: CapStation, q: CapStation, which: 'l' | 'r'): void => {
    const edge = p[which];
    const dx = edge[0] - p.a[0];
    const dz = edge[2] - p.a[2];
    const n = Math.hypot(dx, dz) || 1;
    const side: V3 = [dx / n, 0, dz / n];
    const inset = (st: CapStation): V3 => {
      const e = st[which];
      return [e[0] - side[0] * 0.03, e[1], e[2] - side[2] * 0.03];
    };
    cu.skewBox(inset(p), inset(q), side, b.chunky ? 0.03 : 0.017, -0.025, lift + (b.chunky ? 0.05 : 0.03));
  };
  if (b.st >= 2) {
    b.optional(() => {
      lipAlong(at(stations, 1), at(stations, 2), 'l');
      lipAlong(at(stations, 1), at(stations, 2), 'r');
    });
  }
  if (b.st >= 3) {
    b.optional(() => {
      for (let k = 2; k <= 8; k++) {
        const u = k / 10;
        for (const sg of SIDES) {
          const d = 0.09;
          cu.bolt('y', 4 * u + sg * d, 3 * u + ROOF_SLOPE * d + lift, 4 * u + -sg * d, 1, 0.025, 0.018, 0.035);
        }
      }
    });
  }

  for (let k = 0; k < 4; k++) {
    const top = ROOF_SLOPE * (k + 0.5);
    b.col(0, 0, k, k + 1, top, k + 1);
    if (k > 0) b.col(k, 0, 0, k + 1, top, k);
  }
  return b.finish();
}

/**
 * Ridge cap: inverted-V strip along x 0..4 centred on z = 0, fold line at y = 3,
 * lying on the two roofs that meet back to back below it.
 */
export function ridgeCap(m: LabMaterials, opts: PieceOptions = {}): Piece {
  const b = new Build(m, opts.stage, 'ridgeCap');
  const pa = b.L(b.mats.paint);
  const gm = b.L(b.mats.gunmetal);
  const ds = b.L(b.mats.darkSteel);
  const rb = b.L(b.mats.rubber);
  const W = 0.25;
  const yL = 3 - ROOF_SLOPE * W;

  if (b.chunky) {
    pa.prismX(
      [
        [-W, yL - 0.03],
        [W, yL - 0.03],
        [W, yL + 0.08],
        [0, 3.08],
        [-W, yL + 0.08],
      ],
      0,
      4,
    );
  } else {
    const lift = 0.035;
    const sx = (x: number): CapStation => ({ l: [x, yL, -W], a: [x, 3, 0], r: [x, yL, W] });
    capStrip(pa, [sx(0.015), sx(3.985)], lift, 0.005);

    // end plates: slightly inset from the legs so no faces coincide with the strip
    const hw = W - 0.01;
    const yl = 3 - ROOF_SLOPE * hw;
    const plate: P2[] = [
      [-hw, yL - 0.03],
      [hw, yL - 0.03],
      [hw, yl + lift - 0.012],
      [0, 3 + lift - 0.012],
      [-hw, yl + lift - 0.012],
    ];
    pa.prismX(plate, 0, 0.03);
    pa.prismX(plate, 3.97, 4);

    if (b.st >= 2) {
      // folded bead along the fold line + rubber closure strips under both leg edges
      b.optional(() => {
        gm.prismX(circle(0, 3 + lift, 0.022, 8), 0.2, 3.8);
        for (const sg of SIDES) {
          const zc = sg * 0.22;
          const yc = 3 - ROOF_SLOPE * 0.22;
          rb.skewBox([0.05, yc, zc], [3.95, yc, zc], [0, 0, 1], 0.02, -0.03, 0.015);
        }
      });
    }
    if (b.st >= 3) {
      b.optional(() => {
        for (let k = 0; k < 10; k++) {
          const x = 0.3 + 0.4 * k;
          for (const sg of SIDES) ds.bolt('y', x, 3 - ROOF_SLOPE * 0.17 + lift, sg * 0.17, 1, 0.028, 0.02, 0.035);
        }
      });
    }
  }

  b.col(0, yL - 0.03, -W, 4, 3.05, W);
  return b.finish();
}

/**
 * Gable wall closing the open end of a pitched roof: right triangle in the plane z = 0,
 * base x 0..4 at y = 0, top edge rising from y = 0 (x = 0) to y = 3 (x = 4); 0.25 m thick.
 */
export function gable(m: LabMaterials, opts: PieceOptions = {}): Piece {
  const b = new Build(m, opts.stage, 'gable');
  const pa = b.L(b.mats.paint);
  const gm = b.L(b.mats.gunmetal);
  const ds = b.L(b.mats.darkSteel);
  const hz = b.L(b.mats.hazard);
  const sl = ROOF_SLOPE;
  const rbot = (x: number): number => sl * x - 0.18; // underside of the rake rail

  // panel body: sits inside the rail band and the foot strip so nothing is coplanar
  pa.prismZ(
    [
      [0.4533, 0.2],
      [3.97, 0.2],
      [3.97, sl * 3.97 - 0.14],
    ],
    -BZ,
    BZ,
  );

  // hazard foot strip + a proud cast tip block where the triangle runs out
  if (b.chunky) hz.box(0.42, 0, -WZ, 4, FOOT, WZ);
  else hz.prismX(FOOT_PROFILE, 0.42, 4);
  hz.prismZ(
    [
      [0.01, 0.004],
      [0.46, 0.004],
      [0.46, 0.26],
      [0.35, 0.26],
    ],
    -WZ,
    WZ,
  );

  // raking top rail
  gm.prismZ(
    [
      [0.4, rbot(0.4)],
      [4, rbot(4)],
      [4, 3],
      [0.4, 0.3],
    ],
    -WZ,
    WZ,
  );

  // stiles with slanted tops that sink into the rail
  const centres = b.chunky ? [2, 3.925] : [1.25, 2.6, 3.925];
  const sw = b.chunky ? 0.2 : 0.14;
  const iv: Array<readonly [number, number]> = [];
  for (const xc of centres) {
    let xr = xc + sw / 2;
    if (xr > 3.995) xr = 3.995;
    const xl = xr - sw;
    iv.push([xl, xr]);
    gm.prismZ(
      [
        [xl, FOOT - 0.01],
        [xr, FOOT - 0.01],
        [xr, rbot(xr) + 0.01],
        [xl, rbot(xl) + 0.01],
      ],
      -WZ,
      WZ,
    );
  }

  if (b.st >= 2) {
    // kick plates, seam bars and embossed upper plates in the bays between stiles
    b.optional(() => {
      for (let i = 0; i + 1 < iv.length; i++) {
        const ia = at(iv, i)[1];
        const ib = at(iv, i + 1)[0];
        if (ib - ia < 0.4) continue;
        ds.box(ia - 0.01, FOOT - 0.01, -PZ, ib + 0.01, 0.6, PZ);
        ds.box(ia - 0.01, 0.59, -(BZ + 0.005), ib + 0.01, 0.69, BZ + 0.005);
        const xa = ia + 0.06;
        const xb = ib - 0.06;
        const top = (x: number): number => rbot(x) - 0.07;
        if (top(xa) - 0.68 > 0.08) {
          pa.prismZ(
            [
              [xa, 0.68],
              [xb, 0.68],
              [xb, top(xb)],
              [xa, top(xa)],
            ],
            -PZ,
            PZ,
          );
        }
      }
    });
  }

  if (b.st >= 3) {
    b.optional(() => {
      for (const [xl, xr] of iv) {
        const xc = (xl + xr) / 2;
        for (const y of [0.5, 0.9, 1.3, 1.7, 2.1, 2.5]) {
          if (y > rbot(xl) - 0.12) continue;
          for (const sg of SIDES) ds.bolt('z', xc, y, sg * WZ, sg, 0.028, 0.02);
        }
      }
    });
    b.optional(() => {
      for (let k = 0; k < 8; k++) {
        const x = 0.9 + 0.4 * k;
        for (const sg of SIDES) ds.bolt('z', x, rbot(x) + 0.09, sg * WZ, sg, 0.028, 0.02);
      }
    });
  }

  // stepped colliders under the rake
  for (let i = 0; i < 4; i++) b.col(i, 0, -WZ, i + 1, sl * (i + 0.5), WZ);
  return b.finish();
}
