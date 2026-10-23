/**
 * @hm/partgen: the Shape Press's parts (plans 38 and 39). A generator is a slider schema plus a pure function from slider
 * values and a detail rank to mesh data, so the Studio, the Drafting Table and an agent all edit a part the same way, and
 * the stage unlocks its detail (rank 0 a plain block, 1 its forms, 2 its small details).
 *
 * Pure: no DOM, no three.js, no clock, no randomness. Frames: metres, y up, a part's origin is where it mounts (a bolt:
 * the surface under its head; a panel, a can, a beam: its base centre). Normals are flat (hard-surface facets). UVs are
 * box-projected in metres, so a Texture Mill material or the kit trim sheet tiles at the same scale on any slider value.
 */

export type Rank = 0 | 1 | 2;
export type V3 = readonly [number, number, number];

export interface ParamSpec {
  readonly key: string;
  readonly label: string;
  /** m: metres; deg: degrees; factor: a unitless ratio or scale; count: whole numbers; choice: an index into `choices`. */
  readonly unit: 'm' | 'deg' | 'factor' | 'count' | 'choice';
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
  /** For `choice`: the label of each whole value from min to max. */
  readonly choices?: readonly string[];
}

export type Params = Readonly<Record<string, number>>;

/** A range of the index buffer drawn with one material slot. */
export interface Slot {
  readonly name: string;
  readonly start: number;
  readonly count: number;
}

export interface MeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  readonly slots: readonly Slot[];
  readonly min: V3;
  readonly max: V3;
}

export interface Generator {
  readonly id: string;
  readonly label: string;
  readonly params: readonly ParamSpec[];
  /** The material slots its mesh uses, in draw order. */
  readonly slots: readonly string[];
  build(p: Params, rank: Rank): MeshData;
}

/* ------------------------------------------------------------------ params */

/** Every schema value, clamped to its range and snapped to its step; unknown keys are dropped, missing ones defaulted. */
export function resolveParams(specs: readonly ParamSpec[], given: Params = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of specs) {
    const raw = given[s.key];
    let v = typeof raw === 'number' && Number.isFinite(raw) ? raw : s.default;
    v = Math.min(s.max, Math.max(s.min, v));
    if (s.step > 0) v = s.min + Math.round((v - s.min) / s.step) * s.step;
    out[s.key] = Math.min(s.max, Math.max(s.min, Number(v.toFixed(6))));
  }
  return out;
}

/* ------------------------------------------------------------------ mesh builder */

/** Collects flat-shaded polygons into slot groups, then writes one indexed mesh. */
export class MeshBuilder {
  private readonly bySlot = new Map<string, number[][]>();
  constructor(private readonly slotOrder: readonly string[]) {}

  /** One convex planar polygon (counter-clockwise seen from outside). */
  poly(slot: string, pts: readonly V3[]): void {
    if (pts.length < 3) return;
    let list = this.bySlot.get(slot);
    if (!list) this.bySlot.set(slot, (list = []));
    list.push(pts.flatMap((p) => [p[0], p[1], p[2]]));
  }

  build(): MeshData {
    const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
    const slots: Slot[] = [];
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const order = [...this.slotOrder, ...[...this.bySlot.keys()].filter((k) => !this.slotOrder.includes(k))];
    for (const name of order) {
      const polys = this.bySlot.get(name);
      if (!polys || polys.length === 0) continue;
      const start = idx.length;
      for (const f of polys) {
        const n = f.length / 3;
        const p = (i: number): V3 => [f[i * 3] as number, f[i * 3 + 1] as number, f[i * 3 + 2] as number];
        // Newell's normal: robust for any convex polygon
        let nx = 0, ny = 0, nz = 0;
        for (let i = 0; i < n; i++) {
          const a = p(i), b = p((i + 1) % n);
          nx += (a[1] - b[1]) * (a[2] + b[2]);
          ny += (a[2] - b[2]) * (a[0] + b[0]);
          nz += (a[0] - b[0]) * (a[1] + b[1]);
        }
        const len = Math.hypot(nx, ny, nz);
        // a polygon with no area (a slice through an edge, a collapsed cap) draws nothing and has no normal: drop it
        if (!(len > 1e-12)) continue;
        nx /= len; ny /= len; nz /= len;
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        const base = pos.length / 3;
        for (let i = 0; i < n; i++) {
          const v = p(i);
          pos.push(v[0], v[1], v[2]);
          nor.push(nx, ny, nz);
          // box projection: drop the dominant axis
          if (ax >= ay && ax >= az) uv.push(v[2], v[1]);
          else if (ay >= az) uv.push(v[0], v[2]);
          else uv.push(v[0], v[1]);
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k] as number, v[k] as number);
            max[k] = Math.max(max[k] as number, v[k] as number);
          }
        }
        for (let i = 1; i + 1 < n; i++) idx.push(base, base + i, base + i + 1);
      }
      slots.push({ name, start, count: idx.length - start });
    }
    const empty = pos.length === 0;
    return {
      positions: new Float32Array(pos),
      normals: new Float32Array(nor),
      uvs: new Float32Array(uv),
      indices: new Uint32Array(idx),
      slots,
      min: (empty ? [0, 0, 0] : min) as unknown as V3,
      max: (empty ? [0, 0, 0] : max) as unknown as V3,
    };
  }
}

/** An axis-aligned box from `lo` to `hi`, its edges chamfered by `c` (0: a plain box). */
export function addBox(b: MeshBuilder, slot: string, lo: V3, hi: V3, c = 0): void {
  const [x0, y0, z0] = lo, [x1, y1, z1] = hi;
  const cc = Math.max(0, Math.min(c, (x1 - x0) / 2.01, (y1 - y0) / 2.01, (z1 - z0) / 2.01));
  if (cc <= 1e-6) {
    b.poly(slot, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]); // +z
    b.poly(slot, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]); // -z
    b.poly(slot, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]); // +x
    b.poly(slot, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]); // -x
    b.poly(slot, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]); // +y
    b.poly(slot, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]); // -y
    return;
  }
  // A chamfered box: each corner splits into three points, one pulled in along each of the other two axes.
  const X = [x0, x1], Y = [y0, y1], Z = [z0, z1];
  const ins = (lo2: number, hi2: number, s: number): number => (s ? hi2 - cc : lo2 + cc);
  // corner point (sx, sy, sz) on the face of axis `a`: full on axis a, inset on the other two
  const cp = (sx: number, sy: number, sz: number, a: 0 | 1 | 2): V3 => [
    a === 0 ? (X[sx] as number) : ins(x0, x1, sx),
    a === 1 ? (Y[sy] as number) : ins(y0, y1, sy),
    a === 2 ? (Z[sz] as number) : ins(z0, z1, sz),
  ];
  // the six faces
  b.poly(slot, [cp(0, 0, 1, 2), cp(1, 0, 1, 2), cp(1, 1, 1, 2), cp(0, 1, 1, 2)]);
  b.poly(slot, [cp(1, 0, 0, 2), cp(0, 0, 0, 2), cp(0, 1, 0, 2), cp(1, 1, 0, 2)]);
  b.poly(slot, [cp(1, 0, 1, 0), cp(1, 0, 0, 0), cp(1, 1, 0, 0), cp(1, 1, 1, 0)]);
  b.poly(slot, [cp(0, 0, 0, 0), cp(0, 0, 1, 0), cp(0, 1, 1, 0), cp(0, 1, 0, 0)]);
  b.poly(slot, [cp(0, 1, 1, 1), cp(1, 1, 1, 1), cp(1, 1, 0, 1), cp(0, 1, 0, 1)]);
  b.poly(slot, [cp(0, 0, 0, 1), cp(1, 0, 0, 1), cp(1, 0, 1, 1), cp(0, 0, 1, 1)]);
  // the twelve edge bevels: along x (4), along y (4), along z (4)
  for (const sy of [0, 1]) for (const sz of [0, 1]) {
    const a = cp(0, sy, sz, 1), b2 = cp(1, sy, sz, 1), c2 = cp(1, sy, sz, 2), d = cp(0, sy, sz, 2);
    b.poly(slot, (sy ^ sz) ? [a, b2, c2, d] : [d, c2, b2, a]);
  }
  for (const sx of [0, 1]) for (const sz of [0, 1]) {
    const a = cp(sx, 0, sz, 0), b2 = cp(sx, 1, sz, 0), c2 = cp(sx, 1, sz, 2), d = cp(sx, 0, sz, 2);
    b.poly(slot, (sx ^ sz) ? [d, c2, b2, a] : [a, b2, c2, d]);
  }
  for (const sx of [0, 1]) for (const sy of [0, 1]) {
    const a = cp(sx, sy, 0, 0), b2 = cp(sx, sy, 1, 0), c2 = cp(sx, sy, 1, 1), d = cp(sx, sy, 0, 1);
    b.poly(slot, (sx ^ sy) ? [a, b2, c2, d] : [d, c2, b2, a]);
  }
  // the eight corner triangles
  for (const sx of [0, 1]) for (const sy of [0, 1]) for (const sz of [0, 1]) {
    const t: V3[] = [cp(sx, sy, sz, 0), cp(sx, sy, sz, 1), cp(sx, sy, sz, 2)];
    b.poly(slot, (sx ^ sy ^ sz) ? t : [t[0] as V3, t[2] as V3, t[1] as V3]);
  }
}

