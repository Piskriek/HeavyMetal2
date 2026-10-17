// Sky atmospheric scattering module.
// Pure TypeScript, zero imports, no DOM, no Date, no Math.random, no I/O.

export type Vec3 = readonly [number, number, number];

export const SKY_ROWS: number = 64;

// ---- Physical constants (SI units, metres) ----
// Solar spectral irradiance per channel at the top of atmosphere. Value is
// chosen so that the resulting sky radiances stay within the [0, 10] range
// required by invariant 8 while preserving all relative colour / contrast
// relationships demanded by the other invariants.
const IRR = 10;
const R_BETA_R = 5.8e-6;
const G_BETA_R = 13.5e-6;
const B_BETA_R = 33.1e-6;
const BETA_M = 2.1e-5;
const H_R = 8000;
const H_M = 1200;
const G_M = 0.76;
const PI = Math.PI;

// Rayleigh vertical optical depths (from ground to space, zenith).
const R_RAYLEIGH_TAU_ZEN = R_BETA_R * H_R; // 0.0464
const G_RAYLEIGH_TAU_ZEN = G_BETA_R * H_R; // 0.108
const B_RAYLEIGH_TAU_ZEN = B_BETA_R * H_R; // 0.2648
const MIE_TAU_ZEN = BETA_M * H_M; // 0.0252

// ---- Small helpers ----
function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
function safeNormalize(v: Vec3): [number, number, number] {
  const x = v[0], y = v[1], z = v[2];
  let len2 = x * x + y * y + z * z;
  if (len2 <= 1e-20) return [0, 0, 0];
  const inv = 1 / Math.sqrt(len2);
  return [x * inv, y * inv, z * inv];
}

// ---- Public ----
export function density(stage: number): number {
  return smoothstep(2, 4.5, stage);
}

// Phases.
function rayleighPhase(cosTheta: number): number {
  return (3 / (16 * PI)) * (1 + cosTheta * cosTheta);
}
function miePhase(cosTheta: number, g: number): number {
  const g2 = g * g;
  const denom = 1 + g2 - 2 * g * cosTheta;
  return (1 - g2) / (4 * PI * denom * Math.sqrt(denom));
}

/**
 * Compute in-scattered radiance for one species (Rayleigh or Mie) given
 * view and sun direction sines and cosine of angle between them.
 * tauZen: species vertical optical depth at d=1 (beta*H).
 * d: density multiplier (0..1).
 * P: phase function value.
 */
function speciesL(
  muV: number,
  muS: number,
  tauZen: number,
  d: number,
  P: number
): number {
  // If no atmosphere, zero.
  if (d <= 0) return 0;

  // View ray: muV >= 0 (should already be ensured by caller).
  // Clamp to a small epsilon for numerical stability (horizon limit).
  const muV0 = Math.max(muV, 1e-4);
  const tauV = (d * tauZen) / muV0;

  if (muS >= 1e-4) {
    // Sun above horizon (or very nearly).
    const tauS = (d * tauZen) / muS;
    const num = Math.exp(-tauS) - Math.exp(-tauV);
    const denom = muS - muV0;
    // If muS ~ muV use L'Hopital limit (L = IRR * P * tauV * exp(-tauV)).
    if (Math.abs(denom) < 1e-6) {
      return IRR * P * tauV * Math.exp(-tauV);
    }
    return IRR * P * muS * num / denom;
  } else if (muS <= -1e-4) {
    // Sun below horizon.
    const muSabs = -muS;
    const tauS_prime = (d * tauZen) / muSabs;
    const sum = tauV + tauS_prime;
    return IRR * P * tauV * (1 - Math.exp(-sum)) / sum;
  } else {
    // muS ~ 0 (sun at horizon): both limits give 0 for flat atmosphere.
    return 0;
  }
}

/**
 * skyAt: linear-RGB radiance for view direction `dir`.
 * Returns [0,0,0] when dir is below horizon or zero-length.
 * Returned channels are guaranteed finite and in [0,10].
 */
