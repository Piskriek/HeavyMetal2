import test from 'node:test';
import assert from 'node:assert/strict';
import { createModulator, validateModulator, normalizeModulator, describeModulator, rangeOf, hash01, applyEase, MODULATOR_PRESETS, type ModContext, type ModulatorDef } from '../src';

const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const ctx = (timeMs: number, over: Partial<ModContext> = {}): ModContext => ({ timeMs, dtMs: 16, tick: 0, read: () => undefined, ...over });
const sample = (def: ModulatorDef, t: number, over: Partial<ModContext> = {}, seed = 0): number => createModulator(def, seed).sample(ctx(t, over));

test('hash and ease', () => {
  assert.equal(hash01(1, 2), hash01(1, 2)); assert.notEqual(hash01(1, 2), hash01(1, 3)); assert.notEqual(hash01(1, 2), hash01(2, 2));
  for (let i = 0; i < 200; i++) { const v = hash01(7, i); assert.ok(v >= 0 && v < 1); }
  near(applyEase(0.5, 'linear'), 0.5); near(applyEase(0.5, 'in'), 0.25); near(applyEase(0.5, 'out'), 0.75); near(applyEase(0.5, 'inOut'), 0.5); near(applyEase(0.3, 'hold'), 0); near(applyEase(1, 'hold'), 1); near(applyEase(-5, 'linear'), 0); near(applyEase(9, 'in'), 1);
});
test('constant and lfo', () => {
  assert.equal(sample({ kind: 'constant', value: 3.5 }, 999), 3.5);
  const sine: ModulatorDef = { kind: 'lfo', wave: 'sine', freqHz: 1, out: { min: 10, max: 20 } };
  near(sample(sine, 0), 10); near(sample(sine, 500), 20); near(sample(sine, 250), 15, 1e-9); near(sample(sine, 1000), 10, 1e-9);
  near(sample({ ...sine, phase: 0.5 } as ModulatorDef, 0), 20);
  const tri: ModulatorDef = { kind: 'lfo', wave: 'triangle', freqHz: 1, out: { min: 0, max: 1 } }; near(sample(tri, 0), 0); near(sample(tri, 500), 1); near(sample(tri, 250), 0.5);
  const saw: ModulatorDef = { kind: 'lfo', wave: 'saw', freqHz: 2, out: { min: 0, max: 1 } };
  near(sample(saw, 125), 0.25);
  near(sample(saw, 500), 0, 1e-9);
  const sq: ModulatorDef = { kind: 'lfo', wave: 'square', freqHz: 1, width: 0.25, out: { min: -1, max: 1 } }; near(sample(sq, 100), 1); near(sample(sq, 300), -1);
});
test('random: hold, smooth, deterministic, ranged, seeded', () => {
  const hold: ModulatorDef = { kind: 'random', rateHz: 2, mode: 'hold', out: { min: 5, max: 7 } };
  const a = sample(hold, 100), b = sample(hold, 400); assert.equal(a, b);
  assert.notEqual(sample(hold, 100), sample(hold, 600));
  for (let t = 0; t < 10000; t += 137) { const v = sample(hold, t); assert.ok(v >= 5 && v <= 7); }
  assert.equal(sample(hold, 100, {}, 1), sample(hold, 100, {}, 1)); assert.notEqual(sample(hold, 100, {}, 1), sample(hold, 100, {}, 2));
  assert.equal(sample({ ...hold, seed: 9 } as ModulatorDef, 100, {}, 1), sample({ ...hold, seed: 9 } as ModulatorDef, 100, {}, 2));
  const smooth: ModulatorDef = { kind: 'random', rateHz: 1, mode: 'smooth', out: { min: 0, max: 1 } };
  near(sample(smooth, 0), sample({ ...smooth, mode: 'hold' } as ModulatorDef, 0)); near(sample(smooth, 999.999), sample({ ...smooth, mode: 'hold' } as ModulatorDef, 1000), 1e-4);
  let prev = sample(smooth, 0); for (let t = 5; t < 3000; t += 5) { const v = sample(smooth, t); assert.ok(Math.abs(v - prev) < 0.05); prev = v; }
  const g: ModulatorDef = { kind: 'random', rateHz: 100, mode: 'hold', distribution: 'gaussian', out: { min: 0, max: 1 } };
  let s = 0, n = 0, mid = 0; for (let i = 0; i < 2000; i++) { const v = sample(g, i * 10); s += v; n++; if (v > 0.25 && v < 0.75) mid++; } near(s / n, 0.5, 0.05); assert.ok(mid / n > 0.7);
  assert.equal(sample({ kind: 'random', rateHz: 0, mode: 'hold', out: { min: 1, max: 2 } }, 5000), sample({ kind: 'random', rateHz: 0, mode: 'hold', out: { min: 1, max: 2 } }, 0));
});
test('noise: ranged, smooth, deterministic', () => {
  const n: ModulatorDef = { kind: 'noise', freqHz: 2, out: { min: -1, max: 1 } };
  let prev = sample(n, 0), lo = 9, hi = -9; for (let t = 0; t < 5000; t += 4) { const v = sample(n, t); assert.ok(v >= -1 && v <= 1); assert.ok(Math.abs(v - prev) < 0.2); lo = Math.min(lo, v); hi = Math.max(hi, v); prev = v; }
  assert.ok(hi - lo > 0.5); assert.equal(sample(n, 1234, {}, 3), sample(n, 1234, {}, 3)); assert.notEqual(sample(n, 1234, {}, 3), sample(n, 1234, {}, 4));
});
test('curve: time and stream inputs, interpolation, clamping, mapping', () => {
  const pts = [[0, 0], [0.5, 1], [1, 0]] as const;
  const c: ModulatorDef = { kind: 'curve', points: pts, interpolation: 'linear', input: { source: 'time', loopMs: 1000 }, out: { min: 0, max: 10 } };
  near(sample(c, 0), 0); near(sample(c, 250), 5); near(sample(c, 500), 10); near(sample(c, 750), 5); near(sample(c, 1250), 5);
  near(sample({ ...c, interpolation: 'step' } as ModulatorDef, 250), 0); near(sample({ ...c, interpolation: 'smooth' } as ModulatorDef, 250), 5, 1e-9);
  const s: ModulatorDef = { kind: 'curve', points: [[0, 0.2], [1, 0.8]], interpolation: 'linear', input: { source: 'stream', path: 'global:speed', in: { min: 0, max: 40 } }, out: { min: 0, max: 1 } };
  near(sample(s, 0, { read: (p) => (p === 'global:speed' ? 20 : undefined) }), 0.5); near(sample(s, 0, { read: () => 400 }), 0.8); near(sample(s, 0), 0.2);
  assert.equal(sample({ ...c, points: [] } as ModulatorDef, 100), 0);
});
test('timeline: eases, loop modes, before/after, hold', () => {
  const keys = [{ timeMs: 0, value: 0 }, { timeMs: 1000, value: 10 }, { timeMs: 2000, value: 4, ease: 'hold' as const }, { timeMs: 3000, value: 8 }];
  const t = (loop: 'none' | 'loop' | 'pingpong'): ModulatorDef => ({ kind: 'timeline', durationMs: 3000, loop, keys });
  near(sample(t('none'), 500), 5);
  near(sample(t('none'), 1500), 10);
  near(sample(t('none'), 2999), 7.996, 1e-6);
  near(sample(t('none'), 99999), 8); near(sample(t('none'), -50), 0);
  near(sample(t('loop'), 3500), 5); near(sample(t('pingpong'), 3500), sample(t('none'), 2500));
  near(sample({ kind: 'timeline', durationMs: 1000, loop: 'none', keys: [{ timeMs: 1000, value: 2, ease: 'in' }, { timeMs: 0, value: 0 }] }, 500), 0.5);
  near(sample({ kind: 'timeline', durationMs: 1000, loop: 'none', keys: [{ timeMs: 0, value: 0 }, { timeMs: 1000, value: 4, ease: 'in' }] }, 500), 1);
  assert.equal(sample({ kind: 'timeline', durationMs: 1000, loop: 'loop', keys: [] }, 10), 0);
});
test('sequence and glide', () => {
  const s: ModulatorDef = { kind: 'sequence', steps: [0, 0.5, 1], rateHz: 4, out: { min: 100, max: 200 } };
  near(sample(s, 0), 100); near(sample(s, 300), 150); near(sample(s, 600), 200); near(sample(s, 800), 100);
  const g: ModulatorDef = { kind: 'sequence', steps: [0, 10], rateHz: 1, glideMs: 500 };
  near(sample(g, 1250), 5); near(sample(g, 1600), 10);
  near(sample(g, 2000), 10);
  assert.equal(sample({ kind: 'sequence', steps: [], rateHz: 1 }, 100), 0);
});
test('stream: scale, offset, clamp, smoothing, last good value, reset', () => {
  let value: number | undefined = 10;
  const read = (): number | undefined => value;
  const m = createModulator({ kind: 'stream', path: 'x', scale: 2, offset: 1, clamp: { min: 0, max: 15 } });
  near(m.sample({ timeMs: 0, dtMs: 16, tick: 0, read }), 15); value = 3; near(m.sample({ timeMs: 16, dtMs: 16, tick: 1, read }), 7); value = undefined; near(m.sample({ timeMs: 32, dtMs: 16, tick: 2, read }), 7);
  const sm = createModulator({ kind: 'stream', path: 'x', smoothMs: 100 }); value = 0;
  near(sm.sample({ timeMs: 0, dtMs: 16, tick: 0, read }), 0); value = 1;
  const y1 = sm.sample({ timeMs: 16, dtMs: 100, tick: 1, read }); near(y1, 1 - Math.exp(-1), 1e-9);
  const y2 = sm.sample({ timeMs: 32, dtMs: 100, tick: 2, read }); assert.ok(y2 > y1 && y2 < 1);
  sm.reset(); value = 5; near(sm.sample({ timeMs: 0, dtMs: 16, tick: 0, read }), 5);
});
test('texture, expr and combine', () => {
  const tex: ModulatorDef = { kind: 'texture', textureId: 'noise', u: { kind: 'lfo', wave: 'saw', freqHz: 1, out: { min: 0, max: 1 } }, v: { kind: 'constant', value: 0.5 }, out: { min: 0, max: 10 } };
  const sampleTexture = (id: string, u: number, v: number): number => (id === 'noise' ? u * 0.5 + v * 0.5 : 0);
  near(sample(tex, 500, { sampleTexture }), (0.5 * 0.5 + 0.25) * 10); near(sample(tex, 500), 0);
  const e: ModulatorDef = { kind: 'expr', source: 'sin(t)', fallback: 7 };
  near(sample(e, 2000, { evaluate: (src, scope) => (src === 'sin(t)' ? scope.t! * 3 : 0) }), 6); near(sample(e, 0), 7); near(sample(e, 0, { evaluate: () => Number.NaN }), 7); near(sample(e, 0, { evaluate: () => { throw new Error('x'); } }), 7);
  const a: ModulatorDef = { kind: 'constant', value: 2 }, b: ModulatorDef = { kind: 'constant', value: 5 };
  near(sample({ kind: 'combine', op: 'add', inputs: [a, b] }, 0), 7); near(sample({ kind: 'combine', op: 'multiply', inputs: [a, b] }, 0), 10); near(sample({ kind: 'combine', op: 'min', inputs: [a, b] }, 0), 2); near(sample({ kind: 'combine', op: 'max', inputs: [a, b] }, 0), 5);
  near(sample({ kind: 'combine', op: 'mix', inputs: [a, b], mix: 0.25 }, 0), 2.75); near(sample({ kind: 'combine', op: 'mix', inputs: [a, b] }, 0), 3.5); assert.equal(sample({ kind: 'combine', op: 'add', inputs: [] }, 0), 0);
  const r: ModulatorDef = { kind: 'random', rateHz: 1, mode: 'hold', out: { min: 0, max: 1 } };
  assert.notEqual(sample({ kind: 'combine', op: 'add', inputs: [r, r] }, 100, {}, 5), 2 * sample(r, 100, {}, 5));
});
test('validation, normalisation, description and ranges', () => {
  assert.deepEqual(validateModulator({ kind: 'constant', value: 1 }), { ok: true, errors: [] });
  const bad = validateModulator({ kind: 'lfo', wave: 'blob', freqHz: Number.NaN, out: { min: 2, max: 1 } });
  assert.equal(bad.ok, false); assert.ok(bad.errors.some((e) => /wave/.test(e)) && bad.errors.some((e) => /freqHz/.test(e)) && bad.errors.some((e) => /min/.test(e)));
  assert.equal(validateModulator({ kind: 'nope' }).ok, false); assert.equal(validateModulator(null).ok, false); assert.equal(validateModulator('x').ok, false);
  assert.ok(validateModulator({ kind: 'combine', op: 'add', inputs: [{ kind: 'lfo', wave: 'sine', freqHz: -1, out: { min: 0, max: 1 } }] }).errors[0]!.includes('inputs[0]'));
  assert.equal(validateModulator({ kind: 'curve', points: [[0.5, 0], [0.2, 1]], interpolation: 'linear', input: { source: 'time', loopMs: 1000 }, out: { min: 0, max: 1 } }).ok, false);
  assert.equal(validateModulator({ kind: 'stream', path: '' }).ok, false);
  let deep: ModulatorDef = { kind: 'constant', value: 1 }; for (let i = 0; i < 10; i++) deep = { kind: 'combine', op: 'add', inputs: [deep] };
  assert.equal(validateModulator(deep).ok, false);
  const n = normalizeModulator({ kind: 'curve', points: [[1, 1], [0, 0]], interpolation: 'linear', input: { source: 'time', loopMs: 10 }, out: { min: 5, max: 1 } });
  assert.deepEqual(n.kind === 'curve' ? [n.points, n.out] : null, [[[0, 0], [1, 1]], { min: 1, max: 5 }]);
  assert.match(describeModulator({ kind: 'lfo', wave: 'sine', freqHz: 2, out: { min: 0, max: 1 } }), /sine/i); assert.match(describeModulator({ kind: 'stream', path: 'entity:1/velocity.vx', scale: 0.5, smoothMs: 120 }), /entity:1\/velocity\.vx/);
  assert.deepEqual(rangeOf({ kind: 'constant', value: 3 }), { min: 3, max: 3 }); assert.deepEqual(rangeOf({ kind: 'lfo', wave: 'saw', freqHz: 1, out: { min: 2, max: 9 } }), { min: 2, max: 9 });
  assert.deepEqual(rangeOf({ kind: 'timeline', durationMs: 10, loop: 'none', keys: [{ timeMs: 0, value: -2 }, { timeMs: 5, value: 8 }] }), { min: -2, max: 8 });
  assert.deepEqual(rangeOf({ kind: 'combine', op: 'add', inputs: [{ kind: 'constant', value: 1 }, { kind: 'lfo', wave: 'sine', freqHz: 1, out: { min: 0, max: 2 } }] }), { min: 1, max: 3 });
  assert.deepEqual(rangeOf({ kind: 'combine', op: 'multiply', inputs: [{ kind: 'lfo', wave: 'sine', freqHz: 1, out: { min: -1, max: 2 } }, { kind: 'constant', value: -3 }] }), { min: -6, max: 3 });
});
test('the presets are valid, sampleable and described', () => {
  assert.ok(MODULATOR_PRESETS.length >= 12); const ids = MODULATOR_PRESETS.map((p) => p.id); assert.equal(new Set(ids).size, ids.length);
  for (const p of MODULATOR_PRESETS) {
    assert.deepEqual(validateModulator(p.def), { ok: true, errors: [] }, p.id); assert.ok(p.name && p.doc.length > 8); assert.ok(describeModulator(p.def).length > 5);
    const m = createModulator(p.def, 1); for (let t = 0; t < 4000; t += 97) assert.ok(Number.isFinite(m.sample(ctx(t, { read: () => 12 }))), `${p.id} at ${t}`);
  }
  const pitch = MODULATOR_PRESETS.find((p) => p.id === 'engine-pitch-from-speed')!;
  const lo = sample(pitch.def, 0, { read: () => 0 }), hi = sample(pitch.def, 0, { read: () => 40 }); near(lo, 0.8, 1e-9); near(hi, 2.2, 1e-9);
});
