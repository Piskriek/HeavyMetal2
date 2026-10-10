import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export interface Box { min: [number, number, number]; max: [number, number, number] }
export interface Socket { name: string; at: [number, number, number] }
export interface Gear { group: THREE.Group; colliders: Box[]; sockets: Socket[]; lamps: THREE.Mesh[] }
export interface GearOptions { stage?: number }
export interface LabMaterials {
  gunmetal: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  hazard: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
}

type V3 = [number, number, number];
type MatKey = keyof LabMaterials;
type Lod = 0 | 1 | 2;

// ---------------------------------------------------------------------------
// Materials and lamps
// ---------------------------------------------------------------------------
export function createMaterials(): LabMaterials {
  const std = (color: number, metalness: number, roughness: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  return {
    gunmetal: std(0x5c646d, 0.85, 0.42),
    darkSteel: std(0x2a2e34, 0.9, 0.55),
    paint: std(0xcfd6d0, 0.15, 0.5),
    copper: std(0xb8703a, 1.0, 0.32),
    rubber: std(0x131315, 0.0, 0.95),
    hazard: std(0xf0b322, 0.25, 0.6),
    concrete: std(0x9b9a92, 0.0, 0.95),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fd0e6, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.45 }),
  };
}

const lampColors = new WeakMap<THREE.Mesh, THREE.Color>();

/** Set lamp emissive strength, glow in 0..1 (0 = dark, 1 = full colour). */
export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material;
  if (Array.isArray(mat) || !(mat instanceof THREE.MeshStandardMaterial)) return;
  const base = lampColors.get(lamp) ?? mat.color;
  const g = Math.min(1, Math.max(0, glow));
  mat.emissive.copy(base).multiplyScalar(g);
  mat.emissiveIntensity = 1;
}

export function triangles(g: Gear): number {
  let n = 0;
  g.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const geo = o.geometry;
      n += geo.index ? geo.index.count / 3 : geo.getAttribute('position').count / 3;
    }
  });
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------
function hash(i: number, j = 0): number {
  const x = Math.sin(i * 127.1 + j * 311.7 + 1.37) * 43758.5453;
  return x - Math.floor(x);
}

function lodOf(stage: number | undefined): Lod {
  const s = stage ?? 6;
  return s <= 1 ? 0 : s <= 3 ? 1 : 2;
}

function tf(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  );
}

/** Non-indexed, exactly position/normal/uv, no groups: safe for mergeGeometries. */
function prep(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src;
  if (g !== src) src.dispose();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) {
    const n = g.getAttribute('position').count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  g.clearGroups();
  return g;
}

function place(geo: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = prep(geo);
  g.applyMatrix4(m);
  return g;
}

/** Reverse winding and negate normals of a non-indexed geometry (inside faces). */
function flip(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = prep(src);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i += 3) {
    const a = i + 1, b = i + 2;
    const px = pos.getX(a), py = pos.getY(a), pz = pos.getZ(a);
    pos.setXYZ(a, pos.getX(b), pos.getY(b), pos.getZ(b));
    pos.setXYZ(b, px, py, pz);
    const nx = nor.getX(a), ny = nor.getY(a), nz = nor.getZ(a);
    nor.setXYZ(a, nor.getX(b), nor.getY(b), nor.getZ(b));
    nor.setXYZ(b, nx, ny, nz);
    const ux = uv.getX(a), uy = uv.getY(a);
    uv.setXY(a, uv.getX(b), uv.getY(b));
    uv.setXY(b, ux, uy);
  }
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  return g;
}

/** Box with chamfered vertical edges (octagonal prism), centred on origin. */
function chamferBox(w: number, h: number, d: number, c: number): THREE.BufferGeometry {
  const hw = w / 2, hd = d / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + c, -hd); s.lineTo(hw - c, -hd); s.lineTo(hw, -hd + c); s.lineTo(hw, hd - c);
  s.lineTo(hw - c, hd); s.lineTo(-hw + c, hd); s.lineTo(-hw, hd - c); s.lineTo(-hw, -hd + c);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  return g;
}

function tube(pts: V3[], r: number, tubular: number, radial: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.5);
  return new THREE.TubeGeometry(curve, tubular, r, radial, false);
}

