import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ============================================================================
 * FIELD KIT — concept sheet 12: six terraforming field machines.
 * Everything is procedural geometry, no DOM, no Date, no Math.random.
 * Stage 0/1 = chunky flat-shaded low poly. Stage 6 = full detail (default).
 * ==========================================================================*/

export interface Box { min: [number, number, number]; max: [number, number, number] }
export interface Socket { name: string; at: [number, number, number] }
export interface Prop { group: THREE.Group; colliders: Box[]; sockets: Socket[]; lamps: THREE.Mesh[] }

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

type V3 = [number, number, number];

type PalKey =
  | 'gunmetal' | 'darkSteel' | 'paint' | 'copper' | 'rubber' | 'hazard' | 'glass' | 'concrete'
  | 'ore' | 'cartG' | 'cartA' | 'cartC';
type Pal = Record<PalKey, THREE.Material>;

/* ---------------- deterministic data textures (typed arrays only) ---------------- */

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 144665) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function dataTex(size: number, px: (x: number, y: number) => [number, number, number]): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px(x, y);
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, Math.round(r)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

const hazardTex = dataTex(64, (x, y) => (((x + y) >> 5) & 1 ? [236, 176, 12] : [25, 26, 28]));
const concreteTex = dataTex(64, (x, y) => {
  const n = (hash2(x, y) - 0.5) * 30;
  const m = (hash2(x + 31, y + 17) - 0.5) * 14;
  return [141 + n + m, 136 + n + m, 122 + n + m];
});
const stripeTex = (rgb: [number, number, number]) => dataTex(32, (x) => ((x >> 2) & 1 ? rgb : [228, 225, 214]));

/* ---------------- materials ---------------- */

export function createMaterials(): LabMaterials {
  return {
    gunmetal: new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.85, roughness: 0.48 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x2f3439, metalness: 0.8, roughness: 0.6 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xc9b388, metalness: 0.3, roughness: 0.55 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb5723f, metalness: 1.0, roughness: 0.35 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1a1b1e, metalness: 0.0, roughness: 0.92 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTex, color: 0xffffff, metalness: 0.1, roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xa9d6df, metalness: 0.0, roughness: 0.08, transparent: true, opacity: 0.45 }),
    concrete: new THREE.MeshStandardMaterial({ map: concreteTex, color: 0xffffff, metalness: 0.0, roughness: 0.95 }),
  };
}

let ownCache: Record<'ore' | 'cartG' | 'cartA' | 'cartC', THREE.MeshStandardMaterial> | null = null;
function ownMats(): Record<'ore' | 'cartG' | 'cartA' | 'cartC', THREE.MeshStandardMaterial> {
  if (ownCache) return ownCache;
  ownCache = {
    ore: new THREE.MeshStandardMaterial({ color: 0x6a5f52, roughness: 0.96, metalness: 0.05, flatShading: true }),
    cartG: new THREE.MeshStandardMaterial({ map: stripeTex([124, 255, 77]), roughness: 0.5, metalness: 0.05 }),
    cartA: new THREE.MeshStandardMaterial({ map: stripeTex([255, 193, 61]), roughness: 0.5, metalness: 0.05 }),
    cartC: new THREE.MeshStandardMaterial({ map: stripeTex([61, 200, 255]), roughness: 0.5, metalness: 0.05 }),
  };
  return ownCache;
}

function palette(m: LabMaterials, low: boolean): Pal {
  const own = ownMats();
  const all: Pal = {
    gunmetal: m.gunmetal, darkSteel: m.darkSteel, paint: m.paint, copper: m.copper,
    rubber: m.rubber, hazard: m.hazard, glass: m.glass, concrete: m.concrete,
    ore: own.ore, cartG: own.cartG, cartA: own.cartA, cartC: own.cartC,
  };
  if (!low) return all;
  const flat = {} as Pal;
  (Object.keys(all) as PalKey[]).forEach((key) => {
    const c = (all[key] as THREE.MeshStandardMaterial).clone() as THREE.MeshStandardMaterial;
    c.flatShading = true;
    c.needsUpdate = true;
    flat[key] = c;
  });
  return flat;
}

/* ---------------- geometry kit: collects per-material geos and merges ---------------- */

class Kit {
  private buckets = new Map<PalKey, THREE.BufferGeometry[]>();
  constructor(private pal: Pal, private low: boolean, readonly group: THREE.Group) {}

  add(key: PalKey, geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    const list = this.buckets.get(key);
    if (list) list.push(g);
    else this.buckets.set(key, [g]);
  }

  addQ(key: PalKey, geo: THREE.BufferGeometry, x: number, y: number, z: number, q: THREE.Quaternion): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)),
    );
    const list = this.buckets.get(key);
    if (list) list.push(g);
    else this.buckets.set(key, [g]);
  }

  box(w: number, h: number, d: number): THREE.BoxGeometry {
    return new THREE.BoxGeometry(w, h, d);
  }

  /** chamfered slab: shape a(b) extruded t along local z, bevel c on all long edges */
  cham(a: number, b: number, t: number, c: number): THREE.BufferGeometry {
    const hw = a / 2 - c, hb = b / 2 - c;
    const s = new THREE.Shape();
    s.moveTo(-hw + c, -hb);
    s.lineTo(hw - c, -hb);
    s.lineTo(hw, -hb + c);
    s.lineTo(hw, hb - c);
    s.lineTo(hw - c, hb);
    s.lineTo(-hw + c, hb);
    s.lineTo(-hw, hb - c);
    s.lineTo(-hw, -hb + c);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: t - 2 * c, bevelEnabled: true, bevelSegments: 1, bevelSize: c, bevelThickness: c, curveSegments: 1,
    });
    g.translate(0, 0, -(t / 2 - c));
    return g;
  }

  cyl(rt: number, rb: number, h: number, seg = this.low ? 6 : 12, open = false): THREE.CylinderGeometry {
    return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  }
  cone(r: number, h: number, seg = this.low ? 6 : 12): THREE.ConeGeometry {
    return new THREE.ConeGeometry(r, h, seg);
  }
  torus(r: number, t: number): THREE.TorusGeometry {
    return new THREE.TorusGeometry(r, t, this.low ? 3 : 4, this.low ? 8 : 14);
  }
  icosa(r: number, detail = this.low ? 0 : 1): THREE.IcosahedronGeometry {
    return new THREE.IcosahedronGeometry(r, detail);
  }
  tube(pts: number[][], r: number, seg?: number, rs?: number): THREE.TubeGeometry {
    const vs = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(vs);
    return new THREE.TubeGeometry(curve, seg ?? (this.low ? 8 : 14), r, rs ?? (this.low ? 3 : 5), false);
  }

  finish(): void {
    for (const [key, list] of this.buckets) {
      const merged = mergeGeometries(list, false);
      if (merged) this.group.add(new THREE.Mesh(merged, this.pal[key]));
    }
  }
}

