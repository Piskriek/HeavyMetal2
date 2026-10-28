/**
 * @file apps/web/src/studio/kits/studio-kit-registry.ts
 * ARGO_STUDIO_CLEANUP_DIRECTIVE.md: Complete 10-Kit Modular Machine, Stargate & Vehicle Library.
 *
 * Every asset in Loop A ("Tune & Mod the Example Game") and Loop B ("Genesis of a New Planet")
 * is a 100% pure `@hm/kitspec` + `@hm/partgen` + `@hm/matstack` assembly with zero legacy `.glb` meshes
 * and zero floating/below-ground issues (`validate(kit, rootPreset) === []`).
 */

import type { Kit } from '@hm/kitspec';
import { MILL_V2_KIT } from '../../play/kit-mill-v2';
import { MATSTACK_TEST_PIECE_KIT } from '../../play/kit-modules';
// plan 57 §14: the lab's and the bridge's own kits, salvaged onto the shelf (each validates whole)
import { GATE_DAIS_KIT } from '../../play/kit-gate-dais';
import { GATE_KIT } from '../../play/kit-gate';
import { FABRICATOR_FRAME_KIT } from '../../play/kit-fabricator-frame';
import { DRONE_KIT } from '../../play/kit-drone';
import { GAME_SCREEN_KIT } from '../../play/kit-game-screen';
import { BRIDGE_PAD_KIT } from '../../play/kit-bridge-pad';
import { CRAWLER_KIT, HAULER_KIT } from '../../play/kit-vehicles';

/**
 * 2. STARGATE_V2_KIT (Sheet 06 Freestanding Portal Gate: 3.20 m outer height, 2.60 m x 1.70 m aperture,
 * chunky box-section uprights, 8 recessed ribbed amber coil blocks, hazard-striped plinth, rear junction box,
 * and ribbed steel floor cable ramps).
 */
export const STARGATE_V2_KIT: Kit = Object.freeze<any>({
  parts: {
    'gate-plinth': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 3.4, depth: 1.6, height: 0.24, bevel: 0.03, plinthHeight: 0.06, plinthInset: 0.02, topLip: 0.02 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { body: 'mat:workshop-steel', trim: 'mat:hazard-chevron', band: 'mat:hazard-chevron' },
      rank: 0 as const,
      sockets: {
        leftUpright: { at: [-1.25, 0.24, 0] },
        rightUpright: { at: [1.25, 0.24, 0] },
        rearJunction: { at: [0, 0.24, -0.58] },
        cableRampFront: { at: [0, 0, 0.96] },
        buttressLeft: { at: [-1.48, 0.24, 0] },
        buttressRight: { at: [1.48, 0.24, 0], rot: [0, 180, 0] },
      },
    },
    'gate-upright': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 0.42, depth: 0.56, height: 2.68, bevel: 0.028, bands: 4, bandRaise: 0.015 },
      },
      material: 'mat:brushed-lab-steel',
      slotMaterials: { body: 'mat:brushed-lab-steel', trim: 'mat:workshop-steel', band: 'mat:old-copper' },
      rank: 0 as const,
      sockets: {
        topLintel: { at: [1.25, 2.68, 0] },
        coil1: { at: [0.20, 0.45, 0], rot: [0, 0, -90] },
        coil2: { at: [0.20, 1.05, 0], rot: [0, 0, -90] },
        coil3: { at: [0.20, 1.65, 0], rot: [0, 0, -90] },
        coil4: { at: [0.20, 2.25, 0], rot: [0, 0, -90] },
      },
    },
    'gate-lintel': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 3.1, depth: 0.62, height: 0.28, bevel: 0.03, topLip: 0.02 },
      },
      material: 'mat:brushed-lab-steel',
      slotMaterials: { body: 'mat:brushed-lab-steel', trim: 'mat:workshop-steel' },
      rank: 0 as const,
      sockets: {
        beaconMount: { at: [0, 0.28, 0] },
      },
    },
    'gate-amber-coil': {
      source: {
        kind: 'param' as const,
        gen: 'lamp',
        params: { width: 0.22, depth: 0.36, height: 0.14, rim: 0.025, guardBars: 3 },
      },
      material: 'lx:2700:2.2:pulse:ffc13d',
      slotMaterials: { bezel: 'mat:old-copper', lens: 'lx:2700:2.2:pulse:ffc13d', cage: 'mat:workshop-steel' },
      rank: 1 as const,
    },
    'gate-buttress': {
      source: {
        kind: 'param' as const,
        gen: 'bracket',
        params: { width: 0.24, upright: 1.4, foot: 0.44, thickness: 0.04, gusset: 1 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { steel: 'mat:workshop-steel', bolts: 'mat:brushed-lab-steel' },
      rank: 1 as const,
    },
    'gate-junction-box': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 0.88, depth: 0.36, height: 0.64, bevel: 0.02 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { body: 'mat:workshop-steel', trim: 'mat:old-copper' },
      rank: 1 as const,
    },
    'gate-cable-ramp': {
      source: {
        kind: 'param' as const,
        gen: 'panel',
        params: { width: 0.64, depth: 0.34, thickness: 0.06, bevel: 0.02, seam: 0.02, boltsPerSide: 2, boltHead: 0.02 },
      },
      material: 'mat:hazard-chevron',
      slotMaterials: { plate: 'mat:hazard-chevron', bolts: 'mat:workshop-steel' },
      rank: 1 as const,
    },
  },
  assemblies: {
    'stargate-frame': {
      children: [
        { ref: 'gate-plinth', key: 'plinth' },
        { ref: 'gate-upright', key: 'left-upright', on: { child: 0, socket: 'leftUpright' } },
        { ref: 'gate-upright', key: 'right-upright', on: { child: 0, socket: 'rightUpright' }, mirror: 'x' },
        { ref: 'gate-lintel', key: 'top-lintel', on: { child: 1, socket: 'topLintel' } },
        { ref: 'gate-amber-coil', key: 'coil-l1', on: { child: 1, socket: 'coil1' } },
        { ref: 'gate-amber-coil', key: 'coil-l2', on: { child: 1, socket: 'coil2' } },
        { ref: 'gate-amber-coil', key: 'coil-l3', on: { child: 1, socket: 'coil3' } },
        { ref: 'gate-amber-coil', key: 'coil-l4', on: { child: 1, socket: 'coil4' } },
        { ref: 'gate-amber-coil', key: 'coil-r1', on: { child: 2, socket: 'coil1' } },
        { ref: 'gate-amber-coil', key: 'coil-r2', on: { child: 2, socket: 'coil2' } },
        { ref: 'gate-amber-coil', key: 'coil-r3', on: { child: 2, socket: 'coil3' } },
        { ref: 'gate-amber-coil', key: 'coil-r4', on: { child: 2, socket: 'coil4' } },
        { ref: 'gate-buttress', key: 'buttress-left', on: { child: 0, socket: 'buttressLeft' } },
        { ref: 'gate-buttress', key: 'buttress-right', on: { child: 0, socket: 'buttressRight' } },
        { ref: 'gate-junction-box', key: 'junction-box', on: { child: 0, socket: 'rearJunction' } },
        { ref: 'gate-cable-ramp', key: 'cable-ramp', on: { child: 0, socket: 'cableRampFront' } },
        { ref: 'gate-amber-coil', key: 'top-beacon', on: { child: 3, socket: 'beaconMount' } },
      ],
      sockets: {
        powerInput: { at: [0, 0.42, -0.76] },
        portalOutput: { at: [0, 1.58, 0] },
        consoleLink: { at: [-0.9, 0.06, 1.1] },
      },
    },
  },
});

