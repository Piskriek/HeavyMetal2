/**
 * Island auto paint off the main thread (see island-autopaint.ts): the editor keeps running and shows a
 * progress bar while the island is painted. The terrain is sent once; each paint request is a recipe.
 */
import { paintIsland, upsampleMask, type IslandRecipe } from './island-autopaint';
import type { IslandTerrain } from './island-terrain';

type Request = { type: 'terrain'; terrain: IslandTerrain } | { type: 'paint'; id: number; recipe: IslandRecipe; upsample: number };

const post = (message: unknown, transfer?: Transferable[]) => (self as unknown as { postMessage(m: unknown, t?: Transferable[]): void }).postMessage(message, transfer ?? []);
let terrain: IslandTerrain | null = null;

self.onmessage = (event: MessageEvent<Request>) => {
  const m = event.data;
  if (m.type === 'terrain') { terrain = m.terrain; return; }
  if (!terrain) { post({ id: m.id, error: 'no terrain yet' }); return; }
  try {
    let last = 0;
    const result = paintIsland(terrain, m.recipe, (t) => { if (t - last >= 0.04 || t >= 1) { last = t; post({ id: m.id, progress: t }); } });
    // Upsampled here too, so the main thread only lays it under the brush.
    const mask = m.upsample > 1 ? upsampleMask(result.mask, terrain.res, m.upsample) : result.mask;
    post({ id: m.id, mask, coverage: result.coverage, ms: result.ms }, [mask.buffer]);
  } catch (error) {
    post({ id: m.id, error: (error as Error).message });
  }
};
