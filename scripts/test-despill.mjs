import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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

async function testClean() {
  const browser = await chromium.launch({ executablePath: getExecutablePath(), headless: true });
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  const testFile = join(root, 'public/art/props/alpha/prop-01-lantern-post-triple.png');
  const b64 = readFileSync(testFile).toString('base64');
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

        // Pass 1: Clear any lingering pure/near-pure magenta matte pixels
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3];
          if (a === 0) continue;
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];

          // High R and B, low G
          const isMagenta = (r > 150 && b > 150 && g < 90 && (r - g > 50) && (b - g > 50)) ||
                            (r > 200 && b > 180 && g < 120 && (r - g > 70) && (b - g > 70));
          if (isMagenta) {
            d[i + 3] = 0;
            clearedMatte++;
          }
        }

        // Pass 2: Detect edge pixels (pixels adjacent to transparent pixels)
        // We find distance to transparency (up to 3 pixels)
        const isEdge = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (d[idx * 4 + 3] === 0) continue;

            // Check 3x3 neighbors
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

        // Erode edge pixels that have significant magenta tint
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
              if ((r > g + 15 && b > g + 15 && (r > 70 && b > 70)) ||
                  (a < 180 && r > g + 10 && b > g + 10)) {
                d[pIdx + 3] = 0;
                erodedFringe++;
              }
            }
          }
        }

        // Pass 3: Despill color on the new boundary & semi-transparent pixels
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const pIdx = idx * 4;
            const a = d[pIdx + 3];
            if (a === 0) continue;

            const r = d[pIdx];
            const g = d[pIdx + 1];
            const b = d[pIdx + 2];

            // Check if magenta excess exists
            if (r > g && b > g) {
              const excess = Math.min(r - g, b - g);
              if (excess > 8) {
                // If semi-transparent OR adjacent to transparent, despill
                let nearTrans = a < 250;
                if (!nearTrans) {
                  // Check 5x5 box
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
                  // Remove excess magenta from Red and Blue channels
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
          dataUrl: canvas.toDataURL('image/png'),
        });
      };
      img.src = dataUrl;
    });
  }, { dataUrl });

  console.log('Test clean results for prop-01:');
  console.log('  clearedMatte:', result.clearedMatte);
  console.log('  erodedFringe:', result.erodedFringe);
  console.log('  despilledPixels:', result.despilledPixels);

  await browser.close();
}

testClean().catch(console.error);
