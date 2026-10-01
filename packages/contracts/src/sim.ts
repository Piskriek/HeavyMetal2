import type { PresetId, Ref, Unsubscribe, Value } from './core';
import type { VariableDef } from './schema';
import type { EventBus } from './commands';
import type { VariableSystem } from './variables';

export type EntityId = number;

/** A component is plain data. Declaring `fields` makes every field a variable (VarPath "entity:<id>/<component>.<field>"). */
export interface ComponentDef<T extends Record<string, Value> = Record<string, Value>> {
  readonly name: string;
  readonly defaults: T;
  readonly fields: readonly VariableDef[];
}

/** Seeded, fast, reproducible. The ONLY source of randomness in a simulation. Same seed = same sequence on every machine. */
export interface Rng {
  /** [0, 1) */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** A new independent stream derived from this one and a label (so adding a system does not shift others' numbers). */
  fork(label: string): Rng;
  /** Serialisable state, to snapshot and restore. */
  state(): readonly number[];
  restore(state: readonly number[]): void;
}

/** What the players are doing this tick: actor id -> action name -> value (booleans as 0/1 or true/false, axes as numbers). */
export interface InputFrame {
  readonly tick: number;
  readonly actors: Readonly<Record<string, Readonly<Record<string, number | boolean>>>>;
}

export interface StepContext {
  /** Always SIM_DT. */
  readonly dt: number;
  readonly tick: number;
  readonly rng: Rng;
  readonly events: EventBus;
  readonly vars: VariableSystem;
  readonly input: InputFrame;
}

/** Systems run in ascending `order`, ties by registration order. They may only change the world through `World`. */
export interface System {
  readonly name: string;
  readonly order: number;
  update(world: World, ctx: StepContext): void;
}

export interface WorldSnapshot {
  readonly tick: number;
  readonly nextEntity: EntityId;
  readonly entities: readonly { readonly id: EntityId; readonly preset?: Ref; readonly components: Readonly<Record<string, Readonly<Record<string, Value>>>> }[];
  readonly resources: Readonly<Record<string, Value>>;
  readonly rng: readonly number[];
}

export interface World {
  readonly tick: number;
  defineComponent<T extends Record<string, Value>>(def: ComponentDef<T>): void;
  components(): readonly ComponentDef[];
  spawn(preset?: Ref, components?: Readonly<Record<string, Readonly<Record<string, Value>>>>): EntityId;
  despawn(id: EntityId): void;
  alive(id: EntityId): boolean;
  /** The preset an entity was spawned from (the link between "what you built" and "what runs"). */
  presetOf(id: EntityId): Ref | undefined;
  add(id: EntityId, component: string, values?: Readonly<Record<string, Value>>): void;
  remove(id: EntityId, component: string): void;
  has(id: EntityId, component: string): boolean;
  get(id: EntityId, component: string): Readonly<Record<string, Value>> | undefined;
  /** Sets fields of a component the entity has. Unknown fields throw (typos must not be silent). */
  set(id: EntityId, component: string, values: Readonly<Record<string, Value>>): void;
  /** Entities that have ALL the listed components, in ascending id order (the order is part of determinism). */
  query(...components: string[]): readonly EntityId[];
  /** Singleton data (race state, the clock...). */
  getResource(name: string): Value | undefined;
  setResource(name: string, value: Value): void;
  snapshot(): WorldSnapshot;
  restore(snapshot: WorldSnapshot): void;
  /** A stable hash of the entire world state (components in id order, resources by name). Equal hash = equal state. */
  hash(): string;
  /** Changes since the last call, for render/UI sync: spawned, despawned, changed (entity, component). */
  drainChanges(): readonly WorldChange[];
  onChange(listener: (change: WorldChange) => void): Unsubscribe;
}

export type WorldChange =
  | { readonly type: 'spawn'; readonly id: EntityId }
  | { readonly type: 'despawn'; readonly id: EntityId }
  | { readonly type: 'set'; readonly id: EntityId; readonly component: string };

export interface Simulation {
  readonly world: World;
  readonly rng: Rng;
  readonly events: EventBus;
  addSystem(system: System): void;
  removeSystem(name: string): void;
  /** Advances exactly one fixed tick with `input` (default: empty). */
  step(input?: InputFrame): void;
  /** Wall-clock driver for the browser: feeds elapsed ms, runs as many fixed ticks as fit (max `maxTicksPerCall`), returns the render alpha in [0,1). */
  advance(elapsedMs: number, inputFor: (tick: number) => InputFrame, maxTicksPerCall?: number): number;
  readonly tick: number;
}

/** A race (or any session) is (preset graph, seed, input stream). Replaying it must give the same `finalHash`. */
export interface Replay {
  readonly seed: number;
  /** `PresetBundle` content hash the session ran on. */
  readonly bundleHash: string;
  readonly ticks: number;
  readonly inputs: readonly InputFrame[];
  readonly finalHash: string;
  /** Optional checkpoints (tick, world hash) every N ticks to find where a desync starts. */
  readonly checkpoints?: readonly { readonly tick: number; readonly hash: string }[];
}

export type { PresetId };
