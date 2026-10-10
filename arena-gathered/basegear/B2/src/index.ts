// src/index.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface LabMaterials {
  gunmetal: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  hazard: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  concrete: THREE.MeshStandardMaterial;
}

export interface Box { min: [number, number, number]; max: [number, number, number] }
export interface Socket { name: string; at: [number, number, number] }
export interface Gear { group: THREE.Group; colliders: Box[]; sockets: Socket[]; lamps: THREE.Mesh[] }
interface Options { stage: number }
type V3 = [number, number, number];

const TAU = Math.PI * 2;

export function createMaterials(): LabMaterials {
  const standard = (
    color: number,
    metalness: number,
    roughness: number,
  ): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      flatShading: true,
    });

  return {
    gunmetal: standard(0x35404a, 0.82, 0.3),
    darkSteel: standard(0x171d22, 0.88, 0.25),
    paint: standard(0xc5c1ae, 0.42, 0.48),
    copper: standard(0xd66b24, 0.72, 0.3),
    rubber: standard(0x17191a, 0.05, 0.88),
    hazard: standard(0x60a83d, 0.16, 0.62),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x72d9ff,
      emissive: 0x174d69,
      emissiveIntensity: 0.45,
      metalness: 0.05,
      roughness: 0.18,
      clearcoat: 0.65,
      clearcoatRoughness: 0.2,
      flatShading: true,
    }),
    concrete: standard(0x777973, 0.02, 0.96),
  };
}

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const value = Math.max(0, Math.min(1, glow));
  const materials = Array.isArray(lamp.material)
    ? lamp.material
    : [lamp.material];

  for (const material of materials) {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.emissiveIntensity = value * 3;
    }
  }
}

export function triangles(g: Gear): number {
  let total = 0;

  g.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry;
    total += geometry.index
      ? geometry.index.count / 3
      : (geometry.getAttribute('position')?.count ?? 0) / 3;
  });

  return total;
}

class Parts {
  readonly group = new THREE.Group();
  readonly lamps: THREE.Mesh[] = [];
  private readonly batches = new Map<
    THREE.Material,
    THREE.BufferGeometry[]
  >();

  constructor(readonly detail: boolean) {}

  private normalized(
    geometry: THREE.BufferGeometry,
  ): THREE.BufferGeometry {
    const result = geometry.index
      ? geometry.toNonIndexed()
      : geometry.clone();

    if (!result.getAttribute('normal')) {
      result.computeVertexNormals();
    }

    if (!result.getAttribute('uv')) {
      const positions = result.getAttribute('position');
      result.setAttribute(
        'uv',
        new THREE.BufferAttribute(
          new Float32Array(positions.count * 2),
          2,
        ),
      );
    }

    for (const name of Object.keys(result.attributes)) {
      if (
        name !== 'position'
        && name !== 'normal'
        && name !== 'uv'
      ) {
        result.deleteAttribute(name);
      }
    }

    result.clearGroups();
    return result;
  }

  add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    at: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
  ): void {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...at),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...rotation),
      ),
      new THREE.Vector3(1, 1, 1),
    );

    geometry.applyMatrix4(matrix);
    const normalized = this.normalized(geometry);
    const found = this.batches.get(material);

    if (found) found.push(normalized);
    else this.batches.set(material, [normalized]);
  }

  lamp(
    geometry: THREE.BufferGeometry,
    color: number,
    at: V3,
    intensity = 1.2,
  ): THREE.Mesh {
    geometry.translate(...at);
    const normalized = this.normalized(geometry);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      metalness: 0.05,
      roughness: 0.28,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(normalized, material);

    mesh.castShadow = true;
    this.group.add(mesh);
    this.lamps.push(mesh);
    return mesh;
  }

  finish(
    name: string,
    colliders: Box[],
    sockets: Socket[],
  ): Gear {
    for (const [material, geometries] of this.batches) {
      const merged = mergeGeometries(geometries, false);
      if (!merged) {
        throw new Error(`Could not merge ${name} geometry`);
      }

      merged.computeVertexNormals();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    this.group.name = name;
    return {
      group: this.group,
      colliders,
      sockets,
      lamps: this.lamps,
    };
  }
}

