/**
 * Edge & magenta-key audit for every PNG in the project.
 *
 * Verifies what the user-facing art promises:
 *   1. runtime sprites contain no residual matte-magenta pixels ("bleed
 *      through" when the #FF00FF matte is keyed), neither opaque holes left
 *      inside the silhouette nor magenta spill on the alpha fringe;
 *   2. alpha sprites have clean, anti-aliased edges (no hard binary-alpha
 *      stair-stepping);
 *   3. raw matte-backed source sheets are allowed to hold magenta and are only
 *      counted, never failed.
 *
 * Usage: node scripts/check-edge-magenta.mjs
 * Exit 0 when every runtime sprite is clean, 1 otherwise.
 * Writes tests/artifacts/edge-magenta-report.json.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  walkPngs, classify, decodePng, auditPixels, hardEdgeRatio, relOf,
  rawCounterpart, backgroundMask, rawResidualCount,
} from './edge-magenta-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

// Max share of the silhouette boundary that may be a hard 255-vs-0 step.
const HARD_EDGE_MAX = 0.5;

function main() {
  const files = [...walkPngs(join(root, 'public')), ...walkPngs(join(root, 'PreGame'))].sort();
  const report = { runtime: [], source: [], legacy: [], failures: [] };

  for (const file of files) {
    const rel = relOf(root, file);
    let decoded;
    try {
      decoded = decodePng(file);
    } catch (err) {
      report.failures.push({ file: rel, reason: `decode error: ${err.message}` });
      continue;
    }
    const audit = auditPixels(decoded.w, decoded.h, decoded.data);
    const cls = classify(rel);
    let rawResidual = 0;
    const rawRel = cls === 'runtime' ? rawCounterpart(rel) : null;
    if (rawRel && existsSync(join(root, rawRel))) {
      try {
        const raw = decodePng(join(root, rawRel));
        if (raw.w === decoded.w && raw.h === decoded.h)
          rawResidual = rawResidualCount(decoded.w, decoded.h, decoded.data, backgroundMask(raw.w, raw.h, raw.data));
      } catch { /* raw missing */ }
    }
    const row = { file: rel, w: decoded.w, h: decoded.h, class: cls, ...audit, rawResidual, hardEdge: +hardEdgeRatio(audit).toFixed(3) };

    if (cls === 'source') report.source.push(row);
    else if (cls === 'legacy') report.legacy.push(row);
    else {
      report.runtime.push(row);
      if (audit.holes > 0)
        report.failures.push({ file: rel, reason: `residual matte-magenta pixels (bleed-through): ${audit.holes}` });
      if (rawResidual > 0)
        report.failures.push({ file: rel, reason: `opaque backdrop left inside silhouette (raw-scan proof): ${rawResidual}px` });
      if (audit.spillSemi + audit.spillEdge > 0)
        report.failures.push({ file: rel, reason: `magenta spill on alpha fringe: ${audit.spillSemi + audit.spillEdge}px` });
      if (audit.transpBleed > 0)
        report.failures.push({ file: rel, reason: `matte RGB stored in transparent fringe (bleeds under scaling): ${audit.transpBleed}px` });
      if (row.hardEdge > HARD_EDGE_MAX)
        report.failures.push({ file: rel, reason: `hard aliased edge (${(row.hardEdge * 100).toFixed(0)}% of boundary is un-feathered 255-vs-0 steps)` });
    }
  }

  const outDir = join(root, 'tests', 'artifacts');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'edge-magenta-report.json'), JSON.stringify(report, null, 2));

  const flaggedRuntime = new Set(report.failures.map((f) => f.file));
  console.log(`PNG audit: ${files.length} files (${report.runtime.length} runtime, ${report.source.length} source sheets, ${report.legacy.length} legacy)\n`);

  console.log('Runtime sprites with bleed or hard edges:');
  const bad = report.runtime.filter((r) => flaggedRuntime.has(r.file));
  if (bad.length === 0) console.log('  none — every runtime sprite is clean.');
  for (const r of bad) {
    console.log(`  ${r.file.padEnd(62)} holes=${String(r.holes).padStart(6)} spill=${String(r.spillSemi + r.spillEdge).padStart(6)} hardEdge=${r.hardEdge}`);
  }

  console.log('\nSource sheets holding matte (expected, not failed):');
  const srcWith = report.source.filter((s) => s.holes > 0 || s.spillSemi + s.spillEdge > 0);
  console.log(`  ${srcWith.length} of ${report.source.length} source files contain magenta matte.`);

  const legacyMag = report.legacy.filter((l) => l.holes > 0);
  if (legacyMag.length) {
    console.log(`\nLegacy (PreGame, archived — reported only): ${legacyMag.length} files still carry matte pixels:`);
    for (const l of legacyMag) console.log(`  ${l.file.padEnd(62)} holes=${l.holes}`);
  }

  console.log(`\nFAILURES: ${report.failures.length}`);
  for (const f of report.failures) console.log(`  ✗ ${f.file}: ${f.reason}`);

  process.exit(report.failures.length > 0 ? 1 : 0);
}

main();
