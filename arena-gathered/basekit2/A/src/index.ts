import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface Box {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Piece {
  group: THREE.Group;
  colliders: Box[];
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

/* ------------------------------------------------------------------ */
/*  Geometry helpers (non-indexed box only)                            */
/* ------------------------------------------------------------------ */

function makeBoxGeometry(
  w: number,
  d: number,
  h: number
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const norms: number[] = [];
  const uvsArr: number[] = [];

  const halfW = w / 2;
  const halfD = d / 2;
  const halfH = h / 2;

  const addTri = (
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
    n: [number, number, number],
    u1: [number, number],
    u2: [number, number],
    u3: [number, number]
  ) => {
    vertices.push(...v1, ...v2, ...v3);
    norms.push(...n, ...n, ...n);
    uvsArr.push(...u1, ...u2, ...u3);
  };

  addTri(
    [halfW, -halfH, -halfD],
    [halfW, halfH, -halfD],
    [halfW, halfH, halfD],
    [1, 0, 0],
    [0, 0],
    [0, 1],
    [1, 1]
  );
  addTri(
    [halfW, -halfH, -halfD],
    [halfW, halfH, halfD],
    [halfW, -halfH, halfD],
    [1, 0, 0],
    [0, 0],
    [1, 1],
    [1, 0]
  );

  addTri(
    [-halfW, -halfH, halfD],
    [-halfW, halfH, halfD],
    [-halfW, halfH, -halfD],
    [-1, 0, 0],
    [0, 1],
    [0, 1],
    [1, 1]
  );
  addTri(
    [-halfW, -halfH, halfD],
    [-halfW, halfH, -halfD],
    [-halfW, -halfH, -halfD],
    [-1, 0, 0],
    [0, 1],
    [1, 0],
    [1, 0]
  );

  addTri(
    [-halfW, halfH, halfD],
    [halfW, halfH, halfD],
    [halfW, halfH, -halfD],
    [0, 1, 0],
    [0, 0],
    [1, 0],
    [1, 1]
  );
  addTri(
    [-halfW, halfH, halfD],
    [halfW, halfH, -halfD],
    [-halfW, halfH, -halfD],
    [0, 1, 0],
    [0, 0],
    [1, 1],
    [0, 1]
  );

  addTri(
    [-halfW, -halfH, -halfD],
    [halfW, -halfH, -halfD],
    [halfW, -halfH, halfD],
    [0, -1, 0],
    [0, 0],
    [1, 0],
    [1, 1]
  );
  addTri(
    [-halfW, -halfH, -halfD],
    [halfW, -halfH, halfD],
    [-halfW, -halfH, halfD],
    [0, -1, 0],
    [0, 0],
    [1, 1],
    [0, 1]
  );

  addTri(
    [-halfW, -halfH, halfD],
    [halfW, -halfH, halfD],
    [halfW, halfH, halfD],
    [0, 0, 1],
    [0, 0],
    [1, 0],
    [1, 1]
  );
  addTri(
    [-halfW, -halfH, halfD],
    [halfW, halfH, halfD],
    [-halfW, halfH, halfD],
    [0, 0, 1],
    [0, 0],
    [1, 1],
    [0, 1]
  );

  addTri(
    [-halfW, -halfH, -halfD],
    [halfW, -halfH, -halfD],
    [halfW, halfH, -halfD],
    [0, 0, -1],
    [0, 0],
    [1, 0],
    [1, 1]
  );
  addTri(
    [-halfW, -halfH, -halfD],
    [halfW, halfH, -halfD],
    [-halfW, halfH, -halfD],
    [0, 0, -1],
    [0, 0],
    [1, 1],
    [0, 1]
  );

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvsArr, 2));
  return geo;
}

/* ------------------------------------------------------------------ */
/*  Material factory                                                     */
/* ------------------------------------------------------------------ */

