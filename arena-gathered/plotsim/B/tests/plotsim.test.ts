import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KINDS,
  GATE,
  STAGES,
  METRICS,
  ORE_CAP,
  newPlot,
  level,
  network,
  running,
  canPlace,
  place,
  remove,
  setOn,
  setCartridge,
  step,
  nextStage,
  loadPlot,
  type Env,
  type MachineKind,
  type PlotState,
} from '../src/index';

const env: Env = { gate: { x: 0, z: 0 }, plotRadius: 500, richness: () => 0.8 };
const poor: Env = { ...env, richness: () => 0.05 };
const run = (s: PlotState, seconds: number, e: Env = env) => {
  let st = s;
  const events: string[] = [];
  for (let t = 0; t < seconds; t++) {
    const r = step(st, e, 1);
    st = r.state;
    for (const ev of r.events) events.push(ev.type === 'stage-up' ? `stage-${ev.stage}` : ev.type);
  }
  return { s: st, events };
};

test('seven machines, unlocked in order, and a fresh plot', () => {
  assert.deepEqual(Object.keys(KINDS).sort(), ['drill', 'mill', 'power', 'press', 'projector', 'pylon', 'water']);
  assert.deepEqual([...METRICS], ['pxd', 'vtx', 'lx', 'aq']);
  assert.deepEqual(
    (['drill', 'mill', 'pylon', 'press', 'power', 'projector', 'water'] as MachineKind[]).map((k) => KINDS[k].unlock),
    [0, 0, 0, 1, 1, 2, 3],
  );
  assert.equal(KINDS.mill.emits, 'pxd');
  assert.equal(KINDS.press.emits, 'vtx');
  assert.equal(KINDS.projector.emits, 'lx');
  assert.equal(KINDS.water.emits, 'aq');
  assert.ok(KINDS.power.draw < 0 && KINDS.drill.mine > 0 && KINDS.pylon.reach > 0);
  assert.equal(STAGES.length, 7);
  const s = newPlot();
  assert.equal(s.ore, 60);
  assert.equal(s.stage, 0);
  assert.equal(s.machines.length, 0);
});

test('the first pixel machine lifts the plot to stage 1; building pays ore and says why it may not', () => {
  let s = newPlot();
  assert.equal(canPlace(s, env, 'press', 10, 0).ok, false, 'the press waits for stage 1');
  const locked = canPlace(s, env, 'press', 10, 0);
  assert.ok(!locked.ok && /stage/i.test(locked.why));
  const pad = canPlace(s, env, 'mill', 0.5, 0);
  assert.ok(!pad.ok && /gate/i.test(pad.why));
  const far = canPlace(s, env, 'mill', 90, 0);
  assert.ok(!far.ok && /reach|power|pylon/i.test(far.why));
  s = place(s, env, 'mill', 10, 0, 0);
  assert.equal(s.stage, 1);
  assert.equal(s.ore, 60 - KINDS.mill.cost);
  const close = canPlace(s, env, 'drill', 10.5, 0.5);
  assert.ok(!close.ok && /close|room|space/i.test(close.why));
  const dry = canPlace(s, poor, 'drill', 0, 12);
  assert.ok(!dry.ok && /ore/i.test(dry.why));
  const id = s.machines[0]!.id;
  const back = remove(s, id);
  assert.equal(back.ore, s.ore + Math.floor(KINDS.mill.cost / 2));
  assert.equal(back.stage, 1, 'a plot never loses its stage');
});

test('power: the gate reaches so far and supplies so much; pylons carry it on; power units add to it', () => {
  let s = newPlot();
  s = { ...s, ore: 10000 };
  s = place(s, env, 'mill', 10, 0, 0);
  const n0 = network(s, env);
  assert.ok(n0.connected.has(s.machines[0]!.id));
  assert.equal(n0.supply, GATE.supply);
  // a pylon at the edge of the gate's reach carries power further out
  const edge = GATE.reach - 2;
  s = place(s, env, 'pylon', 0, edge, 0);
  const out = edge + KINDS.pylon.reach - 3;
  assert.ok(canPlace(s, env, 'drill', 0, out).ok, "within the pylon's reach");
  s = place(s, env, 'drill', 0, out, 0);
  assert.ok(network(s, env).connected.has(s.machines[2]!.id));
  // more demand than the gate supplies: everything slows; a power unit restores it
  s = { ...s, stage: 1 };
  for (const [x, z] of [
    [-10, 0],
    [0, -10],
    [8, 8],
  ] as const)
    s = place(s, env, 'press', x, z, 0);
  const tight = network(s, env);
  assert.ok(tight.demand > tight.supply && tight.satisfaction < 1);
  s = place(s, env, 'power', -8, -8, 0);
  assert.ok(network(s, env).supply > tight.supply);
});

