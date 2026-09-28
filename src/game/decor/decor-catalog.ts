/**
 * NewDecor — which of the builder's props are *decorations*, and how each one likes to be placed.
 *
 * The prop catalogue (`builder/prop-catalog.ts`) knows what a prop looks like. This file knows how it
 * behaves when scattered: how much ground it needs, whether it belongs on the verge or out in the
 * hills, how big it may vary, whether it should face the road, and which stages of the mountain it
 * suits. The brush and the auto-decorate rules never place a type that is not listed here, so a
 * ramp, a slingshot or a start line can never be sprayed by accident.
 *
 * Pure data: no three.js, no DOM. Palettes are named weighted sets of kinds; a rule picks from the
 * active palette, weighted again by the kind's affinity for the stage it is standing in.
 */
import type { TrackStageId } from '../track-space';

/** Where a kind wants to stand, measured from the road edge. */
export type DecorZone =
  /** On the shoulder: 0–1 footprint off the edge (lanterns, signs, barricades, crowds). */
  | 'verge'
  /** Just beyond: 1–4 footprints off the edge (boulders, undergrowth, single trees). */
  | 'offroad'
  /** The hills: 3–12 footprints off the edge, big silhouettes (forest walls, towers, cranes). */
  | 'far';

export interface DecorKind {
  /** The `PROP_DEFINITIONS` type this kind places. */
  readonly type: string;
  readonly name: string;
  readonly zone: DecorZone;
  /** Half of the ground it occupies, world units (a lane is 240). Drives minimum spacing. */
  readonly footprint: number;
  /** Random scale range. */
  readonly scale: readonly [number, number];
  /** Turn to face the road (signs, fans, lanterns) rather than keep a random yaw. */
  readonly faceTrack: boolean;
  /** May be mirrored for variety. */
  readonly flip: boolean;
  /** Stage affinity 0‥1; a stage that is absent gets 0 and is never picked there. */
  readonly stages: Partial<Record<TrackStageId, number>>;
  /** Place with the animated twin sheet showing (crowds, torches). */
  readonly animated?: boolean;
}

const ALL_OUTDOOR: Partial<Record<TrackStageId, number>> = { alpine: 1, canyon: 1, zigzag: 1, stadium: 0.6 };
const UNDERGROUND: Partial<Record<TrackStageId, number>> = { cavern: 1, mine: 1, breakthrough: 1 };
const EVERYWHERE: Partial<Record<TrackStageId, number>> = { ...ALL_OUTDOOR, ...UNDERGROUND, stadium: 1 };

