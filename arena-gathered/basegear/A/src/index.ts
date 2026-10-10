// Moon Base Builder — fixtures & heavy machine
// Single file, strict, no DOM, no Date, no Math.random, no any.
// Only deps are `three` and `mergeGeometries` from BufferGeometryUtils.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- public types ----------

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
  gunmetal: number;
  darkSteel: number;
  paint: number;
  copper: number;
  rubber: number;
  hazard: number;
  glass: number;
  concrete: number;
}

// ---------- shared internal state ----------

interface MatSet {
  gunmetal: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  hazard: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  concrete: THREE.MeshStandardMaterial;
  lampRed: THREE.MeshStandardMaterial;
  lampGreen: THREE.MeshStandardMaterial;
  lampBlue: THREE.MeshStandardMaterial;
  lampAmber: THREE.MeshStandardMaterial;
  lampPink: THREE.MeshStandardMaterial;
}

interface Ctx {
  mats: MatSet;
  matsIdx: LabMaterials;
  stage: number;
  hi: boolean;
  lamps: THREE.Mesh[];
  colliders: Box[];
  sockets: Socket[];
  group: THREE.Group;
  nextId: number;
  buckets: Map<string, THREE.BufferGeometry[]>;
  bucketMats: Map<string, THREE.Material | THREE.Material[]>;
}

const PI2 = Math.PI * 2;
const EPS = 1e-4;

function makeId(ctx: Ctx, prefix: string): string {
  ctx.nextId += 1;
  return `${prefix}_${ctx.nextId}`;
}

function boxFromPos(pos: THREE.Vector3, size: THREE.Vector3): Box {
  const h = size.clone().multiplyScalar(0.5);
  return {
    min: [pos.x - h.x, pos.y - h.y, pos.z - h.z],
    max: [pos.x + h.x, pos.y + h.y, pos.z + h.z],
  };
}

// Deterministic PRNG (mulberry32). We never call Math.random anywhere.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- material factory ----------

export function createMaterials(): LabMaterials {
  const mats: MatSet = {
    gunmetal: new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.85, roughness: 0.42 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x22262b, metalness: 0.9, roughness: 0.55 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xc9d2dc, metalness: 0.25, roughness: 0.5 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.35 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x111418, metalness: 0.0, roughness: 0.95 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xe8a83a, metalness: 0.15, roughness: 0.55 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x6fb6ff, metalness: 0.0, roughness: 0.18, transmission: 0, ior: 1.45, transparent: true, opacity: 0.85,
    }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x8d8b86, metalness: 0.05, roughness: 0.95 }),
    lampRed: new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1010, emissiveIntensity: 1.0, metalness: 0.1, roughness: 0.4 }),
    lampGreen: new THREE.MeshStandardMaterial({ color: 0x33ff66, emissive: 0x22cc55, emissiveIntensity: 1.0, metalness: 0.1, roughness: 0.4 }),
    lampBlue: new THREE.MeshStandardMaterial({ color: 0x66bbff, emissive: 0x2299ff, emissiveIntensity: 1.0, metalness: 0.1, roughness: 0.4 }),
    lampAmber: new THREE.MeshStandardMaterial({ color: 0xffb84d, emissive: 0xff8c1a, emissiveIntensity: 1.0, metalness: 0.1, roughness: 0.4 }),
    lampPink: new THREE.MeshStandardMaterial({ color: 0xff6fb5, emissive: 0xff3a8a, emissiveIntensity: 1.0, metalness: 0.1, roughness: 0.4 }),
  };
  // tag each material with its key
  (mats.gunmetal as unknown as { userData: { key: string } }).userData = { key: 'gunmetal' };
  (mats.darkSteel as unknown as { userData: { key: string } }).userData = { key: 'darkSteel' };
  (mats.paint as unknown as { userData: { key: string } }).userData = { key: 'paint' };
  (mats.copper as unknown as { userData: { key: string } }).userData = { key: 'copper' };
  (mats.rubber as unknown as { userData: { key: string } }).userData = { key: 'rubber' };
  (mats.hazard as unknown as { userData: { key: string } }).userData = { key: 'hazard' };
  (mats.glass as unknown as { userData: { key: string } }).userData = { key: 'glass' };
  (mats.concrete as unknown as { userData: { key: string } }).userData = { key: 'concrete' };
  (mats.lampRed as unknown as { userData: { key: string } }).userData = { key: 'lampRed' };
  (mats.lampGreen as unknown as { userData: { key: string } }).userData = { key: 'lampGreen' };
  (mats.lampBlue as unknown as { userData: { key: string } }).userData = { key: 'lampBlue' };
  (mats.lampAmber as unknown as { userData: { key: string } }).userData = { key: 'lampAmber' };
  (mats.lampPink as unknown as { userData: { key: string } }).userData = { key: 'lampPink' };

  const idx: LabMaterials = {
    gunmetal: 0, darkSteel: 1, paint: 2, copper: 3, rubber: 4, hazard: 5, glass: 6, concrete: 7,
  };
  (idx as unknown as { _mats: MatSet })._mats = mats;
  return idx;
}

function getMats(idx: LabMaterials): MatSet {
  return (idx as unknown as { _mats: MatSet })._mats;
}

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material;
  if (Array.isArray(mat)) return;
  if (!(mat instanceof THREE.MeshStandardMaterial) && !(mat instanceof THREE.MeshPhysicalMaterial)) return;
  mat.emissiveIntensity = THREE.MathUtils.clamp(glow, 0, 3) * 1.5;
}

// ---------- geometry primitives ----------
// Primitives return BufferGeometry only; caller handles colliders and bucket routing.

function boxGeo(w: number, h: number, d: number, pos: THREE.Vector3, ctx: Ctx, seg = 1): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  g.translate(pos.x, pos.y, pos.z);
  ctx.colliders.push(boxFromPos(pos, new THREE.Vector3(w, h, d)));
  return g;
}

function cylGeo(rTop: number, rBot: number, h: number, seg: number, pos: THREE.Vector3, ctx: Ctx): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1);
  g.translate(pos.x, pos.y, pos.z);
  const r = Math.max(rTop, rBot);
  ctx.colliders.push({
    min: [pos.x - r, pos.y - h / 2, pos.z - r],
    max: [pos.x + r, pos.y + h / 2, pos.z + r],
  });
  return g;
}

