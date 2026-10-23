/**
 * The Shape Press outer frame refitted to the measured `press-frame` GLB raycast profile (TICKET-39b, OPUS_NOTE_36).
 *
 * Measured `press-frame` core profile (raycast every 0.25 m):
 *  - BBox: x in [-2.00, 2.00], y in [0, 4.00], z in [-1.92, 1.92].
 *  - Plinth (y < 0.15): x in [-2.00, 2.00], z in [-1.92, 1.92] (top surface at y = 0.15).
 *  - Bed (y = 0.30..0.55): x in [-1.16, 1.16], z in [-0.74, 0.74].
 *  - Die gap (y = 1.05..1.30): open.
 *  - Side cheeks (y = 1.55..1.80): x in [-1.16, 1.16], z in [-0.46, 0.46] (above 2.05 only +x cheek x = 1.00..1.17).
 *  - Crown (y = 3.05): x in [-1.16, 1.16], z in [-0.74, 0.74].
 *  - Top block (y = 3.30): x in [-0.30, 0.30], z in [-0.83, 0.83].
 *
 * Refit placement:
 *  - Plinth-mounted parts sit on `y = 0.15` outside the bed/cheeks:
 *    - 2 mirrored outer uprights at `(+-1.62, 0.15, 0)` (x in +-1.42..1.82, z in -0.94..0.94, clear of +-1.17 cheeks/bed/crown)
 *    - Upright gusset brackets at `(+-1.62, 0.15, 0.94)`
 *    - Plinth bolts at `(+-1.62, 0.15, -1.55..1.45)`
 *    - Power box at `(0, 0.15, 0.88)` (z in 0.76..1.00, outside +0.74 bed, right at power socket `[0, 0.2, 0.8]`)
 *    - Rear hydraulic duct at `(0, 0.15, -1.25)` (outside -0.74 bed)
 *  - Frame-mounted parts: front and back crown gantry beams across the uprights at `y = 3.60..3.78, z = +-0.92`
 *    (framing `topBlock` at `z = +-0.83` without penetrating the top block or chute!), and outer upright panels at `x = +-1.82`.
 *  - Core-face-mounted parts sit flush on measured faces:
 *    - `hazard-front` on bed `+z = 0.74` at `(0, 0.36, 0.765)` (z in `0.74..0.79`)
 *    - `cheek-left` / `cheek-right` on side cheeks `x = +-1.16` at `(+-1.16, 1.675, 0)`
 *    - `crown-fascia` on crown `+z = 0.74` at `(0, 3.02, 0.74)` (`rot: [90, 0, 0]`, z in `0.74..0.78`)
 *    - `vent-box` on top block `-z = -0.83` at `(0, 3.22, -0.91)` (z in `-0.99..-0.83`, y in `3.22..3.56`)
 */
import type { Kit } from '@hm/kitspec';

export const PRESS_CORE_BOUNDS = {
  min: [-2.0, 0, -1.92],
  max: [2.0, 4.0, 1.92],
} as const;

const PLINTH_Y = 0.15;
const UPRIGHT_X = 1.62;
const UPRIGHT_H = 3.45;
const GANTRY_Y = PLINTH_Y + UPRIGHT_H; // 3.60 m

