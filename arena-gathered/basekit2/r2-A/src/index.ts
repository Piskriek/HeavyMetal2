import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

export interface BuildOptions {
  stage: number;
}

type Vec3 = readonly [number, number, number];
type KitMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
type GeometryBatch = Map<KitMaterial, THREE.BufferGeometry[]>;

const zeroRotation: Vec3 = [0, 0, 0];

export function createMaterials(): LabMaterials {
  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0x536677,
    metalness: 0.78,
    roughness: 0.48,
  });
  gunmetal.name = 'gunmetal';

  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x26394b,
    metalness: 0.72,
    roughness: 0.66,
  });
  darkSteel.name = 'darkSteel';

  const paint = new THREE.MeshStandardMaterial({
    color: 0x536c7d,
    metalness: 0.46,
    roughness: 0.58,
  });
  paint.name = 'paint';

  const copper = new THREE.MeshStandardMaterial({
    color: 0xa66c45,
    metalness: 0.78,
    roughness: 0.4,
  });
  copper.name = 'copper';

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x18232c,
    metalness: 0.06,
    roughness: 0.9,
  });
  rubber.name = 'rubber';

  const hazard = new THREE.MeshStandardMaterial({
    color: 0xe5a72c,
    metalness: 0.18,
    roughness: 0.72,
  });
  hazard.name = 'hazard';

  const concrete = new THREE.MeshStandardMaterial({
    color: 0x9ba6a7,
    metalness: 0.02,
    roughness: 0.94,
  });
  concrete.name = 'concrete';

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x80b9c2,
    metalness: 0.08,
    roughness: 0.18,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });
  glass.name = 'glass';

  return { gunmetal, darkSteel, paint, copper, rubber, hazard, concrete, glass };
}

function stageLevel(options: BuildOptions): number {
  const requested = Number.isFinite(options.stage) ? Math.trunc(options.stage) : 1;
  return Math.min(6, Math.max(1, requested));
}

function radialSegments(stage: number): number {
  return 6 + (stage - 1) * 2;
}

function createBatch(): GeometryBatch {
  return new Map<KitMaterial, THREE.BufferGeometry[]>();
}

function recordGeometry(
  batch: GeometryBatch,
  material: KitMaterial,
  geometry: THREE.BufferGeometry,
): void {
  const geometries = batch.get(material);
  if (geometries) {
    geometries.push(geometry);
  } else {
    batch.set(material, [geometry]);
  }
}

function addBox(
  batch: GeometryBatch,
  material: KitMaterial,
  size: Vec3,
  center: Vec3,
  rotation: Vec3 = zeroRotation,
): void {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  geometry.rotateX(rotation[0]);
  geometry.rotateY(rotation[1]);
  geometry.rotateZ(rotation[2]);
  geometry.translate(center[0], center[1], center[2]);
  recordGeometry(batch, material, geometry);
}

function addCylinderBetween(
  batch: GeometryBatch,
  material: KitMaterial,
  start: Vec3,
  end: Vec3,
  radius: number,
  segments: number,
): void {
  const startPoint = new THREE.Vector3(start[0], start[1], start[2]);
  const endPoint = new THREE.Vector3(end[0], end[1], end[2]);
  const direction = endPoint.clone().sub(startPoint);
  const length = direction.length();
  if (length <= 0) return;

  const center = startPoint.clone().add(endPoint).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  const matrix = new THREE.Matrix4().compose(
    center,
    quaternion,
    new THREE.Vector3(1, 1, 1),
  );
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1, false);
  geometry.applyMatrix4(matrix);
  recordGeometry(batch, material, geometry);
}

