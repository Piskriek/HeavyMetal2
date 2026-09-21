import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './edge-magenta-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

// Categories to balance
const TARGET_DIRS = [
  'public/textures',
  'public/art',
  'public/art/props/alpha',
  'public/art/decals',
  'public/art/track-parts',
  'public/art/goblins/alpha',
  'public/art/texture-masters',
];

// Special files that should retain their distinct high/low values
const SPECIAL_FILES = new Set([
  // Dark accents (asphalt skid marks, road cracks, oil puddles)
  'decal-tire-skid.png',
  'decal-cracks.png',
  'decal-pothole.png',
  'decal-oil-spill.png',
  // White water foam & spray
  'waterfall-curtain.png',
  'waterfall-splash.png',
  'waterfall-splash-b.png',
  // High-visibility road signs
  'decal-speed-arrow.png',
  'decal-hazard-stripes.png',
  // UI icons and course map cards (retain authoring)
  'menu-vista.png',
  'goblin-rally-concept.png',
  'boomtown-course.png',
  'ridge-course.png',
  'sheep-course.png',
  'grub-pilot.png',
  'grub-portrait.png',
  'nix-pilot.png',
  'nix-portrait.png',
  'rivet-pilot.png',
  'rivet-portrait.png',
  'sprocket-pilot.png',
  'sprocket-portrait.png',
]);

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hue2rgb(p, q, t) {
  let v = t;
  if (v < 0) v += 1;
  if (v > 1) v -= 1;
  if (v < 1 / 6) return p + (q - p) * 6 * v;
  if (v < 1 / 2) return q;
  if (v < 2 / 3) return p + (q - p) * (2 / 3 - v) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const val = Math.round(l * 255);
    return [val, val, val];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function processFile(filePath, filename) {
  const isSpecial = SPECIAL_FILES.has(filename);
  const png = decodePng(filePath);
  const len = png.data.length;

  let totalL = 0;
  let totalS = 0;
  let count = 0;

  // 1. Measure current non-transparent pixels
  for (let i = 0; i < len; i += 4) {
    const a = png.data[i + 3];
    if (a < 25) continue;
    const r = png.data[i] / 255;
    const g = png.data[i + 1] / 255;
    const b = png.data[i + 2] / 255;

    // Rec. 709 perceived luminance
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const [, s] = rgbToHsl(r, g, b);

    totalL += lum;
    totalS += s;
    count++;
  }

  if (count === 0) return null;

  const avgL = totalL / count;
  const avgS = totalS / count;

  // 2. Determine target luminance and saturation
  let targetL = avgL;
  let targetS = avgS;

  if (!isSpecial) {
    // Luminance normalization target: 0.28 - 0.42
    if (avgL < 0.28) {
      targetL = avgL + (0.32 - avgL) * 0.75;
    } else if (avgL > 0.43) {
      targetL = avgL - (avgL - 0.40) * 0.65;
    }

    // Saturation normalization target: 0.26 - 0.48
    if (avgS < 0.26) {
      targetS = avgS + (0.30 - avgS) * 0.8;
    } else if (avgS > 0.48) {
      targetS = avgS - (avgS - 0.44) * 0.7;
    }
  }

  const needsLumAdjust = Math.abs(targetL - avgL) > 0.015;
  const needsSatAdjust = Math.abs(targetS - avgS) > 0.02;

  if (!needsLumAdjust && !needsSatAdjust) {
    return { filename, changed: false, avgL, avgS, targetL, targetS };
  }

  // Gamma curve for smooth tone adjustment without highlight/shadow clipping
  const gamma = Math.max(0.65, Math.min(1.45, Math.log(targetL) / Math.log(Math.max(0.01, avgL))));
  const kS = Math.max(0.55, Math.min(3.0, targetS / Math.max(0.05, avgS)));
  const isNearMonochrome = avgS < 0.14;

  // 3. Apply color grading to non-transparent pixels
  for (let i = 0; i < len; i += 4) {
    const a = png.data[i + 3];
    if (a < 15) continue; // Keep edge bleed intact

    const r = png.data[i] / 255;
    const g = png.data[i + 1] / 255;
    const b = png.data[i + 2] / 255;

    let [h, s, l] = rgbToHsl(r, g, b);

    // Apply smooth gamma curve to lightness
    let newL = Math.pow(Math.max(0, Math.min(1, l)), gamma);

    // If near-monochrome stone/metal, inject subtle warm stone/slate undertone
    if (isNearMonochrome && s < 0.10) {
      s = Math.max(s, 0.07);
      if (s <= 0.05) {
        h = 0.09; // Warm earthy stone undertone (~32 degrees)
      }
    }

    // Apply saturation multiplier
    let newS = Math.max(0, Math.min(1, s * kS));

    const [newR, newG, newB] = hslToRgb(h, newS, newL);
    png.data[i] = newR;
    png.data[i + 1] = newG;
    png.data[i + 2] = newB;
    // png.data[i + 3] (alpha) is strictly preserved!
  }

  // 4. Save adjusted PNG
  encodePng(filePath, png.w, png.h, png.data);
  return { filename, changed: true, avgL, avgS, targetL, targetS, gamma, kS };
}

export function balanceAllAssets() {
  console.log('Starting Brightness & Saturation Balancing...');
  let totalProcessed = 0;
  let totalChanged = 0;

  for (const dirRel of TARGET_DIRS) {
    const dirAbs = join(root, dirRel);
    if (!existsSync(dirAbs)) continue;

    const files = readdirSync(dirAbs).filter((f) => f.endsWith('.png') && statSync(join(dirAbs, f)).isFile());
    console.log(`\nProcessing directory: ${dirRel} (${files.length} files)...`);

    for (const f of files) {
      const filePath = join(dirAbs, f);
      const res = processFile(filePath, f);
      if (res) {
        totalProcessed++;
        if (res.changed) {
          totalChanged++;
          console.log(
            `  ✓ ${f.padEnd(38)} Lum: ${res.avgL.toFixed(2)} -> ${res.targetL.toFixed(2)} | Sat: ${res.avgS.toFixed(2)} -> ${res.targetS.toFixed(2)}`
          );
        }
      }
    }
  }

  console.log(`\nFinished balancing. Processed: ${totalProcessed}, Balanced: ${totalChanged}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  balanceAllAssets();
}
