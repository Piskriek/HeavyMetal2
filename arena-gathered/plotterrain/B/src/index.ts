export type Material = 'rock' | 'scree' | 'gravel' | 'dust' | 'cracked' | 'redsoil';

export const MATERIALS: readonly Material[] = ['rock', 'scree', 'gravel', 'dust', 'cracked', 'redsoil'];

export type Weights = [number, number, number, number, number, number];

export interface Crater { x: number; z: number; r: number; depth: number }
export interface Boulder { x: number; z: number; size: number; yaw: number }

export interface Terrain {
  readonly radius: number;
  readonly padRadius: number;
  height(x: number, z: number): number;
  normal(x: number, z: number): [number, number, number];
  slope(x: number, z: number): number;
  materials(x: number, z: number): Weights;
  readonly craters: readonly Crater[];
  boulders(x0: number, z0: number, size: number): Boulder[];
}

export interface ChunkMesh {
  positions: Float32Array;
  normals: Float32Array;
  matA: Float32Array;
  matB: Float32Array;
  indices: Uint32Array;
}

interface Ridge {
  x: number;
  z: number;
  cos: number;
  sin: number;
  halfLength: number;
  narrow: number;
  wide: number;
  height: number;
  steepSide: number;
  phase: number;
  bend: number;
}

interface Gully {
  x: number;
  z: number;
  cos: number;
  sin: number;
  halfLength: number;
  width: number;
  depth: number;
  phase: number;
  bend: number;
}

interface TerrainInternals {
  materialsAtSlope(x: number, z: number, slope: number): Weights;
}

interface NoiseTable {
  readonly minimum: number;
  readonly maximum: number;
  readonly width: number;
  readonly salt: number;
  readonly values: Float64Array;
}

const terrainInternals = new WeakMap<Terrain, TerrainInternals>();
const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lattice(ix: number, iz: number, salt: number): number {
  let h = Math.imul(ix | 0, 0x1e35a7bd) ^ Math.imul(iz | 0, 0x5f356495) ^ salt;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h ^= h >>> 15;
  return (h >>> 0) * (1 / 2147483648) - 1;
}

function seededUnit(a: number, b: number, salt: number): number {
  return (lattice(a, b, salt) + 1) * 0.5;
}

function makeNoiseTable(salt: number): NoiseTable {
  const minimum = -128;
  const maximum = 128;
  const width = maximum - minimum + 1;
  const values = new Float64Array(width * width);
  let index = 0;
  for (let z = minimum; z <= maximum; z++) {
    for (let x = minimum; x <= maximum; x++) values[index++] = lattice(x, z, salt);
  }
  return { minimum, maximum, width, salt, values };
}

function tableLattice(ix: number, iz: number, table: NoiseTable): number {
  if (ix < table.minimum || ix > table.maximum || iz < table.minimum || iz > table.maximum) {
    return lattice(ix, iz, table.salt);
  }
  return table.values[(iz - table.minimum) * table.width + ix - table.minimum]!;
}

function valueNoise(x: number, z: number, table: NoiseTable): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = tableLattice(ix, iz, table);
  const b = tableLattice(ix + 1, iz, table);
  const c = tableLattice(ix, iz + 1, table);
  const d = tableLattice(ix + 1, iz + 1, table);
  const near = a + (b - a) * ux;
  const far = c + (d - c) * ux;
  return near + (far - near) * uz;
}

function makeSalt(seed: number, channel: number): number {
  return Math.imul((seed ^ Math.imul(channel, 0x9e3779b1)) | 0, 0x85ebca6b);
}

function ridgeProfile(ridge: Ridge, x: number, z: number): [number, number, number] | undefined {
  const dx = x - ridge.x;
  const dz = z - ridge.z;
  const along = dx * ridge.cos + dz * ridge.sin;
  if (Math.abs(along) >= ridge.halfLength) return undefined;
  const across = -dx * ridge.sin + dz * ridge.cos;
  if (Math.abs(across) > ridge.wide * 4 + ridge.bend + 8) return undefined;
  const t = across - Math.sin(along * 0.012 + ridge.phase) * ridge.bend;
  const absT = Math.abs(t);
  const width = t * ridge.steepSide > 0 ? ridge.narrow : ridge.wide;
  const alongUnit = along / ridge.halfLength;
  const end = 1 - alongUnit * alongUnit;
  const longitudinal = end * end;
  const edgeFade = 1 - smoothstep(width * 3.4, width * 4, absT);
  const profile = Math.exp(-(Math.sqrt(t * t + 9) - 3) / width) * edgeFade * longitudinal;
  const footDistance = (absT - width * 1.55) / (width * 0.82);
  const foot = Math.exp(-footDistance * footDistance) * longitudinal * edgeFade;
  const lee = foot * (t * ridge.steepSide < 0 ? 1 : 0.22);
  return [profile, foot, lee];
}

