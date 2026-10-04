/** The Effects tab's ways (F12, also Shift+F2; hotbar spec V3): what you do with the palette's particle effect (@hm/particles presets). */
export const EFFECT_WAYS: readonly { readonly id: string; readonly name: string; readonly icon: string; readonly doc: string; readonly left: string; readonly right: string }[] = [
  { id: 'effects-place', name: 'Place', icon: 'Sparkles', doc: 'Put the palette\'s effect where you point; it keeps going (a campfire burns, snow keeps falling).', left: 'Place it', right: 'Take away the nearest effect' },
  { id: 'effects-once', name: 'Once', icon: 'Zap', doc: 'Play the palette\'s effect once where you point; nothing is kept.', left: 'Play it', right: 'Play it' },
  { id: 'effects-remove', name: 'Remove', icon: 'Eraser', doc: 'Take away the effect nearest where you point.', left: 'Take it away', right: 'Take it away' },
];
/** A palette icon for each particle preset. */
export const EFFECT_ICONS: Readonly<Record<string, string>> = {
  campfire: 'Flame', smoke: 'Wind', snow: 'Snowflake', rain: 'CloudRain', sparks: 'Sparkles', firework: 'PartyPopper', bubbles: 'CircleDot',
  dust: 'Wind', glitter: 'Sparkles', embers: 'Flame', splash: 'Droplet', confetti: 'PartyPopper',
};
