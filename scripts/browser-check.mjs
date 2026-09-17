/**
 * Builds the app, then runs the browser-level checks against dist/.
 * Usage: node scripts/browser-check.mjs [art]
 *   (no argument) recovery flow: reload, restore, corrupt saves, denied storage
 *   art           Part 4.2 art integration: painted portraits, shells, pickups, course art
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv[2] === 'art' ? 'tests/art-check.mjs' : 'tests/browser-recovery.mjs';
for (const args of [
  ['node_modules/vite/bin/vite.js', 'build'],
  [target],
]) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', timeout: 420000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