export function createMaterials(): LabMaterials {
  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0x223344, metalness: 0.9, roughness: 0.3,
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x1a2330, metalness: 0.85, roughness: 0.4,
  });
  const paint = new THREE.MeshStandardMaterial({
    color: 0x556677, metalness: 0.2, roughness: 0.7,
  });
  const copper = new THREE.MeshStandardMaterial({
    color: 0xaa6633, metalness: 0.9, roughness: 0.2,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x222222, metalness: 0.1, roughness: 0.9,
  });
  const hazard = new THREE.MeshStandardMaterial({
    color: 0xccaa00, metalness: 0.5, roughness: 0.6,
  });
  const concrete = new THREE.MeshStandardMaterial({
    color: 0x888888, metalness: 0.2, roughness: 0.8,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x88aa99, metalness: 0.1, roughness: 0.05,
    transparent: true, opacity: 0.35, transmission: 0,
  });
  return {
    gunmetal, darkSteel, paint, copper, rubber, hazard, concrete, glass,
  };
}

/* ------------------------------------------------------------------ */
/*  Lamp control                                                         */
/* ------------------------------------------------------------------ */

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material as THREE.MeshStandardMaterial;
  mat.emissive.setHex(0xffaa00);
  mat.emissiveIntensity = Math.min(Math.max(glow, 0), 1);
}

/* ------------------------------------------------------------------ */
/*  Triangle counter                                                      */
/* ------------------------------------------------------------------ */

export function triangles(p: Piece): number {
  let count = 0;
  p.group.traverse((o: THREE.Object3D) => {
    if (o instanceof THREE.Mesh) {
      const geo = o.geometry;
      if (!geo.index) {
        count += (geo.attributes.position?.count ?? 0) / 3;
      } else {
        count += (geo.index?.count ?? 0) / 3;
      }
    }
  });
  return Math.round(count);
}

/* ------------------------------------------------------------------ */
/*  Geometry merge helper (translates + merges per material)         */
/* ------------------------------------------------------------------ */

function translateGeo(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number
): THREE.BufferGeometry {
  const clone = geo.clone();
  clone.translate(x, y, z);
  return clone;
}

function rotateGeo(
  geo: THREE.BufferGeometry,
  rx: number,
  ry: number,
  rz: number
): THREE.BufferGeometry {
  const clone = geo.clone();
  if (rx !== 0) clone.rotateX(rx);
  if (ry !== 0) clone.rotateY(ry);
  if (rz !== 0) clone.rotateZ(rz);
  return clone;
}

interface GeoPart {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  x: number;
  y: number;
  z: number;
  rx?: number;
  ry?: number;
  rz?: number;
}

function buildMergedGroup(parts: GeoPart[]): THREE.Group {
  const group = new THREE.Group();
  const byMat = new Map<string, THREE.BufferGeometry[]>();
  const matMap = new Map<string, THREE.Material>();
  for (const part of parts) {
    let geo = part.geo.clone();
    if (part.rx !== undefined || part.ry !== undefined || part.rz !== undefined) {
      geo = rotateGeo(geo, part.rx ?? 0, part.ry ?? 0, part.rz ?? 0);
    }
    geo = translateGeo(geo, part.x, part.y, part.z);
    const key = (part.mat as THREE.Material).uuid;
    if (!byMat.has(key)) {
      byMat.set(key, []);
      matMap.set(key, part.mat);
    }
    byMat.get(key)!.push(geo);
  }
  for (const [key, geos] of byMat) {
    const merged = mergeGeometries(geos);
    merged.setIndex(null);
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, matMap.get(key)!);
    group.add(mesh);
  }
  return group;
}

/* ------------------------------------------------------------------ */
/*  halfWall                                                              */
/* ------------------------------------------------------------------ */

