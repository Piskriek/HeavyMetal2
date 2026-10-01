/**
 * CORE VOCABULARY. Everything in the harness is built from these few types.
 * Contracts are TYPES (plus a few tiny constants): no package may put logic here.
 */

/** Identifies a preset. Stable across revisions; forks get a new id. */
export type PresetId = string;

/** Which depth of the UI shows a thing. play = a 6-year-old, build = a maker, pro = every variable and the source. */
export type Tier = 'play' | 'build' | 'pro';
export const TIERS: readonly Tier[] = ['play', 'build', 'pro'] as const;
export const tierRank = (t: Tier): number => (t === 'play' ? 0 : t === 'build' ? 1 : 2);
/** A thing at tier `t` is visible in a UI shown at tier `shown` when it is at most as deep. */
export const visibleAt = (t: Tier, shown: Tier): boolean => tierRank(t) <= tierRank(shown);

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
/** Quaternion x, y, z, w. */
export type Quat = readonly [number, number, number, number];
/** '#rrggbb' or '#rrggbbaa'. */
export type Color = string;

/** A pointer to a preset. `rev` pins a revision; absent means "the latest". */
export interface Ref {
  readonly ref: PresetId;
  readonly rev?: number;
}

/** A live expression, e.g. `"clamp($rider.weight * 2 + 1, 0, 10)"`. See `VariableSystem.compile`. */
export interface Expr {
  readonly expr: string;
}

/** Everything a variable can hold (JSON-serialisable on purpose: presets are shared as JSON). */
export type Value =
  | number
  | boolean
  | string
  | null
  | Ref
  | Expr
  | readonly Value[]
  | { readonly [key: string]: Value };

export type Params = Readonly<Record<string, Value>>;

export type Unsubscribe = () => void;

export interface Issue {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  /** The preset (and parameter, if any) the issue is about. */
  readonly presetId?: PresetId;
  readonly path?: string;
}

/** The kinds that exist from day one. Packs may register more: a kind is just a string with a schema. */
export const CORE_KINDS = [
  'game', 'mode', 'scene', 'entity', 'shape', 'material', 'mechanic', 'rule', 'item', 'racer', 'track-piece',
  'camera', 'input-map', 'ui-skin', 'hud', 'tool', 'manipulation', 'brush', 'ai-driver', 'audio-cue', 'physics-model',
] as const;
export type CoreKind = (typeof CORE_KINDS)[number];
/** Open on purpose: a pack adds `racer`-like kinds without touching contracts. */
export type PresetKind = CoreKind | (string & {});

/** The harness's own version of the preset file format and of the script API. Bump with a migration. */
export const FORMAT_VERSION = 1;
export const SCRIPT_API_VERSION = 1;
/** The sim step: all gameplay runs at this fixed rate. */
export const SIM_HZ = 120;
export const SIM_DT = 1 / SIM_HZ;
