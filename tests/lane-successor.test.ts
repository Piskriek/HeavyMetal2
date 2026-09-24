/**
 * M01 · T6 (the merge law) — **the authored lanes are drivable end to end.**
 *
 * `successorPath` was written, documented and tested in T6, and then never called by anything: a racer
 * who crossed the end of their own path silently fell back to the legacy lane corridor, so the
 * authored road stopped existing mid-course — the four lanes never merged, and the fork never opened.
 * `advancePaths` (called from `stepRacer`) is the missing line, and this suite is its evidence:
 *
 *  - the rule, unit by unit: past the end of a merge it takes the successor; past a split it takes the
 *    branch on the racer's own side; past an out-of-bounds end or the flag it **leaves the racer alone**
 *    (that is what lets the OOB recovery fire on the path that owns the trigger);
 *  - the law, on a real run: the shipping physics, the goblin push, and the sample network — with the
 *    invariant that **no racer is ever stranded off their own path while a successor exists**, that
 *    every racer who reaches the fork is on a path that is active at their x, and that the field really
 *    does end up on the spine rather than on the lane it started in.
 *
 * Run with `node --import tsx --test tests/lane-successor.test.ts` (registered in scripts/check.mjs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advancePaths, sampleLane, sampleLaneNetwork, successorPath, type LaneNetwork, type PathBearer,
} from '../src/game/lane-network';
import { createRacers } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { stepRacer } from '../src/game/sim/racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { createTrackLayout } from '../src/game/track-layout';
import { createAirPickups } from '../src/game/powerups';
import { RADIUS } from '../src/game/scene';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { DEFAULT_PUSH_SEED, PUSH_TICKS, applyPushTick, startPushVelocity } from '../src/game/sim/start-push';

const bear = (pathId: string | null, x: number, z: number, finished = false): PathBearer =>
  ({ pathId, x, z, finished });

test('past the end of a merge, the successor is taken', () => {
  const network = sampleLaneNetwork('ridge');
  // `ridge-lane-1` ends at the `loop` node (x 36000), and `ridge-spine` begins there.
  const rider = bear('ridge-lane-1', 36_010, 120);
  assert.equal(sampleLane(network, rider.pathId!, rider.x), null, 'the rider is genuinely past their path');
  assert.equal(successorPath(network, 'ridge-lane-1', rider.z, 0), 'ridge-spine', 'the loop node is a merge');

  assert.equal(advancePaths([rider], network), 1, 'one rider advanced');
  assert.equal(rider.pathId, 'ridge-spine');
  assert.ok(sampleLane(network, rider.pathId!, rider.x), 'and the new path is active where they are');
});

test('past a split, the branch on the racer\'s own side is taken', () => {
  const network = sampleLaneNetwork('ridge');
  // The spine forks at x 64000: `ridge-main` carries on to the flag, `ridge-spur` ends out of bounds.
  const left = bear('ridge-spine', 64_010, -600);
  const right = bear('ridge-spine', 64_010, 480);
  assert.equal(successorPath(network, 'ridge-spine', left.z, 1), 'ridge-main', '+1 is the smaller-z branch');
  assert.equal(successorPath(network, 'ridge-spine', right.z, -1), 'ridge-spur', 'and -1 the larger-z one');

  assert.equal(advancePaths([left, right], network), 2);
  assert.equal(left.pathId, 'ridge-main', 'a rider on the small-z flank is not yanked across the fork');
  assert.equal(right.pathId, 'ridge-spur');
});

test('an out-of-bounds end, and the flag, leave the racer exactly where they are', () => {
  const network = sampleLaneNetwork('ridge');
  // `ridge-spur` ends at an oob node: the racer must stay *on* it, because that node is the trigger the
  // recovery fires on (`oobCrossed` needs the path) and there is no route through a dead end anyway.
  const dead = bear('ridge-spur', 68_010, 360);
  assert.equal(successorPath(network, 'ridge-spur', dead.z, 0), null);
  assert.equal(advancePaths([dead], network), 0, 'no successor, no change');
  assert.equal(dead.pathId, 'ridge-spur', 'still on the path that owns the OOB trigger');

  // Past the flag: the run is over, and the network has nothing more to say.
  const done = bear('ridge-main', 72_200, -120);
  assert.equal(advancePaths([done], network), 0);
  assert.equal(done.pathId, 'ridge-main');

  // A finished racer is never touched, whatever else is true of them.
  const finished = bear('ridge-lane-1', 36_010, 120, true);
  assert.equal(advancePaths([finished], network), 0);
  assert.equal(finished.pathId, 'ridge-lane-1');
});

test('a racer still on their own path, an unknown path, and no network are all left alone', () => {
  const network = sampleLaneNetwork('ridge');
  const riding = bear('ridge-lane-2', 9_000, -120);
  assert.ok(sampleLane(network, riding.pathId!, riding.x));
  assert.equal(advancePaths([riding], network), 0, 'nothing to do while the road is under them');

  const ghost = bear('no-such-path', 36_010, 120);
  assert.equal(advancePaths([ghost], network), 0, 'an unknown path is not guessed at');
  assert.equal(ghost.pathId, 'no-such-path');

  const legacy = bear(null, 36_010, 120);
  assert.equal(advancePaths([legacy], null), 0, 'no network, no network business');
  assert.equal(advancePaths([bear('ridge-lane-1', 36_010, 120)], null), 0);
});

/* ---------------------------------------------------------------------------
   The law, on a real run.
   ---------------------------------------------------------------------------
   The same shape the other headless suites use: the goblin push verbatim, then `stepRacer` with the
   shipping physics and the sample network in the context. The engine's own `adoptPaths` is mirrored
   between ticks, because a racer the crew puts back — or one whose path was cleared — is the engine's
   to re-place and not the network's.
   ------------------------------------------------------------------------- */

