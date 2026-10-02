import type { ModulatorDef } from './types';

export interface ModulatorPreset {
  id: string;
  name: string;
  doc: string;
  def: ModulatorDef;
}

/**
 * Ready-made modulators shipped with the tool. Every entry is valid
 * (validateModulator returns no errors) and sampleable over any time range.
 */
export const MODULATOR_PRESETS: ModulatorPreset[] = [
  {
    id: 'gentle-wobble',
    name: 'Gentle wobble',
    doc: 'Slow fractal noise for organic, non-repeating drift. Good for ambient light intensity.',
    def: { kind: 'noise', freqHz: 0.6, octaves: 3, gain: 0.5, out: { min: -0.15, max: 0.15 } },
  },
  {
    id: 'heartbeat',
    name: 'Heartbeat',
    doc: 'Two quick pulses (lub-dub) then a rest, looping every 1.2 s. Drive scale or emissive glow.',
    def: {
      kind: 'timeline',
      durationMs: 1200,
      loop: 'loop',
      keys: [
        { timeMs: 0, value: 0 },
        { timeMs: 60, value: 1, ease: 'out' },
        { timeMs: 150, value: 0.12, ease: 'in' },
        { timeMs: 230, value: 0.82, ease: 'out' },
        { timeMs: 360, value: 0, ease: 'in' },
        { timeMs: 1200, value: 0 },
      ],
    },
  },
  {
    id: 'engine-pitch-from-speed',
    name: 'Engine pitch from speed',
    doc: 'Remaps the live speed stream (0..40 m/s) onto an engine pitch multiplier with a smooth knee.',
    def: {
      kind: 'curve',
      points: [
        [0, 0],
        [0.45, 0.42],
        [0.8, 0.86],
        [1, 1],
      ],
      interpolation: 'smooth',
      input: { source: 'stream', path: 'global:speed', in: { min: 0, max: 40 } },
      out: { min: 0.8, max: 2.2 },
    },
  },
  {
    id: 'fast-flicker',
    name: 'Fast flicker',
    doc: '20 Hz held random values: harsh electric-torch flicker for broken neon or sparks.',
    def: { kind: 'random', rateHz: 20, mode: 'hold', distribution: 'uniform', out: { min: 0, max: 1 } },
  },
  {
    id: 'tide',
    name: 'Tide',
    doc: 'Very slow 0.05 Hz sine swell — water level, fog density or a slow colour wash.',
    def: { kind: 'lfo', wave: 'sine', freqHz: 0.05, out: { min: 0, max: 1 } },
  },
  {
    id: 'camera-shake',
    name: 'Camera shake',
    doc: 'Fast 8 Hz noise with a tiny amplitude for handheld camera jitter.',
    def: { kind: 'noise', freqHz: 8, octaves: 2, gain: 0.5, out: { min: -0.02, max: 0.02 } },
  },
  {
    id: 'pulse-1hz',
    name: 'Pulse 1 Hz',
    doc: 'Square pulse with a 35% duty cycle: metronomes, beacons, blinking UI markers.',
    def: { kind: 'lfo', wave: 'square', freqHz: 1, width: 0.35, out: { min: 0, max: 1 } },
  },
  {
    id: 'ramp-up-2s',
    name: 'Ramp up 2 s',
    doc: 'One-shot eased ramp from 0 to 1 over two seconds, then it holds its last value.',
    def: {
      kind: 'timeline',
      durationMs: 2000,
      loop: 'none',
      keys: [
        { timeMs: 0, value: 0 },
        { timeMs: 2000, value: 1, ease: 'inOut' },
      ],
    },
  },
  {
    id: 'arpeggio',
    name: 'Arpeggio',
    doc: 'Eight step sequencer values mapped onto a musical pitch range, one step per eighth note.',
    def: {
      kind: 'sequence',
      steps: [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25],
      rateHz: 8,
      out: { min: 220, max: 880 },
    },
  },
  {
    id: 'speed-smoothed',
    name: 'Speed, smoothed',
    doc: 'Live speed scaled down and low-pass filtered over 250 ms, clamped to a safe range.',
    def: {
      kind: 'stream',
      path: 'entity:0/velocity.speed',
      scale: 0.01,
      offset: 0,
      smoothMs: 250,
      clamp: { min: 0, max: 3 },
    },
  },
  {
    id: 'drunk-walk',
    name: 'Drunk walk',
    doc: 'Smoothed 3 Hz random in -1..1: wandering AI attention or a wobbly steering offset.',
    def: { kind: 'random', rateHz: 3, mode: 'smooth', distribution: 'uniform', out: { min: -1, max: 1 } },
  },
  {
    id: 'breathing',
    name: 'Breathing',
    doc: 'Slow sine multiplied by gentle noise: a chest-rising scale animation that never looks looped.',
    def: {
      kind: 'combine',
      op: 'multiply',
      inputs: [
        { kind: 'lfo', wave: 'sine', freqHz: 0.2, out: { min: 0.85, max: 1 } },
        { kind: 'noise', freqHz: 0.7, octaves: 2, gain: 0.5, out: { min: 0.9, max: 1 } },
      ],
    },
  },
  {
    id: 'hue-cycle',
    name: 'Hue cycle',
    doc: 'Sawtooth ramp over 36 seconds mapped to a full hue revolution in degrees.',
    def: { kind: 'lfo', wave: 'saw', freqHz: 1 / 36, out: { min: 0, max: 360 } },
  },
  {
    id: 'grip-from-load',
    name: 'Grip from load',
    doc: 'Tyre grip curve fed by the suspension load stream: flat, then falling away at the edges.',
    def: {
      kind: 'curve',
      points: [
        [0, 0.55],
        [0.25, 0.96],
        [0.5, 1],
        [0.75, 0.9],
        [1, 0.6],
      ],
      interpolation: 'smooth',
      input: { source: 'stream', path: 'entity:0/wheel.fl.load', in: { min: 0, max: 6000 } },
      out: { min: 0.4, max: 1.15 },
    },
  },
  {
    id: 'strobe-texture-scan',
    name: 'Texture scan strobe',
    doc: 'Drives a scrolling texture lookup: u sweeps 4 times per second while v drifts with noise.',
    def: {
      kind: 'texture',
      textureId: 'fx/streaks',
      u: { kind: 'lfo', wave: 'saw', freqHz: 4, out: { min: 0, max: 1 } },
      v: { kind: 'noise', freqHz: 1.5, octaves: 2, gain: 0.5, out: { min: 0, max: 1 } },
      out: { min: 0, max: 1 },
    },
  },
  {
    id: 'siren-mix',
    name: 'Siren mix',
    doc: 'Mixes a fast sine siren with a slow sweep, weighted 60/40 for a layered emergency tone.',
    def: {
      kind: 'combine',
      op: 'mix',
      mix: 0.6,
      inputs: [
        { kind: 'lfo', wave: 'sine', freqHz: 3, out: { min: 600, max: 900 } },
        { kind: 'lfo', wave: 'triangle', freqHz: 0.25, out: { min: 400, max: 1100 } },
      ],
    },
  },
];

export function presetById(id: string): ModulatorPreset | undefined {
  return MODULATOR_PRESETS.find((p) => p.id === id);
}