function ringGeo(outerR: number, innerR: number, h: number, seg: number, pos: THREE.Vector3, ctx: Ctx): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, PI2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, PI2, true);
  shape.holes.push(hole);
  const ring = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: seg });
  ring.rotateX(-Math.PI / 2);
  ring.translate(0, -h / 2, 0);
  ring.translate(pos.x, pos.y, pos.z);
  ctx.colliders.push({
    min: [pos.x - outerR, pos.y - h / 2, pos.z - outerR],
    max: [pos.x + outerR, pos.y + h / 2, pos.z + outerR],
  });
  return ring;
}

// Chamfered box: only chamfer at hi stage to keep low-poly stage 1 cheap.
function chamferedBoxGeos(w: number, h: number, d: number, chamfer: number, pos: THREE.Vector3, ctx: Ctx): THREE.BufferGeometry[] {
  if (chamfer <= 0 || !ctx.hi) {
    return [boxGeo(w, h, d, pos, ctx)];
  }
  const geos: THREE.BufferGeometry[] = [];
  geos.push(boxGeo(w, h - chamfer * 2, d, pos, ctx, 1));
  const tb = chamfer;
  const cw = w - chamfer * 2;
  const cd = d - chamfer * 2;
  // top bevel band (4 boxes around the perimeter forming a frame)
  geos.push(boxGeo(cw, tb, chamfer, new THREE.Vector3(pos.x, pos.y + h / 2 - tb / 2, pos.z + d / 2 - chamfer / 2), ctx, 1));
  geos.push(boxGeo(cw, tb, chamfer, new THREE.Vector3(pos.x, pos.y + h / 2 - tb / 2, pos.z - d / 2 + chamfer / 2), ctx, 1));
  geos.push(boxGeo(chamfer, tb, cd, new THREE.Vector3(pos.x + w / 2 - chamfer / 2, pos.y + h / 2 - tb / 2, pos.z), ctx, 1));
  geos.push(boxGeo(chamfer, tb, cd, new THREE.Vector3(pos.x - w / 2 + chamfer / 2, pos.y + h / 2 - tb / 2, pos.z), ctx, 1));
  // bottom bevel band
  geos.push(boxGeo(cw, tb, chamfer, new THREE.Vector3(pos.x, pos.y - h / 2 + tb / 2, pos.z + d / 2 - chamfer / 2), ctx, 1));
  geos.push(boxGeo(cw, tb, chamfer, new THREE.Vector3(pos.x, pos.y - h / 2 + tb / 2, pos.z - d / 2 + chamfer / 2), ctx, 1));
  geos.push(boxGeo(chamfer, tb, cd, new THREE.Vector3(pos.x + w / 2 - chamfer / 2, pos.y - h / 2 + tb / 2, pos.z), ctx, 1));
  geos.push(boxGeo(chamfer, tb, cd, new THREE.Vector3(pos.x - w / 2 + chamfer / 2, pos.y - h / 2 + tb / 2, pos.z), ctx, 1));
  return geos;
}

// ---------- procedural helpers ----------

function matKey(mat: THREE.Material | THREE.Material[]): string {
  if (Array.isArray(mat)) {
    return (mat[0] as unknown as { userData: { key: string } }).userData.key;
  }
  return (mat as unknown as { userData: { key: string } }).userData.key;
}

function pushGeo(ctx: Ctx, mat: THREE.Material | THREE.Material[], g: THREE.BufferGeometry): void {
  const k = matKey(mat);
  let arr = ctx.buckets.get(k);
  if (!arr) {
    arr = [];
    ctx.buckets.set(k, arr);
    ctx.bucketMats.set(k, mat);
  }
  arr.push(g);
}

function pushMany(ctx: Ctx, mat: THREE.Material | THREE.Material[], gs: THREE.BufferGeometry[]): void {
  for (const g of gs) pushGeo(ctx, mat, g);
}

// Add a row of bolts on a top face of a box.
function addBolts(ctx: Ctx, mat: THREE.Material | THREE.Material[], cx: number, cy: number, cz: number, sx: number, sz: number, inset: number, countX: number, countZ: number): void {
  const r = ctx.hi ? 0.045 : 0.06;
  const h = 0.04;
  const yOff = cy + h / 2;
  for (let i = 0; i < countX; i++) {
    for (let j = 0; j < countZ; j++) {
      const fx = countX === 1 ? 0.5 : i / (countX - 1);
      const fz = countZ === 1 ? 0.5 : j / (countZ - 1);
      const x = cx - sx / 2 + inset + fx * (sx - inset * 2);
      const z = cz - sz / 2 + inset + fz * (sz - inset * 2);
      pushGeo(ctx, mat, cylGeo(r, r, h, 6, new THREE.Vector3(x, yOff, z), ctx));
    }
  }
}

// Add a thin dark seam strip along a line on a face.
function addSeam(ctx: Ctx, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, thickness: number): void {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const cz = (z1 + z2) / 2;
  const sx = Math.abs(x2 - x1);
  const sz = Math.abs(z2 - z1);
  if (sx < EPS && sz < EPS) return;
  if (sx > sz) {
    pushGeo(ctx, ctx.mats.darkSteel, boxGeo(sx, 0.012, thickness, new THREE.Vector3(cx, cy, cz), ctx, 1));
  } else {
    pushGeo(ctx, ctx.mats.darkSteel, boxGeo(thickness, 0.012, sz, new THREE.Vector3(cx, cy, cz), ctx, 1));
  }
}

function addLampMesh(ctx: Ctx, mat: THREE.MeshStandardMaterial, pos: THREE.Vector3, size: number, tag: string): THREE.Mesh {
  const g = new THREE.SphereGeometry(size, ctx.hi ? 12 : 6, ctx.hi ? 10 : 5);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(pos);
  m.castShadow = false;
  m.receiveShadow = false;
  m.name = tag;
  ctx.lamps.push(m);
  ctx.group.add(m);
  return m;
}



