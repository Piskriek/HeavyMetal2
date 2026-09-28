/**
 * IF-GIZMO: GizmoAdapter wrapping Three.js TransformControls behind a pivot proxy.
 * Encapsulates handle picking and drag deltas; delegates snapping and space to gizmo-math.
 */

import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { CommandStack } from './history';
import {
  constrainedDelta,
  pivotOf,
  type GizmoMode,
  type GizmoSpace,
  type SnapConfig,
  type GizmoFrame,
  type Transformable,
} from './gizmo-math';

export interface LaneNodeGizmoTarget {
  id: string;
  onDragStart?: () => void;
  onMove?: (worldPos: THREE.Vector3) => void;
  onCommit?: () => void;
}

export class GizmoAdapter<T extends Transformable & { id: string }> {
  readonly controls: TransformControls;
  readonly helper: THREE.Object3D;
  readonly proxy: THREE.Object3D;
  private readonly scene: THREE.Scene;
  private readonly history: CommandStack<T>;
  private mode: GizmoMode = 'translate';
  private space: GizmoSpace = 'world';
  private snap: SnapConfig = {
    grid: 0,
    angleDeg: 0,
    scaleStep: 0,
    surface: false,
    centerline: false,
  };

  private selectedItems: T[] = [];
  private laneNodeTarget: LaneNodeGizmoTarget | null = null;
  private dragStartPivot = new THREE.Vector3();
  private dragStartProps = new Map<string, { x: number; y: number; z: number; rotY?: number; scale: number }>();
  private isDragging = false;
  private changeCallbacks: ((items: readonly T[]) => void)[] = [];
  private dragCallbacks: ((dragging: boolean) => void)[] = [];

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement,
    scene: THREE.Scene,
    history: CommandStack<T>,
  ) {
    this.scene = scene;
    this.history = history;

    this.proxy = new THREE.Object3D();
    this.proxy.name = 'GizmoPivotProxy';
    this.scene.add(this.proxy);

    this.controls = new TransformControls(camera, domElement);
    this.controls.size = 0.85;

    // In Three.js r169+, TransformControls helper is separate from controls
    this.helper = typeof (this.controls as any).getHelper === 'function'
      ? (this.controls as any).getHelper()
      : this.controls;
    this.scene.add(this.helper);

    this.controls.attach(this.proxy);
    this.helper.visible = false;
    this.controls.enabled = false;

    this.setupListeners();
  }

  private setupListeners(): void {
    this.controls.addEventListener('dragging-changed', (event: any) => {
      const dragging = Boolean(event.value);
      this.isDragging = dragging;

      for (const cb of this.dragCallbacks) {
        cb(dragging);
      }

      if (this.laneNodeTarget) {
        if (dragging) {
          this.dragStartPivot.copy(this.proxy.position);
          this.laneNodeTarget.onDragStart?.();
        } else {
          this.laneNodeTarget.onCommit?.();
          this.notifyChange();
        }
        return;
      }

      if (dragging) {
        this.dragStartPivot.copy(this.proxy.position);
        this.dragStartProps.clear();
        for (const item of this.selectedItems) {
          this.dragStartProps.set(item.id, {
            x: item.x,
            y: item.y,
            z: item.z,
            rotY: item.rotY,
            scale: item.scale,
          });
        }
        this.history.begin(this.mode, this.selectedItems);
      } else {
        this.history.commit(this.selectedItems);
        this.updateProxyTransform();
        this.notifyChange();
      }
    });

    this.controls.addEventListener('objectChange', () => {
      if (!this.isDragging) return;

      if (this.laneNodeTarget) {
        this.laneNodeTarget.onMove?.(this.proxy.position);
        this.notifyChange();
        return;
      }

      if (this.selectedItems.length === 0) return;

      if (this.mode === 'translate') {
        const rawDelta = new THREE.Vector3().subVectors(this.proxy.position, this.dragStartPivot);
        const frame: GizmoFrame = {
          origin: this.dragStartPivot,
          axes: [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 1),
          ],
        };

        const delta = constrainedDelta(
          rawDelta,
          frame,
          'xyz',
          this.space,
          this.snap,
          this.dragStartPivot,
        );

        for (const item of this.selectedItems) {
          const start = this.dragStartProps.get(item.id);
          if (start) {
            item.x = start.x + delta.x;
            item.y = start.y + delta.y;
            item.z = start.z + delta.z;
          }
        }
      } else if (this.mode === 'rotate') {
        const rotDelta = this.proxy.rotation.y;
        for (const item of this.selectedItems) {
          const start = this.dragStartProps.get(item.id);
          if (start) {
            item.rotY = (start.rotY ?? 0) + rotDelta;
          }
        }
      } else if (this.mode === 'scale') {
        const scaleFactor = Math.max(0.1, this.proxy.scale.x);
        for (const item of this.selectedItems) {
          const start = this.dragStartProps.get(item.id);
          if (start) {
            item.scale = Math.max(0.1, start.scale * scaleFactor);
          }
        }
      }

      this.notifyChange();
    });
  }

  setMode(mode: GizmoMode): void {
    if (this.laneNodeTarget) {
      this.mode = 'translate';
      this.controls.setMode('translate');
      return;
    }
    this.mode = mode;
    this.controls.setMode(mode);
  }

  getMode(): GizmoMode {
    return this.mode;
  }

  setSpace(space: GizmoSpace): void {
    this.space = space;
    this.controls.setSpace(space === 'local' ? 'local' : 'world');
    this.updateProxyTransform();
  }

  cycleSpace(): GizmoSpace {
    const next: GizmoSpace =
      this.space === 'world' ? 'local' : this.space === 'local' ? 'track' : 'world';
    this.setSpace(next);
    return next;
  }

  getSpace(): GizmoSpace {
    return this.space;
  }

  setSnap(config: Partial<SnapConfig>): void {
    this.snap = { ...this.snap, ...config };
  }

  getSnap(): SnapConfig {
    return { ...this.snap };
  }

  updateSelection(items: T[]): void {
    this.selectedItems = items;

    if (items.length === 0) {
      this.helper.visible = false;
      this.controls.enabled = false;
      return;
    }

    this.helper.visible = true;
    this.controls.enabled = true;
    this.updateProxyTransform();
  }

  private updateProxyTransform(): void {
    if (this.selectedItems.length === 0) return;

    const pivot = pivotOf(this.selectedItems, 'centroid');
    this.proxy.position.copy(pivot);
    this.proxy.scale.set(1, 1, 1);

    if (this.space === 'local' && this.selectedItems.length === 1) {
      this.proxy.rotation.set(0, this.selectedItems[0].rotY ?? 0, 0);
    } else {
      this.proxy.rotation.set(0, 0, 0);
    }
  }

  attach(items: T[]): void {
    this.laneNodeTarget = null;
    this.updateSelection(items);
  }

  attachLaneNode(target: LaneNodeGizmoTarget, worldPos: THREE.Vector3): void {
    this.selectedItems = [];
    this.laneNodeTarget = target;
    this.mode = 'translate';
    this.controls.setMode('translate');
    this.proxy.position.copy(worldPos);
    this.proxy.rotation.set(0, 0, 0);
    this.proxy.scale.set(1, 1, 1);
    this.helper.visible = true;
    this.controls.enabled = true;
  }

  updateLaneNodePosition(worldPos: THREE.Vector3): void {
    if (this.laneNodeTarget && !this.isDragging) {
      this.proxy.position.copy(worldPos);
    }
  }

  isLaneNodeAttached(): boolean {
    return Boolean(this.laneNodeTarget);
  }

  isHovered(): boolean {
    return Boolean((this.controls as any).axis);
  }

  isInteracting(): boolean {
    return this.isDragging || Boolean((this.controls as any).axis);
  }

  detach(): void {
    this.laneNodeTarget = null;
    this.updateSelection([]);
  }

  isDraggingActive(): boolean {
    return this.isDragging;
  }

  cancelDrag(): void {
    if (!this.isDragging) return;
    if (this.laneNodeTarget) {
      this.proxy.position.copy(this.dragStartPivot);
      this.laneNodeTarget.onMove?.(this.proxy.position);
      this.laneNodeTarget.onCommit?.();
      this.isDragging = false;
      for (const cb of this.dragCallbacks) {
        cb(false);
      }
      this.notifyChange();
      return;
    }
    this.history.cancel();
    for (const item of this.selectedItems) {
      const start = this.dragStartProps.get(item.id);
      if (start) {
        item.x = start.x;
        item.y = start.y;
        item.z = start.z;
        if (start.rotY !== undefined) item.rotY = start.rotY;
        item.scale = start.scale;
      }
    }
    this.isDragging = false;
    for (const cb of this.dragCallbacks) {
      cb(false);
    }
    this.updateProxyTransform();
    this.notifyChange();
  }

  onDrag(callback: (dragging: boolean) => void): () => void {
    return this.onDraggingChanged(callback);
  }

  onDraggingChanged(callback: (dragging: boolean) => void): () => void {
    this.dragCallbacks.push(callback);
    return () => {
      this.dragCallbacks = this.dragCallbacks.filter((cb) => cb !== callback);
    };
  }

  onChange(callback: (items: readonly T[]) => void): () => void {
    this.changeCallbacks.push(callback);
    return () => {
      this.changeCallbacks = this.changeCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notifyChange(): void {
    for (const cb of this.changeCallbacks) {
      cb(this.selectedItems);
    }
  }

  dispose(): void {
    this.controls.dispose();
    const helper = typeof (this.controls as any).getHelper === 'function'
      ? (this.controls as any).getHelper()
      : this.controls;
    this.scene.remove(helper);
    this.scene.remove(this.proxy);
    this.changeCallbacks = [];
    this.dragCallbacks = [];
  }
}
