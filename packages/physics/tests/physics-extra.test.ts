import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import type { BodySpec, EntityId } from '@hm/contracts';
import { createPhysics, createPhysicsSystem, definePhysicsComponents } from '../src/physics';
import { fakeWorld, transformDef, type TestWorld } from './helpers';

function setup(gravity: readonly [number, number, number] = [0, -9.81, 0]) {
  const w = fakeWorld(); w.defineComponent(transformDef); definePhysicsComponents(w);
  const e = createPhysics(); e.attach(w); e.setGravity(gravity);
  return { w, e };
}
type Engine = ReturnType<typeof setup>['e'];
function ball(e: Engine, w: TestWorld, position: readonly [number, number, number], extra: Partial<BodySpec> = {}): EntityId {
  const id = w.spawn();
  e.addBody(id, { kind: 'dynamic', collider: { shape: 'sphere', radius: 0.5 }, position, ...extra });
  return id;
}
function floor(e: Engine, w: TestWorld): EntityId {
  const id = w.spawn();
  e.addBody(id, { kind: 'static', collider: { shape: 'heightfield', cols: 3, rows: 3, cell: 20, heights: Array<number>(9).fill(0) }, position: [-20, 0, -20], friction: 1 });
  return id;
}
const value = (w: TestWorld, id: EntityId, c: string, key: string): number => w.get(id, c)![key] as number;
const step = (e: Engine, count: number): void => { for (let i = 0; i < count; i++) e.step(1 / 120); };

test('component metadata covers every editable body and velocity field', () => {
  const w = fakeWorld();
  assert.throws(() => definePhysicsComponents(w), /transform/);
  w.defineComponent(transformDef); definePhysicsComponents(w); definePhysicsComponents(w);
  assert.deepEqual(w.components().map((c) => c.name), ['transform', 'velocity', 'body']);
  for (const c of w.components().slice(1)) {
    assert.deepEqual(c.fields.map((f) => f.key), Object.keys(c.defaults));
    for (const f of c.fields) assert.ok(f.label && f.doc && f.tier);
  }
  assert.deepEqual(w.components()[2]!.fields[6]!.options, ['racing', 'decor', 'trigger']);
});

test('head-on sphere collision conserves linear momentum and exchanges velocity at equal mass', () => {
  const { w, e } = setup([0, 0, 0]);
  const a = ball(e, w, [-0.55, 0, 0], { restitution: 1, friction: 0 });
  const b = ball(e, w, [0.55, 0, 0], { restitution: 1, friction: 0 });
  w.set(a, 'velocity', { vx: 3 }); w.set(b, 'velocity', { vx: -1 });
  const before = value(w, a, 'velocity', 'vx') + value(w, b, 'velocity', 'vx');
  step(e, 10);
  assert.ok(Math.abs(value(w, a, 'velocity', 'vx') + 1) < 1e-9);
  assert.ok(Math.abs(value(w, b, 'velocity', 'vx') - 3) < 1e-9);
  assert.ok(Math.abs(value(w, a, 'velocity', 'vx') + value(w, b, 'velocity', 'vx') - before) < 1e-12);
});

test('unequal masses split penetration and conserve momentum', () => {
  const { w, e } = setup([0, 0, 0]);
  const a = ball(e, w, [-0.6, 0, 0], { mass: 4, restitution: 0 });
  const b = ball(e, w, [0.6, 0, 0], { mass: 1, restitution: 0 });
  w.set(a, 'velocity', { vx: 5 });
  const momentum = 4 * value(w, a, 'velocity', 'vx');
  step(e, 6);
  assert.ok(Math.abs(4 * value(w, a, 'velocity', 'vx') + value(w, b, 'velocity', 'vx') - momentum) < 1e-9);
  assert.ok(value(w, a, 'transform', 'x') + 0.5 <= value(w, b, 'transform', 'x') - 0.5 + 1e-8);
});

test('explicit linear and angular damping follow implicit Euler for one substep', () => {
  const { w, e } = setup([0, 0, 0]);
  const b = ball(e, w, [0, 0, 0], { linearDamping: 3, angularDamping: 5 });
  w.set(b, 'velocity', { vx: 0.2, wz: 2 });
  e.step(1 / 120);
  assert.ok(Math.abs(value(w, b, 'velocity', 'vx') - 0.2 / (1 + 3 / 120)) < 1e-12);
  assert.ok(Math.abs(value(w, b, 'velocity', 'wz') - 2 / (1 + 5 / 120)) < 1e-12);
});

test('a sphere rolls down a sloped heightfield, not just a triangle mesh', () => {
  const { w, e } = setup();
  const id = w.spawn();
  e.addBody(id, { kind: 'static', collider: { shape: 'heightfield', cols: 4, rows: 2, cell: 2, heights: [2, 1.5, 1, 0.5, 2, 1.5, 1, 0.5] }, position: [-2, 0, -1], friction: 1 });
  const b = ball(e, w, [-0.5, 2.14, 0], { friction: 1 });
  step(e, 100);
  assert.ok(value(w, b, 'velocity', 'vx') > 0.7);
  assert.ok(Math.abs(value(w, b, 'velocity', 'wz')) > 1);
  const x = value(w, b, 'transform', 'x'), y = value(w, b, 'transform', 'y');
  assert.ok(y > 2 - 0.25 * (x + 2), 'ball must remain above the slope');
});

