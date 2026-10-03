/**
 * A lighting setup: everything that makes a place look the way it does at a moment, as one plain value (the `light-setup` preset kind).
 * Units: colours are #rrggbb strings in sRGB; angles in degrees; intensities in three.js light units (sun 0..8, hemisphere 0..3);
 * distances in metres; the sun azimuth is compass-style (0 = +Z, 90 = +X) and the elevation is above the horizon (negative = below).
 * The shape follows the Light Lab prototype written by an Arena model; the lamp anchors are ours (the prototype used absolute world positions).
 */

export type ToneMappingName = 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces' | 'agx' | 'neutral';
export const TONE_MAPPINGS: readonly ToneMappingName[] = ['none', 'linear', 'reinhard', 'cineon', 'aces', 'agx', 'neutral'];

/** Where a lamp sits: on a named prop in the scene when the scene has one, otherwise near the point of interest. */
export type LampAnchor = 'focus' | 'lantern' | 'torch' | 'campfire' | 'barrel';
export const LAMP_ANCHORS: readonly LampAnchor[] = ['focus', 'lantern', 'torch', 'campfire', 'barrel'];

export type Vec3 = [number, number, number];

export interface Lamp {
  type: 'point' | 'spot';
  color: string;
  intensity: number;
  anchor: LampAnchor;
  /** Metres from the anchor (x east, y up, z south). */
  offset: Vec3;
  distance: number;
}

export interface LightSetup {
  id: string;
  name: string;
  sun: { color: string; intensity: number; azimuthDeg: number; elevationDeg: number; shadowSoftness: number; shadowMapSize: number };
  hemi: { sky: string; ground: string; intensity: number };
  ambient: { color: string; intensity: number };
  /** A second directional light with no shadow, placed in metres from the point of interest. */
  fill?: { color: string; intensity: number; position: Vec3 };
  /** At most 4 point lamps and 2 spot lamps are used; extras are ignored. */
  extraLights?: Lamp[];
  /** `clouds`: how much of the sky is cloud, 0 (clear) to 1 (overcast); a normalised setup always has it. */
  sky: { top: string; horizon: string; bottom: string; sunGlow: number; clouds?: number };
  fog: { color: string; density: number };
  water: { color: string; opacity: number; roughness: number };
  toneMapping: ToneMappingName;
  exposure: number;
  post: {
    bloom: { strength: number; radius: number; threshold: number };
    vignette: { darkness: number; offset: number };
    saturation: number;
    contrast: number;
    /** Colour grade: #808080 is neutral. */
    lift: string;
    gamma: string;
    gain: string;
    ssao: { enabled: boolean; radius: number; intensity: number };
    fxaa: boolean;
    grain: number;
    /** Posterise levels per channel, 0 = off. */
    posterize: number;
  };
}

/**
 * Render quality tiers, lightest first. The tier caps what a setup may ask for; it never changes what the setup says. `calculator` is the
 * lightest the game can be (owner, 2026-10-03: "scale down to the calculator version with the click of a preset button").
 */
export type Quality = 'calculator' | 'low' | 'medium' | 'high' | 'ultra';
export const QUALITIES: readonly Quality[] = ['calculator', 'low', 'medium', 'high', 'ultra'];
export interface QualitySpec { label: string; pixelRatio: number; shadowMap: number; ssao: boolean; bloom: boolean; aoSamples: number }
export const QUALITY: Readonly<Record<Quality, QualitySpec>> = {
  calculator: { label: 'Calculator', pixelRatio: 0.5, shadowMap: 0, ssao: false, bloom: false, aoSamples: 4 },
  low: { label: 'Low', pixelRatio: 0.75, shadowMap: 1024, ssao: false, bloom: false, aoSamples: 8 },
  medium: { label: 'Medium', pixelRatio: 1, shadowMap: 2048, ssao: false, bloom: true, aoSamples: 8 },
  high: { label: 'High', pixelRatio: 1.5, shadowMap: 2048, ssao: true, bloom: true, aoSamples: 12 },
  ultra: { label: 'Ultra', pixelRatio: 2, shadowMap: 4096, ssao: true, bloom: true, aoSamples: 16 },
};
