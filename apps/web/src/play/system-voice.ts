/**
 * The drone's "System" voice (Plan 57 §8.1): the isekai frame's notices on the narrator's scheduler (@hm/narrator systemRules),
 * written, not voiced. Every notice answers a real event:
 * - the simulation start (`sim:arrive`);
 * - the plot's stage rising (`stage:up`);
 * - one of the drone's presets newly mastered (`skill:gained`);
 * - a eureka bringing back a suppressed quality (`title:earned`);
 * - a new open cause the ego left on a preset (`quest:logged`).
 * The log keeps every notice shown (the log of what was learned). What it has heard (the arrival, once ever) is kept per save slot.
 */
import { SYSTEM_TRIGGERS, createNarrator, noticeText, step, systemRules, trigger, type State } from '@hm/narrator';
import { SQ_DISTORTION_CATALOG, mastered, openCausesFrom } from '@hm/harness';
import { ALIGNED } from '@hm/shorthand';
import { DRONE_MEMORY_OF, DRONE_ROLES, type DroneMemory, type DroneRole } from './drone-memory';

export interface SystemNotice {
  /** The notice's id in the System's table (`SYS-SKILL`). */
  readonly id: string;
  readonly text: string;
  /** Seconds into the System's clock when it showed (a fresh one each time, so the panel replays its opening). */
  readonly at: number;
}

/** The skill each of the drone's presets is, mastered. */
export const DRONE_SKILLS: Readonly<Record<DroneRole, string>> = { fire: 'Steady Fire', reflex: 'Quick Reflex', flight: 'Sure Flight' };

/** The open causes the ego's rule left on a preset, by the quality each suppresses. */
const openQualities = (m: DroneMemory, role: DroneRole): Set<string> =>
  new Set(openCausesFrom(m.presets[role], DRONE_MEMORY_OF.ego).flatMap((e) => (e.d === ALIGNED ? [] : [SQ_DISTORTION_CATALOG[e.d].antidoteName])));

/** What the drone's memory newly shows between two of its states: a preset mastered, or a quality newly held back. */
export function droneNotices(before: DroneMemory, after: DroneMemory): { readonly event: string; readonly data: string }[] {
  const out: { event: string; data: string }[] = [];
  const quests = new Set<string>();
  for (const role of DRONE_ROLES) {
    if (!mastered(before.presets[role]) && mastered(after.presets[role])) out.push({ event: 'skill:gained', data: DRONE_SKILLS[role] });
    const was = openQualities(before, role);
    for (const q of openQualities(after, role)) if (!was.has(q)) quests.add(q);
  }
  for (const q of quests) out.push({ event: 'quest:logged', data: `Restore ${q}` });
  return out;
}

export class SystemVoice {
  private readonly rules = systemRules();
  private state: State;
  private shown: SystemNotice[];
  private current: SystemNotice | null = null;

  /** Starts from what was heard (the greeting, once ever) and the log kept from earlier sessions. */
  constructor(heard: readonly string[] = [], log: readonly SystemNotice[] = []) {
    this.state = createNarrator(heard);
    this.shown = log.slice(-SYSTEM_LOG_MAX);
  }

  /** Something happened: queue its notice, with its subject (a notice that cannot be written without one is not queued). */
  trigger(event: string, data?: string): void {
    const id = SYSTEM_TRIGGERS[event]?.[0];
    if (!id || noticeText(id, data) === null) return;
    this.state = trigger(this.rules, this.state, event, data);
  }

  /** Advance `dt` seconds; the notice showing now (null between notices). */
  step(dt: number): SystemNotice | null {
    const r = step(this.rules, this.state, dt);
    this.state = r.state;
    if (r.start) {
      const text = noticeText(r.start, r.data);
      this.current = text ? { id: r.start, text, at: r.state.time } : null;
      if (this.current) this.shown = [...this.shown, this.current].slice(-SYSTEM_LOG_MAX);
    } else if (!this.state.playing) {
      this.current = null;
    }
    return this.current;
  }

  /** Every notice shown, in order. */
  log(): readonly SystemNotice[] {
    return this.shown;
  }

  /** The once-only notices heard (to save with the slot). */
  heard(): readonly string[] {
    return this.state.heard;
  }
}

/** How many notices the log keeps (the newest). */
export const SYSTEM_LOG_MAX = 100;

/** The System's heard list and its log belong to one save slot, as the radio log does. */
export const systemHeardKey = (slot: string): string => `fidelity.system-heard.${slot}`;
export const systemLogKey = (slot: string): string => `fidelity.system-log.${slot}`;

/** A saved log read back: only well-formed notices, the newest SYSTEM_LOG_MAX; anything else reads as an empty log. */
export function readSystemLog(raw: string | null): SystemNotice[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(v)) return [];
    return v
      .filter((n): n is SystemNotice => typeof n === 'object' && n !== null && typeof (n as SystemNotice).id === 'string' && typeof (n as SystemNotice).text === 'string' && typeof (n as SystemNotice).at === 'number')
      .map((n) => ({ id: n.id, text: n.text, at: n.at }))
      .slice(-SYSTEM_LOG_MAX);
  } catch {
    return [];
  }
}
