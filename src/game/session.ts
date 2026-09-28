import { type CourseId, type RacerStanding, type RunRecord } from './types';
import { ISLAND_COURSE, cupRounds, playableCourse } from './course-archive';
import { DEFAULT_LOADOUT, isCapsule, isRider, type Loadout } from './loadouts';
// T02: field sizes, seeds and the qualifying rule come from the frozen config contract.
import { DEFAULT_SEED, QUALIFYING_REQUIRED_ABOVE, isFieldSize, type FieldSize } from './contracts/config';
import { buildRosterLoadouts } from './roster';
import type { EventRef } from './custom-events';

export type RaceMode = 'quick' | 'tournament';
export type Difficulty = 'rookie' | 'racer' | 'veteran';
export interface RaceSetup {
  mode: RaceMode;
  course: CourseId;
  loadout: Loadout;
  difficulty: Difficulty;
  customPhysics: boolean;
  /** T02: explicit participant count — 4 (legacy), 20, 50 or 100. */
  fieldSize: FieldSize;
  /** The island finish picked for a quick race; absent means the full course. */
  finish?: RaceFinish;
  /**
   * A custom event (Quick Races → Create your own): its rounds fix each round's island track and
   * finish. One round races as a Quick Race, more as a tournament.
   */
  event?: EventRef;
}
/** A finish the player picked (engine x along the course), with the name it was placed under. */
export interface RaceFinish { x: number; name: string }

export interface RaceConfig extends RaceSetup {
  /** The finish line for this race (engine x); absent means the full course. */
  finishX?: number;
  sessionId: string;
  round: number;
  totalRounds: number;
  roster: Loadout[];
  /** T02: gameplay RNG seed; the same seed replays the same race. */
  seed: number;
}
export interface RaceSession {
  id: string;
  setup: RaceSetup;
  rounds: CourseId[];
  round: number;
  roster: Loadout[];
  results: RunRecord[];
  /** T02: seed fixed at creation so a committed round is reproducible. */
  seed: number;
  /** The finish picked for each round (a cup picks before every round); null or absent: the full course. */
  finishes?: (RaceFinish | null)[];
}
export interface CupStanding {
  id: number;
  name: string;
  color: string;
  points: number;
  wins: number;
  lastPlace: number;
  positions: number[];
}

/**
 * Explicit, persisted lifecycle phase for an event. Hydration never guesses the
 * phase from a mounted React component or from `results.length` alone.
 * `goblin-rally-session-v1` stores one of these strings.
 */
export type SessionPhase = 'setup' | 'grid' | 'racing' | 'round-results' | 'cup-results';
export const SESSION_PHASES: readonly SessionPhase[] = ['setup', 'grid', 'racing', 'round-results', 'cup-results'];
export const isSessionPhase = (value: unknown): value is SessionPhase =>
  typeof value === 'string' && SESSION_PHASES.includes(value as SessionPhase);

export const CUP_NAME = 'The Scrapdome Cup';
export const CUP_POINTS = [9, 6, 3, 1] as const;
export const CUP_ROUNDS: CourseId[] = ['ridge', 'boomtown', 'sheep'];
export const SETUP_KEY = 'goblin-rally-setup-v2';
export const DEFAULT_SETUP: RaceSetup = { mode: 'quick', course: ISLAND_COURSE, loadout: DEFAULT_LOADOUT, difficulty: 'racer', customPhysics: false, fieldSize: 4 };

/**
 * T02: qualifying is a contract rule, not a preference — required above four
 * participants, disabled at four. The heat flow that runs it lands with T04/T06;
 * this helper describes the rule but does not enforce a live heat gate.
 */
export function qualifyingForField(fieldSize: number): { enabled: boolean; required: boolean } {
  const required = fieldSize > QUALIFYING_REQUIRED_ABOVE;
  return { enabled: required, required };
}

/** Round points: the frozen [9, 6, 3, 1] table at four racers; top-nine 9..1 above that. */
export function roundPointsFor(position: number, finished: boolean, fieldSize: number): number {
  if (!finished) return 0;
  if (fieldSize <= 4) return CUP_POINTS[position - 1] ?? 0;
  return Math.max(0, 10 - position);
}

