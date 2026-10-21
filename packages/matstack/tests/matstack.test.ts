import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blendInput,
  features,
  featureKey,
  flatten,
  hexToLinear,
  inputValue,
  layerWeight,
  levels,
  maskAt,
  materialAt,
  rampAt,
  seedOffset,
  smoothstep,
  srgbToLinear,
  surfaceAt,
  EDGE_BAND,
  FLAT_TILE,
  type LayerSpec,
  type MaskInput,
  type MaskSpec,
  type MaterialSpec,
  type NoiseSource,
  type SamplePoint,
  type SurfaceSpec,
  type TileSource,
} from '../src/index';

const close = (a: number, b: number, eps = 1e-6, what = ''): void => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} != ${b}`);
const fract = (x: number): number => x - Math.floor(x);

/** Test sources whose values are plain functions of (u, v), so expected values can be worked out by hand. */
const tiles: TileSource = {
  sample: (tile, u, v) =>
    tile === 'ramp-u' ? { grey: fract(u), height: fract(v), rough: 0.25 } : tile === 'high' ? { grey: 1, height: 1, rough: 1 } : FLAT_TILE,
};
const noise: NoiseSource = { sample: (kind, u, v) => (kind === 'clouds' ? fract(u) : kind === 'cells' ? fract(v) : 0.5) };

const point = (o: Partial<SamplePoint> = {}): SamplePoint => ({
  uv: [0, 0], pos: [0, 0, 0], normal: [0, 1, 0], edge: EDGE_BAND, cavity: EDGE_BAND, ...o,
});
const base = { blend: 'normal', opacity: 1, invert: false } as const;
const mask = (inputs: MaskInput[], o: Partial<MaskSpec> = {}): MaskSpec => ({ name: 'm', inputs, balance: 0, contrast: 0, invert: false, ...o });
const steel: SurfaceSpec = { name: 'steel', colour: '#808080', metal: 1, rough: 0.4, specular: 0.5 };
const rust: SurfaceSpec = { name: 'rust', colour: '#8a3b12', metal: 0, rough: 0.9, specular: 0.5 };
const layer = (o: Partial<LayerSpec> = {}): LayerSpec => ({
  name: 'rust', surface: rust, mask: mask([{ ...base, kind: 'all' }]), opacity: 1, writes: ['colour', 'rough', 'metal'],
  heightBlend: 0, weathering: false, visible: true, ...o,
});
const material = (layers: LayerSpec[], o: Partial<MaterialSpec> = {}): MaterialSpec => ({
  name: 't', base: steel, paint: ['#3c9a5a', '#e5b84a'], layers, age: 1, ...o,
});

test('maths matches GLSL: smoothstep, sRGB to linear, the seed shift', () => {
  close(smoothstep(0, 1, 0.5), 0.5);
  close(smoothstep(0, 1, 0.25), 0.15625);
  close(smoothstep(0, 1, -1), 0);
  close(srgbToLinear(1), 1, 1e-6);
  close(srgbToLinear(0.5), 0.21404, 1e-4);
  close(hexToLinear('#808080')[0], 0.21586, 1e-4);
  assert.deepEqual(hexToLinear('nonsense'), hexToLinear('#808080'));
  assert.deepEqual(seedOffset(0), [0, 0]);
  close(seedOffset(1)[0], 0.618034);
  close(seedOffset(1)[1], 0.414214);
  close(seedOffset(3)[0], fract(3 * 0.618034));
});

test('edges and cavities fade over their width from the crease, capped at the band', () => {
  const e = { ...base, kind: 'edge', width: 0.01 } as const;
  close(inputValue(e, point({ edge: 0 }), noise), 1);
  close(inputValue(e, point({ edge: 0.005 }), noise), 0.5);
  close(inputValue(e, point({ edge: 0.02 }), noise), 0);
  // a width past the band reads as the band
  close(inputValue({ ...e, width: 1 }, point({ edge: EDGE_BAND / 2 }), noise), 0.5);
  close(inputValue({ ...base, kind: 'cavity', width: 0.02 }, point({ cavity: 0.01 }), noise), 0.5);
});

test('up and down read the normal in degrees; ground reads the height above the foot', () => {
  const up = { ...base, kind: 'up', angle: 30, soft: 10 } as const;
  close(inputValue(up, point({ normal: [0, 1, 0] }), noise), 1);
  const s30 = Math.sin(Math.PI / 6), c30 = Math.cos(Math.PI / 6);
  close(inputValue(up, point({ normal: [s30, c30, 0] }), noise), 0.5, 1e-6);
  close(inputValue(up, point({ normal: [1, 0, 0] }), noise), 0);
  close(inputValue({ ...up, kind: 'down' }, point({ normal: [0, -1, 0] }), noise), 1);
  close(inputValue({ ...up, kind: 'down' }, point({ normal: [0, 1, 0] }), noise), 0);
  const g = { ...base, kind: 'ground', height: 0.2, soft: 0.1 } as const;
  close(inputValue(g, point({ pos: [0, 0.2, 0] }), noise), 0.5);
  close(inputValue(g, point({ pos: [0, 0.05, 0] }), noise), 1);
  close(inputValue(g, point({ pos: [0, 0.35, 0] }), noise), 0);
});

test('noise samples the box UV per scale, shifted by the seed; streaks run down side faces only', () => {
  const n = { ...base, kind: 'noise', noise: 'clouds', scale: 0.5, seed: 0 } as const;
  close(inputValue(n, point({ uv: [0.2, 0] }), noise), 0.4);
  close(inputValue({ ...n, seed: 1 }, point({ uv: [0.2, 0] }), noise), fract(0.4 + 0.618034));
  const st = { ...base, kind: 'streaks', scale: 1, stretch: 8, seed: 0 } as const;
  close(inputValue(st, point({ normal: [0, 1, 0] }), noise), 0);
  // a face looking +z: tangent (1, 0) so u = pos.x
  close(inputValue(st, point({ normal: [0, 0, 1], pos: [0.3, 1, 0] }), noise), 0.3);
  // a sloped face fades by its horizontal share
  const L = Math.SQRT1_2;
  close(inputValue(st, point({ normal: [0, L, L], pos: [0.3, 1, 0] }), noise), 0.3 * L, 1e-6);
});

test('inputs fold in order with their blend modes; levels and invert finish the mask', () => {
  close(blendInput('normal', 0.2, 1, 0.5), 0.6);
  close(blendInput('add', 0.6, 1, 0.5), 1);
  close(blendInput('subtract', 0.6, 1, 0.5), 0.1);
  close(blendInput('multiply', 0.8, 0.5, 1), 0.4);
  close(blendInput('multiply', 0.8, 0.5, 0.5), 0.6);
  close(blendInput('max', 0.3, 0.8, 0.5), 0.4);
  close(blendInput('min', 0.3, 0.2, 1), 0.2);
  close(levels(0.37, 0, 0), 0.37);
  close(levels(0.6, 0, 1), 1);
  close(levels(0.4, 0, 1), 0);
  close(levels(0.3, 1, 0), 0.8); // balance up shows more
  // edge chips: the edge times clouds, hard thresholded
  const chips = mask([{ ...base, kind: 'edge', width: 0.01 }, { ...base, kind: 'noise', noise: 'clouds', scale: 1, seed: 0, blend: 'multiply' }], { contrast: 1 });
  close(maskAt(chips, point({ edge: 0, uv: [0.7, 0] }), noise), 1);
  close(maskAt(chips, point({ edge: 0, uv: [0.3, 0] }), noise), 0);
  close(maskAt(chips, point({ edge: 0.02, uv: [0.7, 0] }), noise), 0);
  close(maskAt({ ...chips, invert: true }, point({ edge: 0, uv: [0.7, 0] }), noise), 0);
  close(maskAt(mask([{ ...base, kind: 'all', invert: true }]), point(), noise), 0);
});

test('a surface reads its tile: ramp colour from grey, roughness and height variation, detail on top', () => {
  const ramped: SurfaceSpec = {
    ...rust, ramp: [{ at: 1, colour: '#ffffff' }, { at: 0, colour: '#000000' }],
    tile: { tile: 'ramp-u', scale: 2, bump: 0.5, roughVar: 1, colourVar: 0 },
  };
  const c = surfaceAt(ramped, point({ uv: [1, 1.5] }), ['#000000', '#000000'], tiles); // u = 0.5, v = 0.75
  close(c.colour[0], 0.5); // interpolated in linear, stops sorted
  close(c.rough, 0.9 + (0.25 - 0.5) * 2); // 0.4
  close(c.height, 0.5 + 0.25 * 0.5);
  const painted: SurfaceSpec = { ...steel, colour: 'paint1', tile: { tile: 'high', scale: 1, bump: 1, roughVar: 0, colourVar: 0.5 }, detail: { tile: 'high', scale: 0.1, bump: 0.2, roughVar: 0.1 } };
  const p = surfaceAt(painted, point(), ['#808080', '#000000'], tiles);
  close(p.colour[0], hexToLinear('#808080')[0] * 1.5, 1e-6);
  close(p.rough, 0.4 + 0.1);
  close(p.height, 1); // 1 + 0.1 clamped
  const off = surfaceAt(steel, point(), ['#000000', '#000000'], tiles);
  close(off.height, 0.5);
  close(off.coatRough, 0.1);
  close(off.filmThickness, 400);
  assert.deepEqual(off.emit, [0, 0, 0]);
  close(rampAt([{ at: 0.5, colour: '#ffffff' }, { at: 1, colour: '#000000' }], 0.1)[0], 1);
});

test('a layer mixes over the base in the channels it writes, by its weight', () => {
  const half = material([layer({ opacity: 0.5, writes: ['colour'] })]);
  const c = materialAt(half, point(), tiles, noise);
  const g = hexToLinear('#808080'), r = hexToLinear('#8a3b12');
  close(c.colour[0], (g[0] + r[0]) / 2);
  close(c.rough, 0.4); // not written
  close(c.metal, 1);
  const full = materialAt(material([layer()]), point(), tiles, noise);
  close(full.rough, 0.9);
  close(full.metal, 0);
  // hidden layers and zero opacity do nothing
  close(materialAt(material([layer({ visible: false })]), point(), tiles, noise).rough, 0.4);
  close(materialAt(material([layer({ opacity: 0 })]), point(), tiles, noise).rough, 0.4);
  // later layers go on top
  const dust: SurfaceSpec = { ...rust, name: 'dust', rough: 0.95 };
  close(materialAt(material([layer(), layer({ surface: dust, writes: ['rough'] })]), point(), tiles, noise).rough, 0.95);
});

test('weathering spreads with age from where the mask is strongest; height blend steers the edge', () => {
  const g = mask([{ ...base, kind: 'all', opacity: 0.75 }]); // mask 0.75 everywhere
  const w = layer({ mask: g, weathering: true });
  close(layerWeight(w, 0.5, point(), 0.5, noise), 0.5); // (0.75 + 0.5 - 1) / 0.5
  close(layerWeight(w, 0.5, point(), 1, noise), 0.75);
  close(layerWeight(w, 0.5, point(), 0, noise), 0);
  close(layerWeight(w, 0.5, point(), 0.2, noise), 0); // below its threshold
  const hb = layer({ mask: mask([{ ...base, kind: 'all', opacity: 0.5 }]), heightBlend: 1 });
  close(layerWeight(hb, 0.75, point(), 1, noise), 1);
  close(layerWeight(hb, 0.25, point(), 1, noise), 0);
  close(layerWeight(hb, 0.5, point(), 1, noise), 0.5);
});

test('flatten evaluates per vertex; features and the cache key count only what draws', () => {
  const chips = mask([{ ...base, kind: 'edge', width: 0.01 }], { contrast: 1 });
  const m = material([layer({ mask: chips })]);
  const f = flatten(m, [point({ edge: 0 }), point({ edge: 0.04 })], tiles, noise);
  close(f.rough[0]!, 0.9);
  close(f.rough[1]!, 0.4);
  close(f.metal[0]!, 0);
  close(f.colour[0]!, hexToLinear('#8a3b12')[0], 1e-6);
  assert.equal(f.colour.length, 6);
  const coated = material([
    layer({ surface: { ...rust, coat: { amount: 0.6, rough: 0.2 }, tile: { tile: 'ramp-u', scale: 1, bump: 0.3, roughVar: 0.2, colourVar: 0 } } }),
    layer({ visible: false, surface: { ...rust, film: { amount: 1, thickness: 500 } } }),
  ]);
  const ft = features(coated);
  assert.equal(ft.layers, 1);
  assert.equal(ft.coat, true);
  assert.equal(ft.film, false); // only on a hidden layer
  assert.equal(featureKey(ft), 'L1 t c');
  assert.equal(featureKey(features(material([]))), 'L0');
});

test('degenerate input never yields NaN, and evaluation is deterministic', () => {
  const m = material([layer({ mask: mask([{ ...base, kind: 'streaks', scale: 0, stretch: 0, seed: 7 }, { ...base, kind: 'up', angle: 0, soft: 0, blend: 'add' }]) })]);
  const odd = point({ normal: [0, 0, 0], uv: [1e9, -1e9] });
  const a = materialAt(m, odd, tiles, noise), b = materialAt(m, odd, tiles, noise);
  assert.deepEqual(a, b);
  for (const v of [...a.colour, a.rough, a.metal, a.height]) assert.ok(Number.isFinite(v));
});
