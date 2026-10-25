/**
 * Plan 42 part 3 — the Earth endgame: portal transit, the dual-world gate telemetry hook, the completion monument and
 * the fidelity credit roll (JOB-09).
 *
 * Everything here is a pure function of `(fidelity stage, gate state, plot, clock, world stats)`. There is no cutscene
 * object, no `setTimeout`, no flag that is set once and closed again: the same inputs give the same answer on every
 * call, a scrub or a replay lands on exactly the state the play-through showed, and a save carries the inputs (the
 * stage and the two booleans) rather than a shot in progress. That is the 0-stateful-cutscene rule from the directive,
 * enforced by the module having no mutable state at all.
 *
 * The seam with the rest of the game is already built and this module is the missing half of it:
 *
 *  - `@hm/coopnet` answers *whether* a gate may be dialled and where a moved gate stands (`isEarthSandboxUnlocked`,
 *    `canDialGate`, `movePlotGate`, `setGateAccessMode`, `resolveMovedGatePose`);
 *  - `base/biome-preset.ts` holds the two plots' looks (`MOON_BIOME_PRESET`, `EARTH_BIOME_PRESET`) and refuses the Earth
 *    one before the stage that earns it;
 *  - `event-horizon.ts` draws the aperture and `gate-logic.ts` says whether the iris is open.
 *
 * What was missing is the state machine that joins them: when a step through a live horizon means *Earth*, which pose
 * you arrive at, what the two gates report to each other while both are powered, and when the Multiverse is finished.
 */
import type { CardinalLike, GateAccessMode, GatePlacement, GatePose, PlotWorldKind } from '@hm/coopnet/gate-dialer';
import {
  DEFAULT_GATE_PLACEMENT,
  EARTH_UNLOCK_FIDELITY_STAGE,
  canDialGate,
  isEarthSandboxUnlocked,
  movePlotGate,
  resolveMovedGatePose,
  setGateAccessMode,
} from '@hm/coopnet/gate-dialer';
import { EARTH_BIOME_PRESET, MOON_BIOME_PRESET, type PlotBiomePreset } from '../base/biome-preset';

/** Which world the player is standing on: the moon plot they built, or the Earth plot behind the gate. */
export type EndgamePlot = 'moon' | 'earth';

/** The chevron count at which a dial is complete (the nine the Stargate kit draws). */
export const GATE_CHEVRONS = 9;

/** The fidelity stage the Earth plot opens at (the same number `@hm/coopnet` and `base/biome-preset` gate on). */
export const ENDGAME_STAGE = EARTH_UNLOCK_FIDELITY_STAGE;

/** How long the fidelity credit roll runs, in seconds of the plot's clock. */
export const FIDELITY_CREDITS_SECONDS = 96;

/** Where the Earth arrival Gate stands on the Earth plot (plan 42: the arrival sector is the plot's own gate cell). */
export const EARTH_GATE_PLACEMENT: GatePlacement = Object.freeze({
  ...DEFAULT_GATE_PLACEMENT,
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  access: 'open',
}) as GatePlacement;

/**
 * The arrival sector: the pad 3.5 m in front of the gate, facing away from it, so a traveller steps out of the horizon
 * looking at the plot they just reached. Computed by `@hm/coopnet`'s own placement maths, not hand-written here.
 */
export const EARTH_ARRIVAL_SECTOR = Object.freeze(resolveMovedGatePose(EARTH_GATE_PLACEMENT).arrivalPad);

/** The moon plot's own return sector: where you stand after dialling home. */
export const MOON_RETURN_SECTOR = Object.freeze({ x: 0, y: 0, z: 3.5, yaw: Math.PI });

/** The two gates' state as the telemetry hook reads it. */
export interface EndgameGateState {
  /** The plot's grid is powered (the wiregraph reaches the gate's three conduits). */
  readonly powered: boolean;
  /** The horizon is live (the ninth chevron has locked). */
  readonly open: boolean;
  readonly irisClosed: boolean;
  readonly access: GateAccessMode;
  /** How many chevrons are locked: 0..9, the `uLockEnvelope` the shader draws. */
  readonly chevrons: number;
  /** The address the gate is holding, if it has one. */
  readonly addressCode?: string;
}

