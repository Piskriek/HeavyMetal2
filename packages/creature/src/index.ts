/**
 * `@hm/creature`: the procedural morphogenetic organism engine (plan 44).
 *
 * A creature is a genome, not a mesh. `buildCreatureKit()` grows it into the five canonical anatomy groups as an audited
 * `@hm/kitspec` kit; `evaluateCreatureGait()` poses it with the project's analytical two-bone IK and a three-tier
 * distance LOD; `creaturePartBones()` says which host bone each rigid part hangs from, so a rigged avatar (the Astro
 * suit) animates with zero vertex weights.
 *
 * Pure: no DOM, no clock, no randomness, no three.js. The kit is the only thing a scene needs.
 */
export * from './creature-spec';
export * from './creature-skeleton';
export * from './creature-assembly';
export * from './creature-gait';
export * from './creature-presets';
