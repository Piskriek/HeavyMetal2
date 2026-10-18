/**
 * The campaign chain (TASK-22): Acts IV to VI as a questline (`@hm/questline`), the counters the game bumps on events,
 * the unlock gates (a locked item says why), the monsters' unlock flag and the narration hooks they call.
 *
 * Pure: no clock, no randomness, no I/O. The screen (play.tsx) bumps counters when the action happens, and calls
 * `syncChain` with what the world shows (so an old save gets the credit it has earned). Counters only ever grow.
 *
 * The chain (docs/NARRATION_SCRIPT.md, docs/prompts/sidecar/22-campaign-chain.md): A4-01 to A4-04, B-01 to B-07, F-01 to
 * F-05. The monsters start after F-03 (the flag only; spawning and combat are TASK-23b).
 */
import { advance, check, skip, validate, START, type Cond, type Progress, type Questline, type Step as QStep } from '@hm/questline';
import type { Stack } from '@hm/lattice';

// ---------------------------------------------------------------------------------------------------------- counters
/** The counter keys the chain reads. Event counters are bumped by the action; derived ones come from `evidence`. */
export const COUNT = {
  stage: 'stage',
  drillsRunning: 'drill:running',
  toolPickup: 'tool:pickup',
  minedBeam: 'mined:beam',
  milled: 'milled',
  studioOpen: 'studio:open',
  harvestPxd: 'harvest:pxd',
  drafted: 'drafted',
  printedScout: 'printed:scout',
  drivenM: 'driven:m',
  forged: 'forged',
  fitted: 'fitted',
  equipSidearm: 'equip:sidearm',
  installedFabricator: 'installed:fabricator',
  mobSeen: 'mob:seen',
  mobKill: 'mob:kill',
  healthLow: 'health:low',
  deaths: 'deaths',
  /** The dormant anomaly (Act IV) is sealed: the step A4-01b. */
  dormantSealed: 'leak:dormant:sealed',
  /** Any other leak is sealed (the substrate drop). */
  leakSealed: 'leak:sealed',
  /** Act VII–IX counters (Brief 35 / TICKET-16). */
  hydroBasinLit: 'act7:hydro:lit',
  wreckTransponders: 'wreck:transponders',
  splicedCores: 'combiner:spliced',
  riftOrWaveCleared: 'act8:rift:cleared',
  biosphereStage4: 'act8:biosphere',
  horizonDomesSeen: 'act9:horizon:domes',
  consensusCommitted: 'act9:consensus:committed',
  finaleWindowHealed: 'act9:window:healed',
} as const;

/** Placed-piece counters are `placed:<kind>` (e.g. `placed:foundation`). */
export const placedKey = (kind: string): string => `placed:${kind}`;

// ---------------------------------------------------------------------------------------------------------- the data
const at = (key: string, n: number): Cond => ({ count: key, atLeast: n });
const every = (...cs: Cond[]): Cond => ({ all: cs });

