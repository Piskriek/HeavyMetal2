/**
 * NewDecor — the maths under the brush and the rules: track-space sites, seeded randomness, clump
 * noise, spacing, and turning a site into a placed prop.
 *
 * Everything is in **track space** `(s, lateral)`: arc-length along the road and signed distance from
 * the centreline. That is what makes the rules clever cheaply — "on the verge", "outside of the bend",
 * "every 800 units", "never on the road" are all one comparison here and a nightmare in world XYZ.
 *
 * Pure TypeScript. `DecorTrack` is the structural shape of the renderer's `TrackData` (positions with
 * x/y/z, so a THREE.Vector3 or a plain object both fit), which keeps this importable from a node test.
 */
import type { TrackStageId } from '../track-space';
import type { PlacedProp } from '../builder/prop-catalog';
import { DECOR_KINDS, ZONE_OFFSETS, decorKind, type DecorKind, type DecorPalette } from './decor-catalog';

export interface V3 { readonly x: number; readonly y: number; readonly z: number }

export interface DecorTrackSample {
  readonly pos: V3;
  readonly tangent: V3;
  readonly up: V3;
  readonly right: V3;
  readonly dist: number;
  readonly stage: TrackStageId;
  readonly halfWidth: number;
  readonly turnRate: number;
  readonly inLoop: boolean;
  readonly onBridge: boolean;
}

export interface DecorTrack {
  readonly length: number;
  readonly samples: readonly DecorTrackSample[];
  sampleAt(dist: number): DecorTrackSample;
}

/** A place on the ground in track space. `side` is the sign of `lateral` (0 on the centreline). */
export interface DecorSite {
  readonly s: number;
  readonly lateral: number;
}

/** A decided decoration, before it becomes a prop. */
export interface DecorPlacement {
  readonly kind: DecorKind;
  readonly s: number;
  readonly lateral: number;
  readonly scale: number;
  readonly rotY: number;
  readonly flipX: boolean;
}

/* -----------------------------------------------------------------------------
   Randomness — seeded, so a rule with the same seed lays the same forest twice
   -------------------------------------------------------------------------- */
export interface Rng {
  (): number;
  range(a: number, b: number): number;
  pick<T>(items: readonly T[]): T;
}

export function makeRng(seed: number): Rng {
  let state = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = next as Rng;
  rng.range = (a, b) => a + (b - a) * next();
  rng.pick = (items) => items[Math.min(items.length - 1, Math.floor(next() * items.length))];
  return rng;
}

/** A stable 32-bit hash of a string (seeds from rule ids, batch names). */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* -----------------------------------------------------------------------------
   Clump noise — smooth 1D value noise along s, so scatter forms groves and clearings
   -------------------------------------------------------------------------- */
const hash1 = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Value noise in 0‥1 with period `scale` along s, offset by `seed`. */
export function valueNoise(s: number, scale: number, seed = 0): number {
  const x = s / Math.max(1, scale) + seed * 0.618;
  const i = Math.floor(x);
  const f = x - i;
  const t = f * f * (3 - 2 * f);
  return hash1(i) * (1 - t) + hash1(i + 1) * t;
}

/** Three octaves of `valueNoise`, normalised to 0‥1. */
export function clumpNoise(s: number, scale: number, seed = 0): number {
  const n = valueNoise(s, scale, seed) * 0.6 + valueNoise(s, scale * 0.41, seed + 7) * 0.28 + valueNoise(s, scale * 0.17, seed + 13) * 0.12;
  return Math.max(0, Math.min(1, n));
}

/* -----------------------------------------------------------------------------
   Track-space projection
   -------------------------------------------------------------------------- */
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

/**
 * World point → (s, lateral, altitude) on the nearest stretch of road. A coarse scan every 4th sample
 * then a local refinement: exact enough for a brush, cheap enough for every pointer move.
 */
export function projectToTrack(track: DecorTrack, point: V3): { s: number; lateral: number; altitude: number; sample: DecorTrackSample } {
  const samples = track.samples;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < samples.length; i += 4) {
    const d = sub(point, samples[i].pos);
    const d2 = d.x * d.x + d.y * d.y + d.z * d.z;
    if (d2 < bestD) { bestD = d2; best = i; }
  }
  for (let i = Math.max(0, best - 4); i <= Math.min(samples.length - 1, best + 4); i++) {
    const d = sub(point, samples[i].pos);
    const d2 = d.x * d.x + d.y * d.y + d.z * d.z;
    if (d2 < bestD) { bestD = d2; best = i; }
  }
  const sample = samples[best];
  const rel = sub(point, sample.pos);
  const along = dot(rel, sample.tangent);
  const s = Math.max(0, Math.min(track.length, sample.dist + along));
  return { s, lateral: dot(rel, sample.right), altitude: dot(rel, sample.up), sample };
}

/** Track-space site → world position on the road plane (the caller may then drop it onto terrain). */
export function siteWorld(track: DecorTrack, site: DecorSite, lift = 0): { x: number; y: number; z: number; sample: DecorTrackSample } {
  const sample = track.sampleAt(site.s);
  return {
    x: sample.pos.x + sample.right.x * site.lateral + sample.up.x * lift,
    y: sample.pos.y + sample.right.y * site.lateral + sample.up.y * lift,
    z: sample.pos.z + sample.right.z * site.lateral + sample.up.z * lift,
    sample,
  };
}

/** Yaw (about world Y) that makes a sprite's front face the road from a site on `side`. */
export function faceRoadYaw(sample: DecorTrackSample, side: number): number {
  // The prop looks along −right (side +1) or +right (side −1); yaw is measured from +Z toward +X.
  const dirX = -sample.right.x * side;
  const dirZ = -sample.right.z * side;
  return Math.atan2(dirX, dirZ);
}

