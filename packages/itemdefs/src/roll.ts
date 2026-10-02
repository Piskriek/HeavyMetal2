import type { BucketIndex, ItemDef, RollChance } from './types';

export function bucketOf(position: number, racers: number): BucketIndex {
  const r = Math.max(1, Number.isFinite(racers) ? Math.floor(racers) : 1);
  const pos = Number.isFinite(position) ? Math.floor(position) : 1;
  const p = Math.max(1, Math.min(r, pos));
  const idx = p - 1;

  if (idx < r / 3) {
    return 0;
  }
  if (idx >= (2 * r) / 3) {
    return 2;
  }
  return 1;
}

export function rollTable(
  items: readonly ItemDef[],
  bucket: BucketIndex
): RollChance[] {
  const eligible = items.filter(
    item => item.enabled && (item.weights[bucket] ?? 0) > 0
  );
  const totalWeight = eligible.reduce(
    (sum, item) => sum + (item.weights[bucket] ?? 0),
    0
  );

  if (eligible.length === 0 || totalWeight <= 0) {
    return [];
  }

  const result: RollChance[] = eligible.map(item => ({
    id: item.id,
    chance: (item.weights[bucket] ?? 0) / totalWeight
  }));

  result.sort((a, b) => {
    if (b.chance !== a.chance) {
      return b.chance - a.chance;
    }
    return a.id.localeCompare(b.id);
  });

  return result;
}

export function rollItem(
  items: readonly ItemDef[],
  position: number,
  racers: number,
  rng: () => number
): ItemDef | undefined {
  const roll = rng();
  const bucket = bucketOf(position, racers);
  const eligible = items.filter(
    item => item.enabled && (item.weights[bucket] ?? 0) > 0
  );
  const totalWeight = eligible.reduce(
    (sum, item) => sum + (item.weights[bucket] ?? 0),
    0
  );

  if (eligible.length === 0 || totalWeight <= 0) {
    return undefined;
  }

  const target = roll * totalWeight;
  let running = 0;
  for (const item of eligible) {
    running += item.weights[bucket] ?? 0;
    if (target < running) {
      return item;
    }
  }

  return eligible[eligible.length - 1];
}
