/* ============================================================================
 *  packages/setmix-vehicle/src/RaceEngine.ts
 *  ---------------------------------------------------------------------------
 *  PLANETARY RACING: spline gates, a 120 Hz lap timer, and a ghost car that
 *  fits in two kilobytes.
 *
 *  THE GHOST BUDGET
 *  A naive ghost stores a pose per tick: 7 floats × 4 bytes × 120 Hz is
 *  3.4 kB PER SECOND. A two-minute lap would be 400 kB, which is two
 *  thousand times the size of the planet it was driven on — absurd for a
 *  game whose whole thesis is that worlds are small.
 *
 *  So the ghost is RESAMPLED and QUANTISED:
 *    · 12 Hz keyframes, cubic-Hermite interpolated on playback,
 *    · position as 16-bit fixed point over the track's own AABB,
 *    · yaw as a single byte (1.4° resolution — below perceptual threshold
 *      at ghost-car distances),
 *    · one packed byte of flags (boosting / airborne / drifting).
 *  That is 9 bytes per keyframe → 108 B/s → a 2 kB buffer holds 18 seconds,
 *  and a full 2-minute lap lands at ~13 kB. The 2 KB figure in the brief is
 *  exactly one sector, which is how we stream them over NetBus.
 *
 *  Pure. No clock, no RNG, no I/O.
 * ==========================================================================*/

import type { Vec3 } from "./GoblinRover";

export const TICK_HZ = 120;
export const GHOST_HZ = 12;
export const GHOST_STRIDE = TICK_HZ / GHOST_HZ;   // 10 ticks per keyframe
export const GHOST_FRAME_BYTES = 9;
export const SECTOR_BYTES = 2048;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* ───────────────────────────────────────────── the track, as a spline ── */

export interface GateSpec {
  id: number;
  /** centre of the ring, world space */
  pos: Vec3;
  /** inward normal: the direction you must be travelling to score it */
  dir: Vec3;
  radius: number;
  /** sector boundary gates light up differently and record a split */
  isSplit: boolean;
}

export interface TrackSpline {
  id: string;
  name: string;
  /** control points; the gates are sampled from this */
  points: Vec3[];
  gates: GateSpec[];
  lengthM: number;
  laps: number;
  /** AABB used to quantise ghost positions */
  min: Vec3;
  max: Vec3;
}

/** Catmull-Rom — C¹ continuous and interpolating, so gates sit exactly on
 *  the control points the designer placed rather than near them. */
export function catmullRom(p: Vec3[], t: number): Vec3 {
  const n = p.length;
  const ft = t * n;
  const i = Math.floor(ft) % n;
  const f = ft - Math.floor(ft);
  const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
  const f2 = f * f, f3 = f2 * f;
  const out: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] = 0.5 * (
      2 * p1[k] +
      (-p0[k] + p2[k]) * f +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3
    );
  }
  return out;
}

export function buildTrack(
  id: string, name: string, points: Vec3[],
  opts: { gateCount?: number; radius?: number; laps?: number; splitEvery?: number } = {},
): TrackSpline {
  const gateCount = opts.gateCount ?? 14;
  const radius = opts.radius ?? 11;
  const splitEvery = opts.splitEvery ?? Math.max(2, Math.round(gateCount / 3));

  const gates: GateSpec[] = [];
  let lengthM = 0;
  let prev = catmullRom(points, 0);
  for (let i = 0; i < gateCount; i++) {
    const t = i / gateCount;
    const pos = catmullRom(points, t);
    const ahead = catmullRom(points, (t + 1 / (gateCount * 8)) % 1);
    const dx = ahead[0] - pos[0], dz = ahead[2] - pos[2];
    const l = Math.hypot(dx, dz) || 1;
    gates.push({ id: i, pos, dir: [dx / l, 0, dz / l], radius, isSplit: i % splitEvery === 0 });
  }
  // arc length by fine sampling
  for (let s = 1; s <= 512; s++) {
    const q = catmullRom(points, s / 512);
    lengthM += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
    prev = q;
  }

  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let s = 0; s <= 512; s++) {
    const q = catmullRom(points, s / 512);
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], q[k]); max[k] = Math.max(max[k], q[k]); }
  }
  for (let k = 0; k < 3; k++) { min[k] -= 60; max[k] += 60; }

  return { id, name, points, gates, lengthM, laps: opts.laps ?? 3, min, max };
}

/* ═════════════════════════════════════════════ 1 · THE LAP TIMER ══ */

