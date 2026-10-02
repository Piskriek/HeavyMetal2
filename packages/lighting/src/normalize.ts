import { isHex } from './colour';
import { LAMP_ANCHORS, TONE_MAPPINGS, type Lamp, type LampAnchor, type LightSetup, type ToneMappingName, type Vec3 } from './types';

/** The legal range of every number a setup holds. The editors, the renderer and `normalizeSetup` all read this one table. */
export const LIGHT_RANGES = {
  sunIntensity: [0, 10], sunElevation: [-90, 90], sunSoftness: [0, 12], shadowMapSize: [256, 4096],
  hemiIntensity: [0, 4], ambientIntensity: [0, 2], fillIntensity: [0, 4], fillPosition: [-60, 60],
  lampIntensity: [0, 120], lampDistance: [0, 60], lampOffset: [-40, 40],
  sunGlow: [0, 4], fogDensity: [0, 0.08], waterOpacity: [0, 1], waterRoughness: [0, 1], exposure: [0.1, 4],
  bloomStrength: [0, 3], bloomRadius: [0, 1.5], bloomThreshold: [0, 2], vignetteDarkness: [0, 1], vignetteOffset: [0, 1],
  saturation: [0, 2], contrast: [0.5, 1.8], ssaoRadius: [0.1, 4], ssaoIntensity: [0, 3], grain: [0, 0.2], posterize: [0, 32],
} as const satisfies Record<string, readonly [number, number]>;

export const MAX_POINT_LAMPS = 4;
export const MAX_SPOT_LAMPS = 2;

