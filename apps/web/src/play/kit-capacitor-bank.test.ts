import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten, instanceBuckets, mergeBuckets, presetBounds, validate } from '@hm/kitspec';
import { CAPACITOR_BANK_KIT } from './kit-capacitor-bank';

test('the capacitor bank kit stands on the floor with nothing floating', () => {
  assert.deepEqual(validate(CAPACITOR_BANK_KIT, 'capacitor-bank'), []);
});

test('six cans, one generated part placed six times', () => {
  const placed = flatten(CAPACITOR_BANK_KIT, 'capacitor-bank');
  assert.equal(placed.filter((p) => p.part === 'capacitor-can').length, 6);
  assert.equal(instanceBuckets(placed).get('capacitor-can')?.length, 6);
});

test('the bank fits the power wall slot (2.0 x 1.16 m) and stays under the breaker cabinet (1.9 m)', () => {
  const b = presetBounds(CAPACITOR_BANK_KIT, flatten(CAPACITOR_BANK_KIT, 'capacitor-bank'))!;
  assert.ok(b.max[0] - b.min[0] <= 2.0 + 1e-9 && b.max[2] - b.min[2] <= 1.16 + 1e-9, `footprint ${(b.max[0] - b.min[0]).toFixed(2)} x ${(b.max[2] - b.min[2]).toFixed(2)}`);
  assert.ok(b.max[1] < 1.9, `height ${b.max[1].toFixed(2)}`);
});

test('the kit batches into a few meshes: one per material and rank', () => {
  const keys = [...mergeBuckets(flatten(CAPACITOR_BANK_KIT, 'capacitor-bank')).keys()];
  assert.deepEqual(keys.sort(), ['copper|1', 'darkSteel|0', 'darkSteel|1', 'gen|0', 'gunmetal|1', 'gunmetal|2', 'hazard|1']);
});