/* ---------------- lamps (separate emissive meshes) ---------------- */

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material as THREE.MeshStandardMaterial;
  mat.emissiveIntensity = Math.min(1, Math.max(0, glow));
}

function makeLamp(low: boolean, r: number, color: number, x: number, y: number, z: number, parent: THREE.Group, rx = 0): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x181108, emissive: new THREE.Color(color), emissiveIntensity: 0.7,
    roughness: 0.35, metalness: 0.15, flatShading: low,
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.25, r * 1.6, low ? 5 : 8), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  parent.add(mesh);
  return mesh;
}

export function triangles(p: Prop): number {
  let n = 0;
  p.group.traverse((o) => {
    const ms = o as THREE.Mesh;
    if (ms.isMesh) {
      const g = ms.geometry;
      n += (g.index ? g.index.count : g.attributes.position!.count) / 3;
    }
  });
  return Math.round(n);
}

/* ============================================================================
 * 1. ROCK DRILL — four splayed legs, mast, electric auger (bit spins about y),
 *    ore tray out front, cable gland low at the back, amber status lamp.
 * ==========================================================================*/

export function rockDrill(m: LabMaterials, o?: { stage?: number }): Prop & { bit: THREE.Object3D } {
  const low = (o?.stage ?? 6) <= 1;
  const pal = palette(m, low);
  const group = new THREE.Group();
  group.name = 'rockDrill';
  const k = new Kit(pal, low, group);
  const lamps: THREE.Mesh[] = [];

  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      k.add('darkSteel', k.cham(0.2, 1.2, 0.2, 0.03), sx * 0.83, 0.62, sz * 0.83, sz > 0 ? -0.16 : 0.16, 0, sx > 0 ? 0.16 : -0.16);
      k.add('concrete', k.box(0.46, 0.07, 0.46), sx * 0.96, 0.035, sz * 0.96);
      if (!low) {
        for (const bx of [1, -1]) {
          for (const bz of [1, -1]) {
            k.add('gunmetal', k.cyl(0.026, 0.026, 0.035, 6), sx * 0.96 + bx * 0.16, 0.075, sz * 0.96 + bz * 0.16);
          }
        }
      }
    }
  }

  k.add('paint', k.cham(1.5, 1.5, 0.14, 0.03), 0, 1.12, 0, Math.PI / 2);
  k.add('paint', k.cham(1.1, 1.1, 0.1, 0.02), 0, 0.55, 0, Math.PI / 2);
  // thin hazard trims are small parts: full detail only (stage 1 stays within half the triangles of stage 6)
  if (!low) {
    k.add('hazard', k.box(1.46, 0.028, 0.03), 0, 1.198, 0.73);
    k.add('hazard', k.box(1.46, 0.028, 0.03), 0, 1.198, -0.73);
    k.add('hazard', k.box(0.03, 0.028, 1.46), 0.73, 1.198, 0);
    k.add('hazard', k.box(0.03, 0.028, 1.46), -0.73, 1.198, 0);
  }

  k.add('darkSteel', k.cham(0.32, 2.1, 0.32, 0.04), 0, 2.17, -0.28);
  k.add('paint', k.cham(0.44, 0.44, 0.1, 0.025), 0, 3.27, -0.28, Math.PI / 2);
  if (!low) {
    k.add('darkSteel', k.box(0.04, 0.5, 0.3), 0.18, 1.5, -0.28);
    k.add('darkSteel', k.box(0.04, 0.5, 0.3), -0.18, 1.5, -0.28);
  }
  k.add('gunmetal', k.cham(0.34, 0.34, 0.24, 0.04), 0, 2.68, -0.28, Math.PI / 2);
  k.add('gunmetal', k.cyl(0.2, 0.2, 0.5, low ? 7 : 14), 0, 3.05, -0.28);
  k.add('gunmetal', k.cham(0.38, 0.38, 0.07, 0.02), 0, 3.335, -0.28, Math.PI / 2);
  if (!low) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.add('gunmetal', k.box(0.05, 0.36, 0.022), Math.cos(a) * 0.225, 3.03, -0.28 + Math.sin(a) * 0.225, 0, -a, 0);
    }
    k.add('copper', k.cyl(0.215, 0.215, 0.07, 14, true), 0, 2.83, -0.28);
  }

  k.add('paint', k.box(0.26, 0.2, 0.16), 0.5, 1.27, 0.3);
  if (!low) {
    k.add('gunmetal', k.cyl(0.045, 0.045, 0.03, 8), 0.5, 1.3, 0.39, Math.PI / 2);
    k.add('glass', k.cyl(0.038, 0.038, 0.02, 8), 0.5, 1.3, 0.4, Math.PI / 2);
    k.add('darkSteel', k.box(0.008, 0.05, 0.01), 0.5, 1.31, 0.405);
  }
  k.add('gunmetal', k.box(0.035, 0.05, 0.035), -0.55, 1.225, 0.6);
  lamps.push(makeLamp(low, 0.045, 0xffb340, -0.55, 1.29, 0.6, group));

  k.add('paint', k.box(0.74, 0.05, 0.52), 0, 0.42, 0.8);
  k.add('paint', k.box(0.04, 0.18, 0.52), 0.37, 0.5, 0.8);
  k.add('paint', k.box(0.04, 0.18, 0.52), -0.37, 0.5, 0.8);
  k.add('paint', k.box(0.78, 0.14, 0.04), 0, 0.48, 1.06);
  k.add('paint', k.box(0.78, 0.1, 0.04), 0, 0.46, 0.54);
  k.add('darkSteel', k.box(0.05, 0.42, 0.05), 0.3, 0.21, 0.95);
  k.add('darkSteel', k.box(0.05, 0.42, 0.05), -0.3, 0.21, 0.95);
  const ore: [number, number, number, number][] = [
    [0.08, 0.52, 0.74, 0.13], [-0.16, 0.5, 0.82, 0.1], [0.12, 0.56, 0.88, 0.09],
    [-0.02, 0.58, 0.78, 0.08], [0.2, 0.49, 0.72, 0.07],
  ];
  // two chunks at stage 1 keep the chunky drill within its 1 200 triangles
  const nOre = low ? 2 : 5;
  for (let i = 0; i < nOre; i++) {
    const c = ore[i]!;
    k.add('ore', k.icosa(c[3], 0), c[0], c[1], c[2], 0, i * 0.8, 0);
  }

  k.add('gunmetal', k.box(0.22, 0.18, 0.14), 0, 0.45, -0.83);
  k.add('gunmetal', k.cyl(0.045, 0.045, 0.08, 8), 0, 0.45, -0.94, Math.PI / 2);
  k.add('gunmetal', k.cyl(0.055, 0.055, 0.035, 6), 0, 0.45, -0.99, Math.PI / 2);
  k.add('rubber', k.tube([[0, 0.45, -1.0], [0.08, 0.25, -1.15], [0.25, 0.05, -1.3]], 0.024));

  const bit = new THREE.Group();
  bit.name = 'bit';
  bit.position.set(0, 2.42, -0.06);
  const kb = new Kit(pal, low, bit);
  kb.add('gunmetal', kb.cham(0.3, 0.3, 0.18, 0.03), 0, 0.05, 0, Math.PI / 2);
  kb.add('darkSteel', kb.cyl(0.045, 0.05, 2.15, low ? 6 : 10), 0, -0.85, 0);
  const hp: number[][] = [];
  const nPts = low ? 10 : 22;
  for (let i = 0; i <= nPts; i++) {
    const t = i / nPts;
    const a = t * 2.2 * Math.PI * 2;
    hp.push([Math.cos(a) * 0.17, -0.15 - t * 1.9, Math.sin(a) * 0.17]);
  }
  kb.add('darkSteel', kb.tube(hp, 0.03, low ? 14 : 36), 0, 0, 0);
  kb.add('darkSteel', kb.cone(0.17, 0.16, low ? 6 : 10), 0, -2.21, 0, Math.PI);
  kb.finish();
  group.add(bit);

  k.finish();
  return {
    group,
    bit,
    colliders: [{ min: [-1.05, 0, -1.05], max: [1.05, 3.4, 1.1] }],
    sockets: [
      { name: 'tray', at: [0, 0.55, 0.78] },
      { name: 'power', at: [0, 0.45, -0.97] },
    ],
    lamps,
  };
}

