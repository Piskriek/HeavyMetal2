import { createAssemblyPreviews } from './previews';
import { buildModelAtlas } from './model-atlas';
import type { PowerupKind } from './powerups';

export type SpriteName =
  | 'mountains'
  | 'crowd'
  | 'grandstand'
  | 'sling'
  | 'loop'
  | 'ground'
  | 'deck'
  | 'dirtArt'
  | 'ball'
  | 'sheep'
  | 'tnt'
  | 'spring'
  | 'boost'
  | 'ramp'
  | 'blimp'
  | 'signSheep'
  | 'signTnt'
  | 'signParts'
  | 'treeWallPines'
  | 'treeWallBoomtown'
  | 'treeWallSheep';

export interface Sprite {
  image: HTMLImageElement;
  width: number;
  height: number;
  url: string;
  shadow?: HTMLCanvasElement;
}

/**
 * TICKET-08: the predecessor game's painted track parts, copied from
 * `PreGame/src/assets/` into `public/art/track-parts/`. They are loaded as plain
 * images (their alpha is already clean) and cached by `stage-two-art.ts`.
 */
export interface TrackPartAssets {
  bumperCrown: HTMLImageElement;
  bumperSpiked: HTMLImageElement;
  spring: HTMLImageElement;
  crate: HTMLImageElement;
  skull: HTMLImageElement;
  ringSpiked: HTMLImageElement;
  ringSteel: HTMLImageElement;
  ringCrown: HTMLImageElement;
  stripWood: HTMLImageElement;
  stripMoss: HTMLImageElement;
  stripMetal: HTMLImageElement;
  stripHazard: HTMLImageElement;
}

export type GameAssets = Record<SpriteName, Sprite> & {
  /** TICKET-08 Section 2 props and surface strips. */
  trackParts: TrackPartAssets;
  trackPartFailures?: string[];
  /** TICKET-04: one baked standalone-ball sprite (ball + team rim) per roster slot. */
  raceBalls?: HTMLCanvasElement[];
  pickupSprites?: Record<PowerupKind, HTMLCanvasElement>;
  /** The player's head-crop portrait, drawn in the off-screen pointer badge. */
  playerBadge?: CanvasImageSource;
};

const readImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });

const asSprite = (image: HTMLImageElement): Sprite => ({
  image,
  width: image.naturalWidth,
  height: image.naturalHeight,
  url: image.src,
});

async function cutout(
  source: HTMLImageElement,
  crop = { x: 0, y: 0, width: source.naturalWidth, height: source.naturalHeight },
): Promise<Sprite> {
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Your browser does not support canvas.');
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = 0;
  let bottom = 0;

  const matte = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < matte.length; i++) {
    const offset = i * 4;
    const r = pixels.data[offset];
    const g = pixels.data[offset + 1];
    const b = pixels.data[offset + 2];
    if (g > 150 && g > Math.max(r, b) * 1.65 && r < 130 && b < 140) matte[i] = 1;
  }

  // Feather only matte-adjacent pixels, preserving interior goblin skin and cyan springs.
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = y * canvas.width + x;
      const i = index * 4;
      if (pixels.data[i + 3] === 0) continue;
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      const other = Math.max(r, b);
      if (matte[index]) {
        pixels.data[i + 3] = 0;
      } else {
        let nearMatte = false;
        if (g > other * 1.15 && g > 85) {
          for (let dy = -2; dy <= 2 && !nearMatte; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height && matte[ny * canvas.width + nx]) {
                nearMatte = true;
                break;
              }
            }
          }
        }
        if (nearMatte) {
          const spill = Math.max(0, g - other * 1.1);
          pixels.data[i + 3] = Math.round(pixels.data[i + 3] * Math.max(0.08, 1 - spill / 155));
          pixels.data[i + 1] = Math.min(g, other * 1.1 + 6);
        }
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  context.putImageData(pixels, 0, 0);
  const trimmed = document.createElement('canvas');
  trimmed.width = Math.max(1, right - left + 1);
  trimmed.height = Math.max(1, bottom - top + 1);
  trimmed.getContext('2d')?.drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  const shadow = document.createElement('canvas');
  shadow.width = trimmed.width;
  shadow.height = trimmed.height;
  const shadowContext = shadow.getContext('2d');
  if (shadowContext) {
    shadowContext.drawImage(trimmed, 0, 0);
    shadowContext.globalCompositeOperation = 'source-in';
    shadowContext.fillStyle = '#050b09';
    shadowContext.fillRect(0, 0, shadow.width, shadow.height);
  }
  return { ...asSprite(await readImage(trimmed.toDataURL('image/png'))), shadow };
}

