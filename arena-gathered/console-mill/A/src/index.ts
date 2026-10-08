/**
 * Sci-fi lab props built procedurally from three.js geometry.
 *  - operatorConsole(): a 1970s-style power-station control desk on a pedestal.
 *  - textureMill(): a boxy field grinding mill on four bolted feet.
 * Units are metres, +y is up, each prop faces +z and is centred on x = 0, z = 0.
 * No DOM, no Date, no Math.random — all variation comes from a seeded hash.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Box { min: [number, number, number]; max: [number, number, number] }
export interface Socket { name: string; at: [number, number, number] }
export interface Prop {
  group: THREE.Group;
  colliders: Box[];
  sockets: Socket[];
  /** Lamps and glowing parts, each with its own material, so each can be lit alone. */
  lamps: THREE.Mesh[];
}
export interface LabMaterials {
  gunmetal: THREE.MeshStandardMaterial; darkSteel: THREE.MeshStandardMaterial; paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial; rubber: THREE.MeshStandardMaterial; hazard: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial; concrete: THREE.MeshStandardMaterial;
}

/* ------------------------------------------------------------------ */
/* small deterministic helpers                                         */
/* ------------------------------------------------------------------ */

type V3 = readonly [number, number, number];
type V2 = readonly [number, number];

/** Seeded pseudo-random stream (mulberry32-style). */
function hash(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Position hash, stable for coincident vertices (used to crumple ore rocks). */
function hash3(x: number, y: number, z: number): number {
  let n = Math.imul(Math.round(x * 511) + 0x9e3779b9, 374761393);
  n = Math.imul(n ^ Math.round(y * 511), 668265263);
  n = Math.imul(n ^ Math.round(z * 511), 974593);
  n ^= n >>> 13; n = Math.imul(n, 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** Matrix from translation + XYZ euler + uniform scale. */
function tf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ')),
    new THREE.Vector3(s, s, s),
  );
}
function mul(...ms: THREE.Matrix4[]): THREE.Matrix4 {
  const out = new THREE.Matrix4();
  for (const m of ms) out.multiply(m);
  return out;
}

/** Triangle-soup accumulator with per-face normals and box-projected UVs. */
class Tris {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];
  tri(a: V3, b: V3, c: V3, n: V3): void {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
    const cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
    let v1 = b, v2 = c;
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { v1 = c; v2 = b; }
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    const nx = n[0] / l, ny = n[1] / l, nz = n[2] / l;
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    for (const p of [a, v1, v2]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      if (ax >= ay && ax >= az) this.uv.push(p[2], p[1]);
      else if (ay >= az) this.uv.push(p[0], p[2]);
      else this.uv.push(p[0], p[1]);
    }
  }
  quad(a: V3, b: V3, c: V3, d: V3, n: V3): void { this.tri(a, b, c, n); this.tri(a, c, d, n); }
  geo(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

/** Box with 45-degree chamfers on all 12 edges (26 faces, 44 triangles). */
function chamferBox(w: number, h: number, d: number, c: number): THREE.BufferGeometry {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const cc = Math.min(c, hx * 0.45, hy * 0.45, hz * 0.45);
  const P = (sx: number, sy: number, sz: number, axis: number): V3 =>
    axis === 0 ? [sx * hx, sy * (hy - cc), sz * (hz - cc)] :
    axis === 1 ? [sx * (hx - cc), sy * hy, sz * (hz - cc)] :
                 [sx * (hx - cc), sy * (hy - cc), sz * hz];
  const t = new Tris();
  const S = [-1, 1] as const;
  const dir = (axis: number, s: number): V3 =>
    axis === 0 ? [s, 0, 0] : axis === 1 ? [0, s, 0] : [0, 0, s];
  // 6 main faces
  for (let axis = 0; axis < 3; axis++) for (const s of S) {
    const sgn = (u: number, v: number): [number, number, number] =>
      axis === 0 ? [s, u, v] : axis === 1 ? [u, s, v] : [u, v, s];
    const q = [sgn(1, 1), sgn(1, -1), sgn(-1, -1), sgn(-1, 1)]
      .map(([a, b2, c2]) => P(a, b2, c2, axis));
    t.quad(q[0]!, q[1]!, q[2]!, q[3]!, dir(axis, s));
  }
  // 12 edge bevels
  const pairs: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, 2], [1, 2]];
  for (const [a1, a2] of pairs) for (const s1 of S) for (const s2 of S) {
    const a3 = 3 - a1 - a2;
    const sgn = (s3: number): [number, number, number] => {
      const out: [number, number, number] = [0, 0, 0];
      out[a1] = s1; out[a2] = s2; out[a3] = s3;
      return out;
    };
    const pp = sgn(1), pm = sgn(-1);
    const n: V3 = [
      (a1 === 0 ? s1 : 0) + (a2 === 0 ? s2 : 0),
      (a1 === 1 ? s1 : 0) + (a2 === 1 ? s2 : 0),
      (a1 === 2 ? s1 : 0) + (a2 === 2 ? s2 : 0),
    ];
    t.quad(
      P(pp[0], pp[1], pp[2], a1), P(pp[0], pp[1], pp[2], a2),
      P(pm[0], pm[1], pm[2], a2), P(pm[0], pm[1], pm[2], a1), n);
  }
  // 8 corner facets
  for (const sx of S) for (const sy of S) for (const sz of S) {
    t.tri(P(sx, sy, sz, 0), P(sx, sy, sz, 1), P(sx, sy, sz, 2), [sx, sy, sz]);
  }
  return t.geo();
}

