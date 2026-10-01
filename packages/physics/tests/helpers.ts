import type { ComponentDef, EntityId, Value } from '@hm/contracts';
import type { PhysWorld } from '../src/physics';

export type TestWorld = PhysWorld & { readonly tick: number; spawn(): EntityId; remove(id: EntityId, component: string): void };

export function fakeWorld(): TestWorld {
  const defs = new Map<string, ComponentDef>();
  const ents = new Map<EntityId, Map<string, Record<string, Value>>>();
  let next = 1;
  const need = (c: string): ComponentDef => { const d = defs.get(c); if (!d) throw new Error(`unknown component ${c}`); return d; };
  return {
    tick: 0,
    defineComponent(def: ComponentDef) { defs.set(def.name, def); },
    components: () => [...defs.values()],
    alive: (id: EntityId) => ents.has(id),
    has: (id: EntityId, c: string) => ents.get(id)?.has(c) ?? false,
    get: (id: EntityId, c: string) => ents.get(id)?.get(c),
    set(id: EntityId, c: string, v: Readonly<Record<string, Value>>) {
      const m = ents.get(id); const cur = m?.get(c);
      if (!m || !cur) throw new Error(`no ${c} on ${id}`);
      m.set(c, { ...cur, ...v });
    },
    add(id: EntityId, c: string, v?: Readonly<Record<string, Value>>) {
      const m = ents.get(id); if (!m) throw new Error(`entity ${id} is not alive`);
      m.set(c, { ...need(c).defaults, ...(v ?? {}) });
    },
    query: (...cs: string[]) => [...ents.keys()].filter((id) => cs.every((c) => ents.get(id)?.has(c))).sort((a, b) => a - b),
    remove(id: EntityId, c: string) { ents.get(id)?.delete(c); },
    spawn() { const id = next++; ents.set(id, new Map()); return id; },
  };
}

/** The 'transform' component as the render package defines it (physics only needs these fields to exist). */
export const transformDef: ComponentDef = {
  name: 'transform',
  defaults: { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1, sx: 1, sy: 1, sz: 1 },
  fields: [],
};