function mergeBatch(group: THREE.Group, batch: GeometryBatch): void {
  for (const [material, geometries] of batch) {
    const first = geometries[0];
    if (!first) continue;

    let merged: THREE.BufferGeometry;
    if (geometries.length === 1) {
      merged = first;
    } else {
      const result = mergeGeometries(geometries, false);
      for (const geometry of geometries) geometry.dispose();
      if (!result) throw new Error(`Unable to merge ${material.name} geometry`);
      merged = result;
    }

    const flat = merged.index ? merged.toNonIndexed() : merged;
    if (flat !== merged) merged.dispose();
    flat.computeVertexNormals();
    flat.computeBoundingBox();

    const mesh = new THREE.Mesh(flat, material);
    mesh.name = `${material.name}-merged`;
    group.add(mesh);
  }
}

function createPiece(name: string): Piece {
  const group = new THREE.Group();
  group.name = name;
  return { group, colliders: [], lamps: [] };
}

function collider(min: Vec3, max: Vec3): Box {
  return {
    min: [min[0], min[1], min[2]],
    max: [max[0], max[1], max[2]],
  };
}

function addWallBolt(
  batch: GeometryBatch,
  material: KitMaterial,
  x: number,
  y: number,
  faceZ: number,
  stage: number,
  radius = 0.018,
): void {
  addCylinderBetween(
    batch,
    material,
    [x, y, faceZ - 0.035],
    [x, y, faceZ + 0.008],
    radius,
    Math.min(12, radialSegments(stage)),
  );
}

function addFloorBolt(
  batch: GeometryBatch,
  material: KitMaterial,
  x: number,
  z: number,
  topY: number,
  stage: number,
): void {
  addCylinderBetween(
    batch,
    material,
    [x, topY - 0.025, z],
    [x, topY + 0.012, z],
    0.02,
    Math.min(12, radialSegments(stage)),
  );
}

function addHazardRun(
  batch: GeometryBatch,
  materials: LabMaterials,
  stage: number,
  xMin: number,
  xMax: number,
  y = 0.065,
): void {
  addBox(batch, materials.hazard, [xMax - xMin, 0.075, 0.035], [(xMin + xMax) / 2, y, 0.135]);
  if (stage < 5) return;

  for (let x = xMin + 0.055; x < xMax - 0.045; x += 0.22) {
    addBox(
      batch,
      materials.darkSteel,
      [0.022, 0.065, 0.025],
      [x, y, 0.15],
      [0, 0, 0.45],
    );
  }
}

function addStatusLamp(
  piece: Piece,
  name: string,
  size: Vec3,
  center: Vec3,
  color: number,
): void {
  const indexed = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    metalness: 0.08,
    roughness: 0.28,
  });
  material.name = `${name}-emitter`;

  const lamp: THREE.Mesh = new THREE.Mesh(geometry, material);
  lamp.name = name;
  lamp.position.set(center[0], center[1], center[2]);
  piece.group.add(lamp);
  piece.lamps.push(lamp);
}

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const level = Number.isFinite(glow) ? Math.min(1, Math.max(0, glow)) : 0;
  const materials = Array.isArray(lamp.material) ? lamp.material : [lamp.material];
  for (const material of materials) {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.emissiveIntensity = level;
    }
  }
}

export function triangles(piece: Piece): number {
  let count = 0;
  piece.group.traverse((object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute('position');
    const index = object.geometry.getIndex();
    count += (index ? index.count : position.count) / 3;
  });
  return count;
}

