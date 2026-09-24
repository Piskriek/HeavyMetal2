#!/usr/bin/env node
/**
 * Cuts the M01 cockpit art (`art-src/cockpit/*-src.png`) into the runtime PNGs the first-person
 * HUD will load, and measures the geometry the HUD needs into `src/game/cockpit-art.json`.
 *
 * This is the cockpit-facing sibling of `build-art.mjs` and `cut-ui-art.mjs`: the same matte rules
 * (magenta `#FF00FF` detected on the border, fuzz-keyed in two passes, fringe-only despill that
 * clamps only the matte's own channels), plus the extra *edge colour bleed* pass those two need
 * for `npm run check:edges` to stay green: every transparent pixel within 5px of the silhouette
 * takes the nearest opaque colour, so scaling the sprite cannot drag magenta into the edge.
 *
 * Everything the HUD must know is *measured* off the finished pixels — never guessed and never
 * carried in a prompt:
 *
 *   - the bezel's magenta opening, re-mapped onto the frozen D3 aperture (x 7–93 %, y 6–62 %,
 *     radius 9 % of height) so the CSS mask and the painted frame line up by construction;
 *   - the yoke's rotation pivot, from the horizontal band with the widest row coverage (the T-bar);
 *   - the goblin arm's grip, from the centroid of its topmost rows;
 *   - the two dial faces' circles, from a radial profile;
 *   - the starter goblin's frames, by finding the panels between the goblin-free gutter columns.
 *
 * Usage: node scripts/cut-cockpit-art.mjs
 * Requires ImageMagick 6 (`convert`, `identify`) on PATH, exactly like the sprite pipelines.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const srcDir = join(root, 'art-src/cockpit');
const outDir = join(root, 'public/art/cockpit');
const tempDir = join(root, 'tmp-art');
mkdirSync(outDir, { recursive: true });
mkdirSync(tempDir, { recursive: true });

const src = (name) => join(srcDir, `${name}-src.png`);
const out = (name) => join(outDir, `${name}.png`);
const run = (args) => execFileSync('convert', args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 29 });
const identify = (args) => execFileSync('identify', args, { encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
const size = (file) => identify(['-format', '%wx%h', file]).split('x').map(Number);
const wall = (file) => identify([file]);
let step = 0;
const temp = (tag) => join(tempDir, `cockpit-${tag}-${step++}.png`);
const log = (label, file) => console.log(`  ${label.padEnd(22)} ${file.replace(join(root, 'public/'), '')}  ${size(file).join('x')}`);

/* ---------------------------------------------------------------------------------------------
   1. PIXEL ACCESS — for measurement only. Every write goes through ImageMagick.
   ------------------------------------------------------------------------------------------ */

/** Decoded RGBA of a PNG, straight out of `convert ... rgba:-`. */
function rgba(file) {
  const [w, h] = size(file);
  const data = run([file, '-depth', '8', 'rgba:-']);
  return { w, h, data };
}

const MAGENTA = (r, g, b) => r > 150 && b > 150 && g < 110;

/** Axis-aligned bounding box of the pixels a predicate accepts (half-open, in pixels). */
function bboxWhere(image, predicate) {
  const { w, h, data } = image;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1; let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!predicate(data[i], data[i + 1], data[i + 2], data[i + 3], x, y)) continue;
      count += 1;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return count ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, count } : null;
}

const opaqueBBox = (file) => bboxWhere(rgba(file), (_r, _g, _b, a) => a > 8);

/** Composite `file` onto a transparent canvas of `w`x`h` with its top-left at (x, y). */
function placeOnCanvas(file, w, h, x, y, target) {
  run(['-size', `${w}x${h}`, 'xc:none', '(', file, ')', '-gravity', 'northwest', '-geometry', xy(x, y), '-composite', target]);
  return target;
}

/** ImageMagick offsets are signed without a space: `-166-120`, never `+-166+-120`. */
const xy = (x, y) => `${x < 0 ? x : `+${x}`}${y < 0 ? y : `+${y}`}`;

/* ---------------------------------------------------------------------------------------------
   2. KEYING — the shared matte rules, plus the edge colour bleed.
   ------------------------------------------------------------------------------------------ */

