/**
 * @hm/kitspec Shared Multi-Part Module Library (TICKET-40 v4 §2) & Plan 41 §4.6 Test Piece.
 *
 * Every module is a reusable `AssemblyDef` built out of `@hm/partgen` parametric parts on sockets:
 *  1. `bolted-wall-panel`: bevelled panel plate + 4 individually addressable corner hex bolts + seam clamp.
 *  2. `bolted-access-door`: heavy service door plate + 2 left hinges + right grab handle + glowing status lamp (`lx:`) + 4 corner bolts.
 *  3. `louvred-vent-box`: square exhaust plenum can + angled weather louvre hood + inner slat grille + 4 flange bolts.
 *  4. `gantry-upright-leg`: base foot pad + square upright column + 2 gusset brackets + access ladder + 4 anchor bolts.
 *  5. `hopper-chute-module`: flared square ore hopper + angled feed slide chute + 2 support brackets + rim clamp.
 *  6. `power-gland-box`: junction box + flanged elbow pipe + armoured cable conduit with clips + glowing status lamp (`lx:`) + 2 bolts.
 *  7. `cartridge-bay-module`: recessed cartridge receiver housing with pink signal glow (`lx:6500:1.2:steady:ff4fd8`) + inserted .smx cartridge + ejector lever.
 */
import type { AssemblyDef, Kit, PartDef } from '@hm/kitspec';
import { LX_LIGHT_MATERIALS, MAT_PRESET_SKINS } from './kit-trim-palette';