/** The step text (the journal's title) and hint (what to do), by step id. Titles are the player's words. */
export const STEP_TEXT: Readonly<Record<string, { readonly title: string; readonly hint: string }>> = {
  'A4-01': { title: 'Take the extraction rifle', hint: 'It hangs on the armory rack in your lab. Open the cartridge rack (E) and take it down.' },
  'A4-01b': { title: 'Seal the dormant leak', hint: 'Draw the rifle (G), set it to Extract (Q), and hold the left button on the glitching leak by the perimeter until it locks. It gives an Anomaly Core.' },
  'A4-02': { title: 'Mine 50 dirt and feed the mill', hint: 'Draw the rifle (G), hold the left button on rock until you have 50 units. Then let the texture mill run for 10 s.' },
  'A4-03': { title: 'Open the Studio terminal', hint: 'Open the journal (Esc) and press Open the Studio. The variables are the simulation schema.' },
  'A4-04': { title: 'First colour bloom', hint: 'Reach stage 2 on the Moon. Colour is returning.' },
  'B-01': { title: 'Place a foundation', hint: 'Build menu (B), Structures tab: a Foundation, then E. Everything leans on something.' },
  'B-05': { title: 'Place a linked bin', hint: 'Structures tab: a Bin on your foundation. Its contents join the bridge storage.' },
  'B-04': { title: 'Harvest raw pixels', hint: 'Draw the rifle (G), set it to Extract (Q), and mine a field node. Chroma and dither nodes give raw pixels.' },
  'B-06': { title: 'Draft a blueprint', hint: 'Drafting table (K): one primitive and one map, and 10 ore.' },
  'B-07': { title: 'Seal a room', hint: 'An airlock and life support inside your walls. Breathe while you can.' },
  'F-01': { title: 'Install the fabricator', hint: 'Build a hardpoint (Structures), aim at it, then install the fabricator from the Heavy tab.' },
  'F-02': { title: 'Print the scout and drive 200 m', hint: 'Stage 2 opens the scout at the fabricator. Get in (E) and drive it 200 m.' },
  'F-03': { title: 'Make your first gun', hint: 'Weapon bench: craft a frame and a core, fit them into the gun, equip it to the sidearm, then swap one part.' },
  'F-04': { title: 'Unlock the hauler', hint: 'Stage 4 opens the hauler at the fabricator. Its bin rides on the bridge.' },
  'F-05': { title: 'Unlock the crawler', hint: 'Stage 6 opens the crawler at the fabricator.' },
  'A7-01': { title: 'Break the 12 kW ceiling', hint: 'Build a field Power Unit and wire a Relay Pylon so high-flux machines do not brown out the Gate.' },
  'A7-02': { title: 'Ignite the sky and flood the basin', hint: 'Run a Light Projector and Water Maker until Lx >= 0.65 and Aq >= 0.40, pooling water in the East basin.' },
  'A7-03': { title: 'Salvage 3 crater rim transponders', hint: 'Drive the Scout Rover to 3 perimeter wrecks and hold E on their transponders to recover Bridge logs and cores.' },
  'A8-01': { title: 'Synthesize a dual cartridge in the Combiner', hint: 'In the Lab Preset Combiner, fuse two cartridges or synthesize a peaceful Anomaly Core.' },
  'A8-02': { title: 'Hold the line or seal a perimeter rift', hint: 'Seal an active rift with the Beam Tool (Seal mode) or clear a perimeter wave with a weapon or turret.' },
  'A8-03': { title: 'Reach full PBR biosphere (Stage 4+)', hint: 'Push all four floats above Stage 4 (Pxd >= 0.85, Vtx >= 0.85, Lx >= 0.85, Aq >= 0.75) so trees and fauna bloom.' },
  'A9-01': { title: 'Spot the 11 lights on the horizon', hint: 'Look out at the 11 neighbor enclave domes glowing on the 4.2 km lunar horizon, then walk back through the Twin Gate.' },
  'A9-02': { title: 'Commit majority consensus at the Planet Table', hint: 'Press E on the round Planet Table in the Lab once continental consensus hits 85%+.' },
  'A9-03': { title: 'Watch the observation window heal', hint: 'Look through the Lab observation window as the Breach storm heals into golden hour and "Four Floats" begins.' },
};

/**
 * The chain as data. Each step's `until` is a condition on the counters; a step is done the first time it holds, and the
 * next step starts. Quests gate on the one before them, so the acts run in order.
 */