// Build an oriented cylinder between two points.
function orientCylinder(a: THREE.Vector3, b: THREE.Vector3, r: number, seg: number): THREE.BufferGeometry {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

// ---------- ctx ----------

function newCtx(matsIdx: LabMaterials, stage: number): Ctx {
  const mats = getMats(matsIdx);
  const ctx: Ctx = {
    mats,
    matsIdx,
    stage,
    hi: stage >= 4,
    lamps: [],
    colliders: [],
    sockets: [],
    group: new THREE.Group(),
    nextId: 0,
    buckets: new Map(),
    bucketMats: new Map(),
  };
  for (const k of ['gunmetal', 'darkSteel', 'paint', 'copper', 'rubber', 'hazard', 'glass', 'concrete', 'lampRed', 'lampGreen', 'lampBlue', 'lampAmber', 'lampPink']) {
    ctx.buckets.set(k, []);
    ctx.bucketMats.set(k, (mats as unknown as Record<string, THREE.Material>)[k]!);
  }
  return ctx;
}

function finalize(ctx: Ctx): Gear {
  for (const k of ctx.buckets.keys()) emitBucket(ctx, k);
  return {
    group: ctx.group,
    colliders: ctx.colliders,
    sockets: ctx.sockets,
    lamps: ctx.lamps,
  };
}

function emitBucket(ctx: Ctx, key: string): void {
  const arr = ctx.buckets.get(key);
  if (!arr || arr.length === 0) return;
  const mat = ctx.bucketMats.get(key);
  if (!mat) return;
  const merged = mergeGeometries(arr, false);
  if (!merged) return;
  merged.computeVertexNormals();
  if (ctx.stage <= 1) {
    const flat = merged.toNonIndexed();
    flat.computeVertexNormals();
    const m = new THREE.Mesh(flat, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    ctx.group.add(m);
  } else {
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    ctx.group.add(m);
  }
  for (const g of arr) g.dispose();
  arr.length = 0;
}

// ============================================================
// HARDPOINT
// ============================================================

export function hardpoint(m: LabMaterials, opts: { stage: number }): Gear {
  const ctx = newCtx(m, opts.stage);
  const OX = 4, OZ = 4;
  // pad slab
  const padH = 0.18;
  pushGeo(ctx, ctx.mats.concrete, boxGeo(8, padH, 8, new THREE.Vector3(OX, padH / 2, OZ), ctx));
  // pad bolts around perimeter
  addBolts(ctx, ctx.mats.gunmetal, OX, padH, OZ, 8, 8, 0.4, 5, 5);
  // Wide flange
  const flangeH = 0.1;
  const flangeR = 1.7;
  const flangeY = padH + flangeH / 2;
  pushGeo(ctx, ctx.mats.darkSteel, cylGeo(flangeR, flangeR + 0.05, flangeH, ctx.hi ? 24 : 12, new THREE.Vector3(OX, flangeY, OZ), ctx));
  // bolts ring on flange
  const flangeBolts = ctx.hi ? 16 : 8;
  for (let i = 0; i < flangeBolts; i++) {
    const a = (i / flangeBolts) * PI2;
    const r = flangeR - 0.12;
    pushGeo(ctx, ctx.mats.gunmetal, cylGeo(0.05, 0.05, 0.05, 6, new THREE.Vector3(OX + Math.cos(a) * r, flangeY + flangeH / 2 + 0.025, OZ + Math.sin(a) * r), ctx));
  }
  // Cylinder socket body
  const socketH = 0.6;
  const socketR = 1.3;
  const socketY = padH + flangeH + socketH / 2;
  pushGeo(ctx, ctx.mats.gunmetal, cylGeo(socketR, socketR + 0.04, socketH, ctx.hi ? 28 : 14, new THREE.Vector3(OX, socketY, OZ), ctx));
  // raised top ring (mount surface)
  const ringH = 0.18;
  const ringY = padH + flangeH + socketH + ringH / 2;
  pushGeo(ctx, ctx.mats.paint, ringGeo(socketR + 0.05, socketR - 0.18, ringH, ctx.hi ? 28 : 16, new THREE.Vector3(OX, ringY, OZ), ctx));
  // detail seam at top of socket
  if (ctx.hi) {
    addSeam(ctx, OX - socketR + 0.1, socketY + socketH / 2 - 0.02, OZ, OX + socketR - 0.1, socketY + socketH / 2 - 0.02, OZ, 0.02);
  }
  // Cable glands
  const glandA = new THREE.Vector3(OX + flangeR * 0.6, padH + 0.08, OZ);
  const glandB = new THREE.Vector3(OX, padH + 0.08, OZ + flangeR * 0.6);
  pushGeo(ctx, ctx.mats.darkSteel, cylGeo(0.12, 0.14, 0.08, 10, new THREE.Vector3(glandA.x, glandA.y + 0.04, glandA.z), ctx));
  pushGeo(ctx, ctx.mats.gunmetal, cylGeo(0.16, 0.16, 0.05, 10, new THREE.Vector3(glandA.x, glandA.y, glandA.z), ctx));
  pushGeo(ctx, ctx.mats.darkSteel, cylGeo(0.12, 0.14, 0.08, 10, new THREE.Vector3(glandB.x, glandB.y + 0.04, glandB.z), ctx));
  pushGeo(ctx, ctx.mats.gunmetal, cylGeo(0.16, 0.16, 0.05, 10, new THREE.Vector3(glandB.x, glandB.y, glandB.z), ctx));
  // ribbed cable covers
  const covY = padH + 0.09;
  const covLenX = 8 - (OX + flangeR * 0.6) - 0.15;
  const covLenZ = 8 - (OZ + flangeR * 0.6) - 0.15;
  pushMany(ctx, ctx.mats.darkSteel, chamferedBoxGeos(covLenX, 0.18, 0.4, 0.04, new THREE.Vector3(OX + flangeR * 0.6 + covLenX / 2 + 0.05, covY, OZ), ctx));
  pushMany(ctx, ctx.mats.darkSteel, chamferedBoxGeos(0.4, 0.18, covLenZ, 0.04, new THREE.Vector3(OX, covY, OZ + flangeR * 0.6 + covLenZ / 2 + 0.05), ctx));
  // ribs on top of covers
  if (ctx.hi) {
    for (let i = 0; i < 6; i++) {
      const fx = i / 5;
      const x = OX + flangeR * 0.6 + 0.1 + fx * (covLenX - 0.2);
      pushGeo(ctx, ctx.mats.gunmetal, cylGeo(0.025, 0.025, 0.02, 5, new THREE.Vector3(x, covY + 0.1, OZ), ctx));
    }
    for (let i = 0; i < 6; i++) {
      const fz = i / 5;
      const z = OZ + flangeR * 0.6 + 0.1 + fz * (covLenZ - 0.2);
      pushGeo(ctx, ctx.mats.gunmetal, cylGeo(0.025, 0.025, 0.02, 5, new THREE.Vector3(OX, covY + 0.1, z), ctx));
    }
  }
  // Cables themselves (orange + green tubes)
  const cableAStart = new THREE.Vector3(OX + flangeR * 0.6, covY + 0.04, OZ);
  const cableAEnd = new THREE.Vector3(8 - 0.1, covY + 0.04, OZ);
  pushGeo(ctx, ctx.mats.hazard, orientCylinder(cableAStart, cableAEnd, 0.05, ctx.hi ? 8 : 5));
  const cableBStart = new THREE.Vector3(OX, covY + 0.04, OZ + flangeR * 0.6);
  const cableBEnd = new THREE.Vector3(OX, covY + 0.04, 8 - 0.1);
  pushGeo(ctx, ctx.mats.copper, orientCylinder(cableBStart, cableBEnd, 0.05, ctx.hi ? 8 : 5));
  // Hazard stripes along cover edges
  pushGeo(ctx, ctx.mats.hazard, boxGeo(0.04, 0.02, covLenX - 0.05, new THREE.Vector3(OX + flangeR * 0.6 + covLenX / 2 + 0.05, covY + 0.18 + 0.01, OZ + 0.21), ctx));
  pushGeo(ctx, ctx.mats.hazard, boxGeo(0.04, 0.02, covLenX - 0.05, new THREE.Vector3(OX + flangeR * 0.6 + covLenX / 2 + 0.05, covY + 0.18 + 0.01, OZ - 0.21), ctx));
  pushGeo(ctx, ctx.mats.hazard, boxGeo(covLenZ - 0.05, 0.02, 0.04, new THREE.Vector3(OX + 0.21, covY + 0.18 + 0.01, OZ + flangeR * 0.6 + covLenZ / 2 + 0.05), ctx));
  pushGeo(ctx, ctx.mats.hazard, boxGeo(covLenZ - 0.05, 0.02, 0.04, new THREE.Vector3(OX - 0.21, covY + 0.18 + 0.01, OZ + flangeR * 0.6 + covLenZ / 2 + 0.05), ctx));
  // sockets
  const mountTopY = padH + flangeH + socketH + ringH;
  ctx.sockets.push({ name: 'mount', at: [OX, mountTopY, OZ] });
  ctx.sockets.push({ name: 'power', at: [8 - 0.05, covY + 0.04, OZ] });
  // status lamp on flange (amber)
  addLampMesh(ctx, ctx.mats.lampAmber, new THREE.Vector3(OX, mountTopY - 0.04, OZ + socketR * 0.6), 0.06, 'hardpoint_lamp');
  void makeId;
  return finalize(ctx);
}

// ============================================================
// HEAVYMILL
// ============================================================

export function heavyMill(m: LabMaterials, opts: { stage: number }): Gear {
  const ctx = newCtx(m, opts.stage);
  const OX = 4, OZ = 4;
  // Base plate
  const baseW = 3.6, baseD = 3.6, baseH = 0.18;
  const baseY = baseH / 2;
  pushMany(ctx, ctx.mats.darkSteel, chamferedBoxGeos(baseW, baseH, baseD, 0.04, new THREE.Vector3(OX, baseY, OZ), ctx));
  // base bolts
  addBolts(ctx, ctx.mats.gunmetal, OX, baseY + baseH / 2, OZ, baseW, baseD, 0.3, 4, 4);
  // Four feet
  const footY = baseH;
  const footR = 0.18, footH = 0.12;
  const footOffsets: ReadonlyArray<readonly [number, number]> = [
    [OX + baseW / 2 - 0.3, OZ + baseD / 2 - 0.3],
    [OX - baseW / 2 + 0.3, OZ + baseD / 2 - 0.3],
    [OX + baseW / 2 - 0.3, OZ - baseD / 2 + 0.3],
    [OX - baseW / 2 + 0.3, OZ - baseD / 2 + 0.3],
  ];
  for (const [x, z] of footOffsets) {
    pushGeo(ctx, ctx.mats.gunmetal, cylGeo(footR, footR, footH, ctx.hi ? 12 : 6, new THREE.Vector3(x, footY + footH / 2, z), ctx));
  }
  // Tall body 3.2 x 3.2 x 4
  const bodyW = 3.2, bodyD = 3.2, bodyH = 4.0;
  const bodyY = footY + footH + bodyH / 2;
  pushMany(ctx, ctx.mats.gunmetal, chamferedBoxGeos(bodyW, bodyH, bodyD, ctx.hi ? 0.12 : 0, new THREE.Vector3(OX, bodyY, OZ), ctx));
  // Vertical seam lines down corners
  if (ctx.hi) {
    const seamY = bodyY;
    addSeam(ctx, OX - bodyW / 2 + 0.005, seamY, OZ - bodyD / 2, OX - bodyW / 2 + 0.005, seamY, OZ + bodyD / 2, 0.02);
    addSeam(ctx, OX + bodyW / 2 - 0.005, seamY, OZ - bodyD / 2, OX + bodyW / 2 - 0.005, seamY, OZ + bodyD / 2, 0.02);
    addSeam(ctx, OX - bodyW / 2, seamY, OZ - bodyD / 2 + 0.005, OX + bodyW / 2, seamY, OZ - bodyD / 2 + 0.005, 0.02);
    addSeam(ctx, OX - bodyW / 2, seamY, OZ + bodyD / 2 - 0.005, OX + bodyW / 2, seamY, OZ + bodyD / 2 - 0.005, 0.02);
  }
  // Recessed service door in front (-z)
  const doorW = 0.9, doorH = 1.6;
  const doorY = footY + footH + doorH / 2 + 0.15;
  pushGeo(ctx, ctx.mats.darkSteel, boxGeo(doorW + 0.08, doorH + 0.08, 0.06, new THREE.Vector3(OX, doorY, OZ - bodyD / 2 - 0.03), ctx));
  pushGeo(ctx, ctx.mats.gunmetal, boxGeo(doorW, doorH, 0.04, new THREE.Vector3(OX, doorY, OZ - bodyD / 2 - 0.01), ctx));
  // door handle (copper cylinder along Z axis)
  const handleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8);
  handleGeo.rotateX(Math.PI / 2);
  handleGeo.translate(OX + doorW / 2 - 0.12, doorY, OZ - bodyD / 2 - 0.05);
  pushGeo(ctx, ctx.mats.copper, handleGeo);
  // hinges
  if (ctx.hi) {
    for (const fy of [-doorH / 2 + 0.1, doorH / 2 - 0.1]) {
      pushGeo(ctx, ctx.mats.gunmetal, boxGeo(0.06, 0.06, 0.04, new THREE.Vector3(OX - doorW / 2 + 0.05, doorY + fy, OZ - bodyD / 2 - 0.04), ctx));
    }
  }
  // Rear vent grille on +z side
  const ventW = 1.2, ventH = 0.7;
  const ventY = bodyY + 0.4;
  const ventZ = OZ + bodyD / 2 + 0.01;
  pushGeo(ctx, ctx.mats.darkSteel, boxGeo(ventW + 0.1, ventH + 0.1, 0.06, new THREE.Vector3(OX, ventY, ventZ), ctx));
  pushGeo(ctx, ctx.mats.gunmetal, boxGeo(ventW, ventH, 0.02, new THREE.Vector3(OX, ventY, ventZ - 0.01), ctx));
  const louvreCount = ctx.hi ? 8 : 4;
  for (let i = 0; i < louvreCount; i++) {
    const fy = (i - (louvreCount - 1) / 2) / ((louvreCount - 1) / 2);
    const yy = ventY + fy * (ventH / 2 - 0.04);
    const louvre = new THREE.BoxGeometry(ventW - 0.06, 0.04, 0.05);
    louvre.translate(OX, yy, ventZ + 0.02);
    louvre.rotateX(-0.3);
    pushGeo(ctx, ctx.mats.darkSteel, louvre);
  }
  // Side louvred panel on -x side
  if (ctx.hi) {
    const sideVentW = 0.9, sideVentH = 1.0;
    const sideVentY = bodyY;
    const sideVentX = OX - bodyW / 2 - 0.01;
    pushGeo(ctx, ctx.mats.darkSteel, boxGeo(0.06, sideVentH + 0.1, sideVentW + 0.1, new THREE.Vector3(sideVentX, sideVentY, OZ), ctx));
    pushGeo(ctx, ctx.mats.gunmetal, boxGeo(0.02, sideVentH, sideVentW, new THREE.Vector3(sideVentX - 0.01, sideVentY, OZ), ctx));
    const lCount = 5;
    for (let i = 0; i < lCount; i++) {
      const fy = (i - (lCount - 1) / 2) / ((lCount - 1) / 2);
      const yy = sideVentY + fy * (sideVentH / 2 - 0.04);
      const louvre = new THREE.BoxGeometry(0.05, 0.04, sideVentW - 0.06);
      louvre.translate(sideVentX - 0.02, yy, OZ);
      louvre.rotateY(0.3);
      pushGeo(ctx, ctx.mats.darkSteel, louvre);
    }
  }
  // Hopper
  const hopperW = 2.4, hopperD = 2.4, hopperH = 0.7;
  const hopperBaseY = footY + footH + bodyH;
  pushGeo(ctx, ctx.mats.darkSteel, boxGeo(hopperW, 0.05, hopperD, new THREE.Vector3(OX, hopperBaseY + 0.025, OZ), ctx));
  const wallT = 0.12;
  pushGeo(ctx, ctx.mats.gunmetal, boxGeo(hopperW + wallT * 2, hopperH, wallT, new THREE.Vector3(OX, hopperBaseY + hopperH / 2, OZ - hopperD / 2 - wallT / 2), ctx));
  pushGeo(ctx, ctx.mats.gunmetal, boxGeo(hopperW + wallT * 2, hopperH, wallT, new THREE.Vector3(OX, hopperBaseY + hopperH / 2, OZ + hopperD / 2 + wallT / 2), ctx));
  pushGeo(ctx, ctx.mats.gunmetal, boxGeo(wallT, hopperH, hopperD, new THREE.Vector3(OX - hopperW / 2 - wallT / 2, hopperBaseY + hopperH / 2, OZ), ctx));
  pushGeo(ctx, ctx.mats.gunmetal, boxGeo(wallT, hopperH, hopperD, new THREE.Vector3(OX + hopperW / 2 + wallT / 2, hopperBaseY + hopperH / 2, OZ), ctx));
  if (ctx.hi) {
    pushMany(ctx, ctx.mats.paint, chamferedBoxGeos(hopperW + wallT * 2 + 0.08, 0.08, hopperD + wallT * 2 + 0.08, 0.02, new THREE.Vector3(OX, hopperBaseY + hopperH + 0.04, OZ), ctx));
  }
  // Ore heap (deterministic random rocks)
  const rand = rng(0xC0FFEE);
  const oreColor = 0x1a1410;
  ctx.mats.darkSteel.color.setHex(oreColor);
  const oreTop = hopperBaseY + 0.05;
  const oreCount = ctx.hi ? 18 : 8;
  for (let i = 0; i < oreCount; i++) {
    const ang = rand() * PI2;
    const rad = rand() * (hopperW / 2 - 0.15);
    const yOff = oreTop + (1 - rad / (hopperW / 2)) * 0.45 + rand() * 0.08;
    const r = 0.18 + rand() * 0.18;
    const x = OX + Math.cos(ang) * rad;
    const z = OZ + Math.sin(ang) * rad;
    pushGeo(ctx, ctx.mats.darkSteel, cylGeo(r, r * 0.85, r * 1.2, ctx.hi ? 8 : 5, new THREE.Vector3(x, yOff, z), ctx));
  }
  ctx.mats.darkSteel.color.setHex(0x22262b);
  // Status lamps
  const lampY = footY + footH + 0.6;
  addLampMesh(ctx, ctx.mats.lampGreen, new THREE.Vector3(OX - 0.5, lampY, OZ - bodyD / 2 - 0.07), 0.06, 'mill_lamp_run');
  addLampMesh(ctx, ctx.mats.lampAmber, new THREE.Vector3(OX + 0.5, lampY, OZ - bodyD / 2 - 0.07), 0.06, 'mill_lamp_warn');
  // Sockets
  ctx.sockets.push({ name: 'vent', at: [OX, ventY, OZ + bodyD / 2 + 0.4] });
  ctx.sockets.push({ name: 'hopper', at: [OX, hopperBaseY + hopperH + 0.2, OZ] });
  ctx.sockets.push({ name: 'power', at: [OX - bodyW / 2 - 0.4, bodyY, OZ] });
  return finalize(ctx);
}

// ============================================================
// BIN
// ============================================================

export function bin(m: LabMaterials, opts: { stage: number }): Gear {
  const ctx = newCtx(m, opts.stage);
  const OX = 2, OZ = 2;
  // Four feet
  const footR = 0.07, footH = 0.08;
  const footY = footH;
  const footOffsets: ReadonlyArray<readonly [number, number]> = [
    [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6],
  ];
  for (const [sx, sz] of footOffsets) {
    pushGeo(ctx, ctx.mats.gunmetal, cylGeo(footR, footR, footH, 6, new THREE.Vector3(OX + sx, footY / 2, OZ + sz), ctx));
  }
  // Cabinet body
  const cabW = 1.6, cabH = 1.6, cabD = 1.0;
  const cabY = footH + cabH / 2;
  pushMany(ctx, ctx.mats.gunmetal, chamferedBoxGeos(cabW, cabH, cabD, ctx.hi ? 0.06 : 0, new THREE.Vector3(OX, cabY, OZ), ctx));
  pushGeo(ctx, ctx.mats.darkSteel, boxGeo(cabW + 0.08, 0.08, cabD + 0.08, new THREE.Vector3(OX, footH + cabH + 0.04, OZ), ctx));
  if (ctx.hi) {
    pushGeo(ctx, ctx.mats.paint, boxGeo(0.04, cabH - 0.2, cabD - 0.2, new THREE.Vector3(OX - cabW / 2 - 0.02, cabY, OZ), ctx));
    pushGeo(ctx, ctx.mats.paint, boxGeo(0.04, cabH - 0.2, cabD - 0.2, new THREE.Vector3(OX + cabW / 2 + 0.02, cabY, OZ), ctx));
  }
  // Front face details
  const frontZ = OZ - cabD / 2 - 0.01;
  if (ctx.hi) addSeam(ctx, OX - cabW / 2 + 0.05, footH + cabH - 0.2, frontZ, OX + cabW / 2 - 0.05, footH + 0.4, frontZ, 0.02);
  // keypad
  const kpW = 0.5, kpH = 0.4;
  pushGeo(ctx, ctx.mats.darkSteel, boxGeo(kpW, kpH, 0.04, new THREE.Vector3(OX - 0.3, footH + 0.6, frontZ - 0.02), ctx));
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const fx = (i - 1) / 2 * 0.12;
      const fy = (j - 1) / 2 * 0.12;
      pushGeo(ctx, ctx.mats.gunmetal, cylGeo(0.025, 0.025, 0.015, 5, new THREE.Vector3(OX - 0.3 + fx, footH + 0.6 + fy, frontZ - 0.045), ctx));
    }
  }
  // handle
  const handleY = footH + 0.7;
  const handleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6);
  handleGeo.rotateZ(Math.PI / 2);
  handleGeo.translate(OX + 0.4, handleY, frontZ - 0.04);
  pushGeo(ctx, ctx.mats.copper, handleGeo);
  pushGeo(ctx, ctx.mats.gunmetal, cylGeo(0.04, 0.04, 0.04, 6, new THREE.Vector3(OX + 0.4 - 0.15, handleY, frontZ - 0.04), ctx));
  pushGeo(ctx, ctx.mats.gunmetal, cylGeo(0.04, 0.04, 0.04, 6, new THREE.Vector3(OX + 0.4 + 0.15, handleY, frontZ - 0.04), ctx));
  // glass display strip
  pushGeo(ctx, ctx.mats.glass, boxGeo(0.4, 0.1, 0.02, new THREE.Vector3(OX + 0.1, footH + 1.2, frontZ - 0.02), ctx));
  // Dish emitter on top
  const dishBaseY = footH + cabH + 0.08;
  pushGeo(ctx, ctx.mats.gunmetal, cylGeo(0.06, 0.08, 0.18, ctx.hi ? 12 : 6, new THREE.Vector3(OX, dishBaseY + 0.09, OZ), ctx));
  const dishR = 0.32;
  const dishG = new THREE.SphereGeometry(dishR, ctx.hi ? 18 : 8, ctx.hi ? 10 : 5, 1, PI2, 0, Math.PI / 2.2);
  dishG.scale(1, 0.3, 1);
  dishG.translate(OX, dishBaseY + 0.18, OZ);
  dishG.rotateX(Math.PI);
  pushGeo(ctx, ctx.mats.paint, dishG);
  pushGeo(ctx, ctx.mats.copper, cylGeo(0.05, 0.05, 0.22, ctx.hi ? 10 : 6, new THREE.Vector3(OX, dishBaseY + 0.18 + 0.18, OZ), ctx));
  // Link beam (lamp)
  const linkGeo = new THREE.SphereGeometry(0.08, ctx.hi ? 10 : 6, 6);
  linkGeo.scale(1, 6, 1);
  const linkMesh = new THREE.Mesh(linkGeo, ctx.mats.lampBlue);
  linkMesh.position.set(OX, dishBaseY + 0.5, OZ);
  linkMesh.name = 'bin_link';
  ctx.lamps.push(linkMesh);
  ctx.group.add(linkMesh);
  ctx.sockets.push({ name: 'link', at: [OX, dishBaseY + 0.4, OZ] });
  return finalize(ctx);
}