/** A vertical prism with `sides` sides (6: a hex head), circumscribed radius `r`, from y0 to y1, centred on x and z. */
export function addPrism(b: MeshBuilder, slot: string, sides: number, r: number, y0: number, y1: number, cx = 0, cz = 0, turn = 0): void {
  const ring = (y: number): V3[] => Array.from({ length: sides }, (_, i) => {
    const a = turn + (i / sides) * Math.PI * 2;
    return [cx + r * Math.cos(a), y, cz - r * Math.sin(a)] as V3;
  });
  const lo = ring(y0), hi = ring(y1);
  b.poly(slot, hi);
  b.poly(slot, [...lo].reverse());
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    b.poly(slot, [lo[i] as V3, lo[j] as V3, hi[j] as V3, hi[i] as V3]);
  }
}

/**
 * A right-triangle prism along x (a gusset): from x0 to x1, its right angle at (y0, z0), one leg up to (y1, z0) and
 * one leg along to (y0, z1). z1 may be below z0 (the wedge then leans the other way).
 */
export function addWedge(b: MeshBuilder, slot: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  const flip = z1 < z0;
  const tri = (x: number): V3[] => [[x, y0, z0], [x, y0, z1], [x, y1, z0]];
  const [a0, b0, c0] = tri(x0) as [V3, V3, V3];
  const [a1, b1, c1] = tri(x1) as [V3, V3, V3];
  const w = (pts: V3[]): V3[] => (flip ? pts : [...pts].reverse());
  b.poly(slot, w([a0, c0, b0])); // the -x end
  b.poly(slot, w([a1, b1, c1])); // the +x end
  b.poly(slot, w([a0, b0, b1, a1])); // the bottom
  b.poly(slot, w([a0, a1, c1, c0])); // the upright back
  b.poly(slot, w([b0, c0, c1, b1])); // the slope
}

/* ------------------------------------------------------------------ generators */

const m = (key: string, label: string, min: number, max: number, step: number, def: number): ParamSpec => ({ key, label, unit: 'm', min, max, step, default: def });

/** A bolt seen from the surface it holds: head above y = 0, shank below. Rank 0 a plain block head, 1 the hex or square head and shank, 2 a washer. */
export const bolt: Generator = {
  id: 'bolt',
  label: 'Bolt',
  slots: ['metal'],
  params: [
    m('headWidth', 'Head width', 0.01, 0.2, 0.005, 0.04),
    m('headHeight', 'Head height', 0.005, 0.1, 0.0025, 0.02),
    m('shankDia', 'Shank diameter', 0.004, 0.12, 0.002, 0.02),
    m('shankLength', 'Shank length', 0, 0.4, 0.005, 0.05),
    { key: 'head', label: 'Head', unit: 'choice', min: 0, max: 1, step: 1, default: 1, choices: ['square', 'hex'] },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const hw = p.headWidth as number, hh = p.headHeight as number, sd = p.shankDia as number, sl = p.shankLength as number;
    let y = 0;
    if (rank >= 2) {
      const ww = hw * 1.35, wt = Math.max(0.002, hh * 0.18);
      addBox(b, 'metal', [-ww / 2, 0, -ww / 2], [ww / 2, wt, ww / 2], wt * 0.3);
      y = wt;
    }
    if (rank === 0 || p.head === 0) addBox(b, 'metal', [-hw / 2, y, -hw / 2], [hw / 2, y + hh, hw / 2], rank >= 2 ? hh * 0.15 : 0);
    else addPrism(b, 'metal', 6, hw / Math.sqrt(3), y, y + hh, 0, 0, Math.PI / 6);
    if (rank >= 1 && sl > 0) addBox(b, 'metal', [-sd / 2, -sl, -sd / 2], [sd / 2, 0, sd / 2]);
    return b.build();
  },
};

/** A flat panel lying on y = 0. Rank 0 a slab, 1 a raised inner plate inside a seam, 2 bolts around the edge. */
export const panel: Generator = {
  id: 'panel',
  label: 'Panel',
  slots: ['plate', 'bolts'],
  params: [
    m('width', 'Width', 0.1, 4, 0.01, 1),
    m('depth', 'Depth', 0.1, 4, 0.01, 0.6),
    m('thickness', 'Thickness', 0.005, 0.2, 0.005, 0.03),
    m('bevel', 'Edge bevel', 0, 0.05, 0.0025, 0.006),
    m('seam', 'Seam inset', 0, 0.2, 0.005, 0.04),
    { key: 'boltsPerSide', label: 'Bolts per side', unit: 'count', min: 0, max: 12, step: 1, default: 3 },
    m('boltHead', 'Bolt head width', 0.01, 0.08, 0.005, 0.025),
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const w = p.width as number, d = p.depth as number, t = p.thickness as number, bev = p.bevel as number, seam = p.seam as number;
    if (rank === 0 || seam <= 0) {
      addBox(b, 'plate', [-w / 2, 0, -d / 2], [w / 2, t, d / 2], rank >= 1 ? bev : 0);
    } else {
      const lip = t * 0.75;
      addBox(b, 'plate', [-w / 2, 0, -d / 2], [w / 2, lip, d / 2], bev);
      const iw = Math.max(0.01, w - 2 * seam), id = Math.max(0.01, d - 2 * seam);
      addBox(b, 'plate', [-iw / 2, lip, -id / 2], [iw / 2, t, id / 2], bev * 0.5);
    }
    const n = p.boltsPerSide as number;
    if (rank >= 2 && n > 0 && seam > 0) {
      const head = Math.min(p.boltHead as number, seam * 0.8);
      const hh = head * 0.45;
      const at = (x: number, z: number): void => addPrism(b, 'bolts', 6, head / Math.sqrt(3), t * 0.75, t * 0.75 + hh, x, z, Math.PI / 6);
      const ex = w / 2 - seam / 2, ez = d / 2 - seam / 2;
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0.5 : i / (n - 1);
        const x = -ex + 2 * ex * f, z = -ez + 2 * ez * f;
        at(x, ez); at(x, -ez);
        if (i > 0 && i < n - 1) { at(ex, z); at(-ex, z); }
      }
    }
    return b.build();
  },
};

