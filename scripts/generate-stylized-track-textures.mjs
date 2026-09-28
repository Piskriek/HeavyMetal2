#!/usr/bin/env node
/**
 * Creates the low-density, hand-painted material kit used by the 3D course.
 *
 * The first texture pass used busy source tiles and a shader that re-sampled them
 * several times.  That made every material read as visual noise at race speed.
 * This generator deliberately uses large colour masses, dry-brush passes, and a
 * restrained palette. It is deterministic and has no browser / OS dependency.
 *
 * Outputs:
 *   - public/art/texture-masters (source paintings retained for reproducible builds)
 *   - public/textures/*.png      (the live Three.js materials)
 *   - public/textures/*.webp     (matching optional delivery copies)
 *   - public/art/tracks/tex-*.png (the 2D/legacy course-art path)
 *   - public/art/decals/grass-fringe.png (track-builder decal)
 *
 * Usage:
 *   node scripts/generate-stylized-track-textures.mjs
 *   node scripts/generate-stylized-track-textures.mjs --check
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './edge-magenta-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const SIZE = 512;
const isCheck = process.argv.includes('--check');

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const smooth = (value) => value * value * (3 - 2 * value);
const mod = (value, by) => ((value % by) + by) % by;

function rgb(hex) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let word = state;
    word = Math.imul(word ^ (word >>> 15), word | 1);
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
    return ((word ^ (word >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x, y, seed) {
  let value = (Math.imul((x | 0) ^ seed, 0x45d9f3b) + Math.imul((y | 0) ^ (seed >>> 5), 0x27d4eb2d)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b) >>> 0;
  value ^= value >>> 16;
  return value / 4294967296;
}

/** A smooth, toroidal value field: tile edges have exactly the same value. */
function tileNoise(x, y, cells, seed) {
  const fx = x * cells / SIZE;
  const fy = y * cells / SIZE;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = smooth(fx - ix);
  const ty = smooth(fy - iy);
  const sample = (px, py) => hash(mod(px, cells), mod(py, cells), seed);
  return mix(mix(sample(ix, iy), sample(ix + 1, iy), tx), mix(sample(ix, iy + 1), sample(ix + 1, iy + 1), tx), ty);
}

function createCanvas(width = SIZE, height = SIZE, base = [0, 0, 0, 255]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = base[0]; data[i + 1] = base[1]; data[i + 2] = base[2]; data[i + 3] = base[3] ?? 255;
  }
  return { width, height, data };
}

function paint(canvas, x, y, color, alpha = 1) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height || alpha <= 0) return;
  const index = (py * canvas.width + px) * 4;
  const sourceAlpha = clamp(alpha * ((color[3] ?? 255) / 255));
  const destinationAlpha = canvas.data[index + 3] / 255;
  const outAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) return;
  for (let channel = 0; channel < 3; channel++) {
    const source = color[channel];
    const destination = canvas.data[index + channel];
    canvas.data[index + channel] = Math.round((source * sourceAlpha + destination * destinationAlpha * (1 - sourceAlpha)) / outAlpha);
  }
  canvas.data[index + 3] = Math.round(outAlpha * 255);
}

function fillPaintedBase(canvas, color, seed, variation = 18) {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const broad = tileNoise(x, y, 5, seed) - 0.5;
      const medium = tileNoise(x, y, 11, seed + 101) - 0.5;
      const grain = hash(x, y, seed + 202) - 0.5;
      const offset = broad * variation + medium * variation * 0.45 + grain * 2.8;
      const index = (y * canvas.width + x) * 4;
      canvas.data[index] = clamp(Math.round(color[0] + offset), 0, 255);
      canvas.data[index + 1] = clamp(Math.round(color[1] + offset), 0, 255);
      canvas.data[index + 2] = clamp(Math.round(color[2] + offset), 0, 255);
      canvas.data[index + 3] = 255;
    }
  }
}

