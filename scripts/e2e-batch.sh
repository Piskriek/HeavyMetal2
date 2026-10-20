#!/usr/bin/env bash
# Runs several browser tests in a row and prints one PASS/FAIL line each, with the tail of any failure's log.
# Meant for the 3D PC worker, where a quoted loop can't go through test-on-3dpc.sh's command string:
#   scripts/test-on-3dpc.sh --worker-only "npm run build > /tmp/e2e-build.txt 2>&1 && bash scripts/e2e-batch.sh campaign hud-zones"
# Each name is scripts/test-<name>.mjs; full logs land in /tmp/e2e-<name>.txt. Exits 1 if any test failed.
failed=0
for t in "$@"; do
  s=$(date +%s)
  if node "scripts/test-$t.mjs" > "/tmp/e2e-$t.txt" 2>&1; then
    echo "PASS $t ($(( $(date +%s) - s ))s)"
  else
    echo "FAIL $t ($(( $(date +%s) - s ))s)"; tail -12 "/tmp/e2e-$t.txt" | sed 's/^/    /'; failed=1
  fi
done
exit "$failed"
