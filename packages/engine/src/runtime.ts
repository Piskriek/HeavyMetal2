import type { ScriptHost, CommandBus, EventBus, InputFrame, PresetId, PresetStore, SchemaRegistry, Simulation, VariableSystem, World, WorldSnapshot } from '@hm/contracts';
import { createCommandBus, createEventBus, createPresetStore, createSchemaRegistry, createVariableSystem } from '@hm/kernel';
import { createSimulation, createEntityVariableProvider } from '@hm/sim';
import { createScriptHost } from '@hm/script';
import { createPhysics, createPhysicsSystem, definePhysicsComponents, type PhysicsEngine } from '@hm/physics';
import { defineRenderComponents } from '@hm/render';
import { registerCoreSchemas } from './schemas';
import { createSceneBinder, type SceneBinder } from './scene-binder';
import { createScriptSystem, type ScriptSystem } from './script-system';
import { createModulatorSystem, type ModulatorSystem } from './modulator-system';

export type Mode = 'edit' | 'play';

export interface RuntimeOptions {
  readonly seed?: number;
  readonly now?: () => number;
  readonly newId?: () => string;
  /** Extra schemas/systems games register before the first scene is bound. */
  readonly setup?: (rt: Runtime) => void;
}

/**
 * The harness runtime: everything a shell needs in one object. No DOM, no WebGL (the renderer is attached by the shell).
 * edit mode = the sim is paused and the world mirrors the presets; play mode = the sim runs; stop restores the pre-play world.
 */
export interface Runtime {
  readonly schemas: SchemaRegistry;
  readonly store: PresetStore;
  readonly events: EventBus;
  readonly vars: VariableSystem;
  readonly commands: CommandBus;
  readonly sim: Simulation;
  readonly world: World;
  readonly physics: PhysicsEngine;
  readonly binder: SceneBinder;
  readonly scripts: ScriptSystem;
  readonly modulators: ModulatorSystem;
  readonly scriptHost: ScriptHost;
  readonly mode: Mode;
  /** Create the scene and bind it (also what a game "load" does). */
  loadScene(sceneId: PresetId): void;
  play(): void;
  stop(): void;
  /** Advance by wall-clock milliseconds; steps the sim only in play mode. Returns the render interpolation alpha (0..1). */
  frame(elapsedMs: number, input?: (tick: number) => InputFrame): number;
  onTick(listener: () => void): () => void;
}

export function createRuntime(opts: RuntimeOptions = {}): Runtime {
  const schemas = createSchemaRegistry();
  registerCoreSchemas(schemas);
  const store = createPresetStore({ schemas, ...(opts.now ? { now: opts.now } : {}), ...(opts.newId ? { newId: opts.newId } : {}) });
  const events = createEventBus();
  const vars = createVariableSystem({ store, schemas, events });
  const commands = createCommandBus({ store, vars });
  const physics = createPhysics();
  const scriptHost = createScriptHost();
  const tickListeners = new Set<() => void>();
  const sim = createSimulation({
    seed: opts.seed ?? 1, events, vars,
    systems: [createPhysicsSystem(physics), { name: 'tick-notify', order: 1000, update: () => { for (const l of tickListeners) l(); } }],
  });
  const world = sim.world;
  const scripts = createScriptSystem({ host: scriptHost, store, vars, world, events });
  sim.addSystem(scripts);
  const modulators = createModulatorSystem({ store, vars, events });
  sim.addSystem(modulators);
  defineRenderComponents(world);
  definePhysicsComponents(world);
  physics.attach(world);
  vars.registerProvider(createEntityVariableProvider(world));
  const binder = createSceneBinder({ store, world, physics });
  let mode: Mode = 'edit';
  let saved: WorldSnapshot | null = null;

  const rt: Runtime = {
    schemas, store, events, vars, commands, sim, world, physics, binder, scripts, modulators, scriptHost,
    get mode() { return mode; },
    loadScene(sceneId) {
      mode = 'edit';
      saved = null;
      binder.bind(sceneId);
      scripts.bind(sceneId);
      modulators.bind(sceneId);
      const g = store.get(sceneId)?.params['gravity'];
      physics.setGravity([0, -(typeof g === 'number' ? g : 9.81), 0]);
    },
    play() {
      if (mode === 'play') return;
      saved = world.snapshot();
      modulators.release();
      mode = 'play';
    },
    stop() {
      if (mode === 'edit') return;
      mode = 'edit';
      modulators.release();
      if (saved) world.restore(saved);
      saved = null;
      // the world is the truth for dynamic bodies, so a restore also resets them; statics are untouched
    },
    frame(elapsedMs, input) {
      if (mode !== 'play') return 1;
      return sim.advance(elapsedMs, input ?? ((tick) => ({ tick, actors: {} })));
    },
    onTick(listener) { tickListeners.add(listener); return () => { tickListeners.delete(listener); }; },
  };
  opts.setup?.(rt);
  return rt;
}