function softEllipse(canvas, cx, cy, rx, ry, angle, color, alpha, wrap = true) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const radius = Math.ceil(Math.max(rx, ry) + 2);
  const copies = wrap ? [-canvas.width, 0, canvas.width] : [0];
  const yCopies = wrap && canvas.height === SIZE ? [-canvas.height, 0, canvas.height] : [0];
  for (const dxCopy of copies) {
    for (const dyCopy of yCopies) {
      const x0 = Math.floor(cx + dxCopy - radius);
      const x1 = Math.ceil(cx + dxCopy + radius);
      const y0 = Math.floor(cy + dyCopy - radius);
      const y1 = Math.ceil(cy + dyCopy + radius);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - (cx + dxCopy);
          const dy = y - (cy + dyCopy);
          const localX = (dx * cosine + dy * sine) / rx;
          const localY = (-dx * sine + dy * cosine) / ry;
          const distance = Math.sqrt(localX * localX + localY * localY);
          if (distance > 1) continue;
          const feather = Math.pow(1 - distance, 0.44);
          paint(canvas, x, y, color, alpha * feather);
        }
      }
    }
  }
}

function brushStroke(canvas, points, width, color, alpha, seed, dry = 0.2, wrap = true) {
  const rng = random(seed);
  for (let segment = 0; segment < points.length - 1; segment++) {
    const [a, b] = [points[segment], points[segment + 1]];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(2, Math.ceil(length / Math.max(2.5, width * 0.22)));
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      if (rng() < dry * 0.35 && step !== 0 && step !== steps) continue;
      const w = width * (0.74 + rng() * 0.34);
      const jitter = (rng() - 0.5) * width * 0.20;
      const x = mix(a.x, b.x, t) - Math.sin(angle) * jitter;
      const y = mix(a.y, b.y, t) + Math.cos(angle) * jitter;
      softEllipse(canvas, x, y, Math.max(1.3, w * 0.43), Math.max(1, w * 0.17), angle, color, alpha * (0.75 + rng() * 0.25), wrap);
    }
  }
}

function dryBrush(canvas, points, width, color, alpha, seed, count = 7, wrap = true) {
  const rng = random(seed);
  for (let bristle = 0; bristle < count; bristle++) {
    const offset = (bristle / Math.max(1, count - 1) - 0.5) * width * 0.72;
    const shifted = points.map((point, index) => {
      const next = points[Math.min(points.length - 1, index + 1)];
      const previous = points[Math.max(0, index - 1)];
      const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
      return {
        x: point.x - Math.sin(angle) * offset + (rng() - 0.5) * 2,
        y: point.y + Math.cos(angle) * offset + (rng() - 0.5) * 2,
      };
    });
    brushStroke(canvas, shifted, Math.max(1.15, width * (0.045 + rng() * 0.035)), color, alpha * (0.55 + rng() * 0.45), seed + bristle * 17, 0.50, wrap);
  }
}

function polygon(canvas, points, color, alpha, wrap = true) {
  const offsets = wrap ? [-canvas.width, 0, canvas.width] : [0];
  const yOffsets = wrap && canvas.height === SIZE ? [-canvas.height, 0, canvas.height] : [0];
  for (const ox of offsets) {
    for (const oy of yOffsets) {
      const shifted = points.map((point) => ({ x: point.x + ox, y: point.y + oy }));
      let minY = Math.max(0, Math.floor(Math.min(...shifted.map((point) => point.y))));
      let maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(...shifted.map((point) => point.y))));
      for (let y = minY; y <= maxY; y++) {
        const intersections = [];
        for (let i = 0; i < shifted.length; i++) {
          const a = shifted[i];
          const b = shifted[(i + 1) % shifted.length];
          if ((a.y > y) === (b.y > y)) continue;
          intersections.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
        }
        intersections.sort((a, b) => a - b);
        for (let i = 0; i < intersections.length; i += 2) {
          const start = Math.max(0, Math.ceil(intersections[i]));
          const end = Math.min(canvas.width - 1, Math.floor(intersections[i + 1] ?? intersections[i]));
          for (let x = start; x <= end; x++) paint(canvas, x, y, color, alpha);
        }
      }
    }
  }
}

function raggedOval(cx, cy, rx, ry, seed, corners = 11) {
  const rng = random(seed);
  const points = [];
  for (let i = 0; i < corners; i++) {
    const angle = Math.PI * 2 * i / corners;
    const radius = 0.82 + rng() * 0.27;
    points.push({ x: cx + Math.cos(angle) * rx * radius, y: cy + Math.sin(angle) * ry * radius });
  }
  return points;
}

