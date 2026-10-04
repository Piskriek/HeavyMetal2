import test from 'node:test';
import assert from 'node:assert/strict';
import { addKey, bake, duration, moveKeys, removeKey, scaleKeys, snapTime, valueAt, type Interp, type Track } from '../src/index';
const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const tr = (interp: Interp, keys: [number, number][]): Track => ({ id: 'x', keys: keys.map(([t, v]) => ({ t, v, interp })) });

test('step, straight and the ends', () => {
  const s = tr('step', [[0, 0], [1, 10]]); near(valueAt(s, 0.9), 0); near(valueAt(s, 1), 10);
  const l = tr('linear', [[0, 0], [2, 10]]); near(valueAt(l, 0.5), 2.5); near(valueAt(l, -1), 0); near(valueAt(l, 9), 10);
  near(valueAt({ id: 'e', keys: [] }, 3), 0);
});
test('smooth goes through every key with automatic tangents', () => {
  const s = tr('smooth', [[0, 0], [1, 1], [2, 0]]);
  near(valueAt(s, 1), 1); near(valueAt(s, 0.5), 0.625); near(valueAt(s, 1.5), 0.625);
});
test('bezier follows its tangent handles', () => {
  const flat: Track = { id: 'b', keys: [{ t: 0, v: 0, interp: 'bezier', outTan: 0 }, { t: 1, v: 1, interp: 'bezier', inTan: 0 }] };
  near(valueAt(flat, 0.5), 0.5); near(valueAt(flat, 0.25), 0.15625);
  const steady: Track = { id: 'b', keys: [{ t: 0, v: 0, interp: 'bezier', outTan: 1 }, { t: 1, v: 1, interp: 'bezier', inTan: 1 }] };
  near(valueAt(steady, 0.25), 0.25);
});
test('adding, removing, moving and stretching keys', () => {
  let t = tr('linear', [[0, 0], [2, 2]]);
  t = addKey(t, { t: 1, v: 5, interp: 'linear' }); assert.deepEqual(t.keys.map((k) => k.t), [0, 1, 2]); near(valueAt(t, 1), 5);
  t = addKey(t, { t: 1, v: 7, interp: 'linear' }); assert.equal(t.keys.length, 3); near(valueAt(t, 1), 7);
  assert.deepEqual(removeKey(t, 1).keys.map((k) => k.t), [0, 2]);
  assert.deepEqual(moveKeys(t, [0], 1.5).keys.map((k) => [k.t, k.v]), [[1, 7], [1.5, 0], [2, 2]]);
  assert.deepEqual(scaleKeys(t, [1, 2], 0, 2).keys.map((k) => k.t), [0, 2, 4]);
  assert.deepEqual(t.keys.map((k) => k.t), [0, 1, 2]);
});
test('bake, snap and duration', () => {
  assert.deepEqual(bake(tr('linear', [[0, 0], [1, 1]]), 4, 0, 1), [0, 0.25, 0.5, 0.75, 1]);
  near(snapTime(0.26, 24), 0.25);
  near(duration([tr('linear', [[0.5, 0], [2, 1]]), tr('step', [[1, 0], [3, 1]])]), 2.5);
  near(duration([]), 0);
});

test('edits return independent sorted tracks', () => {
  const original = tr('linear', [[0, 0], [1, 1], [2, 2]]);
  const replaced = addKey(original, { t: 1 + 5e-7, v: 9, interp: 'linear' });

  assert.deepEqual(original.keys.map((key) => key.t), [0, 1, 2]);
  assert.deepEqual(replaced.keys.map((key) => key.t), [0, 1 + 5e-7, 2]);
  assert.notEqual(replaced.keys, original.keys);
  assert.notEqual(replaced.keys[0], original.keys[0]);
  assert.deepEqual(moveKeys(original, [2], -3).keys.map((key) => key.t), [-1, 0, 1]);
});

test('bake includes a partial final interval', () => {
  assert.deepEqual(
    bake(tr('linear', [[0, 0], [2, 2]]), 2, 0, 1.25),
    [0, 0.5, 1, 1.25],
  );
});

test('bezier missing tangents default to zero', () => {
  const track: Track = {
    id: 'missing',
    keys: [
      { t: 0, v: 0, interp: 'bezier' },
      { t: 1, v: 1, interp: 'bezier' },
    ],
  };

  near(valueAt(track, 0.25), 0.15625);
});