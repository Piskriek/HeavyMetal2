import * as THREE from 'three';

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
export interface DecorInstance { readonly parts: readonly DecorPart[]; readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly scale: number }

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
    for (const inst of instances) {
      qy.setFromAxisAngle(up, -inst.yaw);
      for (const part of inst.parts) {
        const key = `${part.shape}|${part.color}|${part.roughness}|${part.metalness}`;
        let b = buckets.get(key);
        if (!b) { b = { part, matrices: [] }; buckets.set(key, b); }
        p.set(part.position[0] * inst.scale, part.position[1] * inst.scale, part.position[2] * inst.scale).applyQuaternion(qy).add(new THREE.Vector3(inst.x, inst.y, inst.z));
        qp.set(part.rotation[0], part.rotation[1], part.rotation[2], part.rotation[3]);
        q.copy(qy).multiply(qp);
        const k = part.size * inst.scale;
        s.set(part.scale[0] * k, part.scale[1] * k, part.scale[2] * k);
        b.matrices.push(new THREE.Matrix4().compose(p, q, s));
      }
    }
    for (const { part, matrices } of buckets.values()) {
      const geometry = part.shape === 'sphere' ? new THREE.SphereGeometry(1, 12, 8) : part.shape === 'box' ? new THREE.BoxGeometry(2, 2, 2) : new THREE.CylinderGeometry(1, 1, 2, 10);
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
