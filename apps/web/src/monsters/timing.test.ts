// The direction pick and the frame timing of the monsters (timing.ts): pure, so they are checked here without a GPU.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TICS_PER_SECOND, bearing, clipTime, frameIndex, pickView, playFor, wrapAngle, yawFromMotion } from './timing';

const DEG = Math.PI / 180;

test('the view faces the viewer when the monster faces the camera, and steps 45 degrees around it', () => {
  // the camera straight ahead of the facing (bearing equal to the yaw) is view 0, unmirrored
  assert.deepEqual(pickView(0, 0), { index: 0, mirror: false });
  assert.deepEqual(pickView(1.3, 1.3), { index: 0, mirror: false });
  // a quarter turn to the camera's side steps to the next view; a half turn (the monster faces away) is view 4
  assert.equal(pickView(0, 45 * DEG).index, 1);
  assert.equal(pickView(0, 90 * DEG).index, 2);
  assert.equal(pickView(0, 135 * DEG).index, 3);
  assert.equal(pickView(0, 180 * DEG).index, 4);
  // the other side: 315 degrees is view 7, which is the mirror of view 1
  assert.equal(pickView(0, -45 * DEG).index, 7);
  assert.equal(pickView(0, -90 * DEG).index, 6);
  assert.equal(pickView(0, -135 * DEG).index, 5);
});

test('views 5 to 7 are the mirrors, and only they are flipped', () => {
  for (let k = 0; k < 360; k += 1) {
    const p = pickView(0, k * DEG);
    assert.equal(p.mirror, p.index >= 5, `at ${k} degrees`);
  }
});

test('the pick depends on the relative angle only, and wraps', () => {
  for (const yaw of [-7, 0.2, 3.1, 9]) {
    for (const off of [0, 30, 100, 250]) {
      const a = pickView(yaw, yaw + off * DEG), b = pickView(yaw + 2 * Math.PI, yaw + 2 * Math.PI + off * DEG);
      assert.deepEqual(a, b);
    }
  }
  assert.equal(pickView(0, 360 * DEG - 1e-9).index, 0, 'a hair short of a full turn is still view 0');
  assert.equal(wrapAngle(-Math.PI / 2), 1.5 * Math.PI);
});

test('bearing is atan2(x, z): zero is +z, a yaw', () => {
  assert.equal(bearing(0, 0, 0, 5), 0);
  assert.ok(Math.abs(bearing(0, 0, 5, 0) - Math.PI / 2) < 1e-12);
  // the camera in front of a monster that faces +z sees it from view 0
  const yaw = bearing(0, 0, 0, 1);
  assert.equal(pickView(yaw, bearing(3, 10, 3, 14)).index, 0);
});

test('a walk cycles its frames at the group tic rate (35 tics a second)', () => {
  const ticks = 6, count = 4;
  const per = ticks / TICS_PER_SECOND;
  assert.equal(frameIndex(count, ticks, 0, 'loop'), 0);
  assert.equal(frameIndex(count, ticks, per * 0.99, 'loop'), 0);
  assert.equal(frameIndex(count, ticks, per * 1.01, 'loop'), 1);
  assert.equal(frameIndex(count, ticks, per * 4.01, 'loop'), 0, 'wraps after count frames');
  assert.equal(frameIndex(count, ticks, per * 13.5, 'loop'), 1);
});

test('a once group plays its frames and holds the last; a hold group stays on its first', () => {
  const ticks = 5, count = 6;
  assert.equal(frameIndex(count, ticks, 0, 'once'), 0);
  assert.equal(frameIndex(count, ticks, 5 / TICS_PER_SECOND * 3.5, 'once'), 3);
  assert.equal(frameIndex(count, ticks, 100, 'once'), 5, 'the death holds its last frame');
  assert.equal(frameIndex(count, ticks, 100, 'hold'), 0);
  assert.equal(frameIndex(1, 4, 99, 'loop'), 0, 'a single frame is always frame 0');
});

test('the phases map to the sprite groups, with the wind-up held on its first attack frame', () => {
  assert.deepEqual(playFor('roam'), { group: 'walk', mode: 'loop' });
  assert.deepEqual(playFor('chase'), { group: 'walk', mode: 'loop' });
  assert.deepEqual(playFor('recover'), { group: 'walk', mode: 'loop' });
  assert.deepEqual(playFor('windup'), { group: 'attack', mode: 'hold' });
  assert.deepEqual(playFor('attack'), { group: 'attack', mode: 'loop' });
  assert.deepEqual(playFor('pain'), { group: 'pain', mode: 'once' });
  assert.deepEqual(playFor('dead'), { group: 'death', mode: 'once' });
});

test('a 3D clip plays its time, loops when it repeats, clamps when it is once, and holds the first pose for a hold', () => {
  assert.equal(clipTime(1, 0.25, 'loop'), 0.25);
  assert.ok(Math.abs(clipTime(1, 2.25, 'loop') - 0.25) < 1e-12);
  assert.equal(clipTime(0.8, 5, 'once'), 0.8);
  assert.equal(clipTime(0.8, -1, 'once'), 0);
  assert.equal(clipTime(0.8, 3, 'hold'), 0);
  assert.equal(clipTime(0, 3, 'loop'), 0, 'no clip, no time');
});

test('the facing follows the last real step and keeps its yaw while the monster stands', () => {
  assert.equal(yawFromMotion(0, 0, 2), 0);
  assert.ok(Math.abs(yawFromMotion(0, 2, 0) - Math.PI / 2) < 1e-12);
  assert.equal(yawFromMotion(1.1, 0, 0), 1.1);
  assert.equal(yawFromMotion(1.1, 1e-6, 0), 1.1, 'a hair of motion is standing still');
});
