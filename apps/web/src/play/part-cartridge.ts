/**
 * Part cartridges in play (TICKET-32, plans 38 and 39; rulings in ARGO_NOTE_34): what a part costs to print, the bench's
 * one-click operator presets, applying a part's operators, and turning a printed part into a kit override for the
 * beam's Apply. Pure: no DOM, no clock.
 */
import type { PartSpec } from '@hm/cartlab';
import type { OpRef, PartOverride } from '@hm/kitspec';
import { MESH_OPERATORS } from '@hm/meshops';
import { GENERATORS, type MeshData } from '@hm/partgen';

/**
 * What a part cartridge costs, by generator (Argo's ruling, ARGO_NOTE_34 D.2): small fasteners, medium components and
 * primary solids. Paid in raw vertices and raw pixels.
 */
export const PART_COSTS: Readonly<Record<string, { readonly vtx: number; readonly pxd: number }>> = Object.freeze({
  bolt: { vtx: 5, pxd: 5 },
  bracket: { vtx: 5, pxd: 5 },
  panel: { vtx: 12, pxd: 10 },
  grille: { vtx: 12, pxd: 10 },
  duct: { vtx: 12, pxd: 10 },
  can: { vtx: 20, pxd: 15 },
  beam: { vtx: 20, pxd: 15 },
});

/** The items a print takes from the base's stores (the player, then the linked network). */
export function partBill(spec: Pick<PartSpec, 'gen'>): { readonly item: string; readonly n: number }[] {
  const c = PART_COSTS[spec.gen] ?? { vtx: 20, pxd: 15 };
  return [{ item: 'vtx-rough', n: c.vtx }, { item: 'pxd-mono', n: c.pxd }];
}

/** The bench's one-click operator presets (ARGO_NOTE_34 section 3: at most six on the in-game bench). */
export const BENCH_OPERATORS: readonly { readonly op: string; readonly label: string }[] = [
  { op: 'smooth-taubin', label: 'Smooth' },
  { op: 'chamfer-hard-edges', label: '45° chamfer' },
  { op: 'inset-outset-faces', label: 'Recessed seam' },
  { op: 'taper-flare', label: 'Taper' },
  { op: 'mirror-symmetry', label: 'Mirror X' },
  { op: 'surface-edge-wear-ao', label: 'Edge wear' },
];

/**
 * A mesh with each operator applied in order, each at its one-click preset with the given values on top. Unknown ops are
 * skipped. A mirror with no plane of its own copies the part flush against its own far face: the preset's 0.5 m plane
 * fits a machine, but would throw a bolt's copy half a metre away.
 */
export function applyOps(md: MeshData, ops: readonly OpRef[] | undefined): MeshData {
  let out = md;
  for (const o of ops ?? []) {
    const op = MESH_OPERATORS[o.op];
    if (!op) continue;
    const params: Record<string, number> = { ...op.oneClickPreset, ...o.params };
    if (o.op === 'mirror-symmetry' && o.params.planeOffset === undefined) {
      // the operator rounds its plane to 5 cm steps, so the part is moved to put its far face on the plane at 0 instead
      const axis = Math.max(0, Math.min(2, Math.round(params.axis ?? 0))) as 0 | 1 | 2;
      const face = out.max[axis];
      out = shift(op.apply(shift(out, axis, -face), { ...params, planeOffset: 0 }), axis, face);
    } else {
      out = op.apply(out, params);
    }
  }
  return out;
}

/** The mesh moved by `d` metres along one axis (its bounds with it). */
function shift(md: MeshData, axis: 0 | 1 | 2, d: number): MeshData {
  if (d === 0) return md;
  const positions = new Float32Array(md.positions);
  for (let i = axis; i < positions.length; i += 3) positions[i] = positions[i]! + d;
  const min = [...md.min] as [number, number, number], max = [...md.max] as [number, number, number];
  min[axis] += d;
  max[axis] += d;
  return { ...md, positions, min, max };
}

/** A plain name for a printed part: its generator and its materials ("Bolt, green"). */
export function partName(spec: Pick<PartSpec, 'gen' | 'slotMaterials'>, materialName: (id: string) => string): string {
  const label = GENERATORS[spec.gen]?.label ?? spec.gen;
  const mats = [...new Set(Object.values(spec.slotMaterials))].map(materialName);
  return mats.length > 0 ? `${label}, ${mats.join(' and ').toLowerCase()}` : label;
}

/** The override a part cartridge writes onto a placed param part: its generator, sliders, operators and materials. */
export function overrideFromPart(spec: PartSpec): PartOverride {
  const first = Object.values(spec.slotMaterials)[0];
  return {
    gen: spec.gen,
    params: spec.params,
    ops: spec.ops,
    slotMaterials: spec.slotMaterials,
    ...(first ? { material: first } : {}),
  };
}
