#!/bin/sh
# One Meshy piece end to end: model → low tier → collision tier → optimized copies in public/models/kit.
#   sh scripts/meshy-piece.sh <name>        (reference at art-src/meshy/refs/<name>.png)
# Run several with xargs -P 8: each piece has at most one Meshy task pending at a time, so eight in
# parallel stay under the plan's queue limit.
set -e
p="$1"
[ -f "art-src/meshy/$p/model.glb" ] || { node scripts/meshy.mjs image "$p" "art-src/meshy/refs/$p.png" && node scripts/meshy.mjs wait "$p" | tr '\r' '\n' | grep -v '%$'; }
[ -f "art-src/meshy/$p/lod.glb" ] || node scripts/meshy.mjs remesh "$p" lod 1500
[ -f "art-src/meshy/$p/collision.glb" ] || node scripts/meshy.mjs remesh "$p" collision 300
node scripts/optimize-glb.mjs "art-src/meshy/$p/model.glb" "public/models/kit/$p.glb" 1024
node scripts/optimize-glb.mjs "art-src/meshy/$p/lod.glb" "public/models/kit/$p.lod.glb" 512
node scripts/optimize-glb.mjs "art-src/meshy/$p/collision.glb" "public/models/kit/$p.collision.glb" 16
echo "$p: all three tiers ready"
