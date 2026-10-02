import { luminance, mixHex, scaleHex } from './colour';
import type { Lamp, LightSetup, Vec3 } from './types';

/* Pure maths over setups: blending (for smooth transitions and the day cycle), time of day, the sun direction. Nothing here mutates its inputs. */

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Shortest way round the compass. */
const lerpAngle = (a: number, b: number, t: number): number => {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (((a + d * t) % 360) + 360) % 360;
};
const clone3 = (v: Vec3): Vec3 => [v[0], v[1], v[2]];
const cloneLamp = (l: Lamp): Lamp => ({ ...l, offset: clone3(l.offset) });
/** Deep copy of a setup (plain data). */
export function cloneSetup(s: LightSetup): LightSetup {
  const c: LightSetup = { ...s, sun: { ...s.sun }, hemi: { ...s.hemi }, ambient: { ...s.ambient }, sky: { ...s.sky }, fog: { ...s.fog }, water: { ...s.water }, post: { ...s.post, bloom: { ...s.post.bloom }, vignette: { ...s.post.vignette }, ssao: { ...s.post.ssao } } };
  if (s.fill) c.fill = { ...s.fill, position: clone3(s.fill.position) };
  if (s.extraLights) c.extraLights = s.extraLights.map(cloneLamp);
  return c;
}

function lerpLamp(a: Lamp | undefined, b: Lamp | undefined, t: number): Lamp | null {
  if (a && b) {
    if (a.type !== b.type || a.anchor !== b.anchor) return cloneLamp(t < 0.5 ? a : b);
    return { type: a.type, color: mixHex(a.color, b.color, t), intensity: lerp(a.intensity, b.intensity, t), anchor: a.anchor, offset: lerp3(a.offset, b.offset, t), distance: lerp(a.distance, b.distance, t) };
  }
  if (b) return { ...cloneLamp(b), intensity: b.intensity * t };
  if (a) return { ...cloneLamp(a), intensity: a.intensity * (1 - t) };
  return null;
}

/** Blend two setups. t = 0 is `a`, t = 1 is `b` (both returned as copies). Colours mix, angles take the short way round, switches flip half way. */
export function lerpSetup(a: LightSetup, b: LightSetup, t: number): LightSetup {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  if (k <= 0) return cloneSetup(a);
  if (k >= 1) return cloneSetup(b);
  const near = k < 0.5 ? a : b;
  const out: LightSetup = {
    id: near.id,
    name: near.name,
    sun: {
      color: mixHex(a.sun.color, b.sun.color, k),
      intensity: lerp(a.sun.intensity, b.sun.intensity, k),
      azimuthDeg: lerpAngle(a.sun.azimuthDeg, b.sun.azimuthDeg, k),
      elevationDeg: lerp(a.sun.elevationDeg, b.sun.elevationDeg, k),
      shadowSoftness: lerp(a.sun.shadowSoftness, b.sun.shadowSoftness, k),
      shadowMapSize: Math.max(a.sun.shadowMapSize, b.sun.shadowMapSize),
    },
    hemi: { sky: mixHex(a.hemi.sky, b.hemi.sky, k), ground: mixHex(a.hemi.ground, b.hemi.ground, k), intensity: lerp(a.hemi.intensity, b.hemi.intensity, k) },
    ambient: { color: mixHex(a.ambient.color, b.ambient.color, k), intensity: lerp(a.ambient.intensity, b.ambient.intensity, k) },
    sky: { top: mixHex(a.sky.top, b.sky.top, k), horizon: mixHex(a.sky.horizon, b.sky.horizon, k), bottom: mixHex(a.sky.bottom, b.sky.bottom, k), sunGlow: lerp(a.sky.sunGlow, b.sky.sunGlow, k) },
    fog: { color: mixHex(a.fog.color, b.fog.color, k), density: lerp(a.fog.density, b.fog.density, k) },
    water: { color: mixHex(a.water.color, b.water.color, k), opacity: lerp(a.water.opacity, b.water.opacity, k), roughness: lerp(a.water.roughness, b.water.roughness, k) },
    toneMapping: near.toneMapping,
    exposure: lerp(a.exposure, b.exposure, k),
    post: {
      bloom: { strength: lerp(a.post.bloom.strength, b.post.bloom.strength, k), radius: lerp(a.post.bloom.radius, b.post.bloom.radius, k), threshold: lerp(a.post.bloom.threshold, b.post.bloom.threshold, k) },
      vignette: { darkness: lerp(a.post.vignette.darkness, b.post.vignette.darkness, k), offset: lerp(a.post.vignette.offset, b.post.vignette.offset, k) },
      saturation: lerp(a.post.saturation, b.post.saturation, k),
      contrast: lerp(a.post.contrast, b.post.contrast, k),
      lift: mixHex(a.post.lift, b.post.lift, k), gamma: mixHex(a.post.gamma, b.post.gamma, k), gain: mixHex(a.post.gain, b.post.gain, k),
      ssao: { enabled: a.post.ssao.enabled || b.post.ssao.enabled, radius: lerp(a.post.ssao.radius, b.post.ssao.radius, k), intensity: lerp(a.post.ssao.intensity, b.post.ssao.intensity, k) },
      fxaa: near.post.fxaa,
      grain: lerp(a.post.grain, b.post.grain, k),
      posterize: a.post.posterize > 1 && b.post.posterize > 1 ? Math.round(lerp(a.post.posterize, b.post.posterize, k)) : near.post.posterize,
    },
  };
  if (a.fill || b.fill) {
    const fa = a.fill, fb = b.fill;
    if (fa && fb) out.fill = { color: mixHex(fa.color, fb.color, k), intensity: lerp(fa.intensity, fb.intensity, k), position: lerp3(fa.position, fb.position, k) };
    else if (fb) out.fill = { color: fb.color, intensity: fb.intensity * k, position: clone3(fb.position) };
    else if (fa) out.fill = { color: fa.color, intensity: fa.intensity * (1 - k), position: clone3(fa.position) };
  }
  const n = Math.max(a.extraLights?.length ?? 0, b.extraLights?.length ?? 0);
  if (n > 0) {
    const lamps: Lamp[] = [];
    for (let i = 0; i < n; i++) { const l = lerpLamp(a.extraLights?.[i], b.extraLights?.[i], k); if (l) lamps.push(l); }
    if (lamps.length) out.extraLights = lamps;
  }
  return out;
}

