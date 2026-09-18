/**
 * Rider and ball art (TICKET-04).
 *
 * The illustrations are generated, hand-painted PNGs described by `art-manifest.json`.
 * Nothing here builds SVG at runtime or rasterizes per frame:
 *  - `riderArt`, `capsuleArt` and `riderFullBody` return public PNG URLs for plain <img> use.
 *  - `prepareRaceBalls` bakes one racing sprite per roster slot (the standalone ball plus a
 *    team-colour rim) once per roster and caches the result, so racing costs no per-frame
 *    drawing. The rider appears in the HUD badge and the off-screen pointer, not on the ball.
 *
 * The TICKET-04 redesign retired the cockpit composite: no hatch measurement, no clipped
 * pilot bust, no `RacerLayers` CSS layering. Balls are disentangled from rider art entirely.
 */
import { capsuleCell, loadArtImage, prepareArtSprites, riderCell, riderFullBody, type ArtCell } from './art-assets';
import { capsuleById, riderById, type CapsuleId, type Loadout, type RiderId } from './loadouts';
import { artUrl } from './art-assets';

export { riderFullBody };

/** Painted rider portrait, alpha PNG, 512x512 in the manifest. */
export function riderArt(id: RiderId) {
  return artUrl(riderCell(id).image);
}

/** Standalone high-detail ball render, alpha PNG, 512x512 in the manifest. */
export function capsuleArt(id: CapsuleId) {
  return artUrl(capsuleCell(id).image);
}

export const loadoutArtAlt = (loadout: Loadout) =>
  `${riderById(loadout.rider).name} beside the ${capsuleById(loadout.capsule).name} ball`;

/**
 * Decodes every ball, portrait and pickup icon the roster needs before the race
 * starts, and reports any file that could not be loaded so the UI can say so. Images are
 * cached per URL, so this shares work with `prepareRaceBalls` below.
 */
export function prepareRosterArt(roster: Loadout[]) {
  const cells: ArtCell[] = [];
  for (const loadout of roster) {
    cells.push(capsuleCell(loadout.capsule), riderCell(loadout.rider));
  }
  return prepareArtSprites(cells);
}

const raceSprites = new Map<string, Promise<HTMLCanvasElement[]>>();

/**
 * Bakes one racing sprite per roster slot: the standalone painted ball with the racer's
 * colour as a thin rim ring, open at the top so it reads as a rim light.
 *
 * The sprite is deliberately limited to 192x192 (the size the renderer draws at), is
 * keyed by the roster, and is never rebuilt during a frame.
 */
export function prepareRaceBalls(roster: Loadout[]): Promise<HTMLCanvasElement[]> {
  const key = roster.map((item) => `${item.rider}/${item.capsule}`).join('|');
  const cached = raceSprites.get(key);
  if (cached) return cached;
  const colors = ['#f0a15b', '#87d7ba', '#b7a0e8', '#e4cc77'];
  const promise = Promise.all(roster.map(async (loadout, index) => {
    const ball = await loadArtImage(capsuleCell(loadout.capsule).image);
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const paint = canvas.getContext('2d');
    if (!paint) throw new Error('Canvas is unavailable.');
    paint.drawImage(ball, 0, 0, size, size);
    // Team colour stays readable without recolouring the painted metalwork. The hull is
    // normalised to 452 of the 512 canvas, so a 0.455 radius ring hugs the painted ball.
    paint.strokeStyle = colors[index % colors.length];
    paint.lineWidth = Math.max(3, size * 0.026);
    paint.beginPath();
    paint.arc(size / 2, size / 2, size * 0.455, 0.16 * Math.PI, 1.84 * Math.PI);
    paint.stroke();
    return canvas;
  }));
  raceSprites.set(key, promise);
  if (raceSprites.size > 6) raceSprites.delete(raceSprites.keys().next().value!);
  void promise.catch(() => raceSprites.delete(key));
  return promise;
}
