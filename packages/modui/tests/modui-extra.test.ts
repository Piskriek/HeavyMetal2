import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import {
  CurveEditor, MOD_KINDS, ModulatorPanel, SequenceEditor, Sparkline, TimelineEditor,
  addKey, addPoint, curvePath, defaultModulator, formatMs, fromPx, hitPoint, keyRange, moveKey, movePoint,
  previewValues, pxToTime, pxToValue, randomizeSteps, removeKey, removePoint, resizeSteps, sampleCurve,
  sampleModulator, setEase, setStep, sparklinePoints, stepFromPx, stepNoise, timeToPx, toPx, valueToPx,
  type Box, type Keyframe, type ModulatorDef, type Pt,
} from '../src';

const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const box: Box = { x: 10, y: 20, w: 200, h: 100 };
const noop = () => undefined;
let seed = 1;
const rnd = (): number => {
  seed = (Math.imul(seed, 1103515245) + 12345) | 0;
  return ((seed >>> 1) & 0x7fffffff) / 0x7fffffff;
};
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;

test('timeline edits under 400 random operations stay sorted, in range and 1 ms apart', () => {
  let keys: Keyframe[] = [{ timeMs: 0, value: 0 }, { timeMs: 500, value: 0.5 }, { timeMs: 1000, value: 1 }];
  const eases = ['linear', 'in', 'out', 'inOut', 'hold'] as const;
  for (let i = 0; i < 400; i++) {
    const op = Math.floor(rnd() * 4);
    const idx = Math.floor(rnd() * keys.length);
    if (op === 0) keys = moveKey(keys, idx, rnd() * 1600 - 300, rnd() * 3 - 1, 1000);
    else if (op === 1) keys = addKey(keys, rnd() * 1300 - 150, rnd(), 1000);
    else if (op === 2 && keys.length > 1) keys = removeKey(keys, idx);
    else keys = setEase(keys, idx, pick(eases));
    assert.ok(keys.length >= 1);
    for (const k of keys) {
      assert.ok(Number.isFinite(k.timeMs) && Number.isFinite(k.value), 'finite');
      assert.ok(k.timeMs >= 0 && k.timeMs <= 1000, `clamped: ${k.timeMs}`);
    }
    for (let j = 1; j < keys.length; j++) {
      assert.ok(keys[j]!.timeMs >= keys[j - 1]!.timeMs - 1e-9, `sorted at ${j}`);
      assert.ok(keys[j]!.timeMs - keys[j - 1]!.timeMs >= 0.999, `1 ms apart at ${j}`);
    }
    for (const k of keys) if (k.ease !== undefined) assert.ok(eases.includes(k.ease));
  }
});

test('a step curve path is made of axis aligned runs', () => {
  const path = curvePath({ x: 0, y: 0, w: 100, h: 50 }, [[0, 0.2], [1, 0.8]], 'step', 10);
  const nums = path.split(' ').filter((tok) => tok !== 'M' && tok !== 'L').map(Number);
  const pts: Pt[] = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i]!, nums[i + 1]!]);
  let jumps = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i]![0] - pts[i - 1]![0]);
    const dy = Math.abs(pts[i]![1] - pts[i - 1]![1]);
    if (dx > 0 && dy > 0) jumps++;
    assert.ok(jumps <= 1, 'only one vertical jump');
  }
  assert.equal(jumps, 1);
});

test('hit testing with a zero or negative radius', () => {
  const pts: Pt[] = [[0, 0], [0.5, 1], [1, 0]];
  assert.equal(hitPoint(box, pts, toPx(box, pts[1]!), 0), 1);
  assert.equal(hitPoint(box, pts, [toPx(box, pts[1]!)[0] + 0.5, toPx(box, pts[1]!)[1]], 0), -1);
  assert.equal(hitPoint(box, pts, [-9999, -9999], 40), -1);
  assert.equal(hitPoint(box, pts, toPx(box, pts[0]!), -1), -1);
  assert.equal(hitPoint(box, pts, toPx(box, pts[2]!), 0), 2);
});

