/**
 * T3 acceptance: the deterministic simulation core. These tests are the CONTRACT in executable form.
 * If a test contradicts packages/contracts/src/sim.ts, follow the contract text, fix the test minimally and say so in your report.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIM_DT, SIM_HZ, type EventBus, type InputFrame, type Simulation, type System, type VariableSystem } from '@hm/contracts';
import { createRecorder, createRng, createSimulation, createWorld, runReplay } from '@hm/sim';

/** Minimal fakes: this package must not depend on the kernel implementation. */
function fakeEvents(): EventBus & { log: [string, unknown][] } {
  const log: [string, unknown][] = [];
  const listeners = new Map<string, ((p: never) => void)[]>();
  const any: ((n: string, p: unknown) => void)[] = [];
  return {
    log,
    on(name, l) { const a = listeners.get(name) ?? []; a.push(l as never); listeners.set(name, a); return () => undefined; },
    once(name, l) { return this.on(name, l); },
    emit(name, payload) { log.push([name, payload]); for (const l of listeners.get(name) ?? []) (l as (p: unknown) => void)(payload); for (const a of any) a(name, payload); },
    onAny(l) { any.push(l); return () => undefined; },
  };
}
const fakeVars = {} as VariableSystem;

const empty = (tick: number): InputFrame => ({ tick, actors: {} });

function buildSim(seed: number, systems: System[] = []): Simulation {
  const sim = createSimulation({ seed, events: fakeEvents(), vars: fakeVars, systems });
  sim.world.defineComponent({ name: 'pos', defaults: { x: 0, y: 0 }, fields: [] });
  return sim;
}

/** A system that moves things with the sim's rng and the actors' inputs: enough state to expose any nondeterminism. */
const wander: System = {
  name: 'wander', order: 10,
  update(world, ctx) {
    for (const id of world.query('pos')) {
      const p = world.get(id, 'pos')!;
      const steer = Number(ctx.input.actors['p1']?.['steer'] ?? 0);
      world.set(id, 'pos', { x: Number(p['x']) + ctx.rng.next() * ctx.dt + steer * ctx.dt, y: Number(p['y']) + ctx.dt });
    }
    if (ctx.tick % 50 === 0) ctx.events.emit('tick50', ctx.tick);
  },
};
const spawner: System = {
  name: 'spawner', order: 0,
  update(world, ctx) { if (ctx.tick === 0) for (let i = 0; i < 5; i++) world.spawn(undefined, { pos: { x: i, y: 0 } }); },
};

test('constants: 120 Hz fixed step', () => {
  assert.equal(SIM_HZ, 120);
  assert.ok(Math.abs(SIM_DT * SIM_HZ - 1) < 1e-12);
});

test('rng: mulberry32, same seed same sequence (matches the old repo\'s generator)', () => {
  const a = createRng(1), b = createRng(1);
  const first = [a.next(), a.next(), a.next()];
  assert.deepEqual(first, [b.next(), b.next(), b.next()]);
  assert.ok(Math.abs(first[0]! - 0.6270739406) < 1e-9, `got ${first[0]}`);
  assert.ok(Math.abs(first[1]! - 0.0027357212) < 1e-9);
  assert.ok(Math.abs(first[2]! - 0.52744704) < 1e-9);
  const c = createRng(12345);
  assert.ok(Math.abs(c.next() - 0.9797282678) < 1e-9);
  assert.notEqual(createRng(2).next(), createRng(1).next());
});

test('rng: int bounds, pick, fork independence, state/restore', () => {
  const r = createRng(7);
  for (let i = 0; i < 500; i++) { const n = r.int(3, 6); assert.ok(n >= 3 && n <= 6 && Number.isInteger(n)); }
  assert.ok(['a', 'b', 'c'].includes(r.pick(['a', 'b', 'c'])));
  const x = createRng(9), y = createRng(9);
  const fx = x.fork('ai');
  x.next(); x.next(); // draining the parent must not change the fork's stream
  const fy = y.fork('ai');
  assert.equal(fx.next(), fy.next(), 'a fork depends only on the parent state at fork time and the label');
  assert.notEqual(createRng(9).fork('ai').next(), createRng(9).fork('other').next());
  const s = createRng(5); s.next();
  const saved = s.state();
  const expect = [s.next(), s.next()];
  s.restore(saved);
  assert.deepEqual([s.next(), s.next()], expect);
});

