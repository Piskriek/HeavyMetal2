/**
 * AutoPaint — the easy paint functions: seeded rules that paint the road's surface mask for you.
 *
 * Same shape as the auto-decorate rules (`game/decor/auto-decorate.ts`) — a parameter schema per rule,
 * a weighted surface picker, one deterministic seed — except these place nothing: they write **mask
 * texels** through the NewRoads brush law, so an entire 120 km mountain can be dressed in asphalt,
 * gravel, planks and cobbles with one click and stays fully hand-editable afterwards (the mask is still
 * the source of truth, plan §3.2).
 *
 *   carriageway  a band of surface down the middle, feathered to the edges, bridges optionally spared
 *   shoulders    a gravel (or chosen) band along both edges, tapering into the road
 *   corners      loose scree on the OUTSIDE of bends, wider the tighter the bend, before the apex
 *   ruts         worn tyre tracks at the racing lines of each lane, breaking up a big flat fill
 *   patches      seeded repair patches (concrete/asphalt blobs) scattered along the span
 *   markings     the lane-marking flag byte: dashes on straights, none in tight bends, double near the stadium
 *   stage-theme  the one-click pass: per-stage surfaces + shoulders + markings from a table
 *
 * All coordinates are the road's own: `s` along the centreline, `u` across (0 = left edge, 1 = right).
 * A row of the mask is one `step` (60) units of road, so a rule is a loop over rows with a column band —
 * a few thousand iterations, no allocations, and it never touches a GPU texture directly: the paint
 * ribbon uploads the dirty rectangle on the next frame.
 *
 * Pure TypeScript: no three.js, no DOM. Only `../track-space` types and the NewRoads mask/table.
 */
import type { TrackStageId } from '../track-space';
import type { SurfaceMask } from './surface-mask';
import {
  MARK_CENTRE_DOUBLE, MARK_EDGE_LINES, MARK_LANE_DASHES, MARK_NONE, SURFACE_ASPHALT, SURFACE_CAVEROCK, SURFACE_CONCRETE,
  SURFACE_COBBLE, SURFACE_DIRT, SURFACE_GRAVEL, SURFACE_PLANK, SURFACE_ROCK, surfaceDefinition,
} from './surface-table';

/* -----------------------------------------------------------------------------
   The field a rule paints
   -------------------------------------------------------------------------- */
export interface RowInfo {
  readonly stage: TrackStageId;
  /** Radians of heading change per unit of `s`; its sign says which side is the inside of the bend. */
  readonly turnRate: number;
  readonly onBridge: boolean;
  readonly inLoop: boolean;
  readonly halfWidth: number;
}

/** Everything a rule needs: the mask, its geometry, and what the road is doing at each row. */
export interface PaintField {
  readonly mask: SurfaceMask;
  readonly across: number;
  readonly rows: number;
  readonly step: number;
  readonly length: number;
  rowAt(s: number): number;
  sOfRow(row: number): number;
  infoAt(s: number): RowInfo;
}

export interface ParamSpec {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
  readonly hint?: string;
  /** A surface-id parameter: the panel shows the palette instead of a slider. */
  readonly surface?: boolean;
  readonly bool?: boolean;
}

export type PaintParams = Record<string, number>;

/**
 * One rule: a parameter schema the panel renders, and a row painter.
 *
 * A rule is **order-independent by construction**: its look comes from noise over `s` with a `seed`
 * parameter (never a stream it consumes), and it writes only the row it is handed. Painting the same span
 * twice therefore lands on the same texels — nothing darkens twice — a dry-run preview matches the real
 * run exactly, and undo is a plain snapshot of the span.
 */
export interface PaintRule {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly params: readonly ParamSpec[];
  /** Paint one row. Returns false when the row does not apply (a spared bridge, an undressed stage). */
  row(field: PaintField, row: number, info: RowInfo, p: PaintParams): boolean;
}

/* -----------------------------------------------------------------------------
   Texel writing — the brush law, but for whole bands
   -------------------------------------------------------------------------- */
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The centre of a column, as a lateral fraction. */
export const columnU = (across: number, c: number) => (c + 0.5) / across;

/**
 * Write `surface` into one texel with coverage `t` (0‥1). t ≥ 0.999 lays it solidly in both slots;
 * anything less goes through the per-texel brush law so an existing surface underneath is blended, not
 * bulldozed. The flags byte is always carried over.
 */
