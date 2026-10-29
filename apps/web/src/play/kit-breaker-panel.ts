/**
 * The breaker panel, salvaged from the lab (plan 57 §14.2): the labkit's procedural `breakerPanel` rebuilt from scratch as a kit
 * (RULES 8a), so it is a preset like every prop. It keeps the labkit panel's measures:
 * - a 0.9 x 1.6 x 0.35 m box on four short legs with their feet;
 * - a rotary isolator (its base and handle) on a hazard plate at the box's middle;
 * - two panel meters, each with its glass and a status lamp above it (green, amber, as lx: lamp presets);
 * - ten louvres down each side, tilted;
 * - a cable gland under the box (the feed in) and one on top (the feed out).
 * Square sections throughout (the owner's rule): the labkit's round knob base, gauge bezels, lamps and glands are square here,
 * as square DIN panel meters are. The handle is black rubber: the lab's red handle has no material on the shelf yet.
 * Its Triad sockets:
 * - `cableIn` on the lower gland and `cableOut` on the upper (power);
 * - a `floorMount` under each foot (mount);
 * - `isolatorGrip` on the handle, where a hand or a drone turns it (mount);
 * - a `statusLed` on each lamp.
 *
 * Frame: the floor at y 0, centred on x and z, the face towards +z.
 */
import type { Kit, Placement } from '@hm/kitspec';

const W = 0.9;
const H = 1.6;
const D = 0.35;
const LEG_H = 0.25;
const BOX_H = H - LEG_H;
const FOOT_H = 0.01;
const FRONT = D / 2;
const ISO_Y = LEG_H + BOX_H * 0.45;
const METER_Y = LEG_H + BOX_H * 0.78;
const METER_X = [-0.22, 0.22] as const;
const LOUVRES = 10;
const LOUVRE_TILT = 17.2; // the labkit's 0.3 rad
const GLAND_X = W * 0.3;

export const BREAKER_PANEL_KIT: Kit = {
  parts: {
    foot: { source: { kind: 'box', size: [0.09, FOOT_H, 0.09] }, material: 'darkSteel', rank: 1, sockets: { floorMount: { at: [0, 0, 0], rot: [180, 0, 0] } } },
    leg: { source: { kind: 'box', size: [0.05, LEG_H - FOOT_H, 0.05] }, material: 'darkSteel', rank: 0 },
    box: { source: { kind: 'box', size: [W, BOX_H, D] }, material: 'paint', rank: 0 },
    'iso-plate': { source: { kind: 'box', size: [0.24, 0.24, 0.015] }, material: 'hazard', rank: 1 },
    'iso-base': { source: { kind: 'box', size: [0.13, 0.13, 0.03] }, material: 'darkSteel', rank: 1 },
    'iso-handle': { source: { kind: 'box', size: [0.035, 0.18, 0.035] }, material: 'rubber', rank: 1, sockets: { isolatorGrip: { at: [0, 0.15, 0.0175], rot: [90, 0, 0] } } },
    'meter-bezel': { source: { kind: 'box', size: [0.18, 0.18, 0.025] }, material: 'gunmetal', rank: 1 },
    'meter-glass': { source: { kind: 'box', size: [0.16, 0.16, 0.005] }, material: 'glass', rank: 2 },
    'lamp-green': { source: { kind: 'box', size: [0.028, 0.028, 0.015] }, material: 'lx:6500:1.5:steady:22cc44', rank: 1, sockets: { statusLed: { at: [0, 0.028, 0] } } },
    'lamp-amber': { source: { kind: 'box', size: [0.028, 0.028, 0.015] }, material: 'lx:3000:1.5:steady:ffaa00', rank: 1, sockets: { statusLed: { at: [0, 0.028, 0] } } },
    louvre: { source: { kind: 'box', size: [0.015, 0.015, D * 0.6] }, material: 'darkSteel', rank: 2 },
    'gland-in': { source: { kind: 'box', size: [0.07, 0.04, 0.07] }, material: 'copper', rank: 1, sockets: { cableIn: { at: [0, 0, 0], rot: [180, 0, 0] } } },
    'gland-out': { source: { kind: 'box', size: [0.07, 0.04, 0.07] }, material: 'copper', rank: 1, sockets: { cableOut: { at: [0, 0.04, 0] } } },
  },
  assemblies: {
    'breaker-panel': {
      children: [
        ...[-W / 2 + 0.06, W / 2 - 0.06].flatMap((lx, i) => [-D / 2 + 0.05, D / 2 - 0.05].flatMap((lz, j): Placement[] => [
          { ref: 'foot', key: `foot-${i}${j}`, at: [lx, 0, lz] },
          { ref: 'leg', key: `leg-${i}${j}`, at: [lx, FOOT_H, lz] },
        ])),
        { ref: 'box', key: 'box', at: [0, LEG_H, 0] },
        // the isolator: its plate on the face, the base on the plate, the handle on the base (labkit's pivot raised it 5 cm)
        { ref: 'iso-plate', key: 'iso-plate', at: [0, ISO_Y - 0.12, FRONT + 0.0075] },
        { ref: 'iso-base', key: 'iso-base', at: [0, ISO_Y - 0.065, FRONT + 0.015 + 0.015] },
        { ref: 'iso-handle', key: 'iso-handle', at: [0, ISO_Y - 0.04, FRONT + 0.045 + 0.0175] },
        ...METER_X.flatMap((gx, i): Placement[] => [
          { ref: 'meter-bezel', key: `meter-bezel-${i}`, at: [gx, METER_Y - 0.09, FRONT + 0.0125] },
          { ref: 'meter-glass', key: `meter-glass-${i}`, at: [gx, METER_Y - 0.08, FRONT + 0.025 + 0.0025] },
          { ref: i === 0 ? 'lamp-green' : 'lamp-amber', key: i === 0 ? 'lamp-green' : 'lamp-amber', at: [gx, METER_Y + 0.12 - 0.014, FRONT + 0.0075] },
        ]),
        // down each side, tilted out at the top, set into the side so each touches it
        ...[-1, 1].flatMap((side) => Array.from({ length: LOUVRES }, (_, s): Placement => ({
          ref: 'louvre', key: `louvre-${side < 0 ? 'l' : 'r'}${s}`,
          at: [side * (W / 2 + 0.005), LEG_H + 0.12 + s * 0.028 - 0.0075, 0], rot: [0, 0, -side * LOUVRE_TILT],
        }))),
        { ref: 'gland-in', key: 'gland-in', at: [-GLAND_X, LEG_H - 0.04, 0] },
        { ref: 'gland-out', key: 'gland-out', at: [GLAND_X, H, 0] },
      ],
    },
  },
};
