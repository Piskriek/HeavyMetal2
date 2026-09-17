/**
 * Rider and capsule art (Part 4.2).
 *
 * The illustrations are generated, hand-painted PNGs described by `art-manifest.json`.
 * Nothing here builds SVG at runtime or rasterizes per frame:
 *  - `riderArt`, `capsuleArt` and `loadoutArt` return public PNG URLs for plain <img> use.
 *  - `prepareRaceCapsules` composites the pilot into the shell's measured hatch ellipse once
 *    per roster and caches the result, so racing costs no per-frame drawing.
 *  - `RacerLayers` (in `art-assets.ts`) drives the CSS-layered preview used by the menus.
 */
import { capsuleCell, loadArtImage, prepareArtSprites, racerLayers, riderCell, type ArtCell, type RacerLayers } from './art-assets';
import { capsuleById, riderById, type CapsuleId, type Loadout, type RiderId } from './loadouts';
import { artUrl } from './art-assets';

export type { RacerLayers };
export { racerLayers };

/** Painted rider portrait, alpha PNG, 512x512 in the manifest. */
export function riderArt(id: RiderId) {
  return artUrl(riderCell(id).image);
}

/** Painted capsule shell with an open hatch, alpha PNG, 512x512 in the manifest. */
export function capsuleArt(id: CapsuleId) {
  return artUrl(capsuleCell(id).image);
}

/**
 * Composite preview URL description for a loadout. Callers layer the two PNGs with CSS
 * (`RacerLayers`), which keeps the art crisp at any size and avoids runtime rasterizing.
 */
export function loadoutArt(loadout: Loadout) {
  return racerLayers(loadout);
}

export const loadoutArtAlt = (loadout: Loadout) =>
  `${riderById(loadout.rider).name} inside the ${capsuleById(loadout.capsule).name} capsule`;

/**
 * Decodes every shell, pilot portrait and pickup icon the roster needs before the race
 * starts, and reports any file that could not be loaded so the UI can say so. Images are
 * cached per URL, so this shares work with `prepareRaceCapsules` below.
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
 * Bakes one racing sprite per roster slot: the painted shell with a painted pilot seated
 * inside the measured hatch opening, plus the racer's colour as a thin rim ring.
 *
 * The composite is deliberately limited to 192x192 (the size the renderer draws at), is
 * keyed by the roster, and is never rebuilt during a frame.
 */
export function prepareRaceCapsules(roster: Loadout[]): Promise<HTMLCanvasElement[]> {
  const key = roster.map((item) => `${item.rider}/${item.capsule}`).join('|');
  const cached = raceSprites.get(key);
  if (cached) return cached;
  const colors = ['#f0a15b', '#87d7ba', '#b7a0e8', '#e4cc77'];
  const promise = Promise.all(roster.map(async (loadout, index) => {
    const layers = racerLayers(loadout);
    const [shell, pilot] = await Promise.all([loadArtImage(capsuleCell(loadout.capsule).image), loadArtImage(
      riderCell(loadout.rider).pilot ?? riderCell(loadout.rider).image,
    )]);
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const paint = canvas.getContext('2d');
    if (!paint) throw new Error('Canvas is unavailable.');
    paint.drawImage(shell, 0, 0, size, size);

    const hatchX = layers.hatch.x * size;
    const hatchY = layers.hatch.y * size;
    const hatchRx = (layers.hatch.rx ?? layers.hatch.radius) * size;
    const hatchRy = (layers.hatch.ry ?? layers.hatch.radius) * size;
    paint.save();
    paint.beginPath();
    // Clip slightly inside the rim so the painted hatch edge stays visible.
    paint.ellipse(hatchX, hatchY, hatchRx * 0.96, hatchRy * 0.96, 0, 0, Math.PI * 2);
    paint.clip();
    const pilotWidth = layers.pilotBox.width * size;
    const pilotHeight = layers.pilotBox.height * size;
    paint.drawImage(pilot, layers.pilotBox.left * size, layers.pilotBox.top * size, pilotWidth, pilotHeight);
    paint.restore();

    // Team colour stays readable without recolouring the painted metalwork.
    paint.strokeStyle = colors[index % colors.length];
    paint.lineWidth = Math.max(2, Math.max(hatchRx, hatchRy) * 0.14);
    paint.beginPath();
    // Opens at the top so the team colour reads as a rim light, not a collar.
    paint.ellipse(hatchX, hatchY, hatchRx * 1.04, hatchRy * 1.04, 0, 0.16 * Math.PI, 1.84 * Math.PI);
    paint.stroke();
    return canvas;
  }));
  raceSprites.set(key, promise);
  if (raceSprites.size > 6) raceSprites.delete(raceSprites.keys().next().value!);
  void promise.catch(() => raceSprites.delete(key));
  return promise;
}
