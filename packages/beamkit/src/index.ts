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

export type BeamMode = 'extract' | 'apply' | 'sculpt';

export interface BeamTool {
  readonly group: THREE.Group;
  readonly sockets: Readonly<Record<'grip' | 'foregrip' | 'shoulder' | 'muzzle' | 'cartridge' | 'screen', THREE.Vector3>>;
  readonly lamps: readonly THREE.Mesh[];
  setMode(mode: BeamMode): void;
  setCartridge(colour: string | null): void;
  setCharge(level: number): void;
  setFiring(level: number): void;
  readonly triangles: number;
}

export const BUDGET = { stage1: 800, full: 6000 } as const;

type V3 = readonly [number, number, number];
type BoxSpec = { readonly size: V3; readonly position: V3; readonly rotation?: V3 };

const v3 = (value: V3): THREE.Vector3 => new THREE.Vector3(value[0], value[1], value[2]);
const clamp01 = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const fract = (value: number): number => value - Math.floor(value);

export function createMaterials(): LabMaterials {
  return {
    gunmetal: new THREE.MeshStandardMaterial({ color: '#35424a', metalness: 0.82, roughness: 0.32 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: '#131c20', metalness: 0.84, roughness: 0.29 }),
    paint: new THREE.MeshStandardMaterial({ color: '#637265', metalness: 0.48, roughness: 0.42 }),
    copper: new THREE.MeshStandardMaterial({ color: '#b96e43', metalness: 0.86, roughness: 0.25 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#171d1c', metalness: 0.08, roughness: 0.82 }),
    hazard: new THREE.MeshStandardMaterial({ color: '#e4a536', metalness: 0.48, roughness: 0.38 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#55747b',
      metalness: 0.18,
      roughness: 0.16,
      transparent: true,
      opacity: 0.27,
      depthWrite: false,
    }),
    concrete: new THREE.MeshStandardMaterial({ color: '#66645b', metalness: 0.02, roughness: 0.96 }),
  };
}

function chamferedBox(width: number, height: number, depth: number, corner: number, bevel: number, bevelSegments: number): THREE.BufferGeometry {
  const c = Math.min(corner, width * 0.2, height * 0.2);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + c, -height / 2);
  shape.lineTo(width / 2 - c, -height / 2);
  shape.lineTo(width / 2, -height / 2 + c);
  shape.lineTo(width / 2, height / 2 - c);
  shape.lineTo(width / 2 - c, height / 2);
  shape.lineTo(-width / 2 + c, height / 2);
  shape.lineTo(-width / 2, height / 2 - c);
  shape.lineTo(-width / 2, -height / 2 + c);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSegments,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function flatGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  result.computeVertexNormals();
  return result;
}

function triangleCount(root: THREE.Object3D): number {
  let total = 0;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const index = mesh.geometry.index;
    total += index ? index.count / 3 : mesh.geometry.getAttribute('position').count / 3;
  });
  return total;
}