/** A square-section can standing on y = 0. Rank 0 a block, 1 bevelled edges, a base band and a top plate, 2 the bands. */
export const can: Generator = {
  id: 'can',
  label: 'Can',
  slots: ['body', 'trim', 'band'],
  params: [
    m('width', 'Width', 0.1, 3, 0.01, 0.5),
    m('depth', 'Depth', 0.1, 3, 0.01, 0.5),
    m('height', 'Height', 0.1, 4, 0.01, 1),
    m('bevel', 'Edge bevel', 0, 0.15, 0.005, 0.04),
    m('baseBand', 'Base band height', 0, 0.4, 0.01, 0.12),
    { key: 'bands', label: 'Bands', unit: 'count', min: 0, max: 4, step: 1, default: 1 },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const w = p.width as number, d = p.depth as number, h = p.height as number, bev = p.bevel as number;
    if (rank === 0) {
      addBox(b, 'body', [-w / 2, 0, -d / 2], [w / 2, h, d / 2]);
      return b.build();
    }
    const bb = Math.min(p.baseBand as number, h * 0.4);
    const lip = Math.min(0.015, w * 0.03);
    if (bb > 0) addBox(b, 'trim', [-w / 2 - lip, 0, -d / 2 - lip], [w / 2 + lip, bb, d / 2 + lip], bev);
    const top = Math.min(0.04, h * 0.05);
    addBox(b, 'body', [-w / 2, bb, -d / 2], [w / 2, h - top, d / 2], bev);
    addBox(b, 'trim', [-w / 2 + bev * 0.5, h - top, -d / 2 + bev * 0.5], [w / 2 - bev * 0.5, h, d / 2 - bev * 0.5], bev * 0.5);
    const n = p.bands as number;
    if (rank >= 2 && n > 0) {
      const bh = Math.min(0.06, h * 0.05);
      for (let i = 0; i < n; i++) {
        const y = h - top - bh * 2.5 - i * bh * 3;
        if (y <= bb) break;
        addBox(b, 'band', [-w / 2 - lip * 0.5, y - bh, -d / 2 - lip * 0.5], [w / 2 + lip * 0.5, y, d / 2 + lip * 0.5], bev);
      }
    }
    return b.build();
  },
};

/** A square tube along x, centred, its underside on y = 0. Rank 0 a solid bar, 1 a hollow tube (open ends show the wall), 2 bevelled edges. */
export const beam: Generator = {
  id: 'beam',
  label: 'Square beam',
  slots: ['steel'],
  params: [
    m('length', 'Length', 0.1, 12, 0.01, 2),
    m('section', 'Section', 0.02, 1, 0.005, 0.12),
    m('wall', 'Wall', 0.002, 0.1, 0.001, 0.008),
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const l = p.length as number, s = p.section as number, wl = Math.min(p.wall as number, s * 0.45);
    const bev = rank >= 2 ? s * 0.06 : 0;
    if (rank === 0) {
      addBox(b, 'steel', [-l / 2, 0, -s / 2], [l / 2, s, s / 2]);
      return b.build();
    }
    // four walls of the tube
    addBox(b, 'steel', [-l / 2, s - wl, -s / 2], [l / 2, s, s / 2], bev);
    addBox(b, 'steel', [-l / 2, 0, -s / 2], [l / 2, wl, s / 2], bev);
    addBox(b, 'steel', [-l / 2, wl, s / 2 - wl], [l / 2, s - wl, s / 2]);
    addBox(b, 'steel', [-l / 2, wl, -s / 2], [l / 2, s - wl, -s / 2 + wl]);
    return b.build();
  },
};

/** A wall vent facing +z, standing on y = 0 with its back on z = 0. Rank 0 a plate, 1 a frame around a recessed back, 2 the slats. */
export const grille: Generator = {
  id: 'grille',
  label: 'Vent grille',
  slots: ['frame', 'slats'],
  params: [
    m('width', 'Width', 0.1, 3, 0.01, 0.6),
    m('height', 'Height', 0.1, 3, 0.01, 0.4),
    m('depth', 'Depth', 0.01, 0.3, 0.005, 0.05),
    m('frame', 'Frame width', 0.01, 0.2, 0.005, 0.04),
    { key: 'slats', label: 'Slats', unit: 'count', min: 1, max: 24, step: 1, default: 6 },
    m('slat', 'Slat thickness', 0.003, 0.05, 0.001, 0.012),
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const w = p.width as number, h = p.height as number, d = p.depth as number;
    const f = Math.min(p.frame as number, w * 0.3, h * 0.3);
    if (rank === 0) {
      addBox(b, 'frame', [-w / 2, 0, 0], [w / 2, h, d]);
      return b.build();
    }
    const back = d * 0.25;
    addBox(b, 'frame', [-w / 2 + f, f, 0], [w / 2 - f, h - f, back]);
    addBox(b, 'frame', [-w / 2, 0, 0], [w / 2, f, d]);
    addBox(b, 'frame', [-w / 2, h - f, 0], [w / 2, h, d]);
    addBox(b, 'frame', [-w / 2, f, 0], [-w / 2 + f, h - f, d]);
    addBox(b, 'frame', [w / 2 - f, f, 0], [w / 2, h - f, d]);
    const n = p.slats as number;
    if (rank >= 2) {
      const t = Math.min(p.slat as number, (h - 2 * f) / (n * 2));
      const gap = (h - 2 * f) / n;
      for (let i = 0; i < n; i++) {
        const y = f + gap * (i + 0.5);
        addBox(b, 'slats', [-w / 2 + f, y - t / 2, back], [w / 2 - f, y + t / 2, d * 0.85]);
      }
    }
    return b.build();
  },
};

/** An L-bracket: a foot on y = 0 reaching +z, an upright at z = 0. Rank 0 two slabs, 1 bevelled, 2 a gusset and bolt heads. */
export const bracket: Generator = {
  id: 'bracket',
  label: 'L-bracket',
  slots: ['steel', 'bolts'],
  params: [
    m('width', 'Width', 0.02, 1, 0.005, 0.12),
    m('upright', 'Upright height', 0.02, 1.5, 0.005, 0.15),
    m('foot', 'Foot length', 0.02, 1.5, 0.005, 0.12),
    m('thickness', 'Thickness', 0.003, 0.08, 0.001, 0.012),
    { key: 'gusset', label: 'Gusset', unit: 'choice', min: 0, max: 1, step: 1, default: 1, choices: ['none', 'gusset'] },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const w = p.width as number, up = p.upright as number, ft = p.foot as number, t = p.thickness as number;
    const bev = rank >= 1 ? t * 0.2 : 0;
    addBox(b, 'steel', [-w / 2, 0, 0], [w / 2, t, ft], bev);
    addBox(b, 'steel', [-w / 2, t, 0], [w / 2, up, t], bev);
    if (rank >= 2) {
      if (p.gusset === 1) {
        const gt = Math.min(t, w * 0.3);
        addWedge(b, 'steel', -gt / 2, gt / 2, t, t + Math.min(up - t, ft) * 0.6, t, t + Math.min(up - t, ft) * 0.6);
      }
      const head = Math.min(w * 0.22, 0.03), hh = head * 0.4;
      const bx = w / 4;
      for (const x of [-bx, bx]) {
        addPrism(b, 'bolts', 6, head / Math.sqrt(3), t, t + hh, x, ft * 0.7, Math.PI / 6);
      }
    }
    return b.build();
  },
};

