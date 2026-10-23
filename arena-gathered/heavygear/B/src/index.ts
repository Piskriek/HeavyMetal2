/**
 * @hm/heavygear — three heavy terraformers that bolt onto the moon-base
 * heavy-machine socket (the bolted cylinder ring in the middle of the 8x8 m pad).
 *
 * Frame (metres, y up): origin = socket-ring top centre, front = +z.
 * Everything a builder returns keeps to x,z in -4..4 and never dips below y = 0.
 *
 * Build rules honoured here:
 *  - geometry merged per material, <= 8 top level children (lamps included),
 *  - every part non-indexed with position / normal / uv (+ colour) before merging,
 *  - every part touches or slightly sinks into the part that holds it,
 *  - no coplanar faces, nothing pokes through anything except at a weld,
 *  - stage 1 = chunky low poly, flat, few segments, same silhouette as stage 6,
 *  - no chimneys or stacks: pixels are the only emission.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ *
 * public types
 * ------------------------------------------------------------------ */

export interface Box {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Socket {
  name: string;
  at: [number, number, number];
}

export interface Gear {
  group: THREE.Group;
  colliders: Box[];
  sockets: Socket[];
  lamps: THREE.Mesh[];
  parts?: Record<string, THREE.Object3D>;
}

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

export interface GearOptions {
  /** 1 = chunky low poly prototype, 6 = fully detailed hardware. */
  stage?: number;
}

/* ------------------------------------------------------------------ *
 * small internal helpers
 * ------------------------------------------------------------------ */

type Vec3 = [number, number, number];
type RGB = readonly [number, number, number];

const HALF_PI = Math.PI / 2;
const TAU = Math.PI * 2;

const WHITE: RGB = [1, 1, 1];
const ORANGE: RGB = [0.96, 0.37, 0.06];
const SIGNAL_GREEN: RGB = [0.14, 0.7, 0.3];
const CRYSTAL: RGB = [0.5, 0.78, 0.88];
const GRAVEL: RGB = [0.41, 0.4, 0.38];
const DIAL: RGB = [0.9, 0.89, 0.84];

const HUE_PRESS = 0x4bff86;
const HUE_PROJECTOR = 0xffa32a;
const HUE_WATER = 0x3ae8ff;
const HUE_LENS = 0xfff1c8;
const HUE_OK = 0x63ff9b;
const HUE_WARN = 0xffcf4d;

const UNIT = new THREE.Vector3(1, 1, 1);

function m4(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    UNIT,
  );
}

/** place a geometry (mutates and returns it). */
function at(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  g.applyMatrix4(m4(x, y, z, rx, ry, rz));
  return g;
}

/** 12 triangles. */
function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

/** capped cylinder 4*seg, cone (rt=0) 2*seg, open sleeve 2*seg triangles. */
function cyl(rt: number, rb: number, h: number, seg: number, open = false): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rt, rb, h, Math.max(3, Math.round(seg)), 1, open);
}

/* ---- hand built convex polygon soup (chamfered steel) ---- */

interface Scratch {
  pos: number[];
  nor: number[];
  uv: number[];
}

/**
 * Append a convex polygon; winding is fixed by pointing the face away from the
 * local origin, which is right for the convex origin-centred blocks below.
 */
function poly(s: Scratch, pts: readonly Vec3[]): void {
  const n = pts.length;
  if (n < 3) return;
  const a = pts[0] ?? [0, 0, 0];
  const b = pts[1] ?? [0, 0, 0];
  const c = pts[2] ?? [0, 0, 0];
  let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
  let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const p of pts) {
    cx += p[0];
    cy += p[1];
    cz += p[2];
  }
  cx /= n;
  cy /= n;
  cz /= n;
  const flip = nx * cx + ny * cy + nz * cz < 0;
  if (flip) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  const ring: Vec3[] = flip ? pts.slice().reverse() : pts.slice();
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  const v0 = ring[0] ?? [0, 0, 0];
  for (let i = 1; i + 1 < n; i++) {
    const v1 = ring[i] ?? [0, 0, 0];
    const v2 = ring[i + 1] ?? [0, 0, 0];
    for (const v of [v0, v1, v2]) {
      s.pos.push(v[0], v[1], v[2]);
      s.nor.push(nx, ny, nz);
      if (ax >= ay && ax >= az) s.uv.push(v[2] + 0.5, v[1] + 0.5);
      else if (ay >= az) s.uv.push(v[0] + 0.5, v[2] + 0.5);
      else s.uv.push(v[0] + 0.5, v[1] + 0.5);
    }
  }
}

function finish(s: Scratch): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2));
  return g;
}

