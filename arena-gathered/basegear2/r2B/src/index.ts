import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

type V3 = [number, number, number];
type Options = { stage: number };

export function createMaterials(): LabMaterials {
  return {
    gunmetal: new THREE.MeshStandardMaterial({ color: 0x36454b, metalness: 0.76, roughness: 0.42, flatShading: true }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x19272d, metalness: 0.69, roughness: 0.57, flatShading: true }),
    paint: new THREE.MeshStandardMaterial({ color: 0xa0aaa2, metalness: 0.48, roughness: 0.53, flatShading: true }),
    copper: new THREE.MeshStandardMaterial({ color: 0xd38557, metalness: 0.64, roughness: 0.41, flatShading: true }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x385d50, metalness: 0.08, roughness: 0.84, flatShading: true }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xe6b455, metalness: 0.32, roughness: 0.56, flatShading: true }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x777e7b, metalness: 0.02, roughness: 0.94, flatShading: true }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xa5e5eb, metalness: 0.05, roughness: 0.21, clearcoat: 0.7, transmission: 0 }),
  };
}

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const material = lamp.material;
  if (material instanceof THREE.MeshStandardMaterial) {
    material.emissive.copy(material.color).multiplyScalar(THREE.MathUtils.clamp(glow, 0, 1));
    material.emissiveIntensity = 1;
  }
}

export function triangles(g: Gear): number {
  let count = 0;
  g.group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geometry = child.geometry;
      count += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    }
  });
  return count;
}

function detail(stage: number) {
  const n = THREE.MathUtils.clamp(Math.floor(stage), 0, 6);
  return {
    fine: n > 1,
    radial: n <= 1 ? 8 : 8 + n * 2,
    small: n <= 1 ? 5 : 5 + n,
    bolts: n <= 1 ? 4 : 4 + n * 2,
    ribs: n <= 1 ? 3 : n + 3,
    louvers: n <= 1 ? 3 : n + 3,
    towerBays: n <= 1 ? 1 : n,
    oreSteps: n <= 1 ? 2 : n + 1,
  };
}

// Every primitive is normalized before batching; even custom geometry carries uv and normals.
class Assembly {
  private readonly batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private readonly lampMaterials: THREE.MeshPhysicalMaterial[] = [];

  constructor(private readonly materials: LabMaterials) {}

  add(material: THREE.Material, geometry: THREE.BufferGeometry, at: V3 = [0, 0, 0], rotation?: THREE.Quaternion): void {
    const ready = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(ready.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') ready.deleteAttribute(name);
    }
    const position = ready.getAttribute('position');
    if (!position) throw new Error('A gear part has no positions');
    if (!ready.getAttribute('normal')) ready.computeVertexNormals();
    if (!ready.getAttribute('uv')) ready.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(position.count * 2), 2));
    ready.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(...at), rotation ?? new THREE.Quaternion(), new THREE.Vector3(1, 1, 1),
    ));
    const parts = this.batches.get(material) ?? [];
    parts.push(ready);
    this.batches.set(material, parts);
  }

  lamp(color: number): THREE.MeshPhysicalMaterial {
    const material = this.materials.glass.clone();
    material.color.setHex(color);
    material.emissive.setHex(color);
    material.emissiveIntensity = 0.82;
    material.transmission = 0;
    this.lampMaterials.push(material);
    return material;
  }

  finish(colliders: Box[], sockets: Socket[]): Gear {
    const group = new THREE.Group();
    const lamps: THREE.Mesh[] = [];
    for (const [material, parts] of this.batches) {
      const geometry = mergeGeometries(parts, false);
      if (!geometry) throw new Error('Could not merge gear geometry');
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      if (this.lampMaterials.includes(material as THREE.MeshPhysicalMaterial)) lamps.push(mesh);
    }
    return { group, colliders, sockets, lamps };
  }
}

function block(a: Assembly, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number): void {
  a.add(material, new THREE.BoxGeometry(w, h, d), [x, y, z]);
}

