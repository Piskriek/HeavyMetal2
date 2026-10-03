import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { channelStats, evaluateGraph, validateGraph, type TexGraph } from "../src";

// SetMix's ground and voxel sets (packages/texgraph/sets, baked by scripts/bake-setmix.mjs): every graph must be valid and seamless.
const read = (name: string): unknown => JSON.parse(readFileSync(new URL(`../sets/${name}`, import.meta.url), "utf8"));
const ground = read("setmix-ground.json") as { surfaces: { id: string; styles: { key: string; graph: TexGraph }[] }[] };
const voxel = read("setmix-voxel.json") as { graphs: TexGraph[] };

test("the SetMix ground has 26 surfaces, each with at least one style, all valid", () => {
  assert.equal(ground.surfaces.length, 26);
  for (const s of ground.surfaces) {
    assert.ok(s.styles.length > 0, `${s.id} has no style`);
    for (const st of s.styles) {
      const v = validateGraph(st.graph);
      assert.ok(v.ok, `${s.id}/${st.key}: ${v.errors.join("; ")}`);
    }
  }
});

test("every voxel face graph is valid and named after a ground surface", () => {
  assert.equal(voxel.graphs.length, ground.surfaces.length);
  voxel.graphs.forEach((g, i) => {
    assert.ok(validateGraph(g).ok, g.id);
    assert.equal(g.id, `voxel-${ground.surfaces[i]!.id}`, "the voxel atlas rows follow the ground order");
  });
});

/**
 * How much the wrap (last row to first, last column to first) differs, against the worst pair of neighbouring rows or columns inside. A
 * banded texture has sharp band edges inside it, so one landing on the wrap is no seam; a real seam stands out against all of them.
 */
function wrapVersusInside(data: Float32Array, size: number, channels: number): { wrap: number; worst: number } {
  const pair = (a: (k: number) => number, b: (k: number) => number): number => {
    let sum = 0;
    for (let k = 0; k < size * channels; k += 1) sum += Math.abs(data[a(k)]! - data[b(k)]!);
    return sum / (size * channels);
  };
  const row = (y: number) => (k: number) => y * size * channels + k;
  const col = (x: number) => (k: number) => (Math.floor(k / channels) * size + x) * channels + (k % channels);
  let worst = 0;
  for (let i = 0; i + 1 < size; i += 1) worst = Math.max(worst, pair(row(i), row(i + 1)), pair(col(i), col(i + 1)));
  return { wrap: Math.max(pair(row(size - 1), row(0)), pair(col(size - 1), col(0))), worst };
}

test("the default style of every surface tiles without a seam", () => {
  for (const s of ground.surfaces) {
    const t = evaluateGraph(s.styles[0]!.graph, { size: 64 });
    for (const [name, data, ch] of [["albedo", t.albedo!, 3], ["height", t.height!, 1]] as const) {
      const r = wrapVersusInside(data, t.size, ch);
      assert.ok(r.wrap <= r.worst * 1.25 + 0.01, `${s.id} ${name}: the wrap differs by ${r.wrap}, the worst inside by ${r.worst}`);
    }
  }
  // and the smooth ones by the plain measure too
  const t = evaluateGraph(ground.surfaces.find((s) => s.id === "sand")!.styles[0]!.graph, { size: 64 });
  const a = channelStats(t.albedo!, t.size, 3);
  assert.ok(a.seam < a.neighbour * 1.5 + 0.01);
});