/* ============================================================================
 * 2. SHAPE PRESS — low wide frame on an anchored base plate, two vertical
 *    hydraulic rams over the die bed, sloped side feed, rear-top exhaust
 *    grille, green cartridge slot up front, cable gland low at the back.
 * ==========================================================================*/

export function shapePress(m: LabMaterials, o?: { stage?: number }): Prop & { rams: THREE.Object3D[] } {
  const low = (o?.stage ?? 6) <= 1;
  const pal = palette(m, low);
  const group = new THREE.Group();
  group.name = 'shapePress';
  const k = new Kit(pal, low, group);
  const lamps: THREE.Mesh[] = [];

  k.add('concrete', k.cham(2.2, 1.6, 0.1, 0.02), 0, 0.05, 0, Math.PI / 2);
  k.add('paint', k.cham(2.0, 1.4, 0.12, 0.04), 0, 0.16, 0, Math.PI / 2);
  if (!low) {
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) k.add('gunmetal', k.cyl(0.045, 0.045, 0.05, 8), sx * 0.9, 0.25, sz * 0.6);
    }
  }
  k.add('darkSteel', k.cham(0.18, 0.88, 0.18, 0.03), 0.85, 0.66, 0);
  k.add('darkSteel', k.cham(0.18, 0.88, 0.18, 0.03), -0.85, 0.66, 0);
  k.add('gunmetal', k.cham(1.9, 0.5, 0.24, 0.04), 0, 1.22, 0, Math.PI / 2);
  k.add('darkSteel', k.box(1.82, 0.1, 0.12), 0, 0.3, 0.62);
  k.add('darkSteel', k.box(1.82, 0.1, 0.12), 0, 0.3, -0.62);
  if (!low) {
    k.add('darkSteel', k.box(0.14, 0.2, 0.05), 0.85, 1.0, 0);
    k.add('darkSteel', k.box(0.14, 0.2, 0.05), -0.85, 1.0, 0);
  }
  k.add('paint', k.cham(1.3, 0.8, 0.08, 0.02), 0, 0.58, 0, Math.PI / 2);
  k.add('gunmetal', k.cham(0.42, 0.42, 0.08, 0.025), 0, 0.66, 0, Math.PI / 2);

  const rams: THREE.Object3D[] = [];
  for (const sx of [1, -1]) {
    const ram = new THREE.Group();
    ram.name = 'ram';
    ram.position.set(sx * 0.45, 0.9, 0);
    const kr = new Kit(pal, low, ram);
    kr.add('gunmetal', kr.cyl(0.09, 0.09, 0.3, low ? 7 : 14), 0, 0.09, 0);
    if (!low) {
      kr.add('gunmetal', kr.cyl(0.115, 0.115, 0.07, 10), 0, 0.24, 0);
      kr.add('gunmetal', kr.cyl(0.06, 0.06, 0.04, 8), 0, -0.06, 0);
    }
    kr.add('darkSteel', kr.cyl(0.04, 0.04, 0.16, low ? 6 : 8), 0, -0.02, 0);
    kr.add('darkSteel', kr.cham(0.5, 0.36, 0.06, 0.015), 0, -0.1, 0, Math.PI / 2);
    kr.finish();
    rams.push(ram);
    group.add(ram);
  }

  k.add('gunmetal', k.cham(0.9, 0.3, 0.26, 0.04), 0, 1.42, -0.34, Math.PI / 2);
  if (!low) {
    for (let i = 0; i < 8; i++) k.add('darkSteel', k.box(0.86, 0.028, 0.024), 0, 1.33 + i * 0.03, -0.49);
    k.add('gunmetal', k.box(0.04, 0.3, 0.26), 0.47, 1.42, -0.34);
    k.add('gunmetal', k.box(0.04, 0.3, 0.26), -0.47, 1.42, -0.34);
  }

  const trayX = 1.05, trayY = 0.72, trayZ = 0.2, tilt = -0.4;
  k.add('paint', k.box(0.38, 0.03, 0.52), trayX, trayY, trayZ, 0, 0, tilt);
  k.add('paint', k.box(0.38, 0.1, 0.035), trayX, trayY + 0.06, trayZ + 0.26, 0, 0, tilt);
  k.add('paint', k.box(0.38, 0.1, 0.035), trayX, trayY + 0.06, trayZ - 0.26, 0, 0, tilt);
  k.add('paint', k.box(0.035, 0.1, 0.52), trayX + 0.19, trayY + 0.06, trayZ, 0, 0, tilt);
  const rock: [number, number, number, number][] = [
    [0.94, 0.8, 0.08, 0.07], [1.1, 0.78, 0.22, 0.06], [0.9, 0.78, 0.32, 0.065],
    [1.18, 0.74, 0.1, 0.055], [1.0, 0.84, 0.14, 0.06], [0.97, 0.77, 0.4, 0.05],
  ];
  const nRock = low ? 4 : 6;
  for (let i = 0; i < nRock; i++) {
    const c = rock[i]!;
    k.add('ore', k.icosa(c[3], 0), c[0], c[1], c[2], 0, i * 0.7, 0);
  }
  k.add('darkSteel', k.box(0.04, 0.3, 0.08), 1.24, 0.5, 0.02);
  k.add('darkSteel', k.box(0.04, 0.3, 0.08), 1.24, 0.5, 0.38);

  k.add('gunmetal', k.box(0.5, 0.32, 0.06), 0, 0.85, 0.72);
  k.add('cartG', k.box(0.34, 0.18, 0.07), 0, 0.85, 0.74);
  k.add('hazard', k.box(0.42, 0.03, 0.025), 0, 0.7, 0.755);
  k.add('hazard', k.box(0.42, 0.03, 0.025), 0, 1.0, 0.755);

  k.add('gunmetal', k.box(0.2, 0.18, 0.12), 0, 0.4, -0.7);
  k.add('gunmetal', k.cyl(0.04, 0.04, 0.07, 8), 0, 0.4, -0.8, Math.PI / 2);
  k.add('gunmetal', k.cyl(0.05, 0.05, 0.03, 6), 0, 0.4, -0.85, Math.PI / 2);
  k.add('rubber', k.tube([[0, 0.4, -0.87], [0.1, 0.15, -1.05], [0.28, 0.03, -1.15]], 0.024));

  k.add('paint', k.box(0.32, 0.2, 0.14), -0.62, 0.95, 0.55, -0.25, 0, 0);
  if (!low) {
    for (const gx of [-0.68, -0.56]) {
      k.add('gunmetal', k.cyl(0.042, 0.042, 0.025, 8), gx, 0.98, 0.615, Math.PI / 2);
      k.add('glass', k.cyl(0.035, 0.035, 0.018, 8), gx, 0.98, 0.622, Math.PI / 2);
      k.add('darkSteel', k.box(0.007, 0.045, 0.008), gx, 0.99, 0.628);
    }
    for (const bx of [-0.7, -0.62, -0.54]) k.add('gunmetal', k.box(0.02, 0.02, 0.02), bx, 0.88, 0.6);
  }

  if (!low) {
    k.add('rubber', k.tube([[-0.7, 1.05, -0.25], [-0.88, 0.7, -0.5], [-0.75, 0.3, -0.62]], 0.022));
    k.add('rubber', k.tube([[0.7, 1.05, -0.25], [0.88, 0.7, -0.5], [0.75, 0.3, -0.62]], 0.022));
    for (const sx of [1, -1]) {
      k.add('gunmetal', k.cyl(0.035, 0.035, 0.05, 6), sx * 0.75, 0.28, -0.62);
      k.add('gunmetal', k.cyl(0.035, 0.035, 0.05, 6), sx * 0.88, 0.72, -0.5);
    }
  }
  k.add('hazard', k.box(1.9, 0.035, 0.025), 0, 0.25, 0.71);
  k.add('hazard', k.box(1.9, 0.035, 0.025), 0, 0.25, -0.71);
  lamps.push(makeLamp(low, 0.04, 0xffb340, 0.62, 1.44, 0.26, group));

  k.finish();
  return {
    group,
    rams,
    colliders: [{ min: [-1.05, 0, -0.8], max: [1.3, 1.6, 0.8] }],
    sockets: [
      { name: 'feed', at: [1.0, 0.78, 0.2] },
      { name: 'vent', at: [0, 1.42, -0.5] },
      { name: 'power', at: [0, 0.4, -0.85] },
    ],
    lamps,
  };
}

