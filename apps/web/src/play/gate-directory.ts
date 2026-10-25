/**
 * The planetary gate directory and the explorer's random dial (plan 42 §4.3, PLAN-42-GATE).
 *
 * A plot owner publishes three things about their Stargate: its 6-chevron address, whether the iris is open, shut to
 * everyone, or shut but dialable with the code, and the world it stands on. The explorer's console reads those as a
 * directory and "Dial Random Gate" picks one.
 *
 * Pure and deterministic: every function here is a function of its arguments. The selection itself is
 * `@hm/coopnet`'s `dialRandomOpenGate` — the same rule the network server runs — and this module only builds the
 * directory it reads and turns the chosen entry into the plot code the existing visit flow dials.
 *
 * Until the platform backend exists, the other plots are seeded simulations (the same approach the Community tab takes):
 * each entry owns a stable address, a stage, a world and a small deterministic machine set, so an explorer really does
 * step onto somebody else's plot. A real directory is the same array with real codes, so nothing here has to change when
 * it arrives — `dialRandomPlot` reads the entry, not the simulation.
 */
import { encode, KINDS, type Metric, type SnapMachine, type Snapshot } from '@hm/plotcodec';
import {
  canDialGate,
  dialRandomOpenGate,
  normalizeGateDialCode,
  type GateAccessMode,
  type GateDirectoryEntry,
} from '@hm/coopnet/gate-dialer';

/** The seed the simulated planet is built from. A constant, so every player sees the same neighbourhood. */
export const DIRECTORY_SEED = 0x504c4f54; // 'PLOT'

/** How many unclaimed plots the seeded directory holds. */
export const EXPLORER_PLOT_COUNT = 9;

