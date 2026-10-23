/**
 * The 6-wheel heavy Hauler hull as a kit (TICKET-39 / TICKET-39b, OPUS_NOTE_36).
 *
 * Measured `hauler-wheel` GLB bbox (OPUS_NOTE_36):
 *  - `x: -0.55..0.55, y: 0..1.09, z: -0.26..0.26` (axle along z in GLB; rotated `rot: [0, 90, 0]`
 *    in the wheel-bay assembly so the axle aligns with vehicle x, giving world x +-0.26, z +-0.55).
 *
 * Ranks (ARGO_NOTE_34 §4a/4b):
 *  - Rank 0: 6 wheels (`hauler-wheel`) at `x = ±1.0`, `z = 1.8, -0.6, -1.8`, chassis tub, cab shell, and cargo bed.
 *  - Rank 1: Modular roof socket deck, 6 wheel-bay fenders, 3 cross-axle suspension arms, and twin front headlamp housings.
 *  - Rank 2: Wheel lug bolts on the outer hub face (`x = ±1.26`), front radiator grille, cab roof grab rails, and cargo tie-down brackets.
 */
import type { Kit } from '@hm/kitspec';

export const HAULER_WHEEL_BOUNDS = {
  min: [-0.55, 0, -0.26],
  max: [0.55, 1.09, 0.26],
} as const;

const HUB_Y = 0.545;

