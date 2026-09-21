#!/usr/bin/env node
/**
 * Produces the low-detail, hand-painted material tiles for the Three.js course.
 *
 * The master paintings are original 1024px texture sources in
 * `public/art/texture-sources/`. They intentionally use broad dry-brush marks,
 * limited palettes, and large readable material forms rather than procedural
 * noise or crisp vector geometry. This script downsizes them for runtime and
 * gently seals the edges, so repeated Three.js maps have no sampling seam.
 *
 * Runtime: public/textures/ (512px PNG + WebP)
 * Matching canvas/preload copies: public/art/tracks/ (1024px PNG)
 *
 * Usage: npm run art:textures
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import chromiumBundle from '@sparticuz/chromium';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = join(root, 'public/art/texture-sources');
const runtimeOut = join(root, 'public/textures');
const artOut = join(root, 'public/art/tracks');
const work = join(tmpdir(), 'hm2-stylized-textures');
const textureNames = ['dirt', 'grass', 'cliff', 'caverock', 'lava', 'wood', 'cobble', 'iron', 'bark', 'water'];
const EDGE_FEATHER = 18;

function convert(args) {
  execFileSync('convert', args, { stdio: 'inherit' });
}

/** The sandbox ImageMagick install has no SVG/canvas renderer; the project's
 * existing visual-test Chromium reliably rasterizes the source paintings. */
async function launchRasterizer() {
  const libraries = join(work, 'chromium-libs');
  mkdirSync(libraries, { recursive: true });
  const archive = readFileSync(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
  const extracted = spawnSync('tar', ['-xf', '-', '-C', libraries], { input: brotliDecompressSync(archive) });
  if (extracted.status !== 0) throw new Error('Could not unpack Chromium libraries for texture rasterization.');
  chromiumBundle.setGraphicsMode = false;
  return chromium.launch({
    args: [...chromiumBundle.args.filter((arg) => !['--single-process', '--in-process-gpu'].includes(arg)), '--disable-gpu'],
    executablePath: await chromiumBundle.executablePath(),
    headless: true,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: `${libraries}/lib:${libraries}/al2023/lib:${process.env.LD_LIBRARY_PATH ?? ''}`,
      FONTCONFIG_PATH: join(tmpdir(), 'fonts'),
    },
  });
}

function dataUrl(file) {
  return `data:image/png;base64,${readFileSync(file).toString('base64')}`;
}

async function rasterize(page, sourceUrl) {
  return page.evaluate(async ({ sourceUrl, edge }) => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = sourceUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create a 2D canvas context.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, 512, 512);

    // Pair opposing edge texels, working inward. This soft mirror blend preserves
    // the hand-painted center while giving linear-filtered repeats a continuous
    // edge instead of a hard square boundary.
    const pixels = context.getImageData(0, 0, 512, 512);
    const d = pixels.data;
    const blend = (a, b) => Math.round((d[a] + d[b]) * 0.5);
    for (let y = 0; y < 512; y++) for (let x = 0; x < edge; x++) {
      const left = (y * 512 + x) * 4;
      const right = (y * 512 + (511 - x)) * 4;
      for (let channel = 0; channel < 4; channel++) d[left + channel] = d[right + channel] = blend(left + channel, right + channel);
    }
    for (let y = 0; y < edge; y++) for (let x = 0; x < 512; x++) {
      const top = (y * 512 + x) * 4;
      const bottom = ((511 - y) * 512 + x) * 4;
      for (let channel = 0; channel < 4; channel++) d[top + channel] = d[bottom + channel] = blend(top + channel, bottom + channel);
    }
    context.putImageData(pixels, 0, 0);
    return { png: canvas.toDataURL('image/png'), webp: canvas.toDataURL('image/webp', 0.86) };
  }, { sourceUrl, edge: EDGE_FEATHER });
}

async function build() {
  mkdirSync(runtimeOut, { recursive: true });
  mkdirSync(artOut, { recursive: true });
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const browser = await launchRasterizer();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });

  try {
    for (const name of textureNames) {
      const source = join(sources, `${name}.png`);
      const runtime = join(runtimeOut, `${name}.png`);
      const webp = join(runtimeOut, `${name}.webp`);
      const legacy = join(artOut, `tex-${name}.png`);
      const encoded = await rasterize(page, dataUrl(source));
      writeFileSync(runtime, Buffer.from(encoded.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
      writeFileSync(webp, Buffer.from(encoded.webp.replace(/^data:image\/webp;base64,/, ''), 'base64'));
      convert([runtime, '-resize', '1024x1024!', '-strip', legacy]);
      console.log(`painted ${name}`);
    }
  } finally {
    await browser.close();
    rmSync(work, { recursive: true, force: true });
  }
}

build().catch((error) => { console.error(error); process.exitCode = 1; });
