type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
interface SfxLayer { wave: Wave; freq: readonly [number, number] /* Hz start and end, exponential glide, ignored for noise */; gain: number; attackMs: number; decayMs: number; delayMs?: number; detune?: number /* cents */; filter?: { type: 'lowpass' | 'highpass' | 'bandpass'; freq: readonly [number, number]; q: number } }
interface SfxRecipe { id: string; durationMs: number; layers: readonly SfxLayer[]; category: 'ui' | 'editor' }

export const UI_SOUNDS_ALT: readonly SfxRecipe[] = [
  // ui-click: a soft rounded tap, a short falling sine with a tiny padded noise touch, like pressing a rubber button.
  {
    id: 'ui-click',
    category: 'ui',
    durationMs: 70,
    layers: [
      { wave: 'sine', freq: [520, 330], gain: 0.22, attackMs: 2, decayMs: 55 },
      { wave: 'noise', freq: [1000, 1000], gain: 0.08, attackMs: 1, decayMs: 18, filter: { type: 'bandpass', freq: [2200, 1800], q: 1 } },
    ],
  },
  // ui-hover: barely there, a very quiet airy G5 pip with a soft round onset so it never pokes out when repeated.
  {
    id: 'ui-hover',
    category: 'ui',
    durationMs: 40,
    layers: [
      { wave: 'sine', freq: [783.99, 783.99], gain: 0.06, attackMs: 4, decayMs: 30 },
      { wave: 'sine', freq: [392, 392], gain: 0.05, attackMs: 4, decayMs: 26 },
    ],
  },
  // ui-toggle: two quick soft tones, E5 then G5, like a little switch flick that lands upward.
  {
    id: 'ui-toggle',
    category: 'ui',
    durationMs: 140,
    layers: [
      { wave: 'triangle', freq: [659.25, 659.25], gain: 0.18, attackMs: 3, decayMs: 60, filter: { type: 'lowpass', freq: [3000, 2000], q: 0.7 } },
      { wave: 'triangle', freq: [783.99, 783.99], gain: 0.18, attackMs: 3, decayMs: 80, delayMs: 55, filter: { type: 'lowpass', freq: [3000, 2000], q: 0.7 } },
      { wave: 'noise', freq: [1000, 1000], gain: 0.05, attackMs: 1, decayMs: 15, filter: { type: 'bandpass', freq: [1800, 1800], q: 1 } },
    ],
  },
  // ui-error: a soft low double buzz, rounded low-passed saws with a triangle cushion, gentle and short rather than alarming.
  {
    id: 'ui-error',
    category: 'ui',
    durationMs: 250,
    layers: [
      { wave: 'sawtooth', freq: [130.81, 123.47], gain: 0.2, attackMs: 8, decayMs: 90, detune: 8, filter: { type: 'lowpass', freq: [650, 400], q: 0.8 } },
      { wave: 'sawtooth', freq: [123.47, 110], gain: 0.2, attackMs: 8, decayMs: 110, delayMs: 120, detune: -8, filter: { type: 'lowpass', freq: [600, 350], q: 0.8 } },
      { wave: 'triangle', freq: [196, 185], gain: 0.1, attackMs: 6, decayMs: 90 },
      { wave: 'triangle', freq: [185, 164.81], gain: 0.1, attackMs: 6, decayMs: 110, delayMs: 120 },
    ],
  },
  // ui-success: a bright two-note rise, C5 up to G5, each with a faint octave sparkle on top.
  {
    id: 'ui-success',
    category: 'ui',
    durationMs: 360,
    layers: [
      { wave: 'triangle', freq: [523.25, 523.25], gain: 0.2, attackMs: 4, decayMs: 120, filter: { type: 'lowpass', freq: [4000, 2500], q: 0.7 } },
      { wave: 'sine', freq: [1046.5, 1046.5], gain: 0.06, attackMs: 4, decayMs: 100 },
      { wave: 'triangle', freq: [783.99, 783.99], gain: 0.22, attackMs: 4, decayMs: 260, delayMs: 90, filter: { type: 'lowpass', freq: [4000, 2500], q: 0.7 } },
      { wave: 'sine', freq: [1567.98, 1567.98], gain: 0.06, attackMs: 4, decayMs: 200, delayMs: 90 },
    ],
  },
  // paint-tick: a tiny soft scratch of band-passed noise with a faint woody body, non-pitched enough to repeat 20 times a second.
  {
    id: 'paint-tick',
    category: 'editor',
    durationMs: 40,
    layers: [
      { wave: 'noise', freq: [1000, 1000], gain: 0.14, attackMs: 2, decayMs: 28, filter: { type: 'bandpass', freq: [2800, 3600], q: 1.2 } },
      { wave: 'triangle', freq: [420, 380], gain: 0.05, attackMs: 1, decayMs: 22 },
    ],
  },
  // sculpt-tick: a low soft thump, a short pitch-dropping sine with a muffled clay-like noise pat.
  {
    id: 'sculpt-tick',
    category: 'editor',
    durationMs: 70,
    layers: [
      { wave: 'sine', freq: [120, 60], gain: 0.3, attackMs: 3, decayMs: 60 },
      { wave: 'noise', freq: [1000, 1000], gain: 0.06, attackMs: 2, decayMs: 25, filter: { type: 'lowpass', freq: [400, 300], q: 0.7 } },
    ],
  },
  // place: a satisfying wooden plop, a dropping sine body, a knocking overtone and a resonant woody noise tap.
  {
    id: 'place',
    category: 'editor',
    durationMs: 120,
    layers: [
      { wave: 'sine', freq: [320, 150], gain: 0.3, attackMs: 2, decayMs: 110 },
      { wave: 'triangle', freq: [640, 300], gain: 0.12, attackMs: 2, decayMs: 50, filter: { type: 'lowpass', freq: [2000, 900], q: 0.8 } },
      { wave: 'noise', freq: [1000, 1000], gain: 0.1, attackMs: 1, decayMs: 25, filter: { type: 'bandpass', freq: [900, 700], q: 5 } },
    ],
  },
  // delete: a short papery crumple that falls in pitch, three staggered band-passed noise crinkles plus a faint falling tone.
  {
    id: 'delete',
    category: 'editor',
    durationMs: 200,
    layers: [
      { wave: 'noise', freq: [1000, 1000], gain: 0.2, attackMs: 3, decayMs: 150, filter: { type: 'bandpass', freq: [4000, 1200], q: 0.9 } },
      { wave: 'noise', freq: [1000, 1000], gain: 0.14, attackMs: 2, decayMs: 110, delayMs: 45, filter: { type: 'bandpass', freq: [2500, 900], q: 0.9 } },
      { wave: 'noise', freq: [1000, 1000], gain: 0.1, attackMs: 2, decayMs: 90, delayMs: 90, filter: { type: 'bandpass', freq: [1800, 700], q: 0.9 } },
      { wave: 'sine', freq: [300, 140], gain: 0.06, attackMs: 4, decayMs: 120 },
    ],
  },
  // undo: a small downward sweep from G5 to C5, softened by a low-passed triangle and a quiet sine an octave below.
  {
    id: 'undo',
    category: 'editor',
    durationMs: 150,
    layers: [
      { wave: 'triangle', freq: [783.99, 523.25], gain: 0.2, attackMs: 4, decayMs: 130, filter: { type: 'lowpass', freq: [3000, 1200], q: 0.7 } },
      { wave: 'sine', freq: [392, 261.63], gain: 0.1, attackMs: 4, decayMs: 130 },
    ],
  },
  // redo: the mirror of undo, a small upward sweep from C5 to G5 with the same warm layering.
  {
    id: 'redo',
    category: 'editor',
    durationMs: 150,
    layers: [
      { wave: 'triangle', freq: [523.25, 783.99], gain: 0.2, attackMs: 4, decayMs: 130, filter: { type: 'lowpass', freq: [1500, 3500], q: 0.7 } },
      { wave: 'sine', freq: [261.63, 392], gain: 0.1, attackMs: 4, decayMs: 130 },
    ],
  },
  // snap: a crisp magnetic click, a sharp band-passed noise tick and a muted square snap over a short low thunk.
  {
    id: 'snap',
    category: 'editor',
    durationMs: 60,
    layers: [
      { wave: 'noise', freq: [1000, 1000], gain: 0.14, attackMs: 0, decayMs: 12, filter: { type: 'bandpass', freq: [3500, 3000], q: 2 } },
      { wave: 'square', freq: [1200, 600], gain: 0.08, attackMs: 0, decayMs: 15, filter: { type: 'lowpass', freq: [2500, 1500], q: 0.7 } },
      { wave: 'sine', freq: [220, 110], gain: 0.2, attackMs: 1, decayMs: 35 },
    ],
  },
  // select: a soft bright blip, a sine hopping up from G5 to C6 with a quiet G6 triangle glint.
  {
    id: 'select',
    category: 'editor',
    durationMs: 90,
    layers: [
      { wave: 'sine', freq: [783.99, 1046.5], gain: 0.2, attackMs: 3, decayMs: 80 },
      { wave: 'triangle', freq: [1567.98, 1567.98], gain: 0.05, attackMs: 2, decayMs: 50 },
    ],
  },
  // tool-switch: a tiny mechanical ratchet, three rising noise clicks that end in a small low latch thunk.
  {
    id: 'tool-switch',
    category: 'editor',
    durationMs: 100,
    layers: [
      { wave: 'noise', freq: [1000, 1000], gain: 0.12, attackMs: 0, decayMs: 10, filter: { type: 'bandpass', freq: [2200, 2200], q: 4 } },
      { wave: 'noise', freq: [1000, 1000], gain: 0.12, attackMs: 0, decayMs: 10, delayMs: 28, filter: { type: 'bandpass', freq: [2600, 2600], q: 4 } },
      { wave: 'noise', freq: [1000, 1000], gain: 0.12, attackMs: 0, decayMs: 10, delayMs: 56, filter: { type: 'bandpass', freq: [3000, 3000], q: 4 } },
      { wave: 'triangle', freq: [261.63, 196], gain: 0.12, attackMs: 2, decayMs: 40, delayMs: 56 },
    ],
  },
  // save: a warm two-note confirmation chord, C-E then G-C (a C major voicing), soft triangles with sine support, ringing to 660 ms.
  {
    id: 'save',
    category: 'editor',
    durationMs: 660,
    layers: [
      { wave: 'triangle', freq: [261.63, 261.63], gain: 0.17, attackMs: 6, decayMs: 380, filter: { type: 'lowpass', freq: [2400, 1500], q: 0.7 } },
      { wave: 'sine', freq: [329.63, 329.63], gain: 0.1, attackMs: 6, decayMs: 380 },
      { wave: 'triangle', freq: [392, 392], gain: 0.2, attackMs: 8, decayMs: 520, delayMs: 120, filter: { type: 'lowpass', freq: [2600, 1600], q: 0.7 } },
      { wave: 'sine', freq: [523.25, 523.25], gain: 0.1, attackMs: 8, decayMs: 520, delayMs: 120 },
    ],
  },
];

