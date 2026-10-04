/**
 * The Sound tab's ways (F5; hotbar spec V3, Boombox / Audio): what you do with the palette's pick, an ambience (a forest, wind, waves ...)
 * or a sound. Place turns an ambience into a zone you hear when you are near and a sound into a spot it repeats from.
 */
export const SOUND_WAYS: readonly { readonly id: string; readonly name: string; readonly icon: string; readonly doc: string; readonly left: string; readonly right: string }[] = [
  { id: 'sound-play', name: 'Play', icon: 'Play', doc: 'Hear the palette\'s sound, or a few seconds of its ambience.', left: 'Play it', right: 'Play it' },
  { id: 'sound-place', name: 'Place', icon: 'MapPin', doc: 'Put the palette\'s pick where you point: an ambience becomes a zone you hear when you are near (waves on the beach, birds in the trees), a sound repeats from there.', left: 'Place it', right: 'Take away the nearest' },
  { id: 'sound-remove', name: 'Remove', icon: 'VolumeX', doc: 'Take away the placed sound or zone nearest where you point.', left: 'Take it away', right: 'Take it away' },
  { id: 'sound-list', name: 'Sounds here', icon: 'ListMusic', doc: 'Every sound and zone placed on this island: change how loud and how big, switch one off.', left: 'Open the list', right: 'Open the list' },
];
/** A palette icon for each ambience (@hm/soundscape's AMBIENCES). */
export const AMBIENCE_ICONS: Readonly<Record<string, string>> = {
  'forest-birds': 'Bird', 'windy-hill': 'Wind', 'creepy-cave': 'Mountain', 'busy-city': 'Building', 'rainy-day': 'CloudRain',
  'beach-waves': 'Waves', 'campfire-night': 'Flame', 'lava-rumble': 'Flame',
};
/** The rule for what a placed spot is: an ambience id makes a zone, anything else a repeating sound. */
export const isAmbience = (id: string): boolean => id in AMBIENCE_ICONS;
