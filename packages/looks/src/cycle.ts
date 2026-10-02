import { LookParams } from './types';
import { LOOKS } from './presets';
import { mixLooks } from './mix';

interface Keyframe {
  hour: number;
  id: string;
}

const KEYFRAMES: readonly Keyframe[] = [
  { hour: 0, id: 'moonlit-night' },
  { hour: 4.5, id: 'moonlit-night' },
  { hour: 5.5, id: 'blue-hour' },
  { hour: 6.5, id: 'tropical-dawn' },
  { hour: 9, id: 'noon-clear' },
  { hour: 13, id: 'noon-clear' },
  { hour: 16.5, id: 'golden-hour' },
  { hour: 18.5, id: 'sunset-blaze' },
  { hour: 19.5, id: 'blue-hour' },
  { hour: 21, id: 'moonlit-night' },
  { hour: 24, id: 'moonlit-night' }
] as const;

export function timeOfDayLook(hour: number): LookParams {
  // Wrap hour modulo 24
  let h = hour % 24;
  if (h < 0) {
    h += 24;
  }

  // Find the neighboring keyframes
  let keyA: Keyframe = KEYFRAMES[0]!;
  let keyB: Keyframe = KEYFRAMES[KEYFRAMES.length - 1]!;

  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const current = KEYFRAMES[i];
    const next = KEYFRAMES[i + 1];
    if (current && next && h >= current.hour && h <= next.hour) {
      keyA = current;
      keyB = next;
      break;
    }
  }

  let t = 0;
  const duration = keyB.hour - keyA.hour;
  if (duration > 0) {
    t = (h - keyA.hour) / duration;
  }

  const lookA = LOOKS.find((l) => l.id === keyA.id)!.params;
  const lookB = LOOKS.find((l) => l.id === keyB.id)!.params;

  const mixed = mixLooks(lookA, lookB, t);

  // Override sunElevation and sunAzimuth to follow one continuous path
  let sunElevation = 0;
  if (h >= 6 && h <= 18) {
    const val = 90 * Math.sin((Math.PI * (h - 6)) / 12);
    sunElevation = Math.max(-20, Math.min(90, val));
  } else if (h < 6) {
    const factor = h / 6;
    const smooth = factor * factor * (3 - 2 * factor);
    sunElevation = -20 + 20 * smooth;
  } else {
    // h > 18
    const factor = (24 - h) / 6;
    const smooth = factor * factor * (3 - 2 * factor);
    sunElevation = -20 + 20 * smooth;
  }

  const azFactor = Math.max(0, Math.min(1, (h - 6) / 12));
  const sunAzimuth = 90 + 180 * azFactor;

  return {
    ...mixed,
    sunElevation,
    sunAzimuth
  };
}
