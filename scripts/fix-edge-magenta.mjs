/**
 * Repair pass for the runtime PNG library:
 *
 *  1. key out residual matte-magenta holes (pixels still near #FF00FF inside
 *     or on the silhouette) — the "bleed through" the keying missed;
 *  2. despill magenta tint that survives on the anti-aliased fringe
 *     (semi-transparent and boundary pixels), clamping the matte channels
 *     down to a 30-count tolerance so painted purples are untouched;
 *  3. soften the rim left around freshly keyed holes;
 *  4. feather sprites whose alpha is hard binary (stair-stepped silhouettes,
 *     the photo-keyed ground decals) with one premultiplied 3x3 alpha blur so
 *     every runtime sprite ships with clean anti-aliased edges.
 *
 * Source sheets (raw matte-backed scans under public/art/sheets and
 * public/art/props) and the archived PreGame app are never touched.
 *
 * Usage: node scripts/fix-edge-magenta.mjs [--dry-run]
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  walkPngs, classify, decodePng, encodePng, auditPixels, hardEdgeRatio,
  isMagentaHole, isMagentaSpill, relOf, rawCounterpart, backgroundMask,
} from './edge-magenta-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const DRY = process.argv.includes('--dry-run');
// Feather when over half the silhouette boundary is hard 255-vs-0 steps.
const HARD_EDGE_MAX = 0.5;
const DESPILL_TOLERANCE = 30;

const K = [1, 2, 1, 2, 4, 2, 1, 2, 1]; // 3x3, sum 16

function premulBlurAlpha(w, h, data) {
  const src = Uint8Array.from(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let pr = 0, pg = 0, pb = 0, pa = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          const k = K[(dy + 1) * 3 + (dx + 1)];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const i = (ny * w + nx) * 4;
          const a = src[i + 3];
          pr += src[i] * a * k;
          pg += src[i + 1] * a * k;
          pb += src[i + 2] * a * k;
          pa += a * k;
        }
      }
      const o = (y * w + x) * 4;
      if (pa === 0) { data[o + 3] = 0; continue; }
      const a = Math.min(255, Math.round(pa / 16));
      data[o] = Math.min(255, Math.round(pr / pa));
      data[o + 1] = Math.min(255, Math.round(pg / pa));
      data[o + 2] = Math.min(255, Math.round(pb / pa));
      data[o + 3] = a;
    }
  }
}

function fixFile(file, rel, rootDir) {
  const { w, h, data } = decodePng(file);
  const before = auditPixels(w, h, data);
  let keyed = 0, despilled = 0, rimmed = 0, feathered = 0;

  // Ground truth for props: the raw scan's background mask (shaded matte is
  // connected to the sheet border) proves which opaque pixels are leftover
  // backdrop, even several px inside the silhouette.
  let mask = null;
  const rawRel = rawCounterpart(rel);
  if (rawRel) {
    try {
      const raw = decodePng(join(rootDir, rawRel));
      if (raw.w === w && raw.h === h) mask = backgroundMask(w, h, raw.data);
    } catch { /* raw missing: heuristics only */ }
  }

  // Pass 1: key out residual matte holes / on-edge matte pixels.
  const removed = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      const rawBg = mask && mask[p] && a === 255 &&
        Math.min(r - g, b - g) >= 40 && Math.abs(r - b) <= 60;
      if (isMagentaHole(r, g, b, a) || rawBg) {
        data[i + 3] = 0;
        removed[p] = 1;
        keyed++;
      }
    }
  }

  // Pass 2: despill magenta tint on the alpha fringe + boundary.
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : data[(y * w + x) * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a === 0) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (!isMagentaSpill(r, g, b, a)) continue;
      const onEdge = a === 255 &&
        (A(x - 1, y) === 0 || A(x + 1, y) === 0 || A(x, y - 1) === 0 || A(x, y + 1) === 0);
      if (a < 255 || onEdge) {
        const excess = Math.min(r - g, b - g) - DESPILL_TOLERANCE;
        if (excess > 0) {
          data[i] = r - excess;
          data[i + 2] = b - excess;
          despilled++;
        }
      }
    }
  }

  // Pass 3: soften the rim around freshly keyed holes.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!removed[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const i = (ny * w + nx) * 4;
          if (data[i + 3] === 0 || removed[ny * w + nx]) continue;
          if (data[i + 3] > 215) { data[i + 3] = 215; rimmed++; }
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const excess = Math.min(r - g, b - g) - DESPILL_TOLERANCE;
          if (excess > 0) { data[i] = r - excess; data[i + 2] = b - excess; }
        }
      }
    }
  }

  // Pass 4: shaded-matte fringe despill. The generated matte is shaded, so a
  // ring of darker magenta can survive the hole key as fully opaque pixels
  // hugging the silhouette. On the boundary (1px from transparency) clamp the
  // matte channels toward green; painted purples sit inside the object or
  // carry far more green, so they are untouched.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a === 0) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (Math.min(r - g, b - g) < 60 || Math.abs(r - b) > 45) continue;
      if (!(A(x - 1, y) === 0 || A(x + 1, y) === 0 || A(x, y - 1) === 0 || A(x, y + 1) === 0)) continue;
      const cap = g + 40;
      if (r > cap) { data[i] = cap; despilled++; }
      if (b > cap) { data[i + 2] = cap; }
    }
  }

  // Pass 5: unmix residual matte out of semi-transparent fringe pixels.
  // A fringe pixel is coverage t of art A over the matte M: C = t*A + (1-t)*M.
  // Solving for A neutralises the pink without touching asymmetric painted
  // purples (|r-b| > 45) or low-dominance art tones.
  const NEAR = (x, y) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (A(x + dx, y + dy) === 0) return true;
    }
    return false;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a === 0 || a === 255) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (Math.min(r - g, b - g) < 20 || Math.abs(r - b) > 45) continue;
      if (!NEAR(x, y)) continue;
      const t = a / 255;
      const m = (1 - t) * 255;
      data[i] = Math.max(0, Math.min(255, Math.round((r - m) / t)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(g / t)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round((b - m) / t)));
      despilled++;
    }
  }


  // Pass 6: feather hard binary-alpha silhouettes (premultiplied AA blur).
  const needFeather = hardEdgeRatio(before) > HARD_EDGE_MAX;
  if (needFeather) {
    premulBlurAlpha(w, h, data);
    feathered = 1;
  }

  // Pass 7: bleed edge colour into the transparent fringe so non-premultiplied
  // scalers (browser image smoothing, IM resize) can never resurface the old
  // matte RGB as pink speckle. Alpha stays 0.
  let bled = 0;
  let filled = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) filled[p] = data[p * 4 + 3] > 0 ? 1 : 0;
  for (let pass = 0; pass < 2; pass++) {
    const src = Uint8Array.from(data);
    const next = Uint8Array.from(filled);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (filled[idx]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || !filled[ny * w + nx]) continue;
            const j = (ny * w + nx) * 4;
            r += src[j]; g += src[j + 1]; b += src[j + 2]; n++;
          }
        }
        if (n > 0) {
          const i = idx * 4;
          const nr = Math.round(r / n), ng = Math.round(g / n), nb = Math.round(b / n);
          next[idx] = 1;
          // idempotence: leave already-bled pixels alone
          if (Math.max(Math.abs(nr - data[i]), Math.abs(ng - data[i + 1]), Math.abs(nb - data[i + 2])) <= 4) continue;
          data[i] = nr; data[i + 1] = ng; data[i + 2] = nb;
          bled++;
        }
      }
    }
    filled = next;
  }

  const changed = keyed + despilled + rimmed + feathered + bled > 0;
  if (changed && !DRY) encodePng(file, w, h, data);
  const after = changed ? auditPixels(w, h, data) : before;
  return { rel, changed, keyed, despilled, rimmed, feathered, bled, before, after };
}

function main() {
  const files = walkPngs(join(root, 'public')).sort();
  let touched = 0;
  for (const file of files) {
    const rel = relOf(root, file);
    if (classify(rel) !== 'runtime') continue;
    const res = fixFile(file, rel, root);
    if (!res.changed) continue;
    touched++;
    console.log(
      `${DRY ? '[dry]' : '✓'} ${rel.padEnd(62)} keyed=${String(res.keyed).padStart(5)}` +
      ` despill=${String(res.despilled).padStart(5)} rim=${String(res.rimmed).padStart(4)}` +
      ` bled=${String(res.bled).padStart(6)}${res.feathered ? ' feathered' : ''}  semi ${res.before.semi}->${res.after.semi}`
    );
  }
  console.log(`\n${DRY ? 'Would touch' : 'Touched'} ${touched} runtime sprites.`);
}

main();
