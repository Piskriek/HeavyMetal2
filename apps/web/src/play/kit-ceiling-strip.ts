/**
 * The ceiling strip light, salvaged from the lab (plan 57 §14.2): the lab's recessed troffers, an aluminium housing over a
 * diffuser, rebuilt as a kit (RULES 8a). It is a ceiling fixture (`mount: 'ceiling'`), and its diffuser wears the lab's ceiling
 * white (LAB_LIGHTS.ceiling, 7500 K) as an `lx:` lamp preset, whose reach is the light it casts where the Graphics tier places one.
 * The lab drew its strips the length of a bank; a kit is a standard 1.2 m troffer that runs end to end. It keeps the lab's
 * section: a 0.32 m housing over a 0.22 m diffuser. Square throughout.
 * Its Triad sockets:
 * - `ceilingMount` on the housing (mount) and `powerCable` at its feed end (power);
 * - `lightOut` under the diffuser, where its light leaves (output).
 *
 * Frame: the ceiling is the plane y 0, the strip hangs below it, its length along z, centred on x and z.
 */
import type { Kit } from '@hm/kitspec';
import { LAB_LIGHTS, lightName } from './light-presets';

const L = 1.2;
const HOUSING = { w: 0.32, h: 0.04, d: L + 0.04 } as const;
const DIFFUSER = { w: 0.22, h: 0.025, d: L - 0.04 } as const;

export const CEILING_STRIP_KIT: Kit = {
  parts: {
    housing: {
      source: { kind: 'box', size: [HOUSING.w, HOUSING.h, HOUSING.d] }, material: 'paint', rank: 0,
      sockets: {
        ceilingMount: { at: [0, HOUSING.h, 0] },
        powerCable: { at: [0, HOUSING.h, -HOUSING.d / 2 + 0.05] },
      },
    },
    diffuser: {
      source: { kind: 'box', size: [DIFFUSER.w, DIFFUSER.h, DIFFUSER.d] }, material: lightName(LAB_LIGHTS.ceiling), rank: 0,
      sockets: { lightOut: { at: [0, 0, 0], rot: [180, 0, 0] } },
    },
  },
  assemblies: {
    'ceiling-strip': {
      mount: 'ceiling',
      children: [
        { ref: 'housing', key: 'housing', at: [0, -HOUSING.h, 0] },
        { ref: 'diffuser', key: 'diffuser', at: [0, -HOUSING.h - DIFFUSER.h, 0] },
      ],
    },
  },
};
