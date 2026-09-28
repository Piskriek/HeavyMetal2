/**
 * NewSculpt — mesh painting mode: sculpt the terrain and placed 3D objects with brushes, and paint
 * their vertices.
 *
 * **Targets.** A stroke starts on whatever mesh is under the pointer. If it belongs to a placed prop
 * (a Meshy model, a primitive) that prop owns the sculpt. If it is the course's own scenery (the
 * heightfield, cliffs, cave walls, the island terrain) the builder's `pickTerrain` gives — or makes —
 * the `terrain_edit` prop for that part, the same override record a moved or re-shaded part uses, and
 * the sculpt rides on it. The road surface is locked (it shows the race line) and refuses the brush.
 * Sprites (the painted PNG props) have nothing to sculpt.
 *
 * **Strokes and undo.** `host.beginSculpt()` (the builder's `pushUndo`) opens one undo step; the stamps
 * land live; at pointer-up the meshes are diffed against their generated shape and the sparse document
 * is written to `prop.sculpt` through `host.commitSculpt`, which saves. Ctrl+Z restores the prop, and
 * `sync()` notices the document changed and puts the geometry back to match.
 *
 * **Sync.** `sync()` runs on every builder change and once at construction — with no canvas at all,
 * which is how a race (where the builder exists but its UI does not) still shows the sculpts. For each
 * prop with a document whose live object exists: if the object or the document's hash is not what was
 * applied last time, reset to the generated shape and apply. For each applied entry whose prop is gone
 * or has no document any more (undo, reset, delete): reset. Kit models arrive asynchronously; the
 * builder calls `syncProp` from `onModelLoaded`.
 */
import * as THREE from 'three';
import type { PlacedProp } from '../builder/prop-catalog';
import {
  DEFAULT_BRUSH, SCULPT_TOOLS, applyGrab, applyStamp, captureGrab, toolForKey, type BrushParams, type GrabCapture, type SculptToolId,
} from './sculpt-brushes';
import { isSculptDoc, makeSculptDoc, sculptDocBytes, SCULPT_QUANTUM, type SculptDoc } from './sculpt-doc';
import { SculptMesh, meshKey, sculptableMeshes } from './sculpt-mesh';

/** What the tool needs from the builder. */
export interface SculptHost {
  getProps(): readonly PlacedProp[];
  /** The live object for a prop id (a model group, a primitive mesh, the pivot around a scenery part). */
  sculptObjectFor(id: string): THREE.Object3D | null;
  /** Scenery that must keep its shape (the road surface). */
  isSculptLocked(prop: PlacedProp): boolean;
  /** The course's own scenery under the pointer, as its (possibly new) `terrain_edit` prop. */
  pickTerrain(clientX: number, clientY: number, canvas: HTMLCanvasElement): PlacedProp | null;
  /** A stroke starts: open one undo step. */
  beginSculpt(): void;
  /** A stroke ended: store (or clear) the prop's document and save. */
  commitSculpt(id: string, doc: SculptDoc | null): void;
  onChange(cb: () => void): () => void;
}

interface Applied {
  root: THREE.Object3D;
  hash: string;
  meshes: SculptMesh[];
}

interface Stroke {
  prop: PlacedProp;
  entry: Applied;
  last: THREE.Vector3;
  grab: { plane: THREE.Plane; origin: THREE.Vector3; captured: GrabCapture[] } | null;
  stamps: number;
}

export interface SculptTargetInfo {
  id: string;
  name: string;
  meshes: number;
  vertices: number;
  changed: number;
  bytes: number;
}

const SKIP_NAMES = new Set(['Sky', 'MistZone', 'DebugMarkers', 'GizmoPivotProxy', 'LaneGizmos', 'LaneHandles', 'DecalSideHandlesGroup', 'RotationHandleGroup', 'LanePaint', 'RoadSurfacePaint', 'GroundBrush', 'DecorBrush', 'SculptBrush', 'GhostKitModel']);
const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);

function excluded(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (!o.visible || SKIP_NAMES.has(o.name) || o.name.startsWith('TransformControls') || o.userData?.isKitGhost) return true;
  }
  return false;
}

