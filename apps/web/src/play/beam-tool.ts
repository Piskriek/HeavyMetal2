/**
 * The extraction beam as a tool (TASK-21): its three modes, the sculpt sub-modes, and the stroke each mode makes. Pure and
 * deterministic (no clock, no random): the scene asks what a stroke does, and @hm/terrainbrush does the ground and the ore.
 *
 * Extract is the existing harvest (the field nodes, `BEAM_RANGE`), so it has no stroke here. Apply paints the loaded
 * cartridge's preset under the aim point and costs no ore. Sculpt carves (gains ore), raises (costs ore) or smooths.
 */
import { apply as brushApply, type BrushKind, type BrushOp, type Field, type Result, type Rules } from '@hm/terrainbrush';
import type { BeamMode } from '@hm/beamkit';

/** The beam reaches this far (metres), held out in front of the player. */
export const BEAM_STROKE_RANGE = 25;
/** A stroke's radius on the ground (metres). */
export const STROKE_RADIUS = 3;
/**
 * The sculpt rules (TASK-21d): a carve digs at most 2 m down and a raise builds at most 2 m up, at 0.3 m a second under the brush's
 * centre. Rock is worth 1.5 ore a cubic metre, both ways: a carve gains it, a raise spends it.
 */
export const SCULPT_RULES: Rules = { maxDepth: 2, maxHeight: 2, orePerCubicMetre: 1.5, ratePerSecond: 0.3 };

export const BEAM_MODES: readonly BeamMode[] = ['extract', 'apply', 'sculpt'];
export const SCULPT_TOOLS = ['carve', 'raise', 'smooth'] as const;
export type SculptTool = (typeof SCULPT_TOOLS)[number];

/** What the beam is doing: which mode, which sculpt tool, and the cartridge in its port (null when empty). */
export interface BeamState {
  readonly mode: BeamMode;
  readonly sculpt: SculptTool;
  readonly cartridge: string | null;
}

export const BEAM_START: BeamState = { mode: 'extract', sculpt: 'carve', cartridge: null };

/** The next mode, one step forward (the wheel up, Q) or back (the wheel down). Wraps round. */
export function cycleBeamMode(mode: BeamMode, step: 1 | -1): BeamMode {
  const i = BEAM_MODES.indexOf(mode);
  const n = BEAM_MODES.length;
  return BEAM_MODES[(((i + step) % n) + n) % n]!;
}

/** The beam takes about 4 ore a second from a boulder on rock (the ruling), and more on scree: up to 3 more a second. */
export const BEAM_BOULDER_RATE = 4;
export const BEAM_SCREE_BONUS = 3;

/**
 * Ore a second the beam takes from a boulder, given the rock and scree weights of the ground under it (the terrain's material
 * weights, index 0 rock and 1 scree). Pure ground rock is 4; pure scree is 7; with neither, the boulder is still 4.
 */
export function boulderBeamRate(rock: number, scree: number): number {
  const r = Number.isFinite(rock) && rock > 0 ? rock : 0;
  const s = Number.isFinite(scree) && scree > 0 ? scree : 0;
  const share = r + s > 0 ? s / (r + s) : 0;
  return BEAM_BOULDER_RATE + BEAM_SCREE_BONUS * share;
}

/** In Sculpt, keys 1, 2 and 3 pick the tool (carve, raise, smooth). Any other key picks nothing. */
export function sculptToolForKey(code: string): SculptTool | null {
  if (code === 'Digit1') return 'carve';
  if (code === 'Digit2') return 'raise';
  if (code === 'Digit3') return 'smooth';
  return null;
}

/** The mode's sculpt tool as a brush kind. */
function brushOf(tool: SculptTool): BrushKind {
  return tool;
}

/**
 * The stroke a held beam makes at `aim` (ground metres) for `dt` seconds, or null when the mode makes none (Extract, or
 * Apply with an empty port). `strength` scales how much a stroke moves (1 is the tool as made).
 */
export function strokeOf(state: BeamState, aim: { readonly x: number; readonly z: number }, dt: number, strength = 1): BrushOp | null {
  if (state.mode === 'extract') return null;
  if (state.mode === 'apply') {
    if (!state.cartridge) return null;
    return { kind: 'paint', x: aim.x, z: aim.z, radius: STROKE_RADIUS, strength, dt, preset: state.cartridge };
  }
  return { kind: brushOf(state.sculpt), x: aim.x, z: aim.z, radius: STROKE_RADIUS, strength, dt };
}

/** A stroke's outcome: terrainbrush's result, and the player's ore after it (never below zero). */
export interface StrokeResult extends Result {
  /** The ore the player holds after the stroke: before, plus the stroke's change (a carve adds, a raise spends). */
  readonly balance: number;
}

/**
 * Makes one stroke on the ground. The ore is the player's: a carve adds to it (`ore` in the result is the change, positive),
 * a raise spends it and is limited by it (`ore` is then negative, never more than the player holds), and a paint costs
 * nothing. A broken ore count (NaN, negative) counts as none.
 */
export function runStroke(
  field: Field,
  base: (x: number, z: number) => number,
  op: BrushOp,
  rules: Rules,
  ore: number,
  protect?: (cellIndex: number) => boolean,
): StrokeResult {
  const held = Number.isFinite(ore) && ore > 0 ? ore : 0;
  const result = brushApply(field, base, op, rules, held, protect);
  return { ...result, balance: Math.max(0, held + result.ore) };
}
