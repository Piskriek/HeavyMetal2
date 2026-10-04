import { cmd, type OverlayShape, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { drag, gizmoGrow, hitTest, worldLength, type DragResult, type GizmoMode, type Handle, type Ray, type Snap, type Vec3 } from '@hm/gizmo';

/**
 * The transform gizmo on the selected things (hotbar spec V3, "Global transform gizmo"; docs/ARENA_PLAN.md). Pro and Studio only: Easy
 * keeps the playful click-to-carry. Select's slots pick its mode (Move: arrows and planes, Turn: the ring round the up axis, Resize: the
 * middle handle), + and - grow and shrink it, Shift snaps moves to half metres (and sizes to quarter steps), Ctrl snaps turns to 15
 * degrees, Alt-drag leaves copies behind. A drag shows live and lands as one undo step. One thing or a group (box select, F1): a group
 * moves together, turns round its middle and grows from it. A placed thing has a position, a yaw and one size, so the gizmo offers exactly
 * those: no tilt rings, no stretching along one axis. It stands in the middle of the things (a thing's own origin is its foot).
 */
export interface GizmoTarget { readonly ref: PresetId; readonly index: number }
interface Pose { x: number; y: number; z: number; yaw: number; scale: number }
interface Held { readonly target: GizmoTarget; readonly from: Pose }
interface Grab { readonly handle: Handle; readonly start: Ray; readonly held: readonly Held[]; readonly pivot: Vec3; readonly copy: boolean; readonly len: number }

const COLOR = { x: '#e5484d', y: '#46a758', z: '#3e63dd', hot: '#ffc53d', ring: '#46a758', uniform: '#f4f4f5' } as const;
const AXES: Record<'x' | 'y' | 'z', Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
/** How big it is at size 1: about a seventh of the screen's height per arrow. */
const BASE = 1.4;

/** What a held Select preset makes the gizmo do. */
export const gizmoModeFor = (heldId: string | null | undefined): GizmoMode => (heldId === 'turn' ? 'rotate' : heldId === 'resize' ? 'scale' : 'move');
/** Only the handles a placed thing can follow. */
export const allowed = (mode: GizmoMode, h: Handle | null): Handle | null =>
  !h ? null : mode === 'move' ? (h.kind === 'axis' || h.kind === 'plane' ? h : null) : mode === 'rotate' ? (h.kind === 'ring' && h.axis === 'y' ? h : null) : h.kind === 'uniform' ? h : null;
const same = (a: Handle | null, b: Handle | null): boolean => JSON.stringify(a) === JSON.stringify(b);
const modeOfHandle = (h: Handle): GizmoMode => (h.kind === 'ring' || h.kind === 'view-ring' ? 'rotate' : h.kind === 'uniform' ? 'scale' : 'move');

/** The shapes to draw (the overlay layer, always on top). */
export function gizmoShapes(mode: GizmoMode, p: Vec3, len: number, hot: Handle | null): OverlayShape[] {
  const out: OverlayShape[] = [];
  const at = (a: Vec3, s: number): Vec3 => [p[0] + a[0] * s, p[1] + a[1] * s, p[2] + a[2] * s];
  if (mode === 'move') {
    for (const k of ['x', 'y', 'z'] as const) {
      const c = same(hot, { kind: 'axis', axis: k }) ? COLOR.hot : COLOR[k];
      out.push({ type: 'tube', from: at(AXES[k], 0.1 * len), to: at(AXES[k], 0.78 * len), radius: 0.03 * len, color: c });
      out.push({ type: 'cone', from: at(AXES[k], 0.76 * len), to: at(AXES[k], len), radius: 0.08 * len, color: c });
    }
    for (const [a, b] of [['x', 'y'], ['x', 'z'], ['y', 'z']] as const) {
      const lo = 0.2 * len, hi = 0.45 * len, A = AXES[a], B = AXES[b];
      const c = (u: number, v: number): Vec3 => [p[0] + A[0] * u + B[0] * v, p[1] + A[1] * u + B[1] * v, p[2] + A[2] * u + B[2] * v];
      const third = (['x', 'y', 'z'] as const).find((k) => k !== a && k !== b)!;
      out.push({ type: 'quad', corners: [c(lo, lo), c(hi, lo), c(hi, hi), c(lo, hi)], color: same(hot, { kind: 'plane', axes: [a, b] }) ? COLOR.hot : COLOR[third], opacity: 0.5 });
    }
  } else if (mode === 'rotate') {
    out.push({ type: 'ring', center: p, normal: [0, 1, 0], radius: len, width: 0.06 * len, color: same(hot, { kind: 'ring', axis: 'y' }) ? COLOR.hot : COLOR.ring });
  } else {
    const c = same(hot, { kind: 'uniform' }) ? COLOR.hot : COLOR.uniform;
    out.push({ type: 'handle', id: 'uniform', position: p, color: c, size: 0.15 * len });
    out.push({ type: 'ring', center: p, normal: [0, 1, 0], radius: 0.24 * len, width: 0.03 * len, color: c });
  }
  return out;
}

/** The pose a drag gives one thing (pure, so it can be tested). */
export function posed(from: Pose, r: DragResult): Pose {
  const yaw = from.yaw + (r.rotateAxis ? r.rotateAxis[1] * r.rotateDeg : 0);
  return {
    x: from.x + r.translate[0], y: from.y + r.translate[1], z: from.z + r.translate[2],
    yaw: ((yaw % 360) + 540) % 360 - 180,
    scale: Math.min(5, Math.max(0.01, from.scale * r.scale[0])),
  };
}

/**
 * The pose a drag gives one thing of a group round the group's middle `pivot` (pure): moved by the move, turned round the pivot (and on
 * its own yaw) by the turn, its distance from the pivot (across the ground) grown with its size.
 */
export function groupPosed(from: Pose, pivot: Vec3, r: DragResult): Pose {
  const p = posed(from, r);
  const turn = r.rotateAxis ? (r.rotateAxis[1] * r.rotateDeg * Math.PI) / 180 : 0;
  const k = r.scale[0];
  let dx = (from.x - pivot[0]) * k, dz = (from.z - pivot[2]) * k;
  if (turn) { const c = Math.cos(turn), s = Math.sin(turn); [dx, dz] = [dx * c + dz * s, -dx * s + dz * c]; }
  return { ...p, x: pivot[0] + dx + r.translate[0], z: pivot[2] + dz + r.translate[2] };
}

export class GizmoControl {
  /** The +/- size (1 = normal). */
  size = 1;
  private hot: Handle | null = null;
  private grab: Grab | null = null;
  private shown = false;
  private last: Pose[] = [];
  private snap: Snap = {};
  /** How high the middle of each thing is above its foot, by its size (measuring decodes the model: once, not every frame). */
  private readonly lifts = new Map<string, { scale: number; lift: number }>();
  /** What was drawn last (tests and the island's hints): `ref` is the first thing. */
  seen: { readonly ref: PresetId; readonly count: number; readonly mode: GizmoMode; readonly pivot: Vec3; readonly len: number; readonly hot: Handle | null } | null = null;

  constructor(private readonly rt: Runtime, private readonly sceneId: PresetId, private readonly overlay: { show(id: string, shapes: readonly OverlayShape[]): void; hide(id: string): void },
    private readonly pose: (index: number, p: Pose) => void, private readonly measure: (ref: PresetId) => number) {}

  get dragging(): boolean { return this.grab !== null; }
  get hovering(): boolean { return this.hot !== null; }

  private poseOf(ref: PresetId): Pose | null {
    if (!this.rt.store.get(ref)) return null;
    const pr = this.rt.store.resolve(ref).params as Record<string, unknown>;
    return { x: Number(pr['x'] ?? 0), y: Number(pr['y'] ?? 0), z: Number(pr['z'] ?? 0), yaw: Number(pr['yaw'] ?? 0), scale: Number(pr['scale'] ?? 0.1) };
  }
  private liftOf(ref: PresetId, scale: number): number {
    const hit = this.lifts.get(ref);
    if (hit && hit.scale === scale) return hit.lift;
    const lift = Math.max(0, this.measure(ref));
    this.lifts.set(ref, { scale, lift });
    return lift;
  }
  /** The things that still exist, with their poses, and the middle of them all (each thing's own middle, not its foot). */
  private gather(targets: readonly GizmoTarget[]): { held: Held[]; pivot: Vec3 } | null {
    const held: Held[] = [];
    let x = 0, y = 0, z = 0;
    for (const t of targets) {
      const from = this.poseOf(t.ref);
      if (!from) continue;
      held.push({ target: t, from });
      x += from.x; y += from.y + this.liftOf(t.ref, from.scale); z += from.z;
    }
    return held.length ? { held, pivot: [x / held.length, y / held.length, z / held.length] } : null;
  }

  grow(steps: number): void { this.size = gizmoGrow(this.size, steps); }

  /** Each frame: draw it on the targets (or hide it), find the handle under the ray, move what is being dragged. */
  frame(targets: readonly GizmoTarget[], mode: GizmoMode, ray: Ray | null, fovDeg: number, snap: Snap): void {
    const g = this.grab;
    const now = g ? null : this.gather(targets);
    if ((!g && !now) || !ray) { this.hide(); return; }
    let pivot: Vec3, len: number;
    if (g) {
      this.track(ray, snap);
      // a moved group takes its gizmo along; turning and sizing keep it where the drag began
      const r = drag({ mode: modeOfHandle(g.handle), pivot: g.pivot }, g.handle, g.start, ray, g.len, this.snap);
      pivot = modeOfHandle(g.handle) === 'move' ? [g.pivot[0] + r.translate[0], g.pivot[1] + r.translate[1], g.pivot[2] + r.translate[2]] : g.pivot;
      len = g.len;
    } else {
      pivot = now!.pivot;
      len = worldLength(pivot, ray.origin, fovDeg, this.size * BASE);
      this.hot = allowed(mode, hitTest({ mode, pivot }, ray, len));
    }
    const shownMode = g ? modeOfHandle(g.handle) : mode;
    this.overlay.show('gizmo', gizmoShapes(shownMode, pivot, len, g?.handle ?? this.hot));
    const first = (g?.held[0] ?? now!.held[0])!;
    this.seen = { ref: first.target.ref, count: g ? g.held.length : now!.held.length, mode: shownMode, pivot, len, hot: g?.handle ?? this.hot };
    this.shown = true;
  }

  hide(): void { if (this.shown) { this.overlay.hide('gizmo'); this.shown = false; } this.hot = null; this.seen = null; }

  /** The left button went down: start dragging the handle under the pointer. True when the gizmo took the click. */
  down(targets: readonly GizmoTarget[], ray: Ray | null, alt: boolean, fovDeg: number): boolean {
    if (!targets.length || !ray || !this.hot) return false;
    const got = this.gather(targets);
    if (!got) return false;
    const len = worldLength(got.pivot, ray.origin, fovDeg, this.size * BASE);
    this.grab = { handle: this.hot, start: ray, held: got.held, pivot: got.pivot, copy: alt && modeOfHandle(this.hot) === 'move', len };
    this.last = got.held.map((h) => h.from);
    return true;
  }

  /**
   * Follow the pointer now. The frame calls it, and so do pointer moves and letting go: a slow frame (a low-end laptop) never drops the end
   * of a quick drag. The snap stays as last given. The maths runs on the group's middle; the result moves every thing.
   */
  track(ray: Ray | null, snap?: Snap): void {
    const g = this.grab;
    if (!g || !ray) return;
    if (snap) this.snap = snap;
    const r = drag({ mode: modeOfHandle(g.handle), pivot: g.pivot }, g.handle, g.start, ray, g.len, this.snap);
    this.last = g.held.map((h) => (g.held.length === 1 ? posed(h.from, r) : groupPosed(h.from, g.pivot, r)));
    g.held.forEach((h, i) => this.pose(h.target.index, this.last[i]!));
  }

  /** Let go (with the pointer's last ray): one undo step (Move, Turn, Size, or copies left behind with Alt). Returns what to say, if anything. */
  up(ray?: Ray | null): string | null {
    this.track(ray ?? null);
    const g = this.grab, last = this.last;
    this.grab = null; this.last = [];
    if (!g || last.length !== g.held.length) return null;
    const changed = g.held.map((h, i) => {
      const p = last[i]!;
      return { h, p, moved: Math.hypot(p.x - h.from.x, p.y - h.from.y, p.z - h.from.z) > 1e-4, turned: Math.abs(p.yaw - h.from.yaw) > 1e-3, sized: Math.abs(p.scale - h.from.scale) > 1e-5 };
    });
    if (!changed.some((c) => c.moved || c.turned || c.sized)) { for (const { h } of changed) this.pose(h.target.index, h.from); return null; }
    const c = this.rt.commands;
    if (g.copy) {
      const made: string[] = [];
      for (const { h } of changed) this.pose(h.target.index, h.from);
      c.transaction('Copy', () => {
        changed.forEach(({ h, p }, i) => {
          const src = this.rt.store.get(h.target.ref);
          if (!src) return;
          const id = `model-${Date.now().toString(36)}-${i}`;
          c.execute(cmd.put({ id, kind: 'model', name: src.name, params: { ...this.rt.store.resolve(h.target.ref).params, x: p.x, y: p.y, z: p.z, yaw: p.yaw } as never, tier: 'build' }, 'Copy'));
          c.execute(cmd.addChild(this.sceneId, 'models', id, undefined, 'Copy'));
          made.push(src.name);
        });
      });
      return made.length === 1 ? `${made[0]} copied` : `${made.length} things copied`;
    }
    const label = changed.some((x) => x.moved) ? 'Move' : changed.some((x) => x.turned) ? 'Turn' : 'Size';
    c.transaction(label, () => {
      for (const { h, p, moved, turned, sized } of changed) {
        const ref = h.target.ref;
        if (moved) { c.execute(cmd.setParam(`${ref}.x`, p.x, label)); c.execute(cmd.setParam(`${ref}.y`, p.y, label)); c.execute(cmd.setParam(`${ref}.z`, p.z, label)); }
        if (turned) c.execute(cmd.setParam(`${ref}.yaw`, p.yaw, label));
        if (sized) c.execute(cmd.setParam(`${ref}.scale`, p.scale, label));
      }
    });
    return null;
  }

  /** Esc while dragging: put them back. */
  cancel(): void { const g = this.grab; this.grab = null; this.last = []; if (g) for (const h of g.held) this.pose(h.target.index, h.from); }
}
