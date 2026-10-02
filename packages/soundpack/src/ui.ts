type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

interface SfxLayer {
  wave: Wave;
  freq: readonly [number, number]; // Hz start and end, exponential glide, ignored for noise
  gain: number;
  attackMs: number;
  decayMs: number;
  delayMs?: number;
  detune?: number; // cents
  filter?: {
    type: 'lowpass' | 'highpass' | 'bandpass';
    freq: readonly [number, number];
    q: number;
  };
}

interface SfxRecipe {
  id: string;
  durationMs: number;
  layers: readonly SfxLayer[];
  category: 'ui' | 'editor';
}

export const UI_SOUNDS: readonly SfxRecipe[] = [
  // A rounded fingertip tap with just a hint of surface texture.
  {
    id: 'ui-click',
    durationMs: 72,
    category: 'ui',
    layers: [
      { wave: 'triangle', freq: [520, 390], gain: 0.13, attackMs: 2, decayMs: 51 },
      {
        wave: 'noise', freq: [1000, 1000], gain: 0.055, attackMs: 1, decayMs: 21,
        filter: { type: 'lowpass', freq: [1800, 950], q: 0.7 },
      },
    ],
  },
  // An almost imperceptible, smooth little acknowledgement.
  {
    id: 'ui-hover',
    durationMs: 48,
    category: 'ui',
    layers: [
      { wave: 'sine', freq: [391.995436, 391.995436], gain: 0.05, attackMs: 7, decayMs: 36 },
    ],
  },
  // Two soft, quick steps from E to G make a switch feel deliberate.
  {
    id: 'ui-toggle',
    durationMs: 165,
    category: 'ui',
    layers: [
      { wave: 'triangle', freq: [329.627557, 329.627557], gain: 0.12, attackMs: 3, decayMs: 64 },
      { wave: 'triangle', freq: [391.995436, 391.995436], gain: 0.13, attackMs: 3, decayMs: 91, delayMs: 67 },
    ],
  },
  // Two low, muffled buzzes signal a mistake without scolding.
  {
    id: 'ui-error',
    durationMs: 260,
    category: 'ui',
    layers: [
      { wave: 'triangle', freq: [185, 164], gain: 0.125, attackMs: 3, decayMs: 105 },
      {
        wave: 'square', freq: [185, 164], gain: 0.055, attackMs: 3, decayMs: 77,
        filter: { type: 'lowpass', freq: [460, 340], q: 0.65 },
      },
      { wave: 'triangle', freq: [177, 154], gain: 0.115, attackMs: 3, decayMs: 104, delayMs: 132 },
      {
        wave: 'square', freq: [177, 154], gain: 0.05, attackMs: 3, decayMs: 80, delayMs: 132,
        filter: { type: 'lowpass', freq: [430, 320], q: 0.65 },
      },
    ],
  },
  // A light G-to-C lift celebrates success without becoming a fanfare.
  {
    id: 'ui-success',
    durationMs: 296,
    category: 'ui',
    layers: [
      { wave: 'triangle', freq: [391.995436, 391.995436], gain: 0.14, attackMs: 4, decayMs: 125 },
      { wave: 'triangle', freq: [523.251131, 523.251131], gain: 0.17, attackMs: 4, decayMs: 183, delayMs: 104 },
    ],
  },
  // A tiny filtered brush grain keeps rapid painting gentle.
  {
    id: 'paint-tick',
    durationMs: 38,
    category: 'editor',
    layers: [
      {
        wave: 'noise', freq: [1000, 1000], gain: 0.065, attackMs: 0, decayMs: 19,
        filter: { type: 'bandpass', freq: [1600, 1100], q: 0.65 },
      },
      { wave: 'triangle', freq: [470, 350], gain: 0.05, attackMs: 1, decayMs: 28 },
    ],
  },
  // A very short, low puff suggests fingers pressing soft clay.
  {
    id: 'sculpt-tick',
    durationMs: 49,
    category: 'editor',
    layers: [
      { wave: 'sine', freq: [146, 100], gain: 0.105, attackMs: 1, decayMs: 40 },
      {
        wave: 'noise', freq: [500, 500], gain: 0.05, attackMs: 1, decayMs: 18,
        filter: { type: 'lowpass', freq: [650, 400], q: 0.65 },
      },
    ],
  },
  // A round bass plop and muted knock make placement feel wooden.
  {
    id: 'place',
    durationMs: 190,
    category: 'editor',
    layers: [
      { wave: 'sine', freq: [185, 103], gain: 0.2, attackMs: 2, decayMs: 138 },
      { wave: 'triangle', freq: [300, 160], gain: 0.1, attackMs: 2, decayMs: 94, delayMs: 4 },
      {
        wave: 'noise', freq: [1000, 1000], gain: 0.075, attackMs: 1, decayMs: 34,
        filter: { type: 'lowpass', freq: [1250, 490], q: 0.7 },
      },
    ],
  },
  // A brief paper rustle folds downward and disappears.
  {
    id: 'delete',
    durationMs: 177,
    category: 'editor',
    layers: [
      {
        wave: 'noise', freq: [1000, 1000], gain: 0.13, attackMs: 1, decayMs: 85,
        filter: { type: 'bandpass', freq: [1700, 750], q: 0.6 },
      },
      {
        wave: 'noise', freq: [1000, 1000], gain: 0.07, attackMs: 4, decayMs: 113, delayMs: 26,
        filter: { type: 'lowpass', freq: [900, 450], q: 0.65 },
      },
      { wave: 'triangle', freq: [350, 175], gain: 0.075, attackMs: 3, decayMs: 132 },
    ],
  },
  // A small rounded descent gently pulls an action back.
  {
    id: 'undo',
    durationMs: 178,
    category: 'editor',
    layers: [
      { wave: 'triangle', freq: [565, 300], gain: 0.14, attackMs: 7, decayMs: 154 },
      { wave: 'sine', freq: [310, 220], gain: 0.055, attackMs: 9, decayMs: 128, delayMs: 15 },
    ],
  },
  // A matching soft ascent returns the action to its place.
  {
    id: 'redo',
    durationMs: 178,
    category: 'editor',
    layers: [
      { wave: 'triangle', freq: [300, 565], gain: 0.14, attackMs: 7, decayMs: 154 },
      { wave: 'sine', freq: [220, 310], gain: 0.055, attackMs: 9, decayMs: 128, delayMs: 15 },
    ],
  },
  // A clean, brief click gives grid alignment a magnetic finish.
  {
    id: 'snap',
    durationMs: 62,
    category: 'editor',
    layers: [
      {
        wave: 'noise', freq: [1000, 1000], gain: 0.075, attackMs: 0, decayMs: 18,
        filter: { type: 'bandpass', freq: [1900, 1250], q: 0.85 },
      },
      { wave: 'sine', freq: [570, 360], gain: 0.14, attackMs: 1, decayMs: 49 },
      { wave: 'triangle', freq: [700, 500], gain: 0.055, attackMs: 1, decayMs: 25, delayMs: 6 },
    ],
  },
  // A short, bright C blip marks the chosen object softly.
  {
    id: 'select',
    durationMs: 130,
    category: 'editor',
    layers: [
      { wave: 'triangle', freq: [523.251131, 523.251131], gain: 0.11, attackMs: 3, decayMs: 93 },
      { wave: 'sine', freq: [523.251131, 523.251131], gain: 0.06, attackMs: 5, decayMs: 103, delayMs: 8 },
    ],
  },
  // Three hushed teeth settle into a tiny mechanical stop.
  {
    id: 'tool-switch',
    durationMs: 105,
    category: 'editor',
    layers: [
      {
        wave: 'noise', freq: [1000, 1000], gain: 0.055, attackMs: 0, decayMs: 16,
        filter: { type: 'bandpass', freq: [1450, 1100], q: 0.8 },
      },
      {
        wave: 'noise', freq: [1000, 1000], gain: 0.055, attackMs: 0, decayMs: 16, delayMs: 28,
        filter: { type: 'bandpass', freq: [1450, 1100], q: 0.8 },
      },
      {
        wave: 'noise', freq: [1000, 1000], gain: 0.055, attackMs: 0, decayMs: 16, delayMs: 54,
        filter: { type: 'bandpass', freq: [1450, 1100], q: 0.8 },
      },
      { wave: 'triangle', freq: [440, 310], gain: 0.07, attackMs: 1, decayMs: 45, delayMs: 54 },
    ],
  },
  // A gently rolled C and E major third gives saving a warm resolution.
  {
    id: 'save',
    durationMs: 500,
    category: 'editor',
    layers: [
      { wave: 'sine', freq: [261.625565, 261.625565], gain: 0.16, attackMs: 12, decayMs: 395 },
      {
        wave: 'triangle', freq: [329.627557, 329.627557], gain: 0.16, attackMs: 16, decayMs: 425, delayMs: 30,
        filter: { type: 'lowpass', freq: [1200, 1000], q: 0.6 },
      },
    ],
  },
];

