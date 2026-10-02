import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToLinear,
  kelvinToRgb,
  sunDirection,
  mixLooks,
  validateLook,
  LOOKS,
  timeOfDayLook,
  LOOK_NUMBER_KEYS,
  LOOK_RANGES,
  type LookParams
} from '../src';

const byId = (id: string): LookParams => LOOKS.find((l) => l.id === id)!.params;

test('extra 1: mix is symmetric at 0.5', () => {
  const a = byId('noon-clear');
  const b = byId('sunset-blaze');

  const mixAB = mixLooks(a, b, 0.5);
  const mixBA = mixLooks(b, a, 0.5);

  // Compare properties
  assert.equal(mixAB.exposure, mixBA.exposure);
  assert.equal(mixAB.fogDensity, mixBA.fogDensity);
  assert.equal(mixAB.skyZenith.toLowerCase(), mixBA.skyZenith.toLowerCase());
  assert.equal(mixAB.skyHorizon.toLowerCase(), mixBA.skyHorizon.toLowerCase());
  assert.equal(mixAB.skyGround.toLowerCase(), mixBA.skyGround.toLowerCase());
});

test('extra 2: mixing three looks in sequence stays valid', () => {
  const a = byId('noon-clear');
  const b = byId('sunset-blaze');
  const c = byId('golden-hour');

  const mix1 = mixLooks(a, b, 0.3);
  const mix2 = mixLooks(mix1, c, 0.7);

  const validation = validateLook(mix2);
  assert.equal(validation.ok, true, `Validation errors: ${validation.errors.join(', ')}`);
});

test('extra 3: kelvin monotonic red->blue trend', () => {
  const temp1 = kelvinToRgb(2000);
  const temp2 = kelvinToRgb(6500);
  const temp3 = kelvinToRgb(12000);

  // Red should decrease relative to Blue as temperature rises
  const ratio1 = temp1[2] / (temp1[0] || 1e-5); // blue / red
  const ratio2 = temp2[2] / (temp2[0] || 1e-5);
  const ratio3 = temp3[2] / (temp3[0] || 1e-5);

  assert.ok(ratio3 > ratio2, `Ratio 12000K (${ratio3}) should be higher than 6500K (${ratio2})`);
  assert.ok(ratio2 > ratio1, `Ratio 6500K (${ratio2}) should be higher than 2000K (${ratio1})`);
});

test('extra 4: hex parsing of uppercase and 3-digit rejection', () => {
  // Uppercase hex should work and match lowercase
  const upper = hexToLinear('#AABBCC');
  const lower = hexToLinear('#aabbcc');
  assert.deepEqual(upper, lower);

  // 3-digit hex should throw an error
  assert.throws(() => {
    hexToLinear('#abc');
  }, /Invalid hex format/);

  // Invalid hex characters should throw an error
  assert.throws(() => {
    hexToLinear('#zzxx11');
  }, /Invalid hex format/);
});

test('extra 5: timeOfDayLook at exact keyframes matches the preset except overridden sun', () => {
  // At hour 12, the preset should be "noon-clear"
  const tod12 = timeOfDayLook(12);
  const noon = byId('noon-clear');

  // Verify all non-sun properties match noon-clear (case-insensitive for hex colors)
  assert.equal(tod12.exposure, noon.exposure);
  assert.equal(tod12.fogDensity, noon.fogDensity);
  assert.equal(tod12.skyZenith.toLowerCase(), noon.skyZenith.toLowerCase());
  assert.equal(tod12.skyHorizon.toLowerCase(), noon.skyHorizon.toLowerCase());
  assert.equal(tod12.waterColor.toLowerCase(), noon.waterColor.toLowerCase());
});

test('extra 6: LOOK_RANGES covers all numeric keys and has min <= max', () => {
  for (const key of LOOK_NUMBER_KEYS) {
    const range = LOOK_RANGES[key];
    assert.ok(range, `Missing range for key: ${key}`);
    assert.ok(range[0] <= range[1], `Invalid range for key ${key}: [${range[0]}, ${range[1]}]`);
  }
});

test('extra 7: sunDirection returns unit vector for various inputs', () => {
  for (let el = -20; el <= 90; el += 15) {
    for (let az = 0; az <= 360; az += 45) {
      const dir = sunDirection(el, az);
      const len = Math.hypot(...dir);
      assert.ok(Math.abs(len - 1.0) < 1e-6, `Direction vector is not unit: ${dir} for el=${el}, az=${az}`);
    }
  }
});

test('extra 8: validateLook returns ok false on missing fields or incorrect types', () => {
  const valid = byId('noon-clear');

  // String instead of number
  const invalid1 = { ...valid, exposure: 'bright' as any };
  assert.equal(validateLook(invalid1).ok, false);

  // Missing properties
  const invalid2 = { ...valid } as any;
  delete invalid2.skyZenith;
  assert.equal(validateLook(invalid2).ok, false);
});
