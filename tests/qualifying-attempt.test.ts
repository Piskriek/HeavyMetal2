/**
 * T04 — one isolated attempt: what it owns, what it cannot touch, and how it ends.
 *
 * The isolation criteria are asserted as observations rather than as code review. The same
 * participant must produce the same run whether the field holds one racer or twenty (nobody can bump
 * them, feed them a supply or lean on their AI), a broken bridge or an exploded barrel must exist
 * only inside the attempt that caused it, and the RNG must be the attempt's own. Recovery is the
 * progress-anchored one, decided before the falling branch's early return, and the attempt has to be
 * able to end on the deadline or the recovery budget.
 *
 * Run with: node scripts/check.mjs  ·  node --import tsx --test tests/qualifying-attempt.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseSetup, gapAcrossTrack, loopLayout, makeParticipant, manualGate, runAttempt, stagedFor,
} from './fixtures/qualifying-harness';
import { ATTEMPT_MAX_RECOVERIES, ATTEMPT_STEP, QualifyingAttempt, type AttemptConfig } from '../src/game/qualifying/attempt';
import { createSimWorld } from '../src/game/sim/world';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, PROGRESS_RECOVERY } from '../src/game/sim/context';
import { bestProgressX, createStepTrace, resetTrace, stepRacer } from '../src/game/sim/racer-physics';
import { attemptSeed, createAttemptRacer, humanAim, launchAngleOffset, launchVelocityFor } from '../src/game/qualifying/field';
import { createQualifyingGate } from '../src/game/qualifying/gate';
import { createTrackLayout } from '../src/game/track-layout';
import { RADIUS, START_X, courseY, laneZ, loopGeometry, type Obstacle } from '../src/game/scene';
import { FIXED_STEP } from '../src/game/contracts/timing';

function buildAttempt(overrides: Partial<AttemptConfig> & { participant: AttemptConfig['participant'] }): QualifyingAttempt {
  const setup = courseSetup('ridge');
  const config: AttemptConfig = {
    fieldSize: 4,
    course: 'ridge',
    gate: setup.gate,
    layout: setup.layout,
    pickups: setup.pickups,
    attempt: 1,
    seed: 7,
    control: 'cpu',
    difficulty: 'racer',
    deadlineSeconds: 20,
    staged: stagedFor(overrides.participant),
    ...overrides,
  };
  return new QualifyingAttempt(config);
}

function runTo(attempt: QualifyingAttempt, maxTicks = 3000): void {
  let tick = 0;
  while (!attempt.complete && tick < maxTicks) { attempt.step(); tick++; }
}

/** Drives `stepRacer` alone, with an explicit recovery policy, so both policies can be compared. */
function stepWithPolicy(obstacles: readonly Obstacle[], recovery: typeof PROGRESS_RECOVERY, ticks = 400) {
  const world = createSimWorld('ridge', obstacles, []);
  const racer = createAttemptRacer(makeParticipant(0));
  Object.assign(racer, { x: 640, y: courseY(640, 'ridge') - RADIUS, vx: 700, vy: 0, grounded: true, lane: 2, targetLane: 2, z: laneZ(2) });
  let runTime = 0;
  const trace = createStepTrace();
  let recoveredAt = -1;
  let fellAt = -1;
  let depthAtRecovery = 0;
  let deepest = 0;
  for (let tick = 0; tick < ticks; tick++) {
    runTime += FIXED_STEP;
    resetTrace(trace);
    stepRacer(racer, {
      world,
      fx: HEADLESS_SIM_FX,
      recovery,
      random: () => 0.5,
      get runTime() { return runTime; },
      get wallTime() { return runTime; },
    }, FIXED_STEP, trace);
    if (trace.fell && fellAt < 0) fellAt = tick;
    // Depth is read at the end of the step, but a recovery has already put the racer back on the
    // surface, so the fall's own depth is tracked tick by tick.
    if (!racer.falling && recoveredAt < 0) deepest = Math.max(deepest, 0);
    else deepest = Math.max(deepest, racer.y - courseY(racer.x, 'ridge'));
    if (trace.recovered && recoveredAt < 0) {
      recoveredAt = tick;
      depthAtRecovery = deepest;
      break;
    }
  }
  return { racer, fellAt, recoveredAt, depthAtRecovery };
}

