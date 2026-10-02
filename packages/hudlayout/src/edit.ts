import type { Anchor, HudElement, HudLayout } from './types';
import { validateLayout } from './validate';

export function moveElement(
  l: HudLayout,
  id: string,
  anchor: Anchor,
  offsetX: number,
  offsetY: number
): HudLayout {
  return {
    ...l,
    elements: l.elements.map((el) => (el.id === id ? { ...el, anchor, offsetX, offsetY } : { ...el }))
  };
}

export function setScale(l: HudLayout, id: string, scale: number): HudLayout {
  return {
    ...l,
    elements: l.elements.map((el) => (el.id === id ? { ...el, scale } : { ...el }))
  };
}

export function toggle(l: HudLayout, id: string): HudLayout {
  return {
    ...l,
    elements: l.elements.map((el) => (el.id === id ? { ...el, visible: !el.visible } : { ...el }))
  };
}

export function snapOffsets(l: HudLayout, step: number): HudLayout {
  const snap = (v: number) => (step > 0 ? Math.round(v / step) * step : v);
  return {
    ...l,
    elements: l.elements.map((el) => ({
      ...el,
      offsetX: snap(el.offsetX),
      offsetY: snap(el.offsetY)
    }))
  };
}

export function duplicateLayout(l: HudLayout, newId: string, newName: string): HudLayout {
  return {
    id: newId,
    name: newName,
    elements: l.elements.map((el) => ({ ...el }))
  };
}

function stableElement(el: HudElement): Record<string, unknown> {
  return {
    id: el.id,
    kind: el.kind,
    anchor: el.anchor,
    offsetX: el.offsetX,
    offsetY: el.offsetY,
    scale: el.scale,
    visible: el.visible,
    opacity: el.opacity
  };
}

export function layoutToJson(l: HudLayout): string {
  const stable = {
    id: l.id,
    name: l.name,
    elements: l.elements.map(stableElement)
  };
  return JSON.stringify(stable, null, 2);
}

export function layoutFromJson(text: string): { layout: HudLayout | null; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { layout: null, errors: [`JSON parse error: ${msg}`] };
  }

  const result = validateLayout(parsed);
  if (!result.ok) {
    return { layout: null, errors: result.errors };
  }

  return { layout: parsed as HudLayout, errors: [] };
}
