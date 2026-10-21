// The props in the world, as saved per profile (TASK-23c): the lab clutter that was cleared (each one salvaged once), the lore logs
// that were read, and the leak sites that were sealed (their wreck props restored a rung). Pure: the screen reads and writes the
// string with kv, and every change returns a new value, so a bad or old save reads as the empty one.

import type { Overrides, PartOverride } from '@hm/kitspec';

export const PROPS_SAVE_KEY = 'hm.setmix.props';

export interface PropsSave {
  readonly v: 1;
  /** Clutter ids cleared by a salvage. A cleared prop is never given again. */
  readonly cleared: readonly string[];
  /** Lore log ids (LOG-01 to LOG-08) that have been read. */
  readonly logs: readonly string[];
  /** Leak site indices whose seal is done. */
  readonly sealed: readonly number[];
  /** TICKET-32: the beam's part overrides on the lab's kit-built props, by kit id then part path. Omitted when none. */
  readonly kits?: Readonly<Record<string, Overrides>>;
  /** Plan 39 (Aq): the trees the beam regrew, by place key (its spot to the centimetre), and the preset each grows as. */
  readonly trees?: Readonly<Record<string, TreePreset>>;
}

/** A species preset a tree grows as: its species and its treegen slider values. */
export interface TreePreset {
  readonly species: 'pine' | 'oak' | 'birch';
  readonly params: Readonly<Record<string, number>>;
}

export const EMPTY_PROPS_SAVE: PropsSave = { v: 1, cleared: [], logs: [], sealed: [] };

const strings = (x: unknown): string[] => (Array.isArray(x) ? [...new Set(x.filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length <= 64))] : []);
const ints = (x: unknown): number[] => (Array.isArray(x) ? [...new Set(x.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 1000))].sort((a, b) => a - b) : []);

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const shortId = (k: string): boolean => k.length > 0 && k.length <= 96;
const numbers = (x: unknown): Record<string, number> | null => {
  if (!isObj(x)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x)) if (shortId(k) && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
};
const texts = (x: unknown): Record<string, string> | null => {
  if (!isObj(x)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(x)) if (shortId(k) && typeof v === 'string' && shortId(v)) out[k] = v;
  return out;
};

/** One override read back defensively: unknown or malformed fields are dropped; an empty result is null. */
function override(x: unknown): PartOverride | null {
  if (!isObj(x)) return null;
  const o: { -readonly [K in keyof PartOverride]?: PartOverride[K] } = {};
  if (typeof x.gen === 'string' && shortId(x.gen)) o.gen = x.gen;
  if (typeof x.material === 'string' && shortId(x.material)) o.material = x.material;
  const params = numbers(x.params);
  if (params && Object.keys(params).length > 0) o.params = params;
  const sm = texts(x.slotMaterials);
  if (sm && Object.keys(sm).length > 0) o.slotMaterials = sm;
  if (Array.isArray(x.ops)) {
    o.ops = x.ops.slice(0, 8).flatMap((op) => (isObj(op) && typeof op.op === 'string' && shortId(op.op) ? [{ op: op.op, params: numbers(op.params) ?? {} }] : []));
  }
  return Object.keys(o).length > 0 ? o : null;
}

/** The kits' overrides from a save: at most 32 kits of 512 parts each. */
function kitsOf(x: unknown): Record<string, Overrides> {
  const out: Record<string, Overrides> = {};
  if (!isObj(x)) return out;
  for (const [kit, paths] of Object.entries(x).slice(0, 128)) {
    if (!shortId(kit) || !isObj(paths)) continue;
    const list: Record<string, PartOverride> = {};
    for (const [path, ov] of Object.entries(paths).slice(0, 512)) {
      const o = shortId(path) ? override(ov) : null;
      if (o) list[path] = o;
    }
    if (Object.keys(list).length > 0) out[kit] = list;
  }
  return out;
}

const SPECIES = new Set(['pine', 'oak', 'birch']);
const PLACE = /^-?\d{1,7},-?\d{1,7}$/;
function treesOf(x: unknown): Record<string, TreePreset> {
  const out: Record<string, TreePreset> = {};
  if (!isObj(x)) return out;
  for (const [place, p] of Object.entries(x).slice(0, 4096)) {
    if (!PLACE.test(place) || !isObj(p) || typeof p.species !== 'string' || !SPECIES.has(p.species)) continue;
    const params = numbers(p.params);
    if (params) out[place] = { species: p.species as TreePreset['species'], params };
  }
  return out;
}

/** The save from its stored text. Anything unreadable, or of another version, is the empty save. */
export function parsePropsSave(raw: string | null): PropsSave {
  if (!raw) return EMPTY_PROPS_SAVE;
  try {
    const o = JSON.parse(raw) as { v?: unknown; cleared?: unknown; logs?: unknown; sealed?: unknown; kits?: unknown; trees?: unknown } | null;
    if (!o || o.v !== 1) return EMPTY_PROPS_SAVE;
    const kits = kitsOf(o.kits), trees = treesOf(o.trees);
    const base: PropsSave = { v: 1, cleared: strings(o.cleared), logs: strings(o.logs), sealed: ints(o.sealed) };
    return { ...base, ...(Object.keys(kits).length > 0 ? { kits } : {}), ...(Object.keys(trees).length > 0 ? { trees } : {}) };
  } catch {
    return EMPTY_PROPS_SAVE;
  }
}

export function serializePropsSave(s: PropsSave): string {
  const kits = s.kits && Object.keys(s.kits).length > 0 ? { kits: s.kits } : {};
  const trees = s.trees && Object.keys(s.trees).length > 0 ? { trees: s.trees } : {};
  return JSON.stringify({ v: 1, cleared: [...s.cleared], logs: [...s.logs], sealed: [...s.sealed], ...kits, ...trees });
}

/** The save with these trees regrown as `preset` (the beam's Apply with a species cartridge: one tree, or every match). */
export function withTrees(s: PropsSave, places: readonly string[], preset: TreePreset): PropsSave {
  const next: Record<string, TreePreset> = { ...(s.trees ?? {}) };
  for (const p of places) next[p] = preset;
  return { ...s, trees: next };
}

/** The save with these parts of a kit overridden (the beam's Apply with a part cartridge: one path, or every match). */
export function withKitOverride(s: PropsSave, kit: string, paths: readonly string[], ov: PartOverride): PropsSave {
  const current = s.kits?.[kit] ?? {};
  const next: Record<string, PartOverride> = { ...current };
  for (const p of paths) next[p] = ov;
  return { ...s, kits: { ...(s.kits ?? {}), [kit]: next } };
}

/** The save with a prop cleared. Clearing a prop twice changes nothing (the same object comes back). */
export function clearedProp(s: PropsSave, id: string): PropsSave {
  return s.cleared.includes(id) ? s : { ...s, cleared: [...s.cleared, id] };
}

/** The save with a log read. Reading again changes nothing. */
export function readLog(s: PropsSave, id: string): PropsSave {
  return s.logs.includes(id) ? s : { ...s, logs: [...s.logs, id] };
}

/** The save with a leak site sealed. Sealing again changes nothing. */
export function sealedSite(s: PropsSave, site: number): PropsSave {
  return s.sealed.includes(site) ? s : { ...s, sealed: [...s.sealed, site].sort((a, b) => a - b) };
}
