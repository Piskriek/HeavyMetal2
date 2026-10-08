import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, METRICS, newLab, rackCount, canMakeBlank, makeBlank, canWrite, startWrite, canCombine, startCombine, canSlot, slotInto, unslot, step, activity, affinityOf, loadLab, type LabEnv, type Preset } from '../src/index';

const P: Preset[] = [
  { id: 'mud', name: 'Mud', affinity: { pxd: 1.4 }, minStage: 0 },
  { id: 'terrain', name: 'Terrain shaping', affinity: { vtx: 1.5, pxd: 0.9 }, minStage: 0 },
  { id: 'sun', name: 'Low sun', affinity: { lx: 1.6 }, minStage: 2 },
];
const env = (o: Partial<LabEnv> = {}): LabEnv => ({ presets: P, stage: 1, powered: true, ...o });

test('blanks cost ore and wait in the rack', () => {
  let s = newLab();
  assert.equal(rackCount(s), 0);
  assert.equal(canMakeBlank(s, RULES.blankCost - 1).ok, false);
  assert.match(canMakeBlank(s, RULES.blankCost - 1).why, /ore/i);
  assert.throws(() => makeBlank(s, 0));
  const r = makeBlank(s, 100);
  assert.equal(r.oreUsed, RULES.blankCost);
  s = r.state;
  assert.equal(rackCount(s), 1);
  const c = s.cartridges[0]!;
  assert.equal(c.kind, 'blank');
  assert.equal(c.slot, null);
  for (const m of METRICS) assert.equal(affinityOf(s, c.id, m), 1);
  assert.equal(affinityOf(s, 'nope', 'pxd'), 1);
});

test('the bench writes a preset onto a blank, only with power and only presets the stage has opened', () => {
  let s = makeBlank(newLab(), 100).state;
  const id = s.cartridges[0]!.id;
  assert.equal(canWrite(s, env(), id, 'sun').ok, false);
  assert.match(canWrite(s, env(), id, 'sun').why, /stage 2/);
  assert.equal(canWrite(s, env({ stage: 2 }), id, 'sun').ok, true);
  assert.equal(canWrite(s, env({ powered: false }), id, 'mud').ok, false);
  assert.equal(canWrite(s, env(), id, 'nope').ok, false);
  s = startWrite(s, env(), id, 'mud');
  assert.equal(canWrite(s, env(), id, 'mud').ok, false); // the bench is busy
  s = step(s, env({ powered: false }), 100).state; // no power, no progress
  assert.equal(s.cartridges.find((c) => c.id === id)!.kind, 'blank');
  for (let t = 0; t < RULES.writeSeconds - 1; t++) s = step(s, env(), 1).state;
  assert.equal(s.cartridges.find((c) => c.id === id)!.kind, 'blank');
  const r = step(s, env(), 1);
  s = r.state;
  assert.ok(r.events.some((e) => e.type === 'written' && e.id === id));
  const c = s.cartridges.find((x) => x.id === id)!;
  assert.equal(c.kind, 'preset');
  assert.equal(c.preset, 'mud');
  assert.equal(c.name, 'Mud');
  assert.equal(c.affinity.pxd, 1.4);
  assert.equal(c.affinity.vtx, 1);
  assert.equal(s.bench, null);
});

test('the combiner mixes two to four written cartridges into one; the best gain counts in full, the rest half', () => {
  let s = newLab();
  for (let i = 0; i < 4; i++) s = makeBlank(s, 100).state;
  const [a, b, c, blank] = s.cartridges.map((x) => x.id) as [string, string, string, string];
  for (const [id, p] of [[a, 'mud'], [b, 'terrain'], [c, 'mud']] as const) {
    s = startWrite(s, env(), id, p);
    s = step(s, env(), RULES.writeSeconds).state;
  }
  assert.equal(canCombine(s, env(), [a]).ok, false);
  assert.equal(canCombine(s, env(), [a, a]).ok, false);
  assert.equal(canCombine(s, env(), [a, blank]).ok, false);
  assert.equal(canCombine(s, env({ powered: false }), [a, b]).ok, false);
  s = startCombine(s, env(), [a, b, c]);
  assert.equal(canCombine(s, env(), [a, b]).ok, false); // the combiner is busy
  const r = step(s, env(), RULES.combineSeconds);
  s = r.state;
  const made = s.cartridges.find((x) => x.kind === 'mix')!;
  assert.ok(r.events.some((e) => e.type === 'combined' && e.id === made.id));
  assert.equal(s.cartridges.some((x) => x.id === a || x.id === b || x.id === c), false);
  assert.deepEqual([...made.from].sort(), [a, b, c].sort());
  assert.equal(made.name, 'Mud + Terrain shaping + Mud');
  // pxd gains 0.4, 0.4, -0.1: 0.4 + (0.4 - 0.1) / 2 = 0.55
  assert.ok(Math.abs(made.affinity.pxd - 1.55) < 1e-9, String(made.affinity.pxd));
  assert.ok(Math.abs(made.affinity.vtx - 1.5) < 1e-9, String(made.affinity.vtx));
  assert.equal(made.affinity.lx, 1);
  assert.equal(rackCount(s), 2); // the mix and the blank
});