/** Convex prism: cross-section polygon in the x-y plane (CCW), extruded along z. */
function prism(pts: ReadonlyArray<V2>, depth: number): THREE.BufferGeometry {
  const hz = depth / 2, n = pts.length, t = new Tris();
  for (let i = 0; i < n; i++) {
    const a = pts[i]!, b = pts[(i + 1) % n]!;
    const nn: V3 = [b[1] - a[1], -(b[0] - a[0]), 0];
    t.quad([a[0], a[1], hz], [b[0], b[1], hz], [b[0], b[1], -hz], [a[0], a[1], -hz], nn);
  }
  const p0 = pts[0]!;
  for (let i = 1; i < n - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    t.tri([p0[0], p0[1], hz], [a[0], a[1], hz], [b[0], b[1], hz], [0, 0, 1]);
    t.tri([p0[0], p0[1], -hz], [a[0], a[1], -hz], [b[0], b[1], -hz], [0, 0, -1]);
  }
  return t.geo();
}

/** Offsets a CCW polygon outward by d (mitred). */
function offsetPoly(pts: ReadonlyArray<V2>, d: number): V2[] {
  const n = pts.length, out: V2[] = [];
  const en = (a: V2, b: V2): V2 => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
  };
  for (let i = 0; i < n; i++) {
    const p = pts[i]!, prev = pts[(i + n - 1) % n]!, next = pts[(i + 1) % n]!;
    const n1 = en(prev, p), n2 = en(p, next);
    let nx = n1[0] + n2[0], ny = n1[1] + n2[1];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const k = 1 / Math.max(0.4, nx * n1[0] + ny * n1[1]);
    out.push([p[0] + nx * d * k, p[1] + ny * d * k]);
  }
  return out;
}

/** RGBA DataTexture from a per-pixel callback (no canvas anywhere). */
function dataTex(w: number, h: number, px: (x: number, y: number) => V3, repeat = false): THREE.DataTexture {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = px(x, y);
    const i = (y * w + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, w, h);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}

/** Merges everything added with the same material into one mesh. */
class Builder {
  private readonly buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  constructor(private readonly facetAll: boolean) {}
  add(geo: THREE.BufferGeometry, mat: THREE.Material, mtx?: THREE.Matrix4, facet = false): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (mtx) g.applyMatrix4(mtx);
    if (facet || this.facetAll) g.computeVertexNormals();
    const list = this.buckets.get(mat);
    if (list) list.push(g); else this.buckets.set(mat, [g]);
  }
  meshes(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [mat, geos] of this.buckets) {
      const first = geos[0];
      if (!first) continue;
      const merged = geos.length === 1 ? first : mergeGeometries(geos);
      if (!merged) throw new Error('geometry merge failed');
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      out.push(mesh);
    }
    return out;
  }
}

function makeLamp(color: number, geo: THREE.BufferGeometry, mtx: THREE.Matrix4, glow: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: glow, roughness: 0.35, metalness: 0,
  });
  const mesh = new THREE.Mesh(geo.index ? geo.toNonIndexed() : geo, mat);
  mesh.applyMatrix4(mtx);
  mesh.castShadow = false;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* shared materials                                                    */
/* ------------------------------------------------------------------ */