/** A square duct along x, its underside on y = 0. Rank 0 a bar, 1 a hollow tube, 2 bolted flanges at both ends. */
export const duct: Generator = {
  id: 'duct',
  label: 'Square duct',
  slots: ['duct', 'flange', 'bolts'],
  params: [
    m('length', 'Length', 0.2, 12, 0.01, 1.5),
    m('section', 'Section', 0.05, 1.2, 0.005, 0.25),
    m('wall', 'Wall', 0.003, 0.08, 0.001, 0.01),
    m('flange', 'Flange lip', 0, 0.2, 0.005, 0.04),
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const l = p.length as number, s = p.section as number, wl = Math.min(p.wall as number, s * 0.4), lip = p.flange as number;
    const y0 = rank >= 2 && lip > 0 ? lip : 0;
    if (rank === 0) {
      addBox(b, 'duct', [-l / 2, 0, -s / 2], [l / 2, s, s / 2]);
      return b.build();
    }
    addBox(b, 'duct', [-l / 2, y0 + s - wl, -s / 2], [l / 2, y0 + s, s / 2]);
    addBox(b, 'duct', [-l / 2, y0, -s / 2], [l / 2, y0 + wl, s / 2]);
    addBox(b, 'duct', [-l / 2, y0 + wl, s / 2 - wl], [l / 2, y0 + s - wl, s / 2]);
    addBox(b, 'duct', [-l / 2, y0 + wl, -s / 2], [l / 2, y0 + s - wl, -s / 2 + wl]);
    if (rank >= 2 && lip > 0) {
      const ft = Math.min(0.02, l * 0.05);
      const head = Math.min(lip * 0.5, 0.03);
      for (const x of [-l / 2, l / 2 - ft]) {
        addBox(b, 'flange', [x, 0, -s / 2 - lip], [x + ft, y0 + s + lip, s / 2 + lip], ft * 0.2);
        const bx = x + (x < 0 ? ft : 0);
        const dir = x < 0 ? 1 : -1;
        for (const [yy, zz] of [[y0 + s + lip / 2, 0], [lip / 2, 0], [y0 + s / 2, s / 2 + lip / 2], [y0 + s / 2, -s / 2 - lip / 2]] as const) {
          const hb = head / 2;
          addBox(b, 'bolts', [dir > 0 ? bx : bx - hb, yy - hb, zz - hb], [dir > 0 ? bx + hb : bx, yy + hb, zz + hb]);
        }
      }
    }
    return b.build();
  },
};

/**
 * 8. A flared hopper / funnel standing on y = 0.
 * Rank 0: stepped/flared block silhouette.
 * Rank 1: hollow flared throat + top rim collar + dark inner liner bed.
 * Rank 2: corner rim reinforcement plates and perimeter hex bolts.
 */
export const hopper: Generator = {
  id: 'hopper',
  label: 'Hopper funnel',
  slots: ['body', 'trim', 'liner', 'bolts'],
  params: [
    m('topWidth', 'Top width', 0.2, 3.5, 0.01, 0.9),
    m('topDepth', 'Top depth', 0.2, 3.5, 0.01, 0.9),
    m('bottomWidth', 'Bottom width', 0.1, 2.5, 0.01, 0.48),
    m('bottomDepth', 'Bottom depth', 0.1, 2.5, 0.01, 0.48),
    m('height', 'Height', 0.1, 2.5, 0.01, 0.42),
    m('rimHeight', 'Rim collar height', 0.02, 0.3, 0.005, 0.07),
    m('wall', 'Wall thickness', 0.01, 0.2, 0.005, 0.045),
    { key: 'shape', label: 'Section shape', unit: 'choice', min: 0, max: 1, step: 1, default: 0, choices: ['square', 'oct'] },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const tw = p.topWidth as number, td = p.topDepth as number;
    const bw = Math.min(tw, p.bottomWidth as number), bd = Math.min(td, p.bottomDepth as number);
    const h = p.height as number, rh = Math.min(h * 0.45, p.rimHeight as number);
    const wl = Math.min(p.wall as number, tw * 0.22, td * 0.22);
    const neckH = Math.max(0.03, h * 0.22);
    const midY = h - rh;

    if (rank === 0) {
      addBox(b, 'body', [-bw / 2, 0, -bd / 2], [bw / 2, neckH, bd / 2]);
      addBox(b, 'body', [-tw / 2, neckH, -td / 2], [tw / 2, h, td / 2]);
      return b.build();
    }

    if (p.shape === 1) {
      const rBot = Math.min(bw, bd) * 0.52;
      const rTop = Math.min(tw, td) * 0.52;
      addPrism(b, 'body', 8, rBot, 0, midY, 0, 0, Math.PI / 8);
      addPrism(b, 'trim', 8, rTop, midY, h, 0, 0, Math.PI / 8);
      addPrism(b, 'liner', 8, Math.max(0.05, rTop - wl), midY - 0.02, h - 0.01, 0, 0, Math.PI / 8);
    } else {
      // Lower neck + flared mid-tier + top collar rim
      addBox(b, 'body', [-bw / 2, 0, -bd / 2], [bw / 2, neckH, bd / 2], 0.01);
      const mw = (bw + tw) * 0.5, md = (bd + td) * 0.5;
      addBox(b, 'body', [-mw / 2, neckH, -md / 2], [mw / 2, midY, md / 2], 0.015);
      // Four outer rim walls
      addBox(b, 'trim', [-tw / 2, midY, -td / 2], [tw / 2, h, -td / 2 + wl], 0.008);
      addBox(b, 'trim', [-tw / 2, midY, td / 2 - wl], [tw / 2, h, td / 2], 0.008);
      addBox(b, 'trim', [-tw / 2, midY, -td / 2 + wl], [-tw / 2 + wl, h, td / 2 - wl]);
      addBox(b, 'trim', [tw / 2 - wl, midY, -td / 2 + wl], [tw / 2, h, td / 2 - wl]);
      // Recessed dark ore-bed liner plate
      addBox(b, 'liner', [-tw / 2 + wl, midY, -td / 2 + wl], [tw / 2 - wl, h - rh * 0.35, td / 2 - wl]);
    }

    if (rank >= 2) {
      const head = Math.min(0.03, wl * 0.65), hh = head * 0.45;
      const ex = tw / 2 - wl * 0.5, ez = td / 2 - wl * 0.5;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addPrism(b, 'bolts', 6, head / Math.sqrt(3), h, h + hh, sx * ex, sz * ez, Math.PI / 6);
        }
      }
    }
    return b.build();
  },
};

/**
 * 9. An angled U-channel feed/discharge chute along z, standing on y = 0.
 * Rank 0: stepped chute block.
 * Rank 1: bottom trough plate + raised side cheek walls + intake lip.
 * Rank 2: side stiffener ribs and bolt heads along both cheeks.
 */
export const chute: Generator = {
  id: 'chute',
  label: 'Slide chute',
  slots: ['trough', 'cheeks', 'bolts'],
  params: [
    m('width', 'Width', 0.15, 2.5, 0.01, 0.56),
    m('length', 'Length', 0.2, 3.5, 0.01, 0.8),
    m('drop', 'Vertical rise', 0.05, 1.5, 0.01, 0.28),
    m('cheekHeight', 'Side wall height', 0.04, 0.6, 0.01, 0.16),
    m('wall', 'Wall thickness', 0.008, 0.08, 0.002, 0.024),
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const w = p.width as number, l = p.length as number, drop = p.drop as number;
    const ch = p.cheekHeight as number, wl = Math.min(p.wall as number, w * 0.2);
    const totalH = drop + ch;

    if (rank === 0) {
      addBox(b, 'trough', [-w / 2, 0, -l / 2], [w / 2, totalH, l / 2]);
      return b.build();
    }

    // Stepped trough floor + two full-height side cheeks
    addBox(b, 'trough', [-w / 2 + wl, 0, -l / 2], [w / 2 - wl, wl + drop * 0.5, l / 2], wl * 0.15);
    addBox(b, 'trough', [-w / 2 + wl, wl + drop * 0.5, -l / 2], [w / 2 - wl, wl + drop, 0], wl * 0.15);
    addBox(b, 'cheeks', [-w / 2, 0, -l / 2], [-w / 2 + wl, totalH, l / 2], wl * 0.2);
    addBox(b, 'cheeks', [w / 2 - wl, 0, -l / 2], [w / 2, totalH, l / 2], wl * 0.2);
    // Back intake baffle
    addBox(b, 'cheeks', [-w / 2 + wl, wl + drop, -l / 2], [w / 2 - wl, totalH, -l / 2 + wl]);

    if (rank >= 2) {
      const head = Math.min(0.026, wl * 0.9), hh = head * 0.45;
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - wl * 0.5);
        for (const fz of [-0.32, 0, 0.32]) {
          addPrism(b, 'bolts', 6, head / Math.sqrt(3), totalH, totalH + hh, x, fz * l, Math.PI / 6);
        }
      }
    }
    return b.build();
  },
};

