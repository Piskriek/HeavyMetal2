/**
 * ISLAND-ROUTE authoring report: arc per engine distance for every stretch (the classic course runs
 * at ~4.37), the left-to-right order of each fork's branches, and how far a branch's map disagrees
 * with the main map at its split and merge (position and frame).
 *
 *   node --import tsx scripts/island-route-report.ts
 */
import { buildTrackSpace } from '../src/game/track-space';
import { ISLAND_ANCHORS, ISLAND_ROUTE_GRAPH, ISLAND_SEGMENTS, islandCenterline } from '../src/game/island-route/basalt-route';

const build = (choice: Record<string, string> = {}) => {
  const { waypoints, knots } = islandCenterline(choice);
  return buildTrackSpace(waypoints, [], [], { knots });
};
const main = build();
const dist = (x: number) => (x - 190) / 2;
console.log(`main length ${Math.round(main.length)}  overall arc/dist ${main.ARC_PER_ENGINE_DISTANCE.toFixed(2)}`);

for (let i = 0; i < ISLAND_SEGMENTS.length; i++) {
  const a = ISLAND_ANCHORS[i];
  const b = ISLAND_ANCHORS[i + 1];
  const seg = ISLAND_SEGMENTS[i];
  const dd = dist(b.x) - dist(a.x);
  if (seg.kind === 'road') {
    const arc = main.distOf(b.label) - main.distOf(a.label);
    console.log(`${a.label.padEnd(15)} → ${b.label.padEnd(15)} road   ${(arc / dd).toFixed(2)}`);
    continue;
  }
  const rows: string[] = [];
  const lat: number[] = [];
  let worst = 0;
  for (const br of seg.branches) {
    const m = build({ [seg.id]: br.id });
    const arc = m.distOf(b.label) - m.distOf(a.label);
    rows.push(`${br.id} ${(arc / dd).toFixed(2)}`);
    // Where the branch is 1600 units past the split, measured across the main road's right vector.
    const probe = m.frameAt(m.distOf(a.label) + 1600).pos;
    const f = main.frameAt(main.distOf(a.label));
    lat.push((probe.x - f.pos.x) * f.right.x + (probe.y - f.pos.y) * f.right.y + (probe.z - f.pos.z) * f.right.z);
    for (const label of [a.label, b.label]) {
      const fm = main.frameAt(main.distOf(label));
      const fb = m.frameAt(m.distOf(label));
      const dp = Math.hypot(fm.pos.x - fb.pos.x, fm.pos.y - fb.pos.y, fm.pos.z - fb.pos.z);
      const up = Math.acos(Math.min(1, fm.up.x * fb.up.x + fm.up.y * fb.up.y + fm.up.z * fb.up.z)) * 180 / Math.PI;
      const tan = Math.acos(Math.min(1, fm.tangent.x * fb.tangent.x + fm.tangent.y * fb.tangent.y + fm.tangent.z * fb.tangent.z)) * 180 / Math.PI;
      worst = Math.max(worst, dp + up * 10 + tan * 10);
      if (dp > 1 || up > 0.5 || tan > 0.5) rows.push(`!${label} Δpos ${dp.toFixed(1)} Δup ${up.toFixed(2)}° Δtan ${tan.toFixed(2)}°`);
    }
  }
  const ordered = lat.every((v, k) => k === 0 || v > lat[k - 1]);
  console.log(`${a.label.padEnd(15)} → ${b.label.padEnd(15)} fork   ${rows.join('  ')}  lateral ${lat.map((v) => Math.round(v)).join(' < ')} ${ordered ? 'ok' : 'ORDER WRONG'}`);
}
console.log('route graph sections', ISLAND_ROUTE_GRAPH.sections.length);
for (const s of ['alpine', 'canyon', 'zigzag', 'cavern', 'mine', 'breakthrough', 'stadium'] as const) {
  console.log(s.padEnd(13), Math.round(main.stageStart[s]), '→', Math.round(main.stageEnd[s]));
}
let minY = Infinity, maxY = -Infinity;
for (const sm of main.samples) { minY = Math.min(minY, sm.pos.y); maxY = Math.max(maxY, sm.pos.y); }
console.log('height range', Math.round(minY), Math.round(maxY));