function chamfer(a: Assembly, material: THREE.Material, x: number, bottom: number, z: number, w: number, h: number, d: number, c: number): void {
  const hx = w / 2;
  const hz = d / 2;
  const cut = Math.min(c, hx * 0.45, hz * 0.45);
  const shape = new THREE.Shape();
  shape.moveTo(-hx + cut, -hz);
  shape.lineTo(hx - cut, -hz);
  shape.lineTo(hx, -hz + cut);
  shape.lineTo(hx, hz - cut);
  shape.lineTo(hx - cut, hz);
  shape.lineTo(-hx + cut, hz);
  shape.lineTo(-hx, hz - cut);
  shape.lineTo(-hx, -hz + cut);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: h, steps: 1, bevelEnabled: false, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  a.add(material, geometry, [x, bottom, z]);
}

function cylinder(a: Assembly, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, sides: number): void {
  a.add(material, new THREE.CylinderGeometry(radius, radius, height, sides), [x, y, z]);
}

function torus(a: Assembly, material: THREE.Material, x: number, y: number, z: number, radius: number, tube: number, sides: number): void {
  const geometry = new THREE.TorusGeometry(radius, tube, Math.max(4, Math.floor(sides / 2)), sides);
  geometry.rotateX(Math.PI / 2);
  a.add(material, geometry, [x, y, z]);
}

function glandRing(a: Assembly, material: THREE.Material, x: number, y: number, z: number, sides: number): void {
  const geometry = new THREE.TorusGeometry(0.18, 0.025, Math.max(4, Math.floor(sides / 2)), sides);
  geometry.rotateY(Math.PI / 2);
  a.add(material, geometry, [x, y, z]);
}

function beam(a: Assembly, material: THREE.Material, start: V3, end: V3, width: number, depth: number): void {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const delta = to.clone().sub(from);
  a.add(material, new THREE.BoxGeometry(width, delta.length(), depth),
    [from.x + delta.x / 2, from.y + delta.y / 2, from.z + delta.z / 2],
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
}

function wire(a: Assembly, material: THREE.Material, start: V3, end: V3, radius: number, sides: number): void {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const delta = to.clone().sub(from);
  a.add(material, new THREE.CylinderGeometry(radius, radius, delta.length(), sides),
    [from.x + delta.x / 2, from.y + delta.y / 2, from.z + delta.z / 2],
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
}

function annulus(a: Assembly, material: THREE.Material, x: number, bottom: number, z: number, outer: number, inner: number, height: number, sides: number): void {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, steps: 1, curveSegments: sides, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  a.add(material, geometry, [x, bottom, z]);
}

function rivet(a: Assembly, material: THREE.Material, x: number, surface: number, z: number, radius: number, sides: number): void {
  cylinder(a, material, x, surface + 0.025, z, radius, 0.05, sides);
}

function faceGeometry(): { positions: number[]; uvs: number[]; quad: (p: V3, q: V3, r: V3, s: V3) => void; finish: () => THREE.BufferGeometry } {
  const positions: number[] = [];
  const uvs: number[] = [];
  const vertex = (p: V3, u: number, v: number) => { positions.push(...p); uvs.push(u, v); };
  const quad = (p: V3, q: V3, r: V3, s: V3) => {
    vertex(p, 0, 0); vertex(q, 1, 0); vertex(r, 1, 1);
    vertex(p, 0, 0); vertex(r, 1, 1); vertex(s, 0, 1);
  };
  const finish = () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return geometry;
  };
  return { positions, uvs, quad, finish };
}

// A real opening in the front surface makes the door sit behind, not over, the chassis.
function recessedShell(w: number, d: number, bottom: number, top: number, cut: number, doorW: number, doorBottom: number, doorTop: number, inset: number): THREE.BufferGeometry {
  const x = w / 2;
  const z = d / 2;
  const outline: Array<[number, number]> = [
    [-x + cut, -z], [x - cut, -z], [x, -z + cut], [x, z - cut],
    [x - cut, z], [-x + cut, z], [-x, z - cut], [-x, -z + cut],
  ];
  const f = faceGeometry();
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if (!a || !b) continue;
    if (a[1] !== z || b[1] !== z) {
      f.quad([a[0], bottom, a[1]], [a[0], top, a[1]], [b[0], top, b[1]], [b[0], bottom, b[1]]);
    }
    f.positions.push(0, top, 0, b[0], top, b[1], a[0], top, a[1]);
    f.uvs.push(0.5, 0.5, 1, 1, 0, 1);
    f.positions.push(0, bottom, 0, a[0], bottom, a[1], b[0], bottom, b[1]);
    f.uvs.push(0.5, 0.5, 0, 1, 1, 1);
  }
  const front = (left: number, right: number, low: number, high: number) =>
    f.quad([left, low, z], [right, low, z], [right, high, z], [left, high, z]);
  front(-x + cut, -doorW / 2, bottom, top);
  front(doorW / 2, x - cut, bottom, top);
  front(-doorW / 2, doorW / 2, bottom, doorBottom);
  front(-doorW / 2, doorW / 2, doorTop, top);
  const back = z - inset;
  f.quad([-doorW / 2, doorBottom, z], [-doorW / 2, doorBottom, back], [-doorW / 2, doorTop, back], [-doorW / 2, doorTop, z]);
  f.quad([doorW / 2, doorBottom, back], [doorW / 2, doorBottom, z], [doorW / 2, doorTop, z], [doorW / 2, doorTop, back]);
  f.quad([-doorW / 2, doorBottom, z], [doorW / 2, doorBottom, z], [doorW / 2, doorBottom, back], [-doorW / 2, doorBottom, back]);
  f.quad([doorW / 2, doorTop, z], [-doorW / 2, doorTop, z], [-doorW / 2, doorTop, back], [doorW / 2, doorTop, back]);
  return f.finish();
}

