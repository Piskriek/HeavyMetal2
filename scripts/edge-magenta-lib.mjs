/**
 * Shared pixel tests + PNG decode/encode for the edge/magenta audit.
 *
 * The matte for this project is magenta #FF00FF (see docs/ART_PIPELINE.md).
 * "Bleed" is any residual pixel whose colour still sits near that matte after
 * keying.  Genuine painted purples/violets (glowcap mushrooms, neon UI) are
 * blue-shifted (b >> r) or low-dominance, so two signatures separate them:
 *
 *  - matte hole  : opaque-or-semi pixel, r>150 b>150, magenta dominance
 *                  min(r-g, b-g) >= 120 AND red/blue symmetric |r-b| <= 45.
 *  - matte spill : same symmetry with dominance >= 90, tolerated only on the
 *                  anti-aliased fringe; anything stronger is despilled.
 *
 * Requires ImageMagick 6 (`convert`, `identify`) on PATH — the same dependency
 * scripts/build-art.mjs already documents.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export function isMagentaHole(r, g, b, a) {
  return a > 0 && r > 150 && b > 150 && Math.min(r - g, b - g) >= 120 && Math.abs(r - b) <= 45;
}

export function isMagentaSpill(r, g, b, a) {
  return a > 0 && r > 140 && b > 140 && Math.min(r - g, b - g) >= 90 && Math.abs(r - b) <= 45;
}

/** Raw RGBA (8-bit) decode of one PNG via ImageMagick. */
export function decodePng(file) {
  const info = spawnSync('identify', ['-format', '%w %h', file], { encoding: 'utf8' });
  if (info.status !== 0) throw new Error(`identify failed for ${file}: ${info.stderr}`);
  const [w, h] = info.stdout.trim().split(/\s+/).map(Number);
  const raw = spawnSync('convert', [file, '-depth', '8', 'RGBA:-'], { maxBuffer: 1 << 30 });
  if (raw.status !== 0) throw new Error(`decode failed for ${file}: ${raw.stderr}`);
  return { w, h, data: raw.stdout };
}

/** Encode an RGBA buffer back to the same PNG path via ImageMagick. */
export function encodePng(file, w, h, data) {
  const res = spawnSync('convert', ['-size', `${w}x${h}`, '-depth', '8', 'RGBA:-', file], {
    input: data,
    maxBuffer: 1 << 30,
  });
  if (res.status !== 0) throw new Error(`encode failed for ${file}: ${res.stderr}`);
}

export function walkPngs(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkPngs(p));
    else if (/\.png$/i.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Classify a repo-relative path:
 *  - 'source'  : raw matte-backed sheets / raw prop scans the pipeline reads.
 *                Magenta is expected here and is NOT a failure.
 *  - 'legacy'  : the archived PreGame app; reported but never failed/fixed.
 *  - 'runtime' : sprites the live game draws; must be bleed-free with AA edges.
 */
export function classify(rel) {
  const r = rel.split(sep).join('/');
  if (r.startsWith('PreGame/')) return 'legacy';
  if (r.includes('/art/sheets/')) return 'source';
  if (/\/art\/props\/prop-/.test(r) && !r.includes('/props/alpha/')) return 'source';
  return 'runtime';
}

/** Pixel census for one decoded image. */
export function auditPixels(w, h, data) {
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? -1 : data[(y * w + x) * 4 + 3];
  let opaque = 0;
  let semi = 0;
  let holes = 0;
  let spillSemi = 0;
  let spillEdge = 0;
  let edgeRing = 0;
  let hardBoundary = 0; // fully opaque pixel with an interior transparent 4-neighbour
  let softBoundary = 0; // semi-transparent pixel with an interior transparent 4-neighbour
  let transpBleed = 0; // transparent pixel near the silhouette still carrying matte RGB
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a === 0) continue;
      opaque++;
      if (a < 255) semi++;
      const hole = isMagentaHole(r, g, b, a);
      const spill = isMagentaSpill(r, g, b, a);
      if (hole) holes++;
      const isEdge =
        x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
        A(x - 1, y) === 0 || A(x + 1, y) === 0 || A(x, y - 1) === 0 || A(x, y + 1) === 0;
      if (isEdge) {
        edgeRing++;
        if (spill && !hole) spillEdge++;
      }
      if (a < 255 && spill && !hole) spillSemi++;
      // shaded-matte fringe: opaque magenta-dominant pixel hugging transparency
      if (a === 255 && Math.min(r - g, b - g) >= 60 && Math.abs(r - b) <= 45 &&
        (A(x - 1, y) === 0 || A(x + 1, y) === 0 || A(x, y - 1) === 0 || A(x, y + 1) === 0)) spillEdge++;
      // interior hard step: opaque 255 directly against transparent 0
      if (A(x - 1, y) === 0 || A(x + 1, y) === 0 || A(x, y - 1) === 0 || A(x, y + 1) === 0) {
        if (a === 255) hardBoundary++;
        else softBoundary++;
      }
    }
  }
  // Transparent pixels that still store matte RGB bleed pink when a renderer
  // or image scaler interpolates non-premultiplied channels.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] !== 0) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (!(r > 150 && b > 150 && Math.min(r - g, b - g) >= 120 && Math.abs(r - b) <= 45)) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) {
        for (let dx = -2; dx <= 2 && !near; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && data[(ny * w + nx) * 4 + 3] > 0) near = true;
        }
      }
      if (near) transpBleed++;
    }
  }
  return {
    opaque, semi, holes, spillSemi, spillEdge, edgeRing, hardBoundary, softBoundary, transpBleed,
    hasAlpha: semi > 0 || opaque < w * h,
  };
}

