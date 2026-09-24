/**
 * M01 · T1c — the run-up to the sorting loop.
 *
 * The pool used to anchor at the course's *first* loop. That loop is 1.93 s from the goblin's shove on
 * every course — the start pad is a flat crest 240 above the ground and its lip sits directly above the
 * first ring — so the ready-up panel arrived two seconds into the run and every split read ~2 s. The
 * sort now anchors at `MERGE_SORTING_LOOP_INDEX`, the loop at the bottom of the opening descent.
 *
 * This file is the law for the run-up that leads there:
 *
 *   1. the run-up is the start zone plus the **loops** below the sorting gate, and nothing else. The
 *      jump line below the gate cannot simply be kept: riders are airborne over it (measured 155–823
 *      units up at ridge's second loop, outside the gate's own altitude band), a field that flies over
 *      the plane never queues, and the pool would then wait out its whole backstop;
 *   2. driving the field exactly as the engine does, all four riders reach the plane and queue, on every
 *      course, after a real opening stint rather than two seconds;
 *   3. the engine builds that same run-up and that same gate plane — the two `readFileSync` guards.
 *
 * UNVERIFIED: these are headless numbers. How the ready-up panel *looks* at that moment is browser-only.
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
  DEFAULT_SEGMENT_PROVIDER, createQualifyingGate, evaluateCrossing, segmentForStep,
} from '../src/game/qualifying/gate';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { DEFAULT_PUSH_SEED, PUSH_TICKS, applyPushTick, startPushVelocity } from '../src/game/sim/start-push';
import { MERGE_GATE_HALF_WIDTH, MERGE_SORTING_LOOP_INDEX } from '../src/game/merge/pool';
import { RADIUS } from '../src/game/scene';

/** Every loop on a course, in down-range order — the same order `createQualifyingGate` indexes. */
function loopsOf(course: CourseId) {
  return createTrackLayout(course).filter((obstacle) => obstacle.kind === 'loop')
    .sort((a, b) => a.x - b.x);
}

/** The engine's own run-up, verbatim: sort at `MERGE_SORTING_LOOP_INDEX`, start zone at the first loop. */
function runUpOptions(course: CourseId) {
  const bare = createTrackLayout(course);
  return {
    startZoneEndX: createQualifyingGate(course, bare).x,
    sortGate: createQualifyingGate(course, bare, { loopIndex: MERGE_SORTING_LOOP_INDEX }),
  };
}

function runUpLayout(course: CourseId) {
  const { startZoneEndX, sortGate } = runUpOptions(course);
  return createTrackLayout(course, {
    skipBeforeX: sortGate.x,
    keepLoopsFromX: startZoneEndX,
  });
}

/** Every rider's crossing of the sorting plane, driven as the engine drives the field. */
function crossGate(course: CourseId) {
  const { startZoneEndX, sortGate } = runUpOptions(course);
  const layout = createTrackLayout(course, {
    skipBeforeX: sortGate.x,
    keepLoopsFromX: startZoneEndX,
  });
  const world = createSimWorld(course, layout, createAirPickups(course, layout));
  const racers = createRacers();
  // The engine's own merge gate, field for field: the sort plane, the race's own lane containment.
  const gate = { ...sortGate, z: 0, halfWidth: MERGE_GATE_HALF_WIDTH };
  const gateX = gate.x;
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
      if (!(from.x < gateX && racer.x >= gateX)) continue;
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
  return { entries, misses, ticks: tick };
}

