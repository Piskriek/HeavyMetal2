/**
 * The vehicle fabricator frame as a kit (TICKET-39, ARGO_NOTE_34 §4a/4b).
 *
 * Structure & Ranks:
 *  - Rank 0 (Silhouette & Structure): Grounded base runner skids + rear tie beam, two mirrored
 *    square-section uprights (`upright-plinth` + `upright-column`), and the top crossbar gantry (`crossbar-gantry`).
 *  - Rank 1 (Secondary Forms): Print-head carriage (`head-carriage`) mounted on the gantry with
 *    the same head travel as today's fabricator, full-span gantry status lamp bar (`lamp-bar`),
 *    upright cladding panels (`upright-panel`), rear exhaust riser, and feed chute housing.
 *  - Rank 2 (Small Details): Corner L-bracket gussets (`corner-gusset`), base anchor bolts
 *    (`anchor-bolt`), square cable ducts (`cable-duct`), and the top-rear exhaust vent grille.
 *
 * Footprint & Sockets (matching `gen-props.ts` and `machine-props.ts` in the frame's own coordinates
 * on top of the 0.78 m hardpoint ring):
 *  - Footprint: 6.36 m wide (x in [-3.18, 3.18]), 5.00 m tall (y in [0, 5.00]), 6.36 m deep (z in [-3.18, 3.18]).
 *  - Sockets: `vent` [0, 5.0, -2.4], `feed` [2.4, 1.15, -2.4], `power` [-2.4, 0.55, -2.6],
 *    `bed` [0, 0.7, 0], `head` [0, 4.75, 0], `lampLeft` [-2.7, 4.95, 0], `lampRight` [2.7, 4.95, 0].
 */
import type { Kit } from '@hm/kitspec';

export const FABRICATOR_FRAME_BOUNDS = {
  min: [-3.18, 0, -3.18],
  max: [3.18, 5.0, 3.18],
} as const;

/** Print-head carriage travel along the crossbar gantry in metres (frame coordinates). */
export const FABRICATOR_HEAD_TRAVEL = Object.freeze({
  minX: -2.2,
  maxX: 2.2,
  restY: 4.75,
  restZ: 0,
});

const RUNNER_H = 0.24;
const PLINTH_H = 0.64;
const UPRIGHT_H = 3.76;
const UPRIGHT_X = 2.86;
const GANTRY_Y = RUNNER_H + PLINTH_H + UPRIGHT_H; // 4.64 m (top at 5.00 m)

