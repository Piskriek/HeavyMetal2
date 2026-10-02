import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToLinear, linearToHex, kelvinToRgb, sunDirection, sunColor, mixLooks, validateLook, LOOKS, timeOfDayLook, lookToUniforms, LOOK_NUMBER_KEYS, LOOK_COLOR_KEYS, LOOK_RANGES, type LookParams } from '../src';
const near = (a: number, b: number, e = 1e-6): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const byId = (id: string): LookParams => LOOKS.find((l) => l.id === id)!.params;

test('colour: hex <-> linear round trip and known values', () => {
  near(hexToLinear('#ffffff')[0], 1); near(hexToLinear('#000000')[1], 0); near(hexToLinear('#808080')[0], 0.2158605, 1e-5);
  for (const h of ['#000000', '#ffffff', '#12ab9f', '#fedcba', '#7f7f7f']) assert.equal(linearToHex(hexToLinear(h)), h);
  assert.equal(linearToHex([2, -1, 0.5]), '#ff00bc');
});
test('kelvin: warm, white and cool', () => {
  const w = kelvinToRgb(6500); for (const c of w) assert.ok(c > 0.94 && c <= 1.0001, `6500K ${w}`);
  const warm = kelvinToRgb(2000); assert.ok(warm[0] > warm[1] && warm[1] > warm[2] && warm[2] < 0.3, `2000K ${warm}`);
  const cool = kelvinToRgb(12000); assert.ok(cool[2] > cool[0], `12000K ${cool}`);
  assert.equal(Math.max(...kelvinToRgb(3000)), 1); assert.deepEqual(kelvinToRgb(10), kelvinToRgb(1000));
});
test('sun direction and colour', () => {
  const up = sunDirection(90, 123); near(up[0], 0, 1e-9); near(up[1], 1); near(up[2], 0, 1e-9);
  const n = sunDirection(0, 0); near(n[0], 0, 1e-9); near(n[1], 0, 1e-9); near(n[2], -1);
  const e = sunDirection(0, 90); near(e[0], 1); near(e[2], 0, 1e-9);
  for (const [el, az] of [[10, 200], [45, 45], [-5, 300]] as const) near(Math.hypot(...sunDirection(el, az)), 1);
  const noon = sunColor(byId('noon-clear')); assert.ok(noon[0] > 1 && noon[1] > 1);
  const night = sunColor({ ...byId('noon-clear'), sunElevation: -10 }); assert.deepEqual(night, [0, 0, 0]);
  const low = sunColor({ ...byId('noon-clear'), sunElevation: -2 }); assert.ok(low[0] > 0 && low[0] < noon[0]);
});
test('mixLooks: endpoints, midpoint, shortest azimuth, linear-light colours', () => {
  const a = byId('noon-clear'), b = byId('sunset-blaze');
  assert.deepEqual(mixLooks(a, b, 0), { ...a, skyZenith: a.skyZenith.toLowerCase(), skyHorizon: a.skyHorizon.toLowerCase(), skyGround: a.skyGround.toLowerCase(), ambientSky: a.ambientSky.toLowerCase(), ambientGround: a.ambientGround.toLowerCase(), fogColor: a.fogColor.toLowerCase(), waterColor: a.waterColor.toLowerCase() });
  const half = mixLooks(a, b, 0.5); near(half.exposure, (a.exposure + b.exposure) / 2); near(half.sunElevation, (a.sunElevation + b.sunElevation) / 2);
  assert.equal(validateLook(half).ok, true);
  const x = mixLooks({ ...a, sunAzimuth: 350 }, { ...a, sunAzimuth: 10 }, 0.5); assert.ok(Math.min(x.sunAzimuth, 360 - x.sunAzimuth) < 1e-9, `az ${x.sunAzimuth}`);
  const mid = mixLooks({ ...a, skyZenith: '#000000' }, { ...a, skyZenith: '#ffffff' }, 0.5);
  assert.equal(mid.skyZenith, linearToHex([0.5, 0.5, 0.5]));
  assert.deepEqual(mixLooks(a, b, -3), mixLooks(a, b, 0)); assert.deepEqual(mixLooks(a, b, 7), mixLooks(a, b, 1));
});
test('validateLook names the broken key', () => {
  const a = byId('noon-clear');
  assert.equal(validateLook(a).ok, true);
  assert.ok(validateLook({ ...a, exposure: 9 }).errors.some((e) => /exposure/.test(e)));
  assert.ok(validateLook({ ...a, skyZenith: 'blue' }).errors.some((e) => /skyZenith/.test(e)));
  assert.ok(validateLook({ ...a, sunKelvin: Number.NaN }).errors.some((e) => /sunKelvin/.test(e)));
  const missing = { ...a } as Partial<LookParams>; delete missing.fogDensity;
  assert.ok(validateLook(missing as LookParams).errors.some((e) => /fogDensity/.test(e)));
  assert.equal(new Set([...LOOK_NUMBER_KEYS, ...LOOK_COLOR_KEYS]).size, Object.keys(a).length);
  for (const k of LOOK_NUMBER_KEYS) assert.ok(LOOK_RANGES[k as string]);
});
test('the 10 presets are valid, distinct and tell their story', () => {
  assert.deepEqual(LOOKS.map((l) => l.id), ['noon-clear', 'golden-hour', 'sunset-blaze', 'tropical-dawn', 'overcast-day', 'storm-front', 'blue-hour', 'moonlit-night', 'volcanic-ash', 'neon-dusk']);
  for (const l of LOOKS) { assert.deepEqual(validateLook(l.params), { ok: true, errors: [] }, l.id); assert.ok(l.tags.length >= 2 && l.tags.length <= 4 && l.doc.length > 15 && l.name.length > 2); }
  assert.equal(new Set(LOOKS.map((l) => l.params.skyZenith.toLowerCase())).size, 10);
  assert.ok(byId('noon-clear').sunElevation > 55 && byId('golden-hour').sunElevation < 20 && byId('blue-hour').sunElevation < 0 && byId('moonlit-night').sunElevation < -10);
  assert.ok(byId('sunset-blaze').sunKelvin < 3000 && byId('overcast-day').sunIntensity < byId('noon-clear').sunIntensity / 2);
  assert.ok(byId('storm-front').fogDensity > byId('noon-clear').fogDensity * 3 && byId('storm-front').cloudCover >= 0.9);
  assert.ok(byId('moonlit-night').exposure > byId('noon-clear').exposure);
});
test('time of day: continuous, wraps, sun arc, always valid', () => {
  for (let h = -30; h <= 54; h += 0.37) assert.equal(validateLook(timeOfDayLook(h)).ok, true, `hour ${h}`);
  assert.deepEqual(timeOfDayLook(3), timeOfDayLook(27)); assert.deepEqual(timeOfDayLook(-1), timeOfDayLook(23));
  near(timeOfDayLook(12).sunElevation, 90, 1e-6); near(timeOfDayLook(12).sunAzimuth, 180, 1e-6); near(timeOfDayLook(6).sunAzimuth, 90, 1e-6); near(timeOfDayLook(18).sunAzimuth, 270, 1e-6);
  assert.ok(timeOfDayLook(0).sunElevation < 0 && timeOfDayLook(9).sunElevation > 20 && timeOfDayLook(15).sunElevation > 20);
  let prev = timeOfDayLook(0);
  for (let h = 0.05; h <= 24; h += 0.05) { const cur = timeOfDayLook(h); assert.ok(Math.abs(cur.exposure - prev.exposure) < 0.12 && Math.abs(cur.sunElevation - prev.sunElevation) < 4, `jump at ${h}`); prev = cur; }
});
test('uniforms', () => {
  const p = byId('golden-hour'); const u = lookToUniforms(p);
  assert.deepEqual(u.sunDir, sunDirection(p.sunElevation, p.sunAzimuth)); assert.deepEqual(u.sunColor, sunColor(p));
  assert.deepEqual(u.skyZenith, hexToLinear(p.skyZenith)); assert.equal(u.exposure, p.exposure); assert.equal(u.fogDensity, p.fogDensity); assert.equal(u.cloudCover, p.cloudCover);
});
