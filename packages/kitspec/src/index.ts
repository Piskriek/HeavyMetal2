/**
 * @hm/kitspec: parts, modules and presets (docs/argo/plans/38-parts-modules-presets.md).
 *
 * A part is one solid made once: a generated asset (the 3D PC) or a procedural box (code). A module or a preset is an
 * assembly: parts and other assemblies placed on each other's sockets. Every part carries a detail rank, and what is
 * drawn is every part whose rank is at most maxRank(stage, tier), so a lower tier hides small parts instead of swapping
 * in a decimated copy, and a machine gains its details as the stage rises (constitution 4).
 *
 * Pure: no DOM, no clock, no randomness; the same kit always flattens to the same parts in the same order.
 * Frames: metres, y up, a part's origin is its base centre unless its bounds say otherwise. Matrices are 4x4,
 * column-major (the layout of three.js Matrix4.elements); rotations are Euler degrees in three.js 'XYZ' order.
 */

import { buildPart } from '@hm/partgen';

export type Vec3 = readonly [number, number, number];
/** A 4x4 matrix, column-major (three.js `Matrix4.elements`). */
export type Mat4 = readonly number[];
/** 0: silhouette and structure. 1: secondary forms (doors, panels, caps, lamps). 2: small details (bolts, vents, cables). */
export type DetailRank = 0 | 1 | 2;
export type Tier = 'low' | 'medium' | 'high';

export interface Box3 {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** A named attach point in its owner's frame: a position and an optional Euler rotation (degrees). */
export interface SocketDef {
  readonly at: Vec3;
  readonly rot?: Vec3;
}

export type PartSource =
  /** A generated model (docs/runworld/assets.json id). Its bounds are measured, so they are given. */
  | { readonly kind: 'gen'; readonly asset: string; readonly bounds: Box3 }
  /** A procedural box, `size` across, standing on its origin (y from 0 to size[1]) and centred in x and z. */
  | { readonly kind: 'box'; readonly size: Vec3 }
  /** A Shape Press part: an @hm/partgen generator and its slider values (plan 38 section 7). */
  | { readonly kind: 'param'; readonly gen: string; readonly params: Readonly<Record<string, number>>; readonly ops?: readonly OpRef[] };

/** A @hm/meshops operator applied on top of a param part, with its slider values (over its one-click preset). */
export interface OpRef {
  readonly op: string;
  readonly params: Readonly<Record<string, number>>;
}

export interface PartDef {
  readonly source: PartSource;
  /** The material slot (a trim-sheet region or a lab material name); merging groups by it. */
  readonly material: string;
  /** For a part with several material slots (a param part's `bolts`, `band`): a material per slot; others use `material`. */
  readonly slotMaterials?: Readonly<Record<string, string>>;
  readonly rank: DetailRank;
  readonly sockets?: Readonly<Record<string, SocketDef>>;
}

/** What a placed copy changes about its part (the beam's Apply with a part cartridge, plan 38 section 8). */
export interface PartOverride {
  /** Slider values merged over a param part's own. */
  readonly params?: Readonly<Record<string, number>>;
  /** Another generator for a param part (its params then start from that generator's defaults plus `params`). */
  readonly gen?: string;
  /** Operators that replace the part's own (the bench's one-click presets). */
  readonly ops?: readonly OpRef[];
  readonly material?: string;
  readonly slotMaterials?: Readonly<Record<string, string>>;
}

export type Overrides = Readonly<Record<string, PartOverride>>;

export interface Placement {
  /** A part id or an assembly id. */
  readonly ref: string;
  /** A stable name for the placed copy (for animation and state hooks). Defaults to `${ref}#${index}`. */
  readonly key?: string;
  /** Attach to a socket of an earlier sibling (its index in `children`; `copy` picks one of its repeats, default 0). */
  readonly on?: { readonly child: number; readonly socket: string; readonly copy?: number };
  /** Offset and rotation from the socket (or from the assembly's origin when `on` is absent). */
  readonly at?: Vec3;
  readonly rot?: Vec3;
  /** Mirror the placed copy across its own local plane (x: left-right, z: front-back). */
  readonly mirror?: 'x' | 'z';
  /** Raises the rank of everything placed here (a whole bolt-strip module can be rank 2). */
  readonly rank?: DetailRank;
  /** A row of identical copies: copy k sits at `at + k * step`. */
  readonly repeat?: { readonly count: number; readonly step: Vec3 };
}

export interface AssemblyDef {
  readonly children: readonly Placement[];
  /** Sockets this assembly exposes to whoever places it, in its own frame. */
  readonly sockets?: Readonly<Record<string, SocketDef>>;
}

export interface Kit {
  readonly parts: Readonly<Record<string, PartDef>>;
  readonly assemblies: Readonly<Record<string, AssemblyDef>>;
}

export interface PlacedPart {
  /** The path of keys from the preset down, e.g. `cells[1]/can`. */
  readonly path: string;
  readonly part: string;
  /** The part's source with any override applied (what to build). */
  readonly source: PartSource;
  readonly material: string;
  readonly slotMaterials?: Readonly<Record<string, string>>;
  readonly rank: DetailRank;
  /** Part frame to preset frame. */
  readonly matrix: Mat4;
  /** True when the matrix flips handedness (an odd number of mirrors): flip the triangle winding. */
  readonly mirrored: boolean;
}

export type IssueCode =
  | 'unknown-ref'
  | 'cycle'
  | 'bad-parent'
  | 'unknown-socket'
  | 'bad-repeat'
  | 'below-ground'
  | 'floating'
  | 'empty';

export interface Issue {
  readonly code: IssueCode;
  readonly at: string;
  readonly detail: string;
}

/* ------------------------------------------------------------------ matrices */

export const IDENTITY: Mat4 = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += (a[k * 4 + row] as number) * (b[col * 4 + k] as number);
      out[col * 4 + row] = s;
    }
  }
  return out;
}

