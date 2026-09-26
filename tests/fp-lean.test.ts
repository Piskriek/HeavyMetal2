/**
 * Cockpit view through lane changes: it keeps facing down the road (it used to aim at the road's
 * centre line, so after a lane change it ended up facing sideways) and it leans into the turn.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FP_LEAN_MAX_DEG, FP_LOOK_AHEAD, firstPersonFrame, leanAngleFor, leanUp, stepLean, type Vec3,
} from '../src/game/first-person';
import { getTrackSpace, lateralFromLaneZ, placementFromEngine } from '../src/game/track-space';
import { RADIUS, courseY, laneZ } from '../src/game/scene';

const dot = (a: Vec3, b: { x: number; y: number; z: number }) => a[0] * b.x + a[1] * b.y + a[2] * b.z;

/** The renderer's own first-person composition for a ball in `lane` at engine x. */
function viewAt(x: number, lane: number) {
  const map = getTrackSpace();
  const p = placementFromEngine(map, { x, y: courseY(x, 'ridge') - RADIUS, z: laneZ(lane), grounded: true, course: 'ridge' });
  const f = map.frameAt(p.state.s);
  const gyro = { forward: [f.tangent.x, f.tangent.y, f.tangent.z] as Vec3, up: [f.up.x, f.up.y, f.up.z] as Vec3, right: [f.right.x, f.right.y, f.right.z] as Vec3 };
  const look = map.frameAt(Math.min(p.state.s + FP_LOOK_AHEAD, map.length));
  const lateral = lateralFromLaneZ(map, look.dist, laneZ(lane));
  const fp = firstPersonFrame({
    ballCentre: [p.world.x, p.world.y, p.world.z], gyro,
    lookPoint: [look.pos.x + look.right.x * lateral + look.up.x * 140, look.pos.y + look.right.y * lateral + look.up.y * 140, look.pos.z + look.right.z * lateral + look.up.z * 140],
    previousUp: null, dt: 1 / 60, falling: false,
  });
  return { fp, tangent: f.tangent, right: f.right };
}

test('in an outer lane the cockpit still faces down the road, not toward its centre', () => {
  for (const x of [3000, 9000, 20000]) {
    for (const lane of [0, 3]) {
      const { fp, right } = viewAt(x, lane);
      const sideways = Math.abs(dot(fp.forward, right));
      assert.ok(sideways < 0.12, `x ${x} lane ${lane}: view turned ${(Math.asin(sideways) * 180 / Math.PI).toFixed(1)}° sideways`);
    }
  }
});

test('the view leans into a lane change and settles back upright', () => {
  assert.equal(leanAngleFor(0), 0);
  assert.ok(leanAngleFor(-650) < 0, 'steering left (−vz) leans left');
  assert.ok(leanAngleFor(650) > 0);
  assert.ok(Math.abs(leanAngleFor(-9999) + FP_LEAN_MAX_DEG * Math.PI / 180) < 1e-12, 'capped');
  assert.equal(leanAngleFor(Number.NaN), 0);
  let lean = 0;
  for (let i = 0; i < 60; i++) lean = stepLean(lean, leanAngleFor(-650), 1 / 60);
  assert.ok(lean < -0.9 * FP_LEAN_MAX_DEG * Math.PI / 180, 'reaches the lean within a second');
  for (let i = 0; i < 120; i++) lean = stepLean(lean, 0, 1 / 60);
  assert.ok(Math.abs(lean) < 1e-3, 'and comes back upright');
  const frame = { up: [0, 1, 0] as Vec3, right: [-1, 0, 0] as Vec3 };
  const left = leanUp(frame, -0.1);
  assert.ok(left[0] > 0, 'a left lean tips up toward −right (screen-left)');
  assert.ok(Math.abs(Math.hypot(...left) - 1) < 1e-12, 'unit length');
});

test('the renderer uses the lane-true look point and the lean', () => {
  const r = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  // ISLAND-ROUTE: the camera's map is the view map (the player's branch on the island, the one map elsewhere).
  assert.match(r, /const lateral = lateralFromLaneZ\(this\.viewSpace, look\.dist, ball\.z\);/);
  assert.match(r, /const up = leanUp\(fp, this\.fpLean\);\n\s*this\.camera\.position\.set\(fp\.position\[0\], fp\.position\[1\], fp\.position\[2\]\);\n\s*this\.camera\.up\.set\(up\[0\], up\[1\], up\[2\]\);/);
});
