// src/index.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ------------------------------------------------------------------ *
 *  Moon-base fabrication gear — procedural, real geometry.
 *  Strict, no Math.random, no DOM/Date, only `three` + mergeGeometries.
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

export function createMaterials(): LabMaterials {
  const s = (
    color: number,
    metalness: number,
    roughness: number,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {}
  ): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });

  return {
    gunmetal: s(0x6c727a, 0.85, 0.5),
    darkSteel: s(0x3c4248, 0.78, 0.62),
    paint: s(0xb9b2a4, 0.22, 0.72),
    copper: s(0xb06a32, 0.9, 0.34),
    rubber: s(0x202327, 0.1, 0.92),
    hazard: s(0xd9a312, 0.2, 0.58),
    concrete: s(0x9b958b, 0.0, 0.96),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x9fc3d6,
      metalness: 0,
      roughness: 0.12,
      transparent: true,
      opacity: 0.45,
    }),
  };
}

/** Drive an emissive lamp from 0 (off) to 1 (full glow). */
export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material;
  const g = glow < 0 ? 0 : glow > 1 ? 1 : glow;
  if (mat instanceof THREE.MeshStandardMaterial) {
    mat.emissiveIntensity = g;
  }
}

export function triangles(g: Gear): number {
  let t = 0;
  g.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const geo = obj.geometry;
      const index = geo.getIndex();
      const pos = geo.getAttribute("position");
      if (index) t += index.count / 3;
      else if (pos) t += pos.count / 3;
    }
  });
  return t;
}

/* ----------------------------- helpers ----------------------------- */

type V3 = THREE.Vector3;
const V3 = THREE.Vector3;

/** Guarantee position+normal+uv and a non-indexed buffer so mergeGeometries never fails. */
function prep(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  if (!g.getAttribute("uv")) {
    const p = g.getAttribute("position");
    if (p) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
  }
  return g;
}

/** Per-material bucket builder; finalize() emits one merged Mesh per material. */
class Builder {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  constructor(public readonly group: THREE.Group) {}
  add(geo: THREE.BufferGeometry, mat: THREE.Material): void {
    const arr = this.buckets.get(mat);
    const p = prep(geo);
    if (arr) arr.push(p);
    else this.buckets.set(mat, [p]);
  }
  finalize(): void {
    for (const [mat, geos] of this.buckets) {
      if (geos.length === 0) continue;
      const merged = geos.length === 1 ? geos[0]! : mergeGeometries(geos, false);
      if (!merged) continue;
      this.group.add(new THREE.Mesh(merged, mat));
    }
  }
}

function gBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotY = 0
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY !== 0) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function gCyl(
  rt: number,
  rb: number,
  h: number,
  seg: number,
  x: number,
  y: number,
  z: number
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return g;
}

function gTube(
  rIn: number,
  rOut: number,
  h: number,
  seg: number,
  x: number,
  y: number,
  z: number
): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(rIn, 0),
    new THREE.Vector2(rOut, 0),
    new THREE.Vector2(rOut, h),
    new THREE.Vector2(rIn, h),
    new THREE.Vector2(rIn, 0),
  ];
  const g = new THREE.LatheGeometry(pts, seg);
  g.translate(x, y, z);
  return g;
}

function gSphere(
  r: number,
  wseg: number,
  hseg: number,
  x: number,
  y: number,
  z: number,
  phiS = 0,
  phiL = Math.PI * 2,
  thetaS = 0,
  thetaL = Math.PI
): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, wseg, hseg, phiS, phiL, thetaS, thetaL);
  g.translate(x, y, z);
  return g;
}

/** A tapered tube between two points (used for lattice struts). */
function gStrut(a: V3, b: V3, r: number, seg: number): THREE.BufferGeometry {
  const dir = new V3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new V3(0, 1, 0),
    dir.clone().normalize()
  );
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

/** Thick cable routed along the floor through a few control points. */
function gCable(points: V3[], radius: number, radial: number, tubular: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  return new THREE.TubeGeometry(curve, tubular, radius, radial, false);
}

function addBoltRing(
  b: Builder,
  mat: THREE.Material,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  count: number,
  seg: number,
  h: number
): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    b.add(gCyl(0.07, 0.07, h, seg, cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r), mat);
  }
}

function lampMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    roughness: 0.4,
    metalness: 0.2,
  });
}

