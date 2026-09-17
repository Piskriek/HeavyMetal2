/**
 * Focused recovery-contract tests for Part 4.1 (durable events and recovery).
 * Run with: node scripts/check.mjs   (tsc --noEmit, then node --import tsx --test)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUP_ROUNDS, createSession, cupStandings, resumeLabel, runRecordKey, sessionComplete,
  type RaceSession, type RaceSetup,
} from '../src/game/session';
import {
  SAVE_BACKUP_KEY, SAVE_KEY, SAVE_VERSION, readSave, recoverSession, sanitizeRoster, writeSave,
  type StorageLike,
} from '../src/game/save';
import { RACER_DEFINITIONS, type CourseId, type RunRecord } from '../src/game/types';
import { mergeRunRecord } from '../src/game/preferences';

class FakeStorage implements StorageLike {
  readonly map = new Map<string, string>();
  failWrites = false;
  constructor(seed: Record<string, string> = {}) { for (const [key, value] of Object.entries(seed)) this.map.set(key, value); }
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }
  removeItem(key: string) { this.map.delete(key); }
}

const setup = (mode: RaceSetup['mode'] = 'tournament', overrides: Partial<RaceSetup> = {}): RaceSetup => ({
  mode, course: mode === 'tournament' ? 'ridge' : 'boomtown', loadout: { rider: 'nix', capsule: 'springsteel' },
  difficulty: 'racer', customPhysics: false, ...overrides,
});

function finishRecord(session: RaceSession, round: number, playerPosition = 1): RunRecord {
  const course = session.rounds[round] as CourseId;
  // The player takes `playerPosition`; the rivals fill the remaining places in id order.
  const placements = new Map<number, number>([[0, playerPosition]]);
  let next = 1;
  for (const id of [1, 2, 3]) {
    if (next === playerPosition) next++;
    placements.set(id, next++);
  }
  const opponents = RACER_DEFINITIONS.map((definition) => {
    const position = placements.get(definition.id)!;
    return {
      id: definition.id, name: definition.name, color: definition.color, position,
      distance: 15000 - position * 12, lane: definition.homeLane, finished: true,
      recovering: false, finishTime: 400 + position * 3,
      loadout: { rider: 'rivet' as const, capsule: 'iron' as const },
    };
  });
  return {
    id: `${session.id}-${round}`, distance: 15000, topSpeed: 500, score: 9000, sheep: 1, explosions: 2, loops: 0,
    course, date: new Date().toISOString(), completed: true, trackLength: 15000, position: playerPosition,
    raceTime: 400 + playerPosition * 3, opponents, sessionId: session.id, mode: session.setup.mode, round,
    loadout: session.setup.loadout, difficulty: session.setup.difficulty, pickups: 1, shieldsUsed: 0, bumps: 2,
  };
}

function savedDocument(session: RaceSession, phase: string, revision = 1) {
  return JSON.stringify({ version: SAVE_VERSION, revision, savedAt: new Date().toISOString(), phase, draft: session.setup, session });
}

test('recovery: a completed cup hydrates as cup-results with every round intact', () => {
  const session = createSession(setup());
  for (let round = 0; round < CUP_ROUNDS.length; round++) session.results.push(finishRecord(session, round));
  const storage = new FakeStorage({ [SAVE_KEY]: savedDocument(session, 'racing') });
  const hydration = readSave(storage);
  assert.equal(hydration.source, 'primary');
  assert.equal(hydration.phase, 'cup-results');
  assert.equal(hydration.session?.results.length, 3);
  assert.equal(sessionComplete(hydration.session!), true);
  assert.equal(hydration.restartNotice, null);
});

test('recovery: an interrupted active round resumes at the grid and says so', () => {
  const session = createSession(setup());
  session.results.push(finishRecord(session, 0));
  session.round = 1;
  const storage = new FakeStorage({ [SAVE_KEY]: savedDocument(session, 'racing') });
  const hydration = readSave(storage);
  assert.equal(hydration.phase, 'grid');
  assert.equal(hydration.session?.round, 1);
  assert.equal(hydration.restartedRound, 1);
  assert.match(hydration.restartNotice ?? '', /Round 2 was interrupted before the finish/);
  assert.equal(hydration.session?.results.length, 1, 'the completed first round keeps its points');
});

test('recovery: a committed current round restores its results instead of a fresh race', () => {
  const session = createSession(setup());
  session.results.push(finishRecord(session, 0, 2));
  const hydration = readSave(new FakeStorage({ [SAVE_KEY]: savedDocument(session, 'round-results') }));
  assert.equal(hydration.phase, 'round-results');
  assert.equal(hydration.session?.results.length, 1);
  assert.equal(hydration.restartNotice, null);
  assert.equal(resumeLabel(hydration.session, hydration.phase), 'View Round Results');
});

test('recovery: a finished quick race hydrates as a results screen, not another race', () => {
  const session = createSession(setup('quick', { course: 'sheep' }));
  session.results.push(finishRecord(session, 0, 2));
  const hydration = readSave(new FakeStorage({ [SAVE_KEY]: savedDocument(session, 'racing') }));
  assert.equal(hydration.phase, 'cup-results');
  assert.equal(hydration.session?.results.length, 1);
  assert.equal(hydration.restartNotice, null);
  assert.equal(resumeLabel(hydration.session, hydration.phase), 'View Race Results');
});

test('recovery: an unfinished earlier round is never skipped and later results are kept', () => {
  const session = createSession(setup());
  const tampered = { ...session, round: 2, results: [finishRecord(session, 0), finishRecord(session, 2)] };
  const hydration = readSave(new FakeStorage({ [SAVE_KEY]: savedDocument(tampered, 'racing') }));
  assert.equal(hydration.session?.round, 1, 'the gap round blocks progression');
  assert.equal(hydration.phase, 'grid');
  assert.equal(hydration.session?.results.length, 2, 'later results are preserved, not deleted');
  assert.equal(hydration.restartedRound, 1);
});

test('recovery: duplicate and mismatched round results are ignored, never double-scored', () => {
  const session = createSession(setup());
  const record = finishRecord(session, 0);
  const foreign = { ...finishRecord(session, 1), sessionId: 'someone-elses-session' };
  const tampered = { ...session, results: [record, { ...record }, foreign] };
  const hydration = readSave(new FakeStorage({ [SAVE_KEY]: savedDocument(tampered, 'round-results') }));
  assert.equal(hydration.session?.results.length, 1);
  const table = cupStandings(hydration.session!);
  const player = table.find((row) => row.id === 0)!;
  assert.equal(player.points, 9, 'one first place is worth exactly nine points');
  const clean = cupStandings({ ...session, results: [record] }).find((row) => row.id === 0)!;
  assert.equal(player.points, clean.points);
  assert.equal(player.wins, clean.wins);
});

test('recovery: malformed loadout and roster fall back to canonical game data', () => {
  const session = createSession(setup());
  const tampered = { ...session, setup: { ...session.setup, loadout: { rider: 'dracula', capsule: 7 } }, roster: [{ rider: 'grub' }] };
  const hydration = readSave(new FakeStorage({ [SAVE_KEY]: savedDocument(tampered, 'grid') }));
  assert.equal(hydration.session?.setup.loadout.rider, 'rivet');
  assert.equal(hydration.session?.setup.loadout.capsule, 'iron');
  assert.deepEqual(hydration.session?.roster.map((loadout) => loadout.rider), ['rivet', 'nix', 'grub', 'sprocket']);
  assert.deepEqual(sanitizeRoster(session.roster, session.setup), { roster: session.roster, repaired: false });
});

test('recovery: an impossible cup order is restored to the Scrapdome order', () => {
  const session = createSession(setup());
  const tampered = { ...session, rounds: ['sheep', 'ridge', 'boomtown'] };
  const hydration = readSave(new FakeStorage({ [SAVE_KEY]: savedDocument(tampered, 'grid') }));
  assert.deepEqual(hydration.session?.rounds, CUP_ROUNDS);
  assert.ok(hydration.notices.some((notice) => /official three-round order/.test(notice.text)));
});

test('recovery: out-of-range round indices clamp instead of breaking the event', () => {
  const session = createSession(setup());
  const hydration = readSave(new FakeStorage({ [SAVE_KEY]: savedDocument({ ...session, round: 99 }, 'racing') }));
  assert.equal(hydration.session?.round, 0);
  assert.equal(hydration.phase, 'grid');
});

test('recovery: corrupt primary falls back to the previous good copy and says so', () => {
  const session = createSession(setup('quick', { course: 'ridge' }));
  const storage = new FakeStorage({ [SAVE_KEY]: '{"version":1,"revision":2,"phase":', [SAVE_BACKUP_KEY]: savedDocument(session, 'grid', 1) });
  const hydration = readSave(storage);
  assert.equal(hydration.source, 'backup');
  assert.equal(hydration.session?.id, session.id);
  assert.ok(hydration.notices.some((notice) => /previous good copy/.test(notice.text)));
});

test('recovery: a newer schema is left untouched and reported, never overwritten', () => {
  const future = JSON.stringify({ version: SAVE_VERSION + 1, revision: 9, savedAt: new Date().toISOString(), phase: 'grid', session: {} });
  const storage = new FakeStorage({ [SAVE_KEY]: future });
  const hydration = readSave(storage);
  assert.equal(hydration.source, 'unsupported');
  assert.equal(hydration.session, null);
  assert.equal(storage.getItem(SAVE_KEY), future, 'unknown data is preserved');
});

test('recovery: the legacy setup key migrates into the durable draft', () => {
  const legacy = JSON.stringify({ mode: 'quick', course: 'boomtown', loadout: { rider: 'grub', capsule: 'siege' }, difficulty: 'veteran', customPhysics: true });
  const hydration = readSave(new FakeStorage({ 'goblin-rally-setup-v2': legacy }));
  assert.equal(hydration.source, 'legacy');
  assert.deepEqual(hydration.draft, { mode: 'quick', course: 'boomtown', loadout: { rider: 'grub', capsule: 'siege' }, difficulty: 'veteran', customPhysics: true });
});

test('write: identical payloads are not rewritten and revisions stay monotonic', () => {
  const storage = new FakeStorage();
  const session = createSession(setup());
  const draft = session.setup;
  const first = writeSave({ phase: 'grid', draft, session }, storage);
  assert.equal(first.ok, true);
  assert.equal(first.skipped, false);
  assert.equal(first.document?.revision, 1);
  const second = writeSave({ phase: 'grid', draft, session }, storage);
  assert.equal(second.skipped, true);
  assert.equal(second.document?.revision, 1);
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)!).revision, 1);
  const third = writeSave({ phase: 'grid', draft, session: { ...session, round: 1 } }, storage);
  assert.equal(third.skipped, false);
  assert.equal(third.document?.revision, 2);
});

test('write: the previous valid document is preserved in the backup slot', () => {
  const storage = new FakeStorage();
  const session = createSession(setup());
  writeSave({ phase: 'grid', draft: session.setup, session }, storage);
  const first = storage.getItem(SAVE_KEY)!;
  writeSave({ phase: 'racing', draft: session.setup, session }, storage);
  assert.equal(storage.getItem(SAVE_BACKUP_KEY), first);
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)!).phase, 'racing');
});

test('write: a denied or full storage reports failure without throwing or losing data', () => {
  const session = createSession(setup());
  const storage = new FakeStorage();
  writeSave({ phase: 'grid', draft: session.setup, session }, storage);
  const before = storage.getItem(SAVE_KEY);
  storage.failWrites = true;
  const result = writeSave({ phase: 'racing', draft: session.setup, session }, storage);
  assert.equal(result.ok, false);
  assert.ok(result.error && /could not be saved/.test(result.error));
  assert.equal(storage.getItem(SAVE_KEY), before, 'the previous document survives a failed write');
  const denied = readSave(null);
  assert.equal(denied.storageBlocked, true);
  assert.equal(denied.session, null);
});

test('write: a round commit is one atomic document carrying phase and result together', () => {
  const storage = new FakeStorage();
  const session = createSession(setup());
  writeSave({ phase: 'grid', draft: session.setup, session }, storage);
  const committed = { ...session, results: [finishRecord(session, 0)] };
  writeSave({ phase: 'round-results', draft: session.setup, session: committed }, storage);
  const stored = JSON.parse(storage.getItem(SAVE_KEY)!);
  assert.equal(stored.phase, 'round-results');
  assert.equal(stored.session.results.length, 1);
  const hydration = readSave(storage);
  assert.equal(hydration.phase, 'round-results');
  assert.equal(cupStandings(hydration.session!).find((row) => row.id === 0)!.points, 9);
});

test('records: merge replaces the same session round instead of duplicating it', () => {
  const session = createSession(setup('quick', { course: 'ridge' }));
  const record = finishRecord(session, 0);
  const once = mergeRunRecord([], record);
  const twice = mergeRunRecord(once, { ...record, score: record.score + 1 });
  assert.equal(twice.length, 1);
  assert.equal(twice[0].score, record.score + 1);
  assert.equal(runRecordKey(record), `${session.id}:0`);
  assert.notEqual(runRecordKey({ ...record, sessionId: 'other-session' }), runRecordKey(record));
});

test('recovery: an event with no usable rounds is rejected instead of invented', () => {
  const session = createSession(setup());
  assert.equal(recoverSession({ ...session, rounds: [] }, 'grid'), null);
  assert.equal(recoverSession({ ...session, rounds: ['ridge', 'ridge', 'ridge'] }, 'grid'), null);
  assert.equal(recoverSession({ ...session, id: '' }, 'grid'), null);
});
