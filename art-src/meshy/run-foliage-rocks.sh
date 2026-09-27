#!/bin/sh
# The island's foliage and rocks: every row of $ROWS (default art-src/meshy/foliage-rocks.tsv) (name, model, polycount,
# prompt), five at a time. Each piece ends as art-src/meshy/<name>/opt-full.glb (1024 textures) and
# opt-lod.glb (512), ready to copy into public/models/kit/ after review.
#   sh art-src/meshy/run-foliage-rocks.sh
cut -f1 ${ROWS:-art-src/meshy/foliage-rocks.tsv} | xargs -P 5 -n 1 sh art-src/meshy/foliage-rock-piece.sh
echo ALL-DONE