export function halfWall(materials: LabMaterials, options: BuildOptions): Piece {
  const stage = stageLevel(options);
  const piece = createPiece('halfWall');
  const batch = createBatch();

  addBox(batch, materials.darkSteel, [1.82, 1.29, 0.19], [1.05, 0.755, 0]);
  addBox(batch, materials.darkSteel, [1.82, 1.29, 0.19], [2.95, 0.755, 0]);

  for (const x of [0.07, 2, 3.93]) {
    addBox(batch, materials.gunmetal, [0.14, 1.44, 0.25], [x, 0.72, 0.003]);
  }
  addBox(batch, materials.gunmetal, [4, 0.12, 0.25], [2, 0.06, 0]);
  addBox(batch, materials.paint, [4, 0.08, 0.25], [2, 0.75, 0]);
  addBox(batch, materials.gunmetal, [4, 0.13, 0.25], [2, 1.435, 0]);
  addHazardRun(batch, materials, stage, 0.08, 3.92);

  if (stage >= 4) {
    for (const x of [1, 3]) {
      addBox(batch, materials.paint, [0.035, 1.14, 0.035], [x, 0.76, 0.105]);
    }
  }

  if (stage >= 3) {
    for (const x of [0.07, 2, 3.93]) {
      for (const y of [0.22, 0.72, 1.25]) {
        addWallBolt(batch, materials.paint, x, y, 0.125, stage);
      }
    }
  }

  piece.colliders.push(collider([0, 0, -0.125], [4, 1.5, 0.125]));
  mergeBatch(piece.group, batch);
  return piece;
}

export function windowWall(materials: LabMaterials, options: BuildOptions): Piece {
  const stage = stageLevel(options);
  const piece = createPiece('windowWall');
  const batch = createBatch();

  addBox(batch, materials.darkSteel, [4, 1, 0.2], [2, 0.5, 0]);
  addBox(batch, materials.darkSteel, [4, 0.8, 0.2], [2, 2.6, 0]);
  addBox(batch, materials.darkSteel, [0.8, 1.2, 0.2], [0.4, 1.6, 0]);
  addBox(batch, materials.darkSteel, [0.8, 1.2, 0.2], [3.6, 1.6, 0]);

  for (const x of [0.07, 3.93]) {
    addBox(batch, materials.gunmetal, [0.14, 3, 0.25], [x, 1.5, 0.003]);
  }
  addBox(batch, materials.gunmetal, [4, 0.12, 0.25], [2, 0.06, 0]);
  addBox(batch, materials.gunmetal, [4, 0.12, 0.25], [2, 2.94, 0]);

  addBox(batch, materials.gunmetal, [2.4, 0.08, 0.08], [2, 1.04, 0.12]);
  addBox(batch, materials.gunmetal, [2.4, 0.08, 0.08], [2, 2.16, 0.12]);
  addBox(batch, materials.gunmetal, [0.08, 1.04, 0.08], [0.84, 1.6, 0.12]);
  addBox(batch, materials.gunmetal, [0.08, 1.04, 0.08], [3.16, 1.6, 0.12]);
  addBox(batch, materials.glass, [2.3, 1.1, 0.018], [2, 1.6, 0.115]);

  addHazardRun(batch, materials, stage, 0.08, 3.92);

  if (stage >= 4) {
    addBox(batch, materials.paint, [0.04, 1.12, 0.06], [2, 1.6, 0.135]);
  }
  if (stage >= 3) {
    for (const x of [0.07, 0.84, 3.16, 3.93]) {
      for (const y of [1.07, 2.13]) {
        addWallBolt(batch, materials.paint, x, y, 0.14, stage, 0.015);
      }
    }
  }

  piece.colliders.push(
    collider([0, 0, -0.1], [0.8, 3, 0.1]),
    collider([3.2, 0, -0.1], [4, 3, 0.1]),
    collider([0.8, 0, -0.1], [3.2, 1, 0.1]),
    collider([0.8, 2.2, -0.1], [3.2, 3, 0.1]),
  );
  mergeBatch(piece.group, batch);
  return piece;
}

