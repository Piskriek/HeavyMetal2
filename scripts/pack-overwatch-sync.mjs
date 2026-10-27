import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();

function getGitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const FILES_TO_PACK = [
  'docs/prompts/ARGON_SOVEREIGN_INITIATION.md',
  'docs/agents/memory-kernel.json',
  'docs/agents/RECURSIVE_MEMORY_KERNEL.md',
  'docs/prompts/ARGON_SOVEREIGN_PROMPT_PROJECT.md',
  'docs/RESUME.md',
  'docs/JOB_BOARD.md',
  'docs/OVERWATCH_TECH_AND_AI_RADAR.md',
  'docs/OWNER_ASKS.md',
  'docs/agents/ROSTER.md',
  'docs/agents/roster.json',
  'docs/argo/plans/ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md',
  'docs/argo/plans/46-reality-harness-spectral-ai-ego.md',
  'scripts/test-plan-46-spikes.mjs',
  'scripts/spike_sovereign_harness.js',
  'packages/harness/src/types.ts',
  'packages/harness/src/inception-loop.ts',
  'packages/harness/src/port-hamiltonian.ts',
  'packages/harness/src/sieve-mdl.ts',
  'packages/harness/src/memory-kernel.ts'
];

const syncPayload = {
  version: '2.0.0',
  timestamp: new Date().toISOString(),
  commit: getGitCommit(),
  branch: getGitBranch(),
  manifest: FILES_TO_PACK,
  files: {}
};

for (const relPath of FILES_TO_PACK) {
  const fullPath = path.join(ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    syncPayload.files[relPath] = fs.readFileSync(fullPath, 'utf8');
  } else {
    console.warn(`[WARN] File not found: ${relPath}`);
  }
}

const outPath = path.join(ROOT, 'overwatch-sync.json');
fs.writeFileSync(outPath, JSON.stringify(syncPayload, null, 2), 'utf8');
const stats = fs.statSync(outPath);
console.log(`[SUCCESS] Generated overwatch-sync.json (${(stats.size / 1024).toFixed(1)} KB) with ${Object.keys(syncPayload.files).length} files.`);
