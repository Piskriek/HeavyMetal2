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
 * Outputs (manifest names/sizes, plus the follow-up wall/tunnel/platform kit):
 *  - `waterfall-sheet.png`        512x1024 opaque tile, seamless vertically
 *                                 (roll + soft crossfade so the water still
 *                                 reads as flowing downward)
 *  - `waterfall-splash.png`       512x512 transparent sprite
 *  - `rock-deflector.png`         512x512 transparent sprite
 *  - `bridge-wooden-broken.png`   512x256 transparent sprite
 *  - `cliff-scaffolding.png`      512x512 transparent sprite
 *  - `wall-granite-strata.png`    512x1024 transparent wall column
 *  - `wall-slate-wet.png`         512x1024 transparent wall column
 *  - `wall-timber-braced.png`     512x1024 transparent wall column
 *  - `tunnel-mouth-stone.png`     512x512 transparent arch portal (opaque
 *                                 dark opening baked in)
 *  - `tunnel-mouth-timber.png`    512x512 transparent mine entrance
 *  - `rock-arch-wide.png`         1024x384 transparent natural arch (open
 *                                 area under the span is real transparency)
 *  - `rock-platform-deck.png`     512x512 transparent goblin viewing deck
 *  - `rock-platform-spire.png`    512x1024 transparent two-tier spire decks
 *  - `rock-platform-springboard.png` 512x512 transparent springboard ledge
 *  - `rock-platform-drums.png`    512x512 transparent drum-ring boulder
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

/** Matte detection: most frequent quantised border colour with a MAGENTA
 *  signature (cut-ui-art.mjs rules) or a GREEN signature (runtime cutout()
 *  rules in src/game/assets.ts). Sources are generated on whichever chroma
 *  backdrop is safest for the subject (magenta under green goblins). Returns
 *  null when the border is already transparent (idempotent re-runs) or when
 *  there is no chroma border (opaque tiles). */
function matteOf(file) {
  const [width, height] = size(file).split('x').map(Number);
  const strips = [`1x${height}+0+0`, `1x${height}+${width - 1}+0`, `${width}x1+0+0`, `${width}x1+0+${height - 1}`];
  const counts = { magenta: new Map(), green: new Map() };
  for (const strip of strips) {
    const text = execFileSync('convert', [file, '-crop', strip, '+repage', 'txt:-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    for (const line of text.split('\n')) {
      const at = line.indexOf(':');
      if (at < 0) continue;
      const [r, g, b] = rgbOf(line.slice(at + 1));
      if (![r, g, b].every(Number.isFinite)) continue;
      let kind = null;
      if (r > 150 && b > 150 && g < 110) kind = 'magenta';
      else if (g > 150 && r < 130 && b < 140 && g > Math.max(r, b) * 1.65) kind = 'green';
      if (!kind) continue;
      const key = [r, g, b].map((v) => Math.round(v / 8) * 8).join(',');
      counts[kind].set(key, (counts[kind].get(key) ?? 0) + 1);
    }
  }
  const kind = counts.magenta.size >= counts.green.size ? 'magenta' : 'green';
  if (!counts[kind].size) return null;
  const [r, g, b] = [...counts[kind].entries()].sort((a, c) => c[1] - a[1])[0][0].split(',').map(Number);
  return { kind, hex: `#${[r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('')}` };
}

/** cut-ui-art.mjs's despill(), verbatim strategy for the detected matte kind:
 *  clamp the matte's OWN channels (R and B for magenta, G for green) to the
 *  strongest remaining channel, only on the anti-aliased fringe — the fully
 *  opaque interior (goblin greens, moss, spray whites) is protected. */
function despill(file, kind) {
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
  const clamps = kind === 'magenta'
    ? [['R', ['G', 'B']], ['B', ['G', 'R']]]
    : [['G', ['R', 'B']]];
  for (const [name, others] of clamps) {
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
  run([output.R ?? channels.R, output.G ?? channels.G, output.B ?? channels.B, '-combine', '-alpha', 'off', rgb]);
  const result = temp('despilled');
  run([rgb, alpha, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', result]);
  run([result, file]);
  return file;
}

/** Fuzz-key the border matte when present, then always despill the fringe.
 *  GREEN-matte sources (no green-skinned subjects) use the original blanket
 *  two-pass fuzz key: it also eats chroma-adjacent painter's glow (lantern
 *  halos) and enclosed pockets like the under-arch opening. MAGENTA-matte
 *  sources (green goblins aboard) key by FLOOD FILL from border seeds so warm
 *  bunting/skin anywhere near the frame can never be holed; a final tight
 *  global pass catches enclosed pockets at a fuzz low enough to never match
 *  subject colours. */
function keyOut(file) {
  const matte = matteOf(file);
  if (matte) {
    if (matte.kind === 'green') {
      run([file, '-fuzz', '18%', '-transparent', matte.hex, file]);
      run([file, '-fuzz', '34%', '-transparent', matte.hex, file]);
    } else {
      const [width, height] = size(file).split('x').map(Number);
      const seeds = [
        [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
        [Math.floor(width / 2), 0], [0, Math.floor(height / 2)],
        [width - 1, Math.floor(height / 2)], [Math.floor(width / 2), height - 1],
      ];
      const draws = seeds.flatMap(([x, y]) => ['-draw', `matte ${x},${y} floodfill`]);
      for (const fuzz of ['20%', '35%']) {
        run([file, '-alpha', 'set', '-fuzz', fuzz, ...draws, file]);
      }
      run([file, '-fuzz', '12%', '-transparent', matte.hex, file]);
    }
    despill(file, matte.kind);
  }
  return Boolean(matte);
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
  // Manifest batch (issue #10 comment 5740271262)
  ['waterfall-splash-src.png', 'waterfall-splash.png', 512, 512],
  ['rock-deflector-src.png', 'rock-deflector.png', 512, 512],
  ['bridge-wooden-broken-src.png', 'bridge-wooden-broken.png', 512, 256],
  ['cliff-scaffolding-src.png', 'cliff-scaffolding.png', 512, 512],
  // Wall / rock cutout kit: canyon-wall columns and tunnel & arch framers
  ['wall-granite-strata-src.png', 'wall-granite-strata.png', 512, 1024],
  ['wall-slate-wet-src.png', 'wall-slate-wet.png', 512, 1024],
  ['wall-timber-braced-src.png', 'wall-timber-braced.png', 512, 1024],
  ['tunnel-mouth-stone-src.png', 'tunnel-mouth-stone.png', 512, 512],
  ['tunnel-mouth-timber-src.png', 'tunnel-mouth-timber.png', 512, 512],
  ['rock-arch-wide-src.png', 'rock-arch-wide.png', 1024, 384],
  // Goblin rock platforms (cheering-crowd variants)
  ['rock-platform-deck-src.png', 'rock-platform-deck.png', 512, 512],
  ['rock-platform-spire-src.png', 'rock-platform-spire.png', 512, 1024],
  ['rock-platform-springboard-src.png', 'rock-platform-springboard.png', 512, 512],
  ['rock-platform-drums-src.png', 'rock-platform-drums.png', 512, 512],
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