/** What the Multiverse has to show for itself: the monument's and the credits' numbers. */
export interface EndgameWorldStats {
  /** Machines standing and powered on the plot. */
  readonly machinesPowered: number;
  /** Machines the plot can hold (the denominator of the monument's first line). */
  readonly machinesTotal: number;
  /** Beam Rifle part cartridges applied to machines, vehicles or the gate. */
  readonly cartridgesApplied: number;
  /** `studio.kit.audit` is green for every kit the plot draws. */
  readonly auditsGreen: boolean;
  /** Material coverage readiness, 0..1 (the texture mill's share of the shelf). */
  readonly coverage: number;
}

/** Everything the endgame reads. Nothing here is mutated: a frame is a value, not an animation. */
export interface EndgameInput {
  /** The fidelity stage the plot has reached (0..6). */
  readonly stage: number;
  /**
   * The four Cardinal Floats, or one number applied to all four (`@hm/coopnet` reads the 0..100 level scale and the
   * 0..1 normalised one leniently; 100 means held). A plot that has not held all four cannot open the Earth side.
   */
  readonly cardinals: number | CardinalLike;
  readonly plot: EndgamePlot;
  readonly gate: EndgameGateState;
  /** The Earth Breach has been stabilised: the last thing the plot was built to do. */
  readonly breachStabilised: boolean;
  readonly stats: EndgameWorldStats;
  /** The plot's clock, in seconds. */
  readonly simTime: number;
  /** When the gate last changed state: the kawoosh's `tau = 0` for the horizon shader. */
  readonly lastGateEventTime: number;
}

/** Where a live horizon takes a traveller, and why it does or does not. */
export interface GateTransit {
  readonly ready: boolean;
  readonly to: EndgamePlot | null;
  /** A one-line reason, shown at the horizon and in the debug readout. */
  readonly why: string;
}

/** One heading of the credit roll. */
export interface CreditChapter {
  readonly heading: string;
  readonly lines: readonly string[];
}

/** The fidelity ending: the roll the plot plays when the Earth Breach is stable. Pure data, no player state. */
export interface FidelityEndingCredits {
  readonly title: string;
  readonly subtitle: string;
  readonly chapters: readonly CreditChapter[];
  readonly stats: readonly { readonly label: string; readonly value: string }[];
  /** The clock reading the roll started at (`simTime` when the endgame became active). */
  readonly startedAt: number;
  /** How long the roll runs. `creditsProgress` reads it against the clock. */
  readonly seconds: number;
}

/** What the completion monument displays on the Earth plot. */
export interface EndgameMonument {
  readonly title: string;
  readonly subtitle: string;
  readonly lines: readonly string[];
  readonly stats: readonly { readonly label: string; readonly value: string }[];
  /** The monument is interactive while the sandbox is open: building, driving and the beam all stay on. */
  readonly interactive: boolean;
}

/** The two gates as they report to each other: the dual-world telemetry hook. */
export interface DualWorldGateTelemetry {
  readonly moonGate: {
    readonly world: PlotWorldKind;
    readonly access: GateAccessMode;
    readonly open: boolean;
    readonly chevrons: number;
    /** The moon gate is dialable from the Earth side while both are powered. */
    readonly dialable: boolean;
  };
  readonly earthGate: {
    readonly world: PlotWorldKind;
    readonly access: GateAccessMode;
    readonly open: boolean;
    readonly chevrons: number;
    readonly dialable: boolean;
    /** The Earth gate's own pose, resolved through `@hm/coopnet`'s `movePlotGate` (never hand-placed). */
    readonly pose: GatePose;
  };
  /** The wiregraph reaches both gates: power routing is what links them. */
  readonly powered: boolean;
  /** The return dial: the code the Earth side holds for home, and whether it will answer. */
  readonly returnDial: { readonly ready: boolean; readonly code: string };
}

/** The whole endgame, evaluated. */
export interface EndgameState {
  /** Stage 6 and the four cardinals: the Earth plot may be entered at all. */
  readonly unlocked: boolean;
  /** The player stands on the Earth plot with the breach stable: the Multiverse is finished. */
  readonly endgameActive: boolean;
  readonly transit: GateTransit;
  readonly monument: EndgameMonument;
  readonly telemetry: DualWorldGateTelemetry;
  /** The roll, once the endgame is active; null before. */
  readonly credits: FidelityEndingCredits | null;
  /** The biome preset the plot draws with, given where the traveller stands. */
  readonly biome: PlotBiomePreset;
}

