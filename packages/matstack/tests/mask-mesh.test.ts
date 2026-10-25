import test from 'node:test';
import assert from 'node:assert/strict';
import {
  curvatureMasks,
  edgeCandidateKey,
  edgeLines,
  edgeWearScale,
  edgeWearTier,
  lineDistance,
  maskAttributes,
  segmentDistance,
  EDGE_BAND,
  EDGE_LINES,
  FAR,
  type MaskMesh,
  type MaskMeshInput,
} from '../src/index';

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

test('a face split along a straight side keeps every one of its sides: collinear pieces share a slot', () => {
  // A 6 cm square cut into a 3 x 3 grid: each outer side is three 2 cm collinear pieces, and every side is inside the 5 cm band.
  // Without deduplication a corner triangle spends two of its four slots on one side's pieces and drops a far side, so a
  // fragment near that far side reads centimetres of slack where it should read a couple of millimetres.
  const S = 0.06, N = 3;
  const positions: number[] = [], indices: number[] = [];
  const ids = new Map<string, number>();
  const id = (x: number, z: number): number => {
    const k = `${x.toFixed(5)},${z.toFixed(5)}`;
    let at = ids.get(k);
    if (at === undefined) { at = positions.length / 3; ids.set(k, at); positions.push(x, 0, z); }
    return at;
  };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x0 = (i * S) / N, x1 = ((i + 1) * S) / N, z0 = (j * S) / N, z1 = ((j + 1) * S) / N;
    const a = id(x0, z0), b = id(x1, z0), c = id(x1, z1), d = id(x0, z1);
    indices.push(a, b, c, a, c, d);
  }
  const band = 0.05;
  const mesh = edgeLines({ positions: new Float32Array(positions), indices: new Uint32Array(indices) }, { band });

  // the four outline lines, each with its inward side towards the middle
  const corners = [[0, 0], [S, 0], [S, S], [0, S]];
  const outlines = corners.map((a, k) => {
    const b = corners[(k + 1) % 4]!;
    const ex = b[0]! - a[0]!, ez = b[1]! - a[1]!, L = Math.hypot(ex, ez);
    let nx = -ez / L, nz = ex / L;
    if (nx * (S / 2 - a[0]!) + nz * (S / 2 - a[1]!) < 0) { nx = -nx; nz = -nz; }
    return { a, n: [nx, nz] as const };
  });
  const expected = (x: number, z: number): number => {
    let d = FAR;
    for (const l of outlines) {
      const v = (x - l.a[0]!) * l.n[0] + (z - l.a[1]!) * l.n[1];
      if (v >= 0 && v < d) d = v;
    }
    return d;
  };

  let worst = 0;
  for (let t = 0; t < mesh.indices.length / 3; t += 1) {
    const v = [t * 3, t * 3 + 1, t * 3 + 2];
    for (const barycentric of [[1 / 3, 1 / 3, 1 / 3], [0.8, 0.1, 0.1], [0.1, 0.8, 0.1], [0.1, 0.1, 0.8]]) {
      let px = 0, pz = 0;
      for (let k = 0; k < 3; k++) {
        px += mesh.positions[v[k]! * 3]! * barycentric[k]!;
        pz += mesh.positions[v[k]! * 3 + 2]! * barycentric[k]!;
      }
      let actual = FAR;
      for (let slot = 0; slot < EDGE_LINES; slot += 1) {
        let d = 0;
        for (let k = 0; k < 3; k++) {
          const value = mesh.edge[v[k]! * EDGE_LINES + slot]!;
          d += (value >= 0 && value < FAR - 1 ? value : FAR) * barycentric[k]!;
        }
        actual = Math.min(actual, d);
      }
      worst = Math.max(worst, actual - expected(px, pz));
    }
  }
  assert.ok(worst < 1e-6, `a fragment read ${(worst * 1000).toFixed(2)} mm of slack where a side should be`);
});

