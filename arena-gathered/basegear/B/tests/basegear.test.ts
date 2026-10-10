// tests/basegear.test.ts
import test from 'node:test'; import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMaterials, hardpoint, heavyMill, bin, repeater, draftingTable, setLamp, triangles, type Gear } from '../src/index';
const m = createMaterials(), bb = (g: Gear) => new THREE.Box3().setFromObject(g.group);
const has = (g: Gear, ...names: string[]) => names.forEach((n) => assert.ok(g.sockets.some((s) => s.name === n), n));
test('gear fits its cells, stands on the slab, has its sockets and lamps', () => {
  for (const stage of [1, 6]) {
    const all = { hardpoint: hardpoint(m, { stage }), heavyMill: heavyMill(m, { stage }), bin: bin(m, { stage }), repeater: repeater(m, { stage }), draftingTable: draftingTable(m, { stage }) };
    for (const [k, g] of Object.entries(all)) {
      const t = triangles(g), cap = stage === 1 ? 900 : k === 'heavyMill' ? 10000 : 8000;
      assert.ok(t > 0 && t <= cap, `${k} s${stage}: ${t}`); assert.ok(g.group.children.length <= 8, k);
      assert.ok(bb(g).min.y >= -0.02, `${k} sinks`); assert.ok(g.colliders.length > 0, k);
    }
    const h = bb(all.hardpoint); assert.ok(h.min.x >= -0.01 && h.max.x <= 8.01 && h.min.z >= -0.01 && h.max.z <= 8.01 && h.max.y <= 1.2);
    const mill = bb(all.heavyMill); assert.ok(mill.max.y >= 3.6 && mill.max.y <= 5.5 && mill.max.x - mill.min.x <= 6);
    for (const k of ['bin', 'repeater', 'draftingTable'] as const) { const b = bb(all[k]); assert.ok(b.min.x >= -0.01 && b.max.x <= 4.01 && b.min.z >= -0.01 && b.max.z <= 4.01, k); }
    assert.ok(bb(all.repeater).max.y >= 6 && bb(all.draftingTable).max.y <= 1.6);
    has(all.hardpoint, 'mount', 'power'); has(all.heavyMill, 'vent', 'hopper', 'power'); has(all.bin, 'link'); has(all.repeater, 'top', 'box'); has(all.draftingTable, 'screen');
    for (const g of [all.heavyMill, all.bin, all.repeater, all.draftingTable]) { assert.ok(g.lamps.length > 0); setLamp(g.lamps[0]!, 1); }
  }
});

test('stage six adds geometry while retaining valid metadata', () => {
  const makers = [hardpoint, heavyMill, bin, repeater, draftingTable];

  for (const make of makers) {
    const low = make(m, { stage: 1 });
    const high = make(m, { stage: 6 });

    assert.ok(triangles(high) > triangles(low), high.group.name);

    for (const socket of high.sockets) {
      assert.ok(socket.at.every(Number.isFinite), socket.name);
    }

    for (const collider of high.colliders) {
      assert.ok(collider.min.every(Number.isFinite));
      assert.ok(collider.max.every(Number.isFinite));

      for (let axis = 0; axis < 3; axis += 1) {
        assert.ok(collider.min[axis]! <= collider.max[axis]!);
      }
    }
  }
});
