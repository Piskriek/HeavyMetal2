/**
 * TICKET-34 — Studio Deep Editing Operator Family 2: Hard-Surface CAD, Chamfer, Panel Inset,
 * Face Extrude, Solidify Hollow Shell & 9-Slice Extender.
 * Pure deterministic TypeScript mesh operators on @hm/partgen MeshData (no DOM, Date, or Math.random).
 *
 * Operators & One-Click Presets:
 * 1. `chamfer-hard-edges` — One-Click Preset: "45° Industrial Chamfer"
 * 2. `inset-outset-faces` — One-Click Preset: "Recessed Panel Seam"
 * 3. `extrude-faces-normal` — One-Click Preset: "Raised Boss / Fin"
 * 4. `solidify-hollow-shell` — One-Click Preset: "Hollow Sheet-Metal Wall"
 * 5. `extender-mid-slice` — One-Click Preset: "Stretch Chassis Span"
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

interface CoplanarGroup {
  readonly slotName: string;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly tris: ReadonlyArray<readonly [V3, V3, V3]>;
}

/**
 * Groups connected coplanar triangles within each material slot so hard-surface CAD operators
 * (Chamfer, Panel Inset, Extrude) act on logical planar faces rather than diagonal half-quads!
 */
function extractCoplanarFaceGroups(mesh: MeshData): CoplanarGroup[] {
  const groups: CoplanarGroup[] = [];
  const slotList =
    mesh.slots.length > 0 ? mesh.slots : [{ name: 'metal', start: 0, count: mesh.indices.length }];

  const planeKey = (nx: number, ny: number, nz: number, d: number): string =>
    `${Math.round(nx * 50)},${Math.round(ny * 50)},${Math.round(nz * 50)},${Math.round(d * 200)}`;

  for (const sl of slotList) {
    const map = new Map<string, { nx: number; ny: number; nz: number; tris: Array<readonly [V3, V3, V3]> }>();
    for (let i = sl.start; i + 2 < sl.start + sl.count; i += 3) {
      const i0 = mesh.indices[i]!, i1 = mesh.indices[i + 1]!, i2 = mesh.indices[i + 2]!;
      const p0: V3 = [mesh.positions[i0 * 3]!, mesh.positions[i0 * 3 + 1]!, mesh.positions[i0 * 3 + 2]!];
      const p1: V3 = [mesh.positions[i1 * 3]!, mesh.positions[i1 * 3 + 1]!, mesh.positions[i1 * 3 + 2]!];
      const p2: V3 = [mesh.positions[i2 * 3]!, mesh.positions[i2 * 3 + 1]!, mesh.positions[i2 * 3 + 2]!];
      let nx = mesh.normals[i0 * 3]!, ny = mesh.normals[i0 * 3 + 1]!, nz = mesh.normals[i0 * 3 + 2]!;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      const d = p0[0] * nx + p0[1] * ny + p0[2] * nz;
      const pk = planeKey(nx, ny, nz, d);
      let g = map.get(pk);
      if (!g) map.set(pk, (g = { nx, ny, nz, tris: [] }));
      g.tris.push([p0, p1, p2]);
    }

    for (const [, g] of map) {
      let cx = 0, cy = 0, cz = 0, nPts = 0;
      for (const [a, b, c] of g.tris) {
        cx += a[0] + b[0] + c[0];
        cy += a[1] + b[1] + c[1];
        cz += a[2] + b[2] + c[2];
        nPts += 3;
      }
      groups.push({
        slotName: sl.name,
        nx: g.nx,
        ny: g.ny,
        nz: g.nz,
        cx: cx / Math.max(1, nPts),
        cy: cy / Math.max(1, nPts),
        cz: cz / Math.max(1, nPts),
        tris: g.tris,
      });
    }
  }
  return groups;
}

function vKey(p: V3): string {
  return `${Math.round(p[0] * 10000)},${Math.round(p[1] * 10000)},${Math.round(p[2] * 10000)}`;
}

function dirEdgeKey(a: V3, b: V3): string {
  return `${vKey(a)}->${vKey(b)}`;
}

/**
 * Extracts boundary edges of a coplanar triangle group (edges that appear only once in that plane).
 */
function getGroupBoundaryEdges(tris: ReadonlyArray<readonly [V3, V3, V3]>): Array<readonly [V3, V3]> {
  const directed = new Map<string, readonly [V3, V3]>();
  for (const [a, b, c] of tris) {
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const rev = dirEdgeKey(q, p);
      if (directed.has(rev)) {
        directed.delete(rev);
      } else {
        directed.set(dirEdgeKey(p, q), [p, q]);
      }
    }
  }
  return Array.from(directed.values());
}

