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
const decalOut = join(root, 'public/art/decals');
const work = join(tmpdir(), 'hm2-stylized-textures');
const textureNames = ['dirt', 'grass', 'cliff', 'caverock', 'lava', 'wood', 'cobble', 'iron', 'bark', 'water'];
const EDGE_FEATHER = 18;

// A shared overcast-gold / cool-shadow grade keeps neighbouring materials part
// of one world.  The source paintings retain their own identity, but none gets
// a pure black crevice or a near-white highlight that would break the course's
// visual hierarchy at speed.
const MATERIAL_GRADES = {
  // Dirt is deliberately the quietest surface: a road should support the racers,
  // not project a tile-shaped motif down the course.
  dirt:     { contrast: 0.65, saturation: 0.45, tint: [142, 108, 71], tintMix: 0.56, shadow: 0.12, light: 0.07 },
  grass:    { contrast: 0.63, saturation: 0.78, tint: [101, 119, 70], tintMix: 0.09, shadow: 0.13, light: 0.07 },
  cliff:    { contrast: 0.59, saturation: 0.58, tint: [116, 111, 93], tintMix: 0.10, shadow: 0.15, light: 0.07 },
  caverock: { contrast: 0.58, saturation: 0.56, tint: [89, 102, 104], tintMix: 0.09, shadow: 0.15, light: 0.06 },
  lava:     { contrast: 0.70, saturation: 0.75, tint: [151, 83, 53], tintMix: 0.05, shadow: 0.08, light: 0.08 },
  wood:     { contrast: 0.64, saturation: 0.70, tint: [132, 94, 63], tintMix: 0.09, shadow: 0.12, light: 0.08 },
  cobble:   { contrast: 0.60, saturation: 0.55, tint: [109, 116, 96], tintMix: 0.11, shadow: 0.14, light: 0.07 },
  iron:     { contrast: 0.61, saturation: 0.49, tint: [104, 119, 119], tintMix: 0.10, shadow: 0.14, light: 0.07 },
  bark:     { contrast: 0.64, saturation: 0.68, tint: [123, 91, 61], tintMix: 0.09, shadow: 0.12, light: 0.08 },
  water:    { contrast: 0.59, saturation: 0.62, tint: [80, 123, 130], tintMix: 0.08, shadow: 0.10, light: 0.06 },
};
const SHARED_SHADOW = [74, 86, 82];
const SHARED_LIGHT = [188, 169, 125];

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

async function rasterize(page, sourceUrl, grade) {
  return page.evaluate(async ({ sourceUrl, edge, grade, sharedShadow, sharedLight }) => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = sourceUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create a 2D canvas context.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, 512, 512);

    const pixels = context.getImageData(0, 0, 512, 512);
    const d = pixels.data;
    const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));
    const luma = (r, g, b) => (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;

    // Value compression is deliberately performed before the seamless-edge pass.
    // It lifts black outlining into coloured shadow and pulls bright accents into
    // the common overcast range, while preserving the directional brush marks.
    for (let offset = 0; offset < d.length; offset += 4) {
      let r = d[offset];
      let g = d[offset + 1];
      let b = d[offset + 2];
      const originalValue = luma(r, g, b);
      const grey = originalValue * 255;
      r = grey + (r - grey) * grade.saturation;
      g = grey + (g - grey) * grade.saturation;
      b = grey + (b - grey) * grade.saturation;

      const desaturatedValue = Math.max(0.001, luma(r, g, b));
      const compressedValue = 0.50 + (desaturatedValue - 0.50) * grade.contrast;
      const valueGain = compressedValue / desaturatedValue;
      r *= valueGain;
      g *= valueGain;
      b *= valueGain;

      const shadowAmount = Math.pow(1 - compressedValue, 1.55) * grade.shadow;
      const lightAmount = Math.pow(compressedValue, 1.8) * grade.light;
      r += (sharedShadow[0] - r) * shadowAmount + (sharedLight[0] - r) * lightAmount;
      g += (sharedShadow[1] - g) * shadowAmount + (sharedLight[1] - g) * lightAmount;
      b += (sharedShadow[2] - b) * shadowAmount + (sharedLight[2] - b) * lightAmount;
      r += (grade.tint[0] - r) * grade.tintMix;
      g += (grade.tint[1] - g) * grade.tintMix;
      b += (grade.tint[2] - b) * grade.tintMix;
      d[offset] = clampByte(r);
      d[offset + 1] = clampByte(g);
      d[offset + 2] = clampByte(b);
    }

    // Pair opposing edge texels, working inward. This soft mirror blend preserves
    // the hand-painted center while giving linear-filtered repeats a continuous
    // edge instead of a hard square boundary.
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
  }, { sourceUrl, edge: EDGE_FEATHER, grade, sharedShadow: SHARED_SHADOW, sharedLight: SHARED_LIGHT });
}

/**
 * A soft, shared transition band keeps the grass from ending in a bright, busy
 * line against dirt and stone. It reuses the already colour-graded grass paint
 * through a low-alpha brush mask rather than drawing a second, unrelated blade
 * texture.
 */
