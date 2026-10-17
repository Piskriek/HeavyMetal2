#!/usr/bin/env bash
# Runs a check on the 3D PC worker against THIS working tree, so uncommitted work can be tested there with no commit or push.
#   scripts/test-on-3dpc.sh "node scripts/test-ticket01-collision.mjs"
#   scripts/test-on-3dpc.sh "npm run build && node scripts/test-campaign.mjs"
# How: it snapshots the tree into a throwaway commit through a temporary index (the shared .git/index is never touched):
# every tracked change, plus new files under apps/, packages/ and scripts/. It pushes that commit straight to the worker
# over SSH (never to GitHub), checks it out there detached, runs `npm ci` if package-lock.json changed, then runs the command.
# One run at a time on the worker (a lock dir); the next run waits. Key: ~/.ssh/id_ed25519_fidelity (owner, 2026-10-17).
set -euo pipefail
cmd="${1:?usage: scripts/test-on-3dpc.sh \"<command>\"}"
root="$(git rev-parse --show-toplevel)"
cd "$root"
host=RAMPAGE@192.168.0.9
key="$HOME/.ssh/id_ed25519_fidelity"
export GIT_SSH_COMMAND="ssh -i $key -o BatchMode=yes -o ConnectTimeout=10 -o LogLevel=ERROR"

idx="$(mktemp)"
trap 'rm -f "$idx"' EXIT
cp "$(git rev-parse --git-path index)" "$idx"
GIT_INDEX_FILE="$idx" git add -u
GIT_INDEX_FILE="$idx" git add -- apps packages scripts 2>/dev/null || true
tree="$(GIT_INDEX_FILE="$idx" git write-tree)"
snap="$(git commit-tree "$tree" -p HEAD -m "worker snapshot of $(git rev-parse --short HEAD) + working tree")"
# GIT_LFS_SKIP_PUSH: the worker has its own LFS files (git lfs pull); the LFS pre-push upload would need git-lfs-authenticate there
GIT_LFS_SKIP_PUSH=1 git push -q -f "ssh://$host/c/MarbleGp" "$snap:refs/heads/worker-snapshot" 2>&1 | grep -v -e 'post-quantum' -e 'store now' -e 'openssh.com/pq' -e 'be upgraded' || true

ssh -i "$key" -o BatchMode=yes -o ConnectTimeout=10 -o LogLevel=ERROR "$host" "
  until mkdir /tmp/worker.lock 2>/dev/null; do sleep 5; done; trap 'rmdir /tmp/worker.lock' EXIT
  cd /c/MarbleGp && git checkout -q -- . && git checkout -q --detach $snap || exit 90
  want=\$(git hash-object package-lock.json); have=\$(cat node_modules/.lockhash 2>/dev/null || true)
  if [ \"\$want\" != \"\$have\" ]; then npm ci --no-audit --no-fund > /tmp/worker-ci.txt 2>&1 || { tail -5 /tmp/worker-ci.txt; exit 91; }; echo \"\$want\" > node_modules/.lockhash; fi
  echo \"[worker] testing snapshot $snap\"
  $cmd
"