export function translation(v: Vec3): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, v[0], v[1], v[2], 1];
}

const RAD = Math.PI / 180;
/** Exact for multiples of 90 degrees, so square kits stay on whole numbers. */
const cosSin = (deg: number): [number, number] => {
  const q = ((deg % 360) + 360) % 360;
  if (q === 0) return [1, 0];
  if (q === 90) return [0, 1];
  if (q === 180) return [-1, 0];
  if (q === 270) return [0, -1];
  return [Math.cos(q * RAD), Math.sin(q * RAD)];
};

/** Euler degrees in three.js 'XYZ' order (the matrix is Rx * Ry * Rz). */
export function rotation(e: Vec3): Mat4 {
  const [a, b] = cosSin(e[0]);
  const [c, d] = cosSin(e[1]);
  const [ce, f] = cosSin(e[2]);
  const ae = a * ce, af = a * f, be = b * ce, bf = b * f;
  return [
    c * ce, af + be * d, bf - ae * d, 0,
    -c * f, ae - bf * d, be + af * d, 0,
    d, -b * c, a * c, 0,
    0, 0, 0, 1,
  ];
}

export function scale(v: Vec3): Mat4 {
  return [v[0], 0, 0, 0, 0, v[1], 0, 0, 0, 0, v[2], 0, 0, 0, 0, 1];
}

export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const x = p[0], y = p[1], z = p[2];
  const g = (i: number): number => m[i] as number;
  return [
    g(0) * x + g(4) * y + g(8) * z + g(12),
    g(1) * x + g(5) * y + g(9) * z + g(13),
    g(2) * x + g(6) * y + g(10) * z + g(14),
  ];
}

export function determinant3(m: Mat4): number {
  const g = (i: number): number => m[i] as number;
  return g(0) * (g(5) * g(10) - g(9) * g(6)) - g(4) * (g(1) * g(10) - g(9) * g(2)) + g(8) * (g(1) * g(6) - g(5) * g(2));
}

const frameOf = (s: SocketDef): Mat4 => multiply(translation(s.at), rotation(s.rot ?? [0, 0, 0]));

/* ------------------------------------------------------------------ parts */

