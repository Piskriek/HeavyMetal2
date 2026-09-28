import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './edge-magenta-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = join(root, 'public/art/decals');
mkdirSync(outDir, { recursive: true });

// Load exact seamless textures
const dirtImg = decodePng(join(root, 'public/textures/dirt.png'));
const grassImg = decodePng(join(root, 'public/textures/grass.png'));

const W = 512, H = 512;

// Simple deterministic hash / noise functions
function hash2D(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, octaves = 4) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2D(x * freq, y * freq);
    freq *= 2.05;
    amp *= 0.5;
  }
  return val;
}

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Sample seamless texture with wrapping
function sampleTex(tex, x, y) {
  const sx = ((Math.floor(x) % tex.w) + tex.w) % tex.w;
  const sy = ((Math.floor(y) % tex.h) + tex.h) % tex.h;
  const idx = (sy * tex.w + sx) * 4;
  return [tex.data[idx], tex.data[idx + 1], tex.data[idx + 2], tex.data[idx + 3]];
}

// Helper to create a new RGBA buffer
function createBuffer(w = W, h = H) {
  return new Uint8Array(w * h * 4);
}

// -----------------------------------------------------------------------------
// 1. DECAL: Grass-to-Dirt Seam Bandaid (decal-wc-grass-seam.png)
// Designed to be slapped across the road-to-grass border
// Left side = grass, Right side = dirt, organic wavy feathered boundary
// -----------------------------------------------------------------------------
function generateGrassSeamBandaid() {
  const data = createBuffer();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const u = x / W;
      const v = y / H;

      // Sample exact dirt and grass pixels
      const [dr, dg, db] = sampleTex(dirtImg, x, y);
      const [gr, gg, gb] = sampleTex(grassImg, x, y);

      // Organic wavy dividing seam along u = 0.5
      const seamWarp = (fbm(u * 5, v * 5) - 0.5) * 0.35 + (fbm(u * 12, v * 12) - 0.5) * 0.12;
      const seamDist = (u - 0.5) + seamWarp;

      // Grass-to-dirt blend factor
      const blend = smoothstep(-0.12, 0.12, seamDist);

      // Color is mixture of exact grass (left) and exact dirt (right)
      const r = Math.round(gr * (1 - blend) + dr * blend);
      const g = Math.round(gg * (1 - blend) + dg * blend);
      const b = Math.round(gb * (1 - blend) + db * blend);

      // Outer alpha mask: soft rounded rectangle with organic noise edge
      const edgeDistX = Math.min(u, 1 - u) * 2;
      const edgeDistY = Math.min(v, 1 - v) * 2;
      const edgeDist = Math.min(edgeDistX, edgeDistY);
      const edgeNoise = (fbm(u * 8, v * 8) - 0.5) * 0.25;
      const alpha = smoothstep(0.08, 0.45, edgeDist + edgeNoise);

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  return data;
}

// -----------------------------------------------------------------------------
// 2. DECAL: Lush Grass Patch Bandaid (decal-wc-grass-patch.png)
// Exact grass texture in an organic island with feathered tufts
// -----------------------------------------------------------------------------
function generateGrassPatchBandaid() {
  const data = createBuffer();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const u = (x - W / 2) / (W / 2);
      const v = (y - H / 2) / (H / 2);

      const [gr, gg, gb] = sampleTex(grassImg, x, y);

      // Radial distance with organic lobed noise
      const dist = Math.hypot(u, v);
      const angle = Math.atan2(v, u);
      const lobes = Math.sin(angle * 5) * 0.08 + Math.cos(angle * 3) * 0.12;
      const noise = (fbm(u * 3 + 2, v * 3 + 2) - 0.5) * 0.3;
      const radius = 0.72 + lobes + noise;

      const alpha = smoothstep(radius, radius - 0.28, dist);

      data[idx] = gr;
      data[idx + 1] = gg;
      data[idx + 2] = gb;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  return data;
}

