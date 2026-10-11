// @hm/narrator: which of the mentor's lines plays when. Pure and deterministic: no clock, no randomness, no I/O. The
// game feeds it events and elapsed time and plays what it says to (docs/NARRATION_SYSTEM.md).
//
// Rules, from what players praise and complain about in radio-mentor games:
//  - story lines play once, ever, in their order; they wait their turn and are never dropped;
//  - repeatable lines (warnings and barks) have cooldowns, so a condition that stays true does not nag;
//  - priority: story over warn over bark; a higher line cuts a playing bark (the game fades it), nothing cuts a story
//    line, and a bark never interrupts anything;
//  - the queue is capped, and warnings and barks go stale and are dropped if they wait too long (old news);
//  - a short gap between lines, so they never run into each other;
//  - every line that has played is kept in order: the radio log the player can replay.

export type Priority = 'story' | 'warn' | 'bark';
const RANK: Readonly<Record<Priority, number>> = { story: 3, warn: 2, bark: 1 };

export interface Line {
  readonly id: string;
  readonly priority: Priority;
  /** The clip's length in seconds (the game measures it when it loads the clip). */
  readonly seconds: number;
  /** Seconds before a repeatable line may play again. Story lines play once and ignore it. */
  readonly cooldown?: number;
  /** Only after this line has played (story order). */
  readonly after?: string;
}

export interface Rules {
  readonly lines: Readonly<Record<string, Line>>;
  /** Event name to candidate line ids; the first eligible one is queued. */
  readonly triggers: Readonly<Record<string, readonly string[]>>;
  /** Most lines waiting at once; past it the lowest waiting warn or bark is dropped (story lines always stay). */
  readonly queueMax: number;
  /** Seconds a line may wait before it is stale and dropped. */
  readonly ttl: Readonly<Record<Priority, number>>;
  /** Seconds of quiet between two lines. */
  readonly gap: number;
}

export interface Waiting { readonly id: string; readonly at: number }
export interface State {
  /** Seconds since the narrator started (advanced only by step). */
  readonly time: number;
  /** Every line that has played, in the order it first played: the radio log, and what makes story lines once-only. */
  readonly heard: readonly string[];
  /** When each line last started. */
  readonly lastPlayed: Readonly<Record<string, number>>;
  /** Lines waiting, best first. */
  readonly queue: readonly Waiting[];
  readonly playing: { readonly id: string; readonly ends: number } | null;
  /** The earliest time the next line may start (the end of the last one plus the gap). */
  readonly free: number;
}

/** A fresh narrator; pass the saved radio log so story lines heard in earlier sessions stay heard. */
export function createNarrator(heard: readonly string[] = []): State {
  return { time: 0, heard: [...heard], lastPlayed: {}, queue: [], playing: null, free: 0 };
}

function eligible(rules: Rules, s: State, id: string): boolean {
  const line = rules.lines[id];
  if (!line) return false;
  if (s.playing?.id === id || s.queue.some((w) => w.id === id)) return false;
  if (line.after !== undefined && !s.heard.includes(line.after)) return false;
  if (line.priority === 'story') return !s.heard.includes(id);
  const last = s.lastPlayed[id];
  return last === undefined || s.time - last >= (line.cooldown ?? 0);
}

const rank = (rules: Rules, id: string): number => RANK[rules.lines[id]?.priority ?? 'bark'];

/** Best first: higher priority, then the one that has waited longer, then by id (a total order, so it is stable). */
function order(rules: Rules, q: readonly Waiting[]): Waiting[] {
  return [...q].sort((a, b) => rank(rules, b.id) - rank(rules, a.id) || a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Queue a line directly (if it is eligible). */
export function say(rules: Rules, s: State, id: string): State {
  if (!eligible(rules, s, id)) return s;
  let queue = order(rules, [...s.queue, { id, at: s.time }]);
  // over the cap: drop the worst waiting warn or bark, never a story line
  while (queue.length > rules.queueMax) {
    let drop = -1;
    for (let i = queue.length - 1; i >= 0; i--) {
      const w = queue[i];
      if (w && rules.lines[w.id]?.priority !== 'story') { drop = i; break; }
    }
    if (drop < 0) break;
    queue = queue.filter((_, i) => i !== drop);
  }
  return { ...s, queue };
}

/** Something happened in the game: queue the first eligible line it triggers, if any. */
export function trigger(rules: Rules, s: State, event: string): State {
  for (const id of rules.triggers[event] ?? []) {
    if (eligible(rules, s, id)) return say(rules, s, id);
  }
  return s;
}

/** The game finished playing a line early (it was skipped, or its audio ended before `seconds`). */
export function finish(rules: Rules, s: State, id: string): State {
  if (s.playing?.id !== id) return s;
  return { ...s, playing: null, free: s.time + rules.gap };
}

export interface Step {
  readonly state: State;
  /** A line to start now. */
  readonly start: string | null;
  /** A playing line to fade out now (a bark cut by something more important). */
  readonly cut: string | null;
}

/** Advance `dt` seconds: end the line that finished, cut a bark if something more important waits, start the next. */
export function step(rules: Rules, s0: State, dt: number): Step {
  let s: State = { ...s0, time: s0.time + Math.max(0, dt) };
  let cut: string | null = null;

  if (s.playing && s.time >= s.playing.ends) s = { ...s, playing: null, free: s.playing.ends + rules.gap };

  // stale warnings and barks leave the queue
  const queue = s.queue.filter((w) => s.time - w.at <= rules.ttl[rules.lines[w.id]?.priority ?? 'bark']);
  if (queue.length !== s.queue.length) s = { ...s, queue };

  const best = order(rules, s.queue)[0];
  if (s.playing && best && rules.lines[s.playing.id]?.priority === 'bark' && rank(rules, best.id) > RANK.bark) {
    cut = s.playing.id;
    s = { ...s, playing: null, free: s.time + rules.gap };
  }

  let start: string | null = null;
  if (!s.playing && best && s.time >= s.free) {
    const line = rules.lines[best.id];
    if (line) {
      start = best.id;
      s = {
        ...s,
        queue: s.queue.filter((w) => w.id !== best.id),
        playing: { id: best.id, ends: s.time + line.seconds },
        lastPlayed: { ...s.lastPlayed, [best.id]: s.time },
        heard: s.heard.includes(best.id) ? s.heard : [...s.heard, best.id],
      };
    }
  }
  return { state: s, start, cut };
}

/** A short fingerprint of the state, for determinism tests and replays. */
export function hashNarrator(s: State): string {
  const text = JSON.stringify([s.time.toFixed(6), s.heard, Object.entries(s.lastPlayed).sort(), s.queue, s.playing, s.free.toFixed(6)]);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export { FIDELITY_LINE_IDS, FIDELITY_TRIGGERS, fidelityRules } from './fidelity';