/**
 * 3. CAPACITOR_BANK_PURE_KIT (Sheet 07 & 21 Power Wall Capacitor Bank — 100% pure @hm/partgen, zero legacy .glb).
 */
export const CAPACITOR_BANK_PURE_KIT: Kit = Object.freeze<any>({
  parts: {
    'cap-skid': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 2.0, depth: 1.12, height: 0.14, bevel: 0.02, plinthHeight: 0.04, plinthInset: 0.015 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { body: 'mat:workshop-steel', trim: 'mat:hazard-chevron' },
      rank: 0 as const,
      sockets: {
        cellFL: { at: [-0.58, 0.14, 0.28] },
        cellFM: { at: [0, 0.14, 0.28] },
        cellFR: { at: [0.58, 0.14, 0.28] },
        cellBL: { at: [-0.58, 0.14, -0.28] },
        cellBM: { at: [0, 0.14, -0.28] },
        cellBR: { at: [0.58, 0.14, -0.28] },
      },
    },
    'cap-cylinder': {
      source: {
        kind: 'param' as const,
        gen: 'tank',
        params: { radius: 0.23, length: 0.96, dome: 0.08, bands: 2, bandWidth: 0.04, saddleHeight: 0.06 },
      },
      material: 'mat:brushed-lab-steel',
      slotMaterials: { shell: 'mat:brushed-lab-steel', bands: 'mat:workshop-steel', saddles: 'mat:workshop-steel' },
      rank: 0 as const,
      sockets: {
        insulatorTop: { at: [0, 0.96, 0] },
      },
    },
    'cap-insulator': {
      source: {
        kind: 'param' as const,
        gen: 'bolt',
        params: { headWidth: 0.12, headHeight: 0.12, chamfer: 0.015, collarRadius: 0.08, collarHeight: 0.04, shankRadius: 0.04, shankLength: 0 },
      },
      material: 'mat:lab-fresh',
      slotMaterials: { head: 'mat:lab-fresh', shank: 'mat:old-copper' },
      rank: 1 as const,
      sockets: {
        busSeat: { at: [0, 0.16, 0] },
      },
    },
    'cap-bus-bar': {
      source: {
        kind: 'param' as const,
        gen: 'beam',
        params: { length: 1.36, section: 0.06, wall: 0.015 },
      },
      material: 'mat:old-copper',
      slotMaterials: { steel: 'mat:old-copper' },
      rank: 1 as const,
    },
  },
  assemblies: {
    'capacitor-bank': {
      children: [
        { ref: 'cap-skid', key: 'skid' },
        { ref: 'cap-cylinder', key: 'cell-fl', on: { child: 0, socket: 'cellFL' } },
        { ref: 'cap-cylinder', key: 'cell-fm', on: { child: 0, socket: 'cellFM' } },
        { ref: 'cap-cylinder', key: 'cell-fr', on: { child: 0, socket: 'cellFR' } },
        { ref: 'cap-cylinder', key: 'cell-bl', on: { child: 0, socket: 'cellBL' } },
        { ref: 'cap-cylinder', key: 'cell-bm', on: { child: 0, socket: 'cellBM' } },
        { ref: 'cap-cylinder', key: 'cell-br', on: { child: 0, socket: 'cellBR' } },
        { ref: 'cap-insulator', key: 'ins-fl', on: { child: 1, socket: 'insulatorTop' } },
        { ref: 'cap-insulator', key: 'ins-fm', on: { child: 2, socket: 'insulatorTop' } },
        { ref: 'cap-insulator', key: 'ins-fr', on: { child: 3, socket: 'insulatorTop' } },
        { ref: 'cap-insulator', key: 'ins-bl', on: { child: 4, socket: 'insulatorTop' } },
        { ref: 'cap-insulator', key: 'ins-bm', on: { child: 5, socket: 'insulatorTop' } },
        { ref: 'cap-insulator', key: 'ins-br', on: { child: 6, socket: 'insulatorTop' } },
        { ref: 'cap-bus-bar', key: 'bus-front', on: { child: 8, socket: 'busSeat' }, rot: [0, 0, 90], at: [0.68, 0.03, 0] },
        { ref: 'cap-bus-bar', key: 'bus-back', on: { child: 11, socket: 'busSeat' }, rot: [0, 0, 90], at: [0.68, 0.03, 0] },
      ],
      sockets: {
        powerInput: { at: [-1.0, 0.07, 0] },
        powerOutput: { at: [1.0, 0.07, 0] },
      },
    },
  },
});

