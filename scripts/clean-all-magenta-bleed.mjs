import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
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

function getTargetFiles() {
  const files = [];

  function scanDir(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip raw props directory (which intentionally has solid magenta backdrop), and concepts
        if (full === join(root, 'public/art/props') || entry.name === 'concepts' || entry.name === 'sheets') {
          // If public/art/props, specifically include public/art/props/alpha
          if (full === join(root, 'public/art/props')) {
            const alphaDir = join(full, 'alpha');
            if (existsSync(alphaDir)) scanDir(alphaDir);
          }
          continue;
        }
        scanDir(full);
      } else if (entry.name.endsWith('.png') && !entry.name.includes('-sheet')) {
        files.push(full);
      }
    }
  }

  scanDir(join(root, 'public/art'));
  return files;
}

async function cleanAll() {
  const executablePath = getExecutablePath();
  console.log('Launching headless browser with:', executablePath);
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  const targets = getTargetFiles();
  console.log(`Starting cleanup on ${targets.length} target PNG files...\n`);

  let totalCleanedMatte = 0;
  let totalErodedFringe = 0;
  let totalDespilled = 0;
  let processedCount = 0;

  for (const filePath of targets) {
    const rel = filePath.replace(root, '').replace(/\\/g, '/');
    const b64 = readFileSync(filePath).toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;

    const result = await page.evaluate(async ({ dataUrl }) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.getElementById('c');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const w = canvas.width;
          const h = canvas.height;
          const imgData = ctx.getImageData(0, 0, w, h);
          const d = imgData.data;

          let clearedMatte = 0;
          let erodedFringe = 0;
          let despilledPixels = 0;

          // Pass 1: Clear lingering pure / near-pure magenta matte remnants
          for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3];
            if (a === 0) continue;
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];

            // Magenta: High R and B, low G
            const isPureMagenta =
              (r > 150 && b > 150 && g < 90 && (r - g > 50) && (b - g > 50)) ||
              (r > 190 && b > 170 && g < 130 && (r - g > 60) && (b - g > 60)) ||
              (r > 110 && b > 110 && g < 40 && (r - g > 60) && (b - g > 60));

            if (isPureMagenta) {
              d[i + 3] = 0;
              clearedMatte++;
            }
          }

          // Pass 2: Identify edge pixels that border transparency (3x3 neighborhood)
          const isEdge = new Uint8Array(w * h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              if (d[idx * 4 + 3] === 0) continue;

              let touchesTransparent = false;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const nx = x + dx;
                  const ny = y + dy;
                  if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
                    touchesTransparent = true;
                    break;
                  }
                  if (d[(ny * w + nx) * 4 + 3] === 0) {
                    touchesTransparent = true;
                    break;
                  }
                }
                if (touchesTransparent) break;
              }
              if (touchesTransparent) {
                isEdge[idx] = 1;
              }
            }
          }

          // Erode fringe pixels on the boundary that have noticeable magenta tint
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              if (isEdge[idx] === 1) {
                const pIdx = idx * 4;
                const r = d[pIdx];
                const g = d[pIdx + 1];
                const b = d[pIdx + 2];
                const a = d[pIdx + 3];

                // If edge pixel has magenta tint
                if (
                  (r > g + 15 && b > g + 15 && r > 65 && b > 65) ||
                  (a < 190 && r > g + 10 && b > g + 10) ||
                  (r > 140 && b > 140 && g < 100)
                ) {
                  d[pIdx + 3] = 0;
                  erodedFringe++;
                }
              }
            }
          }

          // Pass 3: Despill color on the new boundary & semi-transparent pixels (5x5 neighborhood)
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              const pIdx = idx * 4;
              const a = d[pIdx + 3];
              if (a === 0) continue;

              const r = d[pIdx];
              const g = d[pIdx + 1];
              const b = d[pIdx + 2];

              if (r > g && b > g) {
                const excess = Math.min(r - g, b - g);
                if (excess > 6) {
                  let nearTrans = a < 250;
                  if (!nearTrans) {
                    for (let dy = -2; dy <= 2; dy++) {
                      for (let dx = -2; dx <= 2; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                          if (d[(ny * w + nx) * 4 + 3] === 0) {
                            nearTrans = true;
                            break;
                          }
                        }
                      }
                      if (nearTrans) break;
                    }
                  }

                  if (nearTrans) {
                    d[pIdx] = Math.max(0, r - excess);
                    d[pIdx + 2] = Math.max(0, b - excess);
                    despilledPixels++;
                  }
                }
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          resolve({
            clearedMatte,
            erodedFringe,
            despilledPixels,
            cleanedDataUrl: (clearedMatte > 0 || erodedFringe > 0 || despilledPixels > 0)
              ? canvas.toDataURL('image/png')
              : null,
          });
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      });
    }, { dataUrl });

    if (result && result.cleanedDataUrl) {
      const buffer = Buffer.from(result.cleanedDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
      writeFileSync(filePath, buffer);

      totalCleanedMatte += result.clearedMatte;
      totalErodedFringe += result.erodedFringe;
      totalDespilled += result.despilledPixels;
      processedCount++;

      console.log(`✓ ${rel.padEnd(52)} matte=${result.clearedMatte} fringe=${result.erodedFringe} despill=${result.despilledPixels}`);
    } else {
      console.log(`- ${rel.padEnd(52)} (clean, no magenta bleed)`);
    }
  }

  await browser.close();

  console.log(`\n========================================`);
  console.log(`Cleaned ${processedCount} / ${targets.length} files:`);
  console.log(`  Total Matte Pixels Cleared: ${totalCleanedMatte.toLocaleString()}`);
  console.log(`  Total Fringe Pixels Eroded: ${totalErodedFringe.toLocaleString()}`);
  console.log(`  Total Pixels Despilled:     ${totalDespilled.toLocaleString()}`);
  console.log(`========================================`);
}

cleanAll().catch(console.error);
