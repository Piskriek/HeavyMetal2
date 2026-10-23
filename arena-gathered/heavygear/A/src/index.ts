import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ===================================================================== */
/*  @hm/heavygear — heavy moon-base terraformers                         */
/*                                                                       */
/*  Frame: metres, y up. Origin = ring-top centre of the heavy-machine   */
/*  socket, front = +z. Every gear bolts onto the same bolted cylinder   */
/*  ring and stands inside the 8 x 8 m concrete pad (x/z in -4..4).      */
/*                                                                       */
/*  Build quality: every part is non-indexed with position/normal/uv     */
/*  before merging; parts touch or slightly sink into what holds them;   */
/*  no coplanar faces (asserted at merge time); no chimneys or stacks —  */
/*  pixels are the only emission. Stage 1 is chunky low poly, stage 6    */
/*  is full detail; both share one silhouette.                           */
/* ===================================================================== */

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
  stage: number;
}

/* --------------------------------------------------------------------- */
/*  Geometry helpers                                                     */
/* --------------------------------------------------------------------- */

interface Placed {
  x: number;
  y: number;
  z: number;
  rx?: number;
  ry?: number;
  rz?: number;
}
type Bag = Map<string, THREE.BufferGeometry[]>;

const ONE = new THREE.Vector3(1, 1, 1);

/** Non-indexed, with position, normal and uv. */
function solid(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index !== null ? geo.toNonIndexed() : geo;
  if (g.attributes.uv === undefined) {
    const p = g.attributes.position;
    if (p === undefined) throw new Error('heavygear: geometry without position');
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  }
  return g;
}

function place(geo: THREE.BufferGeometry, p: Placed): THREE.BufferGeometry {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0));
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), q, ONE));
  return geo;
}

function box(w: number, h: number, d: number, p: Placed): THREE.BufferGeometry {
  return place(solid(new THREE.BoxGeometry(w, h, d)), p);
}

function cyl(
  rt: number,
  rb: number,
  h: number,
  seg: number,
  p: Placed,
  open = false,
  t0 = 0,
  tl = Math.PI * 2,
): THREE.BufferGeometry {
  return place(solid(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, t0, tl)), p);
}

function sph(
  r: number,
  w: number,
  h: number,
  p: Placed,
  sz: [number, number, number] = [1, 1, 1],
): THREE.BufferGeometry {
  const [sx = 1, sy = 1, sz2 = 1] = sz;
  const g = new THREE.SphereGeometry(r, w, h);
  g.scale(sx, sy, sz2);
  return place(solid(g), p);
}

function lathe(pts: [number, number][], seg: number, p: Placed): THREE.BufferGeometry {
  return place(solid(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg)), p);
}

function circ(r: number, seg: number, p: Placed): THREE.BufferGeometry {
  return place(solid(new THREE.CircleGeometry(r, seg)), p);
}

function oct(r: number, p: Placed): THREE.BufferGeometry {
  return place(solid(new THREE.OctahedronGeometry(r, 0)), p);
}

function tet(r: number, p: Placed): THREE.BufferGeometry {
  return place(solid(new THREE.TetrahedronGeometry(r, 0)), p);
}

function add(bag: Bag, key: string, geo: THREE.BufferGeometry): void {
  const list = bag.get(key);
  if (list === undefined) bag.set(key, [geo]);
  else list.push(geo);
}

function materialFor(m: LabMaterials, key: string): THREE.Material {
  switch (key) {
    case 'gunmetal':
      return m.gunmetal;
    case 'darkSteel':
      return m.darkSteel;
    case 'paint':
      return m.paint;
    case 'cu':
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
      throw new Error(`heavygear: unknown material key "${key}"`);
  }
}

/* --------------------------------------------------------------------- */
/*  Merge per material, with a coplanar-face guard                       */
/* --------------------------------------------------------------------- */

interface Tri {
  nx: number;
  ny: number;
  nz: number;
  off: number;
  minx: number;
  miny: number;
  minz: number;
  maxx: number;
  maxy: number;
  maxz: number;
}