export const CHAIN: Questline = {
  id: 'fidelity-campaign',
  title: 'The Moon',
  quests: [
    {
      id: 'act4',
      title: 'Act IV: the extraction tool',
      requires: at(COUNT.drillsRunning, 1),
      steps: [
        { id: 'A4-01', text: STEP_TEXT['A4-01']!.title, until: at(COUNT.toolPickup, 1) },
        // the dormant anomaly by the perimeter: zero spawns; the beam seals it, and the first Anomaly Core drops (O4)
        { id: 'A4-01b', text: STEP_TEXT['A4-01b']!.title, until: at(COUNT.dormantSealed, 1) },
        { id: 'A4-02', text: STEP_TEXT['A4-02']!.title, until: every(at(COUNT.minedBeam, 50), at(COUNT.milled, 10)) },
        { id: 'A4-03', text: STEP_TEXT['A4-03']!.title, until: at(COUNT.studioOpen, 1) },
        { id: 'A4-04', text: STEP_TEXT['A4-04']!.title, until: at(COUNT.stage, 2) },
      ],
      reward: {},
    },
    {
      id: 'act5',
      title: 'Act V: the base',
      requires: { done: 'act4' },
      steps: [
        { id: 'B-01', text: STEP_TEXT['B-01']!.title, until: at(placedKey('foundation'), 1) },
        { id: 'B-04', text: STEP_TEXT['B-04']!.title, until: at(COUNT.harvestPxd, 1) },
        // the drafting table before the bin: a bin is a cube-family piece, and only a drafted blueprint builds it
        { id: 'B-06', text: STEP_TEXT['B-06']!.title, until: at(COUNT.drafted, 1) },
        { id: 'B-05', text: STEP_TEXT['B-05']!.title, until: at(placedKey('bin'), 1) },
        { id: 'B-07', text: STEP_TEXT['B-07']!.title, until: every(at(placedKey('airlock'), 1), at(placedKey('lifeSupport'), 1)) },
      ],
      reward: {},
    },
    {
      id: 'act6',
      title: 'Act VI: fabrication',
      requires: { done: 'act5' },
      steps: [
        { id: 'F-01', text: STEP_TEXT['F-01']!.title, until: at(COUNT.installedFabricator, 1) },
        { id: 'F-02', text: STEP_TEXT['F-02']!.title, until: every(at(COUNT.printedScout, 1), at(COUNT.drivenM, 200)) },
        { id: 'F-03', text: STEP_TEXT['F-03']!.title, until: every(at(placedKey('weaponBench'), 1), at(COUNT.forged, 2), at(COUNT.equipSidearm, 1), at(COUNT.fitted, 2)) },
        { id: 'F-04', text: STEP_TEXT['F-04']!.title, until: at(COUNT.stage, 4) },
        { id: 'F-05', text: STEP_TEXT['F-05']!.title, until: at(COUNT.stage, 6) },
      ],
      reward: {},
    },
    {
      id: 'act7',
      title: 'Act VII: the grid and the flood',
      requires: { done: 'act6' },
      steps: [
        { id: 'A7-01', text: STEP_TEXT['A7-01']!.title, until: every(at(placedKey('powerUnit'), 1), at(placedKey('relayPylon'), 1)) },
        { id: 'A7-02', text: STEP_TEXT['A7-02']!.title, until: at(COUNT.hydroBasinLit, 1) },
        { id: 'A7-03', text: STEP_TEXT['A7-03']!.title, until: at(COUNT.wreckTransponders, 3) },
      ],
      reward: {},
    },
    {
      id: 'act8',
      title: 'Act VIII: the splice and the canopy',
      requires: { done: 'act7' },
      steps: [
        { id: 'A8-01', text: STEP_TEXT['A8-01']!.title, until: at(COUNT.splicedCores, 1) },
        { id: 'A8-02', text: STEP_TEXT['A8-02']!.title, until: at(COUNT.riftOrWaveCleared, 1) },
        { id: 'A8-03', text: STEP_TEXT['A8-03']!.title, until: at(COUNT.biosphereStage4, 1) },
      ],
      reward: {},
    },
    {
      id: 'act9',
      title: 'Act IX: majority consensus',
      requires: { done: 'act8' },
      steps: [
        { id: 'A9-01', text: STEP_TEXT['A9-01']!.title, until: at(COUNT.horizonDomesSeen, 1) },
        { id: 'A9-02', text: STEP_TEXT['A9-02']!.title, until: at(COUNT.consensusCommitted, 1) },
        { id: 'A9-03', text: STEP_TEXT['A9-03']!.title, until: at(COUNT.finaleWindowHealed, 1) },
      ],
      reward: {},
    },
  ],
};

/** Every chain step in order, with its quest: the journal's list. */
export interface ChainStepInfo { readonly id: string; readonly quest: string; readonly title: string; readonly hint: string; readonly until: Cond }
export const CHAIN_STEPS: readonly ChainStepInfo[] = CHAIN.quests.flatMap((q) => q.steps.map((s: QStep) => ({
  id: s.id,
  quest: q.id,
  title: STEP_TEXT[s.id]?.title ?? s.text,
  hint: STEP_TEXT[s.id]?.hint ?? '',
  until: s.until,
})));

/** Problems with the chain data (empty when it is sound): the questline's own checks, and every step has its text. */
export function chainProblems(): string[] {
  const problems = validate(CHAIN);
  for (const s of CHAIN_STEPS) if (!STEP_TEXT[s.id]) problems.push(`step ${s.id} has no text`);
  return problems;
}

/**
 * The bridge stock Act V starts with (TASK-22). A fresh player has no primitives, and the first hardpoint, the first heavy
 * press and the first two drafts (a cube, then a chassis for the airlock and life support) all need them. The kit covers
 * one hardpoint (beam 4, chassis 2), one heavy press (cube 4, beam 4, chassis 2) and the drafts (cube 1, chassis 1), and
 * the maps for the drafts and the first pieces. The press makes every other primitive from harvested vertices.
 */
