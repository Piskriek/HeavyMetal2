/**
 * How much of a machine each layer of each shelf material covers (plan 41, for tuning the shelf): every layer's mean
 * weight in five places on a 2.8 m machine, with the game's own noise atlas:
 *  - face: a big side face at chest height, far from any edge or crease;
 *  - edge: within 5 mm of a sharp edge;
 *  - crease: within 5 mm of a crease;
 *  - top: an up-facing face;
 *  - splash: a side face 10 cm above the foot.
 * A bloom or a speck should be small on a face; edge wear high on edges and near 0 on faces; dust high on tops.
 *   node --import tsx scripts/material-coverage.mjs [mat ids, comma separated]
 */
import { MATERIAL_SHELF, NOISE_FEATURES, layerWeight, resolveMatPreset, surfaceAt } from '../packages/matstack/src/index.ts';
import { cpuNoise, cpuTiles } from '../apps/web/src/play/layered-material.ts';

const only = (process.argv[2] ?? '').split(',').filter(Boolean);
const ids = only.length ? only : Object.keys(MATERIAL_SHELF);
const grid = (fn) => {
  const out = [];
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) out.push(fn((i + 0.5) / 24, (j + 0.5) / 24));
  return out;
};
const places = {
  face: grid((u, v) => ({ uv: [u * 2.4, v * 1.2], pos: [u * 2.4, 0.9 + v * 1.2, 1.4], normal: [0, 0, 1], edge: 1, cavity: 1 })),
  edge: grid((u, v) => ({ uv: [u * 2.4, v * 2.4], pos: [u * 2.4, 0.5 + v * 2, 1.4], normal: [0, 0, 1], edge: 0.005 * v, cavity: 1 })),
  crease: grid((u, v) => ({ uv: [u * 2.4, v * 2.4], pos: [u * 2.4, 0.5 + v * 2, 1.4], normal: [0, 0, 1], edge: 1, cavity: 0.005 * v })),
  top: grid((u, v) => ({ uv: [u * 2.4, v * 2.4], pos: [u * 2.4, 2.6, v * 2.4], normal: [0, 1, 0], edge: 1, cavity: 1 })),
  splash: grid((u, v) => ({ uv: [u * 2.4, v * 0.2], pos: [u * 2.4, 0.1, 1.4], normal: [0, 0, 1], edge: 1, cavity: 1 })),
};
const pct = (x) => `${Math.round(x * 100)}%`.padStart(5);
console.log(`noise features per repeat: ${Object.entries(NOISE_FEATURES).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`${'layer'.padEnd(30)}${Object.keys(places).map((p) => p.padStart(7)).join('')}`);
for (const id of ids) {
  const m = resolveMatPreset(id);
  if (!m) continue;
  console.log(`${id} (age ${m.age})`);
  for (const l of m.layers) {
    const cells = Object.values(places).map((pts) => {
      let s = 0;
      for (const p of pts) s += layerWeight(l, surfaceAt(l.surface, p, m.paint, cpuTiles).height, p, m.age, cpuNoise);
      return pct(s / pts.length).padStart(7);
    });
    console.log(`  ${l.name.padEnd(28)}${cells.join('')}`);
  }
}
