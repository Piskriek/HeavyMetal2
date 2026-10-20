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

import type { ParamSpec } from '@hm/partgen';

/** Slider keys that really are lengths in metres; the families mark every number 'm', so the rest are fixed up below. */
const LENGTH_KEYS = new Set([
  'width', 'inset', 'depth', 'distance', 'thickness', 'offset', 'extension', 'radius', 'stepX', 'stepY', 'stepZ',
  'spacingX', 'spacingZ', 'planeOffset', 'edgeWearWidth', 'baseDirtHeight',
]);

/** An operator's slider units as people read them: degrees for '...Deg' keys, metres for lengths, a factor for the rest. */
function withUnits(op: MeshOperator): MeshOperator {
  const fix = (p: ParamSpec): ParamSpec => {
    if (p.unit !== 'm') return p;
    if (p.key.endsWith('Deg')) return { ...p, unit: 'deg' };
    return LENGTH_KEYS.has(p.key) ? p : { ...p, unit: 'factor' };
  };
  return Object.freeze({ ...op, params: op.params.map(fix), apply: op.apply.bind(op) });
}

/** Every operator by id, across the six families. */
export const MESH_OPERATORS: Readonly<Record<string, MeshOperator>> = Object.freeze(
  Object.fromEntries(
    Object.entries({
      ...FAMILY1_SMOOTH_SUBDIV_OPERATORS,
      ...FAMILY2_HARDSURFACE_CAD_OPERATORS,
      ...FAMILY3_CLEANUP_REMESH_OPERATORS,
      ...FAMILY4_DEFORMER_OPERATORS,
      ...FAMILY5_SYMMETRY_CLONER_OPERATORS,
      ...FAMILY6_UV_WEAR_STACK_OPERATORS,
    }).map(([id, op]) => [id, withUnits(op)]),
  ),
);

/** The families in display order, with a plain name each (the Studio's Add menu groups by these). */
export const OPERATOR_FAMILIES: readonly { readonly id: MeshOperator['family']; readonly label: string }[] = [
  { id: 'smooth-subdiv', label: 'Smooth and subdivide' },
  { id: 'hardsurface-cad', label: 'Hard surface' },
  { id: 'cleanup-remesh', label: 'Clean up' },
  { id: 'deformers', label: 'Deform' },
  { id: 'symmetry-cloner', label: 'Mirror and repeat' },
  { id: 'uv-wear-stack', label: 'UV and wear' },
];