export function createMaterials(): LabMaterials {
  // diagonal yellow/black hazard stripes
  const hazardTex = dataTex(64, 64,
    (x, y) => (Math.floor(((x + y) % 64) / 8) % 2 === 0 ? [228, 188, 24] : [28, 28, 30]), true);
  hazardTex.repeat.set(4, 4);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xa8c3ce, transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0,
    side: THREE.DoubleSide,
  });
  glass.transmission = 0; // plain transparency only — never transmission
  return {
    gunmetal: new THREE.MeshStandardMaterial({ color: 0x575d66, metalness: 0.88, roughness: 0.34 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.75, roughness: 0.52 }),
    paint: new THREE.MeshStandardMaterial({ color: 0x99a1a3, metalness: 0.15, roughness: 0.55 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb3673a, metalness: 0.95, roughness: 0.32 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141415, metalness: 0, roughness: 0.95 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTex, metalness: 0.1, roughness: 0.65 }),
    glass,
    concrete: new THREE.MeshStandardMaterial({ color: 0x8e8c85, metalness: 0, roughness: 0.95 }),
  };
}

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material as THREE.MeshStandardMaterial;
  mat.emissiveIntensity = Math.max(0, glow) * 2;
}

export function triangles(p: Prop): number {
  let t = 0;
  p.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    t += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  return t;
}

/* ------------------------------------------------------------------ */
/* the operator's console                                              */
/* ------------------------------------------------------------------ */

