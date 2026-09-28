import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));

async function inspect() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  const pinesPath = join(root, 'public/art/landmark-pines.png');
  const pinesBase64 = readFileSync(pinesPath).toString('base64');
  const dataUrl = `data:image/png;base64,${pinesBase64}`;

  const colors = await page.evaluate(async ({ dataUrl }) => {
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

        // Sample edge pixels
        const edgeColors = [];
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            if (d[idx + 3] > 0) {
              // check if neighbor is transparent
              const leftA = d[idx - 4 + 3];
              const rightA = d[idx + 4 + 3];
              const upA = d[idx - w * 4 + 3];
              const downA = d[idx + w * 4 + 3];
              if (leftA === 0 || rightA === 0 || upA === 0 || downA === 0) {
                edgeColors.push({
                  r: d[idx],
                  g: d[idx + 1],
                  b: d[idx + 2],
                  a: d[idx + 3]
                });
              }
            }
          }
        }
        resolve(edgeColors.slice(0, 50));
      };
      img.src = dataUrl;
    });
  }, { dataUrl });

  console.log('Sample edge pixels:', colors);
  await browser.close();
}

inspect().catch(console.error);
