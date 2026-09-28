/**
 * NewRoads · Phase 1.2 — `sampleSurface(id)` needs pixels for every ID. This is where they come from.
 *
 * Q2 answer: the road tiles are painted PNGs, so a surface is normally one of the textures the
 * renderer already loads. Three surfaces the plan needs (asphalt, gravel, concrete) have no PNG, so
 * they are generated once on a canvas — the "procedural" branch of §1.2, behind the same `sampleSurface`.
 *
 * Everything lands in one 2048² canvas atlas (4×4 cells of 512²) plus a 16×1 parameter texture
 * (roughness, wet response). One atlas works on WebGL1 and WebGL2 alike; the plan's texture-array with
 * proper mips is Phase 5 polish (the WebGL2 `DataArrayTexture` path in `ball-texture-pool.ts` is the
 * template when that day comes). Cells are padded so bilinear taps never bleed into a neighbour.
 *
 * Tiles arrive asynchronously (the renderer's `TextureLoader` is still decoding when the first frame
 * renders), so `update()` fills cells as their images become available and reports completion.
 */
import * as THREE from 'three';
import { ATLAS_SURFACES, SURFACE_SLOTS, SURFACE_TABLE, type SurfaceDefinition } from './surface-table';

export const ATLAS_GRID = 4;
export const ATLAS_TILE = 512;
export const ATLAS_SIZE = ATLAS_GRID * ATLAS_TILE;
/**
 * Padding, as a fraction of a cell, on every side. Each tile is drawn into the inner square and wrapped
 * into the padding (its own opposite edge), so a tap near the edge of a tile reads the tile's continuation
 * and the mip chain can blend inside a cell without bleeding into its neighbour. 32 of 512 pixels holds
 * up to mip 4; the samplers clamp their gradients there (`surface-shader.ts`).
 */
export const ATLAS_PAD = 32 / ATLAS_TILE;
/** Pixels of one tile's repeat inside its cell. */
export const ATLAS_INNER = ATLAS_TILE - 2 * 32;

export type SurfaceTexKey = Extract<SurfaceDefinition['source'], { kind: 'texture' }>['texKey'];
export type SurfaceSources = Partial<Record<SurfaceTexKey, THREE.Texture | null | undefined>>;

function imageReady(texture: THREE.Texture | null | undefined): CanvasImageSource | null {
  const image = texture?.image as (HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined);
  if (!image) return null;
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
    return image.complete && image.naturalWidth > 0 ? image : null;
  }
  return (image as { width?: number }).width ? image : null;
}

/* -----------------------------------------------------------------------------
   Procedural tiles. Seeded, so every load paints the same asphalt.
   -------------------------------------------------------------------------- */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wrapping speckle: draws each fleck at its position and at the tile-wrapped copies, so the tile is seamless. */
function fleck(c: CanvasRenderingContext2D, size: number, x: number, y: number, r: number, style: string) {
  c.fillStyle = style;
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      const px = x + ox, py = y + oy;
      if (px < -r || py < -r || px > size + r || py > size + r) continue;
      c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
    }
  }
}

export function drawAsphalt(c: CanvasRenderingContext2D, size: number) {
  const rnd = seeded(0xa5fa17);
  c.fillStyle = '#3a3a3c'; c.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 14; i++) {
    const v = 40 + Math.floor(rnd() * 50);
    fleck(c, size, rnd() * size, rnd() * size, 0.6 + rnd() * 1.6, `rgba(${v},${v},${v + 2},${0.35 + rnd() * 0.4})`);
  }
  for (let i = 0; i < size * 0.5; i++) {
    fleck(c, size, rnd() * size, rnd() * size, 0.8 + rnd() * 1.2, `rgba(190,185,175,${0.08 + rnd() * 0.12})`);
  }
  // Faint patch repairs: broad low-contrast rectangles.
  for (let i = 0; i < 3; i++) {
    c.fillStyle = `rgba(${20 + i * 6},${20 + i * 6},${22 + i * 6},0.18)`;
    c.fillRect(rnd() * size, rnd() * size, size * (0.2 + rnd() * 0.3), size * (0.1 + rnd() * 0.2));
  }
}

