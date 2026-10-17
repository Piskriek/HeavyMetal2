// ============================================================================
// File: apps/web/src/play/machine-props.test.ts
// TICKET-03 (BB-09): every machine prop stands its machineSize height, on its base
// (the ground, or the 0.78 m ring for the heavies), and its sockets stay on the prop.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as lab from '@hm/labkit';
import { HEAVY_KINDS, MACHINE_KINDS, type MachineKind } from '@hm/plotsim';
import { machineProp, RING_TOP_Y } from './machine-props';
import { machineSize } from '../base/machine-inspect';

const ALL_KINDS: readonly MachineKind[] = [...MACHINE_KINDS, ...HEAVY_KINDS];

test('every machine prop stands its machineSize height, on its base', () => {
  const m = lab.createMaterials();
  for (const stage of [1, 6]) {
    for (const kind of ALL_KINDS) {
      const p = machineProp(m, kind, stage);
      p.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(p.group);
      const h = box.max.y - box.min.y;
      const want = machineSize(kind).h;
      assert.ok(Math.abs(h - want) < 0.01, `${kind} at stage ${stage}: height ${h.toFixed(3)} m, want ${want} m`);
      const base = HEAVY_KINDS.includes(kind as (typeof HEAVY_KINDS)[number]) ? RING_TOP_Y : 0;
      assert.ok(Math.abs(box.min.y - base) < 0.01, `${kind} at stage ${stage}: base ${box.min.y.toFixed(3)} m, want ${base} m`);
    }
  }
});

test('sockets (power, vent, top) stay on the scaled prop, within its box', () => {
  const m = lab.createMaterials();
  for (const kind of ALL_KINDS) {
    const p = machineProp(m, kind, 6);
    p.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(p.group).expandByScalar(0.5);
    const points = [p.power, p.vent, p.top].filter((v): v is THREE.Vector3 => v !== null);
    for (const v of points) {
      assert.ok(box.containsPoint(v), `${kind}: socket (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}) is off the prop`);
    }
  }
});

test('a machine prop stands its height in the group that the scene moves (position and yaw kept)', () => {
  const m = lab.createMaterials();
  const p = machineProp(m, 'drill', 6);
  p.group.position.set(10, 2, -4);
  p.group.rotation.y = 1.2;
  p.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(p.group);
  assert.ok(Math.abs(box.min.y - 2) < 0.01, `base moves with the group: ${box.min.y}`);
  assert.ok(Math.abs(box.max.y - 2 - machineSize('drill').h) < 0.01, `top is h above the base: ${box.max.y}`);
});
