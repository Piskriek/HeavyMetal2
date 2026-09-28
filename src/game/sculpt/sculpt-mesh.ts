/**
 * NewSculpt — one sculptable mesh: the geometry it owns, and the bookkeeping that makes a brush cheap
 * and a seam invisible.
 *
 *  - **Ownership.** `wrap(mesh)` clones the geometry once and gives it to the mesh. Meshy copies share
 *    geometry (`scene.clone(true)`), and the course scenery is generated code: sculpting the shared
 *    buffer would move every copy. The clone is flagged `userData.sculptOwned`, so wrapping twice is
 *    a lookup, not another clone. Interleaved GLB attributes are flattened to plain Float32 arrays.
 *  - **Welding.** Vertices at the same position (UV seams, hard edges) form a *group*; a brush moves
 *    groups, so a GLB never tears along its texture seams. Normals are still recomputed per vertex
 *    from that vertex's own triangles, so hard edges stay hard.
 *  - **Spatial grid.** Groups are bucketed by local position for brush queries. During a stroke the
 *    grid is not rebuilt; instead the query radius grows by the largest distance any group has drifted
 *    from its bucket (`drift`), and every candidate is checked exactly in world space. `finishStroke`
 *    re-buckets what moved.
 *  - **Base.** A copy of the generated positions (and colours, once painted). Extracting a document
 *    is a diff against it; resetting is a copy back.
 *
 * All brush maths lives in `sculpt-brushes.ts`; this file only knows how to move, colour, query and
 * re-normal vertices, and how to serialise the result.
 */
import * as THREE from 'three';
import {
  SCULPT_QUANTUM, decodeBytes, decodeIndices, decodeInt16, encodeBytes, encodeIndices, encodeInt16, type SculptMeshDoc,
} from './sculpt-doc';

export interface BrushHit {
  readonly group: number;
  /** World distance from the brush centre. */
  readonly dist: number;
}

const owned = new WeakMap<THREE.BufferGeometry, SculptMesh>();

/** Plain Float32 `itemSize`-wide copy of an attribute (de-interleaves and de-normalises GLB data). */
function flatAttribute(geometry: THREE.BufferGeometry, name: string, itemSize: number): THREE.BufferAttribute | null {
  const attr = geometry.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
  if (!attr) return null;
  if ((attr as THREE.BufferAttribute).isBufferAttribute && attr.array instanceof Float32Array && attr.itemSize === itemSize && !attr.normalized) {
    return attr as THREE.BufferAttribute;
  }
  const out = new Float32Array(attr.count * itemSize);
  for (let i = 0; i < attr.count; i++) {
    out[i * itemSize] = attr.getX(i);
    if (itemSize > 1) out[i * itemSize + 1] = attr.itemSize > 1 ? attr.getY(i) : 0;
    if (itemSize > 2) out[i * itemSize + 2] = attr.itemSize > 2 ? attr.getZ(i) : 0;
  }
  const flat = new THREE.BufferAttribute(out, itemSize);
  geometry.setAttribute(name, flat);
  return flat;
}

function minAxisScale(m: THREE.Matrix4): number {
  const e = m.elements;
  const sx = Math.hypot(e[0], e[1], e[2]);
  const sy = Math.hypot(e[4], e[5], e[6]);
  const sz = Math.hypot(e[8], e[9], e[10]);
  return Math.min(sx, sy, sz) || 1;
}

export class SculptMesh {
  mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly position: THREE.BufferAttribute;
  readonly normal: THREE.BufferAttribute;
  readonly count: number;
  /** Generated positions (local). */
  readonly base: Float32Array;
  /** Group of each vertex. */
  readonly groupOf: Int32Array;
  /** Vertices of each group; `groups[g][0]` is the representative. */
  readonly groups: readonly number[][];
  readonly tris: Uint32Array;
  private readonly trisOfVertex: number[][];
  private neighbourList: number[][] | null = null;
  private colorAttr: THREE.BufferAttribute | null = null;
  private baseColor: Float32Array | null = null;
  private readonly cellSize: number;
  private readonly cells = new Map<number, number[]>();
  private readonly cellKeyOf: Int32Array;
  private readonly gridPos: Float32Array;
  private drift = 0;
  private readonly dirty = new Set<number>();
  private readonly inv = new THREE.Matrix4();
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly vA = new THREE.Vector3();
  private readonly vB = new THREE.Vector3();
  private readonly vC = new THREE.Vector3();

