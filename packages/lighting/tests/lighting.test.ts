import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SETUP, LAMP_SLOTS, LIGHT_RANGES, LIGHT_VARIABLES, SETUPS, SETUP_IDS, applyTimeOfDay, cloneSetup, defaultLightParams, hexToRgb, isHex, lerpSetup, mixHex,
  nightFactor, normalizeSetup, paramsToSetup, rgbToHex, setIn, setupById, setupToParams, sunDirection, todElevation,
} from '../src';
import type { LightSetup } from '../src';

const byId = (id: string): LightSetup => setupById(id);
/** Strip float noise (blending produces 284.29999999999995) before comparing. */
const round = (s: LightSetup): unknown => JSON.parse(JSON.stringify(s, (_k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)));

test('the library has eighteen distinct, legal setups', () => {
  assert.equal(SETUPS.length, 18);
  assert.equal(new Set(SETUP_IDS).size, 18);
  for (const s of SETUPS) {
    assert.deepEqual(normalizeSetup(s, s), s, `${s.id} is not a fixed point of normalizeSetup`);
    assert.ok(s.name.length > 0);
  }
  assert.equal(setupById('no-such-setup').id, 'noon-clear');
});

test('library setups keep the sun from blowing the picture out', () => {
  for (const s of SETUPS) {
    assert.ok(s.sun.intensity <= 4, `${s.id} sun ${s.sun.intensity}`);
    assert.ok(s.exposure <= 1.6, `${s.id} exposure ${s.exposure}`);
    assert.ok(s.sun.intensity + s.hemi.intensity <= 5, `${s.id} total ${s.sun.intensity + s.hemi.intensity}`);
  }
});

test('library setups look different from each other', () => {
  const key = (s: LightSetup): string => [s.sun.color, s.sky.top, s.sky.horizon, s.fog.color, s.toneMapping, s.sun.elevationDeg].join('|');
  assert.equal(new Set(SETUPS.map(key)).size, SETUPS.length);
});

test('normalizeSetup repairs junk and never throws', () => {
  for (const junk of [undefined, null, 0, 'x', [], {}, { sun: 5 }, { sun: { intensity: NaN, color: 'red' } }, { post: { ssao: 'yes' } }, { extraLights: 'lamp' }, { fill: 3 }]) {
    const s = normalizeSetup(junk);
    assert.ok(isHex(s.sun.color));
    assert.ok(Number.isFinite(s.sun.intensity));
    assert.deepEqual(normalizeSetup(s), s, 'idempotent');
  }
  const wild = normalizeSetup({ sun: { intensity: 999, elevationDeg: 500, azimuthDeg: -90, shadowMapSize: 3000, color: '#ABCDEF' }, exposure: -3, toneMapping: 'sepia', post: { grain: 7, posterize: 2.6 } });
  assert.equal(wild.sun.intensity, LIGHT_RANGES.sunIntensity[1]);
  assert.equal(wild.sun.elevationDeg, 90);
  assert.equal(wild.sun.azimuthDeg, 270);
  assert.equal(wild.sun.shadowMapSize, 4096);
  assert.equal(wild.sun.color, '#abcdef');
  assert.equal(wild.exposure, LIGHT_RANGES.exposure[0]);
  assert.equal(wild.toneMapping, DEFAULT_SETUP.toneMapping);
  assert.equal(wild.post.grain, LIGHT_RANGES.grain[1]);
  assert.equal(wild.post.posterize, 3);
});

test('normalizeSetup keeps at most four point lamps and two spot lamps', () => {
  const lamp = (type: string) => ({ type, color: '#ffffff', intensity: 1, anchor: 'focus', offset: [0, 0, 0], distance: 5 });
  const s = normalizeSetup({ extraLights: [...Array(6).fill(0).map(() => lamp('point')), ...Array(4).fill(0).map(() => lamp('spot'))] });
  assert.equal(s.extraLights?.filter((l) => l.type === 'point').length, 4);
  assert.equal(s.extraLights?.filter((l) => l.type === 'spot').length, 2);
});