test('ore: drills fill the stock, machines empty it, it never goes below zero, starved machines slow down', () => {
  let s = place(newPlot(), env, 'mill', 10, 0, 0);
  const starve = run({ ...s, ore: 0 }, 30);
  assert.equal(starve.s.ore, 0);
  assert.equal(running(starve.s, env).get(starve.s.machines[0]!.id), 0, 'no ore, no milling');
  assert.ok(starve.events.includes('ore-out'));
  s = place({ ...s, ore: 100 }, env, 'drill', -10, 0, 0);
  const fed = run({ ...s, ore: 0 }, 120);
  assert.ok(level(fed.s, 'pxd') > 0, 'the drill feeds the mill');
  const richer = run(s, 120);
  const poorer = run(s, 120, poor);
  assert.ok(richer.s.ore > poorer.s.ore, 'rich ground mines faster');
});

test('metrics rise only from running pixel machines, with diminishing returns, and stages follow them', () => {
  let s = place(newPlot(), env, 'mill', 10, 0, 0);
  s = { ...s, ore: 5000 };
  const a = run(s, 600).s;
  const b = run(s, 2400).s;
  assert.ok(level(a, 'pxd') > 0 && level(a, 'vtx') === 0 && level(a, 'lx') === 0);
  assert.ok(level(b, 'pxd') < 4 * level(a, 'pxd') + 1e-9, 'four times the time is at most four times the level');
  assert.ok(level(b, 'pxd') >= 1.9 * level(a, 'pxd') - 1e-9, 'diminishing, not stalling (sqrt)');
  assert.equal(nextStage(a)!.stage, 2);
  assert.ok(nextStage(a)!.progress < 1 && Object.keys(nextStage(a)!.needs).sort().join() === 'pxd,vtx');
  for (const m of METRICS) assert.ok(level(b, m) <= 100);
});

test('saves round-trip, junk is refused, and the same inputs give the same plot', () => {
  let s = place(newPlot(), env, 'mill', 10, 0, 0);
  s = run(s, 300).s;
  assert.deepEqual(loadPlot(JSON.parse(JSON.stringify(s))), s);
  assert.deepEqual(loadPlot(null), newPlot());
  assert.deepEqual(loadPlot({ v: 1, ore: 'lots', machines: [{ kind: 'chimney' }] }).machines, []);
  assert.deepEqual(run(s, 200).s, run(s, 200).s);
  const big = step(s, env, 5).state;
  const small = run(s, 5).s;
  assert.ok(
    Math.abs(big.ore - small.ore) < 1e-6 && Math.abs(level(big, 'pxd') - level(small, 'pxd')) < 1e-6,
    'a 5 s step equals five 1 s steps',
  );
});

