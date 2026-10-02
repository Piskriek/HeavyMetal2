import test from "node:test";
import assert from "node:assert/strict";
import {
  TEXTURE_PRESETS,
  channelStats,
  evaluateGraph,
  validateGraph,
} from '../src';
import type { TexGraph, TexNode } from '../src';

function graph(
  nodes: TexNode[],
  out: TexGraph["out"],
  id = "test",
): TexGraph {
  return {
    id,
    name: id,
    nodes,
    out,
  };
}

function assertValuesInRange(data: Float32Array): void {
  for (const value of data) {
    assert.ok(value >= 0 && value <= 1, `value ${value} is outside 0..1`);
  }
}

function differs(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) {
    return true;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return true;
    }
  }

  return false;
}

test("all texture presets are seamless on albedo and height", () => {
  for (const preset of TEXTURE_PRESETS) {
    const evaluated = evaluateGraph(preset);

    assert.ok(evaluated.albedo);
    assert.ok(evaluated.height);

    const albedoStats = channelStats(evaluated.albedo, evaluated.size, 3);
    const heightStats = channelStats(evaluated.height, evaluated.size, 1);

    assert.ok(
      albedoStats.seam < 0.03,
      `${preset.id} albedo seam was ${albedoStats.seam}`,
    );
    assert.ok(
      heightStats.seam < 0.03,
      `${preset.id} height seam was ${heightStats.seam}`,
    );
  }
});

test("evaluation is deterministic", () => {
  const first = evaluateGraph(TEXTURE_PRESETS[0]!, { size: 32, seed: 19 });
  const second = evaluateGraph(TEXTURE_PRESETS[0]!, { size: 32, seed: 19 });

  assert.deepEqual(first, second);
});

test("validateGraph reports missing references", () => {
  const result = validateGraph(
    graph(
      [
        {
          id: "rock",
          type: "warp",
          in: "source",
          warp: "wobble",
          amount: 0.1,
        },
      ],
      { height: "rock" },
      "missing-reference",
    ),
  );

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) =>
      error.includes("node 'rock': 'warp' refers to 'wobble' which does not exist"),
    ),
  );
});

test("validateGraph reports cycles", () => {
  const result = validateGraph(
    graph(
      [
        { id: "a", type: "invert", in: "b" },
        { id: "b", type: "invert", in: "a" },
      ],
      { height: "a" },
      "cycle",
    ),
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("cycle detected")));
});

test("validateGraph reports scalar and colour mismatches", () => {
  const result = validateGraph(
    graph(
      [
        { id: "source", type: "noise", scale: 3, octaves: 2, gain: 0.5, seed: 1 },
        {
          id: "colour",
          type: "ramp",
          in: "source",
          stops: [
            { at: 0, r: 0.1, g: 0.2, b: 0.3 },
            { at: 1, r: 0.8, g: 0.7, b: 0.6 },
          ],
        },
        {
          id: "mix",
          type: "blend",
          a: "source",
          b: "colour",
          mode: "mix",
          amount: 0.5,
        },
      ],
      { albedo: "mix" },
      "type-mismatch",
    ),
  );

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) =>
      error.includes("'blend' requires 'a' and 'b' to have the same type"),
    ),
  );
});

test("validateGraph reports unknown node types", () => {
  const result = validateGraph(
    graph(
      [{ id: "mystery", type: "unknownNoise" }],
      { height: "mystery" },
      "unknown-type",
    ),
  );

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) =>
      error.includes("unknown node type 'unknownNoise'"),
    ),
  );
});

