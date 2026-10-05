// tests/remesh.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { greedy, naiveFaces, toMesh, triangles, type Volume } from '../src/index';

const solid = (n: number, c = 1): Volume => ({ sx: n, sy: n, sz: n, cells: new Uint8Array(n * n * n).fill(c) });

test('a solid cube becomes six quads', () => {
  const q = greedy(solid(8));
  assert.equal(q.length, 6);
  assert.equal(naiveFaces(solid(8)), 6 * 64);
  const m = toMesh(q);
  assert.equal(triangles(m), 12);
  assert.equal(m.positions.length / 3, 24);
});

test('a single cell', () => {
  const v: Volume = { sx: 3, sy: 3, sz: 3, cells: new Uint8Array(27) };
  v.cells[13] = 5;
  const q = greedy(v);
  assert.equal(q.length, 6);
  assert.ok(q.every((x) => x.color === 5 && x.u1 - x.u0 === 1 && x.v1 - x.v0 === 1));
});

// ---- additional tests ----

// An L-shaped slab (5 cells) collapses its straight runs into big quads.
test('an L shape merges the long arms', () => {
  const v: Volume = { sx: 3, sy: 3, sz: 1, cells: new Uint8Array(9) };
  v.cells[0] = 1; v.cells[1] = 1; v.cells[2] = 1; // bottom row
  v.cells[3] = 1; v.cells[6] = 1;                  // left column
  const q = greedy(v);
  assert.equal(q.length, 10);
  assert.equal(naiveFaces(v), 22);
  // The two big "front/back" faces of the L (top and bottom) are each two
  // rectangles whose combined area equals the 5 exposed cell-faces.
  const zFaces = q.filter((x) => x.axis === 2);
  const zArea = zFaces.reduce((s, x) => s + (x.u1 - x.u0) * (x.v1 - x.v0), 0);
  assert.equal(zArea, 5);
  const m = toMesh(q);
  assert.equal(triangles(m), q.length * 2);
});

// Two adjacent solid cells with different colours must not merge.
test('two colours side by side stay separate', () => {
  const v: Volume = { sx: 2, sy: 1, sz: 1, cells: new Uint8Array(2) };
  v.cells[0] = 1; v.cells[1] = 2;
  const q = greedy(v);
  // 6 exposed faces total; every quad carries the colour of its single cell.
  assert.equal(q.length, 6);
  assert.equal(q.filter((x) => x.color === 1).length, 3);
  assert.equal(q.filter((x) => x.color === 2).length, 3);
  // No quad spans both cells.
  assert.ok(q.every((x) => (x.u1 - x.u0) * (x.v1 - x.v0) === 1));
  assert.equal(naiveFaces(v), 6);
});

// A hollow box exposes faces on both its outside and its inside walls.
test('a hollow box has inside faces', () => {
  const n = 5;
  const v: Volume = { sx: n, sy: n, sz: n, cells: new Uint8Array(n * n * n) };
  for (let z = 0; z < n; z++)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const onShell =
          x === 0 || x === n - 1 ||
          y === 0 || y === n - 1 ||
          z === 0 || z === n - 1;
        if (onShell) v.cells[z * n * n + y * n + x] = 1;
      }
  const q = greedy(v);
  // Inside walls exist: every interior cell boundary on the inner shell
  // produces a face whose normal points toward the box centre.
  const innerX = q.filter((x) =>
    x.axis === 0 && x.dir === 1 && x.plane === 0,
  );
  assert.ok(innerX.length > 0, 'expected inner +X wall quads');
  // Outer walls exist at the volume edge.
  const outerX = q.filter((x) =>
    x.axis === 0 && x.dir === 1 && x.plane === n - 2,
  );
  assert.equal(outerX.length, 1, 'outer +X wall should merge into one quad');
  // Inside + outside = every cell-face on the shell.
  assert.equal(naiveFaces(v), 6 * n * n + 6 * (n - 2) * (n - 2));
});

// Cells on the volume boundary have every outward face exposed.
test('faces at the volume edge count as exposed', () => {
  const v: Volume = { sx: 2, sy: 2, sz: 2, cells: new Uint8Array(8) };
  v.cells[0] = 7; // corner cell (0,0,0)
  const q = greedy(v);
  assert.equal(q.length, 6);
  assert.equal(naiveFaces(v), 6);
  assert.ok(q.every((x) => x.color === 7));
});

// Every quad's stored normal agrees with the winding of its first triangle
// (counter-clockwise when viewed from outside the solid).
test('normals point outward', () => {
  const v: Volume = { sx: 3, sy: 2, sz: 2, cells: new Uint8Array(12) };
  v.cells.fill(1);
  const q = greedy(v);
  const m = toMesh(q);
  const verts = m.positions;
  for (let i = 0; i < m.indices.length; i += 3) {
    const ia = m.indices[i] as number;
    const ib = m.indices[i + 1] as number;
    const ic = m.indices[i + 2] as number;
    const ax = (verts[ia * 3] as number), ay = (verts[ia * 3 + 1] as number), az = (verts[ia * 3 + 2] as number);
    const bx = (verts[ib * 3] as number), by = (verts[ib * 3 + 1] as number), bz = (verts[ib * 3 + 2] as number);
    const cx = (verts[ic * 3] as number), cy = (verts[ic * 3 + 1] as number), cz = (verts[ic * 3 + 2] as number);
    const ex = bx - ax, ey = by - ay, ez = bz - az;
    const fx = cx - ax, fy = cy - ay, fz = cz - az;
    const cxn = ey * fz - ez * fy;
    const cyn = ez * fx - ex * fz;
    const czn = ex * fy - ey * fx;
    const nx = m.normals[ia * 3] as number;
    const ny = m.normals[ia * 3 + 1] as number;
    const nz = m.normals[ia * 3 + 2] as number;
    // Dot product must be positive (same direction; magnitudes differ).
    assert.ok(cxn * nx + cyn * ny + czn * nz > 0,
      `triangle ${i / 3} winding disagrees with normal`);
  }
});

// Vertices with identical position, normal and colour are merged, but
// corners shared by faces of different normals (like the cube's 8 corners)
// must remain distinct.
test('welding merges same position/normal/colour only', () => {
  // Solid cube: 6 faces, each a 4x8 rect -> 24 corner vertices, no
  // (position, normal, colour) duplicates across faces.
  const m = toMesh(greedy(solid(4)));
  assert.equal(m.positions.length / 3, 24);
  assert.equal(triangles(m), 12);

  // Two explicitly-identical quads fed to toMesh must weld into 4 vertices.
  const dup: Volume = { sx: 1, sy: 1, sz: 1, cells: new Uint8Array(1) };
  dup.cells[0] = 3;
  const single = greedy(dup);
  const welded = toMesh([single[0] as typeof single[number], { ...(single[0] as object) } as typeof single[number]]);
  assert.equal(welded.positions.length / 3, 4);
  assert.equal(triangles(welded), 4);
});