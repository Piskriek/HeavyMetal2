import type { GameAssets } from './assets';
import { LANDMARK_IDS, artUrl, blimpCell, courseCell, loadArtImage, landmarkCell, type LandmarkId } from './art-assets';
import { TRACKS, type CourseDefinition } from './courses';
import type { CourseId } from './types';
import { TRACK_TEXTURES, type TrackTexKey } from './track-3d-data';

export interface CourseArt {
  /**
   * TICKET-06: Layer 1 — high-resolution painted panoramic skybox (2048x1024).
   * Falls back to the procedural gradient sky if the PNG isn't decoded yet.
   */
  sky: HTMLCanvasElement;
  /**
   * TICKET-06: Layer 2 — distant mountain/city silhouette parallax layer (0.15x).
   * Painted onto a transparent canvas so it composites cleanly over the skybox.
   */
  farMountains: HTMLCanvasElement;
  dirt: HTMLCanvasElement;
  bank: HTMLCanvasElement;
  blimp: HTMLCanvasElement;
  landmarks: HTMLCanvasElement[];
  /** TICKET-06: pre-decoded skybox image; null until prepareWorldArt finishes. */
  skyboxImage: HTMLImageElement | null;
  /** TICKET-06: sunbeam / god-ray overlay, tinted to the course's lighting profile. */
  sunbeams: HTMLCanvasElement;
}
const cache = new Map<CourseId, CourseArt>();
const canvas = (width: number, height: number) => {
  const image = document.createElement('canvas'); image.width = width; image.height = height;
  return { image, context: image.getContext('2d')! };
};
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

function dirtMaterial(track: CourseDefinition, assets: GameAssets) {
  const { image, context: c } = canvas(512, 512);
  const p = track.palette;
  // The painted track tile (public/art/dirt-tile.png, cut by scripts/cut-ui-art.mjs)
  // carries the hand-painted earth. A 'color' composite pass re-hues it toward this
  // course's dirt while keeping the painting's own luminance and brush texture.
  c.drawImage(assets.dirtArt.image, 0, 0, 512, 512);
  c.globalCompositeOperation = 'color';
  c.globalAlpha = 0.58;
  c.fillStyle = p.dirt;
  c.fillRect(0, 0, 512, 512);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  for (let lane = 0; lane < 4; lane++) {
    for (const offset of [43, 85]) {
      const y = lane * 128 + offset;
      const rut = c.createLinearGradient(0, y - 5, 0, y + 5);
      rut.addColorStop(0, `${p.bank}00`); rut.addColorStop(0.5, `${p.bank}20`); rut.addColorStop(1, `${p.bank}00`);
      c.fillStyle = rut; c.fillRect(0, y - 5, 512, 10);
    }
  }
  c.fillStyle = `${p.bank}29`;
  for (let i = 0; i < 120; i++) {
    const y = noise(i + 580) * 512;
    if (y > 28 && y < 484 && i % 4) continue;
    c.beginPath(); c.ellipse(noise(i + 450) * 512, y, 0.9 + noise(i + 730) * 1.5, 0.7, 0, 0, Math.PI * 2); c.fill();
  }
  for (const y of [0, 506]) { c.fillStyle = `${p.bank}40`; c.fillRect(0, y, 512, 6); }
  return image;
}

function bankMaterial(track: CourseDefinition) {
  const { image, context: c } = canvas(512, 128);
  const p = track.palette;
  const shade = c.createLinearGradient(0, 0, 0, 128);
  shade.addColorStop(0, p.dirt); shade.addColorStop(0.14, p.bank); shade.addColorStop(1, '#15231b');
  c.fillStyle = shade; c.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 7; i++) {
    c.fillStyle = i % 2 ? '#d8c6a40a' : '#171c170c';
    c.beginPath(); c.moveTo(0, 18 + i * 15);
    c.bezierCurveTo(160, 16 + i * 15, 300, 23 + i * 15, 512, 18 + i * 15);
    c.lineTo(512, 23 + i * 15); c.lineTo(0, 22 + i * 15); c.fill();
  }
  c.fillStyle = `${p.chalk}15`; c.fillRect(0, 0, 512, 2);
  return image;
}

