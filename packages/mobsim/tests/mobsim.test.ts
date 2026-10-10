import test from 'node:test'; import assert from 'node:assert/strict';
import { createSim, spawn, fire, step, hashSim, type Nav, type Sim } from '../src/index';
const wall: Nav = { originX: 0, originZ: 0, cell: 1, grid: { w: 30, h: 30, blocked: (x, y) => x === 15 && y <= 25 } };
const open: Nav = { originX: 0, originZ: 0, cell: 1, grid: { w: 30, h: 30, blocked: () => false } };
const run = (s: Sim, nav: Nav, p: { x: number; z: number }, n: number) => { for (let i = 0; i < n; i++) s = step(s, nav, p); return s; };
test('paths around a wall, never through it, then attacks', () => {
  let s = spawn(createSim(7), wall, 'ogro', 5.5, 5.5);
  for (let t = 0; t < 1200 && s.mobs[0]!.state !== 'attack'; t++) { s = step(s, wall, { x: 25.5, z: 5.5 }); const m = s.mobs[0]!; assert.ok(!(m.x > 15 + 1e-6 && m.x < 16 - 1e-6 && m.z < 26 - 1e-6), 'in the wall'); }
  assert.equal(s.mobs[0]!.state, 'attack'); assert.ok(Math.hypot(s.mobs[0]!.x - 25.5, s.mobs[0]!.z - 5.5) <= 2.2 + 1e-9);
});
test('attack holds to 2.8 m, then chase resumes', () => {
  let s = run(spawn(createSim(1), open, 'demon', 10.5, 10.5), open, { x: 12, z: 10.5 }, 30);
  assert.equal(s.mobs[0]!.state, 'attack'); s = step(s, open, { x: 13.1, z: 10.5 }); assert.equal(s.mobs[0]!.state, 'attack');
  s = step(s, open, { x: 13.6, z: 10.5 }); assert.equal(s.mobs[0]!.state, 'chase');
});
test('shotgun: damage range, pain or death, cooldown, corpses stay, deterministic', () => {
  const s = spawn(createSim(3), open, 'ogro', 10, 20), before = hashSim(s), shot = fire(s, [10, 1.8, 10], [0, 0, 1]);
  assert.equal(hashSim(s), before);
  assert.ok(shot.hits >= 1 && shot.hits <= 7 && shot.damage >= 20 * shot.hits && shot.damage <= 29 * shot.hits);
  assert.equal(shot.sim.mobs[0]!.state, shot.killed.length ? 'death' : 'pain'); assert.equal(fire(shot.sim, [10, 1.8, 10], [0, 0, 1]).hits, 0);
  let k = shot.sim; for (let i = 0; i < 400 && k.mobs[0]!.state !== 'death'; i++) { k = run(k, open, { x: 10, z: 10 }, 16); k = fire(k, [10, 1.8, 10], [0, 0, 1]).sim; }
  assert.equal(k.mobs[0]!.state, 'death'); const pos = [k.mobs[0]!.x, k.mobs[0]!.z];
  assert.deepEqual([run(k, open, { x: 2, z: 2 }, 60).mobs[0]!.x, run(k, open, { x: 2, z: 2 }, 60).mobs[0]!.z], pos);
  assert.equal(hashSim(fire(spawn(createSim(3), open, 'ogro', 10, 20), [10, 1.8, 10], [0, 0, 1]).sim), hashSim(shot.sim));
});

test('fire takes the weapon: SHOTGUN is the default, other parts change pellets, damage, range and cooldown', async () => {
  const { SHOTGUN } = await import('../src/index');
  const s = spawn(createSim(3), open, 'ogro', 10, 20), from: [number, number, number] = [10, 1.8, 10], dir: [number, number, number] = [0, 0, 1];
  assert.equal(hashSim(fire(s, from, dir).sim), hashSim(fire(s, from, dir, SHOTGUN).sim), 'the default is SHOTGUN');
  const long = fire(s, from, dir, { pellets: 1, damage: [27, 39], spread: 0.006, range: 90, cooldown: 0.52 });
  assert.equal(long.hits, 1); assert.ok(long.damage >= 27 && long.damage <= 39, String(long.damage));
  assert.equal(fire(s, from, dir, { ...SHOTGUN, range: 5 }).hits, 0, 'the ogro at 10 m is out of a 5 m range');
  const beam = fire(s, from, dir, { pellets: 1, damage: [6, 8], spread: 0, range: 60, cooldown: 0.1 });
  assert.ok(Math.abs(beam.sim.cooldown - 0.1) < 1e-9 && beam.damage >= 6 && beam.damage <= 8);
});
