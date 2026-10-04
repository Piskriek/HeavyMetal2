import test from 'node:test';
import assert from 'node:assert/strict';
import { LIGHT_PRESETS, flicker, lightAt, pickLights, presetById, type LightPreset } from '../src/index';

const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const bulb: LightPreset = { id: 'b', name: 'B', kind: 'point', color: '#ffffff', intensity: 1, range: 10, angle: 0, penumbra: 0, flicker: 'none', rate: 0, castShadow: false };
const spot: LightPreset = { ...bulb, kind: 'spot', angle: 30, penumbra: 0.2 };

test('a point light fades with distance and stops at its range', () => {
  near(lightAt(bulb, [0, 0, 0], [0, -1, 0], [0, 0, 0]), 1);
  near(lightAt(bulb, [0, 0, 0], [0, -1, 0], [5, 0, 0]), 0.25);
  near(lightAt(bulb, [0, 0, 0], [0, -1, 0], [10, 0, 0]), 0);
  near(lightAt(bulb, [0, 0, 0], [0, -1, 0], [0, 12, 0]), 0);
});
test('a spot lights its cone and fades at the edge', () => {
  near(lightAt(spot, [0, 0, 0], [0, 0, 1], [0, 0, 5]), 0.25);
  const a = (27 * Math.PI) / 180;
  near(lightAt(spot, [0, 0, 0], [0, 0, 1], [5 * Math.sin(a), 0, 5 * Math.cos(a)]), 0.125);
  near(lightAt(spot, [0, 0, 0], [0, 0, 1], [0, 0, -5]), 0);
});
test('flicker: none, pulse and strobe follow their formulas', () => {
  assert.equal(flicker('none', 3, 1.234, 7), 1);
  near(flicker('pulse', 1, 0, 1), 0.5); near(flicker('pulse', 1, 0.25, 1), 1); near(flicker('pulse', 1, 0.75, 1), 0);
  assert.equal(flicker('strobe', 2, 0.05, 1), 1); assert.equal(flicker('strobe', 2, 0.2, 1), 0); assert.equal(flicker('strobe', 2, 0.55, 1), 1);
});
test('candle, fire and faulty stay in their ranges, move, and repeat with the seed', () => {
  for (const [kind, lo, hi] of [['candle', 0.75, 1.05], ['fire', 0.55, 1.15]] as const) {
    const v = Array.from({ length: 1000 }, (_, i) => flicker(kind, 3, i * 0.01, 42));
    assert.ok(v.every((x) => x >= lo - 1e-9 && x <= hi + 1e-9), kind);
    assert.ok(Math.max(...v) - Math.min(...v) > 0.05, kind);
    assert.equal(flicker(kind, 3, 1.5, 42), flicker(kind, 3, 1.5, 42));
  }
  const f = Array.from({ length: 1000 }, (_, i) => flicker('faulty', 2, i * 0.01, 9));
  assert.ok(f.filter((x) => x >= 0.9).length >= 800 && f.some((x) => x === 0));
});
test('pick the lights that matter, off ones never', () => {
  const lights = [
    { pos: [10, 0, 0] as [number, number, number], intensity: 1, range: 10, on: true },
    { pos: [2, 0, 0] as [number, number, number], intensity: 1, range: 5, on: true },
    { pos: [1, 0, 0] as [number, number, number], intensity: 9, range: 9, on: false },
    { pos: [0, 0, 1] as [number, number, number], intensity: 0.5, range: 2, on: true },
  ];
  assert.deepEqual(pickLights(lights, [0, 0, 0], 3), [1, 0, 3]);
  assert.deepEqual(pickLights(lights, [0, 0, 0], 2), [1, 0]);
});
test('ten legal presets', () => {
  assert.deepEqual(LIGHT_PRESETS.map((p) => p.id).sort(), ['bulb', 'campfire', 'candle', 'disco', 'flashlight-orb', 'lantern', 'neon', 'spotlight', 'strobe', 'torch']);
  for (const p of LIGHT_PRESETS) {
    assert.ok(/^#[0-9a-f]{6}$/i.test(p.color) && p.intensity >= 0 && p.intensity <= 10 && p.range >= 0.5 && p.range <= 60 && p.penumbra >= 0 && p.penumbra <= 1, p.id);
    assert.ok(p.kind === 'spot' ? p.angle >= 1 && p.angle <= 90 : p.angle === 0, p.id);
    assert.ok(p.flicker === 'none' || p.rate > 0, p.id);
  }
  assert.equal(presetById('spotlight')!.kind, 'spot'); assert.equal(presetById('torch')!.castShadow, true); assert.equal(presetById('nope'), undefined);
});

test('preset details and lookup completeness', () => {
  const bulbPreset = presetById('bulb');
  assert.ok(bulbPreset);
  assert.equal(bulbPreset.kind, 'point');
  assert.equal(bulbPreset.flicker, 'none');

  const flashPreset = presetById('flashlight-orb');
  assert.ok(flashPreset);
  assert.equal(flashPreset.kind, 'spot');
  assert.ok(flashPreset.angle > 0 && flashPreset.angle < 90);

  const campfirePreset = presetById('campfire');
  assert.ok(campfirePreset);
  assert.equal(campfirePreset.flicker, 'fire');

  const candlePreset = presetById('candle');
  assert.ok(candlePreset);
  assert.equal(candlePreset.flicker, 'candle');

  const strobePreset = presetById('strobe');
  assert.ok(strobePreset);
  assert.equal(strobePreset.flicker, 'strobe');

  const lanternPreset = presetById('lantern');
  assert.ok(lanternPreset);
  assert.equal(lanternPreset.flicker, 'candle');

  const neonPreset = presetById('neon');
  assert.ok(neonPreset);
  assert.equal(neonPreset.flicker, 'faulty');

  const discoPreset = presetById('disco');
  assert.ok(discoPreset);
  assert.equal(discoPreset.flicker, 'pulse');

  const torchPreset = presetById('torch');
  assert.ok(torchPreset);
  assert.equal(torchPreset.flicker, 'fire');
  assert.equal(torchPreset.castShadow, true);
});

test('spotlight inner and outer boundaries', () => {
  const spot40: LightPreset = { ...bulb, kind: 'spot', angle: 40, penumbra: 0.5 };
  const d = 4;
  const distFactor = Math.pow(1 - d / spot40.range, 2);

  near(lightAt(spot40, [0, 0, 0], [1, 0, 0], [d, 0, 0]), distFactor);

  const rad20 = (20 * Math.PI) / 180;
  near(lightAt(spot40, [0, 0, 0], [1, 0, 0], [d * Math.cos(rad20), d * Math.sin(rad20), 0]), distFactor);

  const rad30 = (30 * Math.PI) / 180;
  near(lightAt(spot40, [0, 0, 0], [1, 0, 0], [d * Math.cos(rad30), d * Math.sin(rad30), 0]), distFactor * 0.5);

  const rad40 = (40 * Math.PI) / 180;
  near(lightAt(spot40, [0, 0, 0], [1, 0, 0], [d * Math.cos(rad40), d * Math.sin(rad40), 0]), 0);

  const rad50 = (50 * Math.PI) / 180;
  near(lightAt(spot40, [0, 0, 0], [1, 0, 0], [d * Math.cos(rad50), d * Math.sin(rad50), 0]), 0);
});

test('spotlight with penumbra 0 has sharp cutoff', () => {
  const sharpSpot: LightPreset = { ...bulb, kind: 'spot', angle: 45, penumbra: 0 };
  const d = 5;
  const distFactor = Math.pow(1 - d / sharpSpot.range, 2);

  const rad44 = (44 * Math.PI) / 180;
  near(lightAt(sharpSpot, [0, 0, 0], [0, 1, 0], [0, d * Math.cos(rad44), d * Math.sin(rad44)]), distFactor);

  const rad46 = (46 * Math.PI) / 180;
  near(lightAt(sharpSpot, [0, 0, 0], [0, 1, 0], [0, d * Math.cos(rad46), d * Math.sin(rad46)]), 0);
});

test('pickLights edge cases: empty list, max 0, tie breaking, distance < 1', () => {
  assert.deepEqual(pickLights([], [0, 0, 0], 5), []);
  assert.deepEqual(pickLights([{ pos: [0, 0, 0], intensity: 1, range: 10, on: true }], [0, 0, 0], 0), []);
  assert.deepEqual(pickLights([{ pos: [0, 0, 0], intensity: 1, range: 10, on: false }], [0, 0, 0], 2), []);

  const ties = [
    { pos: [5, 0, 0] as [number, number, number], intensity: 1, range: 5, on: true },
    { pos: [5, 0, 0] as [number, number, number], intensity: 1, range: 5, on: true },
    { pos: [5, 0, 0] as [number, number, number], intensity: 1, range: 5, on: true },
  ];
  assert.deepEqual(pickLights(ties, [0, 0, 0], 2), [0, 1]);
  assert.deepEqual(pickLights(ties, [0, 0, 0], 3), [0, 1, 2]);

  const close = [
    { pos: [0.1, 0, 0] as [number, number, number], intensity: 2, range: 4, on: true },
    { pos: [0.5, 0, 0] as [number, number, number], intensity: 3, range: 4, on: true },
  ];
  assert.deepEqual(pickLights(close, [0, 0, 0], 2), [1, 0]);
});

test('flicker seed repeatability and divergence across different seeds', () => {
  const val1 = flicker('candle', 3, 2.5, 123);
  const val2 = flicker('candle', 3, 2.5, 123);
  assert.equal(val1, val2);

  const val3 = flicker('candle', 3, 2.5, 999);
  assert.notEqual(val1, val3);

  assert.equal(flicker('strobe', 0, 1, 1), 1);
  assert.ok(flicker('candle', 0, 1, 1) >= 0.75);
  assert.ok(flicker('fire', 0, 1, 1) >= 0.55);
  assert.equal(flicker('faulty', 0, 1, 1), 1);
});