function forestTree(c: CanvasRenderingContext2D, x: number, y: number, height: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x - height * 0.015, y - height * 0.15, height * 0.03, height * 0.18);
  for (let i = 0; i < 4; i++) {
    const top = y - height + i * height * 0.15;
    const width = height * (0.16 + i * 0.041);
    c.beginPath(); c.moveTo(x, top); c.lineTo(x - width, top + height * 0.43); c.lineTo(x + width * 0.95, top + height * 0.43); c.fill();
  }
}

/**
 * TICKET-06: Procedural fallback sky gradient + sun (painted skybox not yet decoded).
 */
function proceduralSky(track: CourseDefinition, assets: GameAssets) {
  const { image, context: c } = canvas(1792, 768);
  const p = track.palette;
  const sky = c.createLinearGradient(0, 0, 0, 650);
  sky.addColorStop(0, p.sky); sky.addColorStop(0.63, p.horizon); sky.addColorStop(1, p.middle);
  c.fillStyle = sky; c.fillRect(0, 0, 1792, 768);
  if (track.biome === 'forest') {
    c.globalAlpha = 0.65; c.drawImage(assets.mountains.image, 0, 0, 1792, 768); c.globalAlpha = 1;
    c.fillStyle = `${p.horizon}19`; c.fillRect(0, 0, 1792, 768);
  } else {
    const sun = c.createRadialGradient(1280, 140, 8, 1280, 140, 205);
    sun.addColorStop(0, '#f4ddb25e'); sun.addColorStop(1, '#f4ddb200');
    c.fillStyle = sun; c.fillRect(1060, 0, 440, 365);
  }
  return image;
}

/**
 * TICKET-06: Layer 2 silhouette layer — distant mountains, smelters, ruins, city skylines.
 * Painted onto a transparent canvas so it can be scrolled at 0.15x parallax independently of
 * the skybox. Serves as the mid-distance anchor even when the skybox PNG is present.
 */