test('attempt: a CPU run reaches the gate and records a valid sub-tick time', () => {
  const { outcome, ticks } = runAttempt({ control: 'cpu', autoLaunch: { power: 0.9, angle: 30 } });
  assert.equal(outcome.classification, 'valid');
  assert.equal(outcome.entry.status, 'valid');
  assert.equal(outcome.entry.fallback, null);
  assert.ok(outcome.crossing, 'the crossing record exists');
  const crossing = outcome.crossing!;
  assert.ok(crossing.time > 0.2 && crossing.time < 5, `time ${crossing.time} is a sane gate time`);
  assert.ok(Math.abs(crossing.time - (crossing.tick + crossing.fraction) * ATTEMPT_STEP) < 1e-12, 'time is (tick + fraction) × step');
  assert.ok(crossing.fraction >= 0 && crossing.fraction <= 1);
  assert.equal(outcome.entry.time, crossing.time);
  assert.equal(outcome.entry.speed, crossing.speed);
  assert.equal(outcome.entry.attempt, 1);
  assert.ok(outcome.peakSpeed >= crossing.speed - 1e-9, 'the attempt peak is at least the gate speed');
  assert.equal(outcome.recoveries, 0, 'a clean run never needs the crew');
  assert.deepEqual(outcome.rejections, [], 'a clean run is never rejected');
  assert.equal(outcome.reachedFinish, false, 'the gate ends the run long before the finish line');
  assert.ok(ticks > 0);
});

test('attempt: the same participant runs identically in a field of one and of twenty', () => {
  // The strongest statement available that hidden bots cannot bump the human, steal a supply or
  // influence a decision: the run cannot tell that they exist, because in this attempt they do not.
  const alone = runAttempt({ fieldSize: 1, autoLaunch: { power: 0.95, angle: 33 } });
  const crowd = runAttempt({ fieldSize: 20, autoLaunch: { power: 0.95, angle: 33 } });
  assert.deepEqual(crowd.outcome, alone.outcome);
  assert.deepEqual(crowd.attempt.events, alone.attempt.events);
});

test('attempt: the shared layout is never mutated, and every clone starts clean', () => {
  const setup = courseSetup('ridge');
  const obstacles: Obstacle[] = loopLayout(1370, 2, [
    { kind: 'break_bridge', x: 700, width: 320, height: 40, lane: -1, laneSpan: 4, hit: false, hitAt: -100, hitMask: 0, broken: false, health: 1 },
    { kind: 'tnt', x: 900, width: 65, height: 70, lane: 2, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0 },
  ]);
  const template = [...obstacles];
  const templateState = JSON.stringify(template.map((o) => [o.kind, o.x, o.hit, o.hitAt, o.broken ?? false, o.hitMask ?? 0]));
  const fresh = buildAttempt({ participant: makeParticipant(0), layout: template, gate: manualGate({ x: 1500 }) });
  assert.deepEqual(
    fresh.renderView().obstacles.map((o) => [o.kind, o.x, o.hit, o.hitAt, o.broken ?? false]),
    template.map((o) => [o.kind, o.x, false, -100, o.broken ?? false]),
    'a new attempt sees every obstacle intact',
  );
  // Run it hard enough to break something, then check the template and a second clone.
  const run = runAttempt({ setup: { ...setup, layout: template }, gate: manualGate({ x: 1500 }), autoLaunch: { power: 1, angle: 20 } });
  const damaged = run.attempt.renderView().obstacles.filter((o) => o.hit || o.broken === true);
  assert.ok(damaged.length > 0, 'the scenario must actually damage something');
  assert.equal(JSON.stringify(template.map((o) => [o.kind, o.x, o.hit, o.hitAt, o.broken ?? false, o.hitMask ?? 0])), templateState, 'the shared layout is untouched');
  const second = buildAttempt({ participant: makeParticipant(1), layout: template, gate: manualGate({ x: 1500 }) });
  assert.equal(second.renderView().obstacles.filter((o) => o.hit || o.broken === true).length, 0, 'a rival cannot pre-break the bridge for the next attempt');
  assert.equal(second.renderView().pickups.every((p) => p.collectedBy === null), true, 'and cannot pre-take a supply');
});

