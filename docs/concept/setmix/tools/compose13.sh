#!/bin/bash
# Assemble 13-sheet-base-construction.png (3840x2160):
# 11 base pieces x 2 fidelity rows (stage-1 low poly / stage-6 PBR).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/13"; mkdir -p "$T"; P="$ROOT/panels/13"

KEYS=( foundation wall pillar floor ramp airlock hardpoint-empty hardpoint-mill bin pylon drafting )
NAMES=( "HEAVY FOUNDATION" "STRUCTURAL WALL" "PILLAR" "FLOOR / ROOF" "RAMP" "AIRLOCK" "HARDPOINT" "HARDPOINT + HEAVY MILL" "QUANTUM BIN" "REPEATER PYLON" "DRAFTING TABLE" )
JOBS=( "4 x 4 m slab, skirt sinks, bolted" "4 x 3 m wall closes a bay" "corner post, takes the floor" "upper storey deck on four posts" "one storey over one cell" "sealed door, gauge, status light" "2 x 2 slab pad, socket, glands" "about 2x field mill, pixels out" "linked storage, emitter on top" "tower carries the link range" "primitive + map = blueprint" )

W=330; H=330; GAP=17; X0=20
x_of() { echo $(( X0 + $1*(W+GAP) )); }

# tiles (square crop, centred)
for i in $(seq 0 10); do
  for f in s1 s6; do
    src="$P/13-${KEYS[$i]}-$f.png"
    cropfill "$src" ${W}x${H} "$T/${f}-$i.png"
  done
done

convert -size 3840x2160 xc:"$BG" \
  -font $BOLD -pointsize 44 -fill "$FG" -gravity northwest -annotate +40+24 \
    "SETMIX — BASE CONSTRUCTION KIT" \
  -font $FONT -pointsize 24 -fill "$SUB" -gravity northwest -annotate +40+84 \
    "snapping pieces on a 4 m lattice, 3 m storeys · every piece stands on the ground or on another piece · heavy terraformers sit on a hardpoint pad" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+134 \
    "STAGE 1 · chunky low poly, flat-shaded, ~16 colours" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+634 \
    "STAGE 6 · the same design at full PBR resolution, in service, on the lush terraformed plot" \
  "$T/base.png"

for i in $(seq 0 10); do
  x=$(x_of $i)
  convert "$T/base.png" "$T/s1-$i.png" -gravity northwest -geometry +$x+182 -composite \
    -font $BOLD -pointsize 20 -fill "$FG" -annotate +$x+524 "$((i+1))  ${NAMES[$i]}" \
    -font $FONT -pointsize 17 -fill "$SUB" -annotate +$x+556 "${JOBS[$i]}" "$T/base.png"
  convert "$T/base.png" "$T/s6-$i.png" -gravity northwest -geometry +$x+682 -composite \
    -font $BOLD -pointsize 20 -fill "$FG" -annotate +$x+1024 "$((i+1))  ${NAMES[$i]}" \
    -font $FONT -pointsize 17 -fill "$SUB" -annotate +$x+1056 "${JOBS[$i]}" "$T/base.png"
done

convert "$T/base.png" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1140 "RULES THE SHEET KEEPS" \
  -font $FONT -pointsize 22 -fill "$FG" -gravity northwest \
    -annotate +40+1186 "no chimneys, stacks or smokestacks · machines spew coloured pixels from a rear vent while they run; that is the only emission" \
    -annotate +40+1222 "nothing floats · feet, plinths, skirts and bolts are visible on every piece" \
    -annotate +40+1258 "every machine has a cable in a low ribbed floor cover or a tray from a power source" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +40+1340 "SCALE" \
  -font $FONT -pointsize 22 -fill "$FG" -gravity northwest \
    -annotate +40+1386 "hazmat scientist 1.8 m (wall panels) · foundation slab 4 m square, about 0.5 m thick · storey 3 m · hardpoint pad 2 x 2 slabs = 8 x 8 m" \
    -annotate +40+1422 "heavy mill about 4 m tall, about twice the field mill on sheet 12" \
  -font $BOLD -pointsize 26 -fill "$ACC" -gravity northwest -annotate +1900+1340 "FOR THE OWNER" \
  -font $FONT -pointsize 22 -fill "$FG" -gravity northwest \
    -annotate +1900+1386 "check the hardpoint pad before the mill: the mill is the only piece that spews" \
    -annotate +1900+1422 "the S6 row is the same piece at full PBR resolution, in the same condition, on the lush terraformed plot" \
  -strip -define png:compression-level=9 "$ROOT/13-sheet-base-construction.png"
identify -format "%f %wx%h\n" "$ROOT/13-sheet-base-construction.png"