/**
 * 4. SHAPE_PRESS_V2_KIT (Sheet 12 #3: 2.80 m hydraulic gantry press with 4 corner columns, ram head, feed hopper & #7cff4d exhaust).
 */
export const SHAPE_PRESS_V2_KIT: Kit = Object.freeze<any>({
  parts: {
    'press-base': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 2.6, depth: 2.6, height: 0.36, bevel: 0.03, plinthHeight: 0.08, plinthInset: 0.03, topLip: 0.02 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { body: 'mat:workshop-steel', trim: 'mat:hazard-chevron', band: 'mat:hazard-chevron' },
      rank: 0 as const,
      sockets: {
        anvilCenter: { at: [0, 0.36, 0] },
        colFL: { at: [-0.95, 0.36, 0.95] },
        colFR: { at: [0.95, 0.36, 0.95] },
        colBL: { at: [-0.95, 0.36, -0.95] },
        colBR: { at: [0.95, 0.36, -0.95] },
        feedChute: { at: [0, 0.36, 1.05] },
      },
    },
    'press-anvil': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 1.4, depth: 1.4, height: 0.65, bevel: 0.03, bands: 2, bandRaise: 0.02 },
      },
      material: 'mat:field-worn-hazard',
      slotMaterials: { body: 'mat:field-worn-hazard', trim: 'mat:workshop-steel', band: 'mat:rust-bucket' },
      rank: 0 as const,
      sockets: {
        ramStamp: { at: [0, 0.65, 0] },
      },
    },
    'press-column': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 0.24, depth: 0.24, height: 2.1, bevel: 0.02, bands: 2, bandRaise: 0.015 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { body: 'mat:workshop-steel', trim: 'mat:brushed-lab-steel', band: 'mat:brushed-lab-steel' },
      rank: 0 as const,
      sockets: {
        topCrown: { at: [0.95, 2.1, -0.95] },
      },
    },
    'press-crown': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 2.3, depth: 2.3, height: 0.34, bevel: 0.03, topLip: 0.02 },
      },
      material: 'mat:field-worn-hazard',
      slotMaterials: { body: 'mat:field-worn-hazard', trim: 'mat:workshop-steel' },
      rank: 0 as const,
      sockets: {
        exhaustStack: { at: [0, 0.34, -0.55] },
        statusLamp: { at: [0.85, 0.17, 1.15], rot: [90, 0, 0] },
      },
    },
    'press-hopper': {
      source: {
        kind: 'param' as const,
        gen: 'hopper',
        params: { topWidth: 0.85, topDepth: 0.65, bottomWidth: 0.45, bottomDepth: 0.4, height: 0.48, wall: 0.03, rimHeight: 0.05 },
      },
      material: 'mat:rust-bucket',
      slotMaterials: { body: 'mat:rust-bucket', rim: 'mat:workshop-steel' },
      rank: 1 as const,
    },
    'press-exhaust': {
      source: {
        kind: 'param' as const,
        gen: 'duct',
        params: { width: 0.46, depth: 0.46, length: 0.42, flange: 0.04, flangeThickness: 0.025 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { duct: 'mat:workshop-steel', flange: 'mat:brushed-lab-steel', bolts: 'mat:brushed-lab-steel' },
      rank: 1 as const,
    },
    'press-lamp': {
      source: {
        kind: 'param' as const,
        gen: 'lamp',
        params: { width: 0.18, depth: 0.18, height: 0.09, rim: 0.02, guardBars: 2 },
      },
      material: 'lx:5500:1.8:steady:7cff4d',
      slotMaterials: { bezel: 'mat:workshop-steel', lens: 'lx:5500:1.8:steady:7cff4d', cage: 'mat:brushed-lab-steel' },
      rank: 1 as const,
    },
  },
  assemblies: {
    'shape-press': {
      children: [
        { ref: 'press-base', key: 'base' },
        { ref: 'press-anvil', key: 'anvil', on: { child: 0, socket: 'anvilCenter' } },
        { ref: 'press-column', key: 'col-fl', on: { child: 0, socket: 'colFL' } },
        { ref: 'press-column', key: 'col-fr', on: { child: 0, socket: 'colFR' } },
        { ref: 'press-column', key: 'col-bl', on: { child: 0, socket: 'colBL' } },
        { ref: 'press-column', key: 'col-br', on: { child: 0, socket: 'colBR' } },
        { ref: 'press-crown', key: 'crown', on: { child: 2, socket: 'topCrown' } },
        { ref: 'press-hopper', key: 'feed-hopper', on: { child: 0, socket: 'feedChute' } },
        { ref: 'press-exhaust', key: 'exhaust-stack', on: { child: 6, socket: 'exhaustStack' } },
        { ref: 'press-lamp', key: 'status-lamp', on: { child: 6, socket: 'statusLamp' } },
      ],
      sockets: {
        feedHopper: { at: [0, 0.84, 1.05] },
        exhaustVent: { at: [0, 3.22, -0.55] },
        powerCable: { at: [0, 0.18, -1.3] },
      },
    },
  },
});

