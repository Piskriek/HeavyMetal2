// @ts-nocheck (agent-generated test: strict index access cleanup pending)
/* Tests for ./motion — run with: node --test --import tsx motion.test.ts
 * No Math.random, no Date: all "noise" and "shuffle" comes from a seeded LCG.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  blendClips,
  detectLoop,
  fitEaseFromSamples,
  mirror,
  quantiseTimes,
  recordToClip,
  retime,
  sampleClip,
  sampleTrack,
  simplify,
  smooth,
  stepMachine,
  type Clip,
  type Ease,
  type Key,
  type Sample,
  type StateMachine,
  type Track,
} from '../src';

/** Deterministic pseudo random generator in [0,1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function track(target: string, keys: Key[]): Track {
  return { target, keys };
}

function clip(id: string, durationMs: number, loop: Clip['loop'], tracks: Track[]): Clip {
  return { id, durationMs, loop, tracks };
}

/** constant-value clip, handy for blending */
function flat(id: string, v: number, durationMs = 100): Clip {
  return clip(id, durationMs, 'loop', [track('x', [{ t: 0, v }, { t: durationMs, v }])]);
}

function variance(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
}

function roughness(values: readonly number[]): number {
  let sum = 0;
  for (let i = 1; i < values.length; i++) sum += (values[i] - values[i - 1]) ** 2;
  return sum;
}

function maxError(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): number {
  let max = 0;
  for (const key of a.keys()) max = Math.max(max, Math.abs((a.get(key) as number) - (b.get(key) as number)));
  return max;
}

/* ------------------------------------------------------------- simplify */

test('simplify: straight line collapses to 2 keys', () => {
  const samples: Sample[] = [];
  for (let i = 0; i <= 20; i++) samples.push({ t: i * 10, v: i * 2 });
  const keys = simplify(samples, 0.001);
  assert.equal(keys.length, 2);
  assert.deepEqual(keys, [
    { t: 0, v: 0 },
    { t: 200, v: 40 },
  ]);
});

test('simplify: keeps the peak of a triangle wave', () => {
  const samples: Sample[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i * 10;
    samples.push({ t, v: t <= 100 ? t : 200 - t });
  }
  const keys = simplify(samples, 1);
  assert.equal(keys.length, 3);
  assert.deepEqual(keys, [
    { t: 0, v: 0 },
    { t: 100, v: 100 },
    { t: 200, v: 0 },
  ]);
});

test('simplify: a bigger tolerance never gives more keys', () => {
  const rnd = lcg(11);
  const samples: Sample[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = i * 10;
    samples.push({ t, v: 5 * Math.sin((2 * Math.PI * t) / 1200) + (rnd() * 2 - 1) * 0.4 });
  }
  const tolerances = [0.01, 0.1, 0.5, 2, 10, 50, 1000];
  let previous = Infinity;
  for (const tol of tolerances) {
    const count = simplify(samples, tol).length;
    assert.ok(count >= 2, 'first and last samples are always kept');
    assert.ok(count <= previous, `tolerance ${tol} gave ${count} keys after ${previous}`);
    previous = count;
  }
  assert.equal(simplify(samples, 1000).length, 2);
});

test('simplify: unsorted and duplicate times', () => {
  assert.deepEqual(simplify([], 1), []);
  assert.deepEqual(simplify([{ t: 5, v: 3 }], 1), [{ t: 5, v: 3 }]);

  // duplicate times: the LAST one wins
  const dup = simplify([{ t: 0, v: 1 }, { t: 10, v: 2 }, { t: 0, v: 9 }], 0.0001);
  assert.deepEqual(dup, [
    { t: 0, v: 9 },
    { t: 10, v: 2 },
  ]);

  // shuffling the input must not change the result
  const sorted: Sample[] = [];
  for (let i = 0; i <= 40; i++) sorted.push({ t: i * 5, v: i * 1.5 });
  const shuffled = sorted.slice();
  const rnd = lcg(4);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  assert.deepEqual(simplify(shuffled, 0.25), simplify(sorted, 0.25));
  const keys = simplify(shuffled, 0.25);
  for (let i = 1; i < keys.length; i++) assert.ok(keys[i].t > keys[i - 1].t, 'keys stay sorted');
});

/* --------------------------------------------------------------- smooth */

