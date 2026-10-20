/**
 * @hm/meshops: the Studio's deep editing operators (plan 39 section 4b; Argo's TICKET-33..38, ARGO_NOTE_34). Six families
 * of pure, deterministic operators on @hm/partgen MeshData, each a preset with a slider schema and a one-click preset,
 * plus the non-destructive stack evaluator.
 */
export * from './types';
export * from './smooth-subdiv';
export * from './hardsurface-cad';
export * from './cleanup-remesh';
export * from './deformers';
export * from './symmetry-cloner';
export * from './uv-wear-stack';

import type { MeshOperator } from './types';
import { FAMILY1_SMOOTH_SUBDIV_OPERATORS } from './smooth-subdiv';
import { FAMILY2_HARDSURFACE_CAD_OPERATORS } from './hardsurface-cad';
import { FAMILY3_CLEANUP_REMESH_OPERATORS } from './cleanup-remesh';
import { FAMILY4_DEFORMER_OPERATORS } from './deformers';
import { FAMILY5_SYMMETRY_CLONER_OPERATORS } from './symmetry-cloner';
import { FAMILY6_UV_WEAR_STACK_OPERATORS } from './uv-wear-stack';

/** Every operator by id, across the six families. */
export const MESH_OPERATORS: Readonly<Record<string, MeshOperator>> = Object.freeze({
  ...FAMILY1_SMOOTH_SUBDIV_OPERATORS,
  ...FAMILY2_HARDSURFACE_CAD_OPERATORS,
  ...FAMILY3_CLEANUP_REMESH_OPERATORS,
  ...FAMILY4_DEFORMER_OPERATORS,
  ...FAMILY5_SYMMETRY_CLONER_OPERATORS,
  ...FAMILY6_UV_WEAR_STACK_OPERATORS,
});