function makeLamp(geo: THREE.BufferGeometry, color: number): THREE.Mesh {
  return new THREE.Mesh(prep(geo), lampMat(color));
}

function mergeToMesh(geos: THREE.BufferGeometry[], mat: THREE.Material): THREE.Mesh {
  const prepped = geos.map(prep);
  const merged = prepped.length === 1 ? prepped[0]! : mergeGeometries(prepped, false);
  const g = merged ?? prepped[0]!;
  return new THREE.Mesh(g, mat);
}

/* ------------------------------ hardpoint ------------------------------ */

export function hardpoint(m: LabMaterials, o: { stage: number }): Gear {
  const group = new THREE.Group();
  const b = new Builder(group);
  const detail = o.stage >= 6;
  const seg = detail ? 20 : 10;
  const cx = 4;
  const cz = 4;

  // slab pad (2x2 cells)
  b.add(gBox(8, 0.12, 8, cx, 0.06, cz), m.concrete);

  // bolted cylinder socket
  b.add(gCyl(1.4, 1.4, 0.5, seg, cx, 0.25, cz), m.gunmetal); // body
  b.add(gCyl(1.9, 2.0, 0.08, seg, cx, 0.04, cz), m.gunmetal); // wide flange
  b.add(gTube(0.6, 0.9, 0.25, seg, cx, 0.5, cz), m.gunmetal); // raised top ring

  // flange bolts
  addBoltRing(b, m.darkSteel, cx, 0.09, cz, 1.7, detail ? 12 : 6, seg, 0.08);

  // cable glands (copper fittings)
  b.add(gCyl(0.18, 0.18, 0.3, seg, cx, 0.25, cz + 0.6), m.copper);
  b.add(gCyl(0.18, 0.18, 0.3, seg, cx - 0.6, 0.25, cz), m.copper);

  // thick cables (orange / green) leaving through the glands to the pad edge
  const cableO = m.rubber.clone();
  cableO.color.set(0xff7a1a);
  const cableG = m.rubber.clone();
  cableG.color.set(0x2fae4f);
  const rs = detail ? 10 : 6;
  const ts = detail ? 26 : 12;
  b.add(
    gCable(
      [
        new V3(cx, 0.32, cz + 0.55),
        new V3(cx + 1.5, 0.2, cz + 0.4),
        new V3(cx + 3.4, 0.14, cz + 0.05),
        new V3(cx + 3.75, 0.12, cz),
      ],
      0.12,
      rs,
      ts
    ),
    cableO
  );
  b.add(
    gCable(
      [
        new V3(cx - 0.55, 0.32, cz),
        new V3(cx - 0.55, 0.2, cz + 1.6),
        new V3(cx - 0.05, 0.14, cz + 3.4),
        new V3(cx, 0.12, cz + 3.75),
      ],
      0.12,
      rs,
      ts
    ),
    cableG
  );

  // ribbed floor cable covers
  b.add(gBox(3.4, 0.14, 0.6, cx + 1.7, 0.07, cz + 0.2), m.darkSteel);
  b.add(gBox(0.6, 0.14, 3.4, cx - 0.2, 0.07, cz + 1.7), m.darkSteel);
  if (detail) {
    for (let i = 0; i < 6; i++) {
      b.add(gBox(0.08, 0.06, 0.5, cx + 0.4 + i * 0.55, 0.15, cz + 0.2), m.darkSteel);
      b.add(gBox(0.5, 0.06, 0.08, cx - 0.2, 0.15, cz + 0.4 + i * 0.55), m.darkSteel);
    }
  }

  b.finalize();

  const sockets: Socket[] = [
    { name: "mount", at: [cx, 0.75, cz] },
    { name: "power", at: [8, 0.12, cz] },
  ];
  const colliders: Box[] = [{ min: [0, 0, 0], max: [8, 0.85, 8] }];
  return { group, colliders, sockets, lamps: [] };
}

/* ------------------------------ heavyMill ------------------------------ */

