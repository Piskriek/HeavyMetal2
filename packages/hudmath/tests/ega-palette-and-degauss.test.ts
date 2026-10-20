// ============================================================================
// File: packages/hudmath/tests/ega-palette-and-degauss.test.ts
// TICKET-24 unit tests covering POL-01, POL-64, POL-41, POL-42, POL-67, POL-71
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EGA_16_PALETTE,
  quantizeHexToEga16,
  computeSkinDegaussEnvelope,
  computeGateCapacitorChargeCurve,
  FIDELITY_LOADER_LABELS,
  computeMenuHeroVistaState,
} from '../src/ega-palette-and-degauss';

test('POL-42: quantizeHexToEga16 maps the 4 canonical metric colours to distinct IBM EGA 16-colour entries', () => {
  assert.equal(EGA_16_PALETTE.length, 16);
  const pxd = quantizeHexToEga16('#ff3d8a'); // Bright Red / Bright Magenta
  const vtx = quantizeHexToEga16('#7cff4d'); // Bright Green (#55ff55)
  const lx = quantizeHexToEga16('#ffc13d');  // Bright Yellow (#ffff55)
  const aq = quantizeHexToEga16('#3dc8ff');  // Bright Cyan (#55ffff)

  assert.equal(vtx.hex, '#55ff55');
  assert.equal(lx.hex, '#ffff55');
  assert.equal(aq.hex, '#55ffff');
  assert.notEqual(pxd.hex, vtx.hex);
});

test('POL-42: computeSkinDegaussEnvelope produces a 40 ms CRT degauss pulse and zeroes outside [0, 40]', () => {
  const mid = computeSkinDegaussEnvelope(15);
  assert.equal(mid.active, true);
  assert.ok(mid.gain > 0.1);
  assert.ok(mid.coilFreqHz > 70 && mid.coilFreqHz < 115);

  const after = computeSkinDegaussEnvelope(45);
  assert.equal(after.active, false);
  assert.equal(after.gain, 0);
});

test('POL-67: computeGateCapacitorChargeCurve sweeps pitch from 68 Hz to 640 Hz and fires amber arc crackle near completion', () => {
  const start = computeGateCapacitorChargeCurve(0.05);
  const mid = computeGateCapacitorChargeCurve(0.5);
  const peak = computeGateCapacitorChargeCurve(0.85);
  assert.ok(start.chargeFreqHz < mid.chargeFreqHz);
  assert.ok(mid.chargeFreqHz < peak.chargeFreqHz);
  assert.equal(mid.arcCrackleGain, 0);
  assert.ok(peak.arcCrackleGain > 0.25);
});

test('POL-71 & POL-01/64: FIDELITY_LOADER_LABELS has zero goblin/animal strings and menu vista pairs Stage-0/1 glitch window with Stage-4 gate', () => {
  for (const label of FIDELITY_LOADER_LABELS) {
    assert.ok(!/goblin|animal/i.test(label), `Unexpected legacy loader string: ${label}`);
  }
  const menu = computeMenuHeroVistaState(1.1);
  assert.equal(menu.portalHeroStage, 4);
  assert.ok(menu.windowWastelandStage === 0 || menu.windowWastelandStage === 1);
  assert.equal(menu.glassBladeBlurPx, 14);
});
