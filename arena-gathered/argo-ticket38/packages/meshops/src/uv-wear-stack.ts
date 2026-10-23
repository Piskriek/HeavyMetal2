/**
 * TICKET-38 — Studio Deep Editing Operator Family 6: UV Projection, Surface Edge Wear / Cavity AO &
 * Non-Destructive Modifier Stack Evaluator.
 * Pure deterministic TypeScript mesh operators on @hm/partgen MeshData (no DOM, Date, or Math.random).
 *
 * Operators & One-Click Presets:
 * 1. `uv-box-triplanar` — One-Click Preset: "1 m Box Trim UV"
 * 2. `uv-cylindrical-unwrap` — One-Click Preset: "Canister Wrap UV"
 * 3. `surface-edge-wear-ao` — One-Click Preset: "Industrial Edge Wear" (Substance Painter Curvature + Cavity AO)
 * 4. `evaluateOperatorStack` — Non-destructive Blender-style modifier stack runner with rank gating (R0/R1/R2)
 */

import {
  MeshBuilder,
  resolveParams,
  type MeshData,
  type ParamSpec,
  type Params,
  type Rank,
  type V3,
} from '@hm/partgen';

export interface MeshOperator {
  readonly id: string;
  readonly family: string;
  readonly label: string;
  readonly oneClickPresetLabel: string;
  readonly description: string;
  readonly params: readonly ParamSpec[];
  readonly oneClickPreset: Params;
  readonly namedPresets: Readonly<Record<string, Params>>;
  apply(mesh: MeshData, given?: Params): MeshData;
}

export interface OperatorStackLayer {
  readonly layerId: string;
  readonly operatorId: string;
  readonly enabled: boolean;
  /** Minimum detail rank at which this operator runs (0: always, 1: Mid+, 2: High/close-up only). */
  readonly minRank: Rank;
  readonly params: Params;
}

const pSpec = (
  key: string,
  label: string,
  unit: 'm' | 'count' | 'choice',
  min: number,
  max: number,
  step: number,
  def: number,
  choices?: readonly string[],
): ParamSpec =>
  choices !== undefined
    ? { key, label, unit, min, max, step, default: def, choices }
    : { key, label, unit, min, max, step, default: def };

/**
 * 1. UV Box Triplanar Projection Operator ("1 m Box Trim UV")
 * Projects UVs in metric world space with configurable tile scale, UV rotation (deg), and offset.
 */
