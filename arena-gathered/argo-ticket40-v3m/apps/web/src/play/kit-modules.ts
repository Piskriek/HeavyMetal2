/**
 * @hm/kitspec Shared Multi-Part Module Library (TICKET-40 §2).
 *
 * Every module is a reusable `AssemblyDef` built out of `@hm/partgen` parametric parts on sockets:
 *  1. `bolted-wall-panel`: bevelled panel plate + 4 individually addressable corner hex bolts + seam clamp.
 *  2. `bolted-access-door`: heavy service door plate + 2 left hinges + right grab handle + top status lamp + 4 corner bolts.
 *  3. `louvred-vent-box`: square exhaust plenum can + angled weather louvre hood + inner slat grille + 4 flange bolts.
 *  4. `gantry-upright-leg`: base foot pad + square upright column + bolted wall panel + 2 gusset brackets + access ladder + 4 anchor bolts.
 *  5. `hopper-chute-module`: flared square ore hopper + angled feed slide chute + 2 support brackets + rim clamp.
 *  6. `power-gland-box`: junction box + flanged elbow pipe + armoured cable conduit with clips + status lamp + 2 bolts.
 *  7. `cartridge-bay-module`: recessed cartridge receiver housing + guide clamps + inserted .smx cartridge + ejector lever.
 *
 * Because every bolt, hinge, handle, louvre, lamp, and clamp is a separate placed child part in the
 * module's `children[]` array, firing a Part Cartridge from the Beam Rifle at a single bolt on a door
 * or panel addresses its exact path (e.g. `front-door/bolt-tr`) while Hold/Shift-Fire upgrades all bolts!
 */
import type { AssemblyDef, PartDef } from '@hm/kitspec';
import { MAT_PRESET_SKINS } from './kit-trim-palette';

