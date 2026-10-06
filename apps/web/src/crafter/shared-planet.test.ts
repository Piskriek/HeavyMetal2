// The shared planet's rules against their own claims: plots never crowd, never move, everyone agrees, neighbours are near.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLOT_RADIUS } from './planet';
import { SLOT_SPACING, gameOrbit, neighbourSlots, planetRadiusFor, resolveSlots, slotPosition, type PlotClaim } from './shared-planet';

test('no two plots are ever closer than two plots and a gap', () => {
  const n = 2500, pts = Array.from({ length: n }, (_, k) => slotPosition(k));
  let min = Infinity;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < Math.min(n, i + 120); j++) min = Math.min(min, Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.z - pts[j]!.z));
  assert.ok(min >= 2 * PLOT_RADIUS + 40, `closest plots ${min.toFixed(1)} m apart`);
});

test('the planet grows with its players, and never shrinks', () => {
  let last = 0;
  for (const n of [1, 10, 1000, 100000, 1000000]) { const r = planetRadiusFor(n); assert.ok(r >= last); last = r; }
  assert.equal(planetRadiusFor(1), 12000);
  // a million plots: every one still within 85% of the way round
  const far = Math.hypot(slotPosition(999999).x, slotPosition(999999).z);
  assert.ok(far <= 0.85 * Math.PI * planetRadiusFor(1000000) + 1);
});

test('everyone agrees on the slots, a clash goes to the older plot, and removing a plot moves no one', () => {
  const claims: PlotClaim[] = [
    { id: 'a', createdAt: 1, wants: 0 }, { id: 'b', createdAt: 2, wants: 1 },
    { id: 'c', createdAt: 3, wants: 2 }, { id: 'd', createdAt: 3, wants: 2 }, // claimed at the same moment
    { id: 'e', createdAt: 5, wants: 3 },
  ];
  const one = resolveSlots(claims), two = resolveSlots([...claims].reverse());
  assert.deepEqual([...one.entries()].sort(), [...two.entries()].sort());
  assert.equal(one.get('c'), 2);
  assert.equal(one.get('d'), 3, 'the later of a clash takes the next free slot');
  assert.equal(one.get('e'), 4);
  const without = resolveSlots(claims.filter((c) => c.id !== 'b'));
  for (const id of ['a', 'c', 'd', 'e']) assert.equal(without.get(id), one.get(id), `${id} did not move`);
});

test('neighbours are the slots nearby, nearest first, found without trying every slot', () => {
  const k = 5000, me = slotPosition(k), within = 600;
  const near = neighbourSlots(k, within);
  assert.ok(near.length >= 15, `${near.length} neighbours within ${within} m`);
  let last = 0;
  for (const j of near) {
    const p = slotPosition(j), d = Math.hypot(p.x - me.x, p.z - me.z);
    assert.ok(d <= within && d >= last);
    last = d;
  }
  // brute force agrees
  const all = Array.from({ length: 8000 }, (_, j) => j).filter((j) => j !== k && Math.hypot(slotPosition(j).x - me.x, slotPosition(j).z - me.z) <= within);
  assert.equal(near.length, all.length);
  assert.ok(SLOT_SPACING > 0);
});

test('games orbit eight to a system, and a new system opens for the ninth', () => {
  assert.deepEqual(gameOrbit(0), { system: 0, orbit: 0 });
  assert.deepEqual(gameOrbit(7), { system: 0, orbit: 7 });
  assert.deepEqual(gameOrbit(8), { system: 1, orbit: 0 });
});
