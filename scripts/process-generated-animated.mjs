#!/usr/bin/env node
/**
 * Builds keyed 4-frame sheets from AI-generated spritesheets.
 *
 * Pipeline (per sheet):
 *   1. Detect the panel grid from the magenta gutters (models return 2x2, and
 *      sometimes 4x2 — extra panels are dropped, first four are kept).
 *   2. Shave a few pixels off gutter-adjacent edges so separator lines and
 *      glow bleed never end up inside a frame.
 *   3. Crop every panel to the UNION of their content bounding boxes, so all
 *      four frames share one framing (the body stays put → no loop jitter).
 *   4. Re-compose a clean 2x2 sheet on pure magenta, then run the standard
 *      key pipeline: flood-normalise, 20% fuzz key, 6px unmix-despill.
 *   5. Verify magenta remnant, transparency and — most importantly — that the
 *      frames actually differ (dead frames are the bug these replace).
 *
 * Usage:
 *   node scripts/process-generated-animated.mjs            # all ready sources
 *   node scripts/process-generated-animated.mjs anim-01-torchbearer-flame
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const srcDir = join(root, 'art-src/animated');
const animDir = join(root, 'public/art/animated');
const alphaDir = join(animDir, 'alpha');
mkdirSync(alphaDir, { recursive: true });

const MAGENTA = '#FF00FF';
const KEY_FUZZ = '20%';
const GUTTER_MIN_FRAC = 0.97; // a column/row this magenta counts as gutter
const GUTTER_MIN_PX = 6;
const SHAVE = 4; // px removed from gutter-adjacent panel edges
const MERGE_GAP = 60; // gutter runs closer than this are one gutter
const MIN_FRAME_DELTA = 0.045; // RMSE below this = frames look identical

/** Still artwork each sheet was generated from (aspect + identity reference). */
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
  'anim-20-waterfall-splash-b': 'track-parts/waterfall-splash-b.png',
  'anim-21-flag-waver': 'goblins/alpha/goblin-01-flag-waver.png',
  'anim-22-war-drummer': 'goblins/alpha/goblin-02-war-drummer.png',
  'anim-23-pit-mechanic': 'goblins/alpha/goblin-03-pit-mechanic.png',
  'anim-24-ore-miner': 'goblins/alpha/goblin-05-ore-miner.png',
  'anim-25-horn-blower': 'goblins/alpha/goblin-06-horn-blower.png',
  'anim-26-track-marshal': 'goblins/alpha/goblin-08-track-marshal.png',
  'anim-27-blacksmith': 'goblins/alpha/goblin-09-blacksmith.png',
  'anim-28-tankard-celebrant': 'goblins/alpha/goblin-10-tankard-celebrant.png',
  'anim-29-ball-loader': 'goblins/alpha/goblin-12-ball-loader.png',
  'anim-30-bell-ringer': 'goblins/alpha/goblin-13-bell-ringer.png',
  'anim-31-scarf-fan': 'goblins/alpha/goblin-14-scarf-fan.png',
  'anim-32-track-sweeper': 'goblins/alpha/goblin-15-track-sweeper.png',
  'anim-33-rope-heave-trio': 'goblins/alpha/goblin-16-rope-heave-trio.png',
  'anim-34-shoulder-ride-duo': 'goblins/alpha/goblin-17-shoulder-ride-duo.png',
  'anim-35-tire-carry-duo': 'goblins/alpha/goblin-19-tire-carry-duo.png',
  'anim-36-victory-huddle': 'goblins/alpha/goblin-20-victory-huddle.png',
  'anim-37-grandstand-roar': 'goblins/alpha/goblin-21-grandstand-roar.png',
  'anim-38-flag-terrace': 'goblins/alpha/goblin-23-flag-terrace.png',
  'anim-39-mosh-pit': 'goblins/alpha/goblin-26-mosh-pit.png',
  'anim-40-fence-fans': 'goblins/alpha/goblin-27-fence-fans.png',
  'anim-41-cheer-tower': 'goblins/alpha/goblin-28-cheer-tower.png',
  'anim-42-victory-stage': 'goblins/alpha/goblin-29-victory-stage.png',
};