test('world: spawn, components, query order, ids never reused', () => {
  const w = createWorld();
  w.defineComponent({ name: 'pos', defaults: { x: 0, y: 0 }, fields: [] });
  w.defineComponent({ name: 'tag', defaults: { name: '' }, fields: [] });
  const a = w.spawn(undefined, { pos: { x: 1 } });
  const b = w.spawn(undefined, { pos: {}, tag: { name: 'b' } });
  const c = w.spawn({ ref: 'preset-1' });
  assert.ok(a < b && b < c);
  assert.deepEqual(w.get(a, 'pos'), { x: 1, y: 0 });
  assert.deepEqual(w.query('pos'), [a, b]);
  assert.deepEqual(w.query('pos', 'tag'), [b]);
  assert.deepEqual(w.presetOf(c), { ref: 'preset-1' });
  w.add(c, 'pos', { x: 9 });
  assert.deepEqual(w.query('pos'), [a, b, c], 'query is ascending by id');
  w.despawn(b);
  assert.equal(w.alive(b), false);
  assert.equal(w.spawn(), c + 1, 'ids keep counting up; a despawned id is never reused');
  assert.equal(w.has(a, 'tag'), false);
  w.remove(c, 'pos');
  assert.equal(w.has(c, 'pos'), false);
});

test('world: unknown fields and components are errors, never silent', () => {
  const w = createWorld();
  w.defineComponent({ name: 'pos', defaults: { x: 0, y: 0 }, fields: [] });
  const id = w.spawn(undefined, { pos: {} });
  assert.throws(() => w.set(id, 'pos', { z: 1 }), /z/);
  assert.throws(() => w.add(id, 'nope'), /nope/);
  assert.throws(() => w.set(999, 'pos', { x: 1 }));
});

test('world: snapshot/restore round-trips and hash tracks state', () => {
  const w = createWorld({ seed: 3 });
  w.defineComponent({ name: 'pos', defaults: { x: 0, y: 0 }, fields: [] });
  const id = w.spawn(undefined, { pos: { x: 1 } });
  w.setResource('race', { lap: 1 });
  const h1 = w.hash();
  assert.match(h1, /^[0-9a-f]{8,}$/);
  const snap = w.snapshot();
  w.set(id, 'pos', { x: 2 });
  assert.notEqual(w.hash(), h1);
  w.restore(snap);
  assert.equal(w.hash(), h1);
  assert.deepEqual(w.getResource('race'), { lap: 1 });
  // the same operations in a second world give the same hash
  const w2 = createWorld({ seed: 3 });
  w2.defineComponent({ name: 'pos', defaults: { x: 0, y: 0 }, fields: [] });
  w2.spawn(undefined, { pos: { x: 1 } });
  w2.setResource('race', { lap: 1 });
  assert.equal(w2.hash(), h1);
});

test('world: drainChanges reports spawn, set and despawn once', () => {
  const w = createWorld();
  w.defineComponent({ name: 'pos', defaults: { x: 0, y: 0 }, fields: [] });
  const id = w.spawn(undefined, { pos: {} });
  w.set(id, 'pos', { x: 5 });
  w.despawn(id);
  const changes = w.drainChanges();
  assert.deepEqual(changes.map((c) => c.type), ['spawn', 'set', 'despawn']);
  assert.deepEqual(w.drainChanges(), []);
});

test('simulation: systems run in order, tick counts, events reach the bus', () => {
  const order: string[] = [];
  const events = fakeEvents();
  const sim = createSimulation({ seed: 1, events, vars: fakeVars, systems: [
    { name: 'b', order: 5, update: () => { order.push('b'); } },
    { name: 'a', order: 1, update: () => { order.push('a'); } },
    { name: 'c', order: 5, update: (_w, ctx) => { order.push('c'); if (ctx.tick === 1) ctx.events.emit('hello', 1); } },
  ] });
  sim.step(); sim.step();
  assert.deepEqual(order, ['a', 'b', 'c', 'a', 'b', 'c'], 'ascending order, ties by registration order');
  assert.equal(sim.tick, 2);
  assert.deepEqual(events.log, [['hello', 1]]);
  sim.removeSystem('a');
  order.length = 0; sim.step();
  assert.deepEqual(order, ['b', 'c']);
});

