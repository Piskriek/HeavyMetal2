import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));

async function keyCrowd() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  const srcPath = 'C:\\Users\\Pierro\\.gemini\\antigravity-ide\\brain\\4aba5a0a-ba24-41af-ac87-97e65ed56395\\cheering_crowd_magenta_1789885905438.jpg';
  const destPath = join(root, 'public/art/foreground-crowd.png');

  const base64 = readFileSync(srcPath).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  const pngDataUrl = await page.evaluate(async ({ dataUrl }) => {
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

        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];

          // Magenta keying: High Red, High Blue, Low Green
          const isMagenta = r > 150 && b > 140 && g < 100 && (r - g > 70) && (b - g > 70);
          const isMagentaFringe = r > 120 && b > 110 && g < 120 && (r - g > 40) && (b - g > 40);

          if (isMagenta) {
            d[i + 3] = 0; // completely transparent
          } else if (isMagentaFringe) {
            // Soft blend or clear
            const diff = Math.min(r - g, b - g);
            if (diff > 50) {
              d[i + 3] = 0;
            } else {
              d[i + 3] = Math.max(0, 255 - (diff - 40) * 25);
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }, { dataUrl });

  const buffer = Buffer.from(pngDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  writeFileSync(destPath, buffer);
  console.log(`Successfully keyed crowd to ${destPath}! Size: ${Math.round(buffer.length / 1024)} KB`);

  await browser.close();
}

keyCrowd().catch(console.error);
