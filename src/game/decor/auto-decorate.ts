/**
 * NewDecor — the auto-decorate rules: six ways of laying decorations that each read the road.
 *
 *   verge      a line of props along both edges, spaced with jitter, thinned in tight bends
 *   scatter    a grove/rockfield in a band off the road, clumped by noise, thinning with distance
 *   rhythm     lanterns/torches/flags at an exact period, mirrored or alternating, phase-adjustable
 *   corners    barricades and boulders on the OUTSIDE of bends, scaled by how tight the bend is,
 *              and a warning sign a set distance before the apex
 *   crowd      rows of goblins facing the road, denser toward the finish
 *   landmarks  one big silhouette every so often, alternating sides, never two close together
 *
 * Every rule declares its parameters as a schema (`ParamSpec`), so the panel renders sliders from it
 * and a theme preset is just a saved set of numbers. Every rule is seeded and pure: same track, same
 * span, same numbers, same seed → the same decorations, which is what makes "re-roll" and "re-run
 * after editing a slider" behave.
 *
 * The rules read from the road: `halfWidth` (where the verge is), `turnRate` (which side is the
 * outside), `onBridge`/`inLoop` (nothing stands on a bridge deck or inside a loop), `stage` (what
 * suits here). They never place inside the road (|lateral| < halfWidth + half a footprint) and never
 * overlap what is already standing — hand-placed or otherwise — because every candidate is tested
 * against a `SiteIndex` of the current props.
 */
import type { TrackStageId } from '../track-space';
import type { PlacedProp } from '../builder/prop-catalog';
import { decorKind, decorPalette, type DecorKind, type DecorPalette } from './decor-catalog';
import {
  SiteIndex, clumpNoise, faceRoadYaw, hashSeed, makeRng, pickKind, zoneLateral,
  type DecorPlacement, type DecorTrack, type DecorTrackSample, type Rng,
} from './decor-field';

export interface ParamSpec {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
  readonly unit?: string;
  readonly hint?: string;
}

export type RuleParams = Record<string, number>;

export interface RuleContext {
  readonly track: DecorTrack;
  /** Arc-length span to decorate, inclusive. */
  readonly span: readonly [number, number];
  readonly palette: DecorPalette;
  readonly rng: Rng;
  /** Everything already standing; the rule adds to it as it places, so its own props keep apart too. */
  readonly index: SiteIndex;
  /** Only these stages, when set. */
  readonly stages?: ReadonlySet<TrackStageId>;
  /** Hard cap on how many this run may add. */
  readonly budget: number;
}

export interface DecorRule {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly params: readonly ParamSpec[];
  readonly defaultPalette: string;
  generate(ctx: RuleContext, p: RuleParams): DecorPlacement[];
}

/* -----------------------------------------------------------------------------
   Helpers shared by the rules
   -------------------------------------------------------------------------- */
const TAU = Math.PI * 2;

function allowedHere(ctx: RuleContext, sample: DecorTrackSample): boolean {
  if (sample.onBridge || sample.inLoop) return false;
  if (ctx.stages && !ctx.stages.has(sample.stage)) return false;
  return true;
}

/** Try to stand `kind` at (s, lateral): refuses the road, refuses overlaps, otherwise records and returns it. */
function tryPlace(ctx: RuleContext, out: DecorPlacement[], kind: DecorKind, s: number, lateral: number, side: number, opts: { scaleMul?: number; yaw?: number } = {}): boolean {
  if (out.length >= ctx.budget) return false;
  const sample = ctx.track.sampleAt(s);
  const scale = ctx.rng.range(kind.scale[0], kind.scale[1]) * (opts.scaleMul ?? 1);
  const radius = kind.footprint * scale;
  if (Math.abs(lateral) < sample.halfWidth + radius * 0.5) return false;
  if (ctx.index.blocked(s, lateral, radius)) return false;
  const rotY = opts.yaw ?? (kind.faceTrack ? faceRoadYaw(sample, side) + ctx.rng.range(-0.15, 0.15) : ctx.rng.range(0, TAU));
  ctx.index.add(s, lateral, radius);
  out.push({ kind, s, lateral, scale, rotY, flipX: kind.flip && ctx.rng() < 0.5 });
  return true;
}

const P = (key: string, label: string, min: number, max: number, step: number, def: number, unit?: string, hint?: string): ParamSpec =>
  ({ key, label, min, max, step, default: def, unit, hint });