const clamp = (v: number, [lo, hi]: readonly [number, number]): number => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number, range: readonly [number, number]): number => clamp(typeof v === 'number' && Number.isFinite(v) ? v : fallback, range);
const col = (v: unknown, fallback: string): string => (isHex(v) ? v.toLowerCase() : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const rec = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const vec = (v: unknown, fallback: Vec3, range: readonly [number, number]): Vec3 => {
  const a = Array.isArray(v) ? v : [];
  return [num(a[0], fallback[0], range), num(a[1], fallback[1], range), num(a[2], fallback[2], range)];
};
const wrap360 = (d: number): number => ((d % 360) + 360) % 360;
/** Snap to a power of two inside the range (shadow maps must be). */
const pow2 = (v: number): number => {
  const c = clamp(v, LIGHT_RANGES.shadowMapSize);
  return 2 ** Math.round(Math.log2(c));
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback);

/** Noon on a clear day: the setup everything falls back to. */
export const DEFAULT_SETUP: LightSetup = {
  id: 'noon-clear',
  name: 'Noon Clear',
  sun: { color: '#fff4e2', intensity: 3.3, azimuthDeg: 35, elevationDeg: 68, shadowSoftness: 1.4, shadowMapSize: 2048 },
  hemi: { sky: '#a6d6ff', ground: '#d9c595', intensity: 0.95 },
  ambient: { color: '#ffffff', intensity: 0.06 },
  sky: { top: '#2a78dc', horizon: '#bfe5ff', bottom: '#dcf2ff', sunGlow: 0.6 },
  fog: { color: '#cfe7f4', density: 0.0055 },
  water: { color: '#16a3b6', opacity: 0.8, roughness: 0.08 },
  toneMapping: 'aces',
  exposure: 1,
  post: {
    bloom: { strength: 0.15, radius: 0.4, threshold: 1.25 },
    vignette: { darkness: 0.25, offset: 0.55 },
    saturation: 1.08,
    contrast: 1.04,
    lift: '#808080', gamma: '#808080', gain: '#808080',
    ssao: { enabled: true, radius: 1, intensity: 1 },
    fxaa: true,
    grain: 0.008,
    posterize: 0,
  },
};

function lamp(raw: unknown): Lamp {
  const r = rec(raw);
  return {
    type: r.type === 'spot' ? 'spot' : 'point',
    color: col(r.color, '#ffb066'),
    intensity: num(r.intensity, 6, LIGHT_RANGES.lampIntensity),
    anchor: oneOf<LampAnchor>(r.anchor, LAMP_ANCHORS, 'focus'),
    offset: vec(r.offset, [0, 0, 0], LIGHT_RANGES.lampOffset),
    distance: num(r.distance, 8, LIGHT_RANGES.lampDistance),
  };
}

/**
 * Turn anything into a legal LightSetup: unknown fields are dropped, numbers are clamped, colours are lower-cased hex, missing parts come from
 * `base` (noon by default). Never throws. A setup that is already legal comes back equal to itself.
 */
export function normalizeSetup(raw: unknown, base: LightSetup = DEFAULT_SETUP): LightSetup {
  const r = rec(raw);
  const sun = rec(r.sun), hemi = rec(r.hemi), amb = rec(r.ambient), sky = rec(r.sky), fog = rec(r.fog), water = rec(r.water), post = rec(r.post);
  const bloom = rec(post.bloom), vig = rec(post.vignette), ssao = rec(post.ssao);
  const b = base;
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : b.id;
  const out: LightSetup = {
    id,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : id === b.id ? b.name : id,
    sun: {
      color: col(sun.color, b.sun.color),
      intensity: num(sun.intensity, b.sun.intensity, LIGHT_RANGES.sunIntensity),
      azimuthDeg: wrap360(num(sun.azimuthDeg, b.sun.azimuthDeg, [-720, 720])),
      elevationDeg: num(sun.elevationDeg, b.sun.elevationDeg, LIGHT_RANGES.sunElevation),
      shadowSoftness: num(sun.shadowSoftness, b.sun.shadowSoftness, LIGHT_RANGES.sunSoftness),
      shadowMapSize: pow2(num(sun.shadowMapSize, b.sun.shadowMapSize, LIGHT_RANGES.shadowMapSize)),
    },
    hemi: { sky: col(hemi.sky, b.hemi.sky), ground: col(hemi.ground, b.hemi.ground), intensity: num(hemi.intensity, b.hemi.intensity, LIGHT_RANGES.hemiIntensity) },
    ambient: { color: col(amb.color, b.ambient.color), intensity: num(amb.intensity, b.ambient.intensity, LIGHT_RANGES.ambientIntensity) },
    sky: { top: col(sky.top, b.sky.top), horizon: col(sky.horizon, b.sky.horizon), bottom: col(sky.bottom, b.sky.bottom), sunGlow: num(sky.sunGlow, b.sky.sunGlow, LIGHT_RANGES.sunGlow) },
    fog: { color: col(fog.color, b.fog.color), density: num(fog.density, b.fog.density, LIGHT_RANGES.fogDensity) },
    water: { color: col(water.color, b.water.color), opacity: num(water.opacity, b.water.opacity, LIGHT_RANGES.waterOpacity), roughness: num(water.roughness, b.water.roughness, LIGHT_RANGES.waterRoughness) },
    toneMapping: oneOf<ToneMappingName>(r.toneMapping, TONE_MAPPINGS, b.toneMapping),
    exposure: num(r.exposure, b.exposure, LIGHT_RANGES.exposure),
    post: {
      bloom: { strength: num(bloom.strength, b.post.bloom.strength, LIGHT_RANGES.bloomStrength), radius: num(bloom.radius, b.post.bloom.radius, LIGHT_RANGES.bloomRadius), threshold: num(bloom.threshold, b.post.bloom.threshold, LIGHT_RANGES.bloomThreshold) },
      vignette: { darkness: num(vig.darkness, b.post.vignette.darkness, LIGHT_RANGES.vignetteDarkness), offset: num(vig.offset, b.post.vignette.offset, LIGHT_RANGES.vignetteOffset) },
      saturation: num(post.saturation, b.post.saturation, LIGHT_RANGES.saturation),
      contrast: num(post.contrast, b.post.contrast, LIGHT_RANGES.contrast),
      lift: col(post.lift, b.post.lift), gamma: col(post.gamma, b.post.gamma), gain: col(post.gain, b.post.gain),
      ssao: { enabled: bool(ssao.enabled, b.post.ssao.enabled), radius: num(ssao.radius, b.post.ssao.radius, LIGHT_RANGES.ssaoRadius), intensity: num(ssao.intensity, b.post.ssao.intensity, LIGHT_RANGES.ssaoIntensity) },
      fxaa: bool(post.fxaa, b.post.fxaa),
      grain: num(post.grain, b.post.grain, LIGHT_RANGES.grain),
      posterize: Math.round(num(post.posterize, b.post.posterize, LIGHT_RANGES.posterize)),
    },
  };
  if (r.fill !== undefined && r.fill !== null) {
    const f = rec(r.fill);
    out.fill = { color: col(f.color, '#ffffff'), intensity: num(f.intensity, 0.3, LIGHT_RANGES.fillIntensity), position: vec(f.position, [-8, 6, 8], LIGHT_RANGES.fillPosition) };
  } else if (r.fill === undefined && b.fill) out.fill = { ...b.fill, position: [...b.fill.position] as Vec3 };
  if (Array.isArray(r.extraLights)) {
    const all = r.extraLights.map(lamp);
    const pts = all.filter((l) => l.type === 'point').slice(0, MAX_POINT_LAMPS);
    const spots = all.filter((l) => l.type === 'spot').slice(0, MAX_SPOT_LAMPS);
    const keep = new Set<Lamp>([...pts, ...spots]);
    const list = all.filter((l) => keep.has(l));
    if (list.length) out.extraLights = list;
  } else if (r.extraLights === undefined && b.extraLights?.length) out.extraLights = b.extraLights.map((l) => ({ ...l, offset: [...l.offset] as Vec3 }));
  return out;
}
