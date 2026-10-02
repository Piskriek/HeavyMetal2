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
  /** Metres per repeat of the tile. */
  readonly repeat: number;
  readonly roughness: number;
  readonly height: HeightRecipe;
  /** Shown until the tile has loaded. */
  readonly fallback: string;
  /** The flat (voxel) skin: up to FLAT_COLORS hand-picked tones. Each half-metre block of the ground takes one of them, so no texture file is involved. */
  readonly flat?: readonly string[];
  /** Light the surface gives off (lava): 0 or left out for none. The bright tones of its palette glow, the dark ones stay dark. */
  readonly glow?: number;
}

export const LAYER_SIZE = 256;
export const FLAT_COLORS = 5;
export const SURFACE_SLOTS = 256;

export const recipe = (lum: number, sat = 0, green = 0, contrast = 1): HeightRecipe => ({ lum, sat, green, contrast });

/** Height of a tile at each texel, 0..1: what stands "high" differs per surface, stretched to the tile's own 2nd..98th percentile. */
export function writeTileHeight(rgba: Uint8ClampedArray | Uint8Array, r: HeightRecipe): void {
  const n = rgba.length / 4;
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) {
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
  /** id -> layer (or -1), in the shape the shader wants. */
  readonly layerOf = new Float32Array(SURFACE_SLOTS).fill(-1);
  /** (metres per repeat, roughness, height contrast, glow) per layer. */
  readonly params: THREE.Vector4[];
  readonly ready: Promise<void>;
  progress = 0;
  private readonly data: Uint8Array;
  private readonly pbr: Uint8Array;

  constructor(readonly defs: readonly SurfaceDef[], assetUrl: (path: string) => string = (p) => p) {
    const layers = Math.max(1, defs.length);
    this.data = new Uint8Array(LAYER_SIZE * LAYER_SIZE * 4 * layers);
    this.pbr = new Uint8Array(LAYER_SIZE * LAYER_SIZE * 4 * layers);
    defs.forEach((d, layer) => {
      this.layerOf[d.id] = layer;
      const [r, g, b] = hexToRgb(d.fallback);
      const base = layer * LAYER_SIZE * LAYER_SIZE * 4;
      for (let i = 0; i < LAYER_SIZE * LAYER_SIZE; i++) {
        const o = base + i * 4;
        this.data[o] = r; this.data[o + 1] = g; this.data[o + 2] = b; this.data[o + 3] = 128;
        this.pbr[o] = 128; this.pbr[o + 1] = 128; this.pbr[o + 2] = 200; this.pbr[o + 3] = 0;
      }
    });
    this.params = defs.map((d) => new THREE.Vector4(d.repeat, d.roughness, d.height.contrast, d.glow ?? 0));
    this.flatTexture = makeFlatTexture(defs);
    this.texture = this.makeArray(this.data, layers, true);
    this.pbrTexture = this.makeArray(this.pbr, layers, false);
    this.ready = typeof document === 'undefined' ? Promise.resolve() : this.load(assetUrl);
  }

  private makeArray(data: Uint8Array, layers: number, color: boolean): THREE.DataArrayTexture {
    const t = new THREE.DataArrayTexture(data, LAYER_SIZE, LAYER_SIZE, layers);
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = color ? 8 : 4;
    t.needsUpdate = true;
    return t;
  }

  private pixels(img: ImageBitmap | HTMLImageElement): Uint8ClampedArray | null {
    const c = document.createElement('canvas');
    c.width = c.height = LAYER_SIZE;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, LAYER_SIZE, LAYER_SIZE);
    return ctx.getImageData(0, 0, LAYER_SIZE, LAYER_SIZE).data;
  }

  private async load(assetUrl: (path: string) => string): Promise<void> {
    let done = 0;
    await Promise.all(this.defs.map(async (d, layer) => {
      const [img, pbrImg] = await Promise.all([decode(assetUrl(d.url)), d.pbrUrl ? decode(assetUrl(d.pbrUrl)) : Promise.resolve(null)]);
      const base = layer * LAYER_SIZE * LAYER_SIZE * 4;
      if (img) {
        const px = this.pixels(img);
        if (px) { writeTileHeight(px, d.height); this.data.set(px, base); this.texture.needsUpdate = true; }
      }
      if (pbrImg) {
        const px = this.pixels(pbrImg);
        if (px) { for (let i = 3; i < px.length; i += 4) px[i] = 255; this.pbr.set(px, base); this.pbrTexture.needsUpdate = true; }
      }
      this.progress = ++done / this.defs.length;
    }));
  }

  dispose(): void { this.texture.dispose(); this.pbrTexture.dispose(); this.flatTexture.dispose(); }
}
