import * as THREE from 'three';

export const MATERIALS: readonly ['rock', 'scree', 'gravel', 'dust', 'cracked', 'redsoil'] = [
  'rock',
  'scree',
  'gravel',
  'dust',
  'cracked',
  'redsoil',
];

export const COVER_LAYERS: readonly ['moss', 'grass'] = ['moss', 'grass'];

export interface GroundTextures {
  /** Six layers in MATERIALS order: rgb = albedo (sRGB), a = height 0..1. */
  albedoHeight: THREE.DataArrayTexture;
  /** Six layers: rgb = tangent-space normal (0.5, 0.5, 1 is flat), a = roughness 0..1. */
  normalRough: THREE.DataArrayTexture;
  /** How many metres of ground one tile covers, per material. */
  metres: readonly number[];
  size: number;
}

export interface CoverTextures {
  /** Two layers in COVER_LAYERS order (0 = moss, 1 = grass): rgb = albedo (sRGB), a = height 0..1. */
  albedoHeight: THREE.DataArrayTexture;
  /** Two layers (0 = moss, 1 = grass): rgb = tangent-space normal (0.5, 0.5, 1 is flat), a = roughness 0..1. */
  normalRough: THREE.DataArrayTexture;
  /** How many metres of ground one tile covers, per layer (moss, grass). */
  metres: readonly [number, number];
  size: number;
}

export interface GroundStage {
  texelsPerMetre: number;
  nearest: boolean;
  normalStrength: number;
  levels: number;
  specular: number;
  triplanar: boolean;
}

const MATERIAL_METRES: readonly number[] = [16, 12, 9, 18, 15, 12];
const COVER_METRES: readonly [number, number] = [6, 4.5];
const TAU = Math.PI * 2;

type RGB = readonly [number, number, number];

interface WorleySites {
  cells: number;
  x: Float32Array;
  y: Float32Array;
  style: Float32Array;
}

interface MaterialPixel {
  red: number;
  green: number;
  blue: number;
  height: number;
  roughness: number;
}

const BASE_COLOURS: readonly RGB[] = [
  [0.255, 0.245, 0.225],
  [0.275, 0.263, 0.235],
  [0.335, 0.321, 0.286],
  [0.565, 0.525, 0.438],
  [0.405, 0.348, 0.266],
  [0.355, 0.132, 0.052],
];

const COVER_BASE_COLOURS: readonly [RGB, RGB] = [
  [0.052, 0.148, 0.036], // 0: moss (deep velvety bryophyte green)
  [0.082, 0.275, 0.052], // 1: grass (lush sunlit meadow chlorophyll green)
];

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function wrapCell(value: number, period: number): number {
  const wrapped = value % period;
  return wrapped < 0 ? wrapped + period : wrapped;
}

function hash2(x: number, y: number, seed: number): number {
  let hash = (seed ^ Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495)) | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967295;
}

function latticeNoise(u: number, v: number, frequency: number, seed: number): number {
  const x = u * frequency;
  const y = v * frequency;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const x0 = wrapCell(ix, frequency);
  const x1 = wrapCell(ix + 1, frequency);
  const y0 = wrapCell(iy, frequency);
  const y1 = wrapCell(iy + 1, frequency);
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  const value = mix(mix(a, b, sx), mix(c, d, sx), sy);
  return value * 2 - 1;
}

function makeWorleySites(cells: number, seed: number): WorleySites {
  const length = cells * cells;
  const x = new Float32Array(length);
  const y = new Float32Array(length);
  const style = new Float32Array(length);

  for (let row = 0; row < cells; row++) {
    for (let column = 0; column < cells; column++) {
      const index = row * cells + column;
      x[index] = 0.18 + hash2(column, row, seed) * 0.64;
      y[index] = 0.18 + hash2(column, row, seed + 11) * 0.64;
      style[index] = hash2(column, row, seed + 23);
    }
  }

  return { cells, x, y, style };
}

function worley(u: number, v: number, sites: WorleySites): [number, number, number] {
  const x = u * sites.cells;
  const y = v * sites.cells;
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fractionX = x - cellX;
  const fractionY = y - cellY;
  let nearestSquared = 100;
  let secondSquared = 100;
  let nearestStyle = 0.5;

  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    const row = wrapCell(cellY + offsetY, sites.cells);
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      const column = wrapCell(cellX + offsetX, sites.cells);
      const index = row * sites.cells + column;
      const deltaX = offsetX + sites.x[index]! - fractionX;
      const deltaY = offsetY + sites.y[index]! - fractionY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;

      if (distanceSquared < nearestSquared) {
        secondSquared = nearestSquared;
        nearestSquared = distanceSquared;
        nearestStyle = sites.style[index]!;
      } else if (distanceSquared < secondSquared) {
        secondSquared = distanceSquared;
      }
    }
  }

  return [Math.sqrt(nearestSquared), Math.sqrt(secondSquared), nearestStyle];
}

