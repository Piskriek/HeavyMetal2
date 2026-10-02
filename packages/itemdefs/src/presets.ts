import type { ItemDef } from './types';

export const ITEM_PRESETS: readonly ItemDef[] = [
  {
    id: 'boost',
    label: 'Boost',
    icon: '⚡',
    effect: 'boost',
    kind: 'self',
    durationMs: 2500,
    power: 1,
    radius: 0,
    weights: [1, 2, 4],
    enabled: true
  },
  {
    id: 'jump',
    label: 'Jump',
    icon: '⬆️',
    effect: 'jump',
    kind: 'self',
    durationMs: 600,
    power: 1,
    radius: 0,
    weights: [2, 2, 2],
    enabled: true
  },
  {
    id: 'oil',
    label: 'Oil',
    icon: '🛢️',
    effect: 'oil',
    kind: 'drop',
    durationMs: 6000,
    power: 1,
    radius: 4.5,
    weights: [3, 2, 1],
    enabled: true
  },
  {
    id: 'shockwave',
    label: 'Shockwave',
    icon: '💥',
    effect: 'shockwave',
    kind: 'area',
    durationMs: 0,
    power: 1,
    radius: 22,
    weights: [3, 2, 1],
    enabled: true
  },
  {
    id: 'anchor',
    label: 'Anchor',
    icon: '⚓',
    effect: 'anchor',
    kind: 'self',
    durationMs: 4000,
    power: 1,
    radius: 0,
    weights: [2, 2, 2],
    enabled: true
  },
  {
    id: 'slipstream',
    label: 'Slipstream',
    icon: '🌀',
    effect: 'slipstream',
    kind: 'self',
    durationMs: 5000,
    power: 1,
    radius: 0,
    weights: [2, 3, 3],
    enabled: true
  },
  {
    id: 'freeze',
    label: 'Freeze',
    icon: '❄️',
    effect: 'freeze',
    kind: 'area',
    durationMs: 1800,
    power: 1,
    radius: 30,
    weights: [4, 2, 1],
    enabled: true
  },
  {
    id: 'ghost',
    label: 'Ghost',
    icon: '👻',
    effect: 'ghost',
    kind: 'self',
    durationMs: 4000,
    power: 1,
    radius: 0,
    weights: [1, 2, 3],
    enabled: true
  }
];

export function itemPresetById(id: string): ItemDef | undefined {
  const item = ITEM_PRESETS.find(p => p.id === id);
  if (!item) return undefined;
  return {
    ...item,
    weights: [item.weights[0], item.weights[1], item.weights[2]]
  };
}
