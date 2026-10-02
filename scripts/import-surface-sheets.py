"""
Turn the texture agent's 2x2 PBR sheets into the two tile files the terrain uses:
  top-left  = base colour      -> textures/island/<name>.webp      (256x256 RGB)
  top-right = tangent normal   -> R,G of textures/island-pbr/<name>.webp
  bottom-left = roughness      -> B of textures/island-pbr/<name>.webp
(bottom-right AO/height is not used by the terrain shader.)
Usage: python scripts/import-surface-sheets.py <sheet.png> [more sheets ...]   (the file name's first part becomes the tile name)
"""
import os
import re
import sys
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public", "textures")
SIZE = 256

def tile_name(path: str) -> str:
    stem = os.path.splitext(os.path.basename(path))[0]
    stem = re.sub(r"-pbr-sheet$", "", re.sub(r"^m\d+-", "", stem, flags=re.I))
    return stem.lower()

def convert(path: str) -> str:
    sheet = Image.open(path).convert("RGB")
    h = sheet.width // 2
    quad = lambda x, y: sheet.crop((x * h, y * h, (x + 1) * h, (y + 1) * h)).resize((SIZE, SIZE), Image.LANCZOS)
    base, normal, rough = quad(0, 0), quad(1, 0), quad(0, 1).convert("L")
    pbr = Image.merge("RGB", (normal.getchannel("R"), normal.getchannel("G"), rough))
    name = tile_name(path)
    for sub, img in (("island", base), ("island-pbr", pbr)):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)
        img.save(os.path.join(OUT, sub, name + ".webp"), "WEBP", quality=88, method=6)
    return name

if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(convert(p))
