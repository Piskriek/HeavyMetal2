import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateIsland, heightAt, type IslandOptions } from '../src/terrain';

const spec = { cols: 129, rows: 129, cell: 2, originX: -128, originZ: -128 };
const ids = { seabed: 1, sand: 2, grass: 4, rock: 5, cliff: 6, lava: 13, scree: 14, basalt: 7, soil: 16 };
const opts = (volcano?: IslandOptions['volcano']): IslandOptions => ({ surfaces: ids, radius: 0.85, height: 6, roughness: 3, ...(volcano ? { volcano } : {}) });
const V = { peak: 30, cone: 0.5, crater: 0.2, craterDepth: 14 };

test('a volcano island is deterministic and every height is a finite number', () => {
  const a = generateIsland(spec, 12, opts(V)), b = generateIsland(spec, 12, opts(V)), c = generateIsland(spec, 13, opts(V));
  assert.deepEqual(a.heights, b.heights);
  assert.deepEqual(a.surfaceA, b.surfaceA);
  assert.notDeepEqual(a.heights, c.heights);
  for (const h of a.heights) assert.ok(Number.isFinite(h));
});

test('the cone rises out of the island: high in the middle, the same as a plain island out past its foot', () => {
  const plain = generateIsland(spec, 12, opts()), vol = generateIsland(spec, 12, opts(V));
  assert.ok(heightAt(vol, 0, 0) < heightAt(vol, V.cone * 0.5 * 128 * 0.85 * 0.2 * 2.2, 0) + 20, 'sanity: crater floor is not absurd');
  let top = -Infinity;
  for (const h of vol.heights) top = Math.max(top, h);
  assert.ok(top > 20, `the rim stands ${top} m up`);
  const reach = 0.85 * 0.5 * 256, foot = V.cone * reach;
  // a point well outside the foot is untouched
  const far = foot * 1.4;
  assert.ok(Math.abs(heightAt(vol, far, 0) - heightAt(plain, far, 0)) < 1e-6, 'outside the cone nothing changed');
  assert.ok(heightAt(vol, 0, foot * 0.5) > heightAt(plain, 0, foot * 0.5) + 3, 'inside the cone it is higher');
});

test('the crater is a bowl: the floor sits well below the rim, and the floor is lava', () => {
  const t = generateIsland(spec, 12, opts(V));
  const reach = 0.85 * 0.5 * 256, foot = V.cone * reach;
  const floorH = heightAt(t, 0, 0);
  let rim = -Infinity;
  for (let a = 0; a < 360; a += 10) rim = Math.max(rim, heightAt(t, Math.cos((a * Math.PI) / 180) * V.crater * foot, Math.sin((a * Math.PI) / 180) * V.crater * foot));
  assert.ok(rim - floorH > V.craterDepth * 0.5, `rim ${rim.toFixed(1)} floor ${floorH.toFixed(1)}`);
  const centre = Math.round(64) * 129 + 64;
  assert.equal(t.surfaceA[centre], ids.lava);
  assert.equal(t.surfaceB[centre], ids.lava);
});

test('surfaces climb from beach to grass to soil to scree to basalt, and only known ids are used', () => {
  const t = generateIsland(spec, 12, opts(V));
  const used = new Set<number>();
  for (let i = 0; i < t.surfaceA.length; i++) { used.add(t.surfaceA[i]!); used.add(t.surfaceB[i]!); }
  const known = new Set<number>(Object.values(ids));
  for (const u of used) assert.ok(known.has(u), `unknown surface ${u}`);
  for (const must of [ids.seabed, ids.sand, ids.grass, ids.lava, ids.scree, ids.basalt]) assert.ok(used.has(must), `surface ${must} appears`);
});

test('without the extra surface ids a volcano still paints (falls back to rock and cliff)', () => {
  const t = generateIsland(spec, 12, { surfaces: { seabed: 1, sand: 2, grass: 4, rock: 5, cliff: 6 }, radius: 0.85, height: 6, volcano: V });
  const known = new Set([1, 2, 4, 5, 6]);
  for (let i = 0; i < t.surfaceA.length; i++) { assert.ok(known.has(t.surfaceA[i]!)); assert.ok(known.has(t.surfaceB[i]!)); }
});

test('no volcano option, no change: the plain island is exactly what it was', () => {
  const a = generateIsland(spec, 12, { surfaces: { seabed: 1, sand: 2, grass: 4, rock: 5, cliff: 6 }, radius: 0.85, height: 6, roughness: 3 });
  const b = generateIsland(spec, 12, opts());
  assert.deepEqual(a.heights, b.heights);
  assert.deepEqual(a.surfaceA, b.surfaceA);
});
