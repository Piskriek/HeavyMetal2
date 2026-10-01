import * as THREE from 'three';
import type { OverlayShape, Vec3 } from '@hm/contracts';

const lineMaterial = (color: string): THREE.LineBasicMaterial => new THREE.LineBasicMaterial({
  color: new THREE.Color(color),
  depthTest: false,
  depthWrite: false,
  transparent: true,
  opacity: 0.95,
  toneMapped: false,
});

const vector = (value: Vec3): THREE.Vector3 => new THREE.Vector3(value[0], value[1], value[2]);

const makeLine = (shape: Extract<OverlayShape, { type: 'line' }>): THREE.Line => {
  const geometry = new THREE.BufferGeometry().setFromPoints([vector(shape.from), vector(shape.to)]);
  return new THREE.Line(geometry, lineMaterial(shape.color));
};

const makeRing = (shape: Extract<OverlayShape, { type: 'ring' }>): THREE.LineLoop => {
  const normal = vector(shape.normal);
  if (normal.lengthSq() < 1e-12) normal.set(0, 1, 0);
  normal.normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 48; i += 1) {
    const angle = i / 48 * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * shape.radius, 0, Math.sin(angle) * shape.radius).applyQuaternion(rotation).add(vector(shape.center)));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), lineMaterial(shape.color));
};

const makeBox = (shape: Extract<OverlayShape, { type: 'box' }>): THREE.LineSegments => {
  const box = new THREE.BoxGeometry(shape.half[0] * 2, shape.half[1] * 2, shape.half[2] * 2);
  const edges = new THREE.EdgesGeometry(box);
  box.dispose();
  const line = new THREE.LineSegments(edges, lineMaterial(shape.color));
  line.position.fromArray(shape.center);
  return line;
};

const makeHandle = (shape: Extract<OverlayShape, { type: 'handle' }>): THREE.Sprite => {
  const material = new THREE.SpriteMaterial({
    color: new THREE.Color(shape.color),
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = `overlay-handle-${shape.id}`;
  sprite.position.fromArray(shape.position);
  sprite.scale.setScalar(shape.size * 2);
  return sprite;
};

const disposeObject = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    if (child instanceof THREE.Line || child instanceof THREE.LineSegments || child instanceof THREE.Sprite) {
      if ('geometry' in child && child.geometry instanceof THREE.BufferGeometry) child.geometry.dispose();
      const material: THREE.Material | THREE.Material[] = child.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    }
  });
};

export class OverlayManager {
  private readonly groups = new Map<string, THREE.Group>();

  constructor(private readonly scene: THREE.Scene) {}

  show(id: string, shapes: readonly OverlayShape[]): void {
    this.hide(id);
    const group = new THREE.Group();
    group.name = `overlay-${id}`;
    group.renderOrder = 10000;
    for (const shape of shapes) {
      const object = shape.type === 'line' ? makeLine(shape)
        : shape.type === 'ring' ? makeRing(shape)
          : shape.type === 'box' ? makeBox(shape) : makeHandle(shape);
      object.renderOrder = 10000;
      group.add(object);
    }
    this.groups.set(id, group);
    this.scene.add(group);
  }

  hide(id: string): void {
    const group = this.groups.get(id);
    if (!group) return;
    this.scene.remove(group);
    disposeObject(group);
    this.groups.delete(id);
  }

  dispose(): void {
    for (const id of [...this.groups.keys()]) this.hide(id);
  }
}