import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ============================================================
   BASEGEAR — moon base fixtures & heavy machine.
   Procedural, merged-per-material, build-quality geometry.
   Frame: 4 m cells, 3 m storeys. Slab tops at y = 0, origin
   at the cell corner. Stage 0-1 chunky low poly, 6 full detail.
   ============================================================ */

export interface Box { min: [number, number, number]; max: [number, number, number]; }
export interface Socket { name: string; at: [number, number, number]; }
export interface Gear { group: THREE.Group; colliders: Box[]; sockets: Socket[]; lamps: THREE.Mesh[]; }
export interface GearOpts { stage: number; }

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
  const std = (color: number, metalness: number, roughness: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  return {
    gunmetal: std(0x59616b, 0.85, 0.42),
    darkSteel: std(0x2c3034, 0.8, 0.52),
    paint: std(0xd8d1c1, 0.25, 0.6),
    copper: std(0xb26a35, 0.9, 0.34),
    rubber: std(0x1d1f22, 0.05, 0.92),
    hazard: std(0xc9a227, 0.3, 0.58),
    concrete: std(0x87898c, 0.0, 0.95),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xaadfee, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.32,
    }),
  };
}

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const g = glow < 0 ? 0 : glow > 1 ? 1 : glow;
  const mat = lamp.material as THREE.MeshStandardMaterial;
  mat.emissiveIntensity = g;
}

export function triangles(g: Gear): number {
  let t = 0;
  g.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const geo = o.geometry;
      const idx = geo.index;
      t += Math.floor((idx !== null ? idx.count : geo.getAttribute('position').count) / 3);
    }
  });
  return t;
}

/* ---------------- internal helpers ---------------- */

const UP = new THREE.Vector3(0, 1, 0);

/** deterministic pseudo-random in [0,1) — no Math.random */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** non-indexed, position+normal+uv only, so mergeGeometries never fails */
function prep(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index !== null ? geo.toNonIndexed() : geo;
  if (g.getAttribute('uv') === undefined) {
    const n = g.getAttribute('position').count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  return g;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = mergeGeometries(parts.map(prep), false);
  if (out === null) throw new Error('basegear: mergeGeometries failed');
  return out;
}

const bx = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg: number, open = false): THREE.CylinderGeometry =>
  new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
const bolt = (r: number, h: number): THREE.CylinderGeometry => new THREE.CylinderGeometry(r, r, h, 6);

function pushTri(
  pos: number[], nrm: number[], uv: number[],
  a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ref: THREE.Vector3,
  ua: number, va: number, ub: number, vb: number, uc: number, vc: number,
): void {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
  let nx = aby * acz - abz * acy;
  let ny = abz * acx - abx * acz;
  let nz = abx * acy - aby * acx;
  let ta = a, tb = b, tc = c, tua = ua, tva = va, tub = ub, tvb = vb, tuc = uc, tvc = vc;
  if (nx * ref.x + ny * ref.y + nz * ref.z < 0) {
    tb = c; tc = b; tub = uc; tvb = vc; tuc = ub; tvc = vb;
    nx = -nx; ny = -ny; nz = -nz;
  }
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  pos.push(ta.x, ta.y, ta.z, tb.x, tb.y, tb.z, tc.x, tc.y, tc.z);
  nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  uv.push(tua, tva, tub, tvb, tuc, tvc);
}

