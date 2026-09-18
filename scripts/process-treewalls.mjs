import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

const pineSrc = 'C:/Users/Pierro/.gemini/antigravity-ide/brain/4aba5a0a-ba24-41af-ac87-97e65ed56395/treewall_pine_cluster_1789762382194.jpg';
const boomtownSrc = 'C:/Users/Pierro/.gemini/antigravity-ide/brain/4aba5a0a-ba24-41af-ac87-97e65ed56395/treewall_boomtown_cluster_1789762414992.jpg';

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

    // Detect magenta background
    const isMagenta = (r, g, b) => {
      const minRB = Math.min(r, b);
      return minRB > 120 && g < minRB * 0.7 && (r + b) - g * 2 > 130;
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
                nearOuterMatte: {
                  nearMatte++;
                }
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

async function createSheepOrchard(page) {
  // Read landmark-pasture.png to integrate its painted stone wall & hay bales into the sheep orchard cluster
  const pastureBuf = await readFile(join(root, 'public/art/landmark-pasture.png'));
  const pastureBase64 = `data:image/png;base64,${pastureBuf.toString('base64')}`;

  const pngBase64 = await page.evaluate(async ({ pastureBase64 }) => {
    const pasture = new Image();
    await new Promise((res) => { pasture.onload = res; pasture.src = pastureBase64; });

    const w = 1000;
    const h = 800;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Helper to draw stylized deciduous tree canopies with volumetric puff clusters
    const drawDeciduousTree = (x, y, radius, trunkHeight, hueShift = 0) => {
      // Gnarled wood trunk
      ctx.save();
      ctx.fillStyle = '#3a2a1b';
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.18, y);
      ctx.quadraticCurveTo(x - radius * 0.08, y - trunkHeight * 0.5, x - radius * 0.12, y - trunkHeight);
      ctx.lineTo(x + radius * 0.12, y - trunkHeight);
      ctx.quadraticCurveTo(x + radius * 0.08, y - trunkHeight * 0.5, x + radius * 0.22, y);
      ctx.closePath();
      ctx.fill();

      // Trunk bark highlights
      ctx.strokeStyle = '#6a5136';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + radius * 0.05, y - 5);
      ctx.quadraticCurveTo(x + radius * 0.02, y - trunkHeight * 0.5, x + radius * 0.06, y - trunkHeight);
      ctx.stroke();

      // Foliage puffs
      const baseY = y - trunkHeight;
      const puffs = [
        { dx: 0, dy: -radius * 0.7, r: radius * 0.65, col: '#5d8032', high: '#8db84b' },
        { dx: -radius * 0.5, dy: -radius * 0.4, r: radius * 0.55, col: '#446324', high: '#6a9435' },
        { dx: radius * 0.45, dy: -radius * 0.45, r: radius * 0.58, col: '#6d9438', high: '#9bc952' },
        { dx: -radius * 0.3, dy: -radius * 0.1, r: radius * 0.5, col: '#3b541f', high: '#587c2f' },
        { dx: radius * 0.35, dy: -radius * 0.1, r: radius * 0.52, col: '#50702a', high: '#7da641' },
        { dx: 0, dy: -radius * 0.3, r: radius * 0.6, col: '#4d6c29', high: '#78a23d' },
      ];

      for (const p of puffs) {
        const px = x + p.dx;
        const py = baseY + p.dy;
        const rad = ctx.createRadialGradient(px + p.r * 0.3, py - p.r * 0.3, p.r * 0.1, px, py, p.r);
        rad.addColorStop(0, p.high);
        rad.addColorStop(0.65, p.col);
        rad.addColorStop(1, '#233814');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();

        // Little leaf texture dots
        ctx.fillStyle = '#a6d95b44';
        for (let i = 0; i < 7; i++) {
          const ang = i * 0.9;
          ctx.beginPath();
          ctx.arc(px + Math.cos(ang) * p.r * 0.4, py + Math.sin(ang) * p.r * 0.4, p.r * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    // Layer 1: Background trees
    drawDeciduousTree(240, 680, 160, 220, -10);
    drawDeciduousTree(760, 680, 170, 230, 10);
    drawDeciduousTree(480, 660, 190, 260, 5);

    // Layer 2: Midground trees
    drawDeciduousTree(150, 720, 140, 180, 0);
    drawDeciduousTree(850, 710, 150, 190, -5);
    drawDeciduousTree(350, 700, 175, 210, 8);
    drawDeciduousTree(620, 710, 165, 200, -8);

    // Layer 3: Foreground stone wall & hay bales from pasture asset
    const pw = 450;
    const ph = pw * pasture.height / pasture.width;
    ctx.drawImage(pasture, 275, 780 - ph, pw, ph);

    return canvas.toDataURL('image/png').split(',')[1];
  }, { pastureBase64 });

  await writeFile(join(root, 'public/art/treewall-sheep.png'), Buffer.from(pngBase64, 'base64'));
  console.log('Wrote treewall-sheep.png');
}

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await processImage(page, pineSrc, 'treewall-pines.png');
  await processImage(page, boomtownSrc, 'treewall-boomtown.png');
  await createSheepOrchard(page);
  await browser.close();
}

run().catch(console.error);