export const ACT_V_KIT: readonly Stack[] = [{ item: 'prim-beam', n: 8 }, { item: 'prim-chassis', n: 6 }, { item: 'prim-cube', n: 6 }, { item: 'map-basalt', n: 10 }];

// ---------------------------------------------------------------------------------------------------------- the state
/** Chain progress: the questline's progress, the counters, and the monsters' unlock flag (after F-03). */
export interface Chain {
  readonly progress: Progress;
  readonly counts: Readonly<Record<string, number>>;
  readonly monstersUnlocked: boolean;
  /** The chain's shape: 1 before the dormant leak (A4-01b), 2 from it. Old saves are moved up (readChain). */
  readonly version: number;
}

/** The chain's current shape (see Chain.version). */
export const CHAIN_VERSION = 2;

export const CHAIN_START: Chain = { progress: START, counts: {}, monstersUnlocked: false, version: CHAIN_VERSION };

/** Add `n` to an event counter (the action happened). */
export function bump(c: Chain, key: string, n = 1): Chain {
  return { ...c, counts: { ...c.counts, [key]: (c.counts[key] ?? 0) + n } };
}

/** Raise a counter to at least `value` (a derived counter: the world shows it). Never lowers one. */
export function setAtLeast(c: Chain, key: string, value: number): Chain {
  if ((c.counts[key] ?? 0) >= value) return c;
  return { ...c, counts: { ...c.counts, [key]: value } };
}

/** The steps finished so far, in order (a step is finished when the chain has moved past it). */
export function finishedSteps(p: Progress): string[] {
  const out: string[] = [];
  for (const q of CHAIN.quests) {
    if (p.finished.includes(q.id)) {
      out.push(...q.steps.map((s) => s.id));
      continue;
    }
    if (p.quest === q.id) {
      out.push(...q.steps.slice(0, p.step).map((s) => s.id));
    }
    break;
  }
  return out;
}

/** Whether a step is finished. */
export function stepDone(c: Chain, id: string): boolean {
  return finishedSteps(c.progress).includes(id);
}

/** Run the questline forward on the counters (the steps that now hold move on; a finished act unlocks the next). */
export function advanceChain(c: Chain): Chain {
  // the questline reads a finished act from `done`, which the caller supplies: run again while an act finishing
  // opens the next one (an act is at most a few steps, so this stops quickly)
  let progress = c.progress;
  for (let pass = 0; pass < 8; pass++) {
    const next = advance(CHAIN, { counts: c.counts, owns: [], done: progress.finished }, progress).progress;
    const same = JSON.stringify(next) === JSON.stringify(progress);
    progress = next;
    if (same) break;
  }
  const next: Chain = { ...c, progress };
  return stepDone(next, 'F-03') && !next.monstersUnlocked ? { ...next, monstersUnlocked: true } : next;
}

/** The current step and the one after it (or null at the end of the chain). */
export function chainView(c: Chain): { current: ChainStepInfo | null; next: ChainStepInfo | null; index: number; total: number } {
  const done = finishedSteps(c.progress);
  // not started until Act IV's gate holds (the drill runs): the plot's own objective shows until then
  const started = c.progress.quest !== null || c.progress.finished.length > 0;
  const current = started ? CHAIN_STEPS.find((s) => !done.includes(s.id)) ?? null : null;
  const idx = current ? CHAIN_STEPS.indexOf(current) : -1;
  return { current, next: idx >= 0 ? CHAIN_STEPS[idx + 1] ?? null : null, index: done.length, total: CHAIN_STEPS.length };
}

/** The first unmet part of a condition, with what the player has and needs ("12 / 50"); null when it holds. */
export function unmet(cond: Cond, counts: Readonly<Record<string, number>>): { key: string; have: number; need: number } | null {
  if ('all' in cond) {
    for (const sub of cond.all) {
      const u = unmet(sub, counts);
      if (u) return u;
    }
    return null;
  }
  if ('count' in cond) {
    const have = counts[cond.count] ?? 0;
    return have >= cond.atLeast ? null : { key: cond.count, have, need: cond.atLeast };
  }
  return check(cond, { counts, owns: [], done: [] }) ? null : { key: '', have: 0, need: 1 };
}

/** The journal's progress text for a step ("12 / 50"), or '' when it has none. */
export function stepProgress(s: ChainStepInfo, counts: Readonly<Record<string, number>>): string {
  const u = unmet(s.until, counts);
  return u && u.need > 1 ? `${Math.min(u.have, u.need)} / ${u.need}` : '';
}

