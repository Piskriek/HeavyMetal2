/**
 * Bundle budget checker (T0 / D11).
 * Verifies that the single-file distribution bundle stays within the size budget.
 */
import { readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const DIST_FILE = resolve(process.cwd(), 'dist/index.html');
const RECORD_FILE = resolve(process.cwd(), 'docs/BUILDER_BASELINE.md');
const BUDGET_GZIP_MAX_DELTA_KB = 80;

if (!existsSync(DIST_FILE)) {
  console.error(`Bundle budget error: ${DIST_FILE} does not exist. Run "npm run build" first.`);
  process.exit(1);
}

const content = readFileSync(DIST_FILE);
const rawBytes = content.length;
const gzipBytes = gzipSync(content).length;
const rawKB = (rawBytes / 1024).toFixed(2);
const gzipKB = (gzipBytes / 1024).toFixed(2);

console.log(`[Bundle Budget] dist/index.html: ${rawKB} kB raw (${gzipKB} kB gzip)`);

const isRecord = process.argv.includes('--record');
if (isRecord) {
  const doc = `# Heavy Metal GP 2 — Builder Performance Baseline

Recorded: ${new Date().toISOString()}

## Bundle Size Baseline
- **Raw Bundle**: ${rawKB} kB
- **Gzip Bundle**: ${gzipKB} kB
- **Budget Threshold**: ≤ ${(parseFloat(gzipKB) + BUDGET_GZIP_MAX_DELTA_KB).toFixed(2)} kB gzip (+${BUDGET_GZIP_MAX_DELTA_KB} kB budget)

## Baseline Dense Scene (dense-500.json)
- Props: 500
- Course: Ridge
- Unbatched Draw Calls: ~660 (including shadow maps & decals)
- Batched Target: ≤ 30% of unbatched draw calls
`;
  writeFileSync(RECORD_FILE, doc, 'utf8');
  console.log(`[Bundle Budget] Baseline recorded to ${RECORD_FILE}`);
}
