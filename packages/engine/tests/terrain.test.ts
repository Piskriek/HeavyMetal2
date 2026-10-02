import test from 'node:test';
import assert from 'node:assert/strict';
import { cmd } from '@hm/contracts';
import { applyBrush, encodeTerrain, generateIsland, heightAt } from '@hm/terrain';
import { createRuntime } from '../src/runtime';

const IDS = { seabed: 1, sand: 2, grass: 3, rock: 4, cliff: 5 };

function demo() {
  const rt = createRuntime({ seed: 2 });
  const terrain = generateIsland({ cols: 65, rows: 65, cell: 2, originX: -64, originZ: -64 }, 11, { surfaces: IDS });
  const ground = rt.store.put({ kind: 'terrain', name: 'Island', params: { data: encodeTerrain(terrain) as never } });
  const y0 = heightAt(terrain, 0, 0);
  const ball = rt.store.put({ kind: 'entity', name: 'Ball', params: { shape: 'sphere', size: 0.5, x: 0, y: y0 + 5, z: 0, body: 'dynamic' } });
  const scene = rt.store.put({ kind: 'scene', name: 'S', params: {}, children: { terrain: [{ ref: ground.id }], entities: [{ ref: ball.id }] } });
  const seen: (number | null)[] = [];
  rt.binder.onTerrain((s) => seen.push(s ? s.version : null));
  rt.loadScene(scene.id);
  return { rt, terrain, ground, ball, scene, y0, seen };
}

test('the scene binder decodes the terrain preset, reports it and makes it solid', () => {
  const { rt, terrain, ball, y0, seen } = demo();
  assert.ok(rt.binder.terrain());
  assert.equal(rt.binder.terrain()!.terrain.heights.length, terrain.heights.length);
  assert.deepEqual(seen, [1]);
  rt.play();
  for (let i = 0; i < 240; i++) rt.frame(1000 / 60);
  const y = rt.world.get(rt.binder.entityOf(ball.id)!, 'transform')!['y'] as number;
  assert.ok(Math.abs(y - (y0 + 0.5)) < 0.35, `ball rests on the ground: y=${y} ground=${y0}`);
});

test('editing the terrain data through a command rebuilds the collider: raise the ground under the ball', () => {
  const { rt, terrain, ground, ball, y0 } = demo();
  const edited = { ...terrain, heights: terrain.heights.slice() } as typeof terrain;
  applyBrush(edited, { kind: 'raise', x: 0, z: 0, radius: 12, strength: 3, falloff: 'flat' });
  const r = rt.commands.execute(cmd.setParam(`${ground.id}.data`, encodeTerrain(edited) as never));
  assert.ok(r.ok, r.error);
  assert.ok(rt.binder.terrain()!.version >= 2);
  rt.play();
  for (let i = 0; i < 240; i++) rt.frame(1000 / 60);
  const y = rt.world.get(rt.binder.entityOf(ball.id)!, 'transform')!['y'] as number;
  assert.ok(y > y0 + 3, `the ball now rests on the raised ground: y=${y}`);
  rt.stop();
  assert.ok(rt.commands.undo());
  assert.equal(rt.binder.terrain()!.version >= 3, true);
});

test('removing the terrain child clears the ground', () => {
  const { rt, scene, seen } = demo();
  rt.commands.execute(cmd.removeChild(scene.id, 'terrain', 0));
  assert.equal(rt.binder.terrain(), null);
  assert.equal(seen[seen.length - 1], null);
});