function paintPebble(canvas, x, y, radius, fill, highlight, seed) {
  polygon(canvas, raggedOval(x, y, radius, radius * 0.72, seed, 7), fill, 0.9);
  softEllipse(canvas, x - radius * 0.22, y - radius * 0.2, radius * 0.42, radius * 0.14, -0.35, highlight, 0.5);
}

function sealTileEdges(canvas) {
  const { width, height, data } = canvas;
  // A small cross-fade gives the wrap a shared visual treatment.  The first and
  // last pixels are then made identical, so the asset passes an exact edge test.
  const blend = Math.min(12, Math.floor(Math.min(width, height) / 8));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < blend; x++) {
      const left = (y * width + x) * 4;
      const right = (y * width + (width - blend + x)) * 4;
      const t = x / Math.max(1, blend - 1);
      for (let c = 0; c < 4; c++) {
        const a = data[left + c];
        const b = data[right + c];
        data[left + c] = Math.round(mix(a, b, 0.5 * (1 - t)));
        data[right + c] = Math.round(mix(b, a, 0.5 * t));
      }
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < blend; y++) {
      const top = (y * width + x) * 4;
      const bottom = ((height - blend + y) * width + x) * 4;
      const t = y / Math.max(1, blend - 1);
      for (let c = 0; c < 4; c++) {
        const a = data[top + c];
        const b = data[bottom + c];
        data[top + c] = Math.round(mix(a, b, 0.5 * (1 - t)));
        data[bottom + c] = Math.round(mix(b, a, 0.5 * t));
      }
    }
  }
  for (let y = 0; y < height; y++) {
    const first = y * width * 4;
    const last = (y * width + width - 1) * 4;
    data.copy(data, last, first, first + 4);
  }
  for (let x = 0; x < width; x++) {
    const first = x * 4;
    const last = ((height - 1) * width + x) * 4;
    data.copy(data, last, first, first + 4);
  }
}

function edgeDifference(canvas, horizontal = true) {
  const { width, height, data } = canvas;
  let max = 0;
  const count = horizontal ? height : width;
  for (let i = 0; i < count; i++) {
    const a = horizontal ? i * width * 4 : i * 4;
    const b = horizontal ? (i * width + width - 1) * 4 : ((height - 1) * width + i) * 4;
    for (let c = 0; c < 4; c++) max = Math.max(max, Math.abs(data[a + c] - data[b + c]));
  }
  return max;
}

function paintedDirt() {
  const canvas = createCanvas();
  const earth = rgb('#9a7544');
  fillPaintedBase(canvas, earth, 11, 17);
  const washes = [
    [[70, 95], [195, 74], [310, 103], [450, 72]],
    [[-20, 252], [126, 214], [265, 240], [452, 208]],
    [[55, 398], [185, 360], [322, 390], [524, 350]],
    [[-10, 488], [135, 452], [286, 484], [460, 445]],
  ];
  const shades = ['#c39a5b', '#7f5834', '#b7894f', '#704b31'];
  washes.forEach((points, i) => {
    brushStroke(canvas, points.map(([x, y]) => ({ x, y })), 70 + i * 8, rgb(shades[i]), 0.28, 110 + i * 7, 0.18);
    dryBrush(canvas, points.map(([x, y]) => ({ x, y: y - 10 })), 39, rgb(i % 2 ? '#4c3528' : '#e0bc75'), 0.20, 210 + i * 9, 9);
  });
  const rng = random(99);
  for (let i = 0; i < 14; i++) {
    const x = rng() * SIZE; const y = rng() * SIZE;
    paintPebble(canvas, x, y, 3 + rng() * 5, rgb('#5e5140'), rgb('#d1b275'), 310 + i);
  }
  sealTileEdges(canvas);
  return canvas;
}

