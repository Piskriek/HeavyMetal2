import test from 'node:test'; import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMaterials, foundation, wall, pillar, floor, ramp, airlock, triangles, type Piece } from '../src/index';
const m = createMaterials();
const box = (p: Piece) => new THREE.Box3().setFromObject(p.group);
const near = (a: number, b: number, e = 0.03) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);
test('pieces fit the lattice, stay in budget, and nothing floats', () => {
  for (const stage of [1, 6]) {
    const all = { foundation: foundation(m, { stage, skirt: 2 }), wall: wall(m, { stage }), pillar: pillar(m, { stage }), floor: floor(m, { stage }), ramp: ramp(m, { stage }), airlock: airlock(m, { stage }) };
    for (const [k, p] of Object.entries(all)) { const t = triangles(p); assert.ok(t > 0 && t <= (stage === 1 ? 400 : 4000), `${k} s${stage}: ${t}`); assert.ok(p.group.children.length <= 6, k); }
    const f = box(all.foundation); near(f.min.x, 0); near(f.max.x, 4); near(f.min.z, 0); near(f.max.z, 4); near(f.max.y, 0, 0.06); near(f.min.y, -2.5, 0.06);
    const w = box(all.wall); near(w.min.x, 0); near(w.max.x, 4); near(w.min.y, 0); near(w.max.y, 3, 0.1); assert.ok(w.max.z - w.min.z <= 0.45);
    const pl = box(all.pillar); near(pl.min.y, 0); near(pl.max.y, 3, 0.1); assert.ok(pl.max.x - pl.min.x <= 0.9);
    const fl = box(all.floor); near(fl.max.y, 0, 0.06); near(fl.max.x, 4); near(fl.max.z, 4);
    const r = box(all.ramp); near(r.min.y, 0, 0.1); near(r.max.z, 4, 0.1); assert.ok(r.max.y >= 2.9 && r.max.y <= 4.2);
    const a = box(all.airlock); near(a.max.x, 4); near(a.max.y, 3, 0.1);
    for (const c of all.airlock.colliders) assert.ok(!(c.min[0] < 2 && c.max[0] > 2 && c.min[1] < 1.2 && c.max[1] > 1.2 && c.min[2] < 0 && c.max[2] > 0), 'doorway clear');
    assert.ok(all.wall.colliders.length > 0 && all.foundation.colliders.length > 0);
  }
  const t0 = performance.now(); airlock(m, { stage: 6 }); assert.ok(performance.now() - t0 < 200);
});
