/**
 * ENTRY POINTS. Each implementation package must export EXACTLY these factory functions from its `src/index.ts`
 * (the acceptance tests import them by name). Extra exports are fine; renaming or changing these is not.
 */
import type { CommandBus, EventBus } from './commands';
import type { SchemaRegistry } from './schema';
import type { PresetBundle, PresetStore, StoreLimits } from './preset';
import type { Rng, Replay, Simulation, System, World } from './sim';
import type { InputFrame } from './sim';
import type { ScriptHost, ScriptLimits } from './script';
import type { Platform } from './platform';
import type { VariableSystem } from './variables';

/** `@hm/kernel` (T1) */
export interface KernelExports {
  createSchemaRegistry(): SchemaRegistry;
  createPresetStore(opts: { readonly schemas: SchemaRegistry; readonly limits?: Partial<StoreLimits>; readonly now?: () => number; readonly newId?: () => string }): PresetStore;
  createEventBus(): EventBus;
  createVariableSystem(opts: { readonly store: PresetStore; readonly schemas: SchemaRegistry; readonly events: EventBus }): VariableSystem;
  createCommandBus(opts: { readonly store: PresetStore; readonly vars: VariableSystem; readonly maxHistory?: number }): CommandBus;
  /** Upgrades a bundle saved by an older FORMAT_VERSION / schema versions to the current ones. */
  migrateBundle(bundle: PresetBundle, schemas: SchemaRegistry): PresetBundle;
  /** Stable content hash of a bundle (order-independent over presets). */
  hashBundle(bundle: PresetBundle): string;
}

/** `@hm/script` (T2) */
export interface ScriptExports {
  createScriptHost(opts?: { readonly limits?: Partial<ScriptLimits> }): ScriptHost;
}

/** `@hm/sim` (T3) */
export interface SimExports {
  createRng(seed: number): Rng;
  createWorld(opts?: { readonly seed?: number }): World;
  createSimulation(opts: { readonly seed: number; readonly events: EventBus; readonly vars: VariableSystem; readonly systems?: readonly System[] }): Simulation;
  /** Runs a replay from scratch on a fresh simulation built by `build(seed)` and returns the final world hash and where it first differed. */
  runReplay(replay: Replay, build: (seed: number) => Simulation): { readonly finalHash: string; readonly matches: boolean; readonly firstMismatchTick: number | null };
  /** Records a session: call `record(frame)` with each input frame you step with, then `finish(world)`. */
  createRecorder(seed: number, bundleHash: string, checkpointEvery?: number): { record(frame: InputFrame, world: World): void; finish(world: World): Replay };
}

/** `@hm/platform` (T9) */
export interface PlatformExports {
  /** 'stub' keeps everything in memory/localStorage-free maps (tests, dev); 'run' wraps the RUN SDK. */
  createPlatform(kind: 'stub' | 'run', opts?: {
    readonly user?: string;
    /** The RUN SDK object (`RundotGameAPI`). Injected so the 'run' adapter can be tested with a fake; omitted in the real build, where it is imported. */
    readonly sdk?: unknown;
  }): Platform;
}
