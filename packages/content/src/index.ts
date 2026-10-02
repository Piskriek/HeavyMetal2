import { MATERIALS } from './materials';
import { RACERS } from './racers';
import { CAMERAS } from './cameras';
import { PROPS } from './props';
import type { PresetSeed } from './types';

export * from './types';
export * from './materials';
export * from './racers';
export * from './cameras';
export * from './props';
export * from './validate';

export const ALL_SEEDS: PresetSeed[] = [...MATERIALS, ...RACERS, ...CAMERAS, ...PROPS];

const SEED_MAP = new Map<string, PresetSeed>();
for (const seed of ALL_SEEDS) {
  SEED_MAP.set(seed.name, seed);
}

export function seedsOfKind(kind: PresetSeed['kind']): PresetSeed[] {
  return ALL_SEEDS.filter((s) => s.kind === kind);
}

export function findSeed(name: string): PresetSeed | undefined {
  return SEED_MAP.get(name);
}
