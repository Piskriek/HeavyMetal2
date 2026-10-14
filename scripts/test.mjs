/**
 * The unit suite: `npm test`, and the test step of scripts/verify.mjs. One list of test files, run in two passes:
 *  1. every test at once, except the speed tests (named `performance: ...`);
 *  2. the speed tests, one file at a time. Timed while every other file runs at once they swing by 4x: inside one big
 *     run, fieldkit's 80 ms build took 120 ms and plotgrid's one-second layout 1.5 s (TASK-22b, 14 October 2026).
 *   node scripts/test.mjs              the whole list
 *   node scripts/test.mjs <glob> [...]  only these files (both passes)
 */
import { spawnSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every unit test file. A new test folder goes here (and nowhere else: verify.mjs and npm test both read this list). */
export const TEST_FILES = [
  'packages/*/tests/*.test.ts',
  'apps/web/src/build/*.test.ts',
  'apps/web/src/build/ways/*.test.ts',
  'apps/web/src/storage/*.test.ts',
  'apps/web/src/islands/*.test.ts',
  'apps/web/src/crafter/*.test.ts',
  'apps/web/src/base/*.test.ts',
  'apps/web/src/base/ui/*.test.ts',
  'apps/web/src/play/*.test.ts',
  'apps/web/src/avatar/astro/*.test.ts',
  'apps/web/src/avatar/scientist/*.test.ts',
  'apps/web/src/edition.test.ts',
  'apps/web/studio-server/*.test.ts',
  'apps/web/src/assets/gen-tweak.test.ts',
  'apps/web/src/studio/*.test.ts',
  'apps/web/src/monsters/*.test.ts',
];

const root = fileURLToPath(new URL('../', import.meta.url));

/** Runs both passes over the files the globs match; true when both pass. */
export function runTests(globs = TEST_FILES) {
  const files = globSync(globs, { cwd: root }).map((f) => f.split(path.sep).join('/')).sort();
  const pass = (label, args) => {
    console.log(`\n== ${label}`);
    return spawnSync(process.execPath, ['--import', 'tsx', '--test', ...args], { cwd: root, stdio: 'inherit' }).status === 0;
  };
  const all = pass(`tests (${files.length} files, speed tests after)`, ['--test-skip-pattern=^performance:', ...globs]);
  const timed = files.filter((f) => /test\('performance:/.test(readFileSync(path.join(root, f), 'utf8')));
  const speed = timed.length === 0 || pass(`speed tests, one file at a time (${timed.length} files)`, ['--test-concurrency=1', '--test-name-pattern=^performance:', ...timed]);
  return all && speed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const globs = process.argv.slice(2);
  process.exit(runTests(globs.length ? globs : TEST_FILES) ? 0 : 1);
}
