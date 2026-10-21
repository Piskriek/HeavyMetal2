/**
 * Materials as short text codes (plan 41 section 4.4), for the player's own materials: a cartridge, a part's override in a
 * plot save and a share code all carry `matc:<code>`. A shelf preset keeps its name, `mat:<id>`.
 *
 * The code is @hm/presetcodec's: the spec laid out by MATERIAL_SCHEMA (every field present, values on a grid), versioned
 * by the schema's fingerprint and CRC-checked, so a damaged or foreign code reads as null and never throws. Encoding
 * clamps and snaps every value to its grid first (quantiseMaterial), so what a code decodes to is exactly what was saved.
 */
import { decode, encode, type Field, type Schema } from '@hm/presetcodec';
import { BLEND_MODES, CHANNEL_GROUPS, MAX_LAYERS, MAX_MASK_INPUTS, MAX_RAMP_STOPS, NOISE_KINDS, PAINT_REFS } from './constants';
import { isHex } from './index';
import type { ChannelGroup, LayerSpec, MaskInput, MaskSpec, MaterialSpec, NoiseKind, RampStop, SurfaceSpec } from './index';
import { MATERIAL_SHELF, resolveMatPreset } from './shelf';

type Grid = { readonly min: number; readonly max: number; readonly step: number };
const UNIT: Grid = { min: 0, max: 1, step: 0.001 };
const SIGNED: Grid = { min: -1, max: 1, step: 0.001 };
const WIDTH: Grid = { min: 0, max: 0.05, step: 0.0001 };
const ANGLE: Grid = { min: 0, max: 180, step: 0.1 };
const SOFT: Grid = { min: 0, max: 90, step: 0.001 };
const HEIGHT: Grid = { min: 0, max: 20, step: 0.001 };
const SCALE: Grid = { min: 0.001, max: 50, step: 0.001 };
const STRETCH: Grid = { min: 1, max: 50, step: 0.01 };
const THICKNESS: Grid = { min: 0, max: 2000, step: 1 };
const INTENSITY: Grid = { min: 0, max: 20, step: 0.01 };
const NAME_BYTES = 48;
const TILE_BYTES = 40;
const SEED_MAX = 65535;

const float = (g: Grid): Field => ({ kind: 'float', min: g.min, max: g.max, step: g.step });
const str = (maxBytes: number): Field => ({ kind: 'string', maxBytes });
const bool: Field = { kind: 'bool' };
const color: Field = { kind: 'color' };
const obj = (fields: Readonly<Record<string, Field>>): Field => ({ kind: 'object', fields });

const INPUT_KINDS = ['all', 'edge', 'cavity', 'up', 'down', 'ground', 'noise', 'streaks'] as const;

const TILE_FIELDS = { on: bool, id: str(TILE_BYTES), scale: float(SCALE), bump: float(UNIT), roughVar: float(UNIT) };
const SURFACE: Field = obj({
  name: str(NAME_BYTES),
  colourKind: { kind: 'enum', options: ['hex', ...PAINT_REFS] },
  colour: color,
  ramp: { kind: 'array', maxLength: MAX_RAMP_STOPS, of: obj({ at: float(UNIT), colour: color }) },
  metal: float(UNIT),
  rough: float(UNIT),
  specular: float(UNIT),
  tile: obj({ ...TILE_FIELDS, colourVar: float(UNIT) }),
  detail: obj(TILE_FIELDS),
  coat: obj({ on: bool, amount: float(UNIT), rough: float(UNIT) }),
  fuzz: obj({ on: bool, amount: float(UNIT), colour: color }),
  aniso: obj({ on: bool, amount: float(UNIT), axis: { kind: 'enum', options: ['u', 'v'] } }),
  film: obj({ on: bool, amount: float(UNIT), thickness: float(THICKNESS) }),
  emit: obj({ on: bool, colour: color, intensity: float(INTENSITY) }),
});
const INPUT: Field = obj({
  kind: { kind: 'enum', options: INPUT_KINDS },
  blend: { kind: 'enum', options: BLEND_MODES },
  opacity: float(UNIT),
  invert: bool,
  width: float(WIDTH),
  angle: float(ANGLE),
  soft: float(SOFT),
  height: float(HEIGHT),
  noise: { kind: 'enum', options: NOISE_KINDS },
  scale: float(SCALE),
  stretch: float(STRETCH),
  seed: { kind: 'int', min: 0, max: SEED_MAX },
});
const MASK: Field = obj({ name: str(NAME_BYTES), inputs: { kind: 'array', maxLength: MAX_MASK_INPUTS, of: INPUT }, balance: float(SIGNED), contrast: float(UNIT), invert: bool });
const LAYER: Field = obj({
  name: str(NAME_BYTES),
  surface: SURFACE,
  mask: MASK,
  opacity: float(UNIT),
  writes: { kind: 'array', maxLength: CHANNEL_GROUPS.length, of: { kind: 'enum', options: CHANNEL_GROUPS } },
  heightBlend: float(UNIT),
  weathering: bool,
  visible: bool,
});

