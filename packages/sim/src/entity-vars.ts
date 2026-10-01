import type { EntityId, Value, VariableDef, VariableProvider, World } from '@hm/contracts';

/** Parses "42/body.mass" into entity 42, component "body", field "mass". */
function parse(rest: string): { id: EntityId; component: string; field: string } | null {
  const slash = rest.indexOf('/');
  const dot = rest.indexOf('.', slash + 1);
  if (slash < 1 || dot < 0) return null;
  const id = Number(rest.slice(0, slash));
  if (!Number.isInteger(id)) return null;
  return { id, component: rest.slice(slash + 1, dot), field: rest.slice(dot + 1) };
}

/** Makes every field of every live entity a variable at "entity:<id>/<component>.<field>". */
export function createEntityVariableProvider(world: World): VariableProvider {
  const defOf = (component: string, field: string): VariableDef | undefined =>
    world.components().find((c) => c.name === component)?.fields.find((f) => f.key === field);
  return {
    scheme: 'entity',
    read(rest) {
      const p = parse(rest);
      return p ? world.get(p.id, p.component)?.[p.field] : undefined;
    },
    write(rest, value) {
      const p = parse(rest);
      if (!p) throw new Error(`entity variable: bad path "entity:${rest}" (expected entity:<id>/<component>.<field>)`);
      const def = defOf(p.component, p.field);
      if (def && typeof value === 'number') {
        if (def.min !== undefined && value < def.min) throw new Error(`entity:${rest}: ${value} is below the minimum ${def.min}`);
        if (def.max !== undefined && value > def.max) throw new Error(`entity:${rest}: ${value} is above the maximum ${def.max}`);
      }
      world.set(p.id, p.component, { [p.field]: value } as Readonly<Record<string, Value>>);
    },
    describe(rest) {
      const p = parse(rest);
      return p && world.has(p.id, p.component) ? defOf(p.component, p.field) : undefined;
    },
    *all() {
      for (const c of world.components()) {
        for (const id of world.query(c.name)) for (const f of c.fields) yield `${id}/${c.name}.${f.key}`;
      }
    },
  };
}
