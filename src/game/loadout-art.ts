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
/** T02: bake once per (loadout, rim colour) so a 100-slot roster shares ≤48 canvases. */
const raceBallCells = new Map<string, Promise<HTMLCanvasElement>>();

const RIM_COLORS = ['#f0a15b', '#87d7ba', '#b7a0e8', '#e4cc77'];

function bakeRaceBall(loadout: Loadout, rimColor: string): Promise<HTMLCanvasElement> {
  const cellKey = `${loadout.rider}/${loadout.capsule}/${rimColor}`;
  const cached = raceBallCells.get(cellKey);
  if (cached) return cached;
  const promise = (async () => {
    const ball = await loadArtImage(capsuleCell(loadout.capsule).image);
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const paint = canvas.getContext('2d');
    if (!paint) throw new Error('Canvas is unavailable.');

    // 1. Base metal hull fill: Prevents transparent corners from sampling as pitch black on the sphere.
    const baseMetal = loadout.capsule === 'springsteel' ? '#334446' : loadout.capsule === 'siege' ? '#383a42' : '#3d3730';
    paint.fillStyle = baseMetal;
    paint.fillRect(0, 0, size, size);

    // 2. Continuous circumferential team racing bands (rolls visibly across the track):
    const bandY = size * 0.42;
    const bandHeight = size * 0.16;
    paint.fillStyle = rimColor;
    paint.fillRect(0, bandY, size, bandHeight);
    paint.fillStyle = 'rgba(255, 255, 255, 0.45)';
    paint.fillRect(0, bandY - 2, size, 2);
    paint.fillRect(0, bandY + bandHeight, size, 2);

    // 3. Draw the painted ball artwork centered
    paint.drawImage(ball, 0, 0, size, size);

    // 4. Team colour ring hugging the painted ball
    paint.strokeStyle = rimColor;
    paint.lineWidth = Math.max(5, size * 0.04);
    paint.beginPath();
    paint.arc(size / 2, size / 2, size * 0.455, 0, 2 * Math.PI);
    paint.stroke();

    // 5. Stylized brass rivets for authentic steampunk detail
    const rivetCount = 12;
    paint.fillStyle = '#e8c060';
    for (let i = 0; i < rivetCount; i++) {
      const angle = (i / rivetCount) * Math.PI * 2;
      const rx = size / 2 + Math.cos(angle) * (size * 0.42);
      const ry = size / 2 + Math.sin(angle) * (size * 0.42);
      paint.beginPath();
      paint.arc(rx, ry, 2.5, 0, Math.PI * 2);
      paint.fill();
    }

    return canvas;
  })();
  raceBallCells.set(cellKey, promise);
  if (raceBallCells.size > 64) raceBallCells.delete(raceBallCells.keys().next().value!);
  void promise.catch(() => raceBallCells.delete(cellKey));
  return promise;
}

/**
 * Bakes racing sprites for a roster slot each: the standalone painted ball with the
 * slot's rim colour. Slots that share a (loadout, rim colour) pair receive the *same*
 * canvas instance, so the renderer shares one GPU texture per pair — at 100 racers the
 * pool stays bounded and disposal stays predictable.
 *
 * The sprite is limited to 192x192 (the size the renderer draws at), is keyed by the
 * roster, and is never rebuilt during a frame.
 */
export function prepareRaceBalls(roster: Loadout[]): Promise<HTMLCanvasElement[]> {
  const key = roster.map((item, index) => `${item.rider}/${item.capsule}/${RIM_COLORS[index % RIM_COLORS.length]}`).join('|');
  const cached = raceSprites.get(key);
  if (cached) return cached;
  const promise = Promise.all(roster.map((loadout, index) => bakeRaceBall(loadout, RIM_COLORS[index % RIM_COLORS.length])));
  raceSprites.set(key, promise);
  if (raceSprites.size > 6) raceSprites.delete(raceSprites.keys().next().value!);
  void promise.catch(() => raceSprites.delete(key));
  return promise;
}