export function defaultParams(rule: DecorRule): RuleParams {
  const out: RuleParams = {};
  for (const spec of rule.params) out[spec.key] = spec.default;
  return out;
}

/* -----------------------------------------------------------------------------
   1. verge
   -------------------------------------------------------------------------- */
export const VERGE_RULE: DecorRule = {
  id: 'verge',
  name: 'Verge line',
  blurb: 'Props along both road edges. Spacing with jitter; bends thin the inside so the racing line stays readable.',
  defaultPalette: 'verge_edges',
  params: [
    P('spacing', 'Spacing', 300, 3000, 50, 900, 'u'),
    P('jitter', 'Jitter', 0, 1, 0.05, 0.35, '', 'How far off the beat each prop may fall'),
    P('spread', 'Spread', 0, 1, 0.05, 0.3, '', 'How far off the edge the zone reaches'),
    P('sides', 'Sides', 0, 2, 1, 2, '', '0 left · 1 right · 2 both'),
    P('bendThin', 'Bend thinning', 0, 1, 0.05, 0.6, '', 'Skip props on the inside of tight bends'),
    P('fill', 'Fill', 0, 1, 0.05, 1, '', 'Chance each slot is used'),
  ],
  generate(ctx, p) {
    const out: DecorPlacement[] = [];
    const [s0, s1] = ctx.span;
    const sides = p.sides === 2 ? [-1, 1] : [p.sides === 0 ? -1 : 1];
    for (let s = s0; s <= s1; s += p.spacing) {
      for (const side of sides) {
        const at = s + ctx.rng.range(-0.5, 0.5) * p.jitter * p.spacing;
        if (at < s0 || at > s1) continue;
        const sample = ctx.track.sampleAt(at);
        if (!allowedHere(ctx, sample) || ctx.rng() > p.fill) continue;
        // turnRate > 0 bends toward +right (the right side is the inside of the bend).
        const inside = Math.sign(sample.turnRate) === side;
        if (inside && ctx.rng() < Math.min(1, Math.abs(sample.turnRate) * 2500) * p.bendThin) continue;
        const kind = pickKind(ctx.palette, sample.stage, ctx.rng, 'verge') ?? pickKind(ctx.palette, sample.stage, ctx.rng);
        if (!kind) continue;
        tryPlace(ctx, out, kind, at, zoneLateral(kind, sample, side, ctx.rng, p.spread), side);
      }
    }
    return out;
  },
};

/* -----------------------------------------------------------------------------
   2. scatter
   -------------------------------------------------------------------------- */
export const SCATTER_RULE: DecorRule = {
  id: 'scatter',
  name: 'Grove scatter',
  blurb: 'Fills a band beside the road. Clump noise makes groves and clearings; density falls off with distance.',
  defaultPalette: 'alpine_forest',
  params: [
    P('density', 'Density', 0.1, 6, 0.1, 1.5, '/1000u', 'Props per 1000 units of road (both sides)'),
    P('near', 'Near edge', 0, 2000, 50, 150, 'u', 'Band starts this far past the road edge'),
    P('far', 'Far edge', 300, 6000, 100, 2600, 'u'),
    P('clump', 'Clumpiness', 0, 1, 0.05, 0.6, '', '0 even · 1 all-or-nothing groves'),
    P('clumpScale', 'Clump size', 400, 6000, 100, 1800, 'u'),
    P('falloff', 'Distance falloff', 0, 1, 0.05, 0.5, '', 'Thinner toward the far edge'),
    P('spacingScale', 'Spacing', 0.5, 3, 0.1, 1, '×', 'Multiplies each kind\'s footprint'),
    P('sizeVar', 'Size variety', 0, 1, 0.05, 0.6),
  ],
  generate(ctx, p) {
    const out: DecorPlacement[] = [];
    const [s0, s1] = ctx.span;
    const length = Math.max(0, s1 - s0);
    const target = Math.round((length / 1000) * p.density);
    const attempts = target * 6;
    const seed = Math.floor(ctx.rng() * 1000);
    for (let i = 0; i < attempts && out.length < target; i++) {
      const s = ctx.rng.range(s0, s1);
      const sample = ctx.track.sampleAt(s);
      if (!allowedHere(ctx, sample)) continue;
      // Clump: the noise gates the attempt; clump=1 means only the noisy peaks survive.
      const n = clumpNoise(s, p.clumpScale, seed);
      if (ctx.rng() > (1 - p.clump) + p.clump * n * n * 1.6) continue;
      const side = ctx.rng() < 0.5 ? -1 : 1;
      const t = ctx.rng();
      const dist = p.near + (p.far - p.near) * t;
      if (ctx.rng() < t * p.falloff) continue;
      const kind = pickKind(ctx.palette, sample.stage, ctx.rng);
      if (!kind) continue;
      // Far-zone kinds want to be far; verge kinds want the edge — bias the band by the kind's zone.
      const zoneBias = kind.zone === 'far' ? 0.5 + 0.5 * t : kind.zone === 'verge' ? 0.3 : 1;
      const lateral = side * (sample.halfWidth + kind.footprint * 0.5 + dist * zoneBias);
      const mid = (kind.scale[0] + kind.scale[1]) / 2;
      const scaleMul = 1 + (ctx.rng.range(kind.scale[0], kind.scale[1]) / mid - 1) * p.sizeVar;
      const before = ctx.index;
      // Spacing multiplier: pretend the footprint is bigger when testing for room.
      if (p.spacingScale !== 1 && before.blocked(s, lateral, kind.footprint * scaleMul * p.spacingScale)) continue;
      tryPlace(ctx, out, kind, s, lateral, side, { scaleMul });
    }
    return out;
  },
};