export function writeTexel(field: PaintField, c: number, row: number, surface: number, t: number): void {
  const mask = field.mask;
  if (t <= 0) return;
  const i = mask.index(c, row);
  const flags = mask.data[i + 3];
  if (t >= 0.999) {
    if (mask.data[i] === surface && mask.data[i + 1] === surface && mask.data[i + 2] === 0 && mask.data[i + 3] === flags) return;
    mask.data[i] = surface; mask.data[i + 1] = surface; mask.data[i + 2] = 0; mask.data[i + 3] = flags;
    mask.markDirty(c, row);
    return;
  }
  // Partial cover raises the surface's share of the texel to `t` and never past it, so a second pass
  // over the same span finds the share already there and writes nothing (the brush law would add).
  const id0 = mask.data[i], id1 = mask.data[i + 1], w = mask.data[i + 2];
  const target = Math.round(t * 255);
  const share = id0 === id1 ? (id0 === surface ? 255 : 0) : (id0 === surface ? 255 - w : 0) + (id1 === surface ? w : 0);
  if (share >= target) return;
  if (id0 === id1 || id1 === surface) { mask.data[i + 1] = surface; mask.data[i + 2] = target; }
  else if (id0 === surface) mask.data[i + 2] = 255 - target;
  else if (w < 128) { mask.data[i + 1] = surface; mask.data[i + 2] = target; }
  else { mask.data[i] = surface; mask.data[i + 2] = 255 - target; }
  mask.markDirty(c, row);
}

/**
 * Paint the columns between `u0` and `u1` on one row. `edge` is the feather as a fraction of the band
 * (0 = a hard cut, 0.5 = half the band ramps in from each side). `sides` picks which ends feather
 * (1 = the `u0` end, 2 = the `u1` end, 3 = both): a band that starts at the road edge stays full there
 * and only fades towards the middle.
 *
 * Coverage is integrated, not sampled: each texel gets the *fraction of its own width* the band covers.
 * A mask column is 60 world units (16 across a 960 road), so a centre sample would make a 40-unit rut
 * flicker — full, or missing entirely, depending on where it fell. Integrating means a thin band always
 * paints something, softly, and a wide one is solid across its middle. The shader's bilinear weight then
 * softens the row-to-row steps, which is what makes a 60-unit texel not read as a staircase.
 */
export function paintBand(field: PaintField, row: number, u0: number, u1: number, surface: number, strength: number, edge = 0, sides = 3): void {
  const across = field.across;
  const a = Math.max(0, Math.min(u0, u1)), b = Math.min(1, Math.max(u0, u1));
  if (b <= a) return;
  const lo = Math.max(0, Math.floor(a * across));
  const hi = Math.min(across, Math.ceil(b * across));
  if (hi <= lo) return;
  const feather = edge > 0 ? edge * (b - a) : 0;
  for (let c = lo; c < hi; c++) {
    const left = c / across, right = (c + 1) / across;
    // How much of this column the band actually covers.
    const covered = Math.min(right, b) - Math.max(left, a);
    if (covered <= 0) continue;
    const centre = (left + right) / 2;
    // Feather: a column ramps down as the band's nearer end approaches it, over `edge` of the width.
    const dEdge = Math.min(sides & 1 ? centre - a : Infinity, sides & 2 ? b - centre : Infinity);
    let ramp = 1;
    if (feather > 0) { const u = clamp01(dEdge / feather); ramp = u * u * (3 - 2 * u); }
    writeTexel(field, c, row, surface, clamp01(covered * across * ramp * strength));
  }
}

/** Both edges: a band of `widthU` from each side. */
export function paintEdges(field: PaintField, row: number, widthU: number, surface: number, strength: number, taper: number): void {
  const w = Math.max(0, Math.min(0.5, widthU));
  paintBand(field, row, 0, w, surface, strength, taper, 2);
  paintBand(field, row, 1 - w, 1, surface, strength, taper, 1);
}

/* -----------------------------------------------------------------------------
   Deterministic noise — the only randomness a rule may use, so a run never depends on visit order
   -------------------------------------------------------------------------- */
const hash01 = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** Smooth 1D value noise along s, for wobbling band edges and patch placement. */
export function bandNoise(s: number, scale: number, seed: number): number {
  const x = s / Math.max(1, scale) + seed * 0.377;
  const i = Math.floor(x);
  const f = x - i;
  const t = f * f * (3 - 2 * f);
  const a = hash01(i), b = hash01(i + 1);
  return a * (1 - t) + b * t;
}

