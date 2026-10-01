import test from 'node:test';
import assert from 'node:assert/strict';
import type { ManipulationSettings, Vec3 } from '@hm/contracts';
import { DEFAULT_MANIPULATION, constrainDelta, expandPlacements, manipulateMove, mirrorPoint, pivotOf, quatFromUpTo, rotateByQuat, rotateYaw, snapAngle, snapPoint, snapValue } from '../src/manipulate';

const S = (o: Partial<ManipulationSettings>): ManipulationSettings => ({ ...DEFAULT_MANIPULATION, ...o });
const near = (a: readonly number[], b: readonly number[], eps = 1e-9): void => { assert.equal(a.length, b.length); a.forEach((v, i) => assert.ok(Math.abs(v - (b[i] as number)) < eps, `${a} !~ ${b}`)); };

test('snapValue rounds to the step, step 0 is off, no negative zero', () => {
  assert.equal(snapValue(1.26, 0.5), 1.5);
  assert.equal(snapValue(1.24, 0.5), 1);
  assert.equal(snapValue(3.3, 0), 3.3);
  assert.ok(Object.is(snapValue(-0.1, 1), 0));
  near(snapPoint([1.2, 2.6, -0.4], 1), [1, 3, 0]);
});

test('snapAngle snaps and normalises to (-180, 180]', () => {
  assert.equal(snapAngle(47, 15), 45);
  assert.equal(snapAngle(190, 0), -170);
  assert.equal(snapAngle(-180, 15), 180);
  assert.equal(snapAngle(370, 15), 15);
});

test('constrainDelta in world and local space', () => {
  near(constrainDelta([1, 2, 3], 'xz', 'world'), [1, 0, 3]);
  near(constrainDelta([1, 2, 3], 'free', 'world'), [1, 2, 3]);
  const q: [number, number, number, number] = [0, Math.SQRT1_2, 0, Math.SQRT1_2]; // 90 degrees about Y: local +X is world -Z
  near(constrainDelta([0, 0, -2], 'x', 'local', q), [0, 0, -2]);
  near(constrainDelta([5, 0, 0], 'x', 'local', q), [0, 0, 0]);
});

test('rotateByQuat: 90 degrees about Y takes +X to -Z', () => {
  near(rotateByQuat([1, 0, 0], [0, Math.SQRT1_2, 0, Math.SQRT1_2]), [0, 0, -1]);
});

test('manipulateMove: constraint then grid; a locked axis keeps its exact value', () => {
  const r = manipulateMove(S({ axes: 'x', snapGrid: 1 }), [0.3, 0.7, 0.2], [4.4, 9, 9]);
  near(r.position, [4, 0.7, 0.2]);
  assert.equal(r.snappedToSurface, false);
});

test('manipulateMove: surface snap replaces the position and aligns up to the normal', () => {
  const r = manipulateMove(S({ snapToSurface: true, alignToNormal: true }), [0, 0, 0], [1, 1, 1], { surface: { point: [5, 2, 5], normal: [1, 0, 0] } });
  near(r.position, [5, 2, 5]);
  assert.ok(r.snappedToSurface && r.rotation);
  near(rotateByQuat([0, 1, 0], r.rotation!), [1, 0, 0], 1e-9);
  const none = manipulateMove(S({ snapToSurface: true }), [0, 0, 0], [1, 1, 1], { surface: null });
  near(none.position, [1, 1, 1]);
});

test('quatFromUpTo handles identity, opposite and arbitrary normals', () => {
  near(quatFromUpTo([0, 1, 0]), [0, 0, 0, 1]);
  near(rotateByQuat([0, 1, 0], quatFromUpTo([0, -1, 0])), [0, -1, 0], 1e-9);
  const n: Vec3 = [1, 2, 3];
  const l = Math.hypot(...n);
  near(rotateByQuat([0, 1, 0], quatFromUpTo(n)), [n[0] / l, n[1] / l, n[2] / l], 1e-9);
});

test('magnet pulls to the nearest target inside the radius by strength', () => {
  const s = S({ magnet: { radius: 2, strength: 0.5 } });
  const r = manipulateMove(s, [0, 0, 0], [1, 0, 0], { magnetTargets: [[5, 0, 0], [2, 0, 0], [1.5, 0, 0]] });
  near(r.position, [1.25, 0, 0]);
  assert.deepEqual(r.magnetTarget, [1.5, 0, 0]);
  const far = manipulateMove(s, [0, 0, 0], [1, 0, 0], { magnetTargets: [[9, 0, 0]] });
  near(far.position, [1, 0, 0]);
  assert.equal(far.magnetTarget, null);
});

test('pivotOf: centre, first, ground, cursor', () => {
  const ps: Vec3[] = [[0, 2, 0], [4, 4, 2]];
  near(pivotOf(S({ pivot: 'center' }), ps), [2, 3, 1]);
  near(pivotOf(S({ pivot: 'first' }), ps), [0, 2, 0]);
  near(pivotOf(S({ pivot: 'ground' }), ps), [2, 0, 1]);
  near(pivotOf(S({ pivot: 'cursor' }), ps, [9, 9, 9]), [9, 9, 9]);
  near(pivotOf(S({}), []), [0, 0, 0]);
});

test('mirror and array expand a placement in a stable order', () => {
  near(mirrorPoint([3, 1, 2], 'x', [1, 0, 0]), [-1, 1, 2]);
  near(mirrorPoint([3, 1, 2], 'z'), [3, 1, -2]);
  const out = expandPlacements(S({ array: { count: 3, offset: [2, 0, 0] }, mirror: 'z' }), [0, 0, 1]);
  assert.equal(out.length, 6);
  assert.deepEqual(out.map((p) => [p.index, p.mirrored]), [[0, 'none'], [0, 'z'], [1, 'none'], [1, 'z'], [2, 'none'], [2, 'z']]);
  near(out[4]!.position, [4, 0, 1]);
  near(out[5]!.position, [4, 0, -1]);
  assert.equal(expandPlacements(S({ array: { count: 1e9, offset: [1, 0, 0] } }), [0, 0, 0]).length, 256);
  assert.equal(expandPlacements(S({ array: { count: 0, offset: [1, 0, 0] } }), [0, 0, 0]).length, 1);
});

test('rotateYaw applies the angle snap', () => {
  assert.equal(rotateYaw(S({ snapAngle: 15 }), 40, 12), 45);
  assert.equal(rotateYaw(S({}), 40, 12.5), 52.5);
});
