import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  TILE_LIBRARY,
  channelStats,
  evaluateGraph,
  validateGraph,
  type EvaluatedTexture,
  type TexGraph,
  type TexNode,
} from "./index";

const TILE_IDS = [
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

const SEED = 37;

function graph(nodes: TexNode[], out: TexGraph["out"]): TexGraph {
  return { id: "test", name: "Test", nodes, out };
}

function luminancePercentileSpread(texture: EvaluatedTexture): number {
  assert.ok(texture.albedo);
  const count = texture.size * texture.size;
  const luminance = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    luminance[i] =
      texture.albedo[i * 3]! * 0.2126 +
      texture.albedo[i * 3 + 1]! * 0.7152 +
      texture.albedo[i * 3 + 2]! * 0.0722;
  }
  luminance.sort();
  return luminance[Math.floor((count - 1) * 0.95)]! - luminance[Math.floor((count - 1) * 0.05)]!;
}

function range(data: Float32Array): { min: number; max: number; mean: number } {
  let min = Infinity, max = -Infinity, sum = 0;
  for (const value of data) {
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
  }
  return { min, max, mean: sum / data.length };
}

function bytes(data: Float32Array): Buffer {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

test("TILE_LIBRARY has exactly the 20 shelf tiles, all with three valid outputs", () => {
  assert.deepEqual(Object.keys(TILE_LIBRARY), TILE_IDS);
  for (const id of TILE_IDS) {
    const tile = TILE_LIBRARY[id];
    assert.ok(tile, id);
    assert.equal(tile.id, id);
    assert.ok(tile.out.albedo && tile.out.height && tile.out.roughness, `${id} outputs`);
    const validation = validateGraph(tile);
    assert.ok(validation.ok, `${id}: ${validation.errors.join("\n")}`);
  }
});

test("every tile is byte-identical when evaluated twice with the same seed", () => {
  for (const [id, tile] of Object.entries(TILE_LIBRARY)) {
    const first = evaluateGraph(tile, { size: 64, seed: SEED });
    const second = evaluateGraph(tile, { size: 64, seed: SEED });
    for (const channel of ["albedo", "height", "normal", "roughness"] as const) {
      const a = first[channel], b = second[channel];
      assert.ok(a && b, `${id} ${channel} was not evaluated`);
      assert.equal(Buffer.compare(bytes(a), bytes(b)), 0, `${id} ${channel} differs`);
    }
  }
});

test("all tile channels wrap without a seam at 128 pixels", () => {
  for (const [id, tile] of Object.entries(TILE_LIBRARY)) {
    const texture = evaluateGraph(tile, { size: 128, seed: SEED });
    for (const [channel, data, components] of [
      ["albedo", texture.albedo, 3],
      ["height", texture.height, 1],
      ["roughness", texture.roughness, 1],
    ] as const) {
      assert.ok(data, `${id} ${channel}`);
      const stats = channelStats(data, texture.size, components);
      assert.ok(
        stats.seam <= stats.neighbour * 1.5,
        `${id} ${channel}: wrap difference ${stats.seam} exceeds 1.5x interior ${stats.neighbour}`,
      );
    }
  }
});

test("all tiles have useful grey spread, relief, and roughness variation", () => {
  for (const [id, tile] of Object.entries(TILE_LIBRARY)) {
    const texture = evaluateGraph(tile, { size: 128, seed: SEED });
    const spread = luminancePercentileSpread(texture);
    assert.ok(spread >= 0.35, `${id} luminance p95 - p05 was ${spread}`);

    assert.ok(texture.height && texture.roughness);
    const height = range(texture.height);
    assert.ok(height.min >= 0 && height.max <= 1 && height.min < height.max, `${id} height range`);

    const roughness = range(texture.roughness);
    assert.ok(roughness.min < roughness.max, `${id} roughness is constant`);
    assert.ok(Math.abs(roughness.mean - 0.5) < 0.1, `${id} roughness mean was ${roughness.mean}`);
  }
});

test("noise scaleY is optional, anisotropic, and deterministic", () => {
  const base: TexNode = { id: "n", type: "noise", scale: 4, octaves: 3, gain: 0.5, seed: 9 };
  const implicit = evaluateGraph(graph([base], { height: "n" }), { size: 32, seed: 5 });
  const explicit = evaluateGraph(graph([{ ...base, scaleY: 4 }], { height: "n" }), { size: 32, seed: 5 });
  const anisotropic = evaluateGraph(graph([{ ...base, scaleY: 16 }], { height: "n" }), { size: 32, seed: 5 });
  assert.deepEqual(implicit.height, explicit.height);
  assert.notDeepEqual(implicit.height, anisotropic.height);
});

test("the new node parameters are validated", () => {
  const invalidNodes: TexNode[] = [
    { id: "n", type: "noise", scale: 4, scaleY: 2.5, octaves: 2, gain: 0.5, seed: 1 },
    { id: "n", type: "scratches", count: 1.5, length: 0.2, width: 0.01, angleSpread: 30, seed: 1 },
    { id: "n", type: "spots", count: 10, radiusMin: 0.1, radiusMax: 0.05, softness: 0.2, seed: 1 },
    { id: "n", type: "hex", count: 8, lineWidth: 0.03, mode: "distance", seed: 1 },
    { id: "n", type: "weave", count: 8, gap: 1.2 },
    { id: "n", type: "blur", in: "missing", radius: 0 },
    { id: "n", type: "blur", in: "missing", radius: 0.26 },
  ];
  for (const node of invalidNodes) {
    const result = validateGraph(graph([node], { height: "n" }));
    assert.equal(result.ok, false, `${node.type} should be invalid: ${JSON.stringify(node)}`);
  }
});

test("hazard stripes are two-value diagonal greyscale", () => {
  const texture = evaluateGraph(TILE_LIBRARY.stripes!, { size: 128, seed: SEED });
  assert.ok(texture.albedo);
  const values = new Set(texture.albedo);
  assert.deepEqual([...values].sort((a, b) => a - b), [0, 1]);
  assert.notDeepEqual(texture.albedo.slice(0, 128 * 3), texture.albedo.slice(128 * 3, 256 * 3));
});

test('performance: every tile meets the 128 and 256 pixel evaluation budgets', (t) => {
  for (const [id, tile] of Object.entries(TILE_LIBRARY)) {
    // Warm the graph's node functions so the budget measures steady-state baking,
    // not the JavaScript engine's first-call compilation.
    evaluateGraph(tile, { size: 128, seed: SEED });

    let started = performance.now();
    evaluateGraph(tile, { size: 128, seed: SEED });
    const at128 = performance.now() - started;

    started = performance.now();
    evaluateGraph(tile, { size: 256, seed: SEED });
    const at256 = performance.now() - started;

    t.diagnostic(`${id}: 128=${at128.toFixed(2)} ms, 256=${at256.toFixed(2)} ms`);
    assert.ok(at128 < 25, `${id} took ${at128.toFixed(2)} ms at 128`);
    assert.ok(at256 < 100, `${id} took ${at256.toFixed(2)} ms at 256`);
  }
});
