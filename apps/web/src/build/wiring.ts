import type { PaletteChoice } from '@hm/buildkit';
import { STARTER_SURFACES } from '@hm/render';
import { MODELS } from '@hm/voxelart';
import type { SubTool } from '@hm/toolcatalog';
import type { HotItem, SoundId, SpriteId, ToolKind } from './hotbar';

/**
 * Which catalog tools do something on the island today, and what. The catalog lists everything a studio could offer (113 sub-tools); the island
 * wires the ones that exist so far and the rail shows the rest as "coming", honestly. A wired tool becomes a hotbar item (a button preset).
 */
export interface Wired {
  readonly kind: ToolKind;
  readonly sprite: SpriteId;
  readonly sound: SoundId;
  /** Brush size in metres. */
  readonly size: number;
  readonly strength?: number;
  /** The held-Tab palette decides the painted surface / the placed model. */
  readonly fromPalette?: 'surfaces' | 'models';
  /** Words for the screen: what each mouse button does with this tool. */
  readonly left: string;
  readonly right: string;
}

export const WIRED: Readonly<Record<string, Wired>> = {
  'pointer.move': { kind: 'pick', sprite: 'pop', sound: 'select', size: 1, left: 'Look at what is under the crosshair', right: 'Look at it too' },
  'brush.brush': { kind: 'paint', sprite: 'sparkle', sound: 'paint-tick', size: 4, fromPalette: 'surfaces', left: 'Paint the ground with the surface in your hand (hold Tab to change it)', right: 'Paint with the same surface, smaller' },
  'brush.eyedropper': { kind: 'pick', sprite: 'pop', sound: 'select', size: 1, left: 'Look at the surface', right: 'Look at it too' },
  'sculpt.draw': { kind: 'sculpt', sprite: 'dust', sound: 'sculpt-tick', size: 5, strength: 0.4, left: 'Raise the ground', right: 'Lower the ground' },
  'sculpt.clay-buildup': { kind: 'sculpt', sprite: 'dust', sound: 'sculpt-tick', size: 8, strength: 0.6, left: 'Build the ground up in broad strokes', right: 'Carve it down' },
  'sculpt.inflate': { kind: 'sculpt', sprite: 'dust', sound: 'sculpt-tick', size: 7, strength: 0.3, left: 'Swell the ground outwards', right: 'Shrink it back' },
  'sculpt.smooth': { kind: 'smooth', sprite: 'sparkle', sound: 'sculpt-tick', size: 6, strength: 0.5, left: 'Soften bumps', right: 'Soften bumps' },
  'sculpt.flatten': { kind: 'flatten', sprite: 'dust', sound: 'sculpt-tick', size: 6, strength: 0.5, left: 'Level the ground with where you first pressed', right: 'Level the ground' },
  'sculpt.voxel-dig': { kind: 'dig', sprite: 'debris', sound: 'delete', size: 4, strength: 0.55, left: 'Dig the ground away', right: 'Dig the ground away' },
  'sculpt.voxel-add': { kind: 'place', sprite: 'pop', sound: 'place', size: 1, fromPalette: 'models', left: 'Place the thing in your hand (hold Tab to change it)', right: 'Take away the thing you point at' },
  'delete.delete': { kind: 'delete', sprite: 'debris', sound: 'delete', size: 1, left: 'Take away the thing you point at', right: 'Take away the thing you point at' },
};

export const wiredKey = (setId: string, subId: string): string => `${setId}.${subId}`;
export const isWired = (setId: string, subId: string): boolean => wiredKey(setId, subId) in WIRED;

/** The hotbar item a wired sub-tool makes. `choice` is the held-Tab palette's current choice; `prev` keeps the size the user already set for this tool. */
export function itemFor(setId: string, sub: SubTool, choice: PaletteChoice | null, prev?: HotItem | null): HotItem | null {
  const w = WIRED[wiredKey(setId, sub.id)];
  if (!w) return null;
  const same = prev && prev.id === wiredKey(setId, sub.id) ? prev : null;
  const surface = w.fromPalette === 'surfaces' ? (choice?.category === 'surfaces' || choice?.category === 'roads' ? Number(choice.id) : same?.surface ?? 4) : undefined;
  const model = w.fromPalette === 'models' ? (choice?.category === 'models' ? choice.id : same?.model ?? 'barrel') : undefined;
  // a tool that paints or places is named for what is in its hand: the ground it paints, the thing it places
  const short = (n: string): string => n.split(/\s+/).slice(-2).join(' ');
  const label = surface !== undefined ? short(STARTER_SURFACES.find((x) => x.id === surface)?.name ?? sub.name) : model !== undefined ? short(MODELS.find((m) => m.id === model)?.name ?? sub.name) : sub.name;
  return {
    id: wiredKey(setId, sub.id),
    label,
    kind: w.kind,
    icon: sub.icon,
    sprite: w.sprite,
    sound: w.sound,
    size: same?.size ?? w.size,
    ...(w.strength !== undefined ? { strength: same?.strength ?? w.strength } : {}),
    ...(surface !== undefined && Number.isFinite(surface) ? { surface } : {}),
    ...(model !== undefined ? { model } : {}),
    doc: sub.doc,
    left: w.left,
    right: w.right,
  };
}