/**
 * Share of the silhouette boundary that is a hard (un-anti-aliased) step.
 * 1 (N/A, "clean") for opaque or effectively empty images.
 */
export function hardEdgeRatio(audit) {
  if (!audit.hasAlpha || audit.opaque < 1000) return 0;
  const total = audit.hardBoundary + audit.softBoundary;
  if (total < 200) return 0;
  return audit.hardBoundary / total;
}

export function relOf(root, file) {
  return relative(root, file).split(sep).join('/');
}

/** Raw matte-backed scan a keyed runtime sprite was cut from, if any. */
export function rawCounterpart(rel) {
  if (!rel.startsWith('public/art/props/alpha/')) return null;
  return rel.replace('public/art/props/alpha/', 'public/art/props/');
}

const isSaturatedMatte = (r, g, b) => r > 120 && b > 100 && g < 0.45 * r && g < 0.45 * b;

/**
 * Background mask of a raw scan: connected components of saturated-matte
 * pixels that either touch the sheet border or are >=80% saturated matte
 * (enclosed matte pockets). Painted violets carry too much green to join a
 * component, so subject art is never part of the mask.
 */
export function backgroundMask(w, h, data) {
  const N = w * h;
  const comp = new Int32Array(N).fill(-1);
  const touch = [], size = [], sat = [];
  let cid = 0;
  const stack = [];
  for (let start = 0; start < N; start++) {
    if (comp[start] !== -1) continue;
    const i0 = start * 4;
    if (!isSaturatedMatte(data[i0], data[i0 + 1], data[i0 + 2])) continue;
    let cTouch = false, cSize = 0, cSat = 0;
    comp[start] = cid;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop();
      const px = p % w, py = (p - px) / w;
      cSize++;
      if (px === 0 || py === 0 || px === w - 1 || py === h - 1) cTouch = true;
      const j = p * 4;
      if (data[j + 1] < 0.45 * data[j] && data[j + 1] < 0.45 * data[j + 2]) cSat++;
      for (let d = 0; d < 4; d++) {
        const nx = px + (d === 0 ? -1 : d === 1 ? 1 : 0);
        const ny = py + (d === 2 ? -1 : d === 3 ? 1 : 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (comp[q] !== -1) continue;
        const k = q * 4;
        if (!isSaturatedMatte(data[k], data[k + 1], data[k + 2])) continue;
        comp[q] = cid;
        stack.push(q);
      }
    }
    touch[cid] = cTouch; size[cid] = cSize; sat[cid] = cSat;
    cid++;
  }
  const mask = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const c = comp[p];
    if (c !== -1 && (touch[c] || sat[c] / size[c] >= 0.8)) mask[p] = 1;
  }
  return mask;
}

/** Opaque residual-matte pixels the raw scan proves are background. */
export function rawResidualCount(w, h, data, mask) {
  let n = 0;
  for (let p = 0; p < w * h; p++) {
    if (!mask[p]) continue;
    const i = p * 4;
    const a = data[i + 3];
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (a === 255 && Math.min(r - g, b - g) >= 40 && Math.abs(r - b) <= 60) n++;
  }
  return n;
}
