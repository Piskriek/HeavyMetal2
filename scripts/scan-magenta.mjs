import { readdirSync, statSync, existsSync } from 'node:fs';
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
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return undefined;
}

function findPngs(dir) {
  let results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'sheets' && entry.name !== 'concepts' && entry.name !== 'source') {
        results = results.concat(findPngs(fullPath));
      }
    } else if (entry.name.endsWith('.png') && !entry.name.includes('-sheet')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function scan() {
  const executablePath = getExecutablePath();
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  const pngs = findPngs(join(root, 'public/art'));
  console.log(`Found ${pngs.length} PNGs to scan in public/art...`);

  const report = [];

  for (const file of pngs) {
    const rel = file.replace(root, '').replace(/\\/g, '/');
    // Skip raw props directory (which intentionally has solid magenta backdrop)
    if (rel.startsWith('public/art/props/') && !rel.startsWith('public/art/props/alpha/')) {
      continue;
    }

    const { readFileSync } = await import('node:fs');
    const b64 = readFileSync(file).toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;

    const stats = await page.evaluate(async ({ dataUrl }) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.getElementById('c');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let magentaPixelCount = 0;
          let fringeMagentaCount = 0;
          const w = canvas.width;
          const h = canvas.height;

          for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            const a = d[i + 3];

            if (a > 0) {
              // Magenta signature: high R, high B, low G
              const isPureMagenta = r > 200 && b > 200 && g < 50;
              const isMagentaFringe = r > 120 && b > 120 && (r - g > 30) && (b - g > 30) && (r + b - 2 * g > 80);

              if (isPureMagenta) magentaPixelCount++;
              else if (isMagentaFringe) fringeMagentaCount++;
            }
          }

          resolve({
            width: canvas.width,
            height: canvas.height,
            magentaPixelCount,
            fringeMagentaCount,
          });
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      });
    }, { dataUrl });

    if (stats && (stats.magentaPixelCount > 0 || stats.fringeMagentaCount > 50)) {
      report.push({
        file: rel,
        ...stats,
      });
      console.log(`[MAGENTA DETECTED] ${rel.padEnd(50)} pure=${stats.magentaPixelCount} fringe=${stats.fringeMagentaCount}`);
    }
  }

  await browser.close();
  console.log(`\nScan finished. Found ${report.length} files with magenta bleeding.`);
}

scan().catch(console.error);
