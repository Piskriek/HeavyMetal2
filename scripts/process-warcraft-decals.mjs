import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = join(root, 'public/art/decals');
mkdirSync(outDir, { recursive: true });

const brainDir = 'C:\\Users\\Pierro\\.gemini\\antigravity-ide\\brain\\4aba5a0a-ba24-41af-ac87-97e65ed56395';

const decals = [
  {
    src: join(brainDir, 'warcraft_grass_patch_1789931714951.jpg'),
    dest: join(outDir, 'decal-wc-grass-patch.png'),
    keyColor: 'black',
  },
  {
    src: join(brainDir, 'warcraft_rocky_dirt_1789931740217.jpg'),
    dest: join(outDir, 'decal-wc-rocky-dirt.png'),
    keyColor: 'black',
  },
  {
    src: join(brainDir, 'warcraft_mud_puddle_1789931752259.jpg'),
    dest: join(outDir, 'decal-wc-mud-puddle.png'),
    keyColor: 'black',
  },
  {
    src: join(brainDir, 'wc_grass_seam_magenta_1789932309402.jpg'),
    dest: join(outDir, 'decal-wc-grass-seam.png'),
    keyColor: 'magenta',
  },
  {
    src: join(brainDir, 'warcraft_flagstone_pavers_1789931804307.jpg'),
    dest: join(outDir, 'decal-wc-flagstone.png'),
    keyColor: 'black',
  },
  {
    src: join(brainDir, 'warcraft_gravel_stones_1789931814788.jpg'),
    dest: join(outDir, 'decal-wc-gravel.png'),
    keyColor: 'black',
  },
  {
    src: join(brainDir, 'warcraft_dirt_rut_1789931825227.jpg'),
    dest: join(outDir, 'decal-wc-cart-ruts.png'),
    keyColor: 'white',
  },
];

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  for (const item of decals) {
    const base64 = readFileSync(item.src).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    const pngDataUrl = await page.evaluate(
      async ({ dataUrl, keyColor }) => {
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

            // Flood-fill / connected component from corners to ensure internal dark/colored areas aren't removed
            const isBg = new Uint8Array(w * h);
            const queue = [];

            const isCornerBg = (idx) => {
              const r = d[idx * 4];
              const g = d[idx * 4 + 1];
              const b = d[idx * 4 + 2];
              if (keyColor === 'magenta') {
                return (
                  (r > 150 && b > 150 && g < 110) ||
                  (r > 130 && b > 130 && (r - g > 40) && (b - g > 40))
                );
              } else if (keyColor === 'black') {
                return r < 28 && g < 28 && b < 28;
              } else {
                return r > 235 && g > 235 && b > 235;
              }
            };

            // Seed border pixels
            for (let x = 0; x < w; x++) {
              queue.push(x, (h - 1) * w + x);
            }
            for (let y = 0; y < h; y++) {
              queue.push(y * w, y * w + (w - 1));
            }

            let qIdx = 0;
            while (qIdx < queue.length) {
              const idx = queue[qIdx++];
              if (idx < 0 || idx >= w * h || isBg[idx]) continue;
              if (isCornerBg(idx)) {
                isBg[idx] = 1;
                const x = idx % w;
                const y = Math.floor(idx / w);
                if (x > 0) queue.push(idx - 1);
                if (x < w - 1) queue.push(idx + 1);
                if (y > 0) queue.push(idx - w);
                if (y < h - 1) queue.push(idx + w);
              }
            }

            // Apply transparency
            for (let i = 0; i < w * h; i++) {
              const p = i * 4;
              if (isBg[i]) {
                d[p + 3] = 0; // completely transparent
              } else if (keyColor === 'magenta') {
                // Secondary check: remove any floating pure magenta pixels
                const r = d[p], g = d[p + 1], b = d[p + 2];
                if (r > 160 && b > 160 && g < 100 && (r - g > 60) && (b - g > 60)) {
                  d[p + 3] = 0;
                  isBg[i] = 1;
                }
              }
            }

            // Fringe erosion and despill for magenta
            if (keyColor === 'magenta') {
              // Identify edge pixels
              const isEdge = new Uint8Array(w * h);
              for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                  const idx = y * w + x;
                  if (d[idx * 4 + 3] === 0) continue;
                  let touchesBg = false;
                  for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                      const nx = x + dx, ny = y + dy;
                      if (nx < 0 || nx >= w || ny < 0 || ny >= h || isBg[ny * w + nx]) {
                        touchesBg = true;
                        break;
                      }
                    }
                    if (touchesBg) break;
                  }
                  if (touchesBg) isEdge[idx] = 1;
                }
              }

              // Erode fringe pixels with magenta tint
              for (let i = 0; i < w * h; i++) {
                if (isEdge[i]) {
                  const p = i * 4;
                  const r = d[p], g = d[p + 1], b = d[p + 2];
                  if ((r > g + 15 && b > g + 15 && r > 65 && b > 65) || (r > 130 && b > 130 && g < 110)) {
                    d[p + 3] = 0;
                    isBg[i] = 1;
                  }
                }
              }

              // Despill remaining boundary pixels (clamp R and B down to max(G, ...))
              for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                  const idx = y * w + x;
                  const p = idx * 4;
                  if (d[p + 3] === 0) continue;
                  let nearTrans = false;
                  for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                      const nx = x + dx, ny = y + dy;
                      if (nx < 0 || nx >= w || ny < 0 || ny >= h || d[(ny * w + nx) * 4 + 3] === 0) {
                        nearTrans = true;
                        break;
                      }
                    }
                    if (nearTrans) break;
                  }

                  if (nearTrans) {
                    const r = d[p], g = d[p + 1], b = d[p + 2];
                    if (r > g && b > g) {
                      const excess = Math.min(r - g, b - g);
                      if (excess > 5) {
                        d[p] = Math.max(0, r - excess);
                        d[p + 2] = Math.max(0, b - excess);
                      }
                    }
                  }
                }
              }
            } else {
              // Edge smoothing for black/white keys
              for (let i = 0; i < w * h; i++) {
                const p = i * 4;
                if (!isBg[i]) {
                  const x = i % w;
                  const y = Math.floor(i / w);
                  let neighborBg = false;
                  if (x > 0 && isBg[i - 1]) neighborBg = true;
                  if (x < w - 1 && isBg[i + 1]) neighborBg = true;
                  if (y > 0 && isBg[i - w]) neighborBg = true;
                  if (y < h - 1 && isBg[i + w]) neighborBg = true;

                  if (neighborBg) {
                    const r = d[p], g = d[p + 1], b = d[p + 2];
                    if (keyColor === 'black') {
                      const lum = (r + g + b) / 3;
                      d[p + 3] = Math.min(255, Math.max(0, (lum - 15) * 6));
                    } else {
                      const diff = 255 - ((r + g + b) / 3);
                      d[p + 3] = Math.min(255, Math.max(0, diff * 6));
                    }
                  }
                }
              }
            }

            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.src = dataUrl;
        });
      },
      { dataUrl, keyColor: item.keyColor }
    );

    const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(item.dest, Buffer.from(base64Data, 'base64'));
    console.log(`Saved transparent Warcraft decal: ${item.dest}`);
  }

  await browser.close();
  console.log('Finished processing Warcraft decals!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