function tris(geo: THREE.BufferGeometry): Tri[] {
  const pos = geo.attributes.position;
  if (pos === undefined) throw new Error('heavygear: geometry without position');
  const n = pos.count;
  const out: Tri[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const nn = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    nn.crossVectors(ab, ac);
    const len = nn.length();
    const t: Tri = {
      nx: 0,
      ny: 0,
      nz: 0,
      off: 0,
      minx: Math.min(a.x, b.x, c.x),
      miny: Math.min(a.y, b.y, c.y),
      minz: Math.min(a.z, b.z, c.z),
      maxx: Math.max(a.x, b.x, c.x),
      maxy: Math.max(a.y, b.y, c.y),
      maxz: Math.max(a.z, b.z, c.z),
    };
    if (len > 1e-9) {
      nn.divideScalar(len);
      t.nx = nn.x;
      t.ny = nn.y;
      t.nz = nn.z;
      t.off = -nn.dot(a);
    }
    out.push(t);
  }
  return out;
}

const PLANE_EPS = 1e-5;
const BOX_EPS = 1e-4;

function merge(geos: THREE.BufferGeometry[], mat: THREE.Material, tag: string): THREE.Mesh {
  const parts = geos.map((g) => solid(g));
  const lists = parts.map(tris);
  for (let i = 0; i < lists.length; i++) {
    const la = lists[i];
    if (la === undefined) continue;
    for (let j = i + 1; j < lists.length; j++) {
      const lb = lists[j];
      if (lb === undefined) continue;
      for (const ta of la) {
        for (const tb of lb) {
          const dot = ta.nx * tb.nx + ta.ny * tb.ny + ta.nz * tb.nz;
          if (dot < 0.999999 && dot > -0.999999) continue;
          const d = dot > 0 ? Math.abs(ta.off - tb.off) : Math.abs(ta.off + tb.off);
          if (d > PLANE_EPS) continue;
          if (
            ta.minx > tb.maxx + BOX_EPS ||
            tb.minx > ta.maxx + BOX_EPS ||
            ta.miny > tb.maxy + BOX_EPS ||
            tb.miny > ta.maxy + BOX_EPS ||
            ta.minz > tb.maxz + BOX_EPS ||
            tb.minz > ta.maxz + BOX_EPS
          ) {
            continue;
          }
          throw new Error(`heavygear: coplanar faces in "${tag}"`);
        }
      }
    }
  }
  const merged: THREE.BufferGeometry | null = mergeGeometries(parts, false);
  if (merged === null) throw new Error(`heavygear: merge failed for "${tag}"`);
  return new THREE.Mesh(merged, mat);
}

function build(bag: Bag, m: LabMaterials): THREE.Group {
  const g = new THREE.Group();
  bag.forEach((geos, key) => {
    g.add(merge(geos, materialFor(m, key), key));
  });
  return g;
}

/* --------------------------------------------------------------------- */
/*  Lamps and pixel fields (the only emission)                           */
/* --------------------------------------------------------------------- */

function lamp(r: number, h: number, seg: number, color: number, p: Placed): THREE.Mesh {
  const geo = solid(new THREE.CylinderGeometry(r, r, h, seg, 1, false));
  place(geo, p);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    emissive: color,
    emissiveIntensity: 0.6,
    roughness: 0.35,
    metalness: 0.1,
    flatShading: true,
  });
  return new THREE.Mesh(geo, mat);
}

function pixelField(pos: [number, number, number][], size: number, color: number, tag: string): THREE.Mesh {
  const geos = pos.map(([x, y, z]) => box(size, size, size, { x, y, z }));
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0c0c0c,
    emissive: color,
    emissiveIntensity: 0.9,
    roughness: 0.55,
    metalness: 0,
    flatShading: true,
  });
  return merge(geos, mat, tag);
}

/* --------------------------------------------------------------------- */
/*  Public API                                                           */
/* --------------------------------------------------------------------- */

