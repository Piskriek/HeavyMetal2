// src/procedural.ts
// Procedural synthesizers for Fidelity / SetMix (TASK-29 part B, T09b).
// Fills the audio gaps:
// - Three mode chords: Apply (warm major third), Sculpt (low resonant sweep), Seal (high phase-locked tone).
// - Cartridge snap (slotting) and ping (ejecting).
// - POL-42: 40 ms skin degauss tick on Combat_UI_Bus.
// - POL-67: Rising capacitor-charge pitch during gate ignition.
// Pure data recipes: transient, tonal body, and mechanical tail.

import type { SfxLayer } from './race';

export interface ProceduralRecipe {
  id: string;
  durationMs: number;
  layers: readonly SfxLayer[];
  category: 'ui' | 'editor' | 'world' | 'combat';
}

/**
 * Apply mode chord: a warm, resonant major third (C4 261.63 Hz + E4 329.63 Hz)
 * confirming that the tool is ready to paint or project terrain presets.
 */
export const SYNTH_APPLY_CHORD: ProceduralRecipe = {
  id: 'synth-chord-apply',
  durationMs: 320,
  category: 'ui',
  layers: [
    // 1. Transient: gentle tactile tick
    {
      wave: 'noise',
      freq: [1200, 1200],
      gain: 0.08,
      attackMs: 1,
      decayMs: 18,
      filter: { type: 'bandpass', freq: [1800, 1200], q: 0.9 },
    },
    // 2. Tonal body: root C4
    {
      wave: 'sine',
      freq: [261.625565, 261.625565],
      gain: 0.18,
      attackMs: 8,
      decayMs: 260,
    },
    // 2b. Tonal body: major third E4
    {
      wave: 'triangle',
      freq: [329.627557, 329.627557],
      gain: 0.16,
      attackMs: 12,
      decayMs: 270,
      delayMs: 16,
      filter: { type: 'lowpass', freq: [1400, 1100], q: 0.7 },
    },
    // 3. Mechanical tail: warm low-pass breath
    {
      wave: 'noise',
      freq: [800, 800],
      gain: 0.04,
      attackMs: 5,
      decayMs: 190,
      delayMs: 28,
      filter: { type: 'lowpass', freq: [900, 600], q: 0.6 },
    },
  ],
};

/**
 * Sculpt mode chord: low resonant sweep (180 Hz -> 85 Hz) evoking
 * deep mechanical displacement and substrate shaping.
 */
export const SYNTH_SCULPT_CHORD: ProceduralRecipe = {
  id: 'synth-chord-sculpt',
  durationMs: 380,
  category: 'ui',
  layers: [
    // 1. Transient: short low knock
    {
      wave: 'triangle',
      freq: [220, 160],
      gain: 0.14,
      attackMs: 2,
      decayMs: 35,
    },
    // 2. Tonal body: sweeping downward resonant filter
    {
      wave: 'sawtooth',
      freq: [180, 85],
      gain: 0.15,
      attackMs: 10,
      decayMs: 320,
      filter: { type: 'lowpass', freq: [380, 120], q: 1.8 },
    },
    // 3. Mechanical tail: low sub rumble
    {
      wave: 'sine',
      freq: [65, 52],
      gain: 0.12,
      attackMs: 15,
      decayMs: 340,
      delayMs: 20,
    },
  ],
};

/**
 * Seal mode chord: high phase-locked crystalline tone (dual ~1760 Hz)
 * signaling airtight containment or structural breach locking.
 */
export const SYNTH_SEAL_CHORD: ProceduralRecipe = {
  id: 'synth-chord-seal',
  durationMs: 380,
  category: 'ui',
  layers: [
    // 1. Transient: crisp bright contact click
    {
      wave: 'noise',
      freq: [3000, 3000],
      gain: 0.1,
      attackMs: 1,
      decayMs: 22,
      filter: { type: 'highpass', freq: [2600, 2600], q: 0.8 },
    },
    // 2. Tonal body: primary A6 sine
    {
      wave: 'sine',
      freq: [1760, 1760],
      gain: 0.18,
      attackMs: 6,
      decayMs: 310,
    },
    // 2b. Phase-locked twin with slight 4 Hz beat
    {
      wave: 'triangle',
      freq: [1764, 1764],
      gain: 0.14,
      attackMs: 8,
      decayMs: 320,
      filter: { type: 'bandpass', freq: [1760, 1760], q: 2.5 },
    },
    // 3. Mechanical tail: shimmering decay
    {
      wave: 'sine',
      freq: [3520, 3520],
      gain: 0.06,
      attackMs: 4,
      decayMs: 240,
      delayMs: 20,
    },
  ],
};

/**
 * Cartridge snap: tactile mechanical seating when slotting a cartridge
 * into a machine or the rifle's synthesis port.
 */
