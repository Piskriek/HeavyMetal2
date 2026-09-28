/* =============================================================================
   HEAVY METAL GP 2 — FULL 3D TRACK BUILDER
   Complete 3D world editor: free-fly camera, raycast surface snapping onto
   track & terrain, categorized prop palette, 3D manipulation, undo/redo,
   and JSON persistence.
   ============================================================================= */
import * as THREE from 'three';
import { wedgeMesh, createSlingshotMesh, type TrackData, type TrackSample } from './renderer-3d';
import { classifyPlacedRamp, getTrackSpace } from './track-space';
import { LaneGizmos } from './lane-gizmos';
import { FINISH, START_X } from './scene';
import { applyLaneEdit, snapNode, type LaneEdit } from './lane-path-tool';
import { LANE_HALF_WIDTH_MAX, LANE_HALF_WIDTH_MIN, validateLaneNetwork, type LaneNetwork, type LaneValidation } from './lane-network';
import {
  buildLaneDocument, exportLaneNetworks, importLaneNetworks, loadLaneNetwork, writeLaneStorage,
} from './lane-storage';
import {
  readStorage,
  writeStorage,
  restoreFromBackup,
  exportProps as exportTrackStorage,
  importProps as importTrackStorage,
} from './track-storage';
import { migrateV1toV2 } from './track-storage-migrate';
import { createHmtPackage } from './export/track-package';
import { bakeVertexLighting, DEFAULT_BAKE_OPTS } from './bake/vertex-baker';
import { MaterialCache } from './materials/material-cache';
import { PatchIndex } from './collision/patch-index';
import { Keymap } from './builder/keymap';
import { GizmoAdapter } from './builder/gizmo-adapter';
import { CommandStack } from './builder/history';
import { alignProps, distributeProps, marqueeSelect2D } from './builder/selection';
import type { GizmoMode, GizmoSpace, SnapConfig } from './builder/gizmo-math';
import { SceneKit, isKitType, isTerrainEdit } from './builder/scene-kit';
import { isLightType, lightPreset, lightSettingsFor } from './builder/light-rig';
import { isPrimitiveType } from './builder/primitives';
import {
  loadShaderLibrary, mergeShadersFromProps, normalizeShader, saveShaderLibrary, type ShaderDef,
} from './materials/shader-library';

// M8: the prop catalog and the disk backup live in their own modules; everything they export is
// re-exported here, so importers of track-builder-3d are unchanged.
export * from './builder/prop-catalog';
export { propsFingerprint, stripPropsRuntimeState } from './builder/backup-service';
import { type PropDefinition, type DecalSide, type AnimGrid, animGridFor, ANIM_SPEED_MIN, ANIM_SPEED_MAX, animSpeedFor, animEnabledFrames, animFrameAt, animSheetFor, animatedTwinDef, propHasAnimatedOption, type AnimationSettings, normalizeAnimFrames, normalizeAnimFrameDelays, animFrameUV, animPhaseFor, type PlacedProp, PROP_DEFINITIONS, DEFAULT_TRACK_PROPS, } from './builder/prop-catalog';
import { PropBackupService, stripPropsRuntimeState } from './builder/backup-service';

/** Wall-clock seconds for animation timing (works in browser and headless tests). */
function nowSeconds(): number {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
}

/**
 * M01 · T7 — one undo entry carries **both** documents.
 *
 * The builder edits two things now: the placed props and the lane network. They are separate documents
 * (separate storage keys, separate validation), but the user's Ctrl+Z is one key, so an entry records
 * both snapshots and a restore puts both back. `null` means "this document was absent at that moment".
 */
export interface LaneUndoEntry {
  readonly props: string;
  readonly lanes: string | null;
}

export class TrackBuilder3D {
  readonly keymap = new Keymap();
  private placedProps: PlacedProp[] = [];
  /** T03: last visible rejection of an unsupported gameplay-prop placement. */
  private placementErrorState: string | null = null;
  private propObjects = new Map<string, THREE.Object3D>();
  /**
   * M01 · T1b — whether the retired grid slingshot is drawn. The builder always draws it (it is a
   * placeable prop), and a legacy `startMode: 'sling'` run draws it because that path really does
   * launch from it; a push-mode race does not, because nothing does.
   */
  private slingshotsVisible = true;
  private selectedPropIds: Set<string> = new Set();
  private activePropType: string | null = null;
  private ghostSprite: THREE.Sprite | null = null;
  private ghostMesh: THREE.Object3D | null = null;
  private selectionBoxes = new Map<string, THREE.BoxHelper>();
  private rotationHandle: THREE.Group | null = null;
  private gizmoAdapter: GizmoAdapter<PlacedProp> | null = null;
  private readonly commandHistory = new CommandStack<PlacedProp>();
  private isGizmoDragging = false;
  readonly materialCache = new MaterialCache();
  readonly patchIndex = new PatchIndex();

  private undoStack: LaneUndoEntry[] = [];
  private redoStack: LaneUndoEntry[] = [];

  /**
   * M01 · T7 — the lane document this builder is editing, and its gizmos.
   *
   * The two documents (props, lanes) share one undo stack: an entry carries both, so one Ctrl+Z
   * rewinds whichever the user last touched without the other one jumping. The gizmos are their own
   * module (`lane-gizmos.ts`) so that the handle accounting is testable without a canvas.
   */
  private laneDoc: LaneNetwork | null = null;
  private laneGizmos: LaneGizmos;
  private selectedLaneNodeId: string | null = null;
  /** M01 · T7 — drawn only while the lanes tool is the active tool. */
  private lanesVisible = false;

  readonly freeFly = {
    active: false,
    x: 0,
    y: 18200,
    z: -1200,
    yaw: 0,
    pitch: -0.1,
    speed: 1200,
  };

  snapping = {
    alignToTrack: true,
    snapToCenterline: false,
    gridSnap: 0,
    cameraFacingDefault: true,
    decalDefault: false,
    decalLightingDefault: true,
  };

  private readonly textureLoader = new THREE.TextureLoader();
  private readonly textureCache = new Map<string, THREE.Texture>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouseNdc = new THREE.Vector2();

  private decalSideHandlesGroup: THREE.Group | null = null;
  private readonly decalSideBoxes = new Map<DecalSide, THREE.Mesh>();

  /** M8: the disk backup (C2's server safety copies, M12's skip-if-unchanged, the timers, the status). */
  private readonly backups = new PropBackupService({ props: () => this.persistableProps(), course: () => this.courseId });

  /**
   * Lights, primitives and scenery edits (builder/scene-kit.ts). Built first in the constructor, so
   * its scenery index snapshots only the course's generated scenery.
   */
  readonly kit: SceneKit;
  /** The shader library (editable here, saved on this device; props carry inline copies). */
  private shaderLibrary: ShaderDef[] = [];
  /** The shader new primitives are placed with (the one picked in the Shader Manager), if any. */
  private activeShaderId: string | null = null;
  /** Primitives mode: clicks on the course's own scenery select it. */
  private terrainPicking = false;
  private courseId = 'ridge';

  private listeners: (() => void)[] = [];
  private currentSkyId = 'ridge';
  private onSkyboxChangeCb?: (skyId: string) => void;

  onSkyboxChange(cb: (skyId: string) => void) {
    this.onSkyboxChangeCb = cb;
  }

  setInitialSky(skyId: string) {
    this.currentSkyId = skyId;
  }

  getSkybox(): string {
    return this.currentSkyId;
  }

  setSkybox(skyId: string) {
    this.currentSkyId = skyId;
    try {
      localStorage.setItem('hm2-3d-track-sky', skyId);
    } catch {
      // Storage unavailable
    }
    this.onSkyboxChangeCb?.(skyId);
    this.notify();
  }

  setCourse(courseId: string) {
    queueMicrotask(() => {
      // A course switch swaps the whole lane document: the same key, a different network.
      this.loadLaneDoc();
      this.notify();
    });
    this.courseId = courseId;
  }

  getCourse(): string {
    return this.courseId;
  }

  onBackupStatus(cb: (info: { status: 'idle' | 'saving' | 'saved' | 'error'; timestamp: number; count: number }) => void) {
    return this.backups.onStatus(cb);
  }

