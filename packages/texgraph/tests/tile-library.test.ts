// TICKET-41: the tile library. Every tile the matstack shelf names must exist here, wrap at the edge, carry real contrast in its
// grey map, and evaluate inside the min-spec laptop's budget. The node tests hold the six new periodic nodes to their contracts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SURFACE_SHELF } from '@hm/matstack';
import {
  TILE_LIBRARY,
  TILE_LIBRARY_IDS,
  TILE_LIBRARY_LIST,
  channelStats,
  evaluateGraph,
  validateGraph,
  type TexGraph,
  type TexNode,
} from '../src';

const graph = (nodes: TexNode[], out: TexGraph['out'], id = 't'): TexGraph => ({ id, name: id, nodes, out });

const percentile = (sorted: readonly number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]!;

/** The grey (luminance) of an evaluated tile's albedo, sorted ascending. */
function greys(t: { albedo?: Float32Array }): number[] {
  assert.ok(t.albedo, 'the tile has no albedo');
  const out: number[] = [];
  for (let i = 0; i < t.albedo!.length; i += 3) {
    out.push(0.2126 * t.albedo![i]! + 0.7152 * t.albedo![i + 1]! + 0.0722 * t.albedo![i + 2]!);
  }
  return out.sort((a, b) => a - b);
}

