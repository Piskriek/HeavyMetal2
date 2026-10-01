import type { EventBus, LoadedScript, Preset, PresetId, PresetStore, Rng, ScriptContext, ScriptHost, StepContext, System, Value, VariableSystem, World } from '@hm/contracts';

/**
 * Runs the scene's mechanic presets (TypeScript in a QuickJS sandbox) once per simulation tick, in slot order.
 * Mechanics are how a game is made "inside" the harness: rules, items, AI and car control are presets with a script.
 * A script that throws or runs out of budget is switched off (faulted) and reported on the event bus; the sim goes on.
 * Editing a mechanic's script (Pro tier) reloads just that script on the next tick, keeping its state out of the world
 * (scripts keep no hidden state across reloads: everything lives in world components, resources or variables).
 */

export interface ScriptSystem extends System {
  /** Load the mechanics listed in the scene's `mechanics` slot (replaces any previous set). */
  bind(sceneId: PresetId): void;
  unbind(): void;
  /** Mechanic preset ids currently running, with their fault state (for the editor's script panel). */
  status(): readonly { readonly id: PresetId; readonly faulted: boolean; readonly lastError?: string }[];
  dispose(): void;
}

interface Loaded { readonly preset: Preset; script: LoadedScript | null; hash: string; inited: boolean; error?: string }

const SLOT = 'mechanics';

export function createScriptSystem(opts: {
  readonly host: ScriptHost;
  readonly store: PresetStore;
  readonly vars: VariableSystem;
  readonly world: World;
  readonly events: EventBus;
}): ScriptSystem {
  const { host, store, vars, world, events } = opts;
  const running = new Map<PresetId, Loaded>();
  let order: PresetId[] = [];
  let scene: PresetId | null = null;
  let unsub: (() => void) | null = null;

  const report = (id: PresetId, error: string): void => {
    (events as EventBus<Record<string, unknown>>).emit('script:error', { id, error });
  };

  const load = (id: PresetId): Loaded | null => {
    const preset = store.get(id);
    if (!preset) return null;
    const entry: Loaded = { preset, script: null, hash: preset.hash, inited: false };
    if (!preset.script) { entry.error = 'this mechanic has no script yet'; return entry; }
    try {
      entry.script = host.load(preset, 'Mechanic');
    } catch (e) {
      entry.error = String((e as Error).message ?? e);
      report(id, entry.error);
    }
    return entry;
  };

  const sync = (): void => {
    if (scene === null) return;
    const refs = store.get(scene)?.children[SLOT] ?? [];
    order = refs.map((r) => r.ref);
    for (const id of order) {
      const cur = running.get(id);
      const latest = store.get(id);
      if (!latest) continue;
      if (!cur || cur.hash !== latest.hash) {
        const next = load(id);
        if (next) running.set(id, next);
      }
    }
    for (const id of [...running.keys()]) if (!order.includes(id)) running.delete(id);
  };

  const ctxFor = (entry: Loaded, step: StepContext, rng: Rng): ScriptContext => ({
    self: { id: entry.preset.id, params: store.resolve(entry.preset.id).params },
    tick: step.tick,
    dt: step.dt,
    input: step.input.actors,
    rng,
    vars,
    world,
    set: (entity, component, values) => { if (world.alive(entity)) world.set(entity, component, values); },
    spawn: (presetId, components) => world.spawn({ ref: presetId }, components),
    despawn: (entity) => { if (world.alive(entity)) world.despawn(entity); },
    emit: (name, payload) => { (events as EventBus<Record<string, unknown>>).emit(name, payload ?? null); },
    log: (...parts: Value[]) => { (events as EventBus<Record<string, unknown>>).emit('script:log', parts); },
  });

  const call = (entry: Loaded, member: string, step: StepContext): void => {
    if (!entry.script || entry.script.faulted) return;
    const r = host.call(entry.script, member, ctxFor(entry, step, step.rng));
    if (!r.ok) { entry.error = r.error ?? 'script failed'; report(entry.preset.id, entry.error); }
  };

  return {
    name: 'scripts',
    order: 50,
    update(_world, step) {
      sync();
      for (const id of order) {
        const entry = running.get(id);
        if (!entry || entry.error) continue;
        if (!entry.inited) { entry.inited = true; call(entry, 'init', step); }
        call(entry, 'update', step);
      }
    },
    bind(sceneId) {
      this.unbind();
      scene = sceneId;
      unsub = store.subscribe(() => { /* picked up on the next tick: edits never run mid-tick */ });
      sync();
    },
    unbind() {
      unsub?.(); unsub = null;
      running.clear(); order = []; scene = null;
    },
    status: () => order.map((id) => {
      const e = running.get(id);
      return { id, faulted: !!e?.script?.faulted || !!e?.error, ...(e?.error ?? e?.script?.lastError ? { lastError: e?.error ?? e?.script?.lastError } : {}) };
    }),
    dispose() { this.unbind(); },
  };
}
