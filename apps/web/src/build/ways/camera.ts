import type { WaySet } from './types';

export const CAMERA_WAYS: WaySet = {
  /** Take a photo on the next frame. */
  'cam-photo': (ctx, { first }) => { if (first) ctx.camera.photo(); },
  /** Slow motion on and off. */
  'cam-slowmo': (ctx, { first }) => {
    if (!first) return;
    const on = ctx.camera.toggleSlowMo();
    ctx.say(on ? 'Slow motion' : 'Back to speed'); ctx.fx('ui-toggle', { volume: 0.4 });
  },
  /** Fly round the thing you point at (or round you), for as long as the slider says. Esc stops. */
  'cam-orbit': (ctx, { first }) => {
    if (!first) return;
    const a = ctx.aim();
    const m = a ? ctx.modelAt(a) : null;
    ctx.camera.orbit(m?.ref ?? null, Math.max(1, ctx.drive('orbit-time') ?? 8));
    ctx.say(m ? `Flying round ${ctx.thingName(m.ref)} (Esc stops)` : 'Flying round you (Esc stops)'); ctx.fx('ui-toggle', { volume: 0.4 });
  },
};