export const DECOR_KINDS: readonly DecorKind[] = Object.freeze([
  // --- foliage & rock ---
  { type: 'pines_cluster', name: 'Pine forest wall', zone: 'far', footprint: 700, scale: [1, 1.5], faceTrack: false, flip: true, stages: { alpine: 1, zigzag: 0.4 } },
  { type: 'pine_landmark', name: 'Pine outcrop', zone: 'offroad', footprint: 400, scale: [0.8, 1.3], faceTrack: false, flip: true, stages: { alpine: 1, canyon: 0.3, zigzag: 0.5 } },
  { type: 'prop_09_pine_lookout', name: 'Pine lookout outcrop', zone: 'far', footprint: 450, scale: [0.9, 1.2], faceTrack: false, flip: true, stages: { alpine: 0.6, zigzag: 0.4 } },
  { type: 'boulder_a', name: 'Granite boulder A', zone: 'offroad', footprint: 210, scale: [0.6, 1.4], faceTrack: false, flip: true, stages: { alpine: 0.7, canyon: 1, zigzag: 1, cavern: 0.5, breakthrough: 0.6 } },
  { type: 'boulder_b', name: 'Granite boulder B', zone: 'offroad', footprint: 180, scale: [0.6, 1.4], faceTrack: false, flip: true, stages: { alpine: 0.7, canyon: 1, zigzag: 1, cavern: 0.5, breakthrough: 0.6 } },
  { type: 'prop_27_rock_spire_lookout', name: 'Rock spire', zone: 'far', footprint: 320, scale: [0.9, 1.4], faceTrack: false, flip: true, stages: { canyon: 1, zigzag: 0.8 } },
  { type: 'pasture', name: 'Green pasture', zone: 'offroad', footprint: 400, scale: [0.9, 1.2], faceTrack: false, flip: true, stages: { alpine: 0.8 } },
  { type: 'prop_31_grass_seam_fringe', name: 'Grass seam fringe', zone: 'verge', footprint: 600, scale: [0.9, 1.1], faceTrack: false, flip: true, stages: { alpine: 1, zigzag: 0.5 } },
  { type: 'prop_32_mossy_embankment', name: 'Mossy embankment', zone: 'verge', footprint: 600, scale: [0.9, 1.1], faceTrack: false, flip: true, stages: { alpine: 0.8, zigzag: 0.8, cavern: 0.5 } },
  { type: 'prop_33_rubble_seam_strip', name: 'Rubble seam strip', zone: 'verge', footprint: 600, scale: [0.9, 1.1], faceTrack: false, flip: true, stages: { canyon: 1, zigzag: 1, mine: 0.6, breakthrough: 0.8 } },
  { type: 'prop_36_glowcap_thicket', name: 'Glowcap thicket', zone: 'offroad', footprint: 450, scale: [0.7, 1.2], faceTrack: false, flip: true, stages: { cavern: 1, mine: 0.8, breakthrough: 0.6 } },
  { type: 'prop_37_fern_undergrowth', name: 'Fern undergrowth', zone: 'offroad', footprint: 450, scale: [0.7, 1.2], faceTrack: false, flip: true, stages: { alpine: 0.9, zigzag: 0.6, cavern: 0.4 } },

  // --- trackside furniture ---
  { type: 'prop_01_lantern_post', name: 'Triple lantern post', zone: 'verge', footprint: 180, scale: [1, 1.15], faceTrack: true, flip: false, stages: EVERYWHERE, animated: true },
  { type: 'prop_56_arch_torch_sconce', name: 'Torch sconce', zone: 'verge', footprint: 160, scale: [0.9, 1.1], faceTrack: true, flip: false, stages: { ...UNDERGROUND, stadium: 0.5 }, animated: true },
  { type: 'prop_23_sign_sheep', name: 'Sign: beware sheep', zone: 'verge', footprint: 160, scale: [1, 1], faceTrack: true, flip: false, stages: ALL_OUTDOOR },
  { type: 'prop_24_sign_tnt', name: 'Sign: high explosive', zone: 'verge', footprint: 190, scale: [1, 1], faceTrack: true, flip: false, stages: { ...UNDERGROUND, zigzag: 0.5 } },
  { type: 'prop_29_spiked_barricade', name: 'Spiked barricade', zone: 'verge', footprint: 350, scale: [0.9, 1.1], faceTrack: true, flip: true, stages: EVERYWHERE },
  { type: 'prop_38_scrap_barricade', name: 'Scrap iron barricade', zone: 'verge', footprint: 500, scale: [0.9, 1.1], faceTrack: true, flip: true, stages: { ...UNDERGROUND, zigzag: 0.7, stadium: 0.8 } },
  { type: 'prop_34_timber_crib_wall', name: 'Timber crib wall', zone: 'verge', footprint: 550, scale: [0.9, 1.1], faceTrack: true, flip: true, stages: { alpine: 0.6, zigzag: 1, canyon: 0.8 } },
  { type: 'prop_50_flag_pole_row', name: 'Pennant flag row', zone: 'verge', footprint: 350, scale: [0.9, 1.1], faceTrack: true, flip: true, stages: { stadium: 1, alpine: 0.3 } },
  { type: 'cliff_scaffold', name: 'Cliff scaffolding', zone: 'far', footprint: 330, scale: [0.9, 1.3], faceTrack: false, flip: true, stages: { canyon: 1, zigzag: 1 } },
  { type: 'prop_12_goblin_scaffold', name: 'Goblin scaffold tower', zone: 'far', footprint: 300, scale: [0.9, 1.3], faceTrack: false, flip: true, stages: { canyon: 0.8, zigzag: 0.6, mine: 0.8 } },
  { type: 'prop_21_quarry_crane', name: 'Quarry crane', zone: 'far', footprint: 550, scale: [0.9, 1.2], faceTrack: false, flip: true, stages: { canyon: 1, mine: 0.6 } },
  { type: 'prop_08_windmill_gears', name: 'Goblin windmill', zone: 'far', footprint: 360, scale: [0.9, 1.2], faceTrack: false, flip: true, stages: { alpine: 1 } },
  { type: 'prop_22_armored_sheep_pen', name: 'Armored sheep pen', zone: 'far', footprint: 600, scale: [0.9, 1.1], faceTrack: false, flip: true, stages: { alpine: 0.8 } },
  { type: 'prop_49_blast_crater', name: 'Blast crater', zone: 'offroad', footprint: 500, scale: [0.8, 1.2], faceTrack: false, flip: true, stages: { zigzag: 0.5, mine: 0.8, breakthrough: 0.6 } },
  { type: 'waterfall_splash', name: 'Waterfall spray', zone: 'offroad', footprint: 330, scale: [0.9, 1.2], faceTrack: false, flip: true, stages: { zigzag: 1, breakthrough: 1 }, animated: true },

  // --- goblins ---
  { type: 'goblin_01_flag_waver', name: 'Flag-waving fan', zone: 'verge', footprint: 190, scale: [0.9, 1.1], faceTrack: true, flip: true, stages: { stadium: 1, alpine: 0.4, zigzag: 0.3 }, animated: true },
  { type: 'goblin_02_war_drummer', name: 'War drummer', zone: 'verge', footprint: 160, scale: [0.9, 1.1], faceTrack: true, flip: true, stages: { stadium: 1, alpine: 0.3 }, animated: true },
]);

