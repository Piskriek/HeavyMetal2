/**
 * @file apps/web/src/studio/viewport/layered-material-bridge.ts
 * STUDIO-44B (Opus Core): Live `@hm/texgraph` DataArrayTexture Slice Updater, Noise Atlas Builder,
 * and `@hm/matstack` Uniform & Mask-B&W Diagnostic Shader Compiler Bridge.
 *
 * Pure TypeScript, zero DOM globals, deterministic.
 */

import type {
  LayerSpec,
  MaterialFeatures,
  MaterialSpec,
  NoiseKind,
  NoiseSource,
  SurfaceSpec,
  TileSample,
  TileSource,
} from '@hm/matstack';
import {
  featureKey,
  features,
  FLAT_TILE,
  hexToLinear,
  MAX_LAYERS,
  MAX_MASK_INPUTS,
  resolveColour,
} from '@hm/matstack';
import type { EvaluatedTexture, TexGraph } from '@hm/texgraph';
import { evaluateGraph, TILE_LIBRARY } from '@hm/texgraph';

export interface StudioTileBank {
  /** Resolution of each square tile slice (e.g. 128 on Medium, 256 on High). */
  readonly size: number;
  /** Ordered list of tile IDs corresponding to slice indices 0..N-1 in `arrayData`. */
  readonly tileIds: readonly string[];
  /** Lookup from tile ID to its 0-based slice index in `arrayData`. */
  readonly sliceIndexById: ReadonlyMap<string, number>;
  /**
   * Contiguous RGBA byte buffer for `THREE.DataArrayTexture(arrayData, size, size, tileIds.length)`:
   * - R = grey (albedo luminance 0..255)
   * - G = height (0..255)
   * - B = roughness (0..255)
   * - A = 255
   */
  readonly arrayData: Uint8Array;
  /**
   * Contiguous RGBA byte buffer for the shared 4-channel noise atlas (`size * size * 4`):
   * - R = clouds
   * - G = cells
   * - B = speckle
   * - A = scratches
   */
  readonly noiseAtlasData: Uint8Array;
  /** CPU TileSource oracle matching `arrayData` texel-for-texel. */
  readonly tileSource: TileSource;
  /** CPU NoiseSource oracle matching `noiseAtlasData` texel-for-texel. */
  readonly noiseSource: NoiseSource;
  /** Monotonically increasing revision counter bumped whenever a tile graph is edited live in the Studio. */
  version: number;
}

const clampByte = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)));

function packEvaluatedTileIntoSlice(
  evaluated: EvaluatedTexture,
  size: number,
  target: Uint8Array,
  sliceIndex: number,
): void {
  const n = size * size;
  const base = sliceIndex * n * 4;
  const alb = evaluated.albedo;
  const hgt = evaluated.height;
  const rgh = evaluated.roughness;

  for (let i = 0; i < n; i += 1) {
    const grey = alb ? (alb[i * 3]! + alb[i * 3 + 1]! + alb[i * 3 + 2]!) / 3 : 0.5;
    const h = hgt ? hgt[i]! : 0.5;
    const r = rgh ? rgh[i]! : 0.5;
    const dst = base + i * 4;
    target[dst] = clampByte(grey);
    target[dst + 1] = clampByte(h);
    target[dst + 2] = clampByte(r);
    target[dst + 3] = 255;
  }
}

/**
 * Builds the complete `DataArrayTexture` byte buffer and 4-channel noise atlas from `@hm/texgraph`'s `TILE_LIBRARY`.
 */