  /** The wrapper for a mesh, cloning its geometry the first time. */
  static wrap(mesh: THREE.Mesh): SculptMesh {
    const existing = owned.get(mesh.geometry);
    if (existing) { existing.mesh = mesh; return existing; }
    const geometry = mesh.geometry.clone();
    geometry.userData = { ...geometry.userData, sculptOwned: true, sculptSource: mesh.geometry.uuid };
    mesh.geometry = geometry;
    const wrapper = new SculptMesh(mesh, geometry);
    owned.set(geometry, wrapper);
    return wrapper;
  }

  /** The wrapper a mesh already has, if it was ever sculpted. */
  static of(mesh: THREE.Mesh): SculptMesh | undefined { return owned.get(mesh.geometry); }

  private constructor(mesh: THREE.Mesh, geometry: THREE.BufferGeometry) {
    this.mesh = mesh;
    this.geometry = geometry;
    this.position = flatAttribute(geometry, 'position', 3)!;
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    this.normal = flatAttribute(geometry, 'normal', 3)!;
    if (geometry.getAttribute('color')) {
      this.colorAttr = flatAttribute(geometry, 'color', 3);
      this.baseColor = Float32Array.from(this.colorAttr!.array as Float32Array);
    }
    this.count = this.position.count;
    this.base = Float32Array.from(this.position.array as Float32Array);

    // Welding: quantise positions to a millionth of the diagonal.
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new THREE.Vector3());
    const diag = size.length() || 1;
    const eps = diag * 1e-6;
    const keyed = new Map<string, number>();
    const groups: number[][] = [];
    this.groupOf = new Int32Array(this.count);
    const p = this.position;
    for (let i = 0; i < this.count; i++) {
      const key = `${Math.round(p.getX(i) / eps)},${Math.round(p.getY(i) / eps)},${Math.round(p.getZ(i) / eps)}`;
      let g = keyed.get(key);
      if (g === undefined) { g = groups.length; groups.push([]); keyed.set(key, g); }
      groups[g].push(i);
      this.groupOf[i] = g;
    }
    this.groups = groups;

    // Triangles and each vertex's own triangles (for per-vertex normals).
    const index = geometry.getIndex();
    const triCount = Math.floor((index ? index.count : this.count) / 3);
    this.tris = new Uint32Array(triCount * 3);
    for (let k = 0; k < triCount * 3; k++) this.tris[k] = index ? index.getX(k) : k;
    this.trisOfVertex = Array.from({ length: this.count }, () => []);
    for (let t = 0; t < triCount; t++) {
      this.trisOfVertex[this.tris[t * 3]].push(t);
      this.trisOfVertex[this.tris[t * 3 + 1]].push(t);
      this.trisOfVertex[this.tris[t * 3 + 2]].push(t);
    }

