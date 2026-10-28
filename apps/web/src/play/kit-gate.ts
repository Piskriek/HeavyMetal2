/**
 * The Quantum Archway Gate as a modular kit (Plan 42; PLAN-42-GATE).
 * A pure @hm/kitspec preset matching the lab gate's frame (~2.68 m plinth, 1.7 m x 2.6 m
 * opening, 3.2 m tall) so Beam Rifle cartridges customize it like any other kit:
 * - `mat:` / `matc:` layered materials dress its box parts (pillars, lintel, plinth).
 * - `lx:` light cartridges set its six field-coil lamps (unique Kelvin per coil so the six
 *   stay separate meshes for the bottom-to-top ignition sweep).
 * - `part:` cartridges swap its param anchor bolts (bolt generator, like-for-like).
 *
 * Frame: the gate's base centre, y up, opening along x, front toward +z (as labkit gate).
 * Ranks: 0 plinth/sill/uprights/lintel, 1 rims/emitters/coils/mounts/cap, 2 anchor bolts.
 */
import type { Kit } from '@hm/kitspec';

const PLINTH = { w: 2.68, h: 0.15, d: 1.1 } as const;
const OPEN_W = 1.7;
const SILL_STEP_H = 0.04;
const UPRIGHT = { w: 0.45, h: 2.64, d: 0.6 } as const;
const UPRIGHT_X = OPEN_W / 2 + UPRIGHT.w / 2; // 1.075
const UPRIGHT_BASE_Y = PLINTH.h; // 0.15
const LINTEL = { w: 2.6, h: 0.41, d: 0.64 } as const;
const LINTEL_BASE_Y = UPRIGHT_BASE_Y + UPRIGHT.h; // 2.79
const COIL = { w: 0.32, h: 0.46, d: 0.18 } as const;
const COIL_Z = UPRIGHT.d / 2 + COIL.d / 2; // 0.39 (front faces)
const COIL_MOUNT_D = 0.04;
const COIL_MOUNT_Z = UPRIGHT.d / 2 + COIL_MOUNT_D / 2; // 0.32
// Coil centre heights (labkit gate: sill 0.19 + spans 0.85/1.48/2.11), bottom pair first.
const COIL_CENTRE_Y = [1.04, 1.04, 1.67, 1.67, 2.3, 2.3] as const;
const COIL_X = [-UPRIGHT_X, UPRIGHT_X, -UPRIGHT_X, UPRIGHT_X, -UPRIGHT_X, UPRIGHT_X] as const;
// Unique steady-amber lamps per coil (1 K steps are visually identical but keep 6 meshes).
const COIL_MATERIALS = [
  'lx:2000:1.20:steady',
  'lx:2001:1.20:steady',
  'lx:2002:1.20:steady',
  'lx:2003:1.20:steady',
  'lx:2004:1.20:steady',
  'lx:2005:1.20:steady',
] as const;

