import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  flatten,
  validate,
  presetBounds,
  mergeBuckets,
  instanceBuckets,
  maxRank,
  type Kit,
} from '@hm/kitspec';
import {
  KIT_TRIM_PALETTE,
  KIT_TRIM_MATERIAL_IDS,
  KIT_PRESET_MATERIAL_IDS,
  isKitTrimMaterial,
  presetMaterials,
} from './kit-trim-palette';
import {
  FABRICATOR_FRAME_KIT,
  FABRICATOR_FRAME_BOUNDS,
  FABRICATOR_HEAD_TRAVEL,
} from './kit-fabricator-frame';
import { MILL_FRAME_KIT } from './kit-mill-frame';
import { PRESS_FRAME_KIT } from './kit-press-frame';
import { WATERMAKER_FRAME_KIT } from './kit-watermaker-frame';
import { HAULER_KIT } from './kit-hauler';
import { CRAWLER_KIT } from './kit-crawler';

interface KitTestCase {
  readonly id: string;
  readonly kit: Kit;
  readonly maxSpan: readonly [number, number, number];
  readonly requiredSockets: readonly string[];
}

const CASES: readonly KitTestCase[] = [
  {
    id: 'fabricator-frame',
    kit: FABRICATOR_FRAME_KIT,
    maxSpan: [6.369, 5.0, 6.363],
    requiredSockets: ['vent', 'feed', 'power', 'bed', 'head'],
  },
  {
    id: 'mill-frame',
    kit: MILL_FRAME_KIT,
    maxSpan: [4.008, 3.998, 4.004],
    requiredSockets: ['vent', 'feed', 'hopper', 'stack', 'power'],
  },
  {
    id: 'press-frame',
    kit: PRESS_FRAME_KIT,
    maxSpan: [3.999, 4.001, 3.839],
    requiredSockets: ['vent', 'feed', 'chute', 'power', 'ramLeft', 'ramRight'],
  },
  {
    id: 'watermaker-frame',
    kit: WATERMAKER_FRAME_KIT,
    maxSpan: [7.737, 3.998, 6.301],
    requiredSockets: ['vent', 'feed', 'hopper', 'power'],
  },
  {
    id: 'hauler',
    kit: HAULER_KIT,
    maxSpan: [2.579, 2.931, 5.998],
    requiredSockets: ['seatLeft', 'seatRight', 'dish', 'lampLeft', 'lampRight'],
  },
  {
    id: 'crawler',
    kit: CRAWLER_KIT,
    maxSpan: [2.4, 2.2, 6.2],
    requiredSockets: ['seat', 'drill', 'mast', 'lampLeft', 'lampRight'],
  },
];

