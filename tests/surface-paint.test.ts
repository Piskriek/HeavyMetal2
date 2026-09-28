/**
 * NewRoads — the surface mask, the road mask and the paint ribbon, asserted headlessly.
 *
 * What is checked, and why a player would care:
 *  - **the brush law** (plan §1.3): raising, lowering, and replacing the weaker slot — pinned per texel,
 *    so a stroke can never invent a third surface or lose the one you meant to keep;
 *  - **the eraser is surface 0**: painting dirt back leaves a texel that renders the untouched road;
 *  - **shoulders are locked** unless overridden, and the marking flags are per row;
 *  - **a mask survives a save**: RLE + base64 round-trips byte-for-byte, and the hash refuses a tamper;
 *  - **undo is a rectangle**, not a copy of the mask;
 *  - **the ribbon is on the road**: every vertex is the frame's own point ± the curb, `u` spans 0‥1 and
 *    `v` is arc-length — the authored UVs the brush and the shader both rely on;
 *  - **physics reads what was painted**: `surfaceIdAt(s, laneZ)` returns the asphalt you just laid.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SurfaceMask, base64ToBytes, bytesToBase64 } from '../src/game/surface/surface-mask';
import { ROAD_MASK_ACROSS, ROAD_MASK_STEP, ROAD_SHOULDER_SURFACE, RoadMask } from '../src/game/surface/road-mask';
import {
  MARK_CENTRE_DOUBLE, MARK_LANE_DASHES, SURFACE_ASPHALT, SURFACE_COBBLE, SURFACE_DIRT, SURFACE_TABLE, surfaceRollingResistance,
} from '../src/game/surface/surface-table';
import {
  RoadSurfacePaint, SURFACE_CURB_HEIGHT, SURFACE_PAINT_LIFT, buildRoadPaintChunks,
} from '../src/game/surface/road-surface-paint';
import { attachToTrackDoc, roadMaskFromTrackDoc } from '../src/game/surface/surface-storage';
import { applyRollingEffects, createRollingResistanceState } from '../src/game/rolling-resistance';
import { getTrackSpace, lateralFromLaneZ } from '../src/game/track-space';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

test('the surface table has unique IDs in slot order and a base road at 0', () => {
  SURFACE_TABLE.forEach((def, index) => assert.equal(def.id, index, `${def.name} sits at its own ID`));
  assert.equal(SURFACE_TABLE[SURFACE_DIRT].rollingResistance, 1, 'surface 0 changes nothing');
  assert.equal(surfaceRollingResistance(255), 1, 'an unknown ID falls back to the base road');
});

test('brush law: raise, lower, replace the weaker slot', () => {
  const mask = new SurfaceMask(4, 4);
  // Untouched texel {0,0,0}: painting asphalt opens slot 1 for it at the stamp strength.
  assert.equal(mask.applyToTexel(1, 1, SURFACE_ASPHALT, 0.25), true);
  assert.deepEqual(mask.get(1, 1), { id0: 0, id1: SURFACE_ASPHALT, weight: 64, flags: 0 });
  // Same surface again: the weight rises, the IDs do not move.
  mask.applyToTexel(1, 1, SURFACE_ASPHALT, 0.5);
  assert.deepEqual(mask.get(1, 1), { id0: 0, id1: SURFACE_ASPHALT, weight: 192, flags: 0 });
  assert.equal(mask.dominantId(1, 1), SURFACE_ASPHALT);
  // Painting the id0 surface (dirt, the eraser) lowers the weight.
  mask.applyToTexel(1, 1, SURFACE_DIRT, 0.25);
  assert.equal(mask.get(1, 1).weight, 128);
  // A third surface takes the weaker slot: at w=128 id0 is the weaker one.
  mask.applyToTexel(1, 1, SURFACE_COBBLE, 0.2);
  const t = mask.get(1, 1);
  assert.equal(t.id0, SURFACE_COBBLE, 'cobble replaced the weaker slot');
  assert.equal(t.id1, SURFACE_ASPHALT, 'asphalt, the stronger one, stayed');
  assert.equal(t.weight, 255 - 51, 'and cobble starts at the stamp strength');
  // Weights saturate, never wrap.
  for (let i = 0; i < 10; i++) mask.applyToTexel(1, 1, SURFACE_ASPHALT, 1);
  assert.equal(mask.get(1, 1).weight, 255);
  assert.equal(mask.applyToTexel(1, 1, SURFACE_ASPHALT, 1), false, 'a saturated texel reports no change');
});

test('a stamp is round, feathered, tracks its dirty rectangle, and respects locked columns', () => {
  const mask = new SurfaceMask(16, 16);
  const rect = mask.stamp({ cx: 8, cy: 8, radius: 4, hardness: 0.5, opacity: 1, surface: SURFACE_ASPHALT, lockedColumns: new Set([8]) });
  assert.ok(rect, 'something was painted');
  assert.ok(mask.get(7, 8).weight > mask.get(5, 8).weight, 'stronger near the centre than at the rim');
  assert.equal(mask.isPainted(8, 8), false, 'the locked column was skipped');
  assert.equal(mask.isPainted(8, 4), false);
  assert.equal(mask.isPainted(0, 0), false, 'the corner is outside the circle');
  const dirty = mask.takeDirty();
  assert.ok(dirty && dirty.x0 <= 4 && dirty.x1 >= 12 && dirty.y0 <= 4 && dirty.y1 >= 12, 'the dirty rect covers the stamp');
  assert.equal(mask.takeDirty(), null, 'and is cleared once taken');
});

test('undo restores exactly the rectangle a stroke touched', () => {
  const mask = new SurfaceMask(8, 8);
  mask.fill({ x0: 0, y0: 0, x1: 8, y1: 8 }, SURFACE_COBBLE);
  const rect = { x0: 2, y0: 2, x1: 6, y1: 6 };
  const before = mask.snapshot(rect);
  assert.equal(before.bytes.length, 4 * 4 * 4, 'the snapshot is the rectangle, not the mask');
  mask.stamp({ cx: 4, cy: 4, radius: 2, hardness: 1, opacity: 1, surface: SURFACE_ASPHALT });
  assert.equal(mask.dominantId(4, 4), SURFACE_ASPHALT);
  mask.restore(before);
  assert.equal(mask.dominantId(4, 4), SURFACE_COBBLE);
  const pristine = new SurfaceMask(8, 8);
  pristine.fill({ x0: 0, y0: 0, x1: 8, y1: 8 }, SURFACE_COBBLE);
  assert.equal(mask.hash(), pristine.hash(), 'byte-identical to before the stroke');
});

test('RLE + base64 round-trips byte for byte, and the hash names the content', () => {
  const bytes = Uint8Array.from([0, 1, 2, 253, 254, 255, 7]);
  assert.deepEqual(Array.from(base64ToBytes(bytesToBase64(bytes))), Array.from(bytes));

  const road = new RoadMask(12_000);
  road.fillShoulders();
  road.paint(3000, 0.5, { radius: 400, hardness: 0.3, opacity: 0.8, surface: SURFACE_ASPHALT, halfWidth: 480 });
  road.setMarking(2000, 4000, MARK_LANE_DASHES | MARK_CENTRE_DOUBLE);
  const doc = road.toDoc('ridge');
  assert.ok(doc.rle.length < road.byteLength, `a mostly-uniform mask compresses below its raw size (${doc.rle.length} chars for ${road.byteLength} bytes)`);
  const back = RoadMask.fromDoc(doc, 12_000);
  assert.ok(back, 'the document is accepted for the same track length');
  assert.deepEqual(Array.from(back!.bytes), Array.from(road.bytes));
  assert.equal(RoadMask.fromDoc(doc, 20_000), null, 'but refused for a different track');
  assert.equal(RoadMask.fromDoc({ ...doc, hash: 'deadbeef' }, 12_000), null, 'and refused when tampered');

  const trackDoc = attachToTrackDoc({ version: 2, props: [] }, 'ridge', road);
  assert.equal(trackDoc.version, 2, 'the track document keeps its own fields');
  assert.equal(roadMaskFromTrackDoc(trackDoc, 12_000)!.mask.hash(), road.mask.hash());
});

test('road mask: shoulders lock, Shift overrides, markings are per row', () => {
  const road = new RoadMask(6_000, ROAD_MASK_ACROSS, ROAD_MASK_STEP);
  road.fillShoulders();
  assert.equal(road.surfaceIdAt(100, 0.01), ROAD_SHOULDER_SURFACE);
  assert.equal(road.surfaceIdAt(100, 0.99), ROAD_SHOULDER_SURFACE);
  road.paint(1000, 0.02, { radius: 300, hardness: 1, opacity: 1, surface: SURFACE_ASPHALT, halfWidth: 480 });
  assert.equal(road.surfaceIdAt(1000, 0.01), ROAD_SHOULDER_SURFACE, 'the shoulder held');
  assert.equal(road.surfaceIdAt(1000, 0.1), SURFACE_ASPHALT, 'the lane next to it took the paint');
  road.paint(1000, 0.02, { radius: 300, hardness: 1, opacity: 1, surface: SURFACE_ASPHALT, halfWidth: 480, overrideShoulders: true });
  assert.equal(road.surfaceIdAt(1000, 0.01), SURFACE_ASPHALT, 'Shift paints the shoulder');
  road.setMarking(2000, 2600, MARK_LANE_DASHES);
  assert.equal(road.markingAt(2300), MARK_LANE_DASHES);
  assert.equal(road.markingAt(3000), 0);
});

test('the paint ribbon sits on the road frame with authored UVs, and physics reads the paint', () => {
  const map = getTrackSpace();
  const chunks = buildRoadPaintChunks(map);
  assert.ok(chunks.length > 1, 'more than one chunk, so distant paint is culled');
  let checked = 0;
  for (const chunk of chunks) {
    const cols = 4;
    for (let v = 0; v < chunk.uvs.length / 2; v++) {
      const u = chunk.uvs[v * 2], s = chunk.uvs[v * 2 + 1];
      assert.ok(u >= 0 && u <= 1, 'u across is 0‥1');
      const frame = map.frameAt(s);
      const lateral = (u * 2 - 1) * frame.halfWidth;
      const height = SURFACE_PAINT_LIFT + ((v % cols === 0 || v % cols === cols - 1) ? SURFACE_CURB_HEIGHT : 0);
      const ex = frame.pos.x + frame.right.x * lateral + frame.up.x * height;
      const ey = frame.pos.y + frame.right.y * lateral + frame.up.y * height;
      const ez = frame.pos.z + frame.right.z * lateral + frame.up.z * height;
      // float32 at ~1e5 units steps by ~0.016; compare within 0.1.
      assert.ok(near(chunk.positions[v * 3], ex, 0.1) && near(chunk.positions[v * 3 + 1], ey, 0.1) && near(chunk.positions[v * 3 + 2], ez, 0.1), `vertex ${v} of chunk ${chunk.s0} is on the frame`);
      checked++;
    }
  }
  assert.ok(checked > 1000, `every vertex was checked (${checked})`);

  const scene = new THREE.Scene();
  const paint = new RoadSurfacePaint(scene, map, {}, 'ridge', { noAtlas: true });
  assert.equal(paint.meshes.length, chunks.length);
  assert.equal(scene.children[0], paint.root);
  assert.equal(paint.surfaceIdAt(5000, 0), SURFACE_DIRT, 'unpainted: the base road');

  const s = 5000, laneZ = 120;
  const u = RoadMask.lateralFraction(lateralFromLaneZ(map, s, laneZ), map.halfWidthAt(s));
  paint.mask.paint(s, u, { radius: 250, hardness: 0.8, opacity: 1, surface: SURFACE_ASPHALT, halfWidth: map.halfWidthAt(s) });
  assert.equal(paint.surfaceIdAt(s, laneZ), SURFACE_ASPHALT, 'the wheel feels the asphalt');
  assert.equal(paint.surfaceIdAt(s + 3000, laneZ), SURFACE_DIRT, 'but not three kilometres on');
  paint.update();
  assert.equal(paint.stats.uploads, 1, 'one upload for the painted frame');
  paint.update();
  assert.equal(paint.stats.uploads, 1, 'and none for a quiet one');
  paint.dispose();
  assert.equal(scene.children.length, 0, 'dispose leaves the scene as it found it');
});

test('Phase 4: the rolling-resistance hook scales with the surface and defaults to the legacy value', () => {
  const v = { x: 30, y: 0, z: 0 };
  const state = createRollingResistanceState();
  const legacy = applyRollingEffects(v, 100, true, 1 / 120, state).newVelocity.x;
  const same = applyRollingEffects(v, 100, true, 1 / 120, state, 1).newVelocity.x;
  const asphalt = applyRollingEffects(v, 100, true, 1 / 120, state, surfaceRollingResistance(SURFACE_ASPHALT)).newVelocity.x;
  assert.equal(same, legacy, 'a multiplier of 1 is the old behaviour');
  assert.ok(asphalt > legacy, 'asphalt rolls further');
});
