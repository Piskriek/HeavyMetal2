/**
 * The asset tweaks the game reads (`src/studio-data/asset-tweaks.json`): one schema for the Studio UI and for the dev
 * write endpoint, so a value the UI can make is a value the server accepts. Pure data and checks, no imports.
 */

export type Vec3 = [number, number, number];

export interface AssetTweak {
  readonly offset?: Vec3;
  readonly scale?: number | Vec3;
  readonly yaw?: number;
  readonly tint?: string;
  readonly metalness?: number;
  readonly roughness?: number;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
}

export type TweakKey = keyof AssetTweak;
export type TweakGroup = 'Fit' | 'Material' | 'Glow';

export interface FieldDef {
  readonly key: TweakKey;
  readonly label: string;
  readonly group: TweakGroup;
  readonly kind: 'number' | 'vec3' | 'color';
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
  readonly help: string;
  /** The value that means "leave the model as it is": it is left out of the file. */
  readonly neutral: number | Vec3 | string;
}

export const FIELDS: readonly FieldDef[] = [
  { key: 'offset', label: 'Offset', group: 'Fit', kind: 'vec3', min: -5, max: 5, step: 0.01, unit: 'm', help: 'Moves the model from its origin: x across, y up, z forward.', neutral: [0, 0, 0] },
  { key: 'scale', label: 'Scale', group: 'Fit', kind: 'vec3', min: 0.05, max: 5, step: 0.01, unit: 'x', help: "Size. 1 is the model's own size.", neutral: [1, 1, 1] },
  { key: 'yaw', label: 'Turn', group: 'Fit', kind: 'number', min: -180, max: 180, step: 1, unit: 'deg', help: 'Turns the model round its up axis.', neutral: 0 },
  { key: 'tint', label: 'Base colour', group: 'Material', kind: 'color', min: 0, max: 0, step: 0, unit: '', help: "Sets the surface colour. Empty keeps the model's own.", neutral: '' },
  { key: 'metalness', label: 'Metal', group: 'Material', kind: 'number', min: 0, max: 1, step: 0.01, unit: '', help: "How metallic it looks. Model keeps the model's own.", neutral: -1 },
  { key: 'roughness', label: 'Roughness', group: 'Material', kind: 'number', min: 0, max: 1, step: 0.01, unit: '', help: "How matt it looks. Model keeps the model's own.", neutral: -1 },
  { key: 'emissive', label: 'Glow colour', group: 'Glow', kind: 'color', min: 0, max: 0, step: 0, unit: '', help: 'The colour the surface gives off. Empty for none.', neutral: '' },
  { key: 'emissiveIntensity', label: 'Glow strength', group: 'Glow', kind: 'number', min: 0, max: 4, step: 0.01, unit: '', help: 'How strongly the glow shows.', neutral: 0 },
];

export const ASSET_ID = /^[a-z0-9-]{1,40}$/;
const COLOUR = /^(#[0-9a-fA-F]{6})?$/;

export const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** True when a value means "leave the model as it is" (scale 1 is the same as [1, 1, 1]). */
export function isNeutral(f: FieldDef, v: unknown): boolean {
  if (f.key === 'scale' && (v === 1 || (Array.isArray(v) && v.every((x) => x === 1)))) return true;
  return sameValue(v, f.neutral);
}

const isPlain = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const inRange = (x: number, f: FieldDef): boolean => x >= f.min && x <= f.max;

/** Why a value is not allowed for a field, or null when it is. The neutral value is always allowed. */
export function fieldError(f: FieldDef, v: unknown): string | null {
  if (isNeutral(f, v)) return null;
  if (f.kind === 'color') return typeof v === 'string' && COLOUR.test(v) ? null : 'expected "" or a colour like #rrggbb';
  if (f.kind === 'number' || (f.key === 'scale' && finite(v))) {
    if (!finite(v)) return 'expected a number';
    return inRange(v, f) ? null : `expected a number from ${f.min} to ${f.max}`;
  }
  if (!Array.isArray(v) || v.length !== 3) return 'expected [x, y, z]';
  for (const c of v as unknown[]) {
    if (!finite(c) || !inRange(c, f)) return `each axis must be a number from ${f.min} to ${f.max}`;
  }
  return null;
}

export type TweakCheck = { readonly ok: true; readonly value: Record<string, AssetTweak> } | { readonly ok: false; readonly why: string };

/** Checks a whole asset-tweaks file: known asset ids only, known fields only, every value in range. */
export function checkTweaks(data: unknown, knownIds: ReadonlySet<string>): TweakCheck {
  if (!isPlain(data)) return { ok: false, why: 'the file must be a JSON object keyed by asset id' };
  const out: Record<string, AssetTweak> = {};
  for (const id of Object.keys(data)) {
    if (!ASSET_ID.test(id)) return { ok: false, why: `bad asset id "${id}"` };
    if (!knownIds.has(id)) return { ok: false, why: `unknown asset "${id}"` };
    const entry = data[id];
    if (!isPlain(entry)) return { ok: false, why: `${id}: expected an object of fields` };
    for (const key of Object.keys(entry)) {
      const f = FIELDS.find((x) => x.key === key);
      if (!f) return { ok: false, why: `${id}: unknown field "${key}"` };
      const err = fieldError(f, entry[key]);
      if (err) return { ok: false, why: `${id}.${key}: ${err}` };
    }
    out[id] = { ...(entry as AssetTweak) };
  }
  return { ok: true, value: out };
}
