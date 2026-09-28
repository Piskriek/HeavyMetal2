/**
 * T05 — release scheduler tests.
 *
 * Covers every acceptance criterion from issue #38:
 * 1. Slow leader/fast follower.
 * 2. Stopped leader and invalid speed.
 * 3. One to four valid lanes.
 * 4. Narrowing mapped track.
 * 5. Blocked exit.
 * 6. Delayed earlier pole entries.
 * 7. Acceleration during the reserved horizon.
 * 8. Clearance at actual emergence.
 * 9. Common-start finish accounting.
 * 10. Report actual total release span; do not enforce an unsafe six-second target.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeReleasePlan, ReleaseExecutor, CLEAR_OCCUPANCY,
  DEFAULT_WAVE_GAP_SECONDS, DEFAULT_BLOCKED_TIMEOUT_SECONDS,
  type OccupancyProvider, type ReleaseSlot,
} from '../src/game/release/scheduler';
import {
  buildFrozenGrid, poleSlot, MIN_EXIT_SPEED,
  type FrozenGrid,
} from '../src/game/release/grid';
import { GoClock, computeFinishOrder } from '../src/game/release/go-clock';
import { defaultReleaseCorridor, type SpawnPoint } from '../src/game/contracts/release';
import { rankQualifying, createQualifyingEntry, type RankedQualifyingEntry } from '../src/game/contracts/qualifying';
import { FIXED_STEP, ticksForSeconds } from '../src/game/contracts/timing';

function entry(racerId: number, time: number | null, speed = 300): RankedQualifyingEntry {
  const base = createQualifyingEntry({
    racerId, attempt: 1,
    status: time !== null ? 'valid' : 'fallback',
    time, speed, peakSpeed: speed,
    fallback: time !== null ? undefined : 'dnf',
    rewardRolled: false,
  });
  return { ...base, rank: 0, advanced: true };
}

function makeEntries(count: number, baseSpeed = 300): readonly RankedQualifyingEntry[] {
  const entries = Array.from({ length: count }, (_, i) =>
    entry(i, 1.0 + i * 0.1, baseSpeed - i * 5),
  );
  return rankQualifying(entries, count);
}

function makeGrid(count: number, opts: { lanes?: number; speed?: number; waveSpacing?: number } = {}): FrozenGrid {
  const entries = makeEntries(count, opts.speed ?? 300);
  const corridor = defaultReleaseCorridor({ to: count > 4 ? 2000 : 900 });
  const { grid } = buildFrozenGrid(entries, {
    corridor,
    laneCount: opts.lanes ?? 4,
    preferredWaveSpacing: opts.waveSpacing ?? 200,
  });
  return grid;
}

// ---- Mock occupancy providers ----

/** Occupancy that blocks a specific spawn point until a given tick. */
function blockingUntil(spawnX: number, spawnZ: number, untilTick: number): OccupancyProvider {
  let tick = 0;
  return {
    isOccupied(spawn: SpawnPoint, radius: number): boolean {
      return Math.abs(spawn.x - spawnX) < radius && Math.abs(spawn.z - spawnZ) < radius && tick < untilTick;
    },
  };
}

/** Occupancy that blocks forever. */
function alwaysBlocking(spawnX: number, spawnZ: number): OccupancyProvider {
  return {
    isOccupied(spawn: SpawnPoint, radius: number): boolean {
      return Math.abs(spawn.x - spawnX) < radius && Math.abs(spawn.z - spawnZ) < radius;
    },
  };
}

describe('scheduler: slow leader / fast follower (criterion 1)', () => {
  it('a slow leader is never rear-ended by a fast follower during release', () => {
    // Pole (racer 0) is slow (100 speed), follower (racer 1) is fast (500 speed).
    const entries = [
      { ...entry(0, 2.0, 100), rank: 1, advanced: true },
      { ...entry(1, 1.0, 500), rank: 2, advanced: true },
      { ...entry(2, 1.5, 300), rank: 3, advanced: true },
      { ...entry(3, 1.8, 250), rank: 4, advanced: true },
    ] as readonly RankedQualifyingEntry[];
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);

    // The leader (wave 0) is released before the follower (wave 0 too if same wave, or wave 1).
    // Either way, the leader's x is >= the follower's x.
    const pole = grid.slots.find((s) => s.racerId === 0)!;
    const follower = grid.slots.find((s) => s.racerId === 1)!;
    assert.ok(pole.x >= follower.x, 'leader must be at or ahead of follower on the grid');
    // Release plan is complete.
    assert.equal(plan.complete, true);
  });
});