export function operatorConsole(m: LabMaterials): Prop & { lever: THREE.Object3D; screen: THREE.Mesh } {
  const b = new Builder(false);
  const rnd = hash(0xc0501e);
  const group = new THREE.Group();
  group.name = 'operatorConsole';

  /* ---- pedestal, plinth, anchor bolts, floor grommet ---- */
  b.add(chamferBox(0.68, 0.09, 0.5, 0.012), m.darkSteel, tf(0, 0.045, 0));            // plinth
  b.add(chamferBox(0.6, 0.66, 0.45, 0.015), m.paint, tf(0, 0.41, 0));                 // pedestal
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.017, 0.017, 0.006, 8), m.darkSteel, tf(sx * 0.3, 0.092, sz * 0.215)); // washer
    b.add(new THREE.CylinderGeometry(0.011, 0.011, 0.026, 6), m.darkSteel, tf(sx * 0.3, 0.105, sz * 0.215)); // anchor bolt
  }
  // signal cables run down inside the pedestal into this flush copper-ringed grommet
  b.add(new THREE.CylinderGeometry(0.085, 0.098, 0.022, 14), m.copper, tf(0, 0.011, 0));

  /* ---- recessed service door on the pedestal front (z = +0.225) ---- */
  b.add(new THREE.BoxGeometry(0.42, 0.5, 0.01), m.darkSteel, tf(0, 0.4, 0.2225));     // shadow frame
  b.add(chamferBox(0.36, 0.44, 0.018, 0.005), m.paint, tf(0, 0.4, 0.215));            // recessed door leaf
  for (const hy of [0.27, 0.53]) {
    b.add(new THREE.CylinderGeometry(0.009, 0.009, 0.06, 8), m.gunmetal, tf(-0.155, hy, 0.229));   // hinge barrels
  }
  b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.028, 6), m.gunmetal, tf(0.125, 0.4, 0.238, Math.PI / 2)); // handle post
  b.add(chamferBox(0.016, 0.09, 0.012, 0.004), m.rubber, tf(0.125, 0.4, 0.25));       // handle bar

  /* ---- desk slab, kick vents, riser and raised upper panel ---- */
  b.add(chamferBox(1.2, 0.32, 0.7, 0.02), m.paint, tf(0, 0.89, 0));                   // desk body (top edge 1.05)
  for (let i = 0; i < 4; i++) {
    b.add(new THREE.BoxGeometry(0.16, 0.014, 0.006), m.darkSteel, tf(-0.33 + i * 0.22, 0.8, 0.351)); // vent slots
  }
  b.add(chamferBox(1.2, 0.3, 0.26, 0.02), m.paint, tf(0, 1.1, -0.235));               // riser under upper panel
  const SP = tf(0, 1.125, 0.11, 0.35);                                                // sloped panel frame (20 deg)
  b.add(chamferBox(1.16, 0.06, 0.5, 0.015), m.paint, SP);
  const UP = tf(0, 1.335, -0.26, -0.12);                                              // upper panel, leaning back
  b.add(chamferBox(1.2, 0.36, 0.1, 0.02), m.paint, UP);
  const upAt = (u: number, v: number, dz = 0, rx = 0): THREE.Matrix4 => mul(UP, tf(u, v, 0.05 + dz, rx));
  const spAt = (u: number, v: number, dy = 0, rx = 0): THREE.Matrix4 => mul(SP, tf(u, 0.03 + dy, v, rx));

  /* ---- four round analogue gauges (chrome bezel, white face, needle, glass) ---- */
  const gaugeTex = dataTex(64, 64, (x, y) => {
    const dx = x - 32, dy = y - 30;
    const r = Math.hypot(dx, dy);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (r < 2.6) return [22, 22, 24];
    if (r >= 18 && r <= 25 && deg >= -30 && deg <= 210) {
      const rel = (deg + 30) / 240;
      const tick = Math.abs(rel * 10 - Math.round(rel * 10));
      if (tick < 0.1 && r >= 19.5) return [25, 25, 28];
      if (rel > 0.84 && r >= 22) return [206, 44, 40];
    }
    if (r > 29) return [44, 46, 49];
    return [237, 238, 231];
  });
  const gaugeMat = new THREE.MeshStandardMaterial({ map: gaugeTex, metalness: 0, roughness: 0.5 });
  for (const [gu, gv] of [[-0.44, 0.08], [-0.24, 0.08], [-0.44, -0.08], [-0.24, -0.08]] as const) {
    b.add(new THREE.CylinderGeometry(0.056, 0.06, 0.022, 20, 1, true), m.gunmetal, mul(UP, tf(gu, gv, 0.05, Math.PI / 2)));
    b.add(new THREE.TorusGeometry(0.052, 0.008, 10, 20), m.gunmetal, upAt(gu, gv, 0.012));          // chrome rim
    b.add(new THREE.CircleGeometry(0.048, 20), gaugeMat, upAt(gu, gv, 0.004));                      // dial face
    const ang = 1.15 - rnd() * 2.0;                                                                 // needle, seeded
    b.add(new THREE.BoxGeometry(0.006, 0.042, 0.003), m.darkSteel, mul(UP, tf(gu, gv, 0.057, 0, 0, ang), tf(0, 0.015, 0)));
    b.add(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 8), m.gunmetal, mul(UP, tf(gu, gv, 0.058, Math.PI / 2)));
    b.add(new THREE.CircleGeometry(0.05, 20), m.glass, upAt(gu, gv, 0.017));                        // glass cover
  }

  /* ---- green-phosphor screen with a waveform trace (DataTexture) ---- */
  const scrTex = dataTex(128, 96, (x, y) => {
    let r = 5, g = 16, bl = 9;
    if (x % 16 === 0 || y % 16 === 0) g = 30;                      // graticule
    const t = (x / 128) * Math.PI * 4;
    const yc = 48 + 24 * Math.sin(t) * (0.45 + 0.55 * Math.sin(x * 0.058 + 2.1));
    const d = Math.abs(y - yc);
    if (d < 1.8) { r = 96; g = 255; bl = 132; }
    else if (d < 5) g = Math.max(g, Math.round(140 - d * 26));
    if (y % 2 === 0) g = Math.max(8, g - 6);                       // scanlines
    return [r, g, bl];
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x05140b, emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 1.25, roughness: 0.3, metalness: 0,
  });
  b.add(chamferBox(0.28, 0.21, 0.026, 0.007), m.darkSteel, upAt(0.1, 0.015, 0.002));  // CRT bezel
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 6), m.gunmetal, mul(UP, tf(0.1 + sx * 0.125, 0.015 + sy * 0.09, 0.066, Math.PI / 2)));
  }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.15), screenMat);
  screen.name = 'screen';
  screen.applyMatrix4(upAt(0.1, 0.015, 0.018));

  /* ---- keypad: 3 x 4 grid of keys beside the screen ---- */
  b.add(chamferBox(0.15, 0.21, 0.016, 0.005), m.darkSteel, upAt(0.35, 0.0, 0.002));
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    b.add(chamferBox(0.032, 0.03, 0.016, 0.004), m.rubber, upAt(0.35 + (col - 1) * 0.044, 0.068 - row * 0.046, 0.014));
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.005, 0.005, 0.008, 6), m.gunmetal, mul(UP, tf(sx * 0.565, sy * 0.155, 0.052, Math.PI / 2)));
  }

  /* ---- sloped panel: six toggles, two lit push buttons, two indicator lamps ---- */
  for (let i = 0; i < 6; i++) {
    const u = -0.4 + i * 0.056, tilt = i % 2 === 0 ? 0.5 : -0.5;
    b.add(new THREE.CylinderGeometry(0.0185, 0.021, 0.01, 12), m.gunmetal, spAt(u, -0.04, 0.004)); // round base
    b.add(new THREE.CylinderGeometry(0.0045, 0.0062, 0.034, 8), m.gunmetal, mul(SP, tf(u, 0.03, -0.04, tilt), tf(0, 0.02, 0)));
    b.add(new THREE.SphereGeometry(0.0068, 8, 4), m.rubber, mul(SP, tf(u, 0.03, -0.04, tilt), tf(0, 0.038, 0)));
  }
  const lamps: THREE.Mesh[] = [];
  const buttonCols: ReadonlyArray<readonly [number, number]> = [[0.1, 0xd4312e], [0.19, 0x2fae4e]];
  for (const [u, col] of buttonCols) {
    b.add(new THREE.CylinderGeometry(0.026, 0.03, 0.016, 14), m.gunmetal, spAt(u, 0.1, 0.005));    // bezel
    lamps.push(makeLamp(col, new THREE.CylinderGeometry(0.017, 0.017, 0.014, 14), spAt(u, 0.1, 0.014), 0.25));
  }
  const indCols: ReadonlyArray<readonly [number, number]> = [[0.33, 0x3ddc64], [0.41, 0xffb12e]];
  const indicators: THREE.Mesh[] = [];
  for (const [u, col] of indCols) {
    b.add(new THREE.CylinderGeometry(0.016, 0.019, 0.012, 12), m.gunmetal, spAt(u, 0.1, 0.004));
    indicators.push(makeLamp(col, new THREE.SphereGeometry(0.0125, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2 + 0.35), spAt(u, 0.1, 0.009), 0.9));
  }
  lamps.unshift(...indicators);                                    // lamps[0] green, lamps[1] amber
  for (const sx of [-1, 1]) for (const v of [-0.08, 0.21]) {
    b.add(new THREE.CylinderGeometry(0.005, 0.005, 0.008, 6), m.gunmetal, spAt(sx * 0.545, v, 0.002));
  }

  /* ---- main lever on a slotted quadrant plate, right end of the desk ---- */
  const px = 0.625, py = 1.03, pz = 0.06;
  b.add(chamferBox(0.06, 0.1, 0.16, 0.01), m.darkSteel, tf(0.615, 0.99, pz));         // mount bracket into desk side
  for (const plateX of [0.605, 0.645]) {                                              // two plates = the slot
    b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 16, 1, false, 0.45, 1.55), m.darkSteel, tf(plateX, py, pz, 0, 0, Math.PI / 2));
  }
  for (const th of [0.55, 1.22, 1.9]) {                                               // spacer studs between plates
    b.add(new THREE.CylinderGeometry(0.0065, 0.0065, 0.052, 6), m.gunmetal, tf(px, py + 0.155 * Math.sin(th), pz + 0.155 * Math.cos(th), 0, 0, Math.PI / 2));
  }
  b.add(new THREE.CylinderGeometry(0.032, 0.032, 0.075, 14), m.gunmetal, tf(px, py, pz, 0, 0, Math.PI / 2)); // pivot hub
  b.add(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 6), m.darkSteel, tf(px + 0.043, py, pz, 0, 0, Math.PI / 2)); // end nut

  // holder is flipped so lever.rotation.x = -1.1 throws the grip FORWARD (+z).
  const holder = new THREE.Group();
  holder.position.set(px, py, pz);
  holder.rotation.y = Math.PI;
  const lever = new THREE.Group();
  lever.name = 'lever';
  holder.add(lever);
  const lean = tf(0, 0, 0, 0.2);                                   // OFF pose: up and leaning back
  const armGeos: THREE.BufferGeometry[] = [];
  const armAdd = (g: THREE.BufferGeometry, mtx: THREE.Matrix4): void => {
    const ng = g.index ? g.toNonIndexed() : g; ng.applyMatrix4(mtx); armGeos.push(ng);
  };
  armAdd(new THREE.CylinderGeometry(0.011, 0.015, 0.3, 10), mul(lean, tf(0, 0.16, 0)));          // steel arm
  armAdd(new THREE.CylinderGeometry(0.026, 0.026, 0.085, 12), tf(0, 0, 0, 0, 0, Math.PI / 2));   // arm boss on hub
  armAdd(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 10), mul(lean, tf(0, -0.055, 0)));       // counterweight stub
  const armMerged = mergeGeometries(armGeos);
  if (!armMerged) throw new Error('lever merge failed');
  const armMesh = new THREE.Mesh(armMerged, m.gunmetal);
  armMesh.castShadow = true;
  const gripMat = new THREE.MeshStandardMaterial({ color: 0xc3272b, metalness: 0.1, roughness: 0.45 });
  const gripMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.06, 4, 10), gripMat);
  gripMesh.applyMatrix4(mul(lean, tf(0, 0.345, 0)));
  gripMesh.castShadow = true;
  lever.add(armMesh, gripMesh);

  /* ---- assemble ---- */
  for (const mesh of b.meshes()) group.add(mesh);
  group.add(holder, screen, ...lamps);

  const colliders: Box[] = [
    { min: [-0.35, 0, -0.26], max: [0.35, 0.74, 0.26] },           // pedestal + plinth
    { min: [-0.67, 0.72, -0.36], max: [0.7, 1.52, 0.36] },         // desk, panels, lever
  ];
  const sockets: Socket[] = [{ name: 'cable', at: [0, 0.02, 0] }]; // flush floor grommet under the pedestal
  return { group, colliders, sockets, lamps, lever, screen };
}

