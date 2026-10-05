import type { WayHandler, WaySet } from './types';

/** Walk: click the thing that should walk, then points along its way, then the last point again (or Enter) to lay it. Alt drops the last point. */
const walk: WayHandler = (ctx, { alt, first }) => {
  if (!first) return;
  const a = ctx.aim();
  if (!a) { ctx.say('Point at the ground'); return; }
  const w = ctx.walk;
  if (!w.drawing()) {
    const m = ctx.modelAt(a);
    if (!m) { ctx.say('Click the thing that should walk'); return; }
    w.start(m.ref);
    ctx.say(`${ctx.thingName(m.ref) === 'it' ? 'It' : ctx.thingName(m.ref)}: now click points along its way, the last one again (or Enter) to go`); ctx.fx('select', { volume: 0.5 });
    return;
  }
  if (alt) { w.pop(); return; }
  const last = w.last();
  if (last && Math.hypot(a.point[0] - last[0], a.point[2] - last[1]) < 1) { w.lay(); return; }
  w.push([a.point[0], a.point[2]]); ctx.fx('select', { volume: 0.3 });
};

export const ANIMATE_WAYS: WaySet = {
  'anim-path': walk,
  /** Stop: the thing you point at stops walking (its paths go). */
  'anim-stop': (ctx, { first }) => {
    if (!first) return;
    const a = ctx.aim();
    if (!a) { ctx.say('Point at the ground'); return; }
    const m = ctx.modelAt(a);
    if (!m || !ctx.walk.stop(m.ref)) { ctx.say('Point at a thing that walks'); return; }
    ctx.say('It stays put now'); ctx.fx('delete', { volume: 0.5 });
  },
};