export function createStudioTileBank(
  size = 128,
  customTiles: Readonly<Record<string, TexGraph>> = {},
): StudioTileBank {
  const mergedLibrary: Record<string, TexGraph> = { ...TILE_LIBRARY, ...customTiles };
  const tileIds = Object.keys(mergedLibrary).sort();
  const sliceIndexById = new Map<string, number>();
  tileIds.forEach((id, idx) => sliceIndexById.set(id, idx));

  const n = size * size;
  const arrayData = new Uint8Array(tileIds.length * n * 4);

  for (let idx = 0; idx < tileIds.length; idx += 1) {
    const id = tileIds[idx]!;
    const graph = mergedLibrary[id]!;
    const ev = evaluateGraph(graph, { size });
    packEvaluatedTileIntoSlice(ev, size, arrayData, idx);
  }

  // Build 4-channel RGBA noise atlas (R = clouds, G = cells, B = speckle, A = scratches)
  const noiseAtlasData = new Uint8Array(n * 4);
  const cloudsSlice = sliceIndexById.get('grime-clouds') ?? 0;
  const cellsSlice = sliceIndexById.get('cells') ?? 0;
  const speckleSlice = sliceIndexById.get('regolith-grain') ?? 0;
  const scratchesSlice = sliceIndexById.get('scratches') ?? 0;

  for (let i = 0; i < n; i += 1) {
    noiseAtlasData[i * 4] = arrayData[(cloudsSlice * n + i) * 4]!;
    noiseAtlasData[i * 4 + 1] = arrayData[(cellsSlice * n + i) * 4]!;
    noiseAtlasData[i * 4 + 2] = arrayData[(speckleSlice * n + i) * 4]!;
    noiseAtlasData[i * 4 + 3] = arrayData[(scratchesSlice * n + i) * 4]!;
  }

  const wrapCoord = (u: number): number => {
    const f = u - Math.floor(u);
    return Math.min(size - 1, Math.max(0, Math.floor(f * size)));
  };

  const tileSource: TileSource = {
    sample(tile: string, u: number, v: number): TileSample {
      const slice = sliceIndexById.get(tile);
      if (slice === undefined) return FLAT_TILE;
      const x = wrapCoord(u);
      const y = wrapCoord(v);
      const off = (slice * n + y * size + x) * 4;
      return {
        grey: arrayData[off]! / 255,
        height: arrayData[off + 1]! / 255,
        rough: arrayData[off + 2]! / 255,
      };
    },
  };

  const noiseChannelOf: Readonly<Record<NoiseKind, 0 | 1 | 2 | 3>> = {
    clouds: 0,
    cells: 1,
    speckle: 2,
    scratches: 3,
  };

  const noiseSource: NoiseSource = {
    sample(kind: NoiseKind, u: number, v: number): number {
      const ch = noiseChannelOf[kind];
      const x = wrapCoord(u);
      const y = wrapCoord(v);
      return noiseAtlasData[(y * size + x) * 4 + ch]! / 255;
    },
  };

  return {
    size,
    tileIds,
    sliceIndexById,
    arrayData,
    noiseAtlasData,
    tileSource,
    noiseSource,
    version: 1,
  };
}

/**
 * Re-evaluates a modified `TexGraph` in `< 15 ms` and updates its slice inside `bank.arrayData` in place.
 * Returns the byte range `{ sliceIndex, byteOffset, byteLength }` so the Three.js `DataArrayTexture` can upload
 * the updated slice immediately to the 3D machine in the Studio viewport.
 */
export function updateTileInBank(
  bank: StudioTileBank,
  tileId: string,
  graph: TexGraph,
  seed?: number,
): { readonly sliceIndex: number; readonly byteOffset: number; readonly byteLength: number } | null {
  const sliceIndex = bank.sliceIndexById.get(tileId);
  if (sliceIndex === undefined) return null;

  const ev = evaluateGraph(graph, { size: bank.size, ...(seed !== undefined ? { seed } : {}) });
  packEvaluatedTileIntoSlice(ev, bank.size, bank.arrayData, sliceIndex);
  bank.version += 1;

  const byteLength = bank.size * bank.size * 4;
  return {
    sliceIndex,
    byteOffset: sliceIndex * byteLength,
    byteLength,
  };
}

/**
 * Packed shader uniform representation of a `@hm/matstack` `MaterialSpec` (including `maskViewLayer` for B&W mask diagnostic mode).
 */
export interface CompiledMatstackUniforms {
  /** Program cache key from `@hm/matstack` `featureKey(features(spec))` plus mask view state. */
  readonly programCacheKey: string;
  readonly features: MaterialFeatures;
  /** -1 = normal Lit PBR view; 0..5 = render `layerWeight(layers[maskViewLayer])` as B&W grayscale on the 3D mesh. */
  readonly uMaskViewLayer: number;
  readonly uAge: number;
  readonly uBaseColour: readonly [number, number, number];
  /** [metal, rough, specular, tileIndex (-1 if none), tileScale, tileBump, tileRoughVar, tileColourVar] */
  readonly uBaseParams: Float32Array;
  /** Per-layer packed parameters (MAX_LAYERS = 6 rows of 12 floats). */
  readonly uLayerParams: Float32Array;
  /** Per-layer mask parameters (MAX_LAYERS = 6 rows of (3 + MAX_MASK_INPUTS * 6) floats). */
  readonly uLayerMasks: Float32Array;
}

