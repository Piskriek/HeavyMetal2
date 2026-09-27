#!/bin/sh
# One foliage or rock piece from the rows file ($ROWS, default art-src/meshy/foliage-rocks.tsv), end to end (see run-foliage-rocks.sh).
name="$1"
row=$(awk -F'\t' -v n="$name" '$1 == n' ${ROWS:-art-src/meshy/foliage-rocks.tsv})
model=$(printf '%s' "$row" | cut -f2); poly=$(printf '%s' "$row" | cut -f3); prompt=$(printf '%s' "$row" | cut -f4)
STYLE="stylized hand-painted game asset for a sunny tropical island, a single object standing alone, no base, no ground plane, no background"
[ -f "art-src/meshy/$name/model.glb" ] || node scripts/meshy.mjs text "$name" "$model" "$poly" "$prompt, $STYLE" 2>&1 | tail -1
[ -f "art-src/meshy/$name/model.glb" ] || { echo "$name FAILED"; exit 0; }
node scripts/optimize-glb.mjs "art-src/meshy/$name/model.glb" "art-src/meshy/$name/opt-full.glb" 1024 >/dev/null 2>&1
node scripts/optimize-glb.mjs "art-src/meshy/$name/model.glb" "art-src/meshy/$name/opt-lod.glb" 512 >/dev/null 2>&1
echo "$name READY"