export function halfWall(
  m: LabMaterials,
  opts: { stage: number }
): Piece {
  const parts: GeoPart[] = [];
  parts.push({ geo: makeBoxGeometry(4, 0.25, 1.5), mat: m.darkSteel, x: 2, y: 0.75, z: 0 });
  parts.push({ geo: makeBoxGeometry(4, 0.3, 0.08), mat: m.gunmetal, x: 2, y: 1.54, z: 0 });
  parts.push({ geo: makeBoxGeometry(0.08, 0.25, 1.5), mat: m.gunmetal, x: 0.04, y: 0.75, z: 0 });
  parts.push({ geo: makeBoxGeometry(0.08, 0.25, 1.5), mat: m.gunmetal, x: 3.96, y: 0.75, z: 0 });

  if (opts.stage >= 6) {
    for (let i = 0; i < 5; i++) {
      parts.push({ geo: makeBoxGeometry(0.06, 0.26, 0.06), mat: m.paint, x: 0.5 + i * 0.75, y: 1.3, z: 0.14 });
    }
    parts.push({ geo: makeBoxGeometry(4, 0.28, 0.02), mat: m.gunmetal, x: 2, y: 1.57, z: 0 });
  }

  const g = buildMergedGroup(parts);
  const colliders: Box[] = [
    { min: [0, 0, -0.13], max: [4, 1.5, 0.13] },
    { min: [0, 0, -0.13], max: [0.08, 1.5, 0.13] },
    { min: [3.92, 0, -0.13], max: [4, 1.5, 0.13] },
  ];
  return { group: g, colliders, lamps: [] };
}

/* ------------------------------------------------------------------ */
/*  windowWall                                                           */
/* ------------------------------------------------------------------ */

export function windowWall(
  m: LabMaterials,
  opts: { stage: number }
): Piece {
  const parts: GeoPart[] = [];
  parts.push({ geo: makeBoxGeometry(4, 0.25, 0.8), mat: m.darkSteel, x: 2, y: 2.6, z: 0 });
  parts.push({ geo: makeBoxGeometry(4, 0.25, 1), mat: m.darkSteel, x: 2, y: 0.5, z: 0 });
  parts.push({ geo: makeBoxGeometry(0.8, 0.25, 3), mat: m.darkSteel, x: 0.4, y: 1.5, z: 0 });
  parts.push({ geo: makeBoxGeometry(0.8, 0.25, 3), mat: m.darkSteel, x: 3.6, y: 1.5, z: 0 });

  const frameW = 0.08;
  parts.push({ geo: makeBoxGeometry(2.4 + 2 * frameW, frameW, 0.08), mat: m.gunmetal, x: 2, y: 2.2 - frameW / 2 + 0.04, z: 0.13 });
  parts.push({ geo: makeBoxGeometry(2.4 + 2 * frameW, frameW, 0.1), mat: m.gunmetal, x: 2, y: 1 + 0.05, z: 0.13 });
  parts.push({ geo: makeBoxGeometry(frameW, 0.15, 1.2 + 2 * frameW), mat: m.gunmetal, x: 0.8 - frameW / 2, y: 1.6, z: 0.08 });
  parts.push({ geo: makeBoxGeometry(frameW, 0.15, 1.2 + 2 * frameW), mat: m.gunmetal, x: 3.2 + frameW / 2, y: 1.6, z: 0.08 });
  parts.push({ geo: makeBoxGeometry(2.2, 0.05, 1.0), mat: m.glass, x: 2, y: 1.6, z: 0.1 });

  if (opts.stage >= 6) {
    for (let i = 0; i < 8; i++) {
      parts.push({ geo: makeBoxGeometry(0.05, 0.15, 0.05), mat: m.gunmetal, x: 1 + i * 0.3, y: 2.8, z: 0.15 });
    }
  }

  const g = buildMergedGroup(parts);
  const colliders: Box[] = [
    { min: [0, 0, -0.13], max: [4, 3, 0.13] },
  ];
  return { group: g, colliders, lamps: [] };
}

/* ------------------------------------------------------------------ */
/*  doorframe                                                             */
/* ------------------------------------------------------------------ */