const box = (
  x: number,
  y: number,
  z: number,
): THREE.BoxGeometry => new THREE.BoxGeometry(x, y, z);

const cyl = (
  r: number,
  h: number,
  detail: boolean,
  open = false,
): THREE.CylinderGeometry =>
  new THREE.CylinderGeometry(
    r,
    r,
    h,
    detail ? 16 : 6,
    1,
    open,
  );

const ring = (
  major: number,
  tube: number,
  detail: boolean,
): THREE.TorusGeometry =>
  new THREE.TorusGeometry(
    major,
    tube,
    detail ? 8 : 3,
    detail ? 20 : 6,
  );

function chamfered(
  x: number,
  y: number,
  z: number,
  cut: number,
): THREE.ExtrudeGeometry {
  const hx = x / 2;
  const hy = y / 2;
  const shape = new THREE.Shape();

  shape.moveTo(-hx + cut, -hy);
  shape.lineTo(hx - cut, -hy);
  shape.lineTo(hx, -hy + cut);
  shape.lineTo(hx, hy - cut);
  shape.lineTo(hx - cut, hy);
  shape.lineTo(-hx + cut, hy);
  shape.lineTo(-hx, hy - cut);
  shape.lineTo(-hx, -hy + cut);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: z,
    bevelEnabled: false,
    curveSegments: 1,
  });

  geometry.translate(0, 0, -z / 2);
  return geometry;
}

function beam(
  parts: Parts,
  a: V3,
  b: V3,
  width: number,
  material: THREE.Material,
): void {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const geometry = box(width, delta.length(), width);

  geometry.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    ),
  );
  geometry.translate(
    ...start.add(end).multiplyScalar(0.5).toArray(),
  );
  parts.add(geometry, material);
}

function boltCircle(
  parts: Parts,
  material: THREE.Material,
  center: V3,
  radius: number,
  y: number,
  count: number,
  detail: boolean,
): void {
  for (let i = 0; i < count; i += 1) {
    const angle = TAU * i / count;
    parts.add(
      cyl(0.065, 0.09, detail),
      material,
      [
        center[0] + Math.cos(angle) * radius,
        y,
        center[2] + Math.sin(angle) * radius,
      ],
    );
  }
}

export function hardpoint(
  m: LabMaterials,
  options: Options,
): Gear {
  const d = options.stage >= 6;
  const p = new Parts(d);

  p.add(
    chamfered(7.6, 0.12, 7.6, 0.2),
    m.concrete,
    [4, 0.06, 4],
  );
  p.add(cyl(1.62, 0.18, d), m.darkSteel, [4, 0.21, 4]);
  p.add(cyl(1.31, 0.48, d), m.gunmetal, [4, 0.48, 4]);
  p.add(
    ring(1.12, 0.14, d),
    m.darkSteel,
    [4, 0.75, 4],
    [Math.PI / 2, 0, 0],
  );
  p.add(cyl(0.92, 0.06, d), m.rubber, [4, 0.75, 4]);

  if (d) {
    boltCircle(
      p,
      m.copper,
      [4, 0, 4],
      1.43,
      0.34,
      12,
      d,
    );
  }

  const cable = (
    z: number,
    material: THREE.Material,
  ): void => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(5.05, 0.62, z),
      new THREE.Vector3(5.28, 0.30, z),
      new THREE.Vector3(5.65, 0.20, z),
      new THREE.Vector3(7.55, 0.20, z),
    ]);

    p.add(
      new THREE.TubeGeometry(
        curve,
        d ? 12 : 4,
        0.09,
        d ? 8 : 3,
        false,
      ),
      material,
    );
    p.add(
      cyl(0.18, 0.28, d),
      m.darkSteel,
      [5.12, 0.48, z],
      [0, 0, Math.PI / 2],
    );
  };

  cable(3.72, m.copper);
  cable(4.28, m.hazard);

  p.add(
    box(2.15, 0.17, 0.92),
    m.gunmetal,
    [6.65, 0.20, 4],
  );

  const ribs = d ? 8 : 3;
  for (let i = 0; i < ribs; i += 1) {
    p.add(
      box(0.08, 0.09, 1.02),
      m.darkSteel,
      [5.7 + i * (1.85 / (ribs - 1)), 0.33, 4],
    );
  }

  p.add(
    box(0.16, 0.22, 1.08),
    m.darkSteel,
    [7.72, 0.23, 4],
  );

  return p.finish(
    'hardpoint',
    [
      {
        min: [2.35, 0, 2.35],
        max: [5.65, 0.82, 5.65],
      },
    ],
    [
      { name: 'mount', at: [4, 0.84, 4] },
      { name: 'power', at: [7.8, 0.24, 4] },
    ],
  );
}

