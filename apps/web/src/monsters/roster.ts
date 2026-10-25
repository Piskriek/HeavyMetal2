// The monster roster (plan 44, part B): every skin resolves its declarative CreatureGenomeSpec directly from @hm/creature.
// Static binary .glb models and .webp sprite sheets are eradicated (rule 8a); gameplay contracts (heightM, archetype, era,
// turn, remapStrength) are preserved for AI combat, pathfinding, and spawning.
import { ROSTER_GENOMES_BY_ID, buildCreatureKit, type CreatureGenomeSpec } from '@hm/creature';
import type { Kit } from '@hm/kitspec';

export type Era = 'sprite' | 'early3d' | 'modern3d';
export type Archetype = 'charger' | 'spitter' | 'swarmer' | 'flyer' | 'brute' | 'sapper';

export interface SkinInfo {
  readonly id: string;
  /** sprite: Doom-era stage 0–1; early3d: Quake-era stage 2–3; modern3d: stage 4–6. */
  readonly era: Era;
  readonly archetype: Archetype;
  /** The real height in metres: the procedural creature kit is fitted to it. */
  readonly heightM: number;
  /** core: primary fallback skin for its archetype/era. */
  readonly core: boolean;
  readonly source: string;
  /** The yaw (radians) that turns the model's native front onto +z, where a yaw of 0 faces. */
  readonly turn: number;
  /** The strength of the pull towards the gunmetal palette, 0 to 1 (Argo's O3: the default is 0.20; the Studio slider is brief 31). */
  readonly remapStrength: number;
  /** The declarative @hm/creature genome this species grows from. */
  readonly genome: CreatureGenomeSpec;
}

const g = (id: string): CreatureGenomeSpec => {
  const genome = ROSTER_GENOMES_BY_ID[id];
  if (!genome) throw new Error(`@hm/creature: missing roster genome for '${id}'`);
  return genome;
};

