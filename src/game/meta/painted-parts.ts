/**
 * Painted (PNG) part registry — registration data for keyed magenta-generated art (Plan §9.4).
 *
 * Registration model: every part declares a PIVOT in normalized image space (0..1 of the trimmed PNG)
 * that is pinned to a named RIG ANCHOR in the 256×256 head rig, plus a target WIDTH in rig units.
 * Anchors and widths are functions of head shape, so one PNG fits angular / bloated / scrawny heads.
 * Height always follows the PNG aspect ratio (never stretched).
 */
import type { AvatarLayerId } from './interfaces';
import { KEYED_PARTS } from './painted-parts.generated';

export interface RigParams { headW: number; headTop: number }

/** Rig units covered by the square a war paint was painted in (see the 'face-square' anchor). */
export const FACE_SQUARE = 160;

export type RigAnchorId = 'eye-mid' | 'eye-right' | 'eye-left' | 'brow-line' | 'crown' | 'mouth' | 'chin' | 'nose'
  /** Where the left ear meets the head (ears are painted as one left ear and mirrored). */
  | 'ear-left'
  /** The top of the skull, where hair and small hats sit. */
  | 'scalp'
  /** The whole 256² frame's top-left corner (backgrounds). */
  | 'frame'
  /**
   * The top-left corner of the square a war paint is painted in: the prompts put the eyes 30% of the
   * square apart (35% and 65% across, 42% down), so the square is FACE_SQUARE rig units wide.
   */
  | 'face-square';

export function rigAnchor(id: RigAnchorId, c: RigParams): { x: number; y: number } {
  switch (id) {
    case 'eye-mid': return { x: 128, y: 130 };
    case 'eye-right': return { x: 152, y: 130 };
    case 'eye-left': return { x: 104, y: 130 };
    case 'brow-line': return { x: 128, y: 112 };
    case 'crown': return { x: 128, y: c.headTop + 32 };
    case 'nose': return { x: 128, y: 160 };
    case 'mouth': return { x: 128, y: 188 };
    case 'chin': return { x: 128, y: 210 };
    case 'ear-left': return { x: 128 - c.headW + 6, y: 120 };
    case 'scalp': return { x: 128, y: c.headTop + 8 };
    case 'frame': return { x: 0, y: 0 };
    case 'face-square': return { x: 128 - 0.5 * FACE_SQUARE, y: 130 - 0.42 * FACE_SQUARE };
  }
}

export interface PaintedPartDef {
  readonly id: string;                 // catalog item name is `painted:${id}`
  readonly layer: AvatarLayerId;
  readonly name: string;
  readonly pivot: readonly [number, number];
  readonly anchor: RigAnchorId;
  readonly width: (c: RigParams) => number;
  /** Hair indices this part hides (occlusion is data, same rule engine as SVG items). */
  readonly hidesHair?: readonly number[];
  /** Part contains painted skin that does NOT follow the skin swatch yet (needs a tint mask, Plan §9.6). */
  readonly skinLocked?: 'toxic-green';
  readonly prompt: string;
  /** Ears: the PNG is the left one; the right one is the same PNG mirrored about the face's centre line. */
  readonly mirrorPair?: boolean;
  /**
   * The vector item this painted part stands in for. Old goblin codes keep their index, but the item
   * draws as this painted part, so no vector art is left on any goblin.
   */
  readonly replaces?: string;
  /** Full-bleed art that is not in the keyed manifest (backgrounds). */
  readonly fixedFile?: { readonly file: string; readonly width: number; readonly height: number };
}

const P = (d: Omit<PaintedPartDef, 'prompt'> & { prompt?: string }): PaintedPartDef => ({ prompt: '', ...d });
/**
 * War paint sits where it was painted in its raw square: `box` is the painted area in that square
 * (x, y, w, h as 0..1, measured from the untrimmed raw), turned into a pivot on the 'face-square' corner.
 * `shift` moves it (in the same units) where the painter missed the face layout the prompt described.
 */
const W = (id: string, name: string, box: readonly [number, number, number, number], replaces?: string, shift: readonly [number, number] = [0, 0]) =>
  P({ id, layer: 'warpaint', name, anchor: 'face-square', pivot: [-(box[0] + shift[0]) / box[2], -(box[1] + shift[1]) / box[3]], width: () => box[2] * FACE_SQUARE, replaces });

