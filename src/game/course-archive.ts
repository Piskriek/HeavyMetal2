/**
 * The owner's direction (2026-09-27): the island is the only track. The three classic courses
 * (Rustbucket Ridge, Boomtown Run, Woolly Wasteland) and their shared world are archived, not
 * deleted: their code, the owner's hand-built props and every backup stay as they are, and this flag
 * brings them back.
 *
 *   localStorage.setItem('hm2-classic-tracks', 'on')   or open the game with ?classic in the URL
 *
 * Everything that lists or defaults a course asks here, so the switch lives in one place.
 */
import { COURSES, type CourseId } from './types';

export const ISLAND_COURSE: CourseId = 'basalt';
export const CLASSIC_TRACKS_KEY = 'hm2-classic-tracks';
/** The classic cup's three rounds (used again when the classic tracks are switched back on). */
export const CLASSIC_CUP_ROUNDS: readonly CourseId[] = ['ridge', 'boomtown', 'sheep'];

/** True when the archived classic tracks are switched back on (browser only). */
export function classicTracksEnabled(): boolean {
  try {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('classic')) return true;
    return typeof localStorage !== 'undefined' && localStorage.getItem(CLASSIC_TRACKS_KEY) === 'on';
  } catch {
    return false;
  }
}

/** The courses a player or builder can pick: the island, plus the classic three when switched on. */
export function playableCourses(): typeof COURSES {
  return classicTracksEnabled() ? COURSES : COURSES.filter((c) => c.id === ISLAND_COURSE);
}

export const isPlayableCourse = (id: unknown): id is CourseId => playableCourses().some((c) => c.id === id);

/** A course that can be played: the one given when it is, otherwise the island. */
export const playableCourse = (id: unknown): CourseId => (isPlayableCourse(id) ? id : ISLAND_COURSE);

/**
 * A cup's rounds. With the classic tracks archived, the cup is three rounds on the island (until the
 * finish-line picker gives each round its own finish).
 */
export function cupRounds(): CourseId[] {
  return classicTracksEnabled() ? [...CLASSIC_CUP_ROUNDS] : [ISLAND_COURSE, ISLAND_COURSE, ISLAND_COURSE];
}