function farMountainSilhouette(track: CourseDefinition) {
  const WIDTH = 2048;
  const HEIGHT = 512;
  const { image, context: c } = canvas(WIDTH, HEIGHT);
  const p = track.palette;

  // Far ridge (lightest, most atmospheric)
  c.fillStyle = p.distant;
  c.globalAlpha = 0.55;
  if (track.biome === 'forest') {
    // Snow-dusted alpine spires
    c.beginPath(); c.moveTo(-40, HEIGHT); c.lineTo(-40, 280);
    for (let x = -40, i = 0; x < WIDTH + 80; x += 180, i++) {
      const peak = 190 - noise(i * 1.7) * 80;
      c.lineTo(x + 60, peak + 30);
      c.lineTo(x + 90, peak);
      c.lineTo(x + 130, peak + 25);
      c.lineTo(x + 180, 260 + noise(i + 3) * 40);
    }
    c.lineTo(WIDTH + 80, HEIGHT); c.fill();
    // Snow caps
    c.fillStyle = '#e8dfc4'; c.globalAlpha = 0.6;
    c.beginPath(); c.moveTo(-40, HEIGHT);
    for (let x = -40, i = 0; x < WIDTH + 80; x += 180, i++) {
      const peak = 190 - noise(i * 1.7) * 80;
      c.lineTo(x + 70, peak + 20);
      c.lineTo(x + 90, peak);
      c.lineTo(x + 110, peak + 20);
    }
    c.lineTo(WIDTH + 80, HEIGHT); c.fill();
  } else if (track.biome === 'canyon') {
    // Jagged red canyon mesas + smelter silhouettes
    c.beginPath(); c.moveTo(-40, HEIGHT); c.lineTo(-40, 300);
    for (let x = -40, i = 0; x < WIDTH + 80; x += 220, i++) {
      const top = 240 - noise(i + 11) * 70;
      c.lineTo(x + 20, top + 40);
      c.lineTo(x + 60, top);
      c.lineTo(x + 120, top + 15);
      // Smelter chimney
      c.fillRect(x + 140, top - 80, 18, 95);
      c.lineTo(x + 140, top + 15);
      c.lineTo(x + 200, top + 30);
    }
    c.lineTo(WIDTH + 80, HEIGHT); c.fill();
  } else {
    // Craggy highland peaks with monoliths
    c.beginPath(); c.moveTo(-40, HEIGHT); c.lineTo(-40, 260);
    for (let x = -40, i = 0; x < WIDTH + 80; x += 260, i++) {
      const base = 280 + noise(i) * 40;
      c.bezierCurveTo(x + 60, base - 130 - noise(i + 5) * 50, x + 160, base - 110, x + 260, base);
    }
    c.lineTo(WIDTH + 80, HEIGHT); c.fill();
    // Stone monoliths
    c.fillStyle = p.middle; c.globalAlpha = 0.45;
    for (let x = 200; x < WIDTH; x += 380) {
      const h = 110 + noise(x) * 60;
      c.fillRect(x, HEIGHT - 220 - h, 24, h);
      c.fillRect(x + 40, HEIGHT - 220 - h + 20, 18, h - 20);
    }
  }
  c.globalAlpha = 1;

  // Atmospheric haze band at the base of the far mountains
  const mist = c.createLinearGradient(0, HEIGHT - 180, 0, HEIGHT);
  mist.addColorStop(0, `${track.lighting.fogColor}00`);
  mist.addColorStop(0.5, `${track.lighting.fogColor}22`);
  mist.addColorStop(1, `${p.haze}44`);
  c.fillStyle = mist;
  c.fillRect(0, HEIGHT - 180, WIDTH, 180);

  return image;
}

/**
 * TICKET-06: Volumetric sunbeam / god-ray overlay. Additive.
 */
function sunbeamOverlay(track: CourseDefinition) {
  const WIDTH = 1024;
  const HEIGHT = 768;
  const { image, context: c } = canvas(WIDTH, HEIGHT);
  const lighting = track.lighting;
  const intensity = lighting.sunbeamIntensity;
  if (intensity <= 0) return image;

  // Sun position varies by biome
  const sunX = track.biome === 'canyon' ? 800 : track.biome === 'meadow' ? 240 : 650;
  const sunY = 120;

  c.save();
  c.globalCompositeOperation = 'screen';
  for (let i = 0; i < 14; i++) {
    const angle = -0.9 + i * 0.13;
    const width = 40 + noise(i + 30) * 60;
    const grad = c.createLinearGradient(sunX, sunY, sunX + Math.cos(angle) * HEIGHT * 1.5, sunY + Math.sin(angle) * HEIGHT * 1.5);
    grad.addColorStop(0, `${lighting.sunColor}${Math.round(intensity * 55).toString(16).padStart(2, '0')}`);
    grad.addColorStop(0.4, `${lighting.sunColor}${Math.round(intensity * 25).toString(16).padStart(2, '0')}`);
    grad.addColorStop(1, `${lighting.sunColor}00`);
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(sunX, sunY);
    c.lineTo(sunX + Math.cos(angle - 0.04) * HEIGHT * 1.6, sunY + Math.sin(angle - 0.04) * HEIGHT * 1.6);
    c.lineTo(sunX + Math.cos(angle) * width, sunY + Math.sin(angle) * width);
    c.lineTo(sunX + Math.cos(angle + 0.04) * HEIGHT * 1.6, sunY + Math.sin(angle + 0.04) * HEIGHT * 1.6);
    c.closePath();
    c.fill();
  }
  // Sun disc glow
  const sun = c.createRadialGradient(sunX, sunY, 2, sunX, sunY, 180);
  sun.addColorStop(0, `${lighting.sunColor}${Math.round(intensity * 180).toString(16).padStart(2, '0')}`);
  sun.addColorStop(0.3, `${lighting.sunColor}${Math.round(intensity * 70).toString(16).padStart(2, '0')}`);
  sun.addColorStop(1, `${lighting.sunColor}00`);
  c.fillStyle = sun;
  c.fillRect(sunX - 200, sunY - 200, 400, 400);
  c.restore();

  return image;
}

