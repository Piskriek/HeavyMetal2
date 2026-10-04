import test from 'node:test';
import assert from 'node:assert/strict';
import { drag, gizmoGrow, hitTest, worldLength, type Ray } from '../src/index';
const near = (a: number, b: number, e = 1e-6): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const down = (x: number, z: number): Ray => ({ origin: [x, 5, z], dir: [0, -1, 0] });
const fwd = (x: number, y: number): Ray => ({ origin: [x, y, 5], dir: [0, 0, -1] });
const M = { mode: 'move' as const, pivot: [0, 0, 0] as [number, number, number] };
const R = { mode: 'rotate' as const, pivot: [0, 0, 0] as [number, number, number] };
const S = { mode: 'scale' as const, pivot: [0, 0, 0] as [number, number, number] };

test('+ and - size the gizmo, clamped', () => {
  near(gizmoGrow(1, 2), 1.3225); near(gizmoGrow(1, -1), 1 / 1.15);
  assert.equal(gizmoGrow(1, 100), 5); assert.equal(gizmoGrow(1, -100), 0.2);
  near(worldLength([0, 0, 0], [0, 0, 10], 90, 1), 1.8);
});
test('move: an arrow, a plane, a miss', () => {
  assert.deepEqual(hitTest(M, down(0.5, 0), 1), { kind: 'axis', axis: 'x' });
  assert.deepEqual(hitTest(M, down(0.3, 0.3), 1), { kind: 'plane', axes: ['x', 'z'] });
  assert.equal(hitTest(M, down(3, 3), 1), null);
});
test('rotate: the z ring', () => {
  assert.deepEqual(hitTest(R, fwd(1, 0), 1), { kind: 'ring', axis: 'z' });
});
test('scale: the uniform handle beats the axes', () => {
  assert.deepEqual(hitTest(S, fwd(0.05, 0.05), 1), { kind: 'uniform' });
});
test('drag along x, with and without the grid', () => {
  assert.deepEqual(drag(M, { kind: 'axis', axis: 'x' }, down(0.5, 0), down(2.5, 0), 1).translate, [2, 0, 0]);
  const t = drag(M, { kind: 'axis', axis: 'x' }, down(0.5, 0), down(2.3, 0), 1, { move: 0.5 }).translate;
  near(t[0], 2); near(t[1], 0); near(t[2], 0);
});
test('drag in the xz plane', () => {
  const t = drag(M, { kind: 'plane', axes: ['x', 'z'] }, down(0.3, 0.3), down(1.3, -0.7), 1).translate;
  near(t[0], 1); near(t[1], 0); near(t[2], -1);
});
test('turn the z ring a quarter, and snap 50 degrees to 45', () => {
  const r = drag(R, { kind: 'ring', axis: 'z' }, fwd(1, 0), fwd(0, 1), 1);
  assert.deepEqual(r.rotateAxis, [0, 0, 1]); near(r.rotateDeg, 90);
  const a = (50 * Math.PI) / 180;
  near(drag(R, { kind: 'ring', axis: 'z' }, fwd(1, 0), fwd(Math.cos(a), Math.sin(a)), 1, { turn: 45 }).rotateDeg, 45);
});
test('scale along x doubles; uniform doubles all', () => {
  const s = drag(S, { kind: 'axis', axis: 'x' }, down(0.5, 0), down(1, 0), 1).scale;
  near(s[0], 2); near(s[1], 1); near(s[2], 1);
  const u = drag(S, { kind: 'uniform' }, fwd(0.1, 0), fwd(0.2, 0), 1).scale;
  near(u[0], 2); near(u[1], 2); near(u[2], 2);
});

/* ---------------- extra tests ---------------- */

test('gizmoGrow is reversible inside the clamp', () => {
  near(gizmoGrow(gizmoGrow(1, 3), -3), 1);
  near(gizmoGrow(2, 0), 2);
});

test('worldLength scales with distance, fov and gizmo scale', () => {
  near(worldLength([0, 0, 0], [0, 0, 20], 90, 1), 3.6);
  near(worldLength([1, 2, 3], [1, 2, 13], 90, 2), 3.6);
  near(worldLength([0, 0, 0], [0, 0, 10], 60, 1), 10 * Math.tan(Math.PI / 6) * 0.18);
});

test('move: the y arrow and the xy plane', () => {
  assert.deepEqual(hitTest(M, fwd(0, 0.6), 1), { kind: 'axis', axis: 'y' });
  assert.deepEqual(hitTest(M, fwd(0.3, 0.3), 1), { kind: 'plane', axes: ['x', 'y'] });
  // negative quadrant is not part of the quad
  assert.equal(hitTest(M, down(-0.3, -0.3), 1), null);
});

test('move: just outside the arrow tolerance misses', () => {
  assert.deepEqual(hitTest(M, down(0.5, 0.07), 1), { kind: 'axis', axis: 'x' });
  assert.equal(hitTest(M, down(0.5, 0.09), 1), null);
  // beyond the arrow length
  assert.equal(hitTest(M, down(1.5, 0), 1), null);
});

