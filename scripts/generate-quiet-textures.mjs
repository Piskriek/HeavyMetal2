import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './edge-magenta-lib.mjs';

/**
 * The first-pass 3D materials were painted with very sharp value changes and
 * then layered again in the renderer. That made the repeated surfaces louder
 * than the scenery around them. These small, deliberately quiet tiles use a
 * Warcraft-inspired hand-painted palette: broad brush-shaped value changes,
 * softened edges, and a narrow luminance range. Every field is periodic, so
 * the generated PNGs remain safe to repeat in world space.
 */

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'public/textures');
const TAU = Math.PI * 2;
const W = 512;
const H = 512;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, value) => {
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

/** Smooth, tile-periodic value noise. The cell count is an integer period. */
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

function quietNoise(u, v, seed) {
  return valueNoise(u, v, 4, seed) * 0.68 + valueNoise(u, v, 8, seed + 17) * 0.22 + valueNoise(u, v, 16, seed + 31) * 0.1;
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

function overlay(base, tint, amount) {
  return mixColor(base, tint, clamp(amount));
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

function blend(data, width, x, y, rgb, amount) {
  if (x < 0 || y < 0 || x >= width || y >= data.length / (width * 4)) return;
  const i = pixelIndex(width, x, y);
  const a = clamp(amount);
  data[i] = Math.round(lerp(data[i], rgb[0], a));
  data[i + 1] = Math.round(lerp(data[i + 1], rgb[1], a));
  data[i + 2] = Math.round(lerp(data[i + 2], rgb[2], a));
}

function rotatedPatch(u, v, patch) {
  let dx = wrapDistance(u - patch.x);
  let dy = wrapDistance(v - patch.y);
  const c = Math.cos(patch.angle ?? 0);
  const s = Math.sin(patch.angle ?? 0);
  const rx = (dx * c + dy * s) / patch.rx;
  const ry = (-dx * s + dy * c) / patch.ry;
  const distance = Math.sqrt(rx * rx + ry * ry);
  return smooth(1.12, 0.22, distance);
}

function paintPatches(u, v, base, patches) {
  let output = base;
  for (const patch of patches) {
    const field = rotatedPatch(u, v, patch);
    output = overlay(output, patch.color, field * patch.alpha);
  }
  return output;
}

function makeTexture(name, painter, width = W, height = H) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      const [r, g, b, a = 255] = painter(u, v, x, y);
      put(data, width, x, y, [r, g, b], a);
    }
  }
  encodePng(join(OUT, `${name}.png`), width, height, data);
  console.log(`  wrote ${name}.png (${width}x${height})`);
}

function paintQuietDirt(u, v) {
  const n = quietNoise(u, v, 11);
  let base = mixColor(color('#766443'), color('#9a8557'), 0.28 + n * 0.5);
  base = paintPatches(u, v, base, [
    { x: 0.14, y: 0.28, rx: 0.24, ry: 0.18, angle: -0.3, color: color('#a38e5d'), alpha: 0.16 },
    { x: 0.62, y: 0.22, rx: 0.28, ry: 0.16, angle: 0.4, color: color('#66543c'), alpha: 0.13 },
    { x: 0.82, y: 0.74, rx: 0.3, ry: 0.2, angle: -0.2, color: color('#ae9661'), alpha: 0.12 },
    { x: 0.34, y: 0.78, rx: 0.26, ry: 0.18, angle: 0.2, color: color('#6d5a3d'), alpha: 0.1 },
  ]);
  return [...base, 255];
}

function paintQuietGrass(u, v) {
  const n = quietNoise(u, v, 23);
  let base = mixColor(color('#435a31'), color('#6f8248'), 0.25 + n * 0.55);
  base = paintPatches(u, v, base, [
    { x: 0.12, y: 0.18, rx: 0.22, ry: 0.3, angle: 0.15, color: color('#7e8d4d'), alpha: 0.15 },
    { x: 0.48, y: 0.62, rx: 0.32, ry: 0.2, angle: -0.45, color: color('#384e2b'), alpha: 0.15 },
    { x: 0.82, y: 0.34, rx: 0.23, ry: 0.26, angle: 0.6, color: color('#819151'), alpha: 0.12 },
  ]);
  // Wide, soft brush sweeps stand in for blades without turning the ground into confetti.
  const sweep = 0.5 + 0.5 * Math.sin(TAU * (u * 2.0 + v * 3.0) + valueNoise(u, v, 4, 77) * 0.7);
  base = overlay(base, color('#8a9854'), (sweep ** 5) * 0.08);
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
      let centerX = cellX + 0.5 + (hash2(cellX, cellY, seed) - 0.5) * 0.34;
      let centerY = cellY + 0.5 + (hash2(cellX, cellY, seed + 3) - 0.5) * 0.34;
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
  return { first, second, gap: second.distance - first.distance };
}

