/**
 * soundscape — a spatial audio model as pure data and pure functions.
 *
 * Emitters are points with a falloff, zones are boxes of ambience that fade at
 * their edges, and the mix is what the listener hears from where they stand:
 * panned voices under a voice limit, plus normalised ambience beds.
 */

export type Vec3 = [number, number, number];

export interface Emitter {
  id: string;
  pos: Vec3;
  sound: string;
  volume: number;
  radius: number;
  falloff: number;
  loop: boolean;
}

export interface Zone {
  id: string;
  centre: Vec3;
  half: Vec3;
  fade: number;
  ambience: string;
  volume: number;
}

export interface Voice {
  id: string;
  sound: string;
  gain: number;
  pan: number;
}

export interface Bed {
  ambience: string;
  gain: number;
}

export interface Mix {
  voices: Voice[];
  beds: Bed[];
}

/** A synth layer: a wave or noise, a level, a slow wobble, and a filter. */
export interface Layer {
  wave: 'sine' | 'triangle' | 'noise';
  freq: number;
  gain: number;
  lfoHz: number;
  lfoDepth: number;
  filter: 'lowpass' | 'bandpass' | 'highpass';
  cutoff: number;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

const span = (a: number, b: number): number => {
  const d = a - b;
  return d * d;
};

const between = (a: Vec3, b: Vec3): number => Math.sqrt(span(a[0], b[0]) + span(a[1], b[1]) + span(a[2], b[2]));

/** volume inside `radius`, falling linearly to 0 at radius + falloff (falloff 0: a hard edge), 0 beyond. */
export function emitterGain(e: Emitter, listener: Vec3): number {
  const d = between(listener, e.pos);
  if (d <= e.radius) return e.volume;
  if (e.falloff <= 0) return 0;
  const over = d - e.radius;
  if (over >= e.falloff) return 0;
  return e.volume * (1 - over / e.falloff);
}

/**
 * 1 inside the box (centre +- half), falling linearly to 0 at `fade` metres outside it
 * (distance to the box), times volume.
 */
export function zoneGain(z: Zone, listener: Vec3): number {
  const dx = Math.max(Math.abs(listener[0] - z.centre[0]) - z.half[0], 0);
  const dy = Math.max(Math.abs(listener[1] - z.centre[1]) - z.half[1], 0);
  const dz = Math.max(Math.abs(listener[2] - z.centre[2]) - z.half[2], 0);
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d <= 0) return z.volume;
  if (z.fade <= 0) return 0;
  if (d >= z.fade) return 0;
  return z.volume * (1 - d / z.fade);
}

/**
 * -1 hard left .. +1 hard right. Facing direction (sin yaw, 0, cos yaw) for yaw in degrees;
 * right = (cos yaw, 0, -sin yaw). pan = the horizontal unit direction to the source dotted
 * with right; 0 when the source is on the listener.
 */
export function panOf(listener: Vec3, yawDeg: number, source: Vec3): number {
  const dx = source[0] - listener[0];
  const dz = source[2] - listener[2];
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len <= 0) return 0;
  const yaw = (yawDeg * Math.PI) / 180;
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  return clamp((dx * rightX + dz * rightZ) / len, -1, 1);
}

interface Candidate {
  id: string;
  sound: string;
  gain: number;
  pan: number;
  order: number;
}

interface BedEntry {
  ambience: string;
  gain: number;
  order: number;
}

/**
 * The mix: every emitter with gain > 0 as a voice, loudest first, at most maxVoices (ties: emitter order).
 * Beds: one per ambience name, its gain the largest of that name's zones; when the beds' gains add up to
 * more than 1 they are all scaled so they add up to 1. Beds with gain 0 are left out; beds sorted by gain,
 * loudest first.
 */
export function mixAt(
  listener: Vec3,
  yawDeg: number,
  emitters: readonly Emitter[],
  zones: readonly Zone[],
  maxVoices?: number,
): Mix {
  const candidates: Candidate[] = [];
  for (let i = 0; i < emitters.length; i++) {
    const e = emitters[i];
    if (e === undefined) continue;
    const gain = emitterGain(e, listener);
    if (gain > 0) {
      candidates.push({ id: e.id, sound: e.sound, gain, pan: panOf(listener, yawDeg, e.pos), order: i });
    }
  }
  candidates.sort((a, b) => (b.gain - a.gain) || (a.order - b.order));

  const limit = maxVoices === undefined ? candidates.length : Math.max(0, Math.floor(maxVoices));
  const voices: Voice[] = [];
  for (let i = 0; i < candidates.length && i < limit; i++) {
    const c = candidates[i];
    if (c === undefined) continue;
    voices.push({ id: c.id, sound: c.sound, gain: c.gain, pan: c.pan });
  }

  const best: BedEntry[] = [];
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (z === undefined) continue;
    const gain = zoneGain(z, listener);
    if (gain <= 0) continue;
    let slot: BedEntry | undefined;
    for (const b of best) {
      if (b.ambience === z.ambience) {
        slot = b;
        break;
      }
    }
    if (slot === undefined) best.push({ ambience: z.ambience, gain, order: i });
    else if (gain > slot.gain) slot.gain = gain;
  }
  best.sort((a, b) => (b.gain - a.gain) || (a.order - b.order));

  let total = 0;
  for (const b of best) total += b.gain;
  const scale = total > 1 ? 1 / total : 1;

  const beds: Bed[] = [];
  for (const b of best) beds.push({ ambience: b.ambience, gain: b.gain * scale });

  return { voices, beds };
}