// -----------------------------------------------------------------------------
// 3. DECAL: Rocky Dirt Patch Bandaid (decal-wc-rocky-dirt.png)
// Exact dirt texture with subtle embedded pebbles and grass fringe
// -----------------------------------------------------------------------------
function generateRockyDirtBandaid() {
  const data = createBuffer();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const u = (x - W / 2) / (W / 2);
      const v = (y - H / 2) / (H / 2);

      const [dr, dg, db] = sampleTex(dirtImg, x, y);
      const [gr, gg, gb] = sampleTex(grassImg, x, y);

      const dist = Math.hypot(u * 1.1, v * 0.9);
      const angle = Math.atan2(v, u);
      const lobes = Math.cos(angle * 4) * 0.09 + Math.sin(angle * 6) * 0.06;
      const noise = (fbm(u * 4 + 5, v * 4 + 5) - 0.5) * 0.28;
      const radius = 0.75 + lobes + noise;

      // Outer grass rim
      const grassRim = smoothstep(radius - 0.35, radius - 0.05, dist);
      const r = Math.round(dr * (1 - grassRim * 0.6) + gr * (grassRim * 0.6));
      const g = Math.round(dg * (1 - grassRim * 0.6) + gg * (grassRim * 0.6));
      const b = Math.round(db * (1 - grassRim * 0.6) + gb * (grassRim * 0.6));

      const alpha = smoothstep(radius, radius - 0.3, dist);

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  return data;
}

// -----------------------------------------------------------------------------
// 4. DECAL: Mud Puddle Bandaid (decal-wc-mud-puddle.png)
// Deepened moist center of exact dirt texture with feathered edges
// -----------------------------------------------------------------------------
function generateMudPuddleBandaid() {
  const data = createBuffer();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const u = (x - W / 2) / (W / 2);
      const v = (y - H / 2) / (H / 2);

      const [dr, dg, db] = sampleTex(dirtImg, x, y);

      const dist = Math.hypot(u * 1.25, v * 0.85);
      const noise = (fbm(u * 3 + 8, v * 3 + 8) - 0.5) * 0.32;
      const radius = 0.70 + noise;

      // Darken center to simulate wet mud
      const centerDepth = smoothstep(radius * 0.8, 0, dist);
      const wetMod = 1.0 - centerDepth * 0.38;

      // Subtle specular water sheen in deep center
      const sheen = Math.pow(smoothstep(0.35, 0.05, dist), 3) * 35;

      const r = clamp(Math.round(dr * wetMod + sheen), 0, 255);
      const g = clamp(Math.round(dg * wetMod + sheen * 0.9), 0, 255);
      const b = clamp(Math.round(db * wetMod + sheen * 0.7), 0, 255);

      const alpha = smoothstep(radius, radius - 0.28, dist);

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  return data;
}

// -----------------------------------------------------------------------------
// 5. DECAL: Wagon Cart Dirt Ruts (decal-wc-cart-ruts.png)
// Dual tire/wheel grooves in dirt with center grass tufts
// -----------------------------------------------------------------------------
function generateCartRutsBandaid() {
  const data = createBuffer();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const u = x / W;
      const v = y / H;

      const [dr, dg, db] = sampleTex(dirtImg, x, y);
      const [gr, gg, gb] = sampleTex(grassImg, x, y);

      // Two rut channels at u ~ 0.30 and u ~ 0.70 with slight wander
      const wander = (fbm(v * 3, 0) - 0.5) * 0.08;
      const rut1Dist = Math.abs(u - (0.30 + wander));
      const rut2Dist = Math.abs(u - (0.70 + wander));
      const inRut = Math.min(rut1Dist, rut2Dist);

      const rutDepth = smoothstep(0.12, 0.02, inRut);

      // Central grass ridge between ruts
      const centerDist = Math.abs(u - (0.50 + wander));
      const grassPatch = smoothstep(0.12, 0.02, centerDist) * fbm(u * 8, v * 8);

      let r = dr * (1 - rutDepth * 0.28);
      let g = dg * (1 - rutDepth * 0.28);
      let b = db * (1 - rutDepth * 0.28);

      // Blend central grass
      r = r * (1 - grassPatch * 0.6) + gr * (grassPatch * 0.6);
      g = g * (1 - grassPatch * 0.6) + gg * (grassPatch * 0.6);
      b = b * (1 - grassPatch * 0.6) + gb * (grassPatch * 0.6);

      // Lengthwise strip alpha
      const alphaX = smoothstep(0.05, 0.22, Math.min(u, 1 - u));
      const alphaY = smoothstep(0.02, 0.15, Math.min(v, 1 - v));
      const alpha = alphaX * alphaY;

      data[idx] = clamp(Math.round(r), 0, 255);
      data[idx + 1] = clamp(Math.round(g), 0, 255);
      data[idx + 2] = clamp(Math.round(b), 0, 255);
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  return data;
}

