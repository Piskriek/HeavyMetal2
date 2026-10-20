// ============================================================================
// File: packages/coopnet/tests/sculpt-and-pad-sync.test.ts
// TICKET-19 (Window F) unit tests covering POL-111, POL-112, POL-171, POL-172, POL-173
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOULDER_SPAN,
  PAINT_CELL,
  PAINT_CELLS,
  PAINT_ORIGIN,
  GATE_PAD_LIFT,
  isPointOnGatePad,
  evaluatePlotOrPadHeight,
  buildInitialHostSeedFrames,
  buildOutboundPresencePacket,
  filterActivePlotPeers,
  canRoleSculptTerrain,
  validateTerrainUpdate,
} from '../src/sculpt-and-pad-sync';

test('POL-111: shared terrain constants are consistent across plot-height and plot-ground', () => {
  assert.equal(BOULDER_SPAN, 320);
  assert.equal(PAINT_CELLS, 256);
  assert.equal(PAINT_CELL, 1.25);
  assert.equal(PAINT_ORIGIN, -160);
});

test('POL-112: isPointOnGatePad and evaluatePlotOrPadHeight respect rotated Gate footing pad', () => {
  const gate = { x: 12, z: -8, yaw: Math.PI / 2 };
  // Gate centre is inside pad
  assert.equal(isPointOnGatePad(12, -8, gate), true);
  const raw = (x: number, z: number) => (x === 12 && z === -8 ? 4.0 : 2.5);
  assert.equal(evaluatePlotOrPadHeight(12, -8, raw, gate), 4.0 + GATE_PAD_LIFT);
  // Outside pad returns raw ground height
  assert.equal(isPointOnGatePad(20, -8, gate), false);
  assert.equal(evaluatePlotOrPadHeight(20, -8, raw, gate), 2.5);
});

test('POL-171: buildInitialHostSeedFrames includes Gate pose in both seedWorld and initial terrain frame', () => {
  const dummyWorld = { v: 4, base: { pieces: [] } };
  const frames = buildInitialHostSeedFrames(dummyWorld, { x: 6.5, z: -14.2, yaw: 0.75 }, 7, '');
  assert.equal(frames.seedMessage.type, 'seedWorld');
  assert.deepEqual(frames.seedMessage.gate, { x: 6.5, z: -14.2, yaw: 0.75 });
  assert.equal(frames.terrainMessage.type, 'terrain');
  assert.deepEqual(frames.terrainMessage.gate, { x: 6.5, z: -14.2, yaw: 0.75 });
});

test('POL-172: entering the Lab produces an inLab/leftPlot packet and filters out stale plot avatars', () => {
  const labPkt = buildOutboundPresencePacket('lab', null, 'hazmat');
  assert.equal(labPkt.inLab, true);
  assert.equal(labPkt.leftPlot, true);

  const planetPkt = buildOutboundPresencePacket('planet', { x: 4, y: 1.2, z: -3, yaw: 0.5 }, 'hazmat');
  assert.equal(planetPkt.inLab, false);
  assert.equal(planetPkt.leftPlot, false);

  const visible = filterActivePlotPeers([
    { id: 'p1', username: 'Host', role: 'owner', x: 1, y: 0, z: 2, yaw: 0 },
    { id: 'p2', username: 'GuestInLab', role: 'cobuilder', x: 5, y: 0, z: 5, yaw: 0, inLab: true },
    { id: 'p3', username: 'GuestLeft', role: 'visitor', x: 2, y: 0, z: 2, yaw: 0, leftPlot: true },
  ]);
  assert.equal(visible.length, 1);
  assert.equal(visible[0]!.id, 'p1');
});

test('POL-173: Co-Builders and Lead Architects may sculpt terrain; Visitors are refused', () => {
  assert.equal(canRoleSculptTerrain('owner'), true);
  assert.equal(canRoleSculptTerrain('cobuilder'), true);
  assert.equal(canRoleSculptTerrain('visitor'), false);

  const okCobuilder = validateTerrainUpdate('cobuilder', {
    seed: 7,
    sculpt: 'SCULPT_DATA_V1',
    gate: { x: 0, z: 0, yaw: 0 },
  });
  assert.equal(okCobuilder.ok, true);

  const refusedVisitor = validateTerrainUpdate('visitor', {
    seed: 7,
    sculpt: 'SCULPT_DATA_V1',
  });
  assert.equal(refusedVisitor.ok, false);
  if (!refusedVisitor.ok) {
    assert.equal(refusedVisitor.reason, 'forbidden-role');
  }
});
