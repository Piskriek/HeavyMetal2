import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PITCH, MAX_DIST, MIN_DIST, orbitPosition, orbit, zoom, pan, project, rayFromPixel, stateFromPositionTarget, type OrbitState } from '../src/camera-math';
import { rayHitSphere, rayHitBox, rayHitPlaneY, pickScene } from '../src/pick-math';
import type { Vec3 } from '@hm/contracts';

const near = (a: number, b: number, eps = 1e-6): void => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const near3 = (a: readonly number[], b: readonly number[], eps = 1e-6): void => { for (let i = 0; i < 3; i++) near(a[i] as number, b[i] as number, eps); };
const base: OrbitState = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 10, fov: 50 };

test('orbitPosition: yaw 0 is +Z, yaw 90deg is +X, pitch raises the camera', () => {
  near3(orbitPosition(base), [0, 0, 10]);
  near3(orbitPosition({ ...base, yaw: Math.PI / 2 }), [10, 0, 0]);
  near3(orbitPosition({ ...base, pitch: Math.PI / 2 }), [0, 10, 0]);
  near3(orbitPosition({ ...base, target: [1, 2, 3] }), [1, 2, 13]);
});

test('stateFromPositionTarget inverts orbitPosition', () => {
  const s = stateFromPositionTarget([10, 0, 0], [0, 0, 0], 50);
  near(s.yaw, Math.PI / 2); near(s.pitch, 0); near(s.distance, 10); assert.equal(s.fov, 50);
  const t: OrbitState = { target: [1, 2, 3], yaw: 0.7, pitch: 0.4, distance: 25, fov: 60 };
  const back = stateFromPositionTarget(orbitPosition(t), t.target, 60);
  near(back.yaw, 0.7); near(back.pitch, 0.4); near(back.distance, 25);
});

test('orbit adds the deltas and clamps pitch to +-MAX_PITCH', () => {
  const a = orbit(base, 0.5, 0.25);
  near(a.yaw, 0.5); near(a.pitch, 0.25);
  assert.equal(orbit(base, 0, 10).pitch, MAX_PITCH);
  assert.equal(orbit(base, 0, -10).pitch, -MAX_PITCH);
  assert.equal(base.yaw, 0); // input is not mutated
});

test('zoom multiplies the distance and clamps', () => {
  near(zoom(base, 0.5).distance, 5);
  assert.equal(zoom(base, 1e-9).distance, MIN_DIST);
  assert.equal(zoom(base, 1e9).distance, MAX_DIST);
});

test('pan moves the target along the camera right/up axes (world units)', () => {
  near3(pan(base, 1, 2).target, [1, 2, 0]);
  near3(pan({ ...base, yaw: Math.PI / 2 }, 1, 0).target, [0, 0, -1]);
});

test('project: target is the screen centre, +X is to the right, behind the camera is null', () => {
  const c = project(base, [0, 0, 0], 800, 600);
  assert.ok(c); near(c[0], 400); near(c[1], 300);
  const r = project(base, [1, 0, 0], 800, 600);
  assert.ok(r && r[0] > 400); near(r[1], 300);
  const up = project(base, [0, 1, 0], 800, 600);
  assert.ok(up && up[1] < 300); // screen y grows downwards
  assert.equal(project(base, [0, 0, 20], 800, 600), null);
});

test('rayFromPixel: centre ray looks down -Z from the camera; the ray through project(p) hits p', () => {
  const ray = rayFromPixel(base, 400, 300, 800, 600);
  near3(ray.origin, [0, 0, 10]); near3(ray.direction, [0, 0, -1]);
  const s: OrbitState = { target: [1, 0, -2], yaw: 0.6, pitch: 0.5, distance: 14, fov: 45 };
  const p: Vec3 = [2, 1.5, 0.5];
  const px = project(s, p, 640, 480);
  assert.ok(px);
  const r = rayFromPixel(s, px[0], px[1], 640, 480);
  near(Math.hypot(...r.direction), 1);
  const o = r.origin, d = r.direction;
  const t = (p[0] - o[0]) * d[0] + (p[1] - o[1]) * d[1] + (p[2] - o[2]) * d[2];
  near3([o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t], p, 1e-4);
});

test('ray tests: sphere, box, ground plane', () => {
  const o: Vec3 = [0, 0, 10], d: Vec3 = [0, 0, -1];
  near(rayHitSphere(o, d, [0, 0, 0], 1) as number, 9);
  assert.equal(rayHitSphere(o, d, [5, 0, 0], 1), null);
  assert.equal(rayHitSphere(o, [0, 0, 1], [0, 0, 0], 1), null); // sphere is behind
  near(rayHitBox(o, d, [0, 0, 0], [1, 1, 1]) as number, 9);
  assert.equal(rayHitBox(o, d, [3, 0, 0], [1, 1, 1]), null);
  near(rayHitBox([0, 0, 0], d, [0, 0, 0], [1, 1, 1]) as number, 0); // starting inside hits at 0
  near(rayHitPlaneY([0, 5, 0], [0, -1, 0], 2) as number, 3);
  assert.equal(rayHitPlaneY([0, 5, 0], [0, 1, 0], 0), null);
  assert.equal(rayHitPlaneY([0, 5, 0], [1, 0, 0], 0), null);
});

test('pickScene returns the nearest item, then the ground, then a miss', () => {
  const items = [
    { entity: 7, shape: 'sphere' as const, center: [0, 1, 0] as Vec3, size: 1 },
    { entity: 8, shape: 'box' as const, center: [0, 1, -5] as Vec3, size: 1 },
  ];
  const ray = { origin: [0, 1, 10] as Vec3, direction: [0, 0, -1] as Vec3 };
  const hit = pickScene(ray, items, 0);
  assert.equal(hit.entity, 7); near(hit.distance, 9);
  assert.ok(hit.point && hit.normal); near3(hit.point, [0, 1, 1]); near3(hit.normal, [0, 0, 1]);
  const down = pickScene({ origin: [20, 5, 0], direction: [0, -1, 0] }, items, 0);
  assert.equal(down.entity, null); near(down.distance, 5); near3(down.point as Vec3, [20, 0, 0]); near3(down.normal as Vec3, [0, 1, 0]);
  const miss = pickScene({ origin: [20, 5, 0], direction: [0, 1, 0] }, items, 0);
  assert.deepEqual(miss, { entity: null, point: null, normal: null, distance: Infinity });
  assert.equal(pickScene({ origin: [20, 5, 0], direction: [0, -1, 0] }, items, null).entity, null);
});