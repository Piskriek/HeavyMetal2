/**
 * Plan 57 §10: the grid room is the menu, the warm-up and the bridge stage. It climbs FIDELITY's own stage ladder as the
 * game's presets warm: wireframe, 1-bit, EGA, VGA, then Gouraud, the stage a player starts at (the owner, 28 Oct).
 *
 * The warm-up is the preset ladder, rung by rung (Argon's note): each job is a real cached pass play reuses, so every tick
 * of the bar is a preset locking in. Each rung has a plinth in the room that fills when its rung is warm.
 *   atoms: shader programs and sound samples      stacks: the stage looks (a material stack per stage)
 *   parts: the smooth models                      assemblies: the generated props      worlds: the neighbouring worlds' looks
 * Pure: the room and its component use this.
 */

export type RoomStage = '0a' | '0b' | '1' | '2' | '3';
export const ROOM_STAGES: readonly RoomStage[] = ['0a', '0b', '1', '2', '3'];

export type Rung = 'atoms' | 'stacks' | 'parts' | 'assemblies' | 'worlds';
/** The ladder in order: a plinth per rung, smallest to largest. */
export const RUNGS: readonly Rung[] = ['atoms', 'stacks', 'parts', 'assemblies', 'worlds'];

/** One warm-up job: which rung it fills, what the bar says, and how much of the bar it is. */
export interface WarmJob {
  readonly rung: Rung;
  readonly label: string;
  readonly weight: number;
}

/** The share of the warm-up's weight done after the first `n` jobs (0..1; an empty list is done). */
export function warmShare(jobs: readonly WarmJob[], n: number): number {
  const total = jobs.reduce((s, j) => s + j.weight, 0);
  if (total <= 0) return 1;
  const done = jobs.slice(0, Math.max(0, n)).reduce((s, j) => s + j.weight, 0);
  return Math.min(1, done / total);
}

/** The room's stage for the share done: it reaches 3 only when everything is warm. */
export function roomStageAt(share: number): RoomStage {
  if (share >= 1) return '3';
  if (share >= 0.7) return '2';
  if (share >= 0.45) return '1';
  if (share >= 0.2) return '0b';
  return '0a';
}

/** The rungs whose every job is done after the first `n` jobs (a rung with no jobs is never shown warm). */
export function rungsWarm(jobs: readonly WarmJob[], n: number): ReadonlySet<Rung> {
  const out = new Set<Rung>();
  for (const r of RUNGS) {
    const idx = jobs.map((j, i) => (j.rung === r ? i : -1)).filter((i) => i >= 0);
    if (idx.length && idx.every((i) => i < n)) out.add(r);
  }
  return out;
}

/** The room's frame cap: 30 a second on the light tiers, 60 otherwise (it only draws when something changed). */
export function roomFrameCap(tier: string): number {
  return tier === 'potato' || tier === 'low' ? 30 : 60;
}

/** Whether a frame is due under the cap (`now` and `last` in ms; a small slack so 60 on a 60 Hz screen is never skipped). */
export function frameDue(now: number, last: number, capFps: number): boolean {
  return now - last >= 1000 / capFps - 2;
}

/** The 16 EGA colours, as the hardware drew them (stage 1's palette). */
export const EGA_PALETTE: readonly string[] = [
  '#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
  '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff',
];

/** A hex colour as display values 0..1, written to the screen as they are (the stage shader does no colour management). */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
