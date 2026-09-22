/**
 * T02 acceptance tests — dynamic roster and scale-safe runtime plumbing (#35).
 *
 * Covers:
 * - unique IDs and stable local-player focus at 4 / 20 / 50 / 100
 * - no ID/index aliasing or bit-mask wrapping at racer counts 32, 33, 64 and 100
 * - explicit versioned summary policy: persisted truncation is never silent
 * - RNG streams are separated and resettable for same-seed replay
 * - AI staggering is bounded and the physics tick rate is untouched
 * - legacy four-racer definitions and compatibility behaviour stay bit-exact
 * - high-count HUD selection stays bounded
 *
 * Run with: node scripts/check.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAYER_ID, RESULTS_MAX_ROWS, buildRoster, buildRosterLoadouts, clampFieldSize,
  cpuDecisionStagger, finishPositionBonus, launchAngleOffset, obstacleHitBy, obstacleHitCount,
  pairKey, recordObstacleHit, resultRows, rosterColor, trackbarRacers,
} from '../src/game/roster';
import { createRng, cosmeticSeed } from '../src/game/rng';
import { GRID_ROW_SPACING, createRacers } from '../src/game/racers';
import { RACER_DEFINITIONS, type RacerStanding, type RunRecord } from '../src/game/types';
import { opponentLoadouts } from '../src/game/loadouts';
import { START_X } from '../src/game/scene';
import {
  createSession, cupStandings, qualifyingForField, roundPointsFor, CUP_POINTS, sessionConfig,
  type RaceSetup,
} from '../src/game/session';
import {
  RESULT_SUMMARY_POLICY, SUMMARY_POLICY_VERSION, sanitizeRecord, sanitizeResults, summarizeRecord,
  readSave, writeSave, SAVE_KEY, type StorageLike,
} from '../src/game/save';
import { FIXED_STEP, TICK_RATE } from '../src/game/contracts/timing';
import { createRacerRegistry } from '../src/game/contracts/identity';

const FIELDS = [4, 20, 50, 100] as const;
const setup = (overrides: Partial<RaceSetup> = {}): RaceSetup => ({
  mode: 'quick', course: 'ridge', loadout: { rider: 'rivet', capsule: 'iron' },
  difficulty: 'racer', customPhysics: false, fieldSize: 4, ...overrides,
});

/* -------------------------------------------------------------------------- */
/* Roster construction                                                         */
/* -------------------------------------------------------------------------- */

test('roster: the four-racer field reproduces the legacy definitions exactly', () => {
  const roster = buildRoster(4, { rider: 'rivet', capsule: 'iron' });
  assert.equal(roster.length, 4);
  assert.deepEqual(roster.map((entry) => entry.id), [0, 1, 2, 3]);
  assert.deepEqual(roster.map((entry) => entry.homeLane), RACER_DEFINITIONS.map((d) => d.homeLane));
  assert.deepEqual(roster.map((entry) => entry.color), RACER_DEFINITIONS.map((d) => d.color));
  assert.deepEqual(roster.map((entry) => entry.name), RACER_DEFINITIONS.map((d) => d.name));
  assert.deepEqual(buildRosterLoadouts(4, { rider: 'rivet', capsule: 'iron' }), opponentLoadouts({ rider: 'rivet', capsule: 'iron' }));
});

test('roster: every supported field has unique dense IDs and a stable player at 0', () => {
  for (const fieldSize of FIELDS) {
    const roster = createRacerRegistry(buildRoster(fieldSize, { rider: 'nix', capsule: 'siege' }).map((entry) => entry.id));
    assert.equal(roster.size, fieldSize, `field ${fieldSize}`);
    assert.equal(roster.idAt(0), PLAYER_ID);
    assert.equal(roster.indexOf(PLAYER_ID), 0);
    for (let id = 0; id < fieldSize; id++) assert.ok(roster.has(id), `id ${id} present in field ${fieldSize}`);
    const ids = buildRoster(fieldSize, { rider: 'nix', capsule: 'siege' }).map((entry) => entry.id);
    assert.equal(new Set(ids).size, fieldSize, `ids unique at ${fieldSize}`);
  }
});

