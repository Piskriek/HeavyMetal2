import type { WaySet } from './types';

export const SELECT_WAYS: WaySet = {
  /** Every thing on the island in a list (the Layers window). */
  'v3-hierarchy': (ctx, { first }) => { if (first) ctx.openLayers(); },
};