/** Generated sheet -> shipped sheet name (anim-01..10 in this batch). */
const SHEETS = [
  'anim-01-torchbearer-flame',
  'anim-02-firework-sparkler',
  'anim-03-torch-crowd',
  'anim-04-lantern-warden',
  'anim-05-smelting-crucible',
  'anim-06-molten-cauldron',
  'anim-07-slag-channel',
  'anim-08-waterwheel-cascade',
  'anim-09-plunge-basin',
  'anim-10-waterfall-curtain',
  'anim-11-tnt-fuse-spark',
  'anim-12-drum-podium-braziers',
  'anim-13-horn-riser-lantern',
  'anim-14-fan-aisle-torches',
  'anim-15-triple-lantern-post',
  'anim-16-molten-rock-arch',
  'anim-17-arch-gate-lanterns',
  'anim-18-torch-sconce',
  'anim-19-waterfall-splash',
  'anim-20-waterfall-splash-b',
  'anim-21-flag-waver',
  'anim-22-war-drummer',
  'anim-23-pit-mechanic',
  'anim-24-ore-miner',
  'anim-25-horn-blower',
  'anim-26-track-marshal',
  'anim-27-blacksmith',
  'anim-28-tankard-celebrant',
  'anim-29-ball-loader',
  'anim-30-bell-ringer',
  'anim-31-scarf-fan',
  'anim-32-track-sweeper',
  'anim-33-rope-heave-trio',
  'anim-34-shoulder-ride-duo',
  'anim-35-tire-carry-duo',
  'anim-36-victory-huddle',
  'anim-37-grandstand-roar',
  'anim-38-flag-terrace',
  'anim-39-mosh-pit',
  'anim-40-fence-fans',
  'anim-41-cheer-tower',
  'anim-42-victory-stage',
  'anim-43-explosion-fire',
  'anim-44-spark-burst',
  'anim-45-smoke-puff',
  'anim-46-gore-burst',
  'anim-47-gore-green-burst',
  'anim-48-ground-impact',
  'anim-49-dust-puff',
  'anim-50-firework-red',
  'anim-51-firework-blue',
  'anim-52-firework-green',
];

const magick = (args) => execFileSync('convert', args, { encoding: 'utf8' });
const identify = (args) => execFileSync('identify', args, { encoding: 'utf8' }).trim();
const meanOf = (p) => parseFloat(magick([p, '-format', '%[fx:mean]', 'info:']).trim());
const rmse = (a, b) => {
  const out = magick([a, b, '-metric', 'RMSE', '-compare', '-format', '%[distortion]', 'info:']);
  return parseFloat(String(out).trim().replace(/[^\d.eE+-]/g, ''));
};

