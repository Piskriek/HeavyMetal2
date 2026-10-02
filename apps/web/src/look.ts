import type { Params } from '@hm/contracts';
import { LOOKS, lookToUniforms, timeOfDayLook, type LookParams } from '@hm/looks';
import type { LookLike, ThreeRenderer } from '@hm/render';

/** The look a scene asks for: a named look, or the time-of-day cycle when timeOfDay >= 0. */
export function lookOf(sceneParams: Params): LookParams {
  const hour = Number(sceneParams['timeOfDay'] ?? -1);
  if (Number.isFinite(hour) && hour >= 0) return timeOfDayLook(hour);
  const id = String(sceneParams['look'] ?? 'noon-clear');
  return (LOOKS.find((l) => l.id === id) ?? LOOKS[0]!).params;
}

export function applyLook(renderer: ThreeRenderer, params: LookParams, fogScale = 1): void {
  renderer.setLook({ ...(lookToUniforms(params) as LookLike), fogScale });
}

export { LOOKS };
