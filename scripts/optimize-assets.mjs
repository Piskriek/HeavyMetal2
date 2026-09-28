import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));

function getExecutablePath() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_PATH,
  ];
  for (const path of candidates) {
    if (path && existsSync(path)) return path;
  }
  return undefined;
}

async function optimize() {
  const executablePath = getExecutablePath();
  console.log('Using browser executable:', executablePath || 'bundled chromium');

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  // 1. Optimize the 10 Blizzard textures to 512x512
  const texNames = ['bark', 'caverock', 'cliff', 'cobble', 'dirt', 'grass', 'iron', 'lava', 'water', 'wood'];
  console.log('Optimizing textures to 512x512...');

  for (const name of texNames) {
    const filePath = join(root, `public/textures/${name}.png`);
    if (!existsSync(filePath)) continue;

    const base64 = readFileSync(filePath).toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    const optimizedBase64 = await page.evaluate(async ({ dataUrl }) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.getElementById('c');
          canvas.width = 512;
          canvas.height = 512;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 512, 512);
          // Export as high-quality WebP or PNG
          const res = canvas.toDataURL('image/webp', 0.88);
          resolve(res);
        };
        img.src = dataUrl;
      });
    }, { dataUrl });

    // Save as .webp
    const outWebpPath = join(root, `public/textures/${name}.webp`);
    const webpBuffer = Buffer.from(optimizedBase64.replace(/^data:image\/webp;base64,/, ''), 'base64');
    writeFileSync(outWebpPath, webpBuffer);

    // Also overwrite .png with a 512x512 optimized PNG so existing paths work
    const optimizedPngBase64 = await page.evaluate(async () => {
      const canvas = document.getElementById('c');
      return canvas.toDataURL('image/png');
    });
    const pngBuffer = Buffer.from(optimizedPngBase64.replace(/^data:image\/png;base64,/, ''), 'base64');
    writeFileSync(filePath, pngBuffer);

    console.log(`  ${name}: ${Math.round(pngBuffer.length / 1024)} KB PNG, ${Math.round(webpBuffer.length / 1024)} KB WebP`);
  }

  // 2. Defringe landmark-pines.png (remove magenta outline)
  console.log('Defringing landmark-pines.png...');
  const pinesPath = join(root, 'public/art/landmark-pines.png');
  if (existsSync(pinesPath)) {
    const pinesBase64 = readFileSync(pinesPath).toString('base64');
    const pinesDataUrl = `data:image/png;base64,${pinesBase64}`;

    const cleanedDataUrl = await page.evaluate(async ({ pinesDataUrl }) => {
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
            const a = d[i + 3];

            if (a > 0) {
              // Magenta detection: High red, high blue, low green
              // Magenta is typically (R > 140, B > 140, G < 100, and R+B - 2*G > 100)
              const isMagenta = r > 130 && b > 130 && g < 110 && (r - g > 40) && (b - g > 40);
              const isPurpleEdge = (r > 100 && b > 120 && g < 70) || (r > 160 && b > 140 && g < 120);

              if (isMagenta || isPurpleEdge) {
                // Clear the pixel
                d[i + 3] = 0;
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = pinesDataUrl;
      });
    }, { pinesDataUrl });

    const cleanedBuffer = Buffer.from(cleanedDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    writeFileSync(pinesPath, cleanedBuffer);
    console.log(`  landmark-pines.png cleaned! Size: ${Math.round(cleanedBuffer.length / 1024)} KB`);
  }

  await browser.close();
  console.log('Asset optimization complete!');
}

optimize().catch((err) => {
  console.error('Optimization error:', err);
  process.exit(1);
});
