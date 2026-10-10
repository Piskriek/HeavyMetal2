// @hm/rovergear — Vehicle Fabricator and three rovers in the base kit style.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];
export interface Box { min: V3; max: V3 }
export interface Socket { name: string; at: V3 }
export interface Rover {
  body: THREE.Group; wheel: THREE.Group | null; wheelRadius: number; hubs: V3[];
  colliders: Box[]; sockets: Socket[]; lamps: THREE.Mesh[]; parts: Record<string, THREE.Object3D>;
}
export interface Station {
  group: THREE.Group; colliders: Box[]; sockets: Socket[]; lamps: THREE.Mesh[]; parts: Record<string, THREE.Object3D>;
}
export interface LabMaterials {
  gunmetal: THREE.MeshStandardMaterial; darkSteel: THREE.MeshStandardMaterial; paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial; rubber: THREE.MeshStandardMaterial; hazard: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial; glass: THREE.MeshPhysicalMaterial;
}
export interface BuildOptions { stage?: number }

export function createMaterials(): LabMaterials {
  const s = (color: number, metalness: number, roughness: number) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: true });
  return {
    gunmetal: s(0x3a3f46, 0.8, 0.4), darkSteel: s(0x24272c, 0.7, 0.55), paint: s(0x4d6585, 0.5, 0.5),
    copper: s(0xb87333, 0.9, 0.35), rubber: s(0x161616, 0, 0.95), hazard: s(0xe8b020, 0.2, 0.6),
    concrete: s(0x8a8a86, 0, 0.9),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x8fb8d8, metalness: 0, roughness: 0.1, transparent: true, opacity: 0.45, flatShading: true }),
  };
}

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const g = Math.min(1, Math.max(0, glow));
  const mat = lamp.material;
  if (mat instanceof THREE.MeshStandardMaterial) { mat.emissive.setHex(0xffa020); mat.emissiveIntensity = g * 3; }
}

export function triangles(g: THREE.Object3D): number {
  let n = 0;
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const geo = o.geometry as THREE.BufferGeometry;
      n += geo.index ? geo.index.count / 3 : (geo.getAttribute('position')?.count ?? 0) / 3;
    }
  });
  return n;
}

// ---------- geometry kit ----------
const UP = new THREE.Vector3(0, 1, 0);
class Kit {
  private lists = new Map<THREE.Material, THREE.BufferGeometry[]>();
  constructor(public stage: number) {}
  get hi(): boolean { return this.stage >= 4; }
  seg(lo: number, hi: number): number {
    const t = Math.min(1, Math.max(0, (this.stage - 1) / 5));
    return Math.max(3, Math.round((lo + (hi - lo) * t) / 2) * 2);
  }
  add(mat: THREE.Material, geo: THREE.BufferGeometry, m: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m);
    const l = this.lists.get(mat) ?? [];
    l.push(g); this.lists.set(mat, l);
  }
  private mat(pos: V3, rot: V3): THREE.Matrix4 {
    return new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1));
  }
  box(mat: THREE.Material, size: V3, pos: V3, rot: V3 = [0, 0, 0]): void {
    this.add(mat, new THREE.BoxGeometry(...size), this.mat(pos, rot));
  }
  /** cylinder along y unless rotated */
  cyl(mat: THREE.Material, rt: number, rb: number, h: number, seg: number, pos: V3, rot: V3 = [0, 0, 0], open = false): void {
    this.add(mat, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), this.mat(pos, rot));
  }
  /** cylinder along x */
  cylX(mat: THREE.Material, r: number, h: number, seg: number, pos: V3): void {
    this.cyl(mat, r, r, h, seg, pos, [0, 0, Math.PI / 2]);
  }
  tube(mat: THREE.Material, a: V3, b: V3, r: number, seg: number): void {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va), len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
    const m = new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.add(mat, new THREE.CylinderGeometry(r, r, len + r, seg, 1), m);
  }
  meshes(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [mat, list] of this.lists) {
      const g = mergeGeometries(list, false);
      if (!g) throw new Error('merge failed');
      out.push(new THREE.Mesh(g, mat));
    }
    return out;
  }
  group(name: string): THREE.Group {
    const g = new THREE.Group(); g.name = name;
    for (const m of this.meshes()) g.add(m);
    return g;
  }
}

