export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

export interface SfxLayer {
  wave: Wave;
  freq: readonly [number, number]; /* Hz at start and end, exponential glide; ignored for noise */
  gain: number; /* 0..1 */
  attackMs: number;
  decayMs: number;
  delayMs?: number;
  detune?: number; /* cents */
  filter?: {
    type: 'lowpass' | 'highpass' | 'bandpass';
    freq: readonly [number, number];
    q: number;
  };
}

export interface SfxRecipe {
  id: SfxId;
  durationMs: number; /* >= every layer's delay + attack + decay, <= 1600 */
  layers: readonly SfxLayer[];
  category: 'race' | 'editor' | 'ui';
}

export const SFX_IDS = [
  'countdown-beep',
  'go',
  'boost',
  'jump',
  'item-pickup',
  'hit-wall',
  'hit-racer',
  'splash',
  'lap',
  'finish',
  'respawn',
  'oil',
  'shockwave',
  'freeze',
  'ui-click',
  'ui-hover',
  'ui-toggle',
  'ui-error',
  'ui-success',
  'paint-tick',
  'sculpt-tick',
  'place',
  'delete',
  'undo',
  'redo',
  'snap',
  'select',
  'tool-switch',
  'save',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

export const SFX: Readonly<Record<SfxId, SfxRecipe>> = {
  'countdown-beep': {
    id: 'countdown-beep',
    durationMs: 150,
    category: 'race',
    layers: [
      { wave: 'square', freq: [880, 880], gain: 0.25, attackMs: 2, decayMs: 148 },
      { wave: 'sine', freq: [880, 880], gain: 0.2, attackMs: 2, decayMs: 148 },
    ],
  },
  'go': {
    id: 'go',
    durationMs: 350,
    category: 'race',
    layers: [
      { wave: 'square', freq: [1320, 1320], gain: 0.28, attackMs: 2, decayMs: 340 },
      { wave: 'sine', freq: [1320, 1320], gain: 0.35, attackMs: 2, decayMs: 340 },
    ],
  },
  'boost': {
    id: 'boost',
    durationMs: 400,
    category: 'race',
    layers: [
      { wave: 'sawtooth', freq: [140, 600], gain: 0.3, attackMs: 30, decayMs: 370 },
      {
        wave: 'noise',
        freq: [200, 200],
        gain: 0.25,
        attackMs: 20,
        decayMs: 380,
        filter: { type: 'bandpass', freq: [800, 3200], q: 1.5 },
      },
    ],
  },
  'jump': {
    id: 'jump',
    durationMs: 260,
    category: 'race',
    layers: [
      { wave: 'sine', freq: [180, 520], gain: 0.4, attackMs: 10, decayMs: 250 },
      { wave: 'triangle', freq: [360, 1040], gain: 0.15, attackMs: 10, decayMs: 240 },
    ],
  },
  'item-pickup': {
    id: 'item-pickup',
    durationMs: 320,
    category: 'race',
    layers: [
      { wave: 'sine', freq: [587.33, 587.33], gain: 0.25, attackMs: 2, decayMs: 78, delayMs: 0 },
      { wave: 'sine', freq: [739.99, 739.99], gain: 0.25, attackMs: 2, decayMs: 78, delayMs: 80 },
      { wave: 'sine', freq: [880.0, 880.0], gain: 0.25, attackMs: 2, decayMs: 78, delayMs: 160 },
      { wave: 'sine', freq: [1174.66, 1174.66], gain: 0.3, attackMs: 2, decayMs: 78, delayMs: 240 },
    ],
  },
  'hit-wall': {
    id: 'hit-wall',
    durationMs: 180,
    category: 'race',
    layers: [
      { wave: 'sine', freq: [130, 45], gain: 0.5, attackMs: 2, decayMs: 175 },
      {
        wave: 'noise',
        freq: [200, 200],
        gain: 0.35,
        attackMs: 2,
        decayMs: 98,
        filter: { type: 'lowpass', freq: [500, 120], q: 1.0 },
      },
    ],
  },
  'hit-racer': {
    id: 'hit-racer',
    durationMs: 160,
    category: 'race',
    layers: [
      { wave: 'triangle', freq: [320, 110], gain: 0.45, attackMs: 2, decayMs: 155 },
      { wave: 'sine', freq: [480, 150], gain: 0.25, attackMs: 2, decayMs: 140 },
    ],
  },
  'splash': {
    id: 'splash',
    durationMs: 350,
    category: 'race',
    layers: [
      {
        wave: 'noise',
        freq: [200, 200],
        gain: 0.45,
        attackMs: 5,
        decayMs: 340,
        filter: { type: 'lowpass', freq: [2600, 400], q: 0.8 },
      },
      { wave: 'sine', freq: [180, 70], gain: 0.25, attackMs: 5, decayMs: 180 },
    ],
  },
  'lap': {
    id: 'lap',
    durationMs: 380,
    category: 'race',
    layers: [
      { wave: 'triangle', freq: [523.25, 523.25], gain: 0.35, attackMs: 5, decayMs: 170, delayMs: 0 },
      { wave: 'triangle', freq: [783.99, 783.99], gain: 0.4, attackMs: 5, decayMs: 195, delayMs: 180 },
    ],
  },
  'finish': {
    id: 'finish',
    durationMs: 1200,
    category: 'race',
    layers: [
      { wave: 'triangle', freq: [523.25, 523.25], gain: 0.3, attackMs: 5, decayMs: 195, delayMs: 0 },
      { wave: 'triangle', freq: [659.25, 659.25], gain: 0.3, attackMs: 5, decayMs: 195, delayMs: 200 },
      { wave: 'triangle', freq: [783.99, 783.99], gain: 0.3, attackMs: 5, decayMs: 195, delayMs: 400 },
      { wave: 'sine', freq: [1046.5, 1046.5], gain: 0.4, attackMs: 10, decayMs: 590, delayMs: 600 },
    ],
  },
  'respawn': {
    id: 'respawn',
    durationMs: 480,
    category: 'race',
    layers: [
      { wave: 'sine', freq: [220, 880], gain: 0.35, attackMs: 20, decayMs: 450 },
      { wave: 'triangle', freq: [440, 1760], gain: 0.2, attackMs: 30, decayMs: 440, detune: 12 },
    ],
  },
  'oil': {
    id: 'oil',
    durationMs: 320,
    category: 'race',
    layers: [
      { wave: 'sawtooth', freq: [380, 95], gain: 0.3, attackMs: 5, decayMs: 310 },
      { wave: 'sine', freq: [260, 65], gain: 0.35, attackMs: 5, decayMs: 310 },
    ],
  },
  'shockwave': {
    id: 'shockwave',
    durationMs: 650,
    category: 'race',
    layers: [
      { wave: 'sine', freq: [120, 30], gain: 0.5, attackMs: 5, decayMs: 640 },
      {
        wave: 'noise',
        freq: [100, 100],
        gain: 0.4,
        attackMs: 5,
        decayMs: 600,
        filter: { type: 'lowpass', freq: [900, 80], q: 2.0 },
      },
    ],
  },
  'freeze': {
    id: 'freeze',
    durationMs: 420,
    category: 'race',
    layers: [
      { wave: 'sine', freq: [1760, 1760], gain: 0.25, attackMs: 2, decayMs: 200, delayMs: 0 },
      { wave: 'sine', freq: [2637, 2637], gain: 0.25, attackMs: 2, decayMs: 210, delayMs: 100 },
      { wave: 'sine', freq: [3520, 3520], gain: 0.2, attackMs: 2, decayMs: 200, delayMs: 210 },
    ],
  },
  'ui-click': {
    id: 'ui-click',
    durationMs: 50,
    category: 'ui',
    layers: [
      { wave: 'sine', freq: [1800, 800], gain: 0.35, attackMs: 1, decayMs: 45 },
      {
        wave: 'noise',
        freq: [100, 100],
        gain: 0.2,
        attackMs: 1,
        decayMs: 25,
        filter: { type: 'highpass', freq: [3000, 3000], q: 1.0 },
      },
    ],
  },
  'ui-hover': {
    id: 'ui-hover',
    durationMs: 35,
    category: 'ui',
    layers: [
      { wave: 'sine', freq: [1200, 900], gain: 0.12, attackMs: 1, decayMs: 30 },
    ],
  },
  'ui-toggle': {
    id: 'ui-toggle',
    durationMs: 80,
    category: 'ui',
    layers: [
      { wave: 'sine', freq: [660, 660], gain: 0.25, attackMs: 2, decayMs: 40, delayMs: 0 },
      { wave: 'sine', freq: [990, 990], gain: 0.25, attackMs: 2, decayMs: 38, delayMs: 40 },
    ],
  },
  'ui-error': {
    id: 'ui-error',
    durationMs: 180,
    category: 'ui',
    layers: [
      { wave: 'square', freq: [165, 160], gain: 0.25, attackMs: 2, decayMs: 85, delayMs: 0 },
      { wave: 'square', freq: [155, 150], gain: 0.25, attackMs: 2, decayMs: 85, delayMs: 90 },
    ],
  },
  'ui-success': {
    id: 'ui-success',
    durationMs: 170,
    category: 'ui',
    layers: [
      { wave: 'sine', freq: [784, 784], gain: 0.3, attackMs: 2, decayMs: 80, delayMs: 0 },
      { wave: 'sine', freq: [988, 988], gain: 0.35, attackMs: 2, decayMs: 85, delayMs: 80 },
    ],
  },
  'paint-tick': {
    id: 'paint-tick',
    durationMs: 65,
    category: 'editor',
    layers: [
      {
        wave: 'noise',
        freq: [100, 100],
        gain: 0.25,
        attackMs: 2,
        decayMs: 60,
        filter: { type: 'bandpass', freq: [1500, 3000], q: 2.0 },
      },
    ],
  },
  'sculpt-tick': {
    id: 'sculpt-tick',
    durationMs: 85,
    category: 'editor',
    layers: [
      { wave: 'sine', freq: [120, 80], gain: 0.4, attackMs: 2, decayMs: 80 },
      {
        wave: 'noise',
        freq: [100, 100],
        gain: 0.2,
        attackMs: 2,
        decayMs: 60,
        filter: { type: 'lowpass', freq: [220, 100], q: 1.0 },
      },
    ],
  },
  'place': {
    id: 'place',
    durationMs: 120,
    category: 'editor',
    layers: [
      { wave: 'sine', freq: [180, 90], gain: 0.45, attackMs: 2, decayMs: 110 },
      {
        wave: 'noise',
        freq: [100, 100],
        gain: 0.25,
        attackMs: 1,
        decayMs: 40,
        filter: { type: 'lowpass', freq: [1200, 500], q: 1.2 },
      },
      { wave: 'triangle', freq: [1400, 1000], gain: 0.15, attackMs: 1, decayMs: 30, delayMs: 5 },
    ],
  },
  'delete': {
    id: 'delete',
    durationMs: 110,
    category: 'editor',
    layers: [
      { wave: 'triangle', freq: [440, 110], gain: 0.38, attackMs: 2, decayMs: 105 },
    ],
  },
  'undo': {
    id: 'undo',
    durationMs: 140,
    category: 'editor',
    layers: [
      { wave: 'sine', freq: [660, 660], gain: 0.25, attackMs: 2, decayMs: 65, delayMs: 0 },
      { wave: 'sine', freq: [440, 440], gain: 0.25, attackMs: 2, decayMs: 68, delayMs: 70 },
    ],
  },
  'redo': {
    id: 'redo',
    durationMs: 140,
    category: 'editor',
    layers: [
      { wave: 'sine', freq: [440, 440], gain: 0.25, attackMs: 2, decayMs: 65, delayMs: 0 },
      { wave: 'sine', freq: [660, 660], gain: 0.25, attackMs: 2, decayMs: 68, delayMs: 70 },
    ],
  },
  'snap': {
    id: 'snap',
    durationMs: 45,
    category: 'editor',
    layers: [
      { wave: 'sine', freq: [2400, 1200], gain: 0.38, attackMs: 1, decayMs: 40 },
      {
        wave: 'noise',
        freq: [100, 100],
        gain: 0.22,
        attackMs: 1,
        decayMs: 25,
        filter: { type: 'highpass', freq: [4000, 4000], q: 1.0 },
      },
    ],
  },
  'select': {
    id: 'select',
    durationMs: 75,
    category: 'editor',
    layers: [
      { wave: 'sine', freq: [520, 620], gain: 0.3, attackMs: 4, decayMs: 68 },
    ],
  },
  'tool-switch': {
    id: 'tool-switch',
    durationMs: 115,
    category: 'editor',
    layers: [
      {
        wave: 'noise',
        freq: [100, 100],
        gain: 0.28,
        attackMs: 15,
        decayMs: 95,
        filter: { type: 'highpass', freq: [1200, 3600], q: 1.2 },
      },
    ],
  },
  'save': {
    id: 'save',
    durationMs: 330,
    category: 'editor',
    layers: [
      { wave: 'triangle', freq: [440, 440], gain: 0.25, attackMs: 5, decayMs: 140, delayMs: 0 },
      { wave: 'triangle', freq: [554.37, 554.37], gain: 0.25, attackMs: 5, decayMs: 140, delayMs: 90 },
      { wave: 'sine', freq: [659.25, 659.25], gain: 0.3, attackMs: 5, decayMs: 140, delayMs: 180 },
    ],
  },
};
