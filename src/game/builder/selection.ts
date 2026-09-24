/**
 * IF-SELECTION: Marquee selection, grouping, alignment, and distribution tools.
 */

import type { Transformable } from './gizmo-math';

export interface SelectableProp extends Transformable {
  id: string;
  width?: number;
  height?: number;
  depth?: number;
  scale: number;
}

export function expandGroups(
  props: readonly SelectableProp[],
  selectedIds: readonly string[],
): Set<string> {
  const selectedSet = new Set(selectedIds);
  const activeGroups = new Set<string>();

  for (const p of props) {
    if (selectedSet.has(p.id) && p.groupId) {
      activeGroups.add(p.groupId);
    }
  }

  const out = new Set<string>(selectedIds);
  if (activeGroups.size > 0) {
    for (const p of props) {
      if (p.groupId && activeGroups.has(p.groupId)) {
        out.add(p.id);
      }
    }
  }

  return out;
}

export function alignProps<T extends Transformable & { id: string }>(
  items: readonly T[],
  selectedIds: Set<string>,
  axis: 'x' | 'y' | 'z',
  mode: 'min' | 'center' | 'max',
): T[] {
  const selected = items.filter((item) => selectedIds.has(item.id));
  if (selected.length < 2) return items.map((i) => ({ ...i }));

  const values = selected.map((s) => s[axis] as number);
  let target = 0;
  if (mode === 'min') {
    target = Math.min(...values);
  } else if (mode === 'max') {
    target = Math.max(...values);
  } else {
    target = values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  return items.map((item) => {
    if (selectedIds.has(item.id)) {
      return { ...item, [axis]: target };
    }
    return { ...item };
  });
}

export function distributeProps<T extends Transformable & { id: string }>(
  items: readonly T[],
  selectedIds: Set<string>,
  axis: 'x' | 'y' | 'z',
): T[] {
  const selected = items.filter((item) => selectedIds.has(item.id));
  if (selected.length < 3) return items.map((i) => ({ ...i }));

  const sorted = [...selected].sort((a, b) => (a[axis] as number) - (b[axis] as number));
  const firstVal = sorted[0][axis] as number;
  const lastVal = sorted[sorted.length - 1][axis] as number;
  const step = (lastVal - firstVal) / (sorted.length - 1);

  const targets = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    targets.set(sorted[i].id, firstVal + step * i);
  }

  return items.map((item) => {
    const target = targets.get(item.id);
    if (target !== undefined) {
      return { ...item, [axis]: target };
    }
    return { ...item };
  });
}

/**
 * 2D Screen-space marquee selection:
 * Drag Left -> Right: Window mode (must be completely contained within rect)
 * Drag Right -> Left: Crossing mode (any intersection with rect selects)
 */
export function marqueeSelect2D(
  props: readonly { id: string; x: number; z: number; radius?: number }[],
  rectStart: { x: number; y: number },
  rectEnd: { x: number; y: number },
): string[] {
  const isCrossing = rectEnd.x < rectStart.x;
  const minX = Math.min(rectStart.x, rectEnd.x);
  const maxX = Math.max(rectStart.x, rectEnd.x);
  const minY = Math.min(rectStart.y, rectEnd.y);
  const maxY = Math.max(rectStart.y, rectEnd.y);

  return props.filter((p) => {
    const r = p.radius ?? 50;
    if (isCrossing) {
      return (p.x + r >= minX && p.x - r <= maxX && p.z + r >= minY && p.z - r <= maxY);
    }
    return (p.x - r >= minX && p.x + r <= maxX && p.z - r >= minY && p.z + r <= maxY);
  }).map((p) => p.id);
}
