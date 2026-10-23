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
  KIT_TRIM_PALETTE,
  STAGE_ENV_GRADIENTS,
  buildTrimTextureRgba,
  remapUvToTrimBand,
  isKitOrVaultMaterial,
  presetMaterials,
} from './kit-trim-palette';
import { SHARED_MODULE_ASSEMBLIES } from './kit-modules';
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

describe('TICKET-40 @hm/partgen 20-generator inventory & 100% from-scratch pilot Texture Mill', () => {
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
      // Verify individual door bolts and leg bolts have distinct addressable paths for Beam Rifle Apply
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

    it('uses only valid trim palette or vault:<preset> materials and fits within the 4.00 x 4.26 x 4.00 m envelope', () => {
      const placed = flatten(MILL_V2_KIT, 'mill-frame');
      const mats = presetMaterials(placed);
      for (const m of mats) {
        assert.ok(isKitOrVaultMaterial(m), `Unexpected material '${m}'`);
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