export function createMaterials(): LabMaterials {
  const std = (color: number, metalness: number, roughness: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: true });
  return {
    gunmetal: std(0x565b63, 0.85, 0.42),
    darkSteel: std(0x2e3238, 0.9, 0.38),
    paint: std(0xc75126, 0.25, 0.5),
    copper: std(0xb87333, 0.95, 0.3),
    rubber: std(0x17181a, 0.0, 0.92),
    hazard: std(0xf2c230, 0.3, 0.55),
    concrete: std(0x9b9b95, 0.0, 0.95),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xa8d8e8,
      metalness: 0,
      roughness: 0.08,
      transparent: true,
      opacity: 0.4,
      transmission: 0,
      flatShading: true,
    }),
  };
}

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material;
  if (mat instanceof THREE.MeshStandardMaterial) mat.emissiveIntensity = glow;
}

export function triangles(g: Gear): number {
  let n = 0;
  g.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const geo = o.geometry;
      const p = geo.attributes.position;
      if (p === undefined) throw new Error('heavygear: mesh without position');
      n += geo.index !== null ? geo.index.count / 3 : p.count / 3;
    }
  });
  return n;
}

/* --------------------------------------------------------------------- */
/*  Grounding kit: bolted ring, base plate, glands, hazard, status lamps */
/* --------------------------------------------------------------------- */

interface Kit {
  bag: Bag;
  lamps: THREE.Mesh[];
  power: [number, number, number];
  colliders: Box[];
}

function kit(stage: number, long: boolean): Kit {
  const hi = stage >= 6;
  const bag: Bag = new Map();
  const lamps: THREE.Mesh[] = [];
  const gseg = hi ? 10 : 6;

  // Bolted cylinder ring (annulus flange, top at y = 0).
  add(
    bag,
    'darkSteel',
    lathe([[1.15, -0.015], [1.5, -0.015], [1.5, 0], [1.15, 0], [1.15, -0.015]], 8, { x: 0, y: 0, z: 0 }),
  );

  // Heavy base plate bolted to the ring.
  if (long) {
    add(bag, 'concrete', box(3.6, 0.105, 2.8, { x: 0, y: 0.0475, z: 0 }));
    // Hazard band around the plate.
    add(bag, 'hazard', box(3.68, 0.05, 0.04, { x: 0, y: 0.045, z: 1.41 }));
    add(bag, 'hazard', box(3.68, 0.05, 0.04, { x: 0, y: 0.045, z: -1.41 }));
    add(bag, 'hazard', box(0.04, 0.05, 2.79, { x: 1.81, y: 0.045, z: 0 }));
    add(bag, 'hazard', box(0.04, 0.05, 2.79, { x: -1.81, y: 0.045, z: 0 }));
    // Chamfered steel edge.
    add(bag, 'darkSteel', box(3.62, 0.09, 0.09, { x: 0, y: 0.12, z: 1.38, rx: Math.PI / 4 }));
    add(bag, 'darkSteel', box(3.62, 0.09, 0.09, { x: 0, y: 0.12, z: -1.38, rx: -Math.PI / 4 }));
    add(bag, 'darkSteel', box(0.09, 0.09, 2.72, { x: 1.81, y: 0.12, z: 0, rz: Math.PI / 4 }));
    add(bag, 'darkSteel', box(0.09, 0.09, 2.72, { x: -1.81, y: 0.12, z: 0, rz: -Math.PI / 4 }));
  } else {
    add(bag, 'concrete', cyl(1.45, 1.45, 0.105, 8, { x: 0, y: 0.0475, z: 0, ry: Math.PI / 8 }));
    add(bag, 'hazard', cyl(1.46, 1.46, 0.05, 8, { x: 0, y: 0.045, z: 0, ry: Math.PI / 8 }));
    add(bag, 'darkSteel', cyl(1.48, 1.48, 0.05, 8, { x: 0, y: 0.1, z: 0, ry: Math.PI / 8 }));
  }

  // Ring bolts through the plate.
  const boltN = hi ? 8 : 4;
  for (let k = 0; k < boltN; k++) {
    const a = (k / boltN) * Math.PI * 2;
    add(bag, 'darkSteel', cyl(0.055, 0.055, 0.06, 6, { x: Math.sin(a) * 1.3, y: 0.12, z: Math.cos(a) * 1.3 }));
  }

  // Cable glands at the foot: orange power, green data.
  const fz = long ? 1.4 : 1.339;
  add(bag, 'darkSteel', cyl(0.05, 0.05, 0.14, gseg, { x: 0.3, y: 0.05, z: fz + 0.01, rx: Math.PI / 2 }));
  add(bag, 'darkSteel', cyl(0.05, 0.05, 0.14, gseg, { x: -0.3, y: 0.05, z: fz + 0.01, rx: Math.PI / 2 }));
  lamps.push(lamp(0.045, 0.05, gseg, 0xff8c1a, { x: 0.3, y: 0.05, z: fz + 0.075, rx: Math.PI / 2 }));
  lamps.push(lamp(0.045, 0.05, gseg, 0x2bff5e, { x: -0.3, y: 0.05, z: fz + 0.075, rx: Math.PI / 2 }));

  return {
    bag,
    lamps,
    power: [0.3, 0.1, fz + 0.15],
    colliders: [cbox(0, 0.05, 0, long ? 3.7 : 3.0, 0.15, long ? 2.9 : 3.0)],
  };
}

