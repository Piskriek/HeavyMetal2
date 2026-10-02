// juice.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPRITES, SOUNDS, JUICE, RANGES, MAX_PARTICLES, SHAKE_MS,
  validateSprite, validateJuice, ParticleSim, Shake, squashScale,
  JuicePlayer, describeJuice,
  type Sprite, type Juice,
} from '../src';

const base: Sprite = {
  id: 'test-sprite', name: 'Test', doc: 'A sprite used only inside the unit tests.',
  count: 10, colors: ['#ff0000'], size: 1, lifeMs: 1000, speed: 5, spread: 0,
  gravity: 0, additive: false, drag: 0, fade: 'linear', shrink: 0,
};
const mk = (over: Partial<Sprite>): Sprite => ({ ...base, ...over });

const baseJuice: Juice = {
  id: 'test-juice', name: 'Test juice', sprite: 'dust-puff', sound: 'ui-click',
  shake: 0.2, squash: 0.5, hitStopMs: 0, rateLimitMs: 100,
};
const mkJ = (over: Partial<Juice>): Juice => ({ ...baseJuice, ...over });

const len = (x: number, y: number, z: number): number => Math.sqrt(x * x + y * y + z * z);

/* -------------------------------- presets -------------------------------- */

test('every sprite preset validates', () => {
  assert.ok(SPRITES.length >= 16);
  for (const s of SPRITES) {
    const r = validateSprite(s);
    assert.deepEqual(r.errors, [], `${s.id}: ${r.errors.join('; ')}`);
    assert.equal(r.ok, true);
  }
});

test('sprite ids unique and docs are sentences', () => {
  const ids = new Set(SPRITES.map((s) => s.id));
  assert.equal(ids.size, SPRITES.length);
  for (const s of SPRITES) assert.ok(s.doc.trim().length > 20, s.id);
});

test('every juice preset validates and points at real data', () => {
  assert.ok(JUICE.length >= 14);
  const ids = new Set(JUICE.map((j) => j.id));
  assert.equal(ids.size, JUICE.length);
  for (const j of JUICE) {
    const r = validateJuice(j, SPRITES);
    assert.deepEqual(r.errors, [], `${j.id}: ${r.errors.join('; ')}`);
    if (j.sprite !== null) assert.ok(SPRITES.some((s) => s.id === j.sprite), j.id);
    if (j.sound !== null) assert.ok(SOUNDS.includes(j.sound), j.id);
  }
});

test('the required juice actions all exist', () => {
  const want = ['raise-ground', 'lower-ground', 'dig', 'paint', 'flatten', 'smooth',
    'place-model', 'delete-model', 'pick', 'undo', 'save', 'win', 'level-up', 'error'];
  for (const id of want) assert.ok(JUICE.some((j) => j.id === id), `missing ${id}`);
});

/* ------------------------------- validation ------------------------------ */

test('sprite ranges are enforced with readable messages', () => {
  const cases: Array<[Partial<Sprite>, string]> = [
    [{ count: 500 }, 'count'], [{ count: 0 }, 'count'], [{ count: 2.5 }, 'count'],
    [{ size: 0.01 }, 'size'], [{ size: 9 }, 'size'],
    [{ lifeMs: 50 }, 'lifeMs'], [{ lifeMs: 9000 }, 'lifeMs'],
    [{ speed: -1 }, 'speed'], [{ speed: 99 }, 'speed'],
    [{ gravity: -99 }, 'gravity'], [{ gravity: 99 }, 'gravity'],
    [{ spread: 1.5 }, 'spread'], [{ shrink: -0.2 }, 'shrink'],
  ];
  for (const [patch, key] of cases) {
    const r = validateSprite(mk(patch));
    assert.equal(r.ok, false, JSON.stringify(patch));
    assert.ok(r.errors.some((e) => e.includes(key)), r.errors.join('; '));
  }
});

test('sprite colors, fade and additive are checked', () => {
  assert.equal(validateSprite(mk({ colors: [] })).ok, false);
  assert.ok(validateSprite(mk({ colors: ['red'] })).errors.some((e) => e.includes('#rrggbb')));
  assert.ok(validateSprite(mk({ fade: 'bouncy' as unknown as 'linear' })).errors.some((e) => e.includes('fade')));
  assert.ok(validateSprite(mk({ additive: 1 as unknown as boolean })).errors.some((e) => e.includes('additive')));
});