function paintedGrass() {
  const canvas = createCanvas();
  fillPaintedBase(canvas, rgb('#426d2e'), 22, 15);
  const swashes = [
    { p: [[-20, 92], [122, 55], [277, 78], [460, 35]], c: '#6e963c' },
    { p: [[30, 209], [150, 171], [299, 211], [516, 174]], c: '#315c2a' },
    { p: [[-32, 332], [150, 298], [304, 350], [500, 312]], c: '#7d9c43' },
    { p: [[12, 445], [170, 407], [326, 451], [512, 418]], c: '#2c5729' },
  ];
  swashes.forEach((swash, index) => {
    const points = swash.p.map(([x, y]) => ({ x, y }));
    brushStroke(canvas, points, 92, rgb(swash.c), 0.27, 420 + index, 0.22);
    dryBrush(canvas, points.map((point) => ({ x: point.x, y: point.y - 17 })), 48, rgb(index % 2 ? '#183f25' : '#aac258'), 0.18, 440 + index, 9);
  });
  const rng = random(401);
  // Sparse, loose grass accents—not a dense lawn or floral pattern.
  for (let i = 0; i < 28; i++) {
    const x = rng() * SIZE; const y = rng() * SIZE;
    const length = 10 + rng() * 17;
    const lean = (rng() - 0.5) * 16;
    brushStroke(canvas, [{ x, y: y + length / 2 }, { x: x + lean, y: y - length / 2 }], 3.2, rgb(i % 3 ? '#8fae49' : '#244c29'), 0.35, 460 + i, 0.2);
  }
  sealTileEdges(canvas);
  return canvas;
}

function paintedCliff(cave = false) {
  const canvas = createCanvas();
  const base = cave ? '#38404a' : '#6b685d';
  fillPaintedBase(canvas, rgb(base), cave ? 66 : 44, 14);
  const palette = cave
    ? ['#202b37', '#4f5c66', '#2b3440', '#64717a', '#26313c']
    : ['#4c4f4b', '#898071', '#5a5c57', '#a19277', '#414843'];
  const rng = random(cave ? 771 : 661);
  for (let i = 0; i < 7; i++) {
    const cx = rng() * SIZE; const cy = rng() * SIZE;
    const width = 90 + rng() * 95; const height = 65 + rng() * 75;
    const shape = raggedOval(cx, cy, width, height, 690 + i + (cave ? 20 : 0), 7);
    polygon(canvas, shape, rgb(palette[i % palette.length]), 0.45);
    const direction = -0.28 + rng() * 0.58;
    const points = [{ x: cx - width * 0.7, y: cy - height * 0.35 }, { x: cx, y: cy - height * 0.48 + direction * 22 }, { x: cx + width * 0.68, y: cy - height * 0.23 }];
    dryBrush(canvas, points, 24, rgb(cave ? '#95a0a0' : '#c4b797'), 0.19, 710 + i, 6);
    brushStroke(canvas, [{ x: cx - width * 0.4, y: cy + height * 0.38 }, { x: cx + width * 0.4, y: cy + height * 0.30 }], 10, rgb(cave ? '#1d2732' : '#3d413e'), 0.25, 730 + i, 0.42);
  }
  if (cave) {
    for (let i = 0; i < 6; i++) {
      const x = (i * 91 + 44) % SIZE;
      dryBrush(canvas, [{ x, y: -15 }, { x: x + 20, y: 120 }, { x: x - 28, y: 256 }, { x: x + 15, y: 530 }], 7, rgb('#161e29'), 0.34, 750 + i, 3);
    }
  }
  sealTileEdges(canvas);
  return canvas;
}

function paintedLava() {
  const canvas = createCanvas();
  fillPaintedBase(canvas, rgb('#322b2e'), 88, 10);
  const rng = random(811);
  for (let i = 0; i < 9; i++) {
    const cx = rng() * SIZE; const cy = rng() * SIZE;
    const plate = raggedOval(cx, cy, 68 + rng() * 60, 48 + rng() * 44, 830 + i, 6);
    polygon(canvas, plate, rgb(i % 2 ? '#211f27' : '#44383a'), 0.8);
    dryBrush(canvas, [{ x: cx - 45, y: cy - 20 }, { x: cx + 5, y: cy - 35 }, { x: cx + 52, y: cy - 10 }], 18, rgb('#66504a'), 0.24, 850 + i, 4);
  }
  const rivers = [
    [{ x: -20, y: 120 }, { x: 120, y: 135 }, { x: 255, y: 98 }, { x: 532, y: 143 }],
    [{ x: 80, y: 505 }, { x: 210, y: 382 }, { x: 335, y: 401 }, { x: 505, y: 314 }],
    [{ x: 417, y: -10 }, { x: 379, y: 120 }, { x: 452, y: 228 }, { x: 533, y: 263 }],
  ];
  rivers.forEach((points, index) => {
    brushStroke(canvas, points, 22, rgb('#b74824'), 0.93, 870 + index, 0.04);
    brushStroke(canvas, points, 9, rgb('#f28632'), 0.90, 880 + index, 0.12);
    dryBrush(canvas, points, 8, rgb('#ffd06a'), 0.48, 890 + index, 3);
  });
  sealTileEdges(canvas);
  return canvas;
}

