// src/index.ts
// Quests, questlines and unlocks as plain data, with a pure evaluator.
// No imports, no side effects, no time, no randomness.

/** What the game knows about the player: counters (events seen, things placed, credits ...), owned preset ids, finished quests. */
export interface PlayerState { counts: Record<string, number>; owns: string[]; done: string[] }

/** A condition, as data (never code). */
export type Cond =
  | { all: Cond[] } | { any: Cond[] } | { not: Cond }
  | { count: string; atLeast: number }        // counts[count] >= atLeast (missing = 0)
  | { owns: string } | { done: string };

export interface Reward { credits?: number; presets?: string[]; unlock?: string[] }
export interface Step { id: string; text: string; target?: string; until: Cond }
export interface Quest { id: string; title: string; requires?: Cond; steps: Step[]; reward: Reward }
export interface Questline { id: string; title: string; quests: Quest[] }
export interface Progress { quest: string | null; step: number; finished: string[]; rewarded: string[] }

export const START: Progress = { quest: null, step: 0, finished: [], rewarded: [] };

const MAX_DEPTH = 16;

export function check(c: Cond, s: PlayerState): boolean {
  if ('all' in c) return c.all.every((x) => check(x, s));
  if ('any' in c) return c.any.some((x) => check(x, s));
  if ('not' in c) return !check(c.not, s);
  if ('count' in c) return (s.counts[c.count] ?? 0) >= c.atLeast;
  if ('owns' in c) return s.owns.includes(c.owns);
  return s.done.includes(c.done);
}

function condProblems(c: unknown, where: string, questIds: ReadonlySet<string>, depth: number, out: string[]): void {
  if (depth > MAX_DEPTH) { out.push(`${where}: condition nested deeper than ${MAX_DEPTH}`); return; }
  if (typeof c !== 'object' || c === null || Array.isArray(c)) { out.push(`${where}: condition is not an object`); return; }
  const o = c as Record<string, unknown>;
  if ('all' in o || 'any' in o) {
    const key = 'all' in o ? 'all' : 'any';
    const list = o[key];
    if (!Array.isArray(list)) { out.push(`${where}.${key}: expected an array`); return; }
    list.forEach((x, i) => condProblems(x, `${where}.${key}[${i}]`, questIds, depth + 1, out));
    return;
  }
  if ('not' in o) { condProblems(o['not'], `${where}.not`, questIds, depth + 1, out); return; }
  if ('count' in o) {
    if (typeof o['count'] !== 'string') out.push(`${where}.count: expected a string`);
    const n = o['atLeast'];
    if (typeof n !== 'number' || !Number.isFinite(n)) out.push(`${where}.atLeast: expected a finite number`);
    return;
  }
  if ('owns' in o) { if (typeof o['owns'] !== 'string') out.push(`${where}.owns: expected a string`); return; }
  if ('done' in o) {
    const d = o['done'];
    if (typeof d !== 'string') out.push(`${where}.done: expected a string`);
    else if (!questIds.has(d)) out.push(`${where}.done: unknown quest "${d}"`);
    return;
  }
  out.push(`${where}: unknown condition shape`);
}

/** Validate untrusted questline data. Returns problems (empty = good). */
export function validate(q: Questline): string[] {
  const out: string[] = [];
  const questIds = new Set<string>();
  for (const quest of q.quests) {
    if (questIds.has(quest.id)) out.push(`quest "${quest.id}": duplicate quest id`);
    questIds.add(quest.id);
  }
  for (const quest of q.quests) {
    const where = `quest "${quest.id}"`;
    if (quest.steps.length === 0) out.push(`${where}: has no steps`);
    const stepIds = new Set<string>();
    for (const step of quest.steps) {
      if (stepIds.has(step.id)) out.push(`${where} step "${step.id}": duplicate step id`);
      stepIds.add(step.id);
      condProblems(step.until, `${where} step "${step.id}".until`, questIds, 1, out);
    }
    if (quest.requires !== undefined) condProblems(quest.requires, `${where}.requires`, questIds, 1, out);
    const credits = quest.reward.credits;
    if (credits !== undefined && (typeof credits !== 'number' || !Number.isFinite(credits) || credits < 0)) {
      out.push(`${where}.reward.credits: must be a non-negative finite number`);
    }
    for (const key of ['presets', 'unlock'] as const) {
      const list = quest.reward[key];
      if (list !== undefined && (!Array.isArray(list) || list.some((x) => typeof x !== 'string'))) {
        out.push(`${where}.reward.${key}: must be an array of strings`);
      }
    }
  }
  return out;
}

/** The first quest that is not finished and whose `requires` holds (in order), or null. */
export function current(q: Questline, s: PlayerState, p: Progress): string | null {
  for (const quest of q.quests) {
    if (p.finished.includes(quest.id)) continue;
    if (quest.requires !== undefined && !check(quest.requires, s)) continue;
    return quest.id;
  }
  return null;
}

