import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPoint,
  analyse,
  closeLoop,
  deletePoint,
  DRAFT_PRESETS,
  emptyDraft,
  hitTest,
  insertOnSegment,
  loopLength,
  mirrorX,
  mirrorZ,
  movePoint,
  openLoop,
  presetDraft,
  reverse,
  rotate,
  scale,
  selfCrosses,
  setWidth,
  toCenterline,
  translate,
  createDraftHistory,
  type ControlPoint,
  type TrackDraft,
} from '../src';

const TAU = Math.PI * 2;

const ellipseDraft = (a: number, b: number, n: number, width = 12): TrackDraft => {
  const points: ControlPoint[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    points.push({ x: a * Math.cos(th), z: b * Math.sin(th) });
  }
  return { points, closed: true, width };
};

const circleDraft = (r: number, n = 12): TrackDraft => ellipseDraft(r, r, n);

const from = (pairs: readonly [number, number][]): TrackDraft =>
  pairs.reduce<TrackDraft>((acc, p) => addPoint(acc, p), emptyDraft(12));

const squareDraft = (): TrackDraft => closeLoop(from([[0, 0], [100, 0], [100, 100], [0, 100]]));

const span = (d: TrackDraft): { w: number; h: number } => {
  const b = analyse(d).bbox;
  return { w: b.maxX - b.minX, h: b.maxZ - b.minZ };
};

test('every preset yields a non-intersecting centreline at 4, 6 and 10 m spacing', () => {
  for (const preset of DRAFT_PRESETS) {
    for (const spacing of [4, 6, 10]) {
      const centre = toCenterline(preset.draft, spacing);
      assert.ok(centre.length >= 12, `${preset.id} @ ${spacing}`);
      assert.equal(selfCrosses(centre, true), false, `${preset.id} @ ${spacing}`);
    }
  }
});

test('presets stay inside the 50-90 m band and above the 200 m minimum', () => {
  for (const preset of DRAFT_PRESETS) {
    const a = analyse(preset.draft);
    const { w, h } = span(preset.draft);
    assert.ok(a.length >= 200 && a.length <= 2500, `${preset.id} length ${a.length}`);
    assert.ok(Math.max(w, h) >= 50 && Math.max(w, h) <= 90, `${preset.id} span ${w}x${h}`);
    assert.ok(Math.min(w, h) >= 45, `${preset.id} short side ${h}`);
  }
});

test('rotate by 2*pi is the identity within 0.02 m', () => {
  const d = circleDraft(40, 10);
  const back = rotate(d, TAU, [0, 0]);
  assert.equal(back.points.length, d.points.length);
  back.points.forEach((p, i) => {
    const q = d.points[i]!;
    assert.ok(Math.abs(p.x - q.x) < 0.02, `x ${p.x} vs ${q.x}`);
    assert.ok(Math.abs(p.z - q.z) < 0.02, `z ${p.z} vs ${q.z}`);
  });
  const offAxis = rotate(d, TAU, [12, -7]);
  offAxis.points.forEach((p, i) => {
    const q = d.points[i]!;
    assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < 0.02);
  });
});

test('mirroring twice restores the original point set', () => {
  const d = closeLoop(from([[0, 0], [70, -5], [90, 30], [55, 65], [10, 58]]));
  const x = mirrorX(mirrorX(d));
  const z = mirrorZ(mirrorZ(d));
  assert.deepEqual(x.points, d.points);
  assert.deepEqual(z.points, d.points);
  assert.notDeepEqual(mirrorX(d).points, d.points);
});

test('two control points give a straight open line even when closed is requested', () => {
  const d: TrackDraft = { points: [{ x: 0, z: 0 }, { x: 60, z: 0 }], closed: true, width: 12 };
  assert.equal(d.closed, true);
  const line = toCenterline(d, 6);
  assert.ok(line.length >= 3);
  assert.deepEqual(line[0], [0, 0]);
  assert.deepEqual(line[line.length - 1], [60, 0]);
  assert.ok(line.every((p) => Math.abs(p[1]) < 1e-9));
  assert.equal(analyse(d).issues.some((i) => /at least 3/i.test(i)), true);
});

test('centreline of an open draft starts and ends on the end control points', () => {
  const d = openLoop(circleDraft(50));
  const c = toCenterline(d, 4);
  assert.equal(selfCrosses(c, false), false);
  const first = d.points[0]!;
  const last = d.points[d.points.length - 1]!;
  assert.ok(Math.hypot(c[0]![0] - first.x, c[0]![1] - first.z) < 0.01);
  assert.ok(Math.hypot(c[c.length - 1]![0] - last.x, c[c.length - 1]![1] - last.z) < 0.01);
});

test('hitTest with radius 0 only hits exact geometry', () => {
  const d = squareDraft();
  const onPoint = hitTest(d, [0, 0], 0);
  assert.equal(onPoint.kind, 'point');
  assert.equal(onPoint.index, 0);
  assert.equal(onPoint.distance, 0);
  const onEdge = hitTest(d, [50, 0], 0);
  assert.equal(onEdge.kind, 'segment');
  assert.equal(onEdge.index, 0);
  assert.ok(Math.abs((onEdge.t ?? -1) - 0.5) < 1e-9);
  assert.equal(hitTest(d, [50, 50], 0).kind, 'none');
  assert.equal(hitTest(d, [-1, 0], 0).kind, 'none');
});

