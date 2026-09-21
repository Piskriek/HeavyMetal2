/**
 * generate-stylized-track-textures.mjs
 *
 * Builds the runtime seamless Warcraft-style track texture set from the
 * hand-painted AI master sources in art-masters/stylized-src/.
 *
 * For each of the 10 materials (dirt, grass, cliff, caverock, lava, wood,
 * cobble, iron, bark, water):
 *   1. Loads the 1254px master, resizes to 1024 (legacy/preload art) and 512 (runtime).
 *   2. Seals opposing tile edges with a narrow crossfade centred on the seam
 *      line so RepeatWrapping shows no visible join, then equalises the exact
 *      edge columns/rows for a 0-pixel edge difference.
 *   3. Writes:
 *        public/textures/<name>.png            (512, runtime 3D renderer)
 *        public/art/tracks/tex-<name>.png       (1024, preload/legacy art path)
 *   4. Emits review montages under tests/artifacts/.
 *
 * Reproducible: `npm run art:textures`
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './edge-magenta-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const SRC_DIR = join(root, 'art-masters/stylized-src');
const TEX_DIR = join(root, 'public/textures');
const ART_DIR = join(root, 'public/art/tracks');
const OUT_DIR = join(root, 'tests/artifacts');

const NAMES = ['dirt', 'grass', 'cliff', 'caverock', 'lava', 'wood', 'cobble', 'iron', 'bark', 'water'];

// Bilinear resize of an RGBA buffer.
function resize(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const sx = (sw - 1) / Math.max(1, dw - 1);
  const sy = (sh - 1) / Math.max(1, dh - 1);
  for (let y = 0; y < dh; y++) {
    const gy = y * sy;
    const y0 = Math.floor(gy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const fy = gy - y0;
    for (let x = 0; x < dw; x++) {
      const gx = x * sx;
      const x0 = Math.floor(gx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const fx = gx - x0;
      const o = (y * dw + x) * 4;
      for (let c = 0; c < 4; c++) {
        const a = src[(y0 * sw + x0) * 4 + c];
        const b = src[(y0 * sw + x1) * 4 + c];
        const d = src[(y1 * sw + x0) * 4 + c];
        const e = src[(y1 * sw + x1) * 4 + c];
        out[o + c] = Math.round(a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + d * (1 - fx) * fy + e * fx * fy);
      }
    }
  }
  return out;
}

const smooth = (t) => t * t * (3 - 2 * t);

// Seal one axis for seamless RepeatWrapping. margin = blend half-width each side.
function sealAxis(data, w, h, horizontal, margin) {
  const half = margin / 2;
  const at = (x, y) => (y * w + x) * 4;
  // For every line, crossfade a zone of `margin` px centred on the seam
  // (between index size-1 and 0) so the edge step is spread over the zone.
  const size = horizontal ? w : h;
  for (let l = 0; l < (horizontal ? h : w); l++) {
    // Anchor colours just outside the zone.
    const aIdx = horizontal ? at(size - half - 1 < 0 ? 0 : size - half - 1, l) : at(l, size - half - 1 < 0 ? 0 : size - half - 1);
    const bIdx = horizontal ? at(half, l) : at(l, half);
    const anchor = [0, 1, 2].map((c) => (data[aIdx + c] + data[bIdx + c]) / 2);
    for (let d = 0; d < margin; d++) {
      const pos = (size - half + d) % size;
      const idx = horizontal ? at(pos, l) : at(l, pos);
      // Weight peaks exactly at the seam line (between d=half-1 and d=half).
      const distToSeam = Math.abs(d - half + 0.5) / half; // 0 at seam → 1 at zone edge
      const k = 1 - smooth(Math.min(1, Math.max(0, distToSeam)));
      for (let c = 0; c < 3; c++) {
        data[idx + c] = Math.round(data[idx + c] * (1 - k) + anchor[c] * k);
      }
      data[idx + 3] = 255;
    }
  }
  // Force exact 0-diff on the boundary pair.
  for (let l = 0; l < (horizontal ? h : w); l++) {
    const e0 = horizontal ? at(0, l) : at(l, 0);
    const e1 = horizontal ? at(size - 1, l) : at(l, size - 1);
    for (let c = 0; c < 3; c++) {
      const m = Math.round((data[e0 + c] + data[e1 + c]) / 2);
      data[e0 + c] = m;
      data[e1 + c] = m;
    }
  }
}

function sealTile(data, w, h) {
  const margin = Math.max(32, Math.round(w / 8));
  sealAxis(data, w, h, true, margin);
  sealAxis(data, w, h, false, margin);
}

function maxEdgeDiff(data, w, h) {
  let max = 0;
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      max = Math.max(max, Math.abs(data[(y * w) * 4 + c] - data[(y * w + w - 1) * 4 + c]));
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      max = Math.max(max, Math.abs(data[x * 4 + c] - data[((h - 1) * w + x) * 4 + c]));
    }
  }
  return max;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const tiles512 = [];
  let failed = false;

  for (const name of NAMES) {
    const srcFile = join(SRC_DIR, `${name}.png`);
    let img;
    try {
      img = decodePng(srcFile);
    } catch (err) {
      console.error(`✗ missing source ${srcFile} — run image generation first`);
      failed = true;
      continue;
    }
    // 1024 legacy/preload copy.
    const big = resize(img.data, img.w, img.h, 1024, 1024);
    sealTile(big, 1024, 1024);
    encodePng(join(ART_DIR, `tex-${name}.png`), 1024, 1024, big);
    // 512 runtime copy.
    const small = resize(img.data, img.w, img.h, 512, 512);
    sealTile(small, 512, 512);
    encodePng(join(TEX_DIR, `${name}.png`), 512, 512, small);
    const diff = maxEdgeDiff(small, 512, 512);
    console.log(`✓ ${name}: sealed 512 + 1024 copies (edge diff ${diff}px)`);
    if (diff !== 0) failed = true;
    tiles512.push({ name, data: small });
  }

  // Review montage: each tile shown as a 2x2 repeat so seams are visible.
  const cell = 256; // each repeat shown at 128px
  const cols = 5;
  const rows = Math.ceil(tiles512.length / cols);
  const montage = Buffer.alloc(cols * cell * rows * cell * 4);
  const Mw = cols * cell;
  tiles512.forEach((t, i) => {
    const cx = (i % cols) * cell;
    const cy = Math.floor(i / cols) * cell;
    const thumb = resize(t.data, 512, 512, cell / 2, cell / 2);
    for (let ry = 0; ry < 2; ry++) {
      for (let rx = 0; rx < 2; rx++) {
        for (let y = 0; y < cell / 2; y++) {
          for (let x = 0; x < cell / 2; x++) {
            const s = (y * (cell / 2) + x) * 4;
            const dx = cx + rx * (cell / 2) + x;
            const dy = cy + ry * (cell / 2) + y;
            const d = (dy * Mw + dx) * 4;
            montage[d] = thumb[s];
            montage[d + 1] = thumb[s + 1];
            montage[d + 2] = thumb[s + 2];
            montage[d + 3] = 255;
          }
        }
      }
    }
  });
  encodePng(join(OUT_DIR, 'stylized-textures-tiled.png'), Mw, rows * cell, montage);
  console.log(`Montage: tests/artifacts/stylized-textures-tiled.png`);

  if (failed) {
    console.error('FAILED: one or more tiles missing or with non-zero edge diff');
    process.exit(1);
  }
  console.log('All 10 runtime tiles sealed with 0-pixel edge difference.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
