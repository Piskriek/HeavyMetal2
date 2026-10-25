import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isHex,
  materialAt,
  resolveMatPreset,
  CHANNEL_GROUPS,
  EDGE_BAND,
  FLAT_TILE,
  LAYER_SHELF,
  MASK_SHELF,
  MATERIAL_ALIASES,
  MATERIAL_SHELF,
  MAX_LAYERS,
  MAX_MASK_INPUTS,
  MAX_RAMP_STOPS,
  PAINT_REFS,
  SURFACE_SHELF,
  type MaskSpec,
  type SamplePoint,
  type SurfaceSpec,
} from '../src/index';

const in01 = (x: number): boolean => x >= 0 && x <= 1;
const colourOk = (c: string): boolean => isHex(c) || (PAINT_REFS as readonly string[]).includes(c);

function surfaceProblems(s: SurfaceSpec): string[] {
  const out: string[] = [];
  if (!colourOk(s.colour)) out.push(`colour ${s.colour}`);
  for (const k of ['metal', 'rough', 'specular'] as const) if (!in01(s[k])) out.push(`${k} ${s[k]}`);
  if (s.ramp && (s.ramp.length > MAX_RAMP_STOPS || s.ramp.some((r) => !isHex(r.colour) || !in01(r.at)))) out.push('ramp');
  if (s.tile && !(s.tile.scale > 0)) out.push('tile scale');
  if (s.detail && !(s.detail.scale > 0)) out.push('detail scale');
  return out;
}

function maskProblems(m: MaskSpec): string[] {
  const out: string[] = [];
  if (m.inputs.length < 1 || m.inputs.length > MAX_MASK_INPUTS) out.push(`${m.inputs.length} inputs`);
  if (m.balance < -1 || m.balance > 1 || !in01(m.contrast)) out.push('levels');
  for (const i of m.inputs) {
    if (!in01(i.opacity)) out.push(`${i.kind} opacity`);
    if ((i.kind === 'edge' || i.kind === 'cavity') && !(i.width > 0 && i.width <= EDGE_BAND)) out.push(`${i.kind} width ${i.width}`);
  }
  return out;
}

test('the first shelf: 29 surfaces, 13 masks, 16 layers, 16 materials (Argo, plan 41 section 4.9)', () => {
  assert.equal(Object.keys(SURFACE_SHELF).length, 29);
  // 'seeps' (oil under edges and in creases) and 'soot-fall' (tops and undersides) joined the 11 in the 22 Oct review
  assert.equal(Object.keys(MASK_SHELF).length, 13);
  assert.equal(Object.keys(LAYER_SHELF).length, 16);
  assert.equal(Object.keys(MATERIAL_SHELF).length, 16);
});

test('every preset stays inside the contract: colours, ranges, input and layer counts', () => {
  const problems: string[] = [];
  for (const [id, s] of Object.entries(SURFACE_SHELF)) for (const p of surfaceProblems(s)) problems.push(`surface ${id}: ${p}`);
  for (const [id, m] of Object.entries(MASK_SHELF)) for (const p of maskProblems(m)) problems.push(`mask ${id}: ${p}`);
  for (const [id, l] of Object.entries(LAYER_SHELF)) {
    for (const p of [...surfaceProblems(l.surface), ...maskProblems(l.mask)]) problems.push(`layer ${id}: ${p}`);
    if (!in01(l.opacity) || !in01(l.heightBlend)) problems.push(`layer ${id}: opacity or height blend`);
    if (l.writes.some((w) => !(CHANNEL_GROUPS as readonly string[]).includes(w))) problems.push(`layer ${id}: writes`);
  }
  for (const [id, m] of Object.entries(MATERIAL_SHELF)) {
    if (!id.startsWith('mat:')) problems.push(`material ${id}: id`);
    if (m.layers.length > MAX_LAYERS) problems.push(`material ${id}: ${m.layers.length} layers`);
    if (!m.paint.every(isHex)) problems.push(`material ${id}: paint`);
    if (!in01(m.age)) problems.push(`material ${id}: age`);
    for (const p of surfaceProblems(m.base)) problems.push(`material ${id} base: ${p}`);
    for (const l of m.layers) for (const p of [...surfaceProblems(l.surface), ...maskProblems(l.mask)]) problems.push(`material ${id} layer ${l.name}: ${p}`);
  }
  assert.deepEqual(problems, []);
});

test('every material id and alias resolves', () => {
  for (const id of Object.keys(MATERIAL_SHELF)) assert.ok(resolveMatPreset(id), id);
  for (const [alias, target] of Object.entries(MATERIAL_ALIASES)) {
    assert.ok(MATERIAL_SHELF[target], `${alias} -> ${target}`);
    assert.equal(resolveMatPreset(alias), MATERIAL_SHELF[target]);
  }
  assert.equal(resolveMatPreset('mat:no-such-material'), undefined);
});

test('every material evaluates to finite channels on a face, an edge, a crease, a top and the splash zone', () => {
  const tiles = { sample: () => FLAT_TILE };
  const noise = { sample: (_k: string, u: number, v: number) => (Math.sin(u * 12.9898 + v * 78.233) * 0.5 + 0.5) };
  const points: SamplePoint[] = [
    { uv: [0.3, 0.7], pos: [0.3, 1.2, 0], normal: [0, 0, 1], edge: EDGE_BAND, cavity: EDGE_BAND },
    { uv: [0.3, 0.7], pos: [0.3, 1.2, 0], normal: [0, 0, 1], edge: 0, cavity: EDGE_BAND },
    { uv: [0.3, 0.7], pos: [0.3, 0.2, 0], normal: [1, 0, 0], edge: EDGE_BAND, cavity: 0.002 },
    { uv: [0.5, 0.5], pos: [0.5, 2, 0.5], normal: [0, 1, 0], edge: EDGE_BAND, cavity: EDGE_BAND },
    { uv: [0.1, 0.05], pos: [0.1, 0.05, 0], normal: [0, 0, 1], edge: EDGE_BAND, cavity: EDGE_BAND },
  ];
  for (const [id, m] of Object.entries(MATERIAL_SHELF)) {
    for (const p of points) {
      const c = materialAt(m, p, tiles, noise);
      for (const v of [...c.colour, c.metal, c.rough, c.specular, c.height, c.coat, c.fuzz, c.aniso, c.film, ...c.emit]) assert.ok(Number.isFinite(v), id);
    }
  }
});
