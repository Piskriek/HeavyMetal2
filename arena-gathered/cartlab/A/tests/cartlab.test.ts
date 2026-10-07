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

// ---------------------------------------------------------------------------
// Our own tests: refusal order and sentences, ids, the mixing maths, power cuts,
// the rack cap, saves, and purity.
// ---------------------------------------------------------------------------

type Lab = ReturnType<typeof newLab>;
type Ev = ReturnType<typeof step>['events'][number];

// Two more presets: Glow lifts light a lot and costs water; Murk spoils texture.
const P2: Preset[] = [
  ...P,
  { id: 'glow', name: 'Glow', affinity: { lx: 2.6, aq: 0.7 }, minStage: 0 },
  { id: 'murk', name: 'Murk', affinity: { pxd: 0.4, aq: 1.2 }, minStage: 0 },
];
const env2 = (o: Partial<LabEnv> = {}): LabEnv => env({ presets: P2, ...o });

const cart = (s: Lab, id: string) => {
  const c = s.cartridges.find((x) => x.id === id);
  assert.ok(c, `no cartridge ${id}`);
  return c;
};

/** Makes a blank, writes `preset` on it and runs the bench to the end. */
const written = (s: Lab, preset: string): { s: Lab; id: string } => {
  const id = `c${s.nextId}`;
  const made = makeBlank(s, RULES.blankCost).state;
  return { s: step(startWrite(made, env2(), id, preset), env2(), RULES.writeSeconds).state, id };
};

/** Writes each preset onto a fresh blank, in order. */
const writeAll = (s: Lab, presets: readonly string[]): { s: Lab; ids: string[] } => {
  let lab = s;
  const ids: string[] = [];
  for (const p of presets) {
    const w = written(lab, p);
    lab = w.s;
    ids.push(w.id);
  }
  return { s: lab, ids };
};

/** Combines `ids` and runs the combiner to the end; the mix takes the next id. */
const mixed = (s: Lab, ids: readonly string[]) => {
  const id = `c${s.nextId}`;
  const lab = step(startCombine(s, env2(), ids), env2(), RULES.combineSeconds).state;
  return { s: lab, mix: cart(lab, id) };
};

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

/** A refusal is one plain sentence: a capital, no line breaks, one full stop at the end. */
const sentence = (why: string) => assert.match(why, /^[A-Z][^.\n]*\.$/);

test('RULES and METRICS hold the published numbers', () => {
  assert.deepEqual(METRICS, ['pxd', 'vtx', 'lx', 'aq']);
  assert.deepEqual({ ...RULES }, { blankCost: 12, rackSize: 48, writeSeconds: 20, combineSeconds: 45, catalogueSeconds: 2, minInputs: 2, maxInputs: 4 });
});

test('a new lab is empty and idle, and its save loads back', () => {
  const s = newLab();
  assert.deepEqual(s, { v: 1, time: 0, nextId: 1, cartridges: [], bench: null, combiner: null, catalogueUntil: 0 });
  assert.deepEqual(loadLab(JSON.parse(JSON.stringify(s))), s);
  assert.equal(canMakeBlank(s, Number.NaN).ok, false); // nonsense ore is not enough ore
});

test('ids run c1, c2, ... in the order made; a mix takes its id when it is finished', () => {
  const { s: lab, ids } = writeAll(newLab(), ['mud', 'terrain']);
  assert.deepEqual(lab.cartridges.map((c) => c.id), ['c1', 'c2']);
  let s = startCombine(lab, env2(), ids);
  s = makeBlank(s, 100).state; // c3, made while the combiner works
  assert.equal(rackCount(s), 3); // cartridges in a lab job still sit on the rack
  const r = step(s, env2(), RULES.combineSeconds);
  assert.deepEqual(r.events, [{ type: 'combined', id: 'c4' }]);
  assert.deepEqual(r.state.cartridges.map((c) => c.id), ['c3', 'c4']);
  assert.equal(r.state.nextId, 5);
  const mix = cart(r.state, 'c4');
  assert.equal(mix.kind, 'mix');
  assert.equal(mix.preset, null);
  assert.equal(mix.slot, null);
  assert.deepEqual(mix.from, ['c1', 'c2']);
});

