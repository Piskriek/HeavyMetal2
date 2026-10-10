#!/bin/bash
# Build contact-sheet.jpg from the 12 deliverable PNGs. Usage: bash tools/contact.sh
set -e
D="$(cd "$(dirname "$0")/.." && pwd)"; T="$D/scratch/contact"; mkdir -p "$T"
BG="#14161a"; FG="#e8eaee"; FONT=DejaVu-Sans; BOLD=DejaVu-Sans-Bold
names=( "01 · lab-first-play" "02 · gate-power-on" "03 · gate-on-your-plot"
        "04 · menu-setmix" "05 · menu-goblin-racing" "06 · sheet-gate"
        "07 · sheet-lab-power-and-machines" "08 · plot-stage-ladder" "09 · sheet-coverage-growth"
        "10 · plot-stage-6-hero" "11 · desolate-horizon" "12 · sheet-field-machines"
        "13 · sheet-base-construction" "14 · outpost-stage-3" )
files=( 01-lab-first-play 02-gate-power-on 03-gate-on-your-plot
        04-menu-setmix 05-menu-goblin-racing 06-sheet-gate
        07-sheet-lab-power-and-machines 08-plot-stage-ladder 09-sheet-coverage-growth
        10-plot-stage-6-hero 11-desolate-horizon 12-sheet-field-machines
        13-sheet-base-construction 14-outpost-stage-3 )
names+=( "15 · sheet-base-roofs-openings" )
files+=( 15-sheet-base-roofs-openings )
names+=( "17 · sheet-heavy-terraformers" )
files+=( 17-sheet-heavy-terraformers )
names+=( "18 · sheet-life-support" )
files+=( 18-sheet-life-support )
names+=( "19 · sheet-vehicle-fabricator" )
files+=( 19-sheet-vehicle-fabricator )
names+=( "20 · sheet-weapons" )
files+=( 20-sheet-weapons )
convert -size 2620x1800 xc:"$BG" "$T/base.png"
convert "$T/base.png" -background "$BG" -gravity northwest -extent 2620x2200 "$T/base.png"
for i in "${!files[@]}"; do
  col=$(( i % 4 )); row=$(( i / 4 ))
  x=$(( 40 + col * 640 )); y=$(( 40 + row * 432 ))
  convert "$D/${files[$i]}.png" -resize 600x338^ -gravity center -extent 600x338 "$T/t$i.png"
  convert "$T/base.png" \
    \( "$T/t$i.png" \) -gravity northwest -geometry +${x}+$(( y + 34 )) -composite \
    -font $BOLD -pointsize 22 -fill "$FG" -gravity northwest -annotate +$(( x + 2 ))+$(( y + 4 )) "${names[$i]}" \
    "$T/base.png"
done
convert "$T/base.png" -quality 92 -strip "$D/contact-sheet.jpg"
identify -format "%f %wx%h %b\n" "$D/contact-sheet.jpg"
