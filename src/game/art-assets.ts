/**
 * Typed access to the generated PNG art library (Part 4.2).
 *
 * `src/game/art-manifest.json` is produced by `scripts/build-art.mjs`: it records each
 * cell's source sheet, its frame rectangle, the runtime PNG it was written to, the
 * normalized hull geometry for capsule shells and the measured hatch circle whose centre
 * the pilot insert is seated on.
 *
 * Rules this module keeps:
 *  - Art is loaded and decoded before a race starts, never inside a physics tick.
 *  - A missing or broken PNG degrades to a painted placeholder and is reported, so one bad
 *    file cannot blank the track or block the race.
 *  - Shared images are cached once per URL; nothing is disposed per round.
 */
import rawManifest from './art-manifest.json';
import type { CapsuleId, RiderId } from './loadouts';
import type { PowerupKind } from './powerups';
import type { CourseId } from './types';

export interface ArtHatch {
  x: number;
  y: number;
  /** Half-height of the measured opening; the fallback when no ellipse was measured. */
  radius: number;
  /** Half-width and half-height of the measured opening, as sprite fractions. */
  rx?: number;
  ry?: number;
  measured: boolean;
}

export interface ArtCell {
  sheet: string;
  sheetCell: number;
  image: string;
  runtime: { width: number; height: number };
  action: 'portrait' | 'shell' | 'icon' | 'prop' | 'preview';
  anchor?: 'center' | 'bottom';
  hatch?: ArtHatch;
  hull?: { diameter: number; canvas: number; scale: number };
  pilot?: string;
  pilotRuntime?: { width: number; height: number };
  eyeLine?: number;
  pivot?: { x: number; y: number };
  facing?: 'right';
  baseline?: number;
  source?: { width: number; height: number };
}

interface ArtManifest {
  generatedAt: string;
  matte: Record<string, { hex: string; detected: string; canonical?: string; despill?: string[] }>;
  sheets: Record<string, { file: string; width: number; height: number; columns: number; rows: number }>;
  cells: Record<string, ArtCell>;
}

export const ART = rawManifest as unknown as ArtManifest;
export const ART_CELLS = ART.cells;
export const ART_GENERATED_AT = ART.generatedAt;

/** Public URL for a manifest path. Uses the bundler base so a sub-path deploy still works. */
export const artUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

export const riderCell = (id: RiderId): ArtCell => ART_CELLS[`rider:${id}`];
export const capsuleCell = (id: CapsuleId): ArtCell => ART_CELLS[`capsule:${id}`];
export const supplyCell = (kind: PowerupKind): ArtCell => ART_CELLS[`supply:${kind}`];
export const courseCell = (id: CourseId): ArtCell => ART_CELLS[`course:${id}`];
export const blimpCell = (): ArtCell => ART_CELLS['prop:blimp'];
export const LANDMARK_IDS = ['pines', 'quarry', 'windmill', 'pasture'] as const;
export type LandmarkId = typeof LANDMARK_IDS[number];
export const landmarkCell = (id: LandmarkId): ArtCell => ART_CELLS[`landmark:${id}`];

/** Every cell that has to be decoded before a race: shells, pilots and supply icons. */
export function raceArtPaths(roster: { rider: RiderId; capsule: CapsuleId }[]): string[] {
  const paths = new Set<string>();
  for (const loadout of roster) {
    paths.add(capsuleCell(loadout.capsule).image);
    const rider = riderCell(loadout.rider);
    paths.add(rider.image);
    if (rider.pilot) paths.add(rider.pilot);
  }
  for (const kind of ['fuel', 'shield', 'bounce'] as PowerupKind[]) paths.add(supplyCell(kind).image);
  return [...paths];
}

