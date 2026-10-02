/**
 * Stands in for `@series-inc/rundot-game-sdk/api` in every build that is not a RUN.world build (vite.config.ts aliases it),
 * because the single-file build inlines dynamic imports even when they never run. bootPlatform() never reaches it.
 */
const stub = {};
export default stub;