export const uvBoxTriplanar: MeshOperator = {
  id: 'uv-box-triplanar',
  family: 'uv-wear-stack',
  label: 'Box Triplanar UV',
  oneClickPresetLabel: '1 m Box Trim UV',
  description: 'Projects metric box UVs across all faces with tile scale, rotation, and offset.',
  params: [
    pSpec('tileScale', 'UV tile scale (1/m)', 'm', 0.1, 10.0, 0.1, 1.0),
    pSpec('rotationDeg', 'UV rotation (deg)', 'm', -180, 180, 15, 0),
    pSpec('offsetU', 'Offset U', 'm', -2.0, 2.0, 0.05, 0.0),
    pSpec('offsetV', 'Offset V', 'm', -2.0, 2.0, 0.05, 0.0),
  ],
  oneClickPreset: { tileScale: 1.0, rotationDeg: 0, offsetU: 0.0, offsetV: 0.0 },
  namedPresets: {
    '1m-box-trim-uv': { tileScale: 1.0, rotationDeg: 0, offsetU: 0.0, offsetV: 0.0 },
    'fine-2x-detail-uv': { tileScale: 2.0, rotationDeg: 0, offsetU: 0.0, offsetV: 0.0 },
    'rotated-90-trim-uv': { tileScale: 1.0, rotationDeg: 90, offsetU: 0.0, offsetV: 0.0 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const scale = p.tileScale as number;
    const rad = ((p.rotationDeg as number) * Math.PI) / 180;
    const ou = p.offsetU as number;
    const ov = p.offsetV as number;
    const ca = Math.cos(rad), sa = Math.sin(rad);

    const vCount = mesh.positions.length / 3;
    const uvs = new Float32Array(vCount * 2);

    for (let i = 0; i < vCount; i++) {
      const x = mesh.positions[i * 3]!;
      const y = mesh.positions[i * 3 + 1]!;
      const z = mesh.positions[i * 3 + 2]!;
      const ax = Math.abs(mesh.normals[i * 3]!);
      const ay = Math.abs(mesh.normals[i * 3 + 1]!);
      const az = Math.abs(mesh.normals[i * 3 + 2]!);

      let u0 = 0, v0 = 0;
      if (ax >= ay && ax >= az) {
        u0 = z * scale;
        v0 = y * scale;
      } else if (ay >= az) {
        u0 = x * scale;
        v0 = z * scale;
      } else {
        u0 = x * scale;
        v0 = y * scale;
      }

      uvs[i * 2] = u0 * ca - v0 * sa + ou;
      uvs[i * 2 + 1] = u0 * sa + v0 * ca + ov;
    }

    return {
      positions: mesh.positions,
      normals: mesh.normals,
      uvs,
      indices: mesh.indices,
      slots: mesh.slots,
      min: mesh.min,
      max: mesh.max,
    };
  },
};

/**
 * 2. Cylindrical UV Unwrap Operator ("Canister Wrap UV")
 * Unwraps U around the Y (or X/Z) cylinder azimuth and V along its height.
 */
export const uvCylindricalUnwrap: MeshOperator = {
  id: 'uv-cylindrical-unwrap',
  family: 'uv-wear-stack',
  label: 'Cylindrical UV Wrap',
  oneClickPresetLabel: 'Canister Wrap UV',
  description: 'Wraps U seamlessly around the cylinder azimuth and V along the spine.',
  params: [
    pSpec('axis', 'Cylinder axis', 'choice', 0, 2, 1, 1, ['x-axis', 'y-axis', 'z-axis']),
    pSpec('repeatU', 'Circumference repeat', 'm', 0.25, 8.0, 0.25, 1.0),
    pSpec('repeatV', 'Height repeat', 'm', 0.25, 8.0, 0.25, 1.0),
  ],
  oneClickPreset: { axis: 1, repeatU: 1.0, repeatV: 1.0 },
  namedPresets: {
    'canister-wrap-uv': { axis: 1, repeatU: 1.0, repeatV: 1.0 },
    'pipe-wrap-x-uv': { axis: 0, repeatU: 1.0, repeatV: 2.0 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const axis = p.axis as 0 | 1 | 2;
    const repU = p.repeatU as number;
    const repV = p.repeatV as number;

    const cx = 0.5 * (mesh.min[0] + mesh.max[0]);
    const cy = 0.5 * (mesh.min[1] + mesh.max[1]);
    const cz = 0.5 * (mesh.min[2] + mesh.max[2]);
    const lo = mesh.min[axis];
    const span = Math.max(1e-4, mesh.max[axis] - lo);

    const vCount = mesh.positions.length / 3;
    const uvs = new Float32Array(vCount * 2);

    for (let i = 0; i < vCount; i++) {
      const x = mesh.positions[i * 3]!;
      const y = mesh.positions[i * 3 + 1]!;
      const z = mesh.positions[i * 3 + 2]!;
      let angle = 0;
      let h = 0;
      if (axis === 1) {
        angle = Math.atan2(z - cz, x - cx);
        h = (y - lo) / span;
      } else if (axis === 0) {
        angle = Math.atan2(z - cz, y - cy);
        h = (x - lo) / span;
      } else {
        angle = Math.atan2(y - cy, x - cx);
        h = (z - lo) / span;
      }
      uvs[i * 2] = ((angle / (Math.PI * 2)) + 0.5) * repU;
      uvs[i * 2 + 1] = h * repV;
    }

    return {
      positions: mesh.positions,
      normals: mesh.normals,
      uvs,
      indices: mesh.indices,
      slots: mesh.slots,
      min: mesh.min,
      max: mesh.max,
    };
  },
};

/**
 * 3. Surface Edge Wear & Cavity Dirt Operator ("Industrial Edge Wear")
 * Substance Painter-style geometric Metal Edge Wear + Crevice Dirt: generates beveled wear strips
 * assigned to a dedicated `'edge-wear'` material slot on convex high-curvature edges and `'cavity-dirt'`
 * in recessed bottom/crevice bands so kit parts gain procedural worn metal edges without a 3D PC bake!
 */
export const surfaceEdgeWearAndCavity: MeshOperator = {
  id: 'surface-edge-wear-ao',
  family: 'uv-wear-stack',
  label: 'Metal Edge Wear & Dirt',
  oneClickPresetLabel: 'Industrial Edge Wear',
  description: 'Generates Substance-style exposed metal edge wear strips and base crevice dirt slots.',
  params: [
    pSpec('edgeWearWidth', 'Edge wear width', 'm', 0.002, 0.08, 0.002, 0.014),
    pSpec('baseDirtHeight', 'Base dirt band', 'm', 0.0, 0.35, 0.01, 0.06),
  ],
  oneClickPreset: { edgeWearWidth: 0.014, baseDirtHeight: 0.06 },
  namedPresets: {
    'industrial-edge-wear': { edgeWearWidth: 0.014, baseDirtHeight: 0.06 },
    'heavy-battle-wear': { edgeWearWidth: 0.032, baseDirtHeight: 0.14 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const wearW = p.edgeWearWidth as number;
    const dirtH = p.baseDirtHeight as number;
    const dirtCutoffY = mesh.min[1] + dirtH;

    const slotOrder = [...mesh.slots.map((s) => s.name)];
    if (!slotOrder.includes('edge-wear')) slotOrder.push('edge-wear');
    if (dirtH > 0 && !slotOrder.includes('cavity-dirt')) slotOrder.push('cavity-dirt');

    const b = new MeshBuilder(slotOrder);
    const slotList =
      mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];

    for (const sl of slotList) {
      for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
        const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
        const p0: V3 = [mesh.positions[i0 * 3]!, mesh.positions[i0 * 3 + 1]!, mesh.positions[i0 * 3 + 2]!];
        const p1: V3 = [mesh.positions[i1 * 3]!, mesh.positions[i1 * 3 + 1]!, mesh.positions[i1 * 3 + 2]!];
        const p2: V3 = [mesh.positions[i2 * 3]!, mesh.positions[i2 * 3 + 1]!, mesh.positions[i2 * 3 + 2]!];

        const cx = (p0[0] + p1[0] + p2[0]) / 3;
        const cy = (p0[1] + p1[1] + p2[1]) / 3;
        const cz = (p0[2] + p1[2] + p2[2]) / 3;
        const r = Math.max(1e-4, Math.hypot(p0[0] - cx, p0[1] - cy, p0[2] - cz));
        const shrink = Math.max(0.65, 1 - wearW / r);

        const q0: V3 = [cx + (p0[0] - cx) * shrink, cy + (p0[1] - cy) * shrink, cz + (p0[2] - cz) * shrink];
        const q1: V3 = [cx + (p1[0] - cx) * shrink, cy + (p1[1] - cy) * shrink, cz + (p1[2] - cz) * shrink];
        const q2: V3 = [cx + (p2[0] - cx) * shrink, cy + (p2[1] - cy) * shrink, cz + (p2[2] - cz) * shrink];

        const coreSlot = dirtH > 0 && cy <= dirtCutoffY ? 'cavity-dirt' : sl.name;
        b.poly(coreSlot, [q0, q1, q2]);
        b.poly('edge-wear', [p0, p1, q1, q0]);
        b.poly('edge-wear', [p1, p2, q2, q1]);
        b.poly('edge-wear', [p2, p0, q0, q2]);
      }
    }
    return b.build();
  },
};

/**
 * Evaluates a non-destructive Studio Operator Stack on a base MeshData at a given Detail Rank (0, 1, or 2).
 * Operators whose `minRank > rank` or `enabled === false` are skipped automatically!
 */
export function evaluateOperatorStack(
  baseMesh: MeshData,
  stack: readonly OperatorStackLayer[],
  registry: Readonly<Record<string, MeshOperator>>,
  rank: Rank = 2,
): MeshData {
  let current = baseMesh;
  for (const layer of stack) {
    if (!layer.enabled || layer.minRank > rank) continue;
    const op = registry[layer.operatorId];
    if (!op) continue;
    current = op.apply(current, layer.params);
  }
  return current;
}

export const FAMILY6_UV_WEAR_STACK_OPERATORS: Readonly<Record<string, MeshOperator>> = Object.freeze({
  'uv-box-triplanar': uvBoxTriplanar,
  'uv-cylindrical-unwrap': uvCylindricalUnwrap,
  'surface-edge-wear-ao': surfaceEdgeWearAndCavity,
});
