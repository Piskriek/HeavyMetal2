/**
 * Balls, pickups and effects sit on the road on every course. Placement used to measure altitude
 * against Rustbucket Ridge's hill profile whatever the course, which lifted everything on Boomtown and
 * Sheep off the road (more the further down the course), and an un-grounded ball on the push-start
 * pad was measured from the old slingshot ground, ~210 units below the pad.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTrackSpace, placementFromEngine, setEngineCourse } from '../src/game/track-space';
import { COURSES } from '../src/game/types';
import { RADIUS, START_X, courseY, laneZ } from '../src/game/scene';

test('a grounded ball is on the road on every course, all the way down', () => {
  const map = getTrackSpace();
  try {
    for (const { id } of COURSES) {
      setEngineCourse(id);
      for (const x of [1000, 10000, 30000, 50000, 70000]) {
        const y = courseY(x, id) - RADIUS;
        const p = placementFromEngine(map, { x, y, z: laneZ(1), grounded: true });
        assert.ok(Math.abs(p.altitude - RADIUS) < 1, `${id} x ${x}: altitude ${p.altitude.toFixed(0)} (road contact is ${RADIUS})`);
      }
    }
  } finally { setEngineCourse('ridge'); }
});

test('the renderer tells placement which course it is drawing, every frame', () => {
  const r = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  assert.match(r, /setEngineCourse\(frame\.options\.course\);/);
});

test('the push-start grid rests on the pad (grounded), not in the air', () => {
  const map = getTrackSpace();
  const x = START_X; const y = courseY(x, 'ridge') - RADIUS;
  assert.ok(placementFromEngine(map, { x, y, z: 0, grounded: false }).altitude > RADIUS + 100, 'un-grounded on the pad floats (the bug)');
  assert.equal(placementFromEngine(map, { x, y, z: 0, grounded: true }).altitude, RADIUS);
  const e = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(e, /if \(this\.startMode === 'push'\) for \(const racer of this\.racers\) \{ racer\.grounded = true;/);
  assert.match(e, /this\.player\.y = this\.y\(this\.player\.x\) - RADIUS;\n\s*this\.player\.grounded = true;/);
});
