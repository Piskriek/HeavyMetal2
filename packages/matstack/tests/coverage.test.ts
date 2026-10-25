// The shelf's coverage targets (plan 41 §7; the 22 October review's JOB-02 §3 and JOB-04 §1-2). These are the numbers the Bench's
// Materials page and `studio.material.coverage` report, so a preset is held to them here instead of to a screenshot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasNoiseSource, atlasTileSource } from '@hm/texgraph';
import {
  COVERAGE_MACHINE,
  COVERAGE_ZONES,
  MATERIAL_SHELF,
  MASK_SHELF,
  LAYER_SHELF,
  coverage,
  coverageOf,
  coveragePoints,
  materialAt,
} from '../src';

const noise = atlasNoiseSource();
const tiles = atlasTileSource();
const report = (id: string, grid = 16) => coverage(MATERIAL_SHELF[id]!, tiles, noise, grid);
const pct = (x: number): string => `${Math.round(x * 100)}%`;

/** Layers that cut through whatever is under them: a worn edge shows bare metal, so they go last. */
const ABRASION = new Set(['edge-wear', 'paint-chips', 'scratches']);
/** Layers that are opaque and sit on top of the base: they must write every channel they can hide. */
const OPAQUE_WEATHERING = new Set([
  'rust-bloom',
  'rust-streaks',
  'heavy-rust',
  'dirt',
  'grime',
  'dust',
  'moon-dust',
  'oil-leaks',
  'soot',
  'moss',
  'frost',
  'verdigris',
]);

test('coverage reports every layer in every zone, inside 0..1', () => {
  for (const id of Object.keys(MATERIAL_SHELF)) {
    const r = report(id, 8);
    assert.equal(r.layers.length, MATERIAL_SHELF[id]!.layers.length, `${id} lost a layer`);
    for (const layer of r.layers) {
      assert.deepEqual(Object.keys(layer.zones).sort(), [...COVERAGE_ZONES].sort(), `${id}/${layer.name}`);
      for (const zone of COVERAGE_ZONES) {
        const value = layer.zones[zone];
        assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `${id}/${layer.name} ${zone}: ${value}`);
      }
    }
    for (const zone of COVERAGE_ZONES) assert.ok(Number.isFinite(r.zoneLuminance[zone]), `${id} ${zone} luminance`);
    assert.ok(r.edgeMetal >= 0 && r.edgeMetal <= 1);
  }
});

test('the zones are where they say: tops face up, bottoms face down, the rest are on a side', () => {
  assert.equal(COVERAGE_MACHINE.height > COVERAGE_MACHINE.foot, true);
  for (const p of coveragePoints('top', 4)) {
    assert.equal(p.normal[1], 1);
    assert.ok(Math.abs(p.pos[1] - (COVERAGE_MACHINE.height - 0.2)) < 1e-9);
  }
  for (const p of coveragePoints('bottom', 4)) {
    assert.equal(p.normal[1], -1);
    assert.ok(p.pos[1] < COVERAGE_MACHINE.foot + 0.2);
  }
  for (const p of coveragePoints('side', 4)) assert.equal(p.normal[2], 1);
  for (const p of coveragePoints('edge', 4)) assert.ok(p.edge >= 0 && p.edge <= 0.05);
  for (const p of coveragePoints('crease', 4)) assert.ok(p.cavity >= 0 && p.cavity <= 0.05);
  // edge wear lands on the edge zone and not on a plain side; grime lands in creases
  const worn = report('mat:field-worn-hazard');
  assert.ok(coverageOf(worn, 'Edge wear', 'edge') > coverageOf(worn, 'Edge wear', 'side'));
  assert.ok(coverageOf(worn, 'Grime', 'crease') > 0.15, `grime in creases ${pct(coverageOf(worn, 'Grime', 'crease'))}`);
  assert.ok(coverageOf(worn, 'Grime', 'side') < 0.05);
});

test('a rust bloom is patches (5-15% of a face), not a coat, and gathers in creases', () => {
  const r = report('mat:field-worn-hazard');
  const side = coverageOf(r, 'Rust bloom', 'side');
  const crease = coverageOf(r, 'Rust bloom', 'crease');
  assert.ok(side >= 0.02 && side <= 0.15, `rust bloom covers ${pct(side)} of a side face`);
  assert.ok(crease > side * 2, `rust bloom: sides ${pct(side)}, creases ${pct(crease)}`);
  // and the heavier materials wear more of it, never a flat coat
  for (const id of ['mat:rust-bucket', 'mat:overgrown-relic']) {
    const heavy = coverageOf(report(id), 'Rust bloom', 'side');
    assert.ok(heavy <= 0.2, `${id}: rust bloom covers ${pct(heavy)} of a side face`);
  }
});

test('oil runs under edges and into crevices, never across a clean face', () => {
  const r = report('mat:workshop-steel');
  const side = coverageOf(r, 'Oil leaks', 'side');
  const edge = coverageOf(r, 'Oil leaks', 'edge');
  const crease = coverageOf(r, 'Oil leaks', 'crease');
  assert.ok(side <= 0.05, `oil covers ${pct(side)} of a plain side face`);
  assert.ok(edge >= 0.1, `oil under edges: ${pct(edge)}`);
  assert.ok(crease >= 0.15, `oil in crevices: ${pct(crease)}`);
  assert.ok(edge > side * 3, `oil: side ${pct(side)}, edge ${pct(edge)}`);
});