const P = (key: string, label: string, min: number, max: number, step: number, def: number, extra: Partial<ParamSpec> = {}): ParamSpec =>
  ({ key, label, min, max, step, default: def, ...extra });

export function defaultPaintParams(rule: PaintRule): PaintParams {
  const out: PaintParams = {};
  for (const spec of rule.params) out[spec.key] = spec.default;
  return out;
}

/* -----------------------------------------------------------------------------
   1 · carriageway — "asphalt the road"
   -------------------------------------------------------------------------- */
export const CARRIAGEWAY_RULE: PaintRule = {
  id: 'carriageway',
  name: 'Carriageway',
  blurb: 'A band of surface down the middle of the road, feathered to the edges. The one-click "lay asphalt".',
  params: [
    P('surface', 'Surface', 0, 255, 1, SURFACE_ASPHALT, { surface: true }),
    P('width', 'Width', 0.2, 1, 0.05, 0.86, { hint: 'Fraction of the road the band covers; the rest stays whatever is underneath' }),
    P('edge', 'Edge feather', 0, 0.9, 0.05, 0.35, { hint: 'Share of the band that ramps into the road at each side' }),
    P('strength', 'Strength', 0.05, 1, 0.05, 1),
    P('wobble', 'Edge wobble', 0, 1, 0.05, 0.25, { hint: 'Noise on the band edges so the paint line is not ruler-straight' }),
    P('wobbleScale', 'Wobble scale', 200, 4000, 100, 900, { hint: 'Length of one wobble along the road' }),
    P('seed', 'Seed', 0, 999, 1, 1),
    P('spareBridges', 'Spare bridges', 0, 1, 1, 1, { bool: true, hint: 'Leave plank bridge decks unpainted' }),
    P('spareLoops', 'Spare loops', 0, 1, 1, 1, { bool: true, hint: 'Leave vertical loops unpainted' }),
  ],
  row(field, row, info, p) {
    if ((p.spareBridges && info.onBridge) || (p.spareLoops && info.inLoop)) return false;
    const half = p.width / 2;
    // Two noise taps: the band's centre wanders, and its width breathes. Both depend only on s and seed.
    const wander = (bandNoise(field.sOfRow(row), p.wobbleScale, p.seed) - 0.5) * p.wobble * (0.5 - half);
    const width = half * (1 + (bandNoise(field.sOfRow(row), p.wobbleScale * 0.6, p.seed + 5) - 0.5) * p.wobble * 0.5);
    paintBand(field, row, 0.5 + wander - width, 0.5 + wander + width, p.surface, p.strength, p.edge);
    return true;
  },
};

/* -----------------------------------------------------------------------------
   2 · shoulders
   -------------------------------------------------------------------------- */
export const SHOULDERS_RULE: PaintRule = {
  id: 'shoulders',
  name: 'Shoulders & verge',
  blurb: 'A loose band along both edges — gravel or anything — tapering into the road so there is no hard line.',
  params: [
    P('surface', 'Surface', 0, 255, 1, SURFACE_GRAVEL, { surface: true }),
    P('width', 'Width', 20, 1200, 20, 260, { hint: 'World units; the road is 960 wide (4 × 240 lanes)' }),
    P('taper', 'Taper', 0, 0.95, 0.05, 0.55),
    P('strength', 'Strength', 0.05, 1, 0.05, 1),
    P('spareBridges', 'Spare bridges', 0, 1, 1, 1, { bool: true }),
    P('seed', 'Seed', 0, 999, 1, 3),
  ],
  row(field, row, info, p) {
    if (p.spareBridges && info.onBridge) return false;
    const s = field.sOfRow(row);
    const width = (p.width / Math.max(1, 2 * info.halfWidth)) * (0.85 + 0.3 * bandNoise(s, 1400, p.seed));
    const w = Math.min(0.5, width);
    paintEdges(field, row, w, p.surface, p.strength, p.taper);
    return true;
  },
};

/* -----------------------------------------------------------------------------
   3 · corners — loose stuff on the outside
   -------------------------------------------------------------------------- */