/**
 * 5. WATER_MAKER_V2_KIT (DEC-05: 3.60 x 3.00 m 1x1 foundation footprint, twin condenser tanks, cooling louvres & #3dc8ff stack).
 */
export const WATER_MAKER_V2_KIT: Kit = Object.freeze<any>({
  parts: {
    'wm-skid': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 3.56, depth: 2.96, height: 0.28, bevel: 0.03, plinthHeight: 0.06, plinthInset: 0.02 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { body: 'mat:workshop-steel', trim: 'mat:hazard-chevron' },
      rank: 0 as const,
      sockets: {
        coreBody: { at: [-0.45, 0.28, 0] },
        tankLeft: { at: [1.05, 0.28, 0.62] },
        tankRight: { at: [1.05, 0.28, -0.62] },
      },
    },
    'wm-condenser-core': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 1.9, depth: 2.2, height: 2.1, bevel: 0.03, bands: 2, bandRaise: 0.02, topLip: 0.03 },
      },
      material: 'mat:frozen-rig',
      slotMaterials: { body: 'mat:frozen-rig', trim: 'mat:workshop-steel', band: 'mat:old-copper' },
      rank: 0 as const,
      sockets: {
        topStack: { at: [0, 2.1, -0.45] },
        frontLouvre: { at: [0, 1.05, 1.1], rot: [90, 0, 0] },
      },
    },
    'wm-tank': {
      source: {
        kind: 'param' as const,
        gen: 'tank',
        params: { radius: 0.46, length: 1.95, dome: 0.16, bands: 3, bandWidth: 0.05, saddleHeight: 0.08 },
      },
      material: 'mat:brushed-lab-steel',
      slotMaterials: { shell: 'mat:brushed-lab-steel', bands: 'mat:old-copper', saddles: 'mat:workshop-steel' },
      rank: 0 as const,
    },
    'wm-louvre': {
      source: {
        kind: 'param' as const,
        gen: 'louvre',
        params: { width: 1.2, height: 0.85, depth: 0.08, frame: 0.06, slats: 7 },
      },
      material: 'mat:slatted-grille-steel',
      slotMaterials: { frame: 'mat:workshop-steel', slats: 'mat:slatted-grille-steel' },
      rank: 1 as const,
    },
    'wm-stack': {
      source: {
        kind: 'param' as const,
        gen: 'duct',
        params: { width: 0.55, depth: 0.55, length: 0.42, flange: 0.04, flangeThickness: 0.025 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { duct: 'mat:workshop-steel', flange: 'mat:old-copper', bolts: 'mat:brushed-lab-steel' },
      rank: 1 as const,
    },
  },
  assemblies: {
    'water-maker': {
      children: [
        { ref: 'wm-skid', key: 'skid' },
        { ref: 'wm-condenser-core', key: 'core', on: { child: 0, socket: 'coreBody' } },
        { ref: 'wm-tank', key: 'tank-front', on: { child: 0, socket: 'tankLeft' } },
        { ref: 'wm-tank', key: 'tank-back', on: { child: 0, socket: 'tankRight' } },
        { ref: 'wm-louvre', key: 'front-louvre', on: { child: 1, socket: 'frontLouvre' } },
        { ref: 'wm-stack', key: 'vapor-stack', on: { child: 1, socket: 'topStack' } },
      ],
      sockets: {
        feedInput: { at: [-1.4, 0.5, 0] },
        aquaticExhaust: { at: [-0.45, 2.8, -0.45] },
        powerCable: { at: [0, 0.14, -1.48] },
      },
    },
  },
});

/**
 * 6. ROCK_DRILL_V2_KIT (Sheet 12 #1 & DEC-04: Square-section derrick, auger column, front ore chute & rear dust-mote stack).
 */
