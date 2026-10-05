import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLEND_SLOTS,
  NO_SURFACE,
  groups,
  surfaceBlend,
  surfaceOf,
  tangents,
  triplanarWeights,
  type SmoothMesh,
  type Surface,
  type VMaterial,
  type Vec3,
} from '../src/index';

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

/* ------------------------------------------------- extra fixtures & helpers */

const toySurfaces: Surface[] = [
  { id: 0, name: 'grass', color: [0.2, 0.6, 0.2] },
  { id: 1, name: 'rock', color: [0.5, 0.5, 0.5] },
  { id: 2, name: 'wood', color: [0.55, 0.35, 0.18] },
  { id: 3, name: 'metal', color: [0.8, 0.82, 0.85] },
  { id: 4, name: 'glow', color: [1, 0.85, 0.3] },
];

const shiny = (r: number, g: number, b: number): VMaterial => ({ color: [r, g, b], alpha: 1, roughness: 0.25, metalness: 1, emissive: 0 });
const glowing = (r: number, g: number, b: number): VMaterial => ({ color: [r, g, b], alpha: 1, roughness: 0.5, metalness: 0, emissive: 1 });

/** Flat grid strip on y = 0, palette 0 left of `splitAtCol`, palette 1 on and right of it. */
function gridStrip(cols: number, rows: number, splitAtCol: number): SmoothMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const paletteIndex: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      positions.push(c, 0, r);
      normals.push(0, 1, 0);
      paletteIndex.push(c < splitAtCol ? 0 : 1);
    }
  }
  const stride = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v00 = r * stride + c;
      const v10 = v00 + 1;
      const v01 = v00 + stride;
      const v11 = v01 + 1;
      indices.push(v00, v11, v10, v00, v01, v11);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    paletteIndex: new Uint8Array(paletteIndex),
    indices: new Uint32Array(indices),
  };
}

/** A mesh that only carries normals, for tangent maths. */
function normalSoup(list: readonly Vec3[]): SmoothMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const n of list) {
    positions.push(0, 0, 0);
    normals.push(n[0], n[1], n[2]);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    paletteIndex: new Uint8Array(list.length),
    indices: new Uint32Array(0),
  };
}

const triKey = (a: number, b: number, c: number): string => [a, b, c].sort((x, y) => x - y).join('/');

function triangleSet(indices: ArrayLike<number>): string[] {
  const out: string[] = [];
  for (let t = 0; t < Math.floor(indices.length / 3); t++) {
    out.push(triKey(indices[t * 3] ?? 0, indices[t * 3 + 1] ?? 0, indices[t * 3 + 2] ?? 0));
  }
  return out.sort();
}

function unit(n: Vec3): Vec3 {
  const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
  return [n[0] / len, n[1] / len, n[2] / len];
}

/* ------------------------------------------------------------ surface mapping */

test('an explicit map wins over the nearest colour', () => {
  assert.deepEqual(surfaceOf([mat(0.1, 0.7, 0.1)], surfaces, { 0: 1 }), [1]);
});

test('an explicit map wins over metal and glow', () => {
  assert.deepEqual(surfaceOf([shiny(0.8, 0.8, 0.8), glowing(1, 0.9, 0.4)], toySurfaces, { 0: 2, 1: 1 }), [2, 1]);
});

test('metalness above 0.5 picks the metal surface, emissive above 0.5 picks glow', () => {
  const mapped = surfaceOf([shiny(0.2, 0.6, 0.2), glowing(0.2, 0.6, 0.2), mat(0.2, 0.6, 0.2)], toySurfaces);
  assert.deepEqual(mapped, [3, 4, 0]);
});

test('metal and glow only apply when the game has such a surface', () => {
  assert.deepEqual(surfaceOf([shiny(0.5, 0.5, 0.5), glowing(0.5, 0.5, 0.5)], surfaces), [1, 1]);
});

test('a palette with no surfaces maps to the sentinel', () => {
  assert.deepEqual(surfaceOf([mat(0.1, 0.2, 0.3)], []), [NO_SURFACE]);
});

/* ---------------------------------------------------------- triplanar weights */

test('triplanar weights sum to one and sharpen with the exponent', () => {
  const soup = normalSoup([unit([0.8, 0.5, 0.33])]);
  const soft = triplanarWeights(soup, 1);
  const hard = triplanarWeights(soup, 8);
  const sum = (w: Float32Array): number => w[0]! + w[1]! + w[2]!;
  assert.ok(Math.abs(sum(soft) - 1) < 1e-6);
  assert.ok(Math.abs(sum(hard) - 1) < 1e-6);
  assert.ok(hard[0]! > soft[0]!);
  assert.ok(hard[2]! < soft[2]!);
});

