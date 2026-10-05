import { CHAR_BRAINS, isCharBrain } from '@hm/buildkit';
import type { WayHandler, WaySet } from './types';

/** Characters: spawn a goblin with the palette's behaviour, give the one you point at that behaviour, or take one away (Remove, or Alt on Spawn). */
const characters: WayHandler = (ctx, { id, alt, first }) => {
  if (!first) return;
  const a = ctx.aim();
  if (!a) { ctx.say('Point at the ground'); return; }
  const want = ctx.player().palette.characters;
  const brain = want && isCharBrain(want) ? want : 'wander';
  const b = CHAR_BRAINS.find((x) => x.id === brain);
  const bname = b?.name ?? brain;
  // the character nearest where you point (where it walks to now, not where it was put)
  const near = ctx.chars.near(a, 1.6);
  if (id === 'chars-remove' || (alt && id === 'chars-spawn')) {
    if (!near) { ctx.say('Point at a character'); return; }
    ctx.chars.remove(near);
    ctx.say('Character taken away'); ctx.fx('delete', { volume: 0.5 });
    return;
  }
  if (id === 'chars-change') {
    if (!near) { ctx.say('Point at a character'); return; }
    ctx.chars.setBrain(near, brain, `Behaves: ${bname}`);
    ctx.say(`It does this now: ${bname}`); ctx.fx('select', { volume: 0.5 });
    return;
  }
  ctx.chars.spawn(a, brain, `Character: ${bname}`);
  ctx.say(`A goblin: ${b?.doc ?? bname}`); ctx.fx('place', { volume: 0.5 });
};

export const CHARACTERS_WAYS: WaySet = {
  'chars-spawn': characters,
  'chars-change': characters,
  'chars-remove': characters,
};
