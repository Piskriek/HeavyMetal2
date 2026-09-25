/**
 * 100-ball solo first split: the rivals' split times are simulated, they queue in the pool by time
 * (so the overlay shows every time), and the pool lets the field go in that order at a pace that
 * does not leave the player waiting minutes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRacers } from '../src/game/racers';
import { createTrackLayout } from '../src/game/track-layout';
import { createAirPickups } from '../src/game/powerups';
import { createQualifyingGate } from '../src/game/qualifying/gate';
import { passageMouthX } from '../src/game/qualifying/passage';
import { simulateSplitTicks } from '../src/game/sim/split-times';
import { DEFAULT_PUSH_SEED } from '../src/game/sim/start-push';
import { assignNearestPaths, createDefaultLaneNetwork } from '../src/game/lane-network';
import { MERGE_RELEASE_VX, MergePool, releaseOccupancy } from '../src/game/merge/pool';
import { laneZ } from '../src/game/scene';

const course = 'ridge' as const;
function field() {
  const built = createTrackLayout(course);
  const obstacles = createTrackLayout(course, { skipBeforeX: passageMouthX(), keepLoopsFromX: createQualifyingGate(course, built).x });
  const pickups = createAirPickups(course, obstacles);
  const racers = createRacers({ fieldSize: 100 } as never);
  const network = createDefaultLaneNetwork(course);
  assignNearestPaths(racers, network);
  const input = { course, obstacles, pickups, network, gateX: passageMouthX(), pushSeed: DEFAULT_PUSH_SEED };
  return { racers, input };
}

test('every rival gets a real, deterministic split time', () => {
  const { racers, input } = field();
  assert.equal(racers.length, 100);
  const t0 = performance.now();
  const splits = simulateSplitTicks(racers.slice(1), input);
  const ms = performance.now() - t0;
  assert.equal(splits.size, 99);
  for (const [id, tick] of splits) {
    assert.ok(tick !== null, `rival ${id} reached the split`);
    assert.ok(tick! / 120 > 3 && tick! / 120 < 60, `rival ${id}: ${(tick! / 120).toFixed(2)} s`);
  }
  const again = simulateSplitTicks(racers.slice(1), input);
  assert.deepEqual([...again], [...splits], 'the same run replays the same times');
  assert.ok(ms < 3000, `99 splits in ${ms.toFixed(0)} ms`);
});

test('the pool queues the field by split time and releases 100 riders in well under a minute', () => {
  const { racers, input } = field();
  const splits = simulateSplitTicks(racers.slice(1), input);
  const gateX = input.gateX;
  const pool = new MergePool({ gateX, loopZ: laneZ(2), racerIds: racers.map((r) => r.id), playerId: 0 });
  // The player arrives mid-field; the engine's queueRivals then enters everyone else at their time.
  const sorted = [...splits.values()].map(Number).sort((a, b) => a - b);
  const playerTick = Math.floor(sorted[49]) ;
  pool.enter(0, playerTick, 0.5, gateX);
  for (const [id, split] of splits) { const t = Math.floor(split!); pool.enter(id, t, split! - t, gateX); pool.ready(id, playerTick); }
  const order = pool.entries.map((e) => e.entryTime);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'queue is in split-time order');
  const playerRank = pool.entries.findIndex((e) => e.isPlayer);
  assert.ok(playerRank > 0 && playerRank < 99, `the player queues by time, rank ${playerRank}, not last`);
  pool.ready(0, playerTick);
  // Drive the pool: released riders move off at the release speed; the occupancy is the engine's rule.
  const xs = new Map<number, number>(); let last: number | null = null; const releasedAt = new Map<number, number>();
  for (let tick = playerTick; tick < playerTick + 120 * 120 && !pool.finished; tick++) {
    for (const [id, x] of xs) xs.set(id, x + MERGE_RELEASE_VX / 120);
    const out = pool.step(tick, { previousProgress: last === null ? 1 : releaseOccupancy(xs.get(last)!, gateX), candidateAligned: true, expected: 100 });
    for (const id of out) { xs.set(id, gateX); last = id; releasedAt.set(id, tick); }
  }
  assert.equal(releasedAt.size, 100, 'everyone got out');
  const released = [...releasedAt.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
  assert.deepEqual(released, pool.entries.map((e) => e.racerId), 'released in split-time order');
  const span = (Math.max(...releasedAt.values()) - Math.min(...releasedAt.values())) / 120;
  assert.ok(span < 45, `the whole field leaves in ${span.toFixed(1)} s`);
  // Consecutive releases are at least the spacing apart (no contact at the mouth).
  const ticks = [...releasedAt.values()].sort((a, b) => a - b);
  for (let i = 1; i < ticks.length; i++) {
    const gap = (ticks[i] - ticks[i - 1]) / 120 * MERGE_RELEASE_VX;
    assert.ok(gap >= 200, `gap ${gap.toFixed(0)} units between riders ${i - 1} and ${i}`);
  }
});

test('the engine queues the rivals by their simulated splits when the player reaches the pool', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /if \(racer\.id === PLAYER_ID\) this\.queueRivals\(this\.merge\);/);
  assert.match(engine, /this\.rivalSplits = this\.racers\.length > 1\n\s*\? simulateSplitTicks\(/);
  assert.match(engine, /if \(!this\.splitReached && racer\.id !== PLAYER_ID\) continue;/, 'no more parking rivals on the gate');
  assert.doesNotMatch(engine, /racer\.x = passageMouthX\(\);\n\s*racer\.vx = 0;/);
});