test('a subdivided quad keeps all four of its sides: half-segments of one side share a slot', () => {
  // The 22 October review's case, in its smallest form: an 8 x 4 cm plate cut into two quads (four triangles). The bottom and the top
  // sides are each two collinear 4 cm halves, and every side is inside the 5 cm band of the corner triangles. Without deduplication the
  // first triangle spends two of its four EDGE_LINES on the two halves of the bottom side and drops the right side, so a fragment near
  // that side reads centimetres of slack where it should read a couple of millimetres.
  const W = 0.08, D = 0.04;
  const positions = new Float32Array([
    0, 0, 0, W / 2, 0, 0, W / 2, 0, D, 0, 0, D, // left quad: origin, mid-bottom, mid-top, top-left
    W, 0, 0, W, 0, D, // right quad: bottom-right, top-right
  ]);
  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3, // left quad, split on its diagonal
    1, 4, 5, 1, 5, 2, // right quad
  ]);
  const band = 0.05;
  const mesh = edgeLines({ positions, indices }, { band });

  // the four outline lines, each with its inward side towards the plate's middle
  const outline: { a: readonly [number, number]; n: readonly [number, number] }[] = [
    { a: [0, 0], n: [0, 1] }, // bottom
    { a: [W, 0], n: [-1, 0] }, // right
    { a: [W, D], n: [0, -1] }, // top
    { a: [0, D], n: [1, 0] }, // left
  ];
  const expected = (x: number, z: number): number => {
    let d = FAR;
    for (const l of outline) {
      const v = (x - l.a[0]) * l.n[0] + (z - l.a[1]) * l.n[1];
      if (v >= 0 && v < d) d = v;
    }
    return d;
  };

  // No triangle may spend two of its four slots on one line: the two halves of a split side must read as one slot, or the perpendicular
  // side is the one that gets dropped. A line is identified by the distances it puts on a triangle's three vertices, so two slots that
  // agree on all three are the same physical edge, counted twice.
  for (let t = 0; t < mesh.indices.length / 3; t += 1) {
    const v = [t * 3, t * 3 + 1, t * 3 + 2];
    const lines: number[][] = [];
    for (let slot = 0; slot < EDGE_LINES; slot += 1) {
      const distances = v.map((vi) => mesh.edge[vi * EDGE_LINES + slot]!);
      if (distances.every((d) => d >= FAR - 1)) continue; // empty slot
      lines.push(distances);
    }
    for (let i = 0; i < lines.length; i += 1) {
      for (let j = i + 1; j < lines.length; j += 1) {
        const a = lines[i]!, b = lines[j]!;
        const same = a.every((d, k) => Math.abs(d - b[k]!) < 1e-5);
        assert.ok(!same, `triangle ${t} spent two slots on one line: [${a.map((d) => d.toFixed(4))}]`);
      }
    }
  }

  // every triangle must be able to read the distance to all four sides: its corner samples carry each side of the plate
  let worst = 0;
  let cornerSides = 0;
  for (let t = 0; t < mesh.indices.length / 3; t += 1) {
    const v = [t * 3, t * 3 + 1, t * 3 + 2];
    for (let k = 0; k < 3; k += 1) {
      const x = mesh.positions[v[k]! * 3]!, z = mesh.positions[v[k]! * 3 + 2]!;
      let actual = FAR;
      for (let slot = 0; slot < EDGE_LINES; slot += 1) {
        const value = mesh.edge[v[k]! * EDGE_LINES + slot]!;
        if (value >= 0 && value < FAR - 1) actual = Math.min(actual, value);
      }
      // the corner's own distance to the nearest side is what the shader reads; slack is what breaks an edge-wear mask
      worst = Math.max(worst, actual - expected(x, z));
      if (expected(x, z) < 0.005) cornerSides += 1;
    }
  }
  assert.ok(cornerSides >= 6, `expected every plate corner to be on a side, found ${cornerSides}`);
  assert.ok(worst < 1e-6, `a corner read ${(worst * 1000).toFixed(2)} mm of slack where a side should be`);

  // and the mid-bottom vertex — the joint between the two halves of one side — reads the bottom side, not a lost slot
  const mid = 1;
  let midDistance = FAR;
  for (let slot = 0; slot < EDGE_LINES; slot += 1) {
    const value = mesh.edge[mid * EDGE_LINES + slot]!;
    if (value >= 0 && value < FAR - 1) midDistance = Math.min(midDistance, value);
  }
  assert.ok(Math.abs(midDistance) < 1e-6, `the split side's joint reads ${midDistance}`);
});

// ---- Plan 42 / Argon directive 1: a shallow fold must not take the wear from a silhouette.
// A ring is the case: nine segments around an aperture give every front-face triangle 40-degree radial seams of its own, and the
// annulus must keep the convex edge wear its chamfers and rims carry (metal at the edge), not spend its band on the tessellation.

/** Two coplanar halves folded against each other by `deg` about the line y = 0 (z = 0), with a probe vertex inside one half. */
function foldedPair(deg: number): { mesh: MaskMeshInput; probe: readonly [number, number, number] } {
  const t = (deg * Math.PI) / 180;
  const pos: number[] = [], idx: number[] = [];
  const vertex = (x: number, y: number, z: number): number => pos.push(x, y, z) / 3 - 1;
  // upper half in the z = 0 plane, centre vertex 1.5 cm from the fold line and 2.5 cm from the far border
  const c = vertex(0.05, 0.015, 0);
  const a0 = vertex(0, 0, 0), a1 = vertex(0.1, 0, 0), a2 = vertex(0.1, 0.04, 0), a3 = vertex(0, 0.04, 0);
  idx.push(a0, a1, c, a1, a2, c, a2, a3, c, a3, a0, c);
  // lower half folded by `deg`
  const b2 = vertex(0.1, -0.04 * Math.cos(t), -0.04 * Math.sin(t));
  const b3 = vertex(0, -0.04 * Math.cos(t), -0.04 * Math.sin(t));
  idx.push(a1, a0, b3, a1, b3, b2);
  return { mesh: { positions: new Float32Array(pos), indices: new Uint32Array(idx) }, probe: [0.05, 0.015, 0] };
}

