/**
 * M2: the shipped art has a size budget, so it can only shrink from here. The budget is the size on
 * 2026-09-25 (578 MB of public/, the largest single file 20.5 MB) plus a little headroom for the
 * art being rebuilt; `node scripts/art-size-report.mjs` lists what is big and what nothing references.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The whole of public/ (everything Vite copies into the build). */
export const PUBLIC_BUDGET_BYTES = 600 * 1048576;
/** No single shipped file may be bigger than this. */
export const FILE_BUDGET_BYTES = 25 * 1048576;

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
function files(dir: string, out: { path: string; bytes: number }[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files(path, out); else out.push({ path, bytes: stat.size });
  }
  return out;
}

test('M2: public/ stays inside its size budget', () => {
  const all = files(publicDir);
  const total = all.reduce((sum, file) => sum + file.bytes, 0);
  assert.ok(total <= PUBLIC_BUDGET_BYTES,
    `public/ is ${(total / 1048576).toFixed(1)} MB, over the ${(PUBLIC_BUDGET_BYTES / 1048576).toFixed(0)} MB budget: compress or move sources to art-src/`);
});

test('M2: no single shipped file is over 25 MB', () => {
  const heavy = files(publicDir).filter((file) => file.bytes > FILE_BUDGET_BYTES);
  assert.deepEqual(heavy.map((file) => `${file.path} ${(file.bytes / 1048576).toFixed(1)} MB`), []);
});

test('M2: the size report runs and splits referenced from unreferenced art', async () => {
  const { artReport } = await import('../scripts/art-size-report.mjs');
  const report = artReport();
  assert.ok(report.files > 0);
  assert.equal(report.referencedBytes + report.unreferencedBytes, report.totalBytes);
  assert.ok(report.largest.length > 0 && report.largest[0].bytes >= report.largest[report.largest.length - 1].bytes);
});