export const ROCK_DRILL_V2_KIT: Kit = Object.freeze<any>({
  parts: {
    'drill-skid': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 2.5, depth: 2.6, height: 0.26, bevel: 0.03, plinthHeight: 0.06, plinthInset: 0.02 },
      },
      material: 'mat:rust-bucket',
      slotMaterials: { body: 'mat:rust-bucket', trim: 'mat:hazard-chevron' },
      rank: 0 as const,
      sockets: {
        motorHousing: { at: [0, 0.26, -0.25] },
        oreChute: { at: [0, 0.26, 0.92] },
      },
    },
    'drill-housing': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 1.65, depth: 1.65, height: 1.95, bevel: 0.03, bands: 3, bandRaise: 0.02 },
      },
      material: 'mat:field-worn-hazard',
      slotMaterials: { body: 'mat:field-worn-hazard', trim: 'mat:workshop-steel', band: 'mat:rust-bucket' },
      rank: 0 as const,
      sockets: {
        topHead: { at: [0, 1.95, 0] },
        dustStack: { at: [0.45, 1.95, -0.45] },
      },
    },
    'drill-head': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 1.1, depth: 1.1, height: 0.55, bevel: 0.025 },
      },
      material: 'mat:oily-engine',
      slotMaterials: { body: 'mat:oily-engine', trim: 'mat:workshop-steel' },
      rank: 1 as const,
    },
    'drill-chute': {
      source: {
        kind: 'param' as const,
        gen: 'chute',
        params: { width: 0.78, length: 0.72, drop: 0.18, wallHeight: 0.24, wall: 0.03 },
      },
      material: 'mat:crushed-ore-bed',
      slotMaterials: { bed: 'mat:crushed-ore-bed', cheeks: 'mat:workshop-steel' },
      rank: 1 as const,
    },
    'drill-dust-stack': {
      source: {
        kind: 'param' as const,
        gen: 'pipe',
        params: { radius: 0.12, length: 0.52, flangeRadius: 0.16, flangeThickness: 0.025 },
      },
      material: 'mat:rust-bucket',
      slotMaterials: { pipe: 'mat:rust-bucket', flange: 'mat:workshop-steel' },
      rank: 1 as const,
    },
  },
  assemblies: {
    'rock-drill': {
      children: [
        { ref: 'drill-skid', key: 'skid' },
        { ref: 'drill-housing', key: 'housing', on: { child: 0, socket: 'motorHousing' } },
        { ref: 'drill-head', key: 'head', on: { child: 1, socket: 'topHead' } },
        { ref: 'drill-chute', key: 'ore-chute', on: { child: 0, socket: 'oreChute' } },
        { ref: 'drill-dust-stack', key: 'dust-stack', on: { child: 1, socket: 'dustStack' } },
      ],
      sockets: {
        oreOutput: { at: [0, 0.44, 1.28] },
        dustExhaust: { at: [0.45, 2.73, -0.7] },
        powerCable: { at: [0, 0.14, -1.3] },
      },
    },
  },
});

/**
 * 7. POWER_UNIT_V2_KIT (Sheet 12 #7: Field Generator with radiator grille banks, copper bus bars & amber beacon).
 */
export const POWER_UNIT_V2_KIT: Kit = Object.freeze<any>({
  parts: {
    'pu-skid': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 2.6, depth: 2.2, height: 0.24, bevel: 0.025, plinthHeight: 0.06, plinthInset: 0.02 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { body: 'mat:workshop-steel', trim: 'mat:hazard-chevron' },
      rank: 0 as const,
      sockets: {
        mainCore: { at: [0, 0.24, 0] },
      },
    },
    'pu-core': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 2.2, depth: 1.8, height: 1.85, bevel: 0.03, bands: 2, bandRaise: 0.02, topLip: 0.025 },
      },
      material: 'mat:furnace',
      slotMaterials: { body: 'mat:furnace', trim: 'mat:workshop-steel', band: 'mat:old-copper' },
      rank: 0 as const,
      sockets: {
        frontGrille: { at: [0, 0.92, 0.9], rot: [90, 0, 0] },
        topBeacon: { at: [0, 1.85, 0] },
      },
    },
    'pu-grille': {
      source: {
        kind: 'param' as const,
        gen: 'grille',
        params: { width: 1.5, depth: 1.1, thickness: 0.06, frame: 0.06, bars: 8, barWidth: 0.04 },
      },
      material: 'mat:slatted-grille-steel',
      slotMaterials: { frame: 'mat:workshop-steel', slats: 'mat:slatted-grille-steel' },
      rank: 1 as const,
    },
    'pu-beacon': {
      source: {
        kind: 'param' as const,
        gen: 'lamp',
        params: { width: 0.26, depth: 0.26, height: 0.16, rim: 0.025, guardBars: 3 },
      },
      material: 'lx:2700:2.0:pulse:ffc13d',
      slotMaterials: { bezel: 'mat:old-copper', lens: 'lx:2700:2.0:pulse:ffc13d', cage: 'mat:workshop-steel' },
      rank: 1 as const,
    },
  },
  assemblies: {
    'power-unit': {
      children: [
        { ref: 'pu-skid', key: 'skid' },
        { ref: 'pu-core', key: 'core', on: { child: 0, socket: 'mainCore' } },
        { ref: 'pu-grille', key: 'front-grille', on: { child: 1, socket: 'frontGrille' } },
        { ref: 'pu-beacon', key: 'beacon', on: { child: 1, socket: 'topBeacon' } },
      ],
      sockets: {
        powerBusOut: { at: [1.3, 0.14, 0] },
        powerBusIn: { at: [-1.3, 0.14, 0] },
      },
    },
  },
});