/** A source's box in its own frame. A param part's is its rank-0 silhouette (what is always drawn). */
export function sourceBounds(s: PartSource): Box3 {
  if (s.kind === 'gen') return s.bounds;
  if (s.kind === 'param') {
    const md = buildPart(s.gen, s.params, 0);
    return md ? { min: md.min, max: md.max } : { min: [0, 0, 0], max: [0, 0, 0] };
  }
  const [x, y, z] = s.size;
  return { min: [-x / 2, 0, -z / 2], max: [x / 2, y, z / 2] };
}

export function partBounds(p: PartDef): Box3 {
  return sourceBounds(p.source);
}

/** A part's source with an override applied. */
export function applyOverride(def: PartDef, o: PartOverride | undefined): { source: PartSource; material: string; slotMaterials?: Readonly<Record<string, string>> } {
  if (!o) return { source: def.source, material: def.material, ...(def.slotMaterials ? { slotMaterials: def.slotMaterials } : {}) };
  let source = def.source;
  if (source.kind === 'param' && (o.params || o.gen || o.ops)) {
    const ops = o.ops ?? source.ops;
    source = o.gen && o.gen !== source.gen
      ? { kind: 'param', gen: o.gen, params: { ...(o.params ?? {}) }, ...(ops ? { ops } : {}) }
      : { kind: 'param', gen: source.gen, params: { ...source.params, ...(o.params ?? {}) }, ...(ops ? { ops } : {}) };
  }
  const slotMaterials = o.slotMaterials ?? def.slotMaterials;
  return { source, material: o.material ?? def.material, ...(slotMaterials ? { slotMaterials } : {}) };
}

/** The axis-aligned box around a part's bounds after `m`. */
export function transformBox(b: Box3, m: Mat4): Box3 {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const c: Vec3 = [i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]];
    const p = transformPoint(m, c);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k] as number, p[k] as number);
      max[k] = Math.max(max[k] as number, p[k] as number);
    }
  }
  return { min: min as unknown as Vec3, max: max as unknown as Vec3 };
}

/* ------------------------------------------------------------------ flattening */

interface Frame {
  readonly matrix: Mat4;
  /** Sockets of the placed thing, in its own frame (a part's, or an assembly's exposed ones). */
  readonly sockets: Readonly<Record<string, SocketDef>> | undefined;
}

/**
 * Every part a preset places, in a fixed order (children in order, repeats in order, depth first), with its matrix in
 * the preset's frame. Problems are skipped and reported by validate(); flatten never throws on a bad kit.
 */
export function flatten(kit: Kit, preset: string, overrides?: Overrides): PlacedPart[] {
  const out: PlacedPart[] = [];
  walk(kit, preset, IDENTITY, 0, '', [], out, []);
  return overrides ? withOverrides(kit, out, overrides) : out;
}

/** Placed parts with each path's override applied (unknown paths are ignored). */
function withOverrides(kit: Kit, placed: PlacedPart[], overrides: Overrides): PlacedPart[] {
  return placed.map((p) => {
    const o = overrides[p.path];
    const def = kit.parts[p.part];
    if (!o || !def) return p;
    const r = applyOverride(def, o);
    const { slotMaterials: _drop, ...rest } = p;
    void _drop;
    return { ...rest, source: r.source, material: r.material, ...(r.slotMaterials ? { slotMaterials: r.slotMaterials } : {}) };
  });
}