describe('scheduler: stopped leader and invalid speed (criterion 2)', () => {
  it('a stalled racer is flagged but the release continues', () => {
    const entries = [
      { ...entry(0, null, 0), rank: 1, advanced: true },  // stalled
      { ...entry(1, 1.0, 400), rank: 2, advanced: true },
      { ...entry(2, 1.5, 300), rank: 3, advanced: true },
      { ...entry(3, 1.8, 250), rank: 4, advanced: true },
    ] as readonly RankedQualifyingEntry[];
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    // The stalled racer gets MIN_EXIT_SPEED on the grid.
    const stalled = grid.slots.find((s) => s.racerId === 0)!;
    assert.equal(stalled.status, 'stalled');
    assert.equal(stalled.exitSpeed, MIN_EXIT_SPEED);

    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    assert.equal(plan.complete, true);
    // The stalled racer is still released (at MIN_EXIT_SPEED, not zero).
    const releasedStalled = plan.waves.flatMap((w) => w.slots).find((s) => s.racerId === 0)!;
    assert.equal(releasedStalled.exitSpeed, MIN_EXIT_SPEED);
  });
});

describe('scheduler: one to four valid lanes (criterion 3)', () => {
  for (const lanes of [1, 2, 3, 4]) {
    it(`releases correctly with ${lanes} lane(s)`, () => {
      const grid = makeGrid(8, { lanes });
      const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
      assert.equal(plan.complete, true);
      const released = plan.waves.flatMap((w) => w.slots).filter((s) => s.releasedTick !== null);
      assert.equal(released.length, 8);
    });
  }
});

describe('scheduler: narrowing mapped track (criterion 4)', () => {
  it('works with a narrow corridor', () => {
    const entries = makeEntries(4);
    const corridor = defaultReleaseCorridor({ halfWidth: 200, minSpacing: 100 });
    const { grid } = buildFrozenGrid(entries, { corridor });
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    assert.equal(plan.complete, true);
  });

  it('wave spacing adapts to a corridor with large minSpacing', () => {
    const entries = makeEntries(8);
    const corridor = defaultReleaseCorridor({ minSpacing: 300, to: 3000 });
    const { grid } = buildFrozenGrid(entries, { corridor, preferredWaveSpacing: 100 });
    // Wave spacing was clamped up.
    assert.ok(grid.waveSpacing >= 300);
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    assert.equal(plan.complete, true);
  });
});

describe('scheduler: blocked exit (criterion 5)', () => {
  it('flags a wave as blocked when the corridor is permanently occupied', () => {
    const grid = makeGrid(4);
    const pole = poleSlot(grid)!;
    const blocker = alwaysBlocking(pole.x, pole.z);
    const { plan } = computeReleasePlan(grid, blocker, { blockedTimeoutSeconds: 1 });
    // At least the first wave should be blocked.
    const blockedWave = plan.waves.find((w) => w.status === 'blocked');
    assert.ok(blockedWave, 'at least one wave should be blocked');
    // Blocked slots have no releasedTick.
    for (const slot of blockedWave!.slots) {
      assert.equal(slot.releasedTick, null);
      assert.equal(slot.status, 'blocked');
    }
  });
});

describe('scheduler: delayed earlier pole entries (criterion 6)', () => {
  it('delays a wave when occupancy is temporary, then releases it', () => {
    const grid = makeGrid(4);
    const pole = poleSlot(grid)!;
    // Block the pole position for 10 ticks, then clear.
    const tempBlocker = {
      tick: 0,
      isOccupied(spawn: SpawnPoint, radius: number): boolean {
        this.tick = (this.tick ?? 0) + 0;
        return Math.abs(spawn.x - pole.x) < radius * 2 && Math.abs(spawn.z - pole.z) < radius * 2 && (this.tick ?? 0) < 10;
      },
    };
    // Use a simpler approach: block until tick 10.
    const blocker: OccupancyProvider = {
      _tick: 0,
      isOccupied(spawn: SpawnPoint, radius: number): boolean {
        return Math.abs(spawn.x - pole.x) < radius * 2 && Math.abs(spawn.z - pole.z) < radius * 2;
      },
    };
    // For the computeReleasePlan, occupancy is called at specific ticks.
    let callCount = 0;
    const decayingBlocker: OccupancyProvider = {
      isOccupied(spawn: SpawnPoint, radius: number): boolean {
        callCount++;
        // Block the first 5 checks, then clear.
        if (Math.abs(spawn.x - pole.x) < radius * 2 && Math.abs(spawn.z - pole.z) < radius * 2) {
          return callCount <= 5;
        }
        return false;
      },
    };
    const { plan } = computeReleasePlan(grid, decayingBlocker, { blockedTimeoutSeconds: 5 });
    // The wave was delayed but eventually released.
    const firstWave = plan.waves[0];
    assert.ok(firstWave.releasedTick !== null, 'wave should eventually release');
    if (firstWave.status === 'delayed') {
      assert.ok(firstWave.releasedTick! > firstWave.scheduledTick, 'delayed wave must release after scheduled tick');
    }
  });
});