export function drawGravel(c: CanvasRenderingContext2D, size: number) {
  const rnd = seeded(0x6ea7e1);
  c.fillStyle = '#8b8172'; c.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 6; i++) {
    const v = 95 + Math.floor(rnd() * 90);
    const warm = Math.floor(rnd() * 18);
    fleck(c, size, rnd() * size, rnd() * size, 1.2 + rnd() * 3.2, `rgba(${v + warm},${v},${v - warm},${0.55 + rnd() * 0.4})`);
  }
  for (let i = 0; i < size * 0.8; i++) {
    fleck(c, size, rnd() * size, rnd() * size, 2 + rnd() * 4, `rgba(60,55,48,${0.15 + rnd() * 0.2})`);
  }
}

export function drawConcrete(c: CanvasRenderingContext2D, size: number) {
  const rnd = seeded(0xc0c8e7e);
  c.fillStyle = '#9c9a93'; c.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 5; i++) {
    const v = 130 + Math.floor(rnd() * 50);
    fleck(c, size, rnd() * size, rnd() * size, 0.5 + rnd() * 1.4, `rgba(${v},${v},${v - 4},${0.18 + rnd() * 0.25})`);
  }
  // Panel seams: two per tile in each direction so a 480-unit repeat reads as ~3.5 m slabs.
  c.strokeStyle = 'rgba(55,52,48,0.55)'; c.lineWidth = 3;
  for (const t of [0, 0.5]) {
    c.beginPath(); c.moveTo(0, t * size + 1.5); c.lineTo(size, t * size + 1.5); c.stroke();
    c.beginPath(); c.moveTo(t * size + 1.5, 0); c.lineTo(t * size + 1.5, size); c.stroke();
  }
  c.strokeStyle = 'rgba(220,216,205,0.25)'; c.lineWidth = 1.5;
  for (const t of [0, 0.5]) {
    c.beginPath(); c.moveTo(0, t * size + 4.5); c.lineTo(size, t * size + 4.5); c.stroke();
    c.beginPath(); c.moveTo(t * size + 4.5, 0); c.lineTo(t * size + 4.5, size); c.stroke();
  }
}

/** The atlas stand-in for the island's cracked dirt (the island ground draws its own, procedurally). */
export function drawCracked(c: CanvasRenderingContext2D, size: number) {
  const rnd = seeded(0xc4ac3d);
  c.fillStyle = '#b9a88a'; c.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 3; i++) {
    const v = 150 + Math.floor(rnd() * 50);
    fleck(c, size, rnd() * size, rnd() * size, 1 + rnd() * 3, `rgba(${v},${v - 14},${v - 34},${0.2 + rnd() * 0.25})`);
  }
  c.strokeStyle = 'rgba(90,74,54,0.5)'; c.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    let x = rnd() * size, y = rnd() * size;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * size * 0.18; y += (rnd() - 0.5) * size * 0.18; c.lineTo(x, y); }
    c.stroke();
  }
}

const GENERATORS = { asphalt: drawAsphalt, gravel: drawGravel, concrete: drawConcrete, cracked: drawCracked } as const;

/* -----------------------------------------------------------------------------
   The atlas
   -------------------------------------------------------------------------- */
