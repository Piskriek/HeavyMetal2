// tests/tooljuice.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_IDS, TOOL_JUICE, burstsBetween, check, squashAt } from '../src/index';
test('eleven tools, all clean', () => {
  assert.equal(TOOL_IDS.length, 11);
  for (const id of TOOL_IDS) assert.deepEqual(check(TOOL_JUICE[id]), [], id);
});
test('shapes as described', () => {
  assert.equal(TOOL_JUICE.magnet.shape, 'beam');
  assert.equal(TOOL_JUICE.fairyWand.shape, 'confetti');
  assert.equal(TOOL_JUICE.flashlight.juice.shake, 0);
  assert.ok(TOOL_JUICE.zapGun.juice.hitStopMs > 0);
});
test('squash starts and ends at 1, bursts fire once', () => {
  const t = TOOL_JUICE.windupKey;
  assert.equal(squashAt(t, -5), 1);
  assert.equal(squashAt(t, 99999), 1);
  assert.ok(t.bursts.length >= 4);
  let fired = 0;
  for (let ms = 0; ms < 2100; ms += 16) fired += burstsBetween(t, ms, ms + 16).length;
  assert.equal(fired + burstsBetween(t, -1, 0).length, t.bursts.length);
});

// ---------------------------------------------------------------------------
// Own tests
// ---------------------------------------------------------------------------

import type { Sprite, ToolJuice } from '../src/index';
import { RANGES, describe } from '../src/index';

function clone(t: ToolJuice): ToolJuice {
  return structuredClone(t);
}
function firstSprite(t: ToolJuice): Sprite {
  const s = t.sprites[0];
  assert.ok(s);
  return s;
}
function broken(mutate: (t: ToolJuice) => void, tool: ToolJuice = TOOL_JUICE.magnet): string[] {
  const t = clone(tool);
  mutate(t);
  return check(t);
}

test('RANGES are exactly as specified', () => {
  assert.deepEqual(
    { ...RANGES },
    {
      count: [1, 400], size: [0.05, 6], lifeMs: [100, 4000], speed: [0, 30], spread: [0, 1],
      gravity: [-20, 40], drag: [0, 20], shrink: [0, 1], shake: [0, 1], squash: [0, 1],
      hitStopMs: [0, 500], rateLimitMs: [0, 1000],
    },
  );
});

test('check catches out-of-range sprite numbers', () => {
  const cases: [keyof Sprite, number][] = [
    ['count', 0], ['count', 401], ['size', 0.01], ['size', 7], ['lifeMs', 50], ['lifeMs', 5000],
    ['speed', -1], ['speed', 31], ['spread', 1.5], ['gravity', -21], ['gravity', 41],
    ['drag', 21], ['shrink', -0.1], ['shrink', 1.1], ['count', Number.NaN],
  ];
  for (const [key, v] of cases) {
    const p = broken((t) => { (firstSprite(t) as unknown as Record<string, number>)[key] = v; });
    assert.ok(p.length > 0, `${key}=${v}`);
    assert.ok(p.some((m) => m.includes(key)), `${key}=${v}: ${p.join('; ')}`);
  }
});

test('check catches out-of-range juice numbers', () => {
  assert.ok(broken((t) => { t.juice.shake = 1.2; }).some((m) => m.includes('shake')));
  assert.ok(broken((t) => { t.juice.squash = -0.1; }).some((m) => m.includes('squash')));
  assert.ok(broken((t) => { t.juice.hitStopMs = 501; }).some((m) => m.includes('hitStopMs')));
  assert.ok(broken((t) => { t.juice.rateLimitMs = 1001; }).some((m) => m.includes('rateLimitMs')));
});

test('check catches bad colours', () => {
  for (const c of ['red', '#fff', '#ff66aaff', 'ff66aa', '#gg66aa', '']) {
    assert.ok(broken((t) => { firstSprite(t).colors = [c]; }).some((m) => m.includes('colour')), c);
  }
  assert.ok(broken((t) => { firstSprite(t).colors = []; }).length > 0);
  assert.deepEqual(broken((t) => { firstSprite(t).colors = ['#ABCDEF']; }), []);
});

test('check catches a juice.sprite that is not among the sprites, accepts null', () => {
  assert.ok(broken((t) => { t.juice.sprite = 'nope'; }).some((m) => m.includes('nope')));
  assert.deepEqual(broken((t) => { t.juice.sprite = null; }), []);
});

test('check catches squash curve problems', () => {
  // out of order
  assert.ok(broken((t) => { t.squashCurve = [[0, 1], [200, 0.9], [100, 1.1], [300, 1]]; }).some((m) => m.includes('time order')));
  // y too low / too high
  assert.ok(broken((t) => { t.squashCurve = [[0, 1], [100, 0.4], [300, 1]]; }).some((m) => m.includes('outside')));
  assert.ok(broken((t) => { t.squashCurve = [[0, 1], [100, 1.7], [300, 1]]; }).some((m) => m.includes('outside')));
  // not starting / ending at 1
  assert.ok(broken((t) => { t.squashCurve = [[0, 0.9], [100, 1.1], [300, 1]]; }).some((m) => m.includes('starts')));
  assert.ok(broken((t) => { t.squashCurve = [[0, 1], [100, 1.1], [300, 0.9]]; }).some((m) => m.includes('ends')));
  // empty
  assert.ok(broken((t) => { t.squashCurve = []; }).length > 0);
});

