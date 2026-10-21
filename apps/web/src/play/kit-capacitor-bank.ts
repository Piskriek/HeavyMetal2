/**
 * The capacitor bank as a kit (plan 38 pilot; the owner, 2026-10-20: "why are we not just making one capacitor block and
 * placing 6 of them?"). One generated can (`capacitor-can`) stands six times on a skid, three wide and two deep, as on
 * sheet 21's power wall; everything else is square-section code: the skid, its hazard edges, a terminal cap on each can,
 * an insulator on each cap, a copper bus bar along each row, and the small parts (lifting eyes, skid bolts).
 *
 * Frame: the bank's base centre, y up, its rows along x (it stands with its back to the wall, as the labkit stand-in).
 * Ranks: 0 the skid and cans, 1 the caps, insulators, bus bars and hazard edges, 2 the lifting eyes and bolts.
 */
import type { Kit } from '@hm/kitspec';

/** The can's measured box (runworld-post fits it to 1.0 m tall: 0.51 x 1.00 x 0.52 m). */
export const CAN_BOUNDS = { min: [-0.255, 0, -0.26], max: [0.255, 1.0, 0.26] } as const;

const SKID_H = 0.14;
const CAN_X = 0.58;
const ROW_Z = 0.29;
const CAP_H = 0.06;
const INSULATOR_H = 0.09;
/** The charge lamp: 5 cm wide, 3.5 cm tall, 1.2 cm deep. */
const LAMP = [0.05, 0.035, 0.012] as const;
const CAN_TOP = SKID_H + CAN_BOUNDS.max[1];
const BAR_Y = CAN_TOP + CAP_H + INSULATOR_H;

export const CAPACITOR_BANK_KIT: Kit = {
  parts: {
    'capacitor-can': {
      source: { kind: 'gen', asset: 'capacitor-can', bounds: CAN_BOUNDS },
      material: 'gen',
      rank: 0,
      sockets: { top: { at: [0, CAN_BOUNDS.max[1], 0] } },
    },
    skid: { source: { kind: 'box', size: [2.0, SKID_H, 1.12] }, material: 'darkSteel', rank: 0 },
    'hazard-edge': { source: { kind: 'box', size: [1.98, 0.098, 0.02] }, material: 'hazard', rank: 1 },
    'terminal-cap': {
      source: { kind: 'box', size: [0.2, CAP_H, 0.2] }, material: 'darkSteel', rank: 1,
      // the stud on top; the charge lamp flush on the face toward the room (the lab stands the bank with its -z side to
      // the room, its +z side to the wall); a box's origin is its base centre
      sockets: { stud: { at: [0, CAP_H, 0] }, face: { at: [0, (CAP_H - LAMP[1]) / 2, -(0.1 + LAMP[2] / 2)] } },
    },
    // a square charge-indicator lamp on each cell's cap: a light cartridge (plan 39, Lx) sets its colour and pattern
    'charge-lamp': { source: { kind: 'box', size: [LAMP[0], LAMP[1], LAMP[2]] }, material: 'lamp', rank: 1 },
    insulator: { source: { kind: 'box', size: [0.075, INSULATOR_H, 0.075] }, material: 'gunmetal', rank: 1 },
    'bus-bar': { source: { kind: 'box', size: [1.3, 0.055, 0.055] }, material: 'copper', rank: 1 },
    'lifting-eye': { source: { kind: 'box', size: [0.07, 0.07, 0.016] }, material: 'gunmetal', rank: 2 },
    // a Shape Press bolt (@hm/partgen): its sliders and the beam's part cartridges can change it
    'skid-bolt': { source: { kind: 'param', gen: 'bolt', params: { headWidth: 0.04, headHeight: 0.02, shankLength: 0 } }, material: 'gunmetal', rank: 2 },
  },
  assemblies: {
    'capacitor-cell': {
      children: [
        { ref: 'capacitor-can', key: 'can' },
        { ref: 'terminal-cap', key: 'cap', on: { child: 0, socket: 'top' } },
        { ref: 'insulator', key: 'insulator', on: { child: 1, socket: 'stud' } },
        { ref: 'charge-lamp', key: 'lamp', on: { child: 1, socket: 'face' } },
      ],
    },
    'capacitor-bank': {
      children: [
        { ref: 'skid', key: 'skid' },
        { ref: 'hazard-edge', key: 'hazard-front', at: [0, 0.021, 0.57] },
        { ref: 'hazard-edge', key: 'hazard-back', at: [0, 0.021, -0.57] },
        { ref: 'capacitor-cell', key: 'front', at: [-CAN_X, SKID_H, ROW_Z], repeat: { count: 3, step: [CAN_X, 0, 0] } },
        { ref: 'capacitor-cell', key: 'back', at: [-CAN_X, SKID_H, -ROW_Z], repeat: { count: 3, step: [CAN_X, 0, 0] } },
        { ref: 'bus-bar', key: 'bar-front', at: [0, BAR_Y, ROW_Z] },
        { ref: 'bus-bar', key: 'bar-back', at: [0, BAR_Y, -ROW_Z] },
        { ref: 'lifting-eye', key: 'eyes-front', at: [-0.94, SKID_H, 0.5], repeat: { count: 2, step: [1.88, 0, 0] } },
        { ref: 'lifting-eye', key: 'eyes-back', at: [-0.94, SKID_H, -0.5], repeat: { count: 2, step: [1.88, 0, 0] } },
        { ref: 'skid-bolt', key: 'bolts-left', at: [-0.92, SKID_H, -0.2], repeat: { count: 2, step: [0, 0, 0.4] } },
        { ref: 'skid-bolt', key: 'bolts-right', at: [0.92, SKID_H, -0.2], repeat: { count: 2, step: [0, 0, 0.4] } },
      ],
    },
  },
};
