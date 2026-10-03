import * as THREE from 'three';

/**
 * The paintable surfaces of a terrain: one array texture of tiles (albedo + a height in alpha) and one of PBR maps
 * (normal x/y + roughness), sampled by the terrain shader. Layers show a flat colour at once and the real tiles stream in.
 */

export interface HeightRecipe { readonly lum: number; readonly sat: number; readonly green: number; readonly contrast: number }

export interface SurfaceDef {
  /** The id stored in the terrain's paint mask (1..255; 0 means "no surface"). */
  readonly id: number;
  readonly name: string;
  /** Albedo tile URL (any size; it is resampled to the layer size). */
  readonly url: string;
  /** Packed PBR map URL: R = normal x, G = normal y, B = roughness (optional). */
  readonly pbrUrl?: string;
  /**
   * Maps made from a texture graph (packages/texgraph): R = height, G = roughness. The normal is made from the height when it loads and the
   * height goes in the colour tile's alpha. Such tiles are seamless by construction, so their edges are not blended.
   */
  readonly mapsUrl?: string;
  /** A grey height image for an image tile (its pbrUrl holds the normal): surfaces then meet by their real height, not one guessed from colour. */
  readonly heightUrl?: string;
  /** Metres per repeat of the tile. */
  readonly repeat: number;
  readonly roughness: number;
  readonly height: HeightRecipe;
  /** Shown until the tile has loaded. */
  readonly fallback: string;
  /** The flat (voxel) skin: up to FLAT_COLORS hand-picked tones. Each half-metre block of the ground takes one of them, so no texture file is involved. */
  readonly flat?: readonly string[];
  /** The tile has a direction (planks, stripes, strata): it is never turned to hide its repeats. */
  readonly directional?: boolean;
  /** Light the surface gives off (lava): 0 or left out for none. The bright tones of its palette glow, the dark ones stay dark. */
  readonly glow?: number;
}

export const LAYER_SIZE = 256;
/** Pixels across a ground tile for a graphics tier: sharp 512 unless the tier is low (a quarter of the memory there). */
export const tileSizeFor = (tier: string): number => (tier === 'potato' || tier === 'low' ? 256 : 512);
/** The voxel blocks' faces: pixels across one half-metre face. */
export const VOXEL_SIZE = 32;
/**
 * The relief a height of 1 stands for, as a share of the tile width, as the graphs were authored (0.3 m on a 3 m ground tile, 0.1 m on a
 * half-metre block face). A share, not metres: a tile shown bigger or smaller keeps its shape.
 */
export const GROUND_RELIEF = 0.1;
export const BLOCK_RELIEF = 0.2;

/**
 * The voxel blocks' own faces (the owner, 2026-10-03: "voxel should have its own PBR maps"): an atlas with one row per surface and
 * `variants` faces of VOXEL_SIZE pixels across, in colour (url) and R = height, G = roughness (mapsUrl). Each block takes one variant.
 */
export interface VoxelSet {
  readonly url: string;
  readonly mapsUrl: string;
  readonly variants: number;
  /** The surface id of each atlas row. */
  readonly rows: readonly number[];
}
export const FLAT_COLORS = 5;
export const SURFACE_SLOTS = 256;

export const recipe = (lum: number, sat = 0, green = 0, contrast = 1): HeightRecipe => ({ lum, sat, green, contrast });

/** Height of a tile at each texel, 0..1: what stands "high" differs per surface, stretched to the tile's own 2nd..98th percentile. */
/**
 * Make a square tile seamless in place: near its edges each pixel is blended toward the tile shifted by half (whose middle is clean), so a
 * painted tile with soft or dark borders stops repeating as a visible grid. The middle (beyond `band` of the size from every edge) is left
 * as it was; the very edge is all shifted copy, which lines up with the neighbouring tile exactly.
 */
export function makeSeamless(px: Uint8ClampedArray | Uint8Array, size: number, band = 0.22): void {
  // two passes: across (blend toward the copy shifted half a tile sideways), then down; each copy's own seam lands in the untouched middle
  const half = size >> 1, span = Math.max(1, size * band);
  const weight = (d: number): number => { const t = Math.min(1, Math.max(0, d / span)); return 1 - t * t * (3 - 2 * t); };
  for (const axis of [0, 1]) {
    const src = px.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const along = axis === 0 ? x : y;
        const w = weight(Math.min(along, size - 1 - along));
        if (w <= 0) continue;
        const o = (y * size + x) * 4;
        const so = axis === 0 ? (y * size + ((x + half) % size)) * 4 : (((y + half) % size) * size + x) * 4;
        for (let k = 0; k < 4; k++) px[o + k] = Math.round(src[o + k]! * (1 - w) + src[so + k]! * w);
      }
    }
  }
}

