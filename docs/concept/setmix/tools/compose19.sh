#!/bin/bash
# Assemble 19-sheet-vehicle-fabricator.png (3840x1800):
# four pieces (34 vehicle fabricator, 35 scout, 36 hauler, 37 crawler) x 2 fidelity rows (stage-1 low poly / stage-6 PBR).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/19"; mkdir -p "$T"; P="$ROOT/panels/19"

KEYS=( fabricator scout hauler crawler )
NAMES=( "VEHICLE FABRICATOR" "SCOUT" "HAULER" "CRAWLER" )
JOBS=( "2 x 2 slab pad, 5 m gantry over a printing bed, print head on the rail, console at one corner"
       "stage 2 · one-seat moon buggy, about 3.2 m, open roll cage, four wire-mesh wheels"
       "stage 4 · six-wheeled flatbed, about 6 m, two-seat cab, storage bin with link dish, clear deck"
       "stage 6 · tracked survey vehicle, about 7 m, armoured cab, beam-drill arm, sensor mast" )

W=900; H=600; GAP=40; X0=60
x_of() { echo $(( X0 + $1*(W+GAP) )); }

for i in 0 1 2 3; do
  for f in s1 s6; do
    cropfill "$P/19-${KEYS[$i]}-$f.png" ${W}x${H} "$T/${f}-$i.png"
  done
done

convert -size 3840x1800 xc:"$BG" \
  -font $BOLD -pointsize 44 -fill "$FG" -gravity northwest -annotate +40+24 \
    "SETMIX — THE VEHICLE FABRICATOR AND THE ROVER CATALOG" \
  -font $FONT -pointsize 24 -fill "$SUB" -gravity northwest -annotate +40+84 \
    "vehicles are a fixed catalog of designed rovers · each prints whole at the fabricator on a 2 x 2 hardpoint pad · the scout, hauler and crawler unlock as the world's fidelity rises" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+134 \
    "STAGE 1 · chunky low poly, flat-shaded, ~16 colours" \
  "$T/base.png"
convert "$T/base.png" -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+878 \
    "STAGE 6 · the same design at full PBR resolution · clean, in service, on the lush terraformed plot" "$T/base.png"

for i in 0 1 2 3; do
  x=$(x_of $i)
  convert "$T/base.png" "$T/s1-$i.png" -gravity northwest -geometry +$x+180 -composite \
    -font $BOLD -pointsize 22 -fill "$FG" -annotate +$x+800 "$(( i + 34 ))  ${NAMES[$i]}" \
    -font $FONT -pointsize 18 -fill "$SUB" -annotate +$x+834 "${JOBS[$i]}" "$T/base.png"
  convert "$T/base.png" "$T/s6-$i.png" -gravity northwest -geometry +$x+920 -composite \
    -font $BOLD -pointsize 22 -fill "$FG" -annotate +$x+1540 "$(( i + 34 ))  ${NAMES[$i]}" \
    -font $FONT -pointsize 18 -fill "$SUB" -annotate +$x+1574 "${JOBS[$i]}" "$T/base.png"
done

convert "$T/base.png" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1640 "RULES THE SHEET KEEPS" \
  -font $FONT -pointsize 22 -fill "$FG" -gravity northwest \
    -annotate +40+1686 "one design per piece: S1 is the low-poly version of the S6 design · the rovers share the base kit's paint, hazard bands and lamp style" \
    -annotate +40+1722 "no chimneys, stacks or smokestacks · nothing floats: wheels, tracks, pads and bolts touch the ground · cables run in low ribbed floor covers" \
    -annotate +40+1758 "the only glow is the print on the fabricator bed (S6) and the link dish · no lettering on any piece · the scientist (1.8 m) gives the scale" \
  -strip -define png:compression-level=9 "$ROOT/19-sheet-vehicle-fabricator.png"
identify -format "%f %wx%h\n" "$ROOT/19-sheet-vehicle-fabricator.png"