function squareRingFrustum(a: Assembly, outside: THREE.Material, inside: THREE.Material, rim: THREE.Material,
  cx: number, cz: number, base: number, top: number, outer0: number, outer1: number, inner0: number, inner1: number): void {
  const corners = (half: number): Array<[number, number]> => [
    [-half, -half], [half, -half], [half, half], [-half, half],
  ];
  const lowOut = corners(outer0);
  const highOut = corners(outer1);
  const lowIn = corners(inner0);
  const highIn = corners(inner1);
  const exterior = faceGeometry();
  const interior = faceGeometry();
  const edge = faceGeometry();
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const lo = lowOut[i]; const lon = lowOut[j];
    const hi = highOut[i]; const hin = highOut[j];
    const li = lowIn[i]; const lin = lowIn[j];
    const ti = highIn[i]; const tin = highIn[j];
    if (!lo || !lon || !hi || !hin || !li || !lin || !ti || !tin) continue;
    exterior.quad([lo[0], base, lo[1]], [hi[0], top, hi[1]], [hin[0], top, hin[1]], [lon[0], base, lon[1]]);
    interior.quad([lin[0], base, lin[1]], [tin[0], top, tin[1]], [ti[0], top, ti[1]], [li[0], base, li[1]]);
    edge.quad([hi[0], top, hi[1]], [ti[0], top, ti[1]], [tin[0], top, tin[1]], [hin[0], top, hin[1]]);
  }
  a.add(outside, exterior.finish(), [cx, 0, cz]);
  a.add(inside, interior.finish(), [cx, 0, cz]);
  a.add(rim, edge.finish(), [cx, 0, cz]);
}

