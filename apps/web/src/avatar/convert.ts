import type { VoxelModel, PaletteEntry } from '@hm/voxel';
import type { Part, PaletteSlot } from '@hm/voxpartshead';

/**
 * Parts and avatars are drawn with palette SLOTS (skin, cloth1, metal ...), not colours: a colour scheme picks the colours, so one part wears every scheme.
 * This turns a part (or any slot-palette grid) into the voxel model the renderer draws, with sensible material values per slot.
 */
export type Scheme = Record<PaletteSlot, string>;

const hex = (c: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  const n = m ? parseInt(m[1]!, 16) : 0x888888;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const MATERIAL: Record<PaletteSlot, { roughness: number; metalness: number; emissive: number }> = {
  skin: { roughness: 0.75, metalness: 0, emissive: 0 }, skinDark: { roughness: 0.78, metalness: 0, emissive: 0 }, skinLight: { roughness: 0.7, metalness: 0, emissive: 0 },
  cloth1: { roughness: 0.9, metalness: 0, emissive: 0 }, cloth2: { roughness: 0.9, metalness: 0, emissive: 0 }, metal: { roughness: 0.3, metalness: 0.9, emissive: 0 },
  leather: { roughness: 0.8, metalness: 0, emissive: 0 }, glow: { roughness: 0.4, metalness: 0, emissive: 1 }, hair: { roughness: 0.85, metalness: 0, emissive: 0 },
  teeth: { roughness: 0.4, metalness: 0, emissive: 0 }, eyeWhite: { roughness: 0.3, metalness: 0, emissive: 0 }, pupil: { roughness: 0.3, metalness: 0, emissive: 0 },
  accent: { roughness: 0.5, metalness: 0, emissive: 0 },
};

export function slotEntry(slot: PaletteSlot, scheme: Scheme): PaletteEntry {
  return { name: slot, color: hex(scheme[slot] ?? '#888888'), alpha: 1, ...MATERIAL[slot] };
}

/** A part as a voxel model in a colour scheme. The pivot is the middle of the part's base. */
export function partToModel(part: Part, scheme: Scheme): VoxelModel {
  return {
    id: part.id, name: part.name, size: [part.size[0], part.size[1], part.size[2]], pivot: [part.size[0] / 2, 0, part.size[2] / 2],
    palette: part.palette.map((s) => slotEntry(s, scheme)), cells: Uint8Array.from(part.cells),
  };
}
