/**
 * M01 · T1d — the run-up to the **geometry loop**, and the checkpoint at its mouth.
 *
 * The sorting plane is not a ring decoration's reach: it is the mouth of the 360° loop that is part of
 * the track's own geometry (`LOOP_DEFINITIONS` in `track-space.ts`), and the granite tunnel portal the
 * user placed (`prop_26_granite_tunnel_portal`) stands at that mouth. Their words: *"the loop i was
 * refering to is a giant loop in the actual 3d geometry of the track where the lanes do a 360 deg loop,
 * at the mouth of the loop is a decoration called public/art/props/prop-26-granite-tunnel-portal.png
 * ... that should serve as the first checkpoint."*
 *
 * This file is the law for that run-up:
 *
 *   1. the plane is **derived from the geometry** (arc length → engine x through the track-space map),
 *      never authored: it is the alpine loop's mouth, and that loop is a real circle in the spline;
 *   2. the run-up is the start zone plus the **rings** below the mouth, and nothing else. The jump line
 *      under the plane cannot be kept: riders are airborne over it (measured 155–823 units up at ridge's
 *      second ring, outside the gate's altitude band), a field that flies over the plane never queues,
 *      and the pool would then wait out its whole backstop;
 *   3. driving the field exactly as the engine does, all four riders reach the plane and queue, on every
 *      course, after a real opening stint rather than two seconds;
 *   4. the engine builds that same plane and that same run-up — the `readFileSync` guards.
 *
 * UNVERIFIED: these are headless numbers. Whether the portal reads as "the first checkpoint" on screen,
 * and where the split board sits while the field goes through it, are browser calls.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSES, type CourseId } from '../src/game/types';
import { createRacers } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { stepRacer } from '../src/game/sim/racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { createTrackLayout } from '../src/game/track-layout';
import { createAirPickups } from '../src/game/powerups';
import { driveCpu, type CpuContext } from '../src/game/sim/cpu-driver';
import {
  DEFAULT_SEGMENT_PROVIDER, createQualifyingGate, evaluateCrossing, segmentAtX, segmentForStep,
} from '../src/game/qualifying/gate';
import {
  QUALIFYING_GATE_ALTITUDE_TOLERANCE, QUALIFYING_GATE_ID,
} from '../src/game/contracts/qualifying';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { DEFAULT_PUSH_SEED, PUSH_TICKS, applyPushTick, startPushVelocity } from '../src/game/sim/start-push';
import { MERGE_GATE_HALF_WIDTH } from '../src/game/merge/pool';
import {
  PASSAGE_CENTRE_Z, PASSAGE_PORTAL_PROP_TYPE, PASSAGE_STAGE,
  passageExitX, passageLoop, passageMouthX, passageRadius,
} from '../src/game/qualifying/passage';
import { RADIUS } from '../src/game/scene';

/** Every ring obstacle on a course, in down-range order. */
function ringsOf(course: CourseId) {
  return createTrackLayout(course).filter((obstacle) => obstacle.kind === 'loop')
    .sort((a, b) => a.x - b.x);
}

/** The start zone's own boundary: the first ring's entry plane (`createQualifyingGate`'s default). */
function startZoneEndX(course: CourseId) {
  return createQualifyingGate(course, createTrackLayout(course)).x;
}

/** The engine's own sorting plane (T1d), field for field — geometry, not an obstacle. */
function mergeGate() {
  const x = passageMouthX();
  return {
    id: QUALIFYING_GATE_ID, x, z: PASSAGE_CENTRE_Z, halfWidth: MERGE_GATE_HALF_WIDTH,
    altitude: 0, altitudeTolerance: QUALIFYING_GATE_ALTITUDE_TOLERANCE, segment: segmentAtX(x),
  };
}

/** The engine's own run-up: trimmed to the mouth, with the rings above the start zone kept. */
function runUpLayout(course: CourseId) {
  return createTrackLayout(course, {
    skipBeforeX: passageMouthX(),
    keepLoopsFromX: startZoneEndX(course),
  });
}