function makeLamp(k: Kit, pos: V3, rot: V3, r = 0.08): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, 0.06, k.seg(6, 16), 1).toNonIndexed();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xffa020, emissiveIntensity: 0.5, flatShading: true }));
  mesh.position.set(...pos); mesh.rotation.set(...rot); mesh.name = 'lamp';
  return mesh;
}

function bboxBox(o: THREE.Object3D): Box {
  const b = new THREE.Box3().setFromObject(o);
  return { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] };
}

function attachLamps(g: THREE.Group, lamps: THREE.Mesh[]): void {
  const host = g.children[0];
  if (!host) throw new Error('empty group');
  for (const l of lamps) host.add(l);
}

// ---------- wheel ----------
function buildWheel(m: LabMaterials, stage: number, r: number, w: number): THREE.Group {
  const k = new Kit(stage);
  const seg = k.seg(8, 24);
  if (stage >= 6) {
    // wire-mesh tyre: open rubber band, crossed wire spokes, hub
    k.cyl(m.rubber, r, r, w, seg, [0, 0, 0], [0, 0, Math.PI / 2], true);
    k.cyl(m.gunmetal, r - 0.03, r - 0.03, w + 0.02, seg, [0, 0, 0], [0, 0, Math.PI / 2], true);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, b = a + Math.PI / n;
      for (const sx of [-1, 1]) {
        const x = sx * w * 0.3;
        k.tube(m.darkSteel, [x * 0.3, Math.sin(a) * 0.1, Math.cos(a) * 0.1], [x, Math.sin(b) * (r - 0.04), Math.cos(b) * (r - 0.04)], 0.012, 4);
      }
    }
    k.cylX(m.gunmetal, 0.12, w * 0.8, 12, [0, 0, 0]);
    k.cylX(m.hazard, 0.06, w * 0.9, 12, [0, 0, 0]);
  } else {
    k.cyl(m.rubber, r, r, w, seg, [0, 0, 0], [0, 0, Math.PI / 2]);
    k.cylX(m.gunmetal, r * 0.6, w + 0.04, k.seg(6, 16), [0, 0, 0]);
    k.cylX(m.hazard, r * 0.2, w + 0.08, k.seg(6, 12), [0, 0, 0]);
  }
  return k.group('wheel');
}

