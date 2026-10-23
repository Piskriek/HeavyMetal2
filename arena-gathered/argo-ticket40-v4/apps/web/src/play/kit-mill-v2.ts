/**
 * TICKET-40 v4 Pilot Machine #1: The Texture Mill rebuilt 100% from scratch (`MILL_V2_KIT`),
 * matched 1:1 to today's `mill` footprint (`2.80 x 2.80 x 2.80 m`), `opus-machines-reference-2026-10-21.png`,
 * `OPUS_NOTE_41_ticket40_review_v3.md`, and Concept Sheet 12.
 *
 * Fixes in v4 (`OPUS_NOTE_41_ticket40_review_v3.md`):
 *  1. Exact 1:1 Footprint & Height (`2.80 x 2.80 x 2.80 m`, `x, z in [-1.40, 1.40]`, `y in [0, 2.80]`):
 *     Matches today's `mill` (`2.81 x 2.80 x 2.80 m`) so the plot placement footprint and build ghost match without change.
 *  2. Deep Ore-Filled Hopper (Not a Shallow Tray):
 *     - `mill-neck-waist` and `mill-top-hopper` wear dark cast-iron `mat:rust-bucket` (`MAT_PRESET_SKINS.darkHopper`)
 *       with dark `mat:crushed-ore-bed` (`MAT_PRESET_SKINS.crushedOre`) liner—never light khaki inside the throat.
 *     - Inside the hopper sits a multi-part dark crushed ore mound (`ore-mound` base bed + `ore-crown` center heap +
 *       4 angled corner ore lumps `ore-lump-fl/fr/bl/br`) rising to `y = 2.79 m` so dark jagged ore chunks are
 *       prominently visible from all four sides and from above.
 *  3. Base Hazard Stripes Wearing `mat:hazard-chevron`:
 *     - `mill-hazard-strip` and `mill-hazard-strip-side` wear `MAT_PRESET_SKINS.hazardStripe` (`'mat:hazard-chevron'`)
 *       along the front, back, left, and right base plinth edges.
 *  4. Glowing Status Lamp & Pink Cartridge Slot (`lx:` names):
 *     - `mill-status-led`'s `lens` wears `lx:3200:1.6:steady:ff4d3d` (`LX_LIGHT_MATERIALS.millStatusLamp`).
 *     - `cartridge-bay-module` wears `lx:6500:1.2:steady:ff4fd8` (`LX_LIGHT_MATERIALS.cartridgeSlotPink`).
 *  5. Unused `WAIST_Y` removed (strict typecheck clean).
 */
import type { Kit } from '@hm/kitspec';
import { LX_LIGHT_MATERIALS, MAT_PRESET_SKINS } from './kit-trim-palette';
import { SHARED_MODULE_ASSEMBLIES, SHARED_MODULE_PARTS } from './kit-modules';

const PLINTH_H = 0.11;
const PEDESTAL_H = 0.13;
const BODY_H = 1.88;
const CROWN_H = 0.18;
const WAIST_H = 0.14;
const HOPPER_H = 0.36; // 0.11 + 0.13 + 1.88 + 0.18 + 0.14 + 0.36 = 2.80 m exact!

