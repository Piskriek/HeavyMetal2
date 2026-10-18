#!/usr/bin/env bash
# Runs a check on the 3D PC worker against THIS working tree, so uncommitted work can be tested there with no commit or push.
#   scripts/test-on-3dpc.sh "node scripts/test-ticket01-collision.mjs"
#   scripts/test-on-3dpc.sh "npm run build && node scripts/test-campaign.mjs"
# How: it snapshots the tree into a throwaway commit through a temporary index (the shared .git/index is never touched):
# every tracked change, plus new files under apps/, packages/ and scripts/. It pushes that commit straight to the worker
# over SSH (never to GitHub), checks it out there detached, runs `npm ci` if package-lock.json changed, then runs the command.
# One run at a time on the worker (a lock dir); the next run waits. Key: ~/.ssh/id_ed25519_fidelity (owner, 2026-10-17).
# Two workers share this tree, so a whole-tree snapshot can carry the other worker's half-done edits. Pass
# --only "<paths>" to snapshot HEAD plus just your own files:
#   scripts/test-on-3dpc.sh --only "apps/web/src/base apps/web/src/play/play.tsx" "node scripts/test-machine-inspector.mjs"
# When the worker is busy (its lock is held) or unreachable, the run goes to the LAPTOP at once instead of waiting (owner,
# 2026-10-18: "run on the laptop if the local pc is busy"). The laptop has its own lock (.git/laptop-test.lock), so two
# laptop runs never overlap; if both machines are busy, it waits for whichever frees first. A laptop run uses the shared
# working tree as it is (other agents' uncommitted edits included), not the snapshot: if it fails outside your files, re-run
# with --worker-only. Use --worker-only too for timings, which need the worker's clean snapshot and steady machine.
set -euo pipefail
# The body is one function, so bash parses all of it before running: editing this file while a run is in progress
# cannot break that run (2026-10-18: a mid-run edit made bash read on from its old offset into the new text).
main() {
only=""; worker_only=""
while [ "${1:-}" = "--only" ] || [ "${1:-}" = "--worker-only" ]; do
  if [ "$1" = "--only" ]; then only="${2:?--only needs a quoted list of paths}"; shift 2; else worker_only=1; shift; fi
done
cmd="${1:?usage: scripts/test-on-3dpc.sh [--only \"<paths>\"] [--worker-only] \"<command>\"}"
root="$(git rev-parse --show-toplevel)"
cd "$root"
. "$root/scripts/worker.env"; WORKER_IP="${WORKER_IP%$'\r'}"
host="RAMPAGE@${WORKER_IP}"
key="$HOME/.ssh/id_ed25519_fidelity"
export GIT_SSH_COMMAND="ssh -i $key -o BatchMode=yes -o ConnectTimeout=10 -o LogLevel=ERROR"

idx="$(mktemp)"
trap 'rm -f "$idx"' EXIT
if [ -n "$only" ]; then
  GIT_INDEX_FILE="$idx" git read-tree HEAD
  # shellcheck disable=SC2086 # the list is deliberately split into paths
  GIT_INDEX_FILE="$idx" git add -A -- $only
else
  cp "$(git rev-parse --git-path index)" "$idx"
  GIT_INDEX_FILE="$idx" git add -u
  GIT_INDEX_FILE="$idx" git add -- apps packages scripts 2>/dev/null || true
fi
tree="$(GIT_INDEX_FILE="$idx" git write-tree)"
snap="$(git commit-tree "$tree" -p HEAD -m "worker snapshot of $(git rev-parse --short HEAD) + working tree")"
# GIT_LFS_SKIP_PUSH: the worker has its own LFS files (git lfs pull); the LFS pre-push upload would need git-lfs-authenticate there
GIT_LFS_SKIP_PUSH=1 git push -q -f "ssh://$host/c/MarbleGp" "$snap:refs/heads/worker-snapshot" 2>&1 | grep -v -e 'post-quantum' -e 'store now' -e 'openssh.com/pq' -e 'be upgraded' || true

laptop_lock="$(git rev-parse --git-common-dir)/laptop-test.lock"
said_wait=""
while :; do
  # Try the worker without waiting: 75 means its lock is held, 255 means SSH couldn't reach it.
  set +e
  ssh -i "$key" -o BatchMode=yes -o ConnectTimeout=10 -o LogLevel=ERROR "$host" "
    mkdir /tmp/worker.lock 2>/dev/null || exit 75; trap 'rmdir /tmp/worker.lock' EXIT
    cd /c/MarbleGp && git checkout -q -- . && git checkout -q --detach $snap || exit 90
    want=\$(git hash-object package-lock.json); have=\$(cat node_modules/.lockhash 2>/dev/null || true)
    if [ \"\$want\" != \"\$have\" ]; then npm ci --no-audit --no-fund > /tmp/worker-ci.txt 2>&1 || { tail -5 /tmp/worker-ci.txt; exit 91; }; echo \"\$want\" > node_modules/.lockhash; fi
    echo \"[worker] testing snapshot $snap\"
    case \"$cmd\" in *'scripts/test-'*) case \"$cmd\" in *'npm run build'*) ;; *) echo '[worker] warning: browser tests serve apps/web/dist, which the snapshot resets to HEAD; run npm run build first in the same command' ;; esac ;; esac
    $cmd
  "
  rc=$?
  set -e
  if [ "$rc" -ne 75 ] && [ "$rc" -ne 255 ]; then exit "$rc"; fi
  # The worker is busy or unreachable: run on the laptop if its own lock is free (unless --worker-only).
  if [ -z "$worker_only" ] && mkdir "$laptop_lock" 2>/dev/null; then
    trap 'rm -f "$idx"; rmdir "$laptop_lock" 2>/dev/null || true' EXIT
    if [ "$rc" -eq 75 ]; then why="busy"; else why="unreachable"; fi
    echo "[laptop] the worker is $why, so this runs on the laptop, in the shared working tree (not the snapshot)"
    set +e; bash -c "$cmd"; lrc=$?; set -e
    exit "$lrc"
  fi
  if [ -z "$said_wait" ]; then if [ -n "$worker_only" ]; then echo "[queue] --worker-only: waiting for the worker"; else echo "[queue] the worker and the laptop are both busy; waiting for whichever frees first"; fi; said_wait=1; fi
  sleep 5
done
}
main "$@"; exit