/**
 * Registration: every painted part's pivot (normalised in its trimmed PNG) is pinned to a rig anchor,
 * at a width in rig units (height follows the PNG). Tests check each lands on its anchor on all
 * three heads and stays in frame.
 */
export const PAINTED_PARTS: readonly PaintedPartDef[] = [
  P({ id: 'eyewear-welding-goggles', layer: 'eyewear', name: 'Welding goggles', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 122 }),
  P({ id: 'eyewear-clockwork-monocle', layer: 'eyewear', name: 'Clockwork monocle', pivot: [0.6, 0.3], anchor: 'eye-right', width: () => 74, replaces: 'brass-monocle' }),
  P({ id: 'headgear-aviator-helmet', layer: 'headgear', name: 'Aviator helmet', pivot: [0.5, 0.45], anchor: 'brow-line', width: (c) => 2 * c.headW + 34, hidesHair: [1, 3, 4, 5, 7, 8, 9, 11], replaces: 'aviator-cap' }),
  P({ id: 'headgear-gear-tophat', layer: 'headgear', name: 'Gear top hat', pivot: [0.5, 0.93], anchor: 'crown', width: (c) => 2 * c.headW + 38, hidesHair: [1, 3, 5, 7, 9, 11] }),
  P({ id: 'mouth-gold-tusk-grin', layer: 'mouth', name: 'Gold tusk grin', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 86 }),
  P({ id: 'neck-brass-gorget', layer: 'neck', name: 'Brass gorget', pivot: [0.5, 0.42], anchor: 'chin', width: () => 150 }),
  P({ id: 'background-workshop-wall', layer: 'background', name: 'Workshop wall', pivot: [0, 0], anchor: 'frame', width: () => 256, fixedFile: { file: '/avatar-parts/keyed/background-workshop-wall.png', width: 512, height: 512 }, replaces: 'workshop-wall' }),
  P({ id: 'background-furnace-glow', layer: 'background', name: 'Furnace glow', pivot: [0, 0], anchor: 'frame', width: () => 256, fixedFile: { file: '/avatar-parts/keyed/background-furnace-glow.png', width: 512, height: 512 }, replaces: 'furnace-glow' }),
  P({ id: 'background-racing-pennants', layer: 'background', name: 'Racing pennants', pivot: [0, 0], anchor: 'frame', width: () => 256, fixedFile: { file: '/avatar-parts/keyed/background-racing-pennants.png', width: 512, height: 512 }, replaces: 'racing-pennants' }),
  P({ id: 'background-smog-sky', layer: 'background', name: 'Smog sky', pivot: [0, 0], anchor: 'frame', width: () => 256, fixedFile: { file: '/avatar-parts/keyed/background-smog-sky.png', width: 512, height: 512 }, replaces: 'smog-sky' }),
  P({ id: 'ears-bat-pointed', layer: 'ears', name: 'Bat ears', pivot: [0.92, 0.6], anchor: 'ear-left', width: () => 84, mirrorPair: true, replaces: 'bat-pointed' }),
  P({ id: 'ears-notched-fins', layer: 'ears', name: 'Notched fins', pivot: [0.92, 0.55], anchor: 'ear-left', width: () => 78, mirrorPair: true, replaces: 'notched-fins' }),
  P({ id: 'ears-torn-brass-ring', layer: 'ears', name: 'Torn ears, brass ring', pivot: [0.92, 0.6], anchor: 'ear-left', width: () => 80, mirrorPair: true, replaces: 'torn-brass-ring' }),
  P({ id: 'ears-droopy-hound', layer: 'ears', name: 'Droopy hound ears', pivot: [0.92, 0.3], anchor: 'ear-left', width: () => 70, mirrorPair: true, replaces: 'droopy-hound' }),
  P({ id: 'mouth-lower-tusks', layer: 'mouth', name: 'Lower tusks', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 72, replaces: 'lower-tusks' }),
  P({ id: 'mouth-gold-jag-teeth', layer: 'mouth', name: 'Gold jag teeth', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 74, replaces: 'gold-jags' }),
  P({ id: 'mouth-cigar-stub', layer: 'mouth', name: 'Cigar stub', pivot: [0.42, 0.5], anchor: 'mouth', width: () => 92, replaces: 'cigar-stub' }),
  P({ id: 'mouth-stitched-scar', layer: 'mouth', name: 'Stitched scar', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 72, replaces: 'stitched-scar' }),
  P({ id: 'nose-hooked-beak', layer: 'nose', name: 'Hooked beak', pivot: [0.5, 0.55], anchor: 'nose', width: () => 54, replaces: 'hooked-beak' }),
  P({ id: 'nose-warted-bulb', layer: 'nose', name: 'Warted bulb', pivot: [0.5, 0.55], anchor: 'nose', width: () => 52, replaces: 'warted-bulb' }),
  P({ id: 'nose-brass-prosthetic', layer: 'nose', name: 'Brass prosthetic', pivot: [0.5, 0.5], anchor: 'nose', width: () => 48, replaces: 'prosthetic-plate' }),
  P({ id: 'eyes-bloodshot-crazy', layer: 'eyes', name: 'Bloodshot, crazy', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 100, replaces: 'bloodshot-crazy' }),
  P({ id: 'eyes-narrow-squint', layer: 'eyes', name: 'Narrow squint', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 100, replaces: 'narrow-squint' }),
  P({ id: 'eyes-wide-mismatched', layer: 'eyes', name: 'Wide, mismatched', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 100, replaces: 'wide-mismatched' }),
  P({ id: 'eyes-sleepy-lidded', layer: 'eyes', name: 'Sleepy lids', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 100, replaces: 'sleepy-lidded' }),
  P({ id: 'eyewear-racing-goggles', layer: 'eyewear', name: 'Racing goggles', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 120, replaces: 'goggles-down' }),
  P({ id: 'eyewear-leather-eyepatch', layer: 'eyewear', name: 'Leather eyepatch', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 104, replaces: 'leather-eyepatch' }),
  P({ id: 'eyewear-cracked-spectacles', layer: 'eyewear', name: 'Cracked spectacles', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 108 }),
  P({ id: 'eyewear-cyclops-lens-rig', layer: 'eyewear', name: 'Cyclops lens rig', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 112 }),
  P({ id: 'hair-grease-mohawk', layer: 'hair', name: 'Grease mohawk', pivot: [0.5, 0.97], anchor: 'scalp', width: () => 40, replaces: 'grease-mohawk' }),
  P({ id: 'hair-mutton-chops', layer: 'hair', name: 'Mutton chops', pivot: [0.5, 0.3], anchor: 'nose', width: (c) => 2 * c.headW + 22, replaces: 'mutton-chops' }),
  P({ id: 'hair-singed-topknot', layer: 'hair', name: 'Singed topknot', pivot: [0.5, 0.97], anchor: 'scalp', width: () => 26, replaces: 'singed-topknot' }),
  P({ id: 'hair-wire-tufts', layer: 'hair', name: 'Wire tufts', pivot: [0.5, 0.95], anchor: 'scalp', width: () => 100, replaces: 'wire-tufts' }),
  P({ id: 'headgear-miner-headlamp', layer: 'headgear', name: 'Miner headlamp', pivot: [0.5, 0.85], anchor: 'brow-line', width: (c) => 2 * c.headW + 30, hidesHair: [1, 3, 4, 5, 7, 8, 9, 11], replaces: 'miner-headlamp' }),
  P({ id: 'headgear-spiked-pickelhaube', layer: 'headgear', name: 'Spiked pickelhaube', pivot: [0.5, 0.9], anchor: 'brow-line', width: (c) => 2 * c.headW + 12, hidesHair: [1, 3, 4, 5, 7, 8, 9, 11], replaces: 'pickelhaube' }),
  P({ id: 'headgear-grease-bowler', layer: 'headgear', name: 'Grease bowler', pivot: [0.5, 0.92], anchor: 'brow-line', width: (c) => 2 * c.headW + 36, hidesHair: [1, 3, 5, 7, 9, 11], replaces: 'grease-bowler' }),
  P({ id: 'headgear-scrap-crown', layer: 'headgear', name: 'Scrap crown', pivot: [0.5, 0.95], anchor: 'crown', width: (c) => 2 * c.headW + -8, hidesHair: [3, 7] }),
  P({ id: 'neck-spiked-collar', layer: 'neck', name: 'Spiked collar', pivot: [0.5, 0.2], anchor: 'chin', width: () => 118, replaces: 'spiked-collar' }),
  P({ id: 'neck-gear-chain', layer: 'neck', name: 'Gear chain', pivot: [0.5, 0.1], anchor: 'chin', width: () => 84, replaces: 'gear-chain' }),
  P({ id: 'neck-boiler-suit-collar', layer: 'neck', name: 'Boiler suit collar', pivot: [0.5, 0.15], anchor: 'chin', width: () => 170, replaces: 'boiler-suit' }),
  // Art wave 2. The three heads and the four war paints only stand in for vector items (the head
  // layer is full in DNA v3); the rest are appended to the catalog.
  P({ id: 'head-angular', layer: 'head', name: 'Angular', pivot: [0.5, 0.4], anchor: 'eye-mid', width: (c) => 2 * c.headW + 8, replaces: 'angular' }),
  P({ id: 'head-bloated', layer: 'head', name: 'Bloated', pivot: [0.5, 0.4], anchor: 'eye-mid', width: (c) => 2 * c.headW + 8, replaces: 'bloated' }),
  P({ id: 'head-scrawny', layer: 'head', name: 'Scrawny', pivot: [0.5, 0.4], anchor: 'eye-mid', width: (c) => 2 * c.headW + 8, replaces: 'scrawny' }),
  P({ id: 'eyes-cyborg-lens', layer: 'eyes', name: 'Cyborg lens', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 100 }),
  P({ id: 'eyes-furnace-glow', layer: 'eyes', name: 'Furnace glow', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 100 }),
  P({ id: 'eyewear-goggles-up', layer: 'eyewear', name: 'Goggles up', pivot: [0.5, 0.75], anchor: 'brow-line', width: () => 112, replaces: 'goggles-up' }),
  P({ id: 'eyewear-aviator-shades', layer: 'eyewear', name: 'Aviator shades', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 114 }),
  P({ id: 'eyewear-triple-loupe', layer: 'eyewear', name: 'Triple loupe', pivot: [0.4, 0.45], anchor: 'eye-left', width: () => 84 }),
  P({ id: 'hair-slicked-quiff', layer: 'hair', name: 'Slicked quiff', pivot: [0.5, 0.85], anchor: 'scalp', width: () => 88 }),
  P({ id: 'hair-long-braids', layer: 'hair', name: 'Long braids', pivot: [0.5, 0.08], anchor: 'scalp', width: (c) => 2 * c.headW + 34 }),
  P({ id: 'hair-wild-flame', layer: 'hair', name: 'Wild flame', pivot: [0.5, 0.95], anchor: 'scalp', width: () => 58 }),
  P({ id: 'headgear-horned-scrap-helm', layer: 'headgear', name: 'Horned scrap helm', pivot: [0.5, 0.8], anchor: 'brow-line', width: (c) => 2 * c.headW + 44, hidesHair: [1, 3, 4, 5, 7, 8, 9, 11] }),
  P({ id: 'headgear-bandana-knot', layer: 'headgear', name: 'Bandana', pivot: [0.5, 0.75], anchor: 'brow-line', width: (c) => 2 * c.headW + 30, hidesHair: [1, 3, 4, 5, 7, 8, 9, 11] }),
  P({ id: 'headgear-propeller-beanie', layer: 'headgear', name: 'Propeller beanie', pivot: [0.5, 0.9], anchor: 'brow-line', width: (c) => 2 * c.headW + 12, hidesHair: [1, 3, 4, 5, 7, 8, 9, 11] }),
  P({ id: 'headgear-bucket-pot', layer: 'headgear', name: 'Cooking pot', pivot: [0.5, 0.9], anchor: 'brow-line', width: (c) => 2 * c.headW + 44, hidesHair: [1, 3, 4, 5, 7, 8, 9, 11] }),
  P({ id: 'mouth-rusty-grille', layer: 'mouth', name: 'Rusty grille', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 84 }),
  P({ id: 'mouth-buck-teeth', layer: 'mouth', name: 'Buck teeth', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 72 }),
  P({ id: 'mouth-corncob-pipe', layer: 'mouth', name: 'Corncob pipe', pivot: [0.35, 0.6], anchor: 'mouth', width: () => 100 }),
  P({ id: 'nose-pierced-ring', layer: 'nose', name: 'Pierced ring', pivot: [0.5, 0.5], anchor: 'nose', width: () => 54 }),
  P({ id: 'nose-snub-button', layer: 'nose', name: 'Snub button', pivot: [0.5, 0.55], anchor: 'nose', width: () => 44 }),
  P({ id: 'nose-long-droop', layer: 'nose', name: 'Long droop', pivot: [0.5, 0.35], anchor: 'nose', width: () => 50 }),
  P({ id: 'ears-cauliflower-studs', layer: 'ears', name: 'Cauliflower ears', pivot: [0.9, 0.5], anchor: 'ear-left', width: () => 60, mirrorPair: true }),
  P({ id: 'ears-long-ragged', layer: 'ears', name: 'Long ragged ears', pivot: [0.92, 0.55], anchor: 'ear-left', width: () => 96, mirrorPair: true }),
  P({ id: 'neck-wool-scarf', layer: 'neck', name: 'Wool scarf', pivot: [0.5, 0.3], anchor: 'chin', width: () => 150 }),
  P({ id: 'neck-padlock-collar', layer: 'neck', name: 'Padlock collar', pivot: [0.5, 0.35], anchor: 'chin', width: () => 120 }),
  P({ id: 'neck-trophy-medal', layer: 'neck', name: "Winner's medal", pivot: [0.5, 0.42], anchor: 'chin', width: () => 58 }),
  W('warpaint-mud-stripes', 'Mud stripes', [0.104, 0.164, 0.792, 0.47], 'mud-stripes', [0, 0.1]),
  W('warpaint-red-handprint', 'Red handprint', [0.171, 0.154, 0.752, 0.623], 'red-handprint'),
  W('warpaint-cog-tattoo', 'Cog tattoo', [0.313, 0.51, 0.163, 0.165], 'cog-tattoo', [-0.09, 0.05]),
  W('warpaint-soot-smudges', 'Soot smudges', [0.082, 0.139, 0.829, 0.738], 'soot-smudges'),
  W('warpaint-tribal-stripes', 'Tribal stripes', [0.05, 0.041, 0.885, 0.878]),
  W('warpaint-bone-skull', 'Bone skull', [0.069, 0.117, 0.857, 0.808]),
  P({ id: 'neck-tool-bandolier', layer: 'neck', name: 'Tool bandolier', pivot: [0.5, 0.15], anchor: 'chin', width: () => 170, replaces: 'tool-bandolier' }),
];

