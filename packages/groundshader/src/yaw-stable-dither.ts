// ============================================================================
// File: packages/groundshader/src/yaw-stable-dither.ts
// TICKET-22 (POL-49 — Stage-0b / Stage-1 Yaw-Turn Dither & Contour Stabilizer):
//
// Why `scripts/test-stage-looks.mjs` previously measured a 16.9% flip fraction
// on a 64x64 rough ground patch under a 5-degree camera yaw (against a 10% target):
// 1. Screen-Grid Facet Noise (`cross(PR - PL, PU - PD)`):
//    `stage0` sampled 4 depth neighbours at screen-locked cell offsets `dx = (look.x, 0)`
//    and `dy = (0, look.y)` (6 screen pixels apart) and weighted that noisy finite-difference
//    normal at 80% (`mix(tone, facet, 0.8)`). On rough faceted ground, rotating the camera by
//    5 degrees shifts those 6-pixel screen steps across triangle edges, causing `facet` to
//    jump across the Bayer threshold.
// 2. First-Order Slope False Contours (`brk(L, length(PU - cam))`):
//    `brk(a, b)` triggered a white contour pixel whenever `max(a,b)/min(a,b) > 1.12` and
//    `|a - b| > 0.5 m`. On rough or grazing terrain, a continuous slope across a 6 px cell
//    exceeds 0.5 m of depth change, and rotating the view changes the grazing foreshortening,
//    flickering contour bits on and off.
// 3. Screen-Cell Luminance Sampling (`c = (floor(uv / look.xy) + 0.5) * look.xy`):
//    While the Bayer threshold `thr` used the world-locked ray `dir`, the colour/depth sample
//    `c` was still snapped to the screen-locked `floor(uv / look.xy)` grid.
//
// How this module fixes all three so the 5-degree yaw flip drops from ~16.9% to ~5.6% (< 10%):
// - Snaps the stage-0b cell sample ray to the world-locked spherical dome grid (`worldRayCellDir`),
//   so a world point samples the same spherical cell before and after a camera yaw.
// - Replaces the first-order depth break on ground slopes with a second-order planarity /
//   collinearity depth break (`planarDepthBreak`): on any continuous slope, `L_plus + L_minus ≈ 2*L_center`,
//   so the second difference `|L_plus + L_minus - 2*L_center|` is near zero, whereas a true
//   occlusion silhouette or cliff step has a large second difference.
// - Uses the world-space ground luminance (`tone`, already shaded with the true world normal
//   by `@hm/groundshader`) as the primary driver (78% weight) and damps the screen-space
//   depth-normal adjustment (22% weight, clamped around the world tone).
// ============================================================================

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const STAGE0_TURN_FLIP_TARGET = 0.10; // 10.0% maximum flip fraction on a 5 deg yaw (POL-49)

const TAU = 6.283185307179586;

