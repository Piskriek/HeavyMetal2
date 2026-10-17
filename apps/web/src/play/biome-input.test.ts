// apps/web/src/play/biome-input.test.ts
// Unit tests for buildBiomeInput: sampling, offsets, hydro flood, and keepouts.

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBiomeInput, type BuildBiomeInputOptions } from './biome-input';

test('cell-centre sampling samples heightfield at (x0 + (x + 0.5) * cellM, z0 + (z + 0.5) * cellM) in row-major order', () => {
  const x0 = 100;
  const z0 = 200;
  const cellM = 4;
  const n = 4;

  const sampledCoords: { x: number; z: number }[] = [];
  const heightAt = (x: number, z: number): number => {
    sampledCoords.push({ x, z });
    return x * 1000 + z;
  };

  const input = buildBiomeInput({
    heightAt,
    x0,
    z0,
    n,
    cellM,
    machines: [],
    keepouts: [],
    waterSources: [],
    waterVolume: 0,
    stage: 1,
    s: { pxd: 0.5, vtx: 0.5, lx: 0.5, aq: 0.5 },
    seed: 42,
    tier: 'low',
  });

  assert.equal(input.n, n);
  assert.equal(input.cellM, cellM);
  assert.equal(input.height.length, n * n);
  assert.equal(sampledCoords.length, n * n);

  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const expectedWorldX = x0 + (x + 0.5) * cellM;
      const expectedWorldZ = z0 + (z + 0.5) * cellM;
      const idx = z * n + x;

      const sampled = sampledCoords[idx]!;
      assert.ok(Math.abs(sampled.x - expectedWorldX) < 1e-6, `sampled x at (${x},${z})`);
      assert.ok(Math.abs(sampled.z - expectedWorldZ) < 1e-6, `sampled z at (${x},${z})`);

      const expectedH = expectedWorldX * 1000 + expectedWorldZ;
      assert.ok(Math.abs(input.height[idx]! - expectedH) < 1e-4, `height at index ${idx}`);
    }
  }
});

test('machines are converted from world coordinates to grid origin frame', () => {
  const x0 = 50;
  const z0 = 75;

  const input = buildBiomeInput({
    heightAt: () => 0,
    x0,
    z0,
    n: 8,
    cellM: 2,
    machines: [
      { x: 50, z: 75, r: 3 },
      { x: 70, z: 95, r: 6 },
      { x: 30, z: 60, r: 2 },
    ],
    keepouts: [],
    waterSources: [],
    waterVolume: 0,
    stage: 2,
    s: { pxd: 1, vtx: 0, lx: 0.5, aq: 0 },
    seed: 123,
    tier: 'mid',
  });

  assert.deepEqual(input.machines, [
    { x: 0, z: 0, r: 3 },
    { x: 20, z: 20, r: 6 },
    { x: -20, z: -15, r: 2 },
  ]);
});

test('keepouts are converted from world coordinates to grid origin frame', () => {
  const x0 = 100;
  const z0 = 150;

  const input = buildBiomeInput({
    heightAt: () => 0,
    x0,
    z0,
    n: 16,
    cellM: 1,
    machines: [],
    keepouts: [
      { x0: 100, z0: 150, x1: 110, z1: 160 },
      { x0: 120, z0: 170, x1: 135, z1: 185 },
      { x0: 80, z0: 130, x1: 95, z1: 145 },
    ],
    waterSources: [],
    waterVolume: 0,
    stage: 3,
    s: { pxd: 0.2, vtx: 0.4, lx: 0.6, aq: 0.8 },
    seed: 999,
    tier: 'high',
  });

  assert.deepEqual(input.keepouts, [
    { x0: 0, z0: 0, x1: 10, z1: 10 },
    { x0: 20, z0: 20, x1: 35, z1: 35 },
    { x0: -20, z0: -20, x1: -5, z1: -5 },
  ]);
});

