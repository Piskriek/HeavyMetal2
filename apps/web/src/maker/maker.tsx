import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { cmd, type PresetId, type Tier } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { attachOrbitControls, createThreeRenderer, SurfaceArray, STARTER_SURFACES, SURF, type ThreeRenderer } from '@hm/render';
import { Inspector, Palette, BrushPanel, PresetBrowser, Toolbar, type BrushState, type Manip, type PresetFilter, type PaletteItem } from '@hm/ui';
import { applyStroke, encodeTerrain, heightAt, normalYAtCell, type DirtyRect } from '@hm/terrain';
import { carveTrack, resample } from '@hm/trackgen';
import { addPoint, analyse, deletePoint, DRAFT_PRESETS, hitTest, insertOnSegment, movePoint, snapPoint, toCenterline, type TrackDraft } from '@hm/trackedit';
import { manipulateMove, DEFAULT_MANIPULATION } from '@hm/tools';
import { applyLook, lookOf, LOOKS } from '../look';
import { timeOfDayLook } from '@hm/looks';
import { buildMakerScene, PROP_CARDS, propSeed, type MakerScene } from './scene';
import { loadMap, saveMap, clearSavedMap } from './storage';
import { clearDress, commitDress, decorInstances, dress } from './dress';
import { rampBetween, stamp, type StampKind } from '@hm/terrainops';
import { DriversPanel } from './drivers';
import { SoundPanel } from './sound-panel';
import { HelpOverlay, helpSeen, markHelpSeen } from './help';
import { feedback, fx, setSoundEnabled, soundEnabled, toasts } from './feedback';

type ToolId = 'select' | 'brush' | 'shape' | 'track' | 'dress' | 'place' | 'delete';
type ShapeMode = 'ramp' | StampKind;
const SHAPES: { id: ShapeMode; label: string }[] = [{ id: 'ramp', label: 'Ramp' }, { id: 'mound', label: 'Hill' }, { id: 'crater', label: 'Crater' }, { id: 'plateau', label: 'Plateau' }, { id: 'ridge', label: 'Ridge' }, { id: 'volcano', label: 'Volcano' }, { id: 'dune', label: 'Dune' }];
const TOOLS = [
  { id: 'select', label: 'Select', icon: '⌖', hotkey: 'V' },
  { id: 'brush', label: 'Brush', icon: '🖌', hotkey: 'B' },
  { id: 'shape', label: 'Shape', icon: '⛰', hotkey: 'S' },
  { id: 'track', label: 'Track', icon: '〰', hotkey: 'T' },
  { id: 'dress', label: 'Dress', icon: '🌴', hotkey: 'D' },
  { id: 'place', label: 'Place', icon: '⬢', hotkey: 'P' },
  { id: 'delete', label: 'Delete', icon: '✕', hotkey: 'X' },
] as const;
const BRUSH_COLOR: Record<string, string> = { paint: '#ffd24a', raise: '#62e08a', lower: '#ff7a5e', smooth: '#6ab7ff', flatten: '#d59bff' };
const PALETTE: PaletteItem[] = STARTER_SURFACES.map((s) => ({ id: s.id, name: s.name, swatch: s.fallback, image: s.url }));

const readDraft = (rt: Runtime, trackId: PresetId): TrackDraft => {
  const p = rt.store.get(trackId);
  const pts = ((p?.params['points'] as unknown as number[][] | undefined) ?? []).map(([x, z]) => ({ x: x ?? 0, z: z ?? 0 }));
  return { points: pts, closed: p?.params['closed'] !== false, width: Number(p?.params['width'] ?? 12) };
};
const writeDraft = (rt: Runtime, trackId: PresetId, d: TrackDraft, label: string): void => {
  rt.commands.execute(cmd.setParam(`${trackId}.points`, d.points.map((p) => [p.x, p.z]) as never, label));
};

function useRev(rt: Runtime): number {
  return useSyncExternalStore((cb) => { const a = rt.store.subscribe(cb); const b = rt.commands.subscribe(cb); return () => { a(); b(); }; }, () => rt.store.list().length * 1e6 + rt.commands.history().length * 10 + (rt.commands.canUndo ? 1 : 0) + (rt.commands.canRedo ? 2 : 0));
}
const useToasts = (): readonly { id: number; text: string; kind: string }[] => useSyncExternalStore(toasts.subscribe, toasts.get);

