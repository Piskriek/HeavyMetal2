import test from 'node:test';
import assert from 'node:assert/strict';
import type { BodySpec, EntityId } from '@hm/contracts';
import { createPhysics, definePhysicsComponents, createPhysicsSystem } from '../src/physics';
import { fakeWorld, transformDef, type TestWorld } from './helpers';

function setup(gravity?: readonly [number, number, number]) {
  const w = fakeWorld();
  w.defineComponent(transformDef);
  definePhysicsComponents(w);
  const e = createPhysics();
  e.attach(w);
  if (gravity) e.setGravity(gravity);
  return { w, e };
}
type Eng = ReturnType<typeof setup>['e'];
const ball = (e: Eng, w: TestWorld, pos: [number, number, number], extra: Partial<BodySpec> = {}): EntityId => {
  const id = w.spawn();
  e.addBody(id, { kind: 'dynamic', collider: { shape: 'sphere', radius: 0.5 }, mass: 1, friction: 0.5, restitution: 0, position: pos, tier: 'racing', ...extra });
  return id;
};
const ground = (e: Eng, w: TestWorld, extra: Partial<BodySpec> = {}): EntityId => {
  const id = w.spawn();
  e.addBody(id, { kind: 'static', collider: { shape: 'heightfield', cols: 3, rows: 3, cell: 20, heights: [0, 0, 0, 0, 0, 0, 0, 0, 0] }, position: [-20, 0, -20], friction: 0.5, restitution: 0, tier: 'racing', ...extra });
  return id;
};
const run = (e: Eng, secs: number, each?: (tick: number) => void): void => { const n = Math.round(secs * 120); for (let i = 0; i < n; i++) { each?.(i); e.step(1 / 120); } };
const P = (w: TestWorld, id: EntityId): number[] => { const t = w.get(id, 'transform')!; return [t.x as number, t.y as number, t.z as number]; };
const V = (w: TestWorld, id: EntityId): number[] => { const v = w.get(id, 'velocity')!; return [v.vx as number, v.vy as number, v.vz as number]; };

test('free fall matches y0 - g t^2 / 2 within the integrator error, default gravity is -9.81 on Y', () => {
  const { w, e } = setup();
  const b = ball(e, w, [0, 100, 0]);
  run(e, 1);
  assert.ok(Math.abs(P(w, b)[1]! - (100 - 4.905)) < 0.06, `y=${P(w, b)[1]}`);
  assert.ok(Math.abs(V(w, b)[1]! + 9.81) < 0.02);
});

test('a ball dropped on a flat heightfield comes to rest at y = radius', () => {
  const { w, e } = setup();
  ground(e, w);
  const b = ball(e, w, [0, 3, 0]);
  run(e, 3);
  assert.ok(Math.abs(P(w, b)[1]! - 0.5) < 0.02, `y=${P(w, b)[1]}`);
  assert.ok(Math.hypot(...V(w, b)) < 0.05);
});

test('restitution 0.5 sends the ball back up to about a quarter of the drop height', () => {
  const { w, e } = setup();
  ground(e, w);
  const b = ball(e, w, [0, 5.5, 0], { restitution: 0.5 });
  let bounced = false, peak = 0;
  run(e, 3, () => { const vy = V(w, b)[1]!; if (vy > 0.5) bounced = true; if (bounced) peak = Math.max(peak, P(w, b)[1]!); });
  assert.ok(bounced);
  assert.ok(Math.abs(peak - 1.75) < 0.2, `peak=${peak}`);
});

