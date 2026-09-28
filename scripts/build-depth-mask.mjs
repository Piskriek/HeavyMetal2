/**
 * Depth masks for painted goblin parts that wrap around the goblin: a scarf's loop behind the neck,
 * the inside back wall of an empty helmet, a goggle strap going round the head, a collar's back half.
 *
 * The art agent paints a second image for such a part, its depth map: the same outline, every piece
 * that would sit in FRONT of a goblin wearing it pure white, every piece that would be hidden BEHIND
 * the goblin's head or neck pure black, on the usual magenta background
 * (`art-src/avatar-parts/depth-raw/<id>.png`). This script lines that map up with the keyed part
 * (bounding box onto bounding box, so the map never needs to be pixel exact), labels every pixel of
 * the part front or back (a pixel the map left unclear takes the nearest label), and writes
 * `public/avatar-parts/depth/<id>.png`: greyscale at half resolution like the tint masks, white =
 * in front of the goblin. The compositor draws the part twice: through the inverted mask behind the
 * head, and through the mask in front of it. The two passes add up to the part exactly.
 *
 * Usage: node scripts/build-depth-mask.mjs [--only id1,id2]   (after key-art.ts keyed the part)
 * Also writes `art-src/review/<id>-depth.png` (never committed): the part as painted, and the part
 * with its back pixels shaded blue, for the review loop. Exits 1 when a map fails QA.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './edge-magenta-lib.mjs';

const BACKGROUND = -1, UNCLEAR = -2, BACK = 0, FRONT = 1;

/** Labels one pixel of a painted depth map. */
function labelOf(r, g, b) {
  if (r > 150 && b > 150 && g < 110) return BACKGROUND; // the magenta key
  const lum = (r + g + b) / 3;
  if (lum >= 150) return FRONT;
  if (lum <= 100) return BACK;
  return UNCLEAR;
}

function boundsOf(w, h, test) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (test(y * w + x)) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * The part's depth mask from its painted map.
 * @param {{ w: number, h: number, data: Uint8Array }} part keyed RGBA part
 * @param {{ w: number, h: number, data: Uint8Array }} map painted RGBA depth map (magenta background)
 * @returns {{ mask: Uint8Array, stats: object, verdict: 'pass'|'warn'|'fail', notes: string[] }} full-resolution mask (255 = front)
 */
export function depthMaskFromMap(part, map) {
  const notes = [];
  const labels = new Int8Array(map.w * map.h);
  let unclear = 0, painted = 0;
  for (let i = 0; i < labels.length; i++) {
    const l = labelOf(map.data[i * 4], map.data[i * 4 + 1], map.data[i * 4 + 2]);
    labels[i] = l;
    if (l !== BACKGROUND) painted++;
    if (l === UNCLEAR) unclear++;
  }
  const pb = boundsOf(part.w, part.h, (i) => part.data[i * 4 + 3] >= 16);
  const mb = boundsOf(map.w, map.h, (i) => labels[i] !== BACKGROUND);
  if (!pb || !mb) return { mask: new Uint8Array(part.w * part.h).fill(255), stats: {}, verdict: 'fail', notes: [pb ? 'the depth map is empty (all magenta)' : 'the keyed part is empty'] };

  // Nearest clear label for every map pixel: a multi-source flood from the white and black pixels.
  const nearest = new Int8Array(labels.length).fill(BACKGROUND);
  const queue = new Int32Array(labels.length);
  let head = 0, tail = 0;
  for (let i = 0; i < labels.length; i++) if (labels[i] === FRONT || labels[i] === BACK) { nearest[i] = labels[i]; queue[tail++] = i; }
  while (head < tail) {
    const i = queue[head++], x = i % map.w, y = (i / map.w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < map.w - 1 ? i + 1 : -1, y > 0 ? i - map.w : -1, y < map.h - 1 ? i + map.w : -1]) {
      if (j >= 0 && nearest[j] === BACKGROUND) { nearest[j] = nearest[i]; queue[tail++] = j; }
    }
  }

  const mask = new Uint8Array(part.w * part.h).fill(255);
  let opaque = 0, back = 0, missed = 0;
  for (let y = 0; y < part.h; y++) for (let x = 0; x < part.w; x++) {
    const u = (x - pb.x + 0.5) / pb.w, v = (y - pb.y + 0.5) / pb.h;
    const mx = Math.min(map.w - 1, Math.max(0, Math.floor(mb.x + u * mb.w)));
    const my = Math.min(map.h - 1, Math.max(0, Math.floor(mb.y + v * mb.h)));
    const at = labels[my * map.w + mx];
    const label = nearest[my * map.w + mx];
    const i = y * part.w + x;
    mask[i] = label === BACK ? 0 : 255;
    if (part.data[i * 4 + 3] < 8) continue;
    opaque++;
    if (label === BACK) back++;
    if (at === BACKGROUND) missed++;
  }

  const stats = {
    back: opaque ? back / opaque : 0,
    front: opaque ? 1 - back / opaque : 0,
    offMap: opaque ? missed / opaque : 0,
    unclear: painted ? unclear / painted : 0,
    aspect: Math.abs(Math.log((pb.w / pb.h) / (mb.w / mb.h))),
  };
  let verdict = 'pass';
  const fail = (n) => { verdict = 'fail'; notes.push(n); };
  const warn = (n) => { if (verdict === 'pass') verdict = 'warn'; notes.push(n); };
  if (stats.aspect > 0.15) fail(`the map's outline is ${Math.round(stats.aspect * 100)}% off the part's shape: regenerate with the keyed part as the image input`);
  if (stats.back < 0.02) fail('nothing is marked as behind the goblin: paint the hidden pieces pure black');
  if (stats.front < 0.05) fail('nothing is marked as in front of the goblin: paint the visible pieces pure white');
  if (stats.offMap > 0.12) fail(`${Math.round(stats.offMap * 100)}% of the part falls outside the map's outline: regenerate with the keyed part as the image input`);
  else if (stats.offMap > 0.05) warn(`${Math.round(stats.offMap * 100)}% of the part falls outside the map's outline (took the nearest label)`);
  if (stats.unclear > 0.1) warn(`${Math.round(stats.unclear * 100)}% of the map is grey, not pure white or black`);
  return { mask, stats, verdict, notes };
}