test('smooth: keeps endpoints and reduces variance', () => {
  const rnd = lcg(7);
  const samples: Sample[] = [];
  for (let i = 0; i < 200; i++) samples.push({ t: i * 10, v: 10 + (rnd() * 2 - 1) });

  const out = smooth(samples, 50);
  assert.equal(out.length, samples.length);
  assert.deepEqual(
    out.map((s) => s.t),
    samples.map((s) => s.t),
  );
  assert.equal(out[0].v, samples[0].v, 'first value preserved');
  assert.equal(out[out.length - 1].v, samples[samples.length - 1].v, 'last value preserved');

  assert.ok(variance(out.map((s) => s.v)) < variance(samples.map((s) => s.v)));
  assert.ok(roughness(out.map((s) => s.v)) < roughness(samples.map((s) => s.v)));

  // degenerate windows are a no-op
  assert.deepEqual(smooth(samples, 0), samples.map((s) => ({ ...s })));
  assert.deepEqual(smooth([], 50), []);
});

/* -------------------------------------------------------- quantiseTimes */

test('quantiseTimes: snaps to the grid and stays strictly increasing', () => {
  const keys: Key[] = [
    { t: 0, v: 0 },
    { t: 33, v: 1, ease: 'in' },
    { t: 61, v: 2, ease: 'out' },
    { t: 100, v: 3, ease: 'inOut' },
  ];
  const snapped = quantiseTimes(keys, 10);
  assert.deepEqual(
    snapped.map((k) => k.t),
    [0, 30, 60, 100],
  );
  assert.deepEqual(
    snapped.map((k) => k.v),
    [0, 1, 2, 3],
  );
  assert.equal(snapped[1].ease, 'in', 'eases survive');

  // collisions are nudged forward by gridMs
  const colliding = quantiseTimes(
    [{ t: 0, v: 0 }, { t: 4, v: 1 }, { t: 6, v: 2 }, { t: 20, v: 3 }],
    5,
  );
  assert.deepEqual(
    colliding.map((k) => k.t),
    [0, 5, 10, 20],
  );
  for (let i = 1; i < colliding.length; i++) {
    assert.ok(colliding[i].t > colliding[i - 1].t);
    assert.equal(colliding[i].t % 5, 0);
  }
  assert.deepEqual(quantiseTimes([], 10), []);
});

/* -------------------------------------------------- fitEaseFromSamples */

test('fitEaseFromSamples: recognises each curve', () => {
  const eases: Ease[] = ['linear', 'in', 'out', 'inOut'];
  for (const ease of eases) {
    const source: Track = track('x', [
      { t: 0, v: 0 },
      { t: 100, v: 10, ease },
    ]);
    const samples: Sample[] = [];
    for (let i = 0; i <= 20; i++) samples.push({ t: i * 5, v: sampleTrack(source, i * 5) });
    const fitted = fitEaseFromSamples(samples, [
      { t: 0, v: 0 },
      { t: 100, v: 10 },
    ]);
    assert.equal(fitted.length, 2);
    assert.equal(fitted[0].ease, undefined, 'no segment ends at the first key');
    assert.equal(fitted[1].ease, ease, `expected ${ease}`);
  }
});

test('fitEaseFromSamples: thin segments stay linear', () => {
  const keys = fitEaseFromSamples(
    [{ t: 0, v: 0 }, { t: 50, v: 5 }, { t: 100, v: 10 }],
    [{ t: 0, v: 0 }, { t: 100, v: 10 }],
  );
  assert.equal(keys[1].ease, 'linear');
});

/* ----------------------------------------------------------- detectLoop */

test('detectLoop: true for a sine of 3 periods, false for a ramp', () => {
  const sine: Sample[] = [];
  for (let t = 0; t <= 3000; t += 10) sine.push({ t, v: 5 * Math.sin((2 * Math.PI * 3 * t) / 3000) });
  const loop = detectLoop(sine, 0.01);
  assert.equal(loop.loops, true);
  assert.ok(loop.periodMs !== null);
  assert.ok(Math.abs((loop.periodMs as number) - 1000) <= 100);

  const ramp: Sample[] = [];
  for (let t = 0; t <= 3000; t += 10) ramp.push({ t, v: (t / 3000) * 10 });
  assert.deepEqual(detectLoop(ramp, 0.01), { loops: false, periodMs: null });

  // matching endpoints but no repetition
  const hump: Sample[] = [];
  for (let t = 0; t <= 3000; t += 10) hump.push({ t, v: t * (3000 - t) / 1000 });
  assert.equal(detectLoop(hump, 0.01).loops, false);
  assert.deepEqual(detectLoop([], 0.01), { loops: false, periodMs: null });
});

/* ---------------------------------------------------- sampleTrack/Clip */

