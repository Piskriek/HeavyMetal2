import type { Issue, PresetId, Unsubscribe, Value } from './core';
import type { VariableDef } from './schema';

/**
 * A VarPath addresses ANY variable in the running harness:
 *   preset parameter     "<presetId>.<param key>"              e.g. "racer-ball-1.weight"
 *   entity field (sim)   "entity:<entityId>/<component>.<field>"   e.g. "entity:42/body.mass"
 *   global               "global:<name>"                       e.g. "global:gravity"
 * The "every variable is accessible" promise = everything has a VarPath, a VariableDef and can be read, written, searched, observed and bound.
 */
export type VarPath = string;

export interface CompiledExpr {
  readonly source: string;
  readonly ok: boolean;
  readonly issues: readonly Issue[];
  /** VarPaths the expression reads (written `$path` in source); used to re-evaluate when they change. */
  readonly reads: readonly VarPath[];
  evaluate(scope?: Readonly<Record<string, Value>>): Value;
}

export interface VariableHit {
  readonly path: VarPath;
  readonly def: VariableDef;
  readonly ownerLabel: string;
  readonly value: Value | undefined;
}

/**
 * Something other than the preset store that owns variables under a scheme prefix: the sim registers `entity:` so every component
 * field of every live entity is a variable; the host may register `global:`. The kernel's VariableSystem routes paths to providers.
 */
export interface VariableProvider {
  /** The path prefix this provider owns, without the colon: 'entity', 'global'. */
  readonly scheme: string;
  read(rest: string): Value | undefined;
  write(rest: string, value: Value): void;
  describe(rest: string): VariableDef | undefined;
  /** Every path it currently knows, in `rest` form (may be large: iterate lazily). */
  all(): Iterable<string>;
}

/**
 * Reading, writing, searching and binding variables. Expression language (small, safe, no loops, no property access on host objects):
 * numbers, strings, booleans, + - * / % ^, comparisons, && || !, ternary a ? b : c, `$path` reads, and the functions
 * min max clamp lerp abs floor ceil round sqrt sin cos atan2 pow sign mix(a,b,t) smoothstep vec3(x,y,z).
 */
export interface VariableSystem {
  /** The effective value (inherited, bound and expression-driven values resolved). */
  read(path: VarPath): Value | undefined;
  /** A direct write that is NOT undoable (used by the sim and by scripts). Editors use the CommandBus 'set-param' instead. */
  write(path: VarPath, value: Value, source?: string): void;
  /** Keep `target` equal to `source` (another path or an expression) until the returned function is called. Cycles are detected and refused. */
  bind(target: VarPath, source: VarPath | { readonly expr: string }): Unsubscribe;
  observe(path: VarPath, listener: (value: Value | undefined, previous: Value | undefined) => void): Unsubscribe;
  compile(source: string): CompiledExpr;
  evaluate(source: string, scope?: Readonly<Record<string, Value>>): Value;
  /** Metadata for the inspector: type, range, doc, tier. Undefined for a path nothing declares. */
  describe(path: VarPath): (VariableDef & { readonly owner: PresetId | string }) | undefined;
  /** Substring search over paths, labels and docs (the "find any variable" box). */
  search(query: string, limit?: number): readonly VariableHit[];
  /** Every declared path (presets and everything the providers know). */
  all(): Iterable<VarPath>;
  /** Hands a scheme (entity:, global:) to a provider. Registering the same scheme twice replaces it. */
  registerProvider(provider: VariableProvider): Unsubscribe;
}
