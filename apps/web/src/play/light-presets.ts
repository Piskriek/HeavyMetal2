/**
 * The Light Projector's presets (plan 39 section 6, Lx): named lights first (docs/PRESET_FACTORIES_RESEARCH.md: presets as
 * the default, a Kelvin slider for warm to cool, a signal colour as a separate mode). A light is a temperature or a
 * signal colour, an intensity and a pattern. Pure: the colour maths and the pattern's glow at a time.
 */
import type { LightPattern, LightSpec } from '@hm/cartlab';
import type { PartOverride, PlacedPart } from '@hm/kitspec';
import { GENERATORS } from '@hm/partgen';

export interface LightPreset extends LightSpec {
  readonly id: string;
}

export const LIGHT_PRESETS: readonly LightPreset[] = [
  { id: 'sodium-amber', name: 'Sodium amber', kelvin: 2000, colour: null, intensity: 1.2, pattern: 'steady' },
  { id: 'work-white', name: 'Work white', kelvin: 4000, colour: null, intensity: 1.4, pattern: 'steady' },
  { id: 'daylight', name: 'Daylight', kelvin: 5600, colour: null, intensity: 1.5, pattern: 'steady' },
  { id: 'cold-lab', name: 'Cold lab', kelvin: 7500, colour: null, intensity: 1.2, pattern: 'pulse' },
  { id: 'hazard-strobe', name: 'Hazard strobe', kelvin: 4000, colour: '#ffb02a', intensity: 2.0, pattern: 'blink' },
  { id: 'ember', name: 'Ember flicker', kelvin: 1700, colour: null, intensity: 0.9, pattern: 'flicker' },
];

export const KELVIN_MIN = 1500;
export const KELVIN_MAX = 9000;
export const PATTERN_LABEL: Readonly<Record<LightPattern, string>> = { steady: 'Steady', pulse: 'Slow pulse', blink: 'Blink', flicker: 'Flicker' };

const clamp255 = (x: number): number => Math.max(0, Math.min(255, Math.round(x)));
const hex2 = (x: number): string => clamp255(x).toString(16).padStart(2, '0');

/**
 * A colour temperature as an sRGB colour (Tanner Helland's fit to the black-body curve, good from 1000 K to 40000 K):
 * 2000 K is a sodium amber, 6500 K a neutral white, 9000 K a cold blue white.
 */
export function kelvinHex(kelvin: number): string {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/** The colour a light glows: its signal colour, or its temperature's. */
export const lightHex = (l: Pick<LightSpec, 'kelvin' | 'colour'>): string => l.colour ?? kelvinHex(l.kelvin);

/**
 * How bright a pattern is at time t (seconds), 0 to 1: steady always 1; a pulse breathes over 2.4 s; a blink is on for
 * 0.35 s of every 0.9 s; a flicker is a deterministic mix of two sines (no randomness: the same t, the same glow).
 */
export function patternGlow(pattern: LightPattern, t: number): number {
  switch (pattern) {
    case 'steady':
      return 1;
    case 'pulse':
      return 0.55 + 0.45 * Math.sin((t / 2.4) * Math.PI * 2);
    case 'blink':
      return (((t % 0.9) + 0.9) % 0.9) < 0.35 ? 1 : 0.05;
    case 'flicker':
      return Math.max(0.35, Math.min(1, 0.78 + 0.16 * Math.sin(t * 13.1) + 0.12 * Math.sin(t * 29.7 + 1.3)));
  }
}

/** A lamp's material name for a light: `lx:<kelvin>:<intensity>:<pattern>[:<rrggbb>]`, parsed back by parseLightName. */
export function lightName(l: Pick<LightSpec, 'kelvin' | 'colour' | 'intensity' | 'pattern'>): string {
  const base = `lx:${Math.round(l.kelvin)}:${l.intensity.toFixed(2)}:${l.pattern}`;
  return l.colour ? `${base}:${l.colour.slice(1).toLowerCase()}` : base;
}

export function parseLightName(name: string): Pick<LightSpec, 'kelvin' | 'colour' | 'intensity' | 'pattern'> | null {
  const m = /^lx:(\d{3,5}):(\d(?:\.\d+)?):(steady|pulse|blink|flicker)(?::([0-9a-f]{6}))?$/.exec(name);
  if (!m) return null;
  return { kelvin: Number(m[1]), intensity: Number(m[2]), pattern: m[3] as LightPattern, colour: m[4] ? `#${m[4]}` : null };
}

/** A cartridge name: the preset's own when it still matches, else the light described. */
export function lightSpecName(l: Pick<LightSpec, 'kelvin' | 'colour' | 'intensity' | 'pattern'>): string {
  const named = LIGHT_PRESETS.find((p) => p.kelvin === l.kelvin && p.colour === l.colour && Math.abs(p.intensity - l.intensity) < 1e-6 && p.pattern === l.pattern);
  if (named) return named.name;
  const what = l.colour ? `Signal ${l.colour}` : `${Math.round(l.kelvin)} K`;
  return l.pattern === 'steady' ? what : `${what}, ${PATTERN_LABEL[l.pattern].toLowerCase()}`;
}

/** A lamp the beam can set (like for like): a part drawn in the lamp material or a light preset, or a part with a lens slot. */
export function isLampPart(p: PlacedPart): boolean {
  if (p.material === 'lamp' || p.material.startsWith('lx:')) return true;
  return p.source.kind === 'param' && (GENERATORS[p.source.gen]?.slots.includes('lens') ?? false);
}

/**
 * The override that sets a lamp to a light, kept on top of what the part already had: a lamp part takes it whole, a
 * Shape Press lamp on its lens only (its housing keeps its own). Null for a part that is not a lamp.
 */
export function lightOverride(l: Pick<LightSpec, 'kelvin' | 'colour' | 'intensity' | 'pattern'>, p: PlacedPart, existing?: PartOverride): PartOverride | null {
  if (!isLampPart(p)) return null;
  const name = lightName(l);
  if (p.source.kind === 'param' && GENERATORS[p.source.gen]?.slots.includes('lens')) {
    return { ...existing, slotMaterials: { ...(p.slotMaterials ?? {}), lens: name } };
  }
  return { ...existing, material: name };
}
