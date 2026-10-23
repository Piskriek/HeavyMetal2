import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  flatten,
  validate,
  presetBounds,
  mergeBuckets,
  instanceBuckets,
  maxRank,
  sourceBounds,
  transformBox,
  type Box3,
  type Kit,
} from '@hm/kitspec';
import {
  KIT_TRIM_PALETTE,
  KIT_TRIM_MATERIAL_IDS,
  isKitTrimMaterial,
  presetMaterials,
} from './kit-trim-palette';
import {
  FABRICATOR_FRAME_KIT,
  FABRICATOR_FRAME_BOUNDS,
  FABRICATOR_HEAD_TRAVEL,
} from './kit-fabricator-frame';
import { MILL_FRAME_KIT, MILL_CORE_BOUNDS } from './kit-mill-frame';
import { PRESS_FRAME_KIT, PRESS_CORE_BOUNDS } from './kit-press-frame';
import { WATERMAKER_FRAME_KIT, WATERMAKER_CORE_BOUNDS } from './kit-watermaker-frame';
import { HAULER_KIT, HAULER_WHEEL_BOUNDS } from './kit-hauler';
import { CRAWLER_KIT, CRAWLER_ARM_BOUNDS } from './kit-crawler';

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
    maxSpan: [4.008, 4.02, 4.004],
    requiredSockets: ['vent', 'feed', 'hopper', 'stack', 'power'],
  },
  {
    id: 'press-frame',
    kit: PRESS_FRAME_KIT,
    maxSpan: [4.008, 4.01, 3.845],
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

function boxOfPath(kit: Kit, preset: string, path: string): Box3 {
  const placed = flatten(kit, preset);
  const found = placed.find((p) => p.path === path);
  assert.ok(found, `Missing placed part '${path}' in ${preset}`);
  return transformBox(sourceBounds(found.source), found.matrix);
}

/** Checks that a part's mounting face sits within `tol` of `expectedCoord` on `axis` without being buried or floating. */
function assertFaceContact(
  kit: Kit,
  preset: string,
  path: string,
  axis: 0 | 1 | 2,
  expectedFace: number,
  tol = 0.05,
): void {
  const b = boxOfPath(kit, preset, path);
  const distMin = Math.abs(b.min[axis] - expectedFace);
  const distMax = Math.abs(b.max[axis] - expectedFace);
  const span = b.min[axis] <= expectedFace + tol && b.max[axis] >= expectedFace - tol;
  assert.ok(
    span || Math.min(distMin, distMax) <= tol,
    `${preset}/${path} axis ${axis} [${b.min[axis].toFixed(3)}..${b.max[axis].toFixed(3)}] does not contact measured core face ${expectedFace.toFixed(3)} (tol ${tol})`,
  );
}

describe('TICKET-39 & TICKET-39b kit specs (4a, 4b, 4d + OPUS_NOTE_36 raycast refit)', () => {
  it('defines the 4d two-material trim palette (hull-steel & accent-hardware)', () => {
    assert.deepEqual(KIT_TRIM_MATERIAL_IDS, ['hull-steel', 'accent-hardware']);
    assert.equal(KIT_TRIM_PALETTE['hull-steel'].bands.length, 3);
    assert.equal(KIT_TRIM_PALETTE['accent-hardware'].bands.length, 3);
    assert.equal(isKitTrimMaterial('hull-steel'), true);
    assert.equal(isKitTrimMaterial('accent-hardware'), true);
    assert.equal(isKitTrimMaterial('unknown'), false);
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

  describe('OPUS_NOTE_36 core raycast table verification (TICKET-39b)', () => {
    it('mill-frame: plinth parts stand on y=0.15 outside +-1.29 step, and face parts contact +z=1.08, +x=0.91, +z=1.10', () => {
      assert.deepEqual(MILL_CORE_BOUNDS, { min: [-2.0, 0, -2.0], max: [2.0, 4.01, 2.0] });
      // Plinth parts on y = 0.15, clear of the +-1.29 step and +-1.11 body
      for (const col of ['col-lf', 'col-rf', 'col-lb', 'col-rb']) {
        assertFaceContact(MILL_FRAME_KIT, 'mill-frame', col, 1, 0.15, 0.01);
        const b = boxOfPath(MILL_FRAME_KIT, 'mill-frame', col);
        assert.ok(Math.abs(b.min[0]) > 1.29 || Math.abs(b.max[0]) > 1.29, `${col} x not outside 1.29 step`);
        assert.ok(Math.abs(b.min[2]) > 1.29 || Math.abs(b.max[2]) > 1.29, `${col} z not outside 1.29 step`);
      }
      assertFaceContact(MILL_FRAME_KIT, 'mill-frame', 'power-box', 1, 0.15, 0.01);
      assert.ok(boxOfPath(MILL_FRAME_KIT, 'mill-frame', 'power-box').max[2] < -1.29, 'power-box buried in -1.29 step');
      assertFaceContact(MILL_FRAME_KIT, 'mill-frame', 'rear-duct', 1, 0.15, 0.01);

      // Core-face parts flush with measured faces: body +z = 1.08, stack recess +x = 0.91, top lip +z = 1.10
      assertFaceContact(MILL_FRAME_KIT, 'mill-frame', 'front-door', 2, 1.08, 0.04);
      assertFaceContact(MILL_FRAME_KIT, 'mill-frame', 'status-led-bar', 2, 1.08, 0.04);
      assertFaceContact(MILL_FRAME_KIT, 'mill-frame', 'stack-manifold', 0, 0.91, 0.04);
      assertFaceContact(MILL_FRAME_KIT, 'mill-frame', 'top-lip-collar', 2, 1.1, 0.04);
    });

    it('press-frame: plinth parts stand on y=0.15 outside bed/cheeks, and face parts contact bed +z=0.74, cheeks x=+-1.16, crown +z=0.74, top block -z=-0.83', () => {
      assert.deepEqual(PRESS_CORE_BOUNDS, { min: [-2.0, 0, -1.92], max: [2.0, 4.0, 1.92] });
      // Upright columns on plinth y = 0.15, clear of x = +-1.17 bed/cheeks/crown
      for (const up of ['upright-left', 'upright-right']) {
        assertFaceContact(PRESS_FRAME_KIT, 'press-frame', up, 1, 0.15, 0.01);
        const b = boxOfPath(PRESS_FRAME_KIT, 'press-frame', up);
        const innerX = up === 'upright-left' ? Math.abs(b.max[0]) : b.min[0];
        assert.ok(innerX > 1.17, `${up} inner face ${innerX} collides with +-1.17 core cheeks`);
      }
      assertFaceContact(PRESS_FRAME_KIT, 'press-frame', 'power-box', 1, 0.15, 0.01);
      assert.ok(boxOfPath(PRESS_FRAME_KIT, 'press-frame', 'power-box').min[2] > 0.74, 'power-box buried in +0.74 bed');
      assertFaceContact(PRESS_FRAME_KIT, 'press-frame', 'rear-duct', 1, 0.15, 0.01);
      assert.ok(boxOfPath(PRESS_FRAME_KIT, 'press-frame', 'rear-duct').max[2] < -0.74, 'rear-duct buried in -0.74 bed');

      // Core-face parts flush with measured faces: bed +z = 0.74, cheeks +-1.16, crown +z = 0.74, top block -z = -0.83
      assertFaceContact(PRESS_FRAME_KIT, 'press-frame', 'hazard-front', 2, 0.74, 0.04);
      assertFaceContact(PRESS_FRAME_KIT, 'press-frame', 'cheek-left', 0, -1.16, 0.04);
      assertFaceContact(PRESS_FRAME_KIT, 'press-frame', 'cheek-right', 0, 1.16, 0.04);
      assertFaceContact(PRESS_FRAME_KIT, 'press-frame', 'crown-fascia', 2, 0.74, 0.04);
      assertFaceContact(PRESS_FRAME_KIT, 'press-frame', 'vent-box', 2, -0.83, 0.09);
    });

    it('watermaker-frame: skid parts stand on y=0.30 clear of z=-1.21..1.32 tank, and face parts contact tank +z=1.32 and top -z=-0.96', () => {
      assert.deepEqual(WATERMAKER_CORE_BOUNDS, { min: [-3.87, 0, -3.14], max: [3.86, 3.99, 3.14] });
      for (const pier of ['pier-lf', 'pier-rf', 'pier-lb', 'pier-rb']) {
        assertFaceContact(WATERMAKER_FRAME_KIT, 'watermaker-frame', pier, 1, 0.3, 0.01);
        const b = boxOfPath(WATERMAKER_FRAME_KIT, 'watermaker-frame', pier);
        const clearZ = b.min[2] > 1.32 || b.max[2] < -1.21;
        assert.ok(clearZ, `${pier} z [${b.min[2]}..${b.max[2]}] collides with tank z [-1.21..1.32]`);
      }
      assertFaceContact(WATERMAKER_FRAME_KIT, 'watermaker-frame', 'hopper-column', 1, 0.3, 0.01);
      assert.ok(boxOfPath(WATERMAKER_FRAME_KIT, 'watermaker-frame', 'hopper-column').max[0] <= 3.0, 'hopper-column exceeds +3.00 skid edge');
      assertFaceContact(WATERMAKER_FRAME_KIT, 'watermaker-frame', 'power-box', 1, 0.3, 0.01);
      assert.ok(boxOfPath(WATERMAKER_FRAME_KIT, 'watermaker-frame', 'power-box').min[2] > 1.32, 'power-box buried in +1.32 tank');

      // Core-face parts flush with measured faces: tank +z = 1.32, top -z = -0.96 (within -0.84..-1.07)
      assertFaceContact(WATERMAKER_FRAME_KIT, 'watermaker-frame', 'tank-panel-front', 2, 1.32, 0.04);
      assertFaceContact(WATERMAKER_FRAME_KIT, 'watermaker-frame', 'gauge-box', 2, 1.32, 0.07);
      assertFaceContact(WATERMAKER_FRAME_KIT, 'watermaker-frame', 'vent-box', 2, -0.96, 0.13);
    });

    it('hauler and crawler use exact measured hauler-wheel and crawler-arm GLB bounds', () => {
      assert.deepEqual(HAULER_WHEEL_BOUNDS, { min: [-0.55, 0, -0.26], max: [0.55, 1.09, 0.26] });
      assert.deepEqual(CRAWLER_ARM_BOUNDS, { min: [-0.8, 0, -0.12], max: [0.81, 0.35, 0.12] });
      const wheelFL = boxOfPath(HAULER_KIT, 'hauler', 'wheel-fl/wheel');
      assert.ok(Math.abs(wheelFL.max[0] - wheelFL.min[0] - 0.52) < 0.01, 'rotated hauler wheel width should be 0.52 m along x');
      assert.ok(Math.abs(wheelFL.max[2] - wheelFL.min[2] - 1.1) < 0.01, 'rotated hauler wheel diameter should be 1.10 m along z');
      const drillArm = boxOfPath(CRAWLER_KIT, 'crawler', 'drill-arm');
      assert.ok(Math.abs(drillArm.max[2] - drillArm.min[2] - 1.61) < 0.01, 'rotated crawler arm length should be 1.61 m along z');
    });
    it('carved-out multi-box raycast solid check: zero parts hang in air or bury into core solids', () => {
      const MILL_SOLIDS: readonly Box3[] = [
        { min: [-2.0, 0, -2.0], max: [2.0, 0.15, 2.0] },
        { min: [-1.29, 0.15, -1.29], max: [1.29, 0.35, 1.29] },
        { min: [-1.08, 0.35, -1.08], max: [0.91, 3.05, 1.08] },
        { min: [-0.76, 3.05, -0.76], max: [0.76, 3.55, 0.76] },
        { min: [-1.1, 3.55, -1.1], max: [1.1, 4.01, 1.1] },
      ];
      const PRESS_SOLIDS: readonly Box3[] = [
        { min: [-2.0, 0, -1.92], max: [2.0, 0.15, 1.92] },
        { min: [-1.16, 0.15, -0.74], max: [1.16, 0.55, 0.74] },
        { min: [-1.16, 1.55, -0.46], max: [-0.95, 1.8, 0.46] },
        { min: [1.0, 1.55, -0.46], max: [1.17, 2.8, 0.46] },
        { min: [-1.16, 2.8, -0.74], max: [1.16, 3.15, 0.74] },
        { min: [-0.3, 3.15, -0.83], max: [0.3, 4.0, 0.83] },
      ];
      const WATERMAKER_SOLIDS: readonly Box3[] = [
        { min: [-3.19, 0, -3.14], max: [3.0, 0.3, 3.14] },
        { min: [-3.6, 1.8, -1.21], max: [3.6, 3.3, 1.32] },
        { min: [-2.49, 3.3, -0.96], max: [2.38, 3.85, 0.96] },
      ];

      const touchesBox = (a: Box3, b: Box3, eps = 0.02): boolean =>
        a.min[0] <= b.max[0] + eps && b.min[0] <= a.max[0] + eps &&
        a.min[1] <= b.max[1] + eps && b.min[1] <= a.max[1] + eps &&
        a.min[2] <= b.max[2] + eps && b.min[2] <= a.max[2] + eps;

      const penetrationDepth = (a: Box3, b: Box3): number => {
        const ox = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
        const oy = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
        const oz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
        if (ox <= 0 || oy <= 0 || oz <= 0) return 0;
        return Math.min(ox, oy, oz);
      };

      for (const [id, kit, solids] of [
        ['mill-frame', MILL_FRAME_KIT, MILL_SOLIDS],
        ['press-frame', PRESS_FRAME_KIT, PRESS_SOLIDS],
        ['watermaker-frame', WATERMAKER_FRAME_KIT, WATERMAKER_SOLIDS],
      ] as const) {
        const parts = flatten(kit, id).filter((p) => p.path !== 'core');
        const boxes = parts.map((p) => ({
          path: p.path,
          box: transformBox(sourceBounds(p.source), p.matrix),
        }));
        const supported = boxes.map((b) => solids.some((s) => touchesBox(b.box, s, 0.02)));
        const queue = supported.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0);
        while (queue.length > 0) {
          const i = queue.shift() as number;
          boxes.forEach((b, j) => {
            if (!supported[j] && touchesBox((boxes[i] as { box: Box3 }).box, b.box, 0.02)) {
              supported[j] = true;
              queue.push(j);
            }
          });
        }
        const floating = boxes.filter((_, i) => !supported[i]).map((b) => b.path);
        assert.deepEqual(floating, [], `${id} has parts floating off real raycast core faces: ${floating.join(', ')}`);

        const buried: string[] = [];
        for (const b of boxes) {
          for (const s of solids) {
            const pen = penetrationDepth(b.box, s);
            if (pen > 0.025) buried.push(`${b.path} (${pen.toFixed(3)} m)`);
          }
        }
        assert.deepEqual(buried, [], `${id} has parts buried inside real raycast core solids: ${buried.join(', ')}`);
      }
    });
  });

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