test("each node type produces bounded, non-constant output", () => {
  const cases: Array<{
    name: string;
    nodes: TexNode[];
    output: string;
    constant?: boolean;
  }> = [
    {
      name: "noise",
      output: "n",
      nodes: [
        {
          id: "n",
          type: "noise",
          scale: 5,
          octaves: 3,
          gain: 0.5,
          seed: 2,
        },
      ],
    },
    {
      name: "cellular",
      output: "n",
      nodes: [
        {
          id: "n",
          type: "cellular",
          scale: 4,
          jitter: 0.7,
          mode: "edge",
          seed: 3,
        },
      ],
    },
    {
      name: "grain",
      output: "n",
      nodes: [{ id: "n", type: "grain", seed: 4 }],
    },
    {
      name: "stripes",
      output: "n",
      nodes: [
        {
          id: "n",
          type: "stripes",
          count: 5,
          vertical: true,
          softness: 0.35,
        },
      ],
    },
    {
      name: "checker",
      output: "n",
      nodes: [
        {
          id: "n",
          type: "checker",
          countX: 4,
          countY: 3,
        },
      ],
    },
    {
      name: "constant",
      output: "n",
      constant: true,
      nodes: [{ id: "n", type: "constant", value: 0.37 }],
    },
    {
      name: "warp",
      output: "target",
      nodes: [
        {
          id: "base",
          type: "noise",
          scale: 4,
          octaves: 2,
          gain: 0.5,
          seed: 5,
        },
        {
          id: "field",
          type: "noise",
          scale: 2,
          octaves: 2,
          gain: 0.5,
          seed: 6,
        },
        {
          id: "target",
          type: "warp",
          in: "base",
          warp: "field",
          amount: 0.15,
        },
      ],
    },
    {
      name: "blend",
      output: "target",
      nodes: [
        {
          id: "a",
          type: "noise",
          scale: 3,
          octaves: 2,
          gain: 0.5,
          seed: 7,
        },
        {
          id: "b",
          type: "noise",
          scale: 7,
          octaves: 2,
          gain: 0.5,
          seed: 8,
        },
        {
          id: "target",
          type: "blend",
          a: "a",
          b: "b",
          mode: "overlay",
          amount: 0.8,
        },
      ],
    },
    {
      name: "levels",
      output: "target",
      nodes: [
        {
          id: "source",
          type: "noise",
          scale: 4,
          octaves: 2,
          gain: 0.5,
          seed: 9,
        },
        {
          id: "target",
          type: "levels",
          in: "source",
          inLow: 0.2,
          inHigh: 0.8,
          gamma: 1.2,
          outLow: 0.1,
          outHigh: 0.9,
        },
      ],
    },
    {
      name: "invert",
      output: "target",
      nodes: [
        {
          id: "source",
          type: "noise",
          scale: 4,
          octaves: 2,
          gain: 0.5,
          seed: 10,
        },
        { id: "target", type: "invert", in: "source" },
      ],
    },
    {
      name: "ramp",
      output: "target",
      nodes: [
        {
          id: "source",
          type: "noise",
          scale: 4,
          octaves: 2,
          gain: 0.5,
          seed: 11,
        },
        {
          id: "target",
          type: "ramp",
          in: "source",
          stops: [
            { at: 0, r: 0.05, g: 0.1, b: 0.2 },
            { at: 1, r: 0.8, g: 0.7, b: 0.4 },
          ],
        },
      ],
    },
    {
      name: "scaleBias",
      output: "target",
      nodes: [
        {
          id: "source",
          type: "noise",
          scale: 4,
          octaves: 2,
          gain: 0.5,
          seed: 12,
        },
        {
          id: "target",
          type: "scaleBias",
          in: "source",
          scale: 0.7,
          bias: 0.1,
        },
      ],
    },
  ];

  for (const item of cases) {
    const size = 32;
    const evaluated = evaluateGraph(
      graph(item.nodes, { albedo: item.output }, item.name),
      { size },
    );

    assert.ok(evaluated.albedo);
    assertValuesInRange(evaluated.albedo);

    const stats = channelStats(evaluated.albedo, size, 3);
    if (item.constant) {
      assert.ok(stats.std.every((value) => value < 0.000001));
    } else {
      assert.ok(
        stats.std.some((value) => value > 0.000001),
        `${item.name} unexpectedly produced a constant image`,
      );
    }
  }
});

test("a 4 by 4 checker has mean 0.5", () => {
  const evaluated = evaluateGraph(
    graph(
      [{ id: "checker", type: "checker", countX: 4, countY: 4 }],
      { height: "checker" },
      "checker-mean",
    ),
    { size: 64 },
  );

  assert.ok(evaluated.height);
  const stats = channelStats(evaluated.height, 64, 1);
  assert.ok(Math.abs(stats.mean[0]! - 0.5) < 0.000001);
});

test("a constant height produces a flat encoded normal", () => {
  const size = 16;
  const evaluated = evaluateGraph(
    graph(
      [{ id: "height", type: "constant", value: 0.5 }],
      { height: "height" },
      "flat-normal",
    ),
    { size },
  );

  assert.ok(evaluated.normal);
  for (const value of evaluated.normal) {
    assert.equal(value, 0.5);
  }
});

test("evaluation seed changes procedural output", () => {
  const texture = graph(
    [
      {
        id: "noise",
        type: "noise",
        scale: 5,
        octaves: 3,
        gain: 0.5,
        seed: 21,
      },
    ],
    { height: "noise" },
    "seeded",
  );

  const first = evaluateGraph(texture, { size: 32, seed: 0 });
  const second = evaluateGraph(texture, { size: 32, seed: 1 });

  assert.ok(first.height);
  assert.ok(second.height);
  assert.ok(differs(first.height, second.height));
});