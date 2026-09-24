/**
 * M01 · T1 — the start zone, headless: push → hill → first loop.
 *
 * Run with: `node --import tsx --test tests/start-zone.test.ts` (also registered in scripts/check.mjs).
 *
 * This is AC-3/AC-4/AC-5/AC-6 of the start-zone ticket: every roster loadout has to reach the first
 * loop's gate at engagement speed with no stall on the run-in, and the change must be invisible to
 * everything past the gate. The harness below is a faithful copy of the engine's push loop
 * (`GameEngine.stepPush`) and its race step (`stepRacer` with the legacy recovery), minus input.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, type CourseId } from '../src/game/types';
import { TRACKS } from '../src/game/courses';
import { createRacers, type Racer } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { stepRacer } from '../src/game/sim/racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { createTrackLayout } from '../src/game/track-layout';
import { createAirPickups } from '../src/game/powerups';
import { createQualifyingGate } from '../src/game/qualifying/gate';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { engineDistanceFromX } from '../src/game/track-space';
import {
  DEFAULT_PUSH_SEED, PUSH_TICKS, applyPushTick, startPushVelocity,
} from '../src/game/sim/start-push';
import {
  FINISH, GROUND, RADIUS, START_DROP, START_PAD_END_X, START_X, START_Y, TRACK_DISTANCE, courseY, laneZ, loopGeometry,
} from '../src/game/scene';

const COURSE_COUNT = COURSES.length;

/** One loaded racer, pushed down the pad and then left to the real physics until it rides the loop. */
interface StartRun {
  readonly racer: Racer;
  readonly gateX: number;
  readonly target: number;
  readonly gateTick: number;
  readonly gateVx: number;
  readonly loopTick: number;
  readonly maxStallTicks: number;
  readonly minVx: number;
}

function firstLoopGate(course: CourseId) {
  const layout = createTrackLayout(course);
  return { gate: createQualifyingGate(course, layout), layout };
}

function runFromGrid(seed: number, course: CourseId = 'ridge', id = 0): StartRun {
  const { gate } = firstLoopGate(course);
  const layout = createTrackLayout(course, { skipBeforeX: gate.x });
  const pickups = createAirPickups(course, layout);
  const world = createSimWorld(course, layout, pickups);
  const template = createRacers()[id];
  // The first loop is lane-filtered (measured: `occupiesLane` half-width 87.7), so the acceptance
  // run holds the racing line through the loop's own lane — exactly what a rider aiming at the loop
  // does. Grid lanes still differ (that is what `createRacers` built above).
  const loopLane = createTrackLayout(course).find((obstacle) => obstacle.kind === 'loop')!.lane;
  const racer: Racer = { ...template, lane: loopLane, targetLane: loopLane, z: laneZ(loopLane) };
  let runTime = 0;
  const ctx: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: () => 0.5,
    get runTime() { return runTime; },
    get wallTime() { return runTime; },
  };
  const target = startPushVelocity(racer.pace, seed, racer.id);
  // The engine's push ticks (GameEngine.stepPush), verbatim.
  for (let k = 1; k <= PUSH_TICKS; k++) {
    runTime += FIXED_STEP;
    applyPushTick(racer, k, target);
    racer.x += racer.vx * FIXED_STEP;
    racer.y = courseY(racer.x, course) - RADIUS;
    racer.rotation += racer.vx * FIXED_STEP / RADIUS;
  }
  let gateTick = -1; let gateVx = 0; let loopTick = -1;
  let stall = 0; let maxStallTicks = 0; let minVx = Number.POSITIVE_INFINITY;
  for (let tick = 0; tick < 900; tick++) {
    runTime += FIXED_STEP;
    stepRacer(racer, ctx, FIXED_STEP);
    minVx = Math.min(minVx, racer.vx);
    if (gateTick < 0) {
      stall = racer.vx < 60 ? stall + 1 : 0;
      maxStallTicks = Math.max(maxStallTicks, stall);
      if (racer.x >= gate.x) { gateTick = PUSH_TICKS + tick; gateVx = racer.vx; }
    }
    if (racer.loopRide) { loopTick = PUSH_TICKS + tick; break; }
  }
  return { racer, gateX: gate.x, target, gateTick, gateVx, loopTick, maxStallTicks, minVx };
}

test('every loadout reaches the first loop at engagement speed', () => {
  const field = createRacers();
  assert.equal(field.length, 4, 'the legacy field is the acceptance field');
  const runs = field.map((racer) => runFromGrid(DEFAULT_PUSH_SEED, 'ridge', racer.id));
  for (const run of runs) {
    const who = `${run.racer.name} (id ${run.racer.id})`;
    assert.ok(run.gateX > 1180 && run.gateX < 1190, `${who}: first-loop gate at ${run.gateX}`);
    assert.ok(run.gateTick > 0, `${who}: never crossed the gate`);
    assert.ok(run.gateTick <= 600, `${who}: crossed on tick ${run.gateTick}, over the 600-tick budget`);
    assert.ok(run.gateVx >= 700 && run.gateVx <= 1100, `${who}: crossed at ${run.gateVx.toFixed(1)} u/s`);
    assert.ok(run.loopTick > 0, `${who}: never engaged the first loop`);
    assert.ok(run.loopTick >= run.gateTick, `${who}: rode the loop before the gate`);
    // The speed at the gate comes from the hill, not from the shove: the push is a bounded ±2 %
    // nudge around PUSH_BASE_VX·pace (asserted in tests/start-push.test.ts), so a gate speed above
    // it is proof the descent did the work.
    assert.ok(run.gateVx > run.target, `${who}: the descent has to add speed`);
  }
  // The same seed replays identically (no hidden randomness in the start zone).
  const again = runFromGrid(DEFAULT_PUSH_SEED, 'ridge', 2);
  assert.equal(again.gateTick, runs[2].gateTick);
  assert.equal(again.gateVx, runs[2].gateVx);
});