export function createTerrain(o: { seed: number; radius?: number; padRadius?: number }): Terrain {
  const seed = Number.isFinite(o.seed) ? Math.trunc(o.seed) | 0 : 0;
  const radius = Number.isFinite(o.radius) && (o.radius ?? 0) > 0 ? (o.radius as number) : 500;
  const padRadius = Number.isFinite(o.padRadius) && (o.padRadius ?? 0) > 0 ? (o.padRadius as number) : 9;
  const angleSalt = makeSalt(seed, 1);
  const ridgeSalt = makeSalt(seed, 2);
  const craterSalt = makeSalt(seed, 3);
  const gullySalt = makeSalt(seed, 4);
  const warpSalt = makeSalt(seed, 11);
  const mediumSalt = makeSalt(seed, 13);
  const smallSalt = makeSalt(seed, 14);
  const gritSalt = makeSalt(seed, 15);
  const redSaltA = makeSalt(seed, 21);
  const redSaltB = makeSalt(seed, 22);
  const basinSalt = makeSalt(seed, 23);
  const crackSalt = makeSalt(seed, 24);
  const warpTable = makeNoiseTable(warpSalt);
  const mediumTable = makeNoiseTable(mediumSalt);
  const smallTable = makeNoiseTable(smallSalt);
  const gritTable = makeNoiseTable(gritSalt);
  const basinTable = makeNoiseTable(basinSalt);
  const redTableA = makeNoiseTable(redSaltA);
  const redTableB = makeNoiseTable(redSaltB);
  const crackTable = makeNoiseTable(crackSalt);
  const rotation = seededUnit(7, 13, angleSalt) * TAU;
  const rotCos = Math.cos(rotation);
  const rotSin = Math.sin(rotation);

  const craters: Crater[] = [];
  const craterBaseAngle = seededUnit(31, 17, craterSalt) * TAU;
  for (let i = 0; i < 7; i++) {
    const r = 4 + 31 * seededUnit(i, 1, craterSalt);
    const depth = 0.55 + 2.55 * seededUnit(i, 2, craterSalt) * (0.4 + 0.6 * r / 35);
    const minimum = padRadius + 40 + r + 6;
    const maximum = Math.max(minimum, radius - r - 5);
    const radialSeed = radius * (0.19 + 0.66 * seededUnit(i, 3, craterSalt));
    const distance = clamp(radialSeed, minimum, maximum);
    const angle = craterBaseAngle + i * (TAU / 7) + (seededUnit(i, 4, craterSalt) - 0.5) * 0.36;
    craters.push({ x: Math.cos(angle) * distance, z: Math.sin(angle) * distance, r, depth });
  }

  const ridges: Ridge[] = [];
  const ridgeBaseAngle = seededUnit(41, 23, ridgeSalt) * TAU;
  for (let i = 0; i < 3; i++) {
    const radialAngle = ridgeBaseAngle + i * (TAU / 3) + (seededUnit(i, 1, ridgeSalt) - 0.5) * 0.55;
    const distance = Math.max(padRadius + 140, radius * (0.4 + 0.25 * seededUnit(i, 2, ridgeSalt)));
    const axis = radialAngle + Math.PI * 0.5 + (seededUnit(i, 3, ridgeSalt) - 0.5) * 0.48;
    const halfLength = Math.min(radius * 0.2, Math.max(35, radius * (0.13 + 0.06 * seededUnit(i, 4, ridgeSalt))));
    ridges.push({
      x: Math.cos(radialAngle) * distance,
      z: Math.sin(radialAngle) * distance,
      cos: Math.cos(axis),
      sin: Math.sin(axis),
      halfLength,
      narrow: Math.max(11, radius * (0.028 + 0.014 * seededUnit(i, 5, ridgeSalt))),
      wide: Math.max(30, radius * (0.075 + 0.035 * seededUnit(i, 6, ridgeSalt))),
      height: 14.5 + 6.5 * seededUnit(i, 7, ridgeSalt),
      steepSide: seededUnit(i, 8, ridgeSalt) > 0.5 ? 1 : -1,
      phase: seededUnit(i, 9, ridgeSalt) * TAU,
      bend: 3 + 6 * seededUnit(i, 10, ridgeSalt),
    });
  }

  const gullies: Gully[] = [];
  const gullyBaseAngle = seededUnit(51, 29, gullySalt) * TAU;
  for (let i = 0; i < 4; i++) {
    const sourceAngle = gullyBaseAngle + i * Math.PI * 0.5 + (seededUnit(i, 1, gullySalt) - 0.5) * 0.42;
    const targetAngle = sourceAngle + Math.PI + (seededUnit(i, 2, gullySalt) - 0.5) * 0.46;
    const sourceRadius = radius * (0.7 + 0.17 * seededUnit(i, 3, gullySalt));
    const targetRadius = radius * (0.18 + 0.08 * seededUnit(i, 4, gullySalt));
    const ax = Math.cos(sourceAngle) * sourceRadius;
    const az = Math.sin(sourceAngle) * sourceRadius;
    const bx = Math.cos(targetAngle) * targetRadius;
    const bz = Math.sin(targetAngle) * targetRadius;
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.sqrt(dx * dx + dz * dz);
    const axis = Math.atan2(dz, dx);
    gullies.push({
      x: (ax + bx) * 0.5,
      z: (az + bz) * 0.5,
      cos: Math.cos(axis),
      sin: Math.sin(axis),
      halfLength: length * 0.5,
      width: 6 + 4 * seededUnit(i, 5, gullySalt),
      depth: 1.05 + 0.48 * seededUnit(i, 6, gullySalt),
      phase: seededUnit(i, 7, gullySalt) * TAU,
      bend: 4 + 7 * seededUnit(i, 8, gullySalt),
    });
  }

  function rawField(x: number, z: number): number {
    const rx = x * rotCos - z * rotSin;
    const rz = x * rotSin + z * rotCos;
    const warpSample = valueNoise(rx * 0.0048 + 7.3, rz * 0.0048 - 11.1, warpTable);
    const warp = warpSample * 22;
    const wx = rx + warp;
    const wz = rz - warp * 0.68;
    let h = warpSample * 1.95;
    h += valueNoise(wx * 0.012, wz * 0.012, mediumTable) * 1.1;
    h += valueNoise(wx * 0.037, wz * 0.037, smallTable) * 0.45;
    h += valueNoise(wx * 0.13, wz * 0.13, gritTable) * 0.14;
    h += Math.sin(wx * 0.13 + wz * 0.061 + warp * 0.12) * 0.12;

    let ridgeHeight = 0;
    for (let i = 0; i < ridges.length; i++) {
      const ridge = ridges[i]!;
      const shape = ridgeProfile(ridge, x, z);
      if (shape !== undefined) ridgeHeight = Math.max(ridgeHeight, shape[0] * ridge.height);
    }
    h += ridgeHeight;

    for (let i = 0; i < craters.length; i++) {
      const crater = craters[i]!;
      const dx = x - crater.x;
      const dz = z - crater.z;
      const reach = crater.r * 1.8;
      if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
      const q = Math.sqrt(dx * dx + dz * dz) / crater.r;
      if (q >= 1.8) continue;
      const taper = 1 - smoothstep(1.42, 1.8, q);
      const bowl = -crater.depth * Math.exp(-((q / 0.72) * (q / 0.72)));
      const rimUnit = (q - 1.03) / 0.19;
      const rim = crater.depth * 0.27 * Math.exp(-(rimUnit * rimUnit));
      h += (bowl + rim) * taper;
    }

    for (let i = 0; i < gullies.length; i++) {
      const gully = gullies[i]!;
      const dx = x - gully.x;
      const dz = z - gully.z;
      const along = dx * gully.cos + dz * gully.sin;
      if (Math.abs(along) >= gully.halfLength) continue;
      const across = -dx * gully.sin + dz * gully.cos;
      if (Math.abs(across) > gully.width * 3.8 + gully.bend) continue;
      const t = across - Math.sin(along * 0.014 + gully.phase) * gully.bend;
      if (Math.abs(t) > gully.width * 3.8) continue;
      const sideFade = 1 - smoothstep(gully.width * 3.2, gully.width * 3.8, Math.abs(t));
      const startFade = smoothstep(-gully.halfLength, -gully.halfLength + 18, along);
      const endFade = 1 - smoothstep(gully.halfLength - 18, gully.halfLength, along);
      const progress = (along / gully.halfLength + 1) * 0.5;
      const depth = gully.depth * (0.76 + progress * 0.3);
      const channel = Math.exp(-((t / gully.width) * (t / gully.width))) * sideFade;
      h -= depth * channel * startFade * endFade;
    }
    return h;
  }

  const rawOrigin = rawField(0, 0);
  const padRadiusSquared = padRadius * padRadius;

  function heightAt(x: number, z: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
    const radiusSquared = x * x + z * z;
    if (radiusSquared <= padRadiusSquared) return 0;
    const distance = Math.sqrt(radiusSquared);
    const padBlend = smoothstep(padRadius, padRadius + 15, distance);
    const terrainFade = 0.3 + 0.7 * smoothstep(padRadius + 12, padRadius + 76, distance);
    const broadRise = -1.35 * radiusSquared / (radiusSquared + 125 * 125);
    const relief = padBlend * ((rawField(x, z) - rawOrigin) * terrainFade + broadRise);
    if (relief < -13) return -13 - 2 * (1 - Math.exp((relief + 13) * 0.5));
    if (relief > 31) return 31 + 4 * (1 - Math.exp(-(relief - 31) * 0.25));
    return relief;
  }

  function gradientAt(x: number, z: number): [number, number] {
    const step = 0.75;
    const dx = (heightAt(x + step, z) - heightAt(x - step, z)) / (step * 2);
    const dz = (heightAt(x, z + step) - heightAt(x, z - step)) / (step * 2);
    return [dx, dz];
  }

  function slopeForGradient(dx: number, dz: number): number {
    return Math.atan(Math.sqrt(dx * dx + dz * dz)) * DEG;
  }

  function ridgeSignals(x: number, z: number): [number, number, number] {
    let crest = 0;
    let foot = 0;
    let lee = 0;
    for (let i = 0; i < ridges.length; i++) {
      const ridge = ridges[i]!;
      const shape = ridgeProfile(ridge, x, z);
      if (shape === undefined) continue;
      crest = Math.max(crest, shape[0]);
      foot = Math.max(foot, shape[1]);
      lee = Math.max(lee, shape[2]);
    }
    return [crest, foot, lee];
  }

  function craterSignals(x: number, z: number): [number, number, number] {
    let rim = 0;
    let floor = 0;
    let foot = 0;
    for (let i = 0; i < craters.length; i++) {
      const crater = craters[i]!;
      const dx = x - crater.x;
      const dz = z - crater.z;
      const reach = crater.r * 1.75;
      if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
      const q = Math.sqrt(dx * dx + dz * dz) / crater.r;
      const rimUnit = (q - 1.03) / 0.19;
      const rimHere = Math.exp(-(rimUnit * rimUnit));
      const floorHere = Math.exp(-((q / 0.72) * (q / 0.72)));
      const footUnit = (q - 1.35) / 0.28;
      const footHere = Math.exp(-(footUnit * footUnit));
      rim = Math.max(rim, rimHere);
      floor = Math.max(floor, floorHere);
      foot = Math.max(foot, footHere);
    }
    return [rim, floor, foot];
  }

  function materialsAtSlope(x: number, z: number, slope: number): Weights {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return [0, 0, 0.68, 0.32, 0, 0];
    const rx = x * rotCos - z * rotSin;
    const rz = x * rotSin + z * rotCos;
    const warpSample = valueNoise(rx * 0.0048 + 7.3, rz * 0.0048 - 11.1, warpTable);
    const warp = warpSample * 22;
    const wx = rx + warp;
    const wz = rz - warp * 0.68;
    const basinNoise = warpSample * 0.72
      + valueNoise(wx * 0.012, wz * 0.012, basinTable) * 0.28;
    const redNoise = valueNoise(wx * 0.009, wz * 0.009, redTableA) * 0.66
      + valueNoise(wx * 0.031, wz * 0.031, redTableB) * 0.34;
    const crackNoise = valueNoise(wx * 0.007, wz * 0.007, crackTable) * 0.58
      + valueNoise(wx * 0.024, wz * 0.024, redTableB) * 0.42;

    const ridge = ridgeSignals(x, z);
    const crater = craterSignals(x, z);
    const flat = 1 - smoothstep(8, 32, slope);
    const steep = smoothstep(22, 34, slope);
    const slopeFoot = smoothstep(7, 20, slope) * (1 - smoothstep(22, 38, slope));
    const basin = smoothstep(0.05, 0.58, -basinNoise);
    const redPatch = smoothstep(-0.16, 0.48, redNoise);
    const crackPatch = smoothstep(-0.18, 0.5, crackNoise);
    const rockSignal = steep * 1.5 + crater[0] * 1.25 + ridge[0] * 0.95;
    const rockFree = 1 - smoothstep(0.08, 0.72, rockSignal);
    const hollow = clamp(basin * 0.72 + crater[1] * 0.65, 0, 1);
    const leeDust = ridge[2];

    const rock = 0.012 + 3.25 * steep + 1.8 * crater[0] + 1.05 * ridge[0];
    const scree = 0.065 + 0.95 * slopeFoot + 1.35 * ridge[1] + 0.7 * crater[2];
    const gravel = 0.08 + 0.56 * flat * (1 - 0.42 * hollow);
    const dust = 0.12 + 0.95 * hollow + 0.72 * leeDust + 0.12 * flat * (1 - redPatch);
    const cracked = 0.018 + 1.02 * flat * basin * crackPatch;
    // red soil is never on rock: it fades with the rock weight itself, not only with the rock signal (crater rims carry rock
    // the signal barely sees; landed 2026-10-07)
    const redsoil = 1.95 * flat * redPatch * rockFree * clamp(1 - 2.2 * (rock - 0.012), 0, 1);

    const distance = Math.sqrt(x * x + z * z);
    const padBlend = 1 - smoothstep(padRadius, padRadius + 15, distance);
    const weights: Weights = [
      rock * (1 - padBlend),
      scree * (1 - padBlend),
      gravel * (1 - padBlend) + 0.68 * padBlend,
      dust * (1 - padBlend) + 0.32 * padBlend,
      cracked * (1 - padBlend),
      redsoil * (1 - padBlend),
    ];
    let sum = weights[0] + weights[1] + weights[2] + weights[3] + weights[4] + weights[5];
    if (weights[0] > sum * 0.5 && weights[5] > 0) {
      sum -= weights[5];
      weights[5] = 0;
    }
    return [weights[0] / sum, weights[1] / sum, weights[2] / sum, weights[3] / sum, weights[4] / sum, weights[5] / sum];
  }

  function slopeAt(x: number, z: number): number {
    const gradient = gradientAt(x, z);
    return slopeForGradient(gradient[0], gradient[1]);
  }

  const terrain: Terrain = {
    radius,
    padRadius,
    height: heightAt,
    normal(x: number, z: number): [number, number, number] {
      const gradient = gradientAt(x, z);
      const length = Math.sqrt(gradient[0] * gradient[0] + 1 + gradient[1] * gradient[1]);
      return [-gradient[0] / length, 1 / length, -gradient[1] / length];
    },
    slope: slopeAt,
    materials(x: number, z: number): Weights {
      return materialsAtSlope(x, z, slopeAt(x, z));
    },
    craters,
    boulders(x0: number, z0: number, size: number): Boulder[] {
      if (!Number.isFinite(x0) || !Number.isFinite(z0) || !Number.isFinite(size) || size <= 0) return [];
      const cellSize = 24;
      const minX = Math.floor(x0 / cellSize);
      const minZ = Math.floor(z0 / cellSize);
      const maxX = Math.floor((x0 + size) / cellSize);
      const maxZ = Math.floor((z0 + size) / cellSize);
      const result: Boulder[] = [];
      const boulderSalt = makeSalt(seed, 31);
      for (let iz = minZ; iz <= maxZ; iz++) {
        for (let ix = minX; ix <= maxX; ix++) {
          const ux = seededUnit(ix, iz, boulderSalt);
          const uz = seededUnit(ix + 173, iz - 257, boulderSalt);
          const bx = (ix + ux) * cellSize;
          const bz = (iz + uz) * cellSize;
          if (bx < x0 || bx >= x0 + size || bz < z0 || bz >= z0 + size) continue;
          const padDistance = Math.sqrt(bx * bx + bz * bz);
          if (padDistance <= padRadius + 2) continue;
          const weights = materialsAtSlope(bx, bz, slopeAt(bx, bz));
          const rocky = Math.max(weights[0], weights[1]);
          const chance = 0.07 + 0.28 * rocky;
          if (seededUnit(ix - 311, iz + 419, boulderSalt) >= chance) continue;
          const sizeUnit = seededUnit(ix + 127, iz + 239, boulderSalt);
          const yawUnit = seededUnit(ix - 541, iz - 101, boulderSalt);
          result.push({
            x: bx,
            z: bz,
            size: (0.38 + sizeUnit * 1.35) * (1 + rocky * 0.45),
            yaw: yawUnit * TAU,
          });
        }
      }
      return result;
    },
  };

  terrainInternals.set(terrain, { materialsAtSlope });
  return terrain;
}

