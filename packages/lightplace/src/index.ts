export type Vec3 = [number, number, number];
export type Flicker = 'none' | 'candle' | 'fire' | 'strobe' | 'pulse' | 'faulty';

export interface LightPreset {
  id: string;
  name: string;
  kind: 'point' | 'spot';
  color: string; // '#rrggbb'
  intensity: number; // 0..10
  range: number; // metres, 0.5..60 (no light at or beyond it)
  angle: number; // spot: half-angle of the cone in degrees, 1..90 (points: 0)
  penumbra: number; // spot: 0..1, the share of the cone that fades at its edge (points: 0)
  flicker: Flicker;
  rate: number; // flickers or flashes per second (> 0 unless flicker is 'none')
  castShadow: boolean;
}

export const LIGHT_PRESETS: readonly LightPreset[] = [
  {
    id: 'bulb',
    name: 'Bulb',
    kind: 'point',
    color: '#fff4e6',
    intensity: 2.0,
    range: 12.0,
    angle: 0,
    penumbra: 0,
    flicker: 'none',
    rate: 0,
    castShadow: false,
  },
  {
    id: 'spotlight',
    name: 'Spotlight',
    kind: 'spot',
    color: '#ffffff',
    intensity: 6.0,
    range: 30.0,
    angle: 25,
    penumbra: 0.5,
    flicker: 'none',
    rate: 0,
    castShadow: false,
  },
  {
    id: 'flashlight-orb',
    name: 'Flashlight Orb',
    kind: 'spot',
    color: '#d8ecff',
    intensity: 4.5,
    range: 20.0,
    angle: 12,
    penumbra: 0.2,
    flicker: 'none',
    rate: 0,
    castShadow: false,
  },
  {
    id: 'campfire',
    name: 'Campfire',
    kind: 'point',
    color: '#ff6600',
    intensity: 5.0,
    range: 15.0,
    angle: 0,
    penumbra: 0,
    flicker: 'fire',
    rate: 3.5,
    castShadow: false,
  },
  {
    id: 'candle',
    name: 'Candle',
    kind: 'point',
    color: '#ffb347',
    intensity: 0.8,
    range: 2.5,
    angle: 0,
    penumbra: 0,
    flicker: 'candle',
    rate: 2.0,
    castShadow: false,
  },
  {
    id: 'strobe',
    name: 'Strobe',
    kind: 'point',
    color: '#ffffff',
    intensity: 8.0,
    range: 25.0,
    angle: 0,
    penumbra: 0,
    flicker: 'strobe',
    // never more than three flashes a second (photosensitive players; hotbar spec V3.1, comfort and safety)
    rate: 2.5,
    castShadow: false,
  },
  {
    id: 'lantern',
    name: 'Lantern',
    kind: 'point',
    color: '#ffcc66',
    intensity: 2.5,
    range: 8.0,
    angle: 0,
    penumbra: 0,
    flicker: 'candle',
    rate: 0.8,
    castShadow: false,
  },
  {
    id: 'neon',
    name: 'Neon',
    kind: 'point',
    color: '#ff1493',
    intensity: 3.5,
    range: 10.0,
    angle: 0,
    penumbra: 0,
    flicker: 'faulty',
    rate: 2.5,
    castShadow: false,
  },
  {
    id: 'disco',
    name: 'Disco Light',
    kind: 'point',
    color: '#a855f7',
    intensity: 4.0,
    range: 18.0,
    angle: 0,
    penumbra: 0,
    flicker: 'pulse',
    rate: 2.0,
    castShadow: false,
  },
  {
    id: 'torch',
    name: 'Torch',
    kind: 'point',
    color: '#ff5500',
    intensity: 3.8,
    range: 10.0,
    angle: 0,
    penumbra: 0,
    flicker: 'fire',
    rate: 3.0,
    castShadow: true,
  },
];

export function presetById(id: string): LightPreset | undefined {
  return LIGHT_PRESETS.find((p) => p.id === id);
}