test('juice ranges and references are enforced', () => {
  assert.ok(validateJuice(mkJ({ shake: 2 }), SPRITES).errors.some((e) => e.includes('shake')));
  assert.ok(validateJuice(mkJ({ rateLimitMs: 9999 }), SPRITES).errors.some((e) => e.includes('rateLimitMs')));
  assert.ok(validateJuice(mkJ({ sprite: 'nope' }), SPRITES).errors.some((e) => e.includes('nope')));
  assert.ok(validateJuice(mkJ({ sound: 'kazoo' }), SPRITES).errors.some((e) => e.includes('kazoo')));
  assert.equal(validateJuice(mkJ({ sprite: null, sound: null }), SPRITES).ok, true);
  assert.equal(validateJuice(mkJ({ sprite: 'anything-goes' })).ok, true, 'no sprite list = no ref check');
});

test('junk inputs never throw', () => {
  const junk: unknown[] = [null, undefined, 0, '', 'sprite', [], [1, 2], true, NaN,
    { id: 1 }, { count: 'lots' }, { colors: 'red' }, Object.create(null)];
  for (const j of junk) {
    const a = validateSprite(j);
    const b = validateJuice(j, SPRITES);
    assert.equal(a.ok, false);
    assert.equal(b.ok, false);
    assert.ok(a.errors.length > 0 && b.errors.length > 0);
  }
});

/* ------------------------------ particle sim ----------------------------- */

test('same seed gives identical output, different seed does not', () => {
  const run = (seed: number): unknown => {
    const sim = new ParticleSim(seed);
    sim.emit(mk({ count: 25, speed: 6, spread: 0.8, gravity: 5 }), [1, 2, 3], [0, 1, 0]);
    sim.step(100); sim.step(100);
    return sim.particles();
  };
  assert.deepEqual(run(42), run(42));
  assert.notDeepEqual(run(42), run(43));
});

test('hard cap of 3000 particles drops the oldest', () => {
  const sim = new ParticleSim(5);
  const first = mk({ count: 400, colors: ['#010203'] });
  sim.emit(first, [0, 0, 0], [0, 1, 0]);
  for (let i = 0; i < 9; i++) sim.emit(mk({ count: 400, colors: ['#0a0b0c'] }), [0, 0, 0], [0, 1, 0]);
  assert.equal(sim.count(), MAX_PARTICLES);
  const ps = sim.particles();
  assert.equal(ps.length, MAX_PARTICLES);
  assert.ok(!ps.some((p) => p.r === 1 && p.g === 2 && p.b === 3), 'oldest batch was dropped');
});

test('particles die exactly at lifeMs', () => {
  const sim = new ParticleSim(1);
  sim.emit(mk({ count: 7, lifeMs: 1000 }), [0, 0, 0], [0, 1, 0]);
  sim.step(999);
  assert.equal(sim.count(), 7);
  sim.step(1);
  assert.equal(sim.count(), 0);
  assert.deepEqual(sim.particles(), []);
});

test('gravity pulls down and negative gravity lifts', () => {
  const down = new ParticleSim(3);
  down.emit(mk({ count: 1, speed: 0, gravity: 10 }), [0, 0, 0], [0, 1, 0]);
  down.step(100);
  const a = down.particles()[0];
  assert.ok(a);
  assert.ok(a.y < 0, `expected fall, got ${a.y}`);

  const up = new ParticleSim(3);
  up.emit(mk({ count: 1, speed: 0, gravity: -10 }), [0, 0, 0], [0, 1, 0]);
  up.step(100);
  const b = up.particles()[0];
  assert.ok(b);
  assert.ok(b.y > 0);
});

test('cone spread stays inside its bound', () => {
  const n: [number, number, number] = [0, 0, 1];
  for (const spread of [0, 0.25, 0.5, 1]) {
    const sim = new ParticleSim(11);
    sim.emit(mk({ count: 200, spread, speed: 5, gravity: 0, drag: 0 }), [0, 0, 0], n);
    sim.step(10);
    const cosMax = Math.cos(spread * Math.PI * 0.5);
    for (const p of sim.particles()) {
      const l = len(p.x, p.y, p.z);
      assert.ok(l > 0);
      const dot = (p.x * n[0] + p.y * n[1] + p.z * n[2]) / l;
      assert.ok(dot >= cosMax - 1e-9, `spread ${spread}: dot ${dot} < ${cosMax}`);
      if (spread === 0) assert.ok(dot > 1 - 1e-9, 'narrow jet is parallel to the normal');
    }
  }
});

