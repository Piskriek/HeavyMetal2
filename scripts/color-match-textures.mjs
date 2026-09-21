import { decodePng, encodePng } from './edge-magenta-lib.mjs';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

// RGB to linear sRGB
function toLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

// Linear sRGB to gamma sRGB
function toGamma(v) {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

// RGB to CIELAB
function rgb2lab(r, g, b) {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Observer. = 2°, Illuminant = D65
  let x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  let y = (lr * 0.2126 + lg * 0.7152 + lb * 0.0722) / 1.00000;
  let z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;

  x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;

  return [
    116 * y - 16,        // L (0..100)
    500 * (x - y),       // a (-128..127)
    200 * (y - z),       // b (-128..127)
  ];
}

// CIELAB to RGB
function lab2rgb(L, a, b) {
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  const x3 = x * x * x;
  const y3 = y * y * y;
  const z3 = z * z * z;

  x = (x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787) * 0.95047;
  y = (y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787) * 1.00000;
  z = (z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787) * 1.08883;

  const lr = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const lg = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const lb = x * 0.0557 + y * -0.2040 + z * 1.0570;

  return [toGamma(lr), toGamma(lg), toGamma(lb)];
}

// Compute mean and standard deviation of L, a, b
function labStats(w, h, data, alphaThreshold = 64) {
  let count = 0;
  let sumL = 0, sumA = 0, sumB = 0;
  const labs = [];

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > alphaThreshold) {
      count++;
      const [L, a, b] = rgb2lab(data[i], data[i + 1], data[i + 2]);
      labs.push(L, a, b);
      sumL += L;
      sumA += a;
      sumB += b;
    } else {
      labs.push(0, 0, 0);
    }
  }

  const meanL = sumL / count;
  const meanA = sumA / count;
  const meanB = sumB / count;

  let varL = 0, varA = 0, varB = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p += 3) {
    if (data[i + 3] > alphaThreshold) {
      const dL = labs[p] - meanL;
      const da = labs[p + 1] - meanA;
      const db = labs[p + 2] - meanB;
      varL += dL * dL;
      varA += da * da;
      varB += db * db;
    }
  }

  const stdL = Math.sqrt(varL / count) || 1;
  const stdA = Math.sqrt(varA / count) || 1;
  const stdB = Math.sqrt(varB / count) || 1;

  return { count, meanL, meanA, meanB, stdL, stdA, stdB, labs };
}

/**
 * Transfers color distribution from reference decal to target base texture.
 * strength: 1.0 = full transfer, 0.8 = slight blend with original
 */
function transferColor(sourceFile, referenceFile, strength = 0.92, luminanceWeight = 0.85) {
  console.log(`\nColor matching ${sourceFile} <- ${referenceFile}`);
  const src = decodePng(join(root, sourceFile));
  const ref = decodePng(join(root, referenceFile));

  const srcStats = labStats(src.w, src.h, src.data, 0);
  const refStats = labStats(ref.w, ref.h, ref.data, 64);

  console.log(`  Source LAB: L=${srcStats.meanL.toFixed(1)} a=${srcStats.meanA.toFixed(1)} b=${srcStats.meanB.toFixed(1)}`);
  console.log(`  Target LAB: L=${refStats.meanL.toFixed(1)} a=${refStats.meanA.toFixed(1)} b=${refStats.meanB.toFixed(1)}`);

  const out = Buffer.from(src.data);

  for (let i = 0, p = 0; i < out.length; i += 4, p += 3) {
    const origL = srcStats.labs[p];
    const origA = srcStats.labs[p + 1];
    const origB = srcStats.labs[p + 2];

    // Reinhard color transfer:
    // Scale normalized variance and shift mean
    const targetL = (origL - srcStats.meanL) * (refStats.stdL / srcStats.stdL) + refStats.meanL;
    const targetA = (origA - srcStats.meanA) * (refStats.stdA / srcStats.stdA) + refStats.meanA;
    const targetB = (origB - srcStats.meanB) * (refStats.stdB / srcStats.stdB) + refStats.meanB;

    // Apply strength blending
    const newL = origL + (targetL - origL) * strength * luminanceWeight;
    const newA = origA + (targetA - origA) * strength;
    const newB = origB + (targetB - origB) * strength;

    const [r, g, b] = lab2rgb(newL, newA, newB);
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }

  encodePng(join(root, sourceFile), src.w, src.h, out);
  console.log(`  ✓ Updated ${sourceFile}`);
}

async function main() {
  console.log('--- COLOR MATCHING BASE TEXTURES TO WARCRAFT DECALS ---');

  // 1. DIRT: Match dirt.png and tex-dirt.png to decal-wc-rocky-dirt.png
  transferColor('public/textures/dirt.png', 'public/art/decals/decal-wc-rocky-dirt.png', 0.95, 0.9);
  transferColor('public/art/tracks/tex-dirt.png', 'public/art/decals/decal-wc-rocky-dirt.png', 0.95, 0.9);

  // 2. GRASS: Match grass.png and tex-grass.png to decal-wc-grass-patch.png
  transferColor('public/textures/grass.png', 'public/art/decals/decal-wc-grass-patch.png', 0.95, 0.95);
  transferColor('public/art/tracks/tex-grass.png', 'public/art/decals/decal-wc-grass-patch.png', 0.95, 0.95);

  // 3. COBBLE: Match cobble.png and tex-cobble.png to decal-wc-flagstone.png
  transferColor('public/textures/cobble.png', 'public/art/decals/decal-wc-flagstone.png', 0.92, 0.85);
  transferColor('public/art/tracks/tex-cobble.png', 'public/art/decals/decal-wc-flagstone.png', 0.92, 0.85);

  // 4. CLIFF: Match cliff.png and tex-cliff.png to warm rock palette of decal-wc-gravel.png
  transferColor('public/textures/cliff.png', 'public/art/decals/decal-wc-gravel.png', 0.88, 0.85);
  transferColor('public/art/tracks/tex-cliff.png', 'public/art/decals/decal-wc-gravel.png', 0.88, 0.85);

  console.log('\nAll textures successfully color-matched!');
}

main().catch(err => {
  console.error('Error in color matching:', err);
  process.exit(1);
});
