/**
 * The Texture Mill outer frame refitted to the measured `mill` GLB raycast profile (TICKET-39b, OPUS_NOTE_36).
 *
 * Measured `mill` core profile (raycast every 0.25 m):
 *  - BBox: x in [-2.00, 2.00], y in [0, 4.01], z in [-2.00, 2.00].
 *  - Plinth (y < 0.15): x in [-2.00, 2.00], z in [-2.00, 2.00] (top surface at y = 0.15).
 *  - Step (y = 0.30): x in [-1.29, 1.29], z in [-1.29, 1.29].
 *  - Body (y = 0.55..3.05): +-1.06 to +-1.11 (average +-1.08), with the +x stack recess at x = 0.91 (y = 1.05..1.80).
 *  - Waist (y = 3.30): +-0.76.
 *  - Top lip (y = 3.80): +-1.10.
 *
 * Refit placement:
 *  - Plinth-mounted parts sit on `y = 0.15` outside `+-1.29`: 4 corner columns at `(+-1.68, 0.15, +-1.68)`,
 *    corner brackets at `(+-1.68, 0.15, 1.82)` facing +z, plinth bolts at `(+-1.88, 0.15, z)`,
 *    power box at `(0, 0.15, -1.80)`, and rear cable duct at `(0, 0.15, -1.68)`.
 *  - Frame-mounted parts sit on the 4 corner columns (`y = 3.72`): front/back crown beams and left/right tie beams.
 *  - Core-face-mounted parts sit flush on measured faces (vertical panels rotated so their back is on the core face and bolts face outward):
 *    - `front-door` on `+z = 1.08` at `(0, 1.50, 1.08)` (`rot: [90, 0, 0]`, z in `1.08..1.13`, y in `0.85..2.15`)
 *    - `status-led-bar` on `+z = 1.08` at `(0.44, 2.45, 1.08)` (`rot: [90, 0, 0]`, z in `1.08..1.12`)
 *    - `stack-manifold` on `+x = 0.91` stack recess at `(0.99, 1.05, 0)` (x in `0.91..1.07`, y in `1.05..1.95`, with `vent-grille` on its outer +x face)
 *    - `top-lip-collar` on `+z = 1.10` top lip at `(0, 3.80, 1.10)` (`rot: [90, 0, 0]`, z in `1.10..1.15`)
 */
import type { Kit } from '@hm/kitspec';

export const MILL_CORE_BOUNDS = {
  min: [-2.0, 0, -2.0],
  max: [2.0, 4.01, 2.0],
} as const;

const PLINTH_Y = 0.15;
const COL_X = 1.68;
const COL_Z = 1.68;
const COL_H = 3.57;
const CROWN_Y = PLINTH_Y + COL_H; // 3.72 m