/** Lumpy ore heap: a displaced grid, flat edges so they sink into the hopper walls. */
function heap(size: number, n: number, peak: number, rubble: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(size, size, n, n);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.min(1, Math.sqrt(x * x + z * z) / (size * 0.5));
    const dome = Math.max(0, 1 - d * d);
    const edge = Math.min(1, Math.max(0, (0.92 - Math.max(Math.abs(x), Math.abs(z)) / (size * 0.5)) * 8));
    pos.setY(i, (peak * dome + rubble * hash(i, seed) * dome) * edge);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// Parts builder: collects geometry per material, merges at the end
// ---------------------------------------------------------------------------
class Parts {
  private readonly geos = new Map<MatKey, THREE.BufferGeometry[]>();
  private readonly extras: THREE.Mesh[] = [];
  readonly lamps: THREE.Mesh[] = [];
  readonly sockets: Socket[] = [];
  readonly colliders: Box[] = [];
  readonly seg: number;
  constructor(readonly mats: LabMaterials, readonly lod: Lod) {
    this.seg = lod === 0 ? 8 : lod === 1 ? 14 : 24;
  }

  add(key: MatKey, geo: THREE.BufferGeometry, m?: THREE.Matrix4): void {
    const g = prep(geo);
    if (m) g.applyMatrix4(m);
    const list = this.geos.get(key);
    if (list) list.push(g); else this.geos.set(key, [g]);
  }

  box(key: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void {
    this.add(key, new THREE.BoxGeometry(w, h, d), tf(x, y, z, rx, ry, rz));
  }

  cyl(key: MatKey, rt: number, rb: number, h: number, x: number, y: number, z: number, seg = this.seg, rx = 0, ry = 0, rz = 0, open = false): void {
    this.add(key, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), tf(x, y, z, rx, ry, rz));
  }

  sphere(key: MatKey, r: number, x: number, y: number, z: number, seg = this.seg): void {
    this.add(key, new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1)), tf(x, y, z));
  }

  /** Hollow ring with real inner wall: top/bottom annuli plus outer and inner shells. */
  ring(key: MatKey, rIn: number, rOut: number, h: number, x: number, y: number, z: number, seg = this.seg, ry = 0): void {
    const top = new THREE.RingGeometry(rIn, rOut, seg); top.rotateX(-Math.PI / 2); top.translate(0, h / 2, 0);
    const bot = new THREE.RingGeometry(rIn, rOut, seg); bot.rotateX(Math.PI / 2); bot.translate(0, -h / 2, 0);
    this.add(key, top, tf(x, y, z, 0, ry));
    this.add(key, bot, tf(x, y, z, 0, ry));
    this.add(key, new THREE.CylinderGeometry(rOut, rOut, h, seg, 1, true), tf(x, y, z, 0, ry));
    this.add(key, flip(new THREE.CylinderGeometry(rIn, rIn, h, seg, 1, true)), tf(x, y, z, 0, ry));
  }

  /** Square-section bar from a to b (ends sink into whatever they join). */
  bar(key: MatKey, a: V3, b: V3, t: number, t2 = t): void {
    const va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    if (len <= 1e-6) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const m = new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.add(key, new THREE.BoxGeometry(t, len, t2), m);
  }

  /** Round rod from a to b. */
  rod(key: MatKey, a: V3, b: V3, r: number, seg = 6, open = false): void {
    const va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    if (len <= 1e-6) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const m = new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.add(key, new THREE.CylinderGeometry(r, r, len, seg, 1, open), m);
  }

  /** Hex bolt head sitting on a surface at (x,y,z), pointing along dir, sunk 0.01. */
  boltDir(x: number, y: number, z: number, r: number, dir: V3, key: MatKey = 'darkSteel'): void {
    const h = r * 1.1, off = h / 2 - 0.01;
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    const pos = new THREE.Vector3(x, y, z).addScaledVector(d, off);
    const m = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1));
    this.add(key, new THREE.CylinderGeometry(r, r, h, 6, 1, false), m);
  }

  bolt(x: number, y: number, z: number, r: number, dir: 'y' | '+x' | '-x' | '+z' | '-z' = 'y', key: MatKey = 'darkSteel'): void {
    const v: V3 = dir === 'y' ? [0, 1, 0] : dir === '+x' ? [1, 0, 0] : dir === '-x' ? [-1, 0, 0] : dir === '+z' ? [0, 0, 1] : [0, 0, -1];
    this.boltDir(x, y, z, r, v, key);
  }

  lamp(color: number, geos: THREE.BufferGeometry[]): THREE.Mesh {
    const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
    const col = new THREE.Color(color);
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col.clone(), emissiveIntensity: 1, roughness: 0.35, metalness: 0 });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = 'lamp';
    lampColors.set(mesh, col.clone());
    this.lamps.push(mesh);
    return mesh;
  }

  /** Extra coloured solid (e.g. a cable) that is not a lamp. */
  solid(color: number, geos: THREE.BufferGeometry[], name = 'solid'): void {
    const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 }));
    mesh.name = name;
    this.extras.push(mesh);
  }

  socket(name: string, at: V3): void { this.sockets.push({ name, at }); }
  collider(min: V3, max: V3): void { this.colliders.push({ min, max }); }

  gear(): Gear {
    const group = new THREE.Group();
    for (const [key, list] of this.geos) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this.mats[key]);
      mesh.name = key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const e of this.extras) group.add(e);
    for (const l of this.lamps) group.add(l);
    return { group, colliders: this.colliders, sockets: this.sockets, lamps: this.lamps };
  }
}

