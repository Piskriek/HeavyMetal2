import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { Runtime } from '@hm/engine';
import { attachOrbitControls, createThreeRenderer, SurfaceArray, tileSizeFor, RACING_SURFACES, SETMIX_VOXEL, SURF } from '@hm/render';
import { BALL_RADIUS, createAdaptiveQuality, createRaceGame, guessQuality, parseQuality, rulesOf, itemsOf, type Hud as HudData, type RaceGame } from '@hm/game';
import { Animator } from '@hm/anim';
import type { AvatarLook } from '@hm/avatarlook';
import { avatarRigged } from './build/cards';
import { attachKeyboard, TouchControls } from '@hm/input';
import { Minimap } from '@hm/ui';
import type { HudLayout } from '@hm/hudlayout';
import { LayoutHud } from './hud';
import { RaceCamera, rigsOf } from './rigs';
import { IntroOverlay, type ResultRow, type Settings } from '@hm/screens';
import { followLighting } from './look';
import { decorInstances } from './maker/dress';
import { attachRaceAudio, type RaceAudio } from './sound/race-audio';
import { loadProfile, powerPreferenceOf, showTier } from './shell/profile';

/** On phones the HUD gets a second pass: the same layout with the parts scaled down so nothing collides. */
const narrow = (l: HudLayout): HudLayout => ({ ...l, elements: l.elements.map((e) => ({ ...e, scale: Math.min(e.scale, e.kind === 'minimap' ? 0.65 : 0.85) })) });

export interface RaceSetup {
  readonly fromMap: boolean;
  /** Index into the goblin library, or a custom goblin. */
  readonly playerIndex?: number;
  readonly player?: { readonly name: string; readonly params: Readonly<Record<string, number | boolean | string | null>> };
  /** Your goblin: it rides your ball (the racer you picked sets the ball's weight, speed, bounce and colour). */
  readonly rider?: AvatarLook;
}

/**
 * The race itself: renders the game, the HUD, the minimap and touch controls, and tells the shell what happens
 * (ready, countdown over, results). The shell decides when the game runs (`active`) and when it is paused.
 */
