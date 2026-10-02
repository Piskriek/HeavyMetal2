import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Runtime } from '@hm/engine';
import { createThreeRenderer, SurfaceArray, STARTER_SURFACES, SURF, type ThreeRenderer } from '@hm/render';
import { heightAt } from '@hm/terrain';
import { encodeModel, type VoxelModel } from '@hm/voxel';
import { MODELS } from '@hm/voxelart';
import { applyLook, lookOf } from './look';
import { decorInstances } from './maker/dress';
import { loadMap } from './maker/storage';
import { buildMakerScene, type MakerScene } from './maker/scene';
import { placementsOf } from './maker/models-panel';
import { fx } from './maker/feedback';
import { BuildController } from './build/build-controller';
import { Crosshair, Hotbar, Inventory } from './build/hud';
import { loadHotbar, saveHotbar, type HotItem } from './build/hotbar';

/**
 * My Island: you are the goblin, on your own island, in third person (V for first person). W A S D / arrows move, Shift runs.
 * Build mode (grown-up switch on): click to aim with the crosshair, the hotbar (1-9) holds your tools, E opens the inventory, Ctrl+Z undoes.
 * Esc opens the jump menu: Main menu, Build mode (the full editor), Activities, Multiplayer.
 */
const GOBLIN_BLOCK = 0.04;
const SEA = 0.35; // lower ground than this is water: the goblin stays on land