interface RunReport {
  ticks: number;
  /** Racers whose pathId ever differed from the path they started the run on. */
  changedPath: number;
  /** Racer positions past the fork (x > 64000), with the path each was riding at that moment. */
  pastFork: { id: number; x: number; pathId: string | null }[];
  /**
   * A racer seen **off their own path with nowhere to go**: no sample here *and* no successor. That is
   * the only genuinely stranded state, and it must never happen.
   */
  stranded: { id: number; x: number; pathId: string | null }[];
  /**
   * A racer seen off their own path *with* a successor waiting. That is the legal one-tick lag between
   * crossing a junction and `stepRacer`'s advance at the top of the next tick — bounded by the racers
   * times the junctions, and unbounded only if the advance ever stops happening.
   */
  lagTicks: number;
  /** How far each racer got. */
  furthest: number[];
  /** Path ids ever ridden, for the "the merge was really taken" claim. */
  pathsSeen: Set<string>;
  /** The paths each racer rode, in order — the chain the network handed them down. */
  history: Map<number, string[]>;
}

function runNetwork(seed: number, ticks = 9_000): RunReport {
  const network = sampleLaneNetwork('ridge');
  const layout = createTrackLayout('ridge');
  const world = createSimWorld('ridge', layout, createAirPickups('ridge', layout));
  const racers = createRacers();
  let runTime = 0;
  const ctx: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: () => 0.5,
    get runTime() { return runTime; }, get wallTime() { return runTime; },
    laneNetwork: network,
  };

  // The goblin push, verbatim from `GameEngine.stepPush` (the shape tests/merge-race.test.ts uses).
  const targets = racers.map((racer) => startPushVelocity(racer.pace, seed, racer.id));
  for (let k = 1; k <= PUSH_TICKS; k++) {
    runTime += FIXED_STEP;
    for (let index = 0; index < racers.length; index++) {
      const racer = racers[index];
      applyPushTick(racer, k, targets[index]);
      racer.x += racer.vx * FIXED_STEP;
      racer.y = world.y(racer.x) - RADIUS;
      racer.rotation += racer.vx * FIXED_STEP / RADIUS;
    }
  }

  // The grid is inside the sample network's own first path, so the field starts on it — as the engine
  // does it when a race begins with an authored document (`assignPaths`).
  for (const racer of racers) {
    racer.pathId = 'ridge-start';
  }

  const initial = new Map(racers.map((racer) => [racer.id, racer.pathId]));
  const report: RunReport = {
    ticks: 0, changedPath: 0, pastFork: [], stranded: [], lagTicks: 0,
    furthest: racers.map(() => 0), pathsSeen: new Set(), history: new Map(),
  };
  for (const racer of racers) report.history.set(racer.id, [racer.pathId!]);

  for (let tick = 0; tick < ticks; tick++) {
    runTime += FIXED_STEP;
    report.ticks++;
    for (const racer of racers) {
      if (racer.finished) continue;
      stepRacer(racer, ctx, FIXED_STEP);
      // Mirrors `GameEngine.adoptPaths`: an unassigned racer takes the nearest path at this x.
      if (racer.pathId === null) {
        for (const path of network.paths) {
          const sample = sampleLane(network, path.id, racer.x);
          if (!sample) continue;
          racer.pathId = path.id;
          break;
        }
      }
    }
    for (const racer of racers) {
      // The sim finishes a racer at the flag and parks them past it (`x = FINISH + 12`); the network's
      // business ends there too, which is why `advancePaths` and this check both skip the finished.
      if (racer.finished) continue;
      const history = report.history.get(racer.id)!;
      if (racer.pathId && history[history.length - 1] !== racer.pathId) history.push(racer.pathId);
      if (racer.pathId) report.pathsSeen.add(racer.pathId);
      report.furthest[racer.id] = Math.max(report.furthest[racer.id], racer.x);
      if (racer.x > 64_000 && racer.pathId) {
        report.pastFork.push({ id: racer.id, x: racer.x, pathId: racer.pathId });
      }
      // The invariant: off your own path is legal only when the network has somewhere to send you —
      // and then only for the tick before `stepRacer` hands you over.
      if (racer.pathId && !sampleLane(network, racer.pathId, racer.x)) {
        const successor = successorPath(network, racer.pathId, racer.z, 0);
        if (successor) report.lagTicks += 1;
        else report.stranded.push({ id: racer.id, x: racer.x, pathId: racer.pathId });
      }
      if (racer.pathId !== initial.get(racer.id)) report.changedPath = Math.max(report.changedPath, 1);
    }
  }
  return report;
}