test('roster: large fields keep lanes valid, names unique and paces bounded', () => {
  for (const fieldSize of [20, 50, 100]) {
    const roster = buildRoster(fieldSize, { rider: 'grub', capsule: 'iron' });
    assert.equal(new Set(roster.map((entry) => entry.name)).size, fieldSize, `names unique at ${fieldSize}`);
    for (const entry of roster) {
      assert.ok(entry.homeLane >= 0 && entry.homeLane <= 3);
      assert.ok(entry.pace >= 0.97 && entry.pace <= 1.03, `pace bounded at field ${fieldSize}: ${entry.pace}`);
      assert.equal(entry.id === PLAYER_ID, entry.isPlayer);
    }
    assert.equal(roster[0].homeLane, RACER_DEFINITIONS[0].homeLane, 'player keeps lane 2');
  }
});

test('roster: clampFieldSize repairs hostile input to supported sizes', () => {
  assert.equal(clampFieldSize(NaN), 4);
  assert.equal(clampFieldSize(-5), 4);
  assert.equal(clampFieldSize(9999), 100);
  assert.equal(clampFieldSize(20.9), 20);
});

test('roster: qualify rule — required above four, disabled at four', () => {
  assert.deepEqual(qualifyingForField(4), { enabled: false, required: false });
  for (const fieldSize of [20, 50, 100]) {
    assert.deepEqual(qualifyingForField(fieldSize), { enabled: true, required: true }, `field ${fieldSize}`);
  }
});

/* -------------------------------------------------------------------------- */
/* No aliasing at 32 / 33 / 64 / 100                                           */
/* -------------------------------------------------------------------------- */

test('scale: pair keys are collision-free for every pair in a 100-racer field', () => {
  const keys = new Set<number>();
  let pairs = 0;
  for (let a = 0; a < 100; a++) {
    for (let b = a + 1; b < 100; b++) {
      const key = pairKey(a, b);
      assert.equal(key, pairKey(b, a), 'unordered key');
      assert.ok(Number.isSafeInteger(key));
      keys.add(key);
      pairs++;
    }
  }
  assert.equal(keys.size, pairs, 'no pair-key aliasing across 4,950 pairs');
  // Spot checks at the acceptance boundaries.
  assert.notEqual(pairKey(31, 32), pairKey(0, 1));
  assert.notEqual(pairKey(32, 33), pairKey(1, 33));
  assert.notEqual(pairKey(63, 64), pairKey(0, 64));
});

test('scale: obstacle hits use a Set ledger — racer 33 never aliases racer 1', () => {
  // The old engine did `hitMask |= 1 << racerId`; in JavaScript `1 << 33 === 1 << 1`,
  // so racer 33 would light up racer 1's bit. The ledger must not reproduce that.
  assert.equal(1 << 33, 1 << 1, 'documents the legacy wrap the ticket forbids');
  const obstacle = {};
  recordObstacleHit(obstacle, 33);
  assert.ok(obstacleHitBy(obstacle, 33));
  assert.ok(!obstacleHitBy(obstacle, 1), 'racer 1 must not be marked by racer 33');
  for (const id of [31, 32, 33, 63, 64, 99]) recordObstacleHit(obstacle, id);
  assert.equal(obstacleHitCount(obstacle), 6, 'distinct IDs only — the earlier 33 counts once');
  for (const id of [31, 32, 33, 63, 64, 99]) assert.ok(obstacleHitBy(obstacle, id), `id ${id}`);
  assert.ok(!obstacleHitBy(obstacle, 0));
});

test('scale: the fixed 120 Hz tick rate is untouched (staggering never slows physics)', () => {
  assert.equal(TICK_RATE, 120);
  assert.equal(FIXED_STEP, 1 / 120);
});

