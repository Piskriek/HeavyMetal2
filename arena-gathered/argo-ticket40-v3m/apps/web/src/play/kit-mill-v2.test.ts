import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, buildPart, triangleCount, type Rank } from '@hm/partgen';
import {
  flatten,
  validate,
  presetBounds,
  instanceBuckets,
} from '@hm/kitspec';
import {
  FLAT_TILE,
  featureKey,
  features,
  maskAt,
  maskAttributes,
  materialAt,
  surfaceAt,
  type NoiseSource,
  type SamplePoint,
  type TileSource,
} from '@hm/matstack';
import {
  FIRST_MATSTACK_SHELF,
  KIT_TRIM_PALETTE,
  LAYER_SHELF,
  MASK_SHELF,
  MAT_PRESET_SKINS,
  STAGE_ENV_GRADIENTS,
  SURFACE_SHELF,
  buildTrimTextureRgba,
  flattenMeshFaces,
  isKitOrVaultMaterial,
  isMatPresetSkin,
  presetMaterials,
  remapUvToTrimBand,
} from './kit-trim-palette';
import { MATSTACK_TEST_PIECE_KIT, SHARED_MODULE_ASSEMBLIES, SHARED_MODULE_PARTS } from './kit-modules';
import { MILL_V2_KIT } from './kit-mill-v2';

const EXPECTED_20_GENERATORS = [
  'bolt',
  'panel',
  'can',
  'beam',
  'grille',
  'bracket',
  'duct',
  'hopper',
  'chute',
  'tank',
  'pipe',
  'hinge',
  'handle',
  'ladder',
  'louvre',
  'lamp',
  'conduit',
  'clamp',
  'wheel',
  'track',
] as const;

const MOCK_TILES: TileSource = {
  sample(tile: string, u: number, v: number) {
    if (tile === 'stripes') {
      const s = ((u + v) % 1 + 1) % 1;
      return { grey: s < 0.5 ? 0.15 : 0.85, height: 0.5, rough: 0.5 };
    }
    return FLAT_TILE;
  },
};

const MOCK_NOISE: NoiseSource = {
  sample(_kind, u, v) {
    const s = Math.sin(u * 6.28318) * Math.cos(v * 6.28318);
    return 0.5 + 0.35 * s;
  },
};

