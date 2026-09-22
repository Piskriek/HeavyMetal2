/**
 * Goblin Rally verification pass: type-check the app, then run the focused
 * recovery-contract tests. Mirrors the predecessor project's check script.
 * Usage: node scripts/check.mjs
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(new URL('../tests/artifacts/', import.meta.url), { recursive: true });
const commands = [
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['--import', 'tsx', '--test', '--test-reporter=tap', '--test-reporter-destination=stdout',
    '--test-reporter=tap', '--test-reporter-destination=tests/artifacts/latest-test-run.tap',
    'tests/session-save.test.ts', 'tests/camera-decal.test.ts', 'tests/ticket05-backdrop.test.ts',
    'tests/multi-select-grouping.test.ts', 'tests/track-props-backup.test.ts', 'tests/track-space.test.ts',
    'tests/track-builder-validation.test.ts'],
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', timeout: 420000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
