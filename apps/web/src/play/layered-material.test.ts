// Argon directive 2 for JOB-07 (plan 42): where each tile is projected.
// A large-scale weathering layer (grime clouds, scorch burn, moss clumps) is a feature of the *place*: it must run across the seams
// between the parts of a kit, so it reads in world space (triplanar). A micro tile (brushed metal, hex micro-texture, carbon weave)
// is surface detail that must travel with its part, so it keeps the part's own UVs. `materialSpaces` is what `pack` feeds the shader,
// so this is the shipped rule, not a copy of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAL_SHELF, MAX_LAYERS, MAX_MASK_INPUTS, SURFACE_SHELF, type MaterialSpec } from '@hm/matstack';
import { materialSpaces } from './layered-material';

const LARGE_SCALE = ['grime-clouds', 'scorch-burn', 'moss-clump'];
const MICRO = ['brushed-metal', 'hex-micro', 'carbon-weave'];

const surfacesOf = (spec: MaterialSpec): MaterialSpec['base'][] => [spec.base, ...spec.layers.map((l) => l.surface)];

test('the large-scale weathering tiles are world space and the micro tiles stay on the part\'s UVs', () => {
  const seen = new Set<string>();
  for (const surface of Object.values(SURFACE_SHELF)) {
    for (const use of [surface.tile, surface.detail]) {
      if (!use) continue;
      seen.add(use.tile);
      if (LARGE_SCALE.includes(use.tile)) {
        assert.equal(use.space, 'world', `${use.tile} must be projected in world space, or every part restarts the pattern`);
      }
      if (MICRO.includes(use.tile)) {
        assert.notEqual(use.space, 'world', `${use.tile} is micro detail: it must keep the part's UVs`);
      }
    }
  }
  // the shelf really does name them (a typo would make the loop above pass vacuously)
  for (const id of [...LARGE_SCALE, ...MICRO]) assert.ok(seen.has(id), `the shelf names no '${id}' tile`);
});

test('the macro mask noise is world space, so a grime cloud does not restart on every UV island', () => {
  const macro = Object.values(SURFACE_SHELF).filter((s) => s.tile?.space === 'world' || s.detail?.space === 'world');
  assert.ok(macro.length >= 3, 'the three large-scale weathering surfaces should be world space');
  // every material that wears one of them packs at least one world-space mask input (that is what gates the layer)
  const world = Object.values(MATERIAL_SHELF).filter((m) =>
    surfacesOf(m).some((s) => s.tile?.space === 'world' || s.detail?.space === 'world'),
  );
  assert.ok(world.length > 0, 'no material wears the large-scale surfaces');
  for (const spec of world) {
    const { surfaces, inputs } = materialSpaces(spec);
    assert.ok(surfaces.some((s) => s.tile === 1), `${spec.name} wears a world-space tile but packs none`);
    assert.ok(inputs.includes(1), `${spec.name} needs at least one world-space mask input`);
  }
});

test('materialSpaces packs one flag per surface and per mask slot, and matches the spec', () => {
  const spec = MATERIAL_SHELF['mat:field-worn-hazard'];
  assert.ok(spec, 'the field-worn hazard preset should be in the shelf');
  const { surfaces, inputs } = materialSpaces(spec!);
  const wear = surfacesOf(spec!);
  assert.equal(surfaces.length, wear.length, 'one entry per surface (base first)');
  surfaces.forEach((space, i) => {
    assert.equal(space.tile, wear[i]!.tile?.space === 'world' ? 1 : 0);
    assert.equal(space.detail, wear[i]!.detail?.space === 'world' ? 1 : 0);
  });
  const visible = spec!.layers.slice(0, MAX_LAYERS).filter((l) => l.visible).length;
  assert.equal(inputs.length, visible * MAX_MASK_INPUTS, 'one flag per input slot of every visible layer');
  // a micro-only material packs no world flag at all: the fast path is the default, not an option
  const micro: MaterialSpec = {
    name: 'Micro only',
    base: {
      name: 'Brushed',
      colour: '#8a929a',
      metal: 0.9,
      rough: 0.3,
      specular: 0.5,
      tile: { tile: 'brushed-metal', scale: 0.4, bump: 0.1, roughVar: 0.1, colourVar: 0.06 },
      detail: { tile: 'hex-micro', scale: 0.16, bump: 0.1, roughVar: 0.08 },
    },
    paint: ['#000000', '#ffffff'],
    age: 0,
    layers: [
      {
        name: 'Edge wear',
        surface: { name: 'Worn', colour: '#c8ced4', metal: 0.95, rough: 0.24, specular: 0.5, tile: { tile: 'carbon-weave', scale: 0.08, bump: 0.2, roughVar: 0.18, colourVar: 0.12 } },
        mask: { name: 'Speckle', balance: 0, contrast: 0, invert: false, inputs: [{ kind: 'noise', noise: 'speckle', scale: 0.2, seed: 3, blend: 'multiply', opacity: 0.4, invert: false }] },
        opacity: 1,
        heightBlend: 0,
        weathering: false,
        visible: true,
        writes: ['colour', 'metal', 'rough'],
      },
    ],
  };
  const plain = materialSpaces(micro);
  assert.deepEqual(plain.surfaces, [
    { tile: 0, detail: 0 },
    { tile: 0, detail: 0 },
  ]);
  assert.ok(plain.inputs.every((f) => f === 0), 'a micro speckle mask keeps the part UVs');
});

test('every mat: preset still asks for a space the renderer knows', () => {
  for (const spec of Object.values(MATERIAL_SHELF)) {
    for (const surface of surfacesOf(spec)) {
      for (const use of [surface.tile, surface.detail]) {
        if (!use?.space) continue;
        assert.ok(use.space === 'uv' || use.space === 'world', `${spec.name} asks for '${use.space}'`);
      }
    }
    for (const layer of spec.layers) {
      for (const input of layer.mask.inputs) {
        if (input.kind !== 'noise' || !input.space) continue;
        assert.ok(input.space === 'uv' || input.space === 'world', `${spec.name} asks for '${input.space}'`);
      }
    }
  }
});
