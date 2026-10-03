import * as THREE from 'three';
import type { VoxelModel } from '@hm/voxel';
import { voxelGeometry } from './voxel-view';
import { halveModel } from './decor-lod';

/** One drawable primitive of a prop, in the prop's local space (a prop is a few of these: a palm = trunk + crown ...). */
export interface DecorPart {
  readonly shape: 'sphere' | 'box' | 'cylinder';
  readonly size: number;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
  readonly scale: readonly [number, number, number];
  readonly color: string;
  readonly roughness: number;
  readonly metalness: number;
}
/** A prop drawn from a voxel model instead of primitives: `id` groups the copies, `block` is metres per voxel. */
export interface DecorVoxel { readonly id: string; readonly model: VoxelModel; readonly block: number }
export interface DecorInstance { readonly parts: readonly DecorPart[]; readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly scale: number; readonly voxel?: DecorVoxel }

/** Meshed voxel props by id (and `id@half` for the distant copy), kept for the life of the page (a handful of small meshes). */
const VOXEL_GEOMETRY = new Map<string, THREE.BufferGeometry | null>();
const meshed = (key: string, model: () => VoxelModel): THREE.BufferGeometry | null => {
  let g = VOXEL_GEOMETRY.get(key);
  if (g === undefined) { g = voxelGeometry(model(), { ao: true, greedy: true }); VOXEL_GEOMETRY.set(key, g); }
  return g;
};

/** One voxel prop's copies: every voxel near the camera, the halved model further out, the quartered one far away. */
interface VoxelLod {
  readonly near: THREE.InstancedMesh;
  readonly far: THREE.InstancedMesh | null;
  readonly farthest: THREE.InstancedMesh | null;
  readonly full: readonly THREE.Matrix4[];
  readonly half: readonly THREE.Matrix4[];
  readonly quarter: readonly THREE.Matrix4[];
  readonly at: readonly THREE.Vector3[];
  /** Bounding sphere of each copy (for skipping the ones out of view). */
  readonly centre: readonly THREE.Vector3[];
  readonly radius: readonly number[];
  readonly standard: THREE.MeshStandardMaterial;
  /** Low tier: plain diffuse lighting (the plants are matte, so they look the same for less work). Made on first use. */
  lambert: THREE.MeshLambertMaterial | null;
}

const sphere = new THREE.Sphere();
const viewProjection = new THREE.Matrix4();
const look = new THREE.Vector3();

/**
 * The scale that turns the unit geometry into the part, by the recipe convention (see @hm/scatter): a sphere's radius is `size`, a box's edge is
 * `size`, a cylinder's radius is `size` and its height is 1; `scale` stretches each and, for a cylinder, scale.y is its length in metres.
 * `propScale` is the placement's own uniform scale.
 */
export function partScale(part: Pick<DecorPart, 'shape' | 'size' | 'scale'>, propScale: number): [number, number, number] {
  const k = part.size * propScale;
  if (part.shape === 'cylinder') return [part.scale[0] * k, part.scale[1] * propScale, part.scale[2] * k];
  return [part.scale[0] * k, part.scale[1] * k, part.scale[2] * k];
}

/**
 * Foliage and rocks: thousands of small props drawn as a handful of InstancedMeshes (one per shape+material),
 * so a dressed island costs a few draw calls instead of one per part. Purely visual; it has no collision.
 */
export class DecorView {
  readonly group = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly lods: VoxelLod[] = [];
  private detailRadius = Infinity;
  private cull = false;
  private drawDistance = Infinity;
  private readonly frustum = new THREE.Frustum();
  private readonly lastAt = new THREE.Vector3(Infinity, Infinity, Infinity);
  private readonly lastLook = new THREE.Vector3();