/** The material code's layout: every field present, every number on a grid. Changing it changes the fingerprint. */
export const MATERIAL_SCHEMA: Schema = {
  id: 'hm.matstack.material',
  version: 1,
  root: obj({ name: str(NAME_BYTES), base: SURFACE, paint1: color, paint2: color, layers: { kind: 'array', maxLength: MAX_LAYERS, of: LAYER }, age: float(UNIT) }),
};

// ------------------------------------------------------------------ spec <-> code form

/** A value clamped and snapped to its grid, exactly as presetcodec reads it back. */
const q = (g: Grid, v: number | undefined): number => {
  const x = Number.isFinite(v) ? (v as number) : g.min;
  const k = Math.round((Math.min(g.max, Math.max(g.min, x)) - g.min) / g.step);
  const out = g.min + k * g.step;
  return (out > g.max ? g.max : out < g.min ? g.min : out) + 0;
};
const hex = (c: string | undefined): string => (c && isHex(c) ? c.toLowerCase() : '#808080');
/** Text cut to a byte budget without breaking a character. */
const cut = (s: string, bytes: number): string => {
  let out = '';
  for (const ch of s) {
    if (new TextEncoder().encode(out + ch).length > bytes) break;
    out += ch;
  }
  return out;
};

type Form = Record<string, unknown>;

function surfaceForm(s: SurfaceSpec): Form {
  const isPaint = (PAINT_REFS as readonly string[]).includes(s.colour);
  const tile = (t: SurfaceSpec['detail']) => ({ on: !!t, id: cut(t?.tile ?? '', TILE_BYTES), scale: q(SCALE, t?.scale ?? 1), bump: q(UNIT, t?.bump ?? 0), roughVar: q(UNIT, t?.roughVar ?? 0) });
  return {
    name: cut(s.name, NAME_BYTES),
    colourKind: isPaint ? s.colour : 'hex',
    colour: isPaint ? '#808080' : hex(s.colour),
    ramp: (s.ramp ?? []).slice(0, MAX_RAMP_STOPS).map((r) => ({ at: q(UNIT, r.at), colour: hex(r.colour) })),
    metal: q(UNIT, s.metal),
    rough: q(UNIT, s.rough),
    specular: q(UNIT, s.specular),
    tile: { ...tile(s.tile), colourVar: q(UNIT, s.tile?.colourVar ?? 0) },
    detail: tile(s.detail),
    coat: { on: !!s.coat, amount: q(UNIT, s.coat?.amount ?? 0), rough: q(UNIT, s.coat?.rough ?? 0.1) },
    fuzz: { on: !!s.fuzz, amount: q(UNIT, s.fuzz?.amount ?? 0), colour: hex(s.fuzz?.colour ?? '#000000') },
    aniso: { on: !!s.aniso, amount: q(UNIT, s.aniso?.amount ?? 0), axis: s.aniso?.axis ?? 'u' },
    film: { on: !!s.film, amount: q(UNIT, s.film?.amount ?? 0), thickness: q(THICKNESS, s.film?.thickness ?? 400) },
    emit: { on: !!s.emit, colour: hex(s.emit?.colour ?? '#000000'), intensity: q(INTENSITY, s.emit?.intensity ?? 0) },
  };
}

