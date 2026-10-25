/**
 * The look a loaded cartridge paints (TASK-21): the preset's colour (the average of its palette) and its roughness (set by the
 * preset's category; the vault has no roughness of its own). Pure data: no DOM, no clock, no random.
 */
import { VAULT_BY_ID, type VaultCategory } from '@hm/vault';
import { printOf, type Cartridge, type LabState } from '@hm/cartlab';

/** Roughness by category: liquids and crystals shine, flora and road sit in between, terrain and exotics are matte. */
export const CATEGORY_ROUGHNESS: Readonly<Record<VaultCategory, number>> = {
  TERRAIN: 0.9,
  FLORA: 0.78,
  LIQUID: 0.12,
  CRYSTAL: 0.3,
  ROAD: 0.7,
  STRUCTURE: 0.6,
  EXOTIC: 0.5,
};

export interface PresetLook {
  /** The preset's name, as the cartridge reads it. */
  readonly name: string;
  /** A #rrggbb colour: the average of the preset's palette. */
  readonly colour: string;
  /** 0 (mirror) to 1 (chalk). */
  readonly roughness: number;
}

const hex = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

/** The average colour of a palette of #rrggbb stops; null when there is no readable stop. */
export function averagePalette(palette: readonly string[]): string | null {
  let r = 0, g = 0, b = 0, n = 0;
  for (const stop of palette) {
    const m = /^#?([0-9a-f]{6})$/i.exec(stop.trim());
    if (!m) continue;
    const v = parseInt(m[1]!, 16);
    r += (v >> 16) & 255; g += (v >> 8) & 255; b += v & 255; n += 1;
  }
  return n === 0 ? null : `#${hex(r / n)}${hex(g / n)}${hex(b / n)}`;
}

/**
 * The written cartridge a reload takes from the lab rack: the first preset cartridge on the rack that no lab job still needs
 * (a job's inputs stay where they are). Null when there is none.
 */
export function writtenOnRack(lab: LabState): Cartridge | null {
  const all = allWrittenOnRack(lab);
  return all[0] ?? null;
}

/**
 * All written cartridges available on the lab rack that can be loaded into the Beam Rifle (BEAM-01).
 */
export function allWrittenOnRack(lab: LabState): Cartridge[] {
  const inJob = new Set<string>([...(lab.bench?.inputs ?? []), ...(lab.combiner?.inputs ?? [])]);
  return lab.cartridges.filter((c) => c.slot === null && !inJob.has(c.id) && ((c.kind === 'preset' && c.preset !== null) || printOf(c) !== null));
}

/**
 * The lab after a reload: the written cartridge leaves the rack, and the cartridge that was in the port (if any) goes back on
 * it, so a reload with a cartridge in hand leaves the rack's count as it was.
 */
export function reloadedLab(lab: LabState, written: Cartridge, port: Cartridge | null): LabState {
  const cartridges = lab.cartridges.filter((c) => c.id !== written.id);
  return { ...lab, cartridges: port ? [...cartridges, port] : cartridges };
}

/** The look of a vault preset by its id, or null for an id the vault does not know. */
export function presetLook(presetId: string): PresetLook | null {
  const v = VAULT_BY_ID.get(presetId);
  if (!v) return null;
  const colour = averagePalette(v.palette) ?? '#808080';
  return { name: v.name, colour, roughness: CATEGORY_ROUGHNESS[v.category] ?? 0.8 };
}