function normalizedNormal(dx: number, dz: number): [number, number, number] {
  const length = Math.sqrt(dx * dx + 1 + dz * dz);
  return [-dx / length, 1 / length, -dz / length];
}

function faceNormal(
  a: number,
  b: number,
  c: number,
  heights: Float64Array,
  stride: number,
  step: number,
): [number, number, number] {
  const ax = (a % stride) * step;
  const az = Math.floor(a / stride) * step;
  const bx = (b % stride) * step;
  const bz = Math.floor(b / stride) * step;
  const cx = (c % stride) * step;
  const cz = Math.floor(c / stride) * step;
  const ay = heights[a]!;
  const by = heights[b]!;
  const cy = heights[c]!;
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return [nx / length, ny / length, nz / length];
}

export function chunkMesh(
  t: Terrain,
  cx: number,
  cz: number,
  size: number,
  cells: number,
  o?: { flat?: boolean; skirt?: number },
): ChunkMesh {
  const divisions = Math.max(1, Math.floor(cells));
  const stride = divisions + 1;
  const gridCount = stride * stride;
  const step = size / divisions;
  const startX = cx - size * 0.5;
  const startZ = cz - size * 0.5;
  const skirt = Number.isFinite(o?.skirt) ? Math.max(0, o?.skirt ?? 0) : 0;
  const hasSkirt = skirt > 0;
  const flat = o?.flat ?? false;
  const skirtVertexCount = hasSkirt ? 4 * stride : 0;
  const baseVertexCount = flat ? divisions * divisions * 6 : gridCount;
  const vertexCount = baseVertexCount + skirtVertexCount;
  const skirtIndexCount = hasSkirt ? divisions * 4 * 6 : 0;
  const baseIndexCount = flat ? baseVertexCount : divisions * divisions * 6;
  const heights = new Float64Array(gridCount);
  const gridNormals = new Float32Array(gridCount * 3);
  const gridMatA = new Float32Array(gridCount * 3);
  const gridMatB = new Float32Array(gridCount * 3);
  const representative = flat ? new Int32Array(gridCount).fill(-1) : undefined;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const matA = new Float32Array(vertexCount * 3);
  const matB = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(baseIndexCount + skirtIndexCount);
  const internals = terrainInternals.get(t);

  for (let row = 0; row < stride; row++) {
    const z = startZ + row * step;
    for (let col = 0; col < stride; col++) {
      const x = startX + col * step;
      const gridIndex = row * stride + col;
      heights[gridIndex] = t.height(x, z);
    }
  }

  for (let row = 0; row < stride; row++) {
    const beforeRow = Math.max(0, row - 1);
    const afterRow = Math.min(divisions, row + 1);
    for (let col = 0; col < stride; col++) {
      const beforeCol = Math.max(0, col - 1);
      const afterCol = Math.min(divisions, col + 1);
      const gridIndex = row * stride + col;
      const dx = (heights[row * stride + afterCol]! - heights[row * stride + beforeCol]!)
        / ((afterCol - beforeCol || 1) * step);
      const dz = (heights[afterRow * stride + col]! - heights[beforeRow * stride + col]!)
        / ((afterRow - beforeRow || 1) * step);
      const normal = normalizedNormal(dx, dz);
      const nOffset = gridIndex * 3;
      gridNormals[nOffset] = normal[0];
      gridNormals[nOffset + 1] = normal[1];
      gridNormals[nOffset + 2] = normal[2];
      const slope = Math.atan(Math.sqrt(dx * dx + dz * dz)) * DEG;
      const x = startX + col * step;
      const z = startZ + row * step;
      const weights = internals === undefined ? t.materials(x, z) : internals.materialsAtSlope(x, z, slope);
      gridMatA[nOffset] = weights[0];
      gridMatA[nOffset + 1] = weights[1];
      gridMatA[nOffset + 2] = weights[2];
      gridMatB[nOffset] = weights[3];
      gridMatB[nOffset + 1] = weights[4];
      gridMatB[nOffset + 2] = weights[5];
    }
  }

  function writeGridVertex(target: number, gridIndex: number, yOffset: number): void {
    const row = Math.floor(gridIndex / stride);
    const col = gridIndex - row * stride;
    const offset = target * 3;
    const gridOffset = gridIndex * 3;
    positions[offset] = startX + col * step;
    positions[offset + 1] = heights[gridIndex]! + yOffset;
    positions[offset + 2] = startZ + row * step;
    normals[offset] = gridNormals[gridOffset]!;
    normals[offset + 1] = gridNormals[gridOffset + 1]!;
    normals[offset + 2] = gridNormals[gridOffset + 2]!;
    matA[offset] = gridMatA[gridOffset]!;
    matA[offset + 1] = gridMatA[gridOffset + 1]!;
    matA[offset + 2] = gridMatA[gridOffset + 2]!;
    matB[offset] = gridMatB[gridOffset]!;
    matB[offset + 1] = gridMatB[gridOffset + 1]!;
    matB[offset + 2] = gridMatB[gridOffset + 2]!;
  }

  if (flat) {
    let cursor = 0;
    for (let row = 0; row < divisions; row++) {
      for (let col = 0; col < divisions; col++) {
        const p00 = row * stride + col;
        const p01 = p00 + stride;
        const p10 = p00 + 1;
        const p11 = p01 + 1;
        const triangles = [p00, p01, p10, p10, p01, p11];
        for (let triangle = 0; triangle < 2; triangle++) {
          const a = triangles[triangle * 3]!;
          const b = triangles[triangle * 3 + 1]!;
          const c = triangles[triangle * 3 + 2]!;
          const normal = faceNormal(a, b, c, heights, stride, step);
          for (let point = 0; point < 3; point++) {
            const gridIndex = triangles[triangle * 3 + point]!;
            const target = cursor++;
            writeGridVertex(target, gridIndex, 0);
            const offset = target * 3;
            normals[offset] = normal[0];
            normals[offset + 1] = normal[1];
            normals[offset + 2] = normal[2];
            if (representative !== undefined && representative[gridIndex] === -1) representative[gridIndex] = target;
          }
        }
      }
    }
    for (let i = 0; i < baseVertexCount; i++) indices[i] = i;
  } else {
    for (let row = 0; row < stride; row++) {
      for (let col = 0; col < stride; col++) writeGridVertex(row * stride + col, row * stride + col, 0);
    }
    let cursor = 0;
    for (let row = 0; row < divisions; row++) {
      for (let col = 0; col < divisions; col++) {
        const p00 = row * stride + col;
        const p01 = p00 + stride;
        const p10 = p00 + 1;
        const p11 = p01 + 1;
        indices[cursor++] = p00;
        indices[cursor++] = p01;
        indices[cursor++] = p10;
        indices[cursor++] = p10;
        indices[cursor++] = p01;
        indices[cursor++] = p11;
      }
    }
  }

  if (hasSkirt) {
    const edges: { grid: number[]; nx: number; nz: number }[] = [
      { grid: Array.from({ length: stride }, (_, i) => i), nx: 0, nz: -1 },
      { grid: Array.from({ length: stride }, (_, i) => i * stride + divisions), nx: 1, nz: 0 },
      { grid: Array.from({ length: stride }, (_, i) => divisions * stride + (divisions - i)), nx: 0, nz: 1 },
      { grid: Array.from({ length: stride }, (_, i) => (divisions - i) * stride), nx: -1, nz: 0 },
    ];
    let nextVertex = baseVertexCount;
    let nextIndex = baseIndexCount;
    for (const edge of edges) {
      const bottoms: number[] = [];
      for (const gridIndex of edge.grid) {
        const bottomIndex = nextVertex++;
        bottoms.push(bottomIndex);
        const offset = bottomIndex * 3;
        const row = Math.floor(gridIndex / stride);
        const col = gridIndex - row * stride;
        const gridOffset = gridIndex * 3;
        positions[offset] = startX + col * step;
        positions[offset + 1] = heights[gridIndex]! - skirt;
        positions[offset + 2] = startZ + row * step;
        normals[offset] = edge.nx;
        normals[offset + 1] = 0;
        normals[offset + 2] = edge.nz;
        matA[offset] = gridMatA[gridOffset]!;
        matA[offset + 1] = gridMatA[gridOffset + 1]!;
        matA[offset + 2] = gridMatA[gridOffset + 2]!;
        matB[offset] = gridMatB[gridOffset]!;
        matB[offset + 1] = gridMatB[gridOffset + 1]!;
        matB[offset + 2] = gridMatB[gridOffset + 2]!;
      }
      for (let i = 0; i < divisions; i++) {
        const gridA = edge.grid[i]!;
        const gridB = edge.grid[i + 1]!;
        const topA = flat ? (representative?.[gridA] ?? 0) : gridA;
        const topB = flat ? (representative?.[gridB] ?? 0) : gridB;
        const bottomA = bottoms[i]!;
        const bottomB = bottoms[i + 1]!;
        const candidates: [number, number, number][] = [
          [topA, bottomA, topB],
          [topB, bottomA, bottomB],
        ];
        for (const triangle of candidates) {
          const a = triangle[0];
          let b = triangle[1];
          let c = triangle[2];
          const ao = a * 3;
          const bo = b * 3;
          const co = c * 3;
          const abx = positions[bo]! - positions[ao]!;
          const aby = positions[bo + 1]! - positions[ao + 1]!;
          const abz = positions[bo + 2]! - positions[ao + 2]!;
          const acx = positions[co]! - positions[ao]!;
          const acy = positions[co + 1]! - positions[ao + 1]!;
          const acz = positions[co + 2]! - positions[ao + 2]!;
          const nx = aby * acz - abz * acy;
          const nz = abx * acy - aby * acx;
          if (nx * edge.nx + nz * edge.nz < 0) {
            const swap = b;
            b = c;
            c = swap;
          }
          indices[nextIndex++] = a;
          indices[nextIndex++] = b;
          indices[nextIndex++] = c;
        }
      }
    }
  }

  return { positions, normals, matA, matB, indices };
}

