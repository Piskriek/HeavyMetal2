import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './edge-magenta-lib.mjs';

/**
 * Generate the repeat materials used by the Three.js track.
 *
 * Research note: the useful lesson from Warcraft environment references is not
 * "add more surface detail". The hand-painted look is carried by a restrained
 * palette, broad value masses, readable silhouettes and a few deliberate
 * material cues. These tiles therefore use one very low-frequency tonal field,
 * soft seams only where a material needs them, and no grain, speckle or sharp
 * highlight marks. They are intentionally quieter than a realistic texture so
 * the models, terrain shape and racers remain the focal points.
 *
 * Every field is periodic, so the generated PNGs are safe to repeat in world
 * space. Keep this script as the source of truth for public/textures/*.png.
 */

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'public/textures');
const TAU = Math.PI * 2;
const W = 512;
const H = 512;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, value) => {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const wrapDistance = (value) => value - Math.round(value);

function hash2(x, y, seed = 1) {
  let n = Math.imul(x + seed * 374761393, 668265263) ^ Math.imul(y + seed * 1442695041, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Smooth tile-periodic value noise. `cells` stays deliberately low. */
function valueNoise(u, v, cells, seed) {
  const x = u * cells;
  const y = v * cells;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (ix, iy) => hash2(mod(ix, cells), mod(iy, cells), seed);
  return lerp(
    lerp(at(x0, y0), at(x0 + 1, y0), sx),
    lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx),
    sy,
  );
}

/** One broad wash plus a tiny secondary wash; never high-frequency noise. */
function quietField(u, v, seed) {
  return valueNoise(u, v, 3, seed) * 0.84 + valueNoise(u, v, 5, seed + 19) * 0.16;
}

function color(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16 & 255, value >> 8 & 255, value & 255];
}

function mixColor(a, b, amount) {
  const t = clamp(amount);
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function tint(base, target, amount) {
  return mixColor(base, target, clamp(amount));
}

function pixelIndex(width, x, y) {
  return (y * width + x) * 4;
}

function put(data, width, x, y, rgb, alpha = 255) {
  if (x < 0 || y < 0 || x >= width || y >= data.length / (width * 4)) return;
  const i = pixelIndex(width, x, y);
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  data[i + 3] = alpha;
}

function renderTexture(painter, width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = painter(x / width, y / height, x, y);
      put(data, width, x, y, [r, g, b], a);
    }
  }
  return data;
}

function writeTexture(filePath, painter, width, height) {
  encodePng(filePath, width, height, renderTexture(painter, width, height));
}

function makeTexture(name, painter, width = W, height = H) {
  writeTexture(join(OUT, `${name}.png`), painter, width, height);
  console.log(`  wrote ${name}.png (${width}x${height})`);
}

function softPatches(u, v, base, patches) {
  let output = base;
  for (const patch of patches) {
    let dx = wrapDistance(u - patch.x);
    let dy = wrapDistance(v - patch.y);
    const c = Math.cos(patch.angle ?? 0);
    const s = Math.sin(patch.angle ?? 0);
    const rx = (dx * c + dy * s) / patch.rx;
    const ry = (-dx * s + dy * c) / patch.ry;
    const distance = Math.sqrt(rx * rx + ry * ry);
    // Very soft brush-shaped edges: no stamped blobs or hard decals.
    const field = smoothstep(1.15, 0.18, distance);
    output = tint(output, patch.color, field * patch.amount);
  }
  return output;
}

function paintDirt(u, v) {
  const n = quietField(u, v, 11);
  let base = mixColor(color('#80704f'), color('#927e55'), 0.33 + n * 0.2);
  base = softPatches(u, v, base, [
    { x: 0.18, y: 0.27, rx: 0.36, ry: 0.24, angle: -0.25, color: color('#9b875a'), amount: 0.045 },
    { x: 0.74, y: 0.72, rx: 0.42, ry: 0.28, angle: 0.18, color: color('#735f45'), amount: 0.035 },
  ]);
  return [...base, 255];
}

function paintGrass(u, v) {
  const n = quietField(u, v, 23);
  let base = mixColor(color('#536b39'), color('#687b46'), 0.38 + n * 0.2);
  base = softPatches(u, v, base, [
    { x: 0.18, y: 0.2, rx: 0.42, ry: 0.36, angle: 0.15, color: color('#70804a'), amount: 0.05 },
    { x: 0.68, y: 0.72, rx: 0.48, ry: 0.3, angle: -0.2, color: color('#486033'), amount: 0.04 },
  ]);
  return [...base, 255];
}

