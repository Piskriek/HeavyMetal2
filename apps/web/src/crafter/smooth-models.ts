// Smooth models (STATUS D12): small voxel models, meshed into smooth surfaces by @hm/smoothvox, then handed to three.js.
// Boulders take their colour from the ground's cartridge (the rock shader maps it on); trees keep the palette's colours.
// Meshing is slow (a 36-voxel palm takes half a second on the low-end laptop), so each model is built once per visit to
// the page, behind the loading bar, and kept.
import * as THREE from 'three';
import { createModel, ellipsoid, line, cylinder, sphere, speckle, weld, MODELS, type Entry, type Model } from '@hm/voxelart';
import { meshModel, type Mesh, type VModel } from '@hm/smoothvox';
import { hash } from './moon';

export type SmoothId = 'boulder0' | 'boulder1' | 'boulder2' | 'broadleaf' | 'conifer' | 'palm' | 'goblin';
/** The planet's models (the goblin is built only where one stands: the lab). */
export const SMOOTH_IDS: readonly SmoothId[] = ['boulder0', 'boulder1', 'boulder2', 'broadleaf', 'conifer', 'palm'];

/** Metres per voxel: a boulder is about 1.5 m across before its own size scales it; the trees stand 9 to 11 m; a goblin 1.3 m. */
const METRES: Readonly<Record<SmoothId, number>> = { boulder0: 1 / 12, boulder1: 1 / 12, boulder2: 1 / 12, broadleaf: 0.32, conifer: 0.3, palm: 0.26, goblin: 0.03 };

const entry = (name: string, r: number, g: number, b: number, roughness = 0.9): Entry => ({ name, color: [r, g, b], roughness, metalness: 0, emissive: 0, alpha: 1 });

/** A lumpy boulder: a few overlapping ellipsoids round a core, flat underneath where it rests. */
export function boulderModel(seed: number): Model {
  const m = createModel(`boulder${seed}`, 'Boulder', [20, 15, 20], [10, 0, 10], [entry('rock', 0.5, 0.5, 0.5)]);
  const squash = 0.62 + hash(seed, 9, 5) * 0.25;
  ellipsoid(m, [10, 5.5, 10], [7.5, 7.5 * squash, 6.5], 1);
  for (let k = 0; k < 5; k++) {
    const a = hash(seed, k, 1) * Math.PI * 2, r = 2.5 + hash(seed, k, 2) * 2.5;
    ellipsoid(m, [10 + Math.cos(a) * r, 4 + hash(seed, k, 3) * 4, 10 + Math.sin(a) * r], [3 + hash(seed, k, 4) * 2.5, 2.5 + hash(seed, k, 5) * 2, 3 + hash(seed, k, 6) * 2.5], 1);
  }
  // a chip or two knocked off
  for (let k = 0; k < 2; k++) {
    const a = hash(seed, k, 7) * Math.PI * 2;
    sphere(m, [10 + Math.cos(a) * 9, 7 + hash(seed, k, 8) * 4, 10 + Math.sin(a) * 9], 3.5, 0);
  }
  for (let z = 0; z < 20; z++) for (let x = 0; x < 20; x++) m.cells[x + 20 * 0 + 300 * z] = 0;
  return m;
}

/** A broad-leaved tree: a trunk that forks, and a crown of leaf clouds in two greens. */
export function broadleafModel(): Model {
  const m = createModel('broadleaf', 'Broadleaf tree', [26, 34, 26], [13, 0, 13],
    [entry('bark', 0.29, 0.21, 0.15), entry('leaf', 0.2, 0.42, 0.14, 0.8), entry('leaf light', 0.36, 0.56, 0.2, 0.8)]);
  cylinder(m, [13, 0, 13], 1.8, 12, 1);
  line(m, [13, 10, 13], [8, 19, 11], 1, 2);
  line(m, [13, 10, 13], [18, 20, 15], 1, 2);
  line(m, [13, 11, 13], [13, 22, 9], 1, 2);
  const clouds: [number, number, number, number][] = [[13, 24, 13, 8], [7, 21, 11, 5.5], [19, 21, 15, 5.5], [13, 22, 8, 5], [12, 28, 14, 5.5], [16, 25, 18, 4.5]];
  for (const [x, y, z, r] of clouds) ellipsoid(m, [x, y, z], [r, r * 0.8, r], 2);
  speckle(m, 7, 3, 0.35, 2);
  return m;
}

/** A conifer: a straight trunk under tiers of dark needles, narrowing to the top. */
export function coniferModel(): Model {
  const m = createModel('conifer', 'Conifer', [20, 36, 20], [10, 0, 10],
    [entry('bark', 0.27, 0.19, 0.13), entry('needles', 0.1, 0.27, 0.16, 0.85), entry('needles light', 0.16, 0.36, 0.2, 0.85)]);
  cylinder(m, [10, 0, 10], 1.3, 30, 1);
  for (let t = 0; t < 6; t++) {
    const r = 8.5 - t * 1.25;
    ellipsoid(m, [10, 8 + t * 4.4, 10], [r, 2.6, r], 2);
  }
  sphere(m, [10, 33, 10], 1.6, 2);
  speckle(m, 11, 3, 0.25, 2);
  return m;
}

