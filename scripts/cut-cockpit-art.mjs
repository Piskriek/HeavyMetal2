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
  // The two hand grips are the bar's own extremes; step in by a fraction of the span so the anchor
  // lands on the middle of each grip rather than on its outer tip (or on a lever sticking out).
  const bandRow = Math.round(placedY);
  let minX = YOKE_OUT.w; let maxX = -1;
  for (let py = bandRow - 6; py <= bandRow + 6; py++) {
    for (let px = 0; px < YOKE_OUT.w; px++) {
      if (placed.data[(py * YOKE_OUT.w + px) * 4 + 3] <= 8) continue;
      if (px < minX) minX = px; if (px > maxX) maxX = px;
    }
  }
  const span = maxX - minX;
  const inset = Math.round(span * 0.075);
  const grips = {
    left: { x: minX + inset, y: bandRow },
    right: { x: maxX - inset, y: bandRow },
  };
  return {
    file: 'art/cockpit/cockpit-yoke.png', ...YOKE_OUT,
    pivot: { x: YOKE_OUT.w / 2, y: YOKE_OUT.h / 2 },
    spanWidth: scaledW,
    grips,
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
  // How much of the sprite canvas the painted limb actually covers. The HUD sizes the arm from
  // this, not from the canvas: the generator's canvas has generous magenta margins, so using the
  // canvas would draw a doll-sized arm in the cockpit.
  const paint = bboxWhere(placed, (_r, _g, _b, a) => a > 8) ?? { x: 0, y: 0, w: ARM_OUT.w, h: ARM_OUT.h };
  return {
    file: 'art/cockpit/cockpit-arm.png', ...ARM_OUT,
    grip,
    gripFraction: { x: +(grip.x / ARM_OUT.w).toFixed(4), y: +(grip.y / ARM_OUT.h).toFixed(4) },
    reachFraction: +((reach + 4) / ARM_OUT.h).toFixed(3),
    paint: {
      x: paint.x, y: paint.y, w: paint.w, h: paint.h,
      widthFraction: +(paint.w / ARM_OUT.w).toFixed(4),
      heightFraction: +(paint.h / ARM_OUT.h).toFixed(4),
    },
  };
}

/* ---------------------------------------------------------------------------------------------
   6. THE GAUGE CLUSTERS — trimmed to the painted plate, dial discs kept as flat key targets.
   ------------------------------------------------------------------------------------------ */

/**
 * Enclosed transparent regions — the dial holes the generator left in a plate.
 *
 * Flood-filled from the border, so anything transparent that the flood cannot reach is a hole *inside*
 * the plate. Returns each hole's centre and radius in finished-sprite pixels: the HUD puts a dial
 * face and a needle there, and never has to guess where the painted bezel ring is.
 */
function holesIn(file) {
  const { w, h, data } = rgba(file);
  const transparent = (p) => data[p * 4 + 3] < 8;
  const outside = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    if (outside[p] || !transparent(p)) continue;
    outside[p] = 1;
    const x = p % w; const y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  const seen = new Uint8Array(w * h);
  const holes = [];
  for (let p = 0; p < w * h; p++) {
    if (seen[p] || outside[p] || !transparent(p)) continue;
    let x0 = w; let y0 = h; let x1 = -1; let y1 = -1; let area = 0;
    const queue = [p];
    seen[p] = 1;
    while (queue.length) {
      const q = queue.pop();
      const x = q % w; const y = (q - x) / w;
      area += 1;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const r = ny * w + nx;
        if (seen[r] || outside[r] || !transparent(r)) continue;
        seen[r] = 1; queue.push(r);
      }
    }
    if (area > 400) holes.push({ x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2, r: (x1 - x0 + 1 + (y1 - y0 + 1)) / 4, area });
  }
  return holes.sort((a, b) => b.r - a.r);
}

/** Fuzz for the plate's own flat studio background. High enough to clear the painted gradient,
 *  low enough not to breach the plate's outline into its inner panels (22 % punched through). */
const CLUSTER_BACKGROUND_FUZZ = 10;

function cutCluster(name, width) {
  const file = src(name);
  keyOut(file);
  const background = identify(['-format', '%[pixel:p{0,0}]', file]);
  // The generator painted the plate on a flat studio background that its own border matte does not
  // cover (the plate does not reach the canvas edge). Flood-filling that background from the border
  // is what keeps the plate a cut-out: a plain `-trim` leaves a hard cream rectangle around it, and
  // a global key would eat the bone-ivory dial faces too. The dial holes are enclosed, so the flood
  // cannot reach them.
  const cleared = temp(`${name}-clear`);
  const [canvasW, canvasH] = size(file);
  const corners = [[0, 0], [canvasW - 1, 0], [0, canvasH - 1], [canvasW - 1, canvasH - 1]];
  run([file, '-bordercolor', background, '-fuzz', `${CLUSTER_BACKGROUND_FUZZ}%`, '-fill', 'none',
    ...corners.flatMap(([cx, cy]) => ['-draw', `matte ${cx},${cy} floodfill`]), cleared]);
  const trimmed = temp(`${name}-trim`);
  run([cleared, '-trim', '+repage', trimmed]);
  run([trimmed, '-resize', `${width}x`, out(name)]);
  log(name, out(name));
  const holes = holesIn(out(name));
  if (holes.length !== 2) throw new Error(`${name}: found ${holes.length} keyed dial holes, expected 2`);
  return { file: `art/cockpit/${name}.png`, ...sizeTo(out(name)), dials: holes.map((hole) => ({ cx: +hole.x.toFixed(1), cy: +hole.y.toFixed(1), r: +hole.r.toFixed(1) })) };
}