test('attempt: supplies are claimed once, in the attempt that touched them, with a swept fraction', () => {
  const setup = courseSetup('ridge');
  const a = runAttempt({ setup, autoLaunch: { power: 0.9, angle: 30 } });
  const b = runAttempt({ setup, autoLaunch: { power: 0.9, angle: 30 } });
  assert.ok(a.outcome.pickups.length > 0 || a.attempt.snapshot().pickups === 0);
  assert.deepEqual(b.outcome.pickups, a.outcome.pickups, 'the same seeded run collects the same supplies');
  for (const claim of a.outcome.pickups) {
    assert.ok(['fuel', 'shield', 'bounce'].includes(claim.kind), `stored effect ${claim.kind} is a gameplay effect`);
    assert.equal(claim.fromMystery, false, 'a plain supply is not a mystery');
    assert.ok(claim.crossingFraction >= 0 && claim.crossingFraction <= 1, 'the claim records its swept fraction');
    assert.equal(a.attempt.renderView().pickups.find((p) => `supply:${p.id}` === claim.pickupId)?.collectedBy, a.attempt.racer.id);
  }
});

test('attempt: falling recovery is anchored to progress and decided before the early return', () => {
  const policy = PROGRESS_RECOVERY;
  assert.equal(policy.fallDepth, 360, 'depth ends the fall in an attempt');
  assert.equal(policy.lavaDepth, 260, 'so does the lava lake');
  assert.equal(LEGACY_RECOVERY.fallDepth, null, 'the race keeps the timer-only behaviour');
  assert.equal(LEGACY_RECOVERY.lavaDepth, null);
  assert.equal(policy.respawnX({ racer: createAttemptRacer(makeParticipant(0)), x: 9999, bestX: 2000, reason: 'depth', recoveries: 0 }), 1960);
  assert.equal(LEGACY_RECOVERY.respawnX({ racer: createAttemptRacer(makeParticipant(0)), x: 9999, bestX: 2000, reason: 'depth', recoveries: 0 }), 9799);
  assert.ok(bestProgressX({ ...createAttemptRacer(makeParticipant(0)), distance: 100 }) === START_X + 200, 'progress is measured from the last grounded step');
});

test('attempt: the depth rule ends a fall earlier than the timer does', () => {
  const obstacles = gapAcrossTrack(700, 900);
  const progress = stepWithPolicy(obstacles, PROGRESS_RECOVERY);
  const legacy = stepWithPolicy(obstacles, LEGACY_RECOVERY);
  assert.ok(progress.fellAt >= 0 && legacy.fellAt >= 0, 'both hosts must fall into the gap');
  assert.equal(progress.fellAt, legacy.fellAt, 'the fall starts on the same tick');
  assert.ok(progress.recoveredAt >= 0 && legacy.recoveredAt >= 0, 'both recover');
  assert.ok(progress.recoveredAt < legacy.recoveredAt, `depth must end the fall earlier (${progress.recoveredAt} < ${legacy.recoveredAt})`);
  assert.ok(legacy.recoveredAt >= Math.floor(0.72 / FIXED_STEP) - 1, 'the legacy fall still runs its full 0.72 s timer');
  assert.ok(legacy.depthAtRecovery > progress.depthAtRecovery, 'and so it sinks further before the crew arrives');
});

test('attempt: a crash-out is classified dnf once the recovery budget is gone', () => {
  const setup = courseSetup('ridge');
  const run = runAttempt({
    // A wide gap the launch drops them straight into: the crew fishes them out, they roll in again,
    // and when the recovery budget is gone the attempt is over as a crash-out rather than a time.
    setup: { ...setup, layout: gapAcrossTrack(300, 4000) },
    gate: manualGate({ x: 6000 }),
    deadlineSeconds: 30,
    maxRecoveries: 2,
    autoLaunch: { power: 0.9, angle: 30 },
    maxTicks: 4000,
  });
  assert.equal(run.outcome.classification, 'dnf');
  assert.equal(run.outcome.entry.status, 'fallback');
  assert.equal(run.outcome.entry.fallback, 'dnf');
  assert.equal(run.outcome.entry.time, null, 'a fallback has no time');
  assert.equal(run.outcome.entry.speed, 0, 'a fallback borrows no gate speed');
  assert.equal(run.outcome.recoveries, 2);
  assert.ok(run.outcome.peakSpeed > 0, 'the attempt still records what it saw');
  assert.equal(ATTEMPT_MAX_RECOVERIES, 3, 'the default budget is three');
});

