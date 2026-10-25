/**
 * The Shape Press outer frame around its heavygear / generated core (TICKET-39, ARGO_NOTE_34 §4a/4b).
 *
 * The `press-core` (`gen` asset `'press-frame'`) provides the central die bed and twin-ram core;
 * the outer frame parts sit on its sockets:
 *  - Rank 0: Core frame, grounded base skid, mirrored side columns, top crown beam, and top crystal chute collar.
 *  - Rank 1: Twin ram guide sleeves, rear vent box at `[0, 3.44, -0.56]`, side safety panels, and front hazard band.
 *  - Rank 2: Column base gusset brackets, skid anchor bolts, rear louvered vent grille, and hydraulic return duct.
 *
 * Preserves exact `machine-props.ts` and `heavygear.heavyPress` sockets:
 *  - `vent`: `[0, 3.44, -0.56]`
 *  - `feed` / `chute` / `hopper`: `[0, 4.26, 0]`
 *  - `power`: `[0, 0.2, 0.8]`
 *  - `ramLeft`: `[-0.55, 2.1, 0]`, `ramRight`: `[0.55, 2.1, 0]`
 *
 * The two ram sockets carry the stroke itself (`motion`, plan 43): whatever a builder bolts on them — the generated press
 * ram, a part cartridge's replacement — strikes the `ram-heavy` beat, and the frame has no sine wave of its own.
 */
import type { Kit } from '@hm/kitspec';
import { HEAVY_PRESS_RAM_STROKE, HEAVY_PRESS_RAM_STROKE_B } from './kit-motion-specs';

export const PRESS_CORE_BOUNDS = {
  min: [-1.45, 0, -1.25],
  max: [1.45, 3.86, 1.25],
} as const;

