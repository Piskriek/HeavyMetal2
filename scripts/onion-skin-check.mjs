#!/usr/bin/env node
/**
 * Onion-skin alignment check for the animated sheets.
 *
 * The union-bbox crop makes the four frames the same SIZE, but that alone does
 * not stop a sprite looking like it "jumps": if the animated element is drawn
 * much larger in one panel than the others, the subject appears to grow and
 * shrink as the loop plays, and if the body sits at a different offset the
 * whole subject slides. Both are invisible to a plain frame-delta check.
 *
 * This script measures the two things that actually cause the jump and, for
 * every sheet, writes an onion-skin overlay to art-src/animated/onion/<name>.png
 * — all four frames stacked on top of each other, so misalignment and a
 * popping element are obvious at a glance.
 *
 * Metrics per sheet:
 *   maxShift  largest integer shift (px) that aligns a consecutive frame pair
 *             better than zero shift does. ~0 = the frames are registered.
 *   fillSpread  ratio between the largest and smallest per-frame subject area.
 *             ~1 = the subject keeps one size; >>1 = it pops.
 *
 * Usage: node scripts/onion-skin-check.mjs [name-filter]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const alphaDir = join(root, 'public/art/animated/alpha');
const outDir = join(root, 'art-src/animated/onion');
mkdirSync(outDir, { recursive: true });

const MAX_SHIFT_PX = 6; // above this the frames are not registered
const MIN_SHIFT_GAIN = 0.02; // ...but only if shifting actually helps this much
const MAX_FILL_SPREAD = 1.6; // above this the subject visibly changes size
const SEARCH = 24; // px searched each way when correlating

const magick = (a) => execFileSync('convert', a, { encoding: 'utf8' });
const identify = (a) => execFileSync('identify', a, { encoding: 'utf8' }).trim();
const raw = (f) =>
  execFileSync('convert', [f, '-depth', '8', 'gray:-'], { encoding: 'buffer', maxBuffer: 1 << 28 });

/** Split a keyed 2x2 sheet into its four frames as binary alpha masks. */
function framesOf(file) {
  const [W, H] = identify(['-format', '%w %h', file]).split(' ').map(Number);
  const fw = Math.floor(W / 2);
  const fh = Math.floor(H / 2);
  return { fw, fh, masks: [0, 1, 2, 3].map((i) => {
    const p = join(tmp, `f${i}.png`);
    magick([
      file, '-crop', `${fw}x${fh}+${(i % 2) * fw}+${Math.floor(i / 2) * fh}`, '+repage',
      '-alpha', 'extract', '-threshold', '50%', p,
    ]);
    return Array.from(raw(p));
  }) };
}

/** Largest shift that beats zero-shift overlap for a consecutive pair. */
function bestShift(a, b, w, h) {
  const iou = (dx, dy) => {
    let inter = 0;
    let uni = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const av = a[y * w + x] > 127;
        const y2 = y + dy;
        const x2 = x + dx;
        const bv = y2 >= 0 && y2 < h && x2 >= 0 && x2 < w && b[y2 * w + x2] > 127;
        if (av || bv) {
          uni += 1;
          if (av && bv) inter += 1;
        }
      }
    }
    return uni ? inter / uni : 0;
  };
  const zero = iou(0, 0);
  let best = { dx: 0, dy: 0, iou: zero };
  for (let dy = -SEARCH; dy <= SEARCH; dy += 1) {
    for (let dx = -SEARCH; dx <= SEARCH; dx += 1) {
      if (!dx && !dy) continue;
      const v = iou(dx, dy);
      if (v > best.iou) best = { dx, dy, iou: v };
    }
  }
  return { zero, shift: Math.hypot(best.dx, best.dy), gain: best.iou - zero };
}

const tmp = mkdtempSync(join(tmpdir(), 'onion-'));
const filter = process.argv[2];
let bad = 0;
let checked = 0;

try {
  const files = readdirSync(alphaDir)
    .filter((f) => f.endsWith('.png'))
    .filter((f) => (filter ? f.includes(filter) : true))
    .sort();

  for (const file of files) {
    const name = file.replace('.png', '');
    const path = join(alphaDir, file);
    const { fw, fh, masks } = framesOf(path);

    // per-frame subject area, and the worst registration shift
    const fills = masks.map((m) => m.reduce((a, v) => a + (v > 127 ? 1 : 0), 0) / m.length);
    const spread = Math.max(...fills) / Math.max(Math.min(...fills), 1e-6);
    let maxShift = 0;
    let minGain = Infinity;
    for (let i = 0; i < 4; i += 1) {
      const r = bestShift(masks[i], masks[(i + 1) % 4], fw, fh);
      maxShift = Math.max(maxShift, r.shift);
      minGain = Math.min(minGain, r.gain);
    }

    // onion-skin overlay: frame 1 white, frames 2-4 tinted, so any shift or
    // size pop shows up as coloured fringing around the silhouette.
    const mk = (i, color) => {
      const p = join(tmp, `o${i}.png`);
      magick([
        '-size', `${fw}x${fh}`, 'xc:black',
        '(', path, '-crop', `${fw}x${fh}+${(i % 2) * fw}+${Math.floor(i / 2) * fh}`, '+repage', ')',
        '-compose', 'Over', '-composite',
        '-fill', color, '-colorize', '45', p,
      ]);
      return p;
    };
    const o = [mk(0, '#FFFFFF'), mk(1, '#FF2D55'), mk(2, '#34C759'), mk(3, '#0A84FF')];
    const half = join(tmp, 'h.png');
    magick([o[0], o[1], '-compose', 'Screen', '-composite', half]);
    magick([half, o[2], '-compose', 'Screen', '-composite', half]);
    magick([half, o[3], '-compose', 'Screen', '-composite', join(outDir, `${name}.png`)]);

    const problems = [];
    // A big shift only matters if it genuinely improves the overlap: on a
    // sheet whose element changes shape completely, the correlator can always
    // find some far-off shift that trivially "wins" by a hair.
    if (maxShift > MAX_SHIFT_PX && minGain > MIN_SHIFT_GAIN) {
      problems.push(`UNREGISTERED ${maxShift.toFixed(1)}px (gain ${minGain.toFixed(3)})`);
    }
    if (spread > MAX_FILL_SPREAD) problems.push(`SIZE POP ${spread.toFixed(2)}x`);
    if (problems.length) bad += 1;
    checked += 1;
    console.log(
      `${problems.length ? '✗' : '✓'} ${name.padEnd(30)} maxShift=${maxShift.toFixed(1)}px ` +
      `fillSpread=${spread.toFixed(2)}x gain=${minGain.toFixed(3)} ` +
      `${problems.length ? '  <-- ' + problems.join(', ') : ''}`,
    );
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${checked} sheet(s) checked, ${bad} need attention. Onion-skin overlays: art-src/animated/onion/`);
if (bad > 0) process.exit(1);