let assetPromise: Promise<GameAssets> | null = null;

export function loadAssets(): Promise<GameAssets> {
  if (assetPromise) return assetPromise;
  assetPromise = (async () => {
    const files: [SpriteName, string][] = [
      ['mountains', 'mountain-arena.png'],
      ['crowd', 'foreground-crowd.png'],
      ['grandstand', 'grandstand.png'],
      ['ground', 'track-tile.png'],
      ['deck', 'deck-surface.png'],
      ['dirtArt', 'dirt-tile.png'],
      ['blimp', 'blimp.png'],
      ['signSheep', 'sign-sheep.png?v=3'],
      ['signTnt', 'sign-tnt.png?v=3'],
      ['signParts', 'sign-parts.png?v=3'],
      ['treeWallPines', 'treewall-pines.png'],
      ['treeWallBoomtown', 'treewall-boomtown.png'],
      ['treeWallSheep', 'treewall-sheep.png'],
    ];
    const result = {} as GameAssets;
    await Promise.all(files.map(async ([name, filename]) => {
      const image = await readImage(`/art/${filename}`);
      result[name] = name === 'mountains' || name === 'deck' || name === 'dirtArt' || name === 'blimp' || name === 'signSheep' || name === 'signTnt' || name === 'signParts' || name === 'treeWallPines' || name === 'treeWallBoomtown' || name === 'treeWallSheep' ? asSprite(image) : await cutout(image);
    }));
    const sheet = await readImage('/art/track-sprites.png');
    const names: SpriteName[] = ['ball', 'sheep', 'tnt', 'spring', 'boost', 'ramp'];
    const width = Math.floor(sheet.naturalWidth / 3);
    const height = Math.floor(sheet.naturalHeight / 2);
    await Promise.all(names.map(async (name, index) => {
      result[name] = await cutout(sheet, {
        x: (index % 3) * width,
        y: Math.floor(index / 3) * height,
        width,
        height,
      });
    }));
    // TICKET-08: the reference pack's pinball props and surface strips. A missing file
    // degrades to a blank 1x1 image rather than failing the whole race load.
    const parts: [keyof TrackPartAssets, string][] = [
      ['bumperCrown', 'bumper-crown.webp'], ['bumperSpiked', 'bumper-spiked.webp'],
      ['spring', 'spring.webp'], ['crate', 'crate.webp'], ['skull', 'skull-box.webp'],
      ['ringSpiked', 'ring-spiked.webp'], ['ringSteel', 'ring-steel.webp'], ['ringCrown', 'ring-crown.webp'],
      ['stripWood', 'strip-wood.webp'], ['stripMoss', 'strip-moss.webp'],
      ['stripMetal', 'strip-metal.webp'], ['stripHazard', 'strip-hazard.webp'],
    ];
    const trackParts = {} as TrackPartAssets;
    const failures: string[] = [];
    await Promise.all(parts.map(async ([name, filename]) => {
      const url = `/art/track-parts/${filename}`;
      try { trackParts[name] = await readImage(url); }
      catch {
        failures.push(url);
        const blank = document.createElement('canvas');
        blank.width = blank.height = 2;
        trackParts[name] = blank as unknown as HTMLImageElement;
      }
    }));
    result.trackParts = trackParts;
    result.trackPartFailures = failures;

    const previews = createAssemblyPreviews(result);
    await Promise.all((Object.keys(previews) as (keyof typeof previews)[]).map(async (name) => {
      result[name] = asSprite(await readImage(previews[name]));
    }));
    buildModelAtlas(result);
    return result;
  })().catch((error: unknown) => {
    assetPromise = null;
    throw error;
  });
  return assetPromise;
}