/** box with chamfered vertical edges, base at y0, centred in x/z */
function chamfer(w: number, h: number, d: number, c: number, y0: number): THREE.BufferGeometry {
  const hw = w / 2, hd = d / 2;
  const cc = Math.min(c, hw * 0.45, hd * 0.45);
  const ring: Array<[number, number]> = [
    [hw - cc, hd], [hw, hd - cc], [hw, cc - hd], [hw - cc, -hd],
    [cc - hw, -hd], [-hw, cc - hd], [-hw, hd - cc], [cc - hw, hd],
  ];
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [];
  const y1 = y0 + h;
  for (let i = 0; i < 8; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % 8]!;
    const ref = new THREE.Vector3((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
    const av = new THREE.Vector3(a[0], y0, a[1]);
    const bv = new THREE.Vector3(b[0], y0, b[1]);
    const bt = new THREE.Vector3(b[0], y1, b[1]);
    const at = new THREE.Vector3(a[0], y1, a[1]);
    pushTri(pos, nrm, uv, av, bv, bt, ref, 0, 0, 1, 0, 1, 1);
    pushTri(pos, nrm, uv, av, bt, at, ref, 0, 0, 1, 1, 0, 1);
  }
  const top = new THREE.Vector3(0, y1, 0);
  const bot = new THREE.Vector3(0, y0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const dn = new THREE.Vector3(0, -1, 0);
  for (let i = 0; i < 8; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % 8]!;
    pushTri(pos, nrm, uv, top, new THREE.Vector3(b[0], y1, b[1]), new THREE.Vector3(a[0], y1, a[1]), up, 0, 0, b[0], b[1], a[0], a[1]);
    pushTri(pos, nrm, uv, bot, new THREE.Vector3(a[0], y0, a[1]), new THREE.Vector3(b[0], y0, b[1]), dn, 0, 0, a[0], a[1], b[0], b[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  return g;
}

/** thin box spanning a->b (slightly long so ends sink into their joints) */
function strut(ax: number, ay: number, az: number, bx2: number, by: number, bz: number, t: number): THREE.BufferGeometry {
  const a = new THREE.Vector3(ax, ay, az);
  const b = new THREE.Vector3(bx2, by, bz);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.BoxGeometry(t, len + 0.04, t);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  const mid = a.add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

function tube(pts: Array<[number, number, number]>, r: number, seg: number, radial: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
}

function makeLamp(color: number, size: number, x: number, y: number, z: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x101214, emissive: color, emissiveIntensity: 0, roughness: 0.35, metalness: 0.1,
  });
  const me = new THREE.Mesh(prep(new THREE.BoxGeometry(size, size, size)), mat);
  me.position.set(x, y, z);
  return me;
}

function bounds(g: THREE.BufferGeometry): Box {
  const p = g.getAttribute('position');
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

function assemble(buckets: Array<[THREE.Material, THREE.BufferGeometry[]]>, lamps: THREE.Mesh[], sockets: Socket[]): Gear {
  const group = new THREE.Group();
  const colliders: Box[] = [];
  for (const [mat, geos] of buckets) {
    const g = merge(geos);
    group.add(new THREE.Mesh(g, mat));
    colliders.push(bounds(g));
  }
  for (const l of lamps) group.add(l);
  return { group, colliders, sockets, lamps };
}

/* ---------------- hardpoint ---------------- */

export function hardpoint(m: LabMaterials, o: GearOpts): Gear {
  const hi = o.stage >= 6;
  const seg = hi ? 24 : 8;
  const bolts = hi ? 10 : 8;
  const ribs = hi ? 8 : 4;

  const concrete: THREE.BufferGeometry[] = [];
  const steel: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const haz: THREE.BufferGeometry[] = [];
  const rubber: THREE.BufferGeometry[] = [];
  const orange: THREE.BufferGeometry[] = [];
  const green: THREE.BufferGeometry[] = [];

  // 2x2 pad plate + hazard edge strips
  concrete.push(chamfer(8, 0.12, 8, 0.05, 0));
  haz.push(bx(0.16, 0.025, 7.5).translate(0.16, 0.1225, 4));
  haz.push(bx(0.16, 0.025, 7.5).translate(7.84, 0.1225, 4));
  haz.push(bx(7.5, 0.025, 0.16).translate(4, 0.1225, 0.16));
  haz.push(bx(7.5, 0.025, 0.16).translate(4, 0.1225, 7.84));

  // wide flange, socket cylinder, seam band, raised top ring
  steel.push(cyl(1.7, 1.8, 0.12, seg).translate(4, 0.17, 4));   // flange 0.11..0.23
  steel.push(cyl(1.3, 1.36, 0.6, seg).translate(4, 0.52, 4));   // socket 0.22..0.82
  steel.push(cyl(1.36, 1.36, 0.07, seg).translate(4, 0.53, 4)); // seam band
  const ringGeo = new THREE.TorusGeometry(1.0, 0.12, hi ? 10 : 6, hi ? 24 : 8);
  ringGeo.rotateX(Math.PI / 2);
  steel.push(ringGeo.translate(4, 0.9, 4));                     // ring top 1.02

  // flange bolts
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * Math.PI * 2;
    dark.push(bolt(0.08, 0.08).translate(4 + Math.cos(a) * 1.52, 0.26, 4 + Math.sin(a) * 1.52));
  }

  // glands + nuts, one toward +x, one toward +z
  const gland = (cx: number, cz: number, alongX: boolean): void => {
    const g = cyl(0.15, 0.17, 0.4, seg);
    const nut = bolt(0.21, 0.14);
    if (alongX) { g.rotateZ(Math.PI / 2); nut.rotateZ(Math.PI / 2); }
    else { g.rotateX(Math.PI / 2); nut.rotateX(Math.PI / 2); }
    steel.push(g.translate(cx, 0.5, cz));
    dark.push(nut.translate(cx + (alongX ? 0.22 : 0), 0.5, cz + (alongX ? 0 : 0.22)));
  };
  gland(5.35, 4, true);
  gland(4, 5.35, false);

  // thick cables: gland -> down -> under the ribbed cover -> pad edge
  const cable = (pts: Array<[number, number, number]>, bucket: THREE.BufferGeometry[]): void => {
    bucket.push(tube(pts, 0.075, hi ? 24 : 8, hi ? 8 : 5));
  };
  cable([[5.62, 0.5, 4], [5.72, 0.33, 4], [5.85, 0.19, 4], [6.6, 0.19, 4], [7.97, 0.19, 4]], orange);
  cable([[4, 0.5, 5.62], [4, 0.33, 5.72], [4, 0.19, 5.85], [4, 0.19, 6.6], [4, 0.19, 7.97]], green);

  // low ribbed floor cable covers to the pad edge
  const cover = (alongX: boolean): void => {
    const step = (7.9 - 5.9) / Math.max(1, ribs - 1);
    if (alongX) {
      rubber.push(bx(2.3, 0.16, 0.6).translate(6.85, 0.19, 4));
      for (let i = 0; i < ribs; i++) rubber.push(bx(0.07, 0.05, 0.6).translate(5.9 + i * step, 0.29, 4));
    } else {
      rubber.push(bx(0.6, 0.16, 2.3).translate(4, 0.19, 6.85));
      for (let i = 0; i < ribs; i++) rubber.push(bx(0.6, 0.05, 0.07).translate(4, 0.29, 5.9 + i * step));
    }
  };
  cover(true);
  cover(false);

  const orangeMat = m.paint.clone(); orangeMat.color.set(0xd96a1e);
  const greenMat = m.paint.clone(); greenMat.color.set(0x3f9e4d);

  return assemble(
    [
      [m.concrete, concrete],
      [m.gunmetal, steel],
      [m.darkSteel, dark],
      [m.hazard, haz],
      [m.rubber, rubber],
      [orangeMat, orange],
      [greenMat, green],
    ],
    [],
    [
      { name: 'mount', at: [4, 1.02, 4] },
      { name: 'power', at: [7.95, 0.2, 4] },
      { name: 'power', at: [4, 0.2, 7.95] },
    ],
  );
}

/* ---------------- heavyMill ---------------- */

export function heavyMill(m: LabMaterials, o: GearOpts): Gear {
  const hi = o.stage >= 6;
  const seg = hi ? 20 : 8;
  const bolts = hi ? 8 : 4;
  const slats = hi ? 7 : 4;
  const pixels = hi ? 10 : 6;

  const dark: THREE.BufferGeometry[] = [];   // darkSteel: plate, feet, bolts, vent, gland
  const paint: THREE.BufferGeometry[] = [];  // body
  const gun: THREE.BufferGeometry[] = [];    // hopper, door
  const ore: THREE.BufferGeometry[] = [];
  const px: THREE.BufferGeometry[] = [];     // pink pixels pouring from the vent
  const glassG: THREE.BufferGeometry[] = []; // door window

  // bolted base plate + feet
  dark.push(chamfer(3.6, 0.16, 3.6, 0.06, 0));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      dark.push(bx(0.5, 0.25, 0.5).translate(sx * 1.35, 0.275, sz * 1.35));
    }
  }
  // plate bolts on a circle
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * Math.PI * 2 + Math.PI / 4;
    dark.push(bolt(0.07, 0.07).translate(Math.cos(a) * 1.62, 0.185, Math.sin(a) * 1.62));
  }

  // tall chamfered body
  paint.push(chamfer(3.2, 4.0, 3.2, 0.35, 0.39)); // 0.39..4.39

  // open square hopper: four sloped walls + rim
  const wallLen = Math.hypot(0.7, 0.64) + 0.06;
  const ang = Math.atan2(0.7, 0.64);
  const w1 = bx(0.06, wallLen, 2.7); w1.rotateZ(-ang); w1.translate(1.0, 4.7, 0);
  const w2 = bx(0.06, wallLen, 2.7); w2.rotateZ(ang); w2.translate(-1.0, 4.7, 0);
  const w3 = bx(2.7, wallLen, 0.06); w3.rotateX(ang); w3.translate(0, 4.7, 1.0);
  const w4 = bx(2.7, wallLen, 0.06); w4.rotateX(-ang); w4.translate(0, 4.7, -1.0);
  gun.push(w1, w2, w3, w4);
  gun.push(bx(2.84, 0.08, 0.08).translate(0, 5.04, 1.38));
  gun.push(bx(2.84, 0.08, 0.08).translate(0, 5.04, -1.38));
  gun.push(bx(0.08, 0.08, 2.76).translate(1.38, 5.04, 0));
  gun.push(bx(0.08, 0.08, 2.76).translate(-1.38, 5.04, 0));

  // dark ore heaped above the rim
  ore.push(new THREE.ConeGeometry(1.25, 0.6, hi ? 8 : 4).translate(0, 5.05, 0));

  // recessed front door (+z), frame proud, panel sunk back, glass, handle, hinges
  gun.push(bx(1.5, 2.3, 0.1).translate(0, 1.9, 1.58));
  gun.push(bx(1.3, 2.1, 0.06).translate(0, 1.9, 1.58));
  gun.push(bx(0.05, 0.4, 0.06).translate(0.45, 1.9, 1.62));
  gun.push(bx(0.08, 0.22, 0.05).translate(-0.62, 1.25, 1.615));
  gun.push(bx(0.08, 0.22, 0.05).translate(-0.62, 2.55, 1.615));
  glassG.push(bx(0.5, 0.4, 0.02).translate(0, 2.35, 1.615));

  // louvred rear vent grille (-z)
  dark.push(bx(1.3, 0.9, 0.08).translate(0, 2.4, -1.6));
  for (let i = 0; i < slats; i++) {
    const s = bx(1.34, 0.07, 0.05);
    s.rotateX(-0.42);
    s.translate(0, 2.06 + (i * 0.68) / Math.max(1, slats - 1), -1.655);
    dark.push(s);
  }

  // pink pixels pouring from the vent (deterministic scatter)
  for (let i = 0; i < pixels; i++) {
    const t = i / Math.max(1, pixels - 1);
    const x = (hash(i * 3.1 + 1.7) - 0.5) * (0.35 + t * 1.3);
    const y = 2.4 + (hash(i * 3.1 + 4.2) - 0.5) * (0.35 + t * 1.1) + t * 0.12;
    px.push(bx(0.07, 0.07, 0.07).translate(x, y, -1.72 - t * 1.15));
  }

  // power gland + stub down into the base plate (+x face)
  const gland = cyl(0.13, 0.15, 0.3, seg); gland.rotateZ(Math.PI / 2);
  dark.push(gland.translate(1.62, 0.55, 0.8));
  const gnut = bolt(0.18, 0.1); gnut.rotateZ(Math.PI / 2);
  dark.push(gnut.translate(1.79, 0.55, 0.8));
  dark.push(tube([[1.8, 0.55, 0.8], [1.9, 0.35, 0.9], [1.95, 0.1, 0.95]], 0.06, hi ? 12 : 6, hi ? 7 : 5));

  const oreMat = m.darkSteel.clone(); oreMat.color.set(0x141518); oreMat.roughness = 1;
  const pxMat = new THREE.MeshStandardMaterial({ color: 0x2a0a12, emissive: 0xff4fa0, emissiveIntensity: 0.9, roughness: 0.5, metalness: 0 });

  return assemble(
    [
      [m.darkSteel, dark],
      [m.paint, paint],
      [m.gunmetal, gun],
      [oreMat, ore],
      [pxMat, px],
      [m.glass, glassG],
    ],
    [
      makeLamp(0x39d97e, 0.13, -0.75, 3.95, 1.62),
      makeLamp(0xe8b23a, 0.13, 0.75, 3.95, 1.62),
    ],
    [
      { name: 'vent', at: [0, 2.4, -1.72] },
      { name: 'hopper', at: [0, 5.15, 0] },
      { name: 'power', at: [1.85, 0.55, 0.8] },
    ],
  );
}