/**
 * 10. A cylindrical or octagonal pressure tank (round where function requires a pressure vessel).
 * Can stand vertically (axis = 'y') or lie horizontally along x on twin saddle cradles (axis = 'x').
 * Rank 0: coarse prism silhouette.
 * Rank 1: multi-sided cylinder shell + stepped end caps + saddle cradles (when horizontal).
 * Rank 2: circumferential reinforcement ribs and end-flange bolt rings.
 */
export const tank: Generator = {
  id: 'tank',
  label: 'Pressure tank',
  slots: ['shell', 'caps', 'ribs', 'bolts'],
  params: [
    m('radius', 'Radius', 0.15, 2.0, 0.01, 0.65),
    m('length', 'Length / height', 0.3, 6.0, 0.02, 2.2),
    { key: 'axis', label: 'Axis', unit: 'choice', min: 0, max: 1, step: 1, default: 0, choices: ['y', 'x'] },
    { key: 'sides', label: 'Facet sides', unit: 'count', min: 6, max: 24, step: 2, default: 12 },
    m('capLength', 'End cap length', 0.04, 0.4, 0.01, 0.12),
    { key: 'ribs', label: 'Reinforcement ribs', unit: 'count', min: 0, max: 6, step: 1, default: 2 },
    m('ribHeight', 'Rib protrusion', 0.01, 0.1, 0.005, 0.03),
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const r = p.radius as number, len = p.length as number;
    const cap = Math.min(p.capLength as number, len * 0.2);
    const sides = rank === 0 ? 8 : (p.sides as number);
    const nRibs = p.ribs as number, rh = p.ribHeight as number;

    if (p.axis === 0) {
      // Vertical tank standing on y = 0..len
      if (rank === 0) {
        addPrism(b, 'shell', 8, r, 0, len, 0, 0, Math.PI / 8);
        return b.build();
      }
      addPrism(b, 'caps', sides, r * 0.92, 0, cap, 0, 0, Math.PI / sides);
      addPrism(b, 'shell', sides, r, cap, len - cap, 0, 0, Math.PI / sides);
      addPrism(b, 'caps', sides, r * 0.9, len - cap, len, 0, 0, Math.PI / sides);
      if (rank >= 2 && nRibs > 0) {
        const span = len - 2 * cap;
        for (let i = 0; i < nRibs; i++) {
          const yc = cap + ((i + 1) / (nRibs + 1)) * span;
          addPrism(b, 'ribs', sides, r + rh, yc - 0.035, yc + 0.035, 0, 0, Math.PI / sides);
        }
        const boltR = r * 0.72;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          addPrism(b, 'bolts', 6, 0.022, len, len + 0.018, Math.cos(a) * boltR, Math.sin(a) * boltR, Math.PI / 6);
        }
      }
      return b.build();
    }

    // Horizontal tank along x: supported on y = 0 by twin saddle cradles so its bottom sits at y = 0
    const cy = r;
    const addHorizPrism = (slot: string, n: number, rad: number, x0: number, x1: number): void => {
      const ring = (x: number): V3[] =>
        Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2;
          return [x, cy + rad * Math.cos(a), rad * Math.sin(a)] as V3;
        });
      const lo = ring(x0), hi = ring(x1);
      b.poly(slot, hi);
      b.poly(slot, [...lo].reverse());
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        b.poly(slot, [lo[i] as V3, lo[j] as V3, hi[j] as V3, hi[i] as V3]);
      }
    };

    const sx = Math.max(0.12, len * 0.28);
    const sw = Math.min(0.24, len * 0.15);
    addBox(b, 'caps', [-sx - sw / 2, 0, -r * 0.85], [-sx + sw / 2, r * 0.55, r * 0.85]);
    addBox(b, 'caps', [sx - sw / 2, 0, -r * 0.85], [sx + sw / 2, r * 0.55, r * 0.85]);

    if (rank === 0) {
      addHorizPrism('shell', 8, r, -len / 2, len / 2);
      return b.build();
    }

    addHorizPrism('caps', sides, r * 0.88, -len / 2, -len / 2 + cap);
    addHorizPrism('shell', sides, r, -len / 2 + cap, len / 2 - cap);
    addHorizPrism('caps', sides, r * 0.88, len / 2 - cap, len / 2);

    if (rank >= 2 && nRibs > 0) {
      const span = len - 2 * cap;
      for (let i = 0; i < nRibs; i++) {
        const xc = -len / 2 + cap + ((i + 1) / (nRibs + 1)) * span;
        addHorizPrism('ribs', sides, r + rh, xc - 0.04, xc + 0.04);
      }
    }
    return b.build();
  },
};

/**
 * 11. A functional fluid/steam pipe with optional 90-degree elbow and bolted flanges.
 * Stands on y = 0 up to `length`, with optional horizontal elbow branch along +x (`elbow = 1`).
 */
export const pipe: Generator = {
  id: 'pipe',
  label: 'Flanged pipe',
  slots: ['pipe', 'flange', 'bolts'],
  params: [
    m('radius', 'Pipe radius', 0.025, 0.35, 0.005, 0.08),
    m('length', 'Vertical length', 0.15, 4.0, 0.01, 0.8),
    m('armLength', 'Elbow arm length', 0.1, 2.0, 0.01, 0.36),
    { key: 'elbow', label: 'Mode', unit: 'choice', min: 0, max: 1, step: 1, default: 0, choices: ['straight', 'elbow-90'] },
    { key: 'sides', label: 'Sides', unit: 'count', min: 4, max: 16, step: 2, default: 8 },
    m('flangeWidth', 'Flange lip', 0.01, 0.12, 0.005, 0.03),
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const r = p.radius as number, len = p.length as number, arm = p.armLength as number;
    const lip = p.flangeWidth as number;
    const sides = rank === 0 ? 6 : (p.sides as number);
    const fh = Math.min(0.035, len * 0.12);

    addPrism(b, 'pipe', sides, r, 0, len, 0, 0, Math.PI / sides);
    if (p.elbow === 1) {
      addBox(b, 'pipe', [-r, len - r * 2, -r], [arm, len, r], rank >= 1 ? r * 0.25 : 0);
    }
    if (rank >= 1) {
      addPrism(b, 'flange', sides, r + lip, 0, fh, 0, 0, Math.PI / sides);
      if (p.elbow === 0) {
        addPrism(b, 'flange', sides, r + lip, len - fh, len, 0, 0, Math.PI / sides);
      } else {
        addBox(b, 'flange', [arm - fh, len - r * 2 - lip, -r - lip], [arm, len + lip, r + lip], 0.005);
      }
    }
    if (rank >= 2) {
      const br = r + lip * 0.55;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        addPrism(b, 'bolts', 6, Math.min(0.014, lip * 0.4), fh, fh + 0.012, Math.cos(a) * br, Math.sin(a) * br, Math.PI / 6);
      }
    }
    return b.build();
  },
};

/**
 * 12. A heavy industrial door/hatch hinge standing on y = 0.
 * Rank 0: block silhouette. Rank 1: twin leaf plates + central knuckle bar. Rank 2: split knuckles + hex bolts.
 */
export const hinge: Generator = {
  id: 'hinge',
  label: 'Heavy hinge',
  slots: ['plate', 'pin', 'bolts'],
  params: [
    m('width', 'Total width', 0.04, 0.4, 0.005, 0.1),
    m('height', 'Height', 0.04, 0.5, 0.005, 0.14),
    m('thickness', 'Leaf thickness', 0.005, 0.05, 0.002, 0.014),
    m('pinRadius', 'Knuckle radius', 0.006, 0.05, 0.002, 0.016),
    { key: 'knuckles', label: 'Knuckle segments', unit: 'count', min: 2, max: 5, step: 1, default: 3 },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const w = p.width as number, h = p.height as number, t = p.thickness as number, pr = p.pinRadius as number;

    if (rank === 0) {
      addBox(b, 'plate', [-w / 2, 0, 0], [w / 2, h, Math.max(t, pr * 1.8)]);
      return b.build();
    }

    const gap = Math.min(pr * 0.6, w * 0.15);
    addBox(b, 'plate', [-w / 2, 0, 0], [-gap, h, t], t * 0.15);
    addBox(b, 'plate', [gap, 0, 0], [w / 2, h, t], t * 0.15);

    const kCount = rank >= 2 ? (p.knuckles as number) : 1;
    const segH = h / kCount;
    for (let i = 0; i < kCount; i++) {
      const y0 = i * segH + (kCount > 1 ? 0.003 : 0);
      const y1 = (i + 1) * segH - (kCount > 1 ? 0.003 : 0);
      addPrism(b, 'pin', 6, pr, y0, y1, 0, t + pr * 0.5, Math.PI / 6);
    }

    if (rank >= 2) {
      const head = Math.min(0.018, (w / 2 - gap) * 0.45), hh = head * 0.45;
      for (const sx of [-1, 1]) {
        const bx = sx * (gap + (w / 2 - gap) * 0.55);
        for (const fy of [0.28, 0.72]) {
          addBox(b, 'bolts', [bx - head / 2, fy * h - head / 2, t], [bx + head / 2, fy * h + head / 2, t + hh]);
        }
      }
    }
    return b.build();
  },
};

