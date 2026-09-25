/**
 * Durable, versioned event persistence for Goblin Rally.
 *
 * Contract (see docs/PERSISTENCE.md):
 * - One document holds the draft setup and/or the active event, its fixed roster,
 *   its committed round results and an explicit lifecycle phase.
 * - Writes are atomic per key (`setItem` stores the whole document or nothing) and
 *   idempotent (identical payloads are not rewritten). The previous valid document is
 *   kept in a backup slot so a corrupt or interrupted primary is never fatal.
 * - Reads never throw and never trust stored data: every field is validated and
 *   repaired from canonical game data, or dropped with a notice.
 * - Round-boundary recovery only. An unfinished round resumes at that round's
 *   starting grid and is explicitly announced as a restart; committed rounds are
 *   never re-raced for new points.
 */
import { COURSES, RACER_DEFINITIONS, type CourseId, type OpponentsSummary, type RacerStanding, type RunRecord } from './types';
import {
  CUP_ROUNDS, DEFAULT_SETUP, isSessionPhase,
  type Difficulty, type RaceMode, type RaceSession, type RaceSetup, type SessionPhase,
} from './session';
import { DEFAULT_LOADOUT, isCapsule, isRider, type CapsuleId, type Loadout, type RiderId } from './loadouts';
// T02: field sizes, seeds and the summary policy for persisted standings.
import { DEFAULT_SEED, isFieldSize } from './contracts/config';
import { PLAYER_ID, buildRosterLoadouts, rosterColor } from './roster';

export const SAVE_VERSION = 1;

/* -------------------------------------------------------------------------- */
/* T02 — explicit versioned summary policy                                     */
/* -------------------------------------------------------------------------- */

/**
 * Truncation only ever happens here, under an explicit, versioned policy: large
 * fields persist their top finishers plus the local player's row, stamped with
 * `opponentsSummary`. A persisted record whose standings are shorter than the field
 * *without* a recognisable marker is rejected by the sanitizer — standings are never
 * silently discarded, and hydration never guesses what a partial list means.
 */
export const SUMMARY_POLICY_VERSION = 1;
export const RESULT_SUMMARY_POLICY = { version: SUMMARY_POLICY_VERSION, keepTop: 12 } as const;

/** Idempotent: an already-summarised record is returned untouched. */
export function summarizeRecord(record: RunRecord): RunRecord {
  const opponents = record.opponents;
  if (!opponents || record.opponentsSummary || opponents.length <= RESULT_SUMMARY_POLICY.keepTop + 1) return record;
  const player = opponents.find((entry) => entry.id === PLAYER_ID);
  // Defensive: never produce a summary our own sanitizer would reject (player row
  // required). If the player is somehow absent, persist the full list instead.
  if (!player) return record;
  const sorted = [...opponents].sort((a, b) => a.position - b.position);
  const rows = sorted.slice(0, RESULT_SUMMARY_POLICY.keepTop);
  if (!rows.some((entry) => entry.id === PLAYER_ID)) rows.push(player);
  rows.sort((a, b) => a.position - b.position);
  return {
    ...record,
    opponents: rows.map((entry) => ({ ...entry })),
    opponentsSummary: {
      policy: SUMMARY_POLICY_VERSION,
      totalField: record.fieldSize ?? opponents.length,
      kept: rows.length,
    },
  };
}
export const SAVE_KEY = 'goblin-rally-session-v1';
export const SAVE_BACKUP_KEY = 'goblin-rally-session-v1-backup';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PersistedSave {
  version: number;
  revision: number;
  savedAt: string;
  phase: SessionPhase;
  draft: RaceSetup;
  session: RaceSession | null;
}

export type SaveNoticeLevel = 'info' | 'warning';
export interface SaveNotice {
  level: SaveNoticeLevel;
  text: string;
}

export interface Hydration {
  phase: SessionPhase;
  draft: RaceSetup;
  session: RaceSession | null;
  revision: number;
  /** Repairs, ignored duplicates or blocked storage, in plain language. */
  notices: SaveNotice[];
  source: 'primary' | 'backup' | 'legacy' | 'empty' | 'unreadable' | 'unsupported';
  /** Round index that must be raced again because it was never committed. */
  restartedRound: number | null;
  /** Explicit wording for the interrupted-round restart, shown on the grid. */
  restartNotice: string | null;
  /** True when this browser refuses writes, so nothing can be promised. */
  storageBlocked: boolean;
}