function blimpArt(track: CourseDefinition) {
  const sprite = painted.get(blimpCell().image);
  if (sprite) {
    // One painted airship, drawn at its own aspect ratio so it is never stretched.
    const width = 520;
    const height = Math.round(width * sprite.naturalHeight / sprite.naturalWidth);
    const { image, context } = canvas(width, height);
    context.drawImage(sprite, 0, 0, width, height);
    return image;
  }
  const { image, context: c } = canvas(520, 270);
  const p = track.palette;
  c.fillStyle = '#263528'; c.strokeStyle = '#1b2b23'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(101, 76); c.lineTo(41, 31); c.lineTo(66, 101); c.lineTo(16, 122); c.lineTo(92, 131); c.fill(); c.stroke();
  const envelope = c.createLinearGradient(0, 40, 0, 175);
  envelope.addColorStop(0, '#e2c698'); envelope.addColorStop(0.36, p.accent); envelope.addColorStop(1, '#73563b');
  c.fillStyle = envelope;
  c.beginPath(); c.ellipse(271, 105, 193, 76, -0.025, 0, Math.PI * 2); c.fill(); c.stroke();
  c.save(); c.beginPath(); c.ellipse(271, 105, 190, 72, -0.025, 0, Math.PI * 2); c.clip();
  c.fillStyle = `${p.sky}a8`; c.fillRect(105, 88, 357, 32);
  for (const x of [159, 238, 323, 398]) {
    c.strokeStyle = '#d4b78580'; c.lineWidth = 4;
    c.beginPath(); c.ellipse(x, 105, 24, 91, 0, 0, Math.PI * 2); c.stroke();
  }
  c.strokeStyle = '#463e2aa6'; c.lineWidth = 3;
  for (const x of [124, 425]) { c.beginPath(); c.ellipse(x, 105, 16, 88, 0, 0, Math.PI * 2); c.stroke(); }
  c.restore();
  c.strokeStyle = '#4c4935'; c.lineWidth = 3;
  for (const x of [194, 351]) { c.beginPath(); c.moveTo(x, 170); c.lineTo(x + (x < 250 ? 28 : -21), 215); c.stroke(); }
  c.fillStyle = '#403e2e'; c.beginPath(); c.moveTo(196, 211); c.lineTo(358, 205); c.lineTo(333, 242); c.lineTo(226, 245); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = p.accent; c.fillRect(232, 200, 54, 20); c.fillStyle = '#496c59'; c.fillRect(239, 203, 18, 13); c.fillRect(263, 203, 17, 13);
  c.strokeStyle = '#cdb67a'; c.lineWidth = 3; c.beginPath(); c.moveTo(201, 215); c.lineTo(351, 209); c.stroke();
  c.fillStyle = '#2b3c30'; c.fillRect(364, 211, 35, 9);
  c.strokeStyle = '#6e795b'; c.lineWidth = 4; c.beginPath(); c.moveTo(400, 197); c.lineTo(400, 234); c.moveTo(385, 215); c.lineTo(416, 215); c.stroke();
  c.fillStyle = '#bf9a5c'; c.beginPath(); c.arc(271, 105, 17, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#354736'; c.beginPath(); c.moveTo(260, 96); c.lineTo(271, 112); c.lineTo(284, 94); c.lineTo(279, 120); c.lineTo(263, 120); c.closePath(); c.fill();
  return image;
}

function landmark(track: CourseDefinition, variation: number) {
  const id = LANDMARK_BY_COURSE[track.id]?.[variation] ?? 'pines';
  const paintedProp = propCanvas(id, 270, 330);
  if (paintedProp) return paintedProp;
  const { image, context: c } = canvas(270, 330);
  const p = track.palette;
  if (track.biome === 'forest') {
    forestTree(c, 144, 305, variation ? 239 : 285, p.foreground);
    forestTree(c, 123, 297, variation ? 216 : 252, '#496b48');
    c.fillStyle = '#8a815053'; c.beginPath(); c.ellipse(137, 309, 62, 8, 0, 0, Math.PI * 2); c.fill();
  } else if (track.biome === 'canyon') {
    if (!variation) {
      c.fillStyle = '#504231'; c.beginPath(); c.moveTo(74, 306); c.lineTo(101, 84); c.lineTo(161, 64); c.lineTo(188, 310); c.fill();
      c.fillStyle = '#9b724e'; c.beginPath(); c.moveTo(100, 293); c.lineTo(114, 84); c.lineTo(145, 72); c.lineTo(160, 298); c.fill();
      c.strokeStyle = '#ba8a5b5c'; c.lineWidth = 8; for (let y = 131; y < 290; y += 43) { c.beginPath(); c.moveTo(99, y); c.lineTo(170, y + 3); c.stroke(); }
    } else {
      c.fillStyle = '#373f30'; c.fillRect(83, 92, 50, 221); c.fillRect(153, 139, 35, 174);
      c.fillStyle = '#7e7851'; c.fillRect(80, 88, 57, 12); c.fillRect(149, 136, 42, 10);
      c.fillStyle = '#56604643'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(105 + i * 13, 71 - i * 16, 23 + i * 4, 15 + i * 3, 0, 0, Math.PI * 2); c.fill(); }
    }
  } else {
    c.fillStyle = '#484b2f'; c.beginPath(); c.moveTo(111, 310); c.lineTo(123, 109); c.lineTo(159, 110); c.lineTo(174, 310); c.fill();
    c.fillStyle = '#ac9d6b'; c.beginPath(); c.moveTo(130, 304); c.lineTo(137, 113); c.lineTo(153, 115); c.lineTo(158, 304); c.fill();
    c.strokeStyle = '#524f34'; c.lineWidth = 5;
    c.save(); c.translate(140, 119); c.rotate(variation ? 0.38 : 0.2);
    for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -91); c.stroke(); c.fillStyle = '#d5c79e'; c.beginPath(); c.moveTo(5, -26); c.lineTo(5, -92); c.lineTo(27, -88); c.lineTo(22, -29); c.closePath(); c.fill(); }
    c.restore(); c.fillStyle = '#cfb47a'; c.beginPath(); c.arc(140, 119, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8f8b5380'; c.beginPath(); c.ellipse(138, 313, 57, 7, 0, 0, Math.PI * 2); c.fill();
  }
  return image;
}