/* -----------------------------------------------------------------------------
   3. rhythm
   -------------------------------------------------------------------------- */
export const RHYTHM_RULE: DecorRule = {
  id: 'rhythm',
  name: 'Rhythm',
  blurb: 'Lanterns, torches or flags at an exact beat. Mirrored pairs or alternating sides; phase slides the beat.',
  defaultPalette: 'lanterns',
  params: [
    P('period', 'Period', 200, 4000, 50, 1200, 'u'),
    P('phase', 'Phase', 0, 1, 0.05, 0, '', 'Slides every prop along the road by a fraction of the period'),
    P('pairs', 'Pairs', 0, 1, 1, 1, '', '1 both sides at once · 0 alternate sides'),
    P('offset', 'Edge offset', 0, 600, 20, 60, 'u'),
    P('sameKind', 'Same kind', 0, 1, 1, 1, '', 'One kind for the whole run, or pick per post'),
  ],
  generate(ctx, p) {
    const out: DecorPlacement[] = [];
    const [s0, s1] = ctx.span;
    const first = ctx.track.sampleAt(s0);
    let fixed = p.sameKind ? pickKind(ctx.palette, first.stage, ctx.rng) : null;
    let beat = 0;
    for (let s = s0 + p.phase * p.period; s <= s1; s += p.period, beat++) {
      const sample = ctx.track.sampleAt(s);
      if (!allowedHere(ctx, sample)) continue;
      const sides = p.pairs ? [-1, 1] : [beat % 2 ? 1 : -1];
      for (const side of sides) {
        let kind = fixed ?? pickKind(ctx.palette, sample.stage, ctx.rng);
        if (kind && (kind.stages[sample.stage] ?? 0) <= 0) { kind = pickKind(ctx.palette, sample.stage, ctx.rng); if (p.sameKind) fixed = kind; }
        if (!kind) continue;
        const lateral = side * (sample.halfWidth + kind.footprint * 0.5 + p.offset);
        tryPlace(ctx, out, kind, s, lateral, side, { yaw: faceRoadYaw(sample, side) });
      }
    }
    return out;
  },
};

/* -----------------------------------------------------------------------------
   4. corners
   -------------------------------------------------------------------------- */
