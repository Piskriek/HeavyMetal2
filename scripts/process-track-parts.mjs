#!/usr/bin/env node
// TICKET-09 track-part post-processing pipeline.
//
// Reads raw magenta-backed generations from scratch/gen/<name>-src.png, keys the
// magenta #FF00FF matte to alpha, despills the magenta fringe, trims empty margin
// and aspect-fits the artwork onto the exact runtime canvas declared below,
// writing public/art/track-parts/<name>.png. Mirrors the keying rules described
// in docs/ART_PIPELINE.md (magenta key, fringe-only despill, fixed runtime box).
//
// Usage: node scripts/process-track-parts.mjs [name ...]   (no args = all known)

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const GEN = 'scratch/gen';
const PROC = 'scratch/proc';
const OUT = 'public/art/track-parts';

// canvas: runtime size; gravity: where the trimmed art is anchored in the box.
// probes: [x, y, expectAlpha] pixel assertions on the final sprite.
export const ASSETS = {
  'mine-rails':            { w: 512,  h: 512,  g: 'center', probes: [[4, 4, 0]] },
  'mine-gate':             { w: 1024, h: 512,  g: 'south',  probes: [[4, 4, 0]] },
  'lava-sheet':            { w: 512,  h: 512,  g: 'center', probes: [] }, // opaque tile
  'cauldron-molten':       { w: 512,  h: 512,  g: 'center', probes: [[4, 4, 0]] },
  'stadium-gantry':        { w: 1024, h: 512,  g: 'south',  probes: [[4, 4, 0]] },
  'rock-tunnel-frame-a':   { w: 1024, h: 1024, g: 'center', probes: [[512, 512, 0], [2, 2, 1]] },
  'rock-tunnel-frame-b':   { w: 1024, h: 1024, g: 'center', probes: [[512, 512, 0], [2, 2, 1]] },
  'rock-ceiling-cutout':   { w: 1024, h: 512,  g: 'north',  probes: [[512, 508, 0], [512, 2, 1]] },
  'rock-floor-ledge':      { w: 1024, h: 512,  g: 'south',  probes: [[512, 4, 0], [512, 508, 1]] },
  'rock-wall-left':        { w: 512,  h: 1024, g: 'west',   probes: [[508, 512, 0], [2, 512, 1]] },
  'rock-wall-right':       { w: 512,  h: 1024, g: 'east',   probes: [[4, 512, 0], [508, 512, 1]] },
  'rock-boulder-a':        { w: 512,  h: 512,  g: 'south',  probes: [[4, 4, 0]] },
  'rock-boulder-b':        { w: 512,  h: 512,  g: 'south',  probes: [[4, 4, 0]] },
  'goblin-bleacher-a':     { w: 1024, h: 512,  g: 'south',  probes: [[4, 4, 0]] },
  'goblin-bleacher-b':     { w: 1024, h: 512,  g: 'south',  probes: [[4, 4, 0]] },
};

const run = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

function keyAndTrim(src, keyed) {
  run(
    `convert "${src}" -alpha set ` +
      `-channel A -fx "((r>0.55)&&(b>0.55)&&(g<0.6))?0:a" ` +
      `-channel R -fx "(((min(r,b)-g)>0.25)&&(a>0))?min(r,max(g,b)):r" ` +
      `-channel B -fx "(((min(r,b)-g)>0.25)&&(a>0))?min(b,max(g,r)):b" ` +
      `+channel -trim +repage "${keyed}"`
  );
}

function fit(keyed, out, { w, h, g }) {
  const dims = run(`identify -format "%w %h" "${keyed}"`).split(/\s+/).map(Number);
  const s = Math.min(w / dims[0], h / dims[1]);
  const rw = Math.max(1, Math.round(dims[0] * s));
  const rh = Math.max(1, Math.round(dims[1] * s));
  run(
    `convert "${keyed}" -resize ${rw}x${rh}! -gravity ${g} -background none -extent ${w}x${h} "${out}"`
  );
}

function probe(out, [x, y, expect]) {
  const a = Number(
    run(`convert "${out}" -crop 1x1+${x}+${y} +repage -alpha extract -format "%[fx:round(mean)]" info:`)
  );
  const got = a > 0 ? 1 : 0;
  return { x, y, expect, got, ok: got === expect };
}

mkdirSync(PROC, { recursive: true });
mkdirSync(OUT, { recursive: true });

const names = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(ASSETS);
let failed = 0;

for (const name of names) {
  const spec = ASSETS[name];
  const src = `${GEN}/${name}-src.png`;
  if (!spec || !existsSync(src)) {
    console.log(`skip  ${name} (no spec or source)`);
    continue;
  }
  const keyed = `${PROC}/${name}-keyed.png`;
  const out = `${OUT}/${name}.png`;
  keyAndTrim(src, keyed);
  fit(keyed, out, spec);
  const dims = run(`identify -format "%wx%h" "${out}"`);
  const meanAlpha = Number(run(`convert "${out}" -channel A -separate -format "%[fx:mean]" info:`));
  const bad = spec.probes.map((p) => probe(out, p)).filter((r) => !r.ok);
  const status = bad.length === 0 ? 'ok  ' : 'FAIL';
  if (bad.length) failed++;
  console.log(
    `${status} ${name}.png ${dims} meanAlpha=${meanAlpha.toFixed(3)}` +
      (bad.length ? ` probes-failed=${JSON.stringify(bad)}` : '')
  );
}

process.exit(failed ? 1 : 0);
