import test from 'node:test';
import assert from 'node:assert/strict';
import { addBox, addPrism, addWedge, buildPart, GENERATORS, MeshBuilder, resolveParams, triangleCount, type MeshData, type Rank } from '../src/index';

/** Every triangle of a convex closed piece faces away from the piece's centre. */
function allOutward(md: MeshData): boolean {
  const n = md.positions.length / 3;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += md.positions[i * 3]!; cy += md.positions[i * 3 + 1]!; cz += md.positions[i * 3 + 2]!; }
  cx /= n; cy /= n; cz /= n;
  for (let t = 0; t < md.indices.length; t += 3) {
    const [a, b, c] = [md.indices[t]!, md.indices[t + 1]!, md.indices[t + 2]!];
    const P = (i: number) => [md.positions[i * 3]!, md.positions[i * 3 + 1]!, md.positions[i * 3 + 2]!];
    const pa = P(a), pb = P(b), pc = P(c);
    const u = [pb[0]! - pa[0]!, pb[1]! - pa[1]!, pb[2]! - pa[2]!], v = [pc[0]! - pa[0]!, pc[1]! - pa[1]!, pc[2]! - pa[2]!];
    const nx = u[1]! * v[2]! - u[2]! * v[1]!, ny = u[2]! * v[0]! - u[0]! * v[2]!, nz = u[0]! * v[1]! - u[1]! * v[0]!;
    const mx = (pa[0]! + pb[0]! + pc[0]!) / 3 - cx, my = (pa[1]! + pb[1]! + pc[1]!) / 3 - cy, mz = (pa[2]! + pb[2]! + pc[2]!) / 3 - cz;
    if (nx * mx + ny * my + nz * mz <= 0) return false;
    // the stored flat normal agrees with the winding
    const sn = [md.normals[a * 3]!, md.normals[a * 3 + 1]!, md.normals[a * 3 + 2]!];
    if (sn[0]! * nx + sn[1]! * ny + sn[2]! * nz <= 0) return false;
  }
  return true;
}

function wellFormed(md: MeshData): void {
  const verts = md.positions.length / 3;
  assert.equal(md.normals.length, md.positions.length);
  assert.equal(md.uvs.length / 2, verts);
  for (const i of md.indices) assert.ok(i < verts);
  for (let i = 0; i < verts; i++) {
    const l = Math.hypot(md.normals[i * 3]!, md.normals[i * 3 + 1]!, md.normals[i * 3 + 2]!);
    assert.ok(Math.abs(l - 1) < 1e-5, `normal ${i} length ${l}`);
  }
  assert.equal(md.slots.reduce((s, x) => s + x.count, 0), md.indices.length, 'slots cover every index');
}

test('plain and chamfered boxes and prisms are closed and face outwards', () => {
  for (const c of [0, 0.02, 0.2]) {
    const b = new MeshBuilder(['s']);
    addBox(b, 's', [-0.5, 0, -0.3], [0.5, 0.4, 0.3], c);
    const md = b.build();
    wellFormed(md);
    assert.ok(allOutward(md), `box chamfer ${c}`);
    assert.equal(triangleCount(md), c > 0 ? 6 * 2 + 12 * 2 + 8 : 12);
  }
  for (const [z0, z1] of [[0, 0.3], [0.3, 0]]) {
    const b = new MeshBuilder(['s']);
    addWedge(b, 's', -0.05, 0.05, 0, 0.2, z0!, z1!);
    const md = b.build();
    wellFormed(md);
    assert.ok(allOutward(md), `wedge ${z0} to ${z1}`);
  }
  for (const sides of [4, 6, 12]) {
    const b = new MeshBuilder(['s']);
    addPrism(b, 's', sides, 0.1, 0, 0.05);
    const md = b.build();
    wellFormed(md);
    assert.ok(allOutward(md), `prism ${sides}`);
  }
});

test('resolveParams clamps, snaps to the step, defaults and drops unknown keys', () => {
  const specs = GENERATORS.bolt!.params;
  const p = resolveParams(specs, { headWidth: 9, headHeight: 0.0205, shankDia: Number.NaN, bogus: 3 });
  assert.equal(p.headWidth, 0.2);
  assert.equal(p.headHeight, 0.02);
  assert.equal(p.shankDia, 0.02);
  assert.equal('bogus' in p, false);
  assert.equal(p.head, 1);
});

test('every generator builds well-formed meshes at every rank, deterministically', () => {
  for (const g of Object.values(GENERATORS)) {
    for (const rank of [0, 1, 2] as Rank[]) {
      const md = g.build({}, rank);
      wellFormed(md);
      assert.deepEqual(g.build({}, rank), md);
      for (const s of md.slots) assert.ok(g.slots.includes(s.name), `${g.id} slot ${s.name}`);
    }
  }
});

test('rank adds detail: triangles never fall as the rank rises', () => {
  for (const g of Object.values(GENERATORS)) {
    const t = ([0, 1, 2] as Rank[]).map((r) => triangleCount(g.build({}, r)));
    assert.ok(t[0]! <= t[1]! && t[1]! <= t[2]!, `${g.id}: ${t.join(' ')}`);
  }
  assert.equal(triangleCount(buildPart('bolt', {}, 0)!), 12, 'a stage-1 bolt is a plain block');
});

test('sliders change the shape: fat bolts are wider, long beams are longer', () => {
  const thin = buildPart('bolt', { headWidth: 0.03 }, 1)!;
  const fat = buildPart('bolt', { headWidth: 0.09 }, 1)!;
  assert.ok(fat.max[0] - fat.min[0] > 2.5 * (thin.max[0] - thin.min[0]));
  const shank = buildPart('bolt', { shankLength: 0.1 }, 1)!;
  assert.ok(Math.abs(shank.min[1] + 0.1) < 1e-6, 'the shank goes 0.1 m below the surface');
  const b = buildPart('beam', { length: 6 }, 1)!;
  assert.ok(Math.abs(b.max[0] - b.min[0] - 6) < 1e-6);
  const c = buildPart('can', { width: 0.51, depth: 0.52, height: 1 }, 2)!;
  assert.ok(Math.abs(c.max[1] - 1) < 1e-6 && c.min[1] === 0, 'a can stands on y = 0 and reaches its height');
});

test('a panel with bolts at rank 2 puts them in the bolts slot, around the seam', () => {
  const md = buildPart('panel', { boltsPerSide: 3 }, 2)!;
  const bolts = md.slots.find((s) => s.name === 'bolts');
  assert.ok(bolts && bolts.count > 0);
  assert.equal(buildPart('panel', { boltsPerSide: 3 }, 1)!.slots.some((s) => s.name === 'bolts'), false);
  assert.equal(buildPart('nope', {}, 1), null);
});
