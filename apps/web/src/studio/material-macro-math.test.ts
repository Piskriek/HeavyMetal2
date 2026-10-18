// ============================================================================
// File: apps/web/src/studio/material-macro-math.test.ts
// Unit tests for material-macro-math.ts
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMaterialMacro,
  combineCartridges,
  evaluateD21TierPreview,
  verifyD21Contract,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  transformColor,
  relativeLuminance,
  DEFAULT_MACRO_SLIDERS,
  type MaterialData,
} from './material-macro-math';

test('color conversions: hexToRgb and rgbToHex round-trip', () => {
  const hex = '#3dc8ff';
  const rgb = hexToRgb(hex);
  assert.ok(Math.abs(rgb[0] - 0.239) < 0.01);
  assert.ok(Math.abs(rgb[1] - 0.784) < 0.01);
  assert.ok(Math.abs(rgb[2] - 1.0) < 0.01);

  const back = rgbToHex(rgb);
  assert.equal(back.toLowerCase(), hex.toLowerCase());
});

test('hsl conversions: rgbToHsl and hslToRgb round-trip', () => {
  const red: [number, number, number] = [1, 0, 0];
  const hslRed = rgbToHsl(red);
  assert.equal(hslRed[0], 0);
  assert.equal(hslRed[1], 1);
  assert.equal(hslRed[2], 0.5);

  const backRed = hslToRgb(hslRed);
  assert.deepEqual(backRed, red);
});

test('transformColor: shifts hue and applies weathering desaturation', () => {
  const base = '#ff0000'; // pure red (hue 0)
  const shifted120 = transformColor(base, 120, 0); // should be green (hue 120)
  const rgbGreen = hexToRgb(shifted120);
  assert.ok(rgbGreen[1] > rgbGreen[0] && rgbGreen[1] > rgbGreen[2], 'expected green to dominate');

  const weathered = transformColor(base, 0, 1.0); // max weathering
  const rgbWeathered = hexToRgb(weathered);
  const [, s] = rgbToHsl(rgbWeathered);
  assert.ok(s < 0.6, `expected lower saturation, got ${s}`);
});

test('DEFAULT_MACRO_SLIDERS and evaluateD21TierPreview', () => {
  assert.equal(DEFAULT_MACRO_SLIDERS.hue, 0);
  assert.equal(DEFAULT_MACRO_SLIDERS.weathering, 0);
  const color: [number, number, number] = [0.5, 0.5, 0.5];
  const lum = relativeLuminance(color);
  const potato = evaluateD21TierPreview(color, 'potato');
  const ultra = evaluateD21TierPreview(color, 'ultra');
  assert.equal(potato.tier, 'potato');
  assert.equal(ultra.tier, 'ultra');
  assert.ok(Math.abs(potato.meanLuminance - lum) < 0.05);
});

test('applyMaterialMacro: modulates palette, roughness, and bump according to 5 sliders', () => {
  const base: MaterialData = {
    id: 'basalt',
    name: 'Basalt',
    palette: ['#222222', '#444444', '#666666'],
    tint: '#333333',
    roughness: 0.7,
    metallic: 0.1,
    bump: 0.4,
  };

  const modified = applyMaterialMacro(base, {
    hue: 60,
    grain: 0.8,
    weathering: 0.5,
    roughness: 0.3,
    bump: 0.6,
  });

  assert.notDeepEqual(modified.palette, base.palette);
  assert.notEqual(modified.tint, base.tint);
  assert.ok(modified.roughness !== base.roughness);
  assert.ok(modified.bump > 0.4);
});

test('combineCartridges: blends palettes and PBR properties linearly', () => {
  const matA: MaterialData = {
    id: 'mat-a',
    name: 'Basalt',
    palette: ['#000000', '#222222'],
    tint: '#111111',
    roughness: 0.8,
    metallic: 0.0,
    bump: 0.5,
  };
  const matB: MaterialData = {
    id: 'mat-b',
    name: 'Copper',
    palette: ['#ff8800', '#ffaa44'],
    tint: '#ff9922',
    roughness: 0.2,
    metallic: 1.0,
    bump: 0.1,
  };

  const fused50 = combineCartridges(matA, matB, 0.5);
  assert.equal(fused50.name, 'Basalt × Copper');
  assert.equal(fused50.roughness, 0.5);
  assert.equal(fused50.metallic, 0.5);
  assert.equal(fused50.bump, 0.3);

  const fusedA = combineCartridges(matA, matB, 0.0);
  assert.equal(fusedA.roughness, 0.8);
  assert.equal(fusedA.metallic, 0.0);

  const fusedB = combineCartridges(matA, matB, 1.0);
  assert.equal(fusedB.roughness, 0.2);
  assert.equal(fusedB.metallic, 1.0);
});

test('D21 constant-mean-luminance tier preview contract holds (delta <= 0.03)', () => {
  const colors: [number, number, number][] = [
    [0.2, 0.5, 0.8],
    [0.9, 0.4, 0.1],
    [0.3, 0.3, 0.3],
    [0.7, 0.8, 0.2],
  ];

  for (const c of colors) {
    const check = verifyD21Contract(c);
    assert.equal(check.ok, true, `D21 contract failed for color ${JSON.stringify(c)} with maxDelta ${check.maxDelta}`);
    assert.ok(check.maxDelta <= 0.03, `expected maxDelta <= 0.03, got ${check.maxDelta}`);
  }
});
