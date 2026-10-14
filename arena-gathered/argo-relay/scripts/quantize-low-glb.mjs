// ============================================================================
// File: scripts/quantize-low-glb.mjs
// Decision: DEC-10 & P0-PROD-02 (POL-27 < 16.0 MB Single-File Bundle Cap)
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const GEN_DIR = path.resolve('apps/web/src/assets/gen');
const DIST_HTML = path.resolve('apps/web/dist/index.html');
const HARD_CAP_MB = 16.0;

/**
 * Quantizes float32 vertex positions into Int16 normalized bounds for inline low.glb buffers
 * and enforces the 16.0 MB single-file bundle cap (DEC-10).
 */
export function quantizeFloat32ArrayToInt16(float32Arr) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < float32Arr.length; i++) {
    const v = float32Arr[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = Math.max(1e-6, max - min);
  const int16 = new Int16Array(float32Arr.length);
  for (let i = 0; i < float32Arr.length; i++) {
    const norm0to1 = (float32Arr[i] - min) / span;
    int16[i] = Math.round((norm0to1 * 2 - 1) * 32767);
  }
  return { int16, min, max };
}

export function checkDistBundleSizeCap(htmlPath = DIST_HTML, maxMb = HARD_CAP_MB) {
  if (!fs.existsSync(htmlPath)) {
    console.log(`[quantize-low-glb] ${htmlPath} not built yet; skipping size check.`);
    return { exists: false, sizeMb: 0, passed: true };
  }
  const bytes = fs.statSync(htmlPath).size;
  const sizeMb = bytes / (1024 * 1024);
  const passed = sizeMb <= maxMb;
  console.log(
    `[POL-27 BUNDLE GATE] dist/index.html = ${sizeMb.toFixed(2)} MB (Hard Cap: ${maxMb.toFixed(1)} MB) -> ${
      passed ? 'PASS' : 'OVER CAP'
    }`
  );
  return { exists: true, sizeMb, passed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let lowGlbCount = 0;
  let totalLowBytes = 0;

  if (fs.existsSync(GEN_DIR)) {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('low.glb') || entry.name.endsWith('.glb')) {
          lowGlbCount++;
          totalLowBytes += fs.statSync(full).size;
        }
      }
    };
    walk(GEN_DIR);
  }

  console.log(
    `[quantize-low-glb] Audited ${lowGlbCount} inline low.glb files (${(totalLowBytes / (1024 * 1024)).toFixed(2)} MB total).`
  );
  const check = checkDistBundleSizeCap();
  if (!check.passed) {
    process.exitCode = 1;
  }
}
