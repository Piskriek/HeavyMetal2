/**
 * M01 · T2 — the merge pool state machine, as pure ticks.
 *
 * Run with: `node --import tsx --test tests/merge-pool.test.ts` (also registered in scripts/check.mjs).
 *
 * The pool is where "leave the loop in the order you arrived" is decided, so these tests are about
 * the queue's arithmetic rather than about pixels: the ordering key, the ready-up deadlines per
 * rank, the two ways the pool closes, the auto-ready flag an idle player earns, the late rider who
 * is appended rather than dropped, the occupancy check and its forced escape, the tick-derived
 * countdown labels, the typed refusals, and the pause law (releases shift by exactly the ticks lost).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALIGN_MAX_TICKS, BOT_READY_BASE_TICKS, BOT_READY_RANK_TICKS, COUNTDOWN_TICKS, MERGE_GATE_HALF_WIDTH,
  MERGE_RELEASE_VX, MergePool, PLAYER_AUTO_READY_TICKS, POOL_MAX_WAIT_TICKS,
  POOL_PLAYER_GRACE_TICKS,
  RELEASE_GAP_TICKS, RELEASE_MAX_RETRIES, RELEASE_RETRY_TICKS, loopRideProgress, mergeOrder,
  type MergeEntry, type MergeOccupancy,
} from '../src/game/merge/pool';
import { PASSAGE_GHOST_TAIL_S } from '../src/game/qualifying/passage';
import { laneZ } from '../src/game/scene';

const RACERS = [0, 1, 2, 3];
const GATE_X = 1184.44;
const LOOP_Z = laneZ(2);

/** A pool whose four riders have just queued, in entry order, one tick apart. */
function queued(firstTick = 100) {
  const pool = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: RACERS, playerId: 0 });
  for (let rank = 0; rank < RACERS.length; rank++) {
    const result = pool.enter(rank, firstTick + rank, 0.5, GATE_X);
    assert.equal(result.ok, true);
  }
  return pool;
}

/** Occupancy that never delays a release and always claims alignment. */
const CLEAR: MergeOccupancy = { previousProgress: 1, candidateAligned: true, expected: RACERS.length };

/** Steps the pool from `from` to `to` (exclusive), collecting every release with its tick. */
function run(pool: MergePool, from: number, to: number, occupancy: MergeOccupancy = CLEAR) {
  const releases: { racerId: number; tick: number }[] = [];
  for (let tick = from; tick <= to; tick++) {
    for (const racerId of pool.step(tick, occupancy)) releases.push({ racerId, tick });
  }
  return releases;
}

test('order is entry time then id', () => {
  const pool = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: RACERS, playerId: 0 });
  // Deliberately out of order, with three riders sharing one tick and two sharing a sub-tick time.
  pool.enter(3, 200, 0.1, GATE_X);
  pool.enter(1, 201, 0.9, GATE_X);
  pool.enter(0, 200, 0.4, GATE_X);
  pool.enter(2, 201, 0.9, GATE_X);
  const order = mergeOrder(pool.entries);
  assert.deepEqual(order, [3, 0, 1, 2], 'entry time first, racer id as the tie-break');

  // Dead heat: the same tick *and* the same fraction is resolved by id, deterministically.
  const tie = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: RACERS, playerId: 0 });
  tie.enter(2, 50, 0.25, GATE_X);
  tie.enter(0, 50, 0.25, GATE_X);
  tie.enter(1, 50, 0.25, GATE_X);
  assert.deepEqual(mergeOrder(tie.entries), [0, 1, 2]);

  // Property: 500 random entry sets sort by (entryTime, racerId) and by nothing else.
  let seed = 0x5eed;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let round = 0; round < 500; round++) {
    const ids = RACERS.filter(() => random() > 0.25);
    if (ids.length === 0) continue;
    const randomPool = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: ids, playerId: 0 });
    const expected: { racerId: number; entryTime: number }[] = [];
    for (const id of ids) {
      const tick = 1000 + Math.floor(random() * 40);
      const fraction = random();
      const result = randomPool.enter(id, tick, fraction, GATE_X);
      assert.equal(result.ok, true, 'every listed racer enters');
      expected.push({ racerId: id, entryTime: (tick + Math.min(1, fraction)) / 120 });
    }
    expected.sort((a, b) => a.entryTime - b.entryTime || a.racerId - b.racerId);
    assert.deepEqual(mergeOrder(randomPool.entries), expected.map((entry) => entry.racerId));
    // Ranks follow the sorted order, so the queue is the identity the rest of the pool uses.
    assert.deepEqual(randomPool.entries.map((entry) => entry.rank), randomPool.entries.map((_, index) => index));
  }
});