test('sharpness below one is clamped, and a zero normal splits evenly', () => {
  const soup = normalSoup([[0, 0, 1], [0, 0, 0]]);
  const clamped = triplanarWeights(soup, 0.25);
  assert.ok(Math.abs(clamped[2]! - 1) < 1e-6);
  const flat = triplanarWeights(soup, 4);
  assert.ok(Math.abs(flat[3]! - 1 / 3) < 1e-6 && Math.abs(flat[4]! - 1 / 3) < 1e-6 && Math.abs(flat[5]! - 1 / 3) < 1e-6);
});

test('weights and tangents are sized per vertex', () => {
  assert.equal(triplanarWeights(quad, 2).length, 4 * 3);
  assert.equal(tangents(quad).length, 4 * 4);
});

/* ------------------------------------------------------------------ tangents */

test('tangents are unit length, orthogonal to the normal and signed', () => {
  const list: Vec3[] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    [0.577, 0.577, 0.577], [-0.4, 0.8, -0.45], [0, 0.7071, 0.7071], [0.9, 0.43, 0.02],
  ];
  const soup = normalSoup(list);
  const t = tangents(soup);
  for (let v = 0; v < list.length; v++) {
    const n = unit(list[v]!);
    const tan: Vec3 = [t[v * 4]!, t[v * 4 + 1]!, t[v * 4 + 2]!];
    const len = Math.sqrt(tan[0] * tan[0] + tan[1] * tan[1] + tan[2] * tan[2]);
    assert.ok(Math.abs(len - 1) < 1e-5, `tangent ${v} not unit length: ${len}`);
    const d = Math.abs(tan[0] * n[0] + tan[1] * n[1] + tan[2] * n[2]);
    assert.ok(d < 1e-5, `tangent ${v} not orthogonal: ${d}`);
    const w = t[v * 4 + 3]!;
    assert.ok(w === 1 || w === -1, `handedness ${v} is ${w}`);
  }
});

test('the tangent follows the dominant plane U axis', () => {
  const soup = normalSoup([[0, 0, 1], [1, 0, 0]]);
  const t = tangents(soup);
  // z dominant -> U = x
  assert.ok(Math.abs(t[0]! - 1) < 1e-6 && Math.abs(t[1]!) < 1e-6 && Math.abs(t[2]!) < 1e-6);
  // x dominant -> U = z
  assert.ok(Math.abs(t[4]!) < 1e-6 && Math.abs(t[5]!) < 1e-6 && Math.abs(t[6]! - 1) < 1e-6);
});

/* -------------------------------------------------------------------- groups */

test('a two-surface strip gives two groups with every triangle kept', () => {
  const strip = gridStrip(4, 2, 2);
  const g = groups(strip, [0, 1]);
  assert.equal(g.indices.length, strip.indices.length);
  assert.equal(g.groups.length, 2);
  assert.deepEqual(g.groups.map((x) => x.surface), [0, 1]);
  assert.equal(g.groups[0]!.start, 0);
  assert.equal(g.groups[1]!.start, g.groups[0]!.count);
  assert.equal(g.groups[0]!.count + g.groups[1]!.count, g.indices.length);
  assert.ok(g.groups[0]!.count > 0 && g.groups[1]!.count > 0);
  assert.deepEqual(triangleSet(g.indices), triangleSet(strip.indices));

  // every triangle really sits in the group of its majority surface
  const surf = (v: number): number => (strip.paletteIndex[v] === 0 ? 0 : 1);
  for (const group of g.groups) {
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const votes = [surf(g.indices[i]!), surf(g.indices[i + 1]!), surf(g.indices[i + 2]!)];
      const majority = votes[1] === votes[2] ? votes[1]! : votes[0]!;
      assert.equal(majority, group.surface);
    }
  }
});

test('a triangle whose three vertices disagree goes to the first vertex', () => {
  const tri: SmoothMesh = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    paletteIndex: new Uint8Array([0, 1, 2]),
    indices: new Uint32Array([0, 1, 2]),
  };
  const g = groups(tri, [5, 7, 9]);
  assert.deepEqual(g.groups, [{ surface: 5, start: 0, count: 3 }]);
  assert.deepEqual([...g.indices], [0, 1, 2]);
});

test('groups are emitted in ascending surface id order', () => {
  const strip = gridStrip(3, 1, 2);
  // palette 0 -> surface 9 (right side of the ids), palette 1 -> surface 2
  const g = groups(strip, [9, 2]);
  assert.deepEqual(g.groups.map((x) => x.surface), [2, 9]);
  assert.equal(g.groups.reduce((s, x) => s + x.count, 0), g.indices.length);
});

