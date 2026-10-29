// The drone's "System" voice (Plan 57 §8.1): the notices of the isekai frame, each tied to a real event in the simulation, on the
// same scheduler as the mentor (once-only story lines, cooldowns, a capped queue, stale lines dropped, a gap). The notices are
// written, not voiced: each shows for a reading time, and its subject (the skill, the title) travels with it.
import type { Line, Priority, Rules } from './index';

interface Notice {
  readonly priority: Priority;
  readonly on: string;
  /** Seconds it shows (a reading time). */
  readonly seconds: number;
  readonly each?: true;
  readonly cooldown?: number;
  /** Its words; `{}` is the subject. */
  readonly text: string;
  /** Its words when it has no subject; without them a notice with no subject shows nothing. */
  readonly bare?: string;
}

const NOTICES: Readonly<Record<string, Notice>> = {
  // the simulation start, once
  'SYS-ARRIVE': { priority: 'story', on: 'sim:arrive', seconds: 5, text: 'System online. Welcome, {}.', bare: 'System online.' },
  // the plot's stage rising: its density step
  'SYS-LEVEL': { priority: 'warn', on: 'stage:up', seconds: 4.5, each: true, text: 'Level up: Stage {}.' },
  // a preset the drone has mastered
  'SYS-SKILL': { priority: 'warn', on: 'skill:gained', seconds: 4, each: true, text: 'Skill gained: {}.' },
  // a eureka: a long-held distortion let go, its suppressed quality back
  'SYS-TITLE': { priority: 'warn', on: 'title:earned', seconds: 4.5, each: true, text: 'Title earned: {} returned.' },
  // a new open cause
  'SYS-QUEST': { priority: 'warn', on: 'quest:logged', seconds: 4, each: true, text: 'Quest logged: {}.' },
  // the hint channel: optional, and it never nags
  'SYS-HINT': { priority: 'bark', on: 'hint', seconds: 4, cooldown: 45, text: 'Hint: {}' },
};

/** The System's events, each to its notice. */
export const SYSTEM_TRIGGERS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(NOTICES).map(([id, n]) => [n.on, [id]]),
);

/** Every notice id in the table. */
export const SYSTEM_NOTICE_IDS: readonly string[] = Object.keys(NOTICES);

/** The System's rules: a longer queue than the mentor's, so a burst of notices waits its turn, and a shorter gap. */
export function systemRules(): Rules {
  const lines: Record<string, Line> = {};
  for (const [id, n] of Object.entries(NOTICES)) {
    lines[id] = { id, priority: n.priority, seconds: n.seconds, ...(n.cooldown !== undefined ? { cooldown: n.cooldown } : {}), ...(n.each ? { each: true as const } : {}) };
  }
  return { lines, triggers: SYSTEM_TRIGGERS, queueMax: 6, ttl: { story: Infinity, warn: 30, bark: 8 }, gap: 0.4 };
}

/** A notice's words with its subject; with none, its bare words, or null (an id that is not a notice, or one that needs its subject). */
export function noticeText(id: string, data?: string | null): string | null {
  const n = NOTICES[id];
  if (!n) return null;
  return data ? n.text.split('{}').join(data) : n.bare ?? null;
}
