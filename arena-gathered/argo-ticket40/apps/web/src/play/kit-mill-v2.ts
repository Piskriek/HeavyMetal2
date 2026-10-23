/**
 * TICKET-40 Pilot Machine #1: The Texture Mill rebuilt 100% from scratch (`MILL_V2_KIT`).
 *
 * Replaces the monolithic `mill` `.glb` core with a 100% procedural/modular `@hm/kitspec` build
 * combining the 20 `@hm/partgen` generators and `SHARED_MODULE_ASSEMBLIES` (`kit-modules.ts`),
 * faithful to Concept Sheet 12 (`@hm/consolemill`) and the measured 4.00 x 4.01 x 4.00 m envelope:
 *
 *  - Stepped Base Plinth & Hazard Toe Frame (`y = 0..0.35 m`):
 *    - Grounded heavy plinth slab (`3.84 x 0.16 x 3.84 m`), 4 corner `gantry-upright-leg` modules
 *      (foot pads, columns, gusset brackets, maintenance ladders, and 16 anchor bolts),
 *      stepped inner pedestal (`2.56 x 0.20 x 2.56 m`), and front/back hazard toe strips.
 *  - Chamfered Main Mill Carcass & Vertical Seam Collar (`y = 0.35..3.05 m`):
 *    - Lower mill body (`can` `2.16 x 2.16 x 2.00 m` wearing `vault:painted-iron`),
 *      chamfered upper shoulder housing (`hopper` inverted/tapered `2.16 -> 1.56 m`, `y = 2.35..3.05 m`),
 *      central vertical seam collar + clamp plates, and front pyramidal crusher boss.
 *  - Interactive Functional Sub-Modules on All 4 Sides:
 *    - `+z` Front Face: `bolted-access-door` (plate + 2 hinges + grab handle + status lamp + 4 corner bolts)
 *      and pyramidal crusher boss.
 *    - `-x` Left Face: `cartridge-bay-module` (recessed receiver bay + pink/striped `.smx` cartridge + ejector lever).
 *    - `+x` Right Face: Side exhaust stack (`tank` / `pipe` riser column + `louvred-vent-box` reaching
 *      the exact measured `vent` / `stack` socket `[1.715, 2.28, -0.48]`).
 *    - `-z` Rear Face: `power-gland-box` (junction box + flanged elbow pipe + clipped cable conduit at `[0, 0.2, -1.8]`)
 *      and `bolted-wall-panel` rear service hatch.
 *  - Waist, Top Lip Deck & Flared Ore Hopper (`y = 3.05..4.12 m`):
 *    - Recessed grinding waist (`can` `1.52 x 1.52 x 0.50 m`), top lip deck (`2.20 x 0.22 x 2.20 m`)
 *      framed by 4 top gantry tie beams, and the top `hopper-chute-module` centered at `[0, 4.16, 0]`.
 *
 * Zero `'gen'` `.glb` parts are used: every single panel, door, bolt, hinge, handle, louvre, pipe,
 * and hopper is a parametric `@hm/partgen` or `box` part that players can inspect and shoot with Part Cartridges.
 */
import type { Kit } from '@hm/kitspec';
import { VAULT_KIT_SKINS } from './kit-trim-palette';
import { SHARED_MODULE_PARTS, SHARED_MODULE_ASSEMBLIES } from './kit-modules';

