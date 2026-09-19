#!/usr/bin/env node
/**
 * Cuts the TICKET-08 Section 2 (Vertical Pinball Drop & Waterfall Zig-Zag)
 * track-part art from the generated sources in `scratch/track-parts-src/` into
 * the runtime PNGs in `public/art/track-parts/`, per the Asset Generation
 * Manifest on issue #10.
 *
 * This is the track-part sibling of `cut-ui-art.mjs`: the same border matte
 * detection (adapted to the chroma GREEN backdrop used by the generated
 * sources, with the same green signature as the runtime cutout() in
 * `src/game/assets.ts`), the same two-pass fuzz key and fringe-only despill
 * (clamping the matte's own channel — G for green — ported verbatim), and the
 * same ImageMagick 6 requirement. Idempotent: already-keyed sources are
 * detected and only despilled again.
 *
 * Outputs (exact manifest names/sizes):
 *  - `waterfall-sheet.png`        512x1024 opaque tile, seamless vertically
 *                                 (roll + soft crossfade so the water still
 *                                 reads as flowing downward)
 *  - `waterfall-splash.png`       512x512 transparent sprite
 *  - `rock-deflector.png`         512x512 transparent sprite
 *  - `bridge-wooden-broken.png`   512x256 transparent sprite
 *  - `cliff-scaffolding.png`      512x512 transparent sprite
 *
 * Usage: node scripts/process-track-parts.mjs
 * Requires ImageMagick 6 on PATH, exactly like the sprite pipeline.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = (file) => join(root, 'scratch/track-parts-src', file);
const out = (file) => join(root, 'public/art/track-parts', file);
const tmp = (file) => join(root, 'scratch/track-parts-src/tmp', file);
mkdirSync(join(root, 'public/art/track-parts'), { recursive: true });
mkdirSync(join(root, 'scratch/track-parts-src/tmp'), { recursive: true });

let step = 0;
const temp = (label) => tmp(`${++step}-${label}.png`);
const run = (args) => execFileSync('convert', args, { stdio: ['ignore', 'pipe', 'pipe'] });
const size = (file) => execFileSync('identify', ['-format', '%wx%h', file], { encoding: 'utf8' }).trim();
const rgbOf = (text) => (text.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/** Matte detection: most frequent quantised border colour with a GREEN
 *  signature (same thresholds as the runtime cutout() matte in
 *  src/game/assets.ts). Returns null when the border is already transparent
 *  (idempotent re-runs) or when there is no chroma border (opaque tiles). */