function addDoorframeGeometry(
  batch: GeometryBatch,
  materials: LabMaterials,
  stage: number,
): void {
  addBox(batch, materials.darkSteel, [1.2, 2.3, 0.2], [0.6, 1.15, 0]);
  addBox(batch, materials.darkSteel, [1.2, 2.3, 0.2], [3.4, 1.15, 0]);
  addBox(batch, materials.darkSteel, [4, 0.7, 0.2], [2, 2.65, 0]);

  for (const x of [0.07, 3.93]) {
    addBox(batch, materials.gunmetal, [0.14, 3, 0.25], [x, 1.5, 0.003]);
  }
  addBox(batch, materials.gunmetal, [0.1, 2.36, 0.25], [1.25, 1.18, 0]);
  addBox(batch, materials.gunmetal, [0.1, 2.36, 0.25], [2.75, 1.18, 0]);
  addBox(batch, materials.gunmetal, [1.2, 0.12, 0.25], [0.6, 0.06, 0]);
  addBox(batch, materials.gunmetal, [1.2, 0.12, 0.25], [3.4, 0.06, 0]);
  addBox(batch, materials.gunmetal, [4, 0.12, 0.25], [2, 2.94, -0.003]);
  addBox(batch, materials.paint, [0.035, 2.3, 0.035], [1.25, 1.15, 0.14]);
  addBox(batch, materials.paint, [0.035, 2.3, 0.035], [2.75, 1.15, 0.14]);
  addBox(batch, materials.paint, [1.4, 0.1, 0.05], [2, 2.35, 0.13]);

  addHazardRun(batch, materials, stage, 0.08, 1.2);
  addHazardRun(batch, materials, stage, 2.8, 3.92);

  if (stage >= 3) {
    for (const x of [0.07, 1.25, 2.75, 3.93]) {
      for (const y of [0.22, 2.03]) {
        addWallBolt(batch, materials.paint, x, y, 0.14, stage, 0.015);
      }
    }
  }
}

function doorframeColliders(): Box[] {
  return [
    collider([0, 0, -0.125], [1.3, 3, 0.125]),
    collider([2.7, 0, -0.125], [4, 3, 0.125]),
    collider([0, 2.3, -0.125], [4, 3, 0.125]),
  ];
}

export function doorframe(materials: LabMaterials, options: BuildOptions): Piece {
  const stage = stageLevel(options);
  const piece = createPiece('doorframe');
  const batch = createBatch();
  addDoorframeGeometry(batch, materials, stage);
  piece.colliders.push(...doorframeColliders());
  mergeBatch(piece.group, batch);
  return piece;
}

export function door(materials: LabMaterials, options: BuildOptions): Piece {
  const stage = stageLevel(options);
  const piece = createPiece('door');
  const frameBatch = createBatch();
  addDoorframeGeometry(frameBatch, materials, stage);

  addBox(frameBatch, materials.gunmetal, [0.32, 0.18, 0.2], [2, 2.56, 0.025]);
  mergeBatch(piece.group, frameBatch);

  const leaf = new THREE.Group();
  leaf.name = 'door-leaf';
  leaf.position.set(1.3, 0, 0);
  const leafBatch = createBatch();
  addBox(leafBatch, materials.darkSteel, [1.36, 2.2, 0.07], [0.7, 1.15, 0.045]);
  addBox(leafBatch, materials.paint, [0.045, 2.16, 0.035], [0.085, 1.15, 0.09]);
  addBox(leafBatch, materials.paint, [0.045, 2.16, 0.035], [1.315, 1.15, 0.09]);
  addBox(leafBatch, materials.paint, [1.32, 0.035, 0.035], [0.7, 0.085, 0.09]);
  addBox(leafBatch, materials.paint, [1.32, 0.035, 0.035], [0.7, 2.215, 0.09]);
  addBox(leafBatch, materials.gunmetal, [0.12, 0.24, 0.055], [1.17, 1.08, 0.105]);
  addBox(leafBatch, materials.gunmetal, [0.13, 0.035, 0.055], [1.12, 1.08, 0.145]);

  for (const y of [0.35, 1.15, 1.95]) {
    addBox(leafBatch, materials.copper, [0.055, 0.15, 0.04], [0.02, y, 0.05]);
    addCylinderBetween(
      leafBatch,
      materials.gunmetal,
      [0, y - 0.09, 0.05],
      [0, y + 0.09, 0.05],
      0.026,
      radialSegments(stage),
    );
  }

  if (stage >= 4) {
    for (const x of [0.11, 1.29]) {
      for (const y of [0.18, 0.72, 1.58, 2.1]) {
        addWallBolt(leafBatch, materials.gunmetal, x, y, 0.105, stage, 0.014);
      }
    }
  }

  mergeBatch(leaf, leafBatch);
  piece.group.add(leaf);
  piece.parts = { leaf };
  piece.colliders.push(...doorframeColliders());
  addStatusLamp(piece, 'door-status-lamp', [0.16, 0.065, 0.035], [2, 2.56, 0.14], 0x35d7b2);

  return piece;
}

