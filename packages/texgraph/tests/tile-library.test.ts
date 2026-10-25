import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { evaluateGraph, TILE_LIBRARY, validateGraph } from "../src/index";

const EXPECTED_IDS = [
  "brushed-metal",
  "cells",
  "cast-iron",
  "pits",
  "fine-grain",
  "orange-peel",
  "stripes",
  "rubber-grain",
  "concrete",
  "carbon-weave",
  "hex-micro",
  "flake-scale",
  "grime-clouds",
  "regolith-grain",
  "moss-clump",
  "frost-crystal",
  "mud-splatter",
  "mineral-crust",
  "scorch-burn",
  "scratches",
] as const;

function greyAt(albedo: Float32Array, i: number): number {
  return (albedo[i * 3]! + albedo[i * 3 + 1]! + albedo[i * 3 + 2]!) / 3;
}

describe("TILE_LIBRARY (OPUS_NOTE_44 / STUDIO-44A)", () => {
  before(() => {
    // Warm up V8 JIT across all node evaluators before running the < 25 ms per-tile timing gate
    for (const id of EXPECTED_IDS) {
      evaluateGraph(TILE_LIBRARY[id]!, { size: 128 });
    }
  });

  it("exports all 20 canonical tile IDs", () => {
    assert.deepEqual(Object.keys(TILE_LIBRARY).sort(), [...EXPECTED_IDS].sort());
  });

  for (const id of EXPECTED_IDS) {
    it(`tile '${id}' validates, is deterministic, wraps seamlessly, has >= 0.35 grey spread, non-constant height, and evaluates < 25 ms at 128px`, () => {
      const graph = TILE_LIBRARY[id]!;
      const v = validateGraph(graph);
      assert.equal(v.ok, true, `Validation errors for ${id}: ${v.errors.join(", ")}`);

      // Warm up JIT before measuring
      evaluateGraph(graph, { size: 128 });
      const t0 = performance.now();
      const eval1 = evaluateGraph(graph, { size: 128 });
      const t1 = performance.now();
      const eval2 = evaluateGraph(graph, { size: 128 });
      const t2 = performance.now();
      evaluateGraph(graph, { size: 128 });
      const t3 = performance.now();
      const elapsedMs = Math.min(t1 - t0, t2 - t1, t3 - t2);

      assert.ok(elapsedMs < 25, `Tile '${id}' took ${elapsedMs.toFixed(1)} ms at 128px (>= 25 ms)`);
      assert.ok(eval1.albedo && eval2.albedo, `Tile '${id}' missing albedo`);
      assert.ok(eval1.height && eval2.height, `Tile '${id}' missing height`);
      assert.ok(eval1.roughness && eval2.roughness, `Tile '${id}' missing roughness`);

      // Determinism
      assert.deepEqual(eval1.albedo, eval2.albedo);
      assert.deepEqual(eval1.height, eval2.height);

      const size = 128;
      const n = size * size;
      const greys = new Float32Array(n);
      let minH = Infinity, maxH = -Infinity;
      for (let i = 0; i < n; i += 1) {
        greys[i] = greyAt(eval1.albedo, i);
        const h = eval1.height[i]!;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }

      // Height not constant
      assert.ok(maxH - minH > 0.05, `Tile '${id}' height range too small: ${maxH - minH}`);

      // Grey 5th to 95th percentile spread >= 0.35
      const sorted = Float32Array.from(greys).sort();
      const p05 = sorted[Math.floor(n * 0.05)]!;
      const p95 = sorted[Math.floor(n * 0.95)]!;
      const spread = p95 - p05;
      assert.ok(spread >= 0.35, `Tile '${id}' 5th-95th grey spread is ${spread.toFixed(3)} (< 0.35)`);

      // Seam check: mean absolute difference across wrap edge <= 1.5x interior neighbour difference
      let wrapDiffX = 0, intDiffX = 0;
      let wrapDiffY = 0, intDiffY = 0;
      for (let y = 0; y < size; y += 1) {
        wrapDiffX += Math.abs(greys[y * size]! - greys[y * size + (size - 1)]!);
        for (let x = 0; x < size - 1; x += 1) {
          intDiffX += Math.abs(greys[y * size + x + 1]! - greys[y * size + x]!);
        }
      }
      wrapDiffX /= size;
      intDiffX /= size * (size - 1);

      for (let x = 0; x < size; x += 1) {
        wrapDiffY += Math.abs(greys[x]! - greys[(size - 1) * size + x]!);
        for (let y = 0; y < size - 1; y += 1) {
          intDiffY += Math.abs(greys[(y + 1) * size + x]! - greys[y * size + x]!);
        }
      }
      wrapDiffY /= size;
      intDiffY /= size * (size - 1);

      assert.ok(
        wrapDiffX <= Math.max(0.01, intDiffX * 1.5),
        `Tile '${id}' X wrap seam (${wrapDiffX.toFixed(4)}) > 1.5x interior (${intDiffX.toFixed(4)})`,
      );
      assert.ok(
        wrapDiffY <= Math.max(0.01, intDiffY * 1.5),
        `Tile '${id}' Y wrap seam (${wrapDiffY.toFixed(4)}) > 1.5x interior (${intDiffY.toFixed(4)})`,
      );
    });
  }
});