/** Non-deterministic seed for a brand-new session; persisted so replays stay possible. */
export function newSessionSeed(): number {
  return ((Date.now() & 0x7fffffff) ^ Math.floor(Math.random() * 0x7fffffff)) | 0;
}
export const DIFFICULTIES = [
  { id: 'rookie', name: 'Rookie', description: 'More breathing room. Rivals react less often.' },
  { id: 'racer', name: 'Racer', description: 'A fair fight. Alert rivals and a lively pack.' },
  { id: 'veteran', name: 'Veteran', description: 'Quick decisions. Rivals waste fewer opportunities.' },
] as const;

export function readSetup(): RaceSetup {
  try {
    const saved = JSON.parse(localStorage.getItem(SETUP_KEY) || 'null') as Partial<RaceSetup> | null;
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETUP, loadout: { ...DEFAULT_LOADOUT } };
    return {
      mode: saved.mode === 'tournament' ? 'tournament' : 'quick',
      course: playableCourse(saved.course),
      loadout: { rider: isRider(saved.loadout?.rider) ? saved.loadout.rider : 'rivet', capsule: isCapsule(saved.loadout?.capsule) ? saved.loadout.capsule : 'iron' },
      difficulty: saved.difficulty === 'rookie' || saved.difficulty === 'veteran' ? saved.difficulty : 'racer',
      customPhysics: saved.mode !== 'tournament' && saved.customPhysics === true,
      fieldSize: isFieldSize(saved.fieldSize) ? saved.fieldSize : 4,
    };
  } catch { return { ...DEFAULT_SETUP, loadout: { ...DEFAULT_LOADOUT } }; }
}

export function createSession(setup: RaceSetup): RaceSession {
  if (setup.event?.rounds.length) return createEventSession(setup);
  const safe = { ...setup, loadout: { ...setup.loadout }, customPhysics: setup.mode === 'quick' && setup.customPhysics,
    fieldSize: isFieldSize(setup.fieldSize) ? setup.fieldSize : 4 };
  return {
    id: typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    setup: safe, rounds: safe.mode === 'tournament' ? cupRounds() : [safe.course], round: 0,
    // A cup's first round runs to the finish picked in New Game; the others are picked between rounds.
    ...(safe.mode === 'tournament' ? { finishes: [safe.finish ?? null, ...cupRounds().slice(1).map(() => null)] } : {}),
    roster: buildRosterLoadouts(safe.fieldSize, safe.loadout), results: [], seed: newSessionSeed(),
  };
}

/** A custom event: every round on the island, each with the event's own finish (and track). */
function createEventSession(setup: RaceSetup): RaceSession {
  const event = setup.event!;
  const mode: RaceMode = event.rounds.length > 1 ? 'tournament' : 'quick';
  const safe: RaceSetup = { ...setup, mode, course: ISLAND_COURSE, loadout: { ...setup.loadout }, customPhysics: false,
    fieldSize: isFieldSize(setup.fieldSize) ? setup.fieldSize : 4, event: { ...event, rounds: event.rounds.map((r) => ({ ...r })) } };
  delete safe.finish;
  return {
    id: typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    setup: safe, rounds: event.rounds.map(() => ISLAND_COURSE), round: 0,
    finishes: event.rounds.map((r) => r.finish ?? null),
    roster: buildRosterLoadouts(safe.fieldSize, safe.loadout), results: [], seed: newSessionSeed(),
  };
}

/** The island track a round races on: the event's pick, or null (whatever track is active). */
export const sessionTrackId = (session: RaceSession, round = session.round): string | null =>
  session.setup.event?.rounds[round]?.trackId ?? null;

/** What the event is called: a custom event's name, the cup, or a Quick Race. */
export const eventTitle = (session: RaceSession): string =>
  session.setup.event?.name ?? (session.setup.mode === 'tournament' ? CUP_NAME : 'Quick Race');