test('formatMs rounds half up and clamps negatives', () => {
  assert.equal(formatMs(1999), '2.00 s');
  assert.equal(formatMs(999), '1.00 s');
  assert.equal(formatMs(1250), '1.25 s');
  assert.equal(formatMs(1), '0.00 s');
  assert.equal(formatMs(60_000), '60.00 s');
  assert.equal(formatMs(Number.NaN), '0.00 s');
});

test('movePoint snapping, single point curves and degenerate neighbours', () => {
  assert.deepEqual(movePoint([[0.5, 0.5]], 0, [2, -1]), [[1, 0]]);
  assert.deepEqual(movePoint([[0, 0], [1, 1]], 0, [0.5, 0.5]), [[0, 0.5], [1, 1]]);
  assert.deepEqual(movePoint([[0, 0], [0.5, 1], [1, 0]], 1, [0.55, 0.44], 0.25)[1], [0.5, 0.5]);
  assert.deepEqual(movePoint([[0, 0], [1, 1]], 1, [-2, 7], 0.5), [[0, 0], [1, 1]]);
  assert.deepEqual(movePoint([], 0, [0.5, 0.5]), []);
  const squeezed = movePoint([[0, 0], [0.5, 1], [0.5, 0], [1, 1]], 2, [0.9, 0.9]);
  assert.ok(squeezed[2]![0] >= squeezed[1]![0]);
});

test('editing helpers never mutate their inputs', () => {
  const keys: Keyframe[] = [{ timeMs: 0, value: 0 }, { timeMs: 1000, value: 1, ease: 'in' }, { timeMs: 2000, value: 2 }];
  const before = JSON.stringify(keys);
  moveKey(keys, 1, 1500, 9, 2000);
  addKey(keys, 700, 5, 2000);
  removeKey(keys, 0);
  setEase(keys, 0, 'hold');
  assert.equal(JSON.stringify(keys), before);
  const pts: Pt[] = [[0, 0], [0.5, 1], [1, 0]];
  const snapshot = JSON.stringify(pts);
  movePoint(pts, 1, [0.2, 0.2]);
  addPoint(pts, [0.3, 0.3]);
  removePoint(pts, 1);
  assert.equal(JSON.stringify(pts), snapshot);
  assert.deepEqual(keyRange([{ timeMs: 0, value: 2 }]), { min: 2, max: 3 });
});

test('pixel helpers round trip and survive degenerate ranges', () => {
  for (const t of [0, 250, 1000, 2000]) near(pxToTime(box, 2000, timeToPx(box, 2000, t)), t);
  for (const v of [0, 2.5, 7.5, 10]) near(pxToValue(box, { min: 0, max: 10 }, valueToPx(box, { min: 0, max: 10 }, v)), v);
  for (const p of [[0, 0], [0.25, 0.75], [1, 1]] as const) {
    const back = fromPx(box, toPx(box, p));
    near(back[0], p[0]);
    near(back[1], p[1]);
  }
  near(pxToTime(box, 0, 50), 0);
  near(valueToPx(box, { min: 4, max: 4 }, 4), 70);
  near(pxToValue(box, { min: 4, max: 4 }, 70), 4);
});

test('sequence helpers behave at their boundaries', () => {
  assert.deepEqual(resizeSteps([0.2, 0.4], 1), [0.2]);
  assert.deepEqual(resizeSteps([], 1), [0]);
  assert.deepEqual(resizeSteps([0.5], Number.NaN), [0.5]);
  assert.equal(resizeSteps([0.5], 2.6).length, 3);
  const wide = resizeSteps([0.5], 64);
  assert.equal(wide.length, 64);
  assert.ok(wide.every((v) => v === 0.5));
  assert.equal(resizeSteps([0.5], 65).length, 64);
  assert.deepEqual(setStep([0, 0], 1, Number.NaN), [0, 0]);
  assert.deepEqual(setStep([], 0, 1), []);
  const s = stepFromPx(box, 3, [box.x, box.y + box.h]);
  assert.equal(s.index, 0);
  near(s.value, 0);
  assert.equal(stepFromPx(box, 3, [box.x + box.w, box.y]).index, 2);
  assert.equal(stepFromPx(box, 1, [box.x + box.w, box.y]).index, 0);
  near(stepFromPx(box, 1, [box.x + box.w, box.y]).value, 1);
});