export const PRESS_FRAME_KIT: Kit = {
  parts: {
    'press-core': {
      source: { kind: 'gen', asset: 'press-frame', bounds: PRESS_CORE_BOUNDS },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        skidBase: { at: [0, 0, 0] },
        colLeft: { at: [-1.52, 0.18, 0] },
        colRight: { at: [1.52, 0.18, 0] },
        crownTop: { at: [0, 3.62, 0] },
        chuteTop: { at: [0, 3.6, 0] },
        ramSleeveLeft: { at: [-0.55, 2.1, 0] },
        ramSleeveRight: { at: [0.55, 2.1, 0] },
        rearVent: { at: [0, 3.22, -0.56] },
        frontHazard: { at: [0, 0.62, 1.25] },
        powerGland: { at: [0, 0.18, 0.8] },
        rearDuct: { at: [0, 0.18, -1.18] },
      },
    },
    'press-skid': {
      source: { kind: 'box', size: [3.96, 0.18, 3.68] },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        boltLeft: { at: [-1.8, 0.18, -1.35] },
        boltRight: { at: [1.8, 0.18, -1.35] },
        gussetLeft: { at: [-1.52, 0.18, 0.42] },
        gussetRight: { at: [1.52, 0.18, 0.42] },
      },
    },
    'press-upright': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.42, depth: 0.76, height: 3.46, bevel: 0.025, baseBand: 0.14, bands: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        sidePanel: { at: [0.21, 0.45, 0] },
      },
    },
    'press-crown-beam': {
      source: { kind: 'param', gen: 'beam', params: { length: 3.68, section: 0.36, wall: 0.024 } },
      material: 'hull-steel',
      rank: 0,
    },
    'press-chute-collar': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.84, depth: 0.84, height: 0.4, bevel: 0.02, baseBand: 0.08, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'hull-steel', trim: 'accent-hardware', band: 'accent-hardware' },
      rank: 0,
    },
    'press-ram-guide': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.52, depth: 0.52, height: 1.56, bevel: 0.02, baseBand: 0.1, bands: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { body: 'accent-hardware', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 1,
    },
    'press-vent-box': {
      source: { kind: 'box', size: [1.24, 0.44, 0.36] },
      material: 'hull-steel',
      rank: 1,
      sockets: {
        grilleBack: { at: [0, 0.04, -0.18], rot: [0, 180, 0] },
      },
    },
    'press-side-panel': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.04, depth: 0.56, thickness: 2.4, bevel: 0.008, seam: 0.015, boltsPerSide: 4, boltHead: 0.02 },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'press-hazard-strip': {
      source: { kind: 'box', size: [1.6, 0.14, 0.04] },
      material: 'hull-steel',
      rank: 1,
    },
    'press-power-box': {
      source: { kind: 'box', size: [0.42, 0.24, 0.22] },
      material: 'accent-hardware',
      rank: 1,
    },
    'press-gusset-bracket': {
      source: {
        kind: 'param',
        gen: 'bracket',
        params: { width: 0.22, upright: 0.38, foot: 0.34, thickness: 0.02, gusset: 1 },
      },
      material: 'accent-hardware',
      slotMaterials: { steel: 'hull-steel', bolts: 'accent-hardware' },
      rank: 2,
    },
    'press-skid-bolt': {
      source: {
        kind: 'param',
        gen: 'bolt',
        params: { headWidth: 0.048, headHeight: 0.022, shankDia: 0.022, shankLength: 0, head: 1 },
      },
      material: 'accent-hardware',
      rank: 2,
    },
    'press-vent-grille': {
      source: {
        kind: 'param',
        gen: 'grille',
        params: { width: 1.12, height: 0.36, depth: 0.05, frame: 0.035, slats: 6, slat: 0.012 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 2,
    },
    'press-hydraulic-duct': {
      source: {
        kind: 'param',
        gen: 'duct',
        params: { length: 2.6, section: 0.15, wall: 0.01, flange: 0.028 },
      },
      material: 'accent-hardware',
      slotMaterials: { duct: 'hull-steel', flange: 'accent-hardware', bolts: 'accent-hardware' },
      rank: 2,
    },
  },
  assemblies: {
    'press-frame': {
      children: [
        { ref: 'press-core', key: 'core' },
        { ref: 'press-skid', key: 'skid', on: { child: 0, socket: 'skidBase' } },
        { ref: 'press-upright', key: 'upright-left', on: { child: 0, socket: 'colLeft' }, mirror: 'x' },
        { ref: 'press-upright', key: 'upright-right', on: { child: 0, socket: 'colRight' } },
        { ref: 'press-crown-beam', key: 'crown', on: { child: 0, socket: 'crownTop' } },
        { ref: 'press-chute-collar', key: 'chute-collar', on: { child: 0, socket: 'chuteTop' } },
        { ref: 'press-ram-guide', key: 'ram-left', on: { child: 0, socket: 'ramSleeveLeft' }, mirror: 'x' },
        { ref: 'press-ram-guide', key: 'ram-right', on: { child: 0, socket: 'ramSleeveRight' } },
        { ref: 'press-vent-box', key: 'vent-box', on: { child: 0, socket: 'rearVent' } },
        { ref: 'press-side-panel', key: 'panel-left', on: { child: 2, socket: 'sidePanel' } },
        { ref: 'press-side-panel', key: 'panel-right', on: { child: 3, socket: 'sidePanel' } },
        { ref: 'press-hazard-strip', key: 'hazard-front', on: { child: 0, socket: 'frontHazard' } },
        { ref: 'press-power-box', key: 'power-box', on: { child: 0, socket: 'powerGland' } },
        { ref: 'press-gusset-bracket', key: 'gusset-left', on: { child: 1, socket: 'gussetLeft' }, mirror: 'x' },
        { ref: 'press-gusset-bracket', key: 'gusset-right', on: { child: 1, socket: 'gussetRight' } },
        {
          ref: 'press-skid-bolt',
          key: 'bolts-left',
          on: { child: 1, socket: 'boltLeft' },
          repeat: { count: 4, step: [0, 0, 0.9] },
        },
        {
          ref: 'press-skid-bolt',
          key: 'bolts-right',
          on: { child: 1, socket: 'boltRight' },
          repeat: { count: 4, step: [0, 0, 0.9] },
        },
        { ref: 'press-vent-grille', key: 'vent-grille', on: { child: 8, socket: 'grilleBack' } },
        { ref: 'press-hydraulic-duct', key: 'rear-duct', on: { child: 0, socket: 'rearDuct' } },
      ],
      sockets: {
        vent: { at: [0, 3.44, -0.56] },
        feed: { at: [0, 4.26, 0] },
        chute: { at: [0, 4.26, 0] },
        hopper: { at: [0, 4.26, 0] },
        power: { at: [0, 0.2, 0.8] },
        ramLeft: { at: [-0.55, 2.1, 0], motion: HEAVY_PRESS_RAM_STROKE },
        ramRight: { at: [0.55, 2.1, 0], motion: HEAVY_PRESS_RAM_STROKE_B },
      },
    },
  },
};
