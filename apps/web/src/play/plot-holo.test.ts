import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleReliefGrid, mapPlotToHolo } from './plot-holo';

test('sampleReliefGrid: produces valid relief geometry clipped to disc with <= 4k triangles', () => {
  const result = sampleReliefGrid({
    gridSize: 48,
    plotRadius: 500,
    holoRadius: 0.85,
    baseY: 1.15,
    targetHeightRange: 0.14,
    heightFn: (x, z) => 20 + 5 * Math.sin(x * 0.02) + 5 * Math.cos(z * 0.02),
    gate: { x: 0, z: 0 },
  });

  assert.ok(result.triangleCount > 2500, `Expected > 2500 triangles, got ${result.triangleCount}`);
  assert.ok(result.triangleCount <= 4000, `Expected <= 4000 triangles, got ${result.triangleCount}`);
  assert.equal(result.indices.length, result.triangleCount * 3);
  assert.equal(result.positions.length, result.vertexCount * 3);
  assert.equal(result.normals.length, result.vertexCount * 3);
  assert.equal(result.uvs.length, result.vertexCount * 2);
  assert.equal(result.plotCoords.length, result.vertexCount * 2);
  assert.equal(result.worldHeights.length, result.vertexCount);

  // All vertices must be strictly inside the 500 m plot disc and 0.85 m hologram disc
  const eps = 1e-4;
  for (let i = 0; i < result.vertexCount; i++) {
    const x = result.positions[i * 3]!;
    const y = result.positions[i * 3 + 1]!;
    const z = result.positions[i * 3 + 2]!;
    const holoDist = Math.hypot(x, z);
    assert.ok(holoDist <= 0.85 + eps, `Holo vertex out of radius: ${holoDist}`);

    const dx = result.plotCoords[i * 2]!;
    const dz = result.plotCoords[i * 2 + 1]!;
    const plotDist = Math.hypot(dx, dz);
    assert.ok(plotDist <= 500 + eps, `Plot coord out of radius: ${plotDist}`);

    // Height stays within [baseY, baseY + targetHeightRange]
    assert.ok(y >= 1.15 - eps, `Y below baseY: ${y}`);
    assert.ok(y <= 1.15 + 0.14 + eps, `Y above max: ${y}`);

    // Normals must be normalized
    const nx = result.normals[i * 3]!;
    const ny = result.normals[i * 3 + 1]!;
    const nz = result.normals[i * 3 + 2]!;
    const nLen = Math.hypot(nx, ny, nz);
    assert.ok(Math.abs(nLen - 1.0) < 1e-3, `Normal not unit length: ${nLen}`);
  }
});

test('sampleReliefGrid: flat terrain maps exactly to baseY', () => {
  const result = sampleReliefGrid({
    gridSize: 32,
    plotRadius: 500,
    holoRadius: 0.85,
    baseY: 1.15,
    targetHeightRange: 0.14,
    heightFn: () => 50,
    gate: { x: 100, z: -200 },
  });

  assert.equal(result.minHeight, 50);
  assert.equal(result.maxHeight, 50);

  for (let i = 0; i < result.vertexCount; i++) {
    const y = result.positions[i * 3 + 1]!;
    assert.ok(Math.abs(y - 1.15) < 1e-5, `Expected y = 1.15 for flat ground, got ${y}`);
  }
});

test('sampleReliefGrid: linear slope reaches full target height range', () => {
  const result = sampleReliefGrid({
    gridSize: 48,
    plotRadius: 500,
    holoRadius: 0.85,
    baseY: 1.15,
    targetHeightRange: 0.14,
    heightFn: (x) => x, // Linear slope across x
    gate: { x: 0, z: 0 },
  });

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < result.vertexCount; i++) {
    const y = result.positions[i * 3 + 1]!;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  assert.ok(Math.abs(minY - 1.15) < 0.01, `Min Y should be ~1.15, got ${minY}`);
  assert.ok(Math.abs(maxY - (1.15 + 0.14)) < 0.01, `Max Y should be ~1.29, got ${maxY}`);
});

test('mapPlotToHolo: maps planet coordinates into hologram table space', () => {
  const gateHolo = mapPlotToHolo(0, 0, 10, 0, 20);
  assert.ok(Math.abs(gateHolo.x) < 1e-5);
  assert.ok(Math.abs(gateHolo.z) < 1e-5);
  // (10 - 0) / 20 = 0.5 -> 1.15 + 0.5 * 0.14 = 1.22
  assert.ok(Math.abs(gateHolo.y - 1.22) < 1e-5);

  const edgeHolo = mapPlotToHolo(500, 0, 0, 0, 20);
  assert.ok(Math.abs(edgeHolo.x - 0.85) < 1e-5);
  assert.ok(Math.abs(edgeHolo.z) < 1e-5);
  assert.ok(Math.abs(edgeHolo.y - 1.15) < 1e-5);
});