/* -------------------------------------------------------------------------- */
/* Legacy compatibility — four-racer formulas stay exact                       */
/* -------------------------------------------------------------------------- */

test('legacy: finish bonus matches (4 - position) * 500 at four racers', () => {
  const legacy = [1, 2, 3, 4].map((position) => finishPositionBonus(position, 4));
  assert.deepEqual(legacy, [1500, 1000, 500, 0]);
});

test('scale: finish bonus stays bounded and non-negative at 100 racers', () => {
  const bonus = [1, 50, 99, 100].map((position) => finishPositionBonus(position, 100));
  assert.equal(bonus[0], 1500);
  assert.ok(bonus.every((value, index) => value >= 0 && (index === 0 || value <= bonus[index - 1])));
  assert.equal(bonus[3], 0);
});

test('legacy: cup points use the frozen [9, 6, 3, 1] table at four racers', () => {
  assert.deepEqual([1, 2, 3, 4].map((position) => roundPointsFor(position, true, 4)), [...CUP_POINTS]);
  assert.equal(roundPointsFor(1, false, 4), 0, 'DNF scores zero');
});

test('scale: cup points policy for large fields — top nine score 9..1, everyone else 0', () => {
  assert.equal(roundPointsFor(1, true, 100), 9);
  assert.equal(roundPointsFor(9, true, 100), 1);
  assert.equal(roundPointsFor(10, true, 100), 0);
  assert.equal(roundPointsFor(100, true, 100), 0);
  assert.equal(roundPointsFor(1, false, 100), 0);
});

test('legacy: launch fan and decision stagger match the original at four racers', () => {
  assert.equal(launchAngleOffset(0, 4), 0);
  assert.equal(launchAngleOffset(1, 4), -1.2);
  assert.equal(launchAngleOffset(2, 4), 0);
  assert.equal(launchAngleOffset(3, 4), 1.2);
  for (const id of [0, 1, 2, 3]) assert.equal(cpuDecisionStagger(id, 4), id * 0.023);
});

test('scale: launch fan and decision stagger are bounded at 100 racers', () => {
  for (let id = 0; id < 100; id++) {
    assert.ok(Math.abs(launchAngleOffset(id, 100)) <= 2.4, `launch offset bounded: ${launchAngleOffset(id, 100)}`);
    const stagger = cpuDecisionStagger(id, 100);
    assert.ok(stagger >= 0 && stagger < 0.3, `stagger bounded: ${stagger}`);
  }
  assert.equal(cpuDecisionStagger(PLAYER_ID, 100), 0);
  // Deterministic and identity-based — the same racer always lands in the same slot.
  assert.equal(cpuDecisionStagger(42, 100), cpuDecisionStagger(42, 100));
});

test('legacy: createRacers reproduces the original four-racer engine state', () => {
  const racers = createRacers();
  assert.equal(racers.length, 4);
  assert.deepEqual(racers.map((racer) => racer.name), ['YOU', 'GRUB', 'NIX', 'RIVET']);
  assert.deepEqual(racers.map((racer) => racer.homeLane ?? racer.lane), [2, 0, 1, 3]);
  for (const racer of racers) {
    assert.equal(racer.pace, 1, 'legacy pace is exactly 1');
    assert.equal(racer.x, START_X, 'legacy grid sits on the launch line');
    assert.equal(racer.nextDecision, 0.35 + racer.id * 0.11, 'legacy decision ramp');
  }
  assert.equal(racers.filter((racer) => racer.isPlayer).length, 1);
  assert.equal(racers.find((racer) => racer.isPlayer)?.id, PLAYER_ID);
});

test('legacy: with a config, four-racer names come from loadouts exactly as before', () => {
  const config = sessionConfig(createSession(setup()));
  const racers = createRacers(config);
  assert.deepEqual(racers.map((racer) => racer.name), ['RIVET', 'NIX', 'GRUB', 'SPROCKET']);
});

