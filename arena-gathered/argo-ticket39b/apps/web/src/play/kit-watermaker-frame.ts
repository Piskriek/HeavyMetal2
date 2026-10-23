/**
 * The Water Maker outer frame refitted to the measured `watermaker` GLB raycast profile (TICKET-39b, OPUS_NOTE_36).
 *
 * Measured `watermaker` core profile (raycast every 0.25 m):
 *  - BBox: x in [-3.87, 3.86], y in [0, 3.99], z in [-3.14, 3.14].
 *  - Skid (y < 0.30): x in [-3.19, 3.00], z in [-3.14, 3.14] (skid top at y = 0.30).
 *  - Legs (y = 0.80..1.05): open.
 *  - Tank (y = 1.80..3.30): x in [-3.80, 3.80] (+-3.4 to +-3.8), z in [-1.21, 1.32].
 *  - Top (y = 3.55..3.80): x in [-2.49, 2.38], z in [-0.96, 0.96] (+-0.84 to +-1.07).
 *
 * Refit placement:
 *  - Skid-mounted parts sit on `y = 0.30` outside the tank footprint (`z < -1.21` or `z > 1.32`, `x in [-3.19, 3.00]`):
 *    - 4 saddle piers at `(+-1.85, 0.30, +-1.68)` (z in +-1.44..1.92, clear of the z = -1.21..1.32 tank)
 *    - Intake hopper pedestal at `(2.66, 0.30, 1.68)` (x in 2.34..2.98 <= 3.00 skid edge, clear of tank)
 *    - Power box at `(0, 0.30, 1.56)` (on front skid apron outside z = 1.32 tank)
 *    - Condenser pipe duct at `(0, 0.30, 1.68)` between the front piers
 *    - Saddle brackets at `(+-1.85, 0.30, 1.92)` and skid bolts at `(x, 0.30, +-2.55)`
 *  - Frame-mounted parts: front and rear longitudinal spine beams across the pier tops at `y = 3.55..3.79, z = +-1.68`.
 *  - Core-face-mounted parts sit flush on measured tank and top faces:
 *    - `tank-panel-front` on tank `+z = 1.32` at `(0, 2.50, 1.32)` (`rot: [90, 0, 0]`, z in `1.32..1.36`)
 *    - `gauge-box` on tank `+z = 1.32` at `(-1.10, 2.35, 1.38)` (z in `1.32..1.44`)
 *    - `vent-box` on top `-z = -0.96` at `(0, 3.55, -1.08)` (z in `-1.20..-0.96`, with `vent-grille` on its rear face)
 */
import type { Kit } from '@hm/kitspec';

export const WATERMAKER_CORE_BOUNDS = {
  min: [-3.87, 0, -3.14],
  max: [3.86, 3.99, 3.14],
} as const;

const SKID_Y = 0.3;
const PIER_X = 1.85;
const PIER_Z = 1.68;
const PIER_H = 3.25;
const SPINE_Y = SKID_Y + PIER_H; // 3.55 m

