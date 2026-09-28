/**
 * ISLAND-ROUTE: the island's surface set — the Scrapwind Isle tiles (`public/textures/island`, made by
 * `scripts/convert-island-textures.ps1`) in one mipmapped texture array the island ground samples.
 *
 * Each tile's alpha channel is a **height** worked out once at load from its own pixels, so two surfaces
 * meet the way real ones do (sand settles into the cracks of rock, grass blades stand up out of sand)
 * instead of cross-fading: the ground shader's height blend compares the two heights. What reads as
 * "high" depends on the tile — brightness for rock, sand and mud (cracks and shadows are dark), the
 * green of the blades for grass, colourfulness for coral — so each surface names its recipe.
 *
 * Surface IDs are the shared surface table's (`surface/surface-table.ts`), so the brush, auto paint, the
 * road rules and physics all speak the same numbers. Old IDs painted before this set existed (asphalt,
 * the road atlas's grass and rock...) map onto the nearest island tile: there is never asphalt here.
 */
import * as THREE from 'three';
import {
  SURFACE_ASPHALT, SURFACE_BEACH_GRASS, SURFACE_CAVEROCK, SURFACE_COBBLE, SURFACE_CONCRETE, SURFACE_CORAL_SAND,
  SURFACE_CRYSTAL, SURFACE_DARK_ROCK, SURFACE_DRY_MUD, SURFACE_DUNES, SURFACE_GRANITE, SURFACE_GRASS, SURFACE_GRAVEL,
  SURFACE_IRON, SURFACE_MOSSY_ROCK, SURFACE_OLD_PLANKS, SURFACE_PLANK, SURFACE_RIVETED_IRON, SURFACE_ROCK, SURFACE_SAND,
  SURFACE_SHALLOWS, SURFACE_SLOTS, SURFACE_STRATA, SURFACE_WET_SAND, surfaceDefinition,
} from '../surface/surface-table';

/** How a tile's height is read from its colour: weights of brightness, saturation and "green-ness". */
export interface HeightRecipe {
  readonly lum: number;
  readonly sat: number;
  readonly green: number;
  /** Contrast of the height blend for this surface (1 = as read; higher = crisper edges). */
  readonly contrast: number;
}

export interface IslandSurface {
  readonly id: number;
  readonly file: string;
  /** World units per repeat of the tile (the ball is 62 across; a lane 240). */
  readonly repeat: number;
  readonly height: HeightRecipe;
}

const H = (lum: number, sat: number, green: number, contrast = 1): HeightRecipe => ({ lum, sat, green, contrast });

/** The array's layers, in order. */
export const ISLAND_SURFACES: readonly IslandSurface[] = Object.freeze([
  { id: SURFACE_SAND, file: 'sand-packed.jpg', repeat: 900, height: H(1, 0, 0) },
  { id: SURFACE_WET_SAND, file: 'sand-wet.jpg', repeat: 800, height: H(1, 0.4, 0) },
  { id: SURFACE_SHALLOWS, file: 'shallows.jpg', repeat: 1400, height: H(0.3, 0, 0, 0.5) },
  { id: SURFACE_DARK_ROCK, file: 'rock-dark.jpg', repeat: 1100, height: H(1, 0, 0, 1.4) },
  { id: SURFACE_OLD_PLANKS, file: 'planks-old.jpg', repeat: 700, height: H(1, 0, 0) },
  { id: SURFACE_RIVETED_IRON, file: 'iron-riveted.jpg', repeat: 700, height: H(1, 0, 0) },
  { id: SURFACE_CRYSTAL, file: 'crystal.jpg', repeat: 900, height: H(1, 0.3, 0, 1.3) },
  { id: SURFACE_BEACH_GRASS, file: 'grass-beach.jpg', repeat: 420, height: H(0.2, 0, 1, 1.5) },
  { id: SURFACE_CORAL_SAND, file: 'sand-coral.jpg', repeat: 600, height: H(0.3, 1, 0, 1.2) },
  { id: SURFACE_GRANITE, file: 'cliff-granite.jpg', repeat: 1500, height: H(1, 0, 0, 1.3) },
  { id: SURFACE_MOSSY_ROCK, file: 'rock-moss.jpg', repeat: 1200, height: H(0.7, 0, 0.5, 1.2) },
  { id: SURFACE_DRY_MUD, file: 'mud-dry.jpg', repeat: 800, height: H(1, 0, 0, 1.3) },
  { id: SURFACE_DUNES, file: 'sand-dunes.jpg', repeat: 1300, height: H(1, 0, 0, 0.8) },
  { id: SURFACE_STRATA, file: 'cliff-strata.jpg', repeat: 1600, height: H(1, 0, 0, 1.2) },
]);

