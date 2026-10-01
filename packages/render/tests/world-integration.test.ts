import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '@hm/sim';
import { createSceneSync, defineRenderComponents, type RenderDesc, type SceneAdapter } from '../src/scene-sync';

test('scene sync works on the real sim World (spawn, set, remove component, despawn)', () => {
  const world = createWorld({ seed: 1 });
  defineRenderComponents(world);
  const last = new Map<number, RenderDesc>();
  const adapter: SceneAdapter = {
    create: (id, d) => { last.set(id, d); },
    update: (id, d) => { last.set(id, d); },
    remove: (id) => { last.delete(id); },
  };
  const sync = createSceneSync(world, adapter);
  const e = world.spawn(undefined, { transform: { x: 2 }, renderable: { shape: 'sphere', color: '#336699' } });
  sync.step();
  assert.equal(last.get(e)?.position[0], 2);
  world.set(e, 'transform', { x: 6 });
  sync.step(); sync.present(1);
  assert.equal(last.get(e)?.position[0], 6);
  assert.equal(sync.items().length, 1);
  world.set(e, 'renderable', { visible: false });
  sync.step();
  assert.equal(sync.items().length, 0);
  world.remove(e, 'renderable');
  sync.step();
  assert.ok(!last.has(e));
  const f = world.spawn(undefined, { transform: {}, renderable: {} });
  sync.step(); assert.ok(last.has(f));
  world.despawn(f);
  sync.step(); assert.ok(!last.has(f));
});