export interface WriteResult {
  ok: boolean;
  document: PersistedSave | null;
  skipped: boolean;
  error?: string;
}

const SAVE_ERROR = 'Progress could not be saved on this device. Your current event stays playable in this tab.';
const DENIED_ERROR = 'This browser is blocking local storage, so this event cannot be saved. Keep the tab open to finish it.';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isInt = (value: unknown): value is number => isFiniteNumber(value) && Number.isInteger(value);
const clampInt = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));
const COURSE_IDS = COURSES.map((course) => course.id);
const DIFFICULTIES: readonly Difficulty[] = ['rookie', 'racer', 'veteran'];
const isCourse = (value: unknown): value is CourseId => COURSE_IDS.includes(value as CourseId);

export function resolveStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    return storage && typeof storage.getItem === 'function' ? storage : null;
  } catch { return null; }
}

export function storageAvailable(storage: StorageLike | null = resolveStorage()): boolean {
  if (!storage) return false;
  const probe = 'goblin-rally-probe';
  try {
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch { return false; }
}

/* -------------------------------------------------------------------------- */
/* Field-level validation                                                     */
/* -------------------------------------------------------------------------- */

export function sanitizeSetup(raw: unknown, fallbackCourse: CourseId): RaceSetup | null {
  if (!isPlainObject(raw)) return null;
  const mode: RaceMode | null = raw.mode === 'tournament' ? 'tournament' : raw.mode === 'quick' ? 'quick' : null;
  if (!mode) return null;
  const loadoutRaw = isPlainObject(raw.loadout) ? raw.loadout : null;
  const rider: RiderId = loadoutRaw && isRider(loadoutRaw.rider) ? loadoutRaw.rider : DEFAULT_LOADOUT.rider;
  const capsule: CapsuleId = loadoutRaw && isCapsule(loadoutRaw.capsule) ? loadoutRaw.capsule : DEFAULT_LOADOUT.capsule;
  const difficulty: Difficulty = DIFFICULTIES.includes(raw.difficulty as Difficulty) ? raw.difficulty as Difficulty : 'racer';
  return {
    mode,
    course: isCourse(raw.course) ? raw.course : fallbackCourse,
    loadout: { rider, capsule },
    difficulty,
    customPhysics: mode === 'quick' && raw.customPhysics === true,
    fieldSize: isFieldSize(raw.fieldSize) ? raw.fieldSize : 4,
  };
}

export function sanitizeRounds(raw: unknown): CourseId[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  if (!raw.every(isCourse)) return null;
  const rounds = raw as CourseId[];
  return rounds.every((id, index) => rounds.indexOf(id) === index) ? [...rounds] : null;
}

/** The roster is fully derived data; keep the player first and the CPUs deterministic. */
export function sanitizeRoster(raw: unknown, setup: RaceSetup): { roster: Loadout[]; repaired: boolean } {
  const fieldSize = setup.fieldSize ?? 4;
  const derived = buildRosterLoadouts(fieldSize, setup.loadout);
  const valid = (value: unknown): value is Loadout => isPlainObject(value) && isRider(value.rider) && isCapsule(value.capsule);
  if (!Array.isArray(raw) || raw.length !== derived.length || !raw.every(valid)) return { roster: derived, repaired: true };
  if (fieldSize <= 4) {
    // Legacy strictness at four racers: unique riders, player first, signature capsules.
    const riders = raw.map((loadout) => loadout.rider);
    if (new Set(riders).size !== riders.length || riders[0] !== setup.loadout.rider
      || raw.some((loadout, index) => loadout.capsule !== derived[index].capsule)) return { roster: derived, repaired: true };
  } else if (raw[0].rider !== setup.loadout.rider || raw[0].capsule !== setup.loadout.capsule) {
    // Large fields cycle rider/capsule combinations, so only the player slot is pinned.
    return { roster: derived, repaired: true };
  }
  return { roster: raw.map((loadout) => ({ rider: loadout.rider, capsule: loadout.capsule })), repaired: false };
}

function sanitizeStanding(raw: unknown, fieldSize: number): RacerStanding | null {
  if (!isPlainObject(raw)) return null;
  const id = raw.id;
  if (!isInt(id) || id < 0 || id >= fieldSize) return null;
  const fallbackName = RACER_DEFINITIONS[id]?.name ?? `RACER ${id}`;
  const fallbackColor = rosterColor(id);
  if (!isInt(raw.position) || raw.position < 1 || raw.position > fieldSize) return null;
  if (!isFiniteNumber(raw.distance) || !isInt(raw.lane) || raw.lane < 0 || raw.lane > 3) return null;
  if (typeof raw.finished !== 'boolean' || typeof raw.recovering !== 'boolean') return null;
  if (raw.finishTime !== null && !isFiniteNumber(raw.finishTime)) return null;
  const loadoutRaw = isPlainObject(raw.loadout) ? raw.loadout : null;
  const loadout: Loadout = {
    rider: loadoutRaw && isRider(loadoutRaw.rider) ? loadoutRaw.rider : DEFAULT_LOADOUT.rider,
    capsule: loadoutRaw && isCapsule(loadoutRaw.capsule) ? loadoutRaw.capsule : DEFAULT_LOADOUT.capsule,
  };
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 24) : fallbackName,
    color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : fallbackColor,
    position: raw.position,
    distance: raw.distance,
    lane: raw.lane,
    finished: raw.finished,
    recovering: raw.recovering,
    finishTime: raw.finishTime === null ? null : raw.finishTime as number,
    loadout,
    // P11: the split place survives a reload when it is a real place in this field.
    ...(isInt(raw.splitPosition) && raw.splitPosition >= 1 && raw.splitPosition <= fieldSize ? { splitPosition: raw.splitPosition } : {}),
  };
}