export function heavyMill(
  m: LabMaterials,
  options: Options,
): Gear {
  const d = options.stage >= 6;
  const p = new Parts(d);
  const pink = m.hazard.clone();

  pink.color.setHex(0xff4f9a);
  pink.emissive.setHex(0x6b103b);
  pink.emissiveIntensity = 1.15;

  p.add(
    chamfered(3.85, 0.16, 3.55, 0.18),
    m.darkSteel,
    [0, 0.08, 0],
  );

  for (const x of [-1.38, 1.38]) {
    for (const z of [-1.18, 1.18]) {
      p.add(
        chamfered(0.42, 0.34, 0.42, 0.07),
        m.darkSteel,
        [x, 0.33, z],
      );
      p.add(
        cyl(0.075, 0.1, d),
        m.copper,
        [x, 0.55, z],
      );
    }
  }

  p.add(
    chamfered(3.2, 3.32, 2.85, 0.22),
    m.paint,
    [0, 2.10, 0],
  );
  p.add(
    box(3.24, 0.07, 2.89),
    m.gunmetal,
    [0, 1.05, 0],
  );
  p.add(
    box(3.24, 0.07, 2.89),
    m.gunmetal,
    [0, 3.08, 0],
  );

  p.add(
    chamfered(1.52, 1.78, 0.10, 0.09),
    m.darkSteel,
    [-0.45, 1.85, -1.47],
  );
  p.add(
    chamfered(1.30, 1.55, 0.07, 0.07),
    m.gunmetal,
    [-0.45, 1.85, -1.54],
  );
  p.add(
    box(0.06, 1.34, 0.05),
    m.paint,
    [-1.02, 1.85, -1.60],
  );
  p.add(
    cyl(0.07, 0.18, d),
    m.copper,
    [0.02, 1.86, -1.64],
    [Math.PI / 2, 0, 0],
  );

  const seamCount = d ? 5 : 1;
  for (let i = 0; i < seamCount; i += 1) {
    p.add(
      box(0.76, 0.035, 0.045),
      m.darkSteel,
      [0.72, 1.25 + i * 0.35, -1.49],
    );
  }

  p.add(
    box(3.05, 0.16, 0.20),
    m.darkSteel,
    [0, 4.36, -1.36],
  );
  p.add(
    box(3.05, 0.16, 0.20),
    m.darkSteel,
    [0, 4.36, 1.36],
  );
  p.add(
    box(0.20, 0.16, 2.55),
    m.darkSteel,
    [-1.43, 4.36, 0],
  );
  p.add(
    box(0.20, 0.16, 2.55),
    m.darkSteel,
    [1.43, 4.36, 0],
  );

  for (const z of [-0.82, 0.82]) {
    p.add(
      box(2.55, 0.82, 0.12),
      m.paint,
      [0, 3.94, z],
      [z > 0 ? -0.42 : 0.42, 0, 0],
    );
  }

  for (const x of [-0.92, 0.92]) {
    p.add(
      box(0.12, 0.82, 1.55),
      m.paint,
      [x, 3.94, 0],
      [0, 0, x > 0 ? 0.42 : -0.42],
    );
  }

  const oreCount = d ? 11 : 2;
  for (let i = 0; i < oreCount; i += 1) {
    const angle = i * 2.39996;
    const radius = 0.19 + (i % 4) * 0.19;
    const size = 0.34 + (i % 3) * 0.07;

    p.add(
      new THREE.DodecahedronGeometry(size, 0),
      m.rubber,
      [
        Math.cos(angle) * radius,
        4.15 + (i % 2) * 0.17,
        Math.sin(angle) * radius,
      ],
      [angle, angle * 0.4, 0],
    );
  }

  p.add(
    box(1.72, 1.32, 0.10),
    m.darkSteel,
    [0.48, 2.48, 1.48],
  );

  const louvres = d ? 7 : 3;
  for (let i = 0; i < louvres; i += 1) {
    p.add(
      box(1.48, 0.09, 0.16),
      m.gunmetal,
      [
        0.48,
        2.02 + i * (0.84 / (louvres - 1)),
        1.59,
      ],
      [-0.18, 0, 0],
    );
  }

  const pixels = d ? 9 : 3;
  for (let i = 0; i < pixels; i += 1) {
    const x = 0.13 + (i % 3) * 0.29;
    p.add(
      box(0.10, 0.10, 0.10),
      pink,
      [x, 2.38 - i * 0.13, 1.72 + i * 0.10],
      [0, i * 0.2, 0],
    );
  }

  p.add(
    cyl(0.22, 0.28, d),
    m.copper,
    [1.72, 0.82, -0.65],
    [0, 0, Math.PI / 2],
  );
  p.add(
    ring(0.23, 0.07, d),
    m.rubber,
    [1.85, 0.82, -0.65],
    [0, Math.PI / 2, 0],
  );

  p.lamp(
    new THREE.IcosahedronGeometry(0.11, d ? 1 : 0),
    0x53ff72,
    [-0.22, 2.94, -1.62],
  );
  p.lamp(
    new THREE.IcosahedronGeometry(0.11, d ? 1 : 0),
    0xff9b2f,
    [0.12, 2.94, -1.62],
  );

  return p.finish(
    'heavyMill',
    [
      {
        min: [-1.92, 0, -1.78],
        max: [1.92, 3.78, 1.78],
      },
    ],
    [
      { name: 'vent', at: [0.48, 2.48, 1.72] },
      { name: 'hopper', at: [0, 4.55, 0] },
      { name: 'power', at: [1.98, 0.82, -0.65] },
    ],
  );
}