/** The chevron alphabet: A-Z then 0-9, the six symbols a dial code is written in. */
const CHEVRONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** The owners of the seeded plots (the Community tab's neighbourhood, by name). */
export const EXPLORER_NAMES: readonly string[] = [
  'Mudwick', 'Snaggle', 'Fizzle', 'Grizzle', 'Pip', 'Nettle', 'Bramble', 'Quill', 'Tansy',
];

/** A plot's gate as the directory holds it: coopnet's entry, plus the world it stands on. */
export interface PlotGateEntry extends GateDirectoryEntry {
  readonly world: 'moon' | 'earth';
}

/** FNV-1a over a string, then a 32-bit avalanche: the same seed always gives the same plot. */
function hash32(text: string, salt = 0): number {
  let h = (2166136261 ^ Math.trunc(salt)) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const pick = <T>(list: readonly T[], h: number): T => list[h % list.length] as T;

/**
 * A plot's 6-chevron address from its identity and the directory seed. Six symbols of `A-Z0-9`, so it normalises the
 * same way a typed code does.
 */
export function gateAddress(id: string, seed = DIRECTORY_SEED): string {
  const h = hash32(id, seed);
  let out = '';
  let v = h;
  for (let i = 0; i < 6; i++) {
    out += CHEVRONS[v % CHEVRONS.length] as string;
    v = Math.floor(v / CHEVRONS.length) + (i + 1) * 7;
  }
  return out;
}

/**
 * The seeded planetary directory: `count` plots of other players, deterministic in `seed`. One in four is shut to
 * strangers (`code-only`) and one in six is closed outright, so the random dial has something to filter and the pool is
 * never all-open. Every entry keeps its `addressCode`, so a plot keeps the code a friend was told.
 */
export function planetaryGateDirectory(count: number = EXPLORER_PLOT_COUNT, seed: number = DIRECTORY_SEED): PlotGateEntry[] {
  const n = Math.max(0, Math.min(64, Math.trunc(count)));
  const out: PlotGateEntry[] = [];
  for (let i = 0; i < n; i++) {
    const id = `sim-${String(i + 1).padStart(2, '0')}`;
    const h = hash32(id, seed);
    const world: 'moon' | 'earth' = h % 5 === 3 ? 'earth' : 'moon';
    const roll = h % 12;
    const access: GateAccessMode = roll === 0 ? 'closed' : roll === 1 || roll === 2 || roll === 5 ? 'code-only' : 'open';
    out.push({
      plotId: id,
      addressCode: gateAddress(id, seed),
      access,
      ownerId: pick(EXPLORER_NAMES, h >>> 8),
      label: pick(EXPLORER_NAMES, h >>> 8),
      world,
      stage: 1 + ((h >>> 3) % 6),
    });
  }
  return out;
}

/**
 * The player's own plot as a directory entry: its address (from the owner code the plot is published under), its iris
 * state, and the world it stands on. `dialRandomOpenGate` excludes it by `plotId`, and its `access` only ever matters to
 * other explorers' consoles.
 */
export function ownGateEntry(input: {
  readonly plotId: string;
  readonly access: GateAccessMode;
  readonly world?: 'moon' | 'earth';
  readonly stage?: number;
  readonly label?: string;
}): PlotGateEntry {
  const id = input.plotId.trim() || 'own-plot';
  return {
    plotId: id,
    addressCode: gateAddress(id),
    access: input.access,
    world: input.world ?? 'moon',
    ...(input.stage !== undefined ? { stage: input.stage } : {}),
    ...(input.label ? { label: input.label } : {}),
  };
}

/** The directory the console reads: the player's own plot first, then the neighbourhood. */
export function gateDirectory(own: PlotGateEntry, count: number = EXPLORER_PLOT_COUNT, seed: number = DIRECTORY_SEED): PlotGateEntry[] {
  return [own, ...planetaryGateDirectory(count, seed)];
}

/** The plots anyone may dial at random (what `canDialGate` says an open gate is). */
export function openGateCount(directory: readonly PlotGateEntry[]): number {
  return directory.reduce((n, e) => n + (canDialGate(e) ? 1 : 0), 0);
}

// ------------------------------------------------------------------ the visitable plot

/** The machines a seeded plot builds, in the order the plot keeps them. */
const PLOT_KINDS = KINDS.slice(0, 7);
/** The quarter-turn grid a plot's machines stand on (a code stores yaw inside +-PI). */
const YAW_STEPS = [0, Math.PI / 2, -Math.PI / 2] as const;

/**
 * The plot a directory entry stands on, as the code a visit dials: `stage` machines set out on two rings around the gate
 * with a quarter-turn grid, points rising with the stage and one written cartridge. Deterministic in the entry's id and
 * address, so a code a player shares is the code they get back.
 */
export function explorerPlotSnapshot(entry: GateDirectoryEntry, seed: number = DIRECTORY_SEED): Snapshot {
  const id = entry.plotId;
  const address = normalizeGateDialCode(entry.addressCode) ?? gateAddress(id, seed);
  const h = hash32(`${id}:${address}`, seed);
  const stage = Math.max(1, Math.min(6, typeof entry.stage === 'number' ? Math.trunc(entry.stage) : 1 + ((h >>> 3) % 6)));
  const count = 2 + (h % 5);
  const machines: SnapMachine[] = [];
  for (let i = 0; i < count; i++) {
    const ring = i < 3 ? 7 : 15;
    // a third of a turn apart, offset by the plot's hash: no two machines share a spot, none stands on the gate
    const angle = ((h % 360) * Math.PI) / 180 + (i * 2 * Math.PI) / count;
    machines.push({
      kind: PLOT_KINDS[(h + i * 3) % PLOT_KINDS.length] as SnapMachine['kind'],
      x: Math.round(Math.sin(angle) * ring * 10) / 10,
      z: Math.round(Math.cos(angle) * ring * 10) / 10,
      yaw: YAW_STEPS[(h + i) % YAW_STEPS.length] as number,
      on: (h + i) % 3 !== 0,
      cartridge: -1,
    });
  }
  const level = 9000 + stage * 7000 + (h % 3000);
  const points: Record<Metric, number> = {
    pxd: level,
    vtx: level + (h % 401) - 200,
    lx: level + ((h >>> 5) % 401) - 200,
    aq: level + ((h >>> 9) % 401) - 200,
  };
  return {
    v: 1,
    owner: entry.label ?? entry.ownerId ?? address,
    stage,
    time: 0,
    points,
    machines,
    cartridges: [],
  };
}

/** The plot code for a directory entry (the string the visit flow dials), or null when it cannot be written. */
export function explorerPlotCode(entry: GateDirectoryEntry, seed: number = DIRECTORY_SEED): string | null {
  try {
    return encode(explorerPlotSnapshot(entry, seed));
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ the random dial

export interface RandomDialSuccess {
  readonly ok: true;
  /** The plot the chevrons locked onto. */
  readonly entry: PlotGateEntry;
  /** Its 6-chevron dial sequence, one glyph per chevron, bottom to top. */
  readonly dialSequence: readonly string[];
  /** The plot code the visit flow dials. */
  readonly code: string;
}

export interface RandomDialFailure {
  readonly ok: false;
  readonly reason: 'no-open-gates' | 'unencodable';
}

export type RandomDialResult = RandomDialSuccess | RandomDialFailure;

/**
 * "Dial Random Gate": an open plot that is not the player's own and not one they have just walked, chosen by
 * `@hm/coopnet`'s pure selection from `seed`. Once every open plot has been visited the pool reopens rather than
 * leaving the console dead (endless exploration, plan 42 §4.3).
 */
export function dialRandomPlot(
  directory: readonly PlotGateEntry[],
  ownPlotId: string,
  seed: number,
  visited: readonly string[] = [],
): RandomDialResult {
  const seen = new Set(visited.map((v) => v.trim()).filter(Boolean));
  // other plots a stranger may dial at all; among those, prefer the ones this explorer has not just walked
  const others = directory.filter((e) => e.plotId !== ownPlotId.trim() && canDialGate(e));
  const fresh = others.filter((e) => !seen.has(e.plotId) && !seen.has(e.addressCode));
  const pool = fresh.length > 0 ? fresh : others;
  const chosen = dialRandomOpenGate(pool, ownPlotId, seed);
  if (!chosen.ok) return { ok: false, reason: 'no-open-gates' };
  const entry = directory.find((e) => e.plotId === chosen.plotId) ?? { ...chosen.target, world: 'moon' as const };
  const code = explorerPlotCode(entry, DIRECTORY_SEED);
  if (!code) return { ok: false, reason: 'unencodable' };
  return { ok: true, entry, dialSequence: chosen.dialSequence, code };
}

/**
 * The seed for the next random dial: a counter over the player's own plot address, so pressing the button again gives
 * another plot (and the same press count always gives the same one).
 */
export function dialSeed(presses: number, ownPlotId = ''): number {
  const n = Math.max(0, Math.trunc(presses));
  // a golden-ratio stride per press, so two presses in a row do not land in the same hash bucket and the walks spread out
  return (hash32(ownPlotId || 'own-plot', DIRECTORY_SEED) + Math.imul(n + 1, 0x9e3779b1)) >>> 0;
}