function sanitizeSummaryMarker(raw: unknown, fieldSize: number): OpponentsSummary | null {
  if (!isPlainObject(raw)) return null;
  // An unknown policy version is not interpretable — refuse rather than guess.
  if (raw.policy !== SUMMARY_POLICY_VERSION) return null;
  if (!isInt(raw.totalField) || raw.totalField !== fieldSize) return null;
  if (!isInt(raw.kept) || raw.kept < 2 || raw.kept > fieldSize) return null;
  return { policy: SUMMARY_POLICY_VERSION, totalField: fieldSize, kept: raw.kept };
}

/**
 * Validates a persisted standings list.
 *
 * A full list must be dense and complete: IDs 0..fieldSize-1 and a permutation of
 * places 1..fieldSize. A shorter list is only accepted when `rawMarker` is a
 * recognised summary policy marker that matches the field size — an unmarked short
 * list is silent truncation and is rejected.
 */
function sanitizeOpponents(raw: unknown, fieldSize: number, rawMarker: unknown): RacerStanding[] | null {
  if (!Array.isArray(raw)) return null;
  const summary = sanitizeSummaryMarker(rawMarker, fieldSize);
  if (rawMarker !== undefined && !summary) return null;
  if (raw.length > fieldSize) return null;
  if (summary) {
    if (raw.length !== summary.kept) return null;
  } else if (raw.length !== fieldSize) {
    return null;
  }
  const standings = raw.map((entry) => sanitizeStanding(entry, fieldSize));
  if (standings.some((standing) => standing === null)) return null;
  const list = standings as RacerStanding[];
  const ids = list.map((standing) => standing.id);
  const positions = list.map((standing) => standing.position);
  if (new Set(ids).size !== ids.length) return null;
  if (summary) {
    // Marked summary: the local player's row is mandatory and places stay in range.
    if (!list.some((standing) => standing.id === PLAYER_ID)) return null;
    if (new Set(positions).size !== positions.length) return null;
    if (positions.some((position) => position < 1 || position > fieldSize)) return null;
  } else {
    // Full list: dense IDs and a complete permutation of places 1..fieldSize.
    const sortedIds = [...ids].sort((a, b) => a - b);
    const sortedPositions = [...positions].sort((a, b) => a - b);
    if (sortedIds.some((id, index) => id !== index)) return null;
    if (sortedPositions.some((position, index) => position !== index + 1)) return null;
  }
  return list.map((standing) => ({ ...standing })).sort((a, b) => a.position - b.position);
}

