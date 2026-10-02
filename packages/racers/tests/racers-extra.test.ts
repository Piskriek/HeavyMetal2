import test from 'node:test';
import assert from 'node:assert/strict';
import type { Value } from '../src/types';
import { createRacerSystem, defineRacerComponents } from '../src/index';
import { ctx, fakeDeps, fakeWorld } from './helpers';

const near = (a: number, b: number, e = 1e-6): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
function setup(over: Parameters<typeof fakeDeps>[0] = {}) {
  const w = fakeWorld(); defineRacerComponents(w);
  const fd = fakeDeps(over);
  return { w, sys: createRacerSystem(fd.deps), ...fd };
}
const racer = (w: ReturnType<typeof fakeWorld>, extra: Record<string, Value> = {}, t: Record<string, number> = {}, v: Record<string, number> = {}): number =>
  w.spawn({ transform: { x: 0, y: 0, z: 0, ...t }, velocity: { vx: 0, vy: 0, vz: 0, ...v }, body: {}, racer: { ...extra }, race: {} });
const R = (w: ReturnType<typeof fakeWorld>, id: number) => w.get(id, 'racer')!;

test('zero racers: nothing happens, rankRacers not called', () => {
  let ranked = false;
  const { w, sys, forces, impulses } = setup({ rankRacers: () => { ranked = true; return []; } });
  const c = ctx({ p1: { throttle: 1 } }); sys.update(w, c);
  assert.equal(forces.length + impulses.length + c.events.log.length, 0); assert.equal(ranked, false);
});

test('entities without all required components are ignored', () => {
  const { w, sys, forces } = setup();
  w.spawn({ transform: { x: 0, y: 0, z: 0 }, velocity: { vx: 0, vy: 0, vz: 0 }, racer: {}, race: {} });
  sys.update(w, ctx({ p1: { throttle: 1 } })); assert.equal(forces.length, 0);
});

test('many racers are processed in ascending entity id order', () => {
  const { w, sys, forces } = setup();
  const ids = Array.from({ length: 8 }, () => racer(w));
  sys.update(w, ctx({ p1: { throttle: 1 } }));
  assert.deepEqual(forces.map(([e]) => e), ids);
});

test('missing actor id gives no thrust and no steering', () => {
  const { w, sys, forces } = setup();
  const e = racer(w, { actor: 'nobody' });
  sys.update(w, ctx({ p1: { throttle: 1, steer: 1 } }));
  assert.equal(forces.length, 0); assert.equal(R(w, e)['hx'], 1); assert.equal(R(w, e)['hz'], 0);
});

test('booleans as steer/throttle coerce via Number, item as non-true does nothing', () => {
  const { w, sys, forces } = setup();
  const e = racer(w, { item: 'boost' });
  sys.update(w, ctx({ p1: { throttle: true, steer: false, item: 1 } }));
  assert.equal(forces.length, 1); near(forces[0]![1][0]!, 20); assert.equal(R(w, e)['item'], 'boost');
});

test('throttle below 0 is clamped to 0, brake above 1 clamped to 1', () => {
  const { w, sys, forces } = setup();
  racer(w, {}, {}, { vx: 10 });
  sys.update(w, ctx({ p1: { throttle: -3, brake: 7 } }));
  assert.equal(forces.length, 1); near(forces[0]![1][0]!, -50);
});

test('boost expires to exactly 0 and never goes negative', () => {
  const { w, sys } = setup();
  const e = racer(w, { boostMs: 20 });
  for (let i = 0; i < 5; i++) sys.update(w, ctx());
  assert.equal(R(w, e)['boostMs'], 0);
});

test('heading stays unit length over 10000 steps of steering', () => {
  const { w, sys } = setup();
  const e = racer(w);
  for (let i = 0; i < 10000; i++) sys.update(w, ctx({ p1: { steer: i % 3 === 0 ? -1 : 1 } }));
  near(Math.hypot(R(w, e)['hx'] as number, R(w, e)['hz'] as number), 1, 1e-12);
});

test('turn rate halves at top speed', () => {
  const { w, sys } = setup();
  const e = racer(w, {}, {}, { vx: 20 });
  sys.update(w, ctx({ p1: { steer: 1 } }));
  near(R(w, e)['hz'] as number, Math.sin(0.01), 1e-6);
});

test('grip 0 gives no lateral impulse', () => {
  const { w, sys, impulses } = setup({ derivePhysics: () => ({ mass: 2, maxSpeed: 20, acceleration: 10, restitution: 0.3, grip: 0 }) });
  racer(w, {}, {}, { vz: 5 });
  sys.update(w, ctx()); assert.equal(impulses.length, 0);
});

test('using an item with an empty slot emits nothing', () => {
  const { w, sys } = setup();
  racer(w);
  const c = ctx({ p1: { item: true } }); sys.update(w, c);
  assert.equal(c.events.log.length, 0);
});

test('AI uses previous place for the rubber band and receives an rng wrapper', () => {
  const seen: [number, number][] = []; let rv = -1;
  const { w, sys } = setup({ rubberBand: (p, n) => { seen.push([p, n]); return 1; }, aiControl: (_t, _s, _k, rng) => { rv = rng(); return { steer: 0, throttle: 1 }; } });
  racer(w); racer(w, { controller: 'ai' });
  sys.update(w, ctx()); sys.update(w, ctx());
  assert.equal(rv, 0.5); assert.deepEqual(seen, [[1, 2], [2, 2]]);
});

test('derivePhysics receives the racer stats', () => {
  let got: unknown = null;
  const { w, sys } = setup({ derivePhysics: (s) => { got = s; return { mass: 1, maxSpeed: 10, acceleration: 1, restitution: 0, grip: 1 }; } });
  racer(w, { weight: 9, speed: 2, bounce: 7 });
  sys.update(w, ctx()); assert.deepEqual(got, { weight: 9, speed: 2, bounce: 7 });
});

test('a rebuilt system (snapshot restore) continues from world state', () => {
  const a = setup(); const e = racer(a.w, { boostMs: 1000 });
  a.sys.update(a.w, ctx());
  const sys2 = createRacerSystem(a.deps); sys2.update(a.w, ctx());
  near(R(a.w, e)['boostMs'] as number, 1000 - 2000 / 120, 1e-9);
});