test('sampleTrack: exact numbers for every ease, clamped outside', () => {
  const t = track('x', [
    { t: 0, v: 0 },
    { t: 100, v: 10, ease: 'in' },
    { t: 200, v: 0, ease: 'out' },
    { t: 300, v: 5, ease: 'inOut' },
    { t: 400, v: 5, ease: 'hold' },
    { t: 500, v: 9 },
  ]);
  assert.equal(sampleTrack(t, -50), 0, 'clamped before the first key');
  assert.equal(sampleTrack(t, 0), 0);
  assert.equal(sampleTrack(t, 50), 2.5, 'in at x=0.5 -> 0.25 * 10');
  assert.equal(sampleTrack(t, 150), 2.5, 'out at x=0.5 -> 0.75 of the way 10 -> 0');
  assert.equal(sampleTrack(t, 250), 2.5, 'inOut at x=0.5 -> 0.5');
  assert.equal(sampleTrack(t, 350), 5, 'hold keeps the previous value');
  assert.equal(sampleTrack(t, 400), 5, 'hold jumps at the key itself');
  assert.equal(sampleTrack(t, 450), 7, 'missing ease means linear');
  assert.equal(sampleTrack(t, 600), 9, 'clamped after the last key');
  assert.equal(sampleTrack(track('e', [{ t: 10, v: 3 }]), 0), 3, 'single key');
  assert.equal(sampleTrack(track('e', []), 12), 0, 'empty track');
});

test('sampleClip: loop, pingpong and none', () => {
  const base = clip('move', 100, 'none', [track('x', [{ t: 0, v: 0 }, { t: 100, v: 10 }])]);

  const none = { ...base, loop: 'none' as const };
  assert.deepEqual(sampleClip(none, 0), { x: 0 });
  assert.deepEqual(sampleClip(none, 50), { x: 5 });
  assert.deepEqual(sampleClip(none, 250), { x: 10 }, 'none clamps at the end');
  assert.deepEqual(sampleClip(none, -5), { x: 0 }, 'none clamps at the start');

  const loop = { ...base, loop: 'loop' as const };
  assert.deepEqual(sampleClip(loop, 250), { x: 5 }, 'wraps');
  assert.deepEqual(sampleClip(loop, -50), { x: 5 }, 'wraps backwards');
  assert.deepEqual(sampleClip(loop, 1000), { x: 0 });

  const pingpong = { ...base, loop: 'pingpong' as const };
  assert.deepEqual(sampleClip(pingpong, 0), { x: 0 });
  assert.deepEqual(sampleClip(pingpong, 50), { x: 5 });
  assert.deepEqual(sampleClip(pingpong, 100), { x: 10 });
  assert.deepEqual(sampleClip(pingpong, 150), { x: 5 }, 'reflected');
  assert.deepEqual(sampleClip(pingpong, 250), { x: 5 }, 'reflected again');
  assert.deepEqual(sampleClip(pingpong, -150), { x: 5 }, 'negative time reflects too');
  assert.deepEqual(sampleClip(pingpong, 200), { x: 0 }, 'full cycle returns to the start');
  assert.deepEqual(sampleClip(pingpong, 300), { x: 10 }, 'second pass reaches the top again');
});

/* ----------------------------------------------------------- blendClips */

test('blendClips: override lerps, add sums', () => {
  const a = flat('a', 10);
  const b = flat('b', 20);

  assert.deepEqual(blendClips([{ clip: a, timeMs: 0, weight: 1, mode: 'override' }]), { x: 10 });

  assert.deepEqual(
    blendClips([
      { clip: a, timeMs: 0, weight: 1, mode: 'override' },
      { clip: b, timeMs: 0, weight: 0.5, mode: 'override' },
    ]),
    { x: 15 },
  );

  assert.deepEqual(
    blendClips([
      { clip: a, timeMs: 0, weight: 1, mode: 'override' },
      { clip: b, timeMs: 0, weight: 0.5, mode: 'add' },
    ]),
    { x: 20 },
  );

  assert.deepEqual(blendClips([{ clip: b, timeMs: 0, weight: 0.5, mode: 'add' }]), { x: 10 });
  assert.deepEqual(blendClips([]), {});

  // layer order matters for override
  assert.equal(
    blendClips([
      { clip: a, timeMs: 0, weight: 0.5, mode: 'override' },
      { clip: b, timeMs: 0, weight: 0.5, mode: 'override' },
    ]).x,
    12.5,
  );

  // weights also pick up different points in time
  const moving = clip('m', 100, 'none', [track('x', [{ t: 0, v: 0 }, { t: 100, v: 10 }])]);
  assert.deepEqual(
    blendClips([
      { clip: moving, timeMs: 20, weight: 1, mode: 'override' },
      { clip: flat('c', 5), timeMs: 0, weight: 1, mode: 'add' },
    ]),
    { x: 7 },
  );
});

