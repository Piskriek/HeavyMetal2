/**
 * The relay cabinet, salvaged from the lab (plan 57 §14.2): the labkit's procedural `relayCabinet` rebuilt from scratch as a kit
 * (RULES 8a), so it is a preset like every prop. It keeps the labkit cabinet's measures:
 * - a 0.6 x 1.9 x 0.5 m cabinet on a plinth, with its door, handle and two hinges;
 * - fourteen louvres, tilted down, in front of the door;
 * - three status lamps (green, amber, red, as lx: lamp presets) in their bezels near the top;
 * - a cable gland on top and four corner bolts.
 * Square sections throughout (the owner's rule): the labkit's round hinges, lamps, gland and bolts are square here.
 * Its Triad sockets:
 * - `cableTop` on the gland and `cableBottom` at the back of the plinth (power);
 * - `floorMount` under the plinth (mount);
 * - a `statusLed` on each lamp.
 *
 * Frame: the floor at y 0, centred on x and z, the door facing +z.
 */
import type { Kit, Placement } from '@hm/kitspec';

const W = 0.6;
const H = 1.9;
const D = 0.5;
const PLINTH_H = 0.06;
const BODY_H = H - PLINTH_H;
const DOOR = { w: W - 0.08, h: BODY_H - 0.12, d: 0.025 } as const;
const DOOR_Y = PLINTH_H + 0.06;
const FRONT = D / 2;
const LAMP_Y = H - 0.12;
const LAMP_X = [-0.11, 0, 0.11] as const;
const LOUVRES = 14;

export const RELAY_CABINET_KIT: Kit = {
  parts: {
    plinth: {
      source: { kind: 'box', size: [W - 0.02, PLINTH_H, D - 0.02] }, material: 'darkSteel', rank: 0,
      sockets: { floorMount: { at: [0, 0, 0], rot: [180, 0, 0] }, cableBottom: { at: [0, 0.02, -D / 2 + 0.06], rot: [-90, 0, 0] } },
    },
    body: { source: { kind: 'box', size: [W, BODY_H, D] }, material: 'paint', rank: 0 },
    door: { source: { kind: 'box', size: [DOOR.w, DOOR.h, DOOR.d] }, material: 'paint', rank: 0 },
    handle: { source: { kind: 'box', size: [0.02, 0.14, 0.04] }, material: 'darkSteel', rank: 1 },
    hinge: { source: { kind: 'box', size: [0.024, 0.07, 0.024] }, material: 'darkSteel', rank: 1 },
    louvre: { source: { kind: 'box', size: [DOOR.w - 0.14, 0.014, 0.015] }, material: 'gunmetal', rank: 2 },
    bezel: { source: { kind: 'box', size: [0.056, 0.056, 0.01] }, material: 'darkSteel', rank: 1 },
    'lamp-green': { source: { kind: 'box', size: [0.036, 0.036, 0.02] }, material: 'lx:6500:1.5:steady:22ee44', rank: 1, sockets: { statusLed: { at: [0, 0.036, 0] } } },
    'lamp-amber': { source: { kind: 'box', size: [0.036, 0.036, 0.02] }, material: 'lx:3000:1.5:steady:ffaa00', rank: 1, sockets: { statusLed: { at: [0, 0.036, 0] } } },
    'lamp-red': { source: { kind: 'box', size: [0.036, 0.036, 0.02] }, material: 'lx:2000:1.5:steady:ee2222', rank: 1, sockets: { statusLed: { at: [0, 0.036, 0] } } },
    gland: { source: { kind: 'box', size: [0.09, 0.05, 0.09] }, material: 'copper', rank: 1, sockets: { cableTop: { at: [0, 0.05, 0] } } },
    bolt: { source: { kind: 'box', size: [0.018, 0.018, 0.012] }, material: 'darkSteel', rank: 2 },
  },
  assemblies: {
    'relay-cabinet': {
      children: [
        { ref: 'plinth', key: 'plinth' },
        { ref: 'body', key: 'body', at: [0, PLINTH_H, 0] },
        { ref: 'door', key: 'door', at: [0, DOOR_Y, FRONT + DOOR.d / 2] },
        { ref: 'handle', key: 'handle', at: [DOOR.w / 2 - 0.06, PLINTH_H + BODY_H / 2 - 0.07, FRONT + 0.04] },
        // the hinges sit flush on the body's face beside the door's edge (the validator caught them 3 mm proud, touching nothing)
        ...[PLINTH_H + BODY_H * 0.25, PLINTH_H + BODY_H * 0.75].map((hy, i): Placement => ({ ref: 'hinge', key: `hinge-${i}`, at: [-DOOR.w / 2 - 0.02, hy - 0.035, FRONT + 0.012] })),
        // tilted down (0.4 rad, as the labkit's) and set into the door's face, so each touches it
        ...Array.from({ length: LOUVRES }, (_, i): Placement => ({ ref: 'louvre', key: `louvre-${i}`, at: [0, PLINTH_H + 0.18 + i * 0.028 - 0.007, FRONT + 0.022], rot: [22.9, 0, 0] })),
        ...LAMP_X.map((x, i): Placement => ({ ref: 'bezel', key: `bezel-${i}`, at: [x, LAMP_Y - 0.028, FRONT + 0.02] })),
        ...(['lamp-green', 'lamp-amber', 'lamp-red'] as const).map((ref, i): Placement => ({ ref, key: ref, at: [LAMP_X[i]!, LAMP_Y - 0.018, FRONT + 0.025] })),
        { ref: 'gland', key: 'gland', at: [0, H, 0] },
        ...[-W / 2 + 0.03, W / 2 - 0.03].flatMap((bx, i) => [PLINTH_H + 0.06, H - 0.06].map((by, j): Placement => ({ ref: 'bolt', key: `bolt-${i}${j}`, at: [bx, by - 0.009, FRONT + 0.005] }))),
      ],
    },
  },
};
