// The stage looks that the post pass draws (TASK-27; the owner's stage bible, docs/argo/plans/27-stage-look-bible.md) and the
// suit-cam optics (plan 25). Pure and deterministic: the scan wave, the world-locked dither index, the gate's amber pool, the
// analytical exposure filter and the suit-cam profile. The post shader (portal-shaders.ts) does the pixels; this module decides
// the numbers it is given, so the rules can be tested without a GPU.

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A smoothstep that also runs backwards (from > to), which GLSL's smoothstep does not promise. 0 at `from`, 1 at `to`. */
export function ramp(x: number, from: number, to: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

// ---- the gate's amber pool (DEC-06, Argo's sign-off: feather it, full within 3.5 m and gone by 15 m)

export const GATE_POOL_FULL_M = 3.5;
export const GATE_POOL_OFF_M = 15;

/** The amber pool's weight at `distM` from the gate: 1 inside 3.5 m, 0 from 15 m out. */
export function gatePoolWeight(distM: number): number {
  return ramp(distM, GATE_POOL_OFF_M, GATE_POOL_FULL_M);
}

// ---- the 0a to 0b scan wave (the first machine's tick: radius 0 to 350 m over 3.5 s, then a dither dissolve of the rest)

export const SCAN_RADIUS_M = 350;
export const SCAN_SECONDS = 3.5;
export const SCAN_DISSOLVE_SECONDS = 2.0;

export interface ScanWave {
  /** When the wave was triggered (clock seconds), or null before the first machine ticks. */
  startSec: number | null;
  /** The ring's centre, world metres (the first running machine). */
  centre: Vec3;
  /** The world is resolved and the wave is over. */
  done: boolean;
}

export function createScanWave(): ScanWave {
  return { startSec: null, centre: { x: 0, y: 0, z: 0 }, done: false };
}

/** Starts the wave when a machine first ticks on a wireframe world. Later calls do nothing. */
export function triggerScanWave(w: ScanWave, nowSec: number, centre: Vec3): void {
  if (w.done || w.startSec !== null) return;
  w.startSec = nowSec;
  w.centre = { x: centre.x, y: centre.y, z: centre.z };
}

/** A save that is already past the wave (its stage is above 0 or a machine ran): the world is resolved at once. */
export function markScanWaveDone(w: ScanWave): void {
  w.done = true;
  w.startSec = null;
}

export interface ScanFrame {
  /** The ring's radius in metres, or -1 when there is no ring. */
  readonly radius: number;
  /** 1 = wireframe outside the ring (0a), 0 = resolved (0b). */
  readonly wireMix: number;
}

/**
 * The post pass's wave uniforms at a given clock time. Before the first tick the world is wireframe (1). The ring runs out to 350 m over
 * 3.5 s; the ring then holds at 350 m while the wireframe outside it dissolves, one bit at a time, over 2 s; after that the world
 * is resolved (0), and there is no ring.
 */
export function scanFrame(w: ScanWave, nowSec: number): ScanFrame {
  if (w.done) return { radius: -1, wireMix: 0 };
  if (w.startSec === null) return { radius: -1, wireMix: 1 };
  const t = Math.max(0, nowSec - w.startSec);
  if (t < SCAN_SECONDS) return { radius: SCAN_RADIUS_M * (t / SCAN_SECONDS), wireMix: 1 };
  const dissolve = (t - SCAN_SECONDS) / SCAN_DISSOLVE_SECONDS;
  if (dissolve < 1) return { radius: SCAN_RADIUS_M, wireMix: 1 - dissolve };
  return { radius: -1, wireMix: 0 };
}

// ---- the world-locked dither (Obra Dinn's way): the threshold is indexed by the world direction, not the screen

/** The angle one look pixel spans (rad), from the vertical field of view and the look's lines. */
export function lookPixelAngle(fovYRad: number, lines: number): number {
  return fovYRad / Math.max(1, lines);
}

/**
 * The azimuth and elevation cell sizes: the azimuth wraps once in a whole number of 4-cell Bayer periods, so the dither has no
 * seam at +-pi. The elevation uses the same size, so the cells are square.
 */
export function sphericalCellSize(pxAngle: number): number {
  const cells = Math.max(4, 4 * Math.round(2 * Math.PI / (4 * Math.max(1e-6, pxAngle))));
  return (2 * Math.PI) / cells;
}

/** The integer cell of a world direction (from the camera to the point), in azimuth and elevation. */
export function worldDirectionCell(dir: Vec3, pxAngle: number): { readonly az: number; readonly el: number } {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const y = Math.min(1, Math.max(-1, dir.y / len));
  const size = sphericalCellSize(pxAngle);
  return {
    az: Math.floor(Math.atan2(dir.x / len, dir.z / len) / size),
    el: Math.floor(Math.asin(y) / size),
  };
}

/** The 4x4 ordered-dither threshold of a cell, in (0, 1). Matches the GLSL bayer4 in portal-shaders.ts. */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
export function bayer4(i: number, j: number): number {
  const x = ((i % 4) + 4) % 4, y = ((j % 4) + 4) % 4;
  return (BAYER4[x + y * 4]! + 0.5) / 16;
}

/** The world-locked threshold for a world direction at a look pixel of `pxAngle` radians. */
export function worldDither(dir: Vec3, pxAngle: number): number {
  const c = worldDirectionCell(dir, pxAngle);
  return bayer4(c.az, c.el);
}

// ---- the stage 0 dither's distance gradient: far surfaces need more light to show a bit

/** Adds to the threshold with distance (0 near, `GRADIENT` far), so distant ground goes darker in one bit. */
export const DITHER_GRADIENT = 0.18;
export function distanceThreshold(threshold: number, distM: number): number {
  return threshold + DITHER_GRADIENT * ramp(distM, 60, 600);
}

// ---- the suit cam's analytical exposure (plan 25 section 4.1): one lagging number, no GPU readback

/** The lagging exposure's time constants: fast when blinded by light, slow when the eye adapts to shade (plan 25). */
export const EXPOSURE_TAU_DOWN_SEC = 0.28;
export const EXPOSURE_TAU_UP_SEC = 0.55;

export interface ExposureState {
  /** The lagged exposure in stops (EV): positive is brighter. */
  ev: number;
}

export function createExposureState(targetLum: number): ExposureState {
  return { ev: evOf(targetLum) };
}

/** Stops for a scene luminance: lum 0.65 is +0.62 EV, lum 1 is 0 EV. */
export function evOf(lum: number): number {
  return -Math.log2(Math.max(1e-3, lum));
}

/**
 * The scene's target luminance from the view and the place (plan 25 section 4.1): `gateOrLab` is 0.65 inside the lab, 0.85 within
 * 12 m of the gate and 1 outside; `skyPitch` lifts the target when the view is up at the sky; `sunLook` darkens it when the view
 * is on the sun. Level, away from the sun, outdoors, the target is 1.
 */
export function exposureTargetLuminance(forward: Vec3, sunDir: Vec3, gateOrLab: number): number {
  const sunDot = forward.x * sunDir.x + forward.y * sunDir.y + forward.z * sunDir.z;
  const sunLook = Math.pow(Math.max(0, sunDot), 3);
  const skyPitch = Math.min(1, Math.max(0.2, forward.y * 0.5 + 0.5));
  return gateOrLab * (0.8 + 0.4 * skyPitch) * (1 + 0.25 * sunLook);
}

/** The lab's and the gate's lum factors (plan 25): 0.65 inside the lab, 0.85 within 12 m of the gate, 1 outside. */
export function gateOrLabFactor(inLab: boolean, distToGateM: number): number {
  if (inLab) return 0.65;
  return distToGateM < 12 ? 0.85 : 1;
}

/**
 * One step of the lagging exposure. Blinded by light (the target falls in EV) it steps down with a 0.28 s time constant; into
 * shade it recovers with 0.55 s. The overshoot after a step into daylight is the lag: the picture is briefly brighter, then it
 * settles. Returns the exposure multiplier, scaled by `swing` (Subtle uses about 0.41 of the swing: +-0.35 EV, not 0.85).
 */
export function stepExposure(state: ExposureState, targetLum: number, dt: number, swing = 1): { readonly exposure: number; readonly overshootEv: number } {
  const target = evOf(targetLum);
  const tau = target < state.ev ? EXPOSURE_TAU_DOWN_SEC : EXPOSURE_TAU_UP_SEC;
  state.ev += (target - state.ev) * (1 - Math.exp(-Math.max(0, dt) / tau));
  return { exposure: Math.pow(2, state.ev * swing), overshootEv: (state.ev - target) * swing };
}

// ---- the suit-cam optics (plan 25 section 4.3, the owner's toggle)

export type SuitCamSetting = 'auto' | 'full' | 'subtle' | 'off';

export interface SuitCamProfile {
  /** The optics' strength, 0 (off) to 1 (full). */
  readonly strength: number;
  /** The wide halation bloom (Medium, High and Ultra on Auto; always on Full). */
  readonly wide: boolean;
  /** The barrel's k1 (negative: gentle barrel). */
  readonly k1: number;
  /** The CMOS grain's amplitude (2.5% full, 1% subtle). */
  readonly grain: number;
  /** The exposure swing's scale (1 full, 0.41 subtle). */
  readonly swing: number;
}

export const SUIT_CAM_K1 = -0.035;
export const SUIT_CAM_GRAIN = 0.025;

/**
 * The profile for the Graphics setting (the player's choice wins, ruling of 15 October). `autoTier` is true on the GPU tiers that
 * can afford the optics (Medium, High and Ultra): Auto is off below it. Full is on everywhere, with the wide halation; Subtle is
 * half the strength on every tier; Off is nothing.
 */
export function suitCamProfile(setting: SuitCamSetting, autoTier: boolean): SuitCamProfile {
  switch (setting) {
    case 'off':
      return { strength: 0, wide: false, k1: 0, grain: 0, swing: 1 };
    case 'full':
      return { strength: 1, wide: true, k1: SUIT_CAM_K1, grain: SUIT_CAM_GRAIN, swing: 1 };
    case 'subtle':
      return { strength: 0.5, wide: autoTier, k1: -0.015, grain: 0.01, swing: 0.41 };
    case 'auto':
      return { strength: autoTier ? 1 : 0, wide: autoTier, k1: SUIT_CAM_K1, grain: SUIT_CAM_GRAIN, swing: 1 };
  }
}

/**
 * The suit cam's mix from the setting, the floats and the stage. Full is on at every stage. Auto and Subtle follow the look: on at
 * stages 4 to 6, ramped by Lx through smoothstep(0.45, 0.85, Lx), with no forcing (at the stage 4 threshold, Lx 0.68, it is 0.61).
 */
export function suitCamMix(setting: SuitCamSetting, lx: number, stage: number): number {
  if (setting === 'full') return 1;
  if (stage < 4) return 0;
  return ramp(lx, 0.45, 0.85);
}

/** The strength the shader gets: the setting's strength times the mix, halved while the build ribbon is open. */
export function suitCamStrength(profile: SuitCamProfile, mix: number, buildOpen: boolean): number {
  return profile.strength * mix * (buildOpen ? 0.5 : 1);
}