export function bin(
  m: LabMaterials,
  options: Options,
): Gear {
  const d = options.stage >= 6;
  const p = new Parts(d);

  for (const x of [1.35, 2.65]) {
    for (const z of [1.48, 2.52]) {
      p.add(
        box(0.22, 0.22, 0.22),
        m.darkSteel,
        [x, 0.11, z],
      );

      if (d) {
        p.add(
          cyl(0.06, 0.06, d),
          m.copper,
          [x, 0.25, z],
        );
      }
    }
  }

  p.add(
    chamfered(1.6, 1.55, 1.36, 0.12),
    m.paint,
    [2, 1.02, 2],
  );
  p.add(
    box(1.38, 0.055, 0.05),
    m.darkSteel,
    [2, 0.72, 1.30],
  );
  p.add(
    box(1.38, 0.055, 0.05),
    m.darkSteel,
    [2, 1.29, 1.30],
  );
  p.add(
    chamfered(0.52, 0.54, 0.055, 0.04),
    m.gunmetal,
    [1.66, 1.08, 1.29],
  );

  const keys = d ? 9 : 4;
  for (let i = 0; i < keys; i += 1) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    p.add(
      box(0.07, 0.055, 0.035),
      m.copper,
      [
        1.52 + col * 0.14,
        1.18 - row * 0.13,
        1.25,
      ],
    );
  }

  p.add(
    box(0.08, 0.45, 0.08),
    m.copper,
    [2.48, 1.06, 1.23],
  );
  p.add(
    box(0.22, 0.08, 0.08),
    m.copper,
    [2.41, 1.25, 1.23],
  );

  if (d) {
    for (const x of [1.3, 2.7]) {
      for (const y of [0.48, 1.55]) {
        p.add(
          cyl(0.045, 0.045, d),
          m.darkSteel,
          [x, y, 1.28],
          [Math.PI / 2, 0, 0],
        );
      }
    }
  }

  p.add(
    cyl(0.08, 0.30, d),
    m.darkSteel,
    [2, 1.94, 2],
  );
  p.add(
    new THREE.SphereGeometry(
      0.36,
      d ? 16 : 8,
      d ? 6 : 4,
      0,
      TAU,
      0,
      0.85,
    ),
    m.gunmetal,
    [2, 2.08, 2],
    [0, 0, Math.PI],
  );
  p.add(
    ring(0.31, 0.035, d),
    m.copper,
    [2, 2.08, 2],
    [Math.PI / 2, 0, 0],
  );

  p.lamp(
    new THREE.OctahedronGeometry(0.105, d ? 1 : 0),
    0x76eaff,
    [2, 2.35, 2],
  );

  return p.finish(
    'bin',
    [
      {
        min: [1.2, 0, 1.30],
        max: [2.8, 1.8, 2.7],
      },
    ],
    [{ name: 'link', at: [2, 2.35, 2] }],
  );
}