/* ------------------------------------------------------ retime / mirror */

test('retime: scales every time, keeps values', () => {
  const source = clip('walk', 300, 'pingpong', [
    track('x', [
      { t: 0, v: 0 },
      { t: 100, v: 6, ease: 'in' },
      { t: 300, v: -2, ease: 'out' },
    ]),
  ]);
  const fast = retime(source, 2);
  assert.equal(fast.durationMs, 600);
  assert.deepEqual(
    fast.tracks[0].keys.map((k) => k.t),
    [0, 200, 600],
  );
  assert.deepEqual(
    fast.tracks[0].keys.map((k) => k.v),
    [0, 6, -2],
  );
  assert.equal(fast.loop, 'pingpong');
  for (const t of [0, 37, 100, 150, 250, 300, 299]) {
    assert.ok(Math.abs(sampleClip(fast, t * 2).x - sampleClip(source, t).x) < 1e-9);
  }
  const half = retime(source, 0.5);
  assert.equal(half.durationMs, 150);
  assert.equal(half.tracks[0].keys[2].t, 150);
});

test('mirror: plays backwards with in/out swapped', () => {
  const source = clip('walk', 300, 'none', [
    track('x', [
      { t: 0, v: 0 },
      { t: 100, v: 6, ease: 'in' },
      { t: 300, v: -2, ease: 'out' },
    ]),
  ]);
  const back = mirror(source);
  assert.equal(back.durationMs, 300);
  const keys = back.tracks[0].keys;
  assert.deepEqual(
    keys.map((k) => [k.t, k.v]),
    [
      [0, -2],
      [200, 6],
      [300, 0],
    ],
  );
  assert.equal(keys[0].ease, undefined, 'the last key of the original ends no segment');
  assert.equal(keys[1].ease, 'in', 'out became in');
  assert.equal(keys[2].ease, 'out', 'in became out');

  for (const t of [0, 25, 75, 100, 150, 225, 300]) {
    assert.ok(Math.abs(sampleClip(back, t).x - sampleClip(source, 300 - t).x) < 1e-9);
  }
  assert.equal(mirror(retime(source, 2)).durationMs, 600);
});

/* -------------------------------------------------------- recordToClip */

test('recordToClip: round trip stays under the tolerance', () => {
  const source = clip('gesture', 1200, 'none', [
    track('x', [
      { t: 0, v: 0, ease: 'linear' },
      { t: 400, v: 10, ease: 'inOut' },
      { t: 800, v: -6, ease: 'out' },
      { t: 1200, v: 4, ease: 'linear' },
    ]),
  ]);

  const recorded: Sample[] = [];
  for (let t = 0; t <= 1200; t += 5) recorded.push({ t, v: sampleClip(source, t).x });

  const rebuilt = recordToClip('gesture', 'x', recorded, { tolerance: 1 });
  assert.equal(rebuilt.id, 'gesture');
  assert.equal(rebuilt.durationMs, 1200);
  assert.ok(rebuilt.tracks[0].keys.length < 20, 'simplified from 241 samples');
  assert.ok(rebuilt.tracks[0].keys.length >= 2);

  let worst = 0;
  for (let t = 0; t <= 1200; t += 5) {
    worst = Math.max(worst, Math.abs(sampleClip(rebuilt, t).x - sampleClip(source, t).x));
  }
  assert.ok(worst <= 1, `round trip error ${worst} exceeds the tolerance 1`);
});

test('recordToClip: smoothing, grid, duration override and determinism', () => {
  const rnd = lcg(23);
  const raw: Sample[] = [];
  for (let i = 0; i <= 100; i++) {
    const t = i * 10;
    raw.push({ t, v: t + (rnd() * 2 - 1) * 0.5 });
  }
  const opts = { tolerance: 0.5, smoothMs: 40, gridMs: 25, durationMs: 1000 };
  const first = recordToClip('line', 'slider', raw, opts);
  const second = recordToClip('line', 'slider', raw, opts);
  assert.deepEqual(first, second, 'pure and deterministic');

  assert.ok(first.durationMs >= 1000, 'durationMs is at least the requested length');
  assert.ok(first.durationMs >= first.tracks[0].keys[first.tracks[0].keys.length - 1].t, 'and covers the last key');
  const keys = first.tracks[0].keys;
  assert.equal(keys[0].t, 0, 'the recording starts at t = 0');
  for (let i = 1; i < keys.length; i++) {
    assert.ok(keys[i].t > keys[i - 1].t);
    assert.equal(keys[i].t % 25, 0, 'snapped to the grid');
  }
  // a straight line survives cleaning as a straight line
  const clean: Sample[] = [];
  for (let i = 0; i <= 100; i++) clean.push({ t: i * 10, v: i * 10 });
  assert.deepEqual(
    recordToClip('l', 'x', clean, { tolerance: 0.5, smoothMs: 30 }).tracks[0].keys.map((k) => ({ t: k.t, v: k.v })),
    [
      { t: 0, v: 0 },
      { t: 1000, v: 1000 },
    ],
  );
  // smoothing before simplification needs fewer keys than the raw noise
  const rough = recordToClip('r', 'x', raw, { tolerance: 0.2 });
  const calm = recordToClip('r', 'x', raw, { tolerance: 0.2, smoothMs: 60 });
  assert.ok(calm.tracks[0].keys.length <= rough.tracks[0].keys.length);
  assert.deepEqual(recordToClip('e', 'x', [], { tolerance: 1 }).tracks[0].keys, []);
});