/* ============================================================================
 * 3. LIGHT PROJECTOR — tripod mast, faceted lamp head tilted up (head tilts
 *    about x), glowing front lens, vent grilles on the back rim, base housing
 *    with amber cartridge, ladder strip, cable gland on the base.
 * ==========================================================================*/

export function lightProjector(m: LabMaterials, o?: { stage?: number }): Prop & { head: THREE.Object3D } {
  const low = (o?.stage ?? 6) <= 1;
  const pal = palette(m, low);
  const group = new THREE.Group();
  group.name = 'lightProjector';
  const k = new Kit(pal, low, group);
  const lamps: THREE.Mesh[] = [];

  const dirs: [number, number][] = [[0, 1], [-0.866, -0.5], [0.866, -0.5]];
  for (const [dx, dz] of dirs) {
    const yaw = Math.atan2(dx, dz);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.36));
    k.addQ('darkSteel', k.cham(0.14, 1.7, 0.14, 0.025), dx * 0.31, 0.85, dz * 0.31, q);
    k.add('concrete', k.box(0.36, 0.06, 0.36), dx * 0.6, 0.03, dz * 0.6);
    if (!low) {
      const ex = Math.cos(yaw), exz = -Math.sin(yaw);
      for (const [lx, lz] of [[0.12, 0.06], [-0.06, 0.12], [-0.06, -0.12]] as [number, number][]) {
        k.add('gunmetal', k.cyl(0.022, 0.022, 0.03, 6), dx * 0.6 + ex * lx + dx * lz, 0.07, dz * 0.6 + exz * lx + dz * lz);
      }
    }
  }

  k.add('gunmetal', k.cyl(0.11, 0.13, 0.34, low ? 6 : 12), 0, 1.62, 0);
  if (!low) {
    for (const a of [0.52, 2.62, 4.72]) {
      k.add('darkSteel', k.box(0.5, 0.035, 0.035), Math.cos(a) * 0.3, 1.25, Math.sin(a) * 0.3, 0, -a, 0);
    }
  }
  k.add('gunmetal', k.cham(0.09, 0.78, 0.09, 0.018), 0, 2.03, 0);
  k.add('darkSteel', k.box(0.025, 0.7, 0.025), 0.07, 1.95, 0.07);
  k.add('darkSteel', k.box(0.025, 0.7, 0.025), -0.07, 1.95, 0.07);
  const nRung = low ? 3 : 5;
  for (let i = 0; i < nRung; i++) k.add('darkSteel', k.box(0.11, 0.018, 0.018), 0, 1.72 + i * 0.14, 0.075);

  k.add('paint', k.cham(0.56, 0.56, 0.44, 0.04), 0, 0.36, 0, Math.PI / 2);
  k.add('gunmetal', k.cham(0.6, 0.6, 0.06, 0.02), 0, 0.61, 0, Math.PI / 2);
  if (!low) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      k.add('gunmetal', k.cyl(0.022, 0.022, 0.025, 6), Math.cos(a) * 0.24, 0.645, Math.sin(a) * 0.24);
    }
  }
  k.add('gunmetal', k.box(0.3, 0.22, 0.05), 0, 0.34, 0.235);
  k.add('cartA', k.box(0.2, 0.13, 0.05), 0, 0.34, 0.255);
  k.add('hazard', k.box(0.26, 0.025, 0.02), 0, 0.255, 0.26);
  k.add('gunmetal', k.cyl(0.045, 0.045, 0.07, 8), 0, 0.24, -0.24, Math.PI / 2);
  k.add('gunmetal', k.cyl(0.055, 0.055, 0.03, 6), 0, 0.24, -0.285, Math.PI / 2);
  k.add('rubber', k.tube([[0, 0.24, -0.3], [0.1, 0.1, -0.5], [0.28, 0.03, -0.62]], 0.022));

  k.add('gunmetal', k.box(0.1, 0.14, 0.06), 0.44, 2.28, 0);
  k.add('gunmetal', k.box(0.1, 0.14, 0.06), -0.44, 2.28, 0);
  k.add('gunmetal', k.cyl(0.04, 0.04, 1.04, 8), 0, 2.28, 0, 0, 0, Math.PI / 2);

  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 2.28, 0);
  head.rotation.x = -0.55;
  const kh = new Kit(pal, low, head);
  kh.add('paint', kh.icosa(0.42), 0, 0, 0);
  kh.add('gunmetal', kh.torus(0.3, 0.05), 0, 0, -0.3);
  const nSlat = low ? 0 : 12;
  for (let i = 0; i < nSlat; i++) {
    const a = (i / nSlat) * Math.PI * 2;
    kh.add('darkSteel', kh.box(0.03, 0.17, 0.028), Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.36, 0, -a, 0);
  }
  kh.add('gunmetal', kh.cyl(0.31, 0.31, 0.08, low ? 6 : 12), 0, 0, 0.33, Math.PI / 2);
  kh.add('glass', kh.cyl(0.27, 0.27, 0.05, low ? 6 : 12), 0, 0, 0.38, Math.PI / 2);
  if (!low) {
    for (const a of [2.1, 2.6, 3.14, 3.68, 4.18, 4.7]) {
      kh.add('darkSteel', kh.box(0.02, 0.38, 0.12), Math.cos(a) * 0.44, Math.sin(a) * 0.44, -0.08, 0, -a, 0);
    }
  }
  kh.finish();
  lamps.push(makeLamp(low, 0.23, 0xfff0c8, 0, 0, 0.415, head, Math.PI / 2));
  group.add(head);

  lamps.push(makeLamp(low, 0.04, 0xffb340, 0.31, 0.64, 0.12, group));

  k.finish();
  return {
    group,
    head,
    colliders: [{ min: [-0.75, 0, -0.75], max: [0.75, 2.8, 0.8] }],
    sockets: [
      { name: 'vent', at: [0, 2.12, -0.27] },
      { name: 'power', at: [0, 0.24, -0.29] },
    ],
    lamps,
  };
}

