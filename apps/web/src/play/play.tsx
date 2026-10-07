// The first Play (owner, 2026-10-07; STATUS SM22): the lab in first person, your human made there, the gate turned on,
// the stage-0 planet looked round, the first machine placed and the plot lifted to stage 1. The scene is play-scene.ts,
// the rules quest.ts; this screen loads them behind a bar, reads your keys and mouse, saves your progress and says what
// to do next.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { deviceFor, type Stage } from '@hm/fidelity';
import { VAULT_BY_ID } from '@hm/vault';
import { createAdaptiveQuality, parseQuality, type Quality } from '@hm/game';
import { pixelRatioFor, resolveGraphics, type GraphicsSettings } from '@hm/render';
import { noteTier, powerPreferenceOf, type Profile } from '../shell/profile';
import { tierFor } from '../crafter/crafter';
import { bakeLookCached } from '../crafter/looks';
import type { Plot } from '../crafter/planet';
import { SMOOTH_IDS, smoothModel } from '../crafter/smooth-models';
import { CreateGoblin } from '../avatar/create-goblin';
import { createPlayScene, type Detail, type FrameOut, type PlayScene } from './play-scene';
import { FRESH, SAVE_KEY, arrived, created, loadState, objective, placed, poweredOn, returned, type PlayState } from './quest';
import './play.css';

/** Your plot's cartridge until the ground shader battle lands: sandy desert tones, the nearest in the vault to the concept art's stage 1. */
const PLOT = 'crater_calcite';
const SYNC_BLOCKS = 20;
/** Other players' plots, 1 km across like yours (owner, 2026-10-07): seen from your plot as greener, wetter patches 1.1 to 3 km away.
 *  Samples until the shared planet is wired (SETMIX_PLAN Phase 5). */
const NEIGHBOURS: readonly Plot[] = ([
  ['Mossfold', 35, 1150, 170, 'emerald_canopy', 6], ['Kettle Rise', 112, 1480, 150, 'spore_meadow', 5], ['Fernreach', 168, 1900, 190, 'solar_fern_glade', 6],
  ['Low Atoll', 214, 2350, 210, 'coral_atoll', 6], ['Prism Flats', 262, 1320, 120, 'prismata_grass', 4], ['Greywater', 305, 2700, 230, 'emerald_canopy', 5],
  ['Stillgrove', 340, 3000, 240, 'spore_meadow', 6],
] as const).map(([name, deg, dist, r, cartridge, stage]) => ({ name, r, cartridge, stage, x: Math.cos((deg * Math.PI) / 180) * dist, z: Math.sin((deg * Math.PI) / 180) * dist }));

/** The ground's triangles by tier (the display governor changes it as you play). */
const GROUND_BUDGET: Readonly<Record<Quality, number>> = { potato: 60000, low: 90000, medium: 200000, high: 200000, ultra: 280000 };
const detailOf = (g: GraphicsSettings, q: Quality): Detail => ({ plumes: g.pixelPlumes, plumeDensity: g.plumeDensity, groundBudget: GROUND_BUDGET[q] });