function oreMound(steps: number): THREE.BufferGeometry {
  const f = faceGeometry();
  const extent = 0.974;
  const height = (x: number, z: number) => {
    const edge = Math.max(Math.abs(x), Math.abs(z)) / extent;
    const irregular = 0.045 * Math.sin(x * 17 + z * 11) * Math.cos(z * 13 - x * 7);
    return 3.55 + (1 - edge) * (0.52 + irregular);
  };
  for (let iz = 0; iz < steps; iz++) for (let ix = 0; ix < steps; ix++) {
    const x0 = -extent + (2 * extent * ix) / steps;
    const x1 = -extent + (2 * extent * (ix + 1)) / steps;
    const z0 = -extent + (2 * extent * iz) / steps;
    const z1 = -extent + (2 * extent * (iz + 1)) / steps;
    const p: V3 = [x0, height(x0, z0), z0];
    const q: V3 = [x1, height(x1, z0), z0];
    const r: V3 = [x1, height(x1, z1), z1];
    const s: V3 = [x0, height(x0, z1), z1];
    // Reversed x/z winding points the broken ore facets upward.
    f.quad(s, r, q, p);
  }
  return f.finish();
}

export function hardpoint(m: LabMaterials, options: Options): Gear {
  const d = detail(options.stage);
  const a = new Assembly(m);
  chamfer(a, m.concrete, 4, 0, 4, 8, 0.16, 8, 0.12);
  cylinder(a, m.gunmetal, 4, 0.26, 4, 1.55, 0.20, d.radial);
  cylinder(a, m.paint, 4, 0.475, 4, 1.24, 0.37, d.radial);
  cylinder(a, m.darkSteel, 4, 0.685, 4, 0.97, 0.05, d.radial);
  annulus(a, m.gunmetal, 4, 0.62, 4, 1.37, 0.98, 0.16, d.radial);
  torus(a, m.copper, 4, 0.765, 4, 1.16, 0.027, d.radial);
  for (let i = 0; i < d.bolts; i++) {
    const angle = (i / d.bolts) * Math.PI * 2;
    rivet(a, m.hazard, 4 + Math.cos(angle) * 1.45, 0.36, 4 + Math.sin(angle) * 1.45, 0.068, d.small);
  }

  const green = m.rubber.clone();
  green.color.setHex(0x67af84);
  for (const [index, z] of [3.22, 4.78].entries()) {
    // Glands bite into the housing; the cable lies in, rather than above, its floor trough.
    wire(a, m.gunmetal, [5.01, 0.365, z], [5.59, 0.365, z], 0.18, d.radial);
    glandRing(a, m.copper, 5.57, 0.365, z, d.radial);
    block(a, m.darkSteel, 6.74, 0.21, z, 2.50, 0.10, 0.31);
    wire(a, index === 0 ? m.copper : green, [5.53, 0.35, z], [7.94, 0.35, z], 0.10, d.radial);
    for (const side of [-1, 1]) {
      block(a, m.gunmetal, 6.74, 0.28, z + side * 0.205, 2.50, 0.24, 0.11);
      for (let j = 0; j < d.ribs; j++) {
        const x = 5.64 + (2.20 * j) / Math.max(1, d.ribs - 1);
        block(a, m.paint, x, 0.415, z + side * 0.205, 0.09, 0.035, 0.125);
      }
    }
  }
  if (d.fine) {
    for (const z of [0.32, 7.68]) {
      block(a, m.darkSteel, 4, 0.164, z, 7.28, 0.009, 0.025);
    }
    for (const x of [0.32, 7.68]) {
      block(a, m.darkSteel, x, 0.164, 4, 0.025, 0.009, 7.28);
    }
  }
  return a.finish(
    [
      { min: [0, 0, 0], max: [8, 0.16, 8] },
      { min: [2.45, 0.16, 2.45], max: [5.55, 0.79, 5.55] },
      { min: [5.49, 0.16, 2.96], max: [7.99, 0.44, 3.48] },
      { min: [5.49, 0.16, 4.52], max: [7.99, 0.44, 5.04] },
    ],
    [{ name: 'mount', at: [4, 0.78, 4] }, { name: 'power', at: [7.96, 0.35, 3.22] }],
  );
}