function matteOf(file) {
  const [width, height] = size(file).split('x').map(Number);
  const strips = [`1x${height}+0+0`, `1x${height}+${width - 1}+0`, `${width}x1+0+0`, `${width}x1+0+${height - 1}`];
  const counts = new Map();
  for (const strip of strips) {
    const text = execFileSync('convert', [file, '-crop', strip, '+repage', 'txt:-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    for (const line of text.split('\n')) {
      const at = line.indexOf(':');
      if (at < 0) continue;
      const [r, g, b] = rgbOf(line.slice(at + 1));
      if (![r, g, b].every(Number.isFinite)) continue;
      if (!(g > 150 && r < 130 && b < 140 && g > Math.max(r, b) * 1.65)) continue;
      const key = [r, g, b].map((v) => Math.round(v / 8) * 8).join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  if (!counts.size) return null;
  const [r, g, b] = [...counts.entries()].sort((a, c) => c[1] - a[1])[0][0].split(',').map(Number);
  return `#${[r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('')}`;
}

/** cut-ui-art.mjs's despill(), verbatim strategy adapted to a green matte:
 *  clamp the matte's own channel (G) to the strongest remaining channel
 *  (Lighten of R and B), only on the anti-aliased fringe — the fully opaque
 *  interior (goblin greens, moss, spray whites) is protected. */
function despill(file) {
  const channels = {};
  for (const name of ['R', 'G', 'B']) {
    const target = temp(`chan${name}`);
    run([file, '-channel', name, '-separate', target]);
    channels[name] = target;
  }
  const alpha = temp('alpha');
  run([file, '-alpha', 'extract', alpha]);
  const interior = temp('interior');
  run([alpha, '-threshold', '96%', interior]);

  const output = {};
  for (const [name, others] of [['G', ['R', 'B']]]) {
    const ceiling = temp('ceiling');
    run([channels[others[0]], channels[others[1]], '-compose', 'Lighten', '-composite', ceiling]);
    const clamped = temp('clamped');
    run([channels[name], ceiling, '-compose', 'Darken', '-composite', clamped]);
    const kept = temp('kept');
    run([channels[name], interior, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', kept]);
    const merged = temp('merged');
    run([clamped, kept, '-compose', 'Over', '-composite', merged]);
    output[name] = merged;
  }
  const rgb = temp('rgb');
  run([channels.R, output.G, channels.B, '-combine', '-alpha', 'off', rgb]);
  const result = temp('despilled');
  run([rgb, alpha, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', result]);
  run([result, file]);
  return file;
}

/** Fuzz-key the border matte when present, then always despill the fringe. */
function keyOut(file) {
  const hex = matteOf(file);
  if (hex) {
    run([file, '-fuzz', '18%', '-transparent', hex, file]);
    run([file, '-fuzz', '34%', '-transparent', hex, file]);
  }
  despill(file);
  return Boolean(hex);
}

/** Fit the keyed content inside a WxH transparent canvas (manifest size):
 *  trim the empty border, leave a small margin, downscale to fit, centre. */
function mountFit(file, width, height, margin = 12) {
  const trimmed = temp('trimmed');
  const fitted = temp('fitted');
  run([file, '-trim', '+repage', trimmed]);
  run([trimmed, '-bordercolor', 'none', '-border', `${margin}`, '-resize', `${width}x${height}`, fitted]);
  const [fitW, fitH] = size(fitted).split('x').map(Number);
  run(['-size', `${width}x${height}`, 'xc:none', fitted, '-gravity', 'center', '-compose', 'over', '-composite', file]);
  return [fitW, fitH];
}

/** Waterfall tile: centre square crop -> 1024x1024 -> roll half a tile down
 *  (moves the hard wrap seam into the middle) -> soft-masked crossfade with
 *  the unrolled original across the middle band (which is continuous in the
 *  original, so the seam dissolves into the foam). The wrap edges of the
 *  result are adjacent rows of the rolled image: seamless by construction,
 *  and the water still flows strictly downward. */
function waterfallTile(source, target) {
  const [srcW, srcH] = size(source).split('x').map(Number);
  const side = Math.min(srcW, srcH);
  const square = temp('square');
  run([source, '-gravity', 'center', '-crop', `${side}x${side}+0+0`, '+repage', '-resize', '1024x1024', square]);
  const rolled = temp('rolled');
  run([square, '-roll', '+0+512', rolled]);
  const mask = temp('mask');
  run([
    '-size', '1024x1024', 'xc:black',
    '-fill', 'white', '-draw', 'rectangle 0,300 1023,724',
    '-blur', '0x48',
    mask,
  ]);
  const overlay = temp('overlay');
  run([square, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', overlay]);
  const blended = temp('blended');
  run([rolled, overlay, '-compose', 'over', '-composite', blended]);
  run([blended, '-resize', '512x1024!', '-strip', target]);
}

const log = (label, file) => console.log(`${label.padEnd(30)} ${file.replace(root, '')}  ${size(file)}`);

/* 1. waterfall-sheet: opaque seamless tile ------------------------------------------ */
const sheetTarget = out('waterfall-sheet.png');
waterfallTile(src('waterfall-sheet-src.png'), sheetTarget);
log('waterfall sheet (tile)', sheetTarget);

/* 2-5. Keyed sprites ---------------------------------------------------------------- */
const sprites = [
  ['waterfall-splash-src.png', 'waterfall-splash.png', 512, 512],
  ['rock-deflector-src.png', 'rock-deflector.png', 512, 512],
  ['bridge-wooden-broken-src.png', 'bridge-wooden-broken.png', 512, 256],
  ['cliff-scaffolding-src.png', 'cliff-scaffolding.png', 512, 512],
];
for (const [sourceName, outName, width, height] of sprites) {
  const working = temp('work');
  const [srcW, srcH] = size(src(sourceName)).split('x').map(Number);
  const fit = Math.max(width, height) * 2; // key at 2x for a clean fringe, downscale on mount
  const scale = Math.min(1, fit / Math.max(srcW, srcH));
  run([src(sourceName), '-resize', `${Math.round(srcW * scale)}x${Math.round(srcH * scale)}!`, working]);
  const keyed = keyOut(working);
  mountFit(working, width, height);
  run([working, '-strip', out(outName)]);
  log(keyed ? `${outName} (keyed)` : `${outName} (no matte!)`, out(outName));
}
