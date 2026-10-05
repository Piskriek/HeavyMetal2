import type { SfxId } from '@hm/audio';
import { isAmbience } from '@hm/buildkit';
import { AMBIENCES } from '@hm/soundscape';
import type { WayCtx, WayHandler, WaySet } from './types';

/** Funny Sounds plays one of these at random. */
export const FUNNY: readonly SfxId[] = ['jump', 'boost', 'splash', 'item-pickup', 'oil', 'respawn', 'freeze', 'snap'];

const pick = (ctx: WayCtx): { what: string; name: string; zone: boolean } => {
  const what = ctx.player().palette.sound ?? 'forest-birds';
  const zone = isAmbience(what);
  return { what, zone, name: zone ? AMBIENCES.find((a) => a.id === what)?.name ?? what : ctx.soundName(what) };
};

/** Place the palette's pick where you point: an ambience becomes a zone you hear when near; a sound repeats from its spot. Alt (or Remove) takes the nearest away. */
const place: WayHandler = (ctx, { id, alt, first }) => {
  if (!first) return;
  const a = ctx.aim();
  if (!a) { ctx.say('Point at the ground'); return; }
  if (id === 'sound-remove' || alt) {
    if (!ctx.removeNearest('soundscape', a, 4, 'Remove a placed sound')) { ctx.say('No placed sound near there'); return; }
    ctx.say('Sound taken away'); ctx.fx('delete', { volume: 0.5 });
    return;
  }
  const full = ctx.overBudget('sounds');
  if (full) { ctx.say(full); ctx.fx('ui-error', { volume: 0.5 }); return; }
  const { what, name, zone } = pick(ctx);
  ctx.placeChild('soundscape', 'sound-spot', 'sound', name, {
    what, x: a.point[0], y: a.point[1], z: a.point[2],
    size: zone ? 8 : Math.max(1, ctx.drive('hearing') ?? 10),
    volume: Math.min(1, Math.max(0, (ctx.drive(zone ? 'amb-volume' : 'loudness') ?? 80) / 100)),
    every: 4, on: true,
  });
  ctx.say(zone ? `${name}: a zone, you hear it when you are near` : `${name}: it plays from here every few seconds`); ctx.fx('place', { volume: 0.5 });
};

export const SOUND_WAYS: WaySet = {
  'sound-play': (ctx, { first }) => {
    if (!first) return;
    const { what, name } = pick(ctx);
    ctx.previewSound(what);
    ctx.say(name);
  },
  'sound-place': place,
  'sound-remove': place,
  'sound-list': (ctx, { first }) => { if (first) ctx.openWindow('soundscape', 'Sounds here'); },

  'v3-funny': (ctx, { first }) => {
    if (!first) return;
    ctx.fx(FUNNY[Math.min(FUNNY.length - 1, Math.floor(ctx.random() * FUNNY.length))]!, { volume: 0.7 });
    const a = ctx.aim();
    if (a) ctx.burst('stars', 12, [a.point[0], a.point[1] + 1, a.point[2]]);
  },
  'v3-roar': (ctx, { first }) => {
    if (!first) return;
    ctx.fx('shockwave', { volume: 0.9 }); ctx.fx('hit-wall', { volume: 0.6 });
    ctx.shake('rumble');
    const a = ctx.aim();
    if (a) ctx.burst('embers', 40, [a.point[0], a.point[1] + 0.4, a.point[2]]);
    ctx.say('ROAR!');
  },
};