function cbox(cx: number, cy: number, cz: number, w: number, h: number, d: number): Box {
  return {
    min: [cx - w / 2, cy - h / 2, cz - d / 2],
    max: [cx + w / 2, cy + h / 2, cz + d / 2],
  };
}

function at<T>(arr: T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error('heavygear: index out of range');
  return v;
}

/* --------------------------------------------------------------------- */
/*  heavyPress — open press frame, twin rams, feed chute, rear vent      */
/* --------------------------------------------------------------------- */

export function heavyPress(m: LabMaterials, o: GearOptions): Gear {
  const hi = o.stage >= 6;
  const seg = hi ? 16 : 6;
  const k = kit(o.stage, false);
  const bag = k.bag;

  // Two thick columns and the crown beam.
  add(bag, 'gunmetal', box(0.5, 3.25, 0.6, { x: -0.95, y: 1.675, z: 0 }));
  add(bag, 'gunmetal', box(0.5, 3.25, 0.6, { x: 0.95, y: 1.675, z: 0 }));
  add(bag, 'darkSteel', box(0.7, 0.08, 0.8, { x: -0.95, y: 0.14, z: 0 }));
  add(bag, 'darkSteel', box(0.7, 0.08, 0.8, { x: 0.95, y: 0.14, z: 0 }));
  add(bag, 'hazard', box(0.52, 0.1, 0.02, { x: -0.95, y: 2.6, z: 0.3 }));
  add(bag, 'hazard', box(0.52, 0.1, 0.02, { x: 0.95, y: 2.6, z: 0.3 }));
  add(bag, 'gunmetal', box(2.5, 0.32, 0.9, { x: 0, y: 3.44, z: 0 }));

  // Two hydraulic rams hanging from the crown.
  add(bag, 'darkSteel', cyl(0.17, 0.17, 0.8, seg, { x: -0.5, y: 2.9, z: 0 }));
  add(bag, 'darkSteel', cyl(0.17, 0.17, 0.8, seg, { x: 0.5, y: 2.9, z: 0 }));
  if (hi) {
    add(bag, 'gunmetal', cyl(0.21, 0.21, 0.1, seg, { x: -0.5, y: 3.21, z: 0 }));
    add(bag, 'gunmetal', cyl(0.21, 0.21, 0.1, seg, { x: 0.5, y: 3.21, z: 0 }));
  }

  // Die bed.
  add(bag, 'gunmetal', box(1.3, 0.95, 1.3, { x: 0, y: 0.555, z: 0 }));
  add(bag, 'darkSteel', box(1.2, 0.22, 1.0, { x: 0, y: 1.09, z: 0 }));

  // Feed chute on top with a grate and a few crystalline shards.
  add(bag, 'gunmetal', cyl(0.6, 0.35, 0.35, 4, { x: 0, y: 3.755, z: 0, ry: Math.PI / 4 }));
  add(bag, 'darkSteel', box(0.92, 0.04, 0.92, { x: 0, y: 3.72, z: 0 }));
  const shardDefs: [number, number, number, number][] = [
    [0, 3.84, 0, 0.12],
    [-0.1, 3.81, -0.1, 0.09],
    [0.1, 3.81, 0.1, 0.09],
    [-0.1, 3.81, 0.1, 0.09],
    [0.1, 3.81, -0.1, 0.09],
  ];
  const shardPick = hi ? shardDefs : shardDefs.slice(0, 3);
  for (const [sx, sy, sz, sr] of shardPick) {
    add(bag, 'gunmetal', oct(sr, { x: sx, y: sy, z: sz, ry: 0.4 + sx * 9 + sz * 7, rz: 0.3 }));
  }

  // Louvred vent grille on the REAR face (-z).
  add(bag, 'darkSteel', box(1.7, 0.05, 0.05, { x: 0, y: 3.33, z: -0.445 }));
  add(bag, 'darkSteel', box(1.7, 0.05, 0.05, { x: 0, y: 3.57, z: -0.445 }));
  const louvreN = hi ? 6 : 3;
  for (let i = 0; i < louvreN; i++) {
    const y = hi ? 3.365 + i * 0.037 : 3.38 + i * 0.07;
    add(bag, 'darkSteel', box(1.6, 0.02, 0.03, { x: 0, y, z: -0.44, rx: 0.6 }));
  }

  // Green pixels pouring out of the grille.
  const pxPos: [number, number, number][] = [];
  const rows = hi ? [0, 1, 2, 3] : [0, 3];
  for (const j of rows) {
    for (let i = 0; i < 3; i++) {
      pxPos.push([-0.32 + 0.32 * i, 3.22 + 0.09 * j, -0.5 - 0.06 * ((i + j) % 2) - 0.04 * j]);
    }
  }
  const px = pixelField(pxPos, 0.055, 0x39ff6a, 'press vent pixels');

  // Moving group: rams' pistons and the press plate (game slides it down 0..0.6 m).
  const ram = new THREE.Group();
  const rb: Bag = new Map();
  add(rb, 'darkSteel', cyl(0.11, 0.11, 1.3, seg, { x: -0.5, y: 2.6, z: 0 }));
  add(rb, 'darkSteel', cyl(0.11, 0.11, 1.3, seg, { x: 0.5, y: 2.6, z: 0 }));
  add(rb, 'paint', box(1.3, 0.15, 1.0, { x: 0, y: 1.975, z: 0 }));
  add(rb, 'paint', box(1.1, 0.05, 0.85, { x: 0, y: 1.875, z: 0 }));
  add(rb, 'rubber', cyl(0.13, 0.13, 0.12, seg, { x: -0.5, y: 3.21, z: 0 }));
  add(rb, 'rubber', cyl(0.13, 0.13, 0.12, seg, { x: 0.5, y: 3.21, z: 0 }));
  ram.add(build(rb, m));

  const group = build(bag, m);
  group.add(px);
  for (const l of k.lamps) group.add(l);
  group.add(ram);

  return {
    group,
    colliders: [
      ...k.colliders,
      cbox(-0.95, 1.7, 0, 0.6, 3.3, 0.7),
      cbox(0.95, 1.7, 0, 0.6, 3.3, 0.7),
      cbox(0, 3.44, 0, 2.55, 0.35, 0.95),
      cbox(0, 0.6, 0, 1.4, 1.0, 1.4),
    ],
    sockets: [
      { name: 'vent', at: [0, 3.45, -0.55] },
      { name: 'chute', at: [0, 4.0, 0] },
      { name: 'power', at: k.power },
    ],
    lamps: [...k.lamps, px],
    parts: { ram },
  };
}