export function IslandWalk(props: {
  readonly rt: Runtime; readonly intro?: boolean; readonly grownUp?: boolean; readonly skin?: 'flat' | 'pbr';
  readonly onEdit: () => void; readonly onActivities: () => void; readonly onHub: () => void; readonly onMainMenu: () => void; readonly onIntroDone?: () => void;
}): ReactElement {
  const { rt, onEdit, onActivities, onHub, onMainMenu, onIntroDone } = props;
  const host = useRef<HTMLDivElement>(null);
  const introRef = useRef(props.intro === true);
  const terrainView = useRef<{ setLook: (l: { skin?: 'flat' | 'pbr' }) => void } | null>(null);
  const skinRef = useRef(props.skin ?? 'flat');
  skinRef.current = props.skin ?? 'flat';
  useEffect(() => { terrainView.current?.setLook({ skin: props.skin ?? 'flat' }); }, [props.skin]);

  const [menu, setMenu] = useState(false);
  const [inv, setInv] = useState(false);
  const [locked, setLocked] = useState(false);
  const [slots, setSlots] = useState<(HotItem | null)[]>(() => loadHotbar());
  const [sel, setSel] = useState(2);
  const [note, setNote] = useState('');
  const buildOn = props.grownUp !== false;
  const live = useRef({ menu, inv, slots, sel, buildOn });
  live.current = { menu, inv, slots, sel, buildOn };
  const scene = useMemo<MakerScene>(() => loadMap(rt) ?? buildMakerScene(rt), [rt]);
  const noteTimer = useRef(0);
  const say = useCallback((t: string) => { setNote(t); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 1800); }, []);
  const api = useRef<{ lock: () => void; unlock: () => void } | null>(null);
  useEffect(() => { saveHotbar(slots); }, [slots]);

  const pickItem = (item: HotItem): void => { setSlots((s) => s.map((x, i) => (i === sel ? item : x))); fx('select'); };
  const openInv = (on: boolean): void => { setInv(on); if (on) api.current?.unlock(); else api.current?.lock(); };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer: ThreeRenderer = createThreeRenderer({ shadows: true, background: 'sky' });
    renderer.mount(el, rt.world, rt.store);
    renderer.setQuality('high');
    (window as unknown as { hmRenderer: unknown }).hmRenderer = renderer; // console: hmRenderer.burst({...})
    const surfaces = new SurfaceArray(STARTER_SURFACES);
    const showTerrain = (): void => {
      const st = rt.binder.terrain();
      if (!st) return;
      const tv = renderer.setTerrain(st.terrain, surfaces);
      tv?.setLook({ cliffSurface: SURF.cliff, soft: st.look.soft, normalStrength: st.look.bump, skin: skinRef.current });
      terrainView.current = tv;
    };
    showTerrain();
    const offTerrain = rt.binder.onTerrain(showTerrain);
    const sceneParams = rt.store.get(scene.sceneId)?.params;
    if (sceneParams) applyLook(renderer, lookOf(sceneParams));
    const d = rt.binder.decor();
    renderer.setDecor(d ? decorInstances(d.placements) : null);

    // models of the island plus the goblin as the last one, so the goblin can be moved without rebuilding anything
    const goblin = MODELS.find((m) => m.id === 'goblin')!.build() as unknown as VoxelModel;
    const goblinPlacement = { params: { data: encodeModel(goblin), scale: GOBLIN_BLOCK, ao: true, greedy: true, castShadow: true }, x: 0, y: 0, z: 0, yawDeg: 0 };
    let avatarIndex = 0;
    const refreshModels = (): void => { const others = placementsOf(rt, scene.sceneId); avatarIndex = others.length; renderer.setModels([...others, goblinPlacement]); };
    refreshModels();

    const ground = (x: number, z: number): number => { const st = rt.binder.terrain(); return st ? heightAt(st.terrain, x, z) : 0; };
    const builder = new BuildController(rt, renderer, scene.sceneId, scene.terrainId, refreshModels, say);
    let px = 0, pz = 0;
    for (let r = 0; r < 120 && ground(px, pz) < SEA; r += 2) { px = r; pz = 0; }
    let py = ground(px, pz), face = 0, vy = 0;
    let camYaw = Math.PI, camPitch = 0.38, camDist = 5.5, fpv = false;
    const intro = { on: introRef.current, t: 0, ms: 3200 };
    if (intro.on) { camPitch = 1.3; camDist = 150; }
    let eye: [number, number, number] | null = null;
    const down = new Set<string>();
    let mouse = 0; // bit 1 = left, 2 = right
    let firstUse = false;
    let pointerLocked = false;
    let lockFails = 0;
    let softAim = false; // pointer lock is not available (some browsers, embedded views): aim at the centre, look with the right button
    let suppressMenu = false;

    // the whole shell is the pointer-lock target, so the mouse stays captured through the dive and the menus
    const root = (el.closest('.shell') as HTMLElement | null) ?? el;
    const isLocked = (): boolean => !!document.pointerLockElement && root.contains(document.pointerLockElement);
    const centre = (): { x: number; y: number } => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const aim = () => { const c = centre(); const p = renderer.pick(c.x, c.y); return p.point ? { point: p.point, normal: p.normal ?? null } : null; };

    // the browser refuses a re-lock for a moment after Esc: only give up on the mouse after three refusals in a row
    const failLock = (): void => { if (++lockFails >= 3) { softAim = true; setLocked(true); } };
    api.current = {
      lock: () => {
        if (document.pointerLockElement) return;
        try { const r = root.requestPointerLock() as unknown as Promise<void> | undefined; r?.catch?.(() => failLock()); } catch { failLock(); }
      },
      unlock: () => { suppressMenu = true; if (document.pointerLockElement) document.exitPointerLock(); else suppressMenu = false; },
    };
    const onLockChange = (): void => {
      const was = pointerLocked;
      pointerLocked = isLocked();
      if (pointerLocked) { lockFails = 0; softAim = false; }
      setLocked(pointerLocked);
      if (was && !pointerLocked) {
        if (suppressMenu) { suppressMenu = false; return; }
        // Esc while aiming: close the inventory if it is open, else the jump menu
        if (live.current.inv) setInv(false); else setMenu(true);
      }
    };
    document.addEventListener('pointerlockchange', onLockChange);
    pointerLocked = isLocked(); setLocked(pointerLocked);
    const onLockError = (): void => failLock();
    document.addEventListener('pointerlockerror', onLockError);

    const onKeyDown = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (intro.on) { intro.t = intro.ms; return; }
        if (live.current.inv) { setInv(false); return; }
        setMenu((m) => !m);
        return;
      }
      if (live.current.menu) return;
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); builder.undo(); return; }
      if (k >= '1' && k <= '9' && live.current.buildOn) { setSel(Number(k) - 1); fx('tool-switch', { volume: 0.5 }); return; }
      if (k === 'e' && live.current.buildOn) { const on = !live.current.inv; setInv(on); if (on) api.current?.unlock(); else api.current?.lock(); return; }
      if (k === 'v') { fpv = !fpv; camPitch = fpv ? 0 : 0.38; fx('ui-toggle', { volume: 0.5 }); return; }
      if ((k === 'x' || k === 'delete') && live.current.buildOn) { const a = aim(); const item = live.current.slots[live.current.sel]; if (a && item && builder.removeAt(a, item)) say('Removed'); return; }
      down.add(k);
    };
    const onKeyUp = (e: KeyboardEvent): void => { down.delete(e.key.toLowerCase()); };
    let drag: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent): void => {
      if (live.current.menu || live.current.inv || intro.on) return;
      if (!pointerLocked && !el.contains(e.target as Node)) return;
      if (!pointerLocked && !softAim) { api.current?.lock(); return; }
      if (softAim && e.button === 2) { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); return; }
      if (pointerLocked || softAim) {
        mouse |= e.button === 2 ? 2 : 1;
        if (e.button === 0 || e.button === 2) firstUse = true;
      } else { drag = { x: e.clientX, y: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } }
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (live.current.menu || live.current.inv) return;
      if (pointerLocked) {
        camYaw -= e.movementX * 0.0026;
        camPitch = Math.min(1.3, Math.max(fpv ? -1.3 : -0.55, camPitch + e.movementY * 0.0022));
        return;
      }
      if (!drag) return;
      camYaw -= (e.clientX - drag.x) * 0.006;
      camPitch = Math.min(1.3, Math.max(0.05, camPitch + (e.clientY - drag.y) * 0.004));
      drag = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent): void => {
      drag = null;
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (mouse) { mouse &= e.button === 2 && !softAim ? ~2 : ~1; if (!mouse) builder.end(); }
    };
    const onWheel = (e: WheelEvent): void => {
      if (!pointerLocked && !el.contains(e.target as Node)) return;
      if ((pointerLocked || softAim) && live.current.buildOn) setSel((s) => (s + (e.deltaY > 0 ? 1 : 8)) % 9);
      else camDist = Math.min(14, Math.max(2.2, camDist * (e.deltaY > 0 ? 1.08 : 0.92)));
    };
    const onContext = (e: Event): void => e.preventDefault();
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onPointerDown); window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('wheel', onWheel, { passive: true }); el.addEventListener('contextmenu', onContext);

    let raf = 0, last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (intro.on) {
        intro.t += dt * 1000;
        const k = Math.min(1, intro.t / intro.ms), e = 1 - Math.pow(1 - k, 3);
        camDist = 150 + (5.5 - 150) * e; camPitch = 1.3 + (0.38 - 1.3) * e; camYaw = Math.PI + (1 - e) * 1.2;
        if (k >= 1) { intro.on = false; onIntroDone?.(); }
      }
      const paused = live.current.menu || live.current.inv;
      if (!paused) {
        const fwx = -Math.sin(camYaw), fwz = -Math.cos(camYaw), rx = -fwz, rz = fwx;
        let mx = 0, mz = 0;
        if (down.has('w') || down.has('arrowup')) { mx += fwx; mz += fwz; }
        if (down.has('s') || down.has('arrowdown')) { mx -= fwx; mz -= fwz; }
        if (down.has('d') || down.has('arrowright')) { mx -= rx; mz -= rz; }
        if (down.has('a') || down.has('arrowleft')) { mx += rx; mz += rz; }
        const len = Math.hypot(mx, mz);
        if (len > 0 && !intro.on) {
          const speed = (down.has('shift') ? 8 : 3.6) * dt;
          const nx = px + (mx / len) * speed, nz = pz + (mz / len) * speed;
          if (ground(nx, nz) >= SEA) { px = nx; pz = nz; }
          else if (ground(nx, pz) >= SEA) px = nx;
          else if (ground(px, nz) >= SEA) pz = nz;
        }
        // FPS rules: with the mouse captured the goblin always faces where you look (strafing and backing up included); without it it faces where it walks
        const lookingBy = pointerLocked || softAim;
        if ((lookingBy || len > 0) && !intro.on) {
          const want = lookingBy ? Math.atan2(fwx, fwz) : Math.atan2(mx, mz);
          let dAng = want - face; while (dAng > Math.PI) dAng -= 2 * Math.PI; while (dAng < -Math.PI) dAng += 2 * Math.PI;
          face += dAng * Math.min(1, dt * (lookingBy ? 22 : 14));
        }
        // gravity and a jump on Space
        const g = ground(px, pz);
        const grounded = py <= g + 0.04;
        if (grounded && down.has(' ') && !intro.on) vy = 6.4;
        vy -= 18 * dt;
        let ny = py + vy * dt;
        if (ny <= g) { ny = g; vy = 0; }
        py = ny;
        // using the hotbar slot under the crosshair
        if (mouse && live.current.buildOn) {
          const item = live.current.slots[live.current.sel];
          const a = aim();
          if (item && a) builder.use(item, a, (mouse & 2) !== 0 || down.has('shift'), now, firstUse);
          firstUse = false;
        }
      }
      const head = fpv ? 1.62 : 0.9;
      renderer.setModelPose(avatarIndex, px, fpv ? -1000 : py, pz, ((face + Math.PI) * 180) / Math.PI);
      let wantEye: [number, number, number], target: [number, number, number];
      if (fpv) {
        wantEye = [px, py + head, pz];
        const cp = Math.cos(camPitch);
        target = [px - Math.sin(camYaw) * cp, py + head - Math.sin(camPitch), pz - Math.cos(camYaw) * cp];
      } else {
        target = [px, py + head, pz];
        wantEye = [px + Math.sin(camYaw) * Math.cos(camPitch) * camDist, py + head + Math.sin(camPitch) * camDist, pz + Math.cos(camYaw) * Math.cos(camPitch) * camDist];
        wantEye[1] = Math.max(wantEye[1], ground(wantEye[0], wantEye[2]) + 0.6);
      }
      const k = fpv ? 1 : Math.min(1, dt * 10);
      eye = eye && !fpv ? [eye[0] + (wantEye[0] - eye[0]) * k, eye[1] + (wantEye[1] - eye[1]) * k, eye[2] + (wantEye[2] - eye[2]) * k] : wantEye;
      renderer.setFov(fpv ? 75 : 60);
      renderer.camera.set(eye, target);
      renderer.step();
      renderer.render(1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
      if (isLocked()) { suppressMenu = true; document.exitPointerLock(); }
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('wheel', onWheel); el.removeEventListener('contextmenu', onContext);
      offTerrain();
      api.current = null;
      renderer.unmount();
    };
  }, [rt, scene, say]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="island" style={{ position: 'absolute', inset: 0 }}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      {buildOn && !menu ? <Crosshair active={locked} /> : null}
      {buildOn && !menu ? <Hotbar slots={slots} selected={sel} onSelect={(i) => { setSel(i); fx('tool-switch', { volume: 0.5 }); }} onOpenInventory={() => openInv(true)} /> : null}
      {inv ? <Inventory selected={sel} onPick={pickItem} onClose={() => openInv(false)} /> : null}
      {note ? <div className="island-note" role="status">{note}</div> : null}
      {!menu && !inv ? <p className="island-hint">{buildOn ? (locked ? 'Mouse look · Space jump · 1-9 tools · click use · right click or Shift lower · E inventory · V view · Ctrl+Z undo · Esc menu' : 'Click to capture the mouse · W A S D move · Esc menu') : (locked ? 'Mouse look · W A S D move · Shift run · Space jump · Esc menu' : 'Click to capture the mouse · W A S D move · Esc menu')}</p> : null}
      {menu ? (
        <div className="island-menu" role="dialog" aria-label="Menu">
          <h3>Menu</h3>
          <button className="go" onClick={onMainMenu}>Main menu</button>
          {buildOn ? <button onClick={onEdit}>Build mode</button> : null}
          <button onClick={onActivities}>Activities</button>
          <button onClick={onHub}>Multiplayer</button>
          <button onClick={() => { setMenu(false); api.current?.lock(); }}>Back to walking</button>
        </div>
      ) : null}
    </div>
  );
}