function inputForm(i: MaskInput): Form {
  const f: Form = {
    kind: i.kind, blend: i.blend, opacity: q(UNIT, i.opacity), invert: !!i.invert,
    width: 0, angle: 0, soft: 0, height: 0, noise: 'clouds', scale: q(SCALE, 1), stretch: q(STRETCH, 1), seed: 0,
  };
  const seed = (s: number): number => Math.min(SEED_MAX, Math.max(0, Math.round(Number.isFinite(s) ? s : 0)));
  switch (i.kind) {
    case 'edge': case 'cavity': f.width = q(WIDTH, i.width); break;
    case 'up': case 'down': f.angle = q(ANGLE, i.angle); f.soft = q(SOFT, i.soft); break;
    case 'ground': f.height = q(HEIGHT, i.height); f.soft = q(SOFT, i.soft); break;
    case 'noise': f.noise = i.noise; f.scale = q(SCALE, i.scale); f.seed = seed(i.seed); break;
    case 'streaks': f.scale = q(SCALE, i.scale); f.stretch = q(STRETCH, i.stretch); f.seed = seed(i.seed); break;
    case 'all': break;
  }
  return f;
}

const maskForm = (m: MaskSpec): Form => ({
  name: cut(m.name, NAME_BYTES), inputs: m.inputs.slice(0, MAX_MASK_INPUTS).map(inputForm),
  balance: q(SIGNED, m.balance), contrast: q(UNIT, m.contrast), invert: !!m.invert,
});

const layerForm = (l: LayerSpec): Form => ({
  name: cut(l.name, NAME_BYTES), surface: surfaceForm(l.surface), mask: maskForm(l.mask), opacity: q(UNIT, l.opacity),
  writes: CHANNEL_GROUPS.filter((g) => l.writes.includes(g)), heightBlend: q(UNIT, l.heightBlend), weathering: !!l.weathering, visible: l.visible !== false,
});

const materialForm = (m: MaterialSpec): Form => ({
  name: cut(m.name, NAME_BYTES), base: surfaceForm(m.base), paint1: hex(m.paint[0]), paint2: hex(m.paint[1]),
  layers: m.layers.slice(0, MAX_LAYERS).map(layerForm), age: q(UNIT, m.age),
});

function surfaceOf(f: Form): SurfaceSpec {
  const tile = f.tile as Form, detail = f.detail as Form, coat = f.coat as Form, fuzz = f.fuzz as Form;
  const aniso = f.aniso as Form, film = f.film as Form, emit = f.emit as Form;
  const ramp = (f.ramp as Form[]).map((r): RampStop => ({ at: r.at as number, colour: r.colour as string }));
  return {
    name: f.name as string,
    colour: f.colourKind === 'hex' ? (f.colour as string) : (f.colourKind as string),
    ...(ramp.length > 0 ? { ramp } : {}),
    metal: f.metal as number,
    rough: f.rough as number,
    specular: f.specular as number,
    ...(tile.on ? { tile: { tile: tile.id as string, scale: tile.scale as number, bump: tile.bump as number, roughVar: tile.roughVar as number, colourVar: tile.colourVar as number } } : {}),
    ...(detail.on ? { detail: { tile: detail.id as string, scale: detail.scale as number, bump: detail.bump as number, roughVar: detail.roughVar as number } } : {}),
    ...(coat.on ? { coat: { amount: coat.amount as number, rough: coat.rough as number } } : {}),
    ...(fuzz.on ? { fuzz: { amount: fuzz.amount as number, colour: fuzz.colour as string } } : {}),
    ...(aniso.on ? { aniso: { amount: aniso.amount as number, axis: aniso.axis as 'u' | 'v' } } : {}),
    ...(film.on ? { film: { amount: film.amount as number, thickness: film.thickness as number } } : {}),
    ...(emit.on ? { emit: { colour: emit.colour as string, intensity: emit.intensity as number } } : {}),
  };
}

