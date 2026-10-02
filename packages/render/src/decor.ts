import * as THREE from 'three';
import type { VoxelModel } from '@hm/voxel';
import { voxelGeometry } from './voxel-view';

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
      const geometry = voxelGeometry(voxel.model, { ao: true, greedy: true });
      if (!geometry) continue;
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
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

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
