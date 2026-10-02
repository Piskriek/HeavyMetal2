import type { SfxLayer, SfxRecipe, Wave } from './recipe';

const TONE: Record<Wave, string> = { sine: 'soft', triangle: 'hollow', sawtooth: 'buzzy', square: 'crunchy', noise: 'airy' };
const NAME: Record<Wave, string> = { sine: 'Sine', triangle: 'Triangle', sawtooth: 'Sawtooth', square: 'Square', noise: 'Noise' };

const hz = (v: number): string => `${Math.round(v)} Hz`;

/** One layer in plain words: "Sawtooth sliding 140 to 600 Hz, 30 ms attack, 370 ms decay, lowpass 800 Hz". */
export function describeLayer(l: SfxLayer): string {
  const parts: string[] = [];
  if (l.wave === 'noise') parts.push('Noise');
  else if (Math.round(l.freq[0]) === Math.round(l.freq[1])) parts.push(`${NAME[l.wave]} at ${hz(l.freq[0])}`);
  else parts.push(`${NAME[l.wave]} sliding ${Math.round(l.freq[0])} to ${hz(l.freq[1])}`);
  parts.push(`${Math.round(l.attackMs)} ms attack`, `${Math.round(l.decayMs)} ms decay`);
  if (l.delayMs) parts.push(`starts after ${Math.round(l.delayMs)} ms`);
  if (l.filter) {
    const same = Math.round(l.filter.freq[0]) === Math.round(l.filter.freq[1]);
    parts.push(`${l.filter.type} ${same ? hz(l.filter.freq[0]) : `${Math.round(l.filter.freq[0])} to ${hz(l.filter.freq[1])}`}`);
  }
  return parts.join(', ');
}

/** The whole sound in one sentence a non-expert can read. */
export function describeRecipe(r: SfxRecipe): string {
  const layers = r.layers;
  const seconds = (r.durationMs / 1000).toFixed(2);
  const length = r.durationMs < 80 ? 'very short' : r.durationMs < 250 ? 'short' : r.durationMs < 700 ? 'medium' : 'long';
  if (!layers.length) return `A silent ${length} sound (${seconds} s)`;
  // the main layer is the loudest one that has a pitch, or the loudest of all
  const pitched = layers.filter((l) => l.wave !== 'noise');
  const pool = pitched.length ? pitched : layers;
  const main = pool.reduce((a, b) => (b.gain > a.gain ? b : a));
  // direction over the whole sound: from the first note's start to the last note's end
  const ordered = [...pool].sort((x, y) => (x.delayMs ?? 0) - (y.delayMs ?? 0));
  const ratio = ordered[ordered.length - 1]!.freq[1] / Math.max(1, ordered[0]!.freq[0]);
  const dir = main.wave === 'noise' ? 'sweeping' : ratio > 1.15 ? 'rising' : ratio < 0.87 ? 'falling' : 'steady';
  const noisy = layers.some((l) => l.wave === 'noise') && main.wave !== 'noise';
  const tone = TONE[main.wave];
  const notes = new Set(layers.filter((l) => l.delayMs && l.delayMs > 20).map((l) => l.delayMs)).size + 1;
  const shape = main.wave === 'noise' ? 'whoosh' : notes >= 3 ? 'run of notes' : notes === 2 ? 'two-tone beep' : r.durationMs < 80 ? 'blip' : 'tone';
  const edge = noisy ? ' with a crunchy edge' : main.wave === 'square' || main.wave === 'sawtooth' ? ' with a bright edge' : '';
  const article = /^[aeiou]/.test(length) ? 'An' : 'A';
  return `${article} ${length} ${dir} ${tone} ${shape}${edge} (${seconds} s)`;
}