/** Ribbed floor cable cover running along +x (axis 'x') or +z (axis 'z'), from a to b at lane. */
function cableCover(p: Parts, axis: 'x' | 'z', a: number, b: number, lane: number): void {
  const len = b - a, mid = (a + b) / 2, H = 0.14, W = 0.4;
  const px = (u: number, v: number): [number, number] => (axis === 'x' ? [u, v] : [v, u]);
  const [cx, cz] = px(mid, lane);
  p.box('darkSteel', axis === 'x' ? len : W, H, axis === 'x' ? W : len, cx, H / 2, cz);
  // entry boss where the cable drops in
  const [bx, bz] = px(a + 0.16, lane);
  p.box('darkSteel', axis === 'x' ? 0.32 : 0.3, 0.1, axis === 'x' ? 0.3 : 0.32, bx, H + 0.03, bz);
  if (p.lod >= 1) {
    const step = p.lod === 2 ? 0.16 : 0.26;
    for (let u = a + 0.45; u < b - 0.08; u += step) {
      const [rx, rz] = px(u, lane);
      p.box('darkSteel', axis === 'x' ? 0.07 : W + 0.04, 0.03, axis === 'x' ? W + 0.04 : 0.07, rx, H + 0.005, rz);
    }
    // hazard end plate at the pad edge
    const [ex, ez] = px(b - 0.05, lane);
    p.box('hazard', axis === 'x' ? 0.1 : W + 0.02, 0.03, axis === 'x' ? W + 0.02 : 0.1, ex, H + 0.005, ez);
  }
}

// ---------------------------------------------------------------------------
// hardpoint: heavy-machine socket on a 2x2 pad (0..8 in x,z)
// ---------------------------------------------------------------------------
export function hardpoint(m: LabMaterials, o: GearOptions = {}): Gear {
  const p = new Parts(m, lodOf(o.stage));
  const L = p.lod, S = p.seg, cx = 4, cz = 4;

  // anchor plate, flange, body, hazard band, top ring, centre boss
  p.add('darkSteel', chamferBox(3.4, 0.05, 3.4, 0.25), tf(cx, 0.025, cz));
  p.cyl('darkSteel', 1.5, 1.5, 0.14, cx, 0.04 + 0.07, cz, S);
  p.cyl('gunmetal', 1.3, 1.3, 0.46, cx, 0.16 + 0.23, cz, S);
  p.cyl('hazard', 1.315, 1.315, 0.1, cx, 0.3, cz, S, 0, 0, 0, true);
  p.ring('darkSteel', 1.0, 1.25, 0.12, cx, 0.66, cz, S);
  p.cyl('gunmetal', 0.35, 0.35, 0.08, cx, 0.64, cz, S);
  if (L >= 1) {
    const n = L === 2 ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      p.bolt(cx + Math.sin(a) * 1.4, 0.18, cz + Math.cos(a) * 1.4, 0.05);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      p.bolt(cx + Math.sin(a) * 0.22, 0.68, cz + Math.cos(a) * 0.22, 0.03);
    }
    // radial bolts on the ring's outer wall
    const rn = L === 2 ? 12 : 6;
    for (let i = 0; i < rn; i++) {
      const a = (i / rn) * Math.PI * 2 + 0.1;
      p.boltDir(cx + Math.sin(a) * 1.25, 0.66, cz + Math.cos(a) * 1.25, 0.03, [Math.sin(a), 0, Math.cos(a)]);
    }
    // vertical seam strips on the body
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      p.box('darkSteel', 0.05, 0.3, 0.02, cx + Math.sin(a) * 1.3, 0.46, cz + Math.cos(a) * 1.3, 0, a, 0);
    }
  }

  // glands + cables: orange leaves along +x, green along +z
  const cableSeg: [number, number] = L === 0 ? [6, 5] : L === 1 ? [10, 7] : [16, 10];
  const gland = (x: number, z: number, axis: 'x' | 'z'): void => {
    const rz = axis === 'x' ? -Math.PI / 2 : 0, rx = axis === 'z' ? Math.PI / 2 : 0;
    p.cyl('darkSteel', 0.1, 0.1, 0.3, x, 0.34, z, L === 0 ? 8 : 12, rx, 0, rz);
    p.cyl('rubber', 0.08, 0.08, 0.1, x + (axis === 'x' ? 0.19 : 0), 0.34, z + (axis === 'z' ? 0.19 : 0), L === 0 ? 8 : 12, rx, 0, rz);
    if (L >= 1) p.cyl('darkSteel', 0.13, 0.13, 0.08, x + (axis === 'x' ? 0.06 : 0), 0.34, z + (axis === 'z' ? 0.06 : 0), 6, rx, 0, rz);
  };
  const zo = cz - 0.45, xo = cx + 0.45;
  gland(5.32, zo, 'x');
  gland(xo, 5.32, 'z');
  const orange = tube([[5.45, 0.34, zo], [5.8, 0.3, zo], [6.05, 0.17, zo], [6.2, 0.08, zo]], 0.06, cableSeg[0], cableSeg[1]);
  const green = tube([[xo, 0.34, 5.45], [xo, 0.3, 5.8], [xo, 0.17, 6.05], [xo, 0.08, 6.2]], 0.06, cableSeg[0], cableSeg[1]);
  p.solid(0xe8641a, [prep(orange)], 'cableOrange');
  p.solid(0x2ea84a, [prep(green)], 'cableGreen');
  cableCover(p, 'x', 6.0, 8.0, zo);
  cableCover(p, 'z', 6.0, 8.0, xo);

  p.socket('mount', [cx, 0.72, cz]);
  p.socket('power', [8, 0.07, zo]);
  p.socket('power2', [xo, 0.07, 8]);
  p.collider([cx - 1.7, 0, cz - 1.7], [cx + 1.7, 0.72, cz + 1.7]);
  p.collider([6.0, 0, zo - 0.22], [8, 0.2, zo + 0.22]);
  p.collider([xo - 0.22, 0, 6.0], [xo + 0.22, 0.2, 8]);
  return p.gear();
}