export const UI_NOTES_ALT: Record<string, string> = {
  'ui-click': 'A short falling sine with a tiny noise touch gives a soft, padded, tactile tap that never clicks harshly.',
  'ui-hover': 'Two very quiet sines at G5 and G4 with a rounded 4 ms onset make a pip that disappears into the background when repeated.',
  'ui-toggle': 'Two quick low-passed triangles at E5 then G5 rise by a minor third so a flip reads as a playful upward switch.',
  'ui-error': 'Low-passed detuned saws cushioned by triangles play two short falling buzzes that read as "nope" without being irritating.',
  'ui-success': 'A C5 to G5 rise on warm triangles with faint octave sparkles gives a bright, open, rewarding fifth.',
  'paint-tick': 'Mostly band-passed noise with a whisper of triangle body avoids a repeating pitch, so 20 ticks a second feel like brush bristles.',
  'sculpt-tick': 'A short pitch-dropping low sine with a muffled noise pat feels like pressing soft clay and stays out of the harsh mids.',
  'place': 'A falling sine body, a knocking overtone and a narrow resonant noise tap combine into a hollow wooden plop that feels like it lands.',
  'delete': 'Three staggered band-passed noise crinkles sliding downward in brightness imitate paper being balled up, with a faint falling tone for finality.',
  'undo': 'A G5 to C5 low-passed triangle glide with a sine an octave below makes a small, soft step backward.',
  'redo': 'The exact mirror of undo, rising from C5 to G5 with an opening filter, so the pair clearly belong together.',
  'snap': 'A very short band-passed noise tick, a muted square and a low thunk give a crisp magnet-like lock without any shrill ring.',
  'select': 'A quick G5 to C6 sine hop with a quiet G6 glint is bright and friendly but small enough to fire constantly.',
  'tool-switch': 'Three rising narrow noise clicks 28 ms apart end in a tiny low triangle latch, like a toy ratchet engaging.',
  'save': 'Two staggered soft chords, C-E then G-C, stack into a warm C major voicing with a gentle ring-out for a reassuring confirmation.',
};