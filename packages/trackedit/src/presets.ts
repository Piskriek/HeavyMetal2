/**
 * Built-in starter layouts.
 *
 * Every layout is a closed, non self-crossing loop described by 8-16 control
 * points and roughly 50-90 m across, and every one of them passes `analyse()`
 * (length 200-2500 m, no corner tighter than the road width).
 *
 * Shapes are generated from parametric radii so the file stays data-driven and
 * deterministic — no randomness, no clock.
 */

import { round2, TAU } from './math';
import type { ControlPoint, TrackDraft } from './types';

export type DraftPreset = { id: string; name: string; doc: string; draft: TrackDraft };

type RadiusFn = (theta: number) => number;

/** Sample a polar shape into `n` control points. */
function ring(n: number, radius: RadiusFn): ControlPoint[] {
  const points: ControlPoint[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * TAU;
    const r = radius(theta);
    points.push({ x: round2(Math.cos(theta) * r), z: round2(Math.sin(theta) * r) });
  }
  return points;
}

/** Polar radius of an ellipse with semi-axes `a` (x) and `b` (z). */
const ellipse = (a: number, b: number): RadiusFn => (theta) =>
  (a * b) / Math.hypot(b * Math.cos(theta), a * Math.sin(theta));

/** Multiplicative inward dent: `1 - depth * gauss(theta - at)` with width `sigma` radians. */
const dent = (depth: number, at: number, sigma: number): RadiusFn => (theta) => {
  let d = theta - at;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return 1 - depth * Math.exp(-(d * d) / (2 * sigma * sigma));
};

const combine =
  (...fns: readonly RadiusFn[]): RadiusFn =>
  (theta) =>
    fns.reduce((r, f) => r * f(theta), 1);

const closed = (points: ControlPoint[], width: number): TrackDraft => ({
  points,
  closed: true,
  width,
});

export const DRAFT_PRESETS: DraftPreset[] = [
  {
    id: 'oval',
    name: 'Oval',
    doc: 'Fast 84 x 66 m oval — two long flats joined by four gentle 26 m bends.',
    draft: closed(ring(12, ellipse(42, 33)), 12),
  },
  {
    id: 'kidney',
    name: 'Kidney',
    doc: 'Kidney loop with a shallow bite out of the top rail and a flowing back straight.',
    draft: closed(ring(16, combine(ellipse(44, 34), dent(0.17, Math.PI / 2, 0.75))), 14),
  },
  {
    id: 'bean',
    name: 'Bean',
    doc: 'Compact bean shape: one tight inward curve at the north end, quick Ess on the south.',
    draft: closed(ring(14, combine(ellipse(41, 35), dent(0.2, 1.9, 0.7))), 12),
  },
  {
    id: 'hairpin-run',
    name: 'Hairpin run',
    doc: 'Long 88 x 58 m speed run down the east side, dented braking bend on the way home.',
    draft: closed(ring(12, combine(ellipse(44, 29), dent(0.12, 0.9, 0.6))), 12),
  },
  {
    id: 'coast-circuit',
    name: 'Coast circuit',
    doc: 'Wavy 88 m coastal ring — three sweeping crests and dips, no corner below 20 m radius.',
    draft: closed(ring(16, (theta) => 40 + 4 * Math.sin(3 * theta)), 12),
  },
  {
    id: 'figure-nine',
    name: 'Figure nine',
    doc: 'Peanut-shaped double loop pinched in the middle — two halves, never crossing itself.',
    draft: closed(ring(16, (theta) => 38 * dent(0.3, Math.PI, 0.62)(theta)), 14),
  },
];

/** Look up a preset draft by id (shared, immutable instance). */
export function presetDraft(id: string): TrackDraft | undefined {
  return DRAFT_PRESETS.find((p) => p.id === id)?.draft;
}