export const CORNERS_RULE: DecorRule = {
  id: 'corners',
  name: 'Corner dressing',
  blurb: 'Reads the bends: barricades and rock on the OUTSIDE where you would fly off, scaled by tightness, plus a warning sign before the apex.',
  defaultPalette: 'trackside_safety',
  params: [
    P('threshold', 'Bend threshold', 0.00005, 0.001, 0.00001, 0.00018, 'rad/u', 'Turn rate that counts as a bend'),
    P('density', 'Density', 0.2, 3, 0.1, 1, '×', 'Props per bend, scaled by tightness'),
    P('signs', 'Warning signs', 0, 1, 1, 1),
    P('leadIn', 'Sign lead-in', 200, 3000, 50, 900, 'u', 'How far before the apex the sign stands'),
    P('offset', 'Edge offset', 0, 400, 10, 40, 'u'),
  ],
  generate(ctx, p) {
    const out: DecorPlacement[] = [];
    const [s0, s1] = ctx.span;
    const signPalette = decorPalette('signs');
    // The bend itself gets barricades and walls; the warning sign has its own place before the apex.
    // (Picking signs in the bend too let them crowd out every barricade.) A sign-only palette keeps its signs.
    const isSign = (type: string) => signPalette.kinds.some((k) => k.type === type);
    const dressingKinds = ctx.palette.kinds.filter((k) => !isSign(k.type));
    const dressing = dressingKinds.length ? { ...ctx.palette, kinds: dressingKinds } : ctx.palette;
    const step = 100;
    // Walk the span and find runs where |turnRate| exceeds the threshold: each run is one bend.
    let runStart: number | null = null;
    let peak = 0, peakS = 0, peakSign = 1;
    const closeRun = (end: number) => {
      if (runStart === null) return;
      const length = end - runStart;
      const tightness = Math.min(1, peak / (p.threshold * 4));
      const count = Math.max(1, Math.round((length / 600) * (0.5 + tightness) * p.density));
      const outside = -peakSign; // turnRate > 0 bends toward +right → the outside is −right
      for (let i = 0; i < count; i++) {
        const s = runStart + ((i + 0.5) / count) * length + ctx.rng.range(-80, 80);
        const sample = ctx.track.sampleAt(s);
        if (!allowedHere(ctx, sample)) continue;
        const kind = pickKind(dressing, sample.stage, ctx.rng, 'verge') ?? pickKind(dressing, sample.stage, ctx.rng);
        if (!kind) continue;
        const lateral = outside * (sample.halfWidth + kind.footprint * 0.5 + p.offset + ctx.rng.range(0, 60));
        tryPlace(ctx, out, kind, s, lateral, outside, { scaleMul: 0.9 + tightness * 0.3 });
      }
      if (p.signs) {
        const s = Math.max(s0, peakS - p.leadIn);
        const sample = ctx.track.sampleAt(s);
        // The sign stands on the driver's right (the side they read), unless that is the inside of a hairpin.
        const side = tightness > 0.8 ? outside : 1;
        const kind = pickKind(signPalette, sample.stage, ctx.rng);
        if (kind && allowedHere(ctx, sample)) tryPlace(ctx, out, kind, s, side * (sample.halfWidth + kind.footprint * 0.5 + p.offset), side);
      }
      runStart = null; peak = 0;
    };
    for (let s = s0; s <= s1; s += step) {
      const sample = ctx.track.sampleAt(s);
      const rate = Math.abs(sample.turnRate);
      if (rate >= p.threshold && !sample.inLoop) {
        if (runStart === null) { runStart = s; peak = 0; }
        if (rate > peak) { peak = rate; peakS = s; peakSign = Math.sign(sample.turnRate) || 1; }
      } else closeRun(s);
    }
    closeRun(s1);
    return out;
  },
};

/* -----------------------------------------------------------------------------
   5. crowd
   -------------------------------------------------------------------------- */
export const CROWD_RULE: DecorRule = {
  id: 'crowd',
  name: 'Crowd',
  blurb: 'Rows of goblins facing the road, packed tighter toward the end of the span (the finish).',
  defaultPalette: 'crowd',
  params: [
    P('spacing', 'Spacing', 150, 1200, 25, 320, 'u'),
    P('rows', 'Rows', 1, 4, 1, 2),
    P('rowGap', 'Row gap', 100, 600, 20, 220, 'u'),
    P('gradient', 'Finish gradient', 0, 1, 0.05, 0.6, '', 'Sparse at the start of the span, full at the end'),
    P('jitter', 'Jitter', 0, 1, 0.05, 0.5),
  ],
  generate(ctx, p) {
    const out: DecorPlacement[] = [];
    const [s0, s1] = ctx.span;
    const length = Math.max(1, s1 - s0);
    for (let s = s0; s <= s1; s += p.spacing) {
      const t = (s - s0) / length;
      const keep = (1 - p.gradient) + p.gradient * t;
      for (const side of [-1, 1]) {
        for (let row = 0; row < p.rows; row++) {
          if (ctx.rng() > keep) continue;
          const at = s + ctx.rng.range(-0.5, 0.5) * p.jitter * p.spacing + (row % 2) * p.spacing * 0.5;
          const sample = ctx.track.sampleAt(Math.max(s0, Math.min(s1, at)));
          if (!allowedHere(ctx, sample)) continue;
          const kind = pickKind(ctx.palette, sample.stage, ctx.rng);
          if (!kind) continue;
          const lateral = side * (sample.halfWidth + kind.footprint * 0.5 + 40 + row * p.rowGap);
          tryPlace(ctx, out, kind, at, lateral, side, { yaw: faceRoadYaw(sample, side) + ctx.rng.range(-0.25, 0.25) });
        }
      }
    }
    return out;
  },
};