/** { w, h } of a finished file. */
function sizeTo(file) {
  const [w, h] = size(file);
  return { w, h };
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
 * The figures a sheet actually contains, found by content rather than by asking the generator for a
 * grid: the generator answers a "four panels" prompt with anywhere from four to seven goblins, laid
 * out in whatever arrangement it likes. So the sheet is separated into *figures* — connected blobs of
 * non-matte pixels — and the caller picks the ones it wants in reading order.
 *
 * "Matte" here is the tolerant test, not the key: a generator's magenta comes back shaded, and the
 * soft shadow under a pair of boots is dark magenta rather than `#FF00FF`, so a blob test that only
 * accepted the exact key would glue neighbouring figures together through their shadows.
 */
function findFigures(file) {
  const shot = rgba(file);
  const pinkish = (r, g, b) => r > 120 && b > 120 && r - g > 60 && b - g > 60;
  const content = new Uint8Array(shot.w * shot.h);
  for (let i = 0; i < content.length; i++) {
    const p = i * 4;
    if (shot.data[p + 3] > 8 && !pinkish(shot.data[p], shot.data[p + 1], shot.data[p + 2])) content[i] = 1;
  }
  // Four-connected blobs, with an explicit stack: a 1376x768 sheet is a million pixels and this has
  // to stay linear.
  const seen = new Uint8Array(content.length);
  const stack = new Int32Array(content.length);
  const figures = [];
  for (let start = 0; start < content.length; start++) {
    if (!content[start] || seen[start]) continue;
    let top = 0; stack[top++] = start; seen[start] = 1;
    let area = 0; let x0 = shot.w; let y0 = shot.h; let x1 = -1; let y1 = -1;
    while (top > 0) {
      const index = stack[--top];
      const x = index % shot.w; const y = (index - x) / shot.w;
      area += 1;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && content[index - 1] && !seen[index - 1]) { seen[index - 1] = 1; stack[top++] = index - 1; }
      if (x < shot.w - 1 && content[index + 1] && !seen[index + 1]) { seen[index + 1] = 1; stack[top++] = index + 1; }
      if (y > 0 && content[index - shot.w] && !seen[index - shot.w]) { seen[index - shot.w] = 1; stack[top++] = index - shot.w; }
      if (y < shot.h - 1 && content[index + shot.w] && !seen[index + shot.w]) { seen[index + shot.w] = 1; stack[top++] = index + shot.w; }
    }
    // A speck of matte noise is not a figure.
    if (area < shot.w * shot.h * 0.004) continue;
    figures.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, area });
  }
  // Reading order: row bands first (a figure's own centre decides which band it is in), then left to
  // right. The bands are the sheet's own halves unless the figures disagree with them.
  const band = (figure) => (figure.y + figure.h / 2 < shot.h / 2 ? 0 : 1);
  figures.sort((a, b) => band(a) - band(b) || a.x - b.x);
  return { shot, figures };
}

/** Which figures a sheet must contain, so a generator that answers with a different layout is caught. */
const SHEET_FIGURES = { 'starter-goblin-push': 6, 'pool-goblin': 7 };

/**
 * Kept for the reference sheet that *does* answer with a grid: the panels are separated by
 * goblin-free magenta, so the columns/rows are found by their content, not by their colour — a
 * gutter is a run of columns (or rows) with no opaque pixel at all.
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

/**
 * Cuts one four-frame goblin animation out of a generator sheet.
 *
 * `name` is the source/output stem: `art-src/cockpit/<name>-src.png` becomes
 * `public/art/cockpit/<name>.png`. The grid is whatever arrangement the generator answered with; the
 * picks are indices into the sheet's *figures* in reading order, and every sheet declares how many
 * figures it must contain, so a different answer fails the build instead of shipping a half-goblin.
 */
