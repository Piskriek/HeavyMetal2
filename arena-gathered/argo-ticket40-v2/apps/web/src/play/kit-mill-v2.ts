/**
 * TICKET-40 Pilot Machine #1: The Texture Mill rebuilt 100% from scratch (`MILL_V2_KIT`),
 * cross-checked against `opus-machines-reference-2026-10-21.png` (4-angle reference sheet)
 * and Concept Sheet 12.
 *
 * Visual anatomy matched from the 4-angle reference (`front +z`, `right +x`, `back -z`, `left -x`):
 *  1. Open Wide Plinth & Stepped Gusseted Pedestal (`y = 0..0.34 m`):
 *     - Wide olive/gunmetal base platform (`3.96 x 0.15 x 3.96 m`) with 4 corner anchor bolts (`±1.80 m`)
 *       and recessed floor drain/tread grilles (`plinth-tread-grille`) on the left and right aprons.
 *     - Stepped inner pedestal (`2.56 x 0.19 x 2.56 m`) surrounded by 8 gusset `bracket`s (2 per side)
 *       anchoring the central housing to the plinth.
 *  2. Integral 4-Pilaster Central Housing (`x, z in [-1.10, 1.10]`, `y = 0.34..3.04 m`):
 *     - Central mill carcass (`2.04 x 2.70 x 2.04 m` wearing `vault:painted-iron`) framed at its 4 corners
 *       by integral square pilasters (`±0.96 m`)—keeping the outer plinth apron completely open!
 *     - Front (`+z`) Face: Recessed 8-slat metallic shutter `grille` (`1.18 x 1.48 m`), upper header
 *       `bolted-wall-panel`, and the built-in `status-led` (`lamp` part) mounted directly on the
 *       front-right pilaster face (`[0.88, 1.42, 1.10]`) per Rule 8a (never a floating external mesh).
 *     - Right (`+x`) Face: Recessed cross-grid radiator screen (`grille` + vertical `clamp` bars),
 *       upper header panel, and the side exhaust stack manifold (`louvred-vent-box`) at `[1.715, 2.28, -0.48]`.
 *     - Back (`-z`) Face: Symmetrical recessed 8-slat metallic `grille`, upper header `bolted-wall-panel`,
 *       and rear `power-gland-box` (`[0, 0.15, -1.56]` with clipped `conduit` reaching `[0, 0.2, -1.8]`).
 *     - Left (`-x`) Face (replaces the old AI model's unlit black void with functional hardware):
 *       Recessed `bolted-access-door` (plate + 2 hinges + latch handle + 4 corner bolts) and
 *       `cartridge-bay-module` (`.smx` cartridge + ejector throw lever).
 *  3. Heavy Crown Collar, Recessed Neck Waist & Wide Flared Ore Hopper (`y = 3.04..4.01 m`):
 *     - Heavy square crown collar (`2.28 x 0.26 x 2.28 m`) with twin `clamp` blocks on all 4 faces.
 *     - Dark recessed neck waist (`1.56 x 0.20 x 1.56 m`, `y = 3.30..3.50 m`).
 *     - Wide flared square-section ore `hopper` (`bottom 1.56 m -> top 2.24 m`, `y = 3.50..4.01 m`)
 *       with dark crushed ore blocks heaped inside the top liner around `feed` (`[0, 4.16, 0]`).
 */
import type { Kit } from '@hm/kitspec';
import { VAULT_KIT_SKINS } from './kit-trim-palette';
import { SHARED_MODULE_PARTS, SHARED_MODULE_ASSEMBLIES } from './kit-modules';

const PLINTH_H = 0.15;
const PEDESTAL_H = 0.19;
const BODY_Y = PLINTH_H + PEDESTAL_H; // 0.34 m
const BODY_H = 2.7;
const CROWN_Y = BODY_Y + BODY_H; // 3.04 m
const CROWN_H = 0.26;
const WAIST_Y = CROWN_Y + CROWN_H; // 3.30 m
const WAIST_H = 0.2;
const HOPPER_Y = WAIST_Y + WAIST_H; // 3.50 m