test('fade curves, shrink and drag behave', () => {
  const lin = new ParticleSim(2);
  lin.emit(mk({ count: 1, lifeMs: 1000, speed: 0, fade: 'linear', shrink: 0.5, size: 2 }), [0, 0, 0], [0, 1, 0]);
  lin.step(500);
  const a = lin.particles()[0];
  assert.ok(a);
  assert.ok(Math.abs(a.alpha - 0.5) < 1e-9);
  assert.ok(Math.abs(a.size - 1.5) < 1e-9);

  const quad = new ParticleSim(2);
  quad.emit(mk({ count: 1, lifeMs: 1000, speed: 0, fade: 'quad' }), [0, 0, 0], [0, 1, 0]);
  quad.step(500);
  const b = quad.particles()[0];
  assert.ok(b);
  assert.ok(Math.abs(b.alpha - 0.25) < 1e-9);

  const far = new ParticleSim(9);
  far.emit(mk({ count: 1, speed: 6, drag: 0 }), [0, 0, 0], [0, 1, 0]);
  far.step(200);
  const near = new ParticleSim(9);
  near.emit(mk({ count: 1, speed: 6, drag: 8 }), [0, 0, 0], [0, 1, 0]);
  near.step(200);
  const f = far.particles()[0];
  const n2 = near.particles()[0];
  assert.ok(f && n2);
  assert.ok(len(n2.x, n2.y, n2.z) < len(f.x, f.y, f.z));
});

test('colors and additive flag pass through', () => {
  const sim = new ParticleSim(4);
  sim.emit(mk({ count: 2, colors: ['#ff8800'], additive: true }), [0, 0, 0], [0, 1, 0]);
  const p = sim.particles()[0];
  assert.ok(p);
  assert.deepEqual([p.r, p.g, p.b], [255, 136, 0]);
  assert.equal(p.additive, true);
});

test('all shipped sprites simulate without throwing', () => {
  for (const s of SPRITES) {
    const sim = new ParticleSim(13);
    sim.emit(s, [0, 0, 0], [0, 1, 0]);
    for (let i = 0; i < 60; i++) sim.step(16);
    for (const p of sim.particles()) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), s.id);
      assert.ok(p.alpha >= 0 && p.alpha <= 1, s.id);
      assert.ok(p.size >= 0, s.id);
    }
  }
});

test('sim survives junk emits', () => {
  const sim = new ParticleSim(1);
  const bad = [null, undefined, 42, 'nope', {}, { count: NaN, colors: null }] as unknown[];
  for (const b of bad) {
    assert.doesNotThrow(() => sim.emit(b as Sprite, [0, 0, 0], [0, 0, 0]));
  }
  assert.doesNotThrow(() => sim.emit(base, [NaN, 0, 0] as [number, number, number], [0, 0, 0]));
  assert.doesNotThrow(() => sim.step(-5));
  assert.doesNotThrow(() => sim.step(NaN));
});

/* --------------------------------- shake --------------------------------- */

test('shake decays to exactly zero within 600ms', () => {
  const s = new Shake(3);
  s.kick(1);
  let t = 0;
  let sawMotion = false;
  while (t < SHAKE_MS) { const o = s.step(20); t += 20; if (o.x !== 0 || o.y !== 0) sawMotion = true; }
  assert.ok(sawMotion);
  const end = s.step(1);
  assert.deepEqual(end, { x: 0, y: 0 });
  assert.equal(s.active(), false);
  for (let i = 0; i < 5; i++) assert.deepEqual(s.step(16), { x: 0, y: 0 });
});

test('shake is bounded, deterministic and idle by default', () => {
  const a = new Shake(8); const b = new Shake(8);
  a.kick(0.5); b.kick(0.5);
  for (let i = 0; i < 20; i++) {
    const oa = a.step(16); const ob = b.step(16);
    assert.deepEqual(oa, ob);
    assert.ok(Math.abs(oa.x) <= 0.5 + 1e-12 && Math.abs(oa.y) <= 0.5 + 1e-12);
  }
  const idle = new Shake(2);
  assert.deepEqual(idle.step(16), { x: 0, y: 0 });
  idle.kick(0);
  assert.deepEqual(idle.step(16), { x: 0, y: 0 });
});