test('rotate: the view ring and the other axis rings', () => {
  assert.deepEqual(hitTest(R, fwd(1.2, 0), 1), { kind: 'view-ring' });
  assert.equal(hitTest(R, fwd(0.5, 0.5), 1), null);
  // looking down hits the y ring (plane y = 0, radius 1)
  assert.deepEqual(hitTest(R, down(0, 1), 1), { kind: 'ring', axis: 'y' });
  // looking along +x hits the x ring (plane x = 0, radius 1)
  assert.deepEqual(hitTest(R, { origin: [-5, 0, 1], dir: [1, 0, 0] }, 1), { kind: 'ring', axis: 'x' });
});

test('a ray parallel to a plane never hits it', () => {
  // straight at the pivot along x: every ring plane is parallel or missed
  const parallel: Ray = { origin: [-5, 0, 0], dir: [1, 0, 0] };
  assert.equal(hitTest(R, parallel, 1), null);
});

test('scale: axes still work away from the sphere', () => {
  assert.deepEqual(hitTest(S, down(0.6, 0), 1), { kind: 'axis', axis: 'x' });
  assert.equal(hitTest(S, down(3, 3), 1), null);
  // no planes in scale mode
  assert.equal(hitTest(S, down(0.3, 0.3), 1), null);
});

test('unused drag fields stay neutral', () => {
  const r = drag(M, { kind: 'axis', axis: 'z' }, down(0, 0.5), down(0, 1.25), 1);
  assert.equal(r.rotateAxis, null);
  near(r.rotateDeg, 0);
  assert.deepEqual(r.scale, [1, 1, 1]);
  near(r.translate[2], 0.75);
  near(r.translate[0], 0);
});

test('plane drag snaps each component', () => {
  const t = drag(M, { kind: 'plane', axes: ['x', 'z'] }, down(0.3, 0.3), down(1.4, -0.6), 1, { move: 0.5 }).translate;
  near(t[0], 1); near(t[1], 0); near(t[2], -1);
});

test('ring drag is signed and right-handed', () => {
  const r = drag(R, { kind: 'ring', axis: 'z' }, fwd(0, 1), fwd(1, 0), 1);
  near(r.rotateDeg, -90);
  assert.deepEqual(r.rotateAxis, [0, 0, 1]);
  assert.deepEqual(r.translate, [0, 0, 0]);
  assert.deepEqual(r.scale, [1, 1, 1]);
});

test('view ring turns round the negated view direction', () => {
  const r = drag(R, { kind: 'view-ring' }, fwd(1.2, 0), fwd(0, 1.2), 1);
  assert.deepEqual(r.rotateAxis, [0, 0, 1]);
  near(r.rotateDeg, 90);
  const back = drag(R, { kind: 'view-ring' }, { origin: [1.2, 0, -5], dir: [0, 0, 1] }, { origin: [0, 1.2, -5], dir: [0, 0, 1] }, 1);
  assert.deepEqual(back.rotateAxis, [0, 0, -1]);
  near(back.rotateDeg, -90);
});

test('turn snapping rounds to the nearest step', () => {
  const a = (20 * Math.PI) / 180;
  near(drag(R, { kind: 'ring', axis: 'z' }, fwd(1, 0), fwd(Math.cos(a), Math.sin(a)), 1, { turn: 15 }).rotateDeg, 15);
  const b = (-37 * Math.PI) / 180;
  near(drag(R, { kind: 'ring', axis: 'z' }, fwd(1, 0), fwd(Math.cos(b), Math.sin(b)), 1, { turn: 45 }).rotateDeg, -45);
});

test('scale snapping rounds the ratio to steps', () => {
  const s = drag(S, { kind: 'axis', axis: 'y' }, fwd(0, 1), fwd(0, 2.4), 1, { scale: 0.5 }).scale;
  near(s[0], 1); near(s[1], 2.5); near(s[2], 1);
  const u = drag(S, { kind: 'uniform' }, fwd(0.1, 0), fwd(0.17, 0), 1, { scale: 0.25 }).scale;
  near(u[0], 1.75); near(u[1], 1.75); near(u[2], 1.75);
});

test('shrinking is a ratio below one', () => {
  const s = drag(S, { kind: 'axis', axis: 'x' }, down(1, 0), down(0.25, 0), 1).scale;
  near(s[0], 0.25);
  const u = drag(S, { kind: 'uniform' }, fwd(0.4, 0), fwd(0.2, 0), 1).scale;
  near(u[0], 0.5); near(u[1], 0.5); near(u[2], 0.5);
});

test('zero start distance keeps the scale neutral', () => {
  const s = drag(S, { kind: 'axis', axis: 'x' }, down(0, 0), down(1, 0), 1).scale;
  near(s[0], 1);
});

test('drag off the pivot works away from the origin', () => {
  const state = { mode: 'move' as const, pivot: [2, 1, -3] as [number, number, number] };
  const t = drag(state, { kind: 'axis', axis: 'x' }, down(2.5, -3), down(4, -3), 1).translate;
  near(t[0], 1.5); near(t[1], 0); near(t[2], 0);
  assert.deepEqual(hitTest(state, down(2.5, -3), 1), { kind: 'axis', axis: 'x' });
});