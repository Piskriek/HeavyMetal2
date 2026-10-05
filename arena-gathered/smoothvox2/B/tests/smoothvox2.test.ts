import test from 'node:test';
import assert from 'node:assert/strict';
import { groups, surfaceOf, tangents, triplanarWeights, type SmoothMesh, type VMaterial } from '../src/index';
import { surfaceBlend } from '../src/index';
const mat = (r: number, g: number, b: number): VMaterial => ({ color: [r, g, b], alpha: 1, roughness: 0.8, metalness: 0, emissive: 0 });
const surfaces = [{ id: 0, name: 'grass', color: [0.2, 0.6, 0.2] as [number, number, number] }, { id: 1, name: 'rock', color: [0.5, 0.5, 0.5] as [number, number, number] }];
const quad: SmoothMesh = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]),
  normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
  paletteIndex: new Uint8Array([0, 0, 1, 1]),
  indices: new Uint32Array([0, 2, 1, 0, 3, 2]),
};
test('nearest colour picks the surface', () => {
  assert.deepEqual(surfaceOf([mat(0.1, 0.7, 0.1), mat(0.45, 0.45, 0.5)], surfaces), [0, 1]);
});
test('an up normal is all y weight, and its tangent is +x', () => {
  const w = triplanarWeights(quad, 4);
  assert.deepEqual([...w.slice(0, 3)], [0, 1, 0]);
  const t = tangents(quad);
  assert.ok(Math.abs(t[0]! - 1) < 1e-6 && Math.abs(t[1]!) < 1e-6 && Math.abs(t[2]!) < 1e-6);
  assert.ok(t[3] === 1 || t[3] === -1);
});
test('groups keep every triangle', () => {
  const g = groups(quad, [0, 1]);
  assert.equal(g.indices.length, 6);
  assert.equal(g.groups.reduce((s, x) => s + x.count, 0), 6);
});

test('explicit mappings override colour and special material rules', () => {
  const specialSurfaces = [
    { id: 4, name: 'grass', color: [0.2, 0.6, 0.2] as [number, number, number] },
    { id: 7, name: 'metal', color: [0.5, 0.5, 0.5] as [number, number, number] },
    { id: 9, name: 'glow', color: [1, 0.2, 0.1] as [number, number, number] },
  ];
  const metal = { ...mat(0.2, 0.6, 0.2), metalness: 1 };
  const glow = { ...mat(0.2, 0.6, 0.2), emissive: 1 };
  assert.deepEqual(surfaceOf([metal, glow], specialSurfaces), [7, 9]);
  assert.deepEqual(surfaceOf([metal], specialSurfaces, { 0: 4 }), [4]);
});

test('tangents are orthogonal and unit length', () => {
  const mesh: SmoothMesh = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([1, 1, 1, 0, 0, 1, 1, 0, 0]),
    paletteIndex: new Uint8Array([0, 0, 0]),
    indices: new Uint32Array([0, 1, 2]),
  };
  const result = tangents(mesh);
  for (let vertex = 0; vertex < 3; vertex += 1) {
    const normalOffset = vertex * 3;
    const tangentOffset = vertex * 4;
    const nx = mesh.normals[normalOffset]!;
    const ny = mesh.normals[normalOffset + 1]!;
    const nz = mesh.normals[normalOffset + 2]!;
    const tx = result[tangentOffset]!;
    const ty = result[tangentOffset + 1]!;
    const tz = result[tangentOffset + 2]!;
    assert.ok(Math.abs(nx * tx + ny * ty + nz * tz) < 1e-5);
    assert.ok(Math.abs(Math.hypot(tx, ty, tz) - 1) < 1e-5);
    assert.ok(result[tangentOffset + 3] === 1 || result[tangentOffset + 3] === -1);
  }
});

test('groups are surface ordered and retain triangle order', () => {
  const mesh: SmoothMesh = {
    positions: new Float32Array(18),
    normals: new Float32Array(18),
    paletteIndex: new Uint8Array([0, 1, 1, 0, 0, 0]),
    indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
  };
  const result = groups(mesh, [10, 20]);
  assert.deepEqual(result.groups, [
    { surface: 10, start: 0, count: 3 },
    { surface: 20, start: 3, count: 3 },
  ]);
  assert.deepEqual([...result.indices], [3, 4, 5, 0, 1, 2]);
});

test('surface blend splits a border and stays pure inside', () => {
  const blend = surfaceBlend(quad, [0, 1]);
  const borderWeights = [...blend.weights.slice(0, 4)];
  assert.equal(borderWeights[0]! > 0, true);
  assert.equal(borderWeights[1]! > 0, true);
  assert.equal(borderWeights[2]! + borderWeights[3]!, 1);
  assert.equal(blend.ids[0], 0);
  assert.equal(blend.ids[1], 1);
  const inside = surfaceBlend({ ...quad, paletteIndex: new Uint8Array([0, 0, 0, 0]) }, [0, 1]);
  assert.equal(inside.ids[0], 0);
  assert.equal(inside.weights[0], 1);
  assert.equal(inside.weights[1], 0);
});