/** Every rider's crossing of the sorting plane, driven as the engine drives the field. */
function crossGate(course: CourseId) {
  const layout = runUpLayout(course);
  const world = createSimWorld(course, layout, createAirPickups(course, layout));
  const racers = createRacers();
  const gate = mergeGate();
  let tick = 0;
  const ctx: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: () => 0.62,
    get runTime() { return tick / 120; },
    get wallTime() { return tick / 120; },
  };
  const cpu: CpuContext = {
    step: ctx, difficulty: 'racer', others: racers,
    get paceTargetX() { return racers[0].x; },
    stagger: (racer) => racer.id * 0.023,
  };

  const pushes = racers.map((racer) => startPushVelocity(racer.pace, DEFAULT_PUSH_SEED, racer.id));
  for (let k = 1; k <= PUSH_TICKS; k++) {
    tick += 1;
    for (let i = 0; i < racers.length; i++) {
      const racer = racers[i];
      applyPushTick(racer, k, pushes[i]);
      racer.x += racer.vx * FIXED_STEP;
      racer.y = world.y(racer.x) - RADIUS;
      racer.rotation += racer.vx * FIXED_STEP / RADIUS;
    }
  }

  const entries = racers.map(() => -1);
  const misses: string[] = [];
  for (; tick < PUSH_TICKS + 9000; tick++) {
    for (let i = 0; i < racers.length; i++) {
      const racer = racers[i];
      racer.previous = { x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation };
      if (racer.finished) continue;
      driveCpu(racer, cpu);
      stepRacer(racer, ctx, FIXED_STEP);
    }
    for (let i = 0; i < racers.length; i++) {
      const racer = racers[i];
      if (entries[i] >= 0) continue;
      const from = racer.previous;
      if (!(from.x < gate.x && racer.x >= gate.x)) continue;
      const segment = segmentForStep(
        DEFAULT_SEGMENT_PROVIDER,
        { x: from.x, loop: null },
        { x: racer.x, loop: racer.loopRide?.obstacle ?? null },
      );
      const outcome = evaluateCrossing(world, gate, from, racer, segment);
      if (!outcome.ok) {
        if (misses.length < 4) misses.push(`${racer.id}:${outcome.reason}`);
        entries[i] = -2;
        continue;
      }
      entries[i] = tick;
    }
  }
  return { entries, misses };
}

test('the sorting plane is the mouth of the track\'s own 360° loop', () => {
  const loop = passageLoop();
  const mouth = passageMouthX();
  const exit = passageExitX();

  assert.equal(loop.stage, PASSAGE_STAGE, 'the race sorts at the alpine loop');
  assert.ok(loop.radius >= 1000,
    `the sorting loop is a real circle, not a ring decoration (radius ${loop.radius})`);
  assert.ok(exit - mouth > 3000,
    `the circle spans ${(exit - mouth).toFixed(0)} engine x-units — it is a 360°, not a bump`);
  assert.equal(passageRadius(), loop.radius, 'the radius is the geometry\'s own');

  // Authored, not invented: the portal is the user's placed prop, named in exactly one place.
  assert.equal(PASSAGE_PORTAL_PROP_TYPE, 'prop_26_granite_tunnel_portal',
    'the checkpoint is marked by the granite tunnel portal');

  // The plane has to be deeper than the ring the start pad hangs over, or the ready-up is back to
  // arriving two seconds into the run — the whole point of the correction.
  for (const course of COURSES) {
    const rings = ringsOf(course.id);
    assert.ok(rings[0].x < mouth,
      `${course.id}: the plane is not past the first ring`);
    const runUpRings = rings.filter((ring) => ring.x < mouth);
    assert.ok(runUpRings.length >= 1,
      `${course.id}: the run-up has no rings at all — the descent would be a straight line`);
    assert.equal(runUpRings[0].x, rings[0].x, `${course.id}: the run-up rings start at the first ring`);
  }
});

