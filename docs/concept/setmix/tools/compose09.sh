#!/bin/bash
# Assemble 09-sheet-coverage-growth.png (2560x1440):
# one marked 2x2 m ground square over 6 coverage steps + step-6 derived maps.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/09"; mkdir -p "$T"; S="$ROOT/scratch/panels"

declare -a CAP=(
"STEP 1 — bare: mixed-facet ground, nothing grows yet"
"STEP 2 — first speckles arrive at the water & the machine feet"
"STEP 3 — vine-like tendrils search a third of the square"
"STEP 4 — tendrils knit into patchy turf, facets finer under cover"
"STEP 5 — cover closes; sapling nubs, puddle beads, thin bare seams"
"STEP 6 — full cover, full PBR · no bare ground left" )
i=0
for p in s1 s2 s3 s4 s5 s6; do
  cropfill "$S/09-$p.png" 820x461 $T/c$i.png
  convert -size 820x36 xc:"$PNL" \( -size 6x36 xc:"$ACC" \) -gravity west -composite \
    -font $BOLD -pointsize 19 -fill "$FG" -gravity west -annotate +16+1 "${CAP[$i]}" $T/cap$i.png
  i=$((i+1))
done

convert -size 2560x1440 xc:"$BG" \
  -font $BOLD -pointsize 40 -fill "$FG" -gravity northwest -annotate +40+20 "SETMIX — COVERAGE GROWTH, ONE 2×2 m SQUARE" \
  -font $FONT -pointsize 24 -fill "$SUB" -gravity northwest \
    -annotate +40+78 "one fixed camera · coverage creeps out of the water runnel and the machine's shadow · same posts, same strings, step by step" \
  \( $T/c0.png \) -gravity northwest -geometry +40+130 -composite  \( $T/cap0.png \) -gravity northwest -geometry +40+596 -composite \
  \( $T/c1.png \) -gravity northwest -geometry +880+130 -composite \( $T/cap1.png \) -gravity northwest -geometry +880+596 -composite \
  \( $T/c2.png \) -gravity northwest -geometry +1720+130 -composite \( $T/cap2.png \) -gravity northwest -geometry +1720+596 -composite \
  \( $T/c3.png \) -gravity northwest -geometry +40+632 -composite  \( $T/cap3.png \) -gravity northwest -geometry +40+1098 -composite \
  \( $T/c4.png \) -gravity northwest -geometry +880+632 -composite \( $T/cap4.png \) -gravity northwest -geometry +880+1098 -composite \
  \( $T/c5.png \) -gravity northwest -geometry +1720+632 -composite \( $T/cap5.png \) -gravity northwest -geometry +1720+1098 -composite \
  $T/base.png

# --- derived maps from the step-6 square -----------------------------------
convert "$S/09-s6.png" -gravity center -crop 62% +repage $T/s6sq.png
"$ROOT/tools/derive_maps.sh" $T/s6sq.png $T/s6n.png $T/s6r.png
cropfill $T/s6sq.png 300x169 $T/m0.png; cropfill $T/s6n.png 300x169 $T/m1.png; cropfill $T/s6r.png 300x169 $T/m2.png
lbl() { convert -size 300x30 xc:"$PNL" -font $BOLD -pointsize 18 -fill "$FG" -gravity center -annotate 0 "$2" "$1"; }
lbl $T/ml0.png "ALBEDO"; lbl $T/ml1.png "NORMAL"; lbl $T/ml2.png "ROUGHNESS"
convert $T/base.png -font $BOLD -pointsize 24 -fill "$ACC" -gravity northwest -annotate +40+1160 "STEP 6 — DERIVED MAPS (concept targets)" \
  \( $T/m0.png \) -geometry +40+1200 -composite  \( $T/ml0.png \) -geometry +40+1372 -composite \
  \( $T/m1.png \) -geometry +380+1200 -composite \( $T/ml1.png \) -geometry +380+1372 -composite \
  \( $T/m2.png \) -geometry +720+1200 -composite \( $T/ml2.png \) -geometry +720+1372 -composite \
  $T/base.png
convert $T/base.png -font $BOLD -pointsize 24 -fill "$ACC" -gravity northwest -annotate +1120+1160 "HOW THE SQUARE RENDERS AT THE END" \
  -font $FONT -pointsize 21 -fill "$FG" -gravity northwest \
    -annotate +1120+1204 "albedo: the covered square as colour texture" \
    -annotate +1120+1236 "normal: grass, moss and soil relief for light" \
    -annotate +1120+1268 "roughness: wet corner reads glossier, dry moss rough" \
  -font $FONT -pointsize 21 -fill "$SUB" -gravity northwest \
    -annotate +1120+1320 "coverage always starts from water and machine feet —" \
    -annotate +1120+1352 "never a uniform flat layer across the whole plot" \
  -strip -define png:compression-level=9 "$ROOT/09-sheet-coverage-growth.png"
identify -format "%f %wx%h %b\n" "$ROOT/09-sheet-coverage-growth.png"