/* --------------------------------------------------------------------- */
/*  heavyProjector — octagonal mast, yoke, faceted lamp head             */
/* --------------------------------------------------------------------- */

const TILT = (-25 * Math.PI) / 180;

export function heavyProjector(m: LabMaterials, o: GearOptions): Gear {
  const hi = o.stage >= 6;
  const seg = hi ? 16 : 6;
  const k = kit(o.stage, false);
  const bag = k.bag;

  // Short armoured octagonal mast.
  add(bag, 'gunmetal', cyl(0.55, 0.55, 3.2, 8, { x: 0, y: 1.7, z: 0, ry: Math.PI / 8 }));
  const bandN = hi ? 3 : 2;
  for (let i = 0; i < bandN; i++) {
    add(bag, 'darkSteel', cyl(0.6, 0.6, 0.12, 8, { x: 0, y: 0.9 + i * 0.8, z: 0, ry: Math.PI / 8 }));
  }
  add(bag, 'hazard', cyl(0.61, 0.61, 0.1, 8, { x: 0, y: 2.9, z: 0, ry: Math.PI / 8 }));

  // Yoke on top.
  add(bag, 'darkSteel', box(2.3, 0.1, 1.3, { x: 0, y: 3.31, z: 0 }));
  add(bag, 'gunmetal', box(0.12, 1.06, 0.9, { x: -1.06, y: 3.88, z: 0 }));
  add(bag, 'gunmetal', box(0.12, 1.06, 0.9, { x: 1.06, y: 3.88, z: 0 }));
  add(bag, 'darkSteel', cyl(0.09, 0.09, 2.2, seg, { x: 0, y: 4.35, z: 0, rz: Math.PI / 2 }));

  // Armoured porthole with a glass face.
  add(bag, 'darkSteel', cyl(0.17, 0.17, 0.06, seg, { x: 0, y: 2.0, z: 0.52, rx: Math.PI / 2 }, true));
  const glassMesh = merge([circ(0.175, seg, { x: 0, y: 2.0, z: 0.535 })], m.glass, 'porthole glass');

  // Head group: origin is the yoke tilt axis, lens faces +z tilted up 25 deg.
  const head = new THREE.Group();
  head.position.set(0, 4.35, 0);
  head.rotation.x = TILT;
  const hb: Bag = new Map();
  add(hb, 'gunmetal', sph(0.95, 8, 5, { x: 0, y: 0, z: 0.05 }, [1, 1, 0.7]));
  add(
    hb,
    'darkSteel',
    lathe([[0.62, -0.15], [0.84, -0.15], [0.84, 0.15], [0.62, 0.15], [0.62, -0.15]], 8, {
      x: 0,
      y: 0,
      z: 0.55,
      rx: Math.PI / 2,
    }),
  );
  add(hb, 'darkSteel', cyl(0.7, 0.7, 0.2, 8, { x: 0, y: 0, z: -0.7, rx: Math.PI / 2 }));
  const finN = hi ? 8 : 4;
  for (let i = 0; i < finN; i++) {
    const a = (i / finN) * Math.PI * 2;
    add(hb, 'darkSteel', box(0.05, 0.4, 0.3, { x: Math.sin(a) * 0.745, y: Math.cos(a) * 0.745, z: -0.68, rz: -a }));
  }
  add(hb, 'rubber', cyl(0.66, 0.66, 0.04, seg, { x: 0, y: 0, z: 0.66, rx: Math.PI / 2 }));

  // Amber pixels leaving vents round the BACK rim, never the lens.
  const pxPos: [number, number, number][] = [];
  const RING = 8;
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2 + Math.PI / 8;
    pxPos.push([Math.sin(a) * 0.73, Math.cos(a) * 0.73, -0.81]);
  }
  if (hi) {
    for (let i = 0; i < RING; i++) {
      const a = (i / RING) * Math.PI * 2 + Math.PI / 8;
      pxPos.push([Math.sin(a) * 0.72, Math.cos(a) * 0.72, -0.78]);
    }
  }
  const px = pixelField(pxPos, 0.07, 0xffb020, 'projector back rim pixels');
  const lens = lamp(0.64, 0.1, seg, 0xfff3d0, { x: 0, y: 0, z: 0.71, rx: Math.PI / 2 });

  head.add(build(hb, m));
  head.add(px);
  head.add(lens);

  // Sockets in the gear frame, derived from the tilted head.
  const tilt = new THREE.Euler(TILT, 0, 0);
  const hp = (x: number, y: number, z: number): [number, number, number] => {
    const v = new THREE.Vector3(x, y, z).applyEuler(tilt).add(new THREE.Vector3(0, 4.35, 0));
    return [v.x, v.y, v.z];
  };

  const group = build(bag, m);
  group.add(glassMesh);
  for (const l of k.lamps) group.add(l);
  group.add(head);

  return {
    group,
    colliders: [...k.colliders, cbox(0, 1.7, 0, 1.3, 3.3, 1.3), cbox(0, 4.35, 0, 2.3, 2.1, 2.3)],
    sockets: [
      { name: 'vent', at: hp(0, 0.05, -0.85) },
      { name: 'lens', at: hp(0, 0, 0.76) },
      { name: 'power', at: k.power },
    ],
    lamps: [...k.lamps, lens, px],
    parts: { head },
  };
}