async function buildGrassFringe(page, grassUrl, dirtUrl) {
  return page.evaluate(async ({ grassUrl, dirtUrl }) => {
    const load = (url) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const [grass, dirt] = await Promise.all([load(grassUrl), load(dirtUrl)]);
    const W = 1024;
    const H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create a fringe canvas context.');

    const paintAcross = (target, image) => {
      target.drawImage(image, 0, 0, 512, 512, 0, 0, 512, H);
      target.drawImage(image, 0, 0, 512, 512, 512, 0, 512, H);
    };

    // Vertical direction is deliberate: v=0 is the outer grass slope and v=1
    // is the road. The strip therefore has real grass on one side and the same
    // subdued dirt material on the other, rather than a separate green decal.
    paintAcross(context, grass);
    const roadHalf = document.createElement('canvas');
    roadHalf.width = W;
    roadHalf.height = H;
    const road = roadHalf.getContext('2d');
    if (!road) throw new Error('Could not create a road fringe canvas context.');
    paintAcross(road, dirt);
    const roadMask = road.createLinearGradient(0, 88, 0, H);
    roadMask.addColorStop(0, 'rgba(255,255,255,0)');
    roadMask.addColorStop(0.34, 'rgba(255,255,255,0)');
    roadMask.addColorStop(0.58, 'rgba(255,255,255,0.30)');
    roadMask.addColorStop(0.83, 'rgba(255,255,255,0.86)');
    roadMask.addColorStop(1, 'rgba(255,255,255,1)');
    road.globalCompositeOperation = 'destination-in';
    road.fillStyle = roadMask;
    road.fillRect(0, 0, W, H);
    road.globalCompositeOperation = 'source-over';
    context.drawImage(roadHalf, 0, 0);

    // A few large, irregular grass clumps grow from the verge onto the road.
    // Their colour is sampled from the terrain grass itself, so the transition
    // remains clean, low contrast, and tied to the surrounding slope.
    const clumpMask = document.createElement('canvas');
    clumpMask.width = W;
    clumpMask.height = H;
    const m = clumpMask.getContext('2d');
    if (!m) throw new Error('Could not create a fringe mask canvas context.');
    let state = 0x5f3759df;
    const random = () => { state = Math.imul(state ^ (state >>> 15), 1 | state); state ^= state + Math.imul(state ^ (state >>> 7), 61 | state); return ((state ^ (state >>> 14)) >>> 0) / 4294967296; };
    const paintClump = (x) => {
      const base = 174 + random() * 20;
      const width = 34 + random() * 62;
      const height = 42 + random() * 64;
      const lean = -18 + random() * 36;
      m.save();
      m.globalAlpha = 0.42 + random() * 0.18;
      m.fillStyle = '#ffffff';
      m.filter = 'blur(2px)';
      m.beginPath();
      m.moveTo(x - width * 0.55, base + 23);
      m.bezierCurveTo(x - width * 0.32, base - height * 0.04, x + lean - width * 0.18, base - height, x + lean, base - height - 8);
      m.bezierCurveTo(x + lean + width * 0.26, base - height * 0.58, x + width * 0.45, base + 4, x + width * 0.58, base + 23);
      m.closePath();
      m.fill();
      // Two broad leaf/blade strokes make the grass visibly grow across dirt
      // without becoming a busy hairline fringe.
      m.globalAlpha = 0.36 + random() * 0.16;
      m.lineCap = 'round';
      m.lineWidth = 5 + random() * 6;
      for (const spread of [-0.42, 0.34]) {
        m.beginPath();
        m.moveTo(x + spread * width * 0.28, base + 18);
        m.quadraticCurveTo(x + lean * 0.5 + spread * width * 0.55, base - height * 0.18, x + lean + spread * width * 0.45, base - height * 0.74);
        m.stroke();
      }
      m.restore();
    };
    for (let index = 0; index < 34; index++) {
      const x = random() * W;
      paintClump(x - W);
      paintClump(x);
      paintClump(x + W);
    }

    const overgrowth = document.createElement('canvas');
    overgrowth.width = W;
    overgrowth.height = H;
    const growth = overgrowth.getContext('2d');
    if (!growth) throw new Error('Could not create a grass overgrowth canvas context.');
    paintAcross(growth, grass);
    growth.globalCompositeOperation = 'destination-in';
    growth.drawImage(clumpMask, 0, 0);
    growth.globalCompositeOperation = 'source-over';
    context.drawImage(overgrowth, 0, 0);

    const pixels = context.getImageData(0, 0, W, H);
    const d = pixels.data;
    // The horizontal repeat is exact, so this transition can run the complete
    // length of either shoulder without producing a seam.
    for (let y = 0; y < H; y++) for (let x = 0; x < 24; x++) {
      const left = (y * W + x) * 4;
      const right = (y * W + (W - 1 - x)) * 4;
      for (let channel = 0; channel < 4; channel++) {
        const average = Math.round((d[left + channel] + d[right + channel]) * 0.5);
        d[left + channel] = d[right + channel] = average;
      }
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png');
  }, { grassUrl, dirtUrl });
}

async function build() {
  mkdirSync(runtimeOut, { recursive: true });
  mkdirSync(artOut, { recursive: true });
  mkdirSync(decalOut, { recursive: true });
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
      const encoded = await rasterize(page, dataUrl(source), MATERIAL_GRADES[name]);
      writeFileSync(runtime, Buffer.from(encoded.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
      writeFileSync(webp, Buffer.from(encoded.webp.replace(/^data:image\/webp;base64,/, ''), 'base64'));
      convert([runtime, '-resize', '1024x1024!', '-strip', legacy]);
      console.log(`painted ${name}`);
    }
    const grassFringe = await buildGrassFringe(
      page,
      dataUrl(join(runtimeOut, 'grass.png')),
      dataUrl(join(runtimeOut, 'dirt.png')),
    );
    const fringeBuffer = Buffer.from(grassFringe.replace(/^data:image\/png;base64,/, ''), 'base64');
    writeFileSync(join(runtimeOut, 'grass-fringe.png'), fringeBuffer);
    writeFileSync(join(decalOut, 'grass-fringe.png'), fringeBuffer);
    console.log('painted grass fringe');
  } finally {
    await browser.close();
    rmSync(work, { recursive: true, force: true });
  }
}

build().catch((error) => { console.error(error); process.exitCode = 1; });