/* -----------------------------------------------------------------------------
   6. landmarks
   -------------------------------------------------------------------------- */
export const LANDMARKS_RULE: DecorRule = {
  id: 'landmarks',
  name: 'Landmark cadence',
  blurb: 'One big silhouette every so often, alternating sides, far from the road, never two in sight of each other.',
  defaultPalette: 'landmarks',
  params: [
    P('every', 'Every', 1500, 12000, 250, 4500, 'u'),
    P('distance', 'Distance', 800, 5000, 100, 1800, 'u', 'Past the road edge'),
    P('clear', 'Clearance', 500, 6000, 100, 2500, 'u', 'No other landmark within this'),
    P('wobble', 'Wobble', 0, 1, 0.05, 0.4, '', 'Randomness of the beat'),
  ],
  generate(ctx, p) {
    const out: DecorPlacement[] = [];
    const [s0, s1] = ctx.span;
    const placed: { s: number; lateral: number }[] = [];
    let side = ctx.rng() < 0.5 ? -1 : 1;
    for (let s = s0 + p.every * 0.5; s <= s1; s += p.every) {
      const at = s + ctx.rng.range(-0.5, 0.5) * p.wobble * p.every;
      const sample = ctx.track.sampleAt(Math.max(s0, Math.min(s1, at)));
      side = -side;
      if (!allowedHere(ctx, sample)) continue;
      const kind = pickKind(ctx.palette, sample.stage, ctx.rng, 'far') ?? pickKind(ctx.palette, sample.stage, ctx.rng);
      if (!kind) continue;
      const lateral = side * (sample.halfWidth + kind.footprint * 0.5 + p.distance * ctx.rng.range(0.8, 1.2));
      if (placed.some((q) => Math.hypot(q.s - at, q.lateral - lateral) < p.clear)) continue;
      if (tryPlace(ctx, out, kind, at, lateral, side, { scaleMul: 1.1 })) placed.push({ s: at, lateral });
    }
    return out;
  },
};

export const DECOR_RULES: readonly DecorRule[] = Object.freeze([VERGE_RULE, SCATTER_RULE, RHYTHM_RULE, CORNERS_RULE, CROWD_RULE, LANDMARKS_RULE]);
export const decorRule = (id: string): DecorRule | undefined => DECOR_RULES.find((r) => r.id === id);

/* -----------------------------------------------------------------------------
   Themes — per-stage compositions of the rules, scaled by one "intensity" knob
   -------------------------------------------------------------------------- */
export interface ThemeStep {
  readonly rule: string;
  readonly palette: string;
  readonly params: Partial<RuleParams>;
  /** Which stages this step runs in. */
  readonly stages: readonly TrackStageId[];
}

export const THEME_STEPS: readonly ThemeStep[] = Object.freeze([
  { rule: 'scatter', palette: 'alpine_forest', params: { density: 2.2, clump: 0.65, far: 3200 }, stages: ['alpine'] },
  { rule: 'verge', palette: 'verge_edges', params: { spacing: 1100, fill: 0.7 }, stages: ['alpine', 'zigzag'] },
  { rule: 'scatter', palette: 'canyon_rock', params: { density: 1.8, clump: 0.5, far: 2400 }, stages: ['canyon', 'zigzag'] },
  { rule: 'corners', palette: 'trackside_safety', params: { density: 1 }, stages: ['alpine', 'canyon', 'zigzag'] },
  { rule: 'scatter', palette: 'mine_works', params: { density: 1.4, clump: 0.7, far: 1400, near: 80 }, stages: ['cavern', 'mine', 'breakthrough'] },
  { rule: 'rhythm', palette: 'lanterns', params: { period: 1400, pairs: 1 }, stages: ['cavern', 'mine', 'breakthrough'] },
  { rule: 'rhythm', palette: 'lanterns', params: { period: 2600, pairs: 0 }, stages: ['alpine', 'zigzag'] },
  { rule: 'landmarks', palette: 'landmarks', params: { every: 5000 }, stages: ['alpine', 'canyon', 'zigzag', 'mine'] },
  { rule: 'crowd', palette: 'crowd', params: { spacing: 300, rows: 2, gradient: 0.7 }, stages: ['stadium'] },
  { rule: 'rhythm', palette: 'crowd', params: { period: 900, pairs: 1, sameKind: 1 }, stages: ['stadium'] },
]);