test('check catches burst problems', () => {
  assert.ok(broken((t) => { t.bursts = [0, 200, 100]; }).some((m) => m.includes('ascending')));
  assert.ok(broken((t) => { t.bursts = [0, 100, 100]; }).some((m) => m.includes('ascending')));
  assert.ok(broken((t) => { t.bursts = [0, 2001]; }).some((m) => m.includes('2001')));
  assert.ok(broken((t) => { t.bursts = [-10, 0]; }).length > 0);
  assert.deepEqual(broken((t) => { t.bursts = [0, 2000]; }), []);
});

test('squashAt interpolates linearly between keys', () => {
  const t = clone(TOOL_JUICE.spade);
  t.squashCurve = [[0, 1], [100, 0.6], [200, 1.4], [300, 1]];
  assert.equal(squashAt(t, 0), 1);
  assert.equal(squashAt(t, 100), 0.6);
  assert.ok(Math.abs(squashAt(t, 50) - 0.8) < 1e-9);
  assert.ok(Math.abs(squashAt(t, 150) - 1.0) < 1e-9);
  assert.ok(Math.abs(squashAt(t, 175) - 1.2) < 1e-9);
  assert.ok(Math.abs(squashAt(t, 250) - 1.2) < 1e-9);
  assert.equal(squashAt(t, 300), 1);
  assert.equal(squashAt(t, 301), 1);
  assert.equal(squashAt(t, -1), 1);
});

test('every curve stays inside 0.5..1.6 when sampled', () => {
  for (const id of TOOL_IDS) {
    for (let ms = -50; ms < 2100; ms += 7) {
      const y = squashAt(TOOL_JUICE[id], ms);
      assert.ok(y >= 0.5 && y <= 1.6, `${id} at ${ms}: ${y}`);
    }
  }
});

test('burstsBetween is from-exclusive, to-inclusive', () => {
  const t = TOOL_JUICE.windupKey;
  assert.deepEqual(burstsBetween(t, -1, 0), [0]);
  assert.deepEqual(burstsBetween(t, 0, 149), []);
  assert.deepEqual(burstsBetween(t, 0, 150), [150]);
  assert.deepEqual(burstsBetween(t, 150, 300), [300]);
  assert.deepEqual(burstsBetween(t, -1, 2000), t.bursts);
});

test('every tool fires each burst exactly once in a frame-stepped player', () => {
  for (const id of TOOL_IDS) {
    const t = TOOL_JUICE[id];
    const seen: number[] = [...burstsBetween(t, -1, 0)];
    for (let ms = 0; ms < 2100; ms += 16) seen.push(...burstsBetween(t, ms, ms + 16));
    assert.deepEqual(seen, t.bursts, id);
  }
});

test('shapes are used as listed', () => {
  const expected = {
    magnet: 'beam', can: 'cone', rollingPin: 'ripple', baton: 'rings', boombox: 'ripple',
    flashlight: 'cone', zapGun: 'beam', camera: 'stamp', windupKey: 'rings', spade: 'stamp',
    fairyWand: 'confetti',
  } as const;
  for (const id of TOOL_IDS) {
    assert.equal(TOOL_JUICE[id].shape, expected[id], id);
    assert.equal(TOOL_JUICE[id].tool, id);
  }
  assert.equal(new Set(TOOL_IDS.map((id) => TOOL_JUICE[id].shape)).size, 6);
});

test('the boombox has the largest shake, the flashlight has none', () => {
  const boom = TOOL_JUICE.boombox.juice.shake;
  for (const id of TOOL_IDS) {
    if (id !== 'boombox') assert.ok(TOOL_JUICE[id].juice.shake < boom, id);
  }
  assert.equal(TOOL_JUICE.flashlight.juice.shake, 0);
});

test('flavour details: default paint, camera click, heavy spade squash, ratchet then spring', () => {
  assert.ok(TOOL_JUICE.can.sprites.some((s) => s.colors.includes('#ff66aa')));
  assert.ok((TOOL_JUICE.camera.juice.sound ?? '').includes('click'));
  for (const id of TOOL_IDS) {
    if (id !== 'spade') assert.ok(TOOL_JUICE[id].juice.squash < TOOL_JUICE.spade.juice.squash, id);
  }
  assert.ok(Math.min(...TOOL_JUICE.spade.squashCurve.map(([, y]) => y)) <= 0.6);
  assert.equal(TOOL_JUICE.windupKey.bursts.length, 4);
  for (const id of TOOL_IDS) assert.ok(TOOL_JUICE[id].juice.sound, id);
});

test('describe gives one tooltip line', () => {
  assert.equal(describe(TOOL_JUICE.zapGun), 'Zap gun: cyan beam, hit-stop 60 ms, shake 0.4');
  assert.equal(describe(TOOL_JUICE.flashlight), 'Flashlight: warm white cone, no shake');
  for (const id of TOOL_IDS) assert.ok(!describe(TOOL_JUICE[id]).includes('\n'), id);
});