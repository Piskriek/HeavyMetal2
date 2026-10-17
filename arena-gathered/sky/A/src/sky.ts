export type Vec3 = readonly [number, number, number];

export const SKY_ROWS = 64;

const PI = Math.PI;
const RAYLEIGH: Vec3 = [5.8e-6, 13.5e-6, 33.1e-6];
const MIE = 2.1e-5;
const RAYLEIGH_HEIGHT = 8000;
const MIE_HEIGHT = 1200;
const SUN_IRRADIANCE = 20;
const STEPS = 10;
const AZIMUTH_SAMPLES = 16;
const G = 0.76;

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

function unit(v: Vec3): [number, number, number] {
  const x = finite(v[0]);
  const y = finite(v[1]);
  const z = finite(v[2]);
  const length = Math.sqrt(x * x + y * y + z * z);
  if (!(length > 1e-12)) return [0, 1, 0];
  return [x / length, y / length, z / length];
}

// Kasten-Young's relative optical airmass remains finite at the horizon.
function airMass(sineElevation: number): number {
  const sine = clamp(finite(sineElevation), 0, 1);
  const degrees = Math.asin(sine) * (180 / PI);
  return 1 / (sine + 0.50572 * Math.pow(degrees + 6.07995, -1.6364));
}

function bounded(value: number): number {
  return clamp(finite(value), 0, 10);
}

export function density(stage: number): number {
  const t = clamp((finite(stage) - 2) / 2.5, 0, 1);
  return t * t * (3 - 2 * t);
}

export function skyAt(dir: Vec3, sunDir: Vec3, stage: number): [number, number, number] {
  const amount = density(stage);
  if (amount === 0) return [0, 0, 0];

  const view = unit(dir);
  if (view[1] < 0) return [0, 0, 0];
  const sun = unit(sunDir);

  const viewMass = airMass(view[1]);
  const effectiveViewSine = 1 / viewMass;
  const sunSine = Math.max(0, sun[1]);
  const sunMass = airMass(sunSine);
  const twilight = sun[1] < 0
    ? Math.exp(Math.asin(clamp(sun[1], -1, 0)) * (180 / PI) / 2.5)
    : 1;

  const cosine = clamp(view[0] * sun[0] + view[1] * sun[1] + view[2] * sun[2], -1, 1);
  const rayleighPhase = (3 / (16 * PI)) * (1 + cosine * cosine);
  const hgBase = Math.max(1e-5, 1 + G * G - 2 * G * cosine);
  const miePhase = (1 - G * G) / (4 * PI * Math.pow(hgBase, 1.5));

  let red = 0;
  let green = 0;
  let blue = 0;

  // The transformed coordinate concentrates samples where both density profiles change fastest.
  for (let step = 0; step < STEPS; step += 1) {
    const u = (step + 0.5) / STEPS;
    const oneMinus = 1 - 0.9997 * u;
    const height = -RAYLEIGH_HEIGHT * Math.log(oneMinus);
    const dh = (RAYLEIGH_HEIGHT * 0.9997 / oneMinus) / STEPS;
    const ds = dh / effectiveViewSine;
    const rayDensity = Math.exp(-height / RAYLEIGH_HEIGHT);
    const mieDensity = Math.exp(-height / MIE_HEIGHT);

    const viewRayColumn = RAYLEIGH_HEIGHT * (1 - rayDensity) * viewMass;
    const viewMieColumn = MIE_HEIGHT * (1 - mieDensity) * viewMass;
    const sunRayColumn = RAYLEIGH_HEIGHT * rayDensity * sunMass;
    const sunMieColumn = MIE_HEIGHT * mieDensity * sunMass;
    const greyOpticalDepth = amount * MIE * (viewMieColumn + sunMieColumn);

    const rayWeight = amount * rayDensity * ds * rayleighPhase;
    const mieWeight = amount * mieDensity * ds * miePhase;

    const scatterR = RAYLEIGH[0] * rayWeight + MIE * mieWeight;
    const scatterG = RAYLEIGH[1] * rayWeight + MIE * mieWeight;
    const scatterB = RAYLEIGH[2] * rayWeight + MIE * mieWeight;

    red += Math.exp(-greyOpticalDepth - amount * RAYLEIGH[0] * (viewRayColumn + sunRayColumn)) * scatterR;
    green += Math.exp(-greyOpticalDepth - amount * RAYLEIGH[1] * (viewRayColumn + sunRayColumn)) * scatterG;
    blue += Math.exp(-greyOpticalDepth - amount * RAYLEIGH[2] * (viewRayColumn + sunRayColumn)) * scatterB;
  }

  const energy = SUN_IRRADIANCE * twilight;
  return [bounded(red * energy), bounded(green * energy), bounded(blue * energy)];
}

