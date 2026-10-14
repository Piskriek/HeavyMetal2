// The props in the world, as saved per profile (TASK-23c): the lab clutter that was cleared (each one salvaged once), the lore logs
// that were read, and the leak sites that were sealed (their wreck props restored a rung). Pure: the screen reads and writes the
// string with kv, and every change returns a new value, so a bad or old save reads as the empty one.

export const PROPS_SAVE_KEY = 'hm.setmix.props';

export interface PropsSave {
  readonly v: 1;
  /** Clutter ids cleared by a salvage. A cleared prop is never given again. */
  readonly cleared: readonly string[];
  /** Lore log ids (LOG-01 to LOG-08) that have been read. */
  readonly logs: readonly string[];
  /** Leak site indices whose seal is done. */
  readonly sealed: readonly number[];
}

export const EMPTY_PROPS_SAVE: PropsSave = { v: 1, cleared: [], logs: [], sealed: [] };

const strings = (x: unknown): string[] => (Array.isArray(x) ? [...new Set(x.filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length <= 64))] : []);
const ints = (x: unknown): number[] => (Array.isArray(x) ? [...new Set(x.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 1000))].sort((a, b) => a - b) : []);

/** The save from its stored text. Anything unreadable, or of another version, is the empty save. */
export function parsePropsSave(raw: string | null): PropsSave {
  if (!raw) return EMPTY_PROPS_SAVE;
  try {
    const o = JSON.parse(raw) as { v?: unknown; cleared?: unknown; logs?: unknown; sealed?: unknown } | null;
    if (!o || o.v !== 1) return EMPTY_PROPS_SAVE;
    return { v: 1, cleared: strings(o.cleared), logs: strings(o.logs), sealed: ints(o.sealed) };
  } catch {
    return EMPTY_PROPS_SAVE;
  }
}

export function serializePropsSave(s: PropsSave): string {
  return JSON.stringify({ v: 1, cleared: [...s.cleared], logs: [...s.logs], sealed: [...s.sealed] });
}

/** The save with a prop cleared. Clearing a prop twice changes nothing (the same object comes back). */
export function clearedProp(s: PropsSave, id: string): PropsSave {
  return s.cleared.includes(id) ? s : { ...s, cleared: [...s.cleared, id] };
}

/** The save with a log read. Reading again changes nothing. */
export function readLog(s: PropsSave, id: string): PropsSave {
  return s.logs.includes(id) ? s : { ...s, logs: [...s.logs, id] };
}

/** The save with a leak site sealed. Sealing again changes nothing. */
export function sealedSite(s: PropsSave, site: number): PropsSave {
  return s.sealed.includes(site) ? s : { ...s, sealed: [...s.sealed, site].sort((a, b) => a - b) };
}