function nearestCells(u, v, cellsX, cellsY, seed) {
  const px = u * cellsX;
  const py = v * cellsY;
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  let first = { distance: Infinity, id: 0 };
  let second = { distance: Infinity, id: 0 };

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cellX = mod(ix + ox, cellsX);
      const cellY = mod(iy + oy, cellsY);
      let centerX = cellX + 0.5 + (hash2(cellX, cellY, seed) - 0.5) * 0.22;
      let centerY = cellY + 0.5 + (hash2(cellX, cellY, seed + 3) - 0.5) * 0.22;
      while (centerX - px > cellsX / 2) centerX -= cellsX;
      while (px - centerX > cellsX / 2) centerX += cellsX;
      while (centerY - py > cellsY / 2) centerY -= cellsY;
      while (py - centerY > cellsY / 2) centerY += cellsY;
      const distance = Math.hypot(px - centerX, py - centerY);
      const id = cellY * cellsX + cellX;
      if (distance < first.distance) {
        second = first;
        first = { distance, id };
      } else if (distance < second.distance) {
        second = { distance, id };
      }
    }
  }
  return { first, gap: second.distance - first.distance };
}

/** Shared quiet stone treatment: large shapes, barely-there soft seams. */
function paintStone(u, v, options) {
  const cells = nearestCells(u, v, options.cellsX, options.cellsY, options.seed);
  const n = quietField(u, v, options.seed + 17);
  const stoneTone = hash2(cells.first.id, 9, options.seed + 29) * 0.35 + n * 0.65;
  let base = mixColor(color(options.dark), color(options.light), 0.46 + stoneTone * 0.1);
  const seam = 1 - smoothstep(options.seamStart, options.seamEnd, cells.gap);
  base = tint(base, color(options.seamColor), seam * options.seamAmount);
  return [...base, 255];
}

function paintCobble(u, v) {
  return paintStone(u, v, {
    cellsX: 4,
    cellsY: 3,
    seed: 43,
    dark: '#6a6d5e',
    light: '#858575',
    seamColor: '#56594e',
    seamStart: 0.02,
    seamEnd: 0.18,
    seamAmount: 0.16,
  });
}

function paintCliff(u, v) {
  return paintStone(u, v, {
    cellsX: 3,
    cellsY: 3,
    seed: 71,
    dark: '#555952',
    light: '#706b5d',
    seamColor: '#444943',
    seamStart: 0.02,
    seamEnd: 0.18,
    seamAmount: 0.14,
  });
}

function paintCave(u, v) {
  return paintStone(u, v, {
    cellsX: 3,
    cellsY: 3,
    seed: 101,
    dark: '#3f4646',
    light: '#574f49',
    seamColor: '#303837',
    seamStart: 0.02,
    seamEnd: 0.18,
    seamAmount: 0.13,
  });
}

function paintWood(u, v) {
  const boards = 4;
  const boardFloat = u * boards;
  const board = Math.floor(boardFloat);
  const edgeDistance = Math.min(boardFloat - board, 1 - (boardFloat - board));
  const seam = 1 - smoothstep(0.035, 0.16, edgeDistance);
  const n = quietField(u, v, 141);
  const phase = hash2(board, 3, 151) * TAU;
  // A broad, almost imperceptible grain wash keeps it painted rather than flat.
  const grain = 0.5 + 0.5 * Math.sin(TAU * (v * 1.5) + phase);
  let base = mixColor(color('#75563b'), color('#916d49'), 0.38 + n * 0.16 + grain * 0.018);
  base = tint(base, color('#4e3d2f'), seam * 0.16);
  return [...base, 255];
}

function paintIron(u, v) {
  const panelX = u * 3;
  const panelY = v * 2;
  const edgeX = Math.min(panelX % 1, 1 - (panelX % 1));
  const edgeY = Math.min(panelY % 1, 1 - (panelY % 1));
  const seam = Math.max(1 - smoothstep(0.035, 0.16, edgeX), 1 - smoothstep(0.035, 0.16, edgeY));
  const n = quietField(u, v, 171);
  let base = mixColor(color('#596560'), color('#707a72'), 0.42 + n * 0.14);
  const warmWash = 0.5 + 0.5 * Math.sin(TAU * (u * 1.5 - v * 0.75));
  base = tint(base, color('#705744'), warmWash * 0.035);
  base = tint(base, color('#3d4946'), seam * 0.13);
  return [...base, 255];
}

function paintBark(u, v) {
  const n = quietField(u, v, 191);
  let base = mixColor(color('#584638'), color('#6b533d'), 0.42 + n * 0.13);
  base = softPatches(u, v, base, [
    { x: 0.24, y: 0.34, rx: 0.2, ry: 0.5, angle: 0.06, color: color('#755b42'), amount: 0.045 },
    { x: 0.78, y: 0.72, rx: 0.2, ry: 0.5, angle: -0.08, color: color('#493a32'), amount: 0.04 },
  ]);
  return [...base, 255];
}