/* --------------------------------------------------------------------- */
/*  heavyWater — ribbed condenser tank in a two-saddle cradle            */
/* --------------------------------------------------------------------- */

export function heavyWater(m: LabMaterials, o: GearOptions): Gear {
  const hi = o.stage >= 6;
  const seg = hi ? 16 : 8;
  const k = kit(o.stage, true);
  const bag = k.bag;

  // Two-saddle cradle.
  add(bag, 'darkSteel', box(0.55, 0.67, 1.74, { x: -1.5, y: 0.415, z: 0 }));
  add(bag, 'darkSteel', box(0.55, 0.67, 1.74, { x: 1.5, y: 0.415, z: 0 }));
  add(
    bag,
    'darkSteel',
    cyl(0.45, 0.45, 1.7, seg, { x: -1.5, y: 0.75, z: 0, rx: Math.PI / 2 }, false, Math.PI / 2, Math.PI),
  );
  add(
    bag,
    'darkSteel',
    cyl(0.45, 0.45, 1.7, seg, { x: 1.5, y: 0.75, z: 0, rx: Math.PI / 2 }, false, Math.PI / 2, Math.PI),
  );

  // Ribbed condenser tank lying along x.
  add(bag, 'gunmetal', cyl(0.9, 0.9, 4.5, seg, { x: 0, y: 1.9, z: 0, rz: Math.PI / 2 }));
  const ribX = hi ? [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8] : [-1.2, 0, 1.2];
  for (const rx of ribX) {
    add(bag, 'darkSteel', cyl(0.94, 0.94, 0.1, 8, { x: rx, y: 1.9, z: 0, rz: Math.PI / 2 }, true));
  }

  // Pipe runs along the tank, plus an output stub on the -x end.
  add(bag, 'cu', cyl(0.08, 0.08, 4.2, seg, { x: 0, y: 2.75, z: 0.45, rz: Math.PI / 2 }));
  add(bag, 'cu', cyl(0.07, 0.07, 4.2, seg, { x: 0, y: 2.6, z: 0.62, rz: Math.PI / 2 }));
  add(bag, 'cu', cyl(0.12, 0.12, 0.5, seg, { x: -2.4, y: 1.2, z: 0, rz: Math.PI / 2 }));

  // Round pressure gauge on the front (+z).
  add(bag, 'darkSteel', cyl(0.035, 0.035, 0.15, seg, { x: 0, y: 1.9, z: 0.88, rx: Math.PI / 2 }));
  add(bag, 'darkSteel', cyl(0.15, 0.15, 0.09, seg, { x: 0, y: 1.9, z: 0.98, rx: Math.PI / 2 }));
  add(bag, 'hazard', circ(0.12, seg, { x: 0, y: 1.9, z: 1.028 }));
  add(bag, 'darkSteel', box(0.02, 0.1, 0.012, { x: 0.02, y: 1.93, z: 1.032, rz: -0.5 }));
  add(bag, 'darkSteel', cyl(0.16, 0.16, 0.02, seg, { x: 0, y: 1.9, z: 1.035, rx: Math.PI / 2 }, true));

  // Louvred vent box on the top rear, cyan pixels rise from it.
  add(bag, 'gunmetal', box(0.7, 0.5, 0.35, { x: 0, y: 2.8, z: -0.35 }));
  const louvreN = hi ? 4 : 2;
  for (let i = 0; i < louvreN; i++) {
    const y = hi ? 2.66 + i * 0.09 : 2.68 + i * 0.24;
    add(bag, 'darkSteel', box(0.5, 0.04, 0.03, { x: 0, y, z: -0.53, rx: 0.6 }));
  }
  add(bag, 'darkSteel', box(0.74, 0.04, 0.44, { x: 0, y: 3.06, z: -0.35 }));

  // Gravel intake hopper low on the +x end, full of grey gravel.
  add(bag, 'darkSteel', cyl(0.55, 0.18, 0.7, 8, { x: 2.55, y: 0.43, z: 0 }));
  add(bag, 'darkSteel', cyl(0.57, 0.57, 0.06, 8, { x: 2.55, y: 0.78, z: 0 }, true));
  add(bag, 'darkSteel', box(0.86, 0.04, 0.86, { x: 2.55, y: 0.55, z: 0 }));
  add(bag, 'darkSteel', box(0.2, 0.7, 0.5, { x: 2.2, y: 0.75, z: 0 }));
  const gravel: [number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    gravel.push([2.72 + Math.sin(a) * 0.2, 0.6, Math.cos(a) * 0.2]);
  }
  gravel.push([2.72, 0.76, 0]);
  if (hi) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
      gravel.push([2.72 + Math.sin(a) * 0.1, 0.68, Math.cos(a) * 0.1]);
    }
  }
  for (const [gx, gy, gz] of gravel) {
    add(bag, 'concrete', tet(0.07, { x: gx, y: gy, z: gz, ry: gx * 3 + gz * 5, rz: gy * 7 }));
  }

  // Cyan pixels rising from the vent box.
  const xoff = [-0.2, 0.05, 0.18, -0.12, 0.22, -0.05, 0.12, -0.2, 0.0, 0.15];
  const zoff = [-0.1, 0.12, -0.05, 0.08, -0.12, 0.05, -0.08, 0.1, -0.12, 0.06];
  const pick = hi ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 1, 4, 6, 8, 9];
  const pxPos = pick.map((ki): [number, number, number] => [at(xoff, ki), 3.12 + 0.07 * ki, -0.35 + at(zoff, ki)]);
  const px = pixelField(pxPos, 0.06, 0x35f0ff, 'water vent pixels');

  const group = build(bag, m);
  group.add(px);
  for (const l of k.lamps) group.add(l);

  return {
    group,
    colliders: [
      ...k.colliders,
      cbox(0, 1.9, 0, 4.6, 1.9, 1.9),
      cbox(2.55, 0.5, 0, 1.2, 0.9, 1.2),
      cbox(0, 2.8, -0.35, 0.75, 0.55, 0.6),
    ],
    sockets: [
      { name: 'vent', at: [0, 3.1, -0.35] },
      { name: 'hopper', at: [2.55, 1.0, 0] },
      { name: 'power', at: k.power },
    ],
    lamps: [...k.lamps, px],
  };
}