test('the law, on a real run: the field rides the authored network down to the flag', () => {
  const report = runNetwork(DEFAULT_PUSH_SEED);
  assert.equal(report.stranded.length, 0,
    `off their path with no successor: ${JSON.stringify(report.stranded.slice(0, 4))}`);

  // The field really did leave the lanes: the spine, the fork's branches and the flag's path are all
  // things a racer was riding at some point in the run.
  assert.ok(report.pathsSeen.has('ridge-spine'), `the four lanes merge into the spine (saw ${[...report.pathsSeen].join(', ')})`);
  assert.ok(report.pathsSeen.has('ridge-main') || report.pathsSeen.has('ridge-spur'),
    'and the spine reaches the branches of the fork');
  assert.equal(report.changedPath, 1, 'at least one racer rode a path they did not start on');

  // The chain, in order, for a racer who went the whole way: start → a lane → the spine → a branch.
  const full = [...report.history.values()].find((history) => history[history.length - 1] === 'ridge-main');
  assert.ok(full, `somebody rode the whole network (${[...report.history.values()].map((h) => h.join('→')).join(' | ')})`);
  assert.equal(full![0], 'ridge-start', 'the grid path');
  assert.match(full![1], /^ridge-lane-\d$/, 'then their lane');
  assert.deepEqual(full!.slice(2), ['ridge-spine', 'ridge-main'], 'then the spine, then the flag');

  // Everyone who reached the fork was on a live path there, and the field got down the hill.
  assert.ok(report.pastFork.length > 0, 'the field reached the fork');
  for (const rider of report.pastFork) {
    assert.ok(['ridge-main', 'ridge-spur', 'ridge-spine'].includes(rider.pathId!),
      `x ${Math.round(rider.x)} on ${rider.pathId}`);
  }
  const furthest = Math.max(...report.furthest);
  assert.ok(furthest > 70_000, `the run reaches the flag (furthest x ${Math.round(furthest)})`);

  // The legal lag is *bounded*: four racers crossing three junctions (the split, the loop's mouth, the
  // fork) can be one tick behind the network at most. If the advance ever stopped happening, this is
  // the number that would run away — and the stranded list would fill up instead.
  assert.ok(report.lagTicks <= 12,
    `one tick at each of the three junctions for four racers (saw ${report.lagTicks})`);
});

test('the same run with no network still works, and is the legacy behaviour', () => {
  // A control, in this suite's own terms: with `laneNetwork` absent from the context the sim must be
  // exactly as it was — this is the parity guarantee the whole integration rests on.
  const layout = createTrackLayout('ridge');
  const world = createSimWorld('ridge', layout, createAirPickups('ridge', layout));
  const racers = createRacers();
  let runTime = 0;
  const ctx: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: () => 0.5,
    get runTime() { return runTime; }, get wallTime() { return runTime; },
  };
  const targets = racers.map((racer) => startPushVelocity(racer.pace, DEFAULT_PUSH_SEED, racer.id));
  for (let k = 1; k <= PUSH_TICKS; k++) {
    runTime += FIXED_STEP;
    for (let index = 0; index < racers.length; index++) {
      const racer = racers[index];
      applyPushTick(racer, k, targets[index]);
      racer.x += racer.vx * FIXED_STEP;
      racer.y = world.y(racer.x) - RADIUS;
    }
  }
  for (let tick = 0; tick < 3_000; tick++) {
    runTime += FIXED_STEP;
    for (const racer of racers) {
      stepRacer(racer, ctx, FIXED_STEP);
      assert.equal(racer.pathId, null, 'no network means no path, ever');
    }
  }
  assert.ok(racers.every((racer) => racer.x > 1_000), 'and the field still goes down the hill');
});
