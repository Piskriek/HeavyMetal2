import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { toPx, fromPx, sampleCurve, curvePath, hitPoint, movePoint, addPoint, removePoint, timeToPx, pxToTime, valueToPx, pxToValue, keyRange, moveKey, addKey, removeKey, setEase, formatMs, setStep, resizeSteps, stepFromPx, randomizeSteps, sparklinePoints, CurveEditor, TimelineEditor, SequenceEditor, Sparkline, ModulatorPanel, defaultModulator, MOD_KINDS, type Box, type Pt } from '../src';

const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const box: Box = { x: 10, y: 20, w: 200, h: 100 };
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const noop = () => undefined;

test('curve geometry: px conversion, sampling, path, hit test', () => {
  assert.deepEqual(toPx(box, [0, 0]), [10, 120]); assert.deepEqual(toPx(box, [1, 1]), [210, 20]); assert.deepEqual(toPx(box, [0.5, 0.25]), [110, 95]);
  assert.deepEqual(fromPx(box, [110, 95]), [0.5, 0.25]); assert.deepEqual(fromPx(box, [-50, 500]), [0, 0]); assert.deepEqual(fromPx(box, [900, -9]), [1, 1]);
  const pts: Pt[] = [[0, 0], [0.5, 1], [1, 0]];
  near(sampleCurve(pts, 0.25, 'linear'), 0.5); near(sampleCurve(pts, 0.25, 'step'), 0); near(sampleCurve(pts, 0.25, 'smooth'), 0.5); near(sampleCurve(pts, 0.1, 'smooth'), 0.2 * 0.2 * (3 - 2 * 0.2)); near(sampleCurve(pts, -1, 'linear'), 0); near(sampleCurve([], 0.5, 'linear'), 0);
  const path = curvePath(box, pts, 'linear', 8); assert.match(path, /^M 10(\.0+)? 120(\.0+)? L /); assert.equal(count(path, /L/g), 8); assert.equal(curvePath(box, [], 'linear'), '');
  assert.equal(hitPoint(box, pts, [111, 22], 8), 1); assert.equal(hitPoint(box, pts, [60, 60], 8), -1); assert.equal(hitPoint(box, pts, [10, 118], 5), 0);
});
test('curve editing keeps order, bounds and the end points', () => {
  const pts: Pt[] = [[0, 0], [0.5, 1], [1, 0]];
  const m = movePoint(pts, 1, [0.9, 0.3]);
  near(m[1]![1], 0.3);
  assert.ok(m[1]![0] < 1 && m[1]![0] >= 0.9);
  assert.deepEqual(movePoint(pts, 0, [0.4, 0.5])[0], [0, 0.5]); assert.deepEqual(movePoint(pts, 2, [0.2, 0.7])[2], [1, 0.7]);
  assert.deepEqual(movePoint(pts, 1, [0.52, 0.52], 0.1)[1], [0.5, 0.5]); assert.deepEqual(movePoint(pts, 9, [0, 0]), pts); assert.notEqual(movePoint(pts, 9, [0, 0]), pts);
  assert.deepEqual(movePoint(pts, 1, [-3, 5])[1]![1], 1); assert.ok(movePoint(pts, 1, [-3, 0.5])[1]![0] > 0);
  const a = addPoint(pts, [0.25, 0.4]); assert.deepEqual(a.map((p) => p[0]), [0, 0.25, 0.5, 1]); assert.deepEqual(addPoint(pts, [0.5005, 0.9]), pts);
  assert.deepEqual(removePoint(pts, 1), [[0, 0], [1, 0]]); assert.deepEqual(removePoint([[0, 0], [1, 1]], 0), [[0, 0], [1, 1]]);
});
test('timeline geometry and editing', () => {
  near(timeToPx(box, 2000, 500), 60); near(pxToTime(box, 2000, 60), 500); near(pxToTime(box, 2000, -10), 0); near(pxToTime(box, 2000, 999), 2000);
  near(valueToPx(box, { min: 0, max: 10 }, 10), 20); near(valueToPx(box, { min: 0, max: 10 }, 0), 120); near(pxToValue(box, { min: 0, max: 10 }, 70), 5); near(pxToValue(box, { min: 0, max: 10 }, -400), 10);
  assert.deepEqual(keyRange([]), { min: 0, max: 1 }); assert.deepEqual(keyRange([{ timeMs: 0, value: 3 }]), { min: 3, max: 4 }); assert.deepEqual(keyRange([{ timeMs: 0, value: -2 }, { timeMs: 5, value: 6 }]), { min: -2, max: 6 });
  const keys = [{ timeMs: 0, value: 0 }, { timeMs: 1000, value: 5, ease: 'in' as const }, { timeMs: 2000, value: 1 }];
  const mv = moveKey(keys, 1, 1900, 7, 2000); assert.equal(mv[1]!.timeMs, 1900); assert.equal(mv[1]!.value, 7); assert.equal(mv[1]!.ease, 'in');
  // a move that would cross the next key stops 1 ms inside it
  assert.equal(moveKey(keys, 1, 2500, 7, 2000)[1]!.timeMs, 1999);
  assert.equal(moveKey(keys, 1, -5, 1, 2000)[1]!.timeMs, 1); assert.equal(moveKey(keys, 2, 9999, 1, 2000)[2]!.timeMs, 2000);
  assert.deepEqual(addKey(keys, 500, 2, 2000).map((k) => k.timeMs), [0, 500, 1000, 2000]); assert.deepEqual(addKey(keys, 1003, 2, 2000), keys);
  assert.equal(addKey(keys, 5000, 1, 2000).at(-1)!.timeMs, 2000);
  assert.equal(removeKey(keys, 1).length, 2); assert.equal(setEase(keys, 0, 'hold')[0]!.ease, 'hold'); assert.equal(keys[0]!.ease, undefined);
  assert.equal(formatMs(1500), '1.50 s'); assert.equal(formatMs(125), '0.13 s'); assert.equal(formatMs(-4), '0.00 s'); assert.equal(formatMs(0), '0.00 s');
});
test('sequence helpers and sparkline points', () => {
  assert.deepEqual(setStep([0, 0.5, 1], 1, 2), [0, 1, 1]); assert.deepEqual(setStep([0, 0.5], 5, 1), [0, 0.5]); assert.deepEqual(setStep([0.5], 0, -1), [0]);
  assert.deepEqual(resizeSteps([0.1, 0.2], 4), [0.1, 0.2, 0.2, 0.2]); assert.deepEqual(resizeSteps([0.1, 0.2, 0.3], 2), [0.1, 0.2]); assert.deepEqual(resizeSteps([], 3), [0, 0, 0]); assert.equal(resizeSteps([1], 500).length, 64); assert.equal(resizeSteps([1], 0).length, 1);
  const s = stepFromPx(box, 4, [10 + 125, 20 + 25]); assert.equal(s.index, 2); near(s.value, 0.75); assert.equal(stepFromPx(box, 4, [-100, 999]).index, 0); near(stepFromPx(box, 4, [999, -999]).value, 1);
  const r = randomizeSteps([0, 0, 0, 0], 3); assert.equal(r.length, 4); assert.ok(r.every((v) => v >= 0 && v <= 1)); assert.deepEqual(r, randomizeSteps([0, 0, 0, 0], 3)); assert.notDeepEqual(r, randomizeSteps([0, 0, 0, 0], 4));
  assert.equal(sparklinePoints([], 100, 20), ''); assert.equal(sparklinePoints([0, 1], 100, 20), '0.00,20.00 100.00,0.00'); assert.equal(sparklinePoints([5, 5], 100, 20), '0.00,10.00 100.00,10.00');
});
test('components render their structure', () => {
  const pts: Pt[] = [[0, 0], [0.5, 1], [1, 0]];
  const c = html(h(CurveEditor, { points: pts, interpolation: 'linear', onChange: noop, selected: 1, cursorX: 0.4 }));
  assert.match(c, /data-kit="curve-editor"/); assert.equal(count(c, /data-role="point"/g), 3); assert.match(c, /data-role="curve"/); assert.match(c, /data-role="cursor"/); assert.equal(count(c, /role="slider"/g), 3);
  assert.doesNotMatch(html(h(CurveEditor, { points: pts, interpolation: 'linear', onChange: noop })), /data-role="cursor"/);
  const keys = [{ timeMs: 0, value: 0 }, { timeMs: 1000, value: 1 }];
  const t = html(h(TimelineEditor, { keys, durationMs: 2000, loop: 'loop', onChange: noop, selected: 0, playheadMs: 500 }));
  assert.match(t, /data-kit="timeline-editor"/); assert.equal(count(t, /data-role="key"/g), 2); assert.match(t, /data-field="ease"/); assert.match(t, /1\.00 s/);
  const q = html(h(SequenceEditor, { steps: [0.1, 0.9, 0.5], onChange: noop, activeStep: 1 }));
  assert.match(q, /data-kit="sequence-editor"/); assert.equal(count(q, /data-role="step"/g), 3); assert.match(q, /data-action="random"/); assert.match(q, /data-field="count"/);
  const sp = html(h(Sparkline, { values: [0, 1, 0.5] })); assert.match(sp, /data-kit="sparkline"/); assert.match(sp, /<polyline/); assert.doesNotMatch(html(h(Sparkline, { values: [] })), /<polyline/);
});
test('defaults and the modulator panel by kind and tier', () => {
  assert.equal(MOD_KINDS.length, 10); assert.deepEqual(MOD_KINDS.map((k) => k.kind), ['constant', 'random', 'noise', 'lfo', 'curve', 'timeline', 'sequence', 'stream', 'expr', 'combine']);
  for (const k of MOD_KINDS) assert.equal(defaultModulator(k.kind).kind, k.kind);
  const lfo = defaultModulator('lfo'); assert.equal(lfo.kind === 'lfo' ? lfo.wave : '', 'sine');
  const panel = (def = lfo, tier: 'play' | 'build' | 'pro' = 'pro', preview?: number[]) => html(h(ModulatorPanel, { def, onChange: noop, tier, ...(preview ? { preview } : {}) }));
  const p = panel(); assert.match(p, /data-kit="modulator-panel"/); for (const f of ['kind', 'wave', 'freqHz', 'phase', 'out.min', 'out.max']) assert.match(p, new RegExp(`data-field="${f.replace('.', '\\.')}"`));
  assert.doesNotMatch(p, /data-field="width"/); assert.match(panel({ ...lfo, wave: 'square' } as never), /data-field="width"/);
  const play = panel(lfo, 'play'); assert.match(play, /data-field="freqHz"/); assert.doesNotMatch(play, /data-field="phase"/);
  assert.match(panel(defaultModulator('curve')), /data-kit="curve-editor"/); assert.match(panel(defaultModulator('timeline')), /data-kit="timeline-editor"/); assert.match(panel(defaultModulator('sequence')), /data-kit="sequence-editor"/);
  const st = panel(defaultModulator('stream'), 'pro'); assert.match(st, /data-field="path"/); assert.match(st, /data-field="smoothMs"/); assert.doesNotMatch(panel(defaultModulator('stream'), 'play'), /data-field="smoothMs"/);
  assert.match(panel(defaultModulator('expr')), /data-field="source"/); assert.match(panel(defaultModulator('constant')), /data-field="value"/);
  const comb = panel(defaultModulator('combine')); assert.equal(count(comb, /data-kit="modulator-panel"/g), 3); assert.match(comb, /data-action="add-input"/); assert.match(comb, /data-action="remove-input"/); assert.match(comb, /data-field="op"/);
  assert.match(panel(lfo, 'build', [0, 1, 0.5]), /data-kit="sparkline"/); assert.doesNotMatch(panel(lfo, 'build'), /data-kit="sparkline"/);
});
