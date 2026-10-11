// FIDELITY's narration table: every voiced line of docs/NARRATION_SCRIPT.md (public/vo/<ID>.mp3), its priority, its
// story order, and the game event that triggers it (the script's "When" column). The game measures each clip when it
// loads it and passes the lengths in.
import type { Line, Priority, Rules } from './index';

interface Def { readonly priority: Priority; readonly on: string; readonly after?: string; readonly cooldown?: number }

const DEFS: Readonly<Record<string, Def>> = {
  // Act I: awakening and emergency power
  'A1-01': { priority: 'story', on: 'wake' },
  'A1-02': { priority: 'story', on: 'look:power-wall', after: 'A1-01' },
  'A1-03': { priority: 'story', on: 'breaker:thrown', after: 'A1-01' },
  'A1-04': { priority: 'story', on: 'power:on', after: 'A1-01' },
  // Act II: the window and the gate
  'A2-01': { priority: 'story', on: 'look:window', after: 'A1-04' },
  'A2-02': { priority: 'story', on: 'gate:approach', after: 'A2-01' },
  'A2-03': { priority: 'story', on: 'gate:lever', after: 'A2-02' },
  'A2-04': { priority: 'story', on: 'gate:open', after: 'A2-02' },
  // Act III: the Moon at stage 0
  'A3-01': { priority: 'story', on: 'moon:enter' },
  'A3-02': { priority: 'warn', on: 'sync:low', cooldown: 90 },
  'A3-03': { priority: 'story', on: 'machine:first', after: 'A3-01' },
  // Act IV: the extraction tool and the meta-editor
  'A4-01': { priority: 'story', on: 'tool:pickup' },
  'A4-02': { priority: 'story', on: 'dirt:process', after: 'A4-01' },
  'A4-03': { priority: 'story', on: 'studio:open' },
  'A4-04': { priority: 'story', on: 'bloom:first' },
  // base building, harvesting and linked storage
  'B-01': { priority: 'story', on: 'build:foundation' },
  'B-02': { priority: 'bark', on: 'build:refused', cooldown: 60 },
  'B-03': { priority: 'story', on: 'build:collapse' },
  'B-04': { priority: 'story', on: 'harvest:pixels' },
  'B-05': { priority: 'story', on: 'bin:linked' },
  'B-06': { priority: 'story', on: 'drafting:blueprint' },
  'B-07': { priority: 'story', on: 'room:sealed' },
  // fabrication
  'F-01': { priority: 'story', on: 'fab:installed' },
  'F-02': { priority: 'story', on: 'fab:scout' },
  'F-03': { priority: 'story', on: 'weapon:swap' },
  'F-04': { priority: 'story', on: 'fab:hauler' },
  'F-05': { priority: 'story', on: 'fab:crawler' },
  // Monster Mash
  'M-01': { priority: 'story', on: 'mob:seen' },
  'M-02': { priority: 'story', on: 'mob:kill' },
  'M-03': { priority: 'warn', on: 'health:low', cooldown: 60 },
  // a plot reaching each stage
  'S-2': { priority: 'story', on: 'stage:2' },
  'S-3': { priority: 'story', on: 'stage:3' },
  'S-4': { priority: 'story', on: 'stage:4' },
  'S-5': { priority: 'story', on: 'stage:5' },
  'S-6': { priority: 'story', on: 'stage:6' },
  // synced and desynced
  'N-01': { priority: 'story', on: 'sync:on' },
  'N-02': { priority: 'story', on: 'sync:off' },
};

/** Event name to the lines it can trigger, in script order. */
export const FIDELITY_TRIGGERS: Readonly<Record<string, readonly string[]>> = (() => {
  const t: Record<string, string[]> = {};
  for (const [id, d] of Object.entries(DEFS)) (t[d.on] ??= []).push(id);
  return t;
})();

/**
 * The rules for FIDELITY, with each clip's measured length (seconds by line id). A line with no measured clip is left
 * out, so a missing file never stalls the queue.
 */
export function fidelityRules(seconds: Readonly<Record<string, number>>): Rules {
  const lines: Record<string, Line> = {};
  for (const [id, d] of Object.entries(DEFS)) {
    const s = seconds[id];
    if (s === undefined || !(s > 0)) continue;
    lines[id] = { id, priority: d.priority, seconds: s, ...(d.cooldown !== undefined ? { cooldown: d.cooldown } : {}), ...(d.after !== undefined ? { after: d.after } : {}) };
  }
  return { lines, triggers: FIDELITY_TRIGGERS, queueMax: 4, ttl: { story: Infinity, warn: 12, bark: 5 }, gap: 0.8 };
}

/** Every line id in the table (for checking it against the voiced files). */
export const FIDELITY_LINE_IDS: readonly string[] = Object.keys(DEFS);