  startPeriodicBackupTimer(intervalMs = 30000) {
    this.backups.startPeriodic(intervalMs);
  }

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly track: TrackData,
    private readonly materials?: any,
  ) {
    this.kit = new SceneKit(this.scene, this.materialCache, this.materials);
    this.shaderLibrary = loadShaderLibrary();
    this.initDecalSideHandles();
    this.laneGizmos = new LaneGizmos(this.scene);
    this.laneGizmos.root.visible = false;
    this.loadLaneDoc();
    if (typeof localStorage !== 'undefined') {
      try {
        const savedFacing = localStorage.getItem('hm2-builder-camera-facing-default');
        if (savedFacing !== null) {
          this.snapping.cameraFacingDefault = savedFacing === 'true';
        }
        const savedDecal = localStorage.getItem('hm2-builder-decal-default');
        if (savedDecal !== null) {
          this.snapping.decalDefault = savedDecal === 'true';
        }
        const savedLighting = localStorage.getItem('hm2-builder-decal-lighting-default');
        if (savedLighting !== null) {
          this.snapping.decalLightingDefault = savedLighting === 'true';
        }
      } catch {}
    }
    this.loadFromStorage();
    const merged = mergeShadersFromProps(this.shaderLibrary, this.placedProps as { shader?: unknown }[]);
    if (merged.added) { this.shaderLibrary = merged.library; saveShaderLibrary(this.shaderLibrary); }
    if (typeof window !== 'undefined') {
      this.startPeriodicBackupTimer(30000);
    }
  }

  setCameraFacingDefault(facing: boolean) {
    this.snapping.cameraFacingDefault = facing;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('hm2-builder-camera-facing-default', String(facing));
      } catch {}
    }
    this.updateGhostSprite();
    this.notify();
  }

  setDecalDefault(isDecal: boolean) {
    this.snapping.decalDefault = isDecal;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('hm2-builder-decal-default', String(isDecal));
      } catch {}
    }
    this.updateGhostSprite();
    this.notify();
  }

  setDecalLightingDefault(enabled: boolean) {
    this.snapping.decalLightingDefault = enabled;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('hm2-builder-decal-lighting-default', String(enabled));
      } catch {}
    }
    this.notify();
  }

  onChange(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  get selectedPropId(): string | null {
    if (this.selectedPropIds.size === 0) return null;
    return Array.from(this.selectedPropIds)[0];
  }

  getProps(): readonly PlacedProp[] {
    return this.placedProps;
  }

  /** T03: surface the last physical-placement rejection to the UI (read by TrackBuilderUI). */
  getPlacementError(): string | null {
    return this.placementErrorState;
  }
  clearPlacementError(): void {
    if (this.placementErrorState !== null) {
      this.placementErrorState = null;
      this.notify();
    }
  }
  /**
   * T03 required decision: builder ramps are gameplay props. A ramp only gets
   * elevation when the shared track-space adapter can compile it into a
   * physical surface; otherwise the placement/resize/move is rejected here
   * (visible message) instead of leaving a render-only elevation physics
   * cannot reproduce.
   */
  private validateRampSupport(type: string, vals: { id?: string; x: number; y: number; z: number; scale: number; trackDist?: number }): string | null {
    const def = PROP_DEFINITIONS.find((d) => d.type === type);
    if (!def?.isRamp) return null;
    const verdict = classifyPlacedRamp(getTrackSpace(), {
      id: vals.id, x: vals.x, y: vals.y, z: vals.z, scale: vals.scale, trackDist: vals.trackDist,
    });
    if (verdict.supported) return null;
    return `Ramp not physical here — ${verdict.detail ?? verdict.reason ?? 'unsupported transform'}`;
  }

  getSelectedProp(): PlacedProp | null {
    if (this.selectedPropIds.size === 0) return null;
    const firstId = Array.from(this.selectedPropIds)[0];
    return this.placedProps.find((p) => p.id === firstId) ?? null;
  }

  getSelectedProps(): PlacedProp[] {
    return this.placedProps.filter((p) => this.selectedPropIds.has(p.id));
  }

  getSelectedPropIds(): string[] {
    return Array.from(this.selectedPropIds);
  }

  isPropSelected(id: string): boolean {
    return this.selectedPropIds.has(id);
  }

  getActivePropType(): string | null {
    return this.activePropType;
  }

  setActivePropType(type: string | null) {
    this.activePropType = type;
    this.updateGhostSprite();
    this.notify();
  }

  selectProp(id: string | null, multi = false) {
    if (!id) {
      this.selectedPropIds.clear();
    } else {
      const prop = this.placedProps.find((p) => p.id === id);
      if (!prop) {
        this.selectedPropIds.clear();
      } else if (multi) {
        if (this.selectedPropIds.has(id)) {
          if (prop.groupId) {
            this.placedProps.filter((p) => p.groupId === prop.groupId).forEach((p) => this.selectedPropIds.delete(p.id));
          } else {
            this.selectedPropIds.delete(id);
          }
        } else {
          if (prop.groupId) {
            this.placedProps.filter((p) => p.groupId === prop.groupId).forEach((p) => this.selectedPropIds.add(p.id));
          } else {
            this.selectedPropIds.add(id);
          }
        }
      } else {
        this.selectedPropIds.clear();
        if (prop.groupId) {
          this.placedProps.filter((p) => p.groupId === prop.groupId).forEach((p) => this.selectedPropIds.add(p.id));
        } else {
          this.selectedPropIds.add(id);
        }
      }
    }
    this.updateSelectionBox();
    this.notify();
  }

  selectMultipleProps(ids: string[]) {
    this.selectedPropIds = new Set(ids);
    this.updateSelectionBox();
    this.notify();
  }

  groupSelected(): string | null {
    const selected = this.getSelectedProps();
    if (selected.length < 2) return null;
    this.pushUndo();
    const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    for (const prop of selected) {
      prop.groupId = groupId;
    }
    this.saveToStorage();
    this.notify();
    return groupId;
  }

  ungroupSelected(): boolean {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return false;
    this.pushUndo();
    for (const prop of selected) {
      delete prop.groupId;
    }
    this.saveToStorage();
    this.notify();
    return true;
  }

  isSelectionGrouped(): boolean {
    const selected = this.getSelectedProps();
    if (selected.length < 2) return false;
    const firstGroup = selected[0].groupId;
    return Boolean(firstGroup && selected.every((p) => p.groupId === firstGroup));
  }

  getGroupCentroid(): { x: number; y: number; z: number } {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return { x: 0, y: 0, z: 0 };
    let sx = 0, sy = 0, sz = 0;
    for (const p of selected) {
      sx += p.x;
      sy += p.y;
      sz += p.z;
    }
    const n = selected.length;
    return {
      x: Math.round(sx / n),
      y: Math.round(sy / n),
      z: Math.round(sz / n),
    };
  }

  initGizmo(canvas: HTMLElement) {
    if (this.gizmoAdapter || typeof window === 'undefined') return;
    this.gizmoAdapter = new GizmoAdapter<PlacedProp>(
      this.camera,
      canvas,
      this.scene,
      this.commandHistory,
    );
    this.gizmoAdapter.onChange((items) => {
      for (const item of items) {
        this.updatePropTransform(item.id, {}, false);
      }
      this.saveToStorage();
      this.notify();
    });
    this.gizmoAdapter.onDrag((dragging) => {
      if (dragging && !this.isGizmoDragging && !this.gizmoAdapter?.isLaneNodeAttached()) this.pushUndo();
      this.isGizmoDragging = dragging;
    });
    if (this.selectedLaneNodeId && this.lanesVisible) {
      this.attachGizmoToLaneNode(this.selectedLaneNodeId);
    } else if (this.selectedPropIds.size > 0 && this.freeFly.active) {
      this.gizmoAdapter.attach(this.getSelectedProps());
    }
  }

  getGizmoAdapter(): GizmoAdapter<PlacedProp> | null {
    return this.gizmoAdapter;
  }

  isDraggingGizmo(): boolean {
    return this.isGizmoDragging;
  }

  isGizmoHovered(): boolean {
    return this.gizmoAdapter?.isHovered() ?? false;
  }

  isGizmoInteracting(): boolean {
    return this.isGizmoDragging || (this.gizmoAdapter?.isInteracting() ?? false);
  }

  setGizmoMode(mode: GizmoMode) {
    this.gizmoAdapter?.setMode(mode);
    this.notify();
  }

  getGizmoMode(): GizmoMode {
    return this.gizmoAdapter?.getMode() ?? 'translate';
  }

  setGizmoSpace(space: GizmoSpace) {
    this.gizmoAdapter?.setSpace(space);
    this.notify();
  }

  cycleGizmoSpace(): GizmoSpace {
    const next = this.gizmoAdapter?.cycleSpace() ?? 'world';
    this.notify();
    return next;
  }

  getGizmoSpace(): GizmoSpace {
    return this.gizmoAdapter?.getSpace() ?? 'world';
  }

  setGizmoSnap(config: Partial<SnapConfig>) {
    this.gizmoAdapter?.setSnap(config);
    this.notify();
  }

  getGizmoSnap(): SnapConfig {
    return this.gizmoAdapter?.getSnap() ?? { grid: 0, angleDeg: 0, scaleStep: 0, surface: false, centerline: false };
  }

  cancelGizmoDrag() {
    this.gizmoAdapter?.cancelDrag();
  }

  alignSelected(axis: 'x' | 'z', mode: 'min' | 'center' | 'max') {
    const selected = this.getSelectedProps();
    if (selected.length < 2) return;
    this.pushUndo();
    const ids = new Set(selected.map((p) => p.id));
    this.placedProps = alignProps(this.placedProps, ids, axis, mode);
    for (const id of ids) {
      this.updatePropTransform(id, {}, false);
    }
    this.saveToStorage();
    this.updateSelectionBox();
    this.notify();
  }

  distributeSelected(axis: 'x' | 'z') {
    const selected = this.getSelectedProps();
    if (selected.length < 3) return;
    this.pushUndo();
    const ids = new Set(selected.map((p) => p.id));
    this.placedProps = distributeProps(this.placedProps, ids, axis);
    for (const id of ids) {
      this.updatePropTransform(id, {}, false);
    }
    this.saveToStorage();
    this.updateSelectionBox();
    this.notify();
  }

  marqueeSelect(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    additive = false,
  ) {
    const ids = marqueeSelect2D(this.placedProps, { x: x0, y: z0 }, { x: x1, y: z1 });
    if (additive) {
      for (const id of ids) this.selectedPropIds.add(id);
    } else {
      this.selectedPropIds = new Set(ids);
    }
    this.updateSelectionBox();
    this.notify();
  }

  setCameraPreset(preset: 'top' | 'front' | 'side' | 'iso' | 'fly') {
    if (preset === 'top') {
      this.freeFly.pitch = -Math.PI / 2 + 0.001;
      this.freeFly.yaw = 0;
      this.freeFly.y = Math.max(this.freeFly.y, 19500);
    } else if (preset === 'front') {
      this.freeFly.pitch = 0;
      this.freeFly.yaw = 0;
    } else if (preset === 'side') {
      this.freeFly.pitch = 0;
      this.freeFly.yaw = Math.PI / 2;
    } else if (preset === 'iso') {
      this.freeFly.pitch = -Math.PI / 6;
      this.freeFly.yaw = Math.PI / 4;
    }
    const lookDir = new THREE.Vector3(
      Math.sin(this.freeFly.yaw) * Math.cos(this.freeFly.pitch),
      Math.sin(this.freeFly.pitch),
      Math.cos(this.freeFly.yaw) * Math.cos(this.freeFly.pitch),
    );
    this.camera.position.set(this.freeFly.x, this.freeFly.y, this.freeFly.z);
    this.camera.lookAt(this.camera.position.clone().add(lookDir));
    this.notify();
  }

  bakeVertexAO(): { count: number; totalVertices: number } {
    let count = 0;
    let totalVertices = 0;
    for (const [, obj] of this.propObjects.entries()) {
      if (obj.userData?.isPrimitive || obj.userData?.isLight || obj.userData?.terrainEdit || obj.userData?.orphanTerrainEdit) continue;
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const geom = mesh.geometry;
          if (geom && geom.attributes.position) {
            const posAttr = geom.attributes.position;
            const posArray = new Float32Array(posAttr.array);
            const indexArray = geom.index ? new Uint32Array(geom.index.array) : new Uint32Array(Array.from({ length: posAttr.count }, (_, i) => i));
            const bakeRes = bakeVertexLighting({ name: 'prop_mesh', positions: posArray, indices: indexArray }, { ...DEFAULT_BAKE_OPTS, rays: 16 });
            geom.setAttribute('color', new THREE.BufferAttribute(bakeRes.colors, 3));
            if (mesh.material) {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              for (const m of mats) {
                m.vertexColors = true;
                m.needsUpdate = true;
              }
            }
            count++;
            totalVertices += posAttr.count;
          }
        }
      });
    }
    this.notify();
    return { count, totalVertices };
  }

  exportHmtPackage(): string {
    const cleanProps = this.stripRuntimeState(this.placedProps);
    const v2Doc = migrateV1toV2({ courseId: this.courseId, props: cleanProps });
    const pkg = createHmtPackage(v2Doc, []);
    return JSON.stringify(pkg, null, 2);
  }

  registerCustomModel(assetId: string, name: string) {
    let def = PROP_DEFINITIONS.find((d) => d.type === assetId);
    if (!def) {
      def = {
        type: assetId,
        name,
        category: 'cavern_mine',
        url: '/art/ui/icons/custom-model.png',
        defaultWidth: 500,
        defaultHeight: 500,
        defaultDepth: 500,
        is3DModel: true,
      };
      PROP_DEFINITIONS.push(def);
    }
    this.setActivePropType(assetId);
    this.notify();
  }

  moveSelectedProps(dx: number, dy: number, dz: number) {
    const selected = this.getSelectedProps();
    if (selected.length === 0 || (dx === 0 && dy === 0 && dz === 0)) return;
    for (const prop of selected) {
      this.updatePropTransform(prop.id, {
        x: prop.x + dx,
        y: prop.y + dy,
        z: prop.z + dz,
      }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  rotateSelectedProps(deltaAngle: number) {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    const centroid = this.getGroupCentroid();
    const qOrbit = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaAngle);

    for (const prop of selected) {
      const offset = new THREE.Vector3(prop.x - centroid.x, 0, prop.z - centroid.z);
      offset.applyQuaternion(qOrbit);

      this.updatePropTransform(prop.id, {
        x: Math.round(centroid.x + offset.x),
        z: Math.round(centroid.z + offset.z),
        rotY: prop.rotY + deltaAngle,
      }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  scaleSelectedProps(multiplier: number) {
    const selected = this.getSelectedProps();
    if (selected.length === 0 || multiplier <= 0) return;
    const centroid = this.getGroupCentroid();
    for (const prop of selected) {
      const newScale = Math.max(0.1, Math.min(6.0, prop.scale * multiplier));
      const ox = prop.x - centroid.x;
      const oz = prop.z - centroid.z;
      const nx = ox * multiplier;
      const nz = oz * multiplier;
      this.updatePropTransform(prop.id, {
        x: Math.round(centroid.x + nx),
        z: Math.round(centroid.z + nz),
        scale: Math.round(newScale * 100) / 100,
      }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  tiltSelectedProps(deltaRadians: number) {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    for (const prop of selected) {
      this.updatePropTransform(prop.id, { rotZ: (prop.rotZ ?? 0) + deltaRadians }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  flipSelectedProps() {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    const centroid = this.getGroupCentroid();
    for (const prop of selected) {
      const ox = prop.x - centroid.x;
      this.updatePropTransform(prop.id, {
        x: Math.round(centroid.x - ox),
        flipX: !prop.flipX,
      }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  setSelectedPropsLighting(lit: boolean) {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    this.pushUndo();
    for (const prop of selected) {
      this.updatePropTransform(prop.id, { lit }, false);
    }
    this.saveToStorage();
    this.notify();
  }

  /**
   * Per-prop animation settings.
   *
   * - `animated` swaps a still decoration for the animated sheet cut from the
   *   same art (rebuilds the sprite; ignored by props without a twin).
   * - `animate` is the existing play/pause flag (paused props hold one frame).
   * - `animSpeed` is a multiplier on the sheet's fps.
   * - `animFrames` are per-frame checkboxes: unchecked frames are skipped.
   * - `animFrameDelays` are per-frame hold durations in seconds.
   */
  setPropAnimation(
    id: string,
    updates: AnimationSettings,
    pushUndo = true,
    saveAndNotify = true,
  ): void {
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop) return;
    const patch: Partial<PlacedProp> = {};
    if (updates.animated !== undefined) {
      const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
      if (def && animatedTwinDef(def)) patch.animated = updates.animated === true;
    }
    if (updates.animate !== undefined) patch.animate = updates.animate === true;
    if (updates.animSpeed !== undefined && Number.isFinite(updates.animSpeed)) {
      patch.animSpeed = Math.min(ANIM_SPEED_MAX, Math.max(ANIM_SPEED_MIN, updates.animSpeed));
    }
    if (updates.animFrames !== undefined) {
      const total = animGridFor(
        PROP_DEFINITIONS.find((d) => d.type === prop.type) ?? ({} as PropDefinition),
      );
      patch.animFrames = normalizeAnimFrames(updates.animFrames, total.cols * total.rows);
    }
    if (updates.animFrameDelays !== undefined) {
      const total = animGridFor(
        PROP_DEFINITIONS.find((d) => d.type === prop.type) ?? ({} as PropDefinition),
      );
      patch.animFrameDelays = normalizeAnimFrameDelays(updates.animFrameDelays, total.cols * total.rows);
    }
    if (Object.keys(patch).length === 0) return;
    if (pushUndo) this.pushUndo();

    const before = animSheetFor(prop)?.url;
    Object.assign(prop, patch);
    const after = animSheetFor(prop)?.url;

    if (before !== after) {
      this.disposeAnimTexture(id);
      this.removePropObject(prop);
      this.createPropSprite(prop);
    }
    // Repaint the current frame straight away so speed/skip/delay edits are visible
    // even while the prop is paused.
    if (saveAndNotify) {
      this.updateAnimations(nowSeconds());
      this.updateSelectionBox();
      this.saveToStorage();
      this.notify();
    }
  }

  /** Apply the same animation settings to every animated-capable prop selected. */
  setSelectedPropsAnimation(updates: AnimationSettings): void {
    const selected = this.getSelectedProps().filter((p) => propHasAnimatedOption(p));
    if (selected.length === 0) return;
    this.pushUndo();
    for (const prop of selected) this.setPropAnimation(prop.id, updates, false, false);
    this.updateAnimations(nowSeconds());
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  /** Batch the animated-sheet swap across the current selection. */
  setSelectedPropsAnimated(animated: boolean): void {
    this.setSelectedPropsAnimation({ animated });
  }

  /**
   * Switch all placed props that have animated twins to their animated sheets
   * (or back to still artwork).
   *
   * @param animated true = switch to animated sheet twins; false = switch back to still art.
   * @param filterSection optional section filter ('all' | 'alpine' | 'canyon' | 'cavern' | 'stadium')
   * @returns count of props modified
   */
  setAllPropsAnimated(
    animated: boolean,
    filterSection: 'all' | 'alpine' | 'canyon' | 'cavern' | 'stadium' = 'all',
  ): number {
    this.pushUndo();
    let count = 0;
    for (const prop of this.placedProps) {
      const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
      if (!def || !animatedTwinDef(def)) continue;
      if (filterSection !== 'all') {
        const sec = this.getPropTrackSection(prop);
        if (sec !== filterSection) continue;
      }
      const isCurrentlyAnimated = prop.animated === true;
      if (isCurrentlyAnimated !== animated) {
        this.setPropAnimation(prop.id, { animated }, false, false);
        count++;
      }
    }
    if (count > 0) {
      this.updateAnimations(nowSeconds());
      this.updateSelectionBox();
      this.saveToStorage();
      this.notify();
    }
    return count;
  }

  /** Nudge every animated-capable selected prop's speed by `delta` (clamped). */
  nudgeSelectedAnimSpeed(delta: number): void {
    const selected = this.getSelectedProps().filter((p) => propHasAnimatedOption(p));
    if (selected.length === 0 || !Number.isFinite(delta) || delta === 0) return;
    this.pushUndo();
    for (const prop of selected) {
      const next = Math.round((animSpeedFor(prop) + delta) * 100) / 100;
      this.setPropAnimation(prop.id, { animSpeed: next }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  /** Batch the animate flag across the current selection (static props ignore it). */
  setSelectedPropsAnimate(animate: boolean) {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    this.pushUndo();
    for (const prop of selected) {
      this.updatePropTransform(prop.id, { animate }, false);
    }
    this.saveToStorage();
    this.notify();
  }

  /** True for the slingshot launcher prop (the one model the retired start used to own). */
  private isSlingshotProp(prop: PlacedProp): boolean {
    const def = PROP_DEFINITIONS.find((definition) => definition.type === prop.type);
    return Boolean(def?.isSlingshot);
  }

  /**
   * M01 · T1b — draws (or stops drawing) the slingshot models without touching the document.
   *
   * The prop keeps its place in `placedProps`, its id and its authored transform: hiding it is a
   * rendering decision, so the builder's storage, undo stack and validation are untouched, and a
   * later push-mode race sees the same document with the model simply not built into the view. The
   * per-prop `visible` flag (T08) still wins — an author who hid it on purpose gets it hidden either
   * way.
   */
  setSlingshotsVisible(visible: boolean): void {
    this.slingshotsVisible = visible;
    for (const prop of this.placedProps) {
      if (!this.isSlingshotProp(prop)) continue;
      const object = this.propObjects.get(prop.id);
      if (object) object.visible = visible && prop.visible !== false;
    }
    // The placement ghost is not a placed prop, so it is not in the map; hide it by name too, or a
    // race that happens to be in the builder's placement mode would show a wireframe of the very
    // model that was just retired.
    if (!visible && this.ghostMesh) this.ghostMesh.visible = false;
  }

  // --- T08: VISIBILITY TOGGLE (H KEY) ---
  /** T08: Toggle visibility on selected props. Hidden props retain selection identity but are excluded from fresh raycasts. */
  toggleVisibility(): void {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    this.pushUndo();
    for (const prop of selected) {
      prop.visible = prop.visible === false ? true : false;
      const obj = this.propObjects.get(prop.id);
      if (obj) {
        obj.visible = prop.visible !== false;
      }
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  /** T08: Set visibility explicitly (show/hide) on selected props. */
  setVisibility(visible: boolean): void {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    this.pushUndo();
    for (const prop of selected) {
      prop.visible = visible;
      const obj = this.propObjects.get(prop.id);
      if (obj) {
        obj.visible = visible;
      }
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  /** T08: Check if a prop is visible (defaults to true). */
  isPropVisible(prop: PlacedProp): boolean {
    return prop.visible !== false;
  }

  /**
   * T08: Compute effective world-space dimensions for a prop.
   * Convention: if width/height/depth are explicitly set, they ARE the final dimensions
   * (scale is NOT applied again). Otherwise, dimensions = default * scale.
   * This prevents double-application of scale.
   */
  getEffectiveDimensions(prop: PlacedProp): { width: number; height: number; depth: number } {
    const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
    const baseW = def?.defaultWidth ?? 500;
    const baseH = def?.defaultHeight ?? 500;
    const baseD = def?.defaultDepth ?? baseW;

    return {
      width: prop.width !== undefined ? prop.width : baseW * prop.scale,
      height: prop.height !== undefined ? prop.height : baseH * prop.scale,
      depth: prop.depth !== undefined ? prop.depth : baseD * prop.scale,
    };
  }

  /**
   * T08: Set explicit width/height/depth on selected props.
   * The dimensions are in world units and replace the scale-derived size.
   */
  setSelectedDimensions(updates: { width?: number; height?: number; depth?: number }): void {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    this.pushUndo();
    for (const prop of selected) {
      if (updates.width !== undefined && updates.width > 0 && isFinite(updates.width)) {
        prop.width = updates.width;
      }
      if (updates.height !== undefined && updates.height > 0 && isFinite(updates.height)) {
        prop.height = updates.height;
      }
      if (updates.depth !== undefined && updates.depth > 0 && isFinite(updates.depth)) {
        prop.depth = updates.depth;
      }
    }
    // Recreate sprites to apply new dimensions
    this.rebuildPropObjects();
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  /**
   * T08: Clear explicit dimensions on selected props, reverting to scale * default.
   */
  clearSelectedDimensions(): void {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    this.pushUndo();
    for (const prop of selected) {
      delete prop.width;
      delete prop.height;
      delete prop.depth;
    }
    this.rebuildPropObjects();
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  getPropTrackSection(prop: PlacedProp): 'alpine' | 'canyon' | 'cavern' | 'stadium' {
    if (this.track?.samples && this.track.samples.length > 0) {
      let minDist = Infinity;
      let stage = 'alpine';
      const step = Math.max(1, Math.floor(this.track.samples.length / 500));
      for (let i = 0; i < this.track.samples.length; i += step) {
        const s = this.track.samples[i];
        const dx = s.pos.x - prop.x;
        const dy = s.pos.y - prop.y;
        const dz = s.pos.z - prop.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < minDist) {
          minDist = d2;
          stage = s.stage;
        }
      }
      if (stage === 'alpine') return 'alpine';
      if (stage === 'canyon' || stage === 'zigzag') return 'canyon';
      if (stage === 'cavern' || stage === 'mine') return 'cavern';
      if (stage === 'breakthrough' || stage === 'stadium') return 'stadium';
      return 'alpine';
    }
    if (prop.x < 25600) return 'alpine';
    if (prop.x < 48000) return 'canyon';
    if (prop.x < 68400) return 'cavern';
    return 'stadium';
  }

  setAllDecalsLighting(lit: boolean, filterSection: 'all' | 'alpine' | 'canyon' | 'cavern' | 'stadium' = 'all'): number {
    this.pushUndo();
    let count = 0;
    for (const prop of this.placedProps) {
      if (!this.isPropDecal(prop)) continue;
      if (filterSection !== 'all') {
        const sec = this.getPropTrackSection(prop);
        if (sec !== filterSection) continue;
      }
      this.updatePropTransform(prop.id, { lit }, false);
      count++;
    }
    this.saveToStorage();
    this.notify();
    return count;
  }

  // --- FREE FLY CAMERA UPDATE ---
  updateFlyCamera(dt: number, keys: Set<string>) {
    if (!this.freeFly.active) return;

    const speed = this.freeFly.speed * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.0 : 1.0);
    const move = new THREE.Vector3();

    // Horizontal direction vectors from yaw
    const forward = new THREE.Vector3(Math.sin(this.freeFly.yaw), 0, Math.cos(this.freeFly.yaw));
    const right = new THREE.Vector3(-Math.cos(this.freeFly.yaw), 0, Math.sin(this.freeFly.yaw));

    if (keys.has('KeyW')) move.add(forward);
    if (keys.has('KeyS')) move.sub(forward);
    if (keys.has('KeyD')) move.add(right);
    if (keys.has('KeyA')) move.sub(right);
    if (keys.has('Space')) move.y += 1;
    if ((keys.has('KeyZ') || keys.has('KeyQ')) && !keys.has('ControlLeft') && !keys.has('ControlRight') && !keys.has('MetaLeft') && !keys.has('MetaRight')) {
      move.y -= 1;
    }

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      this.freeFly.x += move.x;
      this.freeFly.y += move.y;
      this.freeFly.z += move.z;
    }

    // Apply to Three.js camera
    this.camera.position.set(this.freeFly.x, this.freeFly.y, this.freeFly.z);
    const lookDir = new THREE.Vector3(
      Math.sin(this.freeFly.yaw) * Math.cos(this.freeFly.pitch),
      Math.sin(this.freeFly.pitch),
      Math.cos(this.freeFly.yaw) * Math.cos(this.freeFly.pitch),
    );
    this.camera.lookAt(this.camera.position.clone().add(lookDir));
  }

  rotateCamera(deltaX: number, deltaY: number) {
    if (!this.freeFly.active) return;
    this.freeFly.yaw -= deltaX * 0.003;
    this.freeFly.pitch = Math.max(-1.45, Math.min(1.45, this.freeFly.pitch - deltaY * 0.003));

    const lookDir = new THREE.Vector3(
      Math.sin(this.freeFly.yaw) * Math.cos(this.freeFly.pitch),
      Math.sin(this.freeFly.pitch),
      Math.cos(this.freeFly.yaw) * Math.cos(this.freeFly.pitch),
    );
    this.camera.lookAt(this.camera.position.clone().add(lookDir));
  }

  jumpToStage(stageName: string) {
    const s = this.track.samples.find((sample) => sample.stage === stageName);
    if (s) {
      this.freeFly.x = s.pos.x - s.tangent.x * 600;
      this.freeFly.y = s.pos.y + 450;
      this.freeFly.z = s.pos.z - s.tangent.z * 600;
      this.freeFly.yaw = Math.atan2(s.tangent.x, s.tangent.z);
      this.freeFly.pitch = -0.15;
    }
  }

  // --- RAYCASTING & SURFACE SNAPPING ---
  // --- RAYCASTING & SURFACE SNAPPING ---
  raycastProp(clientX: number, clientY: number, canvas: HTMLCanvasElement): PlacedProp | null {
    if (this.placedProps.length === 0) return null;

    const rect = canvas.getBoundingClientRect();
    this.mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    // T08: Exclude invisible props from raycasts
    const objects = Array.from(this.propObjects.entries())
      .filter(([id]) => {
        const prop = this.placedProps.find(p => p.id === id);
        if (prop && isTerrainEdit(prop) && (!this.terrainPicking || prop.terrainHidden)) return false;
        return prop && prop.visible !== false;
      })
      .map(([, obj]) => obj);
    const hits = this.raycaster.intersectObjects(objects, true);

    if (hits.length > 0) {
      let hitObj: THREE.Object3D | null = hits[0].object;
      while (hitObj && !hitObj.userData?.propId) {
        hitObj = hitObj.parent;
      }
      if (hitObj?.userData?.propId) {
        const found = this.placedProps.find((p) => p.id === hitObj!.userData.propId);
        if (found) return found;
      }
    }

    // Screen-space proximity fallback (T08: skip invisible props):
    let bestProp: PlacedProp | null = null;
    let bestDistanceSq = Infinity;

    for (const prop of this.placedProps) {
      // T08: Exclude invisible props from fresh raycasts
      if (prop.visible === false || isTerrainEdit(prop)) continue;
      
      const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
      if (!def) continue;

      const w = def.defaultWidth * prop.scale;
      const h = def.defaultHeight * prop.scale;

      const centerY = def.alignBottom !== false ? prop.y + h / 2 : prop.y;
      const worldPos = new THREE.Vector3(prop.x, centerY, prop.z);

      // Check if in front of camera
      const cameraDir = this.camera.getWorldDirection(new THREE.Vector3());
      const toProp = worldPos.clone().sub(this.camera.position);
      if (cameraDir.dot(toProp) <= 0) continue;

      const ndc = worldPos.clone().project(this.camera);
      if (ndc.z > 1 || ndc.z < -1) continue;

      const screenX = ((ndc.x + 1) / 2) * rect.width + rect.left;
      const screenY = ((-ndc.y + 1) / 2) * rect.height + rect.top;

      const dist = toProp.length();
      const vFovRad = (this.camera.fov * Math.PI) / 180;
      const screenH = (h / (2 * Math.tan(vFovRad / 2) * Math.max(10, dist))) * rect.height;
      const screenW = (w / (2 * Math.tan(vFovRad / 2) * Math.max(10, dist))) * rect.height;

      const halfW = Math.max(30, screenW / 2);
      const halfH = Math.max(30, screenH / 2);

      if (
        clientX >= screenX - halfW - 20 &&
        clientX <= screenX + halfW + 20 &&
        clientY >= screenY - halfH - 20 &&
        clientY <= screenY + halfH + 20
      ) {
        const d2 = (clientX - screenX) ** 2 + (clientY - screenY) ** 2;
        if (d2 < bestDistanceSq) {
          bestDistanceSq = d2;
          bestProp = prop;
        }
      }
    }

    return bestProp;
  }

  raycastSurface(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    this.mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (const hit of intersects) {
      const obj = hit.object;
      // three.js raycasts hit hidden objects: a hidden scenery part or prop is not a surface.
      if (!SceneKit.shown(obj) || obj.name?.startsWith('Light') || obj.name === 'BuilderLightSlot') continue;
      // Skip sky, markers, gizmos, ghosts, sprites, placed props (except primitives), and handles
      if (
        obj.name === 'Sky' ||
        obj.name === 'Ghost' ||
        obj.name === 'GhostMesh' ||
        obj.name === 'GhostDecalMesh' ||
        obj.name === 'GhostSlingshotMesh' ||
        (obj as any).isSprite ||
        obj.name === 'DebugMarkers' ||
        (obj.name?.startsWith('PlacedProp_') && !obj.userData?.isPrimitive) ||
        obj.name?.startsWith('DecalSide') ||
        obj.name?.startsWith('DecalHandle') ||
        obj.name === 'RotationHandleGroup' ||
        obj.name === 'DecalSideHandlesGroup' ||
        obj.name === 'LaneHandles' ||
        obj.name === 'LaneGizmos' ||
        obj.name === 'GizmoPivotProxy' ||
        obj.name?.startsWith('TransformControls')
      ) continue;

      // Find closest track sample
      let closestSample: TrackSample | undefined;
      let minD = Infinity;
      for (let i = 0; i < this.track.samples.length; i += 4) {
        const s = this.track.samples[i];
        const dist = s.pos.distanceTo(hit.point);
        if (dist < minD) {
          minD = dist;
          closestSample = s;
        }
      }

      return {
        point: hit.point,
        normal: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : new THREE.Vector3(0, 1, 0),
        sample: minD < 1800 ? closestSample : undefined,
      };
    }

    return null;
  }

  // --- GHOST PREVIEW ---
  updateGhostPosition(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    if (!this.activePropType) return;

    const hit = this.raycastSurface(clientX, clientY, canvas);
    if (!hit) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      if (this.ghostMesh) this.ghostMesh.visible = false;
      return;
    }

    let pos = hit.point.clone();
    if (this.snapping.snapToCenterline && hit.sample) {
      pos.copy(hit.sample.pos);
    }

    if (this.ghostMesh && this.ghostMesh.visible) {
      this.ghostMesh.position.copy(pos);
      if ((this.ghostMesh as any)._isDecalMesh) {
        this.ghostMesh.position.y += 2;
        let rotY: number;
        if (this.snapping.alignToTrack && hit.sample) {
          rotY = Math.atan2(hit.sample.tangent.x, hit.sample.tangent.z);
        } else {
          let dx = this.camera.position.x - pos.x;
          let dz = this.camera.position.z - pos.z;
          if (Math.hypot(dx, dz) < 1e-2) {
            dx = -Math.sin(this.freeFly.yaw);
            dz = -Math.cos(this.freeFly.yaw);
          }
          rotY = Math.atan2(dx, dz);
        }
        if (hit.normal) {
          const F_horiz = new THREE.Vector3(Math.sin(-rotY), 0, Math.cos(-rotY)).normalize();
          const F_surface = F_horiz.clone().sub(hit.normal.clone().multiplyScalar(F_horiz.dot(hit.normal))).normalize();
          const R_surface = new THREE.Vector3().crossVectors(F_surface, hit.normal).normalize();
          const mBasis = new THREE.Matrix4().makeBasis(R_surface, F_surface, hit.normal);
          this.ghostMesh.quaternion.setFromRotationMatrix(mBasis);
        } else {
          this.ghostMesh.rotation.order = 'YXZ';
          this.ghostMesh.rotation.x = -Math.PI / 2;
          this.ghostMesh.rotation.y = -rotY;
          this.ghostMesh.rotation.z = 0;
        }
      } else if (this.snapping.alignToTrack && hit.sample) {
        this.ghostMesh.rotation.y = Math.atan2(hit.sample.tangent.x, hit.sample.tangent.z);
      } else {
        let dx = this.camera.position.x - pos.x;
        let dz = this.camera.position.z - pos.z;
        if (Math.hypot(dx, dz) < 1e-2) {
          dx = -Math.sin(this.freeFly.yaw);
          dz = -Math.cos(this.freeFly.yaw);
        }
        this.ghostMesh.rotation.y = Math.atan2(dx, dz);
      }
    } else if (this.ghostSprite && this.ghostSprite.visible) {
      this.ghostSprite.position.copy(pos);
    }
  }

  private updateGhostSprite() {
    if (!this.activePropType) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      if (this.ghostMesh) this.ghostMesh.visible = false;
      return;
    }

    const def = PROP_DEFINITIONS.find((p) => p.type === this.activePropType);
    if (!def) return;

    const isDecal = def.isDecal || this.snapping.decalDefault;

    if (isDecal) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      const tex = this.getTexture(def.url);
      if (!this.ghostMesh || (this.ghostMesh as any)._forType !== def.type || (this.ghostMesh as any)._isDecalMesh !== true) {
        if (this.ghostMesh) this.scene.remove(this.ghostMesh);
        const geom = new THREE.PlaneGeometry(def.defaultWidth, def.defaultHeight);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        this.ghostMesh = new THREE.Mesh(geom, mat);
        (this.ghostMesh as any)._forType = def.type;
        (this.ghostMesh as any)._isDecalMesh = true;
        this.ghostMesh.name = 'GhostDecalMesh';
        this.scene.add(this.ghostMesh);
      }
      this.ghostMesh.visible = true;
    } else if (def.isRamp) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      if (!this.ghostMesh || (this.ghostMesh as any)._isRampMesh !== true) {
        if (this.ghostMesh) this.scene.remove(this.ghostMesh);
        const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5, wireframe: true });
        this.ghostMesh = wedgeMesh(def.defaultWidth, 1100, def.defaultHeight, ghostMat);
        this.ghostMesh.name = 'GhostMesh';
        (this.ghostMesh as any)._isRampMesh = true;
        this.scene.add(this.ghostMesh);
      }
      this.ghostMesh.visible = true;
    } else if (def.isSlingshot || def.is3DModel) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      if (!this.ghostMesh || (this.ghostMesh as any)._forType !== def.type) {
        if (this.ghostMesh) this.scene.remove(this.ghostMesh);
        const ghostModel = createSlingshotMesh(1, this.materials);
        ghostModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshBasicMaterial({
              color: 0xffaa00,
              wireframe: true,
              transparent: true,
              opacity: 0.45,
            });
          }
        });
        ghostModel.name = 'GhostSlingshotMesh';
        (ghostModel as any)._forType = def.type;
        (ghostModel as any)._is3DModel = true;
        this.ghostMesh = ghostModel;
        this.scene.add(ghostModel);
      }
      if (this.ghostMesh) {
        this.ghostMesh.visible = true;
      }
    } else if (this.snapping.cameraFacingDefault === false) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      const tex = this.getTexture(def.url);
      if (!this.ghostMesh || (this.ghostMesh as any)._forType !== def.type || (this.ghostMesh as any)._isRampMesh === true) {
        if (this.ghostMesh) this.scene.remove(this.ghostMesh);
        const geom = new THREE.PlaneGeometry(def.defaultWidth, def.defaultHeight);
        if (def.alignBottom !== false) {
          geom.translate(0, def.defaultHeight / 2, 0);
        }
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        this.ghostMesh = new THREE.Mesh(geom, mat);
        (this.ghostMesh as any)._forType = def.type;
        this.ghostMesh.name = 'GhostMesh';
        this.scene.add(this.ghostMesh);
      }
      this.ghostMesh.visible = true;
    } else {
      if (this.ghostMesh) this.ghostMesh.visible = false;
      const tex = this.getTexture(def.url);
      if (!this.ghostSprite) {
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false });
        this.ghostSprite = new THREE.Sprite(mat);
        this.ghostSprite.name = 'Ghost';
        this.scene.add(this.ghostSprite);
      } else {
        this.ghostSprite.material.map = tex;
        this.ghostSprite.material.needsUpdate = true;
      }
      this.ghostSprite.center.set(0.5, def.alignBottom !== false ? 0 : 0.5);
      this.ghostSprite.scale.set(def.defaultWidth, def.defaultHeight, 1);
      this.ghostSprite.visible = true;
    }
  }

  // --- PROP CREATION, MANIPULATION & SELECTION ---
  placeActiveProp(clientX: number, clientY: number, canvas: HTMLCanvasElement): PlacedProp | null {
    if (!this.activePropType) return null;
    const def = PROP_DEFINITIONS.find((p) => p.type === this.activePropType);
    if (!def) return null;

    const hit = this.raycastSurface(clientX, clientY, canvas);
    if (!hit) return null;

    // T03: gameplay props in unsupported regions must not be placed.
    const rampRejection = this.validateRampSupport(def.type, {
      x: hit.point.x, y: hit.point.y, z: hit.point.z, scale: 1, trackDist: hit.sample?.dist,
    });
    if (rampRejection) {
      this.placementErrorState = rampRejection;
      this.notify();
      return null;
    }

    this.pushUndo();

    let pos = hit.point.clone();
    let rotY = 0;
    if (this.snapping.alignToTrack && hit.sample) {
      rotY = Math.atan2(hit.sample.tangent.x, hit.sample.tangent.z);
    } else {
      let dx = this.camera.position.x - pos.x;
      let dz = this.camera.position.z - pos.z;
      if (Math.hypot(dx, dz) < 1e-2) {
        dx = -Math.sin(this.freeFly.yaw);
        dz = -Math.cos(this.freeFly.yaw);
      }
      rotY = Math.atan2(dx, dz);
    }

    const isPhysical3D = Boolean(def.isRamp || def.isSlingshot || def.is3DModel);
    const isDecal = isPhysical3D ? false : Boolean(def.isDecal || this.snapping.decalDefault);

    let quaternion: [number, number, number, number] | undefined;
    let rotX = 0;
    let rotZ = 0;

    if (isDecal && hit.normal) {
      const F_horiz = new THREE.Vector3(Math.sin(-rotY), 0, Math.cos(-rotY)).normalize();
      const F_surface = F_horiz.clone().sub(hit.normal.clone().multiplyScalar(F_horiz.dot(hit.normal))).normalize();
      const R_surface = new THREE.Vector3().crossVectors(F_surface, hit.normal).normalize();
      const mBasis = new THREE.Matrix4().makeBasis(R_surface, F_surface, hit.normal);
      const q = new THREE.Quaternion().setFromRotationMatrix(mBasis);
      quaternion = [q.x, q.y, q.z, q.w];
      rotX = Math.asin(F_surface.y);
      rotZ = Math.asin(R_surface.y);
    }

    if (isKitType(def.type)) {
      const kitProp: PlacedProp = {
        id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: def.type,
        name: def.name,
        x: Math.round(pos.x),
        // Lights hang a little above what was clicked, so they are not buried in it.
        y: Math.round(pos.y + (isLightType(def.type) ? 160 : 0)),
        z: Math.round(pos.z),
        rotY, rotX: 0, rotZ: 0, scale: 1,
        alignToTrack: this.snapping.alignToTrack,
        trackDist: hit.sample ? Math.round(hit.sample.dist) : undefined,
        cameraFacing: false, isDecal: false, flipX: false,
      };
      if (isLightType(def.type)) kitProp.light = { ...lightPreset(def.type) };
      if (isPrimitiveType(def.type)) {
        const shader = this.activeShaderId ? this.shaderLibrary.find((sh) => sh.id === this.activeShaderId) : undefined;
        if (shader) kitProp.shader = normalizeShader(shader);
      }
      this.placedProps.push(kitProp);
      this.createPropSprite(kitProp);
      this.selectProp(kitProp.id);
      this.saveToStorage();
      this.notify();
      return kitProp;
    }

    const prop: PlacedProp = {
      id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: def.type,
      name: def.name,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      z: Math.round(pos.z),
      rotY,
      rotX,
      rotZ,
      quaternion,
      scale: 1,
      alignToTrack: this.snapping.alignToTrack,
      trackDist: hit.sample ? Math.round(hit.sample.dist) : undefined,
      cameraFacing: (isPhysical3D || isDecal) ? false : this.snapping.cameraFacingDefault,
      flipX: false,
      isDecal: isPhysical3D ? false : isDecal,
      lit: isDecal ? this.snapping.decalLightingDefault : undefined,
      animate: def.isAnimated ? true : undefined,
    };

    this.placedProps.push(prop);
    this.createPropSprite(prop);
    this.selectProp(prop.id);
    this.saveToStorage();
    this.notify();
    return prop;
  }

  duplicateSelected(): PlacedProp[] {
    const all = this.getSelectedProps();
    const selected = all.filter((p) => !isTerrainEdit(p));
    if (selected.length < all.length) {
      this.placementErrorState = 'Course scenery cannot be duplicated. Place a primitive instead.';
      this.notify();
    }
    if (selected.length === 0) return [];

    this.pushUndo();
    const newGroupId = selected.length > 1 ? `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` : undefined;
    const duplicated: PlacedProp[] = [];
    const newIds: string[] = [];

    for (const prop of selected) {
      const newId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const dup: PlacedProp = {
        ...prop,
        id: newId,
        x: prop.x + 120,
        z: prop.z + 120,
        groupId: newGroupId || (prop.groupId ? `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` : undefined),
      };
      this.placedProps.push(dup);
      this.createPropSprite(dup);
      duplicated.push(dup);
      newIds.push(newId);
    }

    this.selectMultipleProps(newIds);
    this.saveToStorage();
    this.notify();
    return duplicated;
  }

  deleteSelected() {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    this.pushUndo();
    for (const prop of selected) {
      if (isTerrainEdit(prop)) {
        if (this.kit.isLockedEdit(prop)) {
          this.placementErrorState = 'The road shows the race line: it can take a shader but cannot be removed.';
          continue;
        }
        prop.terrainHidden = true;
        const obj = this.propObjects.get(prop.id);
        if (obj) this.kit.applyTransform(prop, obj);
        const box = this.selectionBoxes.get(prop.id);
        if (box) { this.scene.remove(box); this.selectionBoxes.delete(prop.id); }
        continue;
      }
      const idx = this.placedProps.findIndex((p) => p.id === prop.id);
      if (idx >= 0) {
        this.removePropObject(prop);
        this.disposeAnimTexture(prop.id);
        const box = this.selectionBoxes.get(prop.id);
        if (box) {
          this.scene.remove(box);
          this.selectionBoxes.delete(prop.id);
        }
        this.placedProps.splice(idx, 1);
      }
    }
    this.selectedPropIds.clear();
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  deleteProp(id: string) {
    this.pushUndo();

    const idx = this.placedProps.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const prop = this.placedProps[idx];
      // For a scenery edit this is "restore": the part goes back exactly as generated.
      this.removePropObject(prop);
      this.disposeAnimTexture(prop.id);
      const box = this.selectionBoxes.get(prop.id);
      if (box) {
        this.scene.remove(box);
        this.selectionBoxes.delete(prop.id);
      }
      this.placedProps.splice(idx, 1);
    }

    this.selectedPropIds.delete(id);
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  focusProp(id: string) {
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop) return;

    this.selectProp(id);

    const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
    const h = (def?.defaultHeight ?? 600) * prop.scale;

    const viewDist = Math.max(900, h * 1.5);
    this.freeFly.x = prop.x;
    this.freeFly.y = prop.y + h * 0.5 + 200;
    this.freeFly.z = prop.z - viewDist;
    this.freeFly.yaw = 0;
    this.freeFly.pitch = -0.15;

    this.camera.position.set(this.freeFly.x, this.freeFly.y, this.freeFly.z);
    this.camera.lookAt(prop.x, prop.y + h * 0.4, prop.z);
    this.notify();
  }

  updatePropTransform(id: string, updates: Partial<PlacedProp>, autoSync = true) {
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop) return;

    if (isKitType(prop.type)) {
      if (updates.rotY !== undefined) {
        let r = updates.rotY;
        while (r > Math.PI) r -= 2 * Math.PI;
        while (r < -Math.PI) r += 2 * Math.PI;
        updates.rotY = r;
      }
      const oldKind = isLightType(prop.type) ? lightSettingsFor(prop).kind : null;
      Object.assign(prop, updates);
      if (isTerrainEdit(prop) && this.kit.isLockedEdit(prop) && prop.terrainOrigin) {
        // The road moves with nothing: only its shader can change.
        [prop.x, prop.y, prop.z] = prop.terrainOrigin as [number, number, number];
        prop.rotY = 0; prop.rotX = 0; prop.rotZ = 0; prop.scale = 1;
      }
      if (oldKind && lightSettingsFor(prop).kind !== oldKind) {
        this.removePropObject(prop);
        this.createPropSprite(prop);
      } else {
        const obj = this.propObjects.get(id);
        if (obj) this.kit.applyTransform(prop, obj);
      }
      if (autoSync) {
        this.updateSelectionBox();
        this.saveToStorage();
        this.notify();
      }
      return;
    }

    const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);

    // T03: keep ramps inside the physically representable region — reject
    // (and revert) transforms that would orphan their elevation.
    if (def?.isRamp) {
      const touchesGeometry = ['x', 'y', 'z', 'scale', 'trackDist'].some((k) => updates[k as keyof PlacedProp] !== undefined);
      if (touchesGeometry) {
        const candidate = { ...prop, ...updates };
        const rampRejection = this.validateRampSupport(prop.type, {
          id: prop.id, x: candidate.x, y: candidate.y, z: candidate.z, scale: candidate.scale, trackDist: candidate.trackDist,
        });
        if (rampRejection) {
          this.placementErrorState = rampRejection;
          this.notify();
          return;
        }
      }
    }
    const isPhysical3D = Boolean(def?.isRamp || def?.isSlingshot || def?.is3DModel);
    const oldCameraFacing = prop.cameraFacing !== false;
    const oldIsDecal = isPhysical3D ? false : (prop.isDecal !== undefined ? prop.isDecal : (def?.isDecal ?? false));
    const oldLit = prop.lit !== false;
    // Swapping a still prop to its animated twin (or back) changes the texture,
    // so the sprite has to be rebuilt with the new sheet's UV window.
    const oldSheetUrl = animSheetFor(prop)?.url;

    const willBeDecal = isPhysical3D ? false : (updates.isDecal !== undefined ? updates.isDecal : oldIsDecal);

    // Decal rotation handling:
    // When rotY is updated on a decal without an explicit quaternion update,
    // spin the decal in-place around its local surface normal (0, 0, 1) by deltaYaw,
    // and recalculate rotX (pitch) and rotZ (roll) so all transform parameters remain in sync.
    if (willBeDecal && updates.rotY !== undefined && updates.quaternion === undefined) {
      let deltaYaw = updates.rotY - (prop.rotY ?? 0);
      while (deltaYaw > Math.PI) deltaYaw -= 2 * Math.PI;
      while (deltaYaw < -Math.PI) deltaYaw += 2 * Math.PI;

      if (Math.abs(deltaYaw) > 0.0001) {
        let q: THREE.Quaternion;
        if (prop.quaternion) {
          q = new THREE.Quaternion(...prop.quaternion);
        } else {
          const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
          const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(prop.rotY ?? 0));
          const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), prop.rotX ?? 0);
          const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotZ ?? 0);
          q = qFlat.multiply(qYaw).multiply(qPitch).multiply(qRoll);
        }

        const qSpin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), deltaYaw);
        q.multiply(qSpin).normalize();
        updates.quaternion = [q.x, q.y, q.z, q.w];

        const F = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        const R = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        updates.rotX = Math.asin(Math.max(-1, Math.min(1, F.y)));
        updates.rotZ = Math.asin(Math.max(-1, Math.min(1, R.y)));
      }
    } else if (willBeDecal && updates.rotZ !== undefined && updates.rotY === undefined && updates.quaternion === undefined && prop.quaternion) {
      // If rotZ is adjusted on a decal without rotY, apply roll tilt around decal local Y
      const deltaRoll = updates.rotZ - (prop.rotZ ?? 0);
      if (Math.abs(deltaRoll) > 0.0001) {
        const q = new THREE.Quaternion(...prop.quaternion);
        const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaRoll);
        q.multiply(qTilt).normalize();
        updates.quaternion = [q.x, q.y, q.z, q.w];
      }
    }

    if (updates.rotY !== undefined) {
      let normalizedRotY = updates.rotY;
      while (normalizedRotY > Math.PI) normalizedRotY -= 2 * Math.PI;
      while (normalizedRotY < -Math.PI) normalizedRotY += 2 * Math.PI;
      updates.rotY = normalizedRotY;
    }

    // When switching from billboard (cameraFacing: true) to fixed 3D (cameraFacing: false),
    // orient the prop to face the current camera angle so it doesn't snap to an arbitrary heading
    if (updates.cameraFacing === false && oldCameraFacing === true && updates.rotY === undefined && !oldIsDecal) {
      let dx = this.camera.position.x - prop.x;
      let dz = this.camera.position.z - prop.z;
      if (Math.hypot(dx, dz) < 1e-2) {
        dx = -Math.sin(this.freeFly.yaw);
        dz = -Math.cos(this.freeFly.yaw);
      }
      updates.rotY = Math.atan2(dx, dz);
    }

    Object.assign(prop, updates);
    if (isPhysical3D) {
      prop.isDecal = false;
    }

    const newCameraFacing = prop.cameraFacing !== false;
    const newIsDecal = isPhysical3D ? false : (prop.isDecal !== undefined ? prop.isDecal : (def?.isDecal ?? false));
    const newLit = prop.lit !== false;
    const newSheetUrl = animSheetFor(prop)?.url;

    // If cameraFacing, isDecal, lit or the animated sheet changed, recreate the 3D object
    if (oldCameraFacing !== newCameraFacing || oldIsDecal !== newIsDecal || oldSheetUrl !== newSheetUrl || (updates.lit !== undefined && oldLit !== newLit)) {
      this.removePropObject(prop);
      this.createPropSprite(prop);
    } else {
      const obj = this.propObjects.get(id);
      if (obj) {
        obj.position.set(prop.x, prop.y, prop.z);
        const flip = prop.flipX ? -1 : 1;
        if (def) {
          if (def.isRamp) {
            obj.rotation.y = prop.rotY;
            obj.rotation.z = prop.rotZ ?? 0;
            obj.scale.set(prop.scale * flip, prop.scale, prop.scale);
          } else if (def.isSlingshot || def.is3DModel) {
            obj.rotation.y = prop.rotY;
            obj.rotation.z = prop.rotZ ?? 0;
            obj.scale.set(prop.scale * flip, prop.scale, prop.scale);
          } else if (newIsDecal || (obj as any).userData?.isDecal) {
            this.applyDecalTransform(obj, prop, def);
          } else if (prop.cameraFacing === false) {
            obj.rotation.y = prop.rotY;
            obj.rotation.z = prop.rotZ ?? 0;
            obj.scale.set(prop.scale * flip, prop.scale, prop.scale);
          } else {
            // Sprite
            if (obj instanceof THREE.Sprite) {
              obj.material.rotation = prop.rotZ ?? 0;
              obj.scale.set(def.defaultWidth * prop.scale * flip, def.defaultHeight * prop.scale, 1);
            }
          }
        }
      }
    }
    if (autoSync) {
      this.updateSelectionBox();
      this.saveToStorage();
      this.notify();
    }
  }

  isPropDecal(prop: PlacedProp): boolean {
    const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
    if (def?.isRamp || def?.isSlingshot || def?.is3DModel) return false;
    if (prop.isDecal !== undefined) return prop.isDecal;
    return def?.isDecal ?? false;
  }

  private applyDecalTransform(obj: THREE.Object3D, prop: PlacedProp, _def?: PropDefinition) {
    const flip = prop.flipX ? -1 : 1;
    obj.position.set(prop.x, prop.y + 2, prop.z);
    obj.scale.set(prop.scale * flip, prop.scale, prop.scale);

    if (prop.quaternion) {
      obj.quaternion.set(prop.quaternion[0], prop.quaternion[1], prop.quaternion[2], prop.quaternion[3]);
    } else {
      const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -prop.rotY);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), prop.rotX ?? 0);
      const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotZ ?? 0);
      obj.quaternion.copy(qFlat).multiply(qYaw).multiply(qPitch).multiply(qRoll);
    }
  }

  private initDecalSideHandles() {
    this.decalSideHandlesGroup = new THREE.Group();
    this.decalSideHandlesGroup.name = 'DecalSideHandlesGroup';
    this.decalSideHandlesGroup.visible = false;

    const boxGeo = new THREE.BoxGeometry(34, 34, 34);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0x665500,
      roughness: 0.35,
      metalness: 0.1,
      depthTest: false,
    });

    const sides: DecalSide[] = ['front', 'back', 'left', 'right'];
    for (const side of sides) {
      const handleGroup = new THREE.Group();
      handleGroup.name = `DecalHandle_${side}`;

      const mesh = new THREE.Mesh(boxGeo, boxMat.clone());
      mesh.name = `DecalSideBox_${side}`;
      mesh.userData = { isDecalSideHandle: true, side };
      mesh.renderOrder = 10002;

      // High-contrast black outline
      const edges = new THREE.EdgesGeometry(boxGeo);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2, depthTest: false });
      const wireframe = new THREE.LineSegments(edges, lineMat);
      wireframe.renderOrder = 10003;
      mesh.add(wireframe);

      handleGroup.add(mesh);
      this.decalSideHandlesGroup.add(handleGroup);
      this.decalSideBoxes.set(side, mesh);
    }

    this.scene.add(this.decalSideHandlesGroup);
  }

  getPlacedRamps(): readonly PlacedProp[] {
    return this.placedProps.filter((p) => {
      const def = PROP_DEFINITIONS.find((d) => d.type === p.type);
      return def?.isRamp || p.type === 'timber_ramp' || p.type === 'rock_springboard' || p.type === 'springboard';
    });
  }

  // --- SELECTION BOX HIGHLIGHT & ROTATION HANDLE ---
  private updateSelectionBox() {
    const selected = this.getSelectedProps();
    this.pruneNoOpTerrainEdits();
    if (selected.length === 0 || !this.freeFly.active) {
      this.kit.setSelected(this.selectedPropIds, this.propObjects);
      this.selectionBoxes.forEach((box) => { box.visible = false; });
      if (this.rotationHandle) this.rotationHandle.visible = false;
      if (this.decalSideHandlesGroup) this.decalSideHandlesGroup.visible = false;
      if (!this.selectedLaneNodeId || !this.lanesVisible) {
        this.gizmoAdapter?.detach();
      }
      return;
    }

    this.gizmoAdapter?.attach(selected.filter((p) => !(isTerrainEdit(p) && this.kit.isLockedEdit(p))));
    this.kit.setSelected(this.selectedPropIds, this.propObjects);

    const currentSelectedIds = new Set(selected.map((p) => p.id));

    // Hide boxes for unselected props
    for (const [id, box] of this.selectionBoxes.entries()) {
      if (!currentSelectedIds.has(id)) {
        box.visible = false;
      }
    }

    const isGroup = selected.length > 1;
    const boxColor = isGroup ? 0x38bdf8 : 0xffdd00;

    // Create or update box helpers for each selected prop
    for (const prop of selected) {
      const obj = this.propObjects.get(prop.id);
      if (!obj) continue;
      let box = this.selectionBoxes.get(prop.id);
      if (!box) {
        box = new THREE.BoxHelper(obj, boxColor);
        (box.material as THREE.LineBasicMaterial).depthTest = false;
        (box.material as THREE.LineBasicMaterial).transparent = true;
        (box.material as THREE.LineBasicMaterial).opacity = 0.95;
        box.renderOrder = 9999;
        this.scene.add(box);
        this.selectionBoxes.set(prop.id, box);
      } else {
        box.setFromObject(obj);
        (box.material as THREE.LineBasicMaterial).color.setHex(boxColor);
        box.visible = true;
      }
    }

    // Centroid of selected group
    const centroid = this.getGroupCentroid();
    const allDecals = selected.every((p) => this.isPropDecal(p));
    let maxHandleY = allDecals ? centroid.y + 35 : centroid.y + 120;
    for (const prop of selected) {
      const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
      const h = (def?.defaultHeight ?? 500) * prop.scale;
      const isDecal = this.isPropDecal(prop);
      const hy = prop.y + (isDecal ? 35 : (def?.isSlingshot ? 440 * prop.scale : h + 70));
      if (hy > maxHandleY) maxHandleY = hy;
    }

    if (!this.rotationHandle) {
      this.rotationHandle = new THREE.Group();
      this.rotationHandle.name = 'RotationHandleGroup';

      // Stem line
      const stemGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 45, 0),
      ]);
      const stemMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, depthTest: false });
      const stem = new THREE.Line(stemGeo, stemMat);
      stem.renderOrder = 10000;
      this.rotationHandle.add(stem);

      // Rotation ring / torus - oriented horizontally (Math.PI / 2) for smooth top-down/isometric dragging
      const ringGeo = new THREE.TorusGeometry(40, 7, 10, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 45;
      ring.rotation.x = Math.PI / 2;
      ring.renderOrder = 10000;
      ring.userData = { isRotationHandle: true };
      this.rotationHandle.add(ring);

      this.scene.add(this.rotationHandle);
    }

    this.rotationHandle.position.set(centroid.x, maxHandleY, centroid.z);
    this.rotationHandle.visible = true;

    // Decal side handles (4 yellow manipulation boxes on Front, Back, Left, Right edges)
    const isSingleDecal = selected.length === 1 && this.isPropDecal(selected[0]);
    if (isSingleDecal && this.decalSideHandlesGroup) {
      const prop = selected[0];
      const obj = this.propObjects.get(prop.id);
      const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
      if (obj && def) {
        this.decalSideHandlesGroup.position.copy(obj.position);
        this.decalSideHandlesGroup.quaternion.copy(obj.quaternion);

        const w = (def.defaultWidth || 500) * prop.scale;
        const h = (def.defaultHeight || 500) * prop.scale;
        const hw = w / 2;
        const hh = h / 2;

        const frontHandle = this.decalSideHandlesGroup.getObjectByName('DecalHandle_front');
        if (frontHandle) frontHandle.position.set(0, hh, 14);

        const backHandle = this.decalSideHandlesGroup.getObjectByName('DecalHandle_back');
        if (backHandle) backHandle.position.set(0, -hh, 14);

        const leftHandle = this.decalSideHandlesGroup.getObjectByName('DecalHandle_left');
        if (leftHandle) leftHandle.position.set(-hw, 0, 14);

        const rightHandle = this.decalSideHandlesGroup.getObjectByName('DecalHandle_right');
        if (rightHandle) rightHandle.position.set(hw, 0, 14);

        this.decalSideBoxes.forEach((box) => {
          box.userData.propId = prop.id;
        });

        this.decalSideHandlesGroup.visible = true;
      } else {
        this.decalSideHandlesGroup.visible = false;
      }
    } else if (this.decalSideHandlesGroup) {
      this.decalSideHandlesGroup.visible = false;
    }
  }

  raycastRotateHandle(clientX: number, clientY: number, canvas: HTMLCanvasElement): boolean {
    if (!this.rotationHandle || !this.rotationHandle.visible) return false;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.mouseNdc.set(x, y);
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.rotationHandle.children, true);
    return hits.length > 0;
  }

  raycastDecalSideHandle(clientX: number, clientY: number, canvas: HTMLCanvasElement): { side: DecalSide; prop: PlacedProp } | null {
    if (!this.decalSideHandlesGroup || !this.decalSideHandlesGroup.visible) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.mouseNdc.set(x, y);
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.decalSideHandlesGroup.children, true);
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData?.isDecalSideHandle) {
        obj = obj.parent;
      }
      if (obj?.userData?.isDecalSideHandle) {
        const prop = this.placedProps.find((p) => p.id === obj!.userData.propId);
        if (prop) {
          return { side: obj.userData.side as DecalSide, prop };
        }
      }
    }
    return null;
  }

  alignDecalToTerrain(propId?: string): { hit: boolean; pitchDeg: number; rollDeg: number } | null {
    const id = propId ?? this.selectedPropIds.values().next().value;
    if (!id) return null;
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop || !this.isPropDecal(prop)) return null;

    this.pushUndo();

    // Raycast down from above the decal
    const rayOrigin = new THREE.Vector3(prop.x, prop.y + 1500, prop.z);
    this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
    let hits = this.raycaster.intersectObjects(this.scene.children, true);

    let validHit: THREE.Intersection | null = null;
    for (const h of hits) {
      const o = h.object;
      if (
        o.name === 'Sky' ||
        o.name === 'Ghost' ||
        o.name === 'GhostMesh' ||
        o.name === 'GhostDecalMesh' ||
        (o as any).isSprite ||
        o.name === 'DebugMarkers' ||
        o.name?.startsWith('PlacedProp_') ||
        o.name?.startsWith('DecalSide') ||
        o.name?.startsWith('DecalHandle') ||
        o.name === 'RotationHandleGroup' ||
        o.name === 'DecalSideHandlesGroup'
      ) continue;
      validHit = h;
      break;
    }

    if (!validHit) {
      this.raycaster.set(new THREE.Vector3(prop.x, 25000, prop.z), new THREE.Vector3(0, -1, 0));
      hits = this.raycaster.intersectObjects(this.scene.children, true);
      for (const h of hits) {
        const o = h.object;
        if (
          o.name === 'Sky' ||
          o.name === 'Ghost' ||
          o.name === 'GhostMesh' ||
          o.name === 'GhostDecalMesh' ||
          (o as any).isSprite ||
          o.name === 'DebugMarkers' ||
          o.name?.startsWith('PlacedProp_') ||
          o.name?.startsWith('DecalSide') ||
          o.name?.startsWith('DecalHandle') ||
          o.name === 'RotationHandleGroup' ||
          o.name === 'DecalSideHandlesGroup'
        ) continue;
        validHit = h;
        break;
      }
    }

    if (!validHit || !validHit.face) return { hit: false, pitchDeg: 0, rollDeg: 0 };

    const normal = validHit.face.normal.clone().transformDirection(validHit.object.matrixWorld).normalize();
    const yaw = prop.rotY ?? 0;
    const F_horiz = new THREE.Vector3(Math.sin(-yaw), 0, Math.cos(-yaw)).normalize();
    const F_surface = F_horiz.clone().sub(normal.clone().multiplyScalar(F_horiz.dot(normal))).normalize();
    const R_surface = new THREE.Vector3().crossVectors(F_surface, normal).normalize();
    const mBasis = new THREE.Matrix4().makeBasis(R_surface, F_surface, normal);
    const q = new THREE.Quaternion().setFromRotationMatrix(mBasis);

    const pitch = Math.asin(F_surface.y);
    const roll = Math.asin(R_surface.y);

    prop.x = Math.round(validHit.point.x);
    prop.y = Math.round(validHit.point.y + 2);
    prop.z = Math.round(validHit.point.z);
    prop.rotX = pitch;
    prop.rotZ = roll;
    prop.quaternion = [q.x, q.y, q.z, q.w];

    this.updatePropTransform(prop.id, {
      x: prop.x,
      y: prop.y,
      z: prop.z,
      rotX: prop.rotX,
      rotZ: prop.rotZ,
      quaternion: prop.quaternion,
    }, true);

    return {
      hit: true,
      pitchDeg: (pitch * 180) / Math.PI,
      rollDeg: (roll * 180) / Math.PI,
    };
  }

  nudgeDecalSide(propId: string, side: DecalSide, deltaElevation: number, pushUndo = false, autoSave = true) {
    const prop = this.placedProps.find((p) => p.id === propId);
    if (!prop || !this.isPropDecal(prop) || deltaElevation === 0) return;

    if (pushUndo) {
      this.pushUndo();
    }

    const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
    const W = (def?.defaultWidth || 500) * prop.scale;
    const H = (def?.defaultHeight || 500) * prop.scale;
    const hw = W / 2;
    const hh = H / 2;

    let q: THREE.Quaternion;
    if (prop.quaternion) {
      q = new THREE.Quaternion(...prop.quaternion);
    } else {
      const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -prop.rotY);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), prop.rotX ?? 0);
      const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotZ ?? 0);
      q = qFlat.multiply(qYaw).multiply(qPitch).multiply(qRoll);
    }

    let pos = new THREE.Vector3(prop.x, prop.y, prop.z);
    const R_world = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const F_world = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const N_world = new THREE.Vector3(0, 0, 1).applyQuaternion(q);

    let axis: THREE.Vector3;
    let dTheta: number;

    if (side === 'front') {
      axis = R_world;
      dTheta = deltaElevation / (2 * hh);
    } else if (side === 'back') {
      axis = R_world;
      dTheta = -deltaElevation / (2 * hh);
    } else if (side === 'left') {
      axis = F_world;
      dTheta = deltaElevation / (2 * hw);
    } else {
      // right
      axis = F_world;
      dTheta = -deltaElevation / (2 * hw);
    }

    const qDelta = new THREE.Quaternion().setFromAxisAngle(axis, dTheta);
    q = qDelta.multiply(q);
    pos.addScaledVector(N_world, deltaElevation / 2);

    const pitch = Math.asin(new THREE.Vector3(0, 1, 0).applyQuaternion(q).y);
    const roll = Math.asin(new THREE.Vector3(1, 0, 0).applyQuaternion(q).y);

    prop.x = Math.round(pos.x);
    prop.y = Math.round(pos.y);
    prop.z = Math.round(pos.z);
    prop.rotX = pitch;
    prop.rotZ = roll;
    prop.quaternion = [q.x, q.y, q.z, q.w];

    this.updatePropTransform(prop.id, {
      x: prop.x,
      y: prop.y,
      z: prop.z,
      rotX: prop.rotX,
      rotZ: prop.rotZ,
      quaternion: prop.quaternion,
    }, autoSave);
  }

  resetDecalFlat(propId?: string) {
    const id = propId ?? this.selectedPropIds.values().next().value;
    if (!id) return;
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop || !this.isPropDecal(prop)) return;

    this.pushUndo();
    prop.rotX = 0;
    prop.rotZ = 0;
    delete prop.quaternion;

    this.updatePropTransform(prop.id, {
      rotX: 0,
      rotZ: 0,
      quaternion: undefined,
    }, true);
  }

  getDecalAngles(prop: PlacedProp): { pitchDeg: number; rollDeg: number } {
    if (prop.quaternion) {
      const q = new THREE.Quaternion(...prop.quaternion);
      const F = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const R = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      return {
        pitchDeg: Math.round((Math.asin(F.y) * 180) / Math.PI),
        rollDeg: Math.round((Math.asin(R.y) * 180) / Math.PI),
      };
    }
    return {
      pitchDeg: Math.round(((prop.rotX ?? 0) * 180) / Math.PI),
      rollDeg: Math.round(((prop.rotZ ?? 0) * 180) / Math.PI),
    };
  }

  rotateDecal(propId?: string, deltaRadians = Math.PI / 12, pushUndo = true) {
    const id = propId ?? this.selectedPropIds.values().next().value;
    if (!id) return;
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop || !this.isPropDecal(prop) || deltaRadians === 0) return;

    if (pushUndo) {
      this.pushUndo();
    }

    this.updatePropTransform(prop.id, {
      rotY: (prop.rotY ?? 0) + deltaRadians,
    }, true);
  }

  tiltSelectedProp(deltaRadians: number) {
    this.tiltSelectedProps(deltaRadians);
  }

  flipSelectedProp() {
    this.flipSelectedProps();
  }

  // --- SPRITE & MESH CREATION & TEXTURE CACHE ---
  private getTexture(url: string): THREE.Texture {
    let tex = this.textureCache.get(url);
    if (!tex) {
      if (typeof document === 'undefined') {
        tex = new THREE.Texture();
      } else {
        tex = this.textureLoader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
      }
      tex.name = url; // cloned sheets inherit the name — handy for debugging/tests
      this.textureCache.set(url, tex);
    }
    return tex;
  }

  /**
   * Animated decorations get one cloned texture per placed prop (keyed by
   * prop id) showing a single sheet quadrant; static props share the cached
   * texture. Clones are reused across sprite recreations (undo/redo, decal
   * toggles) and disposed when the prop is deleted.
   */
  private readonly animTextureCache = new Map<string, THREE.Texture>();

  private getPropTexture(def: PropDefinition, prop: PlacedProp): THREE.Texture {
    const sheet = animSheetFor(prop);
    if (!sheet) return this.getTexture(def.url);
    let tex = this.animTextureCache.get(prop.id);
    if (!tex) {
      const base = this.getTexture(sheet.url);
      tex = base.clone();
      const { cols, rows } = sheet;
      tex.repeat.set(1 / cols, 1 / rows);
      const uv = animFrameUV(0, cols, rows);
      tex.offset.set(uv.u, uv.v);
      tex.needsUpdate = true;
      this.animTextureCache.set(prop.id, tex);
    }
    return tex;
  }

  private disposeAnimTexture(propId: string) {
    const tex = this.animTextureCache.get(propId);
    if (tex) {
      tex.dispose();
      this.animTextureCache.delete(propId);
    }
  }

  /**
   * Advance every placed animated decoration to its current sheet frame.
   * Called once per rendered frame (race loop) and from the editor preview
   * tick; props with animate === false (or reduced motion) rest on frame 0.
   * Late texture loads are picked up: a clone made before the base image
   * arrived adopts it here instead of staying blank.
   */
  updateAnimations(timeSec: number, reducedMotion = false) {
    this.kit.update(this.camera, timeSec, reducedMotion, this.freeFly.active);
    if (this.animTextureCache.size === 0) return;
    for (const [propId, tex] of this.animTextureCache) {
      const obj = this.propObjects.get(propId);
      const anim = (obj?.userData as { anim?: AnimGrid & { phase: number } } | undefined)?.anim;
      if (!obj || !anim) continue;
      const prop = this.placedProps.find((p) => p.id === propId);
      const sheet = animSheetFor(prop);
      if (sheet) {
        const base = this.getTexture(sheet.url);
        if (!tex.image && base.image) {
          tex.image = base.image;
          tex.needsUpdate = true;
        }
      }
      const total = anim.cols * anim.rows;
      const enabled = animEnabledFrames(prop, total);
      const playing = !reducedMotion && prop?.animate !== false && enabled.length > 1;
      const frame = playing
        ? animFrameAt(timeSec, anim.fps * animSpeedFor(prop), total, anim.phase, prop?.animFrames, prop?.animFrameDelays)
        : enabled[0];
      const uv = animFrameUV(frame, anim.cols, anim.rows);
      if (tex.offset.x !== uv.u || tex.offset.y !== uv.v) tex.offset.set(uv.u, uv.v);
    }
  }

  /** True when at least one placed prop is cycling frames (gates editor preview renders). */
  hasPlayingAnimations(): boolean {
    return this.placedProps.some((p) => {
      if (p.animate === false) return false;
      const sheet = animSheetFor(p);
      if (!sheet) return false;
      return animEnabledFrames(p, sheet.cols * sheet.rows).length > 1;
    });
  }

  private createPropSprite(prop: PlacedProp): THREE.Object3D {
    if (isKitType(prop.type)) {
      const obj = this.kit.create(prop);
      this.propObjects.set(prop.id, obj);
      return obj;
    }
    const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
    if (!def) return new THREE.Object3D();

    let obj: THREE.Object3D;
    const flip = prop.flipX ? -1 : 1;
    const isDecal = prop.isDecal !== undefined ? prop.isDecal : (def.isDecal ?? false);
    // A still prop toggled to "Animated" borrows its twin's sheet (same art,
    // same aspect) — it keeps its own defaultWidth/Height so nothing resizes.
    const sheet = animSheetFor(prop);
    const animGrid = sheet ?? animGridFor(def);
    const animState = sheet
      ? { cols: animGrid.cols, rows: animGrid.rows, fps: animGrid.fps, phase: animPhaseFor(prop.id, animGrid.cols * animGrid.rows) }
      : undefined;

    if (def.isRamp) {
      // Create 3D wedge ramp mesh using base dimensions (scale 1.0)
      const w = def.defaultWidth || 960;
      const len = 1100;
      const h = def.defaultHeight || 260;
      const mat = this.materials?.wood ?? new THREE.MeshStandardMaterial({
        color: 0x9b6b3b,
        roughness: 0.7,
      });
      const mesh = wedgeMesh(w, len, h, mat);
      mesh.name = `PlacedProp_${prop.id}`;
      mesh.userData = { propId: prop.id, isRamp: true };
      mesh.position.set(prop.x, prop.y, prop.z);
      mesh.rotation.y = prop.rotY;
      mesh.rotation.z = prop.rotZ ?? 0;
      mesh.scale.set(prop.scale * flip, prop.scale, prop.scale);
      obj = mesh;
    } else if (def.isSlingshot || def.is3DModel) {
      // Create 3D Slingshot Model
      const model = createSlingshotMesh(prop.scale, this.materials);
      model.name = `PlacedProp_${prop.id}`;
      model.userData = { propId: prop.id, is3DModel: true, isSlingshot: true };
      model.position.set(prop.x, prop.y, prop.z);
      model.rotation.y = prop.rotY;
      model.rotation.z = prop.rotZ ?? 0;
      model.scale.set(prop.scale * flip, prop.scale, prop.scale);
      obj = model;
    } else if (isDecal) {
      // Flat surface decal (lies flat on track/ground)
      const tex = this.getPropTexture(def, prop);
      const geom = new THREE.PlaneGeometry(def.defaultWidth, def.defaultHeight);
      const isLit = prop.lit !== false;
      const mat = isLit
        ? new THREE.MeshStandardMaterial({
            map: tex,
            transparent: true,
            roughness: 0.95,
            metalness: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          })
        : new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = `PlacedProp_${prop.id}`;
      mesh.userData = { propId: prop.id, isDecal: true, ...(animState ? { anim: animState } : {}) };
      this.applyDecalTransform(mesh, prop, def);
      obj = mesh;
    } else if (prop.cameraFacing === false) {
      // Fixed 3D World Orientation (Double-sided plane mesh)
      const tex = this.getPropTexture(def, prop);
      const geom = new THREE.PlaneGeometry(def.defaultWidth, def.defaultHeight);
      if (def.alignBottom !== false) {
        geom.translate(0, def.defaultHeight / 2, 0);
      }
      const isLit = prop.lit !== false;
      const mat = isLit
        ? new THREE.MeshStandardMaterial({
            map: tex,
            transparent: true,
            roughness: 0.95,
            metalness: 0.0,
            side: THREE.DoubleSide,
            depthWrite: true,
            alphaTest: 0.2,
          })
        : new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: true,
            alphaTest: 0.2,
          });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = `PlacedProp_${prop.id}`;
      mesh.userData = { propId: prop.id, isMeshProp: true, ...(animState ? { anim: animState } : {}) };
      mesh.position.set(prop.x, prop.y, prop.z);
      mesh.rotation.y = prop.rotY;
      mesh.rotation.z = prop.rotZ ?? 0;
      mesh.scale.set(prop.scale * flip, prop.scale, prop.scale);
      obj = mesh;
    } else {
      // Camera Facing (Billboard Sprite)
      const tex = this.getPropTexture(def, prop);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        rotation: prop.rotZ ?? 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.name = `PlacedProp_${prop.id}`;
      sprite.userData = { propId: prop.id, ...(animState ? { anim: animState } : {}) };
      sprite.position.set(prop.x, prop.y, prop.z);
      sprite.center.set(0.5, def.alignBottom !== false ? 0 : 0.5);
      sprite.scale.set(def.defaultWidth * prop.scale * flip, def.defaultHeight * prop.scale, 1);
      obj = sprite;
    }

    // T08: Respect visibility flag, and M01 · T1b: the retired slingshot is not part of a push run.
    if (prop.visible === false || (this.isSlingshotProp(prop) && !this.slingshotsVisible)) {
      obj.visible = false;
    }

    this.scene.add(obj);
    this.propObjects.set(prop.id, obj);
    return obj;
  }

  // ---------------------------------------------------------------------------
  // M01 · T7 — LANES & PATHS
  // ---------------------------------------------------------------------------

  /** The lane document being edited, or null (which means the course's legacy four lanes). */
  getLaneNetwork(): LaneNetwork | null { return this.laneDoc; }

  /** What the runtime's own validator says about the document: the panel lists these. */
  laneValidation(): LaneValidation {
    return this.laneDoc
      ? validateLaneNetwork(this.laneDoc)
      : { ok: true, network: null as unknown as LaneNetwork };
  }

  /** Loads the stored network for the current course, if the document is trustworthy. */
  private loadLaneDoc() {
    this.laneDoc = loadLaneNetwork(this.courseId as never);
    this.laneGizmos.setNetwork(this.laneDoc);
    this.selectedLaneNodeId = null;
  }

  /** Replaces the whole document (import, open, course switch). Pushes undo unless told not to. */
  setLaneNetwork(network: LaneNetwork | null, opts: { pushUndo?: boolean } = {}) {
    if (opts.pushUndo !== false) this.pushUndo();
    this.laneDoc = network;
    this.laneGizmos.setNetwork(network);
    this.selectedLaneNodeId = null;
    this.notify();
  }

  /** The lanes tool is drawn only while it is the active tool. */
  setLanesToolActive(active: boolean) {
    this.lanesVisible = active;
    this.laneGizmos.root.visible = active;
    if (!active) {
      this.selectedLaneNodeId = null;
      this.laneGizmos.setSelectedNode(null);
      if (this.gizmoAdapter?.isLaneNodeAttached()) {
        this.gizmoAdapter.detach();
      }
    } else if (this.selectedLaneNodeId) {
      this.attachGizmoToLaneNode(this.selectedLaneNodeId);
    }
    this.notify();
  }

  getLanesToolActive(): boolean { return this.lanesVisible; }

  /** Gizmo accounting, for the panel's status line and for the AC-4 test. */
  laneGizmoStats() { return { ...this.laneGizmos.stats }; }

  /**
   * One edit from the panel or a key, through the pure tool. A refusal changes nothing and its reason
   * is handed back for the toast; an accepted edit redraws only what moved.
   */
  applyLaneEditToDoc(edit: LaneEdit): { ok: true; focus?: string } | { ok: false; reason: string } {
    if (!this.laneDoc) return { ok: false, reason: 'no_document: there is no lane network loaded' };
    const result = applyLaneEdit(this.laneDoc, edit);
    if (!result.ok) return { ok: false, reason: result.reason };
    this.laneDoc = result.network;
    // A move rewrites one handle and its own paths; anything structural rebuilds the drawing.
    if (edit.op === 'moveNode') this.laneGizmos.moveNode(edit.nodeId, this.laneDoc);
    else this.laneGizmos.setNetwork(this.laneDoc);
    if (result.focus) this.selectedLaneNodeId = result.focus;
    if (this.selectedLaneNodeId && !this.laneDoc.nodes.some((node) => node.id === this.selectedLaneNodeId)) {
      this.selectedLaneNodeId = null;
    }
    this.laneGizmos.setSelectedNode(this.selectedLaneNodeId);
    if (this.selectedLaneNodeId && this.lanesVisible) {
      if (!this.gizmoAdapter?.isDraggingActive()) {
        this.attachGizmoToLaneNode(this.selectedLaneNodeId);
      }
    } else if (this.gizmoAdapter?.isLaneNodeAttached()) {
      this.gizmoAdapter.detach();
    }
    this.notify();
    return { ok: true, focus: result.focus };
  }

  /**
   * The panel's and the keyboard's way in: one edit, and **a refused edit leaves no undo entry**.
   * `applyLaneEditToDoc` stays as it is (it is also what a drag calls, once per frame, with undo
   * pushed once at drag start); this wraps it with the snapshot, so pressing D on a node the tool
   * refuses cannot push an empty step onto the stack.
   */
  applyLaneCommand(edit: LaneEdit): { ok: true; focus?: string } | { ok: false; reason: string } {
    const before = this.snapshot();
    const result = this.applyLaneEditToDoc(edit);
    if (!result.ok) return result;
    this.undoStack.push(before);
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack.length = 0;
    return result;
  }

  /**
   * A path's half width. The edit ops never touch it, so the panel's width control comes here: same
   * contract as an edit — validated, one undo entry, refused means nothing changed.
   */
  setLanePathHalfWidth(pathId: string, halfWidth: number, opts: { pushUndo?: boolean } = {}): { ok: true } | { ok: false; reason: string } {
    if (!this.laneDoc) return { ok: false, reason: 'no_document: there is no lane network loaded' };
    const path = this.laneDoc.paths.find((candidate) => candidate.id === pathId);
    if (!path) return { ok: false, reason: `unknown_path: there is no path ${pathId}` };
    if (halfWidth < LANE_HALF_WIDTH_MIN || halfWidth > LANE_HALF_WIDTH_MAX) {
      return { ok: false, reason: `bad_half_width: ${halfWidth} is outside ${LANE_HALF_WIDTH_MIN}\u2013${LANE_HALF_WIDTH_MAX}` };
    }
    if (path.halfWidth === halfWidth) return { ok: false, reason: `unchanged: ${pathId} is already ${halfWidth} wide` };
    const next: LaneNetwork = {
      ...this.laneDoc,
      paths: this.laneDoc.paths.map((candidate) => (
        candidate.id === pathId ? { ...candidate, halfWidth } : candidate
      )),
    };
    const validation = validateLaneNetwork(next);
    if (!validation.ok) return { ok: false, reason: 'invalid: the runtime refuses this document' };
    if (opts.pushUndo !== false) this.pushUndo();
    this.laneDoc = validation.network;
    this.laneGizmos.setNetwork(this.laneDoc);
    this.laneGizmos.setSelectedNode(this.selectedLaneNodeId);
    this.notify();
    return { ok: true };
  }

  /** The node handle under the pointer, or null. */
  raycastLaneNode(clientX: number, clientY: number, canvas: HTMLCanvasElement): string | null {
    const rect = canvas.getBoundingClientRect();
    this.mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    return this.laneGizmos.raycast(this.raycaster);
  }

  /** The pointer's position as an engine (x, z), on the road. Null when the ray missed the track. */
  lanePointAt(clientX: number, clientY: number, canvas: HTMLCanvasElement): { x: number; z: number } | null {
    const hit = this.raycastSurface(clientX, clientY, canvas);
    if (!hit) return null;
    const point = this.laneGizmos.engineFromWorld(hit.point);
    return { x: point.x, z: point.z };
  }

  attachGizmoToLaneNode(nodeId: string | null) {
    if (!nodeId || !this.laneDoc || !this.gizmoAdapter) {
      if (this.gizmoAdapter?.isLaneNodeAttached()) {
        this.gizmoAdapter.detach();
      }
      return;
    }
    const node = this.laneDoc.nodes.find((n) => n.id === nodeId);
    if (!node) {
      if (this.gizmoAdapter?.isLaneNodeAttached()) {
        this.gizmoAdapter.detach();
      }
      return;
    }
    this.selectedPropIds.clear();
    const worldPos = this.laneGizmos.worldFromEngine(node.x, node.z, 0);
    this.gizmoAdapter.attachLaneNode(
      {
        id: node.id,
        onDragStart: () => {
          this.pushUndo();
        },
        onMove: (pos) => {
          const engine = this.laneGizmos.engineFromWorld(pos);
          const snapped = snapNode(engine.x, engine.z, { lanes: false, grid: true });
          this.applyLaneEditToDoc({ op: 'moveNode', nodeId: node.id, x: snapped.x, z: snapped.z });
        },
        onCommit: () => {
          const current = this.getSelectedLaneNode();
          if (current) {
            const finalWorld = this.laneGizmos.worldFromEngine(current.x, current.z, 0);
            this.gizmoAdapter?.updateLaneNodePosition(finalWorld);
          }
          this.notify();
        },
      },
      worldPos,
    );
  }

  selectLaneNode(nodeId: string | null) {
    this.selectedLaneNodeId = nodeId;
    this.laneGizmos.setSelectedNode(nodeId);
    if (nodeId && this.lanesVisible) {
      this.attachGizmoToLaneNode(nodeId);
    } else if (this.gizmoAdapter?.isLaneNodeAttached()) {
      this.gizmoAdapter.detach();
    }
    this.notify();
  }

  getSelectedLaneNode() {
    return this.laneDoc?.nodes.find((node) => node.id === this.selectedLaneNodeId) ?? null;
  }

  /**
   * Smoothly frames the 3D viewport camera on a lane node, aligned with track direction.
   */
  focusOnLaneNode(nodeId: string) {
    if (!this.laneDoc) return;
    const node = this.laneDoc.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    this.selectLaneNode(nodeId);

    try {
      const worldPos = this.laneGizmos.worldFromEngine(node.x, node.z, 0);
      const ahead = this.laneGizmos.worldFromEngine(Math.min(FINISH, node.x + 120), node.z, 0);
      const behind = this.laneGizmos.worldFromEngine(Math.max(START_X, node.x - 120), node.z, 0);
      const tangent = ahead.clone().sub(behind);
      if (tangent.lengthSq() > 0.001) tangent.normalize();
      else tangent.set(0, 0, 1);

      const camDist = 650;
      const camElev = 350;
      const camPos = worldPos.clone().sub(tangent.clone().multiplyScalar(camDist));
      camPos.y += camElev;

      this.freeFly.x = camPos.x;
      this.freeFly.y = camPos.y;
      this.freeFly.z = camPos.z;
      this.freeFly.yaw = Math.atan2(tangent.x, tangent.z);
      this.freeFly.pitch = -0.4;

      this.camera.position.copy(camPos);
      this.camera.lookAt(worldPos.x, worldPos.y + 40, worldPos.z);
      this.notify();
    } catch {
      // Graceful fallback for mock/headless tests
    }
  }

  /**
   * A drag: pointer → surface → engine (x, z) → `snapNode` → the tool's own `moveNode`. The handle
   * follows whatever the tool decided, so a snapped or refused move lands where the document says.
   * Undo is pushed once, by the caller, at drag start.
   */
  dragLaneNode(
    nodeId: string, clientX: number, clientY: number, canvas: HTMLCanvasElement,
    snap: { lanes: boolean; grid: boolean } = { lanes: true, grid: true },
  ): { ok: true } | { ok: false; reason: string } {
    const point = this.lanePointAt(clientX, clientY, canvas);
    if (!point) return { ok: false, reason: 'off_track: the pointer is not over the track' };
    const snapped = snapNode(point.x, point.z, snap);
    const result = this.applyLaneEditToDoc({ op: 'moveNode', nodeId, x: snapped.x, z: snapped.z });
    return result.ok ? { ok: true } : result;
  }

  /** Writes the network to its own storage document (validate → backup → write, in the storage module). */
  saveLaneDoc(store?: Storage) {
    if (!this.laneDoc) return { ok: false as const, reason: 'empty' as const };
    const doc = buildLaneDocument({ [this.courseId as never]: this.laneDoc });
    const result = writeLaneStorage(store, doc);
    this.notify();
    return result;
  }

  /** Export for the panel's Export button. */
  exportLanes(): string {
    return exportLaneNetworks(buildLaneDocument(this.laneDoc ? { [this.courseId as never]: this.laneDoc } : {}));
  }

  /** Import: everything goes through validation, and a refusal lists the reasons. */
  importLanes(json: string): { ok: true } | { ok: false; errors: { code: string }[] } {
    const imported = importLaneNetworks(json);
    if (!imported.ok) return imported;
    const network = imported.doc.networks[this.courseId as never] ?? null;
    if (!network) return { ok: false, errors: [{ code: 'unknown_course' }] };
    this.setLaneNetwork(network);
    return { ok: true };
  }

  // --- UNDO / REDO (both documents, one stack) ---
  private snapshot(): LaneUndoEntry {
    return {
      props: JSON.stringify(this.placedProps),
      lanes: this.laneDoc ? JSON.stringify(this.laneDoc) : null,
    };
  }

  pushUndo() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snapshot());
    this.restoreEntry(this.undoStack.pop()!);
    this.notify();
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.snapshot());
    this.restoreEntry(this.redoStack.pop()!);
    this.notify();
  }

  /** Puts both documents back. Props keep their own restore path; the lanes redraw in full. */
  private restoreEntry(entry: LaneUndoEntry) {
    this.restorePropsState(JSON.parse(entry.props));
    const lanes = entry.lanes === null ? null : JSON.parse(entry.lanes) as LaneNetwork;
    this.laneDoc = lanes;
    this.laneGizmos.setNetwork(lanes);
    if (!lanes || !lanes.nodes.some((node) => node.id === this.selectedLaneNodeId)) {
      this.selectedLaneNodeId = null;
    }
    this.laneGizmos.setSelectedNode(this.selectedLaneNodeId);
    if (this.selectedLaneNodeId && this.lanesVisible) {
      this.attachGizmoToLaneNode(this.selectedLaneNodeId);
    } else if (this.gizmoAdapter?.isLaneNodeAttached()) {
      this.gizmoAdapter.detach();
    }
  }

  private restorePropsState(props: PlacedProp[]) {
    // Remove current objects (a scenery edit puts its part back before the new state re-applies it)
    for (const prop of [...this.placedProps]) this.removePropObject(prop);
    this.propObjects.forEach((s) => this.scene.remove(s));
    this.propObjects.clear();
    // Prune animated textures for props the restored state no longer holds
    // (surviving ids keep their cached texture: no re-upload on undo/redo).
    const live = new Set(props.map((p) => p.id));
    for (const id of [...this.animTextureCache.keys()]) {
      if (!live.has(id)) this.disposeAnimTexture(id);
    }
    this.selectionBoxes.forEach((box) => this.scene.remove(box));
    this.selectionBoxes.clear();

    this.placedProps = props;
    this.placedProps.forEach((p) => this.createPropSprite(p));
    this.selectProp(null);
    this.saveToStorage();
  }

  /** T08: Strip runtime-only fields before serialization (pickup state, transient markers). */
  private stripRuntimeState(props: PlacedProp[]): PlacedProp[] {
    return stripPropsRuntimeState(props);
  }

  // --- PERSISTENCE & PERIODIC DISK BACKUP ---
  saveToStorage() {
    // T08: Write via versioned storage module (separate key, not protected path)
    const cleanProps = this.stripRuntimeState(this.persistableProps());
    const storageResult = writeStorage(cleanProps, this.courseId);

    if (!storageResult.ok && storageResult.quotaExceeded) {
      // T08: Quota-interrupted saves preserve the last valid feature version via backup
      try {
        restoreFromBackup();
      } catch {
        // Best-effort; backup may also be unavailable
      }
    }

    // Maintain existing backup flow for backward compatibility with disk backups
    try {
      if (this.placedProps.length > 0) {
        const backupEntry = {
          course: this.courseId,
          timestamp: Date.now(),
          count: this.placedProps.length,
          props: cleanProps,
        };
        localStorage.setItem('hm2-3d-track-props-backup-latest', JSON.stringify(backupEntry));

        // Rolling local backup history (up to 5 in localStorage)
        try {
          const rawHist = localStorage.getItem('hm2-3d-track-props-backup-history');
          const hist = rawHist ? JSON.parse(rawHist) : [];
          if (Array.isArray(hist)) {
            hist.unshift({
              course: this.courseId,
              timestamp: Date.now(),
              count: this.placedProps.length,
              props: cleanProps,
            });
            localStorage.setItem('hm2-3d-track-props-backup-history', JSON.stringify(hist.slice(0, 5)));
          }
        } catch {}
      }
    } catch {
      // Storage full or unavailable
    }

    // Schedule debounced disk backup (e.g. 2.5 seconds after user edit)
    this.backups.scheduleDebounced(2500);
  }

  private loadFromStorage() {
    let loaded = false;

    // T08: Read via versioned storage module (validates, preserves unknown fields)
    const storageResult = readStorage();
    if (storageResult.props.length > 0) {
      // Log any notices (migration warnings, validation issues)
      if (storageResult.notices.length > 0) {
        console.warn('[T08 Track Storage]', storageResult.notices.join('; '));
      }
      this.placedProps = storageResult.props;
      this.courseId = storageResult.courseId || this.courseId;
      this.placedProps.forEach((p) => this.createPropSprite(p));
      loaded = true;
    }

    // If empty or missing, try legacy path for backward compatibility
    if (!loaded) {
      try {
        const raw = localStorage.getItem('hm2-3d-track-props');
        if (raw) {
          const props: PlacedProp[] = JSON.parse(raw);
          if (Array.isArray(props) && props.length > 0) {
            this.placedProps = props;
            this.placedProps.forEach((p) => this.createPropSprite(p));
            loaded = true;
          }
        }
      } catch {
        // Invalid JSON
      }
    }

    // If still empty, try browser local backup
    if (!loaded) {
      try {
        const rawBackup = localStorage.getItem('hm2-3d-track-props-backup-latest');
        if (rawBackup) {
          const parsed = JSON.parse(rawBackup);
          const props: PlacedProp[] = Array.isArray(parsed) ? parsed : parsed.props;
          if (Array.isArray(props) && props.length > 0) {
            this.placedProps = props;
            this.placedProps.forEach((p) => this.createPropSprite(p));
            loaded = true;
          }
        }
      } catch {}
    }

    // If still no props, bootstrap immediately with default track decorations
    if (!loaded) {
      this.placedProps = JSON.parse(JSON.stringify(DEFAULT_TRACK_PROPS));
      this.placedProps.forEach((p) => this.createPropSprite(p));
      this.saveToStorage();
      loaded = true;
    }

    // Sync latest from disk in background
    this.syncLatestFromDisk();
  }

  private async syncLatestFromDisk() {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch('/api/backup-props');
      if (!res.ok) return;
      const data = await res.json();
      const diskProps = data?.latest?.props;
      if (Array.isArray(diskProps)) {
        // What the disk already holds: the auto-backup skips a save that would write the same props.
        this.backups.markDiskState(diskProps, data.latest.course ?? this.courseId);
      }
      if (Array.isArray(diskProps) && diskProps.length > 0) {
        // If scene only has default starter items or disk has a richer/newer set of decorations
        if (this.placedProps.length === 0 || this.placedProps.length === DEFAULT_TRACK_PROPS.length || diskProps.length > this.placedProps.length) {
          this.restorePropsState(diskProps);
          this.notify();
        }
      }
    } catch {
      // Offline / standalone preview
    }
  }

  /**
   * Writes the props to the dev server's disk backup. An automatic save (`force = false`) is skipped
   * when the props match what the disk already holds, so an idle builder sends nothing (M12).
   * An explicit save (`force = true`) always writes.
   */
  async backupToFile(force = false): Promise<{ success: boolean; count: number; timestamp: number; unchanged?: boolean } | null> {
    return this.backups.backupToFile(force);
  }

  async fetchBackups(): Promise<{ latest: any; history: any[]; localHistory: any[] }> {
    return this.backups.list();
  }

  async restoreBackupFile(filename: string): Promise<boolean> {
    try {
      const props = await this.backups.fetchHistoryFile(filename);
      if (props) {
        this.pushUndo();
        this.restorePropsState(props);
        this.notify();
        await this.backupToFile(true);
        return true;
      }
    } catch (e) {
      console.error('Failed to restore backup file:', e);
    }
    return false;
  }

  async restoreDefaultPreset(): Promise<boolean> {
    this.pushUndo();
    this.restorePropsState(JSON.parse(JSON.stringify(DEFAULT_TRACK_PROPS)));
    this.notify();
    await this.backupToFile(true);
    return true;
  }

  exportJson(): string {
    // T08: Use versioned export with unknown-field preservation
    const cleanProps = this.stripRuntimeState(this.placedProps);
    return exportTrackStorage(cleanProps, this.courseId);
  }

  importJson(jsonStr: string) {
    // T08: Use versioned import with validation, but support legacy plain arrays
    try {
      const parsed = JSON.parse(jsonStr);
      
      // Backward compatibility: if it's a plain array, treat it as props
      if (Array.isArray(parsed)) {
        this.pushUndo();
        this.restorePropsState(parsed);
        this.notify();
        this.backupToFile(true);
        return;
      }
      
      // Otherwise, use versioned import
      const result = importTrackStorage(jsonStr);
      
      if (result.errors.length > 0) {
        console.error('[T08 Track Storage] Import failed:', result.errors);
        return;
      }
      
      if (result.warnings.length > 0) {
        console.warn('[T08 Track Storage] Import warnings:', result.warnings);
      }

      if (result.props.length > 0) {
        this.pushUndo();
        this.courseId = result.courseId || this.courseId;
        this.restorePropsState(result.props);
        this.notify();
        this.backupToFile(true);
      }
    } catch (e) {
      console.error('Failed to import track props JSON:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // SCENE KIT — lights, primitives, scenery edits and the shader library
  // ---------------------------------------------------------------------------

  /** The one way a prop's object leaves the scene: kit props go through the kit (a scenery edit puts its part back). */
  private removePropObject(prop: PlacedProp | undefined) {
    if (!prop) return;
    const obj = this.propObjects.get(prop.id);
    if (isKitType(prop.type)) this.kit.release(prop, obj);
    else if (obj) this.scene.remove(obj);
    this.propObjects.delete(prop.id);
  }

  /** Every prop's object rebuilt (all released first, so no scenery part is wrapped twice). */
  private rebuildPropObjects() {
    for (const prop of this.placedProps) this.removePropObject(prop);
    this.propObjects.forEach((o) => this.scene.remove(o));
    this.propObjects.clear();
    this.placedProps.forEach((p) => this.createPropSprite(p));
  }

  /** What is saved and backed up: everything except scenery edits that change nothing. */
  private persistableProps(): PlacedProp[] {
    if (!this.kit) return this.placedProps;
    return this.placedProps.filter((p) => !(isTerrainEdit(p) && this.kit.isNoOpEdit(p)));
  }

  /** A scenery part that was clicked but never changed is dropped once it is no longer selected. */
  private pruneNoOpTerrainEdits() {
    if (!this.kit) return;
    for (let i = this.placedProps.length - 1; i >= 0; i--) {
      const p = this.placedProps[i];
      if (!isTerrainEdit(p) || this.selectedPropIds.has(p.id) || !this.kit.isNoOpEdit(p)) continue;
      this.removePropObject(p);
      const box = this.selectionBoxes.get(p.id);
      if (box) { this.scene.remove(box); this.selectionBoxes.delete(p.id); }
      this.placedProps.splice(i, 1);
    }
  }

  /** Primitives mode: clicks on the course's own scenery select it. */
  setTerrainPicking(on: boolean) {
    if (this.terrainPicking === on) return;
    this.terrainPicking = on;
    if (!on && this.getSelectedProps().some((p) => isTerrainEdit(p))) this.selectProp(null);
  }

  getTerrainPicking(): boolean { return this.terrainPicking; }

  /** The scenery part under the pointer, as its (possibly new) scenery edit, selected. */
  pickTerrain(clientX: number, clientY: number, canvas: HTMLCanvasElement, multi = false): PlacedProp | null {
    const rect = canvas.getBoundingClientRect();
    this.mouseNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const part = this.kit.pickScenery(this.raycaster);
    if (!part) return null;
    let prop = this.placedProps.find((p) => isTerrainEdit(p) && p.terrainKey === part.key);
    if (!prop) {
      prop = { id: `terrain_${part.key}_${Date.now().toString(36)}`, ...this.kit.newEditFields(part) } as PlacedProp;
      this.placedProps.push(prop);
      this.createPropSprite(prop);
    }
    this.selectProp(prop.id, multi);
    return prop;
  }

  /** The scenery edits, for the Primitives panel. */
  getTerrainEdits(): { prop: PlacedProp; hidden: boolean; moved: boolean; shaded: boolean; orphan: boolean; locked: boolean }[] {
    return this.placedProps.filter((p) => isTerrainEdit(p) && !this.kit.isNoOpEdit(p)).map((p) => {
      const o = p.terrainOrigin as [number, number, number] | undefined;
      const moved = !!o && (Math.abs(p.x - o[0]) >= 1 || Math.abs(p.y - o[1]) >= 1 || Math.abs(p.z - o[2]) >= 1
        || Math.abs(p.rotY ?? 0) > 1e-4 || Math.abs(p.rotX ?? 0) > 1e-4 || Math.abs(p.rotZ ?? 0) > 1e-4 || Math.abs((p.scale || 1) - 1) > 1e-4);
      return { prop: p, hidden: !!p.terrainHidden, moved, shaded: !!p.shader, orphan: !this.kit.editMatches(p), locked: this.kit.isLockedEdit(p) };
    });
  }

  /** Puts one scenery part back exactly as generated (removes its edit). */
  resetTerrainEdit(id: string) {
    const prop = this.placedProps.find((p) => p.id === id);
    if (prop && isTerrainEdit(prop)) this.deleteProp(id);
  }

  /** Shows a hidden part again (keeping any move or shader). */
  unhideTerrainEdit(id: string) {
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop || !isTerrainEdit(prop) || !prop.terrainHidden) return;
    this.pushUndo();
    delete prop.terrainHidden;
    const obj = this.propObjects.get(id);
    if (obj) this.kit.applyTransform(prop, obj);
    this.saveToStorage();
    this.notify();
  }

  /** Shows every hidden part again. Returns how many. */
  unhideAllTerrain(): number {
    const hidden = this.placedProps.filter((p) => isTerrainEdit(p) && p.terrainHidden);
    if (!hidden.length) return 0;
    this.pushUndo();
    for (const prop of hidden) {
      delete prop.terrainHidden;
      const obj = this.propObjects.get(prop.id);
      if (obj) this.kit.applyTransform(prop, obj);
    }
    this.pruneNoOpTerrainEdits();
    this.saveToStorage();
    this.notify();
    return hidden.length;
  }

  /* Shaders */

  getShaderLibrary(): readonly ShaderDef[] { return this.shaderLibrary; }

  shaderUsage(id: string): number {
    return this.placedProps.filter((p) => (p.shader as ShaderDef | undefined)?.id === id).length;
  }

  private lastShaderEditAt = 0;
  private shaderSaveTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Adds or updates a library shader. Live materials change at once; every prop wearing it gets the
   * new inline copy. A burst of edits (a slider drag) is one undo step and one save.
   */
  saveShader(def: ShaderDef) {
    const shader = normalizeShader(def);
    const now = Date.now();
    const users = this.placedProps.filter((p) => (p.shader as ShaderDef | undefined)?.id === shader.id);
    if (users.length && now - this.lastShaderEditAt > 1500) this.pushUndo();
    this.lastShaderEditAt = now;
    const i = this.shaderLibrary.findIndex((x) => x.id === shader.id);
    if (i >= 0) this.shaderLibrary[i] = shader; else this.shaderLibrary.push(shader);
    saveShaderLibrary(this.shaderLibrary);
    for (const p of users) p.shader = shader;
    this.kit.refreshShader(shader);
    if (users.length) {
      if (this.shaderSaveTimer) clearTimeout(this.shaderSaveTimer);
      this.shaderSaveTimer = setTimeout(() => { this.shaderSaveTimer = null; this.saveToStorage(); }, 600);
    }
    this.notify();
  }

  /** Removes a shader from the library, unless something still wears it. */
  deleteShader(id: string): { ok: true } | { ok: false; reason: string } {
    const used = this.shaderUsage(id);
    if (used) return { ok: false, reason: `${used} object${used === 1 ? '' : 's'} still wear this shader. Give them another one first.` };
    this.shaderLibrary = this.shaderLibrary.filter((x) => x.id !== id);
    if (this.activeShaderId === id) this.activeShaderId = null;
    saveShaderLibrary(this.shaderLibrary);
    this.notify();
    return { ok: true };
  }

  /** The shader new primitives are placed with. */
  setActiveShader(id: string | null) { this.activeShaderId = id; this.notify(); }
  getActiveShader(): string | null { return this.activeShaderId; }

  /** Dresses the selected primitives and scenery parts with a shader (null takes it off). Returns how many. */
  applyShaderToSelected(id: string | null): number {
    const targets = this.getSelectedProps().filter((p) => isPrimitiveType(p.type) || isTerrainEdit(p));
    const def = id ? this.shaderLibrary.find((x) => x.id === id) : null;
    if (!targets.length || (id && !def)) return 0;
    this.pushUndo();
    for (const p of targets) {
      if (def) p.shader = normalizeShader(def); else delete p.shader;
      const obj = this.propObjects.get(p.id);
      if (obj) this.kit.applyTransform(p, obj);
    }
    this.pruneNoOpTerrainEdits();
    this.saveToStorage();
    this.notify();
    return targets.length;
  }

  /* Lights */

  /** Changes the selected lights' settings (colour, brightness, reach, cone, flicker, kind). */
  updateSelectedLights(changes: Record<string, unknown>) {
    const lights = this.getSelectedProps().filter((p) => isLightType(p.type));
    if (!lights.length) return;
    this.pushUndo();
    for (const p of lights) this.updatePropTransform(p.id, { light: { ...lightSettingsFor(p), ...changes } }, false);
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  /** How many placed lights there are, and how many shine right now (the rig's slots). */
  lightStats(): { placed: number; lit: number } { return { placed: this.kit.lights.count, lit: this.kit.lights.lit }; }

  /* Scene-wide tile randomiser and the underground preview */

  getSceneryTileRandomization() { return this.kit.tileRandomization; }
  setSceneryTileRandomization(on: boolean, variation?: number) { this.kit.setSceneryTileRandomization(on, variation); this.notify(); }

  /** Builder only: the renderer darkens the underground around the camera like a race does. */
  previewAtmosphere = true;

  /** Track distance of the sample nearest the camera (for the underground preview). */
  cameraTrackDistance(): number {
    const samples = this.track.samples;
    if (!samples?.length) return 0;
    const eye = this.camera.position;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < samples.length; i += 4) {
      const d = samples[i].pos.distanceToSquared(eye);
      if (d < bestD) { bestD = d; best = i; }
    }
    return samples[best].dist;
  }

  clearAll() {
    this.pushUndo();
    this.restorePropsState([]);
    this.notify();
  }

  destroy() {
    this.backups.destroy();
    if (this.ghostSprite) this.scene.remove(this.ghostSprite);
    if (this.ghostMesh) this.scene.remove(this.ghostMesh);
    this.selectionBoxes.forEach((box) => this.scene.remove(box));
    this.selectionBoxes.clear();
    if (this.rotationHandle) this.scene.remove(this.rotationHandle);
    for (const prop of [...this.placedProps]) this.removePropObject(prop);
    this.propObjects.forEach((s) => this.scene.remove(s));
    this.propObjects.clear();
    this.kit.dispose();
    for (const id of [...this.animTextureCache.keys()]) this.disposeAnimTexture(id);
    if (this.gizmoAdapter) {
      this.gizmoAdapter.dispose();
      this.gizmoAdapter = null;
    }
    this.listeners.length = 0;
  }
}