/**
 * Painted prop images, decoded before a race (`prepareWorldArt`) and composed into the
 * canvases below. Empty until the first preparation, so the region painter still has a
 * complete fallback if a PNG cannot be decoded.
 */
const painted = new Map<string, HTMLImageElement>();
/** TICKET-06: decoded skybox images keyed by course id. */
const skyboxImages = new Map<CourseId, HTMLImageElement>();

/** Blizzard-style track textures from Arena AI (loaded in prepareWorldArt). */
const trackTexCache = new Map<TrackTexKey, HTMLImageElement>();

/**
 * Returns the loaded Blizzard track textures for use by the 3D geometry builder.
 * Keys: 'dirt', 'cliff', 'grass', 'lava', 'caverock', 'cobble', 'wood', 'iron', 'bark', 'water'.
 * Returns null for any texture that hasn't been loaded yet.
 */
export function getTrackTextures(): Record<TrackTexKey, { image: CanvasImageSource; width: number; height: number }> | null {
  if (trackTexCache.size < 10) return null;
  const result = {} as Record<TrackTexKey, { image: CanvasImageSource; width: number; height: number }>;
  for (const [key, img] of trackTexCache) {
    result[key] = { image: img, width: img.naturalWidth || 1024, height: img.naturalHeight || 1024 };
  }
  return result;
}