/* ============================================================================
 * 4. WATER MAKER — ribbed condenser tank in a cradle on four feet, side intake
 *    hopper, top-rear vent, cyan cartridge, gauge and copper pipe runs.
 * ==========================================================================*/

export function waterMaker(m: LabMaterials, o?: { stage?: number }): Prop {
  const low = (o?.stage ?? 6) <= 1;
  const pal = palette(m, low);
  const group = new THREE.Group();
  group.name = 'waterMaker';
  const k = new Kit(pal, low, group);
  const lamps: THREE.Mesh[] = [];

  k.add('paint', k.cyl(0.45, 0.45, 2.4, low ? 7 : 16), 0, 0.62, -0.1, Math.PI / 2);
  const ribs = low ? 3 : 5;
  for (let i = 0; i < ribs; i++) {
    k.add('gunmetal', k.cyl(0.47, 0.47, 0.05, low ? 7 : 16, true), 0, 0.62, -1.0 + i * (2.0 / (low ? 2 : 4)), Math.PI / 2);
  }
  k.add('paint', k.cone(0.45, 0.24, low ? 7 : 16), 0, 0.62, 1.22, Math.PI / 2);
  k.add('paint', k.cone(0.45, 0.24, low ? 7 : 16), 0, 0.62, -1.42, -Math.PI / 2);
  for (const sz of [1, -1]) k.add('gunmetal', k.cyl(0.5, 0.5, 0.14, low ? 7 : 16, true), 0, 0.62, sz * 0.55, Math.PI / 2);

  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      k.add('darkSteel', k.cham(0.16, 0.42, 0.16, 0.025), sx * 0.6, 0.21, sz * 0.85);
      k.add('concrete', k.box(0.34, 0.05, 0.34), sx * 0.6, 0.025, sz * 0.85);
    }
  }
  k.add('darkSteel', k.box(0.08, 0.07, 1.9), 0.6, 0.44, 0);
  k.add('darkSteel', k.box(0.08, 0.07, 1.9), -0.6, 0.44, 0);
  if (!low) {
    k.add('darkSteel', k.box(1.28, 0.05, 0.06), 0, 0.44, 0.85);
    k.add('darkSteel', k.box(1.28, 0.05, 0.06), 0, 0.44, -0.85);
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) k.add('darkSteel', k.box(0.16, 0.05, 0.14), sx * 0.56, 0.14, sz * 0.55);
    }
  }

  k.add('darkSteel', k.cone(0.3, 0.34, low ? 6 : 12), 0.82, 0.95, 0.3, Math.PI);
  k.add('darkSteel', k.box(0.14, 0.28, 0.14), 0.62, 0.72, 0.3, 0, 0, -0.5);
  k.add('gunmetal', k.cyl(0.12, 0.12, 0.05, low ? 6 : 10), 0.52, 0.66, 0.3, 0, 0, Math.PI / 2);
  const gravel: [number, number, number, number][] = [
    [0.8, 1.02, 0.24, 0.07], [0.89, 1.0, 0.35, 0.06], [0.76, 1.05, 0.32, 0.055],
  ];
  const nGravel = low ? 2 : 3;
  for (let i = 0; i < nGravel; i++) {
    const c = gravel[i]!;
    k.add('ore', k.icosa(c[3], 0), c[0], c[1], c[2], 0, i * 0.9, 0);
  }

  k.add('gunmetal', k.cyl(0.07, 0.07, 0.44, low ? 6 : 10), -0.15, 1.1, -0.95);
  k.add('gunmetal', k.cyl(0.1, 0.1, 0.04, low ? 6 : 10), -0.15, 1.36, -0.95);
  k.add('gunmetal', k.cone(0.12, 0.09, low ? 6 : 10), -0.15, 1.44, -0.95);
  if (!low) {
    k.add('darkSteel', k.box(0.17, 0.025, 0.02), -0.15, 1.4, -0.86);
    k.add('darkSteel', k.box(0.17, 0.025, 0.02), -0.15, 1.4, -1.04);
    k.add('darkSteel', k.box(0.02, 0.025, 0.17), -0.06, 1.4, -0.95);
    k.add('darkSteel', k.box(0.02, 0.025, 0.17), -0.24, 1.4, -0.95);
  }

  k.add('darkSteel', k.box(0.07, 0.2, 0.22), 0, 0.36, 0.94);
  k.add('darkSteel', k.box(0.05, 0.28, 0.05), 0.06, 0.14, 0.94);
  k.add('darkSteel', k.box(0.05, 0.28, 0.05), -0.06, 0.14, 0.94);
  k.add('gunmetal', k.box(0.34, 0.24, 0.05), 0, 0.44, 0.95);
  k.add('cartC', k.box(0.24, 0.14, 0.05), 0, 0.44, 0.97);
  k.add('hazard', k.box(0.28, 0.025, 0.02), 0, 0.36, 0.98);

  k.add('gunmetal', k.cyl(0.02, 0.02, 0.14, 6), 0, 0.86, 0.42, Math.PI / 2);
  k.add('gunmetal', k.cyl(0.07, 0.07, 0.05, low ? 6 : 8), 0, 0.86, 0.52, Math.PI / 2);
  k.add('glass', k.cyl(0.055, 0.055, 0.02, low ? 6 : 8), 0, 0.86, 0.555, Math.PI / 2);
  if (!low) k.add('darkSteel', k.box(0.008, 0.045, 0.008), 0, 0.875, 0.562);

  k.add('copper', k.tube([[0.5, 0.64, 0.3], [0.4, 0.55, 0.55], [0.25, 0.48, 0.75]], 0.025));
  k.add('copper', k.tube([[-0.1, 0.3, -1.2], [-0.45, 0.22, -1.3], [-0.8, 0.16, -1.25], [-0.9, 0.3, -1.1]], 0.025));
  k.add('copper', k.box(0.08, 0.16, 0.08), -0.9, 0.32, -1.1);
  if (!low) {
    k.add('copper', k.torus(0.05, 0.014), 0.4, 0.55, 0.55);
    k.add('copper', k.cyl(0.05, 0.05, 0.03, 8), 0.42, 0.56, 0.5, Math.PI / 2);
    k.add('copper', k.cyl(0.05, 0.05, 0.03, 8), -0.5, 0.23, -1.3, Math.PI / 2);
  }

  k.add('gunmetal', k.cyl(0.045, 0.045, 0.07, 8), -0.66, 0.3, -0.85, 0, 0, Math.PI / 2);
  k.add('gunmetal', k.cyl(0.055, 0.055, 0.03, 6), -0.705, 0.3, -0.85, 0, 0, Math.PI / 2);
  k.add('rubber', k.tube([[-0.72, 0.3, -0.85], [-0.88, 0.16, -0.95], [-1.0, 0.03, -1.08]], 0.024));

  if (!low) {
    k.add('gunmetal', k.cyl(0.47, 0.47, 0.05, 16, true), 0, 0.62, 1.02, Math.PI / 2);
    for (const sz of [1, -1]) {
      for (const s of [1, -1]) k.add('gunmetal', k.cyl(0.022, 0.022, 0.04, 6), 0, 0.62 + s * 0.51, sz * 0.55, Math.PI / 2);
    }
    k.add('darkSteel', k.box(0.06, 0.16, 0.1), -0.45, 0.16, -1.3);
    k.add('darkSteel', k.box(0.06, 0.16, 0.1), -0.8, 0.12, -1.25);
    k.add('paint', k.box(0.18, 0.11, 0.012), 0, 0.82, 0.305);
    for (const px of [1, -1]) {
      for (const py of [1, -1]) k.add('gunmetal', k.box(0.014, 0.014, 0.008), px * 0.075, 0.82 + py * 0.045, 0.313);
    }
    k.add('darkSteel', k.box(0.14, 0.015, 0.015), 0.32, 0.5, 0.62, 0, 0.7, 0);
    k.add('darkSteel', k.box(0.14, 0.015, 0.015), 0.32, 0.5, 0.62, 0, -0.7, 0);
    k.add('darkSteel', k.box(0.02, 0.05, 0.02), 0.32, 0.5, 0.58);
    k.add('ore', k.icosa(0.05, 0), 0.45, 0.06, 0.55, 0, 0.5, 0);
    k.add('ore', k.icosa(0.04, 0), 0.38, 0.05, 0.62, 0, 1.2, 0);
  }

  lamps.push(makeLamp(low, 0.04, 0xffb340, 0.6, 0.52, 0.85, group));

  k.finish();
  return {
    group,
    colliders: [{ min: [-0.72, 0, -1.55], max: [1.15, 1.5, 1.1] }],
    sockets: [
      { name: 'feed', at: [0.82, 1.0, 0.3] },
      { name: 'vent', at: [-0.15, 1.42, -0.95] },
      { name: 'power', at: [-0.71, 0.3, -0.85] },
    ],
    lamps,
  };
}

