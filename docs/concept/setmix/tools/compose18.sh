#!/bin/bash
# Assemble 18-sheet-life-support.png (3840x2260):
# three pieces (31 life-support unit, 32 airlock vestibule, 33 starter shelter) x 2 fidelity rows (stage-1 low poly / stage-6 PBR).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/18"; mkdir -p "$T"; P="$ROOT/panels/18"

KEYS=( lifesupport vestibule shelter )
NAMES=( "LIFE-SUPPORT UNIT" "AIRLOCK VESTIBULE" "STARTER SHELTER" )
JOBS=( "about 1.9 m tall, floor-standing against a wall, intake grille, three scrubber canisters, green status bar"
       "one-cell cutaway, outer and inner airlock doors, beacons amber and green, pressure panel, grating and drain"
       "one 4 x 4 m cell, 21-degree roof, life-support unit and drafting table inside, bin by the door" )

W=1220; H=760; GAP=40; X0=50
x_of() { echo $(( X0 + $1*(W+GAP) )); }

for i in 0 1 2; do
  for f in s1 s6; do
    cropfill "$P/18-${KEYS[$i]}-$f.png" ${W}x${H} "$T/${f}-$i.png"
  done
done

convert -size 3840x2260 xc:"$BG" \
  -font $BOLD -pointsize 44 -fill "$FG" -gravity northwest -annotate +40+24 \
    "SETMIX — PRESSURE AND THE STARTER SHELTER" \
  -font $FONT -pointsize 24 -fill "$SUB" -gravity northwest -annotate +40+84 \
    "a sealed room only stops the sync drain while its life-support unit runs · the starter shelter is one cell, placed in one action · same kit as sheets 13 and 15" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+134 \
    "STAGE 1 · chunky low poly, flat-shaded, ~16 colours" \
  "$T/base.png"
convert "$T/base.png" -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1058 \
    "STAGE 6 · the same design at full PBR resolution · clean, in service, on the lush terraformed plot" "$T/base.png"

for i in 0 1 2; do
  x=$(x_of $i)
  convert "$T/base.png" "$T/s1-$i.png" -gravity northwest -geometry +$x+180 -composite \
    -font $BOLD -pointsize 22 -fill "$FG" -annotate +$x+956 "$(( i + 31 ))  ${NAMES[$i]}" \
    -font $FONT -pointsize 18 -fill "$SUB" -annotate +$x+990 "${JOBS[$i]}" "$T/base.png"
  convert "$T/base.png" "$T/s6-$i.png" -gravity northwest -geometry +$x+1110 -composite \
    -font $BOLD -pointsize 22 -fill "$FG" -annotate +$x+1886 "$(( i + 31 ))  ${NAMES[$i]}" \
    -font $FONT -pointsize 18 -fill "$SUB" -annotate +$x+1920 "${JOBS[$i]}" "$T/base.png"
done

convert "$T/base.png" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1990 "RULES THE SHEET KEEPS" \
  -font $FONT -pointsize 22 -fill "$FG" -gravity northwest \
    -annotate +40+2036 "one design per piece: S1 is the low-poly version of the S6 design · the shelter's walls use the sheet 13 lattice joints and the sheet 15 21-degree roof" \
    -annotate +40+2072 "no chimneys, stacks or smokestacks · nothing floats: skirts, plinths and bolts are visible · cables run in low ribbed floor covers or wall conduits" \
    -annotate +40+2108 "the life-support unit emits no pixels · no lettering on any piece · the scientist (1.8 m) gives the scale" \
  -strip -define png:compression-level=9 "$ROOT/18-sheet-life-support.png"
identify -format "%f %wx%h\n" "$ROOT/18-sheet-life-support.png"
