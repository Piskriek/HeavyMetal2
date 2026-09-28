/**
 * PLATFORM: true only under `vite dev`, where vite.config.ts serves the builder's disk-backup routes
 * (`/api/backup-*`, `/api/island-ground`). A built game (a static deploy, RUN.world) has no such
 * server: calling those routes there is only noise, and on RUN.world a request to anything but the
 * game's own files is blocked. Node tests (no Vite) count as no dev server.
 */
export function hasDevServer(): boolean {
  try {
    return (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
  } catch {
    return false;
  }
}
