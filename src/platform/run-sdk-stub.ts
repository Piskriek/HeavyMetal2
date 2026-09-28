/**
 * PLATFORM: stands in for `@series-inc/rundot-game-sdk/api` in every build that is not a RUN.world build
 * (vite.config.ts aliases it). The single-file build inlines dynamic imports even when they never run, so
 * without this a plain build would carry the SDK. bootPlatform() never reaches it outside a RUN build.
 */
const stub = {};
export default stub;