/** Most frequent quantised border colour carrying the magenta signature (`null` if already keyed). */
function matteOf(file) {
  const [width, height] = size(file);
  const strips = [`2x${height}+0+0`, `2x${height}+${width - 2}+0`, `${width}x2+0+0`, `${width}x2+0+${height - 2}`];
  const counts = new Map();
  for (const strip of strips) {
    const text = execFileSync('convert', [file, '-crop', strip, '+repage', 'txt:-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    for (const line of text.split('\n')) {
      const at = line.indexOf(':');
      if (at < 0) continue;
      const [r, g, b] = (line.slice(at + 1).match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      if (![r, g, b].every(Number.isFinite) || !MAGENTA(r, g, b)) continue;
      const key = [r, g, b].map((v) => Math.round(v / 8) * 8).join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  if (!counts.size) return null;
  const [r, g, b] = [...counts.entries()].sort((a, c) => c[1] - a[1])[0][0].split(',').map(Number);
  return `#${[r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('')}`;
}

/** Clamp only the matte's own channels (R, B) on the anti-aliased fringe; interiors untouched. */
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
  const rebuilt = {};
  for (const [name, others] of [['R', ['G', 'B']], ['B', ['G', 'R']]]) {
    const ceiling = temp('ceiling');
    run([channels[others[0]], channels[others[1]], '-compose', 'Lighten', '-composite', ceiling]);
    const clamped = temp('clamped');
    run([channels[name], ceiling, '-compose', 'Darken', '-composite', clamped]);
    const kept = temp('kept');
    run([channels[name], interior, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', kept]);
    const merged = temp('merged');
    run([clamped, kept, '-compose', 'Over', '-composite', merged]);
    rebuilt[name] = merged;
  }
  const rgb = temp('rgb');
  run([rebuilt.R, channels.G, rebuilt.B, '-combine', '-alpha', 'off', rgb]);
  const result = temp('despilled');
  run([rgb, alpha, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', result]);
  run([result, file]);
}

/**
 * Every transparent pixel within `radius` steps of the silhouette takes the colour of the nearest
 * visible pixel (a multi-source BFS over the alpha mask).
 *
 * Two reasons. A browser scaling a PNG samples *transparent* pixels with bilinear filtering, so an
 * edge whose transparent neighbours are black or magenta darkens or pinks on screen; and
 * `npm run check:edges` fails any runtime sprite that stores matte RGB under transparency.
 */
function bleedEdges(file, radius = 5) {
  const { w, h, data } = rgba(file);
  const pixels = w * h;
  const seen = new Uint8Array(pixels);
  let frontier = [];
  for (let p = 0; p < pixels; p++) {
    if (data[p * 4 + 3] > 8) { seen[p] = 1; frontier.push(p); }
  }
  for (let step = 0; step < radius && frontier.length; step++) {
    const next = [];
    for (const p of frontier) {
      const x = p % w; const y = (p - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (seen[q]) continue;
        seen[q] = 1;
        data[q * 4] = data[p * 4]; data[q * 4 + 1] = data[p * 4 + 1]; data[q * 4 + 2] = data[p * 4 + 2];
        next.push(q);
      }
    }
    frontier = next;
  }
  execFileSync('convert', ['-size', `${w}x${h}`, '-depth', '8', 'rgba:-', file], { input: Buffer.from(data) });
}

/** Key the border matte (when present) and always clean the fringe. */
function keyOut(file) {
  const hex = matteOf(file);
  if (hex) {
    run([file, '-fuzz', '18%', '-transparent', hex, file]);
    run([file, '-fuzz', '34%', '-transparent', hex, file]);
  }
  despill(file);
  bleedEdges(file);
  return Boolean(hex);
}

/** Matte-backed, keyed, despilled and bled; trimmed to its silhouette. */
function cutout(name) {
  const file = src(name);
  const keyed = keyOut(file);
  if (!keyed) console.log(`  ! ${name}: no magenta border found — assumed already transparent`);
  const trimmed = temp(`${name}-trim`);
  run([file, '-trim', '+repage', trimmed]);
  return trimmed;
}

/* ---------------------------------------------------------------------------------------------
   3. THE BEZEL — the aperture is re-mapped onto the frozen D3 rectangle.
   ------------------------------------------------------------------------------------------ */

const APERTURE = { x: 0.07, y: 0.06, w: 0.86, h: 0.56, radiusOfHeight: 0.09 };
const BEZEL_OUT = { w: 1920, h: 1080 };

function cutBezel() {
  const file = src('cockpit-bezel');
  keyOut(file);
  const shot = rgba(file);
  const hole = bboxWhere(shot, (_r, _g, _b, a) => a < 8);
  if (!hole) throw new Error('bezel: keying left no transparent aperture');
  const [w, h] = [shot.w, shot.h];
  const target = {
    x: Math.round(APERTURE.x * BEZEL_OUT.w),
    y: Math.round(APERTURE.y * BEZEL_OUT.h),
    w: Math.round(APERTURE.w * BEZEL_OUT.w),
    h: Math.round(APERTURE.h * BEZEL_OUT.h),
  };
  // The painted frame is warped so its own opening *is* the frozen rectangle: then the CSS mask
  // (same numbers) cannot drift from the art, whatever the generator drew.
  const scaleX = target.w / hole.w;
  const scaleY = target.h / hole.h;
  const newW = Math.round(w * scaleX);
  const newH = Math.round(h * scaleY);
  const offsetX = target.x - Math.round(hole.x * scaleX);
  const offsetY = target.y - Math.round(hole.y * scaleY);
  const scaled = temp('bezel-scaled');
  run([file, '-resize', `${newW}x${newH}!`, scaled]);
  placeOnCanvas(scaled, BEZEL_OUT.w, BEZEL_OUT.h, offsetX, offsetY, out('cockpit-bezel'));
  log('cockpit bezel', out('cockpit-bezel'));
  const check = rgba(out('cockpit-bezel'));
  const after = bboxWhere(check, (_r, _g, _b, a) => a < 8);
  // The whole point of the warp: the painted opening must BE the frozen rectangle. Assert it.
  if (!after || Math.abs(after.x - target.x) > 2 || Math.abs(after.y - target.y) > 2
    || Math.abs(after.w - target.w) > 2 || Math.abs(after.h - target.h) > 2) {
    throw new Error(`bezel: aperture landed at ${JSON.stringify(after)}, expected ${JSON.stringify(target)}`);
  }
  return {
    file: 'art/cockpit/cockpit-bezel.png', ...BEZEL_OUT,
    aperture: { ...target, radius: Math.round(APERTURE.radiusOfHeight * BEZEL_OUT.h) },
    measured: { x: after.x, y: after.y, w: after.w, h: after.h, warp: { scaleX: +scaleX.toFixed(4), scaleY: +scaleY.toFixed(4) } },
  };
}

/* ---------------------------------------------------------------------------------------------
   4. THE YOKE — pivot measured from the widest horizontal band (the T-bar).
   ------------------------------------------------------------------------------------------ */

const YOKE_OUT = { w: 1152, h: 1024 };

function cutYoke() {
  const trimmed = cutout('yoke');
  const shot = rgba(trimmed);
  const rows = new Array(shot.h).fill(0);
  for (let y = 0; y < shot.h; y++) {
    for (let x = 0; x < shot.w; x++) if (shot.data[(y * shot.w + x) * 4 + 3] > 8) rows[y] += 1;
  }
  const peak = Math.max(...rows);
  const band = rows.map((v, y) => [v, y]).filter(([v]) => v >= peak * 0.8);
  const pivotY = band.reduce((sum, [, y]) => sum + y, 0) / band.length;
  // The T-bar is symmetric about the hub, so the band's own x-centroid is the hub.
  let sumX = 0; let count = 0;
  for (let y = Math.max(0, Math.floor(pivotY - 2)); y <= Math.min(shot.h - 1, Math.ceil(pivotY + 2)); y++) {
    for (let x = 0; x < shot.w; x++) if (shot.data[(y * shot.w + x) * 4 + 3] > 8) { sumX += x; count += 1; }
  }
  const pivotX = count ? sumX / count : shot.w / 2;
  // Scale so the whole yoke spans 1000px wide, then place the pivot at the canvas centre: the CSS
  // rotation is then a plain `rotate()` about the image centre, with no pivot bookkeeping.
  const scale = 1000 / shot.w;
  const scaledW = Math.round(shot.w * scale);
  const scaledH = Math.round(shot.h * scale);
  const scaled = temp('yoke-scaled');
  run([trimmed, '-resize', `${scaledW}x${scaledH}`, scaled]);
  const x = Math.round(YOKE_OUT.w / 2 - pivotX * scale);
  const y = Math.round(YOKE_OUT.h / 2 - pivotY * scale);
  placeOnCanvas(scaled, YOKE_OUT.w, YOKE_OUT.h, x, y, out('cockpit-yoke'));
  log('yoke', out('cockpit-yoke'));
  // Re-measure the finished sprite: the T-bar band has to sit on the canvas centre, because that is
  // the point the HUD rotates about.
  const placed = rgba(out('cockpit-yoke'));
  const placedRows = new Array(YOKE_OUT.h).fill(0);
  for (let py = 0; py < YOKE_OUT.h; py++) {
    for (let px = 0; px < YOKE_OUT.w; px++) if (placed.data[(py * YOKE_OUT.w + px) * 4 + 3] > 8) placedRows[py] += 1;
  }
  const placedPeak = Math.max(...placedRows);
  const placedBand = placedRows.map((v, py) => [v, py]).filter(([v]) => v >= placedPeak * 0.8);
  const placedY = placedBand.reduce((sum, [, py]) => sum + py, 0) / placedBand.length;
  if (Math.abs(placedY - YOKE_OUT.h / 2) > 6) throw new Error(`yoke: bar landed at y=${placedY.toFixed(1)}, expected ${YOKE_OUT.h / 2}`);
  return {
    file: 'art/cockpit/cockpit-yoke.png', ...YOKE_OUT,
    pivot: { x: YOKE_OUT.w / 2, y: YOKE_OUT.h / 2 },
    spanWidth: scaledW,
    gripLead: { x: Math.round(pivotX * scale), y: Math.round(pivotY * scale) },
  };
}

/* ---------------------------------------------------------------------------------------------
   5. THE ARM — the grip is the centroid of the topmost rows.
   ------------------------------------------------------------------------------------------ */

const ARM_OUT = { w: 1024, h: 1280 };
/** Where the hand sits inside the finished sprite (the HUD anchors the arm by this point). */
const ARM_GRIP = { x: 0, y: 60 };
/** The arm must reach this share of the sprite's height, so it can never float above the screen edge. */
const ARM_REACH = 0.96;

function cutArm() {
  const trimmed = cutout('goblin-arm');
  const shot = rgba(trimmed);
  const box = bboxWhere(shot, (_r, _g, _b, a) => a > 8);
  if (!box) throw new Error('arm: the keyed sprite is empty');
  // The fist is the top of the arm: its centroid over the first few rows of paint is the grip.
  const fistRows = Math.max(2, Math.round(box.h * 0.06));
  let sumX = 0; let count = 0;
  for (let y = box.y; y < box.y + fistRows; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (shot.data[(y * shot.w + x) * 4 + 3] <= 8) continue;
      sumX += x; count += 1;
    }
  }
  const gripX = count ? sumX / count : box.x + box.w / 2;
  const gripY = box.y;
  // Two constraints, no cropping: the arm reaches ARM_REACH of the canvas height below the grip,
  // and it still fits the canvas width.
  const scale = Math.min(
    (ARM_OUT.h * ARM_REACH - ARM_GRIP.y) / (box.h - (gripY - box.y)),
    ARM_OUT.w / box.w,
  );
  const scaledW = Math.round(box.w * scale);
  const scaledH = Math.round(box.h * scale);
  const scaled = temp('arm-scaled');
  run([trimmed, '-resize', `${scaledW}x${scaledH}`, scaled]);
  const x = Math.round((ARM_OUT.w - scaledW) / 2);
  const y = Math.round(ARM_GRIP.y - (gripY - box.y) * scale);
  placeOnCanvas(scaled, ARM_OUT.w, ARM_OUT.h, x, y, out('cockpit-arm'));
  log('goblin arm', out('cockpit-arm'));
  // Re-measure the finished sprite: the grip is where we promised, and the arm still runs off the
  // bottom (otherwise the HUD would show a floating stump when the shoulders are cropped).
  const placed = rgba(out('cockpit-arm'));
  const rowHasPaint = (row) => {
    for (let px = 0; px < ARM_OUT.w; px++) if (placed.data[(row * ARM_OUT.w + px) * 4 + 3] > 8) return true;
    return false;
  };
  let top = 0;
  while (top < ARM_OUT.h && !rowHasPaint(top)) top += 1;
  if (Math.abs(top - ARM_GRIP.y) > 6) throw new Error(`arm: the fist landed at y=${top}, expected ${ARM_GRIP.y}`);
  const reach = Math.round(ARM_OUT.h * ARM_REACH) - 4; // the resize can drop the final antialiased row
  if (!rowHasPaint(reach)) throw new Error(`arm: the sleeve does not reach y=${reach}; it would float above the screen edge`);
  const grip = { x: x + Math.round(gripX * scale), y: top };
  return {
    file: 'art/cockpit/cockpit-arm.png', ...ARM_OUT,
    grip,
    gripFraction: { x: +(grip.x / ARM_OUT.w).toFixed(4), y: +(grip.y / ARM_OUT.h).toFixed(4) },
    reachFraction: +((reach + 4) / ARM_OUT.h).toFixed(3),
  };
}

/* ---------------------------------------------------------------------------------------------
   6. THE GAUGE CLUSTERS — trimmed to the painted plate, dial discs kept as flat key targets.
   ------------------------------------------------------------------------------------------ */

function cutCluster(name, width) {
  const file = src(name);
  keyOut(file);
  const trimmed = temp(`${name}-trim`);
  const background = identify(['-format', '%[pixel:p{0,0}]', file]);
  // The plate sits on a flat studio background: one trim takes it off without touching the discs.
  run([file, '-bordercolor', background, '-fuzz', '12%', '-trim', '+repage', trimmed]);
  run([trimmed, '-resize', `${width}x`, out(name)]);
  log(name, out(name));
  const discs = bboxWhere(rgba(out(name)), (r, g, b, a) => a > 200 && MAGENTA(r, g, b));
  const [ow, oh] = size(out(name));
  return { file: `art/cockpit/${name}.png`, w: ow, h: oh, keyedDiscPixels: discs?.count ?? 0 };
}

/* ---------------------------------------------------------------------------------------------
   7. THE DIAL FACES — measured from the radial profile of the painted circle.
   ------------------------------------------------------------------------------------------ */

function cutDial(name, pixels, threshold) {
  const file = src(name);
  const [w, h] = size(file);
  const shot = rgba(file);
  const cx = (w - 1) / 2; const cy = (h - 1) / 2;
  const luma = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    const i = (Math.round(y) * w + Math.round(x)) * 4;
    return 0.299 * shot.data[i] + 0.587 * shot.data[i + 1] + 0.114 * shot.data[i + 2];
  };
  // Walk out along 72 rays; the dial ends where the painted ring gives way to the flat surround.
  let sum = 0; let rays = 0;
  for (let a = 0; a < 72; a++) {
    const angle = (a / 72) * Math.PI * 2;
    const dx = Math.cos(angle); const dy = Math.sin(angle);
    let last = 0;
    for (let r = Math.floor(Math.min(w, h) * 0.30); r < Math.min(w, h) * 0.55; r++) {
      const value = luma(cx + dx * r, cy + dy * r);
      if (value >= threshold) last = r;
    }
    if (last) { sum += last; rays += 1; }
  }
  const radius = rays ? sum / rays : Math.min(w, h) * 0.5;
  const box = Math.round(radius * 2);
  const cropped = temp(`${name}-circle`);
  run([file, '-gravity', 'center', '-crop', `${box}x${box}+0+0`, '+repage', cropped]);
  const mask = temp(`${name}-mask`);
  run(['-size', `${box}x${box}`, 'xc:none', '-fill', 'white', '-draw', `circle ${box / 2},${box / 2} ${box / 2},1`, mask]);
  const round = temp(`${name}-round`);
  run([cropped, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', round]);
  run([round, '-resize', `${pixels}x${pixels}`, out(name)]);
  log(name, out(name));
  return { file: `art/cockpit/${name}.png`, w: pixels, h: pixels, sourceRadius: +radius.toFixed(1) };
}

/* ---------------------------------------------------------------------------------------------
   8. THE STARTER GOBLIN — 4 frames salvaged out of the generator's 3x2 answer.
   ------------------------------------------------------------------------------------------ */

/**
 * The generator answered the "4 panels" prompt with 3 columns x 2 rows. The panels are separated
 * by goblin-free magenta, so the columns/rows are found by their *content*, not by their colour:
 * a gutter is a run of columns (or rows) with no opaque pixel at all.
 */
function findPanels(file) {
  const shot = rgba(file);
  const columns = new Array(shot.w).fill(0);
  const rows = new Array(shot.h).fill(0);
  for (let y = 0; y < shot.h; y++) {
    for (let x = 0; x < shot.w; x++) {
      // The raw sheet is opaque everywhere, so "content" means "not the key colour", not "alpha".
      const i = (y * shot.w + x) * 4;
      if (shot.data[i + 3] <= 8 || MAGENTA(shot.data[i], shot.data[i + 1], shot.data[i + 2])) continue;
      columns[x] += 1; rows[y] += 1;
    }
  }
  const runs = (profile, minLength) => {
    const found = []; let start = -1;
    for (let i = 0; i <= profile.length; i++) {
      const busy = i < profile.length && profile[i] > 0;
      if (busy && start < 0) start = i;
      if (!busy && start >= 0) { if (i - start >= minLength) found.push([start, i - 1]); start = -1; }
    }
    return found;
  };
  const minRun = Math.round(Math.min(shot.w, shot.h) * 0.12);
  return { shot, columns: runs(columns, minRun), rows: runs(rows, minRun) };
}

function cutStarterSheet(picks) {
  const source = src('starter-goblin-push');
  const { shot, columns, rows } = findPanels(source);
  if (columns.length < 3 || rows.length < 2) throw new Error(`starter sheet: found ${columns.length}x${rows.length} panels, expected a 3x2 grid`);
  const grid = rows.map(([y0, y1]) => columns.map(([x0, x1]) => ({ x0, y0, x1, y1 })));
  const chosen = picks.map(([row, column]) => {
    const cell = grid[Math.min(row, grid.length - 1)][Math.min(column, columns.length - 1)];
    if (!cell) throw new Error(`starter sheet: no panel at row ${row}, column ${column}`);
    return cell;
  });
  // Per frame: crop, key, trim. The panels came back at two different sizes (the generator drew the
  // shove poses on wider canvases), so each frame is normalised to a common painted height and the
  // feet share one baseline — otherwise the goblin pops in scale and bobs between frames.
  const frames = chosen.map((cell, index) => {
    const cellFile = temp(`starter-cell${index}`);
    run([source, '-crop', `${cell.x1 - cell.x0 + 1}x${cell.y1 - cell.y0 + 1}+${cell.x0}+${cell.y0}`, '+repage', cellFile]);
    keyOut(cellFile);
    const trimmed = temp(`starter-trim${index}`);
    run([cellFile, '-trim', '+repage', trimmed]);
    return { file: trimmed, box: opaqueBBox(trimmed) };
  });
  if (frames.some((frame) => !frame.box)) throw new Error('starter sheet: a chosen panel keyed to nothing');
  const heights = frames.map((frame) => frame.box.h).sort((a, b) => a - b);
  const reference = heights[Math.floor(heights.length / 2)];
  const cellSide = 512;
  const inner = cellSide - 28;
  const scales = frames.map((frame) => Math.min(reference / frame.box.h, inner / frame.box.w, inner / frame.box.h));
  const cells = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const args = ['-size', `${cellSide * 2}x${cellSide * 2}`, 'xc:none'];
  frames.forEach((frame, index) => {
    const scale = scales[index];
    const scaledW = Math.max(1, Math.round(frame.box.w * scale));
    const scaledH = Math.max(1, Math.round(frame.box.h * scale));
    const scaled = temp(`starter-scaled${index}`);
    run([frame.file, '-resize', `${scaledW}x${scaledH}`, scaled]);
    const [column, row] = cells[index];
    const x = column * cellSide + Math.round((cellSide - scaledW) / 2);
    const y = row * cellSide + (cellSide - 14) - scaledH;
    args.push('(', scaled, ')', '-gravity', 'northwest', '-geometry', xy(x, y), '-composite');
  });
  const sheet = temp('starter-sheet');
  args.push('-strip', sheet);
  run(args);
  run([sheet, out('starter-goblin-push')]);
  log('starter goblin', out('starter-goblin-push'));
  return {
    file: 'art/cockpit/starter-goblin-push.png', sheet: cellSide * 2, cell: cellSide,
    columns: columns.length, rows: rows.length,
    picks, scale: scales.map((value) => +value.toFixed(3)),
    panels: chosen.map((cell) => ({ x: cell.x0, y: cell.y0, w: cell.x1 - cell.x0 + 1, h: cell.y1 - cell.y0 + 1 })),
  };
}

/* ---------------------------------------------------------------------------------------------
   9. THE LOWER-DASH RIVET STRIP — one band, mirrored into a seamless tile.
   ------------------------------------------------------------------------------------------ */

const STRIP_OUT = { w: 2048, h: 160 };

function cutRivetStrip() {
  const file = src('cockpit-rivet-strip');
  const background = identify(['-format', '%[pixel:p{0,0}]', file]);
  const trimmed = temp('strip-trim');
  run([file, '-bordercolor', background, '-fuzz', '14%', '-trim', '+repage', trimmed]);
  // The generator painted two stacked rails; keep the upper one and nothing else. The rails are
  // found by their own paint runs, so a change in the painted height cannot smuggle background in.
  const shot = rgba(trimmed);
  const rows = new Array(shot.h).fill(0);
  for (let y = 0; y < shot.h; y++) {
    for (let x = 0; x < shot.w; x++) if (shot.data[(y * shot.w + x) * 4 + 3] > 8) rows[y] += 1;
  }
  const runs = [];
  let start = -1;
  for (let y = 0; y <= shot.h; y++) {
    const busy = y < shot.h && rows[y] > shot.w * 0.5;
    if (busy && start < 0) start = y;
    if (!busy && start >= 0) { if (y - start > shot.h * 0.08) runs.push([start, y - 1]); start = -1; }
  }
  if (!runs.length) throw new Error('rivet strip: no rail band found');
  const [y0, y1] = runs[0];
  const band = temp('strip-band');
  run([trimmed, '-crop', `${shot.w}x${y1 - y0 + 1}+0+${y0}`, '+repage', band]);
  const [bw, bh] = size(band);
  // Mirror a slice so the tile is seamless by construction (a flipped edge matches itself).
  const slice = Math.round(bw / 4);
  const left = temp('strip-left');
  run([band, '-gravity', 'west', '-crop', `${slice}x${bh}+0+0`, '+repage', left]);
  const right = temp('strip-right');
  run([left, '-flop', right]);
  const pair = temp('strip-pair');
  run([left, right, '+append', pair]);
  const tiled = temp('strip-tiled');
  run([pair, pair, '+append', tiled]);
  run([tiled, '-resize', `${STRIP_OUT.w}x${STRIP_OUT.h}!`, out('cockpit-rivet-strip')]);
  log('rivet strip', out('cockpit-rivet-strip'));
  return { file: 'art/cockpit/cockpit-rivet-strip.png', ...STRIP_OUT, seamlessByMirror: true, rails: runs.length, bandHeight: bh };
}

/* ---------------------------------------------------------------------------------------------
   10. RUN
   ------------------------------------------------------------------------------------------ */

console.log('Cockpit art → public/art/cockpit/');
const manifest = {
  generatedAt: new Date().toISOString().slice(0, 10),
  tool: 'scripts/cut-cockpit-art.mjs',
  /** Frozen from M01 decision D3; the bezel is warped onto exactly this rectangle. */
  aperture: APERTURE,
  bezel: cutBezel(),
  yoke: cutYoke(),
  arm: cutArm(),
  clusters: [cutCluster('gauge-cluster-left', 1024), cutCluster('gauge-cluster-right', 1024)],
  dials: [cutDial('gauge-face-speed', 512, 90), cutDial('gauge-face-small', 256, 90)],
  // (row, column) into the generator's 3x2 answer: crouch, shout, hard shove, recover.
  starter: cutStarterSheet([[0, 1], [0, 2], [1, 0], [1, 1]]),
  rivetStrip: cutRivetStrip(),
};

const manifestPath = join(root, 'src/game/cockpit-art.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nMeasured manifest → src/game/cockpit-art.json`);
console.log(`  aperture in the finished bezel: ${JSON.stringify(manifest.bezel.measured)}`);
console.log(`  starter frames used (row, column): ${JSON.stringify(manifest.starter.picks)} of ${manifest.starter.columns}x${manifest.starter.rows}`);
console.log(readFileSync(manifestPath, 'utf8').split('\n').slice(0, 3).join('\n'));
