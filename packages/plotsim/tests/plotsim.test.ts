import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, GATE, STAGES, METRICS, newPlot, level, network, running, canPlace, place, remove, step, nextStage, loadPlot, type Env, type MachineKind, type PlotState, HEAVY_KINDS } from '../src/index';

const env: Env = { gate: { x: 0, z: 0 }, plotRadius: 500, richness: () => 0.8 };
const poor: Env = { ...env, richness: () => 0.05 };
const run = (s: PlotState, seconds: number, e: Env = env) => { let st = s; const events: string[] = []; for (let t = 0; t < seconds; t++) { const r = step(st, e, 1); st = r.state; for (const ev of r.events) events.push(ev.type === 'stage-up' ? `stage-${ev.stage}` : ev.type); } return { s: st, events }; };

test('seven machines, unlocked in order, and a fresh plot', () => {
  // the seven field machines, plus the four heavy kinds the base installs (D3; tests/plotsim-heavy.test.ts)
  assert.deepEqual(Object.keys(KINDS).sort(), ['drill', 'heavy-mill', 'heavy-press', 'heavy-projector', 'heavy-water', 'mill', 'power', 'press', 'projector', 'pylon', 'water']);
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

// =============================================================================================
// My own tests
// =============================================================================================

import { MACHINE_KINDS, MIN_RICHNESS, ORE_CAP, TARGET, rates, setCartridge, setOn } from '../src/index';

const idOf = (s: PlotState, i: number): number => s.machines[i]!.id;
const why = (r: ReturnType<typeof canPlace>): string => (r.ok ? 'ok' : r.why);
const count = (events: readonly string[], name: string): number => events.filter((e) => e === name).length;
const deepFreeze = <T>(o: T): T => {
  if (typeof o === 'object' && o !== null) { Object.freeze(o); for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v); }
  return o;
};

test('the numbers keep to the sizes the design asks for', () => {
  assert.deepEqual([...MACHINE_KINDS, ...HEAVY_KINDS].sort(), Object.keys(KINDS).sort());
  for (const k of MACHINE_KINDS) {
    const spec = KINDS[k];
    assert.equal(spec.kind, k);
    assert.ok(spec.cost >= 10 && spec.cost <= 120 && Number.isInteger(spec.cost), `${k} cost`);
    assert.ok(spec.radius >= 1 && spec.radius <= 2.5, `${k} radius`);
    if (spec.draw > 0) assert.ok(spec.draw >= 2 && spec.draw <= 10, `${k} draw`);
    if (spec.reach > 0) assert.ok(spec.reach >= 25 && spec.reach <= 45, `${k} reach`);
    assert.equal(spec.slot, spec.emits !== null, 'exactly the pixel machines take a cartridge');
    assert.equal(spec.mine > 0, k === 'drill');
    assert.equal(spec.reach > 0, k === 'pylon' || k === 'power');
  }
  assert.ok(GATE.supply >= 10 && GATE.supply <= 15 && GATE.reach >= 25 && GATE.reach <= 45 && GATE.pad > 0);
  assert.ok(KINDS.mill.cost + KINDS.drill.cost <= 60, 'the first 60 ore buy a mill and a drill');
  assert.ok(KINDS.drill.mine * 0.8 > KINDS.mill.oreUse, 'one drill on good ground mines more than one mill uses');
  assert.ok(KINDS.mill.draw + 2 * KINDS.drill.draw <= GATE.supply, 'the gate runs a mill and two drills');
  assert.ok(KINDS.mill.draw + 2 * KINDS.drill.draw + KINDS.press.draw > GATE.supply, 'but not much more: power units matter early');
  assert.equal(KINDS.projector.draw, Math.max(...MACHINE_KINDS.map((k) => KINDS[k].draw)), 'the projector draws the most');
  assert.equal(KINDS.pylon.draw, 0); assert.equal(KINDS.pylon.oreUse, 0); assert.equal(KINDS.drill.oreUse, 0);
  assert.ok(KINDS.power.oreUse > 0, 'a power unit burns ore');
  assert.ok(ORE_CAP >= 5000);
  // stages ask for more as they go, and the last asks for everything
  for (let n = 3; n <= 6; n++) for (const m of METRICS) assert.ok((STAGES[n]![m] ?? 0) >= (STAGES[n - 1]![m] ?? 0), `stage ${n} ${m}`);
  assert.deepEqual(STAGES[6], { pxd: 100, vtx: 100, lx: 100, aq: 100 });
});

test('every refusal says why, in the order the rules are checked', () => {
  const fresh = newPlot();
  assert.equal(why(canPlace(fresh, env, 'press', 10, 0)), 'Unlocks at stage 1.');
  assert.equal(why(canPlace(fresh, env, 'power', 10, 0)), 'Unlocks at stage 1.');
  assert.equal(why(canPlace(fresh, env, 'projector', 10, 0)), 'Unlocks at stage 2.');
  assert.equal(why(canPlace(fresh, env, 'water', 10, 0)), 'Unlocks at stage 3.');
  assert.equal(why(canPlace(fresh, env, 'water', 9999, 0)), 'Unlocks at stage 3.', 'the lock comes first');
  // the plot's edge comes before the gate's pad
  assert.equal(why(canPlace(fresh, { ...env, plotRadius: 3 }, 'mill', 4, 0)), 'Outside your plot.');
  assert.equal(why(canPlace(fresh, env, 'mill', 0, 501)), 'Outside your plot.');
  assert.equal(why(canPlace(fresh, env, 'mill', Number.NaN, 0)), 'Outside your plot.');
  // the gate's pad counts the machine's own radius
  const padEdge = GATE.pad + KINDS.mill.radius;
  assert.equal(why(canPlace(fresh, env, 'mill', padEdge - 0.01, 0)), 'Too close to the gate.');
  assert.equal(why(canPlace(fresh, env, 'mill', padEdge, 0)), 'ok');
  // room: radius + radius + 1 from every machine, naming the one in the way
  let s = place({ ...fresh, ore: 1000 }, env, 'mill', 10, 0, 0);
  const gap = KINDS.mill.radius + KINDS.drill.radius + 1;
  assert.equal(why(canPlace(s, env, 'drill', 10 + gap - 0.01, 0)), 'Too close to the texture mill.');
  assert.equal(why(canPlace(s, env, 'drill', 10 + gap, 0)), 'ok');
  s = place(s, env, 'press', -10, 0, 0);
  assert.equal(why(canPlace(s, env, 'drill', -10, 2)), 'Too close to the shape press.');
  // the network's reach is inclusive at its edge
  const noWire = 'Out of reach of the power network: build a relay pylon closer.';
  assert.equal(why(canPlace(s, env, 'mill', 0, GATE.reach + 0.01)), noWire);
  assert.equal(why(canPlace(s, env, 'mill', 0, GATE.reach)), 'ok');
  assert.equal(why(canPlace(s, env, 'pylon', 0, GATE.reach + 0.01)), noWire, 'a pylon must itself be wired');
  // ore in the ground matters for drills only
  assert.equal(why(canPlace(s, poor, 'drill', 0, 12)), 'Not enough ore in this ground.');
  assert.equal(why(canPlace(s, poor, 'mill', 0, 12)), 'ok');
  assert.equal(why(canPlace(s, { ...env, richness: () => MIN_RICHNESS }, 'drill', 0, 12)), 'ok');
  // the cost comes last
  const broke = { ...s, ore: KINDS.drill.cost - 0.5 };
  assert.equal(why(canPlace(broke, env, 'drill', 0, 12)), `Needs ${KINDS.drill.cost} ore (you have ${KINDS.drill.cost - 1}).`);
  assert.equal(why(canPlace(broke, env, 'drill', 0, 99)), noWire);
  assert.equal(why(canPlace(broke, poor, 'drill', 0, 12)), 'Not enough ore in this ground.');
  assert.equal(why(canPlace(broke, env, 'drill', -10, 2)), 'Too close to the shape press.');
  // place throws the same words, and a refusal costs nothing
  assert.throws(() => place(fresh, env, 'press', 10, 0, 0), /Unlocks at stage 1\./);
  assert.throws(() => place({ ...fresh, ore: 5 }, env, 'mill', 10, 0, 0), new RegExp(`Needs ${KINDS.mill.cost} ore \\(you have 5\\)\\.`));
  assert.equal(fresh.ore, 60);
});

test('stage 0 is the black-and-white world: only a pixel machine lifts it', () => {
  let s: PlotState = { ...newPlot(), ore: 500 };
  s = place(s, env, 'drill', 0, 12, 0);
  s = place(s, env, 'pylon', 12, 0, 0);
  assert.equal(s.stage, 0);
  assert.equal(run(s, 60).s.stage, 0);
  assert.deepEqual(nextStage(s), { stage: 1, needs: {}, progress: 0 });
  s = place(s, env, 'mill', -12, 0, 0);
  assert.equal(s.stage, 1);
  assert.equal(nextStage(s)!.stage, 2);
  assert.equal(nextStage(s)!.progress, 0);
});

test('pylons chain outward, a power unit is a node too, and a broken link cuts the line', () => {
  let s: PlotState = { ...newPlot(), ore: 5000 };
  const hop = KINDS.pylon.reach - 1;
  const x1 = GATE.reach - 1, x2 = x1 + hop, x3 = x2 + hop, farX = x3 + hop;
  s = place(s, env, 'pylon', x1, 0, 0);
  s = place(s, env, 'pylon', x2, 0, 0);
  s = place(s, env, 'pylon', x3, 0, 0);
  assert.ok(canPlace(s, env, 'mill', farX, 0).ok, 'three pylons carry power past 100 m');
  assert.ok(!canPlace(s, env, 'mill', x3 + KINDS.pylon.reach + 1, 0).ok, 'but each only so far');
  s = place(s, env, 'mill', farX, 0, 0);
  const mill = idOf(s, 3);
  assert.ok(network(s, env).connected.has(mill));
  assert.ok(running(s, env).get(mill)! > 0);
  // cut the middle pylon: the far pylon and the mill lose power, the near pylon keeps it
  const cut = remove(s, idOf(s, 1));
  const net = network(cut, env);
  assert.ok(net.connected.has(idOf(cut, 0)));
  assert.ok(!net.connected.has(idOf(cut, 1)), 'the far pylon');
  assert.ok(!net.connected.has(mill));
  assert.equal(running(cut, env).get(mill), 0);
  assert.equal(net.demand, 0, 'an unconnected machine asks for nothing');
  const idle = run(cut, 30).s;
  for (const m of METRICS) assert.equal(level(idle, m), 0, 'unconnected machines make no pixels');
  // a pylon built in the wrong order is refused until the chain reaches it
  assert.ok(!canPlace({ ...newPlot(), ore: 500 }, env, 'pylon', x2, 0).ok);
  // a power unit carries power on as well
  let t: PlotState = { ...newPlot(), ore: 5000, stage: 1 };
  t = place(t, env, 'power', GATE.reach - 1, 0, 0);
  const beyond = GATE.reach - 1 + KINDS.power.reach - 1;
  assert.ok(canPlace(t, env, 'mill', beyond, 0).ok);
  t = place(t, env, 'mill', beyond, 0, 0);
  assert.ok(network(t, env).connected.has(idOf(t, 1)));
  assert.ok(!canPlace(t, env, 'mill', GATE.reach - 1 + KINDS.power.reach + 1, 0).ok);
});

test('a power unit with no ore makes no power; short of ore, the ore-users share what the drill brings', () => {
  const thin: Env = { ...env, richness: () => MIN_RICHNESS };
  let s: PlotState = { ...newPlot(), ore: 1000, stage: 1 };
  s = place(s, thin, 'power', -8, -8, 0);
  s = place(s, thin, 'mill', 10, 0, 0);
  const unit = idOf(s, 0), mill = idOf(s, 1);
  assert.equal(network(s, thin).supply, GATE.supply - KINDS.power.draw, 'with ore in the stock the unit runs');
  const dry = { ...s, ore: 0 };
  assert.equal(network(dry, thin).supply, GATE.supply, 'no ore, no electricity from the unit');
  assert.equal(running(dry, thin).get(unit), 0);
  assert.equal(running(dry, thin).get(mill), 0);
  assert.equal(step(dry, thin, 10).state.ore, 0);
  // a drill on thin ground brings less than the two ask for: they share it evenly
  const fed = { ...place(s, thin, 'drill', 0, 12, 0), ore: 0 };
  const r = running(fed, thin);
  const share = r.get(unit)!;
  assert.ok(share > 0 && share < 1, `share ${share}`);
  assert.ok(Math.abs(share - r.get(mill)!) < 1e-12, 'evenly');
  assert.equal(r.get(idOf(fed, 2)), 1, 'the drill runs on the gate\'s power');
  assert.ok(Math.abs(network(fed, thin).supply - (GATE.supply - KINDS.power.draw * share)) < 1e-9);
  assert.ok(step(fed, thin, 1).state.ore < 1e-9, 'everything the drill brings is used, nothing is made up');
  // with ore in the stock they all run in full again
  assert.equal(running({ ...fed, ore: 500 }, thin).get(unit), 1);
});

test('a power shortage slows every machine by the same share; switching one off helps', () => {
  let s: PlotState = { ...newPlot(), ore: 5000, stage: 1 };
  for (const [x, z] of [[10, 0], [0, 10], [-10, 0], [0, -10]] as const) s = place(s, env, 'press', x, z, 0);
  const n = network(s, env);
  assert.equal(n.demand, 4 * KINDS.press.draw);
  assert.ok(Math.abs(n.satisfaction - GATE.supply / n.demand) < 1e-12);
  for (const m of s.machines) assert.ok(Math.abs(running(s, env).get(m.id)! - n.satisfaction) < 1e-12);
  const lighter = setOn(s, idOf(s, 0), false);
  assert.equal(running(lighter, env).get(idOf(s, 0)), 0, 'off is off');
  assert.equal(network(lighter, env).demand, 3 * KINDS.press.draw);
  assert.ok(network(lighter, env).satisfaction > n.satisfaction);
  assert.ok(rates(lighter, env).points.vtx > 0);
  assert.equal(network(setOn(lighter, idOf(s, 0), true), env).demand, n.demand);
});

test('cartridges scale a pixel machine by their affinity; only machines with a slot take one', () => {
  const cart: Env = { ...env, affinity: (c, m) => (c === 'sunstone' && m === 'lx' ? 1.5 : c === 'dud' ? 0 : 1) };
  let s: PlotState = { ...newPlot(), ore: 5000, stage: 2 };
  s = place(s, cart, 'mill', 10, 0, 0);
  s = place(s, cart, 'projector', -10, 0, 0);
  s = place(s, cart, 'drill', 0, 10, 0);
  const mill = idOf(s, 0), proj = idOf(s, 1), drill = idOf(s, 2);
  assert.equal(s.machines[1]!.cartridge, null);
  const base = rates(s, cart).points;
  assert.ok(base.pxd > 0 && base.lx > 0 && base.vtx === 0);
  const boosted = setCartridge(s, proj, 'sunstone');
  assert.equal(boosted.machines[1]!.cartridge, 'sunstone');
  assert.equal(s.machines[1]!.cartridge, null, 'the input is untouched');
  assert.ok(Math.abs(rates(boosted, cart).points.lx - 1.5 * base.lx) < 1e-9);
  assert.equal(rates(boosted, cart).points.pxd, base.pxd);
  // it really shows in the points a plot gathers
  const a = run(s, 10, cart).s, b = run(boosted, 10, cart).s;
  assert.ok(Math.abs(b.points.lx - 1.5 * a.points.lx) < 1e-9 && a.points.lx > 0);
  // an affinity of zero stops the output; an empty slot restores it
  const dud = setCartridge(s, mill, 'dud');
  assert.equal(rates(dud, cart).points.pxd, 0);
  assert.equal(rates(setCartridge(dud, mill, null), cart).points.pxd, base.pxd);
  // the cartridge is per machine and a different metric is not boosted
  assert.equal(rates(setCartridge(s, mill, 'sunstone'), cart).points.pxd, base.pxd);
  // without an affinity function a cartridge counts as 1
  assert.equal(rates(boosted, env).points.lx, base.lx);
  // no slot, no cartridge
  assert.throws(() => setCartridge(s, drill, 'sunstone'), /slot/);
  let p = place({ ...newPlot(), ore: 500 }, env, 'pylon', 12, 0, 0);
  assert.throws(() => setCartridge(p, idOf(p, 0), 'sunstone'), /slot/);
  p = place({ ...p, stage: 1 }, env, 'power', -12, 0, 0);
  assert.throws(() => setCartridge(p, idOf(p, 1), 'sunstone'), /slot/);
  assert.equal(setCartridge(s, 9999, 'sunstone'), s, 'an unknown machine changes nothing');
});

test('every pixel machine raises its own metric, and a metric follows the square root of its points', () => {
  let s: PlotState = { ...newPlot(), ore: 9000, stage: 3 };
  for (const [kind, x, z] of [['mill', 10, 0], ['press', -10, 0], ['projector', 0, 10], ['water', 0, -10], ['power', 12, 12], ['power', -12, -12]] as const) s = place(s, env, kind, x, z, 0);
  const r = rates(s, env);
  for (const m of METRICS) assert.ok(r.points[m] > 0, `${m} rises`);
  const after = run(s, 100).s;
  for (const m of METRICS) {
    assert.ok(after.points[m] > 0);
    assert.ok(Math.abs(level(after, m) - 100 * Math.sqrt(after.points[m] / TARGET[m])) < 1e-9);
  }
  // four times the points, twice the level
  const quarter = { ...s, points: { pxd: TARGET.pxd * 0.01, vtx: 0, lx: 0, aq: 0 } };
  const full = { ...s, points: { pxd: TARGET.pxd * 0.04, vtx: 0, lx: 0, aq: 0 } };
  assert.ok(Math.abs(level(full, 'pxd') - 2 * level(quarter, 'pxd')) < 1e-9);
  assert.ok(Math.abs(level(quarter, 'pxd') - 10) < 1e-9);
  // level 100 at the target, never above
  assert.equal(level({ ...s, points: { ...s.points, aq: TARGET.aq } }, 'aq'), 100);
  assert.equal(level({ ...s, points: { ...s.points, aq: TARGET.aq * 7 } }, 'aq'), 100);
});

test('rates() tell what the next second does', () => {
  let s: PlotState = { ...newPlot(), ore: 1000, stage: 2 };
  for (const [kind, x, z] of [['mill', 10, 0], ['press', -10, 0], ['projector', 0, 10], ['drill', 0, -10], ['drill', 12, 12], ['power', -12, -12]] as const) s = place(s, env, kind, x, z, 0);
  s = run(s, 20).s;
  const r = rates(s, env), next = step(s, env, 1).state, n = network(s, env);
  assert.ok(Math.abs(next.ore - (s.ore + r.ore)) < 1e-9);
  for (const m of METRICS) assert.ok(Math.abs(next.points[m] - s.points[m] - r.points[m]) < 1e-9);
  assert.equal(r.supply, n.supply);
  assert.equal(r.demand, n.demand);
  // a full stock stops growing, and a full metric stops too
  const heaps = { ...s, ore: ORE_CAP - 1 };
  assert.equal(run(heaps, 60).s.ore, ORE_CAP);
  assert.equal(rates({ ...heaps, ore: ORE_CAP }, env).ore, 0);
  assert.equal(rates({ ...s, points: { ...s.points, pxd: TARGET.pxd } }, env).points.pxd, 0);
});

test('events: underpowered and ore-out fire once, and again only after a recovery', () => {
  let s: PlotState = { ...newPlot(), ore: 5000, stage: 1 };
  for (const [x, z] of [[10, 0], [0, 10], [-10, 0], [0, -10]] as const) s = place(s, env, 'press', x, z, 0);
  const slow = run(s, 10);
  assert.equal(count(slow.events, 'underpowered'), 1);
  assert.equal(count(slow.events, 'ore-out'), 0);
  assert.equal(run(slow.s, 10).events.length, 0, 'nothing new while it lasts');
  // a power unit ends it; switching the unit off brings it back, announced once more
  const fixed = place(slow.s, env, 'power', 8, 8, 0);
  const calm = run(fixed, 5);
  assert.equal(calm.events.length, 0);
  assert.equal(calm.s.underpowered, undefined);
  const again = run(setOn(calm.s, idOf(calm.s, 4), false), 5);
  assert.equal(count(again.events, 'underpowered'), 1);

  // ore-out
  const mill = place(newPlot(), env, 'mill', 10, 0, 0);
  const dried = run(mill, 200);
  assert.equal(count(dried.events, 'ore-out'), 1);
  assert.ok(dried.s.ore >= 0 && dried.s.ore < 1e-9, 'the stock is dry, never below zero');
  const fed = run(place({ ...dried.s, ore: 50 }, env, 'drill', -10, 0, 0), 30);
  assert.equal(count(fed.events, 'ore-out'), 0, 'a drill that keeps up is no shortage');
  assert.equal(fed.s.oreOut, undefined);
  const lost = remove(fed.s, idOf(fed.s, 1));
  const out = run({ ...lost, ore: 0 }, 5);
  assert.equal(count(out.events, 'ore-out'), 1, 'after the recovery it is announced again');
  // no machines that need ore: no ore-out, even with an empty stock
  const quiet = run({ ...place(newPlot(), env, 'drill', 0, 12, 0), ore: 0 }, 5);
  assert.equal(count(quiet.events, 'ore-out'), 0);
});

test('stages arrive in order, several in one step, each announced once, and are never lost', () => {
  const base = place(newPlot(), env, 'mill', 10, 0, 0);
  assert.equal(base.stage, 1);
  const rich = { ...base, ore: 5000, points: { pxd: TARGET.pxd * 0.6, vtx: TARGET.vtx * 0.6, lx: TARGET.lx * 0.6, aq: TARGET.aq * 0.6 } };
  const r = step(rich, env, 1);
  assert.deepEqual(r.events.filter((e) => e.type === 'stage-up').map((e) => (e.type === 'stage-up' ? e.stage : 0)), [2, 3, 4, 5]);
  assert.equal(r.state.stage, 5);
  assert.deepEqual(step(r.state, env, 1).events, []);
  assert.equal(nextStage(r.state)!.stage, 6);
  // one weak metric holds the stage back, and nextStage names it
  const lopsided = { ...rich, points: { ...rich.points, aq: 0 } };
  const l = step(lopsided, env, 1).state;
  assert.equal(l.stage, 3, 'stage 4 also needs water');
  const ns = nextStage(l)!;
  assert.equal(ns.stage, 4);
  assert.deepEqual(Object.keys(ns.needs).sort(), ['aq', 'lx', 'pxd', 'vtx']);
  assert.equal(ns.progress, 0);
  // just short of the need holds the stage, just past it lifts it
  const short = step({ ...base, points: { pxd: TARGET.pxd * 0.0225 * 0.99, vtx: TARGET.vtx * 0.5, lx: 0, aq: 0 } }, env, 1);
  assert.equal(short.state.stage, 1);
  const past = step({ ...base, points: { pxd: TARGET.pxd * 0.0225 * 1.01, vtx: TARGET.vtx * 0.5, lx: 0, aq: 0 } }, env, 1);
  assert.equal(past.state.stage, 2);
  // everything at the target is stage 6, and then there is nothing next
  const done = step({ ...base, ore: 5000, points: { ...TARGET } }, env, 1);
  assert.deepEqual(done.events.map((e) => (e.type === 'stage-up' ? e.stage : -1)), [2, 3, 4, 5, 6]);
  assert.equal(nextStage(done.state), null);
  // taking every machine away loses nothing
  let b = done.state;
  for (const m of b.machines) b = remove(b, m.id);
  b = step(b, env, 100).state;
  assert.equal(b.stage, 6);
  for (const m of METRICS) assert.equal(level(b, m), 100);
});

test('progress is the smallest level over need, between 0 and 1', () => {
  const s = { ...place(newPlot(), env, 'mill', 10, 0, 0), points: { pxd: TARGET.pxd * 0.0025, vtx: TARGET.vtx * 0.0001, lx: 0, aq: 0 } };
  const ns = nextStage(s)!;
  assert.equal(ns.stage, 2);
  assert.deepEqual(ns.needs, { pxd: 15, vtx: 10 });
  assert.ok(Math.abs(ns.progress - Math.min(level(s, 'pxd') / 15, level(s, 'vtx') / 10)) < 1e-12);
  assert.ok(ns.progress > 0 && ns.progress < 1);
  assert.deepEqual(ns.needs, STAGES[2]);
  assert.notEqual(ns.needs, STAGES[2], 'a copy, so the HUD cannot change the table');
});

test('removing refunds half the cost rounded down, never reuses an id, and never overfills the heaps', () => {
  for (const k of MACHINE_KINDS) {
    const built = place({ ...newPlot(), stage: 3, ore: 1000 }, env, k, 10, 0, 0);
    const gone = remove(built, idOf(built, 0));
    assert.equal(gone.ore, built.ore + Math.floor(KINDS[k].cost / 2), k);
    assert.equal(gone.machines.length, 0);
    assert.equal(gone.nextId, built.nextId, 'ids are never reused');
    assert.equal(remove({ ...built, ore: ORE_CAP }, idOf(built, 0)).ore, ORE_CAP);
    assert.equal(remove(built, 9999), built, 'an unknown machine changes nothing');
  }
});

test('pure: inputs are never changed, and the same inputs always give the same plot', () => {
  let s: PlotState = { ...newPlot(), ore: 3000, stage: 2 };
  for (const [kind, x, z] of [['mill', 10, 0], ['press', -10, 0], ['projector', 0, 10], ['drill', 0, -10], ['power', 12, 12], ['pylon', 20, -20]] as const) s = place(s, env, kind, x, z, 0);
  const frozen = deepFreeze(JSON.parse(JSON.stringify(s)) as PlotState);
  const before = JSON.stringify(frozen);
  const r = step(frozen, env, 30);
  canPlace(frozen, env, 'mill', 20, 20); network(frozen, env); running(frozen, env); rates(frozen, env); nextStage(frozen);
  place(frozen, env, 'drill', 20, 5, 0); remove(frozen, idOf(frozen, 0)); setOn(frozen, idOf(frozen, 0), false); setCartridge(frozen, idOf(frozen, 0), 'x');
  assert.equal(JSON.stringify(frozen), before);
  assert.deepEqual(r.state, step(s, env, 30).state);
  assert.deepEqual(JSON.parse(JSON.stringify(r.state)), r.state, 'plain data');
  assert.deepEqual(loadPlot(JSON.parse(JSON.stringify(r.state))), r.state);
  assert.notEqual(r.state, s);
  assert.equal(step(s, env, 0).state, s);
  assert.equal(step(s, env, -3).state, s);
  assert.equal(step(s, env, Number.NaN).state, s);
});

test('one large step equals many small ones', () => {
  let s: PlotState = { ...newPlot(), ore: 400, stage: 2 };
  for (const [kind, x, z] of [['mill', 10, 0], ['press', -10, 0], ['projector', 0, 10], ['drill', 0, -10], ['drill', 12, 12], ['power', -12, -12]] as const) s = place(s, env, kind, x, z, 0);
  const big = step(s, env, 90), small = run(s, 90);
  assert.deepEqual(big.state, small.s);
  assert.deepEqual(big.events.map((e) => (e.type === 'stage-up' ? `stage-${e.stage}` : e.type)), small.events);
  const a = step(s, env, 2.5).state;
  const b = step(step(step(s, env, 1).state, env, 1).state, env, 0.5).state;
  assert.deepEqual(a, b);
  let t = s;
  for (let i = 0; i < 10; i++) t = step(t, env, 0.1).state;
  const one = step(s, env, 1).state;
  assert.ok(Math.abs(t.ore - one.ore) < 1e-9 && Math.abs(t.time - one.time) < 1e-9);
  for (const m of METRICS) assert.ok(Math.abs(t.points[m] - one.points[m]) < 1e-9);
  // a big step over a plot with stages inside still announces them in order
  const hours = step({ ...s, ore: 5000 }, env, 20000);
  const ups = hours.events.filter((e) => e.type === 'stage-up').map((e) => (e.type === 'stage-up' ? e.stage : 0));
  assert.deepEqual(ups, [...ups].sort((p, q) => p - q));
  assert.equal(new Set(ups).size, ups.length);
});

test('loadPlot clamps numbers, drops bad machines and keeps good ones', () => {
  const good = place(newPlot(), env, 'mill', 10, 0, 0).machines[0]!;
  const l = loadPlot({
    v: 1, time: -5, ore: 1e12, points: { pxd: -3, vtx: 1e12, lx: 'x', aq: Number.NaN }, stage: 17, nextId: 0,
    machines: [good, { ...good }, { ...good, id: 2, kind: 'pylon', x: 'a' }, null, 5, 'drill', { ...good, id: 3, kind: 'press', cartridge: 'sun' },
      { ...good, id: 4, kind: 'drill', cartridge: 'x', yaw: 'left', on: 'yes', built: -4 }, { ...good, id: 0 }, { ...good, id: 1.5 }, { ...good, id: 6, kind: 'toString' }],
  });
  assert.deepEqual(l.machines.map((m) => m.id), [1, 3, 4]);
  assert.equal(l.machines[1]!.cartridge, 'sun');
  assert.deepEqual(l.machines[2], { id: 4, kind: 'drill', x: 10, z: 0, yaw: 0, on: true, cartridge: null, built: 0 });
  assert.equal(l.time, 0); assert.equal(l.ore, ORE_CAP); assert.equal(l.stage, 6); assert.equal(l.nextId, 5);
  assert.deepEqual(l.points, { pxd: 0, vtx: TARGET.vtx, lx: 0, aq: 0 });
  for (const junk of [undefined, 'plot', 7, [], {}, { v: 2 }, { v: '1' }]) assert.deepEqual(loadPlot(junk), newPlot());
  assert.deepEqual(loadPlot({ v: 1, ore: -4 }).ore, 0);
  assert.deepEqual(loadPlot(JSON.parse(JSON.stringify(newPlot()))), newPlot());
  assert.equal(loadPlot({ v: 1, oreOut: true }).oreOut, true);
  assert.equal(loadPlot({ v: 1, oreOut: 'yes' }).oreOut, undefined);
  assert.equal(loadPlot({ v: 1, underpowered: true }).underpowered, true);
  // a loaded plot carries on: new machines get fresh ids
  const placed = place({ ...l, ore: 500 }, env, 'pylon', 12, 12, 0);
  assert.equal(placed.machines[3]!.id, 5);
});

test('pacing, the whole way: stages come in order, each later than the last', () => {
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
  assert.equal(s.stage, 6);
  assert.equal(wish, WISH.length, 'every wish was built');
  for (let n = 3; n <= 6; n++) assert.ok(reached[n]! > reached[n - 1]!, `stage ${n} after stage ${n - 1}`);
  assert.ok(reached[5]! > 3600 && reached[5]! < reached[6]!, `stage 5 at ${reached[5]}`);
  assert.ok(s.ore >= 0 && s.ore <= ORE_CAP);
});