test('pacing: a plain player reaches stage 2 in minutes and stage 6 in a few hours', () => {
  // the reference player: every 15 s of game time it builds the next machine on its list as soon as it may, at the first free spot on rings round the gate
  const WISH: MachineKind[] = [
    'mill', 'drill', 'drill', 'press', 'power', 'drill', 'mill', 'press', 'pylon', 'projector', 'power', 'drill',
    'mill', 'press', 'projector', 'pylon', 'water', 'power', 'drill', 'water', 'mill', 'press', 'projector', 'water',
    'power', 'pylon', 'drill', 'mill', 'press', 'projector', 'water', 'power',
  ];
  let s = newPlot();
  let wish = 0;
  const reached: number[] = [];
  for (let t = 0; t < 5 * 3600 && s.stage < 6; t++) {
    if (t % 15 === 0 && wish < WISH.length) {
      const kind = WISH[wish]!;
      found: for (let ring = 8; ring <= 220; ring += 7)
        for (let deg = 0; deg < 360; deg += 15) {
          const x = Math.cos((deg * Math.PI) / 180) * ring;
          const z = Math.sin((deg * Math.PI) / 180) * ring;
          if (canPlace(s, env, kind, x, z).ok) {
            s = place(s, env, kind, x, z, 0);
            wish++;
            break found;
          }
        }
    }
    const r = step(s, env, 1);
    s = r.state;
    for (const e of r.events) if (e.type === 'stage-up') reached[e.stage] = s.time;
  }
  const at = (n: number) => reached[n] ?? Infinity;
  assert.ok(at(2) >= 300 && at(2) <= 900, `stage 2 at ${at(2)} s (5 to 15 min)`);
  assert.ok(at(3) >= 900 && at(3) <= 2400, `stage 3 at ${at(3)} s (15 to 40 min)`);
  assert.ok(at(4) >= 1800 && at(4) <= 4800, `stage 4 at ${at(4)} s (30 to 80 min)`);
  assert.ok(at(6) >= 9000 && at(6) <= 18000, `stage 6 at ${at(6)} s (2.5 to 5 h)`);
});

// ---------------------------------------------------------------------------
// Additional tests
// ---------------------------------------------------------------------------

test('every refusal reason is explained in plain words', () => {
  let s = newPlot();
  // unlocked
  const locked = canPlace(s, env, 'power', 20, 0);
  assert.ok(!locked.ok && /stage/i.test(locked.why));
  // outside the plot
  const small: Env = { ...env, plotRadius: 50 };
  const outside = canPlace(s, small, 'mill', 100, 0);
  assert.ok(!outside.ok && /outside|plot/i.test(outside.why));
  // too close to the gate
  const pad = canPlace(s, env, 'drill', 1, 0);
  assert.ok(!pad.ok && /gate/i.test(pad.why));
  // room: too close to another machine
  s = place(s, env, 'mill', 10, 0, 0);
  const room = canPlace(s, env, 'drill', 11, 0);
  assert.ok(!room.ok && /close|room|space/i.test(room.why));
  // out of reach of the power network
  const farAway: Env = { ...env, plotRadius: 500 };
  const farCheck = canPlace(s, farAway, 'drill', 200, 0);
  assert.ok(!farCheck.ok && /reach|power|pylon/i.test(farCheck.why));
  // not enough ore in the ground
  const dryGround = canPlace(s, poor, 'drill', -10, 0);
  assert.ok(!dryGround.ok && /ore/i.test(dryGround.why));
  // not enough ore to pay
  const poorPlot: PlotState = { ...s, ore: 1 };
  const cost = canPlace(poorPlot, env, 'drill', -10, 0);
  assert.ok(!cost.ok && /needs|ore/i.test(cost.why) && /1/.test(cost.why));
  // placing when nothing is wrong works
  assert.equal(canPlace(s, env, 'drill', -10, 0).ok, true);
});

test('a chain of pylons carries power past several hops', () => {
  let s = { ...newPlot(), ore: 10000 };
  const hop = KINDS.pylon.reach - 5;
  let x = hop;
  let prevId: number | null = null;
  for (let i = 0; i < 4; i++) {
    s = place(s, env, 'pylon', x, 0, 0);
    prevId = s.machines[s.machines.length - 1]!.id;
    x += hop;
  }
  assert.ok(prevId !== null);
  // place a mill (needs stage 0, fine) right past the last pylon
  const tip = x - hop + KINDS.pylon.reach - 5;
  assert.ok(canPlace(s, env, 'mill', tip, 0).ok, 'reached through the whole chain');
  s = place(s, env, 'mill', tip, 0, 0);
  const net = network(s, env);
  assert.ok(net.connected.has(s.machines[s.machines.length - 1]!.id));
  // far beyond the chain's reach, nothing connects
  assert.equal(canPlace(s, env, 'mill', tip + 200, 0).ok, false);
});