export class SurfaceAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  /** 16×1 RGBA: r = roughness, g = wet response. Indexed by ID in the shader (no dynamic uniform arrays on WebGL1). */
  readonly params: THREE.DataTexture;
  /** IDs still waiting for their PNG to decode. */
  readonly pending = new Set<number>();
  private readonly context: CanvasRenderingContext2D;

  constructor(private readonly sources: SurfaceSources) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = ATLAS_SIZE;
    this.context = this.canvas.getContext('2d')!;
    // A cell nobody has filled yet reads as a loud magenta: a missing surface is a bug, not a mood.
    this.context.fillStyle = '#ff00ff';
    this.context.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
    // Mipmapped: the samplers pass their own gradients (textureGrad), so distant paint filters instead
    // of shimmering. The padding keeps each cell's mips to itself.
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;
    this.texture.anisotropy = 4;

    const params = new Uint8Array(SURFACE_SLOTS * 4);
    for (const def of SURFACE_TABLE) {
      if (def.id >= SURFACE_SLOTS) continue;
      params[def.id * 4] = Math.round(def.roughness * 255);
      params[def.id * 4 + 1] = Math.round(def.wetResponse * 255);
      params[def.id * 4 + 3] = 255;
    }
    this.params = new THREE.DataTexture(params, SURFACE_SLOTS, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.params.minFilter = this.params.magFilter = THREE.NearestFilter;
    this.params.needsUpdate = true;

    for (const def of SURFACE_TABLE) {
      if (def.id >= ATLAS_SURFACES) continue;
      if (def.source.kind === 'procedural') this.drawCell(def.id, GENERATORS[def.source.generator]);
      else if (def.source.kind === 'island') { const swatch = def.swatch; this.drawCell(def.id, (c, size) => { c.fillStyle = swatch; c.fillRect(0, 0, size, size); }); }
      else this.pending.add(def.id);
    }
    this.update();
  }

  get complete(): boolean { return this.pending.size === 0; }

  /**
   * Resolves once every cell is filled (the PNG sources decode after construction), polling on a timer so
   * it also settles in a hidden tab. Gives up after `timeoutMs` and resolves anyway: a missing tile shows
   * magenta, it never holds the loading bar forever.
   */
  whenComplete(timeoutMs = 20000): Promise<void> {
    const t0 = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        this.update();
        if (this.complete || Date.now() - t0 > timeoutMs) resolve();
        else setTimeout(tick, 50);
      };
      tick();
    });
  }

  /** Fill any cell whose PNG has decoded since the last call. Returns true when something was drawn. */
  update(): boolean {
    let drawn = false;
    for (const id of Array.from(this.pending)) {
      const def = SURFACE_TABLE[id];
      if (def.source.kind !== 'texture') { this.pending.delete(id); continue; }
      const image = imageReady(this.sources[def.source.texKey]);
      if (!image) continue;
      this.drawWrapped(id, image);
      this.pending.delete(id);
      drawn = true;
    }
    if (drawn) this.texture.needsUpdate = true;
    return drawn;
  }

  cellOrigin(id: number) {
    return { x: (id % ATLAS_GRID) * ATLAS_TILE, y: Math.floor(id / ATLAS_GRID) * ATLAS_TILE };
  }

  private drawCell(id: number, draw: (c: CanvasRenderingContext2D, size: number) => void) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = ATLAS_TILE;
    draw(tile.getContext('2d')!, ATLAS_TILE);
    this.drawWrapped(id, tile);
    this.texture.needsUpdate = true;
  }

  /** One tile into its cell: scaled to the inner square, with its wrapped neighbours filling the padding. */
  private drawWrapped(id: number, image: CanvasImageSource) {
    const { x, y } = this.cellOrigin(id);
    const pad = (ATLAS_TILE - ATLAS_INNER) / 2;
    this.context.save();
    this.context.beginPath();
    this.context.rect(x, y, ATLAS_TILE, ATLAS_TILE);
    this.context.clip();
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) this.context.drawImage(image, x + pad + ox * ATLAS_INNER, y + pad + oy * ATLAS_INNER, ATLAS_INNER, ATLAS_INNER);
    }
    this.context.restore();
  }

  /** A small picture of one surface for a palette button (browser only). */
  thumbnail(id: number, size = 48): string {
    const { x, y } = this.cellOrigin(id);
    const pad = (ATLAS_TILE - ATLAS_INNER) / 2;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d')?.drawImage(this.canvas, x + pad, y + pad, ATLAS_INNER / 2, ATLAS_INNER / 2, 0, 0, size, size);
    return c.toDataURL('image/png');
  }

  dispose() {
    this.texture.dispose();
    this.params.dispose();
    this.pending.clear();
  }
}
