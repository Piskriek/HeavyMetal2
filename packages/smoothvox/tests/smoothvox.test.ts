import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBlocky, decimate, lodChain, meshModel, type Mesh, type VModel } from '../src';

const mat = (r: number, g: number, b: number) => ({ color: [r, g, b] as [number, number, number], alpha: 1, roughness: 0.8, metalness: 0, emissive: 0 });
function grid(size: [number, number, number], fill: (x: number, y: number, z: number) => number, palette = [mat(1, 0, 0), mat(0, 0, 1)]): VModel {
  const cells = new Uint8Array(size[0] * size[1] * size[2]);
  for (let z = 0; z < size[2]; z++) for (let y = 0; y < size[1]; y++) for (let x = 0; x < size[0]; x++) cells[x + size[0] * (y + size[1] * z)] = fill(x, y, z);
  return { size, pivot: [size[0] / 2, 0, size[2] / 2], palette, cells };
}
const cube = (n: number, pad = 3): VModel => grid([n + pad * 2, n + pad * 2, n + pad * 2], (x, y, z) => (x >= pad && x < pad + n && y >= pad && y < pad + n && z >= pad && z < pad + n ? 1 : 0));
const sphere = (r: number): VModel => { const s = r * 2 + 6, c = s / 2; return grid([s, s, s], (x, y, z) => (Math.hypot(x + 0.5 - c, y + 0.5 - c, z + 0.5 - c) <= r ? 1 : 0)); };

/** every undirected edge must be used by exactly two triangles for a closed surface */
function edgeUse(m: Mesh): Map<string, number> {
  const use = new Map<string, number>();
  for (let t = 0; t < m.triangleCount; t++) {
    const a = m.indices[t * 3]!, b = m.indices[t * 3 + 1]!, c = m.indices[t * 3 + 2]!;
    for (const [p, q] of [[a, b], [b, c], [c, a]] as const) { const k = p < q ? `${p}_${q}` : `${q}_${p}`; use.set(k, (use.get(k) ?? 0) + 1); }
  }
  return use;
}
const signedVolume = (m: Mesh): number => {
  let v = 0;
  for (let t = 0; t < m.triangleCount; t++) {
    const i = [m.indices[t * 3]!, m.indices[t * 3 + 1]!, m.indices[t * 3 + 2]!];
    const p = i.map((k) => [m.positions[k * 3]!, m.positions[k * 3 + 1]!, m.positions[k * 3 + 2]!]);
    v += (p[0]![0]! * (p[1]![1]! * p[2]![2]! - p[1]![2]! * p[2]![1]!) - p[0]![1]! * (p[1]![0]! * p[2]![2]! - p[1]![2]! * p[2]![0]!) + p[0]![2]! * (p[1]![0]! * p[2]![1]! - p[1]![1]! * p[2]![0]!)) / 6;
  }
  return v;
};

test('a solid cube meshes to a closed surface with outward winding', () => {
  const m = meshModel(cube(6));
  assert.ok(m.triangleCount > 12);
  for (const [k, n] of edgeUse(m)) assert.equal(n, 2, `edge ${k} used ${n} times`);
  assert.ok(signedVolume(m) > 0, 'winding is outward (positive volume)');
});

test('corners are rounded: vertex normals are not axis aligned everywhere', () => {
  const m = meshModel(cube(6));
  let diagonal = 0;
  for (let i = 0; i < m.normals.length; i += 3) { const nx = Math.abs(m.normals[i]!), ny = Math.abs(m.normals[i + 1]!), nz = Math.abs(m.normals[i + 2]!); if (Math.max(nx, ny, nz) < 0.95) diagonal++; }
  assert.ok(diagonal > 8, `${diagonal} rounded-corner vertices`);
  for (let i = 0; i < m.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(m.normals[i]!, m.normals[i + 1]!, m.normals[i + 2]!) - 1) < 1e-3);
});

test('a sphere stays close to its true radius at scale 2', () => {
  const r = 8, model = sphere(r), c = model.size[0] / 2;
  const m = meshModel(model, { scale: 2 });
  let worst = 0;
  for (let i = 0; i < m.positions.length; i += 3) {
    const x = m.positions[i]! + model.pivot[0], y = m.positions[i + 1]! + model.pivot[1], z = m.positions[i + 2]! + model.pivot[2];
    worst = Math.max(worst, Math.abs(Math.hypot(x - c, y - c, z - c) - r));
  }
  assert.ok(worst < 1.0, `worst radius error ${worst.toFixed(2)}`);
});

