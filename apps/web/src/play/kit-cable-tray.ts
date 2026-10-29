/**
 * The cable tray, salvaged from the lab (plan 57 §14.2): the labkit's procedural `cableTray` rebuilt from scratch as a kit
 * (RULES 8a). The labkit drew one tray of any length between two points; a kit is a section that tiles end to end, so this is a
 * 1.8 m section (the labkit's hanger spacing) with its supports a quarter in from each end: tiled, they stand 0.9 m apart.
 * It keeps the labkit tray's measures: 0.45 m wide, 8 cm rails, a rung every 0.3 m and three cables (rubber, steel, rubber)
 * laid on the rungs. The cables are square bundles here, as kits have no round part yet.
 * Two presets share the run:
 * - `cable-tray`: standing on H-frames (two square posts, a crossbar and base plates), its rungs 0.6 m up. The simulation is
 *   outdoors, with no ceiling to hang from, and plant cable runs stand on frames like this.
 * - `cable-tray-hung`: the lab's way, the same trapeze crossbars hung from a ceiling on drop rods with their flanges.
 *   Its frame has the ceiling at y 0 and everything below it; it validates against the ceiling as its anchor.
 * Its Triad sockets:
 * - `cableEndFront` and `cableEndBack` at the run's two ends, where the next section and its cables join (power);
 * - a `floorMount` under each base plate, or a `ceilingMount` on each flange (mount).
 *
 * Frame: the run along z, centred on x and z.
 */
import type { Kit, Placement } from '@hm/kitspec';

const L = 1.8;
const TRAY_W = 0.45;
const RAIL_H = 0.08;
const RAIL_T = 0.02;
const RUNG_H = 0.015;
const RUNGS = 6;
const CABLE = 0.044;
const CABLE_X = [-0.11, 0, 0.11] as const;
const BAR_W = TRAY_W + 0.12;
const BAR_H = 0.03;
const POST = 0.04;
const POST_X = TRAY_W / 2 + 0.04;
const PLATE_H = 0.01;
const SUPPORT_Z = [-L / 4, L / 4] as const;
/** The standing run's rung bottoms above the floor. */
const STAND_Y = 0.6;
/** The hung run's rung bottoms below the ceiling. */
const DROP = 0.6;
const ROD = 0.016;
const FLANGE_H = 0.015;

export const CABLE_TRAY_KIT: Kit = {
  parts: {
    rail: { source: { kind: 'box', size: [RAIL_T, RAIL_H, L] }, material: 'gunmetal', rank: 0 },
    rung: {
      source: { kind: 'box', size: [TRAY_W - 2 * RAIL_T, RUNG_H, 0.03] }, material: 'darkSteel', rank: 1,
    },
    'cable-rubber': { source: { kind: 'box', size: [CABLE, CABLE, L] }, material: 'rubber', rank: 1 },
    'cable-steel': { source: { kind: 'box', size: [CABLE, CABLE, L] }, material: 'darkSteel', rank: 1 },
    // the run's two ends carry the joins: a thin end rung each, so each socket sits on a part and faces out along the run
    'end-rung-front': {
      source: { kind: 'box', size: [TRAY_W - 2 * RAIL_T, RUNG_H, 0.01] }, material: 'darkSteel', rank: 1,
      sockets: { cableEndFront: { at: [0, RUNG_H, 0.005], rot: [90, 0, 0] } },
    },
    'end-rung-back': {
      source: { kind: 'box', size: [TRAY_W - 2 * RAIL_T, RUNG_H, 0.01] }, material: 'darkSteel', rank: 1,
      sockets: { cableEndBack: { at: [0, RUNG_H, -0.005], rot: [-90, 0, 0] } },
    },
    crossbar: { source: { kind: 'box', size: [BAR_W, BAR_H, 0.04] }, material: 'darkSteel', rank: 0 },
    post: { source: { kind: 'box', size: [POST, STAND_Y - BAR_H - PLATE_H, POST] }, material: 'gunmetal', rank: 0 },
    'base-plate': {
      source: { kind: 'box', size: [0.1, PLATE_H, 0.1] }, material: 'darkSteel', rank: 1,
      sockets: { floorMount: { at: [0, 0, 0], rot: [180, 0, 0] } },
    },
    rod: { source: { kind: 'box', size: [ROD, DROP + BAR_H - FLANGE_H, ROD] }, material: 'gunmetal', rank: 1 },
    flange: {
      source: { kind: 'box', size: [0.08, FLANGE_H, 0.08] }, material: 'darkSteel', rank: 1,
      sockets: { ceilingMount: { at: [0, FLANGE_H, 0] } },
    },
  },
  assemblies: {
    // the tray itself, its rung bottoms at y 0: rails either side, rungs between them, the cables laid on the rungs
    'tray-run': {
      children: [
        ...[-1, 1].map((side): Placement => ({ ref: 'rail', key: `rail-${side < 0 ? 'l' : 'r'}`, at: [side * (TRAY_W / 2 - RAIL_T / 2), 0, 0] })),
        ...Array.from({ length: RUNGS }, (_, i): Placement => ({ ref: 'rung', key: `rung-${i}`, at: [0, 0, (i - (RUNGS - 1) / 2) * 0.3] })),
        { ref: 'end-rung-front', key: 'end-front', at: [0, 0, L / 2 - 0.005] },
        { ref: 'end-rung-back', key: 'end-back', at: [0, 0, -L / 2 + 0.005] },
        ...CABLE_X.map((cx, c): Placement => ({ ref: c === 1 ? 'cable-steel' : 'cable-rubber', key: `cable-${c}`, at: [cx, RUNG_H, 0] })),
      ],
    },
    'cable-tray': {
      children: [
        { ref: 'tray-run', key: 'run', at: [0, STAND_Y, 0] },
        ...SUPPORT_Z.flatMap((z, i): Placement[] => [
          { ref: 'crossbar', key: `crossbar-${i}`, at: [0, STAND_Y - BAR_H, z] },
          ...[-1, 1].flatMap((side): Placement[] => [
            { ref: 'base-plate', key: `plate-${i}${side < 0 ? 'l' : 'r'}`, at: [side * POST_X, 0, z] },
            { ref: 'post', key: `post-${i}${side < 0 ? 'l' : 'r'}`, at: [side * POST_X, PLATE_H, z] },
          ]),
        ]),
      ],
    },
    'cable-tray-hung': {
      children: [
        { ref: 'tray-run', key: 'run', at: [0, -DROP, 0] },
        ...SUPPORT_Z.flatMap((z, i): Placement[] => [
          { ref: 'crossbar', key: `crossbar-${i}`, at: [0, -DROP - BAR_H, z] },
          ...[-1, 1].flatMap((side): Placement[] => [
            { ref: 'rod', key: `rod-${i}${side < 0 ? 'l' : 'r'}`, at: [side * POST_X, -DROP - BAR_H, z] },
            { ref: 'flange', key: `flange-${i}${side < 0 ? 'l' : 'r'}`, at: [side * POST_X, -FLANGE_H, z] },
          ]),
        ]),
      ],
    },
  },
};
