import test from 'node:test'; import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMaterials, foundation, wall, pillar, floor, ramp, airlock, triangles, type Piece } from '../src/index';
import { pitchedRoof, lowRoof, roofOuterCorner, roofInnerCorner, ridgeCap, gable } from '../src/index';
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

// ---------------------------------------------------------------------------
// Additional tests
// ---------------------------------------------------------------------------

const EPS = 1e-4;
const STAGES = [0, 1, 2, 3, 4, 5, 6];

const buildAll = (stage: number): Record<string, Piece> => ({
  foundation: foundation(m, { stage }),
  wall: wall(m, { stage }),
  pillar: pillar(m, { stage }),
  floor: floor(m, { stage }),
  ramp: ramp(m, { stage }),
  airlock: airlock(m, { stage }),
});

const meshes = (p: Piece): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  p.group.traverse((o) => { if (o instanceof THREE.Mesh) out.push(o); });
  return out;
};

// ---------------------------------------------------------------------------
// Roof set (round 2)
// ---------------------------------------------------------------------------

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

const ROOF_NAMES = ['pitchedRoof', 'lowRoof', 'roofOuterCorner', 'roofInnerCorner', 'ridgeCap', 'gable'] as const;

const buildRoofs = (stage: number): Record<string, Piece> => ({
  pitchedRoof: pitchedRoof(m, { stage }),
  lowRoof: lowRoof(m, { stage }),
  roofOuterCorner: roofOuterCorner(m, { stage }),
  roofInnerCorner: roofInnerCorner(m, { stage }),
  ridgeCap: ridgeCap(m, { stage }),
  gable: gable(m, { stage }),
});

const roofMeshes = (p: Piece): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  p.group.traverse((o) => { if (o instanceof THREE.Mesh) out.push(o); });
  return out;
};

/** Height of the topmost surface under (x, z), by casting a ray straight down. */
const topY = (p: Piece, x: number, z: number): number | undefined => {
  p.group.updateMatrixWorld(true);
  const rc = new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0), 0, 30);
  return rc.intersectObject(p.group, true)[0]?.point.y;
};

test('roof set: every stage 0-6 stays inside budget, six-mesh limit, has colliders', () => {
  for (const stage of [0, 1, 2, 3, 4, 5, 6]) {
    for (const [k, p] of Object.entries(buildRoofs(stage))) {
      const t = triangles(p);
      assert.ok(t > 0 && t <= (stage <= 1 ? 400 : 4000), `${k} s${stage}: ${t}`);
      assert.ok(p.group.children.length <= 6, `${k} s${stage} meshes ${p.group.children.length}`);
      assert.ok(p.colliders.length > 0, k);
      assert.equal(p.lamps.length, 0, k);
    }
  }
});

test('roof set: stage 6 reads richer than stage 1', () => {
  const lo = buildRoofs(1);
  const hi = buildRoofs(6);
  for (const k of ROOF_NAMES) {
    const a = lo[k]; const c = hi[k];
    assert.ok(a && c);
    assert.ok(triangles(c) > triangles(a) * 1.5, `${k}: ${triangles(a)} -> ${triangles(c)}`);
  }
});

test('roof set: flat-shaded copies at stage 1, shared materials at stage 6, no transmission', () => {
  const shared = new Set<THREE.Material>(Object.values(m));
  for (const [k, p] of Object.entries(buildRoofs(1))) {
    for (const mesh of roofMeshes(p)) {
      const mat = mesh.material;
      assert.ok(!Array.isArray(mat) && mat instanceof THREE.MeshStandardMaterial && mat.flatShading, `${k} s1 flat`);
      assert.ok(!shared.has(mat), `${k} s1 must use copies`);
    }
  }
  for (const [k, p] of Object.entries(buildRoofs(6))) {
    for (const mesh of roofMeshes(p)) {
      const mat = mesh.material;
      assert.ok(!Array.isArray(mat) && shared.has(mat), `${k} s6 shared`);
      if (mat instanceof THREE.MeshPhysicalMaterial) assert.equal(mat.transmission, 0);
    }
  }
});