function linearToSrgb(value: number): number {
  const v = clamp(value, 0, 1);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function toByte(value: number): number {
  return Math.round(clamp(value, 0, 1) * 255);
}

function materialPixel(
  material: number,
  macro: number,
  mid: number,
  fine: number,
  warpedU: number,
  warpedV: number,
  sites: WorleySites | undefined,
): MaterialPixel {
  const base = BASE_COLOURS[material]!;
  const variation = 1 + macro * 0.105 + mid * 0.064 + fine * 0.032;
  let red = base[0] * variation;
  let green = base[1] * variation;
  let blue = base[2] * variation;
  let height = 0.5 + macro * 0.035 + mid * 0.025 + fine * 0.012;
  let roughness = 0.88;

  switch (material) {
    case 0: {
      const [nearest, second] = worley(warpedU, warpedV, sites!);
      const fracture = 1 - smoothstep(0.025, 0.145, second - nearest);
      const strata = Math.sin(TAU * (warpedV * 7 + warpedU * 2 + mid * 0.035));
      const rockTone = 1 + strata * 0.075 - fracture * 0.31 + fine * 0.025;
      red *= rockTone;
      green *= rockTone;
      blue *= rockTone;
      height = 0.47 + mid * 0.055 + strata * 0.065 + (1 - fracture) * 0.09 + macro * 0.025;
      roughness = 0.92 - (1 - fracture) * (0.14 + macro * 0.04) + fine * 0.035;
      break;
    }
    case 1: {
      const [nearest, , style] = worley(warpedU, warpedV, sites!);
      const radius = 0.31 + style * 0.105;
      const stone = 1 - smoothstep(radius - 0.035, radius + 0.035, nearest);
      const soilTone = 0.91 + macro * 0.075 + mid * 0.035;
      const stoneTone = 0.73 + style * 0.38 + mid * 0.045;
      const tone = mix(soilTone, stoneTone, stone);
      red *= tone;
      green *= tone;
      blue *= tone;
      height = 0.22 + stone * (0.48 + style * 0.12) + mid * 0.045 + macro * 0.025;
      roughness = 0.95 - stone * 0.11 + fine * 0.025;
      break;
    }
    case 2: {
      const [nearest, , style] = worley(warpedU, warpedV, sites!);
      const radius = 0.29 + style * 0.095;
      const pebble = 1 - smoothstep(radius - 0.035, radius + 0.035, nearest);
      const soilTone = 0.95 + macro * 0.06 + mid * 0.035;
      const stoneTone = 0.64 + style * 0.35 + fine * 0.04;
      const tone = mix(soilTone, stoneTone, pebble);
      red *= tone;
      green *= tone;
      blue *= tone;
      height = 0.36 + pebble * (0.16 + style * 0.08) + mid * 0.035;
      roughness = 0.9 - pebble * 0.08 + fine * 0.025;
      break;
    }
    case 3: {
      const ripple = Math.sin(TAU * (warpedV * 10 + Math.sin(TAU * warpedU * 3) * 0.026 + macro * 0.035));
      const dustTone = 1 + ripple * 0.055 + macro * 0.045 + mid * 0.025;
      red *= dustTone;
      green *= dustTone;
      blue *= dustTone;
      height = 0.51 + ripple * 0.052 + macro * 0.025 + mid * 0.015;
      roughness = 0.9 + fine * 0.035;
      break;
    }
    case 4: {
      const [nearest, second] = worley(warpedU, warpedV, sites!);
      const plate = smoothstep(0.025, 0.15, second - nearest);
      const plateTone = 0.98 + macro * 0.075 + mid * 0.045 + fine * 0.025;
      const crackTone = 0.34 + fine * 0.055;
      const tone = mix(crackTone, plateTone, plate);
      red *= tone;
      green *= tone;
      blue *= tone;
      height = 0.24 + plate * (0.24 + mid * 0.035) + macro * 0.025;
      roughness = 0.94 + fine * 0.035;
      break;
    }
    default: {
      const [nearest, , style] = worley(warpedU, warpedV, sites!);
      const radius = 0.25 + style * 0.105;
      const stone = 1 - smoothstep(radius - 0.035, radius + 0.035, nearest);
      const soilTone = 0.95 + macro * 0.085 + mid * 0.04;
      const stoneTone = 0.36 + style * 0.19;
      red = mix(base[0] * soilTone, 0.12 * stoneTone, stone);
      green = mix(base[1] * soilTone, 0.105 * stoneTone, stone);
      blue = mix(base[2] * soilTone, 0.09 * stoneTone, stone);
      height = 0.32 + stone * (0.18 + style * 0.07) + mid * 0.035;
      roughness = 0.91 - stone * 0.06 + fine * 0.03;
      break;
    }
  }

  return {
    red,
    green,
    blue,
    height: clamp(height, 0.04, 0.98),
    roughness: clamp(roughness, 0.52, 1),
  };
}

function coverPixel(
  layer: number,
  macro: number,
  mid: number,
  fine: number,
  warpedU: number,
  warpedV: number,
  sites: WorleySites,
): MaterialPixel {
  const base = COVER_BASE_COLOURS[layer] ?? COVER_BASE_COLOURS[0];
  const [nearest, second, style] = worley(warpedU, warpedV, sites);

  if (layer === 0) {
    // Layer 0: Moss — velvety cushion hummocks with warm olive spore tips
    const cushion = 1 - smoothstep(0.04, 0.42, nearest);
    const crevice = smoothstep(0.02, 0.14, second - nearest);
    const sporeTip = smoothstep(0.55, 0.95, cushion * (0.65 + 0.35 * style) + fine * 0.15);
    const tone = (0.72 + 0.38 * cushion + 0.14 * macro + 0.08 * mid) * (0.68 + 0.32 * crevice);
    const red = base[0] * tone + sporeTip * 0.045;
    const green = base[1] * tone + sporeTip * 0.065;
    const blue = base[2] * tone + sporeTip * 0.012;
    const height = 0.38 + cushion * 0.38 * crevice + mid * 0.06 + fine * 0.04;
    const roughness = 0.88 - cushion * 0.08 + fine * 0.03;
    return {
      red: clamp(red, 0.01, 0.95),
      green: clamp(green, 0.02, 0.95),
      blue: clamp(blue, 0.01, 0.95),
      height: clamp(height, 0.08, 0.96),
      roughness: clamp(roughness, 0.65, 0.96),
    };
  }

  // Layer 1: Grass — directional blade clusters, clover patches, and sunlit tips
  const clump = 1 - smoothstep(0.05, 0.45, nearest);
  const bladeWave = Math.sin(TAU * (warpedU * 14 + warpedV * 6 + mid * 0.22)) * 0.5 + 0.5;
  const bladeTip = smoothstep(0.35, 0.92, bladeWave * (0.6 + 0.4 * clump) + fine * 0.2);
  const sunTint = 0.5 + 0.5 * macro;
  const tone = 0.78 + 0.32 * clump + 0.15 * mid + 0.08 * fine;
  const red = base[0] * tone + bladeTip * (0.05 + 0.035 * sunTint);
  const green = base[1] * tone + bladeTip * (0.11 + 0.05 * sunTint);
  const blue = base[2] * tone + bladeTip * 0.025;
  const height = 0.42 + clump * 0.32 + bladeTip * 0.18 + mid * 0.05;
  const roughness = 0.74 - bladeTip * 0.12 + fine * 0.04;
  return {
    red: clamp(red, 0.01, 0.95),
    green: clamp(green, 0.03, 0.95),
    blue: clamp(blue, 0.01, 0.95),
    height: clamp(height, 0.1, 0.98),
    roughness: clamp(roughness, 0.54, 0.92),
  };
}

function configureArrayTexture(texture: THREE.DataArrayTexture, colorSpace: THREE.ColorSpace): void {
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.flipY = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
}

/** Builds six deterministic, periodic material tiles from seeded value and Worley noise. */
export function makeGroundTextures(o: { size: number; seed: number }): GroundTextures {
  const size = o.size;
  if (size !== 64 && size !== 128 && size !== 256 && size !== 512) {
    throw new RangeError('Ground texture size must be 64, 128, 256 or 512.');
  }

  const seed = Number.isFinite(o.seed) ? o.seed | 0 : 0;
  const pixelsPerLayer = size * size;
  const bytesPerLayer = pixelsPerLayer * 4;
  const albedoPixels = new Uint8Array(bytesPerLayer * MATERIALS.length);
  const normalPixels = new Uint8Array(bytesPerLayer * MATERIALS.length);
  const heightLayers = new Array<Float32Array>(MATERIALS.length);
  const worleyByMaterial: readonly (WorleySites | undefined)[] = [
    makeWorleySites(8, seed + 101),
    makeWorleySites(15, seed + 211),
    makeWorleySites(28, seed + 307),
    undefined,
    makeWorleySites(14, seed + 401),
    makeWorleySites(20, seed + 503),
  ];

  for (let material = 0; material < MATERIALS.length; material++) {
    const heights = new Float32Array(pixelsPerLayer);
    heightLayers[material] = heights;
    const sites = worleyByMaterial[material];
    const baseOffset = material * bytesPerLayer;
    const materialSeed = seed + material * 997;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const warpU = latticeNoise(u, v, 4, materialSeed + 17) * 0.055;
        const warpV = latticeNoise(u, v, 4, materialSeed + 37) * 0.055;
        const warpedU = u + warpU;
        const warpedV = v + warpV;
        const macro = latticeNoise(warpedU, warpedV, 3, materialSeed + 53);
        const mid = latticeNoise(warpedU, warpedV, 11, materialSeed + 79);
        const fine = latticeNoise(warpedU, warpedV, 29, materialSeed + 103);
        const pixel = materialPixel(material, macro, mid, fine, warpedU, warpedV, sites);
        const pixelIndex = y * size + x;
        const offset = baseOffset + pixelIndex * 4;

        albedoPixels[offset] = toByte(linearToSrgb(pixel.red));
        albedoPixels[offset + 1] = toByte(linearToSrgb(pixel.green));
        albedoPixels[offset + 2] = toByte(linearToSrgb(pixel.blue));
        albedoPixels[offset + 3] = toByte(pixel.height);
        normalPixels[offset + 3] = toByte(pixel.roughness);
        heights[pixelIndex] = pixel.height;
      }
    }
  }

  for (let material = 0; material < MATERIALS.length; material++) {
    const heights = heightLayers[material]!;
    const metres = MATERIAL_METRES[material]!;
    const baseOffset = material * bytesPerLayer;
    const slopeScale = (size / metres) * 1.15;

    for (let y = 0; y < size; y++) {
      const previousY = y === 0 ? size - 1 : y - 1;
      const nextY = y === size - 1 ? 0 : y + 1;
      for (let x = 0; x < size; x++) {
        const previousX = x === 0 ? size - 1 : x - 1;
        const nextX = x === size - 1 ? 0 : x + 1;
        const index = y * size + x;
        const dx = (heights[y * size + nextX]! - heights[y * size + previousX]!) * 0.5;
        const dy = (heights[nextY * size + x]! - heights[previousY * size + x]!) * 0.5;
        const normalX = -dx * slopeScale;
        const normalY = -dy * slopeScale;
        const inverseLength = 1 / Math.sqrt(normalX * normalX + normalY * normalY + 1);
        const offset = baseOffset + index * 4;

        normalPixels[offset] = toByte(normalX * inverseLength * 0.5 + 0.5);
        normalPixels[offset + 1] = toByte(normalY * inverseLength * 0.5 + 0.5);
        normalPixels[offset + 2] = toByte(inverseLength * 0.5 + 0.5);
      }
    }
  }

  const albedoHeight = new THREE.DataArrayTexture(albedoPixels, size, size, MATERIALS.length);
  const normalRough = new THREE.DataArrayTexture(normalPixels, size, size, MATERIALS.length);
  albedoHeight.name = 'Ground albedo and height';
  normalRough.name = 'Ground tangent normal and roughness';
  configureArrayTexture(albedoHeight, THREE.SRGBColorSpace);
  configureArrayTexture(normalRough, THREE.NoColorSpace);

  return { albedoHeight, normalRough, metres: MATERIAL_METRES, size };
}

