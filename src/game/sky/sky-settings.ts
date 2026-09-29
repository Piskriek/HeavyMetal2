/**
 * SKY: the builder's Sky & Clouds window and what it sets. Global like the Sky menu's pick (the race
 * reads the same storage), so a race shows the sky the builder last showed.
 *
 *  - **mode**: `painted` keeps the Sky menu's panorama; `gradient` lays a crisp three-stop gradient
 *    (horizon → middle → top) over it, as opaque as `gradient.opacity` (0 shows the painting through).
 *    The fog and the sea's haze take the horizon colour (blended the same way), so sea and sky still
 *    meet with no line.
 *  - **sea**: the island ocean's colour: the water's own tint, the deep colour under it, and how much of
 *    the deep shows through (island-sea.ts).
 *  - **clouds**: painted billboard clouds floating round the island in three rings, smaller and lower
 *    toward the horizon (`sky-clouds.ts`); `horizonSize` / `horizonHug` shrink and sink the far rings.
 *  - **horizon**: where sky meets sea. `haze` is how far each fades into the fog colour (0 = a crisp
 *    line), `fog` the distance fog over the far sea, and an optional thin glow band (colour, strength,
 *    width, softness) that fades up into the sky and down onto the sea.
 *
 * Pure data and a tiny store: no THREE, no DOM, so tests can load it headless.
 */
import { shippedCourses } from '../shipped-courses';

export type SkyMode = 'painted' | 'gradient';

export interface SkyGradient {
  /** Straight up. */
  readonly top: string;
  /** The band between; `midHeight` puts it. */
  readonly middle: string;
  /** Where the sky meets the sea (also the fog's colour). */
  readonly horizon: string;
  /** 0 = long soft blends, 1 = crisp bands. */
  readonly crispness: number;
  /** Where the middle colour sits, 0 (at the horizon) to 1 (overhead). */
  readonly midHeight: number;
  /** How much of the gradient covers the painted skybox: 1 = gradient only, 0 = the painting only. */
  readonly opacity: number;
}

export interface SkyClouds {
  readonly enabled: boolean;
  /** How many clouds round the island. */
  readonly count: number;
  /** × every cloud's size. */
  readonly size: number;
  /** × every cloud's height above the sea. */
  readonly height: number;
  /** × how fast they drift round the island and bob (0: still). */
  readonly drift: number;
  readonly opacity: number;
  /** Multiplied into the painted clouds (white keeps them as painted). */
  readonly tint: string;
  /** Another layout of the same amount. */
  readonly seed: number;
  /** × the size of the far rings (the middle ring gets half the change): small = tiny clouds on the horizon. */
  readonly horizonSize: number;
  /** 0‥1: how far the far rings move onto the horizon line (as the race camera sees it), further out. */
  readonly horizonHug: number;
  /** 0‥1: pushes every ring back toward the horizon (0 = over the shore, 1 = four times as far). */
  readonly distance: number;
  /** The horizon ring stands epic towering cloud banks instead of small puffs. */
  readonly banks: boolean;
}

export type OverheadPattern = 'fair' | 'broken' | 'storm';
export const OVERHEAD_PATTERNS: readonly { id: OverheadPattern; name: string }[] = Object.freeze([
  { id: 'fair', name: 'Fair weather' },
  { id: 'broken', name: 'Broken' },
  { id: 'storm', name: 'Storm ceiling' },
]);

/** A cloud ceiling over the island, seen from below (a storm scene's overcast). */
export interface SkyOverhead {
  readonly enabled: boolean;
  readonly pattern: OverheadPattern;
  /** 0‥1: how much of the sky it covers. */
  readonly coverage: number;
  /** World height of the ceiling (the road runs ~17 500 up). */
  readonly height: number;
  /** World units per repeat of the pattern (bigger = bigger clouds). */
  readonly scale: number;
  /** The lit, thin parts, and the thick undersides. */
  readonly color: string;
  readonly shadow: string;
  /** 0‥1: how dark the thick undersides go (storm). */
  readonly darkness: number;
  readonly opacity: number;
  /** × how fast it drifts (0: still). */
  readonly drift: number;
}

