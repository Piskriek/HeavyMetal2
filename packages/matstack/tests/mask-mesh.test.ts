import test from 'node:test';
import assert from 'node:assert/strict';
import { curvatureMasks, edgeLines, lineDistance, maskAttributes, segmentDistance, EDGE_BAND, EDGE_LINES, FAR, type MaskMesh, type MaskMeshInput } from '../src/index';

type V3 = [number, number, number];

/** A mesh from convex quads (counter-clockwise from outside), each with its own corners, fan-triangulated: like partgen. */
function quads(qs: V3[][], slot = 'body'): MaskMeshInput {
  const pos: number[] = [], idx: number[] = [], uv: number[] = [];
  for (const q of qs) {
    const base = pos.length / 3;
    for (const p of q) {
      pos.push(...p);
      uv.push(p[0], p[2]);
    }
    for (let i = 1; i + 1 < q.length; i++) idx.push(base, base + i, base + i + 1);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx), uvs: new Float32Array(uv), slots: [{ name: slot, start: 0, count: idx.length }] };
}

const cube = (s = 1): MaskMeshInput =>
  quads([
    [[0, 0, s], [s, 0, s], [s, s, s], [0, s, s]],
    [[s, 0, 0], [0, 0, 0], [0, s, 0], [s, s, 0]],
    [[s, 0, s], [s, 0, 0], [s, s, 0], [s, s, s]],
    [[0, 0, 0], [0, 0, s], [0, s, s], [0, s, 0]],
    [[0, s, s], [s, s, s], [s, s, 0], [0, s, 0]],
    [[0, 0, 0], [s, 0, 0], [s, 0, s], [0, 0, s]],
  ]);

/** What the shader reads at point p: each line distance interpolated in the triangle that holds it, the smallest kept, capped at the band. */
function sampleAt(m: MaskMesh, p: V3, attr: 'edge' | 'cavity'): number {
  const P = (i: number): V3 => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!];
  let best: { d: number; v: number } | null = null;
  for (let i = 0; i + 2 < m.indices.length; i += 3) {
    const ia = m.indices[i]!, ib = m.indices[i + 1]!, ic = m.indices[i + 2]!;
    const a = P(ia), b = P(ib), c = P(ic);
    const v0 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v2 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const d = (x: number[], y: number[]): number => x[0]! * y[0]! + x[1]! * y[1]! + x[2]! * y[2]!;
    const d00 = d(v0, v0), d01 = d(v0, v1), d11 = d(v1, v1), d20 = d(v2, v0), d21 = d(v2, v1);
    const den = d00 * d11 - d01 * d01;
    if (Math.abs(den) < 1e-14) continue;
    const wb = (d11 * d20 - d01 * d21) / den, wc = (d00 * d21 - d01 * d20) / den, wa = 1 - wb - wc;
    if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
    const q = [a[0] * wa + b[0] * wb + c[0] * wc, a[1] * wa + b[1] * wb + c[1] * wc, a[2] * wa + b[2] * wb + c[2] * wc];
    const off = Math.hypot(q[0]! - p[0], q[1]! - p[1], q[2]! - p[2]);
    const lines = [0, 1, 2, 3].map((k) => m[attr][ia * EDGE_LINES + k]! * wa + m[attr][ib * EDGE_LINES + k]! * wb + m[attr][ic * EDGE_LINES + k]! * wc);
    const v = Math.min(EDGE_BAND, lineDistance(lines));
    if (!best || off < best.d) best = { d: off, v };
  }
  assert.ok(best && best.d < 1e-5, `no triangle holds ${p}`);
  return best.v;
}

function area(m: { positions: Float32Array; indices: Uint32Array }): number {
  let s = 0;
  for (let i = 0; i + 2 < m.indices.length; i += 3) {
    const g = (k: number): V3 => [m.positions[k * 3]!, m.positions[k * 3 + 1]!, m.positions[k * 3 + 2]!];
    const a = g(m.indices[i]!), b = g(m.indices[i + 1]!), c = g(m.indices[i + 2]!);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    s += Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) / 2;
  }
  return s;
}