/* ---------------- bin ---------------- */

export function bin(m: LabMaterials, o: GearOpts): Gear {
  const hi = o.stage >= 6;
  const seg = hi ? 16 : 8;
  const cols = hi ? 4 : 3;
  const rows = hi ? 3 : 2;

  const dark: THREE.BufferGeometry[] = [];
  const paint: THREE.BufferGeometry[] = [];
  const gun: THREE.BufferGeometry[] = [];
  const copper: THREE.BufferGeometry[] = [];

  // cabinet on four feet
  paint.push(bx(1.6, 1.6, 0.8).translate(2, 1.08, 2));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      dark.push(bx(0.16, 0.32, 0.16).translate(2 + sx * 0.62, 0.16, 2 + sz * 0.62));
    }
  }

  // keypad + handle + door seam on the front
  gun.push(bx(0.32, 0.5, 0.03).translate(1.72, 1.25, 2.405));
  const keys = cols * rows;
  for (let i = 0; i < keys; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    gun.push(bx(0.055, 0.055, 0.025).translate(
      1.72 + (c - (cols - 1) / 2) * 0.075,
      1.25 + (r - (rows - 1) / 2) * 0.1,
      2.425,
    ));
  }
  dark.push(bx(0.06, 0.5, 0.05).translate(2.42, 1.2, 2.415));
  dark.push(bx(0.02, 1.5, 0.012).translate(2.0, 1.05, 2.402));

  // dish emitter on top: stalk + tilted open cone + rim + feed horn
  dark.push(cyl(0.05, 0.06, 0.3, seg).translate(2, 2.0, 2));
  const dish = new THREE.ConeGeometry(0.32, 0.16, seg, 1, true);
  dish.rotateX(Math.PI);
  dish.rotateZ(0.35);
  dish.translate(2, 2.2, 2);
  copper.push(dish);
  const rim = new THREE.TorusGeometry(0.32, 0.02, hi ? 8 : 5, seg);
  rim.rotateX(Math.PI / 2);
  rim.rotateZ(0.35);
  rim.translate(2 - 0.0275, 2.2751, 2);
  copper.push(rim);
  const feed = bx(0.05, 0.12, 0.05);
  feed.rotateZ(0.35);
  feed.translate(1.993, 2.331, 2);
  copper.push(feed);

  return assemble(
    [
      [m.darkSteel, dark],
      [m.paint, paint],
      [m.gunmetal, gun],
      [m.copper, copper],
    ],
    [makeLamp(0x59d8e6, 0.09, 1.55, 1.92, 1.75)],
    [{ name: 'link', at: [2, 2.3, 2] }],
  );
}