test('attempt: the fixed deadline ends a run that never reaches the plane', () => {
  const run = runAttempt({
    gate: manualGate({ x: 60_000, segment: 'mine' }),
    deadlineSeconds: 1,
    autoLaunch: { power: 0.2, angle: 12 },
  });
  assert.equal(run.outcome.classification, 'deadline');
  assert.equal(run.outcome.entry.fallback, 'deadline');
  assert.ok(Math.abs(run.outcome.elapsed - 1) < ATTEMPT_STEP * 1.5, 'the clock starts at launch, not at staging');
});

test('attempt: a rejected crossing is remembered but does not end the run', () => {
  const setup = courseSetup('ridge');
  // One lane over the gate, then steering: the first pass must be refused by name, and the fix is
  // allowed to happen inside the same attempt.
  const attempt = buildAttempt({ participant: makeParticipant(0, { homeLane: 1 }), gate: setup.gate, control: 'human' });
  attempt.launch({ power: 0.9, angle: 30 });
  let sawRejection = false;
  let crossedAfterRejection = false;
  for (let tick = 0; tick < 2500 && !attempt.complete; tick++) {
    attempt.step();
    if (attempt.events.some((event) => event.type === 'attempt-rejected')) {
      sawRejection = true;
      if (tick % 12 === 0) attempt.send({ type: 'steer', direction: 1 });
    }
    if (attempt.complete && attempt.outcome.classification === 'valid') crossedAfterRejection = true;
  }
  assert.ok(sawRejection, 'the first pass must be rejected');
  const rejected = attempt.events.filter((event) => event.type === 'attempt-rejected');
  assert.ok(rejected.length > 0);
  assert.equal(rejected[0].type === 'attempt-rejected' && rejected[0].reason === 'wrong-lane', true, 'the first refusal is the lane, not something else');
  assert.equal(rejected.every((event) => event.type === 'attempt-rejected' && ['wrong-lane', 'reverse', 'above-gate', 'wrong-segment'].includes(event.reason)), true,
    'every refusal carries one of the named reasons');
  assert.equal(attempt.complete, true, 'and the attempt still ends on its own terms');
  assert.equal(attempt.outcome.rejections.length, rejected.length, 'the outcome keeps every rejection');
  assert.equal(attempt.outcome.classification, crossedAfterRejection ? 'valid' : 'invalid-crossing');
  if (crossedAfterRejection) assert.ok(attempt.outcome.crossing!.time! > 0);
});

test('attempt: the RNG is the attempt\'s own stream, reproducible and consequential', () => {
  const spinner: Obstacle[] = [{ kind: 'pinball_spinner', x: 900, width: 90, height: 90, lane: 2, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0, spinAngle: 0 }];
  const setup = courseSetup('ridge');
  const layout = [...spinner, ...loopLayout(1370, 2)];
  const a = runAttempt({ setup: { ...setup, layout }, seed: 11, gate: manualGate({ x: 20_000 }), deadlineSeconds: 6 });
  const b = runAttempt({ setup: { ...setup, layout }, seed: 11, gate: manualGate({ x: 20_000 }), deadlineSeconds: 6 });
  assert.deepEqual(b.outcome, a.outcome, 'the same seed replays identically');
  // The spinner's kick is the one gameplay coin-flip in the step: the stream has to reach it.
  const kick = (random: () => number) => {
    const world = createSimWorld('ridge', spinner, []);
    const racer = createAttemptRacer(makeParticipant(0));
    Object.assign(racer, { x: 900, y: courseY(900, 'ridge') - RADIUS - 20, vx: 600, vy: 0, grounded: false, lane: 2, targetLane: 2, z: laneZ(2) });
    let runTime = 0;
    for (let tick = 0; tick < 6; tick++) {
      runTime += FIXED_STEP;
      stepRacer(racer, { world, fx: HEADLESS_SIM_FX, recovery: PROGRESS_RECOVERY, random, get runTime() { return runTime; }, get wallTime() { return runTime; } }, FIXED_STEP);
    }
    return Math.sign(racer.vz);
  };
  assert.ok(kick(() => 0.9) !== kick(() => 0.1), 'the kick direction comes from the stream');
  assert.notEqual(attemptSeed(3, 0, 1), attemptSeed(3, 0, 2), 'the attempt number participates');
  assert.notEqual(attemptSeed(3, 1, 1), attemptSeed(3, 2, 1), 'so does the racer identity');
  assert.equal(attemptSeed(3, 1, 1), attemptSeed(3, 1, 1), 'and it is stable');
});

