/**
 * Goblin Rally verification pass: type-check the app, type-check the T04 suites, then run the
 * focused recovery-, parity- and qualifying-contract tests. Mirrors the predecessor project's
 * check script.
 *
 * Each test file is an independent suite with no shared state, so any of them can also be run on
 * its own: `node --import tsx --test tests/physics-parity.test.ts`
 *
 * Usage: node scripts/check.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(new URL('../tests/artifacts/', import.meta.url), { recursive: true });
const commands = [
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tests'],
  ['--import', 'tsx', '--test', '--test-reporter=tap', '--test-reporter-destination=stdout',
    '--test-reporter=tap', '--test-reporter-destination=tests/artifacts/latest-test-run.tap',
    'tests/session-save.test.ts', 'tests/camera-decal.test.ts', 'tests/ticket05-backdrop.test.ts',
    'tests/first-person.test.ts', 'tests/eye-level-audit.test.ts',
    'tests/start-push.test.ts', 'tests/start-zone.test.ts',
    'tests/cockpit.test.ts', 'tests/cockpit-trinkets.test.ts', 'tests/scene-kit.test.ts', 'tests/painted-icons.test.ts', 'tests/painted-parts.test.ts',
    'tests/time-scale.test.ts', 'tests/builder-ramps.test.ts', 'tests/start-node.test.ts',
    'tests/lane-gizmo-follow.test.ts', 'tests/ball-size.test.ts', 'tests/fp-lean.test.ts', 'tests/split-queue.test.ts', 'tests/lane-rope.test.ts', 'tests/placement-course.test.ts', 'tests/obstacle-view.test.ts',
    'tests/effects.test.ts', 'tests/depth-mask.test.ts', 'tests/painted-goblin.test.ts', 'tests/island-route.test.ts', 'tests/route-graph.test.ts', 'tests/route-layout.test.ts',
    'tests/gyro-ball.test.ts',
    'tests/merge-pool.test.ts', 'tests/merge-race.test.ts', 'tests/merge-runup.test.ts',
    'tests/contracts.test.ts',
    'tests/multi-select-grouping.test.ts', 'tests/track-props-backup.test.ts', 'tests/track-space.test.ts',
    'tests/track-builder-validation.test.ts',
    'tests/physics-parity.test.ts', 'tests/qualifying-gate.test.ts', 'tests/qualifying-attempt.test.ts',
    'tests/qualifying-session.test.ts',
    'tests/release-grid.test.ts', 'tests/release-scheduler.test.ts', 'tests/release-go-clock.test.ts',
    'tests/staging-lifecycle.test.ts', 'tests/staging-presentation.test.ts',
    'tests/collision.test.ts',
    'tests/track-storage.test.ts',
    'tests/lane-network.test.ts', 'tests/lane-storage.test.ts', 'tests/lane-parity.test.ts',
    'tests/lane-edit.test.ts', 'tests/lane-gizmo.test.ts', 'tests/lane-builder.test.ts',
    'tests/lane-paint.test.ts', 'tests/lane-successor.test.ts',
    'tests/cockpit-channel.test.ts', 'tests/pickup-view.test.ts',
    'tests/effect-coverage.test.ts', 'tests/camera-shake.test.ts',
    'tests/lane-panel.test.tsx',
    'tests/merge-split.test.ts',
    'tests/t09-wall-pickups.test.ts',
    'tests/cube-sphere.test.ts',
    'tests/dent-rolling.test.ts',
    'tests/animated-props.test.ts',
    'tests/keymap.test.ts',
    'tests/history.test.ts',
    'tests/storage-v2.test.ts',
    'tests/gizmo-math.test.ts',
    'tests/selection.test.ts',
    'tests/gizmo-adapter.test.ts',
    'tests/camera-rig.test.ts',
    'tests/model-import.test.ts',
    'tests/asset-db.test.ts',
    'tests/materials.test.ts',
    'tests/terrain-patch.test.ts',
    'tests/patch-parity.test.ts',
    'tests/postfx-budget.test.ts',
    'tests/postfx-pipeline.test.ts',
    'tests/baker.test.ts',
    'tests/batcher.test.ts',
    'tests/export.test.ts',
    'tests/protect-baseline.test.ts', 'tests/props-safety-copy.test.ts',
    'tests/accessibility.test.ts', 'tests/racer-pool.test.ts', 'tests/roster-scale.test.ts',
    'tests/integration-benchmarks.test.ts', 'tests/cpu-tactics.test.ts',
    'tests/seeded-race.test.ts', 'tests/touch-controls.test.tsx', 'tests/guide-text.test.ts', 'tests/gamepad.test.ts', 'tests/hit-feedback.test.ts', 'tests/gap-readout.test.ts', 'tests/wall-scrape.test.ts', 'tests/test-drive-bar.test.tsx', 'tests/oob-reel.test.ts', 'tests/art-budget.test.ts', 'tests/meta-contracts.test.ts', 'tests/goblin-dna.test.ts', 'tests/sphere-baker.test.ts', 'tests/det-math.test.ts', 'tests/chroma-key.test.ts', 'tests/ball-texture-pool.test.ts', 'tests/goblin-creator.test.tsx', 'tests/ball-design.test.tsx', 'tests/garage-decal-art.test.ts'],
];

for (const args of commands) {
  const binary = args[0].startsWith('node_modules') ? process.execPath : process.execPath;
  const proc = spawnSync(binary, args, { cwd, stdio: 'inherit' });
  if (proc.status !== 0) {
    process.exit(proc.status ?? 1);
  }
}