// ---------- scout ----------
export function scout(m: LabMaterials, o: BuildOptions = {}): Rover {
  const stage = o.stage ?? 6, k = new Kit(stage), ts = k.seg(4, 8);
  const R = 0.45;
  // chassis & axles
  k.box(m.paint, [1.0, 0.18, 2.6], [0, 0.05, 0]);
  for (const z of [-1.1, 1.1]) k.cylX(m.darkSteel, 0.06, 1.34, k.seg(6, 10), [0, 0, z]);
  // bumpers
  k.box(m.hazard, [1.1, 0.16, 0.12], [0, 0.08, 1.33]);
  k.box(m.gunmetal, [1.1, 0.16, 0.12], [0, 0.08, -1.33]);
  // seat
  k.box(m.darkSteel, [0.5, 0.14, 0.5], [0, 0.2, -0.1]);
  k.box(m.darkSteel, [0.5, 0.6, 0.12], [0, 0.5, -0.36]);
  // roll cage
  const y0 = 0.12, top = 1.35;
  const posts: V3[] = [[-0.45, y0, 0.55], [0.45, y0, 0.55], [-0.45, y0, -0.75], [0.45, y0, -0.75]];
  for (const p of posts) k.tube(m.gunmetal, p, [p[0] * 0.85, top, p[2] * 0.8], 0.04, ts);
  k.tube(m.gunmetal, [-0.3825, top, 0.44], [0.3825, top, 0.44], 0.04, ts);
  k.tube(m.gunmetal, [-0.3825, top, -0.6], [0.3825, top, -0.6], 0.04, ts);
  k.tube(m.gunmetal, [-0.3825, top, 0.44], [-0.3825, top, -0.6], 0.04, ts);
  k.tube(m.gunmetal, [0.3825, top, 0.44], [0.3825, top, -0.6], 0.04, ts);
  if (k.hi) { k.tube(m.gunmetal, [-0.3825, top, -0.6], [0.45, y0, -0.75], 0.03, ts); k.box(m.hazard, [0.82, 0.06, 0.1], [0, top, 0.44]); }
  // tool rack at back
  k.box(m.darkSteel, [0.8, 0.05, 0.4], [0, 0.17, -1.05]);
  for (const x of [-0.38, 0.38]) k.box(m.darkSteel, [0.04, 0.3, 0.4], [x, 0.3, -1.05]);
  k.box(m.copper, [0.3, 0.16, 0.2], [0, 0.27, -1.05]);
  // headlamp housings on front bumper
  for (const x of [-0.3, 0.3]) k.box(m.gunmetal, [0.2, 0.2, 0.1], [x, 0.24, 1.33]);
  // antenna
  k.cyl(m.darkSteel, 0.05, 0.05, 0.06, 6, [0.42, 0.17, -1.2]);
  k.cyl(m.copper, 0.008, 0.012, 1.2, k.seg(4, 6), [0.42, 0.79, -1.2]);
  const body = k.group('scout');
  const lamps = [makeLamp(k, [-0.3, 0.24, 1.4], [Math.PI / 2, 0, 0]), makeLamp(k, [0.3, 0.24, 1.4], [Math.PI / 2, 0, 0])];
  attachLamps(body, lamps);
  return {
    body, wheel: buildWheel(m, stage, R, 0.3), wheelRadius: R,
    hubs: [[-0.8, 0, 1.1], [0.8, 0, 1.1], [-0.8, 0, -1.1], [0.8, 0, -1.1]],
    colliders: [bboxBox(body)], sockets: [{ name: 'seat', at: [0, 0.27, -0.1] }], lamps, parts: {},
  };
}

// ---------- link dish ----------
function dish(k: Kit, m: LabMaterials, base: V3): V3 {
  const [x, y, z] = base;
  k.cyl(m.gunmetal, 0.06, 0.08, 0.5, k.seg(6, 12), [x, y + 0.25, z]);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    k.box(m.darkSteel, [0.02, 0.2, 0.12], [x + Math.sin(a) * 0.1, y + 0.1, z + Math.cos(a) * 0.1], [0, a, 0]);
  }
  k.cyl(m.paint, 0.45, 0.06, 0.18, k.seg(8, 20), [x, y + 0.58, z]);
  k.cyl(m.copper, 0.02, 0.02, 0.3, 6, [x, y + 0.75, z]);
  return [x, y + 0.9, z];
}