export interface SkyHorizon {
  /** How far sky and sea fade into the fog colour at the horizon: 0 = a crisp line, 1 = a wide soft haze. */
  readonly haze: number;
  /** Distance fog over the far sea and the island: 0 = none, 1 = thick. */
  readonly fog: number;
  /** The fog's (and the horizon haze's) colour; '' follows the sky. */
  readonly fogColor: string;
  /** A thin glow band on the horizon line, fading up into the sky and down onto the sea. */
  readonly glow: boolean;
  readonly glowColor: string;
  /** 0‥1. */
  readonly glowStrength: number;
  /** Half the band's height, in view-angle (0.002 ≈ a hairline, 0.12 ≈ a wide band). */
  readonly glowWidth: number;
  /** 0 = hard-edged band, 1 = fades all the way from its centre. */
  readonly glowSoftness: number;
}

/** The water's pattern: the painted waves, painted ripples, the lagoon shallows tile, or none (flat). */
export type SeaTexture = 'waves' | 'ripples' | 'shallows' | 'flat';
export const SEA_TEXTURES: readonly { id: SeaTexture; name: string }[] = Object.freeze([
  { id: 'waves', name: 'Painted waves' },
  { id: 'ripples', name: 'Painted ripples' },
  { id: 'shallows', name: 'Lagoon shallows' },
  { id: 'flat', name: 'Flat (no pattern)' },
]);

export interface SeaLook {
  /** The water surface's tint (multiplies the water texture). */
  readonly water: string;
  /** The deep under the water (the sea floor), showing through it. */
  readonly deep: string;
  /** 0 = solid water, 0.6 = very clear (the deep shows through). */
  readonly seeThrough: number;
  readonly texture: SeaTexture;
  /** World units per repeat of the pattern (the ball is 62 across). */
  readonly tileSize: number;
  /** × how fast the rings roll in to the shore (0: still). */
  readonly waveSpeed: number;
}

export interface SkySettings {
  readonly mode: SkyMode;
  readonly gradient: SkyGradient;
  readonly sea: SeaLook;
  readonly clouds: SkyClouds;
  readonly horizon: SkyHorizon;
  readonly overhead: SkyOverhead;
}

export const OVERHEAD_PRESETS: readonly { id: string; name: string; overhead: SkyOverhead }[] = Object.freeze([
  { id: 'fair', name: 'Fair', overhead: { enabled: true, pattern: 'fair', coverage: 0.35, height: 34000, scale: 40000, color: '#ffffff', shadow: '#aebccf', darkness: 0.35, opacity: 0.95, drift: 1 } },
  { id: 'broken', name: 'Broken', overhead: { enabled: true, pattern: 'broken', coverage: 0.6, height: 32000, scale: 48000, color: '#f4f6fa', shadow: '#8494a8', darkness: 0.5, opacity: 0.95, drift: 1 } },
  { id: 'storm', name: 'Storm', overhead: { enabled: true, pattern: 'storm', coverage: 0.9, height: 28000, scale: 36000, color: '#9aa4b0', shadow: '#2e3540', darkness: 0.85, opacity: 1, drift: 2 } },
]);

export interface SeaPreset { readonly id: string; readonly name: string; readonly sea: SeaLook }

/** Ready-made oceans; the first is the island's own turquoise. */
export const SEA_PRESETS: readonly SeaPreset[] = Object.freeze([
  { id: 'turquoise', name: 'Turquoise', sea: { water: '#6fc2c0', deep: '#557f78', seeThrough: 0.2, texture: 'waves', tileSize: 3000, waveSpeed: 1 } },
  { id: 'tropical', name: 'Tropical', sea: { water: '#9ff0e8', deep: '#2a9d9a', seeThrough: 0.25, texture: 'shallows', tileSize: 4000, waveSpeed: 0.8 } },
  { id: 'deep_blue', name: 'Deep blue', sea: { water: '#3a78c0', deep: '#1d3b63', seeThrough: 0.12, texture: 'ripples', tileSize: 3500, waveSpeed: 1 } },
  { id: 'emerald', name: 'Emerald', sea: { water: '#48b184', deep: '#2c6a52', seeThrough: 0.2, texture: 'ripples', tileSize: 3000, waveSpeed: 1 } },
  { id: 'stormy', name: 'Stormy', sea: { water: '#6d8a93', deep: '#3e5158', seeThrough: 0.1, texture: 'waves', tileSize: 2200, waveSpeed: 2 } },
  { id: 'twilight', name: 'Twilight', sea: { water: '#7d86d6', deep: '#3f3f7a', seeThrough: 0.15, texture: 'ripples', tileSize: 3000, waveSpeed: 0.6 } },
]);