export const SHARED_MODULE_PARTS: Readonly<Record<string, PartDef>> = Object.freeze({
  'mod-hex-bolt': {
    source: {
      kind: 'param' as const,
      gen: 'bolt',
      params: { headWidth: 0.04, headHeight: 0.02, shankDia: 0.018, shankLength: 0, head: 1 },
    },
    material: MAT_PRESET_SKINS.brushedTrim,
    rank: 2,
  },
  'mod-wall-plate': {
    source: {
      kind: 'param' as const,
      gen: 'panel',
      params: { width: 0.84, depth: 1.04, thickness: 0.04, bevel: 0.008, seam: 0.028, boltsPerSide: 0, boltHead: 0.022 },
    },
    material: MAT_PRESET_SKINS.khakiBody,
    slotMaterials: { plate: MAT_PRESET_SKINS.khakiBody, bolts: MAT_PRESET_SKINS.brushedTrim },
    rank: 1,
    sockets: {
      boltTL: { at: [-0.35, 0.04, -0.44] },
      boltTR: { at: [0.35, 0.04, -0.44] },
      boltBL: { at: [-0.35, 0.04, 0.44] },
      boltBR: { at: [0.35, 0.04, 0.44] },
      topClamp: { at: [0, 0.04, -0.48] },
    },
  },
  'mod-seam-clamp': {
    source: {
      kind: 'param' as const,
      gen: 'clamp',
      params: { width: 0.62, length: 0.1, thickness: 0.018, bridgeHeight: 0.01, ribs: 2 },
    },
    material: MAT_PRESET_SKINS.brushedTrim,
    slotMaterials: {
      strap: MAT_PRESET_SKINS.brushedTrim,
      ribs: MAT_PRESET_SKINS.darkHopper,
      bolts: MAT_PRESET_SKINS.brushedTrim,
    },
    rank: 2,
  },
  'mod-door-plate': {
    source: {
      kind: 'param' as const,
      gen: 'panel',
      params: { width: 0.68, depth: 0.92, thickness: 0.04, bevel: 0.008, seam: 0.024, boltsPerSide: 0, boltHead: 0.02 },
    },
    material: MAT_PRESET_SKINS.khakiBody,
    slotMaterials: { plate: MAT_PRESET_SKINS.khakiBody, bolts: MAT_PRESET_SKINS.brushedTrim },
    rank: 1,
    sockets: {
      hingeTop: { at: [-0.32, 0.04, -0.28], rot: [-90, 0, 0] },
      hingeBot: { at: [-0.32, 0.04, 0.18], rot: [-90, 0, 0] },
      handleLatch: { at: [0.24, 0.04, 0], rot: [0, 0, 0] },
      statusLamp: { at: [0, 0.04, -0.34], rot: [-90, 0, 0] },
      boltTL: { at: [-0.28, 0.04, -0.4] },
      boltTR: { at: [0.28, 0.04, -0.4] },
      boltBL: { at: [-0.28, 0.04, 0.4] },
      boltBR: { at: [0.28, 0.04, 0.4] },
    },
  },
  'mod-door-hinge': {
    source: {
      kind: 'param' as const,
      gen: 'hinge',
      params: { width: 0.075, height: 0.11, thickness: 0.012, pinRadius: 0.014, knuckles: 3 },
    },
    material: MAT_PRESET_SKINS.brushedTrim,
    slotMaterials: {
      plate: MAT_PRESET_SKINS.brushedTrim,
      pin: MAT_PRESET_SKINS.darkHopper,
      bolts: MAT_PRESET_SKINS.brushedTrim,
    },
    rank: 2,
  },
  'mod-door-handle': {
    source: {
      kind: 'param' as const,
      gen: 'handle',
      params: { span: 0.18, reach: 0.065, thickness: 0.018, gripWidth: 0.11, mode: 0 },
    },
    material: MAT_PRESET_SKINS.brushedTrim,
    slotMaterials: {
      mount: MAT_PRESET_SKINS.brushedTrim,
      shaft: MAT_PRESET_SKINS.darkHopper,
      grip: MAT_PRESET_SKINS.hazardStripe,
      bolts: MAT_PRESET_SKINS.brushedTrim,
    },
    rank: 1,
  },
  'mod-status-lamp': {
    source: {
      kind: 'param' as const,
      gen: 'lamp',
      params: { width: 0.18, height: 0.09, depth: 0.04, bezel: 0.015, visor: 0.015, guards: 2 },
    },
    material: MAT_PRESET_SKINS.brushedTrim,
    slotMaterials: {
      housing: MAT_PRESET_SKINS.brushedTrim,
      lens: LX_LIGHT_MATERIALS.doorStatusLamp,
      guard: MAT_PRESET_SKINS.darkHopper,
      bolts: MAT_PRESET_SKINS.brushedTrim,
    },
    rank: 1,
  },
  'mod-vent-plenum': {
    source: {
      kind: 'param' as const,
      gen: 'can',
      params: { width: 0.44, depth: 0.32, height: 0.42, bevel: 0.016, baseBand: 0.06, bands: 1 },
    },
    material: MAT_PRESET_SKINS.khakiBody,
    slotMaterials: {
      body: MAT_PRESET_SKINS.khakiBody,
      trim: MAT_PRESET_SKINS.brushedTrim,
      band: MAT_PRESET_SKINS.darkHopper,
    },
    rank: 1,
    sockets: {
      louvreFront: { at: [0, 0.05, 0.16] },
      grilleTop: { at: [0, 0.42, -0.13], rot: [-90, 0, 0] },
      boltFL: { at: [-0.18, 0.42, 0.11] },
      boltFR: { at: [0.18, 0.42, 0.11] },
    },
  },
  'mod-vent-louvre': {
    source: {
      kind: 'param' as const,
      gen: 'louvre',
      params: { width: 0.38, height: 0.32, hoodDepth: 0.1, flange: 0.028, slats: 5 },
    },
    material: MAT_PRESET_SKINS.slattedGrille,
    slotMaterials: {
      hood: MAT_PRESET_SKINS.brushedTrim,
      throat: MAT_PRESET_SKINS.darkHopper,
      slats: MAT_PRESET_SKINS.slattedGrille,
      bolts: MAT_PRESET_SKINS.brushedTrim,
    },
    rank: 1,
  },
  'mod-vent-grille': {
    source: {
      kind: 'param' as const,
      gen: 'grille',
      params: { width: 0.36, height: 0.26, depth: 0.03, frame: 0.024, slats: 5, slat: 0.008 },
    },
    material: MAT_PRESET_SKINS.slattedGrille,
    slotMaterials: { frame: MAT_PRESET_SKINS.brushedTrim, slats: MAT_PRESET_SKINS.slattedGrille },
    rank: 2,
  },
  'mod-upright-pad': {
    source: { kind: 'box', size: [0.36, 0.12, 0.36] },
    material: MAT_PRESET_SKINS.darkHopper,
    rank: 0,
    sockets: {
      colTop: { at: [0, 0.12, 0] },
      gussetFront: { at: [0, 0.12, 0.13] },
      gussetBack: { at: [0, 0.12, -0.13], rot: [0, 180, 0] },
      boltFL: { at: [-0.14, 0.12, 0.14] },
      boltFR: { at: [0.14, 0.12, 0.14] },
      boltBL: { at: [-0.14, 0.12, -0.14] },
      boltBR: { at: [0.14, 0.12, -0.14] },
    },
  },
  'mod-upright-column': {
    source: {
      kind: 'param' as const,
      gen: 'can',
      params: { width: 0.26, depth: 0.26, height: 2.36, bevel: 0.02, baseBand: 0.1, bands: 2 },
    },
    material: MAT_PRESET_SKINS.brushedTrim,
    slotMaterials: {
      body: MAT_PRESET_SKINS.brushedTrim,
      trim: MAT_PRESET_SKINS.brushedTrim,
      band: MAT_PRESET_SKINS.darkHopper,
    },
    rank: 0,
    sockets: {
      ladderFace: { at: [0, 0.18, 0.13] },
      topCap: { at: [0, 2.36, 0] },
    },
  },
  'mod-upright-gusset': {
    source: {
      kind: 'param' as const,
      gen: 'bracket',
      params: { width: 0.14, upright: 0.22, foot: 0.18, thickness: 0.018, gusset: 1 },
    },
    material: MAT_PRESET_SKINS.brushedTrim,
    slotMaterials: { steel: MAT_PRESET_SKINS.brushedTrim, bolts: MAT_PRESET_SKINS.darkHopper },
    rank: 2,
  },
  'mod-upright-ladder': {
    source: {
      kind: 'param' as const,
      gen: 'ladder',
      params: { width: 0.22, height: 1.72, stileSection: 0.024, rungStep: 0.24, standoff: 0.045, mode: 0 },
    },
    material: MAT_PRESET_SKINS.brushedTrim,
    slotMaterials: {
      stiles: MAT_PRESET_SKINS.brushedTrim,
      rungs: MAT_PRESET_SKINS.darkHopper,
      cage: MAT_PRESET_SKINS.brushedTrim,
      bolts: MAT_PRESET_SKINS.darkHopper,
    },
    rank: 2,
  },
  'mod-hopper-funnel': {
    source: {
      kind: 'param' as const,
      gen: 'hopper',
      params: { topWidth: 0.92, topDepth: 0.92, bottomWidth: 0.54, bottomDepth: 0.54, height: 0.34, rimHeight: 0.06, wall: 0.04, shape: 0 },
    },
    material: MAT_PRESET_SKINS.darkHopper,
    slotMaterials: {
      body: MAT_PRESET_SKINS.darkHopper,
      trim: MAT_PRESET_SKINS.brushedTrim,
      liner: MAT_PRESET_SKINS.crushedOre,
      bolts: MAT_PRESET_SKINS.brushedTrim,
    },
    rank: 0,
    sockets: {
      chuteSide: { at: [0, 0.03, 0.27] },
      bracketL: { at: [-0.27, 0, 0], rot: [0, -90, 0] },
      bracketR: { at: [0.27, 0, 0], rot: [0, 90, 0] },
      rimClampF: { at: [0, 0.34, 0.42] },
      rimClampB: { at: [0, 0.34, -0.42] },
    },
  },
  'mod-feed-chute': {
    source: {
      kind: 'param' as const,
      gen: 'chute',
      params: { width: 0.44, length: 0.38, drop: 0.12, cheekHeight: 0.1, wall: 0.02 },
    },
    material: MAT_PRESET_SKINS.darkHopper,
    slotMaterials: {
      trough: MAT_PRESET_SKINS.darkHopper,
      cheeks: MAT_PRESET_SKINS.brushedTrim,
      bolts: MAT_PRESET_SKINS.brushedTrim,
    },
    rank: 1,
  },
  'mod-power-junction': {
    source: {
      kind: 'param' as const,
      gen: 'can',
      params: { width: 0.34, depth: 0.22, height: 0.28, bevel: 0.015, baseBand: 0.045, bands: 1 },
    },
    material: MAT_PRESET_SKINS.darkHopper,
    slotMaterials: {
      body: MAT_PRESET_SKINS.darkHopper,
      trim: MAT_PRESET_SKINS.copperBus,
      band: MAT_PRESET_SKINS.brushedTrim,
    },
    rank: 1,
    sockets: {
      elbowOut: { at: [0.1, 0.28, 0] },
      conduitRun: { at: [0, 0, -0.11] },
      lampFront: { at: [0, 0.1, 0.11] },
      boltL: { at: [-0.12, 0.28, 0] },
      boltR: { at: [0.12, 0.28, 0] },
    },
  },
  'mod-power-elbow': {
    source: {
      kind: 'param' as const,
      gen: 'pipe',
      params: { radius: 0.04, length: 0.2, armLength: 0.18, elbow: 1, sides: 8, flangeWidth: 0.016 },
    },
    material: MAT_PRESET_SKINS.copperBus,
    slotMaterials: {
      pipe: MAT_PRESET_SKINS.copperBus,
      flange: MAT_PRESET_SKINS.brushedTrim,
      bolts: MAT_PRESET_SKINS.darkHopper,
    },
    rank: 1,
  },
  'mod-power-conduit': {
    source: {
      kind: 'param' as const,
      gen: 'conduit',
      params: { length: 1.08, width: 0.06, height: 0.06, clips: 3, glandLength: 0.045 },
    },
    material: MAT_PRESET_SKINS.rubberSeal,
    slotMaterials: {
      cable: MAT_PRESET_SKINS.rubberSeal,
      clips: MAT_PRESET_SKINS.brushedTrim,
      gland: MAT_PRESET_SKINS.copperBus,
      bolts: MAT_PRESET_SKINS.darkHopper,
    },
    rank: 2,
  },
  'mod-cartridge-housing': {
    source: {
      kind: 'param' as const,
      gen: 'can',
      params: { width: 0.14, depth: 0.4, height: 0.28, bevel: 0.012, baseBand: 0.04, bands: 1 },
    },
    material: MAT_PRESET_SKINS.brushedTrim,
    slotMaterials: {
      body: MAT_PRESET_SKINS.brushedTrim,
      trim: LX_LIGHT_MATERIALS.cartridgeSlotPink,
      band: LX_LIGHT_MATERIALS.cartridgeSlotPink,
    },
    rank: 1,
    sockets: {
      cartSlot: { at: [-0.05, 0.06, 0] },
      ejectorLever: { at: [0, 0.28, 0.12] },
      railTop: { at: [0, 0.28, -0.07] },
    },
  },
  'mod-smx-cartridge': {
    source: {
      kind: 'param' as const,
      gen: 'can',
      params: { width: 0.16, depth: 0.24, height: 0.16, bevel: 0.01, baseBand: 0.03, bands: 2 },
    },
    material: LX_LIGHT_MATERIALS.cartridgeSlotPink,
    slotMaterials: {
      body: MAT_PRESET_SKINS.darkHopper,
      trim: LX_LIGHT_MATERIALS.cartridgeSlotPink,
      band: LX_LIGHT_MATERIALS.cartridgeSlotPink,
    },
    rank: 1,
  },
  'mod-ejector-lever': {
    source: {
      kind: 'param' as const,
      gen: 'handle',
      params: { span: 0.12, reach: 0.09, thickness: 0.016, gripWidth: 0.09, mode: 1 },
    },
    material: MAT_PRESET_SKINS.brushedTrim,
    slotMaterials: {
      mount: MAT_PRESET_SKINS.brushedTrim,
      shaft: MAT_PRESET_SKINS.darkHopper,
      grip: MAT_PRESET_SKINS.hazardStripe,
      bolts: MAT_PRESET_SKINS.darkHopper,
    },
    rank: 1,
  },
});

