/**
 * M01 · T6 — the guard rail: a lane network changes the race only once it is authored.
 *
 * `RacerStepContext.laneNetwork` is optional, and the engine leaves it unset on every course until a
 * builder authors one. Absent and `null` therefore have to mean the same thing — the legacy four
 * lanes — or the first release of T6 would quietly re-time every race that already exists. This runs
 * the same seeded field twice per seed, once with the key missing and once set to `null`, and compares
 * a digest of every racer's position, lane and speed at the end of each second.
 *
 * Two controls keep the claim honest: 50 different seeds must all produce *different* digests (so the
 * fingerprint can actually see a divergence), and a deliberately narrow authored network must produce
 * a different digest again (so the network is wired to the physics, not to nothing).
 *
 * Run with: `node --import tsx --test tests/lane-parity.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRacers } from '../src/game/racers';
import { createSimWorld } from '../src/game/sim/world';
import { stepRacer } from '../src/game/sim/racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from '../src/game/sim/context';
import { createTrackLayout } from '../src/game/track-layout';
import { createAirPickups } from '../src/game/powerups';
import { driveCpu, type CpuContext } from '../src/game/sim/cpu-driver';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { PUSH_TICKS, applyPushTick, startPushVelocity } from '../src/game/sim/start-push';
import {
  DEFAULT_HALF_WIDTH, LANE_NETWORK_VERSION, adoptNearestPaths, type LaneNetwork,
} from '../src/game/lane-network';
import { FINISH, RADIUS, START_X, laneZ } from '../src/game/scene';

const FIELD_SEED = 0x5eed;
/** A full race: the field reaches the flag at about tick 5200 on this course, so this is headroom. */
const TICKS = 6000;
/** Every second of every run, in a shape a single character of difference will change. */
const SAMPLE_EVERY = 120;

/**
 * One field, one seed, one shape of context. `network: null` sets the key; omitting it leaves it out
 * entirely — which is the whole point of the comparison.
 */
function race(seed: number, options: { ticks?: number; network?: LaneNetwork | null } = {}) {
  const ticks = options.ticks ?? TICKS;
  const obstacles = createTrackLayout('ridge', { skipBeforeX: 0 });
  const world = createSimWorld('ridge', obstacles, createAirPickups('ridge', obstacles));
  const racers = createRacers();
  const random = () => ((seed % 97) + 1) / 100;
  let tick = 0;
  const context: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random,
    get runTime() { return tick / 120; },
    get wallTime() { return tick / 120; },
    ...(options.network === undefined ? {} : { laneNetwork: options.network }),
  };
  const cpu: CpuContext = {
    step: context, difficulty: 'racer', others: racers,
    get paceTargetX() { return racers[0].x; },
    stagger: (racer) => racer.id * 0.023,
  };

  // The same goblin push and the same four-lane grid every race starts with (T0/T1).
  const pushes = racers.map((racer) => startPushVelocity(racer.pace, FIELD_SEED ^ seed, racer.id));
  for (let pushTick = 1; pushTick <= PUSH_TICKS; pushTick++) {
    tick++;
    for (let i = 0; i < racers.length; i++) {
      applyPushTick(racers[i], pushTick, pushes[i]);
      racers[i].x += racers[i].vx * FIXED_STEP;
      racers[i].y = world.y(racers[i].x) - RADIUS;
    }
  }

  const frames: string[] = [];
  let laneChanges = 0;
  const previousLanes = racers.map((racer) => racer.lane);
  const previousRecoveries = racers.map((racer) => racer.recoveries);
  const finishTicks = racers.map(() => -1);
  let recoveries = 0;
  for (; tick < ticks; tick++) {
    // The engine adopts once per tick, before anything is driven or stepped: the grid sits on the
    // first node of the network, and any racer the crew puts back outside every path waits here.
    adoptNearestPaths(racers, options.network ?? null);
    for (const racer of racers) {
      if (racer.finished) continue; // the engine stops driving a racer the moment it takes the flag
      driveCpu(racer, cpu); stepRacer(racer, context, FIXED_STEP);
    }
    for (let i = 0; i < racers.length; i++) {
      if (racers[i].lane !== previousLanes[i]) { laneChanges++; previousLanes[i] = racers[i].lane; }
      recoveries += racers[i].recoveries - previousRecoveries[i];
      previousRecoveries[i] = racers[i].recoveries;
      if (finishTicks[i] < 0 && racers[i].finished) finishTicks[i] = tick;
    }
    if (tick % SAMPLE_EVERY === 0) {
      frames.push(racers
        .map((racer) => `${racer.x.toFixed(2)}/${racer.z.toFixed(2)}/${racer.lane}/${racer.targetLane}/${racer.vx.toFixed(1)}/${racer.recoveries}`)
        .join(' '));
    }
    if (finishTicks.every((finishedAt) => finishedAt >= 0)) break;
  }
  // The finish itself is part of the fingerprint: when, where and in what shape the field arrives.
  frames.push(racers.map((racer, index) => `${index}:${finishTicks[index]}:${racer.x.toFixed(2)}`).join(' '));
  return {
    digest: frames.join('|'), laneChanges, recoveries, finishTicks,
    furthest: Math.max(...racers.map((racer) => racer.x)),
    finalZ: racers.map((racer) => racer.z),
  };
}

