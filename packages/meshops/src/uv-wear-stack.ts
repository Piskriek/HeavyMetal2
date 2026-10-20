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
import type { MeshOperator } from './types';


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
  unit: ParamSpec['unit'],
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
    pSpec('sharpDeg', 'Sharp edge angle', 'deg', 5, 90, 1, 30),
  ],
  oneClickPreset: { edgeWearWidth: 0.014, baseDirtHeight: 0.06, sharpDeg: 30 },
  namedPresets: {
    'industrial-edge-wear': { edgeWearWidth: 0.014, baseDirtHeight: 0.06, sharpDeg: 30 },
    'heavy-battle-wear': { edgeWearWidth: 0.032, baseDirtHeight: 0.14, sharpDeg: 25 },
  },
  /**
   * Wear lands only on sharp edges: open borders, and creases where the two faces meet at more than `sharpDeg`. A
   * triangle with no sharp edge passes through untouched; on one with sharp edges, a strip `edgeWearWidth` wide is cut off
   * each sharp edge (clipped in the triangle's own plane), so the strips and the core tile the triangle exactly. Flat
   * triangulation diagonals never wear, and the triangle count grows only along the creases.
   */
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const wearW = p.edgeWearWidth as number;
    const dirtH = p.baseDirtHeight as number;
    const cosSharp = Math.cos(((p.sharpDeg as number) * Math.PI) / 180);
    const dirtCutoffY = mesh.min[1] + dirtH;

    const slotOrder = [...mesh.slots.map((s) => s.name)];
    if (!slotOrder.includes('edge-wear')) slotOrder.push('edge-wear');
    if (dirtH > 0 && !slotOrder.includes('cavity-dirt')) slotOrder.push('cavity-dirt');
    const b = new MeshBuilder(slotOrder);
    const slotList = mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];

    const P = (i: number): V3 => [mesh.positions[i * 3]!, mesh.positions[i * 3 + 1]!, mesh.positions[i * 3 + 2]!];
    const key = (v: V3): string => `${Math.round(v[0] * 1e5)},${Math.round(v[1] * 1e5)},${Math.round(v[2] * 1e5)}`;
    const sub = (a: V3, c: V3): V3 => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
    const dot = (a: V3, c: V3): number => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    const cross = (a: V3, c: V3): V3 => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
    const unit = (a: V3): V3 => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    };

    // every triangle's corners and face normal, and which triangles share each (welded) edge
    const tris: { v: [V3, V3, V3]; n: V3; slot: string }[] = [];
    for (const sl of slotList) {
      for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
        const v: [V3, V3, V3] = [P(mesh.indices[i]!), P(mesh.indices[i + 1]!), P(mesh.indices[i + 2]!)];
        tris.push({ v, n: unit(cross(sub(v[1], v[0]), sub(v[2], v[0]))), slot: sl.name });
      }
    }
    const edgeKey = (a: V3, c: V3): string => {
      const ka = key(a), kc = key(c);
      return ka < kc ? `${ka}|${kc}` : `${kc}|${ka}`;
    };
    const byEdge = new Map<string, number[]>();
    tris.forEach((t, ti) => {
      for (let e = 0; e < 3; e++) {
        const k = edgeKey(t.v[e]!, t.v[(e + 1) % 3]!);
        const list = byEdge.get(k);
        if (list) list.push(ti);
        else byEdge.set(k, [ti]);
      }
    });

    /** Keeps the part of `poly` where dot(p - o, d) is on the given side of `w` (Sutherland–Hodgman against one plane). */
    const clip = (poly: V3[], o: V3, d: V3, w: number, keepBeyond: boolean): V3[] => {
      const side = (q: V3): number => (dot(sub(q, o), d) - w) * (keepBeyond ? 1 : -1);
      const out: V3[] = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!, c = poly[(i + 1) % poly.length]!;
        const sa = side(a), sc = side(c);
        if (sa >= 0) out.push(a);
        if ((sa >= 0) !== (sc >= 0)) {
          const t = sa / (sa - sc);
          out.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t]);
        }
      }
      return out;
    };

    tris.forEach((t, ti) => {
      const cy = (t.v[0][1] + t.v[1][1] + t.v[2][1]) / 3;
      const coreSlot = dirtH > 0 && cy <= dirtCutoffY ? 'cavity-dirt' : t.slot;
      let core: V3[] = [t.v[0], t.v[1], t.v[2]];
      for (let e = 0; e < 3; e++) {
        const a = t.v[e]!, c = t.v[(e + 1) % 3]!, opposite = t.v[(e + 2) % 3]!;
        const others = (byEdge.get(edgeKey(a, c)) ?? []).filter((o) => o !== ti);
        const sharp = others.length === 0 || others.some((o) => dot(t.n, tris[o]!.n) < cosSharp);
        if (!sharp) continue;
        // the in-plane direction from this edge into the triangle
        let d = unit(cross(t.n, sub(c, a)));
        if (dot(d, sub(opposite, a)) < 0) d = [-d[0], -d[1], -d[2]];
        const strip = clip(core, a, d, wearW, false);
        if (strip.length >= 3) b.poly('edge-wear', strip);
        core = clip(core, a, d, wearW, true);
        if (core.length < 3) break;
      }
      if (core.length >= 3) b.poly(coreSlot, core);
    });
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