test('a rotated box provides the rotated face normal for rays and contacts', () => {
  const { w, e } = setup([0, 0, 0]);
  const id = w.spawn(), angle = Math.PI / 8;
  e.addBody(id, { kind: 'static', collider: { shape: 'box', half: [0.1, 3, 3] }, position: [0, 0, 0], rotation: [0, Math.sin(angle), 0, Math.cos(angle)], friction: 0 });
  const hit = e.raycast([-3, 0, 0], [4, 0, 0], 10)!;
  assert.equal(hit.entity, id);
  assert.ok(Math.abs(hit.distance - (3 - Math.SQRT2 * 0.1)) < 1e-6);
  assert.ok(Math.abs(hit.normal[0] + Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(hit.normal[2]) > 0.7);
  const b = ball(e, w, [-3, 0, 0], { friction: 0, restitution: 1 });
  w.set(b, 'velocity', { vx: 8 }); step(e, 40);
  assert.ok(Math.abs(value(w, b, 'velocity', 'vz')) > 1);
});

test('two coplanar mesh triangles have no velocity bump at their shared edge', () => {
  const { w, e } = setup();
  const id = w.spawn();
  e.addBody(id, { kind: 'static', collider: { shape: 'mesh', positions: [-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5], indices: [0, 1, 2, 0, 2, 3] }, position: [0, 0, 0], friction: 0 });
  const b = ball(e, w, [-3, 0.5, -3], { friction: 0 });
  w.set(b, 'velocity', { vx: 3, vz: 3 });
  const original = Math.sqrt(18); step(e, 150);
  const vx = value(w, b, 'velocity', 'vx'), vz = value(w, b, 'velocity', 'vz');
  assert.ok(Math.abs(Math.sqrt(vx * vx + vz * vz) / original - 1) < 0.02);
  assert.ok(Math.abs(value(w, b, 'transform', 'y') - 0.5) < 0.01);
});

test('contact listeners receive impacts over the threshold, not resting pressure', () => {
  const { w, e } = setup(); floor(e, w);
  ball(e, w, [0, 4, 0]);
  const impulses: number[] = [], off = e.onContact((_a, _b, _p, _n, impulse) => impulses.push(impulse));
  step(e, 120);
  assert.ok(impulses.some((n) => n > 0.5));
  const impacts = impulses.length; step(e, 120);
  assert.equal(impulses.length, impacts);
  off();
});

test('a trigger reports a ball already inside on its first step; unsubscribe stops events', () => {
  const { w, e } = setup([0, 0, 0]);
  const id = w.spawn(); e.addBody(id, { kind: 'static', collider: { shape: 'box', half: [1, 1, 1] }, position: [0, 0, 0], tier: 'trigger' });
  const b = ball(e, w, [0, 0, 0]);
  const log: boolean[] = [], off = e.onTrigger((entity, trigger, enter) => { if (entity === b && trigger === id) log.push(enter); });
  e.step(1 / 120); e.step(1 / 120); assert.deepEqual(log, [true]);
  off(); w.set(b, 'transform', { x: 3 }); e.step(1 / 120);
  assert.deepEqual(log, [true]);
});

test('decor balls collide with decor statics; racing balls ignore them', () => {
  const { w, e } = setup([0, 0, 0]);
  const id = w.spawn(); e.addBody(id, { kind: 'static', collider: { shape: 'box', half: [0.2, 2, 2] }, position: [0, 0, 0], tier: 'decor' });
  const debris = ball(e, w, [-2, 0, -0.5], { tier: 'decor' });
  const racer = ball(e, w, [-2, 0, 0.5], { tier: 'racing' });
  w.set(debris, 'velocity', { vx: 4 }); w.set(racer, 'velocity', { vx: 4 });
  step(e, 100);
  assert.ok(value(w, debris, 'transform', 'x') < -0.69);
  assert.ok(value(w, racer, 'transform', 'x') > 1);
});

test('mesh rays hit from either side and non-unit directions report metres', () => {
  const { w, e } = setup();
  const id = w.spawn(); e.addBody(id, { kind: 'static', collider: { shape: 'mesh', positions: [-2, 0, -2, 2, 0, -2, 0, 0, 2], indices: [0, 1, 2] }, position: [0, 0, 0] });
  const above = e.raycast([0, 5, 0], [0, -10, 0], 10)!;
  const below = e.raycast([0, -5, 0], [0, 10, 0], 10)!;
  assert.equal(above.entity, id); assert.equal(below.entity, id);
  assert.equal(above.distance, 5); assert.equal(below.distance, 5);
  assert.equal(above.normal[1], 1); assert.equal(below.normal[1], -1);
  assert.equal(e.raycast([0, 2, 0], [0, 0, 0], 5), null);
});

test('removing a dynamic body removes its components; adding it back resets its state', () => {
  const { w, e } = setup([0, -10, 0]);
  const b = ball(e, w, [0, 3, 0]);
  e.removeBody(b); step(e, 30);
  assert.equal(w.has(b, 'body'), false);
  assert.equal(value(w, b, 'transform', 'y'), 3);
  ball(e, w, [0, 2, 0]);
  e.addBody(b, { kind: 'dynamic', collider: { shape: 'sphere', radius: 0.5 }, position: [0, 5, 0] });
  e.step(1 / 120);
  assert.ok(value(w, b, 'transform', 'y') < 5);
});

test('non-finite World fields report their entity and field; zero mass acts as one', () => {
  const { w, e } = setup([0, 0, 0]);
  const b = ball(e, w, [0, 0, 0], { mass: 0 });
  e.applyImpulse(b, [2, 0, 0]); assert.equal(value(w, b, 'velocity', 'vx'), 2);
  w.set(b, 'velocity', { wy: Infinity });
  assert.throws(() => e.step(1 / 120), new RegExp(`entity ${b}.*wy`));
  w.set(b, 'velocity', { wy: 0 }); w.set(b, 'transform', { z: NaN });
  assert.throws(() => e.step(1 / 120), new RegExp(`entity ${b}.*z`));
});

test('live World edits and quaternion integration are observed on the next step', () => {
  const { w, e } = setup([0, 0, 0]);
  const b = ball(e, w, [0, 0, 0]);
  w.set(b, 'transform', { x: 10 }); w.set(b, 'velocity', { vx: 2, wz: 3 });
  step(e, 120);
  assert.ok(Math.abs(value(w, b, 'transform', 'x') - 12) < 1e-9);
  const q = w.get(b, 'transform')!;
  const norm = Math.sqrt(['qx', 'qy', 'qz', 'qw'].reduce((sum, key) => sum + (q[key] as number) ** 2, 0));
  assert.ok(Math.abs(norm - 1) < 1e-12);
  assert.ok(Math.abs(value(w, b, 'transform', 'qz')) > 0.1);
});

test('physics system attaches a new world and forwards the supplied dt', () => {
  const a = setup(), b = setup();
  const id = ball(b.e, b.w, [0, 5, 0]);
  const sys = createPhysicsSystem(a.e);
  sys.update(b.w, { dt: 0.1, tick: 0 });
  assert.ok(value(b.w, id, 'transform', 'y') < 5);
  assert.equal(sys.order, 100);
});

test('a mesh rotated around Y is collidable from both sides', () => {
  const { w, e } = setup([0, 0, 0]);
  const id = w.spawn(), angle = Math.PI / 8;
  e.addBody(id, { kind: 'static', collider: {
    shape: 'mesh', positions: [0, -2, -2, 0, 2, -2, 0, 2, 2, 0, -2, 2],
    indices: [0, 1, 2, 0, 2, 3],
  }, position: [2, 0, 0], rotation: [0, Math.sin(angle), 0, Math.cos(angle)] });
  const left = e.raycast([-2, 0, 0], [1, 0, 0], 10)!;
  const right = e.raycast([5, 0, 0], [-1, 0, 0], 10)!;
  assert.equal(left.entity, id); assert.equal(right.entity, id);
  assert.ok(Math.abs(left.distance - 4) < 1e-9);
  assert.ok(Math.abs(right.distance - 3) < 1e-9);
  assert.ok(left.normal[0] < -0.7 && right.normal[0] > 0.7);
});

test('kinematic colliders replace active dynamics and behave like static boxes', () => {
  const { w, e } = setup([0, 0, 0]);
  const id = ball(e, w, [0, 2, 0]);
  e.addBody(id, { kind: 'kinematic', collider: { shape: 'box', half: [0.25, 1, 1] }, position: [0, 0, 0] });
  step(e, 10);
  assert.equal(value(w, id, 'transform', 'y'), 2);
  assert.equal(e.raycast([-2, 0, 0], [1, 0, 0], 5)?.entity, id);
});

// speed budgets are sized for the owner's minimum-spec laptop (2015 i7-6700HQ; about 1.1 s there). Tests named `performance:` run
// on their own after the others (scripts/verify.mjs), because timings taken while every test file runs at once swing by 4x.
test('performance: 100 balls simulate five seconds in under four seconds', () => {
  const { w, e } = setup(); floor(e, w);
  const ids: EntityId[] = [];
  for (let z = 0; z < 10; z++) for (let x = 0; x < 10; x++) {
    ids.push(ball(e, w, [-9 + x * 2, 1.5 + (x % 3) * 0.1, -9 + z * 2]));
  }
  const start = performance.now(); step(e, 600);
  const elapsed = performance.now() - start;
  console.info(`100-ball simulation: ${elapsed.toFixed(1)} ms`);
  assert.ok(elapsed < 4000, `100-ball simulation took ${elapsed.toFixed(1)} ms`);
  assert.ok(ids.every((id) => Math.abs(value(w, id, 'transform', 'y') - 0.5) < 0.02));
});