export const UI_NOTES: Record<string, string> = {
  'ui-click': 'A falling triangle tap and low-passed grain make repeated clicks feel tactile rather than sharp.',
  'ui-hover': 'One quiet G4 sine with a soft onset stays unobtrusive even during rapid pointer movement.',
  'ui-toggle': 'Two compact C-major notes, E4 then G4, communicate a friendly change of state.',
  'ui-error': 'Two descending low pulses use muffled square harmonics for a gentle double buzz.',
  'ui-success': 'A G4-to-C5 rise has a little overlap and enough brightness to feel rewarding without shouting.',
  'paint-tick': 'A fleeting filtered scratch with a faint downward body is short enough for continuous brush strokes.',
  'sculpt-tick': 'A low sine dip and dark puff suggest soft material being pressed at high repetition rates.',
  place: 'A dropping sine, rounded triangle knock, and muted texture give objects a wooden landing.',
  delete: 'Falling filtered noise and a quiet descending tone make removal feel like crumpling paper.',
  undo: 'A small downward pair of glides reverses an action without drawing attention from the canvas.',
  redo: 'The matching upward glides answer undo while keeping the same gentle weight.',
  snap: 'A brief filtered transient followed by a round tone makes alignment precise but not piercing.',
  select: 'Layered C5 tones create a soft, bright blip that sits comfortably with the other pitched cues.',
  'tool-switch': 'Three muted grains and a tiny falling stop evoke a friendly mechanical ratchet.',
  save: 'Overlapping C4 and E4 form a warm major-third confirmation that fades gently.',
};