export const PRESS_FRAME_KIT: Kit = {
  parts: {
    'press-core': {
      source: { kind: 'gen', asset: 'press-frame', bounds: PRESS_CORE_BOUNDS },
      material: 'hull-steel',
      rank: 0,
      sockets: {
        uprightLeft: { at: [-UPRIGHT_X, PLINTH_Y, 0] },
        uprightRight: { at: [UPRIGHT_X, PLINTH_Y, 0] },
        crownFrontGantry: { at: [0, GANTRY_Y, 0.92] },
        crownBackGantry: { at: [0, GANTRY_Y, -0.92] },
        bedFrontFace: { at: [0, 0.36, 0.765] },
        cheekLeftFace: { at: [-1.16, 1.675, 0], rot: [0, 0, 90] },
        cheekRightFace: { at: [1.16, 1.675, 0], rot: [0, 0, -90] },
        crownFrontFace: { at: [0, 3.02, 0.74], rot: [90, 0, 0] },
        topBlockRearFace: { at: [0, 3.22, -0.91] },
        plinthPowerFront: { at: [0, PLINTH_Y, 0.88] },
        plinthRearDuct: { at: [0, PLINTH_Y, -1.25] },
        gussetLeft: { at: [-UPRIGHT_X, PLINTH_Y, 0.94] },
        gussetRight: { at: [UPRIGHT_X, PLINTH_Y, 0.94] },
        boltsLeft: { at: [-1.88, PLINTH_Y, -1.35] },
        boltsRight: { at: [1.88, PLINTH_Y, -1.35] },
      },
    },
    'press-upright': {
      source: {
        kind: 'param',
        gen: 'can',
        params: { width: 0.4, depth: 1.88, height: UPRIGHT_H, bevel: 0.025, baseBand: 0.14, bands: 2 },
      },
      material: 'hull-steel',
      slotMaterials: { body: 'hull-steel', trim: 'hull-steel', band: 'accent-hardware' },
      rank: 0,
      sockets: {
        outerPanel: { at: [0.2, 1.72, 0], rot: [0, 0, -90] },
      },
    },
    'press-crown-beam': {
      source: { kind: 'param', gen: 'beam', params: { length: 3.64, section: 0.18, wall: 0.02 } },
      material: 'hull-steel',
      rank: 0,
    },
    'press-side-panel': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 2.2, depth: 0.56, thickness: 0.04, bevel: 0.008, seam: 0.02, boltsPerSide: 4, boltHead: 0.02 },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'press-cheek-guard': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 0.25, depth: 0.52, thickness: 0.04, bevel: 0.006, seam: 0.015, boltsPerSide: 2, boltHead: 0.018 },
      },
      material: 'accent-hardware',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'press-crown-fascia': {
      source: {
        kind: 'param',
        gen: 'panel',
        params: { width: 1.36, depth: 0.2, thickness: 0.04, bevel: 0.008, seam: 0.02, boltsPerSide: 3, boltHead: 0.02 },
      },
      material: 'hull-steel',
      slotMaterials: { plate: 'hull-steel', bolts: 'accent-hardware' },
      rank: 1,
    },
    'press-vent-box': {
      source: { kind: 'box', size: [0.56, 0.34, 0.16] },
      material: 'hull-steel',
      rank: 1,
      sockets: {
        grilleBack: { at: [0, 0.03, -0.08], rot: [0, 180, 0] },
      },
    },
    'press-hazard-strip': {
      source: { kind: 'box', size: [1.4, 0.14, 0.05] },
      material: 'hull-steel',
      rank: 1,
    },
    'press-power-box': {
      source: { kind: 'box', size: [0.42, 0.24, 0.24] },
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
        params: { width: 0.48, height: 0.28, depth: 0.04, frame: 0.03, slats: 5, slat: 0.01 },
      },
      material: 'accent-hardware',
      slotMaterials: { frame: 'hull-steel', slats: 'accent-hardware' },
      rank: 2,
    },
    'press-hydraulic-duct': {
      source: {
        kind: 'param',
        gen: 'duct',
        params: { length: 2.84, section: 0.15, wall: 0.01, flange: 0.028 },
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
        { ref: 'press-upright', key: 'upright-left', on: { child: 0, socket: 'uprightLeft' }, mirror: 'x' },
        { ref: 'press-upright', key: 'upright-right', on: { child: 0, socket: 'uprightRight' } },
        { ref: 'press-crown-beam', key: 'crown-front', on: { child: 0, socket: 'crownFrontGantry' } },
        { ref: 'press-crown-beam', key: 'crown-back', on: { child: 0, socket: 'crownBackGantry' } },
        { ref: 'press-side-panel', key: 'panel-left', on: { child: 1, socket: 'outerPanel' } },
        { ref: 'press-side-panel', key: 'panel-right', on: { child: 2, socket: 'outerPanel' } },
        { ref: 'press-cheek-guard', key: 'cheek-left', on: { child: 0, socket: 'cheekLeftFace' } },
        { ref: 'press-cheek-guard', key: 'cheek-right', on: { child: 0, socket: 'cheekRightFace' } },
        { ref: 'press-crown-fascia', key: 'crown-fascia', on: { child: 0, socket: 'crownFrontFace' } },
        { ref: 'press-vent-box', key: 'vent-box', on: { child: 0, socket: 'topBlockRearFace' } },
        { ref: 'press-hazard-strip', key: 'hazard-front', on: { child: 0, socket: 'bedFrontFace' } },
        { ref: 'press-power-box', key: 'power-box', on: { child: 0, socket: 'plinthPowerFront' } },
        { ref: 'press-gusset-bracket', key: 'gusset-left', on: { child: 0, socket: 'gussetLeft' }, mirror: 'x' },
        { ref: 'press-gusset-bracket', key: 'gusset-right', on: { child: 0, socket: 'gussetRight' } },
        {
          ref: 'press-skid-bolt',
          key: 'bolts-left',
          on: { child: 0, socket: 'boltsLeft' },
          repeat: { count: 4, step: [0, 0, 0.9] },
        },
        {
          ref: 'press-skid-bolt',
          key: 'bolts-right',
          on: { child: 0, socket: 'boltsRight' },
          repeat: { count: 4, step: [0, 0, 0.9] },
        },
        { ref: 'press-vent-grille', key: 'vent-grille', on: { child: 10, socket: 'grilleBack' } },
        { ref: 'press-hydraulic-duct', key: 'rear-duct', on: { child: 0, socket: 'plinthRearDuct' } },
      ],
      sockets: {
        vent: { at: [0, 3.44, -0.56] },
        feed: { at: [0, 4.26, 0] },
        chute: { at: [0, 4.26, 0] },
        hopper: { at: [0, 4.26, 0] },
        power: { at: [0, 0.2, 0.8] },
        ramLeft: { at: [-0.55, 2.1, 0] },
        ramRight: { at: [0.55, 2.1, 0] },
      },
    },
  },
};
