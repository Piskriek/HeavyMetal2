import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Box { min: [number, number, number]; max: [number, number, number] }
export interface Socket { name: string; at: [number, number, number] }
export interface Prop {
  group: THREE.Group;
  colliders: Box[];
  sockets: Socket[];
  lamps: THREE.Mesh[];
}
export interface LabMaterials {
  gunmetal: THREE.MeshStandardMaterial; darkSteel: THREE.MeshStandardMaterial; paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial; rubber: THREE.MeshStandardMaterial; hazard: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial; concrete: THREE.MeshStandardMaterial;
}

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function makeHazardTexture(): THREE.DataTexture {
  const w = 64;
  const h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = (x + y) % 16;
      const yellow = d < 8;
      const i = (y * w + x) * 4;
      if (yellow) {
        data[i] = 242; data[i + 1] = 185; data[i + 2] = 12; data[i + 3] = 255;
      } else {
        data[i] = 16; data[i + 1] = 16; data[i + 2] = 18; data[i + 3] = 255;
      }
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeWaveTexture(): THREE.DataTexture {
  const w = 128;
  const h = 96;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = 4; data[i + 1] = 14; data[i + 2] = 9; data[i + 3] = 255;
      const grid = (x % 16 === 0) || (y % 16 === 0);
      if (grid) {
        data[i] = 10; data[i + 1] = 34; data[i + 2] = 20;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    const fx = x / w;
    const yw = 48 + 22 * Math.sin(fx * Math.PI * 2 * 2.2) + 8 * Math.sin(fx * Math.PI * 2 * 5.1 + 1.3);
    const yi = Math.round(yw);
    for (let k = -1; k <= 1; k++) {
      const y = yi + k;
      if (y >= 0 && y < h) {
        const i = (y * w + x) * 4;
        data[i] = 70; data[i + 1] = 255; data[i + 2] = 140; data[i + 3] = 255;
      }
    }
    const yg = yi + 2;
    if (yg >= 0 && yg < h) {
      const i = (yg * w + x) * 4;
      data[i] = 20; data[i + 1] = 90; data[i + 2] = 50;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeCartTexture(): THREE.DataTexture {
  const w = 64;
  const h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const band = Math.floor(y / 8) % 2;
      if (band === 0) {
        data[i] = 255; data[i + 1] = 61; data[i + 2] = 138; data[i + 3] = 255;
      } else {
        data[i] = 245; data[i + 1] = 245; data[i + 2] = 248; data[i + 3] = 255;
      }
      if (x < 2 || x > w - 3) {
        data[i] = 40; data[i + 1] = 40; data[i + 2] = 44;
      }
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createMaterials(): LabMaterials {
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x454c54, metalness: 0.88, roughness: 0.32 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x2f353b, metalness: 0.72, roughness: 0.55 });
  const paint = new THREE.MeshStandardMaterial({ color: 0x8f969e, metalness: 0.22, roughness: 0.58 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb0703a, metalness: 0.9, roughness: 0.34 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141619, metalness: 0.05, roughness: 0.92 });
  const hazard = new THREE.MeshStandardMaterial({ map: makeHazardTexture(), metalness: 0.1, roughness: 0.62 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe2f5, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.22 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xd6d2c8, metalness: 0.02, roughness: 0.85 });
  return { gunmetal, darkSteel, paint, copper, rubber, hazard, glass, concrete };
}

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material as THREE.MeshStandardMaterial;
  const g = Math.min(1, Math.max(0, glow));
  mat.emissiveIntensity = g * 3.2;
}

export function triangles(p: Prop): number {
  let t = 0;
  p.group.traverse((o) => {
    const mh = o as THREE.Mesh;
    if (mh.isMesh) {
      const geo = mh.geometry as THREE.BufferGeometry;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!pos) return;
      if (geo.index) t += geo.index.count / 3;
      else t += pos.count / 3;
    }
  });
  return Math.round(t);
}

function xf(geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const e = new THREE.Euler(rx, ry, rz);
  const q = new THREE.Quaternion().setFromEuler(e);
  const mt = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
  geo.applyMatrix4(mt);
  return geo;
}

function meshFrom(geos: THREE.BufferGeometry[], mat: THREE.Material): THREE.Mesh | null {
  if (geos.length === 0) return null;
  const parts: THREE.BufferGeometry[] = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    parts.push(ng);
  }
  const merged = mergeGeometries(parts, false);
  if (!merged) return null;
  const mesh = new THREE.Mesh(merged, mat);
  return mesh;
}

function lampMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x0c0d0e, emissive: color, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.0 });
}