function paintedWood() {
  const canvas = createCanvas();
  fillPaintedBase(canvas, rgb('#765236'), 111, 12);
  const boards = [0, 128, 256, 384];
  boards.forEach((left, index) => {
    const c = rgb(['#855c37', '#6b472f', '#98683c', '#704930'][index]);
    polygon(canvas, [{ x: left + 5, y: 0 }, { x: left + 123, y: 0 }, { x: left + 119, y: 512 }, { x: left + 7, y: 512 }], c, 0.42);
    brushStroke(canvas, [{ x: left + 35, y: -20 }, { x: left + 47, y: 185 }, { x: left + 29, y: 355 }, { x: left + 45, y: 530 }], 31, rgb('#bd8a50'), 0.19, 930 + index, 0.28);
    dryBrush(canvas, [{ x: left + 75, y: -8 }, { x: left + 62, y: 190 }, { x: left + 77, y: 330 }, { x: left + 57, y: 520 }], 22, rgb('#432d24'), 0.27, 950 + index, 5);
    brushStroke(canvas, [{ x: left + 2, y: 0 }, { x: left + 3, y: 512 }], 7, rgb('#35271f'), 0.62, 970 + index, 0.18);
  });
  const rng = random(981);
  for (let i = 0; i < 8; i++) paintPebble(canvas, 43 + (i % 4) * 129, 80 + Math.floor(i / 4) * 280 + rng() * 50, 4.5, rgb('#2e3332'), rgb('#aeb2a0'), 990 + i);
  sealTileEdges(canvas);
  return canvas;
}

function paintedCobble() {
  const canvas = createCanvas();
  fillPaintedBase(canvas, rgb('#687168'), 122, 11);
  const rng = random(1001);
  const rows = 4; const columns = 3;
  for (let row = -1; row <= rows; row++) {
    for (let column = -1; column <= columns; column++) {
      const shift = row % 2 ? 65 : 0;
      const cx = column * 170 + shift + 82 + (rng() - 0.5) * 13;
      const cy = row * 139 + 70 + (rng() - 0.5) * 13;
      const width = 70 + rng() * 22; const height = 49 + rng() * 17;
      polygon(canvas, raggedOval(cx, cy, width, height, 1020 + row * 9 + column, 9), rgb(['#839080', '#59665f', '#929681', '#707c70'][(row + column + 8) % 4]), 0.86);
      brushStroke(canvas, [{ x: cx - width * 0.43, y: cy - height * 0.30 }, { x: cx + width * 0.35, y: cy - height * 0.38 }], 14, rgb('#c4c49b'), 0.25, 1050 + row * 5 + column, 0.35);
      dryBrush(canvas, [{ x: cx - width * 0.23, y: cy + height * 0.37 }, { x: cx + width * 0.40, y: cy + height * 0.25 }], 11, rgb('#364940'), 0.20, 1075 + row * 6 + column, 3);
    }
  }
  sealTileEdges(canvas);
  return canvas;
}

function paintedIron() {
  const canvas = createCanvas();
  fillPaintedBase(canvas, rgb('#59646a'), 133, 12);
  const plates = [
    { x: 2, y: 2, w: 246, h: 248, c: '#626d70' }, { x: 262, y: 2, w: 248, h: 248, c: '#47565e' },
    { x: 2, y: 262, w: 246, h: 248, c: '#4e5b61' }, { x: 262, y: 262, w: 248, h: 248, c: '#657175' },
  ];
  plates.forEach((plate, index) => {
    polygon(canvas, [
      { x: plate.x + 8, y: plate.y + 8 }, { x: plate.x + plate.w - 8, y: plate.y + 4 },
      { x: plate.x + plate.w - 4, y: plate.y + plate.h - 9 }, { x: plate.x + 5, y: plate.y + plate.h - 4 },
    ], rgb(plate.c), 0.78);
    dryBrush(canvas, [{ x: plate.x + 26, y: plate.y + 55 }, { x: plate.x + plate.w - 40, y: plate.y + 78 }], 32, rgb('#98a19c'), 0.18, 1101 + index, 7);
    for (const [x, y] of [[23, 23], [plate.w - 23, 23], [23, plate.h - 23], [plate.w - 23, plate.h - 23]]) {
      softEllipse(canvas, plate.x + x, plate.y + y, 9, 9, 0, rgb('#293740'), 0.75);
      softEllipse(canvas, plate.x + x - 2, plate.y + y - 3, 4.3, 3, -0.4, rgb('#b7b39b'), 0.45);
    }
  });
  sealTileEdges(canvas);
  return canvas;
}

