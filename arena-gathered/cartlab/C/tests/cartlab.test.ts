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

test('ids run c1, c2, ... and a mix takes the next id while written blanks keep theirs', () => {
  let s = newLab();
  s = makeBlank(s, 100).state;
  s = makeBlank(s, 100).state;
  assert.equal(s.cartridges[0]!.id, 'c1');
  assert.equal(s.cartridges[1]!.id, 'c2');
  assert.equal(s.nextId, 3);
  const a = s.cartridges[0]!.id;
  const b = s.cartridges[1]!.id;
  for (const [id, p] of [[a, 'mud'], [b, 'mud']] as const) {
    s = startWrite(s, env(), id, p);
    s = step(s, env(), RULES.writeSeconds).state;
  }
  assert.equal(s.cartridges.find((c) => c.id === a)!.id, 'c1');
  s = startCombine(s, env(), [a, b]);
  s = step(s, env(), RULES.combineSeconds).state;
  const mix = s.cartridges.find((c) => c.kind === 'mix')!;
  assert.equal(mix.id, 'c3');
  assert.equal(s.nextId, 4);
  assert.equal(mix.preset, null);
  assert.deepEqual([...mix.from], [a, b]);
});

test('mud + terrain shaping is a road: names join in order and bad inputs cost half', () => {
  let s = newLab();
  for (let i = 0; i < 2; i++) s = makeBlank(s, 100).state;
  const [a, b] = s.cartridges.map((c) => c.id) as [string, string];
  s = startWrite(s, env(), a, 'mud');
  s = step(s, env(), RULES.writeSeconds).state;
  s = startWrite(s, env(), b, 'terrain');
  s = step(s, env(), RULES.writeSeconds).state;
  s = startCombine(s, env(), [a, b]);
  const r = step(s, env(), RULES.combineSeconds);
  s = r.state;
  const mix = s.cartridges.find((c) => c.kind === 'mix')!;
  assert.equal(mix.name, 'Mud + Terrain shaping');
  // pxd: gains 0.4, -0.1 sorted -> 0.4 + (-0.1/2) = 0.35
  assert.ok(Math.abs(mix.affinity.pxd - 1.35) < 1e-9);
  // vtx: gains 0, 0.5 sorted -> 0.5 + 0 = 0.5
  assert.ok(Math.abs(mix.affinity.vtx - 1.5) < 1e-9);
  assert.equal(r.events.length, 1);
});

test('combined affinity clamps to [0.5, 3] and sorts best-first', () => {
  let s = newLab();
  for (let i = 0; i < 4; i++) s = makeBlank(s, 100).state;
  const ids = s.cartridges.map((c) => c.id);
  const strong: Preset = { id: 'strong', name: 'Strong', affinity: { pxd: 3 }, minStage: 0 };
  const weak: Preset = { id: 'weak', name: 'Weak', affinity: { pxd: 0.5 }, minStage: 0 };
  const rich = env({ presets: [...P, strong, weak] });
  for (const id of ids) {
    s = startWrite(s, rich, id!, 'strong');
    s = step(s, rich, RULES.writeSeconds).state;
  }
  // 4x gain 2: 2 + (2+2+2)/2 = 5 -> 1+5=6 clamps to 3
  s = startCombine(s, rich, [...ids] as string[]);
  s = step(s, rich, RULES.combineSeconds).state;
  const big = s.cartridges.find((c) => c.kind === 'mix')!;
  assert.equal(big.affinity.pxd, 3);
  // now the floor: 2x weak gain -0.5 each: -0.5 + (-0.5/2) = -0.75 -> 0.25 clamps to 0.5
  let t = newLab();
  t = makeBlank(t, 100).state;
  t = makeBlank(t, 100).state;
  const [w1, w2] = t.cartridges.map((c) => c.id) as [string, string];
  for (const id of [w1, w2]) {
    t = startWrite(t, rich, id, 'weak');
    t = step(t, rich, RULES.writeSeconds).state;
  }
  t = startCombine(t, rich, [w1, w2]);
  t = step(t, rich, RULES.combineSeconds).state;
  const small = t.cartridges.find((c) => c.kind === 'mix')!;
  assert.equal(small.affinity.pxd, 0.5);
});

test('unpowered jobs pause and stall; powered time finishes bench and combiner together', () => {
  let s = newLab();
  for (let i = 0; i < 3; i++) s = makeBlank(s, 100).state;
  const [a, b, c] = s.cartridges.map((x) => x.id) as [string, string, string];
  for (const [id, p] of [[a, 'mud'], [b, 'mud']] as const) {
    s = startWrite(s, env(), id, p);
    s = step(s, env(), RULES.writeSeconds).state;
  }
  s = startWrite(s, env(), c, 'mud');
  s = startCombine(s, env(), [a, b]);
  const t0 = s.time;
  const paused = step(s, env({ powered: false }), 10);
  assert.equal(paused.state.time, t0 + 10);
  assert.equal(paused.state.bench!.done, 0);
  assert.equal(paused.state.combiner!.done, 0);
  assert.ok(paused.events.some((e) => e.type === 'stalled' && e.machine === 'bench'));
  assert.ok(paused.events.some((e) => e.type === 'stalled' && e.machine === 'combiner'));
  // a powered tick runs both; a long tick finishes both at once
  const both = step(paused.state, env(), 100);
  assert.equal(both.state.bench, null);
  assert.equal(both.state.combiner, null);
  assert.ok(both.events.some((e) => e.type === 'written'));
  assert.ok(both.events.some((e) => e.type === 'combined'));
});