test('a power unit with no ore in reach runs at zero and recovers once ore returns', () => {
  let s = { ...newPlot(), ore: 100, stage: 1 };
  s = place(s, env, 'power', 10, 0, 0);
  s = place(s, env, 'mill', -10, 0, 0);
  const powerId = s.machines[0]!.id;
  const millId = s.machines[1]!.id;
  // drain the little ore there is with no drill to replace it
  const r1 = run({ ...s, ore: 0 }, 5);
  assert.equal(running(r1.s, env).get(powerId), 0, 'no ore, the power unit sits idle');
  assert.equal(running(r1.s, env).get(millId), 0, 'no ore, the mill cannot grind either');
  assert.ok(r1.events.includes('ore-out'), 'starved of ore, even though the gate has plenty of spare kW');
  // feed it: with ore available the power unit runs
  const r2 = run({ ...s, ore: 500 }, 5);
  assert.ok((running(r2.s, env).get(powerId) ?? 0) > 0, 'ore available: the power unit runs');
});

test('cartridges scale a pixel machine output by their affinity', () => {
  const affEnv: Env = { ...env, affinity: (cartridge, metric) => (cartridge === 'hot' && metric === 'pxd' ? 2 : 1) };
  let s = place({ ...newPlot(), ore: 1000 }, affEnv, 'mill', 10, 0, 0);
  const id = s.machines[0]!.id;
  const plain = run(s, 60, affEnv).s;
  s = setCartridge(s, id, 'hot');
  const boosted = run(s, 60, affEnv).s;
  assert.ok(boosted.points.pxd > plain.points.pxd * 1.9, 'the cartridge doubles the points earned');
  assert.ok(level(boosted, 'pxd') > level(plain, 'pxd'), 'and so the level climbs faster');
  // a machine without a cartridge slot refuses one
  const pylonPlot = place({ ...newPlot(), ore: 1000 }, affEnv, 'pylon', 10, 0, 0);
  assert.throws(() => setCartridge(pylonPlot, pylonPlot.machines[0]!.id, 'x'));
});

test('warnings fire once and only fire again after recovering', () => {
  let s = { ...newPlot(), ore: 10000, stage: 1 };
  for (const [x, z] of [
    [10, 0],
    [-10, 0],
    [0, 10],
    [0, -10],
  ] as const)
    s = place(s, env, 'press', x, z, 0);
  const a = run(s, 10);
  const firstCount = a.events.filter((e) => e === 'underpowered').length;
  assert.equal(firstCount, 1, 'only warns once while it stays underpowered');
  // add a power unit: satisfaction recovers to 1
  let s2 = place(a.s, env, 'power', 8, 8, 0);
  const b = run(s2, 10);
  assert.equal(b.events.filter((e) => e === 'underpowered').length, 0, 'healthy now, no warning');
  // remove it again: should warn once more after recovering
  const id = s2.machines.find((m) => m.kind === 'power')!.id;
  const s3 = remove(b.s, id);
  const c = run(s3, 10);
  assert.equal(c.events.filter((e) => e === 'underpowered').length, 1, 'warns again after recovering and relapsing');
});

test('determinism: identical state and env always produce identical results', () => {
  let s = place({ ...newPlot(), ore: 500 }, env, 'mill', 10, 0, 0);
  s = place(s, env, 'drill', -10, 0, 0);
  const r1 = step(s, env, 37);
  const r2 = step(s, env, 37);
  assert.deepEqual(r1, r2);
});

test('setOn turns a machine off and it stops drawing and emitting', () => {
  let s = place({ ...newPlot(), ore: 500 }, env, 'mill', 10, 0, 0);
  const id = s.machines[0]!.id;
  s = setOn(s, id, false);
  assert.equal(running(s, env).get(id), 0);
  const r = run(s, 30);
  assert.equal(level(r.s, 'pxd'), 0);
});

test('the plot never loses ore stock below zero nor points, and caps at ORE_CAP', () => {
  let s = { ...newPlot(), ore: ORE_CAP + 500 };
  s = loadPlot(JSON.parse(JSON.stringify(s)));
  assert.ok(s.ore <= ORE_CAP);
  const r = run({ ...newPlot(), ore: 0 }, 5);
  assert.ok(r.s.ore >= 0);
});