function hashInt(x: number): number {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function hash2(i: number, seed: number): number {
  const h1 = hashInt(i);
  const h2 = hashInt(seed ^ 0x9e3779b9);
  return (hashInt(h1 ^ Math.imul(h2, 0x27d4eb2d)) >>> 0) / 4294967296;
}

function smoothNoise(x: number, seed: number): number {
  const i0 = Math.floor(x);
  const f = x - i0;
  const s = f * f * f * (f * (f * 6 - 15) + 10);
  const v0 = hash2(i0, seed);
  const v1 = hash2(i0 + 1, seed);
  return v0 + (v1 - v0) * s;
}

/**
 * Brightness multiplier at time t seconds. none: 1. pulse: 0.5 + 0.5 * sin(2 pi rate t). strobe: 1 while (t * rate) mod 1 < 0.2, else 0.
 * candle: smooth seeded noise of t * rate, always within [0.75, 1.05]. fire: rougher, within [0.55, 1.15]. faulty: 1 most of the time with
 * short random drop-outs to 0. Same kind, rate, t and seed: same value.
 */
export function flicker(kind: Flicker, rate: number, t: number, seed: number): number {
  switch (kind) {
    case 'none':
      return 1;
    case 'pulse':
      return 0.5 + 0.5 * Math.sin(2 * Math.PI * rate * t);
    case 'strobe': {
      if (rate <= 0) return 1;
      const tr = t * rate;
      const phase = tr - Math.floor(tr);
      return phase < 0.2 ? 1 : 0;
    }
    case 'candle': {
      if (rate <= 0) return 0.9;
      const u = t * rate;
      const n = 0.75 * smoothNoise(u, seed) + 0.25 * smoothNoise(u * 2.1 + 7.3, seed + 101);
      const val = 0.75 + 0.3 * n;
      return Math.min(1.05, Math.max(0.75, val));
    }
    case 'fire': {
      if (rate <= 0) return 0.85;
      const u = t * rate;
      const n =
        0.45 * smoothNoise(u, seed) +
        0.35 * smoothNoise(u * 2.7 + 13.7, seed + 211) +
        0.2 * smoothNoise(u * 6.3 + 31.9, seed + 409);
      const val = 0.55 + 0.6 * n;
      return Math.min(1.15, Math.max(0.55, val));
    }
    case 'faulty': {
      if (rate <= 0) return 1;
      const u = t * rate;
      const cycle = Math.floor(u);
      const frac = u - cycle;
      const start = hash2(cycle, seed) * 0.85;
      const dur = 0.03 + 0.04 * hash2(cycle + 7777, seed);
      if (frac >= start && frac < start + dur) {
        return 0;
      }
      return 1;
    }
  }
}

/**
 * How much of a light reaches `point`: intensity * (1 - d / range)^2 for d < range, else 0. A spot also multiplies by its cone: 1 when the
 * angle between `dir` (unit) and the direction to the point is at most inner = angle * (1 - penumbra), 0 at angle or beyond, linear between.
 */
export function lightAt(p: LightPreset, pos: Vec3, dir: Vec3, point: Vec3): number {
  const dx = point[0] - pos[0];
  const dy = point[1] - pos[1];
  const dz = point[2] - pos[2];
  const d = Math.hypot(dx, dy, dz);

  if (d >= p.range) {
    return 0;
  }

  const distFactor = p.intensity * Math.pow(1 - d / p.range, 2);

  if (p.kind === 'point') {
    return distFactor;
  }

  if (d === 0) {
    return distFactor;
  }

  const dirLen = Math.hypot(dir[0], dir[1], dir[2]);
  if (dirLen === 0) {
    return distFactor;
  }

  const dot = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / (d * dirLen);
  const clampedDot = Math.max(-1, Math.min(1, dot));
  const angleBetween = Math.acos(clampedDot) * (180 / Math.PI);

  const inner = p.angle * (1 - p.penumbra);
  const outer = p.angle;

  if (angleBetween <= inner) {
    return distFactor;
  }
  if (angleBetween >= outer) {
    return 0;
  }

  const cone = (outer - angleBetween) / (outer - inner);
  return distFactor * cone;
}

/** The lights worth drawing: indices of the `max` best by score intensity * range / max(1, distance to eye), lights that are off left out; ties: lower index first. */
export function pickLights(
  lights: readonly { pos: Vec3; intensity: number; range: number; on: boolean }[],
  eye: Vec3,
  max: number,
): number[] {
  if (max <= 0) {
    return [];
  }

  const scored: { index: number; score: number }[] = [];

  for (let i = 0; i < lights.length; i++) {
    const light = lights[i];
    if (!light || !light.on) {
      continue;
    }
    const dx = light.pos[0] - eye[0];
    const dy = light.pos[1] - eye[1];
    const dz = light.pos[2] - eye[2];
    const dist = Math.hypot(dx, dy, dz);
    const score = (light.intensity * light.range) / Math.max(1, dist);
    scored.push({ index: i, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.index - b.index;
  });

  return scored.slice(0, max).map((s) => s.index);
}