export function doorframe(
  m: LabMaterials,
  opts: { stage: number }
): Piece {
  const parts: GeoPart[] = [];
  parts.push({ geo: makeBoxGeometry(1.3, 0.25, 3), mat: m.darkSteel, x: 0.65, y: 1.5, z: 0 });
  parts.push({ geo: makeBoxGeometry(1.3, 0.25, 3), mat: m.darkSteel, x: 3.35, y: 1.5, z: 0 });
  parts.push({ geo: makeBoxGeometry(4, 0.25, 0.7), mat: m.darkSteel, x: 2, y: 2.65, z: 0 });
  parts.push({ geo: makeBoxGeometry(0.2, 0.3, 3), mat: m.gunmetal, x: 1.2, y: 1.5, z: 0 });
  parts.push({ geo: makeBoxGeometry(0.2, 0.3, 3), mat: m.gunmetal, x: 2.8, y: 1.5, z: 0 });
  parts.push({ geo: makeBoxGeometry(1.4, 0.35, 0.15), mat: m.gunmetal, x: 2, y: 2.375, z: 0 });

  if (opts.stage >= 6) {
    parts.push({ geo: makeBoxGeometry(0.08, 0.15, 2.3), mat: m.gunmetal, x: 1.34, y: 1.15, z: 0 });
    parts.push({ geo: makeBoxGeometry(0.08, 0.15, 2.3), mat: m.gunmetal, x: 2.66, y: 1.15, z: 0 });
  }

  const g = buildMergedGroup(parts);
  const colliders: Box[] = [
    { min: [0, 0, -0.13], max: [1.3, 3, 0.13] },
    { min: [2.7, 0, -0.13], max: [4, 3, 0.13] },
    { min: [0, 2.3, -0.13], max: [4, 3, 0.13] },
    { min: [1.2, 0, -0.15], max: [1.4, 3, 0.15] },
    { min: [2.6, 0, -0.15], max: [2.8, 3, 0.15] },
    { min: [1.3, 2.3, -0.18], max: [2.7, 2.45, 0.18] },
  ];
  return { group: g, colliders, lamps: [] };
}

/* ------------------------------------------------------------------ */
/*  door                                                                  */
/* ------------------------------------------------------------------ */

export function door(
  m: LabMaterials,
  opts: { stage: number }
): Piece {
  const parts: GeoPart[] = [];
  parts.push({ geo: makeBoxGeometry(1.3, 0.25, 3), mat: m.darkSteel, x: 0.65, y: 1.5, z: 0 });
  parts.push({ geo: makeBoxGeometry(1.3, 0.25, 3), mat: m.darkSteel, x: 3.35, y: 1.5, z: 0 });
  parts.push({ geo: makeBoxGeometry(4, 0.25, 0.7), mat: m.darkSteel, x: 2, y: 2.65, z: 0 });
  parts.push({ geo: makeBoxGeometry(0.2, 0.3, 3), mat: m.gunmetal, x: 1.2, y: 1.5, z: 0 });
  parts.push({ geo: makeBoxGeometry(0.2, 0.3, 3), mat: m.gunmetal, x: 2.8, y: 1.5, z: 0 });
  parts.push({ geo: makeBoxGeometry(1.4, 0.35, 0.15), mat: m.gunmetal, x: 2, y: 2.375, z: 0 });

  if (opts.stage >= 6) {
    parts.push({ geo: makeBoxGeometry(0.08, 0.15, 2.3), mat: m.gunmetal, x: 1.34, y: 1.15, z: 0 });
    parts.push({ geo: makeBoxGeometry(0.08, 0.15, 2.3), mat: m.gunmetal, x: 2.66, y: 1.15, z: 0 });
  }

  void opts; // suppress unused
  const g = buildMergedGroup(parts);

  // Leaf - separate mesh for rotation and parts reference
  const leafGeo = makeBoxGeometry(1.4, 0.06, 2.3);
  leafGeo.translate(0.7, 0, 0); // hinge edge at local origin
  const leafMesh = new THREE.Mesh(leafGeo, m.darkSteel);
  leafMesh.position.set(1.3, 1.15, 0);
  g.add(leafMesh);

  // Status lamp
  const lampGeo = makeBoxGeometry(0.3, 0.06, 0.1);
  const lampMesh = new THREE.Mesh(lampGeo, new THREE.MeshStandardMaterial({
    color: 0xffaa00, emissive: 0x442200, emissiveIntensity: 0.8,
  }));
  lampMesh.position.set(2, 2.6, 0.15);
  g.add(lampMesh);

  const lampGeo2 = makeBoxGeometry(0.25, 0.03, 0.06);
  const lampMesh2 = new THREE.Mesh(lampGeo2, new THREE.MeshStandardMaterial({
    color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 0.8,
  }));
  lampMesh2.position.set(2, 2.62, 0.18);
  g.add(lampMesh2);

  const partsObj: Record<string, THREE.Object3D> = {
    leaf: leafMesh,
  };

  const colliders: Box[] = [
    { min: [0, 0, -0.13], max: [1.3, 3, 0.13] },
    { min: [2.7, 0, -0.13], max: [4, 3, 0.13] },
    { min: [0, 2.3, -0.13], max: [4, 3, 0.13] },
    { min: [1.2, 0, -0.15], max: [1.4, 3, 0.15] },
    { min: [2.6, 0, -0.15], max: [2.8, 3, 0.15] },
    { min: [1.3, 2.3, -0.18], max: [2.7, 2.45, 0.18] },
  ];

  return { group: g, colliders, lamps: [lampMesh2], parts: partsObj };
}