export const MILL_FRAME_KIT: Kit = {
  parts: {
    'mill-core': {
      source: { kind: 'gen', asset: 'mill', bounds: MILL_CORE_BOUNDS },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        colLF: { at: [-COL_X, PLINTH_Y, COL_Z] },
        colRF: { at: [COL_X, PLINTH_Y, COL_Z] },
        colLB: { at: [-COL_X, PLINTH_Y, -COL_Z] },
        colRB: { at: [COL_X, PLINTH_Y, -COL_Z] },
        crownFront: { at: [0, CROWN_Y, COL_Z] },
        crownBack: { at: [0, CROWN_Y, -COL_Z] },
        tieLeft: { at: [-COL_X, CROWN_Y, 0], rot: [0, 90, 0] },
        tieRight: { at: [COL_X, CROWN_Y, 0], rot: [0, 90, 0] },
        frontBodyDoor: { at: [0, 1.5, 1.08], rot: [90, 0, 0] },
        frontBodyStatus: { at: [0.44, 2.45, 1.08], rot: [90, 0, 0] },
        stackRecessPlusX: { at: [0.99, 1.05, 0] },
        topLipFront: { at: [0, 3.8, 1.1], rot: [90, 0, 0] },
        plinthPowerRear: { at: [0, PLINTH_Y, -1.8] },
        plinthRearDuct: { at: [0, PLINTH_Y, -COL_Z] },
        plinthBracketFL: { at: [-COL_X, PLINTH_Y, 1.82] },
        plinthBracketFR: { at: [COL_X, PLINTH_Y, 1.82] },
        plinthBoltsLeft: { at: [-1.88, PLINTH_Y, -1.5] },
        plinthBoltsRight: { at: [1.88, PLINTH_Y, -1.5] },
      },
    },
    'mill-corner-column': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.28, depth: 0.28, height: COL_H, bevel: 0.02, baseBand: 0.12, bands: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
    },
    'mill-crown-beam': {
      source: { kind: 'param', gen: 'beam', params: { length: 3.64, section: 0.24, wall: 0.02 } },
      material: 'hull-steel',
      rank: 0,
    },
    'mill-access-door': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.96, depth: 1.3, thickness: 0.05, bevel: 0.01, seam: 0.03, boltsPerSide: 3, boltHead: 0.025 },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'mill-status-bar': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.36, depth: 0.16, thickness: 0.04, bevel: 0.006, seam: 0.015, boltsPerSide: 2, boltHead: 0.015 },
      },
      material: 'accent-hardware',
      slotMaterials: { plate: 'accent-hardware', bolts: 'hull-steel' },
      rank: 1,
    },
    'mill-stack-manifold': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.16, depth: 0.56, height: 0.9, bevel: 0.015, baseBand: 0.08, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 1,
      sockets: {
        grilleOut: { at: [0.08, 0.12, 0], rot: [0, 90, 0] },
      },
    },
    'mill-top-lip-collar': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.92, depth: 0.18, thickness: 0.05, bevel: 0.008, seam: 0.02, boltsPerSide: 3, boltHead: 0.02 },
      },
      material: 'accent-hardware',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'mill-power-junction': {
      source: { kind: 'box', size: [0.44, 0.26, 0.24] },
      material: 'accent-hardware',
      rank: 1,
    },
    'mill-corner-bracket': {
      source: {
        kind: 'param',
        gen: 'bracket',
        params: { width: 0.18, upright: 0.32, foot: 0.16, thickness: 0.018, gusset: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { steel: 'hull-steel', bolts: 'accent-hardware' },
      rank: 2,
    },
    'mill-skid-bolt': {
      source: {
        kind: 'param',
        gen: 'bolt',
        params: { headWidth: 0.045, headHeight: 0.022, shankDia: 0.02, shankLength: 0, head: 1 },
      },
      material: 'accent-hardware',
      rank: 2,
    },
    'mill-vent-grille': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 0.42, height: 0.64, depth: 0.04, frame: 0.03, slats: 6, slat: 0.01 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 2,
    },
    'mill-cable-duct': {
      source: {
        kind: 'param',
        gen: 'duct',
        params: { length: 3.08, section: 0.14, wall: 0.01, flange: 0.025 },
      },
      material: 'accent-hardware',
      slotMaterials: { duct: 'hull-steel', flange: 'accent-hardware', bolts: 'accent-hardware' },
      rank: 2,
    },
  },
  assemblies: {
    'mill-frame': {
      children: [
        { ref: 'mill-core', key: 'core' },
        { ref: 'mill-corner-column', key: 'col-lf', on: { child: 0, socket: 'colLF' }, mirror: 'x' },
        { ref: 'mill-corner-column', key: 'col-rf', on: { child: 0, socket: 'colRF' } },
        { ref: 'mill-corner-column', key: 'col-lb', on: { child: 0, socket: 'colLB' }, mirror: 'x' },
        { ref: 'mill-corner-column', key: 'col-rb', on: { child: 0, socket: 'colRB' } },
        { ref: 'mill-crown-beam', key: 'crown-front', on: { child: 0, socket: 'crownFront' } },
        { ref: 'mill-crown-beam', key: 'crown-back', on: { child: 0, socket: 'crownBack' } },
        { ref: 'mill-crown-beam', key: 'tie-left', on: { child: 0, socket: 'tieLeft' } },
        { ref: 'mill-crown-beam', key: 'tie-right', on: { child: 0, socket: 'tieRight' } },
        { ref: 'mill-access-door', key: 'front-door', on: { child: 0, socket: 'frontBodyDoor' } },
        { ref: 'mill-status-bar', key: 'status-led-bar', on: { child: 0, socket: 'frontBodyStatus' } },
        { ref: 'mill-stack-manifold', key: 'stack-manifold', on: { child: 0, socket: 'stackRecessPlusX' } },
        { ref: 'mill-top-lip-collar', key: 'top-lip-collar', on: { child: 0, socket: 'topLipFront' } },
        { ref: 'mill-power-junction', key: 'power-box', on: { child: 0, socket: 'plinthPowerRear' } },
        { ref: 'mill-corner-bracket', key: 'bracket-fl', on: { child: 0, socket: 'plinthBracketFL' }, mirror: 'x' },
        { ref: 'mill-corner-bracket', key: 'bracket-fr', on: { child: 0, socket: 'plinthBracketFR' } },
        {
          ref: 'mill-skid-bolt',
          key: 'bolts-left',
          on: { child: 0, socket: 'plinthBoltsLeft' },
          repeat: { count: 4, step: [0, 0, 1.0] },
        },
        {
          ref: 'mill-skid-bolt',
          key: 'bolts-right',
          on: { child: 0, socket: 'plinthBoltsRight' },
          repeat: { count: 4, step: [0, 0, 1.0] },
        },
        { ref: 'mill-vent-grille', key: 'vent-grille', on: { child: 11, socket: 'grilleOut' } },
        { ref: 'mill-cable-duct', key: 'rear-duct', on: { child: 0, socket: 'plinthRearDuct' } },
      ],
      sockets: {
        vent: { at: [1.715, 2.28, -0.48] },
        stack: { at: [1.715, 2.28, -0.48] },
        feed: { at: [0, 4.16, 0] },
        hopper: { at: [0, 4.16, 0] },
        power: { at: [0, 0.2, -1.8] },
      },
    },
  },
};
