/**
 * A placed Meshy model: an empty group that stands in at once (so selection, the gizmo and undo work
 * straight away) and receives the model when its GLB has loaded. Copies share geometry and textures.
 */
import { hologramize } from '../builder/hologram';
import { effectiveColor, normalizeDescriptor, type MaterialDescriptor } from '../materials/material-descriptor';
import * as THREE from 'three';
import { injectIslandModelShader } from '../island-route/island-surface-shader';
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
  // The builder's hologram look (builder/hologram.ts): see-through cyan over the model's own painting.
  const ghost = createKitObject(type, '__ghost', low, (group) => hologramize(group));
  ghost.name = 'GhostKitModel';
  ghost.userData = { isKitGhost: true };
  return ghost;
}

/** The strongest glow the slider gives (at 100): the texture shines at this share of its own colour. */
export const KIT_BRIGHTNESS_MAX_GLOW = 0.9;

/**
 * Brightness 0..100 for one placed model, so it can be balanced against the terrain: 0 is the model
 * exactly as lit by the sun and sky; higher values let its own texture glow on top of that light.
 * Keeps whatever the Shading tab set (see setKitLook).
 */
export function setKitBrightness(group: THREE.Object3D, value: number): void {
  setKitLook(group, value, group.userData.lookDesc ?? null);
}

/**
 * One placed model's look: its brightness and the Shading tab's settings (colour tint, roughness,
 * metalness, lit or unlit with glow, double-sided, shadows). Copies share materials, so a changed copy
 * gets its own material (made once, reused); a copy with neither goes back to the shared original.
 */
export function setKitLook(group: THREE.Object3D, brightness: number, desc: MaterialDescriptor | null): void {
  const level = Math.max(0, Math.min(100, Math.round(brightness || 0)));
  const d = desc ? normalizeDescriptor(desc) : null;
  group.userData.brightness = level;
  group.userData.lookDesc = desc ?? null;
  const tint = d ? new THREE.Color().setRGB(...effectiveColor(d, 'ridge')) : null;
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const base = (mesh.userData.baseMaterial ?? mesh.material) as THREE.MeshStandardMaterial;
    mesh.userData.baseMaterial = base;
    if (mesh.userData.baseShadows === undefined) mesh.userData.baseShadows = [mesh.castShadow, mesh.receiveShadow];
    const [cast, receive] = mesh.userData.baseShadows as [boolean, boolean];
    mesh.castShadow = d ? d.castShadow : cast;
    mesh.receiveShadow = d ? d.receiveShadow : receive;
    if (level === 0 && !d) { mesh.material = base; return; }
    const unlit = d?.shadingMode === 'unlit';
    let look = mesh.userData.lookMaterial as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | undefined;
    if (!look || (look as THREE.MeshBasicMaterial).isMeshBasicMaterial !== unlit) {
      look?.dispose();
      look = unlit
        ? new THREE.MeshBasicMaterial({ map: base.map ?? null, transparent: base.transparent, opacity: base.opacity, alphaTest: base.alphaTest })
        : base.clone();
      mesh.userData.lookMaterial = look;
    }
    // A model painted with island surfaces keeps them under any look (lit or unlit).
    if (mesh.geometry.getAttribute('islSurface')) injectIslandModelShader(look);
    look.color.copy(base.color);
    if (tint) look.color.multiply(tint);
    look.side = d?.doubleSided ? THREE.DoubleSide : base.side;
    if (!unlit) {
      const lit = look as THREE.MeshStandardMaterial;
      lit.roughness = d ? d.roughness : base.roughness;
      lit.metalness = d ? d.metalness : base.metalness;
      lit.emissive = new THREE.Color(0xffffff);
      lit.emissiveMap = base.map ?? null;
      lit.emissiveIntensity = (level / 100) * KIT_BRIGHTNESS_MAX_GLOW;
    }
    look.needsUpdate = true;
    mesh.material = look;
  });
}

/** Frees the per-copy materials (the shared originals stay). */
export function releaseKitBrightness(group: THREE.Object3D): void {
  group.traverse((o) => {
    const look = (o as THREE.Mesh).userData?.lookMaterial as THREE.Material | undefined;
    if (look) look.dispose();
  });
}

/**
 * The group for a kit prop. `low` picks the low tier (the Performance setting). `onLoaded` runs once
 * the model is in (the builder refreshes the selection box); a failed load leaves the group empty.
 */
/** Placed models still loading (build mode waits for them behind its loading bar). */
let kitLoadsPending = 0;
export const pendingKitLoads = () => kitLoadsPending;

export function createKitObject(type: string, propId: string, low: boolean, onLoaded?: (group: THREE.Group) => void): THREE.Group {
  const group = new THREE.Group();
  group.userData = { propId, isKitModel: true };
  const model: KitModel | undefined = kitModelFor(type);
  if (!model) return group;
  kitLoadsPending += 1;
  loadGlb(kitModelUrl(model.id, low))
    .finally(() => { kitLoadsPending -= 1; })
    .then((scene) => {
      if (group.userData.released) return;
      const copy = fitKitModel(scene.clone(true), model.size);
      copy.name = `Kit:${model.id}`;
      group.add(copy);
      // A brightness or Shading-tab look set before the model arrived applies to it now.
      if (group.userData.brightness || group.userData.lookDesc) setKitLook(group, group.userData.brightness ?? 0, group.userData.lookDesc ?? null);
      onLoaded?.(group);
    })
    .catch((err) => console.warn(`[Kit] ${model.id} did not load`, err));
  return group;
}