test('hitTest prefers points over segments and never returns negative distances', () => {
  const d = squareDraft();
  const near = hitTest(d, [1.5, 0.5], 8);
  assert.equal(near.kind, 'point');
  assert.equal(near.index, 0);
  assert.ok(near.distance >= 0);
  const corner = hitTest(d, [98, 99], 5);
  assert.equal(corner.kind, 'point');
  assert.equal(corner.index, 2);
});

test('a very elongated oval is rejected for tight corners, not for length', () => {
  const thin = ellipseDraft(90, 14, 16, 12);
  const a = analyse(thin);
  assert.equal(a.valid, false);
  assert.ok(a.length > 200, `length ${a.length}`);
  assert.ok(a.minRadius < 8, `minRadius ${a.minRadius}`);
  assert.ok(a.tightAt.length > 0);
  assert.ok(a.issues.some((i) => /tight/i.test(i)));
  assert.ok(!a.issues.some((i) => /too (short|long)/i.test(i)));
  assert.equal(a.selfIntersects, false);
});

test('centreline count follows length / spacing', () => {
  const d = circleDraft(50);
  for (const spacing of [2, 5, 10]) {
    const c = toCenterline(d, spacing);
    const expected = Math.round(loopLength(c, true) / spacing);
    assert.equal(Math.abs(c.length - Math.round((TAU * 50) / spacing)) <= 1, true, `spacing ${spacing}`);
    assert.equal(expected, c.length);
    assert.notDeepEqual(c[0], c[c.length - 1]);
  }
});

test('toCenterline is deterministic and never mutates the draft', () => {
  const d = circleDraft(30, 8);
  const snapshot = JSON.stringify(d);
  const a = toCenterline(d, 5);
  const b = toCenterline(d, 5);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(d), snapshot);
  assert.equal(d.points.length, 8);
  assert.equal(d.closed, true);
});

test('insertOnSegment appends until there are two points to split', () => {
  const d0 = emptyDraft(12);
  assert.equal(insertOnSegment(d0, [3, 4]).points.length, 1);
  const d1 = addPoint(d0, [0, 0]);
  assert.deepEqual(insertOnSegment(d1, [3, 4]).points.map((p) => [p.x, p.z]), [[0, 0], [3, 4]]);
  const line = addPoint(addPoint(d0, [0, 0]), [60, 0]);
  const split = insertOnSegment(line, [30, 4]);
  assert.equal(split.points.length, 3);
  assert.deepEqual([split.points[1]!.x, split.points[1]!.z], [30, 4]);
  assert.equal(split.closed, false);
});

test('closed drafts never drop below three points', () => {
  const tri = closeLoop(from([[0, 0], [100, 0], [50, 80]]));
  assert.equal(deletePoint(tri, 0), tri);
  assert.equal(deletePoint(tri, 1), tri);
  assert.equal(deletePoint(tri, 9), tri);
  assert.equal(tri.points.length, 3);
  const open = openLoop(tri);
  assert.equal(open.points.length, 3);
  assert.equal(deletePoint(open, 0).points.length, 2);
});

test('width helpers clamp, reject NaN and fall back to the default', () => {
  const d = emptyDraft(Number.NaN);
  assert.equal(d.width, 12);
  const w = setWidth(emptyDraft(12), Number.NaN);
  assert.equal(w.width, 12);
  assert.equal(setWidth(emptyDraft(12), 7.5).width, 7.5);
  const withWidth = addPoint(addPoint(emptyDraft(12), [0, 0]), [10, 0]);
  const moved = movePoint(setWidth(withWidth, 3), 0, [1, 1]);
  assert.equal(moved.width, 4);
  assert.equal(scale(withWidth, 0, [0, 0]), withWidth);
  assert.equal(translate(withWidth, Number.NaN, 1), withWidth);
  assert.equal(rotate(withWidth, Number.NaN, [0, 0]), withWidth);
  assert.equal(addPoint(withWidth, [Number.NaN, 2]), withWidth);
});

test('history reset clears the tail and duplicate pushes stay inert', () => {
  const h = createDraftHistory(emptyDraft(12), 5);
  const d1 = addPoint(h.state, [1, 1]);
  h.push(d1, 'one');
  h.push(d1, 'one again');
  assert.deepEqual(h.labels, ['one']);
  h.reset(setWidth(d1, 20));
  assert.deepEqual(h.labels, []);
  assert.equal(h.canUndo, false);
  assert.equal(h.canRedo, false);
  assert.equal(h.state.width, 20);
});

test('reverse twice, and reverse + mirror, stay consistent', () => {
  const d = closeLoop(from([[0, 0], [80, 0], [80, 60], [0, 60]]));
  assert.deepEqual(reverse(reverse(d)).points, d.points);
  const mirrored = mirrorX(d);
  assert.equal(mirrored.points.length, d.points.length);
  assert.deepEqual(
    mirrored.points.map((p) => [p.x, p.z]),
    [[80, 60], [0, 60], [0, 0], [80, 0]],
  );
  const base = analyse(d);
  const flipped = analyse(mirrored);
  assert.ok(Math.abs(flipped.length - base.length) < 1e-6);
  assert.equal(flipped.selfIntersects, false);
  assert.equal(analyse(mirrorX(DRAFT_PRESETS[0]!.draft)).valid, true);
});

test('presetDraft hands out the shared instances and ids are unique', () => {
  const ids = DRAFT_PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const preset of DRAFT_PRESETS) {
    assert.equal(presetDraft(preset.id), preset.draft);
    assert.equal(preset.draft.points.length >= 8, true);
    assert.ok([12, 14].includes(preset.draft.width), preset.id);
  }
  assert.equal(presetDraft(''), undefined);
  assert.equal(presetDraft('oval '), undefined);
});

