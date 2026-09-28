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
 *  - **Base.** A copy of the generated positions (and colours/surfaces, once painted). Extracting a document
 *    is a diff against it; resetting is a copy back.
 *
 * All brush maths lives in `sculpt-brushes.ts`; this file only knows how to move, colour, surface-texture,
 * query and re-normal vertices, and how to serialise the result.
 */
import * as THREE from 'three';
import {
  SCULPT_QUANTUM, decodeBytes, decodeIndices, decodeInt16, encodeBytes, encodeIndices, encodeInt16, type SculptMeshDoc,
} from './sculpt-doc';
import { injectIslandModelShader } from '../island-route/island-surface-shader';
import { IslandSurfaceArray } from '../island-route/island-surfaces';

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

/**
 * A material's own copy that still renders the same: clone() drops `onBeforeCompile` (a model's shader
 * hooks) and JSON-copies userData (slow or throwing when it holds live objects), so both carry over as is.
 */
function cloneKeepingHooks(material: THREE.Material): THREE.Material {
  const userData = material.userData;
  material.userData = {};
  let clone: THREE.Material;
  try { clone = material.clone(); } finally { material.userData = userData; }
  clone.userData = { ...userData };
  if (Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')) clone.onBeforeCompile = material.onBeforeCompile;
  if (Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey')) clone.customProgramCacheKey = material.customProgramCacheKey;
  return clone;
}

function minAxisScale(m: THREE.Matrix4): number {
  const e = m.elements;
  const sx = Math.hypot(e[0] ?? 1, e[1] ?? 0, e[2] ?? 0);
  const sy = Math.hypot(e[4] ?? 0, e[5] ?? 1, e[6] ?? 0);
  const sz = Math.hypot(e[8] ?? 0, e[9] ?? 0, e[10] ?? 1);
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
  private surfaceAttr: THREE.BufferAttribute | null = null;
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
      if (this.colorAttr) {
        this.baseColor = Float32Array.from(this.colorAttr.array as Float32Array);
      }
    }
    if (geometry.getAttribute('islSurface')) {
      this.surfaceAttr = flatAttribute(geometry, 'islSurface', 2);
    }
    this.count = this.position.count;
    this.base = Float32Array.from(this.position.array as Float32Array);

    // Welding: quantise positions to a millionth of the diagonal.
    geometry.computeBoundingBox();
    const size = geometry.boundingBox ? geometry.boundingBox.getSize(new THREE.Vector3()) : new THREE.Vector3(1, 1, 1);
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
      const groupArr = groups[g];
      if (groupArr) {
        groupArr.push(i);
      }
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
      const t0 = this.tris[t * 3] ?? 0;
      const t1 = this.tris[t * 3 + 1] ?? 0;
      const t2 = this.tris[t * 3 + 2] ?? 0;
      this.trisOfVertex[t0]?.push(t);
      this.trisOfVertex[t1]?.push(t);
      this.trisOfVertex[t2]?.push(t);
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
    const groupArr = this.groups[g];
    const rep = groupArr ? (groupArr[0] ?? 0) : 0;
    const x = this.position.getX(rep), y = this.position.getY(rep), z = this.position.getZ(rep);
    const key = this.cellKey(x, y, z);
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(g); else this.cells.set(key, [g]);
    this.cellKeyOf[g] = key;
    this.gridPos[g * 3] = x; this.gridPos[g * 3 + 1] = y; this.gridPos[g * 3 + 2] = z;
  }

  private removeGroup(g: number) {
    const key = this.cellKeyOf[g] ?? 0;
    const bucket = this.cells.get(key);
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
      const groupArr = this.groups[g];
      const rep = groupArr ? (groupArr[0] ?? 0) : 0;
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
    const groupArr = this.groups[g];
    const rep = groupArr ? (groupArr[0] ?? 0) : 0;
    return out.fromBufferAttribute(this.position, rep);
  }

  groupWorld(g: number, out: THREE.Vector3): THREE.Vector3 {
    return this.groupLocal(g, out).applyMatrix4(this.mesh.matrixWorld);
  }

  setGroupLocal(g: number, x: number, y: number, z: number): void {
    const groupArr = this.groups[g];
    if (groupArr) {
      for (const v of groupArr) this.position.setXYZ(v, x, y, z);
    }
    this.dirty.add(g);
    const gx = this.gridPos[g * 3] ?? 0;
    const gy = this.gridPos[g * 3 + 1] ?? 0;
    const gz = this.gridPos[g * 3 + 2] ?? 0;
    const d = Math.hypot(x - gx, y - gy, z - gz);
    if (d > this.drift) this.drift = d;
  }

  setGroupWorld(g: number, world: THREE.Vector3): void {
    const local = this.vC.copy(world).applyMatrix4(this.inv);
    this.setGroupLocal(g, local.x, local.y, local.z);
  }

  /** A world-space direction in local space (no normalisation). */
  worldDirToLocal(dir: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const e = this.inv.elements;
    const e0 = e[0] ?? 0, e4 = e[4] ?? 0, e8 = e[8] ?? 0;
    const e1 = e[1] ?? 0, e5 = e[5] ?? 0, e9 = e[9] ?? 0;
    const e2 = e[2] ?? 0, e6 = e[6] ?? 0, e10 = e[10] ?? 0;
    return out.set(
      e0 * dir.x + e4 * dir.y + e8 * dir.z,
      e1 * dir.x + e5 * dir.y + e9 * dir.z,
      e2 * dir.x + e6 * dir.y + e10 * dir.z,
    );
  }

  /** Average world normal of a group's vertices (unit). */
  groupNormalWorld(g: number, out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, 0);
    const groupArr = this.groups[g];
    if (groupArr) {
      for (const v of groupArr) out.add(this.vB.fromBufferAttribute(this.normal, v));
    }
    out.applyMatrix3(this.normalMatrix);
    return out.lengthSq() > 0 ? out.normalize() : out.set(0, 1, 0);
  }

  /** Groups sharing an edge with `g` (built on first use). */
  neighboursOf(g: number): readonly number[] {
    if (!this.neighbourList) {
      const sets: Set<number>[] = Array.from({ length: this.groups.length }, () => new Set<number>());
      for (let t = 0; t < this.tris.length; t += 3) {
        const t0 = this.tris[t] ?? 0;
        const t1 = this.tris[t + 1] ?? 0;
        const t2 = this.tris[t + 2] ?? 0;
        const a = this.groupOf[t0] ?? 0;
        const b = this.groupOf[t1] ?? 0;
        const c = this.groupOf[t2] ?? 0;
        if (a !== b) { sets[a]?.add(b); sets[b]?.add(a); }
        if (b !== c) { sets[b]?.add(c); sets[c]?.add(b); }
        if (a !== c) { sets[a]?.add(c); sets[c]?.add(a); }
      }
      this.neighbourList = sets.map((s) => Array.from(s));
    }
    return this.neighbourList[g] ?? [];
  }

  /* ───────────── flat colours ───────────── */

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
   * Vertex colours on this mesh's material without touching the shared original.
   */
  enableVertexColors(): void {
    const mesh = this.mesh;
    const on = (m: THREE.Material) => { (m as THREE.MeshStandardMaterial).vertexColors = true; m.needsUpdate = true; };
    const base = (mesh.userData.baseMaterial ?? mesh.material) as THREE.Material | THREE.Material[];
    if (mesh.userData.sculptMaterialOwned) { (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(on); return; }
    if (!Array.isArray(base) && base.userData?.islandGround) { on(base); mesh.userData.sculptMaterialOwned = true; return; }
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
    const groupArr = this.groups[g];
    if (groupArr) {
      for (const v of groupArr) {
        c.setXYZ(v, c.getX(v) + (r - c.getX(v)) * t, c.getY(v) + (gg - c.getY(v)) * t, c.getZ(v) + (b - c.getZ(v)) * t);
      }
    }
    c.needsUpdate = true;
  }

  /** Blend back toward the generated colour. */
  unpaintGroup(g: number, t: number): void {
    if (!this.colorAttr || !this.baseColor) return;
    const c = this.colorAttr, bc = this.baseColor;
    const groupArr = this.groups[g];
    if (groupArr) {
      for (const v of groupArr) {
        const bcX = bc[v * 3] ?? 1;
        const bcY = bc[v * 3 + 1] ?? 1;
        const bcZ = bc[v * 3 + 2] ?? 1;
        c.setXYZ(v, c.getX(v) + (bcX - c.getX(v)) * t, c.getY(v) + (bcY - c.getY(v)) * t, c.getZ(v) + (bcZ - c.getZ(v)) * t);
      }
    }
    c.needsUpdate = true;
  }

  /* ───────────── textured island surface painting ───────────── */

  get hasSurface(): boolean { return this.surfaceAttr !== null; }

  /** Ensures the `islSurface` attribute exists (vec2: x = surfaceId, y = weight 0..1). */
  ensureSurface(): THREE.BufferAttribute {
    if (this.surfaceAttr) return this.surfaceAttr;
    const array = new Float32Array(this.count * 2); // all 0 (surfaceId 0, weight 0)
    this.surfaceAttr = new THREE.BufferAttribute(array, 2);
    this.geometry.setAttribute('islSurface', this.surfaceAttr);
    this.enableSurfaceShader();
    return this.surfaceAttr;
  }

  /**
   * Patches the model's material with `onBeforeCompile` to sample the island texture array
   * with triplanar world-space mapping and height blending.
   */
  enableSurfaceShader(): void {
    const mesh = this.mesh;
    const array = IslandSurfaceArray.getInstance();
    const patch = (m: THREE.Material) => {
      injectIslandModelShader(m, array);
    };

    const base = (mesh.userData.baseMaterial ?? mesh.material) as THREE.Material | THREE.Material[];
    if (mesh.userData.sculptMaterialOwned) {
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(patch);
      return;
    }
    // The island ground paints surfaces into its own mask (the sculpt tool routes there). Never clone
    // its material: clone() JSON-copies userData, which holds the whole ground controller.
    if (!Array.isArray(base) && base.userData?.islandGround) return;
    const clone = Array.isArray(base) ? base.map(cloneKeepingHooks) : cloneKeepingHooks(base);
    (Array.isArray(clone) ? clone : [clone]).forEach(patch);
    const wasBase = mesh.material === base;
    if (mesh.userData.baseMaterial) mesh.userData.baseMaterial = clone;
    const look = mesh.userData.lookMaterial as THREE.Material | undefined;
    if (look) patch(look);
    if (wasBase || !look) mesh.material = clone;
    mesh.userData.sculptMaterialOwned = true;
  }

  /** Paint textured island surface onto group `g` with falloff `t`. */
  paintSurfaceGroup(g: number, surfaceId: number, t: number): void {
    const s = this.ensureSurface();
    const groupArr = this.groups[g];
    if (groupArr) {
      for (const v of groupArr) {
        const curId = s.getX(v);
        const curWeight = s.getY(v);
        if (curWeight <= 0.001 || Math.abs(curId - surfaceId) < 0.5) {
          s.setXY(v, surfaceId, Math.min(1.0, curWeight + (1.0 - curWeight) * t));
        } else {
          // Blending toward the new surface ID
          const newWeight = curWeight + (1.0 - curWeight) * t;
          s.setXY(v, surfaceId, Math.min(1.0, newWeight));
        }
      }
    }
    s.needsUpdate = true;
  }

  /** Unpaint/erase island surface back toward the original model look. */
  unpaintSurfaceGroup(g: number, t: number): void {
    if (!this.surfaceAttr) return;
    const s = this.surfaceAttr;
    const groupArr = this.groups[g];
    if (groupArr) {
      for (const v of groupArr) {
        const curWeight = s.getY(v);
        const newWeight = Math.max(0, curWeight - curWeight * t);
        s.setY(v, newWeight);
      }
    }
    s.needsUpdate = true;
  }

  /* ───────────── normals ───────────── */

  /** Recomputes the normals of every vertex in `groups` from those vertices' own triangles. */
  recomputeNormals(groups: Iterable<number>): void {
    const verts = new Set<number>();
    for (const g of groups) {
      const groupArr = this.groups[g];
      if (groupArr) {
        for (const v of groupArr) verts.add(v);
      }
    }
    if (!verts.size) return;
    const n = this.normal, p = this.position, tris = this.tris;
    const faces = new Map<number, [number, number, number]>();
    const face = (t: number): [number, number, number] => {
      let f = faces.get(t);
      if (f) return f;
      const a = tris[t * 3] ?? 0, b = tris[t * 3 + 1] ?? 0, c = tris[t * 3 + 2] ?? 0;
      const ax = p.getX(a), ay = p.getY(a), az = p.getZ(a);
      const e1x = p.getX(b) - ax, e1y = p.getY(b) - ay, e1z = p.getZ(b) - az;
      const e2x = p.getX(c) - ax, e2y = p.getY(c) - ay, e2z = p.getZ(c) - az;
      f = [e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x];
      faces.set(t, f);
      return f;
    };
    for (const v of verts) {
      let nx = 0, ny = 0, nz = 0;
      const trisOfV = this.trisOfVertex[v] ?? [];
      for (const t of trisOfV) { const f = face(t); nx += f[0]; ny += f[1]; nz += f[2]; }
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
    if (this.colorAttr) this.colorAttr.needsUpdate = true;
    if (this.surfaceAttr) this.surfaceAttr.needsUpdate = true;
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
    return moved;
  }

  /* ───────────── base, documents ───────────── */

  /** True when no vertex is further than half a quantum from the generated shape and nothing is painted. */
  isPristine(quantum = SCULPT_QUANTUM): boolean {
    const half = quantum * 0.5, p = this.position, b = this.base;
    for (let i = 0; i < this.count; i++) {
      const bX = b[i * 3] ?? 0;
      const bY = b[i * 3 + 1] ?? 0;
      const bZ = b[i * 3 + 2] ?? 0;
      if (Math.abs(p.getX(i) - bX) >= half || Math.abs(p.getY(i) - bY) >= half || Math.abs(p.getZ(i) - bZ) >= half) return false;
    }
    if (this.colorAttr && this.baseColor) {
      const c = this.colorAttr, bc = this.baseColor;
      for (let i = 0; i < this.count; i++) {
        const bcX = bc[i * 3] ?? 1;
        const bcY = bc[i * 3 + 1] ?? 1;
        const bcZ = bc[i * 3 + 2] ?? 1;
        if (Math.abs(c.getX(i) - bcX) > 1 / 255 || Math.abs(c.getY(i) - bcY) > 1 / 255 || Math.abs(c.getZ(i) - bcZ) > 1 / 255) return false;
      }
    }
    if (this.surfaceAttr) {
      const s = this.surfaceAttr;
      for (let i = 0; i < this.count; i++) {
        if (s.getY(i) > 0.003) return false;
      }
    }
    return true;
  }

  /** Vertices that differ from the generated shape by at least half a quantum or have paint/surface. */
  changedCount(quantum = SCULPT_QUANTUM): number {
    const half = quantum * 0.5, p = this.position, b = this.base;
    const changed = new Set<number>();
    for (let i = 0; i < this.count; i++) {
      const bX = b[i * 3] ?? 0;
      const bY = b[i * 3 + 1] ?? 0;
      const bZ = b[i * 3 + 2] ?? 0;
      if (Math.abs(p.getX(i) - bX) >= half || Math.abs(p.getY(i) - bY) >= half || Math.abs(p.getZ(i) - bZ) >= half) {
        changed.add(i);
      }
    }
    if (this.colorAttr && this.baseColor) {
      const ca = this.colorAttr, bc = this.baseColor;
      for (let i = 0; i < this.count; i++) {
        const bcX = bc[i * 3] ?? 1;
        const bcY = bc[i * 3 + 1] ?? 1;
        const bcZ = bc[i * 3 + 2] ?? 1;
        if (Math.abs(ca.getX(i) - bcX) > 1 / 255 || Math.abs(ca.getY(i) - bcY) > 1 / 255 || Math.abs(ca.getZ(i) - bcZ) > 1 / 255) {
          changed.add(i);
        }
      }
    }
    if (this.surfaceAttr) {
      const s = this.surfaceAttr;
      for (let i = 0; i < this.count; i++) {
        if (s.getY(i) > 0.003) changed.add(i);
      }
    }
    return changed.size;
  }

  /** The sparse diff against the generated shape, or null when there is none. */
  extractDoc(key: string, quantum = SCULPT_QUANTUM): SculptMeshDoc | null {
    const half = quantum * 0.5, p = this.position, b = this.base;
    const idx: number[] = [], d: number[] = [];
    for (let i = 0; i < this.count; i++) {
      const bX = b[i * 3] ?? 0;
      const bY = b[i * 3 + 1] ?? 0;
      const bZ = b[i * 3 + 2] ?? 0;
      const dx = p.getX(i) - bX, dy = p.getY(i) - bY, dz = p.getZ(i) - bZ;
      if (Math.abs(dx) < half && Math.abs(dy) < half && Math.abs(dz) < half) continue;
      idx.push(i);
      d.push(dx / quantum, dy / quantum, dz / quantum);
    }
    const cidx: number[] = [], c: number[] = [];
    if (this.colorAttr && this.baseColor) {
      const ca = this.colorAttr, bc = this.baseColor;
      for (let i = 0; i < this.count; i++) {
        const r = ca.getX(i), g = ca.getY(i), bl = ca.getZ(i);
        const bcX = bc[i * 3] ?? 1;
        const bcY = bc[i * 3 + 1] ?? 1;
        const bcZ = bc[i * 3 + 2] ?? 1;
        if (Math.abs(r - bcX) <= 1 / 255 && Math.abs(g - bcY) <= 1 / 255 && Math.abs(bl - bcZ) <= 1 / 255) continue;
        cidx.push(i);
        c.push(Math.round(Math.max(0, Math.min(1, r)) * 255), Math.round(Math.max(0, Math.min(1, g)) * 255), Math.round(Math.max(0, Math.min(1, bl)) * 255));
      }
    }
    const sidx: number[] = [], s: number[] = [];
    if (this.surfaceAttr) {
      const sa = this.surfaceAttr;
      for (let i = 0; i < this.count; i++) {
        const sId = sa.getX(i);
        const sWeight = sa.getY(i);
        if (sWeight <= 0.003) continue;
        sidx.push(i);
        s.push(Math.round(sId), Math.round(Math.max(0, Math.min(1, sWeight)) * 255));
      }
    }
    if (!idx.length && !cidx.length && !sidx.length) return null;
    return {
      key, n: this.count,
      ...(quantum !== SCULPT_QUANTUM ? { q: quantum } : {}),
      ...(idx.length ? { shape: { idx: encodeIndices(idx), d: encodeInt16(d) } } : {}),
      ...(cidx.length ? { paint: { idx: encodeIndices(cidx), c: encodeBytes(Uint8Array.from(c)) } } : {}),
      ...(sidx.length ? { surface: { idx: encodeIndices(sidx), s: encodeBytes(Uint8Array.from(s)) } } : {}),
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
        const i = idx[k] ?? 0;
        if (i >= this.count) continue;
        const bX = this.base[i * 3] ?? 0;
        const bY = this.base[i * 3 + 1] ?? 0;
        const bZ = this.base[i * 3 + 2] ?? 0;
        const dX = d[k * 3] ?? 0;
        const dY = d[k * 3 + 1] ?? 0;
        const dZ = d[k * 3 + 2] ?? 0;
        this.position.setXYZ(i, bX + dX * quantum, bY + dY * quantum, bZ + dZ * quantum);
        const g = this.groupOf[i];
        if (g !== undefined) touched.add(g);
      }
    }
    if (doc.paint) {
      const idx = decodeIndices(doc.paint.idx);
      const c = decodeBytes(doc.paint.c);
      if (c.length !== idx.length * 3) return false;
      const attr = this.ensureColor();
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k] ?? 0;
        if (i >= this.count) continue;
        const cR = c[k * 3] ?? 255;
        const cG = c[k * 3 + 1] ?? 255;
        const cB = c[k * 3 + 2] ?? 255;
        attr.setXYZ(i, cR / 255, cG / 255, cB / 255);
      }
      attr.needsUpdate = true;
    }
    if (doc.surface) {
      const idx = decodeIndices(doc.surface.idx);
      const s = decodeBytes(doc.surface.s);
      if (s.length !== idx.length * 2) return false;
      const sattr = this.ensureSurface();
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k] ?? 0;
        if (i >= this.count) continue;
        const sId = s[k * 2] ?? 0;
        const sWeight = (s[k * 2 + 1] ?? 0) / 255;
        sattr.setXY(i, sId, sWeight);
      }
      sattr.needsUpdate = true;
    }
    for (const g of touched) this.dirty.add(g);
    this.recomputeNormals(touched);
    this.finishStroke();
    return true;
  }

  /** Back to the generated shape and colours/surfaces. */
  reset(): void {
    (this.position.array as Float32Array).set(this.base);
    if (this.colorAttr && this.baseColor) {
      (this.colorAttr.array as Float32Array).set(this.baseColor);
      this.colorAttr.needsUpdate = true;
    }
    if (this.surfaceAttr) {
      (this.surfaceAttr.array as Float32Array).fill(0);
      this.surfaceAttr.needsUpdate = true;
    }
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
export const meshKey = (index: number, mesh: THREE.Mesh) => `${index}:${mesh.name || ''}:${mesh.geometry.attributes.position?.count ?? 0}`;
