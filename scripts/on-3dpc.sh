#!/usr/bin/env bash
# Runs a command on the 3D PC worker (RAMPAGE@192.168.0.9, Git Bash, repo at C:\MarbleGp -> E:\MarbleGp) after
# fast-forwarding it to origin, so heavy checks (npm test, builds, browser tests, battle oracles) leave the laptop free.
#   scripts/on-3dpc.sh "npm test"
#   scripts/on-3dpc.sh "npm run build && node scripts/test-campaign.mjs"
# Push first: the worker pulls origin's current branch. It never commits or pushes. Key: ~/.ssh/id_ed25519_fidelity (owner, 2026-10-17).
set -euo pipefail
cmd="${1:?usage: scripts/on-3dpc.sh \"<command>\"}"
ssh -i ~/.ssh/id_ed25519_fidelity -o BatchMode=yes -o ConnectTimeout=10 RAMPAGE@192.168.0.9 \
  "cd /c/MarbleGp && git pull -q --ff-only && $cmd" \
  2> >(grep -v -e 'post-quantum' -e 'store now' -e 'openssh.com/pq' -e 'be upgraded' >&2)