/** One committed round. Anything structurally impossible is rejected, never invented. */
export function sanitizeRecord(raw: unknown, sessionId: string, rounds: CourseId[], fieldSize: number): RunRecord | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.sessionId !== 'string' || raw.sessionId !== sessionId) return null;
  if (!isInt(raw.round) || raw.round < 0 || raw.round >= rounds.length) return null;
  if (raw.course !== rounds[raw.round]) return null;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.date !== 'string' || Number.isNaN(Date.parse(raw.date))) return null;
  if (typeof raw.completed !== 'boolean') return null;
  if (!isFiniteNumber(raw.distance) || !isFiniteNumber(raw.score) || !isFiniteNumber(raw.topSpeed)) return null;
  const opponents = sanitizeOpponents(raw.opponents, fieldSize, raw.opponentsSummary);
  if (!opponents) return null;
  const player = opponents.find((standing) => standing.id === PLAYER_ID)!;
  const counter = (value: unknown) => isFiniteNumber(value) && value >= 0 ? Math.round(value) : 0;
  const optionalNumber = (value: unknown) => isFiniteNumber(value) ? value : undefined;
  const mode = raw.mode === 'practice' || raw.mode === 'quick' || raw.mode === 'tournament' ? raw.mode : undefined;
  const difficulty = DIFFICULTIES.includes(raw.difficulty as Difficulty) ? raw.difficulty as Difficulty : undefined;
  const loadoutRaw = isPlainObject(raw.loadout) ? raw.loadout : null;
  const loadout: Loadout | undefined = loadoutRaw && isRider(loadoutRaw.rider) && isCapsule(loadoutRaw.capsule)
    ? { rider: loadoutRaw.rider, capsule: loadoutRaw.capsule } : undefined;
  return {
    id: raw.id,
    distance: raw.distance,
    topSpeed: raw.topSpeed,
    score: raw.score,
    sheep: counter(raw.sheep),
    explosions: counter(raw.explosions),
    loops: counter(raw.loops),
    course: rounds[raw.round],
    date: raw.date,
    completed: raw.completed,
    trackLength: optionalNumber(raw.trackLength),
    weight: optionalNumber(raw.weight),
    launchSpeed: optionalNumber(raw.launchSpeed),
    position: player.position,
    bumps: counter(raw.bumps),
    raceTime: optionalNumber(raw.raceTime),
    opponents,
    sessionId,
    mode,
    round: raw.round,
    loadout,
    difficulty,
    pickups: counter(raw.pickups),
    shieldsUsed: counter(raw.shieldsUsed),
    fieldSize,
    opponentsSummary: raw.opponentsSummary !== undefined ? sanitizeSummaryMarker(raw.opponentsSummary, fieldSize) ?? undefined : undefined,
  };
}

export function sanitizeResults(raw: unknown, sessionId: string, rounds: CourseId[], fieldSize: number): { results: RunRecord[]; dropped: number; duplicates: number } {
  if (!Array.isArray(raw)) return { results: [], dropped: 0, duplicates: 0 };
  const seen = new Set<number>();
  const results: RunRecord[] = [];
  let dropped = 0;
  let duplicates = 0;
  for (const entry of raw) {
    const record = sanitizeRecord(entry, sessionId, rounds, fieldSize);
    if (!record) { dropped++; continue; }
    if (seen.has(record.round!)) { duplicates++; continue; }
    seen.add(record.round!);
    results.push(record);
  }
  results.sort((a, b) => a.round! - b.round!);
  return { results, dropped, duplicates };
}

/* -------------------------------------------------------------------------- */
/* Document validation and phase recovery                                     */
/* -------------------------------------------------------------------------- */

export interface Recovery {
  session: RaceSession;
  phase: SessionPhase;
  restartedRound: number | null;
  restartNotice: string | null;
  notices: SaveNotice[];
}

/**
 * Canonical recovery rules, in priority order:
 * 1. A complete event hydrates as `cup-results`.
 * 2. The current round being committed hydrates as `round-results`.
 * 3. Any earlier unfinished round blocks progression: work resumes at that round's grid.
 * 4. An unfinished round that was already racing restarts at the starting grid.
 */