export const SHARED_MODULE_ASSEMBLIES: Readonly<Record<string, AssemblyDef>> = Object.freeze({
  'bolted-wall-panel': {
    children: [
      { ref: 'mod-wall-plate', key: 'plate' },
      { ref: 'mod-hex-bolt', key: 'bolt-tl', on: { child: 0, socket: 'boltTL' } },
      { ref: 'mod-hex-bolt', key: 'bolt-tr', on: { child: 0, socket: 'boltTR' } },
      { ref: 'mod-hex-bolt', key: 'bolt-bl', on: { child: 0, socket: 'boltBL' } },
      { ref: 'mod-hex-bolt', key: 'bolt-br', on: { child: 0, socket: 'boltBR' } },
      { ref: 'mod-seam-clamp', key: 'seam-clamp', on: { child: 0, socket: 'topClamp' } },
    ],
  },
  'bolted-access-door': {
    children: [
      { ref: 'mod-door-plate', key: 'door-plate' },
      { ref: 'mod-door-hinge', key: 'hinge-top', on: { child: 0, socket: 'hingeTop' } },
      { ref: 'mod-door-hinge', key: 'hinge-bottom', on: { child: 0, socket: 'hingeBot' } },
      { ref: 'mod-door-handle', key: 'latch-handle', on: { child: 0, socket: 'handleLatch' } },
      { ref: 'mod-status-lamp', key: 'door-lamp', on: { child: 0, socket: 'statusLamp' } },
      { ref: 'mod-hex-bolt', key: 'bolt-tl', on: { child: 0, socket: 'boltTL' } },
      { ref: 'mod-hex-bolt', key: 'bolt-tr', on: { child: 0, socket: 'boltTR' } },
      { ref: 'mod-hex-bolt', key: 'bolt-bl', on: { child: 0, socket: 'boltBL' } },
      { ref: 'mod-hex-bolt', key: 'bolt-br', on: { child: 0, socket: 'boltBR' } },
    ],
  },
  'louvred-vent-box': {
    children: [
      { ref: 'mod-vent-plenum', key: 'plenum' },
      { ref: 'mod-vent-louvre', key: 'louvre-hood', on: { child: 0, socket: 'louvreFront' } },
      { ref: 'mod-vent-grille', key: 'top-grille', on: { child: 0, socket: 'grilleTop' } },
      { ref: 'mod-hex-bolt', key: 'bolt-fl', on: { child: 0, socket: 'boltFL' } },
      { ref: 'mod-hex-bolt', key: 'bolt-fr', on: { child: 0, socket: 'boltFR' } },
    ],
  },
  'gantry-upright-leg': {
    children: [
      { ref: 'mod-upright-pad', key: 'foot-pad' },
      { ref: 'mod-upright-column', key: 'column', on: { child: 0, socket: 'colTop' } },
      { ref: 'mod-upright-gusset', key: 'gusset-front', on: { child: 0, socket: 'gussetFront' } },
      { ref: 'mod-upright-gusset', key: 'gusset-back', on: { child: 0, socket: 'gussetBack' } },
      { ref: 'mod-upright-ladder', key: 'ladder', on: { child: 1, socket: 'ladderFace' } },
      { ref: 'mod-hex-bolt', key: 'bolt-fl', on: { child: 0, socket: 'boltFL' } },
      { ref: 'mod-hex-bolt', key: 'bolt-fr', on: { child: 0, socket: 'boltFR' } },
      { ref: 'mod-hex-bolt', key: 'bolt-bl', on: { child: 0, socket: 'boltBL' } },
      { ref: 'mod-hex-bolt', key: 'bolt-br', on: { child: 0, socket: 'boltBR' } },
    ],
  },
  'hopper-chute-module': {
    children: [
      { ref: 'mod-hopper-funnel', key: 'hopper' },
      { ref: 'mod-feed-chute', key: 'chute', on: { child: 0, socket: 'chuteSide' } },
      { ref: 'mod-upright-gusset', key: 'support-l', on: { child: 0, socket: 'bracketL' } },
      { ref: 'mod-upright-gusset', key: 'support-r', on: { child: 0, socket: 'bracketR' } },
      { ref: 'mod-seam-clamp', key: 'clamp-front', on: { child: 0, socket: 'rimClampF' } },
      { ref: 'mod-seam-clamp', key: 'clamp-back', on: { child: 0, socket: 'rimClampB' } },
    ],
  },
  'power-gland-box': {
    children: [
      { ref: 'mod-power-junction', key: 'junction' },
      { ref: 'mod-power-elbow', key: 'gland-elbow', on: { child: 0, socket: 'elbowOut' } },
      { ref: 'mod-power-conduit', key: 'cable-run', on: { child: 0, socket: 'conduitRun' } },
      { ref: 'mod-status-lamp', key: 'power-lamp', on: { child: 0, socket: 'lampFront' } },
      { ref: 'mod-hex-bolt', key: 'bolt-l', on: { child: 0, socket: 'boltL' } },
      { ref: 'mod-hex-bolt', key: 'bolt-r', on: { child: 0, socket: 'boltR' } },
    ],
  },
  'cartridge-bay-module': {
    children: [
      { ref: 'mod-cartridge-housing', key: 'bay-housing' },
      { ref: 'mod-smx-cartridge', key: 'smx-cartridge', on: { child: 0, socket: 'cartSlot' } },
      { ref: 'mod-ejector-lever', key: 'ejector-lever', on: { child: 0, socket: 'ejectorLever' } },
      { ref: 'mod-seam-clamp', key: 'guide-clamp', on: { child: 0, socket: 'railTop' } },
    ],
  },
});

