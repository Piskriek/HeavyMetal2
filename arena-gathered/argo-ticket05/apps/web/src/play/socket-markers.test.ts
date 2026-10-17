// ============================================================================
// File: apps/web/src/play/socket-markers.test.ts
// Unit tests for socketMarkerGeometry, socketMarkerMaterial, and pulse helpers.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOCKET_REST_OPACITY,
  socketMarkerGeometry,
  socketMarkerInstanceColor,
  socketMarkerMaterial,
  socketMarkerOpacity,
} from './socket-markers';

test('socketMarkerGeometry builds flat square-section corner brackets in XZ plane', () => {
  const geom = socketMarkerGeometry();
  const pos = geom.getAttribute('position');
  const norm = geom.getAttribute('normal');
  assert.ok(pos && pos.count > 0, 'Has position attribute');
  assert.ok(norm && norm.count === pos.count, 'Has matching normal attribute');
  assert.ok(geom.index && geom.index.count === 8 * 12 * 3, '8 rectangular bars = 96 triangles');

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  // Flat on XZ plane
  assert.ok(Math.abs(minY) < 1e-6, `minY=${minY} should be 0`);
  assert.ok(maxY > 0.01 && maxY <= 0.06, `maxY=${maxY} should be thin flat bar height`);
  // Symmetric square footprint
  assert.ok(Math.abs(minX + 0.56) < 1e-5 && Math.abs(maxX - 0.56) < 1e-5);
  assert.ok(Math.abs(minZ + 0.56) < 1e-5 && Math.abs(maxZ - 0.56) < 1e-5);
});

test('socketMarkerMaterial has low alpha and pulses only on the active slot', () => {
  const mat = socketMarkerMaterial();
  assert.equal(mat.transparent, true);
  assert.equal(mat.depthWrite, false);
  assert.ok(mat.opacity <= 0.35, `Expected low rest opacity, got ${mat.opacity}`);

  // Inactive slot stays constant at SOCKET_REST_OPACITY
  assert.equal(socketMarkerOpacity(false, 0), SOCKET_REST_OPACITY);
  assert.equal(socketMarkerOpacity(false, 1.23), SOCKET_REST_OPACITY);

  // Active slot pulses higher than rest opacity
  const p0 = socketMarkerOpacity(true, 0);
  const p1 = socketMarkerOpacity(true, 0.3);
  assert.ok(p0 > SOCKET_REST_OPACITY && p1 > SOCKET_REST_OPACITY);
  assert.notEqual(p0, p1);

  const cIdle = socketMarkerInstanceColor(false, 0.5);
  const cActive = socketMarkerInstanceColor(true, 0.5);
  assert.ok(cActive.b > cIdle.b, 'Active slot instance colour is brighter than idle slot');
});
