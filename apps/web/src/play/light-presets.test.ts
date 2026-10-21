import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { flatten } from '@hm/kitspec';
import { CAPACITOR_BANK_KIT } from './kit-capacitor-bank';
import { isLampPart, kelvinHex, LIGHT_PRESETS, lightName, lightOverride, lightSpecName, parseLightName, patternGlow } from './light-presets';
import { lightMaterial, tickLights } from './light-material';

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

test('colour temperature runs warm to cool: 2000 K amber, 6500 K near white, 9000 K blue-white', () => {
  const [r2, g2, b2] = rgb(kelvinHex(2000));
  assert.ok(r2 === 255 && g2 > 120 && g2 < 150 && b2 < 30, `2000 K ${kelvinHex(2000)}`);
  const [r6, g6, b6] = rgb(kelvinHex(6500));
  assert.ok(r6 > 245 && g6 > 235 && b6 > 235, `6500 K ${kelvinHex(6500)}`);
  const [r9, , b9] = rgb(kelvinHex(9000));
  assert.ok(b9 === 255 && r9 < 230, `9000 K ${kelvinHex(9000)}`);
});

test('a light names its lamp material and reads back from it; junk names are not lights', () => {
  for (const p of LIGHT_PRESETS) {
    const back = parseLightName(lightName(p))!;
    assert.deepEqual({ ...back }, { kelvin: p.kelvin, intensity: Number(p.intensity.toFixed(2)), pattern: p.pattern, colour: p.colour?.toLowerCase() ?? null });
    assert.equal(lightSpecName(p), p.name, 'a preset keeps its own name');
  }
  assert.equal(parseLightName('lx:2000:1.20:disco'), null);
  assert.equal(parseLightName('vault:basalt_joint'), null);
  assert.equal(lightSpecName({ kelvin: 3100, colour: null, intensity: 1, pattern: 'flicker' }), '3100 K, flicker');
});

test('patterns stay in [0, 1] and a blink really goes dark between flashes; the same time gives the same glow', () => {
  for (const p of ['steady', 'pulse', 'blink', 'flicker'] as const) {
    for (let t = 0; t < 5; t += 0.07) {
      const g = patternGlow(p, t);
      assert.ok(g >= 0 && g <= 1, `${p} at ${t}: ${g}`);
      assert.equal(patternGlow(p, t), g);
    }
  }
  assert.equal(patternGlow('blink', 0.1), 1);
  assert.ok(patternGlow('blink', 0.6) < 0.1);
});

test('the bank\'s charge lamps are lamps (like for like); a light sets one whole, and keeps what was there', () => {
  const placed = flatten(CAPACITOR_BANK_KIT, 'capacitor-bank');
  const lamps = placed.filter(isLampPart);
  assert.equal(lamps.length, 6, 'one per cell');
  assert.ok(!placed.filter((p) => p.path.startsWith('bolts-')).some(isLampPart), 'a bolt is not a lamp');
  const sodium = LIGHT_PRESETS[0]!;
  assert.deepEqual(lightOverride(sodium, lamps[0]!, { params: { x: 1 } }), { params: { x: 1 }, material: lightName(sodium) });
  assert.equal(lightOverride(sodium, placed.find((p) => p.path === 'skid')!), null);
});

test('a light material is shared by name, glows its colour, and its pattern moves with the tick', () => {
  const name = lightName({ kelvin: 4000, colour: '#ffb02a', intensity: 2, pattern: 'blink' });
  const m = lightMaterial(name) as THREE.MeshStandardMaterial;
  assert.equal(lightMaterial(name), m);
  assert.equal(`#${m.emissive.getHexString()}`, '#ffb02a');
  tickLights(0.1);
  assert.equal(m.emissiveIntensity, 2);
  tickLights(0.6);
  assert.ok(m.emissiveIntensity < 0.2);
  assert.equal(lightMaterial('gunmetal'), null);
});