export function heavyMill(m: LabMaterials, o: { stage: number }): Gear {
  const group = new THREE.Group();
  const b = new Builder(group);
  const detail = o.stage >= 6;
  const seg = detail ? 18 : 9;
  const cx = 4;
  const cz = 4;
  const t = 0.18; // wall thickness

  // ---- body shell (paint) with a recessed front opening ----
  b.add(gBox(3.2, 4.0, t, cx, 2.25, cz - 1.6 + t / 2), m.paint); // back wall
  b.add(gBox(t, 4.0, 3.2, cx - 1.6 + t / 2, 2.25, cz), m.paint); // left wall
  b.add(gBox(t, 4.0, 3.2, cx + 1.6 - t / 2, 2.25, cz), m.paint); // right wall
  b.add(gBox(3.2, t, 3.2, cx, 4.25 - t / 2, cz), m.paint); // top wall
  b.add(gBox(3.2, t, 3.2, cx, 0.25 + t / 2, cz), m.paint); // bottom wall
  // front frame (opening x2.9..5.1, y0.9..3.75)
  b.add(gBox(3.2, 0.5, t, cx, 4.0, cz + 1.6 - t / 2), m.paint); // f-top
  b.add(gBox(3.2, 0.65, t, cx, 0.575, cz + 1.6 - t / 2), m.paint); // f-bottom
  b.add(gBox(0.5, 2.85, t, cx - 1.35, 2.325, cz + 1.6 - t / 2), m.paint); // f-left
  b.add(gBox(0.5, 2.85, t, cx + 1.35, 2.325, cz + 1.6 - t / 2), m.paint); // f-right

  // chamfered vertical edges (45° strips on the four corners)
  const cham = Math.PI / 4;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.add(gBox(0.16, 4.0, 0.16, cx + sx * 1.6, 2.25, cz + sz * 1.6, cham), m.gunmetal);
    }
  }

  // recessed door (darkSteel) set back inside the opening
  b.add(gBox(2.1, 2.75, 0.08, cx, 2.325, cz + 1.6 - 0.56), m.darkSteel);
  b.add(gBox(0.06, 0.5, 0.06, cx + 0.7, 2.325, cz + 1.6 - 0.5), m.gunmetal); // handle

  // bolted base plate + feet
  b.add(gBox(3.6, 0.25, 3.6, cx, 0.125, cz), m.darkSteel);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.add(gBox(0.4, 0.18, 0.4, cx + sx * 1.45, 0.09, cz + sz * 1.45), m.gunmetal);
    }
  }
  addBoltRing(b, m.darkSteel, cx, 0.27, cz, 1.55, detail ? 12 : 6, seg, 0.06);

  // open square hopper on top, heaped with dark ore
  const hy = 4.25;
  b.add(gBox(2.0, 0.4, 0.12, cx, hy + 0.2, cz - 1.0 + 0.06), m.gunmetal); // h-back
  b.add(gBox(2.0, 0.4, 0.12, cx, hy + 0.2, cz + 1.0 - 0.06), m.gunmetal); // h-front
  b.add(gBox(0.12, 0.4, 2.0, cx - 1.0 + 0.06, hy + 0.2, cz), m.gunmetal); // h-left
  b.add(gBox(0.12, 0.4, 2.0, cx + 1.0 - 0.06, hy + 0.2, cz), m.gunmetal); // h-right
  const ore = new THREE.IcosahedronGeometry(0.7, detail ? 1 : 0);
  ore.scale(1, 0.45, 1);
  ore.translate(cx, hy + 0.32, cz);
  b.add(ore, m.darkSteel);

  // louvred rear vent grille (proud panel + slats)
  const vy = 2.0;
  b.add(gBox(1.8, 1.4, 0.1, cx, vy, cz - 1.6 + 0.05), m.gunmetal); // panel
  const slats = detail ? 7 : 3;
  for (let i = 0; i < slats; i++) {
    const yy = vy - 0.5 + (i / (slats - 1)) * 1.0;
    b.add(gBox(1.55, 0.08, 0.08, cx, yy, cz - 1.6 - 0.14), m.gunmetal);
  }
  // pink pixels pouring from the vent
  const pink = m.rubber.clone();
  pink.color.set(0xff5fae);
  const px = detail ? 5 : 3;
  for (let i = 0; i < px; i++) {
    b.add(
      gBox(0.1, 0.1, 0.1, cx + (i - px / 2) * 0.18, 0.12 + (i % 2) * 0.04, cz - 1.85 - (i % 3) * 0.12),
      pink
    );
  }

  b.finalize();

  // two status lamps on the upper front
  const lampA = makeLamp(gCyl(0.12, 0.12, 0.1, seg, cx - 0.5, 3.6, cz + 1.6 - 0.05), 0x33ff66);
  const lampB = makeLamp(gCyl(0.12, 0.12, 0.1, seg, cx + 0.5, 3.6, cz + 1.6 - 0.05), 0xff3344);
  group.add(lampA, lampB);

  const sockets: Socket[] = [
    { name: "vent", at: [cx, vy, cz - 1.7] },
    { name: "hopper", at: [cx, hy + 0.45, cz] },
    { name: "power", at: [cx, 0.4, cz + 1.6 - 0.02] },
  ];
  const colliders: Box[] = [{ min: [2.2, 0, 2.2], max: [5.8, 4.7, 5.8] }];
  return { group, colliders, sockets, lamps: [lampA, lampB] };
}