export function recoverSession(raw: unknown, requestedPhase: SessionPhase): Recovery | null {
  if (!isPlainObject(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  const notices: SaveNotice[] = [];
  const rawRounds = sanitizeRounds(raw.rounds);
  if (!rawRounds) return null;

  const mode: RaceMode = isPlainObject(raw.setup) && raw.setup.mode === 'tournament' ? 'tournament' : 'quick';
  const tournament = mode === 'tournament';
  let rounds = rawRounds;
  if (tournament) {
    const canonical = CUP_ROUNDS.join() === rounds.join();
    if (!canonical) {
      notices.push({ level: 'warning', text: 'The cup race order in the save file was not the Scrapdome order. The official three-round order was restored.' });
      rounds = [...CUP_ROUNDS];
    }
  } else if (rounds.length !== 1) {
    notices.push({ level: 'warning', text: 'The saved event had more than one course selected. The first course was kept.' });
    rounds = [rounds[0]];
  }

  const rawSetup = isPlainObject(raw.setup) ? raw.setup : null;
  const setup = sanitizeSetup(raw.setup, rounds[0]);
  if (!setup) return null;
  setup.customPhysics = !tournament && setup.customPhysics;
  const loadoutRaw = rawSetup && isPlainObject(rawSetup.loadout) ? rawSetup.loadout : null;
  if (!loadoutRaw || !isRider(loadoutRaw.rider) || !isCapsule(loadoutRaw.capsule)) {
    notices.push({ level: 'warning', text: 'The saved rider or capsule was unreadable, so the default Rustbucket build was loaded.' });
  }
  const courseUsable = !!rawSetup && isCourse(rawSetup.course);
  if (!courseUsable) {
    notices.push({ level: 'warning', text: 'The saved course selection was unreadable and was rebuilt from the event course list.' });
  } else if (!tournament && rawSetup.course !== rounds[0]) {
    notices.push({ level: 'info', text: 'The saved course selection disagreed with the event course list, so the event course was used.' });
  }
  // For a cup the setup course is only a fallback; the round list always decides the track.
  if (!tournament || !courseUsable) setup.course = rounds[0];

  const { roster, repaired: rosterRepaired } = sanitizeRoster(raw.roster, setup);
  if (rosterRepaired) notices.push({ level: 'info', text: 'The rival lineup was rebuilt from the fixed event roster.' });

  const seed = Number.isSafeInteger(raw.seed) ? raw.seed as number : DEFAULT_SEED;
  const { results, dropped, duplicates } = sanitizeResults(raw.results, raw.id, rounds, setup.fieldSize);
  if (dropped) notices.push({ level: 'warning', text: `${dropped} saved round result${dropped === 1 ? '' : 's'} could not be validated and ${dropped === 1 ? 'was' : 'were'} set aside. That round must be raced again.` });
  if (duplicates) notices.push({ level: 'warning', text: `${duplicates} duplicate round result${duplicates === 1 ? '' : 's'} were ignored so no points are awarded twice.` });
  if (results.some((record) => record.opponentsSummary)) {
    notices.push({ level: 'warning', text: 'This older save contains summarized results. Missing racer rows cannot be recovered; standings for this event are partial.' });
  }

  const rawRound = isInt(raw.round) ? raw.round : 0;
  let round = clampInt(rawRound, 0, rounds.length - 1);
  const committed = (index: number) => results.some((record) => record.round === index);
  const firstOpen = rounds.findIndex((_, index) => !committed(index));
  const complete = firstOpen === -1;
  let phase: SessionPhase = requestedPhase;
  let restartedRound: number | null = null;

  let restartNotice: string | null = null;
  const roundName = tournament ? `Round ${round + 1}` : 'This race';
  if (complete) {
    if (round !== rounds.length - 1) round = rounds.length - 1;
    if (requestedPhase !== 'cup-results') notices.push({ level: 'info', text: 'Every round of this event was already committed. The final standings were restored.' });
    phase = 'cup-results';
  } else if (round > firstOpen) {
    round = firstOpen;
    phase = 'grid';
    restartedRound = firstOpen;
    restartNotice = `${tournament ? `Round ${round + 1}` : 'This race'} was never finished, so it restarts from the starting grid. Later rounds keep their saved results.`;
  } else if (committed(round)) {
    phase = 'round-results';
    if (requestedPhase !== 'round-results') notices.push({ level: 'info', text: 'The committed results for the current round were restored.' });
  } else {
    phase = 'grid';
    if (requestedPhase === 'racing') {
      restartedRound = round;
      restartNotice = `${roundName} was interrupted before the finish. It restarts from the starting grid.`;
    } else if (requestedPhase === 'round-results' || requestedPhase === 'cup-results') {
      restartedRound = round;
      restartNotice = `No valid result was saved for ${tournament ? `Round ${round + 1}` : 'the current race'}. It must be raced again.`;
    } else if (round !== rawRound) {
      restartedRound = round;
      restartNotice = `${roundName} restarts from the starting grid.`;
    }
  }

  return {
    session: { id: raw.id, setup, rounds, round, roster, results, seed },
    phase,
    restartedRound,
    restartNotice,
    notices,
  };
}

export function sanitizeDocument(raw: unknown): { save: PersistedSave; notices: SaveNotice[]; restartNotice: string | null; restartedRound: number | null } | 'unsupported' | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== SAVE_VERSION) return 'unsupported';
  if (typeof raw.savedAt !== 'string' || Number.isNaN(Date.parse(raw.savedAt))) return null;
  if (!isSessionPhase(raw.phase)) return null;
  const revision = isInt(raw.revision) && raw.revision >= 0 ? raw.revision : 0;
  const draft = sanitizeSetup(raw.draft, 'ridge') ?? { ...DEFAULT_SETUP, loadout: { ...DEFAULT_LOADOUT } };
  if (raw.phase === 'setup') {
    return { save: { version: SAVE_VERSION, revision, savedAt: raw.savedAt, phase: 'setup', draft, session: null }, notices: [], restartNotice: null, restartedRound: null };
  }
  const recovery = recoverSession(raw.session, raw.phase);
  if (!recovery) return null;
  return {
    save: { version: SAVE_VERSION, revision, savedAt: raw.savedAt, phase: recovery.phase, draft, session: recovery.session },
    notices: recovery.notices,
    restartNotice: recovery.restartNotice,
    restartedRound: recovery.restartedRound,
  };
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

function readDocument(storage: StorageLike, key: string): { value: unknown } | 'unsupported' | 'corrupt' | null {
  let text: string | null = null;
  try { text = storage.getItem(key); } catch { return null; }
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (isPlainObject(parsed) && parsed.version !== SAVE_VERSION) return 'unsupported';
    return { value: parsed };
  } catch { return 'corrupt'; }
}

