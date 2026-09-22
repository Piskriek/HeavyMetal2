import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = join(root, 'public/art/decals');
mkdirSync(outDir, { recursive: true });

const brainDir = 'C:\\Users\\Pierro\\.gemini\\antigravity-ide\\brain\\4aba5a0a-ba24-41af-ac87-97e65ed56395';

const decals = [
  // --- DIRT & STONE DECALS ---
  {
    src: join(brainDir, 'blizzard_dirt_patch_1790057559649.jpg'),
    dest: join(outDir, 'decal-blizzard-dirt-patch.png'),
    aliasDest: join(outDir, 'decal-oil-spill.png'), // replace old tar oil spill
    mode: 'organic',
    threshold: 28,
  },
  {
    src: join(brainDir, 'blizzard_stone_slab_1790057588503.jpg'),
    dest: join(outDir, 'decal-blizzard-stone-slab.png'),
    mode: 'organic',
    threshold: 28,
  },
  {
    src: join(brainDir, 'blizzard_rock_crag_1790057620071.jpg'),
    dest: join(outDir, 'decal-blizzard-rock-crag.png'),
    aliasDest: join(outDir, 'decal-cracks.png'), // replace old asphalt cracks
    mode: 'organic',
    threshold: 28,
  },
  {
    src: join(brainDir, 'blizzard_gravel_earth_1790057659898.jpg'),
    dest: join(outDir, 'decal-blizzard-gravel-earth.png'),
    aliasDest: join(outDir, 'decal-pothole.png'), // replace old asphalt pothole
    mode: 'organic',
    threshold: 28,
  },

  // --- PANELS: STEEL & WOOD ---
  {
    src: join(brainDir, 'blizzard_steel_plate_1790057702500.jpg'),
    dest: join(outDir, 'decal-panel-scrap-steel.png'),
    aliasDest: join(outDir, 'decal-hazard-stripes.png'), // replace old highway hazard stripes
    mode: 'panel',
    threshold: 26,
  },
  {
    src: join(brainDir, 'blizzard_wood_planks_1790057748587.jpg'),
    dest: join(outDir, 'decal-panel-wood-planks.png'),
    aliasDest: join(outDir, 'decal-tire-skid.png'), // replace old asphalt tire skid
    mode: 'panel',
    threshold: 26,
  },
  {
    src: join(brainDir, 'blizzard_steel_wood_panel_1790057798886.jpg'),
    dest: join(outDir, 'decal-panel-reinforced-wood.png'),
    mode: 'panel',
    threshold: 26,
  },
  {
    src: join(brainDir, 'blizzard_iron_grate_1790057860319.jpg'),
    dest: join(outDir, 'decal-panel-iron-grate.png'),
    aliasDest: join(outDir, 'decal-drain-grate.png'), // replace old modern drain grate
    mode: 'panel',
    threshold: 26,
  },
];

async function run() {
  console.log('Starting Blizzard decal transparency processor...');
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
      async ({ dataUrl, mode, threshold }) => {
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

            const isBg = new Uint8Array(w * h);
            const queue = [];

            const isCornerBg = (idx) => {
              const r = d[idx * 4];
              const g = d[idx * 4 + 1];
              const b = d[idx * 4 + 2];
              return r <= threshold && g <= threshold && b <= threshold;
            };

            // Seed border pixels for flood fill
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

            // Apply transparency to background
            for (let i = 0; i < w * h; i++) {
              const p = i * 4;
              if (isBg[i]) {
                d[p + 3] = 0;
              }
            }

            // Anti-aliasing & feathering on boundary pixels
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
                  const lum = (r * 0.299 + g * 0.587 + b * 0.114);
                  if (mode === 'organic') {
                    // Smooth natural falloff for dirt / stone edges
                    d[p + 3] = Math.min(255, Math.max(0, Math.round((lum - 10) * 5.0)));
                  } else {
                    // Crisp edge with anti-aliasing for panels
                    d[p + 3] = Math.min(255, Math.max(0, Math.round((lum - 6) * 7.5)));
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
      { dataUrl, mode: item.mode, threshold: item.threshold }
    );

    const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, '');
    const buf = Buffer.from(base64Data, 'base64');
    writeFileSync(item.dest, buf);
    console.log(`Saved transparent decal: ${item.dest} (${buf.length} bytes)`);

    if (item.aliasDest) {
      writeFileSync(item.aliasDest, buf);
      console.log(`  -> Also replaced legacy decal: ${item.aliasDest}`);
    }
  }

  await browser.close();
  console.log('All Blizzard decals processed successfully!');
}

run().catch((e) => {
  console.error('Error processing decals:', e);
  process.exit(1);
});