test('bots ready by rank', () => {
  const pool = queued(100);
  // One tick before the deadline nothing has readied; at the deadline each bot does, in rank order.
  const deadlines = RACERS.map((id, rank) => 100 + rank + BOT_READY_BASE_TICKS + BOT_READY_RANK_TICKS * rank);
  pool.step(Math.min(...deadlines) - 1, CLEAR);
  for (const entry of pool.entries) {
    if (entry.isPlayer) continue;
    assert.equal(entry.readyTick, null, `${entry.racerId} readied early`);
  }
  for (const entry of pool.entries) {
    if (entry.isPlayer) continue;
    const deadline = entry.entryTick + BOT_READY_BASE_TICKS + BOT_READY_RANK_TICKS * entry.rank;
    pool.step(deadline, CLEAR);
    assert.equal(entry.readyTick, deadline, 'a bot readies exactly on its rank deadline');
  }
  // The player never auto-readies before their own (much later) deadline.
  const player = pool.entries.find((entry) => entry.isPlayer)!;
  assert.equal(player.readyTick, null);
  assert.equal(player.flags.includes('autoReady'), false);
});

test('pool closes on all-held or timeout', () => {
  const allHeld = queued(100);
  run(allHeld, 100, 100 + BOT_READY_BASE_TICKS + 3 * BOT_READY_RANK_TICKS);
  assert.equal(allHeld.phase, 'closed', 'every racer held ⇒ the pool closes without waiting for the timeout');

  // Three of four held: the pool waits, and only the timeout closes it.
  const waiting = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: RACERS, playerId: 0 });
  for (const id of [0, 1, 2]) waiting.enter(id, 500, 0, GATE_X);
  waiting.step(500 + POOL_MAX_WAIT_TICKS - 1, { ...CLEAR, expected: 4 });
  assert.equal(waiting.phase, 'open', 'still open one tick before the timeout');
  waiting.step(500 + POOL_MAX_WAIT_TICKS, { ...CLEAR, expected: 4 });
  assert.equal(waiting.phase, 'closed', 'the timeout closes the pool with a straggler still out there');
});

test('player auto-ready flagged', () => {
  const pool = queued(1000);
  const player = pool.entries.find((entry) => entry.isPlayer)!;
  const manual = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: RACERS, playerId: 0 });
  manual.enter(0, 1000, 0, GATE_X);
  const manualPlayer = manual.entries[0];
  const ready = manual.ready(0, 1040);
  assert.equal(ready.ok, true);
  assert.equal(manualPlayer.readyTick, 1040);
  assert.equal(manualPlayer.flags.includes('autoReady'), false, 'a manual ready is not flagged');

  // An idle player is readied by the pool, keeps their rank 0 slot, and is flagged.
  assert.equal(player.rank, 0);
  pool.step(1000 + PLAYER_AUTO_READY_TICKS, CLEAR);
  assert.equal(player.readyTick, 1000 + PLAYER_AUTO_READY_TICKS);
  assert.deepEqual(player.flags, ['autoReady']);
  assert.equal(mergeOrder(pool.entries)[0], 0, 'the idle player keeps the place they earned');
});

test('late rider appended and flagged', () => {
  const pool = queued(100);
  // Close the pool with three held racers, then a fourth arrives.
  const first = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: RACERS, playerId: 0 });
  for (const id of [0, 1, 2]) first.enter(id, 100 + id, 0, GATE_X);
  first.step(100, { ...CLEAR, expected: 3 });
  assert.equal(first.phase, 'closed');
  const lateEntry = first.enter(3, 900, 0.5, GATE_X);
  assert.equal(lateEntry.ok, true, 'a late rider is accepted, never dropped');
  assert.deepEqual(lateEntry.ok && lateEntry.value.flags, ['late']);
  assert.equal(lateEntry.ok && lateEntry.value.rank, 3, 'appended to the back of the queue');

  // A rider arriving after the pool is done is refused with a typed reason: they race on.
  const done = queued(100);
  const doneAt = 100 + PLAYER_AUTO_READY_TICKS + COUNTDOWN_TICKS + 600;
  run(done, 100, doneAt);
  assert.equal(done.phase, 'done');
  const refused = done.enter(0, doneAt + 1, 0, GATE_X);
  assert.equal(refused.ok, false);
  assert.equal(refused.ok === false && refused.reason, 'not_open');

  // And a gate outside the corridor is refused rather than silently swallowed.
  const corridor = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: RACERS, playerId: 0 });
  assert.ok(MERGE_GATE_HALF_WIDTH > Math.abs(laneZ(0)), 'the pool covers the outermost lane');
  assert.equal(corridor.enter(0, 10, 0, GATE_X).ok, true);
  assert.equal(corridor.enter(1, 10, 0, GATE_X).ok, true);
});