/** chamfered block: 6 faces + 12 edge strips + 8 corners = 44 triangles. */
function chamferBox(w: number, h: number, d: number, c: number): THREE.BufferGeometry {
  const W = w / 2;
  const H = h / 2;
  const D = d / 2;
  const k = Math.min(c, Math.min(W, Math.min(H, D)) * 0.45);
  const vx = (sx: number, sy: number, sz: number): Vec3 => [sx * W, sy * (H - k), sz * (D - k)];
  const vy = (sx: number, sy: number, sz: number): Vec3 => [sx * (W - k), sy * H, sz * (D - k)];
  const vz = (sx: number, sy: number, sz: number): Vec3 => [sx * (W - k), sy * (H - k), sz * D];
  const s: Scratch = { pos: [], nor: [], uv: [] };
  for (const t of [-1, 1]) {
    poly(s, [vx(t, -1, -1), vx(t, -1, 1), vx(t, 1, 1), vx(t, 1, -1)]);
    poly(s, [vy(-1, t, -1), vy(-1, t, 1), vy(1, t, 1), vy(1, t, -1)]);
    poly(s, [vz(-1, -1, t), vz(-1, 1, t), vz(1, 1, t), vz(1, -1, t)]);
  }
  for (const p of [-1, 1]) {
    for (const q of [-1, 1]) {
      poly(s, [vx(p, q, -1), vx(p, q, 1), vy(p, q, 1), vy(p, q, -1)]);
      poly(s, [vy(-1, p, q), vy(1, p, q), vz(1, p, q), vz(-1, p, q)]);
      poly(s, [vz(p, -1, q), vz(p, 1, q), vx(p, 1, q), vx(p, -1, q)]);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) poly(s, [vx(sx, sy, sz), vy(sx, sy, sz), vz(sx, sy, sz)]);
    }
  }
  return finish(s);
}

/** cylinder stretched between two points, overshooting both ends so it welds in. */
function strut(a: Vec3, b: Vec3, r: number, seg: number, over = 0.05): THREE.BufferGeometry {
  const va = new THREE.Vector3(a[0], a[1], a[2]);
  const vb = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const g = cyl(r, r, len + over * 2, seg);
  if (len > 1e-6) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().multiplyScalar(1 / len));
    g.applyMatrix4(new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, UNIT));
  }
  return g;
}

/** deterministic noise (this package never uses Math.random). */
function hash(i: number): number {
  const v = Math.sin((i + 1) * 127.1) * 43758.5453;
  return v - Math.floor(v);
}

/* ------------------------------------------------------------------ *
 * level of detail
 * ------------------------------------------------------------------ */

interface Lod {
  stage: number;
  flat: boolean;
  chamfer: number;
  seg: (lo: number, hi: number) => number;
  rep: (lo: number, hi: number) => number;
  at: (from: number) => boolean;
}

function lod(stageIn: number | undefined): Lod {
  const stage = Math.max(1, Math.min(6, Math.round(stageIn === undefined ? 6 : stageIn)));
  const t = (stage - 1) / 5;
  return {
    stage,
    flat: stage <= 2,
    chamfer: stage >= 3 ? 0.05 : 0,
    seg: (lo: number, hi: number) => Math.max(3, Math.round(lo + (hi - lo) * t)),
    rep: (lo: number, hi: number) => Math.max(0, Math.round(lo + (hi - lo) * t)),
    at: (from: number) => stage >= from,
  };
}

/** chunky box at low stages, chamfered steel from stage 3 up. */
function cbox(w: number, h: number, d: number, L: Lod): THREE.BufferGeometry {
  if (L.chamfer <= 0) return box(w, h, d);
  return chamferBox(w, h, d, Math.min(L.chamfer, Math.min(w, Math.min(h, d)) * 0.2));
}

/* ------------------------------------------------------------------ *
 * materials
 * ------------------------------------------------------------------ */

export function createMaterials(): LabMaterials {
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x939ba5, metalness: 0.95, roughness: 0.42 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x434950, metalness: 0.85, roughness: 0.62 });
  // paint carries per-vertex tints: orange power gland, green data gland, gravel, dials, crystal
  const paint = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.12, roughness: 0.55, vertexColors: true });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb4703c, metalness: 1, roughness: 0.34 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0, roughness: 0.95 });
  const hazard = new THREE.MeshStandardMaterial({ color: 0xf0b018, metalness: 0.25, roughness: 0.5 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8d8a83, metalness: 0, roughness: 0.96 });
  // physical, but deliberately no transmission: plain armoured cover glass
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xbfe4ff,
    metalness: 0,
    roughness: 0.08,
    transparent: true,
    opacity: 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  return { gunmetal, darkSteel, paint, copper, rubber, hazard, concrete, glass };
}

function lampMaterial(hue: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x0c0e11,
    emissive: new THREE.Color(hue),
    emissiveIntensity: 1,
    metalness: 0.1,
    roughness: 0.35,
    toneMapped: false,
  });
}