export interface GradientPreset { readonly id: string; readonly name: string; readonly gradient: SkyGradient }

/** Ready-made gradients; the first is the default: a clean, crisp blue. */
export const GRADIENT_PRESETS: readonly GradientPreset[] = Object.freeze([
  { id: 'crisp_blue', name: 'Crisp blue', gradient: { top: '#2d6fd8', middle: '#6cb4f2', horizon: '#dcf1ff', crispness: 0.65, midHeight: 0.28, opacity: 1 } },
  { id: 'frost_morning', name: 'Frost morning', gradient: { top: '#3a5fb8', middle: '#8fc3ec', horizon: '#f2f7ff', crispness: 0.7, midHeight: 0.22, opacity: 1 } },
  { id: 'candy_dusk', name: 'Candy dusk', gradient: { top: '#3b3f9e', middle: '#c77fc9', horizon: '#ffd2a1', crispness: 0.6, midHeight: 0.3, opacity: 1 } },
  { id: 'golden_hour', name: 'Golden hour', gradient: { top: '#4a78c8', middle: '#f3c77a', horizon: '#ffe8c2', crispness: 0.55, midHeight: 0.18, opacity: 1 } },
  { id: 'mint_isles', name: 'Mint isles', gradient: { top: '#1f7fa8', middle: '#7fd6d0', horizon: '#e6fff4', crispness: 0.65, midHeight: 0.26, opacity: 1 } },
  { id: 'storm_teal', name: 'Storm teal', gradient: { top: '#23405a', middle: '#4f8a98', horizon: '#b9d4d0', crispness: 0.5, midHeight: 0.35, opacity: 1 } },
]);

const OVERHEAD_PRESETS_BASE: SkyOverhead = { enabled: false, pattern: 'broken', coverage: 0.6, height: 32000, scale: 48000, color: '#f4f6fa', shadow: '#8494a8', darkness: 0.5, opacity: 0.95, drift: 1 };

export const DEFAULT_SKY_SETTINGS: SkySettings = Object.freeze({
  mode: 'painted',
  gradient: GRADIENT_PRESETS[0]!.gradient,
  sea: SEA_PRESETS[0]!.sea,
  clouds: { enabled: true, count: 36, size: 1, height: 1, drift: 1, opacity: 1, tint: '#ffffff', seed: 1, horizonSize: 1, horizonHug: 0.9, distance: 0.35, banks: true },
  overhead: { ...OVERHEAD_PRESETS_BASE, enabled: false },
  horizon: { haze: 0.2, fog: 0.2, fogColor: '', glow: true, glowColor: '#ffffff', glowStrength: 0.75, glowWidth: 0.016, glowSoftness: 0.85 },
});

/** Quick looks for the horizon (the Horizon section's buttons). */
export const HORIZON_PRESETS: readonly { id: string; name: string; horizon: SkyHorizon }[] = Object.freeze([
  { id: 'glow', name: 'Thin glow', horizon: DEFAULT_SKY_SETTINGS.horizon },
  { id: 'crisp', name: 'Crisp line', horizon: { haze: 0, fog: 0, fogColor: '', glow: false, glowColor: '#ffffff', glowStrength: 0.75, glowWidth: 0.016, glowSoftness: 0.85 } },
  { id: 'haze', name: 'Soft haze', horizon: { haze: 1, fog: 1, fogColor: '', glow: false, glowColor: '#ffffff', glowStrength: 0.75, glowWidth: 0.016, glowSoftness: 0.85 } },
]);

export const SKY_SETTINGS_KEY = 'hm2-sky-settings-v1';