// ---------- hauler ----------
export function hauler(m: LabMaterials, o: BuildOptions = {}): Rover {
  const stage = o.stage ?? 6, k = new Kit(stage);
  const R = 0.55;
  k.box(m.darkSteel, [1.5, 0.25, 5.8], [0, 0.1, 0]);
  for (const z of [1.8, -0.6, -1.8]) k.cylX(m.gunmetal, 0.08, 1.64, k.seg(6, 10), [0, 0, z]);
  // cab
  k.box(m.paint, [1.9, 1.5, 1.6], [0, 1.0, 2.05]);
  k.box(m.glass, [1.7, 0.6, 0.1], [0, 1.35, 2.86]);
  if (k.hi) for (const s of [-1, 1]) k.box(m.glass, [0.1, 0.5, 0.9], [s * 0.96, 1.35, 2.1]);
  k.box(m.hazard, [1.94, 0.12, 0.2], [0, 0.4, 2.85]);
  k.box(m.gunmetal, [1.92, 0.1, 1.62], [0, 1.78, 2.05]);
  // flat bed
  k.box(m.paint, [2.0, 0.12, 4.0], [0, 0.28, -0.9]);
  k.box(m.hazard, [2.02, 0.1, 0.1], [0, 0.31, -2.85]);
  // bolted storage bin
  k.box(m.gunmetal, [1.2, 0.8, 1.2], [0, 0.73, -0.3]);
  if (k.hi) for (const x of [-0.55, 0.55]) for (const zz of [-0.85, 0.25]) k.cyl(m.copper, 0.04, 0.04, 0.06, 6, [x, 0.36, zz]);
  const dishTop = dish(k, m, [0, 1.13, -0.3]);
  // tow hitch
  k.box(m.darkSteel, [0.2, 0.15, 0.3], [0, 0.0, -3.0]);
  k.cyl(m.gunmetal, 0.07, 0.07, 0.25, k.seg(6, 12), [0, 0.0, -3.12]);
  // side steps
  for (const s of [-1, 1]) {
    k.box(m.darkSteel, [0.06, 0.4, 0.06], [s * 0.74, -0.08, 0.95]);
    k.box(m.hazard, [0.35, 0.06, 0.4], [s * 0.9, -0.3, 0.95]);
  }
  // lamp housings
  for (const x of [-0.7, 0.7]) k.box(m.gunmetal, [0.25, 0.22, 0.08], [x, 0.7, 2.88]);
  const body = k.group('hauler');
  const lamps = [makeLamp(k, [-0.7, 0.7, 2.94], [Math.PI / 2, 0, 0]), makeLamp(k, [0.7, 0.7, 2.94], [Math.PI / 2, 0, 0])];
  attachLamps(body, lamps);
  const hubs: V3[] = [];
  for (const z of [1.8, -0.6, -1.8]) for (const x of [-1.0, 1.0]) hubs.push([x, 0, z]);
  return {
    body, wheel: buildWheel(m, stage, R, 0.4), wheelRadius: R, hubs,
    colliders: [bboxBox(body)],
    sockets: [{ name: 'seat', at: [-0.45, 0.6, 1.9] }, { name: 'seat', at: [0.45, 0.6, 1.9] }, { name: 'dish', at: dishTop }],
    lamps, parts: {},
  };
}

// ---------- crawler ----------
export function crawler(m: LabMaterials, o: BuildOptions = {}): Rover {
  const stage = o.stage ?? 6, k = new Kit(stage), ws = k.seg(8, 16);
  // track units
  const nRoad = k.hi ? 6 : 4;
  for (const s of [-1, 1]) {
    const x = s * 1.3;
    k.box(m.rubber, [0.6, 0.9, 6.0], [x, -0.15, 0]);
    k.cylX(m.rubber, 0.45, 0.6, ws, [x, -0.15, 3.0]);
    k.cylX(m.rubber, 0.45, 0.6, ws, [x, -0.15, -3.0]);
    for (let i = 0; i < nRoad; i++) {
      const z = -2.5 + (5 * i) / (nRoad - 1);
      k.cylX(m.gunmetal, 0.3, 0.64, ws, [x, -0.25, z]);
    }
    k.box(m.paint, [0.7, 0.08, 6.2], [x, 0.33, 0]);
  }
  // hull
  k.box(m.darkSteel, [2.1, 0.9, 6.0], [0, 0.2, 0]);
  k.box(m.hazard, [2.14, 0.15, 0.2], [0, 0.4, 3.0]);
  // armoured cab
  k.box(m.paint, [1.8, 1.1, 1.8], [0, 1.2, 1.7]);
  k.box(m.glass, [1.5, 0.4, 0.1], [0, 1.4, 2.62]);
  k.box(m.gunmetal, [1.84, 0.12, 1.84], [0, 1.78, 1.7]);
  // heat-sink spine
  k.box(m.gunmetal, [0.3, 0.3, 3.4], [0, 0.75, -1.2]);
  const nf = k.hi ? 14 : 5;
  for (let i = 0; i < nf; i++) k.box(m.copper, [0.9, 0.35, 0.05], [0, 0.95, -2.7 + (3 * i) / (nf - 1)]);
  // sensor mast
  k.cyl(m.gunmetal, 0.06, 0.08, 1.2, k.seg(6, 12), [0.6, 2.4, 1.3]);
  k.box(m.darkSteel, [0.35, 0.2, 0.2], [0.6, 3.05, 1.3]);
  // arm hinge bracket
  k.box(m.darkSteel, [0.8, 0.4, 0.3], [0, 0.4, 3.1]);
  for (const x of [-0.7, 0.7]) k.box(m.gunmetal, [0.25, 0.2, 0.08], [x, 0.4, 3.12]);
  const body = k.group('crawler');
  const lamps = [makeLamp(k, [-0.7, 0.4, 3.18], [Math.PI / 2, 0, 0]), makeLamp(k, [0.7, 0.4, 3.18], [Math.PI / 2, 0, 0])];
  attachLamps(body, lamps);
  // folding beam-drill arm
  const a = new Kit(stage);
  a.cylX(m.gunmetal, 0.12, 0.6, a.seg(6, 16), [0, 0, 0]);
  a.box(m.paint, [0.25, 0.25, 0.66], [0, 0, 0.38]);
  a.box(m.hazard, [0.27, 0.27, 0.12], [0, 0, 0.46]);
  a.cyl(m.darkSteel, 0.12, 0.04, 0.4, a.seg(6, 16), [0, 0, 0.91], [Math.PI / 2, 0, 0]);
  const arm = a.group('arm');
  arm.position.set(0, 0.4, 3.35);
  body.add(arm);
  return {
    body, wheel: null, wheelRadius: 0.45, hubs: [],
    colliders: [bboxBox(body)],
    sockets: [{ name: 'seat', at: [0, 1.0, 1.6] }, { name: 'drill', at: [0, 0.4, 4.46] }, { name: 'mast', at: [0.6, 3.15, 1.3] }],
    lamps, parts: { arm },
  };
}