/** Box-averages a full-resolution mask to half resolution, as greyscale RGBA. */
export function halfResolution(mask, w, h) {
  const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
  const out = Buffer.alloc(hw * hh * 4);
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) {
    let sum = 0, n = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const sx = x * 2 + dx, sy = y * 2 + dy;
      if (sx < w && sy < h) { sum += mask[sy * w + sx]; n++; }
    }
    const j = (y * hw + x) * 4;
    out[j] = out[j + 1] = out[j + 2] = Math.round(sum / n);
    out[j + 3] = 255;
  }
  return { w: hw, h: hh, data: out };
}

/** The review sheet: the part as painted on the game's panel colour, then with its back pixels shaded blue. */
function reviewSheet(part, mask) {
  const w = part.w * 2 + 24, h = part.h + 16;
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { out[i * 4] = 0x0f; out[i * 4 + 1] = 0x18; out[i * 4 + 2] = 0x14; out[i * 4 + 3] = 255; }
  for (let y = 0; y < part.h; y++) for (let x = 0; x < part.w; x++) {
    const i = y * part.w + x, a = part.data[i * 4 + 3] / 255;
    for (const [ox, shade] of [[8, false], [part.w + 16, true]]) {
      const j = ((y + 8) * w + x + ox) * 4;
      for (let c = 0; c < 3; c++) {
        let v = part.data[i * 4 + c];
        if (shade && mask[i] < 128) v = v * 0.45 + [0x3a, 0x6e, 0xa5][c] * 0.55;
        out[j + c] = Math.round(out[j + c] * (1 - a) + v * a);
      }
    }
  }
  return { w, h, data: out };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const rawDir = join(root, 'art-src/avatar-parts/depth-raw');
  const keyedDir = join(root, 'public/avatar-parts/keyed');
  const outDir = join(root, 'public/avatar-parts/depth');
  const reviewDir = join(root, 'art-src/review');
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
  mkdirSync(outDir, { recursive: true });
  mkdirSync(reviewDir, { recursive: true });
  let failed = 0;
  for (const file of existsSync(rawDir) ? readdirSync(rawDir).sort() : []) {
    if (!file.endsWith('.png')) continue;
    const id = file.slice(0, -4);
    if (only && !only.has(id)) continue;
    const keyed = join(keyedDir, `${id}.png`);
    if (!existsSync(keyed)) { console.log(`FAIL ${id.padEnd(36)} no keyed part at public/avatar-parts/keyed/${id}.png: key the part first`); failed++; continue; }
    const part = decodePng(keyed), map = decodePng(join(rawDir, file));
    const { mask, stats, verdict, notes } = depthMaskFromMap(part, map);
    const half = halfResolution(mask, part.w, part.h);
    encodePng(join(outDir, `${id}.png`), half.w, half.h, half.data);
    const sheet = reviewSheet(part, mask);
    encodePng(join(reviewDir, `${id}-depth.png`), sheet.w, sheet.h, sheet.data);
    if (verdict === 'fail') failed++;
    console.log(`${verdict.toUpperCase().padEnd(4)} ${id.padEnd(36)} front ${Math.round(stats.front * 100 || 0)}%  back ${Math.round(stats.back * 100 || 0)}%  ${notes.join('; ')}`);
  }
  // The manifest lists every depth mask on disk (not only the ones built now), sorted, so it is
  // deterministic and never depends on --only.
  const ids = readdirSync(outDir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
  writeFileSync(join(root, 'src/game/meta/painted-depth.generated.ts'), `// AUTO-GENERATED by scripts/build-depth-mask.mjs — do not edit by hand.
/** Painted parts with a depth mask (public/avatar-parts/depth/<id>.png, white = in front of the goblin). */
export const PART_DEPTH: ReadonlySet<string> = new Set([
${ids.map((id) => `  '${id}',`).join('\n')}
]);
`);
  process.exit(failed ? 1 : 0);
}