describe('TICKET-39 kit specs (4a, 4b, 4d)', () => {
  it('defines the 4d two-material trim palette (hull-steel & accent-hardware, plus Sheet-12 khaki-paint & hopper-slate)', () => {
    // the Sheet-12 pair Argo's review added: a painted housing and a cast-iron hopper, so a kit need not pretend paint is steel
    assert.deepEqual(KIT_TRIM_MATERIAL_IDS, ['hull-steel', 'accent-hardware', 'khaki-paint', 'hopper-slate']);
    assert.deepEqual(KIT_PRESET_MATERIAL_IDS, ['hull-steel', 'accent-hardware']);
    for (const id of KIT_TRIM_MATERIAL_IDS) {
      assert.equal(KIT_TRIM_PALETTE[id].id, id);
      assert.equal(KIT_TRIM_PALETTE[id].bands.length, 3);
      assert.equal(isKitTrimMaterial(id), true);
      // the bands tile the sheet: 0..1, in order, with no gap and no overlap
      let edge = 0;
      for (const band of KIT_TRIM_PALETTE[id].bands) {
        assert.equal(band.uvBand[0], edge, `${id}/${band.id} leaves a gap in the trim sheet`);
        edge = band.uvBand[1];
      }
      assert.equal(edge, 1);
    }
    // khaki-paint is dielectric (metalness 0), hopper-slate is cast iron — the two are not the same material twice
    assert.equal(KIT_TRIM_PALETTE['khaki-paint'].metalness, 0);
    assert.equal(KIT_TRIM_PALETTE['khaki-paint'].baseHex, '#b8b2a2');
    assert.equal(KIT_TRIM_PALETTE['hopper-slate'].baseHex, '#3e454d');
    assert.ok(KIT_TRIM_PALETTE['hopper-slate'].metalness > 0.5);
    assert.equal(isKitTrimMaterial('unknown'), false);
    assert.equal(isKitTrimMaterial('mat:field-worn-hazard'), false, 'a mat: preset is not a trim-sheet id');
  });

  for (const tc of CASES) {
    describe(`preset: ${tc.id}`, () => {
      it('passes validate() with zero issues (nothing floating, nothing below ground)', () => {
        const issues = validate(tc.kit, tc.id);
        assert.deepEqual(issues, [], `Expected 0 validation issues on ${tc.id}, got: ${JSON.stringify(issues)}`);
      });

      it('uses only the two 4d trim materials (hull-steel and accent-hardware) and <= 6 merge buckets', () => {
        const placed = flatten(tc.kit, tc.id);
        assert.ok(placed.length >= 10, `Expected at least 10 placed parts on ${tc.id}`);
        const mats = presetMaterials(placed);
        assert.ok(mats.size <= 2, `Expected at most 2 materials on ${tc.id}, got ${[...mats].join(', ')}`);
        for (const m of mats) {
          assert.ok(isKitTrimMaterial(m), `Unexpected material '${m}' on ${tc.id}`);
        }
        const buckets = mergeBuckets(placed);
        assert.ok(buckets.size <= 6, `Expected <= 6 material|rank buckets, got ${buckets.size}`);
      });

      it('populates all three detail ranks (R0 structure, R1 secondary forms, R2 bolts/grilles/ducts/brackets)', () => {
        const placed = flatten(tc.kit, tc.id);
        const ranks = new Set(placed.map((p) => p.rank));
        assert.equal(ranks.has(0), true, `${tc.id} missing Rank 0 parts`);
        assert.equal(ranks.has(1), true, `${tc.id} missing Rank 1 parts`);
        assert.equal(ranks.has(2), true, `${tc.id} missing Rank 2 parts`);
        assert.equal(maxRank(1, 'low'), 0);
        assert.equal(maxRank(2, 'low'), 1);
        assert.equal(maxRank(4, 'high'), 2);
      });

      it('includes @hm/partgen parametric parts and repeated instances', () => {
        const placed = flatten(tc.kit, tc.id);
        const paramParts = placed.filter((p) => p.source.kind === 'param');
        assert.ok(paramParts.length >= 4, `${tc.id} should use @hm/partgen param parts`);
        const instances = instanceBuckets(placed, 2);
        assert.ok(instances.size >= 1, `${tc.id} should have repeated instanced parts`);
      });

      it('fits within the expected footprint bounds and exposes required sockets', () => {
        const placed = flatten(tc.kit, tc.id);
        const bounds = presetBounds(tc.kit, placed);
        assert.ok(bounds !== null);
        const spanX = bounds.max[0] - bounds.min[0];
        const spanY = bounds.max[1] - bounds.min[1];
        const spanZ = bounds.max[2] - bounds.min[2];
        assert.ok(bounds.min[1] >= -0.002, `${tc.id} dips below ground: ${bounds.min[1]}`);
        assert.ok(spanX <= tc.maxSpan[0], `${tc.id} width ${spanX.toFixed(3)} exceeds ${tc.maxSpan[0]}`);
        assert.ok(spanY <= tc.maxSpan[1], `${tc.id} height ${spanY.toFixed(3)} exceeds ${tc.maxSpan[1]}`);
        assert.ok(spanZ <= tc.maxSpan[2], `${tc.id} depth ${spanZ.toFixed(3)} exceeds ${tc.maxSpan[2]}`);

        const rootAsm = tc.kit.assemblies[tc.id];
        assert.ok(rootAsm && rootAsm.sockets, `${tc.id} missing root sockets`);
        for (const req of tc.requiredSockets) {
          assert.ok(rootAsm.sockets[req], `${tc.id} missing required socket '${req}'`);
        }
      });
    });
  }

  it('preserves exact fabricator footprint, head travel, and machine-props vent/feed coordinates', () => {
    assert.equal(FABRICATOR_FRAME_BOUNDS.max[1], 5.0);
    assert.equal(FABRICATOR_HEAD_TRAVEL.minX, -2.2);
    assert.equal(FABRICATOR_HEAD_TRAVEL.maxX, 2.2);
    assert.deepEqual(FABRICATOR_FRAME_KIT.assemblies['fabricator-frame']?.sockets?.vent?.at, [0, 5.0, -2.4]);
    assert.deepEqual(MILL_FRAME_KIT.assemblies['mill-frame']?.sockets?.vent?.at, [1.715, 2.28, -0.48]);
    assert.deepEqual(MILL_FRAME_KIT.assemblies['mill-frame']?.sockets?.feed?.at, [0, 4.16, 0]);
    assert.deepEqual(PRESS_FRAME_KIT.assemblies['press-frame']?.sockets?.vent?.at, [0, 3.44, -0.56]);
    assert.deepEqual(PRESS_FRAME_KIT.assemblies['press-frame']?.sockets?.feed?.at, [0, 4.26, 0]);
    assert.deepEqual(WATERMAKER_FRAME_KIT.assemblies['watermaker-frame']?.sockets?.vent?.at, [0, 3.155, -0.58]);
    assert.deepEqual(WATERMAKER_FRAME_KIT.assemblies['watermaker-frame']?.sockets?.feed?.at, [3.05, 1.6, 0]);
  });
});
