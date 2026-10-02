export type { Vec2, Vec3, TerrainLike, ScatterRule, AvoidPath, ScatterOptions, Placement } from './types';
export { heightAt, slopeDeg, dominantSurface, distanceToLoop } from './sample';
export { poissonDisc } from './poisson';
export { scatter } from './scatter';
export { recipeParts, RECIPE_IDS, type PartRecipe } from './recipes';
export { TROPICAL_RULES } from './presets';
export { mulberry32 } from './rng';
