import { PHYS_ITEMS } from '@hm/buildkit';
import type { WayHandler, WaySet } from './types';

const capital = (s: string): string => (s === 'it' ? 'It' : s);

/** Physics: give the thing you point at the palette's material (Alt: wood), drop it (Alt: from higher), or swing the push hammer (Alt: a tap). */
const physics: WayHandler = (ctx, { id, alt, first }) => {
  if (!first) return;
  const a = ctx.aim();
  if (!a) { ctx.say('Point at something'); return; }
  if (id === 'phys-hammer') {
    const n = ctx.physics.swing([a.point[0], a.point[1], a.point[2]], alt ? 1 : 4);
    ctx.fx(n ? 'boost' : 'ui-error', { volume: 0.6 });
    ctx.say(n ? `Bonk! ${n === 1 ? 'One thing flies' : `${n} things fly`}` : 'Nothing near enough to push');
    return;
  }
  const m = ctx.modelAt(a);
  if (!m) { ctx.say('Point at something you placed'); return; }
  if (id === 'phys-give') {
    const mat = ctx.player().palette.physics ?? 'rubber';
    const give = alt ? 'wood' : mat;
    const name = alt ? 'wood' : (PHYS_ITEMS.find((x) => x.id === mat)?.name ?? mat).toLowerCase();
    ctx.physics.setMaterial(m.ref, give);
    ctx.say(`${capital(ctx.thingName(m.ref))} is ${name} now: Drop shows how it lands`); ctx.fx('select', { volume: 0.5 });
    return;
  }
  if (ctx.physics.drop(m.ref, alt ? 6 : 3)) ctx.fx('jump', { volume: 0.4 });
};

export const PHYSICS_WAYS: WaySet = {
  'phys-give': physics,
  'phys-drop': physics,
  'phys-hammer': physics,
};
