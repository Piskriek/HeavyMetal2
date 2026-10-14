// ============================================================================
// File: scripts/verify-argo-milestones.mjs
// Purpose: Master verification gate for all 10 Owner Decisions (DEC-01..DEC-10)
//          and Sidecar Briefs 25-33 (Milestones B, C, D, E).
// Usage:   node scripts/verify-argo-milestones.mjs
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REQUIRED_DROP_IN_FILES = [
  'packages/hudlayout/src/nine-zone-grid.ts',
  'apps/web/src/shell/hud-9zone.css',
  'apps/web/src/shell/build-ribbon-drawer.tsx',
  'packages/plotsim/src/safe-dome-and-brownout.ts',
  'packages/substrate/src/guaranteed-anti-softlock.ts',
  'apps/web/src/base/foundation-frame-view.ts',
  'packages/groundshader/src/stage-post.glsl.ts',
  'packages/camerarig/src/rover-spring-arm.ts',
  'apps/web/src/avatar/avatar-stage-rig.ts',
  'packages/kart/src/modular-scout-fit.ts',
  'apps/web/src/lab/lab-choreography.ts',
  'apps/web/src/lab/vista-spheres-and-breach.ts',
  'apps/web/src/shell/main-menu-live-backdrop.tsx',
  'packages/content/src/forensic-clutter-logs.ts',
  'apps/web/src/audio/five-bus-mixer.ts',
  'packages/soundpack/src/procedural-action-sfx.ts',
  'packages/shareware/src/sub-bass-reinforcer.ts',
  'packages/tooljuice/src/interaction-juice-recipes.ts',
  'packages/shareware/src/fidelity-mob-shader.ts',
  'apps/web/src/play/glitch-rift-column.ts',
  'packages/groundshader/src/radial-scan-wave.ts',
  'apps/web/src/crafter/plume-point-lights.ts',
  'apps/web/src/studio/asset-bench-4angle-and-sockets.tsx',
  'apps/web/src/studio/act5-lab-schema-terminal.tsx',
  'packages/structure/src/hologram-lock-and-nudge.ts',
  'packages/plotsim/src/heavy-terraformers-and-turrets.ts',
  'packages/assembler/src/companion-drone-splicer.ts',
  'packages/content/src/charm-and-act789.ts',
  'packages/plotterrain/src/curated-lunar-basin.ts',
  'packages/groundshader/src/blob47-and-polish.ts',
  'packages/hydro/src/stage34-water-and-shoreline.ts',
  'packages/treegen/src/stage56-lsystem-canopy.ts',
  'apps/web/src/shell/bridge-archive-rumor-graph.tsx',
  'scripts/e2e-hud-and-luminance-gate.mjs',
  'scripts/quantize-inline-low-glb.mjs',
  'scripts/triage-overnight-batch.mjs',
];

const MAX_DIST_HTML_BYTES = 16.0 * 1024 * 1024; // 16.0 MB hard ceiling (DEC-10 / POL-27)

export function verifyArgoMilestones(repoRoot = process.cwd(), runTests = false) {
  const missingFiles = [];
  for (const rel of REQUIRED_DROP_IN_FILES) {
    if (!fs.existsSync(path.join(repoRoot, rel))) {
      missingFiles.push(rel);
    }
  }

  let distHtmlBytes = 0;
  let distUnderCap = true;
  const distPath = path.join(repoRoot, ' apps/web/dist/index.html'.trim());
  if (fs.existsSync(distPath)) {
    distHtmlBytes = fs.statSync(distPath).size;
    distUnderCap = distHtmlBytes <= MAX_DIST_HTML_BYTES;
  }

  if (runTests && missingFiles.length === 0) {
    execSync('npx vitest run', { stdio: 'inherit', cwd: repoRoot });
  }

  return {
    allFilesPresent: missingFiles.length === 0,
    missingFiles,
    distHtmlMB: Number((distHtmlBytes / (1024 * 1024)).toFixed(2)),
    distUnderCap,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runTests = process.argv.includes('--test');
  const report = verifyArgoMilestones(process.cwd(), runTests);
  console.log('[verify-argo-milestones]', JSON.stringify(report, null, 2));
  if (!report.allFilesPresent || !report.distUnderCap) {
    process.exit(1);
  }
}