export function chunksAround(
  eyeX: number,
  eyeZ: number,
  o: { extent: number; cells: number; minSize: number; budget: number },
): { cx: number; cz: number; size: number; cells: number }[] {
  const extent = Number.isFinite(o.extent) ? Math.max(0, o.extent) : 0;
  const rootSize = extent * 2;
  const cells = Math.max(1, Math.floor(o.cells));
  if (rootSize <= 0) return [];
  const rootTriangles = 2 * cells * cells;
  if (o.budget < rootTriangles) throw new RangeError('budget is smaller than the root chunk triangle count');
  const requestedMin = Number.isFinite(o.minSize) ? Math.max(0, o.minSize) : 0;
  const minSize = Math.min(requestedMin > 0 ? requestedMin : rootSize, rootSize);
  let maxDepth = 0;
  let smallest = rootSize;
  while (smallest * 0.5 >= minSize && maxDepth < 48) {
    smallest *= 0.5;
    maxDepth++;
  }

  for (let depthLimit = maxDepth; depthLimit >= 0; depthLimit--) {
    const leaves: { cx: number; cz: number; size: number; cells: number }[] = [];
    function visit(cx: number, cz: number, size: number, depth: number): void {
      const half = size * 0.5;
      const dx = Math.max(Math.abs(eyeX - cx) - half, 0);
      const dz = Math.max(Math.abs(eyeZ - cz) - half, 0);
      const canSplit = depth < depthLimit && half >= minSize && dx * dx + dz * dz < (size * 0.85) * (size * 0.85);
      if (!canSplit) {
        leaves.push({ cx, cz, size, cells });
        return;
      }
      const quarter = size * 0.25;
      visit(cx - quarter, cz - quarter, half, depth + 1);
      visit(cx + quarter, cz - quarter, half, depth + 1);
      visit(cx - quarter, cz + quarter, half, depth + 1);
      visit(cx + quarter, cz + quarter, half, depth + 1);
    }
    visit(0, 0, rootSize, 0);

    const epsilon = rootSize * 1e-10 + 1e-9;
    let balanced = false;
    while (!balanced) {
      balanced = true;
      balanceSearch: for (let i = 0; i < leaves.length; i++) {
        const a = leaves[i]!;
        for (let j = i + 1; j < leaves.length; j++) {
          const b = leaves[j]!;
          const reach = (a.size + b.size) * 0.5;
          const dx = Math.abs(a.cx - b.cx);
          const dz = Math.abs(a.cz - b.cz);
          const sharesVerticalEdge = Math.abs(dx - reach) <= epsilon && dz < reach - epsilon;
          const sharesHorizontalEdge = Math.abs(dz - reach) <= epsilon && dx < reach - epsilon;
          if (!sharesVerticalEdge && !sharesHorizontalEdge) continue;
          const largerIndex = a.size > b.size * 2 + epsilon ? i : b.size > a.size * 2 + epsilon ? j : -1;
          if (largerIndex < 0) continue;
          const larger = leaves[largerIndex]!;
          const half = larger.size * 0.5;
          if (half < minSize) continue;
          leaves.splice(largerIndex, 1);
          const quarter = larger.size * 0.25;
          leaves.push(
            { cx: larger.cx - quarter, cz: larger.cz - quarter, size: half, cells },
            { cx: larger.cx + quarter, cz: larger.cz - quarter, size: half, cells },
            { cx: larger.cx - quarter, cz: larger.cz + quarter, size: half, cells },
            { cx: larger.cx + quarter, cz: larger.cz + quarter, size: half, cells },
          );
          balanced = false;
          break balanceSearch;
        }
      }
    }
    if (leaves.length * rootTriangles <= o.budget) return leaves;
  }
  return [{ cx: 0, cz: 0, size: rootSize, cells }];
}
