/**
 * TICKET-36 — Studio Deep Editing Operator Family 4: Non-Linear Gizmo Deformers
 * Pure deterministic TypeScript mesh operators on @hm/partgen MeshData (no DOM, Date, or Math.random).
 *
 * Operators & One-Click Presets:
 * 1. `bend-arc` — One-Click Preset: "45° Elbow Bend" (ZBrush Bend Arc / Blender Simple Deform Bend)
 * 2. `twist-helix` — One-Click Preset: "45° Torque Twist" (Axial twist over bounding span)
 * 3. `taper-flare` — One-Click Preset: "Hopper Funnel Taper" (Linear + curve radial taper along axis)
 * 4. `shear-skew` — One-Click Preset: "Angled Louver Skew" (Oblique shear along axis)
 * 5. `ffd-cage-warp` — One-Click Preset: "Wedge Profile Warp" (Symmetrical 2x2x2 lattice cage deformer)
 */

import {
  MeshBuilder,
  resolveParams,
  type MeshData,
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

function deformVertices(mesh: MeshData, fn: (p: V3) => V3): MeshData {
  const slotList =
    mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];
  const b = new MeshBuilder(slotList.map((s) => s.name));
  for (const sl of slotList) {
    for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
      const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
      const p0 = fn([mesh.positions[i0 * 3]!, mesh.positions[i0 * 3 + 1]!, mesh.positions[i0 * 3 + 2]!]);
      const p1 = fn([mesh.positions[i1 * 3]!, mesh.positions[i1 * 3 + 1]!, mesh.positions[i1 * 3 + 2]!]);
      const p2 = fn([mesh.positions[i2 * 3]!, mesh.positions[i2 * 3 + 1]!, mesh.positions[i2 * 3 + 2]!]);
      b.poly(sl.name, [p0, p1, p2]);
    }
  }
  return b.build();
}

/**
 * 1. Bend Arc Deformer ("45° Elbow Bend")
 * Bends geometry along a spine axis (Y or X) into a circular arc of `angleDeg`.
 */
