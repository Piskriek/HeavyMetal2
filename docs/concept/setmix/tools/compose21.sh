#!/bin/bash
# Assemble the side-by-side composites for sheet 21:
#   panels/21/46-armory-her-corner.png  (46a armory nook | 46b her corner, one image)
#   panels/21/43-storm-progress.png     (43a full | 43b thinning | 43c breaking, one image) -- when the three 43 renders exist
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
P="$ROOT/panels/21"; T="$ROOT/scratch/21"; mkdir -p "$T"
# 46: two close-ups side by side, 1000 px tall each, with a thin dark divider
convert "$P/46a-armory-nook.png" -resize x1000 -gravity center -extent 1400x1000 "$T/46a.png"
convert "$P/46b-her-corner.png" -resize x1000 -gravity center -extent 1400x1000 "$T/46b.png"
convert "$T/46a.png" \( -size 20x1000 xc:"$PNL" \) "$T/46b.png" +append -strip "$P/46-armory-her-corner.png"
identify -format "%f %wx%h\n" "$P/46-armory-her-corner.png"
if [ -f "$P/43a-storm-full.png" ] && [ -f "$P/43b-storm-thinning.png" ] && [ -f "$P/43c-storm-breaking.png" ]; then
  for k in a b c; do f=$(ls "$P"/43$k-*.png); convert "$f" -resize x1000 -gravity center -extent 1000x1000 "$T/43$k.png"; done
  convert "$T/43a.png" \( -size 20x1000 xc:"$PNL" \) "$T/43b.png" \( -size 20x1000 xc:"$PNL" \) "$T/43c.png" +append -strip "$P/43-storm-progress.png"
  identify -format "%f %wx%h\n" "$P/43-storm-progress.png"
fi