// ---------- fabricator ----------
export function fabricator(m: LabMaterials, o: BuildOptions = {}): Station {
  const stage = o.stage ?? 6, k = new Kit(stage);
  k.box(m.concrete, [6.4, 0.3, 5.0], [0, 0.15, 0]);
  k.box(m.darkSteel, [4.5, 0.4, 3.0], [0, 0.5, 0]);
  if (k.hi) k.box(m.hazard, [4.6, 0.08, 3.1], [0, 0.4, 0]);
  for (const s of [-1, 1]) {
    k.box(m.paint, [0.4, 4.6, 0.6], [s * 2.7, 2.55, 0]);
    k.box(m.gunmetal, [0.8, 0.2, 1.2], [s * 2.7, 0.4, 0]);
    k.box(m.hazard, [0.44, 0.3, 0.64], [s * 2.7, 1.2, 0]);
    k.cyl(m.copper, 0.08, 0.08, 0.15, k.seg(6, 12), [s * 2.7, 1.8, -0.36], [Math.PI / 2, 0, 0]);
    k.cyl(m.gunmetal, 0.12, 0.12, 0.1, 6, [s * 2.7, 4.95, 0]);
  }
  k.box(m.paint, [5.8, 0.5, 0.5], [0, 4.75, 0]);
  // console at corner
  k.box(m.gunmetal, [0.7, 1.1, 0.5], [2.6, 0.85, 2.0]);
  k.box(m.glass, [0.5, 0.3, 0.05], [2.6, 1.15, 2.26]);
  // power junction
  k.box(m.darkSteel, [0.6, 0.5, 0.3], [-2.4, 0.55, -2.3]);
  k.cyl(m.copper, 0.1, 0.1, 0.2, k.seg(6, 12), [-2.4, 0.55, -2.5], [Math.PI / 2, 0, 0]);
  const group = k.group('fabricator');
  const lamps = [makeLamp(k, [-2.7, 5.03, 0], [0, 0, 0], 0.1), makeLamp(k, [2.7, 5.03, 0], [0, 0, 0], 0.1)];
  attachLamps(group, lamps);
  const h = new Kit(stage);
  h.box(m.gunmetal, [0.6, 0.7, 0.7], [0, 0, 0]);
  h.cyl(m.copper, 0.1, 0.03, 0.6, h.seg(6, 16), [0, -0.6, 0]);
  h.box(m.hazard, [0.62, 0.1, 0.72], [0, 0.2, 0]);
  const head = h.group('head');
  head.position.set(0, 4.75, 0);
  group.add(head);
  return {
    group, colliders: [bboxBox(group)],
    sockets: [{ name: 'bed', at: [0, 0.7, 0] }, { name: 'power', at: [-2.4, 0.55, -2.6] }],
    lamps, parts: { head },
  };
}
