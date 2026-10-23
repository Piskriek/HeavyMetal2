/**
 * The Texture Mill outer frame around its heavygear / generated core (TICKET-39, ARGO_NOTE_34 §4a/4b).
 *
 * The `mill-core` (`gen` asset `'mill'`) is a single Rank-0 solid with named sockets where the
 * modular outer frame parts mount:
 *  - Rank 0: Core housing, heavy base skid, mirrored corner frame columns, top crown beam, and feed hopper collar.
 *  - Rank 1: Front/rear inspection doors, side exhaust stack hood at `[1.715, 2.28, -0.48]`, status LED bar, and control box.
 *  - Rank 2: Corner gusset brackets, skid hex bolts, side stack exhaust grille, and rear cable duct.
 *
 * Preserves exact `machine-props.ts` sockets:
 *  - `vent` / `stack`: `[1.715, 2.28, -0.48]`
 *  - `feed` / `hopper`: `[0, 4.16, 0]`
 *  - `power`: `[0, 0.2, -1.8]`
 */
import type { Kit } from '@hm/kitspec';

export const MILL_CORE_BOUNDS = {
  min: [-1.72, 0, -1.72],
  max: [1.72, 3.88, 1.72],
} as const;

export const MILL_FRAME_KIT: Kit = {
  parts: {
    'mill-core': {
      source: { kind: 'gen', asset: 'mill', bounds: MILL_CORE_BOUNDS },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        skidBase: { at: [0, 0, 0] },
        colLeftFront: { at: [-1.72, 0.18, 1.48] },
        colRightFront: { at: [1.72, 0.18, 1.48] },
        colLeftBack: { at: [-1.72, 0.18, -1.48] },
        colRightBack: { at: [1.72, 0.18, -1.48] },
        crownSeat: { at: [0, 3.72, 0] },
        hopperSeat: { at: [0, 3.67, 0] },
        ventMount: { at: [1.715, 1.92, -0.48] },
        frontDoor: { at: [0, 0.85, 1.72] },
        statusMount: { at: [0.44, 1.32, 1.72] },
        powerMount: { at: [0, 0.18, -1.72] },
        rearDuctMount: { at: [0, 0.18, -1.62] },
      },
    },
    'mill-base-skid': {
      source: { kind: 'box', size: [3.96, 0.18, 3.96] },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        boltLeft: { at: [-1.82, 0.18, -1.5] },
        boltRight: { at: [1.82, 0.18, -1.5] },
        bracketFL: { at: [-1.72, 0.18, 1.68] },
        bracketFR: { at: [1.72, 0.18, 1.68] },
      },
    },
    'mill-corner-column': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.28, depth: 0.28, height: 3.56, bevel: 0.02, baseBand: 0.12, bands: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
    },
    'mill-crown-beam': {
      source: { kind: 'param', gen: 'beam', params: { length: 3.72, section: 0.26, wall: 0.02 } },
      material: 'hull-steel',
      rank: 0,
    },
    'mill-hopper-collar': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.92, depth: 0.92, height: 0.32, bevel: 0.02, baseBand: 0.08, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 0,
    },
    'mill-vent-hood': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.42, depth: 0.42, height: 0.44, bevel: 0.02, baseBand: 0.08, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 1,
      sockets: {
        grilleFace: { at: [0, 0.06, 0.21] },
      },
    },
    'mill-access-door': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 1.15, depth: 0.05, thickness: 1.45, bevel: 0.01, seam: 0.03, boltsPerSide: 3, boltHead: 0.025 },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'mill-status-bar': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.36, depth: 0.05, thickness: 0.16, bevel: 0.006, seam: 0.015, boltsPerSide: 2, boltHead: 0.015 },
      },
      material: 'accent-hardware',
      slotMaterials: { plate: 'accent-hardware', bolts: 'hull-steel' },
      rank: 1,
    },
    'mill-power-junction': {
      source: { kind: 'box', size: [0.46, 0.28, 0.24] },
      material: 'accent-hardware',
      rank: 1,
    },
    'mill-corner-bracket': {
      source: {
        kind: 'param',
        gen: 'bracket',
        params: { width: 0.18, upright: 0.32, foot: 0.26, thickness: 0.018, gusset: 1 },
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
        params: { width: 0.32, height: 0.28, depth: 0.04, frame: 0.03, slats: 5, slat: 0.01 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 2,
    },
    'mill-cable-duct': {
      source: {
        kind: 'param',
        gen: 'duct',
        params: { length: 2.8, section: 0.14, wall: 0.01, flange: 0.025 },
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
        { ref: 'mill-base-skid', key: 'skid', on: { child: 0, socket: 'skidBase' } },
        { ref: 'mill-corner-column', key: 'col-lf', on: { child: 0, socket: 'colLeftFront' }, mirror: 'x' },
        { ref: 'mill-corner-column', key: 'col-rf', on: { child: 0, socket: 'colRightFront' } },
        { ref: 'mill-corner-column', key: 'col-lb', on: { child: 0, socket: 'colLeftBack' }, mirror: 'x' },
        { ref: 'mill-corner-column', key: 'col-rb', on: { child: 0, socket: 'colRightBack' } },
        { ref: 'mill-crown-beam', key: 'crown-front', on: { child: 0, socket: 'crownSeat' }, at: [0, 0, 1.48] },
        { ref: 'mill-crown-beam', key: 'crown-back', on: { child: 0, socket: 'crownSeat' }, at: [0, 0, -1.48] },
        { ref: 'mill-hopper-collar', key: 'hopper-collar', on: { child: 0, socket: 'hopperSeat' } },
        { ref: 'mill-vent-hood', key: 'vent-hood', on: { child: 0, socket: 'ventMount' } },
        { ref: 'mill-access-door', key: 'front-door', on: { child: 0, socket: 'frontDoor' } },
        { ref: 'mill-status-bar', key: 'status-led-bar', on: { child: 0, socket: 'statusMount' } },
        { ref: 'mill-power-junction', key: 'power-box', on: { child: 0, socket: 'powerMount' } },
        { ref: 'mill-corner-bracket', key: 'bracket-fl', on: { child: 1, socket: 'bracketFL' }, mirror: 'x' },
        { ref: 'mill-corner-bracket', key: 'bracket-fr', on: { child: 1, socket: 'bracketFR' } },
        {
          ref: 'mill-skid-bolt',
          key: 'bolts-left',
          on: { child: 1, socket: 'boltLeft' },
          repeat: { count: 4, step: [0, 0, 1.0] },
        },
        {
          ref: 'mill-skid-bolt',
          key: 'bolts-right',
          on: { child: 1, socket: 'boltRight' },
          repeat: { count: 4, step: [0, 0, 1.0] },
        },
        { ref: 'mill-vent-grille', key: 'vent-grille', on: { child: 9, socket: 'grilleFace' } },
        { ref: 'mill-cable-duct', key: 'rear-duct', on: { child: 0, socket: 'rearDuctMount' } },
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
