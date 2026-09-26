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

export type RigAnchorId = 'eye-mid' | 'eye-right' | 'eye-left' | 'brow-line' | 'crown' | 'mouth' | 'chin' | 'nose';

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
}

const P = (d: Omit<PaintedPartDef, 'prompt'> & { prompt?: string }): PaintedPartDef => ({ prompt: '', ...d });

export const PAINTED_PARTS: readonly PaintedPartDef[] = [
  P({ id: 'eyewear-welding-goggles', layer: 'eyewear', name: 'Welding goggles (painted)', pivot: [0.5, 0.5], anchor: 'eye-mid', width: () => 122 }),
  P({ id: 'eyewear-clockwork-monocle', layer: 'eyewear', name: 'Clockwork monocle (painted)', pivot: [0.6, 0.3], anchor: 'eye-right', width: () => 74 }),
  P({ id: 'headgear-aviator-helmet', layer: 'headgear', name: 'Aviator helmet (painted)', pivot: [0.5, 0.45], anchor: 'brow-line', width: (c) => 2 * c.headW + 34, hidesHair: [1, 3, 4] }),
  P({ id: 'headgear-gear-tophat', layer: 'headgear', name: 'Gear top hat (painted)', pivot: [0.5, 0.93], anchor: 'crown', width: (c) => 2 * c.headW + 38, hidesHair: [1, 3] }),
  P({ id: 'mouth-gold-tusk-grin', layer: 'mouth', name: 'Gold tusk grin (painted)', pivot: [0.5, 0.5], anchor: 'mouth', width: () => 86, skinLocked: 'toxic-green' }),
  P({ id: 'neck-brass-gorget', layer: 'neck', name: 'Brass gorget (painted)', pivot: [0.5, 0.42], anchor: 'chin', width: () => 150 }),
];

export const paintedById = new Map(PAINTED_PARTS.map((p) => [`painted:${p.id}`, p]));

export function paintedPlacement(itemName: string, c: RigParams) {
  const def = paintedById.get(itemName);
  const file = def ? KEYED_PARTS[def.id] : undefined;
  if (!def || !file) return null;
  const w = def.width(c);
  const h = (w * file.height) / file.width;
  const a = rigAnchor(def.anchor, c);
  return { def, file, x: a.x - def.pivot[0] * w, y: a.y - def.pivot[1] * h, w, h, anchor: a };
}

export { KEYED_PARTS };