// ---------------------------------------------------------------------------
// heavyMill: origin = hardpoint ring top centre
// ---------------------------------------------------------------------------
export function heavyMill(m: LabMaterials, o: GearOptions = {}): Gear {
  const p = new Parts(m, lodOf(o.stage));
  const L = p.lod;
  const HW = 1.6, Y0 = 0.4, Y1 = 3.9; // body half width, bottom, top

  // base plate + feet
  p.add('darkSteel', chamferBox(3.0, 0.1, 3.0, 0.15), tf(0, 0.05, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('darkSteel', 0.4, 0.34, 0.4, sx * 1.1, 0.08 + 0.17, sz * 1.1);
  if (L >= 1) {
    const ts = L === 2 ? [-1.38, -0.46, 0.46, 1.38] : [-1.38, 1.38];
    for (const t of ts) {
      p.bolt(t, 0.1, -1.38, 0.045); p.bolt(t, 0.1, 1.38, 0.045);
      if (Math.abs(t) < 1) { p.bolt(-1.38, 0.1, t, 0.045); p.bolt(1.38, 0.1, t, 0.045); }
    }
  }

  // body
  p.add('gunmetal', chamferBox(HW * 2, Y1 - Y0, HW * 2, 0.3), tf(0, (Y0 + Y1) / 2, 0));
  // hazard band + seams on the four flat faces
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    const fx = Math.sin(a) * HW, fz = Math.cos(a) * HW;
    p.box('hazard', 2.6, 0.2, 0.02, fx, 0.6, fz, 0, a, 0);
    if (L >= 1) {
      p.box('darkSteel', 2.6, 0.03, 0.02, fx, 0.8, fz, 0, a, 0);
      p.box('darkSteel', 2.6, 0.03, 0.02, fx, 3.6, fz, 0, a, 0);
    }
  }
  if (L >= 1) {
    for (const z of [-HW, HW]) for (const x of [-0.95, 0.95]) p.box('darkSteel', 0.03, 2.5, 0.02, x, 2.2, z);
  }

  // front door (+z): proud frame, inset panel, handle, rivets
  const FZ = HW;
  p.box('darkSteel', 1.4, 0.1, 0.1, 0, 0.9, FZ + 0.03);
  p.box('darkSteel', 1.4, 0.1, 0.1, 0, 2.8, FZ + 0.03);
  p.box('darkSteel', 0.1, 1.8, 0.1, -0.65, 1.85, FZ + 0.03);
  p.box('darkSteel', 0.1, 1.8, 0.1, 0.65, 1.85, FZ + 0.03);
  p.box('paint', 1.2, 1.8, 0.03, 0, 1.85, FZ + 0.005);
  p.box('darkSteel', 0.04, 0.4, 0.04, 0.42, 1.8, FZ + 0.06);
  p.box('darkSteel', 0.04, 0.04, 0.08, 0.42, 1.62, FZ + 0.04);
  p.box('darkSteel', 0.04, 0.04, 0.08, 0.42, 1.98, FZ + 0.04);
  if (L >= 1) {
    p.box('darkSteel', 0.5, 0.25, 0.015, -0.2, 2.5, FZ + 0.025);
  }
  if (L === 2) {
    for (let i = 0; i < 6; i++) {
      const y = 1.05 + i * 0.32;
      p.bolt(-0.65, y, FZ + 0.08, 0.02, '+z'); p.bolt(0.65, y, FZ + 0.08, 0.02, '+z');
    }
    for (const x of [-0.45, -0.15, 0.15, 0.45]) { p.bolt(x, 0.9, FZ + 0.08, 0.02, '+z'); p.bolt(x, 2.8, FZ + 0.08, 0.02, '+z'); }
  }

  // status lamps (front, high)
  const lampGeos: THREE.BufferGeometry[][] = [[], []];
  [-0.4, 0.4].forEach((x, i) => {
    p.box('darkSteel', 0.22, 0.22, 0.1, x, 3.4, FZ + 0.03);
    lampGeos[i]?.push(place(new THREE.CylinderGeometry(0.07, 0.07, 0.1, L === 0 ? 8 : 16), tf(x, 3.4, FZ + 0.1, Math.PI / 2)));
  });
  p.lamp(0x46ff7a, lampGeos[0] ?? []);
  p.lamp(0xffb020, lampGeos[1] ?? []);

  // +x side: raised service panel, bypass pipe
  p.box('paint', 0.03, 1.4, 1.8, HW + 0.005, 1.9, -0.1);
  if (L >= 1) for (const y of [1.28, 2.52]) for (const z of [-0.92, 0.72]) p.bolt(HW + 0.02, y, z, 0.03, '+x');
  const PX = HW + 0.13, PZ = 1.0;
  p.cyl('darkSteel', 0.07, 0.07, 2.75, PX, 1.925, PZ, L === 0 ? 8 : 12);
  for (const y of [0.55, 3.3]) {
    p.sphere('darkSteel', 0.07, PX, y, PZ, L === 0 ? 6 : 12);
    p.cyl('darkSteel', 0.07, 0.07, 0.14, HW + 0.06, y, PZ, L === 0 ? 8 : 12, 0, 0, Math.PI / 2);
  }
  for (const y of [1.1, 2.1, 2.9]) p.box('darkSteel', 0.14, 0.08, 0.1, HW + 0.06, y, PZ);
  if (L >= 1) for (const y of [1.6, 2.5]) p.cyl('darkSteel', 0.1, 0.1, 0.06, PX, y, PZ, 12);

  // -x side: ladder
  const LX = -HW - 0.15;
  for (const z of [-0.25, 0.25]) p.box('darkSteel', 0.05, 3.0, 0.05, LX, 2.1, z);
  for (const y of [0.9, 1.8, 2.7, 3.5]) for (const z of [-0.25, 0.25]) p.box('darkSteel', 0.18, 0.05, 0.05, -HW - 0.08, y, z);
  if (L >= 1) for (let i = 0; i < 10; i++) p.cyl('darkSteel', 0.02, 0.02, 0.5, LX, 0.75 + i * 0.3, 0, 6, Math.PI / 2, 0, 0, true);

  // rear vent grille (-z) with louvres
  const VZ = -HW;
  p.box('darkSteel', 1.4, 0.08, 0.1, 0, 3.2, VZ - 0.03);
  p.box('darkSteel', 1.4, 0.08, 0.1, 0, 2.2, VZ - 0.03);
  p.box('darkSteel', 0.08, 0.92, 0.1, -0.66, 2.7, VZ - 0.03);
  p.box('darkSteel', 0.08, 0.92, 0.1, 0.66, 2.7, VZ - 0.03);
  const slats = L === 0 ? 3 : L === 1 ? 5 : 7;
  for (let i = 0; i < slats; i++) {
    const y = 2.3 + (i + 0.5) * (0.8 / slats);
    p.box('darkSteel', 1.26, 0.03, L === 0 ? 0.24 : 0.16, 0, y, VZ - 0.04, -0.6);
  }
  // pink pixels pouring from the vent
  const px: THREE.BufferGeometry[] = [];
  const N = L === 0 ? 6 : L === 1 ? 24 : 64, sz = L === 0 ? 0.14 : L === 1 ? 0.1 : 0.08;
  for (let i = 0; i < N; i++) {
    const s = (i + 0.5) / N;
    const y0 = 2.3 + hash(i, 3) * 0.8;
    const x = (hash(i, 1) - 0.5) * (0.9 + 0.8 * s);
    const z = VZ - 0.1 - s * 1.5;
    const y = Math.max(sz / 2 + 0.01, y0 * (1 - s * s) + 0.02);
    px.push(place(new THREE.BoxGeometry(sz, sz, sz), tf(x, y, z, 0, hash(i, 5) * Math.PI, hash(i, 6) * 0.6)));
  }
  p.lamp(0xff4fd8, px);

  // power gland (rear) with cable to the floor
  p.cyl('darkSteel', 0.09, 0.09, 0.3, 1.0, 0.35, VZ - 0.1, L === 0 ? 8 : 12, Math.PI / 2);
  if (L >= 1) p.cyl('darkSteel', 0.12, 0.12, 0.08, 1.0, 0.35, VZ - 0.08, 6, Math.PI / 2);
  p.add('rubber', tube([[1.0, 0.35, VZ - 0.24], [1.0, 0.33, VZ - 0.45], [1.0, 0.2, VZ - 0.65], [1.0, 0.06, VZ - 0.8]], 0.05, L === 0 ? 6 : 12, L === 0 ? 5 : 8));

  // hopper: square frustum shell + rim + stiffeners + ore
  const HB = 1.3, HT = 1.7, HH = 0.9, T = 0.1, R2 = Math.SQRT2;
  p.add('gunmetal', new THREE.CylinderGeometry(HT * R2, HB * R2, HH, 4, 1, true), tf(0, Y1 + HH / 2, 0, 0, Math.PI / 4));
  p.add('gunmetal', flip(new THREE.CylinderGeometry((HT - T) * R2, (HB - T) * R2, HH, 4, 1, true)), tf(0, Y1 + HH / 2, 0, 0, Math.PI / 4));
  p.ring('darkSteel', (HT - T) * R2, (HT + 0.05) * R2, 0.06, 0, Y1 + HH - 0.01, 0, 4, Math.PI / 4);
  if (L >= 1) {
    const us = L === 2 ? [-0.8, 0, 0.8] : [-0.6, 0.6];
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      for (const u of us) {
        const a0: V3 = [u * ca + HB * sa, Y1 + 0.02, -u * sa + HB * ca];
        const a1: V3 = [u * ca + HT * sa, Y1 + HH - 0.03, -u * sa + HT * ca];
        p.bar('darkSteel', a0, a1, 0.06);
      }
    }
  }
  p.add('rubber', heap(2.9, L === 0 ? 3 : L === 1 ? 6 : 12, 0.5, L === 0 ? 0 : 0.1, 11), tf(0, Y1 + 0.45, 0));

  p.socket('vent', [0, 2.7, VZ - 0.08]);
  p.socket('hopper', [0, Y1 + HH + 0.02, 0]);
  p.socket('power', [1.0, 0.35, VZ - 0.25]);
  p.collider([-1.5, 0, -1.5], [1.5, 0.1, 1.5]);
  p.collider([-HW - 0.2, Y0, -HW - 0.1], [HW + 0.2, Y1, HW + 0.1]);
  p.collider([-HT - 0.05, Y1, -HT - 0.05], [HT + 0.05, Y1 + HH + 0.05, HT + 0.05]);
  return p.gear();
}