/** Advance as far as the state allows; each quest pays its reward once. Never loops forever. */
export function advance(q: Questline, s: PlayerState, p: Progress): { progress: Progress; rewards: Reward[] } {
  const progress: Progress = { quest: p.quest, step: p.step, finished: [...p.finished], rewarded: [...p.rewarded] };
  const rewards: Reward[] = [];
  let guard = q.quests.length + 1; // each pass finishes a quest or returns
  while (guard-- > 0) {
    const id = current(q, s, progress);
    if (id === null) { progress.quest = null; progress.step = 0; return { progress, rewards }; }
    if (progress.quest !== id) { progress.quest = id; progress.step = 0; }
    const quest = q.quests.find((x) => x.id === id);
    if (quest === undefined) { progress.quest = null; progress.step = 0; return { progress, rewards }; }
    let step = progress.step;
    while (step < quest.steps.length) {
      const current_ = quest.steps[step];
      if (current_ === undefined || !check(current_.until, s)) break;
      step += 1;
    }
    progress.step = step;
    if (step < quest.steps.length) return { progress, rewards }; // stuck on a step: done for now
    if (!progress.finished.includes(id)) progress.finished.push(id);
    if (!progress.rewarded.includes(id)) { progress.rewarded.push(id); rewards.push(quest.reward); }
    progress.quest = null;
    progress.step = 0;
  }
  return { progress, rewards };
}

/** Skip the current step (the tour's Skip button). */
export function skip(q: Questline, p: Progress): Progress {
  const copy: Progress = { quest: p.quest, step: p.step, finished: [...p.finished], rewarded: [...p.rewarded] };
  if (copy.quest === null) return copy;
  const quest = q.quests.find((x) => x.id === copy.quest);
  if (quest === undefined) return copy;
  copy.step = Math.min(copy.step + 1, quest.steps.length);
  return copy;
}

/** Every UI target named in the questline, in order, deduplicated. */
export function targets(q: Questline): string[] {
  const out: string[] = [];
  for (const quest of q.quests) {
    for (const step of quest.steps) {
      if (step.target !== undefined && !out.includes(step.target)) out.push(step.target);
    }
  }
  return out;
}

/** The toy-world tutorial: wake up, build a base, power machines, open a portal, launch a rocket. */
export const TUTORIAL: Questline = {
  id: 'tutorial',
  title: 'From Toy Box to the Stars',
  quests: [
    { id: 'wake', title: 'Wake up', steps: [
      { id: 'look', text: 'Look around', until: { count: 'camera-moved', atLeast: 1 } },
      { id: 'walk', text: 'Take a few steps', until: { count: 'moved', atLeast: 5 } },
    ], reward: { credits: 10 } },
    { id: 'base', title: 'Build a base', steps: [
      { id: 'place', text: 'Place four toy bricks', target: 'island.slot.toy-brick', until: { count: 'placed:toy-brick', atLeast: 4 } },
      { id: 'roof', text: 'Add a roof', target: 'island.slot.roof', until: { count: 'placed:roof', atLeast: 1 } },
    ], reward: { credits: 25, presets: ['preset:starter-hut'], unlock: ['machines'] } },
    { id: 'machines', title: 'Power up machines', requires: { done: 'base' }, steps: [
      { id: 'generator', text: 'Place a wind-up generator', target: 'island.slot.generator', until: { count: 'placed:generator', atLeast: 1 } },
      { id: 'assembler', text: 'Wire up an assembler', target: 'island.slot.assembler',
        until: { all: [{ count: 'placed:assembler', atLeast: 1 }, { count: 'wired', atLeast: 1 }] } },
    ], reward: { credits: 50, unlock: ['portal'] } },
    { id: 'portal', title: 'Open a portal', requires: { done: 'machines' }, steps: [
      { id: 'frame', text: 'Assemble the portal frame', target: 'island.slot.portal-frame', until: { count: 'placed:portal-frame', atLeast: 8 } },
      { id: 'spark', text: 'Spark it with a crystal', target: 'island.slot.crystal',
        until: { any: [{ count: 'used:crystal', atLeast: 1 }, { owns: 'preset:charged-portal' }] } },
    ], reward: { credits: 100, unlock: ['class:shaman'] } },
    { id: 'rocket', title: 'Launch a rocket', requires: { done: 'portal' }, steps: [
      { id: 'pad', text: 'Build a launch pad', target: 'island.slot.launch-pad', until: { count: 'placed:launch-pad', atLeast: 1 } },
      { id: 'fuel', text: 'Fuel the rocket', target: 'island.slot.fuel-can', until: { count: 'fueled', atLeast: 1 } },
      { id: 'launch', text: 'Press the big red button', target: 'island.button.launch', until: { count: 'launched', atLeast: 1 } },
    ], reward: { credits: 200, presets: ['preset:tin-rocket'], unlock: ['space'] } },
  ],
};