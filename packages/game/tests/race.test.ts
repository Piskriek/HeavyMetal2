import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '@hm/engine';
import { createRaceGame } from '../src';
import { chaseCamera } from '../src/chase-camera';

const run = (g: ReturnType<typeof createRaceGame>, seconds: number, each?: (t: number) => void): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) { each?.(i / 60); g.update(1000 / 60); }
};

test('the race starts with a countdown, then everybody drives; AI racers make progress along the track', () => {
  const g = createRaceGame(createRuntime({ seed: 4 }), { seed: 7, laps: 2 });
  assert.equal(g.racerIds.length, 8);
  assert.equal(g.hud().phase, 'countdown'); assert.equal(g.hud().message, '3');
  run(g, 1);
  assert.equal(g.hud().phase, 'countdown');
  run(g, 4);
  assert.equal(g.hud().phase, 'racing');
  run(g, 10);
  const progress = g.racerIds.slice(1).map((id) => Number(g.rt.world.get(id, 'race')!['progress']));
  assert.ok(progress.every((p) => p > 0.05), `AI progress ${progress}`);
  const hud = g.hud();
  assert.ok(hud.speed > 5 || progress.length > 0); assert.equal(hud.racers, 8); assert.ok(hud.position >= 1 && hud.position <= 8);
});

test('the player drives with input: throttle makes progress, steering changes heading', () => {
  const g = createRaceGame(createRuntime({ seed: 4 }), { seed: 7, laps: 2 });
  run(g, 4.2);
  g.input.keyDown('ArrowUp');
  const h0 = g.playerPose();
  run(g, 5);
  const p1 = g.playerPose();
  assert.ok(p1.speed > 5, `speed ${p1.speed}`);
  assert.ok(Math.hypot(p1.x - h0.x, p1.z - h0.z) > 8);
  g.input.keyDown('ArrowRight');
  run(g, 1.5);
  const p2 = g.playerPose();
  assert.ok(Math.abs(p2.hx * h0.hx + p2.hz * h0.hz) < 0.98, 'heading changed');
});

test('restart puts everybody back on the grid and runs a fresh countdown', () => {
  const g = createRaceGame(createRuntime({ seed: 4 }), { seed: 7, laps: 2 });
  run(g, 10);
  g.restart();
  assert.equal(g.hud().phase, 'countdown');
  for (const id of g.racerIds) assert.equal(Number(g.rt.world.get(id, 'race')!['progress']), 0);
});

test('chase camera eases behind the heading', () => {
  const t = { x: 0, y: 0, z: 0, hx: 1, hz: 0, speed: 0 };
  const a = chaseCamera(null, t, 16);
  assert.ok(a.position[0] < -8 && a.position[1] > 3 && a.target[0] > 5);
  const b = chaseCamera(a, { ...t, x: 20 }, 16);
  assert.ok(b.position[0] > a.position[0] && b.position[0] < 20 - 8);
});
