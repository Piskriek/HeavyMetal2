/**
 * The industrial foundation frame (TASK-26; sheet 13; plan 13, P0-LAYOUT-01). It replaces the red prototype slab.
 *
 *  - The deck: gunmetal square box-section beams round a 4 m cell, a grated deck plate (grate slats from stage 2), a hazard-striped
 *    rim on top of the beams, and a telescoping collar under each corner.
 *  - The legs: one square-section shaft per corner that needs one (foundation-legs.ts plans them), standing on the ground under the
 *    corner. A foot pad in the hazard stripe sits on the ground.
 *
 * The deck is in the cell's own frame (0..4 m: the kit's pivot centres it, as for every kit piece). The legs and pads are unit parts
 * that the batcher places once per leg, so the whole base draws them in one batch per kind, not one mesh per leg.
 */
import * as THREE from 'three';
import { FRAME_CELL_M, FRAME_CORNER_INSET_M, FRAME_DECK_DEPTH_M } from './foundation-legs';

/** The beam's width (square section), metres. */
const BEAM_W = 0.24;
/** The collar's half-width and its depth below the deck's underside, metres. */
const COLLAR_HALF = 0.13;
const COLLAR_DROP = 0.12;
/** A leg's half-width (square section), metres. */
const LEG_HALF = 0.1;
/** The foot pad: a square of PAD_SIDE, PAD_H thick. */
const PAD_SIDE = 0.36;
const PAD_H = 0.08;

export interface FrameMaterials {
  readonly beam: THREE.MeshStandardMaterial;
  readonly grate: THREE.MeshStandardMaterial;
  readonly collar: THREE.MeshStandardMaterial;
  readonly leg: THREE.MeshStandardMaterial;
}

let frameMats: FrameMaterials | null = null;

/** The frame's gunmetal (the sheet's colours: frame #262c36, grate #343c48). Metalness stays low so it does not bake black in stage 0 and 1. */
export function frameMaterials(): FrameMaterials {
  if (frameMats === null) {
    frameMats = {
      beam: new THREE.MeshStandardMaterial({ name: 'frame-gunmetal', color: 0x2a313d, metalness: 0.22, roughness: 0.65 }),
      grate: new THREE.MeshStandardMaterial({ name: 'frame-grate', color: 0x3b4454, metalness: 0.18, roughness: 0.72 }),
      collar: new THREE.MeshStandardMaterial({ name: 'frame-collar', color: 0x343c48, metalness: 0.2, roughness: 0.6 }),
      leg: new THREE.MeshStandardMaterial({ name: 'frame-leg', color: 0x2a313d, metalness: 0.22, roughness: 0.65 }),
    };
  }
  return frameMats;
}

function box(group: THREE.Group, mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  group.add(mesh);
}

/**
 * The deck frame for one foundation, in the cell's frame (x and z run 0..FRAME_CELL_M; the top of the deck is y = 0).
 * `hazard` is the striped material for the rim (the basekit hazard, as the other kit pieces use).
 */
export function foundationDeckGroup(stage: number, hazard: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = 'foundation-frame';
  const m = frameMaterials();
  const S = FRAME_CELL_M;
  const D = FRAME_DECK_DEPTH_M;
  const B = BEAM_W;

  // the square box-section perimeter
  box(g, m.beam, 0, -D, 0, S, 0, B);
  box(g, m.beam, 0, -D, S - B, S, 0, S);
  box(g, m.beam, 0, -D, B, B, 0, S - B);
  box(g, m.beam, S - B, -D, B, S, 0, S - B);

  // the grated deck, its slats from stage 2 (the grate reads as steel, not a flat plate)
  box(g, m.grate, B, -0.12, B, S - B, -0.06, S - B);
  if (stage >= 2) {
    for (let k = 1; k <= 4; k++) {
      const x = B + ((S - 2 * B) * k) / 5;
      box(g, m.beam, x - 0.025, -0.06, B, x + 0.025, -0.03, S - B);
    }
  }

  // the hazard-striped rim, on top of the beams
  const rim = 0.04;
  box(g, hazard, 0, 0, 0, S, rim, B);
  box(g, hazard, 0, 0, S - B, S, rim, S);
  box(g, hazard, 0, 0, B, B, rim, S - B);
  box(g, hazard, S - B, 0, B, S, rim, S - B);

  // a telescoping collar under each corner: the leg's sleeve, which the leg shaft runs up into
  const inset = FRAME_CORNER_INSET_M;
  for (const [cx, cz] of [
    [inset, inset],
    [S - inset, inset],
    [inset, S - inset],
    [S - inset, S - inset],
  ] as const) {
    box(g, m.collar, cx - COLLAR_HALF, -D - COLLAR_DROP, cz - COLLAR_HALF, cx + COLLAR_HALF, -D, cz + COLLAR_HALF);
  }
  return g;
}

/** A leg's unit shaft: one square section from y = 0 (the foot) to y = 1 (the top), so a matrix scales it to the leg's length. */
export function foundationLegGroup(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'foundation-leg';
  box(g, frameMaterials().leg, -LEG_HALF, 0, -LEG_HALF, LEG_HALF, 1, LEG_HALF);
  return g;
}

/** A leg's foot pad: the hazard square, from y = 0 to PAD_H, centred on the leg. */
export function foundationPadGroup(hazard: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = 'foundation-pad';
  box(g, hazard, -PAD_SIDE / 2, 0, -PAD_SIDE / 2, PAD_SIDE / 2, PAD_H, PAD_SIDE / 2);
  return g;
}

/** The pad's height, so a foot can sit the pad's middle on the ground. */
export const FRAME_PAD_HEIGHT_M = PAD_H;
