import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));

async function clean() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  const pinesPath = join(root, 'public/art/landmark-pines.png');
  const pinesBase64 = readFileSync(pinesPath).toString('base64');
  const dataUrl = `data:image/png;base64,${pinesBase64}`;

  const cleanedDataUrl = await page.evaluate(async ({ dataUrl }) => {
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

        let clearedCount = 0;

        // Pass 1: Clear all magenta / purple pixels throughout image
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const a = d[i + 3];

          if (a > 0) {
            const isMagentaPurple =
              (b > g + 18 && r > g + 15) ||
              (b > 65 && r > 45 && g < 40) ||
              (r > 120 && b > 90 && g < 100 && (r - g > 25 || b - g > 20)) ||
              (r > 170 && b > 100 && g < 130 && r - g > 30);

            if (isMagentaPurple) {
              d[i + 3] = 0;
              clearedCount++;
            }
          }
        }

        // Pass 2: Erode fringe pixels on the boundary that have any violet tint
        for (let pass = 0; pass < 2; pass++) {
          const toClear = [];
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const idx = (y * w + x) * 4;
              if (d[idx + 3] > 0) {
                const r = d[idx];
                const g = d[idx + 1];
                const b = d[idx + 2];

                const leftA = d[idx - 4 + 3];
                const rightA = d[idx + 4 + 3];
                const upA = d[idx - w * 4 + 3];
                const downA = d[idx + w * 4 + 3];

                if (leftA === 0 || rightA === 0 || upA === 0 || downA === 0) {
                  // If border pixel leans purple or violet
                  if ((b > g + 8 && r > g + 8) || (r > g + 25 && b > g) || (b > g + 20)) {
                    toClear.push(idx + 3);
                  }
                }
              }
            }
          }
          toClear.forEach((alphaIdx) => {
            d[alphaIdx] = 0;
            clearedCount++;
          });
        }

        console.log(`Total pixels cleared: ${clearedCount}`);
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }, { dataUrl });

  const cleanedBuffer = Buffer.from(cleanedDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  writeFileSync(pinesPath, cleanedBuffer);
  console.log(`Successfully defringed landmark-pines.png! Size: ${Math.round(cleanedBuffer.length / 1024)} KB`);

  await browser.close();
}

clean().catch(console.error);