/** 0 = dark, 1 = full glow. */
export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const g = glow < 0 ? 0 : glow > 1 ? 1 : glow;
  const mat = lamp.material;
  const list: THREE.Material[] = Array.isArray(mat) ? mat : [mat];
  for (const m of list) {
    if (m instanceof THREE.MeshStandardMaterial) {
      m.emissiveIntensity = g;
      m.needsUpdate = true;
    }
  }
}

/** triangle count of a gear, nested groups included. */
export function triangles(g: Gear): number {
  let n = 0;
  g.group.traverse((o: THREE.Object3D) => {
    if (o instanceof THREE.Mesh) {
      const geo: THREE.BufferGeometry = o.geometry;
      const index = geo.getIndex();
      if (index !== null) n += index.count / 3;
      else {
        const pos = geo.getAttribute('position');
        if (pos !== undefined) n += pos.count / 3;
      }
    }
  });
  return Math.floor(n);
}

/* ------------------------------------------------------------------ *
 * the merge pile: one bucket per material (plus one per lamp)
 * ------------------------------------------------------------------ */

type MatKey = 'gunmetal' | 'darkSteel' | 'paint' | 'copper' | 'rubber' | 'hazard' | 'concrete' | 'glass';

function materialFor(m: LabMaterials, key: string): THREE.Material {
  switch (key) {
    case 'darkSteel':
      return m.darkSteel;
    case 'paint':
      return m.paint;
    case 'copper':
      return m.copper;
    case 'rubber':
      return m.rubber;
    case 'hazard':
      return m.hazard;
    case 'concrete':
      return m.concrete;
    case 'glass':
      return m.glass;
    default:
      return m.gunmetal;
  }
}

class Pile {
  private readonly flat: boolean;
  private readonly order: string[] = [];
  private readonly bucket = new Map<string, THREE.BufferGeometry[]>();
  private readonly hues = new Map<string, number>();
  private readonly stack: THREE.Matrix4[] = [new THREE.Matrix4()];

  constructor(flat: boolean) {
    this.flat = flat;
  }

  private get head(): THREE.Matrix4 {
    const top = this.stack[this.stack.length - 1];
    return top === undefined ? new THREE.Matrix4() : top;
  }

  push(local: THREE.Matrix4): void {
    this.stack.push(this.head.clone().multiply(local));
  }

  pop(): void {
    if (this.stack.length > 1) this.stack.pop();
  }

  add(key: MatKey, geo: THREE.BufferGeometry, tint: RGB = WHITE): void {
    this.store(key, geo, tint);
  }

  lamp(key: string, hue: number, geo: THREE.BufferGeometry): void {
    this.hues.set('@' + key, hue);
    this.store('@' + key, geo, WHITE);
  }