/* ------------------------------ bin ------------------------------ */

export function bin(m: LabMaterials, o: { stage: number }): Gear {
  const group = new THREE.Group();
  const b = new Builder(group);
  const detail = o.stage >= 6;
  const seg = detail ? 16 : 8;
  const cx = 2;
  const cz = 2;

  // four feet
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.add(gBox(0.25, 0.18, 0.25, cx + sx * 0.65, 0.09, cz + sz * 0.65), m.gunmetal);
    }
  }
  // steel cabinet
  b.add(gBox(1.6, 1.4, 1.6, cx, 0.88, cz), m.darkSteel);
  // keypad + handle on the front (+z)
  b.add(gBox(0.3, 0.4, 0.04, cx - 0.35, 0.7, cz + 0.8 + 0.02), m.gunmetal);
  b.add(gBox(0.5, 0.06, 0.06, cx + 0.35, 1.1, cz + 0.8 + 0.03), m.gunmetal);

  b.finalize();

  // small dish emitter on top (lamp)
  const dish = makeLamp(
    gSphere(0.45, seg, seg / 2, cx, 1.58, cz, 0, Math.PI * 2, 0, Math.PI / 2),
    0x9fd8ff
  );
  group.add(dish);

  const sockets: Socket[] = [{ name: "link", at: [cx, 1.95, cz] }];
  const colliders: Box[] = [{ min: [1.2, 0, 1.2], max: [2.8, 2.0, 2.8] }];
  return { group, colliders, sockets, lamps: [dish] };
}

/* ------------------------------ repeater ------------------------------ */

export function repeater(m: LabMaterials, o: { stage: number }): Gear {
  const group = new THREE.Group();
  const b = new Builder(group);
  const detail = o.stage >= 6;
  const seg = detail ? 14 : 8;
  const sseg = detail ? seg : 6; // chunky struts at stage 1
  const cx = 2;
  const cz = 2;

  // bolted concrete base
  b.add(gBox(1.6, 0.4, 1.6, cx, 0.2, cz), m.concrete);
  addBoltRing(b, m.darkSteel, cx, 0.42, cz, 0.65, detail ? 8 : 4, sseg, 0.06);

  // distribution box at the foot
  b.add(gBox(0.5, 0.6, 0.4, cx + 0.9, 0.5, cz), m.darkSteel);

  // tapering lattice tower
  const angles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
  const towerR = (y: number): number => 0.7 - ((y - 0.4) / 6.6) * 0.35;
  const postPts = angles.map((a) => ({
    a,
    bx: cx + 0.7 * Math.cos(a),
    bz: cz + 0.7 * Math.sin(a),
    tx: cx + 0.35 * Math.cos(a),
    tz: cz + 0.35 * Math.sin(a),
  }));
  for (const p of postPts) {
    b.add(gStrut(new V3(p.bx, 0.4, p.bz), new V3(p.tx, 7.0, p.tz), 0.06, sseg), m.gunmetal);
  }
  const heights = detail ? [0.4, 2.0, 3.6, 5.2, 6.8] : [0.4, 3.4, 6.4];
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i]!;
    const r = towerR(h);
    const pts = angles.map((a) => new V3(cx + r * Math.cos(a), h, cz + r * Math.sin(a)));
    for (let k = 0; k < 4; k++) {
      b.add(gStrut(pts[k]!, pts[(k + 1) % 4]!, 0.05, sseg), m.gunmetal);
    }
    if (detail && i < heights.length - 1) {
      const h2 = heights[i + 1]!;
      const r2 = towerR(h2);
      const pts2 = angles.map((a) => new V3(cx + r2 * Math.cos(a), h2, cz + r2 * Math.sin(a)));
      for (let k = 0; k < 4; k++) {
        b.add(gStrut(pts[k]!, pts2[(k + 1) % 4]!, 0.04, sseg), m.gunmetal);
        b.add(gStrut(pts2[k]!, pts[(k + 1) % 4]!, 0.04, sseg), m.gunmetal);
      }
    }
  }

  // top antenna
  b.add(gStrut(new V3(cx, 7.0, cz), new V3(cx, 7.5, cz), 0.04, sseg), m.gunmetal);

  b.finalize();

  // ring of emitters on top (lamp)
  const ringGeos: THREE.BufferGeometry[] = [];
  const ringN = detail ? 10 : 6;
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2;
    ringGeos.push(gCyl(0.05, 0.05, 0.18, seg, cx + 0.42 * Math.cos(a), 7.0, cz + 0.42 * Math.sin(a)));
  }
  const ring = mergeToMesh(ringGeos, lampMat(0x66ccff));
  group.add(ring);

  // red top lamp
  const red = makeLamp(gSphere(0.12, seg, seg / 2, cx, 7.18, cz), 0xff2a2a);
  group.add(red);

  const sockets: Socket[] = [
    { name: "top", at: [cx, 7.18, cz] },
    { name: "box", at: [cx + 0.9, 0.5, cz] },
  ];
  const colliders: Box[] = [{ min: [1.2, 0, 1.2], max: [2.8, 7.5, 2.8] }];
  return { group, colliders, sockets, lamps: [red, ring] };
}

