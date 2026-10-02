import { CATEGORIES, WAVES, normalizeRecipe, type SfxLayer, type SfxRecipe, type Wave } from './recipe';
import { mulberry32 } from './render';

export type SfxKind = 'pickup' | 'laser' | 'explosion' | 'powerup' | 'hit' | 'jump' | 'blip' | 'whoosh' | 'click' | 'boing';

export const SFX_KINDS: readonly { kind: SfxKind; label: string; doc: string }[] = [
  { kind: 'pickup', label: 'Pickup', doc: 'A quick rising two-note blip, like grabbing a coin.' },
  { kind: 'laser', label: 'Laser', doc: 'A fast falling zap.' },
  { kind: 'explosion', label: 'Explosion', doc: 'A long rumbling crash that fades away.' },
  { kind: 'powerup', label: 'Power-up', doc: 'A rising run of notes, like a level-up.' },
  { kind: 'hit', label: 'Hit', doc: 'A short thud with a crunch.' },
  { kind: 'jump', label: 'Jump', doc: 'A springy upward slide.' },
  { kind: 'blip', label: 'Blip', doc: 'A tiny beep for buttons.' },
  { kind: 'whoosh', label: 'Whoosh', doc: 'Air rushing past.' },
  { kind: 'click', label: 'Click', doc: 'A crisp little tick.' },
  { kind: 'boing', label: 'Boing', doc: 'A wobbly bounce.' },
];

type Rand = () => number;
const span = (r: Rand, a: number, b: number): number => a + (b - a) * r();
const pick = <T,>(r: Rand, items: readonly T[]): T => items[Math.floor(r() * items.length) % items.length]!;
const L = (wave: Wave, f0: number, f1: number, gain: number, attackMs: number, decayMs: number, extra: Partial<SfxLayer> = {}): SfxLayer =>
  ({ wave, freq: [f0, f1], gain, attackMs, decayMs, ...extra });

function layersFor(kind: SfxKind, r: Rand): SfxLayer[] {
  switch (kind) {
    case 'pickup': {
      const f = span(r, 520, 820), w = pick(r, ['square', 'triangle'] as const), d = span(r, 70, 100);
      return [L(w, f, f * 1.03, 0.22, 2, 110), L(w, f * 1.5, f * 1.55, 0.22, 2, 150, { delayMs: d }), L('sine', f * 3, f * 3, 0.07, 2, 160, { delayMs: d })];
    }
    case 'laser': {
      const f = span(r, 1400, 2600);
      return [L(pick(r, ['sawtooth', 'square'] as const), f, span(r, 110, 260), 0.26, 1, span(r, 180, 300)), L('noise', 200, 200, 0.08, 1, 60, { filter: { type: 'highpass', freq: [3000, 3000], q: 1 } })];
    }
    case 'explosion':
      return [
        L('noise', 200, 200, 0.5, 2, span(r, 900, 1300), { filter: { type: 'lowpass', freq: [span(r, 2200, 3200), span(r, 90, 160)], q: 1 } }),
        L('sine', span(r, 90, 130), 28, 0.5, 2, span(r, 600, 900)),
        L('noise', 200, 200, 0.25, 1, 120, { filter: { type: 'bandpass', freq: [1800, 900], q: 0.8 } }),
      ];
    case 'powerup': {
      const f = span(r, 330, 520), w = pick(r, ['square', 'sawtooth', 'triangle'] as const), gap = span(r, 55, 80);
      return [1, 1.26, 1.5, 2].map((m, i) => L(w, f * m, f * m * 1.01, 0.2, 2, 90 + i * 20, { delayMs: Math.round(i * gap) }));
    }
    case 'hit':
      return [L('noise', 200, 200, 0.45, 1, span(r, 110, 170), { filter: { type: 'lowpass', freq: [3200, 450], q: 1.2 } }), L('sine', span(r, 160, 220), 48, 0.5, 1, span(r, 140, 190))];
    case 'jump': {
      const f = span(r, 230, 330);
      return [L(pick(r, ['sine', 'square'] as const), f, f * span(r, 2.2, 3), 0.26, 4, span(r, 190, 260)), L('triangle', f * 2, f * 5, 0.07, 4, 180)];
    }
    case 'blip':
      return [L(pick(r, ['sine', 'square'] as const), span(r, 700, 1500), span(r, 700, 1500), 0.2, 1, span(r, 45, 80))];
    case 'whoosh': {
      const up = r() < 0.5;
      return [
        L('noise', 200, 200, 0.42, span(r, 100, 180), span(r, 300, 450), { filter: { type: 'bandpass', freq: up ? [300, 3200] : [3200, 300], q: span(r, 1.5, 3) } }),
        L('noise', 200, 200, 0.14, 30, 500, { filter: { type: 'highpass', freq: [1500, 1500], q: 0.7 } }),
      ];
    }
    case 'click':
      return [L('noise', 200, 200, 0.4, 0, span(r, 15, 30), { filter: { type: 'highpass', freq: [2500, 2500], q: 1 } }), L('sine', 1800, 900, 0.2, 0, span(r, 18, 32))];
    case 'boing': {
      const f = span(r, 180, 260);
      return [L('sine', f, f * 3.2, 0.3, 3, 150), L('sine', f * 3.2, f * 1.1, 0.28, 3, 260, { delayMs: 150 }), L('triangle', f * 1.5, f * 4, 0.1, 3, 150, { detune: 35 }), L('triangle', f * 4, f * 1.7, 0.1, 3, 260, { delayMs: 150, detune: -35 })];
    }
  }
}