export const AMBIENCES: readonly { id: string; name: string; layers: Layer[] }[] = [
  {
    id: 'forest-birds',
    name: 'Forest Birds',
    layers: [
      { wave: 'sine', freq: 2840, gain: 0.16, lfoHz: 6.4, lfoDepth: 0.85, filter: 'bandpass', cutoff: 3200 },
      { wave: 'sine', freq: 4260, gain: 0.13, lfoHz: 9.2, lfoDepth: 0.9, filter: 'bandpass', cutoff: 4800 },
      { wave: 'triangle', freq: 1920, gain: 0.1, lfoHz: 4.1, lfoDepth: 0.7, filter: 'bandpass', cutoff: 2300 },
      { wave: 'noise', freq: 620, gain: 0.12, lfoHz: 0.22, lfoDepth: 0.35, filter: 'lowpass', cutoff: 1100 },
    ],
  },
  {
    id: 'windy-hill',
    name: 'Windy Hill',
    layers: [
      { wave: 'noise', freq: 420, gain: 0.42, lfoHz: 0.08, lfoDepth: 0.65, filter: 'lowpass', cutoff: 560 },
      { wave: 'noise', freq: 240, gain: 0.22, lfoHz: 0.13, lfoDepth: 0.5, filter: 'bandpass', cutoff: 260 },
      { wave: 'triangle', freq: 92, gain: 0.12, lfoHz: 0.05, lfoDepth: 0.4, filter: 'lowpass', cutoff: 320 },
    ],
  },
  {
    id: 'creepy-cave',
    name: 'Creepy Cave',
    layers: [
      { wave: 'sine', freq: 41, gain: 0.34, lfoHz: 0.07, lfoDepth: 0.35, filter: 'lowpass', cutoff: 180 },
      { wave: 'sine', freq: 63, gain: 0.2, lfoHz: 0.11, lfoDepth: 0.3, filter: 'lowpass', cutoff: 300 },
      { wave: 'sine', freq: 1180, gain: 0.12, lfoHz: 3.4, lfoDepth: 0.95, filter: 'bandpass', cutoff: 1500 },
      { wave: 'noise', freq: 760, gain: 0.1, lfoHz: 0.19, lfoDepth: 0.55, filter: 'bandpass', cutoff: 720 },
    ],
  },
  {
    id: 'busy-city',
    name: 'Busy City',
    layers: [
      { wave: 'noise', freq: 1150, gain: 0.3, lfoHz: 0.35, lfoDepth: 0.25, filter: 'bandpass', cutoff: 1150 },
      { wave: 'noise', freq: 2400, gain: 0.2, lfoHz: 0.62, lfoDepth: 0.3, filter: 'lowpass', cutoff: 2600 },
      { wave: 'sine', freq: 58, gain: 0.22, lfoHz: 0.09, lfoDepth: 0.2, filter: 'lowpass', cutoff: 220 },
      { wave: 'triangle', freq: 116, gain: 0.1, lfoHz: 0.14, lfoDepth: 0.25, filter: 'lowpass', cutoff: 420 },
    ],
  },
  {
    id: 'rainy-day',
    name: 'Rainy Day',
    layers: [
      { wave: 'noise', freq: 3200, gain: 0.38, lfoHz: 0.5, lfoDepth: 0.2, filter: 'highpass', cutoff: 1800 },
      { wave: 'noise', freq: 6400, gain: 0.22, lfoHz: 1.7, lfoDepth: 0.35, filter: 'highpass', cutoff: 4200 },
      { wave: 'noise', freq: 700, gain: 0.14, lfoHz: 0.12, lfoDepth: 0.3, filter: 'lowpass', cutoff: 700 },
    ],
  },
  {
    id: 'beach-waves',
    name: 'Beach Waves',
    layers: [
      { wave: 'noise', freq: 520, gain: 0.4, lfoHz: 0.12, lfoDepth: 0.75, filter: 'lowpass', cutoff: 720 },
      { wave: 'noise', freq: 1600, gain: 0.2, lfoHz: 0.17, lfoDepth: 0.6, filter: 'lowpass', cutoff: 1800 },
      { wave: 'noise', freq: 320, gain: 0.12, lfoHz: 0.1, lfoDepth: 0.5, filter: 'bandpass', cutoff: 340 },
    ],
  },
  {
    id: 'campfire-night',
    name: 'Campfire Night',
    layers: [
      { wave: 'noise', freq: 2600, gain: 0.16, lfoHz: 7.5, lfoDepth: 0.85, filter: 'bandpass', cutoff: 2600 },
      { wave: 'noise', freq: 1350, gain: 0.12, lfoHz: 11.2, lfoDepth: 0.9, filter: 'bandpass', cutoff: 1450 },
      { wave: 'sine', freq: 72, gain: 0.22, lfoHz: 0.15, lfoDepth: 0.35, filter: 'lowpass', cutoff: 200 },
      { wave: 'noise', freq: 500, gain: 0.14, lfoHz: 0.4, lfoDepth: 0.4, filter: 'lowpass', cutoff: 520 },
    ],
  },
  {
    id: 'lava-rumble',
    name: 'Lava Rumble',
    layers: [
      { wave: 'sine', freq: 30, gain: 0.34, lfoHz: 0.05, lfoDepth: 0.5, filter: 'lowpass', cutoff: 120 },
      { wave: 'sine', freq: 45, gain: 0.22, lfoHz: 0.09, lfoDepth: 0.45, filter: 'lowpass', cutoff: 180 },
      { wave: 'noise', freq: 220, gain: 0.16, lfoHz: 0.21, lfoDepth: 0.5, filter: 'lowpass', cutoff: 260 },
      { wave: 'triangle', freq: 90, gain: 0.1, lfoHz: 0.33, lfoDepth: 0.4, filter: 'lowpass', cutoff: 320 },
    ],
  },
];