/* ------------------------------------------------------------------ */
/* the texture mill                                                    */
/* ------------------------------------------------------------------ */

export function textureMill(m: LabMaterials, o?: { stage?: number }): Prop {
  const stage = o?.stage ?? 6;
  const hi = stage >= 2;
  const b = new Builder(!hi);                                      // stage 0/1: everything flat shaded
  const rnd = hash(0x717e);
  const group = new THREE.Group();
  group.name = `textureMill:${stage}`;

  // own materials (flat-shaded copies at stage 1)
  const paint = new THREE.MeshStandardMaterial({ color: 0xccc5b3, metalness: 0.12, roughness: 0.6, flatShading: !hi });
  const ore = new THREE.MeshStandardMaterial({ color: 0x9c9080, metalness: 0.02, roughness: 0.95, flatShading: true });
  const voidDark = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, metalness: 0.2, roughness: 0.9, flatShading: !hi });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff3d8a, metalness: 0.05, roughness: 0.5, flatShading: !hi });
  const stripeTex = dataTex(32, 32, (x) => (Math.floor(x / 8) % 2 === 0 ? [255, 61, 138] : [240, 238, 235]), true);
  stripeTex.repeat.set(8, 8);
  const cartMat = new THREE.MeshStandardMaterial({ map: stripeTex, metalness: 0.05, roughness: 0.45, flatShading: !hi });

  /* ---- body: octagonal section (45-degree chamfered top edges), split by a seam band ---- */
  const sec: ReadonlyArray<V2> = [
    [-0.5, 0.15], [0.5, 0.15], [0.55, 0.2], [0.55, 1.06],
    [0.33, 1.28], [-0.33, 1.28], [-0.55, 1.06], [-0.55, 0.2],
  ];
  b.add(prism(sec, 1.66), paint);
  b.add(prism(offsetPoly(sec, 0.012), 0.045), paint, tf(0, 0, 0.12));                 // front/rear split seam
  if (hi) b.add(prism(offsetPoly(sec, 0.01), 0.03), paint, tf(0, 0, -0.62));          // rear panel seam

  /* ---- pyramid boss panel on the front face ---- */
  b.add(hi ? chamferBox(0.52, 0.52, 0.03, 0.008) : new THREE.BoxGeometry(0.52, 0.52, 0.03), paint, tf(0, 0.72, 0.84));
  {
    const cone = new THREE.ConeGeometry(0.34, 0.08, 4);
    cone.rotateY(Math.PI / 4);
    cone.rotateX(Math.PI / 2);
    b.add(cone, paint, tf(0, 0.72, 0.855));
  }
  if (hi) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.011, 0.011, 0.018, 6), m.gunmetal, tf(sx * 0.23, 0.72 + sy * 0.23, 0.858, Math.PI / 2));
  }

  /* ---- rivets along the panel seams (full detail only) ---- */
  if (hi) {
    const rivet = (): THREE.BufferGeometry => new THREE.SphereGeometry(0.0095, 6, 4);
    for (const sx of [-1, 1]) for (let i = 0; i < 8; i++) {
      b.add(rivet(), m.gunmetal, tf(sx * 0.4445, 1.1745, -0.7 + i * 0.2));            // top chamfer edges
    }
    const ring = offsetPoly(sec, 0.018);
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i]!, c = ring[(i + 1) % ring.length]!;
      b.add(rivet(), m.gunmetal, tf((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 0.12));     // around the seam band
    }
  }

  /* ---- feed hopper at the front, heaped with faceted ore chunks ---- */
  const H = tf(0, 1.41, 0.52, 0.12);                               // leans forward 0.12 rad
  const squared = (g: THREE.BufferGeometry): THREE.BufferGeometry => { g.rotateY(Math.PI / 4); return g; };
  b.add(squared(new THREE.CylinderGeometry(0.34, 0.16, 0.3, 4, 1, true)), paint, H);              // trapezoid tray
  b.add(squared(new THREE.CylinderGeometry(0.31, 0.14, 0.26, 4)), voidDark, mul(H, tf(0, -0.012, 0))); // dark mouth
  b.add(squared(new THREE.CylinderGeometry(0.355, 0.335, 0.032, 4, 1, true)), paint, mul(H, tf(0, 0.145, 0))); // rim
  b.add(new THREE.CylinderGeometry(0.13, 0.17, 0.12, hi ? 12 : 6), paint, tf(0, 1.27, 0.52));     // throat into body
  const rocks = hi ? 11 : 8;
  for (let i = 0; i < rocks; i++) {
    const g = new THREE.IcosahedronGeometry(1, hi ? 1 : 0);
    const pa = g.getAttribute('position');
    for (let v = 0; v < pa.count; v++) {
      const k = 0.72 + 0.55 * hash3(pa.getX(v), pa.getY(v), pa.getZ(v) + i);
      pa.setXYZ(v, pa.getX(v) * k, pa.getY(v) * k * 0.8, pa.getZ(v) * k);
    }
    const a = rnd() * Math.PI * 2, rad = rnd() * 0.13, s = 0.05 + rnd() * 0.038;
    b.add(g, ore, mul(H, tf(Math.cos(a) * rad * 1.3, 0.125 + rnd() * 0.05 - rad * 0.25, Math.sin(a) * rad, rnd() * 3, rnd() * 3, 0, s)), true);
  }

  /* ---- exhaust stack at the rear top: slots, rim and grille cap ---- */
  const SZ = -0.45;
  b.add(new THREE.CylinderGeometry(0.19, 0.215, 0.05, hi ? 16 : 8), paint, tf(0, 1.295, SZ));     // flange
  b.add(new THREE.CylinderGeometry(0.13, 0.148, 0.5, hi ? 16 : 8), paint, tf(0, 1.56, SZ));       // barrel
  b.add(new THREE.CylinderGeometry(0.105, 0.105, 0.02, hi ? 16 : 8), voidDark, tf(0, 1.8, SZ));   // dark mouth
  if (hi) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      b.add(new THREE.BoxGeometry(0.016, 0.3, 0.012), voidDark, tf(Math.sin(a) * 0.133, 1.56, SZ + Math.cos(a) * 0.133, 0, a, 0)); // vertical slots
    }
    b.add(new THREE.TorusGeometry(0.135, 0.012, 6, 16), m.gunmetal, tf(0, 1.812, SZ, Math.PI / 2));
    b.add(new THREE.BoxGeometry(0.27, 0.012, 0.024), m.gunmetal, tf(0, 1.822, SZ));               // grille slats
    b.add(new THREE.BoxGeometry(0.024, 0.012, 0.27), m.gunmetal, tf(0, 1.822, SZ));
    b.add(new THREE.CylinderGeometry(0.152, 0.132, 0.024, 16), paint, tf(0, 1.838, SZ));          // rain cap
  } else {
    b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.022, 8), paint, tf(0, 1.835, SZ));
  }

  /* ---- left flank: cartridge slot with a pink-striped preset cartridge ---- */
  b.add(hi ? chamferBox(0.06, 0.2, 0.28, 0.01) : new THREE.BoxGeometry(0.06, 0.2, 0.28), m.gunmetal, tf(0.555, 0.85, 0.3)); // slot frame
  b.add(new THREE.BoxGeometry(0.04, 0.11, 0.19), voidDark, tf(0.57, 0.85, 0.3));                  // opening
  b.add(hi ? chamferBox(0.24, 0.095, 0.155, 0.012) : new THREE.BoxGeometry(0.24, 0.095, 0.155), cartMat, tf(0.62, 0.85, 0.3)); // cartridge, half out
  b.add(hi ? chamferBox(0.02, 0.05, 0.09, 0.006) : new THREE.BoxGeometry(0.02, 0.05, 0.09), m.rubber, tf(0.748, 0.85, 0.3)); // grab handle

  /* ---- right flank: hinged service door, handle, pink label plate ---- */
  b.add(hi ? chamferBox(0.035, 0.55, 0.52, 0.01) : new THREE.BoxGeometry(0.035, 0.55, 0.52), paint, tf(-0.558, 0.62, -0.25));
  if (hi) {
    for (const hy of [0.46, 0.78]) b.add(new THREE.CylinderGeometry(0.011, 0.011, 0.08, 8), m.gunmetal, tf(-0.583, hy, -0.48));
    b.add(new THREE.CylinderGeometry(0.007, 0.007, 0.03, 6), m.gunmetal, tf(-0.585, 0.68, -0.05, 0, 0, Math.PI / 2));
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      b.add(new THREE.SphereGeometry(0.0095, 6, 4), m.gunmetal, tf(-0.577, 0.62 + sy * 0.245, -0.25 + sz * 0.23));
    }
  }
  b.add(hi ? chamferBox(0.014, 0.1, 0.02, 0.005) : new THREE.BoxGeometry(0.014, 0.1, 0.02), m.rubber, tf(-0.598, 0.655, -0.05)); // door pull
  b.add(new THREE.BoxGeometry(0.014, 0.11, 0.17), pink, tf(-0.56, 1.0, -0.25));                   // label plate

  /* ---- cable gland at the right rear, low; stub runs down into the ground ---- */
  b.add(new THREE.CylinderGeometry(0.03, 0.036, 0.09, hi ? 10 : 6, 1, false), m.gunmetal, tf(-0.42, 0.33, -0.86, Math.PI / 2)); // gland body
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.028, 6), m.copper, tf(-0.42, 0.33, -0.843, Math.PI / 2));                      // gland nut
  if (hi) {
    const bend = new THREE.TorusGeometry(0.12, 0.021, 7, 10, Math.PI / 2);
    bend.rotateY(Math.PI / 2);
    b.add(bend, m.rubber, tf(-0.42, 0.21, -0.905));                                   // cable curves down
    b.add(new THREE.CylinderGeometry(0.021, 0.021, 0.21, 10), m.rubber, tf(-0.42, 0.105, -1.025));
    b.add(new THREE.CylinderGeometry(0.05, 0.062, 0.025, 10), m.darkSteel, tf(-0.42, 0.0125, -1.025)); // ground flange
  } else {
    b.add(new THREE.CylinderGeometry(0.021, 0.021, 0.42, 6), m.rubber, tf(-0.42, 0.17, -0.95, 0.36));
    b.add(new THREE.CylinderGeometry(0.05, 0.06, 0.025, 6), m.darkSteel, tf(-0.42, 0.0125, -1.02));
  }

  /* ---- hazard-striped toe strip around the base ---- */
  b.add(new THREE.BoxGeometry(1.06, 0.08, 0.026), m.hazard, tf(0, 0.19, 0.845));
  b.add(new THREE.BoxGeometry(1.06, 0.08, 0.026), m.hazard, tf(0, 0.19, -0.845));
  b.add(new THREE.BoxGeometry(0.026, 0.08, 1.63), m.hazard, tf(0.558, 0.19, 0));
  b.add(new THREE.BoxGeometry(0.026, 0.08, 1.63), m.hazard, tf(-0.558, 0.19, 0));

  /* ---- four bolted feet; the body sits 0.15 m above the ground ---- */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const fx = sx * 0.42, fz = sz * 0.66;
    b.add(hi ? chamferBox(0.2, 0.05, 0.2, 0.012) : new THREE.BoxGeometry(0.2, 0.05, 0.2), m.darkSteel, tf(fx, 0.025, fz)); // foot pad
    b.add(new THREE.CylinderGeometry(0.055, 0.07, 0.13, hi ? 12 : 6), m.darkSteel, tf(fx, 0.105, fz));                     // post
    if (hi) for (const bx of [-1, 1]) for (const bz of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(0.011, 0.011, 0.024, 6), m.gunmetal, tf(fx + bx * 0.075, 0.056, fz + bz * 0.075));  // pad bolts
    }
  }

  /* ---- lifting lugs and the amber status lamp on the rear top ---- */
  if (hi) for (const sx of [-1, 1]) {
    b.add(new THREE.TorusGeometry(0.045, 0.011, 6, 12, Math.PI), m.gunmetal, tf(sx * 0.24, 1.28, 0.34));
  }
  b.add(new THREE.CylinderGeometry(0.03, 0.036, 0.05, hi ? 12 : 6), m.gunmetal, tf(0.22, 1.3, -0.72));
  const lamp = makeLamp(0xffa032,
    new THREE.SphereGeometry(0.025, hi ? 10 : 6, hi ? 5 : 3, 0, Math.PI * 2, 0, Math.PI / 2 + 0.4),
    tf(0.22, 1.323, -0.72), 0.9);
  const lamps: THREE.Mesh[] = [lamp];

  /* ---- assemble ---- */
  for (const mesh of b.meshes()) group.add(mesh);
  group.add(...lamps);

  const colliders: Box[] = [
    { min: [-0.57, 0, -0.86], max: [0.57, 1.3, 0.86] },            // body, feet, toe strip
    { min: [-0.35, 1.28, -0.67], max: [0.35, 1.87, 0.8] },         // hopper + stack
    { min: [0.55, 0.74, 0.2], max: [0.76, 0.96, 0.4] },            // protruding cartridge
  ];
  const sockets: Socket[] = [
    { name: 'hopper', at: [0, 1.56, 0.55] },                       // material goes IN here
    { name: 'stack', at: [0, 1.84, SZ] },                          // pixels pour OUT here
    { name: 'power', at: [-0.42, 0.33, -0.87] },                   // cable gland, low at the rear
  ];
  return { group, colliders, sockets, lamps };
}