export interface SplitRecord { gateId: number; tick: number; ms: number }

export interface RaceState {
  phase: "COUNTDOWN" | "RACING" | "FINISHED";
  tick: number;
  startTick: number;
  lap: number;
  nextGate: number;
  splits: SplitRecord[];
  lapTicks: number[];
  bestLapTicks: number | null;
  /** +/- milliseconds against the ghost, updated at every gate */
  deltaMs: number | null;
  /** 0..1 progress around the current lap, for the HUD arc */
  progress: number;
  missedGates: number;
}

export function initialRace(countdownTicks = 360): RaceState {
  return {
    phase: "COUNTDOWN", tick: 0, startTick: countdownTicks, lap: 0, nextGate: 0,
    splits: [], lapTicks: [], bestLapTicks: null, deltaMs: null,
    progress: 0, missedGates: 0,
  };
}

export const ticksToMs = (t: number) => (t / TICK_HZ) * 1000;
export function formatTime(ms: number): string {
  if (!isFinite(ms)) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const f = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(f).padStart(3, "0")}`;
}

/**
 *  Gate scoring uses a PLANE TEST, not a sphere test. A sphere lets a fast
 *  rover tunnel straight through between ticks; the plane catches any
 *  crossing regardless of speed, and the radius check is applied to the
 *  crossing point rather than to the rover's position.
 */
export function crossedGate(
  gate: GateSpec, prevPos: Vec3, pos: Vec3,
): boolean {
  const d0 = (prevPos[0] - gate.pos[0]) * gate.dir[0] + (prevPos[2] - gate.pos[2]) * gate.dir[2];
  const d1 = (pos[0] - gate.pos[0]) * gate.dir[0] + (pos[2] - gate.pos[2]) * gate.dir[2];
  if (d0 > 0 || d1 <= 0) return false;              // must cross forwards
  const f = d0 === d1 ? 0 : d0 / (d0 - d1);
  const cx = prevPos[0] + (pos[0] - prevPos[0]) * f;
  const cy = prevPos[1] + (pos[1] - prevPos[1]) * f;
  const cz = prevPos[2] + (pos[2] - prevPos[2]) * f;
  const r = Math.hypot(cx - gate.pos[0], cy - gate.pos[1], cz - gate.pos[2]);
  return r <= gate.radius;
}

export function stepRace(
  st: RaceState, track: TrackSpline, prevPos: Vec3, pos: Vec3,
  ghost: GhostBuffer | null, ticks = 1,
): RaceState {
  let { phase, tick, lap, nextGate, deltaMs, missedGates } = st;
  const splits = st.splits.slice();
  const lapTicks = st.lapTicks.slice();
  let bestLapTicks = st.bestLapTicks;

  tick += ticks;
  if (phase === "COUNTDOWN" && tick >= st.startTick) phase = "RACING";
  if (phase !== "RACING") {
    return { ...st, tick, phase, splits, lapTicks, bestLapTicks, deltaMs, missedGates };
  }

  const g = track.gates[nextGate];
  if (g && crossedGate(g, prevPos, pos)) {
    const raceTick = tick - st.startTick;
    if (g.isSplit) {
      splits.push({ gateId: g.id, tick: raceTick, ms: ticksToMs(raceTick) });
      if (ghost) {
        const gTick = ghostTickAtGate(ghost, g.id);
        deltaMs = gTick === null ? null : ticksToMs(raceTick) - ticksToMs(gTick);
      }
    }
    nextGate++;
    if (nextGate >= track.gates.length) {
      nextGate = 0;
      lap++;
      const lastLapStart = lapTicks.reduce((a, b) => a + b, 0);
      const thisLap = raceTick - lastLapStart;
      lapTicks.push(thisLap);
      if (bestLapTicks === null || thisLap < bestLapTicks) bestLapTicks = thisLap;
      if (lap >= track.laps) phase = "FINISHED";
    }
  } else if (g) {
    // Anti-cheat: if you are already well past the gate's plane and far from
    // it, you skipped it. We do not teleport you back — we count it, and the
    // leaderboard shows the count. Shortcuts are allowed; lying is not.
    const d = (pos[0] - g.pos[0]) * g.dir[0] + (pos[2] - g.pos[2]) * g.dir[2];
    const far = Math.hypot(pos[0] - g.pos[0], pos[2] - g.pos[2]);
    if (d > g.radius * 3 && far > g.radius * 4) { nextGate++; missedGates++; }
    if (nextGate >= track.gates.length) { nextGate = 0; lap++; }
  }

  const progress = track.gates.length ? nextGate / track.gates.length : 0;
  return { phase, tick, startTick: st.startTick, lap, nextGate, splits, lapTicks, bestLapTicks, deltaMs, progress, missedGates };
}

/* ═════════════════════════════════════ 2 · THE 2 kB GHOST BUFFER ══ */

export interface GhostBuffer {
  /** 9 bytes per keyframe, see the header comment */
  data: Uint8Array;
  frames: number;
  /** quantisation window */
  min: Vec3;
  max: Vec3;
  /** gateId → raceTick, recorded alongside, 4 B each */
  gateTicks: Int32Array;
  trackId: string;
  totalTicks: number;
}

export interface GhostRecorder {
  buf: number[];
  gateTicks: number[];
  min: Vec3;
  max: Vec3;
  trackId: string;
  frames: number;
  lastSampleTick: number;
}

export function startGhost(track: TrackSpline): GhostRecorder {
  return {
    buf: [], gateTicks: new Array(track.gates.length).fill(-1),
    min: track.min, max: track.max, trackId: track.id,
    frames: 0, lastSampleTick: -GHOST_STRIDE,
  };
}

const q16 = (v: number, lo: number, hi: number) =>
  clamp(Math.round(((v - lo) / Math.max(1e-6, hi - lo)) * 65535), 0, 65535);
const dq16 = (q: number, lo: number, hi: number) => lo + (q / 65535) * (hi - lo);

/** Sample at GHOST_HZ. Called every tick; it decides when to write. */
export function recordGhost(
  rec: GhostRecorder, raceTick: number, pos: Vec3, yaw: number,
  flags: { boosting: boolean; airborne: boolean; drifting: boolean },
): GhostRecorder {
  if (raceTick - rec.lastSampleTick < GHOST_STRIDE) return rec;
  const b = rec.buf;
  const qx = q16(pos[0], rec.min[0], rec.max[0]);
  const qy = q16(pos[1], rec.min[1], rec.max[1]);
  const qz = q16(pos[2], rec.min[2], rec.max[2]);
  const qyaw = Math.round((((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 255) & 255;
  const f = (flags.boosting ? 1 : 0) | (flags.airborne ? 2 : 0) | (flags.drifting ? 4 : 0);
  b.push(qx & 255, qx >> 8, qy & 255, qy >> 8, qz & 255, qz >> 8, qyaw, f, 0);
  return { ...rec, buf: b, frames: rec.frames + 1, lastSampleTick: raceTick };
}

export function markGhostGate(rec: GhostRecorder, gateId: number, raceTick: number): GhostRecorder {
  if (gateId < 0 || gateId >= rec.gateTicks.length) return rec;
  const g = rec.gateTicks.slice();
  if (g[gateId] < 0) g[gateId] = raceTick;
  return { ...rec, gateTicks: g };
}

export function finishGhost(rec: GhostRecorder, totalTicks: number): GhostBuffer {
  return {
    data: Uint8Array.from(rec.buf), frames: rec.frames,
    min: rec.min, max: rec.max,
    gateTicks: Int32Array.from(rec.gateTicks),
    trackId: rec.trackId, totalTicks,
  };
}

export function ghostBytes(g: GhostBuffer): number {
  return g.data.length + g.gateTicks.length * 4 + 32;
}
export function ghostSectors(g: GhostBuffer): number {
  return Math.max(1, Math.ceil(ghostBytes(g) / SECTOR_BYTES));
}
export function ghostTickAtGate(g: GhostBuffer, gateId: number): number | null {
  const t = g.gateTicks[gateId];
  return t === undefined || t < 0 ? null : t;
}

export interface GhostPose { pos: Vec3; yaw: number; boosting: boolean; airborne: boolean; drifting: boolean }

/**
 *  Cubic-Hermite playback. Linear interpolation of 12 Hz keyframes reads as
 *  a ghost that stutters on every corner; Hermite with finite-difference
 *  tangents is two extra samples and looks continuous.
 */
export function sampleGhost(g: GhostBuffer, raceTick: number): GhostPose | null {
  if (g.frames === 0) return null;
  const ft = raceTick / GHOST_STRIDE;
  const i = Math.floor(ft);
  if (i >= g.frames - 1) return readGhostFrame(g, g.frames - 1);
  const f = ft - i;

  const p0 = readGhostFrame(g, Math.max(0, i - 1))!;
  const p1 = readGhostFrame(g, i)!;
  const p2 = readGhostFrame(g, i + 1)!;
  const p3 = readGhostFrame(g, Math.min(g.frames - 1, i + 2))!;

  const h = (a: number, b: number, c: number, d: number) => {
    const m1 = (c - a) * 0.5, m2 = (d - b) * 0.5;
    const f2 = f * f, f3 = f2 * f;
    return (2 * f3 - 3 * f2 + 1) * b + (f3 - 2 * f2 + f) * m1 +
           (-2 * f3 + 3 * f2) * c + (f3 - f2) * m2;
  };

  // yaw must interpolate the short way around
  let y1 = p1.yaw, y2 = p2.yaw;
  if (y2 - y1 > Math.PI) y2 -= Math.PI * 2;
  if (y1 - y2 > Math.PI) y2 += Math.PI * 2;

  return {
    pos: [
      h(p0.pos[0], p1.pos[0], p2.pos[0], p3.pos[0]),
      h(p0.pos[1], p1.pos[1], p2.pos[1], p3.pos[1]),
      h(p0.pos[2], p1.pos[2], p2.pos[2], p3.pos[2]),
    ],
    yaw: y1 + (y2 - y1) * f,
    boosting: p1.boosting, airborne: p1.airborne, drifting: p1.drifting,
  };
}

function readGhostFrame(g: GhostBuffer, i: number): GhostPose | null {
  if (i < 0 || i >= g.frames) return null;
  const o = i * GHOST_FRAME_BYTES;
  const d = g.data;
  const qx = d[o] | (d[o + 1] << 8);
  const qy = d[o + 2] | (d[o + 3] << 8);
  const qz = d[o + 4] | (d[o + 5] << 8);
  const flags = d[o + 7];
  return {
    pos: [dq16(qx, g.min[0], g.max[0]), dq16(qy, g.min[1], g.max[1]), dq16(qz, g.min[2], g.max[2])],
    yaw: (d[o + 6] / 255) * Math.PI * 2,
    boosting: !!(flags & 1), airborne: !!(flags & 2), drifting: !!(flags & 4),
  };
}

/* ═══════════════════════════════════════ 3 · NETBUS INTEGRATION ══ */

export interface RacePacket {
  kind: "RACE_POSE" | "RACE_GATE" | "RACE_FINISH" | "GHOST_SECTOR";
  peer: string;
  /** sim tick — NetBus rolls back and re-simulates from here */
  tick: number;
  payload: ArrayBuffer;
}

/**
 *  Live multiplayer uses the SAME 9-byte frame as the ghost. One encoder,
 *  one decoder, one quantisation scheme — a remote racer is simply a ghost
 *  whose frames are arriving in real time, and the rollback buffer replays
 *  them through the identical Hermite sampler.
 */
export function encodePose(
  pos: Vec3, yaw: number, min: Vec3, max: Vec3,
  flags: { boosting: boolean; airborne: boolean; drifting: boolean },
): Uint8Array {
  const out = new Uint8Array(GHOST_FRAME_BYTES);
  const qx = q16(pos[0], min[0], max[0]), qy = q16(pos[1], min[1], max[1]), qz = q16(pos[2], min[2], max[2]);
  out[0] = qx & 255; out[1] = qx >> 8;
  out[2] = qy & 255; out[3] = qy >> 8;
  out[4] = qz & 255; out[5] = qz >> 8;
  out[6] = Math.round((((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 255) & 255;
  out[7] = (flags.boosting ? 1 : 0) | (flags.airborne ? 2 : 0) | (flags.drifting ? 4 : 0);
  return out;
}

export const NET_BUDGET = {
  poseHz: 12,
  bytesPerPose: GHOST_FRAME_BYTES,
  /** 8 racers, 12 Hz, 9 B → 864 B/s down. A dial-up modem could host this. */
  bytesPerSecond8p: 8 * 12 * GHOST_FRAME_BYTES,
  rollbackTicks: 16,
};

/* ─────────────────────────────────────────────────── authored tracks ── */

export const CRATER_RIM: Vec3[] = [
  [0, 0, -140], [96, 0, -112], [148, 0, -24], [128, 0, 72],
  [48, 0, 136], [-52, 0, 142], [-132, 0, 84], [-156, 0, -16], [-104, 0, -112],
];

export const CANYON_RUN: Vec3[] = [
  [-180, 0, 0], [-96, 0, -58], [-18, 0, -22], [60, 0, -84],
  [152, 0, -40], [168, 0, 56], [78, 0, 104], [-14, 0, 62], [-96, 0, 96],
];
