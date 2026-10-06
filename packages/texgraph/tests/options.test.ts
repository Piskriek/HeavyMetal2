// The opt-in options added for the SetMix vault (2026-10-06): stripes tilt, curl warp, ramp interpolation.
// Leaving any of them out must evaluate exactly as before; the SetMix sets are checked byte for byte elsewhere.
import test from "node:test";
import assert from "node:assert/strict";
import { channelStats, evaluateGraph, validateGraph } from "../src";
import type { TexGraph, TexNode } from "../src";

function graph(nodes: TexNode[], out: TexGraph["out"]): TexGraph {
  return { id: "options", name: "options", nodes, out };
}

function same(a: Float32Array | undefined, b: Float32Array | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function seamless(data: Float32Array, size: number, channels: number): boolean {
  const stats = channelStats(data, size, channels);
  return stats.seam < stats.neighbour * 1.5 + 0.01;
}

const stops = [
  { at: 0, r: 0.1, g: 0.1, b: 0.1 },
  { at: 1 / 3, r: 0.4, g: 0.2, b: 0.1 },
  { at: 2 / 3, r: 0.2, g: 0.6, b: 0.3 },
  { at: 1, r: 0.9, g: 0.9, b: 0.8 },
];

test("leaving the new options out evaluates exactly as before", () => {
  const base: TexNode[] = [
    { id: "n", type: "noise", scale: 4, octaves: 3, gain: 0.5, seed: 2 },
    { id: "s", type: "stripes", count: 6, softness: 0.4, vertical: true },
    { id: "w", type: "warp", in: "s", warp: "n", amount: 0.1 },
    { id: "r", type: "ramp", in: "w", stops },
  ];
  const plain = evaluateGraph(graph(base, { albedo: "r", height: "w" }), { size: 32 });
  const explicit = evaluateGraph(
    graph(
      [
        base[0]!,
        { ...base[1]!, tilt: 0 },
        { ...base[2]!, curl: false },
        { ...base[3]!, interpolation: "linear" },
      ],
      { albedo: "r", height: "w" },
    ),
    { size: 32 },
  );
  assert.ok(same(plain.albedo, explicit.albedo), "albedo moved");
  assert.ok(same(plain.height, explicit.height), "height moved");
});

test("tilted stripes lean, stay seamless and stay in 0..1", () => {
  const upright = evaluateGraph(graph([{ id: "s", type: "stripes", count: 14, softness: 0.8, vertical: true }], { height: "s" }), { size: 64 });
  const leaning = evaluateGraph(
    graph([{ id: "s", type: "stripes", count: 14, softness: 0.8, vertical: true, tilt: 3 }], { height: "s" }),
    { size: 64 },
  );
  assert.ok(leaning.height && upright.height);
  assert.ok(!same(leaning.height, upright.height), "tilt changed nothing");
  assert.ok(seamless(leaning.height, 64, 1), "tilted stripes have a seam");
  for (const v of leaning.height) assert.ok(v >= 0 && v <= 1);
  // a vertical stripe is constant down a column; a leaning one is not
  const column = (data: Float32Array) => {
    let spread = 0;
    for (let y = 1; y < 64; y += 1) spread = Math.max(spread, Math.abs(data[y * 64]! - data[0]!));
    return spread;
  };
  assert.ok(column(upright.height) < 1e-6);
  assert.ok(column(leaning.height) > 0.1);
});

test("a curl warp swirls the input, seamless and deterministic", () => {
  const nodes = (curl: boolean): TexNode[] => [
    { id: "psi", type: "noise", scale: 3, octaves: 3, gain: 0.55, seed: 101 },
    { id: "ink", type: "stripes", count: 14, softness: 0.7, vertical: true, tilt: 3 },
    { id: "w", type: "warp", in: "ink", warp: "psi", amount: 0.12, curl },
  ];
  const curly = evaluateGraph(graph(nodes(true), { height: "w" }), { size: 64 });
  const again = evaluateGraph(graph(nodes(true), { height: "w" }), { size: 64 });
  const plain = evaluateGraph(graph(nodes(false), { height: "w" }), { size: 64 });
  assert.ok(curly.height && plain.height);
  assert.ok(same(curly.height, again.height), "not deterministic");
  assert.ok(!same(curly.height, plain.height), "curl changed nothing");
  assert.ok(seamless(curly.height, 64, 1), "curl warp has a seam");
  for (const v of curly.height) assert.ok(v >= 0 && v <= 1);
});

test("a constant ramp is a hard palette in which every stop shows", () => {
  const nodes: TexNode[] = [
    { id: "g", type: "stripes", count: 1, softness: 1, vertical: true },
    { id: "r", type: "ramp", in: "g", stops, interpolation: "constant" },
  ];
  const t = evaluateGraph(graph(nodes, { albedo: "r" }), { size: 128 });
  assert.ok(t.albedo);
  const colours = new Set<string>();
  for (let i = 0; i < t.albedo.length; i += 3) {
    colours.add(`${t.albedo[i]!.toFixed(4)},${t.albedo[i + 1]!.toFixed(4)},${t.albedo[i + 2]!.toFixed(4)}`);
  }
  const expected = new Set(stops.map((s) => `${s.r.toFixed(4)},${s.g.toFixed(4)},${s.b.toFixed(4)}`));
  assert.deepEqual(colours, expected);
});

test("a smooth ramp meets the stops and eases between them", () => {
  const line = (interpolation: "linear" | "smooth") =>
    evaluateGraph(
      graph(
        [
          { id: "g", type: "stripes", count: 1, softness: 1, vertical: true },
          { id: "r", type: "ramp", in: "g", stops: [stops[0], stops[3]], interpolation },
        ],
        { albedo: "r" },
      ),
      { size: 256 },
    ).albedo!;
  const linear = line("linear"), smooth = line("smooth");
  // the darkest and brightest pixels are the stops themselves in both
  let minL = 9, minS = 9, maxL = -9, maxS = -9;
  for (let i = 0; i < linear.length; i += 3) {
    minL = Math.min(minL, linear[i]!); maxL = Math.max(maxL, linear[i]!);
    minS = Math.min(minS, smooth[i]!); maxS = Math.max(maxS, smooth[i]!);
  }
  assert.ok(Math.abs(minL - minS) < 0.01 && Math.abs(maxL - maxS) < 0.01);
  assert.ok(!same(linear, smooth), "smooth equals linear");
});

test("validation checks the new options", () => {
  const bad = graph(
    [
      { id: "n", type: "noise", scale: 4, octaves: 2, gain: 0.5, seed: 0 },
      { id: "s", type: "stripes", count: 4, softness: 1, vertical: false, tilt: 1.5 },
      { id: "w", type: "warp", in: "s", warp: "n", amount: 0.1, curl: "yes" },
      { id: "r", type: "ramp", in: "w", stops, interpolation: "cubic" },
    ],
    { albedo: "r" },
  );
  const { ok, errors } = validateGraph(bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("'tilt' must be an integer")), errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("'curl' must be boolean")), errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("'interpolation' must be")), errors.join("\n"));
});