export function skyAt(
  dir: Vec3,
  sunDir: Vec3,
  stage: number
): [number, number, number] {
  const d = density(stage);
  if (d <= 0) return [0, 0, 0];

  const v = safeNormalize(dir);
  const s = safeNormalize(sunDir);

  const muV = v[1];
  if (muV <= 0) return [0, 0, 0];

  // If sun direction is zero, no sunlight.
  const sLen = s[0] * s[0] + s[1] * s[1] + s[2] * s[2];
  if (sLen <= 1e-20) return [0, 0, 0];

  const muS = s[1];
  const cosTheta = clamp(v[0] * s[0] + v[1] * s[1] + v[2] * s[2], -1, 1);

  const pR = rayleighPhase(cosTheta);
  const pM = miePhase(cosTheta, G_M);

  const lR_r = speciesL(muV, muS, R_RAYLEIGH_TAU_ZEN, d, pR);
  const lR_g = speciesL(muV, muS, G_RAYLEIGH_TAU_ZEN, d, pR);
  const lR_b = speciesL(muV, muS, B_RAYLEIGH_TAU_ZEN, d, pR);
  const lM = speciesL(muV, muS, MIE_TAU_ZEN, d, pM);

  // Clamp to [0,10] to satisfy invariant 8.
  const outR = clamp(lR_r + lM, 0, 10);
  const outG = clamp(lR_g + lM, 0, 10);
  const outB = clamp(lR_b + lM, 0, 10);

  return [outR, outG, outB];
}

/**
 * skyGradient: fills `out` (Float32Array, length >= SKY_ROWS*3) with
 * azimuth-averaged sky radiance per elevation row. Row 0 = zenith,
 * row 63 = elevation 0.
 */
export function skyGradient(
  sunDir: Vec3,
  stage: number,
  out: Float32Array
): void {
  const d = density(stage);
  if (d <= 0) {
    for (let i = 0; i < SKY_ROWS * 3; i++) out[i] = 0;
    return;
  }
  const s = safeNormalize(sunDir);
  const sLen = s[0] * s[0] + s[1] * s[1] + s[2] * s[2];
  const sunNull = sLen <= 1e-20;

  const N_AZ = 16;
  const TWO_PI = 2 * PI;

  for (let i = 0; i < SKY_ROWS; i++) {
    // Elevation: linear from 90deg (row 0) down to 0deg (row SKY_ROWS-1).
    const e_deg = 90 * (1 - i / (SKY_ROWS - 1));
    const e = (e_deg * PI) / 180;
    const sinE = Math.sin(e);
    const cosE = Math.cos(e);

    let rSum = 0, gSum = 0, bSum = 0;
    for (let a = 0; a < N_AZ; a++) {
      const az = (a / N_AZ) * TWO_PI;
      const cA = Math.cos(az);
      const sA = Math.sin(az);
      const vx = cosE * cA;
      const vy = sinE;
      const vz = cosE * sA;

      let r = 0, g = 0, b = 0;
      if (!sunNull) {
        const muV = vy;
        const muS = s[1];
        const cosTheta = clamp(
          vx * s[0] + vy * s[1] + vz * s[2],
          -1,
          1
        );
        const pR = rayleighPhase(cosTheta);
        const pM = miePhase(cosTheta, G_M);
        r = speciesL(muV, muS, R_RAYLEIGH_TAU_ZEN, d, pR) +
            speciesL(muV, muS, MIE_TAU_ZEN, d, pM);
        g = speciesL(muV, muS, G_RAYLEIGH_TAU_ZEN, d, pR) +
            speciesL(muV, muS, MIE_TAU_ZEN, d, pM);
        b = speciesL(muV, muS, B_RAYLEIGH_TAU_ZEN, d, pR) +
            speciesL(muV, muS, MIE_TAU_ZEN, d, pM);
        r = clamp(r, 0, 10);
        g = clamp(g, 0, 10);
        b = clamp(b, 0, 10);
      }
      rSum += r;
      gSum += g;
      bSum += b;
    }
    const invA = 1 / N_AZ;
    const base = i * 3;
    out[base] = rSum * invA;
    out[base + 1] = gSum * invA;
    out[base + 2] = bSum * invA;
  }
}

/**
 * sunColour: transmittance-tinted sun disc colour, largest channel == 1.
 * Returns [1,1,1] when density == 0. When sun is below horizon and d>0
 * returns [0,0,0].
 *
 * Colour is normalised per channel against the zenith transmittance so
 * that the sun is white when high (zenith) and only tints toward red near
 * the horizon, in line with typical artistic/visual expectations.
 */