export function heavyMill(m: LabMaterials, options: Options): Gear {
  const d = detail(options.stage);
  const a = new Assembly(m);
  chamfer(a, m.gunmetal, 0, 0, 0, 3.52, 0.15, 3.17, 0.17);
  for (const x of [-1.31, 1.31]) for (const z of [-1.15, 1.15]) {
    if (d.fine) chamfer(a, m.darkSteel, x, 0.14, z, 0.36, 0.29, 0.36, 0.045);
    else block(a, m.darkSteel, x, 0.285, z, 0.36, 0.29, 0.36);
    if (d.fine) rivet(a, m.hazard, x * 1.27, 0.15, z * 1.19, 0.065, d.small);
    else block(a, m.hazard, x * 1.27, 0.178, z * 1.19, 0.13, 0.056, 0.13);
  }
  a.add(m.paint, recessedShell(3.2, 2.9, 0.40, 3.33, 0.17, 1.64, 0.83, 2.62, 0.22));
  chamfer(a, m.gunmetal, 0, 0.84, 1.215, 1.60, 1.77, 0.07, 0.035);
  // The four lines are a raised compression seal inside the cutout.
  for (const x of [-0.74, 0.74]) block(a, m.rubber, x, 1.725, 1.255, 0.022, 1.62, 0.018);
  for (const y of [0.91, 2.54]) block(a, m.rubber, 0, y, 1.255, 1.50, 0.025, 0.018);
  for (const y of [1.12, 2.31]) {
    block(a, m.copper, -0.78, y, 1.275, 0.13, 0.18, 0.07);
  }
  block(a, m.darkSteel, 0.50, 1.73, 1.272, 0.11, 0.42, 0.055);
  block(a, m.copper, 0.50, 1.73, 1.33, 0.055, 0.34, 0.08);
  for (const x of [-1.25, 1.25]) block(a, m.gunmetal, x, 1.80, 1.463, 0.027, 2.40, 0.027);
  block(a, m.gunmetal, 0, 3.19, 1.466, 2.52, 0.026, 0.028);

  // Side-mounted exhaust: a dark throat, angled metal louvers, and lit pixel outlets.
  block(a, m.darkSteel, 1.625, 2.28, -0.48, 0.06, 1.12, 1.30);
  for (const y of [1.70, 2.86]) block(a, m.gunmetal, 1.666, y, -0.48, 0.08, 0.065, 1.39);
  for (const z of [-1.15, 0.19]) block(a, m.gunmetal, 1.665, 2.28, z, 0.08, 1.22, 0.065);
  for (let i = 0; i < d.louvers; i++) {
    const y = 1.80 + (0.98 * i) / Math.max(1, d.louvers - 1);
    block(a, m.gunmetal, 1.695, y, -0.48, 0.09, 0.055, 1.19);
  }

  squareRingFrustum(a, m.paint, m.gunmetal, m.copper, 0, 0, 3.32, 4.16, 1.05, 1.32, 0.90, 1.16);
  chamfer(a, m.darkSteel, 0, 3.33, 0, 1.80, 0.22, 1.80, 0.025);
  a.add(m.darkSteel, oreMound(d.oreSteps));
  if (d.fine) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      beam(a, m.gunmetal, [sx * 1.045, 3.32, sz * 1.045], [sx * 1.32, 4.16, sz * 1.32], 0.067, 0.067);
    }
    for (const x of [-1.58, 1.58]) {
      for (const y of [0.65, 1.14, 1.63, 2.12, 2.61, 3.10]) {
        block(a, m.copper, x, y, 0.64, 0.025, 0.09, 0.09);
      }
    }
  }

  const pink = a.lamp(0xf385a6);
  const mint = a.lamp(0x85e3bf);
  for (const [x, color] of [[-0.44, pink], [0.44, mint]] as const) {
    const bezel = new THREE.CylinderGeometry(0.115, 0.115, 0.08, d.radial);
    bezel.rotateX(Math.PI / 2);
    a.add(m.darkSteel, bezel, [x, 3.05, 1.48]);
    a.add(color, new THREE.SphereGeometry(0.078, d.radial, d.small), [x, 3.05, 1.54]);
  }
  for (let i = 0; i < (d.fine ? 7 : 3); i++) {
    const y = 1.80 + (0.98 * (d.fine ? i + 1 : i)) / Math.max(1, d.louvers - 1);
    const z = -0.83 + (i % 3) * 0.30;
    block(a, pink, 1.746, y, z, 0.044, 0.044, 0.044);
  }
  return a.finish(
    [{ min: [-1.76, 0, -1.585], max: [1.76, 3.33, 1.585] }, { min: [-1.32, 3.33, -1.32], max: [1.32, 4.16, 1.32] }],
    [{ name: 'vent', at: [1.76, 2.28, -0.48] }, { name: 'hopper', at: [0, 4.16, 0] }, { name: 'power', at: [0, 0.10, -1.58] }],
  );
}

