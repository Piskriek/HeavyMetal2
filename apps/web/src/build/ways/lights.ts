import { presetById as lampById } from '@hm/lightplace';
import type { WayHandler, WaySet } from './types';

const timeOfDay = (noon: boolean): WayHandler => (ctx, { first }) => {
  if (!first) return;
  ctx.setTimeOfDay(noon ? 12 : 22, noon ? 'Noon' : 'Night');
  ctx.say(noon ? 'Noon: the sun is high' : 'Night: the moon is up');
  ctx.fx(noon ? 'ui-success' : 'ui-toggle', { volume: 0.5 });
};

/** How high a lamp hangs over the spot you point at: a spotlight high and pointing down, a campfire or a candle low, the rest at lamp height. */
export function lampLift(kind: string): number {
  const lp = lampById(kind);
  if (lp?.kind === 'spot') return 3;
  return kind === 'campfire' ? 0.4 : kind === 'candle' ? 0.5 : kind === 'torch' ? 1.6 : 1.2;
}

/** Lamp: the palette's lamp where you point (its brightness from the slider). Remove (or Alt) takes the nearest away. */
const lamp: WayHandler = (ctx, { id, alt, first }) => {
  if (!first) return;
  const a = ctx.aim();
  if (!a) { ctx.say('Point at the ground'); return; }
  if (id === 'light-lamp-remove' || alt) {
    if (!ctx.removeNearest('lamps', a, 3, 'Remove a lamp')) { ctx.say('No lamp near there'); return; }
    ctx.say('Lamp taken away'); ctx.fx('delete', { volume: 0.5 });
    return;
  }
  const full = ctx.overBudget('lamps');
  if (full) { ctx.say(full); ctx.fx('ui-error', { volume: 0.5 }); return; }
  const want = ctx.player().palette.lamp;
  const kind = want && lampById(want) ? want : 'bulb';
  const lp = lampById(kind)!;
  ctx.placeChild('lamps', 'lamp', 'lamp', lp.name, {
    preset: kind, x: a.point[0], y: a.point[1] + lampLift(kind), z: a.point[2], yaw: 0, pitch: 90,
    brightness: Math.min(3, Math.max(0, (ctx.drive('lamp-brightness') ?? 50) / 50)), on: true,
  });
  ctx.say(ctx.lampSlots() > 0 ? `${lp.name}: it shows best at dusk and at night (Day and night)` : `${lp.name} placed (lamps are not lit on Potato graphics)`);
  ctx.fx('place', { volume: 0.5 });
};

export const LIGHTS_WAYS: WaySet = {
  'v3-noon': timeOfDay(true),
  'v3-night': timeOfDay(false),
  'light-lamp': lamp,
  'light-lamp-remove': lamp,
};
