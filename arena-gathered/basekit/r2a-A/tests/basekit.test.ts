import test from 'node:test'; import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMaterials, foundation, wall, pillar, floor, ramp, airlock, pitchedRoof, lowRoof, roofOuterCorner, roofInnerCorner, ridgeCap, gable, triangles, type Piece } from '../src/index';
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

test('materials, lamps, colliders, and default skirt', () => {
  assert.equal(m.gunmetal.type, 'MeshStandardMaterial');
  assert.equal(m.glass.type, 'MeshPhysicalMaterial');
  assert.ok(!('transmission' in m.glass && m.glass.transmission > 0));
  const a = airlock(m, { stage: 6 });
  assert.ok(a.lamps.length > 0);
  for (const lamp of a.lamps) assert.ok(lamp instanceof THREE.Mesh);
  const f1 = foundation(m, { stage: 1 });
  const bf = box(f1);
  near(bf.min.y, -1.5, 0.08);
  for (const p of [f1, wall(m, { stage: 1 }), pillar(m, { stage: 6 }), floor(m, { stage: 6 }), ramp(m, { stage: 1 }), a]) {
    assert.ok(p.colliders.length > 0);
    for (const c of p.colliders) {
      assert.ok(c.min[0] <= c.max[0] && c.min[1] <= c.max[1] && c.min[2] <= c.max[2]);
    }
    p.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const pos = obj.geometry.getAttribute('position');
        assert.ok(pos !== undefined && pos.count > 0);
      }
    });
  }
  const low = triangles(wall(m, { stage: 0 }));
  const hi = triangles(wall(m, { stage: 6 }));
  assert.ok(low <= 400 && hi > low);
});

test('floor stays in the 4 m cell and foundation does not overlap neighbours', () => {
  for (const stage of [1, 6]) {
    const fl = box(floor(m, { stage }));
    assert.ok(fl.min.x >= -0.03, `floor s${stage} min.x ${fl.min.x}`);
    assert.ok(fl.max.x <= 4.03, `floor s${stage} max.x ${fl.max.x}`);
    assert.ok(fl.min.z >= -0.03, `floor s${stage} min.z ${fl.min.z}`);
    assert.ok(fl.max.z <= 4.03, `floor s${stage} max.z ${fl.max.z}`);
    const f = box(foundation(m, { stage, skirt: 2 }));
    assert.ok(f.min.x >= -0.03 && f.max.x <= 4.03, `foundation s${stage} x ${f.min.x}..${f.max.x}`);
    assert.ok(f.min.z >= -0.03 && f.max.z <= 4.03, `foundation s${stage} z ${f.min.z}..${f.max.z}`);
  }
  const w1 = triangles(wall(m, { stage: 1 }));
  const w6 = triangles(wall(m, { stage: 6 }));
  const f1 = triangles(floor(m, { stage: 1 }));
  const f6 = triangles(floor(m, { stage: 6 }));
  const r1 = triangles(ramp(m, { stage: 1 }));
  const r6 = triangles(ramp(m, { stage: 6 }));
  assert.ok(w6 > w1, `wall detail ${w1} vs ${w6}`);
  assert.ok(f6 > f1, `floor detail ${f1} vs ${f6}`);
  assert.ok(r6 > r1, `ramp detail ${r1} vs ${r6}`);
});

test('roof set fits the cell, meets its eaves and peaks, stays in budget', () => {
  for (const stage of [1, 6]) {
    const r = { pitchedRoof: pitchedRoof(m, { stage }), lowRoof: lowRoof(m, { stage }), roofOuterCorner: roofOuterCorner(m, { stage }), roofInnerCorner: roofInnerCorner(m, { stage }), ridgeCap: ridgeCap(m, { stage }), gable: gable(m, { stage }) };
    for (const [k, p] of Object.entries(r)) { const t = triangles(p); assert.ok(t > 0 && t <= (stage === 1 ? 400 : 4000), `${k} s${stage}: ${t}`); assert.ok(p.group.children.length <= 6, k); assert.ok(p.colliders.length > 0, k); }
    for (const k of ['pitchedRoof', 'lowRoof', 'roofOuterCorner', 'roofInnerCorner'] as const) { const b = box(r[k]); assert.ok(b.min.x >= -0.35 && b.max.x <= 4.35 && b.min.z >= -0.35 && b.max.z <= 4.35, `${k} spills out of its cell`); assert.ok(b.min.y >= -0.4, `${k} hangs too low`); }
    const pr = box(r.pitchedRoof); assert.ok(pr.max.y >= 2.9 && pr.max.y <= 3.5); const lr = box(r.lowRoof); assert.ok(lr.max.y >= 1.4 && lr.max.y <= 2);
    const oc = box(r.roofOuterCorner); assert.ok(oc.max.y >= 2.9 && oc.max.y <= 3.5); const ic = box(r.roofInnerCorner); assert.ok(ic.max.y >= 2.9 && ic.max.y <= 3.5);
    const g = box(r.gable); near(g.min.x, 0); near(g.max.x, 4); near(g.min.y, 0); assert.ok(g.max.y >= 2.9 && g.max.y <= 3.2 && g.max.z - g.min.z <= 0.45);
    const rc = box(r.ridgeCap); near(rc.min.x, 0, 0.1); near(rc.max.x, 4, 0.1); assert.ok(rc.min.y >= 2.7 && rc.max.y <= 3.6);
  }
});