export function railing(materials: LabMaterials, options: BuildOptions): Piece {
  const stage = stageLevel(options);
  const piece = createPiece('railing');
  const batch = createBatch();

  addBox(batch, materials.gunmetal, [4, 0.14, 0.25], [2, 0.07, 0]);
  addBox(batch, materials.gunmetal, [4, 0.11, 0.25], [2, 1.045, 0]);
  addBox(batch, materials.paint, [4, 0.075, 0.25], [2, 0.57, 0]);
  const posts = [0.05, 1, 2, 3, 3.95];
  for (const x of posts) {
    addBox(batch, materials.gunmetal, [0.1, 1.02, 0.25], [x, 0.59, 0.003]);
  }
  addHazardRun(batch, materials, stage, 0.1, 3.9, 0.07);

  if (stage >= 4) {
    for (const x of posts) {
      addBox(batch, materials.paint, [0.1, 0.045, 0.27], [x, 0.16, 0]);
      addWallBolt(batch, materials.paint, x, 0.21, 0.14, stage, 0.015);
      addWallBolt(batch, materials.paint, x, 0.94, 0.14, stage, 0.015);
    }
  }

  piece.colliders.push(collider([0, 0, -0.125], [4, 1.1, 0.125]));
  mergeBatch(piece.group, batch);
  return piece;
}

export function ladder(materials: LabMaterials, options: BuildOptions): Piece {
  const stage = stageLevel(options);
  const piece = createPiece('ladder');
  const batch = createBatch();
  const railXs = [1.725, 2.275];

  for (const x of railXs) {
    addBox(batch, materials.gunmetal, [0.075, 3.9, 0.08], [x, 1.95, 0.16]);
  }

  for (let index = 0; index <= 12; index += 1) {
    const y = 0.15 + index * 0.3;
    addBox(batch, materials.paint, [0.58, 0.045, 0.09], [2, y, 0.16]);
    if (stage >= 5) {
      addBox(batch, materials.rubber, [0.49, 0.018, 0.055], [2, y + 0.026, 0.16]);
    }
  }

  for (const y of [0.32, 1.95, 3.58]) {
    for (const x of railXs) {
      addBox(batch, materials.gunmetal, [0.09, 0.08, 0.198], [x, y, 0.099]);
      if (stage >= 4) {
        addBox(batch, materials.paint, [0.14, 0.15, 0.035], [x, y, 0.012]);
        addWallBolt(batch, materials.paint, x, y, 0.03, stage, 0.012);
      }
    }
  }

  piece.colliders.push(collider([1.67, 0, 0], [2.33, 3.9, 0.22]));
  mergeBatch(piece.group, batch);
  return piece;
}