/** Density-like keys, which `intensity` scales; spacing-like keys, which it divides. */
const SCALE_UP = new Set(['density', 'fill', 'rows']);
const SCALE_DOWN = new Set(['spacing', 'period', 'every']);

/** Parameters over a base, skipping any left undefined (a partial override never unsets a default). */
export function withParams(base: RuleParams, over?: Partial<RuleParams>): RuleParams {
  const out: RuleParams = { ...base };
  for (const [key, value] of Object.entries(over ?? {})) if (value !== undefined) out[key] = value;
  return out;
}

export function themeParams(rule: DecorRule, step: ThemeStep, intensity: number): RuleParams {
  const p = withParams(defaultParams(rule), step.params);
  for (const [key, base] of Object.entries(p)) {
    let value = base;
    if (SCALE_UP.has(key)) value *= intensity;
    else if (SCALE_DOWN.has(key)) value /= Math.max(0.2, intensity);
    const spec = rule.params.find((s) => s.key === key);
    if (spec) value = Math.max(spec.min, Math.min(spec.max, value));
    p[key] = value;
  }
  return p;
}

/* -----------------------------------------------------------------------------
   Running
   -------------------------------------------------------------------------- */
export interface RunOptions {
  readonly track: DecorTrack;
  readonly span: readonly [number, number];
  readonly existing: readonly PlacedProp[];
  readonly seed: number;
  readonly budget?: number;
  readonly stages?: ReadonlySet<TrackStageId>;
  /** Reuse an index across several runs in one batch (a theme). */
  readonly index?: SiteIndex;
}

export function runRule(rule: DecorRule, params: RuleParams, palette: DecorPalette, opts: RunOptions): DecorPlacement[] {
  const index = opts.index ?? SiteIndex.fromProps(opts.track, opts.existing);
  const rng = makeRng((opts.seed ^ hashSeed(rule.id + palette.id)) >>> 0);
  const ctx: RuleContext = { track: opts.track, span: opts.span, palette, rng, index, stages: opts.stages, budget: opts.budget ?? 600 };
  return rule.generate(ctx, { ...defaultParams(rule), ...params });
}

/** The whole theme over a span: each step on its own stages, sharing one spacing index. */
export function runTheme(opts: RunOptions & { intensity?: number }): { rule: string; placements: DecorPlacement[] }[] {
  const intensity = opts.intensity ?? 1;
  const index = opts.index ?? SiteIndex.fromProps(opts.track, opts.existing);
  const results: { rule: string; placements: DecorPlacement[] }[] = [];
  let remaining = opts.budget ?? 1500;
  THEME_STEPS.forEach((step, i) => {
    const rule = decorRule(step.rule);
    if (!rule || remaining <= 0) return;
    const stages = new Set(step.stages.filter((s) => !opts.stages || opts.stages.has(s)));
    if (!stages.size) return;
    const placements = runRule(rule, themeParams(rule, step, intensity), decorPalette(step.palette), {
      ...opts, index, stages, seed: (opts.seed + i * 7919) >>> 0, budget: remaining,
    });
    remaining -= placements.length;
    results.push({ rule: rule.id, placements });
  });
  return results;
}

/** Stage boundaries along the track (for the panel's "this stage" span). */
export function stageSpans(track: DecorTrack): { stage: TrackStageId; s0: number; s1: number }[] {
  const out: { stage: TrackStageId; s0: number; s1: number }[] = [];
  for (const sample of track.samples) {
    const last = out[out.length - 1];
    if (last && last.stage === sample.stage) last.s1 = sample.dist;
    else out.push({ stage: sample.stage, s0: sample.dist, s1: sample.dist });
  }
  return out;
}

export const kindNames = (types: readonly string[]) => types.map((t) => decorKind(t)?.name ?? t);