export interface ArtSprite {
  image: CanvasImageSource;
  width: number;
  height: number;
  url: string;
  /** True when the real PNG failed and a placeholder is standing in. */
  placeholder: boolean;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadArtImage(path: string): Promise<HTMLImageElement> {
  const url = artUrl(path);
  let promise = imageCache.get(url);
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load ${url}`));
      image.src = url;
    });
    imageCache.set(url, promise);
    promise.catch(() => imageCache.delete(url));
  }
  return promise;
}

/** Painted stand-in used whenever a sprite cannot be decoded: clearly a placeholder, never blank. */
export function placeholderCanvas(width: number, height: number, size = 0): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = size || width;
  const h = size || height;
  canvas.width = w;
  canvas.height = h;
  const paint = canvas.getContext('2d');
  if (paint) {
    paint.fillStyle = '#2b3327';
    paint.beginPath();
    paint.arc(w / 2, h / 2, Math.min(w, h) * 0.42, 0, Math.PI * 2);
    paint.fill();
    paint.strokeStyle = '#c08a4a';
    paint.lineWidth = Math.max(2, w * 0.02);
    paint.stroke();
    paint.beginPath();
    paint.moveTo(w * 0.34, h * 0.34);
    paint.lineTo(w * 0.66, h * 0.66);
    paint.moveTo(w * 0.66, h * 0.34);
    paint.lineTo(w * 0.34, h * 0.66);
    paint.stroke();
  }
  return canvas;
}

/** Draws an already-decoded image into a fresh square canvas, ready for the renderer. */
export function drawToCanvas(image: CanvasImageSource, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const paint = canvas.getContext('2d');
  if (paint) paint.drawImage(image, 0, 0, size, size);
  return canvas;
}

function placeholderSprite(cell: ArtCell): ArtSprite {
  const canvas = placeholderCanvas(cell.runtime.width, cell.runtime.height);
  return { image: canvas, width: canvas.width, height: canvas.height, url: '', placeholder: true };
}

/**
 * Resolves art cells to sprites as a single group. A cell whose PNG cannot be decoded
 * becomes a placeholder and is listed in `failures` so the UI can report it honestly.
 */
export async function prepareArtSprites(cells: ArtCell[]): Promise<{ sprites: Map<string, ArtSprite>; failures: string[] }> {
  const sprites = new Map<string, ArtSprite>();
  const failures: string[] = [];
  await Promise.all(cells.map(async (cell) => {
    try {
      const image = await loadArtImage(cell.image);
      sprites.set(cell.image, { image, width: image.naturalWidth || cell.runtime.width, height: image.naturalHeight || cell.runtime.height, url: image.src, placeholder: false });
    } catch {
      failures.push(cell.image);
      sprites.set(cell.image, placeholderSprite(cell));
    }
  }));
  if (failures.length) console.warn('[Goblin Rally] art placeholders in use:', failures.join(', '));
  return { sprites, failures };
}

/** CSS-only layered description of a rider inside a capsule, for HTML previews. */
export interface RacerLayers {
  shell: string;
  pilot: string;
  hatch: ArtHatch;
  eyeLine: number;
  /** Pilot box as fractions of the capsule sprite box. */
  pilotBox: { left: number; top: number; width: number; height: number };
  clip: string;
}

export function racerLayers(loadout: { rider: RiderId; capsule: CapsuleId }): RacerLayers {
  const shell = capsuleCell(loadout.capsule);
  const rider = riderCell(loadout.rider);
  const hatch = shell.hatch ?? { x: 0.66, y: 0.5, radius: 0.13, measured: false };
  const eyeLine = rider.eyeLine ?? 0.44;
  // The painted port is an ellipse (a circle seen at an angle), so the pilot is seated in
  // that ellipse: 1.7x the opening's diameter in both axes, which keeps the foreshortening
  // of the artwork and leaves the head filling the opening rather than overflowing it.
  const rx = hatch.rx ?? hatch.radius;
  const ry = hatch.ry ?? hatch.radius;
  const width = rx * 3.4;
  const height = ry * 3.4;
  return {
    shell: artUrl(shell.image),
    pilot: artUrl(rider.pilot ?? rider.image),
    hatch,
    eyeLine,
    pilotBox: { left: hatch.x - width / 2, top: hatch.y - eyeLine * height, width, height },
    // Percentages, not angles: `ellipse()` takes percentage radii, which resolve against the
    // figure box width and height, and the figure box is the same square as the sprite.
    clip: `ellipse(${(rx * 0.99 * 100).toFixed(2)}% ${(ry * 0.99 * 100).toFixed(2)}% at ${(hatch.x * 100).toFixed(2)}% ${(hatch.y * 100).toFixed(2)}%)`,
  };
}
