import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventBus, VariableSystem } from '@hm/contracts';
import { createRecorder, createSimulation, runReplay } from '@hm/sim';
import { defineRenderComponents } from '@hm/render';
import { createPhysics, createPhysicsSystem, definePhysicsComponents } from '../src/physics';

/** Physics on the REAL sim world: replay-verified, snapshot/restore safe. */
const events = { on: () => () => {}, once: () => () => {}, emit: () => {}, onAny: () => () => {} } as unknown as EventBus;
const vars = {} as unknown as VariableSystem;

function build(seed: number) {
  const engine = createPhysics();
  const drive = {
    name: 'drive', order: 50,
    update(_w: unknown, ctx: { tick: number }) { if (ctx.tick % 10 === 0) engine.applyForce(2, [3, 0, 1]); },
  };
  const sim = createSimulation({ seed, events, vars, systems: [drive, createPhysicsSystem(engine)] });
  defineRenderComponents(sim.world);
  definePhysicsComponents(sim.world);
  engine.attach(sim.world);
  const ground = sim.world.spawn();
  engine.addBody(ground, { kind: 'static', collider: { shape: 'heightfield', cols: 3, rows: 3, cell: 20, heights: [0, 0, 0, 0, 0, 0, 0, 0, 0] }, position: [-20, 0, -20], friction: 0.7, tier: 'racing' });
  const ball = sim.world.spawn();
  engine.addBody(ball, { kind: 'dynamic', collider: { shape: 'sphere', radius: 0.5 }, mass: 1, restitution: 0.4, position: [0, 4, 0], tier: 'racing' });
  assert.equal(ball, 2);
  return { sim, engine };
}

test('physics inside the real simulation: the ball lands, rolls and the replay verifies', () => {
  const { sim } = build(7);
  const rec = createRecorder(7, 'phys', 60);
  for (let t = 0; t < 360; t++) { const f = { tick: t, actors: {} }; sim.step(f); rec.record(f, sim.world); }
  const y = sim.world.get(2, 'transform')!['y'] as number;
  assert.ok(y > 0.4 && y < 1.5, `y=${y}`);
  assert.ok((sim.world.get(2, 'transform')!['x'] as number) > 1, 'the driving force moved it');
  const replay = rec.finish(sim.world);
  const res = runReplay(replay, (s) => build(s).sim);
  assert.equal(res.matches, true);
});

test('snapshot at tick 150, restore into a fresh simulation, continue: same hash as the straight run', () => {
  const a = build(3).sim;
  for (let t = 0; t < 150; t++) a.step();
  const snap = a.world.snapshot();
  for (let t = 150; t < 300; t++) a.step();
  const b = build(3).sim;
  b.world.restore(snap);
  for (let t = 150; t < 300; t++) b.step();
  assert.equal(b.world.hash(), a.world.hash());
});