export function operatorConsole(m: LabMaterials): Prop & { lever: THREE.Object3D; screen: THREE.Mesh } {
  const paintG: THREE.BufferGeometry[] = [];
  const darkG: THREE.BufferGeometry[] = [];
  const gunG: THREE.BufferGeometry[] = [];
  const rubberG: THREE.BufferGeometry[] = [];
  const copperG: THREE.BufferGeometry[] = [];
  const concreteG: THREE.BufferGeometry[] = [];
  const glassG: THREE.BufferGeometry[] = [];
  const redG: THREE.BufferGeometry[] = [];
  const greenG: THREE.BufferGeometry[] = [];

  // plinth + grommet + pedestal
  darkG.push(xf(new THREE.BoxGeometry(0.68, 0.06, 0.53), 0, 0.03, 0));
  darkG.push(xf(new THREE.CylinderGeometry(0.07, 0.07, 0.012, 20), 0, 0.006, 0));
  paintG.push(xf(new THREE.BoxGeometry(0.6, 0.8, 0.45), 0, 0.46, 0));
  darkG.push(xf(new THREE.BoxGeometry(0.62, 0.04, 0.47), 0, 0.09, 0));
  // anchor bolts
  const abx = [0.28, -0.28];
  const abz = [0.2, -0.2];
  for (const ax of abx) {
    for (const az of abz) {
      gunG.push(xf(new THREE.CylinderGeometry(0.012, 0.012, 0.026, 6), ax, 0.073, az));
      gunG.push(xf(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 6), ax, 0.063, az));
    }
  }
  // service door
  darkG.push(xf(new THREE.BoxGeometry(0.48, 0.64, 0.015), 0, 0.46, 0.222));
  paintG.push(xf(new THREE.BoxGeometry(0.42, 0.58, 0.015), 0, 0.46, 0.218));
  gunG.push(xf(new THREE.BoxGeometry(0.44, 0.008, 0.006), 0, 0.755, 0.227));
  gunG.push(xf(new THREE.BoxGeometry(0.44, 0.008, 0.006), 0, 0.165, 0.227));
  gunG.push(xf(new THREE.BoxGeometry(0.008, 0.6, 0.006), -0.215, 0.46, 0.227));
  gunG.push(xf(new THREE.BoxGeometry(0.008, 0.6, 0.006), 0.215, 0.46, 0.227));
  gunG.push(xf(new THREE.BoxGeometry(0.025, 0.06, 0.015), -0.2, 0.3, 0.23));
  gunG.push(xf(new THREE.BoxGeometry(0.025, 0.06, 0.015), -0.2, 0.62, 0.23));
  gunG.push(xf(new THREE.BoxGeometry(0.03, 0.03, 0.02), 0.16, 0.46, 0.232));
  copperG.push(xf(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), 0.16, 0.46, 0.248, Math.PI / 2, 0, 0));
  rubberG.push(xf(new THREE.SphereGeometry(0.012, 8, 6), 0.16, 0.485, 0.248));
  // side vents
  for (let i = 0; i < 5; i++) {
    const vy = 0.25 + i * 0.04;
    darkG.push(xf(new THREE.BoxGeometry(0.012, 0.015, 0.3), 0.305, vy, 0));
    darkG.push(xf(new THREE.BoxGeometry(0.012, 0.015, 0.3), -0.305, vy, 0));
  }
  // desk carcass: side profile extruded across width
  {
    const s = new THREE.Shape();
    s.moveTo(0.35, 0.86);
    s.lineTo(0.35, 1.05);
    s.lineTo(-0.35, 1.305);
    s.lineTo(-0.35, 0.86);
    s.closePath();
    const dg = new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, steps: 1 });
    dg.rotateY(-Math.PI / 2);
    dg.translate(0.6, 0, 0);
    paintG.push(dg);
  }
  gunG.push(xf(new THREE.BoxGeometry(1.22, 0.018, 0.018), 0, 1.05, 0.35));
  darkG.push(xf(new THREE.BoxGeometry(0.02, 0.006, 0.7), 0.585, 1.19, 0, 0.349, 0, 0));
  darkG.push(xf(new THREE.BoxGeometry(0.02, 0.006, 0.7), -0.585, 1.19, 0, 0.349, 0, 0));
  // front fascia bolts
  const fbx = [0.55, -0.55, 0.3, -0.3];
  for (const bx of fbx) {
    gunG.push(xf(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 6), bx, 0.95, 0.352, Math.PI / 2, 0, 0));
  }

  // raised upper panel
  const upY = 1.4626;
  const upZ = -0.3778;
  const upTilt = -0.1745;
  paintG.push(xf(new THREE.BoxGeometry(1.16, 0.32, 0.08), 0, upY, upZ, upTilt, 0, 0));
  darkG.push(xf(new THREE.BoxGeometry(1.18, 0.025, 0.1), 0, 1.62, -0.4056, upTilt, 0, 0));
  darkG.push(xf(new THREE.BoxGeometry(1.16, 0.02, 0.02), 0, 1.315, -0.352, upTilt, 0, 0));
  // corner screws
  const screwPos: Array<[number, number, number]> = [
    [0.52, 1.5978, -0.36],
    [-0.52, 1.5978, -0.36],
    [0.52, 1.3417, -0.3148],
    [-0.52, 1.3417, -0.3148],
  ];
  for (const sp of screwPos) {
    gunG.push(xf(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 6), sp[0], sp[1], sp[2], 1.396, 0, 0));
  }

  // gauges
  const gaugeX = [-0.38, -0.2];
  const gaugeYLocal = [0.07, -0.07];
  let gi = 0;
  for (const gx of gaugeX) {
    for (const gyL of gaugeYLocal) {
      const gy = 1.4626 + gyL * 0.985 + 0.0071;
      const gz = -0.3778 - gyL * 0.174 + 0.0404;
      gunG.push(xf(new THREE.CylinderGeometry(0.055, 0.058, 0.022, 20), gx, gy, gz, 1.396, 0, 0));
      concreteG.push(xf(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 20), gx, gy + 0.0021, gz + 0.0118, 1.396, 0, 0));
      // tick marks: 5 tiny boxes around face
      for (let k = 0; k < 5; k++) {
        const ta = -0.9 + k * 0.45 + hash01(gi * 7 + k) * 0.08;
        const tx = gx + Math.cos(ta) * 0.032;
        const ty = gy + 0.003 + Math.sin(ta) * 0.032 * 0.985;
        const tz = gz + 0.013 + Math.sin(ta) * 0.032 * -0.174 * -1 + 0.001;
        copperG.push(xf(new THREE.BoxGeometry(0.003, 0.007, 0.001), tx, ty, tz, upTilt, 0, ta + Math.PI / 2));
      }
      const needleAng = -0.7 + gi * 0.55;
      const nx = gx;
      const ny = gy + 0.0035;
      const nz = gz + 0.0145;
      const needle = new THREE.BoxGeometry(0.004, 0.036, 0.002);
      needle.translate(0, 0.012, 0);
      needle.rotateZ(needleAng);
      needle.rotateX(upTilt);
      needle.translate(nx, ny, nz);
      copperG.push(needle);
      copperG.push(xf(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 10), nx, ny, nz, 1.396, 0, 0));
      glassG.push(xf(new THREE.CylinderGeometry(0.048, 0.048, 0.003, 20), gx, gy + 0.0026, gz + 0.0148, 1.396, 0, 0));
      gi++;
    }
  }

  // screen bezel (static) + screen (separate)
  gunG.push(xf(new THREE.BoxGeometry(0.26, 0.19, 0.015), 0.12, 1.4795, -0.339, upTilt, 0, 0));
  const waveTex = makeWaveTexture();
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x020503, emissive: 0x2bff88, emissiveMap: waveTex, map: waveTex, emissiveIntensity: 1.7, roughness: 0.45, metalness: 0.0 });
  const screenGeo = new THREE.PlaneGeometry(0.22, 0.15);
  xf(screenGeo, 0.12, 1.4809, -0.3311, upTilt, 0, 0);
  const screen = new THREE.Mesh(screenGeo, screenMat);

  // keypad
  gunG.push(xf(new THREE.BoxGeometry(0.13, 0.16, 0.012), 0.4, 1.4697, -0.3374, upTilt, 0, 0));
  const kx = [0.365, 0.4, 0.435];
  const kyL = [-0.045, -0.015, 0.015, 0.045];
  for (const ox of kx) {
    for (const oyL of kyL) {
      const wy = 1.4697 + oyL * 0.985 + 0.0017;
      const wz = -0.3374 - oyL * 0.174 + 0.0098;
      rubberG.push(xf(new THREE.BoxGeometry(0.028, 0.022, 0.014), ox, wy, wz, upTilt, 0, 0));
      const hv = hash01(ox * 91 + oyL * 57);
      if (hv > 0.6) {
        copperG.push(xf(new THREE.BoxGeometry(0.008, 0.003, 0.001), ox, wy + 0.004, wz + 0.0075, upTilt, 0, 0));
      }
    }
  }

  // sloped panel toggles / buttons / lamps
  const slopeY = (z: number): number => 1.1775 - z * 0.3643;
  const sNormY = 0.9397;
  const sNormZ = 0.342;
  const togX = [-0.4, -0.31, -0.22, -0.13, -0.04, 0.05];
  let ti = 0;
  for (const tx of togX) {
    const tz = 0.08;
    const ty = slopeY(tz) + 0.006 * sNormY;
    const tzz = tz + 0.006 * sNormZ;
    gunG.push(xf(new THREE.CylinderGeometry(0.015, 0.018, 0.012, 16), tx, ty, tzz, 0.349, 0, 0));
    gunG.push(xf(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 16), tx, ty - 0.002, tzz - 0.001, 0.349, 0, 0));
    const tilt = (hash01(ti * 3.7) > 0.5 ? 1 : -1) * (0.22 + hash01(ti * 9.1) * 0.12);
    const la = 0.349 + tilt;
    const lcy = ty + 0.018 * sNormY;
    const lcz = tzz + 0.018 * sNormZ;
    copperG.push(xf(new THREE.CylinderGeometry(0.004, 0.005, 0.032, 8), lcy * 0 + tx, lcy, lcz, la, 0, 0));
    const dirY = Math.cos(la);
    const dirZ = Math.sin(la);
    rubberG.push(xf(new THREE.SphereGeometry(0.007, 8, 6), tx, lcy + dirY * 0.017, lcz + dirZ * 0.017));
    ti++;
  }
  // push buttons
  const btnX = [0.2, 0.3];
  for (let bi = 0; bi < btnX.length; bi++) {
    const bx = btnX[bi] as number;
    const bz = 0.08;
    const by = slopeY(bz) + 0.006 * sNormY;
    const bzz = bz + 0.006 * sNormZ;
    gunG.push(xf(new THREE.CylinderGeometry(0.018, 0.02, 0.012, 20), bx, by, bzz, 0.349, 0, 0));
    if (bi === 0) {
      redG.push(xf(new THREE.CylinderGeometry(0.012, 0.013, 0.016, 20), bx, by + 0.006, bzz + 0.0025, 0.349, 0, 0));
      redG.push(xf(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), bx, by + 0.014, bzz + 0.005, 0.349, 0, 0));
    } else {
      greenG.push(xf(new THREE.CylinderGeometry(0.012, 0.013, 0.016, 20), bx, by + 0.006, bzz + 0.0025, 0.349, 0, 0));
      greenG.push(xf(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), bx, by + 0.014, bzz + 0.005, 0.349, 0, 0));
    }
  }
  // indicator lamp bases (domes separate)
  const lampBaseX = [0.2, 0.3];
  const lampZ = -0.08;
  for (let li = 0; li < lampBaseX.length; li++) {
    const lx = lampBaseX[li] as number;
    const ly = slopeY(lampZ) + 0.005 * sNormY;
    const lz = lampZ + 0.005 * sNormZ;
    gunG.push(xf(new THREE.CylinderGeometry(0.016, 0.018, 0.01, 16), lx, ly, lz, 0.349, 0, 0));
  }
  // quadrant plate + slot + base
  const pivX = 0.5;
  const pivY = 1.28;
  const pivZ = -0.05;
  darkG.push(xf(new THREE.BoxGeometry(0.012, 0.14, 0.26), pivX, 1.24, pivZ));
  darkG.push(xf(new THREE.BoxGeometry(0.06, 0.02, 0.28), pivX, 1.2, pivZ, 0.349, 0, 0));
  gunG.push(xf(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 20), pivX + 0.008, pivY, pivZ, 0, 0, Math.PI / 2));
  const slotA = [0.3, 0.0, -0.3, -0.6, -0.8];
  for (const a of slotA) {
    const sy = pivY + 0.09 * Math.cos(a);
    const sz = pivZ + 0.09 * Math.sin(a);
    rubberG.push(xf(new THREE.BoxGeometry(0.014, 0.02, 0.022), pivX + 0.006, sy, sz));
  }
  gunG.push(xf(new THREE.BoxGeometry(0.014, 0.01, 0.02), pivX + 0.006, pivY + 0.09 * Math.cos(0.3), pivZ + 0.09 * Math.sin(0.3)));
  gunG.push(xf(new THREE.BoxGeometry(0.014, 0.01, 0.02), pivX + 0.006, pivY + 0.09 * Math.cos(-0.8), pivZ + 0.09 * Math.sin(-0.8)));

  const group = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc41e1e, roughness: 0.35, metalness: 0.25 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x1e9e4a, roughness: 0.35, metalness: 0.2 });
  const addStatic = (geos: THREE.BufferGeometry[], mat: THREE.Material): void => {
    const mh = meshFrom(geos, mat);
    if (mh) group.add(mh);
  };
  addStatic(paintG, m.paint);
  addStatic(darkG, m.darkSteel);
  addStatic(gunG, m.gunmetal);
  addStatic(rubberG, m.rubber);
  addStatic(copperG, m.copper);
  addStatic(concreteG, m.concrete);
  addStatic(glassG, m.glass);
  addStatic(redG, redMat);
  addStatic(greenG, greenMat);
  group.add(screen);

  // lamps
  const lampGreenMat = lampMaterial(0x22ff77);
  const lampAmberMat = lampMaterial(0xffaa22);
  const lampY0 = slopeY(lampZ) + 0.005 * sNormY + 0.012 * sNormY;
  const lampZ0 = lampZ + 0.005 * sNormZ + 0.012 * sNormZ;
  const lampGeoG = new THREE.SphereGeometry(0.013, 16, 12);
  xf(lampGeoG, (lampBaseX[0] as number), lampY0, lampZ0);
  const lampGeoA = new THREE.SphereGeometry(0.013, 16, 12);
  xf(lampGeoA, (lampBaseX[1] as number), lampY0, lampZ0);
  // small bezel rings already static; domes:
  const lamp0 = new THREE.Mesh(lampGeoG, lampGreenMat);
  const lamp1 = new THREE.Mesh(lampGeoA, lampAmberMat);
  // collars under domes
  const collarG = new THREE.CylinderGeometry(0.014, 0.014, 0.004, 12);
  void collarG;
  group.add(lamp0);
  group.add(lamp1);

  // lever
  const lever = new THREE.Group();
  lever.position.set(pivX, pivY, pivZ);
  lever.rotation.x = 0;
  const armGeos: THREE.BufferGeometry[] = [];
  const hub = new THREE.CylinderGeometry(0.025, 0.025, 0.06, 20);
  xf(hub, 0, 0, 0, 0, 0, Math.PI / 2);
  armGeos.push(hub);
  const arm = new THREE.BoxGeometry(0.03, 0.22, 0.024);
  arm.translate(0, 0.11, 0);
  arm.rotateX(0.3);
  armGeos.push(arm);
  const armLow = new THREE.BoxGeometry(0.024, 0.05, 0.02);
  armLow.translate(0, -0.02, 0);
  armLow.rotateX(0.3);
  armGeos.push(armLow);
  const armMesh = meshFrom(armGeos, m.darkSteel);
  const gripGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.13, 16);
  const gripTopY = 0.22 * Math.cos(0.3);
  const gripTopZ = 0.22 * Math.sin(0.3);
  xf(gripGeo, 0, gripTopY, gripTopZ, 0, 0, Math.PI / 2);
  const gripMesh = new THREE.Mesh(gripGeo.index ? gripGeo.toNonIndexed() : gripGeo, redMat);
  const gripCapL = new THREE.SphereGeometry(0.018, 12, 8);
  xf(gripCapL, -0.065, gripTopY, gripTopZ);
  const gripCapR = new THREE.SphereGeometry(0.018, 12, 8);
  xf(gripCapR, 0.065, gripTopY, gripTopZ);
  const gripGroup: THREE.BufferGeometry[] = [gripGeo];
  void gripCapL; void gripCapR; void gripGroup;
  if (armMesh) lever.add(armMesh);
  lever.add(gripMesh);
  // end caps as separate small meshes merged into grip? merge caps into grip mesh geometry
  {
    const capL = new THREE.SphereGeometry(0.018, 10, 8);
    xf(capL, -0.065, gripTopY, gripTopZ);
    const capR = new THREE.SphereGeometry(0.018, 10, 8);
    xf(capR, 0.065, gripTopY, gripTopZ);
    const mergedGrip = mergeGeometries([(gripMesh.geometry as THREE.BufferGeometry).index ? ((gripMesh.geometry as THREE.BufferGeometry).toNonIndexed()) : (gripMesh.geometry as THREE.BufferGeometry), capL.index ? capL.toNonIndexed() : capL, capR.index ? capR.toNonIndexed() : capR], false);
    if (mergedGrip) gripMesh.geometry = mergedGrip;
  }
  group.add(lever);

  const bb = new THREE.Box3().setFromObject(group);
  const colliders: Box[] = [{ min: [bb.min.x, 0, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z] }];
  const sockets: Socket[] = [{ name: 'cable', at: [0, 0.02, 0] }];
  return { group, colliders, sockets, lamps: [lamp0, lamp1], lever, screen };
}