/**
 * 8. RELAY_PYLON_V2_KIT (Sheet 12 #8: Grounded cruciform base, box-section mast, ceramic insulators & 15m Safe Dome beacon).
 */
export const RELAY_PYLON_V2_KIT: Kit = Object.freeze<any>({
  parts: {
    'pylon-foot': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 1.2, depth: 1.2, height: 0.28, bevel: 0.025, plinthHeight: 0.06, plinthInset: 0.02 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { body: 'mat:workshop-steel', trim: 'mat:hazard-chevron' },
      rank: 0 as const,
      sockets: {
        mastBase: { at: [0, 0.28, 0] },
      },
    },
    'pylon-mast': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 0.28, depth: 0.28, height: 3.1, bevel: 0.02, bands: 4, bandRaise: 0.015 },
      },
      material: 'mat:brushed-lab-steel',
      slotMaterials: { body: 'mat:brushed-lab-steel', trim: 'mat:workshop-steel', band: 'mat:old-copper' },
      rank: 0 as const,
      sockets: {
        crossArm: { at: [0, 2.75, 0] },
        topBeacon: { at: [0, 3.1, 0] },
      },
    },
    'pylon-crossarm': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 1.45, depth: 0.24, height: 0.16, bevel: 0.02 },
      },
      material: 'mat:old-copper',
      slotMaterials: { body: 'mat:old-copper', trim: 'mat:workshop-steel' },
      rank: 1 as const,
    },
    'pylon-beacon': {
      source: {
        kind: 'param' as const,
        gen: 'lamp',
        params: { width: 0.24, depth: 0.24, height: 0.18, rim: 0.025, guardBars: 2 },
      },
      material: 'lx:2700:2.2:steady:ffc13d',
      slotMaterials: { bezel: 'mat:old-copper', lens: 'lx:2700:2.2:steady:ffc13d', cage: 'mat:workshop-steel' },
      rank: 1 as const,
    },
  },
  assemblies: {
    'relay-pylon': {
      children: [
        { ref: 'pylon-foot', key: 'foot' },
        { ref: 'pylon-mast', key: 'mast', on: { child: 0, socket: 'mastBase' } },
        { ref: 'pylon-crossarm', key: 'crossarm', on: { child: 1, socket: 'crossArm' } },
        { ref: 'pylon-beacon', key: 'beacon', on: { child: 1, socket: 'topBeacon' } },
      ],
      sockets: {
        powerLineIn: { at: [-0.65, 3.03, 0] },
        powerLineOut: { at: [0.65, 3.03, 0] },
      },
    },
  },
});

/**
 * 9. ROVER_SCOUT_V2_KIT (Sheet 19 Modular Scout Rover: Square-section frame, empty cab with [-u-] yoke per Rule 12,
 * 4x 20-sided radial wheels grounded at y=0, rear cargo socket, and roof antenna).
 */