export const CORNERS_RULE: PaintRule = {
  id: 'corners',
  name: 'Corner scree',
  blurb: 'Reads the bend: a wider wash of loose surface on the OUTSIDE of every corner, where a slide ends up.',
  params: [
    P('surface', 'Surface', 0, 255, 1, SURFACE_GRAVEL, { surface: true }),
    P('threshold', 'Bend threshold', 0.00005, 0.001, 0.00001, 0.00018, { hint: 'Turn rate (rad per unit of s) that counts as a corner' }),
    P('width', 'Max width', 0.05, 0.5, 0.01, 0.22, { hint: 'Fraction of the road at full tightness' }),
    P('leadIn', 'Lead-in', 0, 4000, 100, 900, { hint: 'The wash starts this far before the corner' }),
    P('strength', 'Strength', 0.05, 1, 0.05, 0.9),
  ],
  row(field, row, info, p) {
    const rate = Math.abs(info.turnRate);
    if (info.onBridge || info.inLoop || rate < p.threshold * 0.25) return false;
    // Smoothstep from nothing at the threshold to full at three times it; below that the row is skipped.
    const tight = Math.min(1, Math.max(0, (rate - p.threshold * 0.25) / (p.threshold * 2.75)));
    const ramp = tight * tight * (3 - 2 * tight);
    if (ramp <= 0.001) return false;
    // Lead-in: look ahead for a tighter corner and start the wash fading in on *its* outside, so a
    // driver meets the loose surface before the apex rather than at it.
    const s = field.sOfRow(row);
    let ahead = 0, aheadSign = 0;
    for (let at = s + field.step; at <= s + p.leadIn; at += field.step * 2) {
      const aRate = Math.abs(field.infoAt(at).turnRate);
      if (aRate > ahead) { ahead = aRate; aheadSign = Math.sign(field.infoAt(at).turnRate); }
    }
    const aheadRamp = ahead > rate ? Math.min(1, (ahead - p.threshold * 0.25) / (p.threshold * 2.75)) * 0.6 : 0;
    const total = Math.max(ramp, aheadRamp);
    const outside = -((aheadRamp > ramp ? aheadSign : Math.sign(info.turnRate)) || 1);
    const w = p.width * total;
    if (outside < 0) paintBand(field, row, 0, w, p.surface, p.strength * total, 0.6, 2);
    else paintBand(field, row, 1 - w, 1, p.surface, p.strength * total, 0.6, 1);
    return true;
  },
};

/* -----------------------------------------------------------------------------
   4 · ruts — worn tyre tracks
   -------------------------------------------------------------------------- */
export const RUTS_RULE: PaintRule = {
  id: 'ruts',
  name: 'Worn ruts',
  blurb: 'Two darker tracks per lane, where the tyres actually go — the cheapest thing that makes a big fill look driven on.',
  params: [
    P('surface', 'Wear surface', 0, 255, 1, SURFACE_DIRT, { surface: true }),
    P('gauge', 'Track gauge', 20, 160, 5, 70, { hint: 'World units from the lane centreline to each track' }),
    P('width', 'Track width', 5, 80, 1, 26, { hint: 'World units across each track' }),
    P('depth', 'Wear depth', 0.05, 1, 0.05, 0.55, { hint: 'How far the underlying surface shows through' }),
    P('breakup', 'Breakup', 0, 1, 0.05, 0.45, { hint: 'Noise along the track so it is not a continuous stripe' }),
    P('spareBridges', 'Spare bridges', 0, 1, 1, 1, { bool: true }),
  ],
  row(field, row, info, p) {
    if (p.spareBridges && info.onBridge) return false;
    const s = field.sOfRow(row);
    const unitsU = 1 / Math.max(1, 2 * info.halfWidth); // world units → lateral fraction
    const gaugeU = p.gauge * unitsU;
    const widthU = p.width * unitsU;
    let touched = false;
    for (let lane = 0; lane < 4; lane++) {
      const centre = (lane + 0.5) / 4;
      // Each lane's pair wanders a little, so the four pairs are not one stencil repeated.
      const drift = (bandNoise(s + lane * 137, 2600, 5 + lane) - 0.5) * widthU * 1.6;
      for (const side of [-1, 1]) {
        const at = centre + side * gaugeU + drift;
        const n = bandNoise(s + lane * 137 + side * 57, 520, 11);
        const t = p.depth * (1 - p.breakup * n);
        if (t <= 0.01) continue;
        paintBand(field, row, at - widthU / 2, at + widthU / 2, p.surface, t, 0.5);
        touched = true;
      }
    }
    return touched;
  },
};