export function stairs(materials: LabMaterials, options: BuildOptions): Piece {
  const stage = stageLevel(options);
  const piece = createPiece('stairs');
  const batch = createBatch();
  const run = 4 / 12;
  const rise = 0.25;

  for (let index = 0; index < 12; index += 1) {
    const startZ = index * run;
    const height = (index + 1) * rise;
    addBox(
      batch,
      materials.darkSteel,
      [3.4, 0.08, run],
      [2, height - 0.04, startZ + run / 2],
    );
  }

  const stringerRotation: Vec3 = [-Math.atan(0.75), 0, 0];
  for (const x of [0.5, 3.5]) {
    addBox(batch, materials.gunmetal, [0.16, 0.18, 4.9], [x, 1.55, 2], stringerRotation);
  }

  const handrailXs = [0.42, 3.58];
  for (const x of handrailXs) {
    addCylinderBetween(
      batch,
      materials.gunmetal,
      [x, 1.03, 0.04],
      [x, 3.97, 3.96],
      0.045,
      radialSegments(stage),
    );

    for (const z of [0.2, 1.1, 2, 2.9, 3.8]) {
      const stepIndex = Math.min(11, Math.floor(z / run));
      const treadTop = (stepIndex + 1) * rise;
      const railY = 1.03 + 0.75 * z;
      const height = railY - treadTop + 0.02;
      addBox(
        batch,
        materials.paint,
        [0.06, height, 0.07],
        [x, (treadTop + railY) / 2, z],
      );
      if (stage >= 4) {
        addBox(batch, materials.gunmetal, [0.12, 0.025, 0.13], [x, treadTop + 0.0125, z]);
      }
    }
  }

  for (let index = 0; index < 12; index += 1) {
    const startZ = index * run;
    const endZ = (index + 1) * run;
    piece.colliders.push(
      collider([0.3, 0, startZ], [3.7, (index + 1) * rise, endZ]),
    );
  }

  mergeBatch(piece.group, batch);
  return piece;
}

