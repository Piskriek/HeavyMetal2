#!/bin/bash
# Assemble 15-sheet-base-roofs-openings.png (3840x2100):
# 16 pieces (12-27) x 2 fidelity rows (stage-1 low poly / stage-6 PBR), two blocks of eight.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/15"; mkdir -p "$T"; P="$ROOT/panels/15"

KEYS=( roof-pitched roof-low corner-outer corner-inner ridge-cap gable half-wall window-wall
       doorframe door-interior stairs ladder railing brace lifesupport vestibule )
NAMES=( "PITCHED ROOF" "LOW ROOF" "OUTER CORNER (HIP)" "INNER CORNER (VALLEY)" "RIDGE CAP" "GABLE WALL" "HALF WALL" "WINDOW WALL"
        "DOORFRAME" "INTERIOR DOOR" "STAIRS" "LADDER" "RAILING" "DIAGONAL BRACE" "LIFE-SUPPORT UNIT" "AIRLOCK VESTIBULE" )
JOBS=( "4 x 4 m cell, 37° roof, rises one storey" "4 x 4 m cell, 21° roof, rises half a storey" "hip corner, two low eaves on walls" "valley corner, gutter down the seam"
       "caps two pitched roofs at the peak" "closes the end of a 37° roof" "1.5 m high, hazard foot" "heavy framed viewport, seals like a wall"
       "open 1.5 x 2.4 m passage, no door" "light sliding door, shown shut" "one storey over one cell, railed" "one storey on a wall face, cage hoops"
       "half-height rail along a cell edge" "strut from wall face to floor above" "floor cabinet, pressurises its room" "two doors, short sealed corridor" )

W=440; H=300; GAP=17; X0=100
x_of() { echo $(( X0 + $1*(W+GAP) )); }

# tiles (cropped to the slot, centred)
for i in $(seq 0 15); do
  for f in s1 s6; do
    cropfill "$P/15-${KEYS[$i]}-$f.png" ${W}x${H} "$T/${f}-$i.png"
  done
done

convert -size 3840x2100 xc:"$BG" \
  -font $BOLD -pointsize 44 -fill "$FG" -gravity northwest -annotate +40+24 \
    "SETMIX — BASE ROOFS, OPENINGS AND CIRCULATION" \
  -font $FONT -pointsize 24 -fill "$SUB" -gravity northwest -annotate +40+84 \
    "roofs, walls with openings, stairs and ladders, bracing, life support and airlock vestibules · continues sheet 13 · 4 m lattice, 3 m storeys" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+134 \
    "STAGE 1 · chunky low poly, flat-shaded, ~16 colours" \
  "$T/base.png"
convert "$T/base.png" -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+578 \
    "STAGE 6 · the same design at full PBR resolution · clean, in service, on the lush terraformed plot" "$T/base.png"
convert "$T/base.png" -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1020 \
    "STAGE 1 · chunky low poly, flat-shaded, ~16 colours (pieces 20–27)" "$T/base.png"
convert "$T/base.png" -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1464 \
    "STAGE 6 · the same design at full PBR resolution (pieces 20–27)" "$T/base.png"

# place tiles and labels: block A rows at 182 (S1) and 626 (S6), block B rows at 1068 (S1) and 1512 (S6)
place() { # $1=index  $2=tile file  $3=row-y  $4=label-y
  local i=$1 x; x=$(x_of $(( i % 8 )))
  convert "$T/base.png" "$2" -gravity northwest -geometry +$x+$3 -composite \
    -font $BOLD -pointsize 20 -fill "$FG" -annotate +$x+$4 "$(( i + 12 ))  ${NAMES[$i]}" \
    -font $FONT -pointsize 17 -fill "$SUB" -annotate +$x+$(( $4 + 32 )) "${JOBS[$i]}" "$T/base.png"
}
for i in $(seq 0 7); do
  place $i "$T/s1-$i.png" 182 496
  place $i "$T/s6-$i.png" 626 940
done
for i in $(seq 8 15); do
  place $i "$T/s1-$i.png" 1068 1382
  place $i "$T/s6-$i.png" 1512 1826
done

convert "$T/base.png" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1920 "RULES THE SHEET KEEPS" \
  -font $FONT -pointsize 22 -fill "$FG" -gravity northwest \
    -annotate +40+1966 "one design per piece: S1 is the low-poly version of the S6 design, same silhouette, parts and proportions" \
    -annotate +40+2002 "no chimneys, stacks or smokestacks · nothing floats: feet, plinths, skirts and bolts are visible on every piece" \
    -annotate +40+2038 "every machine has a cable in a low ribbed floor cover · no lettering on any piece" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +1900+1920 "SCALE" \
  -font $FONT -pointsize 22 -fill "$FG" -gravity northwest \
    -annotate +1900+1966 "hazmat scientist 1.8 m · storey 3 m · cell 4 m · roofs rise 37° (12, 14–17) and 21° (13)" \
    -annotate +1900+2002 "half wall 1.5 m · window wall and doorframe in a 4 x 3 m wall" \
  -strip -define png:compression-level=9 "$ROOT/15-sheet-base-roofs-openings.png"
identify -format "%f %wx%h\n" "$ROOT/15-sheet-base-roofs-openings.png"