export const SKINS: readonly SkinInfo[] = Object.freeze([
  { id: 'alien-q', era: 'modern3d', archetype: 'spitter', heightM: 1.8, core: false, source: 'quaternius', turn: 0, remapStrength: 0.2, genome: g('alien-q') },
  { id: 'armabee-q', era: 'modern3d', archetype: 'swarmer', heightM: 0.9, core: false, source: 'quaternius', turn: 0, remapStrength: 0.2, genome: g('armabee-q') },
  { id: 'beas-bl', era: 'sprite', archetype: 'charger', heightM: 1.8, core: false, source: 'blasphemer', turn: 0, remapStrength: 0.2, genome: g('beas-bl') },
  { id: 'chicken-q', era: 'modern3d', archetype: 'swarmer', heightM: 0.6, core: false, source: 'quaternius', turn: 0, remapStrength: 0.2, genome: g('chicken-q') },
  { id: 'clnk-bl', era: 'sprite', archetype: 'sapper', heightM: 1.9, core: false, source: 'blasphemer', turn: 0, remapStrength: 0.2, genome: g('clnk-bl') },
  { id: 'dog-lq', era: 'early3d', archetype: 'charger', heightM: 0.8, core: false, source: 'librequake', turn: Math.PI, remapStrength: 0.2, genome: g('dog-lq') },
  { id: 'dog-q', era: 'modern3d', archetype: 'charger', heightM: 0.8, core: false, source: 'quaternius', turn: 0, remapStrength: 0.2, genome: g('dog-q') },
  { id: 'enforcer-lq', era: 'early3d', archetype: 'spitter', heightM: 1.9, core: false, source: 'librequake', turn: Math.PI, remapStrength: 0.2, genome: g('enforcer-lq') },
  { id: 'fatt-fd', era: 'sprite', archetype: 'brute', heightM: 2.2, core: false, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('fatt-fd') },
  { id: 'fiend-lq', era: 'early3d', archetype: 'charger', heightM: 1.4, core: false, source: 'librequake', turn: Math.PI, remapStrength: 0.2, genome: g('fiend-lq') },
  { id: 'flesh-worm', era: 'sprite', archetype: 'charger', heightM: 1.5, core: true, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('flesh-worm') },
  { id: 'floater', era: 'sprite', archetype: 'flyer', heightM: 1.6, core: true, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('floater') },
  { id: 'ghost-skull-q', era: 'modern3d', archetype: 'flyer', heightM: 1, core: false, source: 'quaternius', turn: 0, remapStrength: 0.2, genome: g('ghost-skull-q') },
  { id: 'glub-q', era: 'modern3d', archetype: 'sapper', heightM: 0.9, core: false, source: 'quaternius', turn: 0, remapStrength: 0.2, genome: g('glub-q') },
  { id: 'hell-knight', era: 'sprite', archetype: 'brute', heightM: 3, core: false, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('hell-knight') },
  { id: 'hell-lord', era: 'sprite', archetype: 'brute', heightM: 3.2, core: false, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('hell-lord') },
  { id: 'knight-lq', era: 'early3d', archetype: 'charger', heightM: 2, core: false, source: 'librequake', turn: Math.PI, remapStrength: 0.2, genome: g('knight-lq') },
  { id: 'mntr-bl', era: 'sprite', archetype: 'brute', heightM: 2.4, core: false, source: 'blasphemer', turn: 0, remapStrength: 0.2, genome: g('mntr-bl') },
  { id: 'mumm-bl', era: 'sprite', archetype: 'brute', heightM: 2, core: false, source: 'blasphemer', turn: 0, remapStrength: 0.2, genome: g('mumm-bl') },
  { id: 'mushnub-q', era: 'modern3d', archetype: 'swarmer', heightM: 0.7, core: false, source: 'quaternius', turn: 0, remapStrength: 0.2, genome: g('mushnub-q') },
  { id: 'ogre-lq', era: 'early3d', archetype: 'brute', heightM: 2.6, core: false, source: 'librequake', turn: Math.PI, remapStrength: 0.2, genome: g('ogre-lq') },
  { id: 'orc-q', era: 'modern3d', archetype: 'charger', heightM: 1.9, core: false, source: 'quaternius', turn: 0, remapStrength: 0.2, genome: g('orc-q') },
  { id: 'pain-floater', era: 'sprite', archetype: 'flyer', heightM: 1.5, core: false, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('pain-floater') },
  { id: 'pink-blob-q', era: 'modern3d', archetype: 'sapper', heightM: 1, core: false, source: 'quaternius', turn: 0, remapStrength: 0.2, genome: g('pink-blob-q') },
  { id: 'serpentipede', era: 'sprite', archetype: 'spitter', heightM: 1.7, core: true, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('serpentipede') },
  { id: 'shalrath-lq', era: 'early3d', archetype: 'spitter', heightM: 2, core: false, source: 'librequake', turn: Math.PI, remapStrength: 0.2, genome: g('shalrath-lq') },
  { id: 'shambler-lq', era: 'early3d', archetype: 'brute', heightM: 2.4, core: false, source: 'librequake', turn: Math.PI, remapStrength: 0.2, genome: g('shambler-lq') },
  { id: 'skel-fd', era: 'sprite', archetype: 'charger', heightM: 2, core: false, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('skel-fd') },
  { id: 'skull-flier', era: 'sprite', archetype: 'swarmer', heightM: 0.5, core: true, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('skull-flier') },
  { id: 'snke-bl', era: 'sprite', archetype: 'spitter', heightM: 1.9, core: false, source: 'blasphemer', turn: 0, remapStrength: 0.2, genome: g('snke-bl') },
  { id: 'sor2-bl', era: 'sprite', archetype: 'charger', heightM: 1.9, core: false, source: 'blasphemer', turn: 0, remapStrength: 0.2, genome: g('sor2-bl') },
  { id: 'srcr-bl', era: 'sprite', archetype: 'sapper', heightM: 1.9, core: false, source: 'blasphemer', turn: 0, remapStrength: 0.2, genome: g('srcr-bl') },
  { id: 'tarbaby-lq', era: 'early3d', archetype: 'sapper', heightM: 0.9, core: false, source: 'librequake', turn: Math.PI, remapStrength: 0.2, genome: g('tarbaby-lq') },
  { id: 'technospider', era: 'sprite', archetype: 'sapper', heightM: 2.2, core: true, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('technospider') },
  { id: 'wizard-lq', era: 'early3d', archetype: 'flyer', heightM: 1.6, core: false, source: 'librequake', turn: Math.PI, remapStrength: 0.2, genome: g('wizard-lq') },
  { id: 'wzrd-bl', era: 'sprite', archetype: 'flyer', heightM: 1.2, core: false, source: 'blasphemer', turn: 0, remapStrength: 0.2, genome: g('wzrd-bl') },
  { id: 'yeti-q', era: 'modern3d', archetype: 'brute', heightM: 2.4, core: true, source: 'quaternius', turn: 0, remapStrength: 0.2, genome: g('yeti-q') },
  { id: 'zombie-trooper', era: 'sprite', archetype: 'spitter', heightM: 1.8, core: false, source: 'freedoom', turn: 0, remapStrength: 0.2, genome: g('zombie-trooper') },
]);

/** The skin that stands in when a skin is requested before preload: always a core skin of the same era. */
export const FALLBACK_SKIN: Readonly<Record<Era, string>> = Object.freeze({ sprite: 'flesh-worm', early3d: 'yeti-q', modern3d: 'yeti-q' });

export function skinById(id: string): SkinInfo | undefined {
  return SKINS.find((s) => s.id === id);
}

/** Build the procedural @hm/kitspec Kit for a roster skin id. */
export function kitBySkinId(id: string): Kit | undefined {
  const skin = skinById(id);
  return skin ? buildCreatureKit(skin.genome) : undefined;
}