function walk(
  kit: Kit,
  id: string,
  base: Mat4,
  rankFloor: number,
  prefix: string,
  stack: string[],
  out: PlacedPart[],
  issues: Issue[],
): void {
  const asm = kit.assemblies[id];
  if (!asm) {
    issues.push({ code: 'unknown-ref', at: prefix || id, detail: `no assembly '${id}'` });
    return;
  }
  if (stack.includes(id)) {
    issues.push({ code: 'cycle', at: prefix || id, detail: [...stack, id].join(' > ') });
    return;
  }
  const inner = [...stack, id];
  const frames: Frame[][] = [];
  asm.children.forEach((c, i) => {
    const key = c.key ?? `${c.ref}#${i}`;
    const here = prefix ? `${prefix}/${key}` : key;
    const part = kit.parts[c.ref];
    const sub = kit.assemblies[c.ref];
    const copies: Frame[] = [];
    frames.push(copies);
    if (!part && !sub) {
      issues.push({ code: 'unknown-ref', at: here, detail: `no part or assembly '${c.ref}'` });
      return;
    }
    let parentFrame: Mat4 = base;
    if (c.on) {
      const parent = c.on.child < i ? frames[c.on.child] : undefined;
      const copy = parent?.[c.on.copy ?? 0];
      if (!copy) {
        issues.push({ code: 'bad-parent', at: here, detail: `child ${c.on.child} copy ${c.on.copy ?? 0} is not an earlier placed sibling` });
        return;
      }
      const socket = copy.sockets?.[c.on.socket];
      if (!socket) {
        issues.push({ code: 'unknown-socket', at: here, detail: `no socket '${c.on.socket}' on child ${c.on.child}` });
        return;
      }
      parentFrame = multiply(copy.matrix, frameOf(socket));
    }
    const count = c.repeat ? c.repeat.count : 1;
    if (!Number.isInteger(count) || count < 1) {
      issues.push({ code: 'bad-repeat', at: here, detail: `repeat count ${String(c.repeat?.count)}` });
      return;
    }
    const mirror = c.mirror === 'x' ? scale([-1, 1, 1]) : c.mirror === 'z' ? scale([1, 1, -1]) : IDENTITY;
    const rank = Math.max(rankFloor, c.rank ?? 0);
    for (let k = 0; k < count; k++) {
      const off: Vec3 = c.at ?? [0, 0, 0];
      const step = c.repeat?.step ?? [0, 0, 0];
      const at: Vec3 = [off[0] + step[0] * k, off[1] + step[1] * k, off[2] + step[2] * k];
      const local = multiply(multiply(translation(at), rotation(c.rot ?? [0, 0, 0])), mirror);
      const matrix = multiply(parentFrame, local);
      const path = count > 1 ? `${here}[${k}]` : here;
      if (part) {
        copies.push({ matrix, sockets: part.sockets });
        out.push({
          path,
          part: c.ref,
          source: part.source,
          material: part.material,
          ...(part.slotMaterials ? { slotMaterials: part.slotMaterials } : {}),
          rank: Math.max(rank, part.rank) as DetailRank,
          matrix,
          mirrored: determinant3(matrix) < 0,
        });
      } else if (sub) {
        copies.push({ matrix, sockets: sub.sockets });
        walk(kit, c.ref, matrix, rank, path, inner, out, issues);
      }
    }
  });
}

/* ------------------------------------------------------------------ validation */

export interface ValidateOptions {
  /** The ground height in the preset's frame; null skips the ground checks (a wall-mounted preset with anchors). */
  readonly ground?: number | null;
  /** Extra supports a preset may rest on or hang from (a wall plane as a thin box). */
  readonly anchors?: readonly Box3[];
  /** Contact tolerance in metres (default 2 mm). */
  readonly eps?: number;
  /** Per-path overrides to check the preset with (the beam's changes). */
  readonly overrides?: Overrides;
}

const touches = (a: Box3, b: Box3, eps: number): boolean =>
  a.min[0] <= b.max[0] + eps && b.min[0] <= a.max[0] + eps &&
  a.min[1] <= b.max[1] + eps && b.min[1] <= a.max[1] + eps &&
  a.min[2] <= b.max[2] + eps && b.min[2] <= a.max[2] + eps;

/**
 * Everything wrong with a preset: unknown ids, cycles, sockets, repeats, and the owner's "nothing floats" rule: every
 * part must reach the ground (or an anchor) through parts whose boxes touch. Box contact is a necessary check, not a
 * proof of contact (two diagonal beams can share a box corner without touching).
 */
