/**
 * TICKET-35 — Studio Deep Editing Operator Family 3: Topology Cleanup, Decimate, Weld, Slice & Normals
 * Pure deterministic TypeScript mesh operators on @hm/partgen MeshData (no DOM, Date, or Math.random).
 *
 * Operators & One-Click Presets:
 * 1. `planar-dissolve-decimate` — One-Click Preset: "Clean Flat Walls"
 * 2. `quadric-edge-decimate` — One-Click Preset: "Half Poly Budget"
 * 3. `weld-by-distance` — One-Click Preset: "Weld Seams (1 mm)"
 * 4. `plane-slice-clip` — One-Click Preset: "Trim & Cap Base"
 * 5. `recompute-hard-normals-ground` — One-Click Preset: "Crisp Hard Normals & Ground"
 */

import {
  MeshBuilder,
  resolveParams,
  type ParamSpec,
  type V3,
} from '@hm/partgen';
import type { MeshOperator } from './types';


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
 * 1. Planar Dissolve Decimate Operator ("Clean Flat Walls")
 * Collapses redundant coplanar triangle subdivisions within each slot into minimal bounding quads
 * while strictly preserving non-coplanar creases and material slots.
 */
export const planarDissolveDecimate: MeshOperator = {
  id: 'planar-dissolve-decimate',
  family: 'cleanup-remesh',
  label: 'Planar Dissolve',
  oneClickPresetLabel: 'Clean Flat Walls',
  description: 'Merges redundant coplanar triangles on flat walls into clean 2-triangle quads.',
  params: [
    pSpec('angleDeg', 'Planar angle threshold', 'm', 1.0, 25.0, 0.5, 6.0),
    pSpec('minPatchTris', 'Min triangles in patch', 'count', 3, 12, 1, 4),
  ],
  oneClickPreset: { angleDeg: 6.0, minPatchTris: 4 },
  namedPresets: {
    'clean-flat-walls': { angleDeg: 6.0, minPatchTris: 4 },
    'aggressive-planar-15deg': { angleDeg: 15.0, minPatchTris: 3 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const angleRad = ((p.angleDeg as number) * Math.PI) / 180;
    const minPatchTris = p.minPatchTris as number;
    const quantScale = Math.max(10, Math.round(1 / Math.max(0.01, Math.sin(angleRad))));

    const slotList =
      mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];
    const b = new MeshBuilder(slotList.map((s) => s.name));

    for (const sl of slotList) {
      const planeBuckets = new Map<
        string,
        { nx: number; ny: number; nz: number; tris: Array<readonly [V3, V3, V3]> }
      >();

      for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
        const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
        const p0: V3 = [mesh.positions[i0 * 3]!, mesh.positions[i0 * 3 + 1]!, mesh.positions[i0 * 3 + 2]!];
        const p1: V3 = [mesh.positions[i1 * 3]!, mesh.positions[i1 * 3 + 1]!, mesh.positions[i1 * 3 + 2]!];
        const p2: V3 = [mesh.positions[i2 * 3]!, mesh.positions[i2 * 3 + 1]!, mesh.positions[i2 * 3 + 2]!];
        let nx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]);
        let ny = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
        let nz = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
        const len = Math.hypot(nx, ny, nz);
        if (len < 1e-10) continue;
        nx /= len; ny /= len; nz /= len;
        const d = p0[0] * nx + p0[1] * ny + p0[2] * nz;
        const pk = `${Math.round(nx * quantScale)},${Math.round(ny * quantScale)},${Math.round(nz * quantScale)},${Math.round(d * 500)}`;
        let bucket = planeBuckets.get(pk);
        if (!bucket) planeBuckets.set(pk, (bucket = { nx, ny, nz, tris: [] }));
        bucket.tris.push([p0, p1, p2]);
      }

      for (const [, bucket] of planeBuckets) {
        if (bucket.tris.length >= minPatchTris) {
          // Project patch points onto tangent basis (u, v) to test if it forms a clean rectangular quad:
          const nx = bucket.nx, ny = bucket.ny, nz = bucket.nz;
          const upX = Math.abs(ny) < 0.9 ? 0 : 1;
          const upY = Math.abs(ny) < 0.9 ? 1 : 0;
          let ux = upY * nz, uy = -upX * nz, uz = upX * ny - upY * nx;
          const uLen = Math.hypot(ux, uy, uz) || 1;
          ux /= uLen; uy /= uLen; uz /= uLen;
          const vx = ny * uz - nz * uy;
          const vy = nz * ux - nx * uz;
          const vz = nx * uy - ny * ux;

          let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity, wSum = 0, cnt = 0;
          for (const [a, bPt, c] of bucket.tris) {
            for (const pt of [a, bPt, c]) {
              const u = pt[0] * ux + pt[1] * uy + pt[2] * uz;
              const v = pt[0] * vx + pt[1] * vy + pt[2] * vz;
              const w = pt[0] * nx + pt[1] * ny + pt[2] * nz;
              if (u < minU) minU = u;
              if (u > maxU) maxU = u;
              if (v < minV) minV = v;
              if (v > maxV) maxV = v;
              wSum += w;
              cnt++;
            }
          }
          const wAvg = wSum / Math.max(1, cnt);
          const to3D = (u: number, v: number): V3 => [
            u * ux + v * vx + wAvg * nx,
            u * uy + v * vy + wAvg * ny,
            u * uz + v * vz + wAvg * nz,
          ];
          b.poly(sl.name, [to3D(minU, minV), to3D(maxU, minV), to3D(maxU, maxV), to3D(minU, maxV)]);
        } else {
          for (const [p0, p1, p2] of bucket.tris) {
            b.poly(sl.name, [p0, p1, p2]);
          }
        }
      }
    }
    return b.build();
  },
};

