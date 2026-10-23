/**
 * TICKET-37 — Studio Deep Editing Operator Family 5: Symmetry, Array & Modular Cloners
 * Pure deterministic TypeScript mesh operators on @hm/partgen MeshData (no DOM, Date, or Math.random).
 *
 * Operators & One-Click Presets:
 * 1. `mirror-symmetry` — One-Click Preset: "Mirror X (Copy & Flip)"
 * 2. `linear-array` — One-Click Preset: "3× Rib Array"
 * 3. `radial-polar-array` — One-Click Preset: "6× Bolt Circle"
 * 4. `grid-honeycomb-cloner` — One-Click Preset: "Vent Honeycomb Grid"
 */

import {
  MeshBuilder,
  resolveParams,
  type MeshData,
  type ParamSpec,
  type Params,
  type V3,
} from '@hm/partgen';

export interface MeshOperator {
  readonly id: string;
  readonly family: 'symmetry-cloner';
  readonly label: string;
  readonly oneClickPresetLabel: string;
  readonly description: string;
  readonly params: readonly ParamSpec[];
  readonly oneClickPreset: Params;
  readonly namedPresets: Readonly<Record<string, Params>>;
  apply(mesh: MeshData, given?: Params): MeshData;
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
 * 1. Mirror Symmetry Operator ("Mirror X (Copy & Flip)")
 * Mirrors geometry across a plane at `planeOffset` along X, Y, or Z, reversing triangle winding
 * on the mirrored half so face normals stay outward-facing.
 */
export const mirrorSymmetry: MeshOperator = {
  id: 'mirror-symmetry',
  family: 'symmetry-cloner',
  label: 'Mirror Symmetry',
  oneClickPresetLabel: 'Mirror X (Copy & Flip)',
  description: 'Mirrors geometry across an X, Y, or Z symmetry plane with automatic winding flip.',
  params: [
    pSpec('axis', 'Mirror axis', 'choice', 0, 2, 1, 0, ['x-axis', 'y-axis', 'z-axis']),
    pSpec('planeOffset', 'Mirror plane coord', 'm', -3.0, 3.0, 0.05, 0.5),
  ],
  oneClickPreset: { axis: 0, planeOffset: 0.5 },
  namedPresets: {
    'mirror-x-copy-flip': { axis: 0, planeOffset: 0.5 },
    'mirror-z-front-back': { axis: 2, planeOffset: 0.5 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const axis = p.axis as 0 | 1 | 2;
    const plane = p.planeOffset as number;

    const slotList =
      mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];
    const b = new MeshBuilder(slotList.map((s) => s.name));

    const refl = (pt: V3): V3 => [
      axis === 0 ? 2 * plane - pt[0] : pt[0],
      axis === 1 ? 2 * plane - pt[1] : pt[1],
      axis === 2 ? 2 * plane - pt[2] : pt[2],
    ];

    for (const sl of slotList) {
      for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
        const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
        const p0: V3 = [mesh.positions[i0 * 3]!, mesh.positions[i0 * 3 + 1]!, mesh.positions[i0 * 3 + 2]!];
        const p1: V3 = [mesh.positions[i1 * 3]!, mesh.positions[i1 * 3 + 1]!, mesh.positions[i1 * 3 + 2]!];
        const p2: V3 = [mesh.positions[i2 * 3]!, mesh.positions[i2 * 3 + 1]!, mesh.positions[i2 * 3 + 2]!];
        b.poly(sl.name, [p0, p1, p2]);
        // Reversed winding on reflected triangle keeps outward normal:
        b.poly(sl.name, [refl(p0), refl(p2), refl(p1)]);
      }
    }
    return b.build();
  },
};

/**
 * 2. Linear Array Operator ("3× Rib Array")
 */
export const linearArray: MeshOperator = {
  id: 'linear-array',
  family: 'symmetry-cloner',
  label: 'Linear Array',
  oneClickPresetLabel: '3× Rib Array',
  description: 'Repeats the mesh N times with linear X/Y/Z step offsets and optional step scale.',
  params: [
    pSpec('count', 'Copies', 'count', 1, 24, 1, 3),
    pSpec('stepX', 'Step X', 'm', -4.0, 4.0, 0.05, 0.65),
    pSpec('stepY', 'Step Y', 'm', -4.0, 4.0, 0.05, 0.0),
    pSpec('stepZ', 'Step Z', 'm', -4.0, 4.0, 0.05, 0.0),
    pSpec('stepScale', 'Per-step scale', 'm', 0.5, 1.5, 0.02, 1.0),
  ],
  oneClickPreset: { count: 3, stepX: 0.65, stepY: 0.0, stepZ: 0.0, stepScale: 1.0 },
  namedPresets: {
    '3x-rib-array': { count: 3, stepX: 0.65, stepY: 0.0, stepZ: 0.0, stepScale: 1.0 },
    '4x-vertical-stack': { count: 4, stepX: 0.0, stepY: 0.35, stepZ: 0.0, stepScale: 0.94 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const count = p.count as number;
    const sx = p.stepX as number;
    const sy = p.stepY as number;
    const sz = p.stepZ as number;
    const sc = p.stepScale as number;

    const slotList =
      mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];
    const b = new MeshBuilder(slotList.map((s) => s.name));

    for (let c = 0; c < count; c++) {
      const mul = Math.pow(sc, c);
      const ox = c * sx, oy = c * sy, oz = c * sz;
      for (const sl of slotList) {
        for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
          const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
          const xform = (idx: number): V3 => [
            mesh.positions[idx * 3]! * mul + ox,
            mesh.positions[idx * 3 + 1]! * mul + oy,
            mesh.positions[idx * 3 + 2]! * mul + oz,
          ];
          b.poly(sl.name, [xform(i0), xform(i1), xform(i2)]);
        }
      }
    }
    return b.build();
  },
};

