#!/usr/bin/env node
/**
 * Legacy entry point retained for artists who used the old fringe-only command.
 * The fringe now shares its palette, alpha treatment, edge sealing, and build
 * process with every track material, so delegate to the unified generator.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, ['scripts/generate-stylized-track-textures.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