test('a ball released on a 30 degree mesh ramp rolls (not slides) at about 5/7 g sin(a)', () => {
  const { w, e } = setup();
  const t = Math.tan(Math.PI / 6);
  const id = w.spawn();
  // plane y = -tan(30deg) * x, x in [-1, 60], z in [-10, 10]; descends towards +x
  e.addBody(id, { kind: 'static', collider: { shape: 'mesh', positions: [-1, t, -10, 60, -60 * t, -10, 60, -60 * t, 10, -1, t, 10], indices: [0, 1, 2, 0, 2, 3] }, position: [0, 0, 0], friction: 1, restitution: 0, tier: 'racing' });
  const b = ball(e, w, [0.25, 0.434, 0], { friction: 1 });
  let worst = 0;
  run(e, 1, () => { const p = P(w, b); const d = Math.sin(Math.PI / 6) * p[0]! + Math.cos(Math.PI / 6) * p[1]!; worst = Math.max(worst, 0.5 - d); });
  const v = Math.hypot(...V(w, b));
  assert.ok(v > 2.7 && v < 4.3, `speed=${v}`);
  assert.ok(worst < 0.06, `penetration=${worst}`);
  const wv = w.get(b, 'velocity')!;
  const spin = Math.hypot(wv.wx as number, wv.wy as number, wv.wz as number);
  assert.ok(Math.abs(spin * 0.5 - v) / v < 0.3, `spin=${spin} speed=${v}`);
  assert.ok((w.get(b, 'transform')!.qw as number) < 0.999, 'rotation was integrated');
});

test('a ball stops at a box wall and a very fast ball does not tunnel through a thin one', () => {
  const a = setup([0, 0, 0]);
  const wall = a.w.spawn();
  a.e.addBody(wall, { kind: 'static', collider: { shape: 'box', half: [0.05, 5, 5] }, position: [0, 0, 0], restitution: 0.5, tier: 'racing' });
  const fast = ball(a.e, a.w, [-5, 0, 0], { restitution: 0.5 });
  a.w.set(fast, 'velocity', { vx: 90 });
  let maxX = -Infinity;
  run(a.e, 0.5, () => { maxX = Math.max(maxX, P(a.w, fast)[0]!); });
  assert.ok(maxX < 0, `maxX=${maxX}`);
  assert.ok(V(a.w, fast)[0]! < 0, 'it bounced back');
  const b = setup([0, 0, 0]);
  const wall2 = b.w.spawn();
  b.e.addBody(wall2, { kind: 'static', collider: { shape: 'box', half: [0.5, 1, 5] }, position: [0, 1, 0], restitution: 0, tier: 'racing' });
  const slow = ball(b.e, b.w, [-5, 1, 0]);
  b.w.set(slow, 'velocity', { vx: 10 });
  run(b.e, 2);
  assert.ok(P(b.w, slow)[0]! <= -0.99, `x=${P(b.w, slow)[0]}`);
});

test('the same inputs give bit-identical results; the engine keeps no dynamic state of its own', () => {
  const build = () => {
    const s = setup(); ground(s.e, s.w, { friction: 0.7 });
    const bs = [ball(s.e, s.w, [0, 4, 0], { restitution: 0.4 }), ball(s.e, s.w, [0.6, 6, 0.1], { restitution: 0.3 })];
    return { ...s, bs };
  };
  const drive = (s: ReturnType<typeof build>, from: number, to: number): void => {
    for (let i = from; i < to; i++) { if (i % 10 === 0) s.e.applyForce(s.bs[0]!, [3, 0, 1]); if (i === 100) s.e.applyImpulse(s.bs[1]!, [0, 2, 1]); s.e.step(1 / 120); }
  };
  const dump = (s: ReturnType<typeof build>): string => JSON.stringify(s.bs.map((id) => [s.w.get(id, 'transform'), s.w.get(id, 'velocity')]));
  const a = build(), b = build();
  drive(a, 0, 600); drive(b, 0, 600);
  assert.equal(dump(a), dump(b));
  // restore: copy the state of a at tick 300 into a fresh world and continue; must equal the straight run
  const c = build(), d = build();
  drive(c, 0, 300);
  for (let i = 0; i < d.bs.length; i++) { d.w.set(d.bs[i]!, 'transform', c.w.get(c.bs[i]!, 'transform')!); d.w.set(d.bs[i]!, 'velocity', c.w.get(c.bs[i]!, 'velocity')!); }
  drive(c, 300, 600); drive(d, 300, 600);
  assert.equal(dump(c), dump(d));
  assert.equal(dump(c), dump(a));
});

