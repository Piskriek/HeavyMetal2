import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createModulator,
  describeModulator,
  gaussian01,
  hash01,
  normalizeModulator,
  rangeOf,
  validateModulator,
  type ModContext,
  type ModulatorDef,
} from '../src';

const ctx = (timeMs: number, over: Partial<ModContext> = {}): ModContext => ({ timeMs, dtMs: 16, tick: 0, read: () => undefined, ...over });
const at = (def: ModulatorDef, t: number, over: Partial<ModContext> = {}, seed = 0): number => createModulator(def, seed).sample(ctx(t, over));

const EVERY_KIND: ModulatorDef[] = [
  { kind: 'constant', value: 1.5 },
  { kind: 'random', rateHz: 5, mode: 'smooth', out: { min: -1, max: 1 } },
  { kind: 'noise', freqHz: 3, octaves: 4, gain: 0.4, out: { min: 0, max: 100 } },
  { kind: 'lfo', wave: 'triangle', freqHz: 2, phase: 0.25, out: { min: 0, max: 5 } },
  { kind: 'curve', points: [[0, 0], [1, 1]], interpolation: 'smooth', input: { source: 'time', loopMs: 250 }, out: { min: -2, max: 2 } },
  { kind: 'timeline', durationMs: 500, loop: 'pingpong', keys: [{ timeMs: 0, value: 0 }, { timeMs: 500, value: 3 }] },
  { kind: 'sequence', steps: [0, 1, 2], rateHz: 10, glideMs: 20, out: { min: 0, max: 1 } },
  { kind: 'stream', path: 'global:speed', scale: 2, smoothMs: 50, clamp: { min: 0, max: 4 } },
  { kind: 'texture', textureId: 't', u: { kind: 'lfo', wave: 'saw', freqHz: 1, out: { min: 0, max: 1 } }, v: { kind: 'constant', value: 0.25 }, out: { min: 0, max: 1 } },
  { kind: 'expr', source: 't*2', fallback: -1 },
  { kind: 'combine', op: 'mix', mix: 0.3, inputs: [{ kind: 'constant', value: 4 }, { kind: 'constant', value: 8 }] },
];

test('every kind stays finite at extreme times', () => {
  const times = [0, 1, -1, 1e6, 1e9, 1e12, -1e12, Number.MAX_SAFE_INTEGER, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const def of EVERY_KIND) {
    const m = createModulator(def, 3);
    for (const t of times) {
      const v = m.sample(ctx(t, { read: () => 12, dtMs: 0 }));
      assert.ok(Number.isFinite(v), `${def.kind} at ${t} -> ${v}`);
    }
  }
});

test('sampling never throws and sanitises hostile context data', () => {
  const hostile: ModContext = {
    timeMs: Number.NaN,
    dtMs: Number.NEGATIVE_INFINITY,
    tick: Number.NaN,
    read: () => Number.NaN,
    sampleTexture: () => Number.POSITIVE_INFINITY,
    evaluate: () => Number.NaN,
  };
  for (const def of EVERY_KIND) {
    const v = createModulator(def, 1).sample(hostile);
    assert.ok(Number.isFinite(v), `${def.kind} -> ${v}`);
  }
});

test('nested texture modulators drive u and v independently', () => {
  const tex: ModulatorDef = {
    kind: 'texture',
    textureId: 'grad',
    u: { kind: 'random', rateHz: 4, mode: 'hold', out: { min: 0, max: 1 } },
    v: { kind: 'random', rateHz: 4, mode: 'hold', out: { min: 0, max: 1 } },
    out: { min: 0, max: 1 },
  };
  let calls = 0;
  const seen: [number, number][] = [];
  const v = at(tex, 300, {
    sampleTexture: (id, u, vv) => {
      calls++;
      assert.equal(id, 'grad');
      assert.ok(u >= 0 && u <= 1 && vv >= 0 && vv <= 1);
      seen.push([u, vv]);
      return 1;
    },
  });
  assert.equal(calls, 1);
  assert.equal(v, 1);
  assert.notEqual(seen[0]![0], seen[0]![1], 'nested seeds must differ');
});