/* -----------------------------------------------------------------------------
   5 · patches — repairs
   -------------------------------------------------------------------------- */
export const PATCHES_RULE: PaintRule = {
  id: 'patches',
  name: 'Repair patches',
  blurb: 'Seeded blobs of a repair surface along the span — the difference between a fill and a road that has been lived on.',
  params: [
    P('surface', 'Patch surface', 0, 255, 1, SURFACE_CONCRETE, { surface: true }),
    P('cover', 'Cover', 0.02, 0.9, 0.02, 0.45, { hint: 'Share of the span the patches occupy: the noise cut' }),
    P('length', 'Blob length', 120, 4000, 20, 700, { hint: 'Wavelength of the noise: how long a patch runs' }),
    P('seed', 'Seed', 0, 999, 1, 1),
    P('span', 'Across', 0.1, 1, 0.05, 0.5, { hint: 'Fraction of the road a patch can cover' }),
    P('blend', 'Edge blend', 0, 0.9, 0.05, 0.4),
    P('strength', 'Strength', 0.05, 1, 0.05, 0.85),
  ],
  row(field, row, info, p) {
    if (info.onBridge || info.inLoop) return false;
    // One noise field across the span: every row where it is above the cut belongs to a patch, so the
    // patches are contiguous runs with organic, tapering ends — no run bookkeeping, no order dependence.
    const n = bandNoise(field.sOfRow(row), p.length, p.seed);
    const cut = 1 - clamp01(p.cover);
    if (n <= cut) return false;
    // How deep into the noise field this row sits: the swell makes each patch taper in and out.
    const swell = clamp01((n - cut) / Math.max(1e-6, (1 - cut) * 0.5));
    const centre = 0.5 + (bandNoise(field.sOfRow(row), p.length * 0.7, p.seed + 9) - 0.5) * (1 - p.span) * 0.9;
    const half = (p.span / 2) * (0.3 + 0.7 * swell);
    paintBand(field, row, centre - half, centre + half, p.surface, p.strength * (0.35 + 0.65 * swell), p.blend);
    return true;
  },
};

/* -----------------------------------------------------------------------------
   6 · markings — the flag byte
   -------------------------------------------------------------------------- */
export const MARKINGS_RULE: PaintRule = {
  id: 'markings',
  name: 'Lane markings',
  blurb: 'Sets the marking flags per row: dashes on straights, none in tight bends, a double line and edge lines near the stadium.',
  params: [
    P('mode', 'Mode', 0, 3, 1, 0, { hint: '0 auto by bend · 1 dashes · 2 double + edges · 3 none' }),
    P('bendCut', 'Drop in bends', 0, 1, 1, 1, { bool: true, hint: 'No markings where the bend is tighter than the threshold' }),
    P('threshold', 'Bend threshold', 0.00005, 0.001, 0.00001, 0.00022),
    P('stadiumDouble', 'Double near stadium', 0, 1, 1, 1, { bool: true }),
  ],
  row(field, row, info, p) {
    const tight = Math.abs(info.turnRate) >= p.threshold;
    let flags = MARK_NONE;
    if (p.mode === 0) {
      if (!(p.bendCut && tight)) {
        flags |= MARK_LANE_DASHES;
        if (info.stage === 'stadium' && p.stadiumDouble) flags = MARK_CENTRE_DOUBLE | MARK_EDGE_LINES;
        else flags |= MARK_EDGE_LINES;
      } else if (info.stage === 'stadium') {
        flags = MARK_EDGE_LINES;
      }
    } else if (p.mode === 1) flags = MARK_LANE_DASHES | MARK_EDGE_LINES;
    else if (p.mode === 2) flags = MARK_CENTRE_DOUBLE | MARK_EDGE_LINES;
    for (let c = 0; c < field.across; c++) field.mask.setFlags(c, row, flags);
    return true;
  },
};

/* -----------------------------------------------------------------------------
   7 · stage theme — the one click
   -------------------------------------------------------------------------- */
/** What each stage of the mountain is dressed in by default. */
export interface StageDress {
  readonly core: number;
  readonly shoulder: number;
  readonly width: number;
  readonly edge: number;
  readonly ruts: number;
  readonly markings: number;
}

