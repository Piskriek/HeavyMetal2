import test from 'node:test';
import assert from 'node:assert/strict';
import type { LapState, LapTrackerLike, Value } from '../src/types';
import { createRacerSystem, defineRacerComponents, grantItem, RACER_SYSTEM_ORDER } from '../src/racers';
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

test('components: registered once with variable defs; system name and order', () => {
  const w = fakeWorld(); defineRacerComponents(w); defineRacerComponents(w);
  const names = w.components().map((c) => c.name).sort();
  assert.deepEqual(names, ['race', 'racer']);
  for (const c of w.components()) { assert.equal(c.fields.length, Object.keys(c.defaults).length); for (const f of c.fields) assert.ok(f.label && f.doc && f.key in c.defaults); }
  assert.equal(w.components().find((c) => c.name === 'racer')!.defaults['weight'], 5);
  const s = createRacerSystem(fakeDeps().deps); assert.equal(s.name, 'racers'); assert.equal(s.order, RACER_SYSTEM_ORDER); assert.equal(RACER_SYSTEM_ORDER, 60);
});

test('player throttle pushes along the heading with force = acceleration * mass * throttle', () => {
  const { w, sys, forces, impulses } = setup();
  const e = racer(w);
  sys.update(w, ctx({ p1: { throttle: 1 } }));
  assert.equal(forces.length, 1); assert.equal(forces[0]![0], e);
  near(forces[0]![1][0]!, 20); near(forces[0]![1][1]!, 0); near(forces[0]![1][2]!, 0);
  assert.equal(impulses.length, 0);
});

test('steering rotates the unit heading (positive steer: +x towards +z), input is clamped', () => {
  const { w, sys } = setup();
  const e = racer(w);
  sys.update(w, ctx({ p1: { steer: 1 } }));
  near(R(w, e)['hz'] as number, Math.sin(0.02), 1e-6); near(R(w, e)['hx'] as number, Math.cos(0.02), 1e-6);
  const e2 = racer(w, { actor: 'p2' });
  sys.update(w, ctx({ p2: { steer: 5 } }));
  near(R(w, e2)['hz'] as number, Math.sin(0.02), 1e-6);
  near(Math.hypot(R(w, e2)['hx'] as number, R(w, e2)['hz'] as number), 1, 1e-9);
});

test('top speed and boost: no thrust above the cap, boost raises the cap and doubles the force', () => {
  const a = setup(); racer(a.w, {}, {}, { vx: 21 });
  a.sys.update(a.w, ctx({ p1: { throttle: 1 } })); assert.equal(a.forces.length, 0);
  const b = setup(); const e = racer(b.w, { boostMs: 100 }, {}, { vx: 21 });
  b.sys.update(b.w, ctx({ p1: { throttle: 1 } }));
  assert.equal(b.forces.length, 1); near(b.forces[0]![1][0]!, 40);
  near(R(b.w, e)['boostMs'] as number, 100 - 1000 / 120, 1e-9);
});

test('lateral grip removes sideways speed with an impulse', () => {
  const { w, sys, forces, impulses } = setup();
  racer(w, {}, {}, { vz: 5 });
  sys.update(w, ctx({}));
  assert.equal(forces.length, 0); assert.equal(impulses.length, 1);
  near(impulses[0]![1][0]!, 0); near(impulses[0]![1][2]!, -0.5);
});

test('brake pushes against the velocity but never reverses it', () => {
  const { w, sys, forces } = setup();
  racer(w, {}, {}, { vx: 10 });
  sys.update(w, ctx({ p1: { brake: 1 } }));
  assert.equal(forces.length, 1); near(forces[0]![1][0]!, -50); near(Math.abs(forces[0]![1][2]!), 0);
  const slow = setup(); racer(slow.w, {}, {}, { vx: 0.05 });
  slow.sys.update(slow.w, ctx({ p1: { brake: 1 } })); assert.equal(slow.forces.length, 0);
});

test('items: boost starts the timer, jump kicks upwards, use is edge triggered, unknown items are consumed', () => {
  const { w, sys } = setup();
  const e = racer(w, { item: 'boost' });
  const c1 = ctx({ p1: { item: true } });
  sys.update(w, c1);
  assert.equal(R(w, e)['boostMs'], 2500); assert.equal(R(w, e)['item'], '');
  assert.deepEqual(c1.events.log.filter(([n]) => n === 'item:used'), [['item:used', { entity: e, item: 'boost', kind: 'self' }]]);
  grantItem(w, e, 'boost');
  const c2 = ctx({ p1: { item: true } }); sys.update(w, c2);   // still held: no new use
  assert.equal(c2.events.log.filter(([n]) => n === 'item:used').length, 0); assert.equal(R(w, e)['item'], 'boost');
  sys.update(w, ctx({ p1: { item: false } })); sys.update(w, ctx({ p1: { item: true } }));
  assert.equal(R(w, e)['item'], '');
  const j = setup(); const e2 = racer(j.w, { item: 'jump' });
  j.sys.update(j.w, ctx({ p1: { item: true } }));
  assert.deepEqual(j.impulses.filter(([, i]) => i[1] !== 0), [[e2, [0, 12, 0]]]);
  const o = setup(); const e3 = racer(o.w, { item: 'oil' }); const co = ctx({ p1: { item: true } });
  o.sys.update(o.w, co);
  assert.equal(R(o.w, e3)['item'], ''); assert.deepEqual(co.events.log, [['item:used', { entity: e3, item: 'oil', kind: 'self' }]]);
});

