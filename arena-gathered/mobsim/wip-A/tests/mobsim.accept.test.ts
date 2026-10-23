// Hidden landing suite for @hm/mobsim (not sent): determinism over a long scripted fight, walls in a maze, spawnNear,
// separation, purity of inputs, and a player sealed away.
import test from 'node:test'; import assert from 'node:assert/strict';
import { createSim, spawn, spawnNear, fire, step, hashSim, KINDS, type Nav, type Sim } from '../src/mobsim';

function maze(seed: number, w: number, h: number, fill: number): Nav {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const cells = Array.from({ length: w * h }, () => rnd() < fill);
  for (let changed = true; changed;) {
    changed = false;
    for (let x = 0; x + 1 < w; x++) for (let y = 0; y + 1 < h; y++) {
      const a = cells[y * w + x], b = cells[y * w + x + 1], c = cells[(y + 1) * w + x], d = cells[(y + 1) * w + x + 1];
      if ((a && d && !b && !c) || (b && c && !a && !d)) { cells[y * w + x + (a ? 1 : 0)] = true; changed = true; }
    }
  }
  for (let x = 18; x <= 22; x++) for (let y = 18; y <= 22; y++) cells[y * w + x] = false; // a clear yard for the player
  return { originX: -20, originZ: -20, cell: 1, grid: { w, h, blocked: (x, y) => cells[y * w + x] === true } };
}
const inWall = (nav: Nav, x: number, z: number): boolean => {
  const u = (x - nav.originX) / nav.cell, v = (z - nav.originZ) / nav.cell, i = Math.floor(u), j = Math.floor(v);
  const inside = u - i > 1e-6 && u - i < 1 - 1e-6 && v - j > 1e-6 && v - j < 1 - 1e-6;
  return inside && (i < 0 || j < 0 || i >= nav.grid.w || j >= nav.grid.h || nav.grid.blocked(i, j));
};

/** A scripted fight: two waves, the player walking a square around the yard, a shot every 20 ticks. */
function fight(seed: number, nav: Nav, ticks: number, onTick?: (s: Sim, t: number) => void): Sim {
  let s = spawnNear(createSim(seed), nav, 'ogro', 4, 0.5, 0.5, 8, 16);
  s = spawnNear(s, nav, 'demon', 3, 0.5, 0.5, 8, 16);
  const corners = [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]] as const;
  for (let t = 0; t < ticks; t++) {
    const c = corners[Math.floor(t / 60) % 4]!, player = { x: c[0], z: c[1] };
    if (t === 300) s = spawnNear(s, nav, 'ogro', 2, player.x, player.z, 6, 12);
    if (t % 20 === 0) { const target = s.mobs.find((m) => m.state !== 'death'); if (target) { const d = [target.x - player.x, KINDS[target.kind].height / 2 - 1.8, target.z - player.z], n = Math.hypot(d[0]!, d[1]!, d[2]!) || 1; s = fire(s, [player.x, 1.8, player.z], [d[0]! / n, d[1]! / n, d[2]! / n]).sim; } }
    s = step(s, nav, player);
    onTick?.(s, t);
  }
  return s;
}

test('a long fight replays to the same hash, tick for tick', () => {
  const nav = maze(31337, 40, 40, 0.22), seen: string[] = [];
  const a = fight(99, nav, 900, (s, t) => { if (t % 100 === 0) seen.push(hashSim(s)); });
  let i = 0;
  const b = fight(99, nav, 900, (s, t) => { if (t % 100 === 0) assert.equal(hashSim(s), seen[i++], `diverged by tick ${t}`); });
  assert.equal(hashSim(a), hashSim(b));
  assert.notEqual(hashSim(fight(100, nav, 900)), hashSim(a), 'another seed is another fight');
  assert.ok(a.mobs.length >= 5, 'the waves spawned');
});

test('in a maze no mob ever enters a blocked cell', () => {
  const nav = maze(4242, 40, 40, 0.3);
  fight(5, nav, 900, (s, t) => { for (const m of s.mobs) assert.ok(!inWall(nav, m.x, m.z), `tick ${t}: mob ${m.id} at ${m.x}, ${m.z}`); });
});

test('spawnNear puts mobs on free spots in its ring; spawn refuses walls', () => {
  const nav = maze(777, 40, 40, 0.3);
  const s = spawnNear(createSim(1), nav, 'demon', 8, 0.5, 0.5, 5, 10);
  assert.ok(s.mobs.length >= 1 && s.mobs.length <= 8);
  for (const m of s.mobs) { assert.ok(!inWall(nav, m.x, m.z)); const r = Math.hypot(m.x - 0.5, m.z - 0.5); assert.ok(r >= 5 - 1 && r <= 10 + 1, `r ${r}`); assert.equal(m.hp, 80); }
  const wall: Nav = { originX: 0, originZ: 0, cell: 1, grid: { w: 10, h: 10, blocked: (x) => x === 5 } };
  assert.equal(spawn(createSim(1), wall, 'ogro', 5.5, 3.5).mobs.length, 0);
});

test('mobs spawned on one spot push apart', () => {
  const open: Nav = { originX: 0, originZ: 0, cell: 1, grid: { w: 30, h: 30, blocked: () => false } };
  let s = spawn(spawn(createSim(2), open, 'ogro', 10, 10), open, 'ogro', 10, 10);
  for (let i = 0; i < 60; i++) s = step(s, open, { x: 25, z: 25 });
  const [a, b] = s.mobs; assert.ok(Math.hypot(a!.x - b!.x, a!.z - b!.z) >= 1.5, 'still stacked');
});

test('step and fire never mutate their inputs; a sealed-off player is harmless', () => {
  const nav: Nav = { originX: 0, originZ: 0, cell: 1, grid: { w: 20, h: 20, blocked: (x) => x === 10 } };
  const s0 = spawn(createSim(4), nav, 'demon', 3.5, 3.5), copy = JSON.stringify(s0);
  step(s0, nav, { x: 15.5, z: 3.5 }); fire(s0, [3.5, 1.8, 0.5], [0, 0, 1]);
  assert.equal(JSON.stringify(s0), copy);
  let s = s0; for (let i = 0; i < 300; i++) s = step(s, nav, { x: 15.5, z: 3.5 });
  assert.ok(!inWall(nav, s.mobs[0]!.x, s.mobs[0]!.z) && s.mobs[0]!.x < 10, 'stays on its side');
});