/* -------------------------------------------------------- stepMachine */

test('stepMachine: weights sum to 1 and crossfade over fadeMs', () => {
  const m: StateMachine = {
    initial: 'idle',
    states: {
      idle: { clip: 'idleClip', loop: true },
      walk: { clip: 'walkClip', loop: true },
      jump: { clip: 'jumpClip' },
    },
    transitions: [
      { from: 'idle', to: 'walk', when: 'move', fadeMs: 200 },
      { from: 'walk', to: 'idle', when: 'stop', fadeMs: 100 },
      { from: 'walk', to: 'jump', when: 'jump', fadeMs: 0 },
      { from: 'jump', to: 'idle', when: 'land', fadeMs: 250 },
    ],
  };

  let cursor = stepMachine(m, { state: 'idle' }, null, 16);
  assert.equal(cursor.state, 'idle');
  assert.deepEqual(cursor.weights, { idle: 1 });
  assert.equal(cursor.fade, undefined);

  cursor = stepMachine(m, cursor, 'move', 16);
  assert.equal(cursor.state, 'walk');
  assert.deepEqual(cursor.fade, { from: 'idle', elapsedMs: 0, fadeMs: 200 });
  assert.deepEqual(cursor.weights, { idle: 1, walk: 0 });

  cursor = stepMachine(m, cursor, null, 100);
  assert.deepEqual(cursor.weights, { idle: 0.5, walk: 0.5 });

  cursor = stepMachine(m, cursor, null, 100);
  assert.equal(cursor.fade, undefined, 'fade finished');
  assert.deepEqual(cursor.weights, { walk: 1 });

  cursor = stepMachine(m, cursor, 'jump', 16);
  assert.equal(cursor.state, 'jump');
  assert.equal(cursor.fade, undefined, 'zero fade crossfades instantly');
  assert.deepEqual(cursor.weights, { jump: 1 });

  cursor = stepMachine(m, cursor, 'land', 16);
  assert.equal(cursor.state, 'idle');
  assert.deepEqual(cursor.weights, { jump: 1, idle: 0 });

  const before = cursor;
  assert.deepEqual(stepMachine(m, cursor, 'doesNotExist', 0), before, 'unknown events do nothing');
});

test('stepMachine: weights always sum to 1 across a random-ish session', () => {
  const m: StateMachine = {
    initial: 'a',
    states: { a: { clip: 'a' }, b: { clip: 'b' }, c: { clip: 'c', loop: true } },
    transitions: [
      { from: 'a', to: 'b', when: 'go', fadeMs: 120 },
      { from: 'b', to: 'c', when: 'go', fadeMs: 300 },
      { from: 'c', to: 'a', when: 'back', fadeMs: 40 },
      { from: 'b', to: 'a', when: 'back', fadeMs: 0 },
    ],
  };
  const events = ['go', 'back', null];
  const rnd = lcg(99);
  let cursor = stepMachine(m, { state: m.initial }, null, 0);
  for (let i = 0; i < 300; i++) {
    const event = events[Math.floor(rnd() * events.length) % events.length];
    const dt = Math.floor(rnd() * 120);
    cursor = stepMachine(m, cursor, event, dt);
    const sum = Object.values(cursor.weights).reduce((x, y) => x + y, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `weights summed to ${sum}`);
    if (cursor.fade) {
      assert.ok(cursor.fade.elapsedMs >= 0);
      assert.ok(cursor.fade.elapsedMs <= cursor.fade.fadeMs + 1e-9);
    }
    assert.ok(m.states[cursor.state] !== undefined, 'state exists in the machine');
  }
});