// -----------------------------------------------------------------------------
// 6. DECAL: Gravel & River Stones (decal-wc-gravel.png)
// Scattered pebble stones embedded in dirt base
// -----------------------------------------------------------------------------
function generateGravelBandaid() {
  const data = createBuffer();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const u = (x - W / 2) / (W / 2);
      const v = (y - H / 2) / (H / 2);

      const [dr, dg, db] = sampleTex(dirtImg, x, y);

      // High frequency cellular pebble bumps
      const pebbleNoise = fbm(x * 0.12, y * 0.12, 3);
      const pebbleMask = Math.pow(smoothstep(0.48, 0.75, pebbleNoise), 2);
      const pebbleColor = dr * 1.25 + 20;

      const r = dr * (1 - pebbleMask) + pebbleColor * pebbleMask;
      const g = dg * (1 - pebbleMask) + (pebbleColor * 0.95) * pebbleMask;
      const b = db * (1 - pebbleMask) + (pebbleColor * 0.85) * pebbleMask;

      const dist = Math.hypot(u, v);
      const noise = (fbm(u * 3 + 12, v * 3 + 12) - 0.5) * 0.3;
      const radius = 0.72 + noise;
      const alpha = smoothstep(radius, radius - 0.3, dist);

      data[idx] = clamp(Math.round(r), 0, 255);
      data[idx + 1] = clamp(Math.round(g), 0, 255);
      data[idx + 2] = clamp(Math.round(b), 0, 255);
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  return data;
}

// -----------------------------------------------------------------------------
// 7. DECAL: Mossy Flagstone Pavers (decal-wc-flagstone.png)
// Rounded flagstones on dirt with grass moss in the joints
// -----------------------------------------------------------------------------
function generateFlagstoneBandaid() {
  const data = createBuffer();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const u = (x - W / 2) / (W / 2);
      const v = (y - H / 2) / (H / 2);

      const [dr, dg, db] = sampleTex(dirtImg, x, y);
      const [gr, gg, gb] = sampleTex(grassImg, x, y);

      // Grid of rounded stones
      const stoneGridX = (x % 96) - 48;
      const stoneGridY = (y % 80) - 40;
      const stoneDist = Math.hypot(stoneGridX / 42, stoneGridY / 34);

      // Crack lines between stones
      const isCrack = smoothstep(0.75, 1.05, stoneDist);

      // Stone surface tone (cooler grey-sandstone)
      const stoneR = dr * 0.92 + 15;
      const stoneG = dg * 0.95 + 15;
      const stoneB = db * 0.98 + 20;

      // Crevices filled with grass moss
      const r = stoneR * (1 - isCrack) + (gr * 0.6 + dr * 0.4) * isCrack;
      const g = stoneG * (1 - isCrack) + (gg * 0.6 + dg * 0.4) * isCrack;
      const b = stoneB * (1 - isCrack) + (gb * 0.6 + db * 0.4) * isCrack;

      const dist = Math.hypot(u, v);
      const noise = (fbm(u * 3 + 15, v * 3 + 15) - 0.5) * 0.3;
      const radius = 0.74 + noise;
      const alpha = smoothstep(radius, radius - 0.28, dist);

      data[idx] = clamp(Math.round(r), 0, 255);
      data[idx + 1] = clamp(Math.round(g), 0, 255);
      data[idx + 2] = clamp(Math.round(b), 0, 255);
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  return data;
}

