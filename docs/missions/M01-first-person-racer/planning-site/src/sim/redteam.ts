// Pure reference math for the v2 (red-team) amendments. Each function is frozen in plan/redteam.ts.
import { clamp, TAU } from './gyro';

// ---- UQ7: release speed keeps loadout differences but cannot break exit order --------------
export const PACE_MIN = 0.94; // 700·0.94 = 658 ≥ 650 loop minimum ⇒ ride speed == release speed
export const PACE_MAX = 1.06;
export const MERGE_RELEASE_BASE = 700;
export const releaseVx = (pace: number, lo = PACE_MIN, hi = PACE_MAX) => MERGE_RELEASE_BASE * clamp(pace, lo, hi);

export interface CatchUpInput {
  gapTicks: number;
  paceMin: number;
  paceMax: number;
  rideDistance: number; // release point → loop exit, x-units (31 run-in + 2π·114.56 loop ≈ 751)
  diameter: number;
  margin: number;
}
export function catchUpBound(o: CatchUpInput) {
  const vMin = MERGE_RELEASE_BASE * o.paceMin;
  const vMax = MERGE_RELEASE_BASE * o.paceMax;
  const tRide = o.rideDistance / vMin; // the slowest leader's exposure window
  const gap = (o.gapTicks / 120) * vMin; // worst case: the leader is the slowest
  const closing = (vMax - vMin) * tRide;
  const budget = gap - o.diameter - o.margin;
  return { vMin, vMax, tRide, gap, closing, budget, ok: closing < budget, loopMinOk: vMin >= 650 };
}

// ---- UQ3: cage bars through the window without wagon-wheel strobing ------------------------
export const CAGE_BARS = 10;
export function cageBarAlpha(rollRate: number, frameDt: number, bars = CAGE_BARS) {
  const perFrame = Math.abs(rollRate) * frameDt;
  const nyquist = TAU / bars / 2;
  const ratio = perFrame / nyquist;
  const barAlpha = clamp((1 - ratio) / 0.5, 0, 1); // crisp until 50% of Nyquist, gone at Nyquist
  return { perFrame, nyquist, ratio, barAlpha, blurAlpha: 1 - barAlpha };
}

// ---- UQ13: arms bend at the elbow ------------------------------------------------------------
export interface P { x: number; y: number }
export function twoBoneIK(shoulder: P, target: P, l1: number, l2: number, bend: 1 | -1) {
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const d0 = Math.hypot(dx, dy);
  const d = clamp(d0, Math.abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6);
  const base = Math.atan2(dy, dx);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ang = base + bend * a;
  const elbow = { x: shoulder.x + Math.cos(ang) * l1, y: shoulder.y + Math.sin(ang) * l1 };
  const hand = { x: shoulder.x + Math.cos(base) * d, y: shoulder.y + Math.sin(base) * d };
  return {
    elbow,
    hand,
    upperDeg: (ang * 180) / Math.PI,
    foreDeg: (Math.atan2(hand.y - elbow.y, hand.x - elbow.x) * 180) / Math.PI,
    clamped: Math.abs(d - d0) > 1e-3,
  };
}

// ---- UQ12: rear/side awareness without a second render pass --------------------------------
export const RADAR_RANGE = 900; // engine units (x and z mixed; z is lane units)
export interface Blip { id: number; sx: number; sy: number; dist01: number; closing: boolean }
export function radarBlips(
  player: { x: number; z: number; vx: number },
  others: readonly { id: number; x: number; z: number; vx: number }[],
  range = RADAR_RANGE,
): Blip[] {
  const out: Blip[] = [];
  for (const o of others) {
    const dx = o.x - player.x;
    const dz = o.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > range) continue;
    const rel = o.vx - player.vx;
    out.push({
      id: o.id,
      sx: -dz / range, // +z is the far/left lane ⇒ left on the dial
      sy: -dx / range, // ahead ⇒ up
      dist01: d / range,
      closing: (dx < 0 && rel > 0) || (dx > 0 && rel < 0),
    });
  }
  return out;
}

// ---- UQ14: the cockpit darkens in the mine -------------------------------------------------
export function cockpitLight(caveBlend: number, fogRGB: readonly [number, number, number]) {
  const c = clamp(caveBlend, 0, 1);
  return { brightness: 1 - 0.45 * c, tintRGB: fogRGB, tintAlpha: 0.08 + 0.27 * c };
}

// ---- UQ11: own-impact feedback, bounded ------------------------------------------------------
export const JOLT_MAX_PX = 10;
export const JOLT_DECAY = 12; // 1/s
export function cockpitJolt(prev: number, impulse: number, dt: number, reducedMotion: boolean) {
  if (reducedMotion) return 0;
  return Math.min(JOLT_MAX_PX, prev * Math.exp(-JOLT_DECAY * dt) + impulse);
}

// ---- UQ1: slot choice never crosses another held rider ---------------------------------------
export const laneZ = (lane: number) => 480 - 240 * (lane + 0.5);
export function nearestFreeLane(z: number, taken: ReadonlySet<number>): number {
  let best = -1;
  let bestD = Infinity;
  for (let l = 0; l < 4; l++) {
    if (taken.has(l)) continue;
    const d = Math.abs(laneZ(l) - z);
    if (d < bestD) { bestD = d; best = l; }
  }
  return best;
}

// ---- UQ6: analog steering within a path ------------------------------------------------------
export const EDGE_HOP_MS = 150;
export function analogTargetZ(pathZ: number, halfWidth: number, axis: number) {
  // +axis = toward lane 3 (−z), matching changeLane(+1)
  return pathZ - clamp(axis, -1, 1) * Math.max(0, halfWidth - 37);
}
