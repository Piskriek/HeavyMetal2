#!/bin/bash
# Assemble 20-sheet-weapons.png (3840x1960): piece 38 weapon bench and piece 39 bare frame at S1 and S6 (top row),
# piece 40 part variants at S6 (each fitted to the S6 frame) plus the S1 full set (bottom rows).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/20"; mkdir -p "$T"; P="$ROOT/panels/20"

convert -size 3840x1960 xc:"$BG" \
  -font $BOLD -pointsize 44 -fill "$FG" -gravity northwest -annotate +40+24 \
    "SETMIX — THE WEAPON BENCH AND THE MODULAR WEAPON" \
  -font $FONT -pointsize 24 -fill "$SUB" -gravity northwest -annotate +40+84 \
    "one frame, four part slots: core (sets the fire mode) · barrel · sight · cell · parts are crafted at the weapon bench and swapped in the field" \
  "$T/base.png"

# top row: 38 bench and 39 frame, S1 and S6 (900 x 600 tiles)
TOP=( "bench-s1" "bench-s6" "frame-s1" "frame-s6" )
TOPL=( "38 · WEAPON BENCH · stage 1" "38 · WEAPON BENCH · stage 6" "39 · WEAPON FRAME, bare · stage 1" "39 · WEAPON FRAME, bare · stage 6" )
TOPF=( "20-bench-s1" "20-bench-s6" "20-frame-s1" "20-frame-s6" )
for i in 0 1 2 3; do
  x=$(( 60 + i*940 ))
  cropfill "$P/${TOPF[$i]}.png" 900x600 "$T/top-$i.png"
  convert "$T/base.png" "$T/top-$i.png" -gravity northwest -geometry +$x+160 -composite \
    -font $BOLD -pointsize 22 -fill "$FG" -annotate +$x+784 "${TOPL[$i]}" "$T/base.png"
done

# part variants (S6, fitted to the frame S6) and the S1 full set
VARF=( "20-core-semi-s6" "20-core-burst-s6" "20-core-beam-s6" "20-barrel-short-s6" "20-barrel-long-s6" "20-barrel-scatter-s6"
       "20-sight-iron-s6" "20-sight-scope-s6" "20-sight-holo-s6" "20-cell-compact-s6" "20-cell-extended-s6" "20-full-s1" )
VARL=( "40 · CORE · semi-auto" "40 · CORE · burst" "40 · CORE · beam" "40 · BARREL · short" "40 · BARREL · long" "40 · BARREL · scatter"
       "40 · SIGHT · iron" "40 · SIGHT · scope" "40 · SIGHT · holo" "40 · CELL · compact" "40 · CELL · extended" "40 · FULL SET (semi, long, scope, compact) · S1" )
convert "$T/base.png" -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+842 \
  "40 · PART VARIANTS · each part fitted to the kept S6 frame · the full set at stage 1" "$T/base.png"

for i in $(seq 0 11); do
  row=$(( i / 6 )); col=$(( i % 6 ))
  x=$(( 60 + col*600 )); y=$(( 900 + row*420 ))
  cropfill "$P/${VARF[$i]}.png" 560x352 "$T/var-$i.png"
  convert "$T/base.png" "$T/var-$i.png" -gravity northwest -geometry +$x+$y -composite \
    -font $BOLD -pointsize 19 -fill "$FG" -annotate +$x+$((y+362)) "${VARL[$i]}" "$T/base.png"
done

convert "$T/base.png" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1760 "RULES THE SHEET KEEPS" \
  -font $FONT -pointsize 22 -fill "$FG" -gravity northwest \
    -annotate +40+1806 "one frame, four slots: every part is seated on its own rail, clamp or well · nothing floats · the frame is the same design at both stages" \
    -annotate +40+1842 "no lettering on any piece · no beam, no glow column, no pixels from the weapons · the bench is in a base room beside a sheet 13 wall" \
  -strip -define png:compression-level=9 "$ROOT/20-sheet-weapons.png"
identify -format "%f %wx%h\n" "$ROOT/20-sheet-weapons.png"