/* ---------------- repeater ---------------- */

export function repeater(m: LabMaterials, o: GearOpts): Gear {
  const hi = o.stage >= 6;
  const seg = hi ? 12 : 6;
  const levels = hi ? [1.5, 2.4, 3.3, 4.2, 5.1, 6.0] : [1.8, 3.6, 5.4];
  const emitters = hi ? 8 : 6;

  const concrete: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const copper: THREE.BufferGeometry[] = [];
  const lens: THREE.BufferGeometry[] = [];

  // bolted concrete base
  concrete.push(chamfer(1.6, 0.5, 1.6, 0.06, 0).translate(2, 0, 2));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      dark.push(bolt(0.09, 0.08).translate(2 + sx * 0.6, 0.53, 2 + sz * 0.6));
    }
  }

  // tapering lattice tower
  const s = (y: number): number => 0.55 - (0.33 * (y - 0.45)) / 6.1;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      dark.push(strut(2 + sx * 0.55, 0.45, 2 + sz * 0.55, 2 + sx * 0.22, 6.55, 2 + sz * 0.22, 0.1));
    }
  }
  const ringAt = (y: number): void => {
    const r = s(y);
    dark.push(strut(2 + r, y, 2 + r, 2 - r, y, 2 + r, 0.06));
    dark.push(strut(2 - r, y, 2 + r, 2 - r, y, 2 - r, 0.06));
    dark.push(strut(2 - r, y, 2 - r, 2 + r, y, 2 - r, 0.06));
    dark.push(strut(2 + r, y, 2 - r, 2 + r, y, 2 + r, 0.06));
  };
  for (const y of levels) ringAt(y);
  ringAt(6.5);
  const ys = [0.5, ...levels, 6.5];
  for (let i = 0; i < ys.length - 1; i++) {
    const y1 = ys[i]!;
    const y2 = ys[i + 1]!;
    const r1 = s(y1);
    const r2 = s(y2);
    dark.push(strut(2 + r1, y1, 2 + r1, 2 - r2, y2, 2 + r2, 0.05));
    dark.push(strut(2 - r1, y1, 2 - r1, 2 + r2, y2, 2 - r2, 0.05));
    dark.push(strut(2 + r1, y1, 2 - r1, 2 + r2, y2, 2 + r2, 0.05));
    dark.push(strut(2 - r1, y1, 2 + r1, 2 - r2, y2, 2 - r2, 0.05));
  }

  // top platform + ring of emitters with glowing lenses
  dark.push(bx(0.75, 0.08, 0.75).translate(2, 6.57, 2));
  for (let i = 0; i < emitters; i++) {
    const a = (i / emitters) * Math.PI * 2;
    const ex = 2 + Math.cos(a) * 0.42;
    const ez = 2 + Math.sin(a) * 0.42;
    copper.push(bx(0.15, 0.12, 0.15).translate(ex, 6.665, ez));
    lens.push(bx(0.1, 0.03, 0.1).translate(ex, 6.73, ez));
  }

  // red top lamp on a stalk
  dark.push(cyl(0.04, 0.05, 0.35, seg).translate(2, 6.78, 2));

  // distribution box at the foot + gland
  copper.push(bx(0.6, 0.7, 0.45).translate(3.08, 0.35, 2));
  copper.push(bx(0.66, 0.05, 0.51).translate(3.08, 0.71, 2));
  const dg = cyl(0.07, 0.08, 0.2, seg); dg.rotateZ(Math.PI / 2);
  copper.push(dg.translate(2.72, 0.5, 2));

  const lensMat = new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: 0x66e0ff, emissiveIntensity: 0, roughness: 0.4, metalness: 0.1 });

  return assemble(
    [
      [m.concrete, concrete],
      [m.darkSteel, dark],
      [m.copper, copper],
      [lensMat, lens],
    ],
    [makeLamp(0xff3b30, 0.15, 2, 7.02, 2)],
    [
      { name: 'top', at: [2, 7.12, 2] },
      { name: 'box', at: [3.4, 0.35, 2] },
    ],
  );
}

