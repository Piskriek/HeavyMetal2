/**
 * The material noise atlas and tile sampler (plan 41 §4.5), as pure data so every consumer reads the same bytes.
 *
 * `@hm/matstack` takes a `NoiseSource` and a `TileSource`; the renderer (apps/web/src/play/layered-material.ts) has to hand it the
 * same values the shader's texture fetches return, and the Bench, the coverage report, the review sheets and (later) an agent's
 * `studio.material.coverage` all need them without a WebGL context. This module is that one source:
 *
 *  - `MATERIAL_NOISE_GRAPHS`: the four noises the masks name (`clouds`, `cells`, `speckle`, `scratches`) as texgraph graphs. They are
 *    baked once into a 256 px RGBA atlas (one channel each), which is what the shader samples and what `atlasNoiseSource` reads.
 *  - `atlasTileSource(graphs, size)`: any tile graph as the three numbers a surface needs — grey (luminance of the albedo), height and
 *    roughness — bilinearly sampled with wrapping, exactly as `cpuTiles` did inside the renderer.
 *
 * Everything here is deterministic and cached; no DOM, clock or randomness.
 */

import { evaluateGraph, type TexGraph } from './index';
import { TILE_LIBRARY } from './tile-library';

/** The four mask noises, in the atlas's channel order. */
export type MaterialNoiseKind = 'clouds' | 'cells' | 'speckle' | 'scratches';

export const NOISE_ATLAS_ORDER: readonly MaterialNoiseKind[] = Object.freeze(['clouds', 'cells', 'speckle', 'scratches']);

/** The atlas channel each noise reads (the shader's uniform takes these). */
export const NOISE_ATLAS_INDEX: Readonly<Record<MaterialNoiseKind, number>> = Object.freeze({ clouds: 0, cells: 1, speckle: 2, scratches: 3 });

/** Pixels across the noise atlas (the shader's DataTexture and the CPU sampler share it). */
export const NOISE_ATLAS_SIZE = 256;

/** The four noises as texgraph graphs (height output), all periodic on the tile. */
export const MATERIAL_NOISE_GRAPHS: readonly TexGraph[] = Object.freeze([
  { id: 'ms-clouds', name: 'Clouds', nodes: [{ id: 'n', type: 'noise', scale: 4, octaves: 5, gain: 0.5, seed: 11 }], out: { height: 'n' } },
  {
    id: 'ms-cells',
    name: 'Cells',
    nodes: [
      { id: 'c', type: 'cellular', scale: 7, jitter: 0.9, mode: 'f1', seed: 23 },
      { id: 'i', type: 'invert', in: 'c' },
    ],
    out: { height: 'i' },
  },
  // fine blobs, not single texels: thresholded masks would glitter
  { id: 'ms-speckle', name: 'Speckle', nodes: [{ id: 'g', type: 'noise', scale: 32, octaves: 2, gain: 0.45, seed: 37 }], out: { height: 'g' } },
  {
    id: 'ms-scratches',
    name: 'Scratches',
    nodes: [
      { id: 's', type: 'stripes', count: 23, softness: 0.08, vertical: false, tilt: 5 },
      { id: 'f', type: 'noise', scale: 3, octaves: 2, gain: 0.5, seed: 43 },
      { id: 'w', type: 'warp', in: 's', warp: 'f', amount: 0.04 },
      { id: 'n', type: 'noise', scale: 6, octaves: 2, gain: 0.5, seed: 41 },
      { id: 'm', type: 'blend', a: 'w', b: 'n', mode: 'multiply', amount: 1 },
      { id: 'l', type: 'levels', in: 'm', inLow: 0.35, inHigh: 0.9, gamma: 1, outLow: 0, outHigh: 1 },
    ],
    out: { height: 'l' },
  },
] as TexGraph[]);

let atlasBytes: Uint8Array | null = null;

