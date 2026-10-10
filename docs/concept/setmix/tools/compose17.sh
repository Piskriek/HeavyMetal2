#!/bin/bash
# Assemble 17-sheet-heavy-terraformers.png (3840x2260):
# three heavy terraformers (28-30) x 2 fidelity rows (stage-1 low poly / stage-6 PBR).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/17"; mkdir -p "$T"; P="$ROOT/panels/17"

KEYS=( press projector watermaker )
NAMES=( "HEAVY SHAPE PRESS" "HEAVY LIGHT PROJECTOR" "HEAVY WATER MAKER" )
JOBS=( "about 4 m tall, open frame, two rams over a die bed, green pixels"
       "about 5 m tall, armoured mast, tilting lamp head, amber pixels from the rear rim"
       "about 3.5 m tall, 6 m long, condenser tank, gravel hopper, cyan pixels" )

W=1220; H=760; GAP=40; X0=50
x_of() { echo $(( X0 + $1*(W+GAP) )); }

for i in 0 1 2; do
  for f in s1 s6; do
    cropfill "$P/17-${KEYS[$i]}-$f.png" ${W}x${H} "$T/${f}-$i.png"
  done
done

convert -size 3840x2260 xc:"$BG" \
  -font $BOLD -pointsize 44 -fill "$FG" -gravity northwest -annotate +40+24 \
    "SETMIX — HEAVY TERRAFORMERS" \
  -font $FONT -pointsize 24 -fill "$SUB" -gravity northwest -annotate +40+84 \
    "the heavy machines grow from their field twins on sheet 12 · each bolts to the sheet 13 hardpoint socket on a 2 x 2 slab pad · pixels are the only emission" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+134 \
    "STAGE 1 · chunky low poly, flat-shaded, ~16 colours" \
  "$T/base.png"
convert "$T/base.png" -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1058 \
    "STAGE 6 · the same design at full PBR resolution · clean, in service, on the lush terraformed plot" "$T/base.png"

for i in 0 1 2; do
  x=$(x_of $i)
  convert "$T/base.png" "$T/s1-$i.png" -gravity northwest -geometry +$x+180 -composite \
    -font $BOLD -pointsize 22 -fill "$FG" -annotate +$x+956 "$(( i + 28 ))  ${NAMES[$i]}" \
    -font $FONT -pointsize 18 -fill "$SUB" -annotate +$x+990 "${JOBS[$i]}" "$T/base.png"
  convert "$T/base.png" "$T/s6-$i.png" -gravity northwest -geometry +$x+1110 -composite \
    -font $BOLD -pointsize 22 -fill "$FG" -annotate +$x+1886 "$(( i + 28 ))  ${NAMES[$i]}" \
    -font $FONT -pointsize 18 -fill "$SUB" -annotate +$x+1920 "${JOBS[$i]}" "$T/base.png"
done

convert "$T/base.png" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1990 "RULES THE SHEET KEEPS" \
  -font $FONT -pointsize 22 -fill "$FG" -gravity northwest \
    -annotate +40+2036 "one design per machine: S1 is the low-poly version of the S6 design · same pad, socket and glands as the sheet 13 hardpoint" \
    -annotate +40+2072 "no chimneys, stacks or smokestacks · nothing floats: feet, plinths and bolts are visible · every machine has cables in low ribbed floor covers" \
    -annotate +40+2108 "no lettering on any piece · the mill on sheet 13 is the model: these three read as one family with it" \
  -strip -define png:compression-level=9 "$ROOT/17-sheet-heavy-terraformers.png"
identify -format "%f %wx%h\n" "$ROOT/17-sheet-heavy-terraformers.png"
