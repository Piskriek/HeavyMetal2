/**
 * The gate every delivered zip must pass.
 *   node scripts/verify.mjs <package> [<package> ...]   typecheck + that package's tests + build   (what a task zip must pass)
 *   node scripts/verify.mjs                             typecheck + ALL tests + build              (what the integrator runs)
 * The build must produce ONE static html file (RUN loads a static build; there is no server).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
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
const patterns = only.length ? only.map((p) => `packages/${p}/tests/*.test.ts`) : ['packages/*/tests/*.test.ts'];
run(`tests (${only.length ? only.join(', ') : 'all packages'})`, 'node', ['--import', 'tsx', '--test', ...patterns]);
run('build', 'npm', ['run', 'build']);
const html = fileURLToPath(new URL('../apps/web/dist/index.html', import.meta.url));
if (!existsSync(html)) {
  console.error('FAILED: apps/web/dist/index.html is missing');
  process.exit(1);
}
console.log(`\nOK: apps/web/dist/index.html is ${(statSync(html).size / 1024).toFixed(0)} KB (one file). Deployable.`);