test('texture falls back to out.min without a sampler, and clamps its uv', () => {
  const tex: ModulatorDef = {
    kind: 'texture',
    textureId: 'x',
    u: { kind: 'constant', value: 4 },
    v: { kind: 'constant', value: -2 },
    out: { min: 7, max: 9 },
  };
  const seen: number[][] = [];
  assert.equal(at(tex, 0, { sampleTexture: (_id, u, v) => (seen.push([u, v]), u + v) }), 9, 'uv is clamped to 0..1, then mapped into out');
  assert.deepEqual(seen[0], [1, 0]);
});

test('combine of combine nests and keeps the expected value', () => {
  const def: ModulatorDef = {
    kind: 'combine',
    op: 'add',
    inputs: [
      { kind: 'combine', op: 'multiply', inputs: [{ kind: 'constant', value: 2 }, { kind: 'constant', value: 3 }] },
      { kind: 'combine', op: 'mix', mix: 0.5, inputs: [{ kind: 'constant', value: 10 }, { kind: 'constant', value: 20 }] },
    ],
  };
  assert.equal(at(def, 1234), 6 + 15);
});

test('nested modulators receive derived seeds (seed + i * 7919)', () => {
  const r: ModulatorDef = { kind: 'random', rateHz: 8, mode: 'hold', out: { min: 0, max: 1 } };
  const combined: ModulatorDef = { kind: 'combine', op: 'add', inputs: [r, r, r] };
  const a = at(combined, 400, {}, 11);
  const b = 3 * at(r, 400, {}, 11);
  assert.notEqual(a, b);
  const other = at(combined, 400, {}, 12);
  assert.notEqual(a, other);
});

test('timeline pingpong is symmetric around the loop end', () => {
  const def: ModulatorDef = {
    kind: 'timeline',
    durationMs: 1000,
    loop: 'pingpong',
    keys: [{ timeMs: 0, value: 0 }, { timeMs: 400, value: 4, ease: 'inOut' }, { timeMs: 1000, value: 1 }],
  };
  for (let k = 0; k <= 1000; k += 100) {
    assert.equal(at(def, 1000 + k), at(def, 1000 - k), `offset ${k}`);
    assert.equal(at(def, 2000 + k), at(def, k), `period offset ${k}`);
  }
});

test('timeline sorts unsorted keys and clamps outside them', () => {
  const def: ModulatorDef = {
    kind: 'timeline',
    durationMs: 1000,
    loop: 'none',
    keys: [{ timeMs: 900, value: 9 }, { timeMs: 100, value: 1 }],
  };
  assert.equal(at(def, 0), 1);
  assert.equal(at(def, 100), 1);
  assert.equal(at(def, 500), 5);
  assert.equal(at(def, 900), 9);
  assert.equal(at(def, 5000), 9);
});

test('reset() restores a stateful stream smoother', () => {
  let value = 0;
  const m = createModulator({ kind: 'stream', path: 'v', smoothMs: 1000 });
  const read = (): number | undefined => value;
  m.sample(ctx(0, { read, dtMs: 16 }));
  value = 100;
  const settled = m.sample(ctx(16, { read, dtMs: 100000 }));
  assert.ok(settled > 99, `expected convergence, got ${settled}`);
  m.reset();
  value = 10;
  assert.equal(m.sample(ctx(0, { read, dtMs: 16 })), 10, 'after reset the first sample jumps to the new value');
});

test('reset() is safe on stateless kinds', () => {
  for (const def of EVERY_KIND) assert.doesNotThrow(() => createModulator(def, 2).reset());
});

test('stream keeps the last good value across dropouts and honours clamp', () => {
  let value: number | undefined = 4;
  const m = createModulator({ kind: 'stream', path: 'p', scale: 10, clamp: { min: -5, max: 20 } });
  const read = (): number | undefined => value;
  assert.equal(m.sample(ctx(0, { read })), 20);
  value = -2;
  assert.equal(m.sample(ctx(1, { read })), -5);
  value = undefined;
  assert.equal(m.sample(ctx(2, { read })), -5, 'dropout holds the last good (clamped) value');
  value = Number.NaN;
  assert.equal(m.sample(ctx(3, { read })), -5, 'NaN reads are ignored');
});

