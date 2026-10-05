import { PARTICLE_PRESETS } from '@hm/particles';
import type { WayHandler, WaySet } from './types';

/** Place the palette's effect where you point, play it once, or (Remove, Alt) take the nearest away. */
const effect: WayHandler = (ctx, { id, alt, first }) => {
  if (!first) return;
  const a = ctx.aim();
  if (!a) { ctx.say('Point at the ground'); return; }
  const kind = ctx.player().palette.effects ?? 'campfire';
  if (id === 'effects-once') { ctx.effectOnce(kind, [a.point[0], a.point[1], a.point[2]]); ctx.fx('select', { volume: 0.4 }); return; }
  if (id === 'effects-remove' || alt) {
    if (!ctx.removeNearest('effects', a, 3, 'Remove an effect')) { ctx.say('No effect near there'); return; }
    ctx.say('Effect taken away'); ctx.fx('delete', { volume: 0.5 });
    return;
  }
  const full = ctx.overBudget('effects');
  if (full) { ctx.say(full); ctx.fx('ui-error', { volume: 0.5 }); return; }
  const name = PARTICLE_PRESETS.find((p) => p.id === kind)?.name ?? kind;
  ctx.placeChild('effects', 'effect', 'effect', name, {
    preset: kind, x: a.point[0], y: a.point[1], z: a.point[2],
    scale: Math.min(5, Math.max(0.2, (ctx.drive('effect-size') ?? 2) / 2)), on: true,
  });
  ctx.say(`${name} placed`); ctx.fx('place', { volume: 0.5 });
};

export const EFFECTS_WAYS: WaySet = {
  'effects-place': effect,
  'effects-once': effect,
  'effects-remove': effect,
};
