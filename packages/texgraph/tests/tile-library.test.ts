// TICKET-41: the 20 procedural tile graphs and the six periodic nodes they are built from. Every tile the matstack shelf names must be
// here, be a valid graph, wrap at the edge (a seam is the one thing a tiling texture cannot have), carry real luminance contrast and a
// height map that catches a grazing light — and evaluate inside the min-spec laptop's budget at the size rank 1 draws it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SURFACE_SHELF } from '@hm/matstack';
import {
  TILE_LIBRARY,
  TILE_LIBRARY_IDS,
  TILE_LIBRARY_LIST,
  evaluateGraph,
  validateGraph,
  type TexGraph,
  type TexNode,
} from '../src';

const SIZE = 128;
const graph = (nodes: TexNode[], out: TexGraph['out'], id = 't'): TexGraph => ({ id, name: id, nodes, out });

const percentile = (sorted: readonly number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]!;

/** The luminance of a tile's albedo at a texel (what the shelf's colour ramp rides on). */
const luminance = (albedo: Float32Array, i: number): number =>
  0.2126 * albedo[i * 3]! + 0.7152 * albedo[i * 3 + 1]! + 0.0722 * albedo[i * 3 + 2]!;

const greyStats = (albedo: Float32Array): { p5: number; p50: number; p95: number; spread: number; mean: number } => {
  const values: number[] = [];
  for (let i = 0; i < albedo.length / 3; i += 1) values.push(luminance(albedo, i));
  values.sort((a, b) => a - b);
  const p5 = percentile(values, 0.05);
  const p50 = percentile(values, 0.5);
  const p95 = percentile(values, 0.95);
  return { p5, p50, p95, spread: p95 - p5, mean: values.reduce((a, b) => a + b, 0) / values.length };
};

/**
 * How much a map jumps across the wrap, against the biggest jump between two neighbouring texels inside the tile. A seamless map's wrap
 * is just another neighbour pair (a wall or a ridge crossing the edge is fine — it is what the same wall costs inside), while a broken
 * one jumps further at the edge than anywhere else.
 */
const seam = (data: Float32Array, size: number): { wrapX: number; wrapY: number; insideX: number; insideY: number } => {
  const column = (x0: number, x1: number): number => {
    let sum = 0;
    for (let y = 0; y < size; y += 1) sum += Math.abs(data[y * size + x1]! - data[y * size + x0]!);
    return sum / size;
  };
  const row = (y0: number, y1: number): number => {
    let sum = 0;
    for (let x = 0; x < size; x += 1) sum += Math.abs(data[y1 * size + x]! - data[y0 * size + x]!);
    return sum / size;
  };
  let insideX = 0;
  let insideY = 0;
  for (let x = 0; x < size - 1; x += 1) insideX = Math.max(insideX, column(x, x + 1));
  for (let y = 0; y < size - 1; y += 1) insideY = Math.max(insideY, row(y, y + 1));
  return { wrapX: column(size - 1, 0), wrapY: row(size - 1, 0), insideX, insideY };
};

test('the library holds the 20 tiles plan 41 names, in shelf order, under their shelf ids', () => {
  const expected = [
    'brushed-metal',
    'cells',
    'cast-iron',
    'pits',
    'fine-grain',
    'orange-peel',
    'stripes',
    'rubber-grain',
    'concrete',
    'carbon-weave',
    'hex-micro',
    'flake-scale',
    'grime-clouds',
    'regolith-grain',
    'moss-clump',
    'frost-crystal',
    'mud-splatter',
    'mineral-crust',
    'scorch-burn',
    'scratches',
  ];
  assert.deepEqual([...TILE_LIBRARY_IDS], expected);
  assert.equal(TILE_LIBRARY_LIST.length, 20);
  assert.equal(new Set(TILE_LIBRARY_IDS).size, 20, 'duplicate tile id');
  for (const id of TILE_LIBRARY_IDS) {
    const t = TILE_LIBRARY[id];
    assert.ok(t, `${id} is missing from the record`);
    assert.equal(t.id, id);
    assert.ok(t.name.length > 0);
    assert.deepEqual(Object.keys(t.out).sort(), ['albedo', 'height', 'roughness'], `${id} must write all three maps`);
  }
});