export function MapMaker({ rt, onTestDrive }: { readonly rt: Runtime; readonly onTestDrive: () => void }): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const scene = useMemo<MakerScene>(() => loadMap(rt) ?? buildMakerScene(rt), [rt]);
  const [tool, setTool] = useState<ToolId>('brush');
  const [tier, setTier] = useState<Tier>('build');
  const [brush, setBrush] = useState<BrushState & { surface: number }>({ kind: 'paint', radius: 9, strength: 0.6, falloff: 'smooth', surface: SURF.grass });
  const [manip, setManip] = useState<Manip>({ snapGrid: 1, snapAngle: 15, snapToSurface: true, alignToNormal: false, axes: 'free', mirror: 'none', arrayCount: 1 });
  const [selected, setSelected] = useState<PresetId | null>(null);
  const [propName, setPropName] = useState<string>(PROP_CARDS[0]!.name);
  const [filter, setFilter] = useState<PresetFilter>({ text: '', kind: null, tag: null });
  const [sound, setSound] = useState(soundEnabled());
  const [shapeMode, setShapeMode] = useState<ShapeMode>('mound');
  const [shapeHeight, setShapeHeight] = useState(6);
  const [density, setDensity] = useState(1);
  const [previewing, setPreviewing] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [autosaved, setAutosaved] = useState<number | null>(null);
  const [help, setHelp] = useState<'first' | 'keys' | null>(() => (helpSeen() ? null : 'first'));
  const closeHelp = (): void => { markHelpSeen(); setHelp(null); fx('ui-click'); };
  const rev = useRev(rt);
  const toastList = useToasts();
  const live = useRef({ tool, brush, manip, selected, propName, shapeMode, shapeHeight });
  live.current = { tool, brush, manip, selected, propName, shapeMode, shapeHeight };
  const rendererRef = useRef<ThreeRenderer | null>(null);
  const [hourLive, setHourLive] = useState<number | null>(null);

  // ----- viewport, tools and feedback
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = createThreeRenderer({ shadows: true, background: 'sky' });
    renderer.mount(el, rt.world, rt.store);
    rendererRef.current = renderer;
    const surfaces = new SurfaceArray(STARTER_SURFACES);
    const showTerrain = (): void => {
      const st = rt.binder.terrain();
      if (!st) return;
      renderer.setTerrain(st.terrain, surfaces)?.setLook({ cliffSurface: SURF.cliff, soft: st.look.soft, normalStrength: st.look.bump });
    };
    showTerrain();
    const offTerrain = rt.binder.onTerrain(showTerrain);
    const showDecor = (): void => { const d = rt.binder.decor(); renderer.setDecor(d ? decorInstances(d.placements) : null); };
    showDecor();
    const offDecor = rt.binder.onDecor(showDecor);
    let rampA: readonly [number, number] | null = null;
    const cam = rt.store.get(scene.sceneId)?.params['camera'];
    if (cam && typeof cam === 'object' && 'ref' in cam) renderer.setCamera(String((cam as { ref: string }).ref));
    renderer.camera.set([150, 165, 160], [0, 2, 0]);
    (window as unknown as { mk: unknown }).mk = { renderer };
    const detach = attachOrbitControls(el, renderer, { touchOrbit: false });

    let hover: { point: readonly [number, number, number] | null; entity: number | null } = { point: null, entity: null };
    let stroking: { dirty: DirtyRect | null; target: number | null; last: { x: number; z: number } } | null = null;
    let drag: { entity: number; presetId: PresetId; start: readonly [number, number, number]; moved: boolean } | null = null;
    let trackDrag: { index: number; draft: TrackDraft } | null = null;
    let trackHover = -1;
    let lastSnap = '';
    let raf = 0;
    const t0 = performance.now();

    const terrainState = () => rt.binder.terrain();
    const snapHit = (p: readonly [number, number, number], normal: readonly [number, number, number] | null): readonly [number, number, number] => {
      const m = live.current.manip;
      const r = manipulateMove({ ...DEFAULT_MANIPULATION, snapGrid: m.snapGrid, snapAngle: m.snapAngle, snapToSurface: false, alignToNormal: false, axes: m.axes }, p, p);
      void normal;
      const out = r.position;
      const key = out.join(',');
      if (m.snapGrid > 0 && key !== lastSnap) { lastSnap = key; feedback('snap'); }
      return out;
    };
    const entityPresetOf = (entity: number | null): PresetId | null => (entity === null ? null : rt.binder.presetOf(entity) ?? null);

    // --- per-frame overlay: brush ring (pulses while painting), hover/selection boxes, track preview, placement ghost
    const frame = (now: number): void => {
      const L = live.current;
      const ts = terrainState();
      const pulse = stroking ? 1 + 0.07 * Math.sin((now - t0) / 55) : 1 + 0.015 * Math.sin((now - t0) / 400);
      if (L.tool === 'brush' && hover.point) {
        const c = L.brush.kind === 'paint' ? (STARTER_SURFACES.find((s) => s.id === L.brush.surface)?.fallback ?? '#ffd24a') : BRUSH_COLOR[L.brush.kind]!;
        const [x, y, z] = hover.point;
        renderer.overlay.show('brush', [
          { type: 'ring', center: [x, y + 0.08, z], normal: [0, 1, 0], radius: L.brush.radius * pulse, color: BRUSH_COLOR[L.brush.kind]! },
          { type: 'ring', center: [x, y + 0.08, z], normal: [0, 1, 0], radius: L.brush.radius * 0.5 * pulse, color: c },
          { type: 'handle', id: 'brush-c', position: [x, y + 0.2, z], color: c, size: stroking ? 0.5 : 0.3 },
        ]);
      } else if (L.tool === 'shape' && hover.point && ts) {
        const [x, y, z] = hover.point;
        const r = Math.max(3, L.brush.radius), col = rampA ? '#9be3ff' : '#ffb35e';
        const items: import('@hm/contracts').OverlayShape[] = [
          { type: 'ring', center: [x, y + 0.1, z], normal: [0, 1, 0], radius: r * pulse, color: col },
          { type: 'handle', id: 'shape-c', position: [x, y + 0.3, z], color: col, size: 0.35 },
        ];
        if (L.shapeMode !== 'ramp') items.push({ type: 'line', from: [x, y + 0.1, z], to: [x, y + 0.1 + L.shapeHeight * (L.shapeMode === 'crater' ? 0.3 : 1), z], color: col });
        if (rampA) {
          const ay = heightAt(ts.terrain, rampA[0], rampA[1]);
          items.push({ type: 'handle', id: 'ramp-a', position: [rampA[0], ay + 0.4, rampA[1]], color: '#ffffff', size: 0.5 });
          items.push({ type: 'line', from: [rampA[0], ay + 0.4, rampA[1]], to: [x, y + 0.4, z], color: '#9be3ff' });
        }
        renderer.overlay.show('brush', items);
      } else renderer.overlay.hide('brush');

      const shapes: import('@hm/contracts').OverlayShape[] = [];
      const boxOf = (entity: number | null, color: string): void => {
        if (entity === null) return;
        const t = rt.world.get(entity, 'transform'), r = rt.world.get(entity, 'renderable');
        if (!t || !r) return;
        const s = Number(r['size']);
        shapes.push({ type: 'box', center: [Number(t['x']), Number(t['y']), Number(t['z'])], half: [s * Number(t['sx']) * 1.06, s * Number(t['sy']) * 1.06, s * Number(t['sz']) * 1.06], color });
      };
      if (L.tool === 'select' || L.tool === 'delete') {
        if (hover.entity !== null && entityPresetOf(hover.entity)) boxOf(hover.entity, L.tool === 'delete' ? '#ff5e5e' : '#9be3ff');
      }
      if (L.selected) boxOf(rt.binder.entityOf(L.selected) ?? null, '#ffd24a');
      if (L.tool === 'place' && hover.point) {
        const seed = propSeed(L.propName);
        const s = Number(seed?.params['size'] ?? 0.5);
        const p = snapHit(hover.point, null);
        shapes.push({ type: 'box', center: [p[0], p[1] + s * Number(seed?.params['scaleY'] ?? 1), p[2]], half: [s * Number(seed?.params['scaleX'] ?? 1), s * Number(seed?.params['scaleY'] ?? 1), s * Number(seed?.params['scaleZ'] ?? 1)], color: '#8affc8' });
        shapes.push({ type: 'ring', center: [p[0], p[1] + 0.05, p[2]], normal: [0, 1, 0], radius: 0.9 + 0.1 * Math.sin((now - t0) / 220), color: '#8affc8' });
      }
      if (shapes.length) renderer.overlay.show('sel', shapes); else renderer.overlay.hide('sel');

      if (L.tool === 'track' && ts) {
        const draft = trackDrag?.draft ?? readDraft(rt, scene.trackId);
        const lines: import('@hm/contracts').OverlayShape[] = [];
        const a = analyse(draft);
        const col = a.valid ? '#6aff9e' : draft.points.length < 3 ? '#9be3ff' : '#ff9a5e';
        const cl = toCenterline(draft, 5);
        const y = (x: number, z: number): number => heightAt(ts.terrain, x, z) + 0.4;
        if (cl.length > 1) lines.push({ type: 'ribbon', points: cl.map((c) => [c[0], y(c[0], c[1]), c[1]] as const), width: draft.width, color: col, closed: draft.closed && draft.points.length >= 3, opacity: 0.38 });
        for (let i = 0; i < cl.length - (draft.closed ? 0 : 1); i++) {
          const p = cl[i]!, q = cl[(i + 1) % cl.length]!;
          lines.push({ type: 'line', from: [p[0], y(p[0], p[1]), p[1]], to: [q[0], y(q[0], q[1]), q[1]], color: col });
        }
        if (draft.points.length === 2) lines.push({ type: 'line', from: [draft.points[0]!.x, y(draft.points[0]!.x, draft.points[0]!.z), draft.points[0]!.z], to: [draft.points[1]!.x, y(draft.points[1]!.x, draft.points[1]!.z), draft.points[1]!.z], color: col });
        draft.points.forEach((p, i) => lines.push({ type: 'handle', id: `cp${i}`, position: [p.x, y(p.x, p.z) + 0.5, p.z], color: i === (trackDrag?.index ?? trackHover) ? '#ffffff' : i === 0 ? '#ffd24a' : col, size: i === (trackDrag?.index ?? trackHover) ? 1.5 : 1.0 }));
        renderer.overlay.show('track', lines);
      } else renderer.overlay.hide('track');
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    let lastT = performance.now();
    const renderLoop = (): void => {
      const now = performance.now();
      const alpha = rt.mode === 'play' ? rt.frame(Math.min(100, now - lastT)) : 1;
      lastT = now;
      renderer.step(); renderer.render(alpha); loopId = requestAnimationFrame(renderLoop);
    };
    let loopId = requestAnimationFrame(renderLoop);

    // --- pointer handling
    const commitTerrain = (label: string): void => {
      const ts = terrainState();
      if (!ts) return;
      rt.commands.execute(cmd.setParam(`${scene.terrainId}.data`, encodeTerrain(ts.terrain) as never, label));
    };
    const dab = (x: number, z: number): void => {
      const ts = terrainState();
      if (!ts || !stroking) return;
      const b = live.current.brush;
      const perDab = b.kind === 'paint' ? Math.min(1, b.strength) : b.strength * 0.35;
      const rect = applyStroke(ts.terrain, { kind: b.kind, x, z, radius: b.radius, strength: perDab, falloff: b.falloff, surface: b.surface, ...(stroking.target !== null ? { target: stroking.target } : {}) }, stroking.last, { x, z }, Math.max(0.5, b.radius * 0.3));
      stroking.last = { x, z };
      if (!rect) return;
      stroking.dirty = stroking.dirty ? { c0: Math.min(stroking.dirty.c0, rect.c0), r0: Math.min(stroking.dirty.r0, rect.r0), c1: Math.max(stroking.dirty.c1, rect.c1), r1: Math.max(stroking.dirty.r1, rect.r1) } : rect;
      renderer.refreshTerrain(rect);
      fx(b.kind === 'paint' ? 'paint-tick' : 'sculpt-tick', { minGapMs: b.kind === 'paint' ? 75 : 95, volume: 0.5 + 0.5 * Math.min(1, b.strength), pitch: 0.92 + Math.random() * 0.16 });
    };
    const pickAt = (e: PointerEvent) => renderer.pick(e.clientX, e.clientY);
    const onMove = (e: PointerEvent): void => {
      const h = pickAt(e);
      hover = { point: h.point, entity: h.entity };
      const L = live.current;
      if (L.tool === 'brush' && stroking && h.point) dab(h.point[0], h.point[2]);
      if (L.tool === 'select' && drag && h.point) {
        const p = snapHit(h.point, h.normal);
        const ts = terrainState();
        const y = ts ? heightAt(ts.terrain, p[0], p[2]) : p[1];
        const half = Number(rt.world.get(drag.entity, 'renderable')?.['size'] ?? 0.5) * Number(rt.world.get(drag.entity, 'transform')?.['sy'] ?? 1);
        rt.world.set(drag.entity, 'transform', { x: p[0], y: y + half, z: p[2] });
        drag.moved = true;
      }
      if (L.tool === 'track' && h.point) {
        const ts = terrainState();
        void ts;
        const draft = trackDrag?.draft ?? readDraft(rt, scene.trackId);
        if (trackDrag) {
          const p = snapPoint([h.point[0], h.point[2]], L.manip.snapGrid);
          trackDrag.draft = movePoint(draft, trackDrag.index, p);
        } else {
          const hit = hitTest(draft, [h.point[0], h.point[2]], 3.5);
          const idx = hit.kind === 'point' ? hit.index : -1;
          if (idx !== trackHover && idx >= 0) fx('ui-hover', { minGapMs: 80 });
          trackHover = idx;
        }
      }
    };
    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0 || rt.mode === 'play') return;
      const L = live.current;
      const h = pickAt(e);
      const ts = terrainState();
      if (L.tool === 'brush' && h.point && ts) {
        stroking = { dirty: null, target: L.brush.kind === 'flatten' ? h.point[1] : null, last: { x: h.point[0], z: h.point[2] } };
        el.setPointerCapture(e.pointerId);
        dab(h.point[0], h.point[2]);
      } else if (L.tool === 'shape' && h.point && ts) {
        const x = h.point[0], z = h.point[2];
        if (L.shapeMode === 'ramp') {
          if (!rampA) { rampA = [x, z]; fx('select'); toasts.push('Ramp: click where it should end', 'info', 1800); }
          else {
            const a = rampA; rampA = null;
            const width = Math.max(4, L.brush.radius * 0.7);
            const rect = rampBetween(ts.terrain, a, [x, z], { width, shoulder: width * 0.6 });
            if (rect) { renderer.refreshTerrain(rect); commitTerrain('Ramp'); feedback('success', 'Ramp built'); } else feedback('error', 'Nothing to change there');
          }
        } else {
          const rect = stamp(ts.terrain, L.shapeMode, [x, z], Math.max(6, L.brush.radius * 2), { height: L.shapeHeight, seed: Math.floor(Math.random() * 99999), rotation: Math.random() * Math.PI });
          if (rect) { renderer.refreshTerrain(rect); commitTerrain(`Stamp ${L.shapeMode}`); feedback('success'); fx('sculpt-tick', { volume: 1, pitch: 0.7 }); } else feedback('error', 'Outside the island');
        }
      } else if (L.tool === 'select') {
        const pid = entityPresetOf(h.entity);
        if (pid) { setSelected(pid); feedback('select'); const t = rt.world.get(h.entity!, 'transform'); drag = { entity: h.entity!, presetId: pid, start: [Number(t?.['x']), Number(t?.['y']), Number(t?.['z'])], moved: false }; el.setPointerCapture(e.pointerId); }
        else setSelected(null);
      } else if (L.tool === 'delete') {
        const pid = entityPresetOf(h.entity);
        const children = rt.store.get(scene.sceneId)?.children['entities'] ?? [];
        const idx = children.findIndex((c) => c.ref === pid);
        if (pid && idx >= 0) { rt.commands.execute(cmd.removeChild(scene.sceneId, 'entities', idx, `Delete ${rt.store.get(pid)?.name ?? 'object'}`)); feedback('deleted', `Deleted ${rt.store.get(pid)?.name ?? 'object'}`); setSelected(null); }
      } else if (L.tool === 'place' && h.point) {
        const seed = propSeed(L.propName);
        if (!seed) return;
        const p = snapHit(h.point, h.normal);
        const s = Number(seed.params['size'] ?? 0.5);
        const id = `prop-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
        const params = { ...seed.params, x: p[0], y: p[1] + s * Number(seed.params['scaleY'] ?? 1), z: p[2], ...(seed.refs?.['material'] && scene.materialIds.get(seed.refs['material']) ? { material: { ref: scene.materialIds.get(seed.refs['material'])! } } : {}) };
        rt.commands.transaction(`Place ${seed.name}`, () => {
          rt.commands.execute(cmd.put({ id, kind: 'entity', name: seed.name, params: params as never, tier: 'play' }));
          rt.commands.execute(cmd.addChild(scene.sceneId, 'entities', id));
        });
        setSelected(id);
        feedback('placed', `Placed ${seed.name}`);
      } else if (L.tool === 'track' && h.point) {
        const draft = readDraft(rt, scene.trackId);
        const hit = hitTest(draft, [h.point[0], h.point[2]], 3.5);
        if (hit.kind === 'point') { trackDrag = { index: hit.index, draft }; el.setPointerCapture(e.pointerId); fx('select'); }
        else {
          const p = snapPoint([h.point[0], h.point[2]], L.manip.snapGrid);
          const next = hit.kind === 'segment' ? insertOnSegment(draft, p) : addPoint(draft, p);
          writeDraft(rt, scene.trackId, next, hit.kind === 'segment' ? 'Insert track point' : 'Add track point');
          feedback('placed');
          const a = analyse(next);
          if (next.points.length >= 3 && !a.valid && a.issues[0]) toasts.push(a.issues[0], 'warn');
        }
      }
    };
    const onUp = (e: PointerEvent): void => {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (stroking) {
        const s = stroking; stroking = null;
        if (s.dirty) { const b = live.current.brush; const name = b.kind === 'paint' ? `Paint ${STARTER_SURFACES.find((x) => x.id === b.surface)?.name ?? ''}` : `Sculpt (${b.kind})`; commitTerrain(name); feedback('success'); toasts.push(name, 'ok', 1400); }
      }
      if (drag) {
        const d = drag; drag = null;
        if (d.moved) {
          const t = rt.world.get(d.entity, 'transform');
          rt.world.set(d.entity, 'transform', { x: d.start[0], y: d.start[1], z: d.start[2] });
          rt.commands.transaction('Move object', () => {
            for (const [k, v] of [['x', Number(t?.['x'])], ['y', Number(t?.['y'])], ['z', Number(t?.['z'])]] as const) rt.commands.execute(cmd.setParam(`${d.presetId}.${k}`, v, 'Move object'));
          });
          fx('place', { volume: 0.7, pitch: 1.1 });
        }
      }
      if (trackDrag) {
        const d = trackDrag; trackDrag = null;
        writeDraft(rt, scene.trackId, d.draft, 'Move track point');
        feedback('placed');
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      const L = live.current;
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); doRedo(); return; }
      const tools: Record<string, ToolId> = { v: 'select', b: 'brush', s: 'shape', t: 'track', d: 'dress', p: 'place', x: 'delete' };
      if (tools[k]) { setTool(tools[k]!); feedback('tool'); return; }
      if (k === '[') setBrush((b) => ({ ...b, radius: Math.max(1, b.radius - (b.radius > 12 ? 2 : 1)) }));
      if (k === ']') setBrush((b) => ({ ...b, radius: Math.min(60, b.radius + (b.radius >= 12 ? 2 : 1)) }));
      if (/^[1-9]$/.test(k)) { const s = STARTER_SURFACES[Number(k) - 1]; if (s) { setBrush((b) => ({ ...b, surface: s.id, kind: 'paint' })); setTool('brush'); fx('select'); } }
      if ((k === 'delete' || k === 'backspace') && L.tool === 'track' && trackHover >= 0) {
        const draft = readDraft(rt, scene.trackId);
        writeDraft(rt, scene.trackId, deletePoint(draft, trackHover), 'Delete track point'); feedback('deleted'); trackHover = -1;
      } else if ((k === 'delete' || k === 'backspace') && L.selected) {
        const children = rt.store.get(scene.sceneId)?.children['entities'] ?? [];
        const idx = children.findIndex((c) => c.ref === L.selected);
        if (idx >= 0) { rt.commands.execute(cmd.removeChild(scene.sceneId, 'entities', idx, 'Delete object')); feedback('deleted', 'Deleted'); setSelected(null); }
      }
      if (k === '?') setHelp((h) => (h ? null : 'keys'));
      if (k === 'escape') { setSelected(null); setHelp(null); }
    };
    const lastLabel = (undone: boolean): string => { const h = rt.commands.history().filter((x) => x.undone === undone); return (undone ? h[0] : h[h.length - 1])?.label ?? ''; };
    const doUndo = (): void => { const label = lastLabel(false); if (rt.commands.undo()) feedback('undo', label); else fx('ui-error'); };
    const doRedo = (): void => { const label = lastLabel(true); if (rt.commands.redo()) feedback('redo', label); else fx('ui-error'); };
    (window as unknown as { makerUndo: () => void; makerRedo: () => void }).makerUndo = doUndo;
    (window as unknown as { makerUndo: () => void; makerRedo: () => void }).makerRedo = doRedo;
    el.addEventListener('pointerdown', onDown, true);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(loopId);
      el.removeEventListener('pointerdown', onDown, true); el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      offTerrain(); offDecor(); detach(); renderer.unmount();
    };
  }, [rt, scene]);

  // ----- look (sky, sun, fog, exposure): from the scene preset, or live while the time-of-day slider is dragged
  const sceneParams = rt.store.get(scene.sceneId)?.params;
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !sceneParams) return;
    applyLook(r, hourLive !== null ? timeOfDayLook(hourLive) : lookOf(sceneParams), 0.22);
  }, [sceneParams, hourLive]);
  const lookId = String(sceneParams?.['look'] ?? 'noon-clear');
  const hourSaved = Number(sceneParams?.['timeOfDay'] ?? -1);

  // ----- panels
  const draft = readDraft(rt, scene.trackId);
  const analysis = useMemo(() => analyse(draft), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = selected ? rt.store.get(selected) : undefined;
  const schema = sel ? rt.schemas.get(sel.kind) : undefined;
  void normalYAtCell;
  const history = rt.commands.history();
  const doUndo = (): void => (window as unknown as { makerUndo: () => void }).makerUndo();
  const doRedo = (): void => (window as unknown as { makerRedo: () => void }).makerRedo();
  const pick = (t: ToolId): void => { setTool(t); feedback('tool'); };
  // autosave 1.5 s after the last edit (never while previewing, so driver values are not saved)
  useEffect(() => {
    if (rt.commands.history().length === 0) return;
    const t = setTimeout(() => { if (rt.mode === 'edit' && saveMap(rt, scene.sceneId)) setAutosaved(Date.now()); }, 1500);
    return () => clearTimeout(t);
  }, [rev]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (): void => { if (saveMap(rt, scene.sceneId)) feedback('saved', 'Map saved'); else feedback('error', 'Could not save the map'); };

  const carve = (): void => {
    const ts = rt.binder.terrain();
    if (!ts) return;
    if (!analysis.valid) { feedback('error', analysis.issues[0] ?? 'The track is not valid yet'); return; }
    const clone = { spec: ts.terrain.spec, heights: ts.terrain.heights.slice(), surfaceA: ts.terrain.surfaceA.slice(), surfaceB: ts.terrain.surfaceB.slice(), blend: ts.terrain.blend.slice() };
    const centre = resample(toCenterline(draft, 6), 6);
    carveTrack(clone, { points: centre, width: draft.width }, { shoulder: 7, roadSurface: SURF.pumice, shoulderSurface: SURF.dunes });
    rt.commands.execute(cmd.setParam(`${scene.terrainId}.data`, encodeTerrain(clone) as never, 'Carve track into terrain'));
    feedback('success', 'Track carved into the island');
  };

  return (
    <div className="maker">
      <header className="bar">
        <strong className="brand">Map Maker</strong>
        <button onClick={doUndo} disabled={!rt.commands.canUndo}>↶ Undo</button>
        <button onClick={doRedo} disabled={!rt.commands.canRedo}>↷ Redo</button>
        <span className="hist" title={history.map((h) => h.label).join('\n')}>{history.length ? `${history.filter((h) => !h.undone).length} steps` : 'no edits yet'}</span>
        <span className="saved" title="Your map saves itself a moment after every change">{autosaved ? 'autosaved ✓' : ''}</span>
        <span className="grow" />
        <button onClick={() => { const on = !sound; setSound(on); setSoundEnabled(on); if (on) fx('ui-toggle'); }}>{sound ? '🔊' : '🔇'}</button>
        <div className="seg">{(['play', 'build', 'pro'] as Tier[]).map((t) => <button key={t} className={tier === t ? 'on' : ''} onClick={() => { setTier(t); fx('ui-click'); }}>{t === 'play' ? 'Easy' : t === 'build' ? 'Build' : 'Pro'}</button>)}</div>
        <button title="Shortcuts and tips (?)" onClick={() => { setHelp('keys'); fx('ui-click'); }}>?</button>
        <button className={soundOpen ? 'on' : ''} title="Hear and edit every sound" onClick={() => { setSoundOpen(!soundOpen); fx('ui-toggle'); }}>🎚 Sounds</button>
        <button className={previewing ? 'on' : ''} title="Run the scene so drivers and physics move, then stop to go back to editing" onClick={() => { if (rt.mode === 'play') { rt.stop(); setPreviewing(false); fx('ui-toggle'); } else { rt.play(); setPreviewing(true); fx('go', { volume: 0.5 }); toasts.push('Previewing: edits are paused. Press Stop to go back.', 'info', 2200); } }}>{previewing ? '■ Stop' : '▶ Preview'}</button>
        <button onClick={save}>💾 Save</button>
        <button onClick={() => { if (confirm('Start a new map? The saved one will be replaced.')) { clearSavedMap(); location.reload(); } }}>New</button>
        <button className="go" onClick={() => { if (!analysis.valid) { feedback('error', analysis.issues[0] ?? 'Draw a closed track first'); return; } carve(); save(); fx('go'); onTestDrive(); }}>▶ Test drive</button>
      </header>
      <div className="looks" role="group" aria-label="Look">
        {LOOKS.map((l) => (
          <button key={l.id} className={hourSaved < 0 && lookId === l.id ? 'on' : ''} title={l.doc} onClick={() => { rt.commands.transaction(`Look: ${l.name}`, () => { rt.commands.execute(cmd.setParam(`${scene.sceneId}.look`, l.id, `Look: ${l.name}`)); rt.commands.execute(cmd.setParam(`${scene.sceneId}.timeOfDay`, -1, `Look: ${l.name}`)); }); fx('ui-toggle'); }}>{l.name}</button>
        ))}
        <label className="hour" title="Drag to move the sun through the day"><span>{(hourLive ?? (hourSaved >= 0 ? hourSaved : 12)).toFixed(1)} h</span>
          <input type="range" min={0} max={24} step={0.1} value={hourLive ?? (hourSaved >= 0 ? hourSaved : 12)}
            onChange={(e) => setHourLive(Number(e.target.value))}
            onPointerUp={() => { if (hourLive !== null) { rt.commands.execute(cmd.setParam(`${scene.sceneId}.timeOfDay`, Math.round(hourLive * 10) / 10, 'Time of day')); setHourLive(null); fx('ui-click'); } }}
            onKeyUp={() => { if (hourLive !== null) { rt.commands.execute(cmd.setParam(`${scene.sceneId}.timeOfDay`, Math.round(hourLive * 10) / 10, 'Time of day')); setHourLive(null); } }} />
        </label>
      </div>
      <main className="body">
        <aside className="panel left">
          <Toolbar tools={TOOLS as never} active={tool} onSelect={(id) => pick(id as ToolId)} manip={manip} onManip={(p) => { setManip({ ...manip, ...p }); fx('ui-toggle'); }} tier={tier} />
          <p className="hint">V select · B brush · T track · P place · X delete · [ ] size · 1–9 surface · Ctrl+Z undo</p>
        </aside>
        <div className="view" ref={host} />
        <aside className="panel right">
          {soundOpen ? <SoundPanel rt={rt} tier={tier} rev={rev} onFeedback={(k, t) => feedback(k, t)} /> : null}
          <div style={soundOpen ? { display: 'none' } : undefined}>
          {tool === 'brush' ? (
            <>
              <h3>Brush</h3>
              <BrushPanel brush={brush} tier={tier} onChange={(p) => { setBrush({ ...brush, ...p }); fx('ui-click', { volume: 0.5 }); }} />
              {brush.kind === 'paint' ? (<><h3 className="sub">Surface</h3><Palette items={PALETTE} selected={brush.surface} onSelect={(id) => { setBrush({ ...brush, surface: id }); fx('select'); }} columns={4} /></>) : null}
            </>
          ) : null}
          {tool === 'shape' ? (
            <>
              <h3>Shape the land</h3>
              <div className="btns">{SHAPES.map((s) => <button key={s.id} className={shapeMode === s.id ? 'on' : ''} onClick={() => { setShapeMode(s.id); fx('select'); }}>{s.label}</button>)}</div>
              <label className="row">Size <input type="range" min={3} max={30} step={1} value={brush.radius} onChange={(e) => setBrush({ ...brush, radius: Number(e.target.value) })} /> <span>{brush.radius}</span></label>
              {shapeMode !== 'ramp' ? <label className="row">Height <input type="range" min={1} max={20} step={0.5} value={shapeHeight} onChange={(e) => setShapeHeight(Number(e.target.value))} /> <span>{shapeHeight} m</span></label> : null}
              <p className="hint">{shapeMode === 'ramp' ? 'Click the start, then the end: the ground is graded between them.' : 'Click the island to stamp. Stamps add up; Ctrl+Z removes the last one.'}</p>
            </>
          ) : null}
          {tool === 'dress' ? (
            <>
              <h3>Dress the island</h3>
              <label className="row">Density <input type="range" min={0.2} max={2} step={0.1} value={density} onChange={(e) => setDensity(Number(e.target.value))} /> <span>{density.toFixed(1)}x</span></label>
              <div className="btns">
                <button className="go" onClick={() => { const ts = rt.binder.terrain(); if (!ts) return; const seed = Math.floor(Math.random() * 99999); const d = dress(ts.terrain, draft, seed, density); commitDress(rt, scene.sceneId, d, seed, density); feedback('success', `${d.count} plants placed`); }}>Scatter palms, bushes and rocks</button>
                <button onClick={() => { if (clearDress(rt, scene.sceneId)) feedback('deleted', 'Foliage cleared'); else fx('ui-error'); }}>Clear</button>
              </div>
              <p className="hint">Keeps clear of your track. Every press rolls a new arrangement; Ctrl+Z goes back.</p>
            </>
          ) : null}
          {tool === 'place' ? (<><h3>Props</h3><PresetBrowser cards={PROP_CARDS} filter={filter} tier={tier} onFilter={(p) => setFilter({ ...filter, ...p })} onPick={(id) => { setPropName(id); fx('select'); }} /><p className="hint">Selected: <b>{propName}</b>. Click the island to place; the grid snap applies.</p></>) : null}
          {tool === 'track' ? (
            <>
              <h3>Track</h3>
              <p className="status" role="status" data-valid={analysis.valid}>{analysis.valid ? `✓ Valid circuit · ${Math.round(analysis.length)} m · tightest bend ${analysis.minRadius === Infinity ? '—' : Math.round(analysis.minRadius) + ' m'}` : (analysis.issues[0] ?? 'Click the island to add control points')}</p>
              <label className="row">Road width <input type="range" min={6} max={24} step={0.5} value={draft.width} onChange={(e) => rt.commands.execute(cmd.setParam(`${scene.trackId}.width`, Number(e.target.value), 'Road width'))} /> <span>{draft.width} m</span></label>
              <div className="btns">
                <button onClick={carve} disabled={!analysis.valid}>Carve into terrain</button>
                <button onClick={() => { writeDraft(rt, scene.trackId, { ...draft, points: [] }, 'Clear track'); feedback('deleted', 'Track cleared'); }}>Clear</button>
              </div>
              <h3 className="sub">Layouts</h3>
              <div className="btns">{DRAFT_PRESETS.map((p) => <button key={p.id} title={p.doc} onClick={() => { writeDraft(rt, scene.trackId, { ...draft, points: p.draft.points }, `Layout: ${p.name}`); rt.commands.execute(cmd.setParam(`${scene.trackId}.width`, p.draft.width, 'Road width')); fx('ui-success'); }}>{p.name}</button>)}</div>
              <p className="hint">Click to add a point · click a line to insert · drag points · hover + Delete removes one.</p>
            </>
          ) : null}
          {tool === 'select' ? (sel && schema ? (<><h3>{sel.name}</h3><DriversPanel rt={rt} sceneId={scene.sceneId} propId={sel.id} tier={tier} numberKeys={schema.variables.filter((v) => v.type === 'number' || v.type === 'int').map((v) => ({ key: v.key, label: v.label }))} onFeedback={(k, t) => feedback(k, t)} /><Inspector schema={schema} params={sel.params} resolved={rt.store.resolve(sel.id).params} tier={tier} onChange={(k, v) => { rt.commands.execute(cmd.setParam(`${sel.id}.${k}`, v)); fx('ui-click', { volume: 0.4 }); }} /></>) : <p className="hint">Click a prop to select it, drag to move it. Props you place appear here.</p>) : null}
          {tool === 'delete' ? <p className="hint">Click a prop to delete it. Ctrl+Z brings it back.</p> : null}
          </div>
        </aside>
      </main>
      {help ? <HelpOverlay firstRun={help === 'first'} onClose={closeHelp} /> : null}
      <div className="toasts" aria-live="polite">{toastList.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
    </div>
  );
}