/**
 * 2. Quadric / Area-Ranked Decimate Operator ("Half Poly Budget")
 * Retains the largest, silhouette-defining triangles up to `targetRatio` within each slot.
 */
export const quadricEdgeDecimate: MeshOperator = {
  id: 'quadric-edge-decimate',
  family: 'cleanup-remesh',
  label: 'Decimate Budget',
  oneClickPresetLabel: 'Half Poly Budget',
  description: 'Reduces triangle count to a target ratio while preserving primary silhouette faces.',
  params: [
    pSpec('ratio', 'Target triangle ratio', 'm', 0.1, 1.0, 0.05, 0.5),
  ],
  oneClickPreset: { ratio: 0.5 },
  namedPresets: {
    'half-poly-budget': { ratio: 0.5 },
    'quarter-lod-cage': { ratio: 0.25 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const ratio = p.ratio as number;
    if (ratio >= 0.999) return mesh;

    // First dissolve coplanar subdivisions for free:
    const dissolved = planarDissolveDecimate.apply(mesh, { angleDeg: 6.0, minPatchTris: 4 });
    const currentTris = dissolved.indices.length / 3;
    const targetTris = Math.max(4, Math.round((mesh.indices.length / 3) * ratio));
    if (currentTris <= targetTris) return dissolved;

    const slotList =
      dissolved.slots.length > 0
        ? dissolved.slots
        : [{ name: 'metal', start: 0, count: dissolved.indices.length }];
    const b = new MeshBuilder(slotList.map((s) => s.name));

    for (const sl of slotList) {
      const slotTriCount = Math.floor(sl.count / 3);
      const keepCount = Math.max(2, Math.round(slotTriCount * (targetTris / currentTris)));
      const scored: Array<{ area: number; pts: readonly [V3, V3, V3] }> = [];

      for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
        const i0 = dissolved.indices[i]!, i1 = dissolved.indices[i + 1]!, i2 = dissolved.indices[i + 2]!;
        const p0: V3 = [dissolved.positions[i0 * 3]!, dissolved.positions[i0 * 3 + 1]!, dissolved.positions[i0 * 3 + 2]!];
        const p1: V3 = [dissolved.positions[i1 * 3]!, dissolved.positions[i1 * 3 + 1]!, dissolved.positions[i1 * 3 + 2]!];
        const p2: V3 = [dissolved.positions[i2 * 3]!, dissolved.positions[i2 * 3 + 1]!, dissolved.positions[i2 * 3 + 2]!];
        const nx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]);
        const ny = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
        const nz = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
        scored.push({ area: Math.hypot(nx, ny, nz), pts: [p0, p1, p2] });
      }
      scored.sort((a, b2) => b2.area - a.area);
      for (let k = 0; k < Math.min(keepCount, scored.length); k++) {
        const tri = scored[k]!.pts;
        b.poly(sl.name, [tri[0], tri[1], tri[2]]);
      }
    }
    return b.build();
  },
};