test('attempt: launch geometry is the race formula, with a bounded fan for big fields', () => {
  assert.equal(launchAngleOffset(0, 0, 4), 0, 'the local player never gets an offset');
  assert.equal(launchAngleOffset(3, 3, 4), 1.2, 'four racers keep the legacy fan');
  assert.equal(launchAngleOffset(1, 1, 4), -1.2);
  const offsets = Array.from({ length: 20 }, (_, slot) => launchAngleOffset(slot + 1, slot, 20));
  assert.ok(offsets.every((offset) => Math.abs(offset) <= 12), 'a 20-racer fan stays inside ±12°');
  assert.equal(new Set(offsets.map((offset) => offset.toFixed(3))).size, 20, 'and nobody shares a launch angle');
  assert.ok(offsets.every((offset, index) => index === 0 || offset >= offsets[index - 1]), 'monotone in slot');
  const racer = createAttemptRacer(makeParticipant(0));
  const raw = racer.launchSpeed / 0.16;
  const velocity = launchVelocityFor(racer, humanAim(1, 12), 0);
  assert.ok(Math.abs(velocity.vx - raw * Math.cos(12 * Math.PI / 180)) < 1e-9, 'full power at the minimum angle is the raw launch speed');
  assert.ok(Math.abs(velocity.vy + raw * Math.sin(12 * Math.PI / 180)) < 1e-9, 'and the angle lifts it, in engine space where down is positive');
  const lowPower = launchVelocityFor(racer, humanAim(0.18, 68), 0);
  assert.ok(Math.abs(lowPower.vx - (racer.launchSpeed / 0.16) * (0.45 + 0.18 * 0.55) * Math.cos(68 * Math.PI / 180)) < 1e-9, 'the same curve as the race');
  assert.deepEqual(humanAim(9, -40), { power: 1, angle: 12 }, 'input is clamped to the launch envelope');
});

test('attempt: input is validated, applied on the tick, and refused once the run is over', () => {
  const attempt = buildAttempt({ participant: makeParticipant(0), control: 'human' });
  assert.deepEqual(attempt.launchAim, { power: 0.8, angle: 36 }, 'the sling starts on the race defaults');
  assert.equal(attempt.send({ type: 'aim', power: 0.55, angle: 40 }).ok, true);
  assert.deepEqual(attempt.launchAim, { power: 0.8, angle: 36 }, 'input lands on the tick, not on the send');
  attempt.step();
  assert.deepEqual(attempt.launchAim, { power: 0.55, angle: 40 });
  const bad = attempt.send({ type: 'aim', power: 2, angle: 40 });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.code, 'E_COMMAND');
  assert.equal(attempt.send({ type: 'launch' }).ok, true);
  assert.equal(attempt.phase, 'awaiting-launch', 'the launch is applied on the next step, not on the send');
  attempt.step();
  assert.equal(attempt.phase, 'running');
  assert.deepEqual(attempt.launchAim, { power: 0.55, angle: 40 }, 'the queued aim is the one that launched it');
  assert.equal(attempt.send({ type: 'aim', power: 0.9, angle: 20 }).ok, false, 'aiming is a grid action');
  // Steering is the base verb of an attempt, so the T01 gate has to allow it while airborne.
  assert.equal(attempt.send({ type: 'steer', direction: -1 }).ok, true, 'mid-attempt steering is legal (PR #48\'s gate correction)');
  attempt.step();
  assert.equal(attempt.racer.targetLane, 1, 'and it moved the target lane one step');
  assert.equal(attempt.send({ type: 'steer', direction: 0 as -1 }).ok, false, 'a direction outside ±1 is refused');
  runTo(attempt);
  assert.equal(attempt.complete, true);
  assert.equal(attempt.send({ type: 'boost' }).ok, false, 'a finished attempt refuses input');
  assert.ok(attempt.events.filter((event) => event.type === 'command-rejected').length >= 2);
});

