import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Runtime } from '@hm/engine';
import { createThreeRenderer, SurfaceArray, STARTER_SURFACES, SURF } from '@hm/render';
import { heightAt } from '@hm/terrain';
import { encodeModel, type VoxelModel } from '@hm/voxel';
import { MODELS } from '@hm/voxelart';
import { applyLook, lookOf } from './look';
import { decorInstances } from './maker/dress';
import { loadMap } from './maker/storage';
import { buildMakerScene, type MakerScene } from './maker/scene';
import { placementsOf } from './maker/models-panel';

/**
 * My Island: you are the goblin, walking about your own island in third person. W A S D / arrows move (Shift runs), drag to turn the camera,
 * wheel zooms. Esc opens the menu: Edit my island, Race, Title. The island is the map you built in the editor.
 */
const GOBLIN_BLOCK = 0.04;
const SEA = 0.35; // lower ground than this is water: the goblin stays on land

export function IslandWalk(props: { readonly rt: Runtime; readonly intro?: boolean; readonly grownUp?: boolean; readonly onEdit: () => void; readonly onActivities: () => void; readonly onHub: () => void; readonly onMainMenu: () => void; readonly onIntroDone?: () => void }): ReactElement {
  const { rt, onEdit, onActivities, onHub, onMainMenu, onIntroDone } = props;
  const introRef = useRef(props.intro === true);
  const host = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(false);
  menuRef.current = menu;
  const scene = useMemo<MakerScene>(() => loadMap(rt) ?? buildMakerScene(rt), [rt]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = createThreeRenderer({ shadows: true, background: 'sky' });
    renderer.mount(el, rt.world, rt.store);
    renderer.setQuality('high');
    const surfaces = new SurfaceArray(STARTER_SURFACES);
    const state = rt.binder.terrain();
    if (state) renderer.setTerrain(state.terrain, surfaces)?.setLook({ cliffSurface: SURF.cliff, soft: state.look.soft, normalStrength: state.look.bump });
    const sceneParams = rt.store.get(scene.sceneId)?.params;
    if (sceneParams) applyLook(renderer, lookOf(sceneParams));
    const d = rt.binder.decor();
    renderer.setDecor(d ? decorInstances(d.placements) : null);

    // the avatar is the last model in the list, so it can be moved without rebuilding anything
    const goblin = MODELS.find((m) => m.id === 'goblin')!.build() as unknown as VoxelModel;
    const others = placementsOf(rt, scene.sceneId);
    const avatarIndex = others.length;
    renderer.setModels([...others, { params: { data: encodeModel(goblin), scale: GOBLIN_BLOCK, ao: true, greedy: true, castShadow: true }, x: 0, y: 0, z: 0, yawDeg: 0 }]);

    const ground = (x: number, z: number): number => (state ? heightAt(state.terrain, x, z) : 0);
    // start on the beach nearest the centre that is dry land
    let px = 0, pz = 0;
    for (let r = 0; r < 120 && ground(px, pz) < SEA; r += 2) { px = r; pz = 0; }
    let py = ground(px, pz), face = 0;
    let camYaw = Math.PI, camPitch = 0.38, camDist = 5.5;
    // the arrival: start high above the island and settle behind the goblin
    const intro = { on: introRef.current, t: 0, ms: 3200 };
    if (intro.on) { camPitch = 1.3; camDist = 150; }
    let eye: [number, number, number] | null = null;
    const down = new Set<string>();
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { if (intro.on) { intro.t = intro.ms; return; } setMenu((m) => !m); return; }
      down.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent): void => { down.delete(e.key.toLowerCase()); };
    let drag: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent): void => { if (menuRef.current || intro.on) return; drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); };
    const onPointerMove = (e: PointerEvent): void => {
      if (!drag) return;
      camYaw -= (e.clientX - drag.x) * 0.006;
      camPitch = Math.min(1.3, Math.max(0.05, camPitch + (e.clientY - drag.y) * 0.004));
      drag = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent): void => { drag = null; if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); };
    const onWheel = (e: WheelEvent): void => { camDist = Math.min(14, Math.max(2.2, camDist * (e.deltaY > 0 ? 1.08 : 0.92))); };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
    el.addEventListener('pointerdown', onPointerDown); el.addEventListener('pointermove', onPointerMove); el.addEventListener('pointerup', onPointerUp); el.addEventListener('wheel', onWheel, { passive: true });

    let raf = 0, last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (intro.on) {
        intro.t += dt * 1000;
        const k = Math.min(1, intro.t / intro.ms), e = 1 - Math.pow(1 - k, 3);
        camDist = 150 + (5.5 - 150) * e; camPitch = 1.3 + (0.38 - 1.3) * e; camYaw = Math.PI + (1 - e) * 1.2;
        if (k >= 1) { intro.on = false; onIntroDone?.(); }
      }
      if (!menuRef.current) {
        // camera-relative movement: forward is away from the camera
        const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = -fz, rz = fx;
        let mx = 0, mz = 0;
        if (down.has('w') || down.has('arrowup')) { mx += fx; mz += fz; }
        if (down.has('s') || down.has('arrowdown')) { mx -= fx; mz -= fz; }
        if (down.has('d') || down.has('arrowright')) { mx -= rx; mz -= rz; }
        if (down.has('a') || down.has('arrowleft')) { mx += rx; mz += rz; }
        const len = Math.hypot(mx, mz);
        if (len > 0) {
          const speed = (down.has('shift') ? 8 : 3.6) * dt;
          const nx = px + (mx / len) * speed, nz = pz + (mz / len) * speed;
          if (ground(nx, nz) >= SEA) { px = nx; pz = nz; }
          else if (ground(nx, pz) >= SEA) px = nx;
          else if (ground(px, nz) >= SEA) pz = nz;
          const want = Math.atan2(mx, mz);
          let dAng = want - face; while (dAng > Math.PI) dAng -= 2 * Math.PI; while (dAng < -Math.PI) dAng += 2 * Math.PI;
          face += dAng * Math.min(1, dt * 14);
        }
        py += (ground(px, pz) - py) * Math.min(1, dt * 18);
      }
      renderer.setModelPose(avatarIndex, px, py, pz, ((face + Math.PI) * 180) / Math.PI); // the model looks along -z
      const target: [number, number, number] = [px, py + 0.9, pz];
      const wantEye: [number, number, number] = [px + Math.sin(camYaw) * Math.cos(camPitch) * camDist, py + 0.9 + Math.sin(camPitch) * camDist, pz + Math.cos(camYaw) * Math.cos(camPitch) * camDist];
      wantEye[1] = Math.max(wantEye[1], ground(wantEye[0], wantEye[2]) + 0.6);
      const k = Math.min(1, dt * 10);
      eye = eye ? [eye[0] + (wantEye[0] - eye[0]) * k, eye[1] + (wantEye[1] - eye[1]) * k, eye[2] + (wantEye[2] - eye[2]) * k] : wantEye;
      renderer.setFov(60);
      renderer.camera.set(eye, target);
      renderer.step();
      renderer.render(1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      el.removeEventListener('pointerdown', onPointerDown); el.removeEventListener('pointermove', onPointerMove); el.removeEventListener('pointerup', onPointerUp); el.removeEventListener('wheel', onWheel);
      renderer.unmount();
    };
  }, [rt, scene]);

  return (
    <div className="island" style={{ position: 'absolute', inset: 0 }}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      <p className="island-hint">W A S D move · Shift run · drag to look · wheel zoom · Esc menu</p>
      {menu ? (
        <div className="island-menu" role="dialog" aria-label="Menu">
          <h3>Menu</h3>
          <button className="go" onClick={onMainMenu}>Main menu</button>
          {props.grownUp !== false ? <button onClick={onEdit}>Build mode</button> : null}
          <button onClick={onActivities}>Activities</button>
          <button onClick={onHub}>Multiplayer</button>
          <button onClick={() => setMenu(false)}>Back to walking</button>
        </div>
      ) : null}
    </div>
  );
}