export const STAGE_DRESS: Readonly<Partial<Record<TrackStageId, StageDress>>> = Object.freeze({
  alpine: { core: SURFACE_ASPHALT, shoulder: SURFACE_GRAVEL, width: 0.8, edge: 0.35, ruts: 0.4, markings: 0 },
  canyon: { core: SURFACE_DIRT, shoulder: SURFACE_ROCK, width: 0.95, edge: 0.5, ruts: 0.2, markings: 0 },
  zigzag: { core: SURFACE_DIRT, shoulder: SURFACE_ROCK, width: 0.9, edge: 0.5, ruts: 0.25, markings: 0 },
  cavern: { core: SURFACE_CAVEROCK, shoulder: SURFACE_CAVEROCK, width: 1, edge: 0.2, ruts: 0.15, markings: 3 },
  mine: { core: SURFACE_PLANK, shoulder: SURFACE_CAVEROCK, width: 0.92, edge: 0.15, ruts: 0.2, markings: 3 },
  breakthrough: { core: SURFACE_ROCK, shoulder: SURFACE_ROCK, width: 1, edge: 0.3, ruts: 0.1, markings: 3 },
  stadium: { core: SURFACE_COBBLE, shoulder: SURFACE_CONCRETE, width: 0.94, edge: 0.25, ruts: 0.3, markings: 2 },
});

export const STAGE_RULE: PaintRule = {
  id: 'stage-theme',
  name: 'Stage theme',
  blurb: 'One pass that dresses every stage from a table: carriageway surface, shoulders, wear and markings, each per row.',
  params: [
    P('intensity', 'Intensity', 0.2, 2, 0.05, 1, { hint: 'Scales every width, wear and strength' }),
    P('keepBridges', 'Keep plank bridges', 0, 1, 1, 1, { bool: true }),
    P('ruts', 'Add worn ruts', 0, 1, 1, 1, { bool: true }),
    P('markings', 'Add markings', 0, 1, 1, 0, { bool: true, hint: 'Off by default: use the Markings rule to choose' }),
  ],
  row(field, row, info, p) {
    const dress = STAGE_DRESS[info.stage];
    if (!dress) return false;
    if (p.keepBridges && info.onBridge) return false;
    const k = p.intensity;
    paintBand(field, row, 0.5 - (dress.width * k) / 2, 0.5 + (dress.width * k) / 2, dress.core, 1, dress.edge);
    paintEdges(field, row, Math.min(0.24, 0.16 * k), dress.shoulder, 0.9, 0.6);
    if (p.ruts && dress.ruts > 0) paintRuts(field, row, info, dress.ruts * k, dress.core === SURFACE_DIRT ? SURFACE_GRAVEL : SURFACE_DIRT);
    if (p.markings) {
      const flags = dress.markings === 2 ? MARK_CENTRE_DOUBLE | MARK_EDGE_LINES : dress.markings === 1 ? MARK_LANE_DASHES : MARK_NONE;
      for (let c = 0; c < field.across; c++) field.mask.setFlags(c, row, flags);
    }
    return true;
  },
};

/** Two tracks per lane at fixed positions, used by the stage pass. */
function paintRuts(field: PaintField, row: number, info: RowInfo, depth: number, surface: number): void {
  const gaugeU = 70 / Math.max(1, 2 * info.halfWidth);
  const widthU = 26 / Math.max(1, 2 * info.halfWidth);
  for (let lane = 0; lane < 4; lane++) {
    const centre = (lane + 0.5) / 4;
    for (const side of [-1, 1]) {
      const at = centre + side * gaugeU;
      paintBand(field, row, at - widthU / 2, at + widthU / 2, surface, depth, 0.45);
    }
  }
}

export const PAINT_RULES: readonly PaintRule[] = Object.freeze([
  CARRIAGEWAY_RULE, SHOULDERS_RULE, CORNERS_RULE, RUTS_RULE, PATCHES_RULE, MARKINGS_RULE, STAGE_RULE,
]);
export const paintRule = (id: string): PaintRule | undefined => PAINT_RULES.find((r) => r.id === id);

/* -----------------------------------------------------------------------------
   Presets — the "easy" part: one click, a whole dressed road
   -------------------------------------------------------------------------- */
export interface PresetStep {
  readonly rule: string;
  readonly params?: Partial<PaintParams>;
}