export function repeater(
  m: LabMaterials,
  options: Options,
): Gear {
  const d = options.stage >= 6;
  const p = new Parts(d);

  p.add(
    chamfered(1.6, 0.34, 1.6, 0.13),
    m.concrete,
    [2, 0.17, 2],
  );

  const corners: V3[] = [
    [1.35, 0.34, 1.35],
    [2.65, 0.34, 1.35],
    [2.65, 0.34, 2.65],
    [1.35, 0.34, 2.65],
  ];

  for (const c of corners) {
    p.add(
      cyl(0.065, 0.11, d),
      m.copper,
      [c[0], 0.39, c[2]],
    );

    const top: V3 = [
      2 + (c[0] - 2) * 0.28,
      6.62,
      2 + (c[2] - 2) * 0.28,
    ];

    beam(
      p,
      c,
      top,
      d ? 0.105 : 0.14,
      m.darkSteel,
    );
  }

  const levels = d ? 7 : 4;
  for (let i = 0; i < levels; i += 1) {
    const y0 = 0.65 + i * (5.65 / levels);
    const y1 = 0.65 + (i + 1) * (5.65 / levels);
    const spread0 = 0.62 - y0 * 0.066;
    const spread1 = 0.62 - y1 * 0.066;

    beam(
      p,
      [2 - spread0, y0, 1.98 - spread0],
      [2 + spread1, y1, 1.98 - spread1],
      0.075,
      m.gunmetal,
    );
    beam(
      p,
      [2 + spread0, y0, 2.02 + spread0],
      [2 - spread1, y1, 2.02 + spread1],
      0.075,
      m.gunmetal,
    );
    beam(
      p,
      [1.98 - spread0, y0, 2 + spread0],
      [1.98 - spread1, y1, 2 - spread1],
      0.075,
      m.gunmetal,
    );
    beam(
      p,
      [2.02 + spread0, y0, 2 - spread0],
      [2.02 + spread1, y1, 2 + spread1],
      0.075,
      m.gunmetal,
    );
  }

  p.add(
    chamfered(0.88, 0.92, 0.48, 0.07),
    m.paint,
    [2, 0.88, 1.18],
  );
  p.add(
    box(0.58, 0.12, 0.05),
    m.gunmetal,
    [2, 0.92, 0.92],
  );
  p.add(
    cyl(0.09, 0.16, d),
    m.copper,
    [2.31, 0.70, 0.92],
    [Math.PI / 2, 0, 0],
  );
  p.add(
    cyl(0.13, 0.38, d),
    m.darkSteel,
    [2, 6.70, 2],
  );
  p.add(
    ring(0.52, 0.09, d),
    m.copper,
    [2, 6.83, 2],
    [Math.PI / 2, 0, 0],
  );

  const emitters = d ? 8 : 4;
  for (let i = 0; i < emitters; i += 1) {
    const a = TAU * i / emitters;

    p.add(
      new THREE.OctahedronGeometry(0.13, 0),
      m.gunmetal,
      [
        2 + Math.cos(a) * 0.52,
        6.83,
        2 + Math.sin(a) * 0.52,
      ],
      [0, -a, 0],
    );
  }

  const glowRing = ring(0.35, 0.045, d);
  glowRing.rotateX(Math.PI / 2);
  p.lamp(glowRing, 0x59cfff, [2, 6.83, 2]);

  p.lamp(
    new THREE.OctahedronGeometry(0.12, d ? 1 : 0),
    0xff2d32,
    [2, 7.17, 2],
  );

  return p.finish(
    'repeater',
    [
      {
        min: [1.2, 0, 1.2],
        max: [2.8, 0.34, 2.8],
      },
    ],
    [
      { name: 'top', at: [2, 6.83, 2] },
      { name: 'box', at: [2, 0.88, 0.92] },
    ],
  );
}

