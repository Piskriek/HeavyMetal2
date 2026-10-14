import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_11_NEIGHBOR_ENCLAVES,
  computeContinentalConsensusSummary,
} from './planet-table-hologram';

test('tracks all 11 neighboring enclaves on the 4.2 km horizon', () => {
  assert.equal(CANONICAL_11_NEIGHBOR_ENCLAVES.length, 11);
  assert.ok(computeContinentalConsensusSummary({ Pxd: 0.95, Vtx: 0.95, Lx: 0.95, Aq: 0.95 }).continentalConsensusPct >= 85.0);
});