test('cataloguing glows after a blank or a mix, not after a write', () => {
  let s = makeBlank(newLab(), 100).state;
  assert.equal(s.catalogueUntil, s.time + RULES.catalogueSeconds);
  assert.equal(activity(s, env()).rack, 1);
  s = step(s, env(), RULES.catalogueSeconds).state;
  assert.equal(activity(s, env()).rack, 0);
  const id = s.cartridges[0]!.id;
  const before = s.catalogueUntil;
  s = startWrite(s, env(), id, 'mud');
  s = step(s, env(), RULES.writeSeconds).state;
  assert.equal(s.catalogueUntil, before); // writing reuses the slot: no new catalogue
  assert.equal(activity(s, env()).rack, 0);
  // a mix catalogues again
  let t = newLab();
  t = makeBlank(t, 100).state;
  t = makeBlank(t, 100).state;
  const [a, b] = t.cartridges.map((c) => c.id) as [string, string];
  for (const x of [a, b]) {
    t = startWrite(t, env(), x, 'mud');
    t = step(t, env(), RULES.writeSeconds).state;
  }
  t = step(t, env(), 10).state; // let the blank catalogue fade
  assert.equal(activity(t, env()).rack, 0);
  t = startCombine(t, env(), [a, b]);
  t = step(t, env(), RULES.combineSeconds).state;
  assert.equal(activity(t, env()).rack, 1);
});

test('canWrite and canCombine refuse in order with one plain sentence', () => {
  let s = makeBlank(newLab(), 100).state;
  const id = s.cartridges[0]!.id;
  assert.match(canWrite(s, env({ powered: false }), id, 'mud').why, /power/i);
  s = startWrite(s, env(), id, 'mud');
  assert.match(canWrite(s, env(), 'nope', 'mud').why, /busy/i); // bench busy beats unknown cartridge
  assert.throws(() => startWrite(s, env(), id, 'mud'));
  s = step(s, env(), RULES.writeSeconds).state;
  assert.equal(canWrite(s, env(), id, 'mud').ok, false); // no longer a blank
  assert.throws(() => startCombine(s, env(), [id]));
  assert.equal(canCombine(s, env(), ['x', 'y', 'z', 'w', 'v']).ok, false);
  assert.throws(() => slotInto(s, 'nope', 1));
  const back = unslot(s, id);
  assert.equal(back, s); // already in the rack: unchanged
});

test('slotted cartridges cannot enter jobs and jobs block slotting', () => {
  let s = newLab();
  for (let i = 0; i < 3; i++) s = makeBlank(s, 100).state;
  const [a, b, c] = s.cartridges.map((x) => x.id) as [string, string, string];
  for (const id of [a, b, c]) {
    s = startWrite(s, env(), id, 'mud');
    s = step(s, env(), RULES.writeSeconds).state;
  }
  s = slotInto(s, a, 1);
  assert.equal(canCombine(s, env(), [a, b]).ok, false);
  assert.equal(canSlot(s, a, 2).ok, false);
  s = startCombine(s, env(), [b, c]);
  assert.equal(canSlot(s, b, 2).ok, false);
  assert.throws(() => slotInto(s, b, 2));
  s = unslot(s, a);
  assert.equal(s.cartridges.find((x) => x.id === a)!.slot, null);
  assert.equal(rackCount(s), 3); // jobs still count as racked
});

test('loadLab refuses mistyped fields and accepts a slotted, cataloguing lab', () => {
  let s = newLab();
  s = makeBlank(s, 100).state;
  const id = s.cartridges[0]!.id;
  s = startWrite(s, env(), id, 'mud');
  s = step(s, env(), RULES.writeSeconds).state;
  s = slotInto(s, id, 9);
  const json = JSON.parse(JSON.stringify(s));
  const good = loadLab(json);
  assert.deepEqual(good, s);
  assert.equal(loadLab({ ...s, time: 'now' }), null);
  assert.equal(loadLab({ ...s, nextId: 1.5 }), null);
  assert.equal(loadLab({ ...s, cartridges: 'rack' }), null);
  assert.equal(loadLab({ ...s, bench: { inputs: [], preset: null, done: -1, needs: 20 } }), null);
  assert.equal(loadLab({ ...s, combiner: { inputs: [], preset: null, done: 0, needs: 0 } }), null);
  assert.equal(loadLab([]), null);
  assert.equal(loadLab('lab'), null);
  assert.equal(loadLab(undefined), null);
});
