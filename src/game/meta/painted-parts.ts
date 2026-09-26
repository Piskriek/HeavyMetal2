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

export type RigAnchorId = 'eye-mid' | 'eye-right' | 'eye-left' | 'brow-line' | 'crown' | 'mouth' | 'chin' | 'nose'
  /** Where the left ear meets the head (ears are painted as one left ear and mirrored). */
  | 'ear-left'
  /** The top of the skull, where hair and small hats sit. */
  | 'scalp'
  /** The whole 256² frame's top-left corner (backgrounds). */
  | 'frame';

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
  /** Full-bleed art that is not in the keyed manifest (backgrounds). */
  readonly fixedFile?: { readonly file: string; readonly width: number; readonly height: number };
}

const P = (d: Omit<PaintedPartDef, 'prompt'> & { prompt?: string }): PaintedPartDef => ({ prompt: '', ...d });

/**
 * Registration: every painted part's pivot (normalised in its trimmed PNG) is pinned to a rig anchor,
 * at a width in rig units (height follows the PNG). Tests check each lands on its anchor on all
 * three heads and stays in frame.
 */
export const PAINTED_PARTS: readonly PaintedPartDef[] = [
  P({ id: 'eyewear-welding-goggles', layer: 'eyewear', name: 'Welding goggles', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 122 }),
  P({ id: 'eyewear-clockwork-monocle', layer: 'eyewear', name: 'Clockwork monocle', pivot: [0.6, 0.3], anchor: 'eye-right', width: () => 74 }),
  P({ id: 'headgear-aviator-helmet', layer: 'headgear', name: 'Aviator helmet', pivot: [0.5, 0.45], anchor: 'brow-line', width: (c) => 2 * c.headW + 34, hidesHair: [1, 3, 4, 5, 7, 8] }),
  P({ id: 'headgear-gear-tophat', layer: 'headgear', name: 'Gear top hat', pivot: [0.5, 0.93], anchor: 'crown', width: (c) => 2 * c.headW + 38, hidesHair: [1, 3, 5, 7] }),
  P({ id: 'mouth-gold-tusk-grin', layer: 'mouth', name: 'Gold tusk grin', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 86 }),
  P({ id: 'neck-brass-gorget', layer: 'neck', name: 'Brass gorget', pivot: [0.5, 0.42], anchor: 'chin', width: () => 150 }),
  P({ id: 'background-workshop-wall', layer: 'background', name: 'Workshop wall', pivot: [0, 0], anchor: 'frame', width: () => 256, fixedFile: { file: '/avatar-parts/keyed/background-workshop-wall.png', width: 512, height: 512 } }),
  P({ id: 'background-furnace-glow', layer: 'background', name: 'Furnace glow', pivot: [0, 0], anchor: 'frame', width: () => 256, fixedFile: { file: '/avatar-parts/keyed/background-furnace-glow.png', width: 512, height: 512 } }),
  P({ id: 'background-racing-pennants', layer: 'background', name: 'Racing pennants', pivot: [0, 0], anchor: 'frame', width: () => 256, fixedFile: { file: '/avatar-parts/keyed/background-racing-pennants.png', width: 512, height: 512 } }),
  P({ id: 'background-smog-sky', layer: 'background', name: 'Smog sky', pivot: [0, 0], anchor: 'frame', width: () => 256, fixedFile: { file: '/avatar-parts/keyed/background-smog-sky.png', width: 512, height: 512 } }),
  P({ id: 'ears-bat-pointed', layer: 'ears', name: 'Bat ears', pivot: [0.92, 0.6], anchor: 'ear-left', width: () => 84, mirrorPair: true }),
  P({ id: 'ears-notched-fins', layer: 'ears', name: 'Notched fins', pivot: [0.92, 0.55], anchor: 'ear-left', width: () => 78, mirrorPair: true }),
  P({ id: 'ears-torn-brass-ring', layer: 'ears', name: 'Torn ears, brass ring', pivot: [0.92, 0.6], anchor: 'ear-left', width: () => 80, mirrorPair: true }),
  P({ id: 'ears-droopy-hound', layer: 'ears', name: 'Droopy hound ears', pivot: [0.92, 0.3], anchor: 'ear-left', width: () => 70, mirrorPair: true }),
  P({ id: 'mouth-lower-tusks', layer: 'mouth', name: 'Lower tusks', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 72 }),
  P({ id: 'mouth-gold-jag-teeth', layer: 'mouth', name: 'Gold jag teeth', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 74 }),
  P({ id: 'mouth-cigar-stub', layer: 'mouth', name: 'Cigar stub', pivot: [0.42, 0.5], anchor: 'mouth', width: () => 92 }),
  P({ id: 'mouth-stitched-scar', layer: 'mouth', name: 'Stitched scar', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 72 }),
  P({ id: 'nose-hooked-beak', layer: 'nose', name: 'Hooked beak', pivot: [0.5, 0.55], anchor: 'nose', width: () => 54 }),
  P({ id: 'nose-warted-bulb', layer: 'nose', name: 'Warted bulb', pivot: [0.5, 0.55], anchor: 'nose', width: () => 52 }),
  P({ id: 'nose-brass-prosthetic', layer: 'nose', name: 'Brass prosthetic', pivot: [0.5, 0.5], anchor: 'nose', width: () => 48 }),
  P({ id: 'eyes-bloodshot-crazy', layer: 'eyes', name: 'Bloodshot, crazy', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 100 }),
  P({ id: 'eyes-narrow-squint', layer: 'eyes', name: 'Narrow squint', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 100 }),
  P({ id: 'eyes-wide-mismatched', layer: 'eyes', name: 'Wide, mismatched', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 100 }),
  P({ id: 'eyes-sleepy-lidded', layer: 'eyes', name: 'Sleepy lids', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 100 }),
  P({ id: 'eyewear-racing-goggles', layer: 'eyewear', name: 'Racing goggles', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 120 }),
  P({ id: 'eyewear-leather-eyepatch', layer: 'eyewear', name: 'Leather eyepatch', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 104 }),
  P({ id: 'eyewear-cracked-spectacles', layer: 'eyewear', name: 'Cracked spectacles', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 108 }),
  P({ id: 'eyewear-cyclops-lens-rig', layer: 'eyewear', name: 'Cyclops lens rig', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 112 }),
  P({ id: 'hair-grease-mohawk', layer: 'hair', name: 'Grease mohawk', pivot: [0.5, 0.97], anchor: 'scalp', width: () => 40 }),
  P({ id: 'hair-mutton-chops', layer: 'hair', name: 'Mutton chops', pivot: [0.5, 0.3], anchor: 'nose', width: (c) => 2 * c.headW + 22 }),
  P({ id: 'hair-singed-topknot', layer: 'hair', name: 'Singed topknot', pivot: [0.5, 0.97], anchor: 'scalp', width: () => 26 }),
  P({ id: 'hair-wire-tufts', layer: 'hair', name: 'Wire tufts', pivot: [0.5, 0.95], anchor: 'scalp', width: () => 100 }),
  P({ id: 'headgear-miner-headlamp', layer: 'headgear', name: 'Miner headlamp', pivot: [0.5, 0.85], anchor: 'brow-line', width: (c) => 2 * c.headW + 30, hidesHair: [1, 3, 4, 5, 7, 8] }),
  P({ id: 'headgear-spiked-pickelhaube', layer: 'headgear', name: 'Spiked pickelhaube', pivot: [0.5, 0.9], anchor: 'brow-line', width: (c) => 2 * c.headW + 12, hidesHair: [1, 3, 4, 5, 7, 8] }),
  P({ id: 'headgear-grease-bowler', layer: 'headgear', name: 'Grease bowler', pivot: [0.5, 0.92], anchor: 'brow-line', width: (c) => 2 * c.headW + 36, hidesHair: [1, 3, 5, 7] }),
  P({ id: 'headgear-scrap-crown', layer: 'headgear', name: 'Scrap crown', pivot: [0.5, 0.95], anchor: 'crown', width: (c) => 2 * c.headW + -8, hidesHair: [3, 7] }),
  P({ id: 'neck-spiked-collar', layer: 'neck', name: 'Spiked collar', pivot: [0.5, 0.2], anchor: 'chin', width: () => 118 }),
  P({ id: 'neck-gear-chain', layer: 'neck', name: 'Gear chain', pivot: [0.5, 0.1], anchor: 'chin', width: () => 84 }),
  P({ id: 'neck-boiler-suit-collar', layer: 'neck', name: 'Boiler suit collar', pivot: [0.5, 0.15], anchor: 'chin', width: () => 170 }),
  P({ id: 'neck-tool-bandolier', layer: 'neck', name: 'Tool bandolier', pivot: [0.5, 0.15], anchor: 'chin', width: () => 170 }),
];

export const paintedById = new Map(PAINTED_PARTS.map((p) => [`painted:${p.id}`, p]));

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
