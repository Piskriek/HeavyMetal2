import { mulberry32 } from './render';

/** The engine hum is data too: how pitch, loudness, brightness and rumble follow the ball's speed and throttle. */
export interface EngineSpec {
  baseFreq: number; freqPerSpeed: number; freqPerThrottle: number;
  baseGain: number; gainPerThrottle: number; gainPerSpeed: number;
  baseFilter: number; filterPerSpeed: number; filterPerThrottle: number;
  baseNoise: number; noisePerSpeed: number;
}

export const DEFAULT_ENGINE_SPEC: EngineSpec = {
  baseFreq: 70, freqPerSpeed: 190, freqPerThrottle: 30,
  baseGain: 0.05, gainPerThrottle: 0.1, gainPerSpeed: 0.05,
  baseFilter: 400, filterPerSpeed: 2600, filterPerThrottle: 600,
  baseNoise: 0.01, noisePerSpeed: 0.06,
};

export interface EngineParams { freq: number; gain: number; filterFreq: number; noiseGain: number }

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const fin = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);

export function engineParamsFor(spec: EngineSpec, speed: number, throttle: number, maxSpeed: number): EngineParams {
  const max = Number.isFinite(maxSpeed) && maxSpeed > 0 ? maxSpeed : 1;
  const s = clamp(fin(speed, 0) / max, 0, 1.5);
  const sMin1 = Math.min(s, 1);
  const t = clamp(fin(throttle, 0), 0, 1);
  return {
    freq: spec.baseFreq + spec.freqPerSpeed * s + spec.freqPerThrottle * t,
    gain: spec.baseGain + spec.gainPerThrottle * t + spec.gainPerSpeed * sMin1,
    filterFreq: spec.baseFilter + spec.filterPerSpeed * sMin1 + spec.filterPerThrottle * t,
    noiseGain: spec.baseNoise + spec.noisePerSpeed * sMin1,
  };
}

const KEYS = Object.keys(DEFAULT_ENGINE_SPEC) as (keyof EngineSpec)[];

export function validateEngineSpec(spec: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof spec !== 'object' || spec === null) return { ok: false, errors: ['An engine hum needs an object with its settings.'] };
  for (const k of KEYS) {
    const v = (spec as Record<string, unknown>)[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${k} must be a number`);
    else if (v < 0) errors.push(`${k} cannot be negative`);
  }
  return { ok: errors.length === 0, errors };
}

/** A hum with a chosen character. The loudest it can get stays under 0.4 so it never drowns the effects. */
export function randomEngineSpec(seed: number, character: 'smooth' | 'buzzy' | 'rumble'): EngineSpec {
  const r = mulberry32(Math.floor(seed) * 2246822519 + 11);
  const span = (a: number, b: number): number => a + (b - a) * r();
  switch (character) {
    case 'smooth':
      return { baseFreq: span(60, 90), freqPerSpeed: span(90, 150), freqPerThrottle: span(10, 25), baseGain: span(0.04, 0.06), gainPerThrottle: span(0.06, 0.1), gainPerSpeed: span(0.03, 0.06), baseFilter: span(300, 500), filterPerSpeed: span(1200, 1800), filterPerThrottle: span(200, 400), baseNoise: span(0.002, 0.008), noisePerSpeed: span(0.01, 0.03) };
    case 'buzzy':
      return { baseFreq: span(140, 200), freqPerSpeed: span(260, 380), freqPerThrottle: span(30, 70), baseGain: span(0.05, 0.08), gainPerThrottle: span(0.08, 0.14), gainPerSpeed: span(0.05, 0.08), baseFilter: span(900, 1500), filterPerSpeed: span(3500, 5500), filterPerThrottle: span(800, 1400), baseNoise: span(0.01, 0.02), noisePerSpeed: span(0.04, 0.08) };
    case 'rumble':
      return { baseFreq: span(38, 55), freqPerSpeed: span(60, 110), freqPerThrottle: span(8, 20), baseGain: span(0.08, 0.12), gainPerThrottle: span(0.1, 0.16), gainPerSpeed: span(0.06, 0.1), baseFilter: span(160, 280), filterPerSpeed: span(700, 1200), filterPerThrottle: span(150, 300), baseNoise: span(0.04, 0.08), noisePerSpeed: span(0.08, 0.14) };
  }
}

/** The response curve at full throttle, for drawing. */
export function engineSpecToPoints(spec: EngineSpec, maxSpeed: number, steps = 32): { speed: number; freq: number; gain: number }[] {
  const n = Math.max(1, Math.floor(steps));
  return Array.from({ length: n + 1 }, (_, i) => {
    const speed = (maxSpeed * i) / n;
    const p = engineParamsFor(spec, speed, 1, maxSpeed);
    return { speed, freq: p.freq, gain: p.gain };
  });
}
