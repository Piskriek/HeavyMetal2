/**
 * SKY: the builder's Sky & Clouds window and what it sets. Global like the Sky menu's pick (the race
 * reads the same storage), so a race shows the sky the builder last showed.
 *
 *  - **mode**: `painted` keeps the Sky menu's panorama; `gradient` swaps it for a crisp three-stop
 *    gradient (horizon → middle → top) whose colours the window edits. The fog and the sea's haze take
 *    the horizon colour, so sea and sky still meet with no line.
 *  - **clouds**: painted billboard clouds floating round the island in three rings, smaller and lower
 *    toward the horizon (`sky-clouds.ts`).
 *
 * Pure data and a tiny store: no THREE, no DOM, so tests can load it headless.
 */

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
}

export interface SkySettings {
  readonly mode: SkyMode;
  readonly gradient: SkyGradient;
  readonly clouds: SkyClouds;
}

export interface GradientPreset { readonly id: string; readonly name: string; readonly gradient: SkyGradient }

/** Ready-made gradients; the first is the default: a clean, crisp blue. */
export const GRADIENT_PRESETS: readonly GradientPreset[] = Object.freeze([
  { id: 'crisp_blue', name: 'Crisp blue', gradient: { top: '#2d6fd8', middle: '#6cb4f2', horizon: '#dcf1ff', crispness: 0.65, midHeight: 0.28 } },
  { id: 'frost_morning', name: 'Frost morning', gradient: { top: '#3a5fb8', middle: '#8fc3ec', horizon: '#f2f7ff', crispness: 0.7, midHeight: 0.22 } },
  { id: 'candy_dusk', name: 'Candy dusk', gradient: { top: '#3b3f9e', middle: '#c77fc9', horizon: '#ffd2a1', crispness: 0.6, midHeight: 0.3 } },
  { id: 'golden_hour', name: 'Golden hour', gradient: { top: '#4a78c8', middle: '#f3c77a', horizon: '#ffe8c2', crispness: 0.55, midHeight: 0.18 } },
  { id: 'mint_isles', name: 'Mint isles', gradient: { top: '#1f7fa8', middle: '#7fd6d0', horizon: '#e6fff4', crispness: 0.65, midHeight: 0.26 } },
  { id: 'storm_teal', name: 'Storm teal', gradient: { top: '#23405a', middle: '#4f8a98', horizon: '#b9d4d0', crispness: 0.5, midHeight: 0.35 } },
]);

export const DEFAULT_SKY_SETTINGS: SkySettings = Object.freeze({
  mode: 'painted',
  gradient: GRADIENT_PRESETS[0]!.gradient,
  clouds: { enabled: true, count: 36, size: 1, height: 1, drift: 1, opacity: 1, tint: '#ffffff', seed: 1 },
});

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
  const dg = DEFAULT_SKY_SETTINGS.gradient, dc = DEFAULT_SKY_SETTINGS.clouds;
  return {
    mode: r.mode === 'gradient' ? 'gradient' : 'painted',
    gradient: {
      top: hex(g.top, dg.top),
      middle: hex(g.middle, dg.middle),
      horizon: hex(g.horizon, dg.horizon),
      crispness: clamp(g.crispness, 0, 1, dg.crispness),
      midHeight: clamp(g.midHeight, 0.05, 0.9, dg.midHeight),
    },
    clouds: {
      enabled: typeof c.enabled === 'boolean' ? c.enabled : dc.enabled,
      count: Math.round(clamp(c.count, 0, CLOUD_COUNT_MAX, dc.count)),
      size: clamp(c.size, 0.3, 2.5, dc.size),
      height: clamp(c.height, 0.3, 2, dc.height),
      drift: clamp(c.drift, 0, 4, dc.drift),
      opacity: clamp(c.opacity, 0.1, 1, dc.opacity),
      tint: hex(c.tint, dc.tint),
      seed: Math.round(clamp(c.seed, 1, 9999, dc.seed)),
    },
  };
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
  current = normalizeSkySettings(raw);
  return current;
}

/** Merges a change (gradient and clouds merge field by field), saves, and tells every listener. */
export function setSkySettings(change: { mode?: SkyMode; gradient?: Partial<SkyGradient>; clouds?: Partial<SkyClouds> }): SkySettings {
  const now = getSkySettings();
  current = normalizeSkySettings({
    mode: change.mode ?? now.mode,
    gradient: { ...now.gradient, ...change.gradient },
    clouds: { ...now.clouds, ...change.clouds },
  });
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(SKY_SETTINGS_KEY, JSON.stringify(current)); } catch { /* storage full or blocked: this session keeps it */ }
  for (const cb of listeners) cb(current);
  return current;
}

export function resetSkySettings(): SkySettings {
  return setSkySettings({ mode: DEFAULT_SKY_SETTINGS.mode, gradient: DEFAULT_SKY_SETTINGS.gradient, clouds: DEFAULT_SKY_SETTINGS.clouds });
}

export function onSkySettings(cb: (s: SkySettings) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Tests: forget the cached settings (the next read goes to storage again). */
export function _resetSkySettingsCache(): void { current = null; }