/**
 * How much the wrap (last row to first, last column to first) differs, against the worst pair of neighbours inside. A hard band that
 * lands on the wrap is no seam; a real seam stands out against every pair inside, which is what this catches.
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

const seamless = (data: Float32Array, size: number, channels: number): { ok: boolean; wrap: number; worst: number } => {
  const r = wrapVersusInside(data, size, channels);
  return { ok: r.wrap <= r.worst * 1.25 + 0.01, ...r };
};

// ---------------------------------------------------------------- the library

test('the tile library has the 20 tiles, and every tile the shelf names is one of them', () => {
  assert.deepEqual([...TILE_LIBRARY_IDS].sort(), [
    'brushed-metal',
    'carbon-weave',
    'cast-iron',
    'cells',
    'concrete',
    'fine-grain',
    'flake-scale',
    'frost-crystal',
    'grime-clouds',
    'hex-micro',
    'mineral-crust',
    'moss-clump',
    'mud-splatter',
    'orange-peel',
    'pits',
    'regolith-grain',
    'rubber-grain',
    'scorch-burn',
    'scratches',
    'stripes',
  ]);
  assert.equal(TILE_LIBRARY_LIST.length, 20);
  assert.deepEqual(Object.keys(TILE_LIBRARY).sort(), [...TILE_LIBRARY_IDS].sort());

  const wanted = new Set<string>();
  for (const surface of Object.values(SURFACE_SHELF)) {
    for (const use of [surface.tile, surface.detail]) if (use) wanted.add(use.tile);
  }
  assert.ok(wanted.size >= 15, `the shelf names ${wanted.size} tiles`);
  for (const id of wanted) assert.ok(TILE_LIBRARY[id], `the shelf names '${id}' but the tile library has no graph for it`);
});

test('every tile is a valid graph with all three outputs', () => {
  for (const g of TILE_LIBRARY_LIST) {
    const result = validateGraph(g);
    assert.deepEqual(result.errors, [], `${g.id}: ${result.errors.join('; ')}`);
    assert.equal(g.id, g.id.trim());
    assert.ok(g.out.albedo && g.out.height && g.out.roughness, `${g.id} writes a partial set`);
  }
});

test('every tile evaluates deterministically', () => {
  for (const g of TILE_LIBRARY_LIST) {
    const a = evaluateGraph(g, { size: 32 });
    const b = evaluateGraph(g, { size: 32 });
    assert.deepEqual(a.albedo, b.albedo, `${g.id} albedo moved between runs`);
    assert.deepEqual(a.height, b.height, `${g.id} height moved between runs`);
    assert.deepEqual(a.roughness, b.roughness, `${g.id} roughness moved between runs`);
  }
});

test('every tile wraps without a seam on albedo, height and roughness', () => {
  for (const g of TILE_LIBRARY_LIST) {
    const t = evaluateGraph(g, { size: 96 });
    for (const [name, data, channels] of [
      ['albedo', t.albedo!, 3],
      ['height', t.height!, 1],
      ['roughness', t.roughness!, 1],
    ] as const) {
      const r = seamless(data, t.size, channels);
      assert.ok(r.ok, `${g.id} ${name}: the wrap differs by ${r.wrap.toFixed(3)}, the worst inside by ${r.worst.toFixed(3)}`);
    }
  }
});

test('every tile has a contrasty grey map (5th to 95th percentile at least 0.35 apart)', () => {
  for (const g of TILE_LIBRARY_LIST) {
    const greysOfTile = greys(evaluateGraph(g, { size: 128 }));
    const spread = percentile(greysOfTile, 0.95) - percentile(greysOfTile, 0.05);
    assert.ok(spread >= 0.35, `${g.id}: the grey map spans ${spread.toFixed(3)} from the 5th to the 95th percentile`);
    // and both ends are actually reached, not one flat plateau
    assert.ok(percentile(greysOfTile, 0.05) <= 0.45, `${g.id}: nothing dark in the tile`);
    assert.ok(percentile(greysOfTile, 0.95) >= 0.3, `${g.id}: nothing light in the tile`);
  }
});

test('every tile has real relief, and a roughness map that varies with it', () => {
  for (const g of TILE_LIBRARY_LIST) {
    const t = evaluateGraph(g, { size: 64 });
    const height = t.height!;
    let min = Infinity, max = -Infinity, distinct = new Set<number>();
    for (const h of height) {
      min = Math.min(min, h);
      max = Math.max(max, h);
      distinct.add(Math.round(h * 64));
    }
    assert.ok(max - min >= 0.05, `${g.id}: the height map spans only ${(max - min).toFixed(3)}`);
    assert.ok(distinct.size >= 8, `${g.id}: the height map has ${distinct.size} levels`);

    const rough = channelStats(t.roughness!, t.size, 1);
    assert.ok(rough.std[0]! > 0.001, `${g.id}: the roughness map is flat`);
    for (const r of t.roughness!) assert.ok(r >= 0 && r <= 1, `${g.id}: roughness ${r} is outside 0..1`);
  }
});

test('every tile survives a seed change (the Studio reseeds the whole library)', () => {
  for (const g of TILE_LIBRARY_LIST) {
    const plain = evaluateGraph(g, { size: 32 });
    const reseeded = evaluateGraph(g, { size: 32, seed: 977 });
    assert.equal(plain.albedo!.length, reseeded.albedo!.length);
    for (const value of reseeded.albedo!) assert.ok(value >= 0 && value <= 1, `${g.id}: a reseeded value left 0..1`);
  }
});

// ---------------------------------------------------------------- the six new nodes

test('noise scaleY stretches the lattice along v', () => {
  const stretched = evaluateGraph(
    graph([{ id: 'n', type: 'noise', scale: 24, scaleY: 2, octaves: 1, gain: 0.5, seed: 5 }], { height: 'n' }),
    { size: 64 },
  );
  const square = evaluateGraph(
    graph([{ id: 'n', type: 'noise', scale: 24, octaves: 1, gain: 0.5, seed: 5 }], { height: 'n' }),
    { size: 64 },
  );
  const across = (data: Float32Array): number => {
    let sum = 0;
    for (let x = 1; x < 64; x += 1) sum += Math.abs(data[32 * 64 + x]! - data[32 * 64 + x - 1]!);
    return sum / 63;
  };
  const down = (data: Float32Array): number => {
    let sum = 0;
    for (let y = 1; y < 64; y += 1) sum += Math.abs(data[y * 64 + 32]! - data[(y - 1) * 64 + 32]!);
    return sum / 63;
  };
  // the stretched field varies fast across and slowly down: the opposite of the square one
  assert.ok(across(stretched.height!) > down(stretched.height!) * 4, `${across(stretched.height!)} vs ${down(stretched.height!)}`);
  assert.ok(Math.abs(across(square.height!) - down(square.height!)) < 0.02, 'a square noise is not anisotropic');
  assert.ok(seamless(stretched.height!, 64, 1).ok, 'stretched noise has a seam');
});

test('hex draws cells and walls, the walls get narrower with band, and both wrap', () => {
  const cell = evaluateGraph(graph([{ id: 'h', type: 'hex', count: 6, mode: 'cell', seed: 3 }], { height: 'h' }), { size: 64 });
  const wall = evaluateGraph(graph([{ id: 'h', type: 'hex', count: 6, mode: 'edge', band: 0.2, seed: 3 }], { height: 'h' }), { size: 64 });
  const thin = evaluateGraph(graph([{ id: 'h', type: 'hex', count: 6, mode: 'edge', band: 0.05, seed: 3 }], { height: 'h' }), { size: 64 });
  const mean = (data: Float32Array): number => [...data].reduce((a, b) => a + b, 0) / data.length;
  const bright = (data: Float32Array): number => [...data].filter((v) => v > 0.5).length / (64 * 64);
  // the cell dome peaks at a cell's centre and falls to 0 on its walls: a cone, so a quarter of it is over half
  assert.ok(Math.max(...cell.height!) > 0.85, 'a cell does not peak at its centre');
  assert.ok(Math.min(...cell.height!) < 0.02, 'a cell does not reach its wall');
  assert.ok(mean(cell.height!) > mean(wall.height!) * 1.5, `cells ${mean(cell.height!)} vs walls ${mean(wall.height!)}`);
  assert.ok(bright(wall.height!) < 0.35, `walls ${bright(wall.height!)}`);
  assert.ok(bright(thin.height!) < bright(wall.height!), 'a narrower band must not widen the walls');
  for (const t of [cell, wall, thin]) assert.ok(seamless(t.height!, 64, 1).ok, 'the hex grid has a seam');
});

test('spots puts count spots down, each peaking at its centre, and wraps', () => {
  const few = evaluateGraph(graph([{ id: 's', type: 'spots', count: 3, radius: 0.12, softness: 0.2, seed: 9 }], { height: 's' }), { size: 64 });
  const many = evaluateGraph(graph([{ id: 's', type: 'spots', count: 24, radius: 0.05, softness: 0.2, seed: 9 }], { height: 's' }), { size: 64 });
  const lit = (data: Float32Array): number => [...data].filter((v) => v > 0.5).length;
  assert.ok(lit(few.height!) > 0 && lit(many.height!) > lit(few.height!), `${lit(few.height!)} vs ${lit(many.height!)}`);
  assert.ok(seamless(few.height!, 64, 1).ok, 'spots have a seam');
  // a hard disc has a flat top; a soft one does not
  const hard = evaluateGraph(graph([{ id: 's', type: 'spots', count: 4, radius: 0.1, softness: 0, seed: 4 }], { height: 's' }), { size: 96 });
  // a pixel centre need not land on a spot's centre: inside one pixel of it, the disc is still at least 0.9
  assert.ok(Math.max(...hard.height!) > 0.9, 'a hard spot does not reach its centre');
  // and a hard disc has a flat top while a soft one keeps falling inwards
  const soft = evaluateGraph(graph([{ id: 's', type: 'spots', count: 4, radius: 0.1, softness: 1, seed: 4 }], { height: 's' }), { size: 96 });
  // a soft spot eases towards its edge, so fewer of its pixels sit in the middle of the range
  const mid = (data: Float32Array): number => [...data].filter((v) => v > 0.25 && v < 0.75).length;
  assert.ok(mid(soft.height!) < mid(hard.height!) * 0.9, `mid values ${mid(soft.height!)} vs ${mid(hard.height!)}`);
});

test('weave alternates over and under on an even grid and wraps', () => {
  const t = evaluateGraph(graph([{ id: 'w', type: 'weave', threads: 8, contrast: 0.8 }], { height: 'w' }), { size: 96 });
  assert.ok(seamless(t.height!, 96, 1).ok, 'the weave has a seam');
  // cells alternate over and under: just inside a cell's left wall, at the middle of a thread, an over cell is bright and an under one dark
  const cell = 96 / 8;
  const at = (x: number, y: number): number => t.height![y * 96 + x]!;
  const probe = (i: number, j: number): number => at(Math.round(i * cell) + 1, Math.round(j * cell) + Math.round(cell / 2));
  for (let j = 0; j < 3; j += 1) {
    for (let i = 0; i < 3; i += 1) {
      const here = probe(i, j), right = probe(i + 1, j), below = probe(i, j + 1);
      assert.ok(Math.abs(here - right) > 0.2, `cells ${i},${j} and ${i + 1},${j} do not alternate (${here} vs ${right})`);
      assert.ok(Math.abs(here - below) > 0.2, `cells ${i},${j} and ${i},${j + 1} do not alternate (${here} vs ${below})`);
    }
  }
  const stats = channelStats(t.height!, 96, 1);
  assert.ok(stats.std[0]! > 0.1, `the weave is nearly flat (std ${stats.std[0]})`);
  // rounded to an even number however it is asked for
  const odd = evaluateGraph(graph([{ id: 'w', type: 'weave', threads: 7 }], { height: 'w' }), { size: 96 });
  assert.ok(seamless(odd.height!, 96, 1).ok, 'an odd thread count must be rounded to an even one to wrap');
});

test('scratches draws tapered lines along the asked axis and wraps', () => {
  const across = evaluateGraph(graph([{ id: 's', type: 'scratches', count: 6, length: 0.8, width: 0.02, vertical: false, seed: 11 }], { height: 's' }), { size: 96 });
  const down = evaluateGraph(graph([{ id: 's', type: 'scratches', count: 6, length: 0.8, width: 0.02, vertical: true, seed: 11 }], { height: 's' }), { size: 96 });
  /** How fast the image changes along an axis: the mean absolute step to the next column / row. */
  const steps = (data: Float32Array) => {
    let dx = 0, dy = 0;
    for (let y = 0; y < 96; y += 1) for (let x = 0; x < 96; x += 1) {
      const v = data[y * 96 + x]!;
      if (x + 1 < 96) dx += Math.abs(data[y * 96 + x + 1]! - v);
      if (y + 1 < 96) dy += Math.abs(data[(y + 1) * 96 + x]! - v);
    }
    return { dx: dx / (96 * 95), dy: dy / (96 * 95) };
  };
  // lines across the tile change fast down it and slowly along it; lines down it do the opposite
  const horizontal = steps(across.height!), vertical = steps(down.height!);
  assert.ok(horizontal.dy > horizontal.dx * 2, `across: ${horizontal.dx} / ${horizontal.dy}`);
  assert.ok(vertical.dx > vertical.dy * 2, `down: ${vertical.dx} / ${vertical.dy}`);
  for (const t of [across, down]) assert.ok(seamless(t.height!, 96, 1).ok, 'scratches have a seam');
});