test('a written cartridge carries every metric, 1 where its preset says nothing', () => {
  const { s, ids } = writeAll(newLab(), ['terrain']);
  const c = cart(s, ids[0]!);
  assert.deepEqual(c.affinity, { pxd: 0.9, vtx: 1.5, lx: 1, aq: 1 });
  assert.deepEqual(c.from, []);
  assert.equal(c.slot, null);
  assert.equal(affinityOf(s, c.id, 'vtx'), 1.5); // its own affinity, in the rack or out in a machine
  assert.equal(affinityOf(s, c.id, 'aq'), 1);
});

test('canWrite refuses in the documented order, and startWrite throws the same sentence', () => {
  const { s: lab, ids } = writeAll(newLab(), ['mud']);
  const mud = ids[0]!;
  const s = makeBlank(lab, 100).state; // c2 is a blank
  const why = (st: Lab, e: LabEnv, id: string, p: string) => canWrite(st, e, id, p).why;
  // every refusal wins over all the ones after it
  assert.equal(why(s, env2({ powered: false }), 'nope', 'nope'), 'No power: turn the gate on.');
  assert.match(why(startWrite(s, env2(), 'c2', 'mud'), env2(), 'nope', 'nope'), /bench is busy/);
  assert.match(why(s, env2(), 'nope', 'nope'), /not in the lab/);
  assert.match(why(s, env2(), mud, 'nope'), /^Mud is not a blank/);
  assert.match(why(s, env2(), 'c2', 'nope'), /no such preset/);
  assert.equal(why(s, env2(), 'c2', 'sun'), 'That preset opens at stage 2.');
  assert.deepEqual(canWrite(s, env2(), 'c2', 'mud'), { ok: true, why: '' });
  assert.throws(() => startWrite(s, env2(), 'c2', 'sun'), { message: 'That preset opens at stage 2.' });
  for (const [id, p] of [['nope', 'nope'], [mud, 'nope'], ['c2', 'nope'], ['c2', 'sun']] as const) sentence(why(s, env2(), id, p));
});

test('canCombine refuses in the documented order, and startCombine throws the same sentence', () => {
  const { s: lab, ids } = writeAll(newLab(), ['mud', 'terrain', 'mud', 'glow', 'murk']);
  const [a, b, c, d, e] = ids as [string, string, string, string, string];
  const s = makeBlank(lab, 100).state;
  const blank = 'c6';
  const why = (st: Lab, xs: readonly string[], o: Partial<LabEnv> = {}) => canCombine(st, env2(o), xs).why;
  assert.equal(why(s, [a, a], { powered: false }), 'No power: turn the gate on.');
  assert.match(why(startCombine(s, env2(), [a, b]), [a]), /combiner is busy/);
  assert.match(why(s, []), /2 to 4/);
  assert.match(why(s, [a]), /2 to 4/);
  assert.match(why(s, [a, b, c, d, e]), /2 to 4/);
  assert.match(why(s, [a, b, a]), /only once/);
  assert.match(why(s, [blank, 'nope']), /not in the lab/); // an unknown id beats a blank
  assert.match(why(s, [a, blank]), /blank/);
  const out = slotInto(s, b, 1);
  assert.match(why(out, [blank, b]), /blank/); // a blank beats a cartridge out in a machine
  assert.equal(why(out, [a, b]), 'Terrain shaping is in a machine: take it out first.');
  assert.equal(canCombine(s, env2(), [a, b, c, d]).ok, true);
  assert.throws(() => startCombine(s, env2(), [a]), { message: why(s, [a]) });
  for (const xs of [[a], [a, a], [a, blank], [blank, 'nope']]) sentence(why(s, xs));
});

