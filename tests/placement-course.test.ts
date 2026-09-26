/**
 * Balls, pickups and effects sit on the road on every course. Placement used to measure altitude
 * against Rustbucket Ridge's hill profile whatever the course, which lifted everything on Boomtown and
 * Sheep off the road (more the further down the course), and an un-grounded ball on the push-start
 * pad was measured from the old slingshot ground, ~210 units below the pad.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTrackSpace, placementFromEngine } from '../src/game/track-space';
import { COURSES } from '../src/game/types';
import { RADIUS, START_X, courseY, laneZ } from '../src/game/scene';

test('a grounded ball is on the road on every course, all the way down', () => {
  const map = getTrackSpace();
  for (const { id } of COURSES) {
    for (const x of [1000, 10000, 30000, 50000, 70000]) {
      const y = courseY(x, id) - RADIUS;
      const p = placementFromEngine(map, { x, y, z: laneZ(1), grounded: true, course: id });
      assert.ok(Math.abs(p.altitude - RADIUS) < 1, `${id} x ${x}: altitude ${p.altitude.toFixed(0)} (road contact is ${RADIUS})`);
    }
  }
});

test('M10: every placement names its course; there is no module-wide course', () => {
  const space = readFileSync(new URL('../src/game/track-space.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(space, /setEngineCourse|let engineCourse/);
  const r = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  assert.match(r, /grounded: racer\.grounded, course: frame\.options\.course \}/, 'the balls');
  assert.match(r, /this\.activeRampSurfaces\(\), frame\.options\.course\);/, 'the pickups');
  assert.match(r, /course: frame\.options\.course, time: raw/, 'the effects');
});

test('the push-start grid rests on the pad (grounded), not in the air', () => {
  const map = getTrackSpace();
  const x = START_X; const y = courseY(x, 'ridge') - RADIUS;
  // M5: height comes from the course under the ball, so an un-grounded ball no longer floats ~210
  // units above the pad (it was measured from the retired slingshot's ground).
  assert.equal(placementFromEngine(map, { x, y, z: 0, grounded: false, course: 'ridge' }).altitude, RADIUS, 'un-grounded on the pad sits on it too');
  assert.ok(placementFromEngine(map, { x, y: y - 300, z: 0, grounded: false, course: 'ridge' }).altitude > RADIUS + 299, 'a jump is measured from the pad');
  assert.equal(placementFromEngine(map, { x, y, z: 0, grounded: true, course: 'ridge' }).altitude, RADIUS);
  const e = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(e, /for \(const racer of this\.racers\) \{ racer\.grounded = true; racer\.y = this\.y\(racer\.x\) - RADIUS; \}/);
  assert.match(e, /this\.player\.y = this\.y\(this\.player\.x\) - RADIUS;\r?\n\s*this\.player\.grounded = true;/);
});
