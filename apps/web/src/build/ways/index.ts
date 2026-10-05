import { ANIMATE_WAYS } from './animate';
import { CAMERA_WAYS } from './camera';
import { CHARACTERS_WAYS } from './characters';
import { EFFECTS_WAYS } from './effects';
import { LIGHTS_WAYS } from './lights';
import { LOGIC_WAYS } from './logic';
import { PHYSICS_WAYS } from './physics';
import { SELECT_WAYS } from './select';
import { SOUND_WAYS } from './sound';
import { THINGS_WAYS } from './things';
import type { WayCtx, WayHandler, WaySet, WayUse } from './types';

export type { WayAim, WayCtx, WayHandler, WaySet, WayUse } from './types';

/**
 * The hotbar's ways, one file per V3 tab (RELEASE_PLAN Milestone 0.5). A new button is a handler in its tab's file
 * and its way id in `packages/buildkit/src/v3.ts`; the island only builds the WayCtx.
 */
export const WAY_SETS: Readonly<Record<string, WaySet>> = {
  things: THINGS_WAYS,
  select: SELECT_WAYS,
  lights: LIGHTS_WAYS,
  sound: SOUND_WAYS,
  logic: LOGIC_WAYS,
  effects: EFFECTS_WAYS,
  animate: ANIMATE_WAYS,
  camera: CAMERA_WAYS,
  physics: PHYSICS_WAYS,
  characters: CHARACTERS_WAYS,
};

/** Every registered way id, and the tab file it lives in (a way id may only live in one). */
export function wayIndex(): Map<string, { tab: string; run: WayHandler }> {
  const out = new Map<string, { tab: string; run: WayHandler }>();
  for (const [tab, set] of Object.entries(WAY_SETS)) {
    for (const [id, run] of Object.entries(set)) {
      if (out.has(id)) throw new Error(`way ${id} is in both ${out.get(id)!.tab} and ${tab}`);
      out.set(id, { tab, run });
    }
  }
  return out;
}

const INDEX = wayIndex();

export const hasWay = (id: string): boolean => INDEX.has(id);

/** Run a registered way; false when the id has no handler (the island falls back to its tools). */
export function runWay(ctx: WayCtx, use: WayUse): boolean {
  const w = INDEX.get(use.id);
  if (!w) return false;
  w.run(ctx, use);
  return true;
}