/**
 * The debug menu's "Complete this step": the current step is marked done and the chain moves exactly one step on (the
 * questline's own skip, so a step whose successor already holds is NOT run through on the same click). Returns the same
 * chain when nothing is current (the chain has not started, or it is finished).
 */
export function completeStepChain(c: Chain): Chain {
  if (chainView(c).current === null) return c;
  return { ...c, progress: skip(CHAIN, c.progress) };
}

// ---------------------------------------------------------------------------------------------------------- gates
/** A feature the chain unlocks. A locked item says why (`gateReason`). */
export type Feature =
  | 'rifle'
  | 'structures'
  | 'drafting'
  | 'heavy'
  | 'fabricator'
  | 'weaponBench'
  | 'monsters'
  | 'combiner'
  | 'heavyTerraformers'
  | 'consensusTable'
  | 'freeplay';

/** What opens each feature: a plot stage, and a chain step that must be finished. */
export const GATES: Readonly<Record<Feature, { readonly stage?: number; readonly after?: string }>> = {
  rifle: { after: 'A4-01' },
  structures: { stage: 2, after: 'A4-04' },
  drafting: { after: 'A4-04' },
  heavy: { after: 'B-01' },
  fabricator: { stage: 2, after: 'B-07' },
  weaponBench: { after: 'F-01' },
  monsters: { after: 'F-03' },
  combiner: { after: 'A7-03' },
  heavyTerraformers: { stage: 3, after: 'A8-01' },
  consensusTable: { stage: 4, after: 'A8-03' },
  freeplay: { after: 'A9-03' },
};

/** Why a feature is locked, in the player's words; null when it is open. The stage reason comes first. */
export function gateReason(feature: Feature, c: Chain, stage: number): string | null {
  const g = GATES[feature];
  if (g.stage !== undefined && stage < g.stage) return `Needs stage ${g.stage}`;
  if (g.after && !stepDone(c, g.after)) {
    const title = STEP_TEXT[g.after]?.title ?? g.after;
    return `Needs: ${title} (${g.after})`;
  }
  return null;
}

/** Whether a feature is open. */
export const isOpen = (feature: Feature, c: Chain, stage: number): boolean => gateReason(feature, c, stage) === null;

// ---------------------------------------------------------------------------------------------------------- evidence
/** What the world shows, for the derived counters (see `syncChain`). */
export interface Evidence {
  readonly stage: number;
  readonly drillsRunning: number;
  /** Heavy machine kinds on the hardpoints. */
  readonly machineKinds: readonly string[];
  /** Vehicle kinds parked or driven. */
  readonly vehicleKinds: readonly string[];
  readonly sidearm: boolean;
  /** Item ids the player holds (pack, equipment, bins): a raw pixel or a drafted blueprint shows here. */
  readonly itemIds: readonly string[];
  /** Optional Act VII–IX world evidence (TICKET-16). */
  readonly hydroBasinLit?: boolean;
  readonly wreckTransponders?: number;
  readonly splicedCores?: number;
  readonly riftOrWaveCleared?: boolean;
  readonly biosphereStage4?: boolean;
  readonly horizonDomesSeen?: boolean;
  readonly consensusCommitted?: boolean;
  readonly finaleWindowHealed?: boolean;
}

/**
 * The counters the world already proves. Used by the sync, so an old save keeps the credit it earned. Pieces are NOT
 * derived: the starter shelter (free, placed at first boot) already holds a foundation, an airlock and life support, so a
 * piece counts only when the player places it (the place event bumps it). An old save re-does those steps.
 */
export function evidence(e: Evidence): Record<string, number> {
  const out: Record<string, number> = {
    [COUNT.stage]: e.stage,
    [COUNT.drillsRunning]: e.drillsRunning,
    [COUNT.equipSidearm]: e.sidearm ? 1 : 0,
    [COUNT.installedFabricator]: e.machineKinds.includes('fabricator') ? 1 : 0,
    [COUNT.printedScout]: e.vehicleKinds.includes('scout') ? 1 : 0,
  };
  // B-04 (harvest raw pixels with the beam) is NOT derived from held items: since TASK-23b-2 a sealed leak drops raw
  // pixels into the bridge store, so holding one no longer proves a harvest (TASK-23c found the chain skipping B-04 after
  // a seal). Only the base's `harvested` event counts it; an old save harvests once more, as it re-places pieces.
  if (e.itemIds.some((id) => id.startsWith('bp:') && id !== 'bp:starter')) out[COUNT.drafted] = 1;
  if (e.hydroBasinLit) out[COUNT.hydroBasinLit] = 1;
  if (e.wreckTransponders !== undefined && e.wreckTransponders > 0) out[COUNT.wreckTransponders] = e.wreckTransponders;
  if (e.splicedCores !== undefined && e.splicedCores > 0) out[COUNT.splicedCores] = e.splicedCores;
  if (e.riftOrWaveCleared) out[COUNT.riftOrWaveCleared] = 1;
  if (e.biosphereStage4) out[COUNT.biosphereStage4] = 1;
  if (e.horizonDomesSeen) out[COUNT.horizonDomesSeen] = 1;
  if (e.consensusCommitted) out[COUNT.consensusCommitted] = 1;
  if (e.finaleWindowHealed) out[COUNT.finaleWindowHealed] = 1;
  return out;
}