test('sequence glides from the previous step value, never overshooting', () => {
  const def: ModulatorDef = { kind: 'sequence', steps: [0, 10], rateHz: 2, glideMs: 250 };
  for (const t of [0, 50, 125, 250, 499, 500, 625, 750, 999, 1000, 1500, 2250]) {
    const v = at(def, t);
    assert.ok(v >= 0 && v <= 10, `out of range at ${t}: ${v}`);
  }
  assert.equal(at(def, 0), 10, 'a new cycle glides away from the previous step value');
  assert.equal(at(def, 125), 5, 'half-way through the glide');
  assert.equal(at(def, 250), 0, 'glide finished');
  assert.equal(at(def, 500), 0, 'glide into step 1 starts at the previous value');
  assert.equal(at(def, 625), 5);
  assert.equal(at(def, 750), 10);
  assert.equal(at(def, 1000), 10);
  const sharp: ModulatorDef = { kind: 'sequence', steps: [0, 10], rateHz: 2 };
  assert.equal(at(sharp, 499), 0);
  assert.equal(at(sharp, 500), 10, 'without glideMs steps are hard cuts');
});

test('noise octaves add detail, gain 0 collapses onto the base, negative time works', () => {
  const base: ModulatorDef = { kind: 'noise', freqHz: 4, octaves: 1, gain: 0.5, out: { min: 0, max: 1 } };
  const fractal: ModulatorDef = { kind: 'noise', freqHz: 4, octaves: 6, gain: 0.5, out: { min: 0, max: 1 } };
  let differs = false;
  for (let t = 0; t < 2000; t += 5) {
    const v = at(fractal, t);
    assert.ok(v >= 0 && v <= 1, `fractal out of range at ${t}: ${v}`);
    if (v !== at(base, t)) differs = true;
  }
  assert.ok(differs, 'extra octaves must add detail');
  const flatGain: ModulatorDef = { kind: 'noise', freqHz: 4, octaves: 6, gain: 0, out: { min: 0, max: 1 } };
  for (let t = 0; t < 1000; t += 50) assert.equal(at(flatGain, t), at(base, t), `gain 0 at ${t}`);
  for (let t = -1000; t < 0; t += 50) assert.ok(Number.isFinite(at(base, t)), `negative time ${t}`);
  const frozen: ModulatorDef = { kind: 'noise', freqHz: 0, out: { min: 3, max: 4 } };
  assert.equal(at(frozen, 500), at(frozen, 9000), 'freqHz 0 freezes on the first lattice sample');
  assert.ok(at(frozen, 0) >= 3 && at(frozen, 0) <= 4);
});

test('hash01 and gaussian01 are deterministic, ranged and centred', () => {
  assert.equal(hash01(123, 45, 6), hash01(123, 45, 6));
  for (let i = 0; i < 500; i++) {
    const v = hash01(-99, i * 1.5, 3.25);
    assert.ok(v >= 0 && v < 1);
  }
  let sum = 0;
  let inside = 0;
  for (let i = 0; i < 4000; i++) {
    const g = gaussian01(i * 7919, i);
    assert.ok(g >= 0 && g <= 1);
    sum += g;
    if (g > 0.25 && g < 0.75) inside++;
  }
  assert.ok(Math.abs(sum / 4000 - 0.5) < 0.02, `mean ${sum / 4000}`);
  assert.ok(inside / 4000 > 0.85, `central mass ${inside / 4000}`);
});