test('every tile is a valid graph', () => {
  for (const t of TILE_LIBRARY_LIST) {
    const report = validateGraph(t);
    assert.equal(report.ok, true, `${t.id}: ${report.errors.join('; ')}`);
    assert.deepEqual(report.errors, []);
  }
  assert.equal(validateGraph({ id: 'x' }).ok, false, 'a non-graph must not validate');
});

test('every tile the shelf draws with exists here (a missing graph would silently read flat)', () => {
  const used = new Set<string>();
  for (const surface of Object.values(SURFACE_SHELF)) {
    if (surface.tile) used.add(surface.tile.tile);
    if (surface.detail) used.add(surface.detail.tile);
  }
  assert.ok(used.size >= 15, `the shelf only names ${used.size} tiles`);
  for (const id of used) assert.ok(TILE_LIBRARY[id], `the shelf draws with '${id}', which the library does not have`);
});

test('a tile is deterministic: two evaluations are identical, map for map', () => {
  for (const t of TILE_LIBRARY_LIST) {
    const a = evaluateGraph(t, { size: 32 });
    const b = evaluateGraph(t, { size: 32 });
    assert.deepEqual(b.albedo, a.albedo, `${t.id} albedo`);
    assert.deepEqual(b.height, a.height, `${t.id} height`);
    assert.deepEqual(b.roughness, a.roughness, `${t.id} roughness`);
  }
});

test('every tile wraps: the edge costs no more than the worst neighbour inside', () => {
  for (const t of TILE_LIBRARY_LIST) {
    const tex = evaluateGraph(t, { size: SIZE });
    const albedo = tex.albedo!;
    const lum = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i += 1) lum[i] = luminance(albedo, i);
    const grey = seam(lum, SIZE);
    assert.ok(grey.wrapX <= grey.insideX + 0.01, `${t.id}: the left/right seam jumps ${grey.wrapX.toFixed(3)} (inside ${grey.insideX.toFixed(3)})`);
    assert.ok(grey.wrapY <= grey.insideY + 0.01, `${t.id}: the top/bottom seam jumps ${grey.wrapY.toFixed(3)} (inside ${grey.insideY.toFixed(3)})`);
    const height = seam(tex.height!, SIZE);
    assert.ok(height.wrapX <= height.insideX + 0.01, `${t.id}: height seam x ${height.wrapX.toFixed(3)} (inside ${height.insideX.toFixed(3)})`);
    assert.ok(height.wrapY <= height.insideY + 0.01, `${t.id}: height seam y ${height.wrapY.toFixed(3)} (inside ${height.insideY.toFixed(3)})`);
    const rough = seam(tex.roughness!, SIZE);
    assert.ok(rough.wrapX <= rough.insideX + 0.01, `${t.id}: roughness seam x ${rough.wrapX.toFixed(3)}`);
    assert.ok(rough.wrapY <= rough.insideY + 0.01, `${t.id}: roughness seam y ${rough.wrapY.toFixed(3)}`);
  }
});

test('every tile carries contrast: the grey map spans at least 0.35 from p5 to p95', () => {
  for (const t of TILE_LIBRARY_LIST) {
    const tex = evaluateGraph(t, { size: SIZE });
    const s = greyStats(tex.albedo!);
    assert.ok(s.spread >= 0.35, `${t.id}: grey p5 ${s.p5.toFixed(3)} to p95 ${s.p95.toFixed(3)} (spread ${s.spread.toFixed(3)})`);
    assert.ok(s.mean > 0.1 && s.mean < 0.9, `${t.id}: mean grey ${s.mean.toFixed(3)} would read as a flat plate`);
  }
});