export function draftingTable(
  m: LabMaterials,
  options: Options,
): Gear {
  const d = options.stage >= 6;
  const p = new Parts(d);

  p.add(
    chamfered(2.4, 0.16, 1.2, 0.09),
    m.gunmetal,
    [2, 0.91, 2],
  );
  p.add(
    chamfered(1.58, 0.035, 0.76, 0.06),
    m.darkSteel,
    [1.72, 1.01, 2],
  );

  for (const x of [1.04, 2.96]) {
    for (const z of [1.62, 2.38]) {
      beam(
        p,
        [x, 0.08, z],
        [x, 0.84, z],
        0.11,
        m.darkSteel,
      );
    }
  }

  beam(
    p,
    [1.04, 0.16, 1.62],
    [2.96, 0.68, 1.62],
    0.07,
    m.darkSteel,
  );
  beam(
    p,
    [2.96, 0.16, 2.38],
    [1.04, 0.68, 2.38],
    0.07,
    m.darkSteel,
  );

  p.add(
    chamfered(0.52, 0.68, 0.94, 0.06),
    m.paint,
    [2.83, 0.55, 2],
  );
  p.add(
    box(0.05, 0.48, 0.76),
    m.darkSteel,
    [2.55, 0.56, 2],
  );

  const drawers = d ? 3 : 2;
  for (let i = 0; i < drawers; i += 1) {
    p.add(
      box(0.05, 0.035, 0.62),
      m.gunmetal,
      [2.53, 0.34 + i * 0.2, 2],
    );
    p.add(
      box(0.04, 0.05, 0.16),
      m.copper,
      [2.49, 0.34 + i * 0.2, 2],
    );
  }

  p.add(
    chamfered(0.28, 0.26, 0.28, 0.035),
    m.copper,
    [1.18, 1.17, 1.80],
    [0, 0.28, 0],
  );
  p.add(
    box(0.38, 0.045, 0.28),
    m.hazard,
    [2.45, 1.02, 2.12],
    [0, 0.18, 0],
  );

  if (d) {
    for (let i = 0; i < 5; i += 1) {
      p.add(
        box(0.025, 0.018, 0.24),
        m.copper,
        [2.30 + i * 0.075, 1.055, 2.12],
        [0, 0.18, 0],
      );
    }

    for (const x of [0.90, 3.10]) {
      for (const z of [1.52, 2.48]) {
        p.add(
          cyl(0.045, 0.04, d),
          m.copper,
          [x, 1.02, z],
        );
      }
    }
  }

  const screen = chamfered(
    1.42,
    0.025,
    0.66,
    0.05,
  );
  p.lamp(screen, 0x43cfff, [1.70, 1.035, 2]);

  return p.finish(
    'draftingTable',
    [
      {
        min: [0.8, 0, 1.4],
        max: [3.2, 1.02, 2.6],
      },
    ],
    [{ name: 'screen', at: [1.70, 1.06, 2] }],
  );
}
