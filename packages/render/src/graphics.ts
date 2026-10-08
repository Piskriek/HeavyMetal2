import { defineSchema, type Params, type Value } from '@hm/contracts';
import type { Quality, QualitySpec } from '@hm/lighting';

/**
 * Everything a graphics tier decides, as one flat preset (kind `graphics`): Low, Medium, High and Ultra are ready-made ones, and Settings
 * lets you change any value on top of whichever tier is drawing (auto included). Everything is a preset (owner, 2026-10-03), even this.
 */
export interface GraphicsSettings {
  /** The most lines drawn on the short side of the screen (720 = 720p); the browser stretches the picture to the screen. 0 = all the screen has. */
  readonly pictureSize: number;
  /** Most pixels drawn per screen pixel (the pixel ratio cap; 2 = twice as sharp on high-resolution screens). */
  readonly sharpness: number;
  /** Draw at least 1.5 pixels per screen pixel even on ordinary screens (smoother, slow). */
  readonly supersample: boolean;
  /** The picture-effects pass: colour grading, vignette, and glow / contact shadows / smooth edges below. */
  readonly effects: boolean;
  readonly glow: boolean;
  readonly contactShadows: boolean;
  readonly contactShadowSamples: number;
  readonly smoothEdges: boolean;
  /** Sun shadows: off, or a shadow map of 1024 / 2048 / 4096. */
  readonly shadows: 'off' | 'on' | 'detailed' | 'finest';
  readonly reflections: boolean;
  /** Plain diffuse lighting for the matte flat ground and plants. */
  readonly simpleLighting: boolean;
  /** Plants nearer than this (metres) show every voxel, further ones a coarser copy. 0 = every voxel everywhere. */
  readonly plantDetail: number;
  /** Plants out of view are not drawn (only while shadows are off: a plant behind you can throw its shadow into view). */
  readonly skipHiddenPlants: boolean;
  /** Foam without the ripples that break it up, and the sea shows the sky by angle instead of reflecting it. */
  readonly simpleSea: boolean;
  /** Plants further than this (metres) are not drawn at all. 0 = every plant. */
  readonly plantDistance: number;
  /** Clouds drifting across the sky. */
  readonly clouds: boolean;
  /** Show the flat block ground even when the island is set to PBR (the PBR ground is the heaviest thing to draw). */
  readonly flatGround: boolean;
  /** The voxel ground blends two surfaces pixel by pixel (a dither) within this many metres of you; further away each block shows one. 0 = everywhere. */
  readonly ditherDistance: number;
  /**
   * How the pixels pouring from SetMix's machines are drawn (`@hm/plume`): little 3D cubes tumbling as they rise, soft glowing splats,
   * or square dithered sprites, the cheapest; or none (the machines still work). No tier turns them off (STATUS SM25). Cubes from Low up:
   * at stage 1's 240 lines they read best and cost little (a mill's 220 are 2 640 triangles in one draw call, 60 fps on the laptop); splats
   * are a few soft pixels there, the faintest. Potato draws sprites.
   */
  readonly pixelPlumes: 'cubes' | 'splats' | 'dither' | 'off';
  /** How many pixels pour from each machine, against the plume as made (1). */
  readonly plumeDensity: number;
  /** A soft coloured glow on the ground under each pouring machine (on for High and Ultra, off for Low and Medium). */
  readonly plumeGlow: boolean;
  /** Pouring pixels light their surroundings with dynamic coloured point lights (Ultra only). */
  readonly pixelLights: boolean;
}