export const ROVER_SCOUT_V2_KIT: Kit = Object.freeze<any>({
  parts: {
    'rover-wheel': {
      source: {
        kind: 'param' as const,
        gen: 'wheel',
        params: { radius: 0.38, width: 0.26, hubRadius: 0.18, rimDepth: 0.04, lugs: 6 },
      },
      material: 'mat:rubber-seal',
      slotMaterials: { tyre: 'mat:rubber-seal', rim: 'mat:workshop-steel', hub: 'mat:field-worn-hazard' },
      rank: 0 as const,
      sockets: {
        chassisMountFL: { at: [0.76, 0.32, -0.95] },
      },
    },
    'rover-chassis': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 1.36, depth: 2.5, height: 0.44, bevel: 0.03, bands: 2, bandRaise: 0.015 },
      },
      material: 'mat:field-worn-hazard',
      slotMaterials: { body: 'mat:field-worn-hazard', trim: 'mat:workshop-steel', band: 'mat:hazard-chevron' },
      rank: 0 as const,
      sockets: {
        cabRollcage: { at: [0, 0.44, 0.25] },
        yokeMount: { at: [0, 0.44, 0.65] },
        rearCargoBed: { at: [0, 0.44, -0.78] },
        headlightL: { at: [-0.45, 0.24, 1.25], rot: [90, 0, 0] },
        headlightR: { at: [0.45, 0.24, 1.25], rot: [90, 0, 0] },
      },
    },
    'rover-rollcage': {
      source: {
        kind: 'param' as const,
        gen: 'ladder',
        params: { width: 1.24, height: 0.86, railSection: 0.06, rungs: 2, rungSize: 0.05 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { rails: 'mat:workshop-steel', rungs: 'mat:brushed-lab-steel' },
      rank: 0 as const,
      sockets: {
        aerialSocket: { at: [0.52, 0.86, 0] },
      },
    },
    'rover-yoke': {
      source: {
        kind: 'param' as const,
        gen: 'handle',
        params: { span: 0.34, standoff: 0.22, barSize: 0.035, footWidth: 0.08, footHeight: 0.03 },
      },
      material: 'mat:carbon-racer',
      slotMaterials: { grip: 'mat:carbon-racer', feet: 'mat:workshop-steel' },
      rank: 1 as const,
    },
    'rover-cargo-bin': {
      source: {
        kind: 'param' as const,
        gen: 'hopper',
        params: { topWidth: 1.1, topDepth: 0.78, bottomWidth: 1.0, bottomDepth: 0.72, height: 0.38, wall: 0.03, rimHeight: 0.04 },
      },
      material: 'mat:workshop-steel',
      slotMaterials: { body: 'mat:workshop-steel', rim: 'mat:hazard-chevron' },
      rank: 1 as const,
    },
    'rover-headlight': {
      source: {
        kind: 'param' as const,
        gen: 'lamp',
        params: { width: 0.2, depth: 0.14, height: 0.08, rim: 0.02, guardBars: 2 },
      },
      material: 'lx:5800:2.4:steady:eef6ff',
      slotMaterials: { bezel: 'mat:workshop-steel', lens: 'lx:5800:2.4:steady:eef6ff', cage: 'mat:brushed-lab-steel' },
      rank: 1 as const,
    },
    'rover-aerial': {
      source: {
        kind: 'param' as const,
        gen: 'pipe',
        params: { radius: 0.018, length: 0.65, flangeRadius: 0.045, flangeThickness: 0.02 },
      },
      material: 'mat:brushed-lab-steel',
      slotMaterials: { pipe: 'mat:brushed-lab-steel', flange: 'mat:old-copper' },
      rank: 1 as const,
    },
  },
  assemblies: {
    'modular-scout': {
      children: [
        { ref: 'rover-wheel', key: 'wheel-fl', at: [-0.76, 0, 0.95] },
        { ref: 'rover-wheel', key: 'wheel-fr', at: [0.76, 0, 0.95], mirror: 'x' },
        { ref: 'rover-wheel', key: 'wheel-bl', at: [-0.76, 0, -0.95] },
        { ref: 'rover-wheel', key: 'wheel-br', at: [0.76, 0, -0.95], mirror: 'x' },
        { ref: 'rover-chassis', key: 'chassis', on: { child: 0, socket: 'chassisMountFL' } },
        { ref: 'rover-rollcage', key: 'rollcage', on: { child: 4, socket: 'cabRollcage' } },
        { ref: 'rover-yoke', key: 'square-yoke', on: { child: 4, socket: 'yokeMount' } },
        { ref: 'rover-cargo-bin', key: 'rear-cargo', on: { child: 4, socket: 'rearCargoBed' } },
        { ref: 'rover-headlight', key: 'headlight-l', on: { child: 4, socket: 'headlightL' } },
        { ref: 'rover-headlight', key: 'headlight-r', on: { child: 4, socket: 'headlightR' } },
        { ref: 'rover-aerial', key: 'aerial', on: { child: 5, socket: 'aerialSocket' } },
      ],
      sockets: {
        cargoMount: { at: [0, 1.14, -0.78] },
        boostExhaust: { at: [0, 0.54, -1.25] },
      },
    },
  },
});

export type StudioKitRegistryEntry = StudioKitEntry;
export interface StudioKitEntry {
  readonly id: string;
  readonly label: string;
  readonly category: 'campaign-machine' | 'portal-gate' | 'power-grid' | 'vehicle' | 'calibration' | 'station' | 'companion';
  readonly kit: Kit;
  readonly rootPreset: string;
  readonly powerKw: number;
  readonly metricRole: 'pxd' | 'vtx' | 'lx' | 'aq' | 'power' | 'portal' | 'transport' | 'test' | 'bridge' | 'companion';
  /** Plan 57 §14: salvaged from the parked lab and story, not one of the ten machine kits. */
  readonly salvaged?: true;
}

