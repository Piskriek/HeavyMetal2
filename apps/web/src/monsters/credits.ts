// The monsters' credits, as the game shows them (Settings, Credits). The full licence texts ship beside the art as
// monsters/credits.json, and docs/CREDITS.md has the same list. credits.test.ts keeps this list equal to the manifest.
export interface MonsterCredit {
  /** The source's id in credits.json. */
  readonly id: 'freedoom' | 'librequake' | 'blasphemer' | 'quaternius';
  readonly name: string;
  readonly licence: string;
  readonly url: string;
}

export const MONSTER_CREDITS: readonly MonsterCredit[] = Object.freeze([
  { id: 'freedoom', name: 'Freedoom 0.13.0, the sprite monsters', licence: 'BSD-3-Clause', url: 'https://freedoom.github.io/' },
  { id: 'librequake', name: 'LibreQuake, the early 3D monsters', licence: 'BSD-3-Clause', url: 'https://github.com/lavenderdotpet/LibreQuake' },
  { id: 'blasphemer', name: 'Blasphemer 0.1.8, more sprite monsters', licence: 'BSD-3-Clause', url: 'https://github.com/Blasphemer/blasphemer' },
  { id: 'quaternius', name: 'Quaternius, Ultimate Monsters, the modern 3D monsters', licence: 'CC0 1.0 (public domain)', url: 'https://quaternius.com/' },
]);