function paintQuietCobble(u, v) {
  const cells = nearestCells(u, v, 6, 6, 43);
  const n = quietNoise(u, v, 51);
  const stoneTone = hash2(cells.first.id, 9, 61) * 0.7 + n * 0.3;
  let base = mixColor(color('#626957'), color('#858671'), 0.26 + stoneTone * 0.34);
  const seam = 1 - smooth(0.018, 0.11, cells.gap);
  base = overlay(base, color('#46483d'), seam * 0.42);
  base = overlay(base, color('#a49f7a'), smooth(0.1, 0.28, cells.gap) * 0.06);
  return [...base, 255];
}

function paintQuietCliff(u, v) {
  const cells = nearestCells(u, v, 4, 5, 71);
  const n = quietNoise(u, v, 81);
  const rockTone = hash2(cells.first.id, 5, 91) * 0.7 + n * 0.3;
  let base = mixColor(color('#4b4d49'), color('#777064'), 0.24 + rockTone * 0.33);
  const seam = 1 - smooth(0.012, 0.1, cells.gap);
  base = overlay(base, color('#343936'), seam * 0.34);
  base = overlay(base, color('#958671'), smooth(0.1, 0.26, cells.gap) * 0.08);
  return [...base, 255];
}

function paintQuietCave(u, v) {
  const cells = nearestCells(u, v, 5, 5, 101);
  const n = quietNoise(u, v, 111);
  const rockTone = hash2(cells.first.id, 3, 121) * 0.7 + n * 0.3;
  let base = mixColor(color('#34383a'), color('#5d514b'), 0.22 + rockTone * 0.34);
  const seam = 1 - smooth(0.016, 0.105, cells.gap);
  base = overlay(base, color('#242b2d'), seam * 0.32);
  base = overlay(base, color('#765b4a'), smooth(0.1, 0.27, cells.gap) * 0.07);
  return [...base, 255];
}

function paintQuietWood(u, v) {
  const boards = 5;
  const boardFloat = u * boards;
  const board = Math.floor(boardFloat);
  const edgeDistance = Math.min(boardFloat - board, 1 - (boardFloat - board));
  const seam = 1 - smooth(0.035, 0.12, edgeDistance);
  const phase = hash2(board, 3, 141) * TAU;
  const grain = 0.5 + 0.5 * Math.sin(TAU * (v * 2.2 + Math.sin(TAU * v * 1.1 + phase) * 0.06) + phase);
  const n = quietNoise(u, v, 151);
  let base = mixColor(color('#6f4e34'), color('#a2774a'), 0.24 + n * 0.36 + grain * 0.08);
  base = overlay(base, color('#382b23'), seam * 0.38);
  base = overlay(base, color('#b28a59'), (1 - seam) * (0.5 + 0.5 * Math.sin(TAU * v * 2 + phase)) * 0.045);
  return [...base, 255];
}

function paintQuietIron(u, v) {
  const panelX = u * 4;
  const panelY = v * 3;
  const seamX = 1 - smooth(0.025, 0.09, Math.min(panelX % 1, 1 - (panelX % 1)));
  const seamY = 1 - smooth(0.025, 0.09, Math.min(panelY % 1, 1 - (panelY % 1)));
  const n = quietNoise(u, v, 171);
  let base = mixColor(color('#4b5957'), color('#778078'), 0.25 + n * 0.34);
  const rustWash = 0.5 + 0.5 * Math.sin(TAU * (u * 2 - v * 1.5));
  base = overlay(base, color('#7e5a43'), rustWash * 0.1);
  base = overlay(base, color('#293533'), Math.max(seamX, seamY) * 0.4);
  return [...base, 255];
}

