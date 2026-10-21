/**
 * What a cartridge in the beam rifle is (plan 39): the colour its port glows and the print it carries. A written
 * Texture Mill preset glows its palette; a part its first material; a species its canopy; a light its own colour.
 */
import { printOf, type Cartridge, type Print } from '@hm/cartlab';
import { presetLook } from './beam-port';
import { lightHex } from './light-presets';
import { PART_SWATCHES } from './part-swatches';
import { speciesHex } from './species-presets';

export interface RifleLook {
  readonly colour: string;
  /** The print it carries (a part, a species, a light), or null for a written preset. */
  readonly print: Print | null;
  /** The written preset's id, or '' for a print. */
  readonly preset: string;
}

/** The look of a cartridge that can go in the rifle, or null for one that cannot (a blank, a mix). */
export function rifleLook(c: Cartridge): RifleLook | null {
  const print = printOf(c);
  if (print) {
    const colour = 'part' in print
      ? (PART_SWATCHES.find((s) => s.id === Object.values(print.part.slotMaterials)[0])?.color ?? '#9aa4ad')
      : 'species' in print
        ? speciesHex({ species: print.species.species as 'pine' | 'oak' | 'birch', params: print.species.params })
        : lightHex(print.light);
    return { colour, print, preset: '' };
  }
  if (c.kind === 'preset' && c.preset) return { colour: presetLook(c.preset)?.colour ?? '#808080', print: null, preset: c.preset };
  return null;
}