/* ------------------------------------------------------------------ */
/*  railing                                                              */
/* ------------------------------------------------------------------ */

export function railing(
  m: LabMaterials,
  opts: { stage: number }
): Piece {
  const parts: GeoPart[] = [];
  parts.push({ geo: makeBoxGeometry(4, 0.2, 0.15), mat: m.gunmetal, x: 2, y: 0.075, z: 0.05 });
  for (let x = 0; x <= 4; x += 1) {
    parts.push({ geo: makeBoxGeometry(0.06, 0.15, 1.1), mat: m.gunmetal, x: x, y: 0.55, z: 0.005 });
  }
  parts.push({ geo: makeBoxGeometry(4, 0.06, 0.06), mat: m.gunmetal, x: 2, y: 0.55, z: 0.04 });
  parts.push({ geo: makeBoxGeometry(4, 0.06, 0.06), mat: m.gunmetal, x: 2, y: 0.95, z: 0.04 });
  parts.push({ geo: makeBoxGeometry(4, 0.06, 0.02), mat: m.hazard, x: 2, y: 0.98, z: 0.05 });

  if (opts.stage >= 6) {
    for (let i = 0; i < 6; i++) {
      parts.push({ geo: makeBoxGeometry(0.04, 0.06, 0.04), mat: m.gunmetal, x: i * 0.8, y: 0.98, z: 0.06 });
    }
  }

  const g = buildMergedGroup(parts);
  const colliders: Box[] = [
    { min: [0, 0, -0.1], max: [4, 1.1, 0.15] },
  ];
  for (let x = 0; x <= 4; x += 1) {
    colliders.push({ min: [x - 0.03, 0, -0.05], max: [x + 0.03, 1.1, 0.08] });
  }
  return { group: g, colliders, lamps: [] };
}

/* ------------------------------------------------------------------ */
/*  ladder                                                                */
/* ------------------------------------------------------------------ */

export function ladder(
  m: LabMaterials,
  opts: { stage: number }
): Piece {
  const parts: GeoPart[] = [];
  // Rails
  parts.push({ geo: makeBoxGeometry(0.08, 0.08, 3.9), mat: m.gunmetal, x: 1.765, y: 1.95, z: 0.16 });
  parts.push({ geo: makeBoxGeometry(0.08, 0.08, 3.9), mat: m.gunmetal, x: 2.235, y: 1.95, z: 0.16 });
  // Rungs
  for (let y = 0; y <= 3.6; y += 0.3) {
    parts.push({ geo: makeBoxGeometry(0.47, 0.03, 0.04), mat: m.gunmetal, x: 2, y: y + 0.015, z: 0.16 });
  }
  // Brackets
  for (let y = 1; y <= 3; y += 1) {
    parts.push({ geo: makeBoxGeometry(0.08, 0.02, 0.12), mat: m.gunmetal, x: 1.765, y: y, z: 0.06 });
    parts.push({ geo: makeBoxGeometry(0.08, 0.02, 0.12), mat: m.gunmetal, x: 2.235, y: y, z: 0.06 });
  }
  // Stage 6 extra detail rungs
  if (opts.stage >= 6) {
    for (let y = 0.15; y <= 3.6; y += 0.3) {
      parts.push({ geo: makeBoxGeometry(0.44, 0.015, 0.02), mat: m.darkSteel, x: 2, y: y + 0.015, z: 0.17 });
    }
  }

  const g = buildMergedGroup(parts);
  const colliders: Box[] = [
    { min: [1.725, 0, 0.12], max: [1.805, 3.9, 0.2] },
    { min: [2.195, 0, 0.12], max: [2.275, 3.9, 0.2] },
    { min: [1.725, 0, 0.12], max: [2.275, 3.9, 0.2] },
  ];
  for (let y = 0; y <= 3.6; y += 0.3) {
    colliders.push({ min: [1.725, y - 0.015, 0.12], max: [2.275, y + 0.015, 0.2] });
  }
  return { group: g, colliders, lamps: [] };
}

