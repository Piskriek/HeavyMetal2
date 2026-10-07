#!/bin/bash
# Assemble 12-sheet-field-machines.png (2560x1440):
# 8 candidate machines x 2 fidelity rows (stage-1 low poly / stage-6 PBR).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; source "$ROOT/tools/lib.sh"
T="$ROOT/scratch/12"; mkdir -p "$T"; S="$ROOT/panels/12"

NAMES=( "ROCK DRILL" "TEXTURE MILL" "SHAPE PRESS" "LIGHT PROJECTOR" "WATER MAKER" "PRESET MIXER" "POWER UNIT" "RELAY PYLON" )
JOBS=( "mines raw material" "grinds in texture detail" "stamps geometry finer" "raises the light level" "condenses water" "mixes 2-4 presets into 1" "makes electricity" "carries the spans" )
KEYS=( drill mill press lamp water mixer power pylon )
S1S=( "ore out at the tray - faint" "ore in, dark hopper - pink" "rock in, side tray - green" "amber pixels from the" "gravel in, side scree -" "cartridges in top slots -" "material cells in - NO" "no pixels - a white pulse" )
S1B=( "dim wisp at the rear stack" "pixels out, rear stack" "pixels out, rear vent" "lamp housing's rim vents" "cyan pixels, top-rear vent" "violet pixels, rear vent" "pixels - steam wisp only" "bead shows the line load" )
S1C=( "4 legs + anchor pads" "cartridge slot - 4 bolted feet" "cartridge slot - bolted base" "cartridge slot - pad feet" "cartridge slot - cradle feet" "bolted feet - output slot" "skid + anti-vibration feet" "concrete pad + anchor bolts" )

build_row() { # SUFFIX YIMG YNAME YSPEC  (prepends v2 sources where they exist)
  local sfx=$1 yimg=$2 yname=$3 yspec=$4 i src
  for i in 0 1 2 3 4 5 6 7; do
    src="$S/12-${KEYS[$i]}-$sfx.png"; [ -f "$src" ] || src="$S/12-${KEYS[$i]}-${sfx}v2.png"
    cropfill "$src" 296x167 "$T/${sfx}$i.png"
    convert -size 296x26 xc:"$PNL" -font $BOLD -pointsize 17 -fill "$FG" -gravity west -annotate +8+1 \
      "$((i+1))  ${NAMES[$i]}" "$T/${sfx}n$i.png"
  done
}

build_row s1 0 0 0  # geometry set below when compositing
build_row s6 0 0 0

convert -size 2560x1440 xc:"$BG" \
  -font $BOLD -pointsize 40 -fill "$FG" -gravity northwest -annotate +40+20 \
    "SETMIX — FIELD MACHINES, EIGHT CANDIDATES" \
  -font $FONT -pointsize 23 -fill "$SUB" -gravity northwest -annotate +40+76 \
    "every machine grounded, fed, powered and vented · pixels pour only from their own exhaust stack or vent, never from the feed" \
  -font $BOLD -pointsize 24 -fill "$ACC" -gravity northwest -annotate +40+118 "STAGE 1 · the day they land — chunky low poly" \
  -font $BOLD -pointsize 24 -fill "$ACC" -gravity northwest -annotate +40+478 "STAGE 6 · decades running — full PBR, meadow and moss" \
  $T/base.png

# row images + names
spec_rows() { # SUFFIX YIMG YNAME YS1 YS2 YS3
  local sfx=$1 yimg=$2 yname=$3 ys1=$4 ys2=$5 ys3=$6 i x
  for i in 0 1 2 3 4 5 6 7; do
    x=$((54 + i*308))
    convert $T/base.png \( "$T/${sfx}$i.png" \) -gravity northwest -geometry +$x+$yimg -composite \
      \( "$T/${sfx}n$i.png" \) -gravity northwest -geometry +$x+$yname -composite $T/base.png
    convert $T/base.png -font $FONT -pointsize 21 -fill "$ACC" -gravity northwest -annotate +$x+$ys1 "${JOBS[$i]}" $T/base.png
  done
}
spec_rows s1 168 341 371 0 0
spec_rows s6 528 701 731 0 0

# per-column two spec lines (in/out + support)
inout() { # sfx ys1 ys2
  local sfx=$1 ya=$2 yb=$3 i x
  for i in 0 1 2 3 4 5 6 7; do
    x=$((54 + i*308))
    if [ "$sfx" = s1 ]; then A="${S1S[$i]}"; B="${S1B[$i]}"; fi
    convert $T/base.png -font $FONT -pointsize 15 -fill "$FG" -gravity northwest \
      -annotate +$x+$ya "$A" -annotate +$x+$yb "$B" $T/base.png
    convert $T/base.png -font $FONT -pointsize 15 -fill "$SUB" -gravity northwest \
      -annotate +$x+$((yb+22)) "${S1C[$i]}" $T/base.png
  done
}
inout s1 397 419
inout s6 757 779

# footer: 4 columns
fcol() { convert $T/base.png -font $BOLD -pointsize 24 -fill "$ACC" -gravity northwest -annotate +$1+880 "$2" \
  -font $FONT -pointsize 20 -fill "$FG" -gravity northwest \
  -annotate +$1+922 "$3" -annotate +$1+952 "$4" -annotate +$1+982 "$5" -annotate +$1+1012 "$6" $T/base.png; }
fcol 40   "POWER" "start: gate junction box at the pad" "later: power unit feeds the spans" "relay pylons carry the sag lines" "one drop cable per machine"
fcol 720  "WHAT PIXELS ADD" "pink texture - green shape" "amber light - cyan water" "violet presets" "a machine that is off adds nothing"
fcol 1400 "IN vs OUT (owner's rule)" "material IN at a dark feed:" "hopper / tray / scree / slots" "pixels OUT of a separate stack or" "vent on top-rear or back — never shared"
fcol 2060 "FOR THE OWNER" "mark the machine set to build" "first; the drill's faint wisp" "is unrefined motes — keep or" "drop it?" 
convert $T/base.png -font $FONT -pointsize 20 -fill "$SUB" -gravity northwest \
  -annotate +40+1080 "bottom row: the same eight machines decades later — same pose, same feed and exhaust, weathered and mossy in the meadow they made" \
  -strip -define png:compression-level=9 "$ROOT/12-sheet-field-machines.png"
identify -format "%f %wx%h %b\n" "$ROOT/12-sheet-field-machines.png"
