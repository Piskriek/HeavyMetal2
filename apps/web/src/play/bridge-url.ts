/**
 * The Neural Bridge's address: localhost:8220, or `?bridge=<port>` (the e2e runs its own bridge beside a live one). Only
 * while the game itself is on localhost, so a link to the hosted game can never send the player's words anywhere.
 * Shared by play's comms and the menu room's game bridge (Plan 57 §16.5).
 */
export function companionBridgeUrl(location: { readonly hostname: string; readonly search: string }): string | null {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return null;
  const port = new URLSearchParams(location.search).get('bridge');
  if (port !== null) return /^\d{2,5}$/.test(port) ? `http://localhost:${port}` : null;
  return 'http://localhost:8220';
}
