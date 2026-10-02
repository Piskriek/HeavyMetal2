export interface ItemDef {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly kind: 'self' | 'drop' | 'area';
  readonly durationMs: number;
  readonly weights: readonly number[];
}

export const ITEMS: readonly ItemDef[] = [
  { id: 'boost', label: 'Boost', icon: '⚡', kind: 'self', durationMs: 2500, weights: [1, 2, 4] },
  { id: 'jump', label: 'Jump', icon: '🦘', kind: 'self', durationMs: 600, weights: [2, 2, 2] },
  { id: 'oil', label: 'Oil Slick', icon: '🛢️', kind: 'drop', durationMs: 6000, weights: [2, 3, 2] },
  { id: 'shockwave', label: 'Shockwave', icon: '💥', kind: 'area', durationMs: 0, weights: [1, 2, 3] },
  { id: 'mass', label: 'Heavy Shell', icon: '🧱', kind: 'self', durationMs: 4000, weights: [1, 2, 3] },
  { id: 'slipstream', label: 'Slipstream', icon: '🌪️', kind: 'self', durationMs: 5000, weights: [3, 2, 1] },
  { id: 'freeze', label: 'Freeze', icon: '❄️', kind: 'area', durationMs: 2000, weights: [4, 2, 1] },
  { id: 'ghost', label: 'Ghost', icon: '👻', kind: 'self', durationMs: 4000, weights: [2, 2, 2] },
];

export function itemById(id: string): ItemDef | undefined {
  return ITEMS.find((item) => item.id === id);
}

export function rollItem(position: number, racers: number, rng: () => number): ItemDef {
  const bucket = position <= racers / 3 ? 0 : position > (2 * racers) / 3 ? 2 : 1;
  let totalWeight = 0;
  for (const item of ITEMS) totalWeight += item.weights[bucket] ?? 0;

  let ticket = rng() * totalWeight;
  for (const item of ITEMS) {
    ticket -= item.weights[bucket] ?? 0;
    if (ticket < 0) return item;
  }

  return ITEMS[ITEMS.length - 1]!;
}