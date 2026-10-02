import { useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import type { ThreeRenderer as RenderService } from '@hm/render';
import { decodeModel } from '@hm/voxel';

/**
 * Focus mode: "Edit" on a selected thing takes you inside it. The camera frames it, the world around it whites out and blurs, whatever is in the way is
 * sliced off so you can orbit or fly round it, and the usual tools (the brush, the inspector) keep working on it. How all that looks is a `veil` preset,
 * so it is edited, switched off and shared like everything else.
 */

export const VEIL_ID: PresetId = 'veil-main';
export const DECOR_FOCUS = '@foliage';

export interface FocusTarget { readonly id: PresetId | typeof DECOR_FOCUS; readonly name: string; readonly center: readonly [number, number, number]; readonly radius: number }

/** The veil preset of the scene, made on first use (a scene holds at most one). */
export function ensureVeil(rt: Runtime, sceneId: PresetId): PresetId {
  const have = rt.store.get(sceneId)?.children['views']?.[0]?.ref;
  if (have && rt.store.get(have)) return have;
  rt.commands.transaction('Editing view', () => {
    if (!rt.store.get(VEIL_ID)) rt.commands.execute(cmd.put({ id: VEIL_ID, kind: 'veil', name: 'Focus veil', params: {}, tier: 'play' }, 'Editing view'));
    rt.commands.execute(cmd.addChild(sceneId, 'views', VEIL_ID, undefined, 'Editing view'));
  });
  return VEIL_ID;
}

export interface VeilSettings { readonly style: 'white' | 'blur' | 'both' | 'off'; readonly falloff: number; readonly blur: number; readonly hideNear: boolean; readonly margin: number; readonly mode: 'orbit' | 'fly'; readonly flySpeed: number }

export function veilOf(rt: Runtime, sceneId: PresetId): VeilSettings {
  const ref = rt.store.get(sceneId)?.children['views']?.[0]?.ref;
  const p: Record<string, unknown> = ref && rt.store.get(ref) ? rt.store.resolve(ref).params : {};
  const num = (k: string, d: number): number => (Number.isFinite(Number(p[k])) ? Number(p[k]) : d);
  const style = (['white', 'blur', 'both', 'off'] as const).find((s) => s === p['style']) ?? 'both';
  return { style, falloff: num('falloff', 14), blur: num('blur', 6), hideNear: p['hideNear'] !== false, margin: num('margin', 1), mode: p['mode'] === 'fly' ? 'fly' : 'orbit', flySpeed: num('flySpeed', 8) };
}

/** Where a selected thing is and how big: an object, a voxel model, or all the foliage. */
export function focusTargetOf(rt: Runtime, id: PresetId | typeof DECOR_FOCUS): FocusTarget | null {
  if (id === DECOR_FOCUS) {
    const d = rt.binder.decor();
    if (!d || d.placements.length === 0) return null;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y = 0;
    for (const p of d.placements) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); y += p.y; }
    return { id, name: 'Foliage', center: [(x0 + x1) / 2, y / d.placements.length, (z0 + z1) / 2], radius: Math.max(6, Math.hypot(x1 - x0, z1 - z0) / 2) };
  }
  const p = rt.store.get(id);
  if (!p) return null;
  const r = rt.store.resolve(id).params as Record<string, unknown>;
  if (p.kind === 'model') {
    const m = typeof r['data'] === 'string' && r['data'] ? decodeModel(r['data'] as string).model : null;
    const s = Number(r['scale'] ?? 0.1);
    const h = m ? m.size[1] * s : 2, w = m ? Math.max(m.size[0], m.size[2]) * s : 2;
    return { id, name: p.name, center: [Number(r['x'] ?? 0), Number(r['y'] ?? 0) + h / 2, Number(r['z'] ?? 0)], radius: Math.max(0.6, Math.hypot(h, w) / 2) };
  }
  const e = rt.binder.entityOf(id);
  if (e === undefined || e === null) return null;
  const t = rt.world.get(e, 'transform');
  if (!t) return null;
  const size = Number(r['size'] ?? 0.5) * Math.max(Number(t['sx'] ?? 1), Number(t['sy'] ?? 1), Number(t['sz'] ?? 1));
  return { id, name: p.name, center: [Number(t['x']), Number(t['y']), Number(t['z'])], radius: Math.max(0.5, size) };
}