test('attempt: a retry starts from the staged record, keeping the aim and dropping the benefits', () => {
  const setup = courseSetup('ridge');
  const participant = makeParticipant(0);
  const staged = stagedFor(participant);
  const first = buildAttempt({ participant, control: 'human', staged, deadlineSeconds: 2, layout: setup.layout, pickups: setup.pickups, gate: setup.gate });
  first.launch({ power: 0.9, angle: 30 });
  first.send({ type: 'boost' });
  first.step();
  assert.equal(first.snapshot().boosts, 1, 'the boost was spent');
  runTo(first);
  const second = new QualifyingAttempt({
    participant, fieldSize: 4, course: 'ridge', gate: setup.gate, layout: setup.layout, pickups: setup.pickups,
    attempt: 2, seed: 5, control: 'human', difficulty: 'racer', deadlineSeconds: 2, staged, aim: first.launchAim,
  });
  assert.equal(second.snapshot().boosts, 2, 'the retry starts from the staged record, not the failed run');
  assert.equal(second.snapshot().bounces, 3);
  assert.equal(second.snapshot().runTime, 0, 'and on its own clock');
  assert.deepEqual(second.launchAim, first.launchAim, 'but the sling keeps the aim');
  assert.equal(second.snapshot().pickups, 0, 'a collected supply does not carry over');
  assert.equal(second.racer.visited.size, 0, 'nor does the memory of what was already hit');
});

test('attempt: the trace exposes the canonical capture point, before the loop floors the speed', () => {
  const loop: Obstacle = { kind: 'loop', x: 1500, width: 375, height: 322, lane: 2, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0 };
  const obstacles = loopLayout(1500, 2);
  const world = createSimWorld('ridge', obstacles, []);
  const geometry = loopGeometry(loop, 'ridge');
  const racer = createAttemptRacer(makeParticipant(0));
  const startX = loop.x - (geometry.radius + RADIUS) - 6;
  Object.assign(racer, { x: startX, y: courseY(startX, 'ridge') - RADIUS, vx: 620, vy: 0, grounded: true, lane: 2, targetLane: 2, z: laneZ(2) });
  let runTime = 0;
  const trace = createStepTrace();
  let engaged: { preVx: number; rideSpeed: number; preX: number } | null = null;
  for (let tick = 0; tick < 40; tick++) {
    runTime += FIXED_STEP;
    resetTrace(trace);
    stepRacer(racer, {
      world, fx: HEADLESS_SIM_FX, recovery: PROGRESS_RECOVERY, random: () => 0.5,
      get runTime() { return runTime; }, get wallTime() { return runTime; },
    }, FIXED_STEP, trace);
    if (trace.loopEngaged && !engaged) engaged = { preVx: trace.preObstacleVx, rideSpeed: racer.loopRide?.speed ?? -1, preX: trace.preObstacleX };
  }
  assert.ok(engaged, 'the racer must enter the loop within the scan');
  const capture = engaged!;
  assert.ok(capture.preVx < 650, `the approach speed is below the ride floor (${capture.preVx})`);
  assert.equal(capture.rideSpeed, 650, 'the ride floors the speed the moment it engages');
  assert.ok(capture.preVx < capture.rideSpeed, 'so the capture point is strictly before the boost');
  assert.ok(Math.abs(capture.preX - startX) > 1, 'the trace reports the integrated position, not the pre-step one');
});

test('attempt: the clock is the contract clock, in whole steps', () => {
  assert.equal(ATTEMPT_STEP, FIXED_STEP);
  assert.equal(FIXED_STEP, 1 / 120);
  const run = runAttempt({ autoLaunch: { power: 0.9, angle: 30 } });
  assert.ok(Number.isInteger(run.outcome.ticks));
  assert.ok(Math.abs(run.outcome.elapsed / ATTEMPT_STEP - Math.round(run.outcome.elapsed / ATTEMPT_STEP)) < 1e-9, 'elapsed is a whole number of steps');
});

test('attempt: the gate follows the lowest loop however the layout is ordered', () => {
  const layout = createTrackLayout('boomtown');
  const forward = createQualifyingGate('boomtown', layout);
  const backward = createQualifyingGate('boomtown', [...layout].reverse());
  assert.equal(forward.x, backward.x);
  assert.equal(forward.loopLane, 3, 'Boomtown parks its first loop in lane 3');
  assert.equal(forward.z, laneZ(3));
});
