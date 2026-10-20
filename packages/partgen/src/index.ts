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

export const GENERATORS: Readonly<Record<string, Generator>> = Object.freeze({ bolt, panel, can, beam, grille, bracket, duct });

/** Builds a part from the registry; unknown generators give null. */
export function buildPart(gen: string, params: Params, rank: Rank): MeshData | null {
  const g = GENERATORS[gen];
  return g ? g.build(params, rank) : null;
}

export function triangleCount(md: MeshData): number {
  return md.indices.length / 3;
}