test('step noise and randomize are deterministic, in range and seed sensitive', () => {
  for (let i = 0; i < 64; i++) {
    const v = stepNoise(42, i);
    assert.ok(Number.isFinite(v) && v >= 0 && v < 1, `noise in range at ${i}`);
  }
  assert.deepEqual(randomizeSteps([0.5, 0.5], 7), randomizeSteps([0.5, 0.5], 7));
  assert.notDeepEqual(randomizeSteps([0, 0, 0, 0, 0, 0, 0, 0], 11), randomizeSteps([0, 0, 0, 0, 0, 0, 0, 0], 12));
  assert.notDeepEqual(randomizeSteps([0, 0, 0, 0, 0, 0, 0, 0], 11), randomizeSteps([0, 0, 0, 0, 0, 0, 0, 0], 11 + 7919));
  const row = randomizeSteps([0, 0, 0, 0, 0, 0, 0, 0], -3);
  assert.equal(row.length, 8);
  assert.ok(row.every((v) => v >= 0 && v < 1));
  assert.deepEqual(randomizeSteps([], 5), []);
});

test('sparkline points honour an explicit range, a single value and negatives', () => {
  assert.equal(sparklinePoints([0, 10], 100, 50, { min: 0, max: 100 }), '0.00,50.00 100.00,45.00');
  assert.equal(sparklinePoints([7], 100, 50), '0.00,25.00');
  assert.equal(sparklinePoints([-1, 1], 80, 40), '0.00,40.00 80.00,0.00');
  assert.equal(sparklinePoints([1, -1], 80, 40, { min: -2, max: 2 }), '0.00,10.00 80.00,30.00');
  assert.equal(sparklinePoints([2, 4], 0, 0), '0.00,0.00 0.00,0.00');
});

test('sampling stays finite for empty, flat and single point curves', () => {
  near(sampleCurve([[0.5, 0.3]], 0, 'linear'), 0.3);
  near(sampleCurve([[0.5, 0.3]], 1.5, 'step'), 0.3);
  // a zero width segment falls back to the first point's value (no NaN)
  near(sampleCurve([[0.5, 0.3], [0.5, 0.9]], 0.5, 'linear'), 0.3);
  near(sampleCurve([[0.5, 0.3], [0.5, 0.9]], 0.5, 'smooth'), 0.3);
  near(sampleCurve([[0, 0], [1, 1]], 2, 'step'), 1);
  near(sampleCurve([[0, 0.25], [1, 0.75]], -3, 'smooth'), 0.25);
});

test('every kind renders in every tier, including degenerate definitions', () => {
  for (const k of MOD_KINDS) {
    for (const tier of ['play', 'build', 'pro'] as const) {
      const m = html(h(ModulatorPanel, { def: defaultModulator(k.kind), onChange: noop, tier }));
      assert.match(m, /data-kit="modulator-panel"/);
      assert.match(m, /data-field="kind"/);
      assert.doesNotMatch(m, /NaN/);
    }
  }
  const odd: readonly ModulatorDef[] = [
    { kind: 'curve', points: [], interpolation: 'linear', input: { source: 'time', loopMs: 0 }, out: { min: 1, max: 0 } },
    { kind: 'timeline', durationMs: 0, loop: 'pingpong', keys: [] },
    { kind: 'sequence', steps: [], rateHz: 0 },
    { kind: 'combine', op: 'mix', inputs: [defaultModulator('constant')], mix: 2 },
    { kind: 'texture', textureId: '', u: defaultModulator('expr'), v: defaultModulator('stream'), out: { min: -1, max: 1 } },
    { kind: 'random', seed: -1, rateHz: 0, mode: 'hold', distribution: 'gaussian', out: { min: 0, max: 0 } },
  ];
  for (const def of odd) for (const tier of ['play', 'build', 'pro'] as const) {
    assert.match(html(h(ModulatorPanel, { def, onChange: noop, tier })), /data-kit="modulator-panel"/);
  }
  const single = html(h(ModulatorPanel, { def: { kind: 'combine', op: 'add', inputs: [defaultModulator('constant')] }, onChange: noop, tier: 'pro' }));
  assert.match(single, /data-action="add-input"/);
  assert.doesNotMatch(single, /data-action="remove-input"/);
});