const close = (a: number, b: number, eps: number, what = ''): void => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} != ${b}`);

test('segment distance clamps to the ends', () => {
  close(segmentDistance([0.5, 1, 0], [0, 0, 0], [1, 0, 0]), 1, 1e-12);
  close(segmentDistance([2, 0, 0], [0, 0, 0], [1, 0, 0]), 1, 1e-12);
});

test('a cube: every edge wears, the middles of the faces do not, exactly, with the same triangles', () => {
  const m = edgeLines(cube());
  close(area(m), 6, 1e-6, 'area');
  assert.equal(m.indices.length, cube().indices.length);
  assert.equal(m.edge.length, (m.positions.length / 3) * EDGE_LINES);
  for (const v of m.edge) assert.ok(v >= 0);
  for (const v of m.cavity) assert.equal(v, FAR, 'a cube has no creases');
  close(sampleAt(m, [0.5, 1, 0.5], 'edge'), EDGE_BAND, 1e-6, 'top middle');
  close(sampleAt(m, [0.5, 1, 0.98], 'edge'), 0.02, 1e-4, '2 cm from the top front edge');
  close(sampleAt(m, [1, 0.5, 0.99], 'edge'), 0.01, 1e-4, '1 cm from a vertical edge');
  close(sampleAt(m, [0.97, 1, 0.97], 'edge'), 0.03, 1e-6, 'near a corner');
  close(sampleAt(m, [0.99, 1, 0.96], 'edge'), 0.01, 1e-6, 'near a corner, closer to one side');
  // the box UV comes along
  assert.equal(m.uvs.length, (m.positions.length / 3) * 2);
  assert.equal(m.slots[0]!.name, 'body');
  assert.equal(m.slots[0]!.count, m.indices.length);
});

test('a long face cut along its diagonal still wears along all four sides (no missing wedge)', () => {
  // one 1 m x 0.1 m quad facing up, open on all sides, triangulated (0,0)-(1,0)-(1,0.1) and (0,0)-(1,0.1)-(0,0.1)
  const m = edgeLines(quads([[[0, 0, 0.1], [1, 0, 0.1], [1, 0, 0], [0, 0, 0]]]));
  close(sampleAt(m, [0.9, 0, 0.01], 'edge'), 0.01, 1e-4, 'near the z=0 side, far end');
  close(sampleAt(m, [0.1, 0, 0.09], 'edge'), 0.01, 1e-4, 'near the z=0.1 side, near end');
  close(sampleAt(m, [0.5, 0, 0.05], 'edge'), 0.05, 1e-4, 'the middle');
});

test('a floor meeting a wall is a crease: cavity near the valley, edge along the open borders', () => {
  const m = edgeLines(quads([
    [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]], // floor, facing up
    [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]], // wall at x = 0, facing +x
  ]));
  close(sampleAt(m, [0.02, 0, 0.5], 'cavity'), 0.02, 1e-4, 'floor beside the crease');
  close(sampleAt(m, [0, 0.03, 0.5], 'cavity'), 0.03, 1e-4, 'wall above the crease');
  close(sampleAt(m, [0.5, 0, 0.5], 'cavity'), EDGE_BAND, 1e-6);
  close(sampleAt(m, [0.98, 0, 0.5], 'edge'), 0.02, 1e-4, 'the open far border of the floor');
  close(sampleAt(m, [0.02, 0, 0.5], 'edge'), EDGE_BAND, 1e-6, 'the crease is not an edge');
});

test('a coplanar diagonal is never an edge', () => {
  const m = edgeLines(quads([[[0, 0, 2], [2, 0, 2], [2, 0, 0], [0, 0, 0]]]));
  close(sampleAt(m, [1, 0, 1], 'edge'), EDGE_BAND, 1e-6);
});

test('dense meshes take the curvature way: a tight ball reads as all edge, a big one as nearly flat', () => {
  const sphere = (r: number, seg: number): MaskMeshInput => {
    const pos: number[] = [], idx: number[] = [];
    const rings = seg / 2;
    for (let i = 0; i <= rings; i++) {
      const th = (i / rings) * Math.PI;
      for (let j = 0; j <= seg; j++) {
        const ph = (j / seg) * Math.PI * 2;
        pos.push(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph));
      }
    }
    const w = seg + 1;
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
      const a = i * w + j, b = a + w;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
  };
  const tight = maskAttributes(sphere(0.02, 32));
  const mid = Math.floor(tight.positions.length / 6);
  close(lineDistance(tight.edge, mid), 0, 1e-6, 'radius 2 cm');
  close(lineDistance(tight.cavity, mid), EDGE_BAND, 1e-6);
  assert.equal(tight.indices.length, sphere(0.02, 32).indices.length, 'curvature keeps the mesh as it is');
  const big = curvatureMasks(sphere(1, 96));
  const bm = Math.floor(big.positions.length / 6);
  close(lineDistance(big.edge, bm), EDGE_BAND * (1 - EDGE_BAND), 1e-3, 'radius 1 m: k = 1');
  // a 1 m cube takes the lines way: its own three vertices per triangle
  assert.equal(maskAttributes(cube()).positions.length / 3, cube().indices.length);
});

test('deterministic', () => {
  const a = edgeLines(cube()), b = edgeLines(cube());
  assert.deepEqual([...a.edge], [...b.edge]);
  assert.deepEqual([...a.positions], [...b.positions]);
});

test('rank 0 flattens a faceted part per face: the big faces stay clean, the thin sides read as worn bevels', async () => {
  const { flattenMesh, hexToLinear } = await import('../src/index');
  const plate = (w: number, h: number, d: number): MaskMeshInput =>
    quads([
      [[0, 0, d], [w, 0, d], [w, h, d], [0, h, d]],
      [[w, 0, 0], [0, 0, 0], [0, h, 0], [w, h, 0]],
      [[w, 0, d], [w, 0, 0], [w, h, 0], [w, h, d]],
      [[0, 0, 0], [0, 0, d], [0, h, d], [0, h, 0]],
      [[0, h, d], [w, h, d], [w, h, 0], [0, h, 0]],
      [[0, 0, 0], [w, 0, 0], [w, 0, d], [0, 0, d]],
    ]);
  const mesh = edgeLines(plate(1, 0.02, 1)); // a 1 m square plate, 2 cm thick
  const flat = { sample: () => ({ grey: 0.5, height: 0.5, rough: 0.5 }) };
  const noise = { sample: () => 0.5 };
  const base = { blend: 'normal', opacity: 1, invert: false } as const;
  const steel = { name: 'paint', colour: '#3c9a5a', metal: 0, rough: 0.5, specular: 0.5 };
  const bare = { name: 'bare', colour: '#c0c0c0', metal: 1, rough: 0.3, specular: 0.5 };
  const m = {
    name: 'worn', base: steel, paint: ['#000000', '#000000'] as [string, string], age: 1,
    layers: [{
      name: 'edge wear', surface: bare, opacity: 1, writes: ['colour', 'metal', 'rough'] as const, heightBlend: 0, weathering: false, visible: true,
      mask: { name: 'edges', inputs: [{ ...base, kind: 'edge', width: 0.03 } as const], balance: 0, contrast: 1, invert: false },
    }],
  };
  const f = flattenMesh(m, mesh, flat, noise);
  const P = (i: number) => [mesh.positions[i * 3]!, mesh.positions[i * 3 + 1]!, mesh.positions[i * 3 + 2]!];
  let top = -1, side = -1;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const ys = [0, 1, 2].map((k) => P(mesh.indices[t + k]!)[1]!);
    if (ys.every((y) => Math.abs(y - 0.02) < 1e-6) && top < 0) top = mesh.indices[t]!;
    if (ys.some((y) => y < 1e-6) && ys.some((y) => y > 0.019) && side < 0) side = mesh.indices[t]!;
  }
  close(f.colour[top * 3]!, hexToLinear('#3c9a5a')[0], 1e-6, 'the big top face keeps its paint');
  close(f.metal[top]!, 0, 1e-6);
  close(f.colour[side * 3]!, hexToLinear('#c0c0c0')[0], 1e-6, 'a 2 cm side is all worn bevel');
  close(f.metal[side]!, 1, 1e-6);
  // the three corners of a face carry the same flat value
  const t0 = mesh.indices[0]!, t1 = mesh.indices[1]!;
  close(f.rough[t0]!, f.rough[t1]!, 0);
});

test('rank 0 treats a quad as one face: both triangles flatten to the same value, so no diagonal shows', async () => {
  const { flattenMesh } = await import('../src/index');
  // a 1 m x 0.1 m face, open on all sides: its two triangles see different edges up close
  const mesh = edgeLines(quads([[[0, 0, 0.1], [1, 0, 0.1], [1, 0, 0], [0, 0, 0]]]));
  const base = { blend: 'normal', opacity: 1, invert: false } as const;
  const paint = { name: 'paint', colour: '#3c9a5a', metal: 0, rough: 0.5, specular: 0.5 };
  const bare = { name: 'bare', colour: '#c0c0c0', metal: 1, rough: 0.3, specular: 0.5 };
  const m = {
    name: 'worn', base: paint, paint: ['#000000', '#000000'] as [string, string], age: 1,
    layers: [{
      name: 'edge wear', surface: bare, opacity: 1, writes: ['colour', 'metal'] as const, heightBlend: 0, weathering: false, visible: true,
      mask: { name: 'edges', inputs: [{ ...base, kind: 'edge', width: 0.04 } as const], balance: 0, contrast: 0, invert: false },
    }],
  };
  const f = flattenMesh(m, mesh, { sample: () => ({ grey: 0.5, height: 0.5, rough: 0.5 }) }, { sample: () => 0.5 });
  const first = mesh.indices[0]!, second = mesh.indices[3]!;
  assert.equal(f.metal[first], f.metal[second]);
  assert.equal(f.colour[first * 3], f.colour[second * 3]);
  assert.ok(f.metal[first]! > 0 && f.metal[first]! < 1, `a narrow face is part worn: ${f.metal[first]}`);
});