test('the run-up keeps the loops below the sorting gate and drops the jump line', () => {
  for (const course of COURSES) {
    const bare = createTrackLayout(course.id);
    const { startZoneEndX, sortGate } = runUpOptions(course.id);
    const loops = loopsOf(course.id);
    const context = course.id;

    assert.equal(sortGate.loop.x, loops[MERGE_SORTING_LOOP_INDEX].x,
      `${context}: the sort is anchored at loop ${MERGE_SORTING_LOOP_INDEX + 1}`);
    assert.ok(MERGE_SORTING_LOOP_INDEX >= 1,
      `${context}: the sort must be deeper than the loop the start pad hangs over`);
    assert.ok(sortGate.x > startZoneEndX + 4000,
      `${context}: the sort plane is only ${(sortGate.x - startZoneEndX).toFixed(0)} past the start zone`);

    const runUp = runUpLayout(course.id);
    const belowGate = runUp.filter((obstacle) => obstacle.x < sortGate.x);
    assert.ok(belowGate.length > 0, `${context}: the run-up kept no loops at all`);
    for (const obstacle of belowGate) {
      assert.equal(obstacle.kind, 'loop',
        `${context}: the run-up kept a ${obstacle.kind} at x=${obstacle.x.toFixed(0)} below the sort`);
    }
    assert.deepEqual(
      belowGate.map((obstacle) => obstacle.x),
      loops.filter((loop) => loop.x >= startZoneEndX && loop.x < sortGate.x).map((loop) => loop.x),
      `${context}: the run-up loops are exactly the loops between the start zone and the sort`,
    );

    // The trim has to bite: the descent is jump line, and keeping it is what breaks the gate.
    const dropped = bare.filter((obstacle) => obstacle.x >= startZoneEndX && obstacle.x < sortGate.x
      && obstacle.kind !== 'loop');
    assert.ok(dropped.length > 0, `${context}: nothing was dropped below the sort — is the layout flat?`);
    for (const obstacle of dropped) {
      assert.ok(!runUp.includes(obstacle),
        `${context}: a ${obstacle.kind} at x=${obstacle.x.toFixed(0)} survived the run-up trim`);
    }

    // Everything from the sort gate on is the course, untouched and in the same order.
    const tail = bare.filter((obstacle) => obstacle.x >= sortGate.x);
    assert.deepEqual(runUp.filter((obstacle) => obstacle.x >= sortGate.x).map((obstacle) => obstacle.x),
      tail.map((obstacle) => obstacle.x), `${context}: the race course after the sort changed`);
  }
});

test('the whole field queues at the sorting loop, after a real opening stint', () => {
  for (const course of COURSES) {
    const run = crossGate(course.id);
    const context = course.id;

    assert.deepEqual(run.misses, [], `${context}: the field flew over its own sorting plane`);
    const times = run.entries.map((tick) => tick / 120);
    for (const [index, tick] of run.entries.entries()) {
      assert.ok(tick > 0, `${context}: racer ${index} never reached the sorting gate`);
    }
    // The user's complaint was a 2 s split: the ready-up arrived before the run had begun. The floor
    // is deliberately not a tuning value — it only says the opening stint is a run and not a fall.
    const first = Math.min(...times);
    assert.ok(first >= 4,
      `${context}: the field reached the sorting plane ${first.toFixed(2)} s after the shove`);
    // And the field is still a field when it gets there: the pool closes on its own, well inside the
    // backstop it carries for a player who cannot make the plane at all.
    const spread = Math.max(...times) - first;
    assert.ok(spread <= 3,
      `${context}: the field arrived spread over ${spread.toFixed(2)} s — the run-up broke it up`);
    assert.ok(Math.max(...times) < 20,
      `${context}: the last rider reached the plane at ${Math.max(...times).toFixed(2)} s`);
  }
});

test('the engine builds the same run-up and the same gate plane', () => {
  const source = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(source, /loopIndex: MERGE_SORTING_LOOP_INDEX/,
    'the merge gate must anchor at the sorting loop, not the first one');
  assert.match(source, /keepLoopsFromX: startZoneEndX/,
    'the push run-up must keep the loops the field rides down to the sorting gate');
  assert.match(source, /skipBeforeX: createQualifyingGate\(this\.options\.course, built, \{\s*loopIndex: MERGE_SORTING_LOOP_INDEX,/,
    'the run-up trim must stop at the sorting plane');
  assert.doesNotMatch(source, /skipBeforeX: startZoneEndX/,
    'the run-up must not be trimmed back to the start zone — that is the two-second ready-up again');
});
