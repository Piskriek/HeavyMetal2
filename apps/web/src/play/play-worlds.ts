// The worlds play opens on, shared with the grid room (Plan 57 §10), so the menu warms the same looks play bakes: the same
// cartridge, stage, device and grid spacing hit the same cache.
import type { Plot } from '../crafter/planet';

/** Your plot's cartridge until the ground shader battle lands: sandy desert tones, the nearest in the vault to the concept art's stage 1. */
export const PLAY_PLOT = 'crater_calcite';

/** Other players' plots, 1 km across like yours (owner, 2026-10-07): seen from your plot as greener, wetter patches 1.1 to 3 km away.
 *  Samples until the shared planet is wired (SETMIX_PLAN Phase 5). */
export const PLAY_NEIGHBOURS: readonly Plot[] = ([
  ['Mossfold', 35, 1150, 170, 'emerald_canopy', 6], ['Kettle Rise', 112, 1480, 150, 'spore_meadow', 5], ['Fernreach', 168, 1900, 190, 'solar_fern_glade', 6],
  ['Low Atoll', 214, 2350, 210, 'coral_atoll', 6], ['Prism Flats', 262, 1320, 120, 'prismata_grass', 4], ['Greywater', 305, 2700, 230, 'emerald_canopy', 5],
  ['Stillgrove', 340, 3000, 240, 'spore_meadow', 6],
] as const).map(([name, deg, dist, r, cartridge, stage]) => ({ name, r, cartridge, stage, x: Math.cos((deg * Math.PI) / 180) * dist, z: Math.sin((deg * Math.PI) / 180) * dist }));
