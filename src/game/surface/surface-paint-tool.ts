/**
 * NewRoads · Phase 1.3 / 5 — the brush.
 *
 * Pointer → `Raycaster` against the paint ribbon → `intersection.uv` is already `(u, s)` (authored UVs,
 * see `road-surface-paint.ts`) → `RoadMask.paint`. No compute, no render-to-texture: a CPU stamp and
 * one texture upload per painted frame (plan §1.3).
 *
 * Undo is a stack of strokes; a stroke is the list of texel rectangles its stamps touched, snapshotted
 * *before* each stamp (§5: dirty-rect snapshots, never full-mask copies). A decal ring follows the
 * cursor on the road surface. Autosave runs 1.5 s after the last stroke.
 *
 * Keys (also listed in the on-screen hint):
 *   0–9       pick a surface (0 = eraser: paints the base road back)
 *   [ / ]     brush radius        - / =   opacity        , / .   hardness
 *   Shift     hold to paint over the shoulders (otherwise locked to gravel, §2.2)
 *   M         cycle lane markings for the ±600 units of road under the cursor
 *   G         lay gravel shoulders along the whole road
 *   Z         undo        S   save now        X   clear the whole mask (asks first)
 *   P         toggle the brush off/on (the ring and the hint go with it)
 */
import * as THREE from 'three';
import type { RoadSurfacePaint } from './road-surface-paint';
import type { MaskSnapshot } from './surface-mask';
import { MARK_CYCLE, SURFACE_ASPHALT, SURFACE_TABLE, surfaceDefinition } from './surface-table';

export interface BrushSettings {
  surface: number;
  /** World units. */
  radius: number;
  hardness: number;
  opacity: number;
}

const DEFAULT_BRUSH: BrushSettings = { surface: SURFACE_ASPHALT, radius: 200, hardness: 0.45, opacity: 0.4 };
const MIN_RADIUS = 30;
const MAX_RADIUS = 1200;
const MARKING_SPAN = 600;
const AUTOSAVE_MS = 1500;
const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);

export class SurfacePaintTool {
  readonly brush: BrushSettings = { ...DEFAULT_BRUSH };
  readonly undoStack: MaskSnapshot[][] = [];
  private enabled = true;
  private painting = false;
  private overrideShoulders = false;
  private currentStroke: MaskSnapshot[] | null = null;
  private lastHit: { u: number; s: number; halfWidth: number } | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private markingIndex = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly ring: THREE.Mesh;
  private readonly hint: HTMLDivElement | null;