/* --------------------------------- squash -------------------------------- */

test('squash pulses 1 -> peak -> 1', () => {
  const j = mkJ({ squash: 1 });
  assert.equal(squashScale(j, 0), 1);
  assert.equal(squashScale(j, -10), 1);
  assert.equal(squashScale(j, 180), 1);
  assert.equal(squashScale(j, 5000), 1);
  assert.ok(Math.abs(squashScale(j, 90) - 1.15) < 1e-9);
  assert.ok(Math.abs(squashScale(mkJ({ squash: 0.5 }), 90) - 1.075) < 1e-9);
  assert.equal(squashScale(mkJ({ squash: 0 }), 90), 1);
  const mid = squashScale(j, 45);
  assert.ok(mid > 1 && mid < 1.15);
});

/* ------------------------------ juice player ----------------------------- */

test('player honours rateLimitMs per juice id', () => {
  const p = new JuicePlayer(SPRITES);
  const j = mkJ({ id: 'rl', rateLimitMs: 100, sprite: 'sparkle', sound: 'select' });
  const first = p.play(j, { now: 0 });
  assert.ok(first);
  assert.equal(first.sprite?.id, 'sparkle');
  assert.equal(first.sound, 'select');
  assert.equal(p.play(j, { now: 50 }), null);
  assert.equal(p.play(j, { now: 99 }), null);
  assert.ok(p.play(j, { now: 100 }));
  assert.equal(p.play(j, { now: 150 }), null);
});

test('rate limits are independent per id and zero limit always fires', () => {
  const p = new JuicePlayer(SPRITES);
  const a = mkJ({ id: 'a', rateLimitMs: 500 });
  const b = mkJ({ id: 'b', rateLimitMs: 500 });
  assert.ok(p.play(a, { now: 0 }));
  assert.ok(p.play(b, { now: 0 }));
  assert.equal(p.play(a, { now: 10 }), null);
  const free = mkJ({ id: 'free', rateLimitMs: 0 });
  for (let i = 0; i < 5; i++) assert.ok(p.play(free, { now: 0 }));
  p.reset();
  assert.ok(p.play(a, { now: 10 }));
});

test('player clamps and resolves unknown references safely', () => {
  const p = new JuicePlayer(SPRITES);
  const weird = p.play(mkJ({ id: 'w', sprite: 'ghost', sound: 'kazoo', shake: 5, squash: -2, hitStopMs: 9999, rateLimitMs: 0 }), { now: 0 });
  assert.ok(weird);
  assert.equal(weird.sprite, null);
  assert.equal(weird.sound, null);
  assert.equal(weird.shake, 1);
  assert.equal(weird.squash, 0);
  assert.equal(weird.hitStopMs, RANGES.hitStopMs[1]);
  assert.equal(p.play(null as unknown as Juice, { now: 0 }), null);
  assert.doesNotThrow(() => p.play(mkJ({ id: 'ctx' }), null as unknown as { now: number }));
});

test('every shipped juice plays', () => {
  const p = new JuicePlayer(SPRITES);
  for (const j of JUICE) {
    const ev = p.play(j, { now: 10_000 });
    assert.ok(ev, j.id);
    if (j.sprite !== null) assert.equal(ev.sprite?.id, j.sprite);
  }
});

test('describeJuice reads like a sentence', () => {
  const raise = JUICE.find((j) => j.id === 'raise-ground');
  assert.ok(raise);
  assert.equal(describeJuice(raise, SPRITES), 'Raise ground: Dust puff and a soft tick, light shake');
  assert.equal(describeJuice(mkJ({ name: 'Quiet', sprite: null, sound: null, shake: 0 }), SPRITES),
    'Quiet: No particles and no sound, no shake');
  assert.ok(describeJuice(mkJ({ name: 'Boom', shake: 0.9 }), SPRITES).endsWith('heavy shake'));
  assert.ok(describeJuice(mkJ({ name: 'Mid', shake: 0.4 }), SPRITES).endsWith('medium shake'));
  for (const j of JUICE) assert.ok(describeJuice(j, SPRITES).startsWith(`${j.name}: `));
  assert.doesNotThrow(() => describeJuice(undefined as unknown as Juice, SPRITES));
});