function textureColour(colour: string | null): readonly [number, number, number] {
  if (colour === null) return [45, 74, 81];
  const hex = new THREE.Color(colour).getHex(THREE.SRGBColorSpace);
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function makeScreenData(mode: BeamMode, cartridgeColour: string | null): Uint8Array {
  const width = 64;
  const height = 40;
  const data = new Uint8Array(width * height * 4);
  const background: readonly [number, number, number] = [5, 12, 16];
  const ink: readonly [number, number, number] = [112, 229, 239];
  const dim: readonly [number, number, number] = [37, 86, 91];

  const pixel = (x: number, y: number, colour: readonly [number, number, number]): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    data[offset] = colour[0];
    data[offset + 1] = colour[1];
    data[offset + 2] = colour[2];
    data[offset + 3] = 255;
  };
  const line = (x0: number, y0: number, x1: number, y1: number, colour: readonly [number, number, number]): void => {
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      pixel(x, y, colour);
      if (x === x1 && y === y1) break;
      const twice = error * 2;
      if (twice >= dy) {
        error += dy;
        x += sx;
      }
      if (twice <= dx) {
        error += dx;
        y += sy;
      }
    }
  };
  const rect = (x: number, y: number, w: number, h: number, colour: readonly [number, number, number], fill: boolean): void => {
    if (fill) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixel(xx, yy, colour);
      return;
    }
    line(x, y, x + w - 1, y, colour);
    line(x, y + h - 1, x + w - 1, y + h - 1, colour);
    line(x, y, x, y + h - 1, colour);
    line(x + w - 1, y, x + w - 1, y + h - 1, colour);
  };

  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixel(x, y, background);
  rect(1, 1, width - 2, height - 2, dim, false);
  rect(4, 4, 56, 29, [11, 24, 28], true);
  rect(4, 4, 56, 29, dim, false);
  rect(5, 35, 54, 3, [8, 18, 21], true);

  if (mode === 'extract') {
    const rock: readonly [number, number][] = [[13, 16], [17, 10], [23, 9], [27, 14], [25, 21], [19, 25], [13, 21]];
    for (let i = 0; i < rock.length; i++) {
      const a = rock[i];
      const b = rock[(i + 1) % rock.length];
      if (a && b) line(a[0], a[1], b[0], b[1], ink);
    }
    line(19, 13, 19, 19, ink);
    line(19, 19, 16, 16, ink);
    line(19, 19, 22, 16, ink);
    line(32, 11, 42, 11, dim);
    line(32, 17, 43, 17, ink);
    line(39, 14, 43, 17, ink);
    line(39, 20, 43, 17, ink);
    line(31, 24, 43, 24, dim);
  } else if (mode === 'apply') {
    line(14, 10, 14, 17, ink);
    line(20, 8, 20, 18, ink);
    line(26, 11, 26, 17, ink);
    line(11, 19, 29, 19, ink);
    line(13, 22, 27, 22, dim);
    rect(34, 10, 12, 12, dim, false);
    rect(37, 13, 6, 6, ink, true);
    line(40, 7, 40, 10, ink);
    line(40, 22, 40, 26, ink);
    line(31, 16, 34, 16, ink);
    line(46, 16, 50, 16, ink);
  } else {
    for (let radius = 3; radius <= 11; radius += 4) {
      for (let angle = 0; angle < 360; angle += 6) {
        const x = Math.round(21 + Math.cos(angle * Math.PI / 180) * radius);
        const y = Math.round(17 + Math.sin(angle * Math.PI / 180) * radius * 0.68);
        pixel(x, y, ink);
      }
    }
    line(35, 10, 47, 10, dim);
    line(41, 7, 41, 22, ink);
    line(35, 17, 47, 17, ink);
    line(38, 23, 44, 23, dim);
  }

  const cartridge = textureColour(cartridgeColour);
  rect(6, 36, 20, 1, cartridge, true);
  rect(30, 36, 28, 1, dim, true);
  for (let i = 0; i < 4; i++) rect(50 + i * 2, 8, 1, 2, i < 3 ? ink : dim, true);
  return data;
}

function makeScreenTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(makeScreenData('extract', '#f3b848'), 64, 40, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function extractionBeam(m: LabMaterials, o?: { readonly stage?: number }): BeamTool {
  const full = (o?.stage ?? 1) >= 2;
  const radial = full ? 12 : 4;
  const group = new THREE.Group();
  group.name = 'hm-beamkit-extraction-rifle';
  const lamps: THREE.Mesh[] = [];
  const rootMaterial = new THREE.MeshStandardMaterial({ color: '#b4c4c6', emissive: '#47dfff', emissiveIntensity: 0.72, metalness: 0.24, roughness: 0.18 });
  const chargeMaterials: THREE.MeshStandardMaterial[] = [];
  const stripeMaterial = new THREE.MeshStandardMaterial({ color: '#f3b848', emissive: '#bf6a16', emissiveIntensity: 0.26, metalness: 0.54, roughness: 0.28 });
  const screenTexture = makeScreenTexture();
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: '#86eaf0',
    emissive: '#b2f7ff',
    emissiveIntensity: 1.25,
    emissiveMap: screenTexture,
    roughness: 0.28,
    metalness: 0.1,
  });

  const addMesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name: string, position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], lamp = false): THREE.Mesh => {
    const prepared = full || lamp ? geometry : flatGeometry(geometry);
    const mesh = new THREE.Mesh(prepared, material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    parent.add(mesh);
    if (lamp) lamps.push(mesh);
    return mesh;
  };
  const addBox = (name: string, material: THREE.Material, size: V3, position: V3, rotation: V3 = [0, 0, 0]): THREE.Mesh =>
    addMesh(group, new THREE.BoxGeometry(size[0], size[1], size[2]), material, name, position, rotation);
  const addChamfered = (name: string, material: THREE.Material, size: V3, position: V3, corner: number, bevel: number, rotation: V3 = [0, 0, 0]): THREE.Mesh => {
    const geometry = full || name === 'receiver-housing'
      ? chamferedBox(size[0], size[1], size[2], corner, bevel, full ? 2 : 1)
      : new THREE.BoxGeometry(size[0], size[1], size[2]);
    return addMesh(group, geometry, material, name, position, rotation);
  };
  const addCylinder = (name: string, material: THREE.Material, radius: number, length: number, position: V3, segments = radial, rotation: V3 = [Math.PI / 2, 0, 0]): THREE.Mesh =>
    addMesh(group, new THREE.CylinderGeometry(radius, radius, length, segments, 1), material, name, position, rotation);
  const addXcylinder = (name: string, material: THREE.Material, radius: number, length: number, position: V3, segments = radial): THREE.Mesh =>
    addMesh(group, new THREE.CylinderGeometry(radius, radius, length, segments, 1), material, name, position, [0, 0, Math.PI / 2]);
  const addTorus = (name: string, material: THREE.Material, radius: number, tube: number, position: V3, tubularSegments: number, radialSegments: number): THREE.Mesh =>
    addMesh(group, new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments), material, name, position);
  const addRod = (name: string, material: THREE.Material, start: V3, end: V3, radius: number, segments = radial): THREE.Mesh => {
    const a = v3(start);
    const b = v3(end);
    const delta = b.clone().sub(a);
    const mesh = addMesh(group, new THREE.CylinderGeometry(radius, radius, delta.length(), segments, 1), material, name, a.clone().add(b).multiplyScalar(0.5).toArray() as V3);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  };
  const addTube = (name: string, material: THREE.Material, points: readonly V3[], radius: number, tubularSegments: number, radialSegments: number): THREE.Mesh => {
    const curve = new THREE.CatmullRomCurve3(points.map(v3));
    return addMesh(group, new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false), material, name);
  };
  const addBoxBatch = (name: string, material: THREE.Material, specs: readonly BoxSpec[]): THREE.Mesh | null => {
    if (specs.length === 0) return null;
    const geometries = specs.map((spec) => {
      const geometry = new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
      const rotation = new THREE.Euler(...(spec.rotation ?? [0, 0, 0]));
      const matrix = new THREE.Matrix4().compose(v3(spec.position), new THREE.Quaternion().setFromEuler(rotation), new THREE.Vector3(1, 1, 1));
      geometry.applyMatrix4(matrix);
      return geometry;
    });
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) return null;
    return addMesh(group, merged, material, name);
  };

  // The receiver's clipped shoulders and shallow bevel catch the key light like a machined casting.
  addChamfered('receiver-housing', m.gunmetal, [0.126, 0.116, 0.328], [0, 0.026, -0.075], 0.018, 0.0035);
  addChamfered('receiver-top-plate', m.paint, [0.091, 0.011, 0.204], [0, 0.087, -0.071], 0.011, 0.0015);
  if (full) addBox('receiver-undertray', m.darkSteel, [0.11, 0.014, 0.272], [0, -0.035, -0.074]);

  addChamfered('left-side-armor', m.paint, [0.006, 0.087, 0.25], [-0.066, 0.026, -0.079], 0.012, 0.0015);
  addChamfered('right-side-armor', m.darkSteel, [0.005, 0.087, 0.25], [0.066, 0.026, -0.079], 0.012, 0.001);
  if (full) {
    addBox('left-side-inset', m.darkSteel, [0.002, 0.048, 0.136], [-0.070, 0.022, -0.13]);
    addBox('right-rear-inset', m.gunmetal, [0.002, 0.054, 0.116], [0.069, 0.026, -0.148]);
  }

  // A short Picatinny rail is part of the receiver, not a decorative top fin.
  addChamfered('carry-rail-bed', m.darkSteel, [0.047, 0.014, 0.267], [0, 0.105, -0.075], 0.006, 0.001);
  const railSpecs: BoxSpec[] = [];
  const railCount = full ? 11 : 2;
  for (let i = 0; i < railCount; i++) {
    const z = -0.193 + i * (0.229 / Math.max(1, railCount - 1));
    railSpecs.push({ size: [0.052, 0.009, full ? 0.008 : 0.012], position: [0, 0.115, z] });
  }
  addBoxBatch('carry-rail-lugs', m.gunmetal, railSpecs);
  if (full) {
    addBoxBatch('rail-side-notches', m.darkSteel, [
      { size: [0.003, 0.005, 0.17], position: [0.025, 0.103, -0.064] },
      { size: [0.003, 0.005, 0.17], position: [-0.025, 0.103, -0.064] },
    ]);
  }

  // The barrel steps down from the receiver, then opens back up inside its ribbed muzzle cage.
  addCylinder('barrel-root-collar', m.gunmetal, 0.041, 0.076, [0, 0.026, 0.118], full ? 12 : 4);
  addCylinder('barrel-core', m.darkSteel, 0.027, 0.294, [0, 0.026, 0.265], full ? 14 : 4);
  addCylinder('coil-sleeve', m.gunmetal, 0.034, 0.139, [0, 0.026, 0.253], full ? 12 : 4);
  addCylinder('muzzle-shroud-body', m.darkSteel, 0.046, 0.099, [0, 0.026, 0.386], full ? 14 : 4);
  if (full) addCylinder('inner-focusing-cup', m.gunmetal, 0.029, 0.014, [0, 0.026, 0.431], 14);

  const coilCount = full ? 6 : 2;
  for (let i = 0; i < coilCount; i++) {
    const z = 0.204 + i * (full ? 0.019 : 0.039);
    addTorus(`copper-induction-coil-${i}`, m.copper, 0.035, full ? 0.0038 : 0.0046, [0, 0.026, z], full ? 12 : 8, full ? 4 : 2);
  }
  if (full) {
    for (let i = 0; i < 3; i++) addTorus(`coil-insulator-${i}`, m.rubber, 0.033, 0.0024, [0, 0.026, 0.197 + i * 0.058], 10, 3);
  }

  const ribCount = full ? 10 : 3;
  const ribs: BoxSpec[] = [];
  for (let i = 0; i < ribCount; i++) {
    const angle = i * Math.PI * 2 / ribCount;
    const radius = 0.0455;
    ribs.push({
      size: [full ? 0.008 : 0.010, 0.008, 0.076],
      position: [Math.cos(angle) * radius, 0.026 + Math.sin(angle) * radius, 0.383],
      rotation: [0, 0, angle],
    });
  }
  addBoxBatch('muzzle-longitudinal-ribs', m.gunmetal, ribs);
  if (full) addTorus('muzzle-rear-collar', m.gunmetal, 0.047, 0.0045, [0, 0.026, 0.339], 12, 4);
  addTorus('muzzle-front-collar', m.copper, 0.047, 0.0045, [0, 0.026, 0.432], full ? 12 : 8, full ? 4 : 2);
  if (full) {
    addTorus('muzzle-lip', m.darkSteel, 0.045, 0.004, [0, 0.026, 0.444], 12, 4);
    addTorus('muzzle-inner-brass-seat', m.copper, 0.032, 0.0018, [0, 0.026, 0.444], 12, 3);
  }
  const lensMaterial = rootMaterial;
  lensMaterial.emissive.set('#4adfff');
  addMesh(group, new THREE.CylinderGeometry(0.031, 0.031, 0.006, full ? 18 : 4, 1), lensMaterial, 'lens', [0, 0.026, 0.449], [Math.PI / 2, 0, 0], true);

  // The cell and its exposed status strip sit below the action, where a support hand clears them.
  addCylinder('power-cell-canister', m.darkSteel, 0.034, 0.251, [0, -0.079, -0.076], full ? 14 : 4);
  if (full) {
    addCylinder('power-cell-rear-cap', m.gunmetal, 0.0365, 0.015, [0, -0.079, -0.205], 12);
    addCylinder('power-cell-front-cap', m.gunmetal, 0.0365, 0.015, [0, -0.079, 0.053], 12);
  }
  if (full) {
    for (let i = 0; i < 5; i++) addTorus(`power-cell-grip-ring-${i}`, m.gunmetal, 0.0348, 0.0014, [0, -0.079, -0.161 + i * 0.043], 10, 3);
    addTorus('power-cell-seam-rear', m.copper, 0.0355, 0.0018, [0, -0.079, -0.184], 10, 3);
    addTorus('power-cell-seam-front', m.copper, 0.0355, 0.0018, [0, -0.079, 0.032], 10, 3);
  }
  const chargeZ = [-0.158, -0.106, -0.054, -0.002, 0.05] as const;
  for (let i = 0; i < 5; i++) {
    const material = new THREE.MeshStandardMaterial({
      color: '#14221e',
      emissive: '#9aff64',
      emissiveIntensity: 0,
      metalness: 0.22,
      roughness: 0.28,
    });
    chargeMaterials.push(material);
    const z = chargeZ[i] ?? 0;
    addMesh(group, new THREE.BoxGeometry(0.005, 0.010, 0.026), material, `charge${i}`, [0.034, -0.079, z], [0, 0, 0], true);
  }

  // The side well holds a removable slug. Its emissive stripe is changed by setCartridge().
  if (full) addChamfered('cartridge-well', m.darkSteel, [0.006, 0.071, 0.119], [0.068, 0.027, 0.019], 0.008, 0.001);
  const cartridge = new THREE.Group();
  cartridge.name = 'cartridge';
  const bodyGeometry = full
    ? chamferedBox(0.009, 0.049, 0.088, 0.008, 0.0012, 2)
    : new THREE.BoxGeometry(0.009, 0.049, 0.088);
  const cartridgeBody = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>(bodyGeometry, m.gunmetal);
  cartridgeBody.name = 'cartridge-shell';
  cartridgeBody.position.set(0.0705, 0.027, 0.019);
  if (!full) cartridgeBody.geometry = flatGeometry(cartridgeBody.geometry);
  cartridge.add(cartridgeBody);
  const cartridgeStripe = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>(new THREE.BoxGeometry(0.002, 0.045, 0.014), stripeMaterial);
  cartridgeStripe.name = 'cartridge-colour-band';
  cartridgeStripe.position.set(0.076, 0.027, 0.019);
  if (!full) cartridgeStripe.geometry = flatGeometry(cartridgeStripe.geometry);
  cartridge.add(cartridgeStripe);
  if (full) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 10), m.copper);
    tip.name = 'cartridge-index-cap';
    tip.position.set(0.071, 0.027, -0.027);
    tip.rotation.x = Math.PI / 2;
    cartridge.add(tip);
  }
  group.add(cartridge);
  const portFrame: BoxSpec[] = full ? [
    { size: [0.008, 0.006, 0.124], position: [0.073, 0.066, 0.019] },
    { size: [0.008, 0.006, 0.124], position: [0.073, -0.012, 0.019] },
    { size: [0.008, 0.084, 0.006], position: [0.073, 0.027, -0.043] },
    { size: [0.008, 0.084, 0.006], position: [0.073, 0.027, 0.081] },
  ] : [
    { size: [0.008, 0.006, 0.124], position: [0.073, 0.066, 0.019] },
    { size: [0.008, 0.006, 0.124], position: [0.073, -0.012, 0.019] },
  ];
  addBoxBatch('cartridge-port-bezel', m.gunmetal, portFrame);
  if (full) {
    addBoxBatch('port-catch-and-latch', m.hazard, [
      { size: [0.006, 0.009, 0.022], position: [0.076, 0.072, 0.019] },
      { size: [0.006, 0.004, 0.031], position: [0.076, 0.079, 0.019] },
    ]);
  }
  addMesh(group, new THREE.BoxGeometry(0.002, 0.062, 0.105), m.glass, 'cartridge-port-window', [0.0775, 0.027, 0.019]);

  // Rear status glass carries a pictogram, never lettering, in a small data texture.
  addChamfered('screen-housing', m.darkSteel, [0.068, 0.018, 0.054], [0, 0.132, -0.186], 0.008, 0.001);
  addBox('screen-bezel', m.gunmetal, [0.061, 0.004, 0.047], [0, 0.143, -0.186]);
  addMesh(group, new THREE.PlaneGeometry(0.052, 0.038), screenMaterial, 'screen', [0, 0.146, -0.186], [-Math.PI / 2, 0, 0], true);

  // The pistol grip carries moulded rubber panels; the separate loop is a real trigger guard.
  addChamfered('pistol-grip-core', m.gunmetal, [0.048, 0.126, 0.061], [0, -0.104, -0.137], 0.009, 0.0018, [0.22, 0, 0]);
  addChamfered('pistol-grip-wrap', m.rubber, [0.052, 0.096, 0.046], [0, -0.112, -0.14], 0.01, 0.001, [0.22, 0, 0]);
  const gripGrooves: BoxSpec[] = [];
  if (full) {
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 5; i++) {
        const y = -0.079 - i * 0.014;
        gripGrooves.push({ size: [0.002, 0.0022, 0.038], position: [side * 0.027, y, -0.142 + (y + 0.112) * 0.22] });
      }
    }
  }
  addBoxBatch('grip-moulded-ribs', m.darkSteel, gripGrooves);
  addTube('trigger-guard', m.gunmetal, [
    [0.019, -0.049, -0.081], [0.019, -0.071, -0.084], [0.019, -0.09, -0.105],
    [0.019, -0.091, -0.155], [0.019, -0.072, -0.178], [0.019, -0.051, -0.177],
  ], full ? 0.0032 : 0.0038, full ? 18 : 6, full ? 6 : 3);
  addRod('trigger-blade', m.copper, [0.018, -0.052, -0.124], [0.018, -0.079, -0.133], 0.003, full ? 8 : 3);

  // A clamp-backed vertical foregrip puts the second hand below the coil pack.
  addChamfered('foregrip-mount', m.darkSteel, [0.065, 0.025, 0.074], [0, -0.036, 0.193], 0.008, 0.001);
  addChamfered('foregrip-shell', m.gunmetal, [0.047, 0.103, 0.054], [0, -0.089, 0.193], 0.009, 0.0015);
  if (full) addChamfered('foregrip-rubber-sleeve', m.rubber, [0.051, 0.065, 0.042], [0, -0.091, 0.193], 0.008, 0.001);
  if (full) {
    const foregripRibs: BoxSpec[] = [];
    for (let i = 0; i < 5; i++) foregripRibs.push({ size: [0.052, 0.003, 0.004], position: [0, -0.068 - i * 0.011, 0.216] });
    addBoxBatch('foregrip-ribs', m.darkSteel, foregripRibs);
  }
  addChamfered('foregrip-end-cap', m.copper, [0.052, 0.009, 0.058], [0, -0.145, 0.193], 0.006, 0.001);

  // Open twin rails and a padded butt keep the stock skeletal without losing shoulder contact.
  addChamfered('stock-buffer', m.gunmetal, [0.083, 0.118, 0.042], [0, -0.003, -0.249], 0.009, 0.0015);
  for (const side of [-1, 1]) {
    const x = side * 0.036;
    addRod(`stock-upper-rail-${side}`, m.gunmetal, [x, 0.052, -0.258], [x, 0.052, -0.405], 0.006, full ? 8 : 3);
    addRod(`stock-lower-rail-${side}`, m.darkSteel, [x, -0.065, -0.258], [x, -0.047, -0.405], 0.006, full ? 8 : 3);
    addRod(`stock-diagonal-rail-${side}`, m.gunmetal, [x, 0.04, -0.265], [x, -0.041, -0.399], 0.005, full ? 8 : 3);
  }
  addBox('stock-crossbrace', m.darkSteel, [0.078, 0.012, 0.013], [0, -0.003, -0.358]);
  addChamfered('shoulder-butt-pad', m.rubber, [0.087, 0.139, 0.025], [0, -0.003, -0.432], 0.014, 0.002);
  if (full) addBox('butt-pad-insert', m.darkSteel, [0.064, 0.099, 0.004], [0, -0.003, -0.447]);
  if (full) {
    addBoxBatch('butt-pad-grooves', m.rubber, [
      { size: [0.064, 0.004, 0.004], position: [0, -0.042, -0.45] },
      { size: [0.064, 0.004, 0.004], position: [0, -0.025, -0.45] },
      { size: [0.064, 0.004, 0.004], position: [0, -0.008, -0.45] },
      { size: [0.064, 0.004, 0.004], position: [0, 0.009, -0.45] },
      { size: [0.064, 0.004, 0.004], position: [0, 0.026, -0.45] },
    ]);
  }

  // The insulated power lead turns up from the cell into the induction sleeve.
  addTube('armoured-power-lead', m.rubber, [
    [0.03, -0.079, -0.005], [0.047, -0.071, 0.02], [0.055, -0.047, 0.071],
    [0.056, -0.011, 0.115], [0.052, 0.004, 0.165], [0.043, 0.015, 0.214],
  ], full ? 0.0042 : 0.0045, full ? 22 : 6, full ? 7 : 3);
  if (full) {
    addCylinder('lead-cell-gland', m.copper, 0.008, 0.013, [0.034, -0.079, -0.005], 10, [0, 0, Math.PI / 2]);
    addCylinder('lead-coil-gland', m.gunmetal, 0.008, 0.013, [0.043, 0.015, 0.214], 10, [0, 0, Math.PI / 2]);
  }
  if (full) {
    addBoxBatch('lead-clips', m.hazard, [
      { size: [0.006, 0.006, 0.012], position: [0.055, -0.047, 0.071] },
      { size: [0.006, 0.006, 0.012], position: [0.054, 0.001, 0.149] },
    ]);
  }

  // Vents, fasteners and slotted heads are concentrated around serviceable panels.
  if (full) {
    const vents: BoxSpec[] = [];
    for (let i = 0; i < 7; i++) vents.push({ size: [0.003, 0.003, 0.024], position: [0.071, 0.048 - i * 0.008, -0.135] });
    addBoxBatch('receiver-vent-slots', m.darkSteel, vents);
    const fastenerPositions: V3[] = [
      [0.071, 0.059, -0.184], [0.071, -0.006, -0.184], [0.071, 0.059, -0.074], [0.071, -0.006, -0.074],
      [-0.071, 0.059, -0.184], [-0.071, -0.006, -0.184], [-0.071, 0.059, -0.074], [-0.071, -0.006, -0.074],
    ];
    const screwSlots: BoxSpec[] = [];
    for (let i = 0; i < fastenerPositions.length; i++) {
      const position = fastenerPositions[i];
      if (!position) continue;
      const sign = position[0] > 0 ? 1 : -1;
      addXcylinder(`receiver-fastener-${i}`, m.copper, 0.0052, 0.0035, position, 10);
      screwSlots.push({ size: [0.0012, 0.0014, 0.0055], position: [position[0] + sign * 0.0021, position[1], position[2]] });
    }
    addBoxBatch('fastener-slots', m.darkSteel, screwSlots);
    const seamLines: BoxSpec[] = [
      { size: [0.002, 0.002, 0.19], position: [-0.071, 0.071, -0.08] },
      { size: [0.002, 0.002, 0.19], position: [0.071, 0.071, -0.08] },
      { size: [0.002, 0.002, 0.12], position: [-0.071, -0.019, -0.137] },
      { size: [0.002, 0.002, 0.12], position: [0.071, -0.019, -0.137] },
    ];
    addBoxBatch('receiver-panel-seams', m.darkSteel, seamLines);
    addBoxBatch('hazard-service-markings', m.hazard, [
      { size: [0.002, 0.006, 0.048], position: [-0.072, 0.069, -0.002] },
      { size: [0.002, 0.006, 0.048], position: [0.072, 0.069, -0.002] },
    ]);
  } else {
    addXcylinder('receiver-fastener-left', m.copper, 0.005, 0.003, [-0.071, 0.058, -0.176], 4);
    addXcylinder('receiver-fastener-right', m.copper, 0.005, 0.003, [0.071, 0.058, -0.176], 4);
  }

  const sockets = {
    grip: new THREE.Vector3(0, -0.111, -0.137),
    foregrip: new THREE.Vector3(0, -0.105, 0.193),
    shoulder: new THREE.Vector3(0, -0.003, -0.44),
    muzzle: new THREE.Vector3(0, 0.026, 0.45),
    cartridge: new THREE.Vector3(0.075, 0.027, 0.019),
    screen: new THREE.Vector3(0, 0.146, -0.186),
  } as const;

  let mode: BeamMode = 'extract';
  let cartridgeColour: string | null = '#f3b848';
  const redrawScreen = (): void => {
    const image = screenTexture.image;
    (image.data as Uint8Array).set(makeScreenData(mode, cartridgeColour));
    screenTexture.needsUpdate = true;
  };
  const setMode = (next: BeamMode): void => {
    mode = next;
    if (mode === 'extract') rootMaterial.emissive.set('#4adfff');
    else if (mode === 'apply') rootMaterial.emissive.copy(stripeMaterial.color);
    else rootMaterial.emissive.set('#e891ff');
    redrawScreen();
  };
  const setCartridge = (colour: string | null): void => {
    cartridgeColour = colour;
    cartridge.visible = colour !== null;
    if (colour !== null) stripeMaterial.color.set(colour);
    redrawScreen();
  };
  const setCharge = (level: number): void => {
    const lit = Math.round(clamp01(level) * 5);
    for (let i = 0; i < chargeMaterials.length; i++) {
      const material = chargeMaterials[i];
      if (material) material.emissiveIntensity = i < lit ? 1 : 0;
    }
  };
  const setFiring = (level: number): void => {
    rootMaterial.emissiveIntensity = clamp01(level);
  };
  setMode('extract');
  setCharge(0.72);
  setFiring(0.76);

  return {
    group,
    sockets,
    lamps,
    setMode,
    setCartridge,
    setCharge,
    setFiring,
    triangles: triangleCount(group),
  };
}

