import type { VariableDef } from '@hm/contracts';
import { DEFAULT_SETUP, LIGHT_RANGES, normalizeSetup } from './normalize';
import { LAMP_ANCHORS, TONE_MAPPINGS, type Lamp, type LightSetup } from './types';

/**
 * The flat form of a setup: one named value per knob, which is what a preset stores and what the generic editor shows.
 * `setupToParams` and `paramsToSetup` are inverses (a legal setup survives the round trip unchanged), and LIGHT_VARIABLES describes every knob
 * (label, help text, range, tier) so the `light-setup` preset kind gets its editor for free.
 */
export type LightParams = Record<string, number | string | boolean>;
export const LAMP_SLOTS = 6;
const SHADOW_SIZES = ['512', '1024', '2048', '4096'] as const;

type Tier = VariableDef['tier'];
const d = DEFAULT_SETUP;
const R = LIGHT_RANGES;

const num = (key: string, label: string, doc: string, def: number, tier: Tier, group: string, range: readonly [number, number], step: number, unit?: string): VariableDef =>
  ({ key, type: 'number', label, doc, tier, default: def, min: range[0], max: range[1], step, group, ...(unit ? { unit } : {}) });
const colour = (key: string, label: string, doc: string, def: string, tier: Tier, group: string): VariableDef => ({ key, type: 'color', label, doc, tier, default: def, group });
const flag = (key: string, label: string, doc: string, def: boolean, tier: Tier, group: string): VariableDef => ({ key, type: 'boolean', label, doc, tier, default: def, group });
const choice = (key: string, label: string, doc: string, def: string, options: readonly string[], tier: Tier, group: string): VariableDef => ({ key, type: 'enum', label, doc, tier, default: def, options, group });

function lampVars(i: number): VariableDef[] {
  const k = `lamp${i}`, g = `Lamp ${i}`;
  return [
    flag(`${k}On`, 'On', 'Switch this lamp on.', false, 'build', g),
    choice(`${k}Kind`, 'Kind', 'point lights all round, spot makes a cone.', 'point', ['point', 'spot'], 'build', g),
    colour(`${k}Color`, 'Colour', 'The colour of the light.', '#ffb066', 'build', g),
    num(`${k}Intensity`, 'Brightness', 'How bright the lamp is.', 6, 'build', g, R.lampIntensity, 0.5),
    choice(`${k}Anchor`, 'Sits on', 'A prop in the scene to hang the lamp on (lantern, torch, campfire, barrel), or the point of interest when the scene has none.', 'focus', LAMP_ANCHORS, 'build', g),
    num(`${k}X`, 'East', 'Metres east of where it sits.', 0, 'pro', g, R.lampOffset, 0.1, 'm'),
    num(`${k}Y`, 'Up', 'Metres above where it sits.', 0, 'pro', g, R.lampOffset, 0.1, 'm'),
    num(`${k}Z`, 'South', 'Metres south of where it sits.', 0, 'pro', g, R.lampOffset, 0.1, 'm'),
    num(`${k}Distance`, 'Reach', 'How far the light carries.', 8, 'build', g, R.lampDistance, 0.5, 'm'),
  ];
}