export function lifeSupport(materials: LabMaterials, options: BuildOptions): Piece {
  const stage = stageLevel(options);
  const piece = createPiece('lifeSupport');
  const batch = createBatch();
  const segments = radialSegments(stage);

  addBox(batch, materials.gunmetal, [1.1, 0.08, 0.7], [2, 0.04, 2]);
  addBox(batch, materials.darkSteel, [0.96, 0.08, 0.7], [1.93, 1.675, 2]);
  addBox(batch, materials.darkSteel, [0.96, 0.08, 0.7], [1.93, 0.115, 2]);
  addBox(batch, materials.darkSteel, [0.96, 1.64, 0.08], [1.93, 0.895, 1.69]);
  addBox(batch, materials.darkSteel, [0.14, 1.64, 0.7], [1.52, 0.895, 2]);
  addBox(batch, materials.darkSteel, [0.14, 1.64, 0.7], [2.34, 0.895, 2]);

  addBox(batch, materials.darkSteel, [0.82, 0.34, 0.035], [1.93, 0.42, 2.365]);
  const louvreCount = stage === 1 ? 2 : stage >= 5 ? 7 : stage >= 3 ? 5 : 3;
  for (let index = 0; index < louvreCount; index += 1) {
    const spacing = 0.26 / Math.max(1, louvreCount - 1);
    const y = 0.29 + index * spacing;
    addBox(batch, materials.gunmetal, [0.7, 0.035, 0.045], [1.93, y, 2.372]);
  }
  if (stage >= 4) {
    addBox(batch, materials.gunmetal, [0.82, 0.045, 0.07], [1.93, 0.245, 2.37]);
    addBox(batch, materials.gunmetal, [0.82, 0.045, 0.07], [1.93, 0.595, 2.37]);
    addBox(batch, materials.gunmetal, [0.055, 0.35, 0.07], [1.55, 0.42, 2.37]);
    addBox(batch, materials.gunmetal, [0.055, 0.35, 0.07], [2.31, 0.42, 2.37]);
  }

  addBox(batch, materials.gunmetal, [0.84, 0.06, 0.07], [1.93, 0.73, 2.37]);
  addBox(batch, materials.gunmetal, [0.84, 0.06, 0.07], [1.93, 1.41, 2.37]);
  addBox(batch, materials.gunmetal, [0.07, 0.62, 0.07], [1.545, 1.07, 2.37]);
  addBox(batch, materials.gunmetal, [0.07, 0.62, 0.07], [2.315, 1.07, 2.37]);
  addBox(batch, materials.glass, [0.75, 0.64, 0.02], [1.93, 1.07, 2.36]);

  addBox(batch, materials.gunmetal, [0.7, 0.04, 0.08], [1.93, 0.81, 2.29]);
  if (stage >= 4) {
    addBox(batch, materials.gunmetal, [0.7, 0.04, 0.08], [1.93, 1.33, 2.29]);
  }
  for (const x of [1.71, 1.93, 2.15]) {
    addCylinderBetween(
      batch,
      materials.gunmetal,
      [x, 0.82, 2.29],
      [x, 1.32, 2.29],
      0.065,
      stage === 1 ? 4 : segments,
    );
  }

  addCylinderBetween(
    batch,
    materials.copper,
    [2.46, 0.52, 2],
    [2.46, 1.5, 2],
    0.05,
    segments,
  );
  addBox(batch, materials.copper, [0.12, 0.045, 0.1], [2.41, 0.68, 2]);
  if (stage >= 3) {
    addBox(batch, materials.copper, [0.12, 0.045, 0.1], [2.41, 1.3, 2]);
  }

  addBox(batch, materials.darkSteel, [0.5, 0.13, 0.42], [1.93, 1.775, 2]);
  addCylinderBetween(batch, materials.gunmetal, [1.93, 1.84, 2], [1.93, 1.9, 2], 0.14, segments);
  if (stage >= 4) {
    for (const angle of [0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4]) {
      addBox(
        batch,
        materials.gunmetal,
        [0.23, 0.018, 0.025],
        [1.93, 1.89, 2],
        [0, angle, 0],
      );
    }
  }

  addCylinderBetween(
    batch,
    materials.gunmetal,
    [1.52, 1.55, 2.3],
    [1.52, 1.55, 2.37],
    0.09,
    segments,
  );
  if (stage >= 3) {
    addCylinderBetween(
      batch,
      materials.gunmetal,
      [1.52, 1.55, 2.355],
      [1.52, 1.55, 2.39],
      0.07,
      segments,
    );
  }
  if (stage >= 5) {
    addBox(batch, materials.gunmetal, [0.014, 0.095, 0.018], [1.52, 1.55, 2.397], [0, 0, 0.28]);
    for (const x of [1.48, 1.56]) {
      addBox(batch, materials.gunmetal, [0.012, 0.018, 0.018], [x, 1.55, 2.397]);
    }
  }

  addBox(batch, materials.gunmetal, [0.24, 0.14, 0.09], [2.33, 1.55, 2.35]);
  addBox(batch, materials.rubber, [0.48, 0.05, 1.66], [2.24, 0.025, 3.17]);

  for (const x of [2.16, 2.32]) {
    if (stage >= 4) {
      addCylinderBetween(batch, materials.rubber, [x, 0.22, 1.72], [x, 0.062, 1.72], 0.014, segments);
      addCylinderBetween(batch, materials.rubber, [x, 0.062, 1.72], [x, 0.062, 2.52], 0.014, segments);
    } else {
      addCylinderBetween(
        batch,
        materials.rubber,
        [x, 0.17, 1.72],
        [x, 0.04, 2.5],
        0.014,
        stage === 1 ? 4 : segments,
      );
    }
  }

  if (stage >= 4) {
    for (let z = 2.43; z < 3.98; z += 0.12) {
      addBox(batch, materials.darkSteel, [0.48, 0.035, 0.035], [2.24, 0.0675, z]);
    }
    for (const x of [1.5, 2.5]) {
      for (const z of [1.7, 2.3]) {
        addFloorBolt(batch, materials.gunmetal, x, z, 0.08, stage);
      }
    }
  }

  piece.colliders.push(
    collider([1.42, 0, 1.62], [2.58, 1.9, 2.38]),
    collider([1.98, 0, 2.3], [2.5, 0.1, 4]),
  );
  mergeBatch(piece.group, batch);
  addStatusLamp(piece, 'life-support-status-lamp', [0.2, 0.06, 0.025], [2.33, 1.55, 2.405], 0x35d7b2);
  return piece;
}
