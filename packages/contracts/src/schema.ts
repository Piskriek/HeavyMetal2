import type { PresetKind, Tier, Value } from './core';

export type ValueType =
  | 'number' | 'int' | 'boolean' | 'string' | 'enum' | 'color'
  | 'vec2' | 'vec3' | 'quat'
  | 'ref'      // a pointer to a preset (of `refKinds`)
  | 'list'     // a list of `itemType`
  | 'curve'    // [[t, v], ...] sorted by t
  | 'asset'    // a file name in the asset library (texture, sound, mesh)
  | 'expr';    // free expression

/**
 * One variable of a preset kind. EVERY tunable thing is declared this way: the inspector, the search box, bindings,
 * the code panel's autocomplete and the docs are all generated from these definitions. Nothing is a magic number.
 */
export interface VariableDef {
  /** Key inside `Preset.params` (dotted keys are fine: "wheel.grip"). */
  readonly key: string;
  readonly type: ValueType;
  readonly label: string;
  /** One sentence a 10-year-old can read. Shown as the tooltip and in the Play tier. */
  readonly doc: string;
  /** The simplest UI tier that shows it. Most variables are 'pro'; the few that matter to a child are 'play'. */
  readonly tier: Tier;
  readonly default: Value;
  /**
   * The comfortable range: where a slider starts and ends. NOT a hard limit: the slider grows when pushed past its end and a typed number is
   * always accepted. What a value may never be is `hardMin` / `hardMax` (see `hardLimits`).
   */
  readonly min?: number;
  readonly max?: number;
  /** Values below / above this make no sense (an opacity above 1, a size below 0) and are refused. Left out, `hardLimits` infers them. */
  readonly hardMin?: number;
  readonly hardMax?: number;
  readonly step?: number;
  readonly unit?: string;
  /** For 'enum'. */
  readonly options?: readonly string[];
  /** For 'ref': which kinds may be chosen. */
  readonly refKinds?: readonly PresetKind[];
  /** For 'list'. */
  readonly itemType?: ValueType;
  /** Inspector grouping ("Handling", "Looks"). */
  readonly group?: string;
  /** False for values that must stay constants (rare). Default true: anything can be bound or driven by an expression. */
  readonly bindable?: boolean;
}

/** A named place where a preset holds other presets (a game holds modes; a racer holds a body and mechanics). */
export interface ChildSlot {
  readonly key: string;
  readonly label: string;
  readonly doc: string;
  readonly kinds: readonly PresetKind[];
  readonly min: number;
  /** Infinity is written as null in JSON. */
  readonly max: number | null;
  readonly tier: Tier;
}

/** Everything the harness needs to know about a kind of preset. */
export interface PresetSchema {
  readonly kind: PresetKind;
  /** Bump when `variables` change shape; a migration then upgrades saved presets. */
  readonly version: number;
  readonly label: string;
  readonly doc: string;
  readonly icon?: string;
  readonly variables: readonly VariableDef[];
  readonly slots: readonly ChildSlot[];
  /**
   * If set, a preset of this kind may carry a script that implements this named interface
   * (see `ScriptInterfaces` in script.ts), e.g. 'Mechanic'.
   */
  readonly scriptInterface?: string;
}

export interface SchemaRegistry {
  register(schema: PresetSchema): void;
  get(kind: PresetKind): PresetSchema | undefined;
  kinds(): readonly PresetKind[];
  /** Variables of a kind that a UI at `tier` should show, in declaration order. */
  variablesFor(kind: PresetKind, tier: Tier): readonly VariableDef[];
  /** Upgrades the params of a preset saved at `fromVersion` to the current schema. Registered per kind. */
  registerMigration(kind: PresetKind, fromVersion: number, migrate: (params: Readonly<Record<string, Value>>) => Readonly<Record<string, Value>>): void;
}

/** Identity helper so a schema literal is type-checked at its definition site. */
export const defineSchema = <S extends PresetSchema>(schema: S): S => schema;

/**
 * The limits a number can never pass. Explicit `hardMin` / `hardMax` win. Otherwise: a comfortable range that starts at zero or above is a size,
 * a count or a strength, so it cannot go below its own start; a 0..1 range is a fraction, so it cannot go above 1. Everything else is open,
 * so a slider never stops anybody short of what they want.
 */
export function hardLimits(def: Pick<VariableDef, 'min' | 'max' | 'hardMin' | 'hardMax'>): { readonly lo: number; readonly hi: number } {
  const lo = def.hardMin ?? (def.min !== undefined && def.min >= 0 ? def.min : -Infinity);
  const hi = def.hardMax ?? (def.min === 0 && def.max === 1 ? 1 : Infinity);
  return { lo, hi };
}
