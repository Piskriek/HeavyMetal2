/**
 * The shipped default overrides of the game's kits (plan 49, "save as default").
 *
 * Piskriek changes a kit live in the game (a voice order on what he pinged, or an AI on the Neural Bridge); "save as default"
 * sends that kit's overrides to the bridge, which writes them into `src/studio-data/kit-defaults.json`. Every build of that
 * kit starts from these, and the player's own overrides (the beam's cartridges, his save) sit on top. Committing the file
 * ships the change to everyone with the next build.
 *
 * Keys: a named kit by its id ('gate', 'gate-dais', 'capacitor-bank', 'stargate'); a plot machine by its kind
 * ('machine:<kind>'), since each standing machine has its own instance id. The file is read through the same shape check
 * the bridge writes with, so a hand edit that breaks the shape drops that entry, never the game.
 */
import type { OpRef, Overrides, PartOverride } from '@hm/kitspec';
import raw from '../studio-data/kit-defaults.json';

/** A kit id or default key: letters, digits and : @ . _ - (no spaces, no slashes). */
export const KIT_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9:@._-]{0,63}$/;
/** A placed part's path: keys, repeat indices and slashes ('cells[1]/can', 'rim-front'). Kit keys carry no dots. */
export const PART_PATH_RE = /^[A-Za-z0-9_\-[\]#:][A-Za-z0-9_\-[\]/#:]{0,127}$/;
/** A material name: a lab material, a swatch, 'mat:'/'matc:'/'lx:' names and their share codes. */
export const MATERIAL_RE = /^[A-Za-z0-9_:.#=+,/-]{1,2048}$/;
const NAME_RE = /^[A-Za-z0-9_.-]{1,64}$/;
export const MAX_KITS = 64;
export const MAX_PATHS = 256;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function numbers(v: unknown): Record<string, number> | null {
  if (!isRecord(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    if (!NAME_RE.test(k) || typeof n !== 'number' || !Number.isFinite(n)) return null;
    out[k] = n;
  }
  return out;
}

function materials(v: unknown): Record<string, string> | null {
  if (!isRecord(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, m] of Object.entries(v)) {
    if (!NAME_RE.test(k) || typeof m !== 'string' || !MATERIAL_RE.test(m)) return null;
    out[k] = m;
  }
  return out;
}

/** One part's override, shape-checked; null when any field is wrong (the whole entry is dropped, not half of it). */
export function checkPartOverride(v: unknown): PartOverride | null {
  if (!isRecord(v)) return null;
  const out: { -readonly [K in keyof PartOverride]: PartOverride[K] } = {};
  for (const [k, field] of Object.entries(v)) {
    if (k === 'material') {
      if (typeof field !== 'string' || !MATERIAL_RE.test(field)) return null;
      out.material = field;
    } else if (k === 'gen') {
      if (typeof field !== 'string' || !NAME_RE.test(field)) return null;
      out.gen = field;
    } else if (k === 'params') {
      const p = numbers(field);
      if (!p) return null;
      out.params = p;
    } else if (k === 'slotMaterials') {
      const s = materials(field);
      if (!s) return null;
      out.slotMaterials = s;
    } else if (k === 'ops') {
      if (!Array.isArray(field) || field.length > 16) return null;
      const ops: OpRef[] = [];
      for (const op of field) {
        if (!isRecord(op) || typeof op.op !== 'string' || !NAME_RE.test(op.op)) return null;
        const params = op.params === undefined ? {} : numbers(op.params);
        if (!params) return null;
        ops.push({ op: op.op, params });
      }
      out.ops = ops;
    } else {
      return null;
    }
  }
  return out;
}

/** A whole defaults file, shape-checked: bad kits and bad parts are dropped, the rest kept. */
export function checkKitDefaults(v: unknown): Record<string, Overrides> {
  const out: Record<string, Overrides> = {};
  if (!isRecord(v)) return out;
  for (const [kit, parts] of Object.entries(v).slice(0, MAX_KITS)) {
    if (!KIT_KEY_RE.test(kit) || !isRecord(parts)) continue;
    const ov: Record<string, PartOverride> = {};
    for (const [path, o] of Object.entries(parts).slice(0, MAX_PATHS)) {
      const checked = PART_PATH_RE.test(path) ? checkPartOverride(o) : null;
      if (checked) ov[path] = checked;
    }
    out[kit] = ov;
  }
  return out;
}

let defaults: Readonly<Record<string, Overrides>> = checkKitDefaults(raw);

/** The shipped defaults (read-only). */
export function kitDefaults(): Readonly<Record<string, Overrides>> {
  return defaults;
}

/** Replaces the defaults in this page (after a save, so the next build reads them without a reload). */
export function setKitDefaults(next: unknown): void {
  defaults = checkKitDefaults(next);
}

/**
 * A kit's overrides on top of its shipped defaults, field by field per part (a default material stays under a player's
 * part cartridge that only changed the bolt's size). Without defaults the overrides come back as given (undefined stays
 * undefined, so a caller that treats "no overrides" specially still can).
 */
export function withKitDefaults(key: string, overrides: Overrides | undefined): Overrides | undefined {
  const base = defaults[key];
  if (!base || Object.keys(base).length === 0) return overrides;
  const out: Record<string, PartOverride> = { ...base };
  for (const [path, o] of Object.entries(overrides ?? {})) out[path] = { ...(base[path] ?? {}), ...o };
  return out;
}
