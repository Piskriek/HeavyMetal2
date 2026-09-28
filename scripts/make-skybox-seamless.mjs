import { existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './edge-magenta-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

const SKY_FILES = [
  'public/art/tracks/sky_copperwood_ridge.png',
  'public/art/tracks/sky_copperwood_misty_dawn.png',
  'public/art/tracks/sky_copperwood_autumn_dusk.png',
  'public/art/tracks/sky_copperwood_frost_morning.png',
  'public/art/tracks/sky_boomtown_quarry.png',
  'public/art/tracks/sky_boomtown_ember_storm.png',
  'public/art/tracks/sky_boomtown_night_furnace.png',
  'public/art/tracks/sky_woolly_wasteland.png',
  'public/art/tracks/sky_woolly_sunbeam_break.png',
  'public/art/tracks/sky_woolly_dusk_zeppelins.png',
  'public/art/menu-vista.png',
];

function smoothstep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function measureSeam(w, h, data) {
  let totalDiff = 0;
  let maxDiff = 0;
  for (let y = 0; y < h; y++) {
    const pLeft = y * w * 4;
    const pRight = (y * w + (w - 1)) * 4;
    const dr = Math.abs(data[pLeft] - data[pRight]);
    const dg = Math.abs(data[pLeft + 1] - data[pRight + 1]);
    const db = Math.abs(data[pLeft + 2] - data[pRight + 2]);
    const diff = (dr + dg + db) / 3;
    totalDiff += diff;
    if (diff > maxDiff) maxDiff = diff;
  }
  return {
    avgDiff: totalDiff / h,
    maxDiff,
  };
}

export function makeSkyboxSeamless(relPath) {
  const fullPath = join(root, relPath);
  if (!existsSync(fullPath)) {
    console.warn(`File not found: ${relPath}`);
    return null;
  }

  const png = decodePng(fullPath);
  const w = png.w;
  const h = png.h;
  const initial = measureSeam(w, h, png.data);

  // Use 9% of panorama width for smooth, imperceptible crossfade
  const M = Math.round(w * 0.09);

  // Apply smooth panoramic wrap blend
  for (let y = 0; y < h; y++) {
    for (let k = 0; k < M; k++) {
      const t = smoothstep(0, M, k);
      const fade = 0.5 * (1 - t);

      const pL = (y * w + k) * 4;
      const pR = (y * w + (w - 1 - k)) * 4;

      for (let c = 0; c < 3; c++) {
        const origL = png.data[pL + c];
        const origR = png.data[pR + c];

        // Symmetrical Hermite crossfade guarantees exact match at k=0 (seam)
        png.data[pL + c] = Math.round(origL + fade * (origR - origL));
        png.data[pR + c] = Math.round(origR + fade * (origL - origR));
      }
    }
  }

  const finalSeam = measureSeam(w, h, png.data);
  encodePng(fullPath, w, h, png.data);

  return {
    file: basename(relPath),
    w,
    h,
    M,
    initialAvg: initial.avgDiff,
    initialMax: initial.maxDiff,
    finalAvg: finalSeam.avgDiff,
    finalMax: finalSeam.maxDiff,
  };
}

export function makeAllSkyboxesSeamless() {
  console.log('Making all skybox/dome images horizontally seamless...\n');
  const results = [];

  for (const rel of SKY_FILES) {
    const res = makeSkyboxSeamless(rel);
    if (res) {
      results.push(res);
      console.log(
        `✓ ${res.file.padEnd(35)} (${res.w}x${res.h}, blend ${res.M}px): seam diff ${res.initialAvg.toFixed(2)} (max ${res.initialMax.toFixed(2)}) -> ${res.finalAvg.toFixed(4)} (max ${res.finalMax.toFixed(4)})`
      );
    }
  }

  console.log(`\nSuccessfully processed ${results.length} skybox/dome panoramas.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  makeAllSkyboxesSeamless();
}
