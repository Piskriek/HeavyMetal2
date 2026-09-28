/**
 * MP-T14 — deterministic transcendentals for the simulation.
 *
 * `Math.sin`, `Math.exp`, `Math.pow` and friends are only required to be *approximately* right, so
 * V8, SpiderMonkey and JavaScriptCore may disagree in the last bit — enough to fork a replayed race.
 * These use only `+ - * /` and `Math.sqrt` (which IEEE-754 requires to be correctly rounded), so
 * every engine computes the same double. Accuracy is far inside 1e-7 (tests/det-math.test.ts).
 */

const PI = 3.141592653589793;
const HALF_PI = 1.5707963267948966;
const QUARTER_PI = 0.7853981633974483;
const LN2 = 0.6931471805599453;

/** sin on [-π/4, π/4] (Taylor to x^17). */
function sinCore(x: number): number {
  const x2 = x * x;
  let term = x; let sum = x;
  for (let n = 1; n <= 8; n++) { term *= -x2 / ((2 * n) * (2 * n + 1)); sum += term; }
  return sum;
}
/** cos on [-π/4, π/4] (Taylor to x^16). */
function cosCore(x: number): number {
  const x2 = x * x;
  let term = 1; let sum = 1;
  for (let n = 1; n <= 8; n++) { term *= -x2 / ((2 * n - 1) * (2 * n)); sum += term; }
  return sum;
}

/** Reduces x to r in [-π/4, π/4] and a quadrant q (x = q·π/2 + r). */
function reduce(x: number): [number, number] {
  const q = Math.round(x / HALF_PI);
  // Two-part π/2 (Cody–Waite) keeps the reduction accurate for the angles the sim uses.
  const r = (x - q * 1.5707963267341256) - q * 6.077100506506192e-11;
  return [r, ((q % 4) + 4) % 4];
}

export function dsin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  const [r, q] = reduce(x);
  return q === 0 ? sinCore(r) : q === 1 ? cosCore(r) : q === 2 ? -sinCore(r) : -cosCore(r);
}

export function dcos(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  const [r, q] = reduce(x);
  return q === 0 ? cosCore(r) : q === 1 ? -sinCore(r) : q === 2 ? -cosCore(r) : sinCore(r);
}

/** atan on any x: two half-angle reductions, then the Taylor series on |x| ≤ tan(π/16). */
function datan(x: number): number {
  if (x !== x) return NaN;
  if (x === Infinity) return HALF_PI;
  if (x === -Infinity) return -HALF_PI;
  const sign = x < 0 ? -1 : 1; let a = x * sign;
  let flip = false;
  if (a > 1) { a = 1 / a; flip = true; }
  // atan(a) = 2·atan(a / (1 + √(1 + a²))), twice: |a| ≤ tan(π/16) ≈ 0.199.
  a = a / (1 + Math.sqrt(1 + a * a));
  a = a / (1 + Math.sqrt(1 + a * a));
  const a2 = a * a;
  let term = a; let sum = a;
  for (let n = 1; n <= 12; n++) { term *= -a2; sum += term / (2 * n + 1); }
  let result = 4 * sum;
  if (flip) result = HALF_PI - result;
  return sign * result;
}

export function datan2(y: number, x: number): number {
  if (x > 0) return datan(y / x);
  if (x < 0) return datan(y / x) + (y >= 0 ? PI : -PI);
  if (y > 0) return HALF_PI;
  if (y < 0) return -HALF_PI;
  return 0;
}

export function dexp(x: number): number {
  if (x !== x) return NaN;
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  const k = Math.round(x / LN2);
  const r = (x - k * 0.6931471803691238) - k * 1.9082149292705877e-10;
  let term = 1; let sum = 1;
  for (let n = 1; n <= 16; n++) { term *= r / n; sum += term; }
  // × 2^k by exact doubling / halving.
  let scale = 1; const step = k < 0 ? 0.5 : 2;
  for (let i = 0, n = k < 0 ? -k : k; i < n; i++) scale *= step;
  return sum * scale;
}

export function dlog(x: number): number {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  if (x === Infinity) return Infinity;
  // x = m · 2^e with m in [√½, √2).
  let m = x; let e = 0;
  while (m >= 1.4142135623730951) { m *= 0.5; e++; }
  while (m < 0.7071067811865476) { m *= 2; e--; }
  // log(m) = 2·atanh(s), s = (m − 1)/(m + 1), |s| ≤ 0.172.
  const s = (m - 1) / (m + 1); const s2 = s * s;
  let term = s; let sum = s;
  for (let n = 1; n <= 14; n++) { term *= s2; sum += term / (2 * n + 1); }
  return 2 * sum + e * LN2;
}

/** a^b for a ≥ 0 (the sim only raises non-negative bases). */
export function dpow(a: number, b: number): number {
  if (b === 0) return 1;
  if (a === 0) return b > 0 ? 0 : Infinity;
  if (a < 0) return NaN;
  return dexp(b * dlog(a));
}

/** √(x² + y²): `Math.hypot` is not required to be correctly rounded; `sqrt` is. */
export function dhypot(x: number, y: number, z = 0): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export const DET_QUARTER_PI = QUARTER_PI;