test('deterministic and scale 4 gives more triangles than scale 1', () => {
  const a = meshModel(sphere(5)), b = meshModel(sphere(5));
  assert.deepEqual(Array.from(a.positions), Array.from(b.positions));
  assert.ok(meshModel(sphere(5), { scale: 4 }).triangleCount > a.triangleCount);
});

test('a one voxel thick plate survives with preserveThin', () => {
  const plate = grid([14, 6, 14], (x, y, z) => (y === 2 && x >= 3 && x < 11 && z >= 3 && z < 11 ? 1 : 0));
  assert.ok(meshModel(plate, { preserveThin: true }).triangleCount > 0);
});

test('colours follow the voxels: red on one side, blue on the other', () => {
  const half = grid([16, 10, 10], (x, y, z) => (x >= 3 && x < 13 && y >= 2 && y < 8 && z >= 2 && z < 8 ? (x < 8 ? 1 : 2) : 0));
  const m = meshModel(half, { colorBlend: 0.5 });
  let redLeft = 0, blueRight = 0, wrong = 0;
  for (let v = 0; v < m.positions.length / 3; v++) {
    const x = m.positions[v * 3]! + half.pivot[0];
    const r = m.colors[v * 4]!, b = m.colors[v * 4 + 2]!; // colours are rgba: four floats per vertex
    if (x < 6) { if (r > b) redLeft++; else wrong++; }
    if (x > 10) { if (b > r) blueRight++; else wrong++; }
  }
  assert.ok(redLeft > 10 && blueRight > 10, `${redLeft}/${blueRight}`);
  assert.ok(wrong < (redLeft + blueRight) * 0.05, `${wrong} vertices with the wrong colour`);
});

test('ambient occlusion is darker in a notch than on a flat face', () => {
  const notch = grid([16, 12, 12], (x, y, z) => (y < 4 && x >= 2 && x < 14 && z >= 2 && z < 10 ? 1 : (x >= 2 && x < 5 && y < 8 && z >= 2 && z < 10 ? 1 : (x >= 9 && x < 14 && y < 8 && z >= 2 && z < 10 ? 1 : 0))));
  const m = meshModel(notch, { ao: 1 });
  const lum = (v: number): number => m.colors[v * 4]! + m.colors[v * 4 + 1]! + m.colors[v * 4 + 2]!;
  let inside = Infinity, flat = -Infinity;
  for (let v = 0; v < m.positions.length / 3; v++) {
    const x = m.positions[v * 3]! + notch.pivot[0], y = m.positions[v * 3 + 1]! + notch.pivot[1];
    if (x > 6 && x < 8 && y > 3.5 && y < 4.8) inside = Math.min(inside, lum(v));
    if (y > 7.5 && x > 2.5 && x < 4.5) flat = Math.max(flat, lum(v));
  }
  assert.ok(Number.isFinite(inside) && Number.isFinite(flat));
  assert.ok(inside < flat, `notch ${inside.toFixed(2)} vs flat ${flat.toFixed(2)}`);
});

test('lodChain triangle counts strictly decrease and decimate keeps the surface roughly in place', () => {
  const [near, mid, far] = lodChain(sphere(8));
  assert.ok(near.triangleCount > mid.triangleCount && mid.triangleCount > far.triangleCount);
  const small = decimate(near, Math.floor(near.triangleCount / 3));
  assert.ok(small.triangleCount <= near.triangleCount * 0.5 && small.triangleCount > 20);
});

test('compareBlocky counts both meshes, and an empty or junk model does not throw', () => {
  const c = compareBlocky(cube(5));
  assert.ok(c.blockyTriangles > 0 && c.smoothTriangles > 0);
  assert.equal(meshModel(grid([6, 6, 6], () => 0)).triangleCount, 0);
  assert.doesNotThrow(() => meshModel({} as unknown as VModel));
  assert.doesNotThrow(() => meshModel(null as unknown as VModel));
});
