import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRAME_CORNERS,
  FRAME_DECK_DEPTH_M,
  FRAME_LEG_MAX_M,
  frameToWorld,
  planFrameLegs,
} from './foundation-legs';

const pos = { x: 100, y: 12, z: -40 };

test('flat ground under the deck needs no legs', () => {
  assert.deepEqual(planFrameLegs(pos, 0, () => pos.y - FRAME_DECK_DEPTH_M), []);
  // a corner whose ground is above the deck's underside gets no leg either (the deck sinks there)
  assert.deepEqual(planFrameLegs(pos, 0, () => pos.y - 0.2), []);
});

test('a slope gets a leg under each low corner, and every foot stands on the ground', () => {
  // the ground falls 0.5 m per metre to the east: the east corners are lower
  const ground = (x: number) => pos.y - FRAME_DECK_DEPTH_M - 0.5 * (x - pos.x + 2) - 0.3;
  const legs = planFrameLegs(pos, 0, ground);
  assert.ok(legs.length >= 2, `a slope needs legs under the low corners (got ${legs.length})`);
  for (const leg of legs) {
    assert.ok(Math.abs(leg.footY - leg.groundY) < 0.05, `corner ${leg.corner}: foot ${leg.footY} sits on ground ${leg.groundY}`);
    assert.ok(leg.length >= 0.02 && leg.length <= FRAME_LEG_MAX_M + 1e-9);
    assert.equal(leg.clamped, false);
    assert.ok(Math.abs(leg.groundY - ground(leg.x)) < 1e-9, 'the foot is read from the terrain under its corner');
  }
  const eastLegs = legs.filter((l) => l.x > pos.x);
  const westLegs = legs.filter((l) => l.x < pos.x);
  assert.ok(eastLegs.every((l) => l.length >= westLegs.reduce((m, w) => Math.max(m, w.length), 0) - 1e-9) || westLegs.length === 0, 'the lower east corners have the longer legs');
});

test('a corner more than 3 m above the ground is clamped and flagged, never silently floated', () => {
  const legs = planFrameLegs(pos, 0, () => pos.y - FRAME_DECK_DEPTH_M - 4);
  assert.equal(legs.length, 4);
  for (const leg of legs) {
    assert.equal(leg.length, FRAME_LEG_MAX_M);
    assert.equal(leg.clamped, true);
    assert.ok(leg.footY > leg.groundY, 'the clamped foot stops short of the ground, and the flag says so');
  }
});

test('the piece turns the corners with it (the same turn as the batch matrix)', () => {
  const [u, v] = FRAME_CORNERS[3]!;
  const a = frameToWorld(pos, 0, u, v);
  assert.ok(Math.abs(a.x - (pos.x + u)) < 1e-9 && Math.abs(a.z - (pos.z + v)) < 1e-9);
  const b = frameToWorld(pos, Math.PI / 2, u, v);
  assert.ok(Math.abs(b.x - (pos.x + v)) < 1e-9, 'a quarter turn swaps the axes');
  assert.ok(Math.abs(b.z - (pos.z - u)) < 1e-9);
});

test('the four corners are inset from the deck edge and sit square in the cell', () => {
  assert.equal(FRAME_CORNERS.length, 4);
  for (const [u, v] of FRAME_CORNERS) {
    assert.ok(Math.abs(Math.abs(u) - 1.78) < 1e-9 && Math.abs(Math.abs(v) - 1.78) < 1e-9);
  }
});