/** Write a tile's height into its alpha: guessed from its colour by the recipe, or taken from `given` (a grey image of the same size). */
export function writeTileHeight(rgba: Uint8ClampedArray | Uint8Array, r: HeightRecipe, given?: ArrayLike<number>): void {
  const n = rgba.length / 4;
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (given) { h[i] = given[i * 4]! / 255; continue; }
    const R = rgba[i * 4]! / 255, G = rgba[i * 4 + 1]! / 255, B = rgba[i * 4 + 2]! / 255;
    const lum = 0.299 * R + 0.587 * G + 0.114 * B;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    const green = Math.max(0, G - (R + B) * 0.5);
    h[i] = r.lum * lum + r.sat * sat + r.green * green * 2;
  }
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[Math.min(255, Math.max(0, Math.round(h[i]! * 255)))]!++;
  let acc = 0, lo = 0, hi = 255;
  for (let b = 0; b < 256; b++) { acc += hist[b]!; if (acc >= n * 0.02) { lo = b; break; } }
  acc = 0;
  for (let b = 255; b >= 0; b--) { acc += hist[b]!; if (acc >= n * 0.02) { hi = b; break; } }
  const span = Math.max(1, hi - lo) / 255;
  for (let i = 0; i < n; i++) {
    let v = (h[i]! - lo / 255) / span;
    v = Math.min(1, Math.max(0, v));
    v = Math.min(1, Math.max(0, (v - 0.5) * r.contrast + 0.5));
    rgba[i * 4 + 3] = Math.round(v * 255);
  }
}

/**
 * Fill a PBR tile (R, G = normal x, y at 0.5 + 0.5 n; B = roughness; A = 255, "has detail") from a height and roughness, both read from an
 * RGBA image at `stride` bytes per pixel. `relief` is height units per pixel width. Same encoding as texgraph's normalFromHeight.
 */
export function pbrFromHeight(src: ArrayLike<number>, size: number, relief: number, out: Uint8Array, at = 0, heightOf = 0, roughOf = 1, stride = 4, rowStride = size * stride, srcAt = 0): void {
  const h = (x: number, y: number): number => src[srcAt + ((y + size) % size) * rowStride + ((x + size) % size) * stride + heightOf]! / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 0.5 * relief, dy = (h(x, y + 1) - h(x, y - 1)) * 0.5 * relief;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1), o = at + (y * size + x) * 4;
      out[o] = Math.round(255 * Math.min(1, Math.max(0, 0.5 - 0.5 * dx * inv)));
      out[o + 1] = Math.round(255 * Math.min(1, Math.max(0, 0.5 - 0.5 * dy * inv)));
      out[o + 2] = src[srcAt + y * rowStride + x * stride + roughOf]!;
      out[o + 3] = 255;
    }
  }
}

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const v = m ? parseInt(m[1]!, 16) : 0x808080;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

async function decode(url: string): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