/**
 * 13. A grab handle or machine throw lever standing on y = 0.
 * `mode = 0`: U-bar grab handle with twin end standoffs.
 * `mode = 1`: Throw lever with base pivot block, angled shaft, and cross T-grip.
 */
export const handle: Generator = {
  id: 'handle',
  label: 'Handle / throw lever',
  slots: ['mount', 'shaft', 'grip', 'bolts'],
  params: [
    m('span', 'Span / length', 0.08, 0.8, 0.01, 0.24),
    m('reach', 'Standoff / height', 0.04, 0.5, 0.005, 0.09),
    m('thickness', 'Bar thickness', 0.01, 0.08, 0.002, 0.022),
    m('gripWidth', 'T-grip width', 0.06, 0.4, 0.01, 0.14),
    { key: 'mode', label: 'Type', unit: 'choice', min: 0, max: 1, step: 1, default: 0, choices: ['u-handle', 'throw-lever'] },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const span = p.span as number, reach = p.reach as number, th = p.thickness as number, gw = p.gripWidth as number;

    if (p.mode === 1) {
      // Throw lever
      const bw = Math.max(th * 2.2, 0.06);
      addBox(b, 'mount', [-bw / 2, 0, -bw * 0.8], [bw / 2, bw * 0.7, bw * 0.8], rank >= 1 ? 0.004 : 0);
      addBox(b, 'shaft', [-th / 2, bw * 0.5, -th / 2], [th / 2, reach + span * 0.5, th / 2], rank >= 1 ? 0.003 : 0);
      addBox(b, 'grip', [-gw / 2, reach + span * 0.5 - th, -th * 0.8], [gw / 2, reach + span * 0.5 + th * 0.6, th * 0.8], rank >= 1 ? 0.004 : 0);
      if (rank >= 2) {
        const hd = 0.014;
        for (const sx of [-1, 1]) {
          addPrism(b, 'bolts', 6, hd, bw * 0.7, bw * 0.7 + 0.008, sx * bw * 0.32, 0, Math.PI / 6);
        }
      }
      return b.build();
    }

    // U-bar grab handle
    if (rank === 0) {
      addBox(b, 'grip', [-span / 2, 0, -th / 2], [span / 2, reach, th / 2]);
      return b.build();
    }
    const legX = span / 2 - th * 0.75;
    const footW = th * 1.8, footH = Math.min(0.016, reach * 0.22);
    for (const sx of [-1, 1]) {
      const cx = sx * legX;
      addBox(b, 'mount', [cx - footW / 2, 0, -footW / 2], [cx + footW / 2, footH, footW / 2], 0.003);
      addBox(b, 'shaft', [cx - th / 2, footH, -th / 2], [cx + th / 2, reach - th, th / 2], 0.003);
      if (rank >= 2) {
        addPrism(b, 'bolts', 6, Math.min(0.01, footW * 0.25), footH, footH + 0.007, cx, 0, Math.PI / 6);
      }
    }
    addBox(b, 'grip', [-span / 2, reach - th, -th * 0.65], [span / 2, reach, th * 0.65], 0.004);
    return b.build();
  },
};

/**
 * 14. An industrial access ladder or safety guard rail standing on y = 0.
 * Rank 0: bounding frame slab. Rank 1: twin square stiles + rungs. Rank 2: wall standoffs, foot bolts, and top safety hoop.
 */
export const ladder: Generator = {
  id: 'ladder',
  label: 'Ladder / guard rail',
  slots: ['stiles', 'rungs', 'cage', 'bolts'],
  params: [
    m('width', 'Width', 0.25, 1.5, 0.01, 0.46),
    m('height', 'Height', 0.4, 4.0, 0.02, 1.8),
    m('stileSection', 'Stile thickness', 0.02, 0.1, 0.005, 0.04),
    m('rungStep', 'Rung spacing', 0.18, 0.5, 0.01, 0.28),
    m('standoff', 'Wall standoff depth', 0.02, 0.25, 0.005, 0.08),
    { key: 'mode', label: 'Mode', unit: 'choice', min: 0, max: 1, step: 1, default: 0, choices: ['ladder', 'guard-rail'] },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const w = p.width as number, h = p.height as number, st = p.stileSection as number;
    const step = p.rungStep as number, so = p.standoff as number;

    if (rank === 0) {
      addBox(b, 'stiles', [-w / 2, 0, 0], [w / 2, h, so + st]);
      return b.build();
    }

    // Twin vertical stiles offset by `so` from z = 0 wall
    addBox(b, 'stiles', [-w / 2, 0, so], [-w / 2 + st, h, so + st], st * 0.12);
    addBox(b, 'stiles', [w / 2 - st, 0, so], [w / 2, h, so + st], st * 0.12);

    if (p.mode === 1) {
      // Guard rail: top rail + mid rail
      addBox(b, 'rungs', [-w / 2, h - st, so], [w / 2, h, so + st], st * 0.12);
      addBox(b, 'rungs', [-w / 2 + st, h * 0.52 - st * 0.4, so + st * 0.15], [w / 2 - st, h * 0.52 + st * 0.4, so + st * 0.85]);
    } else {
      const count = Math.max(2, Math.floor((h - st * 2) / step));
      const rt = st * 0.65;
      for (let i = 0; i < count; i++) {
        const ry = st * 1.5 + i * ((h - st * 3) / Math.max(1, count - 1));
        addBox(b, 'rungs', [-w / 2 + st, ry - rt / 2, so + (st - rt) / 2], [w / 2 - st, ry + rt / 2, so + (st + rt) / 2]);
      }
    }

    if (rank >= 2) {
      for (const sx of [-1, 1]) {
        const cx = sx * (w / 2 - st / 2);
        for (const fy of [0.12, 0.88]) {
          const sy = fy * h;
          addBox(b, 'cage', [cx - st * 0.6, sy - st * 0.6, 0], [cx + st * 0.6, sy + st * 0.6, so]);
          addBox(b, 'bolts', [cx - 0.012, sy - 0.012, so + st], [cx + 0.012, sy + 0.012, so + st + 0.01]);
        }
      }
    }
    return b.build();
  },
};

/**
 * 15. A protruding louvred exhaust cowl / weather hood on a vertical face (back on z = 0, extending to +z).
 * Rank 0: solid hood block. Rank 1: flanged frame + overhanging sloped hood cheek cowl + recessed throat.
 * Rank 2: angled louvre slats and flange bolts.
 */