/**
 * 3. Radial Polar Array Operator ("6× Bolt Circle")
 */
export const radialPolarArray: MeshOperator = {
  id: 'radial-polar-array',
  family: 'symmetry-cloner',
  label: 'Radial Polar Array',
  oneClickPresetLabel: '6× Bolt Circle',
  description: 'Clones the mesh in a circular polar ring around the Y axis (Nomad / Plasticity Radial Array).',
  params: [
    pSpec('count', 'Ring count', 'count', 2, 24, 1, 6),
    pSpec('radius', 'Ring radius', 'm', 0.0, 3.0, 0.02, 0.28),
    pSpec('arcDeg', 'Total arc (deg)', 'm', 30, 360, 15, 360),
  ],
  oneClickPreset: { count: 6, radius: 0.28, arcDeg: 360 },
  namedPresets: {
    '6x-bolt-circle': { count: 6, radius: 0.28, arcDeg: 360 },
    '4x-corner-pillars': { count: 4, radius: 0.6, arcDeg: 360 },
    '8x-turbine-vanes': { count: 8, radius: 0.4, arcDeg: 360 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const count = p.count as number;
    const rad = p.radius as number;
    const arcRad = ((p.arcDeg as number) * Math.PI) / 180;
    const fullCircle = Math.abs((p.arcDeg as number) - 360) < 1e-3;

    const slotList =
      mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];
    const b = new MeshBuilder(slotList.map((s) => s.name));

    for (let k = 0; k < count; k++) {
      const denom = fullCircle ? count : Math.max(1, count - 1);
      const ang = (k / denom) * arcRad;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (const sl of slotList) {
        for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
          const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
          const xform = (idx: number): V3 => {
            const px = mesh.positions[idx * 3]! + rad;
            const py = mesh.positions[idx * 3 + 1]!;
            const pz = mesh.positions[idx * 3 + 2]!;
            return [px * ca - pz * sa, py, px * sa + pz * ca];
          };
          b.poly(sl.name, [xform(i0), xform(i1), xform(i2)]);
        }
      }
    }
    return b.build();
  },
};

/**
 * 4. Grid / Honeycomb Cloner Operator ("Vent Honeycomb Grid")
 * Clones the mesh in a 2D X-Z grid with optional alternate-row honeycomb stagger.
 */
export const gridHoneycombCloner: MeshOperator = {
  id: 'grid-honeycomb-cloner',
  family: 'symmetry-cloner',
  label: 'Grid / Honeycomb Cloner',
  oneClickPresetLabel: 'Vent Honeycomb Grid',
  description: 'Clones geometry into a 2D X-Z pallet or staggered honeycomb array (Spline Cloner).',
  params: [
    pSpec('cols', 'Columns (X)', 'count', 1, 12, 1, 3),
    pSpec('rows', 'Rows (Z)', 'count', 1, 12, 1, 2),
    pSpec('spacingX', 'Column spacing X', 'm', 0.05, 4.0, 0.05, 0.65),
    pSpec('spacingZ', 'Row spacing Z', 'm', 0.05, 4.0, 0.05, 0.65),
    pSpec('honeycombStagger', 'Stagger odd rows', 'choice', 0, 1, 1, 1, ['rect-grid', 'honeycomb-stagger']),
  ],
  oneClickPreset: { cols: 3, rows: 2, spacingX: 0.65, spacingZ: 0.65, honeycombStagger: 1 },
  namedPresets: {
    'vent-honeycomb-grid': { cols: 3, rows: 2, spacingX: 0.65, spacingZ: 0.65, honeycombStagger: 1 },
    'capacitor-3x2-bank': { cols: 3, rows: 2, spacingX: 0.6, spacingZ: 0.6, honeycombStagger: 0 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const cols = p.cols as number;
    const rows = p.rows as number;
    const dx = p.spacingX as number;
    const dz = p.spacingZ as number;
    const stagger = p.honeycombStagger === 1;

    const slotList =
      mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];
    const b = new MeshBuilder(slotList.map((s) => s.name));

    for (let r = 0; r < rows; r++) {
      const rowShiftX = stagger && (r & 1) === 1 ? dx * 0.5 : 0;
      const oz = (r - (rows - 1) * 0.5) * dz;
      for (let c = 0; c < cols; c++) {
        const ox = (c - (cols - 1) * 0.5) * dx + rowShiftX;
        for (const sl of slotList) {
          for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
            const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
            const xform = (idx: number): V3 => [
              mesh.positions[idx * 3]! + ox,
              mesh.positions[idx * 3 + 1]!,
              mesh.positions[idx * 3 + 2]! + oz,
            ];
            b.poly(sl.name, [xform(i0), xform(i1), xform(i2)]);
          }
        }
      }
    }
    return b.build();
  },
};

export const FAMILY5_SYMMETRY_CLONER_OPERATORS: Readonly<Record<string, MeshOperator>> = Object.freeze({
  'mirror-symmetry': mirrorSymmetry,
  'linear-array': linearArray,
  'radial-polar-array': radialPolarArray,
  'grid-honeycomb-cloner': gridHoneycombCloner,
});
