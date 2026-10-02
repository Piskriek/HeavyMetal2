export function midiToHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export interface EngineParams {
  freq: number;
  gain: number;
  filterFreq: number;
  noiseGain: number;
}

export function engineParams(
  speed: number /* m/s */,
  throttle: number /* 0..1 */,
  maxSpeed: number,
): EngineParams {
  const safeSpeed = Number.isFinite(speed) ? speed : 0;
  const safeThrottle = Number.isFinite(throttle) ? Math.max(0, Math.min(1, throttle)) : 0;
  const safeMaxSpeed = Number.isFinite(maxSpeed) && maxSpeed > 0 ? maxSpeed : 1;

  const s = Math.max(0, Math.min(1.5, safeSpeed / safeMaxSpeed));
  const sMin1 = Math.min(s, 1);

  const freq = 70 + 190 * s + 30 * safeThrottle;
  const gain = 0.05 + 0.1 * safeThrottle + 0.05 * sMin1;
  const filterFreq = 400 + 2600 * sMin1 + 600 * safeThrottle;
  const noiseGain = 0.01 + 0.06 * sMin1;

  return { freq, gain, filterFreq, noiseGain };
}

export type Surface = 'road' | 'sand' | 'grass' | 'water' | 'air';

export interface RollParams {
  gain: number;
  filterFreq: number;
  q: number;
}

export function rollParams(speed: number, surface: Surface): RollParams {
  if (surface === 'air') {
    return { gain: 0, filterFreq: 1000, q: 0.7 };
  }

  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  if (safeSpeed === 0) {
    return { gain: 0, filterFreq: 600, q: 0.7 };
  }

  // Base speed factor: 0 at 0 m/s, saturating smoothly towards ~40 m/s
  // gain grows with speed (0 at 0 m/s, capped at 0.25)
  const normSpeed = Math.min(1, safeSpeed / 40);
  const baseGain = Math.min(0.22 * normSpeed, 0.25);

  switch (surface) {
    case 'road': {
      // road noisier/brighter (filter 1800..4200)
      const filterFreq = 1800 + (4200 - 1800) * normSpeed;
      const gain = Math.min(baseGain, 0.25);
      return { gain, filterFreq, q: 0.7 };
    }
    case 'sand': {
      // sand (dull, 600..1500, gain x0.8)
      const filterFreq = 600 + (1500 - 600) * normSpeed;
      const gain = Math.min(baseGain * 0.8, 0.25);
      return { gain, filterFreq, q: 0.7 };
    }
    case 'grass': {
      // grass (900..2200, gain x0.6)
      const filterFreq = 900 + (2200 - 900) * normSpeed;
      const gain = Math.min(baseGain * 0.6, 0.25);
      return { gain, filterFreq, q: 0.7 };
    }
    case 'water': {
      // water (spray: 2500..6000, gain x1.1, q 0.5)
      const filterFreq = 2500 + (6000 - 2500) * normSpeed;
      const gain = Math.min(baseGain * 1.1, 0.25);
      return { gain, filterFreq, q: 0.5 };
    }
  }
}
