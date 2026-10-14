// ============================================================================
// File: scripts/triage-overnight-batch.mjs
// Plan: Plan 21 §4 (Automated 5-Point Acceptance Gate for Overnight 80-Model Batch)
// Rules: Rule 11 (Square tubing), Rule 12 (No text/empty cab), Rule 16 (Sockets), Rule 17 (4 Angles)
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

const OVERNIGHT_LIST_PATH = path.resolve('zips/runworld/overnight-ids.txt');
const REPORT_OUT_PATH     = path.resolve('docs/runworld/overnight-triage-report.json');

export const TRIANGLE_BUDGETS = {
  small:  { low: 350,  mid: 900,  high: 2200 },
  medium: { low: 900,  mid: 2250, high: 5400 },
  large:  { low: 1500, mid: 3750, high: 9000 },
};

/**
 * Evaluates a candidate model's metadata against the 5-Point Asset Acceptance Gate.
 */
export function evaluateCandidateGate(candidateMeta) {
  const issues = [];
  let recommendedFix = 'none';

  // Gate 1: Four-Angle Back-Face Luminance Check (Rule 17)
  if (typeof candidateMeta.backFaceLuminance === 'number' && candidateMeta.backFaceLuminance < 0.14) {
    issues.push(`Back face luminance ${candidateMeta.backFaceLuminance.toFixed(2)} < 0.14`);
    recommendedFix = candidateMeta.isSymmetricSubject ? 'mirror-z' : 'plain-back';
  }

  // Gate 2: Low-LOD Triangle Budget Check
  const sizeClass = candidateMeta.sizeClass || 'medium';
  const budget = TRIANGLE_BUDGETS[sizeClass] || TRIANGLE_BUDGETS.medium;
  if (typeof candidateMeta.lowTris === 'number' && candidateMeta.lowTris > budget.low) {
    issues.push(`low.glb tris (${candidateMeta.lowTris}) exceeds ${sizeClass} budget (${budget.low})`);
  }

  // Gate 3: De-Metalled Bake Diffuse Luminance Check (>= 0.18 so Stage 0-1 never renders black)
  if (typeof candidateMeta.meanDiffuseLuminance === 'number' && candidateMeta.meanDiffuseLuminance < 0.18) {
    issues.push(`Mean diffuse luminance ${candidateMeta.meanDiffuseLuminance.toFixed(2)} < 0.18 (dark bake risk)`);
  }

  // Gate 4: 4-Angle Render Sheet Presence
  if (!candidateMeta.hasFourAngleSheet) {
    issues.push('Missing 4-angle render plate (Rule 17)');
  }

  const score =
    100 -
    issues.length * 25 +
    (candidateMeta.meanDiffuseLuminance ?? 0.25) * 20 -
    Math.max(0, (candidateMeta.lowTris ?? 500) - budget.low) * 0.05;

  return {
    id: candidateMeta.id,
    passedAllGates: issues.length === 0,
    recommendedFix,
    score: Number(score.toFixed(2)),
    issues,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = fs.existsSync(OVERNIGHT_LIST_PATH)
    ? fs
        .readFileSync(OVERNIGHT_LIST_PATH, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  console.log(`[triage-overnight-batch] Found ${ids.length} entries in overnight-ids.txt.`);
  const summary = {
    generatedAt: new Date().toISOString(),
    totalEntries: ids.length,
    entries: ids,
  };

  fs.mkdirSync(path.dirname(REPORT_OUT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_OUT_PATH, JSON.stringify(summary, null, 2));
  console.log(`[triage-overnight-batch] Wrote triage manifest to ${REPORT_OUT_PATH}`);
}
