import { cmd, type OverlayShape, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { drag, gizmoGrow, hitTest, worldLength, type DragResult, type GizmoMode, type Handle, type Ray, type Snap, type Vec3 } from '@hm/gizmo';

/**
 * The transform gizmo on the selected thing (hotbar spec V3, "Global transform gizmo"; docs/ARENA_PLAN.md). Pro and Studio only: Easy keeps
 * the playful click-to-carry. Select's slots pick its mode (Move: arrows and planes, Turn: the ring round the up axis, Resize: the middle
 * handle), + and - grow and shrink it, Shift snaps moves to half metres (and sizes to quarter steps), Ctrl snaps turns to 15 degrees, Alt-drag
 * leaves a copy behind. A drag shows live and lands as one undo step. A placed thing has a position, a yaw and one size, so the gizmo offers
 * exactly those: no tilt rings, no stretching along one axis.
 */
export interface GizmoTarget { readonly ref: PresetId; readonly index: number }
interface Pose { x: number; y: number; z: number; yaw: number; scale: number }
interface Grab { readonly handle: Handle; readonly start: Ray; readonly from: Pose; readonly target: GizmoTarget; readonly copy: boolean; readonly len: number }

const COLOR = { x: '#e5484d', y: '#46a758', z: '#3e63dd', hot: '#ffc53d', ring: '#46a758', uniform: '#f4f4f5' } as const;
const AXES: Record<'x' | 'y' | 'z', Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/** What a held Select preset makes the gizmo do. */
export const gizmoModeFor = (heldId: string | null | undefined): GizmoMode => (heldId === 'turn' ? 'rotate' : heldId === 'resize' ? 'scale' : 'move');
/** Only the handles a placed thing can follow. */
export const allowed = (mode: GizmoMode, h: Handle | null): Handle | null =>
  !h ? null : mode === 'move' ? (h.kind === 'axis' || h.kind === 'plane' ? h : null) : mode === 'rotate' ? (h.kind === 'ring' && h.axis === 'y' ? h : null) : h.kind === 'uniform' ? h : null;
const same = (a: Handle | null, b: Handle | null): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The shapes to draw (the overlay layer, always on top). */
export function gizmoShapes(mode: GizmoMode, p: Vec3, len: number, hot: Handle | null): OverlayShape[] {
  const out: OverlayShape[] = [];
  const at = (a: Vec3, s: number): Vec3 => [p[0] + a[0] * s, p[1] + a[1] * s, p[2] + a[2] * s];
  if (mode === 'move') {
    for (const k of ['x', 'y', 'z'] as const) {
      const c = same(hot, { kind: 'axis', axis: k }) ? COLOR.hot : COLOR[k];
      out.push({ type: 'tube', from: at(AXES[k], 0.12 * len), to: at(AXES[k], len), radius: 0.025 * len, color: c });
      out.push({ type: 'handle', id: `tip-${k}`, position: at(AXES[k], len), color: c, size: 0.06 * len });
    }
    for (const [a, b] of [['x', 'y'], ['x', 'z'], ['y', 'z']] as const) {
      const lo = 0.2 * len, hi = 0.45 * len, A = AXES[a], B = AXES[b];
      const c = (u: number, v: number): Vec3 => [p[0] + A[0] * u + B[0] * v, p[1] + A[1] * u + B[1] * v, p[2] + A[2] * u + B[2] * v];
      const third = (['x', 'y', 'z'] as const).find((k) => k !== a && k !== b)!;
      out.push({ type: 'quad', corners: [c(lo, lo), c(hi, lo), c(hi, hi), c(lo, hi)], color: same(hot, { kind: 'plane', axes: [a, b] }) ? COLOR.hot : COLOR[third], opacity: 0.45 });
    }
  } else if (mode === 'rotate') {
    out.push({ type: 'ring', center: p, normal: [0, 1, 0], radius: len, width: 0.05 * len, color: same(hot, { kind: 'ring', axis: 'y' }) ? COLOR.hot : COLOR.ring });
  } else {
    out.push({ type: 'handle', id: 'uniform', position: p, color: same(hot, { kind: 'uniform' }) ? COLOR.hot : COLOR.uniform, size: 0.15 * len });
    out.push({ type: 'ring', center: p, normal: [0, 1, 0], radius: 0.15 * len, color: COLOR.uniform });
  }
  return out;
}

/** The pose a drag gives (pure, so it can be tested). */
export function posed(from: Pose, r: DragResult): Pose {
  const yaw = from.yaw + (r.rotateAxis ? r.rotateAxis[1] * r.rotateDeg : 0);
  return {
    x: from.x + r.translate[0], y: from.y + r.translate[1], z: from.z + r.translate[2],
    yaw: ((yaw % 360) + 540) % 360 - 180,
    scale: Math.min(5, Math.max(0.01, from.scale * r.scale[0])),
  };
}

export class GizmoControl {
  /** The +/- size (1 = normal). */
  size = 1;
  private hot: Handle | null = null;
  private grab: Grab | null = null;
  private shown = false;
  private last: Pose | null = null;
  /** What was drawn last (tests and the island's hints). */
  seen: { readonly ref: PresetId; readonly mode: GizmoMode; readonly pivot: Vec3; readonly len: number; readonly hot: Handle | null } | null = null;

  constructor(private readonly rt: Runtime, private readonly sceneId: PresetId, private readonly overlay: { show(id: string, shapes: readonly OverlayShape[]): void; hide(id: string): void },
    private readonly pose: (index: number, p: Pose) => void) {}

  get dragging(): boolean { return this.grab !== null; }
  get hovering(): boolean { return this.hot !== null; }

  private poseOf(ref: PresetId): Pose | null {
    if (!this.rt.store.get(ref)) return null;
    const pr = this.rt.store.resolve(ref).params as Record<string, unknown>;
    return { x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0), yaw: Number(pr['yaw'] ?? 0), scale: Number(pr['scale'] ?? 0.1) };
  }

  grow(steps: number): void { this.size = gizmoGrow(this.size, steps); }

  /** Each frame: draw it on the target (or hide it), find the handle under the ray, move what is being dragged. */
  frame(target: GizmoTarget | null, mode: GizmoMode, ray: Ray | null, fovDeg: number, snap: Snap): void {
    const t = this.grab?.target ?? target;
    const base = t ? this.poseOf(t.ref) : null;
    if (!t || !base || !ray) { this.hide(); return; }
    const pivot: Vec3 = this.grab && this.last ? [this.last.x, this.last.y, this.last.z] : [base.x, base.y, base.z];
    const len = this.grab?.len ?? worldLength(pivot, ray.origin, fovDeg, this.size);
    const state = { mode: this.grab ? modeOfHandle(this.grab.handle) : mode, pivot };
    if (this.grab) {
      const g = this.grab;
      const r = drag({ mode: state.mode, pivot: [g.from.x, g.from.y, g.from.z] }, g.handle, g.start, ray, g.len, snap);
      this.last = posed(g.from, r);
      this.pose(g.target.index, this.last);
    } else {
      this.hot = allowed(mode, hitTest(state, ray, len));
    }
    this.overlay.show('gizmo', gizmoShapes(state.mode, pivot, len, this.grab?.handle ?? this.hot));
    this.seen = { ref: t.ref, mode: state.mode, pivot, len, hot: this.grab?.handle ?? this.hot };
    this.shown = true;
  }

  hide(): void { if (this.shown) { this.overlay.hide('gizmo'); this.shown = false; } this.hot = null; this.seen = null; }

  /** The left button went down: start dragging the handle under the pointer. True when the gizmo took the click. */
  down(target: GizmoTarget | null, ray: Ray | null, alt: boolean, fovDeg: number): boolean {
    if (!target || !ray || !this.hot) return false;
    const from = this.poseOf(target.ref);
    if (!from) return false;
    const len = worldLength([from.x, from.y, from.z], ray.origin, fovDeg, this.size);
    this.grab = { handle: this.hot, start: ray, from, target, copy: alt && modeOfHandle(this.hot) === 'move', len };
    this.last = from;
    return true;
  }

  /** Let go: one undo step (Move, Turn, Size, or a copy left behind with Alt). Returns what was done, for the island to say. */
  up(): string | null {
    const g = this.grab, p = this.last;
    this.grab = null; this.last = null;
    if (!g || !p) return null;
    const moved = Math.hypot(p.x - g.from.x, p.y - g.from.y, p.z - g.from.z) > 1e-4, turned = Math.abs(p.yaw - g.from.yaw) > 1e-3, sized = Math.abs(p.scale - g.from.scale) > 1e-5;
    if (!moved && !turned && !sized) { this.pose(g.target.index, g.from); return null; }
    const ref = g.target.ref, c = this.rt.commands;
    if (g.copy) {
      const src = this.rt.store.get(ref);
      if (!src) return null;
      const id = `model-${Date.now().toString(36)}`;
      const params = { ...this.rt.store.resolve(ref).params, x: p.x, y: p.y, z: p.z };
      this.pose(g.target.index, g.from);
      c.transaction('Copy', () => {
        c.execute(cmd.put({ id, kind: 'model', name: src.name, params: params as never, tier: 'build' }, 'Copy'));
        c.execute(cmd.addChild(this.sceneId, 'models', id, undefined, 'Copy'));
      });
      return `${src.name} copied`;
    }
    const label = moved ? 'Move' : turned ? 'Turn' : 'Size';
    c.transaction(label, () => {
      if (moved) { c.execute(cmd.setParam(`${ref}.x`, p.x, label)); c.execute(cmd.setParam(`${ref}.y`, p.y, label)); c.execute(cmd.setParam(`${ref}.z`, p.z, label)); }
      if (turned) c.execute(cmd.setParam(`${ref}.yaw`, p.yaw, label));
      if (sized) c.execute(cmd.setParam(`${ref}.scale`, p.scale, label));
    });
    return null;
  }

  /** Esc while dragging: put it back. */
  cancel(): void { const g = this.grab; this.grab = null; this.last = null; if (g) this.pose(g.target.index, g.from); }
}

const modeOfHandle = (h: Handle): GizmoMode => (h.kind === 'ring' || h.kind === 'view-ring' ? 'rotate' : h.kind === 'uniform' ? 'scale' : 'move');