export const ISLAND_TEXTURE_DIR = '/textures/island/';
/** Pixels across one layer (the source tiles are 1024). */
export const ISLAND_LAYER_SIZE = 1024;

/**
 * Array layer for each surface ID (-1: not an island tile — bare island, cracked dirt, or nothing). The
 * older IDs map onto the nearest island tile, so paint made before this set still reads right and no
 * asphalt or concrete can show on the island.
 */
export const ISLAND_LAYER_OF: readonly number[] = (() => {
  const out = new Array<number>(SURFACE_SLOTS).fill(-1);
  ISLAND_SURFACES.forEach((s, layer) => { out[s.id] = layer; });
  const alias = (from: number, to: number) => { out[from] = out[to]; };
  alias(SURFACE_ASPHALT, SURFACE_SAND);
  alias(SURFACE_CONCRETE, SURFACE_SAND);
  alias(SURFACE_COBBLE, SURFACE_DRY_MUD);
  alias(SURFACE_PLANK, SURFACE_OLD_PLANKS);
  alias(SURFACE_IRON, SURFACE_RIVETED_IRON);
  alias(SURFACE_GRAVEL, SURFACE_DUNES);
  alias(SURFACE_GRASS, SURFACE_BEACH_GRASS);
  alias(SURFACE_ROCK, SURFACE_GRANITE);
  alias(SURFACE_CAVEROCK, SURFACE_DARK_ROCK);
  return Object.freeze(out);
})();

/** Surface IDs the island palette offers (the island set; the shader's aliases are not offered). */
export const ISLAND_PALETTE: readonly number[] = ISLAND_SURFACES.map((s) => s.id);

/**
 * Writes a tile's height into its alpha channel (RGBA bytes, in place). Height = the recipe's mix of
 * brightness, saturation and green-ness, stretched between the tile's 2nd and 98th percentile and
 * pushed by `contrast` around the middle, so every tile uses the full 0..1 range the blend expects.
 */
export function writeTileHeight(rgba: Uint8Array | Uint8ClampedArray, recipe: HeightRecipe): void {
  const n = rgba.length >> 2;
  const h = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4] / 255, g = rgba[i * 4 + 1] / 255, b = rgba[i * 4 + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = max > 0 ? (max - min) / max : 0;
    const green = Math.max(0, g - (r + b) / 2) * 2;
    const v = recipe.lum * lum + recipe.sat * sat + recipe.green * green;
    h[i] = v;
  }
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { if (h[i] < lo) lo = h[i]; if (h[i] > hi) hi = h[i]; }
  const span = hi - lo || 1;
  for (let i = 0; i < n; i++) hist[Math.min(255, Math.floor(((h[i] - lo) / span) * 255))]++;
  const at = (q: number) => { let sum = 0; for (let k = 0; k < 256; k++) { sum += hist[k]; if (sum >= q * n) return lo + (k / 255) * span; } return hi; };
  const p2 = at(0.02), p98 = at(0.98);
  const range = Math.max(1e-6, p98 - p2);
  for (let i = 0; i < n; i++) {
    let t = (h[i] - p2) / range;
    t = 0.5 + (t - 0.5) * recipe.contrast;
    rgba[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, t)) * 255);
  }
}