/** One row per surface, FLAT_COLORS tones across. A short palette is spread so its tones keep equal weight (two tones fill 3 and 2 of the 5 texels). */
export function makeFlatTexture(defs: readonly SurfaceDef[]): THREE.DataTexture {
  const rows = Math.max(1, defs.length);
  const data = new Uint8Array(FLAT_COLORS * rows * 4);
  defs.forEach((d, row) => {
    const pal = d.flat && d.flat.length > 0 ? d.flat : [d.fallback];
    for (let i = 0; i < FLAT_COLORS; i++) {
      const [r, g, b] = hexToRgb(pal[Math.min(pal.length - 1, Math.floor((i * pal.length) / FLAT_COLORS))]!);
      const o = (row * FLAT_COLORS + i) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  });
  const t = new THREE.DataTexture(data, FLAT_COLORS, rows, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export class SurfaceArray {
  readonly texture: THREE.DataArrayTexture;
  readonly pbrTexture: THREE.DataArrayTexture;
  /** The flat skin's palettes: FLAT_COLORS texels across, one row per layer. */
  readonly flatTexture: THREE.DataTexture;
  /** The voxel blocks' faces: layer * variants + variant, colour with the height in alpha (the palette's tones until the set loads). */
  readonly voxelTexture: THREE.DataArrayTexture;
  /** The voxel faces' normal x/y, roughness and "has detail" (0 until the set loads). */
  readonly voxelPbrTexture: THREE.DataArrayTexture;
  readonly voxelVariants: number;
  /** id -> layer (or -1), in the shape the shader wants. */
  readonly layerOf = new Float32Array(SURFACE_SLOTS).fill(-1);
  /** (metres per repeat, roughness, height contrast, glow) per layer. */
  readonly params: THREE.Vector4[];
  /** 1 where a layer may be turned a quarter at a time to hide its repeats, 0 for directional tiles. */
  readonly turn: Float32Array;
  readonly ready: Promise<void>;
  progress = 0;
  private readonly data: Uint8Array;
  private readonly pbr: Uint8Array;
  private readonly voxelData: Uint8Array;
  private readonly voxelPbr: Uint8Array;

  /** `size`: pixels across each ground tile (512 for the sharp sets on capable graphics; tiles of another size are resampled). */
  constructor(readonly defs: readonly SurfaceDef[], assetUrl: (path: string) => string = (p) => p, readonly voxel?: VoxelSet, readonly size = LAYER_SIZE) {
    const layers = Math.max(1, defs.length);
    this.voxelVariants = voxel?.variants ?? FLAT_COLORS;
    this.data = new Uint8Array(this.size * this.size * 4 * layers);
    this.pbr = new Uint8Array(this.size * this.size * 4 * layers);
    this.voxelData = new Uint8Array(VOXEL_SIZE * VOXEL_SIZE * 4 * layers * this.voxelVariants);
    this.voxelPbr = new Uint8Array(this.voxelData.length);
    const face = VOXEL_SIZE * VOXEL_SIZE * 4;
    defs.forEach((d, layer) => {
      this.layerOf[d.id] = layer;
      const [r, g, b] = hexToRgb(d.fallback);
      const base = layer * this.size * this.size * 4;
      for (let i = 0; i < this.size * this.size; i++) {
        const o = base + i * 4;
        this.data[o] = r; this.data[o + 1] = g; this.data[o + 2] = b; this.data[o + 3] = 128;
        this.pbr[o] = 128; this.pbr[o + 1] = 128; this.pbr[o + 2] = 200; this.pbr[o + 3] = 0;
      }
      // until the voxel faces load (or with none), each variant is one plain tone of the hand-picked palette: the old voxel look
      const pal = d.flat && d.flat.length > 0 ? d.flat : [d.fallback];
      for (let v = 0; v < this.voxelVariants; v++) {
        const [tr, tg, tb] = hexToRgb(pal[v % pal.length]!), at = (layer * this.voxelVariants + v) * face;
        for (let o = at; o < at + face; o += 4) {
          this.voxelData[o] = tr; this.voxelData[o + 1] = tg; this.voxelData[o + 2] = tb; this.voxelData[o + 3] = 128;
          this.voxelPbr[o] = 128; this.voxelPbr[o + 1] = 128; this.voxelPbr[o + 2] = 235; this.voxelPbr[o + 3] = 0;
        }
      }
    });
    this.params = defs.map((d) => new THREE.Vector4(d.repeat, d.roughness, d.height.contrast, d.glow ?? 0));
    this.turn = Float32Array.from(defs.map((d) => (d.directional ? 0 : 1)));
    this.flatTexture = makeFlatTexture(defs);
    this.texture = this.makeArray(this.data, this.size, layers, true);
    this.pbrTexture = this.makeArray(this.pbr, this.size, layers, false);
    this.voxelTexture = this.makeArray(this.voxelData, VOXEL_SIZE, layers * this.voxelVariants, true, true);
    this.voxelPbrTexture = this.makeArray(this.voxelPbr, VOXEL_SIZE, layers * this.voxelVariants, false, true);
    this.ready = typeof document === 'undefined' ? Promise.resolve() : Promise.all([this.load(assetUrl), this.loadVoxel(assetUrl)]).then(() => undefined);
  }

  /** `crisp`: the voxel faces, pixel art up close (nearest), smooth far away (mipmaps). */
  private makeArray(data: Uint8Array, size: number, layers: number, color: boolean, crisp = false): THREE.DataArrayTexture {
    const t = new THREE.DataArrayTexture(data, size, size, layers);
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = crisp ? THREE.NearestFilter : THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = crisp ? 4 : color ? 8 : 4;
    t.needsUpdate = true;
    return t;
  }

  private pixels(img: ImageBitmap | HTMLImageElement, w = this.size, h = w): Uint8ClampedArray | null {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  }

  private async load(assetUrl: (path: string) => string): Promise<void> {
    let done = 0;
    await Promise.all(this.defs.map(async (d, layer) => {
      const extra = d.mapsUrl ?? d.pbrUrl;
      const [img, extraImg, heightImg] = await Promise.all([decode(assetUrl(d.url)), extra ? decode(assetUrl(extra)) : Promise.resolve(null), d.heightUrl ? decode(assetUrl(d.heightUrl)) : Promise.resolve(null)]);
      const colour = img ? this.pixels(img) : null;
      const more = extraImg ? this.pixels(extraImg) : null;
      const given = heightImg ? this.pixels(heightImg) : null;
      if (given) makeSeamless(given, this.size);
      if (d.mapsUrl && colour && more) this.setTile(d.id, colour, more);
      else {
        const base = layer * this.size * this.size * 4;
        if (colour) { makeSeamless(colour, this.size); writeTileHeight(colour, d.height, given ?? undefined); this.data.set(colour, base); this.texture.needsUpdate = true; }
        if (more && !d.mapsUrl) { makeSeamless(more, this.size); for (let i = 3; i < more.length; i += 4) more[i] = 255; this.pbr.set(more, base); this.pbrTexture.needsUpdate = true; }
      }
      this.progress = ++done / (this.defs.length + (this.voxel ? 1 : 0));
    }));
  }

  private async loadVoxel(assetUrl: (path: string) => string): Promise<void> {
    const v = this.voxel;
    if (!v) return;
    const [img, mapsImg] = await Promise.all([decode(assetUrl(v.url)), decode(assetUrl(v.mapsUrl))]);
    const w = VOXEL_SIZE * v.variants, h = VOXEL_SIZE * v.rows.length;
    const colour = img ? this.pixels(img, w, h) : null, maps = mapsImg ? this.pixels(mapsImg, w, h) : null;
    const face = VOXEL_SIZE * VOXEL_SIZE * 4, relief = BLOCK_RELIEF * VOXEL_SIZE;
    if (colour) {
      v.rows.forEach((id, row) => {
        const layer = this.layerOf[id] ?? -1;
        if (layer < 0) return;
        for (let k = 0; k < Math.min(v.variants, this.voxelVariants); k++) {
          const at = (layer * this.voxelVariants + k) * face, srcAt = (row * VOXEL_SIZE * w + k * VOXEL_SIZE) * 4;
          for (let y = 0; y < VOXEL_SIZE; y++) {
            for (let x = 0; x < VOXEL_SIZE; x++) {
              const o = at + (y * VOXEL_SIZE + x) * 4, so = srcAt + (y * w + x) * 4;
              this.voxelData[o] = colour[so]!; this.voxelData[o + 1] = colour[so + 1]!; this.voxelData[o + 2] = colour[so + 2]!;
              this.voxelData[o + 3] = maps ? maps[so]! : 128;
            }
          }
          if (maps) pbrFromHeight(maps, VOXEL_SIZE, relief, this.voxelPbr, at, 0, 1, 4, w * 4, srcAt);
        }
      });
      this.voxelTexture.needsUpdate = true;
      this.voxelPbrTexture.needsUpdate = true;
    }
    this.progress = Math.min(1, this.progress + 1 / (this.defs.length + 1));
  }

  /**
   * Put a graph-made tile in surface `id`'s layer: `colour` is RGBA (sRGB; its alpha is ignored), `maps` R = height, G = roughness, both
   * `size` square. The surface editor calls this live.
   */
  setTile(id: number, colour: ArrayLike<number>, maps: ArrayLike<number>): void {
    const layer = this.layerOf[id] ?? -1;
    if (layer < 0) return;
    const base = layer * this.size * this.size * 4;
    for (let i = 0; i < this.size * this.size; i++) {
      const o = base + i * 4;
      this.data[o] = colour[i * 4]!; this.data[o + 1] = colour[i * 4 + 1]!; this.data[o + 2] = colour[i * 4 + 2]!; this.data[o + 3] = maps[i * 4]!;
    }
    pbrFromHeight(maps, this.size, GROUND_RELIEF * this.size, this.pbr, base);
    this.texture.needsUpdate = true;
    this.pbrTexture.needsUpdate = true;
  }

  /** Tests: a fingerprint of surface `id`'s colour tile (changes when its look does). */
  checksum(id: number): number {
    const layer = this.layerOf[id] ?? -1;
    if (layer < 0) return -1;
    let sum = 0;
    const base = layer * this.size * this.size * 4;
    for (let i = 0; i < this.size * this.size * 4; i += 97) sum = (sum * 31 + this.data[base + i]!) % 1000000007;
    return sum;
  }

  dispose(): void {
    this.texture.dispose(); this.pbrTexture.dispose(); this.flatTexture.dispose(); this.voxelTexture.dispose(); this.voxelPbrTexture.dispose();
  }
}