test('roof set: every mesh is non-indexed with position, normal and uv; normals unit and agree with winding', () => {
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
  const e1 = new THREE.Vector3(); const e2 = new THREE.Vector3(); const fn = new THREE.Vector3(); const vn = new THREE.Vector3();
  for (const stage of [1, 6]) {
    for (const [k, p] of Object.entries(buildRoofs(stage))) {
      for (const mesh of roofMeshes(p)) {
        const g = mesh.geometry;
        assert.equal(g.index, null, `${k} s${stage} must be non-indexed`);
        const pos = g.getAttribute('position'); const nor = g.getAttribute('normal'); const uv = g.getAttribute('uv');
        assert.ok(pos && nor && uv, `${k} attributes`);
        assert.equal(pos.count % 3, 0);
        assert.equal(nor.count, pos.count); assert.equal(uv.count, pos.count);
        for (const v of pos.array) assert.ok(Number.isFinite(v));
        for (const v of uv.array) assert.ok(Number.isFinite(v));
        for (let i = 0; i < nor.count; i++) assert.ok(Math.abs(Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)) - 1) < 1e-3, `${k} s${stage} normal length`);
        for (let i = 0; i + 2 < pos.count; i += 3) {
          a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
          fn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
          vn.set(nor.getX(i) + nor.getX(i + 1) + nor.getX(i + 2), nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2), nor.getZ(i) + nor.getZ(i + 1) + nor.getZ(i + 2));
          assert.ok(fn.dot(vn) > 0, `${k} s${stage}: tri ${i / 3} winds against its normals`);
        }
      }
    }
  }
});

test('roof surfaces follow their height fields (rays from above)', () => {
  for (const stage of [1, 6]) {
    const tol = stage === 1 ? 0.2 : 0.12;
    const pitched = pitchedRoof(m, { stage }); const low = lowRoof(m, { stage });
    for (const x of [0.75, 2.0, 3.25]) {
      for (const z of [0.9, 1.7, 2.6]) {
        const yp = topY(pitched, x, z); const yl = topY(low, x, z);
        assert.ok(yp !== undefined && Math.abs(yp - 0.75 * z) <= tol, `pitched s${stage} (${x},${z}) -> ${yp}`);
        assert.ok(yl !== undefined && Math.abs(yl - 0.375 * z) <= tol, `low s${stage} (${x},${z}) -> ${yl}`);
      }
    }
    const hip = roofOuterCorner(m, { stage }); const valley = roofInnerCorner(m, { stage });
    for (const [x, z] of [[3.2, 1.0], [2.6, 1.2], [1.0, 3.0], [1.2, 2.5]] as const) {
      const yh = topY(hip, x, z); const yv = topY(valley, x, z);
      assert.ok(yh !== undefined && Math.abs(yh - 0.75 * Math.min(x, z)) <= tol, `hip s${stage} (${x},${z}) -> ${yh}`);
      assert.ok(yv !== undefined && Math.abs(yv - 0.75 * Math.max(x, z)) <= tol, `valley s${stage} (${x},${z}) -> ${yv}`);
    }
    const hy = topY(hip, 2, 2); assert.ok(hy !== undefined && hy >= 1.5 - 0.02 && hy <= 1.5 + 0.12, `hip cap at the diagonal: ${hy}`);
    const vy = topY(valley, 2, 2); assert.ok(vy !== undefined && vy >= 1.5 - 0.02 && vy <= 1.5 + 0.12, `valley flashing at the diagonal: ${vy}`);
    const gb = gable(m, { stage });
    for (const x of [1, 2, 3]) { const y = topY(gb, x, 0); assert.ok(y !== undefined && Math.abs(y - 0.75 * x) <= 0.1, `gable rake at x=${x}: ${y}`); }
  }
});

test('roof set: meshes of each piece form one connected cluster (nothing floats)', () => {
  for (const stage of [1, 6]) {
    for (const [k, p] of Object.entries(buildRoofs(stage))) {
      const boxes = roofMeshes(p).map((mesh) => new THREE.Box3().setFromObject(mesh).expandByScalar(0.03));
      const seen = new Set<number>([0]);
      const queue = [0];
      while (queue.length) {
        const i = queue.pop();
        const bi = i === undefined ? undefined : boxes[i];
        if (i === undefined || !bi) break;
        boxes.forEach((bj, j) => { if (!seen.has(j) && bi.intersectsBox(bj)) { seen.add(j); queue.push(j); } });
      }
      assert.equal(seen.size, boxes.length, `${k} s${stage}: ${seen.size}/${boxes.length} meshes connected`);
    }
  }
});