/** Merge the world's evidence into the counters (never lowers one), then run the questline. Idempotent. */
export function syncChain(c: Chain, e: Evidence): Chain {
  let next = c;
  for (const [key, value] of Object.entries(evidence(e))) next = setAtLeast(next, key, value);
  return advanceChain(next);
}

/** Chain state for a save that has none (a version 5 save): the derived counters and the questline from the start. */
export function chainFromSave(raw: unknown, e: Evidence): Chain {
  return syncChain(readChain(raw), e);
}

/** A saved chain, checked: anything odd falls back to the start, so a bad save never blocks the chain. */
export function readChain(raw: unknown): Chain {
  if (!raw || typeof raw !== 'object') return CHAIN_START;
  const r = raw as Record<string, unknown>;
  const p = r['progress'] as Record<string, unknown> | undefined;
  const counts: Record<string, number> = {};
  const rc = r['counts'];
  if (rc && typeof rc === 'object') {
    for (const [k, v] of Object.entries(rc as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) counts[k] = Math.floor(v);
    }
  }
  const quest = p && typeof p['quest'] === 'string' && CHAIN.quests.some((q) => q.id === p['quest']) ? (p['quest'] as string) : null;
  const finished = Array.isArray(p?.['finished']) ? (p!['finished'] as unknown[]).filter((x): x is string => typeof x === 'string' && CHAIN.quests.some((q) => q.id === x)) : [];
  const rewarded = Array.isArray(p?.['rewarded']) ? (p!['rewarded'] as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const stepRaw = typeof p?.['step'] === 'number' ? Math.max(0, Math.floor(p!['step'] as number)) : 0;
  const progress: Progress = { quest, step: stepRaw, finished, rewarded };
  const savedVersion = typeof r['version'] === 'number' && Number.isFinite(r['version']) ? Math.floor(r['version']) : 1;
  const chain: Chain = { progress, counts, monstersUnlocked: r['monstersUnlocked'] === true, version: CHAIN_VERSION };
  return savedVersion < 2 ? migrateV1(chain) : chain;
}

/**
 * A save from before A4-01b (version 1): the Act IV steps after the rifle move up by one. A save past the rifle has already earned
 * the seal (its step is credited), so it is not sent back to the dormant anomaly; a save still at the rifle keeps it, which is
 * now the next step after A4-01.
 */
function migrateV1(c: Chain): Chain {
  const p = c.progress;
  if (p.quest !== 'act4' || p.step < 1) return c;
  const credited = Math.max(1, c.counts[COUNT.dormantSealed] ?? 0);
  return { ...c, progress: { ...p, step: p.step + 1 }, counts: { ...c.counts, [COUNT.dormantSealed]: credited } };
}

// ---------------------------------------------------------------------------------------------------------- monsters (hooks)
// TASK-23b calls these when the monsters meet the player. Each bumps a counter; the screen plays the narration line
// (M-01 on the first sighting, M-02 on the first kill, M-03 when the player is hurt: a bark, repeatable on a cooldown).

/** A monster came into view. */
export const monsterSeen = (c: Chain): Chain => bump(c, COUNT.mobSeen);
/** A monster was neutralised. */
export const monsterKilled = (c: Chain): Chain => bump(c, COUNT.mobKill);
/** The player is hurt low (the screen decides the threshold and the cooldown). */
export const playerLow = (c: Chain): Chain => bump(c, COUNT.healthLow);
/** The player died: the screen respawns them at the gate; the inventory and the save stay. */
export const playerDied = (c: Chain): Chain => bump(c, COUNT.deaths);

/** Whether a monster line is due on its first event (story lines play once; the radio log keeps them). */
export const firstTime = (c: Chain, key: string): boolean => (c.counts[key] ?? 0) === 1;
