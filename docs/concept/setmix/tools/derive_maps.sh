#!/bin/bash
# derive_maps.sh ALBEDO.png NORMAL.png ROUGHNESS.png
# Normal map: from Sobel gradients of luminance (mid-grey = flat, Z ~86%).
# Roughness: luminance remapped into a mostly-rough range. For concept targets.
set -e
A="$1"; N="$2"; R="$3"
convert "$A" -colorspace Gray -blur 0x1.6 /tmp/_hm_h.png
convert /tmp/_hm_h.png -define convolve:scale=1 -bias 50% -convolve "3x3: -1 0 1 -2 0 2 -1 0 1" -level 35%,65% /tmp/_hm_gx.png
convert /tmp/_hm_h.png -define convolve:scale=1 -bias 50% -convolve "3x3: -1 -2 -1 0 0 0 1 2 1" -level 35%,65% /tmp/_hm_gy.png
S=$(identify -format "%wx%h" "$A")
convert /tmp/_hm_gx.png /tmp/_hm_gy.png \( -size $S xc:gray86 \) -combine -colorspace sRGB "$N"
convert "$A" -colorspace Gray -level 0%,100% -evaluate multiply 0.32 -evaluate add 60% "$R"
rm -f /tmp/_hm_h.png /tmp/_hm_gx.png /tmp/_hm_gy.png
