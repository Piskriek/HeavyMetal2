import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import type { ThreeRenderer } from '@hm/render';
import { applyStroke, encodeTerrain, type BrushKind, type DirtyRect } from '@hm/terrain';

export interface BrushSettings {
  kind: BrushKind;
  radius: number;
  strength: number;
  falloff: 'smooth' | 'linear' | 'flat';
  surface: number;
  /** Height the flatten brush levels to (picked from the first dab when null). */
  target: number | null;
}

/**
 * Terrain painting: while enabled, left-drag on the ground paints/sculpts the decoded terrain live (the renderer re-uploads only
 * the touched nodes) and the whole stroke is committed as ONE undoable command that stores the new terrain data in its preset.
 */
export function attachPaint(opts: {
  readonly rt: Runtime;
  readonly renderer: ThreeRenderer;
  readonly el: HTMLElement;
  readonly brush: () => BrushSettings;
  readonly enabled: () => boolean;
}): () => void {
  const { rt, renderer, el } = opts;
  let last: { x: number; z: number } | null = null;
  let stroke: { presetId: PresetId; dirty: DirtyRect | null; target: number | null } | null = null;

  const showCursor = (x: number, y: number, z: number): void => {
    const b = opts.brush();
    renderer.overlay.show('brush', [
      { type: 'ring', center: [x, y + 0.05, z], normal: [0, 1, 0], radius: b.radius, color: '#ffd24a' },
      { type: 'ring', center: [x, y + 0.05, z], normal: [0, 1, 0], radius: Math.max(0.1, b.radius * 0.5), color: '#ffffff' },
    ]);
  };

  const dab = (x: number, z: number, from: { x: number; z: number }): void => {
    const state = rt.binder.terrain();
    if (!state || !stroke) return;
    const b = opts.brush();
    const strengthPerDab = b.kind === 'paint' ? Math.min(1, b.strength) : b.strength * 0.25;
    const rect = applyStroke(state.terrain, {
      kind: b.kind, x, z, radius: b.radius, strength: strengthPerDab, falloff: b.falloff, surface: b.surface, ...(stroke.target !== null ? { target: stroke.target } : {}),
    }, from, { x, z }, Math.max(0.25, b.radius * 0.3));
    if (!rect) return;
    stroke.dirty = stroke.dirty
      ? { c0: Math.min(stroke.dirty.c0, rect.c0), r0: Math.min(stroke.dirty.r0, rect.r0), c1: Math.max(stroke.dirty.c1, rect.c1), r1: Math.max(stroke.dirty.r1, rect.r1) }
      : rect;
    renderer.refreshTerrain(rect);
  };

  const onDown = (e: PointerEvent): void => {
    if (!opts.enabled() || e.button !== 0) return;
    const state = rt.binder.terrain();
    const hit = renderer.pick(e.clientX, e.clientY);
    if (!state || !hit.point) return;
    const b = opts.brush();
    stroke = { presetId: state.presetId, dirty: null, target: b.kind === 'flatten' ? (b.target ?? hit.point[1]) : null };
    last = { x: hit.point[0], z: hit.point[2] };
    el.setPointerCapture(e.pointerId);
    e.stopPropagation();
    dab(last.x, last.z, last);
  };

  const onMove = (e: PointerEvent): void => {
    if (!opts.enabled()) { renderer.overlay.hide('brush'); return; }
    const hit = renderer.pick(e.clientX, e.clientY);
    if (!hit.point) { renderer.overlay.hide('brush'); return; }
    showCursor(hit.point[0], hit.point[1], hit.point[2]);
    if (stroke && last) {
      dab(hit.point[0], hit.point[2], last);
      last = { x: hit.point[0], z: hit.point[2] };
    }
  };

  const finish = (e: PointerEvent): void => {
    if (!stroke) return;
    const s = stroke;
    stroke = null; last = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    const state = rt.binder.terrain();
    if (!s.dirty || !state || state.presetId !== s.presetId) return;
    const b = opts.brush();
    const label = b.kind === 'paint' ? 'Paint ground' : `Sculpt ground (${b.kind})`;
    rt.commands.execute(cmd.setParam(`${s.presetId}.data`, encodeTerrain(state.terrain) as never, label));
  };

  el.addEventListener('pointerdown', onDown, true);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
  el.addEventListener('pointerleave', () => renderer.overlay.hide('brush'));
  return () => {
    el.removeEventListener('pointerdown', onDown, true);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', finish);
    el.removeEventListener('pointercancel', finish);
    renderer.overlay.hide('brush');
  };
}