export const GRAPHICS_TIERS: Readonly<Record<Quality, GraphicsSettings>> = {
  potato: { pictureSize: 480, sharpness: 1, supersample: false, effects: false, glow: false, contactShadows: false, contactShadowSamples: 4, smoothEdges: false, shadows: 'off', reflections: false, simpleLighting: true, plantDetail: 10, skipHiddenPlants: true, simpleSea: true, plantDistance: 60, clouds: false, flatGround: true, ditherDistance: 20, pixelPlumes: 'dither', plumeDensity: 0.5, plumeGlow: false, pixelLights: false },
  low: { pictureSize: 720, sharpness: 1, supersample: false, effects: false, glow: false, contactShadows: false, contactShadowSamples: 8, smoothEdges: false, shadows: 'off', reflections: false, simpleLighting: true, plantDetail: 18, skipHiddenPlants: true, simpleSea: true, plantDistance: 0, clouds: true, flatGround: false, ditherDistance: 30, pixelPlumes: 'cubes', plumeDensity: 0.75, plumeGlow: false, pixelLights: false },
  medium: { pictureSize: 0, sharpness: 1.5, supersample: false, effects: true, glow: true, contactShadows: false, contactShadowSamples: 8, smoothEdges: false, shadows: 'on', reflections: true, simpleLighting: false, plantDetail: 35, skipHiddenPlants: false, simpleSea: false, plantDistance: 0, clouds: true, flatGround: false, ditherDistance: 45, pixelPlumes: 'cubes', plumeDensity: 1, plumeGlow: false, pixelLights: false },
  high: { pictureSize: 0, sharpness: 2, supersample: false, effects: true, glow: true, contactShadows: true, contactShadowSamples: 12, smoothEdges: true, shadows: 'detailed', reflections: true, simpleLighting: false, plantDetail: 70, skipHiddenPlants: false, simpleSea: false, plantDistance: 0, clouds: true, flatGround: false, ditherDistance: 60, pixelPlumes: 'cubes', plumeDensity: 1.5, plumeGlow: true, pixelLights: false },
  ultra: { pictureSize: 0, sharpness: 2, supersample: true, effects: true, glow: true, contactShadows: true, contactShadowSamples: 16, smoothEdges: true, shadows: 'finest', reflections: true, simpleLighting: false, plantDetail: 0, skipHiddenPlants: false, simpleSea: false, plantDistance: 0, clouds: true, flatGround: false, ditherDistance: 0, pixelPlumes: 'cubes', plumeDensity: 2, plumeGlow: true, pixelLights: true },
};

const SHADOW_SIZE: Readonly<Record<GraphicsSettings['shadows'], number>> = { off: 0, on: 1024, detailed: 2048, finest: 4096 };
/** Shadow map size in texels (0 = no shadows). */
export const shadowMapSize = (g: GraphicsSettings): number => SHADOW_SIZE[g.shadows];
/** Plants out of view are skipped only when they cannot cast shadows into view. */
export const plantsCulled = (g: GraphicsSettings): boolean => g.skipHiddenPlants && g.shadows === 'off';
/** The picture-effects pass's view of the settings. */
export const qualitySpecOf = (g: GraphicsSettings): QualitySpec => ({ label: 'Custom', pixelRatio: g.sharpness, shadowMap: shadowMapSize(g), ssao: g.contactShadows, bloom: g.glow, aoSamples: g.contactShadowSamples });