// -----------------------------------------------------------------------------
// 8. DECAL: Placeable Grass Fringe Decal Strip (grass-fringe.png)
// Horizontal strip cutout of exact grass texture with tufted border
// -----------------------------------------------------------------------------
function generateGrassFringeDecalStrip() {
  const w = 512, h = 256;
  const data = createBuffer(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const v = y / h; // 0 = top, 1 = bottom
      const u = x / w;

      const [gr, gg, gb] = sampleTex(grassImg, x, y);

      // Grass tufts pointing upward from bottom
      const tuftNoise = fbm(x * 0.08, 0) * 0.25 + fbm(x * 0.25, 0) * 0.12;
      const fringeTop = 0.28 + tuftNoise;

      // Soft alpha: full at bottom (v > 0.8), tufted at top
      const alphaY = smoothstep(fringeTop - 0.15, fringeTop + 0.15, v);
      // Soft ends on left/right
      const alphaX = smoothstep(0.02, 0.12, Math.min(u, 1 - u));
      const alpha = alphaY * alphaX;

      data[idx] = gr;
      data[idx + 1] = gg;
      data[idx + 2] = gb;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  return { w, h, data };
}

// -----------------------------------------------------------------------------
// Main execution
// -----------------------------------------------------------------------------
function main() {
  console.log('Generating exact-texture bandaid decals...');

  const seamData = generateGrassSeamBandaid();
  encodePng(join(outDir, 'decal-wc-grass-seam.png'), W, H, Buffer.from(seamData));
  console.log('✓ decal-wc-grass-seam.png');

  const patchData = generateGrassPatchBandaid();
  encodePng(join(outDir, 'decal-wc-grass-patch.png'), W, H, Buffer.from(patchData));
  console.log('✓ decal-wc-grass-patch.png');

  const rockyData = generateRockyDirtBandaid();
  encodePng(join(outDir, 'decal-wc-rocky-dirt.png'), W, H, Buffer.from(rockyData));
  console.log('✓ decal-wc-rocky-dirt.png');

  const mudData = generateMudPuddleBandaid();
  encodePng(join(outDir, 'decal-wc-mud-puddle.png'), W, H, Buffer.from(mudData));
  console.log('✓ decal-wc-mud-puddle.png');

  const rutsData = generateCartRutsBandaid();
  encodePng(join(outDir, 'decal-wc-cart-ruts.png'), W, H, Buffer.from(rutsData));
  console.log('✓ decal-wc-cart-ruts.png');

  const gravelData = generateGravelBandaid();
  encodePng(join(outDir, 'decal-wc-gravel.png'), W, H, Buffer.from(gravelData));
  console.log('✓ decal-wc-gravel.png');

  const flagstoneData = generateFlagstoneBandaid();
  encodePng(join(outDir, 'decal-wc-flagstone.png'), W, H, Buffer.from(flagstoneData));
  console.log('✓ decal-wc-flagstone.png');

  const fringe = generateGrassFringeDecalStrip();
  encodePng(join(outDir, 'grass-fringe.png'), fringe.w, fringe.h, Buffer.from(fringe.data));
  encodePng(join(root, 'public/textures/grass-fringe.png'), fringe.w, fringe.h, Buffer.from(fringe.data));
  encodePng(join(root, 'public/art/texture-masters/grass-fringe.png'), fringe.w, fringe.h, Buffer.from(fringe.data));
  console.log('✓ grass-fringe.png (decals, textures, texture-masters)');

  console.log('All exact-texture bandaid decals generated successfully!');
}

main();
