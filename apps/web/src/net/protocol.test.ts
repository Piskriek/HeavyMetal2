// ============================================================================
// File: apps/web/src/net/protocol.test.ts
// Unit tests for protocol.ts (Plan 36 Phase 1 & Phase 2).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, createWorld, withBridgeStore, type BaseCommand, type WorldEnv } from '../base/world';
import {
  canRun,
  computeWorldHash,
  fromWireEvent,
  hasNoPayloadTypeField,
  PROTOCOL_VERSION,
  ROLE_LABELS,
  ROLE_TABLE,
  roleName,
  toWireEvent,
  verifyVersionAndHash,
  type OutpostMessage,
} from './protocol';

const TEST_ENV: WorldEnv = {
  heightAt: () => 0,
  bridge: { x: 0, z: 0, range: 60 },
};

test('ROLE_TABLE and ROLE_LABELS use Lead Architect, Co-Builder, and Field Observer display names', () => {
  assert.equal(ROLE_TABLE.owner.name, 'Lead Architect');
  assert.equal(ROLE_TABLE.cobuilder.name, 'Co-Builder');
  assert.equal(ROLE_TABLE.visitor.name, 'Field Observer');
  assert.equal(ROLE_LABELS.owner, 'Lead Architect');
  assert.equal(ROLE_LABELS.cobuilder, 'Co-Builder');
  assert.equal(ROLE_LABELS.visitor, 'Field Observer');
  assert.equal(roleName('owner'), 'Lead Architect');
  assert.equal(roleName('cobuilder'), 'Co-Builder');
  assert.equal(roleName('visitor'), 'Field Observer');
});

test('OutpostMessage union never uses "type" as a nested payload field and round-trips WireBaseEvent (including switched)', () => {
  const w0 = withBridgeStore(createWorld(1), TEST_ENV);
  const shelterCmd: BaseCommand = { t: 'shelter', cx: 8, cz: 8, yaw: 0 };
  const applied = apply(w0, TEST_ENV, shelterCmd);
  const wireEvents = applied.events.map(toWireEvent);

  const clientCmdMsg: OutpostMessage = {
    type: 'cmd',
    proto: PROTOCOL_VERSION,
    seq: 1,
    baseVersion: 0,
    cmd: shelterCmd,
  };
  const serverEventsMsg: OutpostMessage = {
    type: 'events',
    proto: PROTOCOL_VERSION,
    version: 1,
    worldHash: computeWorldHash(applied.world),
    actorId: 'host-1',
    seq: 1,
    cmd: shelterCmd,
    events: wireEvents,
  };
  const serverRefusedMsg: OutpostMessage = {
    type: 'refused',
    proto: PROTOCOL_VERSION,
    seq: 2,
    cmdKind: 'place',
    why: 'visitor-read-only',
    version: 1,
    worldHash: computeWorldHash(applied.world),
  };
  const beamIntentMsg: OutpostMessage = {
    type: 'beamIntent',
    at: { x: 4, z: 6 },
    beam: { node: 1, power: 1 },
    power: { 10: 0.8 },
  };
  const kickMsg: OutpostMessage = {
    type: 'kickPlayer',
    targetId: 'cb-1',
    reason: 'Session ended',
  };
  const undoMsg: OutpostMessage = {
    type: 'undoAuthor',
    targetId: 'cb-1',
  };

  assert.equal(hasNoPayloadTypeField(clientCmdMsg), true);
  assert.equal(hasNoPayloadTypeField(serverEventsMsg), true);
  assert.equal(hasNoPayloadTypeField(serverRefusedMsg), true);
  assert.equal(hasNoPayloadTypeField(beamIntentMsg), true);
  assert.equal(hasNoPayloadTypeField(kickMsg), true);
  assert.equal(hasNoPayloadTypeField(undoMsg), true);
  assert.deepEqual(wireEvents.map(fromWireEvent), applied.events);

  const switchedEvent = { type: 'switched' as const, machine: 7, on: false };
  assert.deepEqual(fromWireEvent(toWireEvent(switchedEvent)), switchedEvent);
});

test('verifyVersionAndHash detects version and world-hash mismatches', () => {
  const w0 = withBridgeStore(createWorld(7), TEST_ENV);
  const h0 = computeWorldHash(w0);
  const w1 = apply(w0, TEST_ENV, { t: 'shelter', cx: 8, cz: 8, yaw: 0 }).world;
  const h1 = computeWorldHash(w1);

  assert.notEqual(h0, h1);

  const ok = verifyVersionAndHash(1, w1, 1, h1);
  assert.equal(ok.synced, true);
  assert.equal(ok.needsResync, false);
  assert.equal(ok.reason, 'ok');

  const badVer = verifyVersionAndHash(0, w1, 1, h1);
  assert.equal(badVer.synced, false);
  assert.equal(badVer.needsResync, true);
  assert.equal(badVer.reason, 'version-mismatch');

  const badHash = verifyVersionAndHash(1, w0, 1, h1);
  assert.equal(badHash.synced, false);
  assert.equal(badHash.needsResync, true);
  assert.equal(badHash.reason, 'hash-mismatch');
});

test('canRun enforces Lead Architect, Co-Builder, and Field Observer guardrails', () => {
  let w = withBridgeStore(createWorld(1), TEST_ENV);
  const shelterRes = apply(w, TEST_ENV, { t: 'shelter', cx: 8, cz: 8, yaw: 0 });
  w = shelterRes.world;
  const ownerPieceId = w.base.pieces[0]!.id;

  // Field Observer (visitor) cannot build or remove anything
  assert.equal(canRun('visitor', { t: 'shelter', cx: 16, cz: 16, yaw: 0 }, w, 'vis-1').ok, false);
  assert.equal(canRun('visitor', { t: 'remove', at: { x: 8, z: 8 }, id: ownerPieceId }, w, 'vis-1').ok, false);

  // Co-Builder can build, draft, craft, and move, but cannot remove Lead Architect's pieces
  assert.equal(canRun('cobuilder', { t: 'draft', at: { x: 8, z: 8 }, primitive: 'prim-slab', map: 'map-regolith' }, w, 'cb-1').ok, true);
  const removeOwnerPiece = canRun('cobuilder', { t: 'remove', at: { x: 8, z: 8 }, id: ownerPieceId }, w, 'cb-1');
  assert.equal(removeOwnerPiece.ok, false);
  if (!removeOwnerPiece.ok) {
    assert.equal(removeOwnerPiece.why, 'owner-piece-protected');
  }

  // Co-Builder CAN remove a piece that they placed during the session
  const placedBy = { [ownerPieceId]: 'cb-1' };
  assert.equal(canRun('cobuilder', { t: 'remove', at: { x: 8, z: 8 }, id: ownerPieceId }, w, 'cb-1', placedBy).ok, true);

  // Lead Architect (owner) can remove any piece and run stage overrides
  assert.equal(canRun('owner', { t: 'remove', at: { x: 8, z: 8 }, id: ownerPieceId }, w, 'host-1').ok, true);
  assert.equal(canRun('owner', { t: 'stage', stage: 3 }, w, 'host-1').ok, true);
  assert.equal(canRun('cobuilder', { t: 'stage', stage: 3 }, w, 'cb-1').ok, false);
});
