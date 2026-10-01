import test from 'node:test';
import assert from 'node:assert/strict';
import type { ComponentDef, EntityId, Value, WorldChange } from '@hm/contracts';
import { defineRenderComponents, createSceneSync, type RenderDesc, type SceneAdapter, type RenderWorld } from '../src/scene-sync';

/** A tiny in-memory World, just enough for the sync. */
function fakeWorld(): RenderWorld & { spawn(c: Record<string, Record<string, Value>>): EntityId; despawn(id: EntityId): void; setC(id: EntityId, c: string, v: Record<string, Value>): void; removeC(id: EntityId, c: string): void } {
  const defs = new Map<string, ComponentDef>();
  const ents = new Map<EntityId, Map<string, Record<string, Value>>>();
  let pending: WorldChange[] = [];
  let next = 1;
  const w = {
    tick: 0,
    defineComponent(def: ComponentDef) { defs.set(def.name, def); },
    components: () => [...defs.values()],
    alive: (id: EntityId) => ents.has(id),
    has: (id: EntityId, c: string) => ents.get(id)?.has(c) ?? false,
    get: (id: EntityId, c: string) => ents.get(id)?.get(c),
    query: (...cs: string[]) => [...ents.keys()].filter((id) => cs.every((c) => ents.get(id)?.has(c))).sort((a, b) => a - b),
    drainChanges: () => { const p = pending; pending = []; return p; },
    spawn(c: Record<string, Record<string, Value>>) {
      const id = next++; const m = new Map<string, Record<string, Value>>();
      for (const [k, v] of Object.entries(c)) m.set(k, { ...(defs.get(k)?.defaults ?? {}), ...v });
      ents.set(id, m); pending.push({ type: 'spawn', id }); return id;
    },
    despawn(id: EntityId) { ents.delete(id); pending.push({ type: 'despawn', id }); },
    setC(id: EntityId, c: string, v: Record<string, Value>) { const m = ents.get(id)!; m.set(c, { ...(m.get(c) ?? defs.get(c)?.defaults ?? {}), ...v }); pending.push({ type: 'set', id, component: c }); },
    removeC(id: EntityId, c: string) { ents.get(id)!.delete(c); },
  };
  return w;
}

function fakeAdapter() {
  const log: string[] = [];
  const last = new Map<EntityId, RenderDesc>();
  const a: SceneAdapter = {
    create(id, d) { log.push(`create ${id}`); last.set(id, d); },
    update(id, d) { log.push(`update ${id}`); last.set(id, d); },
    remove(id) { log.push(`remove ${id}`); last.delete(id); },
  };
  return { a, log, last };
}

const red = { renderable: { shape: 'sphere', size: 0.5, color: '#ff0000' } };

test('defineRenderComponents registers transform and renderable with defaults and field defs', () => {
  const w = fakeWorld(); defineRenderComponents(w);
  const t = w.components().find((c) => c.name === 'transform');
  const r = w.components().find((c) => c.name === 'renderable');
  assert.ok(t && r);
  assert.deepEqual([t.defaults.x, t.defaults.qw, t.defaults.sx], [0, 1, 1]);
  assert.equal(r.defaults.shape, 'box'); assert.equal(r.defaults.visible, true); assert.equal(r.defaults.color, '#ffffff');
  assert.ok(t.fields.length === Object.keys(t.defaults).length && r.fields.length === Object.keys(r.defaults).length);
  for (const f of [...t.fields, ...r.fields]) assert.ok(f.label && f.doc && f.key in { ...t.defaults, ...r.defaults });
});

test('step creates a node for entities that already exist, with the right desc', () => {
  const w = fakeWorld(); defineRenderComponents(w);
  const e = w.spawn({ transform: { x: 1, y: 2, z: 3 }, ...red });
  w.spawn({ transform: { x: 9 } }); // not renderable
  const { a, log, last } = fakeAdapter();
  const sync = createSceneSync(w, a);
  sync.step();
  assert.deepEqual(log, [`create ${e}`]);
  const d = last.get(e)!;
  assert.deepEqual(d.position, [1, 2, 3]); assert.deepEqual(d.rotation, [0, 0, 0, 1]); assert.deepEqual(d.scale, [1, 1, 1]);
  assert.equal(d.shape, 'sphere'); assert.equal(d.size, 0.5); assert.equal(d.color, '#ff0000'); assert.equal(d.visible, true);
  sync.step();
  assert.deepEqual(log, [`create ${e}`], 'a second step with no changes does nothing');
});

test('spawn, change, despawn, and component removal are all reflected', () => {
  const w = fakeWorld(); defineRenderComponents(w);
  const { a, log, last } = fakeAdapter();
  const sync = createSceneSync(w, a);
  const e = w.spawn({ transform: {}, ...red });
  sync.step();
  w.setC(e, 'transform', { x: 4 });
  sync.step(); sync.present(1);
  assert.deepEqual(last.get(e)!.position, [4, 0, 0]);
  w.setC(e, 'renderable', { color: '#00ff00' });
  sync.step(); sync.present(1);
  assert.equal(last.get(e)!.color, '#00ff00');
  w.removeC(e, 'renderable');
  sync.step();
  assert.ok(!last.has(e)); assert.equal(log[log.length - 1], `remove ${e}`);
  const f = w.spawn({ transform: {}, ...red });
  sync.step(); assert.ok(last.has(f));
  w.despawn(f); sync.step(); assert.ok(!last.has(f));
  const g = w.spawn({ transform: {}, ...red }); w.despawn(g); // spawned and gone within one drain
  sync.step(); assert.ok(!last.has(g));
});

test('present(alpha) interpolates the position between the last two steps and slerps rotation', () => {
  const w = fakeWorld(); defineRenderComponents(w);
  const e = w.spawn({ transform: { x: 0 }, ...red });
  const { a, last } = fakeAdapter();
  const sync = createSceneSync(w, a);
  sync.step();
  w.setC(e, 'transform', { x: 10, qy: 1, qw: 0 });
  sync.step();
  sync.present(0.5);
  const d = last.get(e)!;
  assert.ok(Math.abs(d.position[0] - 5) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...d.rotation) - 1) < 1e-9, 'rotation stays normalised');
  assert.ok(d.rotation[1] > 0.5 && d.rotation[3] > 0.5);
  sync.present(1);
  assert.ok(Math.abs(last.get(e)!.position[0] - 10) < 1e-9);
});

test('present only calls update when something changed', () => {
  const w = fakeWorld(); defineRenderComponents(w);
  w.spawn({ transform: {}, ...red });
  const { a, log } = fakeAdapter();
  const sync = createSceneSync(w, a);
  sync.step(); sync.present(1);
  const n = log.length;
  sync.step(); sync.present(1); sync.present(0.3);
  assert.equal(log.length, n);
});

test('dispose removes every node', () => {
  const w = fakeWorld(); defineRenderComponents(w);
  const e = w.spawn({ transform: {}, ...red });
  const { a, last } = fakeAdapter();
  const sync = createSceneSync(w, a);
  sync.step(); assert.ok(last.has(e));
  sync.dispose(); assert.equal(last.size, 0);
});