/**
 * ROUTE-2 — a new layout every race, from the race seed. Same seed, same layout (a race replays and
 * can be shared); across seeds every branch gets used; a fork always keeps at least one branch open.
 * Run with: node --import tsx --test tests/route-layout.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANE_VARIANTS, branchClosed, chooseBranch, layoutForSeed, openBranches, type RouteGraph } from '../src/game/sim/route';

const GRAPH: RouteGraph = {
  sections: [
    { id: 'sky', x0: 2000, x1: 9000, branches: [{ id: 'bridges', name: 'Chain bridges' }, { id: 'chute', name: 'Drop chute' }] },
    { id: 'tube', x0: 40000, x1: 52000, branches: [{ id: 'main', name: 'Main tube' }, { id: 'vent', name: 'Side vent' }, { id: 'crumble', name: 'Crumbling ledge' }] },
    { id: 'lagoon', x0: 60000, x1: 70000, branches: [{ id: 'boardwalk', name: 'Boardwalk' }, { id: 'arches', name: 'Arch bridges' }, { id: 'wreck', name: 'Shipwreck ramp' }] },
  ],
};

test('layout: the same seed gives the same layout, and different seeds differ', () => {
  assert.deepEqual(layoutForSeed(GRAPH, 1234), layoutForSeed(GRAPH, 1234));
  const keys = new Set(Array.from({ length: 50 }, (_, seed) => JSON.stringify(layoutForSeed(GRAPH, seed))));
  assert.ok(keys.size > 15, `50 seeds should give many different layouts (got ${keys.size})`);
});

test('layout: every fork keeps a branch open; every branch and lane variant appears across seeds', () => {
  const seenOpen = new Map<string, number>();
  const seenLanes = new Set<number>();
  let allOpenTwo = 0;
  const N = 2000;
  for (let seed = 0; seed < N; seed++) {
    const layout = layoutForSeed(GRAPH, seed);
    for (const section of GRAPH.sections) {
      const open = layout.open![section.id];
      assert.ok(open.length >= 1, `seed ${seed}: ${section.id} has no open branch`);
      for (const id of open) {
        seenOpen.set(`${section.id}/${id}`, (seenOpen.get(`${section.id}/${id}`) ?? 0) + 1);
        const lane = layout.lanes![section.id][id];
        assert.ok(Number.isInteger(lane) && lane >= 0 && lane < LANE_VARIANTS);
        seenLanes.add(lane);
      }
      if (section.id === 'sky' && open.length === 2) allOpenTwo++;
    }
  }
  for (const section of GRAPH.sections) for (const b of section.branches) {
    assert.ok((seenOpen.get(`${section.id}/${b.id}`) ?? 0) > N * 0.3, `${section.id}/${b.id} is rarely open`);
  }
  assert.equal(seenLanes.size, LANE_VARIANTS);
  assert.ok(Math.abs(allOpenTwo / N - 0.7) < 0.05, `two-branch forks are both open ~70% (got ${(allOpenTwo / N).toFixed(2)})`);
});

test('layout: a closed branch gets no lateral band, so nobody can take it', () => {
  for (let seed = 0; seed < 200; seed++) {
    const layout = layoutForSeed(GRAPH, seed);
    for (const section of GRAPH.sections) {
      const open = openBranches(section, layout).map((b) => b.id);
      for (let z = -480; z <= 480; z += 20) assert.ok(open.includes(chooseBranch(section, z, layout)));
      for (const b of section.branches) assert.equal(branchClosed(section, b.id, layout), !open.includes(b.id));
    }
  }
});
