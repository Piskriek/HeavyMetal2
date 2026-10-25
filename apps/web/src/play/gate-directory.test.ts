import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decode } from '@hm/plotcodec';
import {
  DIRECTORY_SEED,
  EXPLORER_NAMES,
  EXPLORER_PLOT_COUNT,
  dialRandomPlot,
  dialSeed,
  explorerPlotCode,
  explorerPlotSnapshot,
  gateAddress,
  gateDirectory,
  openGateCount,
  ownGateEntry,
  planetaryGateDirectory,
} from './gate-directory';

const OWN = ownGateEntry({ plotId: 'my-plot', access: 'open', stage: 4 });
const DIRECTORY = gateDirectory(OWN);

test('a plot keeps one 6-chevron address, and only chevrons', () => {
  const a = gateAddress('sim-01');
  assert.equal(a.length, 6);
  assert.match(a, /^[A-Z0-9]{6}$/);
  assert.equal(gateAddress('sim-01'), a, 'the same plot always answers to the same address');
  assert.notEqual(gateAddress('sim-02'), a);
  const seen = new Set<string>();
  for (let i = 0; i < 64; i++) seen.add(gateAddress(`plot-${i}`));
  assert.ok(seen.size >= 60, `64 plots make ${seen.size} distinct addresses`);
});

test('the seeded directory is deterministic and keeps a mixed privacy pool', () => {
  const a = planetaryGateDirectory();
  const b = planetaryGateDirectory();
  assert.deepEqual(a, b);
  assert.equal(a.length, EXPLORER_PLOT_COUNT);
  // every seeded plot has a distinct id, address and owner; nobody stands on the same address
  assert.equal(new Set(a.map((e) => e.plotId)).size, a.length);
  assert.equal(new Set(a.map((e) => e.addressCode)).size, a.length);
  for (const e of a) {
    assert.match(e.addressCode, /^[A-Z0-9]{6}$/);
    assert.ok(EXPLORER_NAMES.includes(e.label ?? ''));
    assert.ok(e.stage !== undefined && e.stage >= 1 && e.stage <= 6);
    assert.ok(e.world === 'moon' || e.world === 'earth');
  }
  // the random pool is neither everything nor nothing: some plots are shut, and one is shut outright
  const open = a.filter((e) => e.access === 'open').length;
  assert.ok(open >= 3 && open < a.length, `${open} of ${a.length} are open`);
  assert.ok(a.some((e) => e.access === 'closed') || a.some((e) => e.access === 'code-only'));
  // a count of 0 is allowed (a lone player still has their own plot in the list)
  assert.equal(planetaryGateDirectory(0).length, 0);
});

test('the player holds their own plot, and their iris state is what the directory reports', () => {
  const open = ownGateEntry({ plotId: 'my-plot', access: 'open' });
  const shut = ownGateEntry({ plotId: 'my-plot', access: 'closed' });
  assert.equal(open.addressCode, shut.addressCode);
  assert.equal(open.access, 'open');
  assert.equal(shut.access, 'closed');
  assert.equal(open.world, 'moon');
  assert.equal(ownGateEntry({ plotId: 'earth-plot', access: 'open', world: 'earth' }).world, 'earth');
  // the console reads own first, then the neighbourhood
  assert.equal(DIRECTORY[0]?.plotId, 'my-plot');
  assert.equal(DIRECTORY.length, EXPLORER_PLOT_COUNT + 1);
  assert.equal(openGateCount(DIRECTORY), DIRECTORY.filter((e) => e.access === 'open').length);
});

test('a seeded plot is a real plot: a code that decodes to its owner, stage and machines', () => {
  const [first, second] = planetaryGateDirectory();
  for (const entry of [first!, second!]) {
    const code = explorerPlotCode(entry);
    assert.ok(code, 'the code is written');
    const snap = decode(code!);
    assert.ok(snap, 'and it reads back');
    assert.equal(snap!.owner, entry.label);
    assert.equal(snap!.stage, entry.stage);
    assert.ok(snap!.machines.length >= 2 && snap!.machines.length <= 6);
    for (const m of snap!.machines) {
      // nothing stands on the gate, and nothing is further out than a plot holds
      const r = Math.hypot(m.x, m.z);
      assert.ok(r > 5 && r < 500, `${m.kind} at ${r.toFixed(1)} m`);
    }
    // the points rise with the stage, and a plot keeps all four Cardinal Floats
    assert.ok(snap!.points.pxd > 9000);
    for (const metric of ['pxd', 'vtx', 'lx', 'aq'] as const) assert.equal(typeof snap!.points[metric], 'number');
    // the same entry always makes the same plot
    assert.deepEqual(explorerPlotSnapshot(entry), explorerPlotSnapshot(entry));
  }
});

