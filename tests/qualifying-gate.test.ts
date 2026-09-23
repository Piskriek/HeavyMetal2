/**
 * T04 — the named entry gate, its anchoring, and the swept crossing rule.
 *
 * Covers: the gate is the first loop and nothing else; no loop means a typed refusal rather than a
 * silent fallback; the plane cannot be crossed before the loop could engage (so the captured speed is
 * pre-loop); and each rejection the ticket names — wrong lane, reverse, above the gate, wrong segment —
 * behaves as specified, while a step that merely does not reach the plane is not a rejection at all.
 *
 * Run with: node scripts/check.mjs  ·  node --import tsx --test tests/qualifying-gate.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_SEGMENTS, DEFAULT_SEGMENT_PROVIDER, createQualifyingGate, evaluateCrossing, findFirstLoop,
  loopEngagementReach, loopSegmentOf, recordCrossing, segmentAtX, segmentForStep, speedToDisplay,
  surfaceAltitude, canonicalSpeed,
} from '../src/game/qualifying/gate';
import { QualifyingError } from '../src/game/qualifying/errors';
import { courseSetup, manualGate } from './fixtures/qualifying-harness';
import { createSimWorld } from '../src/game/sim/world';
import { COURSES, type CourseId } from '../src/game/types';
import { RADIUS, courseY, laneZ, loopGeometry, type Obstacle } from '../src/game/scene';
import { QUALIFYING_GATE_ID } from '../src/game/contracts/qualifying';
import { validateGateCrossing } from '../src/game/contracts/qualifying';

test('gate: anchored to the first loop on every course, derived and never authored', () => {
  for (const entry of COURSES) {
    const course = entry.id as CourseId;
    const setup = courseSetup(course);
    const loops = setup.layout.filter((obstacle) => obstacle.kind === 'loop').sort((a, b) => a.x - b.x);
    const first = loops[0];
    const geometry = loopGeometry(first, course);
    assert.equal(setup.gate.id, QUALIFYING_GATE_ID, 'the gate is named by the contract');
    assert.equal(setup.gate.loop, first, 'the gate carries the first loop itself');
    assert.equal(setup.gate.x, first.x - (geometry.radius + RADIUS), 'the plane is the loop outer reach');
    assert.equal(setup.gate.x, first.x - loopEngagementReach(first, course));
    assert.equal(setup.gate.z, laneZ(first.lane ?? 2), 'the gate sits in the loop lane');
    assert.equal(setup.gate.loopLane, first.lane ?? 2);
    assert.equal(setup.gate.halfWidth, 120, 'one lane wide');
    assert.equal(setup.gate.altitude, 0, 'the gate is on the dirt');
    assert.equal(setup.gate.altitudeTolerance, 90, 'the frozen tolerance');
    assert.equal(setup.gate.segment, 'approach', 'every course reaches its first loop in the approach segment');
    assert.ok(setup.gate.distance > 0 && setup.gate.distance < 15000, `distance ${setup.gate.distance} is in race units`);
  }
});

test('gate: a course with no loop refuses instead of inventing a gate', () => {
  const withoutLoops: Obstacle[] = [
    { kind: 'boost', x: 500, width: 130, height: 15, lane: 2, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0 },
    { kind: 'sheep', x: 900, width: 62, height: 59, lane: 0, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0 },
  ];
  assert.equal(findFirstLoop(withoutLoops), null);
  assert.throws(() => createQualifyingGate('ridge', withoutLoops), (error: unknown) => {
    assert.ok(error instanceof QualifyingError);
    assert.equal(error.code, 'E_GATE_MISSING');
    assert.equal(error.detail.course, 'ridge');
    return true;
  });
  // Lava loops are a section 3 feature and must not become the entry gate.
  const onlyLava: Obstacle[] = [{ kind: 'lava_loop', x: 5000, width: 380, height: 330, lane: 1, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0 }];
  assert.equal(findFirstLoop(onlyLava), null);
});

test('gate: nothing can engage the loop before the crossing plane', () => {
  const setup = courseSetup('ridge');
  const loop = setup.gate.loop;
  const geometry = loopGeometry(loop, 'ridge');
  // The engagement test in `stepRacer`, replayed across the whole band of positions around the ring.
  let engaged = 0;
  for (let dx = -(geometry.radius + RADIUS) - 60; dx <= geometry.radius + RADIUS + 60; dx += 2) {
    for (let dy = -420; dy <= 420; dy += 4) {
      const x = loop.x + dx;
      const y = geometry.y + dy + courseY(x) - courseY(loop.x);
      const relativeY = y - (courseY(x) - courseY(loop.x)) - geometry.y;
      const inside = Math.abs(dx) <= geometry.radius + RADIUS
        && Math.abs(Math.hypot(dx, relativeY) - geometry.ballRadius) < RADIUS * 1.12;
      if (!inside) continue;
      engaged++;
      assert.ok(x >= setup.gate.x, `a racer at x ${x} could ride the loop before the gate plane at ${setup.gate.x}`);
    }
  }
  assert.ok(engaged > 50, `the scan must actually find engagement positions (found ${engaged})`);
});

test('crossing: a forward swept crossing in the gate lane is valid, sub-tick and monotone', () => {
  const setup = courseSetup('ridge');
  const world = createSimWorld('ridge', setup.layout, setup.pickups);
  const gate = setup.gate;
  const outcome = evaluateCrossing(world, gate,
    { x: gate.x - 9, y: courseY(gate.x - 9, 'ridge') - RADIUS, z: gate.z },
    { x: gate.x + 9, y: courseY(gate.x + 9, 'ridge') - RADIUS, z: gate.z },
    'approach');
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.ok(outcome.fraction > 0.4 && outcome.fraction < 0.6, `fraction ${outcome.fraction} should sit mid-step`);
    assert.ok(outcome.distance > 0);
  }
  // A fast racer must not tunnel past the plane: the whole movement range is tested, not one sample.
  const fast = evaluateCrossing(world, gate,
    { x: gate.x - 900, y: courseY(gate.x - 900, 'ridge') - RADIUS, z: gate.z },
    { x: gate.x + 900, y: courseY(gate.x + 900, 'ridge') - RADIUS, z: gate.z },
    'approach');
  assert.equal(fast.ok, true, 'a 1800-unit step still registers the crossing');
  if (fast.ok) assert.ok(Math.abs(fast.fraction - 0.5) < 1e-9, 'the fraction is the true mid-step position');
});

test('crossing: wrong lane, reverse, above the gate and wrong segment are each refused by name', () => {
  const setup = courseSetup('ridge');
  const world = createSimWorld('ridge', setup.layout, setup.pickups);
  const gate = setup.gate;
  const groundAt = (x: number) => courseY(x, 'ridge') - RADIUS;
  const across = (z: number, from = gate.x - 9, to = gate.x + 9, segment: string | null = 'approach', yFrom = groundAt(from), yTo = groundAt(to)) =>
    evaluateCrossing(world, gate, { x: from, y: yFrom, z }, { x: to, y: yTo, z }, segment);

  // One lane over is 240 units of z away; the gate is one lane wide.
  const wrongLane = across(gate.z - 240);
  assert.equal(wrongLane.ok, false);
  if (!wrongLane.ok) assert.equal(wrongLane.reason, 'wrong-lane');
  // Half a lane off is still outside the gate lane.
  const edge = across(gate.z - 119);
  assert.equal(edge.ok, true, 'the inside edge of the lane still counts');
  const justOff = across(gate.z - 121);
  assert.equal(justOff.ok, false);
  if (!justOff.ok) assert.equal(justOff.reason, 'wrong-lane');

  const reverse = evaluateCrossing(world, gate,
    { x: gate.x + 9, y: groundAt(gate.x + 9), z: gate.z },
    { x: gate.x - 9, y: groundAt(gate.x - 9), z: gate.z }, 'approach');
  assert.equal(reverse.ok, false);
  if (!reverse.ok) assert.equal(reverse.reason, 'reverse', 'riding backwards through the plane is never a time');
  const sideways = evaluateCrossing(world, gate,
    { x: gate.x, y: groundAt(gate.x), z: gate.z },
    { x: gate.x, y: groundAt(gate.x), z: gate.z - 40 }, 'approach');
  assert.equal(sideways.ok, false);
  if (!sideways.ok) assert.equal(sideways.reason, 'reverse', 'zero forward motion is not a crossing either');

  // 90 units is the tolerance: a small hop qualifies, a spring launch does not.
  const hopped = evaluateCrossing(world, gate,
    { x: gate.x - 9, y: groundAt(gate.x - 9) - 80, z: gate.z },
    { x: gate.x + 9, y: groundAt(gate.x + 9) - 80, z: gate.z }, 'approach');
  assert.equal(hopped.ok, true, 'a hop at the plane is inside the altitude band');
  const flown = evaluateCrossing(world, gate,
    { x: gate.x - 9, y: groundAt(gate.x - 9) - 320, z: gate.z },
    { x: gate.x + 9, y: groundAt(gate.x + 9) - 320, z: gate.z }, 'approach');
  assert.equal(flown.ok, false);
  if (!flown.ok) assert.equal(flown.reason, 'above-gate');

  const wrongSegment = across(gate.z, gate.x - 9, gate.x + 9, 'mine');
  assert.equal(wrongSegment.ok, false);
  if (!wrongSegment.ok) assert.equal(wrongSegment.reason, 'wrong-segment');
  const straddling = across(gate.z, gate.x - 9, gate.x + 9, null);
  assert.equal(straddling.ok, true, 'a step that straddles a segment boundary is not refused for it');
});

test('crossing: missing the plane is not a rejection', () => {
  const setup = courseSetup('ridge');
  const world = createSimWorld('ridge', setup.layout, setup.pickups);
  const gate = setup.gate;
  const y = courseY(500, 'ridge') - RADIUS;
  const short = evaluateCrossing(world, gate, { x: 400, y, z: gate.z }, { x: 500, y, z: gate.z }, 'approach');
  assert.equal(short.ok, false);
  if (!short.ok) {
    assert.equal(short.reason, 'missed');
    assert.equal(short.fraction, 1, 'the fraction is clamped into [0,1] for reporting only');
  }
  const beyond = evaluateCrossing(world, gate, { x: gate.x + 40, y, z: gate.z }, { x: gate.x + 140, y, z: gate.z }, 'approach');
  assert.equal(beyond.ok, false);
  if (!beyond.ok) {
    assert.equal(beyond.reason, 'missed');
    assert.equal(beyond.fraction, 0);
  }
});

test('crossing: riding the loop is a different segment from the ground under it', () => {
  const setup = courseSetup('ridge');
  const loop = setup.gate.loop;
  const riding = DEFAULT_SEGMENT_PROVIDER.segmentOf({ x: setup.gate.x, loop });
  const ground = DEFAULT_SEGMENT_PROVIDER.segmentOf({ x: setup.gate.x, loop: null });
  assert.equal(riding, loopSegmentOf(loop));
  assert.equal(ground, segmentAtX(setup.gate.x));
  assert.notEqual(riding, ground);
  assert.equal(segmentForStep(DEFAULT_SEGMENT_PROVIDER, { x: 100, loop }, { x: 200, loop }), riding, 'a whole step in the loop keeps its segment');
  assert.equal(segmentForStep(DEFAULT_SEGMENT_PROVIDER, { x: 100, loop: null }, { x: 100, loop }), null, 'entering the loop mid-step straddles');

  // The same sweep, once on the dirt and once while riding, judged by the contract's own validator.
  const gate = manualGate({ segment: riding });
  const outcome = validateGateCrossing({
    from: { x: gate.x - 5, z: gate.z, altitude: 0 },
    to: { x: gate.x + 5, z: gate.z, altitude: 0 },
    gate,
    segment: 'approach',
  });
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.reason, 'wrong-segment');
});

test('segments: the canonical bands match the course geography', () => {
  assert.deepEqual([...CANONICAL_SEGMENTS], ['approach', 'canyon-lip', 'waterfall-zigzag', 'mine', 'stadium']);
  assert.equal(segmentAtX(190), 'approach');
  assert.equal(segmentAtX(20000), 'approach');
  assert.equal(segmentAtX(24200), 'canyon-lip');
  assert.equal(segmentAtX(26000), 'waterfall-zigzag');
  assert.equal(segmentAtX(49000), 'mine');
  assert.equal(segmentAtX(70000), 'stadium');
});

test('capture: the recorded speed is the pre-obstacle velocity, not the loop boost', () => {
  const setup = courseSetup('ridge');
  const loop = setup.gate.loop;
  // A gate parked on the loop centre: the ride rewrites the position and floors the ride speed at
  // 650 on the same tick, so a capture taken after the step would be wrong in two ways at once.
  const gate = manualGate({ x: loop.x, segment: segmentAtX(loop.x) });
  assert.ok(gate.x > setup.gate.x);
  const world = createSimWorld('ridge', setup.layout, setup.pickups);
  const from = { x: loop.x - 12, y: courseY(loop.x - 12, 'ridge') - RADIUS, z: gate.z };
  const to = { x: loop.x + 12, y: courseY(loop.x + 12, 'ridge') - RADIUS, z: gate.z };
  const outcome = evaluateCrossing(world, gate, from, to, 'approach');
  assert.equal(outcome.ok, true, 'a ring position must not move the capture point behind the plane');
  if (!outcome.ok) return;
  const approach = { vx: 512, vy: -60 };
  const crossing = recordCrossing(40, outcome, approach.vx, approach.vy, 1 / 120);
  assert.equal(crossing.tick, 40);
  assert.ok(Math.abs(crossing.time - (40 + outcome.fraction) / 120) < 1e-12, 'the time is sub-tick');
  assert.equal(crossing.speed, canonicalSpeed(approach.vx, approach.vy));
  assert.ok(crossing.speed < 650, 'captured below the floor the ride would apply');
  assert.ok(Math.abs(crossing.distance - (gate.x - from.x)) < 1e-9, 'distance is the travelled part of the step');
  assert.equal(crossing.vx, approach.vx);
  assert.equal(crossing.vy, approach.vy);
  assert.equal(speedToDisplay(crossing.speed), Math.round(crossing.speed * 0.16 * 10) / 10, 'the HUD conversion is the engine one');
});

test('altitude: surface altitude is measured the way the camera and the decal measure it', () => {
  const setup = courseSetup('ridge');
  const world = createSimWorld('ridge', setup.layout, setup.pickups);
  const x = 4000;
  const surface = courseY(x, 'ridge');
  assert.equal(surfaceAltitude(world, x, surface - RADIUS), 0, 'rolling on the dirt is zero');
  assert.equal(surfaceAltitude(world, x, surface - RADIUS - 120), 120);
  assert.ok(surfaceAltitude(world, x, surface + 400) < 0, 'below the surface is negative');
});

test('gate: the gate object is the contract shape and cannot be mutated by a caller', () => {
  const setup = courseSetup('ridge');
  const gate = setup.gate;
  assert.throws(() => { (gate as { x: number }).x = 0; }, TypeError, 'frozen, per the contract');
  const keys = Object.keys(gate).sort();
  for (const required of ['id', 'x', 'z', 'halfWidth', 'altitude', 'altitudeTolerance', 'segment']) {
    assert.ok(keys.includes(required), `the gate must carry ${required}`);
  }
});
