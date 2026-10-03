/**
 * A sound effect as data: layers of oscillators and noise with envelopes and filters. The same shape the game's audio player
 * plays, so a recipe can be validated, edited, randomized and then handed straight to the player.
 */

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
export const WAVES: readonly Wave[] = ['sine', 'square', 'sawtooth', 'triangle', 'noise'];
export const CATEGORIES = ['race', 'editor', 'ui'] as const;
export const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'] as const;

export interface SfxFilter { type: (typeof FILTER_TYPES)[number]; freq: readonly [number, number]; q: number }
export interface SfxLayer {
  wave: Wave;
  /** Hz at the start and the end of the note: an exponential glide. Ignored for noise. */
  freq: readonly [number, number];
  gain: number;
  attackMs: number;
  decayMs: number;
  delayMs?: number;
  /** Cents. */
  detune?: number;
  filter?: SfxFilter;
}
export interface SfxRecipe { id: string; durationMs: number; layers: readonly SfxLayer[]; category: (typeof CATEGORIES)[number] }

/** Where the sliders sit comfortably (a slider grows past its end when pushed; these are not limits). */
export const RANGES = {
  freq: { min: 20, max: 4000 },
  q: { min: 0.1, max: 20 },
  gain: { min: 0, max: 1 },
  attackMs: { min: 0, max: 500 },
  decayMs: { min: 1, max: 1600 },
  delayMs: { min: 0, max: 1500 },
  detune: { min: -1200, max: 1200 },
} as const;

/** What a value may never pass: only where it stops making sense (inaudible, or longer than a game sound should hold the channel). */
export const LIMITS = {
  layers: { min: 1, max: 8 },
  freq: { min: 20, max: 20000 },
  q: { min: 0.1, max: 60 },
  gain: { min: 0, max: 2 },
  attackMs: { min: 0, max: 5000 },
  decayMs: { min: 1, max: 12000 },
  delayMs: { min: 0, max: 8000 },
  detune: { min: -4800, max: 4800 },
  durationMs: { min: 1, max: 20000 },
} as const;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const num = (v: unknown, fallback: number): number => (isNum(v) ? v : fallback);

export function layerEndMs(l: SfxLayer): number {
  return (l.delayMs ?? 0) + l.attackMs + l.decayMs;
}

const between = (name: string, v: unknown, lim: { min: number; max: number }, unit = ''): string | null =>
  !isNum(v) ? `${name} must be a number` : v < lim.min || v > lim.max ? `${name} must be between ${lim.min} and ${lim.max}${unit}` : null;