test('blur softens without moving the mean or breaking the wrap', () => {
  const nodes: TexNode[] = [
    { id: 'n', type: 'noise', scale: 16, octaves: 2, gain: 0.5, seed: 23 },
    { id: 'g', type: 'grain', seed: 29 },
    { id: 'mix', type: 'blend', a: 'n', b: 'g', mode: 'mix', amount: 0.4 },
  ];
  const sharp = evaluateGraph(graph(nodes, { height: 'mix' }), { size: 64 });
  const soft = evaluateGraph(graph([...nodes, { id: 'b', type: 'blur', in: 'mix', radius: 3 }], { height: 'b' }), { size: 64 });
  const before = channelStats(sharp.height!, 64, 1), after = channelStats(soft.height!, 64, 1);
  assert.ok(after.std[0]! < before.std[0]! * 0.75, `std ${before.std[0]} -> ${after.std[0]}`);
  assert.ok(Math.abs(after.mean[0]! - before.mean[0]!) < 0.02, `mean ${before.mean[0]} -> ${after.mean[0]}`);
  assert.ok(seamless(soft.height!, 64, 1).ok, 'the blurred tile has a seam');
  // and it blurs a colour image channel by channel
  const colour = evaluateGraph(
    graph(
      [
        { id: 'c', type: 'constant', value: [1, 0.5, 0] },
        { id: 'k', type: 'constant', value: [0, 0, 0] },
        { id: 'g', type: 'grain', seed: 3 },
        { id: 'm', type: 'blend', a: 'c', b: 'k', mode: 'mix', amount: 0.6, mask: 'g' },
        { id: 'b', type: 'blur', in: 'm', radius: 2 },
      ],
      { albedo: 'b' },
    ),
    { size: 32 },
  );
  assert.ok(colour.albedo, 'a colour blur lost its colour');
  assert.ok(channelStats(colour.albedo!, 32, 3).std[0]! > 0);
});

