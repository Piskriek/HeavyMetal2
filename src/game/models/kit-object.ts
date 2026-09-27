/**
 * A placed Meshy model: an empty group that stands in at once (so selection, the gizmo and undo work
 * straight away) and receives the model when its GLB has loaded. Copies share geometry and textures.
 */
import * as THREE from 'three';
import { loadGlb } from './glb';
import { kitModelFor, kitModelUrl, type KitModel } from './kit-catalog';

/**
 * Fits a model in place: its longest side becomes `size`, centred over the origin in x and z, its base
 * at y 0. Meshy's tiers differ slightly in scale, so each tier is fitted to the same size on its own.
 */
export function fitKitModel(model: THREE.Object3D, size: number): THREE.Object3D {
  model.position.set(0, 0, 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const dims = box.getSize(new THREE.Vector3());
  const s = size / Math.max(dims.x, dims.y, dims.z, 1e-6);
  model.scale.setScalar(s);
  model.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
  return model;
}

/**
 * The group for a kit prop. `low` picks the low tier (the Performance setting). `onLoaded` runs once
 * the model is in (the builder refreshes the selection box); a failed load leaves the group empty.
 */
export function createKitObject(type: string, propId: string, low: boolean, onLoaded?: (group: THREE.Group) => void): THREE.Group {
  const group = new THREE.Group();
  group.userData = { propId, isKitModel: true };
  const model: KitModel | undefined = kitModelFor(type);
  if (!model) return group;
  loadGlb(kitModelUrl(model.id, low))
    .then((scene) => {
      if (group.userData.released) return;
      const copy = fitKitModel(scene.clone(true), model.size);
      copy.name = `Kit:${model.id}`;
      group.add(copy);
      onLoaded?.(group);
    })
    .catch((err) => console.warn(`[Kit] ${model.id} did not load`, err));
  return group;
}
