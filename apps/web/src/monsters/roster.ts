// The packed monster roster (generated from docs/monsters/packed.json; roster.test.ts keeps the two equal).
// Every skin has a file under apps/web/src/assets/monsters/ (core, inlined) or apps/web/public/monsters/ (public, fetched).

export type Era = 'sprite' | 'early3d' | 'modern3d';
export type Archetype = 'charger' | 'spitter' | 'swarmer' | 'flyer' | 'brute' | 'sapper';

export interface SkinInfo {
  readonly id: string;
  /** sprite: Doom-style 8-view billboards; early3d: LibreQuake models with morph clips; modern3d: Quaternius skinned clips. */
  readonly era: Era;
  readonly archetype: Archetype;
  /** The real height in metres: the 3D models are fitted to it, the sprites are sized from their pixels. */
  readonly heightM: number;
  /** core: inlined in the single-file build; otherwise fetched from public/monsters/ at run time. */
  readonly core: boolean;
  readonly source: string;
}

export const SKINS: readonly SkinInfo[] = Object.freeze([
  { id: 'alien-q', era: 'modern3d', archetype: 'spitter', heightM: 1.8, core: false, source: 'quaternius' },
  { id: 'armabee-q', era: 'modern3d', archetype: 'swarmer', heightM: 0.9, core: false, source: 'quaternius' },
  { id: 'beas-bl', era: 'sprite', archetype: 'charger', heightM: 1.8, core: false, source: 'blasphemer' },
  { id: 'chicken-q', era: 'modern3d', archetype: 'swarmer', heightM: 0.6, core: false, source: 'quaternius' },
  { id: 'clnk-bl', era: 'sprite', archetype: 'sapper', heightM: 1.9, core: false, source: 'blasphemer' },
  { id: 'dog-lq', era: 'early3d', archetype: 'charger', heightM: 0.8, core: false, source: 'librequake' },
  { id: 'dog-q', era: 'modern3d', archetype: 'charger', heightM: 0.8, core: false, source: 'quaternius' },
  { id: 'enforcer-lq', era: 'early3d', archetype: 'spitter', heightM: 1.9, core: false, source: 'librequake' },
  { id: 'fatt-fd', era: 'sprite', archetype: 'brute', heightM: 2.2, core: false, source: 'freedoom' },
  { id: 'fiend-lq', era: 'early3d', archetype: 'charger', heightM: 1.4, core: false, source: 'librequake' },
  { id: 'flesh-worm', era: 'sprite', archetype: 'charger', heightM: 1.5, core: true, source: 'freedoom' },
  { id: 'floater', era: 'sprite', archetype: 'flyer', heightM: 1.6, core: true, source: 'freedoom' },
  { id: 'ghost-skull-q', era: 'modern3d', archetype: 'flyer', heightM: 1, core: false, source: 'quaternius' },
  { id: 'glub-q', era: 'modern3d', archetype: 'sapper', heightM: 0.9, core: false, source: 'quaternius' },
  { id: 'hell-knight', era: 'sprite', archetype: 'brute', heightM: 3, core: false, source: 'freedoom' },
  { id: 'hell-lord', era: 'sprite', archetype: 'brute', heightM: 3.2, core: false, source: 'freedoom' },
  { id: 'knight-lq', era: 'early3d', archetype: 'charger', heightM: 2, core: false, source: 'librequake' },
  { id: 'mntr-bl', era: 'sprite', archetype: 'brute', heightM: 2.4, core: false, source: 'blasphemer' },
  { id: 'mumm-bl', era: 'sprite', archetype: 'brute', heightM: 2, core: false, source: 'blasphemer' },
  { id: 'mushnub-q', era: 'modern3d', archetype: 'swarmer', heightM: 0.7, core: false, source: 'quaternius' },
  { id: 'ogre-lq', era: 'early3d', archetype: 'brute', heightM: 2.6, core: false, source: 'librequake' },
  { id: 'orc-q', era: 'modern3d', archetype: 'charger', heightM: 1.9, core: false, source: 'quaternius' },
  { id: 'pain-floater', era: 'sprite', archetype: 'flyer', heightM: 1.5, core: false, source: 'freedoom' },
  { id: 'pink-blob-q', era: 'modern3d', archetype: 'sapper', heightM: 1, core: false, source: 'quaternius' },
  { id: 'serpentipede', era: 'sprite', archetype: 'spitter', heightM: 1.7, core: true, source: 'freedoom' },
  { id: 'shalrath-lq', era: 'early3d', archetype: 'spitter', heightM: 2, core: false, source: 'librequake' },
  { id: 'shambler-lq', era: 'early3d', archetype: 'brute', heightM: 2.4, core: false, source: 'librequake' },
  { id: 'skel-fd', era: 'sprite', archetype: 'charger', heightM: 2, core: false, source: 'freedoom' },
  { id: 'skull-flier', era: 'sprite', archetype: 'swarmer', heightM: 0.5, core: true, source: 'freedoom' },
  { id: 'snke-bl', era: 'sprite', archetype: 'spitter', heightM: 1.9, core: false, source: 'blasphemer' },
  { id: 'sor2-bl', era: 'sprite', archetype: 'charger', heightM: 1.9, core: false, source: 'blasphemer' },
  { id: 'srcr-bl', era: 'sprite', archetype: 'sapper', heightM: 1.9, core: false, source: 'blasphemer' },
  { id: 'tarbaby-lq', era: 'early3d', archetype: 'sapper', heightM: 0.9, core: false, source: 'librequake' },
  { id: 'technospider', era: 'sprite', archetype: 'sapper', heightM: 2.2, core: true, source: 'freedoom' },
  { id: 'wizard-lq', era: 'early3d', archetype: 'flyer', heightM: 1.6, core: false, source: 'librequake' },
  { id: 'wzrd-bl', era: 'sprite', archetype: 'flyer', heightM: 1.2, core: false, source: 'blasphemer' },
  { id: 'yeti-q', era: 'modern3d', archetype: 'brute', heightM: 2.4, core: true, source: 'quaternius' },
  { id: 'zombie-trooper', era: 'sprite', archetype: 'spitter', heightM: 1.8, core: false, source: 'freedoom' },
]);

/** The skin that stands in when a skin fails to load: always a core skin of the same kind (sprite or 3D). */
export const FALLBACK_SKIN: Readonly<Record<Era, string>> = Object.freeze({ sprite: 'flesh-worm', early3d: 'yeti-q', modern3d: 'yeti-q' });

export function skinById(id: string): SkinInfo | undefined {
  return SKINS.find((s) => s.id === id);
}
