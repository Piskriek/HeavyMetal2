/**
 * The builder's scene kit: placed lights, primitives, and edits to the course's own scenery, plus
 * the shader library that dresses primitives and scenery. TrackBuilder3D hands every prop of these
 * kinds to the kit (create / transform / release) and calls `update` once per rendered frame.
 *
 * All three kinds are ordinary PlacedProps, so they get the builder's selection, gizmo, undo, local
 * save and disk backups for free:
 *   - `light_*`       → a marker the builder can click, plus a slot in the LightRig while nearby;
 *   - `prim_*`        → a mesh (unit geometry scaled to width/height/depth) wearing a shader;
 *   - `terrain_edit`  → an override on one generated scenery part: moved, hidden or re-shaded.
 */
import * as THREE from 'three';
import { BlendMaterials, setTileRandomization } from '../materials/blend-material';
import { DEFAULT_MATERIAL_DESCRIPTOR, normalizeDescriptor, type MaterialDescriptor } from '../materials/material-descriptor';
import type { MaterialCache } from '../materials/material-cache';
import { SHADER_TEXTURES, normalizeShader, type ShaderDef } from '../materials/shader-library';
import {
  createLightMarker, disposeObject, isLightType, lightSettingsFor, setMarkerSelected, spotDirection, updateLightMarker, LightRig,
} from './light-rig';
import { applyPrimitiveTransform, isPrimitiveType, primitiveGeometry, primitiveShape } from './primitives';
import { SceneryIndex, isShown, sceneryMaterials, setPartMaterial, unwrapPivot, wrapInPivot, type SceneryPart } from './scenery-index';

export const TERRAIN_EDIT_TYPE = 'terrain_edit';
export const isTerrainEdit = (p: { type: string }) => p.type === TERRAIN_EDIT_TYPE;
export const isKitType = (type: string) => isLightType(type) || isPrimitiveType(type) || type === TERRAIN_EDIT_TYPE;

/** The fields the kit reads from a prop (PlacedProp is a superset). */
export interface KitProp {
  id: string; type: string; x: number; y: number; z: number; rotY: number; rotX?: number; rotZ?: number; scale: number;
  width?: number; height?: number; depth?: number; flipX?: boolean; visible?: boolean;
  light?: unknown; shader?: unknown; materialDesc?: MaterialDescriptor;
  terrainKey?: string; terrainHidden?: boolean; terrainOrigin?: [number, number, number];
}

/** A primitive with no shader and no material of its own: plain clay, so it reads as "not dressed yet". */
const CLAY: MaterialDescriptor = { ...DEFAULT_MATERIAL_DESCRIPTOR, color: '#b8b2a6', roughness: 0.85, metalness: 0 };

const TILE_RANDOM_KEY = 'hm2-builder-tile-random-v1';

export class SceneKit {
  readonly lights: LightRig;
  readonly scenery: SceneryIndex;
  readonly shaders: BlendMaterials;
  private readonly pivots = new Map<string, { part: SceneryPart; pivot: THREE.Group }>();
  private readonly flatMaterials = new Map<string, MaterialDescriptor>();
  private readonly textureCache = new Map<string, THREE.Texture>();
  private readonly loader = new THREE.TextureLoader();
  private tileRandom = { on: false, variation: 0.7 };

  constructor(
    private readonly scene: THREE.Scene,
    private readonly materialCache: MaterialCache,
    /** The course's own materials (their maps are reused as shader layers instead of loading twice). */
    courseMaterials?: Record<string, THREE.Material>,
  ) {
    this.scenery = new SceneryIndex(scene);
    this.lights = new LightRig(scene);
    this.courseMaps = courseMaterials;
    this.shaders = new BlendMaterials((url) => this.texture(url));
    try {
      const saved = typeof localStorage === 'undefined' ? null : JSON.parse(localStorage.getItem(TILE_RANDOM_KEY) ?? 'null');
      if (saved && typeof saved.on === 'boolean') this.setSceneryTileRandomization(saved.on, typeof saved.variation === 'number' ? saved.variation : 0.7, false);
    } catch { /* a setting, not data */ }
  }

  private readonly courseMaps?: Record<string, THREE.Material>;

  /* ───────────── Objects ───────────── */

  /** Builds the scene object for a kit prop (and adds it to the scene). */
  create(prop: KitProp): THREE.Object3D {
    let obj: THREE.Object3D;
    if (isLightType(prop.type)) {
      const settings = lightSettingsFor(prop);
      obj = createLightMarker(settings);
      obj.userData = { propId: prop.id, isLight: true, lightKind: settings.kind };
      this.scene.add(obj);
    } else if (isPrimitiveType(prop.type)) {
      const shape = primitiveShape(prop.type) ?? 'box';
      const mesh = new THREE.Mesh(primitiveGeometry(shape), this.primitiveMaterial(prop));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { propId: prop.id, isPrimitive: true };
      obj = mesh;
      this.scene.add(obj);
    } else {
      obj = this.createTerrainEdit(prop);
    }
    obj.name = `PlacedProp_${prop.id}`;
    this.applyTransform(prop, obj);
    return obj;
  }