export interface BeamFx {
  readonly object: THREE.Object3D;
  set(from: THREE.Vector3, to: THREE.Vector3, mode: BeamMode, colour: string, on: boolean): void;
  update(t: number): void;
  dispose(): void;
}

export function beamPixelAt(
  i: number,
  count: number,
  t: number,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  mode: BeamMode,
): [number, number, number] {
  const safeCount = Math.max(1, count);
  const phase0 = i / safeCount;
  const travelPhase = mode === 'sculpt' ? fract(phase0 + t * 0.16) : fract(phase0 + t * 0.42);
  const along = mode === 'extract' ? 1 - travelPhase : travelPhase;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz);
  const tx = length > 0 ? dx / length : 0;
  const ty = length > 0 ? dy / length : 0;
  const tz = length > 0 ? dz / length : 1;
  const ref: readonly [number, number, number] = Math.abs(ty) < 0.92 ? [0, 1, 0] : [1, 0, 0];
  let rx = ty * ref[2] - tz * ref[1];
  let ry = tz * ref[0] - tx * ref[2];
  let rz = tx * ref[1] - ty * ref[0];
  const rLength = Math.hypot(rx, ry, rz) || 1;
  rx /= rLength;
  ry /= rLength;
  rz /= rLength;
  const ux = ry * tz - rz * ty;
  const uy = rz * tx - rx * tz;
  const uz = rx * ty - ry * tx;
  const angle = phase0 * Math.PI * 2 + t * 5;
  const radius = 0.018 + 0.012 * (0.5 + 0.5 * Math.sin(phase0 * 13 + t * 2));
  const spiralX = rx * Math.cos(angle) * radius + ux * Math.sin(angle) * radius;
  const spiralY = ry * Math.cos(angle) * radius + uy * Math.sin(angle) * radius;
  const spiralZ = rz * Math.cos(angle) * radius + uz * Math.sin(angle) * radius;
  return [
    from[0] + dx * along + spiralX,
    from[1] + dy * along + spiralY,
    from[2] + dz * along + spiralZ,
  ];
}

