/**
 * TICKET-06: Comprehensive asset preloader pipeline.
 *
 * Before the starting grid countdown begins, every track texture, skybox, obstacle
 * sprite, and racer graphic must be decoded and resident in GPU memory. This module
 * orchestrates that warm-up and reports fine-grained progress (0-100%) so the
 * RaceLoadingScreen bar moves smoothly instead of faking it.
 */
import {
  capsuleCell, riderCell, supplyCell, preloadImages,
  type PreloadProgress,
} from './art-assets';
import { skyboxPathsForCourse, prepareWorldArt } from './world-art';
import type { CourseId } from './types';
import type { CapsuleId, RiderId } from './loadouts';
import type { PowerupKind } from './powerups';

export interface RosterSlot {
  rider: RiderId;
  capsule: CapsuleId;
}

export interface PreloadResult {
  /** Number of assets successfully decoded. */
  loaded: number;
  /** Total assets that were attempted. */
  total: number;
  /** Paths that failed to load (non-fatal; renderer falls back). */
  failures: string[];
}

/**
 * Gather every image URL that must be ready before the race renders a single frame:
 *  - Racer portraits, pilot cutouts, capsules (for each roster slot)
 *  - Powerup/supply icons
 *  - Track skybox panoramas for the selected course
 *  - Painted world-art sprites (blimp, landmarks) which prepareWorldArt loads
 *  - Core game sprites (mountains, crowd, grandstand, track tiles, ball, obstacles)
 */
export function collectRaceAssetPaths(courseId: CourseId, roster: RosterSlot[]): string[] {
  const paths = new Set<string>();

  // Roster art: riders (portraits + pilots) and capsules
  for (const slot of roster) {
    const rider = riderCell(slot.rider);
    paths.add(rider.image);
    if (rider.pilot) paths.add(rider.pilot);
    if (rider.fullbody) paths.add(rider.fullbody);
    paths.add(capsuleCell(slot.capsule).image);
  }

  // Supply / powerup icons
  for (const kind of ['fuel', 'shield', 'bounce'] as PowerupKind[]) {
    paths.add(supplyCell(kind).image);
  }

  // Skybox panorama for the selected course
  for (const skybox of skyboxPathsForCourse(courseId)) paths.add(skybox);

  // Core sprite art used by every race — note: these are loaded via loadAssets()
  // using absolute /art/ paths rather than the manifest-relative URLs, so we
  // include both naming conventions to be safe (imageCache in art-assets.ts de-dupes).
  const coreSprites = [
    'mountain-arena.png',
    'foreground-crowd.png',
    'grandstand.png',
    'track-tile.png',
    'deck-surface.png',
    'dirt-tile.png',
    'blimp.png',
    'track-sprites.png',
    'timber-loop.png',
    'slingshot.png',
    'slingshot-downrange.png',
    'sign-sheep.png?v=3',
    'sign-tnt.png?v=3',
    'sign-parts.png?v=3',
    'track-parts/bumper-crown.webp',
    'track-parts/bumper-spiked.webp',
    'track-parts/crate.webp',
    'track-parts/skull-box.webp',
    'track-parts/spring.webp',
    'track-parts/strip-wood.webp',
    'track-parts/strip-moss.webp',
    'track-parts/strip-hazard.webp',
    'track-parts/strip-metal.webp',
    'aim-arrow.png',
    'landmark-pines.png',
    'landmark-quarry.png',
    'landmark-windmill.png',
    'landmark-pasture.png',
  ];
  for (const name of coreSprites) paths.add(`/art/${name}`);

  return [...paths];
}

/**
 * TICKET-06: Preload all race assets before the starting grid renders.
 *
 * Kicks off the world-art preparation (painted props, skyboxes) and image
 * decoding in parallel, feeding incremental progress to the callback. Returns
 * a result summary once everything is either ready or has failed gracefully.
 */
export async function preloadRaceAssets(
  courseId: CourseId,
  roster: RosterSlot[],
  onProgress?: (percent: number, stage: string) => void,
): Promise<PreloadResult> {
  const allPaths = collectRaceAssetPaths(courseId, roster);
  const total = allPaths.length + 2; // +2 for world-art phases
  let done = 0;
  const allFailures: string[] = [];

  const report = (stage: string) => {
    onProgress?.(Math.min(100, Math.round((done / total) * 100)), stage);
  };

  // Phase 1: decode painted world-art sprites (blimp + landmarks + skyboxes).
  onProgress?.(2, 'Painting the world...');
  const worldArt = prepareWorldArt();

  // Phase 2: decode all individual images in parallel with progress.
  const imageProgress: PreloadProgress = (loaded, _imgTotal, path) => {
    done = 1 + loaded;
    const name = path ? path.split('/').pop()?.split('?')[0] ?? 'assets' : 'assets';
    report(`Loading ${name}...`);
  };

  const [_, imageResult] = await Promise.all([
    worldArt.then((ok) => {
      done += 1;
      if (!ok) allFailures.push('world-art-procedural-fallback');
      report('Assembling the course...');
    }),
    preloadImages(allPaths, imageProgress).then((result) => {
      allFailures.push(...result.failures);
      return result;
    }),
  ]);

  // Final tick to 100%
  done = total;
  onProgress?.(100, 'Ready to race!');

  return {
    loaded: imageResult.loaded.length,
    total: allPaths.length,
    failures: allFailures,
  };
}
