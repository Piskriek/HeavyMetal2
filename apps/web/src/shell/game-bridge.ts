/**
 * The menu room's game bridge (Plan 57 §16.5): link one game window onto the room's bridge screen, and while it is linked the
 * drone's eyes send a frame of it to the Neural Bridge every few seconds, for the mimic work (docs/PLASMA_SESSION_NOTES.md). The
 * frames are taken from the captured window at the size it is shared, never scaled down, so a game's interface text stays sharp
 * (Argon, 29 Oct). Nothing here sends input to the game; the bridge is loopback only.
 */

/** How often the eyes send a frame of the linked window. */
export const EYES_EVERY_MS = 3000;
/** The room draws at most this often while a game is linked (and only on change otherwise). */
export const SCREEN_FPS = 15;
/** One window, at most 720p and 15 fps: the screen's texture uploads every frame on the GTX 950M (as play asks). */
export const CAPTURE: MediaStreamConstraints['video'] = { displaySurface: 'window', width: { max: 1280 }, height: { max: 720 }, frameRate: { max: SCREEN_FPS } } as MediaTrackConstraints;

export type BridgeState = 'checking' | 'offline' | 'ready' | 'linked' | 'unavailable';

/** The control's words for each state, in the player's terms. */
export function bridgeWords(state: BridgeState, o: { readonly frames?: number; readonly windowName?: string } = {}): { readonly line: string; readonly action: string | null } {
  switch (state) {
    case 'checking': return { line: 'Looking for the bridge on this PC…', action: null };
    case 'offline': return { line: 'The bridge is not running. Start it on this PC with:', action: 'Link a game window' };
    case 'ready': return { line: 'Bridge ready. Link a game window to show it on the screen.', action: 'Link a game window' };
    case 'linked': return { line: `Watching ${o.windowName ?? 'the linked window'}. The drone has seen ${o.frames ?? 0} frame${o.frames === 1 ? '' : 's'}.`, action: 'Unlink the game' };
    case 'unavailable': return { line: 'This browser cannot share a window.', action: null };
  }
}

/** The command that starts the bridge, shown when it is not running. */
export const BRIDGE_COMMAND = 'node scripts/companion-bridge.mjs';

/** Whether the bridge answers (its status, within a second and a half). */
export async function bridgeUp(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/status`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

/** A frame of the linked window at the size it is shared, as a JPEG. */
export function frameOf(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<Blob | null> {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return Promise.resolve(null);
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) return Promise.resolve(null);
  g.drawImage(video, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82));
}

/** Send one frame to the bridge, as the linked window's (`external`), the same source play's eyes use. */
export async function sendFrame(base: string, blob: Blob): Promise<boolean> {
  try {
    const res = await fetch(`${base}/frame?source=external`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    return res.ok;
  } catch {
    return false;
  }
}