export const bendArc: MeshOperator = {
  id: 'bend-arc',
  family: 'deformers',
  label: 'Bend Arc',
  oneClickPresetLabel: '45° Elbow Bend',
  description: 'Bends the mesh along its primary spine axis into a smooth circular arc.',
  params: [
    pSpec('spineAxis', 'Spine axis', 'choice', 0, 1, 1, 1, ['x-spine', 'y-spine']),
    pSpec('angleDeg', 'Bend angle (deg)', 'm', -180, 180, 5, 45),
  ],
  oneClickPreset: { spineAxis: 1, angleDeg: 45 },
  namedPresets: {
    '45-elbow-bend': { spineAxis: 1, angleDeg: 45 },
    '90-pipe-corner': { spineAxis: 1, angleDeg: 90 },
    'arch-beam-x': { spineAxis: 0, angleDeg: 35 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const spine = p.spineAxis as number;
    const theta = ((p.angleDeg as number) * Math.PI) / 180;
    if (Math.abs(theta) < 1e-4) return mesh;

    if (spine === 1) {
      const yMin = mesh.min[1];
      const spanY = Math.max(1e-4, mesh.max[1] - yMin);
      const radius = spanY / theta;
      return deformVertices(mesh, ([x, y, z]) => {
        const u = (y - yMin) / spanY;
        const ang = u * theta;
        const r = radius - x;
        const nx = radius - r * Math.cos(ang);
        const ny = yMin + r * Math.sin(ang);
        return [nx, ny, z];
      });
    } else {
      const xMin = mesh.min[0];
      const spanX = Math.max(1e-4, mesh.max[0] - xMin);
      const radius = spanX / theta;
      return deformVertices(mesh, ([x, y, z]) => {
        const u = (x - xMin) / spanX;
        const ang = u * theta;
        const r = radius - y;
        const nx = xMin + r * Math.sin(ang);
        const ny = radius - r * Math.cos(ang);
        return [nx, ny, z];
      });
    }
  },
};

/**
 * 2. Twist Helix Deformer ("45° Torque Twist")
 * Rotates cross-sections progressively from 0 to `angleDeg` along the chosen axis.
 */
export const twistHelix: MeshOperator = {
  id: 'twist-helix',
  family: 'deformers',
  label: 'Twist Deformer',
  oneClickPresetLabel: '45° Torque Twist',
  description: 'Twists cross-sections progressively along the X, Y, or Z axis.',
  params: [
    pSpec('axis', 'Twist axis', 'choice', 0, 2, 1, 1, ['x-axis', 'y-axis', 'z-axis']),
    pSpec('angleDeg', 'Twist angle (deg)', 'm', -360, 360, 5, 45),
  ],
  oneClickPreset: { axis: 1, angleDeg: 45 },
  namedPresets: {
    '45-torque-twist': { axis: 1, angleDeg: 45 },
    '90-drill-flute': { axis: 1, angleDeg: 90 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const axis = p.axis as 0 | 1 | 2;
    const totalRad = ((p.angleDeg as number) * Math.PI) / 180;
    const lo = mesh.min[axis];
    const span = Math.max(1e-4, mesh.max[axis] - lo);
    const cx = 0.5 * (mesh.min[0] + mesh.max[0]);
    const cy = 0.5 * (mesh.min[1] + mesh.max[1]);
    const cz = 0.5 * (mesh.min[2] + mesh.max[2]);

    return deformVertices(mesh, ([x, y, z]) => {
      const coord = axis === 0 ? x : axis === 1 ? y : z;
      const t = (coord - lo) / span - 0.5;
      const a = t * totalRad;
      const ca = Math.cos(a), sa = Math.sin(a);
      if (axis === 1) {
        const dx = x - cx, dz = z - cz;
        return [cx + dx * ca - dz * sa, y, cz + dx * sa + dz * ca];
      } else if (axis === 0) {
        const dy = y - cy, dz = z - cz;
        return [x, cy + dy * ca - dz * sa, cz + dy * sa + dz * ca];
      } else {
        const dx = x - cx, dy = y - cy;
        return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca, z];
      }
    });
  },
};

/**
 * 3. Taper / Flare Deformer ("Hopper Funnel Taper")
 * Scales cross-sections from `baseScale` to `topScale` with an optional curve pinch/bulge.
 */
export const taperFlare: MeshOperator = {
  id: 'taper-flare',
  family: 'deformers',
  label: 'Taper / Flare',
  oneClickPresetLabel: 'Hopper Funnel Taper',
  description: 'Scales cross-sections along an axis with optional mid-span flare or pinch.',
  params: [
    pSpec('axis', 'Spine axis', 'choice', 0, 2, 1, 1, ['x-axis', 'y-axis', 'z-axis']),
    pSpec('baseScale', 'Base scale', 'm', 0.2, 2.5, 0.05, 1.0),
    pSpec('topScale', 'Top scale', 'm', 0.2, 2.5, 0.05, 1.45),
    pSpec('curveBulge', 'Mid-span bulge', 'm', -0.8, 0.8, 0.05, 0.0),
  ],
  oneClickPreset: { axis: 1, baseScale: 1.0, topScale: 1.45, curveBulge: 0.0 },
  namedPresets: {
    'hopper-funnel-taper': { axis: 1, baseScale: 1.0, topScale: 1.45, curveBulge: 0.0 },
    'pylon-narrow-top': { axis: 1, baseScale: 1.2, topScale: 0.65, curveBulge: 0.0 },
    'barrel-bulge': { axis: 1, baseScale: 0.9, topScale: 0.9, curveBulge: 0.35 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const axis = p.axis as 0 | 1 | 2;
    const s0 = p.baseScale as number;
    const s1 = p.topScale as number;
    const bulge = p.curveBulge as number;

    const lo = mesh.min[axis];
    const span = Math.max(1e-4, mesh.max[axis] - lo);
    const cx = 0.5 * (mesh.min[0] + mesh.max[0]);
    const cy = 0.5 * (mesh.min[1] + mesh.max[1]);
    const cz = 0.5 * (mesh.min[2] + mesh.max[2]);

    return deformVertices(mesh, ([x, y, z]) => {
      const c = axis === 0 ? x : axis === 1 ? y : z;
      const t = Math.max(0, Math.min(1, (c - lo) / span));
      const scale = s0 + (s1 - s0) * t + bulge * Math.sin(t * Math.PI);
      if (axis === 1) {
        return [cx + (x - cx) * scale, y, cz + (z - cz) * scale];
      } else if (axis === 0) {
        return [x, cy + (y - cy) * scale, cz + (z - cz) * scale];
      } else {
        return [cx + (x - cx) * scale, cy + (y - cy) * scale, z];
      }
    });
  },
};

/**
 * 4. Shear / Skew Deformer ("Angled Louver Skew")
 */
export const shearSkew: MeshOperator = {
  id: 'shear-skew',
  family: 'deformers',
  label: 'Shear / Skew',
  oneClickPresetLabel: 'Angled Louver Skew',
  description: 'Tilts geometry obliquely along X or Z as a function of height Y.',
  params: [
    pSpec('shearX', 'Shear X over Y', 'm', -1.5, 1.5, 0.05, 0.35),
    pSpec('shearZ', 'Shear Z over Y', 'm', -1.5, 1.5, 0.05, 0.0),
  ],
  oneClickPreset: { shearX: 0.35, shearZ: 0.0 },
  namedPresets: {
    'angled-louver-skew': { shearX: 0.35, shearZ: 0.0 },
    'forward-cab-rake': { shearX: 0.0, shearZ: 0.4 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const sx = p.shearX as number;
    const sz = p.shearZ as number;
    const y0 = mesh.min[1];
    return deformVertices(mesh, ([x, y, z]) => {
      const dy = y - y0;
      return [x + dy * sx, y, z + dy * sz];
    });
  },
};

/**
 * 5. FFD 2x2x2 Lattice Cage Warp ("Wedge Profile Warp")
 * Deforms a part inside its normalized bounding box with independent top/bottom X & Z scales and arch lift.
 */
export const ffdCageWarp: MeshOperator = {
  id: 'ffd-cage-warp',
  family: 'deformers',
  label: 'FFD Lattice Box',
  oneClickPresetLabel: 'Wedge Profile Warp',
  description: '2x2x2 bounding-box lattice warp for wedge cabs, sloped roofs, and arched beams.',
  params: [
    pSpec('topScaleX', 'Top X width scale', 'm', 0.2, 2.0, 0.05, 0.75),
    pSpec('topScaleZ', 'Top Z depth scale', 'm', 0.2, 2.0, 0.05, 0.85),
    pSpec('frontSlopeY', 'Front (+Z) roof slope', 'm', -0.8, 0.8, 0.05, -0.2),
    pSpec('archLiftY', 'Center X arch lift', 'm', -0.5, 0.5, 0.02, 0.0),
  ],
  oneClickPreset: { topScaleX: 0.75, topScaleZ: 0.85, frontSlopeY: -0.2, archLiftY: 0.0 },
  namedPresets: {
    'wedge-profile-warp': { topScaleX: 0.75, topScaleZ: 0.85, frontSlopeY: -0.2, archLiftY: 0.0 },
    'arched-gantry-span': { topScaleX: 1.0, topScaleZ: 1.0, frontSlopeY: 0.0, archLiftY: 0.18 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const tx = p.topScaleX as number;
    const tz = p.topScaleZ as number;
    const slope = p.frontSlopeY as number;
    const arch = p.archLiftY as number;

    const minX = mesh.min[0], maxX = mesh.max[0];
    const minY = mesh.min[1], maxY = mesh.max[1];
    const minZ = mesh.min[2], maxZ = mesh.max[2];
    const cx = 0.5 * (minX + maxX);
    const cz = 0.5 * (minZ + maxZ);
    const spanX = Math.max(1e-4, maxX - minX);
    const spanY = Math.max(1e-4, maxY - minY);
    const spanZ = Math.max(1e-4, maxZ - minZ);

    return deformVertices(mesh, ([x, y, z]) => {
      const uy = (y - minY) / spanY; // 0..1 bottom to top
      const uz = (z - minZ) / spanZ; // 0..1 back to front
      const uxSym = ((x - cx) / (0.5 * spanX)); // -1..1
      const sx = 1 + (tx - 1) * uy;
      const sz = 1 + (tz - 1) * uy;
      const nx = cx + (x - cx) * sx;
      const nz = cz + (z - cz) * sz;
      const ny = y + uy * uz * slope * spanY + (1 - uxSym * uxSym) * arch * spanY;
      return [nx, ny, nz];
    });
  },
};

export const FAMILY4_DEFORMER_OPERATORS: Readonly<Record<string, MeshOperator>> = Object.freeze({
  'bend-arc': bendArc,
  'twist-helix': twistHelix,
  'taper-flare': taperFlare,
  'shear-skew': shearSkew,
  'ffd-cage-warp': ffdCageWarp,
});