export const LIGHT_VARIABLES: readonly VariableDef[] = [
  colour('sunColor', 'Sun colour', 'Warm at sunrise and sunset, white at noon, blue for moonlight.', d.sun.color, 'play', 'Sun'),
  num('sunIntensity', 'Sun strength', 'How strong the direct light is. Above 5 starts to wash colours out.', d.sun.intensity, 'play', 'Sun', R.sunIntensity, 0.05),
  num('sunAzimuth', 'Sun direction', 'Compass direction the sun shines from, in degrees.', d.sun.azimuthDeg, 'play', 'Sun', [0, 360], 1, 'deg'),
  num('sunElevation', 'Sun height', 'How high the sun is above the horizon. Below 0 it is under the ground.', d.sun.elevationDeg, 'play', 'Sun', R.sunElevation, 1, 'deg'),
  num('sunSoftness', 'Shadow softness', 'Sharp shadows at 0, soft edges when high.', d.sun.shadowSoftness, 'build', 'Sun', R.sunSoftness, 0.1),
  choice('sunShadowMap', 'Shadow detail', 'Bigger shadow maps give crisper shadows and cost more.', String(d.sun.shadowMapSize), SHADOW_SIZES, 'pro', 'Sun'),
  colour('hemiSky', 'Sky light', 'Colour of the light that comes from above.', d.hemi.sky, 'build', 'Ambient light'),
  colour('hemiGround', 'Ground bounce', 'Colour of the light that bounces up from the ground.', d.hemi.ground, 'build', 'Ambient light'),
  num('hemiIntensity', 'Sky light strength', 'How strong the sky and ground light is.', d.hemi.intensity, 'build', 'Ambient light', R.hemiIntensity, 0.01),
  colour('ambientColor', 'Fill colour', 'Colour of the flat light that reaches every surface.', d.ambient.color, 'pro', 'Ambient light'),
  num('ambientIntensity', 'Fill strength', 'How much flat light reaches the shadows.', d.ambient.intensity, 'pro', 'Ambient light', R.ambientIntensity, 0.01),
  flag('fillOn', 'Back light', 'A second light from the side that lifts the shadows.', false, 'build', 'Back light'),
  colour('fillColor', 'Colour', 'Colour of the back light.', '#ffffff', 'build', 'Back light'),
  num('fillIntensity', 'Strength', 'How strong the back light is.', 0.3, 'build', 'Back light', R.fillIntensity, 0.01),
  num('fillX', 'East', 'Metres east of the point of interest.', -8, 'pro', 'Back light', R.fillPosition, 0.5, 'm'),
  num('fillY', 'Up', 'Metres above the point of interest.', 6, 'pro', 'Back light', R.fillPosition, 0.5, 'm'),
  num('fillZ', 'South', 'Metres south of the point of interest.', 8, 'pro', 'Back light', R.fillPosition, 0.5, 'm'),
  ...Array.from({ length: LAMP_SLOTS }, (_, i) => lampVars(i + 1)).flat(),
  colour('skyTop', 'Sky top', 'Colour straight up.', d.sky.top, 'play', 'Sky'),
  colour('skyHorizon', 'Sky horizon', 'Colour at the horizon.', d.sky.horizon, 'play', 'Sky'),
  colour('skyBottom', 'Below the horizon', 'Colour of the sky under the horizon, seen from high up.', d.sky.bottom, 'build', 'Sky'),
  num('skyGlow', 'Sun glow', 'The halo around the sun.', d.sky.sunGlow, 'build', 'Sky', R.sunGlow, 0.05),
  colour('fogColor', 'Haze colour', 'Colour things fade into with distance.', d.fog.color, 'build', 'Haze'),
  num('fogDensity', 'Haze', 'How quickly things fade into the haze.', d.fog.density, 'build', 'Haze', R.fogDensity, 0.0005),
  colour('waterColor', 'Water colour', 'Colour of the sea.', d.water.color, 'build', 'Water'),
  num('waterOpacity', 'Water clarity', 'Low is see-through, high is solid colour.', d.water.opacity, 'build', 'Water', R.waterOpacity, 0.01),
  num('waterRoughness', 'Water ripple', 'Low is a mirror, high is dull.', d.water.roughness, 'build', 'Water', R.waterRoughness, 0.01),
  choice('toneMapping', 'Film response', 'How bright light is squeezed onto the screen. aces is punchy, agx is soft, neutral keeps colours true.', d.toneMapping, TONE_MAPPINGS, 'build', 'Camera'),
  num('exposure', 'Exposure', 'Overall brightness.', d.exposure, 'play', 'Camera', R.exposure, 0.01),
  num('bloomStrength', 'Glow', 'Bright things bleed light.', d.post.bloom.strength, 'play', 'Effects', R.bloomStrength, 0.01),
  num('bloomRadius', 'Glow spread', 'How far the glow spreads.', d.post.bloom.radius, 'pro', 'Effects', R.bloomRadius, 0.01),
  num('bloomThreshold', 'Glow starts at', 'Only things brighter than this glow.', d.post.bloom.threshold, 'pro', 'Effects', R.bloomThreshold, 0.01),
  num('vignetteDarkness', 'Dark corners', 'Darken the edges of the screen.', d.post.vignette.darkness, 'build', 'Effects', R.vignetteDarkness, 0.01),
  num('vignetteOffset', 'Corner reach', 'How far in from the edge the darkening starts.', d.post.vignette.offset, 'pro', 'Effects', R.vignetteOffset, 0.01),
  flag('aoOn', 'Contact shadows', 'Soft shadows in creases and where things touch.', d.post.ssao.enabled, 'play', 'Effects'),
  num('aoRadius', 'Contact shadow size', 'How wide the creases shade.', d.post.ssao.radius, 'pro', 'Effects', R.ssaoRadius, 0.05, 'm'),
  num('aoIntensity', 'Contact shadow strength', 'How dark the creases get.', d.post.ssao.intensity, 'build', 'Effects', R.ssaoIntensity, 0.05),
  flag('antialias', 'Smooth edges', 'Soften jagged edges.', d.post.fxaa, 'build', 'Effects'),
  num('grain', 'Film grain', 'A fine speckle over the picture.', d.post.grain, 'build', 'Effects', R.grain, 0.001),
  num('posterize', 'Flat colour steps', 'Cartoon look: fewer colour steps per channel. 0 is off.', d.post.posterize, 'build', 'Effects', R.posterize, 1),
  num('saturation', 'Colour', '1 is natural, 0 is black and white, above 1 is vivid.', d.post.saturation, 'play', 'Grade', R.saturation, 0.01),
  num('contrast', 'Contrast', '1 is natural.', d.post.contrast, 'play', 'Grade', R.contrast, 0.01),
  colour('gradeLift', 'Shadow tint', 'Tint the dark parts. Grey (#808080) changes nothing.', d.post.lift, 'pro', 'Grade'),
  colour('gradeGamma', 'Midtone tint', 'Tint the middle tones. Grey changes nothing.', d.post.gamma, 'pro', 'Grade'),
  colour('gradeGain', 'Highlight tint', 'Tint the bright parts. Grey changes nothing.', d.post.gain, 'pro', 'Grade'),
];