test('roof set: eaves sit at y = 0 and colliders are sane', () => {
  for (const stage of [1, 6]) {
    const ps = buildRoofs(stage);
    for (const k of ['pitchedRoof', 'lowRoof', 'roofOuterCorner'] as const) {
      const p = ps[k]; assert.ok(p);
      const eaveTop = topY(p, 2, 0.04);
      assert.ok(eaveTop !== undefined && eaveTop <= 0.2, `${k} s${stage}: eave top ${eaveTop}`);
    }
    for (const k of ROOF_NAMES) {
      const p = ps[k]; assert.ok(p);
      for (const c of p.colliders) for (let i = 0; i < 3; i++) assert.ok((c.min[i] ?? 0) < (c.max[i] ?? 0), `${k} collider axis ${i}`);
    }
    const pr = ps.pitchedRoof; assert.ok(pr);
    const tops = [...pr.colliders].sort((a, b2) => a.min[2] - b2.min[2]).map((c) => c.max[1]);
    for (let i = 1; i < tops.length; i++) assert.ok((tops[i] ?? 0) > (tops[i - 1] ?? 0), 'roof colliders climb');
    near(Math.max(...tops), 0.75 * 3.5, 0.01);
  }
});

test('ridge cap straddles z = 0 about 0.5 m wide; gable is a 0.25 m triangle wall', () => {
  for (const stage of [1, 6]) {
    const rc = box(ridgeCap(m, { stage }));
    near(rc.min.z, -0.25, 0.04); near(rc.max.z, 0.25, 0.04);
    const gb = gable(m, { stage });
    const g = box(gb);
    const thick = g.max.z - g.min.z;
    assert.ok(thick >= 0.24 && thick <= 0.3, `gable thickness ${thick}`);
    // the triangle is empty above the rake: a ray just above the rake line misses everything
    const above = new THREE.Raycaster(new THREE.Vector3(1, 0.75 + 0.2, -1), new THREE.Vector3(0, 0, 1), 0, 3);
    gb.group.updateMatrixWorld(true);
    assert.equal(above.intersectObject(gb.group, true).length, 0, 'nothing above the rake');
    const below = new THREE.Raycaster(new THREE.Vector3(3, 1.0, -1), new THREE.Vector3(0, 0, 1), 0, 3);
    assert.ok(below.intersectObject(gb.group, true).length > 0, 'wall under the rake');
  }
});

test('roof set is deterministic and builds in under 30 ms at stage 6', () => {
  for (const stage of [1, 6]) {
    const x = buildRoofs(stage); const y = buildRoofs(stage);
    for (const k of ROOF_NAMES) {
      const px = x[k]; const py = y[k];
      assert.ok(px && py);
      assert.equal(triangles(px), triangles(py), k);
      const ga = roofMeshes(px).map((q) => Array.from(q.geometry.getAttribute('position').array));
      const gb2 = roofMeshes(py).map((q) => Array.from(q.geometry.getAttribute('position').array));
      assert.deepEqual(ga, gb2, k);
    }
  }
  const makers: Array<[string, () => Piece]> = [
    ['pitchedRoof', () => pitchedRoof(m, { stage: 6 })], ['lowRoof', () => lowRoof(m, { stage: 6 })],
    ['roofOuterCorner', () => roofOuterCorner(m, { stage: 6 })], ['roofInnerCorner', () => roofInnerCorner(m, { stage: 6 })],
    ['ridgeCap', () => ridgeCap(m, { stage: 6 })], ['gable', () => gable(m, { stage: 6 })],
  ];
  for (const [k, make] of makers) {
    make();
    let best = Infinity;
    for (let i = 0; i < 3; i++) { const t0 = performance.now(); make(); best = Math.min(best, performance.now() - t0); }
    assert.ok(best < 30, `${k}: ${best.toFixed(1)} ms`);
  }
});

