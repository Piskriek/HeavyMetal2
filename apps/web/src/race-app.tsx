import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { Runtime } from '@hm/engine';
import { attachOrbitControls, createThreeRenderer, SurfaceArray, STARTER_SURFACES, SURF } from '@hm/render';
import { chaseCamera, createRaceGame, type Hud as HudData, type RaceGame } from '@hm/game';
import { attachKeyboard, TouchControls } from '@hm/input';
import { applyLook, lookOf } from './look';
import { HUD, Minimap, ordinal, formatTime } from '@hm/ui';

/** The playable shell: the Basalt Isle race. Keyboard (arrows/WASD, space = item), gamepad-ready, on-screen touch controls. */
export function RaceApp({ rt, fromMap = false }: { readonly rt: Runtime; readonly fromMap?: boolean }): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<RaceGame | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const [racers, setRacers] = useState<{ id: string; x: number; z: number; color: string; me: boolean }[]>([]);
  const [results, setResults] = useState<readonly { id: string; position: number; dnf?: boolean; timeMs?: number }[] | null>(null);
  const [size, setSize] = useState({ w: 800, h: 450 });
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = createThreeRenderer({ shadows: true, background: 'sky' });
    renderer.mount(el, rt.world, rt.store);
    const surfaces = new SurfaceArray(STARTER_SURFACES);
    const game = createRaceGame(rt, { seed: 7, laps: 3, fromScene: fromMap });
    gameRef.current = game;
    const sceneNow = rt.store.get(rt.binder.sceneId ?? '');
    if (sceneNow) applyLook(renderer, lookOf(sceneNow.params));
    const state = rt.binder.terrain();
    if (state) {
      const view = renderer.setTerrain(state.terrain, surfaces);
      view?.setLook({ cliffSurface: SURF.cliff, soft: state.look.soft, normalStrength: state.look.bump });
    }
    const detachKeys = attachKeyboard(window, game.input);
    const detachOrbit = attachOrbitControls(el, renderer);
    const offTick = rt.onTick(() => renderer.step());
    let prevCam: { position: readonly [number, number, number]; target: readonly [number, number, number] } | null = null;
    let last = performance.now(), raf = 0, hudAcc = 0;
    const gamepads = (): void => {
      const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      const pad = pads.find((p) => p && p.connected);
      game.input.setGamepad(pad ? { axes: Array.from(pad.axes), buttons: pad.buttons.map((b) => ({ pressed: b.pressed, value: b.value })) } : null);
    };
    const loop = (now: number): void => {
      const dt = Math.min(100, now - last);
      last = now;
      gamepads();
      const alpha = game.update(dt);
      const pose = game.playerPose();
      const cam = chaseCamera(prevCam, pose, dt);
      prevCam = cam;
      renderer.camera.set(cam.position, cam.target);
      renderer.step();
      renderer.render(alpha);
      hudAcc += dt;
      if (hudAcc > 90) {
        hudAcc = 0;
        setHud(game.hud());
        setRacers(game.racerStates());
        setResults(game.results());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const resize = (): void => setSize({ w: el.clientWidth, h: el.clientHeight });
    resize();
    window.addEventListener('resize', resize);
    setTouch(typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      detachKeys(); detachOrbit(); offTick(); renderer.unmount();
    };
  }, [rt, fromMap]);

  const game = gameRef.current;
  return (
    <div className="race">
      <div className="view" ref={host} />
      {hud ? <HUD speed={hud.speed} lap={hud.lap} laps={hud.laps} position={hud.position} racers={hud.racers} timeMs={hud.timeMs} item={hud.item} boost={hud.boost} {...(hud.message ? { message: hud.message } : {})} /> : null}
      {game ? <div className="mini"><Minimap track={game.track.points} racers={racers} size={150} /></div> : null}
      {touch && game ? <TouchControls width={size.w} height={size.h} onChange={(t) => game.input.setTouch(t)} /> : null}
      <div className="race-hint">Arrows / WASD to drive · Space = item · R = reset</div>
      {results && game ? (
        <div className="results" role="dialog" aria-label="Race results">
          <h2>Results</h2>
          <ol>
            {results.map((r) => (
              <li key={r.id} className={r.id === String(game.player) ? 'me' : ''}>
                <span>{ordinal(r.position)}</span>
                <span>{game.rt.world.get(Number(r.id), 'racer')?.['name'] as string}</span>
                <span>{r.dnf ? 'DNF' : formatTime(r.timeMs ?? 0)}</span>
              </li>
            ))}
          </ol>
          <button onClick={() => game.restart()}>Race again</button>
        </div>
      ) : null}
      <a className="to-editor" href="#edit" onClick={() => setTimeout(() => location.reload(), 0)}>Editor</a>
    </div>
  );
}
