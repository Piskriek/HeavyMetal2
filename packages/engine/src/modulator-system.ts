import type { EventBus, Preset, PresetId, PresetStore, StepContext, System, Value, VariableSystem, World } from '@hm/contracts';
import { SIM_HZ } from '@hm/contracts';
import { createModulator, validateModulator, type Modulator, type ModulatorDef } from '@hm/modulation';

/**
 * Drives variables from modulator presets (randomizers, LFOs, curves, timelines, sequences, data streams, textures, expressions).
 * A modulator preset names a TARGET variable path and a definition; every tick the system samples it and writes the target.
 * Time comes from the tick counter, so a replay drives exactly the same values. Stopping the game puts the targets back.
 * Writes to world components (entity:...) happen every tick; writes to presets (which record a revision) are throttled.
 */

export interface ModulatorSystem extends System {
  bind(sceneId: PresetId): void;
  unbind(): void;
  /** Forget start times and put every driven target back to the value it had (called on play and stop). */
  release(): void;
  status(): readonly { readonly id: PresetId; readonly target: string; readonly value: number | null; readonly error?: string }[];
}

const SLOT = 'modulators';
const PRESET_WRITE_EVERY = 6;   // ticks (20 Hz at 120 Hz sim)

type Mode = 'replace' | 'add' | 'scale';

interface Live {
  hash: string;
  target: string;
  mod: Modulator | null;
  mode: Mode;
  amount: number;
  enabled: boolean;
  startTick: number | null;
  base: number | null;
  last: number | null;
  written: number | null;
  error?: string;
}

const toNumber = (v: Value | undefined): number | undefined =>
  typeof v === 'number' ? (Number.isFinite(v) ? v : undefined) : typeof v === 'boolean' ? (v ? 1 : 0) : undefined;

export function createModulatorSystem(opts: { readonly store: PresetStore; readonly vars: VariableSystem; readonly events: EventBus }): ModulatorSystem {
  const { store, vars, events } = opts;
  const live = new Map<PresetId, Live>();
  let order: PresetId[] = [];
  let scene: PresetId | null = null;

  const fail = (id: PresetId, entry: Live, error: string): void => {
    if (entry.error === error) return;
    entry.error = error;
    (events as EventBus<Record<string, unknown>>).emit('modulator:error', { id, error });
  };

  const build = (p: Preset): Live => {
    const params = store.resolve(p.id).params;
    const entry: Live = {
      hash: p.hash,
      target: typeof params['target'] === 'string' ? params['target'] : '',
      mod: null,
      mode: (['replace', 'add', 'scale'] as const).includes(params['mode'] as Mode) ? (params['mode'] as Mode) : 'replace',
      amount: typeof params['amount'] === 'number' ? params['amount'] : 1,
      enabled: params['enabled'] !== false,
      startTick: null, base: null, last: null, written: null,
    };
    try {
      const raw = params['def'];
      const def = (typeof raw === 'string' ? JSON.parse(raw) : raw) as unknown;
      const check = validateModulator(def);
      if (!check.ok) throw new Error(check.errors.join('; '));
      entry.mod = createModulator(def as ModulatorDef, hashSeed(p.id));
    } catch (e) {
      fail(p.id, entry, String((e as Error).message ?? e));
    }
    if (!entry.target) fail(p.id, entry, 'no target variable chosen');
    return entry;
  };

  const restore = (entry: Live): void => {
    if (entry.base !== null && entry.written !== null) {
      try { vars.write(entry.target, entry.base, 'modulator:release'); } catch { /* target vanished */ }
    }
    entry.base = null; entry.written = null; entry.startTick = null; entry.last = null;
    entry.mod?.reset();
  };

  const sync = (): void => {
    if (scene === null) return;
    order = (store.get(scene)?.children[SLOT] ?? []).map((r) => r.ref);
    for (const id of order) {
      const p = store.get(id);
      if (!p) continue;
      const cur = live.get(id);
      if (!cur || cur.hash !== p.hash) {
        if (cur) restore(cur);
        live.set(id, build(p));
      }
    }
    for (const [id, entry] of [...live]) if (!order.includes(id)) { restore(entry); live.delete(id); }
  };

  const systemUpdate = (_world: World, step: StepContext): void => {
    sync();
    for (const id of order) {
      const entry = live.get(id);
      if (!entry || entry.error) continue;
      if (!entry.enabled || !entry.mod) { if (entry.written !== null) restore(entry); continue; }
      if (entry.startTick === null) {
        const base = toNumber(vars.read(entry.target));
        if (base === undefined) { fail(id, entry, `'${entry.target}' is not a number variable`); continue; }
        entry.base = base;
        entry.startTick = step.tick;
      }
      const timeMs = ((step.tick - entry.startTick) * 1000) / SIM_HZ;
      const raw = entry.mod.sample({
        timeMs, dtMs: 1000 / SIM_HZ, tick: step.tick,
        read: (path) => toNumber(vars.read(path)),
        evaluate: (source, scope) => { const r = vars.evaluate(source, scope as never); return typeof r === 'number' ? r : 0; },
      });
      entry.last = raw;
      const base = entry.base ?? 0;
      const target = entry.mode === 'add' ? base + raw : entry.mode === 'scale' ? base * raw : raw;
      const value = base + (target - base) * Math.min(1, Math.max(0, entry.amount));
      const toPreset = !entry.target.includes(':');
      if (toPreset && step.tick % PRESET_WRITE_EVERY !== 0) continue;
      if (entry.written !== null && Math.abs(entry.written - value) < 1e-6) continue;
      try { vars.write(entry.target, value, 'modulator'); entry.written = value; }
      catch (e) { fail(id, entry, String((e as Error).message ?? e)); }
    }
  };

  return {
    name: 'modulators',
    order: 40,
    update: systemUpdate,
    bind(sceneId) { this.unbind(); scene = sceneId; sync(); },
    unbind() { for (const e of live.values()) restore(e); live.clear(); order = []; scene = null; },
    release() { for (const e of live.values()) restore(e); },
    status: () => order.map((id) => {
      const e = live.get(id);
      return { id, target: e?.target ?? '', value: e?.last ?? null, ...(e?.error ? { error: e.error } : {}) };
    }),
  };
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
