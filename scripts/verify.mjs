/**
 * The gate every delivered zip must pass.
 *   node scripts/verify.mjs <package> [<package> ...]   typecheck + that package's tests + build   (what a task zip must pass)
 *   node scripts/verify.mjs                             typecheck + ALL tests + build              (what the integrator runs)
 * The build must produce ONE static html file (RUN loads a static build; there is no server).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const only = process.argv.slice(2);
const sh = process.platform === 'win32';
const run = (label, cmd, args) => {
  console.log(`\n== ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: sh });
  if (r.status !== 0) {
    console.error(`\nFAILED: ${label}`);
    process.exit(r.status ?? 1);
  }
};
run('typecheck', 'npm', ['run', 'typecheck']);
const packages = only.length ? only : readdirSync(fileURLToPath(new URL('../packages', import.meta.url)));
const patterns = packages.map((p) => `packages/${p}/tests/*.test.ts`);
run(`tests (${only.length ? only.join(', ') : 'all packages'})`, 'node', ['--import', 'tsx', '--test', '--test-skip-pattern=^performance:', ...(only.length ? patterns : ['packages/*/tests/*.test.ts', 'apps/web/src/build/ways/*.test.ts'])]);
// speed tests (named `performance: ...`) run alone afterwards: timed while every other test file runs at once they swing by 4x
const timed = packages.flatMap((p) => {
  const dir = fileURLToPath(new URL(`../packages/${p}/tests`, import.meta.url));
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.test.ts') && /test\('performance:/.test(readFileSync(`${dir}/${f}`, 'utf8'))).map((f) => `packages/${p}/tests/${f}`) : [];
});
if (timed.length) run('speed tests, one at a time', 'node', ['--import', 'tsx', '--test', '--test-concurrency=1', '--test-name-pattern=^performance:', ...timed]);
run('build', 'npm', ['run', 'build']);
const html = fileURLToPath(new URL('../apps/web/dist/index.html', import.meta.url));
if (!existsSync(html)) {
  console.error('FAILED: apps/web/dist/index.html is missing');
  process.exit(1);
}
console.log(`\nOK: apps/web/dist/index.html is ${(statSync(html).size / 1024).toFixed(0)} KB (one file). Deployable.`);