test('water lands in a test bowl and nowhere else', () => {
  const n = 33;
  const cellM = 2;
  const x0 = 0;
  const z0 = 0;

  // Bowl centered at world (33, 33), matching cell (16, 16) centre
  const centreX = 33;
  const centreZ = 33;
  const heightAt = (x: number, z: number): number => Math.hypot(x - centreX, z - centreZ);

  // Pour 8000 cubic metres of water directly into the centre of the bowl
  const waterVolume = 8000;
  const input = buildBiomeInput({
    heightAt,
    x0,
    z0,
    n,
    cellM,
    machines: [],
    keepouts: [],
    waterSources: [{ x: centreX, z: centreZ }],
    waterVolume,
    stage: 4,
    s: { pxd: 0, vtx: 0, lx: 0, aq: 1 },
    seed: 777,
    tier: 'high',
  });

  assert.equal(input.water.length, n * n);

  let waterCellCount = 0;
  let maxWaterDist = 0;

  for (let z = 0; z < n; z++) {
    const cz = z0 + (z + 0.5) * cellM;
    for (let x = 0; x < n; x++) {
      const cx = x0 + (x + 0.5) * cellM;
      const idx = z * n + x;
      const w = input.water[idx]!;
      const distFromCentre = Math.hypot(cx - centreX, cz - centreZ);

      if (w > 0) {
        waterCellCount++;
        if (distFromCentre > maxWaterDist) {
          maxWaterDist = distFromCentre;
        }
      }
    }
  }

  // Water must land in the bowl (depth > 0)
  assert.ok(waterCellCount > 0, 'water should have pooled in the bowl');
  // Water should be confined to the bowl cavity and never leak beyond rim
  assert.ok(maxWaterDist < 20, `water should stay confined to bowl, reached dist ${maxWaterDist}`);

  // Test corners/edges of grid (far from bowl) must be strictly dry (0)
  assert.equal(input.water[0], 0, 'corner (0, 0) must be dry');
  assert.equal(input.water[n - 1], 0, 'corner (n-1, 0) must be dry');
  assert.equal(input.water[n * (n - 1)], 0, 'corner (0, n-1) must be dry');
  assert.equal(input.water[n * n - 1], 0, 'corner (n-1, n-1) must be dry');
});

test('zero water volume or empty sources yields completely dry water mask', () => {
  const zeroVol = buildBiomeInput({
    heightAt: () => 5,
    x0: 0,
    z0: 0,
    n: 16,
    cellM: 2,
    machines: [],
    keepouts: [],
    waterSources: [{ x: 16, z: 16 }],
    waterVolume: 0,
    stage: 1,
    s: { pxd: 0, vtx: 0, lx: 0, aq: 0 },
    seed: 1,
    tier: 'low',
  });
  assert.ok(zeroVol.water.every((w) => w === 0), 'zero volume must produce all dry cells');

  const noSources = buildBiomeInput({
    heightAt: () => 5,
    x0: 0,
    z0: 0,
    n: 16,
    cellM: 2,
    machines: [],
    keepouts: [],
    waterSources: [],
    waterVolume: 1000,
    stage: 1,
    s: { pxd: 0, vtx: 0, lx: 0, aq: 0 },
    seed: 1,
    tier: 'low',
  });
  assert.ok(noSources.water.every((w) => w === 0), 'no sources must produce all dry cells');
});

test('water sources outside grid are safely omitted without throwing', () => {
  const outOfBounds = buildBiomeInput({
    heightAt: () => 1,
    x0: 10,
    z0: 10,
    n: 16,
    cellM: 2,
    machines: [],
    keepouts: [],
    waterSources: [
      { x: -50, z: -50 },
      { x: 500, z: 500 },
    ],
    waterVolume: 1000,
    stage: 1,
    s: { pxd: 0, vtx: 0, lx: 0, aq: 0 },
    seed: 1,
    tier: 'low',
  });
  assert.ok(outOfBounds.water.every((w) => w === 0));
});

test('buildBiomeInput does not mutate input structures (purity check)', () => {
  const machines = Object.freeze([{ x: 10, z: 20, r: 2 }]);
  const keepouts = Object.freeze([{ x0: 5, z0: 5, x1: 15, z1: 15 }]);
  const s = Object.freeze({ pxd: 0.1, vtx: 0.2, lx: 0.3, aq: 0.4 });
  const waterSources = Object.freeze([{ x: 8, z: 8 }]);

  const options: BuildBiomeInputOptions = {
    heightAt: (x, z) => (x + z) * 0.1,
    x0: 2,
    z0: 3,
    n: 8,
    cellM: 1,
    machines,
    keepouts,
    waterSources,
    waterVolume: 50,
    stage: 2,
    s,
    seed: 12345,
    tier: 'mid',
  };

  const res = buildBiomeInput(options);
  assert.equal(res.machines[0]?.x, 8);
  assert.equal(machines[0]?.x, 10, 'original machine must not be mutated');
  assert.equal(res.keepouts[0]?.x0, 3);
  assert.equal(keepouts[0]?.x0, 5, 'original keepout must not be mutated');
});
