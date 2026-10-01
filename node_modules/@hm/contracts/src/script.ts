import type { Params, Value } from './core';
import type { Preset, ScriptSource } from './preset';
import type { Rng, World } from './sim';
import type { VariableSystem } from './variables';

export interface Diagnostic {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  /** 1-based, in the user's source (not in generated code). */
  readonly line: number;
  readonly column: number;
}

export interface CompileResult {
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
  /** JavaScript ready for the sandbox. Empty when !ok. */
  readonly js: string;
}

/**
 * Everything a script may touch. It is a CAPABILITY OBJECT: a script has no `window`, no `document`, no `fetch`, no `Date`, no
 * `Math.random`, no timers, no imports. Time is `tick`; randomness is `rng`. This is what keeps sandboxed code deterministic and safe.
 */
export interface ScriptContext {
  /** The preset this script belongs to, with its params resolved (read-only snapshot, refreshed on change). */
  readonly self: { readonly id: string; readonly params: Params };
  readonly tick: number;
  readonly dt: number;
  readonly rng: Rng;
  readonly vars: Pick<VariableSystem, 'read' | 'write' | 'evaluate'>;
  /** Read-only view of the world (query / get / has / getResource); writes go through `set` below. */
  readonly world: Pick<World, 'query' | 'get' | 'has' | 'alive' | 'getResource' | 'presetOf'>;
  /** The only way a script changes the simulation. Rejected (throws ScriptError) for entities/components the script was not granted. */
  readonly set: (entity: number, component: string, values: Readonly<Record<string, Value>>) => void;
  readonly spawn: (presetId: string, components?: Readonly<Record<string, Readonly<Record<string, Value>>>>) => number;
  readonly despawn: (entity: number) => void;
  readonly emit: (name: string, payload?: Value) => void;
  readonly log: (...parts: Value[]) => void;
}

/** The interfaces a script may implement. Each preset schema names one in `scriptInterface`. */
export interface Mechanic {
  init?(ctx: ScriptContext): void;
  update?(ctx: ScriptContext): void;
  onEvent?(ctx: ScriptContext, name: string, payload: Value): void;
}
export interface Rule {
  /** Called every tick while the rule is active; return a score/decision value the game reads. */
  evaluate?(ctx: ScriptContext): Value;
  onEvent?(ctx: ScriptContext, name: string, payload: Value): void;
}
export interface ToolScript {
  onPointer?(ctx: ScriptContext, event: { readonly type: 'down' | 'move' | 'up'; readonly x: number; readonly y: number }): void;
}
/** name -> the member names a script of that interface may export (used for validation and autocomplete). */
export const SCRIPT_INTERFACES: Readonly<Record<string, readonly string[]>> = {
  Mechanic: ['init', 'update', 'onEvent'],
  Rule: ['evaluate', 'onEvent'],
  Tool: ['onPointer'],
};

export class ScriptError extends Error {
  constructor(message: string, readonly line?: number) {
    super(message);
    this.name = 'ScriptError';
  }
}

export interface ScriptLimits {
  /** Max wall time of one call into a script. Exceeding it aborts the call, marks the script faulted and reports a diagnostic. */
  readonly callBudgetMs: number;
  /** Max operations (loop iterations / calls) counted by instrumentation, as a deterministic budget independent of machine speed. */
  readonly opBudget: number;
}

export interface LoadedScript<T = unknown> {
  readonly presetId: string;
  /** The implementation object the script exported (members per its interface). */
  readonly instance: T;
  /** True after a runtime fault; a faulted script is skipped until it is reloaded. */
  readonly faulted: boolean;
  readonly lastError?: string;
}

export interface ScriptHost {
  readonly limits: ScriptLimits;
  /** TypeScript -> JS in the browser (no server). Type errors are reported, never thrown. */
  compile(source: string): CompileResult;
  /** Compiles and instantiates a preset's script in a fresh sandbox. `iface` must be a key of SCRIPT_INTERFACES. Throws ScriptError for a compile error. */
  load<T = unknown>(preset: Preset, iface: string): LoadedScript<T>;
  /** Calls a member with a context, enforcing the limits; a throw or budget overrun faults the script and is returned, never propagated. */
  call(script: LoadedScript, member: string, ctx: ScriptContext, ...args: Value[]): { readonly ok: boolean; readonly value?: Value; readonly error?: string };
  /** Replaces the script of a loaded preset with new source, keeping its slot in the system order (live editing). */
  reload(script: LoadedScript, source: ScriptSource): LoadedScript;
  /** Autocomplete/typing text for the editor: the .d.ts of ScriptContext and the interface, as a string. */
  typings(iface: string): string;
  dispose(): void;
}
