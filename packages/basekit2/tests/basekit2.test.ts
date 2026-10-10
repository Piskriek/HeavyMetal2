import test from 'node:test'; import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMaterials, halfWall, windowWall, doorframe, door, railing, ladder, stairs, lifeSupport, setLamp, triangles, type Piece } from '../src/index';
const m = createMaterials(), box = (p: Piece) => new THREE.Box3().setFromObject(p.group);
const near = (a: number, b: number, e = 0.1) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);
const clear = (p: Piece) => p.colliders.every((c) => !(c.min[0] < 2 && c.max[0] > 2 && c.min[1] < 1.2 && c.max[1] > 1.2 && c.min[2] < 0.01 && c.max[2] > -0.01));
test('openings, circulation and life support fit the lattice', () => {
  for (const stage of [1, 6]) {
    const o = { stage }, all = { halfWall: halfWall(m, o), windowWall: windowWall(m, o), doorframe: doorframe(m, o), door: door(m, o), railing: railing(m, o), ladder: ladder(m, o), stairs: stairs(m, o), lifeSupport: lifeSupport(m, o) };
    for (const [k, p] of Object.entries(all)) {
      const t = triangles(p); assert.ok(t > 0 && t <= (stage === 1 ? 400 : k === 'lifeSupport' ? 5000 : 4000), `${k} s${stage}: ${t}`);
      assert.ok(p.group.children.length <= 6 && p.colliders.length > 0, k); const b = box(p);
      assert.ok(b.min.y >= -0.02 && b.min.x >= -0.3 && b.max.x <= 4.3 && b.min.z >= -0.3 && b.max.z <= 4.3, k);
    }
    for (const k of ['halfWall', 'windowWall', 'doorframe', 'door', 'railing'] as const) { const b = box(all[k]); near(b.min.x, 0); near(b.max.x, 4); assert.ok(b.max.z - b.min.z <= 0.45, k); }
    near(box(all.halfWall).max.y, 1.5); near(box(all.windowWall).max.y, 3); near(box(all.doorframe).max.y, 3); near(box(all.railing).max.y, 1.1);
    assert.ok(clear(all.doorframe) && clear(all.door), 'doorway clear');
    const leaf = all.door.parts?.['leaf']; assert.ok(leaf); near(leaf.position.x, 1.3, 0.05);
    const l = box(all.ladder); near(l.max.y, 3.9); assert.ok(l.max.x - l.min.x <= 0.8 && l.min.z >= -0.05 && l.max.z <= 0.3);
    const s = box(all.stairs); near(s.max.z, 4); assert.ok(s.max.y >= 2.9 && s.max.y <= 4.2);
    assert.ok(box(all.lifeSupport).max.y >= 1.8 && box(all.lifeSupport).max.y <= 2.3 && all.lifeSupport.lamps.length > 0); setLamp(all.lifeSupport.lamps[0]!, 1);
  }
});