test('lerpSetup hits both ends exactly and does not touch its inputs', () => {
  const a = byId('noon-clear'), b = byId('blue-hour');
  const before = JSON.stringify([a, b]);
  assert.deepEqual(lerpSetup(a, b, 0), a);
  assert.deepEqual(lerpSetup(a, b, 1), b);
  assert.deepEqual(lerpSetup(a, b, -5), a);
  assert.deepEqual(lerpSetup(a, b, 9), b);
  assert.deepEqual(lerpSetup(a, b, NaN), a);
  assert.notEqual(lerpSetup(a, b, 0), a, 'returns a copy');
  lerpSetup(a, b, 0.4);
  assert.equal(JSON.stringify([a, b]), before);
});

test('lerpSetup blends numbers and colours, takes the short way round the compass, and stays legal', () => {
  const a = normalizeSetup({ sun: { intensity: 1, azimuthDeg: 350, color: '#000000' } });
  const b = normalizeSetup({ sun: { intensity: 3, azimuthDeg: 10, color: '#ffffff' } });
  const m = lerpSetup(a, b, 0.5);
  assert.equal(m.sun.intensity, 2);
  assert.ok(Math.abs(m.sun.azimuthDeg - 0) < 1e-9 || Math.abs(m.sun.azimuthDeg - 360) < 1e-9, `azimuth ${m.sun.azimuthDeg}`);
  assert.equal(m.sun.color, '#808080');
  for (const x of SETUPS) for (const y of SETUPS) for (const t of [0.1, 0.5, 0.9]) {
    const r = lerpSetup(x, y, t);
    assert.deepEqual(round(normalizeSetup(r, r)), round(r), `${x.id}->${y.id} at ${t}`);
  }
});

test('lerpSetup fades lamps in and out instead of popping', () => {
  const day = byId('noon-clear'), lit = byId('candle-lantern');
  const half = lerpSetup(day, lit, 0.5);
  assert.equal(half.extraLights?.length, lit.extraLights?.length);
  lit.extraLights?.forEach((l, i) => assert.ok(Math.abs((half.extraLights?.[i]?.intensity ?? -1) - l.intensity * 0.5) < 1e-9));
  const back = lerpSetup(lit, day, 0.25);
  lit.extraLights?.forEach((l, i) => assert.ok(Math.abs((back.extraLights?.[i]?.intensity ?? -1) - l.intensity * 0.75) < 1e-9));
});

test('setIn replaces one value and copies only the path', () => {
  const s = byId('noon-clear');
  const t = setIn(s, ['sun', 'intensity'], 1.5);
  assert.equal(t.sun.intensity, 1.5);
  assert.equal(s.sun.intensity, DEFAULT_SETUP.sun.intensity);
  assert.equal(t.hemi, s.hemi, 'untouched branches are shared');
  assert.notEqual(t.sun, s.sun);
  assert.deepEqual(setIn(null, ['a', 'b'], 1), { a: { b: 1 } });
});

test('hex helpers are total', () => {
  assert.equal(rgbToHex(1, 0.5, 0), '#ff8000');
  assert.equal(rgbToHex(NaN, 2, -1), '#00ff00');
  assert.deepEqual(hexToRgb('nope'), [0, 0, 0]);
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mixHex('#102030', '#ffffff', NaN), '#102030');
  assert.equal(isHex('#12345'), false);
});

test('sunDirection is a unit vector that points where the angles say', () => {
  const s = normalizeSetup({ sun: { azimuthDeg: 90, elevationDeg: 0 } });
  const [x, y, z] = sunDirection(s);
  assert.ok(Math.abs(x - 1) < 1e-9 && Math.abs(y) < 1e-9 && Math.abs(z) < 1e-9);
  for (const v of SETUPS) { const d = sunDirection(v); assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9); }
});

test('time of day: the sun climbs to noon, sets, and the night is dark', () => {
  assert.ok(Math.abs(todElevation(12) - 72) < 1e-9);
  assert.ok(Math.abs(todElevation(6)) < 1e-9);
  assert.ok(todElevation(0) < -60);
  const base = byId('noon-clear');
  const noon = applyTimeOfDay(base, 12), dusk = applyTimeOfDay(base, 17.5), midnight = applyTimeOfDay(base, 0);
  assert.ok(noon.sun.elevationDeg > 50);
  assert.ok(dusk.sun.elevationDeg < 12);
  assert.ok(nightFactor(noon) < 0.2, `noon night factor ${nightFactor(noon)}`);
  assert.ok(nightFactor(midnight) > 0.7, `midnight night factor ${nightFactor(midnight)}`);
  assert.ok(midnight.hemi.intensity < noon.hemi.intensity);
  for (let h = 0; h < 24; h += 0.5) {
    const r = applyTimeOfDay(base, h);
    assert.deepEqual(round(normalizeSetup(r, r)), round(r), `hour ${h}`);
  }
  assert.deepEqual(applyTimeOfDay(base, NaN), applyTimeOfDay(base, 12));
});