  private store(key: string, src: THREE.BufferGeometry, tint: RGB): void {
    const geo = src.getIndex() !== null ? src.toNonIndexed() : src;
    if (this.flat || geo.getAttribute('normal') === undefined) geo.computeVertexNormals();
    const pos = geo.getAttribute('position');
    const count = pos === undefined ? 0 : pos.count;
    if (geo.getAttribute('uv') === undefined) {
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      col[i * 3] = tint[0];
      col[i * 3 + 1] = tint[1];
      col[i * 3 + 2] = tint[2];
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.applyMatrix4(this.head);
    const list = this.bucket.get(key);
    if (list === undefined) {
      this.bucket.set(key, [geo]);
      this.order.push(key);
    } else list.push(geo);
  }

  /** one merged mesh per bucket, appended to `into`; lamp buckets also land in `lamps`. */
  build(m: LabMaterials, into: THREE.Object3D, lamps: THREE.Mesh[]): void {
    for (const key of this.order) {
      const list = this.bucket.get(key);
      if (list === undefined || list.length === 0) continue;
      const geo = mergeGeometries(list, false);
      if (!geo) continue;
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      const isLamp = key.charAt(0) === '@';
      const mesh = new THREE.Mesh(geo, isLamp ? lampMaterial(this.hues.get(key) ?? 0xffffff) : materialFor(m, key));
      mesh.name = isLamp ? key.slice(1) : key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      into.add(mesh);
      if (isLamp) lamps.push(mesh);
    }
  }
}

/* ------------------------------------------------------------------ *
 * shared grounded kit
 * ------------------------------------------------------------------ */

/** hazard band: yellow slab half sunk into a vertical face, chevrons from stage 3. */
function hazardBand(P: Pile, L: Lod, w: number, h: number, x: number, y: number, z: number, ry: number): void {
  P.push(m4(x, y, z, 0, ry, 0));
  P.add('hazard', box(w, h, 0.04));
  const n = L.at(3) ? Math.max(2, Math.round(w / 0.2)) : 0;
  const cw = 0.06;
  const ang = 0.6;
  const ch = (h - cw * Math.sin(ang)) / Math.cos(ang);
  for (let i = 0; i < n; i++) {
    P.add('darkSteel', at(box(cw, ch, 0.03), -w / 2 + ((i + 0.5) * w) / n, 0, 0.013, 0, 0, ang));
  }
  P.pop();
}

/** one cable gland poking out of a junction block face at z = zFace. */
function gland(P: Pile, L: Lod, x: number, y: number, zFace: number, tint: RGB): void {
  const s = L.seg(6, 10);
  P.add('paint', at(cyl(0.055, 0.055, 0.16, s), x, y, zFace + 0.05, HALF_PI), tint);
  if (L.at(3)) P.add('darkSteel', at(cyl(0.065, 0.065, 0.04, s), x, y, zFace + 0.1, HALF_PI));
}

interface GroundSpec {
  w: number;
  d: number;
  collar: number;
  boltR: number;
  boltN: number;
  boltOffset: number;
  glandX: number;
  glandZ: number;
}

/** heavy base plate bolted to the ring + cable glands. Returns the 'power' socket. */
function groundKit(P: Pile, L: Lod, g: GroundSpec): Vec3 {
  P.add('darkSteel', at(cbox(g.w, 0.16, g.d, L), 0, 0.08, 0));
  P.add('gunmetal', at(cyl(g.collar, g.collar + 0.04, 0.14, L.seg(6, 14)), 0, 0.21, 0));
  if (L.at(3)) {
    for (let i = 0; i < g.boltN; i++) {
      const a = g.boltOffset + (i * TAU) / g.boltN;
      P.add('gunmetal', at(cyl(0.055, 0.062, 0.07, 6), Math.cos(a) * g.boltR, 0.18, Math.sin(a) * g.boltR));
    }
  }
  const zFace = g.glandZ + 0.09;
  P.add('darkSteel', at(cbox(0.42, 0.2, 0.18, L), g.glandX, 0.24, g.glandZ));
  gland(P, L, g.glandX - 0.11, 0.24, zFace, ORANGE);
  gland(P, L, g.glandX + 0.11, 0.24, zFace, SIGNAL_GREEN);
  return [g.glandX - 0.11, 0.24, zFace + 0.15];
}

/** two status lamps on a small panel welded to a vertical face. */
function statusLamps(P: Pile, L: Lod, x: number, y: number, z: number, ry: number): void {
  P.push(m4(x, y, z, 0, ry, 0));
  P.add('darkSteel', at(cbox(0.3, 0.14, 0.05, L), 0, 0, 0));
  const s = L.seg(6, 10);
  const slots: Array<[number, string, number]> = [
    [-0.075, 'statusA', HUE_OK],
    [0.075, 'statusB', HUE_WARN],
  ];
  for (const slot of slots) {
    if (L.at(3)) P.add('gunmetal', at(cyl(0.062, 0.062, 0.05, s), slot[0], 0, 0.025, HALF_PI));
    P.lamp(slot[1], slot[2], at(cyl(0.045, 0.045, 0.07, s), slot[0], 0, 0.035, HALF_PI));
  }
  P.pop();
}

/* ------------------------------------------------------------------ *
 * 1. heavy press — open frame, two rams, feed chute, rear vent grille
 * ------------------------------------------------------------------ */

export function heavyPress(m: LabMaterials, o: GearOptions = {}): Gear {
  const L = lod(o.stage);
  const P = new Pile(L.flat);
  const group = new THREE.Group();
  group.name = 'heavyPress';
  const lamps: THREE.Mesh[] = [];

  const power = groundKit(P, L, {
    w: 2.1,
    d: 1.8,
    collar: 0.46,
    boltR: 0.8,
    boltN: 6,
    boltOffset: Math.PI / 6,
    glandX: -0.45,
    glandZ: 0.76,
  });

  /* die bed on the collar */
  P.add('gunmetal', at(cbox(1.1, 0.58, 0.95, L), 0, 0.55, 0));
  P.add('darkSteel', at(cbox(0.76, 0.12, 0.66, L), 0, 0.88, 0));
  if (L.at(4)) P.add('gunmetal', at(cbox(0.5, 0.06, 0.42, L), 0, 0.955, 0));
  hazardBand(P, L, 0.9, 0.11, 0, 0.7, 0.485, 0);

  /* two thick columns + crown beam */
  for (const sx of [-1, 1]) {
    P.add('gunmetal', at(cbox(0.34, 3.1, 0.56, L), sx * 0.78, 1.69, 0));
    if (L.at(3)) P.add('darkSteel', at(cbox(0.48, 0.14, 0.62, L), sx * 0.78, 0.21, 0));
  }
  P.add('gunmetal', at(cbox(2.26, 0.46, 0.7, L), 0, 3.44, 0));
  P.add('darkSteel', at(cbox(1.5, 0.1, 0.52, L), 0, 3.7, 0));
  hazardBand(P, L, 1.6, 0.12, 0, 3.56, 0.36, 0);

  /* feed chute with a heap of crystalline shards */
  const chuteSeg = L.seg(6, 12);
  P.add('gunmetal', at(cyl(0.4, 0.24, 0.46, chuteSeg), 0, 3.955, 0));
  P.add('darkSteel', at(cyl(0.43, 0.43, 0.07, chuteSeg), 0, 4.155, 0));
  P.add('paint', at(cyl(0.3, 0.37, 0.09, chuteSeg), 0, 4.21, 0), CRYSTAL);
  const shards = L.rep(3, 5);
  for (let i = 0; i < shards; i++) {
    const a = (i / Math.max(1, shards)) * TAU + 0.4;
    const tilt = 0.16 + hash(i) * 0.14;
    P.add(
      'paint',
      at(cyl(0, 0.1, 0.3, L.seg(4, 6)), Math.cos(a) * 0.13, 4.2, Math.sin(a) * 0.13, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt),
      CRYSTAL,
    );
  }

  /* ram cylinders hanging under the crown */
  const ramSeg = L.seg(8, 16);
  for (const sx of [-1, 1]) {
    P.add('darkSteel', at(cyl(0.22, 0.22, 1.06, ramSeg), sx * 0.34, 2.72, 0));
    if (L.at(3)) P.add('gunmetal', at(cyl(0.26, 0.26, 0.08, ramSeg), sx * 0.34, 2.23, 0));
  }
  if (L.at(4)) {
    P.add('darkSteel', at(cbox(0.5, 0.18, 0.16, L), 0, 3.36, 0.42));
    for (const sx of [-1, 1]) {
      P.add('darkSteel', strut([sx * 0.2, 3.36, 0.42], [sx * 0.34, 3.0, 0.2], 0.045, L.seg(6, 8)));
    }
  }

  /* louvred vent grille on the REAR face, green pixels behind the slats */
  const ventY = 3.44;
  P.add('darkSteel', at(box(1.16, 0.4, 0.05), 0, ventY, -0.365));
  for (const sy of [-1, 1]) P.add('gunmetal', at(box(1.3, 0.07, 0.16), 0, ventY + sy * 0.185, -0.465));
  for (const sx of [-1, 1]) P.add('gunmetal', at(box(0.07, 0.46, 0.16), sx * 0.6, ventY, -0.465));
  const slats = L.rep(2, 4);
  for (let i = 0; i < slats; i++) {
    const fy = slats <= 1 ? 0 : -0.145 + (i / (slats - 1)) * 0.29;
    P.add('darkSteel', at(box(1.18, 0.05, 0.06), 0, ventY + fy, -0.49, -0.4));
  }
  const pxCols = L.rep(3, 4);
  const pxRows = L.rep(1, 3);
  for (let r = 0; r < pxRows; r++) {
    for (let c = 0; c < pxCols; c++) {
      const py = pxRows <= 1 ? 0 : -0.12 + (r / (pxRows - 1)) * 0.24;
      const px = pxCols <= 1 ? 0 : -0.44 + (c / (pxCols - 1)) * 0.88;
      P.lamp('pressVent', HUE_PRESS, at(box(0.08, 0.035, 0.035), px, ventY + py, -0.4125));
    }
  }

  statusLamps(P, L, 0.78, 1.8, 0.295, 0);
  P.build(m, group, lamps);

  /* moving ram: pistons + press plate; the game slides this group down 0..0.6 m */
  const R = new Pile(L.flat);
  const ram = new THREE.Group();
  ram.name = 'ram';
  for (const sx of [-1, 1]) {
    R.add('gunmetal', at(cyl(0.145, 0.145, 1.25, ramSeg), sx * 0.34, 2.6, 0));
    if (L.at(3)) R.add('darkSteel', at(cyl(0.19, 0.19, 0.1, ramSeg), sx * 0.34, 2.04, 0));
  }
  R.add('darkSteel', at(cbox(1.14, 0.2, 0.72, L), 0, 1.9, 0));
  R.add('gunmetal', at(cbox(0.62, 0.14, 0.52, L), 0, 1.74, 0));
  hazardBand(R, L, 0.8, 0.1, 0, 1.9, 0.37, 0);
  R.build(m, ram, lamps);
  group.add(ram);

  return {
    group,
    colliders: [
      { min: [-1.05, 0, -0.9], max: [1.05, 0.28, 0.9] },
      { min: [-0.55, 0.26, -0.48], max: [0.55, 0.94, 0.48] },
      { min: [-0.95, 0.14, -0.28], max: [-0.61, 3.24, 0.28] },
      { min: [0.61, 0.14, -0.28], max: [0.95, 3.24, 0.28] },
      { min: [-1.13, 3.21, -0.56], max: [1.13, 3.78, 0.5] },
    ],
    sockets: [
      { name: 'vent', at: [0, ventY, -0.56] },
      { name: 'chute', at: [0, 4.26, 0] },
      { name: 'power', at: power },
    ],
    lamps,
    parts: { ram },
  };
}

/* ------------------------------------------------------------------ *
 * 2. heavy projector — octagonal mast, yoke, tilting faceted lamp head
 * ------------------------------------------------------------------ */

const TILT = 0.4363; // 25 degrees up
const HEAD_Y = 4.1;

export function heavyProjector(m: LabMaterials, o: GearOptions = {}): Gear {
  const L = lod(o.stage);
  const P = new Pile(L.flat);
  const group = new THREE.Group();
  group.name = 'heavyProjector';
  const lamps: THREE.Mesh[] = [];

  const power = groundKit(P, L, {
    w: 1.5,
    d: 1.5,
    collar: 0.52,
    boltR: 0.66,
    boltN: 4,
    boltOffset: 0,
    glandX: -0.45,
    glandZ: 0.64,
  });

  /* short armoured octagonal mast, one facet facing +z */
  const facet = Math.PI / 8;
  P.add('gunmetal', at(cyl(0.46, 0.46, 2.92, 8), 0, 1.72, 0, 0, facet));
  P.add('gunmetal', at(cyl(0.52, 0.52, 0.14, 8), 0, 3.17, 0, 0, facet));
  if (L.at(3)) {
    for (let i = 0; i < 4; i++) {
      const f = (i * Math.PI) / 2;
      // gussets on the cardinal faces, armour plates on the diagonals
      P.add('gunmetal', at(cbox(0.08, 0.42, 0.36, L), Math.sin(f) * 0.53, 0.35, Math.cos(f) * 0.53, 0, f, 0));
      const d = f + Math.PI / 4;
      P.add('darkSteel', at(cbox(0.34, 1.5, 0.07, L), Math.sin(d) * 0.44, 1.72, Math.cos(d) * 0.44, 0, d, 0));
    }
  }
  P.add('hazard', at(cyl(0.5, 0.5, 0.2, 8), 0, 0.75, 0, 0, facet));
  if (L.at(3)) {
    for (let i = 0; i < 4; i++) {
      const d = (i * Math.PI) / 2 + Math.PI / 4;
      P.add('darkSteel', at(box(0.1, 0.14, 0.04), Math.sin(d) * 0.47, 0.75, Math.cos(d) * 0.47, 0, d, 0.6));
    }
  }
  if (L.at(4)) {
    P.add('rubber', strut([-0.45, 0.32, 0.72], [-0.2, 1.5, 0.42], 0.045, L.seg(6, 8)));
    P.add('darkSteel', at(box(0.14, 0.1, 0.1), -0.2, 1.52, 0.44));
  }

  /* yoke */
  P.add('gunmetal', at(cbox(1.4, 0.18, 0.6, L), 0, 3.3, 0));
  for (const sx of [-1, 1]) P.add('gunmetal', at(cbox(0.18, 1.0, 0.52, L), sx * 0.58, 3.86, 0));

  statusLamps(P, L, 0, 2.55, 0.435, 0);
  P.build(m, group, lamps);

  /* lamp head: group origin is the yoke tilt axis, the game drives rotation.x */
  const H = new Pile(L.flat);
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, HEAD_Y, 0);
  // negative rotation.x swings the +z lens upward
  head.rotation.x = -TILT;