test('the six new nodes validate their parameters', () => {
  const bad = graph(
    [
      { id: 'a', type: 'noise', scale: 4, scaleY: 2.5, octaves: 2, gain: 0.5, seed: 0 },
      { id: 'b', type: 'hex', count: 4, mode: 'diamond', band: 0.2 },
      { id: 'c', type: 'spots', count: 4, radius: 2, seed: 0 },
      { id: 'd', type: 'weave', threads: 1 },
      { id: 'e', type: 'scratches', count: 4, length: 1.5, width: 0.02, vertical: 'yes' },
      { id: 'f', type: 'blur', in: 'a', radius: 0.5 },
    ],
    { height: 'f' },
  );
  const result = validateGraph(bad);
  assert.equal(result.ok, false);
  const text = result.errors.join('\n');
  assert.ok(text.includes("'scaleY' must be an integer"), text);
  assert.ok(text.includes("'mode' must be 'edge' or 'cell'"), text);
  assert.ok(text.includes("'radius' must be at most 1"), text);
  assert.ok(text.includes("'threads' must be at least 2"), text);
  assert.ok(text.includes("'length' must be at most 1"), text);
  assert.ok(text.includes("'vertical' must be boolean"), text);
  assert.ok(text.includes("'radius' must be an integer"), text);
});

test('a cell count of one is a single hexagon, not a divide by zero', () => {
  const one = evaluateGraph(graph([{ id: 'h', type: 'hex', count: 1, mode: 'cell', seed: 2 }], { height: 'h' }), { size: 32 });
  for (const value of one.height!) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
});

// The min-spec budget is a timing test, so it runs in the timed pass (scripts/test.mjs runs `performance:` tests alone).
test('performance: every tile evaluates at 128 px inside 25 ms', () => {
  for (const g of TILE_LIBRARY_LIST) evaluateGraph(g, { size: 32 }); // warm the JIT before timing
  for (const g of TILE_LIBRARY_LIST) {
    const runs: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const began = performance.now();
      evaluateGraph(g, { size: 128 });
      runs.push(performance.now() - began);
    }
    runs.sort((a, b) => a - b);
    assert.ok(runs[1]! < 25, `${g.id} took ${runs[1]!.toFixed(1)} ms at 128 px`);
  }
});
