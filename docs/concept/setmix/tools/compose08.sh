#!/bin/bash
# Assemble 08-plot-stage-ladder.png (2560x1440): 3x2, fixed camera, stages 1-6.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/08"; mkdir -p "$T"; S="$ROOT/scratch/panels"

declare -a CAP=(
"STAGE 1 — natural & multi-textured · low poly · simple light · black sky"
"STAGE 2 — finer textures · first sun glint · thin colour band at the horizon"
"STAGE 3 — real hills · normal detail · haze · soft shadows"
"STAGE 4 — water fills the low ground"
"STAGE 5 — coverage creeps out from water & machines · first trees"
"STAGE 6 — lush PBR forest" )
i=0
for p in s1 s2 s3 s4 s5 s6; do
  cropfill "$S/08-$p.png" 820x461 $T/c$i.png
  convert -size 820x36 xc:"$PNL" \( -size 6x36 xc:"$ACC" \) -gravity west -composite \
    -font $BOLD -pointsize 19 -fill "$FG" -gravity west -annotate +16+1 "${CAP[$i]}" $T/cap$i.png
  i=$((i+1))
done

convert -size 2560x1440 xc:"$BG" \
  -font $BOLD -pointsize 40 -fill "$FG" -gravity northwest -annotate +40+20 "SETMIX — YOUR PLOT, STAGES 1 → 6" \
  -font $FONT -pointsize 24 -fill "$SUB" -gravity northwest \
    -annotate +40+78 "the same camera, the same gate and machines — models, textures and light all climb · the machines' pixel plumes run at every stage" \
  \( $T/c0.png \) -gravity northwest -geometry +40+130 -composite  \( $T/cap0.png \) -gravity northwest -geometry +40+596 -composite \
  \( $T/c1.png \) -gravity northwest -geometry +880+130 -composite \( $T/cap1.png \) -gravity northwest -geometry +880+596 -composite \
  \( $T/c2.png \) -gravity northwest -geometry +1720+130 -composite \( $T/cap2.png \) -gravity northwest -geometry +1720+596 -composite \
  \( $T/c3.png \) -gravity northwest -geometry +40+652 -composite  \( $T/cap3.png \) -gravity northwest -geometry +40+1118 -composite \
  \( $T/c4.png \) -gravity northwest -geometry +880+652 -composite  \( $T/cap4.png \) -gravity northwest -geometry +880+1118 -composite \
  \( $T/c5.png \) -gravity northwest -geometry +1720+652 -composite \( $T/cap5.png \) -gravity northwest -geometry +1720+1118 -composite \
  $T/base.png

col() { # X HEAD L1 L2 L3
  convert $T/base.png -font $BOLD -pointsize 24 -fill "$ACC" -gravity northwest -annotate +$1+1180 "$2" \
    -font $FONT -pointsize 21 -fill "$FG" -gravity northwest -annotate +$1+1224 "$3" -annotate +$1+1256 "$4" -annotate +$1+1288 "$5" $T/base.png
}
col 40   "MODELS"  "chunky low-poly, flat shaded →" "mid-poly, bevelled →" "smooth high-poly PBR"
col 680  "TEXTURES" "chunky few-material blend →" "finer, richer →" "full PBR materials"
col 1320 "LIGHT"   "hard, black sky → sun glint +" "horizon band → haze →" "water → blue sky"
col 1960 "WORLD"   "natural desert at every stage" "→ water → coverage layer" "→ lush forest"
convert $T/base.png -font $FONT -pointsize 21 -fill "$SUB" -gravity northwest \
  -annotate +40+1340 "The planet is natural from stage 1 on — 'natural, just low rez'. No flat colour palette, no single texture over everything." \
  -strip -define png:compression-level=9 "$ROOT/08-plot-stage-ladder.png"
identify -format "%f %wx%h %b\n" "$ROOT/08-plot-stage-ladder.png"
