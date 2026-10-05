import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_IDS, TOOL_JUICE, burstsBetween, check, describe, squashAt, ToolJuice } from '../src/index';

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

test('distinct shapes are used as listed', () => {
  assert.equal(TOOL_JUICE.magnet.shape, 'beam');
  assert.equal(TOOL_JUICE.can.shape, 'cone');
  assert.equal(TOOL_JUICE.rollingPin.shape, 'ripple');
  assert.equal(TOOL_JUICE.baton.shape, 'rings');
  assert.equal(TOOL_JUICE.boombox.shape, 'ripple');
  assert.equal(TOOL_JUICE.flashlight.shape, 'cone');
  assert.equal(TOOL_JUICE.zapGun.shape, 'beam');
  assert.equal(TOOL_JUICE.camera.shape, 'stamp');
  assert.equal(TOOL_JUICE.windupKey.shape, 'rings');
  assert.equal(TOOL_JUICE.spade.shape, 'stamp');
  assert.equal(TOOL_JUICE.fairyWand.shape, 'confetti');
});

test('the boombox has the largest shake, the flashlight has none', () => {
  assert.equal(TOOL_JUICE.flashlight.juice.shake, 0);
  const boomboxShake = TOOL_JUICE.boombox.juice.shake;
  for (const id of TOOL_IDS) {
    if (id !== 'boombox') {
      assert.ok(
        boomboxShake > TOOL_JUICE[id].juice.shake,
        `boombox shake (${boomboxShake}) should exceed ${id} shake (${TOOL_JUICE[id].juice.shake})`,
      );
    }
  }
});

test('squashAt linearly interpolates between keys and returns 1 outside', () => {
  const tool: ToolJuice = {
    tool: 'magnet',
    shape: 'beam',
    juice: {
      id: 'j_test',
      name: 'Test',
      sprite: null,
      sound: null,
      shake: 0.1,
      squash: 0.1,
      hitStopMs: 0,
      rateLimitMs: 100,
    },
    sprites: [],
    squashCurve: [
      [0, 1.0],
      [100, 1.4],
      [200, 0.8],
      [300, 1.0],
    ],
    bursts: [0],
  };

  assert.equal(squashAt(tool, -50), 1.0);
  assert.equal(squashAt(tool, 0), 1.0);
  assert.equal(squashAt(tool, 50), 1.2);
  assert.equal(squashAt(tool, 100), 1.4);
  assert.equal(squashAt(tool, 150), 1.1);
  assert.equal(squashAt(tool, 200), 0.8);
  assert.equal(squashAt(tool, 250), 0.9);
  assert.equal(squashAt(tool, 300), 1.0);
  assert.equal(squashAt(tool, 350), 1.0);
});

test('check catches sprite number range violations', () => {
  const base = TOOL_JUICE.magnet;
  const invalidSprite = {
    ...base.sprites[0]!,
    count: 500,
    size: 0.01,
    lifeMs: 50,
    speed: 35,
    spread: 1.5,
    gravity: 50,
    drag: 25,
    shrink: 1.2,
  };
  const invalid: ToolJuice = {
    ...base,
    sprites: [invalidSprite],
  };
  const errors = check(invalid);
  assert.ok(errors.length >= 8, `Expected at least 8 sprite errors, got ${errors.length}: ${errors.join('; ')}`);
});

test('check catches juice number range violations', () => {
  const base = TOOL_JUICE.magnet;
  const invalid: ToolJuice = {
    ...base,
    juice: {
      ...base.juice,
      shake: 1.5,
      squash: 1.2,
      hitStopMs: 600,
      rateLimitMs: 1200,
    },
  };
  const errors = check(invalid);
  assert.ok(errors.length >= 4, `Expected at least 4 juice errors, got ${errors.length}: ${errors.join('; ')}`);
});

test('check catches invalid hex colors', () => {
  const base = TOOL_JUICE.magnet;
  const invalid: ToolJuice = {
    ...base,
    sprites: [
      {
        ...base.sprites[0]!,
        colors: ['blue', '#fff', '#12345z', '#1234567', ''],
      },
    ],
  };
  const errors = check(invalid);
  assert.equal(errors.length, 5);
});

test('check catches missing sprite references', () => {
  const base = TOOL_JUICE.magnet;
  const invalid: ToolJuice = {
    ...base,
    juice: {
      ...base.juice,
      sprite: 'non_existent_sprite',
    },
  };
  const errors = check(invalid);
  assert.ok(errors.some((e) => e.includes('not among sprites')));

  const validNullSprite: ToolJuice = {
    ...base,
    juice: {
      ...base.juice,
      sprite: null,
    },
  };
  assert.deepEqual(check(validNullSprite), []);
});

test('check catches squash curve violations', () => {
  const base = TOOL_JUICE.magnet;

  const notStartingAtOne: ToolJuice = {
    ...base,
    squashCurve: [
      [0, 1.2],
      [100, 1.0],
    ],
  };
  assert.ok(check(notStartingAtOne).some((e) => e.includes('start at y = 1')));

  const notEndingAtOne: ToolJuice = {
    ...base,
    squashCurve: [
      [0, 1.0],
      [100, 0.8],
    ],
  };
  assert.ok(check(notEndingAtOne).some((e) => e.includes('end at y = 1')));

  const outOfOrder: ToolJuice = {
    ...base,
    squashCurve: [
      [0, 1.0],
      [100, 1.2],
      [80, 0.9],
      [200, 1.0],
    ],
  };
  assert.ok(check(outOfOrder).some((e) => e.includes('time order')));

  const yOutOfRange: ToolJuice = {
    ...base,
    squashCurve: [
      [0, 1.0],
      [50, 0.4],
      [100, 1.7],
      [150, 1.0],
    ],
  };
  const yErrors = check(yOutOfRange);
  assert.ok(yErrors.some((e) => e.includes('0.4')));
  assert.ok(yErrors.some((e) => e.includes('1.7')));

  const tooShort: ToolJuice = {
    ...base,
    squashCurve: [[0, 1.0]],
  };
  assert.ok(check(tooShort).some((e) => e.includes('at least 2 keys')));
});

test('check catches burst violations', () => {
  const base = TOOL_JUICE.magnet;

  const notAscending: ToolJuice = {
    ...base,
    bursts: [0, 100, 50],
  };
  assert.ok(check(notAscending).some((e) => e.includes('not ascending')));

  const duplicateBursts: ToolJuice = {
    ...base,
    bursts: [0, 100, 100],
  };
  assert.ok(check(duplicateBursts).some((e) => e.includes('not ascending')));

  const outOfRange: ToolJuice = {
    ...base,
    bursts: [-10, 2500],
  };
  const rangeErrors = check(outOfRange);
  assert.ok(rangeErrors.some((e) => e.includes('-10')));
  assert.ok(rangeErrors.some((e) => e.includes('2500')));
});

test('describe generates concise tooltip text', () => {
  assert.equal(describe(TOOL_JUICE.zapGun), 'Zap gun: cyan beam, hit-stop 60 ms, shake 0.4');
  assert.equal(describe(TOOL_JUICE.magnet), 'Magnet: blue and red beam, shake 0.25, squash 0.2');
  assert.equal(describe(TOOL_JUICE.flashlight), 'Flashlight: warm white cone, squash 0.05');
  assert.equal(describe(TOOL_JUICE.boombox), 'Boombox: purple ripple, shake 0.95, squash 0.6');
});