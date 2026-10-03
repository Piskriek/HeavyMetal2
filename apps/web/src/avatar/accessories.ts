import { kindOf, type AvatarKind, type AvatarLook, type PartPlace } from '@hm/avatarlook';
import type { Bone } from '@hm/anim';
import { HERO_GOBLIN_RIG, HUMAN_RIG, dressAvatar, type DressItem, type Rig } from '@hm/render';
import { HEAD_PARTS } from '@hm/voxpartshead';
import { BODY_PARTS } from '@hm/voxpartsbody';
import type { PaletteEntry, VoxelModel } from '@hm/voxel';

/**
 * Parts on your goblin: a hat, hair, something on the face, something in the hand, something on the back, from the voxel parts library.
 * They are added to the hero goblin at fixed points on its body (where the head's top, the face, the right hand and the back are), take
 * their colours from the look, and move with the bone they sit on.
 */
type V3 = [number, number, number];
interface LibPart { readonly id: string; readonly slot: string; readonly name: string; readonly size: readonly number[]; readonly palette: readonly string[]; readonly cells: readonly number[]; readonly anchors: Readonly<Record<string, readonly number[]>>; readonly attachTo: string }
const LIBRARY = [...(HEAD_PARTS as unknown as LibPart[]), ...(BODY_PARTS as unknown as LibPart[])];

/** Points on the hero goblin (28 x 44 x 20 cells, facing -Z) where parts attach, measured from the model. */
const HERO_ANCHORS: Readonly<Record<string, V3>> = {
  hatSeat: [14, 41, 9], noseBase: [14, 34, 4], eyeL: [16, 36, 4], eyeR: [11, 36, 4], mouthSeat: [14, 33, 4], palm: [22, 9, 8], backMount: [14, 24, 15],
};
/** The same points on the voxel human (28 x 47 x 20): top of the hair, the nose, the eyes, the mouth, the right hand, the middle of the back. */
const HUMAN_ANCHORS: Readonly<Record<string, V3>> = {
  hatSeat: [14, 47, 10], noseBase: [14, 40, 6], eyeL: [16, 41, 6], eyeR: [11, 41, 6], mouthSeat: [14, 38, 6], palm: [21, 18, 9], backMount: [14, 28, 13],
};

/** Each kind of avatar: its voxel model, its bones, its size (metres a cell), where parts go, and how tall it stands (for framing). */
export interface AvatarKindDef { readonly modelId: string; readonly rig: Rig; readonly block: number; readonly anchors: Readonly<Record<string, V3>>; readonly tall: number }
export const KINDS: Readonly<Record<AvatarKind, AvatarKindDef>> = {
  goblin: { modelId: 'goblin', rig: HERO_GOBLIN_RIG, block: 0.04, anchors: HERO_ANCHORS, tall: 1.76 },
  human: { modelId: 'human', rig: HUMAN_RIG, block: 0.04, anchors: HUMAN_ANCHORS, tall: 1.88 },
};
export const kindDef = (look: AvatarLook): AvatarKindDef => KINDS[kindOf(look)];
export const PLACES: readonly { readonly place: PartPlace; readonly label: string; readonly bone: Bone; readonly anchor: string }[] = [
  { place: 'hat', label: 'Hat', bone: 'head', anchor: 'hatSeat' },
  { place: 'hair', label: 'Hair', bone: 'head', anchor: 'hatSeat' },
  { place: 'face-extra', label: 'Face', bone: 'head', anchor: 'noseBase' },
  { place: 'handheld', label: 'In hand', bone: 'armR', anchor: 'palm' },
  { place: 'back', label: 'On the back', bone: 'body', anchor: 'backMount' },
];

export const partsFor = (place: PartPlace): readonly LibPart[] => LIBRARY.filter((p) => p.slot === place);
export const partById = (id: string): LibPart | undefined => LIBRARY.find((p) => p.id === id);
const prettyName = (p: LibPart): string => p.name || p.id.replace(/^[a-z]+_/, '').replace(/_/g, ' ');
export const partName = (id: string): string => { const p = partById(id); return p ? prettyName(p) : id; };

const hex01 = (hex: string): V3 => { const v = parseInt(hex.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };
const lighten = (c: V3, k: number): V3 => [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k];

/** A part's palette slot painted from the look (the goblin's own colours carry over to what it wears). */
function entryFor(slot: string, look: AvatarLook): PaletteEntry {
  const m = (roughness: number, metalness = 0, emissive = 0): Omit<PaletteEntry, 'name' | 'color'> => ({ roughness, metalness, emissive, alpha: 1 });
  switch (slot) {
    case 'skin': return { name: slot, color: hex01(look.skin), ...m(0.75) };
    case 'skinDark': return { name: slot, color: hex01(look.speckle), ...m(0.75) };
    case 'skinLight': return { name: slot, color: lighten(hex01(look.skin), 0.3), ...m(0.75) };
    case 'cloth1': return { name: slot, color: hex01(look.cloth), ...m(0.9) };
    case 'cloth2': return { name: slot, color: hex01(look.vest), ...m(0.9) };
    case 'metal': return { name: slot, color: hex01('#b9bcc4'), ...m(0.35, 0.85) };
    case 'leather': return { name: slot, color: hex01(look.belt), ...m(0.8) };
    case 'glow': return { name: slot, color: hex01(look.eyes), ...m(0.5, 0, 1) };
    // a human's hair part matches its own hair; a goblin's is dark
    case 'hair': return { name: slot, color: hex01(kindOf(look) === 'human' ? look.speckle : '#2b2118'), ...m(0.85) };
    case 'teeth': return { name: slot, color: hex01('#f2e9d0'), ...m(0.4) };
    case 'eyeWhite': return { name: slot, color: hex01('#fdfdfd'), ...m(0.3) };
    case 'pupil': return { name: slot, color: hex01('#101014'), ...m(0.35) };
    default: return { name: slot, color: hex01(look.shield), ...m(0.5) };
  }
}

/** The parts a look wears, ready to add to the goblin. Unknown part ids are skipped. */
export function dressItems(look: AvatarLook): DressItem[] {
  const out: DressItem[] = [];
  for (const pl of PLACES) {
    const id = look.parts?.[pl.place];
    const part = id ? partById(id) : undefined;
    if (!part || part.slot !== pl.place) continue;
    const anchors = kindDef(look).anchors;
    const at = anchors[part.attachTo] ?? anchors[pl.anchor]!;
    const root = (part.anchors['root'] ?? [0, 0, 0]) as V3;
    out.push({ size: [part.size[0]!, part.size[1]!, part.size[2]!], cells: part.cells, palette: part.palette.map((s) => entryFor(s, look)), root: [root[0], root[1], root[2]], at, bone: pl.bone });
  }
  return out;
}

/** An avatar in a look with its parts on, and the rig that animates it (the rig of its kind). */
export function dress(model: VoxelModel, look: AvatarLook): { model: VoxelModel; rig: Rig } {
  return dressAvatar(model, kindDef(look).rig, dressItems(look));
}

/** One part as a small voxel model in the look's colours (for its thumbnail). */
export function partModel(id: string, look: AvatarLook): VoxelModel | null {
  const p = partById(id);
  if (!p) return null;
  const [sx, sy, sz] = [p.size[0]!, p.size[1]!, p.size[2]!];
  return { id: p.id, name: prettyName(p), size: [sx, sy, sz], pivot: [Math.floor(sx / 2), 0, Math.floor(sz / 2)], palette: p.palette.map((s) => entryFor(s, look)), cells: Uint8Array.from(p.cells) };
}