test('validateModulator never throws on random garbage', () => {
  const garbage: unknown[] = [
    undefined, null, 0, '', 'constant', [], [{}, () => {}, Symbol('x')],
    { kind: 42 }, { kind: 'constant' }, { kind: 'constant', value: 'x' },
    { kind: 'lfo', wave: {}, freqHz: [], out: null },
    { kind: 'curve', points: 'nope', interpolation: 'zigzag', input: { source: 'moon' }, out: {} },
    { kind: 'timeline', durationMs: -1, loop: 'sometimes', keys: [{ timeMs: 'a', value: {} }, 5] },
    { kind: 'sequence', steps: [1, 'x', null, Infinity] },
    { kind: 'texture', textureId: '', u: null, v: undefined },
    { kind: 'combine', op: 'xor', inputs: [null, { kind: 'nope' }] },
    { kind: 'stream', path: 0, scale: 'a', clamp: { min: 1, max: -1 } },
    { kind: 'expr', source: '' },
  ];
  for (const g of garbage) {
    let result: ReturnType<typeof validateModulator> | undefined;
    assert.doesNotThrow(() => {
      result = validateModulator(g);
    }, 'validateModulator must never throw');
    assert.ok(result !== undefined);
    assert.equal(typeof result.ok, 'boolean');
    assert.ok(Array.isArray(result.errors));
    assert.equal(result.errors.every((e) => typeof e === 'string' && e.length > 0), true);
  }
  assert.equal(validateModulator({ kind: 'constant', value: 0 }).ok, true);
});

test('rangeOf covers every kind, including combine mix and wide sources', () => {
  assert.deepEqual(rangeOf({ kind: 'stream', path: 'p', clamp: { min: 2, max: 4 } }), { min: 2, max: 4 });
  assert.equal(rangeOf({ kind: 'stream', path: 'p' }).min, Number.NEGATIVE_INFINITY);
  assert.equal(rangeOf({ kind: 'expr', source: 't' }).max, Number.POSITIVE_INFINITY);
  assert.deepEqual(rangeOf({ kind: 'sequence', rateHz: 4, steps: [3, -1, 7] }), { min: -1, max: 7 });
  assert.deepEqual(rangeOf({ kind: 'sequence', rateHz: 4, steps: [0, 1], out: { min: 5, max: 6 } }), { min: 5, max: 6 });
  assert.deepEqual(rangeOf({ kind: 'texture', textureId: 't', u: { kind: 'constant', value: 0 }, v: { kind: 'constant', value: 0 }, out: { min: -3, max: 3 } }), { min: -3, max: 3 });
  assert.deepEqual(
    rangeOf({ kind: 'combine', op: 'mix', mix: 1, inputs: [{ kind: 'constant', value: 10 }, { kind: 'constant', value: 0 }] }),
    { min: 0, max: 0 },
  );
  const mixed = rangeOf({ kind: 'combine', op: 'mix', mix: 0.25, inputs: [{ kind: 'constant', value: 0 }, { kind: 'constant', value: 4 }] });
  assert.deepEqual(mixed, { min: 1, max: 1 });
  assert.deepEqual(rangeOf({ kind: 'combine', op: 'min', inputs: [{ kind: 'constant', value: 2 }, { kind: 'constant', value: 5 }] }), { min: 2, max: 2 });
});

test('describeModulator mentions the interesting part of every kind', () => {
  for (const def of EVERY_KIND) {
    const text = describeModulator(def);
    assert.ok(typeof text === 'string' && text.length > 5, `${def.kind}: ${text}`);
  }
  assert.match(describeModulator({ kind: 'random', rateHz: 2, mode: 'smooth', out: { min: 0.2, max: 0.9 } }), /0\.5 s/);
  assert.match(describeModulator({ kind: 'curve', points: [[0, 0], [1, 1], [0.5, 0.5]], interpolation: 'linear', input: { source: 'stream', path: 'global:speed', in: { min: 0, max: 40 } }, out: { min: 0, max: 1 } }), /global:speed/);
  assert.match(describeModulator({ kind: 'timeline', durationMs: 2000, loop: 'loop', keys: [{ timeMs: 0, value: 0 }, { timeMs: 1000, value: 1 }] }), /2 s/);
  assert.match(describeModulator({ kind: 'combine', op: 'multiply', inputs: [EVERY_KIND[0]!, EVERY_KIND[0]!] }), /multiply/);
});

test('random smooth is continuous across slot boundaries', () => {
  const def: ModulatorDef = { kind: 'random', rateHz: 7, mode: 'smooth', out: { min: 0, max: 1 } };
  let prev = at(def, -500);
  for (let t = -495; t <= 5000; t += 5) {
    const v = at(def, t);
    assert.ok(Math.abs(v - prev) < 0.06, `jump ${prev} -> ${v} at ${t}`);
    prev = v;
  }
});
