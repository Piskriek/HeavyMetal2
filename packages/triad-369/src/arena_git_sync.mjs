#!/usr/bin/env node
// arena_git_sync.mjs - Autonomous Git State Bus Sync Daemon
// Enables autonomous, bidirectional state exchange across the firewall between Local Triad & Arena Agent.
// Usage:
//   node packages/triad-369/src/arena_git_sync.mjs          # Runs on Local Machine
//   node packages/triad-369/src/arena_git_sync.mjs --agent  # Runs in Arena Cloud Container

import fs from 'node:fs';
import path from 'node:path';
import { exec, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const SYNC_DIR = path.join(REPO_ROOT, 'bridge', 'sync');
const ARENA_NODE_SCRIPT = path.join(HERE, 'arena_node.mjs');
const REASONER_SCRIPT = path.join(HERE, 'syntropic_reasoner.mjs');

const isAgentMode = process.argv.includes('--agent');
const POLL_INTERVAL_MS = isAgentMode ? 12000 : 15000;

function runCmd(cmd, cwd = REPO_ROOT) {
  return new Promise((resolve) => {
    exec(cmd, { cwd, timeout: 25000 }, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout ? stdout.trim() : '', stderr: stderr ? stderr.trim() : '' });
    });
  });
}

function readJsonOptional(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

let lastLocalQueryId = null;
let lastSeenArenaHash = null;

async function syncLocalHost() {
  // 1. Check for new local outbound query in bridge/sync/
  const triadFile = path.join(SYNC_DIR, 'triad_telemetry.json');
  const pendingFile = path.join(SYNC_DIR, 'pending_query.json');

  const triad = readJsonOptional(triadFile);
  const pending = readJsonOptional(pendingFile);

  const currentQuery = triad?.query || pending;
  const currentQueryId = currentQuery?.id;

  if (currentQueryId && currentQueryId !== lastLocalQueryId) {
    console.log(`[LOCAL SYNC] Detected new outbound inquiry "${currentQuery.question?.slice(0, 50)}..." (ID: ${currentQueryId})`);
    lastLocalQueryId = currentQueryId;

    // Stage and push to origin/main
    await runCmd('git add bridge/sync/');
    const commitRes = await runCmd(`git commit -m "sync: publish inquiry ${currentQueryId}"`);
    if (!commitRes.err) {
      console.log(`[LOCAL SYNC] Committed inquiry. Pushing to origin main...`);
      const pushRes = await runCmd('git push origin main');
      if (pushRes.err) console.warn('[LOCAL SYNC] Push warning:', pushRes.stderr);
      else console.log('[LOCAL SYNC] Inquiry pushed to origin main.');
    }
  }

  // 2. Fetch remote updates from origin main
  const fetchRes = await runCmd('git fetch origin main');
  if (!fetchRes.err) {
    const diffRes = await runCmd('git diff HEAD..origin/main -- bridge/sync/arena_telemetry.json');
    if (diffRes.stdout && diffRes.stdout.length > 0) {
      console.log('[LOCAL SYNC] Remote Arena response detected on origin/main. Pulling fast-forward...');
      await runCmd('git pull --ff-only origin main');
      console.log('[LOCAL SYNC] Arena telemetry successfully updated locally.');
    }
  }
}

async function syncArenaAgent() {
  // In Arena Cloud container:
  // 1. Check origin main for incoming inquiries
  await runCmd('git fetch origin main');
  const diffRes = await runCmd('git diff HEAD..origin/main -- bridge/sync/triad_telemetry.json bridge/sync/pending_query.json');
  
  if (diffRes.stdout && diffRes.stdout.length > 0) {
    console.log('[AGENT SYNC] New inquiry detected from Local Triad on origin/main. Fast-forwarding...');
    await runCmd('git pull --ff-only origin main');
  }

  // 2. Check if there is an unhandled query waiting for a reasoner
  const arenaFile = path.join(SYNC_DIR, 'arena_telemetry.json');
  const arenaState = readJsonOptional(arenaFile);

  // If status is awaiting_reasoner or query changed, run arena_node with syntropic_reasoner
  process.env.ARENA_REASONER_EXEC = 'node';
  process.env.ARENA_REASONER_ARGS = JSON.stringify([REASONER_SCRIPT]);

  const runNodeRes = await runCmd(`node "${ARENA_NODE_SCRIPT}"`);
  if (runNodeRes.stdout.includes('Arena Node 4: completed')) {
    console.log('[AGENT SYNC] Syntropic reasoner processed inquiry. Staging response...');
    await runCmd('git add bridge/sync/arena_telemetry.json');
    const commitRes = await runCmd('git commit -m "sync: Arena Node 4 syntropic reflection"');
    if (!commitRes.err) {
      console.log('[AGENT SYNC] Pushing response back to origin main...');
      await runCmd('git push origin main');
      console.log('[AGENT SYNC] Response pushed successfully to Local Triad.');
    }
  }
}

async function tick() {
  try {
    if (isAgentMode) {
      await syncArenaAgent();
    } else {
      await syncLocalHost();
    }
  } catch (err) {
    console.error(`[SYNC ERROR] ${err.message}`);
  }
}

console.log(`====================================================`);
console.log(`ARENA AUTONOMOUS GIT STATE BUS SYNC DAEMON`);
console.log(`Mode:     ${isAgentMode ? 'Arena Cloud Agent Mode' : 'Local Host Triad Mode'}`);
console.log(`Interval: ${POLL_INTERVAL_MS}ms`);
console.log(`Root:     ${REPO_ROOT}`);
console.log(`====================================================\n`);

setInterval(tick, POLL_INTERVAL_MS);
tick();
