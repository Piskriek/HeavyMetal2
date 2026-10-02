import type { Anchor, HudElement, HudLayout } from './types';

const VALID_KINDS = new Set<string>([
  'speed',
  'lap',
  'position',
  'time',
  'item',
  'minimap',
  'message',
  'boost'
]);

const VALID_ANCHORS = new Set<string>([
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
]);

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function validateLayout(x: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isObject(x)) {
    return { ok: false, errors: ['layout must be an object'] };
  }

  if (typeof x['id'] !== 'string' || x['id'].trim() === '') {
    errors.push("layout 'id' must be a non-empty string");
  }

  if (typeof x['name'] !== 'string') {
    errors.push("layout 'name' must be a string");
  }

  if (!Array.isArray(x['elements'])) {
    errors.push("layout 'elements' must be an array");
    return { ok: false, errors };
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < x['elements'].length; i++) {
    const el = x['elements'][i];
    const elemName = isObject(el) && typeof el['id'] === 'string' && el['id'] !== ''
      ? el['id']
      : `at index ${i}`;

    if (!isObject(el)) {
      errors.push(`element ${elemName}: must be an object`);
      continue;
    }

    if (typeof el['id'] !== 'string' || el['id'].trim() === '') {
      errors.push(`element ${elemName}: id must be a non-empty string`);
    } else {
      if (seenIds.has(el['id'])) {
        errors.push(`element '${el['id']}': duplicate id '${el['id']}'`);
      } else {
        seenIds.add(el['id']);
      }
    }

    if (typeof el['kind'] !== 'string' || !VALID_KINDS.has(el['kind'])) {
      errors.push(`element '${elemName}': invalid kind '${String(el['kind'])}'`);
    }

    if (typeof el['anchor'] !== 'string' || !VALID_ANCHORS.has(el['anchor'])) {
      errors.push(`element '${elemName}': invalid anchor '${String(el['anchor'])}'`);
    }

    if (typeof el['offsetX'] !== 'number' || Number.isNaN(el['offsetX'])) {
      errors.push(`element '${elemName}': offsetX must be a number`);
    }

    if (typeof el['offsetY'] !== 'number' || Number.isNaN(el['offsetY'])) {
      errors.push(`element '${elemName}': offsetY must be a number`);
    }

    if (typeof el['scale'] !== 'number' || Number.isNaN(el['scale']) || el['scale'] < 0.5 || el['scale'] > 2) {
      errors.push(`element '${elemName}': scale must be between 0.5 and 2`);
    }

    if (typeof el['visible'] !== 'boolean') {
      errors.push(`element '${elemName}': visible must be a boolean`);
    }

    if (typeof el['opacity'] !== 'number' || Number.isNaN(el['opacity']) || el['opacity'] < 0 || el['opacity'] > 1) {
      errors.push(`element '${elemName}': opacity must be between 0 and 1`);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function normalizeLayout(l: HudLayout): HudLayout {
  const elements: HudElement[] = [];

  for (const el of l.elements ?? []) {
    if (!VALID_KINDS.has(el.kind)) {
      continue;
    }

    const anchor: Anchor = VALID_ANCHORS.has(el.anchor) ? el.anchor : 'top-left';
    const scale = clamp(typeof el.scale === 'number' ? el.scale : 1, 0.5, 2);
    const opacity = clamp(typeof el.opacity === 'number' ? el.opacity : 1, 0, 1);
    const offsetX = clamp(typeof el.offsetX === 'number' ? el.offsetX : 0, -600, 600);
    const offsetY = clamp(typeof el.offsetY === 'number' ? el.offsetY : 0, -600, 600);

    elements.push({
      id: el.id,
      kind: el.kind,
      anchor,
      offsetX,
      offsetY,
      scale,
      visible: Boolean(el.visible),
      opacity
    });
  }

  return {
    id: l.id,
    name: l.name,
    elements
  };
}