export function RaceView(props: {
  readonly rt: Runtime;
  readonly setup: RaceSetup;
  readonly settings: Settings;
  /** The game only advances while active and not paused (loading shows the grid without running the lights). */
  readonly active: boolean;
  readonly paused: boolean;
  /** Where the HUD parts sit (from the interface preset). */
  readonly layout: HudLayout;
  /** Show the pause button (not on the results screens). */
  readonly pausable: boolean;
  readonly onReady: () => void;
  readonly onRacing: () => void;
  readonly onResults: (rows: ResultRow[]) => void;
  readonly onPause: () => void;
}): ReactElement {
  const { rt, setup } = props;
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ active: props.active, paused: props.paused, settings: props.settings });
  live.current = { active: props.active, paused: props.paused, settings: props.settings };
  const cb = useRef(props);
  cb.current = props;
  const gameRef = useRef<RaceGame | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const [racers, setRacers] = useState<{ id: string; x: number; z: number; color: string; me: boolean }[]>([]);
  const [size, setSize] = useState({ w: 800, h: 450 });
  const [touchDevice, setTouchDevice] = useState(false);
  const [rigName, setRigName] = useState('');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = createThreeRenderer({ shadows: true, background: 'sky', powerPreference: powerPreferenceOf(loadProfile().gpu) });
    renderer.mount(el, rt.world, rt.store);
    // quality: a chosen tier is respected; "auto" guesses from the device and drops a tier if frames run slow
    const chosen = (() => { try { return parseQuality(new URLSearchParams(location.search).get('q')) ?? parseQuality(live.current.settings.quality); } catch { return null; } })();
    const touchy = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const device = { touch: touchy, cores: navigator.hardwareConcurrency || 0, dpr: window.devicePixelRatio || 1, width: window.innerWidth, gpu: renderer.gpu };
    const adaptive = createAdaptiveQuality(chosen ?? guessQuality(device), { locked: chosen !== null, targetFps: loadProfile().fpsTarget });
    const ownGraphics = loadProfile().graphics;
    showTier(renderer, adaptive.current, ownGraphics);
    let appliedQuality = live.current.settings.quality;
    const surfaces = new SurfaceArray(RACING_SURFACES, undefined, SETMIX_VOXEL, tileSizeFor(adaptive.current));
    const game = createRaceGame(rt, { seed: 7, rules: setup.fromMap ? rulesOf(rt) : {}, items: setup.fromMap ? itemsOf(rt) : undefined, fromScene: setup.fromMap, ...(setup.player ? { player: setup.player } : { playerIndex: setup.playerIndex ?? 0 }), ...(setup.rider ? { rider: { name: setup.rider.name } } : {}) });
    // your goblin in your ball: the same voxel avatar and animations as on your island, upright inside the rolling glass
    const riding = setup.rider ? avatarRigged(setup.rider) : null;
    const riderAnim = new Animator();
    if (riding) renderer.setAvatar(riding.model, (BALL_RADIUS * 1.25) / Math.max(1, riding.model.size[1]), riding.rig);
    gameRef.current = game;
    (window as unknown as { hmGame: unknown }).hmGame = game; // console: hmGame.hud(), hmGame.racerIds ...
    const stopLighting = rt.binder.sceneId ? followLighting(rt.store, rt.binder.sceneId, renderer) : () => undefined;
    const state = rt.binder.terrain();
    if (state) {
      const view = renderer.setTerrain(state.terrain, surfaces);
      view?.setLook({ cliffSurface: SURF.cliff, soft: state.look.soft, normalStrength: state.look.bump });
    }
    renderer.setRoadDecals(game.roadDecals);
    const showDecor = (): void => { const d = rt.binder.decor(); renderer.setDecor(d ? decorInstances(d.placements) : null); };
    showDecor();
    const offDecor = rt.binder.onDecor(showDecor);
    const raceAudio: RaceAudio = attachRaceAudio(game);
    const detachKeys = attachKeyboard(window, game.input);
    const detachOrbit = attachOrbitControls(el, renderer);
    const offTick = rt.onTick(() => renderer.step());
    const cam = new RaceCamera(rigsOf(rt), rt);
    const onKey = (e: KeyboardEvent): void => { if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) { const r = cam.next(); setRigName(r.name); window.setTimeout(() => setRigName(''), 1600); } };
    window.addEventListener('keydown', onKey);
    let last = performance.now(), raf = 0, hudAcc = 0, frames = 0, ready = false, racing = false, reported = false;
    const gamepads = (): void => {
      const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      const pad = pads.find((p) => p && p.connected);
      game.input.setGamepad(pad ? { axes: Array.from(pad.axes), buttons: pad.buttons.map((b) => ({ pressed: b.pressed, value: b.value })) } : null);
    };
    const loop = (now: number): void => {
      const rawDt = now - last;
      const dt = Math.min(100, rawDt);
      last = now;
      const L = live.current;
      if (L.settings.quality !== appliedQuality) {
        appliedQuality = L.settings.quality;
        const q = parseQuality(appliedQuality);
        showTier(renderer, q ?? guessQuality(device), ownGraphics);
      }
      const lower = adaptive.frame(rawDt);
      if (lower && parseQuality(L.settings.quality) === null) showTier(renderer, lower, ownGraphics);
      game.invertSteer = L.settings.invertSteer;
      gamepads();
      let alpha = 1;
      if (L.active && !L.paused) { alpha = game.update(dt); raceAudio.tick(dt); } else raceAudio.tick(0, true);
      const pose = game.playerPose();
      if (riding) renderer.setAvatarPose(pose.x, pose.y - BALL_RADIUS * 0.62, pose.z, Math.atan2(pose.hx, pose.hz) + Math.PI, riderAnim.update(dt / 1000, { speed: pose.speed * 0.6, grounded: true, vy: 0 }), true);
      const shot = cam.step(dt, pose);
      renderer.setFov(shot.fov);
      renderer.camera.set(shot.eye, shot.target);
      renderer.step();
      renderer.render(alpha);
      if (++frames === 3 && !ready) { ready = true; cb.current.onReady(); }
      hudAcc += dt;
      if (hudAcc > 90) {
        hudAcc = 0;
        const h = game.hud();
        setHud(h);
        setRacers(game.racerStates());
        if (!racing && h.phase === 'racing') { racing = true; cb.current.onRacing(); }
        const res = game.results();
        if (res && !reported) {
          reported = true;
          const colours = new Map(game.racerStates().map((r) => [r.id, r.color]));
          cb.current.onResults(res.map((r) => ({
            id: r.id, name: String(game.rt.world.get(Number(r.id), 'racer')?.['name'] ?? r.id), color: colours.get(r.id) ?? '#888', position: r.position,
            ...(r.dnf ? { dnf: true } : {}), ...(typeof r.timeMs === 'number' ? { timeMs: r.timeMs } : {}), ...(r.id === String(game.player) ? { isPlayer: true } : {}),
          })));
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const resize = (): void => setSize({ w: el.clientWidth, h: el.clientHeight });
    resize();
    window.addEventListener('resize', resize);
    setTouchDevice(touchy);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      detachKeys(); detachOrbit(); offTick(); offDecor(); stopLighting(); raceAudio.dispose(); renderer.unmount();
      gameRef.current = null;
    };
  }, [rt, setup.fromMap, setup.playerIndex, setup.player, setup.rider]);

  const game = gameRef.current;
  const showTouch = props.settings.touchControls === 'on' || (props.settings.touchControls === 'auto' && touchDevice);
  const count = hud?.phase === 'countdown' ? (hud.message === 'GO!' || hud.message === undefined ? 0 : Number(hud.message)) : null;
  return (
    <div className="race">
      {rigName ? <div className="rig-name" role="status">📷 {rigName}</div> : null}
      <div className="view" ref={host} />
      {hud ? <LayoutHud hud={hud} layout={size.w < 520 ? narrow(props.layout) : props.layout} minimap={game && props.settings.showMinimap ? <Minimap track={game.track.points} racers={racers} size={150} /> : null} /> : null}
      {showTouch && game ? <TouchControls width={size.w} height={size.h} onChange={(t) => game.input.setTouch(t)} /> : null}
      {props.active && count !== null && !props.paused ? <IntroOverlay countdown={count} lap={1} laps={hud?.laps ?? 3} reducedMotion={props.settings.reducedMotion} /> : null}
      {props.pausable && !props.paused ? <button className="pause-btn" aria-label="Pause" onClick={props.onPause}>⏸</button> : null}
      {!showTouch ? <div className="race-hint">Drive with the arrows or W A S D. Space uses your item, R puts you back on the road, Esc pauses.</div> : null}
    </div>
  );
}
