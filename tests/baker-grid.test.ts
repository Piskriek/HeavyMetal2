/**
 * The light bake: rays test only the triangles along their path (a grid) and give exactly the answers
 * testing every triangle gave; the editor bakes in a worker behind a progress window, once per model.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TriangleGrid, occludedBrute, bakeVertexLighting } from '../src/game/bake/vertex-baker';

/** A bumpy sheet with a few boxes on it: plenty of occlusion, ~20k triangles. */
function scene() {
  const positions: number[] = []; const indices: number[] = [];
  const N = 90;
  for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) positions.push(x * 20, Math.sin(x * 0.3) * 30 + Math.cos(z * 0.21) * 25, z * 20);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const a = z * (N + 1) + x;
    indices.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2);
  }
  return { name: 'test', positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

function pack(mesh: ReturnType<typeof scene>) {
  const p = mesh.positions, f = mesh.indices;
  const tri = new Float64Array((f.length / 3) * 9);
  for (let t = 0, k = 0; t < f.length; t += 3, k += 9) {
    const a = f[t] * 3, b = f[t + 1] * 3, c = f[t + 2] * 3;
    for (let ax = 0; ax < 3; ax++) { tri[k + ax] = p[a + ax]; tri[k + 3 + ax] = p[b + ax] - p[a + ax]; tri[k + 6 + ax] = p[c + ax] - p[a + ax]; }
  }
  return tri;
}

test('the grid finds exactly the hits that testing every triangle finds', () => {
  const tri = pack(scene());
  const grid = new TriangleGrid(tri);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let hits = 0;
  for (let i = 0; i < 3000; i++) {
    const o = [rnd() * 1800, rnd() * 200 - 60, rnd() * 1800];
    let d = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]; const l = Math.hypot(d[0], d[1], d[2]); d = d.map((v) => v / l);
    const maxT = i % 3 === 0 ? 1e6 : 400;
    const want = occludedBrute(tri, o[0], o[1], o[2], d[0], d[1], d[2], maxT);
    assert.equal(grid.occluded(o[0], o[1], o[2], d[0], d[1], d[2], maxT), want, `ray ${i}`);
    if (want) hits++;
  }
  assert.ok(hits > 300, `the test really hits things (${hits})`);
});

test('a big model bakes in well under a second', () => {
  const t0 = performance.now();
  const result = bakeVertexLighting(scene(), undefined, () => {});
  const ms = performance.now() - t0;
  assert.equal(result.colors.length, scene().positions.length);
  assert.ok(ms < 4000, `took ${ms.toFixed(0)} ms`);
});

test('the editor bakes in a worker behind a progress window, each shared geometry once', () => {
  const b = readFileSync(new URL('../src/game/track-builder-3d.ts', import.meta.url), 'utf8');
  assert.match(b, /new Worker\(new URL\('\.\/bake\/bake-worker\.ts', import\.meta\.url\), \{ type: 'module' \}\)/);
  assert.match(b, /const geometries = new Map<THREE\.BufferGeometry, THREE\.Mesh\[\]>\(\)/);
  const ui = readFileSync(new URL('../src/components/TrackBuilderUI.tsx', import.meta.url), 'utf8');
  assert.match(ui, /role="alertdialog" aria-label="Baking lights"/);
});