export interface PaintPreset {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly steps: readonly PresetStep[];
}

export const PAINT_PRESETS: readonly PaintPreset[] = Object.freeze([
  {
    id: 'asphalt-highway', name: 'Asphalt highway',
    blurb: 'Wide asphalt carriageway, gravel shoulders, worn ruts (and dashes on the straights when Road lines is on).',
    steps: [
      { rule: 'carriageway', params: { surface: SURFACE_ASPHALT, width: 0.88, edge: 0.3, wobble: 0.3 } },
      { rule: 'shoulders', params: { surface: SURFACE_GRAVEL, width: 300, taper: 0.6 } },
      { rule: 'corners', params: { surface: SURFACE_GRAVEL, width: 0.24 } },
      { rule: 'ruts', params: { surface: SURFACE_DIRT, depth: 0.4 } },
      { rule: 'markings', params: { mode: 0 } },
    ],
  },
  {
    id: 'rally-stage', name: 'Rally stage',
    blurb: 'A narrow ribbon of hardpack through dirt, fat loose shoulders, scree on every corner exit.',
    steps: [
      { rule: 'carriageway', params: { surface: SURFACE_CONCRETE, width: 0.5, edge: 0.55, wobble: 0.7 } },
      { rule: 'shoulders', params: { surface: SURFACE_DIRT, width: 520, taper: 0.85 } },
      { rule: 'corners', params: { surface: SURFACE_GRAVEL, width: 0.34, threshold: 0.00014 } },
      { rule: 'markings', params: { mode: 3 } },
    ],
  },
  {
    id: 'stadium-circuit', name: 'Stadium circuit',
    blurb: 'Cobbles under the lights, concrete aprons, repair patches (double and edge lines when Road lines is on).',
    steps: [
      { rule: 'carriageway', params: { surface: SURFACE_COBBLE, width: 0.95, edge: 0.12 } },
      { rule: 'shoulders', params: { surface: SURFACE_CONCRETE, width: 180, taper: 0.3 } },
      { rule: 'markings', params: { mode: 2, bendCut: 0 } },
      { rule: 'patches', params: { surface: SURFACE_ASPHALT, cover: 0.22, length: 520 } },
    ],
  },
  {
    id: 'mine-works', name: 'Mine works',
    blurb: 'Planks in the mine, wet rock in the caverns, no road markings underground at all.',
    steps: [
      { rule: 'stage-theme', params: { intensity: 1.05, ruts: 1, markings: 0 } },
      { rule: 'corners', params: { surface: SURFACE_CAVEROCK, width: 0.18, threshold: 0.00022 } },
    ],
  },
  {
    id: 'dirt-only', name: 'Dirt & wear only',
    blurb: 'The stuff time does to a painted road — ruts worn back to dirt, scree at the corners, soft repairs. Run it after a carriageway pass: on unpainted road, dirt is what the road already is.',
    steps: [
      { rule: 'ruts', params: { surface: SURFACE_DIRT, depth: 0.55, breakup: 0.5 } },
      { rule: 'corners', params: { surface: SURFACE_GRAVEL, width: 0.2 } },
      { rule: 'patches', params: { surface: SURFACE_DIRT, cover: 0.5, span: 0.7, strength: 0.5 } },
    ],
  },
]);

export const paintPreset = (id: string): PaintPreset | undefined => PAINT_PRESETS.find((p) => p.id === id);

/** Coverage per surface id across the span — the panel's readout, and the test's assertion. */
export function coverage(field: PaintField, row0: number, row1: number): { id: number; name: string; texels: number; share: number }[] {
  const counts = new Map<number, number>();
  let total = 0;
  for (let row = row0; row < row1; row++) {
    for (let c = 0; c < field.across; c++) {
      const i = field.mask.index(c, row);
      if (field.mask.data[i] === 0 && field.mask.data[i + 1] === 0) continue;
      const id = field.mask.dominantId(c, row);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      total++;
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, texels]) => ({ id, name: surfaceDefinition(id).name, texels, share: total ? texels / total : 0 }));
}

export { SURFACE_DIRT, SURFACE_ASPHALT, SURFACE_GRAVEL, SURFACE_CONCRETE, SURFACE_COBBLE, SURFACE_PLANK, MARK_NONE, MARK_LANE_DASHES, MARK_CENTRE_DOUBLE, MARK_EDGE_LINES };