const KIND_INDEX = new Map(DECOR_KINDS.map((kind) => [kind.type, kind]));
export const decorKind = (type: string): DecorKind | undefined => KIND_INDEX.get(type);
export const isDecorKind = (type: string): boolean => KIND_INDEX.has(type);

export interface DecorPalette {
  readonly id: string;
  readonly name: string;
  readonly kinds: readonly { readonly type: string; readonly weight: number }[];
}

export const DECOR_PALETTES: readonly DecorPalette[] = Object.freeze([
  { id: 'alpine_forest', name: 'Alpine forest', kinds: [{ type: 'pines_cluster', weight: 3 }, { type: 'pine_landmark', weight: 4 }, { type: 'prop_09_pine_lookout', weight: 1 }, { type: 'boulder_a', weight: 1.5 }, { type: 'boulder_b', weight: 1.5 }, { type: 'prop_37_fern_undergrowth', weight: 2 }, { type: 'pasture', weight: 0.7 }] },
  { id: 'canyon_rock', name: 'Canyon rock', kinds: [{ type: 'boulder_a', weight: 3 }, { type: 'boulder_b', weight: 3 }, { type: 'prop_27_rock_spire_lookout', weight: 1.5 }, { type: 'cliff_scaffold', weight: 1 }, { type: 'prop_12_goblin_scaffold', weight: 0.6 }, { type: 'prop_33_rubble_seam_strip', weight: 1 }] },
  { id: 'mine_works', name: 'Mine works', kinds: [{ type: 'prop_36_glowcap_thicket', weight: 2 }, { type: 'prop_56_arch_torch_sconce', weight: 2 }, { type: 'prop_38_scrap_barricade', weight: 1 }, { type: 'prop_24_sign_tnt', weight: 0.6 }, { type: 'boulder_b', weight: 1 }, { type: 'prop_49_blast_crater', weight: 0.5 }] },
  { id: 'verge_edges', name: 'Verge edges', kinds: [{ type: 'prop_31_grass_seam_fringe', weight: 2 }, { type: 'prop_32_mossy_embankment', weight: 2 }, { type: 'prop_33_rubble_seam_strip', weight: 2 }] },
  { id: 'trackside_safety', name: 'Trackside safety', kinds: [{ type: 'prop_29_spiked_barricade', weight: 2 }, { type: 'prop_38_scrap_barricade', weight: 1 }, { type: 'prop_34_timber_crib_wall', weight: 1.5 }, { type: 'prop_23_sign_sheep', weight: 0.5 }, { type: 'prop_24_sign_tnt', weight: 0.5 }] },
  { id: 'lanterns', name: 'Lanterns & torches', kinds: [{ type: 'prop_01_lantern_post', weight: 2 }, { type: 'prop_56_arch_torch_sconce', weight: 2 }] },
  { id: 'crowd', name: 'Goblin crowd', kinds: [{ type: 'goblin_01_flag_waver', weight: 3 }, { type: 'goblin_02_war_drummer', weight: 1 }, { type: 'prop_50_flag_pole_row', weight: 1 }] },
  { id: 'landmarks', name: 'Landmarks', kinds: [{ type: 'prop_08_windmill_gears', weight: 1 }, { type: 'prop_22_armored_sheep_pen', weight: 1 }, { type: 'prop_21_quarry_crane', weight: 1 }, { type: 'prop_27_rock_spire_lookout', weight: 1 }, { type: 'prop_09_pine_lookout', weight: 1 }, { type: 'prop_12_goblin_scaffold', weight: 1 }] },
  { id: 'signs', name: 'Warning signs', kinds: [{ type: 'prop_23_sign_sheep', weight: 1 }, { type: 'prop_24_sign_tnt', weight: 1 }] },
]);

export const decorPalette = (id: string): DecorPalette => DECOR_PALETTES.find((p) => p.id === id) ?? DECOR_PALETTES[0];

/** Offsets from the road edge for each zone, in footprints: [min, max]. */
export const ZONE_OFFSETS: Readonly<Record<DecorZone, readonly [number, number]>> = Object.freeze({
  verge: [0.15, 0.9],
  offroad: [1, 4],
  far: [3, 12],
});