test('canSlot refuses an unknown id, a blank, one already out and one in a job', () => {
  const { s: lab, ids } = writeAll(newLab(), ['mud', 'terrain']);
  const [mud, terrain] = ids as [string, string];
  let s = makeBlank(lab, 100).state; // c3 is a blank
  assert.match(canSlot(s, 'nope', 1).why, /not in the lab/);
  assert.equal(canSlot(s, 'c3', 1).why, 'A blank does nothing: write a preset on it first.');
  s = slotInto(s, mud, 1);
  assert.match(canSlot(s, mud, 1).why, /already in a machine/); // even the same machine
  const busy = startCombine(unslot(s, mud), env2(), [mud, terrain]);
  assert.equal(canSlot(busy, terrain, 2).why, 'Terrain shaping is being mixed in the combiner.');
  assert.throws(() => slotInto(busy, terrain, 2), /combiner/);
  assert.equal(canSlot(s, terrain, Number.NaN).ok, false); // not a machine
  assert.deepEqual(canSlot(s, terrain, 2), { ok: true, why: '' });
});

test('unslot puts a cartridge back in the rack, and changes nothing when there is nothing to do', () => {
  const { s: lab, ids } = writeAll(newLab(), ['mud']);
  const id = ids[0]!;
  const s = slotInto(lab, id, 4);
  const back = unslot(s, id);
  assert.equal(cart(back, id).slot, null);
  assert.equal(cart(s, id).slot, 4); // the input is untouched
  assert.deepEqual(unslot(back, id), back);
  assert.deepEqual(unslot(back, 'nope'), back);
});

test('a full rack refuses new blanks, but a cartridge coming back from a machine always fits', () => {
  let s = slotInto(writeAll(newLab(), ['mud']).s, 'c1', 1);
  while (canMakeBlank(s, 1e9).ok) s = makeBlank(s, 1e9).state;
  assert.equal(rackCount(s), RULES.rackSize);
  assert.equal(s.cartridges.length, RULES.rackSize + 1);
  s = unslot(s, 'c1');
  assert.equal(rackCount(s), RULES.rackSize + 1);
  assert.equal(canMakeBlank(s, 1e9).why, 'The rack is full: 48 cartridges.');
  assert.equal(canMakeBlank(s, 0).why, 'Not enough ore: a blank costs 12.'); // ore is checked first
});

test('mixing maths: a bad input costs half, the order given only changes the name, results stay in [0.5, 3]', () => {
  const { s, ids } = writeAll(newLab(), ['mud', 'terrain', 'glow', 'glow', 'glow', 'murk', 'murk']);
  const [mud, terrain, g1, g2, g3, k1, k2] = ids as [string, string, string, string, string, string, string];

  // Mud + Terrain shaping: pxd 0.4 in full, Terrain's -0.1 at half = 0.35; vtx 0.5 in full
  const road = mixed(s, [mud, terrain]);
  near(road.mix.affinity.pxd, 1.35);
  near(road.mix.affinity.vtx, 1.5);
  assert.equal(road.mix.affinity.lx, 1);
  assert.equal(road.mix.name, 'Mud + Terrain shaping');
  assert.equal(affinityOf(road.s, road.mix.id, 'pxd'), road.mix.affinity.pxd);
  const turned = mixed(s, [terrain, mud]).mix;
  assert.equal(turned.name, 'Terrain shaping + Mud');
  assert.deepEqual(turned.affinity, road.mix.affinity);

  // three Glows: lx 1.6 + 0.8 + 0.8 = 3.2 is capped at 3; aq -0.3 - 0.15 - 0.15 = -0.6 is lifted to 0.5
  const bright = mixed(s, [g1, g2, g3]).mix;
  assert.equal(bright.affinity.lx, 3);
  assert.equal(bright.affinity.aq, 0.5);

  // two Murks: pxd -0.6 - 0.3 = -0.9 is lifted to 0.5; aq 0.2 + 0.1 = 0.3
  const swamp = mixed(s, [k1, k2]).mix;
  assert.equal(swamp.affinity.pxd, 0.5);
  near(swamp.affinity.aq, 1.3);

  // a mix can be mixed again: (Mud + Terrain shaping) + Glow
  const again = mixed(road.s, [road.mix.id, g1]).mix;
  assert.equal(again.name, 'Mud + Terrain shaping + Glow');
  assert.deepEqual(again.from, [road.mix.id, g1]);
  near(again.affinity.lx, 2.6); // Glow's 1.6 in full, the road's 0 at half
  near(again.affinity.pxd, 1.35); // the road's 0.35 in full, Glow's 0 at half
  near(again.affinity.aq, 0.85); // the road's 0 in full, Glow's -0.3 at half
});

