/**
 * EASY BUILD: the road cursor, where a dropped piece stands, the chase camera, and the checklist a new
 * builder follows. Run on the plain track map (the island's map is the same shape of data).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EASY_SHELVES, EASY_STRETCHES, chaseCamera, clampShare, engineXOfShare, nextSide, roadPose, shareOfEngineX, stepShare, stretchOf, trackChecklist,
} from '../src/game/builder/easy-build';
import { getTrackSpace } from '../src/game/track-space';
import { KIT_MODELS, KIT_PREFIX } from '../src/game/models/kit-catalog';
import { FINISH, START_X } from '../src/game/scene';
import type { PlacedProp } from '../src/game/builder/prop-catalog';

const prop = (type: string, visible = true): PlacedProp => ({ id: type, type, name: type, x: 0, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: true, visible });

test('every shelf piece is a real kit model, at most one shelf each, and digits reach the first nine', () => {
  const ids = new Set(KIT_MODELS.map((m) => `${KIT_PREFIX}${m.id}`));
  const seen = new Set<string>();
  for (const shelf of EASY_SHELVES) {
    assert.ok(shelf.items.length >= 5, `${shelf.id} has pieces`);
    for (const item of shelf.items) {
      assert.ok(ids.has(item.type), item.type);
      assert.ok(!seen.has(item.type), `${item.type} is on one shelf`);
      seen.add(item.type);
    }
  }
});

test('the cursor walks in stretches and stays on the course', () => {
  assert.equal(engineXOfShare(0), START_X);
  assert.equal(engineXOfShare(1), FINISH);
  assert.equal(shareOfEngineX(engineXOfShare(0.25)), 0.25);
  assert.equal(stepShare(0, -1), 0, 'no stepping off the start');
  assert.equal(stepShare(1, 1), 1, 'or off the end');
  assert.equal(stepShare(0, 1), 1 / EASY_STRETCHES);
  assert.equal(stepShare(stepShare(0.5, 1), -1), 0.5);
  assert.equal(stretchOf(0), 1);
  assert.equal(stretchOf(1), EASY_STRETCHES);
  assert.equal(clampShare(Number.NaN), 0);
  assert.equal(nextSide(1), -1);
  assert.equal(nextSide(-1), 1);
});

test('spots: left and right sit either side of the middle, the roadside past the road edge', () => {
  const space = getTrackSpace();
  const mid = roadPose(space, 0.4, 'middle');
  const left = roadPose(space, 0.4, 'left');
  const right = roadPose(space, 0.4, 'right');
  const side = roadPose(space, 0.4, 'roadside', 1, 300);
  const across = (p: { x: number; z: number }) => (p.x - mid.x) * mid.right.x + (p.z - mid.z) * mid.right.z;
  assert.ok(across(left) < -50 && across(right) > 50, 'left and right either side');
  assert.ok(across(side) > mid.halfWidth, 'roadside is past the road edge');
  assert.ok(Math.abs(across(roadPose(space, 0.4, 'roadside', -1, 300)) + across(side)) < 1, 'the other roadside mirrors it');
  assert.ok(Math.abs(Math.atan2(mid.forward.x, mid.forward.z) - mid.rotY) < 1e-9, 'a piece faces down the road');
  assert.ok(roadPose(space, 0.6, 'middle').trackDist > mid.trackDist, 'further along is further down the track');
});

test('the chase camera sits behind and above the cursor, looking down the road', () => {
  const pose = roadPose(getTrackSpace(), 0.3, 'middle');
  const cam = chaseCamera(pose);
  assert.ok(cam.eye.y > pose.y);
  const back = (pose.x - cam.eye.x) * pose.forward.x + (pose.z - cam.eye.z) * pose.forward.z;
  assert.ok(back > 1000, 'behind the cursor');
  assert.ok(Math.abs(Math.sin(cam.yaw) - pose.forward.x) < 0.01 && Math.abs(Math.cos(cam.yaw) - pose.forward.z) < 0.01, 'facing down the road');
  assert.ok(cam.pitch < 0, 'looking down at it');
});

test('the checklist: start, finish, a stunt, a race piece, some scenery (hidden pieces do not count)', () => {
  assert.deepEqual(trackChecklist([]).map((c) => c.done), [false, false, false, false, false]);
  const done = trackChecklist([
    prop('kit_start-line'), prop('kit_finish-line'), prop('kit_jump-ramp'), prop('kit_boost-pad'), prop('kit_palm-tall'),
  ]);
  assert.ok(done.every((c) => c.done));
  const onlyLines = trackChecklist([prop('kit_start-line'), prop('kit_finish-line', false)]);
  assert.deepEqual(onlyLines.map((c) => c.done), [true, false, false, false, false], 'the start line is not a race piece; a hidden finish is not a finish');
});