export const STUDIO_KIT_REGISTRY: Readonly<Record<string, StudioKitEntry>> = Object.freeze({
  'kit:texture-mill': {
    id: 'kit:texture-mill',
    label: 'Texture Mill V2 (Pxd)',
    category: 'campaign-machine',
    kit: MILL_V2_KIT,
    rootPreset: 'mill-frame',
    powerKw: -35,
    metricRole: 'pxd',
  },
  'kit:stargate': {
    id: 'kit:stargate',
    label: 'Network Stargate (Portal)',
    category: 'portal-gate',
    kit: STARGATE_V2_KIT,
    rootPreset: 'stargate-frame',
    powerKw: 100,
    metricRole: 'portal',
  },
  'kit:capacitor-bank': {
    id: 'kit:capacitor-bank',
    label: 'Capacitor Bank V2 (Power)',
    category: 'power-grid',
    kit: CAPACITOR_BANK_PURE_KIT,
    rootPreset: 'capacitor-bank',
    powerKw: 150,
    metricRole: 'power',
  },
  'kit:shape-press': {
    id: 'kit:shape-press',
    label: 'Shape Press V2 (Vtx)',
    category: 'campaign-machine',
    kit: SHAPE_PRESS_V2_KIT,
    rootPreset: 'shape-press',
    powerKw: -30,
    metricRole: 'vtx',
  },
  'kit:water-maker': {
    id: 'kit:water-maker',
    label: 'Water Maker V2 (Aq)',
    category: 'campaign-machine',
    kit: WATER_MAKER_V2_KIT,
    rootPreset: 'water-maker',
    powerKw: -45,
    metricRole: 'aq',
  },
  'kit:rock-drill': {
    id: 'kit:rock-drill',
    label: 'Rock Drill V2 (Ore)',
    category: 'campaign-machine',
    kit: ROCK_DRILL_V2_KIT,
    rootPreset: 'rock-drill',
    powerKw: -25,
    metricRole: 'vtx',
  },
  'kit:power-unit': {
    id: 'kit:power-unit',
    label: 'Power Unit V2 (+250 kW)',
    category: 'power-grid',
    kit: POWER_UNIT_V2_KIT,
    rootPreset: 'power-unit',
    powerKw: 250,
    metricRole: 'power',
  },
  'kit:relay-pylon': {
    id: 'kit:relay-pylon',
    label: 'Relay Pylon V2 (15m Safe Dome)',
    category: 'power-grid',
    kit: RELAY_PYLON_V2_KIT,
    rootPreset: 'relay-pylon',
    powerKw: -5,
    metricRole: 'lx',
  },
  'kit:rover-scout': {
    id: 'kit:rover-scout',
    label: 'Modular Scout Rover ([-u-] Yoke)',
    category: 'vehicle',
    kit: ROVER_SCOUT_V2_KIT,
    rootPreset: 'modular-scout',
    powerKw: 0,
    metricRole: 'transport',
  },
  'kit:test-piece': {
    id: 'kit:test-piece',
    label: 'Matstack Test Piece (0.60m)',
    category: 'calibration',
    kit: MATSTACK_TEST_PIECE_KIT,
    rootPreset: 'matstack-test-piece',
    powerKw: 0,
    metricRole: 'test',
  },
});

export const STUDIO_KIT_LIST: readonly StudioKitRegistryEntry[] = Object.freeze(Object.values(STUDIO_KIT_REGISTRY));

/**
 * Plan 57 §14: the lab and the story stripped for parts. Their own kits, salvaged as they are: each validates whole (grounded,
 * nothing floating) and builds, but none has the assembler's Triad sockets yet, so they wait here rather than on the assembler's
 * shelf; adding a kit's sockets moves it across. No power draw is modelled for them yet, so powerKw is 0. The bridge pad's
 * plinth runs 3 m down into the regolith on purpose (so the pad never floats on uneven ground); it is a declared `footing`, which
 * kitspec's validator allows to be buried.
 */
export const SALVAGE_KIT_REGISTRY: Readonly<Record<string, StudioKitEntry>> = Object.freeze({
  'kit:gate-dais':{ id: 'kit:gate-dais', label: 'Gate Dais (two-step plinth)', category: 'portal-gate', kit: GATE_DAIS_KIT, rootPreset: 'gate-dais', powerKw: 0, metricRole: 'portal', salvaged: true },
  'kit:archway-gate': { id: 'kit:archway-gate', label: 'Archway Gate', category: 'portal-gate', kit: GATE_KIT, rootPreset: 'gate', powerKw: 0, metricRole: 'portal', salvaged: true },
  'kit:fabricator-frame': { id: 'kit:fabricator-frame', label: 'Vehicle Fabricator Frame', category: 'station', kit: FABRICATOR_FRAME_KIT, rootPreset: 'fabricator-frame', powerKw: 0, metricRole: 'transport', salvaged: true },
  'kit:drone': { id: 'kit:drone', label: 'Companion Drone (rotors)', category: 'companion', kit: DRONE_KIT, rootPreset: 'drone', powerKw: 0, metricRole: 'companion', salvaged: true },
  'kit:drone-vacuum': { id: 'kit:drone-vacuum', label: 'Companion Drone (thrusters)', category: 'companion', kit: DRONE_KIT, rootPreset: 'drone-vacuum', powerKw: 0, metricRole: 'companion', salvaged: true },
  'kit:game-screen': { id: 'kit:game-screen', label: 'Bridge Screen', category: 'station', kit: GAME_SCREEN_KIT, rootPreset: 'game-screen', powerKw: 0, metricRole: 'bridge', salvaged: true },
  'kit:bridge-pad': { id: 'kit:bridge-pad', label: 'Bridge Pad', category: 'station', kit: BRIDGE_PAD_KIT, rootPreset: 'bridge-pad', powerKw: 0, metricRole: 'bridge', salvaged: true },
  'kit:hauler': { id: 'kit:hauler', label: 'Hauler', category: 'vehicle', kit: HAULER_KIT, rootPreset: 'vehicle', powerKw: 0, metricRole: 'transport', salvaged: true },
  'kit:crawler': { id: 'kit:crawler', label: 'Crawler', category: 'vehicle', kit: CRAWLER_KIT, rootPreset: 'vehicle', powerKw: 0, metricRole: 'transport', salvaged: true },
});

export const SALVAGE_KIT_LIST: readonly StudioKitRegistryEntry[] = Object.freeze(Object.values(SALVAGE_KIT_REGISTRY));