function paintedBark() {
  const canvas = createCanvas();
  fillPaintedBase(canvas, rgb('#674931'), 144, 16);
  const rng = random(1141);
  for (let i = 0; i < 11; i++) {
    const x = i * 53 + rng() * 24 - 18;
    const points = [{ x, y: -20 }, { x: x + (rng() - 0.5) * 30, y: 135 }, { x: x + (rng() - 0.5) * 36, y: 290 }, { x: x + (rng() - 0.5) * 43, y: 532 }];
    brushStroke(canvas, points, 31 + rng() * 18, rgb(i % 3 ? '#8c623b' : '#3f2c26'), 0.43, 1160 + i, 0.20);
    dryBrush(canvas, points, 18, rgb(i % 2 ? '#c29255' : '#2e2220'), 0.32, 1180 + i, 5);
  }
  sealTileEdges(canvas);
  return canvas;
}

function paintedWater() {
  const canvas = createCanvas();
  fillPaintedBase(canvas, rgb('#337b8d'), 155, 13);
  const streams = [
    { p: [[-30, 90], [132, 48], [292, 112], [540, 64]], c: '#4fa7ad' },
    { p: [[-20, 215], [148, 253], [300, 197], [530, 245]], c: '#236778' },
    { p: [[-35, 360], [132, 317], [296, 388], [545, 336]], c: '#54aeba' },
    { p: [[-30, 475], [131, 442], [307, 500], [548, 453]], c: '#246d7e' },
  ];
  streams.forEach((stream, index) => {
    const points = stream.p.map(([x, y]) => ({ x, y }));
    brushStroke(canvas, points, 58, rgb(stream.c), 0.31, 1201 + index, 0.18);
    dryBrush(canvas, points.map((point) => ({ x: point.x, y: point.y - 6 })), 23, rgb('#a8ddd0'), 0.25, 1221 + index, 5);
  });
  const rng = random(1241);
  for (let i = 0; i < 12; i++) {
    const x = rng() * SIZE; const y = rng() * SIZE;
    brushStroke(canvas, [{ x, y }, { x: x + 18 + rng() * 30, y: y + (rng() - 0.5) * 7 }], 4.2, rgb('#d7eed5'), 0.36, 1260 + i, 0.44);
  }
  sealTileEdges(canvas);
  return canvas;
}