test('every stage 0-6 stays inside the triangle budget and the six-mesh limit', () => {
  for (const stage of STAGES) {
    for (const [k, p] of Object.entries(buildAll(stage))) {
      const t = triangles(p);
      assert.ok(t > 0, `${k} s${stage} empty`);
      assert.ok(t <= (stage <= 1 ? 400 : 4000), `${k} s${stage}: ${t}`);
      assert.ok(p.group.children.length <= 6, `${k} s${stage} meshes: ${p.group.children.length}`);
    }
  }
});

test('foundation skirt range 0..3 hangs to -(0.5 + skirt) and never leaves the 4 x 4 cell', () => {
  for (const stage of STAGES) {
    for (const skirt of [0, 0.5, 1, 2, 3]) {
      const b = box(foundation(m, { stage, skirt }));
      assert.ok(b.min.x >= -EPS && b.max.x <= 4 + EPS, `s${stage} skirt ${skirt} x ${b.min.x}..${b.max.x}`);
      assert.ok(b.min.z >= -EPS && b.max.z <= 4 + EPS, `s${stage} skirt ${skirt} z ${b.min.z}..${b.max.z}`);
      near(b.min.y, -(0.5 + skirt), 0.01);
      assert.ok(b.max.y <= 0.06);
    }
  }
  // default skirt is 1 m
  near(box(foundation(m, { stage: 6 })).min.y, -1.5, 0.01);
  // out-of-range skirt is clamped
  near(box(foundation(m, { stage: 6, skirt: 9 })).min.y, -3.5, 0.01);
});

test('floor stays inside x 0..4 and z 0..4 at every stage', () => {
  for (const stage of STAGES) {
    const b = box(floor(m, { stage }));
    assert.ok(b.min.x >= -EPS && b.max.x <= 4 + EPS, `s${stage} x ${b.min.x}..${b.max.x}`);
    assert.ok(b.min.z >= -EPS && b.max.z <= 4 + EPS, `s${stage} z ${b.min.z}..${b.max.z}`);
    near(b.max.y, 0, 0.06);
    near(b.min.y, -0.3, 0.01);
  }
});

test('wall, ramp and airlock stay inside their cell footprint', () => {
  for (const stage of STAGES) {
    const w = box(wall(m, { stage }));
    assert.ok(w.min.x >= -EPS && w.max.x <= 4 + EPS, `wall s${stage}`);
    const a = box(airlock(m, { stage }));
    assert.ok(a.min.x >= -EPS && a.max.x <= 4 + EPS, `airlock s${stage}`);
    assert.ok(a.max.z - a.min.z <= 0.45, `airlock thickness s${stage}: ${a.max.z - a.min.z}`);
    const r = box(ramp(m, { stage }));
    assert.ok(r.min.x >= -EPS && r.max.x <= 4 + EPS, `ramp x s${stage}`);
    assert.ok(r.min.z >= -EPS && r.max.z <= 4 + EPS, `ramp z s${stage}`);
    assert.ok(r.min.y >= -EPS, `ramp below ground s${stage}`);
    const p = box(pillar(m, { stage }));
    assert.ok(p.max.x <= 0.45 && p.min.x >= -0.45 && p.max.z <= 0.45 && p.min.z >= -0.45, `pillar s${stage}`);
  }
});

test('stage 6 reads richer than stage 1 on wall, floor, ramp (and the rest)', () => {
  for (const k of ['wall', 'floor', 'ramp', 'airlock', 'pillar', 'foundation']) {
    const lo = buildAll(1)[k];
    const hi = buildAll(6)[k];
    assert.ok(lo && hi);
    assert.ok(triangles(hi) > triangles(lo) * 1.5, `${k}: ${triangles(lo)} -> ${triangles(hi)}`);
  }
});

