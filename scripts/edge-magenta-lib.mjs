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
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { inflateSync, deflateSync, crc32 } from 'node:zlib';

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngNode(file) {
  const buf = readFileSync(file);
  if (buf.length < 8 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('Not a PNG');
  }
  let pos = 8;
  let w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idatParts = [];
  let palette = null;
  let trns = null;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;

    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (interlace !== 0) throw new Error('Interlaced PNG not supported');
  if (bitDepth !== 8 && bitDepth !== 16) throw new Error(`Unsupported bit depth: ${bitDepth}`);

  const raw = inflateSync(Buffer.concat(idatParts));
  const out = Buffer.alloc(w * h * 4);

  let channels = 4;
  if (colorType === 6) channels = 4;
  else if (colorType === 2) channels = 3;
  else if (colorType === 0) channels = 1;
  else if (colorType === 4) channels = 2;
  else if (colorType === 3) channels = 1;
  else throw new Error(`Unsupported color type: ${colorType}`);

  const bytesPerSample = bitDepth === 16 ? 2 : 1;
  const bpp = channels * bytesPerSample;

  let rawPos = 0;
  const prevLine = Buffer.alloc(w * bpp);
  const currLine = Buffer.alloc(w * bpp);

  for (let y = 0; y < h; y++) {
    const filter = raw[rawPos++];
    for (let x = 0; x < w * bpp; x++) {
      const val = raw[rawPos++];
      const left = x >= bpp ? currLine[x - bpp] : 0;
      const up = prevLine[x];
      const upLeft = x >= bpp ? prevLine[x - bpp] : 0;

      let unfiltered = 0;
      if (filter === 0) unfiltered = val;
      else if (filter === 1) unfiltered = (val + left) & 0xff;
      else if (filter === 2) unfiltered = (val + up) & 0xff;
      else if (filter === 3) unfiltered = (val + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) unfiltered = (val + paeth(left, up, upLeft)) & 0xff;
      else throw new Error(`Unknown filter: ${filter}`);

      currLine[x] = unfiltered;
    }

    const outRowStart = y * w * 4;
    if (bitDepth === 8) {
      if (colorType === 6) {
        currLine.copy(out, outRowStart, 0, w * 4);
      } else if (colorType === 2) {
        for (let x = 0; x < w; x++) {
          const di = outRowStart + x * 4;
          const si = x * 3;
          out[di] = currLine[si];
          out[di + 1] = currLine[si + 1];
          out[di + 2] = currLine[si + 2];
          out[di + 3] = 255;
        }
      } else if (colorType === 3) {
        for (let x = 0; x < w; x++) {
          const di = outRowStart + x * 4;
          const idx = currLine[x];
          out[di] = palette[idx * 3];
          out[di + 1] = palette[idx * 3 + 1];
          out[di + 2] = palette[idx * 3 + 2];
          out[di + 3] = trns && idx < trns.length ? trns[idx] : 255;
        }
      } else if (colorType === 0) {
        for (let x = 0; x < w; x++) {
          const di = outRowStart + x * 4;
          const g = currLine[x];
          out[di] = g;
          out[di + 1] = g;
          out[di + 2] = g;
          out[di + 3] = 255;
        }
      } else if (colorType === 4) {
        for (let x = 0; x < w; x++) {
          const di = outRowStart + x * 4;
          const g = currLine[x * 2];
          const a = currLine[x * 2 + 1];
          out[di] = g;
          out[di + 1] = g;
          out[di + 2] = g;
          out[di + 3] = a;
        }
      }
    } else {
      if (colorType === 6) {
        for (let x = 0; x < w; x++) {
          const di = outRowStart + x * 4;
          const si = x * 8;
          out[di] = currLine[si];
          out[di + 1] = currLine[si + 2];
          out[di + 2] = currLine[si + 4];
          out[di + 3] = currLine[si + 6];
        }
      } else if (colorType === 2) {
        for (let x = 0; x < w; x++) {
          const di = outRowStart + x * 4;
          const si = x * 6;
          out[di] = currLine[si];
          out[di + 1] = currLine[si + 2];
          out[di + 2] = currLine[si + 4];
          out[di + 3] = 255;
        }
      }
    }

    currLine.copy(prevLine);
  }

  return { w, h, data: out };
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc >>> 0, 8 + len);
  return chunk;
}

function encodePngNode(w, h, data) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const ihdrChunk = makeChunk('IHDR', ihdr);

  const rawScanlines = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const rawPos = y * (1 + w * 4);
    rawScanlines[rawPos] = 0;
    data.copy(rawScanlines, rawPos + 1, y * w * 4, (y + 1) * w * 4);
  }

  const compressed = deflateSync(rawScanlines);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

export function isMagentaHole(r, g, b, a) {
  return a > 0 && r > 150 && b > 150 && Math.min(r - g, b - g) >= 120 && Math.abs(r - b) <= 45;
}

export function isMagentaSpill(r, g, b, a) {
  return a > 0 && r > 140 && b > 140 && Math.min(r - g, b - g) >= 90 && Math.abs(r - b) <= 45;
}

/** Raw RGBA (8-bit) decode of one PNG via pure Node (with ImageMagick fallback). */
export function decodePng(file) {
  try {
    return decodePngNode(file);
  } catch (nodeErr) {
    const info = spawnSync('identify', ['-format', '%w %h', file], { encoding: 'utf8' });
    if (info.status !== 0) throw new Error(`decode failed for ${file}: ${nodeErr.message}`);
    const [w, h] = info.stdout.trim().split(/\s+/).map(Number);
    const raw = spawnSync('convert', [file, '-depth', '8', 'RGBA:-'], { maxBuffer: 1 << 30 });
    if (raw.status !== 0) throw new Error(`decode failed for ${file}: ${raw.stderr}`);
    return { w, h, data: raw.stdout };
  }
}

/** Encode an RGBA buffer back to the same PNG path via pure Node (with ImageMagick fallback). */
export function encodePng(file, w, h, data) {
  try {
    const encoded = encodePngNode(w, h, data);
    writeFileSync(file, encoded);
  } catch {
    const res = spawnSync('convert', ['-size', `${w}x${h}`, '-depth', '8', 'RGBA:-', file], {
      input: data,
      maxBuffer: 1 << 30,
    });
    if (res.status !== 0) throw new Error(`encode failed for ${file}: ${res.stderr}`);
  }
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
  if (/\/art\/goblins\/goblin-/.test(r) && !r.includes('/goblins/alpha/')) return 'source';
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
  if (rel.startsWith('public/art/props/alpha/')) return rel.replace('public/art/props/alpha/', 'public/art/props/');
  if (rel.startsWith('public/art/goblins/alpha/')) return rel.replace('public/art/goblins/alpha/', 'public/art/goblins/');
  return null;
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
