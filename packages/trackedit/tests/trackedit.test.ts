import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDraft, addPoint, insertOnSegment, movePoint, deletePoint, setPointWidth, setWidth, closeLoop, openLoop, reverse, translate, rotate, scale, mirrorX, toCenterline, loopLength, analyse, hitTest, snapPoint, createDraftHistory, DRAFT_PRESETS, presetDraft, type TrackDraft, type Vec2 } from '../src';

const near = (a: number, b: number, e = 1e-6): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const square = (s = 100): TrackDraft => { let d = emptyDraft(12); for (const p of [[0, 0], [s, 0], [s, s], [0, s]] as Vec2[]) d = addPoint(d, p); return closeLoop(d); };
const circle = (r: number, n = 12): TrackDraft => { let d = emptyDraft(12); for (let i = 0; i < n; i++) d = addPoint(d, [r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2)]); return closeLoop(d); };

test('draft operations are immutable and clamp', () => {
  const d0 = emptyDraft(12); const d1 = addPoint(d0, [1.234, 5.678]);
  assert.equal(d0.points.length, 0); assert.deepEqual(d1.points[0], { x: 1.23, z: 5.68 });
  const d2 = addPoint(addPoint(d1, [10, 0]), [5, 5], 1); assert.deepEqual(d2.points.map((p) => [p.x, p.z]), [[1.23, 5.68], [5, 5], [10, 0]]);
  assert.deepEqual(movePoint(d2, 1, [7, 7]).points[1], { x: 7, z: 7 }); assert.equal(movePoint(d2, 9, [7, 7]), d2); assert.equal(movePoint(d2, 1, [Number.NaN, 0]), d2);
  assert.equal(deletePoint(d2, 1).points.length, 2); assert.equal(deletePoint(d2, 7), d2);
  assert.equal(deletePoint(deletePoint(square(), 0), 0).points.length, 3);
  assert.equal(setWidth(d0, 1).width, 4); assert.equal(setWidth(d0, 99).width, 40); assert.equal(setPointWidth(d2, 0, 100).points[0]!.width, 40); assert.equal(setPointWidth(setPointWidth(d2, 0, 9), 0, undefined).points[0]!.width, undefined);
  assert.equal(closeLoop(d1).closed, false); assert.equal(square().closed, true); assert.equal(openLoop(square()).closed, false);
});
test('insertOnSegment, reverse, translate, rotate, scale, mirror', () => {
  const sq = square();
  const ins = insertOnSegment(sq, [50, -3]); assert.equal(ins.points.length, 5); assert.deepEqual([ins.points[1]!.x, ins.points[1]!.z], [50, -3]);
  const wrap = insertOnSegment(sq, [-4, 50]); assert.equal(wrap.points.length, 5); assert.deepEqual([wrap.points[4]!.x, wrap.points[4]!.z], [-4, 50]);
  assert.deepEqual(reverse(sq).points.map((p) => [p.x, p.z]), [[0, 100], [100, 100], [100, 0], [0, 0]]);
  assert.deepEqual(translate(sq, 5, -5).points[0], { x: 5, z: -5 });
  const r = rotate(sq, Math.PI / 2, [0, 0]); near(r.points[1]!.x, 0, 1e-2); near(r.points[1]!.z, 100, 1e-2);
  const s = scale(sq, 2, [0, 0]); assert.deepEqual(s.points[2], { x: 200, z: 200 }); assert.equal(scale(sq, -1, [0, 0]), sq);
  const m = mirrorX(sq); assert.deepEqual(m.points.map((p) => p.x).sort((a, b) => a - b), [0, 0, 100, 100]); assert.equal(m.points.length, 4);
});
test('toCenterline: closed spline through the control points, equal spacing, open lines', () => {
  const c = toCenterline(circle(50), 6);
  near(c.length, Math.round((2 * Math.PI * 50) / 6), 2);
  for (const p of circle(50).points) assert.ok(Math.min(...c.map(([x, z]) => Math.hypot(x - p.x, z - p.z))) < 0.5);
  for (let i = 0; i < c.length; i++) { const a = c[i]!, b = c[(i + 1) % c.length]!; const g = Math.hypot(b[0] - a[0], b[1] - a[1]); assert.ok(g > 4 && g < 8, `gap ${g}`); }
  assert.notDeepEqual(c[0], c[c.length - 1]);
  assert.deepEqual(toCenterline(emptyDraft(12)), []); assert.deepEqual(toCenterline(addPoint(emptyDraft(12), [0, 0])), []);
  const line = toCenterline(addPoint(addPoint(emptyDraft(12), [0, 0]), [60, 0]), 6); assert.ok(line.length >= 10 && line.every((p) => Math.abs(p[1]) < 1e-9));
  near(loopLength([[0, 0], [3, 0], [3, 4]], false), 7); near(loopLength([[0, 0], [3, 0], [3, 4]], true), 12);
});
test('analyse: valid circuit, too short, tight corner, self intersection, open', () => {
  const ok = analyse(circle(50)); assert.deepEqual(ok.issues, []); assert.equal(ok.valid, true); assert.ok(ok.minRadius > 40 && ok.minRadius < 60); assert.equal(ok.selfIntersects, false); assert.ok(ok.length > 280 && ok.length < 340);
  assert.ok(Math.abs(ok.bbox.maxX - 50) < 2 && Math.abs(ok.bbox.minX + 50) < 2);
  const small = analyse(circle(10)); assert.equal(small.valid, false); assert.ok(small.issues.some((i) => /too short/i.test(i)) && small.tightAt.length > 0 && small.issues.some((i) => /tight/i.test(i)));
  const bow = closeLoop(addPoint(addPoint(addPoint(addPoint(emptyDraft(12), [0, 0]), [100, 100]), [100, 0]), [0, 100]));
  const b = analyse(bow); assert.equal(b.selfIntersects, true); assert.ok(b.issues.some((i) => /crosses/i.test(i)));
  const open = analyse(openLoop(circle(50))); assert.equal(open.valid, false); assert.ok(open.issues.some((i) => /not closed/i.test(i)));
  assert.ok(analyse(emptyDraft(12)).issues.some((i) => /at least 3/i.test(i)));
  assert.ok(analyse(scale(circle(50), 12, [0, 0])).issues.some((i) => /too long/i.test(i)));
});
test('hitTest and snapPoint', () => {
  const sq = square();
  assert.deepEqual(hitTest(sq, [2, 2], 5), { kind: 'point', index: 0, distance: Math.hypot(2, 2) });
  const seg = hitTest(sq, [50, 3], 5); assert.equal(seg.kind, 'segment'); assert.equal(seg.index, 0); near(seg.distance, 3); near(seg.t!, 0.5);
  const closing = hitTest(sq, [-2, 50], 5); assert.equal(closing.kind, 'segment'); assert.equal(closing.index, 3);
  assert.deepEqual(hitTest(sq, [50, 50], 5), { kind: 'none', index: -1, distance: Infinity });
  assert.deepEqual(snapPoint([12.3, 7.7], 5), [10, 10]); assert.deepEqual(snapPoint([12.3, 7.7], 0), [12.3, 7.7]);
});
test('history: undo, redo, redo tail dropped, duplicates ignored, limit', () => {
  const h = createDraftHistory(emptyDraft(12), 3);
  assert.equal(h.canUndo, false);
  h.push(addPoint(h.state, [0, 0]), 'add 1'); h.push(addPoint(h.state, [5, 0]), 'add 2');
  h.push(h.state, 'noop'); assert.deepEqual(h.labels, ['add 1', 'add 2']);
  assert.equal(h.undo(), 'add 2'); assert.equal(h.state.points.length, 1); assert.equal(h.canRedo, true);
  assert.equal(h.redo(), 'add 2'); assert.equal(h.state.points.length, 2);
  h.undo(); h.push(addPoint(h.state, [9, 9]), 'other'); assert.equal(h.canRedo, false); assert.deepEqual(h.labels, ['add 1', 'other']);
  h.push(addPoint(h.state, [1, 1]), 'a'); h.push(addPoint(h.state, [2, 2]), 'b'); assert.equal(h.labels.length, 3);
  h.reset(emptyDraft(10)); assert.equal(h.canUndo, false); assert.equal(h.state.width, 10);
});
test('the six presets are named, closed and valid', () => {
  assert.deepEqual(DRAFT_PRESETS.map((p) => p.id), ['oval', 'kidney', 'bean', 'hairpin-run', 'coast-circuit', 'figure-nine']);
  for (const p of DRAFT_PRESETS) { assert.ok(p.draft.closed && p.draft.points.length >= 8 && p.draft.points.length <= 16 && p.doc.length > 10, p.id); const a = analyse(p.draft); assert.deepEqual(a.issues, [], p.id); assert.equal(presetDraft(p.id), p.draft); }
  assert.equal(presetDraft('nope'), undefined);
});