// ---------------------------------------------------------------------------
// bin: steel cabinet with dish emitter, centred (2,0,2)
// ---------------------------------------------------------------------------
export function bin(m: LabMaterials, o: GearOptions = {}): Gear {
  const p = new Parts(m, lodOf(o.stage));
  const L = p.lod, S = p.seg, c = 2;
  const W = 1.2, D = 0.8, FZ = c + D / 2;

  // feet with rubber pads, body, cap
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    p.box('rubber', 0.12, 0.03, 0.12, c + sx * 0.5, 0.015, c + sz * 0.3);
    p.box('darkSteel', 0.1, 0.14, 0.1, c + sx * 0.5, 0.02 + 0.07, c + sz * 0.3);
  }
  p.add('gunmetal', chamferBox(W, 1.42, D, 0.04), tf(c, 0.14 + 0.71, c));
  p.add('darkSteel', chamferBox(W + 0.04, 0.04, D + 0.04, 0.05), tf(c, 1.57, c));

  // door with dark gap outline, keypad, handle, hinges, louvres, corner bolts
  p.box('darkSteel', 1.06, 1.16, 0.015, c, 0.85, FZ - 0.0025);
  p.box('paint', 1.0, 1.1, 0.03, c, 0.85, FZ + 0.015);
  p.box('darkSteel', 0.18, 0.26, 0.05, c + 0.3, 1.1, FZ + 0.045);
  if (L >= 1) {
    p.box('paint', 0.12, 0.05, 0.01, c + 0.3, 1.2, FZ + 0.072);
    for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) p.box('paint', 0.03, 0.03, 0.02, c + 0.26 + q * 0.04, 1.14 - r * 0.045, FZ + 0.075);
  }
  const hz = FZ + 0.03;
  p.cyl('copper', 0.018, 0.018, 0.45, c - 0.35, 0.95, hz + 0.06, L === 0 ? 6 : 12);
  for (const y of [0.77, 1.13]) p.cyl('copper', 0.015, 0.015, 0.08, c - 0.35, y, hz + 0.03, 6, Math.PI / 2);
  for (const y of [0.5, 1.2]) p.cyl('darkSteel', 0.02, 0.02, 0.14, c + 0.51, y, FZ + 0.015, L === 0 ? 6 : 10);
  if (L >= 1) {
    for (let i = 0; i < 3; i++) p.box('darkSteel', 0.5, 0.025, 0.07, c - 0.1, 0.42 + i * 0.08, FZ + 0.03, -0.6);
    for (const x of [-0.55, 0.55]) for (const y of [0.25, 1.5]) p.bolt(c + x, y, FZ, 0.02, '+z');
    p.box('hazard', 0.012, 0.2, 0.3, c + W / 2 + 0.005, 1.2, c);
  }

  // dish emitter on top
  p.cyl('gunmetal', 0.05, 0.05, 0.3, c, 1.73, c, L === 0 ? 8 : 12);
  p.cyl('darkSteel', 0.12, 0.12, 0.06, c, 1.89, c, S);
  p.add('gunmetal', new THREE.CylinderGeometry(0.38, 0.07, 0.16, S, 1, true), tf(c, 1.95, c));
  p.add('gunmetal', flip(new THREE.CylinderGeometry(0.37, 0.07, 0.16, S, 1, true)), tf(c, 1.955, c));
  p.cyl('darkSteel', 0.015, 0.015, 0.22, c, 2.03, c, 6);
  if (L >= 1) for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    p.rod('darkSteel', [c + Math.sin(a) * 0.3, 2.0, c + Math.cos(a) * 0.3], [c, 2.14, c], 0.008, 5, true);
  }
  p.lamp(0x5ad7ff, [place(new THREE.SphereGeometry(0.045, L === 0 ? 6 : 12, L === 0 ? 4 : 8), tf(c, 2.16, c))]);

  p.socket('link', [c, 2.2, c]);
  p.collider([c - W / 2, 0, c - D / 2], [c + W / 2, 1.59, c + D / 2]);
  return p.gear();
}