export function validate(kit: Kit, preset: string, opts: ValidateOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const placed: PlacedPart[] = [];
  walk(kit, preset, IDENTITY, 0, '', [], placed, issues);
  const parts = opts.overrides ? withOverrides(kit, placed, opts.overrides) : placed;
  if (issues.length === 0 && placed.length === 0) issues.push({ code: 'empty', at: preset, detail: 'the preset places no parts' });
  const ground = opts.ground === undefined ? 0 : opts.ground;
  const eps = opts.eps ?? 0.002;
  const boxes = parts.map((p) => transformBox(sourceBounds(p.source), p.matrix));
  if (ground !== null) {
    boxes.forEach((b, i) => {
      if (b.min[1] < ground - eps) issues.push({ code: 'below-ground', at: (placed[i] as PlacedPart).path, detail: `bottom at ${b.min[1].toFixed(3)} m` });
    });
  }
  const supported = new Array<boolean>(boxes.length).fill(false);
  const queue: number[] = [];
  boxes.forEach((b, i) => {
    const onGround = ground !== null && b.min[1] <= ground + eps;
    const onAnchor = (opts.anchors ?? []).some((a) => touches(a, b, eps));
    if (onGround || onAnchor) {
      supported[i] = true;
      queue.push(i);
    }
  });
  while (queue.length > 0) {
    const i = queue.shift() as number;
    boxes.forEach((b, j) => {
      if (!supported[j] && touches(boxes[i] as Box3, b, eps)) {
        supported[j] = true;
        queue.push(j);
      }
    });
  }
  supported.forEach((ok, i) => {
    if (!ok) issues.push({ code: 'floating', at: (placed[i] as PlacedPart).path, detail: 'touches nothing that reaches the ground' });
  });
  return issues;
}

/* ------------------------------------------------------------------ detail */

/**
 * The highest rank drawn: the lower of the stage's and the tier's. Stage: 0 and 1 draw rank 0 (wireframe and the 1-bit
 * and EGA looks), 2 adds rank 1, 3 and up add rank 2. Tier: Low stops at rank 1; Medium and High reach rank 2.
 */
export function maxRank(stage: number, tier: Tier): DetailRank {
  const byStage: DetailRank = stage >= 3 ? 2 : stage >= 2 ? 1 : 0;
  const byTier: DetailRank = tier === 'low' ? 1 : 2;
  return Math.min(byStage, byTier) as DetailRank;
}

/** Rank-2 parts also hide when they cover less than this fraction of the screen height (0: never). */
export const SMALL_PART_SCREEN: Readonly<Record<Tier, number>> = Object.freeze({ low: 0, medium: 0.004, high: 0.0015 });

/** Whether a part of this rank draws at this screen size (its height on screen over the viewport height). */
export function draws(rank: DetailRank, max: DetailRank, tier: Tier, screenFraction = 1): boolean {
  if (rank > max) return false;
  return rank < 2 || screenFraction >= SMALL_PART_SCREEN[tier];
}

/* ------------------------------------------------------------------ batching */

/**
 * Merge buckets: placed parts grouped by material and rank, so a preset becomes at most (materials x 3) meshes and a
 * rank change flips one mesh's visibility. Keys are `${material}|${rank}`, in first-seen order.
 */
export function mergeBuckets(placed: readonly PlacedPart[]): Map<string, PlacedPart[]> {
  const out = new Map<string, PlacedPart[]>();
  for (const p of placed) {
    const k = `${p.material}|${p.rank}`;
    const list = out.get(k);
    if (list) list.push(p);
    else out.set(k, [p]);
  }
  return out;
}

/** Instancing buckets: placed copies of each part, for parts placed at least `min` times (default 2). */
export function instanceBuckets(placed: readonly PlacedPart[], min = 2): Map<string, PlacedPart[]> {
  const all = new Map<string, PlacedPart[]>();
  for (const p of placed) {
    const list = all.get(p.part);
    if (list) list.push(p);
    else all.set(p.part, [p]);
  }
  return new Map([...all].filter(([, list]) => list.length >= min));
}

/** The box around every placed part, in the preset's frame. */
export function presetBounds(_kit: Kit, placed: readonly PlacedPart[]): Box3 | null {
  if (placed.length === 0) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of placed) {
    const b = transformBox(sourceBounds(p.source), p.matrix);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k] as number, b.min[k] as number);
      max[k] = Math.max(max[k] as number, b.max[k] as number);
    }
  }
  return { min: min as unknown as Vec3, max: max as unknown as Vec3 };
}