/* ============================================================================
 * 5. POWER UNIT — boxy generator on a steel skid with anti-vibration feet,
 *    radiator grilles on the flanks, material-cell intake up front, short
 *    steam stack on top, twin output sockets low at the back, green lamps.
 * ==========================================================================*/

export function powerUnit(m: LabMaterials, o?: { stage?: number }): Prop {
  const low = (o?.stage ?? 6) <= 1;
  const pal = palette(m, low);
  const group = new THREE.Group();
  group.name = 'powerUnit';
  const k = new Kit(pal, low, group);
  const lamps: THREE.Mesh[] = [];

  k.add('darkSteel', k.box(0.12, 0.08, 2.0), 0.35, 0.09, 0);
  k.add('darkSteel', k.box(0.12, 0.08, 2.0), -0.35, 0.09, 0);
  for (const zz of [-0.85, 0, 0.85]) k.add('darkSteel', k.box(0.7, 0.06, 0.1), 0, 0.09, zz);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) k.add('rubber', k.box(0.2, 0.1, 0.2), sx * 0.35, 0.05, sz * 0.88);
  }

  k.add('paint', k.cham(1.35, 0.95, 0.72, 0.05), 0, 0.78, 0, Math.PI / 2);
  k.add('paint', k.cham(0.95, 0.6, 0.24, 0.04), 0, 1.24, -0.12, Math.PI / 2);
  k.add('gunmetal', k.cyl(0.32, 0.32, 0.22, low ? 7 : 14), 0, 0.78, -0.5, Math.PI / 2);
  k.add('gunmetal', k.cyl(0.345, 0.345, 0.05, low ? 7 : 14, true), 0, 0.78, -0.62, Math.PI / 2);
  if (!low) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.add('darkSteel', k.box(0.028, 0.44, 0.028), Math.cos(a) * 0.16, 0.78 + Math.sin(a) * 0.16, -0.62, 0, -a, 0);
    }
    k.add('gunmetal', k.box(0.1, 0.14, 0.08), 0.3, 1.4, -0.12);
    k.add('gunmetal', k.cyl(0.05, 0.05, 0.16, 8), 0.48, 1.4, -0.12, 0, 0, Math.PI / 2);
  }
  for (const sx of [1, -1]) {
    k.add('darkSteel', k.box(0.03, 0.32, 0.42), sx * 0.69, 0.82, 0.2);
    if (!low) {
      for (let i = 0; i < 4; i++) k.add('darkSteel', k.box(0.02, 0.045, 0.4), sx * 0.68, 0.72 + i * 0.075, 0.2);
    }
  }
  k.add('copper', k.cyl(0.13, 0.13, 0.4, low ? 6 : 10), 0.52, 1.24, 0.35, 0, 0, Math.PI / 2);
  k.add('copper', k.cyl(0.055, 0.055, 0.04, low ? 6 : 8), 0.52, 1.39, 0.35);

  k.add('gunmetal', k.cone(0.26, 0.3, low ? 6 : 12), 0, 0.95, 0.72, Math.PI);
  k.add('darkSteel', k.box(0.12, 0.24, 0.1), 0, 0.75, 0.6, 0, 0, -0.35);
  k.add('hazard', k.box(0.2, 0.03, 0.03), 0, 0.83, 0.88);
  k.add('darkSteel', k.box(0.05, 0.3, 0.05), 0.25, 0.6, 0.55);
  k.add('darkSteel', k.box(0.05, 0.3, 0.05), -0.25, 0.6, 0.55);

  k.add('gunmetal', k.cyl(0.09, 0.09, 0.34, low ? 6 : 10), 0.35, 1.5, -0.35);
  k.add('gunmetal', k.cyl(0.125, 0.125, 0.05, low ? 6 : 10), 0.35, 1.6, -0.35);
  k.add('gunmetal', k.cone(0.13, 0.09, low ? 6 : 10), 0.35, 1.72, -0.35);
  if (!low) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      k.add('darkSteel', k.box(0.015, 0.06, 0.14), 0.35 + Math.cos(a) * 0.1, 1.6, -0.35 + Math.sin(a) * 0.1, 0, -a, 0);
    }
  }

  k.add('gunmetal', k.cham(0.72, 0.38, 0.08, 0.02), 0, 0.6, -0.62, Math.PI / 2);
  for (const sx of [1, -1]) {
    k.add('copper', k.cyl(0.07, 0.07, 0.1, low ? 6 : 10), sx * 0.18, 0.6, -0.7, Math.PI / 2);
    if (!low) k.add('gunmetal', k.cyl(0.055, 0.055, 0.04, 6), sx * 0.18, 0.6, -0.76, Math.PI / 2);
    k.add('rubber', k.tube(
      [[sx * 0.18, 0.6, -0.76], [sx * 0.22, 0.3, -0.95], [sx * 0.3, 0.04, -1.08]],
      0.03, low ? 8 : 14, low ? 3 : 4,
    ));
  }

  k.add('paint', k.box(0.34, 0.24, 0.1), 0.45, 1.22, 0.45, -0.2, 0, 0);
  if (!low) {
    for (const gx of [0.38, 0.52]) {
      k.add('gunmetal', k.cyl(0.04, 0.04, 0.025, 8), gx, 1.24, 0.51, Math.PI / 2);
      k.add('glass', k.cyl(0.033, 0.033, 0.018, 8), gx, 1.24, 0.518, Math.PI / 2);
      k.add('darkSteel', k.box(0.007, 0.042, 0.008), gx, 1.25, 0.524);
    }
    for (const bx of [0.36, 0.45, 0.54]) k.add('gunmetal', k.box(0.02, 0.02, 0.02), bx, 1.13, 0.5);
  }
  lamps.push(makeLamp(low, 0.035, 0x7dff5a, 0.3, 1.32, 0.5, group));
  lamps.push(makeLamp(low, 0.035, 0x7dff5a, 0.6, 1.32, 0.5, group));

  k.add('darkSteel', k.box(0.02, 0.62, 0.68), 0.685, 0.78, 0.12);
  k.add('darkSteel', k.box(0.04, 0.1, 0.03), 0.71, 0.78, 0.12);
  if (!low) {
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) k.add('gunmetal', k.cyl(0.03, 0.03, 0.03, 6), sx * 0.62, 1.13, sz * 0.3);
    }
  }

  k.finish();
  return {
    group,
    colliders: [{ min: [-0.75, 0, -1.12], max: [0.75, 1.78, 1.0] }],
    sockets: [
      { name: 'feed', at: [0, 0.95, 0.75] },
      { name: 'steam', at: [0.35, 1.7, -0.35] },
      { name: 'out', at: [0, 0.6, -0.72] },
    ],
    lamps,
  };
}