function cutAnimSheet(name, picks) {
  const source = src(name);
  const { figures } = findFigures(source);
  const expected = SHEET_FIGURES[name];
  if (expected !== undefined && figures.length !== expected) {
    throw new Error(`${name}: found ${figures.length} figures, expected ${expected} — re-check the sheet before cutting`);
  }
  const chosen = picks.map((index) => {
    const figure = figures[index];
    if (!figure) throw new Error(`${name}: no figure at reading-order index ${index} of ${figures.length}`);
    return { x0: figure.x, y0: figure.y, x1: figure.x + figure.w - 1, y1: figure.y + figure.h - 1 };
  });
  // Per frame: crop, key, trim. The panels came back at two different sizes (the generator drew the
  // shove poses on wider canvases), so each frame is normalised to a common painted height and the
  // feet share one baseline — otherwise the goblin pops in scale and bobs between frames.
  const frames = chosen.map((cell, index) => {
    const cellFile = temp(`${name}-cell${index}`);
    run([source, '-crop', `${cell.x1 - cell.x0 + 1}x${cell.y1 - cell.y0 + 1}+${cell.x0}+${cell.y0}`, '+repage', cellFile]);
    keyOut(cellFile);
    const trimmed = temp(`${name}-trim${index}`);
    run([cellFile, '-trim', '+repage', trimmed]);
    return { file: trimmed, box: opaqueBBox(trimmed) };
  });
  if (frames.some((frame) => !frame.box)) throw new Error(`${name}: a chosen panel keyed to nothing`);
  // One foot baseline for the whole sheet: the frames are normalised so their painted height matches
  // the median frame's. The median is used rather than the tallest because a generator answering a
  // "shove" prompt can paint one mid-stride pose half again as tall as the rest, and scaling
  // everything up to that pose would make the goblin change size between frames.
  const heights = frames.map((frame) => frame.box.h).sort((a, b) => a - b);
  const reference = heights[Math.floor(heights.length / 2)];
  const cellSide = 512;
  const inner = cellSide - 28;
  // The *binding* frame decides the scale exactly (it fills the cell or hits the reference height);
  // everything else is a hair under 1 and is normalised out by the browser at the size the overlay
  // draws. Tying the drawn size to the tallest frame instead would shrink every frame to fit the
  // tallest, and the median pose would lose a third of its height.
  const scales = frames.map((frame) => Math.min(reference / frame.box.h, inner / frame.box.w, inner / frame.box.h));
  const cells = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const args = ['-size', `${cellSide * 2}x${cellSide * 2}`, 'xc:none'];
  frames.forEach((frame, index) => {
    const scale = scales[index];
    const scaledW = Math.max(1, Math.round(frame.box.w * scale));
    const scaledH = Math.max(1, Math.round(frame.box.h * scale));
    const scaled = temp(`${name}-scaled${index}`);
    run([frame.file, '-resize', `${scaledW}x${scaledH}`, scaled]);
    const [column, row] = cells[index];
    const x = column * cellSide + Math.round((cellSide - scaledW) / 2);
    const y = row * cellSide + (cellSide - 14) - scaledH;
    args.push('(', scaled, ')', '-gravity', 'northwest', '-geometry', xy(x, y), '-composite');
  });
  const sheet = temp(`${name}-sheet`);
  args.push('-strip', sheet);
  run(args);
  run([sheet, out(name)]);
  log(name, out(name));
  return {
    file: `art/cockpit/${name}.png`, sheet: cellSide * 2, cell: cellSide,
    figures: figures.length, picks, scale: scales.map((value) => +value.toFixed(3)),
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
  // Reading-order indices into the sheet's own figures: crouch, shout, hard shove, recover.
  starter: cutAnimSheet('starter-goblin-push', [1, 2, 3, 4]),
  // The pool goblin (M01 · T2) — the poses the merge needs: palm out ("hold"), pointing at the ring,
  // both hands cupped shouting the countdown, and the two-arm sweep that sends them off. Cut by the
  // same code, so both goblins share a scale law and a common foot baseline.
  poolGoblin: cutAnimSheet('pool-goblin', [0, 1, 2, 4]),
  rivetStrip: cutRivetStrip(),
};

// The project's own repair pass last: it keys any residual matte, despills the fringe and gives
// every transparent pixel the mean of its visible neighbours — which is exactly what
// `npm run check:edges` requires, so the pipeline cannot ship a sprite the audit would reject.
console.log('\nEdge repair → scripts/fix-edge-magenta.mjs cockpit');
execFileSync('node', [join(root, 'scripts/fix-edge-magenta.mjs'), 'cockpit'], { stdio: 'inherit' });

const manifestPath = join(root, 'src/game/cockpit-art.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nMeasured manifest → src/game/cockpit-art.json`);
console.log(`  aperture in the finished bezel: ${JSON.stringify(manifest.bezel.measured)}`);
console.log(`  starter frames used (reading order): ${JSON.stringify(manifest.starter.picks)} of ${manifest.starter.figures} figures`);
console.log(`  pool goblin frames used (reading order): ${JSON.stringify(manifest.poolGoblin.picks)} of ${manifest.poolGoblin.figures} figures`);
console.log(readFileSync(manifestPath, 'utf8').split('\n').slice(0, 3).join('\n'));
