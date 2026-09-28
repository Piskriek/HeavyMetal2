/**
 * Hoop-Pod module — public surface. See docs/HOOP_POD.md.
 *
 *   HoopPodFleet   instanced renderer for the whole field (renderer-3d.ts owns the only race instance)
 *   pod-geometry   the three shape families, four LODs, screen-space LOD selection, garage bake mapping
 *   pod-design     which Ball Garage design the player races, baking, derived livery
 *   pod-livery     pure loadout liveries, validation and optional persistence
 */
export { HoopPodFleet, POD_DESIGN_EVENT, type HoopPodFleetOptions, type PodBakeInput, type PodRacerInput, type PodVec3 } from './pod-fleet';
export {
  CAPSULE_FINISH, POD_EMBLEMS, POD_LIVERY_EVENT, POD_LIVERY_STORAGE_KEY, POD_LIVERY_VERSION, POD_PATTERNS, POD_PRESETS,
  RIDER_EMBLEM, describeLivery, liveryForLoadout, liveryForRacer, loadPlayerLivery, sameLivery, savePlayerLivery,
  validateLivery, type LiveryResult, type PodLivery, type PodPreset, type PodRacerIdentity, type SaveResult,
} from './pod-livery';
export {
  HOOP_X, HOOP_W, PAINT_LAT_MAX, POD_LODS, POD_LOD_HYSTERESIS, POD_LOD_PIXELS, bakeUvForPoint, bakeV, podGeometry,
  projectedRadiusPx, selectPodLodBand, type PodLod, type PodLodBand,
} from './pod-geometry';
export { CAP_FINISH_HEX, EQUIPPED_BALL_KEY, bakeDesign, equipDesign, liveryForDesign, resolvePlayerDesign } from './pod-design';
export { PORTHOLE_RADIUS_M } from './pod-atlas';