/**
 * Builds two deterministic, periodic procedural cover tiles (layer 0 = moss, layer 1 = grass)
 * matching makeGroundTextures's albedo+height and normal+roughness format (TICKET-02 Item B).
 */
export function makeCoverTextures(o: { size: number; seed: number }): CoverTextures {
  const size = o.size;
  if (size !== 64 && size !== 128 && size !== 256 && size !== 512) {
    throw new RangeError('Cover texture size must be 64, 128, 256 or 512.');
  }

  const seed = Number.isFinite(o.seed) ? o.seed | 0 : 0;
  const pixelsPerLayer = size * size;
  const bytesPerLayer = pixelsPerLayer * 4;
  const albedoPixels = new Uint8Array(bytesPerLayer * COVER_LAYERS.length);
  const normalPixels = new Uint8Array(bytesPerLayer * COVER_LAYERS.length);
  const heightLayers = new Array<Float32Array>(COVER_LAYERS.length);
  const worleyByLayer: readonly [WorleySites, WorleySites] = [
    makeWorleySites(16, seed + 601),
    makeWorleySites(24, seed + 709),
  ];

  for (let layer = 0; layer < COVER_LAYERS.length; layer++) {
    const heights = new Float32Array(pixelsPerLayer);
    heightLayers[layer] = heights;
    const sites = worleyByLayer[layer]!;
    const baseOffset = layer * bytesPerLayer;
    const layerSeed = seed + 3001 + layer * 1237;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const warpU = latticeNoise(u, v, 5, layerSeed + 19) * 0.06;
        const warpV = latticeNoise(u, v, 5, layerSeed + 41) * 0.06;
        const warpedU = u + warpU;
        const warpedV = v + warpV;
        const macro = latticeNoise(warpedU, warpedV, 3, layerSeed + 61);
        const mid = latticeNoise(warpedU, warpedV, 12, layerSeed + 89);
        const fine = latticeNoise(warpedU, warpedV, 31, layerSeed + 113);
        const pixel = coverPixel(layer, macro, mid, fine, warpedU, warpedV, sites);
        const pixelIndex = y * size + x;
        const offset = baseOffset + pixelIndex * 4;

        albedoPixels[offset] = toByte(linearToSrgb(pixel.red));
        albedoPixels[offset + 1] = toByte(linearToSrgb(pixel.green));
        albedoPixels[offset + 2] = toByte(linearToSrgb(pixel.blue));
        albedoPixels[offset + 3] = toByte(pixel.height);
        normalPixels[offset + 3] = toByte(pixel.roughness);
        heights[pixelIndex] = pixel.height;
      }
    }
  }

  for (let layer = 0; layer < COVER_LAYERS.length; layer++) {
    const heights = heightLayers[layer]!;
    const metres = COVER_METRES[layer]!;
    const baseOffset = layer * bytesPerLayer;
    const slopeScale = (size / metres) * 1.25;

    for (let y = 0; y < size; y++) {
      const previousY = y === 0 ? size - 1 : y - 1;
      const nextY = y === size - 1 ? 0 : y + 1;
      for (let x = 0; x < size; x++) {
        const previousX = x === 0 ? size - 1 : x - 1;
        const nextX = x === size - 1 ? 0 : x + 1;
        const index = y * size + x;
        const dx = (heights[y * size + nextX]! - heights[y * size + previousX]!) * 0.5;
        const dy = (heights[nextY * size + x]! - heights[previousY * size + x]!) * 0.5;
        const normalX = -dx * slopeScale;
        const normalY = -dy * slopeScale;
        const inverseLength = 1 / Math.sqrt(normalX * normalX + normalY * normalY + 1);
        const offset = baseOffset + index * 4;

        normalPixels[offset] = toByte(normalX * inverseLength * 0.5 + 0.5);
        normalPixels[offset + 1] = toByte(normalY * inverseLength * 0.5 + 0.5);
        normalPixels[offset + 2] = toByte(inverseLength * 0.5 + 0.5);
      }
    }
  }

  const albedoHeight = new THREE.DataArrayTexture(albedoPixels, size, size, COVER_LAYERS.length);
  const normalRough = new THREE.DataArrayTexture(normalPixels, size, size, COVER_LAYERS.length);
  albedoHeight.name = 'Cover moss/grass albedo and height';
  normalRough.name = 'Cover moss/grass tangent normal and roughness';
  configureArrayTexture(albedoHeight, THREE.SRGBColorSpace);
  configureArrayTexture(normalRough, THREE.NoColorSpace);

  return { albedoHeight, normalRough, metres: COVER_METRES, size };
}