  /** Pushes the prop's transform and settings into its object. */
  applyTransform(prop: KitProp, obj: THREE.Object3D) {
    const shown = prop.visible !== false;
    if (isLightType(prop.type)) {
      const settings = lightSettingsFor(prop);
      obj.position.set(prop.x, prop.y, prop.z);
      obj.rotation.set(prop.rotX ?? 0, prop.rotY ?? 0, prop.rotZ ?? 0, 'YXZ');
      obj.scale.setScalar(1);
      updateLightMarker(obj, settings);
      obj.visible = shown && this.markersShown;
      if (shown) this.lights.set(prop.id, settings, obj.position, spotDirection(prop));
      else this.lights.remove(prop.id);
    } else if (isPrimitiveType(prop.type)) {
      applyPrimitiveTransform(obj, prop);
      const mesh = obj as THREE.Mesh;
      const next = this.primitiveMaterial(prop, mesh.material as THREE.Material);
      if (next !== mesh.material) mesh.material = next;
      obj.visible = shown;
    } else {
      const entry = this.pivots.get(prop.id);
      if (!entry) return;
      if (!entry.part.locked) {
        entry.pivot.position.set(prop.x, prop.y, prop.z);
        entry.pivot.rotation.set(prop.rotX ?? 0, prop.rotY ?? 0, prop.rotZ ?? 0, 'YXZ');
        entry.pivot.scale.setScalar(prop.scale || 1);
      }
      entry.pivot.visible = shown && !prop.terrainHidden;
      this.dressPart(entry.part, prop);
    }
  }

  /** Removes a kit prop's object. A scenery edit puts the part back exactly as it was generated. */
  release(prop: KitProp, obj: THREE.Object3D | undefined) {
    if (isLightType(prop.type)) {
      this.lights.remove(prop.id);
      if (obj) { this.scene.remove(obj); disposeObject(obj); }
    } else if (isPrimitiveType(prop.type)) {
      if (obj) {
        this.scene.remove(obj);
        this.releaseMaterial((obj as THREE.Mesh).material as THREE.Material);
      }
    } else {
      const entry = this.pivots.get(prop.id);
      if (entry) {
        this.releaseMaterial(entry.part.meshes[0]?.mesh.material as THREE.Material);
        setPartMaterial(entry.part, null);
        unwrapPivot(entry.part, entry.pivot, this.scene);
        this.pivots.delete(prop.id);
      } else if (obj) {
        this.scene.remove(obj);
      }
    }
  }

  /* ───────────── Scenery ───────────── */

  /** The scenery part under a ray (edited or not), skipping hidden parts. */
  pickScenery(raycaster: THREE.Raycaster): SceneryPart | undefined { return this.scenery.pick(raycaster); }

  /** The prop fields a new edit of `part` starts from: exactly where the part is now. */
  newEditFields(part: SceneryPart) {
    return {
      type: TERRAIN_EDIT_TYPE, name: part.label, terrainKey: part.key,
      x: Math.round(part.center.x), y: Math.round(part.center.y), z: Math.round(part.center.z),
      rotY: 0, rotX: 0, rotZ: 0, scale: 1, alignToTrack: false, cameraFacing: false,
      terrainOrigin: [Math.round(part.center.x), Math.round(part.center.y), Math.round(part.center.z)] as [number, number, number],
      terrainLocked: part.locked || undefined,
    };
  }

  /** True when an edit changes nothing (so it can be dropped instead of saved). */
  isNoOpEdit(prop: KitProp): boolean {
    const o = prop.terrainOrigin;
    if (!o || prop.terrainHidden || prop.shader || prop.visible === false) return false;
    return Math.abs(prop.x - o[0]) < 1 && Math.abs(prop.y - o[1]) < 1 && Math.abs(prop.z - o[2]) < 1
      && Math.abs(prop.rotY ?? 0) < 1e-4 && Math.abs(prop.rotX ?? 0) < 1e-4 && Math.abs(prop.rotZ ?? 0) < 1e-4 && Math.abs((prop.scale || 1) - 1) < 1e-4;
  }

  /** Whether a scenery edit's part still exists in this build of the course. */
  editMatches(prop: KitProp): boolean { return !!prop.terrainKey && !!this.scenery.byKey(prop.terrainKey); }

  isLockedEdit(prop: KitProp): boolean { return !!prop.terrainKey && !!this.scenery.byKey(prop.terrainKey)?.locked; }