test('occupancy delays and forced flag', () => {
  const pool = queued(100);
  // Ready everyone by hand and run to the release phase.
  for (const entry of pool.entries) pool.ready(entry.racerId, 110);
  const go = 100 + COUNTDOWN_TICKS;
  const beforeGo = run(pool, 100, go - 1);
  assert.equal(pool.phase, 'countdown', 'still counting down on the tick before GO');
  assert.deepEqual(beforeGo, [], 'nothing is released before GO');
  // The first rider goes on the GO tick; the ring is clear because nobody came before them.
  const atGo = run(pool, go, go);
  assert.deepEqual(atGo.map((release) => release.racerId), [0]);
  assert.equal(pool.phase, 'releasing');

  // The next rider is then blocked by the previous rider, who has not reached 0.25 of the ring yet.
  const blocked: MergeOccupancy = { previousProgress: 0.1, candidateAligned: true, expected: 4 };
  let tick = go + RELEASE_GAP_TICKS;
  for (let attempt = 0; attempt < RELEASE_MAX_RETRIES; attempt++) {
    assert.deepEqual([...pool.step(tick, blocked)], [], 'every retry is a delay, not a release');
    tick += RELEASE_RETRY_TICKS;
  }
  const delayed = pool.entries[1];
  assert.equal(delayed.releaseTick, null, 'still held while the ring is occupied');
  assert.equal(delayed.flags.includes('delayed'), true);
  // Past the retry budget the rider is released anyway, flagged `forced` — never stuck forever.
  const forced = pool.step(tick, blocked);
  assert.deepEqual([...forced], [delayed.racerId]);
  assert.equal(delayed.flags.includes('forced'), true);

  // A release that has to wait a long time for alignment is flagged rather than stalled.
  const alignPool = queued(100);
  for (const entry of alignPool.entries) alignPool.ready(entry.racerId, 110);
  const goTick = 100 + COUNTDOWN_TICKS;
  run(alignPool, 100, goTick);
  const unaligned: MergeOccupancy = { previousProgress: 1, candidateAligned: false, expected: 4 };
  const second = alignPool.entries[1];
  alignPool.step(goTick + 1, unaligned);
  assert.equal(second.aligning, true, 'the next rider starts sliding into the loop lane');
  alignPool.step(goTick + 1 + ALIGN_MAX_TICKS, unaligned);
  assert.equal(second.flags.includes('alignForced'), true);
  assert.notEqual(second.releaseTick, null, 'and is released when the slide runs out of time');

  // With the ring clear, releases land exactly RELEASE_GAP_TICKS apart.
  const paced = queued(100);
  for (const entry of paced.entries) paced.ready(entry.racerId, 110);
  const firstAtGo = run(paced, 100, go);
  const rest = run(paced, go + 1, go + 10 * RELEASE_GAP_TICKS);
  const all = [...firstAtGo, ...rest];
  const gaps = all.slice(1).map((release, index) => release.tick - all[index].tick);
  assert.deepEqual([...new Set(gaps)], [RELEASE_GAP_TICKS], 'one release per gap, no bunching');
  assert.deepEqual(all.map((release) => release.racerId), RACERS, 'released in entry order');
  assert.equal(paced.phase, 'done', 'and the pool is done once the queue is empty');
});

test('countdown labels are tick-derived', () => {
  const pool = queued(100);
  for (const entry of pool.entries) pool.ready(entry.racerId, 110);
  const go = 100 + COUNTDOWN_TICKS;
  run(pool, 100, go - 1);
  assert.equal(pool.phase, 'countdown');
  const labels: (string | null)[] = [];
  for (const offset of [0, 1, 119, 120, 239, 240, 359]) {
    labels.push(pool.countdownLabel(100 + offset));
  }
  assert.deepEqual(labels, ['3', '3', '3', '2', '2', '1', '1']);
  // Labels come from ticks alone: asking twice gives the same answer, and going back in time works.
  assert.equal(pool.countdownLabel(100 + 130), '2');
  assert.equal(pool.countdownLabel(100 + 130), '2');
  assert.equal(pool.countdownLabel(100 + 359), '1');
  // The last countdown tick is the last tick with a number on it.
  run(pool, go, go);
  assert.equal(pool.phase, 'releasing');
  assert.equal(pool.countdownLabel(go), 'GO!');
  assert.equal(pool.countdownLabel(go + 30), 'GO!', 'GO! lingers briefly after the release tick');
  assert.equal(pool.countdownLabel(go + 60), null, 'and then the overlay is gone');
  assert.equal(pool.countdownLabel(go - 1), null, 'the countdown window does not reopen');
});

