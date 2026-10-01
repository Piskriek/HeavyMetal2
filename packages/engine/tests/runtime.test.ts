import test from 'node:test';
import assert from 'node:assert/strict';
import { cmd } from '@hm/contracts';
import { createRuntime } from '../src/runtime';

/** Run `seconds` of wall-clock at 60 fps. */
function runFor(rt: ReturnType<typeof createRuntime>, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) rt.frame(1000 / 60);
}

function demo() {
  const rt = createRuntime({ seed: 5 });
  const ground = rt.store.put({ kind: 'entity', name: 'Ground', params: { shape: 'box', size: 20, scaleY: 0.05, y: -1, body: 'static', color: '#556070' } });
  const ball = rt.store.put({ kind: 'entity', name: 'Ball', params: { shape: 'sphere', size: 0.5, y: 3, body: 'dynamic', restitution: 0.2, color: '#ff4422' } });
  const deco = rt.store.put({ kind: 'entity', name: 'Post', params: { shape: 'cylinder', size: 0.3, x: 4, color: '#ffffff' } });
  const scene = rt.store.put({ kind: 'scene', name: 'Arena', params: { gravity: 9.81 }, children: { entities: [{ ref: ground.id }, { ref: ball.id }, { ref: deco.id }] } });
  rt.loadScene(scene.id);
  return { rt, ground, ball, deco, scene };
}

test('loadScene spawns world entities for every object preset, with renderable and transform', () => {
  const { rt, ball, deco } = demo();
  assert.equal(rt.world.query('transform', 'renderable').length, 3);
  const e = rt.binder.entityOf(ball.id)!;
  assert.equal(rt.binder.presetOf(e), ball.id);
  assert.equal(rt.world.get(e, 'renderable')!['color'], '#ff4422');
  assert.ok(rt.world.has(e, 'velocity') && rt.world.has(e, 'body'), 'dynamic gets physics components');
  assert.ok(!rt.world.has(rt.binder.entityOf(deco.id)!, 'body'), 'decoration has none');
});

test('edit mode does not step the simulation; play does, and the ball lands on the ground', () => {
  const { rt, ball } = demo();
  const e = rt.binder.entityOf(ball.id)!;
  rt.frame(1000);
  assert.equal(rt.world.get(e, 'transform')!['y'], 3);
  rt.play();
  runFor(rt, 2);
  const y = rt.world.get(e, 'transform')!['y'] as number;
  assert.ok(Math.abs(y - 0.5) < 0.05, `y=${y}`);
});

test('stop restores the world as it was before play', () => {
  const { rt, ball } = demo();
  const e = rt.binder.entityOf(ball.id)!;
  rt.play(); runFor(rt, 1.5); rt.stop();
  assert.equal(rt.mode, 'edit');
  assert.equal(rt.world.get(e, 'transform')!['y'], 3);
  assert.equal(rt.world.get(e, 'velocity')!['vy'], 0);
});

test('editing a preset through the command bus updates the world; undo reverts it', () => {
  const { rt, ball, deco } = demo();
  const e = rt.binder.entityOf(ball.id)!;
  const r = rt.commands.execute(cmd.setParam(`${ball.id}.color`, '#00ff00'));
  assert.ok(r.ok, r.error);
  assert.equal(rt.world.get(e, 'renderable')!['color'], '#00ff00');
  rt.commands.execute(cmd.setParam(`${deco.id}.x`, 9));
  assert.equal(rt.world.get(rt.binder.entityOf(deco.id)!, 'transform')!['x'], 9);
  assert.ok(rt.commands.undo());
  assert.equal(rt.world.get(rt.binder.entityOf(deco.id)!, 'transform')!['x'], 4);
  assert.ok(rt.commands.undo());
  assert.equal(rt.world.get(e, 'renderable')!['color'], '#ff4422');
});

test('a material preset overrides the look, and editing the material updates every user live', () => {
  const { rt, ball, deco } = demo();
  const mat = rt.store.put({ kind: 'material', name: 'Gold', params: { color: '#ffcc33', metalness: 1, roughness: 0.25 } });
  rt.commands.execute(cmd.setParam(`${ball.id}.material`, { ref: mat.id }));
  rt.commands.execute(cmd.setParam(`${deco.id}.material`, { ref: mat.id }));
  const e = rt.binder.entityOf(ball.id)!;
  assert.equal(rt.world.get(e, 'renderable')!['metalness'], 1);
  rt.commands.execute(cmd.setParam(`${mat.id}.color`, '#3366ff'));
  assert.equal(rt.world.get(e, 'renderable')!['color'], '#3366ff');
  assert.equal(rt.world.get(rt.binder.entityOf(deco.id)!, 'renderable')!['color'], '#3366ff');
});

test('adding and removing children of the scene spawns and despawns entities', () => {
  const { rt, scene } = demo();
  const extra = rt.store.put({ kind: 'entity', name: 'Extra', params: { shape: 'sphere', x: 1 } });
  const r = rt.commands.execute(cmd.addChild(scene.id, 'entities', extra.id));
  assert.ok(r.ok, r.error);
  assert.equal(rt.world.query('transform', 'renderable').length, 4);
  rt.commands.undo();
  assert.equal(rt.world.query('transform', 'renderable').length, 3);
});

test('a physical change (size of a dynamic ball) rebuilds only that entity', () => {
  const { rt, ball, ground } = demo();
  const groundEntity = rt.binder.entityOf(ground.id)!;
  rt.commands.execute(cmd.setParam(`${ball.id}.size`, 1));
  const e = rt.binder.entityOf(ball.id)!;
  assert.equal(rt.world.get(e, 'body')!['radius'], 1);
  assert.equal(rt.binder.entityOf(ground.id), groundEntity);
});

test('same seed and same scene give the same world hash after play (determinism through the whole stack)', () => {
  const run = (): string => { const { rt } = demo(); rt.play(); runFor(rt, 3); return rt.world.hash(); };
  assert.equal(run(), run());
});

test('every entity variable is addressable by path (entity:<id>/<component>.<field>)', () => {
  const { rt, ball } = demo();
  const e = rt.binder.entityOf(ball.id)!;
  assert.equal(rt.vars.read(`entity:${e}/renderable.color`), '#ff4422');
  rt.vars.write(`entity:${e}/renderable.color`, '#123456');
  assert.equal(rt.world.get(e, 'renderable')!['color'], '#123456');
});