describe('TICKET-40 v3 @hm/partgen, Plan 41 @hm/matstack First Shelf & 100% from-scratch pilot Texture Mill', () => {
  it('registers all 20 deterministic parametric generators (7 core + 13 new machine/vehicle generators)', () => {
    for (const id of EXPECTED_20_GENERATORS) {
      assert.ok(GENERATORS[id], `Missing generator '${id}' in GENERATORS`);
    }
    assert.equal(Object.keys(GENERATORS).length, 20);
  });

  for (const id of EXPECTED_20_GENERATORS) {
    it(`generator '${id}' builds valid grounded meshes across Ranks 0, 1, and 2`, () => {
      const tris: number[] = [];
      for (const rank of [0, 1, 2] as const as readonly Rank[]) {
        const md = buildPart(id, {}, rank);
        assert.ok(md !== null, `${id} returned null at rank ${rank}`);
        const tc = triangleCount(md);
        assert.ok(tc >= 2, `${id} rank ${rank} has too few triangles: ${tc}`);
        assert.equal(md.positions.length, md.normals.length);
        assert.equal((md.positions.length / 3) * 2, md.uvs.length);
        for (let i = 0; i < md.positions.length; i++) {
          assert.ok(Number.isFinite(md.positions[i]), `${id} non-finite position at ${i}`);
          assert.ok(Number.isFinite(md.normals[i]), `${id} non-finite normal at ${i}`);
        }
        if (id !== 'bolt') {
          assert.ok(md.min[1] >= -1e-4, `${id} rank ${rank} dips below y=0: ${md.min[1]}`);
        }
        tris.push(tc);
      }
      assert.ok((tris[2] as number) >= (tris[0] as number), `${id} Rank 2 (${tris[2]}) should have >= triangles than Rank 0 (${tris[0]})`);
    });
  }

  it('builds 64x64 banded trim RGBA textures and Stage 0..6 planet PMREM environment gradients', () => {
    const hullRgba = buildTrimTextureRgba(KIT_TRIM_PALETTE['hull-steel'], 64, 64);
    const accentRgba = buildTrimTextureRgba(KIT_TRIM_PALETTE['accent-hardware'], 64, 64);
    assert.equal(hullRgba.length, 64 * 64 * 4);
    assert.equal(accentRgba.length, 64 * 64 * 4);
    const [u, v] = remapUvToTrimBand(2.5, 1.75, [0.55, 0.82]);
    assert.equal(u, 2.5);
    assert.ok(v >= 0.55 && v <= 0.82, `Remapped v=${v} out of [0.55, 0.82]`);
    assert.equal(STAGE_ENV_GRADIENTS.length, 7);
  });

  it('verifies OPUS_NOTE_41 fixes: sloped open-throat hopper, inclined chute ramp, 20-sided radial wheel, and Sheet-12 khaki palette', () => {
    assert.equal(KIT_TRIM_PALETTE['hull-steel'].baseHex, '#b8b2a2');
    assert.equal(KIT_TRIM_PALETTE['hull-steel'].metalness, 0.0);
    assert.equal(KIT_TRIM_PALETTE['accent-hardware'].baseHex, '#4a525a');

    const hop0 = buildPart('hopper', { topWidth: 2.2, topDepth: 2.2, bottomWidth: 1.4, bottomDepth: 1.4, height: 0.5 }, 0)!;
    const hop2 = buildPart('hopper', { topWidth: 2.2, topDepth: 2.2, bottomWidth: 1.4, bottomDepth: 1.4, height: 0.5 }, 2)!;
    assert.ok(hop0.max[0] - hop0.min[0] > 2.1, 'Hopper Rank 0 top width should match flared topWidth');
    let slopedNormals = 0;
    for (let i = 0; i < hop2.normals.length; i += 3) {
      const ny = Math.abs(hop2.normals[i + 1] as number);
      if (ny > 0.15 && ny < 0.92) slopedNormals++;
    }
    assert.ok(slopedNormals >= 16, `Expected sloped frustum normals on hopper, got ${slopedNormals}`);

    const ch2 = buildPart('chute', { width: 0.6, length: 0.8, drop: 0.3 }, 2)!;
    let inclinedNormals = 0;
    for (let i = 0; i < ch2.normals.length; i += 3) {
      const ny = Math.abs(ch2.normals[i + 1] as number);
      const nz = Math.abs(ch2.normals[i + 2] as number);
      if (ny > 0.2 && ny < 0.98 && nz > 0.15) inclinedNormals++;
    }
    assert.ok(inclinedNormals >= 16, `Expected inclined ramp floor normals on chute, got ${inclinedNormals}`);

    const wh1 = buildPart('wheel', {}, 1)!;
    const wh2 = buildPart('wheel', {}, 2)!;
    assert.ok(triangleCount(wh1) >= 100, `Expected >= 100 tris on 14-sided Rank 1 wheel, got ${triangleCount(wh1)}`);
    assert.ok(triangleCount(wh2) >= 350, `Expected >= 350 tris on 20-sided Rank 2 wheel with radial tread blocks, got ${triangleCount(wh2)}`);
  });

  it('validates all Plan 41 §4.9 SURFACE_SHELF (29), MASK_SHELF (11), LAYER_SHELF (16), and FIRST_MATSTACK_SHELF presets against @hm/matstack', () => {
    assert.equal(Object.keys(SURFACE_SHELF).length, 29);
    assert.equal(Object.keys(MASK_SHELF).length, 11);
    assert.equal(Object.keys(LAYER_SHELF).length, 16);
    assert.ok(Object.keys(FIRST_MATSTACK_SHELF).length >= 16);

    // Dielectric paint coats must have metal = 0 and use paint1 / paint2
    assert.equal(SURFACE_SHELF['powder-coat']!.metal, 0.0);
    assert.equal(SURFACE_SHELF['powder-coat']!.colour, 'paint1');
    assert.equal(SURFACE_SHELF['enamel']!.metal, 0.0);
    assert.equal(SURFACE_SHELF['enamel']!.colour, 'paint1');
    assert.equal(SURFACE_SHELF['lab-composite']!.metal, 0.0);
    assert.equal(SURFACE_SHELF['lab-composite']!.colour, 'paint1');
    assert.equal(SURFACE_SHELF['hazard-paint']!.metal, 0.0);
    assert.equal(SURFACE_SHELF['hazard-paint']!.tile?.tile, 'stripes');
    assert.ok((SURFACE_SHELF['hazard-paint']!.ramp?.length ?? 0) >= 2);

    // Field-worn hazard carries warm khaki (#b8b2a2) in paint1 so players can repaint it
    const fieldWorn = FIRST_MATSTACK_SHELF['mat:field-worn-hazard']!;
    assert.equal(fieldWorn.paint[0], '#b8b2a2');
    assert.equal(fieldWorn.paint[1], '#eab308');

    for (const skinId of Object.values(MAT_PRESET_SKINS)) {
      assert.ok(isMatPresetSkin(skinId), `MAT_PRESET_SKINS '${skinId}' missing from FIRST_MATSTACK_SHELF`);
    }

    const samplePt: SamplePoint = {
      uv: [0.25, 0.25],
      pos: [0.4, 0.18, 0.4],
      normal: [0, 1, 0],
      edge: 0.004,
      cavity: 0.006,
    };

    for (const [id, s] of Object.entries(SURFACE_SHELF)) {
      const ch = surfaceAt(s, samplePt, ['#b8b2a2', '#eab308'], MOCK_TILES);
      assert.ok(ch.rough >= 0 && ch.rough <= 1, `Surface ${id} rough out of range`);
      assert.ok(ch.metal >= 0 && ch.metal <= 1, `Surface ${id} metal out of range`);
    }

    for (const [id, m] of Object.entries(MASK_SHELF)) {
      const val = maskAt(m, samplePt, MOCK_NOISE);
      assert.ok(val >= 0 && val <= 1, `Mask ${id} value out of range: ${val}`);
    }

    for (const [id, mat] of Object.entries(FIRST_MATSTACK_SHELF)) {
      const ch0 = materialAt({ ...mat, age: 0 }, samplePt, MOCK_TILES, MOCK_NOISE);
      const ch1 = materialAt({ ...mat, age: 1 }, samplePt, MOCK_TILES, MOCK_NOISE);
      const feat = features(mat);
      const key = featureKey(feat);
      assert.ok(key.startsWith(`L${feat.layers}`), `Invalid featureKey ${key} for ${id}`);
      assert.equal(ch0.colour.length, 3);
      assert.equal(ch1.colour.length, 3);
    }
  });

  it('flattens Rank 0 per face via flattenMeshFaces so wide panel centres stay dielectric paint while bevel edges wear to metal', () => {
    const rawMesh = buildPart(
      'panel',
      { width: 0.8, depth: 0.8, thickness: 0.08, bevel: 0.02, seam: 0.03, boltsPerSide: 0 },
      1,
    )!;
    const masked = maskAttributes({
      positions: rawMesh.positions,
      normals: rawMesh.normals,
      uvs: rawMesh.uvs,
      indices: rawMesh.indices,
      slots: rawMesh.slots,
    });
    const mat = FIRST_MATSTACK_SHELF['mat:field-worn-hazard']!;
    const flat = flattenMeshFaces(mat, masked, MOCK_TILES, MOCK_NOISE);

    let minMetal = 1;
    let maxMetal = 0;
    for (let i = 0; i < flat.metal.length; i++) {
      minMetal = Math.min(minMetal, flat.metal[i]!);
      maxMetal = Math.max(maxMetal, flat.metal[i]!);
    }
    assert.ok(minMetal < 0.05, `Expected interior panel face metal < 0.05, got ${minMetal}`);
    assert.ok(maxMetal > 0.25, `Expected bevel edge face metal > 0.25, got ${maxMetal}`);
  });

  it('validates MATSTACK_TEST_PIECE_KIT (Plan 41 §4.6: 0.60 m grounded kit with skid, bevel-panel, square beam, bracket, and short can)', () => {
    const issues = validate(MATSTACK_TEST_PIECE_KIT, 'matstack-test-piece');
    assert.deepEqual(issues, [], `Expected 0 issues on MATSTACK_TEST_PIECE_KIT, got ${JSON.stringify(issues)}`);
    const placed = flatten(MATSTACK_TEST_PIECE_KIT, 'matstack-test-piece');
    assert.equal(placed.length, 5);
    const bounds = presetBounds(MATSTACK_TEST_PIECE_KIT, placed)!;
    assert.ok(Math.abs(bounds.min[1]) < 1e-4, `Expected grounded at y=0, got ${bounds.min[1]}`);
    assert.ok(Math.abs(bounds.max[1] - 0.6) < 0.02, `Expected ~0.60 m tall test piece, got ${bounds.max[1]}`);
    for (const m of presetMaterials(placed)) {
      assert.ok(isKitOrVaultMaterial(m), `Unknown material '${m}' on MATSTACK_TEST_PIECE_KIT`);
    }
    for (const p of Object.values(SHARED_MODULE_PARTS)) {
      assert.ok(isKitOrVaultMaterial(p.material), `Unknown material '${p.material}' in SHARED_MODULE_PARTS`);
    }
  });

  it('defines all 7 shared multi-part module assemblies in kit-modules.ts', () => {
    const expectedModules = [
      'bolted-wall-panel',
      'bolted-access-door',
      'louvred-vent-box',
      'gantry-upright-leg',
      'hopper-chute-module',
      'power-gland-box',
      'cartridge-bay-module',
    ];
    for (const m of expectedModules) {
      assert.ok(SHARED_MODULE_ASSEMBLIES[m], `Missing shared module '${m}'`);
    }
  });

  describe('Pilot Machine #1: 100% from-scratch MILL_V2_KIT (zero .glb dependencies)', () => {
    it('passes validate() with zero issues (nothing floating, nothing below ground)', () => {
      const issues = validate(MILL_V2_KIT, 'mill-frame');
      assert.deepEqual(issues, [], `Expected 0 validation issues on MILL_V2_KIT, got: ${JSON.stringify(issues)}`);
    });

    it('contains ZERO monolithic gen .glb parts — 100% built from @hm/partgen and box parts', () => {
      const placed = flatten(MILL_V2_KIT, 'mill-frame');
      const genParts = placed.filter((p) => p.source.kind === 'gen');
      assert.equal(genParts.length, 0, `Expected 0 gen parts in from-scratch MILL_V2_KIT, got ${genParts.length}`);
      assert.ok(placed.length >= 55, `Expected rich multi-part assembly (>= 55 placed parts), got ${placed.length}`);
    });

    it('exposes individually shootable bolts, hinges, handles, lamps, louvres, hoppers, clamps, and ladders', () => {
      const placed = flatten(MILL_V2_KIT, 'mill-frame');
      const gens = new Set(
        placed.filter((p) => p.source.kind === 'param').map((p) => (p.source as { gen: string }).gen),
      );
      for (const requiredGen of ['bolt', 'panel', 'can', 'grille', 'bracket', 'hopper', 'tank', 'pipe', 'hinge', 'handle', 'ladder', 'louvre', 'lamp', 'conduit', 'clamp']) {
        assert.ok(gens.has(requiredGen), `MILL_V2_KIT missing parametric generator '${requiredGen}'`);
      }
      const paths = new Set(placed.map((p) => p.path));
      assert.ok(paths.has('left-service-door/bolt-tl'));
      assert.ok(paths.has('left-service-door/hinge-top'));
      assert.ok(paths.has('left-service-door/latch-handle'));
      assert.ok(paths.has('status-led'));
      assert.ok(paths.has('cartridge-bay/smx-cartridge'));
      assert.ok(paths.has('side-vent-hood/louvre-hood'));
      assert.ok(paths.has('top-hopper'));
      assert.ok(paths.has('right-radiator/screen'));
      assert.ok(paths.has('front-grille'));
      assert.ok(paths.has('back-grille'));
      assert.ok(paths.has('power-gland/cable-run'));
      const instances = instanceBuckets(placed, 2);
      assert.ok((instances.get('mod-hex-bolt')?.length ?? 0) >= 12, 'Expected >= 12 instanced hex bolts');
    });

    it('uses only valid trim palette or mat:<preset> materials and fits within the 4.00 x 4.26 x 4.00 m envelope', () => {
      const placed = flatten(MILL_V2_KIT, 'mill-frame');
      const mats = presetMaterials(placed);
      for (const m of mats) {
        assert.ok(!m.startsWith('vault:'), `Unexpected legacy vault: material '${m}'`);
        assert.ok(isKitOrVaultMaterial(m), `Unexpected unresolvable material '${m}'`);
      }
      const bounds = presetBounds(MILL_V2_KIT, placed);
      assert.ok(bounds !== null);
      const spanX = bounds.max[0] - bounds.min[0];
      const spanY = bounds.max[1] - bounds.min[1];
      const spanZ = bounds.max[2] - bounds.min[2];
      assert.ok(bounds.min[1] >= -0.002, `MILL_V2_KIT dips below ground: ${bounds.min[1]}`);
      assert.ok(spanX <= 4.008, `MILL_V2_KIT width ${spanX.toFixed(3)} > 4.008`);
      assert.ok(spanY <= 4.26, `MILL_V2_KIT height ${spanY.toFixed(3)} > 4.26`);
      assert.ok(spanZ <= 4.004, `MILL_V2_KIT depth ${spanZ.toFixed(3)} > 4.004`);

      const sockets = MILL_V2_KIT.assemblies['mill-frame']?.sockets;
      assert.deepEqual(sockets?.vent?.at, [1.715, 2.28, -0.48]);
      assert.deepEqual(sockets?.stack?.at, [1.715, 2.28, -0.48]);
      assert.deepEqual(sockets?.feed?.at, [0, 4.16, 0]);
      assert.deepEqual(sockets?.hopper?.at, [0, 4.16, 0]);
      assert.deepEqual(sockets?.power?.at, [0, 0.2, -1.8]);
    });
  });
});