export const MILL_V2_KIT: Kit = {
  parts: {
    ...SHARED_MODULE_PARTS,
    'mill-base-plinth': {
      source: { kind: 'box', size: [3.96, PLINTH_H, 3.96] },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        pedestalCenter: { at: [0, PLINTH_H, 0] },
        treadLeft: { at: [-1.58, PLINTH_H, 1.2], rot: [-90, 0, 0] },
        treadRight: { at: [1.58, PLINTH_H, 1.2], rot: [-90, 0, 0] },
        boltFL: { at: [-1.8, PLINTH_H, 1.8] },
        boltFR: { at: [1.8, PLINTH_H, 1.8] },
        boltBL: { at: [-1.8, PLINTH_H, -1.8] },
        boltBR: { at: [1.8, PLINTH_H, -1.8] },
        gussetFrontL: { at: [-0.88, PLINTH_H, 1.1] },
        gussetFrontR: { at: [0.88, PLINTH_H, 1.1] },
        gussetBackL: { at: [-0.88, PLINTH_H, -1.1], rot: [0, 180, 0] },
        gussetBackR: { at: [0.88, PLINTH_H, -1.1], rot: [0, 180, 0] },
        gussetLeftF: { at: [-1.1, PLINTH_H, 0.88], rot: [0, -90, 0] },
        gussetLeftB: { at: [-1.1, PLINTH_H, -0.88], rot: [0, -90, 0] },
        gussetRightF: { at: [1.1, PLINTH_H, 0.88], rot: [0, 90, 0] },
        gussetRightB: { at: [1.1, PLINTH_H, -0.88], rot: [0, 90, 0] },
        stackRiserBase: { at: [1.38, PLINTH_H, -0.48] },
        powerRearBase: { at: [0, PLINTH_H, -1.56] },
        hazardFront: { at: [0, 0.03, 1.96] },
        hazardBack: { at: [0, 0.03, -1.96] },
      },
    },
    'mill-plinth-tread': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 0.52, height: 2.4, depth: 0.025, frame: 0.03, slats: 12, slat: 0.015 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 2,
    },
    'mill-step-pedestal': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 2.56, depth: 2.56, height: PEDESTAL_H, bevel: 0.025, baseBand: 0.06, bands: 1 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'hull-steel' },
      rank: 0,
      sockets: {
        carcassSeat: { at: [0, PEDESTAL_H, 0] },
        pilasterFL: { at: [-0.94, PEDESTAL_H, 0.94] },
        pilasterFR: { at: [0.94, PEDESTAL_H, 0.94] },
        pilasterBL: { at: [-0.94, PEDESTAL_H, -0.94] },
        pilasterBR: { at: [0.94, PEDESTAL_H, -0.94] },
      },
    },
    'mill-main-carcass': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 2.04, depth: 2.04, height: BODY_H, bevel: 0.035, baseBand: 0.14, bands: 2 },
      },
      material: VAULT_KIT_SKINS.warmBody,
      slotMaterials: { body: VAULT_KIT_SKINS.warmBody, trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        crownSeat: { at: [0, BODY_H, 0] },
        frontGrille: { at: [0, 0.28, 1.02] },
        frontHeader: { at: [0, 2.15, 1.02], rot: [90, 0, 0] },
        backGrille: { at: [0, 0.28, -1.02], rot: [0, 180, 0] },
        backHeader: { at: [0, 2.15, -1.02], rot: [-90, 0, 0] },
        rightScreen: { at: [1.02, 0.24, 0], rot: [0, 90, 0] },
        rightHeader: { at: [1.02, 2.15, 0], rot: [0, 0, -90] },
        leftServiceDoor: { at: [-1.02, 0.98, 0], rot: [0, 0, 90] },
        leftCartBay: { at: [-1.1, 1.92, 0] },
      },
    },
    'mill-corner-pilaster': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.32, depth: 0.32, height: BODY_H, bevel: 0.02, baseBand: 0.12, bands: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        statusLedMount: { at: [0, 1.08, 0.16] },
        sideLadderMount: { at: [0.16, 0.12, 0], rot: [0, 90, 0] },
      },
    },
    'mill-shutter-grille': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 1.24, height: 1.48, depth: 0.06, frame: 0.045, slats: 8, slat: 0.018 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 1,
    },
    'mill-radiator-screen': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 1.44, height: 1.52, depth: 0.06, frame: 0.045, slats: 9, slat: 0.016 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 1,
      sockets: {
        barLeft: { at: [-0.36, 0.76, 0.04], rot: [90, 0, 0] },
        barMid: { at: [0, 0.76, 0.04], rot: [90, 0, 0] },
        barRight: { at: [0.36, 0.76, 0.04], rot: [90, 0, 0] },
      },
    },
    'mill-screen-bar': {
      source: {
        kind: 'param',
        gen: 'clamp',
        params: { width: 0.08, length: 1.44, thickness: 0.02, bridgeHeight: 0.01, ribs: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { strap: 'hull-steel', ribs: 'accent-hardware', bolts: 'accent-hardware' },
      rank: 2,
    },
    'mill-header-panel': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 1.28, depth: 0.42, thickness: 0.045, bevel: 0.008, seam: 0.025, boltsPerSide: 3, boltHead: 0.022 },
      },
      material: VAULT_KIT_SKINS.warmBody,
      slotMaterials: { plate: VAULT_KIT_SKINS.warmBody, bolts: 'accent-hardware' },
      rank: 1,
    },
    'mill-status-led': {
      source: {
        kind: 'param',
        gen: 'lamp',
        params: { width: 0.16, height: 0.16, depth: 0.045, bezel: 0.02, visor: 0.018, guards: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { housing: 'hull-steel', lens: 'accent-hardware', guard: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'mill-crown-collar': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 2.28, depth: 2.28, height: CROWN_H, bevel: 0.025, baseBand: 0.06, bands: 1 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'hull-steel' },
      rank: 0,
      sockets: {
        waistSeat: { at: [0, CROWN_H, 0] },
        clampFront: { at: [0, 0.13, 1.14], rot: [90, 0, 0] },
        clampBack: { at: [0, 0.13, -1.14], rot: [-90, 0, 0] },
        clampLeft: { at: [-1.14, 0.13, 0], rot: [0, 0, 90] },
        clampRight: { at: [1.14, 0.13, 0], rot: [0, 0, -90] },
      },
    },
    'mill-neck-waist': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.56, depth: 1.56, height: WAIST_H, bevel: 0.02, baseBand: 0.04, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'accent-hardware', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        hopperSeat: { at: [0, WAIST_H, 0] },
      },
    },
    'mill-top-hopper': {
      source: {
        kind: 'param',
        gen: 'hopper',
        params: { topWidth: 2.24, topDepth: 2.24, bottomWidth: 1.56, bottomDepth: 1.56, height: 0.51, rimHeight: 0.1, wall: 0.06, shape: 0 },
      },
      material: VAULT_KIT_SKINS.warmBody,
      slotMaterials: { body: VAULT_KIT_SKINS.warmBody, trim: 'hull-steel', liner: 'accent-hardware', bolts: 'accent-hardware' },
      rank: 0,
      sockets: {
        oreMoundCenter: { at: [0, 0.36, 0] },
        handleFront: { at: [0, 0.42, 1.12], rot: [90, 0, 0] },
        handleBack: { at: [0, 0.42, -1.12], rot: [-90, 0, 0] },
      },
    },
    'mill-ore-mound': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.48, depth: 1.48, height: 0.15, bevel: 0.06, baseBand: 0.03, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'accent-hardware', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 1,
    },
    'mill-stack-riser': {
      source: {
        kind: 'param',
        gen: 'tank',
        params: { radius: 0.24, length: 1.55, axis: 0, sides: 8, capLength: 0.1, ribs: 2, ribHeight: 0.025 },
      },
      material: 'hull-steel',
      slotMaterials: { shell: 'hull-steel', caps: 'accent-hardware', ribs: 'accent-hardware', bolts: 'accent-hardware' },
      rank: 0,
      sockets: {
        ventBoxTop: { at: [0, 1.55, 0] },
      },
    },
    'mill-hazard-strip': {
      source: { kind: 'box', size: [2.4, 0.09, 0.03] },
      material: 'hull-steel',
      rank: 1,
    },
  },
  assemblies: {
    ...SHARED_MODULE_ASSEMBLIES,
    'mill-radiator-module': {
      children: [
        { ref: 'mill-radiator-screen', key: 'screen' },
        { ref: 'mill-screen-bar', key: 'bar-l', on: { child: 0, socket: 'barLeft' } },
        { ref: 'mill-screen-bar', key: 'bar-m', on: { child: 0, socket: 'barMid' } },
        { ref: 'mill-screen-bar', key: 'bar-r', on: { child: 0, socket: 'barRight' } },
      ],
    },
    'mill-frame': {
      children: [
        { ref: 'mill-base-plinth', key: 'plinth' },
        { ref: 'mill-plinth-tread', key: 'tread-left', on: { child: 0, socket: 'treadLeft' } },
        { ref: 'mill-plinth-tread', key: 'tread-right', on: { child: 0, socket: 'treadRight' } },
        { ref: 'mod-hex-bolt', key: 'plinth-bolt-fl', on: { child: 0, socket: 'boltFL' } },
        { ref: 'mod-hex-bolt', key: 'plinth-bolt-fr', on: { child: 0, socket: 'boltFR' } },
        { ref: 'mod-hex-bolt', key: 'plinth-bolt-bl', on: { child: 0, socket: 'boltBL' } },
        { ref: 'mod-hex-bolt', key: 'plinth-bolt-br', on: { child: 0, socket: 'boltBR' } },
        { ref: 'mod-upright-gusset', key: 'gusset-fl', on: { child: 0, socket: 'gussetFrontL' } },
        { ref: 'mod-upright-gusset', key: 'gusset-fr', on: { child: 0, socket: 'gussetFrontR' } },
        { ref: 'mod-upright-gusset', key: 'gusset-bl', on: { child: 0, socket: 'gussetBackL' } },
        { ref: 'mod-upright-gusset', key: 'gusset-br', on: { child: 0, socket: 'gussetBackR' } },
        { ref: 'mod-upright-gusset', key: 'gusset-lf', on: { child: 0, socket: 'gussetLeftF' } },
        { ref: 'mod-upright-gusset', key: 'gusset-lb', on: { child: 0, socket: 'gussetLeftB' } },
        { ref: 'mod-upright-gusset', key: 'gusset-rf', on: { child: 0, socket: 'gussetRightF' } },
        { ref: 'mod-upright-gusset', key: 'gusset-rb', on: { child: 0, socket: 'gussetRightB' } },
        { ref: 'mill-step-pedestal', key: 'pedestal', on: { child: 0, socket: 'pedestalCenter' } },
        { ref: 'mill-main-carcass', key: 'carcass', on: { child: 15, socket: 'carcassSeat' } },
        { ref: 'mill-corner-pilaster', key: 'pilaster-fl', on: { child: 15, socket: 'pilasterFL' }, mirror: 'x' },
        { ref: 'mill-corner-pilaster', key: 'pilaster-fr', on: { child: 15, socket: 'pilasterFR' } },
        { ref: 'mill-corner-pilaster', key: 'pilaster-bl', on: { child: 15, socket: 'pilasterBL' }, mirror: 'x' },
        { ref: 'mill-corner-pilaster', key: 'pilaster-br', on: { child: 15, socket: 'pilasterBR' } },
        { ref: 'mill-status-led', key: 'status-led', on: { child: 18, socket: 'statusLedMount' } },
        { ref: 'mod-upright-ladder', key: 'service-ladder', on: { child: 20, socket: 'sideLadderMount' } },
        { ref: 'mill-shutter-grille', key: 'front-grille', on: { child: 16, socket: 'frontGrille' } },
        { ref: 'mill-header-panel', key: 'front-header', on: { child: 16, socket: 'frontHeader' } },
        { ref: 'mill-shutter-grille', key: 'back-grille', on: { child: 16, socket: 'backGrille' } },
        { ref: 'mill-header-panel', key: 'back-header', on: { child: 16, socket: 'backHeader' } },
        { ref: 'mill-radiator-module', key: 'right-radiator', on: { child: 16, socket: 'rightScreen' } },
        { ref: 'mill-header-panel', key: 'right-header', on: { child: 16, socket: 'rightHeader' } },
        { ref: 'bolted-access-door', key: 'left-service-door', on: { child: 16, socket: 'leftServiceDoor' } },
        { ref: 'cartridge-bay-module', key: 'cartridge-bay', on: { child: 16, socket: 'leftCartBay' } },
        { ref: 'mill-crown-collar', key: 'crown-collar', on: { child: 16, socket: 'crownSeat' } },
        { ref: 'mod-seam-clamp', key: 'crown-clamp-f', on: { child: 31, socket: 'clampFront' } },
        { ref: 'mod-seam-clamp', key: 'crown-clamp-b', on: { child: 31, socket: 'clampBack' } },
        { ref: 'mod-seam-clamp', key: 'crown-clamp-l', on: { child: 31, socket: 'clampLeft' } },
        { ref: 'mod-seam-clamp', key: 'crown-clamp-r', on: { child: 31, socket: 'clampRight' } },
        { ref: 'mill-neck-waist', key: 'neck-waist', on: { child: 31, socket: 'waistSeat' } },
        { ref: 'mill-top-hopper', key: 'top-hopper', on: { child: 36, socket: 'hopperSeat' } },
        { ref: 'mill-ore-mound', key: 'ore-mound', on: { child: 37, socket: 'oreMoundCenter' } },
        { ref: 'mod-door-handle', key: 'hopper-handle-f', on: { child: 37, socket: 'handleFront' } },
        { ref: 'mod-door-handle', key: 'hopper-handle-b', on: { child: 37, socket: 'handleBack' } },
        { ref: 'mill-stack-riser', key: 'stack-riser', on: { child: 0, socket: 'stackRiserBase' } },
        { ref: 'louvred-vent-box', key: 'side-vent-hood', on: { child: 41, socket: 'ventBoxTop' } },
        { ref: 'power-gland-box', key: 'power-gland', on: { child: 0, socket: 'powerRearBase' } },
        { ref: 'mill-hazard-strip', key: 'hazard-front', on: { child: 0, socket: 'hazardFront' } },
        { ref: 'mill-hazard-strip', key: 'hazard-back', on: { child: 0, socket: 'hazardBack' } },
      ],
      sockets: {
        vent: { at: [1.715, 2.28, -0.48] },
        stack: { at: [1.715, 2.28, -0.48] },
        feed: { at: [0, 4.16, 0] },
        hopper: { at: [0, 4.16, 0] },
        power: { at: [0, 0.2, -1.8] },
        statusLed: { at: [0.94, 1.42, 1.1] },
      },
    },
  },
};
