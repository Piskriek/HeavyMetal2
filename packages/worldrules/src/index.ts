import type { VariableDef } from '@hm/contracts';
import { heightAt, normalAt, type DirtyRect, type Terrain } from '@hm/terrain';

/**
 * How the world responds when you change it. Two kinds of preset:
 * - `world-rules`: what digging exposes (grass gives way to soil, deeper to rock), what sinks under water, whether plants follow the ground.
 * - `plant`: how each kind of plant or prop behaves (where it grows, whether it follows the ground, whether it disappears when its ground is dug
 *   away, drowned or made too steep).
 * Pure and deterministic. Surface ids are the island's paint ids (the same numbers as `SURF` in @hm/render).
 */

export const SURFACE_IDS = {
  seabed: 1, sand: 2, wetSand: 3, grass: 4, rock: 5, cliff: 6, basalt: 7, dunes: 8, mud: 9, strata: 10, moss: 11, coral: 12, lava: 13, scree: 14,
  pumice: 15, soil: 16,
} as const;
/** Ground names for menus, in id order (index + 1 = id). */
export const GROUND_NAMES: readonly string[] = ['seabed', 'sand', 'wet sand', 'grass', 'rock', 'cliff', 'basalt', 'dunes', 'mud', 'strata', 'moss', 'coral', 'lava', 'scree', 'pumice', 'soil'];
const nameOf = (id: number): string => GROUND_NAMES[id - 1] ?? 'soil';
const idOf = (name: unknown, fallback: number): number => {
  const i = typeof name === 'string' ? GROUND_NAMES.indexOf(name) : -1;
  return i >= 0 ? i + 1 : fallback;
};

const S = SURFACE_IDS;
/** Ground that counts as green (plants that like soil live here). */
export const GREEN: readonly number[] = [S.grass, S.moss, S.soil, S.mud];
export const SANDY: readonly number[] = [S.sand, S.dunes, S.wetSand];
export const ROCKY: readonly number[] = [S.rock, S.cliff, S.basalt, S.scree, S.pumice, S.strata, S.lava];
export const WET: readonly number[] = [S.wetSand, S.mud, S.seabed];

/* ------------------------------------------------------------------ world rules */

export interface WorldRules {
  /** Metres the ground must be lowered before its top layer changes. */
  digThreshold: number;
  /** Metres lowered before the deep layer shows. */
  deepDigDepth: number;
  /** What green ground (grass, moss) becomes when dug. */
  greenDugBecomes: number;
  /** What sandy ground becomes when dug. */
  sandDugBecomes: number;
  /** The layer under everything. */
  deepLayer: number;
  /** What ground becomes when it sinks under the water. */
  underwaterBecomes: number;
  /** Height of the sea. */
  waterLevel: number;
  /** Master switch: plants and props stay on the ground when it moves. */
  plantsFollowGround: boolean;
  /** Master switch: plants whose ground no longer suits them disappear. */
  plantsReact: boolean;
}

export const DEFAULT_RULES: WorldRules = {
  digThreshold: 0.2, deepDigDepth: 2.5, greenDugBecomes: S.soil, sandDugBecomes: S.wetSand, deepLayer: S.rock, underwaterBecomes: S.seabed, waterLevel: 0,
  plantsFollowGround: true, plantsReact: true,
};

