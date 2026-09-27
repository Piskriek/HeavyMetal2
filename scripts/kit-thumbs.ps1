# The builder's shelf icons for the Meshy models: each model's own Meshy render
# (art-src/meshy/<id>/thumbnail.png, 512 px, transparent) shrunk to 256 px.
#
#   powershell -ExecutionPolicy Bypass -File scripts/kit-thumbs.ps1 [-OutDir <folder>]
#
# Writes public/models/kit/thumbs/<id>.png for every id in public/models/kit/index.json. Pass -OutDir to
# write elsewhere first (Vite's watcher can crash on files landing in public/ while it runs).
param([string]$OutDir = "")

Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $root "public/models/kit/thumbs" }
New-Item -ItemType Directory -Force $OutDir | Out-Null
$ids = Get-Content (Join-Path $root "public/models/kit/index.json") -Raw | ConvertFrom-Json

foreach ($id in $ids) {
  $src = Join-Path $root "art-src/meshy/$id/thumbnail.png"
  if (-not (Test-Path $src)) { Write-Warning "no thumbnail for $id"; continue }
  $img = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($img, 0, 0, 256, 256)
  $g.Dispose(); $img.Dispose()
  $bmp.Save((Join-Path $OutDir "$id.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
Write-Host "Wrote $($ids.Count) icons to $OutDir"