// ---------------------------------------------------------------------------
// repeater: lattice tower on concrete base, centred (2,0,2)
// ---------------------------------------------------------------------------
export function repeater(m: LabMaterials, o: GearOptions = {}): Gear {
  const p = new Parts(m, lodOf(o.stage));
  const L = p.lod, c = 2;

  // concrete base, hazard chevron plates
  p.add('concrete', chamferBox(1.6, 0.4, 1.6, 0.1), tf(c, 0.2, c));
  if (L >= 1) for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    p.box('hazard', 0.6, 0.1, 0.02, c + Math.sin(a) * 0.8, 0.3, c + Math.cos(a) * 0.8, 0, a, 0);
  }

  // legs
  const F = 0.55, Tt = 0.22, YB = L >= 1 ? 0.4 : 0.38, YT = 6.64;
  const legAt = (sx: number, sz: number, y: number): V3 => {
    const u = (y - YB) / (YT - YB);
    const r = F + (Tt - F) * u;
    return [c + sx * r, y, c + sz * r];
  };
  const corners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) {
    if (L >= 1) {
      p.box('darkSteel', 0.24, 0.03, 0.24, c + sx * F, 0.405, c + sz * F);
      if (L === 2) for (const bx of [-1, 1]) for (const bz of [-1, 1]) p.bolt(c + sx * F + bx * 0.09, 0.42, c + sz * F + bz * 0.09, 0.02);
    }
    p.bar('gunmetal', legAt(sx, sz, YB), legAt(sx, sz, YT), 0.08);
  }
  // bays: horizontals at each level, zig-zag diagonals
  const bays = L === 0 ? 2 : L === 1 ? 6 : 8, yLo = 0.42, yHi = 6.2;
  for (let k = 1; k <= bays; k++) {
    const y = yLo + (yHi - yLo) * k / bays, yp = yLo + (yHi - yLo) * (k - 1) / bays;
    for (let i = 0; i < 4; i++) {
      const A = corners[i], B = corners[(i + 1) % 4];
      if (!A || !B) continue;
      p.bar('gunmetal', legAt(A[0], A[1], y), legAt(B[0], B[1], y), 0.05);
      const flipDiag = (k + i) % 2 === 0;
      const lo = flipDiag ? A : B, hi = flipDiag ? B : A;
      p.bar('gunmetal', legAt(lo[0], lo[1], yp), legAt(hi[0], hi[1], y), 0.04);
    }
  }

  // top plate, standoffs, copper ring, emitter ring, mast, red lamp
  p.add('darkSteel', chamferBox(0.7, 0.06, 0.7, 0.08), tf(c, 6.65, c));
  const RR = 0.42;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    p.box('darkSteel', 0.04, 0.17, 0.04, c + Math.sin(a) * RR, 6.675 + 0.085, c + Math.cos(a) * RR);
  }
  p.add('copper', new THREE.TorusGeometry(RR, 0.035, L === 0 ? 4 : 8, L === 0 ? 8 : 24), tf(c, 6.84, c, Math.PI / 2));
  const emit: THREE.BufferGeometry[] = [];
  const ne = L === 0 ? 4 : L === 1 ? 8 : 12;
  for (let i = 0; i < ne; i++) {
    const a = (i / ne) * Math.PI * 2;
    emit.push(place(new THREE.CylinderGeometry(0.035, 0.035, 0.1, L === 0 ? 6 : 10), tf(c + Math.sin(a) * RR, 6.89, c + Math.cos(a) * RR)));
  }
  p.cyl('gunmetal', 0.04, 0.04, 0.63, c, 6.985, c, L === 0 ? 8 : 12);
  if (L >= 1) p.cyl('darkSteel', 0.07, 0.07, 0.04, c, 7.3, c, 12);
  const red = p.lamp(0xff2a2a, [place(new THREE.CapsuleGeometry(0.07, 0.14, L === 0 ? 2 : 4, L === 0 ? 6 : 12), tf(c, 7.42, c))]);
  red.name = 'topLamp';
  p.lamp(0x7fd8ff, emit);

  // distribution box at the foot (+z side) with conduit up a leg
  const BX = c, BZ = c + 0.62;
  p.box('darkSteel', 0.4, 0.5, 0.24, BX, 0.63, BZ);
  p.box('paint', 0.32, 0.4, 0.02, BX, 0.63, BZ + 0.125);
  if (L >= 1) {
    p.cyl('copper', 0.012, 0.012, 0.16, BX, 0.5, BZ + 0.165, 8, 0, 0, Math.PI / 2);
    for (const x of [-0.07, 0.07]) p.cyl('copper', 0.01, 0.01, 0.05, BX + x, 0.5, BZ + 0.15, 6, Math.PI / 2);
    for (const x of [-0.13, 0.13]) for (const y of [0.47, 0.79]) p.bolt(BX + x, y, BZ + 0.145, 0.012, '+z');
  }
  p.cyl('rubber', 0.04, 0.04, 0.1, BX, 0.91, BZ, L === 0 ? 8 : 12);
  const legHit = legAt(-1, 1, 2.4);
  p.add('rubber', tube([[BX, 0.95, BZ], [BX, 1.4, BZ], [BX - 0.3, 2.0, BZ - 0.15], legHit], 0.03, L === 0 ? 6 : 14, L === 0 ? 5 : 8));
  if (L >= 1) p.box('darkSteel', 0.1, 0.06, 0.1, legHit[0], legHit[1], legHit[2]);

  p.socket('top', [c, 7.56, c]);
  p.socket('box', [BX, 0.63, BZ + 0.14]);
  p.collider([c - 0.8, 0, c - 0.8], [c + 0.8, 0.4, c + 0.8]);
  p.collider([c - F - 0.05, 0.4, c - F - 0.05], [c + F + 0.05, 7.56, c + F + 0.05]);
  return p.gear();
}