test('a power cut pauses both machines and reports each stall once, then again only after they have run', () => {
  const { s: lab, ids } = writeAll(newLab(), ['mud', 'terrain']);
  let s = makeBlank(lab, 100).state; // c3
  s = startCombine(startWrite(s, env2(), 'c3', 'glow'), env2(), ids);
  const off = env2({ powered: false });
  const on = env2();
  const seen: Ev[][] = [];
  for (const [e, dt] of [[off, 1], [off, 1], [on, 1], [off, 1], [off, 5]] as const) {
    const r = step(s, e, dt);
    s = r.state;
    seen.push([...r.events]);
  }
  const stalls: Ev[] = [{ type: 'stalled', machine: 'bench' }, { type: 'stalled', machine: 'combiner' }];
  assert.deepEqual(seen, [stalls, [], [], stalls, []]);
  assert.equal(s.time, 2 * RULES.writeSeconds + 9); // time runs on without power...
  assert.equal(s.bench?.done, 1); // ...but only the powered second counts
  assert.equal(s.combiner?.done, 1);
  assert.equal(cart(s, 'c3').kind, 'blank');
  assert.deepEqual(loadLab(JSON.parse(JSON.stringify(s))), s); // a paused lab saves and loads
  const r = step(s, on, 100);
  assert.deepEqual(r.events, [{ type: 'written', id: 'c3' }, { type: 'combined', id: 'c4' }]);
  assert.deepEqual(step(r.state, off, 1).events, []); // nothing left to stall
});

test('finishing a mix sets the indexer glowing, like making a blank does', () => {
  const { s: lab, ids } = writeAll(newLab(), ['mud', 'terrain']);
  let s = startCombine(lab, env2(), ids);
  assert.deepEqual(activity(s, env2()), { bench: 0, combiner: 1, rack: 0 });
  assert.deepEqual(activity(s, env2({ powered: false })), { bench: 0, combiner: 0, rack: 0 });
  s = step(s, env2(), RULES.combineSeconds).state;
  assert.equal(s.catalogueUntil, s.time + RULES.catalogueSeconds);
  assert.deepEqual(activity(s, env2()), { bench: 0, combiner: 0, rack: 1 });
  s = step(s, env2(), RULES.catalogueSeconds).state;
  assert.equal(activity(s, env2()).rack, 0);
});

test('a write whose preset has gone from env.presets waits at the finish line instead of failing', () => {
  const s = startWrite(makeBlank(newLab(), 100).state, env2(), 'c1', 'glow');
  let r = step(s, env(), 60); // env() lists no Glow
  assert.deepEqual(r.events, []);
  assert.equal(r.state.bench?.done, RULES.writeSeconds);
  assert.equal(cart(r.state, 'c1').kind, 'blank');
  r = step(r.state, env2(), 0);
  assert.deepEqual(r.events, [{ type: 'written', id: 'c1' }]);
  assert.equal(cart(r.state, 'c1').name, 'Glow');
});