function paintLava(u, v) {
  const cells = nearestCells(u, v, 4, 4, 211);
  const n = quietField(u, v, 221);
  let base = mixColor(color('#404443'), color('#54483f'), 0.38 + n * 0.12);
  const seam = 1 - smoothstep(0.025, 0.18, cells.gap);
  base = tint(base, color('#87452f'), seam * 0.28);
  base = tint(base, color('#a45b34'), seam * 0.06);
  return [...base, 255];
}

function paintWater(u, v) {
  const flow = quietField(u * 0.9 + 0.03, v * 0.9, 241);
  const band = 0.5 + 0.5 * Math.sin(TAU * (u * 2 + v * 2.5 + flow * 0.15));
  let base = mixColor(color('#3f696d'), color('#5b7e7b'), 0.42 + band * 0.07);
  base = tint(base, color('#83a095'), Math.max(0, band - 0.82) * 0.1);
  base = tint(base, color('#315a63'), quietField(u, v, 245) * 0.035);
  return [...base, 255];
}

function paintTriangle(data, width, height, vertices, rgb, alpha) {
  const minX = Math.floor(Math.min(...vertices.map((point) => point.x))) - 1;
  const maxX = Math.ceil(Math.max(...vertices.map((point) => point.x))) + 1;
  const minY = Math.max(0, Math.floor(Math.min(...vertices.map((point) => point.y))) - 1);
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...vertices.map((point) => point.y))) + 1);
  const [a, b, c] = vertices;
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(area) < 0.01) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w1 = ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) / area;
      const w2 = ((c.x - b.x) * (y - b.y) - (c.y - b.y) * (x - b.x)) / area;
      const w3 = ((a.x - c.x) * (y - c.y) - (a.y - c.y) * (x - c.x)) / area;
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
        const tx = mod(x, width);
        const i = pixelIndex(width, tx, y);
        const blendAmount = clamp(alpha / 255);
        data[i] = Math.round(lerp(data[i], rgb[0], blendAmount));
        data[i + 1] = Math.round(lerp(data[i + 1], rgb[1], blendAmount));
        data[i + 2] = Math.round(lerp(data[i + 2], rgb[2], blendAmount));
        data[i + 3] = Math.max(data[i + 3], alpha);
      }
    }
  }
}

function makeGrassFringe() {
  const width = 1024;
  const height = 256;
  const data = Buffer.alloc(width * height * 4);
  const root = color('#526837');
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rootAmount = smoothstep(0.58, 0.9, y / height);
      if (rootAmount > 0) {
        const n = quietField(x / width, y / height, 301);
        const rgb = mixColor(root, color('#627645'), n * 0.12);
        put(data, width, x, y, rgb, Math.round(rootAmount * 185));
      }
    }
  }

  let seed = 303;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const bladeColors = [color('#5a7040'), color('#617748'), color('#4d6338')];
  // Sparse, broad tufts: the fringe is an edge cue, not a field of confetti.
  for (let i = 0; i < 28; i++) {
    const x = random() * width;
    const baseY = 202 + random() * 36;
    const length = 42 + random() * 38;
    const lean = (random() - 0.5) * 48;
    const halfWidth = 6 + random() * 5;
    const rgb = bladeColors[i % bladeColors.length];
    const alpha = 118 + Math.round(random() * 28);
    for (const shift of [-width, 0, width]) {
      paintTriangle(data, width, height, [
        { x: x + shift - halfWidth, y: baseY },
        { x: x + shift + halfWidth, y: baseY },
        { x: x + shift + lean, y: baseY - length },
      ], rgb, alpha);
    }
  }

  encodePng(join(OUT, 'grass-fringe.png'), width, height, data);
  console.log('  wrote grass-fringe.png (1024x256)');
}

mkdirSync(OUT, { recursive: true });
const TRACK_OUT = join(ROOT, 'public/art/tracks');
mkdirSync(TRACK_OUT, { recursive: true });
console.log('Generating restrained, low-contrast Warcraft-inspired repeat textures...');

const texturePainters = {
  dirt: paintDirt,
  grass: paintGrass,
  cobble: paintCobble,
  cliff: paintCliff,
  caverock: paintCave,
  wood: paintWood,
  iron: paintIron,
  bark: paintBark,
  lava: paintLava,
  water: paintWater,
};

for (const [name, painter] of Object.entries(texturePainters)) {
  makeTexture(name, painter);
  // Keep the legacy preloaded aliases quiet too. Some older 2D tooling still
  // requests art/tracks/tex-*.png even though the live 3D renderer uses /textures.
  const [aliasWidth, aliasHeight] = name === 'wood' ? [1200, 1600] : [1408, 1408];
  writeTexture(join(TRACK_OUT, `tex-${name}.png`), painter, aliasWidth, aliasHeight);
}

makeGrassFringe();
console.log('Done. The renderer can use these directly with RepeatWrapping.');