test('Dial Random Gate picks an open plot that is not the player\'s own, and the same seed picks the same one', () => {
  const seed = dialSeed(0, OWN.plotId);
  const a = dialRandomPlot(DIRECTORY, OWN.plotId, seed);
  const b = dialRandomPlot(DIRECTORY, OWN.plotId, seed);
  assert.ok(a.ok && b.ok);
  assert.deepEqual(a, b);
  assert.equal(a.entry.access, 'open');
  assert.notEqual(a.entry.plotId, OWN.plotId);
  assert.equal(a.dialSequence.length, 6);
  assert.equal(a.dialSequence.join(''), a.entry.addressCode);
  const snap = decode(a.code);
  assert.ok(snap);
  assert.equal(snap!.owner, a.entry.label);
});

test('walks spread over the open plots, and reopen the pool once every one has been walked', () => {
  const openIds = DIRECTORY.filter((e) => e.access === 'open' && e.plotId !== OWN.plotId).map((e) => e.plotId);
  const visited: string[] = [];
  for (let i = 0; i < openIds.length; i++) {
    const r = dialRandomPlot(DIRECTORY, OWN.plotId, dialSeed(i, OWN.plotId), visited);
    assert.ok(r.ok, `press ${i}`);
    assert.ok(!visited.includes(r.entry.plotId), `press ${i} finds a plot not yet walked`);
    visited.push(r.entry.plotId);
  }
  assert.deepEqual([...visited].sort(), [...openIds].sort(), 'every open plot is reached exactly once');
  // every open gate has been walked: the next press still dials (endless exploration) rather than leaving the console dead
  const again = dialRandomPlot(DIRECTORY, OWN.plotId, dialSeed(openIds.length, OWN.plotId), visited);
  assert.ok(again.ok);
  assert.equal(again.entry.access, 'open');
});

test('a plot shut to strangers is never picked, and the reason is clean when nobody is open', () => {
  const closedOnly = [
    ownGateEntry({ plotId: 'my-plot', access: 'open' }),
    ...planetaryGateDirectory().map((e) => ({ ...e, access: 'closed' as const })),
    ...planetaryGateDirectory().filter((e) => e.access === 'code-only'),
  ];
  for (let i = 0; i < 8; i++) {
    const r = dialRandomPlot(closedOnly, 'my-plot', dialSeed(i, 'my-plot'));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'no-open-gates');
  }
  // a player alone in the world: their own gate is not a random destination
  const alone = [ownGateEntry({ plotId: 'my-plot', access: 'open' })];
  const r = dialRandomPlot(alone, 'my-plot', dialSeed(0, 'my-plot'));
  assert.equal(r.ok, false);
});

test('the dial seed walks on every press and is still a pure function of the press count', () => {
  const seeds = [0, 1, 2, 3].map((n) => dialSeed(n, 'my-plot'));
  assert.equal(new Set(seeds).size, 4);
  assert.deepEqual([0, 1, 2, 3].map((n) => dialSeed(n, 'my-plot')), seeds);
  assert.equal(dialSeed(0, 'my-plot'), dialSeed(0, 'my-plot'));
  assert.notEqual(dialSeed(0, 'my-plot'), dialSeed(0, 'other-plot'));
  assert.equal(dialSeed(-3, 'my-plot'), dialSeed(0, 'my-plot'), 'a negative press count reads as the first');
});

test('the directory seed is a constant and the plots do not depend on the clock', () => {
  assert.equal(DIRECTORY_SEED, 0x504c4f54);
  assert.deepEqual(gateAddress('sim-01', DIRECTORY_SEED), gateAddress('sim-01'));
  assert.deepEqual(planetaryGateDirectory(4, 7), planetaryGateDirectory(4, 7));
  assert.notDeepEqual(planetaryGateDirectory(4, 7), planetaryGateDirectory(4, 8), 'another seed is another neighbourhood');
});