export const HAULER_KIT: Kit = {
  parts: {
    'hauler-wheel': {
      source: { kind: 'gen', asset: 'hauler-wheel', bounds: HAULER_WHEEL_BOUNDS },
      material: 'accent-hardware',
      rank: 0,
      sockets: {
        lugOuter: { at: [0, HUB_Y, 0.26], rot: [90, 0, 0] },
      },
    },
    'chassis-tub': {
      source: { kind: 'box', size: [1.56, 0.64, 5.76] },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        cabDeck: { at: [0, 0.64, 1.68] },
        cargoDeck: { at: [0, 0.64, -1.12] },
        axleFront: { at: [0, 0.08, 1.8] },
        axleMid: { at: [0, 0.08, -0.6] },
        axleRear: { at: [0, 0.08, -1.8] },
        fenderFL: { at: [-1.0, 0.64, 1.8] },
        fenderFR: { at: [1.0, 0.64, 1.8] },
        fenderML: { at: [-1.0, 0.64, -0.6] },
        fenderMR: { at: [1.0, 0.64, -0.6] },
        fenderRL: { at: [-1.0, 0.64, -1.8] },
        fenderRR: { at: [1.0, 0.64, -1.8] },
        lampLeft: { at: [-0.62, 0.5, 2.88] },
        lampRight: { at: [0.62, 0.5, 2.88] },
        noseGrille: { at: [0, 0.12, 2.88] },
      },
    },
    'cab-shell': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 2.24, depth: 2.16, height: 1.56, bevel: 0.04, baseBand: 0.16, bands: 1 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        roofMount: { at: [0, 1.56, 0] },
        railLeft: { at: [-0.96, 1.56, 0] },
        railRight: { at: [0.96, 1.56, 0] },
      },
    },
    'cargo-bed': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 2.36, depth: 3.32, height: 0.92, bevel: 0.03, baseBand: 0.14, bands: 1 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        tieLeft: { at: [-1.18, 0.92, -0.9] },
        tieRight: { at: [1.18, 0.92, -0.9] },
      },
    },
    'roof-socket-deck': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 1.68, depth: 1.56, thickness: 0.08, bevel: 0.01, seam: 0.04, boltsPerSide: 4, boltHead: 0.025 },
      },
      material: 'accent-hardware',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'wheel-fender': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.56, depth: 1.18, thickness: 0.08, bevel: 0.01, seam: 0.02, boltsPerSide: 3, boltHead: 0.02 },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'suspension-arm': {
      source: {
        kind: 'param',
        gen: 'beam',
        params: { length: 2.04, section: 0.18, wall: 0.016 },
      },
      material: 'accent-hardware',
      rank: 1,
    },
    'headlamp-housing': {
      source: { kind: 'box', size: [0.28, 0.22, 0.16] },
      material: 'accent-hardware',
      rank: 1,
    },
    'wheel-lug-bolt': {
      source: {
        kind: 'param',
        gen: 'bolt',
        params: { headWidth: 0.05, headHeight: 0.025, shankDia: 0.022, shankLength: 0, head: 1 },
      },
      material: 'accent-hardware',
      rank: 2,
    },
    'front-grille': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 0.96, height: 0.42, depth: 0.05, frame: 0.035, slats: 6, slat: 0.012 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 2,
    },
    'grab-rail': {
      source: {
        kind: 'param',
        gen: 'duct',
        params: { length: 1.6, section: 0.08, wall: 0.008, flange: 0.02 },
      },
      material: 'accent-hardware',
      slotMaterials: { duct: 'accent-hardware', flange: 'hull-steel', bolts: 'accent-hardware' },
      rank: 2,
    },
    'tie-down-bracket': {
      source: {
        kind: 'param',
        gen: 'bracket',
        params: { width: 0.14, upright: 0.18, foot: 0.16, thickness: 0.015, gusset: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { steel: 'hull-steel', bolts: 'accent-hardware' },
      rank: 2,
    },
  },
  assemblies: {
    'hauler-wheel-bay': {
      children: [
        { ref: 'hauler-wheel', key: 'wheel', rot: [0, 90, 0] },
        { ref: 'wheel-lug-bolt', key: 'lug', on: { child: 0, socket: 'lugOuter' } },
      ],
    },
    hauler: {
      children: [
        { ref: 'hauler-wheel-bay', key: 'wheel-fl', at: [-1.0, 0, 1.8], mirror: 'x' },
        { ref: 'hauler-wheel-bay', key: 'wheel-fr', at: [1.0, 0, 1.8] },
        { ref: 'hauler-wheel-bay', key: 'wheel-ml', at: [-1.0, 0, -0.6], mirror: 'x' },
        { ref: 'hauler-wheel-bay', key: 'wheel-mr', at: [1.0, 0, -0.6] },
        { ref: 'hauler-wheel-bay', key: 'wheel-rl', at: [-1.0, 0, -1.8], mirror: 'x' },
        { ref: 'hauler-wheel-bay', key: 'wheel-rr', at: [1.0, 0, -1.8] },
        { ref: 'chassis-tub', key: 'chassis', at: [0, 0.48, 0] },
        { ref: 'cab-shell', key: 'cab', on: { child: 6, socket: 'cabDeck' } },
        { ref: 'cargo-bed', key: 'bed', on: { child: 6, socket: 'cargoDeck' } },
        { ref: 'roof-socket-deck', key: 'roof-deck', on: { child: 7, socket: 'roofMount' } },
        { ref: 'suspension-arm', key: 'axle-front', on: { child: 6, socket: 'axleFront' } },
        { ref: 'suspension-arm', key: 'axle-mid', on: { child: 6, socket: 'axleMid' } },
        { ref: 'suspension-arm', key: 'axle-rear', on: { child: 6, socket: 'axleRear' } },
        { ref: 'wheel-fender', key: 'fender-fl', on: { child: 6, socket: 'fenderFL' }, mirror: 'x' },
        { ref: 'wheel-fender', key: 'fender-fr', on: { child: 6, socket: 'fenderFR' } },
        { ref: 'wheel-fender', key: 'fender-ml', on: { child: 6, socket: 'fenderML' }, mirror: 'x' },
        { ref: 'wheel-fender', key: 'fender-mr', on: { child: 6, socket: 'fenderMR' } },
        { ref: 'wheel-fender', key: 'fender-rl', on: { child: 6, socket: 'fenderRL' }, mirror: 'x' },
        { ref: 'wheel-fender', key: 'fender-rr', on: { child: 6, socket: 'fenderRR' } },
        { ref: 'headlamp-housing', key: 'lamp-left', on: { child: 6, socket: 'lampLeft' }, mirror: 'x' },
        { ref: 'headlamp-housing', key: 'lamp-right', on: { child: 6, socket: 'lampRight' } },
        { ref: 'front-grille', key: 'nose-grille', on: { child: 6, socket: 'noseGrille' } },
        { ref: 'grab-rail', key: 'rail-left', on: { child: 7, socket: 'railLeft' }, rot: [0, 90, 0] },
        { ref: 'grab-rail', key: 'rail-right', on: { child: 7, socket: 'railRight' }, rot: [0, 90, 0] },
        {
          ref: 'tie-down-bracket',
          key: 'ties-left',
          on: { child: 8, socket: 'tieLeft' },
          repeat: { count: 3, step: [0, 0, 0.9] },
        },
        {
          ref: 'tie-down-bracket',
          key: 'ties-right',
          on: { child: 8, socket: 'tieRight' },
          repeat: { count: 3, step: [0, 0, 0.9] },
        },
      ],
      sockets: {
        seatLeft: { at: [-0.45, 1.15, 1.9] },
        seatRight: { at: [0.45, 1.15, 1.9] },
        dish: { at: [0, 1.68, -0.3] },
        lampLeft: { at: [-0.7, 1.27, 2.95] },
        lampRight: { at: [0.7, 1.27, 2.95] },
        rearBayLeft: { at: [-0.62, 1.52, -1.8] },
        rearBayRight: { at: [0.62, 1.52, -1.8] },
      },
    },
  },
};