/* -----------------------------------------------------------------------------
   Spacing — a hash grid over (s, lateral) of everything already standing
   -------------------------------------------------------------------------- */
export class SiteIndex {
  private readonly cells = new Map<string, { s: number; lateral: number; radius: number }[]>();
  constructor(private readonly cell = 600) {}

  private key(s: number, lateral: number) { return `${Math.floor(s / this.cell)}:${Math.floor(lateral / this.cell)}`; }

  add(s: number, lateral: number, radius: number): void {
    const key = this.key(s, lateral);
    const list = this.cells.get(key);
    if (list) list.push({ s, lateral, radius }); else this.cells.set(key, [{ s, lateral, radius }]);
  }

  /** True when a footprint of `radius` at (s, lateral) would overlap something already indexed. */
  blocked(s: number, lateral: number, radius: number): boolean {
    const cs = Math.floor(s / this.cell), cl = Math.floor(lateral / this.cell);
    const reach = Math.ceil((radius + this.cell) / this.cell);
    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach; j <= reach; j++) {
        const list = this.cells.get(`${cs + i}:${cl + j}`);
        if (!list) continue;
        for (const e of list) {
          const ds = e.s - s, dl = e.lateral - lateral, min = e.radius + radius;
          if (ds * ds + dl * dl < min * min) return true;
        }
      }
    }
    return false;
  }

  /** Every existing prop that has a track position, so new decor keeps clear of hand-placed work too. */
  static fromProps(track: DecorTrack, props: readonly PlacedProp[]): SiteIndex {
    const index = new SiteIndex();
    for (const prop of props) {
      if (prop.visible === false) continue;
      const kind = decorKind(prop.type);
      const radius = kind ? kind.footprint * (prop.scale || 1) : 150;
      const p = projectToTrack(track, { x: prop.x, y: prop.y, z: prop.z });
      // Something more than a track-width above or below the road is on another sheet of the mountain.
      if (Math.abs(p.altitude) > 1500) continue;
      index.add(p.s, p.lateral, radius);
    }
    return index;
  }
}

/* -----------------------------------------------------------------------------
   Picking a kind
   -------------------------------------------------------------------------- */
/** Weighted pick from the palette, times each kind's affinity for the stage; null when nothing suits. */
export function pickKind(palette: DecorPalette, stage: TrackStageId, rng: Rng, zone?: DecorKind['zone']): DecorKind | null {
  let total = 0;
  const weighted: { kind: DecorKind; w: number }[] = [];
  for (const entry of palette.kinds) {
    const kind = decorKind(entry.type);
    if (!kind || (zone && kind.zone !== zone)) continue;
    const w = entry.weight * (kind.stages[stage] ?? 0);
    if (w <= 0) continue;
    weighted.push({ kind, w });
    total += w;
  }
  if (!total) return null;
  let r = rng() * total;
  for (const { kind, w } of weighted) { r -= w; if (r <= 0) return kind; }
  return weighted[weighted.length - 1].kind;
}

/** Lateral offset from the road edge for a kind in its zone, scaled by `spread` (1 = catalogue default). */
export function zoneLateral(kind: DecorKind, sample: DecorTrackSample, side: number, rng: Rng, spread = 1): number {
  const [lo, hi] = ZONE_OFFSETS[kind.zone];
  const off = kind.footprint * rng.range(lo, lo + (hi - lo) * spread);
  return side * (sample.halfWidth + kind.footprint * 0.5 + off);
}

/* -----------------------------------------------------------------------------
   Placement → prop
   -------------------------------------------------------------------------- */
/** Fields every decoration carries, so a batch can be found, cleared and re-rolled. */
export interface DecorTag {
  readonly rule: string;
  readonly batch: string;
  readonly seed: number;
}

export interface PlacementHeight {
  /** World Y the prop's base should sit at (a terrain probe), or undefined for the road plane. */
  (placement: DecorPlacement, world: { x: number; y: number; z: number }): number | undefined;
}

export function placementToProp(track: DecorTrack, placement: DecorPlacement, tag: DecorTag, index: number, height?: PlacementHeight): PlacedProp {
  const world = siteWorld(track, placement);
  const y = height?.(placement, world) ?? world.y;
  const prop: PlacedProp = {
    id: `decor_${tag.batch}_${index}`,
    type: placement.kind.type,
    name: placement.kind.name,
    x: world.x, y, z: world.z,
    rotY: placement.rotY,
    scale: placement.scale,
    alignToTrack: false,
    trackDist: placement.s,
    flipX: placement.flipX || undefined,
    groupId: `decor_${tag.batch}`,
    decor: { ...tag },
  };
  if (placement.kind.animated) prop.animated = true;
  return prop;
}

export const decorTagOf = (prop: PlacedProp): DecorTag | null => {
  const tag = prop.decor as Partial<DecorTag> | undefined;
  return tag && typeof tag.rule === 'string' && typeof tag.batch === 'string' ? (tag as DecorTag) : null;
};

/** Every catalogued kind's footprint, for a quick "how big is this type" without a palette. */
export const footprintOf = (type: string, scale = 1) => (decorKind(type)?.footprint ?? 150) * scale;

/** The kinds a palette can place in a stage (for the panel's legend). */
export function kindsForStage(palette: DecorPalette, stage: TrackStageId): DecorKind[] {
  return palette.kinds.map((e) => decorKind(e.type)).filter((k): k is DecorKind => !!k && (k.stages[stage] ?? 0) > 0);
}

export const ALL_DECOR_TYPES: readonly string[] = DECOR_KINDS.map((k) => k.type);