test('refusals: duplicate entry, ready when not held', () => {
  const pool = queued(100);
  assert.equal(pool.enter(0, 200, 0, GATE_X).ok, false);
  assert.equal(pool.refusals.at(-1)?.reason, 'duplicate_entry');
  assert.equal(pool.enter(9, 200, 0, GATE_X).ok, false);
  assert.equal(pool.refusals.at(-1)?.reason, 'unknown_racer');
  assert.equal(pool.ready(9, 200).ok, false);
  assert.equal(pool.refusals.at(-1)?.reason, 'not_held');
  assert.equal(pool.ready(0, 200).ok, true);
  assert.equal(pool.ready(0, 201).ok, false);
  assert.equal(pool.refusals.at(-1)?.reason, 'already_ready');
  // A rejected call changes nothing.
  assert.equal(pool.entries.length, 4);
  assert.equal(pool.entries.filter((entry) => entry.readyTick !== null).length, 1);
});

test('pause shifts schedule', () => {
  // The engine pauses by not stepping the sim at all, so the sim's tick counter stands still while
  // the wall clock keeps running. This harness is that mapping: `sim` only advances on ticks that
  // were actually simulated, `wall` always does.
  const pausedTicks = 137;
  const simulate = (pool: MergePool, pauseAt: number | null) => {
    const releases: { racerId: number; simTick: number; wallTick: number }[] = [];
    let sim = 100;
    for (let wall = 100; wall <= 900; wall++) {
      if (pauseAt !== null && wall >= pauseAt && wall < pauseAt + pausedTicks) continue;
      for (const racerId of pool.step(sim, CLEAR)) releases.push({ racerId, simTick: sim, wallTick: wall });
      sim += 1;
    }
    return releases;
  };
  const build = () => {
    const pool = queued(100);
    for (const entry of pool.entries) pool.ready(entry.racerId, 110);
    return pool;
  };
  const uninterrupted = build();
  const paused = build();
  const plain = simulate(uninterrupted, null);
  // The pause lands in the middle of the countdown.
  const withPause = simulate(paused, 300);

  assert.equal(plain.length, RACERS.length);
  assert.equal(withPause.length, RACERS.length);
  for (let index = 0; index < plain.length; index++) {
    assert.equal(withPause[index].racerId, plain[index].racerId, 'the same rider, in the same order');
    assert.equal(withPause[index].simTick, plain[index].simTick,
      'in simulated ticks nothing moved: the countdown needed the ticks it was promised');
    assert.equal(withPause[index].wallTick - plain[index].wallTick, pausedTicks,
      'and on the wall clock every release is exactly the paused duration later');
  }
  // The hold the race clock has to subtract is sim ticks, so it is identical with and without a pause.
  assert.equal(uninterrupted.holdTicks(), paused.holdTicks());
  assert.ok(uninterrupted.holdTicks() > 0, 'the hold is reported for the race clock');
  assert.equal(uninterrupted.holdTicks(), COUNTDOWN_TICKS, 'first entry to GO is the countdown alone');
});

/* -----------------------------------------------------------------------------
   Loop progress: the occupancy input, in its own right
   -------------------------------------------------------------------------- */

test('loop progress feeds the occupancy check', () => {
  assert.equal(loopRideProgress(null), 1, 'not riding ⇒ the ring is clear');
  assert.equal(loopRideProgress({ entryProgress: 0.5, angle: 0, entryAngle: 0, exitAngle: 6.28 }), 0,
    'still sliding on ⇒ nobody may follow');
  assert.equal(loopRideProgress({ entryProgress: 1, angle: 0, entryAngle: 0, exitAngle: Math.PI * 2 }), 0);
  assert.equal(loopRideProgress({ entryProgress: 1, angle: Math.PI / 2, entryAngle: 0, exitAngle: Math.PI * 2 }), 0.25);
  assert.equal(loopRideProgress({ entryProgress: 1, angle: Math.PI * 2, entryAngle: 0, exitAngle: Math.PI * 2 }), 1);
  // A degenerate span (a loop someone authored with entry === exit) reads as clear, not as NaN.
  assert.equal(loopRideProgress({ entryProgress: 1, angle: 1, entryAngle: 1, exitAngle: 1 }), 1);

  // Constants the rest of the system quotes. (The release tail lives with the passage now: the rider
  // is intangible until they are clear of the geometry loop, not until a ring ride ends — T1d.)
  assert.equal(MERGE_RELEASE_VX, 700);
  assert.equal(PASSAGE_GHOST_TAIL_S, 0.75);
  assert.equal(RELEASE_GAP_TICKS, 42);
});

