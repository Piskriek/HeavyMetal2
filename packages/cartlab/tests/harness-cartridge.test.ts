/**
 * Plan 47 Pillar 3 verification: harness cartridge codec round-trips, CRC tamper gate,
 * browser-safe base64url (checked against Node's reference codec), and the canonical
 * projections onto @hm/harness IVesselPreset / IHarnessTuning.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ESCORT_ROVER_TUNING, createEscortRoverPreset } from '@hm/harness';
import {
  HARNESS_SHELF_PRESETS,
  crc32Hex,
  decodeHarnessCartridgeCode,
  encodeHarnessCartridgeCode,
  toHarnessTuning,
  toVesselPreset,
  type IHarnessCartridgeSpec,
} from '../src/harness-cartridge';

const ESCORT = HARNESS_SHELF_PRESETS['harness:escort-steadfast']!;

test('shelf presets encode to their bare id and decode back to the identical spec', () => {
  assert.equal(Object.keys(HARNESS_SHELF_PRESETS).length, 8, 'exactly the 8 canonical shelf presets');
  for (const [id, spec] of Object.entries(HARNESS_SHELF_PRESETS)) {
    assert.equal(encodeHarnessCartridgeCode(spec), id);
    assert.deepEqual(decodeHarnessCartridgeCode(id), spec);
  }
  assert.equal(decodeHarnessCartridgeCode('harness:does-not-exist'), null);
});

test('custom slider tweak round-trips through harnessc: with exact parameters', () => {
  const custom: IHarnessCartridgeSpec = { ...ESCORT, id: 'harness:custom-1', annealRateAlpha: 24.5, syntropicDampingNspm: 5.8 };
  const code = encodeHarnessCartridgeCode(custom);
  assert.ok(code.startsWith('harnessc:'), code.slice(0, 24));
  const decoded = decodeHarnessCartridgeCode(code);
  assert.deepEqual(decoded, custom);

  // The pure base64url payload must match Node's reference codec byte for byte.
  const parts = code.split(':');
  assert.equal(parts[2]!, Buffer.from(JSON.stringify(custom), 'utf8').toString('base64url'));
});

test('tampered payloads and malformed codes are deterministically rejected', () => {
  const custom: IHarnessCartridgeSpec = { ...ESCORT, id: 'harness:custom-2', baselinePrecisionPi0: 2.5 };
  const code = encodeHarnessCartridgeCode(custom);
  const parts = code.split(':');
  assert.equal(decodeHarnessCartridgeCode(`harnessc:000000:${parts[2]!}`), null, 'wrong CRC refused');
  assert.equal(decodeHarnessCartridgeCode(`harnessc:${parts[1]!}:${parts[2]!.slice(1)}`), null, 'mutated payload refused');
  assert.equal(decodeHarnessCartridgeCode('harnessc:zz'), null);
  assert.equal(decodeHarnessCartridgeCode('matc:123456:abcd'), null);
  const awarenessOutOfRange = { ...custom, relativeAwarenessCeiling: 1.4 };
  assert.equal(decodeHarnessCartridgeCode(encodeHarnessCartridgeCode(awarenessOutOfRange)), null);
});

test('crc32Hex matches the IEEE 802.3 reference vector', () => {
  assert.equal(crc32Hex('123456789'), 'CBF43926');
});

test('toVesselPreset / toHarnessTuning project the sliders onto the canonical pair', () => {
  const vessel = toVesselPreset(ESCORT);
  const base = createEscortRoverPreset();
  assert.equal(vessel.id, 'vessel:rover-escort');
  assert.equal(vessel.tier, 2);
  assert.equal(vessel.relativeAwarenessCeiling, 0.65);
  assert.equal(vessel.evaluator.masteryWindowSec, 1.0);
  assert.equal(vessel.evaluator.targetCoherenceThreshold, base.evaluator.targetCoherenceThreshold);
  assert.equal(vessel.substrate.massKg, base.substrate.massKg);
  assert.equal(vessel.dynamics.stiffnessMatrix[0]!, base.dynamics.stiffnessMatrix[0]!);

  const tuning = toHarnessTuning({ ...ESCORT, baselinePrecisionPi0: 2.0, annealRateAlpha: 24.5, syntropicDampingNspm: 5.8 });
  assert.equal(tuning.piBase, 2.0);
  assert.equal(tuning.annealAlpha, 24.5);
  assert.equal(tuning.syntropicImpedanceNspm, 5.8);
  assert.equal(tuning.flowBeta, ESCORT_ROVER_TUNING.flowBeta, 'untouched knobs inherit the verified tuning');
});