export const graphicsSchema = defineSchema({
  kind: 'graphics', version: 1, label: 'Graphics',
  doc: 'How the world is drawn. Low, Medium, High and Ultra are ready-made; change anything here and it is used on top of whichever one is drawing.',
  slots: [],
  variables: [
    { key: 'pictureSize', type: 'int', label: 'Picture size', doc: 'The most lines drawn, counted on the short side of the screen (720 is 720p). The picture is stretched to fill the screen. 0 draws every pixel the screen has.', tier: 'play', default: 0, min: 0, max: 2160, step: 1, hardMin: 0, unit: 'p', group: 'Picture' },
    { key: 'sharpness', type: 'number', label: 'Sharpness', doc: 'The most pixels drawn for each pixel of the screen. 2 is twice as sharp on high-resolution screens and four times the work.', tier: 'play', default: 2, min: 0.5, max: 2, step: 0.05, hardMin: 0.25, hardMax: 3, group: 'Picture' },
    { key: 'supersample', type: 'boolean', label: 'Supersample', doc: 'Draw at least one and a half pixels for every pixel of the screen, for smoother edges. Slow.', tier: 'play', default: false, group: 'Picture' },
    { key: 'effects', type: 'boolean', label: 'Picture effects', doc: 'Colour grading and vignette, and the glow, contact shadows and smooth edges below.', tier: 'play', default: true, group: 'Effects' },
    { key: 'glow', type: 'boolean', label: 'Glow', doc: 'Bright things glow, like lava and the sun on the sea.', tier: 'play', default: true, group: 'Effects' },
    { key: 'contactShadows', type: 'boolean', label: 'Contact shadows', doc: 'Soft dark corners where things touch the ground and each other.', tier: 'play', default: true, group: 'Effects' },
    { key: 'contactShadowSamples', type: 'int', label: 'Contact shadow quality', doc: 'How many points each contact shadow looks at. More is smoother and slower.', tier: 'play', default: 12, min: 4, max: 16, step: 1, hardMin: 2, hardMax: 32, group: 'Effects' },
    { key: 'smoothEdges', type: 'boolean', label: 'Smooth edges', doc: 'Smooth the jagged edges of everything (needs picture effects).', tier: 'play', default: true, group: 'Effects' },
    { key: 'shadows', type: 'enum', label: 'Shadows', doc: 'Shadows from the sun. Detailed and finest are sharper and slower.', tier: 'play', default: 'detailed', options: ['off', 'on', 'detailed', 'finest'], group: 'Light' },
    { key: 'reflections', type: 'boolean', label: 'Sky reflections', doc: 'Shiny things reflect the sky. Off, the sky still lights everything, just without the shine.', tier: 'play', default: true, group: 'Light' },
    { key: 'simpleLighting', type: 'boolean', label: 'Simple lighting', doc: 'The flat ground and the plants use plain lighting. They are matte, so they look almost the same.', tier: 'play', default: false, group: 'Light' },
    { key: 'plantDetail', type: 'number', label: 'Full-detail plants within', doc: 'Plants nearer than this show every block; further ones show a coarser copy. 0 shows every block everywhere.', tier: 'play', default: 70, min: 0, max: 150, step: 1, hardMin: 0, unit: 'm', group: 'World' },
    { key: 'skipHiddenPlants', type: 'boolean', label: 'Skip plants out of view', doc: 'Plants behind you are not drawn. Only while shadows are off, because their shadows could still show.', tier: 'play', default: false, group: 'World' },
    { key: 'simpleSea', type: 'boolean', label: 'Simple sea', doc: 'Foam rolls in without the ripples that break it up.', tier: 'play', default: false, group: 'World' },
    { key: 'plantDistance', type: 'number', label: 'Plants drawn within', doc: 'Plants further away than this are not drawn at all. 0 draws every plant.', tier: 'play', default: 0, min: 0, max: 300, step: 5, hardMin: 0, unit: 'm', group: 'World' },
    { key: 'clouds', type: 'boolean', label: 'Clouds', doc: 'Clouds drift across the sky.', tier: 'play', default: true, group: 'World' },
    { key: 'ditherDistance', type: 'number', label: 'Dither distance', doc: 'How far from you the voxel ground blends two surfaces pixel by pixel. Further away each block shows one surface. 0 blends everywhere (far away it can shimmer).', tier: 'play', default: 45, min: 0, max: 200, step: 1, hardMin: 0, unit: 'm', group: 'World' },
    { key: 'flatGround', type: 'boolean', label: 'Always flat ground', doc: 'Show the flat block ground even when the island is set to PBR. The PBR ground is the heaviest thing to draw.', tier: 'play', default: false, group: 'World' },
    { key: 'pixelPlumes', type: 'enum', label: 'Pixel plumes', doc: 'How the pixels that pour from machines are drawn. Cubes are little blocks that tumble as they rise; splats are soft glowing dots; dither draws square pixels, the cheapest. Off hides them; the machines still work.', tier: 'play', default: 'cubes', options: ['cubes', 'splats', 'dither', 'off'], group: 'Machines' },
    { key: 'plumeDensity', type: 'number', label: 'Plume density', doc: 'How many pixels pour from each machine. 1 is the plume as made, 2 twice as many.', tier: 'play', default: 1.5, min: 0.25, max: 2, step: 0.05, hardMin: 0.1, hardMax: 4, group: 'Machines' },
    { key: 'plumeGlow', type: 'boolean', label: 'Plume ground glow', doc: 'A soft coloured glow on the ground under each pouring machine.', tier: 'play', default: true, group: 'Machines' },
    { key: 'pixelLights', type: 'boolean', label: 'Ultra pixel lighting', doc: 'Pouring pixels light their surroundings with dynamic coloured point lights (Ultra only).', tier: 'play', default: true, group: 'Machines' },
  ],
});

const KEYS = Object.keys(GRAPHICS_TIERS.low) as (keyof GraphicsSettings)[];

/** A tier with your own changes on top. Junk is ignored: a value of the wrong type, a number out of its hard limits, an unknown shadow. */
export function resolveGraphics(tier: Quality, own: Params | null | undefined): GraphicsSettings {
  const base = GRAPHICS_TIERS[tier];
  if (!own) return base;
  const out: Record<string, Value> = { ...base };
  for (const key of KEYS) {
    const v = own[key];
    const def = graphicsSchema.variables.find((d) => d.key === key)!;
    const was = base[key];
    if (typeof was === 'boolean') { if (typeof v === 'boolean') out[key] = v; continue; }
    if (typeof was === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if ((def.hardMin !== undefined && v < def.hardMin) || (def.hardMax !== undefined && v > def.hardMax)) continue;
      out[key] = def.type === 'int' ? Math.round(v) : v;
      continue;
    }
    if (typeof v === 'string' && def.options?.includes(v)) out[key] = v;
  }
  return out as unknown as GraphicsSettings;
}