/* ------------------------------------------------------------------ */
/*  stairs                                                                */
/* ------------------------------------------------------------------ */

export function stairs(
  m: LabMaterials,
  opts: { stage: number }
): Piece {
  const parts: GeoPart[] = [];
  const stepDepth = 4 / 12;
  const stringerW = 0.15;

  // Stringers (angled)
  const stringerGeo = makeBoxGeometry(stringerW, 0.15, 4);
  parts.push({ geo: stringerGeo, mat: m.gunmetal, x: 0.375, y: 1.5, z: 2, rx: Math.atan(3 / 4) });
  const stringerRightGeo = makeBoxGeometry(stringerW, 0.15, 4);
  parts.push({ geo: stringerRightGeo, mat: m.gunmetal, x: 3.625, y: 1.5, z: 2, rx: Math.atan(3 / 4) });

  // Steps
  for (let i = 0; i < 12; i++) {
    const y = i * 0.25;
    const z = i * stepDepth;
    parts.push({ geo: makeBoxGeometry(3.4, 0.25, stepDepth), mat: opts.stage >= 6 ? m.concrete : m.darkSteel, x: 2, y: y + 0.125, z: z + stepDepth / 2 });
  }

  // Handrails
  const railGeo = makeBoxGeometry(0.06, 0.06, 4);
  parts.push({ geo: railGeo, mat: m.gunmetal, x: 0.45, y: 3.2, z: 2, rx: Math.atan(3 / 4) });
  const railRightGeo = makeBoxGeometry(0.06, 0.06, 4);
  parts.push({ geo: railRightGeo, mat: m.gunmetal, x: 3.55, y: 3.2, z: 2, rx: Math.atan(3 / 4) });

  // Stage 6 handrail posts
  if (opts.stage >= 6) {
    for (let i = 0; i <= 12; i++) {
      const y = i * 0.25 + 0.1;
      const z = i * stepDepth;
      parts.push({ geo: makeBoxGeometry(0.05, 0.05, 0.1), mat: m.gunmetal, x: 0.4, y: y, z: z });
      parts.push({ geo: makeBoxGeometry(0.05, 0.05, 0.1), mat: m.gunmetal, x: 3.6, y: y, z: z });
    }
  }

  const g = buildMergedGroup(parts);
  const colliders: Box[] = [
    { min: [0.3, 0, 0], max: [0.45, 3, 4] },
    { min: [3.55, 0, 0], max: [3.7, 3, 4] },
  ];
  for (let i = 0; i < 12; i++) {
    const y = i * 0.25;
    const z = i * stepDepth;
    colliders.push({ min: [0.3, y, z], max: [3.7, y + 0.25, z + stepDepth] });
  }
  return { group: g, colliders, lamps: [] };
}

/* ------------------------------------------------------------------ */
/*  lifeSupport                                                           */
/* ------------------------------------------------------------------ */