export const MILL_V2_KIT: Kit = {
  parts: {
    ...SHARED_MODULE_PARTS,
    'mill-base-plinth': {
      source: { kind: 'box', size: [2.8, PLINTH_H, 2.8] },
      material: MAT_PRESET_SKINS.khakiBody,
      rank: 0,
      sockets: {
        pedestalCenter: { at: [0, PLINTH_H, 0] },
        treadLeft: { at: [-1.12, PLINTH_H, 0.84], rot: [-90, 0, 0] },
        treadRight: { at: [1.12, PLINTH_H, 0.84], rot: [-90, 0, 0] },
        boltFL: { at: [-1.26, PLINTH_H, 1.26] },
        boltFR: { at: [1.26, PLINTH_H, 1.26] },
        boltBL: { at: [-1.26, PLINTH_H, -1.26] },
        boltBR: { at: [1.26, PLINTH_H, -1.26] },
        gussetFrontL: { at: [-0.62, PLINTH_H, 0.78] },
        gussetFrontR: { at: [0.62, PLINTH_H, 0.78] },
        gussetBackL: { at: [-0.62, PLINTH_H, -0.78], rot: [0, 180, 0] },
        gussetBackR: { at: [0.62, PLINTH_H, -0.78], rot: [0, 180, 0] },
        gussetLeftF: { at: [-0.78, PLINTH_H, 0.62], rot: [0, -90, 0] },
        gussetLeftB: { at: [-0.78, PLINTH_H, -0.62], rot: [0, -90, 0] },
        gussetRightF: { at: [0.78, PLINTH_H, 0.62], rot: [0, 90, 0] },
        gussetRightB: { at: [0.78, PLINTH_H, -0.62], rot: [0, 90, 0] },
        stackRiserBase: { at: [0.98, PLINTH_H, -0.34] },
        powerRearBase: { at: [0, PLINTH_H, -1.06] },
        hazardFront: { at: [0, 0.02, 1.388] },
        hazardBack: { at: [0, 0.02, -1.388] },
        hazardLeft: { at: [-1.388, 0.02, 0] },
        hazardRight: { at: [1.388, 0.02, 0] },
      },
    },
    'mill-plinth-tread': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 0.38, height: 1.68, depth: 0.02, frame: 0.024, slats: 10, slat: 0.012 },
      },
      material: MAT_PRESET_SKINS.slattedGrille,
      slotMaterials: { frame: MAT_PRESET_SKINS.brushedTrim, slats: MAT_PRESET_SKINS.slattedGrille },
      rank: 2,
    },
    'mill-step-pedestal': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.82, depth: 1.82, height: PEDESTAL_H, bevel: 0.02, baseBand: 0.04, bands: 1 },
      },
      material: MAT_PRESET_SKINS.darkHopper,
      slotMaterials: {
        body: MAT_PRESET_SKINS.darkHopper,
        trim: MAT_PRESET_SKINS.brushedTrim,
        band: MAT_PRESET_SKINS.darkHopper,
      },
      rank: 0,
      sockets: {
        carcassSeat: { at: [0, PEDESTAL_H, 0] },
        pilasterFL: { at: [-0.67, PEDESTAL_H, 0.67] },
        pilasterFR: { at: [0.67, PEDESTAL_H, 0.67] },
        pilasterBL: { at: [-0.67, PEDESTAL_H, -0.67] },
        pilasterBR: { at: [0.67, PEDESTAL_H, -0.67] },
      },
    },
    'mill-main-carcass': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.46, depth: 1.46, height: BODY_H, bevel: 0.025, baseBand: 0.1, bands: 2 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: {
        body: MAT_PRESET_SKINS.khakiBody,
        trim: MAT_PRESET_SKINS.brushedTrim,
        band: MAT_PRESET_SKINS.darkHopper,
      },
      rank: 0,
      sockets: {
        crownSeat: { at: [0, BODY_H, 0] },
        frontGrille: { at: [0, 0.2, 0.73] },
        frontHeader: { at: [0, 1.5, 0.73], rot: [90, 0, 0] },
        backGrille: { at: [0, 0.2, -0.73], rot: [0, 180, 0] },
        backHeader: { at: [0, 1.5, -0.73], rot: [-90, 0, 0] },
        rightScreen: { at: [0.73, 0.18, 0], rot: [0, 90, 0] },
        rightHeader: { at: [0.73, 1.5, 0], rot: [0, 0, -90] },
        leftServiceDoor: { at: [-0.73, 0.66, 0], rot: [0, 0, 90] },
        leftCartBay: { at: [-0.78, 1.34, 0] },
      },
    },
    'mill-corner-pilaster': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.24, depth: 0.24, height: BODY_H, bevel: 0.015, baseBand: 0.09, bands: 2 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: {
        body: MAT_PRESET_SKINS.khakiBody,
        trim: MAT_PRESET_SKINS.brushedTrim,
        band: MAT_PRESET_SKINS.darkHopper,
      },
      rank: 0,
      sockets: {
        statusLedMount: { at: [0, 0.76, 0.12] },
        sideLadderMount: { at: [0.12, 0.08, 0], rot: [0, 90, 0] },
      },
    },
    'mill-shutter-grille': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 0.9, height: 1.06, depth: 0.045, frame: 0.035, slats: 8, slat: 0.014 },
      },
      material: MAT_PRESET_SKINS.slattedGrille,
      slotMaterials: { frame: MAT_PRESET_SKINS.brushedTrim, slats: MAT_PRESET_SKINS.slattedGrille },
      rank: 1,
    },
    'mill-radiator-screen': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 1.02, height: 1.08, depth: 0.045, frame: 0.035, slats: 9, slat: 0.012 },
      },
      material: MAT_PRESET_SKINS.slattedGrille,
      slotMaterials: { frame: MAT_PRESET_SKINS.brushedTrim, slats: MAT_PRESET_SKINS.slattedGrille },
      rank: 1,
      sockets: {
        barLeft: { at: [-0.26, 0.54, 0.03], rot: [90, 0, 0] },
        barMid: { at: [0, 0.54, 0.03], rot: [90, 0, 0] },
        barRight: { at: [0.26, 0.54, 0.03], rot: [90, 0, 0] },
      },
    },
    'mill-screen-bar': {
      source: {
        kind: 'param',
        gen: 'clamp',
        params: { width: 0.06, length: 1.02, thickness: 0.016, bridgeHeight: 0.008, ribs: 2 },
      },
      material: MAT_PRESET_SKINS.brushedTrim,
      slotMaterials: {
        strap: MAT_PRESET_SKINS.brushedTrim,
        ribs: MAT_PRESET_SKINS.darkHopper,
        bolts: MAT_PRESET_SKINS.brushedTrim,
      },
      rank: 2,
    },
    'mill-header-panel': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.92, depth: 0.3, thickness: 0.035, bevel: 0.006, seam: 0.02, boltsPerSide: 3, boltHead: 0.018 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { plate: MAT_PRESET_SKINS.khakiBody, bolts: MAT_PRESET_SKINS.brushedTrim },
      rank: 1,
    },
    'mill-status-led': {
      source: {
        kind: 'param',
        gen: 'lamp',
        params: { width: 0.13, height: 0.13, depth: 0.038, bezel: 0.016, visor: 0.014, guards: 1 },
      },
      material: LX_LIGHT_MATERIALS.millStatusLamp,
      slotMaterials: {
        housing: MAT_PRESET_SKINS.brushedTrim,
        lens: LX_LIGHT_MATERIALS.millStatusLamp,
        guard: MAT_PRESET_SKINS.darkHopper,
        bolts: MAT_PRESET_SKINS.brushedTrim,
      },
      rank: 1,
    },
    'mill-crown-collar': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.64, depth: 1.64, height: CROWN_H, bevel: 0.02, baseBand: 0.045, bands: 1 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: {
        body: MAT_PRESET_SKINS.khakiBody,
        trim: MAT_PRESET_SKINS.brushedTrim,
        band: MAT_PRESET_SKINS.darkHopper,
      },
      rank: 0,
      sockets: {
        waistSeat: { at: [0, CROWN_H, 0] },
        clampFront: { at: [0, 0.09, 0.82], rot: [90, 0, 0] },
        clampBack: { at: [0, 0.09, -0.82], rot: [-90, 0, 0] },
        clampLeft: { at: [-0.82, 0.09, 0], rot: [0, 0, 90] },
        clampRight: { at: [0.82, 0.09, 0], rot: [0, 0, -90] },
      },
    },
    'mill-neck-waist': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.12, depth: 1.12, height: WAIST_H, bevel: 0.015, baseBand: 0.03, bands: 1 },
      },
      material: MAT_PRESET_SKINS.darkHopper,
      slotMaterials: {
        body: MAT_PRESET_SKINS.darkHopper,
        trim: MAT_PRESET_SKINS.darkHopper,
        band: MAT_PRESET_SKINS.darkHopper,
      },
      rank: 0,
      sockets: {
        hopperSeat: { at: [0, WAIST_H, 0] },
      },
    },
    'mill-top-hopper': {
      source: {
        kind: 'param',
        gen: 'hopper',
        params: {
          topWidth: 1.62,
          topDepth: 1.62,
          bottomWidth: 1.12,
          bottomDepth: 1.12,
          height: HOPPER_H,
          rimHeight: 0.075,
          wall: 0.045,
          shape: 0,
        },
      },
      material: MAT_PRESET_SKINS.darkHopper,
      slotMaterials: {
        body: MAT_PRESET_SKINS.darkHopper,
        trim: MAT_PRESET_SKINS.darkHopper,
        liner: MAT_PRESET_SKINS.crushedOre,
        bolts: MAT_PRESET_SKINS.brushedTrim,
      },
      rank: 0,
      sockets: {
        oreMoundCenter: { at: [0, 0.1, 0] },
        handleFront: { at: [0, 0.3, 0.81], rot: [90, 0, 0] },
        handleBack: { at: [0, 0.3, -0.81], rot: [-90, 0, 0] },
      },
    },
    'mill-ore-mound': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 1.22, depth: 1.22, height: 0.18, bevel: 0.05, baseBand: 0.03, bands: 1 },
      },
      material: MAT_PRESET_SKINS.crushedOre,
      slotMaterials: {
        body: MAT_PRESET_SKINS.crushedOre,
        trim: MAT_PRESET_SKINS.crushedOre,
        band: MAT_PRESET_SKINS.darkHopper,
      },
      rank: 0,
      sockets: {
        crownSeat: { at: [0, 0.14, 0] },
        lumpFL: { at: [-0.28, 0.12, 0.26], rot: [0, 28, 0] },
        lumpFR: { at: [0.26, 0.12, 0.28], rot: [0, -34, 0] },
        lumpBL: { at: [-0.26, 0.12, -0.28], rot: [0, 42, 0] },
        lumpBR: { at: [0.28, 0.12, -0.24], rot: [0, -22, 0] },
      },
    },
    'mill-ore-crown': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.86, depth: 0.86, height: 0.11, bevel: 0.045, baseBand: 0.02, bands: 1 },
      },
      material: MAT_PRESET_SKINS.crushedOre,
      slotMaterials: {
        body: MAT_PRESET_SKINS.crushedOre,
        trim: MAT_PRESET_SKINS.crushedOre,
        band: MAT_PRESET_SKINS.darkHopper,
      },
      rank: 1,
    },
    'mill-ore-chunk': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.42, depth: 0.38, height: 0.12, bevel: 0.04, baseBand: 0.02, bands: 1 },
      },
      material: MAT_PRESET_SKINS.crushedOre,
      slotMaterials: {
        body: MAT_PRESET_SKINS.crushedOre,
        trim: MAT_PRESET_SKINS.crushedOre,
        band: MAT_PRESET_SKINS.darkHopper,
      },
      rank: 1,
    },
    'mill-stack-riser': {
      source: {
        kind: 'param',
        gen: 'tank',
        params: { radius: 0.17, length: 1.08, axis: 0, sides: 8, capLength: 0.07, ribs: 2, ribHeight: 0.018 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: {
        shell: MAT_PRESET_SKINS.khakiBody,
        caps: MAT_PRESET_SKINS.darkHopper,
        ribs: MAT_PRESET_SKINS.brushedTrim,
        bolts: MAT_PRESET_SKINS.brushedTrim,
      },
      rank: 0,
      sockets: {
        ventBoxTop: { at: [0, 1.08, 0] },
      },
    },
    'mill-hazard-strip': {
      source: { kind: 'box', size: [2.2, 0.075, 0.024] },
      material: MAT_PRESET_SKINS.hazardStripe,
      rank: 1,
    },
    'mill-hazard-strip-side': {
      source: { kind: 'box', size: [0.024, 0.075, 2.2] },
      material: MAT_PRESET_SKINS.hazardStripe,
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
        { ref: 'mill-ore-crown', key: 'ore-crown', on: { child: 38, socket: 'crownSeat' } },
        { ref: 'mill-ore-chunk', key: 'ore-lump-fl', on: { child: 38, socket: 'lumpFL' } },
        { ref: 'mill-ore-chunk', key: 'ore-lump-fr', on: { child: 38, socket: 'lumpFR' } },
        { ref: 'mill-ore-chunk', key: 'ore-lump-bl', on: { child: 38, socket: 'lumpBL' } },
        { ref: 'mill-ore-chunk', key: 'ore-lump-br', on: { child: 38, socket: 'lumpBR' } },
        { ref: 'mod-door-handle', key: 'hopper-handle-f', on: { child: 37, socket: 'handleFront' } },
        { ref: 'mod-door-handle', key: 'hopper-handle-b', on: { child: 37, socket: 'handleBack' } },
        { ref: 'mill-stack-riser', key: 'stack-riser', on: { child: 0, socket: 'stackRiserBase' } },
        { ref: 'louvred-vent-box', key: 'side-vent-hood', on: { child: 46, socket: 'ventBoxTop' } },
        { ref: 'power-gland-box', key: 'power-gland', on: { child: 0, socket: 'powerRearBase' } },
        { ref: 'mill-hazard-strip', key: 'hazard-front', on: { child: 0, socket: 'hazardFront' } },
        { ref: 'mill-hazard-strip', key: 'hazard-back', on: { child: 0, socket: 'hazardBack' } },
        { ref: 'mill-hazard-strip-side', key: 'hazard-left', on: { child: 0, socket: 'hazardLeft' } },
        { ref: 'mill-hazard-strip-side', key: 'hazard-right', on: { child: 0, socket: 'hazardRight' } },
      ],
      sockets: {
        vent: { at: [1.2, 1.6, -0.34] },
        stack: { at: [1.2, 1.6, -0.34] },
        feed: { at: [0, 2.8, 0] },
        hopper: { at: [0, 2.8, 0] },
        power: { at: [0, 0.14, -1.26] },
        statusLed: { at: [0.67, 1.0, 0.79] },
      },
    },
  },
};