export const louvre: Generator = {
  id: 'louvre',
  label: 'Louvre hood',
  slots: ['hood', 'throat', 'slats', 'bolts'],
  params: [
    m('width', 'Width', 0.15, 2.5, 0.01, 0.56),
    m('height', 'Height', 0.15, 2.5, 0.01, 0.48),
    m('hoodDepth', 'Hood depth', 0.04, 0.6, 0.01, 0.16),
    m('flange', 'Flange width', 0.015, 0.12, 0.005, 0.035),
    { key: 'slats', label: 'Louvre slats', unit: 'count', min: 2, max: 16, step: 1, default: 5 },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const w = p.width as number, h = p.height as number, d = p.hoodDepth as number;
    const fl = Math.min(p.flange as number, w * 0.22, h * 0.22);

    if (rank === 0) {
      addBox(b, 'hood', [-w / 2, 0, 0], [w / 2, h, d]);
      return b.build();
    }

    const ft = Math.min(0.025, d * 0.25);
    // Wall flange + dark throat plate
    addBox(b, 'hood', [-w / 2, 0, 0], [w / 2, h, ft], 0.005);
    addBox(b, 'throat', [-w / 2 + fl, fl, ft], [w / 2 - fl, h - fl, ft + 0.015]);
    // Protruding top rain hood + side cheeks
    const wall = Math.max(0.016, fl * 0.55);
    addBox(b, 'hood', [-w / 2 + fl * 0.4, h - fl - wall, ft], [w / 2 - fl * 0.4, h - fl * 0.3, d], 0.006);
    addBox(b, 'hood', [-w / 2 + fl * 0.4, fl, ft], [-w / 2 + fl * 0.4 + wall, h - fl, d * 0.88]);
    addBox(b, 'hood', [w / 2 - fl * 0.4 - wall, fl, ft], [w / 2 - fl * 0.4, h - fl, d * 0.88]);

    if (rank >= 2) {
      const n = p.slats as number;
      const innerH = h - 2 * fl - wall;
      const gap = innerH / n;
      const st = Math.min(0.016, gap * 0.42);
      for (let i = 0; i < n; i++) {
        const yc = fl + (i + 0.5) * gap;
        addBox(b, 'slats', [-w / 2 + fl, yc - st / 2, ft + 0.01], [w / 2 - fl, yc + st / 2, d * 0.82]);
      }
      const hd = Math.min(0.022, fl * 0.55);
      for (const sx of [-1, 1]) {
        for (const sy of [fl * 0.5, h - fl * 0.5]) {
          addBox(b, 'bolts', [sx * (w / 2 - fl * 0.5) - hd / 2, sy - hd / 2, ft], [sx * (w / 2 - fl * 0.5) + hd / 2, sy + hd / 2, ft + hd * 0.5]);
        }
      }
    }
    return b.build();
  },
};

/**
 * 16. A square armoured lamp / status indicator bezel standing on y = 0.
 * Rank 0: solid block. Rank 1: recessed emissive lens + top glare visor. Rank 2: protective cage bars + corner screws.
 */
export const lamp: Generator = {
  id: 'lamp',
  label: 'Square lamp housing',
  slots: ['housing', 'lens', 'guard', 'bolts'],
  params: [
    m('width', 'Width', 0.08, 1.5, 0.01, 0.28),
    m('height', 'Height', 0.08, 1.0, 0.01, 0.2),
    m('depth', 'Depth', 0.03, 0.4, 0.005, 0.09),
    m('bezel', 'Bezel rim width', 0.01, 0.1, 0.002, 0.028),
    m('visor', 'Top visor overhang', 0, 0.15, 0.005, 0.035),
    { key: 'guards', label: 'Guard bars', unit: 'count', min: 0, max: 6, step: 1, default: 2 },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const w = p.width as number, h = p.height as number, d = p.depth as number;
    const bz = Math.min(p.bezel as number, w * 0.28, h * 0.28);
    const vis = p.visor as number;

    if (rank === 0) {
      addBox(b, 'housing', [-w / 2, 0, 0], [w / 2, h, d + vis]);
      return b.build();
    }

    addBox(b, 'housing', [-w / 2, 0, 0], [w / 2, h, d * 0.72], 0.006);
    // Bezel frame around emissive lens
    addBox(b, 'housing', [-w / 2, h - bz, d * 0.72], [w / 2, h, d + vis], 0.004);
    addBox(b, 'housing', [-w / 2, 0, d * 0.72], [w / 2, bz, d], 0.004);
    addBox(b, 'housing', [-w / 2, bz, d * 0.72], [-w / 2 + bz, h - bz, d]);
    addBox(b, 'housing', [w / 2 - bz, bz, d * 0.72], [w / 2, h - bz, d]);
    addBox(b, 'lens', [-w / 2 + bz, bz, d * 0.72], [w / 2 - bz, h - bz, d * 0.92]);

    if (rank >= 2) {
      const gCount = p.guards as number;
      const spanX = w - 2 * bz;
      for (let i = 0; i < gCount; i++) {
        const gx = -spanX / 2 + ((i + 1) / (gCount + 1)) * spanX;
        addBox(b, 'guard', [gx - 0.006, bz * 0.6, d * 0.92], [gx + 0.006, h - bz * 0.6, d + 0.008]);
      }
      const hd = Math.min(0.016, bz * 0.55);
      for (const sx of [-1, 1]) {
        for (const sy of [bz * 0.5, h - bz * 0.5]) {
          addBox(b, 'bolts', [sx * (w / 2 - bz * 0.5) - hd / 2, sy - hd / 2, d], [sx * (w / 2 - bz * 0.5) + hd / 2, sy + hd / 2, d + hd * 0.45]);
        }
      }
    }
    return b.build();
  },
};

/**
 * 17. An armoured cable conduit run along x with periodic U-saddle mounting clips and end glands.
 */
export const conduit: Generator = {
  id: 'conduit',
  label: 'Cable conduit with clips',
  slots: ['cable', 'clips', 'gland', 'bolts'],
  params: [
    m('length', 'Length', 0.2, 6.0, 0.02, 1.4),
    m('width', 'Cable width', 0.03, 0.3, 0.005, 0.07),
    m('height', 'Cable height', 0.03, 0.3, 0.005, 0.07),
    { key: 'clips', label: 'Saddle clips', unit: 'count', min: 1, max: 8, step: 1, default: 3 },
    m('glandLength', 'End gland collar', 0.02, 0.2, 0.005, 0.06),
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const l = p.length as number, cw = p.width as number, ch = p.height as number;
    const gl = Math.min(p.glandLength as number, l * 0.2);

    addBox(b, 'cable', [-l / 2, 0, -cw / 2], [l / 2, ch, cw / 2], rank >= 1 ? ch * 0.18 : 0);
    if (rank >= 1) {
      const lip = Math.max(0.008, cw * 0.18);
      addBox(b, 'gland', [-l / 2, 0, -cw / 2 - lip], [-l / 2 + gl, ch + lip, cw / 2 + lip], 0.004);
      addBox(b, 'gland', [l / 2 - gl, 0, -cw / 2 - lip], [l / 2, ch + lip, cw / 2 + lip], 0.004);

      const nClips = p.clips as number;
      const clipW = Math.min(0.045, (l - 2 * gl) / (nClips * 2.5));
      for (let i = 0; i < nClips; i++) {
        const cx = -l / 2 + gl + ((i + 0.5) / nClips) * (l - 2 * gl);
        addBox(b, 'clips', [cx - clipW / 2, 0, -cw * 0.95], [cx + clipW / 2, ch * 0.22, cw * 0.95]);
        addBox(b, 'clips', [cx - clipW / 2, 0, -cw / 2 - lip * 0.8], [cx + clipW / 2, ch + lip * 0.8, cw / 2 + lip * 0.8], 0.003);
        if (rank >= 2) {
          for (const sz of [-1, 1]) {
            const bz = sz * (cw * 0.78);
            addPrism(b, 'bolts', 6, 0.01, ch * 0.22, ch * 0.22 + 0.008, cx, bz, Math.PI / 6);
          }
        }
      }
    }
    return b.build();
  },
};

/**
 * 18. A heavy structural seam clamp plate / tie strap lying on y = 0.
 * Rank 0: flat slab. Rank 1: raised central bridge arch. Rank 2: twin stiffening ribs + 4 corner hex bolts.
 */