test('time of day moves smoothly (no big jump between ten-minute steps)', () => {
  const base = byId('golden-hour');
  let prev = applyTimeOfDay(base, 0);
  for (let m = 10; m <= 24 * 60; m += 10) {
    const cur = applyTimeOfDay(base, m / 60);
    assert.ok(Math.abs(cur.sun.intensity - prev.sun.intensity) < 1.0, `sun jumps at ${m / 60}h: ${prev.sun.intensity} -> ${cur.sun.intensity}`);
    assert.ok(Math.abs(cur.exposure - prev.exposure) < 0.15, `exposure jumps at ${m / 60}h`);
    prev = cur;
  }
});

test('nightFactor is high for the night setups and low for the day ones', () => {
  for (const id of ['noon-clear', 'golden-hour', 'overcast', 'tropical-dawn', 'toon-flat', 'studio-white']) assert.ok(nightFactor(byId(id)) < 0.25, `${id} ${nightFactor(byId(id))}`);
  for (const id of ['moonlit-night', 'aurora', 'candle-lantern']) assert.ok(nightFactor(byId(id)) > 0.6, `${id} ${nightFactor(byId(id))}`);
});

test('the flat form round-trips every library setup', () => {
  for (const s of SETUPS) {
    const p = setupToParams(s);
    assert.deepEqual(paramsToSetup(p, s.id, s.name), s, s.id);
  }
});

test('LIGHT_VARIABLES describe every knob once, with defaults inside their own range', () => {
  const keys = LIGHT_VARIABLES.map((v) => v.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(Object.keys(setupToParams(DEFAULT_SETUP)).sort(), [...keys].sort());
  for (const v of LIGHT_VARIABLES) {
    assert.ok(v.label.length > 0 && v.doc.length > 0, v.key);
    if (v.type === 'number') {
      const n = v.default as number;
      assert.ok(n >= (v.min ?? -Infinity) && n <= (v.max ?? Infinity), `${v.key} default ${n}`);
    }
    if (v.type === 'enum') assert.ok(v.options?.includes(String(v.default)), v.key);
  }
  assert.equal(LIGHT_VARIABLES.filter((v) => v.key.startsWith('lamp')).length, LAMP_SLOTS * 9);
});

test('paramsToSetup fills gaps with defaults and survives junk', () => {
  assert.deepEqual(paramsToSetup({}), { ...paramsToSetup(defaultLightParams()) });
  const p = paramsToSetup({ sunIntensity: 2, lamp1On: true, lamp1Color: '#ff0000', lamp1Anchor: 'torch', lamp3On: true, waterColor: 12 });
  assert.equal(p.sun.intensity, 2);
  assert.equal(p.extraLights?.length, 2);
  assert.equal(p.extraLights?.[0]?.anchor, 'torch');
  assert.equal(p.water.color, DEFAULT_SETUP.water.color);
  for (const junk of [null, undefined, 5, 'x', [1, 2]]) assert.ok(isHex(paramsToSetup(junk).sky.top));
});

test('cloneSetup is deep', () => {
  const s = byId('candle-lantern');
  const c = cloneSetup(s);
  assert.deepEqual(c, s);
  c.extraLights![0]!.offset[0] = 99;
  c.sun.intensity = 0;
  assert.notEqual(s.extraLights![0]!.offset[0], 99);
  assert.notEqual(s.sun.intensity, 0);
});

test('everything is deterministic', () => {
  const a = JSON.stringify(SETUPS.map((s) => applyTimeOfDay(s, 7.3)));
  const b = JSON.stringify(SETUPS.map((s) => applyTimeOfDay(s, 7.3)));
  assert.equal(a, b);
});