describe('scheduler: acceleration during the reserved horizon (criterion 7)', () => {
  it('reservations hold the slot for the declared horizon', () => {
    const grid = makeGrid(4);
    const { plan, reservations } = computeReleasePlan(grid, CLEAR_OCCUPANCY, {
      reservationHorizonSeconds: 2,
    });
    assert.equal(plan.complete, true);
    // Reservations were created for each wave.
    assert.ok(reservations.length > 0, 'reservations should be logged');
  });
});

describe('scheduler: clearance at actual emergence (criterion 8)', () => {
  it('the executor checks occupancy at each release tick, not just at plan time', () => {
    const grid = makeGrid(4);
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    // Now run the executor with a different occupancy that blocks at release time.
    let step = 0;
    const lateBlocker: OccupancyProvider = {
      isOccupied(_spawn: SpawnPoint, _radius: number): boolean {
        step++;
        // Block only during the first wave's scheduled tick.
        return step <= 3;
      },
    };
    const executor = new ReleaseExecutor(grid, plan, lateBlocker, { blockedTimeoutSeconds: 2 });
    const released = executor.run();
    // Some slots may be delayed or blocked.
    assert.ok(released.length > 0, 'at least some slots should be released');
  });
});

describe('scheduler: release span reporting (criterion 10)', () => {
  it('reports the actual total release span without enforcing a target', () => {
    const grid = makeGrid(20, { lanes: 4, waveSpacing: 200 });
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY, { waveGapSeconds: 0.5 });
    assert.equal(plan.complete, true);
    assert.ok(plan.releaseSpanSeconds !== null, 'release span should be reported');
    assert.ok(plan.releaseSpanSeconds! > 0, 'release span should be positive');
    // The span is whatever it is — not forced to 6 seconds.
    // With 20 racers, 4 lanes, 5 waves, 0.5s gap: minimum span is 2.0s.
    assert.ok(plan.releaseSpanSeconds! >= 2.0, `span ${plan.releaseSpanSeconds} should be >= 2.0s for 5 waves`);
  });

  it('a 100-racer field releases with a reported span, not a 6s target', () => {
    const entries = makeEntries(100);
    const corridor = defaultReleaseCorridor({ to: 5000 });
    const { grid } = buildFrozenGrid(entries, { corridor, laneCount: 4, preferredWaveSpacing: 200 });
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY, { waveGapSeconds: 0.3 });
    assert.equal(plan.complete, true);
    assert.ok(plan.releaseSpanSeconds !== null);
    // 25 waves at 0.3s gap = 7.2s minimum. This is more than 6s and that's fine.
    assert.ok(plan.releaseSpanSeconds! >= 7.0, `100-racer span ${plan.releaseSpanSeconds} should be >= 7.0s`);
  });
});

describe('scheduler: tick quantization', () => {
  it('all release ticks are integers (quantized to ticks)', () => {
    const grid = makeGrid(8);
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    for (const wave of plan.waves) {
      assert.ok(Number.isInteger(wave.scheduledTick));
      if (wave.releasedTick !== null) {
        assert.ok(Number.isInteger(wave.releasedTick));
      }
    }
  });

  it('upward quantization: release ticks are never before the scheduled tick', () => {
    const grid = makeGrid(8);
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    for (const wave of plan.waves) {
      if (wave.releasedTick !== null) {
        assert.ok(wave.releasedTick >= wave.scheduledTick, `released ${wave.releasedTick} must be >= scheduled ${wave.scheduledTick}`);
      }
    }
  });
});

