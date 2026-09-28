/**
 * QUICK RACES: events the player designs. A custom event is a named list of 1–8 rounds on the island,
 * each round on one of the island's tracks (the lane layouts built in the 3D Map Editor) and ending at
 * one of that track's finish lines (or down to the sea), plus the field size and the CPU challenge.
 * One round races like a Quick Race; more is a tournament with points carried round to round.
 *
 * Saved per player ("My Events"). The JSON shape is also what a shared event publishes through
 * RUN.world's UGC API later (MP-R05), so it stays small and self-contained.
 */
import type { Difficulty, RaceFinish } from './session';
import { FIELD_SIZES, isFieldSize, type FieldSize } from './contracts/config';

export const EVENTS_KEY = 'hm2-custom-events-v1';
export const MAX_EVENT_ROUNDS = 8;
export const MAX_EVENTS = 30;

export interface EventRound {
  /** Island track id (island-props-storage), e.g. 'serpentine'. */
  trackId: string;
  /** Track name when it was picked (shown if the track is gone). */
  trackName: string;
  /** Where the round ends; null: the full run down to the sea. */
  finish: RaceFinish | null;
}

export interface CustomEvent {
  id: string;
  name: string;
  rounds: EventRound[];
  fieldSize: FieldSize;
  difficulty: Difficulty;
  createdAt: number;
  updatedAt: number;
}

/** What a race session carries of its event (the rest of the setup is the ordinary race setup). */
export interface EventRef { id: string; name: string; rounds: EventRound[] }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function sanitizeFinish(raw: unknown): RaceFinish | null {
  if (!isObj(raw) || typeof raw.x !== 'number' || !Number.isFinite(raw.x) || typeof raw.name !== 'string') return null;
  return { x: raw.x, name: raw.name.slice(0, 60) };
}

export function sanitizeRounds(raw: unknown): EventRound[] | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_EVENT_ROUNDS) return null;
  const rounds: EventRound[] = [];
  for (const r of raw) {
    if (!isObj(r) || typeof r.trackId !== 'string' || !r.trackId) return null;
    rounds.push({ trackId: r.trackId.slice(0, 80), trackName: typeof r.trackName === 'string' ? r.trackName.slice(0, 60) : r.trackId, finish: sanitizeFinish(r.finish) });
  }
  return rounds;
}

export const cleanName = (name: unknown, fallback = 'My Event') =>
  (typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 40) : '') || fallback;

export function sanitizeEventRef(raw: unknown): EventRef | undefined {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id) return undefined;
  const rounds = sanitizeRounds(raw.rounds);
  return rounds ? { id: raw.id.slice(0, 80), name: cleanName(raw.name), rounds } : undefined;
}

export function sanitizeEvent(raw: unknown): CustomEvent | null {
  const ref = sanitizeEventRef(raw);
  if (!ref || !isObj(raw)) return null;
  return {
    ...ref,
    fieldSize: isFieldSize(raw.fieldSize) ? raw.fieldSize : FIELD_SIZES[0]!,
    difficulty: raw.difficulty === 'rookie' || raw.difficulty === 'veteran' ? raw.difficulty : 'racer',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

export const eventRef = (e: CustomEvent): EventRef => ({ id: e.id, name: e.name, rounds: e.rounds.map((r) => ({ ...r })) });

export const isTournamentEvent = (e: { rounds: unknown[] }) => e.rounds.length > 1;

/** "3 rounds · 4 racers · Racer" */
export function eventSummary(e: Pick<CustomEvent, 'rounds' | 'fieldSize' | 'difficulty'>): string {
  const d = e.difficulty === 'rookie' ? 'Rookie' : e.difficulty === 'veteran' ? 'Veteran' : 'Racer';
  return `${e.rounds.length} ${e.rounds.length === 1 ? 'round' : 'rounds'} · ${e.fieldSize} racers · ${d}`;
}

export function newEventId(now = Date.now()): string {
  const rand = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `ev-${now.toString(36)}-${rand}`;
}

/* ───────────── storage ───────────── */

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
const storage = (): StorageLike | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function listEvents(store: StorageLike | null = storage()): CustomEvent[] {
  try {
    const raw = JSON.parse(store?.getItem(EVENTS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.map(sanitizeEvent).filter((e): e is CustomEvent => !!e) : [];
  } catch { return []; }
}

/** Saves (adds or replaces by id), newest first. */
export function saveEvent(event: CustomEvent, store: StorageLike | null = storage(), now = Date.now()): { ok: boolean; error?: string } {
  const clean = sanitizeEvent({ ...event, name: cleanName(event.name), updatedAt: now, createdAt: event.createdAt || now });
  if (!clean) return { ok: false, error: 'An event needs 1 to 8 rounds, each on an island track.' };
  const list = [clean, ...listEvents(store).filter((e) => e.id !== clean.id)].slice(0, MAX_EVENTS);
  try { store?.setItem(EVENTS_KEY, JSON.stringify(list)); return { ok: !!store }; } catch { return { ok: false, error: 'This device would not save the event.' }; }
}

export function deleteEvent(id: string, store: StorageLike | null = storage()): boolean {
  const list = listEvents(store);
  if (!list.some((e) => e.id === id)) return false;
  try { store?.setItem(EVENTS_KEY, JSON.stringify(list.filter((e) => e.id !== id))); return true; } catch { return false; }
}