export const clamp: Generator = {
  id: 'clamp',
  label: 'Seam clamp plate',
  slots: ['strap', 'ribs', 'bolts'],
  params: [
    m('width', 'Width (across seam)', 0.08, 1.2, 0.01, 0.28),
    m('length', 'Length (along seam)', 0.06, 1.5, 0.01, 0.16),
    m('thickness', 'Plate thickness', 0.008, 0.1, 0.002, 0.024),
    m('bridgeHeight', 'Bridge step height', 0, 0.08, 0.002, 0.016),
    { key: 'ribs', label: 'Stiffener ribs', unit: 'count', min: 0, max: 4, step: 1, default: 2 },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const w = p.width as number, l = p.length as number, t = p.thickness as number, bh = p.bridgeHeight as number;

    addBox(b, 'strap', [-w / 2, 0, -l / 2], [w / 2, t, l / 2], rank >= 1 ? t * 0.2 : 0);
    if (rank >= 1 && bh > 0) {
      addBox(b, 'strap', [-w * 0.28, t, -l / 2], [w * 0.28, t + bh, l / 2], bh * 0.2);
    }
    if (rank >= 2) {
      const nr = p.ribs as number;
      for (let i = 0; i < nr; i++) {
        const rz = -l * 0.32 + (nr <= 1 ? l * 0.32 : (i / (nr - 1)) * l * 0.64);
        addBox(b, 'ribs', [-w * 0.36, t, rz - 0.008], [w * 0.36, t + bh + 0.01, rz + 0.008]);
      }
      const hd = Math.min(0.022, l * 0.2);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addPrism(b, 'bolts', 6, hd / Math.sqrt(3), t, t + hd * 0.45, sx * w * 0.38, sz * l * 0.32, Math.PI / 6);
        }
      }
    }
    return b.build();
  },
};

/**
 * 19. A heavy rover / machine wheel standing on y = 0, axle along x.
 * Rank 0: 8-sided drum. Rank 1: 12-sided tyre + recessed rim + central hub boss. Rank 2: tread lugs + hub bolt circle.
 */
export const wheel: Generator = {
  id: 'wheel',
  label: 'Treaded wheel',
  slots: ['tyre', 'rim', 'hub', 'bolts'],
  params: [
    m('radius', 'Wheel radius', 0.2, 1.2, 0.01, 0.55),
    m('width', 'Tire width', 0.15, 0.9, 0.01, 0.52),
    m('hubRadius', 'Hub radius', 0.08, 0.6, 0.01, 0.26),
    m('treadDepth', 'Tread lug height', 0.005, 0.06, 0.002, 0.022),
    { key: 'lugs', label: 'Tread lugs', unit: 'count', min: 6, max: 20, step: 2, default: 12 },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const r = p.radius as number, w = p.width as number, hr = Math.min(r * 0.72, p.hubRadius as number);
    const td = p.treadDepth as number;
    const cy = r;
    const sides = rank === 0 ? 8 : 12;

    const addAxlePrism = (slot: string, n: number, rad: number, x0: number, x1: number): void => {
      const ring = (x: number): V3[] =>
        Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2;
          return [x, cy + rad * Math.cos(a), rad * Math.sin(a)] as V3;
        });
      const lo = ring(x0), hi = ring(x1);
      b.poly(slot, hi);
      b.poly(slot, [...lo].reverse());
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        b.poly(slot, [lo[i] as V3, lo[j] as V3, hi[j] as V3, hi[i] as V3]);
      }
    };

    addAxlePrism('tyre', sides, r, -w / 2, w / 2);
    if (rank >= 1) {
      addAxlePrism('rim', sides, hr * 1.18, -w / 2 - 0.012, w / 2 + 0.012);
      addAxlePrism('hub', 8, hr * 0.58, -w / 2 - 0.028, w / 2 + 0.028);
    }
    if (rank >= 2) {
      const nLugs = p.lugs as number;
      for (let i = 0; i < nLugs; i++) {
        const a = (i / nLugs) * Math.PI * 2;
        const ly = cy + Math.cos(a) * r;
        const lz = Math.sin(a) * r;
        if (ly - td < 0) continue; // keep bottom grounded >= 0
        addBox(b, 'tyre', [-w * 0.46, ly - td * 0.5, lz - td * 0.5], [w * 0.46, ly + td * 0.5, lz + td * 0.5]);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const by = cy + Math.cos(a) * (hr * 0.85);
        const bz = Math.sin(a) * (hr * 0.85);
        addBox(b, 'bolts', [w / 2 + 0.012, by - 0.015, bz - 0.015], [w / 2 + 0.028, by + 0.015, bz + 0.015]);
      }
    }
    return b.build();
  },
};

/**
 * 20. An armoured crawler track pod standing on y = 0, running along z.
 * Rank 0: bevelled track block. Rank 1: track belt + recessed bogie frame + road wheels.
 * Rank 2: track grouser cleats and bogie axle bolts.
 */
export const track: Generator = {
  id: 'track',
  label: 'Crawler track pod',
  slots: ['tread', 'frame', 'rollers', 'bolts'],
  params: [
    m('length', 'Track length', 0.8, 4.0, 0.02, 2.28),
    m('height', 'Track height', 0.3, 1.5, 0.01, 0.68),
    m('width', 'Track width', 0.2, 1.0, 0.01, 0.48),
    m('beltThickness', 'Belt thickness', 0.03, 0.16, 0.005, 0.075),
    { key: 'wheels', label: 'Road wheels', unit: 'count', min: 2, max: 6, step: 1, default: 4 },
    { key: 'cleats', label: 'Top cleats', unit: 'count', min: 4, max: 16, step: 2, default: 8 },
  ],
  build(given, rank) {
    const p = resolveParams(this.params, given);
    const b = new MeshBuilder(this.slots);
    const l = p.length as number, h = p.height as number, w = p.width as number;
    const bt = Math.min(p.beltThickness as number, h * 0.22);

    if (rank === 0) {
      addBox(b, 'tread', [-w / 2, 0, -l / 2], [w / 2, h, l / 2], h * 0.18);
      return b.build();
    }

    // Outer track belt + recessed bogie structural beam
    addBox(b, 'tread', [-w / 2, 0, -l / 2], [w / 2, h, l / 2], h * 0.22);
    addBox(b, 'frame', [-w / 2 - 0.015, bt, -l * 0.42], [w / 2 + 0.015, h - bt, l * 0.42], 0.015);

    const nw = p.wheels as number;
    const wr = Math.min((h - 2 * bt) * 0.44, (l * 0.78) / (nw * 2));
    for (let i = 0; i < nw; i++) {
      const wz = -l * 0.35 + (nw <= 1 ? l * 0.35 : (i / (nw - 1)) * l * 0.7);
      addBox(b, 'rollers', [-w / 2 - 0.025, bt + 0.02, wz - wr], [w / 2 + 0.025, bt + 0.02 + wr * 1.8, wz + wr], 0.01);
      if (rank >= 2) {
        addBox(b, 'bolts', [w / 2 + 0.025, bt + 0.02 + wr * 0.7, wz - 0.018], [w / 2 + 0.04, bt + 0.02 + wr * 1.1, wz + 0.018]);
      }
    }

    if (rank >= 2) {
      const nc = p.cleats as number;
      for (let i = 0; i < nc; i++) {
        const cz = -l * 0.38 + (i / Math.max(1, nc - 1)) * l * 0.76;
        addBox(b, 'tread', [-w * 0.48, h, cz - 0.022], [w * 0.48, h + 0.016, cz + 0.022]);
      }
    }
    return b.build();
  },
};

export const GENERATORS: Readonly<Record<string, Generator>> = Object.freeze({
  bolt,
  panel,
  can,
  beam,
  grille,
  bracket,
  duct,
  hopper,
  chute,
  tank,
  pipe,
  hinge,
  handle,
  ladder,
  louvre,
  lamp,
  conduit,
  clamp,
  wheel,
  track,
});

/** Builds a part from the registry; unknown generators give null. */
export function buildPart(gen: string, params: Params, rank: Rank): MeshData | null {
  const g = GENERATORS[gen];
  return g ? g.build(params, rank) : null;
}

export function triangleCount(md: MeshData): number {
  return md.indices.length / 3;
}