function flatClone<T extends THREE.Material>(mat: T): T {
  const c = mat.clone() as T;
  const rec = c as unknown as { flatShading?: boolean };
  rec.flatShading = true;
  c.needsUpdate = true;
  return c;
}

export function textureMill(m: LabMaterials, o?: { stage?: number }): Prop {
  const stage = o?.stage ?? 6;
  const low = stage === 0 || stage === 1;

  const warmBase = new THREE.MeshStandardMaterial({ color: 0xc9c2b4, roughness: 0.62, metalness: 0.18 });
  const oreBase = new THREE.MeshStandardMaterial({ color: 0xbcaf9a, roughness: 0.95, metalness: 0.0, flatShading: true });
  const cartBase = new THREE.MeshStandardMaterial({ map: makeCartTexture(), roughness: 0.5, metalness: 0.12 });
  const labelBase = new THREE.MeshStandardMaterial({ color: 0xff3d8a, roughness: 0.5, metalness: 0.15 });

  const warmMat = low ? flatClone(warmBase) : warmBase;
  const oreMat = low ? flatClone(oreBase) : oreBase;
  const cartMat = low ? flatClone(cartBase) : cartBase;
  const labelMat = low ? flatClone(labelBase) : labelBase;
  const darkMat = low ? flatClone(m.darkSteel) : m.darkSteel;
  const gunMat = low ? flatClone(m.gunmetal) : m.gunmetal;
  const rubberMat = low ? flatClone(m.rubber) : m.rubber;
  const hazardMat = low ? flatClone(m.hazard) : m.hazard;
  const copperMat = low ? flatClone(m.copper) : m.copper;

  const warmG: THREE.BufferGeometry[] = [];
  const darkG: THREE.BufferGeometry[] = [];
  const gunG: THREE.BufferGeometry[] = [];
  const rubberG: THREE.BufferGeometry[] = [];
  const hazardG: THREE.BufferGeometry[] = [];
  const copperG: THREE.BufferGeometry[] = [];
  const oreG: THREE.BufferGeometry[] = [];
  const cartG: THREE.BufferGeometry[] = [];
  const labelG: THREE.BufferGeometry[] = [];

  const segCyl = low ? 8 : 24;
  const segSmall = low ? 6 : 12;

  // feet
  const footX = [0.4, -0.4];
  const footZ = [0.65, -0.65];
  for (const fx of footX) {
    for (const fz of footZ) {
      darkG.push(xf(new THREE.BoxGeometry(0.18, 0.02, 0.18), fx, 0.01, fz));
      darkG.push(xf(new THREE.BoxGeometry(0.12, 0.15, 0.12), fx, 0.095, fz));
      darkG.push(xf(new THREE.BoxGeometry(0.14, 0.02, 0.14), fx, 0.16, fz));
      if (!low) {
        for (const ox of [-0.06, 0.06]) {
          for (const oz of [-0.06, 0.06]) {
            gunG.push(xf(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6), fx + ox, 0.028, fz + oz));
          }
        }
      }
    }
  }
  // toe strip
  hazardG.push(xf(new THREE.BoxGeometry(1.14, 0.09, 0.025), 0, 0.2, 0.86));
  hazardG.push(xf(new THREE.BoxGeometry(1.14, 0.09, 0.025), 0, 0.2, -0.86));
  hazardG.push(xf(new THREE.BoxGeometry(0.025, 0.09, 1.74), 0.56, 0.2, 0));
  hazardG.push(xf(new THREE.BoxGeometry(0.025, 0.09, 1.74), -0.56, 0.2, 0));

  // body octagon extruded along z
  {
    const s = new THREE.Shape();
    s.moveTo(-0.55, 0.15);
    s.lineTo(0.55, 0.15);
    s.lineTo(0.55, 1.0);
    s.lineTo(0.35, 1.3);
    s.lineTo(-0.35, 1.3);
    s.lineTo(-0.55, 1.0);
    s.closePath();
    const bg = new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, steps: 1 });
    bg.translate(0, 0, -0.85);
    warmG.push(bg);
  }
  // vertical seam collar
  {
    const s2 = new THREE.Shape();
    s2.moveTo(-0.554, 0.146);
    s2.lineTo(0.554, 0.146);
    s2.lineTo(0.554, 1.002);
    s2.lineTo(0.354, 1.304);
    s2.lineTo(-0.354, 1.304);
    s2.lineTo(-0.554, 1.002);
    s2.closePath();
    const cg = new THREE.ExtrudeGeometry(s2, { depth: 0.025, bevelEnabled: false });
    cg.translate(0, 0, -0.0125);
    darkG.push(cg);
  }
  // rivets
  if (!low) {
    const rivY = [0.3, 0.45, 0.6, 0.75, 0.9];
    for (const ry of rivY) {
      gunG.push(xf(new THREE.SphereGeometry(0.008, 6, 4), 0.558, ry, 0.02));
      gunG.push(xf(new THREE.SphereGeometry(0.008, 6, 4), -0.558, ry, 0.02));
      gunG.push(xf(new THREE.SphereGeometry(0.008, 6, 4), 0.558, ry, -0.02));
      gunG.push(xf(new THREE.SphereGeometry(0.008, 6, 4), -0.558, ry, -0.02));
    }
    const baseRivZ = [-0.6, -0.2, 0.2, 0.6];
    for (const rz of baseRivZ) {
      gunG.push(xf(new THREE.SphereGeometry(0.008, 6, 4), 0.4, 0.26, rz));
      gunG.push(xf(new THREE.SphereGeometry(0.008, 6, 4), -0.4, 0.26, rz));
    }
  }
  // pyramid boss on front
  warmG.push(xf(new THREE.BoxGeometry(0.42, 0.42, 0.025), 0, 0.7, 0.8625));
  {
    const pyr = new THREE.ConeGeometry(0.2, 0.07, 4, 1);
    pyr.rotateY(Math.PI / 4);
    pyr.rotateX(Math.PI / 2);
    xf(pyr, 0, 0.7, 0.91);
    warmG.push(pyr);
  }
  if (!low) {
    for (const bx of [-0.18, 0.18]) {
      for (const by of [0.52, 0.88]) {
        gunG.push(xf(new THREE.CylinderGeometry(0.007, 0.007, 0.01, 6), bx, by, 0.876, Math.PI / 2, 0, 0));
      }
    }
  }

  // hopper
  const hopperMouth: [number, number, number] = [0, 1.613, 0.546];
  {
    const topR = 0.389;
    const botR = 0.212;
    const hg = new THREE.CylinderGeometry(topR, botR, 0.32, 4, 1, true);
    hg.rotateY(Math.PI / 4);
    hg.rotateX(0.21);
    xf(hg, 0, 1.46, 0.48);
    warmG.push(hg);
    const inner = new THREE.CylinderGeometry(topR * 0.92, botR * 0.9, 0.3, 4, 1, true);
    inner.rotateY(Math.PI / 4);
    inner.rotateX(0.21);
    xf(inner, 0, 1.455, 0.48);
    rubberG.push(inner);
  }
  rubberG.push(xf(new THREE.PlaneGeometry(0.28, 0.28), 0, 1.33, 0.45, -Math.PI / 2, 0, 0));
  if (!low) {
    darkG.push(xf(new THREE.BoxGeometry(0.6, 0.025, 0.03), 0, 1.613, 0.546 + 0.275));
    darkG.push(xf(new THREE.BoxGeometry(0.6, 0.025, 0.03), 0, 1.613, 0.546 - 0.275));
    darkG.push(xf(new THREE.BoxGeometry(0.03, 0.025, 0.6), 0.275, 1.613, 0.546));
    darkG.push(xf(new THREE.BoxGeometry(0.03, 0.025, 0.6), -0.275, 1.613, 0.546));
  }
  // ore chunks 10
  const oreCount = 10;
  for (let i = 0; i < oreCount; i++) {
    const r = 0.045 + hash01(i * 12.3 + 4) * 0.03;
    const det = low ? 0 : 1;
    const og = new THREE.IcosahedronGeometry(r, det);
    const px = (hash01(i * 3.1) - 0.5) * 0.36;
    const pz = 0.48 + (hash01(i * 5.7 + 2) - 0.5) * 0.32;
    const py = 1.6 + hash01(i * 7.9 + 1) * 0.12;
    const sx = 0.75 + hash01(i * 11.1) * 0.6;
    const sy = 0.6 + hash01(i * 13.7) * 0.5;
    const sz = 0.75 + hash01(i * 17.3) * 0.6;
    og.scale(sx, sy, sz);
    og.rotateY(hash01(i * 19.1) * Math.PI * 2);
    og.rotateX(hash01(i * 23.7) * 0.8);
    og.translate(px, py, pz);
    oreG.push(og);
  }

  // stack
  const stackTop: [number, number, number] = [0, 1.86, -0.55];
  darkG.push(xf(new THREE.CylinderGeometry(0.13, 0.14, 0.03, segCyl), 0, 1.315, -0.55));
  warmG.push(xf(new THREE.CylinderGeometry(0.095, 0.105, 0.5, segCyl), 0, 1.58, -0.55));
  darkG.push(xf(new THREE.CylinderGeometry(0.105, 0.105, 0.03, segCyl), 0, 1.35, -0.55));
  if (!low) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const sx = Math.cos(a) * 0.096;
      const sz = -0.55 + Math.sin(a) * 0.096;
      const slot = new THREE.BoxGeometry(0.018, 0.25, 0.012);
      slot.rotateY(-a + Math.PI / 2);
      xf(slot, sx, 1.58, sz);
      rubberG.push(slot);
    }
    gunG.push(xf(new THREE.CylinderGeometry(0.105, 0.105, 0.025, segCyl), 0, 1.8425, -0.55));
    for (let i = -2; i <= 2; i++) {
      gunG.push(xf(new THREE.BoxGeometry(0.19, 0.012, 0.022), 0, 1.858, -0.55 + i * 0.035));
    }
    gunG.push(xf(new THREE.CylinderGeometry(0.02, 0.02, 0.025, 10), 0, 1.862, -0.55));
  } else {
    gunG.push(xf(new THREE.CylinderGeometry(0.105, 0.105, 0.025, segSmall), 0, 1.8425, -0.55));
  }

  // cartridge slot left
  gunG.push(xf(new THREE.BoxGeometry(0.02, 0.02, 0.34), -0.56, 0.93, 0.1));
  gunG.push(xf(new THREE.BoxGeometry(0.02, 0.02, 0.34), -0.56, 0.77, 0.1));
  gunG.push(xf(new THREE.BoxGeometry(0.02, 0.18, 0.02), -0.56, 0.85, 0.27));
  gunG.push(xf(new THREE.BoxGeometry(0.02, 0.18, 0.02), -0.56, 0.85, -0.07));
  rubberG.push(xf(new THREE.BoxGeometry(0.015, 0.12, 0.3), -0.555, 0.85, 0.1));
  cartG.push(xf(new THREE.BoxGeometry(0.24, 0.1, 0.26), -0.57, 0.85, 0.1));
  if (!low) {
    gunG.push(xf(new THREE.BoxGeometry(0.02, 0.03, 0.05), -0.68, 0.85, 0.1));
  }

  // service door right
  warmG.push(xf(new THREE.BoxGeometry(0.02, 0.7, 0.5), 0.56, 0.7, 0.0));
  if (!low) {
    darkG.push(xf(new THREE.BoxGeometry(0.015, 0.02, 0.54), 0.565, 1.06, 0.0));
    darkG.push(xf(new THREE.BoxGeometry(0.015, 0.02, 0.54), 0.565, 0.34, 0.0));
    darkG.push(xf(new THREE.BoxGeometry(0.015, 0.74, 0.02), 0.565, 0.7, 0.27));
    darkG.push(xf(new THREE.BoxGeometry(0.015, 0.74, 0.02), 0.565, 0.7, -0.27));
    gunG.push(xf(new THREE.BoxGeometry(0.02, 0.06, 0.03), 0.57, 0.5, -0.27));
    gunG.push(xf(new THREE.BoxGeometry(0.02, 0.06, 0.03), 0.57, 0.9, -0.27));
    gunG.push(xf(new THREE.BoxGeometry(0.025, 0.04, 0.04), 0.575, 0.7, 0.18));
    copperG.push(xf(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), 0.59, 0.7, 0.18));
  }
  labelG.push(xf(new THREE.BoxGeometry(0.012, 0.12, 0.2), 0.568, 1.02, 0.0));

  // gland + cable stub
  copperG.push(xf(new THREE.CylinderGeometry(0.032, 0.032, 0.045, segSmall), 0.56, 0.35, -0.6, 0, 0, Math.PI / 2));
  copperG.push(xf(new THREE.CylinderGeometry(0.04, 0.04, 0.02, segSmall), 0.545, 0.35, -0.6, 0, 0, Math.PI / 2));
  rubberG.push(xf(new THREE.CylinderGeometry(0.024, 0.024, 0.35, segSmall), 0.585, 0.175, -0.6));
  rubberG.push(xf(new THREE.SphereGeometry(0.024, 8, 6), 0.585, 0.35, -0.6));

  // rear vents high only
  if (!low) {
    for (let i = 0; i < 5; i++) {
      darkG.push(xf(new THREE.BoxGeometry(0.4, 0.015, 0.012), 0, 0.5 + i * 0.05, -0.856));
    }
    const eye1 = new THREE.TorusGeometry(0.03, 0.008, 8, 12);
    eye1.rotateY(Math.PI / 2);
    xf(eye1, 0, 1.33, 0.3);
    gunG.push(eye1);
    const eye2 = new THREE.TorusGeometry(0.03, 0.008, 8, 12);
    eye2.rotateY(Math.PI / 2);
    xf(eye2, 0, 1.33, -0.3);
    gunG.push(eye2);
  }

  // status lamp base
  gunG.push(xf(new THREE.CylinderGeometry(0.025, 0.028, 0.02, segSmall), 0.25, 1.31, -0.65));

  const group = new THREE.Group();
  const addM = (geos: THREE.BufferGeometry[], mat: THREE.Material): void => {
    const mh = meshFrom(geos, mat);
    if (mh) group.add(mh);
  };
  addM(warmG, warmMat);
  addM(darkG, darkMat);
  addM(gunG, gunMat);
  addM(rubberG, rubberMat);
  addM(hazardG, hazardMat);
  addM(copperG, copperMat);
  addM(oreG, oreMat);
  addM(cartG, cartMat);
  addM(labelG, labelMat);

  const lampMat = low ? flatClone(lampMaterial(0xffaa22)) : lampMaterial(0xffaa22);
  const lampSegW = low ? 8 : 16;
  const lampSegH = low ? 6 : 12;
  const lampGeo = new THREE.SphereGeometry(0.02, lampSegW, lampSegH);
  xf(lampGeo, 0.25, 1.335, -0.65);
  const lampMesh = new THREE.Mesh(lampGeo.index ? lampGeo.toNonIndexed() : lampGeo, lampMat);
  group.add(lampMesh);

  const bb = new THREE.Box3().setFromObject(group);
  const colliders: Box[] = [{ min: [bb.min.x, 0, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z] }];
  const sockets: Socket[] = [
    { name: 'hopper', at: hopperMouth },
    { name: 'stack', at: stackTop },
    { name: 'power', at: [0.585, 0.35, -0.6] },
  ];
  return { group, colliders, sockets, lamps: [lampMesh] };
}