// ============================================================
// REPEATER
// ============================================================

export function repeater(m: LabMaterials, opts: { stage: number }): Gear {
  const ctx = newCtx(m, opts.stage);
  const OX = 2, OZ = 2;
  // Concrete base 1.6 x 1.6 x 0.4
  const baseH = 0.4;
  pushGeo(ctx, ctx.mats.concrete, boxGeo(1.6, baseH, 1.6, new THREE.Vector3(OX, baseH / 2, OZ), ctx));
  addBolts(ctx, ctx.mats.gunmetal, OX, baseH, OZ, 1.6, 1.6, 0.15, 2, 2);
  // Distribution box at foot
  const boxW = 0.6, boxH = 0.5, boxD = 0.4;
  const boxX = OX + 1.6 / 2 + boxW / 2 + 0.05;
  const boxY = baseH + boxH / 2;
  pushMany(ctx, ctx.mats.gunmetal, chamferedBoxGeos(boxW, boxH, boxD, ctx.hi ? 0.04 : 0, new THREE.Vector3(boxX, boxY, OZ), ctx));
  pushGeo(ctx, ctx.mats.darkSteel, boxGeo(boxW - 0.1, boxH - 0.1, 0.02, new THREE.Vector3(boxX, boxY, OZ + boxD / 2 + 0.01), ctx));
  if (ctx.hi) {
    for (let i = 0; i < 4; i++) {
      const fx = (i - 1.5) / 1.5 * (boxW / 2 - 0.1);
      pushGeo(ctx, ctx.mats.copper, cylGeo(0.025, 0.025, 0.04, 5, new THREE.Vector3(boxX + fx, boxY + 0.1, OZ + boxD / 2 + 0.04), ctx));
    }
  }
  // Lattice tower
  const towerY0 = baseH;
  const towerH = 6.4;
  const towerY1 = towerY0 + towerH;
  const cornerCount = 4;
  const legR = ctx.hi ? 0.04 : 0.07;
  for (let c = 0; c < cornerCount; c++) {
    const a = (c / cornerCount) * PI2 + Math.PI / 4;
    const rBot = 0.55;
    const rTop = 0.32;
    const bot = new THREE.Vector3(OX + Math.cos(a) * rBot, towerY0, OZ + Math.sin(a) * rBot);
    const top = new THREE.Vector3(OX + Math.cos(a) * rTop, towerY1, OZ + Math.sin(a) * rTop);
    pushGeo(ctx, ctx.mats.darkSteel, orientCylinder(bot, top, legR, ctx.hi ? 6 : 4));
  }
  // Horizontal braces (square loops)
  const braceCount = ctx.hi ? 6 : 3;
  for (let i = 0; i < braceCount; i++) {
    const t = (i + 0.5) / braceCount;
    const y = towerY0 + t * towerH;
    const r = 0.55 * (1 - t) + 0.32 * t;
    for (let c = 0; c < 4; c++) {
      const a0 = (c / 4) * PI2 + Math.PI / 4;
      const a1 = ((c + 1) / 4) * PI2 + Math.PI / 4;
      const p0 = new THREE.Vector3(OX + Math.cos(a0) * r, y, OZ + Math.sin(a0) * r);
      const p1 = new THREE.Vector3(OX + Math.cos(a1) * r, y, OZ + Math.sin(a1) * r);
      pushGeo(ctx, ctx.mats.darkSteel, orientCylinder(p0, p1, legR * 0.7, ctx.hi ? 6 : 4));
    }
  }
  // Diagonal X-braces per bay
  if (ctx.hi) {
    const bays = braceCount - 1;
    for (let i = 0; i < bays; i++) {
      const t0 = (i + 0.0) / braceCount;
      const t1 = (i + 1.0) / braceCount;
      const y0 = towerY0 + t0 * towerH;
      const y1 = towerY0 + t1 * towerH;
      const r0 = 0.55 * (1 - t0) + 0.32 * t0;
      const r1 = 0.55 * (1 - t1) + 0.32 * t1;
      for (let f = 0; f < 4; f++) {
        const ang = (f / 4) * PI2 + Math.PI / 4;
        const a0 = new THREE.Vector3(OX + Math.cos(ang) * r0, y0, OZ + Math.sin(ang) * r0);
        const b1 = new THREE.Vector3(OX + Math.cos(ang + PI2 / 4) * r1, y1, OZ + Math.sin(ang + PI2 / 4) * r1);
        pushGeo(ctx, ctx.mats.darkSteel, orientCylinder(a0, b1, legR * 0.55, 6));
        const a1 = new THREE.Vector3(OX + Math.cos(ang + PI2 / 4) * r0, y0, OZ + Math.sin(ang + PI2 / 4) * r0);
        const b0 = new THREE.Vector3(OX + Math.cos(ang) * r1, y1, OZ + Math.sin(ang) * r1);
        pushGeo(ctx, ctx.mats.darkSteel, orientCylinder(a1, b0, legR * 0.55, 6));
      }
    }
  }
  // Top ring platform
  const topRingR = 0.45;
  const topRingY = towerY1 + 0.06;
  pushGeo(ctx, ctx.mats.gunmetal, ringGeo(topRingR + 0.05, topRingR - 0.1, 0.08, ctx.hi ? 18 : 10, new THREE.Vector3(OX, topRingY, OZ), ctx));
  // Ring of emitters
  const emitterCount = ctx.hi ? 8 : 4;
  const emitterR = 0.06;
  for (let i = 0; i < emitterCount; i++) {
    const a = (i / emitterCount) * PI2;
    const r = topRingR - 0.05;
    const ex = OX + Math.cos(a) * r;
    const ez = OZ + Math.sin(a) * r;
    const ey = topRingY + 0.06;
    const em = new THREE.CylinderGeometry(emitterR, emitterR, 0.14, ctx.hi ? 8 : 5, 1);
    em.translate(0, 0.07, 0);
    em.rotateZ(Math.PI / 2);
    em.rotateY(a + Math.PI / 2);
    em.translate(ex, ey, ez);
    pushGeo(ctx, ctx.mats.darkSteel, em);
    const bulb = new THREE.SphereGeometry(0.04, ctx.hi ? 10 : 5, 5);
    bulb.translate(0, 0, 0.07);
    bulb.rotateY(a + Math.PI / 2);
    bulb.translate(ex, ey, ez);
    const bulbMesh = new THREE.Mesh(bulb, ctx.mats.lampGreen);
    bulbMesh.name = `emitter_${i}`;
    ctx.lamps.push(bulbMesh);
    ctx.group.add(bulbMesh);
  }
  // Top stem + red lamp
  pushGeo(ctx, ctx.mats.gunmetal, cylGeo(0.03, 0.03, 0.5, 6, new THREE.Vector3(OX, topRingY + 0.25, OZ), ctx));
  const stemY = topRingY + 0.5;
  const topLamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, ctx.hi ? 10 : 5, 6), ctx.mats.lampRed);
  topLamp.position.set(OX, stemY, OZ);
  topLamp.name = 'repeater_top_lamp';
  ctx.lamps.push(topLamp);
  ctx.group.add(topLamp);
  // Sockets
  ctx.sockets.push({ name: 'top', at: [OX, topRingY + 0.1, OZ] });
  ctx.sockets.push({ name: 'box', at: [boxX, boxY, OZ] });
  return finalize(ctx);
}