    // Grid.
    this.cellSize = Math.max(diag / 64, eps * 10);
    this.cellKeyOf = new Int32Array(groups.length);
    this.gridPos = new Float32Array(groups.length * 3);
    for (let g = 0; g < groups.length; g++) this.insertGroup(g);
    this.syncMatrices();
  }

  /* ───────────── grid ───────────── */

  private cellKey(x: number, y: number, z: number): number {
    const cs = this.cellSize;
    return Math.imul(Math.floor(x / cs), 73856093) ^ Math.imul(Math.floor(y / cs), 19349663) ^ Math.imul(Math.floor(z / cs), 83492791);
  }

  private insertGroup(g: number) {
    const rep = this.groups[g][0];
    const x = this.position.getX(rep), y = this.position.getY(rep), z = this.position.getZ(rep);
    const key = this.cellKey(x, y, z);
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(g); else this.cells.set(key, [g]);
    this.cellKeyOf[g] = key;
    this.gridPos[g * 3] = x; this.gridPos[g * 3 + 1] = y; this.gridPos[g * 3 + 2] = z;
  }

  private removeGroup(g: number) {
    const bucket = this.cells.get(this.cellKeyOf[g]);
    if (!bucket) return;
    const at = bucket.indexOf(g);
    if (at >= 0) bucket.splice(at, 1);
  }

  /** Refreshes the inverse matrices; call once per stamp (the object may have been moved by the gizmo). */
  syncMatrices(): void {
    this.mesh.updateWorldMatrix(true, false);
    this.inv.copy(this.mesh.matrixWorld).invert();
    this.normalMatrix.getNormalMatrix(this.mesh.matrixWorld);
  }

  /** Local units per stored step: a quarter of a world unit at this mesh's scale (see SculptMeshDoc.q). */
  localQuantum(): number {
    this.syncMatrices();
    return SCULPT_QUANTUM / minAxisScale(this.mesh.matrixWorld);
  }

  /** Groups whose representative lies within `radius` (world units) of a world point. */
  query(worldCentre: THREE.Vector3, radius: number, out: BrushHit[] = []): BrushHit[] {
    const local = this.vA.copy(worldCentre).applyMatrix4(this.inv);
    const r = (radius + this.drift) / minAxisScale(this.mesh.matrixWorld);
    const cs = this.cellSize;
    const x0 = Math.floor((local.x - r) / cs), x1 = Math.floor((local.x + r) / cs);
    const y0 = Math.floor((local.y - r) / cs), y1 = Math.floor((local.y + r) / cs);
    const z0 = Math.floor((local.z - r) / cs), z1 = Math.floor((local.z + r) / cs);
    const visit = (g: number) => {
      const rep = this.groups[g][0];
      const d = this.vB.fromBufferAttribute(this.position, rep).applyMatrix4(this.mesh.matrixWorld).distanceTo(worldCentre);
      if (d <= radius) out.push({ group: g, dist: d });
    };
    const span = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
    if (span >= this.groups.length) {
      for (let g = 0; g < this.groups.length; g++) visit(g);
      return out;
    }
    const seen = new Set<number>();
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        for (let iz = z0; iz <= z1; iz++) {
          const key = Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791);
          if (seen.has(key)) continue;
          seen.add(key);
          const bucket = this.cells.get(key);
          if (bucket) for (const g of bucket) visit(g);
        }
      }
    }
    return out;
  }

  /* ───────────── positions ───────────── */

  groupLocal(g: number, out: THREE.Vector3): THREE.Vector3 {
    return out.fromBufferAttribute(this.position, this.groups[g][0]);
  }

  groupWorld(g: number, out: THREE.Vector3): THREE.Vector3 {
    return this.groupLocal(g, out).applyMatrix4(this.mesh.matrixWorld);
  }

  setGroupLocal(g: number, x: number, y: number, z: number): void {
    for (const v of this.groups[g]) this.position.setXYZ(v, x, y, z);
    this.dirty.add(g);
    const d = Math.hypot(x - this.gridPos[g * 3], y - this.gridPos[g * 3 + 1], z - this.gridPos[g * 3 + 2]);
    if (d > this.drift) this.drift = d;
  }

  setGroupWorld(g: number, world: THREE.Vector3): void {
    const local = this.vC.copy(world).applyMatrix4(this.inv);
    this.setGroupLocal(g, local.x, local.y, local.z);
  }

  /** A world-space direction in local space (no normalisation). */
  worldDirToLocal(dir: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const e = this.inv.elements;
    return out.set(
      e[0] * dir.x + e[4] * dir.y + e[8] * dir.z,
      e[1] * dir.x + e[5] * dir.y + e[9] * dir.z,
      e[2] * dir.x + e[6] * dir.y + e[10] * dir.z,
    );
  }

  /** Average world normal of a group's vertices (unit). */
  groupNormalWorld(g: number, out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, 0);
    for (const v of this.groups[g]) out.add(this.vB.fromBufferAttribute(this.normal, v));
    out.applyMatrix3(this.normalMatrix);
    return out.lengthSq() > 0 ? out.normalize() : out.set(0, 1, 0);
  }

  /** Groups sharing an edge with `g` (built on first use). */
  neighboursOf(g: number): readonly number[] {
    if (!this.neighbourList) {
      const sets: Set<number>[] = Array.from({ length: this.groups.length }, () => new Set<number>());
      for (let t = 0; t < this.tris.length; t += 3) {
        const a = this.groupOf[this.tris[t]], b = this.groupOf[this.tris[t + 1]], c = this.groupOf[this.tris[t + 2]];
        if (a !== b) { sets[a].add(b); sets[b].add(a); }
        if (b !== c) { sets[b].add(c); sets[c].add(b); }
        if (a !== c) { sets[a].add(c); sets[c].add(a); }
      }
      this.neighbourList = sets.map((s) => Array.from(s));
    }
    return this.neighbourList[g];
  }

  /* ───────────── colours ───────────── */

  get hasColor(): boolean { return this.colorAttr !== null; }

  /** The colour attribute, created white on first use; the material(s) switch to vertex colours. */
  ensureColor(): THREE.BufferAttribute {
    if (this.colorAttr) return this.colorAttr;
    const array = new Float32Array(this.count * 3).fill(1);
    this.colorAttr = new THREE.BufferAttribute(array, 3);
    this.geometry.setAttribute('color', this.colorAttr);
    this.baseColor = Float32Array.from(array);
    this.enableVertexColors();
    return this.colorAttr;
  }

  /**
   * Vertex colours on this mesh's material without touching the shared original. Plays along with the
   * kit look system (`setKitLook` swaps `mesh.material` between `userData.baseMaterial` and a per-copy
   * look): the clone becomes the new base, and an existing look material is switched too.
   */
  enableVertexColors(): void {
    const mesh = this.mesh;
    const on = (m: THREE.Material) => { (m as THREE.MeshStandardMaterial).vertexColors = true; m.needsUpdate = true; };
    const base = (mesh.userData.baseMaterial ?? mesh.material) as THREE.Material | THREE.Material[];
    if (mesh.userData.sculptMaterialOwned) { (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(on); return; }
    const clone = Array.isArray(base) ? base.map((m) => m.clone()) : base.clone();
    (Array.isArray(clone) ? clone : [clone]).forEach(on);
    const wasBase = mesh.material === base;
    if (mesh.userData.baseMaterial) mesh.userData.baseMaterial = clone;
    const look = mesh.userData.lookMaterial as THREE.Material | undefined;
    if (look) on(look);
    if (wasBase || !look) mesh.material = clone;
    mesh.userData.sculptMaterialOwned = true;
  }

  paintGroup(g: number, r: number, gg: number, b: number, t: number): void {
    const c = this.ensureColor();
    for (const v of this.groups[g]) {
      c.setXYZ(v, c.getX(v) + (r - c.getX(v)) * t, c.getY(v) + (gg - c.getY(v)) * t, c.getZ(v) + (b - c.getZ(v)) * t);
    }
    c.needsUpdate = true;
  }

  /** Blend back toward the generated colour. */
  unpaintGroup(g: number, t: number): void {
    if (!this.colorAttr || !this.baseColor) return;
    const c = this.colorAttr, bc = this.baseColor;
    for (const v of this.groups[g]) {
      c.setXYZ(v, c.getX(v) + (bc[v * 3] - c.getX(v)) * t, c.getY(v) + (bc[v * 3 + 1] - c.getY(v)) * t, c.getZ(v) + (bc[v * 3 + 2] - c.getZ(v)) * t);
    }
    c.needsUpdate = true;
  }

  /* ───────────── normals ───────────── */

  /** Recomputes the normals of every vertex in `groups` from those vertices' own triangles. */
  recomputeNormals(groups: Iterable<number>): void {
    const verts = new Set<number>();
    for (const g of groups) for (const v of this.groups[g]) verts.add(v);
    if (!verts.size) return;
    const n = this.normal, p = this.position, tris = this.tris;
    const faces = new Map<number, [number, number, number]>();
    const face = (t: number): [number, number, number] => {
      let f = faces.get(t);
      if (f) return f;
      const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
      const ax = p.getX(a), ay = p.getY(a), az = p.getZ(a);
      const e1x = p.getX(b) - ax, e1y = p.getY(b) - ay, e1z = p.getZ(b) - az;
      const e2x = p.getX(c) - ax, e2y = p.getY(c) - ay, e2z = p.getZ(c) - az;
      f = [e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x];
      faces.set(t, f);
      return f;
    };
    for (const v of verts) {
      let nx = 0, ny = 0, nz = 0;
      for (const t of this.trisOfVertex[v]) { const f = face(t); nx += f[0]; ny += f[1]; nz += f[2]; }
      const len = Math.hypot(nx, ny, nz);
      if (len > 0) n.setXYZ(v, nx / len, ny / len, nz / len); else n.setXYZ(v, 0, 1, 0);
    }
    n.needsUpdate = true;
  }

  /* ───────────── strokes ───────────── */

  get dirtyGroups(): ReadonlySet<number> { return this.dirty; }

  /** Re-buckets what moved, refreshes bounds, flags uploads. Returns how many groups moved. */
  finishStroke(): number {
    const moved = this.dirty.size;
    for (const g of this.dirty) { this.removeGroup(g); this.insertGroup(g); }
    this.dirty.clear();
    this.drift = 0;
    this.position.needsUpdate = true;
    this.normal.needsUpdate = true;
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
    return moved;
  }

  /* ───────────── base, documents ───────────── */

  /** True when no vertex is further than half a quantum from the generated shape and nothing is painted. */
  isPristine(quantum = SCULPT_QUANTUM): boolean {
    const half = quantum * 0.5, p = this.position, b = this.base;
    for (let i = 0; i < this.count; i++) {
      if (Math.abs(p.getX(i) - b[i * 3]) >= half || Math.abs(p.getY(i) - b[i * 3 + 1]) >= half || Math.abs(p.getZ(i) - b[i * 3 + 2]) >= half) return false;
    }
    if (this.colorAttr && this.baseColor) {
      const c = this.colorAttr, bc = this.baseColor;
      for (let i = 0; i < this.count; i++) {
        if (Math.abs(c.getX(i) - bc[i * 3]) > 1 / 255 || Math.abs(c.getY(i) - bc[i * 3 + 1]) > 1 / 255 || Math.abs(c.getZ(i) - bc[i * 3 + 2]) > 1 / 255) return false;
      }
    }
    return true;
  }

  /** Vertices that differ from the generated shape by at least half a quantum. */
  changedCount(quantum = SCULPT_QUANTUM): number {
    const half = quantum * 0.5, p = this.position, b = this.base;
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      if (Math.abs(p.getX(i) - b[i * 3]) >= half || Math.abs(p.getY(i) - b[i * 3 + 1]) >= half || Math.abs(p.getZ(i) - b[i * 3 + 2]) >= half) n++;
    }
    return n;
  }

  /** The sparse diff against the generated shape, or null when there is none. */
  extractDoc(key: string, quantum = SCULPT_QUANTUM): SculptMeshDoc | null {
    const half = quantum * 0.5, p = this.position, b = this.base;
    const idx: number[] = [], d: number[] = [];
    for (let i = 0; i < this.count; i++) {
      const dx = p.getX(i) - b[i * 3], dy = p.getY(i) - b[i * 3 + 1], dz = p.getZ(i) - b[i * 3 + 2];
      if (Math.abs(dx) < half && Math.abs(dy) < half && Math.abs(dz) < half) continue;
      idx.push(i);
      d.push(dx / quantum, dy / quantum, dz / quantum);
    }
    const cidx: number[] = [], c: number[] = [];
    if (this.colorAttr && this.baseColor) {
      const ca = this.colorAttr, bc = this.baseColor;
      for (let i = 0; i < this.count; i++) {
        const r = ca.getX(i), g = ca.getY(i), bl = ca.getZ(i);
        if (Math.abs(r - bc[i * 3]) <= 1 / 255 && Math.abs(g - bc[i * 3 + 1]) <= 1 / 255 && Math.abs(bl - bc[i * 3 + 2]) <= 1 / 255) continue;
        cidx.push(i);
        c.push(Math.round(Math.max(0, Math.min(1, r)) * 255), Math.round(Math.max(0, Math.min(1, g)) * 255), Math.round(Math.max(0, Math.min(1, bl)) * 255));
      }
    }
    if (!idx.length && !cidx.length) return null;
    return {
      key, n: this.count,
      ...(quantum !== SCULPT_QUANTUM ? { q: quantum } : {}),
      ...(idx.length ? { shape: { idx: encodeIndices(idx), d: encodeInt16(d) } } : {}),
      ...(cidx.length ? { paint: { idx: encodeIndices(cidx), c: encodeBytes(Uint8Array.from(c)) } } : {}),
    };
  }

  /** Puts a document's offsets and colours onto the generated shape. False when it does not fit. */
  applyDoc(doc: SculptMeshDoc, docQuantum = SCULPT_QUANTUM): boolean {
    if (doc.n !== this.count) return false;
    const quantum = doc.q ?? docQuantum;
    const touched = new Set<number>();
    if (doc.shape) {
      const idx = decodeIndices(doc.shape.idx);
      const d = decodeInt16(doc.shape.d);
      if (d.length !== idx.length * 3) return false;
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k];
        if (i >= this.count) continue;
        this.position.setXYZ(i, this.base[i * 3] + d[k * 3] * quantum, this.base[i * 3 + 1] + d[k * 3 + 1] * quantum, this.base[i * 3 + 2] + d[k * 3 + 2] * quantum);
        touched.add(this.groupOf[i]);
      }
    }
    if (doc.paint) {
      const idx = decodeIndices(doc.paint.idx);
      const c = decodeBytes(doc.paint.c);
      if (c.length !== idx.length * 3) return false;
      const attr = this.ensureColor();
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k];
        if (i >= this.count) continue;
        attr.setXYZ(i, c[k * 3] / 255, c[k * 3 + 1] / 255, c[k * 3 + 2] / 255);
      }
      attr.needsUpdate = true;
    }
    for (const g of touched) this.dirty.add(g);
    this.recomputeNormals(touched);
    this.finishStroke();
    return true;
  }

  /** Back to the generated shape and colours. */
  reset(): void {
    (this.position.array as Float32Array).set(this.base);
    if (this.colorAttr && this.baseColor) { (this.colorAttr.array as Float32Array).set(this.baseColor); this.colorAttr.needsUpdate = true; }
    const all: number[] = [];
    for (let g = 0; g < this.groups.length; g++) { all.push(g); this.dirty.add(g); }
    this.recomputeNormals(all);
    this.finishStroke();
  }
}

/** Every mesh under an object a brush may touch: real meshes with positions, not sprites, decals, lights or instanced batches. */
export function sculptableMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if ((o as unknown as THREE.Sprite).isSprite || (o as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    if (!mesh.geometry?.attributes?.position) return;
    if (mesh.userData?.isDecal || mesh.userData?.noSculpt || mesh.userData?.isLight) return;
    out.push(mesh);
  });
  return out;
}

/** A stable key for a mesh under an object: its traversal index, name and vertex count. */
export const meshKey = (index: number, mesh: THREE.Mesh) => `${index}:${mesh.name || ''}:${mesh.geometry.attributes.position.count}`;
