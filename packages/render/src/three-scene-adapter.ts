import * as THREE from 'three';
import type { EntityId } from '@hm/contracts';
import { MaterialPool } from './materials';
import type { RenderDesc, SceneAdapter } from './scene-sync';

type Shape = RenderDesc['shape'];
type Node = {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  shape: Shape;
  materialKey: string;
};

const addUv1 = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => {
  const uv = geometry.getAttribute('uv');
  if (uv) geometry.setAttribute('uv1', uv.clone());
  return geometry;
};

const makeGeometry = (shape: Shape): THREE.BufferGeometry => {
  if (shape === 'sphere') return addUv1(new THREE.SphereGeometry(1, 48, 32));
  if (shape === 'box') return addUv1(new THREE.BoxGeometry(2, 2, 2));
  if (shape === 'cylinder') return addUv1(new THREE.CylinderGeometry(1, 1, 2, 48, 1));
  const plane = new THREE.PlaneGeometry(2, 2, 1, 1);
  plane.rotateX(-Math.PI / 2);
  return addUv1(plane);
};

export class ThreeSceneAdapter implements SceneAdapter {
  private readonly nodes = new Map<EntityId, Node>();
  private readonly geometries = new Map<Shape, THREE.BufferGeometry>();
  private readonly materials: MaterialPool;

  constructor(private readonly scene: THREE.Scene, resolveUrl: (path: string) => string) {
    this.materials = new MaterialPool(resolveUrl);
  }

  private geometry(shape: Shape): THREE.BufferGeometry {
    const cached = this.geometries.get(shape);
    if (cached) return cached;
    const geometry = makeGeometry(shape);
    this.geometries.set(shape, geometry);
    return geometry;
  }

  create(id: EntityId, desc: RenderDesc): void {
    if (this.nodes.has(id)) this.remove(id);
    const material = this.materials.acquire(desc);
    const mesh = new THREE.Mesh(this.geometry(desc.shape), material.material);
    mesh.name = `entity-${id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.nodes.set(id, { mesh, shape: desc.shape, materialKey: material.key });
    this.apply(this.nodes.get(id)!, desc);
  }

  update(id: EntityId, desc: RenderDesc): void {
    const node = this.nodes.get(id);
    if (!node) {
      this.create(id, desc);
      return;
    }
    this.apply(node, desc);
  }

  private apply(node: Node, desc: RenderDesc): void {
    if (node.shape !== desc.shape) {
      node.shape = desc.shape;
      node.mesh.geometry = this.geometry(desc.shape);
    }
    const nextMaterial = this.materials.acquire(desc);
    if (node.materialKey !== nextMaterial.key) {
      this.materials.release(node.materialKey);
      node.materialKey = nextMaterial.key;
      node.mesh.material = nextMaterial.material;
    } else {
      this.materials.release(nextMaterial.key);
    }
    node.mesh.position.fromArray(desc.position);
    node.mesh.quaternion.fromArray(desc.rotation).normalize();
    const size = Math.max(0, desc.size);
    node.mesh.scale.set(size * desc.scale[0], size * desc.scale[1], size * desc.scale[2]);
    node.mesh.visible = desc.visible;
  }

  remove(id: EntityId): void {
    const node = this.nodes.get(id);
    if (!node) return;
    this.scene.remove(node.mesh);
    this.materials.release(node.materialKey);
    this.nodes.delete(id);
  }

  dispose(): void {
    for (const id of [...this.nodes.keys()]) this.remove(id);
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
    this.materials.dispose();
  }
}