let defaultCoverTextures: CoverTextures | null = null;
function getDefaultCoverTextures(): CoverTextures {
  if (!defaultCoverTextures) {
    defaultCoverTextures = makeCoverTextures({ size: 64, seed: 701 });
  }
  return defaultCoverTextures;
}

const STAGE_LOOKS: readonly GroundStage[] = [
  { texelsPerMetre: 6, nearest: true, normalStrength: 0.25, levels: 12, specular: 0, triplanar: false },
  { texelsPerMetre: 11, nearest: true, normalStrength: 0.4, levels: 24, specular: 0.08, triplanar: false },
  { texelsPerMetre: 19, nearest: false, normalStrength: 0.57, levels: 0, specular: 0.22, triplanar: true },
  { texelsPerMetre: 31, nearest: false, normalStrength: 0.74, levels: 0, specular: 0.43, triplanar: true },
  { texelsPerMetre: 49, nearest: false, normalStrength: 0.88, levels: 0, specular: 0.69, triplanar: true },
  { texelsPerMetre: 72, nearest: false, normalStrength: 1, levels: 0, specular: 0.95, triplanar: true },
];

function normalizedStage(stage: number): number {
  const value = Number.isFinite(stage) ? stage : 1;
  return clamp(value === 0 ? 1 : value, 1, 6);
}

