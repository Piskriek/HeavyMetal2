#!/usr/bin/env node
/**
 * QA for generated 4-frame decoration sheets (raw magenta 2x2 spritesheets).
 *
 * Vision-free checks that catch the two failure modes that matter:
 *  1. WRONG LAYOUT — the model drew one big picture instead of four copies in
 *     a 2x2 grid (content then crosses the centre lines and each quadrant is
 *     only a slice of the subject).
 *  2. DEAD ANIMATION — the four frames are near-identical, which is exactly
 *     what the procedural sheets shipped and what players notice.
 *
 * Usage:
 *   node scripts/analyze-animated-sheets.mjs art-src/animated/anim-01-foo-src.png ...
 *   node scripts/analyze-animated-sheets.mjs --all            # every art-src/animated/*-src.png
 *   node scripts/analyze-animated-sheets.mjs --mapping        # use ANIMATED_SOURCE_ART pairs
 *
 * Per sheet it reports:
 *   grid   — % of the centre cross that is pure magenta (100 = clean 2x2 grid)
 *   cover  — % non-magenta pixels per quadrant (even = four full copies)
 *   still  — RMSE of each quadrant against the source still art (low = the
 *            right subject, drawn in the same place)
 *   delta  — RMSE between consecutive frames (high = the animation moves)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const MAGENTA = '#FF00FF';

const magick = (args) => execFileSync('convert', args, { encoding: 'utf8' });
const identify = (args) => execFileSync('identify', args, { encoding: 'utf8' }).trim();
const magentaFraction = (file) =>
  parseFloat(
    magick([
      file, '-fuzz', '12%', '-fill', 'white', '-opaque', MAGENTA,
      '-fill', 'black', '+opaque', 'white', '-format', '%[fx:mean]', 'info:',
    ]).trim(),
  );
const rmse = (a, b) => {
  try {
    return parseFloat(magick([a, b, '-metric', 'RMSE', '-compare', '-format', '%[distortion]', 'info:']).trim());
  } catch {
    const out = magick([a, b, '-metric', 'RMSE', '-compare', '-format', '%[distortion]', 'info:']);
    return parseFloat(String(out).trim());
  }
};

// still art each animated sheet is based on (mirrors ANIMATED_SOURCE_ART)
const SOURCE_ART = {
  'anim-01-torchbearer-flame': 'goblins/alpha/goblin-04-torchbearer.png',
  'anim-02-firework-sparkler': 'goblins/alpha/goblin-18-firework-crew.png',
  'anim-03-torch-crowd': 'goblins/alpha/goblin-24-torch-crowd.png',
  'anim-04-lantern-warden': 'goblins/alpha/goblin-11-lantern-warden.png',
  'anim-05-smelting-crucible': 'props/alpha/prop-04-smelting-crucible.png',
  'anim-06-molten-cauldron': 'props/alpha/prop-07-tripod-cauldron-molten.png',
  'anim-07-slag-channel': 'props/alpha/prop-41-molten-slag-channel.png',
  'anim-08-waterwheel-cascade': 'props/alpha/prop-28-cavern-waterwheel-cascade.png',
  'anim-09-plunge-basin': 'props/alpha/prop-42-waterfall-plunge-basin.png',
  'anim-10-waterfall-curtain': 'track-parts/waterfall-curtain.png',
  'anim-11-tnt-fuse-spark': 'goblins/alpha/goblin-07-tnt-handler.png',
  'anim-12-drum-podium-braziers': 'goblins/alpha/goblin-22-drum-podium-mob.png',
  'anim-13-horn-riser-lantern': 'goblins/alpha/goblin-25-horn-riser.png',
  'anim-14-fan-aisle-torches': 'goblins/alpha/goblin-30-fan-aisle.png',
  'anim-15-triple-lantern-post': 'props/alpha/prop-01-lantern-post-triple.png',
  'anim-16-molten-rock-arch': 'props/alpha/prop-16-molten-rock-natural-arch.png',
  'anim-17-arch-gate-lanterns': 'props/alpha/prop-40-timber-arch-gate-lanterns.png',
  'anim-18-torch-sconce': 'props/alpha/prop-56-arch-torch-sconce.png',
  'anim-19-waterfall-splash': 'track-parts/waterfall-splash.png',
};

const args = process.argv.slice(2);
let files = [];
if (args.includes('--all') || args.includes('--mapping')) {
  const dir = join(root, 'art-src/animated');
  files = readdirSync(dir)
    .filter((f) => f.endsWith('-src.png'))
    .map((f) => join(dir, f))
    .sort();
} else {
  files = args.map((f) => (f.startsWith('/') ? f : join(root, f)));
}
if (files.length === 0) {
  console.error('No sheets given. Usage: node scripts/analyze-animated-sheets.mjs [--all|file ...]');
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'anim-qa-'));
let failures = 0;
try {
  console.log('sheet                            dims        cut%  grid%  cover%(q1..q4)        frame-delta                              verdict');
  for (const file of files) {
    const base = file.split('/').pop().replace(/-src\.png$/, '').replace(/\.png$/, '');
    const [W, H] = identify(['-format', '%w %h', file]).split(' ').map(Number);
    const qw = Math.floor(W / 2);
    const qh = Math.floor(H / 2);

    // Centre cross: 6px band either side of both centre lines (layout hint).
    const vBand = join(tmp, 'vband.png');
    const hBand = join(tmp, 'hband.png');
    magick([file, '-crop', `6x${H}+${qw - 3}+0`, '+repage', vBand]);
    magick([file, '-crop', `${W}x6+0+${qh - 3}`, '+repage', hBand]);
    const gridPct = ((magentaFraction(vBand) + magentaFraction(hBand)) / 2) * 100;

    // Cut lines: the exact 3px the sheet is sliced through. If these are not
    // almost pure magenta, content straddles the cut and the frames are sliced.
    const vCut = join(tmp, 'vcut.png');
    const hCut = join(tmp, 'hcut.png');
    magick([file, '-crop', `3x${H}+${qw - 1}+0`, '+repage', vCut]);
    magick([file, '-crop', `${W}x3+0+${qh - 1}`, '+repage', hCut]);
    const cutPct = Math.min(magentaFraction(vCut), magentaFraction(hCut)) * 100;

    // quadrants (TL, TR, BL, BR = frames 1..4)
    const quads = [];
    const offsets = [[0, 0], [qw, 0], [0, qh], [qw, qh]];
    for (let i = 0; i < 4; i += 1) {
      const q = join(tmp, `q${i}.png`);
      magick([file, '-crop', `${qw}x${qh}+${offsets[i][0]}+${offsets[i][1]}`, '+repage', q]);
      quads.push(q);
    }
    const covers = quads.map((q) => (1 - magentaFraction(q)) * 100);

    // similarity to the still art + frame-to-frame motion
    const stillRel = SOURCE_ART[base];
    let stillRmse = '   n/a     ';
    if (stillRel && existsSync(join(root, 'public/art', stillRel))) {
      const stillPath = join(tmp, 'still.png');
      magick([
        join(root, 'public/art', stillRel),
        '-background', MAGENTA, '-alpha', 'remove', '-alpha', 'off',
        '-resize', `${qw}x${qh}!`, stillPath,
      ]);
      const vals = quads.map((q) => rmse(q, stillPath));
      stillRmse = vals.map((v) => v.toFixed(3)).join(' ');
    }
    const deltas = [];
    for (let i = 1; i < 4; i += 1) deltas.push(rmse(quads[i - 1], quads[i]));
    deltas.push(rmse(quads[3], quads[0]));
    const minDelta = Math.min(...deltas);
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

    const problems = [];
    if (cutPct < 97) problems.push('LAYOUT');
    if (minDelta < 0.045) problems.push('STATIC');
    const coverSpread = Math.max(...covers) - Math.min(...covers);
    if (coverSpread > Math.max(6, Math.max(...covers) * 0.55)) problems.push('COVER');
    if (problems.length) failures += 1;

    console.log(
      `${base.padEnd(32)} ${`${W}x${H}`.padEnd(11)} ${cutPct.toFixed(1).padStart(5)} ${gridPct.toFixed(1).padStart(6)}  ` +
      `${covers.map((c) => c.toFixed(1).padStart(5)).join(' ')}   ` +
      `${deltas.map((d) => d.toFixed(3)).join(' ')} (min ${minDelta.toFixed(3)}, avg ${avgDelta.toFixed(3)})  ` +
      `${problems.length ? '✗ ' + problems.join(',') : '✓ ok'}`,
    );
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${failures === 0 ? 'All sheets pass.' : `${failures} sheet(s) need regenerating.`}`);
process.exit(failures === 0 ? 0 : 1);