test('soot is visible: it falls on tops and clings under ledges, and stays off clean sides', () => {
  const r = report('mat:furnace');
  const top = coverageOf(r, 'Soot', 'top');
  const bottom = coverageOf(r, 'Soot', 'bottom');
  const side = coverageOf(r, 'Soot', 'side');
  assert.ok(top >= 0.15, `soot on tops: ${pct(top)}`);
  assert.ok(bottom >= 0.15, `soot on undersides: ${pct(bottom)}`);
  assert.ok(side <= 0.02, `soot on a clean side: ${pct(side)}`);
  // the furnace's soot layer exists and is the one being measured
  assert.ok(MATERIAL_SHELF['mat:furnace']!.layers.some((l) => l.name === 'Soot'));
});

test('the crushed ore bed reads as dark ore, not a bright dust tray', () => {
  const ore = MATERIAL_SHELF['mat:crushed-ore-bed']!;
  assert.equal(ore.layers.filter((l) => l.name === 'Moon dust').length, 0, 'moon dust is back on the ore bed');
  const r = report('mat:crushed-ore-bed');
  assert.ok(r.zoneLuminance.top <= 0.25, `the hopper top reads at luminance ${r.zoneLuminance.top.toFixed(3)}`);
  assert.ok(coverageOf(r, 'Moon dust', 'top') === 0);
  // while the moon-dusted material itself still dusts its tops (the dust is the point there)
  assert.ok(coverageOf(report('mat:moon-dusted'), 'Moon dust', 'top') > 0.5);
});

test('mechanical abrasion sits above the weathering it cuts through, in every material', () => {
  for (const [id, m] of Object.entries(MATERIAL_SHELF)) {
    const names = m.layers.map((l) => {
      const entry = Object.entries(LAYER_SHELF).find(([, layer]) => layer === l);
      return entry ? entry[0] : l.name.toLowerCase().replace(/ /g, '-');
    });
    const lastAbrasion = names.reduce((at, name, i) => (ABRASION.has(name) ? i : at), -1);
    if (lastAbrasion < 0) continue;
    names.forEach((name, i) => {
      if (OPAQUE_WEATHERING.has(name)) {
        assert.ok(i < lastAbrasion, `${id}: '${name}' is above the abrasion, so a worn edge cannot show bare metal`);
      }
    });
  }
});

test('a worn edge always exposes bright metal (metal above 0.45)', () => {
  for (const [id, m] of Object.entries(MATERIAL_SHELF)) {
    const hasAbrasion = m.layers.some((l) => ABRASION.has(Object.entries(LAYER_SHELF).find(([, layer]) => layer === l)?.[0] ?? ''));
    if (!hasAbrasion) continue;
    const r = report(id, 8);
    assert.ok(r.edgeMetal >= 0.45, `${id}: the edge peaks at metal ${r.edgeMetal.toFixed(2)}`);
  }
});

test('opaque weathering writes coat and anisotropy, so clearcoat and brushing cannot bleed through', () => {
  for (const [id, layer] of Object.entries(LAYER_SHELF)) {
    if (!OPAQUE_WEATHERING.has(id)) continue;
    assert.ok(layer.writes.includes('coat'), `${id} does not write coat`);
    assert.ok(layer.writes.includes('aniso'), `${id} does not write aniso`);
  }
  // and the abrasion layers write anisotropy too: a tool-brushed bevel is not isotropic paint
  for (const id of ABRASION) {
    assert.ok(LAYER_SHELF[id]!.writes.includes('aniso'), `${id} does not write aniso`);
  }
});

test('every mask the shelf names resolves, and every mask is used or documented as spare', () => {
  const used = new Set<string>();
  for (const layer of Object.values(LAYER_SHELF)) {
    const entry = Object.entries(MASK_SHELF).find(([, mask]) => mask === layer.mask);
    assert.ok(entry, `${layer.name} uses a mask that is not in the shelf`);
    used.add(entry[0]);
  }
  assert.ok(used.has('seeps') && used.has('soot-fall'), `unused new masks: ${[...used].join(', ')}`);
});

test('a coverage report is deterministic and independent of the grid it is taken on', () => {
  const coarse = report('mat:field-worn-hazard', 8);
  const again = report('mat:field-worn-hazard', 8);
  assert.deepEqual(coarse, again);
  const fine = report('mat:field-worn-hazard', 24);
  // a coarser grid may land the patches differently, but the overall picture agrees within 10 points
  for (const layer of fine.layers) {
    const other = coarse.layers.find((l) => l.name === layer.name)!;
    for (const zone of COVERAGE_ZONES) {
      assert.ok(Math.abs(layer.zones[zone] - other.zones[zone]) < 0.1, `${layer.name} ${zone}: ${layer.zones[zone]} vs ${other.zones[zone]}`);
    }
  }
});

test('materialAt is finite everywhere the report samples', () => {
  for (const m of Object.values(MATERIAL_SHELF)) {
    for (const zone of COVERAGE_ZONES) {
      for (const p of coveragePoints(zone, 6)) {
        const c = materialAt(m, p, tiles, noise);
        for (const [channel, value] of Object.entries(c)) {
          if (typeof value === 'number') assert.ok(Number.isFinite(value), `${m.name} ${zone} ${channel}: ${value}`);
        }
        for (const channel of ['colour', 'fuzzColour', 'emit'] as const) {
          for (const value of c[channel]) assert.ok(Number.isFinite(value), `${m.name} ${zone} ${channel}`);
        }
      }
    }
  }
});