export const GATE_KIT: Kit = {
  parts: {
    // its Triad sockets (plan 57 §14.2): it seats on a dais's gateMount by its plinth's underside, its cable comes in at the
    // plinth's back, and what it puts out is the portal at its sill
    plinth: {
      source: { kind: 'box', size: [PLINTH.w, PLINTH.h, PLINTH.d] }, material: 'darkSteel', rank: 0,
      sockets: { daisMount: { at: [0, 0, 0], rot: [180, 0, 0] }, powerCable: { at: [0, PLINTH.h / 2, -PLINTH.d / 2], rot: [-90, 0, 0] } },
    },
    'hazard-rim': { source: { kind: 'box', size: [PLINTH.w - 0.04, PLINTH.h * 0.7, 0.02] }, material: 'hazard', rank: 1 },
    'sill-step': { source: { kind: 'box', size: [OPEN_W + 0.1, SILL_STEP_H, 0.45] }, material: 'gunmetal', rank: 0, sockets: { portal: { at: [0, SILL_STEP_H, 0] } } },
    upright: { source: { kind: 'box', size: [UPRIGHT.w, UPRIGHT.h, UPRIGHT.d] }, material: 'gunmetal', rank: 0 },
    emitter: { source: { kind: 'box', size: [0.06, 2.6, 0.2] }, material: 'darkSteel', rank: 1 },
    lintel: { source: { kind: 'box', size: [LINTEL.w, LINTEL.h, LINTEL.d] }, material: 'gunmetal', rank: 0 },
    'top-cap': { source: { kind: 'box', size: [LINTEL.w - 0.2, 0.05, LINTEL.d - 0.1] }, material: 'darkSteel', rank: 1 },
    'coil-mount': { source: { kind: 'box', size: [COIL.w + 0.04, COIL.h + 0.04, COIL_MOUNT_D] }, material: 'darkSteel', rank: 1 },
    coil0: { source: { kind: 'box', size: [COIL.w, COIL.h, COIL.d] }, material: COIL_MATERIALS[0], rank: 1 },
    coil1: { source: { kind: 'box', size: [COIL.w, COIL.h, COIL.d] }, material: COIL_MATERIALS[1], rank: 1 },
    coil2: { source: { kind: 'box', size: [COIL.w, COIL.h, COIL.d] }, material: COIL_MATERIALS[2], rank: 1 },
    coil3: { source: { kind: 'box', size: [COIL.w, COIL.h, COIL.d] }, material: COIL_MATERIALS[3], rank: 1 },
    coil4: { source: { kind: 'box', size: [COIL.w, COIL.h, COIL.d] }, material: COIL_MATERIALS[4], rank: 1 },
    coil5: { source: { kind: 'box', size: [COIL.w, COIL.h, COIL.d] }, material: COIL_MATERIALS[5], rank: 1 },
    'anchor-bolt': {
      source: { kind: 'param', gen: 'bolt', params: { headWidth: 0.04, headHeight: 0.02, shankLength: 0 } },
      material: 'gunmetal',
      rank: 2,
    },
  },
  assemblies: {
    gate: {
      children: [
        { ref: 'plinth', key: 'plinth' },
        { ref: 'hazard-rim', key: 'rim-front', at: [0, (PLINTH.h - PLINTH.h * 0.7) / 2, PLINTH.d / 2] },
        { ref: 'hazard-rim', key: 'rim-back', at: [0, (PLINTH.h - PLINTH.h * 0.7) / 2, -PLINTH.d / 2] },
        { ref: 'sill-step', key: 'sill', at: [0, PLINTH.h, 0] },
        { ref: 'upright', key: 'uprights', at: [-UPRIGHT_X, UPRIGHT_BASE_Y, 0], repeat: { count: 2, step: [UPRIGHT_X * 2, 0, 0] } },
        { ref: 'emitter', key: 'emitter-left', at: [-(OPEN_W / 2 + 0.03), 0.19, 0] },
        { ref: 'emitter', key: 'emitter-right', at: [OPEN_W / 2 + 0.03, 0.19, 0] },
        { ref: 'lintel', key: 'lintel', at: [0, LINTEL_BASE_Y, 0] },
        { ref: 'top-cap', key: 'cap', at: [0, LINTEL_BASE_Y + LINTEL.h, 0] },
        // Coil mounts (dark steel plates behind each coil) then the six lamps, bottom pair first.
        ...([0, 1, 2, 3, 4, 5] as const).map((i) => ({
          ref: 'coil-mount',
          key: `mount${i}`,
          at: [COIL_X[i], COIL_CENTRE_Y[i] - (COIL.h + 0.04) / 2, COIL_MOUNT_Z] as readonly [number, number, number],
        })),
        ...([0, 1, 2, 3, 4, 5] as const).map((i) => ({
          ref: `coil${i}`,
          key: `coil${i}`,
          at: [COIL_X[i], COIL_CENTRE_Y[i] - COIL.h / 2, COIL_Z] as readonly [number, number, number],
        })),
        // Anchor bolts into the plinth top (5 per row, front and back).
        { ref: 'anchor-bolt', key: 'bolts-front', at: [-1.2, PLINTH.h, -0.46], repeat: { count: 5, step: [0.6, 0, 0] } },
        { ref: 'anchor-bolt', key: 'bolts-back', at: [-1.2, PLINTH.h, 0.46], repeat: { count: 5, step: [0.6, 0, 0] } },
      ],
    },
  },
};