/** Per-column / per-row magenta fraction via area-averaged resize of the mask. */
function magentaProfile(file, W, H) {
  const maskArgs = [file, '-fuzz', '12%', '-fill', 'white', '-opaque', MAGENTA, '-fill', 'black', '+opaque', 'white', '-colorspace', 'gray'];
  const read = (resize) => {
    const txt = magick([...maskArgs, '-resize', resize, 'txt:-']);
    const out = [];
    for (const line of txt.split('\n')) {
      const m = /^(\d+),(\d+):\s*\(\s*([\d.]+)/.exec(line);
      if (m) out[Number(m[1] === '0' ? m[2] : m[1])] = Number(m[3]) / 255;
    }
    return out;
  };
  // Wx1! averages each column down the height; 1xH! averages each row across.
  const cols = magick([...maskArgs, '-resize', `${W}x1!`, 'txt:-']);
  const colVals = [];
  for (const line of cols.split('\n')) {
    const m = /^(\d+),(\d+):\s*\(\s*([\d.]+)/.exec(line);
    if (m) colVals[Number(m[1])] = Number(m[3]) / 255;
  }
  const rowVals = [];
  const rows = magick([...maskArgs, '-resize', `1x${H}!`, 'txt:-']);
  for (const line of rows.split('\n')) {
    const m = /^(\d+),(\d+):\s*\(\s*([\d.]+)/.exec(line);
    if (m) rowVals[Number(m[2])] = Number(m[3]) / 255;
  }
  return { colVals, rowVals };
}

/**
 * Contiguous runs of near-pure magenta that sit INSIDE the image — these are
 * the gutters between panels. Runs touching the edge are just outer margins
 * (the union-bbox crop trims those later), so they must not split the grid.
 */
function gutters(profile, span) {
  const edge = Math.max(4, Math.round(span * 0.02));
  const raw = [];
  let start = -1;
  for (let i = 0; i <= span; i += 1) {
    const ok = i < span && (profile[i] ?? 0) >= GUTTER_MIN_FRAC;
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      if (i - start >= GUTTER_MIN_PX && start > edge && i - 1 < span - edge) raw.push([start, i - 1]);
      start = -1;
    }
  }
  // A gutter broken by a splash or a chain must not be read as two: merge runs
  // that are separated by less than MERGE_GAP pixels.
  const merged = [];
  for (const run of raw) {
    const last = merged[merged.length - 1];
    if (last && run[0] - last[1] <= MERGE_GAP) last[1] = run[1];
    else merged.push([...run]);
  }
  return merged;
}

/**
 * Choose the cut positions. Models mostly return a 2x2 grid, but sometimes a
 * 4x2 one (eight panels = the four frames drawn twice), so prefer four evenly
 * spaced columns when three vertical gutters line up with W/4, W/2, 3W/4.
 * Anything else falls back to the gutter nearest the centre (2x2).
 */
function pickCuts(vGut, hGut, W, H) {
  const at = (runs, span, k, n, tol) => {
    const g = gutterNear(runs, (span * k) / n, span * tol);
    return g;
  };
  if (vGut.length >= 3) {
    const xs = [1, 2, 3].map((k) => at(vGut, W, k, 4, 0.12));
    if (xs.every((v) => v !== null)) {
      const y = gutterNear(hGut, H / 2, H * 0.25);
      if (y !== null) return { xs, ys: [y] };
    }
  }
  if (hGut.length >= 3) {
    const ys = [1, 2, 3].map((k) => at(hGut, H, k, 4, 0.12));
    if (ys.every((v) => v !== null)) {
      const x = gutterNear(vGut, W / 2, W * 0.25);
      if (x !== null) return { xs: [x], ys };
    }
  }
  const x = gutterNear(vGut, W / 2, W * 0.25) ?? Math.round(W / 2);
  const y = gutterNear(hGut, H / 2, H * 0.25) ?? Math.round(H / 2);
  return { xs: [x], ys: [y] };
}

const gutterNear = (runs, ideal, tol) => {
  let best = null;
  let bestD = Infinity;
  for (const g of runs) {
    const c = (g[0] + g[1]) / 2;
    const d = Math.abs(c - ideal);
    if (d < bestD) { bestD = d; best = g; }
  }
  return bestD <= tol ? Math.round((best[0] + best[1]) / 2) : null;
};

/**
 * Try to place an nCols x nRows grid: every interior boundary must have a
 * detected gutter near its ideal (even) position. Returns the cut positions.
 */
function candidateGrid(nCols, nRows, W, H, vGut, hGut) {
  const xs = [];
  for (let k = 1; k < nCols; k += 1) {
    const x = gutterNear(vGut, (W * k) / nCols, W * 0.15);
    if (x === null) return null;
    xs.push(x);
  }
  const ys = [];
  for (let k = 1; k < nRows; k += 1) {
    const y = gutterNear(hGut, (H * k) / nRows, H * 0.15);
    if (y === null) return null;
    ys.push(y);
  }
  return { xs, ys };
}

/** Panel rectangles for a set of cut positions (shaved away from the gutters). */
function panelsFor(xs, ys, W, H) {
  const xb = [0, ...xs, W];
  const yb = [0, ...ys, H];
  const rects = [];
  for (let r = 0; r < yb.length - 1; r += 1) {
    for (let c = 0; c < xb.length - 1; c += 1) {
      const x0 = Math.max(0, xb[c] + (c > 0 ? SHAVE : 0));
      const x1 = Math.min(W, xb[c + 1] - (c < xb.length - 2 ? SHAVE : 0));
      const y0 = Math.max(0, yb[r] + (r > 0 ? SHAVE : 0));
      const y1 = Math.min(H, yb[r + 1] - (r < yb.length - 2 ? SHAVE : 0));
      if (x1 - x0 > 8 && y1 - y0 > 8) rects.push([x0, y0, x1 - x0, y1 - y0]);
    }
  }
  return rects;
}

const magentaFraction = (file) =>
  parseFloat(
    magick([
      file, '-fuzz', '12%', '-fill', 'white', '-opaque', MAGENTA,
      '-fill', 'black', '+opaque', 'white', '-format', '%[fx:mean]', 'info:',
    ]).trim(),
  );

/** Content mask where the subject is white and the magenta backdrop black. */
function contentMask(src, out) {
  magick([src, '-fuzz', '12%', '-fill', 'black', '-opaque', MAGENTA, '-fill', 'white', '+opaque', 'black', out]);
}

/** Raw 8-bit grayscale bytes of a mask (255 = subject, 0 = backdrop). */
const maskBytes = (file) =>
  execFileSync('convert', [file, '-depth', '8', 'gray:-'], { encoding: 'buffer', maxBuffer: 1 << 28 });

/** Intensity-weighted centroid of a mask; null when the mask is empty. */
function centroidOf(buf, w, h, weight) {
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const v = weight ? Math.min(buf[i], weight[i]) : buf[i];
    if (!v) continue;
    sw += v;
    sx += v * (i % w);
    sy += v * Math.floor(i / w);
  }
  return sw < 1 ? null : { x: sx / sw, y: sy / sw, sw };
}

/**
 * Frame registration — the "onion skin" step.
 *
 * The union-bbox crop alone makes the four frames the same SIZE, but not the
 * same FRAMING: when a flag whips up, the subject's bounding box grows upward
 * and the goblin's body ends up sitting lower inside the frame than in the
 * panel where the flag hangs down. The body therefore slides around as the
 * animation plays, which reads as the frames "jumping".
 *
 * So align the frames on their COMMON SILHOUETTE — the pixels that are opaque
 * in all four frames, which is the static body. Every frame is shifted until
 * that silhouette sits at the same place, so the body holds still and only the
 * animated element (flag, flame, splash, lava) moves.
 *
 * Two passes: a coarse alignment on each frame's own centroid to undo gross
 * offsets, then refinement on the common silhouette. Falls back to the coarse
 * result when no pixel is opaque in every frame (e.g. a splash whose shape
 * changes completely).
 *
 * Mutates `files` in place; returns the total shift applied per frame.
 */
function registerFrames(files, w, h, tmp) {
  const masks = files.map((_, i) => join(tmp, `rg${i}.png`));
  const refresh = () => files.forEach((f, i) => contentMask(f, masks[i]));
  refresh();

  const total = files.map(() => [0, 0]);
  const staged = files.map((f, i) => join(tmp, `rs${i}.png`));

  for (let pass = 0; pass < 3; pass += 1) {
    const bufs = masks.map((m) => Array.from(maskBytes(m)));
    const own = bufs.map((b) => centroidOf(b, w, h));
    if (own.some((c) => !c)) break;

    // Coarse target: the mean of the four centroids.
    const mx = own.reduce((a, c) => a + c.x, 0) / 4;
    const my = own.reduce((a, c) => a + c.y, 0) / 4;

    // Common silhouette = per-pixel minimum across the four frames.
    const common = new Array(bufs[0].length).fill(0);
    for (let k = 0; k < common.length; k += 1) {
      common[k] = Math.min(bufs[0][k], bufs[1][k], bufs[2][k], bufs[3][k]);
    }
    const anchor = centroidOf(common, w, h);
    const target = anchor ?? { x: mx, y: my };

    let moved = 0;
    for (let i = 0; i < 4; i += 1) {
      const weight = anchor ? bufs[i].map((v, k) => Math.min(v, common[k])) : null;
      const c = anchor ? centroidOf(weight, w, h) : own[i];
      if (!c) continue;
      const dx = Math.round(target.x - c.x);
      const dy = Math.round(target.y - c.y);
      if (!dx && !dy) continue;
      moved += 1;
      magick([files[i], '-background', MAGENTA, '-extent', `${w}x${h}+${dx}+${dy}`, staged[i]]);
      magick([staged[i], files[i]]);
      total[i][0] += dx;
      total[i][1] += dy;
    }
    refresh();
    if (!moved) break;
  }

  // Final pass: cross-correlate every frame against frame 1 and keep the shift
  // that maximises silhouette overlap. The centroid pass aligns the body's
  // centre of mass, which is not the same thing as aligning its outline — when
  // the common silhouette is small and off-centre (a cauldron's tripod under a
  // surface that changes completely), the centroid can be spot on while the
  // body around it sits several pixels out.
  {
    const bufs = masks.map((m) => Array.from(maskBytes(m)));
    const ref = bufs[0];
    const overlap = (b, dx, dy) => {
      let inter = 0;
      let uni = 0;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const av = ref[y * w + x] > 127;
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
    for (let i = 1; i < 4; i += 1) {
      let best = { dx: 0, dy: 0, v: overlap(bufs[i], 0, 0) };
      for (let dy = -8; dy <= 8; dy += 1) {
        for (let dx = -8; dx <= 8; dx += 1) {
          if (!dx && !dy) continue;
          const v = overlap(bufs[i], dx, dy);
          if (v > best.v + 1e-4) best = { dx, dy, v };
        }
      }
      if (!best.dx && !best.dy) continue;
      magick([files[i], '-background', MAGENTA, '-extent', `${w}x${h}+${best.dx}+${best.dy}`, staged[i]]);
      magick([staged[i], files[i]]);
      total[i][0] += best.dx;
      total[i][1] += best.dy;
    }
    refresh();
  }
  return total;
}

const filter = process.argv[2];
const tmp = mkdtempSync(join(tmpdir(), 'gen-anim-'));
let failures = 0;
let done = 0;

try {
  for (const name of SHEETS) {
    if (filter && !name.includes(filter)) continue;
    const srcPath = join(srcDir, `${name}-src.png`);
    if (!existsSync(srcPath)) {
      console.log(`-  ${name.padEnd(30)} no source yet (art-src/animated/${name}-src.png)`);
      continue;
    }
    const file = `${name}.png`;
    const rawPath = join(animDir, file);
    const alphaPath = join(alphaDir, file);
    const [W, H] = identify(['-format', '%w %h', srcPath]).split(' ').map(Number);

    // 0. the backdrop must be magenta — a model that paints a cave, a sky or a
    //    white studio background cannot be keyed and has to be regenerated.
    const bgMagenta = magentaFraction(srcPath);
    if (!(bgMagenta > 0.25)) {
      console.log(`✗ ${name.padEnd(30)} backdrop is not magenta (${(bgMagenta * 100).toFixed(1)}%) — regenerate`);
      failures += 1;
      continue;
    }

    // 1. grid from the magenta gutters. Models return 2x2 (ideal) but also
    //    4x2 (eight panels) or a 2x2 split by thin dark lines instead of
    //    magenta, so score the candidates and keep the first that holds four
    //    single-subject frames.
    const { colVals, rowVals } = magentaProfile(srcPath, W, H);
    const vGut = gutters(colVals, W);
    const hGut = gutters(rowVals, H);
    const cuts = pickCuts(vGut, hGut, W, H);
    const rects = panelsFor(cuts.xs, cuts.ys, W, H);
    if (rects.length < 4) {
      console.log(`✗ ${name.padEnd(30)} only ${rects.length} panels detected — regenerate`);
      failures += 1;
      continue;
    }
    const panels = rects.slice(0, 4);
    const colSpans = cuts.xs.length + 1;
    const rowSpans = cuts.ys.length + 1;

    // 2. stage the four panels on one canvas (padded, so registration can
    //    shift them without clipping), then register them on their common
    //    silhouette so the static body holds still across the loop.
    const maxW = Math.max(...panels.map((p) => p[2]));
    const maxH = Math.max(...panels.map((p) => p[3]));
    const PAD = Math.round(Math.max(maxW, maxH) * 0.2);
    const CW = maxW + 2 * PAD;
    const CH = maxH + 2 * PAD;
    const staged = [];
    for (let i = 0; i < 4; i += 1) {
      const [x, y, w, h] = panels[i];
      const s = join(tmp, `s${i}.png`);
      magick([
        '-size', `${CW}x${CH}`, `xc:${MAGENTA}`,
        '(', srcPath, '-crop', `${w}x${h}+${x}+${y}`, '+repage', ')',
        '-gravity', 'center', '-composite', s,
      ]);
      staged.push(s);
    }
    const align = registerFrames(staged, CW, CH, tmp);
    const alignPx = Math.max(...align.map(([dx, dy]) => Math.hypot(dx, dy)));

    // 3. union bounding box over the registered frames so they share one framing
    let ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity;
    for (let i = 0; i < 4; i += 1) {
      const m = join(tmp, `bm${i}.png`);
      contentMask(staged[i], m);
      const [bw, bh, bx, by] = identify(['-format', '%@', m]).split(/[x+]/).map(Number);
      if (bw < 4 || bh < 4) { ux0 = -1; break; }
      ux0 = Math.min(ux0, bx); uy0 = Math.min(uy0, by);
      ux1 = Math.max(ux1, bx + bw); uy1 = Math.max(uy1, by + bh);
    }
    if (!(ux1 > ux0 && uy1 > uy0)) {
      console.log(`✗ ${name.padEnd(30)} empty panel content — regenerate`);
      failures += 1;
      continue;
    }
    let FW = ux1 - ux0;
    let FH = uy1 - uy0;

    // 4. pad the frame to the still artwork's aspect ratio, so swapping a
    //    decoration between still and animated never squashes it.
    const stillRel = SOURCE_ART[name];
    let targetAr = null;
    if (stillRel && existsSync(join(root, 'public/art', stillRel))) {
      const [sw0, sh0] = identify(['-format', '%w %h', join(root, 'public/art', stillRel)]).split(' ').map(Number);
      targetAr = sw0 / sh0;
    }
    if (targetAr) {
      const ar = FW / FH;
      if (ar < targetAr - 0.01) FW = Math.round(FH * targetAr);
      else if (ar > targetAr + 0.01) FH = Math.round(FW / targetAr);
    }
    if (FW % 2) FW += 1;
    if (FH % 2) FH += 1;

    // 5. one crop per frame (identical box, no relative shift), padded to the
    //    padded target size with magenta so the aspect matches the still art.
    const flats = [];
    for (let i = 0; i < 4; i += 1) {
      const f = join(tmp, `f${i}.png`);
      magick([
        staged[i],
        '-crop', `${ux1 - ux0}x${uy1 - uy0}+${ux0}+${uy0}`, '+repage',
        '-background', MAGENTA, '-gravity', 'center', '-extent', `${FW}x${FH}`,
        '-alpha', 'remove', '-alpha', 'off', f,
      ]);
      flats.push(f);
    }

    // 5b. clean 2x2 sheet (TL=f0, TR=f1, BL=f2, BR=f3)
    magick([...flats.slice(0, 2), '+append', join(tmp, 'top.png')]);
    magick([...flats.slice(2, 4), '+append', join(tmp, 'bot.png')]);
    magick([join(tmp, 'top.png'), join(tmp, 'bot.png'), '-append', join(tmp, 'sheet.png')]);
    const [sw, sh] = identify(['-format', '%w %h', join(tmp, 'sheet.png')]).split(' ').map(Number);
    const mx = sw - 1, my = sh - 1, hx = Math.floor(sw / 2), hy = Math.floor(sh / 2);

    magick([
      join(tmp, 'sheet.png'), '-fuzz', '12%', '-fill', MAGENTA,
      '-draw', 'color 0,0 floodfill', '-draw', `color ${mx},0 floodfill`,
      '-draw', `color 0,${my} floodfill`, '-draw', `color ${mx},${my} floodfill`,
      '-draw', `color ${hx},0 floodfill`, '-draw', `color ${hx},${my} floodfill`,
      '-draw', `color 0,${hy} floodfill`, '-draw', `color ${mx},${hy} floodfill`,
      join(tmp, 'norm.png'),
    ]);
    magick([join(tmp, 'norm.png'), '-strip', rawPath]);

    // 5. key + unmix-despill (same recipe as scripts/process-animated.mjs)
    const T = (n) => join(tmp, `${n}.miff`);
    magick([join(tmp, 'norm.png'), '-alpha', 'set', '-fuzz', KEY_FUZZ, '-transparent', MAGENTA, T('keyed')]);
    magick([T('keyed'), '-alpha', 'extract', T('maskA')]);
    magick([
      T('maskA'), '-negate',
      '-morphology', 'Dilate', 'Square:1', '-morphology', 'Dilate', 'Square:1',
      '-morphology', 'Dilate', 'Square:1', '-morphology', 'Dilate', 'Square:1',
      '-morphology', 'Dilate', 'Square:1', '-morphology', 'Dilate', 'Square:1',
      T('dil'),
    ]);
    magick([T('dil'), T('maskA'), '-compose', 'Multiply', '-composite', T('fringe')]);
    magick([T('keyed'), '-channel', 'R', '-separate', T('kR')]);
    magick([T('keyed'), '-channel', 'G', '-separate', T('kG')]);
    magick([T('keyed'), '-channel', 'B', '-separate', T('kB')]);
    magick([T('keyed'), '-alpha', 'extract', T('kA')]);
    magick([T('kG'), T('kR'), '-compose', 'Minus', '-composite', T('kD1')]);
    magick([T('kG'), T('kB'), '-compose', 'Minus', '-composite', T('kD2')]);
    magick([T('kD1'), T('kD2'), '-compose', 'Darken', '-composite', T('kE')]);
    magick([T('kE'), '-negate', T('kC')]);
    magick([T('kE'), T('kR'), '-compose', 'Minus', '-composite', T('kRm')]);
    magick([T('kC'), T('kRm'), '-compose', 'Divide', '-composite', T('kRu')]);
    magick([T('kC'), T('kG'), '-compose', 'Divide', '-composite', T('kGu')]);
    magick([T('kE'), T('kB'), '-compose', 'Minus', '-composite', T('kBm')]);
    magick([T('kC'), T('kBm'), '-compose', 'Divide', '-composite', T('kBu')]);
    magick([T('kA'), T('kC'), '-compose', 'Multiply', '-composite', T('kAu')]);
    magick([T('kRu'), T('kGu'), T('kBu'), '-combine', '-alpha', 'off', T('kuRGB')]);
    magick([T('kuRGB'), T('kAu'), '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', T('kunmix')]);
    magick([T('keyed'), '-alpha', 'off', T('kkRGB')]);
    magick([T('kunmix'), '-alpha', 'off', T('kuRGBflat')]);
    magick([T('kkRGB'), T('kuRGBflat'), T('fringe'), '-composite', T('kfRGB')]);
    magick([T('kA'), T('kAu'), T('fringe'), '-composite', T('kfA')]);
    magick([T('kfRGB'), T('kfA'), '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', '-strip', alphaPath]);

    // 6. verify
    const alphaPixel = magick([alphaPath, '-format', '%[pixel:p{2,2}]', 'info:']).trim();
    magick([alphaPath, '-channel', 'R', '-separate', '+channel', '-threshold', '59%', T('vR')]);
    magick([alphaPath, '-channel', 'B', '-separate', '+channel', '-threshold', '59%', T('vB')]);
    magick([alphaPath, '-channel', 'G', '-separate', '+channel', '-threshold', '43%', '-negate', T('vGlow')]);
    magick([alphaPath, '-alpha', 'extract', '-threshold', '50%', T('vA')]);
    magick([T('vR'), T('vB'), '-compose', 'Multiply', '-composite', T('vGlow'), '-compose', 'Multiply', '-composite', '-negate', T('vNotMag')]);
    magick([T('vNotMag'), T('vA'), '-compose', 'Minus', '-composite', T('vRem')]);
    const remnant = meanOf(T('vRem')) * 100;

    const frames = [];
    for (let i = 0; i < 4; i += 1) {
      const q = join(tmp, `vq${i}.png`);
      magick([alphaPath, '-crop', `${Math.floor(sw / 2)}x${Math.floor(sh / 2)}+${(i % 2) * Math.floor(sw / 2)}+${Math.floor(i / 2) * Math.floor(sh / 2)}`, '+repage', '-background', MAGENTA, '-flatten', q]);
      frames.push(q);
    }
    const deltas = [];
    for (let i = 1; i < 4; i += 1) deltas.push(rmse(frames[i - 1], frames[i]));
    deltas.push(rmse(frames[3], frames[0]));
    const minDelta = Math.min(...deltas);

    // 6b. animation-only delta. Registration aligns the static body, which
    //     legitimately drives the plain delta down — a perfectly registered
    //     sheet differs only where the element animates. So blank the pixels
    //     that are opaque in all four frames (the static body) and compare what
    //     is left, normalised over the element's own area. This is the number
    //     that answers "is it animating", independent of registration quality.
    const qw = Math.floor(sw / 2);
    const qh = Math.floor(sh / 2);
    const rgb = [];
    const alf = [];
    for (let i = 0; i < 4; i += 1) {
      const q = join(tmp, `nq${i}.png`);
      magick([alphaPath, '-crop', `${qw}x${qh}+${(i % 2) * qw}+${Math.floor(i / 2) * qh}`, '+repage',
        '-background', MAGENTA, '-flatten', q]);
      rgb.push(execFileSync('convert', [q, '-depth', '8', 'rgb:-'], { encoding: 'buffer', maxBuffer: 1 << 28 }));
      const a = join(tmp, `na${i}.png`);
      magick([alphaPath, '-crop', `${qw}x${qh}+${(i % 2) * qw}+${Math.floor(i / 2) * qh}`, '+repage', '-alpha', 'extract', a]);
      alf.push(execFileSync('convert', [a, '-depth', '8', 'gray:-'], { encoding: 'buffer', maxBuffer: 1 << 28 }));
    }
    const common = alf[0].map((v, k) => Math.min(v, alf[1][k], alf[2][k], alf[3][k]));
    const eDeltas = [];
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4;
      let sum = 0;
      let n = 0;
      for (let k = 0; k < common.length; k += 1) {
        // "live" = part of the animated element rather than the static body
        if (alf[i][k] <= common[k] + 2 && alf[j][k] <= common[k] + 2) continue;
        n += 1;
        for (let c = 0; c < 3; c += 1) {
          const d = rgb[i][k * 3 + c] - rgb[j][k * 3 + c];
          sum += d * d;
        }
      }
      eDeltas.push(n ? Math.sqrt(sum / (n * 3)) / 255 : 0);
    }
    const minElemDelta = Math.min(...eDeltas);
    const coverage = (1 - meanOf(T('maskA'))) * 100;

    const problems = [];
    if (remnant > 0.5) problems.push(`REMNANT ${remnant.toFixed(3)}%`);
    if (minElemDelta < MIN_FRAME_DELTA) problems.push(`STATIC elem=${minElemDelta.toFixed(3)}`);
    if (!alphaPixel.includes('rgba(0,0,0,0)') && !alphaPixel.includes('(0,0,0,0)')) problems.push(`CORNER ${alphaPixel}`);
    if (problems.length) failures += 1; else done += 1;

    console.log(
      `${problems.length ? '✗' : '✓'} ${name.padEnd(30)} grid=${colSpans}x${rowSpans} ` +
      `frame=${FW}x${FH} cover=${coverage.toFixed(1)}% remnant=${remnant.toFixed(3)}% ` +
      `align=${alignPx.toFixed(1)}px ` +
      `elem=${eDeltas.map((d) => d.toFixed(3)).join('/')} min=${minElemDelta.toFixed(3)} ` +
      `(plain min=${minDelta.toFixed(3)}) ` +
      `${problems.length ? '  <-- ' + problems.join(', ') : ''}`,
    );
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${done} sheet(s) built, ${failures} need attention.`);
if (failures > 0) process.exit(1);