export function bin(m: LabMaterials, options: Options): Gear {
  const d = detail(options.stage);
  const a = new Assembly(m);
  for (const x of [-0.59, 0.59]) for (const z of [-0.52, 0.52]) {
    chamfer(a, m.gunmetal, 2 + x, 0, 2 + z, 0.23, 0.30, 0.23, 0.025);
  }
  a.add(m.paint, recessedShell(1.6, 1.44, 0.26, 1.64, 0.10, 1.12, 0.47, 1.41, 0.13), [2, 0, 2]);
  chamfer(a, m.gunmetal, 2, 0.48, 2.584, 1.08, 0.92, 0.055, 0.025);
  for (const y of [0.59, 1.28]) block(a, m.copper, 1.46, y, 2.623, 0.10, 0.12, 0.045);
  block(a, m.darkSteel, 2.31, 0.99, 2.632, 0.245, 0.34, 0.053);
  if (d.fine) {
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
      block(a, row === 0 && col === 2 ? m.hazard : m.paint,
        2.225 + col * 0.080, 1.103 - row * 0.077, 2.666, 0.047, 0.044, 0.019);
    }
  } else {
    block(a, m.hazard, 2.31, 1.09, 2.669, 0.13, 0.035, 0.02);
  }
  block(a, m.darkSteel, 1.73, 0.94, 2.626, 0.10, 0.35, 0.065);
  block(a, m.copper, 1.73, 0.94, 2.683, 0.045, 0.24, 0.065);
  block(a, m.darkSteel, 2.81, 1.02, 2.00, 0.048, 0.50, 0.76);
  for (let i = 0; i < d.louvers; i++) {
    block(a, m.gunmetal, 2.843, 0.81 + i * 0.40 / Math.max(1, d.louvers - 1), 2.0, 0.038, 0.026, 0.67);
  }
  cylinder(a, m.gunmetal, 2, 1.80, 2, 0.068, 0.35, d.radial);
  cylinder(a, m.copper, 2, 1.975, 2, 0.13, 0.05, d.radial);
  cylinder(a, m.copper, 2, 2.052, 2, 0.036, 0.105, d.radial);
  const dish = new THREE.LatheGeometry([
    new THREE.Vector2(0.035, 0), new THREE.Vector2(0.115, 0.014),
    new THREE.Vector2(0.21, 0.065), new THREE.Vector2(0.30, 0.15),
  ], d.radial);
  a.add(m.gunmetal, dish, [2, 2.00, 2]);
  torus(a, m.copper, 2, 2.15, 2, 0.29, 0.021, d.radial);
  const emitter = a.lamp(0x92e2f0);
  a.add(emitter, new THREE.SphereGeometry(0.077, d.radial, d.small), [2, 2.092, 2]);
  return a.finish(
    [{ min: [1.2, 0, 1.28], max: [2.8, 1.64, 2.72] }, { min: [1.69, 1.64, 1.69], max: [2.31, 2.18, 2.31] }],
    [{ name: 'link', at: [2, 2.15, 2] }],
  );
}

