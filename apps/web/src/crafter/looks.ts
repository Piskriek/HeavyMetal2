// What the moon looks like at a stage with a cartridge slotted: the texture (baked from the cartridge's graph, adapted to the
// stage's budget on this graphics tier) and everything else the scene needs (facet size, shading, water, sky). Pure, no DOM.
import { evaluateGraph, litPreview, tileBytes } from '@hm/texgraph';
import { adaptGraph, deriveBudget, meshPolicyFor, normalised, toEvaluateOptions, type Cartridge, type DeviceProfile, type RenderBudget, type Stage } from '@hm/fidelity';
import { MAIN_CRATER } from './moon';
import { STAGE_STARTS, stateAt } from './progress';

/** One stage's look, ready for the GPU. */
export interface StageLook {
  /** Unique per cartridge, stage and tier: the wave queue's key. */
  readonly key: string;
  readonly stage: Stage;
  readonly cartridgeId: string;
  readonly budget: RenderBudget;
  readonly size: number;
  /** RGBA bytes, sRGB albedo. */
  readonly colour: Uint8Array;
  /** RGBA bytes: height, roughness, normal x, normal y (0.5 + 0.5 n). */
  readonly maps: Uint8Array;
  /** Small textures are drawn as crisp pixels, not blurred. */
  readonly pixelated: boolean;
  /** Low-poly facet size in metres (the mesh policy's cell). */
  readonly facetCell: number;
  /** 0 hard facets to 1 smooth shading. */
  readonly smooth: number;
  /** How strongly the texture's normals bend the light (0 when this tier or stage has none). */
  readonly normalStrength: number;
  /** Colour steps per channel, 0 for full colour. */
  readonly levels: number;
  /** The water surface's height (metres), far below the ground when the world is dry. */
  readonly water: number;
  /** 0 the black void with stars to 1 a full blue sky. */
  readonly atmosphere: number;
  /** 0..1: how much light there is to see by (sun, sky, shine). */
  readonly light: number;
  /** Metres one texture tile covers: the low stages have big pixels on the ground, the high ones fine detail. */
  readonly tile: number;
}

/** The progress that stands for a whole stage: the middle of its stretch of p. */
export function stageMiddle(stage: Stage): number {
  const start = STAGE_STARTS[stage - 1]!, end = stage < 6 ? STAGE_STARTS[stage]! : 1;
  return (start + end) / 2;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Water rises from the main crater's floor towards its rim as the world gets wetter. */
export function waterLevel(wetness: number): number {
  if (wetness <= 0.01) return -99;
  const floor = -MAIN_CRATER.depth, rim = MAIN_CRATER.rim * 0.6;
  return floor + 0.4 + (rim - floor - 0.4) * Math.min(1, wetness * 0.92);
}

/** Bakes a cartridge's look for a stage on a tier. `gridSpacing` keeps facets no finer than the mesh. */
export function bakeLook(cart: Cartridge, stage: Stage, device: DeviceProfile, gridSpacing: number): StageLook {
  const state = stateAt(stageMiddle(stage));
  const budget = deriveBudget(state, device);
  const graph = adaptGraph(cart.graph, budget);
  const t = evaluateGraph(graph, toEvaluateOptions(budget, 1));
  const { colour } = tileBytes(t);
  const maps = new Uint8Array(t.size * t.size * 4);
  for (let i = 0; i < t.size * t.size; i++) {
    maps[i * 4] = Math.round(255 * (t.height?.[i] ?? 0.5));
    maps[i * 4 + 1] = Math.round(255 * (t.roughness?.[i] ?? 0.85));
    maps[i * 4 + 2] = Math.round(255 * (t.normal?.[i * 2] ?? 0.5));
    maps[i * 4 + 3] = Math.round(255 * (t.normal?.[i * 2 + 1] ?? 0.5));
  }
  const policy = meshPolicyFor(state, budget);
  const n = normalised(state);
  return {
    key: `${cart.id}@${stage}@${device.id}`,
    stage, cartridgeId: cart.id, budget, size: t.size, colour, maps,
    pixelated: t.size <= 32,
    facetCell: Math.max(gridSpacing, policy.cellSize),
    smooth: policy.mode === 'DUAL' ? 1 : policy.mode === 'CHAMFER' ? 0.25 : 0,
    normalStrength: budget.normal ? budget.relief : 0,
    levels: budget.paletteLevels > 0 ? budget.paletteLevels : 0,
    water: waterLevel(budget.wetness),
    atmosphere: smoothstep(0.12, 0.8, n.lx),
    light: n.lx,
    tile: stage === 1 ? 16 : stage === 2 ? 12 : 8,
  };
}

/** A small lit picture of a cartridge (as authored, not adapted), RGBA bytes, for its button in the cartridge strip. */
export function cartridgeThumb(cart: Cartridge, size = 40): Uint8ClampedArray {
  return litPreview(evaluateGraph(cart.graph, { size, seed: 1, relief: size * 0.1 }));
}
