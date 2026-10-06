#!/bin/bash
# Assemble 06-sheet-gate.png (2560x1440) from panels in scratch/panels.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/06"; mkdir -p "$T"
S="$ROOT/scratch/panels"

cropfill "$S/06-gate-34.png"      1300x732 $T/p34.png
cropfill "$S/06-gate-front.png"   1160x652 $T/pf.png
cropfill "$S/06-gate-side.png"     360x400 $T/ps.png
cropfill "$S/06-gate-back.png"     360x400 $T/pb.png
cropfill "$S/06-twin-stage1.png"   710x400 $T/t1.png
cropfill "$S/06-twin-stage6.png"   710x400 $T/t6.png

smallbadge() { local tmp=$(mktemp -u --suffix=.png)
  convert -background "#000000aa" -fill "$FG" -font $BOLD -pointsize 20 label:"$3" "$tmp"
  convert "$1" "$tmp" -gravity northwest -geometry +10+10 -composite "$2"; rm -f "$tmp"; }

smallbadge $T/p34.png $T/p34.png "THREE-QUARTER RENDER — coils powered, idle"
smallbadge $T/pf.png  $T/pf.png  "FRONT — goblin 1.3 m for scale"
smallbadge $T/ps.png  $T/ps.png  "SIDE PROFILE"
smallbadge $T/pb.png  $T/pb.png  "REAR VIEW"
smallbadge $T/t1.png  $T/t1.png  "TWIN — STAGE 1 (LOW POLY)"
smallbadge $T/t6.png  $T/t6.png  "TWIN — STAGE 6 (PBR)"

# dimensions mini-panel 280x400
convert -size 280x400 xc:"$PNL" -font $BOLD -pointsize 24 -fill "$ACC" -gravity northwest \
  -annotate +18+16 "TARGET SIZES" $T/dim.png
convert $T/dim.png -font $FONT -pointsize 20 -fill "$FG" -gravity northwest \
  -annotate +18+58 "opening  2.6 × 1.7 m" \
  -annotate +18+88 "(two goblins stacked)" \
  -annotate +18+124 "outer height  ≈ 3.2 m" \
  -annotate +18+152 "frame width   ≈ 2.6 m" \
  -annotate +18+180 "frame depth   ≈ 1.1 m" \
  -annotate +18+208 "plinth        0.15 m" \
  -annotate +18+236 "step-up plate   40 mm" \
  -annotate +18+264 "cable glands    6×" \
  -annotate +18+300 "coils amber  = on" \
  -annotate +18+328 "coils dark   = off" \
  $T/dim.png

convert -size 2560x1440 xc:"$BG" \
  -font $BOLD -pointsize 44 -fill "$FG" -gravity northwest -annotate +40+22 "SETMIX — THE GATE" \
  -font $FONT -pointsize 25 -fill "$SUB" -gravity northwest \
    -annotate +40+86 "a door frame standing free, joined to no wall · power arrives by cable in steel floor covers · the planet end is its weathered twin on a cast footing pad" \
  \( $T/p34.png \) -gravity northwest -geometry +40+130 -composite \
  \( $T/pf.png \)  -gravity northwest -geometry +1370+170 -composite \
  \( $T/ps.png \)  -gravity northwest -geometry +40+910 -composite \
  \( $T/pb.png \)  -gravity northwest -geometry +420+910 -composite \
  \( $T/t1.png \)  -gravity northwest -geometry +800+910 -composite \
  \( $T/t6.png \)  -gravity northwest -geometry +1530+910 -composite \
  \( $T/dim.png \) -gravity northwest -geometry +2260+910 -composite \
  -font $BOLD -pointsize 23 -fill "$ACC" -gravity southwest -annotate +40+44 \
  "CALLOUTS —  A  plinth + anchor bolts    B  side buttresses    C  field coils (ribbed blocks, ignite bottom-up)    D  emitter channels, inner faces" \
  -font $FONT -pointsize 23 -fill "$FG" -gravity southwest -annotate +40+12 \
  "E  rear junction box + 6 cable glands    F  service hatches    G  step-up plate    ·    power arrives in steel floor covers · nothing floats" \
  -strip -define png:compression-level=9 "$ROOT/06-sheet-gate.png"
identify -format "%f %wx%h %b\n" "$ROOT/06-sheet-gate.png"