test('scale: createRacers builds a full 100-racer field with stacked grid rows', () => {
  const base = createSession(setup({ fieldSize: 100 }));
  const racers = createRacers(sessionConfig(base));
  assert.equal(racers.length, 100);
  assert.equal(new Set(racers.map((racer) => racer.id)).size, 100);
  assert.equal(racers.filter((racer) => racer.isPlayer).length, 1);
  // Row stacking only happens above four racers — legacy stays on the line.
  assert.equal(racers[0].x, START_X);
  assert.equal(racers[4].x, START_X - GRID_ROW_SPACING);
  assert.equal(racers[99].x, START_X - Math.floor(99 / 4) * GRID_ROW_SPACING);
  for (const racer of racers) assert.ok(racer.nextDecision <= 0.9, `initial decision bounded: ${racer.nextDecision}`);
  const legacy = createRacers(sessionConfig(createSession(setup({ fieldSize: 4 }))));
  assert.equal(legacy[3].x, START_X, 'four-racer grid unchanged');
});

/* -------------------------------------------------------------------------- */
/* RNG streams                                                                 */
/* -------------------------------------------------------------------------- */

test('rng: gameplay stream is deterministic and resets explicitly', () => {
  const a = createRng(1234);
  const first = Array.from({ length: 8 }, () => a.next());
  a.next(); a.next();
  a.reset();
  assert.deepEqual(Array.from({ length: 8 }, () => a.next()), first, 'reset() restores the creation seed');
  a.reset(7);
  const seededSeven = Array.from({ length: 8 }, () => a.next());
  const freshSeven = createRng(7);
  assert.deepEqual(seededSeven, Array.from({ length: 8 }, () => freshSeven.next()), 'reset(seed) is same-seed replay');
  const b = createRng(1234);
  assert.deepEqual(Array.from({ length: 8 }, () => b.next()), first, 'same seed, same sequence');
  const c = createRng(999);
  assert.notDeepEqual(Array.from({ length: 8 }, () => c.next()), first, 'different seed, different sequence');
});

test('rng: streams are independent — consuming one never perturbs the other', () => {
  const gameplay = createRng(42);
  const cosmetic = createRng(42);
  const cosmeticBefore = Array.from({ length: 4 }, () => cosmetic.next());
  cosmetic.reset(42);
  for (let i = 0; i < 100; i++) gameplay.next();
  assert.deepEqual(Array.from({ length: 4 }, () => cosmetic.next()), cosmeticBefore);
  assert.equal(typeof cosmeticSeed(), 'number');
  assert.ok(Number.isFinite(createRng(NaN).next()), 'hostile seeds are repaired');
});

/* -------------------------------------------------------------------------- */
/* Bounded HUD / results selection                                             */
/* -------------------------------------------------------------------------- */

const standingsOf = (count: number): RacerStanding[] => Array.from({ length: count }, (_, index) => ({
  id: index, name: index === 0 ? 'YOU' : `RACER ${index}`, color: rosterColor(index),
  position: index + 1, distance: 36000 - index * 40, lane: index % 4,
  finished: index < count - 1, recovering: false,
  finishTime: index < count - 1 ? 300 + index : null,
}));

test('hud: trackbar selection stays bounded and includes the player at 100 racers', () => {
  const standings = standingsOf(100);
  const pips = trackbarRacers(standings, PLAYER_ID);
  assert.ok(pips.length <= 12, `pip budget: ${pips.length}`);
  assert.ok(pips.some((entry) => entry.id === PLAYER_ID), 'player always drawn');
  const positions = pips.map((entry) => entry.position);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'ordered by position');
  assert.deepEqual(trackbarRacers(standingsOf(4), PLAYER_ID).length, 4, 'small fields pass through');
});

