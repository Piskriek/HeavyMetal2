/**
 * @hm/meshops shared types (plan 39 section 4b): a mesh operator is a preset with a slider schema that turns one
 * MeshData into another, deterministically. The Studio stacks them non-destructively; the Drafting Table shows a few
 * as one-click presets. Families from Argo's TICKET-33..38 (ARGO_NOTE_34).
 */
import type { MeshData, ParamSpec, Params } from '@hm/partgen';

export type OperatorFamilyId =
  | 'smooth-subdiv'
  | 'hardsurface-cad'
  | 'cleanup-remesh'
  | 'deformers'
  | 'symmetry-cloner'
  | 'uv-wear-stack';

export interface MeshOperator {
  readonly id: string;
  readonly family: OperatorFamilyId;
  readonly label: string;
  /** The label of its one-click preset button (e.g. "Smooth (Volume-Safe)"). */
  readonly oneClickPresetLabel: string;
  readonly description: string;
  readonly params: readonly ParamSpec[];
  /** The values its one-click button applies. */
  readonly oneClickPreset: Params;
  readonly namedPresets: Readonly<Record<string, Params>>;
  apply(mesh: MeshData, given?: Params): MeshData;
}
