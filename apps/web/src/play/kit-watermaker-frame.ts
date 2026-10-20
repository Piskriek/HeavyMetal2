/**
 * The Water Maker outer frame around its heavygear / generated core (TICKET-39, ARGO_NOTE_34 §4a/4b).
 *
 * The `watermaker-core` (`gen` asset `'watermaker'`) is the central ribbed condenser tank;
 * the outer frame parts sit on its sockets:
 *  - Rank 0: Condenser core, full-span cradle skid, mirrored left/right saddle piers, top tie beam,
 *    and the gravel intake hopper column at `[3.05, 0..1.60, 0]`.
 *  - Rank 1: Top-rear louvered vent hood at `[0, 3.155, -0.58]`, saddle access panels, front pressure
 *    gauge box, and power gland housing.
 *  - Rank 2: Saddle L-brackets, skid anchor bolts, condenser copper/accent pipe duct, and top-rear vent grille.
 *
 * Preserves exact `machine-props.ts` and `heavygear.heavyWater` sockets:
 *  - `vent`: `[0, 3.155, -0.58]`
 *  - `feed` / `hopper`: `[3.05, 1.6, 0]`
 *  - `power`: `[0, 0.2, 0.8]`
 */
import type { Kit } from '@hm/kitspec';

export const WATERMAKER_CORE_BOUNDS = {
  min: [-2.71, 0, -0.95],
  max: [2.71, 3.02, 0.95],
} as const;

export const WATERMAKER_FRAME_KIT: Kit = {
  parts: {
    'watermaker-core': {
      source: { kind: 'gen', asset: 'watermaker', bounds: WATERMAKER_CORE_BOUNDS },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        skidBase: { at: [0, 0, 0] },
        saddleLeft: { at: [-1.35, 0.18, 0] },
        saddleRight: { at: [1.35, 0.18, 0] },
        hopperStand: { at: [3.05, 0.18, 0] },
        topSpine: { at: [0, 2.86, 0] },
        ventHood: { at: [0, 2.82, -0.58] },
        frontGauge: { at: [-0.2, 2.0, 0.95] },
        powerGland: { at: [0, 0.18, 0.8] },
        frontPipeRun: { at: [0, 2.68, 0.46] },
      },
    },
    'watermaker-skid': {
      source: { kind: 'box', size: [7.1, 0.18, 2.4] },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        boltRowFront: { at: [-2.8, 0.18, 1.05] },
        boltRowBack: { at: [-2.8, 0.18, -1.05] },
        bracketLeft: { at: [-1.35, 0.18, 0.65] },
        bracketRight: { at: [1.35, 0.18, 0.65] },
      },
    },
    'watermaker-saddle-pier': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.58, depth: 1.32, height: 1.52, bevel: 0.025, baseBand: 0.12, bands: 1 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        frontPanel: { at: [0, 0.25, 0.66] },
      },
    },
    'watermaker-hopper-column': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.88, depth: 0.88, height: 1.42, bevel: 0.025, baseBand: 0.12, bands: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 0,
    },
    'watermaker-spine-beam': {
      source: { kind: 'param', gen: 'beam', params: { length: 4.4, section: 0.22, wall: 0.018 } },
      material: 'hull-steel',
      rank: 0,
    },
    'watermaker-vent-box': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.02, depth: 0.52, height: 0.36, bevel: 0.02, baseBand: 0.06, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 1,
      sockets: {
        grilleBack: { at: [0, 0.04, -0.26], rot: [0, 180, 0] },
      },
    },
    'watermaker-saddle-panel': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.46, depth: 0.04, thickness: 1.0, bevel: 0.008, seam: 0.015, boltsPerSide: 3, boltHead: 0.02 },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'watermaker-gauge-box': {
      source: { kind: 'box', size: [0.42, 0.42, 0.16] },
      material: 'accent-hardware',
      rank: 1,
    },
    'watermaker-power-box': {
      source: { kind: 'box', size: [0.44, 0.24, 0.22] },
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
        params: { width: 0.88, height: 0.28, depth: 0.045, frame: 0.03, slats: 5, slat: 0.01 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 2,
    },
    'watermaker-pipe-duct': {
      source: {
        kind: 'param',
        gen: 'duct',
        params: { length: 4.0, section: 0.16, wall: 0.012, flange: 0.03 },
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
        { ref: 'watermaker-skid', key: 'skid', on: { child: 0, socket: 'skidBase' } },
        { ref: 'watermaker-saddle-pier', key: 'saddle-left', on: { child: 0, socket: 'saddleLeft' }, mirror: 'x' },
        { ref: 'watermaker-saddle-pier', key: 'saddle-right', on: { child: 0, socket: 'saddleRight' } },
        { ref: 'watermaker-hopper-column', key: 'hopper-column', on: { child: 0, socket: 'hopperStand' } },
        { ref: 'watermaker-spine-beam', key: 'spine-beam', on: { child: 0, socket: 'topSpine' } },
        { ref: 'watermaker-vent-box', key: 'vent-box', on: { child: 0, socket: 'ventHood' } },
        { ref: 'watermaker-saddle-panel', key: 'panel-left', on: { child: 2, socket: 'frontPanel' } },
        { ref: 'watermaker-saddle-panel', key: 'panel-right', on: { child: 3, socket: 'frontPanel' } },
        { ref: 'watermaker-gauge-box', key: 'gauge-box', on: { child: 0, socket: 'frontGauge' } },
        { ref: 'watermaker-power-box', key: 'power-box', on: { child: 0, socket: 'powerGland' } },
        { ref: 'watermaker-saddle-bracket', key: 'bracket-left', on: { child: 1, socket: 'bracketLeft' }, mirror: 'x' },
        { ref: 'watermaker-saddle-bracket', key: 'bracket-right', on: { child: 1, socket: 'bracketRight' } },
        {
          ref: 'watermaker-skid-bolt',
          key: 'bolts-front',
          on: { child: 1, socket: 'boltRowFront' },
          repeat: { count: 5, step: [1.4, 0, 0] },
        },
        {
          ref: 'watermaker-skid-bolt',
          key: 'bolts-back',
          on: { child: 1, socket: 'boltRowBack' },
          repeat: { count: 5, step: [1.4, 0, 0] },
        },
        { ref: 'watermaker-vent-grille', key: 'vent-grille', on: { child: 6, socket: 'grilleBack' } },
        { ref: 'watermaker-pipe-duct', key: 'pipe-duct', on: { child: 0, socket: 'frontPipeRun' } },
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