export const sessionConfig = (session: RaceSession): RaceConfig => ({
  ...session.setup, course: session.rounds[session.round], sessionId: session.id,
  // A cup picks each round's finish (none picked: the full run); a quick race has the setup's own.
  finishX: session.setup.event ? session.setup.event.rounds[session.round]?.finish?.x
    : session.setup.mode === 'tournament' ? session.finishes?.[session.round]?.x : session.setup.finish?.x,
  round: session.round, totalRounds: session.rounds.length, roster: session.roster,
  seed: Number.isSafeInteger(session.seed) ? session.seed : DEFAULT_SEED,
});

export function commitRound(session: RaceSession, record: RunRecord): RaceSession {
  if (record.sessionId !== session.id || record.round !== session.round || record.course !== session.rounds[session.round]
    || session.results.some((result) => result.round === record.round)) return session;
  return { ...session, results: [...session.results, record] };
}

export const sessionComplete = (session: RaceSession) => session.results.length >= session.rounds.length;
export const roundComplete = (session: RaceSession) => session.results.some((record) => record.round === session.round);
export const roundCommitted = (session: RaceSession, round: number) => session.results.some((record) => record.round === round);

/** Stable identity for a committed result: one record per session round. */
export const runRecordKey = (record: RunRecord) => record.sessionId !== undefined && record.round !== undefined
  ? `${record.sessionId}:${record.round}` : record.id;

/** The phase that matches practice progress inside a live round. */
export function liveSessionPhase(session: RaceSession | null): SessionPhase {
  if (!session) return 'setup';
  if (sessionComplete(session)) return 'cup-results';
  return roundComplete(session) ? 'round-results' : 'grid';
}

/** Contextual label for the main-menu resume entry, derived from the persisted phase. */
export function resumeLabel(session: RaceSession | null, phase: SessionPhase): string {
  if (!session) return 'Resume Race';
  const tournament = session.setup.mode === 'tournament';
  if (phase === 'cup-results') return tournament ? 'View Cup Results' : 'View Race Results';
  if (phase === 'round-results') return tournament ? 'View Round Results' : 'View Race Results';
  return tournament ? 'Continue Tournament' : 'Resume Race';
}

export function roundLabel(session: RaceSession, round: number) {
  return session.setup.mode === 'tournament' ? `Round ${round + 1} of ${session.rounds.length}` : 'the current race';
}
export const recordModeLabel = (record: RunRecord) => record.mode === 'practice' ? 'Custom practice'
  : record.mode === 'tournament' ? `Cup / Round ${(record.round ?? 0) + 1}`
    : record.mode === 'quick' ? 'Quick Race' : 'Legacy run';
/** The next round of a cup; `finish` is the finish picked for it (undefined keeps any earlier pick). */
export function nextRound(session: RaceSession, finish?: RaceFinish | null): RaceSession {
  if (!roundComplete(session) || sessionComplete(session)) return session;
  const round = session.round + 1;
  if (finish === undefined) return { ...session, round };
  const finishes = session.rounds.map((_, i) => session.finishes?.[i] ?? null);
  finishes[round] = finish;
  return { ...session, round, finishes };
}

export function resultField(record: RunRecord): RacerStanding[] {
  return [...(record.opponents ?? [])].sort((a, b) => a.position - b.position);
}

export function cupStandings(session: RaceSession): CupStanding[] {
  // T02: points and the DNF placeholder scale with the field; the four-racer cup
  // still scores exactly [9, 6, 3, 1] with 5 as the DNF tiebreak place.
  const fieldSize = session.setup.fieldSize ?? 4;
  const dnfPlace = fieldSize + 1;
  const table = new Map<number, CupStanding>();
  for (const record of session.results) {
    const recordField = record.fieldSize ?? fieldSize;
    for (const racer of resultField(record)) {
      let row = table.get(racer.id);
      if (!row) { row = { id: racer.id, name: racer.name, color: racer.color, points: 0, wins: 0, lastPlace: dnfPlace, positions: [] }; table.set(racer.id, row); }
      row.points += roundPointsFor(racer.position, racer.finished, recordField);
      row.wins += racer.finished && racer.position === 1 ? 1 : 0;
      row.lastPlace = racer.finished ? racer.position : dnfPlace;
      row.positions.push(racer.finished ? racer.position : 0);
    }
  }
  return [...table.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.lastPlace - b.lastPlace || a.id - b.id);
}