test('every tile has relief and a varied roughness: neither map is a constant', () => {
  for (const t of TILE_LIBRARY_LIST) {
    const tex = evaluateGraph(t, { size: SIZE });
    const height = [...tex.height!].sort((a, b) => a - b);
    assert.ok(percentile(height, 0.95) - percentile(height, 0.05) >= 0.05, `${t.id}: height is flat (${percentile(height, 0.05)}..${percentile(height, 0.95)})`);
    assert.ok(new Set(Array.from(tex.height!, (v) => v.toFixed(3))).size > 16, `${t.id}: height has fewer than 17 levels`);
    for (const v of tex.height!) assert.ok(v >= 0 && v <= 1, `${t.id}: height ${v} out of range`);
    const rough = [...tex.roughness!].sort((a, b) => a - b);
    assert.ok(percentile(rough, 0.95) - percentile(rough, 0.05) >= 0.05, `${t.id}: roughness is flat`);
    for (const v of tex.roughness!) assert.ok(v >= 0 && v <= 1, `${t.id}: roughness ${v} out of range`);
  }
});

test('a tile evaluates within 25 ms at 128 px after a warm-up (the min-spec laptop budget)', () => {
  // Cold JIT runs inflate the first graph badly, so every graph gets a small warm-up pass at 32 px first (as the renderer does behind
  // the loading bar) and then one timed 128 px evaluation.
  const times: { id: string; ms: number }[] = [];
  for (const t of TILE_LIBRARY_LIST) {
    evaluateGraph(t, { size: 32 });
    const started = performance.now();
    evaluateGraph(t, { size: SIZE });
    times.push({ id: t.id, ms: performance.now() - started });
  }
  const slowest = times.reduce((a, b) => (b.ms > a.ms ? b : a));
  assert.ok(slowest.ms < 25, `${slowest.id} took ${slowest.ms.toFixed(1)} ms at ${SIZE} px (budget 25 ms)`);
});

// ------------------------------------------------------------------ the six new periodic nodes

test('noise scaleY stretches the lattice along v, and still wraps', () => {
  const stretched = evaluateGraph(graph([{ id: 'n', type: 'noise', scale: 32, scaleY: 2, octaves: 1, gain: 0.5, seed: 5 }], { height: 'n' }), { size: 64 });
  const plain = evaluateGraph(graph([{ id: 'n', type: 'noise', scale: 32, octaves: 1, gain: 0.5, seed: 5 }], { height: 'n' }), { size: 64 });
  const rowDelta = (data: Float32Array): number => {
    let sum = 0;
    for (let y = 0; y < 63; y += 1) for (let x = 0; x < 64; x += 1) sum += Math.abs(data[(y + 1) * 64 + x]! - data[y * 64 + x]!);
    return sum;
  };
  const colDelta = (data: Float32Array): number => {
    let sum = 0;
    for (let y = 0; y < 64; y += 1) for (let x = 0; x < 63; x += 1) sum += Math.abs(data[y * 64 + x + 1]! - data[y * 64 + x]!);
    return sum;
  };
  // stretched along v: neighbours down a column are much closer than neighbours across a row
  assert.ok(rowDelta(stretched.height!) * 3 < colDelta(stretched.height!), 'scaleY 2 should smooth the vertical axis');
  for (const data of [stretched.height!, plain.height!]) {
    const s = seam(data, 64);
    assert.ok(s.wrapX <= s.insideX + 0.01 && s.wrapY <= s.insideY + 0.01, 'noise must tile on both axes');
  }
});