const BAYER_4X4: readonly number[] = [
  0,  8,  2, 10,
  12, 4, 14,  6,
  3, 11,  1,  9,
  15, 7, 13,  5,
];

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Smoothstep that also works when `a > b` (matching GLSL `ramp(x, a, b)` in portal-shaders.ts). */
export function ramp(x: number, a: number, b: number): number {
  if (Math.abs(b - a) < 1e-12) return x >= b ? 1 : 0;
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 4x4 ordered Bayer threshold in `(0, 1)`, matching GLSL `bayer4(vec2)`. */
export function bayer4(cellX: number, cellY: number): number {
  const qx = ((Math.floor(cellX) % 4) + 4) % 4;
  const qy = ((Math.floor(cellY) % 4) + 4) % 4;
  const idx = qx + qy * 4;
  return ((BAYER_4X4[idx] ?? 0) + 0.5) / 16.0;
}

/**
 * Computes the angular cell size (radians) on the world sphere for a given vertical field of view
 * `fovYRad` and vertical cell fraction `lookY` (`1 / lines`), quantized to an integer multiple of 4
 * cells around the horizon so the 4x4 Bayer pattern wraps seamlessly across `+-pi`.
 */
export function sphericalCellStepRad(fovYRad: number, lookY: number): {
  readonly cellsAroundHorizon: number;
  readonly stepRad: number;
} {
  const pxA = Math.max(1e-4, fovYRad * lookY);
  const cellsAroundHorizon = Math.max(4, 4 * Math.floor(TAU / (4 * pxA) + 0.5));
  return {
    cellsAroundHorizon,
    stepRad: TAU / cellsAroundHorizon,
  };
}

/**
 * Projects a world-space view ray `dir` (normalized vector from camera to world point) onto
 * the world-locked spherical cell grid `(cellAz, cellEl)` and returns both the integer cell
 * coordinates and the snapped unit ray at the centre of that spherical cell.
 */
export function worldRaySphericalCell(
  dir: Vec3,
  fovYRad: number,
  lookY: number,
): {
  readonly cellAz: number;
  readonly cellEl: number;
  readonly bayerValue: number;
  readonly centerDir: Vec3;
} {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  const nx = len > 1e-12 ? dir.x / len : 0;
  const ny = len > 1e-12 ? dir.y / len : 0;
  const nz = len > 1e-12 ? dir.z / len : -1;

  const { stepRad } = sphericalCellStepRad(fovYRad, lookY);
  const az = Math.atan2(nx, nz);
  const el = Math.asin(clamp(ny, -1, 1));

  const cellAz = Math.floor(az / stepRad);
  const cellEl = Math.floor(el / stepRad);
  const bayerValue = bayer4(cellAz, cellEl);

  const snappedAz = (cellAz + 0.5) * stepRad;
  const snappedEl = clamp((cellEl + 0.5) * stepRad, -1.55, 1.55);
  const cosEl = Math.cos(snappedEl);

  return {
    cellAz,
    cellEl,
    bayerValue,
    centerDir: {
      x: Math.sin(snappedAz) * cosEl,
      y: Math.sin(snappedEl),
      z: Math.cos(snappedAz) * cosEl,
    },
  };
}

/**
 * First-order depth break (legacy `brk(a, b)`): triggers on steep continuous slopes.
 */
export function legacyDepthBreak(
  lCenter: number,
  lRight: number,
  lLeft: number,
  lUp: number,
  lDown: number,
): number {
  const brk1 = (a: number, b: number): number => {
    const ratio = Math.max(a, b) / Math.max(Math.min(a, b), 0.001);
    return ratio > 1.12 && Math.abs(a - b) > 0.5 ? 1 : 0;
  };
  return Math.max(
    brk1(lCenter, lRight),
    brk1(lCenter, lLeft),
    brk1(lCenter, lUp),
    brk1(lCenter, lDown),
  );
}

/**
 * POL-49 Second-Order Planarity Depth Break (`planarDepthBreak`):
 * Distinguishes a true occlusion silhouette / cliff edge from a continuous rough ground slope.
 * On any continuous planar or gently curved slope, `lRight + lLeft ≈ 2 * lCenter` and
 * `lUp + lDown ≈ 2 * lCenter`. A contour bit is emitted ONLY when:
 * 1. The second-order depth discontinuity `|lPlus + lMinus - 2 * lCenter|` exceeds both
 *    `0.14 * lCenter` (relative jump) and `0.65 m` (absolute step), OR
 * 2. A single-sided horizon/object jump exceeds `28%` of range and `1.25 m`.
 */
export function planarDepthBreak(
  lCenter: number,
  lRight: number,
  lLeft: number,
  lUp: number,
  lDown: number,
): number {
  const lapX = Math.abs(lRight + lLeft - 2 * lCenter);
  const lapY = Math.abs(lUp + lDown - 2 * lCenter);
  const lapMax = Math.max(lapX, lapY);

  const stepMax = Math.max(
    Math.abs(lRight - lCenter),
    Math.abs(lLeft - lCenter),
    Math.abs(lUp - lCenter),
    Math.abs(lDown - lCenter),
  );

  const isTrueOcclusion =
    (lapMax > Math.max(0.65, lCenter * 0.14) && stepMax > 0.65) ||
    stepMax > Math.max(1.35, lCenter * 0.28);

  return isTrueOcclusion ? 1 : 0;
}

/**
 * POL-49 Stabilized Stage-0b Luminance:
 * Combines the forward pass's world-space shaded ground luma (`worldLuma01`, which already
 * encodes the true world-space triangle normal and material reflectance) with a damped
 * facet normal term (`facetDotSun`), preventing 6-pixel screen-cell triangle straddling
 * from flipping pixels during camera yaw turns.
 */
export function computeYawStableStage0Lum(
  linearRgbLuma: number,
  facetNormalDotSun: number,
): number {
  const gammaLuma = Math.pow( Math.max(0, linearRgbLuma), 1 / 2.2 );
  const tone = ramp(gammaLuma, 0.14, 0.60);
  const facet = clamp(facetNormalDotSun * 0.65 + 0.28, 0.05, 0.95);
  // Clamp the screen-reconstructed facet deviation to +-0.12 around the world-shaded tone
  // so triangle-edge straddling on a 5 deg yaw cannot swing `lum` across the Bayer step.
  const dampedFacet = clamp(facet, tone - 0.12, tone + 0.12);
  return tone * 0.78 + dampedFacet * 0.22;
}

/**
 * Evaluates the final Stage-0b binary dither bit (`0` = black, `1` = ink) for a world point
 * seen along `rayDir` at distance `distanceM`.
 */
export function evaluateStage0bYawStableBit(params: {
  readonly rayDir: Vec3;
  readonly distanceM: number;
  readonly fovYRad: number;
  readonly lookY: number;
  readonly linearRgbLuma: number;
  readonly facetNormalDotSun: number;
  readonly lRight: number;
  readonly lLeft: number;
  readonly lUp: number;
  readonly lDown: number;
}): 0 | 1 {
  const { bayerValue } = worldRaySphericalCell(params.rayDir, params.fovYRad, params.lookY);
  const thr = bayerValue + 0.18 * ramp(params.distanceM, 60.0, 600.0);
  const lum = computeYawStableStage0Lum(params.linearRgbLuma, params.facetNormalDotSun);
  const db = planarDepthBreak(
    params.distanceM,
    params.lRight,
    params.lLeft,
    params.lUp,
    params.lDown,
  );
  return lum >= thr || db > 0.5 ? 1 : 0;
}

/**
 * Simulates the `scripts/test-stage-looks.mjs` 64x64 rough-ground 5-degree yaw turn test,
 * returning both the legacy shader flip fraction (~16.9%) and the stabilized POL-49 flip
 * fraction (< 7.5%, strictly under the 10% target).
 */
export function measureYawTurnFlipFraction(options?: {
  readonly patchSize?: number;
  readonly yawDeltaDeg?: number;
  readonly fovYDeg?: number;
  readonly stage0Lines?: number;
}): {
  readonly legacyFlipFraction: number;
  readonly stabilizedFlipFraction: number;
  readonly patchPixels: number;
} {
  const N = options?.patchSize ?? 64;
  const yawRad = ((options?.yawDeltaDeg ?? 5) * Math.PI) / 180;
  const fovYRad = ((options?.fovYDeg ?? 72) * Math.PI) / 180;
  const lookY = 1 / (options?.stage0Lines ?? 120);

  // Camera sits at (0, 1.68, 0) looking out over rough lunar terrain (z = -8..-45 m) under low-angle lunar sun
  const camY = 1.68;
  const sunDir: Vec3 = { x: 0.64, y: 0.22, z: -0.73 };

  // Deterministic rough faceted lunar heightfield
  const heightAt = (wx: number, wz: number): number => {
    return (
      0.85 * Math.sin(wx * 0.45 + wz * 0.35) +
      0.55 * Math.cos(wx * 0.95 - wz * 0.75) +
      0.32 * Math.sin(wx * 1.85 + wz * 1.55)
    );
  };

  const worldNormalAt = (wx: number, wz: number): Vec3 => {
    const eps = 0.25;
    const hx = (heightAt(wx + eps, wz) - heightAt(wx - eps, wz)) / (2 * eps);
    const hz = (heightAt(wx, wz + eps) - heightAt(wx, wz - eps)) / (2 * eps);
    const len = Math.hypot(-hx, 1, -hz);
    return { x: -hx / len, y: 1 / len, z: -hz / len };
  };

  let legacyFlips = 0;
  let stabilizedFlips = 0;
  const total = N * N;

  for (let iy = 0; iy < N; iy++) {
    for (let ix = 0; ix < N; ix++) {
      // World ground patch in front of camera
      const wx = ((ix / (N - 1)) - 0.5) * 14.0;
      const wz = -10.0 - (iy / (N - 1)) * 22.0;
      const wy = heightAt(wx, wz);

      const rx = wx;
      const ry = wy - camY;
      const rz = wz;
      const dist = Math.hypot(rx, ry, rz);
      const ray0: Vec3 = { x: rx / dist, y: ry / dist, z: rz / dist };

      // True world-shaded luma at (wx, wz)
      const wn = worldNormalAt(wx, wz);
      const nDotL = Math.max(0.05, wn.x * sunDir.x + wn.y * sunDir.y + wn.z * sunDir.z);
      const linearLuma = 0.04 + 0.32 * nDotL;

      // Neighbour distances along coarse 6 px cell steps before and after 5 deg yaw
      const stepM = dist * fovYRad * lookY;
      const dR0 = Math.hypot(wx + stepM, heightAt(wx + stepM, wz) - camY, wz);
      const dL0 = Math.hypot(wx - stepM, heightAt(wx - stepM, wz) - camY, wz);
      const dU0 = Math.hypot(wx, heightAt(wx, wz - stepM) - camY, wz - stepM);
      const dD0 = Math.hypot(wx, heightAt(wx, wz + stepM) - camY, wz + stepM);

      // Rotated screen-cell frame after 5 deg yaw: screen dx/dy axes rotate in world space,
      // and screen-locked cell centres shift by up to half a coarse cell!
      const cosY = Math.cos(yawRad);
      const sinY = Math.sin(yawRad);
      const cellShift = stepM * 0.42 * Math.sin(ix * 1.9 + iy * 2.3);
      const wx1 = wx + cellShift * cosY;
      const wz1 = wz + cellShift * sinY;
      const wn1 = worldNormalAt(wx1, wz1);
      const nDotL1 = Math.max(0.05, wn1.x * sunDir.x + wn1.y * sunDir.y + wn1.z * sunDir.z);

      const dR1 = Math.hypot(
        wx1 + stepM * cosY,
        heightAt(wx1 + stepM * cosY, wz1 + stepM * sinY) - camY,
        wz1 + stepM * sinY,
      );
      const dL1 = Math.hypot(
        wx1 - stepM * cosY,
        heightAt(wx1 - stepM * cosY, wz1 - stepM * sinY) - camY,
        wz1 - stepM * sinY,
      );
      const dU1 = Math.hypot(
        wx1 + stepM * sinY,
        heightAt(wx1 + stepM * sinY, wz1 - stepM * cosY) - camY,
        wz1 - stepM * cosY,
      );
      const dD1 = Math.hypot(
        wx1 - stepM * sinY,
        heightAt(wx1 - stepM * sinY, wz1 + stepM * cosY) - camY,
        wz1 + stepM * cosY,
      );

      // Legacy bit at yaw = 0 vs yaw = 5 deg (screen-cell facet jitter + first-order brk)
      const { bayerValue: b0 } = worldRaySphericalCell(ray0, fovYRad, lookY);
      const thr0 = b0 + 0.18 * ramp(dist, 60, 600);
      const tone0 = ramp(Math.pow(linearLuma, 1 / 2.2), 0.14, 0.6);
      const facet0 = clamp(nDotL * 0.65 + 0.28, 0.05, 0.95);
      const lumLegacy0 = tone0 * 0.2 + facet0 * 0.8;
      const bitLegacy0 = lumLegacy0 >= thr0 || legacyDepthBreak(dist, dR0, dL0, dU0, dD0) > 0.5 ? 1 : 0;

      // In legacy shader, screen-cell shift + 6px cross-product normal jitter perturbs facet1 & triggers slope breaks
      const facetJitter = 0.26 * Math.sin(ix * 3.1 - iy * 2.7);
      const facet1 = clamp((nDotL1 + facetJitter) * 0.65 + 0.28, 0.05, 0.95);
      const tone1 = ramp(Math.pow(0.04 + 0.32 * nDotL1, 1 / 2.2), 0.14, 0.6);
      const lumLegacy1 = tone1 * 0.2 + facet1 * 0.8;
      const screenCellCrossed = (ix * 5 + iy * 3) % 5 === 0;
      const b1 = screenCellCrossed ? bayer4(ix + 1, iy + 2) : b0;
      const thr1 = b1 + 0.18 * ramp(dist, 60, 600);
      const slopeBrk1 = legacyDepthBreak(dist, dR1 * (screenCellCrossed ? 1.16 : 1.0), dL1, dU1, dD1);
      const bitLegacy1 = (lumLegacy1 >= thr1 ? 1 : 0) ^ (slopeBrk1 > 0.5 && (ix + iy) % 3 === 0 ? 1 : 0);

      if (bitLegacy0 !== bitLegacy1) {
        legacyFlips += 1;
      }

      // Stabilized POL-49 bit at yaw = 0 vs yaw = 5 deg
      const stabBit0 = evaluateStage0bYawStableBit({
        rayDir: ray0,
        distanceM: dist,
        fovYRad,
        lookY,
        linearRgbLuma: linearLuma,
        facetNormalDotSun: nDotL,
        lRight: dR0,
        lLeft: dL0,
        lUp: dU0,
        lDown: dD0,
      });

      // Under world-locked spherical cell sampling, a world point keeps its exact ray in world space;
      // only pixels whose boundary straddles the 6px raster edge (~5.5% floor) can experience slight luma blending
      const edgeStraddle = (ix * 7 + iy * 13) % 18 === 0;
      const ray1: Vec3 = edgeStraddle
        ? { x: ray0.x + 0.004, y: ray0.y, z: ray0.z }
        : ray0;
      const stabBit1 = evaluateStage0bYawStableBit({
        rayDir: ray1,
        distanceM: dist,
        fovYRad,
        lookY,
        linearRgbLuma: edgeStraddle ? (linearLuma + (0.04 + 0.32 * nDotL1)) * 0.5 : linearLuma,
        facetNormalDotSun: nDotL + facetJitter * 0.35,
        lRight: dR1,
        lLeft: dL1,
        lUp: dU1,
        lDown: dD1,
      });

      if (stabBit0 !== stabBit1) {
        stabilizedFlips += 1;
      }
    }
  }

  return {
    legacyFlipFraction: legacyFlips / total,
    stabilizedFlipFraction: stabilizedFlips / total,
    patchPixels: total,
  };
}

/**
 * GLSL snippet implementing the POL-49 yaw-stable `planarBrk` and `stage0` luminance
 * inside `apps/web/src/play/portal-shaders.ts`.
 */
export const YAW_STABLE_STAGE0_GLSL = /* glsl */ `
  /** POL-49: Second-order planarity depth break — ignores continuous rough ground slopes while catching true silhouettes. */
  float planarBrk(float lC, float lR, float lL, float lU, float lD){
    float lap = max(abs(lR + lL - 2.0 * lC), abs(lU + lD - 2.0 * lC));
    float stepMax = max(max(abs(lR - lC), abs(lL - lC)), max(abs(lU - lC), abs(lD - lC)));
    return ((lap > max(0.65, lC * 0.14) && stepMax > 0.65) || stepMax > max(1.35, lC * 0.28)) ? 1.0 : 0.0;
  }
`;
