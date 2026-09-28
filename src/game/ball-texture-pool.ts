/**
 * MP-T03 — one texture array for every ball on the grid.
 *
 * M7 drew the ball cores with one instanced mesh per distinct painted texture (13 draws at 100
 * racers; up to 100 once every ball is customised). Here every design is a *layer* of one
 * `DataArrayTexture`, each core instance carries its layer index, and a small patch to the Lambert
 * shader samples `texture(uBallArray, vec3(uv, layer))`: all ball cores in one draw call.
 *
 * Layers are reference-counted by key (a bake key or a source canvas) and reused when freed, so
 * racers joining or leaving never reallocate the array. 100 layers of 256 × 128 RGBA is 12.5 MB.
 * WebGL1 has no texture arrays: the renderer keeps M7's per-texture batches there.
 */
import * as THREE from 'three';

export const BALL_LAYER_WIDTH = 256;
export const BALL_LAYER_HEIGHT = 128;

export class BallTexturePool {
  readonly texture: THREE.DataArrayTexture;
  private readonly data: Uint8Array;
  private readonly layers = new Map<unknown, { layer: number; refs: number }>();
  private readonly free: number[] = [];

  constructor(readonly capacity = 128, readonly width = BALL_LAYER_WIDTH, readonly height = BALL_LAYER_HEIGHT) {
    this.data = new Uint8Array(width * height * 4 * capacity).fill(255);
    this.texture = new THREE.DataArrayTexture(this.data, width, height, capacity);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.RepeatWrapping;
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);
  }

  /** Bytes the array occupies on the GPU (no mipmaps). */
  get bytes(): number { return this.data.byteLength; }
  get used(): number { return this.layers.size; }

  /** The layer for `key`, filling it from `pixels` (width × height RGBA) the first time. Null when full. */
  acquire(key: unknown, pixels: () => Uint8ClampedArray | Uint8Array | null): number | null {
    const existing = this.layers.get(key);
    if (existing) { existing.refs++; return existing.layer; }
    const layer = this.free.pop();
    if (layer === undefined) return null;
    const source = pixels();
    const size = this.width * this.height * 4;
    if (source && source.length === size) this.data.set(source, layer * size);
    else this.data.fill(255, layer * size, (layer + 1) * size);
    this.texture.addLayerUpdate(layer);
    this.texture.needsUpdate = true;
    this.layers.set(key, { layer, refs: 1 });
    return layer;
  }

  /** Drops one use of `key`; its layer is free for the next design once nobody wears it. */
  release(key: unknown): void {
    const entry = this.layers.get(key);
    if (!entry) return;
    if (--entry.refs > 0) return;
    this.layers.delete(key);
    this.free.push(entry.layer);
  }

  dispose(): void { this.texture.dispose(); this.layers.clear(); }
}

/** Reads a canvas-like image into a layer-sized RGBA buffer (browser only; null elsewhere). */
export function layerPixels(image: CanvasImageSource, width = BALL_LAYER_WIDTH, height = BALL_LAYER_HEIGHT): Uint8ClampedArray | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const paint = canvas.getContext('2d');
  if (!paint) return null;
  // Flip rows: the array texture has no flipY, so row 0 must be the image's bottom.
  paint.translate(0, height); paint.scale(1, -1);
  paint.drawImage(image, 0, 0, width, height);
  return paint.getImageData(0, 0, width, height).data;
}

/**
 * The ball core material: Lambert, but its colour comes from the pool's array at the instance's
 * `aBallLayer`. One material (and one draw) for every ball.
 */
export function arrayBallMaterial(pool: BallTexturePool): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBallArray = { value: pool.texture };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBallLayer;\nvarying float vBallLayer;\nvarying vec2 vBallUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvBallLayer = aBallLayer;\nvBallUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nprecision highp sampler2DArray;\nuniform sampler2DArray uBallArray;\nvarying float vBallLayer;\nvarying vec2 vBallUv;')
      .replace('#include <map_fragment>', 'diffuseColor *= texture(uBallArray, vec3(vBallUv, floor(vBallLayer + 0.5)));');
  };
  material.customProgramCacheKey = () => 'ball-array-core';
  return material;
}
