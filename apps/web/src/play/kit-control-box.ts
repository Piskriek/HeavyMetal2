/**
 * The control box, salvaged from the lab (plan 57 §14.2): the labkit's procedural `controlBox` rebuilt from scratch as a kit
 * (RULES 8a). It is wall-mounted, as concept sheet 21 set it (no stand, no post), so its preset declares `mount: 'wall'`: it
 * validates against the wall behind it, and the Studio draws that wall. It keeps the labkit box's measures:
 * - a 0.44 x 0.62 m mounting plate flat on the wall, held by four bolts;
 * - a 0.35 x 0.45 x 0.2 m box standing off the plate;
 * - two status lamps in their bezels (green and red, as lx: lamp presets), and two push buttons in their collars (black and amber);
 * - four vent slots down its left side, and a cable gland underneath.
 * Square sections throughout: the labkit's round bolts, bezels, collars, buttons and gland are square here.
 * Its Triad sockets:
 * - `wallMount` behind the plate (mount) and `cableBottom` under the gland (power);
 * - `startInput` and `stopInput` on the buttons, where a hand or the drone presses (input);
 * - a `statusLed` on each lamp.
 *
 * Frame: the wall is the plane z 0, the box faces +z, and the origin is the box's centre on the wall (the lab hung it at 1.4 m).
 */
import type { Kit, Placement } from '@hm/kitspec';

const PLATE = { w: 0.44, h: 0.62, d: 0.02 } as const;
const BOX = { w: 0.35, h: 0.45, d: 0.2 } as const;
const FRONT = PLATE.d + BOX.d;
const ROW_X = [-0.07, 0.07] as const;
const LAMP_Y = 0.11;
const BUTTON_Y = -0.06;

export const CONTROL_BOX_KIT: Kit = {
  parts: {
    plate: {
      source: { kind: 'box', size: [PLATE.w, PLATE.h, PLATE.d] }, material: 'darkSteel', rank: 0,
      sockets: { wallMount: { at: [0, PLATE.h / 2, -PLATE.d / 2], rot: [-90, 0, 0] } },
    },
    bolt: { source: { kind: 'box', size: [0.024, 0.024, 0.015] }, material: 'gunmetal', rank: 2 },
    box: { source: { kind: 'box', size: [BOX.w, BOX.h, BOX.d] }, material: 'paint', rank: 0 },
    bezel: { source: { kind: 'box', size: [0.05, 0.05, 0.01] }, material: 'darkSteel', rank: 1 },
    'lamp-green': { source: { kind: 'box', size: [0.036, 0.036, 0.02] }, material: 'lx:6500:1.5:steady:22cc44', rank: 1, sockets: { statusLed: { at: [0, 0.036, 0] } } },
    'lamp-red': { source: { kind: 'box', size: [0.036, 0.036, 0.02] }, material: 'lx:2000:1.5:steady:ee2222', rank: 1, sockets: { statusLed: { at: [0, 0.036, 0] } } },
    collar: { source: { kind: 'box', size: [0.048, 0.048, 0.015] }, material: 'darkSteel', rank: 1 },
    'button-start': {
      source: { kind: 'box', size: [0.034, 0.034, 0.02] }, material: 'rubber', rank: 1,
      sockets: { startInput: { at: [0, 0.017, 0.01], rot: [90, 0, 0] } },
    },
    'button-stop': {
      source: { kind: 'box', size: [0.034, 0.034, 0.02] }, material: 'hazard', rank: 1,
      sockets: { stopInput: { at: [0, 0.017, 0.01], rot: [90, 0, 0] } },
    },
    vent: { source: { kind: 'box', size: [0.01, 0.012, 0.1] }, material: 'darkSteel', rank: 2 },
    gland: {
      source: { kind: 'box', size: [0.048, 0.04, 0.048] }, material: 'copper', rank: 1,
      sockets: { cableBottom: { at: [0, 0, 0], rot: [180, 0, 0] } },
    },
  },
  assemblies: {
    'control-box': {
      mount: 'wall',
      children: [
        { ref: 'plate', key: 'plate', at: [0, -PLATE.h / 2, PLATE.d / 2] },
        ...[-0.17, 0.17].flatMap((bx, i) => [-0.24, 0.24].map((by, j): Placement => ({ ref: 'bolt', key: `bolt-${i}${j}`, at: [bx, by - 0.012, PLATE.d + 0.0075] }))),
        { ref: 'box', key: 'box', at: [0, -BOX.h / 2, PLATE.d + BOX.d / 2] },
        ...ROW_X.flatMap((x, i): Placement[] => [
          { ref: 'bezel', key: `bezel-${i}`, at: [x, LAMP_Y - 0.025, FRONT + 0.005] },
          { ref: i === 0 ? 'lamp-green' : 'lamp-red', key: i === 0 ? 'lamp-green' : 'lamp-red', at: [x, LAMP_Y - 0.018, FRONT + 0.01 + 0.01] },
          { ref: 'collar', key: `collar-${i}`, at: [x, BUTTON_Y - 0.024, FRONT + 0.0075] },
          { ref: i === 0 ? 'button-start' : 'button-stop', key: i === 0 ? 'button-start' : 'button-stop', at: [x, BUTTON_Y - 0.017, FRONT + 0.015 + 0.01] },
        ]),
        ...Array.from({ length: 4 }, (_, s): Placement => ({ ref: 'vent', key: `vent-${s}`, at: [-BOX.w / 2 - 0.005 + 0.002, -0.1 + s * 0.03 - 0.006, PLATE.d + BOX.d / 2] })),
        { ref: 'gland', key: 'gland', at: [0, -BOX.h / 2 - 0.04, PLATE.d + BOX.d / 2] },
      ],
    },
  },
};
