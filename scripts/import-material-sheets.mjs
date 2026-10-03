// Turn the material library's four-square PBR sheets (art-src/meshy/material-refs: colour | normal / roughness | height) into the files the
// terrain loads, at 512 px:
//   textures/racing/<name>.webp         colour
//   textures/racing-pbr/<name>.webp     R, G = normal x, y (in the terrain's convention), B = roughness
//   textures/racing-height/<name>.webp  the height (grey), so surfaces blend by their real height
// The sheets' normal maps come in either green convention; each is checked against its own height and flipped when it disagrees.
//   node scripts/import-material-sheets.mjs [--ref <git ref holding the sheets>] [--only <name>]
// The list of tiles is RACING below: Goblin Racing's ground, the high end of the image sets.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const arg = (name, d) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : d; };
const ref = arg('--ref', 'origin/arena/01a0ecba-heavymetal2'), only = arg('--only');
const SHEETS = 'art-src/meshy/material-refs/';
const OUT = `${root}apps/web/public/textures/`;
const SIZE = 512;

/** name (the file name the terrain loads) -> sheet in the library. */
export const RACING = {
  'shallows-m051': 'M051-shallow-tropical-water-scroll-pbr-sheet.png',
  'sand-m006': 'M006-tropical-beach-sand-pbr-sheet.png',
  'wetsand-m516': 'M516-island-wet-sand-pbr-sheet.png',
  'grass-m513': 'M513-island-short-tropical-grass-pbr-sheet.png',
  'rock-m017': 'M017-dry-coastal-rock-pbr-sheet.png',
  'cliff-m001': 'M001-basalt-cliff-pbr-sheet.png',
  'basalt-m005': 'M005-wet-basalt-pbr-sheet.png',
  'dunes-m282': 'M282-rippled-tidal-sand-pbr-sheet.png',
  'mud-m283': 'M283-tidal-mud-pbr-sheet.png',
  'strata-m002': 'M002-ochre-cliff-pbr-sheet.png',
  'moss-m029': 'M029-cushion-moss-pbr-sheet.png',
  'coral-m284': 'M284-coral-limestone-pbr-sheet.png',
  'lava-m509': 'M509-island-lava-crust-glowing-cracks-pbr-sheet.png',
  'scree-m014': 'M014-loose-scree-gravel-pbr-sheet.png',
  'pumice-m289': 'M289-pumice-gravel-pbr-sheet.png',
  'soil-m007': 'M007-mossy-jungle-soil-pbr-sheet.png',
  'tarmac-m668': 'M668-tarmac-dry-m668.png',
  'tarmac-wet-m669': 'M669-tarmac-wet-m669.png',
  'start-m670': 'M670-marking-checkered-m670.png',
  'boost-m671': 'M671-pad-boost-chevron-m671.png',
  'kerb-m672': 'M672-curb-rumble-redwhite-m672.png',
  'dirt-road-m673': 'M673-road-jungle-dirt-m673.png',
  'boardwalk-m674': 'M674-boardwalk-bamboo-m674.png',
  'cobble-m675': 'M675-cobble-wet-m675.png',
  'dusty-road-m676': 'M676-road-tropical-dusty-m676.png',
  'columns-m677': 'M677-cliff-basalt-columnar-m677.png',
};

/** Tiles whose big shapes are the point (squares, stripes, planks, cracks): never equalised. */
const KEEP_SHAPES = new Set(['start-m670', 'boost-m671', 'kerb-m672', 'boardwalk-m674', 'columns-m677', 'cobble-m675', 'strata-m002', 'cliff-m001', 'lava-m509', 'dunes-m282']);

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
if (!chrome.some(existsSync)) { console.log('import-material-sheets: Chrome is needed to read and write the images; not found'); process.exit(1); }
const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
for (const sub of ['racing', 'racing-pbr', 'racing-height']) mkdirSync(`${OUT}${sub}`, { recursive: true });