export const FABRICATOR_FRAME_KIT: Kit = {
  parts: {
    'runner-skid': {
      source: { kind: 'box', size: [0.56, RUNNER_H, 6.36] },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        plinthSeat: { at: [0, RUNNER_H, 0] },
        frontGusset: { at: [0, RUNNER_H, 0.34] },
        backGusset: { at: [0, RUNNER_H, -0.34], rot: [0, 180, 0] },
        boltRow: { at: [0, RUNNER_H, -2.4] },
      },
    },
    'upright-plinth': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.56, depth: 0.72, height: PLINTH_H, bevel: 0.03, baseBand: 0.16, bands: 1 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        columnSeat: { at: [0, PLINTH_H, 0] },
      },
    },
    'rear-tie-beam': {
      source: { kind: 'param', gen: 'beam', params: { length: 5.3, section: 0.24, wall: 0.02 } },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        ventBase: { at: [0, 0.24, 0] },
        feedBase: { at: [2.4, 0.24, 0] },
        powerBox: { at: [-2.4, 0.24, -0.2] },
        rearDuct: { at: [0, 0.24, 0.14] },
      },
    },
    'print-bed-pad': {
      source: { kind: 'box', size: [5.3, 0.16, 4.8] },
      material: 'hull-steel',
      rank: 0,
    },
    'upright-column': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.52, depth: 0.68, height: UPRIGHT_H, bevel: 0.03, baseBand: 0.14, bands: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        outerFace: { at: [0.26, 0.3, 0] },
        topCap: { at: [0, UPRIGHT_H, 0] },
      },
    },
    'crossbar-gantry': {
      source: { kind: 'param', gen: 'beam', params: { length: 6.36, section: 0.36, wall: 0.025 } },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        carriageMount: { at: [0, 0, 0] },
        lampMount: { at: [0, 0.26, 0.18] },
      },
    },
    'head-carriage': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.2, depth: 0.67, height: 1.13, bevel: 0.025, baseBand: 0.1, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'accent-hardware', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 1,
    },
    'lamp-bar': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 4.0, depth: 0.18, thickness: 0.1, bevel: 0.01, seam: 0.025, boltsPerSide: 4, boltHead: 0.025 },
      },
      material: 'accent-hardware',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'upright-panel': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.1, depth: 0.48, thickness: 0.2, bevel: 0.008, seam: 0.015, boltsPerSide: 3, boltHead: 0.02 },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'vent-riser-lower': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.64, depth: 0.48, height: 2.38, bevel: 0.02, baseBand: 0.14, bands: 1 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 1,
      sockets: {
        upperSeat: { at: [0, 2.38, 0] },
      },
    },
    'vent-riser-upper': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.6, depth: 0.46, height: 2.36, bevel: 0.02, baseBand: 0.1, bands: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 1,
      sockets: {
        ventGrille: { at: [0, 1.9, -0.23], rot: [0, 180, 0] },
      },
    },
    'feed-hopper-box': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.62, depth: 0.56, height: 0.91, bevel: 0.02, baseBand: 0.1, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 1,
    },
    'power-junction-box': {
      source: { kind: 'box', size: [0.44, 0.36, 0.34] },
      material: 'accent-hardware',
      rank: 1,
    },
    'corner-gusset': {
      source: {
        kind: 'param',
        gen: 'bracket',
        params: { width: 0.24, upright: 0.46, foot: 0.46, thickness: 0.024, gusset: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { steel: 'hull-steel', bolts: 'accent-hardware' },
      rank: 2,
    },
    'anchor-bolt': {
      source: {
        kind: 'param',
        gen: 'bolt',
        params: { headWidth: 0.055, headHeight: 0.025, shankDia: 0.024, shankLength: 0, head: 1 },
      },
      material: 'accent-hardware',
      rank: 2,
    },
    'cable-duct': {
      source: {
        kind: 'param',
        gen: 'duct',
        params: { length: 4.6, section: 0.14, wall: 0.01, flange: 0.03 },
      },
      material: 'accent-hardware',
      slotMaterials: { duct: 'hull-steel', flange: 'accent-hardware', bolts: 'accent-hardware' },
      rank: 2,
    },
    'exhaust-grille': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 0.52, height: 0.34, depth: 0.05, frame: 0.035, slats: 6, slat: 0.012 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 2,
    },
  },
  assemblies: {
    'fabricator-upright': {
      children: [
        { ref: 'runner-skid', key: 'skid' },
        { ref: 'upright-plinth', key: 'plinth', on: { child: 0, socket: 'plinthSeat' } },
        { ref: 'upright-column', key: 'column', on: { child: 1, socket: 'columnSeat' } },
        {
          ref: 'upright-panel',
          key: 'cladding',
          on: { child: 2, socket: 'outerFace' },
          repeat: { count: 4, step: [0, 0.8, 0] },
        },
        { ref: 'corner-gusset', key: 'gusset-front', on: { child: 0, socket: 'frontGusset' } },
        { ref: 'corner-gusset', key: 'gusset-back', on: { child: 0, socket: 'backGusset' } },
        {
          ref: 'anchor-bolt',
          key: 'skid-bolts',
          on: { child: 0, socket: 'boltRow' },
          repeat: { count: 4, step: [0, 0, 1.6] },
        },
      ],
      sockets: {
        gantryTop: { at: [0, GANTRY_Y, 0] },
      },
    },
    'fabricator-frame': {
      children: [
        { ref: 'fabricator-upright', key: 'upright-left', at: [-UPRIGHT_X, 0, 0], mirror: 'x' },
        { ref: 'fabricator-upright', key: 'upright-right', at: [UPRIGHT_X, 0, 0] },
        { ref: 'rear-tie-beam', key: 'rear-tie', at: [0, 0, -2.4] },
        { ref: 'print-bed-pad', key: 'bed-pad', at: [0, 0, 0] },
        { ref: 'crossbar-gantry', key: 'gantry', at: [0, GANTRY_Y, 0] },
        { ref: 'head-carriage', key: 'carriage', on: { child: 4, socket: 'carriageMount' }, at: [0, -0.78, 0] },
        { ref: 'lamp-bar', key: 'lamp-bar', on: { child: 4, socket: 'lampMount' } },
        { ref: 'vent-riser-lower', key: 'vent-riser-lo', on: { child: 2, socket: 'ventBase' } },
        { ref: 'vent-riser-upper', key: 'vent-riser-hi', on: { child: 7, socket: 'upperSeat' } },
        { ref: 'feed-hopper-box', key: 'feed-hopper', on: { child: 2, socket: 'feedBase' } },
        { ref: 'power-junction-box', key: 'power-box', on: { child: 2, socket: 'powerBox' } },
        { ref: 'cable-duct', key: 'rear-cable-duct', on: { child: 2, socket: 'rearDuct' } },
        { ref: 'exhaust-grille', key: 'vent-grille', on: { child: 8, socket: 'ventGrille' } },
      ],
      sockets: {
        vent: { at: [0, 5.0, -2.4] },
        feed: { at: [2.4, 1.15, -2.4] },
        power: { at: [-2.4, 0.55, -2.6] },
        bed: { at: [0, 0.7, 0] },
        head: { at: [0, 4.75, 0] },
        lampLeft: { at: [-2.7, 4.95, 0] },
        lampRight: { at: [2.7, 4.95, 0] },
      },
    },
  },
};