/* ---------------- draftingTable ---------------- */

export function draftingTable(m: LabMaterials, _o: GearOpts): Gear {
  const dark: THREE.BufferGeometry[] = [];
  const paint: THREE.BufferGeometry[] = [];
  const gun: THREE.BufferGeometry[] = [];
  const copper: THREE.BufferGeometry[] = [];
  const haz: THREE.BufferGeometry[] = [];
  const glassG: THREE.BufferGeometry[] = [];

  // workbench top + braced legs
  paint.push(chamfer(2.4, 0.08, 1.2, 0.02, 0.87));
  for (const sx of [0.98, 3.02]) {
    for (const sz of [1.58, 2.42]) {
      dark.push(bx(0.09, 0.88, 0.09).translate(sx, 0.44, sz));
    }
  }
  dark.push(strut(0.98, 0.06, 1.58, 3.02, 0.82, 1.58, 0.05));
  dark.push(strut(3.02, 0.06, 1.58, 0.98, 0.82, 1.58, 0.05));
  dark.push(strut(0.98, 0.06, 2.42, 3.02, 0.82, 2.42, 0.05));
  dark.push(strut(3.02, 0.06, 2.42, 0.98, 0.82, 2.42, 0.05));
  dark.push(strut(0.98, 0.06, 1.58, 0.98, 0.82, 2.42, 0.05));
  dark.push(strut(3.02, 0.06, 2.42, 3.02, 0.82, 1.58, 0.05));

  // glowing drafting screen inset in the top (frame sunk, panel below frame lip)
  gun.push(bx(1.34, 0.03, 0.05).translate(2, 0.96, 1.68));
  gun.push(bx(1.34, 0.03, 0.05).translate(2, 0.96, 2.32));
  gun.push(bx(0.05, 0.03, 0.59).translate(1.355, 0.96, 2));
  gun.push(bx(0.05, 0.03, 0.59).translate(2.645, 0.96, 2));
  glassG.push(bx(1.31, 0.008, 0.66).translate(2, 0.97, 2));

  // small cube + swatch on the top
  copper.push(bx(0.26, 0.26, 0.26).translate(1.25, 1.075, 1.75));
  haz.push(bx(0.34, 0.02, 0.22).translate(2.75, 0.955, 2.25));

  // side cabinet
  paint.push(bx(0.55, 0.88, 0.9).translate(3.455, 0.44, 2));
  paint.push(bx(0.45, 0.7, 0.02).translate(3.455, 0.42, 2.455));

  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0a1420, emissive: 0x2a7fff, emissiveIntensity: 0, roughness: 0.3, metalness: 0.2,
  });
  const screenMesh = new THREE.Mesh(prep(bx(1.29, 0.025, 0.64)), screenMat);
  screenMesh.position.set(2, 0.9525, 2);

  return assemble(
    [
      [m.darkSteel, dark],
      [m.paint, paint],
      [m.gunmetal, gun],
      [m.copper, copper],
      [m.hazard, haz],
      [m.glass, glassG],
    ],
    [screenMesh],
    [{ name: 'screen', at: [2, 0.98, 2] }],
  );
}