export function validateRecipe(r: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const push = (e: string | null): void => { if (e) errors.push(e); };
  try {
    if (!isObj(r)) return { ok: false, errors: ['A sound recipe must be an object with an id, a duration and layers.'] };
    if (typeof r['id'] !== 'string' || r['id'] === '') errors.push('The recipe needs a name (id).');
    if (!(CATEGORIES as readonly unknown[]).includes(r['category'])) errors.push(`The category must be one of ${CATEGORIES.join(', ')}.`);
    push(between('The duration', r['durationMs'], LIMITS.durationMs, ' ms'));
    const layers = r['layers'];
    if (!Array.isArray(layers) || layers.length < LIMITS.layers.min || layers.length > LIMITS.layers.max) {
      errors.push(`A recipe needs between ${LIMITS.layers.min} and ${LIMITS.layers.max} layers.`);
    } else {
      layers.forEach((l: unknown, i: number) => {
        const at = `layer ${i + 1}`;
        if (!isObj(l)) { errors.push(`${at}: must be an object`); return; }
        if (!(WAVES as readonly unknown[]).includes(l['wave'])) errors.push(`${at}: wave must be one of ${WAVES.join(', ')}`);
        const f = l['freq'];
        if (!Array.isArray(f) || f.length !== 2) errors.push(`${at}: freq must be two numbers (start and end Hz)`);
        else f.forEach((x, k) => push(between(`${at}: ${k === 0 ? 'start' : 'end'} frequency`, x, LIMITS.freq, ' Hz')));
        push(between(`${at}: gain`, l['gain'], LIMITS.gain));
        push(between(`${at}: attack`, l['attackMs'], LIMITS.attackMs, ' ms'));
        push(between(`${at}: decay`, l['decayMs'], LIMITS.decayMs, ' ms'));
        if (l['delayMs'] !== undefined) push(between(`${at}: delay`, l['delayMs'], LIMITS.delayMs, ' ms'));
        if (l['detune'] !== undefined) push(between(`${at}: detune`, l['detune'], LIMITS.detune, ' cents'));
        if (l['filter'] !== undefined) {
          const fl = l['filter'];
          if (!isObj(fl)) errors.push(`${at}: filter must be an object`);
          else {
            if (!(FILTER_TYPES as readonly unknown[]).includes(fl['type'])) errors.push(`${at}: filter type must be one of ${FILTER_TYPES.join(', ')}`);
            const ff = fl['freq'];
            if (!Array.isArray(ff) || ff.length !== 2) errors.push(`${at}: filter freq must be two numbers`);
            else ff.forEach((x, k) => push(between(`${at}: filter ${k === 0 ? 'start' : 'end'} cutoff`, x, LIMITS.freq, ' Hz')));
            push(between(`${at}: filter q`, fl['q'], LIMITS.q));
          }
        }
        if (isNum(l['attackMs']) && isNum(l['decayMs']) && isNum(r['durationMs'])) {
          const end = num(l['delayMs'], 0) + l['attackMs'] + l['decayMs'];
          if (end > r['durationMs']) errors.push(`${at}: it lasts until ${Math.round(end)} ms but the recipe is only ${Math.round(r['durationMs'])} ms long`);
        }
      });
    }
  } catch (e) {
    errors.push(`The recipe could not be checked: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { ok: errors.length === 0, errors };
}

function normalizeLayer(l: SfxLayer): SfxLayer {
  const wave = (WAVES as readonly unknown[]).includes(l.wave) ? l.wave : 'sine';
  const hz = (v: unknown, d: number): number => clamp(num(v, d), LIMITS.freq.min, LIMITS.freq.max);
  const delayMs = clamp(num(l.delayMs, 0), LIMITS.delayMs.min, LIMITS.delayMs.max);
  const attackMs = clamp(num(l.attackMs, 0), LIMITS.attackMs.min, LIMITS.attackMs.max);
  const decayMs = clamp(num(l.decayMs, 100), LIMITS.decayMs.min, Math.min(LIMITS.decayMs.max, Math.max(1, LIMITS.durationMs.max - delayMs - attackMs)));
  const out: SfxLayer = {
    wave, freq: [hz(l.freq?.[0], 440), hz(l.freq?.[1], 440)], gain: clamp(num(l.gain, 0.2), LIMITS.gain.min, LIMITS.gain.max), attackMs, decayMs,
    ...(delayMs > 0 ? { delayMs } : {}),
    ...(l.detune ? { detune: clamp(num(l.detune, 0), LIMITS.detune.min, LIMITS.detune.max) } : {}),
  };
  if (l.filter) {
    const type = (FILTER_TYPES as readonly unknown[]).includes(l.filter.type) ? l.filter.type : 'lowpass';
    return { ...out, filter: { type, freq: [hz(l.filter.freq?.[0], 1000), hz(l.filter.freq?.[1], 1000)], q: clamp(num(l.filter.q, 1), LIMITS.q.min, LIMITS.q.max) } };
  }
  return out;
}

/** Clamp everything into the limits, keep at least one and at most eight layers, and make the duration cover every layer. */
export function normalizeRecipe(r: SfxRecipe): SfxRecipe {
  const raw = Array.isArray(r.layers) ? r.layers.slice(0, LIMITS.layers.max) : [];
  const layers = raw.length ? raw.map(normalizeLayer) : [{ wave: 'sine' as const, freq: [440, 440] as const, gain: 0.05, attackMs: 2, decayMs: 100 }];
  const longest = Math.max(...layers.map(layerEndMs));
  return {
    id: typeof r.id === 'string' && r.id ? r.id : 'sound',
    category: (CATEGORIES as readonly unknown[]).includes(r.category) ? r.category : 'race',
    durationMs: clamp(Math.max(num(r.durationMs, 0), longest), LIMITS.durationMs.min, LIMITS.durationMs.max),
    layers,
  };
}

export function cloneRecipe(r: SfxRecipe): SfxRecipe {
  return JSON.parse(JSON.stringify(r)) as SfxRecipe;
}

/** Stable key order, 2-space indent: friendly to diffs and to people. */
export function recipeToJson(r: SfxRecipe): string {
  const layer = (l: SfxLayer): Record<string, unknown> => ({
    wave: l.wave, freq: [l.freq[0], l.freq[1]], gain: l.gain, attackMs: l.attackMs, decayMs: l.decayMs,
    ...(l.delayMs !== undefined ? { delayMs: l.delayMs } : {}), ...(l.detune !== undefined ? { detune: l.detune } : {}),
    ...(l.filter ? { filter: { type: l.filter.type, freq: [l.filter.freq[0], l.filter.freq[1]], q: l.filter.q } } : {}),
  });
  return JSON.stringify({ id: r.id, category: r.category, durationMs: r.durationMs, layers: r.layers.map(layer) }, null, 2);
}

export function recipeFromJson(text: string): { recipe: SfxRecipe | null; errors: string[] } {
  let data: unknown;
  try { data = JSON.parse(text); } catch (e) { return { recipe: null, errors: [`That is not valid JSON: ${e instanceof Error ? e.message : String(e)}`] }; }
  const check = validateRecipe(data);
  return check.ok ? { recipe: data as SfxRecipe, errors: [] } : { recipe: null, errors: check.errors };
}