export const CLOUD_COUNT_MAX = 80;

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, n));
};
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback);

/** Anything (an old or hand-edited save) → valid settings; missing fields take the defaults. */
export function normalizeSkySettings(raw: unknown): SkySettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const g = (r.gradient && typeof r.gradient === 'object' ? r.gradient : {}) as Record<string, unknown>;
  const c = (r.clouds && typeof r.clouds === 'object' ? r.clouds : {}) as Record<string, unknown>;
  const w = (r.sea && typeof r.sea === 'object' ? r.sea : {}) as Record<string, unknown>;
  const z = (r.horizon && typeof r.horizon === 'object' ? r.horizon : {}) as Record<string, unknown>;
  const o = (r.overhead && typeof r.overhead === 'object' ? r.overhead : {}) as Record<string, unknown>;
  const dov = DEFAULT_SKY_SETTINGS.overhead;
  const dg = DEFAULT_SKY_SETTINGS.gradient, dc = DEFAULT_SKY_SETTINGS.clouds, dw = DEFAULT_SKY_SETTINGS.sea, dz = DEFAULT_SKY_SETTINGS.horizon;
  return {
    mode: r.mode === 'gradient' ? 'gradient' : 'painted',
    gradient: {
      top: hex(g.top, dg.top),
      middle: hex(g.middle, dg.middle),
      horizon: hex(g.horizon, dg.horizon),
      crispness: clamp(g.crispness, 0, 1, dg.crispness),
      midHeight: clamp(g.midHeight, 0.05, 0.9, dg.midHeight),
      opacity: clamp(g.opacity, 0, 1, dg.opacity),
    },
    sea: {
      water: hex(w.water, dw.water),
      deep: hex(w.deep, dw.deep),
      seeThrough: clamp(w.seeThrough, 0, 0.6, dw.seeThrough),
      texture: SEA_TEXTURES.some((t) => t.id === w.texture) ? (w.texture as SeaTexture) : dw.texture,
      tileSize: Math.round(clamp(w.tileSize, 800, 10000, dw.tileSize)),
      waveSpeed: clamp(w.waveSpeed, 0, 4, dw.waveSpeed),
    },
    clouds: {
      enabled: typeof c.enabled === 'boolean' ? c.enabled : dc.enabled,
      count: Math.round(clamp(c.count, 0, CLOUD_COUNT_MAX, dc.count)),
      size: clamp(c.size, 0.3, 6, dc.size),
      height: clamp(c.height, 0.3, 2, dc.height),
      drift: clamp(c.drift, 0, 4, dc.drift),
      opacity: clamp(c.opacity, 0.1, 1, dc.opacity),
      tint: hex(c.tint, dc.tint),
      seed: Math.round(clamp(c.seed, 1, 9999, dc.seed)),
      horizonSize: clamp(c.horizonSize, 0.1, 1.5, dc.horizonSize),
      horizonHug: clamp(c.horizonHug, 0, 1, dc.horizonHug),
      distance: clamp(c.distance, 0, 1, dc.distance),
      banks: typeof c.banks === 'boolean' ? c.banks : dc.banks,
    },
    overhead: {
      enabled: typeof o.enabled === 'boolean' ? o.enabled : dov.enabled,
      pattern: OVERHEAD_PATTERNS.some((p) => p.id === o.pattern) ? (o.pattern as OverheadPattern) : dov.pattern,
      coverage: clamp(o.coverage, 0, 1, dov.coverage),
      height: Math.round(clamp(o.height, 20000, 90000, dov.height)),
      scale: Math.round(clamp(o.scale, 8000, 200000, dov.scale)),
      color: hex(o.color, dov.color),
      shadow: hex(o.shadow, dov.shadow),
      darkness: clamp(o.darkness, 0, 1, dov.darkness),
      opacity: clamp(o.opacity, 0, 1, dov.opacity),
      drift: clamp(o.drift, 0, 5, dov.drift),
    },
    horizon: {
      haze: clamp(z.haze, 0, 1, dz.haze),
      fog: clamp(z.fog, 0, 1, dz.fog),
      fogColor: z.fogColor === '' ? '' : hex(z.fogColor, dz.fogColor),
      glow: typeof z.glow === 'boolean' ? z.glow : dz.glow,
      glowColor: hex(z.glowColor, dz.glowColor),
      glowStrength: clamp(z.glowStrength, 0, 1, dz.glowStrength),
      glowWidth: clamp(z.glowWidth, 0.002, 0.12, dz.glowWidth),
      glowSoftness: clamp(z.glowSoftness, 0, 1, dz.glowSoftness),
    },
  };
}