  constructor(
    private readonly paint: RoadSurfacePaint,
    private readonly camera: THREE.Camera,
    private readonly dom: HTMLElement,
  ) {
    const ringGeo = new THREE.RingGeometry(0.92, 1, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.name = 'SurfacePaintCursor';
    this.ring.renderOrder = 10;
    this.ring.visible = false;
    paint.root.parent?.add(this.ring);

    this.hint = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (this.hint) {
      Object.assign(this.hint.style, {
        position: 'fixed', left: '12px', bottom: '12px', zIndex: '40', padding: '8px 10px', borderRadius: '6px',
        font: '12px/1.4 ui-monospace, monospace', color: '#f5e9c8', background: 'rgba(20,16,12,0.78)', pointerEvents: 'none', whiteSpace: 'pre',
      } as Partial<CSSStyleDeclaration>);
      document.body.appendChild(this.hint);
    }
    this.refreshHint();

    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  get isEnabled(): boolean { return this.enabled; }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.painting = false;
    this.ring.visible = false;
    if (this.hint) this.hint.style.display = on ? 'block' : 'none';
  }

  setSurface(id: number): void {
    if (!SURFACE_TABLE[id]) return;
    this.brush.surface = id;
    this.refreshHint();
  }

  undo(): boolean {
    const stroke = this.undoStack.pop();
    if (!stroke) return false;
    for (let i = stroke.length - 1; i >= 0; i--) this.paint.mask.mask.restore(stroke[i]);
    this.scheduleSave();
    return true;
  }

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; this.paint.save(); }
    this.ring.parent?.remove(this.ring);
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.hint?.remove();
  }

  // ---------------------------------------------------------------------------

  private hitAt(event: PointerEvent) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.paint.meshes, false)[0];
    if (!hit || !hit.uv) return null;
    const half = hit.object instanceof THREE.Mesh ? (hit.object.geometry.getAttribute('aSurfHalf') as THREE.BufferAttribute | undefined) : undefined;
    const halfWidth = half && hit.face ? half.getX(hit.face.a) : this.paint.map.halfWidthAt(hit.uv.y);
    return { u: hit.uv.x, s: hit.uv.y, halfWidth, point: hit.point, normal: hit.face?.normal ?? null, object: hit.object };
  }

  private stamp(u: number, s: number, halfWidth: number) {
    const mask = this.paint.mask;
    const rect = mask.strokeRect(s, u, this.brush.radius, halfWidth);
    const before = mask.mask.snapshot(rect);
    const touched = mask.paint(s, u, {
      radius: this.brush.radius, hardness: this.brush.hardness, opacity: this.brush.opacity,
      surface: this.brush.surface, halfWidth, overrideShoulders: this.overrideShoulders,
    });
    if (touched && this.currentStroke) this.currentStroke.push(before);
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    if (!this.enabled || event.button !== 0) return;
    const hit = this.hitAt(event);
    if (!hit) return;
    event.preventDefault();
    this.painting = true;
    this.currentStroke = [];
    this.stamp(hit.u, hit.s, hit.halfWidth);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.enabled) return;
    const hit = this.hitAt(event);
    if (!hit) { this.ring.visible = false; this.lastHit = null; return; }
    this.lastHit = { u: hit.u, s: hit.s, halfWidth: hit.halfWidth };
    // The ring sits on the road, facing along the surface normal, scaled to the brush.
    const normal = hit.normal ? hit.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    this.ring.position.copy(hit.point).addScaledVector(normal, 2);
    this.ring.quaternion.setFromUnitVectors(PLANE_NORMAL, normal);
    this.ring.scale.setScalar(this.brush.radius);
    this.ring.visible = true;
    if (this.painting) this.stamp(hit.u, hit.s, hit.halfWidth);
  };

  private readonly onPointerUp = () => {
    if (!this.painting) return;
    this.painting = false;
    if (this.currentStroke && this.currentStroke.length) {
      this.undoStack.push(this.currentStroke);
      if (this.undoStack.length > 64) this.undoStack.shift();
      this.scheduleSave();
    }
    this.currentStroke = null;
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Shift') { this.overrideShoulders = true; return; }
    if (event.key === 'p' || event.key === 'P') { this.setEnabled(!this.enabled); return; }
    if (!this.enabled) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (/^[0-9]$/.test(event.key)) { this.setSurface(Number(event.key)); return; }
    switch (event.key) {
      case '[': this.brush.radius = Math.max(MIN_RADIUS, this.brush.radius / 1.25); break;
      case ']': this.brush.radius = Math.min(MAX_RADIUS, this.brush.radius * 1.25); break;
      case '-': this.brush.opacity = Math.max(0.05, this.brush.opacity - 0.05); break;
      case '=': case '+': this.brush.opacity = Math.min(1, this.brush.opacity + 0.05); break;
      case ',': this.brush.hardness = Math.max(0, this.brush.hardness - 0.1); break;
      case '.': this.brush.hardness = Math.min(1, this.brush.hardness + 0.1); break;
      case 'z': case 'Z': this.undo(); break;
      case 's': case 'S': this.paint.save(); break;
      case 'g': case 'G': this.recordWhole(() => this.paint.mask.fillShoulders()); break;
      case 'm': case 'M': this.cycleMarkings(); break;
      case 'x': case 'X':
        if (typeof confirm !== 'function' || confirm('Clear every painted surface on this course?')) this.recordWhole(() => this.paint.mask.clear());
        break;
      default: return;
    }
    event.preventDefault();
    this.refreshHint();
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Shift') this.overrideShoulders = false;
  };

  /** A whole-mask edit (shoulders, clear) is one undo entry holding one full-size snapshot. */
  private recordWhole(edit: () => void) {
    const mask = this.paint.mask;
    const before = mask.mask.snapshot({ x0: 0, y0: 0, x1: mask.across, y1: mask.rows });
    edit();
    this.undoStack.push([before]);
    this.scheduleSave();
  }

  private cycleMarkings() {
    if (!this.lastHit) return;
    const mask = this.paint.mask;
    this.markingIndex = (this.markingIndex + 1) % MARK_CYCLE.length;
    const s0 = this.lastHit.s - MARKING_SPAN, s1 = this.lastHit.s + MARKING_SPAN;
    const rect = { x0: 0, y0: Math.floor(mask.rowAt(s0)), x1: mask.across, y1: Math.min(mask.rows, Math.ceil(mask.rowAt(s1)) + 1) };
    const before = mask.mask.snapshot(rect);
    mask.setMarking(s0, s1, MARK_CYCLE[this.markingIndex]);
    this.undoStack.push([before]);
    this.scheduleSave();
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const result = this.paint.save();
      if (!result.ok) console.warn('[surface-paint] save failed:', result.error);
    }, AUTOSAVE_MS);
  }

  private refreshHint() {
    if (!this.hint) return;
    const def = surfaceDefinition(this.brush.surface);
    const palette = SURFACE_TABLE.map((s) => `${s.id === this.brush.surface ? '▶' : ' '}${s.id} ${s.name}`).join('\n');
    this.hint.textContent =
      `SURFACE PAINT  [${def.id}] ${def.name}\n` +
      `radius ${Math.round(this.brush.radius)}  opacity ${this.brush.opacity.toFixed(2)}  hardness ${this.brush.hardness.toFixed(1)}\n` +
      `0-9 surface · [ ] radius · - = opacity · , . hardness\n` +
      `Shift: paint shoulders · M markings · G gravel shoulders\n` +
      `Z undo · S save · X clear · P hide\n\n${palette}`;
  }
}