function fringeCanvas() {
  const width = 1024; const height = 256;
  const canvas = createCanvas(width, height, [0, 0, 0, 0]);
  const rng = random(1401);

  // A soft, opaque root zone makes the fringe merge into the surrounding grass
  // while the top remains transparent and keeps the road edge readable.
  for (let y = 142; y < height; y++) {
    const t = (y - 142) / (height - 142);
    const base = [Math.round(mix(45, 53, t)), Math.round(mix(75, 94, t)), Math.round(mix(30, 35, t))];
    for (let x = 0; x < width; x++) {
      const noise = (tileNoise(x * SIZE / width, y, 9, 1411) - 0.5) * 12;
      paint(canvas, x, y, [base[0] + noise, base[1] + noise, base[2] + noise], clamp((t + 0.15) * 1.2));
    }
  }

  const blade = (x, bottom, length, lean, widthAtBase, shadow, mid, light, seed) => {
    const steps = Math.max(9, Math.floor(length / 8));
    for (let step = 0; step < steps; step++) {
      const t = step / (steps - 1);
      const y = bottom - length * t;
      const curve = lean * (t * 0.52 + t * t * 0.48);
      const previousT = Math.max(0, t - 0.03);
      const previousY = bottom - length * previousT;
      const previousX = x + lean * (previousT * 0.52 + previousT * previousT * 0.48);
      const angle = Math.atan2(y - previousY, (x + curve) - previousX);
      const bladeWidth = Math.max(1.0, widthAtBase * (1 - t * 0.92));
      softEllipse(canvas, x + curve, y, bladeWidth * 0.62, Math.max(2.5, length / steps * 0.85), angle, shadow, 0.65 * (1 - t * 0.35), true);
      if (step > 1) softEllipse(canvas, x + curve - bladeWidth * 0.13, y - 1, bladeWidth * 0.31, Math.max(1.6, length / steps * 0.56), angle, mid, 0.56 * (1 - t * 0.45), true);
      if (step > 4 && step % 2 === 0) softEllipse(canvas, x + curve - bladeWidth * 0.28, y - 3, Math.max(0.75, bladeWidth * 0.11), Math.max(1.4, length / steps * 0.36), angle, light, 0.33 * (1 - t), true);
    }
  };

  // Low-density clusters: broad painted leaves rather than a neon, individual-blade carpet.
  for (let cluster = -1; cluster < 21; cluster++) {
    const center = cluster * 53 + rng() * 17;
    const bottom = 230 + rng() * 23;
    const blades = 5 + Math.floor(rng() * 3);
    softEllipse(canvas, center, bottom + 1, 39 + rng() * 13, 15, 0, rgb('#365a26'), 0.64, true);
    for (let i = 0; i < blades; i++) {
      const spread = i - (blades - 1) / 2;
      const length = 57 + rng() * 74;
      const lean = spread * (7 + rng() * 5) + (rng() - 0.5) * 16;
      const baseWidth = 6 + rng() * 5;
      blade(center + spread * 4 + (rng() - 0.5) * 8, bottom + (rng() - 0.5) * 18, length, lean, baseWidth,
        rgb('#24451f'), rgb(i % 2 ? '#548333' : '#47752f'), rgb('#9fb65a'), 1460 + cluster * 11 + i);
    }
    if (cluster % 3 === 1) {
      brushStroke(canvas, [{ x: center - 24, y: bottom - 3 }, { x: center + 25, y: bottom - 8 }], 8, rgb('#7d8f43'), 0.22, 1520 + cluster, 0.4, true);
    }
  }

  // Horizontal wrapping is important because the fringe follows long swept geometry.
  for (let y = 0; y < height; y++) {
    const first = y * width * 4;
    const last = (y * width + width - 1) * 4;
    canvas.data.copy(canvas.data, last, first, first + 4);
  }
  return canvas;
}

function resample(source, width, height) {
  const output = createCanvas(width, height, [0, 0, 0, 0]);
  for (let y = 0; y < height; y++) {
    const sy = y * (source.height - 1) / Math.max(1, height - 1);
    const y0 = Math.floor(sy); const y1 = Math.min(source.height - 1, y0 + 1); const fy = sy - y0;
    for (let x = 0; x < width; x++) {
      const sx = x * (source.width - 1) / Math.max(1, width - 1);
      const x0 = Math.floor(sx); const x1 = Math.min(source.width - 1, x0 + 1); const fx = sx - x0;
      const out = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel++) {
        const a = source.data[(y0 * source.width + x0) * 4 + channel];
        const b = source.data[(y0 * source.width + x1) * 4 + channel];
        const c = source.data[(y1 * source.width + x0) * 4 + channel];
        const d = source.data[(y1 * source.width + x1) * 4 + channel];
        output.data[out + channel] = Math.round(mix(mix(a, b, fx), mix(c, d, fx), fy));
      }
    }
  }
  return output;
}

/**
 * Masters are intentionally versioned alongside the runtime files. They preserve
 * the broad, visibly raster-painted brushwork while this script owns the repeat
 * treatment and all delivery-size copies.
 */
function masterTile(name, fallback) {
  const path = join(root, 'public/art/texture-masters', `${name}.png`);
  if (!existsSync(path)) return fallback();
  const source = decodePng(path);
  return resample({ width: source.w, height: source.h, data: Buffer.from(source.data) }, SIZE, SIZE);
}

function sealFringeHorizontal(canvas) {
  const { width, height, data } = canvas;
  const blend = Math.min(24, Math.floor(width / 8));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < blend; x++) {
      const left = (y * width + x) * 4;
      const right = (y * width + (width - blend + x)) * 4;
      const t = x / Math.max(1, blend - 1);
      for (let c = 0; c < 4; c++) {
        const a = data[left + c];
        const b = data[right + c];
        data[left + c] = Math.round(mix(a, b, 0.5 * (1 - t)));
        data[right + c] = Math.round(mix(b, a, 0.5 * t));
      }
    }
    const first = y * width * 4;
    const last = (y * width + width - 1) * 4;
    data.copy(data, last, first, first + 4);
  }
}

