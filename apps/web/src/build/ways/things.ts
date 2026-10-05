import type { WayHandler, WaySet } from './types';

/** Clay Plump and Clay Scoop: a blob of clay on (or a bite out of) the thing you point at; on open ground, the raise or lower brush. Alt does the opposite. */
const clay: WayHandler = (ctx, { id, alt, now, first }) => {
  const add = (id === 'v3-clay-plump') !== alt;
  if (first) {
    const onThing = ctx.carveUnder(add, ctx.toolSize('things-carve'));
    ctx.memo.set('clay-on', onThing ? 'thing' : 'ground');
    if (onThing) return;
  }
  // a stroke that started on a thing stays on it; one that started on the ground keeps brushing
  if (ctx.memo.get('clay-on') !== 'ground') return;
  if (ctx.sculptGround(add, now, first) && first) ctx.tourEvent('used-sculpt');
};

export const THINGS_WAYS: WaySet = {
  'v3-clay-plump': clay,
  'v3-clay-scoop': clay,
};
