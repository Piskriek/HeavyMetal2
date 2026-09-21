import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const texOut = join(root, 'public/textures/grass-fringe.png');
const decalOut = join(root, 'public/art/decals/grass-fringe.png');

async function main() {
  console.log('Synthesizing painterly Warcraft-style seamless grass fringe...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  const pngBase64 = await page.evaluate(() => {
    const W = 1024;
    const H = 256;
    const canvas = document.getElementById('c');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Pseudo-random generator with fixed seed for determinism
    let s = 123456789;
    function rand() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    }

    // Clear to transparent
    ctx.clearRect(0, 0, W, H);

    // Helpers to draw wrapping shapes across horizontal boundary
    function wrapDraw(fn) {
      for (const ox of [-W, 0, W]) {
        ctx.save();
        ctx.translate(ox, 0);
        fn();
        ctx.restore();
      }
    }

    // 1. BASE ROOT ZONE (at the bottom, y from H*0.55 down to H)
    // Deep mossy soil and dense undergrowth that connects to terrain grass
    wrapDraw(() => {
      // Solid base rectangle at the very bottom
      const rootGrad = ctx.createLinearGradient(0, H * 0.45, 0, H);
      rootGrad.addColorStop(0, 'rgba(42, 68, 20, 0.0)');
      rootGrad.addColorStop(0.3, 'rgba(42, 68, 20, 0.85)');
      rootGrad.addColorStop(0.6, 'rgba(48, 76, 24, 0.98)');
      rootGrad.addColorStop(1, 'rgba(56, 88, 28, 1.0)');

      ctx.fillStyle = rootGrad;
      ctx.fillRect(0, H * 0.45, W, H * 0.55);

      // Organic mossy mounds along the root line
      for (let x = 0; x < W; x += 18) {
        const mh = 35 + rand() * 45;
        const my = H * 0.65 - (mh * 0.4);
        const mw = 28 + rand() * 32;

        const mg = ctx.createRadialGradient(x, my + mh * 0.5, 5, x, my + mh * 0.5, mw);
        mg.addColorStop(0, 'rgba(58, 92, 28, 0.95)');
        mg.addColorStop(0.7, 'rgba(42, 66, 20, 0.8)');
        mg.addColorStop(1, 'rgba(32, 50, 14, 0)');

        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.ellipse(x, my + mh * 0.5, mw, mh * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 2. PAINTERLY WARCRAFT-STYLE GRASS TUFTS
    // Each tuft has a cluster of broad, curved, stylized blades
    // Color palette matching decal-wc-grass-patch:
    // Shadow:   #253d12 (37, 61, 18)
    // Midtone:  #4e7c24 (78, 124, 36)
    // Rich:     #5e962b (94, 150, 43)
    // Sunlit:   #8ebd38 (142, 189, 56)
    // Highlight:#add848 (173, 216, 72)

    function drawWarcraftBlade(x0, y0, length, width, angleDeg, curveFactor, hueShift) {
      wrapDraw(() => {
        const rad = (angleDeg * Math.PI) / 180;
        const cpX = x0 + Math.sin(rad) * length * 0.5 + curveFactor * length * 0.35;
        const cpY = y0 - Math.cos(rad) * length * 0.55;
        const tipX = x0 + Math.sin(rad) * length + curveFactor * length * 0.6;
        const tipY = y0 - Math.cos(rad) * length;

        const wHalf = width * 0.5;

        // Left half of blade (sunlit/highlighted side)
        ctx.beginPath();
        ctx.moveTo(x0 - wHalf, y0);
        ctx.quadraticCurveTo(cpX - wHalf * 0.6, cpY, tipX, tipY);
        ctx.quadraticCurveTo(cpX, cpY, x0, y0);
        ctx.closePath();

        const grad1 = ctx.createLinearGradient(x0, y0, tipX, tipY);
        if (hueShift > 0.5) {
          grad1.addColorStop(0, 'rgba(52, 84, 25, 0.95)');
          grad1.addColorStop(0.4, 'rgba(92, 146, 42, 0.98)');
          grad1.addColorStop(0.85, 'rgba(152, 198, 60, 0.98)');
          grad1.addColorStop(1, 'rgba(178, 222, 75, 0.95)');
        } else {
          grad1.addColorStop(0, 'rgba(40, 68, 20, 0.95)');
          grad1.addColorStop(0.4, 'rgba(78, 126, 36, 0.98)');
          grad1.addColorStop(0.85, 'rgba(130, 175, 50, 0.98)');
          grad1.addColorStop(1, 'rgba(160, 205, 65, 0.95)');
        }
        ctx.fillStyle = grad1;
        ctx.fill();

        // Right half of blade (shady/earthy side for stylized 3D volume)
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
        ctx.quadraticCurveTo(cpX + wHalf * 0.6, cpY, x0 + wHalf, y0);
        ctx.closePath();

        const grad2 = ctx.createLinearGradient(x0, y0, tipX, tipY);
        grad2.addColorStop(0, 'rgba(32, 52, 15, 0.95)');
        grad2.addColorStop(0.4, 'rgba(56, 90, 26, 0.95)');
        grad2.addColorStop(0.85, 'rgba(88, 134, 38, 0.95)');
        grad2.addColorStop(1, 'rgba(125, 170, 48, 0.92)');
        ctx.fillStyle = grad2;
        ctx.fill();

        // Sharp central vein / spine highlight for Blizzard painterly look
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
        ctx.strokeStyle = 'rgba(195, 235, 95, 0.45)';
        ctx.lineWidth = Math.max(1, width * 0.14);
        ctx.stroke();
      });
    }

    // Layer A: Background / deep tufts (slightly darker, broader)
    const tuftSpacing = 16;
    for (let x = 0; x < W; x += tuftSpacing) {
      const xCenter = x + (rand() - 0.5) * 10;
      const yBase = H * (0.68 + rand() * 0.22);
      const bladeCount = 4 + Math.floor(rand() * 4);

      for (let b = 0; b < bladeCount; b++) {
        const spread = (b - (bladeCount - 1) / 2);
        const angle = spread * (12 + rand() * 8) + (rand() - 0.5) * 6;
        const len = 70 + rand() * 75;
        const wid = 7 + rand() * 6;
        const curve = (spread < 0 ? -1 : 1) * (0.15 + rand() * 0.35);
        drawWarcraftBlade(xCenter + spread * 3, yBase, len, wid, angle, curve, rand());
      }
    }

    // Layer B: Midground lush clusters with curved leaf shapes & clovers
    for (let x = 4; x < W; x += 14) {
      const xCenter = x + (rand() - 0.5) * 8;
      const yBase = H * (0.62 + rand() * 0.25);
      const bladeCount = 5 + Math.floor(rand() * 4);

      for (let b = 0; b < bladeCount; b++) {
        const spread = (b - (bladeCount - 1) / 2);
        const angle = spread * (15 + rand() * 10) + (rand() - 0.5) * 8;
        const len = 85 + rand() * 95;
        const wid = 8 + rand() * 7;
        const curve = (spread < 0 ? -1 : 1) * (0.2 + rand() * 0.45);
        drawWarcraftBlade(xCenter + spread * 3.5, yBase, len, wid, angle, curve, rand());
      }

      // Small round clover / broadleaf nestled at tuft base
      if (rand() > 0.4) {
        wrapDraw(() => {
          const lx = xCenter + (rand() - 0.5) * 14;
          const ly = yBase - 15 - rand() * 30;
          const lr = 7 + rand() * 8;
          ctx.beginPath();
          ctx.ellipse(lx, ly, lr, lr * 0.65, (rand() - 0.5) * 1.2, 0, Math.PI * 2);
          const leafGrad = ctx.createRadialGradient(lx, ly, 2, lx, ly, lr);
          leafGrad.addColorStop(0, '#92c438');
          leafGrad.addColorStop(0.7, '#588a28');
          leafGrad.addColorStop(1, '#2c4614');
          ctx.fillStyle = leafGrad;
          ctx.fill();
        });
      }
    }

    // Layer C: Foreground crisp sunlit blades (reaching furthest towards y=0)
    for (let x = 8; x < W; x += 20) {
      const xCenter = x + (rand() - 0.5) * 12;
      const yBase = H * (0.65 + rand() * 0.2);
      const bladeCount = 3 + Math.floor(rand() * 3);

      for (let b = 0; b < bladeCount; b++) {
        const spread = (b - (bladeCount - 1) / 2);
        const angle = spread * (18 + rand() * 10) + (rand() - 0.5) * 10;
        const len = 100 + rand() * 115; // Extends nicely to top 15-20%
        const wid = 9 + rand() * 6;
        const curve = (spread < 0 ? -1 : 1) * (0.25 + rand() * 0.4);
        drawWarcraftBlade(xCenter + spread * 4, yBase, len, wid, angle, curve, 0.8);
      }
    }

    // 3. SEED AND BLEND THE VERY BOTTOM ROW FOR 100% SEAMLESS OPAQUE ROAD-SIDE CONNECTION
    // Ensure y in [H*0.88 .. H] is solid rich green with zero transparency gaps
    wrapDraw(() => {
      const solidRoot = ctx.createLinearGradient(0, H * 0.86, 0, H);
      solidRoot.addColorStop(0, 'rgba(52, 84, 26, 0.0)');
      solidRoot.addColorStop(0.4, 'rgba(50, 80, 24, 0.95)');
      solidRoot.addColorStop(0.7, 'rgba(48, 76, 22, 1.0)');
      solidRoot.addColorStop(1, 'rgba(46, 74, 22, 1.0)');
      ctx.fillStyle = solidRoot;
      ctx.fillRect(0, H * 0.86, W, H * 0.14);
    });

    // 4. ENSURE ABSOLUTE MATHEMATICAL HORIZONTAL WRAP
    // Blend a 32px fringe from x=0..32 and x=W-32..W
    const imgData = ctx.getImageData(0, 0, W, H);
    const d = imgData.data;
    const blendWidth = 32;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < blendWidth; x++) {
        const leftIdx = (y * W + x) * 4;
        const rightIdx = (y * W + (W - blendWidth + x)) * 4;
        const t = x / blendWidth;

        if (x === 0) {
          const r = Math.round((d[leftIdx] + d[rightIdx]) * 0.5);
          const g = Math.round((d[leftIdx + 1] + d[rightIdx + 1]) * 0.5);
          const b = Math.round((d[leftIdx + 2] + d[rightIdx + 2]) * 0.5);
          const a = Math.round((d[leftIdx + 3] + d[rightIdx + 3]) * 0.5);
          d[leftIdx] = d[rightIdx] = r;
          d[leftIdx + 1] = d[rightIdx + 1] = g;
          d[leftIdx + 2] = d[rightIdx + 2] = b;
          d[leftIdx + 3] = d[rightIdx + 3] = a;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  });

  await browser.close();

  const buffer = Buffer.from(pngBase64, 'base64');
  writeFileSync(texOut, buffer);
  writeFileSync(decalOut, buffer);
  console.log(`Saved Warcraft grass fringe: ${texOut} and ${decalOut} (${buffer.length} bytes)`);
}

main().catch(err => {
  console.error('Failed to generate grass fringe:', err);
  process.exit(1);
});
