import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, GATE, STAGES, METRICS, newPlot, level, network, running, canPlace, place, remove, step, nextStage, loadPlot, type Env, type MachineKind, type PlotState } from '../src/index';

const env: Env = { gate: { x: 0, z: 0 }, plotRadius: 500, richness: () => 0.8 };
const poor: Env = { ...env, richness: () => 0.05 };
const run = (s: PlotState, seconds: number, e: Env = env) => { let st = s; const events: string[] = []; for (let t = 0; t < seconds; t++) { const r = step(st, e, 1); st = r.state; for (const ev of r.events) events.push(ev.type === 'stage-up' ? `stage-${ev.stage}` : ev.type); } return { s: st, events }; };

test('seven machines, unlocked in order, and a fresh plot', () => {
  assert.deepEqual(Object.keys(KINDS).sort(), ['drill', 'mill', 'power', 'press', 'projector', 'pylon', 'water']);
  assert.deepEqual([...METRICS], ['pxd', 'vtx', 'lx', 'aq']);
  assert.deepEqual((['drill', 'mill', 'pylon', 'press', 'power', 'projector', 'water'] as MachineKind[]).map((k) => KINDS[k].unlock), [0, 0, 0, 1, 1, 2, 3]);
  assert.equal(KINDS.mill.emits, 'pxd'); assert.equal(KINDS.press.emits, 'vtx'); assert.equal(KINDS.projector.emits, 'lx'); assert.equal(KINDS.water.emits, 'aq');
  assert.ok(KINDS.power.draw < 0 && KINDS.drill.mine > 0 && KINDS.pylon.reach > 0);
  assert.equal(STAGES.length, 7);
  const s = newPlot();
  assert.equal(s.ore, 60); assert.equal(s.stage, 0); assert.equal(s.machines.length, 0);
});

test('the first pixel machine lifts the plot to stage 1; building pays ore and says why it may not', () => {
  let s = newPlot();
  assert.equal(canPlace(s, env, 'press', 10, 0).ok, false, 'the press waits for stage 1');
  const locked = canPlace(s, env, 'press', 10, 0); assert.ok(!locked.ok && /stage/i.test(locked.why));
  const pad = canPlace(s, env, 'mill', 0.5, 0); assert.ok(!pad.ok && /gate/i.test(pad.why));
  const far = canPlace(s, env, 'mill', 90, 0); assert.ok(!far.ok && /reach|power|pylon/i.test(far.why));
  s = place(s, env, 'mill', 10, 0, 0);
  assert.equal(s.stage, 1);
  assert.equal(s.ore, 60 - KINDS.mill.cost);
  const close = canPlace(s, env, 'drill', 10.5, 0.5); assert.ok(!close.ok && /close|room|space/i.test(close.why));
  const dry = canPlace(s, poor, 'drill', 0, 12); assert.ok(!dry.ok && /ore/i.test(dry.why));
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
  assert.ok(canPlace(s, env, 'drill', 0, out).ok, 'within the pylon\'s reach');
  s = place(s, env, 'drill', 0, out, 0);
  assert.ok(network(s, env).connected.has(s.machines[2]!.id));
  // more demand than the gate supplies: everything slows; a power unit restores it
  s = { ...s, stage: 1 };
  for (const [x, z] of [[-10, 0], [0, -10], [8, 8]] as const) s = place(s, env, 'press', x, z, 0);
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
  const richer = run(s, 120), poorer = run(s, 120, poor);
  assert.ok(richer.s.ore > poorer.s.ore, 'rich ground mines faster');
});

test('metrics rise only from running pixel machines, with diminishing returns, and stages follow them', () => {
  let s = place(newPlot(), env, 'mill', 10, 0, 0);
  s = { ...s, ore: 5000 };
  const a = run(s, 600).s, b = run(s, 2400).s;
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
  const big = step(s, env, 5).state, small = run(s, 5).s;
  assert.ok(Math.abs(big.ore - small.ore) < 1e-6 && Math.abs(level(big, 'pxd') - level(small, 'pxd')) < 1e-6, 'a 5 s step equals five 1 s steps');
});

test('pacing: a plain player reaches stage 2 in minutes and stage 6 in a few hours', () => {
  // the reference player: every 15 s of game time it builds the next machine on its list as soon as it may, at the first free spot on rings round the gate
  const WISH: MachineKind[] = ['mill', 'drill', 'drill', 'press', 'power', 'drill', 'mill', 'press', 'pylon', 'projector', 'power', 'drill', 'mill', 'press', 'projector', 'pylon', 'water', 'power', 'drill', 'water', 'mill', 'press', 'projector', 'water', 'power', 'pylon', 'drill', 'mill', 'press', 'projector', 'water', 'power'];
  let s = newPlot(), wish = 0;
  const reached: number[] = [];
  for (let t = 0; t < 5 * 3600 && s.stage < 6; t++) {
    if (t % 15 === 0 && wish < WISH.length) {
      const kind = WISH[wish]!;
      found: for (let ring = 8; ring <= 220; ring += 7) for (let deg = 0; deg < 360; deg += 15) {
        const x = Math.cos((deg * Math.PI) / 180) * ring, z = Math.sin((deg * Math.PI) / 180) * ring;
        if (canPlace(s, env, kind, x, z).ok) { s = place(s, env, kind, x, z, 0); wish++; break found; }
      }
    }
    const r = step(s, env, 1); s = r.state;
    for (const e of r.events) if (e.type === 'stage-up') reached[e.stage] = s.time;
  }
  const at = (n: number) => reached[n] ?? Infinity;
  assert.ok(at(2) >= 300 && at(2) <= 900, `stage 2 at ${at(2)} s (5 to 15 min)`);
  assert.ok(at(3) >= 900 && at(3) <= 2400, `stage 3 at ${at(3)} s (15 to 40 min)`);
  assert.ok(at(4) >= 1800 && at(4) <= 4800, `stage 4 at ${at(4)} s (30 to 80 min)`);
  assert.ok(at(6) >= 9000 && at(6) <= 18000, `stage 6 at ${at(6)} s (2.5 to 5 h)`);
});