function inputOf(f: Form): MaskInput {
  const base = { blend: f.blend as MaskInput['blend'], opacity: f.opacity as number, invert: f.invert as boolean };
  switch (f.kind as MaskInput['kind']) {
    case 'edge': return { ...base, kind: 'edge', width: f.width as number };
    case 'cavity': return { ...base, kind: 'cavity', width: f.width as number };
    case 'up': return { ...base, kind: 'up', angle: f.angle as number, soft: f.soft as number };
    case 'down': return { ...base, kind: 'down', angle: f.angle as number, soft: f.soft as number };
    case 'ground': return { ...base, kind: 'ground', height: f.height as number, soft: f.soft as number };
    case 'noise': return { ...base, kind: 'noise', noise: f.noise as NoiseKind, scale: f.scale as number, seed: f.seed as number };
    case 'streaks': return { ...base, kind: 'streaks', scale: f.scale as number, stretch: f.stretch as number, seed: f.seed as number };
    default: return { ...base, kind: 'all' };
  }
}

const maskOf = (f: Form): MaskSpec => ({
  name: f.name as string, inputs: (f.inputs as Form[]).map(inputOf),
  balance: f.balance as number, contrast: f.contrast as number, invert: f.invert as boolean,
});

const layerOf = (f: Form): LayerSpec => ({
  name: f.name as string, surface: surfaceOf(f.surface as Form), mask: maskOf(f.mask as Form), opacity: f.opacity as number,
  writes: f.writes as ChannelGroup[], heightBlend: f.heightBlend as number, weathering: f.weathering as boolean, visible: f.visible as boolean,
});

const materialOf = (f: Form): MaterialSpec => ({
  name: f.name as string, base: surfaceOf(f.base as Form), paint: [f.paint1 as string, f.paint2 as string],
  layers: (f.layers as Form[]).map(layerOf), age: f.age as number,
});

// ------------------------------------------------------------------ public

/** The spec as a code would hold it: clamped and snapped to the code's grids, text cut to its budget. */
export function quantiseMaterial(m: MaterialSpec): MaterialSpec {
  return materialOf(materialForm(m));
}

/** A material as a text code (base64url). */
export function materialCode(m: MaterialSpec): string {
  return encode(MATERIAL_SCHEMA, materialForm(m));
}

/** The material in a code, or null for anything that is not one (damaged, foreign, another version). Never throws. */
export function readMaterialCode(code: string): MaterialSpec | null {
  const f = decode(MATERIAL_SCHEMA, code);
  return f ? materialOf(f as Form) : null;
}

export const CUSTOM_PREFIX = 'matc:';

/** Shelf presets by their quantised JSON, so a spec equal to one keeps the preset's short name. */
let shelfByJson: Map<string, string> | null = null;
const shelfIndex = (): Map<string, string> => {
  if (!shelfByJson) shelfByJson = new Map(Object.entries(MATERIAL_SHELF).map(([id, m]) => [JSON.stringify(quantiseMaterial(m)), id]));
  return shelfByJson;
};

/** The name a part wears for this material: the shelf preset's `mat:<id>` when it is one, else `matc:<code>`. */
export function materialName(m: MaterialSpec): string {
  const q = quantiseMaterial(m);
  return shelfIndex().get(JSON.stringify(q)) ?? `${CUSTOM_PREFIX}${materialCode(q)}`;
}

/** The material a name stands for: a shelf preset (`mat:`), a player's own (`matc:`), or null. */
export function specOfName(name: string): MaterialSpec | null {
  if (name.startsWith(CUSTOM_PREFIX)) return readMaterialCode(name.slice(CUSTOM_PREFIX.length));
  return resolveMatPreset(name) ?? null;
}