function toVModel(m: Model): VModel {
  return { size: m.size, pivot: m.pivot, palette: m.palette.map((e) => ({ color: e.color, alpha: e.alpha, roughness: e.roughness, metalness: e.metalness, emissive: e.emissive })), cells: m.cells };
}

function voxelsOf(id: SmoothId): Model {
  if (id === 'broadleaf') return broadleafModel();
  if (id === 'conifer') return coniferModel();
  if (id === 'palm' || id === 'goblin') return weld(MODELS.find((x) => x.id === id)!.build());
  return boulderModel(Number(id.slice(-1)));
}

/** The model at half the voxels (for far away): a cell is solid when most of its eight is, in their commonest colour. */
export function halve(m: Model): Model {
  const [sx, sy, sz] = m.size, h = createModel(m.id, m.name, [Math.ceil(sx / 2), Math.ceil(sy / 2), Math.ceil(sz / 2)], [m.pivot[0] / 2, m.pivot[1] / 2, m.pivot[2] / 2], m.palette);
  const [hx, hy, hz] = h.size, votes = new Map<number, number>();
  for (let z = 0; z < hz; z++) for (let y = 0; y < hy; y++) for (let x = 0; x < hx; x++) {
    votes.clear();
    let solid = 0;
    for (let c = 0; c < 8; c++) {
      const X = x * 2 + (c & 1), Y = y * 2 + ((c >> 1) & 1), Z = z * 2 + (c >> 2);
      const v = X < sx && Y < sy && Z < sz ? m.cells[X + sx * (Y + sy * Z)]! : 0;
      if (v) { solid++; votes.set(v, (votes.get(v) ?? 0) + 1); }
    }
    // thin parts (fronds, branches) keep a voxel when even two of the eight are solid
    if (solid < 2) continue;
    let best = 0, most = 0;
    for (const [v, n] of votes) if (n > most) { most = n; best = v; }
    h.cells[x + hx * (y + hy * z)] = best;
  }
  return h;
}

/** The meshes of a model, near, far and tiny (a quarter of the voxels, for the horizon), in metres (pure: no three.js). */
export function meshSmooth(id: SmoothId): { near: Mesh; far: Mesh; tiny: Mesh } {
  const voxels = voxelsOf(id), options = { scale: 1, blur: 0.9, preserveThin: true, smoothIterations: 2 } as const;
  const half = halve(voxels);
  const near = meshModel(toVModel(voxels), options), far = meshModel(toVModel(half), { ...options, blur: 0.6 });
  const tiny = meshModel(toVModel(halve(half)), { ...options, blur: 0.5, smoothIterations: 1 });
  const k = METRES[id];
  for (const [mesh, s] of [[near, k], [far, k * 2], [tiny, k * 4]] as const) for (let i = 0; i < mesh.positions.length; i++) mesh.positions[i] = mesh.positions[i]! * s;
  return { near, far, tiny };
}

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** A mesh as a three.js geometry: colours (linear, the voxel shading baked in) as `color`, their brightness as `aAo`. */
export function toGeometry(mesh: Mesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), count = mesh.positions.length / 3;
  const colour = new Float32Array(count * 3), ao = new Float32Array(count);
  for (let v = 0; v < count; v++) {
    for (let c = 0; c < 3; c++) colour[v * 3 + c] = toLinear(mesh.colors[v * 4 + c] ?? 1);
    ao[v] = Math.min(1, (mesh.colors[v * 4] ?? 1) * 0.3 + (mesh.colors[v * 4 + 1] ?? 1) * 0.59 + (mesh.colors[v * 4 + 2] ?? 1) * 0.11) / 0.5;
  }
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  g.setAttribute('aAo', new THREE.BufferAttribute(ao, 1));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  g.computeBoundingSphere();
  return g;
}

export interface SmoothModel { readonly near: THREE.BufferGeometry; readonly far: THREE.BufferGeometry; readonly tiny: THREE.BufferGeometry }
const built = new Map<SmoothId, SmoothModel>();

/** A model's geometries, meshing it the first time it is asked for. */
export function smoothModel(id: SmoothId): SmoothModel {
  let hit = built.get(id);
  if (!hit) { const { near, far, tiny } = meshSmooth(id); hit = { near: toGeometry(near), far: toGeometry(far), tiny: toGeometry(tiny) }; built.set(id, hit); }
  return hit;
}

/** True once every model is built (the loading bar's last step). */
export function smoothReady(): boolean { return SMOOTH_IDS.every((id) => built.has(id)); }
