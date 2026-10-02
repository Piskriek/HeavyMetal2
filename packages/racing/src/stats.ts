export interface RacerStats {
  weight: number;
  speed: number;
  bounce: number;
}

export const BUDGET = 15;

const STAT_KEYS = ['weight', 'speed', 'bounce'] as const;

export function validateStats(s: RacerStats): { ok: boolean; total: number; errors: string[] } {
  const total = s.weight + s.speed + s.bounce;
  const errors: string[] = [];

  for (const key of STAT_KEYS) {
    const value = s[key];
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      errors.push(`${key} must be an integer from 1 to 10.`);
    }
  }

  if (total > BUDGET) {
    errors.push(`The weight, speed, and bounce total (${total}) must not exceed the budget of ${BUDGET}.`);
  }

  return { ok: errors.length === 0, total, errors };
}

function clampStat(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.max(1, Math.min(10, Math.round(value)));
}

export function normalizeStats(s: RacerStats): RacerStats {
  const normalized: RacerStats = {
    weight: clampStat(s.weight),
    speed: clampStat(s.speed),
    bounce: clampStat(s.bounce),
  };

  while (normalized.weight + normalized.speed + normalized.bounce > BUDGET) {
    let largest: keyof RacerStats = 'weight';
    for (const key of STAT_KEYS.slice(1)) {
      if (normalized[key] > normalized[largest]) largest = key;
    }
    normalized[largest] -= 1;
  }

  return normalized;
}

export interface RacerPhysics {
  mass: number;
  maxSpeed: number;
  acceleration: number;
  restitution: number;
  grip: number;
}

export function derivePhysics(s: RacerStats): RacerPhysics {
  const mass = 0.8 + 0.12 * s.weight;
  return {
    mass,
    maxSpeed: 18 + 2.4 * s.speed,
    acceleration: (10 + 3.2 * s.speed) / mass,
    restitution: 0.15 + 0.06 * s.bounce,
    grip: 0.6 + 0.04 * s.weight,
  };
}