  private createTerrainEdit(prop: KitProp): THREE.Object3D {
    const part = prop.terrainKey ? this.scenery.byKey(prop.terrainKey) : undefined;
    if (!part) {
      // The course no longer builds this part: keep the edit (it is the user's data) but show nothing.
      const placeholder = new THREE.Object3D();
      placeholder.userData = { propId: prop.id, orphanTerrainEdit: true };
      this.scene.add(placeholder);
      return placeholder;
    }
    // A part edited twice (should not happen) keeps its first pivot.
    for (const [, e] of this.pivots) if (e.part === part) { e.pivot.userData.propId = prop.id; this.pivots.set(prop.id, e); return e.pivot; }
    const pivot = wrapInPivot(part, this.scene);
    pivot.userData = { propId: prop.id, terrainEdit: true, terrainKey: part.key };
    this.pivots.set(prop.id, { part, pivot });
    return pivot;
  }

  private dressPart(part: SceneryPart, prop: KitProp) {
    const current = part.meshes[0]?.mesh.material as THREE.Material | undefined;
    if (prop.shader) {
      const def = normalizeShader(prop.shader);
      const generated = part.meshes[0]?.material;
      const side = (Array.isArray(generated) ? generated[0] : generated)?.side ?? THREE.DoubleSide;
      if (current && this.shaders.has(current) && current.userData.hm2ShaderId === def.id && current.side === side) {
        this.shaders.update(def);
        return;
      }
      const next = this.shaders.acquire(def, side);
      if (current && this.shaders.has(current)) this.shaders.release(current);
      setPartMaterial(part, next);
    } else if (current && this.shaders.has(current)) {
      this.shaders.release(current);
      setPartMaterial(part, null);
    }
  }

  /* ───────────── Materials ───────────── */

  private primitiveMaterial(prop: KitProp, current?: THREE.Material): THREE.Material {
    if (prop.shader) {
      const def = normalizeShader(prop.shader);
      const side = prop.materialDesc?.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
      if (current && this.shaders.has(current) && current.userData.hm2ShaderId === def.id && current.side === side) {
        this.shaders.update(def);
        return current;
      }
      if (current) this.releaseMaterial(current);
      return this.shaders.acquire(def, side);
    }
    const desc = normalizeDescriptor(prop.materialDesc ?? CLAY);
    const key = JSON.stringify(desc);
    if (current && !this.shaders.has(current) && this.flatMaterials.get(current.uuid) && JSON.stringify(this.flatMaterials.get(current.uuid)) === key) return current;
    if (current) this.releaseMaterial(current);
    const material = this.materialCache.acquire(desc);
    this.flatMaterials.set(material.uuid, desc);
    return material;
  }

  private releaseMaterial(material: THREE.Material | undefined) {
    if (!material) return;
    if (this.shaders.has(material)) { this.shaders.release(material); return; }
    const desc = this.flatMaterials.get(material.uuid);
    if (desc) this.materialCache.release(desc);
  }

  /** A shader was edited in the manager: every live material wearing it updates now. */
  refreshShader(def: ShaderDef) { this.shaders.update(normalizeShader(def)); }

  private texture(url: string): THREE.Texture {
    let tex = this.textureCache.get(url);
    if (!tex) {
      // The course's own material of the same name already holds this tile: share its texture.
      const id = SHADER_TEXTURES.find((t) => t.url === url)?.id;
      const shared = id ? (this.courseMaps?.[id] as THREE.MeshStandardMaterial | undefined)?.map : undefined;
      if (shared) tex = shared;
      if (!tex) {
        if (typeof document === 'undefined') {
          tex = new THREE.Texture();
        } else {
          tex = this.loader.load(url);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 8;
        }
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      }
      tex.name ||= url;
      this.textureCache.set(url, tex);
    }
    return tex;
  }

  /* ───────────── The course's tiles, randomised ───────────── */

  get tileRandomization() { return { ...this.tileRandom }; }

  /** Scene-wide: break up the repeat of every generated scenery texture (a saved setting). */
  setSceneryTileRandomization(on: boolean, variation = this.tileRandom.variation, persist = true): number {
    this.tileRandom = { on, variation };
    const changed = setTileRandomization(sceneryMaterials(this.scenery), on, variation);
    if (persist) {
      try { localStorage.setItem(TILE_RANDOM_KEY, JSON.stringify(this.tileRandom)); } catch { /* a setting, not data */ }
    }
    return changed;
  }

  /* ───────────── Per frame ───────────── */

  private markersShown = true;

  /** Light slots and marker visibility. `building` = the builder camera is up (markers shown). */
  update(camera: THREE.Camera, timeSec: number, reducedMotion: boolean, building: boolean) {
    if (building !== this.markersShown) {
      this.markersShown = building;
      this.scene.traverse((o) => { if (o.userData?.isLight && o.parent === this.scene) o.visible = building; });
    }
    this.lights.update(camera, timeSec, reducedMotion);
  }

  /** The reach ring shows on selected lights only. */
  setSelected(ids: ReadonlySet<string>, objects: ReadonlyMap<string, THREE.Object3D>) {
    for (const [id, obj] of objects) if (obj.userData?.isLight) setMarkerSelected(obj, ids.has(id));
  }

  /** True when the object is visible all the way up (for raycast filters). */
  static shown(obj: THREE.Object3D) { return isShown(obj); }

  dispose() {
    this.lights.dispose();
    this.shaders.dispose();
  }
}