export function skyGradient(sunDir: Vec3, stage: number, out: Float32Array): void {
  for (let row = 0; row < SKY_ROWS; row += 1) {
    const elevation = (PI * 0.5) * (1 - row / (SKY_ROWS - 1));
    const y = Math.sin(elevation);
    const radius = Math.cos(elevation);
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let sample = 0; sample < AZIMUTH_SAMPLES; sample += 1) {
      const azimuth = (2 * PI * sample) / AZIMUTH_SAMPLES;
      const colour = skyAt([radius * Math.sin(azimuth), y, radius * Math.cos(azimuth)], sunDir, stage);
      red += colour[0];
      green += colour[1];
      blue += colour[2];
    }
    const offset = row * 3;
    out[offset] = red / AZIMUTH_SAMPLES;
    out[offset + 1] = green / AZIMUTH_SAMPLES;
    out[offset + 2] = blue / AZIMUTH_SAMPLES;
  }
}

export function sunColour(sunDir: Vec3, stage: number): [number, number, number] {
  const amount = density(stage);
  if (amount === 0) return [1, 1, 1];
  const sun = unit(sunDir);
  const mass = airMass(Math.max(0, sun[1]));
  const rayColumn = RAYLEIGH_HEIGHT * mass * amount * 0.8;
  const mieOpticalDepth = MIE * MIE_HEIGHT * mass * amount;
  const red = Math.exp(-RAYLEIGH[0] * rayColumn - mieOpticalDepth);
  const green = Math.exp(-RAYLEIGH[1] * rayColumn - mieOpticalDepth);
  const blue = Math.exp(-RAYLEIGH[2] * rayColumn - mieOpticalDepth);
  const maximum = Math.max(red, green, blue, 1e-12);
  return [bounded(red / maximum), bounded(green / maximum), bounded(blue / maximum)];
}

export function bakeSkyLut(
  sunDir: Vec3,
  stage: number,
  w: number,
  h: number,
  out: Float32Array,
): void {
  const width = Math.max(0, Math.floor(finite(w)));
  const height = Math.max(0, Math.floor(finite(h)));
  const sun = unit(sunDir);
  const horizontalLength = Math.sqrt(sun[0] * sun[0] + sun[2] * sun[2]);
  const sunAzimuth = horizontalLength > 1e-12 ? Math.atan2(sun[0], sun[2]) : 0;

  for (let row = 0; row < height; row += 1) {
    const rowFraction = height > 1 ? row / (height - 1) : 0;
    const elevation = (PI * 0.5) * (1 - rowFraction);
    const y = Math.sin(elevation);
    const radius = Math.cos(elevation);
    for (let column = 0; column < width; column += 1) {
      const columnFraction = width > 0 ? column / width : 0;
      const azimuth = sunAzimuth + 2 * PI * columnFraction;
      const colour = skyAt([radius * Math.sin(azimuth), y, radius * Math.cos(azimuth)], sun, stage);
      const offset = (row * width + column) * 3;
      out[offset] = colour[0];
      out[offset + 1] = colour[1];
      out[offset + 2] = colour[2];
    }
  }
}