export function beamEffect(o?: { readonly pixels?: number }): BeamFx {
  const count = Math.max(1, Math.min(256, Math.floor(o?.pixels ?? 160)));
  const geometry = new THREE.BufferGeometry();
  const placeholders = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) phases[i] = i / count;
  geometry.setAttribute('position', new THREE.BufferAttribute(placeholders, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setDrawRange(0, count);

  const uniforms = {
    uFrom: { value: new THREE.Vector3(0, 0, 0) },
    uTo: { value: new THREE.Vector3(0, 0, 1) },
    uTime: { value: 0 },
    uMode: { value: 1 },
    uColour: { value: new THREE.Color('#7cff4d') },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: `
      uniform float uTime;
      uniform float uMode;
      uniform vec3 uFrom;
      uniform vec3 uTo;
      attribute float aPhase;
      varying float vPulse;

      void main() {
        vec3 delta = uTo - uFrom;
        float lineLength = length(delta);
        vec3 tangent = lineLength > 0.00001 ? delta / lineLength : vec3(0.0, 0.0, 1.0);
        vec3 reference = abs(tangent.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 side = normalize(cross(tangent, reference));
        vec3 lift = normalize(cross(side, tangent));
        float speed = uMode > 1.5 ? 0.16 : 0.42;
        float flow = fract(aPhase + uTime * speed);
        float along = uMode < 0.5 ? 1.0 - flow : flow;
        float angle = aPhase * 6.28318530718 + uTime * 5.0;
        float radius = 0.018 + 0.012 * (0.5 + 0.5 * sin(aPhase * 13.0 + uTime * 2.0));
        vec3 spiral = (side * cos(angle) + lift * sin(angle)) * radius;
        vec3 point = mix(uFrom, uTo, along) + spiral;
        vec4 viewPosition = modelViewMatrix * vec4(point + position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(38.0 / max(1.0, -viewPosition.z), 2.4, 9.0);
        vPulse = uMode > 1.5 ? 0.55 + 0.45 * sin(aPhase * 6.28318530718 - uTime * 5.0) : 0.78 + 0.22 * sin(aPhase * 6.28318530718 + uTime * 4.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColour;
      uniform float uMode;
      varying float vPulse;

      void main() {
        vec2 edge = abs(gl_PointCoord - vec2(0.5));
        float square = 1.0 - smoothstep(0.43, 0.5, max(edge.x, edge.y));
        float centre = 0.72 + 0.28 * (1.0 - smoothstep(0.0, 0.5, length(edge)));
        float pulse = uMode > 1.5 ? vPulse : 1.0;
        gl_FragColor = vec4(uColour * (1.1 + pulse * 0.65), square * centre * (0.62 + pulse * 0.38));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'beam-effect-pixels';
  points.frustumCulled = false;

  const set = (from: THREE.Vector3, to: THREE.Vector3, mode: BeamMode, colour: string, on: boolean): void => {
    uniforms.uFrom.value.copy(from);
    uniforms.uTo.value.copy(to);
    uniforms.uMode.value = mode === 'extract' ? 0 : mode === 'apply' ? 1 : 2;
    uniforms.uColour.value.set(colour);
    points.visible = on;
  };
  const update = (t: number): void => {
    uniforms.uTime.value = t;
  };
  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
    points.visible = false;
  };

  return { object: points, set, update, dispose };
}