/** A recognisable sound of the chosen kind. Same seed and kind give the same recipe; other seeds give variations. */
export function randomRecipe(seed: number, kind: SfxKind, category: SfxRecipe['category'] = 'race'): SfxRecipe {
  const r = mulberry32(Math.floor(seed) * 2654435761 + SFX_KINDS.findIndex((k) => k.kind === kind) * 97 + 13);
  return normalizeRecipe({ id: `${kind}-${seed}`, category, durationMs: 1, layers: layersFor(kind, r) });
}

/** Wiggle a recipe. amount 0 changes nothing; 1 changes a lot. The result is always playable. */
export function mutateRecipe(recipe: SfxRecipe, seed: number, amount: number): SfxRecipe {
  const a = Math.min(1, Math.max(0, amount));
  if (!(a > 0)) return { ...recipe, layers: recipe.layers.map((l) => ({ ...l })) };
  const r = mulberry32(Math.floor(seed) * 1597334677 + 7);
  const jit = (v: number, width: number): number => v * (1 + (r() * 2 - 1) * width * a);
  let layers: SfxLayer[] = recipe.layers.map((l) => {
    const next: SfxLayer = {
      ...l,
      freq: [jit(l.freq[0], 0.6), jit(l.freq[1], 0.6)],
      gain: jit(l.gain, 0.3),
      attackMs: jit(l.attackMs, 0.4),
      decayMs: jit(l.decayMs, 0.4),
      ...(l.delayMs ? { delayMs: jit(l.delayMs, 0.4) } : {}),
      ...(l.filter ? { filter: { ...l.filter, freq: [jit(l.filter.freq[0], 0.6), jit(l.filter.freq[1], 0.6)] as const } } : {}),
    };
    if (r() < 0.25 * a) next.wave = pick(r, WAVES.filter((w) => w !== l.wave));
    return next;
  });
  if (a > 0.6) {
    if (layers.length < 8 && r() < 0.5) {
      const src = pick(r, layers);
      layers = [...layers, { ...src, gain: src.gain * 0.5, freq: [src.freq[0] * span(r, 0.5, 2), src.freq[1] * span(r, 0.5, 2)], delayMs: (src.delayMs ?? 0) + Math.round(span(r, 0, 60)) }];
    } else if (layers.length > 1) layers = layers.filter((_, i) => i !== Math.floor(r() * layers.length));
  }
  return normalizeRecipe({ ...recipe, layers });
}

/** A child that takes layers from either parent. */
export function crossRecipes(a: SfxRecipe, b: SfxRecipe, seed: number): SfxRecipe {
  const r = mulberry32(Math.floor(seed) * 69069 + 3);
  const n = Math.max(a.layers.length, b.layers.length);
  const layers: SfxLayer[] = [];
  for (let i = 0; i < n; i++) {
    const from = r() < 0.5 ? [a.layers[i], b.layers[i]] : [b.layers[i], a.layers[i]];
    const l = from[0] ?? from[1];
    if (l) layers.push({ ...l });
  }
  return normalizeRecipe({ id: `${a.id}+${b.id}`, category: CATEGORIES.includes(a.category) ? a.category : 'race', durationMs: 1, layers });
}