function paintQuietBark(u, v) {
  const n = quietNoise(u, v, 191);
  const bands = 0.5 + 0.5 * Math.sin(TAU * (u * 5 + valueNoise(u, v, 4, 193) * 0.35));
  let base = mixColor(color('#4e3d32'), color('#765a40'), 0.25 + n * 0.3 + bands * 0.1);
  base = paintPatches(u, v, base, [
    { x: 0.22, y: 0.33, rx: 0.12, ry: 0.34, angle: 0.08, color: color('#876846'), alpha: 0.1 },
    { x: 0.76, y: 0.7, rx: 0.13, ry: 0.32, angle: -0.1, color: color('#382e29'), alpha: 0.1 },
  ]);
  return [...base, 255];
}

function paintQuietLava(u, v) {
  const cells = nearestCells(u, v, 5, 5, 211);
  const n = quietNoise(u, v, 221);
  const rockTone = hash2(cells.first.id, 4, 231) * 0.6 + n * 0.4;
  let base = mixColor(color('#353a3b'), color('#554b45'), 0.22 + rockTone * 0.3);
  const seam = 1 - smooth(0.015, 0.105, cells.gap);
  base = overlay(base, color('#9a4d2e'), seam * 0.78);
  base = overlay(base, color('#c06b32'), seam * smooth(0.02, 0.08, cells.gap) * 0.22);
  return [...base, 255];
}

function paintQuietWater(u, v) {
  const flowNoise = valueNoise(u, v, 4, 241) * 0.16 + valueNoise(u, v, 8, 242) * 0.05;
  const band = 0.5 + 0.5 * Math.sin(TAU * (u * 3 + v * 4 + flowNoise));
  let base = mixColor(color('#2f6068'), color('#5e8585'), 0.23 + band * 0.33);
  const softFoam = Math.max(0, Math.sin(TAU * (u * 3 + v * 4 + 0.12))) ** 10;
  base = overlay(base, color('#9ab5a5'), softFoam * 0.16);
  base = overlay(base, color('#274e59'), valueNoise(u, v, 4, 245) * 0.09);
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
  const root = color('#4f6732');
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rootAmount = smooth(0.62, 0.9, y / height);
      if (rootAmount > 0) {
        const n = valueNoise(x / width, y / height, 8, 301);
        const rgb = mixColor(root, color('#718044'), n * 0.2);
        put(data, width, x, y, rgb, Math.round(rootAmount * 230));
      }
    }
  }

  let seed = 303;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const bladeColors = [color('#5e7637'), color('#718548'), color('#7c8c4c'), color('#4b6232')];
  for (let i = 0; i < 66; i++) {
    const x = random() * width;
    const baseY = 198 + random() * 44;
    const length = 50 + random() * 54;
    const lean = (random() - 0.5) * 65;
    const halfWidth = 4.5 + random() * 4.5;
    const rgb = bladeColors[i % bladeColors.length];
    const alpha = 175 + Math.round(random() * 42);
    // Draw copies at both horizontal edges so the fringe is actually seamless.
    for (const shift of [-width, 0, width]) {
      paintTriangle(data, width, height, [
        { x: x + shift - halfWidth, y: baseY },
        { x: x + shift + halfWidth, y: baseY },
        { x: x + shift + lean, y: baseY - length },
      ], rgb, alpha);
      if (i % 3 === 0) {
        paintTriangle(data, width, height, [
          { x: x + shift, y: baseY },
          { x: x + shift + halfWidth * 0.45, y: baseY },
          { x: x + shift + lean * 0.72, y: baseY - length * 0.9 },
        ], color('#a0aa62'), 72);
      }
    }
  }

  encodePng(join(OUT, 'grass-fringe.png'), width, height, data);
  console.log('  wrote grass-fringe.png (1024x256)');
}

mkdirSync(OUT, { recursive: true });
console.log('Generating quiet, low-contrast Warcraft-inspired repeat textures...');
makeTexture('dirt', paintQuietDirt);
makeTexture('grass', paintQuietGrass);
makeTexture('cobble', paintQuietCobble);
makeTexture('cliff', paintQuietCliff);
makeTexture('caverock', paintQuietCave);
makeTexture('wood', paintQuietWood);
makeTexture('iron', paintQuietIron);
makeTexture('bark', paintQuietBark);
makeTexture('lava', paintQuietLava);
makeTexture('water', paintQuietWater);
makeGrassFringe();
console.log('Done. The renderer can use these directly with RepeatWrapping.');