/** The defaults of every knob, as a params object. */
export const defaultLightParams = (): LightParams => Object.fromEntries(LIGHT_VARIABLES.map((v) => [v.key, v.default as number | string | boolean]));

export function setupToParams(s: LightSetup): LightParams {
  const p = defaultLightParams();
  Object.assign(p, {
    sunColor: s.sun.color, sunIntensity: s.sun.intensity, sunAzimuth: s.sun.azimuthDeg, sunElevation: s.sun.elevationDeg, sunSoftness: s.sun.shadowSoftness, sunShadowMap: String(s.sun.shadowMapSize),
    hemiSky: s.hemi.sky, hemiGround: s.hemi.ground, hemiIntensity: s.hemi.intensity, ambientColor: s.ambient.color, ambientIntensity: s.ambient.intensity,
    fillOn: !!s.fill, skyTop: s.sky.top, skyHorizon: s.sky.horizon, skyBottom: s.sky.bottom, skyGlow: s.sky.sunGlow, fogColor: s.fog.color, fogDensity: s.fog.density,
    waterColor: s.water.color, waterOpacity: s.water.opacity, waterRoughness: s.water.roughness, toneMapping: s.toneMapping, exposure: s.exposure,
    bloomStrength: s.post.bloom.strength, bloomRadius: s.post.bloom.radius, bloomThreshold: s.post.bloom.threshold, vignetteDarkness: s.post.vignette.darkness, vignetteOffset: s.post.vignette.offset,
    aoOn: s.post.ssao.enabled, aoRadius: s.post.ssao.radius, aoIntensity: s.post.ssao.intensity, antialias: s.post.fxaa, grain: s.post.grain, posterize: s.post.posterize,
    saturation: s.post.saturation, contrast: s.post.contrast, gradeLift: s.post.lift, gradeGamma: s.post.gamma, gradeGain: s.post.gain,
  });
  if (s.fill) Object.assign(p, { fillColor: s.fill.color, fillIntensity: s.fill.intensity, fillX: s.fill.position[0], fillY: s.fill.position[1], fillZ: s.fill.position[2] });
  (s.extraLights ?? []).slice(0, LAMP_SLOTS).forEach((l, i) => {
    const k = `lamp${i + 1}`;
    Object.assign(p, { [`${k}On`]: true, [`${k}Kind`]: l.type, [`${k}Color`]: l.color, [`${k}Intensity`]: l.intensity, [`${k}Anchor`]: l.anchor, [`${k}X`]: l.offset[0], [`${k}Y`]: l.offset[1], [`${k}Z`]: l.offset[2], [`${k}Distance`]: l.distance });
  });
  return p;
}

