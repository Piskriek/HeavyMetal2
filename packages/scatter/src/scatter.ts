import { PointHash } from './hash';
import { poissonDisc } from './poisson';
import { mixSeed, mulberry32 } from './rng';
import { distanceToLoop, dominantSurface, heightAt, slopeDeg } from './sample';
import type { Placement, ScatterOptions, ScatterRule, TerrainLike, Vec2 } from './types';

const DEFAULT_MAX_COUNT = 5000;
/** Densest Poisson packing is hexagonal: 1000 / (spacing^2 * 0.866) points per 1000 m^2. */
const PACKING = 0.866;
/** Instances of different rules keep this fraction of the mean of their spacings apart. */
const CLEARANCE = 0.6;
/** Cluster rules: keep-probability next to an accepted instance of the same rule (1 = certain)... */
const NEAR_GROVE_P = 1;
/** ...and the multiplier applied to the density probability everywhere else. */
const FAR_FROM_GROVE = 0.25;

interface Spot {
  readonly x: number;
  readonly z: number;
  readonly spacing: number;
}
interface Band {
  readonly points: readonly Vec2[];
  readonly limit: number;
}
interface Context {
  readonly t: TerrainLike;
  readonly seed: number;
  readonly cap: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly bands: readonly Band[];
  readonly maxSpacing: number;
  readonly placed: PointHash<Spot>;
  readonly out: Placement[];
}

const finiteOr = (v: number | undefined, fallback: number): number => (v !== undefined && Number.isFinite(v) ? v : fallback);
/** Outside a patch a clumped rule keeps this share of its density (stragglers). */
const OUTSIDE_PATCH = 0.08;