export const SHARED_MODULE_PARTS: Readonly<Record<string, PartDef>> = Object.freeze({
  'mod-hex-bolt': {
    source: {
      kind: 'param',
      gen: 'bolt',
      params: { headWidth: 0.045, headHeight: 0.022, shankDia: 0.02, shankLength: 0, head: 1 },
    },
    material: 'accent-hardware',
    rank: 2,
  },
  'mod-wall-plate': {
    source: {
      kind: 'param',
      gen: 'panel',
      params: { width: 1.1, depth: 1.4, thickness: 0.045, bevel: 0.01, seam: 0.035, boltsPerSide: 0, boltHead: 0.025 },
    },
    material: MAT_PRESET_SKINS.khakiBody,
    slotMaterials: { plate: MAT_PRESET_SKINS.khakiBody, bolts: 'accent-hardware' },
    rank: 1,
    sockets: {
      boltTL: { at: [-0.46, 0.045, -0.6] },
      boltTR: { at: [0.46, 0.045, -0.6] },
      boltBL: { at: [-0.46, 0.045, 0.6] },
      boltBR: { at: [0.46, 0.045, 0.6] },
      topClamp: { at: [0, 0.045, -0.66] },
    },
  },
  'mod-seam-clamp': {
    source: {
      kind: 'param',
      gen: 'clamp',
      params: { width: 0.88, length: 0.12, thickness: 0.02, bridgeHeight: 0.012, ribs: 2 },
    },
    material: 'hull-steel',
    slotMaterials: { strap: 'hull-steel', ribs: 'accent-hardware', bolts: 'accent-hardware' },
    rank: 2,
  },
  'mod-door-plate': {
    source: {
      kind: 'param',
      gen: 'panel',
      params: { width: 0.92, depth: 1.28, thickness: 0.05, bevel: 0.01, seam: 0.03, boltsPerSide: 0, boltHead: 0.025 },
    },
    material: MAT_PRESET_SKINS.khakiBody,
    slotMaterials: { plate: MAT_PRESET_SKINS.khakiBody, bolts: 'accent-hardware' },
    rank: 1,
    sockets: {
      hingeTop: { at: [-0.44, 0.05, -0.38], rot: [-90, 0, 0] },
      hingeBot: { at: [-0.44, 0.05, 0.24], rot: [-90, 0, 0] },
      handleLatch: { at: [0.32, 0.05, 0], rot: [0, 0, 0] },
      statusLamp: { at: [0, 0.05, -0.48], rot: [-90, 0, 0] },
      boltTL: { at: [-0.38, 0.05, -0.56] },
      boltTR: { at: [0.38, 0.05, -0.56] },
      boltBL: { at: [-0.38, 0.05, 0.56] },
      boltBR: { at: [0.38, 0.05, 0.56] },
    },
  },
  'mod-door-hinge': {
    source: {
      kind: 'param',
      gen: 'hinge',
      params: { width: 0.09, height: 0.14, thickness: 0.014, pinRadius: 0.016, knuckles: 3 },
    },
    material: 'accent-hardware',
    slotMaterials: { plate: 'hull-steel', pin: 'accent-hardware', bolts: 'accent-hardware' },
    rank: 2,
  },
  'mod-door-handle': {
    source: {
      kind: 'param',
      gen: 'handle',
      params: { span: 0.24, reach: 0.08, thickness: 0.022, gripWidth: 0.14, mode: 0 },
    },
    material: 'accent-hardware',
    slotMaterials: { mount: 'hull-steel', shaft: 'accent-hardware', grip: 'hull-steel', bolts: 'accent-hardware' },
    rank: 1,
  },
  'mod-status-lamp': {
    source: {
      kind: 'param',
      gen: 'lamp',
      params: { width: 0.24, height: 0.12, depth: 0.05, bezel: 0.02, visor: 0.02, guards: 2 },
    },
    material: 'accent-hardware',
    slotMaterials: { housing: 'hull-steel', lens: 'accent-hardware', guard: 'hull-steel', bolts: 'accent-hardware' },
    rank: 1,
  },
  'mod-vent-plenum': {
    source: {
      kind: 'param',
      gen: 'can',
      params: { width: 0.64, depth: 0.44, height: 0.58, bevel: 0.02, baseBand: 0.08, bands: 1 },
    },
    material: 'hull-steel',
    slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
    rank: 1,
    sockets: {
      louvreFront: { at: [0, 0.06, 0.22] },
      grilleTop: { at: [0, 0.58, -0.18], rot: [-90, 0, 0] },
      boltFL: { at: [-0.26, 0.58, 0.16] },
      boltFR: { at: [0.26, 0.58, 0.16] },
    },
  },
  'mod-vent-louvre': {
    source: {
      kind: 'param',
      gen: 'louvre',
      params: { width: 0.54, height: 0.46, hoodDepth: 0.14, flange: 0.035, slats: 5 },
    },
    material: 'accent-hardware',
    slotMaterials: { hood: 'hull-steel', throat: 'accent-hardware', slats: 'accent-hardware', bolts: 'accent-hardware' },
    rank: 1,
  },
  'mod-vent-grille': {
    source: {
      kind: 'param',
      gen: 'grille',
      params: { width: 0.52, height: 0.36, depth: 0.04, frame: 0.03, slats: 5, slat: 0.01 },
    },
    material: 'accent-hardware',
    slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
    rank: 2,
  },
  'mod-upright-pad': {
    source: { kind: 'box', size: [0.46, 0.16, 0.46] },
    material: 'hull-steel',
    rank: 0,
    sockets: {
      colTop: { at: [0, 0.16, 0] },
      gussetFront: { at: [0, 0.16, 0.17] },
      gussetBack: { at: [0, 0.16, -0.17], rot: [0, 180, 0] },
      boltFL: { at: [-0.18, 0.16, 0.18] },
      boltFR: { at: [0.18, 0.16, 0.18] },
      boltBL: { at: [-0.18, 0.16, -0.18] },
      boltBR: { at: [0.18, 0.16, -0.18] },
    },
  },
  'mod-upright-column': {
    source: {
      kind: 'param',
      gen: 'can',
      params: { width: 0.34, depth: 0.34, height: 3.36, bevel: 0.025, baseBand: 0.14, bands: 2 },
    },
    material: 'hull-steel',
    slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
    rank: 0,
    sockets: {
      ladderFace: { at: [0, 0.24, 0.17] },
      topCap: { at: [0, 3.36, 0] },
    },
  },
  'mod-upright-gusset': {
    source: {
      kind: 'param',
      gen: 'bracket',
      params: { width: 0.18, upright: 0.32, foot: 0.24, thickness: 0.02, gusset: 1 },
    },
    material: 'accent-hardware',
    slotMaterials: { steel: 'hull-steel', bolts: 'accent-hardware' },
    rank: 2,
  },
  'mod-upright-ladder': {
    source: {
      kind: 'param',
      gen: 'ladder',
      params: { width: 0.3, height: 2.8, stileSection: 0.03, rungStep: 0.28, standoff: 0.06, mode: 0 },
    },
    material: 'accent-hardware',
    slotMaterials: { stiles: 'hull-steel', rungs: 'accent-hardware', cage: 'hull-steel', bolts: 'accent-hardware' },
    rank: 2,
  },
  'mod-hopper-funnel': {
    source: {
      kind: 'param',
      gen: 'hopper',
      params: { topWidth: 1.16, topDepth: 1.16, bottomWidth: 0.68, bottomDepth: 0.68, height: 0.44, rimHeight: 0.08, wall: 0.05, shape: 0 },
    },
    material: MAT_PRESET_SKINS.khakiBody,
    slotMaterials: { body: MAT_PRESET_SKINS.khakiBody, trim: 'hull-steel', liner: 'accent-hardware', bolts: 'accent-hardware' },
    rank: 0,
    sockets: {
      chuteSide: { at: [0, 0.04, 0.34] },
      bracketL: { at: [-0.34, 0, 0], rot: [0, -90, 0] },
      bracketR: { at: [0.34, 0, 0], rot: [0, 90, 0] },
      rimClampF: { at: [0, 0.44, 0.54] },
      rimClampB: { at: [0, 0.44, -0.54] },
    },
  },
  'mod-feed-chute': {
    source: {
      kind: 'param',
      gen: 'chute',
      params: { width: 0.56, length: 0.48, drop: 0.16, cheekHeight: 0.12, wall: 0.024 },
    },
    material: 'hull-steel',
    slotMaterials: { trough: 'hull-steel', cheeks: 'accent-hardware', bolts: 'accent-hardware' },
    rank: 1,
  },
  'mod-power-junction': {
    source: {
      kind: 'param',
      gen: 'can',
      params: { width: 0.48, depth: 0.32, height: 0.38, bevel: 0.02, baseBand: 0.06, bands: 1 },
    },
    material: 'accent-hardware',
    slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'hull-steel' },
    rank: 1,
    sockets: {
      elbowOut: { at: [0.14, 0.38, 0] },
      conduitRun: { at: [0, 0, -0.16] },
      lampFront: { at: [0, 0.14, 0.16] },
      boltL: { at: [-0.18, 0.38, 0] },
      boltR: { at: [0.18, 0.38, 0] },
    },
  },
  'mod-power-elbow': {
    source: {
      kind: 'param',
      gen: 'pipe',
      params: { radius: 0.055, length: 0.28, armLength: 0.24, elbow: 1, sides: 8, flangeWidth: 0.02 },
    },
    material: 'accent-hardware',
    slotMaterials: { pipe: 'accent-hardware', flange: 'hull-steel', bolts: 'accent-hardware' },
    rank: 1,
  },
  'mod-power-conduit': {
    source: {
      kind: 'param',
      gen: 'conduit',
      params: { length: 1.6, width: 0.08, height: 0.08, clips: 3, glandLength: 0.06 },
    },
    material: 'accent-hardware',
    slotMaterials: { cable: 'accent-hardware', clips: 'hull-steel', gland: 'accent-hardware', bolts: 'accent-hardware' },
    rank: 2,
  },
  'mod-cartridge-housing': {
    source: {
      kind: 'param',
      gen: 'can',
      params: { width: 0.18, depth: 0.54, height: 0.38, bevel: 0.015, baseBand: 0.05, bands: 1 },
    },
    material: 'hull-steel',
    slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
    rank: 1,
    sockets: {
      cartSlot: { at: [-0.08, 0.08, 0] },
      ejectorLever: { at: [0, 0.38, 0.16] },
      railTop: { at: [0, 0.38, -0.1] },
    },
  },
  'mod-smx-cartridge': {
    source: {
      kind: 'param',
      gen: 'can',
      params: { width: 0.24, depth: 0.34, height: 0.22, bevel: 0.015, baseBand: 0.04, bands: 2 },
    },
    material: 'accent-hardware',
    slotMaterials: { body: 'accent-hardware', trim: 'hull-steel', band: 'accent-hardware' },
    rank: 1,
  },
  'mod-ejector-lever': {
    source: {
      kind: 'param',
      gen: 'handle',
      params: { span: 0.16, reach: 0.12, thickness: 0.02, gripWidth: 0.12, mode: 1 },
    },
    material: 'accent-hardware',
    slotMaterials: { mount: 'hull-steel', shaft: 'accent-hardware', grip: 'hull-steel', bolts: 'accent-hardware' },
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
      { ref: 'mod-door-hinge', key: 'hinge-bot', on: { child: 0, socket: 'hingeBot' } },
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
 * Built from `@hm/partgen` parts on sockets:
 *  - a grounded skid (`can`);
 *  - a bevelled `panel` with a bolt row;
 *  - a square-section `beam` column (`0.52 m` on the `0.08 m` skid = `0.60 m` total height);
 *  - a gusseted `bracket`;
 *  - a short `can` housing.
 * Gives every `@hm/matstack` mask input something real to land on: sharp convex edges,
 * concave crevices, tops, undersides, and the 0..0.60 m splash zone.
 */
import type { Kit } from '@hm/kitspec';

export const MATSTACK_TEST_PIECE_KIT: Kit = Object.freeze({
  parts: {
    'tp-skid': {
      source: {
        kind: 'param',
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
        kind: 'param',
        gen: 'panel',
        params: { width: 0.34, depth: 0.4, thickness: 0.045, bevel: 0.018, seam: 0.03, boltsPerSide: 3, boltHead: 0.024 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { plate: MAT_PRESET_SKINS.khakiBody, bolts: MAT_PRESET_SKINS.brushedTrim },
      rank: 0,
    },
    'tp-square-beam': {
      source: {
        kind: 'param',
        gen: 'beam',
        params: { length: 0.52, section: 0.12, wall: 0.012 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { steel: MAT_PRESET_SKINS.khakiBody, caps: MAT_PRESET_SKINS.brushedTrim },
      rank: 0,
    },
    'tp-bracket': {
      source: {
        kind: 'param',
        gen: 'bracket',
        params: { width: 0.12, height: 0.22, depth: 0.18, thickness: 0.02, webThickness: 0.016, bolts: 2 },
      },
      material: MAT_PRESET_SKINS.khakiBody,
      slotMaterials: { steel: MAT_PRESET_SKINS.khakiBody, bolts: MAT_PRESET_SKINS.brushedTrim },
      rank: 1,
    },
    'tp-short-can': {
      source: {
        kind: 'param',
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
});
