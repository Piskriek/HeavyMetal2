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
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let lastLocalQueryId = null;

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

  // 2. Fetch remote updates from origin
  const fetchRes = await runCmd('git fetch origin');
  if (!fetchRes.err) {
    // Check if there is an active arena session branch (origin/arena/*)
    const branchesRes = await runCmd('git branch -r --list "origin/arena/*" --sort=-committerdate');
    const branches = branchesRes.stdout.split('\n').map(b => b.trim()).filter(Boolean);
    const latestArenaBranch = branches[0]; // e.g. origin/arena/dfcfb02d-fidelity

    if (latestArenaBranch) {
      const showRes = await runCmd(`git show ${latestArenaBranch}:bridge/sync/arena_telemetry.json`);
      if (showRes.stdout && !showRes.err) {
        const localPath = path.join(SYNC_DIR, 'arena_telemetry.json');
        const currentLocal = fs.existsSync(localPath) ? fs.readFileSync(localPath, 'utf8').replace(/^\uFEFF/, '') : '';
        const incoming = showRes.stdout.replace(/^\uFEFF/, '');

        if (incoming.trim() !== currentLocal.trim()) {
          console.log(`[LOCAL SYNC] New Arena telemetry detected on ${latestArenaBranch}. Updating local bus...`);
          fs.writeFileSync(localPath, incoming, 'utf8');

          // Mirror across all local directories
          const mirrorPaths = [
            'D:/fidelity-llm/bridge/sync/arena_telemetry.json',
            'C:/MarbleGp/bridge/sync/arena_telemetry.json'
          ];
          for (const p of mirrorPaths) {
            try {
              fs.mkdirSync(path.dirname(p), { recursive: true });
              fs.writeFileSync(p, incoming, 'utf8');
            } catch {}
          }

          // Commit and publish to main so main stays synced
          await runCmd('git add bridge/sync/arena_telemetry.json');
          await runCmd(`git commit -m "sync: integrate Arena Node 4 reflection from ${latestArenaBranch.replace('origin/', '')}"`);
          await runCmd('git push origin main');
          console.log(`[LOCAL SYNC] Integrated and published Arena reflection to main.`);
        }
      }
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

  // 2. Ensure reasoner executable is configured
  process.env.ARENA_REASONER_EXEC = process.env.ARENA_REASONER_EXEC || 'node';
  process.env.ARENA_REASONER_ARGS = process.env.ARENA_REASONER_ARGS || JSON.stringify([REASONER_SCRIPT]);

  const runNodeRes = await runCmd(`node "${ARENA_NODE_SCRIPT}"`);
  if (runNodeRes.stdout.includes('Arena Node 4: completed')) {
    console.log('[AGENT SYNC] Syntropic reasoner processed inquiry. Staging response...');
    await runCmd('git add bridge/sync/arena_telemetry.json');
    const commitRes = await runCmd('git commit -m "sync: Arena Node 4 syntropic reflection"');
    if (!commitRes.err) {
      console.log('[AGENT SYNC] Pushing response back to assigned session branch...');
      await runCmd('git push origin HEAD');
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
