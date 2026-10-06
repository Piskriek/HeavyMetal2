#!/bin/bash
# Assemble 07-sheet-lab-power-and-machines.png (2560x1440).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/07"; mkdir -p "$T"; S="$ROOT/scratch/panels"

cropfill "$S/07-chain.png"       1560x877 $T/chain.png
cropfill "$S/07-bench-v2.png"     484x383 $T/c1.png
cropfill "$S/07-combiner.png"     484x383 $T/c2.png
cropfill "$S/07-rack.png"         484x383 $T/c3.png
cropfill "$S/07-table.png"        484x383 $T/c4.png
cropfill "$S/07-fabricator.png"   484x383 $T/c5.png

card() { # CARD NAMELINE SPECL1 SPECL2 OUT
  convert -size 484x34 xc:"#101216" -font $BOLD -pointsize 19 -fill "$ACC" -gravity west -annotate +12+1 "$2" $5.top.png
  convert -size 484x46 xc:"#101216" \
    -font $FONT -pointsize 14 -fill "$FG" -gravity northwest -annotate +12+4 "$3" \
    -font $FONT -pointsize 14 -fill "$SUB" -gravity northwest -annotate +12+24 "$4" \
    $5.bot.png
  convert "$1" $5.top.png -gravity north -composite $5.bot.png -gravity south -composite "$5"
}

card $T/c1.png "PRESET BENCH — texture presets"     "in: power + blank cart → out: texture cart"   "pink pixels while writing · 4 legs"            $T/c1.png
card $T/c2.png "PRESET COMBINER — mixes presets"    "in: power + 2-4 carts → out: one new cart"    "violet pixels while mixing · bolted plinth"    $T/c2.png
card $T/c3.png "PRESET RACK — cartridge library"    "in: small power feed → out: storage only"     "violet wisp mid-catalogue · wall + 2 feet"     $T/c3.png
card $T/c4.png "PLANET TABLE — plot hologram"       "in: power + data → out: amber hologram"       "amber sparkles · bolted pedestal"              $T/c4.png
card $T/c5.png "FABRICATOR — tools & suit parts"    "in: power + material cart → out: parts"       "green pixels · 4 levelling feet"               $T/c5.png

# notes panel 880x877
convert -size 880x877 xc:"$PNL" -font $BOLD -pointsize 30 -fill "$ACC" -gravity northwest \
  -annotate +28+24 "CANDIDATE LAB MACHINES" $T/notes.png
convert $T/notes.png -font $FONT -pointsize 23 -fill "$FG" -gravity northwest \
  -annotate +28+80  "The owner picks from these five. Every one is" \
  -annotate +28+114 "shown powered and working, with its pixel" \
  -annotate +28+148 "exhaust in the language:" \
  -annotate +28+204 "pink  #ff3d8a  = texture detail" \
  -annotate +28+244 "green #7cff4d  = shape detail" \
  -annotate +28+284 "amber #ffc13d  = light" \
  -annotate +28+324 "cyan  #3dc8ff  = water" \
  -annotate +28+364 "violet #b46bff = preset mixing" \
  -annotate +28+424 "A machine that is off spews nothing." \
  -annotate +28+484 "Power arrives by cable — a ceiling-tray drop" \
  -annotate +28+518 "or a steel floor cover. Never loose." \
  -annotate +28+572 "Everything stands on feet, skids, plinths" \
  -annotate +28+606 "or anchor bolts. Service panels, vents," \
  -annotate +28+640 "cable glands, handles, warning stripes," \
  -annotate +28+674 "indicator lights — parts a real machine has." \
  -annotate +28+728 "Combiner example: [mud texture cart] + " \
  -annotate +28+762 "[terrain shaping cart] = [road cart]." \
  -annotate +28+816 "OWNER: mark the machines to build." \
  $T/notes.png

convert -size 2560x1440 xc:"$BG" \
  -font $BOLD -pointsize 40 -fill "$FG" -gravity northwest -annotate +40+20 "SETMIX — LAB POWER & MACHINES" \
  -font $FONT -pointsize 24 -fill "$SUB" -gravity northwest \
    -annotate +40+80 "the power chain: capacitor bank → breaker panel → relay cabinets → control boxes → console · cables inside steel covers and trays" \
  \( $T/chain.png \) -gravity northwest -geometry +40+130 -composite \
  \( $T/notes.png \) -gravity northwest -geometry +1640+130 -composite \
  \( $T/c1.png \) -gravity northwest -geometry +40+1033 -composite \
  \( $T/c2.png \) -gravity northwest -geometry +544+1033 -composite \
  \( $T/c3.png \) -gravity northwest -geometry +1048+1033 -composite \
  \( $T/c4.png \) -gravity northwest -geometry +1552+1033 -composite \
  \( $T/c5.png \) -gravity northwest -geometry +2056+1033 -composite \
  -strip -define png:compression-level=9 "$ROOT/07-sheet-lab-power-and-machines.png"
identify -format "%f %wx%h %b\n" "$ROOT/07-sheet-lab-power-and-machines.png"
