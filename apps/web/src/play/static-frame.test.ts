// TICKET-01 B: a solid in its own rotated frame (the moon's twin gate, a field machine) pushes the walker on its own faces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { packBoxBounds, pushCircleInFrame } from './static-colliders';

// a gate turned 70 degrees about Y and set at (5, 0.25, -2): column-major, as THREE.Matrix4.elements
const th = 1.2343597;
const c = Math.cos(th), s = Math.sin(th);
const M = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 5, 0.25, -2, 1];
const world = (lx: number, lz: number) => ({ x: c * lx + s * lz + 5, z: -s * lx + c * lz - 2 });
const local = (x: number, z: number) => {
  const dx = x - 5, dz = z - -2;
  return { x: c * dx - s * dz, z: s * dx + c * dz };
};
// the two uprights of a 1.7 m doorway (inner faces at x = +-0.85), 2.68 m across and 1.1 m deep, 3.1 m tall
const uprights = [packBoxBounds(0.85, 0, -0.55, 1.34, 3.1, 0.55), packBoxBounds(-1.34, 0, -0.55, -0.85, 3.1, 0.55)];

test('a walker meets a rotated upright at its own face (local z = -0.85 for radius 0.3), not at a world box', () => {
  const out = pushCircleInFrame(world(1.0, -1.0), world(1.0, -0.8), 0.25, 0.3, uprights, M);
  const l = local(out.x, out.z);
  assert.ok(Math.abs(l.x - 1.0) < 1e-6, `local x ${l.x}`);
  assert.ok(Math.abs(l.z + 0.85) < 1e-6, `local z ${l.z}`);
});

test('the doorway between the rotated uprights stays passable', () => {
  const out = pushCircleInFrame(world(0.0, -1.0), world(0.0, 0.5), 0.25, 0.3, uprights, M);
  const l = local(out.x, out.z);
  assert.ok(Math.abs(l.x) < 1e-6, `local x ${l.x}`);
  assert.ok(Math.abs(l.z - 0.5) < 1e-6, `local z ${l.z}`);
});

test('a frame far below the walker (no vertical overlap) does not push', () => {
  const out = pushCircleInFrame(world(1.0, -1.0), world(1.0, -0.8), 9.0, 0.3, uprights, M);
  const l = local(out.x, out.z);
  assert.ok(Math.abs(l.z + 0.8) < 1e-6, `local z ${l.z}`);
});