test('time runs with or without power, an idle lab reports nothing, and a nonsense dt counts as zero', () => {
  const s = makeBlank(newLab(), 100).state;
  const r = step(s, env({ powered: false }), 10);
  assert.equal(r.state.time, 10);
  assert.deepEqual(r.events, []);
  for (const dt of [-5, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(step(s, env(), dt).state.time, 0);
});

test('loadLab keeps a busy lab exactly, and refuses every kind of junk and impossible lab', () => {
  const { s: lab, ids } = writeAll(newLab(), ['mud', 'terrain', 'glow']);
  let good = makeBlank(slotInto(lab, ids[0]!, 2), 100).state; // c1 out in machine 2, c4 a blank
  good = startCombine(startWrite(good, env2(), 'c4', 'mud'), env2(), ['c2', 'c3']);
  good = step(good, env2(), 3).state;
  assert.deepEqual(loadLab(JSON.parse(JSON.stringify(good))), good);
  // unknown keys are dropped, and so is a stalled flag that says false
  assert.deepEqual(loadLab({ ...good, extra: 1, combiner: { ...good.combiner, stalled: false } }), good);

  const withCartridge = (i: number, patch: object) => ({ ...good, cartridges: good.cartridges.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const junk: unknown[] = [
    undefined, 42, 'lab', [], {},
    { ...good, v: 2 },
    { ...good, time: -1 },
    { ...good, time: Number.NaN },
    { ...good, time: '63' },
    { ...good, nextId: 2 }, // c2 to c4 would be handed out again
    { ...good, nextId: 4.5 },
    { ...good, catalogueUntil: null },
    { ...good, cartridges: {} },
    JSON.parse(JSON.stringify({ ...good, bench: undefined })), // a missing field
    withCartridge(0, { id: 'x1' }),
    withCartridge(0, { name: 7 }),
    withCartridge(0, { kind: 'gold' }),
    withCartridge(0, { preset: null }), // a written cartridge names its preset
    withCartridge(0, { from: [1] }),
    withCartridge(0, { affinity: { pxd: 1.4, vtx: 1, lx: 1 } }), // a metric missing
    withCartridge(0, { slot: '2' }),
    withCartridge(3, { slot: 1 }), // a blank in a machine
    withCartridge(3, { affinity: { pxd: 2, vtx: 1, lx: 1, aq: 1 } }), // a blank that does something
    withCartridge(1, { slot: 5 }), // in the combiner and in a machine at once
    { ...good, bench: { ...good.bench, inputs: ['c1'] } }, // the bench writing on a written cartridge
    { ...good, bench: { ...good.bench, inputs: ['c4', 'c4'] } },
    { ...good, bench: { ...good.bench, preset: null } },
    { ...good, bench: { ...good.bench, done: -1 } },
    { ...good, combiner: { ...good.combiner, inputs: ['c2'] } },
    { ...good, combiner: { ...good.combiner, inputs: ['c2', 'c2'] } },
    { ...good, combiner: { ...good.combiner, inputs: ['c2', 'c4'] } }, // a blank in the combiner
    { ...good, combiner: { ...good.combiner, preset: 'mud' } },
    { ...good, combiner: { ...good.combiner, stalled: 'yes' } },
  ];
  junk.forEach((j, i) => assert.equal(loadLab(j), null, `junk #${i} was accepted`));
});

test('every function leaves its input alone, even a deep-frozen one', () => {
  const freezeAll = (x: unknown): void => {
    if (typeof x !== 'object' || x === null) return;
    for (const v of Object.values(x) as unknown[]) freezeAll(v);
    Object.freeze(x);
  };
  const e: LabEnv = { presets: P2.map((p) => ({ ...p, affinity: { ...p.affinity } })), stage: 1, powered: true };
  freezeAll(e);
  // a busy lab: c1 out in a machine, c4 on the bench, c2 + c3 in the combiner
  const { s: lab, ids } = writeAll(newLab(), ['mud', 'terrain', 'glow']);
  let s = makeBlank(slotInto(lab, ids[0]!, 2), 100).state;
  s = startCombine(startWrite(s, e, 'c4', 'mud'), e, ['c2', 'c3']);
  const before = JSON.stringify(s);
  freezeAll(s);
  rackCount(s);
  canMakeBlank(s, 100);
  makeBlank(s, 100);
  canWrite(s, e, 'c4', 'mud');
  canCombine(s, e, ['c2', 'c3']);
  canSlot(s, 'c2', 1);
  unslot(s, 'c1');
  activity(s, e);
  affinityOf(s, 'c1', 'pxd');
  step(s, e, 1);
  step(s, { ...e, powered: false }, 1);
  const done = step(s, e, 100).state; // the write and the mix both finish
  freezeAll(done);
  startCombine(done, e, ['c4', 'c5']);
  slotInto(done, 'c4', 3);
  startWrite(makeBlank(done, 100).state, e, 'c6', 'glow');
  const save: unknown = JSON.parse(before);
  freezeAll(save);
  assert.ok(loadLab(save));
  assert.equal(JSON.stringify(s), before);
});