  H.add('gunmetal', at(cbox(0.92, 0.96, 0.92, L), 0, 0, 0));
  for (const sx of [-1, 1]) H.add('darkSteel', at(cyl(0.09, 0.09, 0.14, L.seg(6, 12)), sx * 0.5, 0, 0, 0, 0, HALF_PI));
  /* faceted lens facing +z, hood and cover glass */
  H.lamp('lens', HUE_LENS, at(cyl(0.34, 0.34, 0.14, 8), 0, 0, 0.51, HALF_PI));
  H.add('gunmetal', at(cyl(0.42, 0.38, 0.22, 8, true), 0, 0, 0.52, HALF_PI));
  H.add('glass', at(cyl(0.345, 0.345, 0.03, L.seg(8, 16)), 0, 0, 0.585, HALF_PI));
  /* stepped vent band round the BACK rim, heat-sink fins behind it */
  H.add('gunmetal', at(cbox(0.8, 0.84, 0.16, L), 0, 0, -0.53));
  const fins = L.rep(3, 8);
  for (let i = 0; i < fins; i++) {
    const fy = fins <= 1 ? 0 : -0.33 + (i / (fins - 1)) * 0.66;
    H.add('darkSteel', at(box(0.72, 0.04, 0.14), 0, fy, -0.67));
  }
  const perSide = L.rep(1, 3);
  for (let i = 0; i < perSide; i++) {
    const u = perSide <= 1 ? 0 : -0.26 + (i / (perSide - 1)) * 0.52;
    H.lamp('projVent', HUE_PROJECTOR, at(box(0.07, 0.05, 0.06), u, 0.425, -0.53));
    H.lamp('projVent', HUE_PROJECTOR, at(box(0.07, 0.05, 0.06), u, -0.425, -0.53));
    H.lamp('projVent', HUE_PROJECTOR, at(box(0.05, 0.07, 0.06), 0.405, u, -0.53));
    H.lamp('projVent', HUE_PROJECTOR, at(box(0.05, 0.07, 0.06), -0.405, u, -0.53));
  }
  H.build(m, head, lamps);
  group.add(head);

