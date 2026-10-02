import type { ItemDef } from './types';
import { validateSet } from './validate';

function cloneItem(item: ItemDef): ItemDef {
  return {
    ...item,
    weights: [item.weights[0], item.weights[1], item.weights[2]]
  };
}

function nextUniqueId(existingIds: Set<string>, baseId: string): string {
  const cleanId = baseId.trim().length > 0 ? baseId.trim() : 'item';
  if (!existingIds.has(cleanId)) {
    return cleanId;
  }
  let count = 2;
  while (existingIds.has(`${cleanId}-${count}`)) {
    count++;
  }
  return `${cleanId}-${count}`;
}

export function setItem(
  items: readonly ItemDef[],
  id: string,
  patch: Partial<ItemDef>
): ItemDef[] {
  return items.map(item => {
    if (item.id !== id) {
      return cloneItem(item);
    }
    const nextWeights: [number, number, number] = patch.weights
      ? [patch.weights[0] ?? 0, patch.weights[1] ?? 0, patch.weights[2] ?? 0]
      : [item.weights[0], item.weights[1], item.weights[2]];

    return {
      ...item,
      ...patch,
      weights: nextWeights
    };
  });
}

export function addItem(
  items: readonly ItemDef[],
  base: ItemDef,
  newId?: string
): ItemDef[] {
  const existingIds = new Set(items.map(i => i.id));
  const candidateId = newId && newId.trim().length > 0 ? newId.trim() : base.id;
  const uniqueId = nextUniqueId(existingIds, candidateId);

  const newItem: ItemDef = {
    ...cloneItem(base),
    id: uniqueId
  };

  return [...items.map(cloneItem), newItem];
}

export function removeItem(
  items: readonly ItemDef[],
  id: string
): ItemDef[] {
  return items.filter(item => item.id !== id).map(cloneItem);
}

export function duplicateItem(
  items: readonly ItemDef[],
  id: string
): ItemDef[] {
  const found = items.find(item => item.id === id);
  if (!found) {
    return items.map(cloneItem);
  }

  const existingIds = new Set(items.map(i => i.id));
  const uniqueId = nextUniqueId(existingIds, `${found.id}-copy`);
  const labelBase = `${found.label} Copy`;
  const label = labelBase.length > 24 ? labelBase.slice(0, 24) : labelBase;

  const duplicate: ItemDef = {
    ...cloneItem(found),
    id: uniqueId,
    label
  };

  return [...items.map(cloneItem), duplicate];
}

export function itemsToJson(items: readonly ItemDef[]): string {
  const ordered = items.map(i => ({
    id: i.id,
    label: i.label,
    icon: i.icon,
    effect: i.effect,
    kind: i.kind,
    durationMs: i.durationMs,
    power: i.power,
    radius: i.radius,
    weights: [i.weights[0], i.weights[1], i.weights[2]],
    enabled: i.enabled
  }));
  return JSON.stringify(ordered, null, 2);
}

export function itemsFromJson(
  text: string
): { items: ItemDef[] | null; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      items: null,
      errors: [
        `Invalid JSON: ${err instanceof Error ? err.message : 'Parse error'}`
      ]
    };
  }

  const validation = validateSet(parsed);
  if (!validation.ok) {
    return {
      items: null,
      errors: validation.errors
    };
  }

  return {
    items: (parsed as ItemDef[]).map(cloneItem),
    errors: []
  };
}