test('AI drivers use aiControl with the skill mapping and the rubber band', () => {
  let seen: unknown = null;
  const { w, sys, forces } = setup({ aiControl: (_t, _s, skill) => { seen = skill; return { steer: 0.5, throttle: 0.8 }; } });
  const e = racer(w, { controller: 'ai', skill: 1 });
  sys.update(w, ctx({}));
  assert.deepEqual(seen, { lookahead: 30, cornerCare: 1, noise: 0 });
  near(R(w, e)['hz'] as number, Math.sin(0.01), 1e-6);
  near(forces[0]![1][0]!, 17.6 * Math.cos(0.01), 1e-3); near(forces[0]![1][2]!, 17.6 * Math.sin(0.01), 1e-3);
});

test('laps: race component follows the tracker, events fire once', () => {
  const script: LapState[] = [
    { lap: 2, progress: 1.05, finished: false, lapCompleted: true },
    { lap: 3, progress: 3, finished: true, lapCompleted: true },
    { lap: 3, progress: 3, finished: true, lapCompleted: false },
  ];
  let i = 0;
  const mk = (): LapTrackerLike => { let st: LapState = { lap: 1, progress: 0, finished: false, lapCompleted: false }; return { update: () => (st = script[Math.min(i++, 2)]!), reset: () => undefined, get state() { return st; } }; };
  const { w, sys } = setup({ createLapTracker: mk });
  const e = racer(w);
  const c1 = ctx(); sys.update(w, c1);
  assert.equal(w.get(e, 'race')!['lap'], 2); near(w.get(e, 'race')!['progress'] as number, 1.05);
  assert.deepEqual(c1.events.log.filter(([n]) => n === 'lap:completed'), [['lap:completed', { entity: e, lap: 2 }]]);
  const c2 = ctx(); sys.update(w, c2);
  assert.equal(w.get(e, 'race')!['finished'], true);
  assert.deepEqual(c2.events.log.filter(([n]) => n === 'racer:finished'), [['racer:finished', { entity: e, place: 1 }]]);
  const c3 = ctx(); sys.update(w, c3);
  assert.equal(c3.events.log.filter(([n]) => n === 'racer:finished').length, 0);
});

test('positions come from the ranking of everybody\'s progress', () => {
  const progress = [1.0, 2.5, 1.7]; let created = 0;
  const mk = (): LapTrackerLike => { const p = progress[created++]!; const st: LapState = { lap: 1, progress: p, finished: false, lapCompleted: false }; return { update: () => st, reset: () => undefined, get state() { return st; } }; };
  const { w, sys } = setup({ createLapTracker: mk });
  const ids = [racer(w), racer(w), racer(w)];
  sys.update(w, ctx());
  assert.deepEqual(ids.map((id) => w.get(id, 'race')!['place']), [3, 1, 2]);
});

test('a finished racer rolls on at a gentle pace on autopilot, ignoring the player input and never braking to a stop', () => {
  const { w, sys, forces } = setup();
  const e = racer(w, {}, {}, { vx: 10 }); w.set(e, 'race', { finished: true });
  sys.update(w, ctx({ p1: { throttle: 0, brake: 1, steer: -1 } }));
  const thrust = forces.filter((f) => f[0] === e);
  assert.equal(thrust.length, 1);
  assert.ok(thrust[0]![1][0]! > 0, 'pushes forward, not a brake');
  near(thrust[0]![1][0]!, 8, 1e-3); // the fake autopilot asks for 0.8, capped at 0.4: acceleration 10 * mass 2 * 0.4
  assert.ok((w.get(e, 'racer')!['hz'] as number) > 0, 'steers by the autopilot (+0.5), not by the player (-1)');
});

test('invalid numbers throw an error naming the entity and the field', () => {
  const { w, sys } = setup();
  const e = racer(w, { weight: Number.NaN });
  assert.throws(() => sys.update(w, ctx()), new RegExp(`${e}[^]*weight`));
  const b = setup(); const e2 = racer(b.w, {}, {}, { vx: Number.POSITIVE_INFINITY });
  assert.throws(() => b.sys.update(b.w, ctx()), new RegExp(`${e2}[^]*vx`));
});

test('identical runs give identical forces (determinism)', () => {
  const run = (): string => {
    const { w, sys, forces, impulses } = setup();
    racer(w, {}, {}, { vx: 3, vz: 1 }); racer(w, { controller: 'ai', skill: 0.3 }, { x: 5 }, { vx: 8 });
    for (let t = 0; t < 200; t++) sys.update(w, ctx({ p1: { steer: Math.sign(((t * 7) % 5) - 2), throttle: (t % 4) / 3, brake: t % 9 === 0 ? 1 : 0 } }));
    return JSON.stringify([forces, impulses, w.query('racer').map((id) => w.get(id, 'racer'))]);
  };
  assert.equal(run(), run());
});