/** Build a legal setup from a (possibly partial or junk) params object. Missing knobs take the defaults; never throws. */
export function paramsToSetup(params: unknown, id = 'custom', name = id): LightSetup {
  const p: Record<string, unknown> = { ...defaultLightParams(), ...(params !== null && typeof params === 'object' ? (params as Record<string, unknown>) : {}) };
  const lamps: Lamp[] = [];
  for (let i = 1; i <= LAMP_SLOTS; i++) {
    const k = `lamp${i}`;
    if (p[`${k}On`] !== true) continue;
    lamps.push({ type: p[`${k}Kind`] === 'spot' ? 'spot' : 'point', color: p[`${k}Color`] as string, intensity: p[`${k}Intensity`] as number, anchor: p[`${k}Anchor`] as Lamp['anchor'], offset: [p[`${k}X`] as number, p[`${k}Y`] as number, p[`${k}Z`] as number], distance: p[`${k}Distance`] as number });
  }
  const raw = {
    id, name,
    sun: { color: p.sunColor, intensity: p.sunIntensity, azimuthDeg: p.sunAzimuth, elevationDeg: p.sunElevation, shadowSoftness: p.sunSoftness, shadowMapSize: Number(p.sunShadowMap) },
    hemi: { sky: p.hemiSky, ground: p.hemiGround, intensity: p.hemiIntensity },
    ambient: { color: p.ambientColor, intensity: p.ambientIntensity },
    fill: p.fillOn === true ? { color: p.fillColor, intensity: p.fillIntensity, position: [p.fillX, p.fillY, p.fillZ] } : null,
    extraLights: lamps,
    sky: { top: p.skyTop, horizon: p.skyHorizon, bottom: p.skyBottom, sunGlow: p.skyGlow },
    fog: { color: p.fogColor, density: p.fogDensity },
    water: { color: p.waterColor, opacity: p.waterOpacity, roughness: p.waterRoughness },
    toneMapping: p.toneMapping, exposure: p.exposure,
    post: {
      bloom: { strength: p.bloomStrength, radius: p.bloomRadius, threshold: p.bloomThreshold },
      vignette: { darkness: p.vignetteDarkness, offset: p.vignetteOffset },
      saturation: p.saturation, contrast: p.contrast, lift: p.gradeLift, gamma: p.gradeGamma, gain: p.gradeGain,
      ssao: { enabled: p.aoOn, radius: p.aoRadius, intensity: p.aoIntensity }, fxaa: p.antialias, grain: p.grain, posterize: p.posterize,
    },
  };
  return normalizeSetup(raw);
}
