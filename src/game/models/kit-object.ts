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
 * The placement preview: the model itself, see-through, so you see its real size and shape where it
 * will land. Its materials are its own copies (the shared ones stay opaque).
 */
export function ghostKitObject(type: string, low: boolean): THREE.Group {
  const ghost = createKitObject(type, '__ghost', low, (group) => {
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = (mesh.material as THREE.Material).clone();
      material.transparent = true;
      material.opacity = 0.55;
      material.depthWrite = false;
      mesh.material = material;
      mesh.castShadow = false;
    });
  });
  ghost.name = 'GhostKitModel';
  ghost.userData = { isKitGhost: true };
  return ghost;
}

/** The strongest glow the slider gives (at 100): the texture shines at this share of its own colour. */
export const KIT_BRIGHTNESS_MAX_GLOW = 0.9;

/**
 * Brightness 0..100 for one placed model, so it can be balanced against the terrain: 0 is the model
 * exactly as lit by the sun and sky; higher values let its own texture glow on top of that light.
 * Copies share materials, so a brightened copy gets its own material (made once, reused per level).
 */
export function setKitBrightness(group: THREE.Object3D, value: number): void {
  const level = Math.max(0, Math.min(100, Math.round(value || 0)));
  group.userData.brightness = level;
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const base: THREE.Material = mesh.userData.baseMaterial ?? mesh.material;
    mesh.userData.baseMaterial = base;
    if (level === 0) { mesh.material = base; return; }
    let bright = mesh.userData.brightMaterial as THREE.MeshStandardMaterial | undefined;
    if (!bright) {
      bright = (base as THREE.MeshStandardMaterial).clone();
      bright.emissive = new THREE.Color(0xffffff);
      bright.emissiveMap = (base as THREE.MeshStandardMaterial).map ?? null;
      mesh.userData.brightMaterial = bright;
    }
    bright.emissiveIntensity = (level / 100) * KIT_BRIGHTNESS_MAX_GLOW;
    mesh.material = bright;
  });
}

/** Frees the per-copy brightened materials (the shared originals stay). */
export function releaseKitBrightness(group: THREE.Object3D): void {
  group.traverse((o) => {
    const bright = (o as THREE.Mesh).userData?.brightMaterial as THREE.Material | undefined;
    if (bright) bright.dispose();
  });
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
      // A brightness set before the model arrived applies to it now.
      if (group.userData.brightness) setKitBrightness(group, group.userData.brightness);
      onLoaded?.(group);
    })
    .catch((err) => console.warn(`[Kit] ${model.id} did not load`, err));
  return group;
}