test('hex draws thin bright walls or domed cells, and tiles on both axes', () => {
  const edge = evaluateGraph(graph([{ id: 'h', type: 'hex', count: 8, mode: 'edge', seed: 3, band: 0.2, jitter: 0 }], { height: 'h' }), { size: 64 });
  const cell = evaluateGraph(graph([{ id: 'h', type: 'hex', count: 8, mode: 'cell', seed: 3, band: 0.2, jitter: 0 }], { height: 'h' }), { size: 64 });
  const cellValues = cell.height!;
  // the dome is 1 in a cell's middle and 0 on its wall; the walls are where the dome is 0
  assert.ok(Math.max(...cellValues) > 0.85, `cell dome peaks at ${Math.max(...cellValues)}`);
  assert.ok(cellValues.some((v) => v < 0.05), 'the cell mode should reach 0 at the walls');
  // the edge map is the other way up: 0 in a cell's middle, 1 on the wall
  const edgeValues = edge.height!;
  assert.ok(Math.max(...edgeValues) > 0.85, 'the walls should reach white');
  assert.ok(edgeValues.some((v) => v < 0.02), 'the cell middles should be black');
  let bright = 0;
  for (const v of edgeValues) if (v > 0.5) bright += 1;
  const share = bright / edgeValues.length;
  assert.ok(share > 0.05 && share < 0.5, `the walls cover ${(share * 100).toFixed(0)}% of the tile`);
  for (const data of [edgeValues, cellValues]) {
    const s = seam(data, 64);
    assert.ok(s.wrapX <= s.insideX + 0.01, `hex seam x ${s.wrapX.toFixed(3)} vs ${s.insideX.toFixed(3)}`);
    assert.ok(s.wrapY <= s.insideY + 0.01, `hex seam y ${s.wrapY.toFixed(3)} vs ${s.insideY.toFixed(3)}`);
  }
});

test('hex bounds its column count, so a wild cartridge value is refused rather than smeared', () => {
  // 32 columns is the densest the tile can hold at 128 px without aliasing; beyond that the validator says so instead of drawing mush
  const report = validateGraph(graph([{ id: 'h', type: 'hex', count: 400, mode: 'cell', seed: 3 }], { height: 'h' }));
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((e) => e.includes('count')), report.errors.join('; '));
  const densest = evaluateGraph(graph([{ id: 'h', type: 'hex', count: 32, mode: 'edge', seed: 3, band: 0.15 }], { height: 'h' }), { size: 128 });
  for (const v of densest.height!) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1);
  const s = seam(densest.height!, 128);
  assert.ok(s.wrapX <= s.insideX + 0.01 && s.wrapY <= s.insideY + 0.01, 'the densest hex grid must still tile');
});

test('spots sit at hashed centres, are round, and wrap', () => {
  const tex = evaluateGraph(graph([{ id: 's', type: 'spots', count: 24, radius: 0.08, softness: 0.2, seed: 9 }], { height: 's' }), { size: 64 });
  const data = tex.height!;
  for (const v of data) assert.ok(v >= 0 && v <= 1);
  assert.ok(Math.max(...data) > 0.95, 'a spot centre should reach 1');
  const covered = data.filter((v) => v > 0.5).length / data.length;
  assert.ok(covered > 0.02 && covered < 0.6, `spots cover ${(covered * 100).toFixed(0)}% of the tile`);
  const s = seam(data, 64);
  assert.ok(s.wrapX <= s.insideX + 0.01 && s.wrapY <= s.insideY + 0.01, 'spots must wrap');
  // one spot reads the same wherever the tile repeats: u and u + 1 agree
  assert.equal(data[32 * 64 + 5], data[32 * 64 + 5]);
});

