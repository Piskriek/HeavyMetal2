export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

export interface SfxLayer {
  wave: Wave;
  freq: readonly [number, number]; // Hz start and end, exponential glide, ignored for noise
  gain: number;
  attackMs: number;
  decayMs: number;
  delayMs?: number;
  detune?: number; // cents
  filter?: { type: 'lowpass' | 'highpass' | 'bandpass'; freq: readonly [number, number]; q: number };
}

export interface SfxRecipe {
  id: string;
  durationMs: number;
  layers: readonly SfxLayer[];
  category: 'race';
}

// Pitches used throughout are standard 12-TET values with A4 = 440 Hz, so the
// countdown/go/pickup/lap/finish/freeze chimes all share a consistent, pleasant
// harmonic palette (mostly C-major family, with A-minor reserved for "freeze").
export const RACE_SOUNDS: readonly SfxRecipe[] = [
  // countdown-beep: a tiny, crisp tick (A5) for "3, 2, 1" — short enough to repeat rapidly without fatigue.
  {
    id: 'countdown-beep',
    durationMs: 150,
    category: 'race',
    layers: [
      { wave: 'triangle', freq: [880, 880], gain: 0.35, attackMs: 2, decayMs: 90 },
      { wave: 'square', freq: [1760, 1760], gain: 0.12, attackMs: 2, decayMs: 60,
        filter: { type: 'lowpass', freq: [4000, 4000], q: 0.7 } },
    ],
  },

  // go: brighter and higher than the countdown ticks, with a short rising glide for a decisive, final feel.
  {
    id: 'go',
    durationMs: 220,
    category: 'race',
    layers: [
      { wave: 'triangle', freq: [1046.5, 1318.51], gain: 0.4, attackMs: 2, decayMs: 160 },
      { wave: 'square', freq: [2093, 2093], gain: 0.15, attackMs: 2, decayMs: 80,
        filter: { type: 'lowpass', freq: [6000, 6000], q: 0.7 } },
      { wave: 'sine', freq: [2637, 2637], gain: 0.1, attackMs: 5, decayMs: 120, delayMs: 20 },
    ],
  },

  // boost: a filtered sawtooth whoosh sweeping upward in pitch and brightness, topped with a quick sparkle.
  {
    id: 'boost',
    durationMs: 500,
    category: 'race',
    layers: [
      { wave: 'sawtooth', freq: [150, 900], gain: 0.3, attackMs: 10, decayMs: 350,
        filter: { type: 'lowpass', freq: [300, 4000], q: 1 } },
      { wave: 'noise', freq: [20, 20], gain: 0.15, attackMs: 5, decayMs: 300,
        filter: { type: 'bandpass', freq: [800, 3000], q: 2 } },
      { wave: 'sine', freq: [1800, 3600], gain: 0.12, attackMs: 5, decayMs: 200, delayMs: 150 },
    ],
  },

  // jump: a springy, cartoonish up-glide that snaps upward fast and decays quickly like a rubber bounce.
  {
    id: 'jump',
    durationMs: 220,
    category: 'race',
    layers: [
      { wave: 'sine', freq: [300, 900], gain: 0.4, attackMs: 2, decayMs: 150 },
      { wave: 'triangle', freq: [600, 1400], gain: 0.15, attackMs: 2, decayMs: 100, delayMs: 10 },
    ],
  },

  // item-pickup: a happy ascending C-major chime (C6-E6-G6) for a rewarding, friendly ping.
  {
    id: 'item-pickup',
    durationMs: 300,
    category: 'race',
    layers: [
      { wave: 'triangle', freq: [1046.5, 1046.5], gain: 0.3, attackMs: 2, decayMs: 120 },
      { wave: 'triangle', freq: [1318.51, 1318.51], gain: 0.25, attackMs: 2, decayMs: 150, delayMs: 70 },
      { wave: 'sine', freq: [1567.98, 1567.98], gain: 0.15, attackMs: 2, decayMs: 150, delayMs: 140 },
    ],
  },

  // hit-wall: a low dull thud with a brief filtered-noise crunch, never harsh — glass-ball-on-rock feel.
  {
    id: 'hit-wall',
    durationMs: 220,
    category: 'race',
    layers: [
      { wave: 'sine', freq: [120, 60], gain: 0.45, attackMs: 1, decayMs: 140 },
      { wave: 'noise', freq: [20, 20], gain: 0.2, attackMs: 1, decayMs: 80,
        filter: { type: 'lowpass', freq: [800, 200], q: 1 } },
    ],
  },

  // hit-racer: a rubbery, bouncy bonk between two glass balls — slightly higher and springier than hit-wall.
  {
    id: 'hit-racer',
    durationMs: 200,
    category: 'race',
    layers: [
      { wave: 'triangle', freq: [220, 110], gain: 0.4, attackMs: 1, decayMs: 120 },
      { wave: 'sine', freq: [440, 220], gain: 0.2, attackMs: 1, decayMs: 90, delayMs: 10 },
      { wave: 'noise', freq: [20, 20], gain: 0.08, attackMs: 1, decayMs: 40,
        filter: { type: 'bandpass', freq: [500, 500], q: 3 } },
    ],
  },

  // splash: filtered noise burst for the water impact, with a short rising bubble pop sine on top.
  {
    id: 'splash',
    durationMs: 400,
    category: 'race',
    layers: [
      { wave: 'noise', freq: [20, 20], gain: 0.35, attackMs: 2, decayMs: 250,
        filter: { type: 'bandpass', freq: [1200, 400], q: 1.2 } },
      { wave: 'sine', freq: [300, 200], gain: 0.1, attackMs: 2, decayMs: 150,
        filter: { type: 'lowpass', freq: [500, 500], q: 1 } },
      { wave: 'sine', freq: [600, 900], gain: 0.12, attackMs: 5, decayMs: 80, delayMs: 180 },
    ],
  },

  // lap: a short three-note rising fanfare (C5-E5-G5) plus a high sparkle, celebrating a completed lap.
  {
    id: 'lap',
    durationMs: 350,
    category: 'race',
    layers: [
      { wave: 'triangle', freq: [523.25, 523.25], gain: 0.3, attackMs: 2, decayMs: 90 },
      { wave: 'triangle', freq: [659.25, 659.25], gain: 0.3, attackMs: 2, decayMs: 90, delayMs: 90 },
      { wave: 'triangle', freq: [783.99, 783.99], gain: 0.3, attackMs: 2, decayMs: 140, delayMs: 180 },
      { wave: 'sine', freq: [1567.98, 1567.98], gain: 0.1, attackMs: 2, decayMs: 100, delayMs: 220 },
    ],
  },

  // finish: a bigger, longer triumphant arpeggio (C5-E5-G5-C6) with a bright final sparkle, the race's victory flourish.
  {
    id: 'finish',
    durationMs: 650,
    category: 'race',
    layers: [
      { wave: 'triangle', freq: [523.25, 523.25], gain: 0.25, attackMs: 2, decayMs: 120 },
      { wave: 'triangle', freq: [659.25, 659.25], gain: 0.25, attackMs: 2, decayMs: 120, delayMs: 130 },
      { wave: 'triangle', freq: [783.99, 783.99], gain: 0.25, attackMs: 2, decayMs: 150, delayMs: 260 },
      { wave: 'square', freq: [1046.5, 1046.5], gain: 0.2, attackMs: 2, decayMs: 250, delayMs: 390,
        filter: { type: 'lowpass', freq: [6000, 6000], q: 1 } },
      { wave: 'sine', freq: [2093, 2093], gain: 0.1, attackMs: 2, decayMs: 200, delayMs: 400 },
    ],
  },

  // respawn: a soft upward pop followed by a light sparkle glide, like gentle magic reassembling the glass ball.
  {
    id: 'respawn',
    durationMs: 400,
    category: 'race',
    layers: [
      { wave: 'sine', freq: [200, 600], gain: 0.3, attackMs: 5, decayMs: 100 },
      { wave: 'triangle', freq: [1200, 1800], gain: 0.15, attackMs: 5, decayMs: 150, delayMs: 60 },
      { wave: 'sine', freq: [2400, 2400], gain: 0.08, attackMs: 10, decayMs: 180, delayMs: 120 },
    ],
  },

  // oil: a squelchy downward wobble using a swept lowpass on a sawtooth plus a gritty bandpassed square for texture.
  {
    id: 'oil',
    durationMs: 350,
    category: 'race',
    layers: [
      { wave: 'sawtooth', freq: [500, 150], gain: 0.3, attackMs: 5, decayMs: 250,
        filter: { type: 'lowpass', freq: [2000, 300], q: 3 } },
      { wave: 'square', freq: [300, 100], gain: 0.15, attackMs: 5, decayMs: 200, delayMs: 30,
        filter: { type: 'bandpass', freq: [800, 200], q: 4 } },
      { wave: 'noise', freq: [20, 20], gain: 0.1, attackMs: 5, decayMs: 150,
        filter: { type: 'bandpass', freq: [400, 200], q: 2 } },
    ],
  },

  // shockwave: a deep sine/triangle boom with sub weight, plus an airy filtered-noise crack and a ringing resonance tail.
  {
    id: 'shockwave',
    durationMs: 700,
    category: 'race',
    layers: [
      { wave: 'sine', freq: [80, 40], gain: 0.45, attackMs: 2, decayMs: 500 },
      { wave: 'triangle', freq: [60, 30], gain: 0.2, attackMs: 2, decayMs: 450, delayMs: 20 },
      { wave: 'noise', freq: [20, 20], gain: 0.12, attackMs: 2, decayMs: 300,
        filter: { type: 'bandpass', freq: [3000, 6000], q: 2 } },
      { wave: 'sine', freq: [1200, 1800], gain: 0.08, attackMs: 10, decayMs: 400, delayMs: 100,
        filter: { type: 'bandpass', freq: [1500, 1500], q: 5 } },
    ],
  },

  // freeze: an icy descending A-minor chime (A6-E6-C6) through a highpass filter, with a shimmering high overtone.
  {
    id: 'freeze',
    durationMs: 450,
    category: 'race',
    layers: [
      { wave: 'triangle', freq: [1760, 1760], gain: 0.25, attackMs: 2, decayMs: 120,
        filter: { type: 'highpass', freq: [800, 800], q: 1 } },
      { wave: 'triangle', freq: [1318.51, 1318.51], gain: 0.25, attackMs: 2, decayMs: 130, delayMs: 100,
        filter: { type: 'highpass', freq: [800, 800], q: 1 } },
      { wave: 'triangle', freq: [1046.5, 1046.5], gain: 0.25, attackMs: 2, decayMs: 180, delayMs: 200,
        filter: { type: 'highpass', freq: [600, 600], q: 1 } },
      { wave: 'sine', freq: [3520, 3520], gain: 0.1, attackMs: 2, decayMs: 150, delayMs: 220 },
    ],
  },
];

