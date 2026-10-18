#!/usr/bin/env bash
# Runs a command on the 3D PC worker (RAMPAGE@$WORKER_IP from scripts/worker.env, Git Bash, repo at C:\MarbleGp -> E:\MarbleGp) against the
# PUSHED branch: it resets the worker's leftovers, checks out this laptop's current branch there, fast-forwards it to origin,
# runs `npm ci` if package-lock.json changed, then runs the command. Heavy checks (npm test, builds, browser tests, battle
# oracles) then leave the laptop free.
#   scripts/on-3dpc.sh "npm test"
#   scripts/on-3dpc.sh "npm run build && node scripts/test-campaign.mjs"
# Push first. To test uncommitted work instead, use scripts/test-on-3dpc.sh. The worker never commits or pushes; builds and
# browser tests rewrite tracked files there (dist/index.html, docs/shots), and those leftovers are reset before each run.
# One run at a time on the worker (a lock dir shared with test-on-3dpc.sh). Key: ~/.ssh/id_ed25519_fidelity (owner, 2026-10-17).
set -euo pipefail
cmd="${1:?usage: scripts/on-3dpc.sh \"<command>\"}"
branch="$(git rev-parse --abbrev-ref HEAD)"
. "$(git rev-parse --show-toplevel)/scripts/worker.env"; WORKER_IP="${WORKER_IP%$'\r'}"
ssh -i ~/.ssh/id_ed25519_fidelity -o BatchMode=yes -o ConnectTimeout=10 -o LogLevel=ERROR "RAMPAGE@${WORKER_IP}" "
  until mkdir /tmp/worker.lock 2>/dev/null; do sleep 5; done; trap 'rmdir /tmp/worker.lock' EXIT
  cd /c/MarbleGp && git checkout -q -- . && git checkout -q $branch && git pull -q --ff-only || exit 90
  want=\$(git hash-object package-lock.json); have=\$(cat node_modules/.lockhash 2>/dev/null || true)
  if [ \"\$want\" != \"\$have\" ]; then npm ci --no-audit --no-fund > /tmp/worker-ci.txt 2>&1 || { tail -5 /tmp/worker-ci.txt; exit 91; }; echo \"\$want\" > node_modules/.lockhash; fi
  $cmd
"
