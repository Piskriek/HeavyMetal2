import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

const pineSrc = 'C:/Users/Pierro/.gemini/antigravity-ide/brain/4aba5a0a-ba24-41af-ac87-97e65ed56395/treewall_pine_cluster_1789762382194.jpg';
const boomtownDeadwoodSrc = 'C:/Users/Pierro/.gemini/antigravity-ide/brain/4aba5a0a-ba24-41af-ac87-97e65ed56395/treewall_boomtown_deadwood_1789796351694.jpg';
const woolySnowSrc = 'C:/Users/Pierro/.gemini/antigravity-ide/brain/4aba5a0a-ba24-41af-ac87-97e65ed56395/treewall_wooly_snow_trees_1789796268641.jpg';

async function processImage(page, srcPath, outName) {
  const buf = await readFile(srcPath);
  const base64 = `data:image/jpeg;base64,${buf.toString('base64')}`;

  const pngBase64 = await page.evaluate(async ({ base64 }) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = base64;
    });

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Detect magenta background: high R and B, low G
    const isMagenta = (r, g, b) => {
      const minRB = Math.min(r, b);
      return minRB > 85 && g < minRB * 0.78 && (r + b) - g * 2 > 80;
    };

    const matte = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (isMagenta(r, g, b)) {
        matte[i] = 1;
      }
    }

    // Despill and alpha feather on the boundary
    let minX = w, minY = h, maxX = 0, maxY = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const p = idx * 4;
        if (matte[idx]) {
          data[p + 3] = 0;
        } else {
          // Check if near matte for despill & anti-aliasing
          let nearMatte = 0;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h && matte[ny * w + nx]) {
                nearMatte++;
              }
            }
          }

          if (nearMatte > 0) {
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];
            const maxAllowed = Math.max(g * 1.25, 45);
            if (r > maxAllowed && b > maxAllowed) {
              data[p] = Math.min(r, Math.round(maxAllowed));
              data[p + 2] = Math.min(b, Math.round(maxAllowed * 0.9));
            }
            if (nearMatte > 12) {
              data[p + 3] = Math.round(data[p + 3] * 0.4);
            } else if (nearMatte > 6) {
              data[p + 3] = Math.round(data[p + 3] * 0.75);
            }
          }

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Crop to bounding box
    const cropW = Math.max(1, maxX - minX + 1);
    const cropH = Math.max(1, maxY - minY + 1);
    const cropped = document.createElement('canvas');
    cropped.width = cropW;
    cropped.height = cropH;
    cropped.getContext('2d').drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    return cropped.toDataURL('image/png').split(',')[1];
  }, { base64 });

  const outPath = join(root, 'public/art', outName);
  await writeFile(outPath, Buffer.from(pngBase64, 'base64'));
  console.log(`Wrote ${outName} (${pngBase64.length} bytes base64)`);
}

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await processImage(page, boomtownDeadwoodSrc, 'treewall-boomtown.png');
  await processImage(page, woolySnowSrc, 'treewall-sheep.png');
  await browser.close();
}

run().catch(console.error);