/** Which painted landmark each circuit uses for its two roadside variations. */
const LANDMARK_BY_COURSE: Record<CourseId, [LandmarkId, LandmarkId]> = {
  ridge: ['pines', 'windmill'],
  boomtown: ['quarry', 'pasture'],
  sheep: ['pasture', 'windmill'],
};

/**
 * TICKET-06: Returns the list of skybox paths that must be preloaded for a given course
 * (or all courses). Used by the asset preloader pipeline.
 */
export function skyboxPathsForCourse(courseId?: CourseId): string[] {
  const ids: CourseId[] = courseId ? [courseId] : ['ridge', 'boomtown', 'sheep'];
  return ids.map((id) => TRACKS[id].lighting.skyboxUrl);
}

/**
 * Decode the blimp, landmark sprites, and skybox panoramas before racing; never called
 * during a frame. Any course art that was already composed with the procedural fallback is
 * invalidated, so the painted artwork always wins once it is available.
 */
export async function prepareWorldArt(): Promise<boolean> {
  const paths = [blimpCell().image, ...LANDMARK_IDS.map((id) => landmarkCell(id).image)];
  const skyPaths = skyboxPathsForCourse();
  const trackTexPaths = Object.entries(TRACK_TEXTURES) as [TrackTexKey, string][];
  let loaded = 0;
  await Promise.all([
    ...paths.map(async (path) => {
      if (painted.has(path)) { loaded += 1; return; }
      try { painted.set(path, await loadArtImage(path)); loaded += 1; } catch { /* keep the fallback */ }
    }),
    ...skyPaths.map(async (path) => {
      const courseId = (['ridge', 'boomtown', 'sheep'] as const).find((id) => TRACKS[id].lighting.skyboxUrl === path);
      if (!courseId || skyboxImages.has(courseId)) return;
      try {
        const img = await loadArtImage(path);
        skyboxImages.set(courseId, img);
        loaded += 1;
      } catch { /* keep the procedural fallback */ }
    }),
    // Load the 10 Blizzard-style track textures from Arena AI
    ...trackTexPaths.map(async ([key, path]) => {
      if (trackTexCache.has(key)) return;
      try {
        const img = await loadArtImage(path);
        trackTexCache.set(key, img);
        loaded += 1;
      } catch {
        console.warn(`[world-art] Could not load track texture: ${key} (${path})`);
      }
    }),
  ]);
  if (loaded) cache.clear();
  return loaded > 0;
}

/** Draws a painted prop into a fixed-size, bottom-aligned canvas for the scenery layer. */
function propCanvas(id: LandmarkId, width: number, height: number) {
  const image = painted.get(landmarkCell(id).image);
  if (!image) return null;
  const { image: target, context } = canvas(width, height);
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  // Props stand on the ground: bottom-aligned, horizontally centred.
  context.drawImage(image, (width - w) / 2, height - h, w, h);
  return target;
}

export function buildCourseArt(id: CourseId, assets: GameAssets): CourseArt {
  const existing = cache.get(id); if (existing) return existing;
  const track = TRACKS[id];
  const skyboxImage = skyboxImages.get(id) ?? null;
  const art: CourseArt = {
    sky: proceduralSky(track, assets),
    farMountains: farMountainSilhouette(track),
    dirt: dirtMaterial(track, assets),
    bank: bankMaterial(track),
    blimp: blimpArt(track),
    landmarks: [landmark(track, 0), landmark(track, 1)],
    skyboxImage,
    sunbeams: sunbeamOverlay(track),
  };
  cache.set(id, art); return art;
}

/**
 * Course thumbnail for the setup screens: the generated raster painting for that circuit,
 * so the selection art matches the world the player actually races through.
 */
export function coursePreview(id: CourseId) {
  return artUrl(courseCell(id).image);
}
