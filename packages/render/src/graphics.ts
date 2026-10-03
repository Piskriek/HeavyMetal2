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
}

export const GRAPHICS_TIERS: Readonly<Record<Quality, GraphicsSettings>> = {
  low: { pictureSize: 720, sharpness: 1, supersample: false, effects: false, glow: false, contactShadows: false, contactShadowSamples: 8, smoothEdges: false, shadows: 'off', reflections: false, simpleLighting: true, plantDetail: 18, skipHiddenPlants: true, simpleSea: true },
  medium: { pictureSize: 0, sharpness: 1.5, supersample: false, effects: true, glow: true, contactShadows: false, contactShadowSamples: 8, smoothEdges: false, shadows: 'on', reflections: true, simpleLighting: false, plantDetail: 35, skipHiddenPlants: false, simpleSea: false },
  high: { pictureSize: 0, sharpness: 2, supersample: false, effects: true, glow: true, contactShadows: true, contactShadowSamples: 12, smoothEdges: true, shadows: 'detailed', reflections: true, simpleLighting: false, plantDetail: 70, skipHiddenPlants: false, simpleSea: false },
  ultra: { pictureSize: 0, sharpness: 2, supersample: true, effects: true, glow: true, contactShadows: true, contactShadowSamples: 16, smoothEdges: true, shadows: 'finest', reflections: true, simpleLighting: false, plantDetail: 0, skipHiddenPlants: false, simpleSea: false },
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