test('the run-up keeps the rings below the sorting plane and drops the jump line', () => {
  for (const course of COURSES) {
    const bare = createTrackLayout(course.id);
    const mouth = passageMouthX();
    const startZone = startZoneEndX(course.id);
    const context = course.id;

    const runUp = runUpLayout(course.id);
    const belowPlane = runUp.filter((obstacle) => obstacle.x < mouth);
    assert.ok(belowPlane.length > 0, `${context}: the run-up kept nothing at all`);
    for (const obstacle of belowPlane) {
      assert.equal(obstacle.kind, 'loop',
        `${context}: the run-up kept a ${obstacle.kind} at x=${obstacle.x.toFixed(0)} below the plane`);
    }
    assert.deepEqual(belowPlane.map((obstacle) => obstacle.x),
      ringsOf(course.id).filter((ring) => ring.x >= startZone && ring.x < mouth).map((ring) => ring.x),
      `${context}: the run-up rings are exactly the rings between the start zone and the plane`);

    // The trim has to bite: the descent is jump line, and keeping it is what breaks the gate.
    const dropped = bare.filter((obstacle) => obstacle.x >= startZone && obstacle.x < mouth
      && obstacle.kind !== 'loop');
    assert.ok(dropped.length > 0, `${context}: nothing was dropped below the plane — is the layout flat?`);
    for (const obstacle of dropped) {
      assert.ok(!runUp.includes(obstacle),
        `${context}: a ${obstacle.kind} at x=${obstacle.x.toFixed(0)} survived the run-up trim`);
    }

    // Everything from the plane on is the course, untouched and in the same order.
    const tail = bare.filter((obstacle) => obstacle.x >= mouth);
    assert.deepEqual(runUp.filter((obstacle) => obstacle.x >= mouth).map((obstacle) => obstacle.x),
      tail.map((obstacle) => obstacle.x),
      `${context}: the race course after the sorting plane changed`);
  }
});

test('the whole field queues at the mouth, after a real opening stint', () => {
  for (const course of COURSES) {
    const run = crossGate(course.id);
    const context = course.id;

    assert.deepEqual(run.misses, [], `${context}: the field flew over its own sorting plane`);
    const times = run.entries.map((tick) => tick / 120);
    for (const [index, tick] of entriesOf(run).entries()) {
      assert.ok(tick > 0, `${context}: racer ${index} never reached the sorting plane`);
    }

    // The user's complaint was a 2 s split: the ready-up arrived before the run had begun. The floor is
    // deliberately not a tuning value — it only says the opening stint is a run and not a fall.
    const first = Math.min(...times);
    assert.ok(first >= 4,
      `${context}: the field reached the plane ${first.toFixed(2)} s after the shove`);
    const spread = Math.max(...times) - first;
    assert.ok(spread <= 3,
      `${context}: the field arrived spread over ${spread.toFixed(2)} s — the run-up broke it up`);
    assert.ok(Math.max(...times) < 20,
      `${context}: the last rider reached the plane at ${Math.max(...times).toFixed(2)} s`);
  }
});

function entriesOf(run: { entries: number[] }) {
  return run.entries;
}

test('the engine builds the same plane and the same run-up', () => {
  const source = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(source, /const x = passageMouthX\(\);/,
    'the merge gate must be the geometry loop\'s mouth (T1d), not a ring\'s reach');
  assert.match(source, /skipBeforeX: passageMouthX\(\),/, 'the run-up must be trimmed to the mouth');
  assert.match(source, /keepLoopsFromX: startZoneEndX/,
    'the run-up must keep the rings the field rides down to the mouth');
  assert.doesNotMatch(source, /skipBeforeX: startZoneEndX/,
    'the run-up must not be trimmed back to the start zone — that is the two-second ready-up again');
  assert.match(source, /if \(!racer\.mergeGhost \|\| racer\.loopRide !== null \|\| !insidePassage\(racer\.x\)\) continue;/,
    'the barrel must carry released riders at the release speed, single file');
});