/* ============================================================================
 * 6. RELAY PYLON — tapered lattice tower on a bolted concrete base, cross-arm
 *    with insulators (socket 'top' / prop.top), distribution box at the foot,
 *    small red lamp on the very top.
 * ==========================================================================*/

export function relayPylon(m: LabMaterials, o?: { stage?: number }): Prop & { top: V3 } {
  const low = (o?.stage ?? 6) <= 1;
  const pal = palette(m, low);
  const group = new THREE.Group();
  group.name = 'relayPylon';
  const k = new Kit(pal, low, group);
  const lamps: THREE.Mesh[] = [];

  const baseTop = 0.25, topY = 6.05, levels = 6;
  const h = (topY - baseTop) / levels;
  const wAt = (i: number): number => 0.52 - i * 0.078;

  k.add('concrete', k.cham(1.5, 1.5, 0.25, 0.03), 0, 0.125, 0, Math.PI / 2);
  if (!low) {
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) k.add('gunmetal', k.cyl(0.03, 0.03, 0.05, 6), sx * 0.55, 0.275, sz * 0.55);
    }
  }

  if (low) {
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        k.add('darkSteel', k.cyl(0.08, 0.13, 2.9, 4), sx * 0.42, 1.72, sz * 0.42, 0, Math.PI / 4, 0);
        k.add('darkSteel', k.cyl(0.05, 0.075, 2.9, 4), sx * 0.24, 4.62, sz * 0.24, 0, Math.PI / 4, 0);
      }
    }
  } else {
    for (let i = 0; i < levels; i++) {
      const w = wAt(i);
      const yc = baseTop + h / 2 + i * h;
      for (const sx of [1, -1]) {
        for (const sz of [1, -1]) k.add('darkSteel', k.box(0.08, h + 0.06, 0.08), sx * w, yc, sz * w);
      }
    }
  }

  for (let i = 1; i <= levels; i++) {
    const w = wAt(i);
    const y = baseTop + i * h;
    for (const s of [1, -1]) {
      k.add('darkSteel', k.box(2 * w, 0.055, 0.055), 0, y, s * w);
      k.add('darkSteel', k.box(0.055, 0.055, 2 * w), s * w, y, 0);
    }
  }

  if (!low) {
    for (let i = 0; i < levels; i++) {
      const wf = (wAt(i) + wAt(i + 1)) / 2 - 0.03;
      const len = Math.hypot(2 * wf, h) + 0.02;
      const ang = Math.atan2(h, 2 * wf) - Math.PI / 2;
      const yc = baseTop + h / 2 + i * h;
      for (const s of [1, -1]) {
        k.add('darkSteel', k.box(0.05, len, 0.05), 0, yc, wf, 0, 0, s * ang);
        k.add('darkSteel', k.box(0.05, len, 0.05), 0, yc, -wf, 0, 0, s * ang);
        k.add('darkSteel', k.box(0.05, len, 0.05), wf, yc, 0, s * ang, 0, 0);
        k.add('darkSteel', k.box(0.05, len, 0.05), -wf, yc, 0, s * ang, 0, 0);
      }
    }
  }

  k.add('darkSteel', k.box(0.34, 0.16, 0.34), 0, 6.1, 0);
  for (const s of [1, -1]) k.add('darkSteel', k.box(0.85, 0.06, 0.06), s * 0.6, 5.9, 0);
  k.add('darkSteel', k.box(0.07, 0.36, 0.07), 0, 5.9, 0);
  for (const s of [1, -1]) {
    for (const ix of [1.02, 0.42]) {
      k.add('gunmetal', k.cyl(0.035, 0.035, 0.22, low ? 4 : 8), s * ix, 5.76, 0);
      k.add('darkSteel', k.box(0.07, 0.09, 0.05), s * ix, 5.62, 0);
    }
  }
  k.add('gunmetal', k.box(0.03, 0.09, 0.03), 0, 6.26, 0);
  lamps.push(makeLamp(low, 0.04, 0xff453a, 0, 6.35, 0, group));

  k.add('gunmetal', k.cham(0.5, 0.58, 0.3, 0.04), 0.78, 0.5, 0.72);
  k.add('darkSteel', k.box(0.03, 0.12, 0.03), 0.78, 0.5, 0.885);
  if (!low) {
    for (const gx of [0.62, 0.94]) {
      k.add('gunmetal', k.cyl(0.035, 0.035, 0.06, 6), gx, 0.3, 0.88, Math.PI / 2, 0, 0);
      k.add('rubber', k.tube([[gx, 0.26, 0.92], [gx + 0.05, 0.1, 1.06], [gx + 0.09, 0.03, 1.16]], 0.02, 10, 4));
    }
  }

  k.finish();
  const top: V3 = [1.02, 5.76, 0];
  return {
    group,
    top,
    colliders: [{ min: [-0.8, 0, -0.8], max: [1.12, 6.42, 1.18] }],
    sockets: [
      { name: 'top', at: top },
      { name: 'box', at: [0.78, 0.5, 0.87] },
    ],
    lamps,
  };
}

/* ============================================================================
 * cableSpan — black rubber power cable sagging between two points (parabolic
 * approximation of a catenary, `sag` metres at the middle).
 * ==========================================================================*/

export function cableSpan(m: LabMaterials, from: V3, to: V3, sag: number): THREE.Mesh {
  const a = new THREE.Vector3(from[0], from[1], from[2]);
  const b = new THREE.Vector3(to[0], to[1], to[2]);
  const pts: THREE.Vector3[] = [];
  const n = 32;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= 4 * sag * t * (1 - t);
    pts.push(p);
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.045, 6, false);
  const mesh = new THREE.Mesh(geo, m.rubber);
  mesh.name = 'cableSpan';
  return mesh;
}
