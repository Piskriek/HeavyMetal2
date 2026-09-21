import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { encodePng } from './edge-magenta-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = join(root, 'public/art/props/alpha');
mkdirSync(outDir, { recursive: true });

const brainDir = 'C:\\Users\\Pierro\\.gemini\\antigravity-ide\\brain\\4aba5a0a-ba24-41af-ac87-97e65ed56395';
const src = join(brainDir, 'goblin_start_archway_1789987984106.jpg');
const dest = join(outDir, 'prop-51-goblin-start-archway.png');

async function run() {
  console.log('Launching browser to decode and key start archway...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  const base64 = readFileSync(src).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  const raw = await page.evaluate(async (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.getElementById('c');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        const w = canvas.width;
        const h = canvas.height;

        for (let i = 0; i < w * h; i++) {
          const p = i * 4;
          const r = d[p], g = d[p + 1], b = d[p + 2];
          // Pure magenta matte check (symmetric high R & B, low G)
          const isMagenta = (r > 130 && b > 130 && Math.min(r - g, b - g) >= 35 && Math.abs(r - b) <= 70);
          if (isMagenta) {
            d[p + 3] = 0;
            // neutralize RGB
            d[p] = Math.min(r, g);
            d[p + 2] = Math.min(b, g);
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve({ w, h, dataUrl: canvas.toDataURL('image/png') });
      };
      img.src = dataUrl;
    });
  }, dataUrl);

  await browser.close();

  const base64Data = raw.dataUrl.replace(/^data:image\/png;base64,/, '');
  writeFileSync(dest, Buffer.from(base64Data, 'base64'));
  console.log(`Saved keyed archway to ${dest} (${raw.w}x${raw.h})`);
}

run().catch(console.error);