/** The atlas as RGBA bytes, built once: R clouds, G cells, B speckle, A scratches. */
export function noiseAtlasBytes(): Uint8Array {
  if (atlasBytes) return atlasBytes;
  const out = new Uint8Array(NOISE_ATLAS_SIZE * NOISE_ATLAS_SIZE * 4);
  MATERIAL_NOISE_GRAPHS.forEach((graph, channel) => {
    const height = evaluateGraph(graph, { size: NOISE_ATLAS_SIZE }).height;
    for (let i = 0; i < NOISE_ATLAS_SIZE * NOISE_ATLAS_SIZE; i += 1) {
      out[i * 4 + channel] = Math.round(255 * Math.min(1, Math.max(0, height?.[i] ?? 0.5)));
    }
  });
  atlasBytes = out;
  return out;
}

/** Bilinear, wrapping, on bytes laid out RGBA: what a texture fetch at full resolution returns. */
export function bilinearChannel(bytes: Uint8Array, size: number, channel: number, u: number, v: number): number {
  const x = (u - Math.floor(u)) * size - 0.5, y = (v - Math.floor(v)) * size - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (xi: number, yi: number): number => {
    const xx = ((xi % size) + size) % size, yy = ((yi % size) + size) % size;
    return bytes[(yy * size + xx) * 4 + channel]! / 255;
  };
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
  return a + (b - a) * fy;
}

/** The atlas for the CPU: what matstack's `NoiseSource` wants, sampled with wrapping. */
export function atlasNoiseSource(): { sample(kind: MaterialNoiseKind, u: number, v: number): number } {
  return { sample: (kind, u, v) => bilinearChannel(noiseAtlasBytes(), NOISE_ATLAS_SIZE, NOISE_ATLAS_INDEX[kind], u, v) };
}

/** A tile's three numbers at a point, each 0 to 1: matstack's `TileSample`. */
export interface AtlasTileSample {
  readonly grey: number;
  readonly height: number;
  readonly rough: number;
}

/** What an unknown tile reads as (matstack's FLAT_TILE). */
export const FLAT_TILE_SAMPLE: AtlasTileSample = Object.freeze({ grey: 0.5, height: 0.5, rough: 0.5 });

/** Pixels across a CPU tile: what rank 1 draws. */
export const TILE_ATLAS_SIZE = 128;

const byteCache = new Map<string, Uint8Array | null>();

/**
 * A tile as RGBA bytes (R grey, G height, B roughness, A 255), or null when no graph has this id. Cached per graph id and size:
 * the renderer uploads these bytes as a DataArrayTexture, and the CPU sampler reads the same ones.
 */
export function tileBytesAt(graphs: Readonly<Record<string, TexGraph>>, id: string, size: number): Uint8Array | null {
  const key = `${id}|${size}`;
  const hit = byteCache.get(key);
  if (hit !== undefined) return hit;
  const graph = graphs[id];
  let out: Uint8Array | null = null;
  if (graph) {
    const texture = evaluateGraph(graph, { size });
    out = new Uint8Array(size * size * 4);
    const byte = (x: number): number => Math.round(255 * Math.min(1, Math.max(0, x)));
    for (let i = 0; i < size * size; i += 1) {
      const grey = texture.albedo ? 0.2126 * texture.albedo[i * 3]! + 0.7152 * texture.albedo[i * 3 + 1]! + 0.0722 * texture.albedo[i * 3 + 2]! : 0.5;
      out[i * 4] = byte(grey);
      out[i * 4 + 1] = byte(texture.height?.[i] ?? 0.5);
      out[i * 4 + 2] = byte(texture.roughness?.[i] ?? 0.5);
      out[i * 4 + 3] = 255;
    }
  }
  byteCache.set(key, out);
  return out;
}

/** Forgets every cached tile (after registering new graphs, or in a test). */
export function clearTileBytesCache(): void {
  byteCache.clear();
}

/** A tile sampler over `graphs` (the tile library by default), ready for matstack's `TileSource`. */
export function atlasTileSource(
  graphs: Readonly<Record<string, TexGraph>> = TILE_LIBRARY,
  size = TILE_ATLAS_SIZE,
): { sample(tile: string, u: number, v: number): AtlasTileSample } {
  return {
    sample(tile, u, v) {
      const bytes = tileBytesAt(graphs, tile, size);
      if (!bytes) return FLAT_TILE_SAMPLE;
      return {
        grey: bilinearChannel(bytes, size, 0, u, v),
        height: bilinearChannel(bytes, size, 1, u, v),
        rough: bilinearChannel(bytes, size, 2, u, v),
      };
    },
  };
}