test('hud: results rows stay bounded, keep the player, and report the truncation', () => {
  const standings = standingsOf(100);
  const capped = resultRows(standings, PLAYER_ID, RESULTS_MAX_ROWS);
  assert.equal(capped.capped, true);
  assert.equal(capped.total, 100);
  assert.ok(capped.rows.length <= RESULTS_MAX_ROWS);
  assert.ok(capped.rows.some((entry) => entry.id === PLAYER_ID), 'player row kept');
  const small = resultRows(standingsOf(4), PLAYER_ID);
  assert.equal(small.capped, false);
  assert.equal(small.rows.length, 4);
});

/* -------------------------------------------------------------------------- */
/* Versioned summary policy for persisted standings                            */
/* -------------------------------------------------------------------------- */

const recordOf = (fieldSize: number): RunRecord => ({
  id: 'round-1', distance: 36000, topSpeed: 320, score: 9000, sheep: 2, explosions: 1, loops: 3,
  course: 'ridge', date: new Date().toISOString(), completed: true, sessionId: 'session-1',
  mode: 'tournament', round: 0, fieldSize, opponents: standingsOf(fieldSize),
});

test('summary: large results are truncated only through the explicit versioned policy', () => {
  const record = recordOf(100);
  const summarized = summarizeRecord(record);
  assert.ok(summarized.opponentsSummary, 'marker present');
  assert.equal(summarized.opponentsSummary?.policy, SUMMARY_POLICY_VERSION);
  assert.equal(summarized.opponentsSummary?.totalField, 100);
  assert.ok((summarized.opponents?.length ?? 0) <= RESULT_SUMMARY_POLICY.keepTop + 1);
  assert.ok(summarized.opponents?.some((entry) => entry.id === PLAYER_ID), 'player always persisted');
  // Idempotent: summarising twice changes nothing.
  assert.deepEqual(summarizeRecord(summarized), summarized);
  // Legacy four-racer records are never touched.
  const legacy = recordOf(4);
  assert.equal(summarizeRecord(legacy), legacy);
});

test('summary: hydration accepts a marked summary and rejects silent truncation', () => {
  const rounds: import('../src/game/types').CourseId[] = ['ridge'];
  const summarized = summarizeRecord(recordOf(100));
  const accepted = sanitizeRecord(summarized, 'session-1', rounds, 100);
  assert.ok(accepted, 'marked summary round-trips');
  assert.equal(accepted?.opponentsSummary?.policy, SUMMARY_POLICY_VERSION);

  const unmarked = { ...summarized, opponentsSummary: undefined };
  assert.equal(sanitizeRecord(unmarked, 'session-1', rounds, 100), null, 'unmarked short list is rejected');

  const unknownPolicy = { ...summarized, opponentsSummary: { ...summarized.opponentsSummary, policy: 999 } };
  assert.equal(sanitizeRecord(unknownPolicy, 'session-1', rounds, 100), null, 'unknown policy version is rejected');

  const full = recordOf(100);
  assert.ok(sanitizeRecord(full, 'session-1', rounds, 100), 'full list still validates');
  const legacy = sanitizeRecord(recordOf(4), 'session-1', rounds, 4);
  assert.ok(legacy, 'legacy four-racer records unaffected');
  assert.equal(legacy?.fieldSize, 4);

  // Summary without the player's row is structurally incomplete → rejected.
  const noPlayer = {
    ...summarized,
    opponents: (summarized.opponents ?? []).filter((entry) => entry.id !== PLAYER_ID),
    opponentsSummary: { ...(summarized.opponentsSummary ?? { policy: 1, totalField: 100, kept: 0 }), kept: (summarized.opponents?.length ?? 1) - 1 },
  };
  assert.equal(sanitizeRecord(noPlayer, 'session-1', rounds, 100), null);

  // Field-level reporting stays honest: dropped records are counted, never hidden.
  const batch = sanitizeResults([summarized, unmarked], 'session-1', rounds, 100);
  assert.equal(batch.results.length, 1, 'only the marked summary is kept');
  assert.equal(batch.dropped, 1, 'the unmarked short list is reported as dropped');
});