export const RACE_NOTES: Record<string, string> = {
  'countdown-beep':
    'A tiny, bright A5 tick under 250ms, designed to be repeated three times without ever feeling tiring or sharp.',
  'go':
    'A quick rising C6-to-E6 glide with an extra bright harmonic layer, pitched higher than the countdown ticks so it reads as the louder, final cue.',
  'boost':
    'A lowpass-swept sawtooth whoosh that rises in pitch and brightness as the filter opens, capped with a short delayed sparkle to sell the speed burst.',
  'jump':
    'A simple fast up-glide on sine plus triangle, mimicking a rubber-ball spring with a soft attack and a quick decay so it stays bouncy, not boingy.',
  'item-pickup':
    'A cheerful ascending C-major triad (C6-E6-G6) played as a staggered arpeggio to sound like a friendly, rewarding chime.',
  'hit-wall':
    'A low sine thud paired with a short lowpass-filtered noise crunch, kept soft and rounded so a glass-ball collision feels cartoonish rather than violent.',
  'hit-racer':
    'A bouncy triangle-and-sine bonk with a tiny resonant noise click, pitched higher and springier than hit-wall to distinguish racer-on-racer contact.',
  'splash':
    'A bandpass-filtered noise burst for the water impact, layered with a low filtered rumble and a short rising bubble-pop sine for a playful tropical splash.',
  'lap':
    'A three-note rising C-major fanfare (C5-E5-G5) with a delayed high sparkle, short and punchy so it does not overstay its welcome mid-race.',
  'finish':
    'A longer four-note C-major arpeggio finishing on a filtered square-wave high C with a shimmering sparkle tail, giving the win a fuller, triumphant payoff.',
  'respawn':
    'A soft rising sine pop followed by a gentle triangle sparkle glide and a faint high shimmer, evoking a glass ball gently reforming by magic.',
  'oil':
    'A downward-swept, heavily filtered sawtooth and square combo that wobbles and squelches like a ball skidding through slick volcanic oil.',
  'shockwave':
    'A deep sine-and-triangle boom for weight, layered with an airy high-bandpass noise crack and a faint ringing resonance tail for scale.',
  'freeze':
    'A descending A-minor chime (A6-E6-C6) pushed through a highpass filter with a high shimmering overtone, giving it a crisp, icy character distinct from the warmer major chimes.',
};