/** The distances a point reads in its four slots (metres), ignoring unused slots; the mask mesh gives every corner its own vertex. */
function slots(mesh: MaskMesh, probe: readonly [number, number, number]): number[] {
  const out: number[] = [];
  for (let v = 0; v < mesh.positions.length / 3; v += 1) {
    const at = v * 3;
    if (Math.abs(mesh.positions[at]! - probe[0]) > 1e-9) continue;
    if (Math.abs(mesh.positions[at + 1]! - probe[1]) > 1e-9) continue;
    if (Math.abs(mesh.positions[at + 2]! - probe[2]) > 1e-9) continue;
    for (let k = 0; k < EDGE_LINES; k += 1) {
      const d = mesh.edge[v * EDGE_LINES + k]!;
      if (d >= 0 && d < FAR - 1) out.push(d);
    }
  }
  assert.ok(out.length > 0, 'the probe point is not a vertex of the mask mesh');
  return out.sort((x, y) => x - y);
}

test('a 40-degree seam wears at 1.6x its distance, a right-angle chamfer at exactly its distance', () => {
  // the probe vertex sits 1.5 cm from the fold in both meshes: the geometric distance is 0.015
  const seam = edgeLines(foldedPair(40).mesh);
  const chamfer = edgeLines(foldedPair(90).mesh);
  const seamSlots = slots(seam, foldedPair(40).probe);
  const chamferSlots = slots(chamfer, foldedPair(90).probe);
  // 1 + 0.5 * (1 / (40/90) - 1) = 1.625: a tessellation seam's bead is 62% as wide as a right angle's
  const scaled = 0.015 * edgeWearScale((40 * Math.PI) / 180);
  assert.ok(
    seamSlots.some((d) => Math.abs(d - scaled) < 1e-6),
    `the seam reads ${seamSlots.map((d) => d.toFixed(4)).join(', ')} — expected a slot at ${scaled.toFixed(4)}`,
  );
  assert.ok(!seamSlots.some((d) => Math.abs(d - 0.015) < 1e-6), 'the shallow seam must not wear at its raw distance');
  // a right angle and beyond keep the whole band: the annulus' silhouette wear is untouched
  assert.ok(chamferSlots.some((d) => Math.abs(d - 0.015) < 1e-6), `the chamfer reads ${chamferSlots.map((d) => d.toFixed(4)).join(', ')}`);
  // and the old order is one option away, so a caller can ask for raw distances
  const raw = slots(edgeLines(foldedPair(40).mesh, { foldBias: 0 }), foldedPair(40).probe);
  assert.ok(raw.some((d) => Math.abs(d - 0.015) < 1e-6), `foldBias 0 should read the raw 0.015, got ${raw.join(', ')}`);
});

test('the wear scale and the slot tier are monotone in the fold, and both go quiet at bias 0', () => {
  const deg = (d: number): number => (d * Math.PI) / 180;
  assert.equal(edgeWearScale(deg(90)), 1);
  assert.equal(edgeWearScale(deg(120)), 1, 'a fold sharper than a right angle gains nothing more');
  assert.ok(edgeWearScale(deg(60)) > edgeWearScale(deg(70)));
  assert.ok(edgeWearScale(deg(40)) > edgeWearScale(deg(60)));
  assert.ok(edgeWearScale(deg(20)) > edgeWearScale(deg(40)));
  assert.ok(Math.abs(edgeWearScale(deg(45)) - 1.5) < 1e-12, '45 degrees wears at 1.5x its distance');
  for (const d of [10, 20, 40, 60, 90]) {
    assert.equal(edgeWearScale(deg(d), 0), 1, `bias 0 must keep raw distances at ${d} degrees`);
    assert.equal(edgeWearTier(deg(d), 0), 0, 'bias 0 is one flat tier: plain nearest-first order');
  }
  // the tier puts a silhouette ahead of any seam, however near the seam is
  assert.equal(edgeWearTier(deg(90)), 0);
  assert.equal(edgeWearTier(deg(40)), 1);
  assert.ok(
    edgeCandidateKey(0.04, deg(90)) < edgeCandidateKey(0.005, deg(40)),
    'a silhouette 4 cm away must outrank a seam 5 mm away',
  );
  // but two silhouettes still order by distance, so the nearest chamfer wins
  assert.ok(edgeCandidateKey(0.01, deg(90)) < edgeCandidateKey(0.02, deg(90)));
});
