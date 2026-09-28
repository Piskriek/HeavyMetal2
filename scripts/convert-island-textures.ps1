# Converts the Scrapwind Isle surface tiles (arena branch, public/art/concepts/scrapwind-isle, 1024 PNG
# ~2.3 MB each) into the runtime island surface set: public/textures/island/*.jpg (~300 KB each).
#
#   git fetch origin
#   git checkout origin/arena/01a0e78a-heavymetal2 -- public/art/concepts/scrapwind-isle
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/convert-island-textures.ps1
#   git restore --staged public/art/concepts ; Remove-Item -Recurse public/art/concepts/scrapwind-isle
#
# Windows PowerShell 5.1 (System.Drawing). Names here must match ISLAND_SURFACES in
# src/game/island-route/island-surfaces.ts.
param(
  [string]$Source = "public/art/concepts/scrapwind-isle",
  [string]$Target = "public/textures/island",
  [int]$Quality = 88
)
Add-Type -AssemblyName System.Drawing
$map = [ordered]@{
  "i01-tile-packed-sandy-dirt-race-track-surf.png" = "sand-packed.jpg"
  "i02-tile-wet-shoreline-sand-with-small-she.png" = "sand-wet.jpg"
  "i03-tile-shallow-turquoise-water-over-sand.png" = "shallows.jpg"
  "i04-tile-dark-boulder-rock.png"                 = "rock-dark.jpg"
  "i05-tile-weathered-wooden-planks-with-iron.png" = "planks-old.jpg"
  "i06-tile-riveted-iron-plate-with-brass-bol.png" = "iron-riveted.jpg"
  "i07-tile-faceted-dark-blue-crystal-surface.png" = "crystal.jpg"
  "i08-tile-short-beach-grass.png"                 = "grass-beach.jpg"
  "i09-tile-pebble-and-coral-scatter-on-sand.png"  = "sand-coral.jpg"
  "i10-tile-slate-granite-cliff-with-teal-sha.png" = "cliff-granite.jpg"
  "i25-blend-moss-creeping-over-dark-rock.png"     = "rock-moss.jpg"
  "i27-blend-cracked-dry-mud.png"                  = "mud-dry.jpg"
  "i29-blend-wind-rippled-sand-dunes.png"          = "sand-dunes.jpg"
  "i30-blend-granite-cliff-strata-band.png"        = "cliff-strata.jpg"
}
New-Item -ItemType Directory -Force $Target | Out-Null
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
foreach ($name in $map.Keys) {
  $src = Join-Path (Resolve-Path $Source) $name
  $dst = Join-Path (Resolve-Path $Target) $map[$name]
  $img = [System.Drawing.Image]::FromFile($src)
  try { $img.Save($dst, $codec, $params) } finally { $img.Dispose() }
  "{0,-22} {1,8:N0} bytes" -f $map[$name], (Get-Item $dst).Length
}
