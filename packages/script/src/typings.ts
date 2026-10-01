import { SCRIPT_INTERFACES } from '@hm/contracts';

/**
 * The ambient declarations handed to the editor AND used as `ambient.d.ts` when
 * type-checking a script. It is a *global* script (no top-level import/export),
 * so every declaration below is visible to user code without an import.
 *
 * WHY a hand-written copy of the contract instead of shipping the real .d.ts:
 * the script sandbox must only see what it is allowed to touch. Nothing about
 * the host environment (DOM, Node, timers) may leak in here, otherwise
 * `window`/`process`/`setTimeout` would type-check and only fail at runtime.
 */
const COMMON = `// Ambient API available to sandboxed scripts. No host globals exist.
type Value =
  | number
  | boolean
  | string
  | null
  | { readonly ref: string; readonly rev?: number }
  | { readonly expr: string }
  | readonly Value[]
  | { readonly [key: string]: Value };

type Params = Readonly<Record<string, Value>>;

interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  fork(label: string): Rng;
  state(): readonly number[];
  restore(state: readonly number[]): void;
}

interface ScriptVars {
  read(path: string): Value | undefined;
  write(path: string, value: Value, source?: string): void;
  evaluate(source: string, scope?: Readonly<Record<string, Value>>): Value;
}

interface ScriptWorld {
  query(...components: string[]): readonly number[];
  get(id: number, component: string): Readonly<Record<string, Value>> | undefined;
  has(id: number, component: string): boolean;
  alive(id: number): boolean;
  getResource(name: string): Value | undefined;
  presetOf(id: number): { readonly ref: string } | undefined;
}

interface ScriptContext {
  readonly self: { readonly id: string; readonly params: Params };
  readonly tick: number;
  readonly dt: number;
  readonly rng: Rng;
  readonly vars: ScriptVars;
  readonly world: ScriptWorld;
  readonly set: (entity: number, component: string, values: Readonly<Record<string, Value>>) => void;
  readonly spawn: (presetId: string, components?: Readonly<Record<string, Readonly<Record<string, Value>>>>) => number;
  readonly despawn: (entity: number) => void;
  readonly emit: (name: string, payload?: Value) => void;
  readonly log: (...parts: Value[]) => void;
}
`;

/** Signatures per interface member, kept in sync with SCRIPT_INTERFACES. */
const MEMBERS: Readonly<Record<string, string>> = {
  init: 'init?(ctx: ScriptContext): void;',
  update: 'update?(ctx: ScriptContext): void;',
  onEvent: 'onEvent?(ctx: ScriptContext, name: string, payload: Value): void;',
  evaluate: 'evaluate?(ctx: ScriptContext): Value;',
  onPointer:
    "onPointer?(ctx: ScriptContext, event: { readonly type: 'down' | 'move' | 'up'; readonly x: number; readonly y: number }): void;",
};

export function typings(iface: string): string {
  const members = SCRIPT_INTERFACES[iface] ?? [];
  const body = members.map((m) => `  ${MEMBERS[m] ?? `${m}?(ctx: ScriptContext): Value;`}`).join('\n');
  // The script module is expected to export the members of `iface` as functions.
  return `${COMMON}
interface ${iface} {
${body}
}
`;
}