test('no stall on the run-in', () => {
  for (const racer of createRacers()) {
    const run = runFromGrid(DEFAULT_PUSH_SEED, 'ridge', racer.id);
    assert.ok(run.maxStallTicks <= 12,
      `${racer.name} sat under 60 u/s for ${run.maxStallTicks} consecutive ticks`);
    assert.ok(run.minVx > 40, `${racer.name} bottomed out at ${run.minVx.toFixed(1)} u/s`);
  }
  // The pad is flat and the descent is monotone: a racer released with no push at all still rolls
  // down it, which is what makes the push a shove rather than the whole launch.
  const layout = createTrackLayout('ridge', { skipBeforeX: firstLoopGate('ridge').gate.x });
  const world = createSimWorld('ridge', layout, createAirPickups('ridge', layout));
  const racer: Racer = { ...createRacers()[0], x: 420, y: courseY(420, 'ridge') - RADIUS, vx: 120, vy: 0 };
  let runTime = 0;
  const ctx: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: () => 0.5,
    get runTime() { return runTime; }, get wallTime() { return runTime; },
  };
  for (let tick = 0; tick < 120; tick++) { runTime += FIXED_STEP; stepRacer(racer, ctx, FIXED_STEP); }
  assert.ok(racer.vx > 120, `a free ball must gain speed on the hill (got ${racer.vx.toFixed(1)})`);
});

test('post-gate layout fingerprint unchanged (ridge, canyon, stadium)', () => {
  assert.equal(COURSE_COUNT, 3, 'all three authored courses are covered');
  // Pinned against the unmodified generator: every course dresses the descent with the same eleven
  // start-zone pieces (four ramp copies, four boosts, a sign, a blimp, a sheep) and they are the
  // only things removed. The totals are the generator's own counts, so a silent layout change is
  // caught here rather than by a shrug.
  const FULL_COUNTS: Record<CourseId, number> = { ridge: 228, boomtown: 241, sheep: 241 };
  for (const course of COURSES) {
    const full = createTrackLayout(course.id);
    const gate = createQualifyingGate(course.id, full);
    assert.equal(full.length, FULL_COUNTS[course.id], `${course.id}: generated obstacle count`);
    const trimmed = createTrackLayout(course.id, { skipBeforeX: gate.x });
    const removed = full.filter((obstacle) => obstacle.x < gate.x);
    assert.equal(removed.length, 11, `${course.id}: the descent is swept of its eleven pieces`);
    assert.deepEqual([...new Set(removed.map((obstacle) => obstacle.kind))].sort(),
      ['blimp', 'boost', 'ramp', 'sheep', 'sign'], `${course.id}: what the sweep removes`);
    const expected = full.filter((obstacle) => obstacle.x >= gate.x);
    assert.deepEqual(trimmed, expected, `${course.id}: post-gate obstacles must be byte-identical`);
    assert.ok(expected.length > 0, `${course.id}: the post-gate course is not empty`);
    // The prefix really was removed, and nothing at or past the gate moved.
    assert.equal(trimmed.length, full.length - removed.length);
    assert.ok(trimmed.every((obstacle, i) => obstacle.x >= gate.x && (i === 0 || trimmed[i - 1].x <= obstacle.x)), `${course.id}: order and range`);
    // Filtering must not re-roll identities: a kept obstacle is the same object by value.
    for (const obstacle of trimmed) {
      const twin = expected.find((candidate) => candidate.kind === obstacle.kind && candidate.x === obstacle.x && candidate.lane === obstacle.lane);
      assert.ok(twin, `${course.id}: ${obstacle.kind}@${obstacle.x} disappeared`);
      assert.equal(obstacle.hit, twin.hit);
    }
  }
});

test('distance semantics preserved', () => {
  assert.equal(TRACK_DISTANCE, 36000);
  assert.equal(FINISH, 72190);
  assert.equal(engineDistanceFromX(190), 0);
  assert.equal(engineDistanceFromX(190 + 72000), TRACK_DISTANCE);
  // The pad is a real hill: the grid sits START_DROP above the authored road and the run-in rejoins it.
  assert.equal(START_DROP, 240);
  assert.equal(courseY(190), GROUND - START_DROP);
  assert.equal(START_Y, courseY(190) - RADIUS, 'the grid sits on the pad, not inside it');
  assert.equal(START_PAD_END_X, 430);
  assert.equal(courseY(430), GROUND - START_DROP, 'the pad is flat');
  assert.ok(Math.abs(courseY(1060) - GROUND) < 0.05, `descent rejoins the road at ${courseY(1060)}`);
  assert.equal(courseY(1370), GROUND, 'and the run-in is exactly the authored line');
  // The authored profiles are untouched — nothing outside the elevation table moved.
  for (const course of COURSES) {
    const profile = TRACKS[course.id].profile;
    assert.equal(profile[0][0], 0);
    assert.equal(profile[0][1], 0);
    assert.equal(profile[1][0], 1400);
    assert.equal(profile[1][1], 0, `${course.id}: the authored opening stays flat`);
    assert.equal(courseY(START_X, course.id), GROUND - START_DROP, `${course.id}: every course gets the pad`);
  }
  // Sanity: the loop the acceptance run engages really is the first one on the course.
  const firstLoop = createTrackLayout('ridge').find((obstacle) => obstacle.kind === 'loop')!;
  assert.equal(loopGeometry(firstLoop, 'ridge').x, 1370);
});