/** The save's endgame block (World v5 keeps it beside `base`, `boxes` and `vehicles`). */
export interface EndgameSave {
  readonly v: 5;
  readonly endgame: {
    /** The Earth plot has been entered at least once (the gate's arrival sector is lit). */
    readonly arrived: boolean;
    /** Which world the traveller was standing on when the save was written. */
    readonly plot: EndgamePlot;
    /** The credits have rolled to the end (the HUD's credits button unlocks on it). */
    readonly creditsSeen: boolean;
    /** The gate's access mode on the Earth side, so a return dial answers the way the player left it. */
    readonly earthGateAccess: GateAccessMode;
  };
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const percent = (n: number): string => `${Math.round(clamp01(n) * 100)}%`;

/** The four cardinals, from either shape the input accepts (`100` in every slot is all four held). */
export function cardinalLike(cardinals: number | CardinalLike): CardinalLike {
  if (typeof cardinals === 'number') return { Pxd: cardinals, Vtx: cardinals, Lx: cardinals, Aq: cardinals };
  return cardinals;
}

/** Whether the Earth plot is unlocked: stage six and every cardinal objective (the same rule the gate dialer uses). */
export function endgameUnlocked(i: Pick<EndgameInput, 'stage' | 'cardinals'>): boolean {
  return isEarthSandboxUnlocked(i.stage, cardinalLike(i.cardinals));
}

/**
 * Whether a step through the gate right now means *Earth* (from the moon plot) or *home* (from Earth), and if not, why.
 * The horizon has to be live and un-irised, the grid powered, and the plot unlocked — in that order, because that is the
 * order the player sees them fail in.
 */
export function gateTransit(i: EndgameInput): GateTransit {
  if (!endgameUnlocked(i)) {
    return { ready: false, to: null, why: `the Earth plot opens at fidelity stage ${ENDGAME_STAGE} with all four cardinals` };
  }
  if (!i.gate.powered) return { ready: false, to: null, why: 'the gate has no power: the wiregraph does not reach its conduits' };
  if (i.gate.irisClosed) return { ready: false, to: null, why: 'the iris is closed: open it from the dial console' };
  if (!i.gate.open) return { ready: false, to: null, why: `the dial is at ${i.gate.chevrons} of ${GATE_CHEVRONS} chevrons` };
  if (i.gate.chevrons < GATE_CHEVRONS) return { ready: false, to: null, why: `the dial is at ${i.gate.chevrons} of ${GATE_CHEVRONS} chevrons` };
  return { ready: true, to: i.plot === 'moon' ? 'earth' : 'moon', why: i.plot === 'moon' ? 'the horizon is live: step through to Earth' : 'the horizon is live: step through to the moon plot' };
}

/** The sector a traveller arrives in, for a destination (null when there is nowhere to go). */
export function arrivalSector(to: EndgamePlot | null): { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number } {
  if (to === 'earth') return EARTH_ARRIVAL_SECTOR;
  if (to === 'moon') return MOON_RETURN_SECTOR;
  return MOON_RETURN_SECTOR;
}

/** A gate's aperture in the plot's frame: what a step has to cross for the horizon to take it. */
export interface GateAperture {
  /** The aperture's centre (the gate pose plus its ring centre height). */
  readonly centre: readonly [number, number, number];
  readonly radius: number;
  /** The gate's facing, in the plot's frame (the horizon's normal). */
  readonly yaw: number;
}

/**
 * Whether a step crossed the horizon: the segment from `from` to `to` passes through the aperture's plane, inside its
 * radius. Pure and frame-rate independent — a fast drive and a slow walk cross on the same frame they pass the plane.
 */
export function crossedHorizon(
  from: { readonly x: number; readonly y: number; readonly z: number },
  to: { readonly x: number; readonly y: number; readonly z: number },
  aperture: GateAperture,
): boolean {
  const [cx, cy, cz] = aperture.centre;
  const nx = Math.sin(aperture.yaw);
  const nz = Math.cos(aperture.yaw);
  const before = (from.x - cx) * nx + (from.z - cz) * nz;
  const after = (to.x - cx) * nx + (to.z - cz) * nz;
  if (Math.sign(before) === Math.sign(after) || before === after) return false;
  // where the segment meets the plane, in the aperture's own plane coordinates
  const t = before / (before - after);
  const px = from.x + (to.x - from.x) * t;
  const py = from.y + (to.y - from.y) * t;
  const pz = from.z + (to.z - from.z) * t;
  const dx = px - cx;
  const dz = pz - cz;
  const lateral = Math.abs(dx * nz - dz * nx);
  const vertical = Math.abs(py - cy);
  return Math.hypot(lateral, vertical) <= aperture.radius;
}

/**
 * The event a crossing fires: 'to-earth' when the horizon took the traveller to the Earth plot, 'to-moon' when it
 * brought them home, null when there was nothing to cross into. The scene reports this; nothing plays.
 */
export function transitEventFor(i: EndgameInput, crossed: boolean): 'to-earth' | 'to-moon' | null {
  if (!crossed) return null;
  const transit = gateTransit(i);
  if (!transit.ready || !transit.to) return null;
  return transit.to === 'earth' ? 'to-earth' : 'to-moon';
}

/** The dual-world gate telemetry: both gates, the power that links them, and the return dial. */
export function dualWorldGateTelemetry(i: EndgameInput): DualWorldGateTelemetry {
  const moved = movePlotGate({ gate: EARTH_GATE_PLACEMENT }, { x: EARTH_GATE_PLACEMENT.x, y: EARTH_GATE_PLACEMENT.y, z: EARTH_GATE_PLACEMENT.z, yaw: EARTH_GATE_PLACEMENT.yaw });
  const earthAccess = setGateAccessMode({ access: i.gate.access }, i.gate.access).plot.access;
  const moonAccess = setGateAccessMode({ access: i.gate.access }, i.gate.access).plot.access;
  const linked = i.gate.powered;
  const returnCode = EARTH_GATE_PLACEMENT.addressCode;
  return {
    moonGate: {
      world: 'moon' as PlotWorldKind,
      access: moonAccess,
      open: i.gate.open && i.plot === 'moon',
      chevrons: i.gate.chevrons,
      dialable: linked && canDialGate({ access: i.gate.access, addressCode: returnCode }, returnCode),
    },
    earthGate: {
      world: 'earth' as PlotWorldKind,
      access: earthAccess,
      open: i.gate.open && i.plot === 'earth',
      chevrons: i.gate.chevrons,
      dialable: linked && canDialGate({ access: i.gate.access, addressCode: returnCode }, returnCode),
      pose: moved.gate,
    },
    powered: linked,
    returnDial: { ready: linked && i.plot === 'earth' && earthAccess !== 'closed', code: returnCode },
  };
}

/** The completion monument's readout: the numbers the Multiverse has to show. */
export function endgameMonument(i: EndgameInput): EndgameMonument {
  const powered = clamp01(i.stats.machinesTotal > 0 ? i.stats.machinesPowered / i.stats.machinesTotal : 0);
  return {
    title: 'Multiverse Telemetry',
    subtitle: 'Fidelity reached earth: the breach is stable and the sandbox is yours',
    lines: [
      `${i.stats.machinesPowered} of ${i.stats.machinesTotal} machines powered on the moon plot`,
      `${i.stats.cartridgesApplied} Beam Rifle cartridges fitted`,
      i.stats.auditsGreen ? 'every kit on the plot passes studio.kit.audit' : 'a kit on the plot has an open audit finding',
      `fidelity stage ${i.stage} of ${ENDGAME_STAGE}, four cardinals held`,
    ],
    stats: [
      { label: 'Power', value: percent(powered) },
      { label: 'Cartridges', value: String(i.stats.cartridgesApplied) },
      { label: 'Audits', value: i.stats.auditsGreen ? 'green' : 'open' },
      { label: 'Coverage', value: percent(i.stats.coverage) },
      { label: 'Worlds', value: dualWorldGateTelemetry(i).powered ? 'linked' : 'one' },
    ],
    // the sandbox never closes: the monument reads, it does not take the plot away
    interactive: true,
  };
}

/** The fidelity credit roll, built from the same numbers the monument shows. */
export function fidelityEndingCredits(i: EndgameInput): FidelityEndingCredits {
  const monument = endgameMonument(i);
  return {
    title: 'FIDELITY',
    subtitle: 'The SetMix Multiverse',
    startedAt: i.simTime,
    seconds: FIDELITY_CREDITS_SECONDS,
    chapters: [
      {
        heading: 'The Moon',
        lines: ['A plot built from ore, one machine at a time.', `${monument.stats[0]?.value ?? '0%'} of it stood powered at the end.`],
      },
      {
        heading: 'The Gate',
        lines: ['Nine chevrons and an event horizon that never had to be faked twice.', 'The Earth Breach held long enough to be walked through.'],
      },
      {
        heading: 'The Beam',
        lines: [`${i.stats.cartridgesApplied} cartridges fitted, every part named by the kit that made it.`],
      },
      {
        heading: 'Earth',
        lines: ['Water, a blue sky, and six species of tree grown from a seed.', 'The sandbox stays open. Build, drive, dress.'],
      },
    ],
    stats: monument.stats,
  };
}

/**
 * The roll's progress, 0..1, from the clock alone: `(simTime - startedAt) / seconds`. A scrub or a replay lands on the
 * same line because it reads the same two numbers — there is no tween to finish.
 */
export function creditsProgress(credits: FidelityEndingCredits, simTime: number): number {
  if (credits.seconds <= 0) return 1;
  return clamp01((simTime - credits.startedAt) / credits.seconds);
}

/** Whether the roll has finished (the HUD's credits button unlocks on it). */
export function creditsFinished(credits: FidelityEndingCredits, simTime: number): boolean {
  return creditsProgress(credits, simTime) >= 1;
}

/** The victory switch: Earth, unlocked, with the breach stabilised. This is the `isEndgameActive` the plan names. */
export function isEndgameActive(i: EndgameInput): boolean {
  return endgameUnlocked(i) && i.plot === 'earth' && i.breachStabilised;
}

/** The whole endgame, one pure evaluation of its inputs. */
export function earthEndgameState(i: EndgameInput): EndgameState {
  const unlocked = endgameUnlocked(i);
  const endgameActive = isEndgameActive(i);
  return {
    unlocked,
    endgameActive,
    transit: gateTransit(i),
    monument: endgameMonument(i),
    telemetry: dualWorldGateTelemetry(i),
    credits: endgameActive ? fidelityEndingCredits(i) : null,
    biome: i.plot === 'earth' && unlocked ? EARTH_BIOME_PRESET : MOON_BIOME_PRESET,
  };
}

/** The save patch a transit writes: World v5's endgame block, from the transition rather than from a counter. */
export function endgameSaveFor(i: EndgameInput, o: { readonly creditsSeen?: boolean } = {}): EndgameSave {
  return {
    v: 5,
    endgame: {
      arrived: i.plot === 'earth' || i.stage >= ENDGAME_STAGE,
      plot: i.plot,
      creditsSeen: o.creditsSeen ?? false,
      earthGateAccess: EARTH_GATE_PLACEMENT.access,
    },
  };
}

/** A save's endgame block, or the fresh-plot default when a save predates the endgame (World v4 and older). */
export function readEndgameSave(raw: unknown): EndgameSave['endgame'] {
  const fresh: EndgameSave['endgame'] = { arrived: false, plot: 'moon', creditsSeen: false, earthGateAccess: EARTH_GATE_PLACEMENT.access };
  if (!raw || typeof raw !== 'object') return fresh;
  const block = (raw as { readonly endgame?: unknown }).endgame;
  if (!block || typeof block !== 'object') return fresh;
  const b = block as Partial<EndgameSave['endgame']>;
  const plot: EndgamePlot = b.plot === 'earth' ? 'earth' : 'moon';
  const access: GateAccessMode = b.earthGateAccess === 'closed' || b.earthGateAccess === 'code-only' ? b.earthGateAccess : 'open';
  return { arrived: b.arrived === true, plot, creditsSeen: b.creditsSeen === true, earthGateAccess: access };
}

/**
 * The arrival the scene applies when a transit fires: the sector, the plot, the biome and the chevron count the horizon
 * comes up at. One object, so the scene never re-derives a pose or a preset on its own.
 */
export function transitArrival(i: EndgameInput): {
  readonly to: EndgamePlot;
  readonly sector: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number };
  readonly biome: PlotBiomePreset;
  readonly chevrons: number;
  readonly event: 'to-earth' | 'to-moon';
} | null {
  const transit = gateTransit(i);
  if (!transit.ready || !transit.to) return null;
  const to = transit.to;
  return {
    to,
    sector: arrivalSector(to),
    biome: to === 'earth' ? EARTH_BIOME_PRESET : MOON_BIOME_PRESET,
    chevrons: GATE_CHEVRONS,
    event: to === 'earth' ? 'to-earth' : 'to-moon',
  };
}