/** The glow band's strength at view height `h` (the shaders' twin): 1 on the line, 0 past its width. */
export function horizonGlowAt(z: SkyHorizon, h: number): number {
  if (!z.glow) return 0;
  const edge0 = z.glowWidth * (1 - z.glowSoftness);
  return z.glowStrength * (1 - smoothstep(edge0, z.glowWidth, Math.abs(h)));
}

/* ───────────── the colour of the gradient (the shader's twin, for tests and the window's preview) ───────────── */

const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Half the width of a blend between two stops, in that band's own 0‥1: soft (0.5) to crisp (0.06). */
export const gradientBlendWidth = (crispness: number) => 0.5 - 0.44 * Math.min(1, Math.max(0, crispness));

/** The gradient's sRGB colour (0‥1) at `h`, the view direction's height (-1 down, 1 straight up). */
export function gradientColorAt(g: SkyGradient, h: number): [number, number, number] {
  const w = gradientBlendWidth(g.crispness);
  const lo = rgb(g.horizon), mid = rgb(g.middle), top = rgb(g.top);
  const y = Math.max(0, h);
  const a = smoothstep(0.5 - w, 0.5 + w, Math.min(1, y / g.midHeight));
  const b = smoothstep(0.5 - w, 0.5 + w, Math.min(1, Math.max(0, (y - g.midHeight) / (1 - g.midHeight))));
  return [0, 1, 2].map((i) => {
    const low = lo[i]! + (mid[i]! - lo[i]!) * a;
    return low + (top[i]! - low) * b;
  }) as [number, number, number];
}

/* ───────────── the store ───────────── */

let current: SkySettings | null = null;
const listeners = new Set<(s: SkySettings) => void>();

export function getSkySettings(): SkySettings {
  if (current) return current;
  let raw: unknown = null;
  try { raw = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem(SKY_SETTINGS_KEY) ?? 'null') : null; } catch { raw = null; }
  // Never set on this device: the owner's published look (shipped-courses.ts), else the defaults.
  current = normalizeSkySettings(raw ?? shippedCourses()?.sky ?? null);
  return current;
}

/** Merges a change (gradient and clouds merge field by field), saves, and tells every listener. */
export function setSkySettings(change: { mode?: SkyMode; gradient?: Partial<SkyGradient>; sea?: Partial<SeaLook>; clouds?: Partial<SkyClouds>; horizon?: Partial<SkyHorizon>; overhead?: Partial<SkyOverhead> }): SkySettings {
  const now = getSkySettings();
  current = normalizeSkySettings({
    mode: change.mode ?? now.mode,
    gradient: { ...now.gradient, ...change.gradient },
    sea: { ...now.sea, ...change.sea },
    clouds: { ...now.clouds, ...change.clouds },
    horizon: { ...now.horizon, ...change.horizon },
    overhead: { ...now.overhead, ...change.overhead },
  });
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(SKY_SETTINGS_KEY, JSON.stringify(current)); } catch { /* storage full or blocked: this session keeps it */ }
  for (const cb of listeners) cb(current);
  return current;
}

export function resetSkySettings(): SkySettings {
  return setSkySettings({ mode: DEFAULT_SKY_SETTINGS.mode, gradient: DEFAULT_SKY_SETTINGS.gradient, sea: DEFAULT_SKY_SETTINGS.sea, clouds: DEFAULT_SKY_SETTINGS.clouds, horizon: DEFAULT_SKY_SETTINGS.horizon, overhead: DEFAULT_SKY_SETTINGS.overhead });
}

export function onSkySettings(cb: (s: SkySettings) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Tests: forget the cached settings (the next read goes to storage again). */
export function _resetSkySettingsCache(): void { current = null; }