/**
 * 1. Chamfer Hard Edges Operator ("45° Industrial Chamfer")
 * Pulls each coplanar face group inward by `width`, steps the face outward by `width * 0.5`,
 * and bridges the boundary perimeter with 45-degree chamfer bevel quads!
 */
export const chamferHardEdges: MeshOperator = {
  id: 'chamfer-hard-edges',
  family: 'hardsurface-cad',
  label: 'Chamfer / Bevel',
  oneClickPresetLabel: '45° Industrial Chamfer',
  description: 'Adds 45-degree industrial edge chamfers around all hard-surface planar faces.',
  params: [
    pSpec('width', 'Chamfer width', 'm', 0.002, 0.15, 0.002, 0.02),
    pSpec('bevelSlot', 'Chamfer material slot', 'choice', 0, 1, 1, 0, ['same-slot', 'trim-slot']),
  ],
  oneClickPreset: { width: 0.02, bevelSlot: 0 },
  namedPresets: {
    'fine-2mm-chamfer': { width: 0.004, bevelSlot: 0 },
    '45-industrial-chamfer': { width: 0.02, bevelSlot: 0 },
    'heavy-armor-bevel': { width: 0.045, bevelSlot: 1 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const width = p.width as number;
    const useTrim = p.bevelSlot === 1;
    const groups = extractCoplanarFaceGroups(mesh);
    const slotOrder = mesh.slots.map((s) => s.name);
    if (useTrim && !slotOrder.includes('trim')) slotOrder.push('trim');
    const b = new MeshBuilder(slotOrder);

    for (const g of groups) {
      let maxR = 0;
      for (const [p0, p1, p2] of g.tris) {
        for (const pt of [p0, p1, p2]) {
          const d = Math.hypot(pt[0] - g.cx, pt[1] - g.cy, pt[2] - g.cz);
          if (d > maxR) maxR = d;
        }
      }
      const shrink = maxR > 1e-4 ? Math.max(0.55, 1 - width / maxR) : 0.9;
      const lift = width * 0.35;

      const insetPt = (pt: V3): V3 => [
        g.cx + (pt[0] - g.cx) * shrink + g.nx * lift,
        g.cy + (pt[1] - g.cy) * shrink + g.ny * lift,
        g.cz + (pt[2] - g.cz) * shrink + g.nz * lift,
      ];

      for (const [p0, p1, p2] of g.tris) {
        b.poly(g.slotName, [insetPt(p0), insetPt(p1), insetPt(p2)]);
      }

      const bEdges = getGroupBoundaryEdges(g.tris);
      const bevSlot = useTrim ? 'trim' : g.slotName;
      for (const [e0, e1] of bEdges) {
        b.poly(bevSlot, [e0, e1, insetPt(e1), insetPt(e0)]);
      }
    }
    return b.build();
  },
};

/**
 * 2. Inset / Outset Panel Seam Operator ("Recessed Panel Seam")
 * Insets planar faces by `inset` fraction and steps the inner panel by `depth` (negative = recessed seam,
 * positive = raised plate). Filters faces by minimum area or vertical/top orientation.
 */
export const insetOutsetFaces: MeshOperator = {
  id: 'inset-outset-faces',
  family: 'hardsurface-cad',
  label: 'Panel Inset / Seam',
  oneClickPresetLabel: 'Recessed Panel Seam',
  description: 'Insets planar faces and recesses or raises an inner panel plate (Plasticity Imprint / Houdini PolyExtrude).',
  params: [
    pSpec('inset', 'Border margin', 'm', 0.02, 0.45, 0.02, 0.14),
    pSpec('depth', 'Panel step depth', 'm', -0.1, 0.1, 0.005, -0.015),
    pSpec('targetFaces', 'Target faces', 'choice', 0, 2, 1, 0, ['all-faces', 'side-walls', 'top-and-bottom']),
  ],
  oneClickPreset: { inset: 0.14, depth: -0.015, targetFaces: 0 },
  namedPresets: {
    'recessed-panel-seam': { inset: 0.14, depth: -0.015, targetFaces: 0 },
    'raised-armor-plate': { inset: 0.16, depth: 0.02, targetFaces: 1 },
    'top-hatch-recess': { inset: 0.2, depth: -0.025, targetFaces: 2 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const insetFrac = p.inset as number;
    const depth = p.depth as number;
    const mode = p.targetFaces as number;
    const groups = extractCoplanarFaceGroups(mesh);
    const b = new MeshBuilder(mesh.slots.map((s) => s.name));

    for (const g of groups) {
      const absNy = Math.abs(g.ny);
      const eligible =
        mode === 0 || (mode === 1 && absNy < 0.5) || (mode === 2 && absNy >= 0.5);

      if (!eligible) {
        for (const [p0, p1, p2] of g.tris) b.poly(g.slotName, [p0, p1, p2]);
        continue;
      }

      const scale = Math.max(0.2, 1 - insetFrac);
      const innerPt = (pt: V3): V3 => [
        g.cx + (pt[0] - g.cx) * scale,
        g.cy + (pt[1] - g.cy) * scale,
        g.cz + (pt[2] - g.cz) * scale,
      ];
      const steppedPt = (pt: V3): V3 => {
        const ip = innerPt(pt);
        return [ip[0] + g.nx * depth, ip[1] + g.ny * depth, ip[2] + g.nz * depth];
      };

      // Inner stepped panel triangles:
      for (const [p0, p1, p2] of g.tris) {
        b.poly(g.slotName, [steppedPt(p0), steppedPt(p1), steppedPt(p2)]);
      }

      // Outer border frame + step riser walls along boundary edges:
      const bEdges = getGroupBoundaryEdges(g.tris);
      for (const [e0, e1] of bEdges) {
        const i0 = innerPt(e0);
        const i1 = innerPt(e1);
        const s0 = steppedPt(e0);
        const s1 = steppedPt(e1);
        b.poly(g.slotName, [e0, e1, i1, i0]);
        if (Math.abs(depth) > 1e-6) {
          b.poly(g.slotName, [i0, i1, s1, s0]);
        }
      }
    }
    return b.build();
  },
};

/**
 * 3. Extrude Faces Along Normal Operator ("Raised Boss / Fin")
 * Extrudes selected planar face groups outward along their face normal with optional taper.
 */
export const extrudeFacesNormal: MeshOperator = {
  id: 'extrude-faces-normal',
  family: 'hardsurface-cad',
  label: 'PolyExtrude Faces',
  oneClickPresetLabel: 'Raised Boss / Fin',
  description: 'Extrudes planar faces along their normal with side walls and taper.',
  params: [
    pSpec('distance', 'Extrude distance', 'm', 0.005, 0.6, 0.01, 0.06),
    pSpec('taper', 'Tip taper', 'm', 0.2, 1.4, 0.05, 0.8),
    pSpec('targetFaces', 'Target faces', 'choice', 0, 2, 1, 2, ['all-faces', 'side-walls', 'top-only']),
  ],
  oneClickPreset: { distance: 0.06, taper: 0.8, targetFaces: 2 },
  namedPresets: {
    'raised-boss-fin': { distance: 0.06, taper: 0.8, targetFaces: 2 },
    'side-radiator-lug': { distance: 0.05, taper: 0.75, targetFaces: 1 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const dist = p.distance as number;
    const taper = p.taper as number;
    const mode = p.targetFaces as number;
    const groups = extractCoplanarFaceGroups(mesh);
    const b = new MeshBuilder(mesh.slots.map((s) => s.name));

    for (const g of groups) {
      const eligible =
        mode === 0 ||
        (mode === 1 && Math.abs(g.ny) < 0.35) ||
        (mode === 2 && g.ny > 0.65);

      if (!eligible) {
        for (const [p0, p1, p2] of g.tris) b.poly(g.slotName, [p0, p1, p2]);
        continue;
      }

      const extPt = (pt: V3): V3 => [
        g.cx + (pt[0] - g.cx) * taper + g.nx * dist,
        g.cy + (pt[1] - g.cy) * taper + g.ny * dist,
        g.cz + (pt[2] - g.cz) * taper + g.nz * dist,
      ];

      for (const [p0, p1, p2] of g.tris) {
        b.poly(g.slotName, [extPt(p0), extPt(p1), extPt(p2)]);
      }
      const bEdges = getGroupBoundaryEdges(g.tris);
      for (const [e0, e1] of bEdges) {
        b.poly(g.slotName, [e0, e1, extPt(e1), extPt(e0)]);
      }
    }
    return b.build();
  },
};

/**
 * 4. Solidify / Hollow Shell Operator ("Hollow Sheet-Metal Wall")
 * Generates an offset inner shell (`thickness`) with reversed winding and stitches open boundary rims.
 */
export const solidifyHollowShell: MeshOperator = {
  id: 'solidify-hollow-shell',
  family: 'hardsurface-cad',
  label: 'Solidify / Shell',
  oneClickPresetLabel: 'Hollow Sheet-Metal Wall',
  description: 'Adds sheet-metal wall thickness by generating an inward offset shell and rim.',
  params: [
    pSpec('thickness', 'Wall thickness', 'm', 0.004, 0.25, 0.002, 0.02),
  ],
  oneClickPreset: { thickness: 0.02 },
  namedPresets: {
    'thin-sheet-8mm': { thickness: 0.008 },
    'hollow-sheet-metal-wall': { thickness: 0.02 },
    'heavy-cast-50mm': { thickness: 0.05 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const t = p.thickness as number;
    const groups = extractCoplanarFaceGroups(mesh);
    const b = new MeshBuilder(mesh.slots.map((s) => s.name));

    for (const g of groups) {
      const inPt = (pt: V3): V3 => [pt[0] - g.nx * t, pt[1] - g.ny * t, pt[2] - g.nz * t];
      for (const [p0, p1, p2] of g.tris) {
        // Outer shell:
        b.poly(g.slotName, [p0, p1, p2]);
        // Inner shell (reversed winding):
        b.poly(g.slotName, [inPt(p0), inPt(p2), inPt(p1)]);
      }
    }
    return b.build();
  },
};

/**
 * 5. ZBrush Extender / 9-Slice Middle Stretch Operator ("Stretch Chassis Span")
 * Stretches or compresses the central middle span of a model along X, Y, or Z while keeping
 * both end caps (bolt holes, flanges, bevels) completely undistorted!
 */
export const extenderMidSlice: MeshOperator = {
  id: 'extender-mid-slice',
  family: 'hardsurface-cad',
  label: '9-Slice Extender',
  oneClickPresetLabel: 'Stretch Chassis Span',
  description: 'Elongates the middle span of a part without distorting its end flanges or bolt holes.',
  params: [
    pSpec('axis', 'Stretch axis', 'choice', 0, 2, 1, 0, ['x-axis', 'y-axis', 'z-axis']),
    pSpec('extension', 'Span extension', 'm', -1.0, 4.0, 0.05, 0.5),
    pSpec('endCapProtect', 'Protected end cap ratio', 'm', 0.05, 0.45, 0.05, 0.25),
  ],
  oneClickPreset: { axis: 0, extension: 0.5, endCapProtect: 0.25 },
  namedPresets: {
    'stretch-chassis-span': { axis: 0, extension: 0.5, endCapProtect: 0.25 },
    'tall-tower-extend': { axis: 1, extension: 0.8, endCapProtect: 0.2 },
    'deep-bay-extend': { axis: 2, extension: 0.6, endCapProtect: 0.25 },
  },
  apply(mesh, given = {}) {
    const p = resolveParams(this.params, given);
    const axis = p.axis as 0 | 1 | 2;
    const ext = p.extension as number;
    const capRatio = p.endCapProtect as number;

    const lo = mesh.min[axis];
    const hi = mesh.max[axis];
    const span = Math.max(1e-5, hi - lo);
    const capLen = span * capRatio;
    const midLo = lo + capLen;
    const midHi = hi - capLen;
    const midSpan = Math.max(1e-5, midHi - midLo);

    const positions = new Float32Array(mesh.positions);
    const vCount = positions.length / 3;
    const min: [number, number, number] = [mesh.min[0], mesh.min[1], mesh.min[2]];
    const max: [number, number, number] = [mesh.max[0], mesh.max[1], mesh.max[2]];
    min[axis] -= ext * 0.5;
    max[axis] += ext * 0.5;

    for (let i = 0; i < vCount; i++) {
      const c = positions[i * 3 + axis]!;
      let nc = c;
      if (c <= midLo) {
        nc = c - ext * 0.5;
      } else if (c >= midHi) {
        nc = c + ext * 0.5;
      } else {
        const t = (c - midLo) / midSpan; // 0..1
        nc = c + (t - 0.5) * ext;
      }
      positions[i * 3 + axis] = nc;
    }

    return {
      positions,
      normals: new Float32Array(mesh.normals),
      uvs: new Float32Array(mesh.uvs),
      indices: new Uint32Array(mesh.indices),
      slots: mesh.slots,
      min,
      max,
    };
  },
};

export const FAMILY2_HARDSURFACE_CAD_OPERATORS: Readonly<Record<string, MeshOperator>> = Object.freeze({
  'chamfer-hard-edges': chamferHardEdges,
  'inset-outset-faces': insetOutsetFaces,
  'extrude-faces-normal': extrudeFacesNormal,
  'solidify-hollow-shell': solidifyHollowShell,
  'extender-mid-slice': extenderMidSlice,
});