let bytes = 0;
for (const [name, sheet] of Object.entries(RACING)) {
  if (only && only !== name) continue;
  const png = execFileSync('git', ['show', `${ref}:${SHEETS}${sheet}`], { cwd: root, maxBuffer: 64 << 20 });
  const files = await page.evaluate(async ([b64, size, equalise]) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const half = Math.floor(img.width / 2);
    const quad = (qx, qy) => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, qx * half, qy * half, half, half, 0, 0, size, size);
      return x.getImageData(0, 0, size, size);
    };
    const colour = quad(0, 0), normal = quad(1, 0), rough = quad(0, 1), height = quad(1, 1);
    const n = size * size, h = new Float32Array(n);
    for (let i = 0; i < n; i++) h[i] = height.data[i * 4] / 255;
    // which way is the normal's green? compare it with the height's slope down the image (ours: green = 0.5 + 0.5 x the normal's
    // down-the-image part, which is minus the slope)
    let agreeY = 0, agreeX = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dy = h[((y + 1) % size) * size + x] - h[((y + size - 1) % size) * size + x];
      const dx = h[y * size + (x + 1) % size] - h[y * size + (x + size - 1) % size];
      agreeY += (normal.data[i * 4 + 1] / 255 - 0.5) * -dy;
      agreeX += (normal.data[i * 4] / 255 - 0.5) * -dx;
    }
    const flipY = agreeY < 0, flipX = agreeX < 0;
    const pbr = new ImageData(size, size), grey = new ImageData(size, size);
    for (let i = 0; i < n; i++) {
      const r = normal.data[i * 4], g = normal.data[i * 4 + 1];
      pbr.data[i * 4] = flipX ? 255 - r : r; pbr.data[i * 4 + 1] = flipY ? 255 - g : g;
      pbr.data[i * 4 + 2] = rough.data[i * 4]; pbr.data[i * 4 + 3] = 255;
      grey.data[i * 4] = grey.data[i * 4 + 1] = grey.data[i * 4 + 2] = height.data[i * 4]; grey.data[i * 4 + 3] = 255;
    }
    // equalise the colour: a sheet's own big light and dark patches would repeat as a grid across a field, so its slow brightness changes are
    // divided out (a wrapping blur of about an eighth of the tile) and only the detail repeats; the terrain adds its own variation over metres
    if (equalise) {
    const blurred = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) blurred[i * 3 + c] = colour.data[i * 4 + c];
    const tmp = new Float32Array(n * 3), rad = Math.round(size / 16);
    for (let pass = 0; pass < 3; pass++) {
      for (const horizontal of [true, false]) {
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let k = -rad; k <= rad; k++) {
            const xx = horizontal ? (x + k + size) % size : x, yy = horizontal ? y : (y + k + size) % size;
            sum += blurred[(yy * size + xx) * 3 + c];
          }
          tmp[(y * size + x) * 3 + c] = sum / (2 * rad + 1);
        }
        blurred.set(tmp);
      }
    }
    const mean = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) mean[c] += blurred[i * 3 + c] / n;
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) {
      const v = colour.data[i * 4 + c] * (mean[c] / Math.max(1, blurred[i * 3 + c]));
      colour.data[i * 4 + c] = Math.max(0, Math.min(255, Math.round(colour.data[i * 4 + c] * 0.15 + v * 0.85)));
    }
    }
    for (let i = 3; i < colour.data.length; i += 4) colour.data[i] = 255;
    const enc = (data, q) => { const c = document.createElement('canvas'); c.width = c.height = size; c.getContext('2d').putImageData(data, 0, 0); return c.toDataURL('image/webp', q).split(',')[1]; };
    return { colour: enc(colour, 0.9), pbr: enc(pbr, 0.92), height: enc(grey, 0.9), flipX, flipY };
  }, [png.toString('base64'), SIZE, !KEEP_SHAPES.has(name)]);
  for (const [sub, key] of [['racing', 'colour'], ['racing-pbr', 'pbr'], ['racing-height', 'height']]) {
    const buf = Buffer.from(files[key], 'base64');
    writeFileSync(`${OUT}${sub}/${name}.webp`, buf);
    bytes += buf.length;
  }
  console.log(`${name.padEnd(18)} ${sheet}${files.flipX ? ' (normal x flipped)' : ''}${files.flipY ? ' (normal y flipped)' : ''}`);
}
await browser.close();
console.log(`import-material-sheets: ${Math.round(bytes / 1024)} KB`);