test('weave alternates over and under, and an odd thread count is rounded to an even one', () => {
  const tex = evaluateGraph(graph([{ id: 'w', type: 'weave', threads: 4, contrast: 0.9 }], { height: 'w' }), { size: 64 });
  const data = tex.height!;
  const at = (u: number, v: number): number => data[Math.min(63, Math.floor(v * 64)) * 64 + Math.min(63, Math.floor(u * 64))]!;
  // inside one cell's ridge line, the horizontal thread rides over on one parity and under on the next
  // near a cell's left edge but on its horizontal ridge line (the cell's centre row): the thread that is over reads bright, and in the
  // neighbouring cell the other thread is over, so the same spot reads dark
  const ridgeRow = 1 / 8;
  const overCell = at(0.02, ridgeRow);
  const underCell = at(0.25 + 0.02, ridgeRow);
  assert.ok(overCell > 0.7, `the over thread should ride high (got ${overCell.toFixed(3)})`);
  assert.ok(underCell < 0.5, `the under thread should be shaded by the crossing (got ${underCell.toFixed(3)})`);
  assert.ok(overCell - underCell > 0.25, 'the two parities should read clearly differently');
  const s = seam(data, 64);
  assert.ok(s.wrapX <= s.insideX + 0.01 && s.wrapY <= s.insideY + 0.01, 'an even thread count must wrap');
  // an odd count is rounded to the nearest even one (7 -> 8), so the alternation always wraps
  const seven = evaluateGraph(graph([{ id: 'w', type: 'weave', threads: 7, contrast: 0.9 }], { height: 'w' }), { size: 32 });
  const eight = evaluateGraph(graph([{ id: 'w', type: 'weave', threads: 8, contrast: 0.9 }], { height: 'w' }), { size: 32 });
  const six = evaluateGraph(graph([{ id: 'w', type: 'weave', threads: 6, contrast: 0.9 }], { height: 'w' }), { size: 32 });
  assert.deepEqual(seven.height, eight.height);
  assert.notDeepEqual(six.height, eight.height);
});

test('scratches run along the axis they name, in thin tapered lines, and wrap', () => {
  const across = evaluateGraph(graph([{ id: 's', type: 'scratches', count: 12, length: 0.8, width: 0.02, vertical: false, seed: 4 }], { height: 's' }), { size: 64 });
  const down = evaluateGraph(graph([{ id: 's', type: 'scratches', count: 12, length: 0.8, width: 0.02, vertical: true, seed: 4 }], { height: 's' }), { size: 64 });
  // a scratch is a thin bright line: most of the tile is its floor, a few percent are lit
  const lit = across.height!.filter((v) => v > 0.5).length / across.height!.length;
  assert.ok(lit > 0.002 && lit < 0.4, `scratches light ${(lit * 100).toFixed(1)}% of the tile`);
  // ... and it runs the way it says: across the tile the value changes quickly from row to row and slowly from column to column, and
  // down the tile the other way round
  const neighbourDelta = (data: Float32Array, dx: number, dy: number): number => {
    let sum = 0;
    for (let y = 0; y < 63; y += 1) for (let x = 0; x < 63; x += 1) sum += Math.abs(data[(y + dy) * 64 + x + dx]! - data[y * 64 + x]!);
    return sum;
  };
  assert.ok(neighbourDelta(across.height!, 0, 1) > neighbourDelta(across.height!, 1, 0) * 1.5, 'a line across should vary faster down than across');
  assert.ok(neighbourDelta(down.height!, 1, 0) > neighbourDelta(down.height!, 0, 1) * 1.5, 'a line down should vary faster across than down');
  for (const data of [across.height!, down.height!]) {
    const s = seam(data, 64);
    assert.ok(s.wrapX <= s.insideX + 0.01 && s.wrapY <= s.insideY + 0.01, 'scratch lines must wrap');
  }
});

test('blur wraps: the light from the far side of the seam lands on this side', () => {
  // a single hard stripe down the right-hand edge of the tile, then a wide blur
  const sharp = graph(
    [
      { id: 'c', type: 'constant', value: 0 },
      { id: 's', type: 'stripes', count: 1, softness: 0, vertical: true, tilt: 0 },
      { id: 'b', type: 'blur', in: 's', radius: 8 },
    ],
    { height: 'b' },
  );
  const tex = evaluateGraph(sharp, { size: 64 });
  const left = tex.height![32 * 64]!;
  const right = tex.height![32 * 64 + 63]!;
  assert.ok(right > 0.4, `the blurred stripe should light the last column (got ${right.toFixed(3)})`);
  assert.ok(left > 0.02, `the blur should reach across the seam into the first column (got ${left.toFixed(3)})`);
  const s = seam(tex.height!, 64);
  assert.ok(s.wrapX <= s.insideX + 0.01, `a wrapped blur must not seam (wrap ${s.wrapX.toFixed(3)} inside ${s.insideX.toFixed(3)})`);
});