/* ------------------------------ draftingTable ------------------------------ */

export function draftingTable(m: LabMaterials, o: { stage: number }): Gear {
  const group = new THREE.Group();
  const b = new Builder(group);
  const detail = o.stage >= 6;
  const seg = detail ? 12 : 8;
  const cx = 2;
  const cz = 2;

  // tabletop frame around the inset drafting screen
  b.add(gBox(2.4, 0.08, 0.3, cx, 0.99, cz - 0.6 + 0.15), m.darkSteel); // back bar
  b.add(gBox(2.4, 0.08, 0.3, cx, 0.99, cz + 0.6 - 0.15), m.darkSteel); // front bar
  b.add(gBox(0.4, 0.08, 1.2, cx - 1.2 + 0.2, 0.99, cz), m.darkSteel); // left bar
  b.add(gBox(0.4, 0.08, 1.2, cx + 1.2 - 0.2, 0.99, cz), m.darkSteel); // right bar

  // braced legs
  const legY = 0.475;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.add(gBox(0.12, 0.95, 0.12, cx + sx * 1.1, legY, cz + sz * 0.5), m.darkSteel);
    }
  }
  b.add(gBox(2.2, 0.08, 0.08, cx, 0.4, cz - 0.5), m.gunmetal); // front brace
  b.add(gBox(2.2, 0.08, 0.08, cx, 0.4, cz + 0.5), m.gunmetal); // back brace
  b.add(gBox(0.08, 0.08, 1.0, cx - 1.1, 0.4, cz), m.gunmetal); // left brace
  b.add(gBox(0.08, 0.08, 1.0, cx + 1.1, 0.4, cz), m.gunmetal); // right brace

  // side cabinet (reaches up to the bench top)
  b.add(gBox(0.5, 0.95, 1.0, cx + 1.1, 0.475, cz), m.darkSteel);

  // props on the bench
  b.add(gBox(0.2, 0.2, 0.2, cx - 0.4, 1.13, cz - 0.2), m.paint); // cube
  b.add(gBox(0.3, 0.02, 0.2, cx + 0.2, 1.04, cz - 0.2), m.hazard); // swatch

  if (detail) {
    for (const sz of [-0.25, 0.25]) {
      b.add(gCyl(0.05, 0.05, 0.06, seg, cx + 1.35, 0.3, cz + sz), m.gunmetal);
    }
  }

  b.finalize();

  // glowing blue drafting screen (lamp) inset below the frame top
  const screen = makeLamp(gBox(1.6, 0.06, 0.6, cx, 0.97, cz), 0x2a6cff);
  group.add(screen);

  const sockets: Socket[] = [{ name: "screen", at: [cx, 0.98, cz] }];
  const colliders: Box[] = [{ min: [0.8, 0, 1.4], max: [3.2, 1.2, 2.6] }];
  return { group, colliders, sockets, lamps: [screen] };
}