export class SculptTool {
  readonly brush: BrushParams = { ...DEFAULT_BRUSH };
  readonly tools = SCULPT_TOOLS;
  status = '';
  private enabled = false;
  private dom: HTMLElement | null = null;
  private stroke: Stroke | null = null;
  private shiftHeld = false;
  private ctrlHeld = false;
  private lastTargetId: string | null = null;
  private readonly applied = new Map<string, Applied>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly ring: THREE.Mesh;
  private readonly viewDir = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private listeners: (() => void)[] = [];
  private readonly unsubscribe: () => void;

  constructor(
    private readonly host: SculptHost,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    dom: HTMLElement | null,
  ) {
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0xff9f43, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ring.name = 'SculptBrush';
    this.ring.renderOrder = 999;
    this.ring.visible = false;
    scene.add(this.ring);
    this.unsubscribe = host.onChange(() => this.sync());
    if (dom) this.attach(dom);
    this.sync();
  }

  /** The canvas the brush listens on (the builder's gizmo canvas). Capture phase, so a consumed stroke never reaches the builder's own handlers. */
  attach(dom: HTMLElement): void {
    if (this.dom) this.detach();
    this.dom = dom;
    dom.addEventListener('pointerdown', this.onDown, { capture: true });
    dom.addEventListener('pointermove', this.onMove, { capture: true });
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerup', this.onUp, { capture: true });
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
    }
  }

  detach(): void {
    if (!this.dom) return;
    this.dom.removeEventListener('pointerdown', this.onDown, { capture: true });
    this.dom.removeEventListener('pointermove', this.onMove, { capture: true });
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', this.onUp, { capture: true });
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
    }
    this.dom = null;
  }

  /* ───────────── panel state ───────────── */

  get isEnabled(): boolean { return this.enabled; }

  onChange(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }
  private notify() { for (const cb of this.listeners) cb(); }

  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    this.stroke = null;
    this.ring.visible = false;
    this.status = on ? 'Drag on terrain or a 3D object. Shift inverts, Ctrl smooths, [ ] radius.' : '';
    this.notify();
  }

  setTool(tool: SculptToolId): void { this.brush.tool = tool; this.notify(); }

  setBrush(changes: Partial<BrushParams>): void {
    Object.assign(this.brush, changes);
    this.brush.radius = Math.max(10, Math.min(6000, this.brush.radius));
    this.brush.strength = Math.max(0.02, Math.min(1, this.brush.strength));
    this.brush.hardness = Math.max(0, Math.min(1, this.brush.hardness));
    this.notify();
  }

  /** The last object sculpted or hovered, described for the panel. */
  target(): SculptTargetInfo | null {
    const id = this.lastTargetId;
    if (!id) return null;
    return this.describe(id);
  }

  describe(id: string): SculptTargetInfo | null {
    const prop = this.host.getProps().find((p) => p.id === id);
    if (!prop) return null;
    const entry = this.applied.get(id);
    const doc = isSculptDoc(prop.sculpt) ? prop.sculpt : null;
    let vertices = 0, changed = 0;
    if (entry) for (const m of entry.meshes) { vertices += m.count; changed += m.changedCount(m.localQuantum()); }
    return { id, name: prop.name, meshes: entry?.meshes.length ?? 0, vertices, changed, bytes: doc ? sculptDocBytes(doc) : 0 };
  }

  /** Every prop carrying a sculpt document. */
  sculpted(): SculptTargetInfo[] {
    const out: SculptTargetInfo[] = [];
    for (const prop of this.host.getProps()) if (isSculptDoc(prop.sculpt)) { const d = this.describe(prop.id); if (d) out.push(d); }
    return out;
  }

  /** Puts one object back to its generated shape (one undo step). */
  reset(id: string): boolean {
    const prop = this.host.getProps().find((p) => p.id === id);
    if (!prop) return false;
    this.host.beginSculpt();
    const entry = this.applied.get(id);
    if (entry) for (const m of entry.meshes) m.reset();
    this.applied.delete(id);
    this.host.commitSculpt(id, null);
    this.status = `${prop.name}: back to its generated shape.`;
    this.notify();
    return true;
  }

  /* ───────────── sync: documents ↔ live geometry ───────────── */

  syncProp(_id: string): void { this.sync(); }

  sync(): void {
    const props = this.host.getProps();
    const byId = new Map(props.map((p) => [p.id, p] as const));
    for (const [id, entry] of this.applied) {
      const prop = byId.get(id);
      if (prop && isSculptDoc(prop.sculpt)) continue;
      if (this.stroke?.prop.id === id) continue;
      for (const m of entry.meshes) m.reset();
      this.applied.delete(id);
    }
    for (const prop of props) {
      const doc = prop.sculpt;
      if (!isSculptDoc(doc)) continue;
      if (this.stroke?.prop.id === prop.id) continue;
      const root = this.host.sculptObjectFor(prop.id);
      if (!root) continue;
      const entry = this.applied.get(prop.id);
      const meshes = sculptableMeshes(root);
      // Also stale when meshes arrived since (the island terrain model lands after the beach and sea).
      if (entry && entry.root === root && entry.hash === doc.hash && entry.meshes.length === meshes.length && entry.meshes.every((m) => m.mesh.geometry === m.geometry)) continue;
      if (!meshes.length) continue; // a model still loading: syncProp comes when it lands
      if (entry) for (const m of entry.meshes) m.reset();
      const wrapped = meshes.map((m) => SculptMesh.wrap(m));
      wrapped.forEach((w, i) => {
        const key = meshKey(i, w.mesh);
        const part = doc.meshes.find((d) => d.key === key);
        if (part && !w.applyDoc(part, doc.quantum)) console.warn(`[sculpt] ${prop.name}: document for ${key} does not fit this mesh`);
      });
      this.applied.set(prop.id, { root, hash: doc.hash, meshes: wrapped });
    }
  }

  /* ───────────── targets ───────────── */

  private hit(event: PointerEvent): THREE.Intersection | null {
    if (!this.dom) return null;
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const h of this.raycaster.intersectObjects(this.scene.children, true)) {
      const mesh = h.object as THREE.Mesh;
      if (!mesh.isMesh || (h.object as unknown as THREE.Sprite).isSprite || excluded(h.object)) continue;
      return h;
    }
    return null;
  }

  /** The prop whose object contains `object`, if any. */
  private propOf(object: THREE.Object3D): PlacedProp | null {
    const owners = new Map<THREE.Object3D, PlacedProp>();
    for (const p of this.host.getProps()) { const o = this.host.sculptObjectFor(p.id); if (o) owners.set(o, p); }
    for (let o: THREE.Object3D | null = object; o; o = o.parent) { const p = owners.get(o); if (p) return p; }
    return null;
  }

  /** Wraps (and, if it has a document, applies) the target's meshes, ready for a stroke. */
  private entryFor(prop: PlacedProp): Applied | null {
    const root = this.host.sculptObjectFor(prop.id);
    if (!root) return null;
    const existing = this.applied.get(prop.id);
    if (existing && existing.root === root && existing.meshes.every((m) => m.mesh.geometry === m.geometry)) return existing;
    this.sync();
    const after = this.applied.get(prop.id);
    if (after && after.root === root) return after;
    const meshes = sculptableMeshes(root);
    if (!meshes.length) return null;
    const entry: Applied = { root, hash: '', meshes: meshes.map((m) => SculptMesh.wrap(m)) };
    this.applied.set(prop.id, entry);
    return entry;
  }

  /* ───────────── strokes ───────────── */

  private effective(): BrushParams {
    return { ...this.brush, tool: this.ctrlHeld && this.brush.tool !== 'grab' ? 'smooth' : this.brush.tool, invert: this.brush.invert !== this.shiftHeld };
  }

  private stamp(point: THREE.Vector3) {
    const stroke = this.stroke!;
    const params = this.effective();
    this.camera.getWorldDirection(this.viewDir);
    for (const mesh of stroke.entry.meshes) {
      mesh.syncMatrices();
      const hits = mesh.query(point, params.radius);
      if (!hits.length) continue;
      const touched = applyStamp({ mesh, centre: point, viewDir: this.viewDir, params, hits });
      mesh.recomputeNormals(touched);
      mesh.position.needsUpdate = true;
    }
    stroke.stamps++;
  }

  private readonly onDown = (event: PointerEvent) => {
    if (!this.enabled || event.button !== 0 || !this.dom) return;
    const hit = this.hit(event);
    if (!hit) return;
    let prop = this.propOf(hit.object);
    if (!prop) prop = this.host.pickTerrain(event.clientX, event.clientY, this.dom as HTMLCanvasElement);
    if (!prop) { this.status = 'Nothing sculptable there.'; this.notify(); return; }
    if (this.host.isSculptLocked(prop)) { this.status = `${prop.name} shows the race line and cannot be sculpted.`; this.notify(); return; }
    const entry = this.entryFor(prop);
    if (!entry) { this.status = `${prop.name} has no mesh to sculpt (a painted sprite?).`; this.notify(); return; }
    event.preventDefault();
    event.stopImmediatePropagation(); // the builder listens on the same canvas: it must not also select or place
    this.host.beginSculpt();
    this.lastTargetId = prop.id;
    const point = hit.point.clone();
    this.stroke = { prop, entry, last: point, grab: null, stamps: 0 };
    if (this.effective().tool === 'grab') {
      this.camera.getWorldDirection(this.viewDir);
      const captured: GrabCapture[] = [];
      for (const mesh of entry.meshes) { mesh.syncMatrices(); captured.push(...captureGrab(mesh, mesh.query(point, this.brush.radius), this.effective())); }
      this.stroke.grab = { plane: new THREE.Plane().setFromNormalAndCoplanarPoint(this.viewDir.clone().negate(), point), origin: point.clone(), captured };
    } else {
      this.stamp(point);
    }
    this.status = `${SCULPT_TOOLS.find((t) => t.id === this.effective().tool)?.name} · ${prop.name}`;
    this.notify();
  };

  private readonly onMove = (event: PointerEvent) => {
    if (!this.enabled || !this.dom) return;
    if (this.stroke?.grab) {
      event.preventDefault();
      event.stopPropagation();
      const rect = this.dom.getBoundingClientRect();
      this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const at = this.raycaster.ray.intersectPlane(this.stroke.grab.plane, this.tmp);
      if (!at) return;
      const delta = at.clone().sub(this.stroke.grab.origin);
      for (const [mesh, groups] of applyGrab(this.stroke.grab.captured, delta)) { mesh.recomputeNormals(groups); mesh.position.needsUpdate = true; }
      this.ring.position.copy(at);
      return;
    }
    const hit = this.hit(event);
    if (!hit) { this.ring.visible = false; return; }
    const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    this.ring.position.copy(hit.point).addScaledVector(normal, 2);
    this.ring.quaternion.setFromUnitVectors(PLANE_NORMAL, normal);
    this.ring.scale.setScalar(this.brush.radius);
    (this.ring.material as THREE.MeshBasicMaterial).color.set(this.effective().invert ? 0x74b9ff : this.effective().tool === 'paint' ? 0xf78fb3 : 0xff9f43);
    this.ring.visible = true;
    if (!this.stroke) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.stroke.last.distanceTo(hit.point) < this.brush.radius * 0.2) return;
    this.stroke.last.copy(hit.point);
    this.stamp(hit.point);
  };

  private readonly onUp = () => {
    const stroke = this.stroke;
    if (!stroke) return;
    this.stroke = null;
    const parts = stroke.entry.meshes.map((m, i) => { m.finishStroke(); return m.extractDoc(meshKey(i, m.mesh), m.localQuantum()); }).filter((d): d is NonNullable<typeof d> => d !== null);
    const doc = makeSculptDoc(parts, SCULPT_QUANTUM);
    stroke.entry.hash = doc?.hash ?? '';
    if (!doc) this.applied.delete(stroke.prop.id);
    this.host.commitSculpt(stroke.prop.id, doc);
    this.status = doc ? `${stroke.prop.name}: ${parts.length} mesh${parts.length === 1 ? '' : 'es'}, ${sculptDocBytes(doc)} bytes saved.` : `${stroke.prop.name}: back to its generated shape.`;
    this.notify();
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Shift') this.shiftHeld = true;
    if (event.key === 'Control' || event.key === 'Meta') this.ctrlHeld = true;
    if (!this.enabled) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    const tool = toolForKey(event.key);
    if (tool) { this.setTool(tool); event.preventDefault(); return; }
    switch (event.key) {
      case '[': this.setBrush({ radius: this.brush.radius / 1.2 }); break;
      case ']': this.setBrush({ radius: this.brush.radius * 1.2 }); break;
      case '-': this.setBrush({ strength: this.brush.strength - 0.05 }); break;
      case '=': case '+': this.setBrush({ strength: this.brush.strength + 0.05 }); break;
      default: return;
    }
    event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Shift') this.shiftHeld = false;
    if (event.key === 'Control' || event.key === 'Meta') this.ctrlHeld = false;
  };

  dispose(): void {
    this.detach();
    this.unsubscribe();
    this.scene.remove(this.ring);
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.listeners.length = 0;
  }
}