test('stage 0-1 uses flat-shaded copies, stage 6 shares the supplied materials', () => {
  for (const mesh of meshes(wall(m, { stage: 1 }))) {
    const mat = mesh.material;
    assert.ok(mat instanceof THREE.MeshStandardMaterial && mat.flatShading);
    assert.ok(!Object.values(m).includes(mat), 'stage 1 must use copies');
  }
  const used = new Set<THREE.Material>(Object.values(m));
  for (const mesh of meshes(wall(m, { stage: 6 }))) {
    const mat = mesh.material;
    assert.ok(!Array.isArray(mat) && used.has(mat), 'stage 6 uses the shared materials');
  }
  // the supplied materials are never mutated
  for (const mat of Object.values(m)) if (mat instanceof THREE.MeshStandardMaterial) assert.equal(mat.flatShading, false);
});

test('no transmission anywhere, glass is plain transparency', () => {
  assert.equal(m.glass.transmission, 0);
  assert.ok(m.glass.transparent);
});

test('geometry is finite, non-degenerate, carries normals and uvs, and is unindexed per material', () => {
  for (const stage of [1, 6]) {
    for (const [k, p] of Object.entries(buildAll(stage))) {
      for (const mesh of meshes(p)) {
        const g = mesh.geometry;
        for (const name of ['position', 'normal', 'uv']) {
          const a = g.getAttribute(name);
          assert.ok(a, `${k} ${name}`);
          for (const v of a.array) assert.ok(Number.isFinite(v), `${k} s${stage} ${name} non-finite`);
        }
        const n = g.getAttribute('normal');
        for (let i = 0; i < n.count; i++) {
          const len = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
          assert.ok(Math.abs(len - 1) < 1e-3, `${k} s${stage} normal length ${len}`);
        }
      }
    }
  }
});

test('triangle faces agree with their vertex normals (nothing is inside-out)', () => {
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
  const e1 = new THREE.Vector3(); const e2 = new THREE.Vector3(); const fn = new THREE.Vector3(); const vn = new THREE.Vector3();
  for (const [k, p] of Object.entries(buildAll(6))) {
    for (const mesh of meshes(p)) {
      const pos = mesh.geometry.getAttribute('position');
      const nor = mesh.geometry.getAttribute('normal');
      for (let i = 0; i + 2 < pos.count; i += 3) {
        a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
        fn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
        vn.set(nor.getX(i) + nor.getX(i + 1) + nor.getX(i + 2), nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2), nor.getZ(i) + nor.getZ(i + 1) + nor.getZ(i + 2));
        assert.ok(fn.dot(vn) > 0, `${k}: tri ${i / 3} faces against its normals`);
      }
    }
  }
});

test('meshes of a piece form one connected cluster (no floating parts)', () => {
  const gap = 0.03;
  for (const stage of [1, 6]) {
    for (const [k, p] of Object.entries(buildAll(stage))) {
      const boxes = meshes(p).map((mesh) => new THREE.Box3().setFromObject(mesh).expandByScalar(gap));
      const seen = new Set<number>([0]);
      const queue = [0];
      while (queue.length) {
        const i = queue.pop();
        const bi = i === undefined ? undefined : boxes[i];
        if (i === undefined || !bi) break;
        boxes.forEach((bj, j) => { if (!seen.has(j) && bi.intersectsBox(bj)) { seen.add(j); queue.push(j); } });
      }
      assert.equal(seen.size, boxes.length, `${k} s${stage}: ${seen.size}/${boxes.length} meshes connected`);
    }
  }
});

test('airlock: doorway clear at every walking height, lamp is a driveable mesh in the group', () => {
  for (const stage of STAGES) {
    const p = airlock(m, { stage });
    for (const y of [0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.3]) {
      for (const x of [1.4, 1.7, 2, 2.3, 2.6]) {
        for (const c of p.colliders) {
          const hit = c.min[0] < x && c.max[0] > x && c.min[1] < y && c.max[1] > y && c.min[2] < 0 && c.max[2] > 0;
          assert.ok(!hit, `s${stage} doorway blocked at x=${x} y=${y}`);
        }
      }
    }
    assert.equal(p.lamps.length, 1);
    const lamp = p.lamps[0];
    assert.ok(lamp);
    assert.ok(p.group.children.includes(lamp));
    assert.ok(lamp.material instanceof THREE.MeshStandardMaterial && lamp.material.emissiveIntensity > 0);
    assert.ok(p.colliders.length >= 2);
  }
});