export const paintedById = new Map(PAINTED_PARTS.map((p) => [`painted:${p.id}`, p]));

/** Vector item → the painted part that stands in for it, keyed `layer/item`. */
const TWINS = new Map(PAINTED_PARTS.filter((p) => p.replaces).map((p) => [`${p.layer}/${p.replaces}`, `painted:${p.id}`]));
/** The catalog item as it is drawn: a vector item resolves to its painted twin; anything else is unchanged. */
export function drawnItem(layer: AvatarLayerId, item: string): string {
  return TWINS.get(`${layer}/${item}`) ?? item;
}
/** A vector item kept only so old codes keep their index; it draws as its twin and the creator hides it. */
export const isRetiredItem = (layer: AvatarLayerId, item: string): boolean => TWINS.has(`${layer}/${item}`);

export function paintedPlacement(itemName: string, c: RigParams) {
  const def = paintedById.get(itemName);
  const file = def ? (def.fixedFile ?? KEYED_PARTS[def.id]) : undefined;
  if (!def || !file) return null;
  const w = def.width(c);
  const h = (w * file.height) / file.width;
  const a = rigAnchor(def.anchor, c);
  return { def, file, x: a.x - def.pivot[0] * w, y: a.y - def.pivot[1] * h, w, h, anchor: a };
}

export { KEYED_PARTS };