test('combine nesting stops after three levels', () => {
  const leaf: ModulatorDef = { kind: 'combine', op: 'add', inputs: [defaultModulator('lfo'), defaultModulator('lfo')] };
  const mid: ModulatorDef = { kind: 'combine', op: 'add', inputs: [leaf, leaf] };
  const root: ModulatorDef = { kind: 'combine', op: 'add', inputs: [mid, mid] };
  const sections = (m: string): number => (m.match(/data-kit="modulator-panel"/g) ?? []).length;
  assert.equal(sections(html(h(ModulatorPanel, { def: leaf, onChange: noop, tier: 'pro' }))), 3);
  assert.equal(sections(html(h(ModulatorPanel, { def: mid, onChange: noop, tier: 'pro' }))), 7);
  assert.equal(sections(html(h(ModulatorPanel, { def: root, onChange: noop, tier: 'pro' }))), 7);
  assert.match(html(h(ModulatorPanel, { def: root, onChange: noop, tier: 'pro' })), /depth limit/);
});

test('sampled previews are finite numbers', () => {
  assert.equal(sampleModulator({ kind: 'constant', value: 0.25 }, 0.7), 0.25);
  for (const k of MOD_KINDS) {
    const vals = previewValues(defaultModulator(k.kind), 32);
    assert.equal(vals.length, 32);
    assert.ok(vals.every((v) => Number.isFinite(v)), `${k.kind} samples are finite`);
  }
  const odd: readonly ModulatorDef[] = [
    { kind: 'curve', points: [], interpolation: 'step', input: { source: 'stream', path: 'a', in: { min: 0, max: 1 } }, out: { min: 0, max: 1 } },
    { kind: 'timeline', durationMs: 0, loop: 'none', keys: [{ timeMs: 0, value: 0.5 }] },
    { kind: 'sequence', steps: [0.5], rateHz: 0, out: { min: -2, max: 2 } },
    { kind: 'combine', op: 'multiply', inputs: [] },
    { kind: 'expr', source: 'bad +', fallback: -1 },
  ];
  for (const def of odd) assert.ok(previewValues(def, 8).every((v) => Number.isFinite(v)));
});

test('editors expose keyboard and pointer affordances', () => {
  const c = html(h(CurveEditor, { points: [[0, 0], [1, 1]], interpolation: 'smooth', onChange: noop, selected: 0 }));
  assert.match(c, /role="group"/);
  assert.match(c, /aria-label="Curve editor"/);
  assert.match(c, /aria-label="Point 1"/);
  assert.match(c, /tabindex="0"/);
  assert.match(c, /aria-valuenow="0"/);
  const t = html(h(TimelineEditor, { keys: [{ timeMs: 0, value: 0, ease: 'hold' }, { timeMs: 1000, value: 1 }], durationMs: 1000, loop: 'pingpong', onChange: noop, selected: 0, playheadMs: 250 }));
  assert.match(t, /aria-label="Keyframe 1 at 0\.00 s"/);
  assert.match(t, /<option[^>]*>hold</);
  assert.match(t, /data-role="playhead"/);
  assert.match(t, /1\.00 s/);
  const q = html(h(SequenceEditor, { steps: [0.5, 0.5], onChange: noop }));
  assert.match(q, /max="64"/);
  assert.match(q, /value="2"/);
  const sp = html(h(Sparkline, { values: [1, 2, 3], label: 'out' }));
  assert.match(sp, /aria-label="out"/);
  assert.match(sp, /points="0\.00,28\.00 60\.00,14\.00 120\.00,0\.00"/);
});