test('raycast hits the heightfield and boxes, returns entity, distance, point and normal; misses return null', () => {
  const { w, e } = setup();
  const g = ground(e, w);
  const box = w.spawn();
  e.addBody(box, { kind: 'static', collider: { shape: 'box', half: [1, 1, 1] }, position: [10, 1, 0], tier: 'racing' });
  const down = e.raycast([5, 10, 5], [0, -1, 0], 100)!;
  assert.equal(down.entity, g); assert.ok(Math.abs(down.distance - 10) < 1e-6); assert.ok(Math.abs(down.normal[1] - 1) < 1e-6);
  const side = e.raycast([0, 1, 0], [1, 0, 0], 100)!;
  assert.equal(side.entity, box); assert.ok(Math.abs(side.distance - 9) < 1e-6); assert.ok(Math.abs(side.normal[0] + 1) < 1e-6);
  assert.equal(e.raycast([5, 10, 5], [0, -1, 0], 5), null);
  assert.equal(e.raycast([5, 10, 5], [0, 1, 0], 100), null);
});

test('trigger colliders report enter and exit once and do not push the ball', () => {
  const { w, e } = setup([0, 0, 0]);
  const trig = w.spawn();
  e.addBody(trig, { kind: 'static', collider: { shape: 'box', half: [1, 5, 5] }, position: [0, 0, 0], tier: 'trigger' });
  const b = ball(e, w, [-5, 0, 0], { linearDamping: 0 });
  w.set(b, 'velocity', { vx: 5 });
  const log: string[] = [];
  e.onTrigger((entity, trigger, enter) => log.push(`${enter ? 'enter' : 'exit'} ${entity} ${trigger}`));
  run(e, 3);
  assert.deepEqual(log, [`enter ${b} ${trig}`, `exit ${b} ${trig}`]);
  assert.ok(Math.abs(V(w, b)[0]! - 5) < 1e-6);
});

test('tiers: a racing ball ignores decor statics and collides with racing ones', () => {
  const { w, e } = setup([0, 0, 0]);
  const decor = w.spawn();
  e.addBody(decor, { kind: 'static', collider: { shape: 'box', half: [0.5, 5, 5] }, position: [0, 0, 0], tier: 'decor' });
  const b = ball(e, w, [-3, 0, 0]);
  w.set(b, 'velocity', { vx: 5 });
  run(e, 2);
  assert.ok(P(w, b)[0]! > 2, `x=${P(w, b)[0]}`);
});

test('impulse and force: impulse/mass changes velocity at once, a force acts for one step only', () => {
  const { w, e } = setup([0, 0, 0]);
  const b = ball(e, w, [0, 0, 0], { mass: 2, linearDamping: 0 });
  e.applyImpulse(b, [0, 0, 10]);
  assert.ok(Math.abs(V(w, b)[2]! - 5) < 1e-9);
  e.applyForce(b, [4, 0, 0]);
  e.step(1 / 120);
  assert.ok(Math.abs(V(w, b)[0]! - 4 / 2 / 120) < 1e-9);
  e.step(1 / 120);
  assert.ok(Math.abs(V(w, b)[0]! - 4 / 2 / 120) < 1e-9, 'the force is cleared after the step');
});

test('removeBody on a static collider makes the ball fall through; the physics system steps with ctx.dt', () => {
  const { w, e } = setup();
  const g = ground(e, w);
  const b = ball(e, w, [0, 2, 0]);
  const sys = createPhysicsSystem(e);
  assert.equal(sys.name, 'physics');
  for (let i = 0; i < 240; i++) sys.update(w, { dt: 1 / 120, tick: i });
  assert.ok(Math.abs(P(w, b)[1]! - 0.5) < 0.05);
  e.removeBody(g);
  for (let i = 0; i < 240; i++) sys.update(w, { dt: 1 / 120, tick: i });
  assert.ok(P(w, b)[1]! < -5);
});