export interface LookParams {
  skyZenith: string; skyHorizon: string; skyGround: string;      // sky gradient colours (hex)
  sunElevation: number;    // degrees above the horizon, -20..90 (negative = below)
  sunAzimuth: number;      // degrees clockwise seen from above, 0 = north (-Z), 90 = east (+X)
  sunKelvin: number;       // colour temperature 1500..12000
  sunIntensity: number;    // 0..8
  ambientIntensity: number; ambientSky: string; ambientGround: string;   // 0..3, hex
  fogColor: string; fogDensity: number;   // exp2 density 0..0.05
  exposure: number;        // 0.3..2
  bloom: number;           // 0..1.5
  saturation: number;      // 0..1.5 (1 = unchanged)
  contrast: number;        // 0.6..1.6 (1 = unchanged)
  vignette: number;        // 0..1
  waterColor: string; waterOpacity: number;   // 0..1
  cloudCover: number;      // 0..1
}

export interface LookPreset {
  id: string;
  name: string;
  tags: string[];
  doc: string;
  params: LookParams;
}

export type Vec3 = readonly [number, number, number];

export const LOOK_NUMBER_KEYS: readonly (keyof LookParams)[] = [
  'sunElevation',
  'sunAzimuth',
  'sunKelvin',
  'sunIntensity',
  'ambientIntensity',
  'fogDensity',
  'exposure',
  'bloom',
  'saturation',
  'contrast',
  'vignette',
  'waterOpacity',
  'cloudCover'
] as const;

export const LOOK_COLOR_KEYS: readonly (keyof LookParams)[] = [
  'skyZenith',
  'skyHorizon',
  'skyGround',
  'ambientSky',
  'ambientGround',
  'fogColor',
  'waterColor'
] as const;

export const LOOK_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  sunElevation: [-20, 90],
  sunAzimuth: [0, 360],
  sunKelvin: [1500, 12000],
  sunIntensity: [0, 8],
  ambientIntensity: [0, 3],
  fogDensity: [0, 0.05],
  exposure: [0.3, 2],
  bloom: [0, 1.5],
  saturation: [0, 1.5],
  contrast: [0.6, 1.6],
  vignette: [0, 1],
  waterOpacity: [0, 1],
  cloudCover: [0, 1]
} as const;
