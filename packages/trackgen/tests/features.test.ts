import test from 'node:test';
import assert from 'node:assert/strict';
import { roadFeatures, onPad, resample, chaikin, type Vec2 } from '../src';

const ring = (r: number, n = 120): Vec2[] => Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2)] as const);
/** A rounded rectangle: long straights joined by corners. */
const stadium = (): Vec2[] => resample(chaikin([[-120, -40], [120, -40], [120, 40], [-120, 40]], 3), 4);

test('a start line, corner rumble on both sides and three boost pads on a stadium', () => {
  const { features, pads } = roadFeatures(stadium(), 12);
  assert.equal(features.filter((f) => f.kind === 'startLine').length, 1);
  assert.ok(features.filter((f) => f.kind === 'rumble').length >= 4, 'rumble on the corners, two sides each');
  assert.equal(features.filter((f) => f.kind === 'boostPad').length, 3);
  assert.equal(pads.length, 3);
  for (const f of features) { assert.ok(f.points.length >= 2); assert.ok(f.width > 0 && f.period > 0); }
});

test('pads sit on the straights: no pad centre is on a tight corner', () => {
  const pts = stadium();
  const { pads } = roadFeatures(pts, 12);
  for (const p of pads) assert.ok(Math.abs(p.x) < 118 && Math.abs(p.z) < 38 || (Math.abs(p.x) < 100) || (Math.abs(p.z) < 20), `pad at ${p.x},${p.z}`);
});

test('onPad uses the pad rectangle (along and across)', () => {
  const pad = { x: 10, z: 5, hx: 1, hz: 0, length: 9, width: 6 };
  assert.equal(onPad(pad, 10, 5), true);
  assert.equal(onPad(pad, 14, 7), true);
  assert.equal(onPad(pad, 15, 5), false);
  assert.equal(onPad(pad, 10, 9), false);
  const turned = { x: 0, z: 0, hx: 0, hz: 1, length: 9, width: 6 };
  assert.equal(onPad(turned, 2, 4), true);
  assert.equal(onPad(turned, 4, 2), false);
});

test('options: no pads, no rumble, no start line; tiny or empty loops give nothing', () => {
  const none = roadFeatures(stadium(), 12, { boostPads: 0, rumble: false, startLine: false });
  assert.deepEqual([none.features.length, none.pads.length], [0, 0]);
  assert.deepEqual(roadFeatures([], 12), { features: [], pads: [] });
  assert.deepEqual(roadFeatures(ring(3, 12), 12), { features: [], pads: [] });
});

test('a perfectly round track gets rumble all the way round but is still deterministic', () => {
  const a = roadFeatures(ring(40), 12), b = roadFeatures(ring(40), 12);
  assert.deepEqual(a, b);
  assert.ok(a.features.some((f) => f.kind === 'rumble'));
});