export const WATERMAKER_FRAME_KIT: Kit = {
  parts: {
    'watermaker-core': {
      source: { kind: 'gen', asset: 'watermaker', bounds: WATERMAKER_CORE_BOUNDS },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        pierLF: { at: [-PIER_X, SKID_Y, PIER_Z] },
        pierRF: { at: [PIER_X, SKID_Y, PIER_Z] },
        pierLB: { at: [-PIER_X, SKID_Y, -PIER_Z] },
        pierRB: { at: [PIER_X, SKID_Y, -PIER_Z] },
        hopperStand: { at: [2.66, SKID_Y, PIER_Z] },
        spineFront: { at: [0, SPINE_Y, PIER_Z] },
        spineBack: { at: [0, SPINE_Y, -PIER_Z] },
        tankFrontPanel: { at: [0, 2.5, 1.32], rot: [90, 0, 0] },
        tankFrontGauge: { at: [-1.1, 2.35, 1.38] },
        topRearVent: { at: [0, 3.55, -1.08] },
        skidPowerFront: { at: [0, SKID_Y, 1.56] },
        skidFrontDuct: { at: [0, SKID_Y, PIER_Z] },
        bracketLF: { at: [-PIER_X, SKID_Y, 1.92] },
        bracketRF: { at: [PIER_X, SKID_Y, 1.92] },
        boltRowFront: { at: [-2.4, SKID_Y, 2.55] },
        boltRowBack: { at: [-2.4, SKID_Y, -2.55] },
      },
    },
    'watermaker-saddle-pier': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.48, depth: 0.48, height: PIER_H, bevel: 0.025, baseBand: 0.12, bands: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
    },
    'watermaker-hopper-column': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.64, depth: 0.64, height: 1.3, bevel: 0.025, baseBand: 0.12, bands: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 0,
    },
    'watermaker-spine-beam': {
      source: { kind: 'param', gen: 'beam', params: { length: 4.18, section: 0.24, wall: 0.018 } },
      material: 'hull-steel',
      rank: 0,
    },
    'watermaker-vent-box': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.96, depth: 0.24, height: 0.25, bevel: 0.015, baseBand: 0.05, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 1,
      sockets: {
        grilleBack: { at: [0, 0.03, -0.12], rot: [0, 180, 0] },
      },
    },
    'watermaker-tank-panel': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 1.36, depth: 0.78, thickness: 0.04, bevel: 0.008, seam: 0.02, boltsPerSide: 3, boltHead: 0.02 },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'watermaker-gauge-box': {
      source: { kind: 'box', size: [0.38, 0.38, 0.12] },
      material: 'accent-hardware',
      rank: 1,
    },
    'watermaker-power-box': {
      source: { kind: 'box', size: [0.44, 0.26, 0.24] },
      material: 'accent-hardware',
      rank: 1,
    },
    'watermaker-saddle-bracket': {
      source: {
        kind: 'param',
        gen: 'bracket',
        params: { width: 0.2, upright: 0.36, foot: 0.32, thickness: 0.02, gusset: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { steel: 'hull-steel', bolts: 'accent-hardware' },
      rank: 2,
    },
    'watermaker-skid-bolt': {
      source: {
        kind: 'param',
        gen: 'bolt',
        params: { headWidth: 0.045, headHeight: 0.022, shankDia: 0.02, shankLength: 0, head: 1 },
      },
      material: 'accent-hardware',
      rank: 2,
    },
    'watermaker-vent-grille': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 0.82, height: 0.2, depth: 0.04, frame: 0.025, slats: 4, slat: 0.01 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 2,
    },
    'watermaker-pipe-duct': {
      source: {
        kind: 'param',
        gen: 'duct',
        params: { length: 3.22, section: 0.16, wall: 0.012, flange: 0.03 },
      },
      material: 'accent-hardware',
      slotMaterials: { duct: 'accent-hardware', flange: 'hull-steel', bolts: 'accent-hardware' },
      rank: 2,
    },
  },
  assemblies: {
    'watermaker-frame': {
      children: [
        { ref: 'watermaker-core', key: 'core' },
        { ref: 'watermaker-saddle-pier', key: 'pier-lf', on: { child: 0, socket: 'pierLF' }, mirror: 'x' },
        { ref: 'watermaker-saddle-pier', key: 'pier-rf', on: { child: 0, socket: 'pierRF' } },
        { ref: 'watermaker-saddle-pier', key: 'pier-lb', on: { child: 0, socket: 'pierLB' }, mirror: 'x' },
        { ref: 'watermaker-saddle-pier', key: 'pier-rb', on: { child: 0, socket: 'pierRB' } },
        { ref: 'watermaker-hopper-column', key: 'hopper-column', on: { child: 0, socket: 'hopperStand' } },
        { ref: 'watermaker-spine-beam', key: 'spine-front', on: { child: 0, socket: 'spineFront' } },
        { ref: 'watermaker-spine-beam', key: 'spine-back', on: { child: 0, socket: 'spineBack' } },
        { ref: 'watermaker-vent-box', key: 'vent-box', on: { child: 0, socket: 'topRearVent' } },
        { ref: 'watermaker-tank-panel', key: 'tank-panel-front', on: { child: 0, socket: 'tankFrontPanel' } },
        { ref: 'watermaker-gauge-box', key: 'gauge-box', on: { child: 0, socket: 'tankFrontGauge' } },
        { ref: 'watermaker-power-box', key: 'power-box', on: { child: 0, socket: 'skidPowerFront' } },
        { ref: 'watermaker-saddle-bracket', key: 'bracket-left', on: { child: 0, socket: 'bracketLF' }, mirror: 'x' },
        { ref: 'watermaker-saddle-bracket', key: 'bracket-right', on: { child: 0, socket: 'bracketRF' } },
        {
          ref: 'watermaker-skid-bolt',
          key: 'bolts-front',
          on: { child: 0, socket: 'boltRowFront' },
          repeat: { count: 5, step: [1.2, 0, 0] },
        },
        {
          ref: 'watermaker-skid-bolt',
          key: 'bolts-back',
          on: { child: 0, socket: 'boltRowBack' },
          repeat: { count: 5, step: [1.2, 0, 0] },
        },
        { ref: 'watermaker-vent-grille', key: 'vent-grille', on: { child: 8, socket: 'grilleBack' } },
        { ref: 'watermaker-pipe-duct', key: 'pipe-duct', on: { child: 0, socket: 'skidFrontDuct' } },
      ],
      sockets: {
        vent: { at: [0, 3.155, -0.58] },
        feed: { at: [3.05, 1.6, 0] },
        hopper: { at: [3.05, 1.6, 0] },
        power: { at: [0, 0.2, 0.8] },
      },
    },
  },
};