/** Smooth value noise in 0..1 (two octaves), deterministic in the seed. */
function patchNoise(seed: number, x: number, z: number): number {
  const lattice = (ix: number, iz: number, o: number): number => {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed + o, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const octave = (px: number, pz: number, o: number): number => {
    const ix = Math.floor(px), iz = Math.floor(pz), fx = px - ix, fz = pz - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = lattice(ix, iz, o), b = lattice(ix + 1, iz, o), c = lattice(ix, iz + 1, o), d = lattice(ix + 1, iz + 1, o);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  };
  return octave(x, z, 0) * 0.7 + octave(x * 2.3 + 17.1, z * 2.3 - 9.4, 1) * 0.3;
}
const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** How thick a clumped rule grows here, 0..1 (1 = the middle of a patch). Rules without `clump` are 1 everywhere. */
export function patchAt(rule: ScatterRule, seed: number, ruleIndex: number, x: number, z: number): number {
  const c = rule.clump;
  if (!c || !(c.size > 0)) return 1;
  const cover = Math.min(1, Math.max(0, c.cover));
  // the noise is roughly uniform round 0.5 with this spread, so the threshold for a given cover sits on its quantile
  const n = patchNoise(seed ^ Math.imul(ruleIndex + 1, 2654435761), x / c.size, z / c.size);
  const edge = 0.5 + (0.5 - cover) * 0.62;
  return smooth(edge - 0.06, edge + 0.08, n);
}

/** Chance that a candidate survives the density test: density / densest-possible, clamped to 0..1. */
function keepProbability(rule: ScatterRule): number {
  const maxPossible = 1000 / (rule.minSpacing * rule.minSpacing * PACKING);
  const p = rule.density / maxPossible;
  return p > 0 ? Math.min(1, p) : 0;
}

/** Process one rule; returns true once the global cap is reached. */
function runRule(c: Context, rule: ScatterRule, index: number): boolean {
  const { t, placed, out } = c;
  const spacing = rule.minSpacing;
  // Two independent streams per rule: one for the Poisson layout, one for the per-candidate rolls.
  const candidates = poissonDisc(mulberry32(mixSeed(c.seed, index * 2)), c.maxX - c.minX, c.maxZ - c.minZ, spacing);
  const roll = mulberry32(mixSeed(c.seed, index * 2 + 1));
  const base = keepProbability(rule);
  const allowed = new Set(rule.surfaces);
  const grove = finiteOr(rule.clusterRadius, 0);
  const groves = grove > 0 ? new PointHash<Spot>(grove) : null;
  const reach = (CLEARANCE * (spacing + c.maxSpacing)) / 2;
  const lo = Math.min(rule.scale[0], rule.scale[1]);
  const hi = Math.max(rule.scale[0], rule.scale[1]);

  for (const [cx, cz] of candidates) {
    // Always three draws per candidate, so tightening a filter never reshuffles the other candidates.
    const keepRoll = roll();
    const yawRoll = roll();
    const scaleRoll = roll();
    const x = c.minX + cx;
    const z = c.minZ + cz;
    if (x > c.maxX || z > c.maxZ) continue;
    const y = heightAt(t, x, z);
    if (!(y >= rule.minHeight && y <= rule.maxHeight)) continue;
    if (!(slopeDeg(t, x, z) <= rule.maxSlopeDeg)) continue;
    if (allowed.size > 0 && !allowed.has(dominantSurface(t, x, z))) continue;
    if (c.bands.some((b) => distanceToLoop(b.points, [x, z]) <= b.limit)) continue;

    const patch = patchAt(rule, c.seed, index, x, z);
    let p = rule.clump ? base * (OUTSIDE_PATCH + (1 - OUTSIDE_PATCH) * patch) : base;
    if (groves) {
      const nearGrove = groves.some(x, z, grove, (s) => (s.x - x) ** 2 + (s.z - z) ** 2 <= grove * grove);
      p = nearGrove ? NEAR_GROVE_P : p * FAR_FROM_GROVE;
    }
    if (!(keepRoll < p)) continue;

    const apart = placed.some(x, z, reach, (s) => {
      const limit = (CLEARANCE * (spacing + s.spacing)) / 2;
      return (s.x - x) ** 2 + (s.z - z) ** 2 < limit * limit;
    });
    if (apart) continue;

    const spot: Spot = { x, z, spacing };
    placed.add(spot);
    groves?.add(spot);
    const size = rule.clump ? lo + (hi - lo) * (scaleRoll * 0.6 + patch * 0.4) : lo + (hi - lo) * scaleRoll;
    out.push({ rule: rule.id, x, y, z, yaw: yawRoll * Math.PI * 2, scale: Math.min(hi, size) });
    if (out.length >= c.cap) return true;
  }
  return false;
}

/**
 * Dress a terrain with props. Rules run in order; each draws Poisson-disc candidates over the area and
 * keeps those that satisfy its height / slope / surface / path / density tests and stay clear of
 * everything placed so far. Deterministic: same inputs give an identical result.
 * `o.seed` is used as an unsigned 32-bit integer.
 */
export function scatter(t: TerrainLike, rules: readonly ScatterRule[], o: ScatterOptions): Placement[] {
  const out: Placement[] = [];
  const cap = o.maxCount === undefined || Number.isNaN(o.maxCount) ? DEFAULT_MAX_COUNT : Math.max(0, Math.floor(o.maxCount));
  const { cols, rows, cell, originX, originZ } = t.spec;
  if (cap === 0 || rules.length === 0 || cols < 1 || rows < 1 || !(cell > 0)) return out;

  const edge = Math.max(0, finiteOr(o.edgeMargin, 1));
  const margin = Math.max(0, finiteOr(o.margin, 2));
  const area = o.area;
  const minX = Math.max(originX + edge, area?.minX ?? -Infinity);
  const maxX = Math.min(originX + (cols - 1) * cell - edge, area?.maxX ?? Infinity);
  const minZ = Math.max(originZ + edge, area?.minZ ?? -Infinity);
  const maxZ = Math.min(originZ + (rows - 1) * cell - edge, area?.maxZ ?? Infinity);
  if (!(minX <= maxX && minZ <= maxZ)) return out;

  const bands = (o.avoid ?? []).map((p) => ({ points: p.points, limit: Math.max(0, finiteOr(p.halfWidth, 0)) + margin }));
  let maxSpacing = 0;
  for (const r of rules) if (Number.isFinite(r.minSpacing) && r.minSpacing > maxSpacing) maxSpacing = r.minSpacing;
  const placed = new PointHash<Spot>(Math.max(CLEARANCE * maxSpacing, 0.25));

  const ctx: Context = { t, seed: o.seed, cap, minX, maxX, minZ, maxZ, bands, maxSpacing, placed, out };
  for (const [index, rule] of rules.entries()) {
    if (runRule(ctx, rule, index)) break;
  }
  return out;
}
