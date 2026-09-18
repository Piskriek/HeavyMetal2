Add-Type -AssemblyName System.Drawing

function Crop-Image($srcPath, $destPath, $x, $y, $w, $h) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $w, $h)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $src.Dispose()
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Saved $destPath with size $w x $h"
}

Crop-Image 'C:\Users\Pierro\.gemini\antigravity-ide\brain\4aba5a0a-ba24-41af-ac87-97e65ed56395\sign_sheep_billboard_1789752604066.jpg' 'C:\MarbleGp\public\art\sign-sheep.png' 22 28 1332 712
Crop-Image 'C:\Users\Pierro\.gemini\antigravity-ide\brain\4aba5a0a-ba24-41af-ac87-97e65ed56395\sign_tnt_billboard_1789752630534.jpg' 'C:\MarbleGp\public\art\sign-tnt.png' 24 24 1328 720
Crop-Image 'C:\Users\Pierro\.gemini\antigravity-ide\brain\4aba5a0a-ba24-41af-ac87-97e65ed56395\sign_parts_billboard_1789752666123.jpg' 'C:\MarbleGp\public\art\sign-parts.png' 18 18 1340 732
