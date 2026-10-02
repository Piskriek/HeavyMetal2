import type { HudLayout } from './types';

export const HUD_PRESETS: HudLayout[] = [
  {
    id: 'classic',
    name: 'Classic',
    elements: [
      { id: 'speed', kind: 'speed', anchor: 'top-left', offsetX: 10, offsetY: 10, scale: 1, visible: true, opacity: 1 },
      { id: 'lap', kind: 'lap', anchor: 'top-left', offsetX: 140, offsetY: 10, scale: 1, visible: true, opacity: 1 },
      { id: 'position', kind: 'position', anchor: 'top-left', offsetX: 220, offsetY: 10, scale: 1, visible: true, opacity: 1 },
      { id: 'time', kind: 'time', anchor: 'top-left', offsetX: 320, offsetY: 10, scale: 1, visible: true, opacity: 1 },
      { id: 'item', kind: 'item', anchor: 'top-left', offsetX: 430, offsetY: 10, scale: 1, visible: true, opacity: 1 },
      { id: 'minimap', kind: 'minimap', anchor: 'top-right', offsetX: 10, offsetY: 10, scale: 1, visible: true, opacity: 1 },
      { id: 'message', kind: 'message', anchor: 'bottom-center', offsetX: 0, offsetY: 20, scale: 1, visible: true, opacity: 1 },
      { id: 'boost', kind: 'boost', anchor: 'bottom-left', offsetX: 10, offsetY: 20, scale: 1, visible: true, opacity: 1 }
    ]
  },
  {
    id: 'minimal',
    name: 'Minimal',
    elements: [
      { id: 'speed', kind: 'speed', anchor: 'bottom-left', offsetX: 20, offsetY: 20, scale: 1, visible: true, opacity: 1 },
      { id: 'position', kind: 'position', anchor: 'top-left', offsetX: 20, offsetY: 20, scale: 1, visible: true, opacity: 1 },
      { id: 'lap', kind: 'lap', anchor: 'top-left', offsetX: 0, offsetY: 0, scale: 1, visible: false, opacity: 1 },
      { id: 'time', kind: 'time', anchor: 'top-left', offsetX: 0, offsetY: 0, scale: 1, visible: false, opacity: 1 },
      { id: 'item', kind: 'item', anchor: 'top-left', offsetX: 0, offsetY: 0, scale: 1, visible: false, opacity: 1 },
      { id: 'minimap', kind: 'minimap', anchor: 'top-right', offsetX: 0, offsetY: 0, scale: 1, visible: false, opacity: 1 },
      { id: 'message', kind: 'message', anchor: 'bottom-center', offsetX: 0, offsetY: 0, scale: 1, visible: false, opacity: 1 },
      { id: 'boost', kind: 'boost', anchor: 'bottom-left', offsetX: 0, offsetY: 0, scale: 1, visible: false, opacity: 1 }
    ]
  },
  {
    id: 'kids',
    name: 'Kids',
    elements: [
      { id: 'position', kind: 'position', anchor: 'top-left', offsetX: 20, offsetY: 20, scale: 1.5, visible: true, opacity: 1 },
      { id: 'item', kind: 'item', anchor: 'top-right', offsetX: 20, offsetY: 20, scale: 1.5, visible: true, opacity: 1 },
      { id: 'message', kind: 'message', anchor: 'top-center', offsetX: 0, offsetY: 20, scale: 1.5, visible: true, opacity: 1 },
      { id: 'minimap', kind: 'minimap', anchor: 'bottom-right', offsetX: 20, offsetY: 20, scale: 1.5, visible: true, opacity: 1 },
      { id: 'speed', kind: 'speed', anchor: 'bottom-left', offsetX: 20, offsetY: 20, scale: 1.5, visible: true, opacity: 1 },
      { id: 'lap', kind: 'lap', anchor: 'top-left', offsetX: 0, offsetY: 0, scale: 1.5, visible: false, opacity: 1 },
      { id: 'time', kind: 'time', anchor: 'top-left', offsetX: 0, offsetY: 0, scale: 1.5, visible: false, opacity: 1 },
      { id: 'boost', kind: 'boost', anchor: 'bottom-left', offsetX: 0, offsetY: 0, scale: 1.5, visible: false, opacity: 1 }
    ]
  },
  {
    id: 'sim',
    name: 'Simulation',
    elements: [
      { id: 'speed', kind: 'speed', anchor: 'bottom-center', offsetX: 0, offsetY: 20, scale: 1.2, visible: true, opacity: 1 },
      { id: 'boost', kind: 'boost', anchor: 'bottom-center', offsetX: 0, offsetY: 90, scale: 1.2, visible: true, opacity: 1 },
      { id: 'time', kind: 'time', anchor: 'top-center', offsetX: 0, offsetY: 15, scale: 1, visible: true, opacity: 1 },
      { id: 'lap', kind: 'lap', anchor: 'top-left', offsetX: 20, offsetY: 15, scale: 1, visible: true, opacity: 1 },
      { id: 'position', kind: 'position', anchor: 'top-right', offsetX: 20, offsetY: 15, scale: 1, visible: true, opacity: 1 },
      { id: 'item', kind: 'item', anchor: 'bottom-right', offsetX: 20, offsetY: 20, scale: 1, visible: true, opacity: 1 },
      { id: 'minimap', kind: 'minimap', anchor: 'bottom-left', offsetX: 20, offsetY: 20, scale: 1, visible: true, opacity: 1 },
      { id: 'message', kind: 'message', anchor: 'top-center', offsetX: 0, offsetY: 70, scale: 1, visible: false, opacity: 1 }
    ]
  }
];

export function presetById(id: string): HudLayout | undefined {
  return HUD_PRESETS.find((p) => p.id === id);
}