export function lifeSupport(
  m: LabMaterials,
  opts: { stage: number }
): Piece {
  const xOff = 0.4;
  const zOff = 0;

  const parts: GeoPart[] = [
    // Main body
    { geo: makeBoxGeometry(1.1, 0.7, 1.7), mat: m.darkSteel, x: xOff + 0.55, y: 0.85, z: zOff + 0.35 },
    // Intake
    { geo: makeBoxGeometry(1.0, 0.25, 0.1), mat: m.gunmetal, x: xOff + 0.55, y: 0.325, z: zOff + 0.67 },
    // Window frame
    { geo: makeBoxGeometry(0.95, 0.45, 0.08), mat: m.gunmetal, x: xOff + 0.55, y: 1.025, z: zOff + 0.66 },
    // Glaze
    { geo: makeBoxGeometry(0.85, 0.35, 0.03), mat: m.glass, x: xOff + 0.55, y: 1.025, z: zOff + 0.64 },
    // Scrubber canisters
    { geo: makeBoxGeometry(0.22, 0.32, 0.2), mat: m.copper, x: xOff + 0.28, y: 1.025, z: zOff + 0.45 },
    { geo: makeBoxGeometry(0.22, 0.32, 0.2), mat: m.copper, x: xOff + 0.53, y: 1.025, z: zOff + 0.45 },
    { geo: makeBoxGeometry(0.22, 0.32, 0.2), mat: m.copper, x: xOff + 0.78, y: 1.025, z: zOff + 0.45 },
    // Fan housing
    { geo: makeBoxGeometry(0.8, 0.3, 0.2), mat: m.gunmetal, x: xOff + 0.55, y: 1.75, z: zOff + 0.35 },
    // Bottle (merged with gunmetal)
    { geo: makeBoxGeometry(0.15, 0.15, 0.6), mat: m.gunmetal, x: xOff + 0.18, y: 0.7, z: zOff + 0.35 },
    // Pressure dial frame
    { geo: makeBoxGeometry(0.2, 0.05, 0.15), mat: m.gunmetal, x: xOff + 0.95, y: 1.2, z: zOff + 0.66 },
    // Dial face
    { geo: makeBoxGeometry(0.14, 0.02, 0.08), mat: m.gunmetal, x: xOff + 0.98, y: 1.21, z: zOff + 0.67 },
    // Base plate
    { geo: makeBoxGeometry(1.2, 0.8, 0.08), mat: m.gunmetal, x: xOff + 0.55, y: 0.04, z: zOff + 0.35 },
    // Bolts (stage 6)
    ...(() => {
      const bolts: GeoPart[] = [];
      if (opts.stage >= 6) {
        for (let i = 0; i < 4; i++) {
          bolts.push({ geo: makeBoxGeometry(0.04, 0.04, 0.05), mat: m.gunmetal, x: xOff + 0.2 + (i % 2) * 0.8, y: 0.06, z: zOff + 0.15 + Math.floor(i / 2) * 0.4 });
        }
      }
      return bolts;
    })(),
    // Power/data cable
    { geo: makeBoxGeometry(0.02, 0.02, 0.6), mat: m.rubber, x: xOff + 1.0, y: 0.02, z: zOff + 0.7 },
    // Ribbed floor cover
    { geo: makeBoxGeometry(0.08, 0.05, 3.3), mat: m.gunmetal, x: xOff + 1.04, y: 0.025, z: zOff + 2.35 },
  ];

  const g = buildMergedGroup(parts);

  // Status light bar (lamp)
  const lampGeo = makeBoxGeometry(0.4, 0.02, 0.02);
  const lampMesh = new THREE.Mesh(
    lampGeo,
    new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 0.8 })
  );
  lampMesh.position.set(xOff + 0.55, 1.92, zOff + 0.72);
  g.add(lampMesh);

  const colliders: Box[] = [
    { min: [xOff, 0, zOff], max: [xOff + 1.1, 1.9, zOff + 0.7] },
    { min: [xOff, 0, zOff], max: [xOff + 1.2, 0.08, zOff + 0.8] },
    { min: [xOff + 1.0, 0, zOff + 0.7], max: [xOff + 1.08, 0.05, 4] },
  ];

  return { group: g, colliders, lamps: [lampMesh], parts: {} };
}
