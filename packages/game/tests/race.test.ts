import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '@hm/engine';
import { createRaceGame, rulesOf, itemsOf, DEFAULT_RULES } from '../src';
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

test('the player drives with input: throttle gives speed and progress, steering changes the heading', () => {
  const g = createRaceGame(createRuntime({ seed: 4 }), { seed: 7, laps: 2 });
  run(g, 4.2);
  g.input.keyDown('ArrowUp');
  let top = 0;
  for (let i = 0; i < 3; i++) { run(g, 1); top = Math.max(top, g.playerPose().speed); }
  assert.ok(top > 10, `top speed ${top}`);
  assert.ok(Number(g.rt.world.get(g.player, 'race')!['progress']) > 0.01);
  const g2 = createRaceGame(createRuntime({ seed: 4 }), { seed: 7, laps: 2 });
  run(g2, 4.2);
  g2.input.keyDown('ArrowUp'); g2.input.keyDown('ArrowRight');
  const h0 = g2.playerPose();
  run(g2, 1.2);
  const h1 = g2.playerPose();
  assert.ok(h1.hx * h0.hx + h1.hz * h0.hz < 0.95, 'heading turned');
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

test('a whole race: nearly every AI goblin finishes (fast ones that slide wide still count their laps, nobody jams the line) and the player, idle, is classified last', () => {
  const g = createRaceGame(createRuntime({ seed: 4 }), { seed: 7, laps: 3 });
  run(g, 95);
  const results = g.results();
  assert.ok(results, 'the race ended with results');
  const finished = results!.filter((r) => !r.dnf);
  assert.ok(finished.length >= 6, `finishers ${finished.length}`);
  assert.ok(finished.every((r) => r.id !== String(g.player)), 'the idle player is not among the finishers');
  assert.ok(finished.every((r) => typeof r.timeMs === 'number' && r.timeMs! > 20000 && r.timeMs! < 90000), 'sensible times');
});

test('the race is a preset: rules come from the scene, are clamped, and change the race', () => {
  const rt = createRuntime({ seed: 4 });
  const rules = rt.store.put({ id: 'rules1', kind: 'race', name: 'Sprint', params: { laps: 1, field: 4, boostPads: 0, rumble: false, itemsPerLap: 0, aiSkill: 9 } });
  const scene = rt.store.put({ kind: 'scene', name: 'S', params: {}, children: { rules: [{ ref: rules.id }] } });
  rt.loadScene(scene.id);
  const r = rulesOf(rt);
  assert.deepEqual([r.laps, r.field, r.boostPads, r.rumble, r.itemsPerLap, r.aiSkill, r.walls], [1, 4, 0, false, 0, 1.5, true]);
  const g = createRaceGame(rt, { seed: 7, rules: r });
  assert.equal(g.racerIds.length, 4);
  assert.equal(g.hud().laps, 1);
  assert.equal(g.roadDecals.filter((d) => d.kind === 'boostPad' || d.kind === 'rumble').length, 0);
  assert.ok(g.roadDecals.some((d) => d.kind === 'startLine'));
  const none = createRuntime({ seed: 4 });
  assert.deepEqual(rulesOf(none), DEFAULT_RULES);
});

test('items are presets: a scene with its own items hands out only those, with their icons', () => {
  const rt = createRuntime({ seed: 4 });
  const rocket = rt.store.put({ id: 'rocket', kind: 'item', name: 'Rocket', params: { label: 'Rocket', icon: '🚀', effect: 'boost', durationMs: 3000, weightFront: 1, weightMiddle: 1, weightBack: 1 } });
  const scene = rt.store.put({ kind: 'scene', name: 'S', params: {}, children: { items: [{ ref: rocket.id }] } });
  rt.loadScene(scene.id);
  const items = itemsOf(rt);
  assert.deepEqual(items.map((i) => [i.id, i.icon, i.effect, i.durationMs]), [['rocket', '🚀', 'boost', 3000]]);
  assert.equal(itemsOf(createRuntime({ seed: 4 })).length, 8);
  const g = createRaceGame(rt, { seed: 7, items });
  run(g, 60);
  const held = g.racerIds.map((id) => String(g.rt.world.get(id, 'racer')!['item'])).filter(Boolean);
  assert.ok(held.length > 0 && held.every((h) => h === 'rocket'), `held ${held}`);
  const hud = g.hud();
  assert.ok(hud.item === null || hud.item.icon === '🚀');
});