/** The loaded array on the GPU, per-layer parameters for the shader, and small thumbnails for the UI. */
export class IslandSurfaceArray {
  readonly texture: THREE.DataArrayTexture;
  /** vec4 per layer: world units per repeat, roughness, height contrast, 0. */
  readonly params: THREE.Vector4[];
  /** A 64 px picture per surface ID, for the palette and preset cards. */
  readonly thumbs = new Map<number, string>();
  /** 0..1 while loading. */
  progress = 0;
  readonly ready: Promise<void>;

  constructor(size = ISLAND_LAYER_SIZE) {
    const layers = ISLAND_SURFACES.length;
    const data = new Uint8Array(size * size * 4 * layers);
    this.texture = new THREE.DataArrayTexture(data, size, size, layers);
    this.texture.format = THREE.RGBAFormat;
    this.texture.type = THREE.UnsignedByteType;
    this.texture.colorSpace = THREE.SRGBColorSpace; // RGB is colour; the alpha height stays linear
    this.texture.wrapS = this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.generateMipmaps = true;
    this.texture.anisotropy = 8;
    this.params = ISLAND_SURFACES.map((s) => new THREE.Vector4(s.repeat, surfaceDefinition(s.id).roughness, s.height.contrast, 0));
    this.size = size;
    this.data = data;
    this.ready = typeof document === 'undefined' ? Promise.resolve() : this.load();
  }

  private readonly size: number;
  private readonly data: Uint8Array;
  private canvas: HTMLCanvasElement | null = null;
  /** The tile each layer shows now (its URL). */
  private readonly urls: string[] = ISLAND_SURFACES.map((s) => ISLAND_TEXTURE_DIR + s.file);

  private async load(): Promise<void> {
    let done = 0;
    // Decode in parallel, write layer by layer (a frame between layers keeps the loading bar moving).
    const images = this.urls.map((url) => decode(url));
    for (let layer = 0; layer < ISLAND_SURFACES.length; layer++) {
      const img = await images[layer];
      if (img) this.write(layer, img);
      this.progress = ++done / ISLAND_SURFACES.length;
      await new Promise((r) => setTimeout(r, 0));
    }
    this.texture.needsUpdate = true;
  }

  /** The URL a layer shows. */
  urlOf(layer: number): string { return this.urls[layer] ?? ''; }

  /**
   * Swaps one layer's tile (any image URL: a library tile). Its height is read with the surface's own
   * recipe, so a new grass tile still stands up out of sand. Resolves false when the image fails.
   */
  async setLayerImage(layer: number, url: string): Promise<boolean> {
    if (layer < 0 || layer >= ISLAND_SURFACES.length || this.urls[layer] === url) return true;
    await this.ready;
    const img = await decode(url);
    if (!img) return false;
    this.urls[layer] = url;
    this.write(layer, img);
    this.texture.addLayerUpdate(layer);
    this.texture.needsUpdate = true;
    return true;
  }

  private write(layer: number, img: HTMLImageElement) {
    const size = this.size;
    if (!this.canvas) { this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = size; }
    const g = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    const surface = ISLAND_SURFACES[layer];
    g.clearRect(0, 0, size, size);
    g.drawImage(img, 0, 0, size, size);
    const px = g.getImageData(0, 0, size, size).data;
    writeTileHeight(px, surface.height);
    this.data.set(px, layer * size * size * 4);
    const t = document.createElement('canvas');
    t.width = t.height = 64;
    t.getContext('2d')?.drawImage(img, 0, 0, 64, 64);
    this.thumbs.set(surface.id, t.toDataURL('image/jpeg', 0.85));
  }

  dispose() { this.texture.dispose(); }
}

function decode(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(() => img, () => null);
}
