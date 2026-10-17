// ============================================================================
// File: apps/web/src/play/armory-rack.test.ts
// Unit tests for armoryRack and shouldShowAmmoBadge (TICKET-07 Item D — MC-02).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { armoryRack, shouldShowAmmoBadge } from './armory-rack';

test('armoryRack builds rail with sidearm pickup and hides sidearm once taken', () => {
  const mat = new THREE.MeshStandardMaterial();
  const mockMats = {
    gunmetal: mat,
    darkSteel: mat,
    paint: mat,
    copper: mat,
  } as any;

  const rack = armoryRack(mockMats);
  assert.ok(rack.group.getObjectByName('armory-sidearm'));
  assert.equal(rack.colliders.length, 1);
  assert.ok(rack.pickupAt.x > 7 && rack.pickupAt.y > 1);
  assert.equal(rack.isTaken(), false);
  assert.equal(rack.sidearm.visible, true);

  rack.setTaken(true);
  assert.equal(rack.isTaken(), true);
  assert.equal(rack.sidearm.visible, false);
});

test('shouldShowAmmoBadge hides ammo badge when no sidearm is equipped', () => {
  assert.equal(shouldShowAmmoBadge(null, true), false);
  assert.equal(shouldShowAmmoBadge({ item: null }, true), false);
  assert.equal(shouldShowAmmoBadge({ item: { id: 'wpn-shotgun' } }, false), false);
  assert.equal(shouldShowAmmoBadge({ item: { id: 'wpn-shotgun' } }, true), true);
  assert.equal(shouldShowAmmoBadge('wpn-shotgun', true), true);
});
