/**
 * PLATFORM: false in a production build (a static deploy, RUN.world), where there is no dev server
 * behind the builder's disk-backup routes (`/api/backup-*`, `/api/island-ground`): calling them there is
 * only noise, and on RUN.world a request to anything but the game's own files is blocked. `vite dev`
 * serves those routes (vite.config.ts); node tests stub `fetch` and count as having them.
 */
export function hasDevServer(): boolean {
  try {
    return (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD !== true;
  } catch {
    return true;
  }
}