/**
 * Plan 41 §4.6 Material Test Piece (`MATSTACK_TEST_PIECE_KIT`):
 * Built from 5 `@hm/partgen` parts on sockets (`0.60 m` tall, grounded at `y = 0`):
 *  - `tp-skid`: grounded skid (`can`);
 *  - `tp-bevel-panel`: bevelled `panel` with a bolt row;
 *  - `tp-square-beam`: square-section `beam` column (`0.52 m` on the `0.08 m` skid = `0.60 m` total height);
 *  - `tp-bracket`: gusseted `bracket`;
 *  - `tp-short-can`: short `can` housing.
 */
export const MATSTACK_TEST_PIECE_KIT: Kit = Object.freeze({
  parts: {
    'tp-skid': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 0.56, depth: 0.48, height: 0.08, bevel: 0.012, plinthHeight: 0.02, plinthInset: 0.01, topLip: 0.01 },
      },
      material: MAT_PRESET_SKINS.darkHopper,
      slotMaterials: { body: MAT_PRESET_SKINS.darkHopper, trim: MAT_PRESET_SKINS.brushedTrim },
      rank: 0,
      sockets: {
        panelMount: { at: [-0.08, 0.28, -0.14], rot: [90, 0, 0] },
        beamMount: { at: [0.22, 0.34, -0.12], rot: [0, 0, 90] },
        bracketMount: { at: [-0.08, 0.08, -0.02] },
        canMount: { at: [0.12, 0.08, 0.1] },
      },
    },
    'tp-bevel-panel': {
      source: {
        kind: 'param' as const,
        gen: 'panel',
        params: { width: 0.34, depth: 0.4, thickness: 0.045, bevel: 0.018, seam: 0.03, boltsPerSide: 3, boltHead: 0.024 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { plate: MAT_PRESET_SKINS.khakiBody, bolts: MAT_PRESET_SKINS.brushedTrim },
      rank: 0,
    },
    'tp-square-beam': {
      source: {
        kind: 'param' as const,
        gen: 'beam',
        params: { length: 0.52, section: 0.12, wall: 0.012 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { steel: MAT_PRESET_SKINS.khakiBody },
      rank: 0,
    },
    'tp-bracket': {
      source: {
        kind: 'param' as const,
        gen: 'bracket',
        params: { width: 0.12, upright: 0.22, foot: 0.18, thickness: 0.02, gusset: 1 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { steel: MAT_PRESET_SKINS.khakiBody, bolts: MAT_PRESET_SKINS.brushedTrim },
      rank: 1,
    },
    'tp-short-can': {
      source: {
        kind: 'param' as const,
        gen: 'can',
        params: { width: 0.18, depth: 0.18, height: 0.26, bevel: 0.015, plinthHeight: 0.03, plinthInset: 0.01, topLip: 0.015 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { body: MAT_PRESET_SKINS.khakiBody, trim: MAT_PRESET_SKINS.hazardStripe },
      rank: 1,
    },
  },
  assemblies: {
    'matstack-test-piece': {
      children: [
        { ref: 'tp-skid', key: 'skid' },
        { ref: 'tp-bevel-panel', key: 'bevel-panel', on: { child: 0, socket: 'panelMount' } },
        { ref: 'tp-square-beam', key: 'square-beam', on: { child: 0, socket: 'beamMount' } },
        { ref: 'tp-bracket', key: 'bracket', on: { child: 0, socket: 'bracketMount' } },
        { ref: 'tp-short-can', key: 'short-can', on: { child: 0, socket: 'canMount' } },
      ],
    },
  },
} as Kit);

export { MAT_PRESET_SKINS } from './kit-trim-palette';
export const TEST_PIECE_HEIGHT = 0.60;
export const TEST_PIECE_PRESET = 'matstack-test-piece';

/**
 * The same kit with every material key (and every slot material) replaced by `name`, for a preview that dresses the whole piece in one
 * material. Generators, sockets and ranks are untouched, so the geometry is identical.
 */
export function withMaterial(kit: Kit, name: string): Kit {
  const parts = Object.fromEntries(
    Object.entries(kit.parts).map(([id, part]) => [
      id,
      {
        ...part,
        material: name,
        ...(part.slotMaterials
          ? { slotMaterials: Object.fromEntries(Object.keys(part.slotMaterials).map((slot) => [slot, name])) }
          : {}),
      },
    ]),
  );
  return { parts, assemblies: kit.assemblies };
}

/** Every material key a kit names (its parts' and their slots'), for a cartridge palette or a validation pass. */
export function kitMaterialKeys(kit: Kit): readonly string[] {
  const out = new Set<string>();
  for (const part of Object.values(kit.parts)) {
    out.add(part.material);
    for (const m of Object.values(part.slotMaterials ?? {})) out.add(m);
  }
  return [...out].sort();
}

