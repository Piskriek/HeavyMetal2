/**
 * The emergency beacon, salvaged from the lab (plan 57 §14.2): the lab's flush wall beacons, each a gunmetal bezel round an amber
 * lens, rebuilt as a kit (RULES 8a). It is a wall fixture (`mount: 'wall'`), and its lens wears the lab's emergency amber, a slow
 * pulse, as an `lx:` lamp preset (LAB_LIGHTS.emergency), whose reach is the light it casts where the Graphics tier places one.
 * It keeps the lab's measures: a 0.24 x 0.16 m bezel, a 0.16 x 0.09 m lens. Square throughout.
 * Its Triad sockets:
 * - `wallMount` behind the bezel (mount) and `powerCable` through the wall behind it (power);
 * - `lightOut` on the lens's face, where its light leaves (output).
 *
 * Frame: the wall is the plane z 0, the beacon faces +z, centred on the origin.
 */
import type { Kit } from '@hm/kitspec';
import { LAB_LIGHTS, lightName } from './light-presets';

const BEZEL = { w: 0.24, h: 0.16, d: 0.03 } as const;
const LENS = { w: 0.16, h: 0.09, d: 0.03 } as const;

export const EMERGENCY_BEACON_KIT: Kit = {
  parts: {
    bezel: {
      source: { kind: 'box', size: [BEZEL.w, BEZEL.h, BEZEL.d] }, material: 'gunmetal', rank: 0,
      sockets: {
        wallMount: { at: [0, BEZEL.h / 2, -BEZEL.d / 2], rot: [-90, 0, 0] },
        powerCable: { at: [0, BEZEL.h / 2 - 0.03, -BEZEL.d / 2], rot: [-90, 0, 0] },
      },
    },
    lens: {
      source: { kind: 'box', size: [LENS.w, LENS.h, LENS.d] }, material: lightName(LAB_LIGHTS.emergency), rank: 0,
      sockets: { lightOut: { at: [0, LENS.h / 2, LENS.d / 2], rot: [90, 0, 0] } },
    },
  },
  assemblies: {
    'emergency-beacon': {
      mount: 'wall',
      children: [
        { ref: 'bezel', key: 'bezel', at: [0, -BEZEL.h / 2, BEZEL.d / 2] },
        { ref: 'lens', key: 'lens', at: [0, -LENS.h / 2, BEZEL.d + LENS.d / 2] },
      ],
    },
  },
};
