#!/bin/bash
# Shared helpers for SetMix sheet composition.
S="$(cd "$(dirname "$0")/.." && pwd)/scratch/panels"   # panels live in scratch (git-ignored)
BG="#17191d"; PNL="#101216"; FG="#e8eaee"; SUB="#9aa3b0"; ACC="#ffc13d"
FONT=DejaVu-Sans; BOLD=DejaVu-Sans-Bold
cropfill() { convert "$1" -resize "${2}^" -gravity center -extent "$2" -strip "$3"; }
cellbar() { convert -size ${2}x40 xc:"$PNL" \( -size 6x40 xc:"${4:-$ACC}" \) -gravity west -composite \
  -font $BOLD -pointsize 22 -fill "$FG" -gravity west -annotate +18+1 "$3" "$1"; }
badge() { local tmp=$(mktemp -u --suffix=.png)
  convert -background "#000000aa" -fill "$FG" -font $BOLD -pointsize 24 label:"$3" "$tmp"
  convert "$1" "$tmp" -gravity northwest -geometry +14+14 -composite "$2"; rm -f "$tmp"; }