export function sunColour(
  sunDir: Vec3,
  stage: number
): [number, number, number] {
  const d = density(stage);
  if (d <= 0) return [1, 1, 1];
  const s = safeNormalize(sunDir);
  const muS = s[1];
  if (muS <= 1e-6) return [0, 0, 0];
  // Per-channel transmittance at this sun elevation.
  const tR = d * R_RAYLEIGH_TAU_ZEN / muS;
  const tG = d * G_RAYLEIGH_TAU_ZEN / muS;
  const tB = d * B_RAYLEIGH_TAU_ZEN / muS;
  // Mie is grey; when we later normalise by the max channel (red), its
  // effect on the ratios cancels, so we can skip it for the colour
  // calculation (equivalent to multiplying all channels by the same
  // exp(-tM) which then cancels in the division by max).
  const TR = Math.exp(-tR);
  const TG = Math.exp(-tG);
  const TB = Math.exp(-tB);
  // Zenith transmittance per channel (muS = 1), used as reference so
  // that the sun appears white when overhead.
  const TR0 = Math.exp(-d * R_RAYLEIGH_TAU_ZEN);
  const TG0 = Math.exp(-d * G_RAYLEIGH_TAU_ZEN);
  const TB0 = Math.exp(-d * B_RAYLEIGH_TAU_ZEN);
  // Per-channel ratio relative to zenith.
  const rR = TR / TR0;
  const rG = TG / TG0;
  const rB = TB / TB0;
  const mx = Math.max(rR, rG, rB);
  if (mx <= 1e-10) return [0, 0, 0];
  return [rR / mx, rG / mx, rB / mx];
}

/**
 * bakeSkyLut: fills `out` (length >= w*h*3) with a sky lookup table.
 * Columns (width w): azimuth relative to the sun, from 0 to 2PI.
 * Rows (height h): elevation from 90deg (row 0) down to 0 (row h-1).
 * The sun is assumed to be in the x>0 half at azimuth 0 for the purpose of
 * the table; only sunDir.y (sun elevation) is used.
 */
export function bakeSkyLut(
  sunDir: Vec3,
  stage: number,
  w: number,
  h: number,
  out: Float32Array
): void {
  const d = density(stage);
  const s = safeNormalize(sunDir);
  const muS = s[1];
  const sunNull =
    s[0] * s[0] + s[1] * s[1] + s[2] * s[2] <= 1e-20 || d <= 0;

  // Place sun at azimuth 0: sx = cos(sun_elev), sy = muS, sz = 0.
  const sxEff = Math.sqrt(Math.max(0, 1 - muS * muS));
  const syEff = muS;
  const szEff = 0;

  for (let j = 0; j < h; j++) {
    const e_deg = 90 * (1 - j / Math.max(1, h - 1));
    const e = (e_deg * PI) / 180;
    const sinE = Math.sin(e);
    const cosE = Math.cos(e);
    const muV = sinE;

    for (let i = 0; i < w; i++) {
      const az = (i / Math.max(1, w - 1)) * 2 * PI; // 0..2PI
      const cA = Math.cos(az);
      const sA = Math.sin(az);
      const vx = cosE * cA;
      const vy = sinE;
      const vz = cosE * sA;

      let r = 0, g = 0, b = 0;
      if (!sunNull && muV > 0) {
        const cosTheta = clamp(vx * sxEff + vy * syEff + vz * szEff, -1, 1);
        const pR = rayleighPhase(cosTheta);
        const pM = miePhase(cosTheta, G_M);
        r = speciesL(muV, muS, R_RAYLEIGH_TAU_ZEN, d, pR) +
            speciesL(muV, muS, MIE_TAU_ZEN, d, pM);
        g = speciesL(muV, muS, G_RAYLEIGH_TAU_ZEN, d, pR) +
            speciesL(muV, muS, MIE_TAU_ZEN, d, pM);
        b = speciesL(muV, muS, B_RAYLEIGH_TAU_ZEN, d, pR) +
            speciesL(muV, muS, MIE_TAU_ZEN, d, pM);
        r = clamp(r, 0, 10);
        g = clamp(g, 0, 10);
        b = clamp(b, 0, 10);
      }
      const idx = (j * w + i) * 3;
      out[idx] = r;
      out[idx + 1] = g;
      out[idx + 2] = b;
    }
  }
}
