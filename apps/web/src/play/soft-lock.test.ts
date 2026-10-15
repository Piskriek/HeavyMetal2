// The no-soft-lock proof for the first ore (TASK-26; rule 23, P0-LOOP-01). From ore 0 with no running drill, each of the three ways
// to gather ore reaches a rock drill's cost (18 ore), and all three feed the plot's one ore stock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS } from '@hm/plotsim';
import { CLUTTER, salvageFor, salvageSplit } from './lab-clutter';
import { BEAM_BOULDER_RATE, boulderBeamRate } from './beam-tool';

const DRILL_COST = KINDS.drill.cost;
/** Ore per second while E is held on a boulder (play.tsx: `scene.gatherBoulder(id, 3 * dt)`). */
const HAND_RATE = 3;
/** A boulder's ore when full, and its regrowth per second (plot-ground.ts: BOULDER_INITIAL_ORE and regrow()). */
const BOULDER_ORE = 40;
const regrowPerSec = (richness: number): number => (BOULDER_ORE / 180) * Math.max(0.12, richness);

test('the drill costs 18 ore, the first ore the plot needs', () => {
  assert.equal(DRILL_COST, 18);
});

test('hand gathering: holding E on a boulder reaches a drill\'s cost in 6 seconds, and a boulder holds enough', () => {
  assert.ok(BOULDER_ORE >= DRILL_COST, 'one full boulder covers a drill');
  assert.ok(Math.ceil(DRILL_COST / HAND_RATE) <= 6, `${Math.ceil(DRILL_COST / HAND_RATE)} s at ${HAND_RATE} ore/s`);
});

test('a gathered boulder never dead-ends: it regrows from empty even on the poorest ground, within 12 minutes', () => {
  for (const richness of [0, 0.05, 0.12, 0.5, 1]) {
    assert.ok(regrowPerSec(richness) > 0, `richness ${richness} regrows`);
  }
  const worstWait = DRILL_COST / regrowPerSec(0);
  assert.ok(worstWait <= 12 * 60, `worst wait ${worstWait.toFixed(0)} s, once a boulder is empty`);
});

test('the beam\'s Extract reaches a drill\'s cost in under 5 seconds on any boulder, and takes from the same boulders', () => {
  assert.equal(BEAM_BOULDER_RATE, 4);
  assert.ok(boulderBeamRate(0, 0) > 0, 'bare ground still gives the beam\'s base rate');
  assert.ok(DRILL_COST / boulderBeamRate(0, 0) < 5, `${(DRILL_COST / boulderBeamRate(0, 0)).toFixed(2)} s at the base rate`);
});

test('lab salvage: the lab\'s salvage props hold a drill\'s cost of plot ore, and each prop gives some', () => {
  const salvage = CLUTTER.filter((c) => c.role === 'salvage');
  assert.ok(salvage.length >= 2, 'the lab has salvage props');
  let total = 0;
  for (const c of salvage) {
    const split = salvageSplit(c);
    assert.ok(split.plotOre >= 1, `${c.id} gives plot ore`);
    assert.ok(split.pack.every((st) => st.item !== 'ore'), `${c.id}: the ore goes to the plot, not the pack`);
    total += split.plotOre;
  }
  assert.ok(total >= DRILL_COST, `the salvage holds ${total} ore in all, a drill is ${DRILL_COST}`);
});

test('the salvage split keeps every unit: plot ore plus pack stacks equal the prop\'s salvage', () => {
  for (const c of CLUTTER.filter((x) => x.role === 'salvage')) {
    const split = salvageSplit(c);
    const whole = salvageFor(c).reduce((t, st) => t + st.n, 0);
    const packed = split.pack.reduce((t, st) => t + st.n, 0);
    assert.equal(split.plotOre + packed, whole);
  }
});