/** Reads the durable event. Never throws; always returns a usable draft. */
export function readSave(storage: StorageLike | null = resolveStorage()): Hydration {
  const fallbackDraft = { ...DEFAULT_SETUP, loadout: { ...DEFAULT_LOADOUT } };
  const empty: Hydration = { phase: 'setup', draft: fallbackDraft, session: null, revision: 0, notices: [], source: 'empty', restartedRound: null, restartNotice: null, storageBlocked: false };
  if (!storage) return { ...empty, source: 'unreadable', storageBlocked: true, notices: [{ level: 'warning', text: DENIED_ERROR }] };

  const notices: SaveNotice[] = [];
  let sawUnsupported = false;
  for (const [key, source] of [[SAVE_KEY, 'primary'], [SAVE_BACKUP_KEY, 'backup']] as const) {
    const read = readDocument(storage, key);
    if (read === 'unsupported') { sawUnsupported = true; continue; }
    if (read === 'corrupt') {
      if (source === 'primary') notices.push({ level: 'warning', text: 'The saved event file was unreadable and has been left untouched.' });
      continue;
    }
    if (!read) continue;
    const sanitized = sanitizeDocument(read.value);
    if (sanitized === 'unsupported') { sawUnsupported = true; continue; }
    if (!sanitized) {
      if (source === 'primary') notices.push({ level: 'warning', text: 'The saved event file was unreadable and has been left untouched.' });
      continue;
    }
    if (source === 'backup') {
      // The restore outcome is the most useful line for the player, so it leads the notices.
      notices.unshift({ level: 'warning', text: 'The newest save was unreadable, so the previous good copy was restored.' });
    }
    return {
      phase: sanitized.save.phase, draft: sanitized.save.draft, session: sanitized.save.session,
      revision: sanitized.save.revision, notices: [...notices, ...sanitized.notices], source,
      restartedRound: sanitized.restartedRound, restartNotice: sanitized.restartNotice, storageBlocked: false,
    };
  }

  if (sawUnsupported) {
    return { ...empty, source: 'unsupported', notices: [...notices, { level: 'warning', text: 'This device holds progress from a newer version of Heavy Metal GP 2. It was left untouched.' }] };
  }

  const legacyDraft = readLegacyDraft(storage);
  if (legacyDraft) {
    return { phase: 'setup', draft: legacyDraft, session: null, revision: 0, source: 'legacy', restartedRound: null, restartNotice: null, storageBlocked: false, notices: [...notices, { level: 'info', text: 'Your previous setup selection was carried over.' }] };
  }

  if (!storageAvailable(storage)) return { ...empty, source: 'unreadable', storageBlocked: true, notices: [...notices, { level: 'warning', text: DENIED_ERROR }] };
  if (notices.length) return { ...empty, source: 'unreadable', notices };
  return empty;
}