export function repeater(m: LabMaterials, options: Options): Gear {
  const d = detail(options.stage);
  const a = new Assembly(m);
  chamfer(a, m.concrete, 2, 0, 2, 1.6, 0.22, 1.6, 0.11);
  const lower = 0.20;
  const upper = 6.57;
  const halfAt = (y: number) => 0.55 - (0.29 * (y - lower)) / (upper - lower);
  const leg = (sx: number, sz: number, y: number): V3 => [2 + sx * halfAt(y), y, 2 + sz * halfAt(y)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    beam(a, m.gunmetal, leg(sx, sz, lower), leg(sx, sz, upper), d.fine ? 0.105 : 0.14, d.fine ? 0.105 : 0.14);
    if (d.fine) rivet(a, m.hazard, 2 + sx * 0.66, 0.22, 2 + sz * 0.66, 0.067, d.small);
    else block(a, m.hazard, 2 + sx * 0.66, 0.247, 2 + sz * 0.66, 0.13, 0.054, 0.13);
  }
  for (let tier = 0; tier <= d.towerBays; tier++) {
    const y = 0.40 + (6.00 * tier) / d.towerBays;
    for (const sz of [-1, 1]) beam(a, m.darkSteel, leg(-1, sz, y), leg(1, sz, y), 0.07, 0.07);
    for (const sx of [-1, 1]) beam(a, m.darkSteel, leg(sx, -1, y), leg(sx, 1, y), 0.07, 0.07);
  }
  for (let tier = 0; tier < d.towerBays; tier++) {
    const bottom = 0.42 + (5.96 * tier) / d.towerBays;
    const top = 0.42 + (5.96 * (tier + 1)) / d.towerBays;
    for (const side of [-1, 1]) {
      wire(a, m.paint, leg(-1, side, bottom), leg(1, side, top), d.fine ? 0.027 : 0.042, d.small);
      wire(a, m.paint, leg(1, side, bottom), leg(-1, side, top), d.fine ? 0.027 : 0.042, d.small);
      wire(a, m.paint, leg(side, -1, bottom), leg(side, 1, top), d.fine ? 0.027 : 0.042, d.small);
      wire(a, m.paint, leg(side, 1, bottom), leg(side, -1, top), d.fine ? 0.027 : 0.042, d.small);
    }
  }
  chamfer(a, m.darkSteel, 2, 6.52, 2, 0.67, 0.15, 0.67, 0.055);
  chamfer(a, m.gunmetal, 2, 0.22, 2.60, 0.58, 0.94, 0.34, 0.055);
  block(a, m.paint, 2, 0.68, 2.785, 0.42, 0.64, 0.025);
  block(a, m.darkSteel, 2, 0.68, 2.804, 0.35, 0.52, 0.02);
  for (let i = 0; i < (d.fine ? 5 : 2); i++) {
    block(a, m.copper, 1.89 + (i % 2) * 0.20, 0.51 + Math.floor(i / 2) * 0.15, 2.819, 0.055, 0.055, 0.015);
  }
  cylinder(a, m.gunmetal, 2, 6.74, 2, 0.075, 0.32, d.radial);
  for (const side of [-1, 1]) {
    beam(a, m.gunmetal, [2, 6.74, 2], [2 + side * 0.39, 6.74, 2], 0.045, 0.045);
    beam(a, m.gunmetal, [2, 6.74, 2], [2, 6.74, 2 + side * 0.39], 0.045, 0.045);
  }
  torus(a, m.gunmetal, 2, 6.74, 2, 0.39, 0.056, d.radial);
  const ring = a.lamp(0x83ddd5);
  torus(a, ring, 2, 6.80, 2, 0.39, 0.040, d.radial);
  for (let i = 0; i < (d.fine ? 8 : 4); i++) {
    const angle = (i * Math.PI * 2) / (d.fine ? 8 : 4);
    a.add(ring, new THREE.SphereGeometry(0.064, d.fine ? d.small : 4, d.fine ? 4 : 3),
      [2 + Math.cos(angle) * 0.39, 6.81, 2 + Math.sin(angle) * 0.39]);
  }
  cylinder(a, m.darkSteel, 2, 6.875, 2, 0.13, 0.08, d.radial);
  const red = a.lamp(0xff645e);
  a.add(red, new THREE.SphereGeometry(0.108, d.fine ? d.radial : 6, d.fine ? d.small : 4), [2, 6.985, 2]);
  return a.finish(
    [{ min: [1.2, 0, 1.2], max: [2.8, 0.22, 2.8] }, { min: [1.45, 0.22, 1.45], max: [2.55, 7.1, 2.82] }],
    [{ name: 'top', at: [2, 6.99, 2] }, { name: 'box', at: [2, 0.68, 2.83] }],
  );
}