const num = (v: unknown, d: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const surf = (v: unknown, d: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= GROUND_NAMES.length ? v : typeof v === 'string' ? idOf(v, d) : d);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function normalizeRules(raw: unknown): WorldRules {
  const r = rec(raw), d = DEFAULT_RULES;
  return {
    digThreshold: num(r.digThreshold, d.digThreshold, 0, 50),
    deepDigDepth: num(r.deepDigDepth, d.deepDigDepth, 0, 500),
    greenDugBecomes: surf(r.greenDugBecomes, d.greenDugBecomes),
    sandDugBecomes: surf(r.sandDugBecomes, d.sandDugBecomes),
    deepLayer: surf(r.deepLayer, d.deepLayer),
    underwaterBecomes: surf(r.underwaterBecomes, d.underwaterBecomes),
    waterLevel: num(r.waterLevel, d.waterLevel, -500, 500),
    plantsFollowGround: bool(r.plantsFollowGround, d.plantsFollowGround),
    plantsReact: bool(r.plantsReact, d.plantsReact),
  };
}

const groundVar = (key: string, label: string, doc: string, def: number): VariableDef => ({ key, type: 'enum', label, doc, tier: 'build', default: nameOf(def), options: GROUND_NAMES, group: 'Digging' });
export const RULE_VARIABLES: readonly VariableDef[] = [
  { key: 'digThreshold', type: 'number', label: 'Dig before it changes', doc: 'How deep you dig before the top layer gives way.', tier: 'build', default: DEFAULT_RULES.digThreshold, min: 0, max: 2, step: 0.05, unit: 'm', group: 'Digging' },
  groundVar('greenDugBecomes', 'Dug grass becomes', 'What grass and moss turn into when you dig them.', DEFAULT_RULES.greenDugBecomes),
  groundVar('sandDugBecomes', 'Dug sand becomes', 'What sand turns into when you dig it.', DEFAULT_RULES.sandDugBecomes),
  { key: 'deepDigDepth', type: 'number', label: 'Deep layer at', doc: 'How deep you dig before you hit the deep layer.', tier: 'build', default: DEFAULT_RULES.deepDigDepth, min: 0, max: 10, step: 0.1, unit: 'm', group: 'Digging' },
  groundVar('deepLayer', 'Deep layer', 'What is under everything.', DEFAULT_RULES.deepLayer),
  { ...groundVar('underwaterBecomes', 'Under water becomes', 'What ground turns into when it sinks under the sea.', DEFAULT_RULES.underwaterBecomes), group: 'Water' },
  { key: 'waterLevel', type: 'number', label: 'Sea level', doc: 'The height of the water.', tier: 'pro', default: 0, min: -5, max: 5, step: 0.05, unit: 'm', group: 'Water' },
  { key: 'plantsFollowGround', type: 'boolean', label: 'Plants follow the ground', doc: 'Raise or lower the ground and the plants on it go with it.', tier: 'play', default: true, group: 'Plants' },
  { key: 'plantsReact', type: 'boolean', label: 'Plants react', doc: 'Plants whose ground no longer suits them (dug, drowned, too steep) disappear.', tier: 'play', default: true, group: 'Plants' },
];

export const rulesToParams = (r: WorldRules): Record<string, number | string | boolean> => ({
  digThreshold: r.digThreshold, deepDigDepth: r.deepDigDepth, greenDugBecomes: nameOf(r.greenDugBecomes), sandDugBecomes: nameOf(r.sandDugBecomes), deepLayer: nameOf(r.deepLayer),
  underwaterBecomes: nameOf(r.underwaterBecomes), waterLevel: r.waterLevel, plantsFollowGround: r.plantsFollowGround, plantsReact: r.plantsReact,
});
export const paramsToRules = (p: unknown): WorldRules => normalizeRules(p);

/* ------------------------------------------------------------------ plants */

export type Grows = 'anywhere' | 'green ground' | 'sand and green ground' | 'sand' | 'rock' | 'wet ground';
export const GROWS: readonly Grows[] = ['anywhere', 'green ground', 'sand and green ground', 'sand', 'rock', 'wet ground'];
const GROWS_ON: Readonly<Record<Grows, readonly number[] | null>> = {
  anywhere: null, 'green ground': GREEN, 'sand and green ground': [...SANDY, ...GREEN], sand: SANDY, rock: ROCKY, 'wet ground': WET,
};
/** Whether a plant of this kind can live on this ground. */
export const canGrowOn = (grows: Grows, surface: number): boolean => { const list = GROWS_ON[grows]; return list === null || list.includes(surface); };

export interface PlantBehaviour {
  /** The foliage kind this behaviour is for (palm, bush, tuft, flowers, boulder, reeds, tiki, log, or a model id). */
  kind: string;
  name: string;
  grows: Grows;
  /** Stays on the ground when the ground under it moves. */
  followGround: boolean;
  /** Disappears when its ground stops suiting it. */
  disappears: boolean;
  /** Disappears under water. */
  drowns: boolean;
  /** Disappears when the ground gets steeper than this (degrees; 90 = never). */
  maxSlopeDeg: number;
  /** Dug up (gone) when the ground under it is lowered by more than this many metres (0 = never). */
  uprootDepth: number;
}

const plant = (kind: string, name: string, grows: Grows, drowns: boolean, maxSlopeDeg: number, uprootDepth: number, disappears = true): PlantBehaviour => ({ kind, name, grows, followGround: true, disappears, drowns, maxSlopeDeg, uprootDepth });
export const PLANTS: readonly PlantBehaviour[] = [
  plant('palm', 'Palm', 'sand and green ground', true, 35, 0.8),
  plant('bush', 'Bush', 'green ground', true, 40, 0.3),
  plant('tuft', 'Grass tuft', 'sand and green ground', true, 45, 0.12),
  plant('flowers', 'Flowers', 'green ground', true, 30, 0.12),
  plant('reeds', 'Reeds', 'wet ground', false, 25, 0.3),
  plant('boulder', 'Boulder', 'anywhere', false, 90, 0, false),
  plant('tiki', 'Tiki', 'anywhere', true, 40, 1.5, false),
  plant('log', 'Log', 'anywhere', false, 45, 0, false),
];
export const plantFor = (kind: string, list: readonly PlantBehaviour[] = PLANTS): PlantBehaviour => list.find((p) => p.kind === kind) ?? { ...plant(kind, kind, 'anywhere', false, 90, 0, false) };

export function normalizePlant(raw: unknown, kind = 'plant'): PlantBehaviour {
  const r = rec(raw);
  const base = plantFor(typeof r.kind === 'string' ? r.kind : kind);
  return {
    kind: typeof r.kind === 'string' && r.kind ? r.kind : base.kind,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : base.name,
    grows: GROWS.includes(r.grows as Grows) ? (r.grows as Grows) : base.grows,
    followGround: bool(r.followGround, base.followGround),
    disappears: bool(r.disappears, base.disappears),
    drowns: bool(r.drowns, base.drowns),
    maxSlopeDeg: num(r.maxSlopeDeg, base.maxSlopeDeg, 0, 90),
    uprootDepth: num(r.uprootDepth, base.uprootDepth, 0, 100),
  };
}

export const PLANT_VARIABLES: readonly VariableDef[] = [
  { key: 'grows', type: 'enum', label: 'Grows on', doc: 'The ground it can live on.', tier: 'play', default: 'anywhere', options: GROWS, group: 'Behaviour' },
  { key: 'followGround', type: 'boolean', label: 'Follows the ground', doc: 'Stays standing on the ground when you raise or lower it.', tier: 'play', default: true, group: 'Behaviour' },
  { key: 'disappears', type: 'boolean', label: 'Disappears on wrong ground', doc: 'Goes away when its ground is dug into something it cannot grow on.', tier: 'play', default: true, group: 'Behaviour' },
  { key: 'drowns', type: 'boolean', label: 'Drowns', doc: 'Goes away when its ground sinks under the water.', tier: 'play', default: true, group: 'Behaviour' },
  { key: 'uprootDepth', type: 'number', label: 'Dug up at', doc: 'Dig the ground under it deeper than this and it is gone (0 = never).', tier: 'play', default: 0.3, min: 0, max: 2, hardMin: 0, step: 0.05, unit: 'm', group: 'Behaviour' },
  { key: 'maxSlopeDeg', type: 'number', label: 'Steepest ground', doc: 'Goes away when the ground under it gets steeper than this.', tier: 'build', default: 35, min: 0, max: 90, hardMin: 0, hardMax: 90, step: 1, unit: 'deg', group: 'Behaviour' },
];
export const plantToParams = (p: PlantBehaviour): Record<string, number | string | boolean> => ({ grows: p.grows, followGround: p.followGround, disappears: p.disappears, drowns: p.drowns, uprootDepth: p.uprootDepth, maxSlopeDeg: p.maxSlopeDeg });

/* ------------------------------------------------------------------ responses */

/** The surface showing at a node: the stronger of its two paints. */
export function surfaceAtNode(t: Terrain, i: number): number {
  return (t.blend[i] ?? 0) < 128 ? t.surfaceA[i] ?? 0 : t.surfaceB[i] ?? 0;
}
export function surfaceAt(t: Terrain, x: number, z: number): number {
  const { cols, rows, cell, originX, originZ } = t.spec;
  const c = Math.min(cols - 1, Math.max(0, Math.round((x - originX) / cell)));
  const r = Math.min(rows - 1, Math.max(0, Math.round((z - originZ) / cell)));
  return surfaceAtNode(t, r * cols + c);
}

const setNode = (t: Terrain, i: number, s: number): void => { t.surfaceA[i] = s; t.surfaceB[i] = s; t.blend[i] = 0; };

/**
 * After a sculpt stroke: every node in `rect` that went down by more than the dig threshold shows what is under it, and every node that sank
 * under the water becomes sea bed. `before` is the height grid as it was when the stroke started. Raised ground keeps its surface.
 * Changes `t` in place and returns how many nodes changed surface.
 */
export function respondToSculpt(t: Terrain, before: Float32Array, rect: DirtyRect, rules: WorldRules = DEFAULT_RULES): number {
  const { cols, rows } = t.spec;
  let changed = 0;
  for (let r = Math.max(0, rect.r0); r <= Math.min(rows - 1, rect.r1); r++) {
    for (let c = Math.max(0, rect.c0); c <= Math.min(cols - 1, rect.c1); c++) {
      const i = r * cols + c;
      const h0 = before[i] ?? 0, h1 = t.heights[i] ?? 0;
      const dug = h0 - h1;
      const now = surfaceAtNode(t, i);
      let next = now;
      if (h1 < rules.waterLevel && h0 >= rules.waterLevel) next = rules.underwaterBecomes;
      else if (dug > rules.deepDigDepth) next = rules.deepLayer;
      else if (dug > rules.digThreshold) {
        if (GREEN.includes(now) && now !== rules.greenDugBecomes) next = rules.greenDugBecomes;
        else if (SANDY.includes(now) && now !== rules.sandDugBecomes) next = rules.sandDugBecomes;
      }
      if (next !== now) { setNode(t, i, next); changed++; }
    }
  }
  return changed;
}

export interface PlantPlacement { kind: string; x: number; y: number; z: number; yaw: number; scale: number }
export interface SettleResult { items: PlantPlacement[]; removed: number; moved: number }

/** The world-space box a dirty rect covers (nodes c0..c1, r0..r1), grown by `pad` metres. */
export function rectToArea(t: Terrain, rect: DirtyRect, pad = 0): { x0: number; z0: number; x1: number; z1: number } {
  const { cell, originX, originZ } = t.spec;
  return { x0: originX + rect.c0 * cell - pad, z0: originZ + rect.r0 * cell - pad, x1: originX + rect.c1 * cell + pad, z1: originZ + rect.r1 * cell + pad };
}

/**
 * Plants and props respond to the ground under them: they follow it up and down, and they go away when it no longer suits them (dug into
 * the wrong ground, under water, too steep). Only things inside `area` are checked, so a plant that was placed on odd ground by hand stays
 * until someone changes the ground under it. Pure: returns a new list.
 */
export function settlePlants(items: readonly PlantPlacement[], t: Terrain, area: { x0: number; z0: number; x1: number; z1: number } | null, rules: WorldRules = DEFAULT_RULES, plants: readonly PlantBehaviour[] = PLANTS, before?: Float32Array): SettleResult {
  const old: Terrain | null = before && before.length === t.heights.length ? { ...t, heights: before } : null;
  const out: PlantPlacement[] = [];
  let removed = 0, moved = 0;
  for (const it of items) {
    const inside = !area || (it.x >= area.x0 && it.x <= area.x1 && it.z >= area.z0 && it.z <= area.z1);
    if (!inside) { out.push(it); continue; }
    const b = plantFor(it.kind, plants);
    const g = heightAt(t, it.x, it.z);
    if (rules.plantsReact) {
      const ground = surfaceAt(t, it.x, it.z);
      const n = normalAt(t, it.x, it.z);
      const slope = (Math.acos(Math.min(1, Math.max(-1, n[1]))) * 180) / Math.PI;
      const drowned = b.drowns && g < rules.waterLevel;
      const wrong = b.disappears && !canGrowOn(b.grows, ground);
      const steep = b.disappears && b.maxSlopeDeg < 90 && slope > b.maxSlopeDeg;
      const dugUp = old !== null && b.uprootDepth > 0 && heightAt(old, it.x, it.z) - g > b.uprootDepth;
      if (drowned || wrong || steep || dugUp) { removed++; continue; }
    }
    if (rules.plantsFollowGround && b.followGround && Math.abs(it.y - g) > 1e-3) { out.push({ ...it, y: g }); moved++; continue; }
    out.push(it);
  }
  return { items: out, removed, moved };
}

/** Decor presets store placements flat: kind index, x, y, z, yaw, scale per item. */
export function unpackDecor(kinds: readonly string[], items: readonly number[]): PlantPlacement[] {
  const out: PlantPlacement[] = [];
  for (let i = 0; i + 5 < items.length; i += 6) {
    const kind = kinds[items[i]!] ?? 'unknown';
    out.push({ kind, x: items[i + 1]!, y: items[i + 2]!, z: items[i + 3]!, yaw: items[i + 4]!, scale: items[i + 5]! });
  }
  return out;
}
export function packDecor(list: readonly PlantPlacement[]): { kinds: string[]; items: number[] } {
  const kinds: string[] = [];
  const items: number[] = [];
  const r2 = (v: number): number => Math.round(v * 100) / 100;
  for (const p of list) {
    let k = kinds.indexOf(p.kind);
    if (k < 0) { k = kinds.length; kinds.push(p.kind); }
    items.push(k, r2(p.x), r2(p.y), r2(p.z), Math.round(p.yaw * 1000) / 1000, r2(p.scale));
  }
  return { kinds, items };
}