test('simulation.advance: accumulates wall time into fixed ticks and returns the render alpha', () => {
  const sim = buildSim(1);
  let ran = 0;
  sim.addSystem({ name: 'count', order: 0, update: () => { ran++; } });
  const alpha = sim.advance(SIM_DT * 1000 * 3.5, empty);
  assert.equal(ran, 3);
  assert.ok(Math.abs(alpha - 0.5) < 1e-6, `alpha ${alpha}`);
  sim.advance(SIM_DT * 1000 * 0.5, empty);
  assert.equal(ran, 4, 'the leftover half tick carries over');
  const before = ran;
  sim.advance(10_000, empty, 5);
  assert.equal(ran - before, 5, 'maxTicksPerCall caps a long stall (no spiral of death)');
});

test('determinism: same seed + same inputs = same hash; different seed or input = different hash', () => {
  const frames = (n: number): InputFrame[] => Array.from({ length: n }, (_, t) => ({ tick: t, actors: { p1: { steer: t % 7 === 0 ? 1 : 0 } } }));
  const run = (seed: number, inputs: InputFrame[]): string => {
    const sim = buildSim(seed, [spawner, wander]);
    for (const f of inputs) sim.step(f);
    return sim.world.hash();
  };
  const f = frames(600);
  assert.equal(run(42, f), run(42, f));
  assert.notEqual(run(42, f), run(43, f));
  assert.notEqual(run(42, f), run(42, frames(600).map((x) => ({ ...x, actors: { p1: { steer: 0 } } }))));
});

test('replay: record a session, replay it, get the same final hash; a tampered input is caught at the right tick', () => {
  const seed = 99;
  const sim = buildSim(seed, [spawner, wander]);
  const rec = createRecorder(seed, 'bundle-abc', 50);
  for (let t = 0; t < 300; t++) {
    const frame: InputFrame = { tick: t, actors: { p1: { steer: Math.sin(t / 10) } } };
    sim.step(frame);
    rec.record(frame, sim.world);
  }
  const replay = rec.finish(sim.world);
  assert.equal(replay.seed, seed);
  assert.equal(replay.bundleHash, 'bundle-abc');
  assert.equal(replay.ticks, 300);
  assert.equal(replay.finalHash, sim.world.hash());
  assert.ok((replay.checkpoints?.length ?? 0) >= 5);
  const ok = runReplay(replay, (s) => buildSim(s, [spawner, wander]));
  assert.equal(ok.matches, true);
  assert.equal(ok.firstMismatchTick, null);
  // flip one input at tick 160
  const inputs = replay.inputs.map((f) => (f.tick === 160 ? { tick: 160, actors: { p1: { steer: 99 } } } : f));
  const bad = runReplay({ ...replay, inputs }, (s) => buildSim(s, [spawner, wander]));
  assert.equal(bad.matches, false);
  assert.ok(bad.firstMismatchTick !== null && bad.firstMismatchTick >= 160 && bad.firstMismatchTick <= 200, `first mismatch ${bad.firstMismatchTick}`);
});

// sized for the owner's minimum-spec laptop (2.4 s there); runs on its own after the other tests (scripts/verify.mjs)
test('performance: 10,000 entities for 120 ticks stays under 6 s', () => {
  const sim = buildSim(1, [{ name: 'move', order: 0, update: (w, ctx) => { for (const id of w.query('pos')) w.set(id, 'pos', { x: Number(w.get(id, 'pos')!['x']) + ctx.dt }); } }]);
  for (let i = 0; i < 10_000; i++) sim.world.spawn(undefined, { pos: {} });
  const t0 = Date.now();
  for (let i = 0; i < 120; i++) sim.step();
  assert.ok(Date.now() - t0 < 6000, `took ${Date.now() - t0} ms`);
});