export const MILL_V2_KIT: Kit = {
  parts: {
    ...SHARED_MODULE_PARTS,
    'mill-base-plinth': {
      source: { kind: 'box', size: [3.84, 0.16, 3.84] },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        stepCenter: { at: [0, 0.16, 0] },
        legLF: { at: [-1.58, 0.16, 1.58] },
        legRF: { at: [1.58, 0.16, 1.58] },
        legLB: { at: [-1.58, 0.16, -1.58], rot: [0, 180, 0] },
        legRB: { at: [1.58, 0.16, -1.58], rot: [0, 180, 0] },
        stackPedestal: { at: [1.48, 0.16, -0.48] },
        powerRear: { at: [0, 0.16, -1.66] },
        hazardFront: { at: [0, 0.04, 1.92] },
        hazardBack: { at: [0, 0.04, -1.92] },
      },
    },
    'mill-step-pedestal': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 2.56, depth: 2.56, height: 0.22, bevel: 0.025, baseBand: 0.06, bands: 1 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'hull-steel' },
      rank: 0,
      sockets: {
        carcassSeat: { at: [0, 0.22, 0] },
      },
    },
    'mill-lower-carcass': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 2.16, depth: 2.16, height: 2.0, bevel: 0.04, baseBand: 0.16, bands: 2 },
      },
      material: VAULT_KIT_SKINS.warmBody,
      slotMaterials: { body: VAULT_KIT_SKINS.warmBody, trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        shoulderTop: { at: [0, 2.0, 0] },
        frontDoorMount: { at: [0, 0.96, 1.08], rot: [90, 0, 0] },
        frontBossMount: { at: [0, 1.72, 1.08], rot: [90, 0, 0] },
        leftCartBay: { at: [-1.17, 0.82, 0.12] },
        rearPanelMount: { at: [0, 1.05, -1.08], rot: [-90, 0, 0] },
        seamClampLeft: { at: [-1.08, 1.0, 0], rot: [0, 0, 90] },
        seamClampRight: { at: [1.08, 1.0, 0], rot: [0, 0, -90] },
      },
    },
    'mill-upper-shoulder': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.88, depth: 1.88, height: 0.68, bevel: 0.05, baseBand: 0.12, bands: 1 },
      },
      material: VAULT_KIT_SKINS.warmBody,
      slotMaterials: { body: VAULT_KIT_SKINS.warmBody, trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        waistTop: { at: [0, 0.68, 0] },
        frontStatusLamp: { at: [0.44, 0.24, 0.94] },
      },
    },
    'mill-grinding-waist': {
      source: {
        kind: 'param',
        gen: 'tank',
        params: { radius: 0.76, length: 0.48, axis: 0, sides: 8, capLength: 0.08, ribs: 2, ribHeight: 0.03 },
      },
      material: 'hull-steel',
      slotMaterials: { shell: 'hull-steel', caps: 'accent-hardware', ribs: 'accent-hardware', bolts: 'accent-hardware' },
      rank: 0,
      sockets: {
        topLipSeat: { at: [0, 0.48, 0] },
      },
    },
    'mill-top-lip-deck': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 2.2, depth: 2.2, height: 0.22, bevel: 0.03, baseBand: 0.06, bands: 1 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'hull-steel' },
      rank: 0,
      sockets: {
        hopperSeat: { at: [0, 0.22, 0] },
        guardRailFront: { at: [0, 0.22, 1.02] },
        guardRailBack: { at: [0, 0.22, -1.02], rot: [0, 180, 0] },
      },
    },
    'mill-gantry-tie-beam': {
      source: {
        kind: 'param',
        gen: 'beam',
        params: { length: 3.5, section: 0.22, wall: 0.02 },
      },
      material: 'hull-steel',
      rank: 0,
    },
    'mill-stack-riser': {
      source: {
        kind: 'param',
        gen: 'tank',
        params: { radius: 0.24, length: 1.54, axis: 0, sides: 8, capLength: 0.1, ribs: 2, ribHeight: 0.025 },
      },
      material: 'hull-steel',
      slotMaterials: { shell: 'hull-steel', caps: 'accent-hardware', ribs: 'accent-hardware', bolts: 'accent-hardware' },
      rank: 0,
      sockets: {
        ventBoxTop: { at: [0, 1.54, 0] },
      },
    },
    'mill-crusher-boss': {
      source: {
        kind: 'param',
        gen: 'hopper',
        params: { topWidth: 0.32, topDepth: 0.32, bottomWidth: 0.56, bottomDepth: 0.56, height: 0.12, rimHeight: 0.04, wall: 0.04, shape: 0 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', liner: 'accent-hardware', bolts: 'accent-hardware' },
      rank: 1,
    },
    'mill-top-guard-rail': {
      source: {
        kind: 'param',
        gen: 'ladder',
        params: { width: 1.48, height: 0.42, stileSection: 0.03, rungStep: 0.2, standoff: 0.02, mode: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { stiles: 'hull-steel', rungs: 'accent-hardware', cage: 'hull-steel', bolts: 'accent-hardware' },
      rank: 2,
    },
    'mill-hazard-strip': {
      source: { kind: 'box', size: [2.8, 0.1, 0.04] },
      material: 'hull-steel',
      rank: 1,
    },
  },
  assemblies: {
    ...SHARED_MODULE_ASSEMBLIES,
    'mill-frame': {
      children: [
        { ref: 'mill-base-plinth', key: 'plinth' },
        { ref: 'mill-step-pedestal', key: 'pedestal', on: { child: 0, socket: 'stepCenter' } },
        { ref: 'gantry-upright-leg', key: 'leg-lf', on: { child: 0, socket: 'legLF' }, mirror: 'x' },
        { ref: 'gantry-upright-leg', key: 'leg-rf', on: { child: 0, socket: 'legRF' } },
        { ref: 'gantry-upright-leg', key: 'leg-lb', on: { child: 0, socket: 'legLB' }, mirror: 'x' },
        { ref: 'gantry-upright-leg', key: 'leg-rb', on: { child: 0, socket: 'legRB' } },
        { ref: 'mill-gantry-tie-beam', key: 'tie-front', at: [0, 3.68, 1.58] },
        { ref: 'mill-gantry-tie-beam', key: 'tie-back', at: [0, 3.68, -1.58] },
        { ref: 'mill-gantry-tie-beam', key: 'tie-left', at: [-1.58, 3.68, 0], rot: [0, 90, 0] },
        { ref: 'mill-gantry-tie-beam', key: 'tie-right', at: [1.58, 3.68, 0], rot: [0, 90, 0] },
        { ref: 'mill-lower-carcass', key: 'carcass', on: { child: 1, socket: 'carcassSeat' } },
        { ref: 'mill-upper-shoulder', key: 'shoulder', on: { child: 10, socket: 'shoulderTop' } },
        { ref: 'mill-grinding-waist', key: 'waist', on: { child: 11, socket: 'waistTop' } },
        { ref: 'mill-top-lip-deck', key: 'top-deck', on: { child: 12, socket: 'topLipSeat' } },
        { ref: 'hopper-chute-module', key: 'top-hopper', on: { child: 13, socket: 'hopperSeat' } },
        { ref: 'bolted-access-door', key: 'front-door', on: { child: 10, socket: 'frontDoorMount' } },
        { ref: 'mill-crusher-boss', key: 'crusher-boss', on: { child: 10, socket: 'frontBossMount' } },
        { ref: 'cartridge-bay-module', key: 'cartridge-bay', on: { child: 10, socket: 'leftCartBay' } },
        { ref: 'bolted-wall-panel', key: 'rear-hatch', on: { child: 10, socket: 'rearPanelMount' } },
        { ref: 'mod-seam-clamp', key: 'seam-clamp-l', on: { child: 10, socket: 'seamClampLeft' } },
        { ref: 'mod-seam-clamp', key: 'seam-clamp-r', on: { child: 10, socket: 'seamClampRight' } },
        { ref: 'mod-status-lamp', key: 'shoulder-lamp', on: { child: 11, socket: 'frontStatusLamp' } },
        { ref: 'mill-stack-riser', key: 'stack-riser', on: { child: 0, socket: 'stackPedestal' } },
        { ref: 'louvred-vent-box', key: 'side-vent-hood', on: { child: 22, socket: 'ventBoxTop' } },
        { ref: 'power-gland-box', key: 'power-gland', on: { child: 0, socket: 'powerRear' } },
        { ref: 'mill-top-guard-rail', key: 'guard-rail-front', on: { child: 13, socket: 'guardRailFront' } },
        { ref: 'mill-top-guard-rail', key: 'guard-rail-back', on: { child: 13, socket: 'guardRailBack' } },
        { ref: 'mill-hazard-strip', key: 'hazard-front', on: { child: 0, socket: 'hazardFront' } },
        { ref: 'mill-hazard-strip', key: 'hazard-back', on: { child: 0, socket: 'hazardBack' } },
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