function loadSaved(): PlayState { try { return loadState(JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null')); } catch { return FRESH; } }
function save(s: PlayState): void { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage unavailable: progress lives for this visit */ } }

interface Hud { readonly where: FrameOut['where']; readonly sync: number; readonly atLever: boolean; readonly ghost: FrameOut['ghost'] }
const KEYS: readonly [string, string][] = [['W A S D', 'walk'], ['Mouse', 'look'], ['Shift', 'run'], ['E', 'use'], ['B', 'build'], ['Esc', 'pause']];

export function PlayScreen(props: { readonly profile: Profile; readonly onBack: () => void }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PlayScene | null>(null);
  const reduced = useMemo(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);
  const tier = useMemo(() => tierFor(props.profile), [props.profile.quality]); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState<PlayState>(loadSaved);
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState('Opening the lab');
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const [menu, setMenu] = useState(false);
  const [building, setBuilding] = useState(false);
  const [hud, setHud] = useState<Hud>({ where: 'lab', sync: 1, atLever: false, ghost: null });
  const [toast, setToast] = useState<{ readonly text: string; readonly sub: string; readonly id: number } | null>(null);
  const creating = state.step === 'create';

  const commit = useCallback((next: PlayState) => { stateRef.current = next; setState(next); save(next); }, []);
  const say = useCallback((text: string, sub = '') => setToast({ text, sub, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast((x) => (x?.id === toast.id ? null : x)), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ---- the scene, built behind the loading bar
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const low = tier === 'potato' || tier === 'low';
    const device = deviceFor(tier), gridSpacing = low ? 1 : 0.5;
    // the display governor (SETMIX_PLAN rule 6): auto follows the frame time from the starting tier; a tier chosen in Settings is kept.
    // What it can change while you play: the picture's sharpness, the plumes and the ground's triangles; the rest is the starting tier's.
    const adaptive = createAdaptiveQuality(tier, { locked: parseQuality(props.profile.quality) !== null, targetFps: props.profile.fpsTarget });
    let graphics = resolveGraphics(tier, props.profile.graphics);
    noteTier(tier);
    let scene: PlayScene;
    try {
      scene = createPlayScene({ canvas, gridSpacing, antialias: !low, powerPreference: powerPreferenceOf(props.profile.gpu), reducedMotion: reduced, textureSize: low ? 512 : 1024, groundTexture: low ? 128 : 256, detail: detailOf(graphics, tier) });
    } catch {
      setFailed(true);
      return undefined;
    }
    sceneRef.current = scene;
    const size = (): void => {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      scene.resize(w, h, pixelRatioFor(graphics, w, h, window.devicePixelRatio || 1));
    };
    size();
    window.addEventListener('resize', size);

    const look = (id: string, st: Stage) => bakeLookCached(VAULT_BY_ID.get(id)!, st, device, gridSpacing);
    const steps: [string, () => void][] = [
      ...SMOOTH_IDS.map((id): [string, () => void] => ['Shaping the boulders', () => { smoothModel(id); }]),
      ['Building your plot', () => { look(PLOT, 1); }],
      ...[...new Set(NEIGHBOURS.map((n) => `${n.cartridge}@${n.stage}`))].map((k): [string, () => void] => {
        const [id, st] = k.split('@') as [string, string];
        return ['Finding the neighbours', () => { look(id, Number(st) as Stage); }];
      }),
      ['Opening the lab', () => {
        scene.setPlanet(look(PLOT, 1), look(PLOT, 1), NEIGHBOURS.map((plot) => ({ plot, look: look(plot.cartridge, plot.stage) })));
        scene.restore(stateRef.current);
      }],
      ['Compiling shaders', () => { scene.warm(); }],
    ];
    const hook = { frames: 0, ready: false, step: stateRef.current.step, where: 'lab', sync: 1, wave: -1, triangles: 0, calls: 0, tier: tier as Quality };
    const keys = new Set<string>();
    let dx = 0, dy = 0, cancelled = false, raf = 0, at = 0, timer = 0, last = performance.now(), hudAt = 0;
    const onKey = (e: KeyboardEvent, down: boolean): void => { if (down) keys.add(e.code); else keys.delete(e.code); };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
    const onMove = (e: MouseEvent): void => { if (document.pointerLockElement === canvas) { dx += e.movementX; dy += e.movementY; } };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('mousemove', onMove);
    const loop = (ms: number): void => {
      if (cancelled) return;
      const frameMs = ms - last;
      const dt = Math.min(0.1, frameMs / 1000);
      last = ms;
      const live = !pausedRef.current && stateRef.current.step !== 'create';
      // the governor judges only the frames you play (the creator draws its own turntable over the lab)
      const next = live ? adaptive.frame(frameMs) : null;
      if (next) {
        graphics = resolveGraphics(next, props.profile.graphics);
        scene.setDetail(detailOf(graphics, next));
        size();
        noteTier(next);
        hook.tier = next;
      }
      const axis = (a: string[], b: string[]) => (a.some((k) => keys.has(k)) ? 1 : 0) - (b.some((k) => keys.has(k)) ? 1 : 0);
      const out = scene.frame(ms / 1000, dt, live
        ? { move: { x: axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']), z: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) }, look: { dx, dy }, run: keys.has('ShiftLeft') || keys.has('ShiftRight') }
        : { move: { x: 0, z: 0 }, look: { dx: 0, dy: 0 }, run: false });
      dx = 0; dy = 0;
      let s = stateRef.current;
      if (out.event === 'powered') { s = poweredOn(s); say('The gate is on', 'Your plot is on the other side.'); }
      if (out.event === 'to-planet') { if (!s.visited) say('Stage 0', 'Black and white, and barely there. Your sync is running down.'); s = arrived(s); }
      if (out.event === 'to-lab') s = returned(s);
      if (out.event === 'sync-lost') { s = returned(s); say('Sync lost', 'The gate pulled you back. Your sync refills in the lab.'); setBuilding(false); setMenu(false); }
      if (out.event === 'stage-1') say('Stage 1', 'Colour has reached your plot.');
      if (s !== stateRef.current) commit(s);
      hook.frames += 1; hook.where = out.where; hook.sync = out.sync; hook.step = stateRef.current.step; hook.wave = scene.debug.wave();
      if (hook.frames % 30 === 0) Object.assign(hook, scene.debug.stats());
      if (ms - hudAt > 90 || out.event) { hudAt = ms; setHud({ where: out.where, sync: out.sync, atLever: out.atLever, ghost: out.ghost }); }
      raf = requestAnimationFrame(loop);
    };
    const step = (): void => {
      if (cancelled) return;
      steps[at]![1]();
      at += 1;
      if (at < steps.length) { setLoading(steps[at]![0]); timer = window.setTimeout(step, 0); return; }
      hook.ready = true;
      setReady(true);
      raf = requestAnimationFrame(loop);
    };
    (window as unknown as { hmPlay?: unknown }).hmPlay = Object.assign(hook, {
      pull: () => scene.pullLever(),
      go: (where: 'lab' | 'planet', x: number, z: number, yaw: number) => scene.debug.teleport(where, x, z, yaw),
      gate: () => scene.debug.gatePlanet(),
      showGround: (on: boolean) => scene.debug.showGround(on),
      placeAt: (x: number, z: number) => { const pm = scene.debug.placeAt(x, z); if (pm) commit(placed(stateRef.current, pm)); return !!pm; },
      state: () => stateRef.current,
      detail: () => scene.debug.detail(),
    });
    setLoading(steps[0]![0]);
    timer = window.setTimeout(step, 30);
    return () => {
      cancelled = true;
      delete (window as unknown as { hmPlay?: unknown }).hmPlay;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('mousemove', onMove);
      sceneRef.current = null;
      scene.dispose();
    };
  }, [tier, reduced, props.profile.gpu, props.profile.graphics, props.profile.quality, props.profile.fpsTarget, commit, say]);

  // ---- pointer lock: click to look round; losing it (Esc) pauses
  useEffect(() => {
    const onLock = (): void => {
      const on = document.pointerLockElement === canvasRef.current;
      setLocked(on);
      if (!on && ready && !creating) setPaused(true);
    };
    document.addEventListener('pointerlockchange', onLock);
    return () => document.removeEventListener('pointerlockchange', onLock);
  }, [ready, creating]);
  const lock = useCallback(() => {
    setPaused(false);
    try { void canvasRef.current?.requestPointerLock()?.catch?.(() => undefined); } catch { /* no pointer lock here: keys still walk */ }
  }, []);

  // ---- the keys that do things: E uses, B builds, Esc steps back
  const placeNow = useCallback(() => {
    const pm = sceneRef.current?.place();
    if (!pm) return;
    commit(placed(stateRef.current, pm));
    setBuilding(false);
    say('Texture mill running', 'Watch the colour spread from it.');
  }, [commit, say]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!ready || creating) return;
      if (e.code === 'Escape') {
        if (building) { setBuilding(false); sceneRef.current?.setBuilding(false); return; }
        if (menu) { setMenu(false); return; }
        if (!locked) setPaused((p) => !p);
        return;
      }
      if (paused) return;
      if (e.code === 'KeyE') {
        if (building) placeNow();
        else if (hud.atLever) sceneRef.current?.pullLever();
      }
      if (e.code === 'KeyB' && hud.where === 'planet') {
        if (building) { setBuilding(false); sceneRef.current?.setBuilding(false); } else setMenu((m) => !m);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, creating, building, menu, locked, paused, hud.atLever, hud.where, placeNow]);
  useEffect(() => {
    const onClick = (): void => { if (building && locked) placeNow(); };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [building, locked, placeNow]);
  // leaving the planet closes the build menu
  useEffect(() => { if (hud.where === 'lab') { setMenu(false); setBuilding(false); sceneRef.current?.setBuilding(false); } }, [hud.where]);

  const startBuilding = (): void => { setMenu(false); setBuilding(true); sceneRef.current?.setBuilding(true); if (!locked) lock(); };
  const goal = objective(state, hud.where);
  const syncLit = Math.ceil(hud.sync * SYNC_BLOCKS);
  const prompt = building
    ? (hud.ghost?.ok ? 'Click or E: place the texture mill' : hud.ghost?.why ?? 'Aim at the ground near the gate.')
    : hud.atLever ? 'E: pull the main lever' : '';

  return (
    <div className={`play${ready ? ' ready' : ''}${hud.where === 'planet' ? ' on-planet' : ''}${hud.sync < 0.3 && hud.where === 'planet' ? ' sync-low' : ''}`}>
      {failed ? <p className="play-failed" role="alert">This browser could not start 3D graphics (WebGL 2). Try another browser, or turn on hardware acceleration in its settings.</p> : <canvas ref={canvasRef} className="play-canvas" onClick={() => { if (ready && !creating && !locked) lock(); }} aria-label="The lab, in first person. Click to look around." />}
      {!ready && !failed ? <div className="gr-loading play-loading" role="status"><span>{loading}</span><i /></div> : null}

      {ready && creating ? (
        <div className="play-create">
          <CreateGoblin inLab kind="human" voice="setmix" title="Who are you?" doneLabel="Done: into the lab"
            onDone={(look) => { commit(created(stateRef.current, look.id)); say('Turn on the gate', 'The console with the big lever stands in front of it.'); }}
            onBack={props.onBack} />
        </div>
      ) : null}

      {ready && !creating ? (
        <>
          <section className="play-goal" aria-live="polite">
            <h2>{goal.title}</h2>
            <p>{goal.hint}</p>
          </section>
          {hud.where === 'planet' ? (
            <div className="play-sync" role="meter" aria-label="Sync" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.sync * 100)}>
              <span>Sync</span>
              <ol>{Array.from({ length: SYNC_BLOCKS }, (_, i) => <li key={i} className={i < syncLit ? 'on' : ''} />)}</ol>
            </div>
          ) : null}
          <i className="play-dot" aria-hidden="true" />
          {prompt ? <p className={`play-prompt${building && !hud.ghost?.ok ? ' bad' : ''}`}>{prompt}</p> : null}
          {menu ? (
            <section className="play-build" aria-label="Build">
              <h3>Build</h3>
              <button className="play-card" onClick={startBuilding} autoFocus>
                <b>Texture mill</b>
                <span>Grinds rock into texture detail: pink pixels that bring colour to your plot.</span>
                <em>{state.machines.length === 0 ? 'Free: your first machine' : 'Free while you learn'}</em>
              </button>
              <p>Place it within 30 m of the gate: its cable runs from the gate&rsquo;s junction box.</p>
            </section>
          ) : null}
          {!locked && !paused ? (
            <button className="play-start" onClick={lock}>
              <b>Click to look around</b>
              <span className="play-keys">{KEYS.map(([k, what]) => <span key={k}><kbd>{k}</kbd>{what}</span>)}</span>
            </button>
          ) : null}
          {paused ? (
            <div className="play-pause" role="dialog" aria-label="Paused">
              <h2>Paused</h2>
              <button className="go" onClick={lock}>Resume</button>
              <button onClick={props.onBack}>Back to SetMix</button>
            </div>
          ) : null}
          {toast ? <div key={toast.id} className={`play-toast${toast.text === 'Sync lost' ? ' lost' : ''}`} role="status"><b>{toast.text}</b>{toast.sub ? <span>{toast.sub}</span> : null}</div> : null}
        </>
      ) : null}
    </div>
  );
}
