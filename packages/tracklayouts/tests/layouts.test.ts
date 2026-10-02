import test from 'node:test';
import assert from 'node:assert/strict';
import { chaikin, isSimple, loopLength, resample } from '@hm/trackgen';
import { LAYOUTS } from '../src';

type V = readonly [number, number];
const centre = (pts: readonly V[]): V[] => resample(chaikin(pts, 2), 4);
const signedArea = (p: readonly V[]): number => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]!; return s + (a[0] * b[1] - b[0] * a[1]); }, 0) / 2;
/** Smallest radius of curvature (circumscribed circle of consecutive samples). */
function minRadius(p: readonly V[]): number {
  let best = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!, c = p[(i + 2) % p.length]!;
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const cross = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    if (cross > 1e-9) best = Math.min(best, (ab * bc * ca) / (2 * cross));
  }
  return best;
}
/** Smallest gap between two parts of the loop that are more than 60 m apart along it. */
function separation(p: readonly V[], step = 4): number {
  let best = Infinity;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
    const along = Math.min((j - i) * step, (p.length - (j - i)) * step);
    if (along < 60) continue;
    best = Math.min(best, Math.hypot(p[i]![0] - p[j]![0], p[i]![1] - p[j]![1]));
  }
  return best;
}

test('14 designed layouts with unique ids', () => {
  assert.equal(LAYOUTS.length, 14);
  assert.equal(new Set(LAYOUTS.map((l) => l.id)).size, 14);
  for (const l of LAYOUTS) { assert.ok(l.name && l.doc.length > 20, l.id); assert.ok(l.points.length >= 8 && l.points.length <= 24, `${l.id} points`); assert.ok(l.width >= 9 && l.width <= 16, `${l.id} width`); }
});

test('every layout is a drivable loop: inside the island, simple, sensible length, roomy corners, legs kept apart, straight start', () => {
  const report: string[] = [];
  for (const l of LAYOUTS) {
    const raw = l.points as readonly V[];
    const problems: string[] = [];
    if (raw.some((p) => Math.abs(p[0]) > 110 || Math.abs(p[1]) > 110)) problems.push('outside the island');
    if (!isSimple(raw)) problems.push('control polygon crosses itself');
    const c = centre(raw);
    if (!isSimple(c)) problems.push('smoothed line crosses itself');
    const len = loopLength(c);
    if (len < 260 || len > 900) problems.push(`length ${Math.round(len)}`);
    const r = minRadius(c);
    if (r < l.width * 0.9) problems.push(`tight corner ${r.toFixed(1)} m for width ${l.width}`);
    const sep = separation(c);
    if (sep < l.width + 14) problems.push(`legs ${sep.toFixed(1)} m apart`);
    if (signedArea(c) > 0) problems.push('wrong direction');
    if (problems.length) report.push(`${l.id}: ${problems.join('; ')}`);
  }
  assert.deepEqual(report, [], report.join('\n'));
});