/** Frame the target from a pleasant three-quarter angle. */
export function frameTarget(renderer: RenderService, t: FocusTarget): void {
  const d = t.radius * 3.2 + 2;
  renderer.camera.set([t.center[0] + d * 0.7, t.center[1] + d * 0.45, t.center[2] + d * 0.7], [...t.center]);
}

/** Applies the veil to the renderer while a target is focused, and lets W A S D Q E fly when the veil's camera is `fly`. */
export function useFocus(renderer: RenderService | null, rt: Runtime, sceneId: PresetId, target: FocusTarget | null, rev: number): VeilSettings {
  const veil = veilOf(rt, sceneId);
  const liveVeil = useRef(veil);
  liveVeil.current = veil;
  useEffect(() => {
    if (!renderer) return;
    if (!target) { renderer.setFocus(null); return; }
    renderer.setFocus({ target: [...target.center], radius: target.radius * veil.margin, veil: veil.style === 'white' || veil.style === 'both', hideNear: veil.hideNear, falloff: veil.falloff });
    return () => renderer.setFocus(null);
  }, [renderer, target, rev, veil.style, veil.falloff, veil.hideNear, veil.margin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!renderer || !target || veil.mode !== 'fly') return;
    const down = new Set<string>();
    const onDown = (e: KeyboardEvent): void => { const tag = (e.target as HTMLElement | null)?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return; down.add(e.key.toLowerCase()); };
    const onUp = (e: KeyboardEvent): void => { down.delete(e.key.toLowerCase()); };
    let raf = 0, last = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (down.size) {
        const pos = renderer.camera.position, tgt = renderer.camera.target;
        const fx = tgt[0] - pos[0], fz = tgt[2] - pos[2], len = Math.hypot(fx, fz) || 1;
        const f: [number, number] = [fx / len, fz / len], r: [number, number] = [-f[1], f[0]];
        const v = liveVeil.current.flySpeed * (down.has('shift') ? 3 : 1) * dt;
        const move: [number, number, number] = [0, 0, 0];
        if (down.has('w')) { move[0] += f[0] * v; move[2] += f[1] * v; }
        if (down.has('s')) { move[0] -= f[0] * v; move[2] -= f[1] * v; }
        if (down.has('d')) { move[0] -= r[0] * v; move[2] -= r[1] * v; }
        if (down.has('a')) { move[0] += r[0] * v; move[2] += r[1] * v; }
        if (down.has('e')) move[1] += v;
        if (down.has('q')) move[1] -= v;
        renderer.camera.set([pos[0] + move[0], pos[1] + move[1], pos[2] + move[2]], [tgt[0] + move[0], tgt[1] + move[1], tgt[2] + move[2]]);
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('keydown', onDown); window.addEventListener('keyup', onUp);
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); cancelAnimationFrame(raf); };
  }, [renderer, target, veil.mode]);
  return veil;
}

/** The blurred edge of the screen while focused (a ring that is clear in the middle). Click-through. */
export function BlurRing(props: { readonly veil: VeilSettings }): ReactElement | null {
  const { veil } = props;
  if (!(veil.style === 'blur' || veil.style === 'both') || veil.blur <= 0) return null;
  const style: CSSProperties = {
    position: 'absolute', inset: 0, pointerEvents: 'none', backdropFilter: `blur(${veil.blur}px)`, WebkitBackdropFilter: `blur(${veil.blur}px)`,
    maskImage: 'radial-gradient(ellipse at center, transparent 38%, black 78%)', WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 38%, black 78%)',
  };
  return <div aria-hidden="true" className="blur-ring" style={style} />;
}

/** The little bar at the top while focused: what you are inside, the veil's own settings, the camera, and the way out. */
export function FocusBar(props: { readonly target: FocusTarget; readonly veil: VeilSettings; readonly onVeil: () => void; readonly onMode: () => void; readonly onExit: () => void }): ReactElement {
  const { target, veil, onVeil, onMode, onExit } = props;
  return (
    <div className="focus-bar" role="toolbar" aria-label="Focus">
      <span>Inside <b>{target.name}</b></span>
      <button title="Edit the white-out and blur like any preset, or switch it off" onClick={onVeil}>⚙ Veil{veil.style === 'off' ? ' (off)' : ''}</button>
      <button title="Orbit with the mouse, or fly with W A S D Q E" onClick={onMode}>{veil.mode === 'fly' ? '🕊 Fly' : '⟳ Orbit'}</button>
      <button className="go" onClick={onExit}>✕ Back to the island</button>
    </div>
  );
}
