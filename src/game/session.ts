import { COURSES, type CourseId, type RacerStanding, type RunRecord } from './types';
import { DEFAULT_LOADOUT, isCapsule, isRider, opponentLoadouts, type Loadout } from './loadouts';

export type RaceMode = 'quick' | 'tournament';
export type Difficulty = 'rookie' | 'racer' | 'veteran';
export interface RaceSetup {
  mode: RaceMode;
  course: CourseId;
  loadout: Loadout;
  difficulty: Difficulty;
  customPhysics: boolean;
}
export interface RaceConfig extends RaceSetup {
  sessionId: string;
  round: number;
  totalRounds: number;
  roster: Loadout[];
}
export interface RaceSession {
  id: string;
  setup: RaceSetup;
  rounds: CourseId[];
  round: number;
  roster: Loadout[];
  results: RunRecord[];
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

export const CUP_NAME = 'The Scrapdome Cup';
export const CUP_POINTS = [9, 6, 3, 1] as const;
export const CUP_ROUNDS: CourseId[] = ['ridge', 'boomtown', 'sheep'];
export const SETUP_KEY = 'goblin-rally-setup-v2';
export const DEFAULT_SETUP: RaceSetup = { mode: 'quick', course: 'ridge', loadout: DEFAULT_LOADOUT, difficulty: 'racer', customPhysics: false };
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
      course: COURSES.some((course) => course.id === saved.course) ? saved.course! : 'ridge',
      loadout: { rider: isRider(saved.loadout?.rider) ? saved.loadout.rider : 'rivet', capsule: isCapsule(saved.loadout?.capsule) ? saved.loadout.capsule : 'iron' },
      difficulty: saved.difficulty === 'rookie' || saved.difficulty === 'veteran' ? saved.difficulty : 'racer',
      customPhysics: saved.mode !== 'tournament' && saved.customPhysics === true,
    };
  } catch { return { ...DEFAULT_SETUP, loadout: { ...DEFAULT_LOADOUT } }; }
}

export function createSession(setup: RaceSetup): RaceSession {
  const safe = { ...setup, loadout: { ...setup.loadout }, customPhysics: setup.mode === 'quick' && setup.customPhysics };
  return {
    id: typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    setup: safe, rounds: safe.mode === 'tournament' ? [...CUP_ROUNDS] : [safe.course], round: 0,
    roster: opponentLoadouts(safe.loadout), results: [],
  };
}

export const sessionConfig = (session: RaceSession): RaceConfig => ({
  ...session.setup, course: session.rounds[session.round], sessionId: session.id,
  round: session.round, totalRounds: session.rounds.length, roster: session.roster,
});

export function commitRound(session: RaceSession, record: RunRecord): RaceSession {
  if (record.sessionId !== session.id || record.round !== session.round || record.course !== session.rounds[session.round]
    || session.results.some((result) => result.round === record.round)) return session;
  return { ...session, results: [...session.results, record] };
}

export const sessionComplete = (session: RaceSession) => session.results.length >= session.rounds.length;
export const roundComplete = (session: RaceSession) => session.results.some((record) => record.round === session.round);
export const recordModeLabel = (record: RunRecord) => record.mode === 'practice' ? 'Custom practice'
  : record.mode === 'tournament' ? `Cup / Round ${(record.round ?? 0) + 1}`
    : record.mode === 'quick' ? 'Quick Race' : 'Legacy run';
export function nextRound(session: RaceSession): RaceSession {
  if (!roundComplete(session) || sessionComplete(session)) return session;
  return { ...session, round: session.round + 1 };
}

export function resultField(record: RunRecord): RacerStanding[] {
  return [...(record.opponents ?? [])].sort((a, b) => a.position - b.position);
}

export function cupStandings(session: RaceSession): CupStanding[] {
  const table = new Map<number, CupStanding>();
  for (const record of session.results) {
    for (const racer of resultField(record)) {
      let row = table.get(racer.id);
      if (!row) { row = { id: racer.id, name: racer.name, color: racer.color, points: 0, wins: 0, lastPlace: 5, positions: [] }; table.set(racer.id, row); }
      row.points += racer.finished ? CUP_POINTS[racer.position - 1] ?? 0 : 0;
      row.wins += racer.finished && racer.position === 1 ? 1 : 0;
      row.lastPlace = racer.finished ? racer.position : 5;
      row.positions.push(racer.finished ? racer.position : 0);
    }
  }
  return [...table.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.lastPlace - b.lastPlace || a.id - b.id);
}