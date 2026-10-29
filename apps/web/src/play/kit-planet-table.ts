/**
 * The planet table, salvaged from the lab (plan 57 §14.2): the labkit's procedural `planetTable` rebuilt from scratch as a kit
 * (RULES 8a). The lab's table showed the Moon and the worlds beyond the gate as a hologram above its top; in the simulation it
 * is the seeded system's map table. It keeps the labkit table's measures: 2.4 m across, its top at 0.95 m, a 1.3 m base, a
 * column under a stepped rim, a projection pad and four control panels with their lamps.
 * Square throughout (the owner's rule): the labkit's round table needed no roundness to project, so its base, column, rims and
 * pad are square here, and its ring of twelve base bolts is eight round a square.
 * Its Triad sockets:
 * - `floorMount` under the base (mount) and `powerCable` at the base's back (power);
 * - `holoOutput` on the pad, where the hologram stands (output);
 * - a `statusLed` on each panel lamp.
 *
 * Frame: the floor at y 0, centred on x and z, the power cable towards -z.
 */
import type { Kit, Placement } from '@hm/kitspec';

const SIDE = 2.4;
const TOP_Y = 0.95;
const BASE = 1.3;
const BASE_H = 0.04;
const RIM_H = 0.1;
const SUB_RIM = { side: SIDE * 0.7, h: 0.08 } as const;
const COLUMN = 0.82;
const COLUMN_H = TOP_Y - RIM_H - SUB_RIM.h - BASE_H;
const PAD = SIDE * 0.75;
const PANEL_AT = SIDE / 2 - 0.12;
const BOLT_AT = BASE / 2 - 0.05;

export const PLANET_TABLE_KIT: Kit = {
  parts: {
    base: {
      source: { kind: 'box', size: [BASE, BASE_H, BASE] }, material: 'darkSteel', rank: 0,
      sockets: { floorMount: { at: [0, 0, 0], rot: [180, 0, 0] }, powerCable: { at: [0, BASE_H / 2, -BASE / 2], rot: [-90, 0, 0] } },
    },
    bolt: { source: { kind: 'box', size: [0.03, 0.02, 0.03] }, material: 'gunmetal', rank: 2 },
    column: { source: { kind: 'box', size: [COLUMN, COLUMN_H, COLUMN] }, material: 'paint', rank: 0 },
    'sub-rim': { source: { kind: 'box', size: [SUB_RIM.side, SUB_RIM.h, SUB_RIM.side] }, material: 'darkSteel', rank: 0 },
    rim: { source: { kind: 'box', size: [SIDE, RIM_H, SIDE] }, material: 'gunmetal', rank: 0 },
    pad: {
      source: { kind: 'box', size: [PAD, 0.01, PAD] }, material: 'lx:6500:0.7:steady:33ccff', rank: 1,
      sockets: { holoOutput: { at: [0, 0.01, 0] } },
    },
    // a control panel along the rim's edge, long side towards the centre (rotated a quarter turn for the other two edges)
    panel: { source: { kind: 'box', size: [0.24, 0.015, 0.14] }, material: 'darkSteel', rank: 1 },
    'lamp-green': { source: { kind: 'box', size: [0.02, 0.02, 0.02] }, material: 'lx:6500:1.5:steady:22cc44', rank: 2, sockets: { statusLed: { at: [0, 0.02, 0] } } },
    'lamp-amber': { source: { kind: 'box', size: [0.02, 0.02, 0.02] }, material: 'lx:3000:1.5:steady:ffaa00', rank: 2, sockets: { statusLed: { at: [0, 0.02, 0] } } },
  },
  assemblies: {
    'planet-table': {
      children: [
        { ref: 'base', key: 'base' },
        ...[-1, 0, 1].flatMap((i) => [-1, 0, 1].filter((j) => i !== 0 || j !== 0).map((j): Placement => ({ ref: 'bolt', key: `bolt-${i + 1}${j + 1}`, at: [i * BOLT_AT, BASE_H, j * BOLT_AT] }))),
        { ref: 'column', key: 'column', at: [0, BASE_H, 0] },
        { ref: 'sub-rim', key: 'sub-rim', at: [0, BASE_H + COLUMN_H, 0] },
        { ref: 'rim', key: 'rim', at: [0, TOP_Y - RIM_H, 0] },
        { ref: 'pad', key: 'pad', at: [0, TOP_Y, 0] },
        ...([[PANEL_AT, 0], [0, PANEL_AT], [-PANEL_AT, 0], [0, -PANEL_AT]] as const).flatMap(([px, pz], p): Placement[] => [
          { ref: 'panel', key: `panel-${p}`, at: [px, TOP_Y, pz], ...(p % 2 === 1 ? { rot: [0, 90, 0] as const } : {}) },
          { ref: p % 2 === 0 ? 'lamp-green' : 'lamp-amber', key: `lamp-${p}`, at: [px, TOP_Y + 0.015, pz] },
        ]),
      ],
    },
  },
};