// ---------------------------------------------------------------------------
// draftingTable: workbench with drafting screen, centred (2,0,2)
// ---------------------------------------------------------------------------
export function draftingTable(m: LabMaterials, o: GearOptions = {}): Gear {
  const p = new Parts(m, lodOf(o.stage));
  const L = p.lod, c = 2;
  const TW = 2.4, TD = 1.2, TY = 0.95;

  // top, legs, pads, stretchers, braces
  p.add('gunmetal', chamferBox(TW, 0.08, TD, 0.04), tf(c, TY - 0.04, c));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    p.box('rubber', 0.12, 0.03, 0.12, c + sx * 1.1, 0.015, c + sz * 0.5);
    p.box('darkSteel', 0.08, 0.87, 0.08, c + sx * 1.1, 0.02 + 0.435, c + sz * 0.5);
  }
  for (const sx of [-1, 1]) {
    p.box('darkSteel', 0.05, 0.05, 1.0, c + sx * 1.1, 0.25, c);
    if (L >= 1) p.bar('darkSteel', [c + sx * 1.1, 0.27, c - sx * 0.5], [c + sx * 1.1, 0.86, c + sx * 0.5], 0.035);
  }
  p.box('darkSteel', 2.2, 0.05, 0.05, c, 0.25, c - 0.5);
  if (L >= 1) for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('darkSteel', 0.12, 0.03, 0.12, c + sx * 1.1, TY - 0.08 - 0.01, c + sz * 0.5);

  // drafting screen with bezel
  const SX = c - 0.35;
  p.lamp(0x3a9cff, [place(new THREE.BoxGeometry(1.3, 0.02, 0.85), tf(SX, TY, c))]);
  for (const sz of [-1, 1]) p.box('darkSteel', 1.42, 0.03, 0.05, SX, TY + 0.005, c + sz * 0.44);
  for (const sx of [-1, 1]) p.box('darkSteel', 0.05, 0.03, 0.83, SX + sx * 0.665, TY + 0.005, c);
  if (L === 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.bolt(SX + sx * 0.685, TY + 0.02, c + sz * 0.44, 0.012);

  // things on the bench: cube, swatch, pencil
  p.box('paint', 0.12, 0.12, 0.12, c + 0.75, TY + 0.055, c - 0.3, 0, 0.4);
  p.box('hazard', 0.24, 0.012, 0.16, c + 0.72, TY + 0.001, c + 0.32, 0, 0.3);
  if (L >= 1) p.cyl('rubber', 0.006, 0.006, 0.18, c + 0.3, TY + 0.005, c + 0.52, 6, 0, 0.5, Math.PI / 2);

  // side cabinet with drawers and handles
  const CX = c + 0.75;
  p.box('rubber', 0.46, 0.04, 0.86, CX, 0.02, c);
  p.add('darkSteel', chamferBox(0.5, 0.85, 0.9, 0.02), tf(CX, 0.03 + 0.425, c));
  const DZ = c + 0.45;
  for (const y of [0.2, 0.46, 0.72]) {
    p.box('paint', 0.42, 0.22, 0.02, CX, y, DZ + 0.005);
    if (L >= 1) {
      p.cyl('copper', 0.012, 0.012, 0.2, CX, y, DZ + 0.045, 8, 0, 0, Math.PI / 2);
      for (const x of [-0.08, 0.08]) p.cyl('copper', 0.01, 0.01, 0.04, CX + x, y, DZ + 0.03, 6, Math.PI / 2);
    } else {
      p.cyl('copper', 0.012, 0.012, 0.2, CX, y, DZ + 0.02, 6, 0, 0, Math.PI / 2, true);
    }
  }

  p.socket('screen', [SX, TY + 0.01, c]);
  p.collider([c - TW / 2, 0, c - TD / 2], [c + TW / 2, TY, c + TD / 2]);
  p.collider([CX - 0.25, 0, c - 0.45], [CX + 0.25, 0.88, c + 0.45]);
  return p.gear();
}