function readLegacyDraft(storage: StorageLike): RaceSetup | null {
  try {
    const raw: unknown = JSON.parse(storage.getItem('goblin-rally-setup-v2') || 'null');
    return sanitizeSetup(raw, 'ridge');
  } catch { return null; }
}

/* -------------------------------------------------------------------------- */
/* Write                                                                      */
/* -------------------------------------------------------------------------- */

let lastRevision = 0;

function payloadOf(save: Pick<PersistedSave, 'phase' | 'draft' | 'session'>) {
  return JSON.stringify({ version: SAVE_VERSION, phase: save.phase, draft: save.draft, session: save.session });
}

/** Builds the exact document that will be stored. Exported for tests and inspection. */
export function buildSaveDocument(phase: SessionPhase, draft: RaceSetup, session: RaceSession | null, revision: number, savedAt = new Date().toISOString()): PersistedSave {
  return { version: SAVE_VERSION, revision, savedAt, phase: session ? phase : 'setup', draft, session };
}

/**
 * Atomic + idempotent write. The whole document is stored in one `setItem`, so a
 * failure leaves the previous document intact; an identical payload is not rewritten.
 */
export function writeSave(input: { phase: SessionPhase; draft: RaceSetup; session: RaceSession | null }, storage: StorageLike | null = resolveStorage()): WriteResult {
  const phase: SessionPhase = input.session ? (input.phase === 'setup' ? 'grid' : input.phase) : 'setup';
  if (!storage) return { ok: false, document: null, skipped: false, error: DENIED_ERROR };

  // An active/resumable event needs every placing, including zero-point ties and
  // prior-round histories. Summary v1 is only for the Hall of Chaos archive, never
  // the authoritative session used to reconstruct cup standings after a reload.
  const storedSession = input.session;
  const signature = payloadOf({ phase, draft: input.draft, session: storedSession });
  let existingRaw: string | null = null;
  try { existingRaw = storage.getItem(SAVE_KEY); } catch { existingRaw = null; }
  if (existingRaw) {
    try {
      const parsed: unknown = JSON.parse(existingRaw);
      if (isPlainObject(parsed) && parsed.version === SAVE_VERSION && isInt(parsed.revision)) {
        lastRevision = Math.max(lastRevision, parsed.revision);
        if (payloadOf({ phase: parsed.phase as SessionPhase, draft: parsed.draft as RaceSetup, session: parsed.session as RaceSession | null }) === signature) {
          return { ok: true, document: buildSaveDocument(phase, input.draft, input.session, parsed.revision), skipped: true };
        }
      }
    } catch { /* Corrupt text is never copied into the backup slot. */ }
  }

  const revision = Math.max(lastRevision, 0) + 1;
  const document = buildSaveDocument(phase, input.draft, storedSession, revision);
  if (existingRaw) {
    try {
      const parsed: unknown = JSON.parse(existingRaw);
      if (isPlainObject(parsed) && parsed.version === SAVE_VERSION) storage.setItem(SAVE_BACKUP_KEY, existingRaw);
    } catch { /* Keep the previous valid backup untouched. */ }
  }
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(document));
  } catch {
    return { ok: false, document: null, skipped: false, error: SAVE_ERROR };
  }
  lastRevision = revision;
  return { ok: true, document, skipped: false };
}

export function clearSave(storage: StorageLike | null = resolveStorage()) {
  if (!storage) return;
  try { storage.removeItem(SAVE_KEY); storage.removeItem(SAVE_BACKUP_KEY); } catch { /* Nothing else to do. */ }
  lastRevision = 0;
}