/** A copy of `obj` with the value at `path` replaced (arrays and objects along the path are copied, nothing else is touched). */
export function setIn<T>(obj: T, path: readonly (string | number)[], value: unknown): T {
  if (path.length === 0) return value as T;
  const [key, ...rest] = path as [string | number, ...(string | number)[]];
  const src = (obj ?? {}) as Record<string | number, unknown>;
  const copy: Record<string | number, unknown> | unknown[] = Array.isArray(src) ? [...src] : { ...src };
  (copy as Record<string | number, unknown>)[key] = setIn(src[key], rest, value);
  return copy as T;
}

/** Unit vector pointing from the ground towards the sun: x east, y up, z south. */
export function sunDirection(s: LightSetup): Vec3 {
  const az = (s.sun.azimuthDeg * Math.PI) / 180;
  const el = (s.sun.elevationDeg * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}

/* ---------------------------- Time of day ---------------------------- */

interface TodKey { e: number; sun: string; top: string; hor: string; bot: string; fog: string; hemi: string; water: string; glow: number; hemiMul: number }

const TOD_KEYS: readonly TodKey[] = [
  { e: -40, sun: '#8ea6ff', top: '#040918', hor: '#15224a', bot: '#0a1124', fog: '#0f1830', hemi: '#1c2a52', water: '#0c1a36', glow: 0.7, hemiMul: 0.35 },
  { e: -8, sun: '#7a86d8', top: '#122152', hor: '#5d5f9e', bot: '#262a58', fog: '#3e4579', hemi: '#38478c', water: '#1a2c5c', glow: 0.6, hemiMul: 0.55 },
  { e: 1, sun: '#ff6a32', top: '#34489a', hor: '#ff9256', bot: '#ff7258', fog: '#e48a68', hemi: '#ff9a80', water: '#36508a', glow: 2.0, hemiMul: 0.7 },
  { e: 10, sun: '#ffaf62', top: '#4b73bd', hor: '#ffcd88', bot: '#f5bf88', fog: '#f0c698', hemi: '#ffd0a6', water: '#2a8696', glow: 1.4, hemiMul: 0.85 },
  { e: 32, sun: '#fff0d8', top: '#3584de', hor: '#bde2ff', bot: '#d4eeff', fog: '#cde5f1', hemi: '#a6d4ff', water: '#18a0b4', glow: 0.7, hemiMul: 1.0 },
  { e: 90, sun: '#fff6ea', top: '#2a78dc', hor: '#c2e6ff', bot: '#dcf2ff', fog: '#d2e9f5', hemi: '#a6d6ff', water: '#16a3b6', glow: 0.5, hemiMul: 1.05 },
];

function lerpTod(a: TodKey, b: TodKey, t: number): TodKey {
  return { e: lerp(a.e, b.e, t), sun: mixHex(a.sun, b.sun, t), top: mixHex(a.top, b.top, t), hor: mixHex(a.hor, b.hor, t), bot: mixHex(a.bot, b.bot, t), fog: mixHex(a.fog, b.fog, t), hemi: mixHex(a.hemi, b.hemi, t), water: mixHex(a.water, b.water, t), glow: lerp(a.glow, b.glow, t), hemiMul: lerp(a.hemiMul, b.hemiMul, t) };
}

function sampleTod(e: number): TodKey {
  const first = TOD_KEYS[0]!;
  const last = TOD_KEYS[TOD_KEYS.length - 1]!;
  if (e <= first.e) return first;
  for (let i = 0; i < TOD_KEYS.length - 1; i++) {
    const a = TOD_KEYS[i]!, b = TOD_KEYS[i + 1]!;
    if (e <= b.e) return lerpTod(a, b, (e - a.e) / (b.e - a.e));
  }
  return last;
}

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Sun elevation in degrees for an hour 0..24 (sunrise 6:00, noon at the top, sunset 18:00). */
export const todElevation = (hour: number): number => Math.sin(((hour - 6) / 24) * Math.PI * 2) * 72;

/**
 * Move the sun to the clock and re-tint sky, fog, sun, hemisphere and water towards a plausible palette while keeping about a third of the
 * setup's own art direction. Below the horizon the "sun" becomes a dim moon on the opposite side.
 */
export function applyTimeOfDay(s: LightSetup, hour: number): LightSetup {
  const h = Number.isFinite(hour) ? hour : 12;
  const elev = todElevation(h);
  const az = (((90 + (h - 6) * 15) % 360) + 360) % 360;
  const p = sampleTod(elev);
  const night = 1 - smooth(-8, 10, elev);
  // Deep night takes over almost the whole palette; the setup's own art direction shows most by day.
  const amt = 0.7 + 0.25 * night;
  const out = cloneSetup(s);
  if (elev >= 0) {
    out.sun.color = mixHex(s.sun.color, p.sun, amt);
    out.sun.intensity = Math.max(s.sun.intensity, 1.2) * smooth(-2, 12, elev) * (0.75 + 0.25 * smooth(5, 40, elev));
    out.sun.azimuthDeg = az;
    out.sun.elevationDeg = Math.max(elev, 1.5);
  } else {
    out.sun.color = mixHex(s.sun.color, '#9fb6ff', 0.8);
    out.sun.intensity = Math.max(0.6, s.sun.intensity * 0.35) * smooth(1, 12, -elev);
    out.sun.azimuthDeg = (az + 180) % 360;
    out.sun.elevationDeg = 18 + -elev * 0.5;
  }
  out.hemi = { sky: mixHex(s.hemi.sky, p.hemi, amt), ground: mixHex(s.hemi.ground, scaleHex(s.hemi.ground, 0.35), night), intensity: s.hemi.intensity * p.hemiMul };
  out.ambient = { ...s.ambient, color: mixHex(s.ambient.color, p.hemi, 0.5) };
  out.sky = { top: mixHex(s.sky.top, p.top, amt), horizon: mixHex(s.sky.horizon, p.hor, amt), bottom: mixHex(s.sky.bottom, p.bot, amt), sunGlow: Math.max(0.15, s.sky.sunGlow * 0.4 + p.glow * 0.6) };
  out.fog = { ...s.fog, color: mixHex(s.fog.color, p.fog, amt) };
  out.water = { ...s.water, color: mixHex(s.water.color, p.water, 0.55) };
  out.exposure = s.exposure * (1 + night * 0.35);
  return out;
}

/** 0 under a bright sky, 1 under a dark one: lamps and glowing props use it to switch on. Judged from the colour straight overhead, which follows the clock. */
export function nightFactor(s: LightSetup): number {
  return 1 - smooth(0.04, 0.22, luminance(s.sky.top));
}