/** Stage 0 behaves as stage 1; numeric values interpolate between the six looks. */
export function stageLook(stage: number): GroundStage {
  const value = normalizedStage(stage);
  const lower = Math.floor(value) - 1;
  const upper = Math.min(lower + 1, STAGE_LOOKS.length - 1);
  const amount = value - Math.floor(value);
  const a = STAGE_LOOKS[lower]!;
  const b = STAGE_LOOKS[upper]!;

  return {
    texelsPerMetre: mix(a.texelsPerMetre, b.texelsPerMetre, amount),
    nearest: value < 3,
    normalStrength: mix(a.normalStrength, b.normalStrength, amount),
    levels: mix(a.levels, b.levels, amount),
    specular: mix(a.specular, b.specular, amount),
    triplanar: value >= 3,
  };
}

const VERTEX_SHADER = /* glsl */ `
  in vec3 matA;
  in vec3 matB;
  in float aShade;

  out vec3 vWorldPosition;
  out vec3 vWorldNormal;
  out vec3 vMatA;
  out vec3 vMatB;
  out float vShade;

  #include <fog_pars_vertex>

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vMatA = matA;
    vMatB = matB;
    vShade = aShade;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  precision highp int;

  layout(location = 0) out vec4 groundFragmentColor;
  #define gl_FragColor groundFragmentColor

  uniform highp sampler2DArray uAlbedoHeight;
  uniform highp sampler2DArray uNormalRough;
  uniform float uMaterialMetres[6];
  uniform float uStage;
  uniform float uTexelsPerMetre;
  uniform float uNormalStrength;
  uniform float uLevels;
  uniform float uSpecular;
  uniform bool uNearest;
  uniform bool uTriplanar;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColour;
  uniform vec3 uSkyColour;
  uniform vec3 uGroundColour;
  /** The paint layer (TASK-21): rgb colour and a = painted (0 none), and roughness in r; x, z origin and span in metres. */
  uniform sampler2D uPaintColour;
  uniform sampler2D uPaintRough;
  uniform vec4 uPaintRect;
  uniform float uPaintOn;
  /** The living coverage layer (TICKET-02): RGBA mask (R dust, G moss, B grass, A wet) + procedural moss/grass array tiles. */
  uniform sampler2D uCoverMask;
  uniform highp sampler2DArray uCoverAlbedoHeight;
  uniform highp sampler2DArray uCoverNormalRough;
  uniform vec2 uCoverMetres;
  uniform vec4 uCoverRect;
  uniform float uCoverOn;

  in vec3 vWorldPosition;
  in vec3 vWorldNormal;
  in vec3 vMatA;
  in vec3 vMatB;
  in float vShade;

  #include <fog_pars_fragment>

  const float PI = 3.141592653589793;

  vec3 projectionBlend(vec3 normalValue) {
    vec3 weights = pow(abs(normalValue), vec3(4.0));
    return weights / max(weights.x + weights.y + weights.z, 0.0001);
  }

  vec2 materialUv(vec3 worldPosition, vec3 surfaceNormal, float metres, float layer) {
    vec2 projected = worldPosition.xz;
    if (uTriplanar) {
      vec3 weights = projectionBlend(surfaceNormal);
      vec2 onX = worldPosition.zy;
      vec2 onY = worldPosition.xz;
      vec2 onZ = worldPosition.xy;
      projected = onX * weights.x + onY * weights.y + onZ * weights.z;
    }

    vec2 uv = projected / metres;
    // A rotated, enlarged domain sample warps the tile without spending another texture fetch.
    float angle = 0.63 + layer * 0.17;
    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 largeScale = rotation * (uv / 3.7);
    uv += vec2(
      sin(largeScale.y * 2.0 * PI + layer * 1.9),
      cos(largeScale.x * 2.0 * PI - layer * 1.3)
    ) * 0.032;

    if (uNearest) {
      float textureSizeValue = float(textureSize(uAlbedoHeight, 0).x);
      float coarsePixels = min(textureSizeValue, max(1.0, uTexelsPerMetre * metres));
      vec2 coarseCell = floor(uv * coarsePixels);
      vec2 sourceCentre = floor((coarseCell + 0.5) * textureSizeValue / coarsePixels) + 0.5;
      uv = sourceCentre / textureSizeValue;
    }

    return uv;
  }

  float hash21(vec2 p, float salt) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031 + salt * 0.0137);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float macroNoise(vec2 p, float salt) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(cell, salt);
    float b = hash21(cell + vec2(1.0, 0.0), salt);
    float c = hash21(cell + vec2(0.0, 1.0), salt);
    float d = hash21(cell + vec2(1.0, 1.0), salt);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  vec3 mappedWorldNormal(vec3 tangentNormal, vec3 geometricNormal) {
    if (!uTriplanar) {
      return normalize(vec3(tangentNormal.x, tangentNormal.z, tangentNormal.y));
    }

    vec3 weights = projectionBlend(geometricNormal);
    float signX = geometricNormal.x < 0.0 ? -1.0 : 1.0;
    float signZ = geometricNormal.z < 0.0 ? -1.0 : 1.0;
    vec3 alongX = vec3(tangentNormal.z * signX, tangentNormal.y, tangentNormal.x * signX);
    vec3 alongY = vec3(tangentNormal.x, tangentNormal.z, tangentNormal.y);
    vec3 alongZ = vec3(tangentNormal.x, tangentNormal.y, tangentNormal.z * signZ);
    return normalize(alongX * weights.x + alongY * weights.y + alongZ * weights.z);
  }

  float materialWeight(int index) {
    if (index == 0) return vMatA.x;
    if (index == 1) return vMatA.y;
    if (index == 2) return vMatA.z;
    if (index == 3) return vMatB.x;
    if (index == 4) return vMatB.y;
    return vMatB.z;
  }

  void main() {
    vec3 geometricNormal = normalize(vWorldNormal);
    float rawWeights[6];
    float activeWeights[6];
    float heights[6];
    vec3 colours[6];
    vec3 tangentNormals[6];
    float roughnesses[6];
    float totalInput = 0.0;

    for (int i = 0; i < 6; i++) {
      rawWeights[i] = max(materialWeight(i), 0.0);
      totalInput += rawWeights[i];
    }
    if (totalInput < 0.0001) {
      rawWeights[3] = 1.0;
      totalInput = 1.0;
    }

    for (int i = 0; i < 6; i++) {
      rawWeights[i] /= totalInput;
      activeWeights[i] = 0.0;
      heights[i] = 0.5;
      colours[i] = vec3(0.0);
      tangentNormals[i] = vec3(0.0, 0.0, 1.0);
      roughnesses[i] = 0.9;

      float metres = uMaterialMetres[i];
      vec2 uv = materialUv(vWorldPosition, geometricNormal, metres, float(i));
      vec2 uvDx = dFdx(uv);
      vec2 uvDy = dFdy(uv);
      vec2 normalUv = uv;
      if (!uNearest) {
        float angle = 0.63 + float(i) * 0.17;
        mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        normalUv = uv * 0.84 + rotation * (uv / 3.7) * 0.16;
      }
      vec2 normalUvDx = dFdx(normalUv);
      vec2 normalUvDy = dFdy(normalUv);

      if (rawWeights[i] > 0.02) {
        vec4 albedoHeight = textureGrad(uAlbedoHeight, vec3(uv, float(i)), uvDx, uvDy);
        vec4 normalRough = vec4(0.5, 0.5, 1.0, 0.9);

        if (uStage > 1.0) {
          vec4 warpedNormal = textureGrad(uNormalRough, vec3(normalUv, float(i)), normalUvDx, normalUvDy);
          normalRough = warpedNormal;
        }

        activeWeights[i] = rawWeights[i];
        heights[i] = albedoHeight.a;
        colours[i] = albedoHeight.rgb;
        tangentNormals[i] = normalRough.rgb * 2.0 - 1.0;
        roughnesses[i] = normalRough.a;
      }
    }

    float score[6];
    float highestScore = -1000.0;
    for (int i = 0; i < 6; i++) {
      score[i] = activeWeights[i] > 0.0
        ? log(max(activeWeights[i], 0.00001)) + (heights[i] - 0.5) * 2.1
        : -1000.0;
      highestScore = max(highestScore, score[i]);
    }

    float blendWeights[6];
    float totalBlend = 0.0;
    for (int i = 0; i < 6; i++) {
      blendWeights[i] = activeWeights[i] > 0.0 ? exp(score[i] - highestScore) : 0.0;
      totalBlend += blendWeights[i];
    }

    vec3 albedo = vec3(0.0);
    vec3 mappedNormal = vec3(0.0);
    float roughness = 0.9;
    float baseHeight = 0.5;
    for (int i = 0; i < 6; i++) {
      float blendWeight = blendWeights[i] / max(totalBlend, 0.0001);
      albedo += colours[i] * blendWeight;
      mappedNormal += tangentNormals[i] * blendWeight;
      roughness += (roughnesses[i] - 0.9) * blendWeight;
      baseHeight += (heights[i] - 0.5) * blendWeight;
    }

    // Living coverage layer (TICKET-02 Item B): RGBA mask (R dust, G moss, B grass, A wet)
    if (uCoverOn > 0.5) {
      vec2 coverUv = (vWorldPosition.xz - uCoverRect.xy) / max(uCoverRect.zw, vec2(0.001));
      if (coverUv.x >= 0.0 && coverUv.x <= 1.0 && coverUv.y >= 0.0 && coverUv.y <= 1.0) {
        // Organic domain-warped macro breakup so cell edges and patches never read as a flat tint
        float mCoarse = macroNoise(vWorldPosition.xz * 0.085, 11.3);
        float mFine = macroNoise(vWorldPosition.xz * 0.31, 27.9);
        float mBreak = mCoarse * 0.65 + mFine * 0.35;
        vec2 jitterUv = coverUv + (vec2(mCoarse, mFine) - 0.5) * (1.25 / max(uCoverRect.zw, vec2(1.0)));
        vec4 cov = texture(uCoverMask, clamp(jitterUv, 0.0, 1.0));

        float mossMask = cov.g;
        float grassMask = cov.b;
        float wetMask = cov.a;

        if (mossMask > 0.01 || grassMask > 0.01) {
          vec2 mossUv = materialUv(vWorldPosition, geometricNormal, uCoverMetres.x, 6.0);
          vec2 grassUv = materialUv(vWorldPosition, geometricNormal, uCoverMetres.y, 7.0);

          vec4 mossAH = texture(uCoverAlbedoHeight, vec3(mossUv, 0.0));
          vec4 mossNR = uStage > 1.0 ? texture(uCoverNormalRough, vec3(mossUv, 0.0)) : vec4(0.5, 0.5, 1.0, 0.86);
          vec4 grassAH = texture(uCoverAlbedoHeight, vec3(grassUv, 1.0));
          vec4 grassNR = uStage > 1.0 ? texture(uCoverNormalRough, vec3(grassUv, 1.0)) : vec4(0.5, 0.5, 1.0, 0.72);

          // Macro hue & brightness variation across the plot
          vec3 mossTint = mix(vec3(0.82, 0.90, 0.76), vec3(1.18, 1.15, 0.92), mBreak);
          vec3 grassTint = mix(vec3(0.80, 0.94, 0.72), vec3(1.22, 1.16, 0.86), mBreak);
          vec3 mossCol = mossAH.rgb * mossTint;
          vec3 grassCol = grassAH.rgb * grassTint;

          // Height-biased transition so moss creeps into regolith crevices first, then grass crowns on top
          float mossW = smoothstep(0.08, 0.72, mossMask + (mossAH.a - baseHeight) * 0.32 + (mBreak - 0.5) * 0.22) * smoothstep(0.0, 0.08, mossMask);
          float grassW = smoothstep(0.08, 0.68, grassMask + (grassAH.a - 0.45) * 0.35 + (mBreak - 0.5) * 0.24) * smoothstep(0.0, 0.08, grassMask);

          albedo = mix(albedo, mossCol, mossW);
          mappedNormal = mix(mappedNormal, mossNR.rgb * 2.0 - 1.0, mossW);
          roughness = mix(roughness, mossNR.a, mossW);

          albedo = mix(albedo, grassCol, grassW);
          mappedNormal = mix(mappedNormal, grassNR.rgb * 2.0 - 1.0, grassW);
          roughness = mix(roughness, grassNR.a, grassW);
        }

        // Wetness channel A: dampens regolith/moss albedo and lowers roughness near water
        if (wetMask > 0.01) {
          float damp = wetMask * (1.0 - 0.45 * grassMask);
          albedo *= mix(1.0, 0.64, damp);
          roughness = mix(roughness, 0.22, wetMask * 0.75);
        }
      }
    }

    // a painted cell shows the preset's colour and roughness over the natural ground (the paint layer is off until a stroke)
    if (uPaintOn > 0.5) {
      vec2 paintUv = (vWorldPosition.xz - uPaintRect.xy) / uPaintRect.zw;
      if (paintUv.x >= 0.0 && paintUv.x <= 1.0 && paintUv.y >= 0.0 && paintUv.y <= 1.0) {
        vec4 paint = texture(uPaintColour, paintUv);
        albedo = mix(albedo, paint.rgb, paint.a);
        roughness = mix(roughness, texture(uPaintRough, paintUv).r, paint.a);
      }
    }

    if (uLevels > 0.0) {
      albedo = floor(albedo * uLevels + 0.5) / uLevels;
    }

    vec3 finalNormal = geometricNormal;
    if (uStage > 1.0) {
      vec3 reliefNormal = mappedWorldNormal(normalize(mappedNormal), geometricNormal);
      finalNormal = normalize(mix(geometricNormal, reliefNormal, uNormalStrength));
    }

    vec3 lightDirection = normalize(uSunDirection);
    float diffuseTerm = max(dot(finalNormal, lightDirection), 0.0);
    float hemisphere = finalNormal.y * 0.5 + 0.5;
    vec3 ambient = mix(uGroundColour, uSkyColour, hemisphere) * 0.52;
    vec3 direct = uSunColour * diffuseTerm * (0.72 + uSpecular * 0.16);
    float macro = macroNoise(vWorldPosition.xz * 0.034, 4.7);
    float macroBrightness = 0.91 + macro * 0.17;
    float shade = clamp(vShade, 0.0, 1.0);
    vec3 lit = albedo * (ambient + direct) * macroBrightness * shade;

    if (uSpecular > 0.0) {
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      vec3 halfDirection = normalize(lightDirection + viewDirection);
      float nDotH = max(dot(finalNormal, halfDirection), 0.0);
      float alpha = max(roughness * roughness, 0.025);
      float alphaSquared = alpha * alpha;
      float denominator = nDotH * nDotH * (alphaSquared - 1.0) + 1.0;
      float distribution = alphaSquared / max(PI * denominator * denominator, 0.001);
      float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(viewDirection, halfDirection), 0.0), 5.0);
      float specular = distribution * fresnel * diffuseTerm * uSpecular * 0.12;
      lit += uSunColour * specular;
    }

    gl_FragColor = vec4(lit, 1.0);
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Creates a height-blended, triplanar-capable material with one fixed shader program. */
export function createGroundMaterial(
  tex: GroundTextures,
  o: {
    stage: number;
    sunDir: THREE.Vector3;
    sunColour?: THREE.Color;
    skyColour?: THREE.Color;
    groundColour?: THREE.Color;
    cover?: CoverTextures;
  },
): THREE.ShaderMaterial {
  const covTex = o.cover ?? getDefaultCoverTextures();
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uAlbedoHeight: { value: tex.albedoHeight },
        uNormalRough: { value: tex.normalRough },
        uMaterialMetres: { value: new Float32Array(tex.metres) },
        uStage: { value: 1 },
        uTexelsPerMetre: { value: 6 },
        uNormalStrength: { value: 0.25 },
        uLevels: { value: 12 },
        uSpecular: { value: 0 },
        uNearest: { value: true },
        uTriplanar: { value: false },
        uSunDirection: { value: o.sunDir.clone().normalize() },
        uSunColour: { value: (o.sunColour ?? new THREE.Color(0xffd7ae)).clone() },
        uSkyColour: { value: (o.skyColour ?? new THREE.Color(0x9ca7a6)).clone() },
        uGroundColour: { value: (o.groundColour ?? new THREE.Color(0x514137)).clone() },
        uPaintColour: { value: null },
        uPaintRough: { value: null },
        uPaintRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        uPaintOn: { value: 0 },
        uCoverMask: { value: null },
        uCoverAlbedoHeight: { value: covTex.albedoHeight },
        uCoverNormalRough: { value: covTex.normalRough },
        uCoverMetres: { value: new THREE.Vector2(covTex.metres[0], covTex.metres[1]) },
        uCoverRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        uCoverOn: { value: 0 },
      },
    ]),
  });

  const defaults = material.defaultAttributeValues as Record<string, number[]>;
  defaults.aShade = [1];
  setStage(material, o.stage);
  return material;
}

/**
 * Binds the plotbiome RGBA coverage mask (R dust, G moss, B grass, A wet) onto the ground material
 * over the world rectangle [x0, x0 + size] x [z0, z0 + size] (TICKET-02 Item B).
 */
export function setCoverage(
  material: THREE.ShaderMaterial,
  cover: {
    readonly tex: THREE.DataTexture;
    readonly x0: number;
    readonly z0: number;
    readonly size: number;
    readonly tiles?: CoverTextures;
  } | null,
): void {
  if (!cover) {
    material.uniforms.uCoverMask!.value = null;
    material.uniforms.uCoverOn!.value = 0;
    material.uniformsNeedUpdate = true;
    return;
  }

  cover.tex.colorSpace = THREE.NoColorSpace;
  cover.tex.wrapS = THREE.ClampToEdgeWrapping;
  cover.tex.wrapT = THREE.ClampToEdgeWrapping;
  cover.tex.magFilter = THREE.LinearFilter;
  cover.tex.minFilter = THREE.LinearFilter;
  cover.tex.needsUpdate = true;

  if (cover.tiles) {
    material.uniforms.uCoverAlbedoHeight!.value = cover.tiles.albedoHeight;
    material.uniforms.uCoverNormalRough!.value = cover.tiles.normalRough;
    (material.uniforms.uCoverMetres!.value as THREE.Vector2).set(
      cover.tiles.metres[0],
      cover.tiles.metres[1],
    );
  } else if (!material.uniforms.uCoverAlbedoHeight?.value) {
    const def = getDefaultCoverTextures();
    material.uniforms.uCoverAlbedoHeight!.value = def.albedoHeight;
    material.uniforms.uCoverNormalRough!.value = def.normalRough;
  }

  material.uniforms.uCoverMask!.value = cover.tex;
  (material.uniforms.uCoverRect!.value as THREE.Vector4).set(
    cover.x0,
    cover.z0,
    cover.size,
    cover.size,
  );
  material.uniforms.uCoverOn!.value = 1;
  material.uniformsNeedUpdate = true;
}

/**
 * Turns the paint layer on (TASK-21): `colour` holds rgb and a = painted (0 none), `rough` holds the roughness in r, and the
 * layer covers the square from (x0, z0) for `span` metres. Painting later only rewrites the textures.
 */
export function setGroundPaint(material: THREE.ShaderMaterial, paint: { readonly colour: THREE.Texture; readonly rough: THREE.Texture; readonly x0: number; readonly z0: number; readonly span: number }): void {
  material.uniforms.uPaintColour!.value = paint.colour;
  material.uniforms.uPaintRough!.value = paint.rough;
  (material.uniforms.uPaintRect!.value as THREE.Vector4).set(paint.x0, paint.z0, paint.span, paint.span);
  material.uniforms.uPaintOn!.value = 1;
}

/** Changes stage uniforms only; the ShaderMaterial program and defines are untouched. */
export function setStage(material: THREE.ShaderMaterial, stage: number): void {
  const value = normalizedStage(stage);
  const look = stageLook(value);
  const uniforms = material.uniforms;
  uniforms['uStage']!.value = value;
  uniforms['uTexelsPerMetre']!.value = look.texelsPerMetre;
  uniforms['uNormalStrength']!.value = look.normalStrength;
  uniforms['uLevels']!.value = look.levels;
  uniforms['uSpecular']!.value = look.specular;
  uniforms['uNearest']!.value = look.nearest;
  uniforms['uTriplanar']!.value = look.triplanar;
  material.uniformsNeedUpdate = true;
}

/** Returns mean linear-light albedo for one of the six tile layers. */
export function meanAlbedo(tex: GroundTextures, material: number): [number, number, number] {
  if (!Number.isInteger(material) || material < 0 || material >= MATERIALS.length) {
    throw new RangeError('Material index must be between 0 and 5.');
  }

  const data = tex.albedoHeight.image.data as Uint8Array;
  const firstPixel = material * tex.size * tex.size * 4;
  let red = 0;
  let green = 0;
  let blue = 0;
  const decode = (value: number): number => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  for (let index = 0; index < tex.size * tex.size; index++) {
    const offset = firstPixel + index * 4;
    red += decode(data[offset]!);
    green += decode(data[offset + 1]!);
    green += 0;
    blue += decode(data[offset + 2]!);
  }

  const scale = 1 / (tex.size * tex.size);
  return [red * scale, green * scale, blue * scale];
}
