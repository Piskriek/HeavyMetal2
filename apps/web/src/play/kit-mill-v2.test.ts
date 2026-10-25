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
  LX_LIGHT_MATERIALS,
  MASK_SHELF,
  MAT_PRESET_SKINS,
  STAGE_ENV_GRADIENTS,
  SURFACE_SHELF,
  buildTrimTextureRgba,
  isKitOrVaultMaterial,
  isLxMaterial,
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

describe('TICKET-40 v4 @hm/partgen, Plan 41 @hm/matstack First Shelf & 2.80 m Pilot Texture Mill', () => {
  it('registers all 20 deterministic parametric generators (7 core + 13 new machine/vehicle generators)', () => {
    for (const id of EXPECTED_20_GENERATORS) {
      assert.ok(GENERATORS[id], `Missing generator '${id}' in GENERATORS`);
    }
    assert.ok(Object.keys(GENERATORS).length >= 20);
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

  it('keeps hull-steel as steel while adding khaki-paint & hopper-slate palette IDs and lx: light support', () => {
    assert.equal(KIT_TRIM_PALETTE['hull-steel'].baseHex, '#6c7580');
    assert.ok(KIT_TRIM_PALETTE['hull-steel'].metalness >= 0.7);
    assert.equal(KIT_TRIM_PALETTE['khaki-paint'].baseHex, '#b8b2a2');
    assert.equal(KIT_TRIM_PALETTE['khaki-paint'].metalness, 0.0);
    assert.equal(KIT_TRIM_PALETTE['hopper-slate'].baseHex, '#3e454d');

    for (const lx of Object.values(LX_LIGHT_MATERIALS)) {
      assert.equal(isLxMaterial(lx), true, `Expected valid lx: material, got ${lx}`);
      assert.equal(isKitOrVaultMaterial(lx), true);
    }

    const hullRgba = buildTrimTextureRgba(KIT_TRIM_PALETTE['hull-steel'], 64, 64);
    const khakiRgba = buildTrimTextureRgba(KIT_TRIM_PALETTE['khaki-paint'], 64, 64);
    assert.equal(hullRgba.length, 64 * 64 * 4);
    assert.equal(khakiRgba.length, 64 * 64 * 4);
    const [u, v] = remapUvToTrimBand(2.5, 1.75, [0.55, 0.82]);
    assert.equal(u, 2.5);
    assert.ok(v >= 0.55 && v <= 0.82, `Remapped v=${v} out of [0.55, 0.82]`);
    assert.equal(STAGE_ENV_GRADIENTS.length, 7);
  });

  it('verifies sloped open-throat hopper, inclined chute ramp, and 20-sided radial wheel', () => {
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

    assert.equal(SURFACE_SHELF['powder-coat']!.metal, 0.0);
    assert.equal(SURFACE_SHELF['powder-coat']!.colour, 'paint1');
    assert.equal(SURFACE_SHELF['enamel']!.metal, 0.0);
    assert.equal(SURFACE_SHELF['enamel']!.colour, 'paint1');
    assert.equal(SURFACE_SHELF['lab-composite']!.metal, 0.0);
    assert.equal(SURFACE_SHELF['lab-composite']!.colour, 'paint1');
    assert.equal(SURFACE_SHELF['hazard-paint']!.metal, 0.0);
    assert.equal(SURFACE_SHELF['hazard-paint']!.tile?.tile, 'stripes');
    assert.ok((SURFACE_SHELF['hazard-paint']!.ramp?.length ?? 0) >= 2);

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

  describe('Pilot Machine #1: 100% from-scratch MILL_V2_KIT (2.80 x 2.80 x 2.80 m)', () => {
    it('passes validate() with zero issues (nothing floating, nothing below ground)', () => {
      const issues = validate(MILL_V2_KIT, 'mill-frame');
      assert.deepEqual(issues, [], `Expected 0 validation issues on MILL_V2_KIT, got: ${JSON.stringify(issues)}`);
    });

    it('matches today’s mill footprint (2.80 x 2.80 x 2.80 m) and contains ZERO monolithic gen .glb parts', () => {
      const placed = flatten(MILL_V2_KIT, 'mill-frame');
      const genParts = placed.filter((p) => p.source.kind === 'gen');
      assert.equal(genParts.length, 0, `Expected 0 gen parts in from-scratch MILL_V2_KIT, got ${genParts.length}`);
      assert.ok(placed.length >= 60, `Expected rich multi-part assembly (>= 60 placed parts), got ${placed.length}`);

      const bounds = presetBounds(MILL_V2_KIT, placed)!;
      const spanX = bounds.max[0] - bounds.min[0];
      const spanY = bounds.max[1] - bounds.min[1];
      const spanZ = bounds.max[2] - bounds.min[2];
      assert.ok(Math.abs(bounds.min[1]) < 1e-4, `Expected grounded at y=0, got ${bounds.min[1]}`);
      assert.ok(Math.abs(spanX - 2.8) <= 0.02, `Expected width ~2.80 m, got ${spanX.toFixed(3)}`);
      assert.ok(Math.abs(spanY - 2.8) <= 0.02, `Expected height ~2.80 m, got ${spanY.toFixed(3)}`);
      assert.ok(Math.abs(spanZ - 2.8) <= 0.02, `Expected depth ~2.80 m, got ${spanZ.toFixed(3)}`);
    });

    it('includes 4-side base hazard stripes wearing mat:hazard-chevron, multi-lump dark ore in the hopper, and glowing lx: lamps & pink cartridge slot', () => {
      const placed = flatten(MILL_V2_KIT, 'mill-frame');
      const byPath = new Map(placed.map((p) => [p.path, p]));

      // 1. Base hazard stripes on all 4 sides wearing mat:hazard-chevron
      for (const hKey of ['hazard-front', 'hazard-back', 'hazard-left', 'hazard-right']) {
        const hp = byPath.get(hKey);
        assert.ok(hp, `Missing base hazard strip '${hKey}'`);
        assert.equal(hp.material, 'mat:hazard-chevron', `${hKey} must wear mat:hazard-chevron`);
      }

      // 2. Multi-lump dark crushed ore inside the hopper wearing mat:crushed-ore-bed (never light khaki)
      for (const oreKey of ['ore-mound', 'ore-crown', 'ore-lump-fl', 'ore-lump-fr', 'ore-lump-bl', 'ore-lump-br']) {
        const op = byPath.get(oreKey);
        assert.ok(op, `Missing hopper ore part '${oreKey}'`);
        assert.equal(op.material, 'mat:crushed-ore-bed');
        assert.equal(op.slotMaterials?.trim, 'mat:crushed-ore-bed');
      }

      // 3. Status lamp and pink cartridge bay glow with lx: material names
      const statusLed = byPath.get('status-led')!;
      assert.ok(isLxMaterial(statusLed.slotMaterials?.lens ?? ''), `status-led lens should be lx:, got ${statusLed.slotMaterials?.lens}`);
      const smxCart = byPath.get('cartridge-bay/smx-cartridge')!;
      assert.equal(smxCart.slotMaterials?.trim, 'lx:6500:1.2:steady:ff4fd8');
      const bayHousing = byPath.get('cartridge-bay/bay-housing')!;
      assert.equal(bayHousing.slotMaterials?.trim, 'lx:6500:1.2:steady:ff4fd8');

      // 4. Every material in the preset resolves
      const mats = presetMaterials(placed);
      assert.equal(mats.has('mat:hazard-chevron'), true);
      assert.equal(mats.has('mat:crushed-ore-bed'), true);
      assert.equal(mats.has('lx:6500:1.2:steady:ff4fd8'), true);
      for (const m of mats) {
        assert.ok(!m.startsWith('vault:'), `Unexpected legacy vault: material '${m}'`);
        assert.ok(isKitOrVaultMaterial(m), `Unexpected unresolvable material '${m}'`);
      }

      const instances = instanceBuckets(placed, 2);
      assert.ok((instances.get('mod-hex-bolt')?.length ?? 0) >= 12, 'Expected >= 12 instanced hex bolts');
    });
  });
});