test('an empty mesh yields no indices and no groups', () => {
  const empty: SmoothMesh = {
    positions: new Float32Array(0),
    normals: new Float32Array(0),
    paletteIndex: new Uint8Array(0),
    indices: new Uint32Array(0),
  };
  assert.deepEqual(groups(empty, []), { indices: new Uint32Array(0), groups: [] });
  assert.equal(triplanarWeights(empty, 2).length, 0);
  assert.equal(tangents(empty).length, 0);
  assert.deepEqual(surfaceBlend(empty, []), { ids: new Uint8Array(0), weights: new Float32Array(0) });
});

/* ------------------------------------------------------------- surface blend */

test('surfaceBlend is split at a border vertex and pure inside', () => {
  const strip = gridStrip(4, 2, 2);
  const blend = surfaceBlend(strip, [0, 1]);
  assert.equal(blend.ids.length, 15 * BLEND_SLOTS);

  // border vertex: row 1, col 2 -> touches palette 0 (col 1) and palette 1 (col 3)
  const border = 1 * 5 + 2;
  const bIds = [...blend.ids.slice(border * BLEND_SLOTS, border * BLEND_SLOTS + BLEND_SLOTS)];
  const bW = [...blend.weights.slice(border * BLEND_SLOTS, border * BLEND_SLOTS + BLEND_SLOTS)];
  assert.deepEqual(bIds.slice(0, 2), [1, 0]);
  assert.ok(bW[0]! > 0 && bW[1]! > 0, 'border vertex is not split');
  assert.ok(bW[0]! < 1, 'border vertex is dominated by one surface');
  assert.ok(Math.abs(bW[0]! + bW[1]! - 1) < 1e-6);
  assert.ok(bW[0]! >= bW[1]!, 'weights must be largest first');

  // interior vertex: row 1, col 0 -> one-ring is all palette 0
  const inside = 1 * 5 + 0;
  const iIds = [...blend.ids.slice(inside * BLEND_SLOTS, inside * BLEND_SLOTS + BLEND_SLOTS)];
  const iW = [...blend.weights.slice(inside * BLEND_SLOTS, inside * BLEND_SLOTS + BLEND_SLOTS)];
  assert.deepEqual(iIds, [0, NO_SURFACE, NO_SURFACE, NO_SURFACE]);
  assert.deepEqual(iW, [1, 0, 0, 0]);
});

test('surfaceBlend weights sum to one at every vertex', () => {
  const strip = gridStrip(4, 2, 2);
  const blend = surfaceBlend(strip, [0, 1]);
  for (let v = 0; v < 15; v++) {
    let total = 0;
    let previous = Number.POSITIVE_INFINITY;
    for (let s = 0; s < BLEND_SLOTS; s++) {
      const w = blend.weights[v * BLEND_SLOTS + s]!;
      const id = blend.ids[v * BLEND_SLOTS + s]!;
      if (w === 0) assert.equal(id, NO_SURFACE);
      assert.ok(w <= previous + 1e-7, 'weights must be sorted largest first');
      previous = w;
      total += w;
    }
    assert.ok(Math.abs(total - 1) < 1e-6, `vertex ${v} weights sum to ${total}`);
  }
});

/* -------------------------------------------------------------- no mutation */

test('inputs are never mutated', () => {
  const palette: VMaterial[] = [mat(0.1, 0.7, 0.1), mat(0.45, 0.45, 0.5)];
  const explicit = { 0: 1 };
  const snapshot = {
    palette: JSON.stringify(palette),
    explicit: JSON.stringify(explicit),
    surfaces: JSON.stringify(surfaces),
    positions: quad.positions.slice(),
    normals: quad.normals.slice(),
    paletteIndex: quad.paletteIndex.slice(),
    indices: quad.indices.slice(),
  };

  surfaceOf(palette, surfaces, explicit);
  triplanarWeights(quad, 3);
  tangents(quad);
  groups(quad, [0, 1]);
  surfaceBlend(quad, [0, 1]);

  assert.equal(JSON.stringify(palette), snapshot.palette);
  assert.equal(JSON.stringify(explicit), snapshot.explicit);
  assert.equal(JSON.stringify(surfaces), snapshot.surfaces);
  assert.deepEqual(quad.positions, snapshot.positions);
  assert.deepEqual(quad.normals, snapshot.normals);
  assert.deepEqual(quad.paletteIndex, snapshot.paletteIndex);
  assert.deepEqual(quad.indices, snapshot.indices);
});