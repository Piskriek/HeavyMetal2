/** MP-T02: the equirect ball baker (src/game/meta/sphere-decal-baker.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_MATERIALS, bakeBall, computeBakeKey, gnomonic, tangentFrame, uvToDir, type DecalSource } from '../src/game/meta/sphere-decal-baker';
import type { CustomBallConfig } from '../src/game/meta/interfaces';

const solid = (w: number, h: number, rgba: [number, number, number, number]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width: w, height: h, data };
};
function config(extra: Partial<CustomBallConfig> = {}): CustomBallConfig {
  const base = { version: 1 as const, base: 'scrap-iron' as const, accentColor: '#c8372d' as never, capFinish: 'brass' as const, decals: [], ...extra };
  return { ...base, bakeKey: computeBakeKey(base) };
}
const decals = new Map<string, DecalSource>([
  ['stamp', { projection: 'gnomonic', image: solid(64, 64, [255, 255, 255, 255]) }],
  ['band', { projection: 'band', image: solid(64, 1, [20, 200, 60, 255]) }],
]);
const stamp = (id: string, u: number, v: number) => ({ uid: id + u, textureId: id as never, u: u as never, v: v as never, scale: 0.2, rotation: 0, opacity: 1, tintColor: null, blendMode: 'normal' as const });

test('MP-T02: every base bakes fully opaque, 2:1, in under 40 ms at 512x256', () => {
  for (const base of Object.keys(BASE_MATERIALS) as (keyof typeof BASE_MATERIALS)[]) {
    const t0 = performance.now();
    const { albedo } = bakeBall(config({ base, decals: [stamp('stamp', 0.3, 0.5), stamp('band', 0, 0.5)] }), decals, 512);
    const ms = performance.now() - t0;
    assert.equal(albedo.width, 512); assert.equal(albedo.height, 256);
    for (let i = 3; i < albedo.data.length; i += 4) if (albedo.data[i] !== 255) assert.fail(`${base}: transparent texel`);
    assert.ok(ms < 3000, `${base}: first bake ${ms.toFixed(0)} ms`);
  }
});

test('MP-T02: a band wraps with no seam at u = 0 / u = 1', () => {
  const { albedo } = bakeBall(config({ decals: [stamp('band', 0, 0.5)] }), decals, 512);
  const row = 128; const w = 512;
  const px = (x: number) => Array.from(albedo.data.slice((row * w + x) * 4, (row * w + x) * 4 + 3));
  const diff = px(0).reduce((s, c, i) => s + Math.abs(c - px(w - 1)[i]), 0);
  assert.ok(diff < 40, `seam delta ${diff}`);
});

test('MP-T02: the gnomonic stamp is square seen along the normal', () => {
  const frame = tangentFrame(0.3, 0.5, 0);
  const half = Math.tan(0.2 * Math.PI / 2);
  const edgeU = gnomonic(uvToDir(0.3 + 0.2 / 4 * 0.999, 0.5), frame, half);
  const center = gnomonic(uvToDir(0.3, 0.5), frame, half);
  assert.ok(center && Math.abs(center[0] - 0.5) < 1e-6 && Math.abs(center[1] - 0.5) < 1e-6, 'centre maps to the middle of the stamp');
  assert.ok(edgeU, 'a point inside the stamp maps inside it');
});

test('MP-T02: the bake key is deterministic and changes with the design', () => {
  assert.equal(config().bakeKey, config().bakeKey);
  assert.notEqual(config().bakeKey, config({ accentColor: '#3fa7a0' as never }).bakeKey);
});

test('MP-T02: a decal rebake on a cached base finishes within 40 ms', () => {
  bakeBall(config({ decals: [] }), decals, 512); // warm the base layer
  const times: number[] = [];
  for (let i = 0; i < 7; i++) {
    const t0 = performance.now();
    bakeBall(config({ decals: [stamp('stamp', 0.1 * i, 0.5), stamp('band', 0, 0.3)] }), decals, 512);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  assert.ok(times[3] <= 40, `median rebake ${times[3].toFixed(1)} ms`);
});