  constructor(instances: readonly DecorInstance[]) {
    this.group.name = 'decor';
    const buckets = new Map<string, { part: DecorPart; matrices: THREE.Matrix4[] }>();
    const q = new THREE.Quaternion(), qy = new THREE.Quaternion(), qp = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const voxelBuckets = new Map<string, { voxel: DecorVoxel; matrices: THREE.Matrix4[] }>();
    for (const inst of instances) {
      qy.setFromAxisAngle(up, -inst.yaw);
      if (inst.voxel) {
        let vb = voxelBuckets.get(inst.voxel.id);
        if (!vb) { vb = { voxel: inst.voxel, matrices: [] }; voxelBuckets.set(inst.voxel.id, vb); }
        const k = inst.voxel.block * inst.scale;
        vb.matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(inst.x, inst.y, inst.z), qy.clone(), new THREE.Vector3(k, k, k)));
        continue;
      }
      for (const part of inst.parts) {
        const key = `${part.shape}|${part.color}|${part.roughness}|${part.metalness}`;
        let b = buckets.get(key);
        if (!b) { b = { part, matrices: [] }; buckets.set(key, b); }
        p.set(part.position[0] * inst.scale, part.position[1] * inst.scale, part.position[2] * inst.scale).applyQuaternion(qy).add(new THREE.Vector3(inst.x, inst.y, inst.z));
        qp.set(part.rotation[0], part.rotation[1], part.rotation[2], part.rotation[3]);
        q.copy(qy).multiply(qp);
        const [sx, sy, sz] = partScale(part, inst.scale);
        s.set(sx, sy, sz);
        b.matrices.push(new THREE.Matrix4().compose(p, q, s));
      }
    }
    for (const { voxel, matrices } of voxelBuckets.values()) {
      // meshing a voxel model is the slow part: do it once per model and share it between rebuilds (the plants are re-laid while you sculpt)
      const geometry = meshed(voxel.id, () => voxel.model);
      if (!geometry) continue;
      const halfGeometry = meshed(`${voxel.id}@half`, () => halveModel(voxel.model));
      const quarterGeometry = halfGeometry ? meshed(`${voxel.id}@quarter`, () => halveModel(halveModel(voxel.model))) : null;
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
      const instanced = (g: THREE.BufferGeometry): THREE.InstancedMesh => {
        const mesh = new THREE.InstancedMesh(g, material, matrices.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        this.group.add(mesh);
        return mesh;
      };
      const half = matrices.map((m) => m.clone().scale(new THREE.Vector3(2, 2, 2)));
      const quarter = matrices.map((m) => m.clone().scale(new THREE.Vector3(4, 4, 4)));
      const at = matrices.map((m) => new THREE.Vector3().setFromMatrixPosition(m));
      // a sphere round each copy that holds it whatever way it is turned: the model's own sphere, its centre lifted, its sideways offset added
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      const bs = geometry.boundingSphere!;
      const k = matrices.map((m) => m.getMaxScaleOnAxis());
      const centre = at.map((p, i) => new THREE.Vector3(p.x, p.y + bs.center.y * k[i]!, p.z));
      const radius = k.map((s) => (bs.radius + Math.hypot(bs.center.x, bs.center.z)) * s);
      this.lods.push({ near: instanced(geometry), far: halfGeometry ? instanced(halfGeometry) : null, farthest: quarterGeometry ? instanced(quarterGeometry) : null, full: matrices, half, quarter, at, centre, radius, standard: material, lambert: null });
      this.materials.push(material);
    }
    this.layOut(null);
    for (const { part, matrices } of buckets.values()) {
      // unit geometry, matching partScale: sphere radius 1, box edge 1, cylinder radius 1 and height 1
      const geometry = part.shape === 'sphere' ? new THREE.SphereGeometry(1, 12, 8) : part.shape === 'box' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(1, 1, 1, 10);
      const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: part.roughness, metalness: part.metalness });
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.geometries.push(geometry);
      this.materials.push(material);
    }
  }

  /**
   * Plants nearer than `radius` metres to the camera show every voxel, the rest their halved model (Infinity = all full detail).
   * Set from the quality tier; weak graphics chips spend most of the plants' cost on vertices.
   */
  setDetailRadius(radius: number): void {
    if (radius === this.detailRadius) return;
    this.detailRadius = radius;
    if (radius === Infinity && !this.cull) this.layOut(null);
    else this.lastAt.set(-Infinity, 0, 0); // lay out again on the next update
  }

  /** Plants further than this (metres) are not drawn at all (Infinity = every plant). */
  setDrawDistance(distance: number): void {
    if (distance === this.drawDistance) return;
    this.drawDistance = distance;
    this.lastAt.set(-Infinity, 0, 0);
    if (distance === Infinity && this.detailRadius === Infinity && !this.cull) this.layOut(null);
  }

  /** Low tier: the voxel plants draw with plain diffuse lighting instead of the full PBR model. */
  setLowCost(on: boolean): void {
    for (const l of this.lods) {
      if (on && !l.lambert) { l.lambert = new THREE.MeshLambertMaterial({ vertexColors: true }); this.materials.push(l.lambert); }
      const m = on ? l.lambert! : l.standard;
      for (const mesh of [l.near, l.far, l.farthest]) if (mesh) mesh.material = m;
    }
  }

  /**
   * Skip the copies outside the camera's view (low tier). Only without shadows: a palm behind the camera can throw its shadow into view.
   */
  setCulling(on: boolean): void {
    if (on === this.cull) return;
    this.cull = on;
    if (!on && this.detailRadius === Infinity) this.layOut(null);
    else this.lastAt.set(-Infinity, 0, 0);
  }

  /**
   * Call every frame with the camera. Copies move between the full, halved and quartered meshes (beyond `radius` and three times it),
   * and with culling on, copies out of view are skipped; it is worked out again once the camera has moved half a metre or turned 2 degrees.
   */
  update(camera: THREE.Camera): void {
    if (this.detailRadius === Infinity && !this.cull && this.drawDistance === Infinity) return; // everything at full detail, nothing skipped: laid out once
    camera.getWorldDirection(look);
    const step = this.cull ? 0.5 : 2;
    const moved = this.lastAt.distanceToSquared(camera.position) > step * step;
    const turned = this.cull && look.dot(this.lastLook) < 0.9994;
    if (!moved && !turned) return;
    this.lastLook.copy(look);
    this.layOut(camera);
  }

  private layOut(camera: THREE.Camera | null): void {
    if (camera) {
      this.lastAt.copy(camera.position);
      camera.updateMatrixWorld();
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(viewProjection);
    } else this.lastAt.set(Infinity, Infinity, Infinity);
    const r = this.detailRadius, near2 = r * r, far2 = 9 * r * r, draw2 = this.drawDistance * this.drawDistance;
    for (const l of this.lods) {
      let n = 0, f = 0, ff = 0;
      for (let i = 0; i < l.full.length; i++) {
        if (camera && this.cull) {
          // a margin round each copy so nothing pops in at the edge of the screen between two layouts
          sphere.center.copy(l.centre[i]!);
          sphere.radius = l.radius[i]! * 1.15 + 1.5;
          if (!this.frustum.intersectsSphere(sphere)) continue;
        }
        const d2 = camera ? l.at[i]!.distanceToSquared(camera.position) : 0;
        if (d2 > draw2) continue;
        if (!l.far || d2 <= near2) l.near.setMatrixAt(n++, l.full[i]!);
        else if (!l.farthest || d2 <= far2) l.far.setMatrixAt(f++, l.half[i]!);
        else l.farthest.setMatrixAt(ff++, l.quarter[i]!);
      }
      l.near.count = n;
      l.near.instanceMatrix.needsUpdate = true;
      if (l.far) { l.far.count = f; l.far.instanceMatrix.needsUpdate = true; }
      if (l.farthest) { l.farthest.count = ff; l.farthest.instanceMatrix.needsUpdate = true; }
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