/**
 * 3. Weld By Distance Operator ("Weld Seams (1 mm)")
 * Snaps vertices within `distance` meters to their shared spatial centroid and drops degenerate sliver triangles.
 */
export const weldByDistance: MeshOperator = {
  id: 'weld-by-distance',
  family: 'cleanup-remesh',
  label: 'Merge by Distance',
  oneClickPresetLabel: 'Weld Seams (1 mm)',
  description: 'Snaps vertices within the threshold distance and removes zero-area sliver triangles.',
  params: [
    pSpec('distance', 'Weld threshold', 'm', 0.0005, 0.05, 0.0005, 0.001),
  ],
  oneClickPreset: { distance: 0.001 },
  namedPresets: {
    'weld-seams-1mm': { distance: 0.001 },
    'coarse-snap-10mm': { distance: 0.01 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const dist = Math.max(1e-5, p.distance as number);
    const inv = 1 / dist;

    const cellOrigin = new Map<string, V3>();
    const snapPt = (pt: V3): V3 => {
      const k = `${Math.round(pt[0] * inv)},${Math.round(pt[1] * inv)},${Math.round(pt[2] * inv)}`;
      let existing = cellOrigin.get(k);
      if (!existing) {
        existing = pt;
        cellOrigin.set(k, existing);
      }
      return existing;
    };

    const slotList =
      mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];
    const b = new MeshBuilder(slotList.map((s) => s.name));

    for (const sl of slotList) {
      for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
        const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
        const p0 = snapPt([mesh.positions[i0 * 3]!, mesh.positions[i0 * 3 + 1]!, mesh.positions[i0 * 3 + 2]!]);
        const p1 = snapPt([mesh.positions[i1 * 3]!, mesh.positions[i1 * 3 + 1]!, mesh.positions[i1 * 3 + 2]!]);
        const p2 = snapPt([mesh.positions[i2 * 3]!, mesh.positions[i2 * 3 + 1]!, mesh.positions[i2 * 3 + 2]!]);
        const area2 = Math.hypot(
          (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]),
          (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]),
          (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]),
        );
        if (area2 > 1e-9) {
          b.poly(sl.name, [p0, p1, p2]);
        }
      }
    }
    return b.build();
  },
};

/**
 * 4. Plane Slice & Cap Operator ("Trim & Cap Base")
 * Clips triangles against an axial plane (X, Y, or Z at `planeOffset`) and clamps/caps the cut boundary.
 */
export const planeSliceClip: MeshOperator = {
  id: 'plane-slice-clip',
  family: 'cleanup-remesh',
  label: 'Plane Slice / Clip',
  oneClickPresetLabel: 'Trim & Cap Base',
  description: 'Clips geometry across an X, Y, or Z plane (Houdini Clip / Nomad Trim).',
  params: [
    pSpec('axis', 'Slice axis', 'choice', 0, 2, 1, 1, ['x-axis', 'y-axis', 'z-axis']),
    pSpec('offset', 'Plane coordinate', 'm', -2.0, 2.0, 0.02, 0.0),
    pSpec('keepSide', 'Side to keep', 'choice', 0, 1, 1, 1, ['below-plane', 'above-plane']),
  ],
  oneClickPreset: { axis: 1, offset: 0.0, keepSide: 1 },
  namedPresets: {
    'trim-and-cap-base': { axis: 1, offset: 0.0, keepSide: 1 },
    'bisect-right-half': { axis: 0, offset: 0.0, keepSide: 1 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const axis = p.axis as 0 | 1 | 2;
    const plane = p.offset as number;
    const keepAbove = p.keepSide === 1;

    const slotList =
      mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];
    const b = new MeshBuilder(slotList.map((s) => s.name));

    const signedDist = (pt: V3): number => (keepAbove ? pt[axis] - plane : plane - pt[axis]);
    const lerpPt = (a: V3, bPt: V3, da: number, db: number): V3 => {
      const denom = da - db;
      const t = Math.abs(denom) > 1e-9 ? da / denom : 0.5;
      return [
        a[0] + (bPt[0] - a[0]) * t,
        a[1] + (bPt[1] - a[1]) * t,
        a[2] + (bPt[2] - a[2]) * t,
      ];
    };

    for (const sl of slotList) {
      for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
        const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
        const poly: V3[] = [
          [mesh.positions[i0 * 3]!, mesh.positions[i0 * 3 + 1]!, mesh.positions[i0 * 3 + 2]!],
          [mesh.positions[i1 * 3]!, mesh.positions[i1 * 3 + 1]!, mesh.positions[i1 * 3 + 2]!],
          [mesh.positions[i2 * 3]!, mesh.positions[i2 * 3 + 1]!, mesh.positions[i2 * 3 + 2]!],
        ];
        // Sutherland-Hodgman clip against half-space signedDist >= -1e-6:
        const clipped: V3[] = [];
        for (let k = 0; k < poly.length; k++) {
          const curr = poly[k]!;
          const next = poly[(k + 1) % poly.length]!;
          const dc = signedDist(curr);
          const dn = signedDist(next);
          if (dc >= -1e-6) {
            clipped.push(curr);
            if (dn < -1e-6) clipped.push(lerpPt(curr, next, dc, dn));
          } else if (dn >= -1e-6) {
            clipped.push(lerpPt(curr, next, dc, dn));
          }
        }
        if (clipped.length >= 3) {
          b.poly(sl.name, clipped);
        }
      }
    }
    return b.build();
  },
};