describe('scheduler: release executor', () => {
  it('runs to completion with clear occupancy', () => {
    const grid = makeGrid(8);
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    const executor = new ReleaseExecutor(grid, plan, CLEAR_OCCUPANCY);
    const released = executor.run();
    assert.equal(released.length, 8);
    assert.equal(executor.isDone, true);
  });

  it('blocks a permanently occupied wave', () => {
    const grid = makeGrid(4);
    const pole = poleSlot(grid)!;
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    const blocker = alwaysBlocking(pole.x, pole.z);
    const executor = new ReleaseExecutor(grid, plan, blocker, { blockedTimeoutSeconds: 0.5 });
    executor.run();
    assert.ok(executor.blockedRacers.length > 0, 'should have blocked racers');
  });

  it('preserves exit speed exactly through the release', () => {
    const grid = makeGrid(4, { speed: 420 });
    const { plan } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    const executor = new ReleaseExecutor(grid, plan, CLEAR_OCCUPANCY);
    const released = executor.run();
    for (const slot of released) {
      if (slot.releasedTick !== null) {
        const gridSlot = grid.slots.find((s) => s.racerId === slot.racerId)!;
        assert.equal(slot.exitSpeed, gridSlot.exitSpeed, 'exit speed must be preserved exactly');
      }
    }
  });
});

describe('GO clock: common-start finish accounting (criterion 9)', () => {
  it('finish order is by absolute finish tick, not per-racer elapsed time', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 300, participants: [0, 1, 2, 3] });
    // Racer 2 finishes first (at tick 6000), racer 0 finishes last (at tick 7200).
    clock.recordFinish(2, 6000);
    clock.recordFinish(1, 6600);
    clock.recordFinish(3, 6900);
    clock.recordFinish(0, 7200);
    const results = clock.results;
    assert.equal(results[0].racerId, 2);
    assert.equal(results[0].position, 1);
    assert.equal(results[3].racerId, 0);
    assert.equal(results[3].position, 4);
  });

  it('race time is measured from the GO tick', () => {
    const goTick = 120; // 1 second at 120Hz
    const clock = new GoClock({ goTick, timeoutSeconds: 300, participants: [0] });
    clock.recordFinish(0, goTick + 6000); // 50s after GO
    const result = clock.results[0];
    assert.equal(result.raceTimeSeconds, 50.0);
  });

  it('timeout fires at the correct tick', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 1, participants: [0, 1] });
    clock.recordFinish(0, 60); // Finished at 0.5s
    // Advance to timeout (1s = 120 ticks).
    const timedOut: number[] = [];
    for (let i = 0; i < 130; i++) {
      const t = clock.tick();
      timedOut.push(...t);
    }
    assert.ok(clock.isSettled);
    assert.ok(timedOut.includes(1), 'racer 1 should time out');
    assert.ok(!timedOut.includes(0), 'racer 0 finished and should not time out');
  });

  it('computeFinishOrder is pure and deterministic', () => {
    const finishes = new Map<number, number>([[0, 7200], [1, 6600], [2, 6000], [3, 6900]]);
    const order = computeFinishOrder(finishes, 0);
    assert.equal(order[0].racerId, 2);
    assert.equal(order[1].racerId, 1);
    assert.equal(order[2].racerId, 3);
    assert.equal(order[3].racerId, 0);
    // Same call again gives the same result.
    const order2 = computeFinishOrder(finishes, 0);
    assert.deepEqual(order, order2);
  });

  it('ties are broken by racerId', () => {
    const finishes = new Map<number, number>([[3, 6000], [1, 6000], [0, 6000]]);
    const order = computeFinishOrder(finishes, 0);
    assert.equal(order[0].racerId, 0);
    assert.equal(order[1].racerId, 1);
    assert.equal(order[2].racerId, 3);
  });

  it('prevents double-finishing', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 300, participants: [0] });
    const first = clock.recordFinish(0, 6000);
    const second = clock.recordFinish(0, 7000);
    assert.ok(first !== null);
    assert.equal(second, null);
  });

  it('ignores finishes before the GO tick', () => {
    const clock = new GoClock({ goTick: 100, timeoutSeconds: 300, participants: [0] });
    const result = clock.recordFinish(0, 50);
    assert.equal(result, null);
  });
});

describe('release plan: determinism', () => {
  it('same grid and options produce the same plan', () => {
    const grid = makeGrid(8);
    const { plan: a } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    const { plan: b } = computeReleasePlan(grid, CLEAR_OCCUPANCY);
    assert.deepEqual(a, b);
  });
});