// ============================================================
// DRAFTING TABLE
// ============================================================

export function draftingTable(m: LabMaterials, opts: { stage: number }): Gear {
  const ctx = newCtx(m, opts.stage);
  const OX = 2, OZ = 2;
  const tableW = 2.4, tableD = 1.2, tableH = 0.08;
  const tableY = 0.95 - tableH / 2;
  pushMany(ctx, ctx.mats.paint, chamferedBoxGeos(tableW, tableH, tableD, ctx.hi ? 0.04 : 0, new THREE.Vector3(OX, tableY, OZ), ctx));
  // Inset screen recess
  const scrW = 1.4, scrD = 0.7;
  const scrY = tableY + tableH / 2 + 0.005;
  pushGeo(ctx, ctx.mats.darkSteel, boxGeo(scrW + 0.06, 0.02, scrD + 0.06, new THREE.Vector3(OX, scrY - 0.01, OZ), ctx));
  // screen (lamp)
  const screenGeo = new THREE.BoxGeometry(scrW, 0.02, scrD);
  const screenMesh = new THREE.Mesh(screenGeo, ctx.mats.lampBlue);
  screenMesh.position.set(OX, scrY, OZ);
  screenMesh.name = 'drafting_screen';
  ctx.lamps.push(screenMesh);
  ctx.group.add(screenMesh);
  // UI grid lines
  if (ctx.hi) {
    for (let i = 1; i < 6; i++) {
      const fx = (i / 6 - 0.5) * scrW;
      pushGeo(ctx, ctx.mats.darkSteel, boxGeo(0.005, 0.005, scrD - 0.04, new THREE.Vector3(OX + fx, scrY + 0.015, OZ), ctx));
    }
    for (let i = 1; i < 3; i++) {
      const fz = (i / 3 - 0.5) * scrD;
      pushGeo(ctx, ctx.mats.darkSteel, boxGeo(scrW - 0.04, 0.005, 0.005, new THREE.Vector3(OX, scrY + 0.015, OZ + fz), ctx));
    }
  }
  // Decorative cube
  const cubeX = OX + tableW / 2 - 0.2;
  const cubeZ = OZ + tableD / 2 - 0.2;
  pushGeo(ctx, ctx.mats.copper, boxGeo(0.16, 0.16, 0.16, new THREE.Vector3(cubeX, tableY + tableH / 2 + 0.08, cubeZ), ctx));
  // Material swatch
  const swX = OX + tableW / 2 - 0.5;
  const swZ = OZ - tableD / 2 + 0.18;
  pushGeo(ctx, ctx.mats.darkSteel, boxGeo(0.24, 0.02, 0.16, new THREE.Vector3(swX, tableY + tableH / 2 + 0.02, swZ), ctx));
  pushGeo(ctx, ctx.mats.paint, boxGeo(0.05, 0.012, 0.05, new THREE.Vector3(swX - 0.06, tableY + tableH / 2 + 0.025, swZ), ctx));
  pushGeo(ctx, ctx.mats.hazard, boxGeo(0.05, 0.012, 0.05, new THREE.Vector3(swX, tableY + tableH / 2 + 0.025, swZ), ctx));
  pushGeo(ctx, ctx.mats.copper, boxGeo(0.05, 0.012, 0.05, new THREE.Vector3(swX + 0.06, tableY + tableH / 2 + 0.025, swZ), ctx));
  // Braced legs
  const legY0 = tableY - tableH / 2;
  const legH = legY0;
  const legR = 0.05;
  const legOffsets: ReadonlyArray<readonly [number, number]> = [
    [OX - tableW / 2 + 0.15, OZ - tableD / 2 + 0.1],
    [OX + tableW / 2 - 0.15, OZ - tableD / 2 + 0.1],
    [OX - tableW / 2 + 0.15, OZ + tableD / 2 - 0.1],
    [OX + tableW / 2 - 0.15, OZ + tableD / 2 - 0.1],
  ];
  for (const [x, z] of legOffsets) {
    const leg = new THREE.CylinderGeometry(legR, legR, legH, ctx.hi ? 6 : 4, 1);
    leg.translate(x, legH / 2, z);
    pushGeo(ctx, ctx.mats.darkSteel, leg);
    pushGeo(ctx, ctx.mats.rubber, cylGeo(0.09, 0.09, 0.04, 6, new THREE.Vector3(x, 0.02, z), ctx));
  }
  // Cross braces
  const braceY = legH * 0.4;
  const longPairs: ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]> = [
    [legOffsets[0]!, legOffsets[1]!],
    [legOffsets[2]!, legOffsets[3]!],
  ];
  for (const [a, b] of longPairs) {
    const dir = new THREE.Vector3(b[0] - a[0], 0, b[1] - a[1]);
    const len = dir.length();
    const brace = new THREE.CylinderGeometry(legR * 0.6, legR * 0.6, len, 6, 1);
    brace.translate(0, len / 2, 0);
    brace.translate(a[0], braceY, a[1]);
    pushGeo(ctx, ctx.mats.darkSteel, brace);
  }
  const shortPairs: ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]> = [
    [legOffsets[0]!, legOffsets[2]!],
    [legOffsets[1]!, legOffsets[3]!],
  ];
  for (const [a, b] of shortPairs) {
    const dir = new THREE.Vector3(b[0] - a[0], 0, b[1] - a[1]);
    const len = dir.length();
    const brace = new THREE.CylinderGeometry(legR * 0.6, legR * 0.6, len, 6, 1);
    brace.translate(0, len / 2, 0);
    brace.translate(a[0], braceY, a[1]);
    pushGeo(ctx, ctx.mats.darkSteel, brace);
  }
  // Side cabinet
  const cabX = OX - tableW / 2 - 0.35;
  const cabW2 = 0.6, cabH2 = 0.6, cabD2 = 0.5;
  const cabY = cabH2 / 2;
  pushMany(ctx, ctx.mats.gunmetal, chamferedBoxGeos(cabW2, cabH2, cabD2, ctx.hi ? 0.03 : 0, new THREE.Vector3(cabX, cabY, OZ), ctx));
  pushGeo(ctx, ctx.mats.darkSteel, boxGeo(cabW2 - 0.05, 0.2, 0.02, new THREE.Vector3(cabX, cabY + 0.15, OZ + cabD2 / 2 + 0.01), ctx));
  pushGeo(ctx, ctx.mats.darkSteel, boxGeo(cabW2 - 0.05, 0.2, 0.02, new THREE.Vector3(cabX, cabY - 0.15, OZ + cabD2 / 2 + 0.01), ctx));
  pushGeo(ctx, ctx.mats.copper, boxGeo(cabW2 - 0.3, 0.02, 0.03, new THREE.Vector3(cabX, cabY + 0.15, OZ + cabD2 / 2 + 0.03), ctx));
  pushGeo(ctx, ctx.mats.copper, boxGeo(cabW2 - 0.3, 0.02, 0.03, new THREE.Vector3(cabX, cabY - 0.15, OZ + cabD2 / 2 + 0.03), ctx));
  ctx.sockets.push({ name: 'screen', at: [OX, scrY + 0.05, OZ] });
  return finalize(ctx);
}

// ============================================================
// Triangle counter
// ============================================================

export function triangles(g: Gear): number {
  let total = 0;
  g.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const geo = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geo) return;
    const idx = geo.getIndex();
    if (idx) {
      total += idx.count / 3;
    } else {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (pos) total += pos.count / 3;
    }
  });
  return Math.floor(total);
}