function masterFringe() {
  const path = join(root, 'public/art/texture-masters/grass-fringe.png');
  if (!existsSync(path)) return fringeCanvas();
  const source = decodePng(path);
  const fringe = resample({ width: source.w, height: source.h, data: Buffer.from(source.data) }, 1024, 256);
  sealFringeHorizontal(fringe);
  return fringe;
}

const materials = {
  dirt: { make: paintedDirt, legacy: [1408, 1408] },
  grass: { make: paintedGrass, legacy: [1408, 1408] },
  cliff: { make: () => paintedCliff(false), legacy: [1728, 1152] },
  caverock: { make: () => paintedCliff(true), legacy: [1408, 1408] },
  lava: { make: paintedLava, legacy: [1408, 1408] },
  wood: { make: paintedWood, legacy: [1200, 1600] },
  cobble: { make: paintedCobble, legacy: [1408, 1408] },
  iron: { make: paintedIron, legacy: [1408, 1408] },
  bark: { make: paintedBark, legacy: [1200, 1600] },
  water: { make: paintedWater, legacy: [1200, 1600] },
};

function writePng(path, image) {
  mkdirSync(dirname(path), { recursive: true });
  encodePng(path, image.width, image.height, image.data);
}

function makeWebp(input, output) {
  // ImageMagick is already the project's optional art-pipeline dependency.
  execFileSync('convert', [input, '-quality', '84', output], { stdio: 'inherit' });
}

function verifyImage(path, { seamless = true, width, height }) {
  if (!existsSync(path)) throw new Error(`Missing generated asset: ${path}`);
  const image = decodePng(path);
  if (image.w !== width || image.h !== height) throw new Error(`${path}: expected ${width}×${height}, got ${image.w}×${image.h}`);
  if (!seamless) return { x: edgeDifference({ width: image.w, height: image.h, data: image.data }, true) };
  const x = edgeDifference({ width: image.w, height: image.h, data: image.data }, true);
  const y = edgeDifference({ width: image.w, height: image.h, data: image.data }, false);
  if (x !== 0 || y !== 0) throw new Error(`${path}: non-seamless edge difference x=${x}, y=${y}`);
  return { x, y };
}

function check() {
  const reports = [];
  for (const [name, config] of Object.entries(materials)) {
    reports.push([name, verifyImage(join(root, 'public/textures', `${name}.png`), { width: SIZE, height: SIZE })]);
    reports.push([`tex-${name}`, verifyImage(join(root, 'public/art/tracks', `tex-${name}.png`), { width: config.legacy[0], height: config.legacy[1] })]);
  }
  reports.push(['grass-fringe', verifyImage(join(root, 'public/textures/grass-fringe.png'), { seamless: false, width: 1024, height: 256 })]);
  reports.push(['decal grass-fringe', verifyImage(join(root, 'public/art/decals/grass-fringe.png'), { seamless: false, width: 1024, height: 256 })]);
  for (const [name, result] of reports) console.log(`✓ ${name}: ${result.y === undefined ? `horizontal edge Δ${result.x}` : `edge Δ${result.x}/${result.y}`}`);
}

function generate() {
  console.log('Painting simplified high-fantasy track materials…');
  for (const [name, config] of Object.entries(materials)) {
    const tile = masterTile(name, config.make);
    sealTileEdges(tile);
    const texturePath = join(root, 'public/textures', `${name}.png`);
    const legacyPath = join(root, 'public/art/tracks', `tex-${name}.png`);
    writePng(texturePath, tile);
    writePng(legacyPath, resample(tile, config.legacy[0], config.legacy[1]));
    makeWebp(texturePath, join(root, 'public/textures', `${name}.webp`));
    console.log(`  ✓ ${name}`);
  }
  const fringe = masterFringe();
  writePng(join(root, 'public/textures/grass-fringe.png'), fringe);
  writePng(join(root, 'public/art/decals/grass-fringe.png'), fringe);
  console.log('  ✓ grass fringe + builder decal');
  check();
}

try {
  if (isCheck) check();
  else generate();
} catch (error) {
  console.error(`Texture generation failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
