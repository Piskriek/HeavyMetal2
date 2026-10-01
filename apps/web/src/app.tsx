import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { cmd, type PresetId, type Tier, type Value } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { attachOrbitControls, createThreeRenderer } from '@hm/render';
import { Inspector } from '@hm/ui';

const TIERS: readonly Tier[] = ['play', 'build', 'pro'];
const TIER_LABEL: Record<Tier, string> = { play: 'Play', build: 'Build', pro: 'Pro' };

/** Re-render whenever the preset store changes or the mode flips. */
function useRevision(rt: Runtime): number {
  const [v, setV] = useState(0);
  useEffect(() => rt.store.subscribe(() => setV((n) => n + 1)), [rt]);
  useEffect(() => rt.commands.subscribe(() => setV((n) => n + 1)), [rt]);
  return v;
}

export function App({ rt, sceneId }: { readonly rt: Runtime; readonly sceneId: PresetId }): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<Tier>('build');
  const [selected, setSelected] = useState<PresetId | null>(null);
  const [mode, setMode] = useState(rt.mode);
  const [fps, setFps] = useState(0);
  const rev = useRevision(rt);
  const selectedRef = useRef<PresetId | null>(null);
  selectedRef.current = selected;

  // viewport + frame loop
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = createThreeRenderer({ shadows: true, background: 'sky' });
    renderer.mount(el, rt.world, rt.store);
    const cam = rt.store.get(sceneId)?.params['camera'];
    if (cam && typeof cam === 'object' && !Array.isArray(cam) && 'ref' in cam) renderer.setCamera(String(cam.ref));
    const detach = attachOrbitControls(el, renderer, { touchOrbit: true });
    const offTick = rt.onTick(() => renderer.step());
    let last = performance.now(), raf = 0, frames = 0, acc = 0;
    const loop = (now: number): void => {
      const dt = Math.min(100, now - last);
      last = now;
      const alpha = rt.frame(dt);
      renderer.step();
      // selection outline
      const sel = selectedRef.current ? rt.binder.entityOf(selectedRef.current) : undefined;
      const t = sel !== undefined ? rt.world.get(sel, 'transform') : undefined;
      const r = sel !== undefined ? rt.world.get(sel, 'renderable') : undefined;
      if (t && r) {
        const size = r['size'] as number;
        renderer.overlay.show('selection', [{ type: 'box', center: [t['x'] as number, t['y'] as number, t['z'] as number], half: [size * (t['sx'] as number) * 1.04, size * (t['sy'] as number) * 1.04, size * (t['sz'] as number) * 1.04], color: '#ffd24a' }]);
      } else renderer.overlay.hide('selection');
      renderer.render(alpha);
      frames++; acc += dt;
      if (acc > 500) { setFps(Math.round((frames * 1000) / acc)); frames = 0; acc = 0; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // click to select (ignore drags)
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent): void => { if (e.button === 0) down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent): void => {
      if (!down || e.button !== 0) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 5) return;
      const hit = renderer.pick(e.clientX, e.clientY);
      setSelected(hit.entity === null ? null : rt.binder.presetOf(hit.entity) ?? null);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      offTick(); detach(); renderer.unmount();
    };
  }, [rt, sceneId]);

  const scene = rt.store.get(sceneId);
  const objects = scene?.children['entities'] ?? [];
  const names = useMemo(() => objects.map((r) => ({ id: r.ref, name: rt.store.get(r.ref)?.name ?? r.ref })), [objects, rt, rev]);
  const sel = selected ? rt.store.get(selected) : undefined;
  const schema = sel ? rt.schemas.get(sel.kind) : undefined;
  const matRef = sel?.params['material'];
  const matId = matRef && typeof matRef === 'object' && !Array.isArray(matRef) && 'ref' in matRef ? String(matRef.ref) : null;
  const mat = matId ? rt.store.get(matId) : undefined;
  const matSchema = mat ? rt.schemas.get(mat.kind) : undefined;

  const edit = (id: PresetId) => (key: string, value: Value): void => { rt.commands.execute(cmd.setParam(`${id}.${key}`, value)); };
  const add = (shape: 'sphere' | 'box', body: 'dynamic' | 'static'): void => {
    const id = `obj-${Date.now().toString(36)}`;
    const params = { shape, size: shape === 'sphere' ? 0.5 : 1, x: 0, y: body === 'dynamic' ? 6 : 0.5, z: 0, body, restitution: 0.4, color: '#4aa3ff' };
    rt.commands.transaction(`Add ${shape}`, () => {
      rt.commands.execute(cmd.put({ id, kind: 'entity', name: shape === 'sphere' ? 'Ball' : 'Box', params, tier: 'play' }));
      rt.commands.execute(cmd.addChild(sceneId, 'entities', id));
    });
    setSelected(id);
  };
  const remove = (): void => {
    if (!selected) return;
    const index = objects.findIndex((r) => r.ref === selected);
    if (index >= 0) rt.commands.execute(cmd.removeChild(sceneId, 'entities', index, 'Delete'));
    setSelected(null);
  };
  const togglePlay = (): void => { if (rt.mode === 'edit') rt.play(); else rt.stop(); setMode(rt.mode); };

  return (
    <div className="app">
      <header className="bar">
        <strong className="brand">HM Harness</strong>
        <button className={mode === 'play' ? 'on' : ''} onClick={togglePlay}>{mode === 'play' ? '■ Stop' : '▶ Play'}</button>
        <button onClick={() => rt.commands.undo()} disabled={!rt.commands.canUndo}>Undo</button>
        <button onClick={() => rt.commands.redo()} disabled={!rt.commands.canRedo}>Redo</button>
        <span className="sep" />
        <button onClick={() => add('sphere', 'dynamic')}>+ Ball</button>
        <button onClick={() => add('box', 'static')}>+ Box</button>
        <button onClick={remove} disabled={!selected}>Delete</button>
        <span className="grow" />
        <div className="seg" role="group" aria-label="Detail level">
          {TIERS.map((t) => <button key={t} className={tier === t ? 'on' : ''} onClick={() => setTier(t)}>{TIER_LABEL[t]}</button>)}
        </div>
        <span className="fps">{fps} fps</span>
      </header>
      <main className="body">
        <aside className="panel left">
          <h3>Objects</h3>
          <ul className="list">
            {names.map((n) => (
              <li key={n.id}><button className={selected === n.id ? 'on' : ''} onClick={() => setSelected(n.id)}>{n.name}</button></li>
            ))}
          </ul>
        </aside>
        <div className="view" ref={host} />
        <aside className="panel right">
          {sel && schema ? (
            <>
              <h3>{sel.name}</h3>
              <Inspector schema={schema} params={sel.params} resolved={rt.store.resolve(sel.id).params} tier={tier} children={sel.children} onChange={edit(sel.id)} />
              {mat && matSchema ? (
                <>
                  <h3 className="sub">Material: {mat.name}</h3>
                  <Inspector schema={matSchema} params={mat.params} resolved={rt.store.resolve(mat.id).params} tier={tier} onChange={edit(mat.id)} />
                </>
              ) : null}
            </>
          ) : scene ? (
            <>
              <h3>{scene.name}</h3>
              <Inspector schema={rt.schemas.get('scene')!} params={scene.params} resolved={rt.store.resolve(scene.id).params} tier={tier} children={scene.children} onChange={edit(scene.id)} />
              <p className="hint">Click an object to edit it. Right-drag to look around, wheel to zoom.</p>
            </>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