function packSurfaceParams(
  s: SurfaceSpec,
  paint: readonly [string, string],
  bank: StudioTileBank,
): { rgb: readonly [number, number, number]; params: Float32Array } {
  const rgb = resolveColour(s.colour, paint);
  const tileIdx = s.tile ? (bank.sliceIndexById.get(s.tile.tile) ?? -1) : -1;
  const detailIdx = s.detail ? (bank.sliceIndexById.get(s.detail.tile) ?? -1) : -1;
  const emitRgb = s.emit ? hexToLinear(s.emit.colour) : ([0, 0, 0] as const);
  const emitInt = s.emit?.intensity ?? 0;

  return {
    rgb,
    params: new Float32Array([
      s.metal,
      s.rough,
      s.specular,
      tileIdx,
      s.tile?.scale ?? 1,
      s.tile?.bump ?? 0,
      s.tile?.roughVar ?? 0,
      s.tile?.colourVar ?? 0,
      detailIdx,
      s.detail?.scale ?? 0.1,
      s.detail?.bump ?? 0,
      s.coat?.amount ?? 0,
      s.coat?.rough ?? 0.1,
      s.fuzz?.amount ?? 0,
      s.aniso?.amount ?? 0,
      emitRgb[0] * emitInt,
    ]),
  };
}

/**
 * Compiles any `MaterialSpec` into flat typed-array uniforms for `apps/web/src/play/layered-material.ts`.
 */
export function compileMaterialUniforms(
  spec: MaterialSpec,
  bank: StudioTileBank,
  maskViewLayerIndex: number | null = null,
): CompiledMatstackUniforms {
  const feat = features(spec);
  const maskIdx =
    maskViewLayerIndex !== null && maskViewLayerIndex >= 0 && maskViewLayerIndex < spec.layers.length
      ? maskViewLayerIndex
      : -1;
  const programCacheKey = `${featureKey(feat)}|mv:${maskIdx}`;

  const basePacked = packSurfaceParams(spec.base, spec.paint, bank);
  const visibleLayers: LayerSpec[] = spec.layers.slice(0, MAX_LAYERS);

  const uLayerParams = new Float32Array(MAX_LAYERS * 16);
  const uLayerMasks = new Float32Array(MAX_LAYERS * (4 + MAX_MASK_INPUTS * 6));

  visibleLayers.forEach((layer, li) => {
    const lp = packSurfaceParams(layer.surface, spec.paint, bank);
    const pOff = li * 16;
    uLayerParams[pOff] = lp.rgb[0];
    uLayerParams[pOff + 1] = lp.rgb[1];
    uLayerParams[pOff + 2] = lp.rgb[2];
    uLayerParams[pOff + 3] = layer.visible ? layer.opacity : 0;
    uLayerParams[pOff + 4] = lp.params[0]!; // metal
    uLayerParams[pOff + 5] = lp.params[1]!; // rough
    uLayerParams[pOff + 6] = lp.params[2]!; // specular
    uLayerParams[pOff + 7] = lp.params[3]!; // tileIdx
    uLayerParams[pOff + 8] = lp.params[4]!; // tileScale
    uLayerParams[pOff + 9] = lp.params[5]!; // tileBump
    uLayerParams[pOff + 10] = layer.heightBlend;
    uLayerParams[pOff + 11] = layer.weathering ? 1 : 0;
    // Bitmask of written channel groups
    let writesMask = 0;
    const groups = ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'fuzz', 'aniso', 'film', 'emit'] as const;
    groups.forEach((g, bit) => {
      if (layer.writes.includes(g)) writesMask |= 1 << bit;
    });
    uLayerParams[pOff + 12] = writesMask;

    const mOff = li * (4 + MAX_MASK_INPUTS * 6);
    uLayerMasks[mOff] = layer.mask.balance;
    uLayerMasks[mOff + 1] = layer.mask.contrast;
    uLayerMasks[mOff + 2] = layer.mask.invert ? 1 : 0;
    uLayerMasks[mOff + 3] = Math.min(MAX_MASK_INPUTS, layer.mask.inputs.length);
  });

  return {
    programCacheKey,
    features: feat,
    uMaskViewLayer: maskIdx,
    uAge: spec.age,
    uBaseColour: basePacked.rgb,
    uBaseParams: basePacked.params,
    uLayerParams,
    uLayerMasks,
  };
}
