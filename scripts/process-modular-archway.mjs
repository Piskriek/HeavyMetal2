import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = join(root, 'public/art/props/alpha');
mkdirSync(outDir, { recursive: true });

const brainDir = 'C:\\Users\\Pierro\\.gemini\\antigravity-ide\\brain\\4aba5a0a-ba24-41af-ac87-97e65ed56395';

const items = [
  {
    src: join(brainDir, 'arch_stone_pillar_1789990802720.jpg'),
    dest: join(outDir, 'prop-52-arch-pillar-stone.png'),
    name: 'prop-52-arch-pillar-stone',
  },
  {
    src: join(brainDir, 'arch_timber_lintel_1789990830373.jpg'),
    dest: join(outDir, 'prop-53-arch-lintel-timber.png'),
    name: 'prop-53-arch-lintel-timber',
  },
  {
    src: join(brainDir, 'arch_curved_header_1789990859114.jpg'),
    dest: join(outDir, 'prop-54-arch-curve-timber.png'),
    name: 'prop-54-arch-curve-timber',
  },
  {
    src: join(brainDir, 'arch_pennant_banner_1789990889415.jpg'),
    dest: join(outDir, 'prop-55-arch-banner-flags.png'),
    name: 'prop-55-arch-banner-flags',
  },
  {
    src: join(brainDir, 'arch_torch_sconce_1789990927207.jpg'),
    dest: join(outDir, 'prop-56-arch-torch-sconce.png'),
    name: 'prop-56-arch-torch-sconce',
  },
  {
    src: join(brainDir, 'arch_spiked_crest_1789990965029.jpg'),
    dest: join(outDir, 'prop-57-arch-crest-spikes.png'),
    name: 'prop-57-arch-crest-spikes',
  },
];

async function run() {
  console.log('Launching browser to decode and key modular archway parts...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');

  for (const item of items) {
    const base64 = readFileSync(item.src).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    const raw = await page.evaluate(async (dataUrl) => {
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

          for (let i = 0; i < w * h; i++) {
            const p = i * 4;
            const r = d[p], g = d[p + 1], b = d[p + 2];
            // Pure magenta matte check (symmetric high R & B, low G)
            const isMagenta = (r > 130 && b > 130 && Math.min(r - g, b - g) >= 30 && Math.abs(r - b) <= 75);
            if (isMagenta) {
              d[p + 3] = 0;
              // Neutralize RGB channels to prevent magenta fringe
              d[p] = Math.min(r, g);
              d[p + 2] = Math.min(b, g);
            }
          }

          ctx.putImageData(imgData, 0, 0);
          resolve({ w, h, dataUrl: canvas.toDataURL('image/png') });
        };
        img.src = dataUrl;
      });
    }, dataUrl);

    const base64Data = raw.dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(item.dest, Buffer.from(base64Data, 'base64'));
    console.log(`Processed ${item.name}: saved to ${item.dest} (${raw.w}x${raw.h})`);
  }

  await browser.close();
  console.log('All modular archway elements processed.');
}

run().catch(console.error);
