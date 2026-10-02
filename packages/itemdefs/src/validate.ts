import type { ItemDef, ItemEffect, ItemKind, ValidationResult } from './types';

export const VALID_EFFECTS: readonly ItemEffect[] = [
  'boost', 'jump', 'oil', 'shockwave', 'anchor', 'slipstream', 'freeze', 'ghost'
];

export function kindForEffect(effect: ItemEffect): ItemKind {
  switch (effect) {
    case 'boost': case 'jump': case 'anchor': case 'slipstream': case 'ghost': return 'self';
    case 'oil': return 'drop';
    case 'shockwave': case 'freeze': return 'area';
  }
}

export function validateItem(x: unknown): ValidationResult {
  const errors: string[] = [];
  if (x === null || typeof x !== 'object' || Array.isArray(x)) {
    return { ok: false, errors: ['Item must be a non-null object.'] };
  }

  const raw = x as Record<string, unknown>;
  const idStr = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : 'unknown';

  if (typeof raw.id !== 'string' || raw.id.trim().length === 0) {
    errors.push(`Item '${idStr}': field 'id' must be a non-empty string.`);
  }
  if (typeof raw.label !== 'string' || raw.label.trim().length === 0) {
    errors.push(`Item '${idStr}': field 'label' must be a non-empty string.`);
  }
  if (typeof raw.icon !== 'string' || raw.icon.trim().length === 0) {
    errors.push(`Item '${idStr}': field 'icon' must be a non-empty string.`);
  }

  const isEffectValid = typeof raw.effect === 'string' && VALID_EFFECTS.includes(raw.effect as ItemEffect);
  if (!isEffectValid) {
    errors.push(`Item '${idStr}': field 'effect' must be one of ${VALID_EFFECTS.join(', ')}.`);
  } else {
    const expectedKind = kindForEffect(raw.effect as ItemEffect);
    if (raw.kind !== expectedKind) {
      errors.push(`Item '${idStr}': field 'kind' must be '${expectedKind}' for effect '${raw.effect}'.`);
    }
  }

  if (typeof raw.power !== 'number' || !Number.isFinite(raw.power) || raw.power < 0.25 || raw.power > 4) {
    errors.push(`Item '${idStr}': field 'power' must be a number between 0.25 and 4.`);
  }
  if (typeof raw.durationMs !== 'number' || !Number.isFinite(raw.durationMs) || raw.durationMs < 0 || raw.durationMs > 20000) {
    errors.push(`Item '${idStr}': field 'durationMs' must be a number between 0 and 20000.`);
  }
  if (typeof raw.radius !== 'number' || !Number.isFinite(raw.radius) || raw.radius < 0 || raw.radius > 80) {
    errors.push(`Item '${idStr}': field 'radius' must be a number between 0 and 80.`);
  } else if (isEffectValid && kindForEffect(raw.effect as ItemEffect) === 'self' && raw.radius !== 0) {
    errors.push(`Item '${idStr}': field 'radius' must be 0 for self-targeted items.`);
  }

  const w = raw.weights;
  if (!Array.isArray(w) || w.length !== 3 || !w.every((val: unknown) => typeof val === 'number' && Number.isFinite(val) && val >= 0)) {
    errors.push(`Item '${idStr}': field 'weights' must be a 3-element tuple of non-negative numbers.`);
  } else if ((w[0] ?? 0) + (w[1] ?? 0) + (w[2] ?? 0) <= 0) {
    errors.push(`Item '${idStr}': field 'weights' must have at least one positive weight.`);
  }

  if (typeof raw.enabled !== 'boolean') {
    errors.push(`Item '${idStr}': field 'enabled' must be a boolean.`);
  }

  return { ok: errors.length === 0, errors };
}

export function normalizeItem(i: ItemDef): ItemDef {
  const effect: ItemEffect = VALID_EFFECTS.includes(i.effect) ? i.effect : 'boost';
  const kind = kindForEffect(effect);
  const power = Math.max(0.25, Math.min(4, Number.isFinite(i.power) ? i.power : 1));
  const durationMs = Math.max(0, Math.min(20000, Math.round(Number.isFinite(i.durationMs) ? i.durationMs : 0)));
  const radius = kind === 'self' ? 0 : Math.max(0, Math.min(80, Number.isFinite(i.radius) ? i.radius : 0));

  const w0 = Math.max(0, Number.isFinite(i.weights?.[0]) ? i.weights[0]! : 0);
  const w1 = Math.max(0, Number.isFinite(i.weights?.[1]) ? i.weights[1]! : 0);
  const w2 = Math.max(0, Number.isFinite(i.weights?.[2]) ? i.weights[2]! : 0);
  const weights: [number, number, number] = (w0 + w1 + w2 > 0) ? [w0, w1, w2] : [1, 1, 1];
  const label = (typeof i.label === 'string' ? i.label : '').trim().slice(0, 24);

  return {
    id: typeof i.id === 'string' && i.id.trim().length > 0 ? i.id.trim() : 'item',
    label: label.length > 0 ? label : 'Item',
    icon: typeof i.icon === 'string' && i.icon.trim().length > 0 ? i.icon.trim() : '❓',
    effect,
    kind,
    durationMs,
    power,
    radius,
    weights,
    enabled: typeof i.enabled === 'boolean' ? i.enabled : true
  };
}

export function validateSet(items: unknown): ValidationResult {
  if (!Array.isArray(items)) {
    return { ok: false, errors: ['Item set must be an array.'] };
  }

  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    const res = validateItem(item);
    errors.push(...res.errors);
    if (item && typeof item === 'object' && 'id' in item && typeof (item as { id: unknown }).id === 'string') {
      const id = (item as { id: string }).id.trim();
      if (seenIds.has(id)) errors.push(`Duplicate item id '${id}' found in set.`);
      else if (id.length > 0) seenIds.add(id);
    }
  }

  let [fCount, mCount, bCount] = [0, 0, 0];
  for (const it of items) {
    if (it && typeof it === 'object' && (it as ItemDef).enabled === true && Array.isArray((it as ItemDef).weights)) {
      const w = (it as ItemDef).weights;
      if (typeof w[0] === 'number' && w[0] > 0) fCount++;
      if (typeof w[1] === 'number' && w[1] > 0) mCount++;
      if (typeof w[2] === 'number' && w[2] > 0) bCount++;
    }
  }

  if (fCount === 0) errors.push('No enabled item has a positive weight in the front bucket.');
  if (mCount === 0) errors.push('No enabled item has a positive weight in the middle bucket.');
  if (bCount === 0) errors.push('No enabled item has a positive weight in the back bucket.');

  return { ok: errors.length === 0, errors };
}