test('parity: an absent lane network is the same race as a null one, over 50 seeds', () => {
  let laneChanges = 0;
  let furthest = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const absent = race(seed);
    const nul = race(seed, { network: null });
    assert.equal(nul.digest, absent.digest, `seed ${seed}: absent and null must not diverge`);
    assert.equal(nul.laneChanges, absent.laneChanges);
    assert.equal(nul.recoveries, absent.recoveries);
    assert.deepEqual(nul.finishTicks, absent.finishTicks);
    assert.deepEqual(absent.finishTicks.filter((finishedAt) => finishedAt < 0), [],
      `seed ${seed}: every racer must reach the flag`);
    laneChanges += absent.laneChanges;
    furthest = Math.max(furthest, absent.furthest);
  }
  // A run where nobody ever changed lane, or never left the grid, would prove nothing.
  assert.ok(laneChanges > 1000, `the field must be changing lanes (saw ${laneChanges})`);
  assert.ok(furthest > 72000, `the field must reach the flag (reached ${furthest.toFixed(0)})`);
});

test('parity: the fingerprint is sensitive, and the network is wired in', () => {
  const first = race(1);
  const second = race(2);
  assert.notEqual(second.digest, first.digest, 'different seeds must fingerprint differently');

  // A network that is genuinely tighter than the track has to be felt: one line, lane 0, half width
  // 40 instead of the authored default. If the digest did not move, the network would be decoration.
  const narrow: LaneNetwork = {
    version: LANE_NETWORK_VERSION, course: 'ridge',
    nodes: [
      { id: 'start', x: START_X, z: laneZ(0), kind: 'normal' },
      { id: 'end', x: FINISH, z: laneZ(0), kind: 'normal' },
    ],
    paths: [{ id: 'narrow', name: 'Narrow', nodeIds: ['start', 'end'], halfWidth: 40 }],
  };
  const authored = race(1, { network: narrow });
  assert.notEqual(authored.digest, first.digest, 'an authored corridor must change the race');
  assert.ok(DEFAULT_HALF_WIDTH > 40, 'the default half width is the roomy one');
  // And it changes it in the way an authored line should: the balls are held on it, so the weaving
  // that the four legal lanes allow almost disappears and every ball ends inside the corridor.
  assert.ok(authored.laneChanges < first.laneChanges / 2,
    `one legal line leaves nothing to weave into (${authored.laneChanges} vs ${first.laneChanges})`);
  assert.ok(authored.finalZ.every((z) => Math.abs(z - laneZ(0)) <= narrow.paths[0].halfWidth + 1e-6),
    `every ball must end on the authored line, saw ${authored.finalZ.map((z) => z.toFixed(0)).join(', ')}`);

  // Adoption is what makes the network bite, and it must be idempotent: a second pass over a field
  // that is already on its paths may change nothing.
  const field = createRacers();
  assert.equal(adoptNearestPaths(field, narrow), field.length, 'every racer takes the one path');
  assert.equal(adoptNearestPaths(field, narrow), 0, 'and a second pass adopts nobody');
  assert.equal(adoptNearestPaths(field, null), 0, 'a null network adopts nobody, ever');
  assert.equal(field.every((racer) => racer.pathId === 'narrow'), true);
});