/** The published entry shape, checked once so the engine's reader cannot drift from it. */
test('entry shape is the one the HUD reads', () => {
  const pool = queued(100);
  const entry = pool.entries[0];
  const keys: (keyof MergeEntry)[] = [
    'racerId', 'isPlayer', 'entryTick', 'entryTime', 'crossX', 'rank', 'slotZ',
    'readyTick', 'releaseTick', 'aligning', 'alignStartTick', 'flags',
  ];
  for (const key of keys) assert.equal(key in entry, true, `MergeEntry.${key} is missing`);
  assert.equal(entry.isPlayer, true, 'racer 0 is the player');
  assert.equal(entry.crossX, GATE_X);
});

test('the window waits for the player to set their split', () => {
  // The run down to the loop is the player's split, so a window that closed on the field's clock
  // would take it away: while the player is on approach the wait has no clock of its own.
  const pool = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: RACERS, playerId: 0 });
  for (const id of [1, 2, 3]) pool.enter(id, 500, 0, GATE_X);
  assert.equal(pool.playerOnApproach, true, 'the player has not queued');
  assert.equal(pool.graceTick, null, 'and there is no grace clock of the field\'s to close it');

  // Long past the timeout that used to close the pool, and past the field's own auto-ready: the
  // window is still open, because the rider it is waiting for is the player and the player is racing.
  pool.step(500 + PLAYER_AUTO_READY_TICKS, { ...CLEAR, expected: 4 });
  assert.equal(pool.phase, 'open', 'the pool holds the field while the player sets their split');
  pool.step(500 + POOL_MAX_WAIT_TICKS * 3, { ...CLEAR, expected: 4 });
  assert.equal(pool.phase, 'open', 'and it keeps holding it');

  // The player arrives — on their own time, not the field's — and is not `late` for it.
  const entry = pool.enter(0, 3000, 0.25, GATE_X);
  assert.equal(entry.ok, true);
  if (entry.ok) {
    assert.deepEqual(entry.value.flags, [], 'a player who ran their own race is not late');
    assert.equal(entry.value.entryTime, 3000.25 / 120);
  }
  assert.equal(pool.playerOnApproach, false);
  assert.equal(pool.graceTick, 3000, 'the grace now measures from the player');
  // The whole field is held, so the window closes at once: the ready-up panel appearing the moment
  // the player is actually in the pool is the point of the whole change.
  pool.step(3000, { ...CLEAR, expected: 4 });
  assert.equal(pool.phase, 'closed', 'all four held ⇒ the pool closes on the player\'s arrival tick');

  // With the field still short, the grace is the player's own, not the field's.
  const playerGrace = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: RACERS, playerId: 0 });
  for (const id of [1, 2]) playerGrace.enter(id, 500, 0, GATE_X);
  playerGrace.enter(0, 3000, 0, GATE_X);
  playerGrace.step(3000 + POOL_MAX_WAIT_TICKS - 1, { ...CLEAR, expected: 4 });
  assert.equal(playerGrace.phase, 'open', 'the field waits out the player\'s whole grace');
  playerGrace.step(3000 + POOL_MAX_WAIT_TICKS, { ...CLEAR, expected: 4 });
  // Closed — and, the moment it is, the ready field rolls straight into its countdown.
  assert.notEqual(playerGrace.phase, 'open', 'and closes on the player\'s own timeout');

  // The backstop: a player who never reaches the loop must not hold the race for ever.
  const stuck = new MergePool({ gateX: GATE_X, loopZ: LOOP_Z, racerIds: RACERS, playerId: 0 });
  for (const id of [1, 2, 3]) stuck.enter(id, 500, 0, GATE_X);
  stuck.step(500 + POOL_PLAYER_GRACE_TICKS - 1, { ...CLEAR, expected: 4 });
  assert.equal(stuck.phase, 'open', 'the grace deadline is the last tick it stays open');
  stuck.step(500 + POOL_PLAYER_GRACE_TICKS, { ...CLEAR, expected: 4 });
  assert.notEqual(stuck.phase, 'open', 'a wrecked run cannot hang the race');
  // Whoever crosses after that is late, exactly as any other late rider.
  const late = stuck.enter(0, 500 + POOL_PLAYER_GRACE_TICKS + 1, 0, GATE_X);
  assert.equal(late.ok, true);
  if (late.ok) assert.ok(late.value.flags.includes('late'), 'past the deadline the flag is earned');
});