/* -------------------------------------------------------------------------- */
/* Tournament/session handling at scale                                        */
/* -------------------------------------------------------------------------- */

test('session: createSession carries the field size, roster and seed', () => {
  const session = createSession(setup({ fieldSize: 20 }));
  assert.equal(session.setup.fieldSize, 20);
  assert.equal(session.roster.length, 20);
  assert.ok(Number.isSafeInteger(session.seed));
  const config = sessionConfig(session);
  assert.equal(config.fieldSize, 20);
  assert.equal(config.roster.length, 20);
  assert.equal(config.seed, session.seed, 'same-seed replay uses the session seed');
});

test('session: cup standings scale to 20 racers with bounded points and places', () => {
  const base = createSession(setup({ mode: 'tournament', fieldSize: 20 }));
  const opponents = standingsOf(20);
  const record: RunRecord = { ...recordOf(20), sessionId: base.id };
  const session = { ...base, results: [record] };
  const table = cupStandings(session);
  assert.equal(table.length, 20);
  const playerRow = table.find((row) => row.id === PLAYER_ID);
  assert.ok(playerRow);
  assert.equal(playerRow?.points, roundPointsFor(1, true, 20));
  const positions = table.map((row) => row.points);
  assert.deepEqual(positions, [...positions].sort((a, b) => b - a), 'sorted by points');
  for (const row of table) {
    assert.ok(row.points >= 0 && row.points <= 9, `points bounded: ${row.points}`);
    assert.ok(row.lastPlace <= 21, 'DNF placeholder scales with the field');
  }
});


test('storage: large-field cup standings survive all round-boundary reloads', () => {
  for (const fieldSize of FIELDS) {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
    const base = createSession(setup({ mode: 'tournament', fieldSize }));
    for (let round = 0; round < base.rounds.length; round++) {
      const opponents = standingsOf(fieldSize).map((entry) => ({
        ...entry, position: ((entry.id + round * 7) % fieldSize) + 1,
      }));
      base.results.push({ ...recordOf(fieldSize), opponents, sessionId: base.id,
        round, course: base.rounds[round] });
      base.round = round;
      const phase = round === base.rounds.length - 1 ? 'cup-results' : 'round-results';
      const written = writeSave({ phase, draft: base.setup, session: base }, storage);
      assert.equal(written.ok, true);
      const stored = JSON.parse(values.get(SAVE_KEY)!);
      assert.equal(stored.session.results[round].opponents.length, fieldSize);
      const restored = readSave(storage);
      assert.ok(restored.session);
      assert.equal(restored.phase, phase);
      assert.deepEqual(cupStandings(restored.session!), cupStandings(base));
      const repeat = writeSave({ phase, draft: base.setup, session: base }, storage);
      assert.equal(repeat.skipped, true, 'complete storage stays idempotent');
    }
  }
});

test('summary: invalid markers on full lists are rejected, not erased', () => {
  const full = recordOf(100);
  const invalid = { ...full, opponentsSummary: { policy: 999, kept: 100, totalField: 100 } };
  assert.equal(sanitizeRecord(invalid, 'session-1', ['ridge'], 100), null);
});


test('storage: older summarized sessions surface a partial-standings warning', () => {
  const base = createSession(setup({ mode: 'tournament', fieldSize: 100 }));
  base.results = [summarizeRecord({ ...recordOf(100), sessionId: base.id })];
  const values = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  writeSave({ phase: 'round-results', draft: base.setup, session: base }, storage);
  const restored = readSave(storage);
  assert.equal(restored.session?.results.length, 1, 'do not invent rows or replay a committed round');
  assert.ok(restored.notices.some((notice) => notice.level === 'warning' && notice.text.includes('standings for this event are partial')));
});