export function draftingTable(m: LabMaterials, options: Options): Gear {
  const d = detail(options.stage);
  const a = new Assembly(m);
  for (const x of [-1.06, 1.06]) for (const z of [-0.46, 0.46]) {
    block(a, m.gunmetal, 2 + x, 0.4825, 2 + z, 0.11, 0.815, 0.11);
    chamfer(a, m.darkSteel, 2 + x, 0, 2 + z, 0.20, 0.075, 0.20, 0.02);
  }
  for (const z of [-0.46, 0.46]) {
    beam(a, m.darkSteel, [0.95, 0.32, 2 + z], [3.05, 0.78, 2 + z], 0.052, 0.052);
    if (d.fine) beam(a, m.darkSteel, [3.05, 0.32, 2 + z], [0.95, 0.78, 2 + z], 0.04, 0.04);
  }
  for (const x of [-1.06, 1.06]) {
    beam(a, m.darkSteel, [2 + x, 0.32, 1.54], [2 + x, 0.75, 2.46], 0.046, 0.046);
  }
  block(a, m.gunmetal, 2, 0.83, 2, 2.24, 0.075, 1.02);
  // Four independent rim pieces leave an actual recess for the lit drawing glass.
  block(a, m.paint, 1.025, 0.935, 2, 0.45, 0.12, 1.20);
  block(a, m.paint, 3.01, 0.935, 2, 0.38, 0.12, 1.20);
  block(a, m.paint, 2.035, 0.935, 1.52, 1.57, 0.12, 0.24);
  block(a, m.paint, 2.035, 0.935, 2.48, 1.57, 0.12, 0.24);
  block(a, m.darkSteel, 2.035, 0.905, 2, 1.61, 0.055, 0.76);
  const screen = a.lamp(0x73d8f4);
  block(a, screen, 2.035, 0.95, 2, 1.49, 0.035, 0.66);
  // Sample cube and material swatch sit directly on the screen, not in midair.
  chamfer(a, m.gunmetal, 1.77, 0.967, 1.88, 0.17, 0.145, 0.17, 0.016);
  block(a, m.copper, 2.33, 0.9845, 2.10, 0.18, 0.035, 0.12);
  block(a, m.hazard, 2.34, 1.006, 2.10, 0.055, 0.008, 0.10);
  chamfer(a, m.darkSteel, 2.88, 0.30, 2.12, 0.46, 0.51, 0.66, 0.045);
  for (const y of [0.47, 0.67]) {
    block(a, m.paint, 2.88, y, 2.459, 0.38, 0.12, 0.02);
    block(a, m.copper, 2.88, y, 2.474, 0.13, 0.025, 0.018);
  }
  for (let i = 0; i < (d.fine ? 7 : 2); i++) {
    const x = 1.35 + i * (0.70 / (d.fine ? 6 : 1));
    block(a, m.darkSteel, x, 1.001, 1.57, 0.016, 0.012, 0.065);
  }
  return a.finish(
    [{ min: [0.8, 0, 1.4], max: [3.2, 0.995, 2.6] }],
    [{ name: 'screen', at: [2.035, 0.967, 2] }],
  );
}