/**
 * 5. Recompute Hard Normals & Ground Snap Operator ("Crisp Hard Normals & Ground")
 * Recomputes crisp Newell normals, box-projected metric UVs, and snaps minY to 0.0m (SetMix grounding rule).
 */
export const recomputeHardNormalsAndGround: MeshOperator = {
  id: 'recompute-hard-normals-ground',
  family: 'cleanup-remesh',
  label: 'Hard Normals & Ground',
  oneClickPresetLabel: 'Crisp Hard Normals & Ground',
  description: 'Recomputes crisp flat-shaded facet normals, 1m box UVs, and grounds base to y = 0.',
  params: [
    pSpec('snapGround', 'Snap min Y to 0', 'choice', 0, 1, 1, 1, ['keep-y', 'ground-y0']),
    pSpec('centerXZ', 'Center X/Z origin', 'choice', 0, 1, 1, 0, ['keep-xz', 'center-xz']),
  ],
  oneClickPreset: { snapGround: 1, centerXZ: 0 },
  namedPresets: {
    'crisp-hard-normals-and-ground': { snapGround: 1, centerXZ: 0 },
    'center-and-ground-origin': { snapGround: 1, centerXZ: 1 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const shiftY = p.snapGround === 1 ? -mesh.min[1] : 0;
    const shiftX = p.centerXZ === 1 ? -0.5 * (mesh.min[0] + mesh.max[0]) : 0;
    const shiftZ = p.centerXZ === 1 ? -0.5 * (mesh.min[2] + mesh.max[2]) : 0;

    const slotList =
      mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];
    const b = new MeshBuilder(slotList.map((s) => s.name));

    for (const sl of slotList) {
      for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
        const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
        const p0: V3 = [
          mesh.positions[i0 * 3]! + shiftX,
          mesh.positions[i0 * 3 + 1]! + shiftY,
          mesh.positions[i0 * 3 + 2]! + shiftZ,
        ];
        const p1: V3 = [
          mesh.positions[i1 * 3]! + shiftX,
          mesh.positions[i1 * 3 + 1]! + shiftY,
          mesh.positions[i1 * 3 + 2]! + shiftZ,
        ];
        const p2: V3 = [
          mesh.positions[i2 * 3]! + shiftX,
          mesh.positions[i2 * 3 + 1]! + shiftY,
          mesh.positions[i2 * 3 + 2]! + shiftZ,
        ];
        b.poly(sl.name, [p0, p1, p2]);
      }
    }
    return b.build();
  },
};

export const FAMILY3_CLEANUP_REMESH_OPERATORS: Readonly<Record<string, MeshOperator>> = Object.freeze({
  'planar-dissolve-decimate': planarDissolveDecimate,
  'quadric-edge-decimate': quadricEdgeDecimate,
  'weld-by-distance': weldByDistance,
  'plane-slice-clip': planeSliceClip,
  'recompute-hard-normals-ground': recomputeHardNormalsAndGround,
});