test('a written cartridge goes into one machine at a time and back to the rack; blanks never do', () => {
  let s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const [id, other] = s.cartridges.map((c) => c.id) as [string, string];
  assert.equal(canSlot(s, id, 7).ok, false);
  assert.match(canSlot(s, id, 7).why, /blank/i);
  for (const x of [id, other]) {
    s = startWrite(s, env(), x, 'terrain');
    s = step(s, env(), RULES.writeSeconds).state;
  }
  s = slotInto(s, id, 7);
  assert.equal(s.cartridges.find((c) => c.id === id)!.slot, 7);
  assert.equal(rackCount(s), 1);
  assert.equal(canSlot(s, id, 8).ok, false);
  assert.equal(canCombine(s, env(), [id, other]).ok, false); // it is out in a machine
  assert.equal(affinityOf(s, id, 'vtx'), 1.5);
  assert.equal(affinityOf(s, id, 'pxd'), 0.9);
  s = unslot(s, id);
  assert.equal(s.cartridges.find((c) => c.id === id)!.slot, null);
  assert.equal(rackCount(s), 2);
});

test('the rack holds RULES.rackSize; cartridges out in machines do not count', () => {
  let s = newLab();
  for (let i = 0; i < RULES.rackSize; i++) s = makeBlank(s, 1e6).state;
  assert.equal(canMakeBlank(s, 1e6).ok, false);
  assert.match(canMakeBlank(s, 1e6).why, /full/i);
  const id = s.cartridges[0]!.id;
  s = startWrite(s, env(), id, 'mud');
  s = step(s, env(), RULES.writeSeconds).state;
  s = slotInto(s, id, 3);
  assert.equal(canMakeBlank(s, 1e6).ok, true);
});

test('activity says how hard each lab machine works, for its pixels', () => {
  assert.deepEqual(activity(newLab(), env()), { bench: 0, combiner: 0, rack: 0 });
  let s = makeBlank(newLab(), 100).state;
  assert.equal(activity(s, env()).rack, 1); // cataloguing the new blank
  assert.equal(activity(s, env({ powered: false })).rack, 0);
  s = step(s, env(), RULES.catalogueSeconds).state;
  assert.equal(activity(s, env()).rack, 0);
  s = startWrite(s, env(), s.cartridges[0]!.id, 'mud');
  assert.equal(activity(s, env()).bench, 1);
  assert.equal(activity(s, env({ powered: false })).bench, 0);
  assert.equal(activity(s, env()).combiner, 0);
});

test('saves round-trip, junk is refused, nothing is mutated, and the same inputs give the same lab', () => {
  const s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const frozen = JSON.stringify(s);
  const x = s.cartridges[0]!.id;
  const a = step(startWrite(s, env(), x, 'mud'), env(), 5).state;
  const b = step(startWrite(s, env(), x, 'mud'), env(), 5).state;
  assert.equal(JSON.stringify(s), frozen);
  assert.deepEqual(a, b);
  assert.deepEqual(loadLab(JSON.parse(JSON.stringify(a))), a);
  assert.equal(loadLab(null), null);
  assert.equal(loadLab({ v: 99 }), null);
  assert.equal(loadLab({ ...a, cartridges: [a.cartridges[0], a.cartridges[0]] }), null); // the same id twice
  assert.equal(loadLab({ ...a, bench: { inputs: ['c999'], preset: 'mud', done: 0, needs: 20 } }), null); // a job naming a missing cartridge
});
