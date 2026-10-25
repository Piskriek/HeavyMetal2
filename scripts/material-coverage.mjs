/**
 * How much of a machine each layer of each shelf material covers (plan 41 §7, for tuning the shelf): every layer's mean weight in six
 * places on a 2.8 m machine — the same report `@hm/matstack`'s `coverage()` returns and `packages/matstack/tests/coverage.test.ts`
 * holds to targets:
 *  - side:   a big side face at chest height, far from any edge or crease;
 *  - edge:   within 5 mm of a sharp convex edge;
 *  - crease: within 5 mm of a crease;
 *  - top:    an up-facing face;
 *  - bottom: a down-facing face under the machine (soot and drips);
 *  - splash: a side face 10 cm above the foot.
 * A bloom or a speck should be small on a side; edge wear high on edges and near 0 on faces; dust high on tops; soot on tops and
 * undersides; oil only under edges and in creases. The two metal columns answer "does a worn edge show bare metal?".
 *   node --import tsx scripts/material-coverage.mjs [mat ids, comma separated]
 *   node --import tsx scripts/material-coverage.mjs --check     (exit 1 when a target is missed)
 */
import { COVERAGE_ZONES, MATERIAL_SHELF, coverage, coverageOf, resolveMatPreset } from '../packages/matstack/src/index.ts';
import { atlasNoiseSource, atlasTileSource } from '../packages/texgraph/src/index.ts';

const noise = atlasNoiseSource();
const tiles = atlasTileSource();
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const check = process.argv.includes('--check');
const only = (args[0] ?? '').split(',').filter(Boolean);
const ids = only.length ? only.map((id) => (id.startsWith('mat:') ? id : `mat:${id}`)) : Object.keys(MATERIAL_SHELF);
const pct = (x) => `${Math.round(x * 100)}%`.padStart(5);
const grid = 24;

console.log(`zones: ${COVERAGE_ZONES.join(', ')} (${grid} x ${grid} points each, on a 2.8 m machine)`);
console.log(`${'material / layer'.padEnd(40)}${COVERAGE_ZONES.map((z) => z.padStart(7)).join('')}`);

const failures = [];
const want = (ok, message) => { if (!ok) failures.push(message); };

for (const id of ids) {
  const m = resolveMatPreset(id);
  if (!m) {
    console.log(`${id}: not in the shelf`);
    continue;
  }
  const r = coverage(m, tiles, noise, grid);
  console.log(
    `${id} (age ${m.age})`.padEnd(40) +
      `edge metal ${r.edgeMetal.toFixed(2)} / mean ${r.edgeMetalMean.toFixed(2)}, side ${r.sideMetal.toFixed(2)}, ` +
      `top lum ${r.zoneLuminance.top.toFixed(3)}`,
  );
  for (const l of r.layers) console.log(`  ${l.name.padEnd(38)}${COVERAGE_ZONES.map((z) => pct(l.zones[z])).join('')}`);

  // the targets from the 22 October review (JOB-02 §3, JOB-04 §1), for the materials they name
  if (id === 'mat:field-worn-hazard') {
    const side = coverageOf(r, 'Rust bloom', 'side');
    want(side >= 0.02 && side <= 0.15, `rust bloom covers ${pct(side)} of a side face (want 2-15%)`);
    want(coverageOf(r, 'Rust bloom', 'crease') > side * 2, 'rust bloom should gather in creases');
  }
  if (id === 'mat:workshop-steel') {
    const side = coverageOf(r, 'Oil leaks', 'side');
    want(side <= 0.05, `oil leaks cover ${pct(side)} of a side face (want <= 5%)`);
    want(coverageOf(r, 'Oil leaks', 'edge') >= 0.1, 'oil should show under edges');
    want(coverageOf(r, 'Oil leaks', 'crease') >= 0.15, 'oil should pool in crevices');
  }
  if (id === 'mat:furnace') {
    want(coverageOf(r, 'Soot', 'top') >= 0.15 || coverageOf(r, 'Soot', 'bottom') >= 0.15, 'soot is not visible anywhere');
  }
  if (id === 'mat:crushed-ore-bed') {
    want(coverageOf(r, 'Moon dust', 'top') === 0, 'moon dust is on the ore bed again');
    want(r.zoneLuminance.top <= 0.25, `the ore bed's top reads at luminance ${r.zoneLuminance.top.toFixed(3)} (want <= 0.25)`);
  }
  if (m.layers.some((l) => ['Edge wear', 'Paint chips', 'Scratches'].includes(l.name))) {
    want(r.edgeMetal >= 0.45, `a worn edge peaks at metal ${r.edgeMetal.toFixed(2)} (want >= 0.45)`);
  }
}

if (check) {
  if (failures.length) {
    console.log(`\n${failures.length} coverage target(s) missed:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nall coverage targets met');
}
