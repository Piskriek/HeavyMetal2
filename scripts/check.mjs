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
    'tests/multi-select-grouping.test.ts', 'tests/track-props-backup.test.ts', 'tests/track-space.test.ts',
    'tests/track-builder-validation.test.ts',
    'tests/physics-parity.test.ts', 'tests/qualifying-gate.test.ts', 'tests/qualifying-attempt.test.ts',
    'tests/qualifying-session.test.ts',
    'tests/release-grid.test.ts', 'tests/release-scheduler.test.ts', 'tests/release-go-clock.test.ts',
    'tests/staging-lifecycle.test.ts', 'tests/staging-presentation.test.ts'],
];

for (const args of commands) {
  const binary = args[0].startsWith('node_modules') ? process.execPath : process.execPath;
  const proc = spawnSync(binary, args, { cwd, stdio: 'inherit' });
  if (proc.status !== 0) {
    process.exit(proc.status ?? 1);
  }
}
