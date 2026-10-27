/**
 * What a cartridge in the beam rifle is (plan 39): the colour its port glows and the print it carries. A written
 * Texture Mill preset glows its palette; a part its first material; a species its canopy; a light its own colour; a
 * layered material its base colour.
 */
import { printOf, type Cartridge, type Print, type SoundRole } from '@hm/cartlab';
import { paletteForStage } from '@hm/skin';
import { specOfName } from '@hm/matstack';
import { presetLook } from './beam-port';
import { lightHex } from './light-presets';
import { PART_SWATCHES } from './part-swatches';
import { speciesHex } from './species-presets';

/** A material's colour on a cartridge: its base surface's colour, its paint when the base is painted. */
const materialHex = (ref: string): string => {
  const m = specOfName(ref);
  if (!m) return '#808080';
  const c = m.base.colour;
  return c === 'paint1' ? m.paint[0] : c === 'paint2' ? m.paint[1] : c;
};

/** What a sound cartridge glows, by the role it was written for. */
const SOUND_GLOW: Readonly<Record<SoundRole, string>> = {
  machine: '#8ad0ff', rifle: '#ffd166', gate: '#c08aff', music: '#8affb0',
};

export interface RifleLook {
  readonly colour: string;
  /** The print it carries (a part, a species, a light, a material), or null for a written preset. */
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
        : 'light' in print
          ? lightHex(print.light)
          : 'material' in print
            ? materialHex(print.material.ref)
            : 'sprite' in print
              // a sprite glows the ink its own stage's palette leans on
              ? (paletteForStage(print.sprite.stage).colours[Math.floor(paletteForStage(print.sprite.stage).colours.length * 0.6)] ?? '#9aa4ad')
              : 'sound' in print
                ? SOUND_GLOW[print.sound.role]
                // a harness glows Ray-7 violet-indigo (plan 47)
                : '#b84dff';
    return { colour, print, preset: '' };
  }
  if (c.kind === 'preset' && c.preset) return { colour: presetLook(c.preset)?.colour ?? '#808080', print: null, preset: c.preset };
  return null;
}