export const SYNTH_CARTRIDGE_SNAP: ProceduralRecipe = {
  id: 'synth-cartridge-snap',
  durationMs: 120,
  category: 'ui',
  layers: [
    // 1. Transient: crisp plastic/metal friction snap
    {
      wave: 'noise',
      freq: [2400, 2400],
      gain: 0.16,
      attackMs: 1,
      decayMs: 16,
      filter: { type: 'bandpass', freq: [3200, 2000], q: 1.2 },
    },
    // 2. Tonal body: solid latch pin knock
    {
      wave: 'triangle',
      freq: [520, 310],
      gain: 0.18,
      attackMs: 2,
      decayMs: 50,
    },
    // 3. Mechanical tail: seated socket detent
    {
      wave: 'square',
      freq: [260, 180],
      gain: 0.08,
      attackMs: 2,
      decayMs: 40,
      delayMs: 18,
      filter: { type: 'lowpass', freq: [600, 400], q: 0.7 },
    },
  ],
};

/**
 * Cartridge ping: spring-loaded ejection click and acoustic ping when
 * releasing a cartridge from its slot.
 */
export const SYNTH_CARTRIDGE_PING: ProceduralRecipe = {
  id: 'synth-cartridge-ping',
  durationMs: 300,
  category: 'ui',
  layers: [
    // 1. Transient: spring latch release
    {
      wave: 'noise',
      freq: [1200, 1200],
      gain: 0.12,
      attackMs: 1,
      decayMs: 20,
      filter: { type: 'bandpass', freq: [1600, 1000], q: 1.0 },
    },
    // 2. Tonal body: high metallic ping (C7 2093 Hz)
    {
      wave: 'sine',
      freq: [2093, 2093],
      gain: 0.2,
      attackMs: 2,
      decayMs: 240,
    },
    // 3. Mechanical tail: lower resonant housing ring (C6 1046 Hz)
    {
      wave: 'triangle',
      freq: [1046.5, 1046.5],
      gain: 0.1,
      attackMs: 4,
      decayMs: 260,
      delayMs: 12,
      filter: { type: 'lowpass', freq: [1800, 1200], q: 0.8 },
    },
  ],
};

/**
 * POL-42: 40 ms skin degauss tick on Combat_UI_Bus.
 * A sharp, short electromagnetic demagnetisation pulse when the HUD fidelity skin flips.
 */
export const SYNTH_SKIN_DEGAUSS: ProceduralRecipe = {
  id: 'synth-skin-degauss',
  durationMs: 40,
  category: 'ui',
  layers: [
    // 1. Transient: instant impulse pop
    {
      wave: 'noise',
      freq: [1400, 1400],
      gain: 0.18,
      attackMs: 0,
      decayMs: 14,
      filter: { type: 'bandpass', freq: [1600, 800], q: 0.9 },
    },
    // 2. Tonal body: fast falling coil discharge (160 Hz -> 55 Hz within 38 ms)
    {
      wave: 'triangle',
      freq: [160, 55],
      gain: 0.22,
      attackMs: 2,
      decayMs: 38,
    },
  ],
};

/**
 * POL-67: Rising capacitor-charge pitch during gate ignition.
 * Exponential frequency ramp from 120 Hz to 960 Hz over 3.2 s with electrical arc textures.
 */
export const SYNTH_GATE_CHARGE: ProceduralRecipe = {
  id: 'synth-gate-charge',
  durationMs: 3400,
  category: 'world',
  layers: [
    // 1. Tonal body: primary exponential capacitor pitch ramp
    {
      wave: 'sawtooth',
      freq: [120, 960],
      gain: 0.22,
      attackMs: 120,
      decayMs: 3200,
      filter: { type: 'lowpass', freq: [400, 2400], q: 1.5 },
    },
    // 2. Secondary rising harmonic sine
    {
      wave: 'sine',
      freq: [240, 1920],
      gain: 0.16,
      attackMs: 200,
      decayMs: 3100,
    },
    // 3. Electrical buzz and crackle
    {
      wave: 'noise',
      freq: [1200, 1200],
      gain: 0.09,
      attackMs: 400,
      decayMs: 2900,
      delayMs: 200,
      filter: { type: 'bandpass', freq: [800, 3000], q: 1.2 },
    },
  ],
};

export const PROCEDURAL_RECIPES: readonly ProceduralRecipe[] = Object.freeze([
  SYNTH_APPLY_CHORD,
  SYNTH_SCULPT_CHORD,
  SYNTH_SEAL_CHORD,
  SYNTH_CARTRIDGE_SNAP,
  SYNTH_CARTRIDGE_PING,
  SYNTH_SKIN_DEGAUSS,
  SYNTH_GATE_CHARGE,
]);

export const PROCEDURAL_RECIPE_MAP: Readonly<Record<string, ProceduralRecipe>> = Object.freeze({
  'synth-chord-apply': SYNTH_APPLY_CHORD,
  'synth-chord-sculpt': SYNTH_SCULPT_CHORD,
  'synth-chord-seal': SYNTH_SEAL_CHORD,
  'synth-cartridge-snap': SYNTH_CARTRIDGE_SNAP,
  'synth-cartridge-ping': SYNTH_CARTRIDGE_PING,
  'synth-skin-degauss': SYNTH_SKIN_DEGAUSS,
  'synth-gate-charge': SYNTH_GATE_CHARGE,
});