test('other pieces expose colliders and no lamps', () => {
  for (const stage of [1, 6]) {
    const all = buildAll(stage);
    for (const [k, p] of Object.entries(all)) {
      assert.ok(p.colliders.length > 0, k);
      if (k !== 'airlock') assert.equal(p.lamps.length, 0, k);
      for (const c of p.colliders) {
        for (let i = 0; i < 3; i++) assert.ok((c.min[i] ?? 0) < (c.max[i] ?? 0), `${k} collider ${i} inverted`);
      }
    }
  }
});

test('floor collider top is the deck at y = 0; foundation slab top is y = 0', () => {
  const fl = floor(m, { stage: 6 }).colliders;
  assert.ok(fl.some((c) => c.max[1] === 0 && c.min[0] === 0 && c.max[0] === 4 && c.min[2] === 0 && c.max[2] === 4));
  const fo = foundation(m, { stage: 6 }).colliders;
  assert.ok(fo.some((c) => c.max[1] === 0 && c.min[1] === -0.5 && c.max[0] === 4 && c.max[2] === 4));
});

test('ramp colliders climb from 0 to 3 across z 0..4', () => {
  const cs = ramp(m, { stage: 6 }).colliders;
  const walk = cs.filter((c) => c.min[0] === 0 && c.max[0] === 4);
  assert.ok(walk.length >= 6);
  const first = walk.reduce((a, c) => (c.min[2] < a.min[2] ? c : a));
  const last = walk.reduce((a, c) => (c.max[2] > a.max[2] ? c : a));
  assert.ok(first.max[1] < 0.3, `start ${first.max[1]}`);
  near(last.max[1], 3, 0.2);
  near(last.max[2], 4, 1e-6);
  const tops = [...walk].sort((p, q) => p.min[2] - q.min[2]).map((c) => c.max[1]);
  for (let i = 1; i < tops.length; i++) assert.ok((tops[i] ?? 0) > (tops[i - 1] ?? 0), 'monotonic rise');
});

test('wall and pillar colliders match their envelope', () => {
  const w = wall(m, { stage: 6 }).colliders;
  assert.ok(w.some((c) => c.min[0] === 0 && c.max[0] === 4 && c.max[1] === 3 && c.max[2] - c.min[2] <= 0.26));
  const p = pillar(m, { stage: 6 }).colliders;
  assert.ok(p.some((c) => c.max[1] === 3 && c.max[0] - c.min[0] === 0.4));
});

test('building is deterministic', () => {
  for (const stage of [1, 6]) {
    const x = buildAll(stage);
    const y = buildAll(stage);
    for (const k of Object.keys(x)) {
      const px = x[k]; const py = y[k];
      assert.ok(px && py);
      assert.equal(triangles(px), triangles(py), k);
      assert.deepEqual(box(px).min.toArray(), box(py).min.toArray(), k);
      assert.deepEqual(box(px).max.toArray(), box(py).max.toArray(), k);
      const ga = meshes(px).map((q) => Array.from(q.geometry.getAttribute('position').array));
      const gb = meshes(py).map((q) => Array.from(q.geometry.getAttribute('position').array));
      assert.deepEqual(ga, gb, k);
    }
  }
});

test('every piece builds in under 30 ms at stage 6 (best of three, after warm-up)', () => {
  const makers: Array<[string, () => Piece]> = [
    ['foundation', () => foundation(m, { stage: 6, skirt: 3 })],
    ['wall', () => wall(m, { stage: 6 })],
    ['pillar', () => pillar(m, { stage: 6 })],
    ['floor', () => floor(m, { stage: 6 })],
    ['ramp', () => ramp(m, { stage: 6 })],
    ['airlock', () => airlock(m, { stage: 6 })],
  ];
  for (const [k, make] of makers) {
    make();
    let best = Infinity;
    for (let i = 0; i < 3; i++) { const t0 = performance.now(); make(); best = Math.min(best, performance.now() - t0); }
    assert.ok(best < 30, `${k}: ${best.toFixed(1)} ms`);
  }
});
