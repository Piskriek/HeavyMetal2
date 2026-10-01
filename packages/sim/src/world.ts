import type { ComponentDef, EntityId, Ref, Rng, Unsubscribe, Value, World, WorldChange, WorldSnapshot } from '@hm/contracts';
import { Hasher, assertNoNaN, cloneValue } from './hash';
import { createRng } from './rng';

type Record_ = Record<string, Value>;

interface Store {
  readonly def: ComponentDef;
  /** Entity id -> its values. */
  readonly data: Map<EntityId, Record_>;
  /** Ids that have this component, ascending (so queries are ordered without sorting). */
  readonly ids: EntityId[];
}

/** Binary search for the first index whose id is >= `id`. */
function lowerBound(ids: readonly number[], id: number): number {
  let lo = 0;
  let hi = ids.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((ids[mid] as number) < id) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** The world is also where the simulation's rng lives: one place to snapshot, restore and hash. */
export interface WorldInternals extends World {
  readonly rng: Rng;
  /** Called by the simulation after each tick. */
  advanceTick(): void;
}

export function createWorld(opts?: { readonly seed?: number }): WorldInternals {
  const stores = new Map<string, Store>();
  const presets = new Map<EntityId, Ref>();
  const aliveIds: EntityId[] = [];
  const alive = new Set<EntityId>();
  const resources = new Map<string, Value>();
  const rng = createRng(opts?.seed ?? 0);
  const listeners = new Set<(c: WorldChange) => void>();
  let pending: WorldChange[] = [];
  const dirty = new Map<string, Set<EntityId>>();
  let nextEntity: EntityId = 1;
  let tick = 0;

  const emit = (c: WorldChange): void => {
    pending.push(c);
    for (const l of listeners) l(c);
  };
  const store = (name: string): Store => {
    const s = stores.get(name);
    if (!s) throw new Error(`world: unknown component "${name}" (define it with defineComponent first)`);
    return s;
  };
  const mustBeAlive = (id: EntityId): void => {
    if (!alive.has(id)) throw new Error(`world: entity ${id} is not alive`);
  };
  const markSet = (id: EntityId, component: string): void => {
    let d = dirty.get(component);
    if (!d) { d = new Set(); dirty.set(component, d); }
    if (d.has(id)) return;
    d.add(id);
    emit({ type: 'set', id, component });
  };
  const checked = (s: Store, values: Readonly<Record<string, Value>>): Record_ => {
    const out: Record_ = {};
    for (const [k, v] of Object.entries(values)) {
      if (!(k in s.def.defaults)) throw new Error(`world: component "${s.def.name}" has no field "${k}"`);
      assertNoNaN(v, `${s.def.name}.${k}`);
      out[k] = cloneValue(v);
    }
    return out;
  };
  const attach = (id: EntityId, s: Store, values: Readonly<Record<string, Value>>): void => {
    s.data.set(id, { ...cloneValue(s.def.defaults as Record_), ...checked(s, values) });
    const at = lowerBound(s.ids, id);
    if (s.ids[at] !== id) s.ids.splice(at, 0, id);
  };

  const world: WorldInternals = {
    rng,
    get tick() { return tick; },
    advanceTick() { tick++; },
    defineComponent(def) {
      if (stores.has(def.name)) throw new Error(`world: component "${def.name}" is already defined`);
      stores.set(def.name, { def: def as ComponentDef, data: new Map(), ids: [] });
    },
    components: () => [...stores.values()].map((s) => s.def),
    spawn(preset, components) {
      const id = nextEntity++;
      alive.add(id);
      aliveIds.push(id);
      if (preset) presets.set(id, preset);
      for (const [name, values] of Object.entries(components ?? {})) attach(id, store(name), values);
      emit({ type: 'spawn', id });
      return id;
    },
    despawn(id) {
      mustBeAlive(id);
      for (const s of stores.values()) {
        if (s.data.delete(id)) s.ids.splice(lowerBound(s.ids, id), 1);
      }
      alive.delete(id);
      aliveIds.splice(lowerBound(aliveIds, id), 1);
      presets.delete(id);
      emit({ type: 'despawn', id });
    },
    alive: (id) => alive.has(id),
    presetOf: (id) => presets.get(id),
    add(id, component, values) {
      mustBeAlive(id);
      const s = store(component);
      if (s.data.has(id)) { world.set(id, component, values ?? {}); return; }
      attach(id, s, values ?? {});
      markSet(id, component);
    },
    remove(id, component) {
      mustBeAlive(id);
      const s = store(component);
      if (s.data.delete(id)) s.ids.splice(lowerBound(s.ids, id), 1);
    },
    has: (id, component) => stores.get(component)?.data.has(id) ?? false,
    get: (id, component) => stores.get(component)?.data.get(id),
    set(id, component, values) {
      mustBeAlive(id);
      const s = store(component);
      const rec = s.data.get(id);
      if (!rec) throw new Error(`world: entity ${id} has no "${component}" component`);
      Object.assign(rec, checked(s, values));
      markSet(id, component);
    },
    query(...names) {
      if (names.length === 0) return aliveIds.slice();
      const parts = names.map(store);
      let smallest = parts[0] as Store;
      for (const p of parts) if (p.ids.length < smallest.ids.length) smallest = p;
      if (parts.length === 1) return smallest.ids.slice();
      return smallest.ids.filter((id) => parts.every((p) => p.data.has(id)));
    },
    getResource: (name) => resources.get(name),
    setResource(name, value) {
      assertNoNaN(value, `resource ${name}`);
      resources.set(name, cloneValue(value));
    },
    snapshot(): WorldSnapshot {
      return {
        tick,
        nextEntity,
        entities: aliveIds.map((id) => {
          const components: Record<string, Record_> = {};
          for (const [name, s] of stores) {
            const rec = s.data.get(id);
            if (rec) components[name] = cloneValue(rec);
          }
          const preset = presets.get(id);
          return preset ? { id, preset, components } : { id, components };
        }),
        resources: Object.fromEntries([...resources].map(([k, v]) => [k, cloneValue(v)])),
        rng: rng.state(),
      };
    },
    restore(snap) {
      for (const s of stores.values()) { s.data.clear(); s.ids.length = 0; }
      alive.clear(); aliveIds.length = 0; presets.clear(); resources.clear(); dirty.clear(); pending = [];
      tick = snap.tick;
      nextEntity = snap.nextEntity;
      for (const e of snap.entities) {
        alive.add(e.id);
        aliveIds.push(e.id);
        if (e.preset) presets.set(e.id, e.preset);
        for (const [name, values] of Object.entries(e.components)) attach(e.id, store(name), values);
      }
      for (const [k, v] of Object.entries(snap.resources)) resources.set(k, cloneValue(v));
      rng.restore(snap.rng);
    },
    hash() {
      const h = new Hasher();
      h.num(tick);
      h.num(nextEntity);
      for (const x of rng.state()) h.num(x);
      for (const name of [...stores.keys()].sort()) {
        const s = stores.get(name) as Store;
        h.str(name);
        const fields = Object.keys(s.def.defaults).sort();
        for (const id of s.ids) {
          h.num(id);
          const rec = s.data.get(id) as Record_;
          for (const f of fields) h.value(rec[f]);
        }
      }
      for (const id of aliveIds) {
        h.num(id);
        const p = presets.get(id);
        if (p) { h.str(p.ref); h.num(p.rev ?? 0); }
      }
      for (const k of [...resources.keys()].sort()) { h.str(k); h.value(resources.get(k)); }
      return h.hex();
    },
    drainChanges() {
      const out = pending;
      pending = [];
      dirty.clear();
      return out;
    },
    onChange(listener): Unsubscribe {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  return world;
}