  const cs = Math.cos(TILT);
  const sn = Math.sin(TILT);
  const headPoint = (ly: number, lz: number): Vec3 => [0, HEAD_Y + ly * cs + lz * sn, lz * cs - ly * sn];

  return {
    group,
    colliders: [
      { min: [-0.75, 0, -0.75], max: [0.75, 0.28, 0.78] },
      { min: [-0.5, 0.26, -0.5], max: [0.5, 3.24, 0.5] },
      { min: [-0.7, 3.21, -0.3], max: [0.7, 4.36, 0.3] },
      { min: [-0.5, 3.45, -0.8], max: [0.5, 4.8, 0.8] },
    ],
    sockets: [
      { name: 'vent', at: headPoint(0, -0.66) },
      { name: 'lens', at: headPoint(0, 0.62) },
      { name: 'power', at: power },
    ],
    lamps,
    parts: { head },
  };
}

/* ------------------------------------------------------------------ *
 * 3. heavy water maker — ribbed tank in a two-saddle cradle
 * ------------------------------------------------------------------ */

const TANK_Y = 2.15;
const TANK_R = 0.85;

export function heavyWater(m: LabMaterials, o: GearOptions = {}): Gear {
  const L = lod(o.stage);
  const P = new Pile(L.flat);
  const group = new THREE.Group();
  group.name = 'heavyWater';
  const lamps: THREE.Mesh[] = [];

  const power = groundKit(P, L, {
    w: 2.9,
    d: 1.5,
    collar: 0.46,
    boltR: 0.7,
    boltN: 6,
    boltOffset: 0,
    glandX: 0,
    glandZ: 0.64,
  });

  /* cradle: pump block on the collar, two saddles, cross brace */
  P.add('gunmetal', at(cbox(0.7, 0.45, 0.76, L), 0, 0.485, 0));
  for (const sx of [-1, 1]) {
    P.add('gunmetal', at(cbox(0.56, 1.42, 1.2, L), sx * 1.1, 0.85, 0));
    if (L.at(3)) {
      P.add('darkSteel', at(box(0.6, 0.36, 0.1), sx * 1.1, 1.528, 0.622, 0.785));
      P.add('darkSteel', at(box(0.6, 0.36, 0.1), sx * 1.1, 1.528, -0.622, 2.356));
    }
  }
  P.add('darkSteel', at(cbox(1.7, 0.22, 0.4, L), 0, 0.95, 0));

  /* ribbed condenser tank lying along x */
  const tankSeg = L.seg(8, 16);
  P.add('gunmetal', at(cyl(TANK_R, TANK_R, 4.6, tankSeg), 0, TANK_Y, 0, 0, 0, HALF_PI));
  for (const sx of [-1, 1]) {
    P.add('gunmetal', at(cyl(0.62, TANK_R, 0.3, tankSeg), sx * 2.44, TANK_Y, 0, 0, 0, -sx * HALF_PI));
    P.add('darkSteel', at(cyl(0.64, 0.64, 0.1, L.seg(6, 12)), sx * 2.62, TANK_Y, 0, 0, 0, HALF_PI));
    if (L.at(4)) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        P.add('gunmetal', at(cyl(0.045, 0.05, 0.06, 6), sx * 2.68, TANK_Y + Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0, 0, HALF_PI));
      }
    }
  }
  const ribX = [-1.75, 1.75, -0.68, 0.68, -2.05, 2.05];
  const ribs = L.rep(2, 6);
  for (let i = 0; i < ribs; i++) {
    P.add('darkSteel', at(cyl(0.9, 0.9, 0.12, L.seg(6, 16)), ribX[i] ?? 0, TANK_Y, 0, 0, 0, HALF_PI));
  }

  /* copper pipe runs along the tank */
  const pipeSeg = L.seg(6, 12);
  P.add('copper', at(cyl(0.09, 0.09, 4.0, pipeSeg), 0, 2.76, 0.46, 0, 0, HALF_PI));
  P.add('copper', at(cyl(0.07, 0.07, 0.72, pipeSeg), 0.2, 1.01, 0.3));
  if (L.at(3)) {
    for (const px of [-1.4, -0.4, 0.4, 1.4]) P.add('darkSteel', at(box(0.1, 0.16, 0.1), px, 2.8, 0.46));
  }
  if (L.at(4)) {
    for (const sx of [-1, 1]) P.add('copper', strut([sx * 1.95, 2.76, 0.46], [sx * 2.4, 2.4, 0.3], 0.07, pipeSeg));
  }

  /* gravel intake hopper low on the +x end, braced to the tank end plate */
  const hopSeg = L.seg(6, 10);
  const hx = 3.05;
  P.add('gunmetal', at(cyl(0.52, 0.26, 0.56, hopSeg), hx, 1.21, 0));
  P.add('paint', at(cyl(0.28, 0.36, 0.12, hopSeg), hx, 1.52, 0), GRAVEL);
  for (const sz of [-1, 1]) P.add('darkSteel', at(cbox(0.45, 0.6, 0.08, L), 2.825, 1.6, sz * 0.42));
  P.add('gunmetal', at(box(0.26, 0.87, 0.26), hx, 0.515, 0));
  P.add('darkSteel', at(cbox(0.5, 0.1, 0.5, L), hx, 0.05, 0));
  const stones = L.rep(3, 9);
  for (let i = 0; i < stones; i++) {
    const a = hash(i) * TAU;
    const rad = 0.04 + hash(i + 31) * 0.18;
    const s = 0.09 + hash(i + 67) * 0.05;
    P.add(
      'paint',
      at(
        box(s, s * 0.8, s),
        hx + Math.cos(a) * rad,
        1.54 + hash(i + 97) * 0.04,
        Math.sin(a) * rad,
        hash(i + 13) * TAU,
        hash(i + 53) * TAU,
        hash(i + 83) * TAU,
      ),
      GRAVEL,
    );
  }

  /* round pressure gauge on the front of the tank */
  const gSeg = L.seg(6, 12);
  P.add('gunmetal', at(cyl(0.26, 0.26, 0.12, gSeg), -0.2, TANK_Y, 0.84, HALF_PI));
  P.add('darkSteel', at(cyl(0.21, 0.21, 0.09, gSeg), -0.2, TANK_Y, 0.925, HALF_PI));
  P.add('paint', at(cyl(0.175, 0.175, 0.03, gSeg), -0.2, TANK_Y, 0.96, HALF_PI), DIAL);
  if (L.at(3)) {
    P.add('darkSteel', at(box(0.018, 0.13, 0.02), -0.2, TANK_Y + 0.04, 0.978, 0, 0, 0.7));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      P.add('darkSteel', at(box(0.016, 0.03, 0.016), -0.2 + Math.cos(a) * 0.14, TANK_Y + Math.sin(a) * 0.14, 0.973, 0, 0, a));
    }
  }

  /* louvred vent box on the TOP REAR, cyan pixels rising out of it */
  P.push(m4(0, 2.99, -0.485, -0.5236, 0, 0));
  P.add('darkSteel', at(cbox(1.0, 0.34, 0.5, L), 0, 0, 0));
  const vSlats = L.rep(2, 4);
  for (let i = 0; i < vSlats; i++) {
    const vz = vSlats <= 1 ? 0 : -0.19 + (i / (vSlats - 1)) * 0.38;
    P.add('gunmetal', at(box(0.86, 0.05, 0.06), 0, 0.19, vz, 0.5));
  }
  const vRows = Math.max(1, vSlats - 1);
  const vCols = L.rep(3, 4);
  for (let r = 0; r < vRows; r++) {
    for (let c = 0; c < vCols; c++) {
      const rz = -0.19 + ((r + 0.5) / vRows) * 0.38;
      const cx = vCols <= 1 ? 0 : -0.35 + (c / (vCols - 1)) * 0.7;
      P.lamp('waterVent', HUE_WATER, at(box(0.07, 0.03, 0.04), cx, 0.175, rz));
    }
  }
  P.pop();

  hazardBand(P, L, 0.46, 0.12, -1.1, 0.95, 0.61, 0);
  hazardBand(P, L, 0.46, 0.12, 1.1, 0.95, 0.61, 0);
  hazardBand(P, L, 0.8, 0.1, -0.95, 0.08, 0.755, 0);
  statusLamps(P, L, 1.1, 1.2, 0.615, 0);

  P.build(m, group, lamps);

  return {
    group,
    colliders: [
      { min: [-1.45, 0, -0.75], max: [1.45, 0.28, 0.78] },
      { min: [-1.38, 0.14, -0.6], max: [-0.82, 1.56, 0.6] },
      { min: [0.82, 0.14, -0.6], max: [1.38, 1.56, 0.6] },
      { min: [-2.71, 1.3, -0.9], max: [2.71, 3.0, 0.99] },
      { min: [2.5, 0, -0.56], max: [3.6, 1.66, 0.56] },
    ],
    sockets: [
      { name: 'vent', at: [0, 3.155, -0.58] },
      { name: 'hopper', at: [hx, 1.6, 0] },
      { name: 'power', at: power },
    ],
    lamps,
  };
}
