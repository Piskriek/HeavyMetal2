import type { PaletteCategory } from '@hm/buildkit';
import { STARTER_SURFACES } from '@hm/render';
import { MODELS } from '@hm/voxelart';

/**
 * What the held-Tab palette offers: the ground surfaces to paint with, and the things to place. Surfaces show their own flat-skin colour;
 * things show a thumbnail rendered from the model itself.
 */
const ROAD_FROM = 17; // surface ids from here are racing surfaces (tarmac, kerbs, boost pads ...)

export const SURFACE_ITEMS = STARTER_SURFACES.filter((s) => s.id < ROAD_FROM);
export const ROAD_ITEMS = STARTER_SURFACES.filter((s) => s.id >= ROAD_FROM);

export const PALETTE_CATEGORIES: readonly PaletteCategory[] = [
  { id: 'surfaces', label: 'Ground', items: SURFACE_ITEMS.map((s) => ({ id: String(s.id), label: s.name })) },
  { id: 'models', label: 'Things', items: MODELS.map((m) => ({ id: m.id, label: m.name })) },
  { id: 'roads', label: 'Roads', items: ROAD_ITEMS.map((s) => ({ id: String(s.id), label: s.name })) },
];

/** The colour a surface swatch shows (the first tone of its flat palette). */
export const swatchOf = (id: string): string => {
  const s = STARTER_SURFACES.find((x) => String(x.id) === id);
  return s?.flat?.[0] ?? s?.fallback ?? '#888888';
};
